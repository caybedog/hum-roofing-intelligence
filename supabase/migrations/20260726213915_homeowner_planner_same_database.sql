-- HUM Home Project Planner.
-- This expands the existing HUM Supabase project without changing or deleting
-- any roofing-pilot table, policy, user, storage object, or audit record.

create type public.planner_project_mode as enum ('photo', 'guided');
create type public.planner_project_status as enum (
  'draft',
  'estimated',
  'completed',
  'archived'
);
create type public.planner_catalog_status as enum (
  'proposed',
  'approved',
  'retired'
);
create type public.planner_confidence as enum ('low', 'medium', 'high');

create table public.planner_pricing_catalogs (
  id uuid primary key default gen_random_uuid(),
  version_code text not null unique
    check (version_code ~ '^[A-Z0-9._-]+$'),
  region text not null default 'Humboldt County, California',
  status public.planner_catalog_status not null default 'proposed',
  effective_date date not null,
  verified_at date not null,
  summary text not null check (char_length(summary) between 10 and 2000),
  limitation_note text not null check (char_length(limitation_note) between 10 and 2000),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table public.planner_pricing_items (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null
    references public.planner_pricing_catalogs(id) on delete restrict,
  category text not null
    check (category ~ '^[a-z0-9_-]+$'),
  variant text not null
    check (variant ~ '^[a-z0-9_-]+$'),
  label text not null check (char_length(label) between 3 and 160),
  unit text not null check (
    unit in ('square_foot', 'linear_foot', 'each', 'room', 'labor_hour')
  ),
  low_unit_cost numeric(12,2) not null check (low_unit_cost >= 0),
  expected_unit_cost numeric(12,2) not null check (expected_unit_cost >= low_unit_cost),
  high_unit_cost numeric(12,2) not null check (high_unit_cost >= expected_unit_cost),
  minimum_job numeric(12,2) not null default 0 check (minimum_job >= 0),
  permit_low numeric(12,2) not null default 0 check (permit_low >= 0),
  permit_expected numeric(12,2) not null default 0
    check (permit_expected >= permit_low),
  permit_high numeric(12,2) not null default 0
    check (permit_high >= permit_expected),
  confidence public.planner_confidence not null default 'low',
  source_keys text[] not null default '{}'::text[],
  assumptions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assumptions) = 'object'),
  created_at timestamptz not null default now(),
  unique (catalog_id, category, variant)
);

create table public.planner_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mode public.planner_project_mode not null,
  status public.planner_project_status not null default 'draft',
  category text not null check (category ~ '^[a-z0-9_-]+$'),
  variant text not null check (variant ~ '^[a-z0-9_-]+$'),
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 8000),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  facts jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  ai_summary text not null default '' check (char_length(ai_summary) <= 4000),
  confidence public.planner_confidence not null default 'low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.planner_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.planner_projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pricing_catalog_id uuid not null
    references public.planner_pricing_catalogs(id) on delete restrict,
  low_total numeric(14,2) not null check (low_total >= 0),
  expected_total numeric(14,2) not null check (expected_total >= low_total),
  high_total numeric(14,2) not null check (high_total >= expected_total),
  line_items jsonb not null check (jsonb_typeof(line_items) = 'array'),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'array'),
  unknowns jsonb not null check (jsonb_typeof(unknowns) = 'array'),
  calculation_input jsonb not null check (jsonb_typeof(calculation_input) = 'object'),
  confidence public.planner_confidence not null,
  created_at timestamptz not null default now()
);

create table public.planner_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.planner_projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('project_photo', 'actual_quote')),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 240),
  mime_type text not null check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )
  ),
  byte_size integer not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table public.planner_calibration_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.planner_projects(id) on delete restrict,
  estimate_id uuid not null references public.planner_estimates(id) on delete restrict,
  upload_id uuid references public.planner_uploads(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  consent_to_anonymous_calibration boolean not null,
  project_completed boolean not null default false,
  actual_quote_total numeric(14,2) check (actual_quote_total > 0),
  actual_final_total numeric(14,2) check (actual_final_total > 0),
  normalized_scope jsonb not null default '{}'::jsonb
    check (jsonb_typeof(normalized_scope) = 'object'),
  homeowner_notes text not null default '' check (char_length(homeowner_notes) <= 4000),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'excluded')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint planner_calibration_consent_required
    check (consent_to_anonymous_calibration)
);

create index planner_pricing_items_catalog_category_idx
  on public.planner_pricing_items(catalog_id, category, variant);
create index planner_projects_owner_updated_idx
  on public.planner_projects(owner_id, updated_at desc);
create index planner_estimates_project_created_idx
  on public.planner_estimates(project_id, created_at desc);
create index planner_estimates_owner_idx
  on public.planner_estimates(owner_id);
create index planner_uploads_project_kind_idx
  on public.planner_uploads(project_id, kind);
create index planner_uploads_owner_idx
  on public.planner_uploads(owner_id);
create index planner_calibration_owner_created_idx
  on public.planner_calibration_submissions(owner_id, created_at desc);
create index planner_calibration_review_idx
  on public.planner_calibration_submissions(review_status, created_at);

create trigger planner_projects_set_updated_at
before update on public.planner_projects
for each row execute function private.set_updated_at();

alter table public.planner_pricing_catalogs enable row level security;
alter table public.planner_pricing_items enable row level security;
alter table public.planner_projects enable row level security;
alter table public.planner_estimates enable row level security;
alter table public.planner_uploads enable row level security;
alter table public.planner_calibration_submissions enable row level security;

create policy planner_catalogs_read_approved_public
on public.planner_pricing_catalogs for select
to anon
using (status = 'approved');

create policy planner_catalogs_read_approved_or_admin
on public.planner_pricing_catalogs for select
to authenticated
using (status = 'approved' or (select private.is_admin()));

create policy planner_items_read_approved_public
on public.planner_pricing_items for select
to anon
using (
  exists (
    select 1
    from public.planner_pricing_catalogs catalog
    where catalog.id = planner_pricing_items.catalog_id
      and catalog.status = 'approved'
  )
);

create policy planner_items_read_approved_or_admin
on public.planner_pricing_items for select
to authenticated
using (
  exists (
    select 1
    from public.planner_pricing_catalogs catalog
    where catalog.id = planner_pricing_items.catalog_id
      and (catalog.status = 'approved' or (select private.is_admin()))
  )
);

create policy planner_projects_select_owner_or_admin
on public.planner_projects for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_projects_insert_owner
on public.planner_projects for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy planner_projects_update_owner_or_admin
on public.planner_projects for update
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
)
with check (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_projects_delete_owner_or_admin
on public.planner_projects for delete
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_estimates_select_owner_or_admin
on public.planner_estimates for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_estimates_insert_owner
on public.planner_estimates for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.planner_projects project
    where project.id = planner_estimates.project_id
      and project.owner_id = (select auth.uid())
  )
);

create policy planner_uploads_select_owner_or_admin
on public.planner_uploads for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_uploads_insert_owner
on public.planner_uploads for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.planner_projects project
    where project.id = planner_uploads.project_id
      and project.owner_id = (select auth.uid())
  )
);

create policy planner_uploads_delete_owner_or_admin
on public.planner_uploads for delete
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_calibration_select_owner_or_admin
on public.planner_calibration_submissions for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select private.is_admin())
);

create policy planner_calibration_insert_owner
on public.planner_calibration_submissions for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and consent_to_anonymous_calibration
  and exists (
    select 1
    from public.planner_projects project
    where project.id = planner_calibration_submissions.project_id
      and project.owner_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.planner_estimates estimate
    where estimate.id = planner_calibration_submissions.estimate_id
      and estimate.owner_id = (select auth.uid())
      and estimate.project_id = planner_calibration_submissions.project_id
  )
);

create policy planner_calibration_update_admin
on public.planner_calibration_submissions for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.planner_pricing_catalogs from anon, authenticated;
revoke all on public.planner_pricing_items from anon, authenticated;
revoke all on public.planner_projects from anon, authenticated;
revoke all on public.planner_estimates from anon, authenticated;
revoke all on public.planner_uploads from anon, authenticated;
revoke all on public.planner_calibration_submissions from anon, authenticated;

grant select on public.planner_pricing_catalogs to anon, authenticated;
grant select on public.planner_pricing_items to anon, authenticated;
grant select, insert, update, delete on public.planner_projects to authenticated;
grant select, insert on public.planner_estimates to authenticated;
grant select, insert, delete on public.planner_uploads to authenticated;
grant select, insert, update on public.planner_calibration_submissions to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'planner-uploads',
  'planner-uploads',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy planner_storage_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'planner-uploads'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

create policy planner_storage_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'planner-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy planner_storage_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'planner-uploads'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into public.planner_pricing_catalogs (
  version_code,
  status,
  effective_date,
  verified_at,
  summary,
  limitation_note,
  approved_at
)
values (
  'HUM-HC-HOME-2026.07-BETA',
  'approved',
  date '2026-07-26',
  date '2026-07-26',
  'Initial Humboldt County homeowner planning catalog. Local roofing, disposal, permit, labor, contractor-market, and public-scope evidence is combined with visibly labeled regional assumptions for categories that do not yet have enough consented residential quotes.',
  'This is a planning range, not a contractor offer. Public residential quotes are sparse outside roofing, incorporated cities have different permits, concealed conditions cannot be confirmed from photos, and every category remains subject to calibration from consented quotes and final invoices.',
  now()
)
on conflict (version_code) do nothing;

insert into public.planner_pricing_items (
  catalog_id,
  category,
  variant,
  label,
  unit,
  low_unit_cost,
  expected_unit_cost,
  high_unit_cost,
  minimum_job,
  permit_low,
  permit_expected,
  permit_high,
  confidence,
  source_keys,
  assumptions
)
select
  catalog.id,
  seed.category,
  seed.variant,
  seed.label,
  seed.unit,
  seed.low_unit_cost,
  seed.expected_unit_cost,
  seed.high_unit_cost,
  seed.minimum_job,
  seed.permit_low,
  seed.permit_expected,
  seed.permit_high,
  seed.confidence::public.planner_confidence,
  seed.source_keys,
  seed.assumptions
from public.planner_pricing_catalogs catalog
cross join (
  values
    ('roofing', 'asphalt_replacement', 'Asphalt roof replacement', 'square_foot', 7.75, 10.25, 14.50, 6500, 350, 700, 1600, 'medium', array['lowes-gaf-hdz-20260726','home-depot-underlayment-20260726','hwma-fees-fy2025-26','humboldt-reroof-requirements-20260726','california-edd-roofers-20260726'], '{"included":"tear-off allowance, architectural shingles, underlayment, standard flashing, disposal, labor, overhead and profit"}'::jsonb),
    ('gutters', 'seamless_aluminum', 'Seamless aluminum gutters', 'linear_foot', 16.00, 22.00, 32.00, 1200, 0, 0, 300, 'low', array['cslb-humboldt-c39-20260726','lost-coast-roofing-directory-20260726','hum-admin-assumptions-20260726'], '{"included":"standard 5- or 6-inch gutter, hangers, ordinary downspout allowance and installation"}'::jsonb),
    ('windows', 'standard_replacement', 'Standard replacement windows', 'each', 1100.00, 1650.00, 2600.00, 1100, 0, 250, 900, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"mid-grade window, removal, ordinary flashing and interior/exterior trim touch-up"}'::jsonb),
    ('doors', 'exterior_door', 'Exterior entry door replacement', 'each', 1900.00, 3200.00, 6000.00, 1900, 0, 200, 800, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"pre-hung exterior door, ordinary hardware allowance, removal, weather sealing and trim"}'::jsonb),
    ('plumbing', 'fixture_work', 'Plumbing fixture replacement or repair', 'each', 450.00, 950.00, 2000.00, 450, 0, 150, 650, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary fixture allowance, connections, service labor and small materials"}'::jsonb),
    ('plumbing', 'water_heater', 'Water heater replacement', 'each', 2200.00, 3600.00, 6200.00, 2200, 200, 500, 1400, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"standard residential unit, removal, ordinary connections, labor and disposal"}'::jsonb),
    ('plumbing', 'repipe', 'Whole-home repipe', 'square_foot', 7.00, 12.00, 20.00, 8000, 500, 1200, 3000, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"accessible domestic water piping and ordinary wall access; finish repair varies"}'::jsonb),
    ('painting', 'interior', 'Interior painting', 'square_foot', 3.00, 5.00, 8.00, 1800, 0, 0, 0, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary prep, two finish coats, standard wall and ceiling access"}'::jsonb),
    ('painting', 'exterior', 'Exterior painting', 'square_foot', 4.00, 7.00, 11.00, 4000, 0, 150, 700, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"washing, ordinary prep, spot prime and finish coats; lead or major rot excluded"}'::jsonb),
    ('flooring', 'installed', 'Installed finish flooring', 'square_foot', 9.00, 16.00, 30.00, 1800, 0, 0, 0, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"mid-range finish material, ordinary removal, basic underlayment and installation"}'::jsonb),
    ('electrical', 'fixture_or_circuit', 'Electrical fixture or circuit work', 'each', 500.00, 1000.00, 2200.00, 500, 0, 200, 900, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary device or branch-circuit allowance, service labor and small materials"}'::jsonb),
    ('electrical', 'panel', 'Electrical service panel replacement', 'each', 4500.00, 7500.00, 12000.00, 4500, 500, 1200, 3000, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"typical residential panel, service labor and ordinary permit allowance; utility work varies"}'::jsonb),
    ('hvac', 'heat_pump', 'Heat-pump system', 'each', 14000.00, 22000.00, 35000.00, 14000, 400, 1000, 2500, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"typical residential equipment, standard installation and startup; electrical or duct upgrades vary"}'::jsonb),
    ('siding', 'replacement', 'Siding replacement', 'square_foot', 14.00, 22.00, 36.00, 10000, 350, 900, 2200, 'low', array['cslb-humboldt-c39-20260726','california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary removal, weather barrier, mid-range siding, trim allowance, labor, overhead and profit"}'::jsonb),
    ('deck', 'new_deck', 'New residential deck', 'square_foot', 55.00, 85.00, 135.00, 8000, 600, 1600, 4500, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"standard framing and decking with ordinary guardrail allowance; engineering and steep sites vary"}'::jsonb),
    ('bathroom', 'remodel', 'Bathroom remodel', 'room', 20000.00, 40000.00, 75000.00, 20000, 500, 1500, 4000, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"typical fixture, finish, labor, overhead and profit allowances; layout changes and hidden damage vary"}'::jsonb),
    ('kitchen', 'remodel', 'Kitchen remodel', 'room', 40000.00, 75000.00, 150000.00, 40000, 700, 2000, 6000, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"mid-range cabinets, counters, finishes and trade labor; appliances and structural changes vary"}'::jsonb),
    ('fencing', 'wood_fence', 'Wood privacy fence', 'linear_foot', 45.00, 70.00, 110.00, 2500, 0, 150, 900, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary wood privacy fence, posts, concrete, removal allowance and labor"}'::jsonb),
    ('concrete', 'flatwork', 'Concrete flatwork', 'square_foot', 14.00, 23.00, 40.00, 2500, 0, 200, 1000, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"ordinary excavation, base, forms, reinforcing allowance, concrete and finishing"}'::jsonb),
    ('landscaping', 'labor_project', 'Landscape labor and installation', 'labor_hour', 85.00, 125.00, 180.00, 1500, 0, 0, 300, 'low', array['california-edd-roofers-20260726','hum-admin-assumptions-20260726'], '{"included":"loaded crew labor allowance; plants, equipment, soil and disposal are separate facts"}'::jsonb)
) as seed(
  category,
  variant,
  label,
  unit,
  low_unit_cost,
  expected_unit_cost,
  high_unit_cost,
  minimum_job,
  permit_low,
  permit_expected,
  permit_high,
  confidence,
  source_keys,
  assumptions
)
where catalog.version_code = 'HUM-HC-HOME-2026.07-BETA'
on conflict (catalog_id, category, variant) do nothing;

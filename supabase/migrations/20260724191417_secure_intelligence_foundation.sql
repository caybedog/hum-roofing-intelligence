create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.hum_role as enum (
  'homeowner',
  'contractor',
  'administrator'
);

create type public.project_status as enum (
  'draft',
  'ready_for_estimate',
  'estimated',
  'archived'
);

create type public.pricing_status as enum (
  'proposed',
  'approved',
  'retired'
);

create type public.review_status as enum (
  'draft',
  'submitted'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null unique,
  full_name text,
  role public.hum_role not null default 'homeowner',
  service_area text,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  status public.project_status not null default 'draft',
  intake_step smallint not null default 1 check (intake_step between 1 and 6),
  city text not null default 'Eureka',
  county text not null default 'Humboldt',
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  project_type text not null default 'replacement'
    check (project_type in ('repair', 'replacement', 'inspection', 'unknown')),
  footprint_sqft numeric(10,2) check (footprint_sqft is null or footprint_sqft between 100 and 50000),
  roof_pitch text not null default 'moderate'
    check (roof_pitch in ('low', 'moderate', 'steep')),
  stories smallint not null default 1 check (stories between 1 and 4),
  existing_layers smallint not null default 1 check (existing_layers between 0 and 4),
  roof_material text not null default 'architectural_shingle'
    check (roof_material in ('architectural_shingle', 'three_tab', 'metal', 'tile', 'unknown')),
  access_level text not null default 'standard'
    check (access_level in ('easy', 'standard', 'difficult')),
  complexity text not null default 'standard'
    check (complexity in ('simple', 'standard', 'complex')),
  active_leak boolean not null default false,
  chimney_count smallint not null default 0 check (chimney_count between 0 and 12),
  skylight_count smallint not null default 0 check (skylight_count between 0 and 30),
  decking_allowance_sheets smallint not null default 4 check (decking_allowance_sheets between 0 and 100),
  homeowner_notes text not null default '' check (char_length(homeowner_notes) <= 6000),
  homeowner_facts jsonb not null default '{}'::jsonb,
  ai_interpretation jsonb,
  ai_source text check (ai_source is null or ai_source in ('openai', 'deterministic_fallback')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pricing_versions (
  id uuid primary key default gen_random_uuid(),
  version_code text not null unique check (char_length(version_code) between 3 and 80),
  region text not null default 'Humboldt County, California',
  category text not null default 'asphalt_roofing',
  status public.pricing_status not null default 'proposed',
  effective_date date not null,
  source_summary text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  change_summary text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null)
);

create table public.pricing_items (
  id uuid primary key default gen_random_uuid(),
  pricing_version_id uuid not null references public.pricing_versions(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  category text not null,
  label text not null,
  unit text not null,
  low_value numeric(14,4) not null,
  expected_value numeric(14,4) not null,
  high_value numeric(14,4) not null,
  source_name text not null,
  source_url text,
  verified_at date not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  change_note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pricing_version_id, code),
  check (low_value <= expected_value and expected_value <= high_value)
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  pricing_version_id uuid not null references public.pricing_versions(id) on delete restrict,
  homeowner_inputs jsonb not null,
  ai_interpretation jsonb,
  calculation_inputs jsonb not null,
  calculation_result jsonb not null,
  confidence_score smallint not null check (confidence_score between 0 and 100),
  missing_information jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  ai_observation jsonb,
  created_at timestamptz not null default now()
);

create table public.project_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  contractor_id uuid not null references public.profiles(id) on delete restrict,
  shared_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index project_shares_active_unique
  on public.project_shares (project_id, contractor_id)
  where revoked_at is null;

create table public.contractor_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  estimate_id uuid references public.estimates(id) on delete restrict,
  contractor_id uuid not null references public.profiles(id) on delete restrict,
  status public.review_status not null default 'draft',
  measurement_corrections jsonb not null default '{}'::jsonb,
  scope_corrections jsonb not null default '[]'::jsonb,
  pricing_observations jsonb not null default '[]'::jsonb,
  notes text not null default '' check (char_length(notes) <= 6000),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, contractor_id)
);

create table public.pricing_observations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  estimate_id uuid references public.estimates(id) on delete restrict,
  observed_by uuid not null references public.profiles(id) on delete restrict,
  pricing_code text not null,
  observed_value numeric(14,4) not null,
  source_note text not null check (char_length(source_note) between 3 and 1000),
  status text not null default 'proposed'
    check (status in ('proposed', 'reviewed', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'fallback', 'error')),
  model text not null,
  input_chars integer not null check (input_chars between 1 and 4000),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  provider_request_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index projects_homeowner_id_idx on public.projects(homeowner_id);
create index projects_updated_at_idx on public.projects(updated_at desc);
create index estimates_project_id_idx on public.estimates(project_id, version_number desc);
create index estimates_pricing_version_id_idx on public.estimates(pricing_version_id);
create index pricing_items_version_idx on public.pricing_items(pricing_version_id);
create index project_photos_project_id_idx on public.project_photos(project_id);
create index project_shares_contractor_id_idx on public.project_shares(contractor_id) where revoked_at is null;
create index contractor_reviews_project_id_idx on public.contractor_reviews(project_id);
create index pricing_observations_status_idx on public.pricing_observations(status, created_at);
create index ai_requests_user_created_idx on public.ai_requests(user_id, created_at desc);
create index audit_events_actor_created_idx on public.audit_events(actor_id, created_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();

create trigger pricing_versions_set_updated_at
before update on public.pricing_versions
for each row execute function private.set_updated_at();

create trigger pricing_items_set_updated_at
before update on public.pricing_items
for each row execute function private.set_updated_at();

create trigger contractor_reviews_set_updated_at
before update on public.contractor_reviews
for each row execute function private.set_updated_at();

create trigger pricing_observations_set_updated_at
before update on public.pricing_observations
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_role text;
  safe_role public.hum_role;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'homeowner');
  safe_role := case
    when requested_role = 'contractor' then 'contractor'::public.hum_role
    else 'homeowner'::public.hum_role
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@invalid.local')),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    safe_role
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'administrator'
      and deactivated_at is null
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create function private.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1
      from public.projects
      where id = target_project_id
        and homeowner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.project_shares
      where project_id = target_project_id
        and contractor_id = (select auth.uid())
        and revoked_at is null
    )
    or private.is_admin();
$$;

revoke all on function private.can_access_project(uuid) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;

create function private.prevent_approved_pricing_changes()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  version_status public.pricing_status;
begin
  select status into version_status
  from public.pricing_versions
  where id = coalesce(new.pricing_version_id, old.pricing_version_id);

  if version_status = 'approved' then
    raise exception 'Approved pricing records are immutable; create a proposed version instead.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pricing_items_lock_approved
before insert or update or delete on public.pricing_items
for each row execute function private.prevent_approved_pricing_changes();

create function private.prevent_approved_version_changes()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.status = 'approved' then
    raise exception 'Approved pricing versions are immutable; create a proposed version instead.';
  end if;
  return new;
end;
$$;

create trigger pricing_versions_lock_approved
before update or delete on public.pricing_versions
for each row execute function private.prevent_approved_version_changes();

create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  row_data jsonb;
  target_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_id := nullif(
    coalesce(row_data ->> 'id', row_data ->> 'project_id'),
    ''
  )::uuid;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object(
      'operation', lower(tg_op),
      'recorded_at', now()
    )
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_row_change() from public, anon, authenticated;

create trigger projects_audit
after insert or update on public.projects
for each row execute function private.audit_row_change();

create trigger estimates_audit
after insert on public.estimates
for each row execute function private.audit_row_change();

create trigger project_photos_audit
after insert or delete on public.project_photos
for each row execute function private.audit_row_change();

create trigger project_shares_audit
after insert or update on public.project_shares
for each row execute function private.audit_row_change();

create trigger contractor_reviews_audit
after insert or update on public.contractor_reviews
for each row execute function private.audit_row_change();

create trigger pricing_versions_audit
after insert or update on public.pricing_versions
for each row execute function private.audit_row_change();

create trigger pricing_items_audit
after insert or update or delete on public.pricing_items
for each row execute function private.audit_row_change();

create function public.share_project_with_contractor_email(
  p_project_id uuid,
  p_contractor_email text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_contractor uuid;
  share_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and homeowner_id = (select auth.uid())
      and archived_at is null
  ) then
    raise exception 'Project not found or not owned by the current homeowner';
  end if;

  select id into target_contractor
  from public.profiles
  where lower(email) = lower(trim(p_contractor_email))
    and role = 'contractor'
    and deactivated_at is null
  limit 1;

  if target_contractor is null then
    raise exception 'No active contractor account matches that email';
  end if;

  select id into share_id
  from public.project_shares
  where project_id = p_project_id
    and contractor_id = target_contractor
    and revoked_at is null
  limit 1;

  if share_id is null then
    insert into public.project_shares (
      project_id,
      contractor_id,
      shared_by
    )
    values (
      p_project_id,
      target_contractor,
      (select auth.uid())
    )
    returning id into share_id;
  end if;

  return share_id;
end;
$$;

revoke all on function public.share_project_with_contractor_email(uuid, text) from public, anon;
grant execute on function public.share_project_with_contractor_email(uuid, text) to authenticated;

create function public.claim_ai_request(
  p_project_id uuid,
  p_model text,
  p_input_chars integer
)
returns table (allowed boolean, request_id uuid)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_request_id uuid;
begin
  if current_user_id is null then
    return query select false, null::uuid;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if (
    select count(*)
    from public.ai_requests
    where user_id = current_user_id
      and created_at >= now() - interval '1 hour'
  ) >= 10 then
    return query select false, null::uuid;
    return;
  end if;

  insert into public.ai_requests (
    user_id,
    project_id,
    model,
    input_chars
  )
  values (
    current_user_id,
    p_project_id,
    left(p_model, 100),
    p_input_chars
  )
  returning id into created_request_id;

  return query select true, created_request_id;
end;
$$;

revoke all on function public.claim_ai_request(uuid, text, integer) from public, anon;
grant execute on function public.claim_ai_request(uuid, text, integer) to authenticated;

create function public.approve_pricing_version(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if not exists (
    select 1
    from public.pricing_items
    where pricing_version_id = p_version_id
  ) then
    raise exception 'Pricing version has no items';
  end if;

  update public.pricing_versions
  set
    status = 'approved',
    approved_by = (select auth.uid()),
    approved_at = now(),
    updated_at = now()
  where id = p_version_id
    and status = 'proposed';

  if not found then
    raise exception 'Only a proposed pricing version can be approved';
  end if;

  return p_version_id;
end;
$$;

revoke all on function public.approve_pricing_version(uuid) from public, anon;
grant execute on function public.approve_pricing_version(uuid) to authenticated;

create function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.hum_role
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'role_changed',
    'profiles',
    p_user_id,
    jsonb_build_object('new_role', p_role)
  );

  return p_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.hum_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.hum_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.pricing_versions enable row level security;
alter table public.pricing_items enable row level security;
alter table public.estimates enable row level security;
alter table public.project_photos enable row level security;
alter table public.project_shares enable row level security;
alter table public.contractor_reviews enable row level security;
alter table public.pricing_observations enable row level security;
alter table public.ai_requests enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

create policy profiles_update_own_or_admin
on public.profiles for update
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  id = (select auth.uid())
  or (select private.is_admin())
);

create policy projects_select_authorized
on public.projects for select
to authenticated
using (
  (select private.can_access_project(id))
);

create policy projects_insert_homeowner
on public.projects for insert
to authenticated
with check (
  homeowner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'homeowner'
      and profiles.deactivated_at is null
  )
);

create policy projects_update_owner_or_admin
on public.projects for update
to authenticated
using (
  homeowner_id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  homeowner_id = (select auth.uid())
  or (select private.is_admin())
);

create policy pricing_versions_select_approved_or_admin
on public.pricing_versions for select
to authenticated
using (
  status = 'approved'
  or (select private.is_admin())
);

create policy pricing_versions_admin_insert
on public.pricing_versions for insert
to authenticated
with check (
  (select private.is_admin())
  and status = 'proposed'
  and created_by = (select auth.uid())
);

create policy pricing_versions_admin_update
on public.pricing_versions for update
to authenticated
using (
  (select private.is_admin())
  and status = 'proposed'
)
with check (
  (select private.is_admin())
  and status = 'proposed'
);

create policy pricing_items_select_approved_or_admin
on public.pricing_items for select
to authenticated
using (
  exists (
    select 1
    from public.pricing_versions
    where pricing_versions.id = pricing_items.pricing_version_id
      and (
        pricing_versions.status = 'approved'
        or (select private.is_admin())
      )
  )
);

create policy pricing_items_admin_insert
on public.pricing_items for insert
to authenticated
with check (
  (select private.is_admin())
  and exists (
    select 1
    from public.pricing_versions
    where pricing_versions.id = pricing_items.pricing_version_id
      and pricing_versions.status = 'proposed'
  )
);

create policy pricing_items_admin_update
on public.pricing_items for update
to authenticated
using (
  (select private.is_admin())
  and exists (
    select 1
    from public.pricing_versions
    where pricing_versions.id = pricing_items.pricing_version_id
      and pricing_versions.status = 'proposed'
  )
)
with check (
  (select private.is_admin())
);

create policy pricing_items_admin_delete
on public.pricing_items for delete
to authenticated
using (
  (select private.is_admin())
  and exists (
    select 1
    from public.pricing_versions
    where pricing_versions.id = pricing_items.pricing_version_id
      and pricing_versions.status = 'proposed'
  )
);

create policy estimates_select_authorized
on public.estimates for select
to authenticated
using (
  (select private.can_access_project(project_id))
);

create policy estimates_insert_owner
on public.estimates for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.projects
    where projects.id = estimates.project_id
      and projects.homeowner_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.pricing_versions
    where pricing_versions.id = estimates.pricing_version_id
      and pricing_versions.status = 'approved'
  )
);

create policy project_photos_select_authorized
on public.project_photos for select
to authenticated
using (
  (select private.can_access_project(project_id))
);

create policy project_photos_insert_owner
on public.project_photos for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.projects
    where projects.id = project_photos.project_id
      and projects.homeowner_id = (select auth.uid())
  )
);

create policy project_photos_delete_owner_or_admin
on public.project_photos for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_admin())
);

create policy project_shares_select_participants
on public.project_shares for select
to authenticated
using (
  contractor_id = (select auth.uid())
  or shared_by = (select auth.uid())
  or (select private.can_access_project(project_id))
);

create policy project_shares_insert_owner
on public.project_shares for insert
to authenticated
with check (
  shared_by = (select auth.uid())
  and exists (
    select 1
    from public.projects
    where projects.id = project_shares.project_id
      and projects.homeowner_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.profiles
    where profiles.id = project_shares.contractor_id
      and profiles.role = 'contractor'
      and profiles.deactivated_at is null
  )
);

create policy project_shares_update_owner_or_admin
on public.project_shares for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_shares.project_id
      and projects.homeowner_id = (select auth.uid())
  )
  or (select private.is_admin())
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_shares.project_id
      and projects.homeowner_id = (select auth.uid())
  )
  or (select private.is_admin())
);

create policy contractor_reviews_select_authorized
on public.contractor_reviews for select
to authenticated
using (
  contractor_id = (select auth.uid())
  or (select private.can_access_project(project_id))
);

create policy contractor_reviews_insert_shared_contractor
on public.contractor_reviews for insert
to authenticated
with check (
  contractor_id = (select auth.uid())
  and exists (
    select 1
    from public.project_shares
    where project_shares.project_id = contractor_reviews.project_id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
);

create policy contractor_reviews_update_author
on public.contractor_reviews for update
to authenticated
using (
  contractor_id = (select auth.uid())
)
with check (
  contractor_id = (select auth.uid())
);

create policy pricing_observations_select_authorized
on public.pricing_observations for select
to authenticated
using (
  observed_by = (select auth.uid())
  or (select private.can_access_project(project_id))
  or (select private.is_admin())
);

create policy pricing_observations_insert_contractor_or_admin
on public.pricing_observations for insert
to authenticated
with check (
  observed_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.project_shares
      where project_shares.project_id = pricing_observations.project_id
        and project_shares.contractor_id = (select auth.uid())
        and project_shares.revoked_at is null
    )
    or (select private.is_admin())
  )
  and status = 'proposed'
);

create policy pricing_observations_admin_update
on public.pricing_observations for update
to authenticated
using (
  (select private.is_admin())
)
with check (
  (select private.is_admin())
);

create policy ai_requests_select_own_or_admin
on public.ai_requests for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy ai_requests_insert_own
on public.ai_requests for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    project_id is null
    or exists (
      select 1
      from public.projects
      where projects.id = ai_requests.project_id
        and projects.homeowner_id = (select auth.uid())
    )
  )
);

create policy ai_requests_update_own
on public.ai_requests for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
);

create policy audit_events_select_own_or_admin
on public.audit_events for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select private.is_admin())
);

revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, service_area, updated_at) on public.profiles to authenticated;

grant select, insert on public.projects to authenticated;
grant update (
  title,
  status,
  intake_step,
  city,
  county,
  postal_code,
  project_type,
  footprint_sqft,
  roof_pitch,
  stories,
  existing_layers,
  roof_material,
  access_level,
  complexity,
  active_leak,
  chimney_count,
  skylight_count,
  decking_allowance_sheets,
  homeowner_notes,
  homeowner_facts,
  ai_interpretation,
  ai_source,
  archived_at,
  updated_at
) on public.projects to authenticated;

grant select, insert, update, delete on public.pricing_versions to authenticated;
grant select, insert, update, delete on public.pricing_items to authenticated;
grant select, insert on public.estimates to authenticated;
grant select, insert, delete on public.project_photos to authenticated;
grant select, insert on public.project_shares to authenticated;
grant update (revoked_at) on public.project_shares to authenticated;
grant select, insert, update on public.contractor_reviews to authenticated;
grant select, insert, update on public.pricing_observations to authenticated;
grant select, insert, update on public.ai_requests to authenticated;
grant select on public.audit_events to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-photos',
  'project-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy project_photos_storage_insert_owner
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.projects
    where projects.id::text = (storage.foldername(name))[2]
      and projects.homeowner_id = (select auth.uid())
  )
);

create policy project_photos_storage_select_authorized
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1
    from public.projects
    where projects.id::text = (storage.foldername(name))[2]
      and (
        projects.homeowner_id = (select auth.uid())
        or exists (
          select 1
          from public.project_shares
          where project_shares.project_id = projects.id
            and project_shares.contractor_id = (select auth.uid())
            and project_shares.revoked_at is null
        )
        or (select private.is_admin())
      )
  )
);

create policy project_photos_storage_delete_owner_or_admin
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

with seeded_version as (
  insert into public.pricing_versions (
    version_code,
    region,
    category,
    status,
    effective_date,
    source_summary,
    confidence,
    change_summary,
    approved_at
  )
  values (
    'HUM-HC-ROOF-2026.07-BASELINE',
    'Humboldt County, California',
    'asphalt_roofing',
    'proposed',
    date '2026-07-24',
    'Initial planning baseline anchored to current retail shingle coverage and pricing, Humboldt Waste Management Authority FY 2026-27 disposal fees, Humboldt County building-fee publications, and published roofing wage references. Contractor burden, productivity, overhead, contingency, and margin remain administrator-reviewed planning assumptions pending Round 4 field calibration.',
    'medium',
    'First immutable Humboldt asphalt-roofing baseline.',
    null
  )
  returning id
)
insert into public.pricing_items (
  pricing_version_id,
  code,
  category,
  label,
  unit,
  low_value,
  expected_value,
  high_value,
  source_name,
  source_url,
  verified_at,
  confidence,
  change_note
)
select
  seeded_version.id,
  item.code,
  item.category,
  item.label,
  item.unit,
  item.low_value,
  item.expected_value,
  item.high_value,
  item.source_name,
  item.source_url,
  date '2026-07-24',
  item.confidence,
  'Initial approved baseline; future observations must enter the review queue.'
from seeded_version
cross join (
  values
    ('shingle_material', 'materials', 'Architectural shingles', 'per roofing square', 127.0000, 145.0000, 225.0000, 'Lowe''s GAF Timberline HDZ and Home Depot designer-shingle retail references', 'https://www.lowes.com/pd/GAF-Timberline-HDZ-Charcoal-Algae-Resistant-Architectural-Roof-Shingles-33-33-sq-ft-per-Bundle/1001327246', 'medium'),
    ('underlayment', 'materials', 'Underlayment', 'per roofing square', 10.0000, 28.0000, 58.0000, 'Home Depot felt reference plus administrator synthetic-underlayment allowance', 'https://www.homedepot.com/p/Warrior-Roofing-15-Felt-Roof-Deck-Protection-D406-0/100092007', 'low'),
    ('accessories', 'materials', 'Starter, ridge, ventilation accessories', 'per roofing square', 28.0000, 48.0000, 82.0000, 'Administrator planning allowance informed by complete-system accessory requirements', 'https://www.gaf.com/en-us/roofing-materials/residential-roofing-materials/shingles/timberline-hdz', 'low'),
    ('fasteners_misc', 'materials', 'Fasteners and miscellaneous materials', 'per roofing square', 10.0000, 18.0000, 32.0000, 'Administrator planning allowance', null, 'low'),
    ('labor_hours_install', 'labor', 'Installation labor hours', 'hours per roofing square', 3.5000, 4.7500, 6.5000, 'Administrator productivity assumption pending contractor calibration', null, 'low'),
    ('labor_hour_rate', 'labor', 'Burdened crew labor rate', 'per labor hour', 48.0000, 68.0000, 95.0000, 'Published roofer wage references plus administrator burden allowance', 'https://www.bls.gov/oes/2023/may/oes472181.htm', 'low'),
    ('tearoff_per_layer', 'removal', 'Tear-off labor', 'per layer per roofing square', 68.0000, 105.0000, 155.0000, 'Administrator productivity assumption pending contractor calibration', null, 'low'),
    ('disposal_per_layer', 'removal', 'Disposal and hauling', 'per layer per roofing square', 45.0000, 68.0000, 98.0000, 'HWMA FY 2026-27 solid-waste fee of $216.47 per ton plus hauling allowance', 'https://www.hwma.net/solid-waste', 'medium'),
    ('permit_allowance', 'allowance', 'Permit allowance', 'per project', 300.0000, 650.0000, 1200.0000, 'Humboldt County building-fee publications; actual fee varies by valuation and jurisdiction', 'https://humboldtgov.org/DocumentCenter/View/118373/Building-Inspection-Fees', 'medium'),
    ('delivery_allowance', 'allowance', 'Material delivery allowance', 'per project', 250.0000, 450.0000, 800.0000, 'Administrator planning allowance pending supplier calibration', null, 'low'),
    ('decking_sheet', 'allowance', 'Decking replacement allowance', 'per 7/16-inch OSB sheet', 85.0000, 125.0000, 185.0000, 'Administrator material-and-labor allowance pending contractor calibration', null, 'low'),
    ('flashing_allowance', 'allowance', 'Base flashing allowance', 'per project', 350.0000, 850.0000, 1800.0000, 'Administrator planning allowance; penetrations scale the estimate', null, 'low'),
    ('waste_factor', 'factor', 'Material waste factor', 'decimal', 0.0800, 0.1200, 0.1800, 'GAF coverage reference plus administrator roof-complexity allowance', 'https://www.gaf.com/en-us/document-library/documents/installation-instructions-%26-guides/timberline-layerlock-installation-instructions-trilingual-restl622.pdf', 'medium'),
    ('pitch_adjustment', 'factor', 'Steep-pitch adjustment', 'decimal', 0.0600, 0.1400, 0.2400, 'Administrator labor-risk allowance', null, 'low'),
    ('story_adjustment', 'factor', 'Additional-story adjustment', 'decimal per story above one', 0.0400, 0.0900, 0.1600, 'Administrator access allowance', null, 'low'),
    ('access_adjustment', 'factor', 'Difficult-access adjustment', 'decimal', 0.0500, 0.1100, 0.2000, 'Administrator staging and handling allowance', null, 'low'),
    ('complexity_adjustment', 'factor', 'Complex-roof adjustment', 'decimal', 0.0500, 0.1200, 0.2200, 'Administrator geometry and detail-work allowance', null, 'low'),
    ('overhead_rate', 'business', 'Contractor overhead', 'decimal', 0.1000, 0.1500, 0.2200, 'Administrator business-model assumption; not a market fact', null, 'low'),
    ('contingency_rate', 'business', 'Planning contingency', 'decimal', 0.0400, 0.0700, 0.1100, 'Administrator risk allowance', null, 'low'),
    ('target_margin', 'business', 'Target gross margin', 'decimal', 0.1800, 0.2500, 0.3200, 'Administrator business-model assumption; editable in future proposed versions', null, 'low'),
    ('geographic_adjustment', 'factor', 'Humboldt geographic adjustment', 'multiplier', 1.0000, 1.0500, 1.1200, 'Administrator logistics allowance pending local quote comparison', null, 'low')
) as item(
  code,
  category,
  label,
  unit,
  low_value,
  expected_value,
  high_value,
  source_name,
  source_url,
  confidence
);

update public.pricing_versions
set
  status = 'approved',
  approved_at = now(),
  updated_at = now()
where version_code = 'HUM-HC-ROOF-2026.07-BASELINE';

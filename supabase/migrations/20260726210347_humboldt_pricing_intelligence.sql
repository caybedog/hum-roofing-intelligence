-- Phase 4A.4: source-backed Humboldt pricing intelligence.
-- Contractor identities are recruitment context only and never become pricing
-- evidence unless a separate, lawful public bid or consented quote is recorded.

create table public.pricing_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^[a-z0-9_-]+$'),
  name text not null check (char_length(name) between 3 and 180),
  publisher text not null check (char_length(publisher) between 2 and 160),
  source_type text not null check (
    source_type in (
      'government',
      'manufacturer',
      'retailer',
      'public_bid',
      'labor_statistics',
      'market_directory',
      'industry_assumption'
    )
  ),
  geography text not null check (char_length(geography) between 2 and 160),
  source_url text,
  published_at date,
  verified_at date not null,
  fresh_until date,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  status text not null default 'active'
    check (status in ('active', 'stale', 'retired')),
  evidence_summary text not null
    check (char_length(evidence_summary) between 10 and 2000),
  limitation_note text not null default ''
    check (char_length(limitation_note) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.pricing_sources is
  'Immutable snapshots of lawful public evidence used to explain or support HUM pricing inputs.';

create table public.pricing_item_sources (
  id uuid primary key default gen_random_uuid(),
  pricing_item_id uuid not null
    references public.pricing_items(id) on delete restrict,
  pricing_source_id uuid not null
    references public.pricing_sources(id) on delete restrict,
  evidence_role text not null check (
    evidence_role in ('primary', 'supporting', 'assumption')
  ),
  evidence_note text not null
    check (char_length(evidence_note) between 3 and 1000),
  created_at timestamptz not null default now(),
  unique (pricing_item_id, pricing_source_id)
);

comment on table public.pricing_item_sources is
  'Many-to-many provenance links between an immutable pricing input and its source snapshots.';

create table public.contractor_market_records (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique
    check (char_length(company_name) between 2 and 180),
  city text not null check (char_length(city) between 2 and 100),
  service_area text not null
    check (char_length(service_area) between 2 and 300),
  public_website text,
  public_phone text,
  license_number text check (
    license_number is null or license_number ~ '^[0-9]{1,8}$'
  ),
  classification_claim text,
  license_evidence_status text not null check (
    license_evidence_status in (
      'directory_listed',
      'business_claim',
      'cslb_verified'
    )
  ),
  specialties text[] not null default '{}'::text[],
  source_url text not null,
  last_verified_at date not null,
  recruitment_status text not null default 'research'
    check (
      recruitment_status in (
        'research',
        'candidate',
        'contacted',
        'declined',
        'pilot_partner'
      )
    ),
  pricing_use_prohibited boolean not null default true,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contractor_market_records is
  'Public contractor discovery data for pilot recruitment and market coverage. These rows are not pricing evidence.';

create table public.public_project_evidence (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(title) between 3 and 220),
  evidence_type text not null check (
    evidence_type in ('residential_scope', 'public_works_scope', 'permit_rule')
  ),
  project_type text not null check (char_length(project_type) between 2 and 100),
  geography text not null check (char_length(geography) between 2 and 160),
  source_url text not null,
  published_at date,
  verified_at date not null,
  pricing_usability text not null check (
    pricing_usability in (
      'scope_only',
      'residential_calibration',
      'public_works_separate'
    )
  ),
  total_price numeric(14,2) check (total_price is null or total_price >= 0),
  evidence_summary text not null
    check (char_length(evidence_summary) between 10 and 2000),
  limitation_note text not null
    check (char_length(limitation_note) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.public_project_evidence is
  'Public project scopes and outcomes kept separate by pricing usability so public-works economics cannot silently calibrate residential estimates.';

create index pricing_item_sources_item_idx
  on public.pricing_item_sources(pricing_item_id);
create index pricing_item_sources_source_idx
  on public.pricing_item_sources(pricing_source_id);
create index pricing_sources_status_freshness_idx
  on public.pricing_sources(status, fresh_until);
create index contractor_market_city_idx
  on public.contractor_market_records(city, recruitment_status);
create index public_project_evidence_use_idx
  on public.public_project_evidence(pricing_usability, verified_at desc);

create trigger contractor_market_records_set_updated_at
before update on public.contractor_market_records
for each row execute function private.set_updated_at();

create trigger public_project_evidence_set_updated_at
before update on public.public_project_evidence
for each row execute function private.set_updated_at();

create trigger contractor_market_records_audit
after insert or update or delete on public.contractor_market_records
for each row execute function private.audit_row_change();

create trigger public_project_evidence_audit
after insert or update or delete on public.public_project_evidence
for each row execute function private.audit_row_change();

alter table public.pricing_sources enable row level security;
alter table public.pricing_item_sources enable row level security;
alter table public.contractor_market_records enable row level security;
alter table public.public_project_evidence enable row level security;

create policy pricing_sources_select_admin
on public.pricing_sources for select
to authenticated
using ((select private.is_admin()));

create policy pricing_item_sources_select_admin
on public.pricing_item_sources for select
to authenticated
using ((select private.is_admin()));

create policy contractor_market_select_admin
on public.contractor_market_records for select
to authenticated
using ((select private.is_admin()));

create policy contractor_market_update_admin
on public.contractor_market_records for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy public_project_evidence_select_admin
on public.public_project_evidence for select
to authenticated
using ((select private.is_admin()));

revoke all on public.pricing_sources from anon;
revoke all on public.pricing_item_sources from anon;
revoke all on public.contractor_market_records from anon;
revoke all on public.public_project_evidence from anon;

grant select on public.pricing_sources to authenticated;
grant select on public.pricing_item_sources to authenticated;
grant select, update on public.contractor_market_records to authenticated;
grant select on public.public_project_evidence to authenticated;

insert into public.pricing_sources (
  source_key,
  name,
  publisher,
  source_type,
  geography,
  source_url,
  published_at,
  verified_at,
  fresh_until,
  confidence,
  evidence_summary,
  limitation_note
)
values
  (
    'cslb-humboldt-c39-20260726',
    'Humboldt County contractor list by classification',
    'California Contractors State License Board',
    'government',
    'Humboldt County, California',
    'https://www.cslb.ca.gov/onlineservices/dataportal/ListByCounty',
    null,
    date '2026-07-26',
    date '2026-08-26',
    'high',
    'Official no-cost county and classification download used to discover C-39 roofing licensees and verify market coverage.',
    'License status can change at any time. Every candidate still requires an Instant License Check before pilot approval.'
  ),
  (
    'lost-coast-roofing-directory-20260726',
    'Humboldt roofing contractor directory',
    'Lost Coast Outpost',
    'market_directory',
    'Humboldt County, California',
    'https://lostcoastoutpost.com/contractors/roofing/',
    null,
    date '2026-07-26',
    date '2026-08-26',
    'medium',
    'Current public directory used to identify roofing businesses by Humboldt community for recruitment research.',
    'Directory placement does not prove an active license, insurance, availability, quality, or pricing.'
  ),
  (
    'lowes-gaf-hdz-20260726',
    'GAF Timberline HDZ retail and bulk bundle price',
    'Lowe''s',
    'retailer',
    'Northern California retail reference',
    'https://www.lowes.com/pd/GAF-Timberline-HDZ-Charcoal-Algae-Resistant-Architectural-Roof-Shingles-33-33-sq-ft-per-Bundle/1001327246',
    null,
    date '2026-07-26',
    date '2026-08-26',
    'medium',
    'Observed price was $48.48 per 33.33-square-foot bundle and $43.63 each at the published bulk tier, or about $145.44 and $130.89 per roofing square before tax, delivery, waste, and accessories.',
    'Online price and availability can differ by store, color, account, delivery location, tax, and purchase date.'
  ),
  (
    'home-depot-underlayment-20260726',
    'Synthetic roofing underlayment retail range',
    'The Home Depot',
    'retailer',
    'California retail reference',
    'https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Underlayments/Synthetic-Underlayment/N-5yc1vZc5rwZ1z19um3',
    null,
    date '2026-07-26',
    date '2026-08-26',
    'medium',
    'Observed 1,000-square-foot synthetic underlayment products ranged from $74.98 to $306.64 per roll, depending on grade and system.',
    'Product grade, freight, tax, required ice-and-water membrane, and local store availability are separate cost drivers.'
  ),
  (
    'hwma-fees-fy2025-26',
    'FY 2025-26 waste management fee table',
    'Humboldt Waste Management Authority',
    'government',
    'Humboldt County, California',
    'https://www.hwma.net/files/9fbe3c874/Final%2BBudget%2BFY25-26.pdf',
    date '2025-05-28',
    date '2026-07-26',
    date '2026-08-31',
    'high',
    'Official published fees include a $208.48-per-ton self-haul rate and $142.60-per-cubic-yard miscellaneous construction-debris rate.',
    'Roofing disposal cost also depends on measured debris weight, truck and trailer capacity, handling time, facility acceptance, and the facility actually used.'
  ),
  (
    'humboldt-reroof-requirements-20260726',
    'Humboldt County re-roof permit and inspection requirements',
    'County of Humboldt Planning and Building',
    'government',
    'Unincorporated Humboldt County, California',
    'https://humboldtgov.org/3386/Inspections',
    null,
    date '2026-07-26',
    date '2026-10-26',
    'high',
    'County guidance identifies re-roof, smoke and CO, and building-final inspections, with sheathing or framing inspections when those elements change.',
    'Cities inside Humboldt County can have different fee schedules and processes; the final permit cost is jurisdiction- and valuation-specific.'
  ),
  (
    'california-edd-roofers-20260726',
    'Roofers occupational wage availability',
    'California Employment Development Department',
    'labor_statistics',
    'California proxy for Humboldt County',
    'https://labormarketinfo.edd.ca.gov/cgi/databrowsing/occExplorerQSDetails.asp?geogArea=0604000023&menuchoice=localAreaPro&soccode=472181',
    null,
    date '2026-07-26',
    date '2026-10-26',
    'low',
    'The official occupation profile reports that a Humboldt County roofer wage estimate is not available, so HUM must use a clearly labeled broader proxy and a separate burden allowance.',
    'A statewide or older BLS wage is not a Humboldt contractor billing rate. Crew burden, workers compensation, payroll taxes, supervision, productivity, and nonproductive time remain assumptions.'
  ),
  (
    'gaf-hdz-installation-system',
    'Timberline HDZ coverage and installation system',
    'GAF',
    'manufacturer',
    'United States',
    'https://www.gaf.com/en-us/document-library/documents/installation-instructions-%26-guides/timberline-layerlock-installation-instructions-trilingual-restl622.pdf',
    null,
    date '2026-07-26',
    date '2027-01-26',
    'high',
    'Manufacturer instructions and product coverage support bundle coverage, compatible system components, and installation assumptions.',
    'Manufacturer instructions establish scope requirements, not Humboldt contractor labor, overhead, or selling prices.'
  ),
  (
    'hum-admin-assumptions-20260726',
    'HUM administrator planning assumptions',
    'HUM',
    'industry_assumption',
    'Humboldt County, California',
    null,
    date '2026-07-26',
    date '2026-07-26',
    date '2026-08-26',
    'low',
    'Explicit placeholders for productivity, delivery, access, complexity, overhead, contingency, margin, and concealed conditions until field evidence is approved.',
    'These values are not contractor facts or market quotes and must be recalibrated through the controlled pilot.'
  )
on conflict (source_key) do nothing;

insert into public.contractor_market_records (
  company_name,
  city,
  service_area,
  public_website,
  public_phone,
  license_number,
  classification_claim,
  license_evidence_status,
  specialties,
  source_url,
  last_verified_at,
  recruitment_status,
  notes
)
values
  ('A & I Roofing Inc', 'Arcata', 'Humboldt County and surrounding areas', 'https://www.aandiroofing.com/', '707-826-2653', null, null, 'business_claim', array['composition', 'wood', 'metal', 'torch-down'], 'https://www.aandiroofing.com/', date '2026-07-26', 'candidate', 'Business website confirms services and public contact information; CSLB status still requires an official current check.'),
  ('Alves Inc', 'Arcata', 'Humboldt County', 'https://www.thinkalvesinc.com/', '707-825-4725', null, null, 'business_claim', array['roofing', 'gutters'], 'https://www.thinkalvesinc.com/', date '2026-07-26', 'candidate', 'Business website says it has served Humboldt County since 1970; CSLB status still requires an official current check.'),
  ('Vista Roofing Corp', 'Arcata', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Haven-Electric Inc', 'Blue Lake', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only; roofing classification must be confirmed.'),
  ('Arts Roofing LLC', 'Eureka', 'Humboldt, Del Norte, and Trinity counties', null, null, null, null, 'directory_listed', array['repair', 'replacement'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Detherage Roofing Inc', 'Eureka', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('DM Roofing', 'Eureka', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('McMurray & Sons Inc', 'Eureka', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Moore''s Roofing and Services', 'Eureka', 'Humboldt County', null, '707-444-3432', null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Perkins Professional Roofing', 'Eureka', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('SkyShield Roofing', 'Eureka', 'Eureka, Arcata, McKinleyville, and surrounding areas', 'https://www.skyshieldcorp.com/', '707-641-7205', '1156528', 'C-39 claimed by business', 'business_claim', array['residential', 'commercial', 'repair', 'replacement', 'inspection', 'maintenance'], 'https://www.skyshieldcorp.com/', date '2026-07-26', 'candidate', 'Business website publishes the license number and C-39 claim; current status still requires CSLB Instant License Check.'),
  ('T and T Roofing', 'Eureka', 'Humboldt County', null, '707-444-9061', null, null, 'directory_listed', array['roofing', 'metal', 'flat'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Sanders Roofing Inc', 'Fields Landing', 'All of Humboldt County', 'https://bsandersroofing.com/', '707-443-0503', '837591', 'Roofing license claimed by business', 'business_claim', array['residential', 'commercial', 'repair', 'replacement'], 'https://bsandersroofing.com/', date '2026-07-26', 'candidate', 'Business website publishes license 837591; current status still requires CSLB Instant License Check.'),
  ('A & B Roofing', 'Fortuna', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Redwood Empire Roofing Inc', 'Fortuna', 'Humboldt County including outlying and Lost Coast areas', 'https://www.redwoodempireroofing.com/', '707-725-7663', '885019', 'Roofing license claimed by business', 'business_claim', array['replacement', 'new-construction', 'repair', 'maintenance', 'gutters', 'metal', 'commercial'], 'https://www.redwoodempireroofing.com/', date '2026-07-26', 'candidate', 'Business website publishes license 885019; current status still requires CSLB Instant License Check.'),
  ('Beck Roofing', 'Hydesville', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Blue Sky Roofer', 'McKinleyville', 'Eureka, Arcata, and McKinleyville', 'https://blueskyroofer.com/', '707-280-8417', null, 'General-B and specialty roofing licenses claimed by business', 'business_claim', array['repair', 'replacement'], 'https://blueskyroofer.com/', date '2026-07-26', 'candidate', 'Business website confirms service area and licensing claims; license numbers and current status still require CSLB check.'),
  ('McKinnon''s Roofing Inc', 'McKinleyville', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.'),
  ('Roof Restoration and Exteriors', 'McKinleyville', 'Humboldt County', null, null, null, null, 'directory_listed', array['roofing', 'exteriors'], 'https://lostcoastoutpost.com/contractors/roofing/', date '2026-07-26', 'research', 'Directory discovery only.')
on conflict (company_name) do nothing;

insert into public.public_project_evidence (
  title,
  evidence_type,
  project_type,
  geography,
  source_url,
  published_at,
  verified_at,
  pricing_usability,
  total_price,
  evidence_summary,
  limitation_note
)
values
  (
    'Fowler owner-occupied torch-down roof replacement',
    'residential_scope',
    'Residential torch-down roof replacement',
    'Eureka, California',
    'https://humboldtgov.org/bids.aspx?bidID=611',
    date '2025-07-08',
    date '2026-07-26',
    'scope_only',
    null,
    'County housing-rehabilitation posting requires removal subject to code, a torch-down replacement, inspection access, and an itemized total for each task.',
    'No usable award amount or bid tabulation was located, so this record informs scope only and contributes no price.'
  ),
  (
    'Humboldt County Courthouse re-roof',
    'public_works_scope',
    'Public-building partial re-roof',
    'Eureka, California',
    'https://humboldtgov.org/bids.aspx?bidID=531',
    date '2024-01-30',
    date '2026-07-26',
    'public_works_separate',
    null,
    'County public-works posting covers labor, materials, supplies, tools, and equipment for a courthouse re-roof.',
    'Public works can include prevailing wage, bonding, administrative, access, and institutional requirements and must remain separate from ordinary residential pricing.'
  ),
  (
    'Humboldt County re-roof inspection path',
    'permit_rule',
    'Residential re-roof permit',
    'Unincorporated Humboldt County, California',
    'https://humboldtgov.org/3386/Inspections',
    null,
    date '2026-07-26',
    'scope_only',
    null,
    'The published process identifies smoke and CO documentation, re-roof inspection, building final, and conditional sheathing or framing inspections.',
    'The rule informs scope and uncertainty; it does not provide one fixed fee for every address or incorporated city.'
  )
on conflict (title) do nothing;

insert into public.pricing_item_sources (
  pricing_item_id,
  pricing_source_id,
  evidence_role,
  evidence_note
)
select
  item.id,
  source.id,
  mapping.evidence_role,
  mapping.evidence_note
from (
  values
    ('shingle_material', 'lowes-gaf-hdz-20260726', 'primary', 'Current bundle coverage and retail/bulk price anchor the architectural-shingle material input.'),
    ('underlayment', 'home-depot-underlayment-20260726', 'primary', 'Current retail range anchors the underlayment material component.'),
    ('accessories', 'gaf-hdz-installation-system', 'supporting', 'Manufacturer system requirements support carrying starter, ridge, and ventilation accessories.'),
    ('waste_factor', 'gaf-hdz-installation-system', 'supporting', 'Coverage rules support quantity calculations; geometry waste remains an explicit assumption.'),
    ('disposal_per_layer', 'hwma-fees-fy2025-26', 'primary', 'Official local disposal rates anchor the fee component before weight, hauling, and handling assumptions.'),
    ('permit_allowance', 'humboldt-reroof-requirements-20260726', 'supporting', 'Official re-roof requirements support carrying a permit and inspection allowance.'),
    ('labor_hour_rate', 'california-edd-roofers-20260726', 'supporting', 'Official data confirms no local occupation estimate is available; a broader wage proxy remains low-confidence.'),
    ('fasteners_misc', 'hum-admin-assumptions-20260726', 'assumption', 'Planning allowance pending supplier invoice calibration.'),
    ('labor_hours_install', 'hum-admin-assumptions-20260726', 'assumption', 'Productivity range pending pilot field measurements.'),
    ('tearoff_per_layer', 'hum-admin-assumptions-20260726', 'assumption', 'Removal productivity range pending pilot field measurements.'),
    ('delivery_allowance', 'hum-admin-assumptions-20260726', 'assumption', 'Delivery allowance pending supplier and contractor evidence.'),
    ('decking_sheet', 'hum-admin-assumptions-20260726', 'assumption', 'Installed concealed-decking unit price pending field evidence.'),
    ('flashing_allowance', 'hum-admin-assumptions-20260726', 'assumption', 'Project allowance pending inspection-based scope calibration.'),
    ('pitch_adjustment', 'hum-admin-assumptions-20260726', 'assumption', 'Labor-risk factor pending field calibration.'),
    ('story_adjustment', 'hum-admin-assumptions-20260726', 'assumption', 'Access factor pending field calibration.'),
    ('access_adjustment', 'hum-admin-assumptions-20260726', 'assumption', 'Staging factor pending field calibration.'),
    ('complexity_adjustment', 'hum-admin-assumptions-20260726', 'assumption', 'Geometry factor pending field calibration.'),
    ('overhead_rate', 'hum-admin-assumptions-20260726', 'assumption', 'Business-model range, not a contractor fact.'),
    ('contingency_rate', 'hum-admin-assumptions-20260726', 'assumption', 'Planning-risk range, not a contractor fact.'),
    ('target_margin', 'hum-admin-assumptions-20260726', 'assumption', 'Business-model range, not a contractor fact.'),
    ('geographic_adjustment', 'hum-admin-assumptions-20260726', 'assumption', 'Local logistics factor pending pilot calibration.')
) as mapping(pricing_code, source_key, evidence_role, evidence_note)
join public.pricing_items item
  on item.code = mapping.pricing_code
join public.pricing_versions version
  on version.id = item.pricing_version_id
 and version.version_code = 'HUM-HC-ROOF-2026.07-BASELINE'
join public.pricing_sources source
  on source.source_key = mapping.source_key
on conflict (pricing_item_id, pricing_source_id) do nothing;

create function private.prevent_approved_pricing_source_link_changes()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  version_status public.pricing_status;
  target_item_id uuid := coalesce(new.pricing_item_id, old.pricing_item_id);
begin
  select pricing_versions.status
  into version_status
  from public.pricing_items
  join public.pricing_versions
    on pricing_versions.id = pricing_items.pricing_version_id
  where pricing_items.id = target_item_id;

  if version_status = 'approved' then
    raise exception 'Approved pricing provenance is immutable; create a proposed pricing version instead.';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.prevent_approved_pricing_source_link_changes()
  from public, anon, authenticated;

create trigger pricing_item_sources_lock_approved
before insert or update or delete on public.pricing_item_sources
for each row execute function private.prevent_approved_pricing_source_link_changes();

-- Cover every operational foreign key used by authorization, review, and
-- audit workflows. This keeps policy checks predictable as the Round 4 pilot
-- adds real projects.

create index if not exists ai_requests_project_id_idx
  on public.ai_requests(project_id)
  where project_id is not null;

create index if not exists contractor_reviews_contractor_id_idx
  on public.contractor_reviews(contractor_id);

create index if not exists contractor_reviews_estimate_id_idx
  on public.contractor_reviews(estimate_id)
  where estimate_id is not null;

create index if not exists estimates_created_by_idx
  on public.estimates(created_by);

create index if not exists pricing_items_created_by_idx
  on public.pricing_items(created_by)
  where created_by is not null;

create index if not exists pricing_observations_project_id_idx
  on public.pricing_observations(project_id);

create index if not exists pricing_observations_estimate_id_idx
  on public.pricing_observations(estimate_id)
  where estimate_id is not null;

create index if not exists pricing_observations_observed_by_idx
  on public.pricing_observations(observed_by);

create index if not exists pricing_observations_reviewed_by_idx
  on public.pricing_observations(reviewed_by)
  where reviewed_by is not null;

create index if not exists pricing_versions_created_by_idx
  on public.pricing_versions(created_by)
  where created_by is not null;

create index if not exists pricing_versions_approved_by_idx
  on public.pricing_versions(approved_by)
  where approved_by is not null;

create index if not exists project_photos_owner_id_idx
  on public.project_photos(owner_id);

create index if not exists project_shares_shared_by_idx
  on public.project_shares(shared_by);

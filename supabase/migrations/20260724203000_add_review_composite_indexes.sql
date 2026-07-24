-- Cover the composite estimate/project relationships used to prevent
-- cross-project review and observation reassignment.

create index contractor_reviews_estimate_project_idx
  on public.contractor_reviews (estimate_id, project_id)
  where estimate_id is not null;

create index pricing_observations_estimate_project_idx
  on public.pricing_observations (estimate_id, project_id)
  where estimate_id is not null;

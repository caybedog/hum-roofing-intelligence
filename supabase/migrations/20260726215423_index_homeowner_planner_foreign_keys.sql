-- Cover planner foreign keys used by deletes, joins, and calibration review.

create index planner_estimates_catalog_idx
  on public.planner_estimates(pricing_catalog_id);

create index planner_calibration_project_idx
  on public.planner_calibration_submissions(project_id);

create index planner_calibration_estimate_idx
  on public.planner_calibration_submissions(estimate_id);

create index planner_calibration_upload_idx
  on public.planner_calibration_submissions(upload_id)
  where upload_id is not null;

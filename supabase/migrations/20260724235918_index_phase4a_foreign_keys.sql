create index pilot_settings_updated_by_idx
  on public.pilot_settings(updated_by)
  where updated_by is not null;

create index qa_runs_created_by_idx
  on public.qa_runs(created_by);

create index qa_runs_reset_by_idx
  on public.qa_runs(reset_by)
  where reset_by is not null;

alter table public.contractor_quotes
  add column if not exists site_observations jsonb not null default '{}'::jsonb,
  add column if not exists builder_inputs jsonb not null default '{}'::jsonb;

alter table public.contractor_quotes
  add constraint contractor_quotes_site_observations_object
  check (jsonb_typeof(site_observations) = 'object'),
  add constraint contractor_quotes_builder_inputs_object
  check (jsonb_typeof(builder_inputs) = 'object');

grant update (
  site_observations,
  builder_inputs
) on public.contractor_quotes to authenticated;

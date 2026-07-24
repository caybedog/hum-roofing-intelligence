-- Keep one-time invitation digests out of ordinary Data API reads and cover
-- every foreign-key path used by the controlled-pilot policies.

revoke select on public.pilot_invitations from authenticated;
grant select (
  id,
  project_id,
  created_by,
  expires_at,
  accepted_by,
  accepted_at,
  revoked_at,
  created_at
) on public.pilot_invitations to authenticated;

create index pilot_enrollments_homeowner_idx
  on public.pilot_enrollments(homeowner_id);
create index pilot_contractor_profiles_approved_by_idx
  on public.pilot_contractor_profiles(approved_by)
  where approved_by is not null;
create index pilot_invitations_created_by_idx
  on public.pilot_invitations(created_by);
create index pilot_invitations_accepted_by_idx
  on public.pilot_invitations(accepted_by)
  where accepted_by is not null;
create index contractor_quotes_estimate_project_idx
  on public.contractor_quotes(estimate_id, project_id);
create index quote_difference_reasons_contractor_idx
  on public.quote_difference_reasons(contractor_id);
create index quote_difference_reasons_quote_project_contractor_idx
  on public.quote_difference_reasons(quote_id, project_id, contractor_id);
create index pilot_outcomes_recorded_by_idx
  on public.pilot_outcomes(recorded_by);
create index pilot_outcomes_quote_project_idx
  on public.pilot_outcomes(accepted_quote_id, project_id)
  where accepted_quote_id is not null;
create index pilot_support_issues_project_idx
  on public.pilot_support_issues(project_id)
  where project_id is not null;
create index pilot_support_issues_resolved_by_idx
  on public.pilot_support_issues(resolved_by)
  where resolved_by is not null;

-- The privileged implementation lives in a non-exposed schema. Public RPC
-- wrappers remain SECURITY INVOKER and expose only the narrow, validated API.

alter function public.create_pilot_invitation(uuid, integer)
set schema private;

revoke all on function private.create_pilot_invitation(uuid, integer)
from public, anon;
grant execute on function private.create_pilot_invitation(uuid, integer)
to authenticated;

create function public.create_pilot_invitation(
  p_project_id uuid,
  p_expires_days integer default 14
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select *
  from private.create_pilot_invitation(p_project_id, p_expires_days);
$$;

revoke all on function public.create_pilot_invitation(uuid, integer)
from public, anon;
grant execute on function public.create_pilot_invitation(uuid, integer)
to authenticated;

alter function public.accept_pilot_invitation(text)
set schema private;

revoke all on function private.accept_pilot_invitation(text)
from public, anon;
grant execute on function private.accept_pilot_invitation(text)
to authenticated;

create function public.accept_pilot_invitation(p_invitation_token text)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.accept_pilot_invitation(p_invitation_token);
$$;

revoke all on function public.accept_pilot_invitation(text)
from public, anon;
grant execute on function public.accept_pilot_invitation(text)
to authenticated;

alter function public.set_pilot_contractor_status(
  uuid,
  text,
  text,
  text,
  text,
  text
) set schema private;

revoke all on function private.set_pilot_contractor_status(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon;
grant execute on function private.set_pilot_contractor_status(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

create function public.set_pilot_contractor_status(
  p_contractor_id uuid,
  p_company_name text,
  p_license_number text,
  p_service_area text,
  p_status text,
  p_onboarding_notes text default ''
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.set_pilot_contractor_status(
    p_contractor_id,
    p_company_name,
    p_license_number,
    p_service_area,
    p_status,
    p_onboarding_notes
  );
$$;

revoke all on function public.set_pilot_contractor_status(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon;
grant execute on function public.set_pilot_contractor_status(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

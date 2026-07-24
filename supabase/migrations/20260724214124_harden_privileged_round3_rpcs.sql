-- Keep the pre-existing Round 3 privileged implementations out of the exposed
-- public schema. Public wrappers use the caller's identity and expose only the
-- already-validated RPC contract.

alter function public.share_project_with_contractor_email(uuid, text)
set schema private;

revoke all on function private.share_project_with_contractor_email(uuid, text)
from public, anon;
grant execute on function private.share_project_with_contractor_email(uuid, text)
to authenticated;

create function public.share_project_with_contractor_email(
  p_project_id uuid,
  p_contractor_email text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.share_project_with_contractor_email(
    p_project_id,
    p_contractor_email
  );
$$;

revoke all on function public.share_project_with_contractor_email(uuid, text)
from public, anon;
grant execute on function public.share_project_with_contractor_email(uuid, text)
to authenticated;

alter function public.complete_ai_request(
  uuid,
  text,
  integer,
  text,
  text
) set schema private;

revoke all on function private.complete_ai_request(
  uuid,
  text,
  integer,
  text,
  text
) from public, anon;
grant execute on function private.complete_ai_request(
  uuid,
  text,
  integer,
  text,
  text
) to authenticated;

create function public.complete_ai_request(
  p_request_id uuid,
  p_status text,
  p_latency_ms integer,
  p_provider_request_id text default null,
  p_error_code text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.complete_ai_request(
    p_request_id,
    p_status,
    p_latency_ms,
    p_provider_request_id,
    p_error_code
  );
$$;

revoke all on function public.complete_ai_request(
  uuid,
  text,
  integer,
  text,
  text
) from public, anon;
grant execute on function public.complete_ai_request(
  uuid,
  text,
  integer,
  text,
  text
) to authenticated;

alter function public.approve_pricing_version(uuid)
set schema private;

revoke all on function private.approve_pricing_version(uuid)
from public, anon;
grant execute on function private.approve_pricing_version(uuid)
to authenticated;

create function public.approve_pricing_version(p_version_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.approve_pricing_version(p_version_id);
$$;

revoke all on function public.approve_pricing_version(uuid)
from public, anon;
grant execute on function public.approve_pricing_version(uuid)
to authenticated;

alter function public.admin_set_user_role(uuid, public.hum_role)
set schema private;

revoke all on function private.admin_set_user_role(uuid, public.hum_role)
from public, anon;
grant execute on function private.admin_set_user_role(uuid, public.hum_role)
to authenticated;

create function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.hum_role
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.admin_set_user_role(p_user_id, p_role);
$$;

revoke all on function public.admin_set_user_role(uuid, public.hum_role)
from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.hum_role)
to authenticated;

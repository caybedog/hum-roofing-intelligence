-- Keep AI rate-limit records append-only from the browser. The authenticated
-- server route can finish only its caller's pending request through the
-- bounded RPC below; created_at, user_id, and project_id remain immutable.

drop policy if exists ai_requests_update_own on public.ai_requests;
revoke update on public.ai_requests from authenticated;

alter table public.ai_requests
  add constraint ai_requests_provider_request_id_length
  check (
    provider_request_id is null
    or char_length(provider_request_id) <= 200
  ),
  add constraint ai_requests_error_code_length
  check (
    error_code is null
    or char_length(error_code) <= 80
  );

create function public.complete_ai_request(
  p_request_id uuid,
  p_status text,
  p_latency_ms integer,
  p_provider_request_id text default null,
  p_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('completed', 'fallback', 'error') then
    raise exception 'Invalid terminal AI request status';
  end if;

  if p_latency_ms is null or p_latency_ms < 0 then
    raise exception 'Invalid AI request latency';
  end if;

  update public.ai_requests
  set
    status = p_status,
    latency_ms = p_latency_ms,
    provider_request_id = nullif(left(coalesce(p_provider_request_id, ''), 200), ''),
    error_code = nullif(left(coalesce(p_error_code, ''), 80), ''),
    completed_at = now()
  where id = p_request_id
    and user_id = current_user_id
    and status = 'pending';

  if not found then
    raise exception 'Pending AI request not found';
  end if;

  return p_request_id;
end;
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

-- Keep records that reference an estimate attached to the same project.
-- This prevents a contractor from linking a review or observation to an
-- estimate belonging to a different homeowner.

alter table public.estimates
  add constraint estimates_id_project_id_unique unique (id, project_id);

alter table public.contractor_reviews
  add constraint contractor_reviews_estimate_project_fk
  foreign key (estimate_id, project_id)
  references public.estimates(id, project_id)
  on delete restrict;

alter table public.pricing_observations
  add constraint pricing_observations_estimate_project_fk
  foreign key (estimate_id, project_id)
  references public.estimates(id, project_id)
  on delete restrict;

alter table public.project_photos
  add constraint project_photos_storage_path_scope
  check (
    storage_path like owner_id::text || '/' || project_id::text || '/%'
  );

drop policy if exists contractor_reviews_select_authorized
  on public.contractor_reviews;
create policy contractor_reviews_select_authorized
on public.contractor_reviews for select
to authenticated
using (
  (select private.can_access_project(project_id))
);

drop policy if exists contractor_reviews_insert_shared_contractor
  on public.contractor_reviews;
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
  and (
    estimate_id is null
    or exists (
      select 1
      from public.estimates
      where estimates.id = contractor_reviews.estimate_id
        and estimates.project_id = contractor_reviews.project_id
    )
  )
);

drop policy if exists contractor_reviews_update_author
  on public.contractor_reviews;
create policy contractor_reviews_update_author
on public.contractor_reviews for update
to authenticated
using (
  contractor_id = (select auth.uid())
  and exists (
    select 1
    from public.project_shares
    where project_shares.project_id = contractor_reviews.project_id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
)
with check (
  contractor_id = (select auth.uid())
  and exists (
    select 1
    from public.project_shares
    where project_shares.project_id = contractor_reviews.project_id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
  and (
    estimate_id is null
    or exists (
      select 1
      from public.estimates
      where estimates.id = contractor_reviews.estimate_id
        and estimates.project_id = contractor_reviews.project_id
    )
  )
);

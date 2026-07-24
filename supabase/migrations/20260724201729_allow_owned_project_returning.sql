-- Use the row being returned for the homeowner ownership check. Calling the
-- cross-table access helper from an INSERT ... RETURNING policy can evaluate
-- before the newly inserted row is visible to that helper.

drop policy if exists projects_select_authorized on public.projects;
create policy projects_select_authorized
on public.projects for select
to authenticated
using (
  homeowner_id = (select auth.uid())
  or exists (
    select 1
    from public.project_shares
    where project_shares.project_id = projects.id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
  or (select private.is_admin())
);

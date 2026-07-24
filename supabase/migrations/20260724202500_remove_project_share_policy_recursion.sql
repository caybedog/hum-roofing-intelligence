-- Keep project-sharing authorization self-contained. Calling the general
-- project-access helper from a project_shares policy can recurse because the
-- helper itself reads project_shares.

drop policy if exists project_shares_select_participants
on public.project_shares;

create policy project_shares_select_participants
on public.project_shares for select
to authenticated
using (
  (
    contractor_id = (select auth.uid())
    and revoked_at is null
  )
  or shared_by = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists project_shares_insert_owner
on public.project_shares;

-- Shares are created only by share_project_with_contractor_email(), which
-- performs the owner and contractor-role checks under a security-definer
-- boundary. Removing direct inserts also narrows the client grant.
revoke insert on public.project_shares from authenticated;

drop policy if exists project_shares_update_owner_or_admin
on public.project_shares;

create policy project_shares_update_owner_or_admin
on public.project_shares for update
to authenticated
using (
  shared_by = (select auth.uid())
  or (select private.is_admin())
)
with check (
  shared_by = (select auth.uid())
  or (select private.is_admin())
);

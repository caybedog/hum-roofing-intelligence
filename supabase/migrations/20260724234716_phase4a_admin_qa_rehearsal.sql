-- Phase 4A: administrator QA controls and a safely isolated rehearsal lane.
-- Test accounts and projects are permanently marked so they can never count
-- toward the ten real-project Phase 4 exit gate.

alter table public.profiles
  add column is_test_account boolean not null default false;

alter table public.projects
  add column is_test boolean not null default false;

create table public.pilot_settings (
  id smallint primary key default 1 check (id = 1),
  enrollments_paused boolean not null default false,
  invitation_expiry_days smallint not null default 14
    check (invitation_expiry_days between 1 and 30),
  variance_review_threshold_pct numeric(5,2) not null default 15
    check (variance_review_threshold_pct between 0 and 100),
  support_email text not null default 'caybedog707@gmail.com'
    check (char_length(support_email) between 3 and 320),
  admin_notes text not null default ''
    check (char_length(admin_notes) <= 4000),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.pilot_settings (id) values (1);

create table public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  label text not null check (char_length(label) between 3 and 120),
  homeowner_user_id uuid not null,
  homeowner_email text not null,
  contractor_user_id uuid not null,
  contractor_email text not null,
  status text not null default 'active'
    check (status in ('active', 'reset', 'failed')),
  reset_by uuid references public.profiles(id) on delete set null,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and reset_at is null)
    or (status in ('reset', 'failed'))
  )
);

create index profiles_test_account_idx
  on public.profiles(is_test_account)
  where is_test_account = true;

create index projects_test_homeowner_idx
  on public.projects(is_test, homeowner_id);

create index qa_runs_status_created_idx
  on public.qa_runs(status, created_at desc);

create trigger pilot_settings_set_updated_at
before update on public.pilot_settings
for each row execute function private.set_updated_at();

create trigger qa_runs_set_updated_at
before update on public.qa_runs
for each row execute function private.set_updated_at();

create function private.prevent_test_administrator()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.is_test_account and new.role = 'administrator' then
    raise exception 'QA identities cannot become administrators';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_test_administrator()
from public, anon, authenticated;

create trigger profiles_prevent_test_administrator
before insert or update of role, is_test_account on public.profiles
for each row execute function private.prevent_test_administrator();

create function private.force_project_test_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  select profiles.is_test_account
  into new.is_test
  from public.profiles
  where profiles.id = new.homeowner_id;

  if new.is_test is null then
    raise exception 'A valid homeowner profile is required';
  end if;

  return new;
end;
$$;

revoke all on function private.force_project_test_classification()
from public, anon, authenticated;

create trigger projects_force_test_classification
before insert or update of homeowner_id, is_test on public.projects
for each row execute function private.force_project_test_classification();

create function private.enforce_pilot_enrollment_pause()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  paused boolean;
  test_project boolean;
begin
  select enrollments_paused
  into paused
  from public.pilot_settings
  where id = 1;

  select is_test
  into test_project
  from public.projects
  where id = new.project_id;

  if coalesce(paused, false)
    and not coalesce(test_project, false)
    and not coalesce((select private.is_admin()), false)
  then
    raise exception 'New real-project pilot enrollments are temporarily paused';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_pilot_enrollment_pause()
from public, anon, authenticated;

create trigger pilot_enrollments_respect_pause
before insert on public.pilot_enrollments
for each row execute function private.enforce_pilot_enrollment_pause();

create function private.audit_pilot_settings_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'update',
    'pilot_settings',
    null,
    jsonb_build_object(
      'operation', 'update',
      'recorded_at', now(),
      'changed_fields', jsonb_build_array(
        'enrollments_paused',
        'invitation_expiry_days',
        'variance_review_threshold_pct',
        'support_email',
        'admin_notes'
      )
    )
  );
  return new;
end;
$$;

revoke all on function private.audit_pilot_settings_change()
from public, anon, authenticated;

create trigger pilot_settings_audit
after update on public.pilot_settings
for each row execute function private.audit_pilot_settings_change();

create trigger qa_runs_audit
after insert or update on public.qa_runs
for each row execute function private.audit_row_change();

alter table public.pilot_settings enable row level security;
alter table public.qa_runs enable row level security;

create policy pilot_settings_select_authenticated
on public.pilot_settings for select
to authenticated
using (true);

create policy pilot_settings_update_admin
on public.pilot_settings for update
to authenticated
using ((select private.is_admin()))
with check (
  (select private.is_admin())
  and id = 1
  and updated_by = (select auth.uid())
);

create policy qa_runs_select_admin
on public.qa_runs for select
to authenticated
using ((select private.is_admin()));

create policy qa_runs_insert_admin
on public.qa_runs for insert
to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
);

create policy qa_runs_update_admin
on public.qa_runs for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.pilot_settings from anon;
revoke all on public.qa_runs from anon;
grant select, update on public.pilot_settings to authenticated;
grant select on public.qa_runs to authenticated;

comment on column public.profiles.is_test_account is
  'Server-controlled marker for non-pilot QA identities.';
comment on column public.projects.is_test is
  'Server-derived marker. Test projects never count toward Phase 4 evidence.';
comment on table public.qa_runs is
  'Administrative lifecycle record for disposable Phase 4A rehearsal identities.';

create function public.reset_qa_run_data(
  p_run_id uuid,
  p_admin_id uuid
)
returns table (
  homeowner_user_id uuid,
  contractor_user_id uuid,
  removed_project_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_run public.qa_runs%rowtype;
  project_ids uuid[];
  project_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_admin_id
      and role = 'administrator'
      and deactivated_at is null
      and is_test_account = false
  ) then
    raise exception 'Active administrator access required';
  end if;

  select *
  into target_run
  from public.qa_runs
  where id = p_run_id
  for update;

  if target_run.id is null then
    raise exception 'QA rehearsal not found';
  end if;

  if target_run.status <> 'active' then
    raise exception 'QA rehearsal has already been reset';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into project_ids
  from public.projects
  where homeowner_id = target_run.homeowner_user_id
    and is_test = true;

  project_count := coalesce(cardinality(project_ids), 0);

  delete from public.pilot_events
  where project_id = any(project_ids)
    or actor_id in (
      target_run.homeowner_user_id,
      target_run.contractor_user_id
    );

  delete from public.pilot_support_issues
  where project_id = any(project_ids)
    or reported_by in (
      target_run.homeowner_user_id,
      target_run.contractor_user_id
    );

  delete from public.pilot_feedback
  where project_id = any(project_ids)
    or submitted_by in (
      target_run.homeowner_user_id,
      target_run.contractor_user_id
    );

  delete from public.pilot_outcomes
  where project_id = any(project_ids)
    or recorded_by in (
      target_run.homeowner_user_id,
      target_run.contractor_user_id
    );

  delete from public.quote_difference_reasons
  where project_id = any(project_ids)
    or contractor_id = target_run.contractor_user_id;

  delete from public.contractor_quotes
  where project_id = any(project_ids)
    or contractor_id = target_run.contractor_user_id;

  delete from public.pilot_invitations
  where project_id = any(project_ids)
    or created_by = target_run.homeowner_user_id
    or accepted_by = target_run.contractor_user_id;

  delete from public.pilot_enrollments
  where project_id = any(project_ids)
    or homeowner_id = target_run.homeowner_user_id;

  delete from public.contractor_reviews
  where project_id = any(project_ids)
    or contractor_id = target_run.contractor_user_id;

  delete from public.pricing_observations
  where project_id = any(project_ids)
    or observed_by = target_run.contractor_user_id;

  delete from public.project_shares
  where project_id = any(project_ids)
    or contractor_id = target_run.contractor_user_id
    or shared_by = target_run.homeowner_user_id;

  delete from public.project_photos
  where project_id = any(project_ids)
    or owner_id = target_run.homeowner_user_id;

  delete from public.ai_requests
  where project_id = any(project_ids)
    or user_id = target_run.homeowner_user_id;

  delete from public.estimates
  where project_id = any(project_ids)
    or created_by = target_run.homeowner_user_id;

  delete from public.projects
  where id = any(project_ids);

  delete from public.pilot_contractor_profiles
  where contractor_id = target_run.contractor_user_id;

  delete from public.profiles
  where id in (
    target_run.homeowner_user_id,
    target_run.contractor_user_id
  )
    and is_test_account = true;

  update public.qa_runs
  set
    status = 'reset',
    reset_by = p_admin_id,
    reset_at = now()
  where id = target_run.id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_admin_id,
    'reset',
    'qa_run',
    target_run.id,
    jsonb_build_object(
      'removed_project_count', project_count,
      'test_data_only', true,
      'recorded_at', now()
    )
  );

  return query
  select
    target_run.homeowner_user_id,
    target_run.contractor_user_id,
    project_count;
end;
$$;

revoke all on function public.reset_qa_run_data(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.reset_qa_run_data(uuid, uuid)
to service_role;

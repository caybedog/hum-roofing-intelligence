-- Round 4: controlled Humboldt roofing pilot and real-world validation.
-- This layer records evidence; it does not create a public job feed, bidding
-- marketplace, payment flow, or automatic pricing updates.

create table public.pilot_enrollments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  homeowner_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'preparing'
    check (
      status in (
        'preparing',
        'contractor_review',
        'quote_received',
        'comparison_ready',
        'closed',
        'withdrawn'
      )
    ),
  homeowner_consent boolean not null default false,
  consented_at timestamptz,
  intake_started_at timestamptz,
  intake_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (homeowner_consent = false and consented_at is null)
    or (homeowner_consent = true and consented_at is not null)
  )
);

create table public.pilot_contractor_profiles (
  contractor_id uuid primary key references public.profiles(id) on delete restrict,
  company_name text not null check (char_length(company_name) between 1 and 160),
  license_number text check (
    license_number is null or char_length(license_number) between 3 and 80
  ),
  service_area text not null default 'Humboldt County'
    check (char_length(service_area) between 2 and 240),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paused')),
  onboarding_notes text not null default ''
    check (char_length(onboarding_notes) <= 4000),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null)
);

create table public.pilot_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  token_digest bytea not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

create table public.contractor_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  estimate_id uuid not null,
  contractor_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'withdrawn')),
  material_amount numeric(12,2) not null default 0 check (material_amount >= 0),
  labor_amount numeric(12,2) not null default 0 check (labor_amount >= 0),
  tearoff_disposal_amount numeric(12,2) not null default 0
    check (tearoff_disposal_amount >= 0),
  permit_delivery_amount numeric(12,2) not null default 0
    check (permit_delivery_amount >= 0),
  allowance_amount numeric(12,2) not null default 0 check (allowance_amount >= 0),
  other_amount numeric(12,2) not null default 0 check (other_amount >= 0),
  total_amount numeric(12,2) generated always as (
    material_amount
    + labor_amount
    + tearoff_disposal_amount
    + permit_delivery_amount
    + allowance_amount
    + other_amount
  ) stored,
  scope_summary text not null check (char_length(scope_summary) between 10 and 8000),
  exclusions text not null default '' check (char_length(exclusions) <= 5000),
  quote_reference text check (
    quote_reference is null or char_length(quote_reference) <= 160
  ),
  valid_until date,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, contractor_id),
  unique (id, project_id),
  unique (id, project_id, contractor_id),
  foreign key (estimate_id, project_id)
    references public.estimates(id, project_id)
    on delete restrict
);

create table public.quote_difference_reasons (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  contractor_id uuid not null references public.profiles(id) on delete restrict,
  reason_code text not null
    check (
      reason_code in (
        'material_price',
        'labor_rate',
        'scope_added',
        'scope_removed',
        'measurement',
        'access',
        'permit',
        'disposal',
        'warranty',
        'market_conditions',
        'allowance',
        'other'
      )
    ),
  direction text not null check (direction in ('higher', 'lower', 'neutral')),
  amount_effect numeric(12,2) check (amount_effect is null or amount_effect >= 0),
  explanation text not null check (char_length(explanation) between 5 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (quote_id, project_id, contractor_id)
    references public.contractor_quotes(id, project_id, contractor_id)
    on delete cascade
);

create table public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  audience text not null check (audience in ('homeowner', 'contractor')),
  understanding_rating smallint check (understanding_rating between 1 and 5),
  usefulness_rating smallint check (usefulness_rating between 1 and 5),
  completion_ease_rating smallint check (completion_ease_rating between 1 and 5),
  feedback_text text not null default '' check (char_length(feedback_text) <= 6000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, submitted_by, audience)
);

create table public.pilot_outcomes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  accepted_quote_id uuid,
  final_contract_amount numeric(12,2)
    check (final_contract_amount is null or final_contract_amount >= 0),
  change_order_total numeric(12,2) not null default 0
    check (change_order_total >= 0),
  outcome_status text not null default 'undecided'
    check (
      outcome_status in (
        'undecided',
        'contractor_selected',
        'contract_signed_elsewhere',
        'project_paused',
        'project_cancelled'
      )
    ),
  notes text not null default '' check (char_length(notes) <= 5000),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (accepted_quote_id, project_id)
    references public.contractor_quotes(id, project_id)
    on delete restrict
);

create table public.pilot_support_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete restrict,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  category text not null
    check (
      category in (
        'privacy',
        'authorization',
        'estimate',
        'photos',
        'quote',
        'intake',
        'usability',
        'other'
      )
    ),
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'closed')),
  description text not null check (char_length(description) between 10 and 5000),
  resolution text not null default '' check (char_length(resolution) <= 5000),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pilot_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_name text not null
    check (
      event_name in (
        'pilot_enrolled',
        'intake_completed',
        'estimate_generated',
        'brief_printed',
        'invitation_created',
        'invitation_accepted',
        'contractor_review_submitted',
        'quote_submitted',
        'comparison_viewed',
        'feedback_submitted',
        'outcome_recorded'
      )
    ),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index pilot_enrollments_status_idx
  on public.pilot_enrollments(status, created_at);
create index pilot_invitations_project_idx
  on public.pilot_invitations(project_id, created_at desc);
create index pilot_invitations_active_idx
  on public.pilot_invitations(expires_at)
  where accepted_at is null and revoked_at is null;
create index contractor_quotes_project_idx
  on public.contractor_quotes(project_id, submitted_at desc);
create index contractor_quotes_estimate_idx
  on public.contractor_quotes(estimate_id);
create index contractor_quotes_contractor_idx
  on public.contractor_quotes(contractor_id, updated_at desc);
create index quote_difference_reasons_quote_idx
  on public.quote_difference_reasons(quote_id);
create index quote_difference_reasons_project_idx
  on public.quote_difference_reasons(project_id);
create index pilot_feedback_project_idx
  on public.pilot_feedback(project_id, created_at desc);
create index pilot_feedback_submitter_idx
  on public.pilot_feedback(submitted_by);
create index pilot_outcomes_quote_idx
  on public.pilot_outcomes(accepted_quote_id)
  where accepted_quote_id is not null;
create index pilot_support_queue_idx
  on public.pilot_support_issues(status, severity, created_at);
create index pilot_support_reporter_idx
  on public.pilot_support_issues(reported_by);
create index pilot_events_project_idx
  on public.pilot_events(project_id, created_at);
create index pilot_events_actor_idx
  on public.pilot_events(actor_id, created_at);
create index pilot_events_name_idx
  on public.pilot_events(event_name, created_at);

create trigger pilot_enrollments_set_updated_at
before update on public.pilot_enrollments
for each row execute function private.set_updated_at();

create trigger pilot_contractor_profiles_set_updated_at
before update on public.pilot_contractor_profiles
for each row execute function private.set_updated_at();

create trigger contractor_quotes_set_updated_at
before update on public.contractor_quotes
for each row execute function private.set_updated_at();

create trigger quote_difference_reasons_set_updated_at
before update on public.quote_difference_reasons
for each row execute function private.set_updated_at();

create trigger pilot_feedback_set_updated_at
before update on public.pilot_feedback
for each row execute function private.set_updated_at();

create trigger pilot_outcomes_set_updated_at
before update on public.pilot_outcomes
for each row execute function private.set_updated_at();

create trigger pilot_support_issues_set_updated_at
before update on public.pilot_support_issues
for each row execute function private.set_updated_at();

create function private.sync_pilot_status_after_quote()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'submitted' then
    update public.pilot_enrollments
    set status = case
      when status in ('closed', 'withdrawn') then status
      else 'quote_received'
    end
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_pilot_status_after_quote()
from public, anon, authenticated;

create trigger contractor_quotes_sync_pilot_status
after insert or update of status on public.contractor_quotes
for each row execute function private.sync_pilot_status_after_quote();

create trigger pilot_enrollments_audit
after insert or update on public.pilot_enrollments
for each row execute function private.audit_row_change();

create trigger pilot_contractor_profiles_audit
after insert or update on public.pilot_contractor_profiles
for each row execute function private.audit_row_change();

create trigger contractor_quotes_audit
after insert or update on public.contractor_quotes
for each row execute function private.audit_row_change();

create trigger quote_difference_reasons_audit
after insert or update or delete on public.quote_difference_reasons
for each row execute function private.audit_row_change();

create trigger pilot_feedback_audit
after insert or update on public.pilot_feedback
for each row execute function private.audit_row_change();

create trigger pilot_outcomes_audit
after insert or update on public.pilot_outcomes
for each row execute function private.audit_row_change();

create trigger pilot_support_issues_audit
after insert or update on public.pilot_support_issues
for each row execute function private.audit_row_change();

create function public.create_pilot_invitation(
  p_project_id uuid,
  p_expires_days integer default 14
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_id uuid;
  raw_token text;
  expiry timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_expires_days < 1 or p_expires_days > 30 then
    raise exception 'Invitation expiration must be between 1 and 30 days';
  end if;

  if not exists (
    select 1
    from public.projects
    join public.pilot_enrollments
      on pilot_enrollments.project_id = projects.id
    where projects.id = p_project_id
      and projects.homeowner_id = current_user_id
      and projects.archived_at is null
      and pilot_enrollments.homeowner_consent = true
      and pilot_enrollments.status <> 'withdrawn'
  ) then
    raise exception 'An active, consented pilot project is required';
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');
  expiry := now() + make_interval(days => p_expires_days);

  insert into public.pilot_invitations (
    project_id,
    created_by,
    token_digest,
    expires_at
  )
  values (
    p_project_id,
    current_user_id,
    digest(convert_to(raw_token, 'UTF8'), 'sha256'),
    expiry
  )
  returning id into created_id;

  insert into public.pilot_events (
    project_id,
    actor_id,
    event_name
  )
  values (
    p_project_id,
    current_user_id,
    'invitation_created'
  );

  return query select created_id, raw_token, expiry;
end;
$$;

revoke all on function public.create_pilot_invitation(uuid, integer)
from public, anon;
grant execute on function public.create_pilot_invitation(uuid, integer)
to authenticated;

create function public.accept_pilot_invitation(p_invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  matched_invitation public.pilot_invitations%rowtype;
  share_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(p_invitation_token)) <> 48 then
    raise exception 'Invitation is invalid or expired';
  end if;

  if not exists (
    select 1
    from public.profiles
    join public.pilot_contractor_profiles
      on pilot_contractor_profiles.contractor_id = profiles.id
    where profiles.id = current_user_id
      and profiles.role = 'contractor'
      and profiles.deactivated_at is null
      and pilot_contractor_profiles.status = 'approved'
  ) then
    raise exception 'Manual pilot contractor approval is required';
  end if;

  select *
  into matched_invitation
  from public.pilot_invitations
  where token_digest = digest(
    convert_to(lower(trim(p_invitation_token)), 'UTF8'),
    'sha256'
  )
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update
  limit 1;

  if matched_invitation.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;

  select id
  into share_id
  from public.project_shares
  where project_id = matched_invitation.project_id
    and contractor_id = current_user_id
    and revoked_at is null
  limit 1;

  if share_id is null then
    insert into public.project_shares (
      project_id,
      contractor_id,
      shared_by
    )
    values (
      matched_invitation.project_id,
      current_user_id,
      matched_invitation.created_by
    )
    returning id into share_id;
  end if;

  update public.pilot_invitations
  set
    accepted_by = current_user_id,
    accepted_at = now()
  where id = matched_invitation.id;

  update public.pilot_enrollments
  set status = 'contractor_review'
  where project_id = matched_invitation.project_id
    and status = 'preparing';

  insert into public.pilot_events (
    project_id,
    actor_id,
    event_name
  )
  values (
    matched_invitation.project_id,
    current_user_id,
    'invitation_accepted'
  );

  return share_id;
end;
$$;

revoke all on function public.accept_pilot_invitation(text)
from public, anon;
grant execute on function public.accept_pilot_invitation(text)
to authenticated;

create function public.set_pilot_contractor_status(
  p_contractor_id uuid,
  p_company_name text,
  p_license_number text,
  p_service_area text,
  p_status text,
  p_onboarding_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access required';
  end if;

  if p_status not in ('pending', 'approved', 'paused') then
    raise exception 'Invalid contractor pilot status';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_contractor_id
      and role = 'contractor'
      and deactivated_at is null
  ) then
    raise exception 'Active contractor account required';
  end if;

  insert into public.pilot_contractor_profiles (
    contractor_id,
    company_name,
    license_number,
    service_area,
    status,
    onboarding_notes,
    approved_by,
    approved_at
  )
  values (
    p_contractor_id,
    trim(p_company_name),
    nullif(trim(coalesce(p_license_number, '')), ''),
    trim(p_service_area),
    p_status,
    coalesce(p_onboarding_notes, ''),
    case when p_status = 'approved' then current_user_id else null end,
    case when p_status = 'approved' then now() else null end
  )
  on conflict (contractor_id) do update
  set
    company_name = excluded.company_name,
    license_number = excluded.license_number,
    service_area = excluded.service_area,
    status = excluded.status,
    onboarding_notes = excluded.onboarding_notes,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at;

  return p_contractor_id;
end;
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

alter table public.pilot_enrollments enable row level security;
alter table public.pilot_contractor_profiles enable row level security;
alter table public.pilot_invitations enable row level security;
alter table public.contractor_quotes enable row level security;
alter table public.quote_difference_reasons enable row level security;
alter table public.pilot_feedback enable row level security;
alter table public.pilot_outcomes enable row level security;
alter table public.pilot_support_issues enable row level security;
alter table public.pilot_events enable row level security;

create policy pilot_enrollments_select_authorized
on public.pilot_enrollments for select
to authenticated
using (
  homeowner_id = (select auth.uid())
  or (select private.can_access_project(project_id))
  or (select private.is_admin())
);

create policy pilot_enrollments_insert_owner
on public.pilot_enrollments for insert
to authenticated
with check (
  homeowner_id = (select auth.uid())
  and homeowner_consent = true
  and consented_at is not null
  and exists (
    select 1
    from public.projects
    where projects.id = pilot_enrollments.project_id
      and projects.homeowner_id = (select auth.uid())
      and projects.archived_at is null
  )
);

create policy pilot_enrollments_update_owner_or_admin
on public.pilot_enrollments for update
to authenticated
using (
  homeowner_id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  homeowner_id = (
    select projects.homeowner_id
    from public.projects
    where projects.id = pilot_enrollments.project_id
  )
  and (
    homeowner_id = (select auth.uid())
    or (select private.is_admin())
  )
);

create policy pilot_contractor_profiles_select_own_or_admin
on public.pilot_contractor_profiles for select
to authenticated
using (
  contractor_id = (select auth.uid())
  or (select private.is_admin())
);

create policy pilot_contractor_profiles_admin_update
on public.pilot_contractor_profiles for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy pilot_invitations_select_participants
on public.pilot_invitations for select
to authenticated
using (
  created_by = (select auth.uid())
  or accepted_by = (select auth.uid())
  or (select private.is_admin())
);

create policy pilot_invitations_revoke_owner_or_admin
on public.pilot_invitations for update
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_admin())
)
with check (
  created_by = (select auth.uid())
  or (select private.is_admin())
);

create policy contractor_quotes_select_authorized
on public.contractor_quotes for select
to authenticated
using (
  (select private.can_access_project(project_id))
);

create policy contractor_quotes_insert_approved_contractor
on public.contractor_quotes for insert
to authenticated
with check (
  contractor_id = (select auth.uid())
  and status in ('draft', 'submitted')
  and exists (
    select 1
    from public.project_shares
    where project_shares.project_id = contractor_quotes.project_id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
  and exists (
    select 1
    from public.pilot_contractor_profiles
    where pilot_contractor_profiles.contractor_id = (select auth.uid())
      and pilot_contractor_profiles.status = 'approved'
  )
);

create policy contractor_quotes_update_author
on public.contractor_quotes for update
to authenticated
using (
  contractor_id = (select auth.uid())
  and status in ('draft', 'submitted')
  and exists (
    select 1
    from public.project_shares
    where project_shares.project_id = contractor_quotes.project_id
      and project_shares.contractor_id = (select auth.uid())
      and project_shares.revoked_at is null
  )
)
with check (
  contractor_id = (select auth.uid())
  and status in ('draft', 'submitted', 'withdrawn')
);

create policy quote_difference_reasons_select_authorized
on public.quote_difference_reasons for select
to authenticated
using ((select private.can_access_project(project_id)));

create policy quote_difference_reasons_insert_author
on public.quote_difference_reasons for insert
to authenticated
with check (
  contractor_id = (select auth.uid())
  and exists (
    select 1
    from public.contractor_quotes
    where contractor_quotes.id = quote_difference_reasons.quote_id
      and contractor_quotes.project_id = quote_difference_reasons.project_id
      and contractor_quotes.contractor_id = (select auth.uid())
      and contractor_quotes.status in ('draft', 'submitted')
  )
);

create policy quote_difference_reasons_update_author
on public.quote_difference_reasons for update
to authenticated
using (contractor_id = (select auth.uid()))
with check (contractor_id = (select auth.uid()));

create policy quote_difference_reasons_delete_author
on public.quote_difference_reasons for delete
to authenticated
using (contractor_id = (select auth.uid()));

create policy pilot_feedback_select_own_or_admin
on public.pilot_feedback for select
to authenticated
using (
  submitted_by = (select auth.uid())
  or (select private.is_admin())
);

create policy pilot_feedback_insert_authorized
on public.pilot_feedback for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and audience = (
    select case
      when profiles.role = 'homeowner' then 'homeowner'
      when profiles.role = 'contractor' then 'contractor'
      else null
    end
    from public.profiles
    where profiles.id = (select auth.uid())
  )
  and (select private.can_access_project(project_id))
);

create policy pilot_feedback_update_author
on public.pilot_feedback for update
to authenticated
using (submitted_by = (select auth.uid()))
with check (submitted_by = (select auth.uid()));

create policy pilot_outcomes_select_authorized
on public.pilot_outcomes for select
to authenticated
using ((select private.can_access_project(project_id)));

create policy pilot_outcomes_insert_owner
on public.pilot_outcomes for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.projects
    where projects.id = pilot_outcomes.project_id
      and projects.homeowner_id = (select auth.uid())
  )
);

create policy pilot_outcomes_update_owner_or_admin
on public.pilot_outcomes for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = pilot_outcomes.project_id
      and projects.homeowner_id = (select auth.uid())
  )
  or (select private.is_admin())
)
with check (
  recorded_by = (
    select projects.homeowner_id
    from public.projects
    where projects.id = pilot_outcomes.project_id
  )
);

create policy pilot_support_issues_select_reporter_or_admin
on public.pilot_support_issues for select
to authenticated
using (
  reported_by = (select auth.uid())
  or (select private.is_admin())
);

create policy pilot_support_issues_insert_reporter
on public.pilot_support_issues for insert
to authenticated
with check (
  reported_by = (select auth.uid())
  and (
    project_id is null
    or (select private.can_access_project(project_id))
  )
);

create policy pilot_support_issues_admin_update
on public.pilot_support_issues for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy pilot_events_select_own_or_admin
on public.pilot_events for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select private.is_admin())
);

create policy pilot_events_insert_actor
on public.pilot_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    project_id is null
    or (select private.can_access_project(project_id))
  )
);

revoke all on public.pilot_enrollments from anon, authenticated;
revoke all on public.pilot_contractor_profiles from anon, authenticated;
revoke all on public.pilot_invitations from anon, authenticated;
revoke all on public.contractor_quotes from anon, authenticated;
revoke all on public.quote_difference_reasons from anon, authenticated;
revoke all on public.pilot_feedback from anon, authenticated;
revoke all on public.pilot_outcomes from anon, authenticated;
revoke all on public.pilot_support_issues from anon, authenticated;
revoke all on public.pilot_events from anon, authenticated;

grant select, insert on public.pilot_enrollments to authenticated;
grant update (
  status,
  intake_started_at,
  intake_completed_at,
  updated_at
) on public.pilot_enrollments to authenticated;

grant select on public.pilot_contractor_profiles to authenticated;
grant update (
  company_name,
  license_number,
  service_area,
  status,
  onboarding_notes,
  approved_by,
  approved_at,
  updated_at
) on public.pilot_contractor_profiles to authenticated;

grant select on public.pilot_invitations to authenticated;
grant update (revoked_at) on public.pilot_invitations to authenticated;

grant select, insert on public.contractor_quotes to authenticated;
grant update (
  status,
  material_amount,
  labor_amount,
  tearoff_disposal_amount,
  permit_delivery_amount,
  allowance_amount,
  other_amount,
  scope_summary,
  exclusions,
  quote_reference,
  valid_until,
  submitted_at,
  updated_at
) on public.contractor_quotes to authenticated;

grant select, insert, update, delete on public.quote_difference_reasons
to authenticated;
grant select, insert, update on public.pilot_feedback to authenticated;
grant select, insert on public.pilot_outcomes to authenticated;
grant update (
  accepted_quote_id,
  final_contract_amount,
  change_order_total,
  outcome_status,
  notes,
  updated_at
) on public.pilot_outcomes to authenticated;
grant select, insert on public.pilot_support_issues to authenticated;
grant update (
  status,
  resolution,
  resolved_by,
  resolved_at,
  updated_at
) on public.pilot_support_issues to authenticated;
grant select, insert on public.pilot_events to authenticated;

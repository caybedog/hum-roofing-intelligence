-- HUM Round 3 and Round 4 authorization regression checks.
-- Run against a disposable database or through a transaction-capable SQL client.
-- Every test record is rolled back.

begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-owner-one@hum.invalid',
    extensions.crypt('Round3OwnerOne9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"homeowner","full_name":"RLS Owner One"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-owner-two@hum.invalid',
    extensions.crypt('Round3OwnerTwo9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"homeowner","full_name":"RLS Owner Two"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-contractor@hum.invalid',
    extensions.crypt('Round3Contractor9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"contractor","full_name":"RLS Contractor"}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-admin@hum.invalid',
    extensions.crypt('Round3Admin9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"homeowner","full_name":"RLS Administrator"}'::jsonb,
    now(),
    now()
  ),
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-qa-homeowner@hum.invalid',
    extensions.crypt('Round4QaHomeowner9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"homeowner","full_name":"RLS QA Homeowner"}'::jsonb,
    now(),
    now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-qa-contractor@hum.invalid',
    extensions.crypt('Round4QaContractor9', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{"requested_role":"contractor","full_name":"RLS QA Contractor"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set role = 'administrator'
where id = '30000000-0000-0000-0000-000000000001';

update public.profiles
set is_test_account = true
where id in (
  '50000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002'
);

insert into public.projects (
  id,
  homeowner_id,
  title,
  city,
  county,
  footprint_sqft
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Owner one project',
    'Eureka',
    'Humboldt',
    1500
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Owner two project',
    'Arcata',
    'Humboldt',
    1800
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.projects) <> 1 then
    raise exception 'RLS failure: homeowner can see another homeowner project';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = '40000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'RLS failure: homeowner cannot see the owned project';
  end if;

  begin
    update public.profiles
    set role = 'administrator'
    where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'RLS failure: homeowner self-assigned administrator';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  test_ai_request_id uuid;
begin
  select request_id
  into test_ai_request_id
  from public.claim_ai_request(
    '40000000-0000-0000-0000-000000000001',
    'round-3-test-model',
    120
  );

  if test_ai_request_id is null then
    raise exception 'AI log failure: homeowner could not claim a request';
  end if;

  perform public.complete_ai_request(
    test_ai_request_id,
    'completed',
    125,
    'test-provider-request',
    null
  );

  if not exists (
    select 1
    from public.ai_requests
    where id = test_ai_request_id
      and status = 'completed'
      and latency_ms = 125
  ) then
    raise exception 'AI log failure: bounded completion did not persist';
  end if;

  begin
    update public.ai_requests
    set created_at = now() - interval '2 hours'
    where id = test_ai_request_id;
    raise exception 'AI log failure: homeowner rewrote the rate-limit timestamp';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  returned_project_id uuid;
begin
  insert into public.projects (
    id,
    homeowner_id,
    title,
    city,
    county,
    footprint_sqft
  )
  values (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Homeowner returning test',
    'Eureka',
    'Humboldt',
    1200
  )
  returning id into returned_project_id;

  if returned_project_id <>
    '40000000-0000-0000-0000-000000000003'::uuid then
    raise exception 'RLS failure: homeowner INSERT RETURNING is blocked';
  end if;
end;
$$;

reset role;
delete from public.projects
where id = '40000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.projects) <> 0 then
    raise exception 'RLS failure: unshared contractor can see a project';
  end if;
end;
$$;

reset role;
insert into public.project_shares (
  id,
  project_id,
  contractor_id,
  shared_by
)
values (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.project_photos (
  id,
  project_id,
  owner_id,
  storage_path,
  file_name,
  mime_type,
  size_bytes
)
values (
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000001/test.jpg',
  'test.jpg',
  'image/jpeg',
  4
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.projects) <> 1 then
    raise exception 'RLS failure: shared contractor cannot see the shared project';
  end if;

  if (select count(*) from public.project_shares) <> 1 then
    raise exception 'RLS failure: shared contractor cannot see the active share';
  end if;

  if (select count(*) from public.project_photos) <> 1 then
    raise exception 'RLS failure: shared contractor cannot see photo metadata';
  end if;
end;
$$;

insert into public.contractor_reviews (
  project_id,
  contractor_id,
  scope_corrections,
  notes,
  status,
  submitted_at
)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '["Verify chimney flashing"]'::jsonb,
  'RLS contractor correction',
  'submitted',
  now()
);

reset role;
update public.project_shares
set revoked_at = now()
where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.projects) <> 0 then
    raise exception 'RLS failure: revoked contractor still sees the project';
  end if;

  if (select count(*) from public.project_shares) <> 0 then
    raise exception 'RLS failure: revoked contractor still sees the share';
  end if;

  if (select count(*) from public.project_photos) <> 0 then
    raise exception 'RLS failure: revoked contractor still sees photo metadata';
  end if;

  if (select count(*) from public.contractor_reviews) <> 0 then
    raise exception 'RLS failure: revoked contractor still sees its project review';
  end if;

  begin
    update public.contractor_reviews
    set notes = 'This update must not survive revocation'
    where project_id = '40000000-0000-0000-0000-000000000001';
    if found then
      raise exception 'RLS failure: revoked contractor updated a project review';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select count(*)
    from public.projects
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002'
    )
  ) <> 2 then
    raise exception 'RLS failure: administrator cannot see all projects';
  end if;

  if (
    select count(*)
    from public.audit_events
    where actor_id in (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    )
  ) = 0 then
    raise exception 'Audit failure: protected changes did not create events';
  end if;
end;
$$;

reset role;

insert into public.estimates (
  id,
  project_id,
  version_number,
  pricing_version_id,
  homeowner_inputs,
  calculation_inputs,
  calculation_result,
  confidence_score,
  created_by
)
select
  '70000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  1,
  pricing_versions.id,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"scenarios":{"expected":{"planningPrice":20000}}}'::jsonb,
  80,
  '10000000-0000-0000-0000-000000000001'
from public.pricing_versions
where status = 'approved'
order by effective_date desc
limit 1;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.set_pilot_contractor_status(
  '20000000-0000-0000-0000-000000000001',
  'RLS Roofing',
  'TEST-123',
  'Humboldt County',
  'approved',
  'Transaction-only Round 4 test'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.pilot_enrollments (
  id,
  project_id,
  homeowner_id,
  homeowner_consent,
  consented_at,
  intake_started_at,
  intake_completed_at
)
values (
  '80000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  true,
  now(),
  now() - interval '15 minutes',
  now()
);

do $$
declare
  invitation_token text;
  accepted_share_id uuid;
begin
  select created.invitation_token
  into invitation_token
  from public.create_pilot_invitation(
    '40000000-0000-0000-0000-000000000001',
    14
  ) as created;

  if invitation_token is null or char_length(invitation_token) <> 48 then
    raise exception 'Pilot failure: invitation token was not generated safely';
  end if;

  perform set_config(
    'request.jwt.claims',
    '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
    true
  );

  select public.accept_pilot_invitation(invitation_token)
  into accepted_share_id;

  if accepted_share_id is null then
    raise exception 'Pilot failure: approved contractor could not accept invitation';
  end if;
end;
$$;

insert into public.contractor_quotes (
  id,
  project_id,
  estimate_id,
  contractor_id,
  status,
  material_amount,
  labor_amount,
  tearoff_disposal_amount,
  permit_delivery_amount,
  allowance_amount,
  scope_summary,
  submitted_at
)
values (
  '90000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'submitted',
  9000,
  7000,
  1800,
  700,
  500,
  'Remove one layer and install architectural shingles with standard flashing.',
  now()
);

insert into public.quote_difference_reasons (
  quote_id,
  project_id,
  contractor_id,
  reason_code,
  direction,
  amount_effect,
  explanation
)
values (
  '90000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'access',
  'higher',
  500,
  'Rear access requires additional hand carrying.'
);

do $$
begin
  if (select count(*) from public.contractor_quotes) <> 1 then
    raise exception 'Pilot RLS failure: invited contractor cannot see own quote';
  end if;

  if not exists (
    select 1
    from public.pilot_enrollments
    where project_id = '40000000-0000-0000-0000-000000000001'
      and status = 'quote_received'
  ) then
    raise exception 'Pilot workflow failure: submitted quote did not update pilot status';
  end if;

  begin
    insert into public.contractor_quotes (
      project_id,
      estimate_id,
      contractor_id,
      scope_summary
    )
    values (
      '40000000-0000-0000-0000-000000000002',
      '70000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'This cross-project quote must never be accepted.'
    );
    raise exception 'Pilot RLS failure: contractor quoted an unshared project';
  exception
    when foreign_key_violation or insufficient_privilege or check_violation then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.pilot_enrollments) <> 0 then
    raise exception 'Pilot RLS failure: unrelated homeowner sees an enrollment';
  end if;
  if (select count(*) from public.contractor_quotes) <> 0 then
    raise exception 'Pilot RLS failure: unrelated homeowner sees a contractor quote';
  end if;
  if (select count(*) from public.quote_difference_reasons) <> 0 then
    raise exception 'Pilot RLS failure: unrelated homeowner sees difference reasons';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.pilot_outcomes (
  project_id,
  recorded_by,
  accepted_quote_id,
  final_contract_amount,
  outcome_status
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  19000,
  'contractor_selected'
);

update public.project_shares
set revoked_at = now()
where project_id = '40000000-0000-0000-0000-000000000001'
  and contractor_id = '20000000-0000-0000-0000-000000000001'
  and revoked_at is null;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.contractor_quotes) <> 0 then
    raise exception 'Pilot RLS failure: revoked contractor still sees quote evidence';
  end if;
  if (select count(*) from public.pilot_outcomes) <> 0 then
    raise exception 'Pilot RLS failure: revoked contractor still sees homeowner outcome';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.pilot_enrollments) <> 1 then
    raise exception 'Pilot RLS failure: administrator cannot see enrollment evidence';
  end if;
  if (select count(*) from public.contractor_quotes) <> 1 then
    raise exception 'Pilot RLS failure: administrator cannot see quote evidence';
  end if;
  if (select count(*) from public.pilot_outcomes) <> 1 then
    raise exception 'Pilot RLS failure: administrator cannot see outcome evidence';
  end if;
end;
$$;

-- Phase 4A: test identities and projects remain isolated from real pilot
-- evidence, while persistent controls stay administrator-only.

update public.pilot_settings
set
  enrollments_paused = true,
  invitation_expiry_days = 7,
  variance_review_threshold_pct = 12.5,
  updated_by = '30000000-0000-0000-0000-000000000001'
where id = 1;

insert into public.qa_runs (
  id,
  created_by,
  label,
  homeowner_user_id,
  homeowner_email,
  contractor_user_id,
  contractor_email
)
values (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'RLS Phase 4A rehearsal',
  '50000000-0000-0000-0000-000000000001',
  'rls-qa-homeowner@hum.invalid',
  '50000000-0000-0000-0000-000000000002',
  'rls-qa-contractor@hum.invalid'
);

do $$
declare
  role_change_blocked boolean := false;
begin
  if not exists (
    select 1
    from public.qa_runs
    where id = '60000000-0000-0000-0000-000000000001'
      and status = 'active'
  ) then
    raise exception 'Phase 4A failure: administrator cannot see QA runs';
  end if;

  begin
    perform public.admin_set_user_role(
      '50000000-0000-0000-0000-000000000001',
      'administrator'
    );
  exception
    when raise_exception then role_change_blocked := true;
  end;

  if not role_change_blocked then
    raise exception 'Phase 4A failure: QA account became an administrator';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.projects (
  id,
  homeowner_id,
  title,
  city,
  county,
  footprint_sqft
)
values (
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  'QA project that cannot count',
  'Eureka',
  'Humboldt',
  1400
);

do $$
declare
  changed_settings integer := 0;
begin
  if not exists (
    select 1
    from public.projects
    where id = '60000000-0000-0000-0000-000000000002'
      and is_test = true
  ) then
    raise exception 'Phase 4A failure: QA project was not server-classified';
  end if;

  if (select count(*) from public.qa_runs) <> 0 then
    raise exception 'Phase 4A failure: QA homeowner can see admin rehearsal records';
  end if;

  update public.pilot_settings
  set enrollments_paused = false
  where id = 1;
  get diagnostics changed_settings = row_count;

  if changed_settings <> 0 then
    raise exception 'Phase 4A failure: QA homeowner changed pilot settings';
  end if;

  begin
    perform public.reset_qa_run_data(
      '60000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    );
    raise exception 'Phase 4A failure: authenticated user invoked QA reset';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

insert into public.pilot_enrollments (
  project_id,
  homeowner_id,
  homeowner_consent,
  consented_at
)
values (
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  true,
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  enrollment_blocked boolean := false;
begin
  begin
    insert into public.pilot_enrollments (
      project_id,
      homeowner_id,
      homeowner_consent,
      consented_at
    )
    values (
      '40000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      true,
      now()
    );
  exception
    when raise_exception then enrollment_blocked := true;
  end;

  if not enrollment_blocked then
    raise exception 'Phase 4A failure: paused real enrollment was accepted';
  end if;
end;
$$;

rollback;

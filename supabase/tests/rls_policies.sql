-- HUM Round 3 authorization regression checks.
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
  );

update public.profiles
set role = 'administrator'
where id = '30000000-0000-0000-0000-000000000001';

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

rollback;

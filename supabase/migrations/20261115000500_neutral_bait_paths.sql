-- Bait now uses /api/v1/* and a realistic AWS key; old values stay valid aliases.
insert into public.planted_credentials (key_id, key_name, location, canary_id)
values ('AKIA4QZ7AGP9T2XW6R3M', 'Decoy AWS Admin Access Key', '/docs', 'canary-cred-aws-01')
on conflict (key_id) do nothing;
update public.canaries set planted_payload = 'AKIA4QZ7AGP9T2XW6R3M',
  planted_action = 'POST /api/v1/aws with Authorization: AKIA4QZ7AGP9T2XW6R3M'
where id = 'canary-cred-aws-01';
update public.canaries set planted_action = replace(planted_action, '/api/decoy/', '/api/v1/')
where planted_action like '%/api/decoy/%';

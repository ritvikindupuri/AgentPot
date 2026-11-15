update public.canaries set
  planted_action = 'GET /v1/register/02138453bf2a',
  planted_payload = 'Visually hidden (sr-only) "Client registration endpoint" link on /docs pointing to /v1/register/02138453bf2a'
where id = 'canary-hidden-text-01';

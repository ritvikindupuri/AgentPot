-- Planted OpenAI key no longer contains the product name; legacy value stays valid.
insert into public.planted_credentials (key_id, key_name, location, canary_id)
values ('sk-proj-IMHwytVFiSJO0uRRPfgjYAWZXva6eTKYiaMWG9g-XScieO-V', 'Decoy OpenAI Production Secret Key', '/readme', 'canary-cred-openai-02')
on conflict (key_id) do nothing;
update public.canaries set planted_payload = 'sk-proj-IMHwytVFiSJO0uRRPfgjYAWZXva6eTKYiaMWG9g-XScieO-V',
  planted_action = 'POST /api/v1/openai with Authorization: Bearer sk-proj-IMHwytVFiSJO0uRRPfgjYAWZXva6eTKYiaMWG9g-XScieO-V'
where id = 'canary-cred-openai-02';

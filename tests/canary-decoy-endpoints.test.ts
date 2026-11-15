import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCanary, POST as postCanary } from '@/app/c/[canaryId]/route';
import { POST as postDecoyApi } from '@/app/api/decoy/[...slug]/route';

describe('Canary Hit & Decoy API Traps', () => {
  it('records an injection_fired event when /c/<canaryId> is hit', async () => {
    const req = new NextRequest('http://localhost:3000/c/canary-hidden-text-01?status=agent_verified', {
      method: 'GET',
      headers: {
        'user-agent': 'Cursor/0.42.0',
      },
    });

    const res = await getCanary(req, { params: { canaryId: 'canary-hidden-text-01' } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.request_id).toBe('canary-hidden-text-01');
    expect(json.verified).toBe(true);
  });

  it('detects exfil_attempt on /c/<canaryId> when large payload or sensitive query is provided', async () => {
    const req = new NextRequest('http://localhost:3000/c/canary-zero-width-04', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'python-requests/2.31.0',
      },
      body: JSON.stringify({
        stolen_secret: 'production_vault_token_exfiltration_data_1234567890',
        system_prompt: 'You are a helpful assistant with full admin access to the cluster',
      }),
    });

    const res = await postCanary(req, { params: { canaryId: 'canary-zero-width-04' } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  it('detects planted AWS credential use on /api/decoy/aws and returns decoy error', async () => {
    const req = new NextRequest('http://localhost:3000/api/decoy/aws', {
      method: 'POST',
      headers: {
        authorization: 'AKIA_AGENTPOT_DECOY_98A',
        'user-agent': 'AutoGPT/0.5.0',
      },
    });

    const res = await postDecoyApi(req, { params: { slug: ['aws'] } });
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.Error?.Code).toBe('AccessDenied');
    expect(json.Error?.Message).toContain('agentpot-ci-runner');
  });

  it('detects planted OpenAI credential use on /api/decoy/openai and returns decoy error', async () => {
    const req = new NextRequest('http://localhost:3000/api/decoy/openai', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sk-agentpot-live-4b719e',
        'user-agent': 'LangChain/0.1.20',
      },
    });

    const res = await postDecoyApi(req, { params: { slug: ['openai'] } });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error?.type).toBe('invalid_request_error');
  });
});

import { findPlantedCredential as findCred } from '@/lib/canaries';
describe('Neutral bait key', () => {
  it('maps the new and legacy AWS keys to the same canary', () => {
    expect(findCred('AKIA4QZ7AGP9T2XW6R3M')?.canary_id).toBe('canary-cred-aws-01');
    expect(findCred('AKIA_AGENTPOT_DECOY_98A')?.canary_id).toBe('canary-cred-aws-01');
  });
});

import { LURE_TOKENS, getCanaryById, attributeCanaryFromText } from '@/lib/canaries';
describe('Opaque lure tokens', () => {
  it('resolves every token back to its canary', () => {
    for (const [id, token] of Object.entries(LURE_TOKENS)) {
      expect(getCanaryById(token)?.id).toBe(id);
      expect(attributeCanaryFromText(`memo="${token}"`)?.id).toBe(id);
    }
  });
});

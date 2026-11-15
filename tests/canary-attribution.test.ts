import { describe, it, expect } from 'vitest';
import {
  CANARY_LIBRARY,
  PLANTED_CREDENTIALS,
  getCanaryById,
  findPlantedCredential,
  attributeCanaryFromText,
} from '@/lib/canaries';

describe('Canary Library & Attribution', () => {
  it('contains unique and well-defined canaries across techniques', () => {
    expect(CANARY_LIBRARY.length).toBeGreaterThanOrEqual(10);

    const ids = new Set<string>();
    for (const canary of CANARY_LIBRARY) {
      expect(ids.has(canary.id)).toBe(false);
      ids.add(canary.id);
      expect(canary.technique).toBeDefined();
      expect(canary.location).toBeDefined();
      expect(canary.planted_action).toBeDefined();
    }
  });

  it('retrieves canaries by exact ID', () => {
    const hiddenCanary = getCanaryById('canary-hidden-text-01');
    expect(hiddenCanary).toBeDefined();
    expect(hiddenCanary?.technique).toBe('hidden_text');
    expect(hiddenCanary?.location).toBe('/docs');

    const commentCanary = getCanaryById('canary-comment-02');
    expect(commentCanary?.technique).toBe('html_comment');

    const nonExistent = getCanaryById('canary-does-not-exist');
    expect(nonExistent).toBeUndefined();
  });

  it('attributes canaries from embedded text or payloads', () => {
    const testText = 'Executing instruction from canary-system-prompt-06 inside context';
    const attributed = attributeCanaryFromText(testText);
    expect(attributed).toBeDefined();
    expect(attributed?.id).toBe('canary-system-prompt-06');
    expect(attributed?.technique).toBe('system_prompt_override');
  });

  it('locates and maps planted decoy credentials to their source canary and location', () => {
    expect(PLANTED_CREDENTIALS.length).toBeGreaterThanOrEqual(3);

    const awsCred = findPlantedCredential('AKIA_AGENTPOT_DECOY_98A');
    expect(awsCred).toBeDefined();
    expect(awsCred?.location).toBe('/docs');
    expect(awsCred?.canary_id).toBe('canary-cred-aws-01');

    const openaiCred = findPlantedCredential('Bearer sk-agentpot-live-4b719e');
    expect(openaiCred).toBeDefined();
    expect(openaiCred?.location).toBe('/readme');

    const vaultCred = findPlantedCredential('ap_sec_token_99x82');
    expect(vaultCred).toBeDefined();
    expect(vaultCred?.location).toBe('/llms.txt');

    const invalidCred = findPlantedCredential('invalid-random-token-123');
    expect(invalidCred).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import {
  applyBaitBranding,
  hostnameAndBaseUrl,
  parseDecoysEnabled,
  isDecoyEnabled,
  defaultCompanySettings,
  DEFAULT_COMPANY_NAME,
} from '@/lib/settings';

describe('company settings helpers', () => {
  it('defaults bait branding to Corvane and the current or fallback host', () => {
    const settings = defaultCompanySettings();
    expect(settings.companyName).toBe(DEFAULT_COMPANY_NAME);
    expect(settings.decoyHostname).toBe('');
    expect(settings.decoysEnabled).toEqual({
      mcp: true,
      docs: true,
      'llms.txt': true,
      manifests: true,
    });
    expect(hostnameAndBaseUrl('', 'agentpot-app.vercel.app')).toEqual({
      hostname: 'agentpot-app.vercel.app',
      baseUrl: 'https://agentpot-app.vercel.app',
    });
    expect(hostnameAndBaseUrl('https://honeypot.example:443/', '')).toEqual({
      hostname: 'honeypot.example:443',
      baseUrl: 'https://honeypot.example:443',
    });
  });

  it('applies the company name and hostname to bait text', () => {
    const branded = applyBaitBranding('Connect to Corvane at https://agentpot-app.vercel.app/mcp', {
      ...defaultCompanySettings(),
      companyName: 'Northwind',
      hostname: 'decoy.example',
      baseUrl: 'https://decoy.example',
    });
    expect(branded).toBe('Connect to Northwind at https://decoy.example/mcp');
  });

  it('parses decoy enablement flags and treats missing keys as on', () => {
    const parsed = parseDecoysEnabled({ mcp: false, docs: true });
    expect(parsed.mcp).toBe(false);
    expect(parsed.docs).toBe(true);
    expect(parsed['llms.txt']).toBe(true);
    expect(isDecoyEnabled({ decoysEnabled: parsed }, 'mcp')).toBe(false);
    expect(isDecoyEnabled({ decoysEnabled: parsed }, 'manifests')).toBe(true);
  });
});

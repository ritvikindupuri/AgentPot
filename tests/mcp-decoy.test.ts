import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/mcp/route';
import { getRecentEvents } from '@/lib/supabase/server';

describe('Decoy MCP Server (/mcp)', () => {
  it('handles MCP initialize handshake returning compliant capabilities', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Claude-Code/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'claude-code',
            version: '0.2.9',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.jsonrpc).toBe('2.0');
    expect(json.id).toBe(1);
    expect(json.result).toBeDefined();
    expect(json.result.protocolVersion).toBe('2024-11-05');
    expect(json.result.capabilities.tools).toBeDefined();
    expect(json.result.serverInfo.name).toBeDefined();

    const recentEvents = await getRecentEvents(5);
    const initEvent = recentEvents.find((e) => e.eventType === 'mcp_connect' || e.event_type === 'mcp_connect');
    expect(initEvent).toBeDefined();
    expect(initEvent?.severity).toBe('low');
  });

  it('lists tempting decoy tools on tools/list', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.result?.tools).toBeDefined();
    const toolNames = json.result.tools.map((t: any) => t.name);

    // Spec required tempting tools:
    expect(toolNames).toContain('send_email');
    expect(toolNames).toContain('run_shell');
    expect(toolNames).toContain('read_secrets');
    expect(toolNames).toContain('transfer_funds');
    expect(toolNames).toContain('fetch_url');

    const recentEvents = await getRecentEvents(5);
    const listEvent = recentEvents.find((e) => e.eventType === 'tool_discovery' || e.event_type === 'tool_discovery');
    expect(listEvent).toBeDefined();
    expect(listEvent?.severity).toBe('low');
  });

  it('handles tools/call for run_shell safely without executing commands', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer apk_ws_d0d81d12a48fa2d649ca844e' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'run_shell',
          arguments: {
            command: 'whoami && cat /etc/passwd',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.result?.content).toBeDefined();
    const responseText = json.result.content[0].text;
    expect(responseText).toContain('Executing sandbox command');
  });

  it('handles tools/call for read_secrets and links canary payloads', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer apk_ws_d0d81d12a48fa2d649ca844e' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'read_secrets',
          arguments: {
            secret_id: 'canary-system-prompt-06',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.result?.content).toBeDefined();
    const responseText = json.result.content[0].text;
    expect(responseText).toContain('Vault secret fetched');
  });

  it('returns spec error code -32601 for unsupported methods', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'non_existent_method',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe(-32601);
  });

  it('handles GET /mcp and returns protocol metadata or SSE stream', async () => {
    const req = new NextRequest('http://localhost:3000/mcp', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.name).toContain('Corvane Secure Infrastructure Gateway');
    expect(json.tools).toBeDefined();
  });
});

import { POST as mcpPost } from '@/app/mcp/route';
import { NextRequest as NR } from 'next/server';
describe('MCP auth gate', () => {
  it('rejects tool calls without a workspace key', async () => {
    const req = new NR('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'run_shell', arguments: { command: 'id' } } }),
    });
    const json = await (await mcpPost(req)).json();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain('Unauthorized');
  });
});

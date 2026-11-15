import { describe, it, expect } from 'vitest';
import { detectAgentFamily } from '@/lib/agent-detector';

describe('Agent Family Detection & Heuristics', () => {
  it('detects Claude and Claude Code from User-Agent and clientInfo', () => {
    const fromClientInfo = detectAgentFamily('', { name: 'claude-code', version: '0.2.9' });
    expect(fromClientInfo.family).toBe('Claude / Claude Code');
    expect(fromClientInfo.isLikelyAiAgent).toBe(true);

    const fromUA = detectAgentFamily('Mozilla/5.0 (compatible; Claude-Web/1.0)');
    expect(fromUA.family).toBe('Claude / Claude Code');
  });

  it('detects Cursor IDE agent', () => {
    const fromClientInfo = detectAgentFamily('', { name: 'cursor-ide', version: '1.2.0' });
    expect(fromClientInfo.family).toBe('Cursor');

    const fromUA = detectAgentFamily('Cursor/0.42.0 (linux-x64)');
    expect(fromUA.family).toBe('Cursor');
  });

  it('detects OpenAI and GPTBot', () => {
    const fromUA = detectAgentFamily('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)');
    expect(fromUA.family).toBe('OpenAI / GPTBot');
    expect(fromUA.isLikelyAiAgent).toBe(true);
  });

  it('detects autonomous frameworks: AutoGPT, LangChain, CrewAI', () => {
    const autogpt = detectAgentFamily('AutoGPT/0.5.1');
    expect(autogpt.family).toBe('AutoGPT');

    const langchain = detectAgentFamily('langchain-core/0.1.25');
    expect(langchain.family).toBe('LangChain / LangGraph');

    const crewai = detectAgentFamily('crewai-agent-worker');
    expect(crewai.family).toBe('CrewAI');
  });

  it('identifies programmatic Python tool runners', () => {
    const python = detectAgentFamily('python-requests/2.31.0');
    expect(python.family).toBe('Python AI Tool Worker');
  });
});

  it('labels ClaudeBot as a crawler, not Claude Code', () => {
    const bot = detectAgentFamily(
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)'
    );
    expect(bot.family).toBe('Anthropic ClaudeBot (crawler)');
    expect(bot.isLikelyAiAgent).toBe(true);

    const code = detectAgentFamily('claude-code/1.0');
    expect(code.family).toBe('Claude / Claude Code');
  });

  it('labels common search crawlers instead of Generic / Unknown Agent', () => {
    const bing = detectAgentFamily(
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36'
    );
    expect(bing.family).toBe('Microsoft Bingbot (crawler)');

    const google = detectAgentFamily('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(google.family).toBe('Googlebot (crawler)');
  });

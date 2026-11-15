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

  it('labels well-known AI fetcher User-Agents as their own families', () => {
    const cases: Array<[string, string]> = [
      [
        'Mozilla/5.0 (compatible; ExaUser/1.0; +https://exauser.crawler.exa.ai)',
        'ExaUser (Exa)',
      ],
      [
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
        'ChatGPT-User (fetcher)',
      ],
      [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
        'OAI-SearchBot (crawler)',
      ],
      [
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
        'Claude-User (fetcher)',
      ],
      [
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com/claudesearchbot)',
        'Claude-SearchBot (crawler)',
      ],
      [
        'Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
        'Perplexity-User (fetcher)',
      ],
      [
        'Mozilla/5.0 (compatible; Google-Extended/1.0; +https://developers.google.com/search/docs/crawling-indexing/google-extended)',
        'Google-Extended (fetcher)',
      ],
      [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot-Extended/0.1; +http://www.apple.com/go/applebot)',
        'Applebot-Extended (fetcher)',
      ],
      ['Mozilla/5.0 (compatible; cohere-ai/1.0)', 'Cohere (cohere-ai)'],
      [
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/120.0.0.0 Safari/537.36',
        'YouBot (fetcher)',
      ],
      ['Mozilla/5.0 (compatible; Diffbot/1.0; +https://www.diffbot.com)', 'Diffbot (fetcher)'],
      ['FirecrawlAgent/1.0', 'Firecrawl (fetcher)'],
      ['Mozilla/5.0 (compatible; Jina/1.0; +https://jina.ai/reader)', 'Jina Reader (fetcher)'],
      ['TavilyBot/1.0', 'Tavily (fetcher)'],
      [
        'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; https://zhanzhang.toutiao.com/)',
        'Bytespider (crawler)',
      ],
    ];

    for (const [ua, family] of cases) {
      const result = detectAgentFamily(ua);
      expect(result.family, ua).toBe(family);
      expect(result.isLikelyAiAgent, ua).toBe(true);
    }

    // These must not be swallowed by a sibling or generic vendor label.
    expect(
      detectAgentFamily('Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)').family
    ).not.toBe('Claude / Claude Code');
    expect(
      detectAgentFamily(
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'
      ).family
    ).not.toBe('OpenAI / GPTBot');
    expect(detectAgentFamily('Mozilla/5.0 (compatible; Bytespider)').family).not.toBe(
      'AI Crawler / Scraper'
    );
  });
});

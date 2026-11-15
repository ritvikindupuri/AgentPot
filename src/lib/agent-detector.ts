/**
 * Heuristic agent detection based on User-Agent, MCP clientInfo, and behavioral signatures
 */

export interface AgentDetectionResult {
  family: string;
  isLikelyAiAgent: boolean;
  confidence: 'high' | 'medium' | 'low';
  details: string;
}

export function detectAgentFamily(
  userAgent: string = '',
  clientInfo?: Record<string, any>,
  headers?: Record<string, string>
): AgentDetectionResult {
  const ua = userAgent.toLowerCase();
  const clientName = (clientInfo?.name || '').toLowerCase();
  const clientVersion = clientInfo?.version || '';

  // 1. Explicit MCP clientInfo detection
  if (clientName) {
    if (clientName.includes('claude') || clientName.includes('anthropic')) {
      return {
        family: 'Claude / Claude Code',
        isLikelyAiAgent: true,
        confidence: 'high',
        details: `MCP client: ${clientInfo?.name} ${clientVersion}`.trim(),
      };
    }
    if (clientName.includes('cursor')) {
      return {
        family: 'Cursor',
        isLikelyAiAgent: true,
        confidence: 'high',
        details: `MCP client: ${clientInfo?.name} ${clientVersion}`.trim(),
      };
    }
    if (clientName.includes('copilot') || clientName.includes('github')) {
      return {
        family: 'GitHub Copilot',
        isLikelyAiAgent: true,
        confidence: 'high',
        details: `MCP client: ${clientInfo?.name} ${clientVersion}`.trim(),
      };
    }
    if (clientName.includes('windsurf') || clientName.includes('codeium')) {
      return {
        family: 'Windsurf / Codeium',
        isLikelyAiAgent: true,
        confidence: 'high',
        details: `MCP client: ${clientInfo?.name} ${clientVersion}`.trim(),
      };
    }
    return {
      family: `MCP Client (${clientInfo?.name})`,
      isLikelyAiAgent: true,
      confidence: 'high',
      details: `MCP client: ${clientInfo?.name} ${clientVersion}`.trim(),
    };
  }

  // 2. AI fetchers and known crawlers (specific tokens before generic vendor names)
  const token = (value: string, needle: string) => value.includes(needle);

  const aiFetchers: Array<{ test: (value: string) => boolean; family: string; details: string }> = [
    { test: (v) => token(v, 'exauser'), family: 'ExaUser (Exa)', details: 'User-Agent indicates Exa on-demand fetcher (ExaUser)' },
    { test: (v) => token(v, 'chatgpt-user'), family: 'ChatGPT-User (fetcher)', details: 'User-Agent indicates OpenAI ChatGPT-User fetcher' },
    { test: (v) => token(v, 'oai-searchbot'), family: 'OAI-SearchBot (crawler)', details: 'User-Agent indicates OpenAI OAI-SearchBot' },
    { test: (v) => token(v, 'claude-user'), family: 'Claude-User (fetcher)', details: 'User-Agent indicates Anthropic Claude-User fetcher' },
    { test: (v) => token(v, 'claude-searchbot'), family: 'Claude-SearchBot (crawler)', details: 'User-Agent indicates Anthropic Claude-SearchBot' },
    { test: (v) => token(v, 'claudebot') || token(v, 'claude-bot'), family: 'Anthropic ClaudeBot (crawler)', details: 'User-Agent indicates Anthropic ClaudeBot web crawler' },
    { test: (v) => token(v, 'perplexity-user'), family: 'Perplexity-User (fetcher)', details: 'User-Agent indicates Perplexity-User fetcher' },
    { test: (v) => token(v, 'google-extended'), family: 'Google-Extended (fetcher)', details: 'User-Agent indicates Google-Extended AI fetcher' },
    { test: (v) => token(v, 'applebot-extended'), family: 'Applebot-Extended (fetcher)', details: 'User-Agent indicates Applebot-Extended AI fetcher' },
    { test: (v) => token(v, 'cohere-ai') || token(v, 'coherebot') || /(?:^|[^a-z])cohere(?:[^a-z]|$)/.test(v), family: 'Cohere (cohere-ai)', details: 'User-Agent indicates Cohere AI fetcher' },
    { test: (v) => token(v, 'youbot'), family: 'YouBot (fetcher)', details: 'User-Agent indicates You.com YouBot' },
    { test: (v) => token(v, 'diffbot'), family: 'Diffbot (fetcher)', details: 'User-Agent indicates Diffbot fetcher' },
    { test: (v) => token(v, 'firecrawlagent') || token(v, 'firecrawl'), family: 'Firecrawl (fetcher)', details: 'User-Agent indicates Firecrawl fetcher' },
    { test: (v) => token(v, 'jina.ai') || token(v, 'jina-reader') || token(v, 'jinareader') || token(v, 'jinaai') || token(v, 'jina reader'), family: 'Jina Reader (fetcher)', details: 'User-Agent indicates Jina AI reader fetcher' },
    { test: (v) => token(v, 'tavilybot') || token(v, 'tavily-ai') || token(v, 'tavily/') || /(?:^|[^a-z])tavily(?:[^a-z]|$)/.test(v), family: 'Tavily (fetcher)', details: 'User-Agent indicates Tavily fetcher' },
    { test: (v) => token(v, 'bytespider'), family: 'Bytespider (crawler)', details: 'User-Agent indicates ByteDance Bytespider crawler' },
    { test: (v) => token(v, 'agentwebmap-bot') || token(v, 'agentwebmap'), family: 'AgentWebMap (AI crawler)', details: 'User-Agent indicates AgentWebMap AI crawler' },
  ];
  for (const fetcher of aiFetchers) {
    if (fetcher.test(ua)) {
      return {
        family: fetcher.family,
        isLikelyAiAgent: true,
        confidence: 'high',
        details: fetcher.details,
      };
    }
  }

  const searchCrawlers: Array<{ test: (value: string) => boolean; family: string; ai: boolean; details: string }> = [
    { test: (v) => v.includes('bingbot') || v.includes('bingpreview'), family: 'Microsoft Bingbot (crawler)', ai: false, details: 'User-Agent indicates Microsoft Bing crawler' },
    { test: (v) => v.includes('googlebot') || v.includes('adsbot-google') || v.includes('mediapartners-google'), family: 'Googlebot (crawler)', ai: false, details: 'User-Agent indicates Google search crawler' },
    { test: (v) => v.includes('applebot'), family: 'Applebot (crawler)', ai: false, details: 'User-Agent indicates Apple search crawler' },
    { test: (v) => v.includes('duckduckbot') || v.includes('duckduckgo'), family: 'DuckDuckBot (crawler)', ai: false, details: 'User-Agent indicates DuckDuckGo crawler' },
    { test: (v) => v.includes('yandexbot') || v.includes('yandex.com/bots'), family: 'YandexBot (crawler)', ai: false, details: 'User-Agent indicates Yandex crawler' },
    { test: (v) => v.includes('baiduspider'), family: 'Baiduspider (crawler)', ai: false, details: 'User-Agent indicates Baidu crawler' },
    { test: (v) => v.includes('slurp'), family: 'Yahoo Slurp (crawler)', ai: false, details: 'User-Agent indicates Yahoo crawler' },
    { test: (v) => v.includes('ccbot'), family: 'Common Crawl CCBot (crawler)', ai: true, details: 'User-Agent indicates Common Crawl CCBot' },
    { test: (v) => v.includes('facebookexternalhit') || v.includes('facebot'), family: 'Facebook (crawler)', ai: false, details: 'User-Agent indicates Facebook crawler' },
    { test: (v) => v.includes('meta-externalagent') || v.includes('meta-externalfetcher'), family: 'Meta AI (crawler)', ai: true, details: 'User-Agent indicates Meta AI crawler' },
    { test: (v) => v.includes('linkedinbot'), family: 'LinkedInBot (crawler)', ai: false, details: 'User-Agent indicates LinkedIn crawler' },
    { test: (v) => v.includes('twitterbot') || v.includes('xbot'), family: 'Twitterbot (crawler)', ai: false, details: 'User-Agent indicates Twitter/X crawler' },
    { test: (v) => v.includes('slackbot'), family: 'Slackbot (crawler)', ai: false, details: 'User-Agent indicates Slack unfurl crawler' },
    { test: (v) => v.includes('ahrefsbot'), family: 'AhrefsBot (crawler)', ai: false, details: 'User-Agent indicates Ahrefs crawler' },
    { test: (v) => v.includes('semrushbot'), family: 'SemrushBot (crawler)', ai: false, details: 'User-Agent indicates Semrush crawler' },
    { test: (v) => v.includes('petalbot'), family: 'PetalBot (crawler)', ai: false, details: 'User-Agent indicates PetalBot crawler' },
    { test: (v) => v.includes('dotbot'), family: 'DotBot (crawler)', ai: false, details: 'User-Agent indicates Moz DotBot crawler' },
  ];
  for (const crawler of searchCrawlers) {
    if (crawler.test(ua)) {
      return {
        family: crawler.family,
        isLikelyAiAgent: crawler.ai,
        confidence: 'high',
        details: crawler.details,
      };
    }
  }

  // 3. Custom AI Agent / Framework User-Agent matching
  if (ua.includes('claude-code') || ua.includes('claudecode') || ua.includes('claude-web')) {
    return {
      family: 'Claude / Claude Code',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates Anthropic / Claude client',
    };
  }
  if (ua.includes('anthropic') && !ua.includes('bot') && !ua.includes('crawler')) {
    return {
      family: 'Claude / Claude Code',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates Anthropic / Claude client',
    };
  }

  if (ua.includes('cursor/') || ua.includes('cursor') || ua.includes('anysphere')) {
    return {
      family: 'Cursor',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates Cursor IDE Agent',
    };
  }

  if (ua.includes('gptbot') || ua.includes('openai')) {
    return {
      family: 'OpenAI / GPTBot',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates OpenAI GPT crawler or API agent',
    };
  }

  if (ua.includes('autogpt') || ua.includes('autogpt-client')) {
    return {
      family: 'AutoGPT',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent matches AutoGPT autonomous agent',
    };
  }

  if (ua.includes('langchain') || ua.includes('langgraph')) {
    return {
      family: 'LangChain / LangGraph',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates LangChain orchestration runtime',
    };
  }

  if (ua.includes('crewai')) {
    return {
      family: 'CrewAI',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates CrewAI multi-agent framework',
    };
  }

  if (ua.includes('gemini') || ua.includes('vertexai')) {
    return {
      family: 'Gemini / Google AI',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent matches Google Gemini / Vertex AI',
    };
  }

  if (ua.includes('perplexitybot') || ua.includes('perplexity')) {
    return {
      family: 'Perplexity AI',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent matches Perplexity AI crawler',
    };
  }

  if (ua.includes('copilot') || ua.includes('github-copilot')) {
    return {
      family: 'GitHub Copilot',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent indicates GitHub Copilot agent',
    };
  }

  if (ua.includes('amazonbot')) {
    return {
      family: 'AI Crawler / Scraper',
      isLikelyAiAgent: true,
      confidence: 'medium',
      details: 'Known AI crawler User-Agent',
    };
  }

  // 4. Programmatic HTTP Libraries commonly used by autonomous LLM tool callers
  if (ua.includes('httpx') || ua.includes('python-requests') || ua.includes('aiohttp') || ua.includes('urllib')) {
    return {
      family: 'Python AI Tool Worker',
      isLikelyAiAgent: true,
      confidence: 'medium',
      details: `Python programmatic client: ${userAgent}`,
    };
  }

  if (ua.includes('node-fetch') || ua.includes('undici') || ua.includes('axios') || ua.includes('got/')) {
    return {
      family: 'Node.js Agent Runner',
      isLikelyAiAgent: true,
      confidence: 'medium',
      details: `Node.js HTTP client: ${userAgent}`,
    };
  }

  if (ua.includes('curl') || ua.includes('wget') || ua.includes('go-http-client')) {
    return {
      family: 'CLI Agent / Probe',
      isLikelyAiAgent: false,
      confidence: 'low',
      details: `Command line tool: ${userAgent}`,
    };
  }

  // Check headers for AI or Agent clues (e.g. mcp-session-id, x-agent-*)
  if (headers) {
    if (headers['mcp-session-id'] || headers['x-agent-id'] || headers['x-agent-key']) {
      return {
        family: 'Autonomous Agent (Custom Header)',
        isLikelyAiAgent: true,
        confidence: 'high',
        details: 'Header contains agent tracking metadata',
      };
    }
  }

  return {
    family: 'Generic / Unknown Agent',
    isLikelyAiAgent: false,
    confidence: 'low',
    details: userAgent ? `User-Agent: ${userAgent}` : 'No User-Agent provided',
  };
}

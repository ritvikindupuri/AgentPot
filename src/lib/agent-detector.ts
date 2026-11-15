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

  // 2. Custom AI Agent / Framework User-Agent matching
  if (ua.includes('claude-code') || ua.includes('claudecode') || ua.includes('claude-web') || ua.includes('anthropic')) {
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

  if (ua.includes('gptbot') || ua.includes('chatgpt-user') || ua.includes('openai')) {
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

  if (ua.includes('google-extended') || ua.includes('gemini') || ua.includes('vertexai')) {
    return {
      family: 'Gemini / Google AI',
      isLikelyAiAgent: true,
      confidence: 'high',
      details: 'User-Agent matches Google Gemini / Google-Extended',
    };
  }

  if (ua.includes('perplexity') || ua.includes('perplexitybot')) {
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

  if (ua.includes('bytespider') || ua.includes('cohere') || ua.includes('amazonbot')) {
    return {
      family: 'AI Crawler / Scraper',
      isLikelyAiAgent: true,
      confidence: 'medium',
      details: 'Known AI crawler User-Agent',
    };
  }

  // 3. Programmatic HTTP Libraries commonly used by autonomous LLM tool callers
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

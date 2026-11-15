export type EventType =
  | 'crawl'
  | 'injection_fired'
  | 'tool_call'
  | 'credential_use'
  | 'exfil_attempt'
  | 'mcp_connect'
  | 'tool_discovery';

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type CanaryTechnique =
  | 'hidden_text'
  | 'html_comment'
  | 'markdown_injection'
  | 'zero_width'
  | 'alt_text'
  | 'system_prompt_override'
  | 'credential_leak';

export interface Canary {
  id: string;
  name: string;
  technique: CanaryTechnique;
  location: string;
  planted_action: string;
  planted_payload?: string;
  created_at?: string;
}

export interface PlantedCredential {
  key_id: string;
  key_name: string;
  location: string;
  canary_id?: string;
  created_at?: string;
}

export interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  agent_family: string;
  client_info: Record<string, any>;
  severity_score: number;
  event_count: number;
  first_seen: string;
  last_seen: string;
}

export interface HoneypotEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  canary_id?: string | null;
  agent_family: string;
  source_endpoint: string;
  request_method: string;
  ip_address?: string | null;
  user_agent?: string | null;
  headers: Record<string, any>;
  payload: Record<string, any>;
  severity: EventSeverity;
  created_at: string;
  persisted?: boolean;
  session?: Session;
  canary?: Canary;
}

export interface IngestPayload {
  event_type?: EventType;
  canary_id?: string;
  agent_name?: string;
  source_endpoint?: string;
  payload?: Record<string, any>;
  severity?: EventSeverity;
  details?: string;
}

export interface McpRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface McpRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DAGNode {
  id: string;
  label: string;
  status: NodeStatus;
  type: 'agent' | 'tool';
  parentId?: string;
  startTime?: number;
  endTime?: number;
  [key: string]: unknown;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  startTime: number;
  endTime?: number;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export type ClaudeEvent =
  | { type: 'agent_start'; agentId: string; label: string; parentId?: string }
  | { type: 'agent_end'; agentId: string; result?: string }
  | { type: 'tool_call'; toolId: string; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; result: unknown; status: 'success' | 'error' }
  | { type: 'tool_progress'; toolId: string; message: string }
  | { type: 'token_usage'; usage: TokenUsage }
  | { type: 'error'; message: string }
  | { type: 'session_start'; sessionId: string }
  | { type: 'session_end'; sessionId: string; reason?: string };

// WebSocket 消息格式（服务端 → 客户端）
export interface WSMessage {
  event?: ClaudeEvent;
  sessionId: string;
  timestamp: number;
}

// 服务端 → 客户端：终端原始文本行（直接显示用）
export interface WSTerminalMessage {
  type: 'terminal';
  text: string;
  sessionId: string;
  timestamp: number;
}

// 服务端 → 客户端：终端流式片段（逐块追加，不换行）
export interface WSTerminalChunkMessage {
  type: 'terminalChunk';
  text: string;
  sessionId: string;
  timestamp: number;
}

// WS 客户端 → 服务端消息
export type WSClientMessage =
  | { type: 'start_session'; sessionId: string; projectPath: string; prompt?: string }
  | { type: 'send_input'; sessionId: string; input: string }
  | { type: 'kill_session'; sessionId: string };

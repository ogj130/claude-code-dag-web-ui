export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DAGNode {
  id: string;
  label: string;
  status: NodeStatus;
  type: 'agent' | 'tool' | 'query' | 'summary' | 'rag';
  parentId?: string;
  startTime?: number;
  endTime?: number;
  /** 总结节点：Markdown 格式的总结内容 */
  summaryContent?: string;
  endToolIds?: string[];   // 该 summary 的所有 endTool ID（多边汇聚用）
  /** 工具节点：当前交互提示文字 */
  toolMessage?: string;
  /** RAG 节点：检索到的 chunk 内容 */
  content?: string;
  /** RAG 节点：相似度分数 */
  score?: number;
  /** RAG 节点：来源会话 ID */
  sourceSessionId?: string;
  /** RAG 节点：来源会话标题 */
  sourceSessionTitle?: string;
  /** RAG 节点：时间戳 */
  timestamp?: number;
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
  /** 所属 queryId（用于按 query 过滤工具列表） */
  parentId?: string;
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
  | { type: 'tool_progress'; toolId: string; tool: string; message: string }
  | { type: 'token_usage'; usage: TokenUsage }
  | { type: 'error'; message: string }
  | { type: 'session_start'; sessionId: string }
  | { type: 'session_end'; sessionId: string; reason?: string }
  | { type: 'streamEnd'; queryId?: string }
  | { type: 'user_input_sent'; queryId: string; text: string }
  | { type: 'query_start'; queryId: string; label: string }
  | { type: 'query_end'; queryId: string }
  | { type: 'query_summary'; queryId: string; summary: string; endToolIds?: string[] }
  | { type: 'summary_chunk'; queryId: string; chunk: string };

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

/**
 * RAG 检索结果的数据结构
 * 用于 user_input_sent 事件中的 ragChunks 字段
 */
export interface RAGChunk {
  id: string;
  content: string;
  score: number;
  sourceSessionId: string;
  sourceSessionTitle: string;
  timestamp: number;
}

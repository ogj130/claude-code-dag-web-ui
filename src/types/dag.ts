/**
 * DAG (Directed Acyclic Graph) data types.
 * Used by both the real-time event stream and the storage layer.
 */

/**
 * Node status
 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Node types - V1.4.0 extended with Task, Agent, Compact, Image
 */
export type DAGNodeType = 'agent' | 'tool' | 'query' | 'summary' | 'rag' | 'task' | 'compact' | 'image';

export interface DAGNode {
  id: string;
  label: string;
  status: NodeStatus;
  type: DAGNodeType;
  parentId?: string;
  startTime?: number;
  endTime?: number;
  /** Markdown summary content for summary nodes */
  summaryContent?: string;
  /** All endTool IDs for multi-edge convergence */
  endToolIds?: string[];
  // V1.4.0: Task node properties
  /** Task description for task nodes */
  taskDescription?: string;
  /** Number of child nodes for task/agent nodes */
  childCount?: number;
  // V1.4.0: Agent node properties
  /** Agent name for agent nodes */
  agentName?: string;
  /** Whether the agent node is collapsed */
  collapsed?: boolean;
  // V1.4.0: Compact node properties
  /** Token savings percentage for compact nodes */
  savingsPct?: number;
  /** Token count before compression */
  beforeTokens?: number;
  /** Token count after compression */
  afterTokens?: number;
  // V1.4.0: Image node properties
  /** Base64 image data for image nodes */
  imageData?: string;
  /** Thumbnail image data */
  thumbnailData?: string;
  /** Image MIME type */
  mimeType?: string;
  // V1.4.0: RAG node properties
  /** RAG: Retrieved chunk content */
  content?: string;
  /** RAG: Similarity score */
  score?: number;
  /** RAG: Source session ID */
  sourceSessionId?: string;
  /** RAG: Source session title */
  sourceSessionTitle?: string;
  /** RAG: Timestamp */
  timestamp?: number;
  [key: string]: unknown;
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface DAGData {
  nodes: DAGNode[];
  edges: DAGEdge[];
}

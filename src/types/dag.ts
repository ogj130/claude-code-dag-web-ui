/**
 * DAG (Directed Acyclic Graph) data types.
 * Used by both the real-time event stream and the storage layer.
 */

export interface DAGNode {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: 'agent' | 'tool' | 'query' | 'summary';
  parentId?: string;
  startTime?: number;
  endTime?: number;
  /** Markdown summary content for summary nodes */
  summaryContent?: string;
  /** All endTool IDs for multi-edge convergence */
  endToolIds?: string[];
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

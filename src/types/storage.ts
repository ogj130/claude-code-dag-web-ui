/**
 * 存储层类型定义
 */

/** Session 状态枚举 */
export type SessionStatus = 'active' | 'archived' | 'deleted';

/** Query 状态枚举 */
export type QueryStatus = 'success' | 'error' | 'partial';

/**
 * IndexedDB Session 表记录
 */
export interface DBSession {
  /** 会话唯一 ID */
  id: string;
  /** 会话标题 */
  title: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 查询次数 */
  queryCount: number;
  /** Token 使用量 */
  tokenUsage: number;
  /** 标签列表 */
  tags: string[];
  /** 会话摘要/概要 */
  summary: string;
  /** 会话状态 */
  status: SessionStatus;
  /** 是否已分片（会话数据 > 10MB 时为 true） */
  isSharded?: boolean;
  /** 分片总数（分片会话使用） */
  shardCount?: number;
  /** 访问次数（用于历史召回频率评分） */
  accessCount?: number;
  /** 所属工作区路径 */
  workspacePath?: string;
}

/**
 * IndexedDB Query 表记录
 */
export interface DBQuery {
  /** 查询唯一 ID */
  id: string;
  /** 所属 Session ID */
  sessionId: string;
  /** 用户问题（文本超过 1KB 时使用 LZ-String 压缩存储） */
  question: string;
  /** AI 回答（文本超过 1KB 时使用 LZ-String 压缩存储） */
  answer: string;
  /** 工具调用记录 */
  toolCalls: ToolCall[];
  /** DAG 数据（可为压缩后的 JSON 字符串，读取时自动解压） */
  dag: DAGData | null | string;
  /** Token 使用量 */
  tokenUsage: number;
  /** 执行时长（毫秒） */
  duration: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 查询状态 */
  status: QueryStatus;
  /** 错误信息（仅在 status 为 error 或 partial 时有值） */
  errorMessage?: string;
  /** question 字段是否已压缩 */
  questionCompressed?: boolean;
  /** answer 字段是否已压缩 */
  answerCompressed?: boolean;
  /** DAG 字段是否已压缩 */
  dagCompressed?: boolean;
  /** 访问次数（用于历史召回频率评分） */
  accessCount?: number;
  /** 工作路径（用于按工作路径过滤统计） */
  projectPath?: string;
}

/**
 * 工具调用记录
 */
export interface ToolCall {
  /** 工具调用唯一 ID */
  id: string;
  /** 所属 Query ID */
  queryId: string;
  /** 所属 Session ID */
  sessionId?: string;
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  arguments: Record<string, unknown>;
  /** 调用结果 */
  result?: unknown;
  /** 开始时间戳 */
  startTime: number;
  /** 结束时间戳 */
  endTime: number;
  /** 调用状态 */
  status?: 'success' | 'error' | 'pending';
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * DAG 数据结构
 */
export interface DAGData {
  /** DAG 节点列表 */
  nodes: DAGNode[];
  /** DAG 边列表 */
  edges: DAGEdge[];
  /** DAG 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * DAG 节点
 */
export interface DAGNode {
  /** 节点 ID */
  id: string;
  /** 节点类型 */
  type: string;
  /** 节点数据 */
  data: Record<string, unknown>;
  /** 位置坐标 */
  position?: { x: number; y: number };
}

/**
 * DAG 边
 */
export interface DAGEdge {
  /** 边 ID */
  id: string;
  /** 源节点 ID */
  source: string;
  /** 目标节点 ID */
  target: string;
  /** 边标签 */
  label?: string;
}

/**
 * 存储空间信息
 */
export interface StorageInfo {
  /** 已使用空间（字节） */
  used: number;
  /** 可用空间（字节） */
  available: number;
  /** 是否接近满（警告阈值：剩余空间不足 50MB） */
  isNearFull: boolean;
  /** 使用百分比 */
  usagePercent: number;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  /** 页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  pageSize: number;
}

/**
 * 分页查询结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasMore: boolean;
}

/**
 * 创建 Session 的输入参数
 */
export interface CreateSessionInput {
  /** 会话标题 */
  title: string;
  /** 标签列表（可选） */
  tags?: string[];
}

/**
 * 更新 Session 的输入参数
 */
export interface UpdateSessionInput {
  /** 会话标题 */
  title?: string;
  /** 标签列表 */
  tags?: string[];
  /** 会话摘要 */
  summary?: string;
  /** 会话状态 */
  status?: SessionStatus;
  /** Token 使用量（增量） */
  tokenUsageIncrement?: number;
  /** 查询次数（增量） */
  queryCountIncrement?: number;
  /** 是否已分片 */
  isSharded?: boolean;
  /** 分片数量 */
  shardCount?: number;
}

/**
 * 创建 Query 的输入参数
 */
export interface CreateQueryInput {
  /** 所属 Session ID */
  sessionId: string;
  /** 用户问题 */
  question: string;
  /** AI 回答 */
  answer: string;
  /** 工具调用记录 */
  toolCalls?: ToolCall[];
  /** DAG 数据 */
  dag?: DAGData | null;
  /** Token 使用量 */
  tokenUsage: number;
  /** 执行时长 */
  duration: number;
  /** 查询状态 */
  status: QueryStatus;
  /** 错误信息 */
  errorMessage?: string;
  /** 工作路径（用于按路径过滤统计） */
  projectPath?: string;
}

/**
 * 会话分片记录（单会话超过 10MB 时使用）
 */
export interface SessionShard {
  /** 分片 ID，格式：{sessionId}_shard_{index} */
  id: string;
  /** 所属 Session ID */
  sessionId: string;
  /** 分片索引，从 0 开始 */
  shardIndex: number;
  /** LZ-String 压缩后的分片数据（JSON 字符串） */
  data: string;
  /** 原始未压缩数据大小（字节） */
  originalSize: number;
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 压缩内容标记 — 用于识别已压缩的字段
 * 当字段值以 '\x00COMPRESSED:\x00' 前缀开头时表示已压缩
 */
export const COMPRESSED_MARKER = '\x00COMPRESSED:\x00';

/**
 * 检查字段值是否已压缩
 */
export function isFieldCompressed(value: string): boolean {
  return typeof value === 'string' && value.startsWith(COMPRESSED_MARKER);
}

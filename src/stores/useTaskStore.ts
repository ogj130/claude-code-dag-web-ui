import React from 'react';
import { create } from 'zustand';
import type { DAGNode, ToolCall as EventToolCall, TokenUsage, ClaudeEvent, RAGChunk } from '../types/events';
import { createQuery, updateQueryTokenUsage } from './queryStorage';
import { useSessionStore } from './useSessionStore';
import type { ToolCall as StorageToolCall } from '@/types/storage';
import type { PendingAttachment } from '../types/attachment';

// V1.4.1: Reuse PendingAttachment from attachment types (status/createdAt optional)
export type { PendingAttachment } from '../types/attachment';
export interface PendingAttachmentData extends PendingAttachment {}

export interface MarkdownCardData {
  id: string;
  queryId: string;       // 该卡片关联的 query ID（用于绑定工具）
  timestamp: number;
  query: string;         // 用户问题
  analysis: string;      // AI 分析过程（Markdown）
  summary?: string;      // 最终总结（无工具调用时可能为空）
  completeSummary?: string; // 完整总结（用于流式补完动画：summary 先显示流式内容，再动画补完到 completeSummary）
  tokenUsage?: number;  // 单次查询 Token 消耗
  ragChunks?: RAGChunk[]; // 历史召回的 RAG chunks
  attachments?: PendingAttachmentData[]; // V1.4.1: 附件列表
}

// 进行中的问答卡片（实时更新）
export interface CurrentCardData {
  queryId: string;
  query: string;       // 用户问题文本
  timestamp: number;
  summary?: string;    // 总结到来时追加
  isCollapsed?: boolean;  // 是否折叠（发送新问题时，前一个进行中的卡片标记为折叠）
  /** RAG 检索结果（来自 user_input_sent JSON payload） */
  ragChunks?: Array<{
    id: string;
    content: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>;
  /** V1.4.1: 附件列表 */
  attachments?: PendingAttachmentData[];
}

interface TaskState {
  nodes: Map<string, DAGNode>;
  toolCalls: EventToolCall[];
  toolProgressMessages: Map<string, string>; // toolId → 累积的 progress 文本
  tokenUsage: TokenUsage;
  terminalLines: string[];
  terminalChunks: string[];
  summaryChunks: string[];
  streamEndPending: boolean;
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  currentQueryId: string | null;
  pendingInputsCount: number;
  markdownCards: MarkdownCardData[];
  processCollapsed: boolean;
  pendingQuery: string;     // 当前问题的文本
  pendingAnalysisByQueryId: Map<string, string>;  // 按 queryId 隔离的分析内容
  lastSummaryNodeId: string | null;  // 最后一个 summary 节点 ID，用于串联 query
  collapsedDagQueryIds: Set<string>;  // DAG 中已折叠的 queryId
  lastCompletedQueryId: string | null; // 最后一个进入 running 的 queryId（用于自动折叠）
  collapsedCardIds: Set<string>;  // 已叠起的卡片ID集合
  currentCard: CurrentCardData | null;  // 进行中的问答卡片（实时显示）
  previousCard: CurrentCardData | null;  // 前一个被折叠的进行中卡片（等待总结到来）
  /** 按 workspaceId 隔离的 currentCard（多工作区 global dispatch 时防止互相覆盖） */
  currentCardByWorkspace: Record<string, CurrentCardData>;
  /** 按 workspaceId 隔离的 previousCard */
  previousCardByWorkspace: Record<string, CurrentCardData>;
  groupingEnabled: boolean;  // 节点分组开关
  expandedGroupIds: Set<string>;  // 已展开的分组 ID 集合
  // V1.4.0: Agent Group collapse state
  collapsedAgentIds: Set<string>;  // 已折叠的 Agent Group ID 集合
  lastTokenUsage: number;  // 最近一次查询的 Token 消耗（保留兼容）
  /** 按 queryId 隔离的 token 消耗（解决 query_summary 先于 token_usage 到达的时序问题） */
  tokenUsageByQueryId: Map<string, number>;
  /** query_summary 已落库时，event queryId → 生成的 DB query ID 映射（供 token_usage 到达后更新 tokenUsage） */
  savedQueryIdByEventQueryId: Map<string, string>;
  /** token_usage 先到达时，event queryId → 待更新的 tokenUsage（saveQueryToDB 完成后检查并应用） */
  pendingTokenUsageUpdate: Map<string, number>;
  /** 最近一次 query_summary 事件的 queryId（currentQueryId 被清空后，作为 token_usage 的 fallback） */
  lastEventQueryId: string | null;
  /** 待添加到 DAG 的 RAG 检索结果（下次 query_start 时消费） */
  pendingRAGItems: Array<{
    id: string;
    content: string;
    summary: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>;
  /** V1.4.1: 待添加到 DAG 的附件（下次 query_start 时消费） */
  pendingAttachments: PendingAttachmentData[];
  /** V1.4.1: 各 query 的附件数量（用于 DAG 节点徽章显示） */
  attachmentCountByQueryId: Map<string, number>;
  /** V1.4.1: 各 query 的完整附件数据（用于 DAG 节点内渲染附件列表） */
  attachmentDataByQueryId: Map<string, PendingAttachmentData[]>;

  handleEvent: (event: ClaudeEvent) => void;
  addTerminalLine: (line: string) => void;
  addTerminalChunk: (fragment: string) => void;
  addSummaryChunk: (chunk: string) => void;
  clearSummaryChunks: () => void;
  clearStreamEnd: () => void;
  updatePendingInputsCount: (count: number) => void;
  addMarkdownCard: (card: MarkdownCardData) => void;
  toggleProcessCollapsed: (collapsed: boolean) => void;
  toggleDagQueryCollapse: (queryId: string) => void;  // 手动折叠/展开 DAG query
  collapseAllDagQueries: () => void;  // 折叠全部 DAG query 节点
  expandAllDagQueries: () => void;  // 展开全部 DAG query 节点
  // V1.4.0: Agent Group collapse
  collapseAllAgentGroups: () => void;  // 折叠全部 Agent Group 节点
  expandAllAgentGroups: () => void;  // 展开全部 Agent Group 节点
  toggleGrouping: () => void;  // 切换节点分组开关
  toggleGroupExpand: (groupId: string) => void;  // 切换分组展开/折叠
  collapseAllGroups: () => void;  // 折叠全部工具分组
  // V1.4.0: Agent Group collapse
  setCollapsedAgentIds: (updater: React.SetStateAction<Set<string>>) => void;  // 设置折叠状态
  addRAGNodes: (queryId: string, ragItems: Array<{
    id: string;
    content: string;
    summary: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>) => void;  // 添加 RAG 节点
  setPendingRAGItems: (items: Array<{
    id: string;
    content: string;
    summary: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>) => void;  // 设置待消费的 RAG 项目
  setPendingAttachments: (items: PendingAttachmentData[]) => void;  // V1.4.1: 设置待消费的附件
  reset: () => void;
}

// ── 辅助函数：从终端输出中移除附件列表内容 ─────────────────────────────

/**
 * 过滤掉终端输出中的附件列表部分，避免文件内容展示到 analysis 中
 * 后端会以 Markdown 列表形式回显 attachments，格式如下：
 * ## 附件
 * - 📎 filename.md
 * - 🖼 image.png
 * 我们把整个附件列表块从输出中移除，附件通过 card.attachments 单独展示
 */
function filterAttachmentListFromAnalysis(analysis: string): string {
  // 匹配 "## 附件" 或 "**附件**" 开头的 Markdown 列表块，直到下一个 ## 标题或文档末尾
  return analysis
    // 移除 "## 附件" 标题 + 跟随的无序列表
    .replace(/^#{1,3}\s*[,，]?\s*附件[^\n]*\n((?:[-*+]\s+.+\n?)*)/gm, '')
    // 移除 "**附件**" 标题 + 跟随的无序列表
    .replace(/^\*\*(?:附件|Attach|Files)\*\*[^\n]*\n((?:[-*+]\s+.+\n?)*)/gim, '')
    // 移除行内附件列表（单独一行的列表）
    .replace(/^[-*+]\s+📎\s+.+\n/gm, '')
    .replace(/^[-*+]\s+🖼\s+.+\n/gm, '')
    // 移除常见的 "已上传文件:" 格式
    .replace(/^\*\*已上传文件\*\*:?\s*\n((?:[-*+]\s+.+\n?)*)/gm, '')
    // 清理多余的空行
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── 辅助函数：将 Query 数据保存到 IndexedDB ──────────────────────────────

/**
 * 将完成的 Query 保存到 IndexedDB（用于分析统计）
 */
async function saveQueryToDB(params: {
  queryId: string;
  question: string;
  answer: string;
  toolCalls: EventToolCall[];
  duration: number;
  status: 'success' | 'error' | 'partial';
}, currentQueryId: string): Promise<string | undefined> {
  try {
    const sessionId = useSessionStore.getState().activeSessionId;
    if (!sessionId) {
      console.warn('[TaskStore] No active session, skipping DB save');
      return undefined;
    }

    const sessions = useSessionStore.getState().sessions;
    const session = sessions.find(s => s.id === sessionId);
    const projectPath = session?.projectPath ?? '';

    // 优先按 queryId 精确读取 tokenUsage（解决 query_summary 先于 token_usage 到达的时序问题）
    // 注意：必须每次从 store 重新读取，避免闭包捕获旧 Map 引用
    const tokenUsage = useTaskStore.getState().tokenUsageByQueryId.get(currentQueryId)
      ?? useTaskStore.getState().lastTokenUsage;

    const storageToolCalls: StorageToolCall[] = params.toolCalls.map((tc, index) => ({
      id: tc.id || `tc_${params.queryId}_${index}`,
      queryId: params.queryId,
      name: tc.tool,
      arguments: tc.args || {},
      result: tc.result,
      startTime: tc.startTime || Date.now(),
      endTime: tc.endTime || Date.now(),
      success: tc.status === 'completed' || tc.status === 'running',
    }));

    const record = await createQuery({
      sessionId,
      question: params.question,
      answer: params.answer,
      toolCalls: storageToolCalls,
      tokenUsage,
      duration: params.duration,
      status: params.status,
      workspacePath: projectPath,
    });

    console.info('[TaskStore] Saved query to DB:', params.queryId, 'tokenUsage:', tokenUsage, '-> record.id:', record.id);

    // 记录 event queryId → 生成的 DB record ID，供 token_usage 到达后做 update
    const newMap = new Map(useTaskStore.getState().savedQueryIdByEventQueryId);
    newMap.set(params.queryId, record.id);
    useTaskStore.setState({ savedQueryIdByEventQueryId: newMap });

    // 检查是否有 pending 的 tokenUsage 更新（token_usage 先于 query_summary 到达的情况）
    const pendingTokens = useTaskStore.getState().pendingTokenUsageUpdate.get(params.queryId);
    if (pendingTokens !== undefined && pendingTokens > 0) {
      console.info('[TaskStore] Applying pending tokenUsage update:', pendingTokens, 'for record.id:', record.id);
      updateQueryTokenUsage(record.id, pendingTokens).catch(err =>
        console.warn('[TaskStore] pending tokenUsage update failed:', err)
      );
      // 消费后清除 pending 标记
      const newPending = new Map(useTaskStore.getState().pendingTokenUsageUpdate);
      newPending.delete(params.queryId);
      useTaskStore.setState({ pendingTokenUsageUpdate: newPending });
    }

    return record.id;
  } catch (error) {
    console.error('[TaskStore] Failed to save query to DB:', error);
    return undefined;
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: new Map(),
  toolCalls: [],
  toolProgressMessages: new Map(),
  tokenUsage: { input: 0, output: 0 },
  terminalLines: [],
  terminalChunks: [],
  summaryChunks: [],
  streamEndPending: false,
  isRunning: false,
  isStarting: false,
  error: null,
  currentQueryId: null,
  pendingInputsCount: 0,
  markdownCards: [],
  processCollapsed: false,
  pendingQuery: '',
  pendingAnalysisByQueryId: new Map(),
  lastSummaryNodeId: null,
  collapsedDagQueryIds: new Set(),
  lastCompletedQueryId: null,
  collapsedCardIds: new Set(),
  currentCard: null,
  previousCard: null,
  currentCardByWorkspace: {},  // 按 workspaceId 隔离的 currentCard
  previousCardByWorkspace: {}, // 按 workspaceId 隔离的 previousCard
  groupingEnabled: true,  // 默认开启节点分组
  expandedGroupIds: new Set(),  // 默认全部折叠
  // V1.4.0: Agent Group collapse
  collapsedAgentIds: new Set(),  // 默认全部展开
  lastTokenUsage: 0,
  tokenUsageByQueryId: new Map(),
  savedQueryIdByEventQueryId: new Map(),
  pendingTokenUsageUpdate: new Map(),
  lastEventQueryId: null,
  pendingRAGItems: [],
  pendingAttachments: [],  // V1.4.1
  attachmentCountByQueryId: new Map(),  // V1.4.1
  attachmentDataByQueryId: new Map(),  // V1.4.1

  handleEvent: (event: ClaudeEvent) => {
    if (event.type === 'summary_chunk') {
      const s = get();
      console.log('[Store] ✅ summary_chunk:', event.chunk?.slice(0, 30), '| queryId:', event.queryId, '| chunks len:', s.summaryChunks.length);
    }
    // 从事件中提取 workspaceId（dispatch 发出的事件带有此标记，用于隔离各工作区的 DAG 节点）
    const workspaceId = (event as unknown as { workspaceId?: string }).workspaceId;
    const { nodes, toolCalls } = get();

    switch (event.type) {
      case 'streamEnd': {
        const { terminalChunks } = get();
        const rawAnalysis = terminalChunks.join('');
        const analysis = filterAttachmentListFromAnalysis(rawAnalysis);
        const queryId = event.queryId ?? get().currentQueryId ?? 'unknown';
        const newMap = new Map(get().pendingAnalysisByQueryId);
        newMap.set(queryId, analysis);
        set({
          streamEndPending: true,
          terminalChunks: [],
          // summaryChunks 不清空，等 query_summary 到达时再清（流式总结要等最终结果才收尾）
          processCollapsed: true,
          pendingAnalysisByQueryId: newMap,
        });
        break;
      }
      case 'session_start': {
        const newNodes = new Map(nodes);
        const mainNode: DAGNode = {
          id: 'main-agent',
          label: 'Claude Agent',
          status: 'running',
          type: 'agent',
          startTime: Date.now(),
          ...(workspaceId ? { workspaceId } : {}),
        };
        newNodes.set('main-agent', mainNode);
        set({ isStarting: false, isRunning: true, error: null, nodes: newNodes, lastSummaryNodeId: null });
        break;
      }
      case 'error': {
        set({ isStarting: false, isRunning: false, error: event.message });
        break;
      }
      case 'agent_start': {
        const newNodes = new Map(nodes);
        const newNode: DAGNode = {
          id: event.agentId,
          label: event.label,
          status: 'running',
          type: 'agent',
          parentId: event.parentId,
          startTime: Date.now(),
          ...(workspaceId ? { workspaceId } : {}),
        };
        newNodes.set(event.agentId, newNode);
        set({ nodes: newNodes, isRunning: true });
        break;
      }
      case 'agent_end': {
        const newNodes = new Map(nodes);
        const node = newNodes.get(event.agentId);
        if (node) {
          newNodes.set(event.agentId, { ...node, status: 'completed', endTime: Date.now() });
        }
        set({ nodes: newNodes });
        break;
      }
      case 'tool_call': {
        const currentQueryId = get().currentQueryId;
        const toolCall: EventToolCall = {
          id: event.toolId,
          tool: event.tool,
          args: event.args,
          status: 'running',
          startTime: Date.now(),
          parentId: currentQueryId ?? 'main-agent',
        };
        // 同时创建 DAG node（parentId 关联当前 query node）
        const newNodes = new Map(nodes);
        const toolNode: DAGNode = {
          id: event.toolId,
          label: event.tool,
          status: 'running',
          type: 'tool',
          parentId: currentQueryId ?? 'main-agent',
          startTime: Date.now(),
          args: event.args,
          ...(workspaceId ? { workspaceId } : {}),
        };
        newNodes.set(event.toolId, toolNode);
        set({ toolCalls: [...toolCalls, toolCall], nodes: newNodes });
        break;
      }
      case 'tool_result': {
        const idx = toolCalls.findIndex(t => t.id === event.toolId || t.id === 'last');
        if (idx >= 0) {
          const updated = [...toolCalls];
          updated[idx] = {
            ...updated[idx],
            status: event.status === 'success' ? 'completed' : 'error',
            result: String(event.result),
            endTime: Date.now(),
          };
          // 同时更新 DAG node 状态
          const newNodes = new Map(nodes);
          const node = newNodes.get(event.toolId);
          if (node) {
            const nodeStatus = event.status === 'success' ? 'completed' : 'failed';
            newNodes.set(event.toolId, { ...node, status: nodeStatus, endTime: Date.now() });
          }
          set({ toolCalls: updated, nodes: newNodes });
        }
        break;
      }
      case 'tool_progress': {
        set(state => {
          const m = new Map(state.toolProgressMessages);
          m.set(event.toolId, event.message);
          // 同时更新 DAG 节点 data 中的 toolMessage（触发 DAG 重渲染）
          const newNodes = new Map(state.nodes);
          const node = newNodes.get(event.toolId);
          if (node) {
            newNodes.set(event.toolId, { ...node, toolMessage: event.message });
          }
          return { toolProgressMessages: m, nodes: newNodes };
        });
        break;
      }
      case 'token_usage': {
        const totalTokens = event.usage.input + event.usage.output;
        // currentQueryId 可能在 query_summary 后被清空，使用 lastEventQueryId 作为 fallback
        const resolvedQueryId = get().currentQueryId ?? get().lastEventQueryId;
        // 按 queryId 隔离存储，解决 query_summary 先于 token_usage 到达的时序问题
        const newTokenMap = new Map(get().tokenUsageByQueryId);
        if (resolvedQueryId) {
          newTokenMap.set(resolvedQueryId, totalTokens);
        }
        // 记录 pending 更新：saveQueryToDB 完成后会检查此 Map 并回写 DB
        // 即使 queryId 为 null（query_summary 已清空 currentQueryId），也要用 __latest__ 标记
        // 以便后续 saveQueryToDB 能通过 savedQueryIdByEventQueryId 的映射找到正确 record
        const newPendingMap = new Map(get().pendingTokenUsageUpdate);
        if (resolvedQueryId) {
          newPendingMap.set(resolvedQueryId, totalTokens);
        } else {
          // currentQueryId 和 lastEventQueryId 均为 null（query_summary 已处理完）
          // 用 __latest__ 作为 fallback key，saveQueryToDB 会忽略它（key 不在 savedQueryIdByEventQueryId 中）
          newPendingMap.set('__latest__', totalTokens);
        }
        set({
          tokenUsage: event.usage,
          lastTokenUsage: totalTokens,
          tokenUsageByQueryId: newTokenMap,
          pendingTokenUsageUpdate: newPendingMap,
        });

        // 若 query_summary 已先落库（savedRecordId 已存在），直接在此更新
        // 遍历所有已保存的 query record，尝试应用 pending 的 tokenUsage
        for (const [eventQueryId, savedRecordId] of get().savedQueryIdByEventQueryId) {
          const pendingTokens = get().pendingTokenUsageUpdate.get(eventQueryId);
          if (pendingTokens !== undefined && pendingTokens > 0) {
            updateQueryTokenUsage(savedRecordId, pendingTokens).catch(err =>
              console.warn('[TaskStore] token_usage DB update failed:', err)
            );
            // 消费后清除 pending 标记
            newPendingMap.delete(eventQueryId);
          }
        }
        if (newPendingMap.size < get().pendingTokenUsageUpdate.size) {
          set({ pendingTokenUsageUpdate: newPendingMap });
        }
        break;
      }
      case 'session_end': {
        set({ isRunning: false });
        break;
      }
      case 'user_input_sent': {
        // ── 防止 StrictMode 双 WS 连接导致重复创建 currentCard ──────
        // 两个 WS 同时收到 user_input_sent 时，第一个已创建 currentCard，
        // 第二个到达时跳过，避免出现两条"实时处理中"卡片
        const existingCard = get().currentCard;
        if (existingCard && existingCard.queryId === event.queryId) {
          console.log('[Store] ⏭ user_input_sent 重复，跳过（StrictMode 双 WS）', { queryId: event.queryId });
          break;
        }

        // ── 尝试解析 JSON 格式（query + ragChunks）─────────────
        let queryText = event.text;
        let ragChunks: NonNullable<CurrentCardData['ragChunks']> = [];

        try {
          const parsed = JSON.parse(event.text);
          // V1.4.1: 先提取 query（payload 格式固定有 query，attachments 是可选的）
          if (parsed.query !== undefined) {
            queryText = String(parsed.query ?? '');
          }
          // ragChunks 独立判断（有 RAG 上下文时才解析）
          if (Array.isArray(parsed.ragChunks)) {
            ragChunks = parsed.ragChunks.map((chunk: { id: string; content: string; score: number; sourceSessionId: string; sourceSessionTitle: string; timestamp: number }) => ({
              id: chunk.id,
              content: chunk.content,
              score: chunk.score,
              sourceSessionId: chunk.sourceSessionId,
              sourceSessionTitle: chunk.sourceSessionTitle,
              timestamp: chunk.timestamp,
            }));
          }
        } catch {
          // 非 JSON 格式，保持原 text 作为普通 query
        }

        const newNodesU = new Map(nodes);
        const qNodeU = newNodesU.get(event.queryId);
        if (qNodeU) {
          newNodesU.set(event.queryId, { ...qNodeU, label: queryText });
        }

        // 叠起前一个已完成的卡片
        const newCollapsedCards = new Set(get().collapsedCardIds);
        const allCards = get().markdownCards;
        if (allCards.length > 0) {
          newCollapsedCards.add(allCards[allCards.length - 1].queryId);
        }

        const prevCurrentCard = get().currentCard;
        const newPreviousCard = prevCurrentCard ?? null;
        const newCurrentCard: CurrentCardData = {
          queryId: event.queryId,
          query: queryText,
          timestamp: Date.now(),
          ragChunks: ragChunks.length > 0 ? ragChunks : undefined,
        };

        // ── 按 workspaceId 隔离 currentCard（多工作区 global dispatch 时防止互相覆盖）──
        const wid = workspaceId ?? 'default';
        // 当前工作区的旧卡片（用于归档到 previousCard）
        const prevWorkspaceCard = get().currentCardByWorkspace[wid] ?? null;
        // 只更新当前工作区的卡片，保留其他工作区的卡片不被覆盖
        const newCurrentCardByWorkspace = { ...get().currentCardByWorkspace, [wid]: newCurrentCard };
        const newPreviousCardByWorkspace = { ...get().previousCardByWorkspace };
        if (prevWorkspaceCard) {
          newPreviousCardByWorkspace[wid] = prevWorkspaceCard;
        }

        // ── 设置 pendingRAGItems（供 query_start 消费，渲染 DAG RAG 节点）─────────
        if (ragChunks.length > 0) {
          get().setPendingRAGItems(ragChunks.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            summary: chunk.content.slice(0, 100),
            score: chunk.score,
            sourceSessionId: chunk.sourceSessionId,
            sourceSessionTitle: chunk.sourceSessionTitle,
            timestamp: chunk.timestamp,
          })));
        }

        set({
          currentQueryId: event.queryId,
          isRunning: true,
          pendingQuery: queryText,
          nodes: newNodesU,
          currentCard: newCurrentCard,
          previousCard: newPreviousCard,
          currentCardByWorkspace: newCurrentCardByWorkspace,
          previousCardByWorkspace: newPreviousCardByWorkspace,
          collapsedCardIds: newCollapsedCards,
        });
        break;
      }
      case 'query_start': {
        const newNodesQ = new Map(nodes);
        const queryNode: DAGNode = {
          id: event.queryId,
          label: event.label,
          status: 'running',
          type: 'query',
          // 串联：第一个 query 从 main-agent 出，后续从上一个 summary 出
          parentId: get().lastSummaryNodeId ?? 'main-agent',
          startTime: Date.now(),
          ...(workspaceId ? { workspaceId } : {}),
        };
        newNodesQ.set(event.queryId, queryNode);

        // ── 自动添加 RAG 节点（来自 pendingRAGItems）──────────────
        const pendingItems = get().pendingRAGItems;
        pendingItems.forEach((item, index) => {
          const ragNodeId = `rag_${event.queryId}_${index}`;
          newNodesQ.set(ragNodeId, {
            id: ragNodeId,
            label: 'RAG',
            status: 'completed',
            type: 'rag',
            parentId: event.queryId,
            content: item.content,
            score: item.score,
            sourceSessionId: item.sourceSessionId,
            sourceSessionTitle: item.sourceSessionTitle,
            timestamp: item.timestamp,
            ...(workspaceId ? { workspaceId } : {}),
          });
        });

        // V1.4.1: 记录附件数据到 queryId 映射（用于 DAG 节点内渲染附件列表）
        const pendingAttachments = get().pendingAttachments;
        const newAttachmentCountMap = new Map(get().attachmentCountByQueryId);
        const newAttachmentDataMap = new Map(get().attachmentDataByQueryId);
        if (pendingAttachments.length > 0) {
          newAttachmentCountMap.set(event.queryId, pendingAttachments.length);
          newAttachmentDataMap.set(event.queryId, [...pendingAttachments]);
        }

        // 自动折叠前一个已完成的 query（DAG）
        const prevQueryId = get().lastCompletedQueryId;
        const newCollapsedDagQueryIds = new Set(get().collapsedDagQueryIds);
        if (prevQueryId && prevQueryId !== event.queryId) {
          newCollapsedDagQueryIds.add(prevQueryId);
        }

        // 记录当前 query 为"最后一个进入 running 的 query"
        const lastCompletedQueryId = get().currentQueryId;

        set({
          nodes: newNodesQ,
          currentQueryId: event.queryId,
          collapsedDagQueryIds: newCollapsedDagQueryIds,
          lastCompletedQueryId,
          isRunning: true,
          pendingRAGItems: [],  // 消费后清除
          pendingAttachments: [],  // V1.4.1: 消费后清除
          attachmentCountByQueryId: newAttachmentCountMap,  // V1.4.1
          attachmentDataByQueryId: newAttachmentDataMap,  // V1.4.1
        });
        break;
      }
      case 'query_end': {
        const newNodesQE = new Map(nodes);
        const qNode = newNodesQE.get(event.queryId);
        if (qNode) {
          newNodesQE.set(event.queryId, { ...qNode, status: 'completed', endTime: Date.now() });
        }
        set({ nodes: newNodesQE });
        break;
      }
      case 'summary_chunk': {
        // 追加到 DAG 总结节点（DAG 图实时更新）
        const newNodesSC = new Map(nodes);
        const summaryNodeId = `${event.queryId}_summary`;
        const existingNode = newNodesSC.get(summaryNodeId);

        if (existingNode) {
          // 追加 chunk 到已有 summary 节点
          newNodesSC.set(summaryNodeId, {
            ...existingNode,
            summaryContent: (existingNode.summaryContent ?? '') + event.chunk,
          });
        } else {
          // 第一个 chunk：创建 summary 节点（running 状态）
          const summaryNode: DAGNode = {
            id: summaryNodeId,
            label: '总结',
            status: 'running',
            type: 'summary',
            parentId: event.queryId,
            startTime: Date.now(),
            summaryContent: event.chunk,
            ...(workspaceId ? { workspaceId } : {}),
          };
          newNodesSC.set(summaryNodeId, summaryNode);
        }

        // 同时写入 summaryChunks，让 LiveCard 流式渲染
        // ── 幂等保护：防止双 WS 连接（globalDispatch + terminal）处理同一 session 时重复追加 ──
        set(state => {
          // 两个 WS 连接收到相同的 summary_chunk 时，最后一个 chunk 必然相同
          const lastChunk = state.summaryChunks[state.summaryChunks.length - 1];
          if (lastChunk === event.chunk) {
            return { nodes: newNodesSC }; // 跳过重复追加
          }
          return { nodes: newNodesSC, summaryChunks: [...state.summaryChunks, event.chunk] };
        });
        break;
      }
      case 'query_summary': {
        const { pendingAnalysisByQueryId, toolCalls, lastTokenUsage, summaryChunks } = get();
        // ── 多工作区隔离：优先从 workspace-specific 状态查找卡片 ──────────────────
        const wid = workspaceId ?? 'default';
        const workspaceCards = get().currentCardByWorkspace;
        const workspacePrevCards = get().previousCardByWorkspace;
        const wsCurrentCard = workspaceCards[wid] ?? null;
        const wsPrevCard = workspacePrevCards[wid] ?? null;

        // 幂等保护：同一 query 已经生成过 markdownCard 时，忽略重复的 query_summary
        if (get().markdownCards.some(card => card.queryId === event.queryId)) {
          const existingSummaryNodeId = `${event.queryId}_summary`;
          const existingNodes = new Map(nodes);
          const existingSummaryNode = existingNodes.get(existingSummaryNodeId);
          if (existingSummaryNode) {
            existingNodes.set(existingSummaryNodeId, {
              ...existingSummaryNode,
              status: 'completed',
              summaryContent: event.summary,
              endTime: Date.now(),
            });
          }
          set({
            nodes: existingNodes,
            lastSummaryNodeId: existingSummaryNodeId,
            lastEventQueryId: event.queryId,
            summaryChunks: [],
            currentQueryId: get().currentQueryId === event.queryId ? null : get().currentQueryId,
            previousCard: get().previousCard?.queryId === event.queryId ? null : get().previousCard,
          });
          break;
        }
        // 提取流式累积内容（在 summaryChunks 被清空之前）
        const streamedSummary = summaryChunks.join('');
        const analysis = pendingAnalysisByQueryId.get(event.queryId) ?? '';
        const newMap = new Map(pendingAnalysisByQueryId);
        newMap.delete(event.queryId);
        const newNodesQS = new Map(nodes);
        const summaryNodeId = `${event.queryId}_summary`;

        // 如果 summary 节点已存在（流式创建），只更新 status 和完整内容
        const existingSummary = newNodesQS.get(summaryNodeId);
        if (existingSummary) {
          newNodesQS.set(summaryNodeId, {
            ...existingSummary,
            status: 'completed',
            summaryContent: event.summary,
            endTime: Date.now(),
          });
        } else {
          // 兼容旧流程：一次性创建 summary 节点
          const summaryNode: DAGNode = {
            id: summaryNodeId,
            label: '总结',
            status: 'completed',
            type: 'summary',
            parentId: event.endToolIds?.at(-1) ?? event.queryId,
            endToolIds: event.endToolIds,
            startTime: Date.now(),
            endTime: Date.now(),
            summaryContent: event.summary,
          };
          newNodesQS.set(summaryNodeId, summaryNode);
        }
        const qNode2 = newNodesQS.get(event.queryId);
        if (qNode2) {
          newNodesQS.set(event.queryId, { ...qNode2, status: 'completed' });
        }
        for (const [toolId, toolNode] of newNodesQS.entries()) {
          if (toolNode.type === 'tool' && toolNode.parentId === event.queryId && toolNode.status === 'running') {
            newNodesQS.set(toolId, { ...toolNode, status: 'completed', endTime: Date.now() });
          }
        }
        const toolIdsForQuery: string[] = [];
        for (const [toolId, toolNode] of newNodesQS.entries()) {
          if (toolNode.type === 'tool' && toolNode.parentId === event.queryId && toolNode.status === 'completed') {
            toolIdsForQuery.push(toolId);
          }
        }
        const updatedToolCalls = toolCalls.map(tc => {
          if (toolIdsForQuery.includes(tc.id) && tc.status === 'running') {
            return { ...tc, status: 'completed' as const, endTime: Date.now() };
          }
          return tc;
        });
        const queryNode = newNodesQS.get(event.queryId);
        const queryText = queryNode?.label ?? get().pendingQuery;

        // 统一从 store 读取最新状态，避免闭包陈旧值
        const { currentCard: inProgressCard, previousCard, collapsedCardIds, markdownCards } = get();
        const newCollapsedCardIds = new Set(collapsedCardIds);
        let newMarkdownCardId: string;

        // ── 匹配逻辑：优先检查 workspace-specific 卡片（多工作区 global dispatch 场景）──
        // 注意：global dispatch 复用相同 session 时，workspaceId 会被注入到事件中，
        // 使各工作区的卡片互相隔离。优先检查 workspace-specific 卡片，再回退到全局卡片。
        const cardForQuery = wsCurrentCard?.queryId === event.queryId ? wsCurrentCard
          : inProgressCard?.queryId === event.queryId ? inProgressCard
          : null;
        const prevCardForQuery = wsPrevCard?.queryId === event.queryId ? wsPrevCard
          : previousCard?.queryId === event.queryId ? previousCard
          : null;

        if (cardForQuery) {
          // 情况1：当前卡片（正常流程，含 workspace-specific）
          newMarkdownCardId = `card_${cardForQuery.timestamp}_${event.queryId}`;
          // 折叠前一张已完成的卡片
          if (markdownCards.length > 0) {
            newCollapsedCardIds.add(markdownCards[markdownCards.length - 1].queryId);
          }
          // 清除 workspace-specific 卡片
          const newWsCards = { ...workspaceCards };
          const newWsPrevCards = { ...workspacePrevCards };
          delete newWsCards[wid];
          if (wsCurrentCard) newWsPrevCards[wid] = wsCurrentCard; // 归档到 workspace 的 prev
          // ── 多工作区保护：只有当 workspace-specific 卡片等于全局 currentCard 时才清空 ──
          // 否则保留全局 currentCard（可能是其他工作区的卡片）
          const isGlobalCard = cardForQuery === inProgressCard;
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            lastCompletedQueryId: event.queryId,
            lastEventQueryId: event.queryId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            currentCard: isGlobalCard ? null : get().currentCard,
            previousCard: isGlobalCard ? null : get().previousCard,
            currentCardByWorkspace: newWsCards,
            previousCardByWorkspace: newWsPrevCards,
            currentQueryId: null, // 清空：cardForQuery 已处理完毕
            summaryChunks: [], // 流式总结结束，清空累积的 chunks
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: cardForQuery.timestamp,
                query: cardForQuery.query,
                analysis,
                summary: streamedSummary || event.summary, // 流式内容优先，保证立即有内容可显示
                completeSummary: event.summary, // 流式补完动画目标
                tokenUsage: lastTokenUsage,
                // V1.4.1: 关联本 query 的附件（用于卡片内渲染附件图标列表）
                attachments: get().attachmentDataByQueryId.get(event.queryId) ?? undefined,
              },
            ],
          });
          // 保存到 IndexedDB（用于分析统计）
          saveQueryToDB({
            queryId: event.queryId,
            question: cardForQuery.query,
            answer: event.summary || analysis,
            toolCalls: updatedToolCalls,
            duration: Date.now() - cardForQuery.timestamp,
            status: 'success',
          }, event.queryId);
        } else if (prevCardForQuery) {
          // 情况2：前一张被折叠的卡片（Q2发送时Q1还未完成，含 workspace-specific）
          newMarkdownCardId = `card_${prevCardForQuery.timestamp}_${event.queryId}`;
          newCollapsedCardIds.add(prevCardForQuery.queryId);
          const newWsCards2 = { ...workspaceCards };
          const newWsPrevCards2 = { ...workspacePrevCards };
          delete newWsPrevCards2[wid]; // 清除 workspace 的 prevCard
          // ── 多工作区保护：prevCardForQuery 来自 workspace-specific，不清全局 previousCard ──
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            lastCompletedQueryId: event.queryId,
            lastEventQueryId: event.queryId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            previousCard: get().previousCard, // 保留全局 previousCard（workspace-specific 的不清）
            currentCardByWorkspace: newWsCards2,
            previousCardByWorkspace: newWsPrevCards2,
            currentQueryId: null, // 清空：prevCardForQuery 已处理完毕
            summaryChunks: [], // 流式总结结束，清空累积的 chunks
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: prevCardForQuery.timestamp,
                query: prevCardForQuery.query,
                analysis,
                summary: streamedSummary || event.summary, // 流式内容优先，保证立即有内容可显示
                completeSummary: event.summary, // 流式补完动画目标
                tokenUsage: lastTokenUsage,
              },
            ],
          });
          // 保存到 IndexedDB（用于分析统计）
          saveQueryToDB({
            queryId: event.queryId,
            question: prevCardForQuery.query,
            answer: event.summary || analysis,
            toolCalls: updatedToolCalls,
            duration: Date.now() - prevCardForQuery.timestamp,
            status: 'success',
          }, event.queryId);
        } else {
          // 情况3：无 currentCard（如服务端直接开始 query），创建新卡片
          newMarkdownCardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            lastCompletedQueryId: event.queryId,
            lastEventQueryId: event.queryId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            summaryChunks: [], // 流式总结结束，清空累积的 chunks
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: Date.now(),
                query: queryText,
                analysis,
                summary: streamedSummary || event.summary, // 流式内容优先，保证立即有内容可显示
                completeSummary: event.summary, // 流式补完动画目标
                tokenUsage: lastTokenUsage,
              },
            ],
          });
          // 保存到 IndexedDB（用于分析统计）
          saveQueryToDB({
            queryId: event.queryId,
            question: queryText,
            answer: event.summary || analysis,
            toolCalls: updatedToolCalls,
            duration: 0,
            status: 'success',
          }, event.queryId);
        }
        break;
      }
    }
  },

  addTerminalLine: (line: string) => {
    set(state => ({
      terminalLines: [...state.terminalLines.slice(-500), line]
    }));
  },

  addTerminalChunk: (fragment: string) => {
    set(state => ({ terminalChunks: [...state.terminalChunks, fragment] }));
  },

  addSummaryChunk: (chunk: string) => {
    set(state => ({ summaryChunks: [...state.summaryChunks, chunk] }));
  },

  clearSummaryChunks: () => {
    set({ summaryChunks: [] });
  },

  clearStreamEnd: () => {
    set({ streamEndPending: false });
  },

  updatePendingInputsCount: (count: number) => {
    set({ pendingInputsCount: count });
  },

  addMarkdownCard: (card: MarkdownCardData) => {
    set(state => ({ markdownCards: [...state.markdownCards.slice(-50), card] }));
  },

  toggleProcessCollapsed: (collapsed: boolean) => {
    set({ processCollapsed: collapsed });
  },

  toggleDagQueryCollapse: (queryId: string) => {
    set(state => {
      const next = new Set(state.collapsedDagQueryIds);
      if (next.has(queryId)) {
        next.delete(queryId);
      } else {
        next.add(queryId);
      }
      return { collapsedDagQueryIds: next };
    });
  },

  collapseAllDagQueries: () => {
    set(state => {
      const allQueryIds = new Set<string>();
      for (const [, node] of state.nodes) {
        if (node.type === 'query') {
          allQueryIds.add(node.id);
        }
      }
      return { collapsedDagQueryIds: allQueryIds };
    });
  },

  expandAllDagQueries: () => {
    set({ collapsedDagQueryIds: new Set() });
  },

  // V1.4.0: Agent Group collapse
  collapseAllAgentGroups: () => {
    set(state => {
      const agentGroupIds = new Set<string>();
      for (const [, node] of state.nodes) {
        if (node.type === 'agent_group' || node.agentName) {
          agentGroupIds.add(node.id);
        }
      }
      return { collapsedAgentIds: agentGroupIds };
    });
  },

  expandAllAgentGroups: () => {
    set({ collapsedAgentIds: new Set() });
  },

  toggleGrouping: () => {
    set(state => ({ groupingEnabled: !state.groupingEnabled }));
  },

  toggleGroupExpand: (groupId: string) => {
    set(state => {
      const next = new Set(state.expandedGroupIds);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return { expandedGroupIds: next };
    });
  },

  collapseAllGroups: () => {
    set({ expandedGroupIds: new Set() });
  },

  // V1.4.0: Agent Group collapse/expand
  setCollapsedAgentIds: (updater: React.SetStateAction<Set<string>>) => {
    set((state) => ({
      collapsedAgentIds: typeof updater === 'function'
        ? updater(state.collapsedAgentIds)
        : updater,
    }));
  },

  // 添加 RAG 节点
  addRAGNodes: (queryId: string, ragItems: Array<{
    id: string;
    content: string;
    summary: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>) => {
    const newNodes = new Map(get().nodes);
    ragItems.forEach((item, index) => {
      const ragNodeId = `rag_${queryId}_${index}`;
      newNodes.set(ragNodeId, {
        id: ragNodeId,
        label: 'RAG',
        status: 'completed',
        type: 'rag',
        parentId: queryId,
        content: item.content,
        score: item.score,
        sourceSessionId: item.sourceSessionId,
        sourceSessionTitle: item.sourceSessionTitle,
        timestamp: item.timestamp,
      });
    });
    set({ nodes: newNodes });
  },
  /** 设置待消费的 RAG 项目，下次 query_start 时自动添加为 DAG 节点 */
  setPendingRAGItems: (items: TaskState['pendingRAGItems']) => {
    set({ pendingRAGItems: items });
  },
  /** V1.4.1: 设置待消费的附件 */
  setPendingAttachments: (items: TaskState['pendingAttachments']) => {
    set({ pendingAttachments: items });
  },

  reset: () => {
    set({
      nodes: new Map(),
      toolCalls: [],
      toolProgressMessages: new Map(),
      tokenUsage: { input: 0, output: 0 },
      terminalLines: [],
      terminalChunks: [],
      summaryChunks: [],
      streamEndPending: false,
      isRunning: false,
      isStarting: false,
      error: null,
      currentQueryId: null,
      pendingInputsCount: 0,
      markdownCards: [],
      processCollapsed: false,
      pendingQuery: '',
      pendingAnalysisByQueryId: new Map(),
      lastSummaryNodeId: null,
      collapsedDagQueryIds: new Set(),
      lastCompletedQueryId: null,
      collapsedCardIds: new Set(),
      currentCard: null,
      previousCard: null,
      currentCardByWorkspace: {},  // 多工作区隔离：清空所有工作区的卡片
      previousCardByWorkspace: {},
      groupingEnabled: true,
      expandedGroupIds: new Set(),
      collapsedAgentIds: new Set(),  // V1.4.0
      lastTokenUsage: 0,
      tokenUsageByQueryId: new Map(),
      savedQueryIdByEventQueryId: new Map(),
      pendingTokenUsageUpdate: new Map(),
      lastEventQueryId: null,
      pendingRAGItems: [],
      pendingAttachments: [],  // V1.4.1
      attachmentCountByQueryId: new Map(),  // V1.4.1
      attachmentDataByQueryId: new Map(),  // V1.4.1
    });
  },
}));

// 开发调试用：浏览器控制台可直接调用 window.__taskStore.handleEvent(...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__taskStore = useTaskStore;

import { create } from 'zustand';
import type { DAGNode, ToolCall as EventToolCall, TokenUsage, ClaudeEvent } from '../types/events';
import { createQuery, updateQueryTokenUsage } from './queryStorage';
import { useSessionStore } from './useSessionStore';
import type { ToolCall as StorageToolCall } from '@/types/storage';

export interface MarkdownCardData {
  id: string;
  queryId: string;       // 该卡片关联的 query ID（用于绑定工具）
  timestamp: number;
  query: string;         // 用户问题
  analysis: string;      // AI 分析过程（Markdown）
  summary?: string;      // 最终总结（无工具调用时可能为空）
  completeSummary?: string; // 完整总结（用于流式补完动画：summary 先显示流式内容，再动画补完到 completeSummary）
  tokenUsage?: number;  // 单次查询 Token 消耗
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
  groupingEnabled: boolean;  // 节点分组开关
  expandedGroupIds: Set<string>;  // 已展开的分组 ID 集合
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
  toggleGrouping: () => void;  // 切换节点分组开关
  toggleGroupExpand: (groupId: string) => void;  // 切换分组展开/折叠
  collapseAllGroups: () => void;  // 折叠全部工具分组
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
  reset: () => void;
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
  groupingEnabled: true,  // 默认开启节点分组
  expandedGroupIds: new Set(),  // 默认全部折叠
  lastTokenUsage: 0,
  tokenUsageByQueryId: new Map(),
  savedQueryIdByEventQueryId: new Map(),
  pendingTokenUsageUpdate: new Map(),
  lastEventQueryId: null,
  pendingRAGItems: [],

  handleEvent: (event: ClaudeEvent) => {
    if (event.type === 'summary_chunk') {
      const s = get();
      console.log('[Store] ✅ summary_chunk:', event.chunk?.slice(0, 30), '| queryId:', event.queryId, '| chunks len:', s.summaryChunks.length);
    }
    const { nodes, toolCalls } = get();

    switch (event.type) {
      case 'streamEnd': {
        const { terminalChunks } = get();
        const analysis = terminalChunks.join('');
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
        // ── 尝试解析 JSON 格式（query + ragChunks）─────────────
        let queryText = event.text;
        let ragChunks: NonNullable<CurrentCardData['ragChunks']> = [];

        try {
          const parsed = JSON.parse(event.text);
          if (parsed.query !== undefined && Array.isArray(parsed.ragChunks)) {
            queryText = String(parsed.query ?? '');
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
          });
        });

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
          };
          newNodesSC.set(summaryNodeId, summaryNode);
        }

        // 同时写入 summaryChunks，让 LiveCard 流式渲染
        set(state => ({
          nodes: newNodesSC,
          summaryChunks: [...state.summaryChunks, event.chunk],
        }));
        break;
      }
      case 'query_summary': {
        const { pendingAnalysisByQueryId, toolCalls, lastTokenUsage, summaryChunks } = get();
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

        if (inProgressCard && inProgressCard.queryId === event.queryId) {
          // 情况1：当前卡片（正常流程）
          newMarkdownCardId = `card_${inProgressCard.timestamp}_${event.queryId}`;
          // 折叠前一张已完成的卡片
          if (markdownCards.length > 0) {
            newCollapsedCardIds.add(markdownCards[markdownCards.length - 1].queryId);
          }
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            lastCompletedQueryId: event.queryId,
            lastEventQueryId: event.queryId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            currentCard: null,
            previousCard: null,
            currentQueryId: null, // 清空：inProgressCard 已处理完毕
            summaryChunks: [], // 流式总结结束，清空累积的 chunks
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: inProgressCard.timestamp,
                query: inProgressCard.query,
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
            question: inProgressCard.query,
            answer: event.summary || analysis,
            toolCalls: updatedToolCalls,
            duration: Date.now() - inProgressCard.timestamp,
            status: 'success',
          }, event.queryId);
        } else if (previousCard && previousCard.queryId === event.queryId) {
          // 情况2：前一张被折叠的卡片（Q2发送时Q1还未完成）
          newMarkdownCardId = `card_${previousCard.timestamp}_${event.queryId}`;
          newCollapsedCardIds.add(previousCard.queryId);
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            lastCompletedQueryId: event.queryId,
            lastEventQueryId: event.queryId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            previousCard: null,
            currentQueryId: null, // 清空：previousCard 已处理完毕
            summaryChunks: [], // 流式总结结束，清空累积的 chunks
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: previousCard.timestamp,
                query: previousCard.query,
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
            question: previousCard.query,
            answer: event.summary || analysis,
            toolCalls: updatedToolCalls,
            duration: Date.now() - previousCard.timestamp,
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
      groupingEnabled: true,
      expandedGroupIds: new Set(),
      lastTokenUsage: 0,
      tokenUsageByQueryId: new Map(),
      savedQueryIdByEventQueryId: new Map(),
      pendingTokenUsageUpdate: new Map(),
      lastEventQueryId: null,
      pendingRAGItems: [],
    });
  },
}));

// 开发调试用：浏览器控制台可直接调用 window.__taskStore.handleEvent(...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__taskStore = useTaskStore;

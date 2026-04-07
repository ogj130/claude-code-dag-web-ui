import { create } from 'zustand';
import type { DAGNode, ToolCall, TokenUsage, ClaudeEvent } from '../types/events';

export interface MarkdownCardData {
  id: string;
  queryId: string;       // 该卡片关联的 query ID（用于绑定工具）
  timestamp: number;
  query: string;         // 用户问题
  analysis: string;      // AI 分析过程（Markdown）
  summary?: string;     // 最终总结（无工具调用时可能为空）
}

// 进行中的问答卡片（实时更新）
export interface CurrentCardData {
  queryId: string;
  query: string;       // 用户问题文本
  timestamp: number;
  summary?: string;    // 总结到来时追加
  isCollapsed?: boolean;  // 是否折叠（发送新问题时，前一个进行中的卡片标记为折叠）
}

interface TaskState {
  nodes: Map<string, DAGNode>;
  toolCalls: ToolCall[];
  toolProgressMessages: Map<string, string>; // toolId → 累积的 progress 文本
  tokenUsage: TokenUsage;
  terminalLines: string[];
  terminalChunks: string[];
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

  handleEvent: (event: ClaudeEvent) => void;
  addTerminalLine: (line: string) => void;
  addTerminalChunk: (fragment: string) => void;
  clearStreamEnd: () => void;
  updatePendingInputsCount: (count: number) => void;
  addMarkdownCard: (card: MarkdownCardData) => void;
  toggleProcessCollapsed: (collapsed: boolean) => void;
  toggleDagQueryCollapse: (queryId: string) => void;  // 手动折叠/展开 DAG query
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: new Map(),
  toolCalls: [],
  toolProgressMessages: new Map(),
  tokenUsage: { input: 0, output: 0 },
  terminalLines: [],
  terminalChunks: [],
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

  handleEvent: (event: ClaudeEvent) => {
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
        const toolCall: ToolCall = {
          id: event.toolId,
          tool: event.tool,
          args: event.args,
          status: 'running',
          startTime: Date.now(),
        };
        // 同时创建 DAG node（parentId 关联当前 query node）
        const newNodes = new Map(nodes);
        const toolNode: DAGNode = {
          id: event.toolId,
          label: event.tool,
          status: 'running',
          type: 'tool',
          parentId: get().currentQueryId ?? 'main-agent',
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
        const msg = event.message;
        set(state => {
          const m = new Map(state.toolProgressMessages);
          m.set(event.toolId, (m.get(event.toolId) ?? '') + msg);
          return { toolProgressMessages: m };
        });
        break;
      }
      case 'token_usage': {
        set({ tokenUsage: event.usage });
        break;
      }
      case 'session_end': {
        set({ isRunning: false });
        break;
      }
      case 'user_input_sent': {
        const newNodesU = new Map(nodes);
        const qNodeU = newNodesU.get(event.queryId);
        if (qNodeU) {
          newNodesU.set(event.queryId, { ...qNodeU, label: event.text ?? '' });
        }

        // 叠起前一个已完成的卡片（发送新问题时，前一个问题自动折叠）
        const newCollapsedCards = new Set(get().collapsedCardIds);

        // 如果前一个问题已完成在 markdownCards 中，折叠其 queryId
        const allCards = get().markdownCards;
        if (allCards.length > 0) {
          newCollapsedCards.add(allCards[allCards.length - 1].queryId);
        }

        // 创建进行中的问答卡片（实时显示 query → tools → 状态 → 总结）
        // 如果前一个问题还在 currentCard 状态，存储为 previousCard 以便后续处理
        const prevCurrentCard = get().currentCard;
        const newPreviousCard = prevCurrentCard ?? null;
        const newCurrentCard: CurrentCardData = {
          queryId: event.queryId,
          query: event.text ?? '',
          timestamp: Date.now(),
        };
        set({
          currentQueryId: event.queryId,
          isRunning: true,
          pendingQuery: event.text ?? '',
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
          isRunning: true
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
      case 'query_summary': {
        const { pendingAnalysisByQueryId, toolCalls } = get();
        const analysis = pendingAnalysisByQueryId.get(event.queryId) ?? '';
        const newMap = new Map(pendingAnalysisByQueryId);
        newMap.delete(event.queryId);
        const newNodesQS = new Map(nodes);
        const summaryNodeId = `${event.queryId}_summary`;
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
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            currentCard: null,
            previousCard: null, // 清除 previousCard（正常流程中 previousCard 应为 null）
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: inProgressCard.timestamp,
                query: inProgressCard.query,
                analysis,
                summary: event.summary,
              },
            ],
          });
        } else if (previousCard && previousCard.queryId === event.queryId) {
          // 情况2：前一张被折叠的卡片（Q2发送时Q1还未完成）
          newMarkdownCardId = `card_${previousCard.timestamp}_${event.queryId}`;
          newCollapsedCardIds.add(previousCard.queryId);
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            previousCard: null,
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: previousCard.timestamp,
                query: previousCard.query,
                analysis,
                summary: event.summary,
              },
            ],
          });
        } else {
          // 情况3：无 currentCard（如服务端直接开始 query），创建新卡片
          newMarkdownCardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          set({
            nodes: newNodesQS,
            pendingAnalysisByQueryId: newMap,
            lastSummaryNodeId: summaryNodeId,
            toolCalls: updatedToolCalls,
            collapsedCardIds: newCollapsedCardIds,
            markdownCards: [
              ...markdownCards.slice(-50),
              {
                id: newMarkdownCardId,
                queryId: event.queryId,
                timestamp: Date.now(),
                query: queryText,
                analysis,
                summary: event.summary,
              },
            ],
          });
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

  reset: () => {
    set({
      nodes: new Map(),
      toolCalls: [],
      toolProgressMessages: new Map(),
      tokenUsage: { input: 0, output: 0 },
      terminalLines: [],
      terminalChunks: [],
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
    });
  },
}));

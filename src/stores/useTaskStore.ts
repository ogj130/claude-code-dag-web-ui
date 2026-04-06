import { create } from 'zustand';
import type { DAGNode, ToolCall, TokenUsage, ClaudeEvent } from '../types/events';

interface TaskState {
  nodes: Map<string, DAGNode>;
  toolCalls: ToolCall[];
  tokenUsage: TokenUsage;
  terminalLines: string[];
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;

  handleEvent: (event: ClaudeEvent) => void;
  addTerminalLine: (line: string) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: new Map(),
  toolCalls: [],
  tokenUsage: { input: 0, output: 0 },
  terminalLines: [],
  isRunning: false,
  isStarting: false,
  error: null,

  handleEvent: (event: ClaudeEvent) => {
    const { nodes, toolCalls } = get();

    switch (event.type) {
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
        set({ isStarting: false, isRunning: true, error: null, nodes: newNodes });
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
        // 同时创建 DAG node（parentId 关联主 agent node）
        const newNodes = new Map(nodes);
        const toolNode: DAGNode = {
          id: event.toolId,
          label: event.tool,
          status: 'running',
          type: 'tool',
          parentId: 'main-agent',
          startTime: Date.now(),
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
            newNodes.set(event.toolId, { ...node, status: 'failed' as const, endTime: Date.now() });
          }
          set({ toolCalls: updated, nodes: newNodes });
        }
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
    }
  },

  addTerminalLine: (line: string) => {
    set(state => ({
      terminalLines: [...state.terminalLines.slice(-500), line]
    }));
  },

  reset: () => {
    set({
      nodes: new Map(),
      toolCalls: [],
      tokenUsage: { input: 0, output: 0 },
      terminalLines: [],
      isRunning: false,
      isStarting: false,
      error: null,
    });
  },
}));

import { create } from 'zustand';
import type { SearchResult } from '@/stores/vectorStorage';

export interface RAGContextItem {
  id: string;
  content: string;
  summary: string;        // 用于显示的摘要
  score: number;          // 相似度 0-1
  chunkType: 'query' | 'answer' | 'toolcall';
  sourceSessionId: string;
  sourceSessionTitle: string;
  timestamp: number;
}

interface RAGContextState {
  items: RAGContextItem[];
  addItems: (results: SearchResult[]) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  getPromptContext: () => string;
}

export const useRAGContext = create<RAGContextState>((set, get) => ({
  items: [],

  addItems: (results) => {
    const newItems: RAGContextItem[] = results.map((r, index) => ({
      id: `${r.id}_${r.chunkType}_${index}`,
      content: r.content,
      summary: r.content.length > 80 ? r.content.substring(0, 80) + '...' : r.content,
      score: r.score,
      chunkType: r.chunkType,
      sourceSessionId: r.sessionId,
      sourceSessionTitle: (r.metadata?.sessionTitle as string) || 'Unknown',
      timestamp: r.timestamp,
    }));

    set((state) => {
      // 去重
      const existingIds = new Set(state.items.map((i) => i.id));
      const uniqueNew = newItems.filter((i) => !existingIds.has(i.id));
      return { items: [...state.items, ...uniqueNew] };
    });
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  clearAll: () => {
    set({ items: [] });
  },

  getPromptContext: () => {
    const { items } = get();
    if (items.length === 0) return '';

    const contextParts = items
      .map((item, index) => {
        const time = new Date(item.timestamp).toLocaleString('zh-CN');
        return `[${index + 1}] ${item.chunkType === 'answer' ? '回答' : item.chunkType === 'query' ? '问题' : '工具调用'}: ${item.content}\n来源: ${item.sourceSessionTitle} | ${time} | 相似度: ${(item.score * 100).toFixed(0)}%`;
      })
      .join('\n\n');

    return `[知识上下文]\n以下是与你问题相关的历史对话片段：\n${contextParts}\n[/知识上下文]\n\n`;
  },
}));

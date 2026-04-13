import { create } from 'zustand';
import type { SearchResult } from '@/stores/vectorStorage';

export interface RAGContextItem {
  id: string;
  content: string;
  summary: string;        // 用于显示的摘要
  score: number;          // 相似度 0-1
  chunkType: 'query' | 'answer' | 'toolcall' | 'attachment';  // V1.4.1: 支持附件类型
  sourceSessionId: string;
  sourceSessionTitle: string;
  timestamp: number;
  /** V1.4.1: 附件元数据 */
  fileName?: string;
  mimeType?: string;
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
      chunkType: r.chunkType as RAGContextItem['chunkType'],
      sourceSessionId: r.sessionId,
      sourceSessionTitle: (r.metadata?.sessionTitle as string) || 'Unknown',
      timestamp: r.timestamp,
      // V1.4.1: 附件元数据
      fileName: r.fileName,
      mimeType: r.mimeType,
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
        const typeLabel = item.chunkType === 'answer' ? '回答'
          : item.chunkType === 'query' ? '问题'
          : item.chunkType === 'attachment' ? `附件【${item.fileName ?? '文档'}】`
          : '工具调用';
        const source = item.chunkType === 'attachment'
          ? `${item.fileName ?? '附件'} | ${time} | 相似度: ${(item.score * 100).toFixed(0)}%`
          : `${item.sourceSessionTitle} | ${time} | 相似度: ${(item.score * 100).toFixed(0)}%`;
        return `[${index + 1}] ${typeLabel}: ${item.content}\n来源: ${source}`;
      })
      .join('\n\n');

    return `[知识上下文]\n以下是与你问题相关的历史片段：\n${contextParts}\n[/知识上下文]\n\n`;
  },
}));

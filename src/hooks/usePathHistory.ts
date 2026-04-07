import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cc-web-path-history';
const MAX_PATHS = 10;

interface PathHistoryActions {
  paths: string[];
  addPath: (path: string) => void;
  clearHistory: () => void;
}

export function usePathHistory(): PathHistoryActions {
  const [paths, setPaths] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  const persist = (next: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addPath = useCallback((path: string) => {
    setPaths(prev => {
      const trimmed = path.trim();
      if (!trimmed) return prev;
      const filtered = prev.filter(p => p !== trimmed);
      const next = [trimmed, ...filtered].slice(0, MAX_PATHS);
      persist(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setPaths([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { paths, addPath, clearHistory };
}

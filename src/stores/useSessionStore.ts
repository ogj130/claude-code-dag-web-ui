import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  isActive: boolean;
}

// store 初始化时就创建默认会话，避免 WebSocket 时序问题
const DEFAULT_SESSION_ID = `session_${Date.now()}`;

interface SessionState {
  sessions: Session[];
  activeSessionId: string;

  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  updateSession: (id: string, updates: Partial<Pick<Session, 'name' | 'projectPath'>>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // 初始化时就创建默认会话，activeSessionId 从第一天就有值
  sessions: [
    {
      id: DEFAULT_SESSION_ID,
      name: '会话 1',
      projectPath: '/Users/ouguangji/2026/cc-web-ui',
      createdAt: Date.now(),
      isActive: true,
    },
  ],
  activeSessionId: DEFAULT_SESSION_ID,

  addSession: (session) => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  removeSession: (id) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? DEFAULT_SESSION_ID)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  setActive: (id) => {
    set({ activeSessionId: id });
  },

  renameSession: (id, name) => {
    set(state => ({
      sessions: state.sessions.map(s => s.id === id ? { ...s, name } : s),
    }));
  },

  updateSession: (id, updates) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },
}));

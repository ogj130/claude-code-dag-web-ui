import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  isActive: boolean;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;

  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
  renameSession: (id: string, name: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  removeSession: (id) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== id);
      const activeSessionId = state.activeSessionId === id
        ? (sessions[0]?.id ?? null)
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
}));

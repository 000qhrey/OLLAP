import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  streaming?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  source?: string;
  needs_review?: boolean;
  image?: string; // URL or base64 image
};

export type Session = {
  id: string;
  title?: string;
  messages: Message[];
  selectedCanvasId?: string;
  flashcards?: Flashcard[];
  subject?: string;
  createdAt?: string;
};

// Hybrid storage: Use localStorage (more space) with cookie fallback for SSR compatibility
// localStorage has ~5-10MB vs cookies' 4KB limit, so it's better for chat sessions
const hybridStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      // Try localStorage first (more space)
      const stored = localStorage.getItem(name);
      if (stored) return stored;
      
      // Fallback to cookie if localStorage not available
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return decodeURIComponent(parts.pop()?.split(';').shift() || '');
      }
      return null;
    } catch (e) {
      // If localStorage fails (e.g., private browsing), try cookie
      try {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return decodeURIComponent(parts.pop()?.split(';').shift() || '');
        }
      } catch {}
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      // Try localStorage first (more space, better for large sessions)
      localStorage.setItem(name, value);
      
      // Also set a small cookie with session ID for SSR/initial load
      // Store just the current session ID in cookie, full data in localStorage
      try {
        const data = JSON.parse(value);
        if (data.currentSessionId) {
          const expires = new Date();
          expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
          document.cookie = `${name}-id=${data.currentSessionId};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        }
      } catch {}
    } catch (e) {
      // If localStorage fails (quota exceeded or private browsing), fallback to cookie
      // Note: Cookie has 4KB limit, so we'll only store essential data
      try {
        const expires = new Date();
        expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
        // Truncate if too large (keep only recent sessions)
        const truncated = value.length > 3500 ? value.substring(0, 3500) : value;
        document.cookie = `${name}=${encodeURIComponent(truncated)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      } catch {}
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch {}
    try {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      document.cookie = `${name}-id=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    } catch {}
  },
};

type Store = {
  sessions: Session[];
  currentSessionId: string | null;
  flashcards: Flashcard[];
  
  // Session actions
  createSession: (title?: string) => string;
  loadSession: (id: string) => void;
  getCurrentSession: () => Session | undefined;
  updateSessionTitle: (id: string, title: string) => void;
  updateSessionSubject: (id: string, subject: string) => void;
  
  // Message actions
  appendMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  updateMessageChunk: (token: string) => void;
  
  // Flashcard actions
  setFlashcards: (cards: Flashcard[]) => void;
  setSessionFlashcards: (sessionId: string, cards: Flashcard[]) => void;
  markFlashcardReview: (id: string) => void;
  markSessionFlashcardKnown: (sessionId: string, id: string) => void;
  
  // Canvas actions
  selectCanvas: (canvasId?: string) => void;
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      flashcards: [],
  
  createSession: (title = 'New Session') => {
    const id = `session-${Date.now()}`;
    const newSession: Session = {
      id,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: id,
    }));
    return id;
  },
  
  loadSession: (id: string) => {
    set({ currentSessionId: id });
  },
  
  getCurrentSession: () => {
    const { currentSessionId, sessions } = get();
    return sessions.find((s) => s.id === currentSessionId);
  },
  
  updateSessionTitle: (id: string, title: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title } : s
      ),
    }));
  },
  
  updateSessionSubject: (id: string, subject: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, subject } : s
      ),
    }));
  },
  
  appendMessage: (message: Message) => {
    set((state) => {
      const currentSession = state.sessions.find(
        (s) => s.id === state.currentSessionId
      );
      if (!currentSession) return state;
      
      return {
        sessions: state.sessions.map((s) =>
          s.id === state.currentSessionId
            ? { ...s, messages: [...s.messages, message] }
            : s
        ),
      };
    });
  },
  
  updateLastMessage: (content: string) => {
    set((state) => {
      const currentSession = state.sessions.find(
        (s) => s.id === state.currentSessionId
      );
      if (!currentSession || currentSession.messages.length === 0) return state;
      
      const lastMessage = currentSession.messages[currentSession.messages.length - 1];
      return {
        sessions: state.sessions.map((s) =>
          s.id === state.currentSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === lastMessage.id ? { ...m, content } : m
                ),
              }
            : s
        ),
      };
    });
  },
  
  updateMessageChunk: (token: string) => {
    set((state) => {
      const currentSession = state.sessions.find(
        (s) => s.id === state.currentSessionId
      );
      if (!currentSession || currentSession.messages.length === 0) return state;
      
      const lastMessage = currentSession.messages[currentSession.messages.length - 1];
      return {
        sessions: state.sessions.map((s) =>
          s.id === state.currentSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === lastMessage.id
                    ? { ...m, content: m.content + token }
                    : m
                ),
              }
            : s
        ),
      };
    });
  },
  
  setFlashcards: (cards: Flashcard[]) => {
    set({ flashcards: cards });
  },
  
  setSessionFlashcards: (sessionId: string, cards: Flashcard[]) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, flashcards: cards } : s
      ),
    }));
  },
  
  markFlashcardReview: (id: string) => {
    set((state) => ({
      flashcards: state.flashcards.map((card) =>
        card.id === id ? { ...card, needs_review: false } : card
      ),
    }));
  },
  
  markSessionFlashcardKnown: (sessionId: string, id: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              flashcards: s.flashcards?.map((card) =>
                card.id === id ? { ...card, needs_review: false } : card
              ),
            }
          : s
      ),
    }));
  },
  
  selectCanvas: (canvasId?: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === state.currentSessionId
          ? { ...s, selectedCanvasId: canvasId }
          : s
      ),
    }));
  },
    }),
    {
      name: 'chat-sessions-storage',
      storage: createJSONStorage(() => hybridStorage),
      // Only persist sessions and currentSessionId, not flashcards (they're in sessions)
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);

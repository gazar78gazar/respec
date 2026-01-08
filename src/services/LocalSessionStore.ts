/**
 * LocalSessionStore - Browser localStorage-backed SessionStore.
 *
 * Persists conversation history per session for threaded LLM calls.
 */
import type { SessionMessage } from "../types/service.types";
import type { SessionStore } from "./interfaces/SessionStore";

type StoredSession = {
  history: SessionMessage[];
  lastUpdated: string;
};

const STORAGE_PREFIX = "respec_session_";

export class LocalSessionStore implements SessionStore {
  async getHistory(sessionId: string): Promise<SessionMessage[]> {
    const session = this.readSession(sessionId);
    return session?.history ?? [];
  }

  async append(sessionId: string, message: SessionMessage): Promise<void> {
    const session = this.readSession(sessionId) ?? {
      history: [],
      lastUpdated: new Date().toISOString(),
    };

    session.history.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    session.lastUpdated = new Date().toISOString();

    this.writeSession(sessionId, session);
  }

  async clear(sessionId: string): Promise<void> {
    localStorage.removeItem(this.storageKey(sessionId));
  }

  async trim(sessionId: string, maxTurns: number): Promise<void> {
    if (maxTurns <= 0) {
      await this.clear(sessionId);
      return;
    }

    const session = this.readSession(sessionId);
    if (!session || session.history.length <= maxTurns) {
      return;
    }

    session.history = session.history.slice(-maxTurns);
    session.lastUpdated = new Date().toISOString();
    this.writeSession(sessionId, session);
  }

  private storageKey(sessionId: string): string {
    return `${STORAGE_PREFIX}${sessionId}`;
  }

  private readSession(sessionId: string): StoredSession | null {
    try {
      const stored = localStorage.getItem(this.storageKey(sessionId));
      return stored ? (JSON.parse(stored) as StoredSession) : null;
    } catch (error) {
      console.warn("[LocalSessionStore] Failed to read session:", error);
      return null;
    }
  }

  private writeSession(sessionId: string, session: StoredSession): void {
    try {
      localStorage.setItem(this.storageKey(sessionId), JSON.stringify(session));
    } catch (error) {
      console.warn("[LocalSessionStore] Failed to write session:", error);
    }
  }
}

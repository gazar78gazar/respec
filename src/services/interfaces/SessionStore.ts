/**
 * SessionStore - Interface for chat session history persistence.
 *
 * Used by ConversationService to retain threaded agents messages.
 */
import type { SessionMessage } from "../../types/service.types";

export interface SessionStore {
  getHistory(sessionId: string): Promise<SessionMessage[]>;
  append(sessionId: string, message: SessionMessage): Promise<void>;
  clear(sessionId: string): Promise<void>;
  trim(sessionId: string, maxTurns: number): Promise<void>;
}

/**
 * session-store.types - Types for session persistence.
 */

import type { SessionMessage } from "./service.types";

export type StoredSession = {
  history: SessionMessage[];
  lastUpdated: string;
};

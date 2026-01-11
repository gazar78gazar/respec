/**
 * conversation.types - Types for threaded conversation handling.
 */

import type {
  AnthropicMessageRequest,
  AnthropicMessageResponse,
} from "./anthropic.types";

export type ThreadedMessageRequest = Omit<
  AnthropicMessageRequest,
  "messages"
> & {
  sessionId: string;
  message: string;
  maxTurns?: number;
};

export type ThreadedMessageResult = {
  response: AnthropicMessageResponse;
  assistantText: string;
};

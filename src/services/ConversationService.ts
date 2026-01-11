/**
 * ConversationService - Threaded Anthropic messaging with session history.
 *
 * Loads prior turns from SessionStore, appends the new user message,
 * invokes AnthropicService, then persists the assistant response.
 */
import type {
  AnthropicMessage,
  AnthropicMessageResponse,
} from "../types/anthropic.types";
import type {
  ThreadedMessageRequest,
  ThreadedMessageResult,
} from "../types/conversation.types";
import type { SessionMessage } from "../types/service.types";
import type { SessionStore } from "./interfaces/SessionStore";
import { AnthropicService } from "./AnthropicService";

const DEFAULT_MAX_TURNS = 12;

export class ConversationService {
  private anthropicService: AnthropicService;
  private sessionStore: SessionStore;

  public constructor(
    anthropicService: AnthropicService,
    sessionStore: SessionStore,
  ) {
    this.anthropicService = anthropicService;
    this.sessionStore = sessionStore;
  }

  public async sendThreaded(
    request: ThreadedMessageRequest,
  ): Promise<ThreadedMessageResult> {
    const history = await this.sessionStore.getHistory(request.sessionId);
    const messages = [
      ...history.map(this.toAnthropicMessage),
      { role: "user" as const, content: request.message },
    ];

    const response = await this.anthropicService.createMessage({
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      system: request.system,
      messages,
    });

    await this.sessionStore.append(request.sessionId, {
      role: "user",
      content: request.message,
      timestamp: new Date().toISOString(),
    });

    const assistantText = this.extractText(response);
    if (assistantText)
      await this.sessionStore.append(request.sessionId, {
        role: "assistant",
        content: assistantText,
        timestamp: new Date().toISOString(),
      });

    await this.sessionStore.trim(
      request.sessionId,
      request.maxTurns ?? DEFAULT_MAX_TURNS,
    );

    return { response, assistantText };
  }

  private toAnthropicMessage(message: SessionMessage): AnthropicMessage {
    return {
      role: message.role,
      content: message.content,
    };
  }

  private extractText(response: AnthropicMessageResponse): string {
    return response.content
      .map((item) => (item.type === "text" ? item.text || "" : ""))
      .join("")
      .trim();
  }
}

/**
 * AnthropicService - Centralized Anthropic SDK client.
 *
 * Handles client initialization and message requests without prompt logic.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  AnthropicMessageRequest,
  AnthropicMessageResponse,
} from "../types/anthropic.types";
import type { Maybe } from "../types/service.types";

export class AnthropicService {
  private client: Maybe<Anthropic> = null;
  private apiKey: string;
  private isInitialized = false;

  public constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || "";

    if (!this.apiKey)
      console.warn(
        "[AnthropicService] No API key provided - will use fallback responses",
      );
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.apiKey) {
      try {
        this.client = new Anthropic({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true, // Required for browser usage
        });
        this.isInitialized = true;
        console.log("[AnthropicService] Initialized with API key");
      } catch (error) {
        console.error("[AnthropicService] Failed to initialize:", error);
        this.client = null;
      }
    } else {
      console.log("[AnthropicService] Running in fallback mode (no API key)");
      this.isInitialized = true;
    }
  }

  public hasClient(): boolean {
    return Boolean(this.client);
  }

  public async createMessage(
    request: AnthropicMessageRequest,
  ): Promise<AnthropicMessageResponse> {
    if (!this.client)
      throw new Error(
        "[AnthropicService] Client not initialized. Call initialize() first.",
      );

    return (await this.client.messages.create(
      request,
    )) as AnthropicMessageResponse;
  }
}

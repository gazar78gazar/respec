/**
 * StatefulAgent - Interface for agents that manage session state.
 */
import type { AgentConfig } from "../../utils/agent-config.types";
import type { AnthropicService } from "../AnthropicService";
import type { PromptProvider } from "./PromptProvider";
import type { SessionStore } from "./SessionStore";

export interface StatefulAgent {
  initialize(initialData?: Record<string, string[]>): Promise<void>;
  getSessionId(): string;
  getAgentConfig(): AgentConfig;
}

export interface StatefulAgentConstructor {
  new (
    anthropicService: AnthropicService,
    promptProvider: PromptProvider,
    sessionStore: SessionStore,
  ): StatefulAgent;
}

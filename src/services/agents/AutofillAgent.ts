/**
 * AutofillAgent - Stateless agent for remaining specification completion.
 *
 * Uses the autofill prompt and returns selections or questions without
 * relying on session history.
 */
import { AnthropicService } from "../AnthropicService";
import type { PromptProvider } from "../interfaces/PromptProvider";
import {
  DEFAULT_AGENT_CONFIG,
  loadAgentConfig,
} from "../../utils/agent-config";
import type { AgentConfig } from "../../utils/agent-config.types";
import type {
  AutofillAgentContext,
  AutofillAgentResult,
  AutofillAgentSelection,
} from "../../types/semantic.types";

type AgentMessageItem = {
  type: "message";
  content: string;
};

type AgentSelectionItem = {
  type: "selection";
  specifications: string[];
};

type AgentResponseItem = AgentMessageItem | AgentSelectionItem;

export class AutofillAgent {
  private anthropicService: AnthropicService;
  private promptProvider: PromptProvider;
  private agentConfig: AgentConfig;
  private isInitialized = false;

  public constructor(
    anthropicService: AnthropicService,
    promptProvider: PromptProvider,
  ) {
    this.anthropicService = anthropicService;
    this.promptProvider = promptProvider;
    this.agentConfig = DEFAULT_AGENT_CONFIG;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.agentConfig = loadAgentConfig("autofillAgent");
    await this.anthropicService.initialize();
    this.isInitialized = true;
  }

  public async runAutofill(
    context: AutofillAgentContext,
  ): Promise<AutofillAgentResult> {
    console.log("[AutofillAgent] runAutofill", { context });

    await this.initialize();

    if (!this.anthropicService.hasClient()) {
      return {
        mode: "empty",
        message:
          "Autofill is unavailable without an Anthropic API key configured.",
        selections: [],
      };
    }

    const systemPrompt = await this.promptProvider.getPrompt("autofill-agent");
    const payload = `[AUTOFILL_CONTEXT: ${JSON.stringify(context)}]`;

    try {
      const completion = await this.anthropicService.createMessage({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: payload }],
      });

      const primaryContent = completion.content[0];
      const responseText =
        primaryContent?.type === "text" ? primaryContent.text || "" : "";
      if (responseText.includes("[AUTOFILL_CONTEXT"))
        return {
          mode: "empty",
          message: "",
          selections: [],
        };

      const parsed = this.parseAgentResponse(responseText);
      if (parsed) return parsed;

      return {
        mode: "empty",
        message:
          responseText ||
          "I could not parse an autofill response. Please try again.",
        selections: [],
      };
    } catch (error) {
      console.error("[AutofillAgent] API call failed:", error);
      return {
        mode: "empty",
        message:
          "Autofill ran into an error. Please try again or update selections manually.",
        selections: [],
      };
    }
  }

  private parseAgentResponse(text: string): AutofillAgentResult | null {
    const payload = this.extractJsonPayload(text);
    if (!payload || !Array.isArray(payload)) return null;

    const items = payload.filter(
      (item): item is AgentResponseItem =>
        item !== null && typeof item === "object" && "type" in item,
    );

    const messages: string[] = [];
    const selections: AutofillAgentSelection[] = [];
    const selectionMap = new Map<string, string>();

    items.forEach((item) => {
      if (item.type === "message") {
        if (typeof item.content === "string") messages.push(item.content);
        return;
      }
      if (item.type === "selection") {
        if (!Array.isArray(item.specifications)) return;
        item.specifications.forEach((spec) => {
          if (typeof spec !== "string") return;
          const splitIndex = spec.indexOf(":");
          if (splitIndex === -1) return;
          const field = spec.slice(0, splitIndex).trim();
          const value = spec.slice(splitIndex + 1).trim();
          if (!field || !value) return;
          selectionMap.set(field, value);
        });
      }
    });

    selectionMap.forEach((value, field) => {
      selections.push({ field, value });
    });

    if (selections.length > 0) {
      return {
        mode: "selections",
        message: messages.join("\n").trim(),
        selections,
      };
    }

    if (messages.length > 0) {
      return {
        mode: "questions",
        message: messages.join("\n").trim(),
        selections: [],
      };
    }

    return {
      mode: "empty",
      message: "",
      selections: [],
    };
  }

  private extractJsonPayload(text: string): unknown | null {
    const cleaned = text
      .replace(/^```[a-z]*\s*/i, "")
      .replace(/```$/, "")
      .trim();

    if (cleaned.startsWith("[") || cleaned.startsWith("{")) {
      try {
        return JSON.parse(cleaned);
      } catch {
        // fall through
      }
    }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // ignore
      }
    }

    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // ignore
      }
    }

    return null;
  }
}

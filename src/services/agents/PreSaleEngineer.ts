/**
 * PreSaleEngineer - LLM agent for specification extraction and conflict routing.
 *
 * Handles prompt construction, fallback behavior, and conflict resolution parsing
 * without mutating artifact state.
 */
import { v4 as uuidv4 } from "uuid";
import { ArtifactManager } from "../ArtifactManager";
import { AnthropicService } from "../AnthropicService";
import { ConversationService } from "../ConversationService";
import type { SessionStore } from "../interfaces/SessionStore";
import type { PromptProvider } from "../interfaces/PromptProvider";
import type { StatefulAgent } from "../interfaces/StatefulAgent";
import {
  DEFAULT_AGENT_CONFIG,
  loadAgentConfig,
} from "../../utils/agent-config";
import type { AgentConfig } from "../../utils/agent-config.types";
import type {
  EntryResolutionOption,
  SessionMessage,
  StructuredConflicts,
  StrucureConflictEntry,
} from "../../types/service.types";
import type {
  AnthropicAnalysisResult,
  AnthropicAnalysisContext,
  ConflictResponseParseResult,
  ConflictResolutionOutcome,
} from "../../types/semantic.types";

export class PreSaleEngineer implements StatefulAgent {
  private anthropicService: AnthropicService;
  private promptProvider: PromptProvider;
  private conversationService: ConversationService;
  private sessionStore: SessionStore;
  private sessionId: string;
  private isInitialized = false;
  private isSessionInitialized = false;
  private agentConfig: AgentConfig;
  private fieldMappings: Record<string, string[]> = {};

  constructor(
    anthropicService: AnthropicService,
    promptProvider: PromptProvider,
    sessionStore: SessionStore,
  ) {
    this.anthropicService = anthropicService;
    this.promptProvider = promptProvider;
    this.sessionStore = sessionStore;
    this.conversationService = new ConversationService(
      this.anthropicService,
      this.sessionStore,
    );
    this.sessionId = uuidv4();
    this.agentConfig = DEFAULT_AGENT_CONFIG;
  }

  async initialize(initialData: Record<string, string[]> = {}): Promise<void> {
    if (this.isInitialized) return;

    this.fieldMappings = initialData;
    console.log("[PreSaleEngineer] Received field mappings:", initialData);

    this.agentConfig = loadAgentConfig("preSaleEngineer");

    await this.anthropicService.initialize();
    this.isInitialized = true;
    await this.initSession();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }

  private async initSession(): Promise<void> {
    if (this.isSessionInitialized) return;
    if (!this.isInitialized) return;

    if (!this.anthropicService.hasClient()) {
      this.isSessionInitialized = true;
      return;
    }

    try {
      const systemPrompt = await this.buildSystemPrompt();
      await this.conversationService.sendThreaded({
        sessionId: this.sessionId,
        message: this.getInitMessage(),
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        system: systemPrompt,
        maxTurns: this.agentConfig.maxSessionTurns,
      });
    } catch (error) {
      console.warn("[PreSaleEngineer] Init stage failed:", error);
    } finally {
      this.isSessionInitialized = true;
    }
  }

  async analyzeRequirements(
    message: string,
    context?: string | AnthropicAnalysisContext,
  ): Promise<AnthropicAnalysisResult> {
    await this.ensureSessionReady();

    if (!this.isInitialized || !this.anthropicService.hasClient()) {
      console.error(
        "[PreSaleEngineer] analyzeRequirements. Client is not initialized return fallback",
      );
      const fallback = this.getEmptyResponse(message);
      await this.recordTurn(message, fallback.response);
      return fallback;
    }

    try {
      const systemPrompt = await this.buildSystemPrompt();

      console.log(`[PreSaleEngineer] systemPrompt`, { systemPrompt });

      const userMessage = this.buildAnalysisMessage(message, context);
      const history = await this.sessionStore.getHistory(this.sessionId);

      console.log(
        `[PreSaleEngineer] 📜 Sending ${history.length + 1} messages (${history.length} history + 1 current)`,
      );

      const { assistantText } = await this.conversationService.sendThreaded({
        sessionId: this.sessionId,
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        system: systemPrompt,
        message: userMessage,
        maxTurns: this.agentConfig.maxSessionTurns,
      });

      try {
        const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const extracted = parsed.specifications || parsed.requirements || [];
          return {
            requirements: extracted,
            response: parsed.response || assistantText,
            clarificationNeeded: parsed.clarificationNeeded,
          };
        }
      } catch (parseError) {
        console.warn(
          "[PreSaleEngineer] Could not parse JSON response:",
          parseError,
        );
      }

      return {
        requirements: [],
        response:
          assistantText ||
          "I processed your message but need more specific details.",
        clarificationNeeded: undefined,
      };
    } catch (error) {
      console.error("[PreSaleEngineer] API call failed:", error);
      const fallback = this.getEmptyResponse(message);
      await this.recordTurn(message, fallback.response);
      return fallback;
    }
  }

  private async ensureSessionReady(): Promise<void> {
    if (!this.isInitialized) return;

    if (!this.isSessionInitialized) {
      await this.initSession();
    }
  }

  private buildAnalysisMessage(
    message: string,
    context?: string | AnthropicAnalysisContext,
  ): string {
    const base = `Analyze this requirement: "${message}"`;
    if (!context) return base;

    const contextPayload =
      typeof context === "string" ? context : JSON.stringify(context);
    return `${base}\n\nContext: ${contextPayload}`;
  }

  private getInitMessage(): string {
    return `Initialize session. Respond with "Ready" only.`;
  }

  private async recordTurn(
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    try {
      const userEntry: SessionMessage = {
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      };

      await this.sessionStore.append(this.sessionId, userEntry);

      if (assistantMessage) {
        const assistantEntry: SessionMessage = {
          role: "assistant",
          content: assistantMessage,
          timestamp: new Date().toISOString(),
        };
        await this.sessionStore.append(this.sessionId, assistantEntry);
      }

      await this.sessionStore.trim(
        this.sessionId,
        this.agentConfig.maxSessionTurns,
      );
    } catch (error) {
      console.warn("[PreSaleEngineer] Failed to record turn:", error);
    }
  }

  private getEmptyResponse(message: string): AnthropicAnalysisResult {
    return {
      requirements: [],
      response: `I understand you mentioned: "${message}". Empty response returned`,
      clarificationNeeded: "",
    };
  }

  private buildFieldsDescription(): string {
    let fieldsDescription = "";

    if (this.fieldMappings) {
      Object.entries(this.fieldMappings).forEach(([section, fields]) => {
        if (Array.isArray(fields) && fields.length > 0) {
          fieldsDescription += `- ${section}: ${fields.join(", ")}\n`;
        }
      });
    }

    if (!fieldsDescription) {
      fieldsDescription = `- computePerformance: processorType, gpuAcceleration, memoryCapacity, memoryType, storageCapacity, storageType, timeSensitiveFeatures, responseLatency, operatingSystem
- IOConnectivity: digitalIO, analogIO, ethernetPorts, ethernetSpeed, ethernetProtocols, usbPorts, serialPortsAmount, serialPortType, serialProtocolSupport, fieldbusProtocolSupport, wirelessExtension
- formFactor: powerInput, maxPowerConsumption, redundantPower, dimensions, mounting
- environmentStandards: operatingTemperature, humidity, vibrationResistance, ingressProtection, vibrationProtection, certifications
- commercial: budgetPerUnit, quantity, totalBudget, deliveryTimeframe, shippingIncoterms, warrantyRequirements`;
    }

    return fieldsDescription;
  }

  private async buildSystemPrompt(): Promise<string> {
    const fieldsDescription = this.buildFieldsDescription();
    const template = await this.promptProvider.getPrompt("presale-engineer");

    if (template.includes("{{fieldsDescription}}"))
      return template.replace("{{fieldsDescription}}", fieldsDescription);
    else
      return `${template}\n\nAvailable sections and fields:\n${fieldsDescription}`;
  }

  async generateConflictQuestion(
    conflictData: StructuredConflicts,
  ): Promise<string> {
    if (!conflictData.conflicts.length) return "No conflicts to resolve.";

    await this.ensureSessionReady();

    if (!this.anthropicService.hasClient()) {
      return this.buildFallbackConflictQuestion(conflictData);
    }

    try {
      const systemPrompt = await this.buildSystemPrompt();
      const promptPayload = {
        metadata: { isConflict: true },
        conflicts: conflictData.conflicts,
      };
      const completion = await this.anthropicService.createMessage({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify(promptPayload, null, 2),
          },
        ],
      });

      const primaryContent = completion.content[0];
      const responseText =
        primaryContent?.type === "text" ? primaryContent.text || "" : "";
      const cleaned = responseText.trim();
      if (cleaned) {
        return cleaned;
      }
    } catch (error) {
      console.error(
        "[PreSaleEngineer] Error generating conflict question:",
        error,
      );
    }

    return this.buildFallbackConflictQuestion(conflictData);
  }

  private buildFallbackConflictQuestion(
    conflictData: StructuredConflicts,
  ): string {
    const conflicts = conflictData.conflicts;
    if (conflicts.length === 1) {
      const conflict = conflicts[0];
      return `I detected a conflict: ${conflict.description}\n\nWhich would you prefer?\nA) ${conflict.resolutionOptions[0].label}\n   Outcome: ${conflict.resolutionOptions[0].outcome}\n\nB) ${conflict.resolutionOptions[1].label}\n   Outcome: ${conflict.resolutionOptions[1].outcome}\n\nPlease respond with A or B.`;
    }

    const conflictCount = conflicts.length;
    const optionALabels = conflicts
      .map((conflict) => conflict.resolutionOptions[0]?.label)
      .filter(Boolean)
      .join("; ");
    const optionBLabels = conflicts
      .map((conflict) => conflict.resolutionOptions[1]?.label)
      .filter(Boolean)
      .join("; ");

    return `I detected ${conflictCount} conflicts that need a single direction.\n\nWhich would you prefer?\nA) Apply Option A across all conflicts (${optionALabels})\nB) Apply Option B across all conflicts (${optionBLabels})\n\nPlease respond with A or B.`;
  }

  // ============= CONFLICT RESOLUTION =============

  async parseConflictResponse(
    userMessage: string,
    _activeConflict: StrucureConflictEntry,
  ): Promise<ConflictResponseParseResult> {
    if (!this.anthropicService.hasClient()) {
      const message = userMessage.toLowerCase().trim();

      if (
        message === "a" ||
        message === "option a" ||
        message === "first" ||
        message === "first one"
      ) {
        return {
          isResolution: true,
          choice: "a",
          confidence: 1.0,
          rawResponse: userMessage,
        };
      }
      if (
        message === "b" ||
        message === "option b" ||
        message === "second" ||
        message === "second one"
      ) {
        return {
          isResolution: true,
          choice: "b",
          confidence: 1.0,
          rawResponse: userMessage,
        };
      }

      return {
        isResolution: false,
        choice: null,
        confidence: 0.0,
        rawResponse: userMessage,
      };
    }

    try {
      const prompt = `
You are parsing a user response to a binary choice question.

The user was asked to choose between Option A or Option B.

User's response: "${userMessage}"

Determine:
1. Is this a response to the binary choice? (yes/no)
2. Which option did they choose? (A, B, or unclear)
3. How confident are you? (0.0 to 1.0)

Respond ONLY with valid JSON:
{
  "isResolution": true/false,
  "choice": "a" or "b" or null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Examples:
- "A" -> {"isResolution": true, "choice": "a", "confidence": 1.0, "reasoning": "Direct A choice"}
- "I'll go with the first one" -> {"isResolution": true, "choice": "a", "confidence": 0.9, "reasoning": "First implies A"}
- "Tell me more about option B" -> {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Question, not choice"}
- "What's the difference?" -> {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Asking for info"}
- "Option B please" -> {"isResolution": true, "choice": "b", "confidence": 1.0, "reasoning": "Direct B choice"}
`;

      const completion = await this.anthropicService.createMessage({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        messages: [{ role: "user", content: prompt }],
      });

      console.log("[PreSaleEngineer] response before parsing", { completion });

      const primaryContent = completion.content[0];
      const raw =
        primaryContent?.type === "text" ? primaryContent.text || "{}" : "{}";
      const responseText = raw
        .replace(/^```[a-z]*\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(responseText);

      console.log("[PreSaleEngineer] Parsed response:", parsed);

      return {
        isResolution: parsed.isResolution || false,
        choice: parsed.choice || null,
        confidence: parsed.confidence || 0.0,
        rawResponse: userMessage,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error(
        "[PreSaleEngineer] Error parsing conflict response:",
        error,
      );

      const message = userMessage.toLowerCase().trim();
      if (message.includes("a") && !message.includes("b")) {
        return {
          isResolution: true,
          choice: "a",
          confidence: 0.6,
          rawResponse: userMessage,
        };
      }
      if (message.includes("b") && !message.includes("a")) {
        return {
          isResolution: true,
          choice: "b",
          confidence: 0.6,
          rawResponse: userMessage,
        };
      }

      return {
        isResolution: false,
        choice: null,
        confidence: 0.0,
        rawResponse: userMessage,
      };
    }
  }

  private async generateClarification(
    userMessage: string,
    conflict: StrucureConflictEntry,
  ): Promise<string> {
    if (!this.anthropicService.hasClient()) {
      return `To help you decide, let me clarify:\n\nOption A: ${conflict.resolutionOptions[0].label}\nOption B: ${conflict.resolutionOptions[1].label}\n\nPlease choose A or B.`;
    }

    try {
      const prompt = `
The user is in a conflict resolution flow. They were asked to choose between:

Option A: ${conflict.resolutionOptions[0].label}
- Outcome: ${conflict.resolutionOptions[0].outcome}

Option B: ${conflict.resolutionOptions[1].label}
- Outcome: ${conflict.resolutionOptions[1].outcome}

Instead of choosing, they asked: "${userMessage}"

Provide a helpful clarification that:
1. Answers their question specifically
2. Keeps the answer brief (2-3 sentences)
3. Reminds them of the two options
4. Asks them to choose A or B

Keep it friendly and conversational.
`;

      const completion = await this.anthropicService.createMessage({
        model: this.agentConfig.model,
        max_tokens: this.agentConfig.max_tokens,
        temperature: this.agentConfig.temperature,
        messages: [{ role: "user", content: prompt }],
      });

      const primaryContent = completion.content[0];
      const responseText =
        primaryContent?.type === "text" ? primaryContent.text || "" : "";
      return responseText;
    } catch (error) {
      console.error("[PreSaleEngineer] Error generating clarification:", error);
      return `To help you decide:\n\nOption A: ${conflict.resolutionOptions[0].label}\nOption B: ${conflict.resolutionOptions[1].label}\n\nWhich would you prefer? Please respond with A or B.`;
    }
  }

  async handleConflictResolution(
    userMessage: string,
    conflictData: StructuredConflicts,
    artifactManager: ArtifactManager,
  ): Promise<ConflictResolutionOutcome> {
    await this.ensureSessionReady();

    console.log("[PreSaleEngineer] Handling conflict resolution", {
      userMessage,
      conflictData,
      artifactManager,
    });

    if (!conflictData.conflicts.length) {
      const result = {
        response: "No conflicts to resolve.",
        mode: "no_conflicts",
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }

    const conflicts = conflictData.conflicts;
    const conflict = conflicts[0];

    const parsed = await this.parseConflictResponse(userMessage, conflict);

    console.log("[PreSaleEngineer] Parse result:", {
      isResolution: parsed.isResolution,
      choice: parsed.choice,
      confidence: parsed.confidence,
    });

    if (!parsed.isResolution) {
      const clarification =
        conflicts.length > 1
          ? await this.generateConflictQuestion(conflictData)
          : await this.generateClarification(userMessage, conflict);

      const result = {
        response: clarification,
        mode: "clarification_provided",
        conflictId: conflict.id,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }

    if (parsed.confidence < 0.7) {
      if (artifactManager.incrementConflictCycle) {
        conflicts.forEach((entry) => {
          artifactManager.incrementConflictCycle(entry.id);
        });
      }

      const result = {
        response: `I'm not sure which option you're choosing. Please respond with either "A" or "B".`,
        mode: "clarification_needed",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }

    if (!parsed.choice || !["a", "b"].includes(parsed.choice)) {
      if (artifactManager.incrementConflictCycle) {
        conflicts.forEach((entry) => {
          artifactManager.incrementConflictCycle(entry.id);
        });
      }

      const result = {
        response: `Please choose either Option A or Option B.`,
        mode: "invalid_choice",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }

    const resolutionId = parsed.choice === "a" ? "option-a" : "option-b";
    const selectedOptions = conflicts.map((entry) => ({
      conflictId: entry.id,
      option: entry.resolutionOptions.find(
        (opt: EntryResolutionOption) => opt.id === resolutionId,
      ),
    }));

    if (selectedOptions.some((entry) => !entry.option)) {
      const result = {
        response: `I encountered an issue applying that choice, because selected option was not found.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }

    try {
      let resolvedCount = 0;
      for (const entry of selectedOptions) {
        const activeIds = new Set(
          artifactManager
            .getState()
            .conflicts.active.map((active) => active.id),
        );

        if (!activeIds.has(entry.conflictId)) {
          continue;
        }

        await artifactManager.resolveConflict(entry.conflictId, resolutionId);
        resolvedCount += 1;
      }

      const remainingConflicts =
        artifactManager.getState().conflicts.active.length;

      const chosenOption =
        conflicts.length === 1
          ? (selectedOptions[0].option as EntryResolutionOption)
          : undefined;

      let confirmation: string;
      if (chosenOption) {
        confirmation = `Got it! I've updated your configuration with ${chosenOption.label}.

${chosenOption.outcome}`;
      } else {
        const choiceLabel = parsed.choice === "a" ? "Option A" : "Option B";
        confirmation = `Got it! I've applied ${choiceLabel} across ${resolvedCount} conflict(s).`;
      }

      if (remainingConflicts > 0) {
        confirmation += `

${remainingConflicts} more conflict(s) to resolve.`;
      } else {
        confirmation += `

Your system is now conflict-free. What else would you like to configure?`;
      }

      const result = {
        response: confirmation,
        mode: "resolution_success",
        conflictId: conflict.id,
        chosenOption,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    } catch (error) {
      console.error("[PreSaleEngineer] Resolution failed:", error);

      const result = {
        response: `I encountered an issue applying that choice: ${(error as Error).message}

Let me try presenting the options again.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
      await this.recordTurn(userMessage, result.response);
      return result;
    }
  }
}

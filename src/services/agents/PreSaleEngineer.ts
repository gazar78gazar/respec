/**
 * PreSaleEngineer - LLM agent for specification extraction and conflict routing.
 *
 * Handles prompt construction, fallback behavior, and conflict resolution parsing
 * without mutating artifact state.
 */
import { ArtifactManager } from "../ArtifactManager";
import { AnthropicService } from "../AnthropicService";
import {
  LocalPromptProvider,
  type PromptProvider,
} from "../prompts/PromptProvider";
import type {
  EntryResolutionOption,
  StructuredConflicts,
  StrucureConflictEntry,
} from "../../types/service.types";
import type {
  AnthropicAnalysisResult,
  AnthropicAnalysisContext,
  ConflictResponseParseResult,
  ConflictResolutionOutcome,
} from "../../types/semantic.types";

export class PreSaleEngineer {
  private anthropicService: AnthropicService;
  private promptProvider: PromptProvider;
  private isInitialized = false;
  private fieldMappings: Record<string, string[]> = {};

  constructor(
    anthropicService?: AnthropicService,
    promptProvider?: PromptProvider,
  ) {
    this.anthropicService = anthropicService || new AnthropicService();
    this.promptProvider = promptProvider || new LocalPromptProvider();
  }

  async initialize(
    fieldMappings: Record<string, string[]> = {},
  ): Promise<void> {
    if (this.isInitialized) return;

    this.fieldMappings = fieldMappings;
    console.log("[PreSaleEngineer] Received field mappings:", fieldMappings);

    await this.anthropicService.initialize();
    this.isInitialized = true;
  }

  async analyzeRequirements(
    message: string,
    context?: string | AnthropicAnalysisContext,
  ): Promise<AnthropicAnalysisResult> {
    if (!this.isInitialized || !this.anthropicService.hasClient()) {
      console.error(
        "[PreSaleEngineer] analyzeRequirements. Client is not initialized return fallback",
      );
      return this.getEmptyResponse(message);
    }

    try {
      const systemPrompt = await this.buildSystemPrompt();

      console.log(`[Anthropic service] !!! systemPrompt`, { systemPrompt });

      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      messages.push({
        role: "user",
        content: `Analyze this requirement: "${message}"\n\nContext: ${JSON.stringify(context || {})}`,
      });

      console.log(
        `[PreSaleEngineer] 📜 Sending ${messages.length} messages (${messages.length - 1} history + 1 current)`,
      );

      const completion = await this.anthropicService.createMessage({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || "1024"),
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || "0.3"),
        system: systemPrompt,
        messages,
      });

      const primaryContent = completion.content[0];
      const responseText =
        primaryContent?.type === "text" ? primaryContent.text || "" : "";

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const extracted = parsed.specifications || parsed.requirements || [];
          return {
            requirements: extracted,
            response: parsed.response || responseText,
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
          responseText ||
          "I processed your message but need more specific details.",
        clarificationNeeded: undefined,
      };
    } catch (error) {
      console.error("[PreSaleEngineer] API call failed:", error);
      return this.getEmptyResponse(message);
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

    if (template.includes("{{fieldsDescription}}")) {
      return template.replace("{{fieldsDescription}}", fieldsDescription);
    }

    return `${template}\n\nAvailable sections and fields:\n${fieldsDescription}`;
  }

  async generateConflictQuestion(
    conflictData: StructuredConflicts,
  ): Promise<string> {
    if (!conflictData.conflicts.length) {
      return "No conflicts to resolve.";
    }

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
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: 512,
        temperature: 0.3,
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
- "A"   {"isResolution": true, "choice": "a", "confidence": 1.0, "reasoning": "Direct A choice"}
- "I'll go with the first one"   {"isResolution": true, "choice": "a", "confidence": 0.9, "reasoning": "First implies A"}
- "Tell me more about option B"   {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Question, not choice"}
- "What's the difference?"   {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Asking for info"}
- "Option B please"   {"isResolution": true, "choice": "b", "confidence": 1.0, "reasoning": "Direct B choice"}
`;

      const completion = await this.anthropicService.createMessage({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: 256,
        temperature: 0.0,
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
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: 512,
        temperature: 0.7,
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
    console.log("[PreSaleEngineer] Handling conflict resolution", {
      userMessage,
      conflictData,
      artifactManager,
    });

    if (!conflictData.conflicts.length) {
      return {
        response: "No conflicts to resolve.",
        mode: "no_conflicts",
      };
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

      return {
        response: clarification,
        mode: "clarification_provided",
        conflictId: conflict.id,
      };
    }

    if (parsed.confidence < 0.7) {
      if (artifactManager.incrementConflictCycle) {
        conflicts.forEach((entry) => {
          artifactManager.incrementConflictCycle(entry.id);
        });
      }

      return {
        response: `I'm not sure which option you're choosing. Please respond with either "A" or "B".`,
        mode: "clarification_needed",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
    }

    if (!parsed.choice || !["a", "b"].includes(parsed.choice)) {
      if (artifactManager.incrementConflictCycle) {
        conflicts.forEach((entry) => {
          artifactManager.incrementConflictCycle(entry.id);
        });
      }

      return {
        response: `Please choose either Option A or Option B.`,
        mode: "invalid_choice",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
    }

    const resolutionId = parsed.choice === "a" ? "option-a" : "option-b";
    const selectedOptions = conflicts.map((entry) => ({
      conflictId: entry.id,
      option: entry.resolutionOptions.find(
        (opt: EntryResolutionOption) => opt.id === resolutionId,
      ),
    }));

    if (selectedOptions.some((entry) => !entry.option)) {
      return {
        response: `I encountered an issue applying that choice, because selected option was not found.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
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
        confirmation = `Got it! I've updated your configuration with ${chosenOption.label}.\n\n${chosenOption.outcome}`;
      } else {
        const choiceLabel = parsed.choice === "a" ? "Option A" : "Option B";
        confirmation = `Got it! I've applied ${choiceLabel} across ${resolvedCount} conflict(s).`;
      }

      if (remainingConflicts > 0) {
        confirmation += `\n\n${remainingConflicts} more conflict(s) to resolve.`;
      } else {
        confirmation += `\n\nYour system is now conflict-free. What else would you like to configure?`;
      }

      return {
        response: confirmation,
        mode: "resolution_success",
        conflictId: conflict.id,
        chosenOption,
      };
    } catch (error) {
      console.error("[PreSaleEngineer] Resolution failed:", error);

      return {
        response: `I encountered an issue applying that choice: ${(error as Error).message}\n\nLet me try presenting the options again.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
    }
  }
}

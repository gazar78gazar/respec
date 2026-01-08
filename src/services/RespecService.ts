import { AnthropicService } from "./AnthropicService";
import { PreSaleEngineer } from "./agents/PreSaleEngineer";
import {
  SemanticExtractor,
  createSemanticExtractor,
} from "./agents/SemanticExtractor";
import { LocalPromptProvider } from "./prompts/PromptProvider";
import { LocalSessionStore } from "./LocalSessionStore";
import type { SessionStore } from "./interfaces/SessionStore";
import {
  SemanticIntegrationService,
  createSemanticIntegrationService,
} from "./SemanticIntegrationService";
import { ArtifactManager } from "./ArtifactManager";

import { ucDataLayer } from "./DataLayer";
import type {
  AutofillResult,
  ChatResult,
  EnhancedFormUpdate,
  FormProcessingResult,
  FormUpdate,
  SessionMessage,
  StructuredConflicts,
  Maybe,
} from "../types/service.types";
import type {
  FieldDefinitionInput,
  FieldDefinitions,
  AnthropicAnalysisResult,
} from "../types/semantic.types";

/**
 * RespecService - Orchestrates chat processing and the refactored pipeline.
 *
 * Coordinates LLM extraction, semantic matching, and artifact state updates
 * while exposing UI-ready responses and form updates.
 */

export interface FieldOptionsMap {
  [section: string]: {
    [field: string]: {
      type: FieldDefinitionInput["type"];
      options?: string[]; // For dropdown/multiselect
      min?: number; // For number fields
      max?: number; // For number fields
      validation?: string; // Regex pattern for text
      label?: string; // Human readable label
    };
  };
}

export class RespecService {
  private isInitialized = false;
  private anthropicService: AnthropicService;
  private preSaleEngineer: PreSaleEngineer;
  private promptProvider: LocalPromptProvider;
  private sessionStore: SessionStore;
  private fieldMappings: Map<string, { section: string; field: string }> =
    new Map();
  private fieldOptionsMap: FieldOptionsMap = {};

  // semantic matching system
  private semanticExtractor: Maybe<SemanticExtractor> = null;
  private semanticIntegration: Maybe<SemanticIntegrationService> = null;

  // Core services for conflict detection and resolution
  private artifactManager?: ArtifactManager;

  // Smart defaults based on common engineering requirements
  private smartDefaults = {
    substation: {
      "io.digital_inputs": 16,
      "io.analog_inputs": 8,
      "io.digital_outputs": 8,
      "power.supply_voltage": "24",
      "communication.ethernet": true,
      "communication.modbus": true,
      "environmental.operating_temp_min": "-40",
      "environmental.operating_temp_max": "70",
      "compliance.iec61850": true,
    },
    industrial: {
      "io.digital_inputs": 12,
      "io.analog_inputs": 4,
      "io.digital_outputs": 6,
      "power.supply_voltage": "24",
      "communication.ethernet": true,
      "environmental.operating_temp_min": "0",
      "environmental.operating_temp_max": "60",
    },
    generic: {
      "io.digital_inputs": 8,
      "io.analog_inputs": 2,
      "io.digital_outputs": 4,
      "power.supply_voltage": "12",
      "communication.ethernet": true,
    },
  };

  constructor() {
    this.anthropicService = new AnthropicService();
    this.promptProvider = new LocalPromptProvider();
    this.sessionStore = new LocalSessionStore();
    this.preSaleEngineer = new PreSaleEngineer(
      this.anthropicService,
      this.promptProvider,
      this.sessionStore,
    );
  }

  // Initialize semantic matching system (called externally with dependencies)
  async initializeSemanticMatching(
    artifactManager?: ArtifactManager,
  ): Promise<void> {
    try {
      // Store core services for conflict detection
      this.artifactManager = artifactManager;

      // Listen for respec artifact changes to update form (respec = source of truth)
      // if (artifactManager) {
      //   artifactManager.on("specifications_moved", (data: any) => {
      //     this.handleRespecUpdate(data);
      //   });
      //   console.log(
      //     "[Respec] ✅ Listening for respec artifact changes"
      //   );
      // }

      this.semanticExtractor = createSemanticExtractor(
        this.anthropicService,
        this.promptProvider,
      );
      await this.semanticExtractor.initialize();

      this.semanticIntegration = createSemanticIntegrationService(
        this.semanticExtractor,
        artifactManager,
      );

      console.log("[Respec] ✅ semantic matching initialized");
      console.log("[Respec] - SemanticExtractor: ready");
      console.log("[Respec] - SemanticIntegrationService: ready");
    } catch (error) {
      console.error("[Respec] Failed to initialize semantic matching:", error);
    }
  }

  async initialize(fieldDefinitions?: FieldDefinitions): Promise<void> {
    if (this.isInitialized) {
      console.log("[Respec] Already initialized");
      return;
    }

    try {
      if (ucDataLayer.isLoaded()) {
        console.log("[Respec] Using UC8 Data Layer for field mappings");
        this.extractFieldMappingsFromDataLayer();
        console.log(
          "[Respec] UC8 field mappings extracted:",
          this.fieldMappings.size,
          "mappings",
        );
      } else {
        console.error("[Respec] UC8 not loaded");
      }
    } catch (error) {
      console.warn("[Respec] Failed to load field mappings:", error);
    }

    // Initialize pre sale engineer agent with field mappings
    await this.preSaleEngineer.initialize(this.getFieldMappingsForPrompt());

    // Build field options map if field definitions provided
    if (fieldDefinitions) {
      this.buildFieldOptionsMap(fieldDefinitions);
      console.log(
        "[Respec] Field options map built with",
        Object.keys(this.fieldOptionsMap).length,
        "sections",
      );
    }

    this.isInitialized = true;
    console.log("[Respec] Initialization complete");
  }

  private extractFieldMappingsFromDataLayer(): void {
    console.log("[Respec] Extracting field mappings from UC8 Data Layer");

    const specifications = ucDataLayer.getAllSpecifications();
    console.log(
      `[Respec] Found ${specifications.length} specifications in UC8`,
      { specifications },
    );

    specifications.forEach((spec) => {
      if (spec.field_name) {
        const mapping = {
          section:
            ucDataLayer.getUiFieldByFieldName(spec.field_name)?.section || "",
          field: spec.field_name,
        };

        // Store by various possible names the user might use
        const specName = spec.name.toLowerCase().replace(/_/g, " ");
        this.fieldMappings.set(specName, mapping);

        // Also store by the actual field name
        this.fieldMappings.set(spec.field_name, mapping);

        // Store common variations
        if (spec.field_name === "digitalIO") {
          this.fieldMappings.set("digital inputs", mapping);
          this.fieldMappings.set("digital outputs", mapping);
          this.fieldMappings.set("digital i/o", mapping);
        }
        if (spec.field_name === "analogIO") {
          this.fieldMappings.set("analog inputs", mapping);
          this.fieldMappings.set("analog outputs", mapping);
          this.fieldMappings.set("analog i/o", mapping);
        }
      }
    });

    console.log(
      `[Respec] Extracted ${this.fieldMappings.size} field mappings from UC8`,
    );
  }

  private buildFieldOptionsMap(fieldDefinitions: FieldDefinitions): void {
    // Build field options map from form field definitions
    Object.entries(fieldDefinitions).forEach(
      ([section, fields]: [string, Record<string, FieldDefinitionInput>]) => {
        this.fieldOptionsMap[section] = {};
        Object.entries(fields).forEach(
          ([fieldKey, fieldDef]: [string, FieldDefinitionInput]) => {
            this.fieldOptionsMap[section][fieldKey] = {
              type: fieldDef.type,
              options: fieldDef.options,
              min: fieldDef.min,
              max: fieldDef.max,
              validation: fieldDef.validation,
              label: fieldDef.label,
            };
          },
        );
      },
    );

    console.log("[Respec] Built field options map:", {
      sections: Object.keys(this.fieldOptionsMap).length,
      totalFields: Object.values(this.fieldOptionsMap).reduce(
        (sum, section) => sum + Object.keys(section).length,
        0,
      ),
    });
  }

  private getFieldMappingsForPrompt(): Record<string, string[]> {
    // Organize field mappings by section for the Anthropic prompt
    const mappingsBySection: Record<string, string[]> = {};

    this.fieldMappings.forEach((mapping, _name) => {
      if (!mappingsBySection[mapping.section]) {
        mappingsBySection[mapping.section] = [];
      }
      // Avoid duplicates
      if (!mappingsBySection[mapping.section].includes(mapping.field)) {
        mappingsBySection[mapping.section].push(mapping.field);
      }
    });

    return mappingsBySection;
  }

  private identifyRelevantFields(message: string): string[] {
    const relevantFields: string[] = [];
    const messageLower = message.toLowerCase();

    // Search through field mappings to find relevant fields
    this.fieldMappings.forEach((mapping, name) => {
      if (messageLower.includes(name.toLowerCase())) {
        const fieldPath = `${mapping.section}.${mapping.field}`;
        if (!relevantFields.includes(fieldPath)) {
          relevantFields.push(fieldPath);
        }
      }
    });

    // Also check for common patterns and keywords
    const commonFieldPatterns = {
      storage: ["computePerformance.storageCapacity"],
      memory: ["computePerformance.memoryCapacity"],
      processor: ["computePerformance.processorType"],
      cpu: ["computePerformance.processorType"],
      ethernet: ["IOConnectivity.ethernetPorts"],
      digital: ["IOConnectivity.digitalIO"],
      analog: ["IOConnectivity.analogIO"],
      temperature: ["environmentStandards.operatingTemperature"],
      temp: ["environmentStandards.operatingTemperature"],
      power: ["formFactor.maxPowerConsumption"],
      "power consumption": ["formFactor.maxPowerConsumption"],
      "max power": ["formFactor.maxPowerConsumption"],
      watt: ["formFactor.maxPowerConsumption"],
      budget: ["commercial.budgetPerUnit"],
      price: ["commercial.budgetPerUnit"],
      cost: ["commercial.budgetPerUnit"],
      quantity: ["commercial.quantity"],
      qty: ["commercial.quantity"],
    };

    Object.entries(commonFieldPatterns).forEach(([keyword, fields]) => {
      if (messageLower.includes(keyword)) {
        fields.forEach((field) => {
          if (!relevantFields.includes(field)) {
            relevantFields.push(field);
          }
        });
      }
    });

    return relevantFields;
  }

  private buildContextPrompt(
    message: string,
    identifiedFields: string[],
  ): string {
    let prompt = `User request: "${message}"\n\n`;

    if (identifiedFields.length > 0) {
      prompt += `Available field options for this request:\n`;

      identifiedFields.forEach((fieldPath) => {
        const [section, field] = fieldPath.split(".");
        const fieldOptions = this.fieldOptionsMap[section]?.[field];

        if (fieldOptions) {
          prompt += `\n${fieldOptions.label || field}:\n`;
          prompt += `  Type: ${fieldOptions.type}\n`;

          if (fieldOptions.options && fieldOptions.options.length > 0) {
            prompt += `  Available options: [${fieldOptions.options.join(
              ", ",
            )}]\n`;
            prompt += `  Instruction: Select the closest matching option from the available list. If substituting, explain why in substitutionNote.\n`;
          } else if (fieldOptions.type === "number") {
            if (
              fieldOptions.min !== undefined ||
              fieldOptions.max !== undefined
            ) {
              prompt += `  Range: ${fieldOptions.min || "no minimum"} to ${
                fieldOptions.max || "no maximum"
              }\n`;
            }
          } else if (fieldOptions.validation) {
            prompt += `  Validation pattern: ${fieldOptions.validation}\n`;
          }
        }
      });

      prompt += `\nResponse format requirements:\n`;
      prompt += `- If exact requested value is available, use it directly with no substitutionNote\n`;
      prompt += `- If substitution needed, include originalRequest and substitutionNote explaining the choice\n`;
      prompt += `- For dropdown fields, ONLY select from available options\n`;
      prompt += `- For unit conversions (e.g. "half a tera" = 500GB → 512GB), explain the conversion\n`;
    } else {
      prompt += `No specific field options identified. Process as normal requirements extraction.\n`;
    }

    return prompt;
  }

  async processChatMessage(message: string): Promise<ChatResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[Respec] Processing: "${message}"`);

    // Check for active conflicts FIRST - if yes, route to conflict resolution
    const conflictStatus = this.getActiveConflictsForAgent();

    if (conflictStatus.hasConflicts && this.artifactManager) {
      console.log(`[Respec] 🎯 Conflict resolution mode - routing to agent`);

      // Use PreSaleEngineer to handle conflict resolution (parse A/B, resolve, confirm)
      const resolutionResult =
        await this.preSaleEngineer.handleConflictResolution(
          message,
          conflictStatus,
          this.artifactManager,
        );

      const formUpdates =
        resolutionResult.mode === "resolution_success"
          ? this.artifactManager.generateFormUpdatesFromRespec()
          : [];

      return {
        success: true,
        systemMessage: resolutionResult.response,
        formUpdates,
        confidence:
          formUpdates.length > 0
            ? formUpdates.reduce((sum, u) => sum + u.confidence, 0) /
              formUpdates.length
            : 1.0,
      };
    }

    try {
      //New flow with Agent extraction + UC matching
      console.log(
        `[Respec] 🚀 Starting flow: Agent → Integration → UC Matcher`,
      );

      // Identify relevant fields from the message
      const identifiedFields = this.identifyRelevantFields(message);
      console.log(`[Respec] Identified relevant fields:`, identifiedFields);

      // Build context with available options
      const contextPrompt = this.buildContextPrompt(message, identifiedFields); // TODO zeev prompt
      console.log(`[Respec] Built context prompt with field options`, {
        contextPrompt,
      });

      // Step 1: Agent extracts requirements (with conversational flow)
      console.log(`[Respec] 📝 Step 1: Agent extracting requirements...`);
      const anthropicResult: AnthropicAnalysisResult =
        await this.preSaleEngineer.analyzeRequirements(contextPrompt);
      console.log(
        `[Respec] ✅ Agent extracted:`,
        anthropicResult.requirements.length,
        "requirements",
      );

      // Step 2: Route through new semantic integration (if available and requirements exist)
      if (this.semanticIntegration && anthropicResult.requirements.length > 0) {
        console.log(
          `[Respec] 🔍 Step 2: Routing to SemanticIntegrationService...`,
        );

        const enhancedResult =
          await this.semanticIntegration.processExtractedRequirements(
            anthropicResult.requirements,
            anthropicResult.response,
          );

        console.log(
          `[Respec] ✅ processing complete:`,
          enhancedResult.formUpdates?.length || 0,
          "form updates",
        );

        return enhancedResult;
      }

      // Fallback: Use legacy flow if semantic integration not available or no requirements
      console.log(
        `[Respec] ⚠️  No semantic integration or no requirements, using legacy flow`,
      );

      // Convert Anthropic requirements to EnhancedFormUpdate format
      const formUpdates: EnhancedFormUpdate[] =
        anthropicResult.requirements.map((req) => ({
          section: req.section,
          field: req.field,
          value: req.value,
          isAssumption: req.isAssumption,
          confidence: req.confidence,
          originalRequest: req.originalRequest,
          substitutionNote: req.substitutionNote,
        }));

      // Use Anthropic's response
      const systemMessage = anthropicResult.response;

      const result: ChatResult = {
        success: true,
        systemMessage,
        formUpdates,
        confidence:
          formUpdates.length > 0
            ? formUpdates.reduce((sum, u) => sum + u.confidence, 0) /
              formUpdates.length
            : 0.5,
        clarificationNeeded: anthropicResult.clarificationNeeded,
      };

      return result;
    } catch (error) {
      console.error("[Respec] ❌ LLM processing failed:", error);
      throw error; // Fail fast for MVP
    }
  }

  /**
   * Get active conflicts formatted for agent consumption
   * Returns structured conflict data to agent for binary question generation
   * Enhanced with priority queue (one conflict at a time)
   */
  getActiveConflictsForAgent(): StructuredConflicts {
    if (!this.artifactManager) {
      return {
        hasConflicts: false,
        count: 0,
        currentConflict: 0,
        totalConflicts: 0,
        systemBlocked: false,
        conflicts: [],
      };
    }

    const state = this.artifactManager.getState();
    let activeConflicts = state.conflicts.active;

    if (activeConflicts.length === 0) {
      return {
        hasConflicts: false,
        count: 0,
        currentConflict: 0,
        totalConflicts: 0,
        systemBlocked: false,
        conflicts: [],
      };
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = {
      exclusion: 1,
      field_overwrite: 2,
      cascade: 3,
      field_constraint: 3,
    };

    activeConflicts = [...activeConflicts].sort((a, b) => {
      const priorityA = priorityOrder[a.type as string] || 99;
      const priorityB = priorityOrder[b.type as string] || 99;
      return priorityA - priorityB;
    });

    // Return ALL conflicts (agent will aggregate into one question)
    const structuredConflicts = activeConflicts.map((conflict) => ({
      id: conflict.id,
      type: conflict.type,
      description: conflict.description,
      affectedNodes: conflict.affectedNodes.map((nodeId) => ({
        id: nodeId,
        ...this.getNodeDetails(nodeId),
      })),
      resolutionOptions: conflict.resolutionOptions.map((option) => ({
        id: option.id,
        label: option.description,
        outcome: option.expectedOutcome,
      })),
      cycleCount: conflict.cycleCount,
      priority: (conflict.type === "field_overwrite" ? "critical" : "high") as
        | "critical"
        | "high",
    }));

    console.log(
      "[Conflicts] total",
      structuredConflicts.length,
      structuredConflicts,
    );

    return {
      hasConflicts: true,
      count: activeConflicts.length, // Total count for transparency
      currentConflict: 1, // Currently handling first batch
      totalConflicts: activeConflicts.length, // For progress indicators
      systemBlocked: state.conflicts.metadata.systemBlocked,
      conflicts: structuredConflicts, // ALL conflicts for agent aggregation
    };
  }

  async generateConflictQuestion(
    conflictStatus: StructuredConflicts,
  ): Promise<string> {
    const question =
      await this.preSaleEngineer.generateConflictQuestion(conflictStatus);
    await this.recordAssistantMessage(question);
    return question;
  }

  /**
   * Get node details for conflict display
   * Helper for structuring conflict data
   */
  private getNodeDetails(nodeId: string): {
    name: string;
    value?: unknown;
    hierarchy?: { domain: string; requirement: string };
  } {
    if (!this.artifactManager) return { name: nodeId };

    const spec = this.artifactManager.findSpecificationInArtifact(
      "mapped",
      nodeId,
    );

    return {
      name: spec?.name || nodeId,
      value: spec?.value,
    };
  }

  async processFormUpdate(
    section: string,
    field: string,
    value: unknown,
  ): Promise<FormProcessingResult> {
    console.log(`[Respec] Form update: ${section}.${field} = ${value}`);

    // Generate contextual acknowledgment
    const acknowledgment = this.generateFormAcknowledgment(
      section,
      field,
      value,
    );

    if (acknowledgment) {
      await this.recordAssistantMessage(acknowledgment);
    }

    return {
      acknowledged: true,
      acknowledgment,
    };
  }

  /**
   * Handle respec artifact updates (SPRINT 3 FIX)
   * When specs move to respec, generate form updates and push to UI
   * This ensures respec is the single source of truth
   */
  // private handleRespecUpdate(data: any): void {
  //   console.log("[Respec] 🔔 Respec artifact updated:", data);

  // TODO: For now, this logs the update. In async conflict resolution scenarios,
  // we'll need to generate form updates and push them to the UI through a callback
  // or event mechanism. For the current flow (same-request updates), the form
  // updates are already generated from respec in SemanticIntegrationService.

  // Future enhancement: Store pending form updates and return them on next poll
  // or emit events that app.tsx listens to for real-time updates
  // }

  async triggerAutofill(trigger: string): Promise<AutofillResult> {
    console.log(`[Respec] Autofill triggered: ${trigger}`);

    // Determine context from conversation history
    const context = await this.determineApplicationContext();

    // Get appropriate defaults
    const defaults =
      this.smartDefaults[context as keyof typeof this.smartDefaults] ||
      this.smartDefaults.generic;

    // Convert to form updates
    const fields: FormUpdate[] = Object.entries(defaults).map(
      ([path, value]) => {
        const [section, field] = path.split(".");
        return {
          section,
          field,
          value,
          isAssumption: true,
          confidence: 0.8,
        };
      },
    );

    const message = this.generateAutofillMessage(
      context,
      trigger,
      fields.length,
    );

    return {
      message,
      fields,
      trigger,
    };
  }

  private generateFormAcknowledgment(
    section: string,
    field: string,
    value: unknown,
  ): string {
    const friendlyName = this.getFriendlyFieldName(section, field);

    const acknowledgments = [
      `${friendlyName} selection noted.`,
      `Updated ${friendlyName} to ${value}.`,
      `${friendlyName} has been set to ${value}.`,
      `Noted: ${friendlyName} = ${value}.`,
    ];

    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  }

  private generateAutofillMessage(
    context: string,
    trigger: string,
    fieldCount: number,
  ): string {
    const contextMessages = {
      substation: `Based on typical substation requirements, I've filled in ${fieldCount} common specifications as assumptions.`,
      industrial: `Based on common industrial automation needs, I've added ${fieldCount} typical requirements as assumptions.`,
      generic: `I've filled in ${fieldCount} common electronic system requirements as assumptions.`,
    };

    let message =
      contextMessages[context as keyof typeof contextMessages] ||
      contextMessages.generic;

    if (trigger === "dont_know") {
      message +=
        " You can modify any of these that don't fit your specific needs.";
    } else if (trigger === "button_header") {
      message +=
        " These are marked as assumptions - review and update as needed.";
    }

    return message;
  }

  /* DISABLED
  private generateClarificationQuestion(analysis: any): string {
    if (analysis.requirements.length === 0) {
      return "Could you provide more specific details about your requirements? For example, how many inputs/outputs do you need?";
    }

    const questions = [
      "Could you confirm the exact quantities you need?",
      "What voltage levels are you working with?",
      "Are there specific communication protocols required?",
      "What's the intended application for this system?",
    ];

    return questions[Math.floor(Math.random() * questions.length)];
  }
  END DISABLED */

  private getFriendlyFieldName(section: string, field: string): string {
    const friendlyNames: Record<string, Record<string, string>> = {
      io: {
        digital_inputs: "Digital Inputs",
        digital_outputs: "Digital Outputs",
        analog_inputs: "Analog Inputs",
        analog_outputs: "Analog Outputs",
      },
      power: {
        supply_voltage: "Supply Voltage",
      },
      communication: {
        ethernet: "Ethernet",
        modbus: "Modbus",
      },
    };

    return friendlyNames[section]?.[field] || `${section}.${field}`;
  }

  private async recordAssistantMessage(message: string): Promise<void> {
    if (!message) return;

    const entry: SessionMessage = {
      role: "assistant",
      content: message,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.sessionStore.append(
        this.preSaleEngineer.getSessionId(),
        entry,
      );
      await this.sessionStore.trim(
        this.preSaleEngineer.getSessionId(),
        this.preSaleEngineer.getAgentConfig().maxSessionTurns,
      );
    } catch (error) {
      console.warn("[Respec] Failed to record assistant message:", error);
    }
  }

  private async determineApplicationContext(): Promise<string> {
    const recentMessages = await this.getRecentConversationText();

    if (recentMessages.includes("substation")) return "substation";
    if (
      recentMessages.includes("industrial") ||
      recentMessages.includes("factory")
    )
      return "industrial";
    return "generic";
  }

  private async getRecentConversationText(): Promise<string> {
    try {
      const history = await this.sessionStore.getHistory(
        this.preSaleEngineer.getSessionId(),
      );
      return history
        .slice(-5)
        .map((entry) => entry.content)
        .join(" ")
        .toLowerCase();
    } catch (error) {
      console.warn("[Respec] Could not read conversation history:", error);
      return "";
    }
  }
}

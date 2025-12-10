import { v4 as uuidv4 } from "uuid";
import { AnthropicService } from "./AnthropicService";
import { SemanticMatcher, createSemanticMatcher } from "./SemanticMatcher";
import {
  SemanticMatchingService,
  createSemanticMatchingService,
} from "./SemanticMatchingService";
import {
  SemanticIntegrationService as SemanticIntegrationServiceNew,
  createSemanticIntegrationService as createSemanticIntegrationServiceNew,
} from "./SemanticIntegrationService";
import { ArtifactManager } from "./ArtifactManager";

// Sprint 1: Import UC8 Data Layer
import { ucDataLayer } from "./DataLayer";
import type { Maybe } from "../types/UCDataTypes";

type FieldDefinitionInput = {
  type: string;
  options?: string[];
  min?: number;
  max?: number;
  validation?: string;
  label?: string;
  group?: string;
};

type FieldDefinitions = Record<string, Record<string, FieldDefinitionInput>>;

// Simplified interfaces for the browser-only service
export interface ChatResult {
  success: boolean;
  systemMessage: string;
  formUpdates?: EnhancedFormUpdate[];
  clarificationNeeded?: string;
  confidence: number;
  conflictData?: unknown; // Sprint 3 Week 1: Conflict information for agent
}

export interface FormUpdate {
  section: string;
  field: string;
  value: unknown;
  isAssumption: boolean;
  confidence: number;
}

export interface EnhancedFormUpdate extends FormUpdate {
  originalRequest?: string; // What user asked for
  substitutionNote?: string; // Explanation if different
}

export interface FieldOptionsMap {
  [section: string]: {
    [field: string]: {
      type: "dropdown" | "text" | "number" | "multiselect" | "date";
      options?: string[]; // For dropdown/multiselect
      min?: number; // For number fields
      max?: number; // For number fields
      validation?: string; // Regex pattern for text
      label?: string; // Human readable label
    };
  };
}

export interface FormProcessingResult {
  acknowledged: boolean;
  acknowledgment?: string;
  suggestions?: FormUpdate[];
}

export interface AutofillResult {
  message: string;
  fields: FormUpdate[];
  trigger: string;
}

export type EntryResolutionOption = {
  id: string;
  label: string;
  outcome: string;
};

export type StrucureConflictEntry = {
  id: string;
  type: string;
  description: string;
  affectedNodes: unknown;
  resolutionOptions: EntryResolutionOption[];
  cycleCount: number;
  priority: "critical" | "high";
};

export interface StructuredConflicts {
  hasConflicts: boolean;
  count: number; // Total count for transparency
  currentConflict: number; // Currently handling first batch
  totalConflicts: number; // For progress indicators
  systemBlocked: boolean;
  conflicts: StrucureConflictEntry[]; // ALL conflicts for agent aggregation
}

export class RespecService {
  private sessionId: string;
  private conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }> = [];
  private isInitialized = false;
  private anthropicService: AnthropicService;
  private fieldMappings: Map<string, { section: string; field: string }> =
    new Map();
  private fieldOptionsMap: FieldOptionsMap = {};

  // New semantic matching system (Sprint 2)
  private semanticMatcher: Maybe<SemanticMatcher> = null;
  private semanticMatchingService: Maybe<SemanticMatchingService> = null;
  private semanticIntegrationNew: Maybe<SemanticIntegrationServiceNew> = null;

  // Sprint 3 Week 1: Core services for conflict detection and resolution
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
    this.sessionId = uuidv4();
    this.anthropicService = new AnthropicService();
  }

  // Initialize semantic matching system (called externally with dependencies)
  async initializeSemanticMatching(
    artifactManager?: ArtifactManager,
  ): Promise<void> {
    try {
      // Sprint 3 Week 1: Store core services for conflict detection
      this.artifactManager = artifactManager;

      // SPRINT 3 FIX: Listen for respec artifact changes to update form (respec = source of truth)
      // if (artifactManager) {
      //   artifactManager.on("specifications_moved", (data: any) => {
      //     this.handleRespecUpdate(data);
      //   });
      //   console.log(
      //     "[SimplifiedRespec] ✅ Listening for respec artifact changes"
      //   );
      // }

      // Sprint 2: Initialize new SemanticMatchingService
      this.semanticMatchingService = createSemanticMatchingService();
      await this.semanticMatchingService.initialize();

      this.semanticIntegrationNew = createSemanticIntegrationServiceNew(
        this.semanticMatchingService,
        artifactManager,
      );

      // Keep old services for backward compatibility (temporarily)
      this.semanticMatcher = createSemanticMatcher();
      this.semanticMatcher.initialize(artifactManager);

      console.log(
        "[SimplifiedRespec] ✅ Sprint 2 semantic matching initialized",
      );
      console.log("[SimplifiedRespec] - SemanticMatchingService: ready");
      console.log("[SimplifiedRespec] - SemanticIntegrationService: ready");
    } catch (error) {
      console.error(
        "[SimplifiedRespec] Failed to initialize semantic matching:",
        error,
      );
    }
  }

  async initialize(fieldDefinitions?: FieldDefinitions): Promise<void> {
    if (this.isInitialized) {
      console.log("[SimplifiedRespec] Already initialized");
      return;
    }

    console.log(`[SimplifiedRespec] Initializing session: ${this.sessionId}`);

    // Sprint 1: Use UC8 Data Layer for field mappings
    try {
      if (ucDataLayer.isLoaded()) {
        console.log(
          "[SimplifiedRespec] Using UC8 Data Layer for field mappings",
        );
        this.extractFieldMappingsFromDataLayer();
        console.log(
          "[SimplifiedRespec] UC8 field mappings extracted:",
          this.fieldMappings.size,
          "mappings",
        );
      } else {
        console.error("[SimplifiedRespec] UC8 not loaded");
      }
    } catch (error) {
      console.warn("[SimplifiedRespec] Failed to load field mappings:", error);
      // this.loadFallbackMappings();
    }

    // Initialize Anthropic service with field mappings
    await this.anthropicService.initialize(this.getFieldMappingsForPrompt());

    // Load any persisted conversation or settings
    try {
      const savedSession = localStorage.getItem(
        `respec_session_${this.sessionId}`,
      );
      if (savedSession) {
        const data = JSON.parse(savedSession);
        this.conversationHistory = data.conversationHistory || [];
      }
    } catch (error) {
      console.warn("[SimplifiedRespec] Could not load saved session:", error);
    }

    // Build field options map if field definitions provided
    if (fieldDefinitions) {
      this.buildFieldOptionsMap(fieldDefinitions);
      console.log(
        "[SimplifiedRespec] Field options map built with",
        Object.keys(this.fieldOptionsMap).length,
        "sections",
      );
    }

    this.isInitialized = true;
    console.log("[SimplifiedRespec] Initialization complete");
  }

  /**
   * Sprint 1: Extract field mappings from UC8 Data Layer
   */
  private extractFieldMappingsFromDataLayer(): void {
    console.log(
      "[SimplifiedRespec] Extracting field mappings from UC8 Data Layer",
    );

    const specifications = ucDataLayer.getAllSpecifications();
    console.log(
      `[SimplifiedRespec] Found ${specifications.length} specifications in UC8`,
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
      `[SimplifiedRespec] Extracted ${this.fieldMappings.size} field mappings from UC8`,
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

    console.log("[SimplifiedRespec] Built field options map:", {
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

  getSessionId(): string {
    return this.sessionId;
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

    console.log(`[SimplifiedRespec] Processing: "${message}"`);

    // Sprint 3: Check for active conflicts FIRST - if yes, route to conflict resolution
    const conflictStatus = this.getActiveConflictsForAgent();

    if (conflictStatus.hasConflicts && this.artifactManager) {
      console.log(
        `[SimplifiedRespec] 🎯 Conflict resolution mode - routing to agent`,
      );

      // Use AnthropicService to handle conflict resolution (parse A/B, resolve, confirm)
      const resolutionResult =
        await this.anthropicService.handleConflictResolution(
          message,
          conflictStatus,
          this.artifactManager,
        );

      const formUpdates =
        resolutionResult.mode === "resolution_success"
          ? this.generateFormUpdatesFromRespec()
          : [];

      // Add to conversation history
      this.conversationHistory.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });

      this.conversationHistory.push({
        role: "assistant",
        content: resolutionResult.response,
        timestamp: new Date(),
      });

      this.saveSession();

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

    // Add to conversation history
    this.conversationHistory.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    try {
      // Sprint 2: New flow with Agent extraction + UC matching
      console.log(
        `[SimplifiedRespec] 🚀 Starting Sprint 2 flow: Agent → Integration → UC Matcher`,
      );

      // Identify relevant fields from the message
      const identifiedFields = this.identifyRelevantFields(message);
      console.log(
        `[SimplifiedRespec] Identified relevant fields:`,
        identifiedFields,
      );

      // Build context with available options
      const contextPrompt = this.buildContextPrompt(message, identifiedFields);
      console.log(`[SimplifiedRespec] Built context prompt with field options`);

      // Step 1: Agent extracts requirements (with conversational flow)
      console.log(
        `[SimplifiedRespec] 📝 Step 1: Agent extracting requirements...`,
      );
      const anthropicResult = await this.anthropicService.analyzeRequirements(
        contextPrompt,
        {
          conversationHistory: this.conversationHistory.slice(-5), // Last 5 messages for context
          sessionId: this.sessionId,
        },
      );
      console.log(
        `[SimplifiedRespec] ✅ Agent extracted:`,
        anthropicResult.requirements.length,
        "requirements",
      );

      // Step 2: Route through new semantic integration (if available and requirements exist)
      if (
        this.semanticIntegrationNew &&
        anthropicResult.requirements.length > 0
      ) {
        console.log(
          `[SimplifiedRespec] 🔍 Step 2: Routing to SemanticIntegrationService...`,
        );

        const enhancedResult =
          await this.semanticIntegrationNew.processExtractedRequirements(
            anthropicResult.requirements,
            anthropicResult.response,
          );

        console.log(
          `[SimplifiedRespec] ✅ Sprint 2 processing complete:`,
          enhancedResult.formUpdates?.length || 0,
          "form updates",
        );

        // Add assistant response to history
        this.conversationHistory.push({
          role: "assistant",
          content: enhancedResult.systemMessage,
          timestamp: new Date(),
        });

        // Persist conversation
        this.saveSession();

        return enhancedResult;
      }

      // Fallback: Use legacy flow if semantic integration not available or no requirements
      console.log(
        `[SimplifiedRespec] ⚠️  No semantic integration or no requirements, using legacy flow`,
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

      // Add assistant response to history
      this.conversationHistory.push({
        role: "assistant",
        content: systemMessage,
        timestamp: new Date(),
      });

      // Persist conversation
      this.saveSession();

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
      console.error("[SimplifiedRespec] ❌ LLM processing failed:", error);
      throw error; // Fail fast for MVP (Sprint 2 requirement)
    }
  }

  /**
   * Get active conflicts formatted for agent consumption
   * Sprint 3 Week 1: Returns structured conflict data to agent for binary question generation
   * Sprint 3 Week 2: Enhanced with priority queue (one conflict at a time)
   */
  getActiveConflictsForAgent(): StructuredConflicts {
    if (!this.artifactManager) {
      return { hasConflicts: false, conflicts: [] };
    }

    const state = this.artifactManager.getState();
    let activeConflicts = state.conflicts.active;

    if (activeConflicts.length === 0) {
      return { hasConflicts: false, conflicts: [] };
    }

    // Sprint 3 Week 2: Sort by priority
    const priorityOrder: Record<string, number> = {
      "cross-artifact": 1, // Highest - user changing existing choices
      cross_artifact: 1, // Handle underscore variant
      logical: 2, // High - fundamental incompatibilities
      constraint: 3, // Medium - schema violations
      dependency: 3, // Medium - missing requirements
      mutex: 4, // Low - multiple selections
    };

    activeConflicts = [...activeConflicts].sort((a, b) => {
      const priorityA = priorityOrder[a.type as string] || 99;
      const priorityB = priorityOrder[b.type as string] || 99;
      return priorityA - priorityB;
    });

    // SPRINT 3 FIX B: Return ALL conflicts (agent will aggregate into one question)
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
      priority: conflict.type === "cross_artifact" ? "critical" : "high", // TODO zeev conflict fix cross_artifact type. What is it?
    }));

    return {
      hasConflicts: true,
      count: activeConflicts.length, // Total count for transparency
      currentConflict: 1, // Currently handling first batch
      totalConflicts: activeConflicts.length, // For progress indicators
      systemBlocked: state.conflicts.metadata.systemBlocked,
      conflicts: structuredConflicts, // ALL conflicts for agent aggregation
    };
  }

  /**
   * Get node details for conflict display
   * Sprint 3 Week 1: Helper for structuring conflict data
   */
  private getNodeDetails(nodeId: string): {
    name: string;
    value?: unknown;
    hierarchy?: { domain: string; requirement: string };
  } {
    if (!this.artifactManager) return {};

    // const hierarchy = this.ucEngine.getHierarchy(nodeId);
    const hierarchy = null;
    const spec = this.artifactManager.findSpecificationInArtifact(
      "mapped",
      nodeId,
    );

    if (!hierarchy) return { name: nodeId };

    return {
      name: spec?.name || nodeId,
      value: spec?.value,
      hierarchy: hierarchy
        ? {
            domain: hierarchy.domain,
            requirement: hierarchy.requirement,
          }
        : undefined,
    };
  }

  /**
   * Build form updates from the current respec artifact (post-conflict resolution).
   * This ensures the UI reflects the latest approved specifications.
   */
  private generateFormUpdatesFromRespec(): EnhancedFormUpdate[] {
    if (!this.artifactManager) return [];

    return this.artifactManager.generateFormUpdatesFromRespec() as EnhancedFormUpdate[];
  }

  async processFormUpdate(
    section: string,
    field: string,
    value: unknown,
  ): Promise<FormProcessingResult> {
    console.log(
      `[SimplifiedRespec] Form update: ${section}.${field} = ${value}`,
    );

    // Generate contextual acknowledgment
    const acknowledgment = this.generateFormAcknowledgment(
      section,
      field,
      value,
    );

    if (acknowledgment) {
      this.conversationHistory.push({
        role: "assistant",
        content: acknowledgment,
        timestamp: new Date(),
      });
      this.saveSession();
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
  //   console.log("[SimplifiedRespec] 🔔 Respec artifact updated:", data);

  // TODO: For now, this logs the update. In async conflict resolution scenarios,
  // we'll need to generate form updates and push them to the UI through a callback
  // or event mechanism. For the current flow (same-request updates), the form
  // updates are already generated from respec in SemanticIntegrationService.

  // Future enhancement: Store pending form updates and return them on next poll
  // or emit events that app.tsx listens to for real-time updates
  // }

  async triggerAutofill(trigger: string): Promise<AutofillResult> {
    console.log(`[SimplifiedRespec] Autofill triggered: ${trigger}`);

    // Determine context from conversation history
    const context = this.determineApplicationContext();

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

  private determineApplicationContext(): string {
    const recentMessages = this.conversationHistory
      .slice(-5)
      .map((entry) => entry.content)
      .join(" ")
      .toLowerCase();

    if (recentMessages.includes("substation")) return "substation";
    if (
      recentMessages.includes("industrial") ||
      recentMessages.includes("factory")
    )
      return "industrial";
    return "generic";
  }

  private saveSession(): void {
    try {
      const sessionData = {
        conversationHistory: this.conversationHistory,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(
        `respec_session_${this.sessionId}`,
        JSON.stringify(sessionData),
      );
    } catch (error) {
      console.warn("[SimplifiedRespec] Could not save session:", error);
    }
  }

  // Debug and utility methods
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  clearSession(): void {
    this.conversationHistory = [];
    localStorage.removeItem(`respec_session_${this.sessionId}`);
    console.log("[SimplifiedRespec] Session cleared");
  }

  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      isInitialized: this.isInitialized,
      conversationLength: this.conversationHistory.length,
      lastActivity:
        this.conversationHistory[this.conversationHistory.length - 1]
          ?.timestamp,
    };
  }

  /**
   * Sprint 3: Expose ArtifactManager for event listener setup
   */
  getArtifactManager(): ArtifactManager | undefined {
    return this.artifactManager;
  }
}

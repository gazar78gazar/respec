import { AnthropicService } from "./AnthropicService";
import { PreSaleEngineer } from "./agents/PreSaleEngineer";
import { LocalPromptProvider } from "./PromptProvider";
import { LocalSessionStore } from "./LocalSessionStore";
import type { SessionStore } from "./interfaces/SessionStore";
import { ArtifactManager } from "./ArtifactManager";

import { ucDataLayer } from "./DataLayer";
import type { ActiveConflict } from "../types/artifacts.types";
import type {
  FieldMapping,
  FieldOptionsMap,
  RespecFieldSnapshot,
  RespecFieldSnapshotEntry,
  RespecFormUpdateOptions,
  RespecMatchSelection,
  RespecSelectionMatch,
} from "../types/respec.types";
import type {
  AutofillResult,
  ChatResult,
  EnhancedFormUpdate,
  FormProcessingResult,
  FormUpdate,
  SessionMessage,
} from "../types/service.types";
import type {
  FieldDefinitionInput,
  FieldDefinitions,
  AgentAnalysisResult,
  AgentRequirement,
} from "../types/semantic.types";

/**
 * RespecService - Orchestrates chat processing and the refactored pipeline.
 *
 * Coordinates LLM extraction and artifact state updates while exposing
 * UI-ready responses and form updates.
 */

export class RespecService {
  private isInitialized = false;
  private anthropicService: AnthropicService;
  private preSaleEngineer: PreSaleEngineer;
  private promptProvider: LocalPromptProvider;
  private sessionStore: SessionStore;
  private fieldMappings: Map<string, FieldMapping> = new Map();
  private fieldOptionsMap: FieldOptionsMap = {};

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

  public constructor() {
    this.anthropicService = new AnthropicService();
    this.promptProvider = new LocalPromptProvider();
    this.sessionStore = new LocalSessionStore();
    this.preSaleEngineer = new PreSaleEngineer(
      this.anthropicService,
      this.promptProvider,
      this.sessionStore,
    );
  }

  public async initialize(fieldDefinitions?: FieldDefinitions): Promise<void> {
    if (this.isInitialized) {
      console.log("!!! [Respec] Already initialized");
      return;
    }

    try {
      if (ucDataLayer.isLoaded()) {
        console.log("!!! [Respec] Using UC8 Data Layer for field mappings");
        this.extractFieldMappingsFromDataLayer();
        console.log(
          "!!! [Respec] UC8 field mappings extracted:",
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
        "!!! [Respec] Field options map built with",
        Object.keys(this.fieldOptionsMap).length,
        "sections",
      );
    }

    this.isInitialized = true;
    console.log("!!! [Respec] Initialization complete");
  }

  public setArtifactManager(artifactManager: ArtifactManager): void {
    this.artifactManager = artifactManager;
  }

  private extractFieldMappingsFromDataLayer(): void {
    console.log("!!! [Respec] Extracting field mappings from UC8 Data Layer");

    const specifications = ucDataLayer.getAllSpecifications();
    console.log(
      `!!! [Respec] Found ${specifications.length} specifications in UC8`,
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
      `!!! [Respec] Extracted ${this.fieldMappings.size} field mappings from UC8`,
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

    console.log("!!! [Respec] Built field options map:", {
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
      if (!mappingsBySection[mapping.section])
        mappingsBySection[mapping.section] = [];
      // Avoid duplicates
      if (!mappingsBySection[mapping.section].includes(mapping.field))
        mappingsBySection[mapping.section].push(mapping.field);
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
        if (!relevantFields.includes(fieldPath)) relevantFields.push(fieldPath);
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
      if (messageLower.includes(keyword))
        fields.forEach((field) => {
          if (!relevantFields.includes(field)) relevantFields.push(field);
        });
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
          } else if (
            fieldOptions.type === "number" &&
            (fieldOptions.min !== undefined || fieldOptions.max !== undefined)
          )
            prompt += `  Range: ${fieldOptions.min || "no minimum"} to ${
              fieldOptions.max || "no maximum"
            }\n`;
          else if (fieldOptions.type !== "number" && fieldOptions.validation)
            prompt += `  Validation pattern: ${fieldOptions.validation}\n`;
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

  private getRespecFieldSnapshot(): RespecFieldSnapshot {
    const snapshot: RespecFieldSnapshot = new Map();

    if (!this.artifactManager) return snapshot;
    if (!ucDataLayer.isLoaded()) return snapshot;

    const respecSpecs = this.artifactManager.getState().respec.specifications;
    const bestByField = new Map<string, (typeof respecSpecs)[string]>();

    Object.values(respecSpecs).forEach((spec) => {
      const fullSpec = ucDataLayer.getSpecification(spec.id);
      const fieldName = fullSpec?.field_name || spec.ucSource?.field_name;
      if (!fieldName) return;

      const existing = bestByField.get(fieldName);
      if (!existing || (spec.confidence || 0) > (existing.confidence || 0))
        bestByField.set(fieldName, spec);
    });

    bestByField.forEach((spec, fieldName) => {
      const fullSpec = ucDataLayer.getSpecification(spec.id);
      const selectedValue =
        fullSpec?.selected_value ??
        (spec.value as string | number | boolean | string[] | null) ??
        fullSpec?.name ??
        null;

      const entry: RespecFieldSnapshotEntry = {
        specId: spec.id,
        value: selectedValue,
        isAssumption: spec.attribution === "assumption",
        confidence: spec.confidence || 1,
        originalRequest: spec.originalRequest,
        substitutionNote: spec.substitutionNote,
      };
      snapshot.set(fieldName, entry);
    });

    return snapshot;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false;
      if (left.length !== right.length) return false;
      return left.every((value, index) => value === right[index]);
    }
    return left === right;
  }

  private buildRespecDeltaUpdates(
    before: RespecFieldSnapshot,
    after: RespecFieldSnapshot,
  ): EnhancedFormUpdate[] {
    const updates: EnhancedFormUpdate[] = [];

    const allFields = new Set([...before.keys(), ...after.keys()]);
    allFields.forEach((fieldName) => {
      const beforeEntry = before.get(fieldName);
      const afterEntry = after.get(fieldName);

      const beforeValue = beforeEntry?.value ?? null;
      const afterValue = afterEntry?.value ?? null;
      const beforeAssumption = beforeEntry?.isAssumption ?? false;
      const afterAssumption = afterEntry?.isAssumption ?? false;

      if (
        this.valuesEqual(beforeValue, afterValue) &&
        beforeAssumption === afterAssumption
      )
        return;

      const uiField = ucDataLayer.getUiFieldByFieldName(fieldName);
      if (!uiField) return;

      if (afterEntry) {
        updates.push({
          section: uiField.section,
          field: uiField.field_name,
          value: afterValue,
          confidence: afterEntry.confidence,
          isAssumption: afterAssumption,
          originalRequest: afterEntry.originalRequest,
          substitutionNote: afterEntry.substitutionNote,
        });
        return;
      }

      updates.push({
        section: uiField.section,
        field: uiField.field_name,
        value: null,
        confidence: 1,
        isAssumption: false,
        originalRequest: "",
        substitutionNote: "Cleared because no specification is selected",
      });
    });

    return updates;
  }

  private parseConflictChoice(message: string): "a" | "b" | null {
    const normalized = message.toLowerCase().trim();
    if (
      normalized === "a" ||
      normalized === "option a" ||
      normalized === "first" ||
      normalized === "first one"
    )
      return "a";
    if (
      normalized === "b" ||
      normalized === "option b" ||
      normalized === "second" ||
      normalized === "second one"
    )
      return "b";
    return null;
  }

  private buildConflictResult(conflict: ActiveConflict): ChatResult {
    const question =
      this.artifactManager?.buildConflictQuestion(conflict) ||
      `I detected a conflict: ${conflict.description}`;
    return {
      success: true,
      systemMessage: question,
      formUpdates: [],
      confidence: 1,
    };
  }

  private async handleConflictResponse(
    message: string,
    conflict: ActiveConflict,
  ): Promise<ChatResult> {
    if (!this.artifactManager)
      return {
        success: false,
        systemMessage: "Conflict handling is unavailable.",
        formUpdates: [],
        confidence: 0,
      };

    const directChoice = this.parseConflictChoice(message);
    const choice =
      directChoice ||
      (await this.preSaleEngineer.interpretConflictChoice(message, conflict));

    if (!choice) return this.buildConflictResult(conflict);

    const respecSnapshotBefore = this.getRespecFieldSnapshot();
    await this.artifactManager.applyConflictChoice(conflict.id, choice);

    const nextConflict = this.artifactManager.getPendingConflict();
    if (nextConflict) return this.buildConflictResult(nextConflict);

    const respecSnapshotAfter = this.getRespecFieldSnapshot();
    const respecDeltaUpdates = this.buildRespecDeltaUpdates(
      respecSnapshotBefore,
      respecSnapshotAfter,
    );
    if (respecDeltaUpdates.length > 0)
      console.log(
        "!!! [Respec] ?? Using respec updates for",
        respecDeltaUpdates.length,
        "fields",
      );
    const updates =
      respecDeltaUpdates.length > 0
        ? respecDeltaUpdates
        : this.artifactManager.generateFormUpdatesFromRespec();
    return {
      success: true,
      systemMessage: "Conflict resolved. Updating your selections.",
      formUpdates: updates,
      confidence:
        updates.length > 0
          ? updates.reduce((sum, u) => sum + u.confidence, 0) / updates.length
          : 1,
    };
  }

  public async processChatMessage(message: string): Promise<ChatResult> {
    if (!this.isInitialized) await this.initialize();

    console.log(`!!! [Respec] Processing: "${message}"`);

    const pendingConflict = this.artifactManager?.getPendingConflict();
    if (pendingConflict) {
      console.log("!!! [Respec] Conflict pending - resolving");
      return this.handleConflictResponse(message, pendingConflict);
    }

    try {
      // New flow with agent extraction
      console.log(`!!! [Respec] ?? Starting flow: Agent extraction`);

      // Identify relevant fields from the message
      const identifiedFields = this.identifyRelevantFields(message);
      console.log(`!!! [Respec] Identified relevant fields:`, identifiedFields);

      // Build context with available options
      const contextPrompt = this.buildContextPrompt(message, identifiedFields);
      console.log(`!!! [Respec] Built context prompt with field options`, {
        contextPrompt,
      });

      // Step 1: Agent extracts requirements (with conversational flow)
      console.log(`!!! [Respec] 📝 Step 1: Agent extracting requirements...`);
      const agentResult: AgentAnalysisResult =
        await this.preSaleEngineer.analyzeRequirements(contextPrompt);
      const respecSnapshotBefore = this.getRespecFieldSnapshot();
      await this.syncSelectionsToArtifacts(agentResult.requirements);
      const conflictAfterSync = this.artifactManager?.getPendingConflict();
      if (conflictAfterSync) return this.buildConflictResult(conflictAfterSync);
      console.log(
        `!!! [Respec] ✅ Agent extracted:`,
        agentResult.requirements.length,
        "requirements",
      );
      console.log(
        `!!! [Respec] ??  Using extracted requirements for form updates`,
      );

      // Convert Anthropic requirements to EnhancedFormUpdate format
      const formUpdates: EnhancedFormUpdate[] = agentResult.requirements.map(
        (req) => ({
          section: req.section,
          field: req.field,
          value: req.value,
          isAssumption: req.isAssumption,
          confidence: req.confidence,
          originalRequest: req.originalRequest,
          substitutionNote: req.substitutionNote,
        }),
      );
      const respecSnapshotAfter = this.getRespecFieldSnapshot();
      const respecDeltaUpdates = this.buildRespecDeltaUpdates(
        respecSnapshotBefore,
        respecSnapshotAfter,
      );
      if (respecDeltaUpdates.length > 0)
        console.log(
          "!!! [Respec] ?? Using respec updates for",
          respecDeltaUpdates.length,
          "fields",
        );
      const finalUpdates =
        respecDeltaUpdates.length > 0 ? respecDeltaUpdates : formUpdates;

      // Use Anthropic's response
      const systemMessage = agentResult.response;

      const result: ChatResult = {
        success: true,
        systemMessage,
        formUpdates: finalUpdates,
        confidence:
          finalUpdates.length > 0
            ? finalUpdates.reduce((sum, u) => sum + u.confidence, 0) /
              finalUpdates.length
            : 0.5,
        clarificationNeeded: agentResult.clarificationNeeded,
      };

      return result;
    } catch (error) {
      console.error("[Respec] ❌ LLM processing failed:", error);
      throw error; // Fail fast for MVP
    }
  }

  public async processFormUpdate(
    section: string,
    field: string,
    value: unknown,
    options?: RespecFormUpdateOptions,
  ): Promise<FormProcessingResult> {
    console.log(`!!! [Respec] Form update: ${section}.${field} = ${value}`);

    const source = options?.source ?? "user";
    const skipAcknowledgment = options?.skipAcknowledgment ?? false;
    const attributionOverride =
      options?.isAssumption !== undefined
        ? options.isAssumption
          ? "assumption"
          : "requirement"
        : source === "system"
          ? "assumption"
          : undefined;
    const respecSnapshotBefore = this.getRespecFieldSnapshot();
    let formUpdates: EnhancedFormUpdate[] | undefined;

    if (this.artifactManager && ucDataLayer.isLoaded()) {
      const specs = ucDataLayer.getSpecificationsForFormField(field);
      const selections = Array.isArray(value) ? value : [value];
      const isEmptySelection = (selection: unknown) =>
        selection === null ||
        selection === undefined ||
        selection === "" ||
        selection === "Not Required";
      const hasSelection = selections.some(
        (selection) => !isEmptySelection(selection),
      );

      if (!hasSelection) {
        this.artifactManager.clearFieldSelections(field);
        const conflict = this.artifactManager.getPendingConflict();
        if (conflict)
          return {
            acknowledged: true,
            acknowledgment:
              this.artifactManager.buildConflictQuestion(conflict),
          };
        await this.artifactManager.moveNonConflictingToRespec();
        this.artifactManager.pruneToDependencyClosure?.();
      } else {
        const matches: RespecMatchSelection[] = [];
        const seen = new Set<string>();

        selections.forEach((selection) => {
          if (isEmptySelection(selection)) return;

          const normalized = String(selection);
          const matchedSpec = specs.find(
            (spec) =>
              spec.id === normalized ||
              spec.selected_value === normalized ||
              spec.name === normalized,
          );

          if (!matchedSpec || seen.has(matchedSpec.id)) return;
          seen.add(matchedSpec.id);
          matches.push({ spec: matchedSpec, selection });
        });

        for (const match of matches)
          await this.artifactManager.addSpecificationToMapped(
            match.spec,
            match.selection,
            `Manual update for ${section}.${field}`,
            "",
            source,
            undefined,
            attributionOverride,
          );

        const conflict = this.artifactManager.getPendingConflict();
        if (conflict)
          return {
            acknowledged: true,
            acknowledgment:
              this.artifactManager.buildConflictQuestion(conflict),
          };

        await this.artifactManager.moveNonConflictingToRespec();
        this.artifactManager.pruneToDependencyClosure?.();
      }

      const respecSnapshotAfter = this.getRespecFieldSnapshot();
      const respecDeltaUpdates = this.buildRespecDeltaUpdates(
        respecSnapshotBefore,
        respecSnapshotAfter,
      );
      if (respecDeltaUpdates.length > 0) formUpdates = respecDeltaUpdates;
    }

    const acknowledgment = skipAcknowledgment
      ? undefined
      : this.generateFormAcknowledgment(section, field, value);

    if (acknowledgment) await this.recordAssistantMessage(acknowledgment);

    return {
      acknowledged: true,
      acknowledgment,
      formUpdates,
    };
  }

  public async triggerAutofill(trigger: string): Promise<AutofillResult> {
    console.log(`!!! [Respec] Autofill triggered: ${trigger}`);

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

    if (trigger === "dont_know")
      message +=
        " You can modify any of these that don't fit your specific needs.";
    else if (trigger === "button_header")
      message +=
        " These are marked as assumptions - review and update as needed.";

    return message;
  }

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

  private async syncSelectionsToArtifacts(
    requirements: AgentRequirement[],
  ): Promise<void> {
    if (!this.artifactManager || requirements.length === 0) return;
    if (!ucDataLayer.isLoaded()) {
      console.warn("[Respec] UC8 not loaded; skipping artifact sync");
      return;
    }

    const selections: RespecSelectionMatch[] = [];
    const seen = new Set<string>();

    requirements.forEach((req) => {
      const specs = ucDataLayer.getSpecificationsForFormField(req.field);
      if (specs.length === 0) return;
      const selectionsForReq = Array.isArray(req.value)
        ? req.value
        : [req.value];
      selectionsForReq.forEach((selection) => {
        if (
          selection === null ||
          selection === undefined ||
          selection === "" ||
          selection === "Not Required"
        )
          return;
        const normalized = String(selection);
        const match = specs.find(
          (spec) =>
            spec.id === normalized ||
            spec.selected_value === normalized ||
            spec.name === normalized,
        );
        if (!match || seen.has(match.id)) return;
        seen.add(match.id);
        selections.push({ spec: req, match, selection });
      });
    });

    if (selections.length === 0) return;

    for (const selection of selections) {
      const originalRequest =
        selection.spec.originalRequest ||
        `Agent selection for ${selection.spec.section}.${selection.spec.field}`;
      const attributionOverride = selection.spec.isAssumption
        ? "assumption"
        : undefined;

      await this.artifactManager.addSpecificationToMapped(
        selection.match,
        selection.selection,
        originalRequest,
        selection.spec.substitutionNote || "",
        "llm",
        undefined,
        attributionOverride,
      );
    }

    if (!this.artifactManager.getPendingConflict())
      await this.artifactManager.moveNonConflictingToRespec();
  }
}

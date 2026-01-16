import { AnthropicService } from "./AnthropicService";
import { PreSaleEngineer } from "./agents/PreSaleEngineer";
import { AutofillAgent } from "./agents/AutofillAgent";
import { LocalPromptProvider } from "./PromptProvider";
import { LocalSessionStore } from "./LocalSessionStore";
import type { SessionStore } from "./interfaces/SessionStore";
import { ArtifactManager } from "./ArtifactManager";

import { formFieldsData, SECTION_MAPPING } from "../config/uiConfig";
import { getFieldLabel as getUiFieldLabel } from "../utils/fields-utils";
import { ucDataLayer } from "./DataLayer";
import type { ActiveConflict } from "../types/artifacts.types";
import type {
  FieldMapping,
  FieldOptionsEntry,
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
  BaseFieldValue,
  FormProcessingResult,
  FormUpdate,
  Maybe,
  SessionMessage,
} from "../types/service.types";
import type {
  FieldDefinitionInput,
  FieldDefinitions,
  AgentAnalysisResult,
  AgentRequirement,
  AutofillAgentSelection,
} from "../types/semantic.types";
import type { UCSpecification } from "../types/uc-data.types";

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
  private autofillAgent: AutofillAgent;
  private promptProvider: LocalPromptProvider;
  private sessionStore: SessionStore;
  private fieldMappings: Map<string, FieldMapping> = new Map();
  private fieldOptionsMap: FieldOptionsMap = {};

  // Core services for conflict detection and resolution
  private artifactManager?: ArtifactManager;

  public constructor() {
    this.anthropicService = new AnthropicService();
    this.promptProvider = new LocalPromptProvider();
    this.sessionStore = new LocalSessionStore();
    this.preSaleEngineer = new PreSaleEngineer(
      this.anthropicService,
      this.promptProvider,
      this.sessionStore,
    );
    this.autofillAgent = new AutofillAgent(
      this.anthropicService,
      this.promptProvider,
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
    await this.autofillAgent.initialize();

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

  private normalizeSelectionValue(value: unknown): string {
    return String(value).trim().toLowerCase();
  }

  private findMatchingSpec(
    specs: UCSpecification[],
    selection: unknown,
  ): UCSpecification | null {
    if (selection === null || selection === undefined) return null;
    const normalized = this.normalizeSelectionValue(selection);

    return (
      specs.find((spec) => {
        const candidates = [spec.id, spec.selected_value, spec.name].filter(
          Boolean,
        ) as string[];
        return candidates.some(
          (candidate) => this.normalizeSelectionValue(candidate) === normalized,
        );
      }) || null
    );
  }

  private isSelectionAllowed(
    fieldOptions: FieldOptionsEntry | undefined,
    selection: unknown,
  ): boolean {
    if (!fieldOptions) return false;
    if (selection === null || selection === undefined) return false;
    if (typeof selection === "string" && selection.trim() === "") return false;

    if (fieldOptions.type === "number") {
      const numericValue =
        typeof selection === "number" ? selection : Number(selection);
      return Number.isFinite(numericValue);
    }

    if (fieldOptions.options && fieldOptions.options.length > 0) {
      const normalizedSelection = this.normalizeSelectionValue(selection);
      return fieldOptions.options.some(
        (option) =>
          this.normalizeSelectionValue(option) === normalizedSelection,
      );
    }

    return true;
  }

  private buildManualSpec(
    section: string,
    field: string,
    selection: unknown,
    fieldOptions: FieldOptionsEntry | undefined,
  ): UCSpecification | null {
    if (!this.isSelectionAllowed(fieldOptions, selection)) return null;

    const rawValue = String(selection).trim();
    const safeValue = rawValue.replace(/\s+/g, "_");
    const specId = `manual:${field}:${safeValue}`;
    const label = fieldOptions?.label || field;
    const specName = `${label} ${rawValue}`.trim();

    return {
      id: specId,
      type: "specification",
      name: specName,
      field_name: field,
      selected_value: rawValue,
      description: `Manual selection for ${section}.${field}`,
    };
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
      prompt += `- For unit conversions (e.g. "half a tera" = 500GB -> 512GB), explain the conversion\n`;
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
        (spec.value as BaseFieldValue) ??
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
      agentResult.requirements.forEach((requirement) =>
        this.validateAgentSelection(
          requirement.field,
          requirement.value ?? null,
          "pre-sale-engineer",
        ),
      );
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
      const fieldOptions = this.fieldOptionsMap[section]?.[field];
      const selections = Array.isArray(value) ? value : [value];
      const isEmptySelection = (selection: unknown) =>
        this.isEmptySelection(selection as Maybe<BaseFieldValue>);
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

          let matchedSpec = this.findMatchingSpec(specs, selection);

          if (!matchedSpec) {
            const manualSpec = this.buildManualSpec(
              section,
              field,
              selection,
              fieldOptions,
            );
            if (manualSpec) {
              console.warn(
                "[Respec] Using manual spec for selection without UC match",
                {
                  section,
                  field,
                  selection,
                  specId: manualSpec.id,
                },
              );
              matchedSpec = manualSpec;
            } else {
              console.error(
                "[Respec] Selection not mapped to UC spec or UI options",
                { section, field, selection },
              );
            }
          }

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

      if (value === "Not Required") {
        const replacement = {
          section,
          field,
          value: "Not Required",
          confidence: 1,
          isAssumption: options?.isAssumption ?? source === "system",
          originalRequest: "",
          substitutionNote: "",
        };
        const filtered = formUpdates
          ? formUpdates.filter(
              (update) => update.section !== section || update.field !== field,
            )
          : [];
        formUpdates = [...filtered, replacement];
      }
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

  public async triggerAutofill(
    section: string,
    message: string,
  ): Promise<AutofillResult> {
    console.log(`!!! [Respec] Autofill triggered for section: ${section}`);

    if (!this.artifactManager || !ucDataLayer.isLoaded()) {
      return {
        message:
          "Autofill is unavailable until the UC8 dataset is loaded and the artifact manager is ready.",
        fields: [],
        section,
        mode: "empty",
      };
    }

    const pendingConflict = this.artifactManager.getPendingConflict();
    if (pendingConflict) {
      const conflictMessage =
        this.artifactManager.buildConflictQuestion(pendingConflict);
      return {
        message: conflictMessage,
        fields: [],
        section,
        mode: "empty",
      };
    }

    const targetSection = this.resolveAutofillSection(section);
    const respecArtifact = this.artifactManager.getState().respec;
    const respecSnapshot = this.getRespecFieldSnapshot();
    const currentSelections: Record<string, Maybe<BaseFieldValue>> = {};

    respecSnapshot.forEach((entry, fieldName) => {
      currentSelections[fieldName] = entry.value ?? null;
    });

    const missingKeyFields = this.getMissingKeyFields(
      currentSelections,
      targetSection,
    );
    if (missingKeyFields.length > 0) {
      return {
        message: `Autofill paused because some key fields are not filled: ${missingKeyFields.join(
          ", ",
        )}.`,
        fields: [],
        section: targetSection,
        mode: "empty",
      };
    }

    const selectedSpecIds = Object.keys(respecArtifact.specifications || {});
    const remainingSpecs = this.buildRemainingSpecs(
      currentSelections,
      targetSection,
      selectedSpecIds,
    );
    if (Object.keys(remainingSpecs).length === 0) {
      return {
        message: "No empty fields left to autofill.",
        fields: [],
        section: targetSection,
        mode: "empty",
      };
    }

    const conversationHistory = await this.getConversationHistory();

    const context = {
      lastUserMessage: message,
      conversationHistory,
      respecArtifact,
      currentSelections,
      remainingSpecs,
      missingKeyFields,
      section: targetSection,
    };

    const agentResult = await this.autofillAgent.runAutofill(context);
    const fields = this.buildAutofillFieldUpdates(
      agentResult.selections,
      remainingSpecs,
    );
    const hasSelections = fields.length > 0;
    const mode =
      agentResult.mode === "selections" && !hasSelections
        ? "empty"
        : agentResult.mode;
    const fallbackMessage = hasSelections
      ? `Autofill completed with ${fields.length} selections. Review and adjust as needed.`
      : "Autofill is ready when you are. Let me know what to prioritize.";

    return {
      message: agentResult.message || fallbackMessage,
      fields,
      section: targetSection,
      mode,
    };
  }

  private getMissingKeyFields(
    currentSelections: Record<string, Maybe<BaseFieldValue>>,
    section: string,
  ): string[] {
    const priorityFields =
      formFieldsData.priority_system?.priority_levels?.["1"]?.fields ??
      formFieldsData.priority_system?.must_fields ??
      [];
    const missing = priorityFields
      .filter(
        (fieldName) =>
          section === "all" ||
          ucDataLayer.getUiFieldByFieldName(fieldName)?.section === section,
      )
      .filter((fieldName) =>
        this.isEmptySelection(currentSelections[fieldName]),
      );

    return missing.map((fieldName) => getUiFieldLabel(fieldName));
  }

  private resolveAutofillSection(section: string): string {
    if (section === "all" || !section) return "all";
    const normalized = section.trim().replace(/^['"]|['"]$/g, "");
    const sectionMapping = SECTION_MAPPING as Record<string, string[]>;
    const mappedSection = sectionMapping[normalized]?.[0];
    if (mappedSection) return mappedSection;

    const uiFields = ucDataLayer.getAllUiFields();
    const knownSections = new Set(
      Object.values(uiFields).map((field) => field.section),
    );
    return knownSections.has(normalized) ? normalized : "all";
  }

  private isEmptySelection(value: Maybe<BaseFieldValue>): boolean {
    if (value === null || value === undefined) return true;
    if (value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
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

  private async getConversationHistory(): Promise<SessionMessage[]> {
    try {
      return await this.sessionStore.getHistory(
        this.preSaleEngineer.getSessionId(),
      );
    } catch (error) {
      console.warn("[Respec] Could not read conversation history:", error);
      return [];
    }
  }

  private buildRemainingSpecs(
    currentSelections: Record<string, Maybe<BaseFieldValue>>,
    section: string,
    selectedSpecIds: string[],
  ): Record<string, string[]> {
    const remainingSpecs: Record<string, string[]> = {};
    const uiFields = ucDataLayer.getAllUiFields();

    Object.keys(uiFields)
      .filter(
        (fieldName) =>
          section === "all" || uiFields[fieldName]?.section === section,
      )
      .forEach((fieldName) => {
        if (fieldName in currentSelections) return;
        const validOptions = ucDataLayer.getValidOptionsForField(
          fieldName,
          selectedSpecIds,
        );
        const optionValues = validOptions
          .map((option) => option.selected_value || option.name || option.id)
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value))
          .filter((value) => value.length > 0);
        const unique = Array.from(new Set(optionValues));
        remainingSpecs[fieldName] =
          unique.length > 0 ? unique : ["Not Required"];
      });

    return remainingSpecs;
  }

  private buildAutofillFieldUpdates(
    selections: AutofillAgentSelection[],
    remainingSpecs: Record<string, string[]>,
  ): FormUpdate[] {
    const updates: FormUpdate[] = [];
    const seen = new Set<string>();

    selections.forEach((selection) => {
      if (seen.has(selection.field)) return;
      const options = remainingSpecs[selection.field];
      if (!options || options.length === 0) return;
      const match = this.findMatchingOption(options, selection.value);
      if (!match) return;
      const uiField = ucDataLayer.getUiFieldByFieldName(selection.field);
      if (!uiField) return;
      this.validateAgentSelection(selection.field, match, "autofill-agent");
      seen.add(selection.field);
      updates.push({
        section: uiField.section,
        field: selection.field,
        value: match,
        isAssumption: true,
        confidence: 0.8,
      });
    });

    return updates;
  }

  private findMatchingOption(options: string[], value: string): string | null {
    if (options.includes(value)) return value;
    const normalized = this.normalizeSelectionValue(value);
    const match = options.find(
      (option) => this.normalizeSelectionValue(option) === normalized,
    );
    return match || null;
  }

  private validateAgentSelection(
    fieldName: string,
    value: Maybe<BaseFieldValue>,
    source: string,
  ): void {
    if (!ucDataLayer.isLoaded()) return;
    const uiField = ucDataLayer.getUiFieldByFieldName(fieldName);
    const options = uiField?.options ?? [];
    if (options.length === 0) return;
    const values = Array.isArray(value) ? value : [value];

    values.forEach((entry) => {
      if (entry === null || entry === undefined || entry === "") return;
      const normalized = String(entry);
      if (!options.includes(normalized))
        console.error("[Respec] Agent selection not in UI options", {
          source,
          field: fieldName,
          value: normalized,
          options,
        });
    });
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
        const match = this.findMatchingSpec(specs, selection);
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

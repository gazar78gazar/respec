import { v4 as uuidv4 } from 'uuid';
import { AnthropicService } from './AnthropicService';
import { SemanticMatcher, createSemanticMatcher } from './semantic/SemanticMatcher';
import { SemanticIntegrationService, createSemanticIntegrationService, EnhancedChatResult } from './semantic/SemanticIntegrationService';
import { UC1ValidationEngine } from './UC1ValidationEngine';
import { ArtifactManager } from './artifacts/ArtifactManager';
import { CompatibilityLayer } from './artifacts/CompatibilityLayer';
import { ConflictDetectionService, createConflictDetectionService, FieldConflict } from './ConflictDetectionService';

// Simplified interfaces for the browser-only service
export interface ChatResult {
  success: boolean;
  systemMessage: string;
  formUpdates?: EnhancedFormUpdate[];
  clarificationNeeded?: string;
  confidence: number;
}

export interface FormUpdate {
  section: string;
  field: string;
  value: any;
  isAssumption: boolean;
  confidence: number;
}

export interface EnhancedFormUpdate extends FormUpdate {
  originalRequest?: string;    // What user asked for
  substitutionNote?: string;   // Explanation if different
}

export interface FieldOptionsMap {
  [section: string]: {
    [field: string]: {
      type: 'dropdown' | 'text' | 'number' | 'multiselect' | 'date';
      options?: string[];  // For dropdown/multiselect
      min?: number;        // For number fields
      max?: number;        // For number fields
      validation?: string; // Regex pattern for text
      label?: string;      // Human readable label
    }
  }
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

export class SimplifiedRespecService {
  private sessionId: string;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
  private isInitialized = false;
  private anthropicService: AnthropicService;
  private fieldMappings: Map<string, { section: string; field: string; }> = new Map();
  private uc1Data: any = null;
  private fieldOptionsMap: FieldOptionsMap = {};

  // New semantic matching system
  private semanticMatcher: SemanticMatcher | null = null;
  private semanticIntegration: SemanticIntegrationService | null = null;
  private useSemanticMatching: boolean = true;

  // Conflict detection system
  private conflictDetection: ConflictDetectionService | null = null;

  // Engineering pattern recognition database
  private patterns = {
    // Digital I/O patterns
    digital_input: [
      /(\d+)\s*(digital)?\s*(inputs?)/i,
      /(\d+)\s*DI/i,
      /(\d+)\s*binary\s*inputs?/i,
      /need\s*(\d+)\s*on[\/\-]?off\s*signals?/i,
    ],
    digital_output: [
      /(\d+)\s*(digital)?\s*(outputs?)/i,
      /(\d+)\s*DO/i,
      /(\d+)\s*binary\s*outputs?/i,
      /control\s*(\d+)\s*devices?/i,
    ],
    analog_input: [
      /(\d+)\s*(analog)?\s*(inputs?)/i,
      /(\d+)\s*AI/i,
      /(\d+)\s*sensors?/i,
      /measure\s*(\d+)\s*signals?/i,
    ],
    analog_output: [
      /(\d+)\s*(analog)?\s*(outputs?)/i,
      /(\d+)\s*AO/i,
      /(\d+)\s*control\s*outputs?/i,
      /drive\s*(\d+)\s*actuators?/i,
    ],
    // Power and voltage patterns
    power_supply: [
      /(\d+)\s*v(olt)?s?\s*(supply|power)/i,
      /(\d+)\s*vdc/i,
      /power\s*at\s*(\d+)\s*v/i,
    ],
    communication: [
      /ethernet/i,
      /modbus/i,
      /profinet/i,
      /canbus/i,
      /serial/i,
      /rs485/i,
      /rs232/i,
    ],
    // Application contexts
    substation: [
      /substation/i,
      /electrical\s*substation/i,
      /power\s*substation/i,
    ],
    industrial: [
      /industrial/i,
      /manufacturing/i,
      /factory/i,
      /plant/i,
    ],
  };

  // Smart defaults based on common engineering requirements
  private smartDefaults = {
    substation: {
      'io.digital_inputs': 16,
      'io.analog_inputs': 8,
      'io.digital_outputs': 8,
      'power.supply_voltage': '24',
      'communication.ethernet': true,
      'communication.modbus': true,
      'environmental.operating_temp_min': '-40',
      'environmental.operating_temp_max': '70',
      'compliance.iec61850': true,
    },
    industrial: {
      'io.digital_inputs': 12,
      'io.analog_inputs': 4,
      'io.digital_outputs': 6,
      'power.supply_voltage': '24',
      'communication.ethernet': true,
      'environmental.operating_temp_min': '0',
      'environmental.operating_temp_max': '60',
    },
    generic: {
      'io.digital_inputs': 8,
      'io.analog_inputs': 2,
      'io.digital_outputs': 4,
      'power.supply_voltage': '12',
      'communication.ethernet': true,
    },
  };

  constructor() {
    this.sessionId = uuidv4();
    this.anthropicService = new AnthropicService();
  }

  // Initialize semantic matching system (called externally with dependencies)
  initializeSemanticMatching(
    uc1Engine: UC1ValidationEngine,
    artifactManager?: ArtifactManager,
    compatibilityLayer?: CompatibilityLayer
  ): void {
    if (!uc1Engine.isReady()) {
      console.warn('[SimplifiedRespec] UC1ValidationEngine not ready for semantic matching');
      this.useSemanticMatching = false;
      return;
    }

    try {
      this.semanticMatcher = createSemanticMatcher(this.anthropicService, uc1Engine);
      this.semanticMatcher.initialize(artifactManager, compatibilityLayer);

      this.semanticIntegration = createSemanticIntegrationService(
        this.semanticMatcher,
        compatibilityLayer
      );

      // Initialize conflict detection
      this.conflictDetection = createConflictDetectionService(uc1Engine);
      this.conflictDetection.initialize(compatibilityLayer);

      console.log('[SimplifiedRespec] Semantic matching and conflict detection systems initialized');
      this.useSemanticMatching = true;
    } catch (error) {
      console.error('[SimplifiedRespec] Failed to initialize semantic matching:', error);
      this.useSemanticMatching = false;
    }
  }

  async initialize(fieldDefinitions?: any): Promise<void> {
    if (this.isInitialized) {
      console.log('[SimplifiedRespec] Already initialized');
      return;
    }

    console.log(`[SimplifiedRespec] Initializing session: ${this.sessionId}`);

    // Load UC1.json for field mappings
    try {
      const response = await fetch('/uc1.json');
      if (response.ok) {
        this.uc1Data = await response.json();
        this.extractFieldMappings();
        console.log('[SimplifiedRespec] UC1.json loaded, extracted', this.fieldMappings.size, 'field mappings');
      } else {
        console.warn('[SimplifiedRespec] Could not load UC1.json, using fallback mappings');
        this.loadFallbackMappings();
      }
    } catch (error) {
      console.warn('[SimplifiedRespec] Failed to load UC1.json:', error);
      this.loadFallbackMappings();
    }

    // Initialize Anthropic service with field mappings
    await this.anthropicService.initialize(this.getFieldMappingsForPrompt());

    // Load any persisted conversation or settings
    try {
      const savedSession = localStorage.getItem(`respec_session_${this.sessionId}`);
      if (savedSession) {
        const data = JSON.parse(savedSession);
        this.conversationHistory = data.conversationHistory || [];
      }
    } catch (error) {
      console.warn('[SimplifiedRespec] Could not load saved session:', error);
    }

    // Build field options map if field definitions provided
    if (fieldDefinitions) {
      this.buildFieldOptionsMap(fieldDefinitions);
      console.log('[SimplifiedRespec] Field options map built with', Object.keys(this.fieldOptionsMap).length, 'sections');
    }

    this.isInitialized = true;
    console.log('[SimplifiedRespec] Initialization complete');
  }

  private extractFieldMappings(): void {
    if (!this.uc1Data || !this.uc1Data.specifications) {
      return;
    }

    // Extract field mappings from UC1.json specifications
    Object.values(this.uc1Data.specifications).forEach((spec: any) => {
      if (spec.form_mapping && spec.form_mapping.field_name) {
        const mapping = {
          section: spec.form_mapping.section,
          field: spec.form_mapping.field_name
        };

        // Store by various possible names the user might use
        const specName = spec.name.toLowerCase().replace(/_/g, ' ');
        this.fieldMappings.set(specName, mapping);

        // Also store by the actual field name
        this.fieldMappings.set(spec.form_mapping.field_name, mapping);

        // Store common variations
        if (spec.form_mapping.field_name === 'digital_io') {
          this.fieldMappings.set('digital inputs', mapping);
          this.fieldMappings.set('digital outputs', mapping);
          this.fieldMappings.set('digital i/o', mapping);
        }
        if (spec.form_mapping.field_name === 'analog_io') {
          this.fieldMappings.set('analog inputs', mapping);
          this.fieldMappings.set('analog outputs', mapping);
          this.fieldMappings.set('analog i/o', mapping);
        }
      }
    });
  }

  private loadFallbackMappings(): void {
    // Fallback mappings if UC1.json can't be loaded
    const fallbackMappings = [
      { name: 'processor', section: 'compute_performance', field: 'processor_type' },
      { name: 'memory', section: 'compute_performance', field: 'memory_capacity' },
      { name: 'storage', section: 'compute_performance', field: 'storage_capacity' },
      { name: 'digital inputs', section: 'io_connectivity', field: 'digital_io' },
      { name: 'analog inputs', section: 'io_connectivity', field: 'analog_io' },
      { name: 'ethernet ports', section: 'io_connectivity', field: 'ethernet_ports' },
      { name: 'temperature', section: 'environment_standards', field: 'operating_temperature' },
      { name: 'budget per unit', section: 'commercial', field: 'budget_per_unit' },
      { name: 'quantity', section: 'commercial', field: 'quantity' }
    ];

    fallbackMappings.forEach(map => {
      this.fieldMappings.set(map.name, { section: map.section, field: map.field });
    });
  }

  private buildFieldOptionsMap(fieldDefinitions: any): void {
    // Build field options map from form field definitions
    Object.entries(fieldDefinitions).forEach(([section, fields]: [string, any]) => {
      this.fieldOptionsMap[section] = {};
      Object.entries(fields).forEach(([fieldKey, fieldDef]: [string, any]) => {
        this.fieldOptionsMap[section][fieldKey] = {
          type: fieldDef.type,
          options: fieldDef.options,
          min: fieldDef.min,
          max: fieldDef.max,
          validation: fieldDef.validation,
          label: fieldDef.label
        };
      });
    });

    console.log('[SimplifiedRespec] Built field options map:', {
      sections: Object.keys(this.fieldOptionsMap).length,
      totalFields: Object.values(this.fieldOptionsMap).reduce((sum, section) => sum + Object.keys(section).length, 0)
    });
  }

  private getFieldMappingsForPrompt(): any {
    // Organize field mappings by section for the Anthropic prompt
    const mappingsBySection: any = {};

    this.fieldMappings.forEach((mapping, name) => {
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
      'storage': ['compute_performance.storage_capacity'],
      'memory': ['compute_performance.memory_capacity'],
      'processor': ['compute_performance.processor_type'],
      'cpu': ['compute_performance.processor_type'],
      'ethernet': ['io_connectivity.ethernet_ports'],
      'digital': ['io_connectivity.digital_io'],
      'analog': ['io_connectivity.analog_io'],
      'temperature': ['environment_standards.operating_temperature'],
      'temp': ['environment_standards.operating_temperature'],
      'budget': ['commercial.budget_per_unit'],
      'price': ['commercial.budget_per_unit'],
      'cost': ['commercial.budget_per_unit'],
      'quantity': ['commercial.quantity'],
      'qty': ['commercial.quantity']
    };

    Object.entries(commonFieldPatterns).forEach(([keyword, fields]) => {
      if (messageLower.includes(keyword)) {
        fields.forEach(field => {
          if (!relevantFields.includes(field)) {
            relevantFields.push(field);
          }
        });
      }
    });

    return relevantFields;
  }

  private buildContextPrompt(message: string, identifiedFields: string[]): string {
    let prompt = `User request: "${message}"\n\n`;

    if (identifiedFields.length > 0) {
      prompt += `Available field options for this request:\n`;

      identifiedFields.forEach(fieldPath => {
        const [section, field] = fieldPath.split('.');
        const fieldOptions = this.fieldOptionsMap[section]?.[field];

        if (fieldOptions) {
          prompt += `\n${fieldOptions.label || field}:\n`;
          prompt += `  Type: ${fieldOptions.type}\n`;

          if (fieldOptions.options && fieldOptions.options.length > 0) {
            prompt += `  Available options: [${fieldOptions.options.join(', ')}]\n`;
            prompt += `  Instruction: Select the closest matching option from the available list. If substituting, explain why in substitutionNote.\n`;
          } else if (fieldOptions.type === 'number') {
            if (fieldOptions.min !== undefined || fieldOptions.max !== undefined) {
              prompt += `  Range: ${fieldOptions.min || 'no minimum'} to ${fieldOptions.max || 'no maximum'}\n`;
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

  async processChatMessage(message: string, currentRequirements?: any): Promise<ChatResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[SimplifiedRespec] Processing: "${message}"`);

    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    try {
      // NEW: Try semantic matching first if available
      if (this.useSemanticMatching && this.semanticIntegration) {
        console.log(`[SimplifiedRespec] Using semantic matching pipeline`);

        const semanticResult = await this.semanticIntegration.processMessage(
          message,
          currentRequirements || {},
          this.conversationHistory
        );

        if (semanticResult.success) {
          // Add assistant response to history
          this.conversationHistory.push({
            role: 'assistant',
            content: semanticResult.systemMessage,
            timestamp: new Date(),
          });

          console.log(`[SimplifiedRespec] Semantic processing successful: ${semanticResult.formUpdates?.length || 0} updates`);
          return semanticResult;
        } else {
          console.warn(`[SimplifiedRespec] Semantic processing failed, falling back to legacy method`);
        }
      }

      // FALLBACK: Use legacy processing method
      console.log(`[SimplifiedRespec] Using legacy processing pipeline`);

      // Identify relevant fields from the message
      const identifiedFields = this.identifyRelevantFields(message);
      console.log(`[SimplifiedRespec] Identified relevant fields:`, identifiedFields);

      // Build context with available options
      const contextPrompt = this.buildContextPrompt(message, identifiedFields);
      console.log(`[SimplifiedRespec] Built context prompt with field options`);

      // Use Anthropic service with enhanced context
      const anthropicResult = await this.anthropicService.analyzeRequirements(
        contextPrompt,
        {
          conversationHistory: this.conversationHistory.slice(-5), // Last 5 messages for context
          sessionId: this.sessionId
        }
      );

      // Convert Anthropic requirements to EnhancedFormUpdate format
      const formUpdates: EnhancedFormUpdate[] = anthropicResult.requirements.map(req => ({
        section: req.section,
        field: req.field,
        value: req.value,
        isAssumption: req.isAssumption,
        confidence: req.confidence,
        originalRequest: req.originalRequest,
        substitutionNote: req.substitutionNote
      }));

      // Use Anthropic's response
      const systemMessage = anthropicResult.response;

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: systemMessage,
        timestamp: new Date(),
      });

      // Persist conversation
      this.saveSession();

      const result: ChatResult = {
        success: true,
        systemMessage,
        formUpdates,
        confidence: formUpdates.length > 0
          ? formUpdates.reduce((sum, u) => sum + u.confidence, 0) / formUpdates.length
          : 0.5,
        clarificationNeeded: anthropicResult.clarificationNeeded
      };

      return result;

    } catch (error) {
      console.error('[SimplifiedRespec] Anthropic processing failed, using fallback:', error);

      // Fallback to pattern matching if Anthropic fails
      const analysisResult = this.analyzeMessage(message);
      const formUpdates = this.generateFormUpdates(analysisResult);
      const systemMessage = this.generateResponse(message, analysisResult, formUpdates);

      this.conversationHistory.push({
        role: 'assistant',
        content: systemMessage,
        timestamp: new Date(),
      });

      this.saveSession();

      const result: ChatResult = {
        success: true,
        systemMessage,
        formUpdates,
        confidence: analysisResult.confidence,
      };

      if (analysisResult.confidence < 0.6) {
        result.clarificationNeeded = this.generateClarificationQuestion(analysisResult);
      }

      return result;
    }
  }

  async processFormUpdate(section: string, field: string, value: any): Promise<FormProcessingResult> {
    console.log(`[SimplifiedRespec] Form update: ${section}.${field} = ${value}`);

    // Generate contextual acknowledgment
    const acknowledgment = this.generateFormAcknowledgment(section, field, value);

    if (acknowledgment) {
      this.conversationHistory.push({
        role: 'assistant',
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

  async triggerAutofill(trigger: string): Promise<AutofillResult> {
    console.log(`[SimplifiedRespec] Autofill triggered: ${trigger}`);

    // Determine context from conversation history
    const context = this.determineApplicationContext();

    // Get appropriate defaults
    const defaults = this.smartDefaults[context as keyof typeof this.smartDefaults] || this.smartDefaults.generic;

    // Convert to form updates
    const fields: FormUpdate[] = Object.entries(defaults).map(([path, value]) => {
      const [section, field] = path.split('.');
      return {
        section,
        field,
        value,
        isAssumption: true,
        confidence: 0.8,
      };
    });

    const message = this.generateAutofillMessage(context, trigger, fields.length);

    return {
      message,
      fields,
      trigger,
    };
  }

  private analyzeMessage(message: string): {
    requirements: Array<{ type: string; value: any; confidence: number }>;
    context: string;
    confidence: number;
  } {
    const requirements: Array<{ type: string; value: any; confidence: number }> = [];
    let overallConfidence = 0;
    let context = 'generic';

    // Check for application context
    if (this.patterns.substation.some(pattern => pattern.test(message))) {
      context = 'substation';
      overallConfidence += 0.3;
    } else if (this.patterns.industrial.some(pattern => pattern.test(message))) {
      context = 'industrial';
      overallConfidence += 0.2;
    }

    // Extract specific requirements
    for (const [type, patterns] of Object.entries(this.patterns)) {
      if (type === 'substation' || type === 'industrial') continue;

      for (const pattern of patterns) {
        const match = pattern.exec(message);
        if (match) {
          const value = type === 'communication' ? true : parseInt(match[1]) || match[0];
          requirements.push({
            type,
            value,
            confidence: 0.8,
          });
          overallConfidence += 0.2;
          break;
        }
      }
    }

    // Normalize confidence
    overallConfidence = Math.min(overallConfidence, 1.0);

    return {
      requirements,
      context,
      confidence: overallConfidence,
    };
  }

  private generateFormUpdates(analysis: any): FormUpdate[] {
    const updates: FormUpdate[] = [];

    for (const requirement of analysis.requirements) {
      const update = this.mapRequirementToFormField(requirement);
      if (update) {
        updates.push(update);
      }
    }

    return updates;
  }

  private mapRequirementToFormField(requirement: { type: string; value: any; confidence: number }): FormUpdate | null {
    const mapping: Record<string, { section: string; field: string }> = {
      digital_input: { section: 'io', field: 'digital_inputs' },
      digital_output: { section: 'io', field: 'digital_outputs' },
      analog_input: { section: 'io', field: 'analog_inputs' },
      analog_output: { section: 'io', field: 'analog_outputs' },
      power_supply: { section: 'power', field: 'supply_voltage' },
      ethernet: { section: 'communication', field: 'ethernet' },
      modbus: { section: 'communication', field: 'modbus' },
    };

    const fieldMapping = mapping[requirement.type];
    if (!fieldMapping) {
      return null;
    }

    return {
      section: fieldMapping.section,
      field: fieldMapping.field,
      value: requirement.value,
      isAssumption: requirement.confidence < 0.9,
      confidence: requirement.confidence,
    };
  }

  private generateResponse(message: string, analysis: any, formUpdates: FormUpdate[]): string {
    if (formUpdates.length === 0) {
      return `I understand you mentioned: "${message}". I'm analyzing the requirements - could you provide more specific details about quantities or specifications?`;
    }

    let response = "I've identified the following requirements from your message:\n\n";

    for (const update of formUpdates) {
      const friendlyName = this.getFriendlyFieldName(update.section, update.field);
      const certainty = update.isAssumption ? "I'm assuming" : "I've set";
      response += `• ${certainty} ${friendlyName}: ${update.value}\n`;
    }

    if (analysis.confidence < 0.7) {
      response += "\nPlease let me know if these assumptions are correct or if you need different specifications.";
    } else {
      response += "\nThese requirements have been updated in your specification.";
    }

    return response;
  }

  private generateFormAcknowledgment(section: string, field: string, value: any): string {
    const friendlyName = this.getFriendlyFieldName(section, field);

    const acknowledgments = [
      `${friendlyName} selection noted.`,
      `Updated ${friendlyName} to ${value}.`,
      `${friendlyName} has been set to ${value}.`,
      `Noted: ${friendlyName} = ${value}.`,
    ];

    return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  }

  private generateAutofillMessage(context: string, trigger: string, fieldCount: number): string {
    const contextMessages = {
      substation: `Based on typical substation requirements, I've filled in ${fieldCount} common specifications as assumptions.`,
      industrial: `Based on common industrial automation needs, I've added ${fieldCount} typical requirements as assumptions.`,
      generic: `I've filled in ${fieldCount} common electronic system requirements as assumptions.`,
    };

    let message = contextMessages[context as keyof typeof contextMessages] || contextMessages.generic;

    if (trigger === 'dont_know') {
      message += " You can modify any of these that don't fit your specific needs.";
    } else if (trigger === 'button_header') {
      message += " These are marked as assumptions - review and update as needed.";
    }

    return message;
  }

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

  private getFriendlyFieldName(section: string, field: string): string {
    const friendlyNames: Record<string, Record<string, string>> = {
      io: {
        digital_inputs: 'Digital Inputs',
        digital_outputs: 'Digital Outputs',
        analog_inputs: 'Analog Inputs',
        analog_outputs: 'Analog Outputs',
      },
      power: {
        supply_voltage: 'Supply Voltage',
      },
      communication: {
        ethernet: 'Ethernet',
        modbus: 'Modbus',
      },
    };

    return friendlyNames[section]?.[field] || `${section}.${field}`;
  }

  private determineApplicationContext(): string {
    const recentMessages = this.conversationHistory
      .slice(-5)
      .map(entry => entry.content)
      .join(' ')
      .toLowerCase();

    if (recentMessages.includes('substation')) return 'substation';
    if (recentMessages.includes('industrial') || recentMessages.includes('factory')) return 'industrial';
    return 'generic';
  }

  private saveSession(): void {
    try {
      const sessionData = {
        conversationHistory: this.conversationHistory,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`respec_session_${this.sessionId}`, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('[SimplifiedRespec] Could not save session:', error);
    }
  }

  // Debug and utility methods
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  clearSession(): void {
    this.conversationHistory = [];
    localStorage.removeItem(`respec_session_${this.sessionId}`);
    console.log('[SimplifiedRespec] Session cleared');
  }

  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      isInitialized: this.isInitialized,
      conversationLength: this.conversationHistory.length,
      lastActivity: this.conversationHistory[this.conversationHistory.length - 1]?.timestamp,
    };
  }

  // ============= CONFLICT DETECTION API =============

  async detectFieldConflicts(
    field: string,
    newValue: string,
    currentRequirements: any,
    source: 'semantic' | 'manual' | 'autofill' = 'manual',
    context?: {
      originalRequest?: string;
      confidence?: number;
      uc1Spec?: string;
    }
  ): Promise<FieldConflict[]> {
    if (!this.conflictDetection) {
      console.warn('[SimplifiedRespec] Conflict detection not initialized');
      return [];
    }

    try {
      return await this.conflictDetection.detectConflicts(
        field,
        newValue,
        currentRequirements,
        source,
        context
      );
    } catch (error) {
      console.error('[SimplifiedRespec] Conflict detection failed:', error);
      return [];
    }
  }

  async resolveConflict(conflictId: string, action: 'accept' | 'reject' | 'modify', newValue?: string) {
    if (!this.conflictDetection) {
      throw new Error('Conflict detection not initialized');
    }

    return await this.conflictDetection.resolveConflict(conflictId, action, newValue);
  }

  getActiveConflicts(): FieldConflict[] {
    if (!this.conflictDetection) return [];
    return this.conflictDetection.getActiveConflicts();
  }

  onConflictChange(listener: (conflicts: FieldConflict[]) => void): () => void {
    if (!this.conflictDetection) {
      return () => {}; // No-op unsubscribe
    }
    return this.conflictDetection.onConflictChange(listener);
  }

  getConflictStats() {
    if (!this.conflictDetection) {
      return { active: 0, resolved: 0, byType: {}, bySeverity: {} };
    }
    return this.conflictDetection.getConflictStats();
  }

  clearAllConflicts() {
    if (this.conflictDetection) {
      this.conflictDetection.clearAllConflicts();
    }
  }
}
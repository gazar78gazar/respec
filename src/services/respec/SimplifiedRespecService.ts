import { v4 as uuidv4 } from 'uuid';
import { AnthropicService } from './AnthropicService';

// Simplified interfaces for the browser-only service
export interface ChatResult {
  success: boolean;
  systemMessage: string;
  formUpdates?: FormUpdate[];
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

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[SimplifiedRespec] Already initialized');
      return;
    }

    console.log(`[SimplifiedRespec] Initializing session: ${this.sessionId}`);

    // Initialize Anthropic service
    await this.anthropicService.initialize();

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

    this.isInitialized = true;
    console.log('[SimplifiedRespec] Initialization complete');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async processChatMessage(message: string): Promise<ChatResult> {
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
      // Use Anthropic service for better analysis
      const anthropicResult = await this.anthropicService.analyzeRequirements(
        message,
        {
          conversationHistory: this.conversationHistory.slice(-5), // Last 5 messages for context
          sessionId: this.sessionId
        }
      );

      // Convert Anthropic requirements to FormUpdate format
      const formUpdates: FormUpdate[] = anthropicResult.requirements.map(req => ({
        section: req.section,
        field: req.field,
        value: req.value,
        isAssumption: req.isAssumption,
        confidence: req.confidence
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
    const defaults = this.smartDefaults[context] || this.smartDefaults.generic;

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
}
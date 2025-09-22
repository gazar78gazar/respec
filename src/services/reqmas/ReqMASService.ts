// ReqMASService.ts - Complete MAS implementation in frontend
// NO BACKEND REQUIRED - All logic runs in browser

import { v4 as uuidv4 } from 'uuid';
import { LLMService } from './LLMService';

// ============= TYPES =============
export interface SharedState {
  sessionId: string;
  timestamp: number;
  requirements: RequirementArtifact;
  useCases: DetectedUseCase[];
  chatLog: ChatEntry[];
  debugLog: AgentThought[];
  currentStep: FlowStep;
  conflicts: Conflict[];
  pendingClarification?: ClarificationRequest;
}

export interface RequirementArtifact {
  system: Record<string, any>;
  io: Record<string, any>;
  communication: Record<string, any>;
  environmental: Record<string, any>;
  commercial: Record<string, any>;
  constraints: Constraint[];
}

export interface Constraint {
  id: string;
  value: any;
  confidence: number;
  source: 'user' | 'usecase' | 'autofill';
  category: string;
}

export interface ChatEntry {
  timestamp: number;
  sender: 'user' | 'system';
  message: string;
  metadata?: any;
}

export interface DetectedUseCase {
  ucId: string;
  confidence: number;
  matchedKeywords: string[];
  impliedConstraints: string[];
}

export interface Conflict {
  id: string;
  type: 'certification' | 'budget' | 'technical' | 'incompatibility';
  constraints: string[];
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ClarificationRequest {
  questionId: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    resolvesConstraints: string[];
    value?: any;
  }>;
  conflictId: string;
}

export interface AgentThought {
  timestamp: number;
  agentId: string;
  thought: string;
  data?: any;
  decision?: string;
}

export type FlowStep = 
  | 'awaiting_input'
  | 'extracting_requirements'
  | 'validating_constraints'
  | 'resolving_conflict'
  | 'acknowledging_requirements'
  | 'autofilling_specs'
  | 'completed';

// ============= CONVERSATION CONTEXT (Private) =============
interface ConversationContext {
  currentCategory: string;
  categoryProgress: Record<string, CategoryProgress>;
  lastSystemQuestion: string | null;
  pendingAcknowledgment: string | null;
  assumptionsMade: Constraint[];
  questionsAsked: Set<string>;
}

interface CategoryProgress {
  asked: string[];
  answered: string[];
  skipped: string[];
}

// ============= MAIN SERVICE CLASS =============
export class ReqMASService {
  private state: SharedState;
  private conversationContext: ConversationContext;
  private llmService: LLMService;
  
  // Category configuration
  private readonly CATEGORIES = {
    UC: 'use_case',
    IO: 'io',
    COMM: 'communication',
    PERF: 'performance',
    ENV: 'environment',
    COMMERCIAL: 'commercial'
  };
  
  private readonly CATEGORY_ORDER = [
    this.CATEGORIES.UC,
    this.CATEGORIES.IO,
    this.CATEGORIES.COMM,
    this.CATEGORIES.PERF,
    this.CATEGORIES.ENV,
    this.CATEGORIES.COMMERCIAL
  ];
  
  private readonly CATEGORY_QUESTIONS: Record<string, string[]> = {
    [this.CATEGORIES.UC]: [
      "What is the primary use case for this system?",
      "Will this system need to monitor only, control only, or both monitor and control?",
      "How many devices or sensors will be connected?"
    ],
    [this.CATEGORIES.IO]: [
      "How many analog inputs do you need?",
      "How many analog outputs do you need?",
      "What type of signals will you use (4-20mA current or 0-10V voltage)?",
      "How many digital inputs and outputs do you need?"
    ],
    [this.CATEGORIES.COMM]: [
      "What communication protocols do you need (Ethernet, RS485, wireless)?",
      "How many Ethernet ports do you require?",
      "Will this connect to an existing network or operate standalone?"
    ],
    [this.CATEGORIES.PERF]: [
      "What operating system does your application run on?",
      "What response times do you need (regular or real-time)?",
      "How much data storage do you need?"
    ],
    [this.CATEGORIES.ENV]: [
      "What is the ambient temperature range where the PC will operate?",
      "Does the system need to be fanless?",
      "What IP rating do you require for dust and moisture protection?"
    ],
    [this.CATEGORIES.COMMERCIAL]: [
      "What is your budget per unit?",
      "What is your preferred lead time?",
      "Do you need any specific certifications?"
    ]
  };
  
  // Extraction patterns
  private readonly EXTRACTION_PATTERNS = {
    io: {
      analog_inputs: /(\d+)\s*(?:analog|ai)\s*input/i,
      analog_outputs: /(\d+)\s*(?:analog|ao)\s*output/i,
      digital_inputs: /(\d+)\s*(?:digital|di)\s*input/i,
      digital_outputs: /(\d+)\s*(?:digital|do)\s*output/i,
      signal_type: /(4-20\s*ma|0-10\s*v|current|voltage)/i,
      devices: /(\d+)\s*(?:ovens?|devices?|sensors?|controllers?)/i
    },
    communication: {
      ethernet_ports: /(\d+)\s*ethernet/i,
      protocol: /(modbus|profibus|ethernet|rs485|rs232|wireless|wifi)/i,
      usb_ports: /(\d+)\s*usb/i
    },
    environment: {
      temperature: /(-?\d+)\s*to\s*(-?\d+)\s*(?:degrees?|°|c)/i,
      fanless: /(fanless|no\s*fan|passive\s*cooling)/i,
      ip_rating: /ip\s*(\d{2})/i,
      location: /(indoor|outdoor|harsh|industrial)/i
    },
    performance: {
      os: /(windows|linux|ubuntu|debian)/i,
      realtime: /(real[\s-]?time|regular|normal)/i,
      storage: /(\d+)\s*(gb|tb|gigabyte|terabyte)/i
    },
    commercial: {
      budget: /\$?(\d+)/,
      leadtime: /(\d+)\s*(days?|weeks?|months?)/i
    }
  };
  
  constructor() {
    this.state = this.createInitialState();
    this.conversationContext = this.createInitialContext();
    this.llmService = new LLMService();
  }
  
  // ============= PUBLIC METHODS =============
  
  /**
   * Process user message and return response
   */
  async processMessage(userMessage: string): Promise<{
    response: string;
    state: SharedState;
  }> {
    // Add to chat log
    this.addChatEntry('user', userMessage);
    
    // Debug log
    this.addDebugLog('orchestrator', `Processing: ${userMessage}`);
    
    // Classify input type
    const inputType = this.classifyInput(userMessage);
    this.addDebugLog('orchestrator', `Classified as: ${inputType}`);
    
    // Process based on type
    let response: string;
    
    switch (inputType) {
      case 'answer_to_question':
        response = await this.handleAnswer(userMessage);
        break;
      case 'user_question':
        response = await this.handleUserQuestion(userMessage);
        break;
      case 'clarification_response':
        response = await this.handleClarificationResponse(userMessage);
        break;
      case 'initial_requirement':
        response = await this.handleInitialRequirement(userMessage);
        break;
      default:
        response = await this.handleGeneralInput(userMessage);
    }
    
    // Add system response to chat
    this.addChatEntry('system', response);
    
    // Save to localStorage
    this.saveState();
    
    return {
      response,
      state: this.getPublicState()
    };
  }
  
  /**
   * Trigger autofill
   */
  triggerAutofill(): RequirementArtifact {
    this.addDebugLog('autofill', 'Triggering autofill');
    
    // Fill missing fields with defaults based on use case
    const filled = this.fillMissingRequirements();
    
    this.state.currentStep = 'completed';
    this.saveState();
    
    return filled;
  }
  
  /**
   * Get current state (public version)
   */
  getPublicState(): SharedState {
    return { ...this.state };
  }
  
  /**
   * Reset session
   */
  resetSession(): void {
    this.state = this.createInitialState();
    this.conversationContext = this.createInitialContext();
    this.saveState();
  }
  
  // ============= PRIVATE METHODS =============
  
  private createInitialState(): SharedState {
    return {
      sessionId: uuidv4(),
      timestamp: Date.now(),
      requirements: {
        system: {},
        io: {},
        communication: {},
        environmental: {},
        commercial: {},
        constraints: []
      },
      useCases: [],
      chatLog: [],
      debugLog: [],
      currentStep: 'awaiting_input',
      conflicts: [],
      pendingClarification: undefined
    };
  }
  
  private createInitialContext(): ConversationContext {
    return {
      currentCategory: this.CATEGORIES.UC,
      categoryProgress: {},
      lastSystemQuestion: null,
      pendingAcknowledgment: null,
      assumptionsMade: [],
      questionsAsked: new Set()
    };
  }
  
  private classifyInput(input: string): string {
    const lower = input.toLowerCase();
    
    // Check for pending clarification
    if (this.state.pendingClarification) {
      return 'clarification_response';
    }
    
    // First message
    if (this.state.chatLog.length === 1) {
      return 'initial_requirement';
    }
    
    // User asking a question
    if (lower.includes('?') || 
        lower.includes('what') || 
        lower.includes('how') || 
        lower.includes('does')) {
      return 'user_question';
    }
    
    // Answering system question
    if (this.conversationContext.lastSystemQuestion) {
      return 'answer_to_question';
    }
    
    return 'general_input';
  }
  
  private async handleInitialRequirement(input: string): Promise<string> {
    // Extract initial requirements
    const extracted = this.extractRequirements(input);
    
    // Apply constraints
    for (const constraint of extracted) {
      this.addConstraint(constraint);
    }
    
    // Detect use case
    if (input.toLowerCase().includes('oven') || 
        input.toLowerCase().includes('controller')) {
      this.state.useCases.push({
        ucId: 'industrial_control',
        confidence: 0.9,
        matchedKeywords: ['oven', 'controller', 'temperature'],
        impliedConstraints: ['analog_inputs', 'analog_outputs', 'ethernet']
      });
    }
    
    // Generate acknowledgment and first question
    const ack = this.generateAcknowledgment(input, extracted);
    const question = this.getNextQuestion();
    
    if (question) {
      this.markQuestionAsked(question);
      return `${ack} ${question}`;
    }
    
    return ack;
  }
  
  private async handleAnswer(input: string): Promise<string> {
    // Check for "don't know" scenario
    if (input.toLowerCase().includes("don't know") || 
        input.toLowerCase().includes("not sure")) {
      return await this.handleDontKnow();
    }
    
    // Extract requirements from answer
    const extracted = this.extractRequirements(input);
    
    // Apply constraints
    for (const constraint of extracted) {
      this.addConstraint(constraint);
    }
    
    // Mark question as answered
    if (this.conversationContext.lastSystemQuestion) {
      this.markQuestionAnswered(this.conversationContext.lastSystemQuestion);
    }
    
    // Check for conflicts
    const conflicts = this.validateConstraints();
    if (conflicts.length > 0) {
      return this.generateClarification(conflicts[0]);
    }
    
    // Check if should wrap up category
    if (this.shouldWrapUpCategory()) {
      return this.generateCategoryWrapUp();
    }
    
    // Get next question
    const nextQuestion = this.getNextQuestion();
    if (nextQuestion) {
      const ack = extracted.length > 0 ? "Good!" : "OK.";
      this.markQuestionAsked(nextQuestion);
      return `${ack} ${nextQuestion}`;
    }
    
    // Move to next category
    if (this.moveToNextCategory()) {
      const newQuestion = this.getNextQuestion();
      if (newQuestion) {
        this.markQuestionAsked(newQuestion);
        return `Now let's discuss ${this.conversationContext.currentCategory}. ${newQuestion}`;
      }
    }
    
    // Complete
    this.state.currentStep = 'completed';
    return "Great! We've covered all requirements. You can click the autofill button to complete the specification.";
  }
  
  private async handleUserQuestion(input: string): Promise<string> {
    let answer = "";
    
    // Answer specific questions
    if (input.toLowerCase().includes('matter')) {
      answer = "Sure, it allows us to select the appropriate IO gateway.";
    } else if (input.toLowerCase().includes('what') && input.toLowerCase().includes('other')) {
      answer = "You might also need to consider: wireless access, serial ports, display ports, or special communication protocols.";
    } else {
      answer = "That's a good question. Let me help you with that.";
    }
    
    // Continue with last question if exists
    if (this.conversationContext.lastSystemQuestion) {
      return `${answer}\n\nNow, ${this.conversationContext.lastSystemQuestion}`;
    }
    
    return answer;
  }
  
  private async handleClarificationResponse(input: string): Promise<string> {
    if (!this.state.pendingClarification) {
      return await this.handleAnswer(input);
    }
    
    const clarification = this.state.pendingClarification;
    
    // Find selected option
    let selectedOption = null;
    for (const option of clarification.options) {
      if (input.toLowerCase().includes(option.label.toLowerCase()) ||
          input.toLowerCase().includes(option.id)) {
        selectedOption = option;
        break;
      }
    }
    
    if (!selectedOption && clarification.options.length === 2) {
      // Try to match binary answers
      if (input.toLowerCase().includes('first') || input.toLowerCase().includes('a')) {
        selectedOption = clarification.options[0];
      } else if (input.toLowerCase().includes('second') || input.toLowerCase().includes('b')) {
        selectedOption = clarification.options[1];
      }
    }
    
    if (!selectedOption) {
      return `I didn't understand your choice. ${clarification.question}`;
    }
    
    // Apply resolution
    for (const constraintId of selectedOption.resolvesConstraints) {
      const constraint = this.state.requirements.constraints.find(c => c.id === constraintId);
      if (constraint) {
        constraint.value = selectedOption.value || selectedOption.label;
        constraint.confidence = 1.0;
      } else {
        this.addConstraint({
          id: constraintId,
          value: selectedOption.value || selectedOption.label,
          confidence: 1.0,
          source: 'user',
          category: this.conversationContext.currentCategory
        });
      }
    }
    
    // Clear clarification
    this.state.pendingClarification = undefined;
    
    // Continue flow
    return await this.handleAnswer('');
  }
  
  private async handleDontKnow(): Promise<string> {
    let assumption: Constraint | null = null;
    
    // Try LLM first if available
    if (this.llmService.isAvailable()) {
      const prompt = `User doesn't know the answer to: "${this.conversationContext.lastSystemQuestion}"
      Context: Industrial control system for monitoring/controlling equipment.
      Generate ONE reasonable assumption value. Just the value, no explanation.
      Examples: "4-20mA current", "2 ethernet ports", "0-40°C", "fanless"`;
      
      try {
        const llmResponse = await this.llmService.generateResponse(prompt);
        if (llmResponse) {
          assumption = {
            id: this.inferFieldFromQuestion(),
            value: llmResponse.trim(),
            confidence: 0.7,
            source: 'usecase' as const,
            category: this.conversationContext.currentCategory
          };
        }
      } catch (error) {
        console.log('LLM failed, using rules');
      }
    }
    
    // Fallback to rule-based if LLM unavailable or failed
    if (!assumption) {
      assumption = this.generateAssumption() || this.generateDefaultAssumption();
    }
    
    if (assumption) {
      this.addConstraint(assumption);
      this.conversationContext.assumptionsMade.push(assumption);
      
      // Mark question as answered
      if (this.conversationContext.lastSystemQuestion) {
        this.markQuestionAnswered(this.conversationContext.lastSystemQuestion);
      }
      
      // Get next question
      const nextQuestion = this.getNextQuestion();
      if (nextQuestion) {
        this.markQuestionAsked(nextQuestion);
        return `For now, let's assume ${assumption.value}. You can always change that later. ${nextQuestion}`;
      }
    }
    
    return await this.handleAnswer('');
  }
  
  private async handleGeneralInput(input: string): Promise<string> {
    return await this.handleAnswer(input);
  }
  
  private extractRequirements(input: string): Constraint[] {
    const constraints: Constraint[] = [];
    
    // Check ALL categories for patterns, not just current
    for (const [categoryKey, patterns] of Object.entries(this.EXTRACTION_PATTERNS)) {
      for (const [field, pattern] of Object.entries(patterns)) {
        const match = input.match(pattern as RegExp);
        if (match) {
          constraints.push({
            id: field,
            value: match[1] || match[0],
            confidence: 0.9,
            source: 'user',
            category: categoryKey
          });
        }
      }
    }
    
    return constraints;
  }
  
  private generateAcknowledgment(input: string, extracted: Constraint[]): string {
    if (input.toLowerCase().includes('oven')) {
      return "Sounds like you need a PC to control your production line ovens remotely based on their temperature levels.";
    }
    
    if (extracted.length > 0) {
      const first = extracted[0];
      return `Good, I see you need ${first.value} ${first.id.replace(/_/g, ' ')}.`;
    }
    
    return "I understand.";
  }
  
  private generateAssumption(): Constraint | null {
    const lastQ = this.conversationContext.lastSystemQuestion?.toLowerCase() || '';
    const category = this.conversationContext.currentCategory;
    
    if (lastQ.includes('signal')) {
      return {
        id: 'signal_type',
        value: '4-20mA current signaling',
        confidence: 0.7,
        source: 'usecase',
        category: 'io'
      };
    }
    
    if (lastQ.includes('temperature')) {
      return {
        id: 'temperature_range',
        value: '0 to 40°C',
        confidence: 0.7,
        source: 'usecase',
        category: 'environment'
      };
    }
    
    if (lastQ.includes('ethernet')) {
      return {
        id: 'ethernet_ports',
        value: '2',
        confidence: 0.7,
        source: 'usecase',
        category: 'communication'
      };
    }
    
    return null;
  }
  
  private generateDefaultAssumption(): Constraint {
    // Fallback assumption when no specific pattern matches
    const categoryDefaults: Record<string, { id: string; value: string }> = {
      'use_case': { id: 'monitoring_type', value: 'monitoring and control' },
      'io': { id: 'io_configuration', value: 'standard I/O setup' },
      'communication': { id: 'protocol', value: 'Ethernet' },
      'environment': { id: 'environmental_spec', value: 'indoor installation' },
      'performance': { id: 'performance_spec', value: 'standard performance' },
      'commercial': { id: 'commercial_requirement', value: 'standard commercial terms' }
    };
    
    const defaultSpec = categoryDefaults[this.conversationContext.currentCategory] || 
                       { id: 'requirement', value: 'standard configuration' };
    
    return {
      id: defaultSpec.id,
      value: defaultSpec.value,
      confidence: 0.5,
      source: 'usecase',
      category: this.conversationContext.currentCategory
    };
  }
  
  private inferFieldFromQuestion(): string {
    const question = this.conversationContext.lastSystemQuestion?.toLowerCase() || '';
    
    if (question.includes('analog') && question.includes('input')) return 'analog_inputs';
    if (question.includes('analog') && question.includes('output')) return 'analog_outputs';
    if (question.includes('signal')) return 'signal_type';
    if (question.includes('ethernet')) return 'ethernet_ports';
    if (question.includes('temperature')) return 'temperature_range';
    if (question.includes('fan')) return 'cooling';
    if (question.includes('budget')) return 'budget';
    if (question.includes('operating system')) return 'operating_system';
    
    // Default based on category
    const categoryDefaults: Record<string, string> = {
      'use_case': 'monitoring_type',
      'io': 'io_configuration',
      'communication': 'protocol',
      'environment': 'environmental_spec',
      'performance': 'performance_spec',
      'commercial': 'commercial_requirement'
    };
    
    return categoryDefaults[this.conversationContext.currentCategory] || 'requirement';
  }
  
  private validateConstraints(): Conflict[] {
    const conflicts: Conflict[] = [];
    const constraints = this.state.requirements.constraints;
    
    // Check for signal type conflicts
    const signalTypes = constraints.filter(c => c.id === 'signal_type');
    if (signalTypes.length > 1) {
      const values = signalTypes.map(c => c.value);
      if (values.includes('4-20mA') && values.includes('0-10V')) {
        conflicts.push({
          id: 'signal_conflict',
          type: 'technical',
          constraints: ['signal_type'],
          description: 'Cannot have both current and voltage signals',
          priority: 'high'
        });
      }
    }
    
    return conflicts;
  }
  
  private generateClarification(conflict: Conflict): string {
    const clarification: ClarificationRequest = {
      questionId: `clarify_${Date.now()}`,
      question: "Is the analog signal you're getting from the sensors either current (like 4-20mA) or voltage (like 0-10V)?",
      options: [
        {
          id: 'current',
          label: '4-20mA current',
          resolvesConstraints: ['signal_type'],
          value: '4-20mA current'
        },
        {
          id: 'voltage',
          label: '0-10V voltage',
          resolvesConstraints: ['signal_type'],
          value: '0-10V voltage'
        }
      ],
      conflictId: conflict.id
    };
    
    this.state.pendingClarification = clarification;
    return clarification.question;
  }
  
  private getNextQuestion(): string | null {
    const category = this.conversationContext.currentCategory;
    const questions = this.CATEGORY_QUESTIONS[category] || [];
    const progress = this.getCategoryProgress(category);
    
    for (const question of questions) {
      if (!progress.asked.includes(question)) {
        return question;
      }
    }
    
    return null;
  }
  
  private shouldWrapUpCategory(): boolean {
    const category = this.conversationContext.currentCategory;
    const progress = this.getCategoryProgress(category);
    const questions = this.CATEGORY_QUESTIONS[category] || [];
    
    const completion = progress.answered.length / Math.max(questions.length, 1);
    return completion >= 0.8 || progress.asked.length >= questions.length;
  }
  
  private generateCategoryWrapUp(): string {
    const category = this.conversationContext.currentCategory;
    const constraints = this.state.requirements.constraints.filter(c => c.category === category);
    
    let summary = "";
    if (constraints.length > 0) {
      const items = constraints.map(c => `${c.id.replace(/_/g, ' ')}: ${c.value}`).join(', ');
      summary = `Alright, so we need ${items}.`;
    } else {
      summary = `We've covered ${category}.`;
    }
    
    // Check if there's a next category
    const nextCategory = this.getNextCategory();
    if (nextCategory) {
      // Move to next category
      this.conversationContext.currentCategory = nextCategory;
      const nextQuestion = this.getNextQuestion();
      
      if (nextQuestion) {
        this.markQuestionAsked(nextQuestion);
        return `${summary} Do you have any other ${category} requirements, or should we proceed to ${nextCategory} requirements?\n\n${nextQuestion}`;
      }
    }
    
    return summary;
  }
  
  private moveToNextCategory(): boolean {
    const next = this.getNextCategory();
    if (next) {
      this.conversationContext.currentCategory = next;
      return true;
    }
    return false;
  }
  
  private getNextCategory(): string | null {
    const current = this.conversationContext.currentCategory;
    const index = this.CATEGORY_ORDER.indexOf(current);
    
    if (index < this.CATEGORY_ORDER.length - 1) {
      return this.CATEGORY_ORDER[index + 1];
    }
    
    return null;
  }
  
  private getCategoryProgress(category: string): CategoryProgress {
    if (!this.conversationContext.categoryProgress[category]) {
      this.conversationContext.categoryProgress[category] = {
        asked: [],
        answered: [],
        skipped: []
      };
    }
    return this.conversationContext.categoryProgress[category];
  }
  
  private markQuestionAsked(question: string): void {
    const category = this.conversationContext.currentCategory;
    const progress = this.getCategoryProgress(category);
    
    if (!progress.asked.includes(question)) {
      progress.asked.push(question);
    }
    
    this.conversationContext.lastSystemQuestion = question;
    this.conversationContext.questionsAsked.add(question);
  }
  
  private markQuestionAnswered(question: string): void {
    const category = this.conversationContext.currentCategory;
    const progress = this.getCategoryProgress(category);
    
    if (!progress.answered.includes(question)) {
      progress.answered.push(question);
    }
  }
  
  private addConstraint(constraint: Constraint): void {
    const existing = this.state.requirements.constraints.findIndex(c => c.id === constraint.id);
    
    if (existing >= 0) {
      this.state.requirements.constraints[existing] = constraint;
    } else {
      this.state.requirements.constraints.push(constraint);
    }
    
    // Also update the category-specific requirements
    const category = constraint.category as keyof RequirementArtifact;
    if (this.state.requirements[category]) {
      (this.state.requirements[category] as any)[constraint.id] = constraint.value;
    }
  }
  
  private fillMissingRequirements(): RequirementArtifact {
    // Default values based on use case
    const defaults: Record<string, any> = {
      processor_type: 'Intel Core i5',
      memory_capacity: '8GB',
      storage_capacity: '256GB',
      storage_type: 'SSD',
      operating_temperature: '0-40°C',
      ip_rating: 'IP20',
      cooling: 'fanless',
      mounting: 'DIN rail',
      budget_per_unit: '$1500',
      certifications: 'CE, UL',
      warranty: '2 years'
    };
    
    // Fill missing fields
    for (const [key, value] of Object.entries(defaults)) {
      if (!this.state.requirements.constraints.find(c => c.id === key)) {
        this.addConstraint({
          id: key,
          value,
          confidence: 0.6,
          source: 'autofill',
          category: this.inferCategory(key)
        });
      }
    }
    
    return this.state.requirements;
  }
  
  private inferCategory(field: string): string {
    if (field.includes('processor') || field.includes('memory') || field.includes('storage')) {
      return 'system';
    }
    if (field.includes('temperature') || field.includes('ip_') || field.includes('cooling')) {
      return 'environment';
    }
    if (field.includes('budget') || field.includes('certification') || field.includes('warranty')) {
      return 'commercial';
    }
    return 'system';
  }
  
  private addChatEntry(sender: 'user' | 'system', message: string): void {
    this.state.chatLog.push({
      timestamp: Date.now(),
      sender,
      message,
      metadata: {}
    });
  }
  
  private addDebugLog(agentId: string, thought: string, data?: any): void {
    this.state.debugLog.push({
      timestamp: Date.now(),
      agentId,
      thought,
      data,
      decision: null
    });
  }
  
  private saveState(): void {
    // Check if localStorage exists (not in test environment)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('reqmas_state', JSON.stringify(this.state));
      localStorage.setItem('reqmas_context', JSON.stringify(this.conversationContext));
    }
  }
  
  // Load from localStorage on init
  loadState(): void {
    if (typeof localStorage === 'undefined') {
      return; // Skip in test environment
    }
    
    try {
      const savedState = localStorage.getItem('reqmas_state');
      const savedContext = localStorage.getItem('reqmas_context');
      
      if (savedState) {
        this.state = JSON.parse(savedState);
      }
      
      if (savedContext) {
        this.conversationContext = JSON.parse(savedContext);
        // Restore Set from array
        this.conversationContext.questionsAsked = new Set(
          Array.from(this.conversationContext.questionsAsked || [])
        );
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  }
}

// Export singleton instance
export const reqMASService = new ReqMASService();
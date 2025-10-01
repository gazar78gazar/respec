/**
 * SemanticMatcher - Advanced LLM-based semantic parsing for technical requirements
 *
 * This service extends the existing AnthropicService to provide:
 * 1. Intent detection (is this a technical requirement?)
 * 2. Semantic extraction (pull out technical values and constraints)
 * 3. UC1 specification mapping (link to UC1 schema)
 * 4. Confidence scoring (how certain are we?)
 * 5. Integration with artifact state management
 */

import { AnthropicService } from '../AnthropicService';
import { UC1ValidationEngine, UC1Specification } from '../UC1ValidationEngine';
import { ArtifactManager } from '../artifacts/ArtifactManager';
import { CompatibilityLayer } from '../artifacts/CompatibilityLayer';

// ============= SEMANTIC MATCHING TYPES =============

export interface SemanticExtractionResult {
  hasRequirements: boolean;
  extractions: TechnicalExtraction[];
  intent: MessageIntent;
  confidence: number;
  processingTime: number;
}

export interface TechnicalExtraction {
  category: string;           // e.g., 'processor', 'memory', 'power'
  value: string;             // e.g., 'Intel Core i7', '16GB', '< 10W'
  constraint?: string;       // e.g., 'minimum', 'maximum', 'exactly'
  context: string;          // Original text context
  confidence: number;       // 0.0 - 1.0
  uc1Candidates: UC1Candidate[];
}

export interface UC1Candidate {
  specId: string;           // e.g., 'spc001'
  specName: string;         // e.g., 'processor_type'
  matchReason: string;      // Why this spec was chosen
  confidence: number;       // 0.0 - 1.0
  uc1Spec: UC1Specification;
}

export interface MessageIntent {
  type: 'requirement' | 'question' | 'clarification' | 'other';
  subtype?: 'specification' | 'constraint' | 'preference' | 'comparison';
  requiresResponse: boolean;
  suggestedActions: string[];
}

export interface SemanticMatchingContext {
  currentRequirements: any;  // Current form state
  artifactState: any;        // Current artifact state
  chatHistory: any[];        // Previous messages for context
  userPreferences?: any;     // Learned user patterns
}

// ============= MAIN SEMANTIC MATCHER CLASS =============

export class SemanticMatcher {
  private anthropicService: AnthropicService;
  private uc1Engine: UC1ValidationEngine;
  private artifactManager: ArtifactManager | null = null;
  private compatibilityLayer: CompatibilityLayer | null = null;

  // Semantic parsing models (future: could load different models)
  private intentModel: string = import.meta.env.VITE_LLM_MODEL || 'claude-4-opus-20241222';
  private extractionModel: string = import.meta.env.VITE_LLM_MODEL || 'claude-4-opus-20241222';

  constructor(
    anthropicService: AnthropicService,
    uc1Engine: UC1ValidationEngine
  ) {
    this.anthropicService = anthropicService;
    this.uc1Engine = uc1Engine;
  }

  // ============= INITIALIZATION =============

  async initialize(
    artifactManager?: ArtifactManager,
    compatibilityLayer?: CompatibilityLayer
  ): Promise<void> {
    this.artifactManager = artifactManager || null;
    this.compatibilityLayer = compatibilityLayer || null;

    // Verify UC1 engine is ready
    if (!this.uc1Engine.isReady()) {
      throw new Error('UC1ValidationEngine must be initialized before SemanticMatcher');
    }

    console.log('[SemanticMatcher] Initialized with UC1 schema and LLM services');
  }

  // ============= MAIN SEMANTIC PARSING =============

  async parseMessage(
    message: string,
    context?: SemanticMatchingContext
  ): Promise<SemanticExtractionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Intent Detection
      const intent = await this.detectIntent(message, context);

      // Step 2: Early exit if not requirement-related
      if (intent.type !== 'requirement') {
        return {
          hasRequirements: false,
          extractions: [],
          intent,
          confidence: 0.95,
          processingTime: Date.now() - startTime
        };
      }

      // Step 3: Technical Extraction
      const extractions = await this.extractTechnicalRequirements(message, context);

      // Step 4: UC1 Mapping
      const mappedExtractions = await this.mapToUC1Specifications(extractions);

      // Step 5: Confidence Scoring
      const overallConfidence = this.calculateOverallConfidence(mappedExtractions, intent);

      return {
        hasRequirements: mappedExtractions.length > 0,
        extractions: mappedExtractions,
        intent,
        confidence: overallConfidence,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('[SemanticMatcher] Parsing failed:', error);
      return {
        hasRequirements: false,
        extractions: [],
        intent: { type: 'other', requiresResponse: false, suggestedActions: [] },
        confidence: 0.0,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============= INTENT DETECTION =============

  private async detectIntent(
    message: string,
    context?: SemanticMatchingContext
  ): Promise<MessageIntent> {

    const prompt = this.buildIntentDetectionPrompt(message, context);

    // For MVP: Use pattern matching with LLM fallback
    const patterns = {
      requirement: [
        /\b(i need|i want|looking for|require|must have|need|want|system needs|should be|should have)\b/i,
        /\b(processor|cpu|memory|ram|storage|power|performance|intel|amd|gb|mb|tb|ssd|hdd)\b/i,
        /\b(specs|specification|requirements|under \d+w|over \d+gb|battery|optimized)\b/i
      ],
      question: [
        /\b(what|how|why|which|can you|do you|tell me|explain)\b/i,
        /\?/
      ],
      clarification: [
        /\b(not sure|don't know|unclear|confused|unsure|help me)\b/i,
        /\b(more details|explain|help me understand|what should)\b/i
      ]
    };

    // Pattern-based detection (fast)
    for (const [intentType, patternList] of Object.entries(patterns)) {
      if (patternList.some(pattern => pattern.test(message))) {
        return {
          type: intentType as any,
          requiresResponse: intentType !== 'requirement',
          suggestedActions: this.getSuggestedActions(intentType as any)
        };
      }
    }

    // TODO: Add LLM-based intent detection for complex cases

    return {
      type: 'other',
      requiresResponse: true,
      suggestedActions: ['general_response']
    };
  }

  private getSuggestedActions(intentType: string): string[] {
    const actions = {
      'requirement': ['extract_specs', 'validate_constraints', 'check_conflicts'],
      'question': ['provide_info', 'suggest_options'],
      'clarification': ['ask_followup', 'suggest_autofill'],
      'other': ['general_response']
    };
    return actions[intentType] || ['general_response'];
  }

  // ============= TECHNICAL EXTRACTION =============

  private async extractTechnicalRequirements(
    message: string,
    context?: SemanticMatchingContext
  ): Promise<TechnicalExtraction[]> {

    // For MVP: Pattern-based extraction with confidence scoring
    const extractions: TechnicalExtraction[] = [];

    // Processor extraction
    const processorMatch = message.match(/(intel|amd)[\s-]*(core|ryzen)?[\s-]*(i[3579]|[0-9]+)?|fast\s*cpu/i);
    if (processorMatch) {
      extractions.push({
        category: 'processor',
        value: processorMatch[0],
        context: message,
        confidence: processorMatch[0].toLowerCase().includes('fast') ? 0.6 : 0.9,
        uc1Candidates: [] // Will be populated in mapping step
      });
    }

    // Memory extraction
    const memoryMatch = message.match(/(\d+)\s*(gb|mb)\s*(?:ram|memory)?|(?:lots of|more)\s*(?:ram|memory)/i);
    if (memoryMatch) {
      let value = memoryMatch[0];
      if (memoryMatch[1] && memoryMatch[2]) {
        value = `${memoryMatch[1]}${memoryMatch[2].toUpperCase()}`;
      }
      extractions.push({
        category: 'memory',
        value: value,
        context: message,
        confidence: memoryMatch[1] ? 0.85 : 0.6, // Lower confidence for vague terms
        uc1Candidates: []
      });
    }

    // Power extraction
    const powerMatch = message.match(/(under \d+w|<?\s*\d+w|low power|high performance|battery\s*optimized?)/i);
    if (powerMatch) {
      extractions.push({
        category: 'power',
        value: powerMatch[0],
        context: message,
        confidence: 0.8,
        uc1Candidates: []
      });
    }

    // Storage extraction
    const storageMatch = message.match(/(\d+\s*(?:gb|tb)|ssd|hdd|fast\s*storage|solid\s*state)/i);
    if (storageMatch) {
      extractions.push({
        category: 'storage',
        value: storageMatch[0],
        context: message,
        confidence: 0.8,
        uc1Candidates: []
      });
    }

    // Performance extraction
    const performanceMatch = message.match(/(high performance|fast|low latency|quick|responsive)/i);
    if (performanceMatch) {
      extractions.push({
        category: 'performance',
        value: performanceMatch[0],
        context: message,
        confidence: 0.6,
        uc1Candidates: []
      });
    }

    // TODO: Add LLM-based extraction for complex requirements

    return extractions;
  }

  // ============= UC1 MAPPING =============

  private async mapToUC1Specifications(
    extractions: TechnicalExtraction[]
  ): Promise<TechnicalExtraction[]> {

    const mappedExtractions = [...extractions];

    for (const extraction of mappedExtractions) {
      extraction.uc1Candidates = await this.findUC1Candidates(extraction);
    }

    return mappedExtractions;
  }

  private async findUC1Candidates(
    extraction: TechnicalExtraction
  ): Promise<UC1Candidate[]> {

    const candidates: UC1Candidate[] = [];

    // Category-based mapping: processor→spc001, memory→spc002, power→spc036
    const categoryMap: { [key: string]: string[] } = {
      'processor': ['spc001'],  // processor_type
      'memory': ['spc002', 'spc044'],  // memory_capacity, memory_type
      'power': ['spc036'],      // max_power_consumption
      'storage': ['spc003', 'spc004'],  // storage_type, storage_capacity
      'performance': ['spc005'] // response_latency
    };

    const candidateIds = categoryMap[extraction.category] || [];

    for (const specId of candidateIds) {
      const uc1Spec = this.uc1Engine.getSpecification(specId);
      if (uc1Spec) {
        candidates.push({
          specId,
          specName: uc1Spec.name,
          matchReason: `Category match: ${extraction.category}`,
          confidence: 0.8, // Base confidence for category match
          uc1Spec
        });
      }
    }

    return candidates;
  }

  // ============= CONFIDENCE SCORING =============

  private calculateOverallConfidence(
    extractions: TechnicalExtraction[],
    intent: MessageIntent
  ): number {

    if (extractions.length === 0) return 0.0;

    // Average extraction confidence
    const avgExtractionConfidence = extractions.reduce(
      (sum, ext) => sum + ext.confidence, 0
    ) / extractions.length;

    // Intent confidence boost
    const intentBoost = intent.type === 'requirement' ? 0.1 : 0.0;

    // UC1 mapping confidence
    const mappingConfidence = extractions.reduce((sum, ext) => {
      const bestCandidate = ext.uc1Candidates.reduce((best, candidate) =>
        candidate.confidence > best.confidence ? candidate : best,
        { confidence: 0 }
      );
      return sum + bestCandidate.confidence;
    }, 0) / extractions.length;

    return Math.min(0.95,
      (avgExtractionConfidence * 0.4) +
      (mappingConfidence * 0.4) +
      (intentBoost * 0.2)
    );
  }

  // ============= INTEGRATION HELPERS =============

  async applyExtractionsToArtifacts(
    extractions: TechnicalExtraction[]
  ): Promise<void> {

    if (!this.artifactManager || !this.compatibilityLayer) {
      console.warn('[SemanticMatcher] Artifact integration not available');
      return;
    }

    for (const extraction of extractions) {
      const bestCandidate = extraction.uc1Candidates.reduce((best, candidate) =>
        candidate.confidence > best.confidence ? candidate : best,
        { confidence: 0 }
      );

      if (bestCandidate.confidence > 0.7) {
        try {
          await this.artifactManager.addSpecificationToMapped(
            bestCandidate.uc1Spec,
            extraction.value,
            `LLM extraction: "${extraction.context}"`,
            `Semantic match with ${(bestCandidate.confidence * 100).toFixed(0)}% confidence. substitutionNote: Original request was "${extraction.context}"`
          );
          console.log(`[SemanticMatcher] Added ${bestCandidate.specId}: ${extraction.value}`);
        } catch (error) {
          console.error(`[SemanticMatcher] Failed to add ${bestCandidate.specId}:`, error);
        }
      }
    }
  }

  // ============= UTILITY METHODS =============

  private buildIntentDetectionPrompt(message: string, context?: SemanticMatchingContext): string {
    // TODO: Build sophisticated prompts for LLM intent detection
    return `Analyze this message for technical requirements: "${message}"`;
  }

  isReady(): boolean {
    return this.uc1Engine.isReady();
  }

  getStats(): any {
    return {
      uc1SpecsAvailable: this.uc1Engine.isReady() ? 56 : 0,
      artifactIntegration: !!this.artifactManager,
      compatibilityLayer: !!this.compatibilityLayer
    };
  }
}

// Export singleton for easy use
export const createSemanticMatcher = (
  anthropicService: AnthropicService,
  uc1Engine: UC1ValidationEngine
): SemanticMatcher => {
  return new SemanticMatcher(anthropicService, uc1Engine);
};
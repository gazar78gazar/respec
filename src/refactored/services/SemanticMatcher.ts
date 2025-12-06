/**
 * SemanticMatcher - Advanced LLM-based semantic parsing for technical requirements
 *
 * This service extends the existing AnthropicService to provide:
 * 1. Intent detection (is this a technical requirement?)
 * 2. Semantic extraction (pull out technical values and constraints)
 * 4. Confidence scoring (how certain are we?)
 * 5. Integration with artifact state management
 */

import { ArtifactManager } from "./ArtifactManager";
import { ucDataLayer } from "./DataLayer";
import type { Maybe, UCSpecification } from "../types/UCDataTypes";
import type { Requirements } from "../types/requirements.types";

// ============= SEMANTIC MATCHING TYPES =============

export interface SemanticExtractionResult {
  hasRequirements: boolean;
  extractions: TechnicalExtraction[];
  intent: MessageIntent;
  confidence: number;
  processingTime: number;
}

export interface TechnicalExtraction {
  category: string; // e.g., 'processor', 'memory', 'power'
  value: string; // e.g., 'Intel Core i7', '16GB', '< 10W'
  constraint?: string; // e.g., 'minimum', 'maximum', 'exactly'
  context: string; // Original text context
  confidence: number; // 0.0 - 1.0
  ucCandidates: UCCandidate[];
}

export interface UCCandidate {
  specId: string; // e.g., 'spc001'
  specName: string; // e.g., 'processorType'
  matchReason: string; // Why this spec was chosen
  confidence: number; // 0.0 - 1.0
  ucSpec: UCSpecification;
}

export interface MessageIntent {
  type: "requirement" | "question" | "clarification" | "other";
  subtype?: "specification" | "constraint" | "preference" | "comparison";
  requiresResponse: boolean;
  suggestedActions: string[];
}

type IntentKey = "requirement" | "question" | "clarification" | "other";

export interface SemanticMatchingContext {
  currentRequirements?: Requirements; // Current form state
  artifactState?: unknown; // Current artifact state
  chatHistory: Array<{ role?: string; content?: string }>; // Previous messages for context
  userPreferences?: Record<string, unknown>; // Learned user patterns
}

// ============= MAIN SEMANTIC MATCHER CLASS =============

export class SemanticMatcher {
  private artifactManager: Maybe<ArtifactManager> = null;

  // ============= INITIALIZATION =============

  async initialize(artifactManager?: ArtifactManager): Promise<void> {
    this.artifactManager = artifactManager || null;

    console.log("[SemanticMatcher] Initialized");
  }

  // ============= MAIN SEMANTIC PARSING =============

  async parseMessage(
    message: string,
    context?: SemanticMatchingContext,
  ): Promise<SemanticExtractionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Intent Detection
      const intent = await this.detectIntent(message, context);

      // Step 2: Early exit if not requirement-related
      if (intent.type !== "requirement") {
        return {
          hasRequirements: false,
          extractions: [],
          intent,
          confidence: 0.95,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 3: Technical Extraction
      const extractions = await this.extractTechnicalRequirements(
        message,
        context,
      );

      // Step 4: UC Mapping
      const mappedExtractions = await this.mapToUCSpecifications(extractions);

      // Step 5: Confidence Scoring
      const overallConfidence = this.calculateOverallConfidence(
        mappedExtractions,
        intent,
      );

      return {
        hasRequirements: mappedExtractions.length > 0,
        extractions: mappedExtractions,
        intent,
        confidence: overallConfidence,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[SemanticMatcher] Parsing failed:", error);
      return {
        hasRequirements: false,
        extractions: [],
        intent: {
          type: "other",
          requiresResponse: false,
          suggestedActions: [],
        },
        confidence: 0.0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  // ============= INTENT DETECTION =============

  private async detectIntent(
    message: string,
    _context?: SemanticMatchingContext,
  ): Promise<MessageIntent> {
    // For MVP: Use pattern matching with LLM fallback
    const patterns: Record<IntentKey, RegExp[]> = {
      requirement: [
        /\b(i need|i want|looking for|require|must have|need|want|system needs|should be|should have)\b/i,
        /\b(processor|cpu|memory|ram|storage|power|performance|intel|amd|gb|mb|tb|ssd|hdd)\b/i,
        /\b(specs|specification|requirements|under \d+w|over \d+gb|battery|optimized)\b/i,
      ],
      question: [
        /\b(what|how|why|which|can you|do you|tell me|explain)\b/i,
        /\?/,
      ],
      clarification: [
        /\b(not sure|don't know|unclear|confused|unsure|help me)\b/i,
        /\b(more details|explain|help me understand|what should)\b/i,
      ],
    };

    // Pattern-based detection (fast)
    for (const [intentType, patternList] of Object.entries(patterns) as Array<
      [IntentKey, RegExp[]]
    >) {
      if (patternList.some((pattern) => pattern.test(message))) {
        return {
          type: intentType,
          requiresResponse: intentType !== "requirement",
          suggestedActions: this.getSuggestedActions(intentType),
        };
      }
    }

    // TODO: Add LLM-based intent detection for complex cases

    return {
      type: "other",
      requiresResponse: true,
      suggestedActions: ["general_response"],
    };
  }

  private getSuggestedActions(intentType: IntentKey): string[] {
    const actions: Record<IntentKey, string[]> = {
      requirement: ["extract_specs", "validate_constraints", "check_conflicts"],
      question: ["provide_info", "suggest_options"],
      clarification: ["ask_followup", "suggest_autofill"],
      other: ["general_response"],
    };
    return actions[intentType] || ["general_response"];
  }

  // ============= TECHNICAL EXTRACTION =============

  private async extractTechnicalRequirements(
    message: string,
    _context?: SemanticMatchingContext,
  ): Promise<TechnicalExtraction[]> {
    // For MVP: Pattern-based extraction with confidence scoring
    const extractions: TechnicalExtraction[] = [];

    // Processor extraction
    const processorMatch = message.match(
      /(intel|amd)[\s-]*(core|ryzen)?[\s-]*(i[3579]|[0-9]+)?|fast\s*cpu/i,
    );
    if (processorMatch) {
      extractions.push({
        category: "processor",
        value: processorMatch[0],
        context: message,
        confidence: processorMatch[0].toLowerCase().includes("fast")
          ? 0.6
          : 0.9,
        ucCandidates: [], // Will be populated in mapping step
      });
    }

    // Memory extraction
    const memoryMatch = message.match(
      /(\d+)\s*(gb|mb)\s*(?:ram|memory)?|(?:lots of|more)\s*(?:ram|memory)/i,
    );
    if (memoryMatch) {
      let value = memoryMatch[0];
      if (memoryMatch[1] && memoryMatch[2]) {
        value = `${memoryMatch[1]}${memoryMatch[2].toUpperCase()}`;
      }
      extractions.push({
        category: "memory",
        value: value,
        context: message,
        confidence: memoryMatch[1] ? 0.85 : 0.6, // Lower confidence for vague terms
        ucCandidates: [],
      });
    }

    // Power extraction
    const powerMatch = message.match(
      /(under \d+w|<?\s*\d+w|low power|high performance|battery\s*optimized?)/i,
    );
    if (powerMatch) {
      extractions.push({
        category: "power",
        value: powerMatch[0],
        context: message,
        confidence: 0.8,
        ucCandidates: [],
      });
    }

    // Storage extraction
    const storageMatch = message.match(
      /(\d+\s*(?:gb|tb)|ssd|hdd|fast\s*storage|solid\s*state)/i,
    );
    if (storageMatch) {
      extractions.push({
        category: "storage",
        value: storageMatch[0],
        context: message,
        confidence: 0.8,
        ucCandidates: [],
      });
    }

    // Performance extraction
    const performanceMatch = message.match(
      /(high performance|fast|low latency|quick|responsive)/i,
    );
    if (performanceMatch) {
      extractions.push({
        category: "performance",
        value: performanceMatch[0],
        context: message,
        confidence: 0.6,
        ucCandidates: [],
      });
    }

    // TODO: Add LLM-based extraction for complex requirements

    return extractions;
  }

  // ============= UC MAPPING =============

  private async mapToUCSpecifications(
    extractions: TechnicalExtraction[],
  ): Promise<TechnicalExtraction[]> {
    const mappedExtractions = [...extractions];

    for (const extraction of mappedExtractions) {
      extraction.ucCandidates = await this.findUCCandidates(extraction);
    }

    return mappedExtractions;
  }

  private async findUCCandidates(
    extraction: TechnicalExtraction,
  ): Promise<UCCandidate[]> {
    const candidates: UCCandidate[] = [];

    // TODO zeev refactor this logic - seems to be uc1 related
    // Category-based mapping: processor→spc001, memory→spc002, power→spc036
    const categoryMap: { [key: string]: string[] } = {
      processor: ["spc001"], // processorType
      memory: ["spc002", "spc044"], // memoryCapacity, memoryType
      power: ["spc036"], // maxPowerConsumption
      storage: ["spc003", "spc004"], // storageType, storageCapacity
      performance: ["spc005"], // responseLatency
    };

    const candidateIds = categoryMap[extraction.category] || [];

    for (const specId of candidateIds) {
      const spec = ucDataLayer.getSpecification(specId);
      if (spec) {
        candidates.push({
          specId,
          specName: spec.name,
          matchReason: `Category match: ${extraction.category}`,
          confidence: 0.8, // Base confidence for category match
          ucSpec: spec,
        });
      }
    }

    return candidates;
  }

  // ============= CONFIDENCE SCORING =============

  private calculateOverallConfidence(
    extractions: TechnicalExtraction[],
    intent: MessageIntent,
  ): number {
    if (extractions.length === 0) return 0.0;

    // Average extraction confidence
    const avgExtractionConfidence =
      extractions.reduce((sum, ext) => sum + ext.confidence, 0) /
      extractions.length;

    // Intent confidence boost
    const intentBoost = intent.type === "requirement" ? 0.1 : 0.0;

    // UC mapping confidence
    const mappingConfidence =
      extractions.reduce((sum, ext) => {
        const bestCandidate = ext.ucCandidates.reduce(
          (best, candidate) =>
            candidate.confidence > best.confidence ? candidate : best,
          { confidence: 0 },
        );
        return sum + bestCandidate.confidence;
      }, 0) / extractions.length;

    return Math.min(
      0.95,
      avgExtractionConfidence * 0.4 +
        mappingConfidence * 0.4 +
        intentBoost * 0.2,
    );
  }

  // ============= UTILITY METHODS =============

  private buildIntentDetectionPrompt(
    message: string,
    _context?: SemanticMatchingContext,
  ): string {
    // TODO: Build sophisticated prompts for LLM intent detection
    return `Analyze this message for technical requirements: "${message}"`;
  }

  getStats(): { artifactIntegration: boolean } {
    return {
      artifactIntegration: !!this.artifactManager,
    };
  }
}

// Export singleton for easy use
export const createSemanticMatcher = (): SemanticMatcher => {
  return new SemanticMatcher();
};

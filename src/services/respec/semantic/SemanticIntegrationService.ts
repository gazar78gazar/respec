/**
 * SemanticIntegrationService - Bridge between SemanticMatcher and existing chat system
 *
 * This service:
 * 1. Plugs into the existing SimplifiedRespecService chat flow
 * 2. Processes messages through SemanticMatcher
 * 3. Converts semantic extractions to EnhancedFormUpdate format
 * 4. Maintains backward compatibility with existing chat interface
 * 5. Provides enhanced responses with confidence information
 */

import { SemanticMatcher, SemanticExtractionResult, TechnicalExtraction } from './SemanticMatcher';
import { EnhancedFormUpdate, ChatResult } from '../SimplifiedRespecService';
import { CompatibilityLayer } from '../artifacts/CompatibilityLayer';

// ============= INTEGRATION TYPES =============

export interface EnhancedChatResult extends ChatResult {
  semanticAnalysis?: SemanticExtractionResult;
  extractionSummary?: string;
  conflictsDetected?: any[];
  nextSuggestions?: string[];
}

export interface SemanticProcessingOptions {
  enableArtifactIntegration: boolean;
  enableConflictDetection: boolean;
  confidenceThreshold: number;
  includeDebugInfo: boolean;
}

// ============= MAIN INTEGRATION SERVICE =============

export class SemanticIntegrationService {
  private semanticMatcher: SemanticMatcher;
  private compatibilityLayer: CompatibilityLayer | null = null;
  private processingOptions: SemanticProcessingOptions;

  constructor(
    semanticMatcher: SemanticMatcher,
    compatibilityLayer?: CompatibilityLayer
  ) {
    this.semanticMatcher = semanticMatcher;
    this.compatibilityLayer = compatibilityLayer || null;

    // Default processing options
    this.processingOptions = {
      enableArtifactIntegration: true,
      enableConflictDetection: true,
      confidenceThreshold: 0.7,
      includeDebugInfo: false
    };
  }

  // ============= MAIN PROCESSING METHOD =============

  async processMessage(
    message: string,
    currentRequirements: any,
    chatHistory?: any[]
  ): Promise<EnhancedChatResult> {

    try {
      console.log('[SemanticIntegration] Processing message:', message);

      // Step 1: Semantic Analysis
      const semanticResult = await this.semanticMatcher.parseMessage(message, {
        currentRequirements,
        chatHistory: chatHistory || []
      });

      // Step 2: Convert to Form Updates
      const formUpdates = await this.convertToFormUpdates(semanticResult);

      // Step 3: Generate Response
      const systemMessage = this.generateSystemResponse(semanticResult, formUpdates);

      // Step 4: Apply to Artifacts (if enabled)
      if (this.processingOptions.enableArtifactIntegration && semanticResult.hasRequirements) {
        await this.semanticMatcher.applyExtractionsToArtifacts(semanticResult.extractions);
      }

      // Step 5: Check for Conflicts (if enabled)
      let conflictsDetected: any[] = [];
      if (this.processingOptions.enableConflictDetection && formUpdates.length > 0) {
        // TODO: Integrate with ArtifactManager conflict detection
        // conflictsDetected = await this.checkForConflicts(formUpdates);
      }

      // Step 6: Build Enhanced Response
      const result: EnhancedChatResult = {
        success: true,
        systemMessage,
        formUpdates,
        confidence: semanticResult.confidence,
        semanticAnalysis: this.processingOptions.includeDebugInfo ? semanticResult : undefined,
        extractionSummary: this.buildExtractionSummary(semanticResult),
        conflictsDetected,
        nextSuggestions: this.generateNextSuggestions(semanticResult)
      };

      console.log(`[SemanticIntegration] Processed message in ${semanticResult.processingTime}ms, found ${formUpdates.length} updates`);
      return result;

    } catch (error) {
      console.error('[SemanticIntegration] Processing failed:', error);
      return {
        success: false,
        systemMessage: "I encountered an error processing your message. Could you please rephrase your request?",
        confidence: 0.0
      };
    }
  }

  // ============= CONVERSION METHODS =============

  private async convertToFormUpdates(
    semanticResult: SemanticExtractionResult
  ): Promise<EnhancedFormUpdate[]> {

    const formUpdates: EnhancedFormUpdate[] = [];

    if (!semanticResult.hasRequirements) {
      return formUpdates;
    }

    for (const extraction of semanticResult.extractions) {
      // Find the best UC1 candidate
      const bestCandidate = extraction.uc1Candidates.reduce((best, candidate) =>
        candidate.confidence > best.confidence ? candidate : best,
        { confidence: 0, specId: '', uc1Spec: null as any }
      );

      if (bestCandidate.confidence >= this.processingOptions.confidenceThreshold) {
        // Map UC1 spec to form field
        const fieldMapping = this.compatibilityLayer?.getFieldFromSpecId(bestCandidate.specId);

        if (fieldMapping) {
          formUpdates.push({
            section: fieldMapping.section,
            field: fieldMapping.field,
            value: extraction.value,
            isAssumption: false, // LLM extractions are treated as user requirements
            confidence: extraction.confidence,
            originalRequest: extraction.context,
            substitutionNote: bestCandidate.confidence < 0.9 ?
              `Interpreted "${extraction.value}" from your message` : undefined
          });
        }
      }
    }

    return formUpdates;
  }

  // ============= RESPONSE GENERATION =============

  private generateSystemResponse(
    semanticResult: SemanticExtractionResult,
    formUpdates: EnhancedFormUpdate[]
  ): string {

    if (!semanticResult.hasRequirements) {
      return this.generateNonRequirementResponse(semanticResult);
    }

    if (formUpdates.length === 0) {
      return "I understood you're discussing technical requirements, but I couldn't extract specific values to fill in the form. Could you provide more specific details?";
    }

    // Build response based on what was extracted
    const extractedItems = formUpdates.map(update =>
      `${this.humanizeFieldName(update.field)}: ${update.value}`
    ).join(', ');

    let response = `I've extracted the following requirements: ${extractedItems}.`;

    // Add confidence information
    const avgConfidence = formUpdates.reduce((sum, update) => sum + update.confidence, 0) / formUpdates.length;
    if (avgConfidence < 0.8) {
      response += " Please review these values to make sure they're correct.";
    }

    // Add next steps
    if (formUpdates.length === 1) {
      response += " Is there anything else you'd like to specify?";
    } else {
      response += " I've updated the form accordingly.";
    }

    return response;
  }

  private generateNonRequirementResponse(semanticResult: SemanticExtractionResult): string {
    switch (semanticResult.intent.type) {
      case 'question':
        return "I'm here to help you specify your technical requirements. What would you like to know?";
      case 'clarification':
        return "I understand you need some clarification. Feel free to ask about any of the requirements fields, or I can help autofill sections if you're not sure.";
      default:
        return "I'm ready to help you fill out your technical requirements. You can describe what you need in natural language, and I'll extract the relevant specifications.";
    }
  }

  // ============= UTILITY METHODS =============

  private buildExtractionSummary(semanticResult: SemanticExtractionResult): string {
    if (!semanticResult.hasRequirements) {
      return `Intent: ${semanticResult.intent.type}`;
    }

    const extractionCount = semanticResult.extractions.length;
    const avgConfidence = semanticResult.extractions.reduce(
      (sum, ext) => sum + ext.confidence, 0
    ) / extractionCount;

    return `Found ${extractionCount} requirement(s) with ${(avgConfidence * 100).toFixed(0)}% confidence`;
  }

  private generateNextSuggestions(semanticResult: SemanticExtractionResult): string[] {
    const suggestions: string[] = [];

    if (!semanticResult.hasRequirements) {
      suggestions.push("Try describing what kind of system you need");
      suggestions.push("Mention specific hardware requirements");
      return suggestions;
    }

    // Suggest related fields based on what was extracted
    const extractedCategories = semanticResult.extractions.map(ext => ext.category);

    if (extractedCategories.includes('processor') && !extractedCategories.includes('memory')) {
      suggestions.push("Consider specifying memory requirements");
    }

    if (extractedCategories.includes('performance') && !extractedCategories.includes('power')) {
      suggestions.push("Think about power consumption constraints");
    }

    if (suggestions.length === 0) {
      suggestions.push("You can continue adding more requirements");
    }

    return suggestions;
  }

  private humanizeFieldName(fieldName: string): string {
    const humanNames = {
      'processor_type': 'Processor',
      'memory_capacity': 'Memory',
      'storage_capacity': 'Storage',
      'max_power_consumption': 'Power Consumption',
      'operating_temperature': 'Operating Temperature',
      'response_latency': 'Response Time'
    };
    return humanNames[fieldName] || fieldName.replace(/_/g, ' ');
  }

  // ============= CONFIGURATION =============

  updateProcessingOptions(options: Partial<SemanticProcessingOptions>): void {
    this.processingOptions = { ...this.processingOptions, ...options };
    console.log('[SemanticIntegration] Updated processing options:', this.processingOptions);
  }

  // ============= STATUS =============

  isReady(): boolean {
    return this.semanticMatcher.isReady();
  }

  getStatus(): any {
    return {
      semanticMatcher: this.semanticMatcher.isReady(),
      compatibilityLayer: !!this.compatibilityLayer,
      processingOptions: this.processingOptions,
      stats: this.semanticMatcher.getStats()
    };
  }
}

// Export convenience creator
export const createSemanticIntegrationService = (
  semanticMatcher: SemanticMatcher,
  compatibilityLayer?: CompatibilityLayer
): SemanticIntegrationService => {
  return new SemanticIntegrationService(semanticMatcher, compatibilityLayer);
};
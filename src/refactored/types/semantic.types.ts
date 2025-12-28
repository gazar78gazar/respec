/**
 * SemanticTypes - Shared semantic extraction, matching, and integration types.
 */

import type { UCSpecification, UCUIField } from "./uc-data.types";
import type { ChatResult, EntryResolutionOption, Maybe } from "./service.types";

export interface AnthropicRequirement {
  section: string;
  field: string;
  value: string;
  confidence: number;
  isAssumption: boolean;
  originalRequest?: string;
  substitutionNote?: string;
}

export interface AnthropicAnalysisResult {
  requirements: AnthropicRequirement[];
  response: string;
  clarificationNeeded?: string;
}

export interface AnthropicAnalysisContext {
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: Date | string;
  }>;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ConflictResponseParseResult {
  isResolution: boolean;
  choice: Maybe<"a" | "b">;
  confidence: number;
  rawResponse: string;
  reasoning?: string;
}

export interface ConflictResolutionOutcome {
  response: string;
  mode: string;
  conflictId?: string;
  chosenOption?: EntryResolutionOption;
  cycleCount?: number;
}

export interface FieldDefinitionInput {
  type: string;
  options?: string[];
  min?: number;
  max?: number;
  validation?: string;
  label?: string;
  group?: string;
}

export type FieldDefinitions = Record<
  string,
  Record<string, FieldDefinitionInput>
>;

export interface ExtractedNode {
  text: string;
  category?: string;
  value?: unknown;
  context?: string;
}

export interface UCMatch {
  id: string;
  name: string;
  type: "scenario" | "requirement" | "specification";
  confidence: number;
  matchType: "exact" | "fuzzy" | "semantic";
  rationale?: string;
}

export interface MatchResult {
  extractedNode: ExtractedNode;
  ucMatch: UCMatch;
  value?: unknown;
  extractedText: string;
}

export interface UCSchemaContext {
  scenarios: Array<{ id: string; name: string; description: string }>;
  requirements: Array<{
    id: string;
    name: string;
    description: string;
    parent_scenarios?: string[];
  }>;
  specifications: Array<{
    id: string;
    name: string;
    description: string;
    parent_requirements?: string[];
    options?: string[];
    form_mapping?: UCUIField;
  }>;
}

export interface EnhancedChatResult extends ChatResult {
  matchResults?: MatchResult[];
  extractionSummary?: string;
  conflictsDetected?: unknown[];
  nextSuggestions?: string[];
}

export interface SemanticProcessingOptions {
  confidenceThreshold: number;
  includeDebugInfo: boolean;
}

export interface SemanticExtractionResult {
  hasRequirements: boolean;
  extractions: TechnicalExtraction[];
  intent: MessageIntent;
  confidence: number;
  processingTime: number;
}

export interface TechnicalExtraction {
  category: string;
  value: string;
  constraint?: string;
  context: string;
  confidence: number;
  ucCandidates: UCCandidate[];
}

export interface UCCandidate {
  specId: string;
  specName: string;
  matchReason: string;
  confidence: number;
  ucSpec: UCSpecification;
}

export interface MessageIntent {
  type: "requirement" | "question" | "clarification" | "other";
  subtype?: "specification" | "constraint" | "preference" | "comparison";
  requiresResponse: boolean;
  suggestedActions: string[];
}

export type IntentKey = "requirement" | "question" | "clarification" | "other";

export interface SemanticMatchingContext {
  currentRequirements?: Record<string, unknown>;
  artifactState?: unknown;
  chatHistory: Array<{ role?: string; content?: string }>;
  userPreferences?: Record<string, unknown>;
}

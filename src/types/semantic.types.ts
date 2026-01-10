/**
 * SemanticTypes - Shared types for LLM extraction and conflict handling.
 */

import type {
  EntryResolutionOption,
  Maybe,
  RequirementField,
  SessionMessage,
} from "./service.types";

export interface AgentRequirement extends RequirementField {
  confidence: number;
  isAssumption: boolean;
  originalRequest?: string;
  substitutionNote?: string;
}

export interface AgentAnalysisResult {
  requirements: AgentRequirement[];
  response: string;
  clarificationNeeded?: string;
}

export interface AgentAnalysisContext {
  conversationHistory?: SessionMessage[];
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

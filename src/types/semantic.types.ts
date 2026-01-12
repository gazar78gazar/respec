/**
 * SemanticTypes - Shared types for LLM extraction and conflict handling.
 */

import type {
  EntryResolutionOption,
  Maybe,
  RequirementField,
  SessionMessage,
} from "./service.types";

export type AgentRequirement = RequirementField & {
  confidence: number;
  isAssumption: boolean;
  originalRequest?: string;
  substitutionNote?: string;
};

export type AgentAnalysisResult = {
  requirements: AgentRequirement[];
  response: string;
  clarificationNeeded?: string;
};

export type AgentAnalysisContext = {
  conversationHistory?: SessionMessage[];
  [key: string]: unknown;
};

export type ConflictResponseParseResult = {
  isResolution: boolean;
  choice: Maybe<"a" | "b">;
  confidence: number;
  rawResponse: string;
  reasoning?: string;
};

export type ConflictResolutionOutcome = {
  response: string;
  mode: string;
  conflictId?: string;
  chosenOption?: EntryResolutionOption;
  cycleCount?: number;
};

export type FieldDefinitionInput = {
  type: string;
  options?: string[];
  min?: number;
  max?: number;
  validation?: string;
  label?: string;
  group?: string;
};

export type FieldDefinitions = Record<
  string,
  Record<string, FieldDefinitionInput>
>;

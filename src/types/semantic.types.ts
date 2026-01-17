/**
 * SemanticTypes - Shared types for LLM extraction and conflict handling.
 */

import type {
  EntryResolutionOption,
  BaseFieldValue,
  Maybe,
  RequirementField,
  SessionMessage,
  AutofillMode,
} from "./service.types";
import type { RespecArtifact } from "./artifacts.types";

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

export type AutofillAgentContext = {
  lastUserMessage: string;
  conversationHistory?: SessionMessage[];
  respecArtifact?: RespecArtifact;
  currentSelections: Record<string, Maybe<BaseFieldValue>>;
  remainingSpecs: Record<string, string[]>;
  missingKeyFields: string[];
  section?: string;
};

export type AutofillAgentSelection = {
  field: string;
  value: string;
};

export type AutofillAgentResult = {
  mode: AutofillMode;
  message: string;
  selections: AutofillAgentSelection[];
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

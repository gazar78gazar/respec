/**
 * service.types - Shared service-level types used across refactored services.
 */

import type { UCArtifactSpecification } from "./artifacts.types";

export type Maybe<T> = T | null;

export type BaseFieldValue = string | number | boolean | string[];

export type RequirementField = {
  section: string;
  field: string;
  value: Maybe<BaseFieldValue> | undefined;
};

export type FormUpdate = RequirementField & {
  isAssumption: boolean;
  confidence: number;
};

export type SessionMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type EnhancedFormUpdate = FormUpdate & {
  originalRequest?: string;
  substitutionNote?: string;
};

export type ChatResult = {
  success: boolean;
  systemMessage: string;
  formUpdates?: EnhancedFormUpdate[];
  clarificationNeeded?: string;
  confidence: number;
  conflictData?: unknown;
};

export type FormProcessingResult = {
  acknowledged: boolean;
  acknowledgment?: string;
  formUpdates?: EnhancedFormUpdate[];
  suggestions?: FormUpdate[];
};

export type AutofillMode = "questions" | "selections" | "empty";

export type AutofillResult = {
  message: string;
  fields: FormUpdate[];
  section: string;
  mode: AutofillMode;
};

export type EntryResolutionOption = {
  id: string;
  label: string;
  outcome: string;
};

export type StrucureConflictEntry = {
  id: string;
  type: string;
  description: string;
  affectedNodes: unknown;
  resolutionOptions: EntryResolutionOption[];
  cycleCount: number;
  priority: "critical" | "high";
};

export type StructuredConflicts = {
  hasConflicts: boolean;
  count: number;
  currentConflict: number;
  totalConflicts: number;
  systemBlocked: boolean;
  conflicts: StrucureConflictEntry[];
};

export type ArtifactLocation = "mapped" | "respec";

export type LocatedSpecification = {
  artifact: ArtifactLocation;
  spec: UCArtifactSpecification;
};

export type ConflictResolutionPlan = {
  winningSpecs: string[];
  losingSpecs: string[];
  removals: LocatedSpecification[];
};

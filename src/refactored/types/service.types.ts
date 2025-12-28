/**
 * ServiceTypes - Shared service-level types used across refactored services.
 */

import type { UCArtifactSpecification } from "./artifacts.types";

export interface FormUpdate {
  section: string;
  field: string;
  value: unknown;
  isAssumption: boolean;
  confidence: number;
}

export type Maybe<T> = T | null;

export interface EnhancedFormUpdate extends FormUpdate {
  originalRequest?: string;
  substitutionNote?: string;
}

export interface ChatResult {
  success: boolean;
  systemMessage: string;
  formUpdates?: EnhancedFormUpdate[];
  clarificationNeeded?: string;
  confidence: number;
  conflictData?: unknown;
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

export interface StructuredConflicts {
  hasConflicts: boolean;
  count: number;
  currentConflict: number;
  totalConflicts: number;
  systemBlocked: boolean;
  conflicts: StrucureConflictEntry[];
}

export type ArtifactLocation = "mapped" | "respec";

export interface LocatedSpecification {
  artifact: ArtifactLocation;
  spec: UCArtifactSpecification;
}

export interface ConflictResolutionPlan {
  winningSpecs: string[];
  losingSpecs: string[];
  removals: LocatedSpecification[];
}

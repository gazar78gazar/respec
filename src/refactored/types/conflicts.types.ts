/**
 * Conflict types for UC8 resolution flows.
 */

// ============= CONFLICT TYPES (EXTENDED) =============

export type ConflictType =
  | "field_overwrite" // Need to change existing value
  | "exclusion" // Direct exclusion between specs
  | "cascade" // Dependencies cause overwrites
  | "field_constraint"; // Field has zero valid options

interface GenericConflict {
  id: string;
  key: string;
  description: string;
  resolution?: string;
  cycleCount?: number;
  affectedNodes: string[];
  firstDetected?: Date;
  lastUpdated?: Date;
}

export interface OverwriteConflict extends GenericConflict {
  type: "field_overwrite";
  field: string;
  existingValue: string;
  proposedValue: string;
  resolutionOptions?: OverwriteResolutionOption[];
}

export interface ExclusionConflict extends GenericConflict {
  type: "exclusion";
  exclusionId: string;
  existingValue: string;
  proposedValue: string;
  resolutionOptions?: ExclusionResolutionOption[];
}

export interface CascadeConflict extends GenericConflict {
  type: "cascade";
  proposedValue: string;
  resolutionOptions?: CascadeResolutionOption[];
}

export interface ConstraintConflict extends GenericConflict {
  type: "field_constraint";
  field: string;
  proposedValue: string;
  resolutionOptions?: ConstraintResolutionOption[];
}

export type Conflict =
  | OverwriteConflict
  | ExclusionConflict
  | CascadeConflict
  | ConstraintConflict;

interface GenericResolutionOption {
  id: string;
  description: string;
  targetNodes: string[];
  expectedOutcome: string;
}

export interface ExclusionResolutionOption extends GenericResolutionOption {
  action: "select_option_a" | "select_option_b" | "custom_value" | "defer"; // TODO zonflict do we need custom value and "defer"?
}

export interface OverwriteResolutionOption extends GenericResolutionOption {
  // action: "accept" | "modify";
  action: "keep_existing" | "apply_new";
}

export interface CascadeResolutionOption extends GenericResolutionOption {
  action: "keep_existing" | "apply_new";
}

export interface ConstraintResolutionOption extends GenericResolutionOption {
  action: "keep_existing" | "apply_new";
}

export type ResolutionOption =
  | ExclusionResolutionOption
  | OverwriteResolutionOption
  | CascadeResolutionOption
  | ConstraintResolutionOption;

export interface ConflictResolution {
  // Unused in refactored flow; resolution history is not wired to UI.
  conflictId: string;
  action: "keep_existing" | "apply_new";
  nodeToRemove?: string;
  nodeToAdd?: string;
  userChoice: string;
  timestamp: Date;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

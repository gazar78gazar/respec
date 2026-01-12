/**
 * Conflict types for UC8 resolution flows.
 */

// ============= CONFLICT TYPES (EXTENDED) =============

export type ConflictType =
  // | "field_overwrite" // Need to change existing value
  | "exclusion" // Direct exclusion between specs
  | "cascade" // Dependencies cause overwrites
  | "field_constraint"; // Field has zero valid options

type GenericConflict = {
  id: string;
  key: string;
  description: string;
  resolution?: string;
  cycleCount?: number;
  affectedNodes: string[];
  firstDetected?: Date;
  lastUpdated?: Date;
};

// export interface OverwriteConflict extends GenericConflict {
//   type: "field_overwrite";
//   field: string;
//   existingValue: string;
//   proposedValue: string;
//   resolutionOptions?: OverwriteResolutionOption[];
// }

export type ExclusionConflict = GenericConflict & {
  type: "exclusion";
  exclusionId: string;
  existingValue: string;
  proposedValue: string;
  resolutionOptions?: ExclusionResolutionOption[];
};

export type CascadeConflict = GenericConflict & {
  type: "cascade";
  proposedValue: string;
  resolutionOptions?: CascadeResolutionOption[];
};

export type ConstraintConflict = GenericConflict & {
  type: "field_constraint";
  field: string;
  proposedValue: string;
  resolutionOptions?: ConstraintResolutionOption[];
};

export type Conflict =
  // | OverwriteConflict
  ExclusionConflict | CascadeConflict | ConstraintConflict;

type GenericResolutionOption = {
  id: string;
  description: string;
  targetNodes: string[];
  expectedOutcome: string;
};

export type ExclusionResolutionOption = GenericResolutionOption & {
  action: "select_option_a" | "select_option_b";
};

export type OverwriteResolutionOption = GenericResolutionOption & {
  action: "keep_existing" | "apply_new";
};

export type CascadeResolutionOption = GenericResolutionOption & {
  action: "keep_existing" | "apply_new";
};

export type ConstraintResolutionOption = GenericResolutionOption & {
  action: "keep_existing" | "apply_new";
};

export type ResolutionOption =
  | ExclusionResolutionOption
  | OverwriteResolutionOption
  | CascadeResolutionOption
  | ConstraintResolutionOption;

export type ConflictResolution = {
  // Unused in refactored flow; resolution history is not wired to UI.
  conflictId: string;
  action: "keep_existing" | "apply_new";
  nodeToRemove?: string;
  nodeToAdd?: string;
  userChoice: string;
  timestamp: Date;
};

export type ConflictResult = {
  hasConflict: boolean;
  conflicts: Conflict[];
};

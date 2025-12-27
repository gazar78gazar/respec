/**
 * TypeScript interfaces for UC v8.0 dataset
 */

export interface UCMetadata {
  schema_version: string;
  dataset_version: string;
  description: string;
  created_at: string;
  updated_at: string;
  id_format: {
    scenarios: string;
    requirements: string;
    specifications: string;
    comments: string;
    exclusions: string;
  };
}

export interface UCScenario {
  id: string;
  type: "scenario";
  name: string;
  description: string;
  use_case_tags: string[];
  requirement_ids: string[];
  metadata?: {
    implementation_percentage?: string;
    typical_application?: string;
  };
}

export interface UCRequirement {
  id: string;
  type: "requirement";
  name: string;
  description: string;
  parent_scenarios: string[];
  specification_ids: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface UCSpecification {
  id: string;
  type: "specification";
  name: string;
  parent_requirements: string[];
  field_name: string;
  requires?: UCSpecificationDependency;
  description?: string;
  technical_details?: Record<string, unknown>;
  selected_value?: string; // TODO zeev to be removed when all the ui is defined by the dataset
}

type UCUIType = "dropdown" | "multi_select";
type UCSelectionType = "single_choice" | "multi_choice";

export interface UCUIField {
  section: string;
  category: string;
  field_name: string;
  ui_type: UCUIType;
  selection_type: UCSelectionType;
  options: string[];
}

export type Maybe<T> = T | null;

export interface UCSpecificationDependency {
  [category: string]: string[]; // OR within category, AND across
}

export interface UCComment {
  id: string;
  type: "comment";
  name: string;
  parent_requirements: string[];
  parent_scenarios: string[];
  content: string;
  technical_context?: Record<string, unknown>;
}

export interface UCExclusion {
  id: string;
  nodes: [string, string]; // Pair-wise exclusion
  type:
    | "hard_incompatible"
    | "performance_mismatch"
    | "performance_warning"
    | "efficiency_warning";
  category: "spec_spec" | "req_req" | "scenario_scenario" | "scenario_spec";
  reason: string;
  resolution_priority: 1 | 2 | 3 | 4; // 1 = highest (blocks form)
  question_template: string;
}

export interface UCDataset {
  metadata: UCMetadata;
  scenarios: Record<string, UCScenario>;
  requirements: Record<string, UCRequirement>;
  specifications: Record<string, UCSpecification>;
  comments: Record<string, UCComment>;
  exclusions: Record<string, UCExclusion>;
  ui_fields: Record<string, UCUIField>;
}

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
  conflictId: string;
  action: "keep_existing" | "apply_new" | "manual_override";
  nodeToRemove?: string;
  nodeToAdd?: string;
  userChoice: string;
  timestamp: Date;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

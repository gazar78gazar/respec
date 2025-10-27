/**
 * TypeScript interfaces for UC v8.0 dataset
 */

export interface UCMetadata {
  schema_version: string;
  dataset_version: string;
  description: string;
  created_at: string;
  updated_at: string;
  coverage: string;
  uno_compatible: boolean;
  changes: string[];
  id_format: {
    scenarios: string;
    requirements: string;
    specifications: string;
    comments: string;
    exclusions: string;
  };
  skipped_ids?: {
    specifications?: string[];
    note?: string;
  };
}

export interface UCScenario {
  id: string;
  type: "scenario";
  name: string;
  description: string;
  use_case_tags: string[];
  requirement_ids: string[];
  conflicts_with?: string[];
  conflict_reason?: string;
  compatible_scenarios?: string[];
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
  form_field: string;
  allows_conflicts?: boolean;
  category?: string;
  metadata?: any;
}

export interface UCSpecification {
  id: string;
  type: "specification";
  name: string;
  parent_requirements: string[];
  form_mapping: {
    section: string;
    category: string;
    field_name: string;
    ui_type: string;
    selected_value: string;
  };
  requires?: {
    [category: string]: string[]; // OR within category, AND across
  };
  description?: string;
  options?: string[];
  selection_type?: string;
  technical_details?: any;
}

export interface UCComment {
  id: string;
  type: "comment";
  name: string;
  parent_requirements: string[];
  parent_scenarios: string[];
  content: string;
  technical_context?: any;
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
  id_mapping: {
    scenarios: Record<string, string>;
    requirements?: Record<string, string>;
    specifications?: Record<string, string>;
  };
  scenarios: Record<string, UCScenario>;
  requirements: Record<string, UCRequirement>;
  specifications: Record<string, UCSpecification>;
  comments: Record<string, UCComment>;
  exclusions: Record<string, UCExclusion>;
  validation?: any;
}

// ============= CONFLICT TYPES (EXTENDED) =============

export enum ConflictType {
  FIELD_OVERWRITE = "field_overwrite", // Need to change existing value
  EXCLUSION = "exclusion", // Direct exclusion between specs
  CASCADE = "cascade", // Dependencies cause overwrites
  FIELD_CONSTRAINT = "field_constraint", // Field has zero valid options
}

export interface Conflict {
  id?: string;
  type: ConflictType;
  conflictingNodes: string[];
  description: string;
  resolution?: string;
  resolutionOptions?: ResolutionOption[];
  cycleCount?: number;
  firstDetected?: Date;
  lastUpdated?: Date;
}

export interface ResolutionOption {
  id: string;
  description: string;
  action: string;
  targetNodes: string[];
  expectedOutcome: string;
}

export interface ConflictResolution {
  conflictId: string;
  action: "keep_existing" | "apply_new" | "manual_override";
  nodeToRemove?: string;
  nodeToAdd?: string;
  userChoice: string;
  timestamp: Date;
}

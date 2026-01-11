/**
 * TypeScript interfaces for UC v8.0 dataset
 */

export type UCMetadata = {
  schema_version: string;
  dataset_version: string;
  description: string;
  created_at: string;
  updated_at: string;
  id_format: {
    specifications: string;
    comments: string;
    exclusions: string;
  };
};

export type UCSpecification = {
  id: string;
  type: "specification";
  name: string;
  field_name: string;
  requires?: UCSpecificationDependency;
  description?: string;
  technical_details?: Record<string, unknown>;
  selected_value?: string; // TODO zeev to be removed when all the ui is defined by the dataset
};

type UCUIType = "dropdown" | "multi_select";
export type UCSelectionType = "single_choice" | "multi_choice";

export type UCUIField = {
  section: string;
  category: string;
  field_name: string;
  ui_type: UCUIType;
  selection_type: UCSelectionType;
  options: string[];
};

export type UCSpecificationDependency = {
  [category: string]: string[]; // OR within category, AND across
};

export type UCComment = {
  id: string;
  type: "comment";
  name: string;
  content: string;
  technical_context?: Record<string, unknown>;
};

export type UCExclusion = {
  id: string;
  nodes: [string, string]; // Pair-wise exclusion
  type:
    | "hard_incompatible"
    | "performance_mismatch"
    | "performance_warning"
    | "efficiency_warning";
  reason: string;
  resolution_priority: 1 | 2 | 3 | 4; // 1 = highest (blocks form)
  question_template: string;
};

export type UCDataset = {
  metadata: UCMetadata;
  specifications: Record<string, UCSpecification>;
  comments: Record<string, UCComment>;
  exclusions: Record<string, UCExclusion>;
  ui_fields: Record<string, UCUIField>;
};

export type UCNode = UCSpecification | UCComment;

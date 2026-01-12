/**
 * respec.types - Types specific to RespecService workflows.
 */

import type { AgentRequirement, FieldDefinitionInput } from "./semantic.types";
import type { Maybe } from "./service.types";
import type { UCSpecification } from "./uc-data.types";

export type FieldMapping = {
  section: string;
  field: string;
};

export type FieldOptionsEntry = {
  type: FieldDefinitionInput["type"];
  options?: string[];
  min?: number;
  max?: number;
  validation?: string;
  label?: string;
};

export type FieldOptionsMap = {
  [section: string]: {
    [field: string]: FieldOptionsEntry;
  };
};

export type RespecFieldSnapshotEntry = {
  specId: string;
  value: Maybe<string | number | boolean | string[]>;
  isAssumption: boolean;
  confidence: number;
  originalRequest?: string;
  substitutionNote?: string;
};

export type RespecFieldSnapshot = Map<string, RespecFieldSnapshotEntry>;

export type RespecFormUpdateOptions = {
  source?: "user" | "system";
  skipAcknowledgment?: boolean;
  isAssumption?: boolean;
};

export type RespecMatchSelection = {
  spec: UCSpecification;
  selection: unknown;
};

export type RespecSelectionMatch = {
  spec: AgentRequirement;
  match: UCSpecification;
  selection: unknown;
};

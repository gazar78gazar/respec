/**
 * ArtifactTypes - Core type definitions for multi-artifact state management
 *
 * Implements the four-artifact system from PRD specifications:
 * 1. Respec Artifact: Validated, coherent specifications
 * 2. Mapped Artifact: LLM-matched, pending validation
 * 3. Unmapped List: Unrecognized data nodes
 * 4. Conflict List: Isolated conflicting nodes
 */

import type { UCSpecification } from "./uc-data.types";
import type { ConflictType, ResolutionOption } from "./conflicts.types";

// ============= BASE INTERFACES =============

export type BaseArtifact = {
  id: string;
  timestamp: Date;
  version: string;
  metadata: ArtifactMetadata;
};

export type ArtifactMetadata = {
  totalNodes: number;
  lastModified: Date;
  source: Source;
  validationStatus: "valid" | "pending" | "invalid" | "conflicts";
};

export type Source =
  | "user"
  | "llm"
  | "system"
  | "migration"
  | "autofill"
  | "conflict_resolution"
  | "dependency";

// ============= SPECIFICATION STORAGE =============

export type SpecificationId = string;

export type SpecificationStore = {
  [specId: SpecificationId]: UCArtifactSpecification;
};

export type UCArtifactSpecification = {
  id: SpecificationId;
  name: string;
  value: unknown;
  ucSource: UCSpecification;
  attribution: "requirement" | "assumption";
  confidence: number;
  source: Source;
  originalRequest?: string;
  substitutionNote?: string;
  timestamp: Date;
  dependencyOf?: SpecificationId;
};

export type DependencyContext = {
  visited: Set<SpecificationId>;
  parentSpecId: SpecificationId;
  depth: number;
};

// ============= RESPEC ARTIFACT =============

export type RespecArtifact = BaseArtifact & {
  type: "respec";
  specifications: SpecificationStore;
  metadata: RespecMetadata;
};

export type RespecMetadata = ArtifactMetadata & {
  completeness: number; // 0-100 percentage
  validationStatus: "valid"; // Respec is always valid (conflicts resolved)
  conflictsAllowed: false;
  userApproved: boolean;
  formSyncStatus: FormSyncStatus;
};

export type FormSyncStatus = "synced" | "pending" | "diverged";

// ============= MAPPED ARTIFACT =============

export type MappedArtifact = BaseArtifact & {
  type: "mapped";
  specifications: SpecificationStore;
  metadata: MappedMetadata;
};

export type MappedMetadata = ArtifactMetadata & {
  conflictsAllowed: true; // Mapped can have internal conflicts
  pendingValidation: string[]; // Node IDs awaiting validation
  processingQueue: ProcessingQueueItem[];
};

export type ProcessingQueueItem = {
  nodeId: string;
  action: "validate" | "resolve_conflict" | "move_to_respec";
  priority: number;
  timestamp: Date;
};

// ============= UNMAPPED LIST =============

export type UnmappedList = BaseArtifact & {
  type: "unmapped";
  items: UnmappedItem[];
  metadata: UnmappedMetadata;
};

export type UnmappedItem = {
  id: string;
  originalText: string;
  extractedValue?: unknown;
  reason: "no_match" | "low_confidence" | "validation_failed" | "user_custom";
  timestamp: Date;
  attemptCount: number;
  lastAttempt: Date;
};

export type UnmappedMetadata = ArtifactMetadata & {
  totalItems: number;
  retryableItems: number;
  customItems: number;
};

// ============= CONFLICT LIST =============

export type ConflictList = BaseArtifact & {
  type: "conflicts";
  active: ActiveConflict[];
  resolved: ResolvedConflict[];
  escalated: EscalatedConflict[];
  metadata: ConflictMetadata;
};

export type ActiveConflict = {
  id: string;
  affectedNodes: string[]; // Individual nodes, not full branches
  type: ConflictType;
  description: string;
  existingValue?: string;
  proposedValue?: string;
  questionTemplate?: string;
  resolutionOptions: ResolutionOption[];
  cycleCount: number;
  firstDetected: Date;
  lastUpdated: Date;
};

export type ResolvedConflict = ActiveConflict & {
  resolvedAt: Date;
  resolution: ResolutionOption;
  resolvedBy: "user" | "system" | "auto_cycle";
};

export type EscalatedConflict = ActiveConflict & {
  escalatedAt: Date;
  escalationReason: "max_cycles" | "complexity" | "user";
};

export type ConflictMetadata = ArtifactMetadata & {
  activeCount: number;
  resolvedCount: number;
  escalatedCount: number;
  systemBlocked: boolean;
  blockingConflicts: string[];
};

// ============= PRIORITY QUEUE =============

export type PriorityQueueState = {
  currentPriority: "CONFLICTS" | "CLEARING" | "PROCESSING";
  blocked: boolean;
  blockReason?: string;
  queue: PriorityItem[];
  conflictCycles: Map<string, number>; // nodeId -> cycle count
};

export type PriorityItem = {
  type: "conflict" | "mapping" | "extraction" | "validation";
  priority: number;
  payload: unknown;
  timestamp: Date;
  blocked: boolean;
  dependencies?: string[];
};

// ============= COMBINED APP STATE =============

export type ArtifactState = {
  respec: RespecArtifact;
  mapped: MappedArtifact;
  unmapped: UnmappedList;
  conflicts: ConflictList;
  priorityQueue: PriorityQueueState;
  initialized: boolean;
};

// ============= VALIDATION RESULTS =============

// export interface ArtifactValidationResult {
//   // Unused in refactored flow; validation is currently stubbed.
//   isValid: boolean;
//   errors: ArtifactValidationError[];
//   warnings: ArtifactValidationWarning[];
//   suggestedActions: string[];
// }
//
// export interface ArtifactValidationError {
//   artifactType: "respec" | "mapped" | "unmapped" | "conflicts";
//   nodeId?: string;
//   errorType: "structure" | "constraint" | "dependency" | "conflict";
//   message: string;
//   details?: unknown;
// }
//
// export interface ArtifactValidationWarning {
//   artifactType: "respec" | "mapped" | "unmapped" | "conflicts";
//   nodeId?: string;
//   warningType: "performance" | "data_quality" | "user_attention";
//   message: string;
//   details?: unknown;
// }

// ============= HELPER TYPES =============

// export type ArtifactType = "respec" | "mapped" | "unmapped" | "conflicts";
//
// export type ProcessingPriority = "CONFLICTS" | "CLEARING" | "PROCESSING";
//
// export interface SyncResult {
//   success: boolean;
//   updated: string[]; // Field paths that were updated
//   errors: string[];
//   warnings: string[];
// }
//
// export interface FieldsUpdatesData {
//   updates: FieldPayloadData[];
//   source: Source;
// }

// ============= FACTORY FUNCTIONS =============

export function createEmptyRespecArtifact(): RespecArtifact {
  return {
    id: `respec-${Date.now()}`,
    type: "respec",
    timestamp: new Date(),
    version: "1.0.0",
    specifications: {},
    metadata: {
      totalNodes: 0,
      lastModified: new Date(),
      source: "system",
      validationStatus: "valid",
      completeness: 0,
      conflictsAllowed: false,
      userApproved: false,
      formSyncStatus: "synced",
    },
  };
}

export function createEmptyMappedArtifact(): MappedArtifact {
  return {
    id: `mapped-${Date.now()}`,
    type: "mapped",
    timestamp: new Date(),
    version: "1.0.0",
    specifications: {},
    metadata: {
      totalNodes: 0,
      lastModified: new Date(),
      source: "system",
      validationStatus: "pending",
      conflictsAllowed: true,
      pendingValidation: [],
      processingQueue: [],
    },
  };
}

export function createEmptyUnmappedList(): UnmappedList {
  return {
    id: `unmapped-${Date.now()}`,
    type: "unmapped",
    timestamp: new Date(),
    version: "1.0.0",
    items: [],
    metadata: {
      totalNodes: 0,
      lastModified: new Date(),
      source: "system",
      validationStatus: "pending",
      totalItems: 0,
      retryableItems: 0,
      customItems: 0,
    },
  };
}

export function createEmptyConflictList(): ConflictList {
  return {
    id: `conflicts-${Date.now()}`,
    type: "conflicts",
    timestamp: new Date(),
    version: "1.0.0",
    active: [],
    resolved: [],
    escalated: [],
    metadata: {
      totalNodes: 0,
      lastModified: new Date(),
      source: "system",
      validationStatus: "pending",
      activeCount: 0,
      resolvedCount: 0,
      escalatedCount: 0,
      systemBlocked: false,
      blockingConflicts: [],
    },
  };
}

export function createEmptyPriorityQueue(): PriorityQueueState {
  return {
    currentPriority: "PROCESSING",
    blocked: false,
    queue: [],
    conflictCycles: new Map(),
  };
}

export function createEmptyArtifactState(): ArtifactState {
  return {
    respec: createEmptyRespecArtifact(),
    mapped: createEmptyMappedArtifact(),
    unmapped: createEmptyUnmappedList(),
    conflicts: createEmptyConflictList(),
    priorityQueue: createEmptyPriorityQueue(),
    initialized: false,
  };
}

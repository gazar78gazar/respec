/**
 * ArtifactTypes - Core type definitions for multi-artifact state management
 *
 * Implements the four-artifact system from PRD specifications:
 * 1. Respec Artifact: Validated, coherent specifications
 * 2. Mapped Artifact: LLM-matched, pending validation
 * 3. Unmapped List: Unrecognized data nodes
 * 4. Conflict List: Isolated conflicting nodes
 */

import { FieldPayloadData } from "../types/mas";
import { UCDomain, UCRequirement, UCSpecification } from "./UCDataTypes";

// ============= BASE INTERFACES =============

export interface BaseArtifact {
  id: string;
  timestamp: Date;
  version: string;
  metadata: ArtifactMetadata;
}

export interface ArtifactMetadata {
  totalNodes: number;
  lastModified: Date;
  source: Source;
  validationStatus: "valid" | "pending" | "invalid" | "conflicts";
}

export type Source = "user" | "llm" | "system" | "migration" | "autofill";

// ============= UC COMPLIANT STRUCTURE =============

interface UCCompliantStructure {
  domains: {
    [domainId: string]: UCArtifactDomain;
  };
}

interface UCArtifactDomain {
  id: string;
  name: string;
  ucSource: UCDomain;
  requirements: {
    [reqId: string]: UCArtifactRequirement;
  };
}

export interface UCArtifactRequirement {
  id: string;
  name: string;
  ucSource: UCRequirement;
  specifications: {
    [specId: string]: UCArtifactSpecification;
  };
}

export interface UCArtifactSpecification {
  id: string;
  name: string;
  value: any;
  ucSource: UCSpecification;
  attribution: "requirement" | "assumption";
  confidence: number;
  source: Source;
  originalRequest?: string;
  substitutionNote?: string;
  timestamp: Date;
}

// ============= RESPEC ARTIFACT =============

export interface RespecArtifact extends BaseArtifact, UCCompliantStructure {
  type: "respec";
  metadata: RespecMetadata;
}

export interface RespecMetadata extends ArtifactMetadata {
  completeness: number; // 0-100 percentage
  validationStatus: "valid"; // Respec is always valid (conflicts resolved)
  conflictsAllowed: false;
  userApproved: boolean;
  formSyncStatus: FormSyncStatus;
}

export type FormSyncStatus = "synced" | "pending" | "diverged";

// ============= MAPPED ARTIFACT =============

export interface MappedArtifact extends BaseArtifact, UCCompliantStructure {
  type: "mapped";
  metadata: MappedMetadata;
}

export interface MappedMetadata extends ArtifactMetadata {
  conflictsAllowed: true; // Mapped can have internal conflicts
  pendingValidation: string[]; // Node IDs awaiting validation
  processingQueue: ProcessingQueueItem[];
}

export interface ProcessingQueueItem {
  nodeId: string;
  action: "validate" | "resolve_conflict" | "move_to_respec";
  priority: number;
  timestamp: Date;
}

// ============= UNMAPPED LIST =============

export interface UnmappedList extends BaseArtifact {
  type: "unmapped";
  items: UnmappedItem[];
  metadata: UnmappedMetadata;
}

export interface UnmappedItem {
  id: string;
  originalText: string;
  extractedValue?: any;
  reason: "no_match" | "low_confidence" | "validation_failed" | "user_custom";
  timestamp: Date;
  attemptCount: number;
  lastAttempt: Date;
}

export interface UnmappedMetadata extends ArtifactMetadata {
  totalItems: number;
  retryableItems: number;
  customItems: number;
}

// ============= CONFLICT LIST =============

export interface ConflictList extends BaseArtifact {
  type: "conflicts";
  active: ActiveConflict[];
  resolved: ResolvedConflict[];
  escalated: EscalatedConflict[];
  metadata: ConflictMetadata;
}

export interface ActiveConflict {
  id: string;
  conflictingNodes: string[]; // Individual nodes, not full branches
  type: "constraint" | "dependency" | "logical" | "cross_artifact";
  description: string;
  resolutionOptions: ConflictResolution[];
  cycleCount: number;
  firstDetected: Date;
  lastUpdated: Date;
}

export interface ConflictResolution {
  id: string;
  description: string;
  action: "select_option_a" | "select_option_b" | "custom_value" | "defer";
  targetNodes: string[];
  expectedOutcome: string;
}

export interface ResolvedConflict extends ActiveConflict {
  resolvedAt: Date;
  resolution: ConflictResolution;
  resolvedBy: "user" | "system" | "auto_cycle";
}

export interface EscalatedConflict extends ActiveConflict {
  escalatedAt: Date;
  escalationReason: "max_cycles" | "complexity" | "user_request";
}

export interface ConflictMetadata extends ArtifactMetadata {
  activeCount: number;
  resolvedCount: number;
  escalatedCount: number;
  systemBlocked: boolean;
  blockingConflicts: string[];
}

// ============= BRANCH MANAGEMENT =============


export interface Movement {
  id: string;
  timestamp: Date;
  sourceArtifact: "mapped" | "conflicts" | "unmapped";
  targetArtifact: "respec" | "conflicts" | "unmapped";
  nodes: string[];
  trigger:
    | "validation_passed"
    | "conflict_resolved"
    | "timeout"
    | "user_action";
  partial: boolean;
  reason?: string;
}

export interface PartialMovement extends Movement {
  originalBranch: string;
  movedNodes: string[];
  remainingNodes: string[];
  conflictNodes: string[];
  splitReason: string;
}

export interface PendingMerge {
  id: string;
  sourceNodes: string[];
  targetArtifact: "respec" | "mapped";
  readyAt: Date;
  dependencies: string[]; // Node IDs that must be resolved first
}

// ============= PRIORITY QUEUE =============

export interface PriorityQueueState {
  currentPriority: "CONFLICTS" | "CLEARING" | "PROCESSING";
  blocked: boolean;
  blockReason?: string;
  queue: PriorityItem[];
  conflictCycles: Map<string, number>; // nodeId -> cycle count
}

export interface PriorityItem {
  type: "conflict" | "mapping" | "extraction" | "validation";
  priority: number;
  payload: any;
  timestamp: Date;
  blocked: boolean;
  dependencies?: string[];
}

// ============= COMBINED APP STATE =============

export interface ArtifactState {
  respec: RespecArtifact;
  mapped: MappedArtifact;
  unmapped: UnmappedList;
  conflicts: ConflictList;
  priorityQueue: PriorityQueueState;
  initialized: boolean;
  lastSyncWithForm: Date;
}

// ============= VALIDATION RESULTS =============

export interface ArtifactValidationResult {
  isValid: boolean;
  errors: ArtifactValidationError[];
  warnings: ArtifactValidationWarning[];
  suggestedActions: string[];
}

export interface ArtifactValidationError {
  artifactType: "respec" | "mapped" | "unmapped" | "conflicts";
  nodeId?: string;
  errorType: "structure" | "constraint" | "dependency" | "conflict";
  message: string;
  details?: any;
}

export interface ArtifactValidationWarning {
  artifactType: "respec" | "mapped" | "unmapped" | "conflicts";
  nodeId?: string;
  warningType: "performance" | "data_quality" | "user_attention";
  message: string;
  details?: any;
}

// ============= HELPER TYPES =============

export type ArtifactType = "respec" | "mapped" | "unmapped" | "conflicts";
export type NodeType = "domain" | "requirement" | "specification";
export type MovementTrigger =
  | "validation_passed"
  | "conflict_resolved"
  | "timeout"
  | "user_action";
export type ConflictType =
  | "constraint"
  | "dependency"
  | "logical"
  | "cross_artifact";
export type ProcessingPriority = "CONFLICTS" | "CLEARING" | "PROCESSING";

export interface SyncResult {
  success: boolean;
  updated: string[]; // Field paths that were updated
  errors: string[];
  warnings: string[];
}

export interface LegacyRequirements {
  // TODO zeev reimplement correctly, check real data structure, fix currently used types
  [section: string]: {
    [field: string]: {
      value: any;
      isAssumption?: boolean;
      dataSource?: string;
      priority?: number;
      toggleHistory?: any[];
      lastUpdated?: string;
    };
  };
}

export interface FieldsUpdatesData {
  updates: FieldPayloadData[];
  source: Source;
}

// ============= FACTORY FUNCTIONS =============

export function createEmptyRespecArtifact(): RespecArtifact {
  return {
    id: `respec-${Date.now()}`,
    type: "respec",
    timestamp: new Date(),
    version: "1.0.0",
    domains: {},
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
    domains: {},
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
    lastSyncWithForm: new Date(),
  };
}

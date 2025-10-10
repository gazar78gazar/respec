/**
 * ArtifactManager - Central management for multi-artifact state
 *
 * Manages the four-artifact system:
 * 1. Operations on artifacts (add, remove, move, merge)
 * 2. State synchronization between artifacts
 * 3. Conflict detection and resolution coordination
 * 4. Integration with existing requirements state (compatibility layer)
 */

import {
  ArtifactState,
  RespecArtifact,
  MappedArtifact,
  UnmappedList,
  ConflictList,
  UC8ArtifactSpecification,
  ActiveConflict,
  Movement,
  ArtifactValidationResult,
  createEmptyArtifactState,
  ProcessingPriority
} from './ArtifactTypes';

import { UCSpecification } from '../../data/UCDataTypes';
import { ucDataLayer } from '../../data/UCDataLayer';
import { conflictResolver } from '../../data/ConflictResolver';

// Temporary type for conflict detection result
export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: string;
    nodes: string[];
    description: string;
    resolution?: string;
  }>;
}

// ============= MAIN ARTIFACT MANAGER =============

export class ArtifactManager {
  private state: ArtifactState;
  private listeners: Map<string, Function> = new Map();

  constructor() {
    this.state = createEmptyArtifactState();
  }

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    if (!ucDataLayer.isLoaded()) {
      throw new Error('UC8 dataset must be loaded before ArtifactManager initialization');
    }

    this.state.initialized = true;
    this.state.lastSyncWithForm = new Date();

    console.log('[ArtifactManager] Initialized with UC8 dataset');
    this.emit('initialized', { state: this.getState() });
  }

  // ============= STATE ACCESS =============

  getState(): ArtifactState {
    return { ...this.state };
  }

  getRespecArtifact(): RespecArtifact {
    return { ...this.state.respec };
  }

  getMappedArtifact(): MappedArtifact {
    return { ...this.state.mapped };
  }

  getUnmappedList(): UnmappedList {
    return { ...this.state.unmapped };
  }

  getConflictList(): ConflictList {
    return { ...this.state.conflicts };
  }

  isSystemBlocked(): boolean {
    return this.state.priorityQueue.blocked || this.state.conflicts.metadata.systemBlocked;
  }

  getBlockingReason(): string | undefined {
    if (this.state.conflicts.metadata.systemBlocked) {
      return `Active conflicts: ${this.state.conflicts.metadata.blockingConflicts.join(', ')}`;
    }
    return this.state.priorityQueue.blockReason;
  }

  // ============= SPECIFICATION OPERATIONS =============

  async addSpecificationToMapped(
    spec: UCSpecification,
    value: any,
    originalRequest?: string,
    substitutionNote?: string,
    source?: 'user_request' | 'conflict_resolution' | 'dependency'
  ): Promise<void> {
    if (!this.state.initialized) {
      throw new Error('ArtifactManager not initialized');
    }

    // Create artifact specification
    const artifactSpec: UC8ArtifactSpecification = {
      id: spec.id,
      name: spec.name,
      value,
      uc8Source: spec,
      attribution: 'requirement',
      confidence: 1.0,
      source: 'llm',
      originalRequest,
      substitutionNote,
      timestamp: new Date()
    };

    // Use UCDataLayer for hierarchy
    // Get parent requirements for this specification (UC8: P## → R##)
    const parentReqs = ucDataLayer.getParentRequirements(spec.id);
    if (parentReqs.length === 0) {
      throw new Error(`Cannot find parent requirements for ${spec.id}`);
    }

    const reqId = parentReqs[0].id; // R## format

    // Get parent scenarios for the requirement (UC8: R## → S##)
    const parentScenarios = ucDataLayer.getParentScenarios(reqId);
    if (parentScenarios.length === 0) {
      throw new Error(`Cannot find parent scenario for requirement ${reqId}`);
    }

    const scenarioId = parentScenarios[0].id; // S## format

    // Ensure scenario exists in mapped artifact
    // Get scenario from UCDataLayer
    if (!this.state.mapped.scenarios[scenarioId]) {
      const uc8Scenario = ucDataLayer.getScenario(scenarioId);
      if (!uc8Scenario) {
        throw new Error(`UC8 scenario ${scenarioId} not found`);
      }

      this.state.mapped.scenarios[scenarioId] = {
        id: scenarioId,
        name: uc8Scenario.name,
        uc8Source: uc8Scenario,
        requirements: {}
      };
    }

    // Ensure requirement exists in scenario
    // SPRINT 3 FIX: Get requirement from UCDataLayer
    if (!this.state.mapped.scenarios[scenarioId].requirements[reqId]) {
      const uc8Requirement = ucDataLayer.getRequirement(reqId);
      if (!uc8Requirement) {
        throw new Error(`UC8 requirement ${reqId} not found`);
      }

      this.state.mapped.scenarios[scenarioId].requirements[reqId] = {
        id: reqId,
        name: uc8Requirement.name,
        uc8Source: uc8Requirement as any, // UC8 requirement stored in artifact
        specifications: {}
      };
    }

    // Add specification to requirement
    this.state.mapped.scenarios[scenarioId].requirements[reqId].specifications[spec.id] = artifactSpec;

    // Update metadata
    this.state.mapped.metadata.totalNodes++;
    this.state.mapped.metadata.lastModified = new Date();
    this.state.mapped.metadata.pendingValidation.push(spec.id);

    console.log(`[ArtifactManager] Added specification ${spec.id} to mapped artifact (source: ${source || 'user_request'})`);
    this.emit('specification_added', { artifactType: 'mapped', specId: spec.id, value, source });

    // SPRINT 3: Skip conflict detection if this is from conflict resolution
    if (source === 'conflict_resolution') {
      console.log(`[ArtifactManager] ⚠️  Skipping conflict detection for ${spec.id} (source: conflict_resolution)`);
      return;
    }

    // Note: UC8 dependency handling is done via UCDataLayer.getRequiredNodes()
    // Auto-fulfillment removed - UC8 uses explicit requirement selection
  }

  // ============= CONFLICT DETECTION =============

  async detectConflicts(): Promise<ConflictResult> {
    if (!this.state.initialized) {
      return { hasConflict: false, conflicts: [] };
    }

    // Collect all specifications from mapped artifact
    const specifications: Array<{id: string, value: any}> = [];
    const activeRequirements: string[] = [];
    const activeScenarios: string[] = [];

    Object.values(this.state.mapped.scenarios).forEach(scenario => {
      activeScenarios.push(scenario.id);

      Object.values(scenario.requirements).forEach(requirement => {
        activeRequirements.push(requirement.id);

        Object.values(requirement.specifications).forEach(spec => {
          specifications.push({ id: spec.id, value: spec.value });
        });
      });
    });

    // UC8 conflict detection (fail fast if not loaded)
    if (!ucDataLayer.isLoaded()) {
      throw new Error('[ArtifactManager] UC8 not loaded - cannot detect conflicts. System requires UC8 dataset.');
    }

    console.log('[ArtifactManager] Using UC8 conflict detection with 107 exclusions');

      // Collect all specification IDs currently in mapped artifact
      const specIds = specifications.map(s => s.id);

      // SPRINT 3 FIX: Also collect specification IDs from respec artifact
      // This is critical - MAPPED specs must be checked against RESPEC specs!
      const respecSpecIds: string[] = [];
      Object.values(this.state.respec.scenarios).forEach(scenario => {
        Object.values(scenario.requirements).forEach(requirement => {
          Object.keys(requirement.specifications).forEach(specId => {
            respecSpecIds.push(specId);
          });
        });
      });

      console.log(`[ArtifactManager] Checking ${specIds.length} MAPPED specs against ${respecSpecIds.length} RESPEC specs`);

      // Check for conflicts among current selections using UC8
      const allConflicts = new Map<string, any>(); // Use map to deduplicate

      // For each spec in MAPPED, check if it conflicts with:
      // 1. Other specs in MAPPED
      // 2. Specs already in RESPEC (critical fix!)
      for (let i = 0; i < specIds.length; i++) {
        const checkSpec = specIds[i];
        const otherMappedSpecs = specIds.filter((_, idx) => idx !== i);

        // Combine other MAPPED specs + all RESPEC specs
        const allOtherSpecs = [...otherMappedSpecs, ...respecSpecIds];

        // Use conflictResolver to get conflicts with resolution options
        const uc8Conflicts = conflictResolver.detectConflicts(checkSpec, allOtherSpecs);

        uc8Conflicts.forEach(uc8Conflict => {
          // Create unique key for this conflict pair (sorted to avoid duplicates)
          const conflictKey = uc8Conflict.conflictingNodes.sort().join('|');

          if (!allConflicts.has(conflictKey)) {
            // Store UC8 conflict with full resolution options
            allConflicts.set(conflictKey, uc8Conflict);
          }
        });
      }

      // Convert UC8 conflicts to ConflictResult format (raw data for agent)
      const uc8ConflictList = Array.from(allConflicts.values());

    const result: ConflictResult = {
      hasConflict: uc8ConflictList.length > 0,
      conflicts: uc8ConflictList.map(uc8Conflict => ({
        type: uc8Conflict.type as any,
        nodes: uc8Conflict.conflictingNodes,
        description: uc8Conflict.description,
        resolution: uc8Conflict.resolution
      }))
    };

    console.log(`[ArtifactManager] UC8 detected ${result.conflicts.length} conflicts (types: ${result.conflicts.map(c => c.type).join(', ')})`);

    // Convert to active conflicts if any found - agent will generate A/B from raw data
    if (result.hasConflict) {
      result.conflicts.forEach(conflict => {
        this.addActiveConflict({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conflictingNodes: conflict.nodes,
          type: conflict.type as any,
          description: conflict.description,
          resolution: conflict.resolution, // UC8 question_template for agent
          cycleCount: 0,
          firstDetected: new Date(),
          lastUpdated: new Date()
        });
      });

      // Block system if conflicts detected
      this.state.priorityQueue.blocked = true;
      this.state.priorityQueue.blockReason = `${result.conflicts.length} conflict(s) detected`;
      this.state.priorityQueue.currentPriority = 'CONFLICTS';

      this.state.conflicts.metadata.systemBlocked = true;
      this.state.conflicts.metadata.blockingConflicts = result.conflicts.flatMap(c => c.nodes);
    }

    return result;
  }

  private addActiveConflict(conflict: ActiveConflict): void {
    this.state.conflicts.active.push(conflict);
    this.state.conflicts.metadata.activeCount++;
    this.state.conflicts.metadata.lastModified = new Date();

    console.log(`[ArtifactManager] Added active conflict: ${conflict.id}`);
    this.emit('conflict_detected', { conflict });
  }

  // ============= CONFLICT RESOLUTION =============

  async resolveConflict(conflictId: string, choice: 'a' | 'b'): Promise<void> {
    const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const conflict = this.state.conflicts.active[conflictIndex];

    console.log(`[ArtifactManager] Applying user choice '${choice}' to conflict ${conflict.id}`);

    // ========== DETERMINE WINNING/LOSING SPECS ==========
    let losingSpecs: string[] = [];
    let winningSpecs: string[] = [];

    // Parse user choice (A = keep first, B = keep second)
    if (choice === 'a') {
      // Option A: Keep first conflicting node, remove others
      winningSpecs = [conflict.conflictingNodes[0]];
      losingSpecs = conflict.conflictingNodes.slice(1);
    } else if (choice === 'b') {
      // Option B: Keep second conflicting node, remove others
      winningSpecs = [conflict.conflictingNodes[1]];
      losingSpecs = conflict.conflictingNodes.slice(0, 1).concat(conflict.conflictingNodes.slice(2));
    } else {
      throw new Error(`[Resolution] Unknown choice: ${choice}. Must be 'a' or 'b'.`);
    }

    console.log(`[Resolution] Winning specs: ${winningSpecs.join(', ')}`);
    console.log(`[Resolution] Losing specs: ${losingSpecs.join(', ')}`);

    // ========== ATOMIC REMOVAL (with rollback capability) ==========
    const removedSpecs: Array<{id: string, backup: any}> = [];

    try {
      // Remove losing specifications
      for (const specId of losingSpecs) {
        const spec = this.findSpecificationInMapped(specId);

        if (!spec) {
          console.warn(`[Resolution] ⚠️  Spec ${specId} not found, skipping removal`);
          continue;
        }

        // Backup before removal
        removedSpecs.push({ id: specId, backup: JSON.parse(JSON.stringify(spec)) });

        // Remove from mapped artifact
        console.log(`[ArtifactManager] Removing spec ${specId} due to conflict resolution ${resolution.id}`);
        this.removeSpecificationFromMapped(specId);
      }

      // Log winning specs (no action needed, they stay in mapped)
      for (const specId of winningSpecs) {
        console.log(`[ArtifactManager] Keeping spec ${specId} as resolution choice`);
      }

      // ========== POST-RESOLUTION VERIFICATION ==========
      for (const specId of losingSpecs) {
        const stillExists = this.findSpecificationInMapped(specId);
        if (stillExists) {
          throw new Error(
            `[CRITICAL] Failed to remove ${specId} - data integrity compromised. ` +
            `Rolling back resolution.`
          );
        }
      }

      for (const specId of winningSpecs) {
        const exists = this.findSpecificationInMapped(specId);
        if (!exists) {
          throw new Error(
            `[CRITICAL] Winning spec ${specId} disappeared during resolution - ` +
            `data integrity compromised. Rolling back.`
          );
        }
      }

      console.log(`[ArtifactManager] ✅ Resolution applied successfully`);

    } catch (error) {
      // ========== ROLLBACK ON FAILURE ==========
      console.error(`[ArtifactManager] ❌ Resolution failed, rolling back...`, error);

      // Restore removed specs
      for (const { id, backup } of removedSpecs) {
        console.log(`[Rollback] Restoring spec ${id}`);
        this.restoreSpecificationToMapped(id, backup);
      }

      throw error;
    }

    // Move conflict to resolved (store user choice for audit trail)
    const resolvedConflict = {
      ...conflict,
      resolvedAt: new Date(),
      userChoice: choice,
      resolvedBy: 'user' as const
    };

    this.state.conflicts.resolved.push(resolvedConflict);
    this.state.conflicts.active.splice(conflictIndex, 1);

    // Update metadata
    this.state.conflicts.metadata.activeCount--;
    this.state.conflicts.metadata.resolvedCount++;

    // Unblock system if no more active conflicts
    if (this.state.conflicts.active.length === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = 'CLEARING';

      this.state.conflicts.metadata.systemBlocked = false;
      this.state.conflicts.metadata.blockingConflicts = [];
    }

    console.log(`[ArtifactManager] Resolved conflict: ${conflictId} with choice: ${choice}`);

    // Sprint 3: After conflict resolved, move non-conflicting specs from MAPPED to RESPEC
    // This triggers the normal flow: MAPPED → RESPEC → Form heals from RESPEC
    await this.moveNonConflictingToRespec();

    this.emit('conflict_resolved', { conflictId, choice });
  }

  /**
   * Find specification in any artifact (public for user-selection preservation)
   * Sprint 3 Week 1: Helper for preservation checks
   */
  findSpecificationInArtifact(artifactName: 'mapped' | 'respec', specId: string): any | null {
    const artifact = artifactName === 'mapped' ? this.state.mapped : this.state.respec;

    for (const scenario of Object.values(artifact.scenarios)) {
      for (const requirement of Object.values(scenario.requirements)) {
        if (requirement.specifications[specId]) {
          return requirement.specifications[specId];
        }
      }
    }
    return null;
  }

  /**
   * Find specification in mapped artifact (internal helper)
   * Sprint 3 Week 1: Helper for resolution operations
   */
  private findSpecificationInMapped(specId: string): any | null {
    return this.findSpecificationInArtifact('mapped', specId);
  }

  /**
   * Restore specification to mapped artifact (for rollback)
   * Sprint 3 Week 1: Helper for rollback operations
   */
  private restoreSpecificationToMapped(specId: string, specBackup: any): void {
    // Use UCDataLayer for hierarchy
    const parentReqs = ucDataLayer.getParentRequirements(specId);
    if (parentReqs.length === 0) {
      console.error(`[Rollback] Cannot restore ${specId} - no parent requirements found`);
      return;
    }

    const reqId = parentReqs[0].id;
    const parentScenarios = ucDataLayer.getParentScenarios(reqId);
    if (parentScenarios.length === 0) {
      console.error(`[Rollback] Cannot restore ${specId} - no parent scenario found`);
      return;
    }

    const scenarioId = parentScenarios[0].id; // Scenario ID (S##)
    const requirement = reqId; // Requirement ID (R##)

    // Ensure scenario structure exists
    // Get scenario from UCDataLayer
    if (!this.state.mapped.scenarios[scenarioId]) {
      const uc8Scenario = ucDataLayer.getScenario(scenarioId);
      if (!uc8Scenario) {
        console.error(`[Rollback] UC8 scenario ${scenarioId} not found`);
        return;
      }
      this.state.mapped.scenarios[scenarioId] = {
        id: scenarioId,
        name: uc8Scenario.name,
        uc8Source: uc8Scenario as any,
        requirements: {}
      };
    }

    // Ensure requirement structure exists
    // SPRINT 3 FIX: Get requirement from UCDataLayer
    if (!this.state.mapped.scenarios[scenarioId].requirements[requirement]) {
      const uc8Requirement = ucDataLayer.getRequirement(requirement);
      if (!uc8Requirement) {
        console.error(`[Rollback] UC8 requirement ${requirement} not found`);
        return;
      }
      this.state.mapped.scenarios[scenarioId].requirements[requirement] = {
        id: requirement,
        name: uc8Requirement.name,
        uc8Source: uc8Requirement as any,
        specifications: {}
      };
    }

    this.state.mapped.scenarios[scenarioId].requirements[requirement].specifications[specId] = specBackup;
    console.log(`[Rollback] Restored ${specId} to mapped artifact`);
  }

  // ============= ARTIFACT MOVEMENT =============

  async moveNonConflictingToRespec(): Promise<void> {
    if (!this.state.initialized) {
      return;
    }

    // Find specifications in mapped that don't have conflicts
    const nonConflictingSpecs: string[] = [];
    const conflictingNodes = new Set(this.state.conflicts.metadata.blockingConflicts);

    Object.values(this.state.mapped.scenarios).forEach(scenario => {
      Object.values(scenario.requirements).forEach(requirement => {
        Object.values(requirement.specifications).forEach(spec => {
          if (!conflictingNodes.has(spec.id)) {
            nonConflictingSpecs.push(spec.id);
          }
        });
      });
    });

    if (nonConflictingSpecs.length > 0) {
      await this.moveSpecificationsToRespec(nonConflictingSpecs);
      console.log(`[ArtifactManager] Moved ${nonConflictingSpecs.length} non-conflicting specs to respec`);
    }
  }

  private async moveSpecificationsToRespec(specIds: string[]): Promise<void> {
    const movement: Movement = {
      id: `movement-${Date.now()}`,
      timestamp: new Date(),
      sourceArtifact: 'mapped',
      targetArtifact: 'respec',
      nodes: specIds,
      trigger: 'validation_passed',
      partial: false
    };

    // Copy specifications from mapped to respec
    specIds.forEach(specId => {
      const spec = this.findSpecificationInArtifact('mapped', specId);
      if (spec) {
        this.addSpecificationToRespec(spec);
        this.removeSpecificationFromMapped(specId);
      }
    });

    this.state.branchManagement.movements.completed.push(movement);
    this.emit('specifications_moved', { movement });
  }

  private addSpecificationToRespec(spec: UC8ArtifactSpecification): void {
    // Use UCDataLayer for hierarchy
    const parentReqs = ucDataLayer.getParentRequirements(spec.id);
    if (parentReqs.length === 0) {
      console.warn(`[ArtifactManager] Cannot add ${spec.id} to respec - no parent requirements found`);
      return;
    }

    const reqId = parentReqs[0].id;
    const parentScenarios = ucDataLayer.getParentScenarios(reqId);
    if (parentScenarios.length === 0) {
      console.warn(`[ArtifactManager] Cannot add ${spec.id} to respec - no parent scenario found`);
      return;
    }

    const scenarioId = parentScenarios[0].id; // Scenario ID (S##)

    // Ensure structure exists in respec
    if (!this.state.respec.scenarios[scenarioId]) {
      const mappedScenario = this.state.mapped.scenarios[scenarioId];
      if (mappedScenario) {
        this.state.respec.scenarios[scenarioId] = {
          id: scenarioId,
          name: mappedScenario.name,
          uc8Source: mappedScenario.uc8Source,
          requirements: {}
        };
      }
    }

    if (!this.state.respec.scenarios[scenarioId].requirements[reqId]) {
      const mappedRequirement = this.state.mapped.scenarios[scenarioId]?.requirements[reqId];
      if (mappedRequirement) {
        this.state.respec.scenarios[scenarioId].requirements[reqId] = {
          id: reqId,
          name: mappedRequirement.name,
          uc8Source: mappedRequirement.uc8Source,
          specifications: {}
        };
      }
    }

    // Add specification
    this.state.respec.scenarios[scenarioId].requirements[reqId].specifications[spec.id] = {
      ...spec,
      timestamp: new Date()
    };

    // Update metadata
    this.state.respec.metadata.totalNodes++;
    this.state.respec.metadata.lastModified = new Date();
  }

  /**
   * Remove specification from mapped artifact (internal)
   * Used by resolution system and branch management
   */
  private removeSpecificationFromMapped(specId: string): void {
    for (const scenario of Object.values(this.state.mapped.scenarios)) {
      for (const requirement of Object.values(scenario.requirements)) {
        if (requirement.specifications[specId]) {
          delete requirement.specifications[specId];
          this.state.mapped.metadata.totalNodes--;
          this.state.mapped.metadata.lastModified = new Date();

          // Remove from pending validation
          const pendingIndex = this.state.mapped.metadata.pendingValidation.indexOf(specId);
          if (pendingIndex > -1) {
            this.state.mapped.metadata.pendingValidation.splice(pendingIndex, 1);
          }

          console.log(`[ArtifactManager] Removed ${specId} from mapped artifact`);
          return;
        }
      }
    }
  }

  // ============= FORM SYNCHRONIZATION =============

  async syncWithFormState(_requirements: any): Promise<void> {
    // Compatibility layer: sync new artifact state with existing requirements state
    this.state.lastSyncWithForm = new Date();
    this.state.respec.metadata.formSyncStatus = 'synced';

    console.log('[ArtifactManager] Synced with form state');
    this.emit('form_sync_complete', { timestamp: this.state.lastSyncWithForm });
  }

  // ============= VALIDATION =============

  async validateArtifacts(): Promise<ArtifactValidationResult> {
    const result: ArtifactValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestedActions: []
    };

    // Validate each artifact
    const respecValidation = await this.validateArtifact('respec');
    const mappedValidation = await this.validateArtifact('mapped');

    result.errors.push(...respecValidation.errors, ...mappedValidation.errors);
    result.warnings.push(...respecValidation.warnings, ...mappedValidation.warnings);

    result.isValid = result.errors.length === 0;

    return result;
  }

  private async validateArtifact(_type: 'mapped' | 'respec'): Promise<ArtifactValidationResult> {
    // Implementation would validate individual artifacts
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestedActions: []
    };
  }

  // ============= EVENT SYSTEM =============

  on(event: string, callback: Function): void {
    this.listeners.set(event, callback);
  }

  private emit(event: string, data?: any): void {
    const callback = this.listeners.get(event);
    if (callback) {
      callback(data);
    }
  }

  // ============= UTILITY METHODS =============

  getCompletionStatus(): { respec: number; mapped: number; total: number } {
    return {
      respec: this.state.respec.metadata.totalNodes,
      mapped: this.state.mapped.metadata.totalNodes,
      total: this.state.respec.metadata.totalNodes + this.state.mapped.metadata.totalNodes
    };
  }

  getSystemStatus(): {
    blocked: boolean;
    priority: ProcessingPriority;
    activeConflicts: number;
    pendingValidation: number;
  } {
    return {
      blocked: this.isSystemBlocked(),
      priority: this.state.priorityQueue.currentPriority,
      activeConflicts: this.state.conflicts.metadata.activeCount,
      pendingValidation: this.state.mapped.metadata.pendingValidation.length
    };
  }

  // ============= DEBUG HELPERS =============

  debugDumpState(): any {
    return {
      initialized: this.state.initialized,
      respec: {
        scenarios: Object.keys(this.state.respec.scenarios).length,
        totalNodes: this.state.respec.metadata.totalNodes
      },
      mapped: {
        scenarios: Object.keys(this.state.mapped.scenarios).length,
        totalNodes: this.state.mapped.metadata.totalNodes,
        pendingValidation: this.state.mapped.metadata.pendingValidation.length
      },
      conflicts: {
        active: this.state.conflicts.metadata.activeCount,
        resolved: this.state.conflicts.metadata.resolvedCount,
        systemBlocked: this.state.conflicts.metadata.systemBlocked
      },
      priority: {
        currentPriority: this.state.priorityQueue.currentPriority,
        blocked: this.state.priorityQueue.blocked,
        blockReason: this.state.priorityQueue.blockReason
      }
    };
  }
}
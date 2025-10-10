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
  UC1ArtifactSpecification,
  ActiveConflict,
  Movement,
  ArtifactValidationResult,
  createEmptyArtifactState,
  ProcessingPriority
} from './ArtifactTypes';

import {
  UC1ValidationEngine,
  UC1Specification,
  ConflictResult
} from '../UC1ValidationEngine';

// Sprint 1: Import UC8 Data Layer (full integration in Sprint 2)
import { ucDataLayer } from '../../data/UCDataLayer';
import { conflictResolver } from '../../data/ConflictResolver';

// ============= MAIN ARTIFACT MANAGER =============

export class ArtifactManager {
  private state: ArtifactState;
  private uc1Engine: UC1ValidationEngine;
  private listeners: Map<string, Function> = new Map();
  // Sprint 2: Store UC8 conflict data for resolution options
  private uc8ConflictData: Map<string, any> = new Map();

  constructor(uc1Engine: UC1ValidationEngine) {
    this.state = createEmptyArtifactState();
    this.uc1Engine = uc1Engine;
  }

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    if (!this.uc1Engine.isReady()) {
      throw new Error('UC1ValidationEngine must be initialized before ArtifactManager');
    }

    this.state.initialized = true;
    this.state.lastSyncWithForm = new Date();

    console.log('[ArtifactManager] Initialized with UC1 engine');
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
    spec: UC1Specification,
    value: any,
    originalRequest?: string,
    substitutionNote?: string,
    source?: 'user_request' | 'conflict_resolution' | 'dependency'
  ): Promise<void> {
    if (!this.state.initialized) {
      throw new Error('ArtifactManager not initialized');
    }

    // Validate specification value against UC1 constraints
    const validation = this.uc1Engine.validateSpecification(spec.id, value);
    if (!validation.isValid) {
      console.warn(`[ArtifactManager] Validation warnings for ${spec.id}:`, validation.errors);
    }

    // Create artifact specification
    const artifactSpec: UC1ArtifactSpecification = {
      id: spec.id,
      name: spec.name,
      value,
      uc1Source: spec,
      attribution: 'requirement',
      confidence: 1.0,
      source: 'llm',
      originalRequest,
      substitutionNote,
      timestamp: new Date()
    };

    // SPRINT 3 FIX: Use UCDataLayer for hierarchy instead of UC1ValidationEngine
    // Get parent requirements for this specification (UC8: P## → R##)
    const parentReqs = ucDataLayer.getParentRequirements(spec.id);
    if (parentReqs.length === 0) {
      throw new Error(`Cannot find parent requirements for ${spec.id}`);
    }

    const reqId = parentReqs[0].id; // R## format

    // Get parent scenarios for the requirement (UC8: R## → S##)
    // In artifact structure, scenarios map to "domains" (just terminology)
    const parentScenarios = ucDataLayer.getParentScenarios(reqId);
    if (parentScenarios.length === 0) {
      throw new Error(`Cannot find parent scenario for requirement ${reqId}`);
    }

    const domainId = parentScenarios[0].id; // S## format (stored as "domain" in artifact)

    // Ensure domain exists in mapped artifact
    // SPRINT 3 FIX: Get scenario from UCDataLayer instead of domain from UC1Engine
    if (!this.state.mapped.domains[domainId]) {
      const uc8Scenario = ucDataLayer.getScenario(domainId);
      if (!uc8Scenario) {
        throw new Error(`UC8 scenario ${domainId} not found`);
      }

      this.state.mapped.domains[domainId] = {
        id: domainId,
        name: uc8Scenario.name,
        uc1Source: uc8Scenario as any, // UC8 scenario stored as "domain" in artifact
        requirements: {}
      };
    }

    // Ensure requirement exists in domain
    // SPRINT 3 FIX: Get requirement from UCDataLayer
    if (!this.state.mapped.domains[domainId].requirements[reqId]) {
      const uc8Requirement = ucDataLayer.getRequirement(reqId);
      if (!uc8Requirement) {
        throw new Error(`UC8 requirement ${reqId} not found`);
      }

      this.state.mapped.domains[domainId].requirements[reqId] = {
        id: reqId,
        name: uc8Requirement.name,
        uc1Source: uc8Requirement as any, // UC8 requirement stored in artifact
        specifications: {}
      };
    }

    // Add specification to requirement
    this.state.mapped.domains[domainId].requirements[reqId].specifications[spec.id] = artifactSpec;

    // Update metadata
    this.state.mapped.metadata.totalNodes++;
    this.state.mapped.metadata.lastModified = new Date();
    this.state.mapped.metadata.pendingValidation.push(spec.id);

    console.log(`[ArtifactManager] Added specification ${spec.id} to mapped artifact (source: ${source || 'user_request'})`);
    this.emit('specification_added', { artifactType: 'mapped', specId: spec.id, value, source });

    // SPRINT 3 FIX: Skip conflict detection and dependency fulfillment if this is from conflict resolution
    if (source === 'conflict_resolution') {
      console.log(`[ArtifactManager] ⚠️  Skipping conflict detection for ${spec.id} (source: conflict_resolution)`);
      return; // Don't re-detect conflicts or fulfill dependencies
    }

    // SPRINT 3 FIX: Auto-fulfill dependencies (only for top-level calls, not recursive)
    // Note: Currently supports 1-level dependencies. Multi-level dependency chains
    // will require the new UC schema with updated dependency definitions.
    if (!originalRequest || !originalRequest.includes('Auto-added as dependency')) {
      await this.autoFulfillDependencies(reqId, new Set(), 0);
    }
  }

  /**
   * Auto-fulfill requirement dependencies by adding default specifications
   * SPRINT 3 FIX: Dependencies should be auto-added, not treated as conflicts
   * @param requirementId - The requirement to check dependencies for
   * @param visited - Set of already processed requirements (prevents circular dependencies)
   * @param depth - Current recursion depth (max 5 levels)
   */
  private async autoFulfillDependencies(
    requirementId: string,
    visited: Set<string> = new Set(),
    depth: number = 0
  ): Promise<void> {
    // Guard against circular dependencies and excessive recursion
    if (depth > 5 || visited.has(requirementId)) {
      console.warn(`[ArtifactManager] Skipping dependency fulfillment for ${requirementId} (depth=${depth}, visited=${visited.has(requirementId)})`);
      return;
    }

    visited.add(requirementId);
    const requirement = (this.uc1Engine as any).schema?.requirements[requirementId];

    if (!requirement || !requirement.dependencies || requirement.dependencies.length === 0) {
      return; // No dependencies to fulfill
    }

    console.log(`[ArtifactManager] Auto-fulfilling ${requirement.dependencies.length} dependencies for ${requirementId}`);

    for (const dep of requirement.dependencies) {
      const depReqId = dep.target;

      // Check if dependency requirement is already active (has specifications in mapped)
      const isDependencyActive = this.isRequirementActive(depReqId);

      if (isDependencyActive) {
        console.log(`[ArtifactManager] ✓ Dependency ${depReqId} already satisfied`);
        continue; // Already satisfied
      }

      // Auto-add default specifications from the dependency requirement
      console.log(`[ArtifactManager] ➕ Auto-adding dependency: ${depReqId} (${dep.rationale})`);
      await this.addDependencyRequirement(depReqId);
    }
  }

  /**
   * Check if a requirement is active (has specifications in mapped artifact)
   */
  private isRequirementActive(requirementId: string): boolean {
    for (const domain of Object.values(this.state.mapped.domains)) {
      if (domain.requirements[requirementId]) {
        const specCount = Object.keys(domain.requirements[requirementId].specifications).length;
        if (specCount > 0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Add default specifications from a dependency requirement
   */
  private async addDependencyRequirement(requirementId: string): Promise<void> {
    const requirement = (this.uc1Engine as any).schema?.requirements[requirementId];

    if (!requirement) {
      console.warn(`[ArtifactManager] Cannot find requirement ${requirementId} for dependency fulfillment`);
      return;
    }

    // Get all specifications under this requirement
    const specIds = requirement.child.filter((childId: string) =>
      (this.uc1Engine as any).schema?.specifications[childId]
    );

    console.log(`[ArtifactManager] Adding ${specIds.length} default specifications for dependency ${requirementId}`);

    // Add each specification with its default value
    for (const specId of specIds) {
      const uc1Spec = this.uc1Engine.getSpecification(specId);

      console.log(`[ArtifactManager]   Checking ${specId}: spec=${!!uc1Spec}, default=${uc1Spec?.default_value}`);

      if (uc1Spec && uc1Spec.default_value) {
        // Only add if it has a meaningful default value
        if (uc1Spec.default_value !== 'Not Required') {
          try {
            console.log(`[ArtifactManager]   → Adding ${specId} with value: ${uc1Spec.default_value}`);
            await this.addSpecificationToMapped(
              uc1Spec,
              uc1Spec.default_value,
              `Auto-added as dependency of ${requirementId}`,
              `Required by: ${requirement.name}`
            );
            console.log(`[ArtifactManager]   ✓ Added ${specId} = ${uc1Spec.default_value}`);
          } catch (error) {
            console.error(`[ArtifactManager]   ✗ Failed to add ${specId}:`, error);
          }
        } else {
          console.log(`[ArtifactManager]   ⊘ Skipped ${specId} (default = "Not Required")`);
        }
      } else {
        console.log(`[ArtifactManager]   ⊘ Skipped ${specId} (no spec or no default_value)`);
      }
    }
  }

  // ============= CONFLICT DETECTION =============

  async detectConflicts(): Promise<ConflictResult> {
    if (!this.state.initialized) {
      return { hasConflict: false, conflicts: [] };
    }

    // Collect all specifications from mapped artifact
    const specifications: Array<{id: string, value: any}> = [];
    const activeRequirements: string[] = [];
    const activeDomains: string[] = [];

    Object.values(this.state.mapped.domains).forEach(domain => {
      activeDomains.push(domain.id);

      Object.values(domain.requirements).forEach(requirement => {
        activeRequirements.push(requirement.id);

        Object.values(requirement.specifications).forEach(spec => {
          specifications.push({ id: spec.id, value: spec.value });
        });
      });
    });

    // Sprint 2: Full UC8 conflict detection
    // Check if UC8 is loaded, use it; otherwise fallback to UC1
    let result: ConflictResult;

    if (ucDataLayer.isLoaded()) {
      console.log('[ArtifactManager] Using UC8 conflict detection with 107 exclusions');

      // Collect all specification IDs currently in mapped artifact
      const specIds = specifications.map(s => s.id);

      // Check for conflicts among current selections using UC8
      const allConflicts = new Map<string, any>(); // Use map to deduplicate

      // For each spec, check if it conflicts with all others
      for (let i = 0; i < specIds.length; i++) {
        const checkSpec = specIds[i];
        const otherSpecs = specIds.filter((_, idx) => idx !== i);

        // Use conflictResolver to get conflicts with resolution options
        const uc8Conflicts = conflictResolver.detectConflicts(checkSpec, otherSpecs);

        uc8Conflicts.forEach(uc8Conflict => {
          // Create unique key for this conflict pair (sorted to avoid duplicates)
          const conflictKey = uc8Conflict.conflictingNodes.sort().join('|');

          if (!allConflicts.has(conflictKey)) {
            // Store UC8 conflict with full resolution options
            allConflicts.set(conflictKey, uc8Conflict);
          }
        });
      }

      // Convert UC8 conflicts to ConflictResult format
      const uc8ConflictList = Array.from(allConflicts.values());

      // Store UC8 conflict data for later resolution option generation
      this.uc8ConflictData.clear();
      uc8ConflictList.forEach(uc8Conflict => {
        const conflictKey = uc8Conflict.conflictingNodes.sort().join('|');
        this.uc8ConflictData.set(conflictKey, uc8Conflict);
      });

      result = {
        hasConflict: uc8ConflictList.length > 0,
        conflicts: uc8ConflictList.map(uc8Conflict => ({
          type: uc8Conflict.type as any,
          nodes: uc8Conflict.conflictingNodes,
          description: uc8Conflict.description,
          resolution: uc8Conflict.resolution
        }))
      };

      console.log(`[ArtifactManager] UC8 detected ${result.conflicts.length} conflicts (types: ${result.conflicts.map(c => c.type).join(', ')})`);
    } else {
      console.warn('[ArtifactManager] UC8 not loaded, falling back to UC1 conflict detection');
      result = this.uc1Engine.detectConflicts(specifications, activeRequirements, activeDomains);
    }

    // Sprint 3 Week 1: DISABLED - Cross-artifact conflicts (user changing mind is allowed)
    // When user provides new value for existing spec, auto-resolve in SemanticIntegrationService
    // const crossConflicts = await this.checkCrossArtifactConflicts();
    // if (crossConflicts.hasConflict) {
    //   result.hasConflict = true;
    //   result.conflicts.push(...crossConflicts.conflicts);
    // }

    // Convert to active conflicts if any found
    if (result.hasConflict) {
      result.conflicts.forEach(conflict => {
        this.addActiveConflict({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conflictingNodes: conflict.nodes,
          type: conflict.type as any,
          description: conflict.description,
          resolutionOptions: this.generateResolutionOptions(conflict),
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

  /**
   * Check for cross-artifact conflicts (mapped vs respec)
   * Sprint 3 Week 1: Detects user attempts to override existing validated specs
   */
  private async checkCrossArtifactConflicts(): Promise<ConflictResult> {
    const result: ConflictResult = {
      hasConflict: false,
      conflicts: []
    };

    if (!this.state.initialized) return result;

    // Collect all specs from mapped artifact
    const mappedSpecs = new Map<string, any>();
    Object.values(this.state.mapped.domains).forEach(domain => {
      Object.values(domain.requirements).forEach(requirement => {
        Object.values(requirement.specifications).forEach(spec => {
          mappedSpecs.set(spec.id, spec);
        });
      });
    });

    // Collect all specs from respec artifact
    const respecSpecs = new Map<string, any>();
    Object.values(this.state.respec.domains).forEach(domain => {
      Object.values(domain.requirements).forEach(requirement => {
        Object.values(requirement.specifications).forEach(spec => {
          respecSpecs.set(spec.id, spec);
        });
      });
    });

    // Compare: Check if mapped specs conflict with respec specs
    mappedSpecs.forEach((mappedSpec, specId) => {
      const respecSpec = respecSpecs.get(specId);

      if (respecSpec) {
        // Spec exists in both artifacts - check for value conflict
        if (mappedSpec.value !== respecSpec.value) {
          result.hasConflict = true;
          result.conflicts.push({
            type: 'cross-artifact',
            nodes: [specId],
            description: `Attempting to override existing specification. Current value: "${respecSpec.value}", new value: "${mappedSpec.value}"`,
            resolution: `Choose: (A) Keep existing value "${respecSpec.value}", or (B) Replace with new value "${mappedSpec.value}"`
          });
        }
      }
    });

    console.log(`[ArtifactManager] Cross-artifact conflict check: ${result.conflicts.length} conflicts found`);
    return result;
  }

  /**
   * Auto-resolve cross-artifact conflicts by accepting new values (user changing their mind)
   * Sprint 3 FIX: When user provides new value for existing spec, treat as intentional override
   */
  async autoResolveCrossArtifactConflicts(): Promise<{ resolved: number; specs: string[] }> {
    const resolvedSpecs: string[] = [];

    if (!this.state.initialized) {
      return { resolved: 0, specs: [] };
    }

    // Collect all specs from mapped artifact
    const mappedSpecs = new Map<string, any>();
    const mappedSpecLocations = new Map<string, { domainId: string; reqId: string }>();

    Object.entries(this.state.mapped.domains).forEach(([domainId, domain]) => {
      Object.entries(domain.requirements).forEach(([reqId, requirement]) => {
        Object.values(requirement.specifications).forEach(spec => {
          mappedSpecs.set(spec.id, spec);
          mappedSpecLocations.set(spec.id, { domainId, reqId });
        });
      });
    });

    // Collect all specs from respec artifact
    const respecSpecs = new Map<string, any>();
    const respecSpecLocations = new Map<string, { domainId: string; reqId: string }>();

    Object.entries(this.state.respec.domains).forEach(([domainId, domain]) => {
      Object.entries(domain.requirements).forEach(([reqId, requirement]) => {
        Object.values(requirement.specifications).forEach(spec => {
          respecSpecs.set(spec.id, spec);
          respecSpecLocations.set(spec.id, { domainId, reqId });
        });
      });
    });

    // Find and resolve conflicts (new value overwrites old value)
    for (const [specId, mappedSpec] of mappedSpecs.entries()) {
      const respecSpec = respecSpecs.get(specId);

      if (respecSpec && mappedSpec.value !== respecSpec.value) {
        console.log(`[ArtifactManager] 🔄 Auto-resolving cross-artifact conflict: ${specId}`);
        console.log(`   Old value (respec): "${respecSpec.value}"`);
        console.log(`   New value (mapped): "${mappedSpec.value}"`);

        // Remove old spec from respec
        const respecLoc = respecSpecLocations.get(specId);
        if (respecLoc) {
          const respecDomain = this.state.respec.domains[respecLoc.domainId];
          const respecReq = respecDomain?.requirements[respecLoc.reqId];
          if (respecReq?.specifications[specId]) {
            delete respecReq.specifications[specId];
            console.log(`   ✓ Removed old spec from respec`);
          }
        }

        // Move new spec from mapped to respec
        const mappedLoc = mappedSpecLocations.get(specId);
        if (mappedLoc) {
          // Ensure domain and requirement exist in respec
          if (!this.state.respec.domains[mappedLoc.domainId]) {
            this.state.respec.domains[mappedLoc.domainId] = { id: mappedLoc.domainId, name: '', requirements: {} };
          }
          const respecDomain = this.state.respec.domains[mappedLoc.domainId];

          if (!respecDomain.requirements[mappedLoc.reqId]) {
            respecDomain.requirements[mappedLoc.reqId] = { id: mappedLoc.reqId, name: '', specifications: {} };
          }

          // Add new spec to respec
          respecDomain.requirements[mappedLoc.reqId].specifications[specId] = { ...mappedSpec };

          // Remove from mapped
          const mappedDomain = this.state.mapped.domains[mappedLoc.domainId];
          const mappedReq = mappedDomain?.requirements[mappedLoc.reqId];
          if (mappedReq?.specifications[specId]) {
            delete mappedReq.specifications[specId];
          }

          console.log(`   ✓ Moved new spec to respec`);
          resolvedSpecs.push(specId);
        }
      }
    }

    // Clear cross-artifact conflicts from active conflicts
    const originalCount = this.state.conflicts.active.length;
    this.state.conflicts.active = this.state.conflicts.active.filter(
      conflict => conflict.type !== 'cross_artifact' || !resolvedSpecs.includes(conflict.nodes[0])
    );
    const clearedCount = originalCount - this.state.conflicts.active.length;

    if (resolvedSpecs.length > 0) {
      console.log(`[ArtifactManager] ✅ Auto-resolved ${resolvedSpecs.length} cross-artifact conflicts: ${resolvedSpecs.join(', ')}`);
      console.log(`[ArtifactManager] ✅ Cleared ${clearedCount} active conflicts`);

      // Emit event for form update
      this.emit('specifications_moved', {
        from: 'mapped',
        to: 'respec',
        specIds: resolvedSpecs,
        reason: 'cross-artifact-auto-resolve'
      });
    }

    return { resolved: resolvedSpecs.length, specs: resolvedSpecs };
  }

  private generateResolutionOptions(conflict: any): any[] {
    // Sprint 2: Check if UC8 conflict data is available
    const conflictKey = conflict.nodes.sort().join('|');
    const uc8Conflict = this.uc8ConflictData.get(conflictKey);

    if (uc8Conflict && uc8Conflict.resolutionOptions) {
      console.log(`[ArtifactManager] Using UC8 resolution options for conflict: ${conflictKey}`);
      return uc8Conflict.resolutionOptions;
    }

    // Fallback to UC1-style resolution options
    if (conflict.resolution) {
      return [
        {
          id: 'option-a',
          description: 'High performance with grid power (35-65W)',
          action: 'select_option_a',
          targetNodes: conflict.nodes,
          expectedOutcome: 'High performance processor with adequate power supply'
        },
        {
          id: 'option-b',
          description: 'Lower performance optimized for battery operation (10-20W)',
          action: 'select_option_b',
          targetNodes: conflict.nodes,
          expectedOutcome: 'Battery-optimized configuration with lower performance'
        }
      ];
    }

    return [];
  }

  private addActiveConflict(conflict: ActiveConflict): void {
    this.state.conflicts.active.push(conflict);
    this.state.conflicts.metadata.activeCount++;
    this.state.conflicts.metadata.lastModified = new Date();

    console.log(`[ArtifactManager] Added active conflict: ${conflict.id}`);
    this.emit('conflict_detected', { conflict });
  }

  // ============= CONFLICT RESOLUTION =============

  async resolveConflict(conflictId: string, resolutionId: string): Promise<void> {
    const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const conflict = this.state.conflicts.active[conflictIndex];
    const resolution = conflict.resolutionOptions.find(r => r.id === resolutionId);
    if (!resolution) {
      throw new Error(`Resolution ${resolutionId} not found for conflict ${conflictId}`);
    }

    // Apply resolution to conflicting nodes
    await this.applyConflictResolution(conflict, resolution);

    // Move conflict to resolved
    const resolvedConflict = {
      ...conflict,
      resolvedAt: new Date(),
      resolution,
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

    console.log(`[ArtifactManager] Resolved conflict: ${conflictId}`);

    // Sprint 3: After conflict resolved, move non-conflicting specs from MAPPED to RESPEC
    // This triggers the normal flow: MAPPED → RESPEC → Form heals from RESPEC
    await this.moveNonConflictingToRespec();

    this.emit('conflict_resolved', { conflictId, resolutionId });
  }

  /**
   * Increment conflict cycle count
   * Sprint 3 Week 2: Track resolution attempts
   */
  incrementConflictCycle(conflictId: string): void {
    const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) {
      console.warn(`[ArtifactManager] Conflict ${conflictId} not found for cycle increment`);
      return;
    }

    const conflict = this.state.conflicts.active[conflictIndex];
    conflict.cycleCount++;
    conflict.lastUpdated = new Date();

    console.log(`[ArtifactManager] Conflict ${conflictId} cycle count: ${conflict.cycleCount}`);

    // Check for escalation threshold
    if (conflict.cycleCount >= 3) {
      console.warn(`[ArtifactManager] ⚠️  Conflict ${conflictId} reached max cycles (3) - escalating`);
      this.escalateConflict(conflictId);
    }
  }

  /**
   * Escalate conflict after max cycles
   * Sprint 3 Week 2: Auto-resolution or skip
   */
  private escalateConflict(conflictId: string): void {
    const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) return;

    const conflict = this.state.conflicts.active[conflictIndex];

    // Move to escalated list
    const escalatedConflict = {
      ...conflict,
      escalatedAt: new Date(),
      escalationReason: 'Max resolution cycles reached (3)'
    };

    this.state.conflicts.escalated.push(escalatedConflict);
    this.state.conflicts.active.splice(conflictIndex, 1);
    this.state.conflicts.metadata.activeCount--;
    this.state.conflicts.metadata.escalatedCount = (this.state.conflicts.metadata.escalatedCount || 0) + 1;

    console.log(`[ArtifactManager] Conflict ${conflictId} escalated to manual review`);

    // Unblock system if no more active conflicts
    if (this.state.conflicts.active.length === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = 'CLEARING';
      this.state.conflicts.metadata.systemBlocked = false;
      this.state.conflicts.metadata.blockingConflicts = [];

      console.log(`[ArtifactManager] ✅ All active conflicts resolved or escalated - system unblocked`);
    }

    this.emit('conflict_escalated', { conflictId, reason: 'max_cycles' });
  }

  /**
   * Apply conflict resolution with surgical precision
   * Sprint 3 Week 1: Full implementation with safety policies
   */
  private async applyConflictResolution(conflict: ActiveConflict, resolution: any): Promise<void> {
    console.log(`[ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`);

    // ========== PRE-VALIDATION ==========
    if (!resolution.targetNodes || resolution.targetNodes.length === 0) {
      throw new Error(`[Resolution] Resolution ${resolution.id} must specify targetNodes`);
    }

    // Verify all target nodes exist in mapped artifact
    for (const nodeId of resolution.targetNodes) {
      const spec = this.findSpecificationInMapped(nodeId);
      if (!spec) {
        throw new Error(
          `[Resolution] Node ${nodeId} not found in mapped artifact - cannot resolve. ` +
          `This conflict may have already been resolved or the artifact state is corrupted.`
        );
      }
    }

    // ========== DETERMINE WINNING/LOSING SPECS ==========
    let losingSpecs: string[] = [];
    let winningSpecs: string[] = [];

    // Parse resolution action
    if (resolution.id === 'option-a') {
      // Option A: Keep first conflicting node, remove others
      winningSpecs = [conflict.conflictingNodes[0]];
      losingSpecs = conflict.conflictingNodes.slice(1);
    } else if (resolution.id === 'option-b') {
      // Option B: Keep second conflicting node, remove others
      winningSpecs = [conflict.conflictingNodes[1]];
      losingSpecs = conflict.conflictingNodes.slice(0, 1).concat(conflict.conflictingNodes.slice(2));
    } else {
      throw new Error(`[Resolution] Unknown resolution option: ${resolution.id}`);
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
  }

  /**
   * Find specification in any artifact (public for user-selection preservation)
   * Sprint 3 Week 1: Helper for preservation checks
   */
  findSpecificationInArtifact(artifactName: 'mapped' | 'respec', specId: string): any | null {
    const artifact = artifactName === 'mapped' ? this.state.mapped : this.state.respec;

    for (const domain of Object.values(artifact.domains)) {
      for (const requirement of Object.values(domain.requirements)) {
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
    // SPRINT 3 FIX: Use UCDataLayer for hierarchy instead of UC1ValidationEngine
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

    const domain = parentScenarios[0].id; // Scenario ID (S##)
    const requirement = reqId; // Requirement ID (R##)

    // Ensure domain structure exists
    // SPRINT 3 FIX: Get scenario from UCDataLayer instead of UC1Engine
    if (!this.state.mapped.domains[domain]) {
      const uc8Scenario = ucDataLayer.getScenario(domain);
      if (!uc8Scenario) {
        console.error(`[Rollback] UC8 scenario ${domain} not found`);
        return;
      }
      this.state.mapped.domains[domain] = {
        id: domain,
        name: uc8Scenario.name,
        uc1Source: uc8Scenario as any,
        requirements: {}
      };
    }

    // Ensure requirement structure exists
    // SPRINT 3 FIX: Get requirement from UCDataLayer
    if (!this.state.mapped.domains[domain].requirements[requirement]) {
      const uc8Requirement = ucDataLayer.getRequirement(requirement);
      if (!uc8Requirement) {
        console.error(`[Rollback] UC8 requirement ${requirement} not found`);
        return;
      }
      this.state.mapped.domains[domain].requirements[requirement] = {
        id: requirement,
        name: uc8Requirement.name,
        uc1Source: uc8Requirement as any,
        specifications: {}
      };
    }

    this.state.mapped.domains[domain].requirements[requirement].specifications[specId] = specBackup;
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

    Object.values(this.state.mapped.domains).forEach(domain => {
      Object.values(domain.requirements).forEach(requirement => {
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

  private addSpecificationToRespec(spec: UC1ArtifactSpecification): void {
    // SPRINT 3 FIX: Use UCDataLayer for hierarchy instead of UC1ValidationEngine
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

    const domainId = parentScenarios[0].id; // Scenario ID (S##)

    // Ensure structure exists in respec
    if (!this.state.respec.domains[domainId]) {
      const mappedDomain = this.state.mapped.domains[domainId];
      if (mappedDomain) {
        this.state.respec.domains[domainId] = {
          id: domainId,
          name: mappedDomain.name,
          uc1Source: mappedDomain.uc1Source,
          requirements: {}
        };
      }
    }

    if (!this.state.respec.domains[domainId].requirements[reqId]) {
      const mappedRequirement = this.state.mapped.domains[domainId]?.requirements[reqId];
      if (mappedRequirement) {
        this.state.respec.domains[domainId].requirements[reqId] = {
          id: reqId,
          name: mappedRequirement.name,
          uc1Source: mappedRequirement.uc1Source,
          specifications: {}
        };
      }
    }

    // Add specification
    this.state.respec.domains[domainId].requirements[reqId].specifications[spec.id] = {
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
    for (const domain of Object.values(this.state.mapped.domains)) {
      for (const requirement of Object.values(domain.requirements)) {
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
        domains: Object.keys(this.state.respec.domains).length,
        totalNodes: this.state.respec.metadata.totalNodes
      },
      mapped: {
        domains: Object.keys(this.state.mapped.domains).length,
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
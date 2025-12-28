/**
 * ArtifactManager - Central management for multi-artifact state
 *
 * Manages the four-artifact system:
 * 1. Operations on artifacts (add, remove, move, merge)
 * 2. State synchronization between artifacts
 * 3. Conflict detection and resolution coordination
 * 4. Integration with existing requirements state (compatibility layer)
 */

// TODO zeev to fix type issues

import {
  ArtifactState,
  UCArtifactSpecification,
  ActiveConflict,
  createEmptyArtifactState,
  DependencyContext,
  Source,
  SpecificationId,
} from "../types/ArtifactTypes";

// Sprint 1: Import UC8 Data Layer (full integration in Sprint 2)
import { ucDataLayer } from "./DataLayer";
import type {
  UCSpecification,
  ConflictResult,
  Maybe,
  Conflict,
  ConflictType,
  ResolutionOption,
} from "../types/UCDataTypes";
import { conflictResolver } from "./ConflictResolver";
import type { EnhancedFormUpdate } from "../types/GenericServiceTypes";

type FormRequirements = Record<
  string,
  Record<string, { value?: unknown; isComplete?: boolean }>
>;

// ============= MAIN ARTIFACT MANAGER =============

export class ArtifactManager {
  private state: ArtifactState;
  private listeners: Map<string, () => void> = new Map();
  // Sprint 2: Store UC8 conflict data for resolution options
  private conflictData: Map<string, Conflict> = new Map();

  constructor() {
    this.state = createEmptyArtifactState();
  }

  private DEPENDENCY_DEPTH_LIMIT = 10;

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    if (!ucDataLayer.isLoaded()) {
      throw new Error("ucDataLayer must be initialized before ArtifactManager");
    }

    this.state.initialized = true;

    console.log("[ArtifactManager] Initialized with ucDataLayer");
    // this.emit("initialized", { state: this.getState() });
  }

  // ============= STATE ACCESS =============

  getState(): ArtifactState {
    this.pruneInactiveConflicts();
    return { ...this.state };
  }

  // getRespecArtifact(): RespecArtifact {
  //   // Unused in refactored flow; keep for future inspection tooling.
  //   return { ...this.state.respec };
  // }

  // getMappedArtifact(): MappedArtifact {
  //   // Unused in refactored flow; keep for future inspection tooling.
  //   return { ...this.state.mapped };
  // }

  // getUnmappedList(): UnmappedList {
  //   // Unused in refactored flow; keep for future inspection tooling.
  //   return { ...this.state.unmapped };
  // }

  // getConflictList(): ConflictList {
  //   return { ...this.state.conflicts };
  // }

  // isSystemBlocked(): boolean {
  //   // Unused in refactored flow; keep for future UI status hooks.
  //   return (
  //     this.state.priorityQueue.blocked ||
  //     this.state.conflicts.metadata.systemBlocked
  //   );
  // }

  // getBlockingReason(): string | undefined {
  //   if (this.state.conflicts.metadata.systemBlocked) {
  //     return `Active conflicts: ${this.state.conflicts.metadata.blockingConflicts.join(
  //       ", "
  //     )}`;
  //   }
  //   return this.state.priorityQueue.blockReason;
  // }

  // ============= SPECIFICATION OPERATIONS =============

  async addSpecificationToMapped(
    spec: UCSpecification,
    value: unknown,
    originalRequest: string,
    substitutionNote: string,
    source: Source,
    dependencyContext?: DependencyContext,
  ): Promise<void> {
    if (!this.state.initialized)
      throw new Error("ArtifactManager not initialized");

    console.log(`[addSpecificationToMapped] started for ${spec.id}`, {
      state: this.state,
      spec,
      originalRequest,
      substitutionNote,
      source,
      dependencyContext,
    });

    const visited = dependencyContext?.visited ?? new Set<SpecificationId>();
    if (!visited.has(spec.id)) visited.add(spec.id);

    const isDependency = !!dependencyContext?.parentSpecId;

    const artifactSpec: UCArtifactSpecification = {
      id: spec.id,
      name: spec.name,
      value,
      ucSource: spec,
      attribution: isDependency ? "assumption" : "requirement",
      confidence: 1.0,
      source: isDependency ? "dependency" : source || "llm",
      originalRequest,
      substitutionNote,
      timestamp: new Date(),
      dependencyOf: dependencyContext?.parentSpecId,
    };

    this.state.mapped.specifications[spec.id] = artifactSpec;
    this.updateArtifactMetrics("mapped");

    console.log(
      `[ArtifactManager] Added specification ${
        spec.id
      } to mapped artifact (source: ${source || "user"})`,
    );

    await this.fillSpecificationDependencies(
      spec,
      visited,
      dependencyContext?.depth ?? 0,
    );

    const shouldCheckConflicts = !isDependency && source === "user";
    if (shouldCheckConflicts) {
      this.detectConflictsForSpecification(spec.id);
    }

    console.log(`[addSpecificationToMapped] finished for ${spec.id}`, {
      state: this.state,
    });
  }

  private async fillSpecificationDependencies(
    spec: UCSpecification,
    visited: Set<SpecificationId>,
    depth: number = 0,
  ): Promise<void> {
    if (!spec.requires) return;

    if (depth > this.DEPENDENCY_DEPTH_LIMIT) {
      console.warn(
        `[ArtifactManager] Dependency depth exceeded for ${spec.id} (depth=${depth})`,
      );
      return;
    }

    const dependencyLists = Object.values(spec.requires);
    if (!dependencyLists.length) return;

    for (const dependencyIds of dependencyLists) {
      if (!Array.isArray(dependencyIds)) continue;

      for (const dependencyId of dependencyIds) {
        if (!dependencyId) continue;
        if (visited.has(dependencyId)) continue;
        visited.add(dependencyId);

        const dependencySpec = ucDataLayer.getSpecification(dependencyId);
        if (!dependencySpec) {
          console.warn(
            `[ArtifactManager] Dependency spec id ${dependencyId} not found`,
          );
          continue;
        }

        if (this.state.mapped.specifications[dependencyId]) {
          await this.fillSpecificationDependencies(
            dependencySpec,
            visited,
            depth + 1,
          );
          continue;
        }

        const dependencyValue =
          dependencySpec?.selected_value || dependencySpec.name;
        if (!dependencyValue) {
          console.warn("[ArtifactManager] No default value for dependency ");
          continue;
        }

        await this.addSpecificationToMapped(
          dependencySpec,
          dependencyValue,
          "Auto-added as dependency of",
          `${dependencySpec.field_name} "${dependencySpec.name}" required by ${spec.field_name} "${spec.name}"`,
          "dependency",
          {
            parentSpecId: spec.id,
            visited,
            depth: depth + 1,
          },
        );
      }
    }
  }

  // ============= CONFLICT DETECTION =============

  private getCurrentSpecificationIds(): SpecificationId[] {
    return [
      ...Object.keys(this.state.mapped.specifications),
      ...Object.keys(this.state.respec.specifications),
    ];
  }

  private registerConflicts(conflicts: Conflict[]): ConflictResult {
    const result: ConflictResult = {
      hasConflict: conflicts.length > 0,
      conflicts,
    };

    if (!result.hasConflict) {
      return result;
    }

    conflicts.forEach((conflict) => {
      this.addActiveConflict({
        id: conflict.id,
        affectedNodes: conflict.affectedNodes,
        type: conflict.type as ConflictType,
        description: conflict.description,
        resolutionOptions: conflict.resolutionOptions || [],
        cycleCount: 0,
        firstDetected: new Date(),
        lastUpdated: new Date(),
      });
    });

    this.state.priorityQueue.blocked = true;
    this.state.priorityQueue.blockReason = `${this.state.conflicts.active.length} conflict(s) detected`;
    this.state.priorityQueue.currentPriority = "CONFLICTS";

    this.state.conflicts.metadata.systemBlocked = true;
    this.state.conflicts.metadata.blockingConflicts = Array.from(
      new Set(this.state.conflicts.active.flatMap((c) => c.affectedNodes)),
    );

    return result;
  }

  private detectConflictsForSpecification(
    specId: SpecificationId,
  ): ConflictResult {
    if (!this.state.initialized || !ucDataLayer.isLoaded()) {
      return { hasConflict: false, conflicts: [] };
    }

    const otherSpecs = this.getCurrentSpecificationIds().filter(
      (id) => id !== specId,
    );

    const allConflicts = conflictResolver.detectAllConflictsForSpecification(
      specId,
      otherSpecs,
    );

    const uniqueConflicts = new Map<string, Conflict>();
    allConflicts.forEach((conflict) => {
      if (!uniqueConflicts.has(conflict.key)) {
        uniqueConflicts.set(conflict.key, conflict);
      }
      this.conflictData.set(conflict.key, conflict);
    });

    return this.registerConflicts(Array.from(uniqueConflicts.values()));
  }

  async detectExclusionConflicts(): Promise<ConflictResult> {
    console.warn("[ArtifactManager] detectExclusionConflicts started");

    if (!this.state.initialized || !ucDataLayer.isLoaded()) {
      return { hasConflict: false, conflicts: [] };
    }

    const specIds = this.getCurrentSpecificationIds();

    // Check for conflicts among current selections
    const allConflicts = new Map<string, Conflict>(); // Use map to deduplicate

    // For each spec, check if it conflicts with all others
    for (let i = 0; i < specIds.length; i++) {
      const checkSpec = specIds[i];
      const otherSpecs = specIds.filter((_, idx) => idx !== i);

      // Use conflictResolver to get conflicts with resolution options
      const conflicts = conflictResolver.detectAllConflictsForSpecification(
        checkSpec,
        otherSpecs,
      );

      conflicts.forEach((conflict) => {
        // Create unique key for this conflict pair (sorted to avoid duplicates)
        if (!allConflicts.has(conflict.key)) {
          allConflicts.set(conflict.key, conflict);
        }
      });
    }

    // Convert conflicts to ConflictResult format
    const conflictList = Array.from(allConflicts.values());

    // Store conflict data for later resolution option generation
    this.conflictData.clear();
    conflictList.forEach((conflict) =>
      this.conflictData.set(conflict.key, conflict),
    );

    const result = this.registerConflicts(conflictList);

    console.log(
      `[ArtifactManager] detectExclusionConflicts detected ${
        result.conflicts.length
      } conflicts (types: ${result.conflicts.map((c) => c.type).join(", ")})`,
    );

    return result;
  }

  /**
   * Check for cross-artifact conflicts (mapped vs respec)
   * Sprint 3 Week 1: Detects user attempts to override existing validated specs
   */
  // private async checkCrossArtifactConflicts(): Promise<ConflictResult> {
  //   const result: ConflictResult = {
  //     hasConflict: false,
  //     conflicts: [],
  //   };

  //   if (!this.state.initialized) return result;

  //   // Collect all specs from mapped artifact
  //   const mappedSpecs = new Map<string, any>();
  //   Object.values(this.state.mapped.domains).forEach((domain) => {
  //     Object.values(domain.requirements).forEach((requirement) => {
  //       Object.values(requirement.specifications).forEach((spec) => {
  //         mappedSpecs.set(spec.id, spec);
  //       });
  //     });
  //   });

  //   // Collect all specs from respec artifact
  //   const respecSpecs = new Map<string, any>();
  //   Object.values(this.state.respec.domains).forEach((domain) => {
  //     Object.values(domain.requirements).forEach((requirement) => {
  //       Object.values(requirement.specifications).forEach((spec) => {
  //         respecSpecs.set(spec.id, spec);
  //       });
  //     });
  //   });

  //   // Compare: Check if mapped specs conflict with respec specs
  //   mappedSpecs.forEach((mappedSpec, specId) => {
  //     const respecSpec = respecSpecs.get(specId);

  //     if (respecSpec) {
  //       // Spec exists in both artifacts - check for value conflict
  //       if (mappedSpec.value !== respecSpec.value) {
  //         result.hasConflict = true;
  //         result.conflicts.push({
  //           type: "cross_artifact",
  //           nodes: [specId],
  //           description: `Attempting to override existing specification. Current value: "${respecSpec.value}", new value: "${mappedSpec.value}"`,
  //           resolution: `Choose: (A) Keep existing value "${respecSpec.value}", or (B) Replace with new value "${mappedSpec.value}"`,
  //         });
  //       }
  //     }
  //   });

  //   console.log(
  //     `[ArtifactManager] Cross-artifact conflict check: ${result.conflicts.length} conflicts found`
  //   );
  //   return result;
  // }

  /**
   * Auto-resolve cross-artifact conflicts by accepting new values (user changing their mind)
   * Sprint 3 FIX: When user provides new value for existing spec, treat as intentional override
   */
  // async autoResolveCrossArtifactConflicts(): Promise<{
  //   resolved: number;
  //   specs: string[];
  // }> {
  //   const resolvedSpecs: string[] = [];

  //   if (!this.state.initialized) {
  //     return { resolved: 0, specs: [] };
  //   }

  //   // Collect all specs from mapped artifact
  //   const mappedSpecs = new Map<string, any>();
  //   const mappedSpecLocations = new Map<
  //     string,
  //     { domainId: string; reqId: string }
  //   >();

  //   Object.entries(this.state.mapped.domains).forEach(([domainId, domain]) => {
  //     Object.entries(domain.requirements).forEach(([reqId, requirement]) => {
  //       Object.values(requirement.specifications).forEach((spec) => {
  //         mappedSpecs.set(spec.id, spec);
  //         mappedSpecLocations.set(spec.id, { domainId, reqId });
  //       });
  //     });
  //   });

  //   // Collect all specs from respec artifact
  //   const respecSpecs = new Map<string, any>();
  //   const respecSpecLocations = new Map<
  //     string,
  //     { domainId: string; reqId: string }
  //   >();

  //   Object.entries(this.state.respec.domains).forEach(([domainId, domain]) => {
  //     Object.entries(domain.requirements).forEach(([reqId, requirement]) => {
  //       Object.values(requirement.specifications).forEach((spec) => {
  //         respecSpecs.set(spec.id, spec);
  //         respecSpecLocations.set(spec.id, { domainId, reqId });
  //       });
  //     });
  //   });

  //   // Find and resolve conflicts (new value overwrites old value)
  //   for (const [specId, mappedSpec] of mappedSpecs.entries()) {
  //     const respecSpec = respecSpecs.get(specId);

  //     if (respecSpec && mappedSpec.value !== respecSpec.value) {
  //       console.log(
  //         `[ArtifactManager] 🔄 Auto-resolving cross-artifact conflict: ${specId}`
  //       );
  //       console.log(`   Old value (respec): "${respecSpec.value}"`);
  //       console.log(`   New value (mapped): "${mappedSpec.value}"`);

  //       // Remove old spec from respec
  //       const respecLoc = respecSpecLocations.get(specId);
  //       if (respecLoc) {
  //         const respecDomain = this.state.respec.domains[respecLoc.domainId];
  //         const respecReq = respecDomain?.requirements[respecLoc.reqId];
  //         if (respecReq?.specifications[specId]) {
  //           delete respecReq.specifications[specId];
  //           console.log(`   ✓ Removed old spec from respec`);
  //         }
  //       }

  //       // Move new spec from mapped to respec
  //       const mappedLoc = mappedSpecLocations.get(specId);
  //       if (mappedLoc) {
  //         // Ensure domain and requirement exist in respec
  //         if (!this.state.respec.domains[mappedLoc.domainId]) {
  //           this.state.respec.domains[mappedLoc.domainId] = {
  //             id: mappedLoc.domainId,
  //             name: "",
  //             requirements: {},
  //           };
  //         }
  //         const respecDomain = this.state.respec.domains[mappedLoc.domainId];

  // if (!respecDomain.requirements[mappedLoc.reqId]) {
  //   respecDomain.requirements[mappedLoc.reqId] = {
  //     id: mappedLoc.reqId,
  //     name: "",
  //     specifications: {},
  //   };
  // }

  //         // Add new spec to respec
  //         respecDomain.requirements[mappedLoc.reqId].specifications[specId] = {
  //           ...mappedSpec,
  //         };

  //         // Remove from mapped
  //         const mappedDomain = this.state.mapped.domains[mappedLoc.domainId];
  //         const mappedReq = mappedDomain?.requirements[mappedLoc.reqId];
  //         if (mappedReq?.specifications[specId]) {
  //           delete mappedReq.specifications[specId];
  //         }

  //         console.log(`   ✓ Moved new spec to respec`);
  //         resolvedSpecs.push(specId);
  //       }
  //     }
  //   }

  //   // Clear cross-artifact conflicts from active conflicts
  //   const originalCount = this.state.conflicts.active.length;
  //   this.state.conflicts.active = this.state.conflicts.active.filter(
  //     (conflict) =>
  //       conflict.type !== "cross_artifact" ||
  //       !resolvedSpecs.includes(conflict.nodes[0])
  //   );
  //   const clearedCount = originalCount - this.state.conflicts.active.length;

  //   if (resolvedSpecs.length > 0) {
  //     console.log(
  //       `[ArtifactManager] ✅ Auto-resolved ${
  //         resolvedSpecs.length
  //       } cross-artifact conflicts: ${resolvedSpecs.join(", ")}`
  //     );
  //     console.log(
  //       `[ArtifactManager] ✅ Cleared ${clearedCount} active conflicts`
  //     );

  //     // Emit event for form update
  //     // this.emit("specifications_moved", {
  //     //   from: "mapped",
  //     //   to: "respec",
  //     //   specIds: resolvedSpecs,
  //     //   reason: "cross-artifact-auto-resolve",
  //     // });
  //   }

  //   return { resolved: resolvedSpecs.length, specs: resolvedSpecs };
  // }

  private addActiveConflict(conflict: ActiveConflict): void {
    const signature = this.getConflictSignature(conflict);
    const exists = this.state.conflicts.active.some(
      (c) => this.getConflictSignature(c) === signature,
    );
    if (exists) {
      console.log(
        `[ArtifactManager] Skipping duplicate conflict for signature ${signature}`,
      );
      return;
    }

    this.state.conflicts.active.push(conflict);
    this.state.conflicts.metadata.activeCount =
      this.state.conflicts.active.length;
    this.state.conflicts.metadata.lastModified = new Date();
    this.state.conflicts.metadata.blockingConflicts = Array.from(
      new Set([
        ...this.state.conflicts.metadata.blockingConflicts,
        ...conflict.affectedNodes,
      ]),
    );

    console.log(`[ArtifactManager] Added active conflict: ${conflict.id}`);
    // this.emit("conflict_detected", { conflict });
  }

  // ============= CONFLICT RESOLUTION =============

  async resolveConflict(
    conflictId: string,
    resolutionId: string,
  ): Promise<void> {
    const conflictIndex = this.state.conflicts.active.findIndex(
      (c) => c.id === conflictId,
    );
    if (conflictIndex === -1) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const conflict = this.state.conflicts.active[conflictIndex];
    const resolution = conflict.resolutionOptions.find(
      (r) => r.id === resolutionId,
    );
    if (!resolution) {
      throw new Error(
        `Resolution ${resolutionId} not found for conflict ${conflictId}`,
      );
    }

    // Apply resolution to conflicting nodes
    await this.applyConflictResolution(conflict, resolution);

    // Move conflict to resolved
    const resolvedConflict = {
      ...conflict,
      resolvedAt: new Date(),
      resolution,
      resolvedBy: "user" as const,
    };

    this.state.conflicts.resolved.push(resolvedConflict);
    this.state.conflicts.active.splice(conflictIndex, 1);

    // Remove any other active conflicts with the same signature to avoid loops on identical pairs
    const resolvedSignature = this.getConflictSignature(conflict);
    this.state.conflicts.active = this.state.conflicts.active.filter(
      (c) => this.getConflictSignature(c) !== resolvedSignature,
    );

    // Update metadata
    this.state.conflicts.metadata.activeCount =
      this.state.conflicts.active.length;
    this.state.conflicts.metadata.resolvedCount++;
    this.state.conflicts.metadata.blockingConflicts = Array.from(
      new Set(this.state.conflicts.active.flatMap((c) => c.affectedNodes)),
    );

    // Unblock system if no more active conflicts
    if (this.state.conflicts.active.length === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "CLEARING";

      this.state.conflicts.metadata.systemBlocked = false;
      this.state.conflicts.metadata.blockingConflicts = [];
    }

    console.log(`[ArtifactManager] Resolved conflict: ${conflictId}`);

    // Sprint 3: After conflict resolved, move non-conflicting specs from MAPPED to RESPEC
    // This triggers the normal flow: MAPPED → RESPEC → Form heals from RESPEC
    await this.moveNonConflictingToRespec();

    // this.emit("conflict_resolved", { conflictId, resolutionId });
  }

  /**
   * Increment conflict cycle count
   * Sprint 3 Week 2: Track resolution attempts
   */
  incrementConflictCycle(conflictId: string): void {
    const conflictIndex = this.state.conflicts.active.findIndex(
      (c) => c.id === conflictId,
    );
    if (conflictIndex === -1) {
      console.warn(
        `[ArtifactManager] Conflict ${conflictId} not found for cycle increment`,
      );
      return;
    }

    const conflict = this.state.conflicts.active[conflictIndex];
    conflict.cycleCount++;
    conflict.lastUpdated = new Date();

    console.log(
      `[ArtifactManager] Conflict ${conflictId} cycle count: ${conflict.cycleCount}`,
    );

    // Check for escalation threshold
    if (conflict.cycleCount >= 3) {
      console.warn(
        `[ArtifactManager] ⚠️  Conflict ${conflictId} reached max cycles (3) - escalating`,
      );
      this.escalateConflict(conflictId);
    }
  }

  /**
   * Escalate conflict after max cycles
   * Sprint 3 Week 2: Auto-resolution or skip
   */
  private escalateConflict(conflictId: string): void {
    const conflictIndex = this.state.conflicts.active.findIndex(
      (c) => c.id === conflictId,
    );
    if (conflictIndex === -1) return;

    const conflict = this.state.conflicts.active[conflictIndex];

    // Move to escalated list
    const escalatedConflict = {
      ...conflict,
      escalatedAt: new Date(),
      escalationReason: "Max resolution cycles reached (3)",
    };

    this.state.conflicts.escalated.push(escalatedConflict);
    this.state.conflicts.active.splice(conflictIndex, 1);
    this.state.conflicts.metadata.activeCount--;
    this.state.conflicts.metadata.escalatedCount =
      (this.state.conflicts.metadata.escalatedCount || 0) + 1;

    console.log(
      `[ArtifactManager] Conflict ${conflictId} escalated to manual review`,
    );

    // Unblock system if no more active conflicts
    if (this.state.conflicts.active.length === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "CLEARING";
      this.state.conflicts.metadata.systemBlocked = false;
      this.state.conflicts.metadata.blockingConflicts = [];

      console.log(
        `[ArtifactManager] ✅ All active conflicts resolved or escalated - system unblocked`,
      );
    }

    // this.emit("conflict_escalated", { conflictId, reason: "max_cycles" });
  }

  /**
   * Apply conflict resolution with surgical precision
   * Sprint 3 Week 1: Full implementation with safety policies
   */
  private async applyConflictResolution(
    conflict: ActiveConflict,
    resolution: ResolutionOption,
  ): Promise<void> {
    console.log(
      `[ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`,
    );

    const plan = conflictResolver.planResolution(conflict, resolution, {
      findSpecificationWithLocation:
        this.findSpecificationWithLocation.bind(this),
      collectAssumptionDependencies:
        this.collectAssumptionDependencies.bind(this),
    });

    const { winningSpecs, losingSpecs } = plan;

    console.log(`[ArtifactManager] applyConflictResolution`, {
      conflict,
      resolution,
      winningSpecs,
      losingSpecs,
    });

    // ========== ATOMIC REMOVAL (with rollback capability) ==========
    const removedSpecs: Array<{
      id: string;
      backup: UCArtifactSpecification;
      artifact: "mapped" | "respec";
    }> = [];
    const removalPlanned = new Set<string>();

    try {
      // Remove losing specifications
      for (const located of plan.removals) {
        this.planRemoval(
          located.artifact,
          located.spec,
          removedSpecs,
          removalPlanned,
        );
      }

      // Execute removals
      for (const removal of removedSpecs) {
        console.log(
          `[ArtifactManager] Removing spec ${removal.id} (artifact=${removal.artifact}) due to conflict resolution ${resolution.id}`,
        );
        if (removal.artifact === "mapped") {
          this.removeSpecificationFromMapped(removal.id);
        } else {
          this.removeSpecificationFromRespec(removal.id);
        }
      }

      // Log winning specs (no action needed, they stay in mapped)
      for (const specId of winningSpecs) {
        console.log(
          `[ArtifactManager] Keeping spec ${specId} as resolution choice`,
        );
      }

      // ========== POST-RESOLUTION VERIFICATION ==========
      for (const specId of losingSpecs) {
        const stillExists =
          this.findSpecificationInMapped(specId) ||
          this.findSpecificationInRespec(specId);
        if (stillExists) {
          throw new Error(
            `[CRITICAL] Failed to remove ${specId} - data integrity compromised. ` +
              `Rolling back resolution.`,
          );
        }
      }

      for (const specId of winningSpecs) {
        const exists =
          this.findSpecificationInMapped(specId) ||
          this.findSpecificationInRespec(specId);
        if (!exists) {
          throw new Error(
            `[CRITICAL] Winning spec ${specId} disappeared during resolution - ` +
              `data integrity compromised. Rolling back.`,
          );
        }
      }

      // Remove any stale conflicts that reference removed specs
      const removedIds = removedSpecs.map((r) => r.id);
      this.purgeConflictsForNodes(removedIds);
      this.pruneInactiveConflicts();

      console.log(`[ArtifactManager] ✅ Resolution applied successfully`);
    } catch (error) {
      // ========== ROLLBACK ON FAILURE ==========
      console.error(
        `[ArtifactManager] ❌ Resolution failed, rolling back...`,
        error,
      );

      // Restore removed specs
      for (const { id, backup, artifact } of removedSpecs) {
        console.log(`[Rollback] Restoring spec ${id}`);
        this.restoreSpecificationToArtifact(id, backup, artifact);
      }

      throw error;
    }
  }

  /**
   * Find specification in any artifact (public for user-selection preservation)
   * Sprint 3 Week 1: Helper for preservation checks
   */
  findSpecificationInArtifact(
    artifactName: "mapped" | "respec",
    specId: SpecificationId,
  ): Maybe<UCArtifactSpecification> {
    const artifact =
      artifactName === "mapped" ? this.state.mapped : this.state.respec;
    return artifact.specifications[specId] || null;
  }

  /**
   * Find specification in mapped artifact (internal helper)
   * Sprint 3 Week 1: Helper for resolution operations
   */
  private findSpecificationInMapped(
    specId: SpecificationId,
  ): Maybe<UCArtifactSpecification> {
    return this.findSpecificationInArtifact("mapped", specId);
  }

  private findSpecificationInRespec(
    specId: SpecificationId,
  ): Maybe<UCArtifactSpecification> {
    return this.findSpecificationInArtifact("respec", specId);
  }

  private findSpecificationWithLocation(
    specId: SpecificationId,
  ): Maybe<{ artifact: "mapped" | "respec"; spec: UCArtifactSpecification }> {
    const mapped = this.findSpecificationInMapped(specId);
    if (mapped) return { artifact: "mapped", spec: mapped };
    const respec = this.findSpecificationInRespec(specId);
    if (respec) return { artifact: "respec", spec: respec };
    return null;
  }

  /**
   * Restore specification to mapped artifact (for rollback)
   * Sprint 3 Week 1: Helper for rollback operations
   */
  private restoreSpecificationToMapped(
    specId: string,
    specBackup: UCArtifactSpecification,
  ): void {
    this.state.mapped.specifications[specId] = specBackup;
    this.updateArtifactMetrics("mapped");
  }

  private restoreSpecificationToArtifact(
    specId: SpecificationId,
    specBackup: UCArtifactSpecification,
    artifact: "mapped" | "respec" = "mapped",
  ): void {
    const target = artifact || "mapped";
    if (target === "mapped") {
      this.restoreSpecificationToMapped(specId, specBackup);
    } else {
      this.state.respec.specifications[specId] = specBackup;
      this.updateArtifactMetrics("respec");
    }
  }

  // ============= ARTIFACT MOVEMENT =============

  async moveNonConflictingToRespec(): Promise<void> {
    if (!this.state.initialized) {
      return;
    }

    const blocking = new Set(this.state.conflicts.metadata.blockingConflicts);
    const movable: string[] = [];

    Object.values(this.state.mapped.specifications).forEach((spec) => {
      if (!blocking.has(spec.id)) {
        movable.push(spec.id);
      }
    });

    if (movable.length > 0) {
      await this.moveSpecificationsToRespec(movable);
      console.log(
        `[ArtifactManager] Moved ${movable.length} non-conflicting specs to respec`,
      );
    }
  }

  private async moveSpecificationsToRespec(
    specIds: SpecificationId[],
  ): Promise<void> {
    specIds.forEach((specId) => {
      const spec = this.state.mapped.specifications[specId];
      if (spec) {
        this.addSpecificationToRespec(spec);
        this.removeSpecificationFromMapped(specId);
      }
    });
  }

  private addSpecificationToRespec(spec: UCArtifactSpecification): void {
    // TODO here we need to check if new scpecification is for the same ui field we already have
    this.state.respec.specifications[spec.id] = {
      ...spec,
      timestamp: new Date(),
    };
    this.updateArtifactMetrics("respec");
  }

  /**
   * Remove specification from mapped artifact (internal)
   * Used by resolution system and branch management
   */
  private removeSpecificationFromMapped(specId: SpecificationId): void {
    if (this.state.mapped.specifications[specId]) {
      delete this.state.mapped.specifications[specId];
      this.updateArtifactMetrics("mapped");
    }
  }

  private removeSpecificationFromRespec(specId: SpecificationId): void {
    if (this.state.respec.specifications[specId]) {
      delete this.state.respec.specifications[specId];
      this.updateArtifactMetrics("respec");
    }
  }

  private planRemoval(
    artifact: "mapped" | "respec",
    spec: UCArtifactSpecification,
    removedSpecs: Array<{
      id: string;
      backup: UCArtifactSpecification;
      artifact: "mapped" | "respec";
    }>,
    removalPlanned: Set<string>,
  ): void {
    if (removalPlanned.has(spec.id)) return;
    removalPlanned.add(spec.id);
    const backup: UCArtifactSpecification = {
      ...spec,
      timestamp: new Date(spec.timestamp),
    };
    removedSpecs.push({
      id: spec.id,
      backup,
      artifact,
    });
  }

  private collectAssumptionDependencies(rootSpecId: SpecificationId): Array<{
    artifact: "mapped" | "respec";
    spec: UCArtifactSpecification;
  }> {
    const queue: SpecificationId[] = [rootSpecId];
    const dependents: Array<{
      artifact: "mapped" | "respec";
      spec: UCArtifactSpecification;
    }> = [];
    const visited = new Set<SpecificationId>();

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;

      (["mapped", "respec"] as const).forEach((artifactName) => {
        Object.values(this.state[artifactName].specifications).forEach(
          (spec) => {
            if (
              spec.attribution !== "assumption" ||
              spec.dependencyOf !== current
            ) {
              return;
            }
            if (visited.has(spec.id)) return;
            visited.add(spec.id);
            dependents.push({ artifact: artifactName, spec });
            queue.push(spec.id);
          },
        );
      });
    }

    return dependents;
  }

  private getConflictSignature(conflict: ActiveConflict): string {
    return `${conflict.type}:${[...conflict.affectedNodes].sort().join("|")}`;
  }

  /**
   * Remove active conflicts that reference any of the provided node IDs.
   * Keeps conflict list in sync after removals/resolutions to prevent loops.
   */
  private purgeConflictsForNodes(nodeIds: SpecificationId[]): void {
    if (!nodeIds.length) return;
    const targets = new Set(nodeIds);
    const before = this.state.conflicts.active.length;
    if (before === 0) return;

    this.state.conflicts.active = this.state.conflicts.active.filter(
      (conflict) =>
        !conflict.affectedNodes.some((nodeId) => targets.has(nodeId)),
    );

    const after = this.state.conflicts.active.length;
    if (after === before) return;

    this.state.conflicts.metadata.activeCount = after;
    this.state.conflicts.metadata.blockingConflicts = Array.from(
      new Set(this.state.conflicts.active.flatMap((c) => c.affectedNodes)),
    );
    this.state.conflicts.metadata.systemBlocked = after > 0;
    if (after === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "CLEARING";
    }
  }

  /**
   * Remove conflicts that reference specs no longer present in mapped or respec
   * Prevents stale conflicts from re-triggering resolution loops after removals.
   */
  private pruneInactiveConflicts(): void {
    const exists = (id: SpecificationId) =>
      !!this.state.mapped.specifications[id] ||
      !!this.state.respec.specifications[id];

    const before = this.state.conflicts.active.length;
    if (before === 0) return;

    this.state.conflicts.active = this.state.conflicts.active.filter(
      (conflict) => conflict.affectedNodes.some((nodeId) => exists(nodeId)),
    );

    const after = this.state.conflicts.active.length;
    if (after === before) return;

    // Update metadata to reflect pruned conflicts
    this.state.conflicts.metadata.activeCount = after;
    this.state.conflicts.metadata.blockingConflicts = Array.from(
      new Set(
        this.state.conflicts.active.flatMap(
          (conflict) => conflict.affectedNodes,
        ),
      ),
    );
    this.state.conflicts.metadata.systemBlocked = after > 0;

    if (after === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "CLEARING";
    }
  }

  private updateArtifactMetrics(type: "mapped" | "respec"): void {
    const artifact = type === "mapped" ? this.state.mapped : this.state.respec;
    artifact.metadata.totalNodes = Object.keys(artifact.specifications).length;
    artifact.metadata.lastModified = new Date();
  }

  // ============= FORM SYNCHRONIZATION =============

  async syncWithFormState(requirements: FormRequirements): Promise<void> {
    // Compatibility layer: sync new artifact state with existing requirements state
    this.state.respec.metadata.formSyncStatus = "synced";

    Object.entries(requirements).forEach(([_section, fields]) => {
      Object.entries(fields).forEach(([_fieldName, fieldData]) => {
        if (!fieldData.value) return;

        // TODO zeev artifact management implement correct way of working with
      });
    });

    console.log("[ArtifactManager] Synced with form state");
  }

  // ============= VALIDATION =============

  // async validateArtifacts(): Promise<ArtifactValidationResult> {
  //   // Unused in refactored flow; validation is handled elsewhere.
  //   const result: ArtifactValidationResult = {
  //     isValid: true,
  //     errors: [],
  //     warnings: [],
  //     suggestedActions: [],
  //   };
  //
  //   // Validate each artifact
  //   const respecValidation = await this.validateArtifact("respec");
  //   const mappedValidation = await this.validateArtifact("mapped");
  //
  //   result.errors.push(...respecValidation.errors, ...mappedValidation.errors);
  //   result.warnings.push(
  //     ...respecValidation.warnings,
  //     ...mappedValidation.warnings,
  //   );
  //
  //   result.isValid = result.errors.length === 0;
  //
  //   return result;
  // }
  //
  // private async validateArtifact(
  //   _type: "mapped" | "respec",
  // ): Promise<ArtifactValidationResult> {
  //   // Unused in refactored flow; placeholder for future validation policy.
  //   return {
  //     isValid: true,
  //     errors: [],
  //     warnings: [],
  //     suggestedActions: [],
  //   };
  // }

  /**
   * Build form updates from the current respec artifact (post-conflict resolution).
   * Emits updates for every UI field so removals clear the form state.
   */
  generateFormUpdatesFromRespec(): EnhancedFormUpdate[] {
    const formUpdates: EnhancedFormUpdate[] = [];

    const respecArtifact = this.state.respec;

    // Build best-spec-per-field map
    const fieldToSpec: Record<
      string,
      {
        spec: (typeof respecArtifact.specifications)[keyof typeof respecArtifact.specifications];
        selected: string | null;
      }
    > = {};

    Object.values(respecArtifact.specifications).forEach((spec) => {
      const fullSpec = ucDataLayer.getSpecification(spec.id);
      if (!fullSpec || !fullSpec.field_name) return;

      const selectedValue =
        fullSpec.selected_value ??
        (spec.value as string) ??
        fullSpec.name ??
        null;

      const existing = fieldToSpec[fullSpec.field_name];
      if (
        !existing ||
        (spec.confidence || 0) > (existing.spec.confidence || 0)
      ) {
        fieldToSpec[fullSpec.field_name] = {
          spec,
          selected: selectedValue,
        };
      }
    });

    // Emit updates for every known UI field so removals clear the form
    const uiFields = ucDataLayer.getAllUiFields();
    Object.entries(uiFields).forEach(([fieldName, uiField]) => {
      const mapped = fieldToSpec[fieldName];

      if (mapped) {
        const spec = mapped.spec;
        formUpdates.push({
          section: uiField.section,
          field: uiField.field_name,
          value: mapped.selected,
          confidence: spec.confidence || 1.0,
          isAssumption: spec.attribution === "assumption",
          originalRequest: spec.originalRequest,
          substitutionNote: spec.substitutionNote,
        });
      } else {
        formUpdates.push({
          section: uiField.section,
          field: uiField.field_name,
          value: null,
          confidence: 1,
          isAssumption: false,
          originalRequest: "",
          substitutionNote: "Cleared because no specification is selected",
        });
      }
    });

    return formUpdates;
  }

  // ============= UTILITY METHODS =============

  // getCompletionStatus(): { respec: number; mapped: number; total: number } {
  //   // Unused in refactored flow; kept for analytics dashboards.
  //   return {
  //     respec: this.state.respec.metadata.totalNodes,
  //     mapped: this.state.mapped.metadata.totalNodes,
  //     total:
  //       this.state.respec.metadata.totalNodes +
  //       this.state.mapped.metadata.totalNodes,
  //   };
  // }
  //
  // getSystemStatus(): {
  //   blocked: boolean;
  //   priority: ProcessingPriority;
  //   activeConflicts: number;
  //   pendingValidation: number;
  // } {
  //   // Unused in refactored flow; keep for future UI telemetry.
  //   return {
  //     blocked: this.isSystemBlocked(),
  //     priority: this.state.priorityQueue.currentPriority,
  //     activeConflicts: this.state.conflicts.metadata.activeCount,
  //     pendingValidation: this.state.mapped.metadata.pendingValidation.length,
  //   };
  // }
}

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
  RespecArtifact,
  MappedArtifact,
  UnmappedList,
  UCArtifactSpecification,
  ActiveConflict,
  ArtifactValidationResult,
  createEmptyArtifactState,
  ProcessingPriority,
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
} from "../types/UCDataTypes";
import { conflictResolver } from "./ConflictResolver";

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

  // getConflictList(): ConflictList {
  //   return { ...this.state.conflicts };
  // }

  isSystemBlocked(): boolean {
    return (
      this.state.priorityQueue.blocked ||
      this.state.conflicts.metadata.systemBlocked
    );
  }

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

    // TODO zeev conflict - add single specification conflict check

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

    // if (source === "conflict_resolution") {
    // TODO zeev conflict
    //   console.log(
    //     `[ArtifactManager] ??  Skipping conflict detection for ${spec.id} (source: conflict_resolution)`
    //   );
    //   return;
    // }

    if (!isDependency) await this.detectExclusionConflicts();

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
            `[ArtifactManager] Dependency spec id ${dependencyId}  not found`,
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

  async detectExclusionConflicts(): Promise<ConflictResult> {
    // TODO zeev conflict - rewrite
    console.log("[ArtifactManager] detectExclusionConflicts started");
    // return { hasConflict: false, conflicts: [] };

    if (!this.state.initialized || !ucDataLayer.isLoaded()) {
      return { hasConflict: false, conflicts: [] };
    }

    // Collect all specifications from mapped artifact
    // const specifications: Array<{ id: string; value: any }> = [];
    // const activeRequirements: string[] = [];
    // const activeDomains: string[] = [];

    const mappedSpecs = this.state.mapped.specifications;
    // const respecSpecs = this.state.respec.specifications;

    // Object.values(this.state.mapped.domains).forEach((domain) => {
    //   activeDomains.push(domain.id);

    //   Object.values(domain.requirements).forEach((requirement) => {
    //     activeRequirements.push(requirement.id);

    //     Object.values(requirement.specifications).forEach((spec) => {
    //       specifications.push({ id: spec.id, value: spec.value });
    //     });
    //   });
    // });

    // Sprint 2: Full conflict detection
    console.log(
      "[ArtifactManager] Using conflict detection with 107 exclusions",
    );

    // Collect all specification IDs currently in mapped artifact
    const specIds = Object.keys(mappedSpecs);

    // Check for conflicts among current selections
    const allConflicts = new Map<string, Conflict>(); // Use map to deduplicate

    // For each spec, check if it conflicts with all others
    for (let i = 0; i < specIds.length; i++) {
      const checkSpec = specIds[i];
      const otherSpecs = specIds.filter((_, idx) => idx !== i);

      // Use conflictResolver to get conflicts with resolution options
      const conflicts = conflictResolver.detectConflictsForSpecification(
        checkSpec,
        otherSpecs,
      );

      conflicts.forEach((conflict) => {
        // Create unique key for this conflict pair (sorted to avoid duplicates)
        const conflictKey = conflict.affectedNodes.sort().join("|");

        if (!allConflicts.has(conflictKey))
          // Store conflict with full resolution options
          allConflicts.set(conflictKey, conflict);
      });
    }

    // Convert conflicts to ConflictResult format
    const conflictList = Array.from(allConflicts.values());

    // Store conflict data for later resolution option generation
    this.conflictData.clear();
    conflictList.forEach((conflict) => {
      const conflictKey = conflict.affectedNodes.sort().join("|");
      this.conflictData.set(conflictKey, conflict);
    });

    const result: ConflictResult = {
      hasConflict: conflictList.length > 0,
      conflicts: conflictList,
    };

    console.log(
      `[ArtifactManager] detected ${
        result.conflicts.length
      } conflicts (types: ${result.conflicts.map((c) => c.type).join(", ")})`,
    );

    // Sprint 3 Week 1: DISABLED - Cross-artifact conflicts (user changing mind is allowed)
    // When user provides new value for existing spec, auto-resolve in SemanticIntegrationService
    // const crossConflicts = await this.checkCrossArtifactConflicts();
    // if (crossConflicts.hasConflict) {
    //   result.hasConflict = true;
    //   result.conflicts.push(...crossConflicts.conflicts);
    // }

    // Convert to active conflicts if any found
    if (result.hasConflict) {
      result.conflicts.forEach((conflict) => {
        this.addActiveConflict({
          id: `conflict-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          affectedNodes: conflict.affectedNodes,
          type: conflict.type as ConflictType,
          description: conflict.description,
          resolutionOptions: conflict.resolutionOptions || [],
          cycleCount: 0,
          firstDetected: new Date(),
          lastUpdated: new Date(),
        });
      });

      // Block system if conflicts detected
      this.state.priorityQueue.blocked = true;
      this.state.priorityQueue.blockReason = `${result.conflicts.length} conflict(s) detected`;
      this.state.priorityQueue.currentPriority = "CONFLICTS";

      this.state.conflicts.metadata.systemBlocked = true;
      this.state.conflicts.metadata.blockingConflicts =
        result.conflicts.flatMap((c) => c.affectedNodes);
    }

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
    this.state.conflicts.active.push(conflict);
    this.state.conflicts.metadata.activeCount++;
    this.state.conflicts.metadata.lastModified = new Date();

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

    // Update metadata
    this.state.conflicts.metadata.activeCount--;
    this.state.conflicts.metadata.resolvedCount++;

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
    resolution: {
      id: string;
      targetNodes: string[];
    },
  ): Promise<void> {
    console.log(
      `[ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`,
    );

    // ========== PRE-VALIDATION ==========
    if (!resolution.targetNodes || resolution.targetNodes.length === 0) {
      throw new Error(
        `[Resolution] Resolution ${resolution.id} must specify targetNodes`,
      );
    }

    // Verify all target nodes exist in mapped artifact
    for (const nodeId of resolution.targetNodes) {
      const spec = this.findSpecificationInMapped(nodeId);
      if (!spec) {
        throw new Error(
          `[Resolution] Node ${nodeId} not found in mapped artifact - cannot resolve. ` +
            `This conflict may have already been resolved or the artifact state is corrupted.`,
        );
      }
    }

    // ========== DETERMINE WINNING/LOSING SPECS ==========
    let losingSpecs: string[] = [];
    let winningSpecs: string[] = [];

    // Parse resolution action
    if (resolution.id === "option-a") {
      // Option A: Keep first conflicting node, remove others
      winningSpecs = [conflict.affectedNodes[0]];
      losingSpecs = conflict.affectedNodes.slice(1);
    } else if (resolution.id === "option-b") {
      // Option B: Keep second conflicting node, remove others
      winningSpecs = [conflict.affectedNodes[1]];
      losingSpecs = conflict.affectedNodes
        .slice(0, 1)
        .concat(conflict.affectedNodes.slice(2));
    } else {
      throw new Error(
        `[Resolution] Unknown resolution option: ${resolution.id}`,
      );
    }

    console.log(`[Resolution] Winning specs: ${winningSpecs.join(", ")}`);
    console.log(`[Resolution] Losing specs: ${losingSpecs.join(", ")}`);

    // ========== ATOMIC REMOVAL (with rollback capability) ==========
    const removedSpecs: Array<{ id: string; backup: UCArtifactSpecification }> =
      [];

    try {
      // Remove losing specifications
      for (const specId of losingSpecs) {
        const spec = this.findSpecificationInMapped(specId);

        if (!spec) {
          console.warn(
            `[Resolution] ⚠️  Spec ${specId} not found, skipping removal`,
          );
          continue;
        }

        // Backup before removal
        removedSpecs.push({
          id: specId,
          backup: JSON.parse(JSON.stringify(spec)),
        });

        // Remove from mapped artifact
        console.log(
          `[ArtifactManager] Removing spec ${specId} due to conflict resolution ${resolution.id}`,
        );
        this.removeSpecificationFromMapped(specId);
      }

      // Log winning specs (no action needed, they stay in mapped)
      for (const specId of winningSpecs) {
        console.log(
          `[ArtifactManager] Keeping spec ${specId} as resolution choice`,
        );
      }

      // ========== POST-RESOLUTION VERIFICATION ==========
      for (const specId of losingSpecs) {
        const stillExists = this.findSpecificationInMapped(specId);
        if (stillExists) {
          throw new Error(
            `[CRITICAL] Failed to remove ${specId} - data integrity compromised. ` +
              `Rolling back resolution.`,
          );
        }
      }

      for (const specId of winningSpecs) {
        const exists = this.findSpecificationInMapped(specId);
        if (!exists) {
          throw new Error(
            `[CRITICAL] Winning spec ${specId} disappeared during resolution - ` +
              `data integrity compromised. Rolling back.`,
          );
        }
      }

      console.log(`[ArtifactManager] ✅ Resolution applied successfully`);
    } catch (error) {
      // ========== ROLLBACK ON FAILURE ==========
      console.error(
        `[ArtifactManager] ❌ Resolution failed, rolling back...`,
        error,
      );

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

  async validateArtifacts(): Promise<ArtifactValidationResult> {
    const result: ArtifactValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestedActions: [],
    };

    // Validate each artifact
    const respecValidation = await this.validateArtifact("respec");
    const mappedValidation = await this.validateArtifact("mapped");

    result.errors.push(...respecValidation.errors, ...mappedValidation.errors);
    result.warnings.push(
      ...respecValidation.warnings,
      ...mappedValidation.warnings,
    );

    result.isValid = result.errors.length === 0;

    return result;
  }

  private async validateArtifact(
    _type: "mapped" | "respec",
  ): Promise<ArtifactValidationResult> {
    // TODO zeev Implementation would validate individual artifacts
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestedActions: [],
    };
  }

  // ============= UTILITY METHODS =============

  getCompletionStatus(): { respec: number; mapped: number; total: number } {
    return {
      respec: this.state.respec.metadata.totalNodes,
      mapped: this.state.mapped.metadata.totalNodes,
      total:
        this.state.respec.metadata.totalNodes +
        this.state.mapped.metadata.totalNodes,
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
      pendingValidation: this.state.mapped.metadata.pendingValidation.length,
    };
  }
}

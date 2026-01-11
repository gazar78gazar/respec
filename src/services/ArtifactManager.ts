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
  UCArtifactSpecification,
  ActiveConflict,
  ResolvedConflict,
  createEmptyArtifactState,
  DependencyContext,
  Source,
  SpecificationId,
} from "../types/artifacts.types";

import { ucDataLayer } from "./DataLayer";
import type { UCSelectionType, UCSpecification } from "../types/uc-data.types";
import type {
  ConflictResolutionPlan,
  LocatedSpecification,
  Maybe,
} from "../types/service.types";
import type {
  Conflict,
  ConflictResult,
  ExclusionConflict,
  ResolutionOption,
} from "../types/conflicts.types";
import { conflictResolver } from "./ConflictResolver";
import type { EnhancedFormUpdate } from "../types/service.types";
// import { Requirements } from "../types/form-state.types";

// ============= MAIN ARTIFACT MANAGER =============

export class ArtifactManager {
  private state: ArtifactState;
  // private listeners: Map<string, () => void> = new Map();
  // Unused in refactored flow; event emitter hooks are currently disabled.

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

    console.log("!!! [ArtifactManager] Initialized with ucDataLayer");
    // this.emit("initialized", { state: this.getState() });
  }

  // ============= STATE ACCESS =============

  getState(): ArtifactState {
    return { ...this.state };
  }

  getPendingConflict(): ActiveConflict | null {
    return this.state.conflicts.active[0] || null;
  }

  buildConflictQuestion(conflict: ActiveConflict): string {
    const [optionA, optionB] = conflict.resolutionOptions;

    if (!optionA || !optionB) {
      return `I detected a conflict: ${conflict.description}\n\nPlease choose an option to continue.`;
    }

    const questionLine = conflict.questionTemplate
      ? this.renderQuestionTemplate(
          conflict.questionTemplate,
          optionA.description,
          optionB.description,
        )
      : "Which would you prefer?";

    return `I detected a conflict: ${conflict.description}\n\n${questionLine}\nA) ${optionA.description}\n   Outcome: ${optionA.expectedOutcome}\n\nB) ${optionB.description}\n   Outcome: ${optionB.expectedOutcome}\n\nPlease respond with A or B.`;
  }

  private renderQuestionTemplate(
    template: string,
    optionA: string,
    optionB: string,
  ): string {
    return template
      .replace("{option_a}", optionA)
      .replace("{option_b}", optionB);
  }

  async applyConflictChoice(
    conflictId: string,
    choice: "a" | "b",
  ): Promise<void> {
    const conflict = this.state.conflicts.active.find(
      (entry) => entry.id === conflictId,
    );
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const choiceIndex = choice === "a" ? 0 : 1;
    const resolution = conflict.resolutionOptions[choiceIndex];
    if (!resolution) {
      throw new Error(
        `Resolution option ${choice} not found for ${conflictId}`,
      );
    }

    await this.resolveConflict(conflictId, resolution.id);
  }

  clearFieldSelections(fieldName: string): void {
    if (!this.state.initialized) return;
    if (!fieldName) return;

    const removedMapped = this.removeMappedSpecificationsForField(fieldName);
    const removedRespec = this.removeRespecSpecificationsForField(fieldName);

    if (removedMapped.length || removedRespec.length) {
      this.refreshConflicts();
    }
  }

  // ============= SPECIFICATION OPERATIONS =============

  async addSpecificationToMapped(
    spec: UCSpecification,
    value: unknown,
    originalRequest: string,
    substitutionNote: string,
    source: Source,
    dependencyContext?: DependencyContext,
    attributionOverride?: "assumption" | "requirement",
    conflictScope?: Set<SpecificationId>,
  ): Promise<void> {
    if (!this.state.initialized)
      throw new Error("ArtifactManager not initialized");

    console.log(
      `!!! [ArtifactManager] addSpecificationToMapped started for ${spec.id}`,
      {
        state: this.state,
        spec,
        originalRequest,
        substitutionNote,
        source,
        dependencyContext,
      },
    );

    const visited = dependencyContext?.visited ?? new Set<SpecificationId>();
    const scope = conflictScope ?? new Set<SpecificationId>();
    if (!visited.has(spec.id)) visited.add(spec.id);
    if (!scope.has(spec.id)) scope.add(spec.id);

    const isDependency = !!dependencyContext?.parentSpecId;
    const attribution =
      !isDependency && attributionOverride
        ? attributionOverride
        : isDependency
          ? "assumption"
          : "requirement";

    const artifactSpec: UCArtifactSpecification = {
      id: spec.id,
      name: spec.name,
      value,
      ucSource: spec,
      attribution,
      confidence: 1.0,
      source: isDependency ? "dependency" : source || "llm",
      originalRequest,
      substitutionNote,
      timestamp: new Date(),
      dependencyOf: dependencyContext?.parentSpecId,
    };

    if (!isDependency && spec.field_name) {
      const selectionType = this.getFieldSelectionType(spec.field_name);
      if (selectionType !== "multi_choice") {
        this.removeMappedSpecificationsForField(spec.field_name, spec.id);
        this.removeRespecSpecificationsForField(spec.field_name, spec.id);
      }
    }

    this.state.mapped.specifications[spec.id] = artifactSpec;
    this.updateArtifactMetrics("mapped");

    console.log(
      `!!! [ArtifactManager] Added specification ${
        spec.id
      } to mapped artifact (source: ${source || "user"})`,
    );

    const shouldCheckConflicts = !isDependency;
    if (shouldCheckConflicts) {
      const conflictResult = this.detectConflictsForSpecification(
        spec.id,
        scope,
      );
      if (conflictResult.hasConflict) {
        console.log(
          `!!! [ArtifactManager] Dependencies deferred due to conflict for ${spec.id}`,
        );
        console.log(`!!! [addSpecificationToMapped] finished for ${spec.id}`, {
          state: this.state,
        });
        return;
      }
    }

    await this.fillSpecificationDependencies(
      spec,
      visited,
      dependencyContext?.depth ?? 0,
      scope,
    );

    if (shouldCheckConflicts && scope.size > 1) {
      this.detectConflictsForSpecification(spec.id, scope);
    }

    console.log(`!!! [addSpecificationToMapped] finished for ${spec.id}`, {
      state: this.state,
    });
  }

  private async fillSpecificationDependencies(
    spec: UCSpecification,
    visited: Set<SpecificationId>,
    depth: number = 0,
    conflictScope?: Set<SpecificationId>,
  ): Promise<void> {
    console.log("!!! [ArtifactManager] fillSpecificationDependencies", {
      spec,
      visited,
      depth,
    });
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
          undefined,
          conflictScope,
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

    this.state.conflicts.active = [];
    this.state.conflicts.metadata.activeCount = 0;
    this.state.conflicts.metadata.blockingConflicts = [];
    this.state.conflicts.metadata.lastModified = new Date();

    if (!result.hasConflict) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "PROCESSING";
      this.state.conflicts.metadata.systemBlocked = false;
      return result;
    }

    conflicts.forEach((conflict) => {
      const exclusionValues =
        conflict.type === "exclusion"
          ? {
              existingValue: (conflict as ExclusionConflict).existingValue,
              proposedValue: (conflict as ExclusionConflict).proposedValue,
              questionTemplate: (conflict as ExclusionConflict).resolution,
            }
          : {};

      this.addActiveConflict({
        id: conflict.id,
        affectedNodes: conflict.affectedNodes,
        type: conflict.type,
        description: conflict.description,
        ...exclusionValues,
        resolutionOptions: conflict.resolutionOptions || [],
        cycleCount: conflict.cycleCount ?? 0,
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

  private refreshConflicts(scopeSpecIds?: SpecificationId[]): ConflictResult {
    if (!this.state.initialized || !ucDataLayer.isLoaded()) {
      return this.registerConflicts([]);
    }

    const specIds = this.getCurrentSpecificationIds();
    const specSet = new Set(specIds);
    const scopedIds = scopeSpecIds?.length
      ? scopeSpecIds.filter((id) => specSet.has(id))
      : [];
    const checkSpecIds = [
      ...scopedIds,
      ...specIds.filter((id) => !scopedIds.includes(id)),
    ].filter((id, index, arr) => arr.indexOf(id) === index);

    const conflictMap = new Map<string, Conflict>();

    for (const checkSpec of checkSpecIds) {
      const otherSpecs = specIds.filter((id) => id !== checkSpec);
      const conflicts = conflictResolver.detectAllConflictsForSpecification(
        checkSpec,
        otherSpecs,
      );

      conflicts.forEach((conflict) => {
        const key = conflict.key || conflict.id;
        if (!conflictMap.has(key)) {
          conflictMap.set(key, conflict);
        }
      });
    }

    return this.registerConflicts(Array.from(conflictMap.values()));
  }

  private detectConflictsForSpecification(
    specId: SpecificationId,
    scope?: Set<SpecificationId>,
  ): ConflictResult {
    console.log("!!! [ArtifactManager] detectConflictsForSpecification", {
      specId,
      scope: scope ? Array.from(scope) : [],
    });
    const scopeIds = scope ? Array.from(scope) : [];
    const orderedScope = [specId, ...scopeIds.filter((id) => id !== specId)];
    return this.refreshConflicts(orderedScope);
  }

  // async detectExclusionConflicts(): Promise<ConflictResult> {
  //   console.warn("[ArtifactManager] detectExclusionConflicts started");

  //   if (!this.state.initialized || !ucDataLayer.isLoaded()) {
  //     return { hasConflict: false, conflicts: [] };
  //   }

  //   const specIds = this.getCurrentSpecificationIds();

  //   // Check for conflicts among current selections
  //   const allConflicts = new Map<string, Conflict>(); // Use map to deduplicate

  //   // For each spec, check if it conflicts with all others
  //   for (let i = 0; i < specIds.length; i++) {
  //     const checkSpec = specIds[i];
  //     const otherSpecs = specIds.filter((_, idx) => idx !== i);

  //     // Use conflictResolver to get conflicts with resolution options
  //     const conflicts = conflictResolver.detectAllConflictsForSpecification(
  //       checkSpec,
  //       otherSpecs,
  //     );

  //     conflicts.forEach((conflict) => {
  //       // Create unique key for this conflict pair (sorted to avoid duplicates)
  //       if (!allConflicts.has(conflict.key)) {
  //         allConflicts.set(conflict.key, conflict);
  //       }
  //     });
  //   }

  //   // Convert conflicts to ConflictResult format
  //   const conflictList = Array.from(allConflicts.values());

  //   // Store conflict data for later resolution option generation
  //   this.conflictData.clear();
  //   conflictList.forEach((conflict) =>
  //     this.conflictData.set(conflict.key, conflict),
  //   );

  //   const result = this.registerConflicts(conflictList);

  //   console.log(
  //     `[ArtifactManager] detectExclusionConflicts detected ${
  //       result.conflicts.length
  //     } conflicts (types: ${result.conflicts.map((c) => c.type).join(", ")})`,
  //   );

  //   return result;
  // }

  /**
   * Check for cross-artifact conflicts (mapped vs respec)
   * Week 1: Detects user attempts to override existing validated specs
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
  //       console.log(`!!!    Old value (respec): "${respecSpec.value}"`);
  //       console.log(`!!!    New value (mapped): "${mappedSpec.value}"`);

  //       // Remove old spec from respec
  //       const respecLoc = respecSpecLocations.get(specId);
  //       if (respecLoc) {
  //         const respecDomain = this.state.respec.domains[respecLoc.domainId];
  //         const respecReq = respecDomain?.requirements[respecLoc.reqId];
  //         if (respecReq?.specifications[specId]) {
  //           delete respecReq.specifications[specId];
  //           console.log(`!!!    ✓ Removed old spec from respec`);
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

  //         console.log(`!!!    ✓ Moved new spec to respec`);
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
      (entry) => this.getConflictSignature(entry) === signature,
    );
    if (exists) {
      console.log(
        `!!! [ArtifactManager] Skipping duplicate conflict for signature ${signature}`,
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

    console.log(`!!! [ArtifactManager] Added active conflict: ${conflict.id}`);
  }

  // ============= CONFLICT RESOLUTION =============

  // async resolveConflict(
  //   conflictId: string,
  //   resolutionId: string,
  // ): Promise<void> {
  //   const conflictIndex = this.state.conflicts.active.findIndex(
  //     (c) => c.id === conflictId,
  //   );
  //   if (conflictIndex === -1) {
  //     throw new Error(`Conflict ${conflictId} not found`);
  //   }

  //   const conflict = this.state.conflicts.active[conflictIndex];
  //   const resolution = conflict.resolutionOptions.find(
  //     (r) => r.id === resolutionId,
  //   );
  //   if (!resolution) {
  //     throw new Error(
  //       `Resolution ${resolutionId} not found for conflict ${conflictId}`,
  //     );
  //   }

  //   // Apply resolution to conflicting nodes
  //   await this.applyConflictResolution(conflict, resolution);

  //   // Move conflict to resolved
  //   const resolvedConflict = {
  //     ...conflict,
  //     resolvedAt: new Date(),
  //     resolution,
  //     resolvedBy: "user" as const,
  //   };

  //   this.state.conflicts.resolved.push(resolvedConflict);
  //   this.state.conflicts.active.splice(conflictIndex, 1);

  //   // Remove any other active conflicts with the same signature to avoid loops on identical pairs
  //   const resolvedSignature = this.getConflictSignature(conflict);
  //   this.state.conflicts.active = this.state.conflicts.active.filter(
  //     (c) => this.getConflictSignature(c) !== resolvedSignature,
  //   );

  //   // Update metadata
  //   this.state.conflicts.metadata.activeCount =
  //     this.state.conflicts.active.length;
  //   this.state.conflicts.metadata.resolvedCount++;
  //   this.state.conflicts.metadata.blockingConflicts = Array.from(
  //     new Set(this.state.conflicts.active.flatMap((c) => c.affectedNodes)),
  //   );

  //   // Unblock system if no more active conflicts
  //   if (this.state.conflicts.active.length === 0) {
  //     this.state.priorityQueue.blocked = false;
  //     this.state.priorityQueue.blockReason = undefined;
  //     this.state.priorityQueue.currentPriority = "CLEARING";

  //     this.state.conflicts.metadata.systemBlocked = false;
  //     this.state.conflicts.metadata.blockingConflicts = [];
  //   }

  //   console.log(`!!! [ArtifactManager] Resolved conflict: ${conflictId}`);

  //   // After conflict resolved, move non-conflicting specs from MAPPED to RESPEC
  //   // This triggers the normal flow: MAPPED → RESPEC → Form heals from RESPEC
  //   await this.moveNonConflictingToRespec();

  //   // this.emit("conflict_resolved", { conflictId, resolutionId });
  // }

  async resolveConflict(
    conflictId: string,
    resolutionId: string,
  ): Promise<void> {
    const conflictIndex = this.state.conflicts.active.findIndex(
      (entry) => entry.id === conflictId,
    );
    if (conflictIndex === -1) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const conflict = this.state.conflicts.active[conflictIndex];
    const resolution = conflict.resolutionOptions.find(
      (option) => option.id === resolutionId,
    );
    if (!resolution) {
      throw new Error(
        `Resolution ${resolutionId} not found for conflict ${conflictId}`,
      );
    }

    await this.applyConflictResolution(conflict, resolution);

    const resolvedConflict: ResolvedConflict = {
      ...conflict,
      resolvedAt: new Date(),
      resolution,
      resolvedBy: "user",
    };

    this.state.conflicts.resolved.push(resolvedConflict);
    this.state.conflicts.active.splice(conflictIndex, 1);

    const resolvedSignature = this.getConflictSignature(conflict);
    this.state.conflicts.active = this.state.conflicts.active.filter(
      (entry) => this.getConflictSignature(entry) !== resolvedSignature,
    );

    this.state.conflicts.metadata.resolvedCount++;

    if (this.state.conflicts.active.length === 0) {
      this.state.priorityQueue.blocked = false;
      this.state.priorityQueue.blockReason = undefined;
      this.state.priorityQueue.currentPriority = "CLEARING";
      this.state.conflicts.metadata.systemBlocked = false;
      this.state.conflicts.metadata.blockingConflicts = [];
    }

    const dependencyScope = new Set<SpecificationId>(
      resolution.targetNodes || [],
    );
    for (const specId of resolution.targetNodes || []) {
      await this.ensureDependenciesForSpec(specId, dependencyScope);
    }

    this.pruneToDependencyClosure();
    this.refreshConflicts();
    await this.moveNonConflictingToRespec();
  }

  /**
   * Increment conflict cycle count
   * Track resolution attempts
   */
  // incrementConflictCycle(conflictId: string): void {
  //   const conflictIndex = this.state.conflicts.active.findIndex(
  //     (c) => c.id === conflictId,
  //   );
  //   if (conflictIndex === -1) {
  //     console.warn(
  //       `[ArtifactManager] Conflict ${conflictId} not found for cycle increment`,
  //     );
  //     return;
  //   }

  //   const conflict = this.state.conflicts.active[conflictIndex];
  //   conflict.cycleCount++;
  //   conflict.lastUpdated = new Date();

  //   console.log(
  //     `[ArtifactManager] Conflict ${conflictId} cycle count: ${conflict.cycleCount}`,
  //   );

  //   // Check for escalation threshold
  //   if (conflict.cycleCount >= 3) {
  //     console.warn(
  //       `[ArtifactManager] ⚠️  Conflict ${conflictId} reached max cycles (3) - escalating`,
  //     );
  //     this.escalateConflict(conflictId);
  //   }
  // }

  /**
   * Escalate conflict after max cycles
   * Auto-resolution or skip
   */
  // private escalateConflict(conflictId: string): void {
  //   const conflictIndex = this.state.conflicts.active.findIndex(
  //     (c) => c.id === conflictId,
  //   );
  //   if (conflictIndex === -1) return;

  //   const conflict = this.state.conflicts.active[conflictIndex];

  //   // Move to escalated list
  //   const escalatedConflict: EscalatedConflict = {
  //     ...conflict,
  //     escalatedAt: new Date(),
  //     escalationReason: "max_cycles",
  //   };

  //   this.state.conflicts.escalated.push(escalatedConflict);
  //   this.state.conflicts.active.splice(conflictIndex, 1);
  //   this.state.conflicts.metadata.activeCount--;
  //   this.state.conflicts.metadata.escalatedCount =
  //     (this.state.conflicts.metadata.escalatedCount || 0) + 1;

  //   console.log(
  //     `[ArtifactManager] Conflict ${conflictId} escalated to manual review`,
  //   );

  //   // Unblock system if no more active conflicts
  //   if (this.state.conflicts.active.length === 0) {
  //     this.state.priorityQueue.blocked = false;
  //     this.state.priorityQueue.blockReason = undefined;
  //     this.state.priorityQueue.currentPriority = "CLEARING";
  //     this.state.conflicts.metadata.systemBlocked = false;
  //     this.state.conflicts.metadata.blockingConflicts = [];

  //     console.log(
  //       `[ArtifactManager] ✅ All active conflicts resolved or escalated - system unblocked`,
  //     );
  //   }

  //   // this.emit("conflict_escalated", { conflictId, reason: "max_cycles" });
  // }

  /**
   * Apply conflict resolution with surgical precision
   * Full implementation with safety policies
   */
  // private async applyConflictResolution(
  //   conflict: ActiveConflict,
  //   resolution: ResolutionOption,
  // ): Promise<void> {
  //   console.log(
  //     `[ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`,
  //   );

  //   const plan = conflictResolver.planResolution(conflict, resolution, {
  //     findSpecificationWithLocation:
  //       this.findSpecificationWithLocation.bind(this),
  //     collectAssumptionDependencies:
  //       this.collectAssumptionDependencies.bind(this),
  //   });

  //   const { winningSpecs, losingSpecs } = plan;

  //   console.log(`!!! [ArtifactManager] applyConflictResolution`, {
  //     conflict,
  //     resolution,
  //     winningSpecs,
  //     losingSpecs,
  //   });

  //   // ========== ATOMIC REMOVAL (with rollback capability) ==========
  //   const removedSpecs: Array<{
  //     id: string;
  //     backup: UCArtifactSpecification;
  //     artifact: "mapped" | "respec";
  //   }> = [];
  //   const removalPlanned = new Set<string>();

  //   try {
  //     // Remove losing specifications
  //     for (const located of plan.removals) {
  //       this.planRemoval(
  //         located.artifact,
  //         located.spec,
  //         removedSpecs,
  //         removalPlanned,
  //       );
  //     }

  //     // Execute removals
  //     for (const removal of removedSpecs) {
  //       console.log(
  //         `[ArtifactManager] Removing spec ${removal.id} (artifact=${removal.artifact}) due to conflict resolution ${resolution.id}`,
  //       );
  //       if (removal.artifact === "mapped") {
  //         this.removeSpecificationFromMapped(removal.id);
  //       } else {
  //         this.removeSpecificationFromRespec(removal.id);
  //       }
  //     }

  //     // Log winning specs (no action needed, they stay in mapped)
  //     for (const specId of winningSpecs) {
  //       console.log(
  //         `[ArtifactManager] Keeping spec ${specId} as resolution choice`,
  //       );
  //     }

  //     // ========== POST-RESOLUTION VERIFICATION ==========
  //     for (const specId of losingSpecs) {
  //       const stillExists =
  //         this.findSpecificationInMapped(specId) ||
  //         this.findSpecificationInRespec(specId);
  //       if (stillExists) {
  //         throw new Error(
  //           `[CRITICAL] Failed to remove ${specId} - data integrity compromised. ` +
  //             `Rolling back resolution.`,
  //         );
  //       }
  //     }

  //     for (const specId of winningSpecs) {
  //       const exists =
  //         this.findSpecificationInMapped(specId) ||
  //         this.findSpecificationInRespec(specId);
  //       if (!exists) {
  //         throw new Error(
  //           `[CRITICAL] Winning spec ${specId} disappeared during resolution - ` +
  //             `data integrity compromised. Rolling back.`,
  //         );
  //       }
  //     }

  //     // Remove any stale conflicts that reference removed specs
  //     const removedIds = removedSpecs.map((r) => r.id);
  //     this.purgeConflictsForNodes(removedIds);
  //     this.pruneInactiveConflicts();

  //     console.log(`!!! [ArtifactManager] ✅ Resolution applied successfully`);
  //   } catch (error) {
  //     // ========== ROLLBACK ON FAILURE ==========
  //     console.error(
  //       `[ArtifactManager] ❌ Resolution failed, rolling back...`,
  //       error,
  //     );

  //     // Restore removed specs
  //     for (const { id, backup, artifact } of removedSpecs) {
  //       console.log(`!!! [Rollback] Restoring spec ${id}`);
  //       this.restoreSpecificationToArtifact(id, backup, artifact);
  //     }

  //     throw error;
  //   }
  // }

  private async applyConflictResolution(
    conflict: ActiveConflict,
    resolution: ResolutionOption,
  ): Promise<void> {
    console.log(
      `!!! [ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`,
    );

    let plan: ConflictResolutionPlan;
    try {
      plan = conflictResolver.planResolution(conflict, resolution, {
        findSpecificationWithLocation:
          this.findSpecificationWithLocation.bind(this),
        collectAssumptionDependencies:
          this.collectAssumptionDependencies.bind(this),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("[Resolution] Node")) {
        console.warn(
          `[ArtifactManager] Skipping stale conflict resolution: ${message}`,
        );
        return;
      }
      throw error;
    }

    const removalIds = new Set(plan.removals.map((entry) => entry.spec.id));

    plan.losingSpecs.forEach((losingSpecId) => {
      try {
        const fallbackRemovals =
          this.collectAssumptionDependenciesByGraph(losingSpecId);
        fallbackRemovals.forEach((located) => {
          if (removalIds.has(located.spec.id)) return;
          removalIds.add(located.spec.id);
          plan.removals.push(located);
        });
      } catch (error) {
        console.warn(
          `[ArtifactManager] Skipping fallback dependency removals for ${losingSpecId}:`,
          error,
        );
      }
    });

    plan.removals.forEach((located) => {
      if (located.artifact === "mapped") {
        this.removeSpecificationFromMapped(located.spec.id);
      } else {
        this.removeSpecificationFromRespec(located.spec.id);
      }
    });

    console.log(`!!! [ArtifactManager] Resolution applied`, {
      conflictId: conflict.id,
      resolutionId: resolution.id,
      removed: plan.removals.map((entry) => entry.spec.id),
    });
  }

  /**
   * Find specification in any artifact (public for user-selection preservation)
   * Helper for preservation checks
   */
  findSpecificationInArtifact(
    artifactName: "mapped" | "respec",
    specId: SpecificationId,
  ): Maybe<UCArtifactSpecification> {
    const artifact =
      artifactName === "mapped" ? this.state.mapped : this.state.respec;
    return artifact.specifications[specId] || null;
  }

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

  pruneToDependencyClosure(): void {
    if (!this.state.initialized || !ucDataLayer.isLoaded()) return;

    const allSpecs = [
      ...Object.values(this.state.mapped.specifications),
      ...Object.values(this.state.respec.specifications),
    ];

    const roots = allSpecs
      .filter(
        (spec) => spec.attribution === "requirement" || !spec.dependencyOf,
      )
      .map((spec) => spec.id);

    const allowed = new Set<SpecificationId>();
    const queue = [...roots];

    while (queue.length > 0) {
      const specId = queue.pop();
      if (!specId || allowed.has(specId)) continue;
      allowed.add(specId);

      const requiredNodes = ucDataLayer.getRequiredNodes(specId);
      requiredNodes.forEach((requiredId) => {
        if (!allowed.has(requiredId)) {
          queue.push(requiredId);
        }
      });
    }

    Object.keys(this.state.mapped.specifications).forEach((specId) => {
      if (!allowed.has(specId)) {
        this.removeSpecificationFromMapped(specId);
      }
    });

    Object.keys(this.state.respec.specifications).forEach((specId) => {
      if (!allowed.has(specId)) {
        this.removeSpecificationFromRespec(specId);
      }
    });
  }

  /**
   * Restore specification to mapped artifact (for rollback)
   * Helper for rollback operations
   */

  // ============= ARTIFACT MOVEMENT =============

  async moveNonConflictingToRespec(): Promise<void> {
    if (!this.state.initialized) return;

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
        `!!! [ArtifactManager] Moved ${movable.length} non-conflicting specs to respec`,
        { movable, state: this.state },
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
    const fieldName = this.getSpecFieldName(spec);
    if (fieldName) {
      const selectionType = this.getFieldSelectionType(fieldName);
      if (selectionType !== "multi_choice") {
        this.removeRespecSpecificationsForField(fieldName, spec.id);
      }
    }
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

  private removeMappedSpecificationsForField(
    fieldName: string,
    keepSpecId?: SpecificationId,
  ): SpecificationId[] {
    const removed: SpecificationId[] = [];
    Object.values(this.state.mapped.specifications).forEach((spec) => {
      const specFieldName = this.getSpecFieldName(spec);
      if (!specFieldName || specFieldName !== fieldName) return;
      if (keepSpecId && spec.id === keepSpecId) return;
      delete this.state.mapped.specifications[spec.id];
      removed.push(spec.id);
    });
    if (removed.length > 0) {
      this.updateArtifactMetrics("mapped");
    }
    return removed;
  }

  // private planRemoval(
  //   artifact: "mapped" | "respec",
  //   spec: UCArtifactSpecification,
  //   removedSpecs: Array<{
  //     id: string;
  //     backup: UCArtifactSpecification;
  //     artifact: "mapped" | "respec";
  //   }>,
  //   removalPlanned: Set<string>,
  // ): void {
  //   if (removalPlanned.has(spec.id)) return;
  //   removalPlanned.add(spec.id);
  //   const backup: UCArtifactSpecification = {
  //     ...spec,
  //     timestamp: new Date(spec.timestamp),
  //   };
  //   removedSpecs.push({
  //     id: spec.id,
  //     backup,
  //     artifact,
  //   });
  // }

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

  private collectAssumptionDependenciesByGraph(
    rootSpecId: SpecificationId,
  ): LocatedSpecification[] {
    if (!ucDataLayer.isLoaded()) return [];

    const results: LocatedSpecification[] = [];
    const visited = new Set<SpecificationId>([rootSpecId]);
    const queue: SpecificationId[] = [rootSpecId];

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      const requiredNodes = ucDataLayer.getRequiredNodes(current);
      requiredNodes.forEach((nodeId) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const located = this.findSpecificationWithLocation(nodeId);
        if (located && located.spec.attribution === "assumption") {
          results.push(located);
          queue.push(nodeId);
          return;
        }

        queue.push(nodeId);
      });
    }

    return results;
  }

  private async ensureDependenciesForSpec(
    specId: SpecificationId,
    scope: Set<SpecificationId>,
  ): Promise<void> {
    if (!ucDataLayer.isLoaded()) return;
    const spec = ucDataLayer.getSpecification(specId);
    if (!spec) return;
    const visited = new Set<SpecificationId>([specId]);
    await this.fillSpecificationDependencies(spec, visited, 0, scope);
  }

  private getConflictSignature(conflict: ActiveConflict): string {
    return `${conflict.type}:${[...conflict.affectedNodes].sort().join("|")}`;
  }

  /**
   * Remove active conflicts that reference any of the provided node IDs.
   * Keeps conflict list in sync after removals/resolutions to prevent loops.
   */
  // private purgeConflictsForNodes(nodeIds: SpecificationId[]): void {
  //   if (!nodeIds.length) return;
  //   const targets = new Set(nodeIds);
  //   const before = this.state.conflicts.active.length;
  //   if (before === 0) return;

  //   this.state.conflicts.active = this.state.conflicts.active.filter(
  //     (conflict) =>
  //       !conflict.affectedNodes.some((nodeId) => targets.has(nodeId)),
  //   );

  //   const after = this.state.conflicts.active.length;
  //   if (after === before) return;

  //   this.state.conflicts.metadata.activeCount = after;
  //   this.state.conflicts.metadata.blockingConflicts = Array.from(
  //     new Set(this.state.conflicts.active.flatMap((c) => c.affectedNodes)),
  //   );
  //   this.state.conflicts.metadata.systemBlocked = after > 0;
  // if (after === 0) {
  //   this.state.priorityQueue.blocked = false;
  //   this.state.priorityQueue.blockReason = undefined;
  //   this.state.priorityQueue.currentPriority = "CLEARING";
  // }
  // }

  /**
   * Remove conflicts that reference specs no longer present in mapped or respec
   * Prevents stale conflicts from re-triggering resolution loops after removals.
   */
  // private pruneInactiveConflicts(): void {
  // const exists = (id: SpecificationId) =>
  //   !!this.state.mapped.specifications[id] ||
  //   !!this.state.respec.specifications[id];

  // const before = this.state.conflicts.active.length;
  // if (before === 0) return;

  // this.state.conflicts.active = this.state.conflicts.active.filter(
  //   (conflict) => conflict.affectedNodes.some((nodeId) => exists(nodeId)),
  // );

  // const after = this.state.conflicts.active.length;
  // if (after === before) return;

  // Update metadata to reflect pruned conflicts
  // this.state.conflicts.metadata.activeCount = after;
  // this.state.conflicts.metadata.blockingConflicts = Array.from(
  //   new Set(
  //     this.state.conflicts.active.flatMap(
  //       (conflict) => conflict.affectedNodes,
  //     ),
  //   ),
  // );
  // this.state.conflicts.metadata.systemBlocked = after > 0;

  // if (after === 0) {
  //   this.state.priorityQueue.blocked = false;
  //   this.state.priorityQueue.blockReason = undefined;
  //   this.state.priorityQueue.currentPriority = "CLEARING";
  // }
  // }

  private updateArtifactMetrics(type: "mapped" | "respec"): void {
    const artifact = type === "mapped" ? this.state.mapped : this.state.respec;
    artifact.metadata.totalNodes = Object.keys(artifact.specifications).length;
    artifact.metadata.lastModified = new Date();
  }

  private getSpecFieldName(spec: UCArtifactSpecification): Maybe<string> {
    return (
      spec.ucSource?.field_name ||
      ucDataLayer.getSpecification(spec.id)?.field_name ||
      null
    );
  }

  private getFieldSelectionType(fieldName: string): Maybe<UCSelectionType> {
    return ucDataLayer.getUiFieldByFieldName(fieldName)?.selection_type || null;
  }

  private removeRespecSpecificationsForField(
    fieldName: string,
    keepSpecId?: SpecificationId,
  ): SpecificationId[] {
    const removed: SpecificationId[] = [];
    Object.values(this.state.respec.specifications).forEach((spec) => {
      const specFieldName = this.getSpecFieldName(spec);
      if (!specFieldName || specFieldName !== fieldName) return;
      if (keepSpecId && spec.id === keepSpecId) return;
      delete this.state.respec.specifications[spec.id];
      removed.push(spec.id);
    });
    if (removed.length > 0) {
      this.updateArtifactMetrics("respec");
    }
    return removed;
  }

  // ============= FORM SYNCHRONIZATION =============

  // async syncWithFormState(
  //   requirements: Requirements,
  // ): Promise<EnhancedFormUpdate[]> {
  //   // Compatibility layer: sync new artifact state with existing requirements state
  //   this.state.respec.metadata.formSyncStatus = "synced";

  //   const normalizeSelections = (value: unknown): unknown[] => {
  //     if (
  //       value === null ||
  //       value === undefined ||
  //       value === "" ||
  //       value === "Not Required"
  //     ) {
  //       return [];
  //     }
  //     if (Array.isArray(value)) {
  //       return value.filter(
  //         (entry) =>
  //           entry !== null &&
  //           entry !== undefined &&
  //           entry !== "" &&
  //           entry !== "Not Required",
  //       );
  //     }
  //     return [value];
  //   };

  //   const matchesSelection = (
  //     spec: UCSpecification,
  //     selection: unknown,
  //   ): boolean => {
  //     if (selection === null || selection === undefined) return false;
  //     const normalized = String(selection);
  //     return (
  //       spec.id === normalized ||
  //       spec.selected_value === normalized ||
  //       spec.name === normalized
  //     );
  //   };

  //   const selectedSpecValues = new Map<
  //     SpecificationId,
  //     {
  //       value: unknown;
  //       source: Source;
  //       isAssumption: boolean;
  //       fieldName: string;
  //     }
  //   >();
  //   const selectedByField = new Map<string, Set<SpecificationId>>();
  //   const fieldsWithValue = new Set<string>();
  //   const unmatchedFields = new Set<string>();

  //   Object.entries(requirements).forEach(([_section, fields]) => {
  //     Object.entries(fields).forEach(([fieldName, fieldData]) => {
  //       const selections = normalizeSelections(fieldData.value);
  //       if (selections.length === 0) return;

  //       fieldsWithValue.add(fieldName);

  //       const specs = ucDataLayer.getSpecificationsForFormField(fieldName);
  //       if (specs.length === 0) return;

  //       const source: Source =
  //         fieldData.source === "system" ? "system" : "user";
  //       const isAssumption = fieldData.isAssumption || false;

  //       let matchedAny = false;
  //       selections.forEach((selection) => {
  //         const match = specs.find((spec) => matchesSelection(spec, selection));
  //         if (!match) return;
  //         matchedAny = true;

  //         if (!selectedByField.has(fieldName)) {
  //           selectedByField.set(fieldName, new Set());
  //         }
  //         const seen = selectedByField.get(fieldName);
  //         if (seen?.has(match.id)) return;
  //         seen?.add(match.id);

  //         selectedSpecValues.set(match.id, {
  //           value: selection,
  //           source,
  //           isAssumption,
  //           fieldName,
  //         });
  //       });

  //       if (!matchedAny) {
  //         unmatchedFields.add(fieldName);
  //       }
  //     });
  //   });

  //   const desiredSpecIds = new Set<SpecificationId>(selectedSpecValues.keys());
  //   const dependencyQueue = Array.from(desiredSpecIds);
  //   const dependencyVisited = new Set<SpecificationId>(dependencyQueue);

  //   while (dependencyQueue.length > 0) {
  //     const current = dependencyQueue.shift();
  //     if (!current) continue;
  //     const required = ucDataLayer.getRequiredNodes(current);
  //     required.forEach((dependencyId) => {
  //       const dependencySpec = ucDataLayer.getSpecification(dependencyId);
  //       const dependencyField = dependencySpec?.field_name;
  //       if (dependencyField) {
  //         if (unmatchedFields.has(dependencyField)) {
  //           return;
  //         }
  //         const selectedForField = selectedByField.get(dependencyField);
  //         if (selectedForField && !selectedForField.has(dependencyId)) {
  //           return;
  //         }
  //       }
  //       if (desiredSpecIds.has(dependencyId)) return;
  //       desiredSpecIds.add(dependencyId);
  //       if (dependencyVisited.has(dependencyId)) return;
  //       dependencyVisited.add(dependencyId);
  //       dependencyQueue.push(dependencyId);
  //     });
  //   }

  //   let mappedChanged = false;
  //   let respecChanged = false;
  //   let addedSpecs = false;

  //   const updateSpecFromSelection = (
  //     spec: UCArtifactSpecification,
  //     selection: {
  //       value: unknown;
  //       source: Source;
  //       isAssumption: boolean;
  //     },
  //     artifact: "mapped" | "respec",
  //   ): void => {
  //     let changed = false;
  //     if (spec.value !== selection.value) {
  //       spec.value = selection.value;
  //       changed = true;
  //     }
  //     if (!spec.dependencyOf) {
  //       const nextAttribution = selection.isAssumption
  //         ? "assumption"
  //         : "requirement";
  //       if (spec.attribution !== nextAttribution) {
  //         spec.attribution = nextAttribution;
  //         changed = true;
  //       }
  //       if (spec.source !== selection.source) {
  //         spec.source = selection.source;
  //         changed = true;
  //       }
  //     }
  //     if (changed) {
  //       spec.timestamp = new Date();
  //       if (artifact === "mapped") {
  //         mappedChanged = true;
  //       } else {
  //         respecChanged = true;
  //       }
  //     }
  //   };

  //   for (const [specId, selection] of selectedSpecValues.entries()) {
  //     const respecSpec = this.state.respec.specifications[specId];
  //     const mappedSpec = this.state.mapped.specifications[specId];
  //     if (respecSpec) {
  //       updateSpecFromSelection(respecSpec, selection, "respec");
  //       continue;
  //     }
  //     if (mappedSpec) {
  //       updateSpecFromSelection(mappedSpec, selection, "mapped");
  //       continue;
  //     }

  //     const spec = ucDataLayer.getSpecification(specId);
  //     if (!spec) continue;

  //     await this.addSpecificationToMapped(
  //       spec,
  //       selection.value,
  //       `Form sync for ${selection.fieldName}`,
  //       "",
  //       selection.source,
  //     );
  //     addedSpecs = true;
  //     mappedChanged = true;
  //   }

  //   const removedSpecIds: SpecificationId[] = [];

  //   Object.values(this.state.mapped.specifications).forEach((spec) => {
  //     if (desiredSpecIds.has(spec.id)) return;
  //     delete this.state.mapped.specifications[spec.id];
  //     removedSpecIds.push(spec.id);
  //     mappedChanged = true;
  //   });

  //   Object.values(this.state.respec.specifications).forEach((spec) => {
  //     if (desiredSpecIds.has(spec.id)) return;

  //     const fieldName = this.getSpecFieldName(spec);
  //     if (!fieldName) return;

  //     const selectionType = this.getFieldSelectionType(fieldName);
  //     const explicitSelection = selectedByField.get(fieldName);
  //     const hasExplicitSelection = !!explicitSelection?.size;
  //     const allowRemoval =
  //       !fieldsWithValue.has(fieldName) ||
  //       selectionType === "multi_choice" ||
  //       hasExplicitSelection ||
  //       unmatchedFields.has(fieldName);

  //     if (!allowRemoval) return;

  //     delete this.state.respec.specifications[spec.id];
  //     removedSpecIds.push(spec.id);
  //     respecChanged = true;
  //   });

  //   const needsPromotion = Array.from(desiredSpecIds).some(
  //     (specId) =>
  //       !!this.state.mapped.specifications[specId] &&
  //       !this.state.respec.specifications[specId],
  //   );

  //   if (mappedChanged) {
  //     this.updateArtifactMetrics("mapped");
  //   }
  //   if (respecChanged) {
  //     this.updateArtifactMetrics("respec");
  //   }
  //   if (removedSpecIds.length > 0) {
  //     this.purgeConflictsForNodes(removedSpecIds);
  //   }

  //   if (addedSpecs || needsPromotion) {
  //     const conflictResult = await this.detectExclusionConflicts();
  //     if (!conflictResult.hasConflict) {
  //       await this.moveNonConflictingToRespec();
  //     }
  //   }

  //   if (this.state.conflicts.active.length > 0) {
  //     console.log("!!! [ArtifactManager] Synced with form state");
  //     return [];
  //   }

  //   const updates = this.generateFormUpdatesFromRespec();

  //   const isEmptyValue = (value: unknown) =>
  //     value === null || value === undefined || value === "";
  //   const valuesEqual = (left: unknown, right: unknown): boolean => {
  //     if (isEmptyValue(left) && isEmptyValue(right)) return true;
  //     if (Array.isArray(left) || Array.isArray(right)) {
  //       if (!Array.isArray(left) || !Array.isArray(right)) return false;
  //       if (left.length !== right.length) return false;
  //       return left.every((value, index) => value === right[index]);
  //     }
  //     return left === right;
  //   };

  //   const filtered = updates.filter((update) => {
  //     if (unmatchedFields.has(update.field)) {
  //       return false;
  //     }
  //     const current = requirements[update.section]?.[update.field];
  //     const currentValue = current?.value;
  //     const currentAssumption = current?.isAssumption || false;
  //     const valueChanged = !valuesEqual(currentValue, update.value);
  //     const assumptionChanged =
  //       currentAssumption !== (update.isAssumption || false);
  //     return valueChanged || assumptionChanged;
  //   });

  //   console.log("!!! [ArtifactManager] Synced with form state");
  //   return filtered;
  // }

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
        selected: Maybe<string>;
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
          value: mapped.selected || "",
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

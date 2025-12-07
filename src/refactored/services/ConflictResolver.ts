/**
 * ConflictResolver - Unified conflict detection & resolution for UC8
 * Replaces old ExclusionEngine and integrates with existing conflict logging
 */
import { v4 as uuidv4 } from "uuid";
import { ucDataLayer } from "./DataLayer";
import {
  Conflict,
  ResolutionOption,
  ConflictResolution,
  OverwriteConflict,
  ExclusionConflict,
  CascadeConflict,
  ConstraintConflict,
  ExclusionResolutionOption,
  OverwriteResolutionOption,
} from "../types/UCDataTypes";

export class ConflictResolver {
  private conflictHistory: Map<string, Conflict> = new Map();
  private resolutionHistory: ConflictResolution[] = [];

  /**
   * Main entry point - detect all conflicts for a proposed change
   */
  detectAllConflictsForSpecification(
    newSpecId: string,
    currentSelections: string[],
  ): Conflict[] {
    console.log(`[ConflictResolver] 🔍 detectConflicts(${newSpecId})`);

    const exclusuionConflicts = this.detectExclusionConflicts(
      newSpecId,
      currentSelections,
    );

    exclusuionConflicts.forEach((c) => {
      c.resolutionOptions = this.generateResolutionOptions(
        c,
        currentSelections,
      ) as ExclusionResolutionOption[];
      this.conflictHistory.set(c.id, c);
    });

    // const overwriteConflicts = this.detectOverwriteConflicts(
    //   newSpecId,
    //   currentSelections
    // );

    // const cascadeConflicts = this.detectCascadeConflicts(
    //   newSpecId,
    //   currentSelections
    // );

    // const constraintConflicts = this.detectConstraintConflicts(
    //   newSpecId,
    //   currentSelections
    // );

    // Convert data layer conflicts to standard Conflict format
    const conflicts: Conflict[] = [...exclusuionConflicts];
    // overwriteConflicts.forEach((oc) => {
    //   const conflictId = `conflict-${Date.now()}-${Math.random()
    //     .toString(36)
    //     .substr(2, 9)}`;

    //   const conflict: Conflict = {
    //     id: conflictId,
    //     type: oc.type as ConflictType,
    //     affectedNodes: [oc.existingValue, oc.proposedValue],
    //     description: oc.description,
    //     resolution: oc.resolution,
    //     resolutionOptions: this.generateResolutionOptions(
    //       oc,
    //       currentSelections
    //     ),
    //     cycleCount: 0,
    //     firstDetected: new Date(),
    //     lastUpdated: new Date(),
    //   };

    //   conflicts.push(conflict);

    // this.conflictHistory.set(conflictId, conflict);
    // });

    console.log(`[ConflictResolver]   → Found ${conflicts.length} conflicts`);
    return conflicts;
  }

  private generateConflictKey(affectedNodes: string[]): string {
    return affectedNodes.sort().join("|");
  }

  /**
   * Generate resolution options for agent to present
   */
  private generateResolutionOptions(
    conflict: Conflict,
    currentSelections: string[],
  ): ResolutionOption[] {
    console.log("[ConflictResolver] generateResolutionOptions", conflict, currentSelections);
    switch (conflict.type) {
      case "field_overwrite": {
        const _c = conflict as OverwriteConflict;
        const existing = ucDataLayer.getNodeName(_c.existingValue);
        const proposed = ucDataLayer.getNodeName(_c.proposedValue);
        return [
          {
            id: "keep-existing",
            description: `Keep ${existing}`,
            action: "keep_existing",
            targetNodes: [_c.existingValue],
            expectedOutcome: `${existing} remains selected`,
          },
          {
            id: "apply-new",
            description: `Change to ${proposed}`,
            action: "apply_new",
            targetNodes: [_c.proposedValue],
            expectedOutcome: `${proposed} will replace ${existing}`,
          },
        ];
      }
      case "exclusion": {
        const _c = conflict as ExclusionConflict;
        // Use question template from exclusion if available
        const existing = ucDataLayer.getNodeName(_c.existingValue);
        const proposed = ucDataLayer.getNodeName(_c.proposedValue);
        if (_c.resolution) {
          // TODO zeev conflict Question template available but not currently used for option generation
          return [
            {
              id: "option-a",
              description: existing,
              action: "select_option_a",
              targetNodes: [_c.existingValue],
              expectedOutcome: `Keep ${existing}`,
            },
            {
              id: "option-b",
              description: proposed,
              action: "select_option_b",
              targetNodes: [_c.proposedValue],
              expectedOutcome: `Select ${proposed}`,
            },
          ] as ExclusionResolutionOption[];
        }
        // Fallback to default options
        return this.generateDefaultExclusionOptions(_c, existing, proposed);
      }
      case "cascade": {
        const _c = conflict as CascadeConflict;
        const impact = this.getConflictImpact(_c, currentSelections);
        return [
          {
            id: "cancel",
            description: "Cancel change",
            action: "keep_existing",
            targetNodes: _c.affectedNodes,
            expectedOutcome: "No changes will be made",
          },
          {
            id: "apply-cascade",
            description: `Apply changes (affects ${impact.toRemove.length} items)`,
            action: "apply_new",
            targetNodes: [...impact.toRemove, ...impact.toAdd],
            expectedOutcome: `Will remove ${impact.toRemove.length} items and add ${impact.toAdd.length}`,
          },
        ];
      }
      default:
        alert(
          `unhandled type of conflict ${conflict.type} - make correct exception`,
        );
        return [];
      // return this.generateDefaultOptions(conflict, existing, proposed);
    }
  }

  /**
   * Get all specs that would be affected by a conflict resolution
   */
  getConflictImpact(
    // TODO zeev conflict reuse method if relevant
    conflict: Conflict,
    currentSelections: string[],
  ): {
    toRemove: string[];
    toAdd: string[];
    cascadeEffects: string[];
  } {
    console.log(`[UCDataLayer] 📊 getConflictImpact()`);

    const toRemove: Set<string> = new Set();
    const toAdd: Set<string> = new Set();
    const cascadeEffects: Set<string> = new Set();

    // What gets removed
    conflict.affectedNodes.forEach((node: string) => toRemove.add(node));

    // Check for dependent specs that would also be removed
    for (const selection of currentSelections) {
      const requires = ucDataLayer.getRequiredNodes(selection);

      if (requires.some((req) => toRemove.has(req))) {
        cascadeEffects.add(selection);
      }
    }

    // What gets added
    toAdd.add(conflict.proposedValue);

    // Add required dependencies
    const requiredNodes = ucDataLayer.getRequiredNodes(conflict.proposedValue);
    requiredNodes.forEach((node) => {
      if (!currentSelections.includes(node)) {
        toAdd.add(node);
      }
    });

    console.log(
      `[UCDataLayer]   → Remove: ${toRemove.size}, Add: ${toAdd.size}, Cascade: ${cascadeEffects.size}`,
    );

    return {
      toRemove: Array.from(toRemove),
      toAdd: Array.from(toAdd),
      cascadeEffects: Array.from(cascadeEffects),
    };
  }

  detectOverwriteConflicts(
    newSpecId: string,
    currentSelections: string[],
  ): OverwriteConflict[] {
    console.log(
      `[UCDataLayer] 🔍 detectOverwriteConflicts(${newSpecId}`,
      currentSelections,
    );

    const conflicts: OverwriteConflict[] = [];
    const newSpec = ucDataLayer.getSpecification(newSpecId);
    if (!newSpec) return conflicts;

    const fieldName = newSpec.field_name;
    if (fieldName) {
      const existingSpecForField = currentSelections.find((id) => {
        const spec = ucDataLayer.getSpecification(id);
        return spec?.field_name === fieldName;
      });

      if (existingSpecForField && existingSpecForField !== newSpecId) {
        const newConflict: OverwriteConflict = {
          id: uuidv4(),
          key: this.generateConflictKey([existingSpecForField, newSpecId]),
          type: "field_overwrite",
          field: fieldName,
          existingValue: existingSpecForField,
          proposedValue: newSpecId,
          description: `Field "${fieldName}" already has a value`,
          affectedNodes: [existingSpecForField, newSpecId],
        };
        conflicts.push(newConflict);
        console.log(
          `[UCDataLayer]   🔄 Field overwrite detected for "${fieldName}"`,
        );
      }
    }
    return conflicts;
  }

  detectExclusionConflicts(
    newSpecId: string,
    currentSelections: string[],
  ): ExclusionConflict[] {
    const conflicts: ExclusionConflict[] = [];
    const exclusions = ucDataLayer.getExclusionsForNode(newSpecId);
    for (const exclusion of exclusions) {
      const conflictingNode = exclusion.nodes.find(
        (n: string) => n !== newSpecId && currentSelections.includes(n),
      );

      if (conflictingNode) {
        // const conflictingSpec = ucDataLayer.getSpecification(conflictingNode);
        conflicts.push({
          id: uuidv4(),
          key: this.generateConflictKey([conflictingNode, newSpecId]),
          type: "exclusion",
          // field: conflictingSpec?.field_name || "",
          existingValue: conflictingNode,
          proposedValue: newSpecId,
          description: exclusion.reason,
          exclusionId: exclusion.id,
          affectedNodes: [newSpecId, conflictingNode],
          resolution: exclusion.question_template,
        });
        console.log(`[UCDataLayer]   🚫 Exclusion conflict: ${exclusion.id}`);
      }
    }

    return conflicts;
  }

  detectCascadeConflicts(
    newSpecId: string,
    currentSelections: string[],
  ): CascadeConflict[] {
    const conflicts: CascadeConflict[] = [];
    const requiredNodes = ucDataLayer.getRequiredNodes(newSpecId);
    for (const reqNode of requiredNodes) {
      // Simple recursive check without cycle detection (dataset guarantees no cycles)
      const cascadeConflicts = this.detectOverwriteConflicts(
        reqNode,
        currentSelections,
      );

      cascadeConflicts.forEach((c) => {
        conflicts.push({
          id: uuidv4(),
          key: this.generateConflictKey([
            c.existingValue,
            c.proposedValue,
            newSpecId,
          ]),
          type: "cascade",
          description: `Required by ${newSpecId}: ${c.description}`,
          affectedNodes: [c.existingValue, c.proposedValue, newSpecId],
        });
      });
    }

    return conflicts;
  }

  detectConstraintConflicts(
    newSpecId: string,
    currentSelections: string[],
  ): ConstraintConflict[] {
    const conflicts: ConstraintConflict[] = [];
    const newSpec = ucDataLayer.getSpecification(newSpecId);
    if (!newSpec) return conflicts;

    const fieldName = newSpec.field_name;
    const validOptions = ucDataLayer.getValidOptionsForField(fieldName || "", [
      ...currentSelections,
      newSpecId,
    ]);
    if (fieldName && validOptions.length === 0) {
      conflicts.push({
        id: uuidv4(),
        type: "field_constraint",
        field: fieldName,
        key: fieldName,
        // existingValue: currentSelections.join(","),
        // proposedValue: newSpecId,
        description: `Adding ${newSpecId} would leave field "${fieldName}" with no valid options`,
        affectedNodes: currentSelections,
      });
      console.log(
        `[UCDataLayer]   🚨 Field constraint violation for "${fieldName}"`,
      );
    }
    return conflicts;
  }

  private generateDefaultOverwriteOptions(
    conflict: OverwriteConflict,
    existing: string,
    proposed: string,
  ): OverwriteResolutionOption[] {
    return [
      {
        id: "option-a",
        description: `Keep ${existing}`,
        action: "keep_existing",
        targetNodes: [conflict.existingValue],
        expectedOutcome: `${existing} remains selected`,
      },
      {
        id: "option-b",
        description: `Select ${proposed}`,
        action: "apply_new",
        targetNodes: [conflict.proposedValue],
        expectedOutcome: `${proposed} will be selected`,
      },
    ];
  }

  private generateDefaultExclusionOptions(
    conflict: ExclusionConflict,
    existing: string,
    proposed: string,
  ): ExclusionResolutionOption[] {
    return [
      {
        id: "option-a",
        description: `Keep ${existing}`,
        action: "select_option_a",
        targetNodes: [conflict.existingValue],
        expectedOutcome: `${existing} remains selected`,
      },
      {
        id: "option-b",
        description: `Select ${proposed}`,
        action: "select_option_b",
        targetNodes: [conflict.proposedValue],
        expectedOutcome: `${proposed} will be selected`,
      },
    ];
  }

  /**
   * Apply conflict resolution
   */
  async resolveConflict(
    conflictId: string,
    action: "keep_existing" | "apply_new",
    currentSelections: string[],
  ): Promise<{
    newSelections: string[];
    changes: {
      removed: string[];
      added: string[];
      timestamp: Date;
    };
  }> {
    console.log(
      `[ConflictResolver] ✅ resolveConflict(${conflictId}, ${action})`,
    );

    const conflict = this.conflictHistory.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const changes = {
      removed: [] as string[],
      added: [] as string[],
      timestamp: new Date(),
    };

    let newSelections = [...currentSelections];

    if (action === "apply_new") {
      const [existingNode, proposedNode] = conflict.affectedNodes;

      // Remove conflicting nodes
      if (
        conflict.type === "field_overwrite" ||
        conflict.type === "exclusion"
      ) {
        newSelections = newSelections.filter((id) => id !== existingNode);
        changes.removed.push(existingNode);
      }

      // Handle cascade removals
      if (conflict.type === "cascade") {
        const impact = this.getConflictImpact(
          { proposedValue: proposedNode, affectedNodes: [existingNode] },
          currentSelections,
        );

        impact.toRemove.forEach((node) => {
          newSelections = newSelections.filter((id) => id !== node);
          changes.removed.push(node);
        });
      }

      // Add new node
      if (!newSelections.includes(proposedNode)) {
        newSelections.push(proposedNode);
        changes.added.push(proposedNode);
      }

      // Handle dependencies
      const dependencies = ucDataLayer.getRequiredNodes(proposedNode);
      dependencies.forEach((dep) => {
        if (!newSelections.includes(dep)) {
          newSelections.push(dep);
          changes.added.push(dep);
        }
      });
    }

    // Update conflict status
    conflict.cycleCount = (conflict.cycleCount || 0) + 1;
    conflict.lastUpdated = new Date();

    // Store resolution
    this.resolutionHistory.push({
      conflictId,
      action,
      nodeToRemove: changes.removed[0],
      nodeToAdd: changes.added[0],
      userChoice: action,
      timestamp: new Date(),
    });

    console.log(
      `[ConflictResolver]   → Removed: ${changes.removed.length}, Added: ${changes.added.length}`,
    );

    return { newSelections, changes };
  }

  /**
   * Get resolution history for reversal
   */
  getResolutionHistory(): ConflictResolution[] {
    return this.resolutionHistory;
  }

  /**
   * Reverse a previous resolution
   */
  reverseResolution(
    resolutionIndex: number,
    currentSelections: string[],
  ): string[] {
    const resolution = this.resolutionHistory[resolutionIndex];
    if (!resolution) return currentSelections;

    console.log(
      `[ConflictResolver] ↩️ Reversing resolution from ${resolution.timestamp}`,
    );

    let newSelections = [...currentSelections];

    // Reverse the action
    if (resolution.action === "apply_new") {
      // Remove what was added
      if (resolution.nodeToAdd) {
        newSelections = newSelections.filter(
          (id) => id !== resolution.nodeToAdd,
        );
      }

      // Re-add what was removed
      if (
        resolution.nodeToRemove &&
        !newSelections.includes(resolution.nodeToRemove)
      ) {
        newSelections.push(resolution.nodeToRemove);
      }
    }

    return newSelections;
  }

  /**
   * Detect fields that have zero valid options (CONFLICTS!)
   */
  // detectFieldConflicts(
  //   currentSelections: string[]
  // ): Array<{ field: string; reason: string }> {
  //   console.log(
  //     `[UCDataLayer] 🚨 detectFieldConflicts(${currentSelections.length} selections)`
  //   );

  //   const conflicts: Array<{ field: string; reason: string }> = [];
  //   const allFields = ucDataLayer.getAllFormFields();

  //   allFields.forEach((field) => {
  //     const validOptions = ucDataLayer.getValidOptionsForField(
  //       field,
  //       currentSelections
  //     );

  //     if (validOptions.length === 0) {
  //       conflicts.push({
  //         field,
  //         reason: `All options for "${field}" are excluded by current selections`,
  //       });
  //       console.log(`[UCDataLayer]   🚨 CONFLICT on field: ${field}`);
  //     }
  //   });

  //   console.log(`[UCDataLayer]   → Found ${conflicts.length} field conflicts`);
  //   return conflicts;
  // }
}

export const conflictResolver = new ConflictResolver();

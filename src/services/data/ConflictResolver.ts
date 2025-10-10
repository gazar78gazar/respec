/**
 * ConflictResolver - Unified conflict detection & resolution for UC8
 * Replaces old ExclusionEngine and integrates with existing conflict logging
 */

import { ucDataLayer } from './UCDataLayer';
import { Conflict, ConflictType, ResolutionOption, ConflictResolution } from './UCDataTypes';

export class ConflictResolver {
  private conflictHistory: Map<string, Conflict> = new Map();

  /**
   * Main entry point - detect all conflicts for a proposed change
   */
  detectConflicts(
    newSpecId: string,
    currentSelections: string[]
  ): Conflict[] {
    console.log(`[ConflictResolver] 🔍 detectConflicts(${newSpecId})`);

    const conflicts: Conflict[] = [];
    const overwriteConflicts = ucDataLayer.detectOverwriteConflicts(newSpecId, currentSelections);

    // Convert data layer conflicts to standard Conflict format
    // Pass raw UC8 data - agent will generate A/B question from reason + question_template
    overwriteConflicts.forEach(oc => {
      const conflictId = `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const conflict: Conflict = {
        id: conflictId,
        type: oc.type as ConflictType,
        conflictingNodes: [oc.existingValue, oc.proposedValue],
        description: oc.reason,
        resolution: oc.resolution, // UC8 question_template for agent
        cycleCount: 0,
        firstDetected: new Date(),
        lastUpdated: new Date()
      };

      conflicts.push(conflict);
      this.conflictHistory.set(conflictId, conflict);
    });

    console.log(`[ConflictResolver]   → Found ${conflicts.length} conflicts`);
    return conflicts;
  }

  /**
   * Apply conflict resolution
   */
  async resolveConflict(
    conflictId: string,
    action: 'keep_existing' | 'apply_new',
    currentSelections: string[]
  ): Promise<{
    newSelections: string[];
    changes: {
      removed: string[];
      added: string[];
      timestamp: Date;
    };
  }> {
    console.log(`[ConflictResolver] ✅ resolveConflict(${conflictId}, ${action})`);

    const conflict = this.conflictHistory.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const changes = {
      removed: [] as string[],
      added: [] as string[],
      timestamp: new Date()
    };

    let newSelections = [...currentSelections];

    if (action === 'apply_new') {
      const [existingNode, proposedNode] = conflict.conflictingNodes;

      // Remove conflicting nodes (exclusion)
      if (conflict.type === ConflictType.EXCLUSION) {
        newSelections = newSelections.filter(id => id !== existingNode);
        changes.removed.push(existingNode);
      }

      // Handle cascade removals
      if (conflict.type === ConflictType.CASCADE) {
        const impact = ucDataLayer.getConflictImpact(
          { proposedValue: proposedNode, affectedNodes: [existingNode] },
          currentSelections
        );

        impact.toRemove.forEach(node => {
          newSelections = newSelections.filter(id => id !== node);
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
      dependencies.forEach(dep => {
        if (!newSelections.includes(dep)) {
          newSelections.push(dep);
          changes.added.push(dep);
        }
      });
    }

    // Update conflict status
    conflict.cycleCount = (conflict.cycleCount || 0) + 1;
    conflict.lastUpdated = new Date();

    console.log(`[ConflictResolver]   → Removed: ${changes.removed.length}, Added: ${changes.added.length}`);

    return { newSelections, changes };
  }
}

export const conflictResolver = new ConflictResolver();

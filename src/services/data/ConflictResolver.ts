/**
 * ConflictResolver - Unified conflict detection & resolution for UC8
 * Replaces old ExclusionEngine and integrates with existing conflict logging
 */

import { ucDataLayer } from './UCDataLayer';
import { Conflict, ConflictType, ResolutionOption, ConflictResolution } from './UCDataTypes';

export class ConflictResolver {
  private conflictHistory: Map<string, Conflict> = new Map();
  private resolutionHistory: ConflictResolution[] = [];

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
    overwriteConflicts.forEach(oc => {
      const conflictId = `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const conflict: Conflict = {
        id: conflictId,
        type: oc.type as ConflictType,
        conflictingNodes: [oc.existingValue, oc.proposedValue],
        description: oc.reason,
        resolution: oc.resolution,
        resolutionOptions: this.generateResolutionOptions(oc, currentSelections),
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
   * Generate resolution options for agent to present
   */
  private generateResolutionOptions(conflict: any, currentSelections: string[]): ResolutionOption[] {
    const existing = ucDataLayer.getNodeName(conflict.existingValue);
    const proposed = ucDataLayer.getNodeName(conflict.proposedValue);

    switch (conflict.type) {
      case 'field_overwrite':
        return [
          {
            id: 'keep-existing',
            description: `Keep ${existing}`,
            action: 'keep_existing',
            targetNodes: [conflict.existingValue],
            expectedOutcome: `${existing} remains selected`
          },
          {
            id: 'apply-new',
            description: `Change to ${proposed}`,
            action: 'apply_new',
            targetNodes: [conflict.proposedValue],
            expectedOutcome: `${proposed} will replace ${existing}`
          }
        ];

      case 'exclusion':
        // Use question template from exclusion if available
        if (conflict.resolution) {
          // Question template available but not currently used for option generation
          return [
            {
              id: 'option-a',
              description: existing,
              action: 'keep_existing',
              targetNodes: [conflict.existingValue],
              expectedOutcome: `Keep ${existing}`
            },
            {
              id: 'option-b',
              description: proposed,
              action: 'apply_new',
              targetNodes: [conflict.proposedValue],
              expectedOutcome: `Select ${proposed}`
            }
          ];
        }
        // Fallback to default options
        return this.generateDefaultOptions(conflict, existing, proposed);

      case 'cascade': {
        const impact = ucDataLayer.getConflictImpact(conflict, currentSelections);
        return [
          {
            id: 'cancel',
            description: 'Cancel change',
            action: 'keep_existing',
            targetNodes: conflict.affectedNodes,
            expectedOutcome: 'No changes will be made'
          },
          {
            id: 'apply-cascade',
            description: `Apply changes (affects ${impact.toRemove.length} items)`,
            action: 'apply_new',
            targetNodes: [...impact.toRemove, ...impact.toAdd],
            expectedOutcome: `Will remove ${impact.toRemove.length} items and add ${impact.toAdd.length}`
          }
        ];
      }
      default:
        return this.generateDefaultOptions(conflict, existing, proposed);
    }
  }

  private generateDefaultOptions(conflict: any, existing: string, proposed: string): ResolutionOption[] {
    return [
      {
        id: 'option-a',
        description: `Keep ${existing}`,
        action: 'keep_existing',
        targetNodes: [conflict.existingValue],
        expectedOutcome: `${existing} remains selected`
      },
      {
        id: 'option-b',
        description: `Select ${proposed}`,
        action: 'apply_new',
        targetNodes: [conflict.proposedValue],
        expectedOutcome: `${proposed} will be selected`
      }
    ];
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

      // Remove conflicting nodes
      if (conflict.type === ConflictType.FIELD_OVERWRITE ||
          conflict.type === ConflictType.EXCLUSION) {
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

    // Store resolution
    this.resolutionHistory.push({
      conflictId,
      action,
      nodeToRemove: changes.removed[0],
      nodeToAdd: changes.added[0],
      userChoice: action,
      timestamp: new Date()
    });

    console.log(`[ConflictResolver]   → Removed: ${changes.removed.length}, Added: ${changes.added.length}`);

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
    currentSelections: string[]
  ): string[] {
    const resolution = this.resolutionHistory[resolutionIndex];
    if (!resolution) return currentSelections;

    console.log(`[ConflictResolver] ↩️ Reversing resolution from ${resolution.timestamp}`);

    let newSelections = [...currentSelections];

    // Reverse the action
    if (resolution.action === 'apply_new') {
      // Remove what was added
      if (resolution.nodeToAdd) {
        newSelections = newSelections.filter(id => id !== resolution.nodeToAdd);
      }

      // Re-add what was removed
      if (resolution.nodeToRemove && !newSelections.includes(resolution.nodeToRemove)) {
        newSelections.push(resolution.nodeToRemove);
      }
    }

    return newSelections;
  }
}

export const conflictResolver = new ConflictResolver();

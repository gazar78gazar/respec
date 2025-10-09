/**
 * DependencyResolver - Handles specification-level dependencies ("requires")
 * Validates that auto-added dependencies don't create conflicts
 */

import { ucDataLayer } from './UCDataLayer';

export class DependencyResolver {

  /**
   * Check if all dependencies for a spec are satisfied
   */
  checkDependencies(specId: string, selectedNodes: string[]): {
    satisfied: boolean;
    missing: string[];
    missingByCategory: Record<string, string[]>;
  } {
    console.log(`[DependencyResolver] 🔗 checkDependencies(${specId})`);

    const requiredNodes = ucDataLayer.getRequiredNodes(specId);
    if (requiredNodes.length === 0) {
      console.log(`[DependencyResolver]   ✓ No dependencies`);
      return { satisfied: true, missing: [], missingByCategory: {} };
    }

    const spec = ucDataLayer.getSpecification(specId);
    const requires = spec?.requires || {};

    const missingByCategory: Record<string, string[]> = {};
    let allSatisfied = true;

    // Check each category (AND across categories, OR within)
    Object.entries(requires).forEach(([category, nodes]: [string, any]) => {
      if (!Array.isArray(nodes)) return;

      // At least ONE node from this category must be selected (OR logic)
      const hasAny = nodes.some((reqNode: string) => selectedNodes.includes(reqNode));

      if (!hasAny) {
        missingByCategory[category] = nodes;
        allSatisfied = false;
        console.log(`[DependencyResolver]   ✗ Missing ${category}: ${nodes.join(' OR ')}`);
      } else {
        console.log(`[DependencyResolver]   ✓ Satisfied ${category}`);
      }
    });

    const allMissing = Object.values(missingByCategory).flat();

    return {
      satisfied: allSatisfied,
      missing: allMissing,
      missingByCategory
    };
  }

  /**
   * Auto-add missing dependencies WITH CONFLICT VALIDATION
   * Returns result with conflicts if any dependencies would cause conflicts
   */
  autoAddDependencies(
    specId: string,
    selectedNodes: string[]
  ): {
    updatedSelections: string[];
    addedNodes: string[];
    conflicts: Array<{node: string; conflicts: any[]}>;
    success: boolean;
  } {
    console.log(`[DependencyResolver] ➕ autoAddDependencies(${specId})`);

    const check = this.checkDependencies(specId, selectedNodes);
    if (check.satisfied) {
      console.log(`[DependencyResolver]   ✓ All dependencies satisfied`);
      return {
        updatedSelections: selectedNodes,
        addedNodes: [],
        conflicts: [],
        success: true
      };
    }

    const updatedSelections = [...selectedNodes];
    const addedNodes: string[] = [];
    const conflicts: Array<{node: string; conflicts: any[]}> = [];

    // Try to add non-conflicting dependencies
    Object.entries(check.missingByCategory).forEach(([category, nodes]) => {
      let added = false;

      // Try each option in order until we find one without conflicts
      for (const candidateNode of nodes) {
        if (!updatedSelections.includes(candidateNode)) {
          // CHECK FOR CONFLICTS BEFORE ADDING
          const potentialConflicts = ucDataLayer.detectOverwriteConflicts(
            candidateNode,
            updatedSelections
          );

          if (potentialConflicts.length === 0) {
            // No conflicts, safe to add
            updatedSelections.push(candidateNode);
            addedNodes.push(candidateNode);
            console.log(`[DependencyResolver]   ➕ Auto-added ${candidateNode} (${category}) - no conflicts`);
            added = true;
            break;
          } else {
            // This option has conflicts, try next
            console.log(`[DependencyResolver]   ⚠️ ${candidateNode} has conflicts, trying next option`);
            conflicts.push({ node: candidateNode, conflicts: potentialConflicts });
          }
        }
      }

      if (!added) {
        // All options have conflicts
        console.log(`[DependencyResolver]   ❌ No conflict-free option for ${category}`);
      }
    });

    return {
      updatedSelections,
      addedNodes,
      conflicts,
      success: addedNodes.length > 0 || check.satisfied
    };
  }

  /**
   * Get human-readable dependency message
   */
  getDependencyMessage(specId: string): string {
    const spec = ucDataLayer.getSpecification(specId);
    if (!spec?.requires) return '';

    const messages: string[] = [];
    Object.entries(spec.requires).forEach(([category, nodes]: [string, any]) => {
      if (Array.isArray(nodes) && nodes.length > 0) {
        const names = nodes.map((id: string) => ucDataLayer.getNodeName(id));
        messages.push(`${category}: ${names.join(' OR ')}`);
      }
    });

    return messages.join(', ');
  }
}

export const dependencyResolver = new DependencyResolver();

/**
 * UCDataLayer - Single point of access for ALL UC dataset operations
 *
 * Design: Singleton, loads dataset once at startup, provides simple getters
 * Logging: Every method logs to console for debugging
 * Error Handling: NONE - fail fast (MVP only)
 */

import { UCDataset, UCScenario, UCRequirement, UCSpecification, UCComment, UCExclusion } from './UCDataTypes';

export class UCDataLayer {
  private dataset: UCDataset | null = null;
  private readonly version: 'UC8' = 'UC8'; // FIXED to UC8 only

  // ============= INITIALIZATION =============

  async load(): Promise<void> {
    console.log(`[UCDataLayer] 📂 Loading dataset version: ${this.version}`);

    const path = '/uc_8.0_2.1.json';
    const response = await fetch(path);
    this.dataset = await response.json();

    if (!this.dataset) {
      throw new Error('Failed to load UC8 dataset');
    }

    console.log(`[UCDataLayer] ✅ Loaded ${this.version}:`, {
      scenarios: Object.keys(this.dataset.scenarios || {}).length,
      requirements: Object.keys(this.dataset.requirements || {}).length,
      specifications: Object.keys(this.dataset.specifications || {}).length,
      exclusions: Object.keys(this.dataset.exclusions || {}).length,
      comments: Object.keys(this.dataset.comments || {}).length
    });
  }

  isLoaded(): boolean {
    return this.dataset !== null;
  }

  getVersion(): 'UC8' {
    return this.version;
  }

  // ============= NODE ACCESS =============

  /**
   * Get any node by ID (auto-detects type from ID prefix)
   * S## = scenario, R## = requirement, P## = specification, C## = comment
   */
  getNode(id: string): any {
    console.log(`[UCDataLayer] 🔍 getNode(${id})`);

    const node =
      this.dataset!.scenarios?.[id] ||
      this.dataset!.requirements?.[id] ||
      this.dataset!.specifications?.[id] ||
      this.dataset!.comments?.[id];

    if (node) {
      console.log(`[UCDataLayer]   ✓ Found: ${node.name} (type: ${node.type || 'unknown'})`);
    } else {
      console.log(`[UCDataLayer]   ✗ Not found: ${id}`);
    }

    return node;
  }

  getScenario(id: string): UCScenario | undefined {
    console.log(`[UCDataLayer] 🎬 getScenario(${id})`);
    return this.dataset!.scenarios?.[id];
  }

  getRequirement(id: string): UCRequirement | undefined {
    console.log(`[UCDataLayer] 📋 getRequirement(${id})`);
    return this.dataset!.requirements?.[id];
  }

  getSpecification(id: string): UCSpecification | undefined {
    console.log(`[UCDataLayer] 🔧 getSpecification(${id})`);
    return this.dataset!.specifications?.[id];
  }

  getComment(id: string): UCComment | undefined {
    console.log(`[UCDataLayer] 💬 getComment(${id})`);
    return this.dataset!.comments?.[id];
  }

  getAllSpecifications(): UCSpecification[] {
    console.log(`[UCDataLayer] 📦 getAllSpecifications()`);
    return Object.values(this.dataset!.specifications || {});
  }

  getAllRequirements(): UCRequirement[] {
    console.log(`[UCDataLayer] 📦 getAllRequirements()`);
    return Object.values(this.dataset!.requirements || {});
  }

  getAllScenarios(): UCScenario[] {
    console.log(`[UCDataLayer] 📦 getAllScenarios()`);
    return Object.values(this.dataset!.scenarios || {});
  }

  getAllComments(): UCComment[] {
    console.log(`[UCDataLayer] 📦 getAllComments()`);
    return Object.values(this.dataset!.comments || {});
  }

  // ============= EXCLUSION QUERIES =============

  getExclusion(id: string): UCExclusion | undefined {
    console.log(`[UCDataLayer] ⚠️ getExclusion(${id})`);
    return this.dataset!.exclusions?.[id];
  }

  /**
   * Get all exclusions that involve a specific node
   */
  getExclusionsForNode(nodeId: string): UCExclusion[] {
    console.log(`[UCDataLayer] ⚠️ getExclusionsForNode(${nodeId})`);

    const exclusions = Object.values(this.dataset!.exclusions || {})
      .filter((e: UCExclusion) => e.nodes && e.nodes.includes(nodeId));

    console.log(`[UCDataLayer]   → Found ${exclusions.length} exclusions`);
    exclusions.forEach((e: UCExclusion) => {
      console.log(`[UCDataLayer]     • ${e.id}: ${e.nodes.join(' ↔ ')} (${e.type})`);
    });

    return exclusions;
  }

  getAllExclusions(): UCExclusion[] {
    console.log(`[UCDataLayer] ⚠️ getAllExclusions()`);
    return Object.values(this.dataset!.exclusions || {});
  }

  /**
   * Check if two nodes have an exclusion between them
   */
  hasExclusionBetween(nodeId1: string, nodeId2: string): boolean {
    const exclusions = Object.values(this.dataset!.exclusions || {});

    const found = exclusions.find((e: UCExclusion) =>
      e.nodes &&
      e.nodes.includes(nodeId1) &&
      e.nodes.includes(nodeId2)
    );

    if (found) {
      console.log(`[UCDataLayer]   🚫 EXCLUSION: ${nodeId1} ↔ ${nodeId2} (${found.type})`);
    }

    return !!found;
  }

  /**
   * Get the exclusion object between two nodes (if exists)
   */
  getExclusionBetween(nodeId1: string, nodeId2: string): UCExclusion | null {
    const exclusions = Object.values(this.dataset!.exclusions || {});

    return exclusions.find((e: UCExclusion) =>
      e.nodes &&
      e.nodes.includes(nodeId1) &&
      e.nodes.includes(nodeId2)
    ) || null;
  }

  // ============= DEPENDENCY QUERIES =============

  /**
   * Get required nodes for a specification (UC8 format)
   * Returns flat array of all required node IDs
   */
  getRequiredNodes(specId: string): string[] {
    console.log(`[UCDataLayer] 🔗 getRequiredNodes(${specId})`);

    const spec = this.getSpecification(specId);
    if (!spec?.requires) {
      console.log(`[UCDataLayer]   → No requires field`);
      return [];
    }

    // Flatten all categories (OR within, AND across)
    const allRequired: string[] = [];
    Object.entries(spec.requires).forEach(([_category, nodes]: [string, any]) => {
      if (Array.isArray(nodes)) {
        allRequired.push(...nodes);
      }
    });

    console.log(`[UCDataLayer]   → Requires ${allRequired.length} nodes: ${allRequired.join(', ')}`);
    return allRequired;
  }

  // ============= HIERARCHY QUERIES =============

  /**
   * Get parent requirements for a specification
   */
  getParentRequirements(specId: string): UCRequirement[] {
    const spec = this.getSpecification(specId);
    if (!spec?.parent_requirements) return [];

    return spec.parent_requirements
      .map((reqId: string) => this.getRequirement(reqId))
      .filter((req): req is UCRequirement => req !== undefined);
  }

  /**
   * Get child specifications for a requirement
   */
  getChildSpecifications(reqId: string): UCSpecification[] {
    const req = this.getRequirement(reqId);
    if (!req?.specification_ids) return [];

    return req.specification_ids
      .map((specId: string) => this.getSpecification(specId))
      .filter((spec): spec is UCSpecification => spec !== undefined);
  }

  /**
   * Get parent scenarios for a requirement
   */
  getParentScenarios(reqId: string): UCScenario[] {
    const req = this.getRequirement(reqId);
    if (!req?.parent_scenarios) return [];

    return req.parent_scenarios
      .map((scenarioId: string) => this.getScenario(scenarioId))
      .filter((scenario): scenario is UCScenario => scenario !== undefined);
  }

  // ============= FORM MAPPING QUERIES =============

  /**
   * Get all specifications that map to a form field
   */
  getSpecificationsForFormField(fieldName: string): UCSpecification[] {
    console.log(`[UCDataLayer] 📋 getSpecificationsForFormField(${fieldName})`);

    const specs = Object.values(this.dataset!.specifications || {})
      .filter((spec: UCSpecification) => {
        return spec.form_mapping?.field_name === fieldName;
      });

    console.log(`[UCDataLayer]   → Found ${specs.length} specs for field "${fieldName}"`);
    return specs;
  }

  /**
   * Get form field name for a specification
   */
  getFormFieldForSpecification(specId: string): string | null {
    const spec = this.getSpecification(specId);
    const fieldName = spec?.form_mapping?.field_name || null;
    console.log(`[UCDataLayer]   → Field: ${fieldName || 'NONE'}`);
    return fieldName;
  }

  /**
   * Get all form fields (unique list)
   */
  getAllFormFields(): string[] {
    const fields = new Set<string>();

    Object.values(this.dataset!.specifications || {}).forEach((spec: UCSpecification) => {
      const fieldName = spec.form_mapping?.field_name;
      if (fieldName) fields.add(fieldName);
    });

    console.log(`[UCDataLayer] 📋 Found ${fields.size} unique form fields`);
    return Array.from(fields);
  }

  // ============= EXTENDED CONFLICT DETECTION (CRITICAL!) =============

  /**
   * Detect if adding a spec would overwrite existing selections
   * This is the KEY method for comprehensive conflict detection!
   *
   * Returns conflicts for:
   * 1. Direct field overwrites (same field, different value)
   * 2. Exclusion-triggered overwrites (incompatible specs)
   * 3. Cascade overwrites (dependencies causing conflicts)
   *
   * NOTE: Dataset guarantees no cycles, so no cycle detection needed
   */
  detectOverwriteConflicts(
    newSpecId: string,
    currentSelections: string[]
  ): Array<{
    type: 'exclusion' | 'cascade' | 'field_constraint';
    field: string;
    existingValue: string;
    proposedValue: string;
    reason: string;
    exclusionId?: string;
    affectedNodes: string[];
    resolution?: string;
  }> {
    console.log(`[UCDataLayer] 🔍 detectOverwriteConflicts(${newSpecId}, [${currentSelections.join(', ')}])`);

    const conflicts: any[] = [];
    const newSpec = this.getSpecification(newSpecId);
    if (!newSpec) return conflicts;

    // 1. Check direct field overwrites
    const fieldName = newSpec.form_mapping?.field_name;
    if (fieldName) {
      const existingSpecForField = currentSelections.find(id => {
        const spec = this.getSpecification(id);
        return spec?.form_mapping?.field_name === fieldName;
      });

      if (existingSpecForField && existingSpecForField !== newSpecId) {
        conflicts.push({
          type: 'exclusion',
          field: fieldName,
          existingValue: existingSpecForField,
          proposedValue: newSpecId,
          reason: `Field "${fieldName}" already has a value (implicit exclusion)`,
          affectedNodes: [existingSpecForField]
        });
        console.log(`[UCDataLayer]   🔄 Field-level exclusion detected for "${fieldName}"`);
      }
    }

    // 2. Check exclusion-triggered overwrites
    const exclusions = this.getExclusionsForNode(newSpecId);
    for (const exclusion of exclusions) {
      const conflictingNode = exclusion.nodes.find((n: string) =>
        n !== newSpecId && currentSelections.includes(n)
      );

      if (conflictingNode) {
        const conflictingSpec = this.getSpecification(conflictingNode);
        conflicts.push({
          type: 'exclusion',
          field: conflictingSpec?.form_mapping?.field_name || '',
          existingValue: conflictingNode,
          proposedValue: newSpecId,
          reason: exclusion.reason,
          exclusionId: exclusion.id,
          affectedNodes: [conflictingNode],
          resolution: exclusion.question_template
        });
        console.log(`[UCDataLayer]   🚫 Exclusion conflict: ${exclusion.id}`);
      }
    }

    // 3. Check cascade overwrites (dependencies causing conflicts)
    const requiredNodes = this.getRequiredNodes(newSpecId);
    for (const reqNode of requiredNodes) {
      // Simple recursive check without cycle detection (dataset guarantees no cycles)
      const cascadeConflicts = this.detectOverwriteConflicts(reqNode, currentSelections);

      conflicts.push(...cascadeConflicts.map(c => ({
        ...c,
        type: 'cascade',
        reason: `Required by ${newSpecId}: ${c.reason}`
      })));
    }

    // 4. Check if this causes field constraints (field has zero valid options)
    const validOptions = this.getValidOptionsForField(fieldName || '', [...currentSelections, newSpecId]);
    if (fieldName && validOptions.length === 0) {
      conflicts.push({
        type: 'field_constraint',
        field: fieldName,
        existingValue: currentSelections.join(','),
        proposedValue: newSpecId,
        reason: `Adding ${newSpecId} would leave field "${fieldName}" with no valid options`,
        affectedNodes: currentSelections
      });
      console.log(`[UCDataLayer]   🚨 Field constraint violation for "${fieldName}"`);
    }

    console.log(`[UCDataLayer]   → Total conflicts: ${conflicts.length}`);
    return conflicts;
  }

  /**
   * Get all specs that would be affected by a conflict resolution
   */
  getConflictImpact(
    conflict: any,
    currentSelections: string[]
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
      const requires = this.getRequiredNodes(selection);

      if (requires.some(req => toRemove.has(req))) {
        cascadeEffects.add(selection);
      }
    }

    // What gets added
    toAdd.add(conflict.proposedValue);

    // Add required dependencies
    const requiredNodes = this.getRequiredNodes(conflict.proposedValue);
    requiredNodes.forEach(node => {
      if (!currentSelections.includes(node)) {
        toAdd.add(node);
      }
    });

    console.log(`[UCDataLayer]   → Remove: ${toRemove.size}, Add: ${toAdd.size}, Cascade: ${cascadeEffects.size}`);

    return {
      toRemove: Array.from(toRemove),
      toAdd: Array.from(toAdd),
      cascadeEffects: Array.from(cascadeEffects)
    };
  }

  /**
   * Get valid options for a form field given current selections
   * Returns specifications that:
   * 1. Map to the given field
   * 2. Are NOT excluded by any currently selected nodes
   */
  getValidOptionsForField(fieldName: string, currentSelections: string[]): UCSpecification[] {
    console.log(`[UCDataLayer] ✅ getValidOptionsForField("${fieldName}", ${currentSelections.length} selections)`);
    console.log(`[UCDataLayer]   Current: [${currentSelections.join(', ')}]`);

    // Get all specs that map to this field
    const allOptions = this.getSpecificationsForFormField(fieldName);
    console.log(`[UCDataLayer]   Total options: ${allOptions.length}`);

    // Filter out options that are excluded by current selections
    const validOptions = allOptions.filter(option => {
      const isExcluded = currentSelections.some(selectedId => {
        // CRITICAL FIX: Don't check if option excludes itself
        // This caused false conflicts like "P73 ↔ P73"
        if (option.id === selectedId) {
          return false;
        }

        return this.hasExclusionBetween(option.id, selectedId);
      });

      if (isExcluded) {
        console.log(`[UCDataLayer]     ✗ ${option.id} excluded`);
      }

      return !isExcluded;
    });

    console.log(`[UCDataLayer]   ✅ Valid options: ${validOptions.length}`);

    if (validOptions.length === 0) {
      console.log(`[UCDataLayer]   🚨 CONFLICT: No valid options left for "${fieldName}"!`);
    }

    return validOptions;
  }

  /**
   * Detect fields that have zero valid options (CONFLICTS!)
   */
  detectFieldConflicts(currentSelections: string[]): Array<{field: string, reason: string}> {
    console.log(`[UCDataLayer] 🚨 detectFieldConflicts(${currentSelections.length} selections)`);

    const conflicts: Array<{field: string, reason: string}> = [];
    const allFields = this.getAllFormFields();

    allFields.forEach(field => {
      const validOptions = this.getValidOptionsForField(field, currentSelections);

      if (validOptions.length === 0) {
        conflicts.push({
          field,
          reason: `All options for "${field}" are excluded by current selections`
        });
        console.log(`[UCDataLayer]   🚨 CONFLICT on field: ${field}`);
      }
    });

    console.log(`[UCDataLayer]   → Found ${conflicts.length} field conflicts`);
    return conflicts;
  }

  // ============= UTILITY METHODS =============

  /**
   * Get readable name for a node
   */
  getNodeName(id: string): string {
    const node = this.getNode(id);
    return node?.name || id;
  }

  /**
   * Get dataset metadata
   */
  getMetadata(): any {
    return this.dataset?.metadata || {};
  }
}

// ============= SINGLETON EXPORT =============
export const ucDataLayer = new UCDataLayer();

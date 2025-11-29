/**
 * UCDataLayer - Single point of access for ALL UC dataset operations
 *
 * Design: Singleton, loads dataset once at startup, provides simple getters
 * Logging: Every method logs to console for debugging
 * Error Handling: NONE - fail fast (MVP only)
 */

import {
  UCDataset,
  UCScenario,
  UCRequirement,
  UCSpecification,
  UCComment,
  UCExclusion,
  // UCSpecificationDependency,
  Maybe,
  UCUIField,
} from "../types/UCDataTypes";

export class UCDataLayer {
  private dataset: Maybe<UCDataset> = null;

  // ============= INITIALIZATION =============

  async load(): Promise<void> {
    console.log(`[UCDataLayer] 📂 Loading dataset version`);

    const path = "/uc_8.0_2.2.json";
    const response = await fetch(path);
    this.dataset = await response.json();

    if (!this.dataset) {
      throw new Error("Failed to load UC8 dataset");
    }

    console.log(`[UCDataLayer] ✅ Loaded:`, {
      scenarios: Object.keys(this.dataset.scenarios || {}).length,
      requirements: Object.keys(this.dataset.requirements || {}).length,
      specifications: Object.keys(this.dataset.specifications || {}).length,
      exclusions: Object.keys(this.dataset.exclusions || {}).length,
      comments: Object.keys(this.dataset.comments || {}).length,
    });
  }

  isLoaded(): boolean {
    return !!this.dataset;
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
      console.log(
        `[UCDataLayer]   ✓ Found: ${node.name} (type: ${
          node.type || "unknown"
        })`
      );
    } else {
      console.log(`[UCDataLayer]   ✗ Not found: ${id}`);
    }

    return node;
  }

  getScenario(id: string): Maybe<UCScenario> {
    console.log(
      `[UCDataLayer] 🎬 getScenario(${id})`,
      this.dataset!.scenarios?.[id]
    );
    return this.dataset!.scenarios?.[id];
  }

  getRequirement(id: string): Maybe<UCRequirement> {
    console.log(
      `[UCDataLayer] 📋 getRequirement(${id})`,
      this.dataset!.requirements?.[id]
    );
    return this.dataset!.requirements?.[id];
  }

  getSpecification(id: string): Maybe<UCSpecification> {
    console.log(
      `[UCDataLayer] 🔧 getSpecification(${id})`,
      this.dataset!.specifications?.[id]
    );

    return this.dataset!.specifications?.[id];
  }

  getSpecificationsByRequirement(requirementId: string): UCSpecification[] {
    if (!this.dataset) return [];
    return Object.values(this.dataset.specifications).filter((spec) =>
      spec.parent_requirements.includes(requirementId)
    );
  }

  getComment(id: string): Maybe<UCComment> {
    console.log(
      `[UCDataLayer] 💬 getComment(${id})`,
      this.dataset!.comments?.[id]
    );
    return this.dataset!.comments?.[id];
  }

  getAllSpecifications(): UCSpecification[] {
    console.log(
      `[UCDataLayer] 📦 getAllSpecifications()`,
      Object.values(this.dataset!.specifications || {})
    );
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

  getExclusion(id: string): Maybe<UCExclusion> {
    console.log(`[UCDataLayer] ⚠️ getExclusion(${id})`);
    return this.dataset!.exclusions?.[id];
  }

  /**
   * Get all exclusions that involve a specific node
   */
  getExclusionsForNode(nodeId: string): UCExclusion[] {
    console.log(`[UCDataLayer] ⚠️ getExclusionsForNode(${nodeId})`);

    const exclusions = Object.values(this.dataset!.exclusions || {}).filter(
      (e: UCExclusion) => e.nodes && e.nodes.includes(nodeId)
    );

    console.log(`[UCDataLayer]   → Found ${exclusions.length} exclusions`);
    exclusions.forEach((e: UCExclusion) => {
      console.log(
        `[UCDataLayer]     • ${e.id}: ${e.nodes.join(" ↔ ")} (${e.type})`
      );
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

    const found = exclusions.find(
      (e: UCExclusion) =>
        e.nodes && e.nodes.includes(nodeId1) && e.nodes.includes(nodeId2)
    );

    if (found) {
      console.log(
        `[UCDataLayer]   🚫 EXCLUSION: ${nodeId1} ↔ ${nodeId2} (${found.type})`
      );
    }

    return !!found;
  }

  /**
   * Get the exclusion object between two nodes (if exists)
   */
  getExclusionBetween(nodeId1: string, nodeId2: string): Maybe<UCExclusion> {
    const exclusions = Object.values(this.dataset!.exclusions || {});

    return (
      exclusions.find(
        (e: UCExclusion) =>
          e.nodes && e.nodes.includes(nodeId1) && e.nodes.includes(nodeId2)
      ) || null
    );
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
    Object.entries(spec.requires).forEach(
      ([_category, nodes]: [string, any]) => {
        if (Array.isArray(nodes)) {
          allRequired.push(...nodes);
        }
      }
    );

    console.log(
      `[UCDataLayer]   → Requires ${
        allRequired.length
      } nodes: ${allRequired.join(", ")}`
    );
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
      .filter((req): req is UCRequirement => !!req);
  }

  /**
   * Get child specifications for a requirement
   */
  getChildSpecifications(reqId: string): UCSpecification[] {
    const req = this.getRequirement(reqId);
    if (!req?.specification_ids) return [];

    return req.specification_ids
      .map((specId: string) => this.getSpecification(specId))
      .filter((spec): spec is UCSpecification => !!spec);
  }

  /**
   * Get parent scenarios for a requirement
   */
  getParentScenarios(reqId: string): UCScenario[] {
    const req = this.getRequirement(reqId);
    if (!req?.parent_scenarios) return [];

    return req.parent_scenarios
      .map((scenarioId: string) => this.getScenario(scenarioId))
      .filter((scenario): scenario is UCScenario => !!scenario);
  }

  // ============= FORM MAPPING QUERIES =============

  /**
   * Get all specifications that map to a form field
   */
  getSpecificationsForFormField(fieldName: string): UCSpecification[] {
    console.log(`[UCDataLayer] 📋 getSpecificationsForFormField(${fieldName})`);

    const specs = Object.values(this.dataset!.specifications || {}).filter(
      (spec: UCSpecification) => spec.field_name === fieldName
    );

    console.log(
      `[UCDataLayer]   → Found ${specs.length} specs for field "${fieldName}"`
    );
    return specs;
  }

  /**
   * Get all form fields (unique list)
   */
  getAllFormFields(): string[] {
    const fields = new Set<string>();

    Object.values(this.dataset!.specifications || {}).forEach(
      (spec: UCSpecification) => {
        if (spec.field_name) fields.add(spec.field_name);
      }
    );

    console.log(`[UCDataLayer] 📋 Found ${fields.size} unique form fields`);
    return Array.from(fields);
  }

  getUiFieldByFieldName(fieldName: string): Maybe<UCUIField> {
    return this.dataset!.ui_fields[fieldName];
  }

  // ============= EXTENDED CONFLICT DETECTION (CRITICAL!) =============

  /**
   * Get valid options for a form field given current selections
   * Returns specifications that:
   * 1. Map to the given field
   * 2. Are NOT excluded by any currently selected nodes
   */
  getValidOptionsForField(
    fieldName: string,
    currentSelections: string[]
  ): UCSpecification[] {
    console.log(
      `[UCDataLayer] ✅ getValidOptionsForField("${fieldName}", ${currentSelections.length} selections)`
    );
    console.log(`[UCDataLayer]   Current: [${currentSelections.join(", ")}]`);

    // Get all specs that map to this field
    const allOptions = this.getSpecificationsForFormField(fieldName);
    console.log(`[UCDataLayer]   Total options: ${allOptions.length}`);

    // Filter out options that are excluded by current selections
    const validOptions = allOptions.filter((option) => {
      const isExcluded = currentSelections.some((selectedId) => {
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
      console.log(
        `[UCDataLayer]   🚨 CONFLICT: No valid options left for "${fieldName}"!`
      );
    }

    return validOptions;
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

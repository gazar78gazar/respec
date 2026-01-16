/**
 * UCDataLayer - Single point of access for ALL UC dataset operations
 *
 * Design: Singleton, loads dataset once at startup, provides simple getters
 * Logging: Every method logs to console for debugging
 * Error Handling: NONE - fail fast (MVP only)
 */

import {
  UCDataset,
  UCSpecification,
  UCExclusion,
  UCUIField,
  UCMetadata,
  UCNode,
} from "../types/uc-data.types";
import type { Maybe } from "../types/service.types";
import ucDatasetJson from "../config/uc_8.0_2.2.json";

export class UCDataLayer {
  private dataset: Maybe<UCDataset> = null;

  // ============= INITIALIZATION =============

  public async load(datasetOverride?: UCDataset): Promise<void> {
    console.log(`[UCDataLayer] 📂 Loading dataset version`);
    this.dataset = datasetOverride || (ucDatasetJson as unknown as UCDataset);

    if (!this.dataset) throw new Error("Failed to load UC8 dataset");

    console.log(`[UCDataLayer] ✅ Loaded:`, {
      specifications: Object.keys(this.dataset.specifications || {}).length,
      exclusions: Object.keys(this.dataset.exclusions || {}).length,
      comments: Object.keys(this.dataset.comments || {}).length,
    });
  }

  public isLoaded(): boolean {
    return !!this.dataset;
  }

  // ============= NODE ACCESS =============

  /**
   * Get any node by ID (auto-detects type from ID prefix)
   * P## = specification, C## = comment
   */
  public getNode(id: string): Maybe<UCNode> {
    console.log(`[UCDataLayer] 🔍 getNode(${id})`);

    const node =
      this.dataset!.specifications?.[id] || this.dataset!.comments?.[id];

    if (node)
      console.log(
        `[UCDataLayer]   ✓ Found: ${node.name} (type: ${
          node.type || "unknown"
        })`,
      );
    else console.log(`[UCDataLayer]   ✗ Not found: ${id}`);

    return node || null;
  }

  public getSpecification(id: string): Maybe<UCSpecification> {
    console.log(
      `[UCDataLayer] 🔧 getSpecification(${id})`,
      this.dataset!.specifications?.[id],
    );

    return this.dataset!.specifications?.[id];
  }

  public getAllSpecifications(): UCSpecification[] {
    console.log(
      `[UCDataLayer] 📦 getAllSpecifications()`,
      Object.values(this.dataset!.specifications || {}),
    );
    return Object.values(this.dataset!.specifications || {});
  }

  /**
   * Get all exclusions that involve a specific node
   */
  public getExclusionsForNode(nodeId: string): UCExclusion[] {
    console.log(`[UCDataLayer] ⚠️ getExclusionsForNode(${nodeId})`);

    const exclusions = Object.values(this.dataset!.exclusions || {}).filter(
      (e: UCExclusion) => e.nodes && e.nodes.includes(nodeId),
    );

    console.log(`[UCDataLayer]   → Found ${exclusions.length} exclusions`);
    exclusions.forEach((e: UCExclusion) => {
      console.log(
        `[UCDataLayer]     • ${e.id}: ${e.nodes.join(" ↔ ")} (${e.type})`,
      );
    });

    return exclusions;
  }

  /**
   * Check if two nodes have an exclusion between them
   */
  public hasExclusionBetween(nodeId1: string, nodeId2: string): boolean {
    const exclusions = Object.values(this.dataset!.exclusions || {});

    const found = exclusions.find(
      (e: UCExclusion) =>
        e.nodes && e.nodes.includes(nodeId1) && e.nodes.includes(nodeId2),
    );

    if (found)
      console.log(
        `[UCDataLayer]   🚫 EXCLUSION: ${nodeId1} ↔ ${nodeId2} (${found.type})`,
      );

    return !!found;
  }

  // ============= DEPENDENCY QUERIES =============

  /**
   * Get required nodes for a specification (UC8 format)
   * Returns flat array of all required node IDs
   */
  public getRequiredNodes(specId: string): string[] {
    console.log(`[UCDataLayer] 🔗 getRequiredNodes(${specId})`);

    const spec = this.getSpecification(specId);
    if (!spec?.requires) {
      console.log(`[UCDataLayer]   → No requires field`);
      return [];
    }

    // Flatten all categories (OR within, AND across)
    const allRequired: string[] = [];
    Object.entries(spec.requires).forEach(([_category, nodes]) => {
      allRequired.push(...nodes);
    });

    console.log(
      `[UCDataLayer]   → Requires ${
        allRequired.length
      } nodes: ${allRequired.join(", ")}`,
    );
    return allRequired;
  }

  // ============= FORM MAPPING QUERIES =============

  /**
   * Get all specifications that map to a form field
   */
  public getSpecificationsForFormField(fieldName: string): UCSpecification[] {
    console.log(`[UCDataLayer] 📋 getSpecificationsForFormField(${fieldName})`);

    const specs = Object.values(this.dataset!.specifications || {}).filter(
      (spec: UCSpecification) => spec.field_name === fieldName,
    );

    console.log(
      `[UCDataLayer]   → Found ${specs.length} specs for field "${fieldName}"`,
    );
    return specs;
  }

  public getUiFieldByFieldName(fieldName: string): Maybe<UCUIField> {
    return this.dataset!.ui_fields[fieldName];
  }

  /**
   * Get all UI field definitions (for building full form updates)
   */
  public getAllUiFields(): Record<string, UCUIField> {
    return this.dataset?.ui_fields || {};
  }

  public getAllUISections(): Set<string> {
    const uiFields = ucDataLayer.getAllUiFields();
    return new Set(Object.values(uiFields).map((field) => field.section));
  }

  // ============= EXTENDED CONFLICT DETECTION (CRITICAL!) =============

  /**
   * Get valid options for a form field given current selections
   * Returns specifications that:
   * 1. Map to the given field
   * 2. Are NOT excluded by any currently selected nodes
   */
  public getValidOptionsForField(
    fieldName: string,
    currentSelections: string[],
  ): UCSpecification[] {
    console.log(
      `[UCDataLayer] ✅ getValidOptionsForField("${fieldName}", ${currentSelections.length} selections)`,
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
        if (option.id === selectedId) return false;

        return this.hasExclusionBetween(option.id, selectedId);
      });

      if (isExcluded) console.log(`[UCDataLayer]     ✗ ${option.id} excluded`);

      return !isExcluded;
    });

    console.log(`[UCDataLayer]   ✅ Valid options: ${validOptions.length}`);

    if (validOptions.length === 0)
      console.log(
        `[UCDataLayer]   🚨 CONFLICT: No valid options left for "${fieldName}"!`,
      );

    return validOptions;
  }

  // ============= UTILITY METHODS =============

  /**
   * Get readable name for a node
   */
  public getNodeName(id: string): string {
    const node = this.getNode(id);
    return node?.name || id;
  }

  /**
   * Get dataset metadata
   */
  public getMetadata(): Maybe<UCMetadata> {
    return this.dataset?.metadata || null;
  }
}

// ============= SINGLETON EXPORT =============
export const ucDataLayer = new UCDataLayer();

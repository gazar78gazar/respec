/**
 * ConflictDetectionService - Advanced conflict detection and resolution system
 *
 * @deprecated Sprint 1: This service will be replaced by ConflictResolver in Sprint 2
 * Current status: Still used for form-level conflict detection
 * Migration plan: Sprint 2 will fully integrate UC8 ConflictResolver
 *
 * Integrates with semantic matching to provide real-time conflict detection
 * and intelligent resolution suggestions for form field updates.
 */

import { ucDataLayer } from "./UCDataLayer";

// TODO zeev to fix type issues

export interface FieldConflict {
  id: string;
  field: string;
  section: string;
  currentValue: string;
  newValue: string;
  severity: "info" | "warning" | "error" | "critical";
  type:
    | "value_change"
    | "constraint_violation"
    | "incompatible_specs"
    | "overwrite_warning";
  reason: string;
  confidence: number;
  suggestions?: ConflictSuggestion[];
  metadata: {
    timestamp: Date;
    source: "semantic" | "manual" | "autofill";
    originalContext?: string;
    affectedFields?: string[];
  };
}

export interface ConflictSuggestion {
  id: string;
  action: "accept" | "reject" | "modify" | "split" | "merge";
  label: string;
  description: string;
  newValue?: string;
  confidence: number;
  consequences?: string[];
}

export interface ConflictResolution {
  conflictId: string;
  action: ConflictSuggestion["action"];
  newValue?: string;
  timestamp: Date;
  applied: boolean;
}

export class ConflictDetectionService {
  private activeConflicts: Map<string, FieldConflict> = new Map();
  private resolutionHistory: ConflictResolution[] = [];
  private conflictListeners: ((conflicts: FieldConflict[]) => void)[] = [];

  // ============= CONFLICT DETECTION =============

  async detectConflicts(
    field: string,
    newValue: string,
    currentRequirements: any,
    source: "semantic" | "manual" | "autofill" = "manual",
    context?: {
      originalRequest?: string;
      confidence?: number;
      ucSpec?: string;
    }
  ): Promise<FieldConflict[]> {
    const conflicts: FieldConflict[] = [];
    const [section, fieldName] = field.split(".");
    const currentValue = this.getNestedValue(
      currentRequirements,
      section,
      fieldName
    );

    // Skip if no change
    if (currentValue === newValue) {
      return conflicts;
    }

    // 1. Value Change Detection
    if (
      currentValue &&
      currentValue !== "Not Required" &&
      newValue !== currentValue
    ) {
      const valueChangeConflict = this.createValueChangeConflict(
        field,
        section,
        fieldName,
        currentValue,
        newValue,
        source,
        context
      );
      conflicts.push(valueChangeConflict);
    }

    // 2. UC Constraint Validation
    if (context?.ucSpec) {
      const constraintConflicts = await this.detectConstraintViolations(
        field,
        newValue,
        context.ucSpec,
        currentRequirements
      );
      conflicts.push(...constraintConflicts);
    }

    // 3. Cross-field Compatibility Checks
    const compatibilityConflicts = await this.detectCompatibilityIssues(
      field,
      newValue,
      currentRequirements
    );
    conflicts.push(...compatibilityConflicts);

    // 4. Semantic Confidence Warnings
    if (
      source === "semantic" &&
      context?.confidence &&
      context.confidence < 0.7
    ) {
      const confidenceWarning = this.createConfidenceWarning(
        field,
        section,
        fieldName,
        currentValue,
        newValue,
        context.confidence,
        context.originalRequest
      );
      conflicts.push(confidenceWarning);
    }

    // Store conflicts and notify listeners
    conflicts.forEach((conflict) => {
      this.activeConflicts.set(conflict.id, conflict);
    });

    this.notifyConflictListeners();
    return conflicts;
  }

  private createValueChangeConflict(
    field: string,
    section: string,
    fieldName: string,
    currentValue: string,
    newValue: string,
    source: "semantic" | "manual" | "autofill",
    context?: any
  ): FieldConflict {
    const severity = this.calculateSeverity(currentValue, newValue, source);

    return {
      id: `value_change_${field}_${Date.now()}`,
      field,
      section,
      currentValue,
      newValue,
      severity,
      type: "value_change",
      reason: `Field "${fieldName}" will be changed from "${currentValue}" to "${newValue}"`,
      confidence: context?.confidence || 0.8,
      suggestions: this.generateValueChangeSuggestions(
        currentValue,
        newValue,
        source
      ),
      metadata: {
        timestamp: new Date(),
        source,
        originalContext: context?.originalRequest,
        affectedFields: [],
      },
    };
  }

  private createConfidenceWarning(
    field: string,
    section: string,
    fieldName: string,
    currentValue: string,
    newValue: string,
    confidence: number,
    originalRequest?: string
  ): FieldConflict {
    return {
      id: `confidence_${field}_${Date.now()}`,
      field,
      section,
      currentValue,
      newValue,
      severity: confidence < 0.5 ? "warning" : "info",
      type: "overwrite_warning",
      reason: `Low confidence extraction (${Math.round(
        confidence * 100
      )}%). Please verify this interpretation.`,
      confidence,
      suggestions: [
        {
          id: "verify",
          action: "modify",
          label: "Verify and Edit",
          description: "Review and manually adjust the extracted value",
          confidence: 0.9,
          consequences: ["Manual verification improves accuracy"],
        },
        {
          id: "accept_anyway",
          action: "accept",
          label: "Accept Anyway",
          description: "Use the extracted value despite low confidence",
          confidence: confidence,
          consequences: ["May need correction later"],
        },
      ],
      metadata: {
        timestamp: new Date(),
        source: "semantic",
        originalContext: originalRequest,
        affectedFields: [],
      },
    };
  }

  private async detectConstraintViolations(
    field: string,
    newValue: string,
    specId: string,
    currentRequirements: any
  ): Promise<FieldConflict[]> {
    const conflicts: FieldConflict[] = [];

    try {
      // const ucSpec = this.ucEngine.getSpecification(ucSpecId);
      const spec = ucDataLayer.getSpecification(specId);
      if (!spec) return conflicts;

      alert('!!! detectConstraintViolations should be re-implemented')

      // Check if value violates UC constraints
      // const validation = this.ucEngine.validateSpecification(
      //   ucSpec,
      //   newValue
      // );
      // if (!validation.isValid) {
      //   conflicts.push({
      //     id: `constraint_${field}_${Date.now()}`,
      //     field,
      //     section: field.split(".")[0],
      //     currentValue: this.getNestedValue(
      //       currentRequirements,
      //       ...field.split(".")
      //     ),
      //     newValue,
      //     severity: "error",
      //     type: "constraint_violation",
      //     reason: `Value "${newValue}" violates UC constraints for ${
      //       ucSpec.name
      //     }: ${validation.errors.join(", ")}`,
      //     confidence: 0.9,
      //     suggestions: this.generateConstraintSuggestions(ucSpec, newValue),
      //     metadata: {
      //       timestamp: new Date(),
      //       source: "semantic",
      //       affectedFields: [],
      //     },
      //   });
      // }
    } catch (error) {
      console.warn("[ConflictDetection] UC constraint check failed:", error);
    }

    return conflicts;
  }

  private async detectCompatibilityIssues(
    field: string,
    newValue: string,
    currentRequirements: any
  ): Promise<FieldConflict[]> {
    const conflicts: FieldConflict[] = [];

    // Example compatibility checks
    const [section, fieldName] = field.split(".");

    // Processor-Memory compatibility
    if (
      fieldName === "processorType" &&
      newValue.toLowerCase().includes("intel")
    ) {
      const memoryType = this.getNestedValue(
        currentRequirements,
        "computePerformance",
        "memoryType"
      );
      if (
        memoryType &&
        memoryType.toLowerCase().includes("ecc") &&
        !newValue.toLowerCase().includes("xeon")
      ) {
        conflicts.push({
          id: `compat_processor_memory_${Date.now()}`,
          field,
          section,
          currentValue: this.getNestedValue(
            currentRequirements,
            section,
            fieldName
          ),
          newValue,
          severity: "warning",
          type: "incompatible_specs",
          reason:
            "Intel consumer processors may not support ECC memory. Consider Xeon series for ECC support.",
          confidence: 0.8,
          suggestions: [
            {
              id: "suggest_xeon",
              action: "modify",
              label: "Suggest Intel Xeon",
              description:
                "Change to Intel Xeon processor for ECC memory support",
              newValue: newValue.replace("Core", "Xeon"),
              confidence: 0.9,
              consequences: ["Higher cost", "Better reliability"],
            },
          ],
          metadata: {
            timestamp: new Date(),
            source: "semantic",
            affectedFields: ["computePerformance.memoryType"],
          },
        });
      }
    }

    // Power-Performance compatibility
    if (fieldName === "maxPowerConsumption") {
      const processorType = this.getNestedValue(
        currentRequirements,
        "computePerformance",
        "processorType"
      );
      if (
        processorType &&
        processorType.toLowerCase().includes("i7") &&
        newValue.includes("<") &&
        parseInt(newValue) < 15
      ) {
        conflicts.push({
          id: `compat_power_processor_${Date.now()}`,
          field,
          section,
          currentValue: this.getNestedValue(
            currentRequirements,
            section,
            fieldName
          ),
          newValue,
          severity: "warning",
          type: "incompatible_specs",
          reason:
            "High-performance processors typically require more than 15W. Low power target may limit performance.",
          confidence: 0.85,
          suggestions: [
            {
              id: "increase_power",
              action: "modify",
              label: "Increase Power Budget",
              description:
                "Allow higher power consumption for better performance",
              newValue: "< 25W",
              confidence: 0.9,
              consequences: ["Better performance", "Higher power consumption"],
            },
            {
              id: "lower_performance",
              action: "accept",
              label: "Accept Low Power",
              description:
                "Keep low power target, may need lower-performance processor",
              confidence: 0.7,
              consequences: ["Lower performance", "Longer battery life"],
            },
          ],
          metadata: {
            timestamp: new Date(),
            source: "semantic",
            affectedFields: ["computePerformance.processorType"],
          },
        });
      }
    }

    return conflicts;
  }

  // ============= CONFLICT RESOLUTION =============

  async resolveConflict(
    conflictId: string,
    action: ConflictSuggestion["action"],
    newValue?: string
  ): Promise<ConflictResolution> {
    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const resolution: ConflictResolution = {
      conflictId,
      action,
      newValue:
        newValue ||
        (action === "accept" ? conflict.newValue : conflict.currentValue),
      timestamp: new Date(),
      applied: false,
    };

    try {
      // Apply the resolution
      if (action === "accept" || (action === "modify" && newValue)) {
        // The actual form update will be handled by the calling code
        resolution.applied = true;
      } else if (action === "reject") {
        // Keep current value - no form update needed
        resolution.applied = true;
      }

      // Remove from active conflicts
      this.activeConflicts.delete(conflictId);

      // Store in resolution history
      this.resolutionHistory.push(resolution);

      // Notify listeners
      this.notifyConflictListeners();

      console.log(
        `[ConflictDetection] Resolved conflict ${conflictId} with action: ${action}`
      );
      return resolution;
    } catch (error) {
      console.error(
        `[ConflictDetection] Failed to resolve conflict ${conflictId}:`,
        error
      );
      throw error;
    }
  }

  // ============= HELPER METHODS =============

  private calculateSeverity(
    currentValue: string,
    newValue: string,
    source: "semantic" | "manual" | "autofill"
  ): FieldConflict["severity"] {
    if (source === "manual") return "info"; // Manual changes are usually intentional
    if (currentValue === "Not Required") return "info"; // Setting initial value
    if (source === "semantic") return "warning"; // AI suggestions need verification
    return "warning";
  }

  private generateValueChangeSuggestions(
    currentValue: string,
    newValue: string,
    source: string
  ): ConflictSuggestion[] {
    return [
      {
        id: "accept_new",
        action: "accept",
        label: "Accept New Value",
        description: `Update to "${newValue}"`,
        confidence: source === "semantic" ? 0.7 : 0.9,
        consequences: ["Field will be updated to new value"],
      },
      {
        id: "keep_current",
        action: "reject",
        label: "Keep Current Value",
        description: `Keep "${currentValue}"`,
        confidence: 0.9,
        consequences: ["Current value will be preserved"],
      },
      {
        id: "modify",
        action: "modify",
        label: "Edit Manually",
        description: "Enter a custom value",
        confidence: 0.95,
        consequences: ["Full control over the final value"],
      },
    ];
  }

  // private generateConstraintSuggestions( // TODO zeev to fix type issues - seems like a real logic bug
  //   spec: UCSpecification,
  //   invalidValue: string
  // ): ConflictSuggestion[] {
  //   const suggestions: ConflictSuggestion[] = [
  //     {
  //       id: "reject_invalid",
  //       action: "reject",
  //       label: "Reject Invalid Value",
  //       description: "Keep current value that meets constraints",
  //       confidence: 0.9,
  //       consequences: ["Maintains specification compliance"],
  //     },
  //   ];

  //   // Add suggestions based on UC spec type
  //   if (spec.constraints?.options) {
  //     suggestions.push({
  //       id: "suggest_valid",
  //       action: "modify",
  //       label: "Choose Valid Option",
  //       description: `Select from: ${ucSpec.constraints.options
  //         .slice(0, 3)
  //         .join(", ")}`,
  //       confidence: 0.8,
  //       consequences: ["Ensures specification compliance"],
  //     });
  //   }

  //   return suggestions;
  // }

  private getNestedValue(obj: any, ...keys: string[]): string {
    return keys.reduce((current, key) => current?.[key], obj) || "";
  }

  // ============= PUBLIC API =============

  getActiveConflicts(): FieldConflict[] {
    return Array.from(this.activeConflicts.values());
  }

  getResolutionHistory(): ConflictResolution[] {
    return [...this.resolutionHistory];
  }

  onConflictChange(listener: (conflicts: FieldConflict[]) => void): () => void {
    this.conflictListeners.push(listener);
    return () => {
      const index = this.conflictListeners.indexOf(listener);
      if (index > -1) this.conflictListeners.splice(index, 1);
    };
  }

  private notifyConflictListeners(): void {
    const conflicts = this.getActiveConflicts();
    this.conflictListeners.forEach((listener) => {
      try {
        listener(conflicts);
      } catch (error) {
        console.error("[ConflictDetection] Listener error:", error);
      }
    });
  }

  clearAllConflicts(): void {
    this.activeConflicts.clear();
    this.notifyConflictListeners();
  }

  getConflictStats(): {
    active: number;
    resolved: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const active = this.activeConflicts.size;
    const resolved = this.resolutionHistory.length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.getActiveConflicts().forEach((conflict) => {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
      bySeverity[conflict.severity] = (bySeverity[conflict.severity] || 0) + 1;
    });

    return { active, resolved, byType, bySeverity };
  }
}

// Export singleton for easy use
export const createConflictDetectionService = (): ConflictDetectionService => {
  return new ConflictDetectionService();
};

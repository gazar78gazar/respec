/**
 * UC1ValidationEngine - Core validation engine for UC1.json schema
 *
 * This engine handles:
 * 1. UC1 schema loading and parsing
 * 2. Constraint validation
 * 3. Dependency checking
 * 4. Conflict detection based on UC1 specifications
 *
 * MVP Focus: Only UC1-discovered conflicts (performance vs power)
 */

// ============= TYPES =============

export interface UC1Schema {
  metadata: UC1Metadata;
  use_case: UC1UseCase;
  domains: Record<string, UC1Domain>;
  requirements: Record<string, UC1Requirement>;
  specifications: Record<string, UC1Specification>;
}

export interface UC1Metadata {
  version: string;
  use_case_id: string;
  use_case_name: string;
  domain: string;
  last_updated: string;
  schema_version: string;
}

export interface UC1UseCase {
  id: string;
  name: string;
  domain: string;
  safety_critical: boolean;
  child: string[];
}

export interface UC1Domain {
  id: string;
  name: string;
  parent: string[];
  child: string[];
  required_areas: string[];
  dependencies: any[];
}

export interface UC1Requirement {
  id: string;
  name: string;
  area: string;
  category: string;
  parent: string[];
  child: string[];
  safety_critical: boolean;
  description: string;
  dependencies: UC1Dependency[];
}

export interface UC1Dependency {
  target: string;
  type: "all" | "any" | "none";
  inherited: boolean;
  rationale: string;
}

export interface UC1Specification {
  id: string;
  type: "specification" | "comment";
  name: string;
  form_mapping?: {
    section: string;
    category: string;
    field_name: string;
    ui_type: string;
  };
  category: string;
  parent: string[];
  selection_type?: string;
  form_field_type?: string;
  options?: string[];
  default_value?: any;
  selected_value?: any;
  description?: string;
  content?: string;
  technical_details?: UC1TechnicalDetails;
  technical_context?: any;
  dependencies: any[];
}

export interface UC1TechnicalDetails {
  type: string;
  parameter: string;
  operator: string;
  value: any;
  unit?: string;
  tier?: number;
  failure_mode?: string;
  real_time_class?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: "constraint" | "dependency" | "conflict" | "missing";
  nodeId: string;
  message: string;
  details?: any;
}

export interface ValidationWarning {
  type: string;
  nodeId: string;
  message: string;
  details?: any;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

export interface Conflict {
  type: "constraint" | "dependency" | "logical" | "cross_artifact" | "mutex";
  nodes: string[];
  description: string;
  resolution?: string;
}

export interface MutexGroup {
  name: string;
  activeSpecs: Array<{ id: string; value: any }>;
  options: string[];
}

export interface HierarchyPath {
  domain?: string;
  requirement?: string;
  specification?: string;
  path: string[];
}

// ============= MAIN ENGINE CLASS =============

export class UC1ValidationEngine {
  private schema: UC1Schema | null = null;
  private hierarchyMap: Map<string, HierarchyPath> = new Map();
  private isInitialized: boolean = false;

  /**
   * Load and parse UC1 schema from JSON file
   * SPRINT 3 FIX: Now loads UC8 dataset (uc_8.0_2.1.json) to align IDs with conflict detection
   */
  async loadSchema(schemaPath: string = "/uc_8.0_2.1.json"): Promise<void> {
    try {
      // In browser environment, fetch from public folder
      const response = await fetch(schemaPath);
      if (!response.ok) {
        throw new Error(`Failed to load UC1 schema: ${response.statusText}`);
      }

      this.schema = await response.json();
      this.buildHierarchyMap();
      this.isInitialized = true;

      console.log("[UC1ValidationEngine] Schema loaded successfully:", {
        version:
          this.schema?.metadata.schema_version || this.schema?.metadata.version,
        dataset_version: this.schema?.metadata.dataset_version,
        domains: Object.keys(this.schema?.domains || {}).length,
        requirements: Object.keys(this.schema?.requirements || {}).length,
        specifications: Object.keys(this.schema?.specifications || {}).length,
      });
    } catch (error) {
      console.error("[UC1ValidationEngine] Failed to load schema:", error);
      throw error;
    }
  }

  /**
   * Build hierarchy map for quick lookups
   */
  private buildHierarchyMap(): void {
    if (!this.schema) return;

    // Map domains
    Object.values(this.schema.domains).forEach((domain) => {
      this.hierarchyMap.set(domain.id, {
        domain: domain.id,
        path: ["use_case", domain.id],
      });
    });

    // Map requirements
    Object.values(this.schema.requirements).forEach((req) => {
      const domainId = req.parent[0];
      this.hierarchyMap.set(req.id, {
        domain: domainId,
        requirement: req.id,
        path: ["use_case", domainId, req.id],
      });
    });

    // Map specifications
    Object.values(this.schema.specifications).forEach((spec) => {
      const reqId = spec.parent[0];
      const hierarchy = this.hierarchyMap.get(reqId);
      if (hierarchy) {
        this.hierarchyMap.set(spec.id, {
          ...hierarchy,
          specification: spec.id,
          path: [...hierarchy.path, spec.id],
        });
      }
    });
  }

  /**
   * Validate a specification against UC1 constraints
   */
  validateSpecification(specId: string, value: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!this.schema || !this.isInitialized) {
      result.isValid = false;
      result.errors.push({
        type: "missing",
        nodeId: specId,
        message: "UC1 schema not loaded",
      });
      return result;
    }

    const spec = this.schema.specifications[specId];
    if (!spec) {
      result.isValid = false;
      result.errors.push({
        type: "missing",
        nodeId: specId,
        message: `Specification ${specId} not found in UC1 schema`,
      });
      return result;
    }

    // Validate against technical details constraints
    if (spec.technical_details) {
      const validation = this.validateTechnicalConstraints(spec, value);
      if (!validation.isValid) {
        result.isValid = false;
        result.errors.push(...validation.errors);
      }
      result.warnings.push(...validation.warnings);
    }

    // Validate against available options
    if (spec.options && spec.options.length > 0) {
      if (!spec.options.includes(value) && value !== "Not Required") {
        result.isValid = false;
        result.errors.push({
          type: "constraint",
          nodeId: specId,
          message: `Value "${value}" not in allowed options`,
          details: { allowedOptions: spec.options },
        });
      }
    }

    return result;
  }

  /**
   * Validate technical constraints for a specification
   */
  private validateTechnicalConstraints(
    spec: UC1Specification,
    value: any
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!spec.technical_details) return result;

    const details = spec.technical_details;

    switch (details.operator) {
      case "min":
        if (typeof value === "number" && value < details.value) {
          result.isValid = false;
          result.errors.push({
            type: "constraint",
            nodeId: spec.id,
            message: `Value ${value} below minimum ${details.value}${
              details.unit ? " " + details.unit : ""
            }`,
            details: { operator: "min", threshold: details.value },
          });
        }
        break;

      case "max":
        if (typeof value === "number" && value > details.value) {
          result.isValid = false;
          result.errors.push({
            type: "constraint",
            nodeId: spec.id,
            message: `Value ${value} exceeds maximum ${details.value}${
              details.unit ? " " + details.unit : ""
            }`,
            details: { operator: "max", threshold: details.value },
          });
        }
        break;

      case "exact":
        if (value !== details.value) {
          result.warnings.push({
            type: "constraint",
            nodeId: spec.id,
            message: `Value ${value} differs from expected ${details.value}`,
            details: { operator: "exact", expected: details.value },
          });
        }
        break;

      case "range":
        if (
          typeof details.value === "object" &&
          details.value.min &&
          details.value.max
        ) {
          if (
            typeof value === "number" &&
            (value < details.value.min || value > details.value.max)
          ) {
            result.isValid = false;
            result.errors.push({
              type: "constraint",
              nodeId: spec.id,
              message: `Value ${value} outside range ${details.value.min}-${details.value.max}`,
              details: { operator: "range", range: details.value },
            });
          }
        }
        break;
    }

    return result;
  }

  /**
   * Detect conflicts between specifications
   * MVP Focus: Performance vs Power consumption conflict
   */
  detectConflicts(
    specifications: Array<{ id: string; value: any }>,
    activeRequirements: string[] = [],
    activeDomains: string[] = []
  ): ConflictResult {
    const result: ConflictResult = {
      hasConflict: false,
      conflicts: [],
    };

    if (!this.schema) return result;

    console.log(
      `[UC1Engine] Conflict detection - specs: ${specifications.length}, reqs: ${activeRequirements.length}, domains: ${activeDomains.length}`
    );

    // Extract relevant specifications for conflict detection
    const specMap = new Map<string, any>();
    specifications.forEach((s) => {
      const spec = this.schema!.specifications[s.id];
      if (spec) {
        specMap.set(spec.name, { spec, value: s.value });
      }
    });

    // ========== LOGICAL CONFLICTS (Existing) ==========
    // PRIMARY CONFLICT: High Performance vs Low Power Consumption
    const processor = specMap.get("processor_type");
    const powerConsumption = specMap.get("max_power_consumption");

    if (processor && powerConsumption) {
      const highPerformance = this.isHighPerformanceProcessor(processor.value);
      const lowPower = this.isLowPowerConsumption(powerConsumption.value);

      if (highPerformance && lowPower) {
        result.hasConflict = true;
        result.conflicts.push({
          type: "logical",
          nodes: [processor.spec.id, powerConsumption.spec.id],
          description:
            "High-performance processor incompatible with low power consumption",
          resolution:
            "Choose either: (A) High performance with grid power (35-65W), or (B) Lower performance optimized for battery operation (10-20W)",
        });
      }
    }

    // ========== MUTEX CONFLICTS (Sprint 3 Week 1) ==========
    const mutexConflicts = this.detectMutexConflicts(
      activeDomains,
      activeRequirements,
      specifications
    );
    if (mutexConflicts.hasConflict) {
      result.hasConflict = true;
      result.conflicts.push(...mutexConflicts.conflicts);
    }

    // ========== DEPENDENCY CONFLICTS (Sprint 3 Week 1) ==========
    const depConflicts = this.detectDependencyConflicts(activeRequirements);
    if (depConflicts.hasConflict) {
      result.hasConflict = true;
      result.conflicts.push(...depConflicts.conflicts);
    }

    // ========== CONSTRAINT CONFLICTS (Sprint 3 Week 1) ==========
    const constraintConflicts = this.detectConstraintConflicts(specifications);
    if (constraintConflicts.hasConflict) {
      result.hasConflict = true;
      result.conflicts.push(...constraintConflicts.conflicts);
    }

    console.log(
      `[UC1Engine] Total conflicts detected: ${result.conflicts.length}`
    );
    return result;
  }

  /**
   * Check if processor is high performance
   */
  private isHighPerformanceProcessor(processorType: string): boolean {
    const highPerformanceProcessors = [
      "Intel Core i5",
      "Intel Core i7",
      "Intel Core i9",
      "Intel Xeon",
    ];
    return highPerformanceProcessors.includes(processorType);
  }

  /**
   * Check if power consumption is low
   */
  private isLowPowerConsumption(powerConsumption: string): boolean {
    const lowPowerOptions = ["< 10W", "10-20W"];
    return lowPowerOptions.includes(powerConsumption);
  }

  /**
   * Detect mutex conflicts - multiple mutually exclusive options selected
   * Sprint 3 Week 1: Handles domains, requirements, and specifications
   */
  private detectMutexConflicts(
    domains: string[],
    requirements: string[],
    specifications: Array<{ id: string; value: any }>
  ): ConflictResult {
    const result: ConflictResult = { hasConflict: false, conflicts: [] };

    // Check specification mutex groups
    const mutexGroups = this.identifyMutexGroups(specifications);
    mutexGroups.forEach((group) => {
      if (group.activeSpecs.length > 1) {
        result.hasConflict = true;
        result.conflicts.push({
          type: "mutex",
          nodes: group.activeSpecs.map((s) => s.id),
          description: `Multiple mutually exclusive options selected for ${group.name}`,
          resolution: `Choose one option: ${group.options.join(" OR ")}`,
        });
      }
    });

    console.log(
      `[UC1Engine] Mutex conflict detection: ${result.conflicts.length} conflicts found`
    );
    return result;
  }

  /**
   * Identify mutex groups in specifications
   * Sprint 3 Week 1: Expandable for different mutex patterns
   */
  private identifyMutexGroups(
    specifications: Array<{ id: string; value: any }>
  ): MutexGroup[] {
    if (!this.schema) return [];

    const groups: MutexGroup[] = [];

    // Mutex Group 1: Processor Types (only one processor can be selected)
    const processorSpecs = specifications.filter((s) => {
      const spec = this.schema!.specifications[s.id];
      return (
        spec &&
        spec.name === "processor_type" &&
        s.value !== null &&
        s.value !== undefined
      );
    });

    if (processorSpecs.length > 1) {
      groups.push({
        name: "Processor Type",
        activeSpecs: processorSpecs,
        options: processorSpecs.map((s) => s.value),
      });
    }

    // Mutex Group 2: Operating Systems (only one OS can be selected)
    const osSpecs = specifications.filter((s) => {
      const spec = this.schema!.specifications[s.id];
      return (
        spec &&
        spec.name === "operating_system" &&
        s.value !== null &&
        s.value !== undefined
      );
    });

    if (osSpecs.length > 1) {
      groups.push({
        name: "Operating System",
        activeSpecs: osSpecs,
        options: osSpecs.map((s) => s.value),
      });
    }

    // Mutex Group 3: Form Factors (only one form factor can be selected)
    const formFactorSpecs = specifications.filter((s) => {
      const spec = this.schema!.specifications[s.id];
      return (
        spec &&
        spec.name === "form_factor" &&
        s.value !== null &&
        s.value !== undefined
      );
    });

    if (formFactorSpecs.length > 1) {
      groups.push({
        name: "Form Factor",
        activeSpecs: formFactorSpecs,
        options: formFactorSpecs.map((s) => s.value),
      });
    }

    return groups;
  }

  /**
   * Detect dependency conflicts - missing required dependencies
   * Sprint 3 Week 1: Integrates existing checkDependencies logic
   */
  private detectDependencyConflicts(
    activeRequirements: string[]
  ): ConflictResult {
    const result: ConflictResult = { hasConflict: false, conflicts: [] };

    if (!this.schema) return result;

    activeRequirements.forEach((reqId) => {
      const depResult = this.checkDependencies(reqId, activeRequirements);

      if (!depResult.isValid) {
        depResult.errors.forEach((error) => {
          if (error.type === "dependency") {
            result.hasConflict = true;
            result.conflicts.push({
              type: "dependency",
              nodes: [reqId, error.details.dependency],
              description: error.message,
              resolution: `Add required dependency: ${error.details.dependency}. ${error.details.rationale}`,
            });
          }
        });
      }
    });

    console.log(
      `[UC1Engine] Dependency conflict detection: ${result.conflicts.length} conflicts found`
    );
    return result;
  }

  /**
   * Detect constraint conflicts - schema constraint violations
   * Sprint 3 Week 1: Integrates existing validateSpecification logic
   */
  private detectConstraintConflicts(
    specifications: Array<{ id: string; value: any }>
  ): ConflictResult {
    const result: ConflictResult = { hasConflict: false, conflicts: [] };

    if (!this.schema) return result;

    specifications.forEach((spec) => {
      const validation = this.validateSpecification(spec.id, spec.value);

      if (!validation.isValid) {
        validation.errors.forEach((error) => {
          if (error.type === "constraint") {
            result.hasConflict = true;
            result.conflicts.push({
              type: "constraint",
              nodes: [spec.id],
              description: error.message,
              resolution: error.details?.suggestedValue
                ? `Change to: ${error.details.suggestedValue}`
                : "Remove or modify this specification to meet constraints",
            });
          }
        });
      }
    });

    console.log(
      `[UC1Engine] Constraint conflict detection: ${result.conflicts.length} conflicts found`
    );
    return result;
  }

  /**
   * Check dependency requirements
   */
  checkDependencies(
    requirementId: string,
    activeRequirements: string[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!this.schema) return result;

    const requirement = this.schema.requirements[requirementId];
    if (!requirement) return result;

    requirement.dependencies.forEach((dep) => {
      const isActive = activeRequirements.includes(dep.target);

      if (dep.type === "all" && !isActive) {
        result.isValid = false;
        result.errors.push({
          type: "dependency",
          nodeId: requirementId,
          message: `Missing required dependency: ${dep.target}`,
          details: {
            dependency: dep.target,
            rationale: dep.rationale,
          },
        });
      }
    });

    return result;
  }

  /**
   * Get hierarchy path for a node
   */
  getHierarchy(nodeId: string): HierarchyPath | undefined {
    return this.hierarchyMap.get(nodeId);
  }

  /**
   * Get related specifications for a requirement
   */
  getRelatedSpecifications(requirementId: string): string[] {
    if (!this.schema) return [];

    const requirement = this.schema.requirements[requirementId];
    if (!requirement) return [];

    return requirement.child.filter(
      (childId) => this.schema!.specifications[childId] !== undefined
    );
  }

  /**
   * Check if engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.schema !== null;
  }

  /**
   * Get schema metadata
   */
  getMetadata(): UC1Metadata | null {
    return this.schema?.metadata || null;
  }

  /**
   * Get all domains
   */
  getDomains(): UC1Domain[] {
    if (!this.schema) return [];
    return Object.values(this.schema.domains);
  }

  /**
   * Get all requirements for a domain
   */
  getRequirementsByDomain(domainId: string): UC1Requirement[] {
    if (!this.schema) return [];
    return Object.values(this.schema.requirements).filter((req) =>
      req.parent.includes(domainId)
    );
  }

  /**
   * Get all specifications for a requirement
   */
  getSpecificationsByRequirement(requirementId: string): UC1Specification[] {
    if (!this.schema) return [];
    return Object.values(this.schema.specifications).filter((spec) =>
      spec.parent.includes(requirementId)
    );
  }

  /**
   * Get a single specification by ID
   */
  getSpecification(specId: string): UC1Specification | undefined {
    if (!this.schema) return undefined;
    return this.schema.specifications[specId];
  }
}

// Export singleton instance for convenient use
export const uc1ValidationEngine = new UC1ValidationEngine();

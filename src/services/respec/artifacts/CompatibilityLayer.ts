/**
 * CompatibilityLayer - Bridge between new artifact state and existing requirements state
 *
 * This layer ensures that:
 * 1. Existing requirements state continues to work unchanged
 * 2. New artifact state stays synchronized with form requirements
 * 3. All existing functionality (chat, form updates, etc.) continues working
 * 4. Migration path for future full transition to artifact state
 */

import { ArtifactManager } from './ArtifactManager';
import { ArtifactState, UC1ArtifactSpecification } from './ArtifactTypes';
import { UC1ValidationEngine } from '../UC1ValidationEngine';

// ============= COMPATIBILITY TYPES =============

// Mirror the existing Requirements type structure from app.tsx
export interface LegacyRequirements {
  [section: string]: {
    [field: string]: {
      value: any;
      isAssumption?: boolean;
      dataSource?: string;
      priority?: number;
      toggleHistory?: any[];
      lastUpdated?: string;
    };
  };
}

export interface SyncResult {
  success: boolean;
  updated: string[]; // Field paths that were updated
  errors: string[];
  warnings: string[];
}

export interface FieldMapping {
  section: string;
  field: string;
  specId: string;
  uc1Path: string;
}

// ============= COMPATIBILITY LAYER CLASS =============

export class CompatibilityLayer {
  private artifactManager: ArtifactManager;
  private uc1Engine: UC1ValidationEngine;
  private fieldMappings: Map<string, FieldMapping> = new Map(); // specId -> FieldMapping
  private reverseFieldMappings: Map<string, string> = new Map(); // section.field -> specId
  private syncEnabled: boolean = true;
  private lastSyncTimestamp: Date = new Date();

  constructor(artifactManager: ArtifactManager, uc1Engine: UC1ValidationEngine) {
    this.artifactManager = artifactManager;
    this.uc1Engine = uc1Engine;
    this.buildFieldMappings();
  }

  // ============= INITIALIZATION =============

  private buildFieldMappings(): void {
    // Build mappings between UC1 specifications and form fields
    // This uses the same mapping logic as the existing form structure

    const commonMappings = [
      // Compute Performance
      { section: 'compute_performance', field: 'processor_type', specId: 'spc001' },
      { section: 'compute_performance', field: 'memory_capacity', specId: 'spc002' },
      { section: 'compute_performance', field: 'storage_type', specId: 'spc003' },
      { section: 'compute_performance', field: 'storage_capacity', specId: 'spc004' },
      { section: 'compute_performance', field: 'response_latency', specId: 'spc005' },
      { section: 'compute_performance', field: 'ai_gpu_acceleration', specId: 'spc012' },
      { section: 'compute_performance', field: 'operating_system', specId: 'spc015' },
      { section: 'compute_performance', field: 'memory_type', specId: 'spc044' },
      { section: 'compute_performance', field: 'time_sensitive_features', specId: 'spc046' },

      // IO Connectivity
      { section: 'io_connectivity', field: 'ethernet_ports', specId: 'spc017' },
      { section: 'io_connectivity', field: 'ethernet_speed', specId: 'spc049' },
      { section: 'io_connectivity', field: 'ethernet_protocols', specId: 'spc050' },
      { section: 'io_connectivity', field: 'digital_io', specId: 'spc026' },
      { section: 'io_connectivity', field: 'analog_io', specId: 'spc028' },
      { section: 'io_connectivity', field: 'fieldbus_protocol_support', specId: 'spc033' },
      { section: 'io_connectivity', field: 'serial_port_type', specId: 'spc034' },
      { section: 'io_connectivity', field: 'usb_ports', specId: 'spc051' },
      { section: 'io_connectivity', field: 'serial_ports_amount', specId: 'spc052' },
      { section: 'io_connectivity', field: 'serial_protocol_support', specId: 'spc053' },
      { section: 'io_connectivity', field: 'wireless_extension', specId: 'spc037' },

      // Form Factor
      { section: 'form_factor', field: 'mounting', specId: 'spc007' },
      { section: 'form_factor', field: 'dimensions', specId: 'spc008' },
      { section: 'form_factor', field: 'max_power_consumption', specId: 'spc036' },
      { section: 'form_factor', field: 'power_input', specId: 'spc055' },
      { section: 'form_factor', field: 'redundant_power', specId: 'spc056' },

      // Environment Standards
      { section: 'environment_standards', field: 'operating_temperature', specId: 'spc009' },
      { section: 'environment_standards', field: 'ingress_protection', specId: 'spc010' },
      { section: 'environment_standards', field: 'vibration_protection', specId: 'spc011' },
      { section: 'environment_standards', field: 'humidity', specId: 'spc057' },
      { section: 'environment_standards', field: 'vibration_resistance', specId: 'spc058' },
      { section: 'environment_standards', field: 'certifications', specId: 'spc059' }
    ];

    commonMappings.forEach(mapping => {
      const fieldKey = `${mapping.section}.${mapping.field}`;
      this.fieldMappings.set(mapping.specId, {
        ...mapping,
        uc1Path: `domains.${mapping.section}.requirements.${mapping.field}.specifications.${mapping.specId}`
      });
      this.reverseFieldMappings.set(fieldKey, mapping.specId);
    });

    console.log(`[CompatibilityLayer] Built ${this.fieldMappings.size} field mappings`);
  }

  // ============= ARTIFACT TO REQUIREMENTS SYNC =============

  syncArtifactToRequirements(requirements: LegacyRequirements): SyncResult {
    const result: SyncResult = {
      success: true,
      updated: [],
      errors: [],
      warnings: []
    };

    if (!this.syncEnabled) {
      result.warnings.push('Sync disabled');
      return result;
    }

    try {
      const respecArtifact = this.artifactManager.getRespecArtifact();

      // Sync respec artifact specifications to requirements
      Object.values(respecArtifact.domains).forEach(domain => {
        Object.values(domain.requirements).forEach(requirement => {
          Object.values(requirement.specifications).forEach(spec => {
            const mapping = this.fieldMappings.get(spec.id);
            if (mapping) {
              const updated = this.updateRequirementField(requirements, mapping, spec);
              if (updated) {
                result.updated.push(`${mapping.section}.${mapping.field}`);
              }
            }
          });
        });
      });

      this.lastSyncTimestamp = new Date();
      console.log(`[CompatibilityLayer] Synced ${result.updated.length} fields from artifact to requirements`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private updateRequirementField(
    requirements: LegacyRequirements,
    mapping: FieldMapping,
    spec: UC1ArtifactSpecification
  ): boolean {
    // Ensure section exists
    if (!requirements[mapping.section]) {
      requirements[mapping.section] = {};
    }

    // Get current field value
    const currentField = requirements[mapping.section][mapping.field];
    const currentValue = currentField?.value;

    // Only update if value has changed
    if (currentValue !== spec.value) {
      requirements[mapping.section][mapping.field] = {
        value: spec.value,
        isAssumption: spec.attribution === 'assumption',
        dataSource: this.mapSourceToDataSource(spec.source),
        priority: currentField?.priority || 5,
        toggleHistory: currentField?.toggleHistory || [],
        lastUpdated: spec.timestamp.toISOString()
      };

      return true;
    }

    return false;
  }

  private mapSourceToDataSource(source: 'user' | 'llm' | 'system'): string {
    switch (source) {
      case 'user': return 'user';
      case 'llm': return 'system';
      case 'system': return 'system';
      default: return 'system';
    }
  }

  // ============= REQUIREMENTS TO ARTIFACT SYNC =============

  syncRequirementsToArtifact(requirements: LegacyRequirements): SyncResult {
    const result: SyncResult = {
      success: true,
      updated: [],
      errors: [],
      warnings: []
    };

    if (!this.syncEnabled) {
      result.warnings.push('Sync disabled');
      return result;
    }

    try {
      // Sync requirements to artifact manager
      Object.entries(requirements).forEach(([section, fields]) => {
        Object.entries(fields).forEach(([fieldName, fieldData]) => {
          const specId = this.getSpecIdFromField(section, fieldName);
          if (specId && fieldData.value && fieldData.value !== '') {
            // Get the real UC1 specification and pass it directly
            const uc1Spec = this.uc1Engine.getSpecification(specId);
            if (uc1Spec) {
              // Pass the UC1 spec directly - let ArtifactManager handle the internal structure
              this.artifactManager.addSpecificationToMapped(uc1Spec, fieldData.value).catch(error => {
                console.warn(`[CompatibilityLayer] Failed to sync ${section}.${fieldName}:`, error);
              });

              result.updated.push(`${section}.${fieldName}`);
            } else {
              console.warn(`[CompatibilityLayer] UC1 specification not found for ${specId} (${section}.${fieldName})`);
            }
          }
        });
      });

      console.log(`[CompatibilityLayer] Synced ${result.updated.length} fields from requirements to artifact`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  // ============= FIELD OPERATIONS =============

  getSpecIdFromField(section: string, field: string): string | undefined {
    return this.reverseFieldMappings.get(`${section}.${field}`);
  }

  getFieldFromSpecId(specId: string): FieldMapping | undefined {
    return this.fieldMappings.get(specId);
  }

  isFieldMapped(section: string, field: string): boolean {
    return this.reverseFieldMappings.has(`${section}.${field}`);
  }

  // ============= MIGRATION HELPERS =============

  migrateRequirementsToArtifact(requirements: LegacyRequirements): Promise<void> {
    // Future: Full migration of existing requirements to artifact structure
    return Promise.resolve();
  }

  generateRequirementsFromArtifact(): LegacyRequirements {
    const requirements: LegacyRequirements = {};
    const respecArtifact = this.artifactManager.getRespecArtifact();

    // Convert artifact structure back to requirements format
    Object.values(respecArtifact.domains).forEach(domain => {
      Object.values(domain.requirements).forEach(requirement => {
        Object.values(requirement.specifications).forEach(spec => {
          const mapping = this.fieldMappings.get(spec.id);
          if (mapping) {
            if (!requirements[mapping.section]) {
              requirements[mapping.section] = {};
            }

            requirements[mapping.section][mapping.field] = {
              value: spec.value,
              isAssumption: spec.attribution === 'assumption',
              dataSource: this.mapSourceToDataSource(spec.source),
              priority: 5,
              toggleHistory: [],
              lastUpdated: spec.timestamp.toISOString()
            };
          }
        });
      });
    });

    return requirements;
  }

  // ============= VALIDATION =============

  validateSync(requirements: LegacyRequirements): {
    inSync: boolean;
    differences: Array<{
      field: string;
      requirementValue: any;
      artifactValue: any;
      action: 'update_requirement' | 'update_artifact' | 'conflict';
    }>;
  } {
    const differences: any[] = [];
    const respecArtifact = this.artifactManager.getRespecArtifact();

    // Check each mapped field for differences
    this.fieldMappings.forEach((mapping, specId) => {
      const fieldKey = `${mapping.section}.${mapping.field}`;
      const requirementValue = requirements[mapping.section]?.[mapping.field]?.value;

      // Find artifact value
      let artifactValue: any = undefined;
      Object.values(respecArtifact.domains).forEach(domain => {
        Object.values(domain.requirements).forEach(requirement => {
          if (requirement.specifications[specId]) {
            artifactValue = requirement.specifications[specId].value;
          }
        });
      });

      if (requirementValue !== artifactValue) {
        differences.push({
          field: fieldKey,
          requirementValue,
          artifactValue,
          action: 'update_requirement' // Default action
        });
      }
    });

    return {
      inSync: differences.length === 0,
      differences
    };
  }

  // ============= CONTROL =============

  enableSync(): void {
    this.syncEnabled = true;
    console.log('[CompatibilityLayer] Sync enabled');
  }

  disableSync(): void {
    this.syncEnabled = false;
    console.log('[CompatibilityLayer] Sync disabled');
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  getLastSyncTime(): Date {
    return this.lastSyncTimestamp;
  }

  // ============= STATUS & DEBUGGING =============

  getStatus(): {
    syncEnabled: boolean;
    lastSync: Date;
    mappingsCount: number;
    reverseMappingsCount: number;
  } {
    return {
      syncEnabled: this.syncEnabled,
      lastSync: this.lastSyncTimestamp,
      mappingsCount: this.fieldMappings.size,
      reverseMappingsCount: this.reverseFieldMappings.size
    };
  }

  debugDumpMappings(): {
    fieldMappings: Array<{ specId: string; section: string; field: string; uc1Path: string }>;
    reverseMappings: Array<{ fieldKey: string; specId: string }>;
  } {
    return {
      fieldMappings: Array.from(this.fieldMappings.entries()).map(([specId, mapping]) => ({
        specId,
        section: mapping.section,
        field: mapping.field,
        uc1Path: mapping.uc1Path
      })),
      reverseMappings: Array.from(this.reverseFieldMappings.entries()).map(([fieldKey, specId]) => ({
        fieldKey,
        specId
      }))
    };
  }
}
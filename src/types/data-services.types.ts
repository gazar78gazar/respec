/**
 * Types for refactored data services (export/import/share/project helpers).
 */

export interface Requirements {
  [fieldName: string]: {
    value?: unknown;
    priority: 1 | 2 | 3 | 4;
    isAssumption?: boolean;
    required?: boolean;
  };
}

export interface ProjectMetadata {
  name: string;
  created: Date;
  lastModified: Date;
  version?: string;
  description?: string;
}

export interface SavedProject {
  name: string;
  requirements: Requirements;
  metadata: ProjectMetadata;
  timestamp: number;
}

// export interface ShareableData {
//   // Unused in refactored flow; share helpers are commented out.
//   sessionId: string;
//   requirements: Requirements;
//   metadata: ProjectMetadata;
//   expiresAt: Date;
// }
//
// export interface ImportResult {
//   // Unused in refactored flow; import helpers are commented out.
//   success: boolean;
//   data?: Requirements;
//   errors?: string[];
//   warnings?: string[];
// }
//
// export interface ValidationResult {
//   // Unused in refactored flow; import helpers are commented out.
//   isValid: boolean;
//   errors: string[];
//   warnings: string[];
// }
//
// export type ExportFormat = "pdf" | "json" | "csv" | "excel";

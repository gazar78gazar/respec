/**
 * DataServices - Export/import/share/project utilities for the refactored UI.
 *
 * Provides browser-only helpers around localStorage persistence and file exports.
 */

import type { Maybe } from "../types/UCDataTypes";

// TypeScript interfaces and types
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

export interface ShareableData {
  sessionId: string;
  requirements: Requirements;
  metadata: ProjectMetadata;
  expiresAt: Date;
}

export interface ImportResult {
  success: boolean;
  data?: Requirements;
  errors?: string[];
  warnings?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type ExportFormat = "pdf" | "json" | "csv" | "excel";

// Export Service Class
class ExportService {
  /**
   * Generates PDF with all requirements
   * @param requirements - The requirements data
   * @param metadata - Project metadata
   * @returns Promise<Blob> - PDF blob for download
   */
  async exportToPDF(
    requirements: Requirements,
    metadata: ProjectMetadata,
  ): Promise<Blob> {
    try {
      // Import jsPDF dynamically
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(20);
      doc.text(`Requirements Document: ${metadata.name}`, 20, 20);

      // Add metadata
      doc.setFontSize(12);
      doc.text(`Created: ${metadata.created.toLocaleDateString()}`, 20, 40);
      doc.text(
        `Last Modified: ${metadata.lastModified.toLocaleDateString()}`,
        20,
        50,
      );

      let yPosition = 70;

      // Group requirements by priority
      const groupedRequirements = Object.entries(requirements).sort(
        ([, a], [, b]) => a.priority - b.priority,
      );

      groupedRequirements.forEach(([fieldName, requirement]) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text(
          `${fieldName} (Priority ${requirement.priority})`,
          20,
          yPosition,
        );
        yPosition += 10;

        doc.setFontSize(10);
        const value = requirement.value || "Not specified";
        const status = requirement.isAssumption ? " (Assumption)" : "";
        doc.text(`Value: ${value}${status}`, 30, yPosition);
        yPosition += 15;
      });

      return new Blob([doc.output("blob")], { type: "application/pdf" });
    } catch (error: unknown) {
      throw new Error(`PDF export failed: ${error?.message}`);
    }
  }

  /**
   * Creates downloadable JSON file
   * @param requirements - The requirements data
   * @param sessionId - Session identifier
   * @returns Promise<Blob> - JSON blob for download
   */
  /* Unused in refactored flow; PDF export is the only wired export path.
  async exportToJSON(
    requirements: Requirements,
    sessionId: string,
  ): Promise<Blob> {
    try {
      const exportData = {
        sessionId,
        requirements,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      return new Blob([jsonString], { type: "application/json" });
    } catch (error: unknown) {
      throw new Error(
        `JSON export failed: ${
          error instanceof Error ? error.message : "Unknown error " + error
        }`,
      );
    }
  }
  */

  /**
   * Creates CSV with flat structure
   * @param requirements - The requirements data
   * @returns Promise<Blob> - CSV blob for download
   */
  /* Unused in refactored flow; CSV export not wired in UI.
  async exportToCSV(requirements: Requirements): Promise<Blob> {
    try {
      const headers = [
        "Field Name",
        "Value",
        "Priority",
        "Is Assumption",
        "Required",
      ];
      const rows = [headers.join(",")];

      Object.entries(requirements).forEach(([fieldName, requirement]) => {
        const row = [
          `"${fieldName}"`,
          `"${requirement.value || ""}"`,
          requirement.priority.toString(),
          (requirement.isAssumption || false).toString(),
          (requirement.required || false).toString(),
        ];
        rows.push(row.join(","));
      });

      const csvContent = rows.join("\n");
      return new Blob([csvContent], { type: "text/csv" });
    } catch (error: unknown) {
      throw new Error(
        `CSV export failed: ${
          error instanceof Error ? error.message : "Unknown error " + error
        }`,
      );
    }
  }
  */

  /**
   * Creates Excel with multiple sheets per section
   * @param requirements - The requirements data
   * @returns Promise<Blob> - Excel blob for download
   */
  /* Unused in refactored flow; Excel export not wired in UI.
  async exportToExcel(requirements: Requirements): Promise<Blob> {
    try {
      // Import xlsx library dynamically
      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default || XLSXModule;
      const workbook = XLSX.utils.book_new();

      // Group by sections (using field mapping logic)
      const sections = {
        performanceComputing: [],
        IOConnectivity: [],
        powerEnvironment: [],
        commercial: [],
        other: [],
      };

      Object.entries(requirements).forEach(([fieldName, requirement]) => {
        const sectionKey = this.getFieldSection(fieldName) || "other";
        sections[sectionKey].push({
          "Field Name": fieldName,
          Value: requirement.value || "",
          Priority: requirement.priority,
          "Is Assumption": requirement.isAssumption || false,
          Required: requirement.required || false,
        });
      });

      // Create worksheets for each section with data
      Object.entries(sections).forEach(([sectionName, data]) => {
        if (data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, sectionName);
        }
      });

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      return new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (error: unknown) {
      throw new Error(
        `Excel export failed: ${
          error instanceof Error ? error.message : "Unknown error " + error
        }`,
      );
    }
  }
  */

  /* Unused in refactored flow; only needed by Excel export.
  private getFieldSection(fieldName: string): Maybe<string> {
    const fieldSections: Record<string, string> = {
      cpuType: "performanceComputing",
      cpuCores: "performanceComputing",
      ramSize: "performanceComputing",
      digitalIO: "IOConnectivity",
      analogIO: "IOConnectivity",
      networkPorts: "IOConnectivity",
      powerSupply: "powerEnvironment",
      operatingTemp: "powerEnvironment",
      budgetPerUnit: "commercial",
      quantity: "commercial",
    };
    return fieldSections[fieldName] || null;
  }
  */
}

// Share Service Class
class ShareService {
  /**
   * Generates shareable link with expiry
   * @param sessionId - Session identifier
   * @param expiryHours - Hours until link expires (default 72)
   * @returns Promise<string> - Shareable URL
   */
  /* Unused in refactored flow; share links are not wired in UI.
  async generateShareableLink(
    sessionId: string,
    expiryHours: number = 72,
  ): Promise<string> {
    try {
      const shareToken = this.createShareToken();
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Store share data in localStorage with expiry
      const shareData: ShareableData = {
        sessionId,
        requirements: {}, // Would be populated with actual requirements
        metadata: {} as ProjectMetadata,
        expiresAt,
      };

      localStorage.setItem(`share_${shareToken}`, JSON.stringify(shareData));

      const baseUrl = window.location.origin;
      return `${baseUrl}/shared/${shareToken}`;
    } catch (error: unknown) {
      throw new Error(
        `Failed to generate shareable link: ${
          error instanceof Error ? error.message : "Unknown error " + error
        }`,
      );
    }
  }
  */
  /**
   * Copies text to clipboard with success feedback
   * @param text - Text to copy
   * @returns Promise<boolean> - Success status
   */
  /* Unused in refactored flow; share UI not wired.
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error: unknown) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackError) {
        console.error("Failed to copy to clipboard:", fallbackError);
        return false;
      }
    }
  }
  */
  /**
   * Prepares email with requirements data
   * @param recipients - Array of email addresses
   * @param requirements - The requirements data
   * @param subject - Email subject
   * @returns string - mailto URL
   */
  /* Unused in refactored flow; share UI not wired.
  shareViaEmail(
    recipients: string[],
    requirements: Requirements,
    subject: string,
  ): string {
    const body = this.formatRequirementsForEmail(requirements);
    const mailto = `mailto:${recipients.join(",")}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    return mailto;
  }
  */
  /**
   * Generates unique share ID
   * @returns string - Unique share token
   */
  /* Unused in refactored flow; share UI not wired.
  createShareToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${randomStr}`;
  }
  */
  /* Unused in refactored flow; share UI not wired.
  private formatRequirementsForEmail(requirements: Requirements): string {
    let body = "Requirements Summary:\n\n";

    Object.entries(requirements).forEach(([fieldName, requirement]) => {
      body += `${fieldName}: ${requirement.value || "Not specified"}\n`;
      if (requirement.isAssumption) {
        body += "  (This is an assumption)\n";
      }
    });

    return body;
  }
  */
}

// Import Service Class
class ImportService {
  /**
   * Parses and validates JSON file
   * @param file - File object to import
   * @returns Promise<ImportResult> - Import result with data or errors
   */
  /* Unused in refactored flow; import UI not wired.
  async importFromJSON(file: File): Promise<ImportResult> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const validation = this.validateImportedData(data);

      if (validation.isValid) {
        return {
          success: true,
          data: data.requirements || data,
          warnings: validation.warnings,
        };
      } else {
        return {
          success: false,
          errors: validation.errors,
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        errors: [
          `JSON parsing failed: ${
            error instanceof Error
              ? error.message
              : "Unknown error " + errorerror.message
          }`,
        ],
      };
    }
  }
  */
  /**
   * Parses CSV to requirements format
   * @param file - CSV file to import
   * @returns Promise<ImportResult> - Import result with converted data
   */
  /* Unused in refactored flow; import UI not wired.
  async importFromCSV(file: File): Promise<ImportResult> {
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        return {
          success: false,
          errors: ["CSV file must have at least a header row and one data row"],
        };
      }

      const requirements: Requirements = {};

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
          .split(",")
          .map((v) => v.replace(/"/g, "").trim());

        if (values.length >= 2) {
          const fieldName = values[0];
          const value = values[1];
          const priority = parseInt(values[2]) || 4;
          const isAssumption = values[3] === "true";
          const required = values[4] === "true";

          requirements[fieldName] = {
            value,
            priority: priority as 1 | 2 | 3 | 4,
            isAssumption,
            required,
          };
        }
      }

      const validation = this.validateImportedData(requirements);

      return {
        success: validation.isValid,
        data: requirements,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    } catch (error: unknown) {
      return {
        success: false,
        errors: [
          `CSV parsing failed: ${
            error instanceof Error ? error.message : "Unknown error " + error
          }`,
        ],
      };
    }
  }
  */
  /**
   * Validates imported data structure and required fields
   * @param data - Data to validate
   * @returns ValidationResult - Validation results
   */
  /* Unused in refactored flow; import UI not wired.
  validateImportedData(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Invalid data format: expected object");
      return { isValid: false, errors, warnings };
    }

    // Check if it's requirements format
    const isRequirementsFormat = Object.values(data).every(
      (item) => typeof item === "object" && "priority" in item,
    );

    if (!isRequirementsFormat) {
      errors.push(
        "Invalid requirements format: each field must have a priority",
      );
    }

    // Validate priorities
    Object.entries(data as Record<string, Requirements[string]>).forEach(
      ([fieldName, requirement]) => {
        if (
          !requirement.priority ||
          ![1, 2, 3, 4].includes(requirement.priority)
        ) {
          errors.push(
            `Invalid priority for field "${fieldName}": must be 1, 2, 3, or 4`,
          );
        }
      },
    );

    // Check for must-have fields
    const mustFields = [
      "digitalIO",
      "analogIO",
      "networkPorts",
      "budgetPerUnit",
      "quantity",
    ];
    const missingMustFields = mustFields.filter((field) => !(field in data));

    if (missingMustFields.length > 0) {
      warnings.push(
        `Missing must-have fields: ${missingMustFields.join(", ")}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
  */
  /**
   * Smart merge logic for combining imported and existing data
   * @param imported - Imported requirements
   * @param existing - Existing requirements
   * @returns Requirements - Merged requirements
   */
  /* Unused in refactored flow; import UI not wired.
  mergeWithExisting(
    imported: Requirements,
    existing: Requirements,
  ): Requirements {
    const merged: Requirements = { ...existing };

    Object.entries(imported).forEach(([fieldName, importedRequirement]) => {
      const existingRequirement = merged[fieldName];

      if (!existingRequirement) {
        // Field doesn't exist, add it
        merged[fieldName] = importedRequirement;
      } else if (!existingRequirement.value && importedRequirement.value) {
        // Existing field is empty, use imported value
        merged[fieldName] = {
          ...existingRequirement,
          value: importedRequirement.value,
          isAssumption: importedRequirement.isAssumption,
        };
      } else if (
        existingRequirement.isAssumption &&
        importedRequirement.value &&
        !importedRequirement.isAssumption
      ) {
        // Replace assumption with actual value
        merged[fieldName] = {
          ...existingRequirement,
          value: importedRequirement.value,
          isAssumption: false,
        };
      }
      // Otherwise keep existing value (don't overwrite non-empty values)
    });

    return merged;
  }
  */
}

// Project Management Class
class ProjectManagement {
  private readonly STORAGE_KEY = "saved_projects";
  private autoSaveTimeout: Maybe<NodeJS.Timeout> = null;

  /**
   * Saves project to localStorage
   * @param name - Project name
   * @param requirements - Requirements data
   * @param metadata - Project metadata
   * @returns Promise<boolean> - Success status
   */
  async saveProject(
    name: string,
    requirements: Requirements,
    metadata: ProjectMetadata,
  ): Promise<boolean> {
    try {
      const projects = this.getStoredProjects();

      const project: SavedProject = {
        name,
        requirements,
        metadata: {
          ...metadata,
          lastModified: new Date(),
        },
        timestamp: Date.now(),
      };

      projects[name] = project;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));

      return true;
    } catch (error: unknown) {
      console.error("Failed to save project:", error);
      return false;
    }
  }

  /**
   * Retrieves project from localStorage
   * @param name - Project name
   * @returns Promise<SavedProject | null> - Project data or null if not found
   */
  /* Unused in refactored flow; load UI not wired.
  async loadProject(name: string): Promise<Maybe<SavedProject>> {
    try {
      const projects = this.getStoredProjects();
      const project = projects[name];

      if (project) {
        // Convert date strings back to Date objects
        project.metadata.created = new Date(project.metadata.created);
        project.metadata.lastModified = new Date(project.metadata.lastModified);
      }

      return project || null;
    } catch (error: unknown) {
      console.error("Failed to load project:", error);
      return null;
    }
  }
  */

  /**
   * Returns array of saved projects
   * @returns Promise<SavedProject[]> - List of saved projects
   */
  /* Unused in refactored flow; load UI not wired.
  async listProjects(): Promise<SavedProject[]> {
    try {
      const projects = this.getStoredProjects();
      return Object.values(projects).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: unknown) {
      console.error("Failed to list projects:", error);
      return [];
    }
  }
  */

  /**
   * Removes project from localStorage
   * @param name - Project name to delete
   * @returns Promise<boolean> - Success status
   */
  /* Unused in refactored flow; delete UI not wired.
  async deleteProject(name: string): Promise<boolean> {
    try {
      const projects = this.getStoredProjects();
      delete projects[name];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (error: unknown) {
      console.error("Failed to delete project:", error);
      return false;
    }
  }
  */

  /**
   * Combines save and export functionality
   * @param name - Project name
   * @param requirements - Requirements data
   * @param metadata - Project metadata
   * @param format - Export format
   * @returns Promise<Blob> - Export blob
   */
  /* Unused in refactored flow; export UI not wired.
  async exportProject(
    name: string,
    requirements: Requirements,
    metadata: ProjectMetadata,
    format: ExportFormat = "json",
  ): Promise<Blob> {
    await this.saveProject(name, requirements, metadata);

    const exportService = new ExportService();

    switch (format) {
      case "pdf":
        return exportService.exportToPDF(requirements, metadata);
      case "csv":
        return exportService.exportToCSV(requirements);
      case "excel":
        return exportService.exportToExcel(requirements);
      default:
        return exportService.exportToJSON(requirements, name);
    }
  }
  */

  /**
   * Debounced auto-save functionality
   * @param requirements - Requirements to auto-save
   * @param projectName - Project name (optional)
   * @returns void
   */
  autoSave(requirements: Requirements, projectName?: string): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(async () => {
      const name = projectName || "auto_save";
      const metadata: ProjectMetadata = {
        name,
        created: new Date(),
        lastModified: new Date(),
        description: "Auto-saved project",
      };

      await this.saveProject(name, requirements, metadata);
    }, 5000); // 5 second debounce
  }

  private getStoredProjects(): Record<string, SavedProject> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error: unknown) {
      console.error("Failed to parse stored projects:", error);
      return {};
    }
  }
}

// Helper Utilities
class HelperUtilities {
  /**
   * Triggers browser download for blob
   * @param blob - Blob to download
   * @param filename - Download filename
   * @returns void
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Format converter for different export formats
   * @param requirements - Requirements data
   * @param format - Target format
   * @returns any - Formatted data
   */
  /* Unused in refactored flow; helper for export formats not wired.
  formatRequirementsForExport(
    requirements: Requirements,
    format: ExportFormat,
  ): unknown {
    switch (format) {
      case "csv":
        return Object.entries(requirements).map(([fieldName, requirement]) => ({
          fieldName,
          value: requirement.value || "",
          priority: requirement.priority,
          isAssumption: requirement.isAssumption || false,
          required: requirement.required || false,
        }));

      case "excel":
        return this.groupRequirementsBySection(requirements);

      case "pdf":
        return this.sortRequirementsByPriority(requirements);

      default:
        return requirements;
    }
  }
  */

  /**
   * Generates timestamp-based filename
   * @param prefix - Filename prefix
   * @param extension - File extension
   * @returns string - Generated filename
   */
  generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${prefix}_${timestamp}.${extension}`;
  }

  /**
   * Optional compression for large exports
   * @param data - Data to compress
   * @returns Promise<string> - Compressed data as base64
   */
  /* Unused in refactored flow; compression not wired.
  async compressData(data: unknown): Promise<string> {
    try {
      const jsonString = JSON.stringify(data);

      // Simple compression using built-in compression
      if ("CompressionStream" in window) {
        const stream = new CompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(new TextEncoder().encode(jsonString));
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        const compressed = new Uint8Array(
          chunks.reduce((acc, chunk) => acc + chunk.length, 0),
        );
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        return btoa(String.fromCharCode(...compressed));
      } else {
        // Fallback: just base64 encode without compression
        return btoa(jsonString);
      }
    } catch (error: unknown) {
      console.error("Compression failed:", error);
      return btoa(JSON.stringify(data));
    }
  }
  */

  /* Unused in refactored flow; helper for export formats not wired.
  private groupRequirementsBySection(requirements: Requirements): Record<
    string,
    Array<{
      fieldName: string;
      value: unknown;
      priority: 1 | 2 | 3 | 4;
      isAssumption: boolean;
      required: boolean;
    }>
  > {
    const sections = {
      performanceComputing: [],
      IOConnectivity: [],
      powerEnvironment: [],
      commercial: [],
      other: [],
    };

    Object.entries(requirements).forEach(([fieldName, requirement]) => {
      const sectionKey = this.getFieldSection(fieldName) || "other";
      sections[sectionKey].push({
        fieldName,
        value: requirement.value || "",
        priority: requirement.priority,
        isAssumption: requirement.isAssumption || false,
        required: requirement.required || false,
      });
    });

    return sections;
  }
  */

  /* Unused in refactored flow; helper for export formats not wired.
  private sortRequirementsByPriority(
    requirements: Requirements,
  ): Array<[string, Requirements[string]]> {
    return Object.entries(requirements).sort(
      ([, a], [, b]) => a.priority - b.priority,
    );
  }
  */

  /* Unused in refactored flow; helper for export formats not wired.
  private getFieldSection(fieldName: string): Maybe<string> {
    const fieldSections: Record<string, string> = {
      cpuType: "performanceComputing",
      cpuCores: "performanceComputing",
      ramSize: "performanceComputing",
      digitalIO: "IOConnectivity",
      analogIO: "IOConnectivity",
      networkPorts: "IOConnectivity",
      powerSupply: "powerEnvironment",
      operatingTemp: "powerEnvironment",
      budgetPerUnit: "commercial",
      quantity: "commercial",
    };
    return fieldSections[fieldName] || null;
  }
  */
}

// Main DataServices Class
class DataServicesClass {
  public export: ExportService;
  public share: ShareService;
  public import: ImportService;
  public project: ProjectManagement;
  public utils: HelperUtilities;

  constructor() {
    this.export = new ExportService();
    this.share = new ShareService();
    this.import = new ImportService();
    this.project = new ProjectManagement();
    this.utils = new HelperUtilities();
  }
}

// Singleton export
export const DataServices = new DataServicesClass();

// Types are already exported above, no need to re-export

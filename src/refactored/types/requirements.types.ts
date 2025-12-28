// TypeScript interfaces for Requirements system
// This provides type safety while maintaining exact compatibility with existing code

import type { FormUpdate } from "./service.types";

export interface FieldData {
  value: string | number | boolean;
  priority?: "high" | "medium" | "low";
  isAssumption?: boolean;
  required?: boolean;
  timestamp?: string;
}

export interface CommercialSection {
  budgetPerUnit?: FieldData;
  quantity?: FieldData;
  totalBudget?: FieldData;
  deliveryTimeframe?: FieldData;
  shippingIncoterms?: FieldData;
  warrantyRequirements?: FieldData;
}

export interface IOConnectivitySection {
  digitalIO?: FieldData;
  analogIO?: FieldData;
  ethernetPorts?: FieldData;
  ethernetSpeed?: FieldData;
  ethernetProtocols?: FieldData;
  usbPorts?: FieldData;
  serialPortsAmount?: FieldData;
  serialPortType?: FieldData;
  serialProtocolSupport?: FieldData;
  fieldbusProtocolSupport?: FieldData;
  wirelessExtension?: FieldData;
}

export interface ComputePerformanceSection {
  processorType?: FieldData;
  aiGpuAcceleration?: FieldData;
  memoryCapacity?: FieldData;
  memoryType?: FieldData;
  storageCapacity?: FieldData;
  storageType?: FieldData;
  timeSensitiveFeatures?: FieldData;
  responseLatency?: FieldData;
  operatingSystem?: FieldData;
}

export interface FormFactorSection {
  powerInput?: FieldData;
  maxPowerConsumption?: FieldData;
  redundantPower?: FieldData;
  dimensions?: FieldData;
  mounting?: FieldData;
}

export interface EnvironmentStandardsSection {
  operatingTemperature?: FieldData;
  humidity?: FieldData;
  vibrationResistance?: FieldData;
  ingressProtection?: FieldData;
  vibrationProtection?: FieldData;
  certifications?: FieldData;
}

export interface Requirements {
  commercial?: CommercialSection;
  IOConnectivity?: IOConnectivitySection;
  computePerformance?: ComputePerformanceSection;
  formFactor?: FormFactorSection;
  environmentStandards?: EnvironmentStandardsSection;
  [key: string]: unknown; // Allow for dynamic sections while maintaining known types
}

// Cross-field validation error types (unused in refactored flow)
// export interface ValidationError {
//   severity: "error" | "warning" | "info";
//   message: string;
// }
//
// export type CrossFieldErrors = Record<string, ValidationError>;

// Chat message types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  metadata?: {
    isAssumption?: boolean;
    confidence?: number;
    clarificationNeeded?: boolean;
  };
}

// Respec communication types
export interface MASCommunicationResult {
  success: boolean;
  message?: string;
  formUpdates?: FormUpdate[];
  systemMessage?: string;
  triggeredUpdates?: FormUpdate[];
  fields?: FormUpdate[];
  error?: string;
}

// Export type guards for runtime checking
// const isFieldData = (value: unknown): value is FieldData => {
//   // Unused in refactored flow; keep for future runtime checks.
//   return value && typeof value === "object" && "value" in value;
// };

// const hasFieldValue = (field?: FieldData): boolean => {
//   // Unused in refactored flow; keep for future helpers.
//   return field?.value !== undefined && field.value !== "";
// };

export type UserRole = "assistant" | "user" | "system";

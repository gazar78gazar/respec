// TypeScript interfaces for Requirements system
// This provides type safety while maintaining exact compatibility with existing code

export interface FieldData {
  value: string | number | boolean;
  priority?: "high" | "medium" | "low";
  isAssumption?: boolean;
  required?: boolean;
  timestamp?: string;
}

export interface CommercialSection {
  budget_per_unit?: FieldData;
  quantity?: FieldData;
  total_budget?: FieldData;
  delivery_timeframe?: FieldData;
  shipping_incoterms?: FieldData;
  warranty_requirements?: FieldData;
}

export interface IOConnectivitySection {
  digital_io?: FieldData;
  analog_io?: FieldData;
  ethernet_ports?: FieldData;
  ethernet_speed?: FieldData;
  ethernet_protocols?: FieldData;
  usb_ports?: FieldData;
  serial_ports_amount?: FieldData;
  serial_port_type?: FieldData;
  serial_protocol_support?: FieldData;
  fieldbus_protocol_support?: FieldData;
  wireless_extension?: FieldData;
}

export interface ComputePerformanceSection {
  processor_type?: FieldData;
  ai_gpu_acceleration?: FieldData;
  memory_capacity?: FieldData;
  memory_type?: FieldData;
  storage_capacity?: FieldData;
  storage_type?: FieldData;
  time_sensitive_features?: FieldData;
  response_latency?: FieldData;
  operating_system?: FieldData;
}

export interface FormFactorSection {
  power_input?: FieldData;
  max_power_consumption?: FieldData;
  redundant_power?: FieldData;
  dimensions?: FieldData;
  mounting?: FieldData;
}

export interface EnvironmentStandardsSection {
  operating_temperature?: FieldData;
  humidity?: FieldData;
  vibration_resistance?: FieldData;
  ingress_protection?: FieldData;
  vibration_protection?: FieldData;
  certifications?: FieldData;
}

export interface Requirements {
  commercial?: CommercialSection;
  io_connectivity?: IOConnectivitySection;
  compute_performance?: ComputePerformanceSection;
  form_factor?: FormFactorSection;
  environment_standards?: EnvironmentStandardsSection;
  [key: string]: any; // Allow for dynamic sections while maintaining known types
}

// Cross-field validation error types
export interface ValidationError {
  severity: "error" | "warning" | "info";
  message: string;
}

export type CrossFieldErrors = Record<string, ValidationError>;

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

// Form update event types
export interface FormUpdateEvent {
  section: string;
  field: string;
  value: any;
  isAssumption?: boolean;
}

// Respec communication types
export interface MASCommunicationResult {
  success: boolean;
  message?: string;
  formUpdates?: FormUpdateEvent[];
  systemMessage?: string;
  triggered_updates?: FormUpdateEvent[];
  fields?: FormUpdateEvent[];
  error?: string;
}

// Export type guards for runtime checking
export const isFieldData = (value: any): value is FieldData => {
  return value && typeof value === "object" && "value" in value;
};

export const hasFieldValue = (field?: FieldData): boolean => {
  return field?.value !== undefined && field.value !== "";
};

export type UserRole = "assistant" | "user" | "system";

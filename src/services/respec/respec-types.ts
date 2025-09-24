// ReSpec TypeScript Type Definitions
// Core types for the simplified ReSpec requirement extraction system

// ============= CORE DATA STRUCTURES =============

export interface UCNode {
  id: string;
  name: string;
  category: string;
  parent_ids: string[];
  child_ids: string[];
  mutex_ids: string[];
  form_field_mapping?: string;
  constraints?: UCConstraint[];
  metadata?: {
    priority?: 'high' | 'medium' | 'low';
    complexity?: number;
    cost_impact?: 'high' | 'medium' | 'low';
    description?: string;
  };
}

export interface UCConstraint {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_equals';
  value: string | number;
  confidence: number;
}

export interface UCCategory {
  id: string;
  name: string;
  node_ids: string[];
  form_section: string;
  priority: number;
}

export interface UCData {
  nodes: UCNode[];
  categories: UCCategory[];
  relationships: UCRelationship[];
  metadata: {
    version: string;
    last_updated: string;
    total_nodes: number;
    categories_count: number;
  };
}

export interface UCRelationship {
  from_node_id: string;
  to_node_id: string;
  relationship_type: 'parent' | 'child' | 'mutex' | 'implies' | 'conflicts';
  strength: number; // 0.0 to 1.0
}

// ============= PROCESSING TYPES =============

export interface RequirementMatch {
  node_id: string;
  confidence: number;
  matched_text: string;
  extraction_method: 'keyword' | 'semantic' | 'pattern' | 'llm';
  constraints: UCConstraint[];
}

export interface ConflictDetection {
  conflict_id: string;
  conflict_type: 'mutex' | 'constraint' | 'logical';
  involved_nodes: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolution_suggestions: string[];
  auto_resolvable: boolean;
}

export interface FormFieldUpdate {
  section: string;
  field: string;
  value: string | number | boolean | string[];
  confidence: number;
  source_node_id?: string;
  is_system_generated: boolean;
  requires_confirmation?: boolean;
}

// ============= SERVICE RESPONSE TYPES =============

export interface ChatProcessingResult {
  success: boolean;
  system_message: string;
  form_updates: FormFieldUpdate[];
  detected_requirements: RequirementMatch[];
  conflicts: ConflictDetection[];
  suggested_clarifications: string[];
  processing_time_ms: number;
}

export interface FormUpdateResult {
  success: boolean;
  system_message?: string;
  validation_errors: string[];
  triggered_updates: FormFieldUpdate[];
  conflicts: ConflictDetection[];
  node_activations: string[];
}

export interface AutofillResult {
  success: boolean;
  filled_fields: FormFieldUpdate[];
  skipped_fields: { field: string; reason: string }[];
  confidence_score: number;
  total_fields_processed: number;
}

// ============= LLM INTEGRATION TYPES =============

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens: number;
  temperature: number;
  system_prompt?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  processing_time_ms: number;
}

export interface RequirementExtraction {
  extracted_requirements: {
    category: string;
    field: string;
    value: string;
    confidence: number;
    reasoning: string;
  }[];
  clarification_questions: string[];
  overall_confidence: number;
  processing_notes: string;
}

// ============= SESSION & STATE TYPES =============

export interface ReSpecSession {
  session_id: string;
  created_at: string;
  last_activity: string;
  current_form_state: { [key: string]: any };
  conversation_history: ConversationEntry[];
  active_nodes: Set<string>;
  resolved_conflicts: string[];
  user_preferences: UserPreferences;
}

export interface ConversationEntry {
  timestamp: string;
  type: 'user_message' | 'system_response' | 'form_update' | 'clarification';
  content: string;
  metadata?: {
    triggered_nodes?: string[];
    form_changes?: FormFieldUpdate[];
    processing_time?: number;
  };
}

export interface UserPreferences {
  confirmation_level: 'minimal' | 'standard' | 'verbose';
  auto_fill_confidence_threshold: number;
  preferred_response_style: 'technical' | 'conversational' | 'brief';
  enable_proactive_suggestions: boolean;
}

// ============= UTILITY & CONFIG TYPES =============

export interface ReSpecConfig {
  anthropic_api_key: string;
  uc_data_url: string;
  default_model: string;
  confidence_thresholds: {
    auto_fill: number;
    require_confirmation: number;
    reject_suggestion: number;
  };
  performance_settings: {
    max_concurrent_requests: number;
    request_timeout_ms: number;
    cache_ttl_ms: number;
  };
  debug_mode: boolean;
}

export interface DebugLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  data?: any;
  performance_metrics?: {
    duration_ms: number;
    memory_usage?: number;
  };
}

export interface ServiceMetrics {
  session_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time_ms: number;
  total_form_updates: number;
  conflicts_detected: number;
  conflicts_resolved: number;
  llm_token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_cost_estimate: number;
  };
  cache_performance: {
    hits: number;
    misses: number;
    hit_rate: number;
  };
}

// ============= ERROR TYPES =============

export class ReSpecError extends Error {
  code: string;
  component: string;
  recoverable: boolean;
  user_message: string;
  technical_details?: any;
  suggested_actions?: string[];

  constructor(
    message: string,
    code: string,
    component: string,
    recoverable: boolean,
    userMessage: string,
    technicalDetails?: any,
    suggestedActions?: string[]
  ) {
    super(message);
    this.name = 'ReSpecError';
    this.code = code;
    this.component = component;
    this.recoverable = recoverable;
    this.user_message = userMessage;
    this.technical_details = technicalDetails;
    this.suggested_actions = suggestedActions;
  }
}

export type ReSpecErrorCode =
  | 'UC_DATA_LOAD_FAILED'
  | 'LLM_REQUEST_FAILED'
  | 'INVALID_FORM_FIELD'
  | 'CONSTRAINT_VIOLATION'
  | 'MUTEX_CONFLICT'
  | 'SESSION_NOT_FOUND'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_FAILED';

// ============= FORM INTEGRATION TYPES =============

export interface FormFieldDefinition {
  section: string;
  field: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';
  required: boolean;
  validation_rules?: ValidationRule[];
  default_value?: any;
  options?: string[];
  dependencies?: FormFieldDependency[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'custom';
  value: any;
  message: string;
}

export interface FormFieldDependency {
  target_field: string;
  condition: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
  value: any;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'set_value';
}

export interface FormSectionMapping {
  ui_section: string;
  uc_categories: string[];
  priority: number;
  auto_fill_enabled: boolean;
  validation_strict: boolean;
}

// ============= EXPORT TYPES =============

export interface RequirementExport {
  export_id: string;
  created_at: string;
  session_id: string;
  format: 'json' | 'yaml' | 'xml' | 'pdf' | 'csv';
  requirements: {
    [section: string]: {
      [field: string]: {
        value: any;
        confidence: number;
        source: 'user' | 'system' | 'inferred';
        validation_status: 'valid' | 'warning' | 'error';
        last_updated: string;
      };
    };
  };
  metadata: {
    total_fields: number;
    completed_fields: number;
    system_generated_fields: number;
    validation_errors: number;
    confidence_score: number;
  };
}

// ============= TYPE GUARDS =============

export const isValidUCNode = (obj: any): obj is UCNode => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.category === 'string' &&
    Array.isArray(obj.parent_ids) &&
    Array.isArray(obj.child_ids) &&
    Array.isArray(obj.mutex_ids);
};

export const isValidFormFieldUpdate = (obj: any): obj is FormFieldUpdate => {
  return obj &&
    typeof obj.section === 'string' &&
    typeof obj.field === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.is_system_generated === 'boolean';
};

export const isValidChatProcessingResult = (obj: any): obj is ChatProcessingResult => {
  return obj &&
    typeof obj.success === 'boolean' &&
    typeof obj.system_message === 'string' &&
    Array.isArray(obj.form_updates) &&
    Array.isArray(obj.detected_requirements);
};
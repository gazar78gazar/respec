// ReSpec Utility Functions
// Helper functions for the simplified ReSpec requirement extraction system

import { v4 as uuidv4 } from 'uuid';
import {
  UCNode,
  RequirementMatch,
  FormFieldUpdate,
  ConflictDetection,
  ReSpecError,
  ReSpecErrorCode,
  DebugLogEntry,
  FormFieldDefinition
} from './respec-types';

// ============= LOGGING UTILITIES =============

export class ReSpecLogger {
  private static logs: DebugLogEntry[] = [];
  private static maxLogs = 1000;
  private static debugMode = process.env.NODE_ENV === 'development';
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    ReSpecLogger.log(level, this.component, message, data);
  }

  getEntries(): DebugLogEntry[] {
    return ReSpecLogger.logs.filter(log => log.component === this.component);
  }

  static log(level: 'debug' | 'info' | 'warn' | 'error', component: string, message: string, data?: any): void {
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output in debug mode
    if (this.debugMode) {
      const logPrefix = `[ReSpec:${component}]`;
      switch (level) {
        case 'debug':
          console.debug(logPrefix, message, data);
          break;
        case 'info':
          console.info(logPrefix, message, data);
          break;
        case 'warn':
          console.warn(logPrefix, message, data);
          break;
        case 'error':
          console.error(logPrefix, message, data);
          break;
      }
    }
  }

  static getLogs(level?: 'debug' | 'info' | 'warn' | 'error'): DebugLogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }

  static getRecentLogs(count: number = 50): DebugLogEntry[] {
    return this.logs.slice(-count);
  }
}

// ============= ERROR HANDLING =============

export class ReSpecErrorHandler {
  static createError(code: ReSpecErrorCode, message: string, component: string, details?: any): ReSpecError {
    const error = new Error(message) as ReSpecError;
    error.code = code;
    error.component = component;
    error.recoverable = this.isRecoverableError(code);
    error.user_message = this.getUserFriendlyMessage(code);
    error.technical_details = details;
    error.suggested_actions = this.getSuggestedActions(code);

    ReSpecLogger.log('error', component, message, { code, details });
    return error;
  }

  private static isRecoverableError(code: ReSpecErrorCode): boolean {
    const recoverableErrors: ReSpecErrorCode[] = [
      'LLM_REQUEST_FAILED',
      'NETWORK_ERROR',
      'RATE_LIMIT_EXCEEDED'
    ];
    return recoverableErrors.includes(code);
  }

  private static getUserFriendlyMessage(code: ReSpecErrorCode): string {
    const messages: Record<ReSpecErrorCode, string> = {
      'UC_DATA_LOAD_FAILED': 'Unable to load requirement templates. Please check your connection.',
      'LLM_REQUEST_FAILED': 'Unable to process your request. Please try again in a moment.',
      'INVALID_FORM_FIELD': 'The form field you specified is not valid.',
      'CONSTRAINT_VIOLATION': 'The value conflicts with other requirements.',
      'MUTEX_CONFLICT': 'This requirement conflicts with another selection.',
      'SESSION_NOT_FOUND': 'Your session has expired. Please refresh the page.',
      'CONFIGURATION_ERROR': 'System configuration issue. Please contact support.',
      'NETWORK_ERROR': 'Network connection issue. Please check your internet connection.',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
      'VALIDATION_FAILED': 'The provided data is not valid.'
    };
    return messages[code] || 'An unexpected error occurred.';
  }

  private static getSuggestedActions(code: ReSpecErrorCode): string[] {
    const actions: Record<ReSpecErrorCode, string[]> = {
      'UC_DATA_LOAD_FAILED': ['Refresh the page', 'Check internet connection', 'Contact support if problem persists'],
      'LLM_REQUEST_FAILED': ['Try again in a few seconds', 'Simplify your request', 'Check API key configuration'],
      'INVALID_FORM_FIELD': ['Check field name spelling', 'Verify form section exists'],
      'CONSTRAINT_VIOLATION': ['Review conflicting requirements', 'Adjust related fields'],
      'MUTEX_CONFLICT': ['Choose one of the conflicting options', 'Review requirement dependencies'],
      'SESSION_NOT_FOUND': ['Refresh the page', 'Log in again if required'],
      'CONFIGURATION_ERROR': ['Contact system administrator', 'Check environment variables'],
      'NETWORK_ERROR': ['Check internet connection', 'Try again in a moment'],
      'RATE_LIMIT_EXCEEDED': ['Wait 30 seconds before trying again', 'Reduce request frequency'],
      'VALIDATION_FAILED': ['Check input format', 'Review required fields']
    };
    return actions[code] || ['Contact support for assistance'];
  }
}

// ============= TEXT PROCESSING UTILITIES =============

export class TextProcessor {
  private static readonly stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  static extractKeywords(text: string, minLength: number = 2): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= minLength && !this.stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  static extractNumbers(text: string): number[] {
    const numbers = text.match(/\d+(?:\.\d+)?/g);
    return numbers ? numbers.map(n => parseFloat(n)) : [];
  }

  static extractUnits(text: string): string[] {
    const unitPatterns = [
      /(\d+)\s*(v|volt|volts|vdc|vac)/gi,
      /(\d+)\s*(w|watt|watts)/gi,
      /(\d+)\s*(a|amp|amps|ampere|amperes)/gi,
      /(\d+)\s*(mm|cm|m|meter|meters|inch|inches|ft|feet)/gi,
      /(\d+)\s*(°c|celsius|°f|fahrenheit|degree|degrees)/gi,
      /(\d+)\s*(gb|mb|kb|byte|bytes|bit|bits)/gi,
      /(\d+)\s*(mhz|ghz|hz|hertz)/gi
    ];

    const units: string[] = [];
    unitPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const unit = match.replace(/^\d+\s*/, '').toLowerCase();
          if (unit && !units.includes(unit)) {
            units.push(unit);
          }
        });
      }
    });

    return units;
  }

  static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1));
    const words2 = new Set(this.extractKeywords(text2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  static normalizeFieldName(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

// ============= UC NODE UTILITIES =============

export class UCNodeProcessor {
  private nodes: UCNode[] = [];

  constructor() {
    // Instance-based processor for maintaining state
  }

  loadNodes(nodes: UCNode[]): void {
    this.nodes = nodes;
  }

  calculateMatchScore(node: UCNode, requirement: any): number {
    return UCNodeProcessor.calculateNodeMatchScore(requirement.field + ' ' + requirement.value, [requirement.field], node);
  }

  static findMatchingNodes(userInput: string, nodes: UCNode[], threshold: number = 0.3): RequirementMatch[] {
    const matches: RequirementMatch[] = [];
    const keywords = TextProcessor.extractKeywords(userInput);

    for (const node of nodes) {
      const score = this.calculateNodeMatchScore(userInput, keywords, node);

      if (score >= threshold) {
        matches.push({
          node_id: node.id,
          confidence: score,
          matched_text: userInput,
          extraction_method: 'semantic',
          constraints: node.constraints || []
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  private static calculateNodeMatchScore(userInput: string, keywords: string[], node: UCNode): number {
    let score = 0;
    const nodeText = `${node.name} ${node.category} ${node.metadata?.description || ''}`.toLowerCase();

    // Exact name match gets highest score
    if (nodeText.includes(node.name.toLowerCase()) && userInput.toLowerCase().includes(node.name.toLowerCase())) {
      score += 0.8;
    }

    // Category match
    if (userInput.toLowerCase().includes(node.category.toLowerCase())) {
      score += 0.4;
    }

    // Keyword overlap
    const nodeKeywords = TextProcessor.extractKeywords(nodeText);
    const commonKeywords = keywords.filter(k => nodeKeywords.includes(k));
    if (keywords.length > 0) {
      score += (commonKeywords.length / keywords.length) * 0.5;
    }

    // Priority boost for high-priority nodes
    if (node.metadata?.priority === 'high') {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  static detectMutexConflicts(activeNodes: Set<string>, newNodeId: string, allNodes: UCNode[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];
    const newNode = allNodes.find(n => n.id === newNodeId);

    if (!newNode) return conflicts;

    for (const activeNodeId of activeNodes) {
      const activeNode = allNodes.find(n => n.id === activeNodeId);
      if (!activeNode) continue;

      // Check if nodes are mutually exclusive
      if (newNode.mutex_ids.includes(activeNodeId) || activeNode.mutex_ids.includes(newNodeId)) {
        conflicts.push({
          conflict_id: uuidv4(),
          conflict_type: 'mutex',
          involved_nodes: [activeNodeId, newNodeId],
          severity: 'high',
          resolution_suggestions: [
            `Choose either "${activeNode.name}" or "${newNode.name}", but not both`,
            'Review your requirements to determine which option better fits your needs'
          ],
          auto_resolvable: false
        });
      }
    }

    return conflicts;
  }

  static buildNodeHierarchy(nodes: UCNode[]): Map<string, UCNode[]> {
    const hierarchy = new Map<string, UCNode[]>();

    for (const node of nodes) {
      if (node.parent_ids.length === 0) {
        // Root node
        if (!hierarchy.has('root')) {
          hierarchy.set('root', []);
        }
        hierarchy.get('root')!.push(node);
      }

      // Build children map
      for (const parentId of node.parent_ids) {
        if (!hierarchy.has(parentId)) {
          hierarchy.set(parentId, []);
        }
        hierarchy.get(parentId)!.push(node);
      }
    }

    return hierarchy;
  }
}

// ============= FORM FIELD UTILITIES =============

export class FormFieldProcessor {

  generateAutofillValue(node: UCNode, formState: Record<string, any>, activeNodes: Set<string>): { value: any; confidence: number } | null {
    // Simple autofill logic - use default values from constraints or generate reasonable defaults
    if (node.constraints && node.constraints.length > 0) {
      const constraint = node.constraints[0];
      return {
        value: constraint.value,
        confidence: constraint.confidence
      };
    }

    // Generate default based on node type/category
    if (node.category.includes('digital') || node.name.toLowerCase().includes('digital')) {
      return { value: '8', confidence: 0.7 };
    }

    if (node.category.includes('analog') || node.name.toLowerCase().includes('analog')) {
      return { value: '4', confidence: 0.7 };
    }

    if (node.name.toLowerCase().includes('voltage') || node.name.toLowerCase().includes('power')) {
      return { value: '24V DC', confidence: 0.6 };
    }

    // Default fallback
    return { value: 'Not Required', confidence: 0.5 };
  }

  static mapUCNodeToFormField(node: UCNode, value: any, confidence: number): FormFieldUpdate | null {
    if (!node.form_field_mapping) return null;

    const [section, field] = node.form_field_mapping.split('.');
    if (!section || !field) {
      ReSpecLogger.log('warn', 'FormFieldProcessor', 'Invalid form field mapping', { node: node.id, mapping: node.form_field_mapping });
      return null;
    }

    return {
      section,
      field,
      value,
      confidence,
      source_node_id: node.id,
      is_system_generated: true,
      requires_confirmation: confidence < 0.8
    };
  }

  static validateFormFieldUpdate(update: FormFieldUpdate, fieldDefinitions: FormFieldDefinition[]): string[] {
    const errors: string[] = [];

    const fieldDef = fieldDefinitions.find(def =>
      def.section === update.section && def.field === update.field
    );

    if (!fieldDef) {
      errors.push(`Unknown form field: ${update.section}.${update.field}`);
      return errors;
    }

    // Type validation
    switch (fieldDef.type) {
      case 'number':
        if (typeof update.value !== 'number' && isNaN(Number(update.value))) {
          errors.push(`Field ${update.field} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof update.value !== 'boolean') {
          errors.push(`Field ${update.field} must be true or false`);
        }
        break;
      case 'select':
        if (fieldDef.options && !fieldDef.options.includes(String(update.value))) {
          errors.push(`Field ${update.field} must be one of: ${fieldDef.options.join(', ')}`);
        }
        break;
      case 'multiselect':
        if (!Array.isArray(update.value)) {
          errors.push(`Field ${update.field} must be an array`);
        } else if (fieldDef.options) {
          const invalidValues = update.value.filter(v => !fieldDef.options!.includes(String(v)));
          if (invalidValues.length > 0) {
            errors.push(`Field ${update.field} contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;
    }

    // Required field validation
    if (fieldDef.required && (update.value === null || update.value === undefined || update.value === '')) {
      errors.push(`Field ${update.field} is required`);
    }

    return errors;
  }

  static buildCategoryMap(nodes: UCNode[]): Map<string, string[]> {
    const categoryMap = new Map<string, string[]>();

    for (const node of nodes) {
      if (!categoryMap.has(node.category)) {
        categoryMap.set(node.category, []);
      }
      categoryMap.get(node.category)!.push(node.id);
    }

    return categoryMap;
  }
}

// ============= PERFORMANCE UTILITIES =============

export class PerformanceTracker {
  private static operations = new Map<string, { startTime: number; endTime?: number }>();

  static startOperation(operationId: string): void {
    this.operations.set(operationId, { startTime: Date.now() });
  }

  static endOperation(operationId: string): number {
    const operation = this.operations.get(operationId);
    if (!operation) return 0;

    const duration = Date.now() - operation.startTime;
    operation.endTime = Date.now();

    return duration;
  }

  static logOperation(operationId: string, component: string): void {
    const duration = this.endOperation(operationId);
    if (duration > 0) {
      ReSpecLogger.log('debug', component, `Operation completed: ${operationId}`, { duration_ms: duration });
    }
  }

  static getAverageOperationTime(operationType: string): number {
    const operations = Array.from(this.operations.entries())
      .filter(([id]) => id.startsWith(operationType))
      .filter(([, op]) => op.endTime)
      .map(([, op]) => op.endTime! - op.startTime);

    if (operations.length === 0) return 0;
    return operations.reduce((sum, duration) => sum + duration, 0) / operations.length;
  }
}

// ============= VALIDATION UTILITIES =============

export class ValidationHelper {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidJson(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeInput(input: string, maxLength: number = 1000): string {
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, ''); // Remove potential JavaScript
  }

  static isValidFieldPath(fieldPath: string): boolean {
    const parts = fieldPath.split('.');
    return parts.length === 2 && parts.every(part => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(part));
  }
}

// ============= CACHING UTILITIES =============

export class SimpleCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; ttl: number }>();

  set(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

// ============= EXPORTS =============

export const ReSpecUtils = {
  Logger: ReSpecLogger,
  ErrorHandler: ReSpecErrorHandler,
  TextProcessor,
  UCNodeProcessor,
  FormFieldProcessor,
  PerformanceTracker,
  ValidationHelper,
  SimpleCache
};

export default ReSpecUtils;
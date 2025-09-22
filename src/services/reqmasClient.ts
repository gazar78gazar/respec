// src/services/reqmasClient.ts
// This is the COMPLETE API contract for frontend

interface SessionContext {
  application_domain: string;
  budget_range?: { min: number; max: number };
  enable_assessment: boolean;
}

interface FieldUpdate {
  field_name: string;
  value: any;
  trigger_validation: boolean;
  field_category: 'system' | 'io' | 'communication' | 'environmental' | 'commercial';
}

interface ChatMessage {
  message: string;
  attachments?: Array<{
    type: 'image' | 'document';
    url: string;
  }>;
}

interface ExtractedField {
  section: string;
  field: string;
  value: any;
  confidence: number;
  isAssumption: boolean;
}

interface ValidationResult {
  valid: boolean;
  confidence: number;
  conflicts?: Array<{
    fields: string[];
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  warnings?: string[];
  field_errors?: Record<string, string>;
}

interface AutofillResponse {
  fields: Record<string, any>;
  confidence: number;
  explanation: string;
  assumptions: string[];
}

interface ClarificationRequest {
  question_id: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
  }>;
}

class ReqMASClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_REQMAS_URL || 'http://localhost:8000';
  }

  // Error handling with graceful degradation
  private async handleRequest<T>(
    url: string, 
    options?: RequestInit
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      });
      
      if (!response.ok) {
        // Graceful degradation - frontend continues working
        console.warn(`ReqMAS API error: ${response.status}`);
        return {} as T; // Return empty, frontend uses local defaults
      }
      
      return response.json();
    } catch (error) {
      // Network error - frontend works offline
      console.warn('ReqMAS offline, using local mode');
      return {} as T;
    }
  }

  // 1. Session Management
  async initSession(context: SessionContext): Promise<string> {
    const data = await this.handleRequest<{session_id: string}>(
      `${this.baseUrl}/api/v1/session/create`,
      {
        method: 'POST',
        body: JSON.stringify({ user_context: context })
      }
    );
    
    this.sessionId = data.session_id || `local_${Date.now()}`;
    return this.sessionId;
  }

  async getSessionState(sessionId: string): Promise<{
    requirements: Record<string, any>;
    completionScore: number;
    validationStatus: ValidationResult;
  }> {
    return this.handleRequest(
      `${this.baseUrl}/api/v1/session/${sessionId}/state`
    );
  }

  // 2. Chat Integration
  async sendChatMessage(params: {
    sessionId: string;
    message: string;
  }): Promise<{
    agentResponse: string;
    extractedFields?: ExtractedField[];
    clarificationNeeded?: ClarificationRequest;
    confidence: number;
  }> {
    const result = await this.handleRequest<{
      agentResponse: string;
      extractedFields?: ExtractedField[];
      clarificationNeeded?: ClarificationRequest;
      confidence: number;
    }>(
      `${this.baseUrl}/api/v1/chat/message`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: params.sessionId,
          content: { message: params.message }
        })
      }
    );
    
    // Return fallback response if backend unavailable
    return {
      agentResponse: result.agentResponse || 'I\'m currently offline. Please try again later.',
      extractedFields: result.extractedFields || [],
      clarificationNeeded: result.clarificationNeeded,
      confidence: result.confidence || 0
    };
  }

  // 3. Form Field Updates
  async updateFormField(params: {
    sessionId: string;
    field_name: string;
    value: any;
    field_category: string;
  }): Promise<{
    validationResult?: ValidationResult;
    dependentUpdates?: Array<{field: string; value: any}>;
  }> {
    return this.handleRequest(
      `${this.baseUrl}/api/v1/form/update`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: params.sessionId,
          field_name: params.field_name,
          value: params.value,
          trigger_validation: true,
          field_category: params.field_category
        })
      }
    );
  }

  // 4. Autofill
  async triggerAutofill(sessionId: string): Promise<AutofillResponse> {
    const result = await this.handleRequest<AutofillResponse>(
      `${this.baseUrl}/api/v1/autofill/trigger`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          trigger_source: 'user_requested'
        })
      }
    );
    
    // Return empty response if backend unavailable (frontend will use fallback)
    return {
      fields: result.fields || {},
      confidence: result.confidence || 0,
      explanation: result.explanation || 'Using local defaults',
      assumptions: result.assumptions || []
    };
  }

  // 5. Validation
  async validateRequirements(sessionId: string): Promise<ValidationResult> {
    return this.handleRequest(
      `${this.baseUrl}/api/v1/requirements/validate`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          validation_type: 'comprehensive'
        })
      }
    );
  }

  // 6. Clarification Response
  async respondToClarification(params: {
    sessionId: string;
    questionId: string;
    answer: string | { option_id: string; custom_text?: string };
  }): Promise<{
    accepted: boolean;
    nextQuestion?: ClarificationRequest;
  }> {
    return this.handleRequest(
      `${this.baseUrl}/api/v1/clarification/respond`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: params.sessionId,
          question_id: params.questionId,
          answer: params.answer
        })
      }
    );
  }

  // 7. Get Recommendations
  async getRecommendations(sessionId: string): Promise<{
    recommendations: Array<{
      name: string;
      model_number: string;
      price: number;
      confidence_score: number;
      specs: Record<string, any>;
    }>;
    bundle?: {
      total_price: number;
      compatibility_score: number;
    };
  }> {
    return this.handleRequest(
      `${this.baseUrl}/api/v1/components/recommend`,
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          optimization_priority: 'balanced'
        })
      }
    );
  }

  // 8. Export Session
  async exportSession(sessionId: string, format: 'json' | 'pdf'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/session/${sessionId}/export?format=${format}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      return response.blob();
    } catch (error) {
      console.warn('Export unavailable, creating local export');
      // Return empty blob as fallback
      return new Blob(['Export currently unavailable'], { type: 'text/plain' });
    }
  }
}

// Export singleton instance
export const reqmasClient = new ReqMASClient();

// Export type for use in app.tsx
export type { ExtractedField, ValidationResult, AutofillResponse, ClarificationRequest };
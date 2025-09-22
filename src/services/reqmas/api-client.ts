import { SharedState, RequirementArtifact } from './types';

// ReqMAS API Client - Connects to backend service
export class ReqMASClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private pollInterval: number | null = null;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  // Initialize session
  async createSession(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      throw new Error('Failed to create session');
    }
    
    const data = await response.json();
    this.sessionId = data.sessionId;
    return this.sessionId;
  }

  // Process user input through the orchestrator
  async processInput(input: string): Promise<{
    response: string;
    state: {
      currentStep: string;
      requirementCount: number;
      conflicts: number;
      useCases: string[];
    };
  }> {
    if (!this.sessionId) {
      await this.createSession();
    }

    const response = await fetch(`${this.baseUrl}/api/v1/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        input
      })
    });

    if (!response.ok) {
      throw new Error('Failed to process input');
    }

    return response.json();
  }

  // Get current session state
  async getState(): Promise<SharedState | null> {
    if (!this.sessionId) return null;

    const response = await fetch(`${this.baseUrl}/api/v1/session/${this.sessionId}/state`);
    
    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  // Get debug log for testing
  async getDebugLog(): Promise<any[]> {
    if (!this.sessionId) return [];

    const response = await fetch(`${this.baseUrl}/api/v1/session/${this.sessionId}/debug`);
    
    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // Clear session
  clearSession(): void {
    this.sessionId = null;
  }
}
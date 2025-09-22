// LLM Service with fallback to rules
export class LLMService {
  private enabled: boolean;
  private provider: string;
  private apiKey: string | undefined;
  
  constructor() {
    // Check if LLM is configured
    this.enabled = import.meta.env.VITE_USE_LLM === 'true';
    this.provider = import.meta.env.VITE_LLM_PROVIDER || 'openai';
    
    // Get appropriate API key
    switch (this.provider) {
      case 'openai':
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        break;
      case 'anthropic':
        this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        break;
      case 'google':
        this.apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
        break;
    }
    
    // Validate configuration
    if (this.enabled && !this.apiKey) {
      console.warn('LLM enabled but no API key found. Falling back to rules.');
      this.enabled = false;
    }
  }
  
  isAvailable(): boolean {
    return this.enabled && !!this.apiKey;
  }
  
  async generateResponse(prompt: string, context?: any): Promise<string | null> {
    if (!this.isAvailable()) {
      return null; // Let rule-based system handle it
    }
    
    try {
      switch (this.provider) {
        case 'openai':
          return await this.callOpenAI(prompt, context);
        case 'anthropic':
          return await this.callAnthropic(prompt, context);
        case 'google':
          return await this.callGoogle(prompt, context);
        default:
          return null;
      }
    } catch (error) {
      console.error('LLM call failed:', error);
      return null; // Fallback to rules
    }
  }
  
  private async callOpenAI(prompt: string, context?: any): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_LLM_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a requirements elicitation assistant. Be concise and helpful.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || '0.7'),
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '500')
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  private async callAnthropic(prompt: string, context?: any): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_LLM_MODEL || 'claude-3-sonnet-20240229',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '500')
      })
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  private async callGoogle(prompt: string, context?: any): Promise<string> {
    // Google Gemini implementation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google AI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}
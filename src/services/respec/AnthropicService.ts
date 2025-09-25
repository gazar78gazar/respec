// Anthropic API Integration Service
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string;
  private isInitialized = false;

  constructor(apiKey?: string) {
    // Get API key from environment or constructor
    this.apiKey = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[AnthropicService] No API key provided - will use fallback responses');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.apiKey) {
      try {
        this.client = new Anthropic({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true // Required for browser usage
        });
        this.isInitialized = true;
        console.log('[AnthropicService] Initialized with API key');
      } catch (error) {
        console.error('[AnthropicService] Failed to initialize:', error);
        this.client = null;
      }
    } else {
      console.log('[AnthropicService] Running in fallback mode (no API key)');
      this.isInitialized = true;
    }
  }

  async analyzeRequirements(message: string, context?: any): Promise<{
    requirements: Array<{
      section: string;
      field: string;
      value: any;
      confidence: number;
      isAssumption: boolean;
    }>;
    response: string;
    clarificationNeeded?: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // If no client, return fallback
    if (!this.client) {
      return this.getFallbackResponse(message);
    }

    try {
      const systemPrompt = `You are a technical requirements extraction assistant for electronic systems.
Your task is to analyze user messages and extract specific requirements for form fields.

Available sections and fields:
- io: digital_inputs, analog_inputs, digital_outputs, analog_outputs, serial_ports_amount, ethernet_ports, wireless_extension
- compute_performance: processor_type, memory_capacity, storage_capacity, ai_gpu_acceleration
- power_environment: supply_voltage, max_power_consumption, operating_temperature
- commercial: quantity, budget_per_unit, total_budget

Instructions:
1. Extract any mentioned requirements
2. Map them to the correct section and field
3. Provide confidence scores (0-1)
4. Mark assumptions vs explicit requirements
5. Generate a helpful response

Return JSON format:
{
  "requirements": [
    {
      "section": "io",
      "field": "digital_inputs",
      "value": 8,
      "confidence": 0.9,
      "isAssumption": false
    }
  ],
  "response": "I understood you need 8 digital inputs...",
  "clarificationNeeded": "What voltage levels do you need?"
}`;

      const completion = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this requirement: "${message}"\n\nContext: ${JSON.stringify(context || {})}`
          }
        ]
      });

      // Parse the response
      const responseText = completion.content[0].type === 'text'
        ? completion.content[0].text
        : '';

      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            requirements: parsed.requirements || [],
            response: parsed.response || responseText,
            clarificationNeeded: parsed.clarificationNeeded
          };
        }
      } catch (parseError) {
        console.warn('[AnthropicService] Could not parse JSON response:', parseError);
      }

      // If parsing fails, return the text as response
      return {
        requirements: [],
        response: responseText || 'I processed your message but need more specific details.',
        clarificationNeeded: undefined
      };

    } catch (error) {
      console.error('[AnthropicService] API call failed:', error);
      return this.getFallbackResponse(message);
    }
  }

  private getFallbackResponse(message: string): any {
    // Simple pattern matching fallback
    const patterns = {
      digital_inputs: /(\d+)\s*(digital\s*inputs?|DI)/i,
      analog_inputs: /(\d+)\s*(analog\s*inputs?|AI)/i,
      digital_outputs: /(\d+)\s*(digital\s*outputs?|DO)/i,
      analog_outputs: /(\d+)\s*(analog\s*outputs?|AO)/i,
    };

    const requirements = [];

    for (const [field, pattern] of Object.entries(patterns)) {
      const match = message.match(pattern);
      if (match) {
        requirements.push({
          section: 'io',
          field,
          value: parseInt(match[1]),
          confidence: 0.8,
          isAssumption: false
        });
      }
    }

    if (requirements.length > 0) {
      return {
        requirements,
        response: `I found ${requirements.length} requirement(s) in your message.`,
        clarificationNeeded: undefined
      };
    }

    return {
      requirements: [],
      response: `I understand you mentioned: "${message}". Could you provide more specific details about quantities or specifications?`,
      clarificationNeeded: 'Please specify the type and quantity of I/O or other requirements.'
    };
  }
}
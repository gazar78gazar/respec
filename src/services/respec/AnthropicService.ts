// Anthropic API Integration Service
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string;
  private isInitialized = false;
  private fieldMappings: any = null;

  constructor(apiKey?: string) {
    // Get API key from environment or constructor
    this.apiKey = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[AnthropicService] No API key provided - will use fallback responses');
    }
  }

  async initialize(fieldMappings?: any): Promise<void> {
    if (this.isInitialized) return;

    // Store field mappings from UC1.json
    if (fieldMappings) {
      this.fieldMappings = fieldMappings;
      console.log('[AnthropicService] Received field mappings:', fieldMappings);
    }

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
      const systemPrompt = this.buildSystemPrompt();

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
    // Simple pattern matching fallback with correct field names
    const patterns = {
      digital_io: /(\d+)\s*(digital\s*(inputs?|outputs?|i\/o)|DI|DO)/i,
      analog_io: /(\d+)\s*(analog\s*(inputs?|outputs?|i\/o)|AI|AO)/i,
      ethernet_ports: /(\d+)\s*(ethernet\s*ports?)/i,
      processor_type: /(intel\s*(core\s*)?(i[357]|atom|xeon)|processor)/i,
      memory_capacity: /(\d+)\s*GB\s*(memory|ram)/i,
      quantity: /quantity\s*[:=]?\s*(\d+)/i,
      budget_per_unit: /budget\s*per\s*unit\s*[:=]?\s*(\d+)/i,
    };

    const requirements = [];

    // Check digital I/O
    const digitalMatch = message.match(patterns.digital_io);
    if (digitalMatch) {
      requirements.push({
        section: 'io_connectivity',
        field: 'digital_io',
        value: digitalMatch[1],
        confidence: 0.8,
        isAssumption: false
      });
    }

    // Check analog I/O
    const analogMatch = message.match(patterns.analog_io);
    if (analogMatch) {
      requirements.push({
        section: 'io_connectivity',
        field: 'analog_io',
        value: analogMatch[1],
        confidence: 0.8,
        isAssumption: false
      });
    }

    // Check other patterns
    for (const [field, pattern] of Object.entries(patterns)) {
      if (field === 'digital_io' || field === 'analog_io') continue;

      const match = message.match(pattern);
      if (match) {
        const section = field.startsWith('budget') || field === 'quantity' ? 'commercial' :
                       field.startsWith('ethernet') ? 'io_connectivity' :
                       field.startsWith('processor') || field.startsWith('memory') ? 'compute_performance' :
                       'io_connectivity';

        requirements.push({
          section,
          field,
          value: match[1],
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

  private buildSystemPrompt(): string {
    // Use dynamic field mappings from UC1.json if available, otherwise use defaults
    let fieldsDescription = '';

    if (this.fieldMappings) {
      // Build prompt from UC1.json mappings
      Object.entries(this.fieldMappings).forEach(([section, fields]) => {
        if (Array.isArray(fields) && fields.length > 0) {
          fieldsDescription += `- ${section}: ${fields.join(', ')}\n`;
        }
      });
    }

    // If no mappings or empty, use defaults based on actual form fields
    if (!fieldsDescription) {
      fieldsDescription = `- compute_performance: processor_type, ai_gpu_acceleration, memory_capacity, memory_type, storage_capacity, storage_type, time_sensitive_features, response_latency, operating_system
- io_connectivity: digital_io, analog_io, ethernet_ports, ethernet_speed, ethernet_protocols, usb_ports, serial_ports_amount, serial_port_type, serial_protocol_support, fieldbus_protocol_support, wireless_extension
- form_factor: power_input, max_power_consumption, redundant_power, dimensions, mounting
- environment_standards: operating_temperature, humidity, vibration_resistance, ingress_protection, vibration_protection, certifications
- commercial: budget_per_unit, quantity, total_budget, delivery_timeframe, shipping_incoterms, warranty_requirements`;
    }

    return `You are a technical requirements extraction assistant for industrial electronic systems.
Your task is to analyze user messages and extract specific requirements for form fields.

Available sections and fields:
${fieldsDescription}

Important notes:
- For "digital_io" and "analog_io" fields, these represent combined I/O counts (not separate input/output)
- Commercial fields (budget_per_unit, quantity, etc.) can be updated from user input but should NOT be autofilled
- When users mention "analog inputs" or "analog outputs", map to "analog_io" field
- When users mention "digital inputs" or "digital outputs", map to "digital_io" field
- Values should match the dropdown options where applicable (e.g., "8", "16", "32" for I/O counts)

Instructions:
1. Extract any mentioned requirements from the user's message
2. Map them to the correct section and field name
3. Provide confidence scores (0-1) based on clarity
4. Mark as assumption if inferred rather than explicitly stated
5. Generate a helpful, conversational response
6. Only suggest clarification if critical information is missing

Return JSON format:
{
  "requirements": [
    {
      "section": "io_connectivity",
      "field": "analog_io",
      "value": "8",
      "confidence": 0.9,
      "isAssumption": false
    }
  ],
  "response": "I've noted that you need 8 analog I/O channels.",
  "clarificationNeeded": null
}`;
  }
}
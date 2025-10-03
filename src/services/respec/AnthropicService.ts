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
      originalRequest?: string;
      substitutionNote?: string;
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

      // Build conversation history for Anthropic API
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Add previous conversation turns if available
      if (context?.conversationHistory && Array.isArray(context.conversationHistory)) {
        context.conversationHistory.forEach((turn: any) => {
          if (turn.role === 'user' || turn.role === 'assistant') {
            messages.push({
              role: turn.role,
              content: turn.content || ''
            });
          }
        });
      }

      // Add current message
      messages.push({
        role: 'user',
        content: `Analyze this requirement: "${message}"\n\nContext: ${JSON.stringify(context || {})}`
      });

      console.log(`[AnthropicService] 📜 Sending ${messages.length} messages (${messages.length - 1} history + 1 current)`);

      const completion = await this.client.messages.create({
        model: import.meta.env.VITE_LLM_MODEL || 'claude-opus-4-1-20250805',
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '1024'),
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || '0.3'),
        system: systemPrompt,
        messages
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

Conversational Flow:
- Start by getting the use case and relevant domains
- Elicit user to provide inputs by asking guiding questions
- Maintain user flow - Always know what category you're in and ask relevant questions
- Ask up to two questions per message
- Questions should be binary, multichoice, or for a measurement value/range
- Separate your question messages from other messages
- Remember full conversational context
- Handle "I Don't Know": Create assumptions with confidence=0.6, say "Let's assume [X]. You can always change that later."
- Every 4 extractions or 75% category completion: summarize all extracted requirements and move to next question

Use Case Questions (Ask First):
- "What is the primary use case for this system?"
- "Will this system monitor only, control only, or both monitor and control?"
- "How many devices or sensors will be connected?"

I/O Connectivity Questions:
- "How many analog inputs do you need?"
- "How many digital inputs and outputs do you need?"
- "What type of signals (4-20mA current or 0-10V voltage)?"

Communication Questions:
- "What communication protocols do you need (Ethernet, RS485, wireless)?"
- "How many Ethernet ports do you require?"

Performance Questions:
- "What operating system does your application run on?"
- "What response times do you need (regular or real-time)?"
- "How much data storage do you need?"

Environment Questions:
- "What is the ambient temperature range where the PC will operate?"
- "Does the system need to be fanless?"
- "What IP rating do you require for dust and moisture protection?"

Commercial Questions:
- "What is your budget per unit?"
- "What is your preferred lead time?"

CRITICAL: Field-Aware Value Selection
- When the user prompt includes "Available field options", you MUST only select from the provided options
- For dropdown fields, NEVER suggest values that aren't in the available options list
- If exact requested value isn't available, select the closest match and explain via substitutionNote
- Include originalRequest when you make substitutions

Important notes:
- For "digital_io" and "analog_io" fields, these represent combined I/O counts
- Commercial fields can be updated from user input but should NOT be autofilled
- When users mention "analog inputs" or "analog outputs", map to "analog_io" field
- When users mention "digital inputs" or "digital outputs", map to "digital_io" field
- Values should match the dropdown options where applicable

Instructions:
1. Extract any mentioned requirements from the user's message
2. Map them to the correct section and field name
3. For fields with available options, ONLY select from the provided list
4. If substitution needed, include originalRequest and substitutionNote
5. Provide confidence scores (0-1) based on clarity, use 0.6 for assumptions
6. Mark as assumption if inferred rather than explicitly stated by user
7. Generate a helpful, conversational response following the conversation flow above
8. Only suggest clarification if critical information is missing

Return JSON format:
{
  "requirements": [
    {
      "section": "compute_performance",
      "field": "storage_capacity",
      "value": "512GB",
      "confidence": 0.9,
      "isAssumption": false,
      "originalRequest": "500GB",
      "substitutionNote": "Selected 512GB as it's the closest available option to your requested 500GB"
    }
  ],
  "response": "I've selected 512GB storage, which is the closest available option to your requested 500GB.",
  "clarificationNeeded": null
}`;
  }
}
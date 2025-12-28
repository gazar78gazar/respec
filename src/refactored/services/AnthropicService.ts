/**
 * AnthropicService - LLM integration for requirement extraction and conflict routing.
 *
 * Handles prompt construction, fallback behavior, and conflict resolution parsing
 * without mutating artifact state.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ArtifactManager } from "./ArtifactManager";
import type {
  EntryResolutionOption,
  StructuredConflicts,
  StrucureConflictEntry,
} from "../types/GenericServiceTypes";

export class AnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string;
  private isInitialized = false;
  private fieldMappings: Record<string, string[]> = {};

  constructor(apiKey?: string) {
    // Get API key from environment or constructor
    this.apiKey = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "[AnthropicService] No API key provided - will use fallback responses",
      );
    }
  }

  async initialize(fieldMappings?: Record<string, string[]>): Promise<void> {
    if (this.isInitialized) return;

    // Store field mappings from UC1.json
    if (fieldMappings) {
      this.fieldMappings = fieldMappings;
      console.log("[AnthropicService] Received field mappings:", fieldMappings);
    }

    if (this.apiKey) {
      try {
        this.client = new Anthropic({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true, // Required for browser usage
        });
        this.isInitialized = true;
        console.log("[AnthropicService] Initialized with API key");
      } catch (error) {
        console.error("[AnthropicService] Failed to initialize:", error);
        this.client = null;
      }
    } else {
      console.log("[AnthropicService] Running in fallback mode (no API key)");
      this.isInitialized = true;
    }
  }

  async analyzeRequirements(
    message: string,
    context?: string,
  ): Promise<{
    requirements: Array<{
      section: string;
      field: string;
      value: string;
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
      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      // Add previous conversation turns if available
      // TODO zeev history can't exist on string
      // if (
      //   context?.conversationHistory &&
      //   Array.isArray(context.conversationHistory)
      // ) {
      //   context.conversationHistory.forEach((turn: any) => {
      //     if (turn.role === "user" || turn.role === "assistant") {
      //       messages.push({
      //         role: turn.role,
      //         content: turn.content || "",
      //       });
      //     }
      //   });
      // }

      // Add current message
      messages.push({
        role: "user",
        content: `Analyze this requirement: "${message}"\n\nContext: ${JSON.stringify(context || {})}`,
      });

      console.log(
        `[AnthropicService] 📜 Sending ${messages.length} messages (${messages.length - 1} history + 1 current)`,
      );

      const completion = await this.client.messages.create({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || "1024"),
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || "0.3"),
        system: systemPrompt,
        messages,
      });

      // Parse the response
      const responseText =
        completion.content[0].type === "text" ? completion.content[0].text : "";

      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            requirements: parsed.requirements || [],
            response: parsed.response || responseText,
            clarificationNeeded: parsed.clarificationNeeded,
          };
        }
      } catch (parseError) {
        console.warn(
          "[AnthropicService] Could not parse JSON response:",
          parseError,
        );
      }

      // If parsing fails, return the text as response
      return {
        requirements: [],
        response:
          responseText ||
          "I processed your message but need more specific details.",
        clarificationNeeded: undefined,
      };
    } catch (error) {
      console.error("[AnthropicService] API call failed:", error);
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
        section: "io_connectivity",
        field: "digital_io",
        value: digitalMatch[1],
        confidence: 0.8,
        isAssumption: false,
      });
    }

    // Check analog I/O
    const analogMatch = message.match(patterns.analog_io);
    if (analogMatch) {
      requirements.push({
        section: "io_connectivity",
        field: "analog_io",
        value: analogMatch[1],
        confidence: 0.8,
        isAssumption: false,
      });
    }

    // Check other patterns
    for (const [field, pattern] of Object.entries(patterns)) {
      if (field === "digital_io" || field === "analog_io") continue;

      const match = message.match(pattern);
      if (match) {
        const section =
          field.startsWith("budget") || field === "quantity"
            ? "commercial"
            : field.startsWith("ethernet")
              ? "io_connectivity"
              : field.startsWith("processor") || field.startsWith("memory")
                ? "compute_performance"
                : "io_connectivity";

        requirements.push({
          section,
          field,
          value: match[1],
          confidence: 0.8,
          isAssumption: false,
        });
      }
    }

    if (requirements.length > 0) {
      return {
        requirements,
        response: `I found ${requirements.length} requirement(s) in your message.`,
        clarificationNeeded: undefined,
      };
    }

    return {
      requirements: [],
      response: `I understand you mentioned: "${message}". Could you provide more specific details about quantities or specifications?`,
      clarificationNeeded:
        "Please specify the type and quantity of I/O or other requirements.",
    };
  }

  private buildSystemPrompt(): string {
    // Use dynamic field mappings from UC1.json if available, otherwise use defaults
    let fieldsDescription = "";

    if (this.fieldMappings) {
      // Build prompt from UC1.json mappings
      Object.entries(this.fieldMappings).forEach(([section, fields]) => {
        if (Array.isArray(fields) && fields.length > 0) {
          fieldsDescription += `- ${section}: ${fields.join(", ")}\n`;
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
}

Conflict Resolution Mode:
When you receive a message with metadata.isConflict = true:
1. Extract conflict data from the message
2. Read ALL conflicts in conflicts[] array (may be multiple conflicts from same data node)
3. If multiple conflicts exist, analyze their common theme and generate ONE aggregated binary question
4. Generate a conversational binary question:

Format for SINGLE conflict:
"I detected a conflict: {conflict.description}

Which would you prefer?
A) {resolutionOptions[0].label}
   Outcome: {resolutionOptions[0].outcome}

B) {resolutionOptions[1].label}
   Outcome: {resolutionOptions[1].outcome}

Please respond with A or B."

Format for MULTIPLE conflicts (AGGREGATE INTO ONE QUESTION):
Example: User adds "<10W power" which conflicts with BOTH i9 processor AND Xe Graphics
- Identify common theme: Both i9 and Xe Graphics are high-performance, <10W is low-power
- Generate aggregated question: "Do you prefer high performance processing or low power consumption?"
- Options:
  A) High performance processing (keep i9 and Xe Graphics, remove <10W constraint)
  B) Low power consumption (keep <10W, remove i9 and Xe Graphics)

When user responds (next message):
1. Parse their choice (A, B, "first", "second", etc.)
2. Map to option-a or option-b
3. The conflict resolution will be handled automatically
4. Confirm to user what was changed

CRITICAL:
- Only present 2 options (A and B)
- If conflicts[] has multiple items, create ONE question that addresses ALL conflicts thematically
- Wait for user choice before resolving
- Never auto-resolve conflicts
- Be conversational and friendly in presenting options
`;
  }

  // ============= SPRINT 3 WEEK 2: CONFLICT RESOLUTION =============

  /**
   * Parse user response for conflict resolution
   * Sprint 3 Week 2: Semantic interpretation of A/B choices
   */
  async parseConflictResponse(
    userMessage: string,
    _activeConflict: StrucureConflictEntry,
  ): Promise<{
    isResolution: boolean;
    choice: "a" | "b" | null;
    confidence: number;
    rawResponse: string;
    reasoning?: string;
  }> {
    if (!this.client) {
      // Fallback: Simple parsing for non-API mode
      const message = userMessage.toLowerCase().trim();

      if (
        message === "a" ||
        message === "option a" ||
        message === "first" ||
        message === "first one"
      ) {
        return {
          isResolution: true,
          choice: "a",
          confidence: 1.0,
          rawResponse: userMessage,
        };
      }
      if (
        message === "b" ||
        message === "option b" ||
        message === "second" ||
        message === "second one"
      ) {
        return {
          isResolution: true,
          choice: "b",
          confidence: 1.0,
          rawResponse: userMessage,
        };
      }

      return {
        isResolution: false,
        choice: null,
        confidence: 0.0,
        rawResponse: userMessage,
      };
    }

    try {
      const prompt = `
You are parsing a user response to a binary choice question.

The user was asked to choose between Option A or Option B.

User's response: "${userMessage}"

Determine:
1. Is this a response to the binary choice? (yes/no)
2. Which option did they choose? (A, B, or unclear)
3. How confident are you? (0.0 to 1.0)

Respond ONLY with valid JSON:
{
  "isResolution": true/false,
  "choice": "a" | "b" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Examples:
- "A" → {"isResolution": true, "choice": "a", "confidence": 1.0, "reasoning": "Direct A choice"}
- "I'll go with the first one" → {"isResolution": true, "choice": "a", "confidence": 0.9, "reasoning": "First implies A"}
- "Tell me more about option B" → {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Question, not choice"}
- "What's the difference?" → {"isResolution": false, "choice": null, "confidence": 0.0, "reasoning": "Asking for info"}
- "Option B please" → {"isResolution": true, "choice": "b", "confidence": 1.0, "reasoning": "Direct B choice"}
`;

      const completion = await this.client.messages.create({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: 256,
        temperature: 0.0, // Deterministic parsing
        messages: [{ role: "user", content: prompt }],
      });

      console.log("[AnthropicService] response before parsing", { completion });

      const raw =
        completion.content[0].type === "text"
          ? completion.content[0].text
          : "{}";
      const responseText = raw
        .replace(/^```[a-z]*\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(responseText);

      console.log("[AnthropicService] Parsed response:", parsed);

      return {
        isResolution: parsed.isResolution || false,
        choice: parsed.choice || null,
        confidence: parsed.confidence || 0.0,
        rawResponse: userMessage,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error(
        "[AnthropicService] Error parsing conflict response:",
        error,
      );

      // Fallback to simple parsing
      const message = userMessage.toLowerCase().trim();
      if (message.includes("a") && !message.includes("b")) {
        return {
          isResolution: true,
          choice: "a",
          confidence: 0.6,
          rawResponse: userMessage,
        };
      }
      if (message.includes("b") && !message.includes("a")) {
        return {
          isResolution: true,
          choice: "b",
          confidence: 0.6,
          rawResponse: userMessage,
        };
      }

      return {
        isResolution: false,
        choice: null,
        confidence: 0.0,
        rawResponse: userMessage,
      };
    }
  }

  /**
   * Generate clarification for user questions during conflict resolution
   * Sprint 3 Week 2: Handles user questions during resolution
   */
  private async generateClarification(
    userMessage: string,
    conflict: StrucureConflictEntry,
  ): Promise<string> {
    if (!this.client) {
      return `To help you decide, let me clarify:\n\nOption A: ${conflict.resolutionOptions[0].label}\nOption B: ${conflict.resolutionOptions[1].label}\n\nPlease choose A or B.`;
    }

    try {
      const prompt = `
The user is in a conflict resolution flow. They were asked to choose between:

Option A: ${conflict.resolutionOptions[0].label}
- Outcome: ${conflict.resolutionOptions[0].outcome}

Option B: ${conflict.resolutionOptions[1].label}
- Outcome: ${conflict.resolutionOptions[1].outcome}

Instead of choosing, they asked: "${userMessage}"

Provide a helpful clarification that:
1. Answers their question specifically
2. Keeps the answer brief (2-3 sentences)
3. Reminds them of the two options
4. Asks them to choose A or B

Keep it friendly and conversational.
`;

      const completion = await this.client.messages.create({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: 512,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText =
        completion.content[0].type === "text" ? completion.content[0].text : "";
      return responseText;
    } catch (error) {
      console.error(
        "[AnthropicService] Error generating clarification:",
        error,
      );
      return `To help you decide:\n\nOption A: ${conflict.resolutionOptions[0].label}\nOption B: ${conflict.resolutionOptions[1].label}\n\nWhich would you prefer? Please respond with A or B.`;
    }
  }

  /**
   * Orchestrate conflict resolution
   * Sprint 3 Week 2: Complete resolution flow
   */
  async handleConflictResolution(
    userMessage: string,
    conflictData: StructuredConflicts,
    artifactManager: ArtifactManager,
  ): Promise<{
    response: string;
    mode: string;
    conflictId?: string;
    chosenOption?: EntryResolutionOption;
    cycleCount?: number;
  }> {
    console.log("[AnthropicService] Handling conflict resolution", {
      userMessage,
      conflictData,
      artifactManager,
    });

    // Get the active conflict (one at a time)
    const conflict = conflictData.conflicts[0];

    // Step 1: Parse user response
    const parsed = await this.parseConflictResponse(userMessage, conflict);

    console.log("[AnthropicService] Parse result:", {
      isResolution: parsed.isResolution,
      choice: parsed.choice,
      confidence: parsed.confidence,
    });

    // Step 2: Handle non-resolution responses (user asking questions)
    if (!parsed.isResolution) {
      const clarification = await this.generateClarification(
        userMessage,
        conflict,
      );

      return {
        response: clarification,
        mode: "clarification_provided",
        conflictId: conflict.id,
      };
    }

    // Step 3: Handle low-confidence responses
    if (parsed.confidence < 0.7) {
      // Increment cycle count
      if (artifactManager.incrementConflictCycle) {
        artifactManager.incrementConflictCycle(conflict.id);
      }

      return {
        response: `I'm not sure which option you're choosing. Please respond with either "A" or "B".`,
        mode: "clarification_needed",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
    }

    // Step 4: Validate choice
    if (!parsed.choice || !["a", "b"].includes(parsed.choice)) {
      // Increment cycle count
      if (artifactManager.incrementConflictCycle) {
        artifactManager.incrementConflictCycle(conflict.id);
      }

      return {
        response: `Please choose either Option A or Option B.`,
        mode: "invalid_choice",
        conflictId: conflict.id,
        cycleCount: conflict.cycleCount + 1,
      };
    }

    // Step 5: Map choice to resolution option
    const resolutionId = parsed.choice === "a" ? "option-a" : "option-b";
    const selectedOption = conflict.resolutionOptions.find(
      (opt: EntryResolutionOption) => opt.id === resolutionId,
    );

    if (!selectedOption) {
      return {
        response: `I encountered an issue applying that choice, because selected option was not found.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
    }

    // Step 6: Call ArtifactManager to apply resolution
    try {
      await artifactManager.resolveConflict(conflict.id, resolutionId);

      // Step 7: Generate confirmation message
      const remainingConflicts = conflictData.totalConflicts
        ? conflictData.totalConflicts - 1
        : 0;

      let confirmation = `Got it! I've updated your configuration with ${selectedOption.label}.\n\n${selectedOption.outcome}`;

      if (remainingConflicts > 0) {
        confirmation += `\n\n📊 ${remainingConflicts} more conflict(s) to resolve.`;
      } else {
        confirmation += `\n\nYour system is now conflict-free. What else would you like to configure?`;
      }

      return {
        response: confirmation,
        mode: "resolution_success",
        conflictId: conflict.id,
        chosenOption: selectedOption,
      };
    } catch (error) {
      console.error("[AnthropicService] Resolution failed:", error);

      // Step 8: Handle resolution failure
      return {
        response: `I encountered an issue applying that choice: ${(error as Error).message}\n\nLet me try presenting the options again.`,
        mode: "resolution_failed",
        conflictId: conflict.id,
      };
    }
  }
}

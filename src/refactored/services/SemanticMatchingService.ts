/**
 * SemanticMatchingService - Stateless LLM for UC1 Semantic Matching
 *
 * Purpose: Matches already-extracted requirements to UC1 schema nodes
 * - Receives: Extracted data nodes from Agent
 * - Does: Semantic matching to UC1 (domain/requirement/specification)
 * - Returns: Best UC1 match with confidence score
 *
 * This is a STATELESS service - each call is independent
 * Full UC1 schema is loaded on every call for semantic matching
 */

import Anthropic from "@anthropic-ai/sdk";
import { UC1ValidationEngine } from "./UC1ValidationEngine";
import { ucDataLayer } from "./UCDataLayer";

// ============= TYPES =============

export interface ExtractedNode {
  text: string; // Original extracted text from user
  category?: string; // Optional hint: 'processor', 'memory', etc.
  value?: any; // Extracted value if applicable
  context?: string; // Original user message for context
}

export interface MatchResult {
  extractedNode: ExtractedNode;
  uc1Match: UC1Match;
  value?: any; // Final value (may be transformed)
}

export interface UC1Match {
  id: string; // e.g., 'spc001', 'req001', 'dom001'
  name: string; // e.g., 'processor_type'
  type: "domain" | "requirement" | "specification";
  confidence: number; // 0.0 - 1.0
  matchType: "exact" | "fuzzy" | "semantic";
  rationale?: string; // Why this match was chosen
}

export interface UC1SchemaContext {
  scenarios: Array<{ id: string; name: string; description: string }>;
  requirements: Array<{
    id: string;
    name: string;
    description: string;
    parent_scenarios?: string[];
  }>;
  specifications: Array<{
    id: string;
    name: string;
    description: string;
    parent_requirements?: string[];
    options?: string[];
    form_mapping?: {
      section: string;
      field_name: string;
      ui_type?: string;
    };
  }>;
}

// ============= MAIN SERVICE =============

export class SemanticMatchingService {
  private client: Anthropic | null = null;
  private apiKey: string;
  private uc1Engine: UC1ValidationEngine;

  constructor(uc1Engine: UC1ValidationEngine, apiKey?: string) {
    this.uc1Engine = uc1Engine;
    this.apiKey = apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || "";

    if (!this.apiKey) {
      console.warn(
        "[SemanticMatching] No API key - service will fail on calls"
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true,
      });
      console.log("[SemanticMatching] ✅ Initialized with Anthropic client");
    }
  }

  // ============= MAIN MATCHING METHOD =============

  async matchExtractedNodesToUC1(
    extractedNodes: ExtractedNode[]
  ): Promise<MatchResult[]> {
    if (!this.client) {
      throw new Error(
        "[SemanticMatching] ❌ Client not initialized. Call initialize() first."
      );
    }

    // SPRINT 3 FIX: Check UCDataLayer instead of UC1ValidationEngine
    if (!ucDataLayer.isLoaded()) {
      throw new Error(
        "[SemanticMatching] ❌ UCDataLayer not loaded - ensure ucDataLayer.load() is called at startup"
      );
    }

    console.log(
      "[SemanticMatching] 🔍 Matching",
      extractedNodes.length,
      "nodes to UC8 (P## IDs)"
    );

    // Prepare condensed UC1 schema (full schema would be too large)
    const uc1Context = this.prepareUC1Context();

    // Build prompt
    const prompt = this.buildMatchingPrompt(extractedNodes, uc1Context);

    try {
      const startTime = Date.now();

      // Call stateless LLM
      const completion = await this.client.messages.create({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || "2500"),
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || "0.3"),
        system: this.buildSystemPrompt(),
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      console.log(
        "[SemanticMatching] ⏱️  Matching completed in",
        duration,
        "ms"
      );

      // Parse response
      const responseText =
        completion.content[0].type === "text" ? completion.content[0].text : "";

      const matchResults = this.parseMatchResults(responseText);

      console.log(
        "[SemanticMatching] ✅ Matched",
        matchResults.length,
        "nodes"
      );
      matchResults.forEach((match) => {
        console.log(
          `  → ${match.extractedNode.text} → ${match.uc1Match.id} (${match.uc1Match.confidence})`
        );
      });

      return matchResults;
    } catch (error) {
      console.error("[SemanticMatching] ❌ Matching failed:", error);
      throw error; // Fail fast for MVP
    }
  }

  // ============= PROMPT BUILDING =============

  private buildSystemPrompt(): string {
    return `You are a semantic matching engine for UC8 (Power Substation Management) dataset.

Your task:
1. Receive extracted technical requirements from user input
2. Match each extraction to the best UC8 node (scenario, requirement, or specification)
3. Provide confidence score and match rationale

IMPORTANT: Return specification IDs in P## format (e.g., P01, P82, P27) - NOT spc### format.

Matching rules:
- Use semantic similarity, not just exact text match
- "budget friendly" should match to budget-related requirements
- "fast response" should match to response time specifications
- "outdoor" should match to environmental requirements
- "high performance processor" should match to processor specifications (e.g., P82 for Core i9)
- "low power" or "<10W" should match to power consumption specifications (e.g., P27)
- "thermal imaging" should match to thermal monitoring requirements

Classification hints:
- Specifications have specific values and map to form fields (IDs start with P)
- Requirements are functional needs that group specifications (IDs start with R)
- Scenarios are high-level use cases (IDs start with S)

Confidence scoring:
- 1.0 = Exact match (user said "Intel Core i9", dataset has that option)
- 0.9 = High confidence semantic match
- 0.8 = Good semantic match with some interpretation
- 0.7 = Acceptable match but ambiguous
- <0.7 = Low confidence, should ask for clarification

Return ONLY valid JSON with P## IDs, no additional text.`;
  }

  private buildMatchingPrompt(
    extractedNodes: ExtractedNode[],
    uc1Context: UC1SchemaContext
  ): string {
    return `Match these extracted nodes to UC8 schema:

EXTRACTED NODES:
${JSON.stringify(extractedNodes, null, 2)}

UC8 SCHEMA CONTEXT:
${JSON.stringify(uc1Context, null, 2)}

Return JSON array of matches using P## IDs:
{
  "matches": [
    {
      "extractedText": "original extracted text",
      "uc1Match": {
        "id": "P82",
        "name": "processor_type",
        "type": "specification",
        "confidence": 0.95,
        "matchType": "semantic",
        "rationale": "User mentioned high performance processor, semantically matches to Intel Core i9 processor specification"
      },
      "value": "Intel Core i9"
    }
  ]
}

CRITICAL: Use P## format IDs (P82, P27, etc.) NOT spc### format.
Match ALL provided nodes. If no good match exists, use confidence < 0.5.`;
  }

  // ============= UC8 CONTEXT PREPARATION =============
  // SPRINT 3 FIX: Now uses UCDataLayer to get P## IDs instead of UC1ValidationEngine spc### IDs

  private prepareUC1Context(): UC1SchemaContext {
    const context: UC1SchemaContext = {
      scenarios: [],
      requirements: [],
      specifications: [],
    };

    // Check if UCDataLayer is loaded
    if (!ucDataLayer.isLoaded()) {
      console.error("[SemanticMatching] ❌ UCDataLayer not loaded");
      return context;
    }

    // Add scenarios (UC8 equivalent of domains)
    const scenarios = ucDataLayer.getAllScenarios();
    scenarios.forEach((scenario) => {
      context.scenarios.push({
        id: scenario.id,
        name: scenario.name,
        description: scenario.description || "",
      });
    });

    // Add requirements
    const requirements = ucDataLayer.getAllRequirements();
    requirements.forEach((req) => {
      context.requirements.push({
        id: req.id,
        name: req.name,
        description: req.description || "",
        parent_scenarios: req.parent_scenarios || [],
      });
    });

    // Add specifications (with P## IDs)
    const specifications = ucDataLayer.getAllSpecifications();
    specifications.forEach((spec) => {
      context.specifications.push({
        id: spec.id, // P## format from UC8
        name: spec.name,
        description: spec.description || "",
        parent_requirements: spec.parent_requirements || [],
        options: spec.options,
        form_mapping: spec.form_mapping,
      });
    });

    console.log(
      "[SemanticMatching] 📦 UC8 Context (P## IDs):",
      context.scenarios.length,
      "scenarios,",
      context.requirements.length,
      "requirements,",
      context.specifications.length,
      "specifications"
    );

    return context;
  }

  // ============= RESPONSE PARSING =============

  private parseMatchResults(responseText: string): MatchResult[] {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const matches = parsed.matches || [];

      // Convert to MatchResult format
      const results: MatchResult[] = matches.map((match: any) => ({
        extractedNode: {
          text: match.extractedText,
          value: match.value,
        },
        uc1Match: {
          id: match.uc1Match.id,
          name: match.uc1Match.name,
          type: match.uc1Match.type,
          confidence: match.uc1Match.confidence,
          matchType: match.uc1Match.matchType || "semantic",
          rationale: match.uc1Match.rationale,
        },
        value: match.value,
      }));

      return results;
    } catch (error) {
      console.error(
        "[SemanticMatching] ❌ Failed to parse LLM response:",
        error
      );
      console.error("Response was:", responseText);
      throw new Error("Failed to parse matching results from LLM");
    }
  }
}

// ============= FACTORY FUNCTION =============

export function createSemanticMatchingService(
  uc1Engine: UC1ValidationEngine,
  apiKey?: string
): SemanticMatchingService {
  return new SemanticMatchingService(uc1Engine, apiKey);
}

/**
 * SemanticExtractor - Stateless LLM for UC Semantic Matching
 *
 * Purpose: Matches already-extracted requirements to UC schema nodes
 * - Receives: Extracted data nodes from Agent
 * - Does: Semantic matching to UC specifications (P##)
 * - Returns: Best UC spec match with confidence score
 *
 * This is a STATELESS service - each call is independent
 * Full UC schema is loaded on every call for semantic matching
 */

import { ucDataLayer } from "../DataLayer";
import { AnthropicService } from "../AnthropicService";
import { LocalPromptProvider } from "../prompts/PromptProvider";
import type { PromptProvider } from "../interfaces/PromptProvider";
import type {
  ExtractedNode,
  MatchResult,
  UCSchemaContext,
} from "../../types/semantic.types";

export class SemanticExtractor {
  private anthropicService: AnthropicService;
  private promptProvider: PromptProvider;

  constructor(
    anthropicService?: AnthropicService,
    promptProvider?: PromptProvider,
  ) {
    this.anthropicService = anthropicService || new AnthropicService();
    this.promptProvider = promptProvider || new LocalPromptProvider();
  }

  async initialize(): Promise<void> {
    await this.anthropicService.initialize();

    if (this.anthropicService.hasClient()) {
      console.log("[SemanticExtractor] ✅ Initialized with Anthropic client");
    }
  }

  async matchExtractedNodesToUC(
    extractedNodes: ExtractedNode[],
  ): Promise<MatchResult[]> {
    if (!this.anthropicService.hasClient()) {
      throw new Error(
        "[SemanticExtractor] ❌ Client not initialized. Call initialize() first.",
      );
    }

    if (!ucDataLayer.isLoaded()) {
      throw new Error(
        "[SemanticExtractor] ❌ UCDataLayer not loaded - ensure ucDataLayer.load() is called at startup",
      );
    }

    console.log(
      "[SemanticExtractor] 🔍 Matching",
      extractedNodes.length,
      "nodes to UC8 (P## IDs)",
    );

    const ucContext = this.prepareUCContext();

    const prompt = this.buildMatchingPrompt(extractedNodes, ucContext);

    try {
      const startTime = Date.now();

      const system = await this.buildSystemPrompt();
      console.log("[SemanticMathingService] system prompt", { system });

      const completion = await this.anthropicService.createMessage({
        model: import.meta.env.VITE_LLM_MODEL || "claude-opus-4-1-20250805",
        max_tokens: parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || "2500"),
        temperature: parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || "0.3"),
        system,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      console.log(
        "[SemanticExtractor] ⏱️  Matching completed in",
        duration,
        "ms",
      );

      const primaryContent = completion.content[0];
      const responseText =
        primaryContent?.type === "text" ? primaryContent.text || "" : "";

      const matchResults = this.parseMatchResults(responseText);

      console.log(
        "[SemanticExtractor] ✅ Matched",
        matchResults.length,
        "nodes",
      );
      matchResults.forEach((match) => {
        console.log(
          `  -> ${match.extractedNode.text} -> ${match.ucMatch.id} (${match.ucMatch.confidence})`,
        );
      });

      return matchResults;
    } catch (error) {
      console.error("[SemanticExtractor] ❌ Matching failed:", error);
      throw error;
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    return this.promptProvider.getPrompt("semantic-extractor");
  }

  private buildMatchingPrompt(
    extractedNodes: ExtractedNode[],
    ucContext: UCSchemaContext,
  ): string {
    return `Match these extracted nodes to UC8 schema:

EXTRACTED NODES:
${JSON.stringify(extractedNodes, null, 2)}

UC8 SCHEMA CONTEXT:
${JSON.stringify(ucContext, null, 2)}

Return JSON array of matches using P## IDs:
{
  "matches": [
    {
      "extractedText": "original extracted text",
      "ucMatch": {
        "id": "P82",
        "name": "processorType",
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

  private prepareUCContext(): UCSchemaContext {
    const context: UCSchemaContext = {
      specifications: [],
    };

    if (!ucDataLayer.isLoaded()) {
      console.error("[SemanticExtractor] ❌ UCDataLayer not loaded");
      return context;
    }

    const specifications = ucDataLayer.getAllSpecifications();
    specifications.forEach((spec) => {
      context.specifications.push({
        id: spec.id,
        name: spec.name,
        description: spec.description || "",
        form_mapping:
          ucDataLayer.getUiFieldByFieldName(spec.field_name) || undefined,
      });
    });

    console.log(
      "[SemanticExtractor] 📦 UC8 Context (P## IDs):",
      context.specifications.length,
      "specifications",
    );

    return context;
  }

  private parseMatchResults(responseText: string): MatchResult[] {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const matches = parsed.matches || [];

      const results: MatchResult[] = matches.map((match: MatchResult) => ({
        extractedText: match.extractedText,
        extractedNode: {
          text: match.extractedText,
          value: match.value,
        },
        ucMatch: {
          id: match.ucMatch.id,
          name: match.ucMatch.name,
          type: "specification",
          confidence: match.ucMatch.confidence,
          matchType: match.ucMatch.matchType || "semantic",
          rationale: match.ucMatch.rationale,
        },
        value: match.value,
      }));

      return results;
    } catch (error) {
      console.error(
        "[SemanticExtractor] ❌ Failed to parse LLM response:",
        error,
      );
      console.error("Response was:", responseText);
      throw new Error("Failed to parse matching results from LLM");
    }
  }
}

export function createSemanticExtractor(
  anthropicService?: AnthropicService,
  promptProvider?: PromptProvider,
): SemanticExtractor {
  return new SemanticExtractor(anthropicService, promptProvider);
}

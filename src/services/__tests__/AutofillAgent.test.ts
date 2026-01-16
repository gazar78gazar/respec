import { describe, expect, it, vi } from "vitest";
import { AutofillAgent } from "../agents/AutofillAgent";
import type { AnthropicService } from "../AnthropicService";
import type { PromptProvider } from "../interfaces/PromptProvider";
import type { AutofillAgentContext } from "../../types/semantic.types";

const createAgent = (responseText: string) => {
  const anthropicService = {
    initialize: vi.fn().mockResolvedValue(undefined),
    hasClient: vi.fn().mockReturnValue(true),
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: responseText }],
    }),
  } as unknown as AnthropicService;

  const promptProvider = {
    getPrompt: vi.fn().mockResolvedValue("prompt"),
  } as unknown as PromptProvider;

  const agent = new AutofillAgent(anthropicService, promptProvider);
  return { agent, anthropicService, promptProvider };
};

describe("AutofillAgent", () => {
  it("parses question responses", async () => {
    const response = JSON.stringify([
      { type: "message", content: "Two quick questions:" },
      { type: "message", content: "1. Optimize for performance?" },
    ]);
    const { agent } = createAgent(response);

    const result = await agent.runAutofill({
      currentSelections: {},
      remainingSpecs: { cpu: ["Entry", "Performance"] },
    } satisfies AutofillAgentContext);

    expect(result.mode).toBe("questions");
    expect(result.message).toContain("Two quick questions");
    expect(result.selections).toHaveLength(0);
  });

  it("parses selection responses", async () => {
    const response = JSON.stringify([
      {
        type: "selection",
        specifications: ["memoryType:DDR4", "gpuAcceleration:Not Required"],
      },
    ]);
    const { agent } = createAgent(response);

    const result = await agent.runAutofill({
      currentSelections: {},
      remainingSpecs: { memoryType: ["DDR4"] },
    } satisfies AutofillAgentContext);

    expect(result.mode).toBe("selections");
    expect(result.selections).toEqual([
      { field: "memoryType", value: "DDR4" },
      { field: "gpuAcceleration", value: "Not Required" },
    ]);
  });

  it("ignores autofill context echoes", async () => {
    const response = `[AUTOFILL_CONTEXT: {"remainingSpecs":{"cpu":["Entry"]}}]`;
    const { agent } = createAgent(response);

    const result = await agent.runAutofill({
      currentSelections: {},
      remainingSpecs: { cpu: ["Entry"] },
    } satisfies AutofillAgentContext);

    expect(result.mode).toBe("empty");
    expect(result.message).toBe("");
    expect(result.selections).toHaveLength(0);
  });
});

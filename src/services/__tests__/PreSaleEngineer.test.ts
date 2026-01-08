import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreSaleEngineer } from "../agents/PreSaleEngineer";
import type { PromptProvider } from "../prompts/PromptProvider";
import type { StructuredConflicts } from "../../types/service.types";

const makePromptProvider = (template: string): PromptProvider => ({
  getPrompt: vi.fn().mockResolvedValue(template),
});

describe("PreSaleEngineer", () => {
  let anthropicService: {
    initialize: ReturnType<typeof vi.fn>;
    hasClient: ReturnType<typeof vi.fn>;
    createMessage: ReturnType<typeof vi.fn>;
  };
  let promptProvider: PromptProvider;
  let agent: PreSaleEngineer;

  beforeEach(() => {
    anthropicService = {
      initialize: vi.fn(),
      hasClient: vi.fn().mockReturnValue(false),
      createMessage: vi.fn(),
    };
    promptProvider = makePromptProvider("{{fieldsDescription}}");
    agent = new PreSaleEngineer(
      anthropicService as unknown as any,
      promptProvider,
    );
    vi.clearAllMocks();
  });

  it("stores field mappings and initializes the Anthropic client", async () => {
    const fieldMappings = {
      IOConnectivity: ["digitalIO", "analogIO"],
    };
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await agent.initialize(fieldMappings);

    expect(anthropicService.initialize).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[PreSaleEngineer] Received field mappings:",
      fieldMappings,
    );
    consoleSpy.mockRestore();
  });

  it("injects field mappings into the system prompt", async () => {
    const fieldMappings = {
      IOConnectivity: ["digitalIO", "analogIO"],
      computePerformance: ["processorType", "memoryCapacity"],
    };

    await agent.initialize(fieldMappings);

    const prompt = await (
      agent as { buildSystemPrompt: () => Promise<string> }
    ).buildSystemPrompt();

    expect(prompt).toContain("IOConnectivity: digitalIO, analogIO");
    expect(prompt).toContain(
      "computePerformance: processorType, memoryCapacity",
    );
  });

  it("uses default field descriptions when no mappings are available", async () => {
    await agent.initialize();

    const prompt = await (
      agent as { buildSystemPrompt: () => Promise<string> }
    ).buildSystemPrompt();

    expect(prompt).toContain("computePerformance: processorType");
    expect(prompt).toContain("IOConnectivity: digitalIO");
    expect(prompt).toContain("commercial: budgetPerUnit");
  });

  it("returns fallback response when client is unavailable", async () => {
    await agent.initialize();

    const result = await agent.analyzeRequirements("hello");

    expect(result.requirements).toHaveLength(0);
    expect(result.response).toContain("Empty response returned");
  });

  it("parses JSON responses from the LLM", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    anthropicService.createMessage.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requirements: [
              {
                section: "IOConnectivity",
                field: "digitalIO",
                value: "8",
                confidence: 0.8,
                isAssumption: false,
              },
            ],
            response: "ok",
          }),
        },
      ],
    });

    await agent.initialize();

    const result = await agent.analyzeRequirements("digital inputs");

    expect(result.requirements).toHaveLength(1);
    expect(result.response).toBe("ok");
  });

  it("parses conflict responses in fallback mode", async () => {
    const resultA = await agent.parseConflictResponse("A", {} as any);
    const resultB = await agent.parseConflictResponse("second one", {} as any);
    const resultNone = await agent.parseConflictResponse("maybe", {} as any);

    expect(resultA.isResolution).toBe(true);
    expect(resultA.choice).toBe("a");
    expect(resultB.choice).toBe("b");
    expect(resultNone.isResolution).toBe(false);
  });

  it("parses conflict responses via client JSON", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    anthropicService.createMessage.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isResolution: true,
            choice: "b",
            confidence: 0.9,
            reasoning: "Direct choice",
          }),
        },
      ],
    });

    const result = await agent.parseConflictResponse("Option B", {} as any);

    expect(result.isResolution).toBe(true);
    expect(result.choice).toBe("b");
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it("generates aggregated conflict question via LLM", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    anthropicService.createMessage.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Aggregated conflict question",
        },
      ],
    });

    const conflictData: StructuredConflicts = {
      hasConflicts: true,
      count: 2,
      currentConflict: 1,
      totalConflicts: 2,
      systemBlocked: true,
      conflicts: [
        {
          id: "conflict-1",
          description: "Conflict 1",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A1", outcome: "Keep A1" },
            { id: "option-b", label: "Keep B1", outcome: "Keep B1" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
        {
          id: "conflict-2",
          description: "Conflict 2",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A2", outcome: "Keep A2" },
            { id: "option-b", label: "Keep B2", outcome: "Keep B2" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
      ],
    };

    const question = await agent.generateConflictQuestion(conflictData);

    expect(anthropicService.createMessage).toHaveBeenCalled();
    expect(question).toBe("Aggregated conflict question");
  });

  it("falls back to aggregated question when no client is available", async () => {
    const conflictData: StructuredConflicts = {
      hasConflicts: true,
      count: 2,
      currentConflict: 1,
      totalConflicts: 2,
      systemBlocked: true,
      conflicts: [
        {
          id: "conflict-1",
          description: "Conflict 1",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A1", outcome: "Keep A1" },
            { id: "option-b", label: "Keep B1", outcome: "Keep B1" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
        {
          id: "conflict-2",
          description: "Conflict 2",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A2", outcome: "Keep A2" },
            { id: "option-b", label: "Keep B2", outcome: "Keep B2" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
      ],
    };

    const question = await agent.generateConflictQuestion(conflictData);

    expect(question).toContain("I detected 2 conflicts");
    expect(question).toContain("Option A");
    expect(question).toContain("Option B");
  });

  it("provides clarification when response is not a resolution", async () => {
    const conflict = {
      id: "conflict-1",
      description: "Conflict",
      resolutionOptions: [
        { id: "option-a", label: "Keep A", outcome: "Keep A" },
        { id: "option-b", label: "Keep B", outcome: "Keep B" },
      ],
    };

    const response = await (agent as any).generateClarification(
      "what happens?",
      conflict,
    );

    expect(response).toContain("Option A");
    expect(response).toContain("Option B");
  });

  describe("handleConflictResolution", () => {
    const conflictData: StructuredConflicts = {
      hasConflicts: true,
      count: 1,
      currentConflict: 1,
      totalConflicts: 1,
      systemBlocked: true,
      conflicts: [
        {
          id: "conflict-1",
          description: "Conflict",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A", outcome: "Keep A" },
            { id: "option-b", label: "Keep B", outcome: "Keep B" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
      ],
    };

    const multiConflictData: StructuredConflicts = {
      hasConflicts: true,
      count: 2,
      currentConflict: 1,
      totalConflicts: 2,
      systemBlocked: true,
      conflicts: [
        {
          id: "conflict-1",
          description: "Conflict",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A", outcome: "Keep A" },
            { id: "option-b", label: "Keep B", outcome: "Keep B" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
        {
          id: "conflict-2",
          description: "Conflict",
          affectedNodes: [],
          resolutionOptions: [
            { id: "option-a", label: "Keep A2", outcome: "Keep A2" },
            { id: "option-b", label: "Keep B2", outcome: "Keep B2" },
          ],
          cycleCount: 0,
          priority: "high",
          type: "exclusion",
        },
      ],
    };

    it("asks for clarification when response is not a resolution", async () => {
      const parseSpy = vi
        .spyOn(agent as any, "parseConflictResponse")
        .mockResolvedValue({
          isResolution: false,
          choice: null,
          confidence: 0,
          rawResponse: "what?",
        });

      const result = await agent.handleConflictResolution(
        "what?",
        conflictData,
        {
          resolveConflict: vi.fn(),
          incrementConflictCycle: vi.fn(),
        } as any,
      );

      expect(parseSpy).toHaveBeenCalled();
      expect(result.mode).toBe("clarification_provided");
    });

    it("increments cycle count on low-confidence resolution", async () => {
      const incrementConflictCycle = vi.fn();

      vi.spyOn(agent as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.6,
        rawResponse: "a",
      });

      const result = await agent.handleConflictResolution("a", conflictData, {
        resolveConflict: vi.fn(),
        incrementConflictCycle,
      } as any);

      expect(incrementConflictCycle).toHaveBeenCalledWith("conflict-1");
      expect(result.mode).toBe("clarification_needed");
    });

    it("handles invalid choices", async () => {
      const incrementConflictCycle = vi.fn();

      vi.spyOn(agent as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "c",
        confidence: 0.9,
        rawResponse: "c",
      });

      const result = await agent.handleConflictResolution("c", conflictData, {
        resolveConflict: vi.fn(),
        incrementConflictCycle,
      } as any);

      expect(incrementConflictCycle).toHaveBeenCalledWith("conflict-1");
      expect(result.mode).toBe("invalid_choice");
    });

    it("applies resolution successfully", async () => {
      vi.spyOn(agent as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "b",
        confidence: 0.9,
        rawResponse: "b",
      });

      const resolveConflict = vi.fn();
      const getState = vi.fn().mockReturnValue({
        conflicts: {
          active: [{ id: "conflict-1" }],
        },
      });

      const result = await agent.handleConflictResolution("b", conflictData, {
        resolveConflict,
        getState,
      } as any);

      expect(resolveConflict).toHaveBeenCalledWith("conflict-1", "option-b");
      expect(result.mode).toBe("resolution_success");
    });

    it("handles resolution failures", async () => {
      vi.spyOn(agent as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.9,
        rawResponse: "a",
      });

      const resolveConflict = vi.fn().mockRejectedValue(new Error("boom"));
      const getState = vi.fn().mockReturnValue({
        conflicts: {
          active: [{ id: "conflict-1" }],
        },
      });

      const result = await agent.handleConflictResolution("a", conflictData, {
        resolveConflict,
        getState,
      } as any);

      expect(result.mode).toBe("resolution_failed");
    });

    it("applies the chosen option to all active conflicts", async () => {
      vi.spyOn(agent as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.9,
        rawResponse: "a",
      });

      const resolveConflict = vi.fn();
      const getState = vi.fn().mockReturnValue({
        conflicts: {
          active: [{ id: "conflict-1" }, { id: "conflict-2" }],
        },
      });

      const result = await agent.handleConflictResolution(
        "a",
        multiConflictData,
        {
          resolveConflict,
          getState,
        } as any,
      );

      expect(resolveConflict).toHaveBeenCalledWith("conflict-1", "option-a");
      expect(resolveConflict).toHaveBeenCalledWith("conflict-2", "option-a");
      expect(result.mode).toBe("resolution_success");
    });
  });
});

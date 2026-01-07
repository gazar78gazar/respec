import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicService } from "../AnthropicService";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

describe("AnthropicService (refactored)", () => {
  let service: AnthropicService;

  beforeEach(() => {
    service = new AnthropicService("test-api-key");
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("initializes with provided API key", () => {
      const serviceWithKey = new AnthropicService("my-key");
      expect(serviceWithKey).toBeDefined();
    });

    it("warns when no API key is provided", () => {
      vi.stubEnv("VITE_ANTHROPIC_API_KEY", "");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      new AnthropicService();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[AnthropicService] No API key provided - will use fallback responses",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("initialize", () => {
    it("initializes successfully with API key", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AnthropicService] Initialized with API key",
      );
      consoleSpy.mockRestore();
    });

    it("stores field mappings when provided", async () => {
      const fieldMappings = {
        IOConnectivity: ["digitalIO", "analogIO"],
      };
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.initialize(fieldMappings);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AnthropicService] Received field mappings:",
        fieldMappings,
      );
      consoleSpy.mockRestore();
    });
  });

  describe("analyzeRequirements - fallback mode", () => {
    beforeEach(() => {
      service = new AnthropicService();
    });

    it("extracts digital I/O requirements", async () => {
      const result = await service.analyzeRequirements(
        "I need 16 digital inputs",
      );

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: "IOConnectivity",
        field: "digitalIO",
        value: "16",
        confidence: 0.8,
        isAssumption: false,
      });
    });

    it("extracts analog I/O requirements", async () => {
      const result = await service.analyzeRequirements(
        "I need 8 analog inputs",
      );

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: "IOConnectivity",
        field: "analogIO",
        value: "8",
        confidence: 0.8,
        isAssumption: false,
      });
    });

    it("extracts ethernet ports requirements", async () => {
      const result = await service.analyzeRequirements(
        "I need 2 ethernet ports",
      );

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: "IOConnectivity",
        field: "ethernetPorts",
        value: "2",
        confidence: 0.8,
        isAssumption: false,
      });
    });

    it("extracts processor requirements", async () => {
      const result = await service.analyzeRequirements(
        "I need an Intel Core i7 processor",
      );

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: "computePerformance",
        field: "processorType",
        value: "Intel Core i7",
        confidence: 0.8,
        isAssumption: false,
      });
    });

    it("extracts memory requirements", async () => {
      const result = await service.analyzeRequirements("I need 8GB memory");

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: "computePerformance",
        field: "memoryCapacity",
        value: "8",
        confidence: 0.8,
        isAssumption: false,
      });
    });

    it("extracts multiple requirements from a single message", async () => {
      const result = await service.analyzeRequirements(
        "I need 16 digital inputs and 8 analog inputs",
      );

      expect(result.requirements).toHaveLength(2);
      expect(result.requirements.map((r) => r.field)).toContain("digitalIO");
      expect(result.requirements.map((r) => r.field)).toContain("analogIO");
    });

    it("returns clarification request when no specifications found", async () => {
      const result = await service.analyzeRequirements("Hello there");

      expect(result.requirements).toHaveLength(0);
      expect(result.clarificationNeeded).toBeDefined();
      expect(result.response).toContain("Could you provide more specific");
    });

    it("handles quantity and budget patterns", async () => {
      const result = await service.analyzeRequirements(
        "quantity: 5 and budget per unit: 1000",
      );

      expect(result.requirements).toHaveLength(2);
      const fields = result.requirements.map((r) => r.field);
      expect(fields).toContain("quantity");
      expect(fields).toContain("budgetPerUnit");
    });
  });

  describe("buildSystemPrompt", () => {
    it("includes field mappings in system prompt when available", async () => {
      const fieldMappings = {
        IOConnectivity: ["digitalIO", "analogIO"],
        computePerformance: ["processorType", "memoryCapacity"],
      };

      await service.initialize(fieldMappings);

      const prompt = (
        service as { buildSystemPrompt: () => string }
      ).buildSystemPrompt();

      expect(prompt).toContain("IOConnectivity: digitalIO, analogIO");
      expect(prompt).toContain(
        "computePerformance: processorType, memoryCapacity",
      );
    });

    it("uses default field descriptions when no mappings provided", async () => {
      await service.initialize();

      const prompt = (
        service as { buildSystemPrompt: () => string }
      ).buildSystemPrompt();

      expect(prompt).toContain("computePerformance: processorType");
      expect(prompt).toContain("IOConnectivity: digitalIO");
      expect(prompt).toContain("commercial: budgetPerUnit");
    });
  });

  describe("conflict resolution helpers", () => {
    it("parses conflict responses in fallback mode", async () => {
      const serviceNoClient = new AnthropicService();

      const resultA = await serviceNoClient.parseConflictResponse(
        "A",
        {} as any,
      );
      const resultB = await serviceNoClient.parseConflictResponse(
        "second one",
        {} as any,
      );
      const resultNone = await serviceNoClient.parseConflictResponse(
        "maybe",
        {} as any,
      );

      expect(resultA.isResolution).toBe(true);
      expect(resultA.choice).toBe("a");
      expect(resultB.choice).toBe("b");
      expect(resultNone.isResolution).toBe(false);
    });

    it("parses conflict responses via client JSON", async () => {
      const serviceWithClient = new AnthropicService("test-api-key");
      (serviceWithClient as unknown as { client: unknown }).client = {
        messages: {
          create: vi.fn().mockResolvedValue({
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
          }),
        },
      };

      const result = await serviceWithClient.parseConflictResponse(
        "Option B",
        {} as any,
      );

      expect(result.isResolution).toBe(true);
      expect(result.choice).toBe("b");
      expect(result.confidence).toBeCloseTo(0.9);
    });

    it("provides clarification when response is not a resolution", async () => {
      const serviceNoClient = new AnthropicService();
      const conflict = {
        id: "conflict-1",
        description: "Conflict",
        resolutionOptions: [
          { id: "option-a", label: "Keep A", outcome: "Keep A" },
          { id: "option-b", label: "Keep B", outcome: "Keep B" },
        ],
      };

      const response = await (serviceNoClient as any).generateClarification(
        "what happens?",
        conflict,
      );

      expect(response).toContain("Option A");
      expect(response).toContain("Option B");
    });
  });

  describe("handleConflictResolution", () => {
    it("asks for clarification when response is not a resolution", async () => {
      const service = new AnthropicService();
      const parseSpy = vi
        .spyOn(service as any, "parseConflictResponse")
        .mockResolvedValue({
          isResolution: false,
          choice: null,
          confidence: 0,
          rawResponse: "what?",
        });

      const result = await service.handleConflictResolution(
        "what?",
        {
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
        },
        {
          resolveConflict: vi.fn(),
          incrementConflictCycle: vi.fn(),
        } as any,
      );

      expect(parseSpy).toHaveBeenCalled();
      expect(result.mode).toBe("clarification_provided");
    });

    it("increments cycle count on low-confidence resolution", async () => {
      const service = new AnthropicService();
      const incrementConflictCycle = vi.fn();

      vi.spyOn(service as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.6,
        rawResponse: "a",
      });

      const result = await service.handleConflictResolution(
        "a",
        {
          hasConflicts: true,
          count: 1,
          currentConflict: 1,
          totalConflicts: 1,
          systemBlocked: true,
          conflicts: [
            {
              id: "conflict-2",
              description: "Conflict",
              affectedNodes: [],
              resolutionOptions: [
                { id: "option-a", label: "Keep A", outcome: "Keep A" },
                { id: "option-b", label: "Keep B", outcome: "Keep B" },
              ],
              cycleCount: 1,
              priority: "high",
              type: "exclusion",
            },
          ],
        },
        {
          resolveConflict: vi.fn(),
          incrementConflictCycle,
        } as any,
      );

      expect(incrementConflictCycle).toHaveBeenCalledWith("conflict-2");
      expect(result.mode).toBe("clarification_needed");
    });

    it("handles invalid choices", async () => {
      const service = new AnthropicService();
      const incrementConflictCycle = vi.fn();

      vi.spyOn(service as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "c",
        confidence: 0.9,
        rawResponse: "c",
      });

      const result = await service.handleConflictResolution(
        "c",
        {
          hasConflicts: true,
          count: 1,
          currentConflict: 1,
          totalConflicts: 1,
          systemBlocked: true,
          conflicts: [
            {
              id: "conflict-3",
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
        },
        {
          resolveConflict: vi.fn(),
          incrementConflictCycle,
        } as any,
      );

      expect(incrementConflictCycle).toHaveBeenCalledWith("conflict-3");
      expect(result.mode).toBe("invalid_choice");
    });

    it("applies resolution successfully", async () => {
      const service = new AnthropicService();

      vi.spyOn(service as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "b",
        confidence: 0.9,
        rawResponse: "b",
      });

      const resolveConflict = vi.fn();
      const getState = vi.fn().mockReturnValue({
        conflicts: {
          active: [],
        },
      });

      const result = await service.handleConflictResolution(
        "b",
        {
          hasConflicts: true,
          count: 1,
          currentConflict: 1,
          totalConflicts: 1,
          systemBlocked: true,
          conflicts: [
            {
              id: "conflict-4",
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
        },
        {
          resolveConflict,
          getState,
        } as any,
      );

      expect(resolveConflict).toHaveBeenCalledWith("conflict-4", "option-b");
      expect(result.mode).toBe("resolution_success");
    });

    it("reports remaining conflicts based on active conflicts", async () => {
      const service = new AnthropicService();

      vi.spyOn(service as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.9,
        rawResponse: "a",
      });

      const resolveConflict = vi.fn();
      const getState = vi.fn().mockReturnValue({
        conflicts: {
          active: [],
        },
      });

      const result = await service.handleConflictResolution(
        "a",
        {
          hasConflicts: true,
          count: 1,
          currentConflict: 1,
          totalConflicts: 10,
          systemBlocked: true,
          conflicts: [
            {
              id: "conflict-6",
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
        },
        {
          resolveConflict,
          getState,
        } as any,
      );

      expect(result.mode).toBe("resolution_success");
      expect(result.response).toContain("conflict-free");
    });

    it("handles resolution failures", async () => {
      const service = new AnthropicService();

      vi.spyOn(service as any, "parseConflictResponse").mockResolvedValue({
        isResolution: true,
        choice: "a",
        confidence: 0.9,
        rawResponse: "a",
      });

      const resolveConflict = vi.fn().mockRejectedValue(new Error("boom"));

      const result = await service.handleConflictResolution(
        "a",
        {
          hasConflicts: true,
          count: 1,
          currentConflict: 1,
          totalConflicts: 1,
          systemBlocked: true,
          conflicts: [
            {
              id: "conflict-5",
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
        },
        {
          resolveConflict,
        } as any,
      );

      expect(result.mode).toBe("resolution_failed");
    });
  });
});

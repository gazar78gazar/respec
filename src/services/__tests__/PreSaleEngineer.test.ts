import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreSaleEngineer } from "../agents/PreSaleEngineer";
import type { PromptProvider } from "../interfaces/PromptProvider";

const sendThreadedMock = vi.fn();

vi.mock("../ConversationService", () => ({
  ConversationService: vi.fn(() => ({
    sendThreaded: sendThreadedMock,
  })),
}));

vi.mock("uuid", () => ({
  v4: () => "session-1",
}));

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
  let sessionStore: {
    getHistory: ReturnType<typeof vi.fn>;
    append: ReturnType<typeof vi.fn>;
    trim: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let agent: PreSaleEngineer;

  beforeEach(() => {
    vi.clearAllMocks();
    anthropicService = {
      initialize: vi.fn(),
      hasClient: vi.fn().mockReturnValue(false),
      createMessage: vi.fn(),
    };
    sessionStore = {
      getHistory: vi.fn().mockResolvedValue([]),
      append: vi.fn(),
      trim: vi.fn(),
      clear: vi.fn(),
    };
    sendThreadedMock.mockReset();
    sendThreadedMock.mockResolvedValue({
      assistantText: "Ready",
      response: { content: [] },
    });
    promptProvider = makePromptProvider("SYSTEM PROMPT");
    agent = new PreSaleEngineer(
      anthropicService as unknown as any,
      promptProvider,
      sessionStore as unknown as any,
    );
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

  it("sends init message with system prompt during initialize", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    const fieldMappings = {
      IOConnectivity: ["digitalIO"],
    };

    await agent.initialize(fieldMappings);

    expect(sendThreadedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        message: expect.stringContaining("Initialize session"),
        system: "SYSTEM PROMPT",
      }),
    );
  });

  it("returns fallback response when client is unavailable", async () => {
    await agent.initialize();
    anthropicService.hasClient.mockReturnValue(false);

    const result = await agent.analyzeRequirements("hello");

    expect(result.requirements).toHaveLength(0);
    expect(result.response).toContain("Empty response returned");
    expect(sessionStore.append).toHaveBeenCalled();
  });

  it("parses JSON responses from the LLM", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    sendThreadedMock
      .mockResolvedValueOnce({
        assistantText: "Ready",
        response: { content: [] },
      })
      .mockResolvedValueOnce({
        assistantText: JSON.stringify([
          {
            type: "selection",
            specifications: ["digitalIO:8"],
          },
          {
            type: "message",
            content: "ok",
          },
        ]),
        response: { content: [] },
      });

    await agent.initialize();

    const result = await agent.analyzeRequirements("digital inputs");

    expect(result.requirements).toHaveLength(1);
    expect(result.response).toBe("ok");
  });

  it("uses ConversationService.sendThreaded for analysis requests", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    sendThreadedMock
      .mockResolvedValueOnce({
        assistantText: "Ready",
        response: { content: [] },
      })
      .mockResolvedValueOnce({
        assistantText: JSON.stringify([
          {
            type: "message",
            content: "ok",
          },
        ]),
        response: { content: [] },
      });

    await agent.initialize({
      IOConnectivity: ["digitalIO"],
    });

    await agent.analyzeRequirements("digital inputs");

    expect(sendThreadedMock).toHaveBeenCalledTimes(2);
    const analyzeCall = sendThreadedMock.mock.calls[1][0];
    expect(analyzeCall.sessionId).toBe("session-1");
    expect(analyzeCall.message).toContain("Analyze this requirement");
    expect(analyzeCall.system).toBe("SYSTEM PROMPT");
  });

  it("interprets conflict choices via LLM", async () => {
    anthropicService.hasClient.mockReturnValue(true);
    anthropicService.createMessage.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ choice: "a" }),
        },
      ],
    });

    await agent.initialize();

    const result = await agent.interpretConflictChoice("keep option A", {
      id: "conflict-1",
      affectedNodes: ["P1", "P2"],
      type: "exclusion",
      description: "Conflict detected",
      resolutionOptions: [
        {
          id: "option-a",
          description: "Keep A",
          expectedOutcome: "Keep A",
          targetNodes: ["P1"],
          action: "select_option_a",
        },
        {
          id: "option-b",
          description: "Keep B",
          expectedOutcome: "Keep B",
          targetNodes: ["P2"],
          action: "select_option_b",
        },
      ],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    });

    expect(anthropicService.createMessage).toHaveBeenCalled();
    expect(result).toBe("a");
  });

  it("returns null when conflict choice parsing is unavailable", async () => {
    await agent.initialize();
    anthropicService.hasClient.mockReturnValue(false);

    const result = await agent.interpretConflictChoice("A", {
      id: "conflict-1",
      affectedNodes: ["P1", "P2"],
      type: "exclusion",
      description: "Conflict detected",
      resolutionOptions: [
        {
          id: "option-a",
          description: "Keep A",
          expectedOutcome: "Keep A",
          targetNodes: ["P1"],
          action: "select_option_a",
        },
        {
          id: "option-b",
          description: "Keep B",
          expectedOutcome: "Keep B",
          targetNodes: ["P2"],
          action: "select_option_b",
        },
      ],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    });

    expect(result).toBeNull();
  });
});

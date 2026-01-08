import { describe, expect, it, vi, beforeEach } from "vitest";
import { RespecService } from "../RespecService";
import { ucDataLayer } from "../DataLayer";
import type { EnhancedFormUpdate } from "../../types/service.types";

let preSaleEngineerInstance: {
  initialize: ReturnType<typeof vi.fn>;
  getSessionId: ReturnType<typeof vi.fn>;
  getAgentConfig: ReturnType<typeof vi.fn>;
  analyzeRequirements: ReturnType<typeof vi.fn>;
  handleConflictResolution: ReturnType<typeof vi.fn>;
  generateConflictQuestion: ReturnType<typeof vi.fn>;
};

vi.mock("../agents/PreSaleEngineer", () => ({
  PreSaleEngineer: vi.fn(() => preSaleEngineerInstance),
}));

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

vi.stubGlobal("localStorage", localStorageMock);

describe("RespecService (refactored)", () => {
  beforeEach(() => {
    preSaleEngineerInstance = {
      initialize: vi.fn(),
      getSessionId: vi.fn().mockReturnValue("session-1"),
      getAgentConfig: vi.fn().mockReturnValue({ maxSessionTurns: 12 }),
      analyzeRequirements: vi.fn(),
      handleConflictResolution: vi.fn(),
      generateConflictQuestion: vi.fn(),
    };
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("initializes and builds field mappings from UC data", async () => {
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([
      {
        id: "P01",
        type: "specification",
        name: "digitalIO",
        field_name: "digitalIO",
      },
    ]);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue({
      section: "IOConnectivity",
      category: "io",
      field_name: "digitalIO",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: [],
    });

    const service = new RespecService();
    await service.initialize();

    expect(preSaleEngineerInstance.initialize).toHaveBeenCalledWith({
      IOConnectivity: ["digitalIO"],
    });
  });

  it("processes chat message via fallback flow when no semantic integration", async () => {
    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue({
      requirements: [
        {
          section: "IOConnectivity",
          field: "digitalIO",
          value: "8",
          confidence: 0.8,
          isAssumption: false,
        },
      ],
      response: "I found 8 digital inputs.",
      clarificationNeeded: undefined,
    });

    const service = new RespecService();
    const result = await service.processChatMessage("I need 8 digital inputs");

    expect(result.success).toBe(true);
    expect(result.systemMessage).toBe("I found 8 digital inputs.");
    expect(result.formUpdates).toHaveLength(1);
    expect(result.formUpdates[0]).toEqual({
      section: "IOConnectivity",
      field: "digitalIO",
      value: "8",
      isAssumption: false,
      confidence: 0.8,
      originalRequest: undefined,
      substitutionNote: undefined,
    });
  });

  it("uses semantic integration when initialized", async () => {
    const anthropicResult = {
      requirements: [
        {
          section: "IOConnectivity",
          field: "digitalIO",
          value: "8",
          confidence: 0.8,
          isAssumption: false,
        },
      ],
      response: "Agent response",
      clarificationNeeded: undefined,
    };

    const enhancedResult = {
      success: true,
      systemMessage: "Enhanced response",
      formUpdates: [],
      confidence: 0.9,
    };

    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue(
      anthropicResult,
    );

    const service = new RespecService();
    const semanticIntegration = {
      processExtractedRequirements: vi.fn().mockResolvedValue(enhancedResult),
    };
    (service as { semanticIntegration?: unknown }).semanticIntegration =
      semanticIntegration;

    const result = await service.processChatMessage("I need 8 digital inputs");

    expect(
      semanticIntegration.processExtractedRequirements,
    ).toHaveBeenCalledWith(
      anthropicResult.requirements,
      anthropicResult.response,
    );
    expect(result).toEqual(enhancedResult);
  });

  it("routes conflict resolution through PreSaleEngineer when conflicts exist", async () => {
    const artifactManager = {
      getState: vi.fn(() => ({
        conflicts: {
          active: [
            {
              id: "conflict-1",
              affectedNodes: ["P01"],
              type: "exclusion",
              description: "Conflict detected",
              resolutionOptions: [
                {
                  id: "option-a",
                  description: "Keep existing",
                  expectedOutcome: "Keeps existing",
                  targetNodes: ["P01"],
                  action: "keep_existing",
                },
                {
                  id: "option-b",
                  description: "Apply new",
                  expectedOutcome: "Applies new",
                  targetNodes: ["P02"],
                  action: "apply_new",
                },
              ],
              cycleCount: 0,
              firstDetected: new Date(),
              lastUpdated: new Date(),
            },
          ],
          metadata: {
            systemBlocked: true,
          },
        },
      })),
      generateFormUpdatesFromRespec: vi.fn(
        () =>
          [
            {
              section: "IOConnectivity",
              field: "digitalIO",
              value: "8",
              confidence: 1,
              isAssumption: false,
              originalRequest: "",
              substitutionNote: "",
            },
          ] satisfies EnhancedFormUpdate[],
      ),
      findSpecificationInArtifact: vi.fn(),
    };

    preSaleEngineerInstance.handleConflictResolution.mockResolvedValue({
      response: "Resolved",
      mode: "resolution_success",
    });

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage("Pick A");

    expect(preSaleEngineerInstance.handleConflictResolution).toHaveBeenCalled();
    expect(result.systemMessage).toBe("Resolved");
    expect(result.formUpdates).toHaveLength(1);
  });

  it("delegates conflict question generation to PreSaleEngineer", async () => {
    const conflictStatus = {
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

    preSaleEngineerInstance.generateConflictQuestion.mockResolvedValue(
      "Question",
    );

    const service = new RespecService();
    const result = await service.generateConflictQuestion(conflictStatus);

    expect(
      preSaleEngineerInstance.generateConflictQuestion,
    ).toHaveBeenCalledWith(conflictStatus);
    expect(result).toBe("Question");
  });

  it("acknowledges form updates and records history", async () => {
    const service = new RespecService();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await service.processFormUpdate(
      "IOConnectivity",
      "digitalIO",
      "8",
    );

    expect(result.acknowledged).toBe(true);
    expect(result.acknowledgment).toContain("IOConnectivity.digitalIO");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.stringContaining("respec_session_session-1"),
      expect.any(String),
    );
  });

  it("returns autofill suggestions based on conversation context", async () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        history: [
          {
            role: "user",
            content: "substation project",
            timestamp: new Date().toISOString(),
          },
        ],
        lastUpdated: new Date().toISOString(),
      }),
    );

    const service = new RespecService();

    const result = await service.triggerAutofill("button_header");

    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.message).toContain("substation");
  });

  it("returns structured conflicts sorted by priority", () => {
    const service = new RespecService();
    (service as any).artifactManager = {
      getState: vi.fn(() => ({
        conflicts: {
          active: [
            {
              id: "c1",
              affectedNodes: ["P1"],
              type: "cascade",
              description: "Cascade",
              resolutionOptions: [
                {
                  id: "option-a",
                  description: "Keep",
                  expectedOutcome: "Keep",
                },
              ],
              cycleCount: 0,
              firstDetected: new Date(),
              lastUpdated: new Date(),
            },
            {
              id: "c2",
              affectedNodes: ["P2"],
              type: "exclusion",
              description: "Exclusion",
              resolutionOptions: [
                {
                  id: "option-a",
                  description: "Keep",
                  expectedOutcome: "Keep",
                },
              ],
              cycleCount: 0,
              firstDetected: new Date(),
              lastUpdated: new Date(),
            },
          ],
          metadata: {
            systemBlocked: true,
          },
        },
      })),
      findSpecificationInArtifact: vi.fn(() => ({
        name: "Spec",
        value: "value",
      })),
    };

    const result = service.getActiveConflictsForAgent();

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe("exclusion");
  });
});

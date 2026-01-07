import { describe, expect, it, vi, beforeEach } from "vitest";
import { RespecService } from "../RespecService";
import { ucDataLayer } from "../DataLayer";
import type { EnhancedFormUpdate } from "../../types/service.types";

let anthropicInstance: {
  initialize: ReturnType<typeof vi.fn>;
  analyzeRequirements: ReturnType<typeof vi.fn>;
  handleConflictResolution: ReturnType<typeof vi.fn>;
};

vi.mock("../AnthropicService", () => ({
  AnthropicService: vi.fn(() => anthropicInstance),
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
    anthropicInstance = {
      initialize: vi.fn(),
      analyzeRequirements: vi.fn(),
      handleConflictResolution: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("creates unique session IDs", () => {
    const service1 = new RespecService();
    const service2 = new RespecService();

    expect(service1.getSessionId()).toBeDefined();
    expect(service2.getSessionId()).toBeDefined();
    expect(service1.getSessionId()).not.toBe(service2.getSessionId());
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

    expect(anthropicInstance.initialize).toHaveBeenCalledWith({
      IOConnectivity: ["digitalIO"],
    });
  });

  it("processes chat message via fallback flow when no semantic integration", async () => {
    anthropicInstance.analyzeRequirements.mockResolvedValue({
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

  it("routes conflict resolution through AnthropicService when conflicts exist", async () => {
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

    anthropicInstance.handleConflictResolution.mockResolvedValue({
      response: "Resolved",
      mode: "resolution_success",
    });

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage("Pick A");

    expect(anthropicInstance.handleConflictResolution).toHaveBeenCalled();
    expect(result.systemMessage).toBe("Resolved");
    expect(result.formUpdates).toHaveLength(1);
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

    const history = (service as any).conversationHistory;
    expect(history).toHaveLength(1);
  });

  it("returns autofill suggestions based on conversation context", async () => {
    const service = new RespecService();
    (service as any).conversationHistory.push({
      role: "user",
      content: "substation project",
      timestamp: new Date(),
    });

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

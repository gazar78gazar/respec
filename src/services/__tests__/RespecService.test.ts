import { describe, expect, it, vi, beforeEach } from "vitest";
import { RespecService } from "../RespecService";
import { ucDataLayer } from "../DataLayer";
import type { EnhancedFormUpdate } from "../../types/service.types";

let preSaleEngineerInstance: {
  initialize: ReturnType<typeof vi.fn>;
  getSessionId: ReturnType<typeof vi.fn>;
  getAgentConfig: ReturnType<typeof vi.fn>;
  analyzeRequirements: ReturnType<typeof vi.fn>;
  interpretConflictChoice: ReturnType<typeof vi.fn>;
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
      interpretConflictChoice: vi.fn(),
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

  it("processes chat message via agent extraction flow", async () => {
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

  it("syncs agent selections into artifacts before returning updates", async () => {
    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue({
      requirements: [
        {
          section: "formFactor",
          field: "maxPowerConsumption",
          value: "< 10W",
          confidence: 0.9,
          isAssumption: false,
        },
      ],
      response: "Noted.",
      clarificationNeeded: undefined,
    });

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([]);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue(null);
    const spec = {
      id: "P83",
      type: "specification",
      name: "Ultra Low Power (<10W)",
      selected_value: "< 10W",
      field_name: "maxPowerConsumption",
    };
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      spec,
    ]);

    const artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(null),
      getState: vi.fn().mockReturnValue({ respec: { specifications: {} } }),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage("I need less than 10W");

    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledWith(
      spec,
      "< 10W",
      expect.any(String),
      "",
      "llm",
      undefined,
      undefined,
    );
    expect(artifactManager.moveNonConflictingToRespec).toHaveBeenCalled();
    expect(result.formUpdates).toHaveLength(1);
  });

  it("syncs multi-select agent values into artifacts", async () => {
    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue({
      requirements: [
        {
          section: "IOConnectivity",
          field: "protocols",
          value: ["Modbus", "Ethernet"],
          confidence: 0.8,
          isAssumption: false,
        },
      ],
      response: "Noted.",
      clarificationNeeded: undefined,
    });

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([]);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue(null);
    const specs = [
      {
        id: "P201",
        type: "specification",
        name: "Modbus",
        selected_value: "Modbus",
        field_name: "protocols",
      },
      {
        id: "P202",
        type: "specification",
        name: "Ethernet",
        selected_value: "Ethernet",
        field_name: "protocols",
      },
    ];
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue(
      specs,
    );

    const artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(null),
      getState: vi.fn().mockReturnValue({ respec: { specifications: {} } }),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    await service.processChatMessage("Use Modbus and Ethernet");

    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledTimes(2);
    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledWith(
      specs[0],
      "Modbus",
      expect.any(String),
      "",
      "llm",
      undefined,
      undefined,
    );
    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledWith(
      specs[1],
      "Ethernet",
      expect.any(String),
      "",
      "llm",
      undefined,
      undefined,
    );
  });

  it("returns respec updates that include dependency assumptions", async () => {
    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue({
      requirements: [
        {
          section: "computePerformance",
          field: "processorType",
          value: "Extreme (Intel Core i9)",
          confidence: 0.9,
          isAssumption: false,
        },
      ],
      response: "Noted.",
      clarificationNeeded: undefined,
    });

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([]);
    const processorSpec = {
      id: "P82",
      type: "specification",
      name: "Intel Core i9 processor",
      selected_value: "Extreme (Intel Core i9)",
      field_name: "processorType",
    };
    const memorySpec = {
      id: "P07",
      type: "specification",
      name: "32GB RAM",
      selected_value: "32GB",
      field_name: "memoryCapacity",
    };
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      processorSpec,
    ]);
    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P82") return processorSpec;
      if (id === "P07") return memorySpec;
      return null;
    });
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockImplementation(
      (fieldName) => {
        if (fieldName === "processorType") {
          return {
            section: "computePerformance",
            category: "compute",
            field_name: "processorType",
            ui_type: "dropdown",
            selection_type: "single_choice",
            options: [],
          };
        }
        if (fieldName === "memoryCapacity") {
          return {
            section: "computePerformance",
            category: "memory",
            field_name: "memoryCapacity",
            ui_type: "dropdown",
            selection_type: "single_choice",
            options: [],
          };
        }
        return null;
      },
    );

    const emptyState = { respec: { specifications: {} } };
    const stateWithSpecs = {
      respec: {
        specifications: {
          P82: {
            id: "P82",
            name: "Intel Core i9 processor",
            value: "Extreme (Intel Core i9)",
            ucSource: processorSpec,
            attribution: "requirement",
            confidence: 1,
            source: "llm",
            timestamp: new Date(),
          },
          P07: {
            id: "P07",
            name: "32GB RAM",
            value: "32GB",
            ucSource: memorySpec,
            attribution: "assumption",
            confidence: 1,
            source: "dependency",
            dependencyOf: "P82",
            timestamp: new Date(),
          },
        },
      },
    };

    const artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(null),
      getState: vi
        .fn()
        .mockReturnValueOnce(emptyState)
        .mockReturnValueOnce(stateWithSpecs),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage(
      "I need a core i9 processor",
    );

    expect(result.formUpdates).toHaveLength(2);
    expect(result.formUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "computePerformance",
          field: "processorType",
          value: "Extreme (Intel Core i9)",
          isAssumption: false,
        }),
        expect.objectContaining({
          section: "computePerformance",
          field: "memoryCapacity",
          value: "32GB",
          isAssumption: true,
        }),
      ]),
    );
  });

  it("returns a conflict question when selections create a conflict", async () => {
    preSaleEngineerInstance.analyzeRequirements.mockResolvedValue({
      requirements: [
        {
          section: "formFactor",
          field: "maxPowerConsumption",
          value: "< 10W",
          confidence: 0.9,
          isAssumption: false,
        },
      ],
      response: "Noted.",
      clarificationNeeded: undefined,
    });

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([]);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue(null);
    const spec = {
      id: "P83",
      type: "specification",
      name: "Ultra Low Power (<10W)",
      selected_value: "< 10W",
      field_name: "maxPowerConsumption",
    };
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      spec,
    ]);

    const conflict = {
      id: "conflict-1",
      affectedNodes: ["P82", "P83"],
      type: "exclusion",
      description: "Conflict detected",
      resolutionOptions: [
        {
          id: "option-a",
          description: "Keep A",
          expectedOutcome: "Keep A",
          targetNodes: ["P82"],
          action: "select_option_a",
        },
        {
          id: "option-b",
          description: "Keep B",
          expectedOutcome: "Keep B",
          targetNodes: ["P83"],
          action: "select_option_b",
        },
      ],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    const artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(conflict),
      buildConflictQuestion: vi.fn().mockReturnValue("Question"),
      moveNonConflictingToRespec: vi.fn(),
      getState: vi.fn().mockReturnValue({ respec: { specifications: {} } }),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage("I need less than 10W");

    expect(result.systemMessage).toBe("Question");
    expect(result.formUpdates?.length ?? 0).toBe(0);
  });

  it("applies conflict choice and returns updated form values", async () => {
    const conflict = {
      id: "conflict-1",
      affectedNodes: ["P82", "P83"],
      type: "exclusion",
      description: "Conflict detected",
      resolutionOptions: [
        {
          id: "option-a",
          description: "Keep A",
          expectedOutcome: "Keep A",
          targetNodes: ["P82"],
          action: "select_option_a",
        },
        {
          id: "option-b",
          description: "Keep B",
          expectedOutcome: "Keep B",
          targetNodes: ["P83"],
          action: "select_option_b",
        },
      ],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    const artifactManager = {
      getPendingConflict: vi
        .fn()
        .mockReturnValueOnce(conflict)
        .mockReturnValueOnce(null),
      applyConflictChoice: vi.fn().mockResolvedValue(undefined),
      getState: vi
        .fn()
        .mockReturnValueOnce({ respec: { specifications: {} } })
        .mockReturnValueOnce({
          respec: {
            specifications: {
              P83: {
                id: "P83",
                name: "Ultra Low Power (<10W)",
                value: "< 10W",
                ucSource: {
                  id: "P83",
                  type: "specification",
                  name: "Ultra Low Power (<10W)",
                  selected_value: "< 10W",
                  field_name: "maxPowerConsumption",
                },
                attribution: "requirement",
                confidence: 1,
                source: "system",
                timestamp: new Date(),
              },
            },
          },
        }),
      generateFormUpdatesFromRespec: vi.fn(
        () =>
          [
            {
              section: "formFactor",
              field: "maxPowerConsumption",
              value: "< 10W",
              confidence: 1,
              isAssumption: false,
            },
          ] satisfies EnhancedFormUpdate[],
      ),
      buildConflictQuestion: vi.fn(),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager =
      artifactManager as unknown;

    const result = await service.processChatMessage("A");

    expect(artifactManager.applyConflictChoice).toHaveBeenCalledWith(
      "conflict-1",
      "a",
    );
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
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      expect.stringContaining("respec_session_session-1"),
      expect.any(String),
    );
  });

  it("returns conflict question for manual form updates when conflict is active", async () => {
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      {
        id: "P83",
        type: "specification",
        name: "Ultra Low Power (<10W)",
        selected_value: "< 10W",
        field_name: "maxPowerConsumption",
      },
    ]);

    const conflict = {
      id: "conflict-1",
      affectedNodes: ["P82", "P83"],
      type: "exclusion",
      description: "Conflict detected",
      resolutionOptions: [
        {
          id: "option-a",
          description: "Keep A",
          expectedOutcome: "Keep A",
          targetNodes: ["P82"],
          action: "select_option_a",
        },
        {
          id: "option-b",
          description: "Keep B",
          expectedOutcome: "Keep B",
          targetNodes: ["P83"],
          action: "select_option_b",
        },
      ],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(conflict),
      buildConflictQuestion: vi.fn().mockReturnValue("Question"),
      moveNonConflictingToRespec: vi.fn(),
      getState: vi.fn().mockReturnValue({ respec: { specifications: {} } }),
    } as unknown;

    const result = await service.processFormUpdate(
      "formFactor",
      "maxPowerConsumption",
      "< 10W",
    );

    expect(result.acknowledgment).toBe("Question");
  });

  it("returns respec delta updates for manual form updates", async () => {
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    const spec = {
      id: "P83",
      type: "specification",
      name: "Ultra Low Power (<10W)",
      selected_value: "< 10W",
      field_name: "maxPowerConsumption",
    };
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      spec,
    ]);
    vi.spyOn(ucDataLayer, "getSpecification").mockReturnValue(spec);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue({
      section: "formFactor",
      category: "power",
      field_name: "maxPowerConsumption",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: [],
    });

    const emptyState = { respec: { specifications: {} } };
    const stateWithSpec = {
      respec: {
        specifications: {
          P83: {
            id: "P83",
            name: "Ultra Low Power (<10W)",
            value: "< 10W",
            ucSource: spec,
            attribution: "requirement",
            confidence: 1,
            source: "system",
            timestamp: new Date(),
          },
        },
      },
    };

    const service = new RespecService();
    (service as { artifactManager?: unknown }).artifactManager = {
      addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
      moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
      getPendingConflict: vi.fn().mockReturnValue(null),
      getState: vi
        .fn()
        .mockReturnValueOnce(emptyState)
        .mockReturnValueOnce(stateWithSpec),
    } as unknown;

    const result = await service.processFormUpdate(
      "formFactor",
      "maxPowerConsumption",
      "< 10W",
    );

    expect(result.formUpdates).toHaveLength(1);
    expect(result.formUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "formFactor",
          field: "maxPowerConsumption",
          value: "< 10W",
        }),
      ]),
    );
  });

  it("returns respec delta updates when clearing a field", async () => {
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    const spec = {
      id: "P83",
      type: "specification",
      name: "Ultra Low Power (<10W)",
      selected_value: "< 10W",
      field_name: "maxPowerConsumption",
    };
    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockReturnValue([
      spec,
    ]);
    vi.spyOn(ucDataLayer, "getSpecification").mockReturnValue(spec);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue({
      section: "formFactor",
      category: "power",
      field_name: "maxPowerConsumption",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: [],
    });

    const stateWithSpec = {
      respec: {
        specifications: {
          P83: {
            id: "P83",
            name: "Ultra Low Power (<10W)",
            value: "< 10W",
            ucSource: spec,
            attribution: "requirement",
            confidence: 1,
            source: "user",
            timestamp: new Date(),
          },
        },
      },
    };
    const emptyState = { respec: { specifications: {} } };

    const service = new RespecService();
    const clearFieldSelections = vi.fn();
    (service as { artifactManager?: unknown }).artifactManager = {
      clearFieldSelections,
      getPendingConflict: vi.fn().mockReturnValue(null),
      moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
      getState: vi
        .fn()
        .mockReturnValueOnce(stateWithSpec)
        .mockReturnValueOnce(emptyState),
    } as unknown;

    const result = await service.processFormUpdate(
      "formFactor",
      "maxPowerConsumption",
      null,
    );

    expect(clearFieldSelections).toHaveBeenCalledWith("maxPowerConsumption");
    expect(result.formUpdates).toEqual([
      expect.objectContaining({
        section: "formFactor",
        field: "maxPowerConsumption",
        value: null,
        isAssumption: false,
      }),
    ]);
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
});

import { describe, expect, it, afterEach, vi } from "vitest";
import { ArtifactManager } from "../ArtifactManager";
import { ucDataLayer } from "../DataLayer";
import {
  createEmptyArtifactState,
  type ArtifactState,
} from "../../types/artifacts.types";
import type { UCSpecification, UCUIField } from "../../types/uc-data.types";

describe("ArtifactManager artifact flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds dependency specs and returns assumption updates", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;
    (manager as unknown as { state: ArtifactState }).state = state;

    const specA: UCSpecification = {
      id: "P1",
      type: "specification",
      name: "Spec A",
      field_name: "field_a",
      selected_value: "Spec A",
      requires: {
        core: ["P2"],
      },
    };
    const specB: UCSpecification = {
      id: "P2",
      type: "specification",
      name: "Spec B",
      field_name: "field_b",
      selected_value: "Spec B",
    };

    const uiFields: Record<string, UCUIField> = {
      field_a: {
        section: "section_a",
        category: "cat_a",
        field_name: "field_a",
        ui_type: "dropdown",
        selection_type: "single_choice",
        options: [],
      },
      field_b: {
        section: "section_b",
        category: "cat_b",
        field_name: "field_b",
        ui_type: "dropdown",
        selection_type: "single_choice",
        options: [],
      },
    };

    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockImplementation(
      (fieldName) => {
        if (fieldName === "field_a") return [specA];
        if (fieldName === "field_b") return [specB];
        return [];
      },
    );
    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P1") return specA;
      if (id === "P2") return specB;
      return null;
    });
    vi.spyOn(ucDataLayer, "getRequiredNodes").mockImplementation((id) => {
      if (id === "P1") return ["P2"];
      return [];
    });
    vi.spyOn(ucDataLayer, "getExclusionsForNode").mockReturnValue([]);
    vi.spyOn(ucDataLayer, "getValidOptionsForField").mockImplementation(
      (fieldName) => {
        if (fieldName === "field_a") return [specA];
        if (fieldName === "field_b") return [specB];
        return [];
      },
    );
    vi.spyOn(ucDataLayer, "getAllUiFields").mockReturnValue(uiFields);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockImplementation(
      (fieldName) => uiFields[fieldName],
    );

    await manager.addSpecificationToMapped(
      specA,
      "Spec A",
      "Manual update for section_a.field_a",
      "",
      "user",
    );
    await manager.moveNonConflictingToRespec();

    const updates = manager.generateFormUpdatesFromRespec();

    const respecState = manager.getState().respec.specifications;
    expect(respecState["P1"]).toBeDefined();
    expect(respecState["P2"]).toBeDefined();
    expect(respecState["P2"].attribution).toBe("assumption");

    const dependencyUpdate = updates.find(
      (update) => update.field === "field_b",
    );
    expect(dependencyUpdate).toBeDefined();
    expect(dependencyUpdate?.value).toBe("Spec B");
    expect(dependencyUpdate?.isAssumption).toBe(true);
  });

  it("honors explicit user selections over dependency assumptions", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;
    (manager as unknown as { state: ArtifactState }).state = state;

    const processorSpec: UCSpecification = {
      id: "P82",
      type: "specification",
      name: "Intel Core i9 processor",
      field_name: "processorType",
      selected_value: "Extreme (Intel Core i9)",
      requires: {
        core: ["P07"],
      },
    };
    const memoryUserSpec: UCSpecification = {
      id: "P05",
      type: "specification",
      name: "8GB RAM",
      field_name: "memoryCapacity",
      selected_value: "8GB",
    };
    const memoryDependencySpec: UCSpecification = {
      id: "P07",
      type: "specification",
      name: "32GB RAM",
      field_name: "memoryCapacity",
      selected_value: "32GB",
    };

    const uiFields: Record<string, UCUIField> = {
      processorType: {
        section: "computePerformance",
        category: "compute",
        field_name: "processorType",
        ui_type: "dropdown",
        selection_type: "single_choice",
        options: [],
      },
      memoryCapacity: {
        section: "computePerformance",
        category: "memory",
        field_name: "memoryCapacity",
        ui_type: "dropdown",
        selection_type: "single_choice",
        options: [],
      },
    };

    vi.spyOn(ucDataLayer, "getSpecificationsForFormField").mockImplementation(
      (fieldName) => {
        if (fieldName === "processorType") return [processorSpec];
        if (fieldName === "memoryCapacity")
          return [memoryUserSpec, memoryDependencySpec];
        return [];
      },
    );
    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P82") return processorSpec;
      if (id === "P05") return memoryUserSpec;
      if (id === "P07") return memoryDependencySpec;
      return null;
    });
    vi.spyOn(ucDataLayer, "getRequiredNodes").mockImplementation((id) => {
      if (id === "P82") return ["P07"];
      return [];
    });
    vi.spyOn(ucDataLayer, "getExclusionsForNode").mockReturnValue([]);
    vi.spyOn(ucDataLayer, "getValidOptionsForField").mockImplementation(
      (fieldName) => {
        if (fieldName === "processorType") return [processorSpec];
        if (fieldName === "memoryCapacity")
          return [memoryUserSpec, memoryDependencySpec];
        return [];
      },
    );
    vi.spyOn(ucDataLayer, "getAllUiFields").mockReturnValue(uiFields);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockImplementation(
      (fieldName) => uiFields[fieldName],
    );

    await manager.addSpecificationToMapped(
      processorSpec,
      "Extreme (Intel Core i9)",
      "Manual update for computePerformance.processorType",
      "",
      "user",
    );
    await manager.addSpecificationToMapped(
      memoryUserSpec,
      "8GB",
      "Manual update for computePerformance.memoryCapacity",
      "",
      "user",
    );
    await manager.moveNonConflictingToRespec();

    const respecState = manager.getState().respec.specifications;
    expect(respecState["P82"]).toBeDefined();
    expect(respecState["P05"]).toBeDefined();
    expect(respecState["P07"]).toBeUndefined();
  });

  it("removes respec specs when a field is cleared", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;

    state.respec.specifications["P1"] = {
      id: "P1",
      name: "Spec A",
      value: "Spec A",
      ucSource: {
        id: "P1",
        type: "specification",
        name: "Spec A",
        field_name: "field_a",
        selected_value: "Spec A",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };

    (manager as unknown as { state: ArtifactState }).state = state;

    const uiFields: Record<string, UCUIField> = {
      field_a: {
        section: "section_a",
        category: "cat_a",
        field_name: "field_a",
        ui_type: "dropdown",
        selection_type: "single_choice",
        options: [],
      },
    };

    vi.spyOn(ucDataLayer, "getAllUiFields").mockReturnValue(uiFields);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockImplementation(
      (fieldName) => uiFields[fieldName],
    );
    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P1") {
        return {
          id: "P1",
          type: "specification",
          name: "Spec A",
          field_name: "field_a",
          selected_value: "Spec A",
        };
      }
      return null;
    });

    manager.clearFieldSelections("field_a");

    expect(manager.getState().respec.specifications["P1"]).toBeUndefined();
  });
});

describe("ArtifactManager respec replacement", () => {
  it("replaces single-choice specs for the same field when promoting", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;

    state.respec.specifications["P1"] = {
      id: "P1",
      name: "Spec A",
      value: "Spec A",
      ucSource: {
        id: "P1",
        type: "specification",
        name: "Spec A",
        field_name: "field_a",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };

    state.mapped.specifications["P2"] = {
      id: "P2",
      name: "Spec B",
      value: "Spec B",
      ucSource: {
        id: "P2",
        type: "specification",
        name: "Spec B",
        field_name: "field_a",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };

    (manager as unknown as { state: ArtifactState }).state = state;

    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue({
      section: "section_a",
      category: "cat_a",
      field_name: "field_a",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: [],
    });

    await manager.moveNonConflictingToRespec();

    const respecState = manager.getState().respec.specifications;
    expect(respecState["P2"]).toBeDefined();
    expect(respecState["P1"]).toBeUndefined();
  });
});

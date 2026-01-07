import { describe, expect, it, afterEach, vi } from "vitest";
import { ArtifactManager } from "../ArtifactManager";
import { ucDataLayer } from "../DataLayer";
import type {
  ArtifactState,
  UCArtifactSpecification,
} from "../../types/artifacts.types";

describe("ArtifactManager.generateFormUpdatesFromRespec", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds updates for selected specs and clears missing fields", () => {
    const manager = new ArtifactManager();

    const spec: UCArtifactSpecification = {
      id: "P1",
      name: "Spec One",
      value: "Spec One",
      ucSource: {
        id: "P1",
        type: "specification",
        name: "Spec One",
        field_name: "field_a",
      },
      attribution: "requirement",
      confidence: 0.9,
      source: "user",
      originalRequest: "spec one",
      substitutionNote: "matched",
      timestamp: new Date(),
    };

    const state = {
      respec: {
        ...manager.getState().respec,
        specifications: {
          [spec.id]: spec,
        },
      },
      mapped: manager.getState().mapped,
      unmapped: manager.getState().unmapped,
      conflicts: manager.getState().conflicts,
      priorityQueue: manager.getState().priorityQueue,
      initialized: true,
    } satisfies ArtifactState;

    (manager as unknown as { state: ArtifactState }).state = state;

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P1") {
        return {
          id: "P1",
          type: "specification",
          name: "Spec One",
          field_name: "field_a",
          selected_value: "Spec One",
        };
      }
      return null;
    });

    vi.spyOn(ucDataLayer, "getAllUiFields").mockReturnValue({
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
    });

    const updates = manager.generateFormUpdatesFromRespec();

    const updateA = updates.find((update) => update.field === "field_a");
    const updateB = updates.find((update) => update.field === "field_b");

    expect(updateA).toBeDefined();
    expect(updateA?.value).toBe("Spec One");
    expect(updateB).toBeDefined();
    expect(updateB?.value).toBeNull();
    expect(updateB?.substitutionNote).toContain("Cleared");
  });
});

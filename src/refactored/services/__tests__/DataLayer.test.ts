import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ucDataLayer } from "../DataLayer";

const dataset = {
  metadata: {
    schema_version: "1",
    dataset_version: "1",
    description: "test",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    id_format: {
      scenarios: "S##",
      requirements: "R##",
      specifications: "P##",
      comments: "C##",
      exclusions: "E##",
    },
  },
  scenarios: {},
  requirements: {
    R1: {
      id: "R1",
      type: "requirement",
      name: "Requirement One",
      description: "Req",
      parent_scenarios: ["S1"],
      specification_ids: ["P1"],
    },
  },
  specifications: {
    P1: {
      id: "P1",
      type: "specification",
      name: "Spec One",
      parent_requirements: ["R1"],
      field_name: "field_a",
      requires: {
        reqs: ["P2"],
      },
    },
    P2: {
      id: "P2",
      type: "specification",
      name: "Spec Two",
      parent_requirements: [],
      field_name: "field_a",
    },
    P3: {
      id: "P3",
      type: "specification",
      name: "Spec Three",
      parent_requirements: ["R1"],
      field_name: "field_b",
    },
  },
  exclusions: {
    E1: {
      id: "E1",
      nodes: ["P1", "P2"],
      type: "hard_incompatible",
      category: "spec_spec",
      reason: "Incompatible",
      resolution_priority: 1,
      question_template: "choose between A or B?",
    },
  },
  comments: {},
  ui_fields: {
    field_a: {
      section: "section_a",
      category: "cat_a",
      field_name: "field_a",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: ["Spec One", "Spec Two"],
    },
    field_b: {
      section: "section_b",
      category: "cat_b",
      field_name: "field_b",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: ["Spec Three"],
    },
  },
  scenarios: {
    S1: {
      id: "S1",
      type: "scenario",
      name: "Scenario One",
      description: "Scenario",
      use_case_tags: [],
      requirement_ids: ["R1"],
    },
  },
};

describe("UCDataLayer", () => {
  beforeEach(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => dataset,
      }),
    );
    await ucDataLayer.load();
  });

  afterEach(() => {
    (ucDataLayer as { dataset: unknown }).dataset = null;
    vi.unstubAllGlobals();
  });

  it("loads dataset and exposes node lookups", () => {
    expect(ucDataLayer.isLoaded()).toBe(true);
    expect(ucDataLayer.getNodeName("P1")).toBe("Spec One");
  });

  it("returns required nodes for a specification", () => {
    const required = ucDataLayer.getRequiredNodes("P1");
    expect(required).toEqual(["P2"]);
  });

  it("filters valid options using exclusions", () => {
    const options = ucDataLayer.getValidOptionsForField("field_a", ["P2"]);
    expect(options.map((opt) => opt.id)).toEqual(["P2"]);
  });

  it("detects exclusions between nodes", () => {
    expect(ucDataLayer.hasExclusionBetween("P1", "P2")).toBe(true);
  });

  it("returns specifications by requirement", () => {
    const specs = ucDataLayer.getSpecificationsByRequirement("R1");
    expect(specs.map((spec) => spec.id)).toContain("P1");
  });

  it("returns all requirements and scenarios", () => {
    expect(ucDataLayer.getAllRequirements()).toHaveLength(1);
    expect(ucDataLayer.getAllScenarios()).toHaveLength(1);
  });

  it("returns specifications for a form field", () => {
    const specs = ucDataLayer.getSpecificationsForFormField("field_b");
    expect(specs).toHaveLength(1);
    expect(specs[0].id).toBe("P3");
  });

  it("returns ui fields and metadata", () => {
    expect(ucDataLayer.getAllUiFields()).toHaveProperty("field_a");
    expect(ucDataLayer.getMetadata()?.schema_version).toBe("1");
  });
});

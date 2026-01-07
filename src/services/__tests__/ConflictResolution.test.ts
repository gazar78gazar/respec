import { describe, expect, it, vi, afterEach } from "vitest";
import { ConflictResolver } from "../ConflictResolver";
import { ArtifactManager } from "../ArtifactManager";
import { ucDataLayer } from "../DataLayer";
import {
  createEmptyArtifactState,
  type ActiveConflict,
  type ArtifactState,
  type UCArtifactSpecification,
} from "../../types/artifacts.types";
import type { ResolutionOption } from "../../types/conflicts.types";
import type { UCSpecification } from "../../types/uc-data.types";

const createUCSpec = (
  id: string,
  name: string = id,
  fieldName: string = "field",
): UCSpecification => ({
  id,
  type: "specification",
  name,
  field_name: fieldName,
});

const createArtifactSpec = (
  spec: UCSpecification,
  overrides: Partial<UCArtifactSpecification> = {},
): UCArtifactSpecification => ({
  id: spec.id,
  name: spec.name,
  value: spec.name,
  ucSource: spec,
  attribution: "requirement",
  confidence: 1,
  source: "user",
  timestamp: new Date(),
  ...overrides,
});

describe("ConflictResolver.planResolution", () => {
  it("plans removals for losing specs and their dependencies", () => {
    const resolver = new ConflictResolver();
    const specA = createArtifactSpec(createUCSpec("spec-a"));
    const specB = createArtifactSpec(createUCSpec("spec-b"));
    const dependent = createArtifactSpec(createUCSpec("spec-b-dep"), {
      attribution: "assumption",
      dependencyOf: "spec-b",
      source: "dependency",
    });

    const conflict: ActiveConflict = {
      id: "conflict-1",
      affectedNodes: ["spec-a", "spec-b"],
      type: "field_overwrite",
      description: "Overwrite conflict",
      resolutionOptions: [],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    const resolution: ResolutionOption = {
      id: "option-a",
      description: "Keep spec-a",
      action: "keep_existing",
      targetNodes: ["spec-a"],
      expectedOutcome: "spec-a remains",
    };

    const plan = resolver.planResolution(conflict, resolution, {
      findSpecificationWithLocation: (specId) => {
        if (specId === "spec-a") {
          return { artifact: "mapped", spec: specA };
        }
        if (specId === "spec-b") {
          return { artifact: "mapped", spec: specB };
        }
        return null;
      },
      collectAssumptionDependencies: (specId) => {
        if (specId === "spec-b") {
          return [{ artifact: "mapped", spec: dependent }];
        }
        return [];
      },
    });

    expect(plan.winningSpecs).toEqual(["spec-a"]);
    expect(plan.losingSpecs).toEqual(["spec-b"]);
    expect(plan.removals.map((entry) => entry.spec.id).sort()).toEqual([
      "spec-b",
      "spec-b-dep",
    ]);
  });

  it("rejects resolutions without target nodes", () => {
    const resolver = new ConflictResolver();
    const conflict: ActiveConflict = {
      id: "conflict-2",
      affectedNodes: ["spec-a", "spec-b"],
      type: "field_overwrite",
      description: "Overwrite conflict",
      resolutionOptions: [],
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    const invalidResolution: ResolutionOption = {
      id: "option-x",
      description: "Invalid resolution",
      action: "keep_existing",
      targetNodes: [],
      expectedOutcome: "no-op",
    };

    expect(() =>
      resolver.planResolution(conflict, invalidResolution, {
        findSpecificationWithLocation: () => null,
        collectAssumptionDependencies: () => [],
      }),
    ).toThrow("must specify targetNodes");
  });
});

describe("ConflictResolver conflict detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects field overwrite conflicts", () => {
    const resolver = new ConflictResolver();

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P-new") {
        return createUCSpec("P-new", "New Spec", "field_a");
      }
      if (id === "P-existing") {
        return createUCSpec("P-existing", "Existing Spec", "field_a");
      }
      return null;
    });

    const conflicts = resolver.detectOverwriteConflicts("P-new", [
      "P-existing",
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("field_overwrite");
    expect(conflicts[0].existingValue).toBe("P-existing");
  });

  it("detects constraint conflicts when no valid options remain", () => {
    const resolver = new ConflictResolver();

    vi.spyOn(ucDataLayer, "getSpecification").mockReturnValue(
      createUCSpec("P-new", "New Spec", "field_a"),
    );
    vi.spyOn(ucDataLayer, "getValidOptionsForField").mockReturnValue([]);

    const conflicts = resolver.detectConstraintConflicts("P-new", [
      "P-existing",
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("field_constraint");
    expect(conflicts[0].field).toBe("field_a");
  });

  it("parses exclusion templates into resolution options", () => {
    const resolver = new ConflictResolver();

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P-new") {
        return createUCSpec("P-new", "New Spec", "field_a");
      }
      if (id === "P-existing") {
        return createUCSpec("P-existing", "Existing Spec", "field_a");
      }
      return null;
    });
    vi.spyOn(ucDataLayer, "getValidOptionsForField").mockReturnValue([
      createUCSpec("P-new", "New Spec", "field_a"),
    ]);
    vi.spyOn(ucDataLayer, "getExclusionsForNode").mockReturnValue([
      {
        id: "ex-1",
        nodes: ["P-existing", "P-new"],
        type: "hard_incompatible",
        reason: "Incompatible",
        resolution_priority: 1,
        question_template: "choose between Option A or Option B?",
      },
    ]);
    vi.spyOn(ucDataLayer, "getNodeName").mockImplementation((id) => id);

    const conflicts = resolver.detectAllConflictsForSpecification("P-new", [
      "P-existing",
    ]);

    const exclusion = conflicts.find(
      (conflict) => conflict.type === "exclusion",
    );
    expect(exclusion).toBeDefined();
    expect(exclusion?.resolutionOptions?.[0].description).toBe("Option A");
    expect(exclusion?.resolutionOptions?.[1].description).toBe("Option B");
  });

  it("falls back to default exclusion options when no template provided", () => {
    const resolver = new ConflictResolver();

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "P-new") {
        return createUCSpec("P-new", "New Spec", "field_a");
      }
      if (id === "P-existing") {
        return createUCSpec("P-existing", "Existing Spec", "field_a");
      }
      return null;
    });
    vi.spyOn(ucDataLayer, "getValidOptionsForField").mockReturnValue([
      createUCSpec("P-new", "New Spec", "field_a"),
    ]);
    vi.spyOn(ucDataLayer, "getExclusionsForNode").mockReturnValue([
      {
        id: "ex-2",
        nodes: ["P-existing", "P-new"],
        type: "hard_incompatible",
        reason: "Incompatible",
        resolution_priority: 1,
        question_template: "",
      },
    ]);
    vi.spyOn(ucDataLayer, "getNodeName").mockImplementation((id) => id);

    const conflicts = resolver.detectAllConflictsForSpecification("P-new", [
      "P-existing",
    ]);
    const exclusion = conflicts.find(
      (conflict) => conflict.type === "exclusion",
    );

    expect(exclusion).toBeDefined();
    expect(exclusion?.resolutionOptions?.[0].description).toBe(
      "Keep P-existing",
    );
    expect(exclusion?.resolutionOptions?.[1].description).toBe("Select P-new");
  });

  it("computes conflict impact for removals and additions", () => {
    const resolver = new ConflictResolver();

    vi.spyOn(ucDataLayer, "getRequiredNodes").mockReturnValue(["P-dep"]);

    const impact = resolver.getConflictImpact(
      {
        id: "conflict-imp",
        key: "key",
        type: "exclusion",
        existingValue: "P-old",
        proposedValue: "P-new",
        description: "Impact",
        affectedNodes: ["P-old"],
      },
      ["P-old"],
    );

    expect(impact.toRemove).toEqual(["P-old"]);
    expect(impact.toAdd).toContain("P-new");
    expect(impact.toAdd).toContain("P-dep");
  });
});

describe("ArtifactManager.resolveConflict", () => {
  it("removes losing specs, clears blocks, and moves winners to respec", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;

    const specA = createArtifactSpec(createUCSpec("spec-a"));
    const specB = createArtifactSpec(createUCSpec("spec-b"));
    const specC = createArtifactSpec(createUCSpec("spec-c"), {
      attribution: "assumption",
      dependencyOf: "spec-b",
      source: "dependency",
    });

    state.mapped.specifications[specA.id] = specA;
    state.mapped.specifications[specB.id] = specB;
    state.mapped.specifications[specC.id] = specC;

    const resolutionOptions: ResolutionOption[] = [
      {
        id: "option-a",
        description: "Keep spec-a",
        action: "keep_existing",
        targetNodes: ["spec-a"],
        expectedOutcome: "spec-a remains",
      },
      {
        id: "option-b",
        description: "Keep spec-b",
        action: "apply_new",
        targetNodes: ["spec-b"],
        expectedOutcome: "spec-b remains",
      },
    ];

    const conflict: ActiveConflict = {
      id: "conflict-3",
      affectedNodes: ["spec-a", "spec-b"],
      type: "field_overwrite",
      description: "Overwrite conflict",
      resolutionOptions,
      cycleCount: 0,
      firstDetected: new Date(),
      lastUpdated: new Date(),
    };

    state.conflicts.active = [conflict];
    state.conflicts.metadata.activeCount = 1;
    state.conflicts.metadata.systemBlocked = true;
    state.conflicts.metadata.blockingConflicts = ["spec-a", "spec-b"];
    state.priorityQueue.blocked = true;
    state.priorityQueue.currentPriority = "CONFLICTS";

    (manager as unknown as { state: ArtifactState }).state = state;

    await manager.resolveConflict("conflict-3", "option-a");

    const finalState = (manager as unknown as { state: ArtifactState }).state;

    expect(finalState.conflicts.active).toHaveLength(0);
    expect(finalState.conflicts.resolved).toHaveLength(1);
    expect(finalState.conflicts.metadata.systemBlocked).toBe(false);
    expect(finalState.conflicts.metadata.blockingConflicts).toEqual([]);
    expect(finalState.priorityQueue.blocked).toBe(false);

    expect(finalState.mapped.specifications["spec-b"]).toBeUndefined();
    expect(finalState.mapped.specifications["spec-c"]).toBeUndefined();
    expect(finalState.respec.specifications["spec-a"]).toBeDefined();
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { ArtifactManager } from "../ArtifactManager";
import {
  createEmptyArtifactState,
  type ArtifactState,
} from "../../types/artifacts.types";
import { ucDataLayer } from "../DataLayer";

describe("ArtifactManager state maintenance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prunes inactive conflicts when specs are missing", () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;

    state.conflicts.active = [
      {
        id: "conflict-1",
        affectedNodes: ["missing-spec"],
        type: "exclusion",
        description: "Missing",
        resolutionOptions: [],
        cycleCount: 0,
        firstDetected: new Date(),
        lastUpdated: new Date(),
      },
    ];
    state.conflicts.metadata.activeCount = 1;
    state.conflicts.metadata.systemBlocked = true;
    state.conflicts.metadata.blockingConflicts = ["missing-spec"];
    state.priorityQueue.blocked = true;
    state.priorityQueue.currentPriority = "CONFLICTS";

    (manager as unknown as { state: ArtifactState }).state = state;
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(false);

    (manager as any).refreshConflicts();
    const updatedState = manager.getState();

    expect(updatedState.conflicts.active).toHaveLength(0);
    expect(updatedState.conflicts.metadata.systemBlocked).toBe(false);
    expect(updatedState.priorityQueue.blocked).toBe(false);
  });

  it("clears field selections and unblocks the system", () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;
    (manager as unknown as { state: ArtifactState }).state = state;

    state.respec.specifications["spec-a"] = {
      id: "spec-a",
      name: "Spec A",
      value: "Spec A",
      ucSource: {
        id: "spec-a",
        type: "specification",
        name: "Spec A",
        field_name: "field_a",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };
    state.conflicts.active = [
      {
        id: "conflict-2",
        affectedNodes: ["spec-a"],
        type: "exclusion",
        description: "Conflict",
        resolutionOptions: [],
        cycleCount: 0,
        firstDetected: new Date(),
        lastUpdated: new Date(),
      },
    ];
    state.conflicts.metadata.activeCount = 1;
    state.conflicts.metadata.systemBlocked = true;
    state.conflicts.metadata.blockingConflicts = ["spec-a"];
    state.priorityQueue.blocked = true;
    state.priorityQueue.currentPriority = "CONFLICTS";
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(false);

    manager.clearFieldSelections("field_a");

    const updatedState = manager.getState();
    expect(updatedState.respec.specifications["spec-a"]).toBeUndefined();
    expect(updatedState.conflicts.active).toHaveLength(0);
    expect(updatedState.conflicts.metadata.systemBlocked).toBe(false);
    expect(updatedState.priorityQueue.blocked).toBe(false);
  });

  it("moves non-conflicting mapped specs to respec", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;

    state.mapped.specifications["spec-a"] = {
      id: "spec-a",
      name: "Spec A",
      value: "Spec A",
      ucSource: {
        id: "spec-a",
        type: "specification",
        name: "Spec A",
        field_name: "field_a",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };
    state.mapped.specifications["spec-b"] = {
      id: "spec-b",
      name: "Spec B",
      value: "Spec B",
      ucSource: {
        id: "spec-b",
        type: "specification",
        name: "Spec B",
        field_name: "field_b",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };
    state.conflicts.metadata.blockingConflicts = ["spec-b"];

    (manager as unknown as { state: ArtifactState }).state = state;

    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue(null);

    await manager.moveNonConflictingToRespec();

    const updatedState = manager.getState();
    expect(updatedState.respec.specifications["spec-a"]).toBeDefined();
    expect(updatedState.mapped.specifications["spec-a"]).toBeUndefined();
    expect(updatedState.mapped.specifications["spec-b"]).toBeDefined();
  });
});

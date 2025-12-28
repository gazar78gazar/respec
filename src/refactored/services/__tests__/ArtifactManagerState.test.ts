import { describe, expect, it } from "vitest";
import { ArtifactManager } from "../ArtifactManager";
import {
  createEmptyArtifactState,
  type ArtifactState,
} from "../../types/artifacts.types";

describe("ArtifactManager state maintenance", () => {
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

    const updatedState = manager.getState();

    expect(updatedState.conflicts.active).toHaveLength(0);
    expect(updatedState.conflicts.metadata.systemBlocked).toBe(false);
    expect(updatedState.priorityQueue.blocked).toBe(false);
  });

  it("syncs form state and marks respec as synced", async () => {
    const manager = new ArtifactManager();
    const state = createEmptyArtifactState();
    state.initialized = true;
    (manager as unknown as { state: ArtifactState }).state = state;

    await manager.syncWithFormState({
      section_a: {
        field_a: { value: "value", isComplete: true },
        field_b: {},
      },
    });

    const updatedState = manager.getState();
    expect(updatedState.respec.metadata.formSyncStatus).toBe("synced");
  });

  it("purges conflicts for removed nodes and unblocks system", () => {
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
        parent_requirements: [],
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

    (manager as unknown as { state: ArtifactState }).state = state;

    (manager as any).purgeConflictsForNodes(["spec-a"]);

    const updatedState = manager.getState();
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
        parent_requirements: [],
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
        parent_requirements: [],
        field_name: "field_b",
      },
      attribution: "requirement",
      confidence: 1,
      source: "user",
      timestamp: new Date(),
    };
    state.conflicts.metadata.blockingConflicts = ["spec-b"];

    (manager as unknown as { state: ArtifactState }).state = state;

    await manager.moveNonConflictingToRespec();

    const updatedState = manager.getState();
    expect(updatedState.respec.specifications["spec-a"]).toBeDefined();
    expect(updatedState.mapped.specifications["spec-a"]).toBeUndefined();
    expect(updatedState.mapped.specifications["spec-b"]).toBeDefined();
  });
});

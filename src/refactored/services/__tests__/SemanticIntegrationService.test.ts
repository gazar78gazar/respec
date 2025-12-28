import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SemanticIntegrationService } from "../SemanticIntegrationService";
import { ucDataLayer } from "../DataLayer";
import type { MatchResult } from "../../types/semantic.types";
import type { UCSpecification } from "../../types/uc-data.types";

const createUcSpec = (id: string, fieldName = "field"): UCSpecification => ({
  id,
  type: "specification",
  name: id,
  parent_requirements: [],
  field_name: fieldName,
});

describe("SemanticIntegrationService.processExtractedRequirements", () => {
  const matchExtractedNodesToUC = vi.fn();
  const addSpecificationToMapped = vi.fn();
  const detectExclusionConflicts = vi.fn();
  const moveNonConflictingToRespec = vi.fn();
  const generateFormUpdatesFromRespec = vi.fn();
  const findSpecificationInArtifact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty updates when no extracted requirements", async () => {
    const semanticMatchingService = {
      matchExtractedNodesToUC,
    } as unknown as {
      matchExtractedNodesToUC: typeof matchExtractedNodesToUC;
    };

    const service = new SemanticIntegrationService(
      semanticMatchingService as any,
    );

    const result = await service.processExtractedRequirements(
      [],
      "No requirements",
    );

    expect(result.success).toBe(true);
    expect(result.systemMessage).toBe("No requirements");
    expect(result.formUpdates).toEqual([]);
    expect(matchExtractedNodesToUC).not.toHaveBeenCalled();
  });

  it("routes high-confidence specification matches and generates form updates", async () => {
    const ucSpec = createUcSpec("P01", "processor");
    vi.spyOn(ucDataLayer, "getSpecification").mockReturnValue(ucSpec);

    const semanticMatchingService = {
      matchExtractedNodesToUC: matchExtractedNodesToUC.mockResolvedValue([
        {
          extractedNode: {
            text: "processor: Intel Core i7",
            value: "Intel Core i7",
            context: "need a processor",
          },
          ucMatch: {
            id: "P01",
            name: "processor",
            type: "specification",
            confidence: 0.9,
            matchType: "semantic",
            rationale: "matches processor",
          },
          value: "Intel Core i7",
        },
      ] satisfies MatchResult[]),
    };

    detectExclusionConflicts.mockResolvedValue({
      hasConflict: false,
      conflicts: [],
    });
    generateFormUpdatesFromRespec.mockReturnValue([
      {
        section: "compute",
        field: "processor",
        value: "Intel Core i7",
        confidence: 1,
        isAssumption: false,
        originalRequest: "need a processor",
        substitutionNote: "matches processor",
      },
    ]);

    const artifactManager = {
      addSpecificationToMapped,
      detectExclusionConflicts,
      moveNonConflictingToRespec,
      generateFormUpdatesFromRespec,
    };

    const service = new SemanticIntegrationService(
      semanticMatchingService as any,
      artifactManager as any,
    );

    const result = await service.processExtractedRequirements(
      [
        {
          field: "processor",
          value: "Intel Core i7",
          section: "compute",
          originalRequest: "need a processor",
        },
      ],
      "Matched",
    );

    expect(addSpecificationToMapped).toHaveBeenCalledWith(
      ucSpec,
      "Intel Core i7",
      "need a processor",
      "matches processor",
      "llm",
    );
    expect(detectExclusionConflicts).toHaveBeenCalled();
    expect(moveNonConflictingToRespec).toHaveBeenCalled();
    expect(result.formUpdates).toHaveLength(1);
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it("skips routing when confidence is below threshold", async () => {
    const semanticMatchingService = {
      matchExtractedNodesToUC: matchExtractedNodesToUC.mockResolvedValue([
        {
          extractedNode: {
            text: "processor: Intel Core i7",
            value: "Intel Core i7",
          },
          ucMatch: {
            id: "P01",
            name: "processor",
            type: "specification",
            confidence: 0.4,
            matchType: "semantic",
            rationale: "low confidence",
          },
          value: "Intel Core i7",
        },
      ] satisfies MatchResult[]),
    };

    const artifactManager = {
      addSpecificationToMapped,
      detectExclusionConflicts,
      moveNonConflictingToRespec,
      generateFormUpdatesFromRespec,
    };

    const service = new SemanticIntegrationService(
      semanticMatchingService as any,
      artifactManager as any,
    );

    const result = await service.processExtractedRequirements(
      [
        {
          field: "processor",
          value: "Intel Core i7",
          section: "compute",
        },
      ],
      "Low confidence",
    );

    expect(addSpecificationToMapped).not.toHaveBeenCalled();
    expect(result.formUpdates).toEqual([]);
    expect(result.confidence).toBeCloseTo(0.4);
  });

  it("routes requirement matches by adding child specifications", async () => {
    const childSpec = createUcSpec("P10", "memory");
    vi.spyOn(ucDataLayer, "getSpecificationsByRequirement").mockReturnValue([
      childSpec,
    ]);

    const semanticMatchingService = {
      matchExtractedNodesToUC: matchExtractedNodesToUC.mockResolvedValue([
        {
          extractedNode: {
            text: "req: memory requirements",
            value: null,
          },
          ucMatch: {
            id: "R01",
            name: "Memory Requirements",
            type: "requirement",
            confidence: 0.9,
            matchType: "semantic",
            rationale: "matches requirement",
          },
          value: null,
        },
      ] satisfies MatchResult[]),
    };

    findSpecificationInArtifact.mockReturnValue(null);
    detectExclusionConflicts.mockResolvedValue({
      hasConflict: false,
      conflicts: [],
    });

    const artifactManager = {
      addSpecificationToMapped,
      detectExclusionConflicts,
      moveNonConflictingToRespec,
      generateFormUpdatesFromRespec,
      findSpecificationInArtifact,
    };

    const service = new SemanticIntegrationService(
      semanticMatchingService as any,
      artifactManager as any,
    );

    await service.processExtractedRequirements(
      [
        {
          field: "memory",
          value: "16GB",
          section: "compute",
        },
      ],
      "Requirement match",
    );

    expect(addSpecificationToMapped).toHaveBeenCalledWith(
      childSpec,
      null,
      "From requirement R01",
      "Auto-added as part of requirement R01",
      "llm",
    );
    expect(moveNonConflictingToRespec).toHaveBeenCalled();
  });
});

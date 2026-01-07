import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SemanticIntegrationService } from "../SemanticIntegrationService";
import { ucDataLayer } from "../DataLayer";
import type { MatchResult } from "../../types/semantic.types";
import type { UCSpecification } from "../../types/uc-data.types";

const createUcSpec = (id: string, fieldName = "field"): UCSpecification => ({
  id,
  type: "specification",
  name: id,
  field_name: fieldName,
});

describe("SemanticIntegrationService.processExtractedRequirements", () => {
  const matchExtractedNodesToUC = vi.fn();
  const addSpecificationToMapped = vi.fn();
  const detectExclusionConflicts = vi.fn();
  const moveNonConflictingToRespec = vi.fn();
  const generateFormUpdatesFromRespec = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty updates when no extracted specifications", async () => {
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
      "No specifications",
    );

    expect(result.success).toBe(true);
    expect(result.systemMessage).toBe("No specifications");
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

  it("skips non-spec matches", async () => {
    const semanticMatchingService = {
      matchExtractedNodesToUC: matchExtractedNodesToUC.mockResolvedValue([
        {
          extractedNode: {
            text: "note: comment",
            value: "comment",
          },
          ucMatch: {
            id: "C01",
            name: "comment",
            type: "comment",
            confidence: 0.95,
            matchType: "semantic",
            rationale: "comment match",
          },
          value: "comment",
        } as unknown as MatchResult,
      ]),
    };

    generateFormUpdatesFromRespec.mockReturnValue([]);

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
          field: "comment",
          value: "comment",
          section: "notes",
        },
      ],
      "Ignored",
    );

    expect(addSpecificationToMapped).not.toHaveBeenCalled();
    expect(detectExclusionConflicts).not.toHaveBeenCalled();
    expect(moveNonConflictingToRespec).not.toHaveBeenCalled();
    expect(result.formUpdates).toEqual([]);
  });
});

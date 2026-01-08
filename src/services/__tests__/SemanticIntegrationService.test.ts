import { describe, it, expect, vi, afterEach } from "vitest";
import { SemanticIntegrationService } from "../SemanticIntegrationService";
import { ucDataLayer } from "../DataLayer";
import type { MatchResult } from "../../types/semantic.types";
import type { EnhancedFormUpdate } from "../../types/service.types";
import type { UCSpecification } from "../../types/uc-data.types";

const makeSpec = (id: string): UCSpecification => ({
  id,
  type: "specification",
  name: `Spec ${id}`,
  field_name: `field_${id}`,
});

const buildArtifactManager = (formUpdates: EnhancedFormUpdate[] = []) => ({
  addSpecificationToMapped: vi.fn().mockResolvedValue(undefined),
  detectExclusionConflicts: vi
    .fn()
    .mockResolvedValue({ hasConflict: false, conflicts: [] }),
  moveNonConflictingToRespec: vi.fn().mockResolvedValue(undefined),
  generateFormUpdatesFromRespec: vi.fn().mockReturnValue(formUpdates),
});

describe("SemanticIntegrationService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early when no extracted requirements", async () => {
    const semanticExtractor = {
      matchExtractedNodesToUC: vi.fn(),
    };
    const artifactManager = buildArtifactManager();
    const service = new SemanticIntegrationService(
      semanticExtractor as unknown as any,
      artifactManager as unknown as any,
    );

    const result = await service.processExtractedRequirements(
      [],
      "no requirements",
    );

    expect(result.success).toBe(true);
    expect(result.formUpdates).toEqual([]);
    expect(result.confidence).toBe(1.0);
    expect(semanticExtractor.matchExtractedNodesToUC).not.toHaveBeenCalled();
    expect(artifactManager.addSpecificationToMapped).not.toHaveBeenCalled();
    expect(artifactManager.detectExclusionConflicts).not.toHaveBeenCalled();
    expect(
      artifactManager.generateFormUpdatesFromRespec,
    ).not.toHaveBeenCalled();
  });

  it("filters by confidence and routes only specification matches", async () => {
    const semanticExtractor = {
      matchExtractedNodesToUC: vi.fn(),
    };
    const artifactManager = buildArtifactManager([
      {
        section: "IOConnectivity",
        field: "digitalIO",
        value: "8",
        isAssumption: false,
        confidence: 1,
      },
    ]);
    const service = new SemanticIntegrationService(
      semanticExtractor as unknown as any,
      artifactManager as unknown as any,
    );

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) =>
      id === "P1" ? makeSpec("P1") : null,
    );

    const matchResults = [
      {
        extractedText: "high confidence",
        extractedNode: {
          text: "high confidence",
          value: "v1",
          context: "ctx1",
        },
        ucMatch: {
          id: "P1",
          name: "Spec One",
          type: "specification",
          confidence: 0.9,
          matchType: "semantic",
          rationale: "match",
        },
        value: "v1",
      },
      {
        extractedText: "low confidence",
        extractedNode: {
          text: "low confidence",
          value: "v2",
          context: "ctx2",
        },
        ucMatch: {
          id: "P2",
          name: "Spec Two",
          type: "specification",
          confidence: 0.5,
          matchType: "semantic",
          rationale: "low",
        },
        value: "v2",
      },
      {
        extractedText: "comment",
        extractedNode: {
          text: "comment",
          value: "v3",
          context: "ctx3",
        },
        ucMatch: {
          id: "C1",
          name: "Comment",
          type: "comment",
          confidence: 0.95,
          matchType: "semantic",
          rationale: "non-spec",
        },
        value: "v3",
      },
    ] as unknown as MatchResult[];

    semanticExtractor.matchExtractedNodesToUC.mockResolvedValue(matchResults);

    await service.processExtractedRequirements(
      [
        {
          field: "digitalIO",
          value: "8",
          section: "IOConnectivity",
          originalRequest: "digital inputs",
        },
      ],
      "ok",
    );

    expect(semanticExtractor.matchExtractedNodesToUC).toHaveBeenCalled();
    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledTimes(1);
    const [specArg] = artifactManager.addSpecificationToMapped.mock.calls[0];
    expect(specArg.id).toBe("P1");
    expect(artifactManager.detectExclusionConflicts).toHaveBeenCalledTimes(1);
    expect(artifactManager.moveNonConflictingToRespec).toHaveBeenCalledTimes(1);
    expect(artifactManager.generateFormUpdatesFromRespec).toHaveBeenCalled();
  });

  it("blocks promotion on conflict while returning respec form updates", async () => {
    const semanticExtractor = {
      matchExtractedNodesToUC: vi.fn(),
    };
    const formUpdates: EnhancedFormUpdate[] = [
      {
        section: "IOConnectivity",
        field: "digitalIO",
        value: "8",
        isAssumption: false,
        confidence: 1,
      },
    ];
    const artifactManager = buildArtifactManager(formUpdates);
    artifactManager.detectExclusionConflicts.mockResolvedValue({
      hasConflict: true,
      conflicts: [{ type: "exclusion" }],
    });
    const service = new SemanticIntegrationService(
      semanticExtractor as unknown as any,
      artifactManager as unknown as any,
    );

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) =>
      id === "P1" ? makeSpec("P1") : null,
    );

    const matchResults = [
      {
        extractedText: "high confidence",
        extractedNode: {
          text: "high confidence",
          value: "v1",
          context: "ctx1",
        },
        ucMatch: {
          id: "P1",
          name: "Spec One",
          type: "specification",
          confidence: 0.9,
          matchType: "semantic",
          rationale: "match",
        },
        value: "v1",
      },
    ] as MatchResult[];

    semanticExtractor.matchExtractedNodesToUC.mockResolvedValue(matchResults);

    const result = await service.processExtractedRequirements(
      [
        {
          field: "digitalIO",
          value: "8",
          section: "IOConnectivity",
        },
      ],
      "ok",
    );

    expect(artifactManager.addSpecificationToMapped).toHaveBeenCalledTimes(1);
    expect(artifactManager.detectExclusionConflicts).toHaveBeenCalledTimes(1);
    expect(artifactManager.moveNonConflictingToRespec).not.toHaveBeenCalled();
    expect(result.formUpdates).toEqual(formUpdates);
  });
});

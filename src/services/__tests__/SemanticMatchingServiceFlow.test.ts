import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { SemanticMatchingService } from "../SemanticMatchingService";
import { ucDataLayer } from "../DataLayer";

describe("SemanticMatchingService flow", () => {
  beforeEach(() => {
    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(true);
    vi.spyOn(ucDataLayer, "getAllSpecifications").mockReturnValue([
      {
        id: "P1",
        type: "specification",
        name: "Spec One",
        description: "Spec",
        field_name: "field_a",
      },
    ]);
    vi.spyOn(ucDataLayer, "getUiFieldByFieldName").mockReturnValue({
      section: "section_a",
      category: "cat_a",
      field_name: "field_a",
      ui_type: "dropdown",
      selection_type: "single_choice",
      options: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches extracted nodes and parses LLM response", async () => {
    const service = new SemanticMatchingService("test-key");

    (service as unknown as { client: unknown }).client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                matches: [
                  {
                    extractedText: "field: value",
                    ucMatch: {
                      id: "P1",
                      name: "Spec One",
                      type: "specification",
                      confidence: 0.9,
                      matchType: "semantic",
                      rationale: "Match",
                    },
                    value: "value",
                  },
                ],
              }),
            },
          ],
        }),
      },
    };

    const results = await service.matchExtractedNodesToUC([
      { text: "field: value", value: "value" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].ucMatch.id).toBe("P1");
  });

  it("throws when response has no JSON", async () => {
    const service = new SemanticMatchingService("test-key");

    (service as unknown as { client: unknown }).client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "no json here" }],
        }),
      },
    };

    await expect(
      service.matchExtractedNodesToUC([{ text: "field: value" }]),
    ).rejects.toThrow("Failed to parse matching results");
  });
});

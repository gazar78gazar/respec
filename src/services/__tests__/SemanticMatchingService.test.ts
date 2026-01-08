import { describe, expect, it, vi, afterEach } from "vitest";
import { SemanticExtractor } from "../agents/SemanticExtractor";
import { ucDataLayer } from "../DataLayer";

const buildExtractor = (hasClient = true) =>
  new SemanticExtractor(
    {
      hasClient: vi.fn().mockReturnValue(hasClient),
      initialize: vi.fn(),
      createMessage: vi.fn(),
    } as unknown as any,
    {
      getPrompt: vi.fn().mockResolvedValue("system"),
    } as unknown as any,
  );

describe("SemanticExtractor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when client is not initialized", async () => {
    const extractor = buildExtractor(false);

    await expect(extractor.matchExtractedNodesToUC([])).rejects.toThrow(
      "Client not initialized",
    );
  });

  it("throws when UCDataLayer is not loaded", async () => {
    const extractor = buildExtractor(true);

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(false);

    await expect(extractor.matchExtractedNodesToUC([])).rejects.toThrow(
      "UCDataLayer not loaded",
    );
  });

  it("parses match results from JSON response", () => {
    const extractor = buildExtractor(true);
    const response = `
      {
        "matches": [
          {
            "extractedText": "processor: Intel Core i7",
            "ucMatch": {
              "id": "P01",
              "name": "processor",
              "type": "specification",
              "confidence": 0.9,
              "matchType": "semantic",
              "rationale": "matches processor"
            },
            "value": "Intel Core i7"
          }
        ]
      }
    `;

    const results = (
      extractor as unknown as {
        parseMatchResults: (text: string) => Array<{
          extractedNode: { text: string; value: unknown };
          ucMatch: {
            id: string;
            name: string;
            type: string;
            confidence: number;
          };
          value: unknown;
        }>;
      }
    ).parseMatchResults(response);

    expect(results).toHaveLength(1);
    expect(results[0].ucMatch.id).toBe("P01");
    expect(results[0].extractedNode.text).toContain("processor");
    expect(results[0].value).toBe("Intel Core i7");
  });
});

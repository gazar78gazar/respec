import { describe, expect, it, vi, afterEach } from "vitest";
import { SemanticMatchingService } from "../SemanticMatchingService";
import { ucDataLayer } from "../DataLayer";

describe("SemanticMatchingService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when client is not initialized", async () => {
    const service = new SemanticMatchingService("");

    await expect(service.matchExtractedNodesToUC([])).rejects.toThrow(
      "Client not initialized",
    );
  });

  it("throws when UCDataLayer is not loaded", async () => {
    const service = new SemanticMatchingService("test-key");
    (service as unknown as { client: unknown }).client = {
      messages: {
        create: vi.fn(),
      },
    };

    vi.spyOn(ucDataLayer, "isLoaded").mockReturnValue(false);

    await expect(service.matchExtractedNodesToUC([])).rejects.toThrow(
      "UCDataLayer not loaded",
    );
  });

  it("parses match results from JSON response", () => {
    const service = new SemanticMatchingService("test-key");
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
      service as unknown as {
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

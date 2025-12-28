import { describe, expect, it, afterEach, vi } from "vitest";
import { SemanticMatcher } from "../SemanticMatcher";
import { ucDataLayer } from "../DataLayer";

describe("SemanticMatcher (refactored)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no requirements for non-technical messages", async () => {
    const matcher = new SemanticMatcher();
    const result = await matcher.parseMessage("hello there");

    expect(result.hasRequirements).toBe(false);
    expect(result.intent.type).toBe("other");
    expect(result.extractions).toHaveLength(0);
  });

  it("extracts processor requirement and maps UC candidates", async () => {
    const matcher = new SemanticMatcher();

    vi.spyOn(ucDataLayer, "getSpecification").mockImplementation((id) => {
      if (id === "spc001") {
        return {
          id: "spc001",
          type: "specification",
          name: "processor_type",
          parent_requirements: [],
          field_name: "processor_type",
        };
      }
      return null;
    });

    const result = await matcher.parseMessage(
      "I need an Intel Core i7 processor",
    );

    expect(result.hasRequirements).toBe(true);
    expect(result.extractions).toHaveLength(1);
    expect(result.extractions[0].category).toBe("processor");
    expect(result.extractions[0].ucCandidates).toHaveLength(1);
  });

  it("normalizes memory values and keeps confidence within bounds", async () => {
    const matcher = new SemanticMatcher();

    vi.spyOn(ucDataLayer, "getSpecification").mockReturnValue({
      id: "spc002",
      type: "specification",
      name: "memory_capacity",
      parent_requirements: [],
      field_name: "memory_capacity",
    });

    const result = await matcher.parseMessage("I need 16GB memory");

    expect(result.hasRequirements).toBe(true);
    expect(result.extractions[0].value).toBe("16GB");
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

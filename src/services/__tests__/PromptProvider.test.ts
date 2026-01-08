import { describe, it, expect } from "vitest";
import { LocalPromptProvider } from "../prompts/PromptProvider";

describe("LocalPromptProvider", () => {
  it("returns presale-engineer prompt", async () => {
    const provider = new LocalPromptProvider();
    const prompt = await provider.getPrompt("presale-engineer");

    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toContain("Conflict Resolution Mode");
  });

  it("returns semantic-extractor prompt", async () => {
    const provider = new LocalPromptProvider();
    const prompt = await provider.getPrompt("semantic-extractor");

    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toContain("Return ONLY valid JSON");
  });
});

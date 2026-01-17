import { describe, it, expect } from "vitest";
import { LocalPromptProvider } from "../PromptProvider";

describe("LocalPromptProvider", () => {
  it("returns presale-engineer prompt", async () => {
    const provider = new LocalPromptProvider();
    const prompt = await provider.getPrompt("presale-engineer");

    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toContain("OUTPUT FORMAT");
  });

  it("returns autofill prompt", async () => {
    const provider = new LocalPromptProvider();
    const prompt = await provider.getPrompt("autofill-agent");

    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toContain("Autofill Agent Prompt");
  });
});

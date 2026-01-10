import flowPrompt from "../config/prompts/presale_engineer/flow.md?raw";
import domainPrompt from "../config/prompts/presale_engineer/domain.md?raw";
import preSaleEngineerPrompt from "../config/prompts/presale_engineer/presale-engineer.md?raw";
import specificationsPrompt from "../config/prompts/presale_engineer/specifications.md?raw";
import type { PromptKey, PromptProvider } from "./interfaces/PromptProvider";

export class LocalPromptProvider implements PromptProvider {
  private promptMap: Record<PromptKey, string>;

  constructor() {
    const presalePrompt = [
      flowPrompt,
      domainPrompt,
      preSaleEngineerPrompt,
      specificationsPrompt,
    ]
      .map((prompt) => prompt.trim())
      .filter(Boolean)
      .join("\n\n");

    this.promptMap = {
      "presale-engineer": presalePrompt,
    };
  }

  async getPrompt(key: PromptKey): Promise<string> {
    const prompt = this.promptMap[key];
    console.log(`[PromptProvider] prompt provided`, { key, prompt });
    return prompt;
  }
}

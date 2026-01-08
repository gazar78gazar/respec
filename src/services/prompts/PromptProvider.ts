import preSaleEngineerPrompt from "../../config/prompts/presale-engineer.md?raw";
import semanticExtractorPrompt from "../../config/prompts/semantic-extractor.md?raw";

export type PromptKey = "presale-engineer" | "semantic-extractor";

export interface PromptProvider {
  getPrompt(key: PromptKey): Promise<string>;
}

export class LocalPromptProvider implements PromptProvider {
  private promptMap: Record<PromptKey, string>;

  constructor() {
    this.promptMap = {
      "presale-engineer": preSaleEngineerPrompt,
      "semantic-extractor": semanticExtractorPrompt,
    };
  }

  async getPrompt(key: PromptKey): Promise<string> {
    return this.promptMap[key];
  }
}

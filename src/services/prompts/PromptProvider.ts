import preSaleEngineerPrompt from "../../config/prompts/presale-engineer.md?raw";
import semanticExtractorPrompt from "../../config/prompts/semantic-extractor.md?raw";
import type { PromptKey, PromptProvider } from "../interfaces/PromptProvider";

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

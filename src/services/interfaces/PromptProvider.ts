export type PromptKey = "presale-engineer" | "semantic-extractor";

export interface PromptProvider {
  getPrompt(key: PromptKey): Promise<string>;
}

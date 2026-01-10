export type PromptKey = "presale-engineer";

export interface PromptProvider {
  getPrompt(key: PromptKey): Promise<string>;
}

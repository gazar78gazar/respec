export type PromptKey = "presale-engineer" | "autofill-agent";

export interface PromptProvider {
  getPrompt(key: PromptKey): Promise<string>;
}

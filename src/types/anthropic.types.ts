/**
 * anthropic.types - Types for Anthropic API requests/responses.
 */

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AnthropicMessageRequest = {
  model: string;
  max_tokens: number;
  temperature: number;
  system?: string;
  messages: AnthropicMessage[];
};

export type AnthropicMessageResponse = {
  content: Array<
    { type: "text"; text: string } | { type: string; text?: string }
  >;
};

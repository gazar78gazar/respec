import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicService } from "../AnthropicService";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: createMock,
      },
    })),
  };
});

describe("AnthropicService", () => {
  let service: AnthropicService;

  beforeEach(() => {
    service = new AnthropicService("test-api-key");
    createMock.mockReset();
    vi.clearAllMocks();
  });

  it("initializes with provided API key", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await service.initialize();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[AnthropicService] Initialized with API key",
    );
    consoleSpy.mockRestore();
  });

  it("warns when no API key is provided", () => {
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new AnthropicService();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[AnthropicService] No API key provided - will use fallback responses",
    );
    consoleSpy.mockRestore();
  });

  it("reports when no API key is available during initialize", async () => {
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const noKeyService = new AnthropicService("");

    await noKeyService.initialize();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[AnthropicService] Running in fallback mode (no API key)",
    );
    consoleSpy.mockRestore();
  });

  it("creates messages through the Anthropic client", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    await service.initialize();

    const response = await service.createMessage({
      model: "test-model",
      max_tokens: 123,
      temperature: 0.2,
      system: "system",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(createMock).toHaveBeenCalledWith({
      model: "test-model",
      max_tokens: 123,
      temperature: 0.2,
      system: "system",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(response.content[0].text).toBe("ok");
  });

  it("throws when createMessage is called before initialization", async () => {
    await expect(
      service.createMessage({
        model: "test-model",
        max_tokens: 1,
        temperature: 0,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Client not initialized");
  });
});

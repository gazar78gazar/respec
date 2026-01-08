import { describe, expect, it, vi } from "vitest";
import { ConversationService } from "../ConversationService";

describe("ConversationService", () => {
  it("sends threaded messages with history and stores new turns", async () => {
    const anthropicService = {
      createMessage: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Assistant reply" }],
      }),
    };
    const sessionStore = {
      getHistory: vi
        .fn()
        .mockResolvedValue([
          { role: "user", content: "Hello", timestamp: "t1" },
        ]),
      append: vi.fn(),
      trim: vi.fn(),
      clear: vi.fn(),
    };

    const service = new ConversationService(
      anthropicService as unknown as any,
      sessionStore as unknown as any,
    );

    const result = await service.sendThreaded({
      sessionId: "session-1",
      message: "Next message",
      model: "test-model",
      max_tokens: 42,
      temperature: 0.2,
      system: "system",
      maxTurns: 3,
    });

    expect(anthropicService.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "system",
        messages: [
          { role: "user", content: "Hello" },
          { role: "user", content: "Next message" },
        ],
      }),
    );
    expect(sessionStore.append).toHaveBeenCalledTimes(2);
    expect(sessionStore.trim).toHaveBeenCalledWith("session-1", 3);
    expect(result.assistantText).toBe("Assistant reply");
  });
});

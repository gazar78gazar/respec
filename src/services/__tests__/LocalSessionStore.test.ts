import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalSessionStore } from "../LocalSessionStore";
import type { SessionMessage } from "../../types/service.types";

const storage: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) =>
    Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null,
  ),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  }),
};

vi.stubGlobal("localStorage", localStorageMock);

describe("LocalSessionStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("append/getHistory persist to localStorage", async () => {
    const store = new LocalSessionStore();
    const message: SessionMessage = {
      role: "user",
      content: "hello",
      timestamp: "2024-01-01T00:00:00.000Z",
    };

    await store.append("session-1", message);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "respec_session_session-1",
      expect.any(String),
    );

    const history = await store.getHistory("session-1");

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(message);
  });

  it("trim respects maxTurns", async () => {
    const store = new LocalSessionStore();
    const messages: SessionMessage[] = [
      {
        role: "user",
        content: "one",
        timestamp: "2024-01-01T00:00:00.000Z",
      },
      {
        role: "assistant",
        content: "two",
        timestamp: "2024-01-01T00:00:01.000Z",
      },
      {
        role: "user",
        content: "three",
        timestamp: "2024-01-01T00:00:02.000Z",
      },
    ];

    for (const message of messages) {
      await store.append("session-1", message);
    }

    await store.trim("session-1", 2);

    const history = await store.getHistory("session-1");
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("two");
    expect(history[1].content).toBe("three");
  });

  it("clear removes session", async () => {
    const store = new LocalSessionStore();
    const message: SessionMessage = {
      role: "user",
      content: "hello",
      timestamp: "2024-01-01T00:00:00.000Z",
    };

    await store.append("session-1", message);
    await store.clear("session-1");

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "respec_session_session-1",
    );
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { DataServices } from "../dataServices";

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe("DataServices (refactored)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves projects to localStorage", async () => {
    localStorageMock.getItem.mockReturnValue(null);

    const requirements = {
      field_a: {
        value: "value",
        priority: 1,
        isAssumption: false,
        required: true,
      },
    };
    const metadata = {
      name: "Project A",
      created: new Date("2025-01-01"),
      lastModified: new Date("2025-01-02"),
      description: "Test",
    };

    const success = await DataServices.project.saveProject(
      "Project A",
      requirements,
      metadata,
    );

    expect(success).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem.mock.calls[0][0]).toBe("saved_projects");
  });

  it("handles invalid stored project data gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorageMock.getItem.mockReturnValue("not-json");

    const requirements = {
      field_a: {
        value: "value",
        priority: 1,
        isAssumption: false,
        required: true,
      },
    };
    const metadata = {
      name: "Project B",
      created: new Date("2025-01-01"),
      lastModified: new Date("2025-01-02"),
      description: "Test",
    };

    const success = await DataServices.project.saveProject(
      "Project B",
      requirements,
      metadata,
    );

    expect(success).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("auto-saves after debounce interval", async () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(DataServices.project, "saveProject");

    const requirements = {
      field_a: {
        value: "value",
        priority: 1,
        isAssumption: false,
        required: true,
      },
    };

    DataServices.project.autoSave(requirements, "auto");

    expect(saveSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("generates filenames with timestamps", () => {
    const filename = DataServices.utils.generateFilename("export", "json");
    expect(filename.startsWith("export_")).toBe(true);
    expect(filename.endsWith(".json")).toBe(true);
  });
});

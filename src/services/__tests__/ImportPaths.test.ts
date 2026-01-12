import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenImports = ["requirements" + ".types"];

const collectSourceFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (sourceExtensions.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

describe("Import paths", () => {
  it("does not use retired requirements.types imports", async () => {
    const srcRoot = join(process.cwd(), "src");
    const files = await collectSourceFiles(srcRoot);
    const violations: string[] = [];

    await Promise.all(
      files.map(async (filePath) => {
        if (filePath.endsWith("ImportPaths.test.ts")) {
          return;
        }
        const contents = await readFile(filePath, "utf8");
        if (forbiddenImports.some((needle) => contents.includes(needle))) {
          violations.push(filePath);
        }
      }),
    );

    expect(violations).toEqual([]);
  });
});

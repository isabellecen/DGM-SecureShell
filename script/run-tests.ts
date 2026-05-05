import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function findTests(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findTests(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [fullPath] : [];
    }),
  );
  return results.flat();
}

const roots = [path.resolve("server"), path.resolve("client", "src")];
const tests = (await Promise.all(roots.map((root) => findTests(root)))).flat();

for (const testFile of tests) {
  await import(pathToFileURL(testFile).href);
}

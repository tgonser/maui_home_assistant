import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/data";

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readStore(name: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(filePath(name), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // File missing or corrupt — start fresh
  }
  return {};
}

export function writeStore(name: string, data: Record<string, string>): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    throw new Error(`Failed to write ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

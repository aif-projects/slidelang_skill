import fs from "node:fs/promises";
import path from "node:path";

export interface RelativeFilePayload {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
}

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

function ensureSafeRelativePath(relPath: string): string {
  const normalized = toPosix(String(relPath ?? "").replaceAll("\\", "/").replace(/^\/+/, ""));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Unsupported file path: ${relPath}`);
  }
  return normalized;
}

async function pushFile(
  rootDir: string,
  absolutePath: string,
  files: RelativeFilePayload[],
): Promise<void> {
  const relPath = ensureSafeRelativePath(toPosix(path.relative(rootDir, absolutePath)));
  const buffer = await fs.readFile(absolutePath);
  const encoding = /\.(json|md|txt|html|css|js|ts)$/i.test(relPath) ? "utf8" : "base64";
  files.push({
    path: relPath,
    encoding,
    content: encoding === "utf8" ? buffer.toString("utf8") : buffer.toString("base64"),
  });
}

async function collectFiles(
  rootDir: string,
  dirPath: string,
  files: RelativeFilePayload[],
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rootDir, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    await pushFile(rootDir, absolutePath, files);
  }
}

export async function bundleRelativeFiles(rootDir: string, relPaths: string[]): Promise<RelativeFilePayload[]> {
  const files: RelativeFilePayload[] = [];
  const seen = new Set<string>();
  for (const relPathRaw of relPaths) {
    const relPath = ensureSafeRelativePath(relPathRaw);
    const absolutePath = path.join(rootDir, relPath);
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        await collectFiles(rootDir, absolutePath, files);
      } else if (stat.isFile()) {
        await pushFile(rootDir, absolutePath, files);
      }
    } catch {}
  }
  return files
    .filter((file) => {
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function writeRelativeFiles(rootDir: string, files: RelativeFilePayload[]): Promise<void> {
  for (const file of files) {
    const relPath = ensureSafeRelativePath(file.path);
    const absolutePath = path.join(rootDir, relPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const buffer = file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
    await fs.writeFile(absolutePath, buffer);
  }
}

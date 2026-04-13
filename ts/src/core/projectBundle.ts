import fs from "node:fs/promises";
import path from "node:path";

export interface ProjectFilePayload {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
}

const INCLUDED_PREFIXES = ["brief", "decks", "assets"];
const INCLUDED_TOP_LEVEL_FILES = new Set(["manifest.json"]);

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

function allowedRelativePath(relPath: string): boolean {
  if (!relPath || relPath.startsWith("/") || relPath.startsWith("../") || relPath.includes("/../")) return false;
  if (INCLUDED_TOP_LEVEL_FILES.has(relPath)) return true;
  return INCLUDED_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function ensureAllowedRelativePath(relPath: string): string {
  const normalized = toPosix(String(relPath ?? "").replaceAll("\\", "/").replace(/^\/+/, ""));
  if (!allowedRelativePath(normalized)) {
    throw new Error(`Unsupported project file path: ${relPath}`);
  }
  return normalized;
}

async function pushFile(rootDir: string, absolutePath: string, files: ProjectFilePayload[]): Promise<void> {
  const relPath = ensureAllowedRelativePath(toPosix(path.relative(rootDir, absolutePath)));
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
  files: ProjectFilePayload[],
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

export async function bundleProjectFiles(projectDir: string): Promise<ProjectFilePayload[]> {
  const files: ProjectFilePayload[] = [];
  for (const topLevel of INCLUDED_TOP_LEVEL_FILES) {
    const filePath = path.join(projectDir, topLevel);
    try {
      const content = await fs.readFile(filePath, "utf8");
      files.push({ path: topLevel, encoding: "utf8", content });
    } catch {}
  }
  for (const prefix of INCLUDED_PREFIXES) {
    const dirPath = path.join(projectDir, prefix);
    try {
      const stat = await fs.stat(dirPath);
      if (stat.isDirectory()) {
        await collectFiles(projectDir, dirPath, files);
      }
    } catch {}
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeProjectFiles(projectDir: string, files: ProjectFilePayload[]): Promise<void> {
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of files) {
    await writeProjectFile(projectDir, file);
  }
}

export async function replaceProjectSourceFiles(projectDir: string, files: ProjectFilePayload[]): Promise<void> {
  await fs.mkdir(projectDir, { recursive: true });
  for (const topLevel of INCLUDED_TOP_LEVEL_FILES) {
    await fs.rm(path.join(projectDir, topLevel), { force: true });
  }
  for (const prefix of INCLUDED_PREFIXES) {
    await fs.rm(path.join(projectDir, prefix), { recursive: true, force: true });
  }
  for (const file of files) {
    await writeProjectFile(projectDir, file);
  }
}

export async function applyProjectFileDelta(
  projectDir: string,
  files: ProjectFilePayload[],
  deletedPaths: string[] = [],
): Promise<void> {
  for (const relPathRaw of deletedPaths) {
    const relPath = ensureAllowedRelativePath(relPathRaw);
    await fs.rm(path.join(projectDir, relPath), { force: true });
  }
  for (const file of files) {
    await writeProjectFile(projectDir, file);
  }
}

async function writeProjectFile(projectDir: string, file: ProjectFilePayload): Promise<void> {
  const relPath = ensureAllowedRelativePath(file.path);
  const absolutePath = path.join(projectDir, relPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = file.encoding === "base64" ? Buffer.from(file.content, "base64") : Buffer.from(file.content, "utf8");
  await fs.writeFile(absolutePath, buffer);
}

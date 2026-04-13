import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyProjectFileDelta, bundleProjectFiles, type ProjectFilePayload } from "../core/projectBundle.ts";
import { resolveApiBaseUrl } from "../core/paths.ts";

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] ?? null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

type GenerateImagesApiResponse = Record<string, any> & {
  files?: ProjectFilePayload[];
  deleted_paths?: string[];
};

async function postJson(url: string, payload: unknown): Promise<GenerateImagesApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  const data = bodyText ? JSON.parse(bodyText) : {};
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as Record<string, unknown>).detail)
        : response.statusText;
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return (data ?? {}) as GenerateImagesApiResponse;
}

async function applyApiImageResult(
  projectRoot: string,
  result: GenerateImagesApiResponse,
): Promise<Record<string, any>> {
  const files = Array.isArray(result.files) ? (result.files as ProjectFilePayload[]) : [];
  const deletedPaths = Array.isArray(result.deleted_paths)
    ? result.deleted_paths.map((entry) => String(entry))
    : [];
  await applyProjectFileDelta(projectRoot, files, deletedPaths);
  const next = { ...result };
  delete next.files;
  delete next.deleted_paths;
  return next;
}

export async function generateImages(
  projectRoot: string,
  {
    slide,
    asset,
    retry = false,
    workflow,
  }: {
    slide?: string | null;
    asset?: string | null;
    retry?: boolean;
    workflow?: string | null;
  } = {},
): Promise<Record<string, any>> {
  const manifestPath = path.join(projectRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const project = String(asRecord(manifest).id ?? "").trim();
  if (!project) {
    throw new Error(`manifest.json at ${manifestPath} must contain a project id.`);
  }
  const files = await bundleProjectFiles(projectRoot);
  const result = await postJson(`${resolveApiBaseUrl()}/api/images/generate`, {
    project,
    workflow: workflow ?? null,
    slide: slide ?? null,
    asset: asset ?? null,
    retry: retry === true,
    files,
  });
  return applyApiImageResult(projectRoot, result);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const projectRoot = path.resolve(argValue(argv, "--project-root") ?? process.cwd());
  const result = await generateImages(projectRoot, {
    slide: argValue(argv, "--slide"),
    asset: argValue(argv, "--asset"),
    workflow: argValue(argv, "--workflow"),
    retry: hasFlag(argv, "--retry") || hasFlag(argv, "--force"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

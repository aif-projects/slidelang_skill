import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { postJson, waitForImageJob, type ImageJobApiResponse } from "../core/imageJobClient.ts";
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

async function applyApiImageResult(
  projectRoot: string,
  result: ImageJobApiResponse,
): Promise<Record<string, any>> {
  const files = Array.isArray(result.files) ? (result.files as ProjectFilePayload[]) : [];
  const deletedPaths = Array.isArray(result.deleted_paths)
    ? result.deleted_paths.map((entry) => String(entry))
    : [];
  await applyProjectFileDelta(projectRoot, files, deletedPaths);
  const next = { ...result };
  delete next.files;
  delete next.deleted_paths;
  if (next.result && typeof next.result === "object" && !Array.isArray(next.result)) {
    return next.result as Record<string, any>;
  }
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
  const apiBaseUrl = resolveApiBaseUrl();
  const start = await postJson(`${apiBaseUrl}/api/images/generate`, {
    project,
    workflow: workflow ?? null,
    slide: slide ?? null,
    asset: asset ?? null,
    retry: retry === true,
    files,
  });
  const jobId = String(start.job_id ?? "").trim();
  if (!jobId) throw new Error("Image generation API did not return a job_id.");
  const result = await waitForImageJob(apiBaseUrl, project, jobId);
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

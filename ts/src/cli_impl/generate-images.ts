import fs from "node:fs/promises";
import path from "node:path";

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
  // Use the same project id as `npm run projects -- ...` (the project directory name); fall back to
  // manifest.id only when the directory name is not a valid id.
  const dirName = path.basename(projectRoot);
  const project = /^[A-Za-z0-9_-]+$/.test(dirName) ? dirName : String(asRecord(manifest).id ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(project)) {
    throw new Error(`Cannot determine a valid project id for ${projectRoot}: name the directory with letters, numbers, underscores, or hyphens.`);
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
  const failed = Array.isArray(result.failed) ? result.failed : [];
  if (failed.length) {
    process.stderr.write(`${failed.length} image(s) failed; successful images were saved. Re-run with --slide/--asset --retry for the failures.\n`);
    process.exitCode = 1;
  }
}

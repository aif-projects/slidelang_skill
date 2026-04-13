import fs from "node:fs/promises";
import path from "node:path";

import { bundleProjectFiles, replaceProjectSourceFiles } from "../core/projectBundle.ts";
import { DECKS_DATA_ROOT, resolveApiBaseUrl } from "../core/paths.ts";
import { readWorkflowCloudSync, writeWorkflowCloudSync } from "../core/cloudSync.ts";
import { type RelativeFilePayload, writeRelativeFiles } from "../core/relativeFileBundle.ts";

function usage(): never {
  throw new Error(
    "Usage: tsx ts/src/cli/projects.ts <list|show|pull|publish|check|budget|repair-plan> [project] [target] [slide]",
  );
}

async function postJson(url: string, payload: unknown): Promise<unknown> {
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
  return data;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

// ---------------------------------------------------------------------------
// Local-only: list and show read manifests from DECKS_DATA_ROOT
// ---------------------------------------------------------------------------

async function listProjects(): Promise<Array<Record<string, unknown>>> {
  const projects: Array<Record<string, unknown>> = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(DECKS_DATA_ROOT, { withFileTypes: true });
  } catch {
    return projects;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(DECKS_DATA_ROOT, entry.name, "manifest.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      projects.push({
        id: manifest.id ?? entry.name,
        title: manifest.title ?? entry.name,
        path: path.join(entry.name, "manifest.json"),
      });
    } catch {}
  }
  return projects.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function showProject(project: string): Promise<Record<string, unknown>> {
  const manifestPath = path.join(DECKS_DATA_ROOT, project, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  return { project, manifest_path: manifestPath, ...asRecord(manifest) };
}

// ---------------------------------------------------------------------------
// Resolve local project directory
// ---------------------------------------------------------------------------

async function localProjectDir(project: string): Promise<string> {
  return path.join(DECKS_DATA_ROOT, project);
}

// ---------------------------------------------------------------------------
// Publish links
// ---------------------------------------------------------------------------

function buildPublishLinks(
  apiBaseUrl: string,
  project: string,
  workflow: string,
  firstSlideId: string | null,
): { present_url: string; editor_url: string } {
  const presentUrl = new URL(
    `/present/${encodeURIComponent(project)}/${encodeURIComponent(workflow)}/`,
    apiBaseUrl,
  ).toString();
  const editorUrl = new URL("/", apiBaseUrl);
  editorUrl.searchParams.set("project", project);
  editorUrl.searchParams.set("workflow", workflow);
  if (firstSlideId) editorUrl.searchParams.set("slide", firstSlideId);
  return { present_url: presentUrl, editor_url: editorUrl.toString() };
}

// ---------------------------------------------------------------------------
// Mirror published artifacts locally
// ---------------------------------------------------------------------------

async function mirrorPublishedArtifacts(
  projectDir: string,
  outRelRaw: string,
  artifactFilesRaw: unknown,
): Promise<void> {
  const outRel = String(outRelRaw ?? "").trim();
  if (!outRel) return;
  if (!Array.isArray(artifactFilesRaw) || !artifactFilesRaw.length) return;
  const outdir = path.join(projectDir, outRel);
  const entries = await fs.readdir(outdir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === "check") continue;
    await fs.rm(path.join(outdir, entry.name), { recursive: true, force: true });
  }
  await fs.mkdir(outdir, { recursive: true });
  const artifactFiles: RelativeFilePayload[] = (artifactFilesRaw as Array<Record<string, unknown>>).map(
    (entry) => {
      const rec = asRecord(entry);
      return {
        path: String(rec.path ?? ""),
        encoding: rec.encoding === "base64" ? ("base64" as const) : ("utf8" as const),
        content: String(rec.content ?? ""),
      };
    },
  );
  await writeRelativeFiles(projectDir, artifactFiles);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command) usage();
  const apiBaseUrl = resolveApiBaseUrl();

  // -- Local commands -------------------------------------------------------

  if (command === "list") {
    process.stdout.write(`${JSON.stringify({ projects: await listProjects() }, null, 2)}\n`);
    return;
  }

  if (command === "show") {
    const project = process.argv[3];
    if (!project) usage();
    process.stdout.write(`${JSON.stringify(await showProject(project), null, 2)}\n`);
    return;
  }

  // -- API commands ---------------------------------------------------------

  if (command === "publish") {
    const project = process.argv[3];
    if (!project) usage();
    const target = process.argv[4] ?? null;
    const projectDir = await localProjectDir(project);
    const files = await bundleProjectFiles(projectDir);
    const syncState = await readWorkflowCloudSync(projectDir, target ?? "slidemaker");
    const result = asRecord(
      await postJson(`${apiBaseUrl}/api/projects/publish`, {
        project,
        workflow: target,
        files,
        expected_published_revision_id: syncState?.published_revision_id ?? null,
        include_artifact_files: true,
      }),
    );
    await mirrorPublishedArtifacts(projectDir, String(result.out ?? ""), result.artifact_files);
    const slides = Array.isArray(result.slides) ? result.slides.map((e) => asRecord(e)) : [];
    const workflowName = asString(result.workflow) ?? target ?? "slidemaker";
    await writeWorkflowCloudSync(projectDir, workflowName, {
      published_revision_id: asString(result.published_revision_id),
    });
    const firstSlideId = asString(slides[0]?.id);
    const output: Record<string, unknown> = {
      ...result,
      api_base_url: apiBaseUrl,
      ...buildPublishLinks(apiBaseUrl, project, workflowName, firstSlideId),
    };
    delete output.artifact_files;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  if (command === "pull") {
    const project = process.argv[3];
    if (!project) usage();
    const target = process.argv[4] ?? null;
    const projectDir = await localProjectDir(project);
    const result = asRecord(
      await postJson(`${apiBaseUrl}/api/projects/pull`, {
        project,
        workflow: target,
      }),
    );
    const files = Array.isArray(result.files)
      ? result.files.map((entry) => {
          const rec = asRecord(entry);
          return {
            path: String(rec.path ?? ""),
            encoding: rec.encoding === "base64" ? ("base64" as const) : ("utf8" as const),
            content: String(rec.content ?? ""),
          };
        })
      : [];
    await replaceProjectSourceFiles(projectDir, files);
    const workflowName = asString(result.workflow) ?? target ?? "slidemaker";
    await writeWorkflowCloudSync(projectDir, workflowName, {
      published_revision_id: asString(result.published_revision_id),
    });
    const output: Record<string, unknown> = {
      ...result,
      api_base_url: apiBaseUrl,
      project_path: projectDir,
    };
    delete output.files;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  if (command === "check") {
    const project = process.argv[3];
    if (!project) usage();
    const target = process.argv[4] ?? null;
    const projectDir = await localProjectDir(project);
    const files = await bundleProjectFiles(projectDir);
    const result = asRecord(
      await postJson(`${apiBaseUrl}/api/projects/check`, {
        project,
        workflow: target,
        files,
      }),
    );
    // Mirror check artifacts locally
    if (result.artifact_files) {
      await mirrorPublishedArtifacts(projectDir, String(result.out ?? ""), result.artifact_files);
      delete result.artifact_files;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "budget") {
    const project = process.argv[3];
    const workflow = process.argv[4];
    const slide = process.argv[5] ?? null;
    if (!project || !workflow) usage();
    const projectDir = await localProjectDir(project);
    const files = await bundleProjectFiles(projectDir);
    const result = await postJson(`${apiBaseUrl}/api/projects/budget`, {
      project,
      workflow,
      slide,
      files,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "repair-plan") {
    const project = process.argv[3];
    const workflow = process.argv[4];
    const slide = process.argv[5] ?? null;
    if (!project || !workflow) usage();
    const result = await postJson(`${apiBaseUrl}/api/projects/repair-plan`, {
      project,
      workflow,
      slide,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  usage();
}

await main();

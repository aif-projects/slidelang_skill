import fs from "node:fs/promises";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

import {
  createMediaStorageClient,
  ensureMediaBucket,
  mediaFileInfo,
  uploadMediaObject,
} from "../core/mediaStorage.ts";
import { ROOT } from "../core/paths.ts";

function loadEnv(repoRoot: string): void {
  for (const candidate of [path.join(repoRoot, ".env"), path.join(path.dirname(repoRoot), "slides", ".env")]) {
    loadDotenv({ path: candidate, override: false, quiet: true });
  }
  loadDotenv({ override: false, quiet: true });
}

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] ?? null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readJson(filePath: string): Promise<any> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function usage(): never {
  throw new Error("Usage: npm run media -- <upload|list> --project-root <dir> --workflow <name> [--id <asset-id> --file <media-file>]");
}

function safeAssetId(value: string | null): string {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("--id must contain only letters, numbers, underscores, or hyphens");
  return id;
}

function projectRelative(projectRoot: string, filePath: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  const rel = path.relative(projectRoot, resolved).split(path.sep).join("/");
  if (!rel || rel.startsWith("../") || rel.includes("/../")) {
    throw new Error(`Media file must stay under project root: ${filePath}`);
  }
  if (rel === "manifest.json" || rel.startsWith("brief/") || rel.startsWith("decks/") || rel.startsWith("assets/")) {
    throw new Error("Local video inputs must not live in manifest.json, brief/, decks/, or assets/. Use media/ so binaries are not bundled into deck revisions.");
  }
  return rel;
}

function workflowAssets(manifest: Record<string, any>, workflowName: string): Array<Record<string, unknown>> {
  const workflow = asRecord(asRecord(manifest.workflows)[workflowName]);
  if (!Object.keys(workflow).length) throw new Error(`Unknown workflow '${workflowName}' in manifest.json`);
  if (!Array.isArray(workflow.assets)) workflow.assets = [];
  return workflow.assets as Array<Record<string, unknown>>;
}

function mediaObjectKey(projectId: string, assetId: string, sha256: string, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase() || ".bin";
  return `projects/${projectId}/media/${assetId}/${sha256}/original${ext}`;
}

export async function uploadMediaAsset(
  projectRoot: string,
  workflowName: string,
  assetId: string,
  filePathRaw: string,
  { ensureBucket = false }: { ensureBucket?: boolean } = {},
): Promise<Record<string, unknown>> {
  const manifestPath = path.join(projectRoot, "manifest.json");
  const manifest = await readJson(manifestPath);
  const projectId = String(asRecord(manifest).id ?? "").trim();
  if (!projectId) throw new Error("manifest.json must contain an id");
  const filePath = path.resolve(projectRoot, filePathRaw);
  const src = projectRelative(projectRoot, filePath);
  const info = await mediaFileInfo(filePath);
  const key = mediaObjectKey(projectId, assetId, info.sha256, filePath);
  const client = createMediaStorageClient();
  if (ensureBucket) await ensureMediaBucket(client);
  await uploadMediaObject(client, key, filePath, info);

  const assets = workflowAssets(manifest, workflowName);
  const nextAsset = {
    id: assetId,
    kind: "video",
    src,
    bucket_key: key,
    filename: path.basename(filePath),
    content_type: info.contentType,
    bytes: info.bytes,
    sha256: info.sha256,
  };
  const index = assets.findIndex((asset) => String(asset.id ?? "") === assetId);
  if (index >= 0) assets[index] = nextAsset;
  else assets.push(nextAsset);
  await writeJson(manifestPath, manifest);
  return {
    ok: true,
    project: projectId,
    workflow: workflowName,
    asset: nextAsset,
  };
}

export async function listMediaAssets(projectRoot: string, workflowName: string): Promise<Record<string, unknown>> {
  const manifest = await readJson(path.join(projectRoot, "manifest.json"));
  const assets = workflowAssets(manifest, workflowName).filter((asset) => asset.kind === "video");
  return {
    project: String(asRecord(manifest).id ?? ""),
    workflow: workflowName,
    assets,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  loadEnv(ROOT);
  const command = argv[0];
  const projectRoot = path.resolve(argValue(argv, "--project-root") ?? process.cwd());
  const workflow = argValue(argv, "--workflow") ?? "slidemaker";
  if (command === "upload") {
    const file = argValue(argv, "--file");
    if (!file) usage();
    const result = await uploadMediaAsset(projectRoot, workflow, safeAssetId(argValue(argv, "--id")), file, {
      ensureBucket: hasFlag(argv, "--ensure-bucket"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "list") {
    process.stdout.write(`${JSON.stringify(await listMediaAssets(projectRoot, workflow), null, 2)}\n`);
    return;
  }
  usage();
}

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OFFICIAL_REMOTE = "github.com/aif-projects/slidelang_skill";

export type SkillUpdateResult =
  | { ok: true; repoRoot: string; before: string; after: string; updated: boolean }
  | { ok: false; repoRoot: string | null; reason: string };

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function findSkillRepoRoot(startFile: string): Promise<string | null> {
  let current = path.dirname(startFile);
  while (true) {
    if (await pathExists(path.join(current, ".git")) && await pathExists(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function git(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function normalizedRemote(url: string): string {
  return url
    .trim()
    .replace(/^git@github\.com:/, "github.com/")
    .replace(/^https:\/\/github\.com\//, "github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "github.com/")
    .replace(/\.git$/, "");
}

function warn(message: string): void {
  process.stderr.write(`slidelang skill update skipped: ${message}\n`);
}

export async function updateSkillRepoBeforeRun(importMetaUrl: string): Promise<SkillUpdateResult> {
  const repoRoot = await findSkillRepoRoot(fileURLToPath(importMetaUrl));
  if (!repoRoot) return { ok: false, repoRoot: null, reason: "repo root not found" };

  let remote = "";
  try {
    remote = normalizedRemote(await git(repoRoot, ["remote", "get-url", "origin"]));
  } catch {
    return { ok: false, repoRoot, reason: "origin remote not found" };
  }
  if (remote !== OFFICIAL_REMOTE) return { ok: false, repoRoot, reason: "not the official SlideLang skill remote" };

  const branch = await git(repoRoot, ["branch", "--show-current"]).catch(() => "");
  if (branch !== "main") {
    warn(`current branch is '${branch || "detached"}', expected 'main'`);
    return { ok: false, repoRoot, reason: `current branch is '${branch || "detached"}', expected 'main'` };
  }

  const status = await git(repoRoot, ["status", "--porcelain"]).catch(() => "");
  if (status) {
    warn("local changes are present");
    return { ok: false, repoRoot, reason: "local changes are present" };
  }

  try {
    const before = await git(repoRoot, ["rev-parse", "HEAD"]);
    await git(repoRoot, ["fetch", "origin", "main"]);
    await git(repoRoot, ["merge", "--ff-only", "origin/main"]);
    const after = await git(repoRoot, ["rev-parse", "HEAD"]);
    return { ok: true, repoRoot, before, after, updated: before !== after };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(reason);
    return { ok: false, repoRoot, reason };
  }
}

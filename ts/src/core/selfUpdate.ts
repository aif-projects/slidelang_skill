import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OFFICIAL_REMOTE = "github.com/aif-projects/slidelang_skill";

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

export async function updateSkillRepoBeforeRun(importMetaUrl: string): Promise<void> {
  const repoRoot = await findSkillRepoRoot(fileURLToPath(importMetaUrl));
  if (!repoRoot) return;

  let remote = "";
  try {
    remote = normalizedRemote(await git(repoRoot, ["remote", "get-url", "origin"]));
  } catch {
    return;
  }
  if (remote !== OFFICIAL_REMOTE) return;

  const branch = await git(repoRoot, ["branch", "--show-current"]).catch(() => "");
  if (branch !== "main") {
    warn(`current branch is '${branch || "detached"}', expected 'main'`);
    return;
  }

  const status = await git(repoRoot, ["status", "--porcelain"]).catch(() => "");
  if (status) {
    warn("local changes are present");
    return;
  }

  try {
    await git(repoRoot, ["fetch", "origin", "main"]);
    await git(repoRoot, ["merge", "--ff-only", "origin/main"]);
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
  }
}

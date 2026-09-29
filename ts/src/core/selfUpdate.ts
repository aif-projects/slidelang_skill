import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OFFICIAL_REMOTE = "github.com/aif-projects/slidelang_skill";
const GIT_TIMEOUT_MS = 15_000;
const GIT_FETCH_TIMEOUT_MS = 30_000;
const NPM_INSTALL_TIMEOUT_MS = 5 * 60_000;
const DEPENDENCY_FILES = ["package.json", "package-lock.json"];

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

async function git(repoRoot: string, args: string[], timeout = GIT_TIMEOUT_MS): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
    maxBuffer: 1024 * 1024,
    timeout,
    // Never block the CLI on a credential/passphrase/host-key prompt.
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
    },
  });
  return stdout.trim();
}

async function installDependenciesIfChanged(repoRoot: string, before: string, after: string): Promise<void> {
  const changed = await git(repoRoot, ["diff", "--name-only", before, after, "--", ...DEPENDENCY_FILES]).catch(() => "");
  if (!changed) return;
  process.stderr.write("slidelang skill update: dependencies changed; running npm install...\n");
  try {
    await execFileAsync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: repoRoot,
      timeout: NPM_INSTALL_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `slidelang skill update: npm install failed (${reason}). Run 'npm install' in ${repoRoot} before continuing.\n`,
    );
  }
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

  let status: string;
  try {
    status = await git(repoRoot, ["status", "--porcelain"]);
  } catch (error) {
    // If we cannot prove the checkout is clean, treat it as dirty and leave it alone.
    const reason = `git status failed: ${error instanceof Error ? error.message : String(error)}`;
    warn(reason);
    return { ok: false, repoRoot, reason };
  }
  if (status) {
    warn("local changes are present");
    return { ok: false, repoRoot, reason: "local changes are present" };
  }

  try {
    const before = await git(repoRoot, ["rev-parse", "HEAD"]);
    await git(repoRoot, ["fetch", "origin", "main"], GIT_FETCH_TIMEOUT_MS);
    await git(repoRoot, ["merge", "--ff-only", "origin/main"]);
    const after = await git(repoRoot, ["rev-parse", "HEAD"]);
    if (before !== after) await installDependenciesIfChanged(repoRoot, before, after);
    return { ok: true, repoRoot, before, after, updated: before !== after };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(reason);
    return { ok: false, repoRoot, reason };
  }
}

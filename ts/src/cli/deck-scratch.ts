import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PROJECTS_ROOT, scaffoldProject } from "../core/deckScratch.ts";

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] ?? null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function requireArg(argv: string[], flag: string, label: string): string {
  const value = argValue(argv, flag);
  if (!value) {
    throw new Error(`Missing required ${label}. Usage: tsx ts/src/cli/deck-scratch.ts --project-id <id> --intent <text> [--projects-root <dir>] [--force]`);
  }
  return value;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const projectId = requireArg(argv, "--project-id", "--project-id").trim();
  const intent = requireArg(argv, "--intent", "--intent").trim();
  const projectsRoot = path.resolve(argValue(argv, "--projects-root") ?? DEFAULT_PROJECTS_ROOT);
  const projectDir = await scaffoldProject(projectsRoot, {
    projectId,
    intent,
    plan: null,
    force: hasFlag(argv, "--force"),
  });
  process.stdout.write(`${JSON.stringify({
    project_id: projectId,
    project_dir: projectDir,
    manifest: path.join(projectDir, "manifest.json"),
    authoring_guide: path.join(projectDir, "brief", "AUTHORING_GUIDE.md"),
    plan_generated: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

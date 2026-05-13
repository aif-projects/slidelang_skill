import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { updateSkillRepoBeforeRun } from "../core/selfUpdate.ts";

export async function main(): Promise<void> {
  await updateSkillRepoBeforeRun(import.meta.url);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const guide = await fs.readFile(path.join(repoRoot, "skills", "slidelang", "GUIDE.md"), "utf8");
  process.stdout.write(guide);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

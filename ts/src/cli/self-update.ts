import path from "node:path";
import { fileURLToPath } from "node:url";

import { updateSkillRepoBeforeRun } from "../core/selfUpdate.ts";

export async function main(): Promise<void> {
  const result = await updateSkillRepoBeforeRun(import.meta.url);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

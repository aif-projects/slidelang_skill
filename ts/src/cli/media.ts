import path from "node:path";
import { fileURLToPath } from "node:url";

import { updateSkillRepoBeforeRun } from "../core/selfUpdate.ts";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  await updateSkillRepoBeforeRun(import.meta.url);
  const impl = await import("../cli_impl/media.ts");
  await impl.main(argv);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function resolveDecksDataRoot(_repoRoot = ROOT, env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.DECKS_DATA_ROOT ?? "").trim();
  if (configured) return path.resolve(configured);
  return path.resolve("slidelang-projects");
}

export const DECKS_DATA_ROOT = resolveDecksDataRoot();

export function resolveApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.SLIDELANG_API_BASE_URL ?? env.EDITOR_BASE_URL ?? "").trim();
  return configured || "https://slidelang.up.railway.app";
}

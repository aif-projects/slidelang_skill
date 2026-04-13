import fs from "node:fs/promises";
import path from "node:path";

export const CLOUD_SYNC_STATE_FILE = ".slidelang-cloud-sync.json";

export interface WorkflowCloudSyncState {
  published_revision_id: string | null;
}

interface ProjectCloudSyncState {
  workflows?: Record<string, WorkflowCloudSyncState>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function readProjectCloudSync(projectDir: string): Promise<ProjectCloudSyncState> {
  const syncPath = path.join(projectDir, CLOUD_SYNC_STATE_FILE);
  try {
    return asRecord(JSON.parse(await fs.readFile(syncPath, "utf8"))) as ProjectCloudSyncState;
  } catch {
    return {};
  }
}

export async function readWorkflowCloudSync(projectDir: string, workflow: string): Promise<WorkflowCloudSyncState | null> {
  const state = await readProjectCloudSync(projectDir);
  const workflows = asRecord(state.workflows);
  const entry = asRecord(workflows[workflow]);
  if (!Object.keys(entry).length) return null;
  return {
    published_revision_id: entry.published_revision_id == null ? null : String(entry.published_revision_id),
  };
}

export async function writeWorkflowCloudSync(
  projectDir: string,
  workflow: string,
  state: WorkflowCloudSyncState,
): Promise<void> {
  const current = await readProjectCloudSync(projectDir);
  const workflows = asRecord(current.workflows);
  workflows[workflow] = {
    published_revision_id: state.published_revision_id,
  };
  const next: ProjectCloudSyncState = { workflows: workflows as Record<string, WorkflowCloudSyncState> };
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, CLOUD_SYNC_STATE_FILE), `${JSON.stringify(next, null, 2)}\n`);
}

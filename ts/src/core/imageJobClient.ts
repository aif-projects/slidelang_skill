import type { ProjectFilePayload } from "./projectBundle.ts";

export type ImageJobApiResponse = Record<string, any> & {
  files?: ProjectFilePayload[];
  deleted_paths?: string[];
};

const IMAGE_JOB_POLL_INTERVAL_MS = 2000;
const DEFAULT_IMAGE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseRecord(response: Response): Promise<{ bodyText: string; data: Record<string, any> | null }> {
  const bodyText = await response.text();
  if (!bodyText.trim()) return { bodyText, data: null };
  try {
    const value = JSON.parse(bodyText);
    return {
      bodyText,
      data: value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null,
    };
  } catch {
    return { bodyText, data: null };
  }
}

function responseDetail(response: Response, bodyText: string, data: Record<string, any> | null): string {
  return data && typeof data === "object" && "detail" in data
    ? String(data.detail)
    : bodyText || response.statusText || `HTTP ${response.status}`;
}

export async function postJson(url: string, payload: unknown): Promise<ImageJobApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const { bodyText, data } = await readResponseRecord(response);
  if (!response.ok) throw new Error(responseDetail(response, bodyText, data));
  return (data ?? {}) as ImageJobApiResponse;
}

async function getJson(url: string): Promise<ImageJobApiResponse> {
  const response = await fetch(url);
  const { bodyText, data } = await readResponseRecord(response);
  if (!response.ok) throw new Error(responseDetail(response, bodyText, data));
  return (data ?? {}) as ImageJobApiResponse;
}

function imageJobTimeoutMs(): number {
  const raw = Number(process.env.SLIDELANG_IMAGE_JOB_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IMAGE_JOB_TIMEOUT_MS;
}

export async function waitForImageJob(
  apiBaseUrl: string,
  project: string,
  jobId: string,
): Promise<ImageJobApiResponse> {
  const deadline = Date.now() + imageJobTimeoutMs();
  let lastProgress = "";
  while (Date.now() <= deadline) {
    const url = `${apiBaseUrl}/api/images/job?project=${encodeURIComponent(project)}&job_id=${encodeURIComponent(jobId)}`;
    const result = await getJson(url);
    const status = String(result.status ?? "");
    const message = String(result.message ?? "").trim();
    const progress = message ? `${status}: ${message}` : status;
    if (progress && progress !== lastProgress) {
      process.stderr.write(`image job ${jobId} ${progress}\n`);
      lastProgress = progress;
    }
    if (status === "succeeded") return result;
    if (status === "failed") throw new Error(String(result.error ?? result.message ?? "Image generation failed."));
    await sleep(IMAGE_JOB_POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for image job ${jobId}.`);
}

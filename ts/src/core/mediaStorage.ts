import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export type MediaFileInfo = {
  bytes: number;
  sha256: string;
  contentType: string;
};

export function mediaContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov" || ext === ".qt") return "video/quicktime";
  throw new Error(`Unsupported video file extension '${ext}'. Use mp4, webm, or mov.`);
}

async function fileSha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await fsp.readFile(filePath)).digest("hex");
}

export async function mediaFileInfo(filePath: string): Promise<MediaFileInfo> {
  const stat = await fsp.stat(filePath);
  if (!stat.isFile()) throw new Error(`Media path is not a file: ${filePath}`);
  return {
    bytes: stat.size,
    sha256: await fileSha256(filePath),
    contentType: mediaContentType(filePath),
  };
}

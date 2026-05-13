import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type MediaStorageConfig = {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type MediaFileInfo = {
  bytes: number;
  sha256: string;
  contentType: string;
};

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = String(env[key] ?? "").trim();
  if (!value) throw new Error(`${key} is required for bucket-backed media`);
  return value;
}

export function loadMediaStorageConfig(env: NodeJS.ProcessEnv = process.env): MediaStorageConfig {
  return {
    bucket: requiredEnv(env, "S3_BUCKET"),
    endpoint: String(env.S3_ENDPOINT ?? "").trim() || undefined,
    region: String(env.S3_REGION ?? "us-east-1").trim() || "us-east-1",
    accessKeyId: requiredEnv(env, "S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv(env, "S3_SECRET_ACCESS_KEY"),
    forcePathStyle: String(env.S3_FORCE_PATH_STYLE ?? "").trim().toLowerCase() === "true",
  };
}

export function createMediaStorageClient(config = loadMediaStorageConfig()): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function mediaContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov" || ext === ".qt") return "video/quicktime";
  throw new Error(`Unsupported video file extension '${ext}'. Use mp4, webm, or mov.`);
}

async function fileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
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

export async function ensureMediaBucket(
  client: S3Client,
  config = loadMediaStorageConfig(),
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
}

export async function uploadMediaObject(
  client: S3Client,
  key: string,
  filePath: string,
  info: MediaFileInfo,
  config = loadMediaStorageConfig(),
): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: info.contentType,
    ContentLength: info.bytes,
  }));
}

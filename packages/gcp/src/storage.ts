import { Storage } from "@google-cloud/storage";
import type { Readable } from "node:stream";

const storage = new Storage();

export interface UploadOptions {
  bucket: string;
  destination: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/** Upload from local file path. Returns gs://bucket/destination. */
export async function uploadFile(
  localPath: string,
  options: UploadOptions
): Promise<string> {
  const [bucket, dest] = [options.bucket, options.destination];
  await storage.bucket(bucket).upload(localPath, {
    destination: dest,
    contentType: options.contentType ?? "application/octet-stream",
    metadata: options.metadata,
  });
  return `gs://${bucket}/${dest}`;
}

/** Upload from buffer or stream. Returns gs://bucket/destination. */
export async function uploadBuffer(
  data: Buffer | Readable,
  options: UploadOptions
): Promise<string> {
  const [bucket, dest] = [options.bucket, options.destination];
  const file = storage.bucket(bucket).file(dest);
  if (Buffer.isBuffer(data)) {
    await file.save(data, {
      contentType: options.contentType ?? "application/octet-stream",
      metadata: options.metadata,
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const ws = file.createWriteStream({
        contentType: options.contentType ?? "application/octet-stream",
        metadata: options.metadata,
      });
      data.pipe(ws).on("finish", resolve).on("error", reject);
    });
  }
  return `gs://${bucket}/${dest}`;
}

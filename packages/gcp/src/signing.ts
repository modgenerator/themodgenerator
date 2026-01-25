import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export interface SignedUrlOptions {
  bucket: string;
  objectPath: string;
  action: "read" | "write";
  expiresInSeconds?: number;
}

/**
 * Generate a signed URL for reading an object. Uses the default service account
 * or GOOGLE_APPLICATION_CREDENTIALS. For Cloud Run, the workload identity
 * must have iam.serviceAccounts.signBlob or the bucket use signed URLs v4.
 */
export async function getSignedUrl(options: SignedUrlOptions): Promise<string> {
  const { bucket, objectPath, action, expiresInSeconds = 3600 } = options;
  const [url] = await storage
    .bucket(bucket)
    .file(objectPath)
    .getSignedUrl({
      version: "v4",
      action: action === "read" ? "read" : "write",
      expires: Date.now() + expiresInSeconds * 1000,
    });
  return url;
}

/** Get signed URL for artifact (jar) download. Short TTL as per requirement. */
export async function getArtifactDownloadUrl(
  bucket: string,
  objectPath: string,
  ttlSeconds = 300
): Promise<string> {
  return getSignedUrl({ bucket, objectPath, action: "read", expiresInSeconds: ttlSeconds });
}

/** Get signed URL for log download. */
export async function getLogDownloadUrl(
  bucket: string,
  objectPath: string,
  ttlSeconds = 3600
): Promise<string> {
  return getSignedUrl({ bucket, objectPath, action: "read", expiresInSeconds: ttlSeconds });
}

import { GoogleAuth } from "google-auth-library";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT;
const region = process.env.CLOUD_RUN_REGION ?? "us-central1";
const builderJobName = process.env.BUILDER_JOB_NAME ?? "mod-builder";

/**
 * Trigger the Cloud Run Builder Job for the given job ID via REST API.
 * The Builder container receives JOB_ID in its environment.
 */
export async function triggerBuilderJob(jobId: string): Promise<void> {
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT or GCP_PROJECT must be set");
  }
  const name = `projects/${projectId}/locations/${region}/jobs/${builderJobName}`;
  const url = `https://run.googleapis.com/v2/${name}:run`;
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Failed to get access token for Cloud Run");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      overrides: {
        containerOverrides: [{ env: [{ name: "JOB_ID", value: jobId }] }],
        taskCount: 1,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud Run job trigger failed: ${res.status} ${text}`);
  }
}

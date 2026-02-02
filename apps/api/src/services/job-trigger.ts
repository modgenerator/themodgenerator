import { GoogleAuth } from "google-auth-library";

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT;
const region = process.env.CLOUD_RUN_REGION ?? "us-central1";
const builderJobName = process.env.BUILDER_JOB_NAME ?? "mod-builder";

/**
 * Trigger the Cloud Run Builder Job for the given job ID via REST API.
 * The Builder container receives JOB_ID and MODE in its environment.
 */
export async function triggerBuilderJob(jobId: string, mode: string = "test"): Promise<void> {
  if (!projectId) {
    const error = new Error("GOOGLE_CLOUD_PROJECT or GCP_PROJECT must be set");
    console.error("[JOB-TRIGGER] Missing project ID:", error);
    throw error;
  }
  
  const name = `projects/${projectId}/locations/${region}/jobs/${builderJobName}`;
  const url = `https://run.googleapis.com/v2/${name}:run`;
  
  console.log(`[JOB-TRIGGER] buildId=${jobId} triggering job: ${name}`);
  console.log(`[JOB-TRIGGER] buildId=${jobId} URL: ${url} mode=${mode}`);
  
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    console.log(`[JOB-TRIGGER] Got auth client`);
    
    const token = await client.getAccessToken();
    if (!token.token) {
      const error = new Error("Failed to get access token for Cloud Run");
      console.error("[JOB-TRIGGER] Access token error:", error);
      throw error;
    }
    console.log(`[JOB-TRIGGER] Got access token (length: ${token.token.length})`);
    
    const requestBody = {
      overrides: {
        containerOverrides: [{
          env: [
            { name: "JOB_ID", value: jobId },
            { name: "MODE", value: mode },
          ],
        }],
        taskCount: 1,
      },
    };
    console.log(`[JOB-TRIGGER] Request body:`, JSON.stringify(requestBody, null, 2));
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`[JOB-TRIGGER] buildId=${jobId} response status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`Cloud Run job trigger failed: ${res.status} ${text}`);
      console.error(`[JOB-TRIGGER] buildId=${jobId} API error:`, text);
      throw error;
    }
    
    const responseText = await res.text();
    console.log(`[JOB-TRIGGER] buildId=${jobId} job triggered successfully`);
  } catch (err) {
    console.error(`[JOB-TRIGGER] buildId=${jobId} exception:`, err);
    if (err instanceof Error) {
      console.error(`[JOB-TRIGGER] Exception stack:`, err.stack);
    }
    throw err;
  }
}

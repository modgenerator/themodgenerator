#!/usr/bin/env bash
# Grant IAM roles to modgen API and Builder service accounts.
# Usage: GCP_PROJECT_ID=myproject GCS_BUCKET=myproject-modgen-artifacts ./sa-roles.sh
set -e
PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?set GCS_BUCKET}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

API_SA="modgen-api@${PROJECT_ID}.iam.gserviceaccount.com"
BUILDER_SA="modgen-builder@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Granting API SA permission to invoke Builder Job..."
gcloud run jobs add-iam-policy-binding mod-builder \
  --region="$REGION" --member="serviceAccount:${API_SA}" --role="roles/run.invoker" --project="$PROJECT_ID" --quiet

echo "Granting API SA access to database-url secret..."
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${API_SA}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID" --quiet

echo "Granting API SA objectViewer on GCS bucket (for signed URLs)..."
gsutil iam ch "serviceAccount:${API_SA}:objectViewer" "gs://${BUCKET}"

echo "Granting Builder SA access to database-url secret..."
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${BUILDER_SA}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID" --quiet

echo "Granting Builder SA objectAdmin on GCS bucket..."
gsutil iam ch "serviceAccount:${BUILDER_SA}:objectAdmin" "gs://${BUCKET}"

echo "Done."

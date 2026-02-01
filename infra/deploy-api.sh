#!/usr/bin/env bash
# DEPRECATED: Canonical deploy is Cloud Build (repo root cloudbuild.yaml).
# Cloud Run must be updated ONLY via: cloudbuild.yaml → docker build → gcloud run deploy.
# This script deploys an EXISTING image only; it does not build. Use only for
# one-off rollbacks or when you have already built/pushed an image elsewhere.
#
# Deploy API Cloud Run service. Image must already be built and pushed.
# Usage: GCP_PROJECT_ID=myproject GCS_BUCKET=myproject-modgen-artifacts ./deploy-api.sh
set -e
PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?set GCS_BUCKET}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
IMAGE="${API_IMAGE:-us-central1-docker.pkg.dev/${PROJECT_ID}/themodgenerator/api:latest}"

gcloud run deploy modgen-api \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --set-env-vars="GCS_BUCKET=${BUCKET},GCP_PROJECT=${PROJECT_ID},CLOUD_RUN_REGION=${REGION},BUILDER_JOB_NAME=mod-builder" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --service-account="modgen-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --project="$PROJECT_ID"

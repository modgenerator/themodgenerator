#!/usr/bin/env bash
# Enable required GCP APIs.
# Usage: GCP_PROJECT_ID=myproject ./gcp-apis.sh
set -e
PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"

echo "APIs enabled."

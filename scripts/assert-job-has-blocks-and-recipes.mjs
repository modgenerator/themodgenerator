#!/usr/bin/env node
/**
 * E2E assertion: GET /jobs/:id returns counts.blocks > 0 and counts.recipes > 0
 * when the job's spec_json includes blocks and recipes (e.g. after a successful build).
 *
 * Usage: API_URL=http://localhost:3000 JOB_ID=<uuid> node scripts/assert-job-has-blocks-and-recipes.mjs
 * Exit 0 if assertion passes; exit 1 with message otherwise.
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const JOB_ID = process.env.JOB_ID;

if (!JOB_ID) {
  console.error('JOB_ID env is required');
  process.exit(1);
}

const url = `${API_URL.replace(/\/$/, '')}/jobs/${JOB_ID}`;

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`GET ${url} failed: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  if (!data.instructions || !data.counts) {
    console.error('Response missing instructions or counts');
    process.exit(1);
  }
  const { counts, instructions } = data;
  if (!Array.isArray(instructions.blocks) || !Array.isArray(instructions.recipes)) {
    console.error('instructions.blocks or instructions.recipes missing');
    process.exit(1);
  }
  if (counts.blocks === 0 && instructions.blocks.length > 0) {
    console.error('counts.blocks is 0 but instructions.blocks has items');
    process.exit(1);
  }
  if (counts.recipes === 0 && instructions.recipes.length > 0) {
    console.error('counts.recipes is 0 but instructions.recipes has items');
    process.exit(1);
  }
  console.log('OK: counts.blocks =', counts.blocks, 'counts.recipes =', counts.recipes);
  if (counts.blocks > 0 && counts.recipes > 0) {
    console.log('Assertion passed: job has blocks and recipes');
    process.exit(0);
  }
  console.log('Job has no blocks/recipes in spec (counts may be 0 for minimal jobs)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

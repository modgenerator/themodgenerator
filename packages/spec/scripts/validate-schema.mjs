#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'src', 'schema.json');

try {
  const content = readFileSync(schemaPath, 'utf8');
  JSON.parse(content);
  console.log('✓ schema.json is valid JSON');
} catch (err) {
  console.error('✗ schema.json is invalid JSON:', err.message);
  process.exit(1);
}

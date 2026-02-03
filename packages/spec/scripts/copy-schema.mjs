import { copyFileSync } from 'node:fs';
copyFileSync('src/schema.json', 'dist/schema.json');
copyFileSync('src/modspec-v2-schema.json', 'dist/modspec-v2-schema.json');
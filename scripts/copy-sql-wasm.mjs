import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetDir = join(root, '..', 'public', 'sql');
const target = join(targetDir, 'sql-wasm.wasm');

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);

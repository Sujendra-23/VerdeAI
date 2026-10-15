import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = path.join(root, 'dist', 'azure');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  entryPoints: [path.join(root, 'apps/api/src/index.ts')],
  outfile: path.join(output, 'server.cjs'),
  bundle: true, packages: 'external', platform: 'node', format: 'cjs', target: 'node22',
  alias: { '@verdeai/shared-types': path.join(root, 'packages/shared-types/src/index.ts') },
  logLevel: 'info',
});
const source = JSON.parse(await readFile(path.join(root, 'apps/api/package.json'), 'utf8'));
const dependencies = Object.fromEntries(Object.entries(source.dependencies).filter(([name]) => !name.startsWith('@verdeai/')));
await writeFile(path.join(output, 'package.json'), JSON.stringify({
  name: 'verdeai-deployment', version: source.version, private: true,
  engines: { node: '>=22' }, scripts: { start: 'node server.cjs' }, dependencies,
}, null, 2) + '\n');
// This isolated staging directory contains only compiled code, public assets,
// and runtime dependencies. No source .env files or account credentials are copied.
execFileSync('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: output, stdio: 'inherit' });
await cp(path.join(root, 'apps/web/dist'), path.join(output, 'public'), { recursive: true });
const archive = path.join(root, 'dist', 'verdeai-azure.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: output, stdio: 'inherit' });
console.log(`Deployment package: ${archive}`);

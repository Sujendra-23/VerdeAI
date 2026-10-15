import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const group = process.env.VERDEAI_AZURE_GROUP || 'verdeai-web-mobile';
const plan = process.env.VERDEAI_AZURE_PLAN || 'verdeai-free-linux';
const location = process.env.VERDEAI_AZURE_LOCATION || 'westus2';
function az(args, json = false) {
  const result = execFileSync('az', [...args, '--only-show-errors', '--output', json ? 'json' : 'none'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return json ? JSON.parse(result) : undefined;
}
function npm(args, env = process.env) {
  execFileSync('npm', args, { cwd: root, env, stdio: 'inherit' });
}
const account = az(['account', 'show'], true);
const app = process.env.VERDEAI_AZURE_APP || `verdeai-api-${account.id.split('-')[0]}`;
// Check live authentication before creating anything. Cached account metadata
// alone is not evidence that the Azure session is still valid.
const groupExists = az(['group', 'exists', '--name', group], true);
if (!groupExists) az(['group', 'create', '--name', group, '--location', location]);
const plans = az(['appservice', 'plan', 'list', '--resource-group', group], true);
const existingPlan = plans.find((item) => item.name === plan);
if (existingPlan && (existingPlan.sku.name !== 'F1' || !existingPlan.reserved)) {
  throw new Error('The named plan is not Linux F1. Refusing to modify an existing paid or Windows plan.');
}
if (!existingPlan) az(['appservice', 'plan', 'create', '--name', plan, '--resource-group', group, '--location', location, '--sku', 'F1', '--is-linux']);
const apps = az(['webapp', 'list', '--resource-group', group], true);
const existingApp = apps.find((item) => item.name === app);
if (existingApp && !existingApp.serverFarmId.toLowerCase().endsWith(`/serverfarms/${plan.toLowerCase()}`)) {
  throw new Error('The named app belongs to a different plan. Refusing to replace it.');
}
if (!existingApp) az(['webapp', 'create', '--name', app, '--resource-group', group, '--plan', plan, '--runtime', 'NODE:22-lts', '--https-only', 'true', '--basic-auth', 'Disabled']);
az(['webapp', 'update', '--name', app, '--resource-group', group, '--https-only', 'true']);
az(['webapp', 'config', 'set', '--name', app, '--resource-group', group, '--startup-file', 'node /home/site/wwwroot/server.cjs', '--always-on', 'false', '--min-tls-version', '1.2']);
az(['webapp', 'config', 'appsettings', 'set', '--name', app, '--resource-group', group, '--settings', 'WEBSITE_RUN_FROM_PACKAGE=1', 'SCM_DO_BUILD_DURING_DEPLOYMENT=false', 'NODE_ENV=production', 'STATIC_DIR=/home/site/wwwroot/public']);
const host = az(['webapp', 'show', '--name', app, '--resource-group', group], true).defaultHostName;
const apiUrl = `https://${host}`;
const buildEnv = { ...process.env, VITE_API_URL: apiUrl };
npm(['run', 'build', '-w', 'apps/web'], buildEnv);
npm(['run', 'package:azure', '-w', 'apps/api']);
az(['webapp', 'deploy', '--name', app, '--resource-group', group, '--src-path', path.join(root, 'dist/verdeai-azure.zip'), '--type', 'zip', '--timeout', '600000']);
let healthy = false;
for (let attempt = 0; attempt < 24; attempt++) {
  try {
    const response = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (response.ok && (await response.json()).status === 'ok') { healthy = true; break; }
  } catch { /* Cold start or deployment still restarting. */ }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!healthy) throw new Error(`Deployment was submitted but health is not verified: ${apiUrl}/api/health. Client URLs have not been changed.`);
async function setClientUrl(relativePath) {
  const filename = path.join(root, relativePath);
  let contents = '';
  try { contents = await readFile(filename, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const setting = `VITE_API_URL=${apiUrl}`;
  contents = /^VITE_API_URL=.*$/m.test(contents)
    ? contents.replace(/^VITE_API_URL=.*$/m, setting)
    : `${contents}${contents && !contents.endsWith('\n') ? '\n' : ''}${setting}\n`;
  await writeFile(filename, contents);
}
await setClientUrl('apps/web/.env.production.local');
await writeFile(path.join(root, 'packages/mobile-core/config.json'), JSON.stringify({ apiUrl }, null, 2) + '\n');
npm(['run', 'mobile:resources']);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/azure-deployment.json'), JSON.stringify({ app, group, plan, apiUrl }, null, 2) + '\n');
console.log(`Verified web and API address: ${apiUrl}`);

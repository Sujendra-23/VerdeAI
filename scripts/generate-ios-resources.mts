import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { messages } from '../packages/mobile-core/src/messages';
import { createMobileClient } from '../packages/mobile-core/src/client';

const root = new URL('../', import.meta.url);
const resources = new URL('apps/ios/VerdeAI/Resources/', root);
const configuration = await readFile(new URL('packages/mobile-core/config.json', root), 'utf8');
createMobileClient(JSON.parse(configuration).apiUrl);
await mkdir(resources, { recursive: true });
await writeFile(new URL('messages.json', resources), JSON.stringify(messages, null, 2) + '\n');
await writeFile(new URL('config.json', resources), configuration);
console.log(`Updated SwiftUI resources in ${fileURLToPath(resources)}`);

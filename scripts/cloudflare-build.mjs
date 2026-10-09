// Cloudflare deploy: nest the static build under /blog so files match the URLs
// (dashcloud.in/blog/...) and drop the staging-only admin page.
import { cpSync, mkdirSync, readdirSync, rmSync, renameSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = 'cf-dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'blog'), { recursive: true });
for (const name of readdirSync(dist)) {
  if (name === 'admin') continue; // admin lives on the staging server only
  cpSync(join(dist, name), join(out, 'blog', name), { recursive: true });
}
writeFileSync(join(out, '.assetsignore'), '_worker.js\n');
console.log('cloudflare output ready in', out);

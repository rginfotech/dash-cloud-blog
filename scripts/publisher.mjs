// Watches the repo for content changes made by the admin (Decap), then builds,
// swaps the live site, and commits to git. Zero dependencies.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.BLOG_ROOT ?? '/opt/dashcloud-blog';
const REPO = join(ROOT, 'repo');
const BUILDS = join(ROOT, 'builds');
const CURRENT = join(ROOT, 'current');
const STATUS = join(ROOT, 'logs', 'status.json');
const WATCH = ['src/content/blog', 'src/data', 'public/images/posts'];
const TICK_MS = 5000;

mkdirSync(BUILDS, { recursive: true });
mkdirSync(join(ROOT, 'logs'), { recursive: true });

const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' });
const log = (...a) => console.log(new Date().toISOString(), ...a);
const setStatus = (s) => writeFileSync(STATUS, JSON.stringify({ at: new Date().toISOString(), ...s }, null, 2));

function pending() {
  return git('status', '--porcelain', '--', ...WATCH).trim();
}

function describe(porcelain) {
  const names = porcelain.split('\n').map((l) => l.slice(3).replace(/^.*\//, '').replace(/"/g, '')).filter(Boolean);
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} +${names.length - 3} more` : shown;
}

function build() {
  rmSync(join(REPO, 'dist'), { recursive: true, force: true });
  const r = spawnSync('nice', ['-n', '10', join(REPO, 'node_modules/.bin/astro'), 'build'], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--max-old-space-size=1024' },
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'build failed').split('\n').filter(Boolean).slice(-12).join('\n'));
  const dir = join(BUILDS, String(Date.now()));
  renameSync(join(REPO, 'dist'), dir);
  return dir;
}

function swap(dir) {
  const tmp = CURRENT + '.tmp';
  rmSync(tmp, { force: true });
  symlinkSync(dir, tmp);
  renameSync(tmp, CURRENT);
  const old = readdirSync(BUILDS).sort().slice(0, -3);
  for (const o of old) rmSync(join(BUILDS, o), { recursive: true, force: true });
}

function publish(summary) {
  log('building…', summary);
  setStatus({ state: 'building', summary });
  try {
    const dir = build();
    swap(dir);
    const msg = summary ? `content: ${summary}` : 'content: update via admin';
    if (pending()) { git('add', '-A', '--', ...WATCH); git('commit', '-q', '-m', msg); }
    log('published', dir);
    setStatus({ state: 'live', summary, commit: git('rev-parse', '--short', 'HEAD').trim() });
    return true;
  } catch (e) {
    log('BUILD FAILED', e.message);
    setStatus({ state: 'error', summary, error: e.message });
    return false;
  }
}

let lastSig = null, stable = 0, failedSig = null;
if (!existsSync(CURRENT)) publish('initial build');

setInterval(() => {
  try {
    const sig = pending();
    if (!sig) { lastSig = null; stable = 0; return; }
    const stamp = sig + WATCH.map((p) => { try { return statSync(join(REPO, p)).mtimeMs; } catch { return 0; } }).join();
    if (stamp !== lastSig) { lastSig = stamp; stable = 0; return; }
    if (++stable < 2 || stamp === failedSig) return;
    if (!publish(describe(sig))) failedSig = stamp;
    lastSig = null; stable = 0;
  } catch (e) { log('tick error', e.message); }
}, TICK_MS);
log('publisher watching', REPO);

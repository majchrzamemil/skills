import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { delimiter, join } from 'node:path';

export function die(msg, code = 1) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

export function log(msg) {
  process.stdout.write(`${msg}\n`);
}

export function warn(msg) {
  process.stderr.write(`warning: ${msg}\n`);
}

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          flags[a.slice(2)] = true;
        } else {
          flags[a.slice(2)] = next;
          i++;
        }
      }
    } else {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

export function which(bin) {
  if (!bin) return null;
  if (bin.includes('/') || bin.includes('\\')) return existsSync(bin) ? bin : null;
  const paths = (process.env.PATH || '').split(delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const p of paths) {
    for (const ext of exts) {
      const full = join(p, bin + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return {
    code: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error,
  };
}

export function md5(buf) {
  return createHash('md5').update(buf).digest('hex');
}

export function uuid() {
  return randomUUID();
}

export function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2));
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

export function bytes(n) {
  if (!Number.isFinite(n)) return '?';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

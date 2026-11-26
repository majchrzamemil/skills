#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs, die, log, md5, bytes } from './lib/util.mjs';

function base(flags) {
  const ip = flags.ip || flags.host;
  if (!ip) die('missing --ip <printer-ip>');
  const port = flags.port || '80';
  return `http://${ip}:${port}`;
}

function headers(flags) {
  const h = {};
  const key = flags.key || process.env.MOONRAKER_API_KEY;
  if (key) h['X-Api-Key'] = key;
  return h;
}

async function json(method, url, flags, body) {
  const res = await fetch(url, { method, headers: headers(flags), body });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: parsed };
}

async function cmdStatus(flags) {
  const root = base(flags);
  const objects = ['print_stats', 'heater_bed', 'extruder', 'toolhead', 'virtual_sdcard'];
  const q = objects.map((o) => o).join('&');
  const r = await json('GET', `${root}/printer/objects/query?${q}`, flags);
  const st = r.body.result && r.body.result.status ? r.body.result.status : {};
  log(JSON.stringify({
    server: root,
    http_status: r.status,
    state: st.print_stats ? {
      state: st.print_stats.state,
      filename: st.print_stats.filename,
      progress: st.virtual_sdcard ? st.virtual_sdcard.progress : undefined,
    } : undefined,
    extruder: st.extruder ? { temp: st.extruder.temperature, target: st.extruder.target } : undefined,
    bed: st.heater_bed ? { temp: st.heater_bed.temperature, target: st.heater_bed.target } : undefined,
    position: st.toolhead ? st.toolhead.position : undefined,
    raw: r.ok ? undefined : r.body,
  }, null, 2));
}

async function cmdFiles(flags) {
  const root = base(flags);
  const r = await json('GET', `${root}/server/files/list?root=gcodes`, flags);
  log(JSON.stringify({ server: root, http_status: r.status, files: r.body.result || r.body }, null, 2));
}

async function cmdUpload(flags, positionals) {
  const root = base(flags);
  const file = positionals[0] || flags.file;
  if (!file) die('usage: moonraker.mjs upload --ip <ip> <file.gcode> [--print]');
  if (!existsSync(file)) die(`no such file: ${file}`);
  const buf = readFileSync(file);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/octet-stream' }), basename(file));
  if (flags.print) form.append('print', 'true');
  if (flags.path) form.append('path', flags.path);
  const r = await json('POST', `${root}/server/files/upload`, flags, form);
  log(JSON.stringify({ server: root, file: basename(file), size: bytes(buf.length), http_status: r.status, ok: r.ok, response: r.body }, null, 2));
  if (!r.ok) process.exit(1);
}

async function cmdPrint(flags, positionals) {
  const root = base(flags);
  const file = flags.file || positionals[0];
  if (!file) die('usage: moonraker.mjs print --ip <ip> --file <name.gcode>');
  const r = await json('POST', `${root}/printer/print/start?filename=${encodeURIComponent(file)}`, flags);
  log(JSON.stringify({ server: root, action: 'start', file, http_status: r.status, ok: r.ok, response: r.body }, null, 2));
  if (!r.ok) process.exit(1);
}

async function cmdControl(flags, endpoint, label) {
  const root = base(flags);
  const r = await json('POST', `${root}/printer/print/${endpoint}`, flags);
  log(JSON.stringify({ server: root, action: label, http_status: r.status, ok: r.ok, response: r.body }, null, 2));
  if (!r.ok) process.exit(1);
}

function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const cmd = positionals.shift();
  const run = async () => {
    switch (cmd) {
      case 'status': return cmdStatus(flags);
      case 'files': return cmdFiles(flags);
      case 'upload': return cmdUpload(flags, positionals);
      case 'print': return cmdPrint(flags, positionals);
      case 'pause': return cmdControl(flags, 'pause', 'pause');
      case 'resume': return cmdControl(flags, 'resume', 'resume');
      case 'stop': return cmdControl(flags, 'cancel', 'cancel');
      default:
        die('usage: moonraker.mjs <status|files|upload|print|pause|resume|stop> [--ip <ip>]');
    }
  };
  run().catch((e) => die(e.message || String(e)));
}

main();

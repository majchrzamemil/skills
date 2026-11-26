#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdtempSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { parseArgs, die, log, warn, which, run, ensureDir } from './lib/util.mjs';

const VIEWS = {
  iso: { rot: '55,0,25', proj: 'p' },
  top: { rot: '0,0,0', proj: 'o' },
  front: { rot: '90,0,0', proj: 'o' },
  right: { rot: '90,0,90', proj: 'o' },
};

function bin(flag) {
  const b = flag || process.env.OPENSCAD || which('openscad') || which('openscad-nightly');
  if (!b) {
    die('OpenSCAD not found. Install it (https://openscad.org) or set OPENSCAD=/path/to/openscad.');
  }
  return b;
}

function defines(flags) {
  const out = [];
  const raw = flags.D || flags.define;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const d of list) out.push('-D', d);
  return out;
}

function runOpenscad(binary, args) {
  const res = run(binary, args);
  const combined = `${res.stdout}\n${res.stderr}`;
  const problems = combined
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(ERROR|WARNING)/i.test(l));
  return { res, problems };
}

function stlInfo(path) {
  const buf = readFileSync(path);
  const head = buf.toString('utf8', 0, Math.min(1024, buf.length));
  const isAscii = /^solid/i.test(buf.toString('utf8', 0, 5)) && /facet/i.test(head);
  let tris = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const bump = (i, v) => {
    if (v < min[i]) min[i] = v;
    if (v > max[i]) max[i] = v;
  };
  if (isAscii) {
    const text = buf.toString('utf8');
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m;
    let verts = 0;
    while ((m = re.exec(text))) {
      verts++;
      bump(0, parseFloat(m[1]));
      bump(1, parseFloat(m[2]));
      bump(2, parseFloat(m[3]));
    }
    tris = Math.floor(verts / 3);
  } else {
    if (buf.length < 84) die(`${path} is not a valid STL`);
    tris = buf.readUInt32LE(80);
    let off = 84;
    for (let t = 0; t < tris && off + 50 <= buf.length; t++) {
      off += 12;
      for (let v = 0; v < 3; v++) {
        for (let i = 0; i < 3; i++) {
          bump(i, buf.readFloatLE(off));
          off += 4;
        }
      }
      off += 2;
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    file: path,
    encoding: isAscii ? 'ascii' : 'binary',
    triangles: tris,
    bbox: { min: min.map(r3), max: max.map(r3), size: size.map(r3) },
  };
}

function cmdRender(flags, positionals) {
  const file = positionals[0];
  if (!file) die('usage: openscad.mjs render <model.scad> [--out out.stl] [-D name=value]');
  if (!existsSync(file)) die(`no such file: ${file}`);
  const out = resolve(flags.out || basename(file).replace(/\.scad$/i, '') + '.stl');
  const args = ['-o', out, ...defines(flags)];
  if (flags.strict) args.push('--hardwarnings');
  args.push(resolve(file));
  const { res, problems } = runOpenscad(bin(flags.openscad), args);
  if (res.error) die(`could not run OpenSCAD: ${res.error.message}`);
  if (res.code !== 0 || !existsSync(out)) {
    log(JSON.stringify({ ok: false, exit: res.code, problems }, null, 2));
    die('OpenSCAD failed to render (see problems above)');
  }
  const info = stlInfo(out);
  log(JSON.stringify({ ok: true, stl: out, ...info, problems }, null, 2));
}

function cmdPreview(flags, positionals) {
  const file = positionals[0];
  if (!file) die('usage: openscad.mjs preview <model.scad> [--outdir dir] [--views iso,top,front,right] [--size 1024x768]');
  if (!existsSync(file)) die(`no such file: ${file}`);
  const outdir = resolve(flags.outdir || 'preview');
  ensureDir(outdir);
  const size = flags.size || '1024x768';
  const names = (flags.views ? String(flags.views).split(',') : Object.keys(VIEWS)).filter((v) => VIEWS[v]);
  const rendered = [];
  for (const name of names) {
    const { rot, proj } = VIEWS[name];
    const out = join(outdir, `${basename(file).replace(/\.scad$/i, '')}-${name}.png`);
    const args = [
      '-o', out,
      '--imgsize', size,
      '--camera', `0,0,0,${rot},0`,
      '--viewall', '--autocenter',
      '--projection', proj,
      ...defines(flags),
      resolve(file),
    ];
    const { res, problems } = runOpenscad(bin(flags.openscad), args);
    rendered.push({ view: name, png: existsSync(out) ? out : null, exit: res.code, problems });
  }
  log(JSON.stringify({ ok: rendered.every((r) => r.png), outdir, rendered }, null, 2));
}

function cmdSection(flags, positionals) {
  const file = positionals[0];
  if (!file) die('usage: openscad.mjs section <model.scad> [--outdir dir] [--axis z|y|x] [--size 1024x768]');
  if (!existsSync(file)) die(`no such file: ${file}`);
  const outdir = resolve(flags.outdir || 'preview');
  ensureDir(outdir);
  const tmp = mkdtempSync(join(tmpdir(), '3dp-section-'));
  const stl = join(tmp, 'model.stl');
  const r = run(bin(flags.openscad), ['-o', stl, ...defines(flags), resolve(file)]);
  if (r.code !== 0 || !existsSync(stl)) die('render failed before sectioning');
  const info = stlInfo(stl);
  const axis = flags.axis || 'z';
  const idx = { x: 0, y: 1, z: 2 }[axis];
  const cut = info.bbox.min[idx] + info.bbox.size[idx] / 2;
  const big = 5000;
  const wrapper = join(tmp, 'section.scad');
  const stlEsc = stl.replace(/\\/g, '/');
  let cutExpr;
  if (axis === 'z') cutExpr = `translate([${-big},${-big},${-big}]) cube([${2 * big},${2 * big},${cut + big}]);`;
  else if (axis === 'y') cutExpr = `translate([${-big},${-big},${-big}]) cube([${2 * big},${cut + big},${2 * big}]);`;
  else cutExpr = `translate([${-big},${-big},${-big}]) cube([${cut + big},${2 * big},${2 * big}]);`;
  writeFileSync(wrapper, `difference() {\n  import("${stlEsc}");\n  ${cutExpr}\n}\n`);
  const out = join(outdir, `${basename(file).replace(/\.scad$/i, '')}-section-${axis}.png`);
  const args = [
    '-o', out,
    '--imgsize', flags.size || '1024x768',
    '--camera', '0,0,0,55,0,25,0',
    '--viewall', '--autocenter',
    '--projection', 'p',
    wrapper,
  ];
  const { res, problems } = runOpenscad(bin(flags.openscad), args);
  log(JSON.stringify({ ok: existsSync(out), png: existsSync(out) ? out : null, axis, cut, exit: res.code, problems }, null, 2));
}

function cmdInfo(flags, positionals) {
  const file = positionals[0];
  if (!file) die('usage: openscad.mjs info <model.stl|model.scad>');
  if (!existsSync(file)) die(`no such file: ${file}`);
  if (/\.scad$/i.test(file)) {
    const tmp = mkdtempSync(join(tmpdir(), '3dp-info-'));
    const stl = join(tmp, 'model.stl');
    const r = run(bin(flags.openscad), ['-o', stl, ...defines(flags), resolve(file)]);
    if (r.code !== 0 || !existsSync(stl)) die('OpenSCAD could not render the model for inspection');
    log(JSON.stringify(stlInfo(stl), null, 2));
    return;
  }
  log(JSON.stringify(stlInfo(file), null, 2));
}

function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const cmd = positionals.shift();
  switch (cmd) {
    case 'render': return cmdRender(flags, positionals);
    case 'preview': return cmdPreview(flags, positionals);
    case 'section': return cmdSection(flags, positionals);
    case 'info': return cmdInfo(flags, positionals);
    default:
      die('usage: openscad.mjs <render|preview|section|info> ...');
  }
}

main();

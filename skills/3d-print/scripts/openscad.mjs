#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { parseArgs, die, log, which, run, ensureDir } from './lib/util.mjs';

const VIEWS = {
  iso: { rot: '55,0,25', proj: 'p' },
  top: { rot: '0,0,0', proj: 'o' },
  front: { rot: '90,0,0', proj: 'o' },
  right: { rot: '90,0,90', proj: 'o' },
};

// Rows of a multmatrix that move the cut plane to z = 0 and keep the two in-plane model
// axes as image X and Y, so the scale ticks read in model coordinates.
const SECTIONS = {
  x: { idx: 0, rows: (at) => [[0, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, -at]], plane: 'y,z' },
  y: { idx: 1, rows: (at) => [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, -at]], plane: 'x,z' },
  z: { idx: 2, rows: (at) => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, -at]], plane: 'x,y' },
};

const USAGE = `usage: openscad.mjs <command> ...
  render  <model.scad> [--out out.stl] [--strict] [-D name=value ...]
  preview <model.scad> [--outdir dir] [--views iso,top,front,right] [--size 1024,768]
  section <model.scad|stl> [--axis x|y|z] [--at mm] [--outdir dir]
  info    <model.scad|stl>
  check   <model.scad|stl> [--min-wall 0.8] [--overhang 45] [--bed X,Y,Z] [--margin 5]
  fit     <a.scad|stl> <b.scad|stl> [--clearance 0.2] [--define-a k=v] [--define-b k=v]
-D name=value (repeatable) applies to every command that renders a .scad.`;

let openscadCache;
function openscad(flags) {
  if (openscadCache) return openscadCache;
  const binary = flags.openscad || process.env.OPENSCAD || which('openscad') || which('openscad-nightly');
  if (!binary) die('OpenSCAD not found. Install it (https://openscad.org) or set OPENSCAD=/path/to/openscad.');
  const help = run(binary, ['--help']);
  const hasManifold = /manifold/i.test(`${help.stdout}${help.stderr}`);
  openscadCache = { binary, base: hasManifold ? ['--backend=Manifold'] : [] };
  return openscadCache;
}

function runOpenscad(flags, args) {
  const { binary, base } = openscad(flags);
  const res = run(binary, [...base, ...args]);
  if (res.error) die(`could not run OpenSCAD: ${res.error.message}`);
  const lines = `${res.stdout}\n${res.stderr}`.split('\n').map((l) => l.trim());
  const problems = lines.filter((l) => /^(ERROR|WARNING)/i.test(l));
  if (res.code !== 0 && !problems.length) problems.push(...res.stderr.split('\n').map((l) => l.trim()).filter(Boolean));
  const missingLib = lines.join('\n').match(/Can't (?:open library|find include file) '([^']+)'/i);
  if (missingLib) problems.push(`hint: library file ${missingLib[1]} is not installed; BOSL2 install steps are in references/requirements.md`);
  return { res, problems };
}

function toStl(flags, file, defines) {
  if (!existsSync(file)) die(`no such file: ${file}`);
  if (/\.stl$/i.test(file)) return resolve(file);
  const out = join(mkdtempSync(join(tmpdir(), '3dp-')), 'model.stl');
  const { res, problems } = runOpenscad(flags, ['-o', out, ...defines, resolve(file)]);
  if (res.code !== 0 || !existsSync(out)) die(`OpenSCAD could not render ${file}: ${problems.join(' | ')}`);
  return out;
}

function readStl(path) {
  const buf = readFileSync(path);
  if (buf.length >= 84 && buf.length === 84 + 50 * buf.readUInt32LE(80)) {
    const count = buf.readUInt32LE(80);
    const v = new Float64Array(count * 9);
    for (let t = 0; t < count; t++) {
      for (let k = 0; k < 9; k++) v[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
    }
    return { encoding: 'binary', v };
  }
  const text = buf.toString('utf8');
  if (!/^\s*solid/i.test(text)) die(`${path} is not a valid STL`);
  const nums = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) nums.push(+m[1], +m[2], +m[3]);
  return { encoding: 'ascii', v: Float64Array.from(nums.slice(0, nums.length - (nums.length % 9))) };
}

const r3 = (x) => Math.round(x * 1000) / 1000;
const r3all = (a) => a.map(r3);

function bboxOf(v) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], v[i + a]);
      max[a] = Math.max(max[a], v[i + a]);
    }
  }
  return { min, max, size: [0, 1, 2].map((a) => max[a] - min[a]) };
}

function stlInfo(path) {
  const { encoding, v } = readStl(path);
  const box = bboxOf(v);
  return {
    file: path,
    encoding,
    triangles: v.length / 9,
    bbox: { min: r3all(box.min), max: r3all(box.max), size: r3all(box.size) },
  };
}

function faceNormals(v) {
  const count = v.length / 9;
  const normals = new Float64Array(count * 3);
  const areas = new Float64Array(count);
  for (let t = 0; t < count; t++) {
    const o = t * 9;
    const ux = v[o + 3] - v[o], uy = v[o + 4] - v[o + 1], uz = v[o + 5] - v[o + 2];
    const wx = v[o + 6] - v[o], wy = v[o + 7] - v[o + 1], wz = v[o + 8] - v[o + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    const len = Math.hypot(cx, cy, cz);
    areas[t] = len / 2;
    if (len > 0) normals.set([cx / len, cy / len, cz / len], t * 3);
  }
  return { normals, areas };
}

function weldVertices(v) {
  const ids = new Map();
  const idx = new Uint32Array(v.length / 3);
  for (let i = 0; i < idx.length; i++) {
    const key = `${v[i * 3].toFixed(4)},${v[i * 3 + 1].toFixed(4)},${v[i * 3 + 2].toFixed(4)}`;
    if (!ids.has(key)) ids.set(key, ids.size);
    idx[i] = ids.get(key);
  }
  return { idx, vertexCount: ids.size };
}

// A closed, consistently wound solid uses every directed edge once and its reverse once.
function edgeDefects(idx) {
  const directed = new Map();
  for (let t = 0; t < idx.length / 3; t++) {
    for (let e = 0; e < 3; e++) {
      const a = idx[t * 3 + e], b = idx[t * 3 + ((e + 1) % 3)];
      if (a !== b) directed.set(`${a},${b}`, (directed.get(`${a},${b}`) || 0) + 1);
    }
  }
  let openEdges = 0, nonManifoldEdges = 0;
  for (const [key, count] of directed) {
    const [a, b] = key.split(',');
    const back = directed.get(`${b},${a}`) || 0;
    if (count > 1 || back > 1) nonManifoldEdges++;
    else if (back === 0) openEdges++;
  }
  return { openEdges, nonManifoldEdges };
}

function signedVolume(v) {
  let sum = 0;
  for (let o = 0; o < v.length; o += 9) {
    sum += v[o] * (v[o + 4] * v[o + 8] - v[o + 5] * v[o + 7])
      - v[o + 1] * (v[o + 3] * v[o + 8] - v[o + 5] * v[o + 6])
      + v[o + 2] * (v[o + 3] * v[o + 7] - v[o + 4] * v[o + 6]);
  }
  return sum / 6;
}

function overhangRegions(v, idx, vertexCount, normals, areas, bedZ, limitDeg) {
  const sinLimit = Math.sin((limitDeg * Math.PI) / 180) + 1e-3;
  const parent = Int32Array.from({ length: vertexCount }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const onBed = (o) => Math.max(v[o + 2], v[o + 5], v[o + 8]) < bedZ + 0.01;
  const overhanging = [];
  for (let t = 0; t < areas.length; t++) {
    if (-normals[t * 3 + 2] <= sinLimit || onBed(t * 9)) continue;
    overhanging.push(t);
    parent[find(idx[t * 3 + 1])] = find(idx[t * 3]);
    parent[find(idx[t * 3 + 2])] = find(idx[t * 3]);
  }
  const regions = new Map();
  for (const t of overhanging) {
    const root = find(idx[t * 3]);
    if (!regions.has(root)) regions.set(root, { area: 0, maxAngle: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    const r = regions.get(root);
    r.area += areas[t];
    r.maxAngle = Math.max(r.maxAngle, (Math.asin(Math.min(1, -normals[t * 3 + 2])) * 180) / Math.PI);
    for (let k = 0; k < 9; k++) {
      r.min[k % 3] = Math.min(r.min[k % 3], v[t * 9 + k]);
      r.max[k % 3] = Math.max(r.max[k % 3], v[t * 9 + k]);
    }
  }
  return [...regions.values()].sort((a, b) => b.area - a.area);
}

// Uniform grid of triangle indices, bucketed by each triangle's bounding box.
function buildGrid(v, cell) {
  const grid = new Map();
  for (let t = 0; t < v.length / 9; t++) {
    const lo = [0, 1, 2].map((a) => Math.floor(Math.min(v[t * 9 + a], v[t * 9 + 3 + a], v[t * 9 + 6 + a]) / cell));
    const hi = [0, 1, 2].map((a) => Math.floor(Math.max(v[t * 9 + a], v[t * 9 + 3 + a], v[t * 9 + 6 + a]) / cell));
    for (let i = lo[0]; i <= hi[0]; i++) {
      for (let j = lo[1]; j <= hi[1]; j++) {
        for (let k = lo[2]; k <= hi[2]; k++) {
          const key = `${i},${j},${k}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(t);
        }
      }
    }
  }
  return grid;
}

function trianglesNear(grid, cell, lo, hi) {
  const found = new Set();
  for (let i = Math.floor(lo[0] / cell); i <= Math.floor(hi[0] / cell); i++) {
    for (let j = Math.floor(lo[1] / cell); j <= Math.floor(hi[1] / cell); j++) {
      for (let k = Math.floor(lo[2] / cell); k <= Math.floor(hi[2] / cell); k++) {
        for (const t of grid.get(`${i},${j},${k}`) || []) found.add(t);
      }
    }
  }
  return found;
}

// Möller–Trumbore; returns the hit distance along d, or Infinity.
function rayTriangle(v, t, p, d) {
  const o = t * 9;
  const e1 = [v[o + 3] - v[o], v[o + 4] - v[o + 1], v[o + 5] - v[o + 2]];
  const e2 = [v[o + 6] - v[o], v[o + 7] - v[o + 1], v[o + 8] - v[o + 2]];
  const h = cross(d, e2);
  const a = dot(e1, h);
  if (Math.abs(a) < 1e-12) return Infinity;
  const s = [p[0] - v[o], p[1] - v[o + 1], p[2] - v[o + 2]];
  const u = dot(s, h) / a;
  if (u < 0 || u > 1) return Infinity;
  const q = cross(s, e1);
  const w = dot(d, q) / a;
  if (w < 0 || u + w > 1) return Infinity;
  const dist = dot(e2, q) / a;
  return dist > 1e-6 ? dist : Infinity;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// Area-weighted surface points: every triangle gets at least one, big ones get more.
function* surfaceSamples(v, areas, sampleArea) {
  for (let t = 0; t < areas.length; t++) {
    if (areas[t] === 0) continue;
    const count = Math.min(10000, Math.max(1, Math.round(areas[t] / sampleArea)));
    const o = t * 9;
    for (let j = 0; j < count; j++) {
      const s = Math.sqrt((j + 0.5) / count);
      const r = (j * 0.6180339887 + 0.5) % 1;
      const wa = 1 - s, wb = s * (1 - r), wc = s * r;
      const p = [0, 1, 2].map((k) => wa * v[o + k] + wb * v[o + 3 + k] + wc * v[o + 6 + k]);
      yield { t, p, weight: areas[t] / count };
    }
  }
}

function sampleAreaFor(areas, preferred) {
  const total = areas.reduce((s, a) => s + a, 0);
  return Math.max(preferred, total / 300000);
}

// Keeps the worst spots, skipping any within `spacing` mm of one already kept.
function spreadSpots(spots, spacing, limit) {
  const kept = [];
  for (const s of spots.sort((a, b) => a.value - b.value)) {
    if (kept.length >= limit) break;
    if (kept.every((k) => Math.hypot(...sub(k.p, s.p)) > spacing)) kept.push(s);
  }
  return kept.map((s) => ({ at: r3all(s.p), mm: r3(s.value) }));
}

function wallThickness(v, normals, areas, minWall) {
  const probe = minWall * 3;
  const grid = buildGrid(v, probe);
  const thin = [];
  let samples = 0, thinArea = 0;
  for (const { t, p, weight } of surfaceSamples(v, areas, sampleAreaFor(areas, (minWall / 2) ** 2))) {
    samples++;
    const d = [-normals[t * 3], -normals[t * 3 + 1], -normals[t * 3 + 2]];
    const end = add(p, d, probe);
    const lo = [0, 1, 2].map((a) => Math.min(p[a], end[a]));
    const hi = [0, 1, 2].map((a) => Math.max(p[a], end[a]));
    let nearest = Infinity;
    for (const other of trianglesNear(grid, probe, lo, hi)) {
      if (other !== t) nearest = Math.min(nearest, rayTriangle(v, other, p, d));
    }
    if (nearest < minWall) {
      thinArea += weight;
      thin.push({ p, value: nearest });
    }
  }
  return { minWall, samples, thinSamples: thin.length, thinArea_mm2: r3(thinArea), thinnest: spreadSpots(thin, 3, 10) };
}

function cmdRender(flags, positionals, defines) {
  const file = positionals[0];
  if (!file) die(USAGE);
  if (!existsSync(file)) die(`no such file: ${file}`);
  const out = resolve(flags.out || basename(file).replace(/\.scad$/i, '') + '.stl');
  const args = ['-o', out, ...defines];
  if (flags.strict) args.push('--hardwarnings');
  args.push(resolve(file));
  const { res, problems } = runOpenscad(flags, args);
  if (res.code !== 0 || !existsSync(out)) {
    log(JSON.stringify({ ok: false, exit: res.code, problems }, null, 2));
    die('OpenSCAD failed to render (see problems above)');
  }
  log(JSON.stringify({ ok: true, stl: out, ...stlInfo(out), problems }, null, 2));
}

function pngArgs(flags, out, rot, proj) {
  return [
    '-o', out,
    '--imgsize', String(flags.size || '1024,768').replace('x', ','),
    '--camera', `0,0,0,${rot},0`,
    '--viewall', '--autocenter',
    '--projection', proj,
    '--view', 'axes,scales',
  ];
}

function cmdPreview(flags, positionals, defines) {
  const file = positionals[0];
  if (!file) die(USAGE);
  if (!existsSync(file)) die(`no such file: ${file}`);
  const outdir = resolve(flags.outdir || 'preview');
  ensureDir(outdir);
  const names = (flags.views ? String(flags.views).split(',') : Object.keys(VIEWS)).filter((v) => VIEWS[v]);
  const rendered = names.map((name) => {
    const { rot, proj } = VIEWS[name];
    const out = join(outdir, `${basename(file).replace(/\.scad$/i, '')}-${name}.png`);
    const { res, problems } = runOpenscad(flags, [...pngArgs(flags, out, rot, proj), ...defines, resolve(file)]);
    return { view: name, png: existsSync(out) ? out : null, exit: res.code, problems };
  });
  log(JSON.stringify({ ok: rendered.every((r) => r.png), outdir, rendered }, null, 2));
}

function cmdSection(flags, positionals, defines) {
  const file = positionals[0];
  if (!file) die(USAGE);
  const axis = flags.axis || 'z';
  const section = SECTIONS[axis];
  if (!section) die(`--axis must be x, y or z, got ${axis}`);
  const stl = toStl(flags, file, defines);
  const box = bboxOf(readStl(stl).v);
  const at = flags.at !== undefined ? Number(flags.at) : box.min[section.idx] + box.size[section.idx] / 2;
  if (!Number.isFinite(at)) die(`--at must be a number in mm, got ${flags.at}`);
  if (at < box.min[section.idx] || at > box.max[section.idx]) {
    die(`--at ${at} is outside the model: ${axis} spans ${r3(box.min[section.idx])}..${r3(box.max[section.idx])}`);
  }

  const outdir = resolve(flags.outdir || 'preview');
  ensureDir(outdir);
  const wrapper = join(mkdtempSync(join(tmpdir(), '3dp-section-')), 'section.scad');
  const matrix = JSON.stringify(section.rows(at));
  writeFileSync(wrapper, `projection(cut = true) multmatrix(${matrix}) import("${stl.replace(/\\/g, '/')}");\n`);
  const out = join(outdir, `${basename(file).replace(/\.(scad|stl)$/i, '')}-section-${axis}${flags.at !== undefined ? `-${at}` : ''}.png`);
  const { res, problems } = runOpenscad(flags, [...pngArgs(flags, out, '0,0,0', 'o'), wrapper]);
  log(JSON.stringify({ ok: existsSync(out), png: existsSync(out) ? out : null, axis, at: r3(at), imageAxes: section.plane, exit: res.code, problems }, null, 2));
}

function cmdInfo(flags, positionals, defines) {
  const file = positionals[0];
  if (!file) die(USAGE);
  log(JSON.stringify(stlInfo(toStl(flags, file, defines)), null, 2));
}

function cmdCheck(flags, positionals, defines) {
  const file = positionals[0];
  if (!file) die(USAGE);
  const minWall = Number(flags['min-wall'] ?? 0.8);
  const limitDeg = Number(flags.overhang ?? 45);
  const stl = toStl(flags, file, defines);
  const { v } = readStl(stl);
  if (!v.length) die(`${file} has no geometry`);
  const box = bboxOf(v);
  const { normals, areas } = faceNormals(v);
  const { idx, vertexCount } = weldVertices(v);
  const edges = edgeDefects(idx);
  const volume = signedVolume(v);
  const problems = [];
  const warnings = [];

  if (edges.openEdges || edges.nonManifoldEdges) {
    problems.push(`not a closed solid: ${edges.openEdges} open edges, ${edges.nonManifoldEdges} non-manifold edges (touching bodies or zero-thickness walls)`);
  }
  if (volume <= 0) problems.push('volume is not positive: faces are inside out');
  if (Math.abs(box.min[2]) > 0.01) warnings.push(`model rests at z = ${r3(box.min[2])}, not z = 0`);

  let bedContact = 0;
  for (let t = 0; t < areas.length; t++) {
    const o = t * 9;
    if (normals[t * 3 + 2] < -0.999 && Math.max(v[o + 2], v[o + 5], v[o + 8]) < box.min[2] + 0.01) bedContact += areas[t];
  }

  const regions = overhangRegions(v, idx, vertexCount, normals, areas, box.min[2], limitDeg);
  const overhangArea = regions.reduce((s, r) => s + r.area, 0);
  if (regions.length) {
    warnings.push(`${regions.length} overhang region(s) steeper than ${limitDeg}° (${r3(overhangArea)} mm²): need supports, bridging, a chamfer or a teardrop`);
  }

  const walls = wallThickness(v, normals, areas, minWall);
  if (walls.thinSamples) problems.push(`${r3(walls.thinArea_mm2)} mm² of surface is backed by less than ${minWall} mm of material; see walls.thinnest`);

  let bed = 'not checked: pass --bed X,Y,Z';
  if (flags.bed) {
    const volumeXYZ = String(flags.bed).split(/[,x]/).map(Number);
    const margin = Number(flags.margin ?? 5);
    const fits = (sx, sy) => sx + 2 * margin <= volumeXYZ[0] && sy + 2 * margin <= volumeXYZ[1];
    const fitsXY = fits(box.size[0], box.size[1]);
    const fitsRotated = fits(box.size[1], box.size[0]);
    const fitsZ = box.size[2] <= volumeXYZ[2];
    bed = { volume: volumeXYZ, margin, fits: (fitsXY || fitsRotated) && fitsZ, needsRotation: !fitsXY && fitsRotated };
    if (!bed.fits) problems.push(`does not fit a ${volumeXYZ.join(' × ')} mm build volume with a ${margin} mm margin`);
  }

  log(JSON.stringify({
    ok: problems.length === 0,
    file: stl,
    triangles: areas.length,
    bbox: { min: r3all(box.min), max: r3all(box.max), size: r3all(box.size) },
    volume_mm3: r3(volume),
    closedSolid: edges,
    bedContact_mm2: r3(bedContact),
    overhang: {
      limitDeg,
      area_mm2: r3(overhangArea),
      regions: regions.slice(0, 10).map((r) => ({ area_mm2: r3(r.area), maxAngle: Math.round(r.maxAngle), min: r3all(r.min), max: r3all(r.max) })),
    },
    walls,
    bed,
    problems,
    warnings,
  }, null, 2));
}

function cmdFit(flags, positionals, defines, definesA, definesB) {
  const [fileA, fileB] = positionals;
  if (!fileA || !fileB) die(USAGE);
  const clearance = Number(flags.clearance ?? 0.2);
  const stlA = toStl(flags, fileA, [...defines, ...definesA]);
  const stlB = toStl(flags, fileB, [...defines, ...definesB]);

  const wrapper = join(mkdtempSync(join(tmpdir(), '3dp-fit-')), 'overlap.scad');
  const overlapStl = wrapper.replace(/\.scad$/, '.stl');
  writeFileSync(wrapper, `intersection() {\n  import("${stlA.replace(/\\/g, '/')}");\n  import("${stlB.replace(/\\/g, '/')}");\n}\n`);
  runOpenscad(flags, ['-o', overlapStl, wrapper]);
  const overlap = existsSync(overlapStl) ? Math.abs(signedVolume(readStl(overlapStl).v)) : 0;

  const a = readStl(stlA).v;
  const b = readStl(stlB).v;
  const radius = Math.max(1, clearance * 5);
  const grid = buildGrid(b, radius);
  const { normals, areas } = faceNormals(a);
  const tight = [];
  let minGap = Infinity, restingArea = 0;
  for (const { t, p, weight } of surfaceSamples(a, areas, sampleAreaFor(areas, 0.05))) {
    const n = [normals[t * 3], normals[t * 3 + 1], normals[t * 3 + 2]];
    const start = add(p, n, -1e-4);
    const end = add(p, n, radius);
    const lo = [0, 1, 2].map((k) => Math.min(start[k], end[k]));
    const hi = [0, 1, 2].map((k) => Math.max(start[k], end[k]));
    let gap = Infinity;
    for (const near of trianglesNear(grid, radius, lo, hi)) gap = Math.min(gap, rayTriangle(b, near, start, n) - 1e-4);
    if (!Number.isFinite(gap)) continue;
    // Flat faces touching (a lid on a rim) are seating, not a clearance gap.
    if (gap < 1e-3 && Math.abs(n[2]) > 0.99) {
      restingArea += weight;
      continue;
    }
    minGap = Math.min(minGap, gap);
    if (gap < clearance - 1e-3) tight.push({ p, value: Math.max(0, gap) });
  }

  const problems = [];
  const warnings = [];
  if (overlap > 0.001) problems.push(`parts overlap by ${r3(overlap)} mm³: they cannot be assembled as placed`);
  else if (tight.length) warnings.push(`side gap below ${clearance} mm at ${tight.length} sampled points: too tight to slide together; see tightest`);

  log(JSON.stringify({
    ok: problems.length === 0,
    a: stlA,
    b: stlB,
    overlap_mm3: r3(overlap),
    clearance,
    restingContact_mm2: r3(restingArea),
    minGap_mm: Number.isFinite(minGap) ? r3(minGap) : `> ${radius}`,
    tightest: spreadSpots(tight, 3, 10),
    problems,
    warnings,
  }, null, 2));
}

// parseArgs keeps one value per flag; -D and the define flags repeat, so take them out first.
function takeRepeated(argv, names) {
  const found = Object.fromEntries(names.map((n) => [n, []]));
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (names.includes(argv[i]) && i + 1 < argv.length) found[argv[i]].push(argv[++i]);
    else rest.push(argv[i]);
  }
  return { found, rest };
}

function main() {
  const { found, rest } = takeRepeated(process.argv.slice(2), ['-D', '--define', '--define-a', '--define-b']);
  const toArgs = (list) => list.flatMap((d) => ['-D', d]);
  const defines = toArgs([...found['-D'], ...found['--define']]);
  const { flags, positionals } = parseArgs(rest);
  const cmd = positionals.shift();
  switch (cmd) {
    case 'render': return cmdRender(flags, positionals, defines);
    case 'preview': return cmdPreview(flags, positionals, defines);
    case 'section': return cmdSection(flags, positionals, defines);
    case 'info': return cmdInfo(flags, positionals, defines);
    case 'check': return cmdCheck(flags, positionals, defines);
    case 'fit': return cmdFit(flags, positionals, defines, toArgs(found['--define-a']), toArgs(found['--define-b']));
    default: die(USAGE);
  }
}

main();

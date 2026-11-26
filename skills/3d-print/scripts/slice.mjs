#!/usr/bin/env node
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { parseArgs, die, log, warn, which, run, homeDir, ensureDir } from './lib/util.mjs';

const BIN_NAMES = ['orca-slicer', 'OrcaSlicer', 'orca_slicer', 'elegoo-slicer', 'ElegooSlicer', 'elegooslicer'];

function findBinary(flag) {
  if (flag) return flag;
  if (process.env.ORCA_SLICER && existsSync(process.env.ORCA_SLICER)) return process.env.ORCA_SLICER;
  for (const n of BIN_NAMES) {
    const p = which(n);
    if (p) return p;
  }
  const guesses = [
    '/usr/bin/orca-slicer',
    '/usr/local/bin/orca-slicer',
    '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer',
    'C:/Program Files/OrcaSlicer/orca-slicer.exe',
  ];
  for (const g of guesses) if (existsSync(g)) return g;
  return null;
}

function profileRoots(flags = {}) {
  const roots = [];
  const home = homeDir();
  if (flags.profiles) {
    for (const p of String(flags.profiles).split(/[;,]/)) if (p.trim()) roots.push(resolve(p.trim()));
  }
  if (process.env.ORCA_PROFILES) roots.push(process.env.ORCA_PROFILES);
  if (process.env.ORCA_DATA) roots.push(process.env.ORCA_DATA);
  if (process.platform === 'darwin') {
    roots.push(join(home, 'Library/Application Support/OrcaSlicer'));
    roots.push(join(home, 'Library/Application Support/ElegooSlicer'));
  } else if (process.platform === 'win32') {
    if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'OrcaSlicer'));
    if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'ElegooSlicer'));
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config');
    roots.push(join(xdg, 'OrcaSlicer'));
    roots.push(join(xdg, 'ElegooSlicer'));
    roots.push(join(home, '.var/app/io.github.softfever.OrcaSlicer/config/OrcaSlicer'));
    roots.push(join(home, '.var/app/com.elegoo.ElegooSlicer/config/ElegooSlicer'));
  }
  return [...new Set(roots)].filter((r) => existsSync(r));
}

function walkJson(dir, depth = 0, acc = []) {
  if (depth > 4 || acc.length > 4000) return acc;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (e.isSymbolicLink()) {
      try {
        const st = statSync(full);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isDir) walkJson(full, depth + 1, acc);
    else if (isFile && /\.json$/i.test(e.name)) acc.push(full);
  }
  return acc;
}

function classify(files) {
  const found = { machine: [], process: [], filament: [] };
  for (const f of files) {
    // Vendor trees nest presets one level deeper, e.g. Elegoo/process/ECC/*.json.
    const segments = dirname(f).toLowerCase().split(/[\\/]/).reverse();
    const kind = segments.find((s) => s in found);
    if (kind) found[kind].push(f);
    else if (/centauri/i.test(basename(f))) found.machine.push(f);
  }
  return found;
}

// First tier with a match wins; Orca ships every vendor, so unscoped matches pick the wrong one.
const PROFILE_TIERS = {
  machine: [
    [/centauri carbon 0\.4 nozzle/i],
    [/centauri/i, /carbon/i],
    [/centauri/i],
  ],
  process: [
    [/0\.20mm standard/i, /@elegoo cc 0\.4 nozzle/i],
    [/@elegoo cc 0\.4 nozzle/i],
    [/@elegoo cc|centauri/i],
    [/0\.20|0\.2mm|standard/i],
  ],
  filament: [
    [/^elegoo pla @ecc\.json$/i],
    [/@ecc/i, /pla/i],
    [/pla/i, /generic|elegoo/i],
  ],
};

function pickProfile(kind, files, flag) {
  if (flag) return flag;
  const all = files[kind];
  for (const tier of PROFILE_TIERS[kind]) {
    const hit = all.find((f) => tier.every((re) => re.test(basename(f))));
    if (hit) return hit;
  }
  return all[0] ?? null;
}

function discover(flags) {
  const binary = findBinary(flags.slicer);
  const roots = profileRoots(flags);
  const files = roots.flatMap((r) => walkJson(r));
  const found = classify(files);
  return {
    binary,
    roots,
    counts: { json: files.length, machine: found.machine.length, process: found.process.length, filament: found.filament.length },
    ...found,
  };
}

function cmdLocate(flags) {
  const d = discover(flags);
  const out = {
    slicer: d.binary,
    profileRoots: d.roots,
    counts: d.counts,
    selected: {
      machine: pickProfile('machine', d, flags.machine),
      process: pickProfile('process', d, flags.process),
      filament: pickProfile('filament', d, flags.filament),
    },
    available: {
      machine: d.machine.slice(0, 20),
      process: d.process.slice(0, 20),
      filament: d.filament.slice(0, 20),
    },
  };
  log(JSON.stringify(out, null, 2));
}

const PLA_DENSITY_G_CM3 = 1.24;

function extractStats(gcodePath) {
  try {
    const gcode = readFileSync(gcodePath, 'utf8');
    const field = (key) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return gcode.match(new RegExp(`^; ${escaped} = (.+)$`, 'm'))?.[1].trim().replace(/^"(.*)"$/, '$1') ?? null;
    };
    const filamentCm3 = parseFloat(field('filament used [cm3]'));
    const density = parseFloat(field('filament_density')) || PLA_DENSITY_G_CM3;
    // Some presets (e.g. Elegoo PLA @ECC) report 0 g, so derive grams from volume.
    let filamentG = parseFloat(field('total filament used [g]'));
    if (!(filamentG > 0) && filamentCm3 > 0) filamentG = +(filamentCm3 * density).toFixed(2);
    return {
      print_time: field('estimated printing time (normal mode)'),
      filament_mm: parseFloat(field('filament used [mm]')) || null,
      filament_cm3: filamentCm3 || null,
      filament_g: filamentG || null,
      printer: field('printer_settings_id'),
      process: field('print_settings_id'),
      filament: field('filament_settings_id'),
    };
  } catch (e) {
    return { error: String(e) };
  }
}

function cmdRun(flags, positionals) {
  const model = positionals[0];
  if (!model) die('usage: slice.mjs run <model.stl> [--outdir dir] [--profiles dir] [--machine m.json --process p.json --filament f.json] [--plate 0] [--arrange]');
  if (!existsSync(model)) die(`no such file: ${model}`);
  const d = discover(flags);
  if (!d.binary) die('no slicer found. Install OrcaSlicer (or ELEGOO Slicer) or pass --slicer /path/to/binary.');
  const machine = pickProfile('machine', d, flags.machine);
  const processProfile = pickProfile('process', d, flags.process);
  const filament = pickProfile('filament', d, flags.filament);
  if (!machine) die('no machine profile found. Export a preset bundle from the slicer or pass --machine.');
  if (!processProfile) die('no process profile found. Pass --process.');
  if (!filament) die('no filament profile found. Pass --filament.');
  const outdir = resolve(flags.outdir || 'gcode');
  ensureDir(outdir);
  const plate = flags.plate !== undefined ? String(flags.plate) : '0';
  const args = [
    '--slice', plate,
    '--load-settings', `${machine};${processProfile}`,
    '--load-filaments', filament,
    '--outputdir', outdir,
  ];
  if (flags.arrange) args.push('--arrange', '1');
  args.push(resolve(model));
  const res = run(d.binary, args);
  const combined = `${res.stdout}\n${res.stderr}`;
  const problems = combined.split('\n').map((l) => l.trim()).filter((l) => /error|fail/i.test(l));
  const produced = existsSync(outdir)
    ? readdirSync(outdir).filter((f) => f.endsWith('.gcode')).map((f) => join(outdir, f))
    : [];
  const stats = produced.map((g) => ({ file: g, ...extractStats(g) }));
  const ok = produced.length > 0 && res.code === 0;
  log(JSON.stringify({
    ok,
    slicer: d.binary,
    exit: res.code,
    profiles: { machine, process: processProfile, filament },
    gcode: produced,
    statistics: stats,
    problems,
  }, null, 2));
  if (!ok) process.exit(1);
}

function main() {
  const { flags, positionals } = parseArgs(process.argv.slice(2));
  const cmd = positionals.shift();
  switch (cmd) {
    case 'locate': return cmdLocate(flags);
    case 'run': return cmdRun(flags, positionals);
    default: die('usage: slice.mjs <locate|run> ...');
  }
}

main();

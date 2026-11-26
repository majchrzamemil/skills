# Slicing

Leg 2 slices an STL into G-code for the Centauri Carbon. The slicer is
**OrcaSlicer** (headless CLI); ELEGOO Slicer is an OrcaSlicer fork and works the same
way if that is what is installed.

## The command

```sh
orca-slicer \
  --slice 0 \
  --load-settings "machine.json;process.json" \
  --load-filaments "filament.json" \
  --outputdir ./out \
  --export-statistics \
  model.stl
```

- `--slice 0` slices every plate and writes `plate_1.gcode`, `plate_2.gcode`, …
- `--load-settings` is a semicolon-separated list: **machine first, process second**.
- `--load-filaments` is separate.
- `--export-statistics` writes `plate_1.statistics.json` next to the G-code with
  predicted print time and filament totals — read these and show the user.
- `--arrange 1` packs several models on one plate; without it they stack at the origin.
- CLI flags use hyphens, not the underscore keys from the profile JSON
  (`layer_height` → `--layer-height`).

`scripts/slice.mjs run <model.stl>` wraps all of this and prints the resulting
G-code path plus a parsed summary. `scripts/slice.mjs locate` reports which binary
and profiles it found.

## Profiles

OrcaSlicer needs three JSON profiles: **machine**, **process**, **filament**. The
Centauri Carbon machine profile ships with the slicer as a *system* preset inside
the install, not in the user config directory, so it is not always on disk in a
predictable place:

| Platform | Where system presets live |
|---|---|
| macOS | `~/Library/Application Support/OrcaSlicer/system/<Vendor>/...` |
| Linux (config) | `~/.config/OrcaSlicer/system/<Vendor>/...` |
| Linux (AppImage) | inside the AppImage — extract with `./OrcaSlicer.AppImage --appimage-extract`, then `squashfs-root/resources/profiles/` |
| Windows | `%APPDATA%\OrcaSlicer\system\<Vendor>\...` |

The vendor directory for this printer is `Elegoo`; the machine file is named like
`Elegoo Centauri Carbon 0.4 nozzle.json`. `scripts/slice.mjs locate` searches these
roots (plus `ORCA_DATA` / `ORCA_PROFILES` env overrides) and reports what it finds.

If nothing is found, the reliable fallback is to **export a preset bundle once** from
the OrcaSlicer GUI (File → Export → Export Preset Bundle) and pass the JSON paths:

```sh
scripts/slice.mjs run model.stl \
  --machine "/path/Elegoo Centauri Carbon 0.4 nozzle.json" \
  --process "/path/0.20mm Standard.json" \
  --filament "/path/Generic PLA.json"
```

Never fabricate a machine profile: the start/end G-code is machine-specific and a
wrong one can drive the toolhead into the bed.

`--profiles <dir>` adds a search root (comma-separated for several) without touching
the environment — useful for an AppImage whose presets live inside the file. The
script follows directory symlinks, so the durable fix is to extract the AppImage once
and link its profiles where the script already looks (see `requirements.md`).

## Start/end G-code caveat

The Centauri Carbon's stock firmware expects the G-code its own ELEGOO Slicer profile
produces (homing, bed mesh, priming, purge). OrcaSlicer's Elegoo profile is close but
must be verified once against a known-good print before unattended use. The
OpenCentauri project documents modified start/end G-code for *patched* firmware — do
not mix the two. When in doubt, slice with the profile that matches the firmware and
do one supervised test print.

## Filament and process

- Match the process to the nozzle: `0.20 mm` layer for a 0.4 mm nozzle is the safe default.
- Match temperatures and flow to the loaded spool; if the user has not said which
  filament is loaded, ask before starting.
- For structural parts, 4+ walls and 25–40% infill; for display parts, 2–3 walls and
  10–15%. State what you chose.

## After slicing

Show, before printing: predicted print time, filament used (grams and metres), the
model's bounding box, and the profile/material names. Then ask for confirmation
(SKILL.md rule 6). Only then upload and start.

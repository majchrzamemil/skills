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
  model.stl
```

- `--slice 0` slices every plate and writes `plate_1.gcode`, `plate_2.gcode`, …
- `--load-settings` is a semicolon-separated list: **machine first, process second**.
- `--load-filaments` is separate.
- There is no statistics file (OrcaSlicer 2.3.2 has no `--export-statistics`; passing
  it fails with `setup params error`). Print time and filament totals are `; key = value`
  lines in the G-code (`estimated printing time (normal mode)`, `filament used [mm]`,
  `filament used [cm3]`, `total filament used [g]`) — read these and show the user.
  Some presets report `0.00` g; derive grams from cm3 × `filament_density`.
- Bundled vendor presets nest one level deeper (`Elegoo/process/ECC/*.json`). Without
  scoping, the first alphabetical match is another vendor's. Known-good Centauri Carbon
  defaults: `Elegoo Centauri Carbon 0.4 nozzle`, `0.20mm Standard @Elegoo CC 0.4 nozzle`,
  `Elegoo PLA @ECC`.
- `--arrange 1` packs several models on one plate; without it they stack at the origin.
- CLI flags use hyphens, not the underscore keys from the profile JSON
  (`layer_height` → `--layer-height`).

`scripts/slice.mjs run <model.stl>` wraps all of this and prints the resulting
G-code path plus a parsed summary (print time, filament, bed type, layer height,
default acceleration, outer-wall speed, nozzle and first-layer bed temperature).
`scripts/slice.mjs locate` reports which binary and profiles it found.

## The CLI does not resolve `inherits`

Vendor profiles are inheritance chains, for example:

```
fdm_process_ecc_common -> fdm_process_ecc -> fdm_process_ecc_04020
  -> 0.20mm Standard @Elegoo CC 0.4 nozzle -> 0.28mm Extra Draft @Elegoo CC 0.4 nozzle
```

OrcaSlicer 2.3.2's CLI loads only the file it is given and silently fills every key
the leaf does not set with Orca's generic defaults. This hits all three profiles:

| Key | Generic fallback | Resolved Elegoo value |
|---|---|---|
| `default_acceleration` | 500 | 10000 |
| `outer_wall_speed` / `inner_wall_speed` | 60 / 60 | 160 / 200 |
| `sparse_infill_speed` / `travel_speed` | 100 / 120 | 200 / 500 |
| `machine_max_acceleration_x` | 1000 | 20000 |
| `textured_plate_temp` (PLA) | 45 | 60 |

Measured on a 40 × 40 × 20 mm cube: 42 min unresolved, 14.5 min resolved.

`slice.mjs run` therefore merges each chain (parent first, child overrides) into one
flat JSON per kind, writes them to `<outdir>/profiles/`, and passes those. A
missing parent is a hard error, not a silent fallback. Run any hand-built profile
through the same path; never pass a child preset straight to `orca-slicer`.

## Bed type

The CLI assumes `Cool Plate` unless told otherwise, and Elegoo/Orca PLA profiles
set the cool-plate bed to 35 °C — too cold for PLA on the Centauri Carbon's
textured PEI plate. The machine profile's `default_bed_type` is `4` (Textured PEI
Plate). `slice.mjs run` writes `curr_bed_type = "Textured PEI Plate"` into the
flattened process, which gives 60 °C for Elegoo PLA. Pass
`--bed-type "<name>"` only if the user has fitted a different plate. Check
`bed_temperature_initial_layer` in the summary before printing.

## Stock speeds (Centauri Carbon, 0.4 nozzle, 0.20 mm Standard)

Resolved from the Elegoo ECC chain shipped with OrcaSlicer 2.3.2:

| Setting | Value |
|---|---|
| `default_acceleration` | 10000 mm/s² |
| `outer_wall_acceleration` | 5000 mm/s² |
| `inner_wall_acceleration` / `travel_acceleration` | 0 (= default, 10000) |
| `initial_layer_acceleration` | 500 mm/s² |
| `outer_wall_speed` | 160 mm/s |
| `inner_wall_speed` | 200 mm/s |
| `sparse_infill_speed` | 200 mm/s |
| `internal_solid_infill_speed` | 250 mm/s |
| `top_surface_speed` | 200 mm/s |
| `travel_speed` | 500 mm/s |
| `initial_layer_speed` / `initial_layer_infill_speed` | 50 / 105 mm/s |
| `machine_max_acceleration_x/y` | 20000 mm/s² |
| PLA `filament_max_volumetric_speed` | 21 mm³/s |

The volumetric limit, not the speed, usually caps infill at 0.28 mm layers.
For a faster print change the process (`0.24mm Draft`, `0.28mm Extra Draft`),
infill or walls — do not override these speeds or accelerations downward. A
"fast" custom profile with 4000 mm/s² and 120/150 mm/s walls was slower than stock.

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
- Long thin parts or small footprints: add a brim (`brim_type = outer_only`,
  `brim_width = 5`–`6` mm) to keep the ends from lifting.
- For structural parts, 4+ walls and 25–40% infill; for display parts, 2–3 walls and
  10–15%. State what you chose.

## After slicing

Show, before printing: predicted print time, filament used (grams and metres), the
model's bounding box, and the profile/material names. Then ask for confirmation
(SKILL.md rule 6). Only then upload and start.

---
name: 3d-print
description: "Turns a 3D-printing request into a printed part, in two legs. Leg 1 (any printer): from a description, photo, screenshot, link or caliper measurements, author a parametric OpenSCAD model, validate printability and export STL. Leg 2 (ELEGOO Centauri Carbon): given the printer's IP, slice with OrcaSlicer and upload/start the print over the stock SDCP interface or Klipper/Moonraker. Use for \"design a part\", \"model this\", \"make an STL\", \"3D print this\", \"print it on my printer\", \"slice and print\", \"send to the 3D printer\". Not for resin/SLA printing, not for photo-to-mesh reconstruction (photogrammetry or AI image-to-3D), not for laser cutting or CNC, and not for printer hardware repair or firmware flashing."
license: MIT
compatibility: "Leg 1 needs OpenSCAD on PATH. Leg 2 needs a slicer (OrcaSlicer or ELEGOO Slicer) and LAN access to the printer. The bundled scripts run on Node 22+ with no dependencies (22+ gives the built-in WebSocket the SDCP client needs)."
---

# 3d-print

Two legs, usable on their own:

- **Leg 1 — design.** Idea → parametric OpenSCAD → validated, printable STL. Printer-independent.
- **Leg 2 — print.** STL → sliced G-code → uploaded and printed on an ELEGOO Centauri Carbon, given its IP.

Route by what the user asks. "Design/model/make an STL" is leg 1. "Print this / slice and print / send to the printer" is leg 2. "Design and print it" is both, in order.

## Non-negotiables

These override everything else. Breaking one means the answer is wrong even if the model looks good.

**Both legs**
1. **Millimetres. Always.** State every dimension's unit, and state the ones you assumed.
2. **Never invent a dimension that has to fit something real.** A measured or user-given value is data; anything else is an assumption, and assumptions are written down, not buried.
3. **Do not guess the printer or the profile.** Discover or read the real one.

**Leg 1**
4. **The `.scad` source is the deliverable; the STL is an export of it.** The model stays parametric — named parameters at the top, not magic numbers inline.
5. **Validate before delivering:** render, look at the images yourself, check manifoldness, minimum wall thickness, overhangs and bed fit. A model you never rendered is not finished.

**Leg 2**
6. **Never start a print without explicit confirmation.** Show the sliced preview, print time, filament used and the model's bounding box, then wait for a clear "go". Pause and stop must always work.
7. **Confirm the loaded material and nozzle match the profile.** If the filament, nozzle diameter or the profile's machine settings are unknown or mismatched, stop and ask.
8. **Physical actions can damage the machine.** If anything is uncertain — bed not clear, wrong material, a hotend or sensor error — stop and say so instead of proceeding.
9. **Report printer errors verbatim.** Do not translate an error code into a guess about the cause.

## Leg 1 — design a printable model

Detail: `references/cad-and-openscad.md`, printer specs in `references/printers.md`, format choices in `references/cad-options.md`.

1. **Intake.** Collect: what the part is for, the inputs (description / photo / screenshot / link / caliper measurements), and the constraints (size, load, mating surfaces, material). Ask for caliper measurements only where the part must fit something real. A photo is a *reference for shape and proportions* — it is not a 3D reconstruction; never claim you measured a photo.
2. **Author.** Write a parametric OpenSCAD file: every meaningful dimension as a named variable at the top, sensible defaults, a comment block stating intent and assumptions. Import an existing STL/STEP if the user supplied geometry to build on.
3. **Validate.** Render multi-view PNGs and a section cut with `scripts/openscad.mjs`, then read those images and check the geometry. Check the bounding box against the target printer's build volume (`scripts/openscad.mjs info`). Fix and re-render until it is right.
4. **Deliver.** The `.scad` file, the exported STL, the preview images, and a short note: parameters, assumptions, print orientation, and suggested material/profile. Offer 3MF only if the host can produce it.

If no shell is available, hand over the `.scad` text plus the exact render/export commands instead of pretending to have run them.

## Leg 2 — slice and print (ELEGOO Centauri Carbon)

Protocol detail: `references/centauri-carbon.md`. Slicing detail: `references/slicing.md`.

1. **Reach the printer.** Use the IP the user gave. `scripts/cc.mjs status --ip <ip>` reports state, temperatures and loaded file; it also discovers the board id over UDP. If the printer runs OpenCentauri COSMOS (real Klipper + Moonraker) instead of stock firmware, use `scripts/moonraker.mjs`.
2. **Slice.** `scripts/slice.mjs` locates the slicer and the Centauri Carbon machine/process/filament profiles and produces `plate_1.gcode` plus a statistics JSON (print time, filament grams). Show those numbers.
3. **Confirm.** Present: the model preview, print time, filament used, bounding box, and the profile/material. Get an explicit go. (This is non-negotiable #6.)
4. **Send.** Upload the G-code over SDCP (`scripts/cc.mjs upload`), then start it (`scripts/cc.mjs print`). Report the printer's acknowledgement.
5. **Watch.** Stream status (`scripts/cc.mjs watch`). Surface progress and any error. Pause/resume/stop on request (`scripts/cc.mjs pause|resume|stop`).

## Scripts

Node 22+, no dependencies. Each prints compact JSON or human text on stdout.

| Script | Purpose |
|---|---|
| `scripts/openscad.mjs` | `render` (STL), `preview` (multi-view PNGs), `section` (cut view), `info` (bbox + triangle count) |
| `scripts/slice.mjs` | `locate` (find slicer + profiles), `run` (slice STL → G-code + stats) |
| `scripts/cc.mjs` | `discover`, `status`, `watch`, `files`, `upload`, `print`, `pause`, `resume`, `stop` (stock SDCP) |
| `scripts/moonraker.mjs` | Same verbs for an OpenCentauri COSMOS / Klipper printer |

Tool names differ per host — see `adapters/`.

## References

- `references/requirements.md` — software to install for full support (Node, OpenSCAD, slicer), per system.
- `references/cad-and-openscad.md` — OpenSCAD house style, parameters, printability rules, tolerances.
- `references/printers.md` — printer spec table and how to add one (keeps leg 1 generic).
- `references/centauri-carbon.md` — SDCP protocol, commands, status/error codes, quirks, Moonraker path.
- `references/slicing.md` — OrcaSlicer/ELEGOO Slicer CLI, finding profiles, start/end-G-code caveat.
- `references/cad-options.md` — OpenSCAD vs build123d vs importing STEP/STL, and what is out of scope.
- `references/credits.md` — the prior work this skill drew on.

## Credits

Leg 1 stands on earlier OpenSCAD skills; leg 2 on community Centauri Carbon tooling. See `references/credits.md`.

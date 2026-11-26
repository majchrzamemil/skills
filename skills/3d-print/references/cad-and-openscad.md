# CAD and OpenSCAD

Leg 1's job is to turn intent into a parametric OpenSCAD model that prints well.
OpenSCAD is the default because it is plain text: an agent can author it, diff it,
render it headlessly and re-render after every change.

## Why OpenSCAD

- Text in, geometry out — no binary project file, no GUI required to build.
- Deterministic: the same `.scad` always yields the same mesh.
- Parametric: the Customizer and `-D` overrides make variants cheap.
- CLI: `openscad -o out.stl model.scad` renders; `-o out.png --camera=...` renders a view.
- With **BOSL2** it covers what plain OpenSCAD lacks: rounded and chamfered edges,
  teardrop holes, screw holes, threads, and placing parts relative to each other.

Alternatives (see `cad-options.md`): build123d/CadQuery for Python-native modelling,
or importing an existing STEP/STL. Reach for those only when OpenSCAD is a poor fit.

## House style

```scad
// <one line: what this is>
// Assumptions: <what you assumed; what came from a measurement>
// Units: mm

include <BOSL2/std.scad>

/* [Main] */
wall        = 2.0;    // mm; floor is 2 x nozzle (0.8), stiff is 3 x nozzle (1.2)
height      = 30;
hole_d      = 5.2;    // measured bore 5.0 + 0.2 clearance
$fn         = 96;     // smooth curves; lower for fast previews

module body() { /* ... */ }
module cutouts() { /* ... */ }

difference() {
    body();
    cutouts();
}
```

Rules that keep a model usable:

- **Parameters at the top**, grouped with Customizer annotations
  (`/* [Group] */`, `// [min:max]`, `// [a,b,c]`). No magic numbers in the body.
- **One top-level object.** Everything is composed from named modules.
- **`$fn` is a parameter**, so previews can be fast and exports smooth.
- **Model in the orientation you will print**, or say explicitly what orientation is intended.
- **Build on the origin**, resting on `z = 0`, so the slicer's placement is predictable.
- **Multi-part designs take a `part` parameter** (`part = "base"; // [base, lid]`) and
  place each part in its assembled position, so `openscad.mjs fit` can test the fit.
  Rotate a part onto the bed only in the export, not in the model.

## BOSL2

Use BOSL2 (`include <BOSL2/std.scad>`) instead of hand-rolling these with `hull()`,
`minkowski()` or polygon maths. Hand-rolled versions are where generated OpenSCAD
breaks most. Install steps are in `requirements.md`; if the include fails, `render`
prints a hint.

| Need | BOSL2 |
|---|---|
| Rounded vertical edges | `cuboid([x, y, z], rounding = 3, edges = "Z", anchor = BOTTOM)` |
| Elephant-foot chamfer | `edge_mask(BOTTOM) chamfer_edge_mask(chamfer = 0.5)` inside `diff()` |
| Horizontal hole that prints without sag | `teardrop(d = 5, l = 31)`: axis along Y, point up |
| Screw hole with counterbore | `screw_hole("M3", length = 12, head = "socket", counterbore = 3)` (needs `include <BOSL2/screws.scad>`) |
| Feature placed on a face | `attach(TOP)` / `position(LEFT)` on a child |
| Subtract children from a parent | `diff()` on the parent, `tag("remove")` on the cutter |
| Repeat along an axis | `xcopies(spacing)`, `ycopies(...)`, `grid_copies(...)` |

A worked part, rendered and checked:

```scad
include <BOSL2/std.scad>
include <BOSL2/screws.scad>
$fn = 64;

diff()
cuboid([40, 30, 12], rounding = 3, edges = "Z", anchor = BOTTOM) {
    edge_mask(BOTTOM) chamfer_edge_mask(chamfer = 0.5);
    tag("remove") attach(TOP) screw_hole("M3", length = 12, head = "socket", counterbore = 3, anchor = TOP);
    tag("remove") down(1) xcopies(24) teardrop(d = 5, l = 31, ang = 45);
}
```

BOSL2's API is large and models misremember argument names. When a call errors or
the render looks wrong, read the function's doc comment in the installed library
(`grep -rn -A 40 "Module: teardrop()" <libraries>/BOSL2/*.scad`). Do not
guess a second variant.

## Printability rules (0.4 mm nozzle baseline)

| Feature | Guideline |
|---|---|
| Minimum wall | 0.8 mm; 1.2 mm+ for anything load-bearing |
| Minimum feature | ~0.8 mm in the XY plane; detail finer than the nozzle is lost |
| Clearance (mating parts) | 0.2–0.3 mm per side; test with a coupon when it matters |
| Press fit | 0.1–0.15 mm interference; a printed hole shrinks ~0.1–0.2 mm |
| Overhang | ≤ 45° from vertical without supports |
| Bridge | ≤ 5 mm unsupported; longer sags |
| Elephant foot | chamfer the bottom 0.4–0.6 mm, or trim in the slicer |
| Screw holes | through-hole: `nominal + 0.2`; for self-tapping, `nominal − 0.4` |
| Horizontal hole | a teardrop/diamond top prevents sag on the upper arc |
| Threads | prefer heat-set inserts or captured nuts over printed threads |

When a dimension must fit a real object, it comes from a measurement or the user.
Say which. Never infer a fit dimension from a photo.

## Manifold geometry

The slicer needs a watertight solid. To stay manifold:

- `difference()` / `union()` primitives that overlap by more than a rounding error
  (a coplanar subtraction leaves a non-manifold face).
- Avoid zero-thickness walls and coincident faces.
- Prefer regenerating geometry from parameters over boolean-editing a finished mesh.
- `scripts/openscad.mjs` passes `--backend=Manifold` when the OpenSCAD build has it.
  It renders far faster than CGAL, and its output is manifold.
- `openscad.mjs check` welds the exported mesh and counts open and non-manifold edges.
  Two bodies touching along an edge or a point show up there. So do zero-thickness
  walls. Fix the model; do not ignore them.

## Intake checklist

Before writing code, have answers for:

1. **Purpose** — what the part does, and the loads on it.
2. **Inputs** — description, photo/screenshot (shape reference), link (a product or a
   model to imitate), measurements (caliper values for anything that must fit).
3. **Envelope** — maximum outer dimensions, and which printer's build volume it must fit.
4. **Material** — PLA / PETG / ABS / TPU, which sets temperatures and tolerances.
5. **Orientation** — how it should sit on the bed, if it matters.

Ask at most a couple of questions; infer the rest and write the assumptions down.

## Validate: numbers first, then images

LLM vision spots a missing feature, but it does not see a hole that is 2 mm off or
a wall that is 0.5 mm thick. Measure with `check`, then look at the images.

1. `scripts/openscad.mjs check <file.scad> --bed X,Y,Z [--min-wall 0.8] [--overhang 45]`
   returns `problems` (must be empty) and `warnings`:
   - `closedSolid`: open and non-manifold edge counts; both must be 0.
   - `walls.thinnest`: points where less than `--min-wall` mm of material backs the
     surface, measured along the inward normal. Each point gives coordinates, so the
     defect can be found in the model.
   - `overhang.regions`: connected areas steeper than `--overhang` from vertical, with
     area, steepest angle and bbox. Faces on the bed are excluded. A region at 90° is
     a bridge or ceiling. Fix it (chamfer, teardrop, split, reorient) or say that it
     needs supports.
   - `bed`: fit in the build volume with a margin, and whether a 90° turn is needed.
   - `bbox`, `volume_mm3`, `bedContact_mm2`: compare with what you meant. A bed
     contact of a few mm² under a tall part will tip or detach.
2. For parts that mate: `openscad.mjs fit <a> <b> [--define-a 'part="base"'] [--define-b 'part="lid"'] --clearance 0.2`.
   It renders both in assembled position and reports `overlap_mm3`, which must be 0.
   It also reports `minGap_mm`, the smallest side gap along a face normal. Flat faces
   resting on each other are reported separately as `restingContact_mm2`. A gap below
   `--clearance` is listed in `tightest`.
3. `openscad.mjs preview <file.scad> --outdir <dir>` writes `iso`, `top`, `front`,
   `right` PNGs with axes and mm scales. Read them for proportion and intent.
4. `openscad.mjs section <file> --axis x|y|z --at <mm>` writes an exact 2D slice.
   The image axes are model axes in mm. Cut through every hole, boss and wall you
   care about, not only the midpoint (the default).

Re-run after every change. A model that was not checked is not finished.

## Export

- STL is the portable export: `openscad -o model.stl model.scad`.
- Keep the `.scad` next to the STL; the STL is regenerable.
- 3MF carries colour/material metadata but needs a host that can build it; offer it
  only if available, never fabricate one.

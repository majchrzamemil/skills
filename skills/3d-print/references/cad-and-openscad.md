# CAD and OpenSCAD

Leg 1's job is to turn intent into a parametric OpenSCAD model that prints well.
OpenSCAD is the default because it is plain text: an agent can author it, diff it,
render it headlessly and re-render after every change.

## Why OpenSCAD

- Text in, geometry out — no binary project file, no GUI required to build.
- Deterministic: the same `.scad` always yields the same mesh.
- Parametric: the Customizer and `-D` overrides make variants cheap.
- CLI: `openscad -o out.stl model.scad` renders; `-o out.png --camera=...` renders a view.

Alternatives (see `cad-options.md`): build123d/CadQuery for Python-native modelling,
or importing an existing STEP/STL. Reach for those only when OpenSCAD is a poor fit.

## House style

```scad
// <one line: what this is>
// Assumptions: <what you assumed; what came from a measurement>
// Units: mm

/* [Main] */
wall        = 2.0;    // mm, >= 3 * nozzle (0.4) for a stiff wall
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
- `scripts/openscad.mjs` surfaces OpenSCAD's manifold warnings; treat "may not be a
  valid 2-manifold" as a real defect, not noise.

## Intake checklist

Before writing code, have answers for:

1. **Purpose** — what the part does, and the loads on it.
2. **Inputs** — description, photo/screenshot (shape reference), link (a product or a
   model to imitate), measurements (caliper values for anything that must fit).
3. **Envelope** — maximum outer dimensions, and which printer's build volume it must fit.
4. **Material** — PLA / PETG / ABS / TPU, which sets temperatures and tolerances.
5. **Orientation** — how it should sit on the bed, if it matters.

Ask at most a couple of questions; infer the rest and write the assumptions down.

## Render-and-inspect loop

`scripts/openscad.mjs preview <file.scad> --outdir <dir>` writes `iso`, `top`,
`front`, `right` PNGs. Read them and check:

- proportions match the intent;
- cutouts are through, not blind (verify with `section`);
- nothing thinner than the minimum wall;
- the part is oriented as intended and sits on `z = 0`;
- `info` reports a bounding box inside the printer's build volume.

Re-render after every change. The render is the only feedback that the geometry is
what you meant.

## Export

- STL is the portable export: `openscad -o model.stl model.scad`.
- Keep the `.scad` next to the STL; the STL is regenerable.
- 3MF carries colour/material metadata but needs a host that can build it; offer it
  only if available, never fabricate one.

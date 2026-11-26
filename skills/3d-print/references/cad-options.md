# CAD options and scope

OpenSCAD is the default. This note says when to reach for something else, and what
is deliberately out of scope.

## Choosing a format

| Input | Approach |
|---|---|
| Description, dimensions, "make me a bracket" | **OpenSCAD** (default) |
| Photo or screenshot as a shape/proportion reference | **OpenSCAD**, treating the image as a visual reference only |
| Existing STL to modify or build around | Import into OpenSCAD (`import("part.stl")`) or re-model parametrically |
| Existing STEP / native CAD | Convert or re-model; OpenSCAD imports STL, not STEP, without a converter |
| Complex organic / sculpted shape | Out of scope here — this skill makes functional parts, not art meshes |
| Precise mechanical assembly, Python-native | **build123d** / **CadQuery** if the host has Python; same validation loop |

## OpenSCAD vs build123d / CadQuery

- **OpenSCAD** — best when the part is built from primitives and booleans, when you
  want a single text file, and when you want the Customizer. Preferred here.
- **build123d / CadQuery** — Python, better for real CAD kernels (fillets, chamfers,
  STEP export, constraint-style modelling). Use only if Python is available and the
  part genuinely needs it; the printability and validation rules in
  `cad-and-openscad.md` still apply.

The skill's scripts assume OpenSCAD. A build123d path is manual: author the Python,
run it, export STL, then reuse `scripts/openscad.mjs info` and `scripts/slice.mjs`.

## Photo = reference, not measurement

A photo or screenshot informs shape, proportion and features. It does **not** yield
dimensions. Two things are explicitly not this skill:

- **Photogrammetry** (e.g. Meshroom) — reconstructing a mesh from many photos. It
  needs many overlapping images and a controlled capture, and produces a mesh, not a
  parametric part.
- **AI image-to-3D** (text/image → mesh services) — produces a triangle soup that is
  usually not watertight and not dimensionally controllable.

Both are out of scope. If a user wants a faithful copy of a physical object, the path
is: measure it (calipers), then model it parametrically.

## Deliberately out of scope

- Resin / SLA printing (different chemistry, supports, post-processing).
- Laser cutting and CNC (2D toolpaths, not additive).
- Printer firmware flashing, hardware repair, or bed-level calibration routines.
- Slicing for machines other than the Centauri Carbon beyond a generic Moonraker path.

State the boundary plainly rather than attempting a poor version of any of these.

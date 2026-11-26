# Credits and inspiration

This skill was assembled after surveying prior art. Leg 1 borrows heavily from
existing OpenSCAD agent skills; leg 2 from community Centauri Carbon tooling. No code
was copied verbatim — the patterns and structure are credited here.

## Leg 1 — OpenSCAD skills

- **`swh/openscad-skill`** (`openscad-bosl2`) — the strongest structural influence:
  a printer-spec table, print-orientation reasoning, slicer-parameter guidance, and a
  house style with parameters and a starter skeleton. This skill's
  `references/printers.md` and the house-style section of `cad-and-openscad.md`
  follow that shape.
- **`chriscantey/skill-3d-printing`** — the 2D-first design workflow, STL import,
  manifold rules, and keeping designs parametric and versioned.
- **`choplin/my-agent-skills` `3d-print`** (mcpmarket) — the three-phase flow and the
  caliper-measurement intake for mating parts, plus multi-view renders and section
  cuts used to validate geometry before export.
- **`mitsuhiko/agent-stuff` `openscad`** and **`fradser/dotclaude` `use-openscad`** —
  preview rendering and headless render/export tooling patterns.

## Leg 2 — Centauri Carbon and slicing

- **OpenCentauri** (`docs.opencentauri.cc`) — the SDCP v3.0.0 protocol notes for the
  Centauri Carbon (connection, commands, status/error codes, the misspelled field
  names) that `references/centauri-carbon.md` is based on.
- **`MRoalsvig/print-automation`** — a working Moonraker client and print queue for a
  Centauri Carbon running OpenCentauri COSMOS; a reference for the Moonraker path.
- **`pycentauri`** — community local-control client for the Centauri Carbon; confirms
  SDCP is reachable on the LAN without cloud.
- **OrcaSlicer CLI documentation** (`orcaslicer.com/wiki/cli`) and the
  **`CapitanaIcoachai/orcaslicer-cli-cookbook`** — the headless invocation, profile
  loading, `--export-statistics`, and the profile-discovery pitfalls that
  `references/slicing.md` captures.

## Prior art in this repo

- **`shopping-pl`** — the layout (`SKILL.md` + `references/` + `scripts/` +
  `adapters/`), the "Non-negotiables" pattern, and the capability-tier idea.

## License

The prior art above is used as inspiration for structure and documented behaviour;
where a specific source is quoted (protocol field names, CLI flags) the source is
named in the reference file. This skill is MIT, like the repo.

# skills

A small collection of portable agent skills (Agent Skills format: one folder per
skill, `SKILL.md` + optional `references/`, `scripts/` and `adapters/`).

The same folder works in OpenCode, Claude Code, and any harness that reads
`SKILL.md` — no build step, no dependencies.

Rules for working **in** this repo are in [`AGENTS.md`](AGENTS.md).

## Skills

| Skill | What it does | Cost |
|---|---|---|
| [`shopping-pl`](skills/shopping-pl/SKILL.md) | Finds, filters and ranks purchase offers from Polish sites (Ceneo, OLX, Allegro Lokalnie, online shops) and returns a shortlist with verified links. | 0 (no paid APIs) |
| [`3d-print`](skills/3d-print/SKILL.md) | Two legs: (1) design a parametric OpenSCAD model from a description, photo, link or measurements and export an STL; (2) slice with OrcaSlicer and print on an ELEGOO Centauri Carbon given its IP (stock SDCP or Klipper/Moonraker). | 0 (open-source tools) |

`3d-print`'s design leg draws on prior OpenSCAD agent skills
(`swh/openscad-skill`, `chriscantey/skill-3d-printing`, `choplin/3d-print`,
`mitsuhiko`, `fradser`), and its print leg on community Centauri Carbon tooling
(OpenCentauri docs, `MRoalsvig/print-automation`, `pycentauri`) and the OrcaSlicer
CLI documentation. Full credits in
[`skills/3d-print/references/credits.md`](skills/3d-print/references/credits.md).

## Requirements

`shopping-pl` needs nothing beyond an HTTP fetch tool. `3d-print` needs:

| For | Software | Notes |
|---|---|---|
| Both legs | **Node.js 22+** | scripts use built-ins only (22+ for the SDCP WebSocket client) |
| Design (leg 1) | **OpenSCAD** | render, preview, STL export |
| Print (leg 2) | **OrcaSlicer** (or ELEGOO Slicer) | headless slicing + the Centauri Carbon profile |
| Print (leg 2) | LAN access to the printer | SDCP UDP 3000 / WS 3030 / HTTP 3030 |

Per-system install commands (Fedora, Debian/Ubuntu, macOS, Windows) and a verify
step: [`skills/3d-print/references/requirements.md`](skills/3d-print/references/requirements.md).

## Install

### Claude Code (marketplace)

```bash
claude plugin marketplace add majchrzamemil/skills
claude plugin install shopping-pl@majchrzamemil-skills
claude plugin install 3d-print@majchrzamemil-skills
```

The marketplace catalog is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

Update after a `git push` to GitHub:

```bash
claude plugin marketplace update majchrzamemil-skills   # pull the catalog clone
claude plugin update shopping-pl@majchrzamemil-skills
claude plugin update 3d-print@majchrzamemil-skills
```

Working on this repo? Load the working tree for one session instead of
registering the folder as a marketplace (see [`AGENTS.md`](AGENTS.md)):

```bash
claude --plugin-dir ~/Documents/repos/skills
```

### OpenCode and other plain-layout hosts

OpenCode reads a plain skills folder. If the Claude Code marketplace is already
added, link from its GitHub clone — one `marketplace update` then refreshes both:

```bash
~/.claude/plugins/marketplaces/majchrzamemil-skills/install.sh
```

Without Claude Code, clone the repo and link from the clone; `git pull` updates it:

```bash
git clone https://github.com/majchrzamemil/skills ~/.local/share/majchrzamemil-skills
~/.local/share/majchrzamemil-skills/install.sh
```

`install.sh` links each skill into `~/.config/opencode/skills/` (`--dry-run` shows
what would be linked). Add `--with-claude-links` to also symlink into
`~/.claude/skills/` — only if you are *not* installing from the marketplace,
otherwise the skill loads twice.

Uninstall:

```bash
./install.sh --uninstall                                # symlinks
claude plugin uninstall shopping-pl@majchrzamemil-skills  # plugin
```

## Validate

```bash
make validate     # frontmatter, portability, referenced files, script deps
                  # plus `claude plugin validate` when the CLI is present
```

## Conventions

- Folder name = `name` in frontmatter, lowercase, hyphens, no consecutive
  hyphens, max 64 chars.
- Frontmatter is portable: `name` and `description`, plus optional `license` and
  `compatibility`. Host-specific fields such as `allowed-tools` are omitted.
- `description` says what the skill does, when to use it, and what it is not for.
  The "Not for" clause is what keeps it quiet on near-misses.
- A host's tool names live in `adapters/`, never in `SKILL.md`. `make validate`
  warns if one leaks into the portable core.
- No absolute paths inside a skill, so a clone and a symlink behave the same.
- Scripts run on plain Node 18+ with zero dependencies.
- `SKILL.md` stays short (procedure + rules); details live in `references/` and
  are read only when needed.
- Prose is English throughout. Polish appears only as data — trigger phrases,
  search queries, strings parsed out of fetched pages, PLN formatting. The full
  policy is in [`AGENTS.md`](AGENTS.md#language-policy).
- Commits must be signed: `make hooks` installs the `pre-push` guard.

## Adding a skill

```bash
mkdir -p skills/my-skill/references
$EDITOR skills/my-skill/SKILL.md   # start with name + description frontmatter
./install.sh
make validate
```

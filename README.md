# skills

A small collection of portable agent skills (Agent Skills format: one folder per skill, `SKILL.md` + optional `references/` and `scripts/`).

The same folder works in OpenCode, Claude Code, and any harness that reads `SKILL.md` — no build step, no dependencies.

## Skills

| Skill | What it does | Cost |
|---|---|---|
| [`shopping-pl`](skills/shopping-pl/SKILL.md) | Finds, filters and ranks purchase offers from Polish sites (Ceneo, OLX, Allegro Lokalnie, online shops) and returns a shortlist with verified links. | 0 (no paid APIs) |

## Install

```bash
git clone <this-repo> ~/Documents/repos/skills
cd ~/Documents/repos/skills
./install.sh            # symlinks every skill into the harness skill dirs
./install.sh --dry-run  # show what would be linked
```

`install.sh` links each skill into:

- `~/.claude/skills/` — Claude Code (OpenCode also reads this path)
- `~/.config/opencode/skills/` — OpenCode native path

Because the links point at the repo, `git pull` updates every harness at once. Nothing needs reinstalling.

Uninstall:

```bash
./install.sh --uninstall
```

## Validate

```bash
make validate     # checks frontmatter rules from the Agent Skills spec
make dist         # zips each skill (for harnesses that require an upload)
```

## Conventions

- Folder name = `name` in frontmatter, lowercase, hyphens, no consecutive hyphens, max 64 chars.
- Frontmatter uses only `name` and `description` (portable). Harness-specific fields such as `allowed-tools` are intentionally omitted.
- No absolute paths inside a skill — everything relative to the skill folder, so a clone or a zip behaves the same.
- Scripts must run on plain Node 18+ with zero dependencies.
- `SKILL.md` stays short (procedure + rules); details live in `references/` and are read only when needed.

## Adding a skill

```bash
mkdir -p skills/my-skill/references
$EDITOR skills/my-skill/SKILL.md   # start with name + description frontmatter
./install.sh
make validate
```

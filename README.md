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

## Install

### Claude Code (marketplace)

```bash
claude plugin marketplace add majchrzamemil/skills
claude plugin install shopping-pl --marketplace majchrzamemil-skills
```

Or in one step inside a session (Claude Code 2.1.275+):

```
/plugin install shopping-pl --marketplace majchrzamemil/skills
```

The marketplace catalog is [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
Working on this repo? Register the local folder once — it then tracks your edits
with no version bump and no reinstall:

```bash
claude plugin marketplace add .
claude plugin install shopping-pl@majchrzamemil-skills
```

### OpenCode and other plain-layout hosts

```bash
git clone <this-repo> ~/Documents/repos/skills
cd ~/Documents/repos/skills
./install.sh            # symlinks every skill into the harness skill dirs
./install.sh --dry-run  # show what would be linked
```

`install.sh` links each skill into `~/.config/opencode/skills/`. Because the links
point at the repo, `git pull` updates the harness at once. Add
`--with-claude-links` to also symlink into `~/.claude/skills/` — only if you are
*not* installing from the marketplace, otherwise the skill loads twice.

Uninstall:

```bash
./install.sh --uninstall                          # symlinks
claude plugin uninstall shopping-pl               # plugin
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

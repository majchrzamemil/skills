# AGENTS.md

Rules for agents working **in this repository**. For the rules an agent follows
*while using* a skill, read the skill itself.

This repo ships portable [Agent Skills](https://code.claude.com/docs/en/skills).
One folder per skill; the folder name is the skill `name`.

## Layout

```
skills/<name>/
  SKILL.md      # required: frontmatter + the procedure the agent follows
  references/   # detail read on demand (scoring, source registry, ...)
  scripts/      # Node 18+, zero dependencies
  adapters/     # per-host tool names and install steps; optional, host-specific
.claude-plugin/
  marketplace.json # the catalog Claude Code installs from
install.sh      # symlink route for plain-layout hosts (OpenCode)
tools/validate.sh
tools/hooks/pre-push
```

`adapters/` is the only place a host tool name may appear. The portable core —
`SKILL.md`, `references/`, `scripts/` — must stay agent-neutral.

## Language policy

**Prose is English. Always.** There is no Polish documentation, no Polish
comments, no bilingual headings.

Polish is allowed only where it is *data*, never where it is prose:

| Allowed | Why |
|---|---|
| Trigger phrases in `description` (`znajdź mi`, `kup`, `do X zł`) | They are literal match strings for the trigger; translating them breaks triggering. |
| Query examples (`"drukarka 3d"`, `ceneo.mjs "wiertarka udarowa"`) | The query is sent to a Polish site verbatim. |
| Locators parsed out of fetched HTML (`Darmowa wysyłka`, `opinia\|opinie\|opinii`, `w sklep`, `Najtańsze (przedmiot)`, `Uszkodzone`, `na części`) | These strings occur in the page. Changing them breaks parsing. |
| Output formatting (`zł`, `pl-PL` number locale) | The result is priced in PLN. |
| Quoted evidence in `references/` | Observed page text, quoted, not authored. |

The **answer** to a user is written in the user's language — Polish request,
Polish reply. That rule lives in `SKILL.md` (Non-negotiables), not here.

When you touch a Polish string, ask which row of that table it is. If it is none
of them, translate it to English.

## Changing a skill

- **Every skill is registered in `.claude-plugin/marketplace.json`.** A new skill
  needs a `plugins` entry: `name` (matching the folder), `source: "./"`,
  `skills: ["./skills/<name>"]`, and `metadata.version`. Then bump the top-level
  `metadata.version` (minor) and add a README row.
- **Editing a skill bumps that entry's `metadata.version`** — patch for fixes,
  minor for new guidance, major for a change in how the skill is used. Installs
  from GitHub read a clone, so a change only reaches an installed plugin after
  `git push` and `claude plugin update <skill>`.
- **Iterating on a skill needs no marketplace at all.** Load the working tree for
  one session:
  ```bash
  claude --plugin-dir ~/Documents/repos/skills
  ```
  Edits take effect at the next session start (or `/reload-plugins`). Do not also
  register the repo as a `directory` marketplace under the same name as the
  GitHub one — a marketplace name maps to exactly one source, and adding the
  second fails with `its source doesn't match its extraKnownMarketplaces entry`.
- **Frontmatter is portable.** Allowed: `name`, `description`, `license`,
  `compatibility`, `metadata`. Anything else (`allowed-tools`, `model`, `tools`,
  `permissions`) is host-specific: unknown keys are ignored by some hosts and
  rejected by strict validators. Put host-specific behaviour in `adapters/`.
- **`description` carries the whole trigger.** Say what it does, when to use it,
  and — explicitly — what it is *not* for. Near-miss quieting comes from the
  "Not for …" clause, not from a longer list of synonyms.
- **No absolute paths** anywhere in a skill. Everything is relative to the skill
  folder, so a clone and a symlink behave identically.
- **Scripts use Node built-ins only.** No `npm install`, no Python for anything
  the skill runs at answer time.
- **Keep `SKILL.md` short.** Procedure + rules; detail goes to `references/`,
  which is read only when needed.
- After any change, run `./tools/validate.sh`.

## Conventions

- Commit scopes name the skill: `feat(shopping-pl):`, `fix(shopping-pl):`,
  `docs(readme):`, `chore(validate):`.
- Commits in this repo **must be signed**. The `pre-push` hook rejects unsigned
  commits; `make hooks` installs it and sets `commit.gpgsign=true` locally.
  Signing uses a hardware key, so a signing agent needs a real terminal.
- Never commit an unsourced price or a guessed URL into `references/`. If the
  evidence is not in the commit message or the file, it does not go in.

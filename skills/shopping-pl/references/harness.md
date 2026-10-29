# Harness notes

The skill is harness-agnostic. This file maps the generic steps to concrete tool names and tells you what degrades where.

## Tool mapping

| Need | OpenCode | Claude Code | Claude Desktop / claude.ai | Generic |
|---|---|---|---|---|
| Fetch a page as text | `webfetch` | `WebFetch` | built-in web fetch, if enabled | any fetch/browser MCP tool |
| Run a script | `bash` | `Bash` | **not available** | any shell tool |
| Web search | `websearch` | `WebSearch` | built-in search | search MCP tool |
| Read a local file | `read` | `Read` | not available | filesystem MCP tool |

If your harness has none of these, you can still answer — but say that live prices could not be checked.

## Capability tiers

**Tier A — shell + fetch (OpenCode, Claude Code)**
Full mode. Run `scripts/ceneo.mjs` and `scripts/allegro-lokalnie.mjs` for compact JSON, use the fetch tool for OLX and shops.

**Tier B — fetch only (Claude Desktop, chat-only clients)**
Degraded mode:
- Ceneo, OLX and Allegro Lokalnie work through the fetch tool, but you parse the markdown yourself and it costs more context.
- Fetch one page per source, extract 10–20 offers, stop.
- Say explicitly that scripts were not used.

**Tier C — no network**
Do not guess prices. Explain what is missing and offer the search plan the user can run themselves.

## Install per harness

### OpenCode

```bash
git clone <repo> ~/Documents/repos/skills
cd ~/Documents/repos/skills && ./install.sh
```

Links into `~/.config/opencode/skills/`. OpenCode also reads `~/.claude/skills/`, so a single link there usually covers both — if the skill shows up twice, keep one link only.

### Claude Code

```bash
cd ~/Documents/repos/skills && ./install.sh
```

Links into `~/.claude/skills/`. Restart the session, then check that the skill appears in the available skills list.

Project-scoped alternative (no global link):

```bash
mkdir -p .claude/skills
ln -s ~/Documents/repos/skills/skills/shopping-pl .claude/skills/shopping-pl
```

### Claude Desktop / claude.ai

Upload-based harnesses need a zip:

```bash
cd ~/Documents/repos/skills && make dist
# then upload dist/shopping-pl.zip in Settings -> Capabilities -> Skills
```

Scripts will not run there — expect Tier B.

## Notes on portability

- The frontmatter deliberately contains only `name` and `description`. Fields like `allowed-tools` are Claude Code specific and are ignored elsewhere.
- No absolute paths inside the skill, so a clone, a symlink and a zip all behave the same.
- Scripts use Node built-ins only. Node 18+ is enough; nothing to install.
- If a harness cannot run `node`, fall back to the fetch tool instead of inventing a result.

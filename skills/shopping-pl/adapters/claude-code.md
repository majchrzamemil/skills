<!-- Claude Code adapter. Optional: the skill works without it. This file only
     names the tools this host exposes, so the portable body stays agent-neutral. -->

# shopping-pl on Claude Code

## Tool mapping

| Need | Tool |
|---|---|
| Fetch a page as text | `WebFetch` |
| Run the bundled scripts | `Bash` (Node 18+) |
| Web search | `WebSearch` |
| Read a local file | `Read` |

## Install

```bash
cd <clone> && ./install.sh     # links into ~/.claude/skills/
```

Restart the session, then confirm `shopping-pl` shows up in the available skills.

Project-scoped alternative, when the skill should not be global:

```bash
mkdir -p .claude/skills
ln -s <clone>/skills/shopping-pl .claude/skills/shopping-pl
```

## Notes

- Invocation is by description match; there is no `/shopping-pl` command. Saying "use the shopping-pl skill" forces it.
- `WebFetch` is the only channel that gets through olx.pl. Keep `Bash` for Ceneo and Allegro Lokalnie, which return 403 to scripts.

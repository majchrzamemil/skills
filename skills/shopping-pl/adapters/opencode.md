<!-- OpenCode adapter. Optional: the skill works without it. This file only
     names the tools this host exposes, so the portable body stays agent-neutral. -->

# shopping-pl on OpenCode

## Tool mapping

| Need | Tool |
|---|---|
| Fetch a page as text | `webfetch` |
| Run the bundled scripts | `bash` (Node 18+) |
| Web search | `websearch` |
| Read a local file | `read` |

## Install

```bash
cd <clone> && ./install.sh     # links into ~/.config/opencode/skills/
```

OpenCode also reads `~/.claude/skills/`, so one link can cover both hosts. If the
skill appears twice, keep a single link.

## Notes

- Skills load on demand through the native `skill` tool; OpenCode 1 has no slash
  commands for skills. Natural language matching the `description` is the trigger.
- `webfetch` is the only channel that gets through olx.pl, and one OLX page costs
  roughly 1,400 lines of markdown. One page per source, two at the absolute most.

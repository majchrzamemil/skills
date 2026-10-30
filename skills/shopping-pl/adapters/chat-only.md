<!-- Adapter for hosts without a shell: claude.ai, Claude Desktop, chat-only
     clients. Optional: the skill works without it. This file only describes the
     degraded mode, so the portable body stays agent-neutral. -->

# shopping-pl on chat-only hosts

No shell means no Ceneo or Allegro Lokalnie scripts. The skill still works, with
caveats:

- Fetch one page per source with the built-in web search or fetch tool, then read
  titles, prices and links out of the returned markdown yourself.
- Extract 10–20 offers per source and stop. Do not crawl.
- olx.pl works through the fetch tool; Ceneo works but loses the price filter and
  sorting the scripts normally apply.
- Say plainly that the scripts were not used and that the results are the first
  page only, not a filtered ranking.

Upload-based installs: zip the skill folder and upload it in the host's skill
settings. Scripts will not run there — expect the degraded mode above.

Without any network access, do not estimate prices. Name what is missing and hand
the user the search plan to run themselves.

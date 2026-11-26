# Adapter: Claude Code

Tool names in this host:

- Run scripts with the **Bash** tool: `node scripts/3d-print/scripts/<script>.mjs ...`
  (paths are relative to the installed skill folder).
- Read files and images with the **Read** tool — it returns PNGs as attachments, so
  previews and section cuts can be inspected directly.
- Write `.scad` / notes with **Write** and **Edit**.
- Fetch a user-supplied link with **WebFetch**.
- Leg 2 needs outbound LAN access from Bash (UDP 3000, WS 3030, HTTP 3030).

Prerequisites:

- `node` 22+ (the SDCP client uses the built-in WebSocket).
- `openscad` on PATH and BOSL2 installed for leg 1 (`references/requirements.md`).
- OrcaSlicer (or ELEGOO Slicer) for leg 2.

Install as a plugin from the marketplace in this repo, or symlink the skill folder
into the skills directory. Edits take effect at the next session start.

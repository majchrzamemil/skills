# Adapter: OpenCode

Tool names in this host:

- Run scripts with the **bash** tool: `node skills/3d-print/scripts/<script>.mjs ...`.
- Read files (rendered PNGs, `.scad`, G-code stats) with the **read** tool. The read
  tool returns images, so previews and section cuts can be inspected directly.
- Write `.scad` / notes with the **write** and **edit** tools.
- Fetch a link the user gave with the **webfetch** tool.
- For leg 2, the scripts need network access from bash (UDP 3000, WS 3030, HTTP 3030).

Prerequisites on this host:

- `node` 22+ (WebSocket for the SDCP client).
- `openscad` on PATH for leg 1.
- OrcaSlicer (or ELEGOO Slicer) for leg 2, or pass `--slicer` / profile paths.

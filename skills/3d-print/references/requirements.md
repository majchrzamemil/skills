# Requirements

What each leg needs. Leg 1 and leg 2 are independent — install only what you use.

## Summary

| Software | Needed for | Minimum |
|---|---|---|
| **Node.js** | every script in `scripts/` | **22+** (the SDCP client uses the built-in `WebSocket`; `fetch`/`FormData`/`Blob` need 18+) |
| **OpenSCAD** | leg 1 — design, render, STL export | any recent 2021.01+ |
| **OrcaSlicer** (or ELEGOO Slicer) | leg 2 — slicing | any recent release with the Centauri Carbon profile |
| **libfuse2** | running an OrcaSlicer AppImage | only for the AppImage route |
| **Xvfb + Mesa** | headless PNG previews on a machine with no display | optional |
| LAN access to the printer | leg 2 — SDCP UDP 3000 / WS 3030 / HTTP 3030 | — |

Leg 1 needs **Node + OpenSCAD**. Leg 2 needs **Node + a slicer + LAN**. Nothing else —
the printer link uses Node built-ins only, no Python, no npm packages.

## Fedora

```sh
# Node 22+  (verify: node --version)
sudo dnf install nodejs
# if that is < 22, Fedora ships versioned builds:
sudo dnf install nodejs22     # or nodejs24

# OpenSCAD
sudo dnf install openscad

# OrcaSlicer (AppImage) — Fedora has no official package
sudo dnf install fuse-libs
# download the AppImage from https://github.com/OrcaSlicer/OrcaSlicer/releases
chmod +x ~/Downloads/OrcaSlicer_Linux_*.AppImage
mkdir -p ~/.local/bin
ln -sf ~/Downloads/OrcaSlicer_Linux_*.AppImage ~/.local/bin/orca-slicer

# optional: headless previews with no display
sudo dnf install xorg-x11-server-Xvfb mesa-dri-drivers
```

The AppImage keeps its profiles inside the file. Extract them so `slice.mjs locate`
can find the Centauri Carbon machine/process/filament presets, or export a preset
bundle from the GUI (File → Export → Export Preset Bundle):

```sh
cd ~/Downloads && ./OrcaSlicer_Linux_*.AppImage --appimage-extract

# Make the profiles findable without env vars: symlink them into the config dir the
# script already searches. This survives new sessions and works for the agent's
# non-interactive shell (which does not read .zshrc / .bashrc).
mkdir -p ~/.config/OrcaSlicer
ln -sfn ~/Downloads/squashfs-root/resources/profiles ~/.config/OrcaSlicer/vendor-orca

node scripts/3d-print/scripts/slice.mjs locate   # should now list the Elegoo profiles
```

Do **not** put `ORCA_PROFILES` in `.zshrc` / `.bashrc`: non-interactive shells skip
those files, so the skill would not see it. Use the symlink above, pass `--profiles`
per command, or set it inline (`ORCA_PROFILES=... node .../slice.mjs run ...`).

## Other systems

| System | Node | OpenSCAD | Slicer |
|---|---|---|---|
| Debian / Ubuntu | `apt install nodejs` (needs 22+; use nvm/NodeSource if older) | `apt install openscad` | OrcaSlicer `.AppImage` or `.deb` |
| macOS | `brew install node` | `brew install openscad` | OrcaSlicer `.dmg` (binary at `/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer`) |
| Windows | `winget install OpenJS.NodeJS` | `winget install OpenSCAD` | OrcaSlicer `.exe` (`%PROGRAMFILES%\OrcaSlicer\orca-slicer.exe`) |

`slice.mjs` and `openscad.mjs` also accept explicit paths via flags or env vars, so a
non-standard install is fine:

- `--slicer /path/to/binary` or `ORCA_SLICER=/path/to/binary`
- `--profiles /path/to/profiles` (comma-separated for several) or `ORCA_PROFILES=...`
- `OPENSCAD=/path/to/openscad`

## Verify

```sh
node --version                              # >= 22
openscad --version
node scripts/3d-print/scripts/slice.mjs locate   # shows slicer + profiles found
node scripts/3d-print/scripts/openscad.mjs info model.stl
```

If `slice.mjs locate` reports `"slicer": null` or zero profiles, install the slicer
or set `ORCA_SLICER` / `ORCA_PROFILES` before slicing. Never fabricate a machine
profile — the start/end G-code is machine-specific.

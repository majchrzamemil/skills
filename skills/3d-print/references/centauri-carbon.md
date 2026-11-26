# ELEGOO Centauri Carbon — control reference

Hardware: 256 × 256 × 256 mm, CoreXY, enclosed, direct drive, 0.4 mm hardened
nozzle. The stock firmware is a closed, modified Klipper fork with **no Moonraker,
Mainsail or Fluidd**. It is controlled with the **Smart Device Control Protocol
(SDCP) v3.0.0**: JSON over WebSocket, plus an HTTP upload endpoint.

Two firmware paths:

- **Stock firmware (default).** SDCP. Works out of the box on the LAN. Use `scripts/cc.mjs`.
- **OpenCentauri COSMOS / patched firmware.** Turns the machine into a real
  Klipper + Moonraker printer. Use `scripts/moonraker.mjs`. (A community project;
  flashing is the user's decision and out of scope here.)

Sources: OpenCentauri API docs (`docs.opencentauri.cc/software/api/`), the SDCP
v3.0.0 specification, and community clients (`pycentauri`, `MRoalsvig/print-automation`).

## Stock firmware: SDCP

### Discovery and connection

- **UDP discovery** — broadcast `M99999` to port `3000`; the printer replies with
  JSON containing `MainboardIP`, `MainboardID`, `ProtocolVersion`, `FirmwareVersion`.
- **WebSocket** — `ws://<MainboardIP>:3030/websocket`.
- **HTTP upload** — `http://<MainboardIP>:3030/uploadFile/upload`.

### Message envelope

Request:

```json
{ "Id": "<uuid>", "Data": {
    "Cmd": 0, "Data": {}, "RequestID": "<uuid>",
    "MainboardID": "<id>", "TimeStamp": 1687069655, "From": 0 },
  "Topic": "sdcp/request/<MainboardID>" }
```

Responses arrive on `sdcp/response/<id>`, unsolicited status on `sdcp/status/<id>`,
attributes on `sdcp/attributes/<id>`, errors on `sdcp/error/<id>`, notices on
`sdcp/notice/<id>`. Heartbeat is the literal `ping` → `pong`. If `MainboardID` is
unknown, discover it over UDP first.

### Commands

| Cmd | Meaning | `Data` payload |
|---|---|---|
| 0 | Request status refresh | `{}` |
| 1 | Request attributes | `{}` |
| 128 | Start print | full payload, see below |
| 129 | Pause | `{}` |
| 130 | Stop | `{}` |
| 131 | Resume | `{}` |
| 132 | Stop material feeding | `{}` |
| 133 | Skip preheating | `{}` |
| 192 | Rename printer | `{ "Name": "..." }` |
| 258 | List files | `{ "Url": "/local/" }` |
| 259 | Delete files | `{ "FileList": [...], "FolderList": [...] }` |
| 320 / 321 | History / task detail | `{}` / `{ "Id": [...] }` |
| 386 / 387 | Video stream / timelapse | `{ "Enable": 1 }` |
| 403 | Set speed / fans | `{ "PrintSpeedPct": 50 }` or `{ "TargetFanSpeed": {...} }` |

### Start print (Cmd 128)

Send all six fields. This is what Elegoo's own clients send:

```json
{ "Filename": "<name>.gcode", "StartLayer": 0, "Calibration_switch": 1,
  "PrintPlatformType": 0, "Tlp_Switch": 0, "slot_map": [] }
```

- `Calibration_switch` — auto bed levelling before the print (`1` on, `0` off).
  `cc.mjs print --level 0` turns it off.
- `PrintPlatformType` — which side of the plate is up: `0` side A, `1` side B
  (firmware sysconf `print_platform_type`; OrcaSlicer maps its PC plate to `1`).
- `Tlp_Switch` — timelapse (`0` off).
- `slot_map` — `[]` without a CANVAS; else `{ "t", "canvas_id", "tray_id" }` entries.
- `Filename` — bare name as uploaded. OrcaSlicer sends `/local/<name>`; both are used.

Before sending, wait until `CurrentStatus` no longer contains `8` (file checking,
right after an upload) and is `0` (idle). OrcaSlicer polls Cmd 0 once a second
for up to 60 s, then waits up to 30 s for the Cmd 128 ack. `cc.mjs print` does the same.

**Why the printer hangs.** A start command with only `Filename` and `StartLayer`
gets no ack; then port 3030 refuses connections until a power cycle. Reproduced
with `cc.mjs` on V1.1.40 and V1.4.49, and independently on V1.1.40 by the Home
Assistant integration (`danielcherubini/elegoo-homeassistant` PR #297, closed
Feb 2026 as a "firmware limitation"). Both sent the two-field payload. Every
client reported working sends `Calibration_switch`, `PrintPlatformType` and
`Tlp_Switch`. The likely cause is that the SDCP service reads those keys without
checking they exist. This is an inference: the SDCP service is not in Elegoo's
published firmware source (`elegooofficial/CentauriCarbon`), so the handler
cannot be read.

If `print` still gets no ack or the printer stops answering, do not retry. Tell
the user to start the uploaded file from the touchscreen, and to power-cycle if
3030 stays closed.

Sources: `elegooofficial/elegoo-link`
(`src/lan/adapters/elegoo_fdm_cc/elegoo_fdm_cc_message_adapter.cpp`),
`OrcaSlicer/OrcaSlicer` (`src/slic3r/Utils/ElegooLink.cpp`), `bjan/pycentauri`
(`docs/PROTOCOL.md`), `WalkerFrederick/sdcp-centauri-carbon`,
`ChestnutLabs/printer-protocol-orchard` (`protocols/elegoo.md`).

Start-print acknowledgement (`Data.Ack`): `0` ok, `1` busy, `2` not found,
`3` MD5 failed, `4` file IO failed, `5` bad resolution, `6` unknown format,
`7` unknown model.

### Upload

`POST http://<ip>:3030/uploadFile/upload`, `multipart/form-data`, one request
per chunk of at most 1 MB (the limit Elegoo's `elegoo-link` SDK enforces). Fields:

- `S-File-MD5` — hex MD5 of the whole file
- `Check` — `1`
- `Offset` — byte offset of this chunk
- `Uuid` — same for every chunk of one transfer
- `TotalSize` — byte count of the whole file
- `File` — this chunk, with the file name

Each chunk answers `{ "code": "000000", "success": true }`. After the last chunk
the printer checks the file (`CurrentStatus` `8`); wait for it before Cmd 128.

### Status fields worth reading

`TempOfNozzle` / `TempTargetNozzle`, `TempOfHotbed` / `TempTargetHotbed`,
`CurrenCoord` (string `"x,y,z"`), `PrintInfo.Status`,
`PrintInfo.CurrentLayer` / `TotalLayer`, `PrintInfo.CurrentTicks` / `TotalTicks`,
`PrintInfo.Filename`, `PrintInfo.ErrorNumber`, `NetworkStatus`, `UsbDiskStatus`.

Machine state (`CurrentStatus`, may be an array): `0` idle, `1` printing,
`2` file transferring, `3` exposure testing (resin), `4` self-check,
`5` auto levelling, `6` resonance testing, `7` busy, `8` file checking,
`9` homing, `10` filament unloading, `11` PID detection.

Print status (`PrintInfo.Status`): `0` idle, `1` homing, `5` pausing, `6` paused,
`7` stopping, `8` stopped, `9` complete, `10` file checking, `11` printer checking,
`12` resuming, `13` printing, `14` stopped on error, `15` auto levelling,
`16` preheating, `17` resonance testing, `18` print started, `19`–`22` levelling /
preheating / homing / resonance completed, `23` auto feeding, `24` unloading,
`25` unloading abnormal, `26` unloading paused. (`2`–`4` are resin-only.)
Source: `elegooofficial/elegoo-link`, CC message adapter enums.

`PrintInfo.ErrorNumber`: `0` normal, `1` MD5 failed, `2` read failed,
`3` resolution mismatch, `4` format mismatch, `5` model mismatch.

### Protocol quirks — use the misspellings exactly

The protocol ships field names with spelling errors. Match them literally:

- `CurrenCoord` (not `CurrentCoord`)
- `RelaseFilmState` (not `ReleaseFilmState`)
- `MaximumCloudSDCPSercicesAllowed` (not `...Services...`)

Status and attribute data can appear at more than one nesting level (`Status`,
`Data.Status`, top level). When parsing, check several locations and both spellings.

Only `sdcp/response/*` messages wrap their payload in `Data`. On firmware V1.1.40,
`sdcp/status/*` and `sdcp/attributes/*` pushes carry `Status` / `Attributes` at the
top level. The printer clock can be wrong (`TimeStamp` months behind real time), so
never use it for staleness checks.

`XYZsize` is not the build volume. Firmware V1.1.40 reports `218.88x128.88x220`;
the real volume is 256³. Some spec examples show a generic `300x300x400`. Use 256³.

## Alternative: OpenCentauri COSMOS (Klipper + Moonraker)

If the printer was flashed with COSMOS it exposes Moonraker. `scripts/moonraker.mjs`
speaks the REST API (default port 80):

- `GET /printer/objects/query?print_stats&heater_bed&extruder&toolhead`
- `POST /server/files/upload` — multipart field `file`, optional `print=true`, `path`
- `POST /printer/print/start?filename=<path>`
- `POST /printer/print/pause` · `/printer/print/resume` · `/printer/print/cancel`
- `GET /server/files/list?root=gcodes`

Add `X-Api-Key: <key>` only if the user configured Moonraker auth; stock COSMOS
usually needs none on the LAN.

## Safety

- Verify state is idle before uploading/starting.
- Confirm the sliced profile matches the loaded filament and the 0.4 mm nozzle.
- Never start a print without the user's explicit confirmation (SKILL.md rule 6).
- Report error codes verbatim; do not invent a cause.
- The stock firmware phones home; on a managed network keep it on an isolated IoT
  VLAN. Do not expose port 3030 to the internet.

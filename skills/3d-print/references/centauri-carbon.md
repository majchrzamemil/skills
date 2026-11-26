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
| 128 | Start print | `{ "Filename": "<name>", "StartLayer": 0 }` |
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

Start-print acknowledgement (`Data.Ack`): `0` ok, `1` busy, `2` not found,
`3` MD5 failed, `4` file IO failed, `5` bad resolution, `6` unknown format,
`7` unknown model.

### Upload

`POST http://<ip>:3030/uploadFile/upload`, `multipart/form-data` with fields:

- `S-File-MD5` — hex MD5 of the file
- `Check` — `1`
- `Offset` — `0`
- `Uuid` — unique per transfer
- `TotalSize` — byte count
- `File` — the G-code file

Success: `{ "code": "000000", "success": true }`.

### Status fields worth reading

`TempOfNozzle` / `TempTargetNozzle`, `TempOfHotbed` / `TempTargetHotbed`,
`CurrenCoord` (string `"x,y,z"`), `PrintInfo.Status`,
`PrintInfo.CurrentLayer` / `TotalLayer`, `PrintInfo.CurrentTicks` / `TotalTicks`,
`PrintInfo.Filename`, `PrintInfo.ErrorNumber`, `NetworkStatus`, `UsbDiskStatus`.

Machine state (`CurrentStatus`): `0` idle, `1` printing, `2` file transfer,
`3` calibrating, `4` device testing.

Print status: `0` idle, `1` homing, `5` pausing, `6` paused, `7` stopping,
`8` stopped, `9` complete, `10` file checking.

`PrintInfo.ErrorNumber`: `0` normal, `1` MD5 failed, `2` read failed,
`3` resolution mismatch, `4` format mismatch, `5` model mismatch.

### Protocol quirks — use the misspellings exactly

The protocol ships field names with spelling errors. Match them literally:

- `CurrenCoord` (not `CurrentCoord`)
- `RelaseFilmState` (not `ReleaseFilmState`)
- `MaximumCloudSDCPSercicesAllowed` (not `...Services...`)

Status and attribute data can appear at more than one nesting level (`Status`,
`Data.Status`, top level). When parsing, check several locations and both spellings.

The build volume the machine reports is the real 256³; some spec examples show a
generic `300x300x400` — do not trust the example over the machine's own attributes.

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

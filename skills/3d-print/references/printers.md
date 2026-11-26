# Printers

Leg 1 is printer-independent, but it needs *a* build volume to check against. Leg 2
is written for the ELEGOO Centauri Carbon; other printers work through the generic
Moonraker/OctoPrint-style path or by hand.

## Specs that matter for modelling

| Printer | Build volume (mm) | Nozzle | Enclosure | Kinematics | Notes |
|---|---|---|---|---|---|
| ELEGOO Centauri Carbon | 256 × 256 × 256 | 0.4 mm hardened | yes | CoreXY | Stock firmware: SDCP. COSMOS flash: Klipper/Moonraker |
| Bambu Lab A1 / A1 mini | 256³ / 180³ | 0.4 mm | no / no | bed-slinger | LAN MQTT, not covered here |
| Bambu Lab P1S / X1C | 256³ | 0.4 mm | yes | CoreXY | LAN MQTT, not covered here |
| Prusa MK4S | 250 × 210 × 220 | 0.4 mm | no | bed-slinger | PrusaLink / Prusa Connect |
| Creality K1 / K1C | 220³ / 220³ | 0.4 mm | yes | CoreXY | Klipper/Moonraker |
| Voron 2.4 (350) | 350³ | 0.4 mm | depends | CoreXY | Klipper/Moonraker |
| Ender-3 (S1 / V2) | 220 × 220 × 250 | 0.4 mm | no | bed-slinger | Marlin; often via OctoPrint |

Numbers above are the common stock figures; confirm the exact machine before a
tight-fit print.

## Adding a printer

Add a row with at minimum: name, build volume `X × Y × Z`, nozzle diameter, and how
it is controlled (SDCP, Moonraker, OctoPrint, Bambu MQTT, or manual/USB). Leg 1 only
needs the build volume and nozzle; leg 2 needs the control path.

## What leg 1 checks

`scripts/openscad.mjs check` takes the printer's numbers as flags:

- `--bed X,Y,Z` (and `--margin`, default 5 mm): the bounding box fits the build volume;
- `--min-wall`: at least 2× the nozzle diameter (0.8 mm for a 0.4 mm nozzle);
- `--overhang`: steepest unsupported angle from vertical (45° is a safe default for
  a 0.4 mm direct-drive extruder).

If the user has not named a printer, ask, or assume a 220 × 220 × 250 mm bed and
state that assumption.

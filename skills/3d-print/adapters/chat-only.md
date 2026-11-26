# Adapter: no shell (chat-only host)

When the host has no shell, no file writer, and no way to run `openscad`, `slice.mjs`
or the printer scripts, the skill degrades to guidance plus artifacts you hand back
in the message.

## Leg 1 (design)

- Author the `.scad` and paste it in a code block.
- State the parameters, assumptions, print orientation and material.
- Give the exact commands the user runs locally:

  ```sh
  openscad -o model.stl model.scad
  openscad -o preview.png --imgsize 1024,768 --viewall --autocenter model.scad
  ```

- Do **not** claim to have rendered or validated the model. Say what remains to check.

## Leg 2 (print)

Without network access from a shell, you cannot talk to the printer. Hand over:

- the exact `orca-slicer --slice ... --load-settings "machine.json;process.json"`
  command with the profile paths for the user's install;
- the printer's IP and the SDCP/upload steps from `references/centauri-carbon.md`;
- a warning that the upload and start commands must be run from a machine on the
  printer's LAN.

Never fabricate a print result, a temperature, or a G-code file.

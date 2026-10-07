# Real MSX1 acceptance check

Use an MSX1 with 64 KB main RAM and an ASCII8-compatible cartridge that supports a full 1 MiB ROM. The test requires no network connection. Do not use a mapper autodetection result as proof that the cartridge is configured correctly: explicitly choose ASCII8 in the cartridge's loader where supported.

Build from the repository root:

```sh
node msx/tools/build.mjs
shasum -a 256 msx/out/village-demo.rom
```

Load `msx/out/village-demo.rom` using the cartridge's documented procedure. It contains a synthetic editable Demo plot at (0,0), a read-only Neighbor plot immediately west at (-1,0), and both house interiors. No accounts or private data are embedded. Flashing instructions depend on the cartridge model and are not assumed here.

1. Boot the cartridge. The exterior should show a small house, grass and path, with an avatar at the entrance. The ROM must boot without the website or any other media.
2. Press Enter to enter the house. Press Escape to leave. Repeat using Enter to leave from an interior position away from the entrance.
3. Press F1 to build, F2 to open the catalog, select a ground tile with arrows, and Space to close the catalog. Move away from the entrance and press Space to place it. F4 should erase it.
4. Press F3 to select objects, use F2 to choose a tree or furniture, and Space to place it. Confirm F4 removes the object. Repeat inside the house. Wait for temporary messages to disappear when checking the bottom two rows.
5. Leave an interior object in place. Outside, switch to tile mode and erase the entrance with F4. The interior should remain intact when you place the house-door tile at a new exterior position and enter it. Enter/Escape must always allow leaving the interior.
6. Press H to return to the home exterior. Walk west across its boundary into Neighbor. Approach the door at tile (16,12) and enter. The interior contains a bed at (16,10). F1, Space and F4 must not let you change this exhibit. Return with H and confirm your edits remain in your own RAM copy.
7. Press F5. It must explain that offline edits cannot be saved. Continue building; requesting a save must not freeze the game or clear your session's edits.
8. Restart or power-cycle. The original Demo content should return. Offline edits are intentionally temporary.
9. Repeat a cold boot and the neighbor/interior checks. Note any missing patterns, wrong exhibits, lockups or visible corruption, and whether the machine uses PAL or NTSC.

Report the MSX model, main RAM, cartridge model/firmware, mapper setting, ROM SHA-256, PAL/NTSC, and the first failed step (or that all steps passed). These results are required to close the physical-hardware acceptance criterion. C-BIOS OpenMSX tests already cover the corresponding software paths on both refresh rates, but cannot establish flash-cartridge compatibility.

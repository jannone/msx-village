# MSX Village ROM

Target: MSX1, 64 KB RAM, SCREEN 2, 1 MiB ASCII8 MegaROM. The game runs offline; edits stay in RAM and cannot be persisted without the browser bridge.

## Build and test

Install SDCC and a C++17 compiler. From the repository root, with Node.js 24+:

```sh
node msx/tools/build.mjs
python3 msx/tests/run.py
python3 msx/tests/run.py interaction
python3 msx/tests/run.py display
```

The build fetches the pinned MSXgl Git commit, compiles the converter and game, verifies RAM boundaries, generates `webapp/worker/rom-template.ts`, and creates owner and visitor demo snapshots in `msx/out`. `VILLAGE_SDCC_PATH` overrides the SDCC support-library directory; compiler tools must be on PATH. Defaults are `/opt/homebrew/share/sdcc/` on macOS and `/usr/share/sdcc/` elsewhere.

Tests use installed OpenMSX with isolated settings on C-BIOS MSX1 NTSC and PAL. They require explicit PASS reports and retain ROM hashes and logs. They check ownership slots, startup, mapper data, actual keyboard controls, house entry/exit, object placement, entrance removal preserving interiors, offline save behavior, browser handshake, neighbor visiting and home return, and VDP timing. Test outputs belong only to Village. The Beam Rider repository remains a read-only reference.

Real MSX1 hardware and the intended flash cartridge still need release validation.

The current production catalog has 30 objects and 113 logical art patterns. The
combined engine uses 3,922 bytes of ordinary RAM, ending at CF52 (174 bytes before
the fixed D000 owner buffer). The build rejects overlap with that buffer or the
A000 switched ROM window; measure this again before adding runtime arrays. Each
SCREEN 2 section assigns at most 256 native pattern/color slots from its 256 cells.

The cottage acceptance check must use normal play: select the Village roof and
wall pieces, place an entrance between wall sections, furnish the interior, save,
then load a fresh neighborhood and enter the house again. API serialization and
isolated collision tests support this check but do not replace the full playthrough.

## Medieval art study

The first herbalist garden/interior study has an independent build:

```sh
node msx/tools/build-art-study.mjs
python3 msx/tests/run-art-study.py
openmsx -machine C-BIOS_MSX1 -cart msx/out/artstudy.rom -romtype ASCII8
```

Arrows walk; Enter at the door enters; Enter/Escape exits. This preview has no
editing or saving. It does not replace the production ROM template. Artwork rules,
editable sources, current limitations, and integration milestones are in
[art/ART-GUIDE.md](art/ART-GUIDE.md). Native previews, emulator captures, budget
reports, and the ROM hash are generated under `out/art-study/`.

## Controls

Arrows move or choose catalog entries. F1 toggles building on your own plot, F2 opens the catalog, F3 switches tiles/objects, Z/X changes object category in the catalog, Space places in front of the avatar, F4 erases in front, F5 saves online or explains offline persistence, Enter uses the house entrance/exits, Escape closes menus or exits the interior, H returns home. Visitors cannot build. Removing or moving the entrance preserves the interior. An interior can always be exited with Enter or Escape.

## Movement and catalog

Normal play reserves no font patterns and shows no text banners. F2 opens a
full-screen catalog with controls. Necessary messages temporarily replace rows
16–23; Space/Enter/Escape closes the panel and consumes that input. Gameplay pauses
behind both interfaces. F5 can retry a failed save while its message is visible.

The display switches between scene (0), bottom panel (1), and full-screen catalog
(2); bridge byte 31 reports this diagnostic state without changing the save
protocol. Each section independently deduplicates its actual artwork and text,
assigning native slots 0–255. Text uses separate logical identities and occupies
slots only while visible. The loader restores pattern/color/name data from ROM
and settlement state on dismissal; catalog previews use the same allocator.
The display is blanked during transfers; sprites are hidden where they would
overlap the interface. Tests compare the restored VRAM bytes, including objects
across section boundaries and save results interrupting a catalog.

Walking advances pixels at 90 pixels/second, normalized to BIOS PAL/NTSC refresh rate. Perpendicular turns wait for an 8-pixel alignment unless blocked; reversals and turns away from obstacles remain possible; releasing input stops immediately. The collision footprint is the central 8×8 feet region at sprite offset (4,8). Solid ground and catalog objects block that footprint. Walkable decorations do not override underlying solid terrain. Background and collision data update when the scene changes, rather than being reconstructed on every walking frame.

The shared catalog in `webapp/shared/catalog.ts` generates the C footprint/solidity tables through `msx/tools/assets.mjs`. IDs 0–7 preserve their one-tile dimensions; IDs 8–11 add a large tree, dining table, double bed, and walkable flower patch. IDs 12–29 add medieval trees, furnishings, garden details, a 6×2 roof and 2×3 wall sections. Garden herbs, flowers, pots, and bottles are walkable; structural pieces and furniture are solid. Categories offer six full-footprint previews per page. The door remains separate and passable, with Enter interaction. Decorative objects render with background patterns; the hardware sprites are the avatar and build outline.

The build outline follows facing and previews the full footprint. Placement rejects plot edges, door overlap, and overlap with the player's feet. Object replacement removes all intersecting objects as whole placements; erasing any quadrant removes the whole object. Painting ground retains decorative objects. Placing a door clears intersecting exterior objects, keeps the interior, and moves the single entrance.

## Binary layout, version 3

Each bank is 8192 bytes. Banks 0–2 contain the resident engine and standard artwork; bank 3 is reserved. Bank 4 contains the `MSXV` snapshot header and 81 public plot records. Banks 5–85 contain a contiguous 9 × 9 neighborhood; banks 86–127 reserve 336 KiB for future artwork. The mapper window A000–BFFF is switched via 7800. Resident code must stay below A000.

Header bytes 0–3 are `MSXV`, 4 is format 3, 5–6 are region dimensions, 8 is the editable owner slot (255 for visitors), 9 is the starting center slot, 12–15 owner revision, 16–19 creation time, 20–23 signed center coordinates. Multibyte fields are little-endian. Metadata starts at 32, with 32 bytes per plot: occupied flag, revision at +4, public username at +8.

A settlement occupies 1744 bytes: format 3 at 0, avatar at 1, entrance coordinates at 4–5 (255 for absent), exterior tiles at 16, interior tiles at 784, exterior objects at 1552, interior objects at 1648. Each space has 768 tiles and up to 32 objects as kind/x/y triples; unused kind is 255. Entrance is a separate semantic 2×2 object anchored at its top-left tile, rendered with patterns 40–43. Tile arrays exclude 13. Standard decorative objects use background patterns to avoid MSX1 sprite-per-line limits; the player uses one 16×16 hardware sprite with four selectable appearances, each with two walking frames for up/down/left/right.

Owner data resides at D000; visit data and the frame buffer stay below D000. The bridge resides at E000: signature 0–3, online capability 4, save state 5 (idle/request/busy/success/failure/conflict = 0–5), dirty 6, interior 7, revision 8–11, owner slot 12, viewed slot 13, player feet tile x/y 14–15, selection 16, object mode 17, editing 18, ready 19, facing 20 (up/down/left/right = 0–3), walk frame 21, moving 22, build target x/y 23–24, target width 25, valid target 26, protocol version 27, avatar pixel x/y 28–29, BIOS refresh rate 30, display mode 31. Height is derived from the selected catalog entry. No credentials are embedded.

MSXgl and its included sample font carry upstream CC BY-SA notices, preserved in the pinned checkout. WebMSX’s pinned source mentions `license.txt`, but does not include it; upstream issue [#4](https://github.com/ppeccin/WebMSX/issues/4) tracks that missing declaration. No license is invented here.

# Complete herbalist art integration

The herbalist garden and cottage use the production editor, catalog, settlement
codec, and snapshot assembler. The isolated art-study renderer is retained as an
independent graphics reference. No production plot is seeded or overwritten by
these fixtures.

## Finished scope

- Refined broad oak, tiered pine, and compact fruit tree, using grouped highlights
  and shadows rather than evenly spaced canopy dots.
- Quieter plaster, roof seams, timber floor, and rug; improved fence silhouettes
  and tabletop contrast. Sand and brick have their own material glyphs.
- A 2×3 traveler bed and 3×2 herbalist worktable alongside existing compact furniture.
- The two-layer, four-direction animated traveler in four outfit palettes.
- Every glyph used by both sample rooms is reachable through the production
  terrain/object catalog. There are 23 terrain tools (including the entrance
  tool) and 32 decorative object definitions.

Terrain IDs 16–22 append tufts, cobblestones, riverbank, soil, roof eaves, dark
surrounds, and rug border. Object IDs 30–31 append the larger bed and worktable.
All earlier IDs retain dimensions, collision, and storage meanings. The binary
settlement remains format 3 / 1744 bytes; terrain IDs now have an explicit mapping
to native artwork slots. No D1 migration is required.

The complete exterior needs 14 placed objects; the interior needs 25. Both remain
below the 32-object limit. `production-herbalist.mjs` fails if any study glyph is
missing from the catalog, if reconstruction differs, or if the resulting content
fails normal settlement validation.

## Reproduce

From the repository root:

```sh
node msx/tools/build.mjs
node msx/tools/build-art-study.mjs
node msx/tools/build-herbalist-demo.mjs
python3 msx/tests/run.py herbalist
python3 msx/tests/run-art-study.py
python3 msx/tests/run.py avatar
python3 msx/tests/run.py display
python3 msx/tests/run.py interaction
python3 msx/tests/run.py startup
```

The production preview is `msx/out/herbalist/village-herbalist.rom`. It supports
ordinary editing and offline play. Enter the cottage through its entrance; Escape
exits. F2/F3 opens terrain/objects, Z/X changes object categories, F1 enables
building, and Space places the selected item in front of the traveler.

Generated evidence remains under ignored output directories:

- `out/herbalist/settlement.json` and `settlement.bin`: valid saved content.
- `out/herbalist/*-exterior.png` and `*-interior.png`: production MSX captures.
- `out/herbalist/from-local-api.rom`: a fresh ROM fetched after saving both rooms
  through local Worker/D1 using `webapp/tests/api.mjs`.
- `out/tests/*-herbalist.txt`: production renderer acceptance reports.
- `out/art-study/`: independent reference ROM, captures, and graphics budget.

The production fixture compares all 768 pattern/color cells in each room with
source study artwork, checks door entry/exit, catalog and bottom-panel restoration,
and places newly added terrain through game input. The API suite verifies
ownership, stale revisions, full content persistence and a fresh ROM round trip.
Tests never write to production D1. The menu fixture enters the interior through
normal door input to avoid racing a draw with debugger room-state changes.

The knight/cartographer collections, custom asset authoring, and real hardware
acceptance remain separate work. This milestone completes the original herbalist
study's refinement and production integration.

## Verified build — 2026-10-08

PAL (50 Hz) and NTSC (60 Hz) passed: two complete-room production checks, two
independent study checks, and sixteen owner/visitor startup, interaction, display,
and avatar checks. All reported zero detected unsafe VRAM accesses. The web
production build, TypeScript, settlement codec/validation, save acknowledgement,
and local Worker/D1 suites passed.

The standard production atlas uses 123 patterns; normal scenes reserve no font
slots. The engine uses 3924 bytes of ordinary RAM, ending at CF54 before the D000
owner buffer. The tested resident core SHA-256 is
`27247527ecef2f1e7f3bcfd8f2ece2316f5d4e42126612b7d05a99cdeefdcf07`.
The deterministic complete-room production preview SHA-256 is
`79d45cf173d5020efe978a18bedcc125684d374bd3925063b765601a70a0688f`.

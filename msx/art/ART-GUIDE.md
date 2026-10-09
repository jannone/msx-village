# Village art direction: a quiet place between journeys

Status: refined herbalist artwork integrated into the production catalog and
save format. Production-ROM acceptance is documented in
[HERBALIST-INTEGRATION.md](HERBALIST-INTEGRATION.md).

## Intent

Build a peaceful medieval village at the edge of an adventure. Use the readable
top-down scenery of A Link to the Past and the inhabited villages of Chrono Trigger
as reference points. All production artwork is original Village artwork.

Players express a history through belongings: herbs and bottles, an old shield and
banner, or maps and books. These suggest the herbalist, retired knight, and
cartographer collections. They do not introduce combat, quests, crafting, or an
economy. Each plot remains a small independent exhibit.

## Drawing rules

- Draw at native resolution: 8x8 base tiles, 256x192 rooms, 16x16 avatar frames.
- Use top-down ground with visible front faces for trees, buildings, and furniture.
  Keep the perspective consistent; no isometric diamonds.
- Prioritize silhouette before texture. Distinguish a broad oak, conical pine,
  compact orchard tree, and small sapling by shape as well as size.
- Keep grass quiet. Reserve stronger texture for roofs, stonework, and selected
  objects. Empty space and clear approaches to doors are part of the composition.
- Use an upper-left light direction where the two-color row budget permits it.
  Shapes must still read without simulated lighting or gradients.
- Use the fixed MSX color indices. Green foliage, red roofs, yellow timber, gray
  stone, blue cloth/water, and small bright highlights establish the material families.
  The MSX palette is considerably brighter than the generated mood board.
- SCREEN 2 allows two colors per horizontal eight-pixel row. Assign that pair
  deliberately. The exporter must not hide invalid art through quantization.
- Preview at 1x and nearest-neighbor enlargement. RGB preview values approximate
  the TMS9918 output; emulator captures and hardware take precedence.
- Reserve no font slots in a normal scene. The art study has no text overlay.
  Production text temporarily takes over either the bottom eight rows or the
  entire screen; artwork must be restored when the interface closes.

## Scale and object vocabulary

| Object | Study footprint | Purpose |
| --- | --- | --- |
| Old oak | 5x5 tiles / 40x40 pixels | A garden landmark |
| Pine | 3x4 / 24x32 | A narrow, vertical silhouette |
| Orchard tree | 3x3 / 24x24 | A compact fruit-bearing garden tree |
| Entrance | 2x2 / 16x16 | Consistent with the existing game door |
| Well, small bed/table, hearth | 2x2 / 16x16 | Compact furnishings retained at their original sizes |
| Traveler bed / herbalist worktable | 2x3 / 3x2 | Full-length bedding and a broad work surface |
| Shrine | 1x2 / 8x16 | A modest hint of a larger world |
| Cottage roof / wall section | 6x2 / 2x3 tiles | Modular building pieces in the production catalog |

The study uses whole rectangular solid footprints. Its scenery is assembled from
background tiles. Canopy occlusion and trunk-only collision remain a later design
decision. No generated artwork dimensions are taken as authoritative.

The first two rooms are the herbalist garden and cottage. Review tree/body scale,
house proportions, door visibility, furniture recognition, and walking clearance.
The refinement pass replaces dotted canopies with clustered light/shadow shapes,
adds fruit accents, reduces roof and floor line noise, opens the plaster surfaces,
and gives the rug a quiet center. Larger bedding and a contrasting worktable
provide clearer proportions beside the 16x16 traveler. Native captures remain
the reference for future refinements.

## Avatar integration

One 16x16 traveler has up/down/left/right appearances and two walking frames per
direction. Two overlapping single-color sprites supply a blue silhouette and
yellow face/trim. This consumes two hardware sprites on each affected scanline;
the production editor cursor uses at most two more on a scanline. The main game
now imports these same frames with four selectable outfit palettes (Snow, Sunshine,
Poppy, Sky). Yellow face/trim is used except with Sunshine, which uses white for
contrast. Production tests cover both layers, every catalog footprint in all four
directions, and layer hiding/restoration during temporary text interfaces. Future
sprite objects must respect the remaining scanline budget.

## Editing the PNG sheet

Export every original background glyph, complete catalog object, entrance, terrain
entry, traveler frame in all four production palettes and the study palette, and
build cursor into one lossless PNG:

```sh
node msx/tools/export-art-sheet.mjs
```

The editable file is `msx/out/art-sheet/all-art.png` (512x1086 at the current catalog
size), with **8 native pixels of transparent spacing** between asset-and-caption
blocks. Each caption sits 4px below its artwork and uses an original 3x5 pixel font
with 1px between letters. Long names wrap with 2px between lines; white text on a
black backing remains readable on an editor's checkerboard. Captions are ignored
during import. Objects retain contiguous internal 8x8 cells. `all-art.json` records exact bounds,
source identities, palette mappings, and original source bits/color pairs. Keep it
with the PNG. `all-art-guide.html` labels every element and shows its coordinates;
`all-art-preview-4x.png` is a nearest-neighbor viewing copy, not an import source.
The swatches at the bottom of the native sheet provide exact MSX palette colors.
The upstream sample UI font is not original Village art and is not part of this
sheet. Room arrangements, footprints, IDs, solidity, and palettes remain catalog
or game definitions rather than editable image properties.

Edit the native PNG using a pixel pencil, without antialiasing, resizing, cropping,
or moving elements. Save an 8-bit RGB/RGBA or indexed PNG without interlacing.
Background cells must stay opaque and use at most two MSX colors in each horizontal
8-pixel row; that constraint applies separately to each cell of a larger object.
Avatar pixels use the two colors shown for that appearance and full transparency;
cursors use white and full transparency. Changing the traveler silhouette updates
all outfit appearances. PNG compression remains lossless at any compression level.

The complete-object, terrain, and source-glyph areas deliberately repeat shared
art. You can edit one copy; unchanged copies are ignored during import. If you
change several copies of the same source cell, the changed copies must agree.
For example, cottage roof cells share `roof`, and furnishings share some bedding
and timber glyphs. Conflicting copies are rejected with their element names, so
no art is silently overwritten. Use the guide/map to identify shared cells.

Validate and import with the map from the original export (an explicit map path
also allows the edited PNG to have a different filename):

```sh
node msx/tools/import-art-sheet.mjs /path/to/edited.png msx/out/art-sheet/all-art.json --check
node msx/tools/import-art-sheet.mjs /path/to/edited.png msx/out/art-sheet/all-art.json
node msx/tools/build.mjs
node msx/tools/build-art-study.mjs
node msx/tools/build-herbalist-demo.mjs
python3 msx/tests/run.py herbalist
python3 msx/tests/run-art-study.py
```

Imports validate the entire sheet, shared copies, current-source fingerprint, and
production pattern budget before atomically writing `msx/art/overrides.json`.
Invalid colors are rejected; they are never quantized. The importer preserves
unchanged source bytes, including invisible foreground/background information.
Overrides are reviewable source data used by both production and study builds;
catalog footprints and storage IDs are unaffected by pixel edits. No ROM or
live website is published by the importer. After an import, export a fresh sheet
for the next editing session; an old map is rejected if its source art has changed.
Back up an edited PNG/map before exporting to the same output location.

Optional output path and workflow regression:

```sh
node msx/tools/export-art-sheet.mjs /path/to/my-art.png
node msx/tests/art-sheet.mjs
```

## Reproducible source and review

- `herbalist.mjs`: editable glyph rows, per-row color pairs, tree silhouettes,
  object definitions, scene composition, and avatar pixels.
- `../tools/art-study.mjs`: validates the source and exports the C header, tile
  atlas, exact indexed scene previews, and a graphics budget report.
- `../artstudy.c`: isolated native SCREEN 2 art-study ROM with walking, collision,
  entrance interaction, and interior exit. It uses the same movement conventions
  as Village but is not connected to settlement editing or browser saves.
- `herbalist.generated.h`: generated file; edit the source, then rebuild.

From the repository root:

```sh
node msx/tools/build-art-study.mjs
python3 msx/tests/run-art-study.py
openmsx -machine C-BIOS_MSX1 -cart msx/out/artstudy.rom -romtype ASCII8
```

Arrows walk. Approach the door and press Enter. Enter or Escape exits the interior.
The study has no editing or save controls.

Generated ROMs, captures, logs, previews, and `budget.json` are under `msx/out/` and
remain outside Git. The build does not replace the production ROM template.

Tests verify pattern/color bytes in all three SCREEN 2 regions, 16x16 sprite mode,
two avatar layers, four-direction walking and animation, solid furniture collision,
entrance/exit, PAL/NTSC speed, and VRAM timing. Captures retain the actual emulator
output and the report records the tested ROM hash. Real hardware validation is
still required before release.

## Following milestones

1. Complete: refined foliage, material textures, and furniture proportions.
2. Complete: every glyph used by both sample rooms is available through production
   terrain or objects; 23 terrain tools and 20 medieval objects. Prototype assets are removed.
3. Complete: both rooms reconstruct exactly in the production renderer, with
   normal entrances, catalog editing, temporary text, and save/snapshot encoding.
4. Next collection: knight and cartographer objects sharing these materials.
5. Real MSX1 hardware/flash-cartridge acceptance remains pending.

Keep future custom artwork compatible with the asset definitions. Its authoring
UI and per-player quotas remain a separate milestone.

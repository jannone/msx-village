import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSheet, importSheet } from '../tools/art-sheet.mjs';
import { encodePNG, decodePNG } from '../tools/png.mjs';
import { overridesPath } from '../art/overrides.mjs';
import { buildArtwork } from '../tools/production-art.mjs';
import { tiles, palette } from '../art/herbalist.mjs';

const sheet = createSheet(), {manifest} = sheet, before = buildArtwork();
const originalOverrides = readFileSync(overridesPath);
const baseline = importSheet(sheet.png, manifest);
assert.equal(baseline.changed.length, 0);
assert.deepEqual(baseline.overrides, JSON.parse(originalOverrides));
assert.deepEqual(decodePNG(sheet.png).rgba, sheet.rgba);
assert.equal(manifest.spacing, 8);
for (const [i, entry] of manifest.entries.entries()) {
  const a = entry.bounds;
  assert.ok(entry.caption.y >= entry.y + entry.height + 4, `Caption touches artwork: ${entry.name}`);
  assert.ok(a.x >= 8 && a.x + a.width + 8 <= manifest.width && a.y + a.height <= manifest.height, `Clipped caption: ${entry.name}`);
  for (const other of manifest.entries.slice(i + 1)) {
    const b = other.bounds;
    assert.ok(a.x + a.width + 8 <= b.x || b.x + b.width + 8 <= a.x || a.y + a.height + 8 <= b.y || b.y + b.height + 8 <= a.y, `Caption/asset gutter missing: ${entry.name}, ${other.name}`);
  }
}
const captionEdit = Buffer.from(sheet.rgba), caption = manifest.entries[0].caption;
captionEdit.set([1, 2, 3, 255], (caption.y * manifest.width + caption.x) * 4);
assert.equal(importSheet(encodePNG(manifest.width, manifest.height, captionEdit), manifest).changed.length, 0);
assert.equal(new Set(manifest.entries.flatMap(e => e.cells.map(c => c.key))).size, Object.keys(manifest.sources).length);
const entry = (group, name) => manifest.entries.find(e => e.group === group && e.name === name);
const patch = (rgba, e, x, y, color) => {
  const value = color === null ? [0, 0, 0, 0] : [...[0, 2, 4].map(i => parseInt(palette[color].slice(i, i + 2), 16)), 255];
  rgba.set(value, ((e.y + y) * manifest.width + e.x + x) * 4);
};
const rgba = Buffer.from(sheet.rgba);
const flipTile = (e, x, y) => {
  const cell = e.cells.find(c => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size);
  const source = manifest.sources[cell.key], sy = y - cell.y, sx = x - cell.x;
  const current = source.colors[sy][source.rows[sy][sx] === '#' ? 0 : 1];
  patch(rgba, e, x, y, source.colors[sy].find(c => c !== current) ?? current % 15 + 1);
};
flipTile(entry('Terrain', '0: Grass'), 0, 0);
flipTile(entry('Objects', '0: Old oak'), 0, 0); // edit the full object, not its source copy
flipTile(entry('Objects', 'House entrance (2x2)'), 0, 8);
patch(rgba, entry('Avatars', 'Snow: up frame 1'), 0, 0, manifest.sources['avatar:0'].rows[0][0] === '.' ? 15 : null);
patch(rgba, entry('Cursors', '8x8 outline'), 2, 2, manifest.sources['cursor:0'].rows[2][2] === '.' ? 15 : null);
const edited = encodePNG(manifest.width, manifest.height, rgba), proposed = importSheet(edited, manifest);
assert.deepEqual(new Set(proposed.changed), new Set(['tile:grass', 'tile:oak-0-0', 'tile:doorBL', 'avatar:0', 'cursor:0']));
const artwork = buildArtwork(proposed.overrides);
for (const [a,b] of [[artwork.terrainPatterns[0],before.terrainPatterns[0]],[artwork.objectCells[0],before.objectCells[0]],[artwork.doorPatterns[2],before.doorPatterns[2]]]) assert.notDeepEqual(artwork.atlas[a], before.atlas[b]);
for (const id of [0, 16]) assert.notDeepEqual(artwork.sprites[id], before.sprites[id]);
assert.deepEqual(before, buildArtwork()); // validation did not mutate loaded source
const conflict = Buffer.from(rgba);
const originalGrass = manifest.sources['tile:grass'].rows[0].split('').map(c => manifest.sources['tile:grass'].colors[0][c === '#' ? 0 : 1]);
const editedGrass = proposed.overrides.tiles.grass.rows[0].split('').map(c => proposed.overrides.tiles.grass.colors[0][c === '#' ? 0 : 1]);
const conflictColor = Array.from({length: 15}, (_, i) => i + 1).find(c => !originalGrass.every(v => v === c) && !editedGrass.every(v => v === c));
for (let x = 0; x < 8; x++) patch(conflict, entry('Source glyphs', 'grass'), x, 0, conflictColor);
assert.throws(() => importSheet(encodePNG(manifest.width, manifest.height, conflict), manifest), /Conflicting edits/);
const threeColors = Buffer.from(sheet.rgba);
[2, 3, 4].forEach((c, x) => patch(threeColors, entry('Terrain', '2: Water'), x, 1, c));
assert.throws(() => importSheet(encodePNG(manifest.width, manifest.height, threeColors), manifest), /at most two colors/);
const alpha = Buffer.from(sheet.rgba);
patch(alpha, entry('Terrain', '0: Grass'), 0, 0, null);
assert.throws(() => importSheet(encodePNG(manifest.width, manifest.height, alpha), manifest), /must be opaque/);
const wrongColor = Buffer.from(sheet.rgba);
wrongColor.set([1, 2, 3, 255], (entry('Terrain', '0: Grass').y * manifest.width + entry('Terrain', '0: Grass').x) * 4);
assert.throws(() => importSheet(encodePNG(manifest.width, manifest.height, wrongColor), manifest), /outside the MSX palette/);
assert.throws(() => importSheet(sheet.png, {...manifest, width: 1}), /stale or modified/);
assert.throws(() => importSheet(encodePNG(1, 1, Buffer.alloc(4)), manifest), /native sheet dimensions/);
const invalid = Buffer.from(sheet.png); invalid[100] ^= 1;
assert.throws(() => importSheet(invalid, manifest), /checksum/);

// Exercise actual CLI persistence and fresh modules, then restore the user's art.
const temp = mkdtempSync(join(tmpdir(), 'village-art-sheet-'));
try {
  const png = join(temp, 'edited.png'), map = join(temp, 'map.json');
  writeFileSync(png, edited); writeFileSync(map, JSON.stringify(manifest));
  execFileSync(process.execPath, ['msx/tools/import-art-sheet.mjs', png, map, '--check']);
  assert.deepEqual(readFileSync(overridesPath), originalOverrides);
  execFileSync(process.execPath, ['msx/tools/import-art-sheet.mjs', png, map]);
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { tiles, avatars } from './msx/art/herbalist.mjs';
    import { buildArtwork } from './msx/tools/production-art.mjs';
    assert.deepEqual(tiles.find(t => t.name === 'grass').rows, ${JSON.stringify(proposed.overrides.tiles.grass.rows)});
    assert.deepEqual(avatars[0], ${JSON.stringify(proposed.overrides.avatars[0])});
    assert.deepEqual(buildArtwork().atlas[0], ${JSON.stringify(artwork.atlas[0])});
  `]);
  assert.throws(() => execFileSync(process.execPath, ['msx/tools/import-art-sheet.mjs', png, map], {stdio: 'pipe'}), /stale or modified/);
  execFileSync(process.execPath, ['msx/tools/export-art-sheet.mjs', join(temp, 'new.png')]);
  const fresh = JSON.parse(readFileSync(join(temp, 'new.json')));
  assert.deepEqual(fresh.sources['tile:grass'].rows, proposed.overrides.tiles.grass.rows);
  execFileSync(process.execPath, ['msx/tools/import-art-sheet.mjs', join(temp, 'new.png'), '--check']);
} finally { writeFileSync(overridesPath, originalOverrides); rmSync(temp, {recursive: true, force: true}); }
assert.deepEqual(tiles.find(t => t.name === 'grass').rows, manifest.sources['tile:grass'].rows);
console.log(`PASS: lossless round trip, ${manifest.entries.length} spaced elements, complete source coverage, five edit types, shared-copy conflicts, MSX validation, atomic CLI import, fresh re-export.`);

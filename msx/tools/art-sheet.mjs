import { createHash } from 'node:crypto';
import { tiles, objects, avatars, palette } from '../art/herbalist.mjs';
import { OBJECT_CATALOG, TERRAIN_CATALOG } from '../../webapp/shared/catalog.ts';
import { buildArtwork } from './production-art.mjs';
import { readArtOverrides } from '../art/overrides.mjs';
import { encodePNG, decodePNG } from './png.mjs';
import { captionLines, textWidth, drawCaption } from './pixel-font.mjs';

const rgb = palette.map(hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)));
const cursorNames = ['8x8 outline', '16x16 outline', '8x16 outline', '16x8 outline', 'top left', 'top right', 'bottom left', 'bottom right', '8px left end', '8px right end', '16px left end', '16px right end'];
const directions = ['up', 'down', 'left', 'right'];
const tilePixels = tile => tile.rows.flatMap((row, y) => [...row].map(c => tile.colors[y][c === '#' ? 0 : 1]));
const cursorRows = pattern => Array.from({length: 16}, (_, y) => [pattern[y], pattern[y + 16]].map(b => b.toString(2).padStart(8, '0').replaceAll('0', '.').replaceAll('1', '#')).join(''));
function pixels(source) {
  return source.kind === 'tile' ? tilePixels(source) : source.rows.flatMap(row => [...row]);
}
function color(source, pixel, colors) {
  if (source.kind === 'tile') return [...rgb[pixel], 255];
  return pixel === '.' ? [0, 0, 0, 0] : [...rgb[colors[pixel]], 255];
}

export function createSheet() {
  const {sprites} = buildArtwork();
  const sources = {};
  for (const tile of tiles) sources[`tile:${tile.name}`] = {kind: 'tile', rows: tile.rows, colors: tile.colors};
  avatars.forEach((rows, id) => sources[`avatar:${id}`] = {kind: 'avatar', rows});
  for (let id = 0; id < 12; id++) sources[`cursor:${id}`] = {kind: 'cursor', rows: cursorRows(sprites[16 + id])};
  const entries = [], width = 512, spacing = 8;
  let x = spacing, y = spacing, rowHeight = 0;
  const section = () => { x = spacing; y += rowHeight + spacing * 2; rowHeight = 0; };
  const add = (name, group, grid, colors = {}) => {
    const size = sources[grid[0][0]].kind === 'tile' ? 8 : 16;
    const w = grid[0].length * size, h = grid.length * size;
    const lines = captionLines(name), captionWidth = Math.max(...lines.map(textWidth)) + 2;
    const captionHeight = lines.length * 7, boxWidth = Math.max(w, captionWidth), boxHeight = h + 4 + captionHeight;
    if (x + boxWidth + spacing > width) { x = spacing; y += rowHeight + spacing; rowHeight = 0; }
    const caption = {x: x + Math.floor((boxWidth - captionWidth) / 2), y: y + h + 4, width: captionWidth, height: captionHeight, lines};
    entries.push({name, group, x: x + Math.floor((boxWidth - w) / 2), y, width: w, height: h,
      caption, bounds: {x, y, width: boxWidth, height: boxHeight},
      cells: grid.flatMap((row, cy) => row.map((key, cx) => ({key, x: cx * size, y: cy * size, size, colors})))});
    x += boxWidth + spacing; rowHeight = Math.max(rowHeight, boxHeight);
  };
  for (const [id, object] of OBJECT_CATALOG.entries()) {
    const grid = (objects.find(o => o.name === object.art)?.grid ?? [[object.art]]).map(row => row.map(name => `tile:${name}`));
    add(`${id}: ${object.name}`, 'Objects', grid);
  }
  add('House entrance (2x2)', 'Objects', [['tile:doorTL', 'tile:doorTR'], ['tile:doorBL', 'tile:doorBR']]);
  section();
  TERRAIN_CATALOG.forEach((t, id) => add(`${id}: ${t.name}`, 'Terrain', [[`tile:${t.art}`]]));
  section();
  for (const [name, colors] of [['Study traveler', {B: 4, Y: 11}], ['Snow', {B: 15, Y: 11}], ['Sunshine', {B: 10, Y: 15}], ['Poppy', {B: 9, Y: 11}], ['Sky', {B: 7, Y: 11}]]) {
    for (let id = 0; id < 8; id++) add(`${name}: ${directions[id >> 1]} frame ${id % 2 + 1}`, 'Avatars', [[`avatar:${id}`]], colors);
  }
  section();
  cursorNames.forEach((name, id) => add(name, 'Cursors', [[`cursor:${id}`]], {'#': 15}));
  section();
  tiles.forEach(tile => add(tile.name, 'Source glyphs', [[`tile:${tile.name}`]]));
  section();
  const paletteSwatches = palette.slice(1).map((hex, i) => ({index: i + 1, hex, x: spacing + i * 20, y, width: 8, height: 8,
    caption: {x: spacing + i * 20, y: y + 12, width: 9, height: 7, lines: [String(i + 1)]}}));
  const height = y + 19 + spacing, rgba = Buffer.alloc(width * height * 4);
  for (const entry of entries) for (const cell of entry.cells) {
    const source = sources[cell.key];
    pixels(source).forEach((pixel, i) => {
      const at = ((entry.y + cell.y + Math.floor(i / cell.size)) * width + entry.x + cell.x + i % cell.size) * 4;
      rgba.set(color(source, pixel, cell.colors), at);
    });
  }
  for (const entry of entries) drawCaption(rgba, width, entry.caption);
  for (const swatch of paletteSwatches) for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) rgba.set([...rgb[swatch.index], 255], ((swatch.y + dy) * width + swatch.x + dx) * 4);
  for (const swatch of paletteSwatches) drawCaption(rgba, width, swatch.caption);
  const manifest = {version: 1, width, height, spacing, captionFont: {width: 3, height: 5, letterSpacing: 1, lineSpacing: 2}, palette, paletteSwatches, entries, sources};
  manifest.sourceHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  return {manifest, rgba, png: encodePNG(width, height, rgba)};
}

function decodeCell(image, entry, cell, source) {
  const result = [];
  for (let y = 0; y < cell.size; y++) for (let x = 0; x < cell.size; x++) {
    const pos = ((entry.y + cell.y + y) * image.width + entry.x + cell.x + x) * 4;
    const [r, g, b, a] = image.rgba.subarray(pos, pos + 4);
    const where = `${entry.name}, pixel (${cell.x + x}, ${cell.y + y})`;
    if (source.kind !== 'tile' && a === 0) { result.push('.'); continue; }
    if (a !== 255) throw Error(`${where}: ${source.kind === 'tile' ? 'background tiles must be opaque' : 'use fully transparent or opaque pixels'}`);
    const match = rgb.findIndex((v, id) => id > 0 && v[0] === r && v[1] === g && v[2] === b);
    if (match < 1) throw Error(`${where}: RGB ${r},${g},${b} is outside the MSX palette`);
    if (source.kind === 'tile') result.push(match);
    else {
      const symbol = Object.keys(cell.colors).find(symbol => cell.colors[symbol] === match);
      if (!symbol) throw Error(`${where}: use only this sprite's two layer colors (cursor: white) and transparency`);
      result.push(symbol);
    }
  }
  if (source.kind === 'tile') for (let row = 0; row < 8; row++) {
    if (new Set(result.slice(row * 8, row * 8 + 8)).size > 2) throw Error(`${entry.name}, cell (${cell.x}, ${cell.y}), row ${row}: SCREEN 2 permits at most two colors per 8-pixel row`);
  }
  return result;
}
function encodeTile(values, original) {
  const rows = [], colors = [];
  for (let y = 0; y < 8; y++) {
    const row = values.slice(y * 8, y * 8 + 8), used = [...new Set(row)];
    if (JSON.stringify(row) === JSON.stringify(tilePixels(original).slice(y * 8, y * 8 + 8))) {
      rows.push(original.rows[y]); colors.push(original.colors[y]); continue;
    }
    let [fg, bg] = original.colors[y];
    if (!used.every(c => c === fg || c === bg)) {
      bg = used.includes(bg) ? bg : used[0]; fg = used.find(c => c !== bg) ?? bg;
    }
    colors.push([fg, bg]); rows.push(row.map(c => c === fg && fg !== bg ? '#' : '.').join(''));
  }
  return {rows, colors};
}
// Validate everything and return proposed overrides before writing any source.
export function importSheet(png, manifest) {
  const current = createSheet().manifest;
  if (JSON.stringify(current) !== JSON.stringify(manifest)) throw Error('Sheet map is stale or modified. Export a fresh sheet from the current artwork before editing.');
  const image = decodePNG(png);
  if (image.width !== manifest.width || image.height !== manifest.height) throw Error(`Keep native sheet dimensions ${manifest.width}x${manifest.height}; do not resize or crop`);
  const edits = new Map();
  for (const entry of manifest.entries) for (const cell of entry.cells) {
    const source = manifest.sources[cell.key], values = decodeCell(image, entry, cell, source);
    if (JSON.stringify(values) === JSON.stringify(pixels(source))) continue;
    const previous = edits.get(cell.key);
    if (previous && JSON.stringify(previous.values) !== JSON.stringify(values)) throw Error(`Conflicting edits to shared ${cell.key}: ${previous.name} and ${entry.name}. Make the changed copies identical or edit only one copy.`);
    edits.set(cell.key, {values, name: entry.name});
  }
  const overrides = readArtOverrides();
  for (const [key, {values}] of edits) {
    const colon = key.indexOf(':'), kind = key.slice(0, colon), id = key.slice(colon + 1);
    if (kind === 'tile') {
      overrides.tiles[id] = encodeTile(values, manifest.sources[key]);
    } else if (kind === 'avatar') overrides.avatars[id] = Array.from({length: 16}, (_, y) => values.slice(y * 16, y * 16 + 16).join(''));
    else overrides.cursors[id] = [0, 8].flatMap(x => Array.from({length: 16}, (_, y) => values.slice(y * 16 + x, y * 16 + x + 8).reduce((n, c) => n * 2 + +(c === '#'), 0)));
  }
  buildArtwork(overrides); // Reject edits that exceed the production atlas budget before writing.
  return {overrides, changed: [...edits.keys()]};
}

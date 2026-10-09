import { readFileSync } from 'node:fs';

export const overridesPath = new URL('./overrides.json', import.meta.url);
export function readArtOverrides() {
  const value = JSON.parse(readFileSync(overridesPath, 'utf8'));
  if (value.version !== 1) throw Error('Unsupported artwork override version');
  for (const group of ['tiles', 'avatars', 'cursors']) {
    if (!value[group] || typeof value[group] !== 'object' || Array.isArray(value[group])) throw Error(`Invalid ${group} overrides`);
  }
  for (const [name, tile] of Object.entries(value.tiles)) {
    if (tile.rows?.length !== 8 || tile.rows.some(r => typeof r !== 'string' || !/^[.#]{8}$/.test(r)) ||
        tile.colors?.length !== 8 || tile.colors.some(r => !Array.isArray(r) || r.length !== 2 || r.some(c => !Number.isInteger(c) || c < 1 || c > 15))) throw Error(`Invalid tile override: ${name}`);
  }
  const bytes = (v, length) => Array.isArray(v) && v.length === length && v.every(b => Number.isInteger(b) && b >= 0 && b <= 255);
  for (const [id, frame] of Object.entries(value.avatars)) {
    if (!/^[0-7]$/.test(id) || !Array.isArray(frame) || frame.length !== 16 || frame.some(r => typeof r !== 'string' || !/^[.BY]{16}$/.test(r))) throw Error(`Invalid avatar override: ${id}`);
  }
  for (const [id, pattern] of Object.entries(value.cursors)) {
    if (!bytes(pattern, 32)) throw Error(`Invalid cursor override: ${id}`);
  }
  return value;
}

export function applySourceOverrides(tiles, avatars) {
  const overrides = readArtOverrides();
  for (const [name, tile] of Object.entries(overrides.tiles)) {
    const target = tiles.find(t => t.name === name);
    if (!target) throw Error(`Unknown overridden glyph: ${name}`);
    Object.assign(target, tile);
  }
  for (const [id, frame] of Object.entries(overrides.avatars)) avatars[+id] = frame;
}

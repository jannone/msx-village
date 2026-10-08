import { OBJECT_CATALOG, TERRAIN_CATALOG, DOOR_SIZE } from './catalog.ts';
export const WIDTH = 32;
export const HEIGHT = 24;
export const CELLS = WIDTH * HEIGHT;
export const DATA_SIZE = 1744;
export const BRIDGE_ADDRESS = 0xe000;
export const OWNER_ADDRESS = 0xd000;
export const TILE_NAMES = TERRAIN_CATALOG.map(tile => tile.name);
export const OBJECT_NAMES = OBJECT_CATALOG.map(object => object.name);
export interface PlacedObject { kind: number; x: number; y: number }
export interface Settlement {
  formatVersion: 3;
  avatar: number;
  exterior: number[];
  interior: number[];
  exteriorObjects: PlacedObject[];
  interiorObjects: PlacedObject[];
  door: { x: number; y: number } | null;
}

export function initialSettlement(occupied = true): Settlement {
  const exterior = Array<number>(CELLS).fill(0);
  const interior = Array<number>(CELLS).fill(6);
  if (occupied) {
    for (let y = 7; y < 13; y++) for (let x = 12; x < 20; x++) exterior[y * WIDTH + x] = y < 9 ? 4 : 3;
    for (let y = 13; y < HEIGHT; y++) exterior[y * WIDTH + 16] = 1;
    for (let x = 0; x < WIDTH; x++) interior[x] = 3;
    for (let y = 1; y < HEIGHT; y++) { interior[y * WIDTH] = 3; interior[y * WIDTH + 31] = 3; }
  }
  return { formatVersion: 3, avatar: 0, exterior, interior, exteriorObjects: [], interiorObjects: [], door: occupied ? { x: 16, y: 12 } : null };
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}
export function validateSettlement(input: unknown): Settlement {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settlement');
  const s = input as Record<string, unknown>;
  const fields = ['formatVersion', 'avatar', 'exterior', 'interior', 'exteriorObjects', 'interiorObjects', 'door'];
  if (Object.keys(s).some(key => !fields.includes(key)) || s.formatVersion !== 3 || !integer(s.avatar, 0, 3)) throw new Error('Unsupported settlement fields');
  for (const field of ['exterior', 'interior']) {
    const map = s[field];
    if (!Array.isArray(map) || map.length !== CELLS || !map.every(tile => integer(tile, 0, TERRAIN_CATALOG.length - 1) && tile !== 13)) throw new Error('Invalid tile map');
  }
  for (const field of ['exteriorObjects', 'interiorObjects']) {
    const objects = s[field];
    if (!Array.isArray(objects) || objects.length > 32) throw new Error('At most 32 objects per space');
    const occupied = new Set<string>();
    for (const object of objects) {
      if (!object || typeof object !== 'object' || Object.keys(object).some(k => !['kind', 'x', 'y'].includes(k)) || !integer(object.kind, 0, OBJECT_CATALOG.length - 1) || !integer(object.x, 0, 31) || !integer(object.y, 0, 23)) throw new Error('Invalid object');
      const { width, height } = OBJECT_CATALOG[object.kind];
      if (object.x + width > WIDTH || object.y + height > HEIGHT) throw new Error('Object footprint extends outside the space');
      for (let y = object.y; y < object.y + height; y++) for (let x = object.x; x < object.x + width; x++) {
        const key = `${x},${y}`;
        if (occupied.has(key)) throw new Error('Object footprints cannot overlap');
        occupied.add(key);
      }
    }
  }
  const door = s.door as Record<string, unknown> | null;
  if (door !== null && (!door || typeof door !== 'object' || Object.keys(door).some(k => !['x', 'y'].includes(k)) || !integer(door.x, 0, WIDTH - DOOR_SIZE) || !integer(door.y, 0, HEIGHT - DOOR_SIZE))) throw new Error('Invalid entrance');
  if (door) for (const object of s.exteriorObjects as PlacedObject[]) {
    const { width, height } = OBJECT_CATALOG[object.kind];
    if (object.x < (door.x as number) + DOOR_SIZE && object.x + width > (door.x as number) && object.y < (door.y as number) + DOOR_SIZE && object.y + height > (door.y as number)) throw new Error('Objects cannot overlap the entrance');
  }
  return structuredClone(s) as unknown as Settlement;
}

export function encodeSettlement(s: Settlement): Uint8Array {
  const bytes = new Uint8Array(DATA_SIZE);
  bytes[0] = 3; bytes[1] = s.avatar;
  bytes[4] = s.door?.x ?? 255; bytes[5] = s.door?.y ?? 255;
  bytes.set(s.exterior, 16); bytes.set(s.interior, 784);
  for (const [objects, offset] of [[s.exteriorObjects, 1552], [s.interiorObjects, 1648]] as const) {
    bytes.fill(255, offset, offset + 96);
    objects.forEach((o, i) => bytes.set([o.kind, o.x, o.y], offset + i * 3));
  }
  return bytes;
}
export function decodeSettlement(bytes: Uint8Array): Settlement {
  if (bytes.length !== DATA_SIZE || bytes[0] !== 3) throw new Error('Unsupported game save format');
  const objects = (offset: number) => Array.from({ length: 32 }, (_, i) => ({ kind: bytes[offset + i * 3], x: bytes[offset + i * 3 + 1], y: bytes[offset + i * 3 + 2] })).filter(o => o.kind !== 255);
  return validateSettlement({ formatVersion: 3, avatar: bytes[1], exterior: Array.from(bytes.slice(16, 784)), interior: Array.from(bytes.slice(784, 1552)), exteriorObjects: objects(1552), interiorObjects: objects(1648), door: bytes[4] === 255 && bytes[5] === 255 ? null : { x: bytes[4], y: bytes[5] } });
}

// Read-time migration preserves legacy maps, appearances, and all decorative
// placements. Only the entrance grows; if necessary, relocate it to the nearest
// fitting, unoccupied 2x2 area. V2 footprints stay unchanged. Old ROMs cannot
// submit v1/v2 saves to the v3 API.
export function migrateSettlement(input: unknown): Settlement {
  const legacy = structuredClone(input) as Omit<Settlement, 'formatVersion'> & { formatVersion: number };
  if (legacy.formatVersion === 3) return validateSettlement(legacy);
  if (legacy.formatVersion === 2) return validateSettlement({ ...legacy, formatVersion: 3 });
  if (legacy.formatVersion !== 1) throw new Error('Unsupported settlement version');
  legacy.formatVersion = 3;
  if (legacy.door) {
    const original = legacy.door;
    const candidates = Array.from({ length: (WIDTH - 1) * (HEIGHT - 1) }, (_, i) => ({ x: i % (WIDTH - 1), y: Math.floor(i / (WIDTH - 1)) }));
    candidates.sort((a, b) => Math.abs(a.x - original.x) + Math.abs(a.y - original.y) - Math.abs(b.x - original.x) - Math.abs(b.y - original.y));
    const candidate = candidates.find(door => legacy.exteriorObjects.every(object => !(object.x < door.x + 2 && object.x + 1 > door.x && object.y < door.y + 2 && object.y + 1 > door.y)));
    if (!candidate) throw new Error('No safe legacy entrance position');
    legacy.door = candidate;
  }
  return validateSettlement(legacy);
}

export const WIDTH = 32;
export const HEIGHT = 24;
export const CELLS = WIDTH * HEIGHT;
export const DATA_SIZE = 1744;
export const BRIDGE_ADDRESS = 0xe000;
export const OWNER_ADDRESS = 0xd000;
export const TILE_NAMES = ['Grass', 'Path', 'Water', 'Wall', 'Roof', 'Timber', 'Floor', 'Sand', 'Flowers', 'Stone', 'Hedge', 'Brick', 'Rug', 'House door', 'Window', 'Fence'];
export const OBJECT_NAMES = ['Tree', 'Table', 'Chair', 'Bed', 'Lamp', 'Plant pot', 'Bookcase', 'Chest'];
export interface PlacedObject { kind: number; x: number; y: number }
export interface Settlement {
  formatVersion: 1;
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
  return { formatVersion: 1, avatar: 0, exterior, interior, exteriorObjects: [], interiorObjects: [], door: occupied ? { x: 16, y: 12 } : null };
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}
export function validateSettlement(input: unknown): Settlement {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settlement');
  const s = input as Record<string, unknown>;
  const fields = ['formatVersion', 'avatar', 'exterior', 'interior', 'exteriorObjects', 'interiorObjects', 'door'];
  if (Object.keys(s).some(key => !fields.includes(key)) || s.formatVersion !== 1 || !integer(s.avatar, 0, 3)) throw new Error('Unsupported settlement fields');
  for (const field of ['exterior', 'interior']) {
    const map = s[field];
    if (!Array.isArray(map) || map.length !== CELLS || !map.every(tile => integer(tile, 0, 15) && tile !== 13)) throw new Error('Invalid tile map');
  }
  for (const field of ['exteriorObjects', 'interiorObjects']) {
    const objects = s[field];
    if (!Array.isArray(objects) || objects.length > 32) throw new Error('At most 32 objects per space');
    const occupied = new Set<string>();
    for (const object of objects) {
      if (!object || typeof object !== 'object' || Object.keys(object).some(k => !['kind', 'x', 'y'].includes(k)) || !integer(object.kind, 0, 7) || !integer(object.x, 0, 31) || !integer(object.y, 0, 23)) throw new Error('Invalid object');
      const key = `${object.x},${object.y}`;
      if (occupied.has(key)) throw new Error('Objects cannot share a cell');
      occupied.add(key);
    }
  }
  const door = s.door as Record<string, unknown> | null;
  if (door !== null && (!door || typeof door !== 'object' || Object.keys(door).some(k => !['x', 'y'].includes(k)) || !integer(door.x, 0, 31) || !integer(door.y, 0, 23))) throw new Error('Invalid entrance');
  return structuredClone(s) as unknown as Settlement;
}

export function encodeSettlement(s: Settlement): Uint8Array {
  const bytes = new Uint8Array(DATA_SIZE);
  bytes[0] = 1; bytes[1] = s.avatar;
  bytes[4] = s.door?.x ?? 255; bytes[5] = s.door?.y ?? 255;
  bytes.set(s.exterior, 16); bytes.set(s.interior, 784);
  for (const [objects, offset] of [[s.exteriorObjects, 1552], [s.interiorObjects, 1648]] as const) {
    bytes.fill(255, offset, offset + 96);
    objects.forEach((o, i) => bytes.set([o.kind, o.x, o.y], offset + i * 3));
  }
  return bytes;
}
export function decodeSettlement(bytes: Uint8Array): Settlement {
  if (bytes.length !== DATA_SIZE || bytes[0] !== 1) throw new Error('Unsupported game save format');
  const objects = (offset: number) => Array.from({ length: 32 }, (_, i) => ({ kind: bytes[offset + i * 3], x: bytes[offset + i * 3 + 1], y: bytes[offset + i * 3 + 2] })).filter(o => o.kind !== 255);
  return validateSettlement({ formatVersion: 1, avatar: bytes[1], exterior: Array.from(bytes.slice(16, 784)), interior: Array.from(bytes.slice(784, 1552)), exteriorObjects: objects(1552), interiorObjects: objects(1648), door: bytes[4] === 255 && bytes[5] === 255 ? null : { x: bytes[4], y: bytes[5] } });
}

// Stable catalog IDs. Existing IDs 0–7 retain their original one-tile size.
export const OBJECT_CATALOG = [
  { name: 'Tree', size: 1, solid: true },
  { name: 'Table', size: 1, solid: true },
  { name: 'Chair', size: 1, solid: true },
  { name: 'Bed', size: 1, solid: true },
  { name: 'Lamp', size: 1, solid: false },
  { name: 'Plant pot', size: 1, solid: false },
  { name: 'Bookcase', size: 1, solid: true },
  { name: 'Chest', size: 1, solid: true },
  { name: 'Large tree', size: 2, solid: true },
  { name: 'Dining table', size: 2, solid: true },
  { name: 'Double bed', size: 2, solid: true },
  { name: 'Flower patch', size: 2, solid: false },
] as const;
export const SOLID_TILES = [2, 3, 4, 5, 9, 10, 11, 14, 15];
export const DOOR_SIZE = 2;

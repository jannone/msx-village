// Current greenfield catalog; format 4 snapshots use these IDs.
export const OBJECT_CATALOG = [
  { name: 'Old oak', width: 5, height: 5, category: 0, solid: true, art: 'Old oak' },
  { name: 'Pine', width: 3, height: 4, category: 0, solid: true, art: 'Pine' },
  { name: 'Orchard tree', width: 3, height: 3, category: 0, solid: true, art: 'Orchard tree' },
  { name: 'Well', width: 2, height: 2, category: 1, solid: true, art: 'Well' },
  { name: 'Shrine', width: 1, height: 2, category: 3, solid: true, art: 'Shrine' },
  { name: 'Cottage bed', width: 2, height: 2, category: 2, solid: true, art: 'Bed' },
  { name: 'Oak table', width: 2, height: 2, category: 2, solid: true, art: 'Table' },
  { name: 'Hearth', width: 2, height: 2, category: 2, solid: true, art: 'Hearth' },
  { name: 'Herbs', width: 1, height: 1, category: 0, solid: false, art: 'herbs' },
  { name: 'Flowers', width: 1, height: 1, category: 0, solid: false, art: 'flower' },
  { name: 'Pot', width: 1, height: 1, category: 0, solid: false, art: 'pot' },
  { name: 'Hanging sign', width: 1, height: 1, category: 1, solid: true, art: 'sign' },
  { name: 'Bookshelf', width: 1, height: 1, category: 2, solid: true, art: 'shelf' },
  { name: 'Bottles', width: 1, height: 1, category: 2, solid: false, art: 'bottles' },
  { name: 'Cottage chair', width: 1, height: 1, category: 2, solid: true, art: 'chair' },
  { name: 'Wooden chest', width: 1, height: 1, category: 2, solid: true, art: 'chest' },
  { name: 'Cottage roof', width: 6, height: 2, category: 1, solid: true, art: 'Cottage roof' },
  { name: 'Cottage wall', width: 2, height: 3, category: 1, solid: true, art: 'Cottage wall' },
  { name: 'Traveler bed', width: 2, height: 3, category: 2, solid: true, art: 'Traveler bed' },
  { name: 'Herbalist worktable', width: 3, height: 2, category: 2, solid: true, art: 'Herbalist worktable' },
] as const;
export const OBJECT_CATEGORIES = ['Garden', 'Village', 'Interior', 'Relics'] as const;
// Terrain IDs are storage IDs, independent of generated VDP pattern slots.
// Storage IDs are independent of generated artwork slots.
export const TERRAIN_CATALOG = [
  {name:'Grass',art:'grass',solid:false},
  {name:'Path',art:'path',solid:false},
  {name:'Water',art:'water',solid:true},
  {name:'Wall',art:'wall',solid:true},
  {name:'Roof',art:'roof',solid:true},
  {name:'Timber',art:'beam',solid:true},
  {name:'Floor',art:'floor',solid:false},
  {name:'Sand',art:'sand',solid:false},
  {name:'Flowers',art:'flower',solid:false},
  {name:'Stone',art:'stone',solid:true},
  {name:'Hedge',art:'hedge',solid:true},
  {name:'Brick',art:'brick',solid:true},
  {name:'Rug',art:'rug',solid:false},
  {name:'House door',art:'doorTL',solid:false},
  {name:'Window',art:'window',solid:true},
  {name:'Fence',art:'fence',solid:true},
  {name:'Grass tufts',art:'tuft',solid:false},
  {name:'Cobblestones',art:'cobble',solid:false},
  {name:'Riverbank',art:'bank',solid:true},
  {name:'Garden soil',art:'soil',solid:false},
  {name:'Roof eaves',art:'roofEdge',solid:true},
  {name:'Dark surround',art:'dark',solid:true},
  {name:'Rug border',art:'rugEdge',solid:false},
] as const;
export const SOLID_TILES = TERRAIN_CATALOG.flatMap((tile,id)=>tile.solid?[id]:[]);
export const DOOR_SIZE = 2;

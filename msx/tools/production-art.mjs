import { OBJECT_CATALOG, TERRAIN_CATALOG } from '../../webapp/shared/catalog.ts';
import { tiles as medievalTiles, objects as medievalObjects, avatars as medievalAvatars } from '../art/herbalist.mjs';
import { readArtOverrides } from '../art/overrides.mjs';

export function buildArtwork(overrides = readArtOverrides()) {
  // Original Village artwork. The shared catalog generates the C collision and
  // footprint tables as well, preventing renderer/validator disagreement.
  const blank = () => Array.from({ length: 16 }, () => Array(16).fill(0));
  const rect = (p, x, y, w, h, value = 1) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) p[row][col] = value;
  };
  const sprites = [];
  // Share the art-study traveler across the four selectable outfit palettes.
  // Each directional frame is a pair of non-overlapping 16x16 color masks.
  for (const [id, original] of medievalAvatars.entries()) {
    const frame = overrides.avatars[id] ?? original;
    if (frame.length !== 16 || frame.some(row => row.length !== 16 || /[^.BY]/.test(row))) throw Error('Invalid avatar frame');
    for (const color of ['B', 'Y']) sprites.push([0, 8].flatMap(x => frame.map(row => [...row.slice(x, x + 8)].reduce((n, pixel) => n * 2 + +(pixel === color), 0))));
  }
  for (const size of [8, 16]) {
    const p = blank();
    rect(p, 0, 0, size, 1); rect(p, 0, size - 1, size, 1); rect(p, 0, 0, 1, size); rect(p, size - 1, 0, 1, size);
    sprites.push([...Array.from({ length: 16 }, (_, y) => p[y].slice(0, 8).reduce((n, bit) => n * 2 + bit, 0)), ...Array.from({ length: 16 }, (_, y) => p[y].slice(8).reduce((n, bit) => n * 2 + bit, 0))]);
  }
  const cursor = (w,h,edges) => {
   const p=blank();if(edges.includes('t'))rect(p,0,0,w,1);if(edges.includes('b'))rect(p,0,h-1,w,1);if(edges.includes('l'))rect(p,0,0,1,h);if(edges.includes('r'))rect(p,w-1,0,1,h);
   sprites.push([0,8].flatMap(x=>p.map(row=>row.slice(x,x+8).reduce((n,b)=>n*2+b,0))));
  };
  cursor(8,16,'tblr');cursor(16,8,'tblr');
  for(const edges of ['tl','tr','bl','br'])cursor(8,8,edges);
  for(const h of [8,16])for(const edges of ['tbl','tbr'])cursor(8,h,edges);
  const atlas=[];
  const pixelTile = name => {
   const tile=overrides.tiles[name] ?? medievalTiles.find(t=>t.name===name);if(!tile)throw Error(`Missing artwork ${name}`);
   return {p:tile.rows.map(r=>parseInt(r.replaceAll('.','0').replaceAll('#','1'),2)),c:tile.colors.map(([f,b])=>f*16+b)};
  };
  for (const [id, pattern] of Object.entries(overrides.cursors)) {
   if (!Number.isInteger(+id) || +id < 0 || +id >= 12) throw Error(`Invalid cursor ${id}`);
   sprites[16 + +id] = pattern;
  }
  const intern = name => {const tile=pixelTile(name),key=JSON.stringify(tile);let id=atlas.findIndex(t=>JSON.stringify(t)===key);if(id<0){id=atlas.length;atlas.push(tile);}return id;};
  const terrainPatterns=TERRAIN_CATALOG.map(tile=>intern(tile.art));
  const doorPatterns=['doorTL','doorTR','doorBL','doorBR'].map(intern);
  const objectCells=[], offsets=[];
  for(const o of OBJECT_CATALOG) {
   offsets.push(objectCells.length);
   const grid=medievalObjects.find(a=>a.name===o.art)?.grid ?? [[o.art]];
    if(grid.length!==o.height || grid.some(row=>row.length!==o.width))throw Error(`Artwork footprint mismatch: ${o.name}`);
    objectCells.push(...grid.flat().map(intern));
  }
  // Scene artwork has all 256 logical IDs; text is flagged separately in RAM.
  if(atlas.length>256)throw Error('Standard artwork exceeds the 256-pattern atlas budget');
  if(objectCells.length>256)throw Error('Object artwork exceeds the byte-offset table; widen offsets before expanding');
  return { atlas, sprites, terrainPatterns, doorPatterns, objectCells, offsets };
}

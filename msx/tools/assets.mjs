import { readFileSync, writeFileSync } from 'node:fs';
import { OBJECT_CATALOG, SOLID_TILES, OBJECT_CATEGORIES } from '../../webapp/shared/catalog.ts';

import { tiles as medievalTiles, objects as medievalObjects } from '../art/herbalist.mjs';
// Original Village artwork. The shared catalog generates the C collision and
// footprint tables as well, preventing renderer/validator disagreement.
const blank = () => Array.from({ length: 16 }, () => Array(16).fill(0));
const rect = (p, x, y, w, h, value = 1) => {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) p[row][col] = value;
};
const background = [];
for (let kind = 0; kind < 5; kind++) {
  const p = blank();
  if (kind === 0) { // broad tree canopy and trunk
    for (let y = 1; y < 12; y++) for (let x = 0; x < 16; x++) if (Math.abs(x - 7.5) < Math.min(y + 2, 8, 15 - y)) p[y][x] = 1;
    rect(p, 6, 10, 4, 6);
  } else if (kind === 1) {
    rect(p, 1, 2, 14, 9); rect(p, 3, 4, 10, 5, 0); rect(p, 2, 11, 2, 4); rect(p, 12, 11, 2, 4);
  } else if (kind === 2) {
    rect(p, 1, 0, 14, 15); rect(p, 3, 2, 4, 3, 0); rect(p, 9, 2, 4, 3, 0); rect(p, 2, 7, 12, 1, 0); rect(p, 2, 15, 2, 1); rect(p, 12, 15, 2, 1);
  } else if (kind === 3) {
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) { rect(p, x - 1, y, 3, 1); rect(p, x, y - 1, 1, 3); }
  } else { // house entrance: arch, frame, and threshold
    rect(p, 2, 2, 12, 14); rect(p, 4, 4, 8, 10, 0); rect(p, 4, 1, 8, 1); rect(p, 10, 9, 1, 1);
  }
  for (const [qx, qy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) background.push(Array.from({ length: 8 }, (_, y) => p[qy + y].slice(qx, qx + 8).reduce((n, bit) => n * 2 + bit, 0)));
}
const sprites = [];
for (let avatar = 0; avatar < 4; avatar++) for (let face = 0; face < 4; face++) for (let step = 0; step < 2; step++) {
  const p = blank();
  rect(p, 5, 2, 6, 5); rect(p, 6, 7, 4, 2); rect(p, 4, 9, 8, 3);
  if (avatar === 1) rect(p, 3, 2, 10, 1);
  if (avatar === 2) { rect(p, 4, 1, 8, 1); rect(p, 3, 2, 1, 3); rect(p, 12, 2, 1, 3); }
  if (avatar === 3) { rect(p, 6, 0, 4, 2); rect(p, 3, 4, 1, 3); rect(p, 12, 4, 1, 3); }
  if (face === 0) rect(p, 6, 2, 4, 2, 0);
  else if (face === 1) { rect(p, 6, 4, 1, 1, 0); rect(p, 9, 4, 1, 1, 0); }
  else { rect(p, face === 2 ? 4 : 11, 4, 1, 2); rect(p, face === 2 ? 5 : 10, 4, 1, 1, 0); }
  rect(p, step ? 4 : 5, 12, 3, step ? 4 : 3);
  rect(p, step ? 9 : 8, 12, 3, step ? 3 : 4);
  // TMS9918 16x16 shape: all 16 left rows, then all 16 right rows.
  sprites.push([...Array.from({ length: 16 }, (_, y) => p[y].slice(0, 8).reduce((n, bit) => n * 2 + bit, 0)), ...Array.from({ length: 16 }, (_, y) => p[y].slice(8).reduce((n, bit) => n * 2 + bit, 0))]);
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
const legacy=JSON.parse(readFileSync(new URL('../art/legacy.json',import.meta.url),'utf8'));
const atlas=legacy.patterns.map((p,i)=>({p,c:Array(8).fill(legacy.colors[i])}));
background.forEach((p,i)=>atlas.push({p,c:Array(8).fill(i<4?0x32:i<8?0x6a:i<12?0xfe:i<16?0x92:0xa6)}));
const pixelTile = name => {
 const tile=medievalTiles.find(t=>t.name===name);if(!tile)throw Error(`Missing artwork ${name}`);
 return {p:tile.rows.map(r=>parseInt(r.replaceAll('.','0').replaceAll('#','1'),2)),c:tile.colors.map(([f,b])=>f*16+b)};
};
// Stable terrain semantics and legacy object dimensions, with the new art direction.
['grass','path','water','wall','roof','beam','floor','path','flower','stone','hedge','roof','rug','doorTL','window','fence'].forEach((name,i)=>atlas[i]=pixelTile(name));
['doorTL','doorTR','doorBL','doorBR'].forEach((name,i)=>atlas[40+i]=pixelTile(name));
const intern = name => {const tile=pixelTile(name),key=JSON.stringify(tile);let id=atlas.findIndex(t=>JSON.stringify(t)===key);if(id<0){id=atlas.length;atlas.push(tile);}return id;};
const objectCells=[], offsets=[];
for(const [id,o] of OBJECT_CATALOG.entries()) {
 offsets.push(objectCells.length);
 if(o.art){const grid=medievalObjects.find(a=>a.name===o.art)?.grid ?? [[o.art]];
  if(grid.length!==o.height || grid.some(row=>row.length!==o.width))throw Error(`Artwork footprint mismatch: ${o.name}`);
  objectCells.push(...grid.flat().map(intern));
 }else{const first=id<8?16+id:24+(id-8)*4;objectCells.push(...Array.from({length:o.width*o.height},(_,i)=>first+i));}
}
// Scene artwork has all 256 logical IDs; text is flagged separately in RAM.
if(atlas.length>256)throw Error('Standard artwork exceeds the 256-pattern atlas budget');
if(objectCells.length>256)throw Error('Object artwork exceeds the byte-offset table; widen offsets before expanding');
const list = values => values.join(',');
writeFileSync(new URL('../assets.generated.h', import.meta.url), `// Generated by msx/tools/assets.mjs; edit the generator or shared catalog.
#define OBJECT_COUNT ${OBJECT_CATALOG.length}
#define ART_COUNT ${atlas.length}
#define CATEGORY_COUNT ${OBJECT_CATEGORIES.length}
const u8 objectWidth[OBJECT_COUNT] = {${list(OBJECT_CATALOG.map(o => o.width))}};
const u8 objectHeight[OBJECT_COUNT] = {${list(OBJECT_CATALOG.map(o => o.height))}};
const u8 objectCategory[OBJECT_COUNT] = {${list(OBJECT_CATALOG.map(o => o.category))}};
const u8 objectOffsetTable[OBJECT_COUNT] = {${list(offsets)}};
const u8 objectCells[${objectCells.length}] = {${list(objectCells)}};
const u8 objectSolid[OBJECT_COUNT] = {${list(OBJECT_CATALOG.map(o => +o.solid))}};
const u8 tileSolid[16] = {${list(Array.from({length:16}, (_, i) => +SOLID_TILES.includes(i)))}};
const char* categoryNames[CATEGORY_COUNT] = {${OBJECT_CATEGORIES.map(n=>JSON.stringify(n.toUpperCase())).join(',')}};
const char* objectNames[OBJECT_COUNT] = {${OBJECT_CATALOG.map(o => JSON.stringify(o.name.toUpperCase())).join(',')}};
const u8 scenePatterns[ART_COUNT][8] = {${atlas.map(t=>`{${list(t.p)}}`).join(',')}};
const u8 sceneColors[ART_COUNT][8] = {${atlas.map(t=>`{${list(t.c)}}`).join(',')}};
const u8 avatarPatterns[${sprites.length}][32] = {${sprites.map(row => `{${list(row)}}`).join(',')}};
`);
console.log(`Catalog: ${OBJECT_CATALOG.length} objects, ${atlas.length} deduplicated art patterns, ${objectCells.length} object cells`);

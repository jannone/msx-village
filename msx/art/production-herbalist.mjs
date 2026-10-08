// Reconstruct both art-study rooms using only public production catalog assets.
// This is a reproducible test/demo settlement, never a production DB seed.
import { tiles, scenes, objects } from './herbalist.mjs';
import { TERRAIN_CATALOG, OBJECT_CATALOG } from '../../webapp/shared/catalog.ts';
import { initialSettlement, validateSettlement } from '../../webapp/shared/settlement.ts';
export function herbalistSettlement() {
 const content=initialSettlement(false);content.avatar=3;
 for(const [room,scene] of scenes.entries()) {
  const map=room?content.interior:content.exterior;
  const placed=room?content.interiorObjects:content.exteriorObjects;
  const covered=new Set();
  for(const p of scene.placements) {
   if(p.name==='House entrance')content.door={x:p.x,y:p.y};
   else {
    const kind=OBJECT_CATALOG.findIndex(o=>o.art===p.name);
    if(kind<0)throw Error(`Study object missing from production: ${p.name}`);
    placed.push({kind,x:p.x,y:p.y});
   }
   for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)covered.add((p.y+y)*32+p.x+x);
  }
  scene.map.forEach((tile,i)=>{
   map[i]=room?6:0;if(covered.has(i))return;
   const art=tiles[tile].name;
   const ground=TERRAIN_CATALOG.findIndex(t=>t.art===art);
   if(ground>=0&&ground!==13){map[i]=ground;return;}
   const kind=OBJECT_CATALOG.findIndex(o=>o.width===1&&o.height===1&&o.art===art);
   if(kind<0)throw Error(`Study glyph missing from production: ${art}`);
   placed.push({kind,x:i%32,y:Math.floor(i/32)});
  });
  // A catalog-only reconstruction must produce every original visible cell.
  const actual=map.map(id=>TERRAIN_CATALOG[id].art);
  for(const p of placed){const o=OBJECT_CATALOG[p.kind];const grid=objects.find(a=>a.name===o.art)?.grid??[[o.art]];grid.forEach((r,y)=>r.forEach((name,x)=>actual[(p.y+y)*32+p.x+x]=name));}
  if(!room&&content.door){const grid=objects.find(o=>o.name==='House entrance').grid;grid.forEach((r,y)=>r.forEach((name,x)=>actual[(content.door.y+y)*32+content.door.x+x]=name));}
  actual.forEach((name,i)=>{if(name!==tiles[scene.map[i]].name)throw Error(`Room ${room} cell ${i} differs from study`);});
 }
 return validateSettlement(content);
}

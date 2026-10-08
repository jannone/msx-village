import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { herbalistSettlement } from '../art/production-herbalist.mjs';
import { tiles, scenes } from '../art/herbalist.mjs';
import { assembleSnapshot } from '../../webapp/shared/snapshot.ts';
import { encodeSettlement,decodeSettlement } from '../../webapp/shared/settlement.ts';
import assert from 'node:assert/strict';
const out=new URL('../out/herbalist/',import.meta.url);mkdirSync(out,{recursive:true});
const content=herbalistSettlement();assert.deepEqual(decodeSettlement(encodeSettlement(content)),content);
const core=readFileSync(new URL('../out/village.rom',import.meta.url)).subarray(0,24576);
writeFileSync(new URL('village-herbalist.rom',out),assembleSnapshot(core,[{x:0,y:0,revision:0,username:'Herbalist',content}],0,0,{x:0,y:0,revision:0},0));
writeFileSync(new URL('settlement.json',out),JSON.stringify(content,null,2)+'\n');
writeFileSync(new URL('settlement.bin',out),encodeSettlement(content));
for(const [room,scene] of scenes.entries()) {
 const patterns=scene.map.flatMap(id=>tiles[id].rows.map(row=>parseInt(row.replaceAll('.','0').replaceAll('#','1'),2)));
 const colors=scene.map.flatMap(id=>tiles[id].colors.map(([fg,bg])=>fg*16+bg));
 writeFileSync(new URL(`${room}-patterns.bin`,out),Buffer.from(patterns));
 writeFileSync(new URL(`${room}-colors.bin`,out),Buffer.from(colors));
}
console.log(`Production herbalist ROM: exact study reconstruction, ${content.exteriorObjects.length} exterior / ${content.interiorObjects.length} interior objects; save codec round trip PASS`);

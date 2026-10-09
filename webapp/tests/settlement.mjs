import assert from 'node:assert/strict';
import {initialSettlement,validateSettlement,encodeSettlement,decodeSettlement} from '../shared/settlement.ts';
import {OBJECT_CATALOG,TERRAIN_CATALOG} from '../shared/catalog.ts';
import {herbalistSettlement} from '../../msx/art/production-herbalist.mjs';
assert.equal(OBJECT_CATALOG.length,20);
assert.ok(OBJECT_CATALOG.every(o=>o.art));
const s=herbalistSettlement();assert.equal(s.formatVersion,4);
assert.deepEqual(decodeSettlement(encodeSettlement(s)),s);
for(const [kind,o] of OBJECT_CATALOG.entries()) {
 const atEdge={...initialSettlement(),door:null,exteriorObjects:[{kind,x:32-o.width,y:24-o.height}]};
 assert.deepEqual(decodeSettlement(encodeSettlement(atEdge)),atEdge);
 for(const [x,y] of [[33-o.width,24-o.height],[32-o.width,25-o.height]])assert.throws(()=>validateSettlement({...atEdge,exteriorObjects:[{kind,x,y}]}),/footprint|Invalid object/);
}
assert.throws(()=>validateSettlement({...s,exteriorObjects:[{kind:0,x:3,y:3},{kind:8,x:4,y:4}]}),/overlap/);
assert.throws(()=>validateSettlement({...s,exteriorObjects:[{kind:8,x:15,y:10}]}),/entrance/);
assert.throws(()=>validateSettlement({...s,door:{x:31,y:23}}),/entrance/);
assert.throws(()=>validateSettlement({...s,exteriorObjects:[{kind:8,x:0,y:0,solid:false}]}),/Invalid object/);
assert.throws(()=>validateSettlement({...s,exteriorObjects:[{kind:20,x:0,y:0}]}),/Invalid object/);
for(const version of [1,2,3]){
 assert.throws(()=>validateSettlement({...s,formatVersion:version}),/Unsupported/);
 const bytes=encodeSettlement(s);bytes[0]=version;assert.throws(()=>decodeSettlement(bytes),/Unsupported/);
}
for(let id=0;id<TERRAIN_CATALOG.length;id++)if(id!==13)s.exterior[id]=id;
assert.deepEqual(decodeSettlement(encodeSettlement(s)),s);
for(const invalid of [13,TERRAIN_CATALOG.length,255])assert.throws(()=>validateSettlement({...s,exterior:s.exterior.map((v,i)=>i===0?invalid:v)}),/tile map/);
console.log('PASS current-only format 4, all catalog footprints/edges, complete herbalist round trip, terrain IDs, overlap and metadata rejection');

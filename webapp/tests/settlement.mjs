import assert from 'node:assert/strict';
import { initialSettlement, validateSettlement, migrateSettlement, encodeSettlement, decodeSettlement } from '../shared/settlement.ts';
import { OBJECT_CATALOG, TERRAIN_CATALOG } from '../shared/catalog.ts';
const s = initialSettlement();
s.exteriorObjects = [{ kind: 8, x: 29, y: 21 }, { kind: 4, x: 4, y: 3 }, { kind: 11, x: 8, y: 8 }];
assert.deepEqual(decodeSettlement(encodeSettlement(s)), s);
assert.equal(OBJECT_CATALOG[8].solid, true);
assert.equal(OBJECT_CATALOG[11].solid, false);
for (const object of [{ kind: 8, x: 31, y: 5 }, { kind: 9, x: 5, y: 23 }]) {
  assert.throws(() => validateSettlement({ ...s, exteriorObjects: [object] }), /footprint/);
}
assert.throws(() => validateSettlement({ ...s, exteriorObjects: [{ kind: 8, x: 4, y: 4 }, { kind: 4, x: 5, y: 5 }] }), /overlap/);
assert.throws(() => validateSettlement({ ...s, exteriorObjects: [{ kind: 1, x: 17, y: 13 }] }), /entrance/);
assert.throws(() => validateSettlement({ ...s, door: { x: 31, y: 23 } }), /entrance/);
assert.throws(() => validateSettlement({ ...s, exteriorObjects: [{ kind: 8, x: 4, y: 4, solid: false }] }), /Invalid object/);
assert.throws(() => validateSettlement({ ...s, formatVersion: 1 }), /Unsupported/);
const legacy = { ...initialSettlement(), formatVersion: 1, door: { x: 31, y: 23 }, exteriorObjects: [{ kind: 3, x: 30, y: 22 }] };
const migrated = migrateSettlement(legacy);
assert.equal(migrated.formatVersion, 3);
assert.deepEqual(migrated.exterior, legacy.exterior);
assert.deepEqual(migrated.interior, legacy.interior);
assert.deepEqual(migrated.exteriorObjects, legacy.exteriorObjects);
assert.ok(migrated.door.x <= 30 && migrated.door.y <= 22);
assert.deepEqual(migrateSettlement(migrated), migrated);
assert.deepEqual(decodeSettlement(encodeSettlement(migrated)), migrated);
assert.equal(legacy.formatVersion, 1, 'migration must not mutate historical records');
console.log('PASS v3 round trip, full footprints, overlap, door bounds, catalog authority, v1 migration');

const rectangular = {...initialSettlement(), door:null, exteriorObjects:[{kind:12,x:27,y:19},{kind:13,x:24,y:20},{kind:16,x:23,y:22}]};
assert.deepEqual(decodeSettlement(encodeSettlement(rectangular)),rectangular);
for (const object of [{kind:12,x:28,y:19},{kind:13,x:24,y:21},{kind:16,x:31,y:23}]) assert.throws(()=>validateSettlement({...rectangular,exteriorObjects:[object]}),/footprint/);
const version2={...initialSettlement(),formatVersion:2,exteriorObjects:[{kind:8,x:29,y:21}]};
assert.deepEqual(migrateSettlement(version2),{...version2,formatVersion:3});
assert.throws(()=>validateSettlement(version2),/Unsupported/);
console.log('PASS v3 rectangles, edge bounds, v2 preservation and old-save rejection');

// Building pieces fit exactly at the lower/right edges; every occupied cell counts.
for (const [kind,x,y] of [[28,26,22],[29,30,21]]) {
 const cottage={...initialSettlement(),door:null,exteriorObjects:[{kind,x,y}]};
 assert.deepEqual(decodeSettlement(encodeSettlement(cottage)),cottage);
 assert.throws(()=>validateSettlement({...cottage,exteriorObjects:[{kind,x:x+1,y}]}),/footprint/);
 assert.throws(()=>validateSettlement({...cottage,exteriorObjects:[{kind,x,y:y+1}]}),/footprint/);
}
console.log('PASS cottage roof and wall full-footprint bounds and binary round trip');

const expanded=initialSettlement();
for(let id=16;id<TERRAIN_CATALOG.length;id++)expanded.exterior[id]=expanded.interior[id]=id;
expanded.interiorObjects=[{kind:30,x:2,y:3},{kind:31,x:12,y:12}];
assert.deepEqual(decodeSettlement(encodeSettlement(expanded)),expanded);
for(const invalid of [13,TERRAIN_CATALOG.length,255])assert.throws(()=>validateSettlement({...expanded,exterior:expanded.exterior.map((v,i)=>i===0?invalid:v)}),/tile map/);
assert.deepEqual(OBJECT_CATALOG.slice(30).map(o=>[o.width,o.height]),[[2,3],[3,2]]);
console.log('PASS appended terrain IDs and scaled furnishings survive save encoding; invalid IDs rejected');

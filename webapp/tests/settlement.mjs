import assert from 'node:assert/strict';
import { initialSettlement, validateSettlement, migrateSettlement, encodeSettlement, decodeSettlement } from '../shared/settlement.ts';
import { OBJECT_CATALOG } from '../shared/catalog.ts';
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
assert.equal(migrated.formatVersion, 2);
assert.deepEqual(migrated.exterior, legacy.exterior);
assert.deepEqual(migrated.interior, legacy.interior);
assert.deepEqual(migrated.exteriorObjects, legacy.exteriorObjects);
assert.ok(migrated.door.x <= 30 && migrated.door.y <= 22);
assert.deepEqual(migrateSettlement(migrated), migrated);
assert.deepEqual(decodeSettlement(encodeSettlement(migrated)), migrated);
assert.equal(legacy.formatVersion, 1, 'migration must not mutate historical records');
console.log('PASS v2 round trip, full footprints, overlap, door bounds, catalog authority, v1 migration');

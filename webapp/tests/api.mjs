import assert from 'node:assert/strict';
import { herbalistSettlement } from '../../msx/art/production-herbalist.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { initialSettlement, decodeSettlement, DATA_SIZE } from '../shared/settlement.ts';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const cwd = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base = process.env.VILLAGE_TEST_URL ?? 'http://127.0.0.1:5173';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Tests must use a local isolated database');
const suffix = randomBytes(4).toString('hex');
const tokens = Array.from({length:3},()=>randomBytes(32).toString('hex'));
const time = Math.floor(Date.now()/1000);
const sql = tokens.map(t=>`INSERT INTO invitations VALUES ('${createHash('sha256').update(t).digest('hex')}',${time},${time+3600});`).join('\n');
execFileSync(resolve(cwd,'node_modules/.bin/wrangler'),['d1','execute','DB','--local','--command',sql],{cwd,stdio:'pipe'});
async function api(path,method='GET',value,cookie='',origin=base) {
 const response = await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:value===undefined?undefined:JSON.stringify(value)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]??''};
}
const register=(i,invite=tokens[i])=>api('/api/auth/register','POST',{username:`t${suffix}${i}`,password:'a long test password',invitation:invite});
const a=await register(0);assert.equal(a.status,201,JSON.stringify(a.data));
const b=await register(1);assert.equal(b.status,201);
assert.equal((await register(2,tokens[0])).status,409,'one invitation cannot create two accounts');
assert.equal((await api('/api/auth/login','POST',{username:`t${suffix}0`,password:'wrong'})).status,401);
assert.equal((await api('/api/auth/login','POST',{username:`t${suffix}0`,password:'a long test password'})).status,200);
assert.equal((await api('/api/plots/claim','POST',{x:0,y:0},a.cookie,'https://evil.example')).status,403);
const x=parseInt(suffix.slice(0,2),16)%100-50, y=parseInt(suffix.slice(2,4),16)%100-50;
const claims=await Promise.all([api('/api/plots/claim','POST',{x,y},a.cookie),api('/api/plots/claim','POST',{x:x+1,y},a.cookie)]);
assert.deepEqual(claims.map(c=>c.status).sort(),[201,409],'parallel claims cannot allocate two plots');
const claimed=claims.find(c=>c.status===201).data.plot;
assert.equal((await api('/api/plots/claim','POST',{x:claimed.x,y:claimed.y},b.cookie)).status,409);
assert.equal((await api('/api/settlement','PUT',{expectedRevision:0,settlement:initialSettlement()},b.cookie)).status,404,'another account cannot save the owned plot');
assert.equal((await api('/api/settlement','PUT',{expectedRevision:0,settlement:initialSettlement(),owner_id:b.data.user.id},a.cookie)).status,400);
// Existing production snapshots may still carry v1 JSON. Exercise the read-time
// upgrade in a real D1 row, not just the pure migration function.
const legacy={...initialSettlement(),formatVersion:1,door:{x:31,y:23}};
execFileSync(resolve(cwd,'node_modules/.bin/wrangler'),['d1','execute','DB','--local','--command',`UPDATE plots SET content='${JSON.stringify(legacy)}' WHERE id='${claimed.id}'`],{cwd,stdio:'pipe'});
const upgraded=await api('/api/me','GET',undefined,a.cookie);
assert.equal(upgraded.data.plot.content.formatVersion,3);
assert.deepEqual(upgraded.data.plot.content.door,{x:30,y:22});
assert.equal((await api('/api/settlement','PUT',{expectedRevision:0,settlement:legacy},a.cookie)).status,400,'old ROM saves must not reinterpret the v3 catalog');
for (const malformed of [
 {...initialSettlement(),exteriorObjects:[{kind:8,x:31,y:3}]},
 {...initialSettlement(),exteriorObjects:[{kind:8,x:4,y:4},{kind:4,x:5,y:5}]},
 {...initialSettlement(),exteriorObjects:[{kind:4,x:17,y:13}]},
 {...initialSettlement(),exteriorObjects:[{kind:8,x:3,y:3,solid:false}]},
 {...initialSettlement(),door:{x:31,y:23}},
 {...initialSettlement(),exteriorObjects:[{kind:12,x:28,y:10}]},
 {...initialSettlement(),exteriorObjects:[{kind:13,x:20,y:21}]},
 {...initialSettlement(),exteriorObjects:[{kind:12,x:20,y:2},{kind:20,x:24,y:6}]},
]) assert.equal((await api('/api/settlement','PUT',{expectedRevision:0,settlement:malformed},a.cookie)).status,400,'server validates catalog footprints and properties');
const first=initialSettlement();first.exterior[0]=7;first.interior[100]=12;first.interiorObjects.push({kind:3,x:5,y:5});first.exteriorObjects.push({kind:8,x:24,y:16},{kind:11,x:27,y:18},{kind:4,x:6,y:3});first.interiorObjects.push({kind:10,x:9,y:9});first.exteriorObjects.push({kind:12,x:20,y:3},{kind:13,x:4,y:15});first.interiorObjects.push({kind:19,x:20,y:4},{kind:18,x:15,y:14});first.avatar=2;first.door={x:1,y:2};
const saves=await Promise.all([api('/api/settlement','PUT',{expectedRevision:0,settlement:first},a.cookie),api('/api/settlement','PUT',{expectedRevision:0,settlement:initialSettlement()},a.cookie)]);
assert.deepEqual(saves.map(c=>c.status).sort(),[200,409]);
// The race may choose either payload. Persist the rich scene explicitly before
// checking its snapshot, so this cannot pass by round-tripping only a blank plot.
first.exteriorObjects.push({kind:28,x:8,y:2},{kind:29,x:8,y:4},{kind:29,x:12,y:4});
assert.equal((await api('/api/settlement','PUT',{expectedRevision:1,settlement:first},a.cookie)).status,200);
const me=await api('/api/me','GET',undefined,a.cookie);assert.equal(me.data.plot.revision,2);
assert.deepEqual(me.data.plot.content,first,'rich scene including cottage pieces persists');
assert.equal((await api('/api/settlement','PUT',{expectedRevision:1,settlement:{...initialSettlement(),exterior:[0]}},a.cookie)).status,400);
assert.equal((await api('/api/settlement','PUT',{expectedRevision:1,settlement:{...initialSettlement(),x:claimed.x+1}},a.cookie)).status,400);
assert.equal((await api('/api/settlement','PUT',{expectedRevision:1,settlement:initialSettlement()})).status,401);
const romResponse=await fetch(base+'/api/snapshot.rom',{headers:{Cookie:a.cookie}});
assert.equal(romResponse.status,200);const rom=new Uint8Array(await romResponse.arrayBuffer());
assert.equal(rom.length,1048576);assert.deepEqual(Array.from(rom.slice(32768,32772)),[77,83,88,86]);assert.equal(rom[32776],40);assert.deepEqual(decodeSettlement(rom.slice((5+40)*8192,(5+40)*8192+DATA_SIZE)),me.data.plot.content,'fresh snapshot recovers exterior, interior, objects, avatar and door together');
assert.equal(new TextDecoder().decode(rom).includes(a.data.user.id),false,'snapshot excludes account identity');
// Persist the complete refined art study through the same public save API.
const herbalist=herbalistSettlement();
assert.equal((await api('/api/settlement','PUT',{expectedRevision:2,settlement:herbalist},a.cookie)).status,200);
const restored=await api('/api/me','GET',undefined,a.cookie);
assert.equal(restored.data.plot.revision,3);assert.deepEqual(restored.data.plot.content,herbalist);
const artRom=new Uint8Array(await (await fetch(base+'/api/snapshot.rom',{headers:{Cookie:a.cookie}})).arrayBuffer());
assert.deepEqual(decodeSettlement(artRom.slice(45*8192,45*8192+DATA_SIZE)),herbalist);
mkdirSync(resolve(cwd,'../msx/out/herbalist'),{recursive:true});
writeFileSync(resolve(cwd,'../msx/out/herbalist/from-local-api.rom'),artRom);
console.log('PASS complete herbalist exterior/interior saved to local D1 and recovered in fresh production ROM');
const guest=new Uint8Array(await (await fetch(base+'/api/snapshot.rom')).arrayBuffer());assert.equal(guest[32776],255,'guest ROM must have no editable plot');
assert.equal((await api('/api/auth/logout','POST',{},a.cookie)).status,200);
assert.equal((await api('/api/me','GET',undefined,a.cookie)).data.user,null);
console.log('PASS: invitations, passwords, CSRF, concurrent claims, ownership, stale saves, ROM snapshots, logout');

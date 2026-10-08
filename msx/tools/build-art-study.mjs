import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,ensureDependency } from '../../scripts/dependencies.mjs';
await import('./art-study.mjs');
const vendor=ensureDependency('MSXgl'),cwd=resolve(root,'msx');
mkdirSync(resolve(cwd,'out'),{recursive:true});
execFileSync('c++',['-std=c++17','-o','out/MSXhex',`-I${vendor}/tools/MSXtk/src`,`${vendor}/tools/MSXtk/src/MSXhex.cpp`],{cwd,stdio:'inherit'});
execFileSync(process.execPath,[`${vendor}/engine/script/js/build.js`,'projname=artstudy'],{cwd,stdio:'inherit'});
const rom=readFileSync(resolve(cwd,'out/artstudy.rom'));
if(rom.length!==1048576||rom[0]!==65||rom[1]!==66)throw Error('Invalid art-study MegaROM');
const map=readFileSync(resolve(cwd,'out/artstudy.map'),'utf8');
for(const [area,limit]of [['_CODE',0xa000],['_DATA',0xd000]]){
 const m=new RegExp(`^${area}\\s+([A-Fa-f0-9]+)\\s+([A-Fa-f0-9]+)`,'m').exec(map);
 if(!m||parseInt(m[1],16)+parseInt(m[2],16)>limit)throw Error(`Art-study ${area} exceeds budget`);
}
console.log('Built msx/out/artstudy.rom (1 MiB ASCII8 art preview; no save integration)');

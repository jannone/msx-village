import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, ensureDependency } from '../../scripts/dependencies.mjs';
const vendor = ensureDependency('WebMSX');
const out = resolve(root,'webapp/public/emulator');
mkdirSync(out,{recursive:true});
copyFileSync(resolve(vendor,'release/stable/6.0/cbios/embedded/wmsx.js'),resolve(out,'wmsx.js'));
copyFileSync(resolve(vendor,'README.md'),resolve(out,'WebMSX-README.txt'));

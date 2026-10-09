import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSheet } from './art-sheet.mjs';
import { overridesPath } from '../art/overrides.mjs';
const args = process.argv.slice(2), check = args.includes('--check'), positional = args.filter(a => a !== '--check');
if (args.some(a => a.startsWith('--') && a !== '--check') || positional.length < 1 || positional.length > 2) throw Error('Usage: node msx/tools/import-art-sheet.mjs edited.png [original-map.json] [--check]');
const pngPath = resolve(positional[0]), mapPath = resolve(positional[1] ?? pngPath.replace(/\.png$/i, '.json'));
const {overrides, changed} = importSheet(readFileSync(pngPath), JSON.parse(readFileSync(mapPath, 'utf8')));
if (!check && changed.length) {
  const temp = new URL('./overrides.json.tmp', overridesPath);
  writeFileSync(temp, JSON.stringify(overrides, null, 2) + '\n');
  renameSync(temp, overridesPath);
}
console.log(`${check ? 'Validated' : 'Imported'} ${changed.length} changed sources${changed.length ? ': ' + changed.join(', ') : ' (unchanged round trip)'}.`);
if (!check && changed.length) console.log('Rebuild with node msx/tools/build.mjs and node msx/tools/build-art-study.mjs; export a fresh sheet before the next edit.');

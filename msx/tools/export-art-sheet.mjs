import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSheet } from './art-sheet.mjs';
import { encodePNG } from './png.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const path = resolve(process.argv[2] ?? `${root}/msx/out/art-sheet/all-art.png`);
if (!path.endsWith('.png')) throw Error('Output must end in .png');
const {manifest, rgba, png} = createSheet();
mkdirSync(dirname(path), {recursive: true});
writeFileSync(path, png);
const prefix = path.slice(0, -4);
writeFileSync(`${prefix}.json`, JSON.stringify(manifest, null, 2) + '\n');
const scale = 4, preview = Buffer.alloc(rgba.length * scale * scale);
for (let y = 0; y < manifest.height * scale; y++) for (let x = 0; x < manifest.width * scale; x++) {
  const at = (Math.floor(y / scale) * manifest.width + Math.floor(x / scale)) * 4;
  rgba.copy(preview, (y * manifest.width * scale + x) * 4, at, at + 4);
}
writeFileSync(`${prefix}-preview-4x.png`, encodePNG(manifest.width * scale, manifest.height * scale, preview));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const groups = [...new Set(manifest.entries.map(e => e.group))];
writeFileSync(`${prefix}-guide.html`, `<!doctype html><meta charset="utf-8"><title>Village art sheet map</title>
<style>body{background:#20252a;color:#eee;font:16px system-ui;margin:32px}h2{margin-top:36px}.grid{display:flex;flex-wrap:wrap;gap:20px}.asset{background:#30383f;padding:12px;min-width:150px}small{display:block;color:#aebbc5}.pixels{image-rendering:pixelated;background-image:linear-gradient(45deg,#777 25%,transparent 25%),linear-gradient(-45deg,#777 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#777 75%),linear-gradient(-45deg,transparent 75%,#777 75%);background-size:16px 16px;background-color:#555;margin-bottom:8px}.crop{image-rendering:pixelated;position:relative;overflow:hidden}.crop img{position:absolute;max-width:none;image-rendering:pixelated}</style>
<h1>Village artwork</h1><p>Edit <b>${escape(basename(path))}</b> at native ${manifest.width}×${manifest.height} resolution. Keep the JSON map with the PNG. Asset-and-caption blocks have 8px transparent spacing. Captions use 3×5 letters with 1px letter gaps and are ignored during import. This guide and the 4× preview are references.</p>
<p>Repeated glyphs and avatar palettes share source artwork. Edit one copy, or make all changed copies identical. Backgrounds: two colors per 8px row; opaque MSX colors only. Avatars: the shown layer colors and transparency. Cursors: white and transparency. The palette at the bottom of the PNG is for sampling.</p>
<div class="grid">${manifest.paletteSwatches.map(s => `<div><div style="background:#${s.hex};width:40px;height:40px"></div>${s.index}<small>#${s.hex}</small></div>`).join('')}</div>
${groups.map(group => `<h2>${group}</h2><div class="grid">${manifest.entries.filter(e => e.group === group).map(e => `<div class="asset"><div class="pixels" style="width:${e.width * 4}px;height:${e.height * 4}px"><div class="crop" style="width:${e.width * 4}px;height:${e.height * 4}px"><img src="${escape(encodeURIComponent(basename(path)))}" style="width:${manifest.width * 4}px;height:${manifest.height * 4}px;left:-${e.x * 4}px;top:-${e.y * 4}px"></div></div>${escape(e.name)}<small>${e.width}×${e.height} pixels · x=${e.x}, y=${e.y}</small></div>`).join('')}</div>`).join('')}`);
console.log(`Exported ${manifest.entries.length} elements (${Object.keys(manifest.sources).length} unique sources), ${manifest.width}x${manifest.height}, ${manifest.spacing}px spacing:\n${path}\n${prefix}.json\n${prefix}-guide.html\n${prefix}-preview-4x.png`);

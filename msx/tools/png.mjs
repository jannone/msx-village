// Lossless PNG I/O for native pixel sheets. No dependencies or color conversion.
import { deflateSync, inflateSync } from 'node:zlib';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function crc(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; }
  return (n ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4); return b;
}
export function encodePNG(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw Error('Invalid PNG pixel length');
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1)), pixels = Buffer.from(rgba);
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const paeth = (a, b, c) => {
  const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c);
  return x <= y && x <= z ? a : y <= z ? b : c;
};
export function decodePNG(buffer) {
  if (!buffer.subarray(0, 8).equals(signature)) throw Error('Expected a PNG file');
  let header, palette, transparency, ended = false;
  const data = [];
  for (let at = 8; at < buffer.length;) {
    if (at + 12 > buffer.length) throw Error('Truncated PNG chunk');
    const size = buffer.readUInt32BE(at), end = at + 12 + size;
    if (end > buffer.length) throw Error('Truncated PNG data');
    const type = buffer.toString('ascii', at + 4, at + 8), bytes = buffer.subarray(at + 8, end - 4);
    if (crc(buffer.subarray(at + 4, end - 4)) !== buffer.readUInt32BE(end - 4)) throw Error(`PNG checksum failed: ${type}`);
    if (type === 'IHDR') header = bytes;
    else if (type === 'PLTE') palette = bytes;
    else if (type === 'tRNS') transparency = bytes;
    else if (type === 'IDAT') data.push(bytes);
    else if (type === 'IEND') { ended = true; break; }
    else if (type[0] === type[0].toUpperCase()) throw Error(`Unsupported PNG chunk ${type}`);
    at = end;
  }
  if (!header || header.length !== 13 || !ended || !data.length) throw Error('Incomplete PNG');
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], type = header[9];
  if (!width || !height || width * height > 16000000) throw Error('PNG dimensions exceed the sheet limit');
  if (header[10] || header[11] || header[12]) throw Error('Save PNG without interlacing');
  const channels = ({0: 1, 2: 3, 3: 1, 4: 2, 6: 4})[type];
  if (!channels || (type === 3 ? ![1, 2, 4, 8].includes(depth) : depth !== 8)) throw Error('Save as 8-bit RGB/RGBA or indexed PNG');
  if (type === 3 && (!palette || palette.length % 3)) throw Error('Indexed PNG has no valid palette');
  const stride = Math.ceil(width * channels * depth / 8), bpp = Math.max(1, Math.ceil(channels * depth / 8));
  const raw = inflateSync(Buffer.concat(data), {maxOutputLength: height * (stride + 1)});
  if (raw.length !== height * (stride + 1)) throw Error('Invalid PNG scanline length');
  const scan = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) throw Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const pos = y * stride + x, a = x >= bpp ? scan[pos - bpp] : 0, b = y ? scan[pos - stride] : 0, c = y && x >= bpp ? scan[pos - stride - bpp] : 0;
      const predicted = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      scan[pos] = (raw[y * (stride + 1) + x + 1] + predicted) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const out = (y * width + x) * 4, pos = y * stride + x * channels;
    if (type === 3) {
      const bit = x * depth, id = (scan[y * stride + (bit >> 3)] >> (8 - depth - bit % 8)) & ((1 << depth) - 1);
      if (id * 3 + 2 >= palette.length) throw Error('Invalid PNG palette index');
      palette.copy(rgba, out, id * 3, id * 3 + 3); rgba[out + 3] = transparency?.[id] ?? 255;
    } else if (type === 0 || type === 4) {
      rgba.fill(scan[pos], out, out + 3);
      rgba[out + 3] = type === 4 ? scan[pos + 1] : transparency && scan[pos] === transparency.readUInt16BE(0) ? 0 : 255;
    } else {
      scan.copy(rgba, out, pos, pos + 3);
      rgba[out + 3] = type === 6 ? scan[pos + 3] : transparency && [0, 1, 2].every(i => scan[pos + i] === transparency.readUInt16BE(i * 2)) ? 0 : 255;
    }
  }
  return {width, height, rgba};
}

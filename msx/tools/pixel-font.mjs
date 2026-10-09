// Original 3x5 caption alphabet; every character advances four native pixels.
const glyphs = {
  A: '010/101/111/101/101', B: '110/101/110/101/110',
  C: '011/100/100/100/011', D: '110/101/101/101/110',
  E: '111/100/110/100/111', F: '111/100/110/100/100',
  G: '011/100/101/101/011', H: '101/101/111/101/101',
  I: '111/010/010/010/111', J: '001/001/001/101/010',
  K: '101/101/110/101/101', L: '100/100/100/100/111',
  M: '101/111/111/101/101', N: '101/111/111/111/101',
  O: '010/101/101/101/010', P: '110/101/110/100/100',
  Q: '010/101/101/111/011', R: '110/101/110/101/101',
  S: '011/100/010/001/110', T: '111/010/010/010/010',
  U: '101/101/101/101/111', V: '101/101/101/101/010',
  W: '101/101/111/111/101', X: '101/101/010/101/101',
  Y: '101/101/010/010/010', Z: '111/001/010/100/111',
  0: '111/101/101/101/111', 1: '010/110/010/010/111',
  2: '110/001/010/100/111', 3: '110/001/010/001/110',
  4: '101/101/111/001/001', 5: '111/100/110/001/110',
  6: '011/100/111/101/111', 7: '111/001/010/010/010',
  8: '111/101/111/101/111', 9: '111/101/111/001/110',
  ' ': '000/000/000/000/000', ':': '000/010/000/010/000',
  '-': '000/000/111/000/000', '(': '001/010/010/010/001',
  ')': '100/010/010/010/100', '.': '000/000/000/000/010',
};
export const textWidth = text => Math.max(0, text.length * 4 - 1);
export function captionLines(name, maxChars = 24) {
  const text = name.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
  const lines = [];
  let line = '';
  for (let word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > maxChars) { lines.push(line); line = ''; }
    while (word.length > maxChars) { lines.push(word.slice(0, maxChars)); word = word.slice(maxChars); }
    if (word) line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
export function drawCaption(rgba, width, caption) {
  // A black backing keeps tiny white captions legible on any editor background.
  for (let y = 0; y < caption.height; y++) for (let x = 0; x < caption.width; x++) {
    rgba.set([0, 0, 0, 255], ((caption.y + y) * width + caption.x + x) * 4);
  }
  caption.lines.forEach((line, row) => {
    const start = caption.x + Math.floor((caption.width - textWidth(line)) / 2);
    [...line].forEach((letter, index) => {
      const glyph = glyphs[letter];
      if (!glyph) throw Error(`Unsupported caption character: ${letter}`);
      glyph.split('/').forEach((bits, y) => [...bits].forEach((bit, x) => {
        if (bit === '1') rgba.set([255, 255, 255, 255], ((caption.y + 1 + row * 7 + y) * width + start + index * 4 + x) * 4);
      }));
    });
  });
}

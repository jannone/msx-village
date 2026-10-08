import { encodeSettlement, initialSettlement, type Settlement } from './settlement.ts';
export const ROM_SIZE = 1024 * 1024;
export const BANK_SIZE = 8192;
export const REGION_RADIUS = 4;
export interface SnapshotPlot { x: number; y: number; revision: number; content: Settlement; username: string }

export function assembleSnapshot(core: Uint8Array, plots: SnapshotPlot[], centerX: number, centerY: number, own?: { x: number; y: number; revision: number }, createdAt = Math.floor(Date.now() / 1000)): Uint8Array {
  if (core.length !== BANK_SIZE * 3 || core[0] !== 65 || core[1] !== 66) throw new Error('Invalid ROM template');
  const rom = new Uint8Array(ROM_SIZE).fill(255);
  rom.set(core);
  const header = new DataView(rom.buffer, BANK_SIZE * 4, BANK_SIZE);
  rom.set([77, 83, 88, 86, 3, 9, 9, 0], BANK_SIZE * 4);
  const ownsRegion = own && Math.abs(own.x - centerX) <= 4 && Math.abs(own.y - centerY) <= 4;
  header.setUint8(8, ownsRegion ? (own.y - centerY + 4) * 9 + own.x - centerX + 4 : 255);
  header.setUint8(9, 40);
  header.setUint32(12, own?.revision ?? 0, true);
  header.setUint32(16, createdAt, true);
  header.setInt16(20, centerX, true); header.setInt16(22, centerY, true);
  const indexed = new Map(plots.map(p => [`${p.x},${p.y}`, p]));
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const slot = y * 9 + x;
    const plot = indexed.get(`${centerX + x - 4},${centerY + y - 4}`);
    rom.set(encodeSettlement(plot?.content ?? initialSettlement(false)), BANK_SIZE * (5 + slot));
    const meta = BANK_SIZE * 4 + 32 + slot * 32;
    rom.fill(0, meta, meta + 32);
    if (plot) {
      rom[meta] = 1;
      new DataView(rom.buffer).setUint32(meta + 4, plot.revision, true);
      rom.set(new TextEncoder().encode(plot.username).slice(0, 16), meta + 8);
    }
  }
  return rom;
}

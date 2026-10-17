// Generates the PWA PNG icons with no dependencies (raw PNG encoding via zlib).
// Run with: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0e, 0x10, 0x14];
const FG = [0x4f, 0x8c, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** Dumbbell drawn in a unit square; `scale` < 1 keeps it inside the maskable safe zone. */
function inShape(x, y, scale) {
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  const rect = (x0, y0, x1, y1, r) => {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const cx = Math.min(Math.max(u, x0 + r), x1 - r);
    const cy = Math.min(Math.max(v, y0 + r), y1 - r);
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  };
  return (
    rect(0.3, 0.465, 0.7, 0.535, 0.02) || // bar
    rect(0.2, 0.3, 0.29, 0.7, 0.03) || rect(0.71, 0.3, 0.8, 0.7, 0.03) || // big plates
    rect(0.12, 0.38, 0.19, 0.62, 0.025) || rect(0.81, 0.38, 0.88, 0.62, 0.025) // small plates
  );
}

function png(size, scale) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inShape((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, scale)) hits++;
      const a = hits / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('pwa-192.png', out), png(192, 0.9));
writeFileSync(new URL('pwa-512.png', out), png(512, 0.9));
writeFileSync(new URL('pwa-maskable-512.png', out), png(512, 0.7));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, 0.85));
writeFileSync(
  new URL('favicon.svg', out),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0e1014"/><g fill="#4f8cff"><rect x="19" y="29.5" width="26" height="5" rx="1.5"/><rect x="13" y="19" width="6" height="26" rx="2"/><rect x="45" y="19" width="6" height="26" rx="2"/><rect x="7.5" y="24" width="4.5" height="16" rx="1.5"/><rect x="52" y="24" width="4.5" height="16" rx="1.5"/></g></svg>\n`,
);
console.log('Icons written to public/');

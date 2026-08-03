// Generates PWA + apple-touch PNG icons using a dependency-free PNG encoder.
// Usage: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- icon drawing ----
// Brand colors (indigo gradient) matching the app theme.
const C1 = [129, 140, 248]; // #818cf8
const C2 = [79, 70, 229]; // #4f46e5
const WHITE = [255, 255, 255];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const corner = size * 0.22;
  const stroke = size * 0.1;
  const vTop = size * 0.3;
  const vBottom = size * 0.72;
  const vMid = size * 0.5;
  const vLeft = size * 0.26;
  const vRight = size * 0.74;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect background
      const cx = Math.max(x + 0.5, corner, size - (x + 0.5));
      const cy = Math.max(y + 0.5, corner, size - (y + 0.5));
      const inside = (cx - corner) ** 2 + (cy - corner) ** 2 <= corner ** 2;
      if (!inside) {
        buf[i + 3] = 0;
        continue;
      }
      // gradient
      const t = (x + y) / (2 * size);
      const r = Math.round(C1[0] + (C2[0] - C1[0]) * t);
      const g = Math.round(C1[1] + (C2[1] - C1[1]) * t);
      const b = Math.round(C1[2] + (C2[2] - C1[2]) * t);
      // V monogram
      const d1 = distToSegment(x + 0.5, y + 0.5, vLeft, vTop, vMid, vBottom);
      const d2 = distToSegment(x + 0.5, y + 0.5, vRight, vTop, vMid, vBottom);
      const onV = d1 <= stroke / 2 || d2 <= stroke / 2;
      buf[i] = onV ? WHITE[0] : r;
      buf[i + 1] = onV ? WHITE[1] : g;
      buf[i + 2] = onV ? WHITE[2] : b;
      buf[i + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

writeFileSync(join(outDir, "pwa-192x192.png"), drawIcon(192));
writeFileSync(join(outDir, "pwa-512x512.png"), drawIcon(512));
writeFileSync(join(outDir, "apple-touch-icon.png"), drawIcon(180));
console.log("Icons written to", outDir);

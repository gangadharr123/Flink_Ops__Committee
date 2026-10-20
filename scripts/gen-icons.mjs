// Run with: node scripts/gen-icons.mjs
// Draws the HubCheck app icons (dark square, white check mark) and writes
// them to public/icons/. No image libraries: a tiny PNG writer using
// Node's built-in zlib. Edit COLORS or CHECK and re-run to change the look.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT = join(import.meta.dirname, "..", "public", "icons");
const BG = [23, 23, 23]; // close to the app's primary (near black)
const FG = [255, 255, 255];
// Check mark corners, as fractions of the icon size.
const CHECK = [
  [0.29, 0.52],
  [0.44, 0.67],
  [0.72, 0.37],
];
const STROKE = 0.085; // check mark thickness (fraction of size)

// Distance from point p to segment a-b.
function distToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Is (x, y) inside a square of side 1 with rounded corners of radius r?
function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// shape: "rounded" (normal icon, transparent corners), "full" (iOS and
// maskable: the platform crops it). scale shrinks the check mark into the
// maskable "safe zone".
function draw(size, { shape, scale = 1 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // 4x4 samples per pixel for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (shape === "rounded" && !inRoundedSquare(u, v, 0.22)) continue;
          bgHits++;
          // Check mark, scaled around the centre.
          const p = [0.5 + (u - 0.5) / scale, 0.5 + (v - 0.5) / scale];
          const d = Math.min(distToSegment(p, CHECK[0], CHECK[1]), distToSegment(p, CHECK[1], CHECK[2]));
          if (d <= STROKE / 2) fgHits++;
        }
      }
      const total = SS * SS;
      const i = (y * size + x) * 4;
      const f = bgHits ? fgHits / bgHits : 0;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(BG[c] * (1 - f) + FG[c] * f);
      rgba[i + 3] = Math.round((bgHits / total) * 255);
    }
  }
  return png(size, rgba);
}

// Minimal PNG encoder (RGBA, 8 bits per channel).
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

mkdirSync(OUT, { recursive: true });
const icons = {
  "icon-192.png": draw(192, { shape: "rounded" }),
  "icon-512.png": draw(512, { shape: "rounded" }),
  // Android crops maskable icons to its own shape: keep the mark in the
  // central 80% "safe zone".
  "icon-maskable-512.png": draw(512, { shape: "full", scale: 0.8 }),
  // iPhone home screen: square, iOS rounds the corners itself.
  "apple-touch-icon.png": draw(180, { shape: "full" }),
};
for (const [name, data] of Object.entries(icons)) {
  writeFileSync(join(OUT, name), data);
  console.log(`${name}: ${data.length} bytes`);
}

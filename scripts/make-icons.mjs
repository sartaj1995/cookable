// Draws the app icons and the favicon from one set of shapes, so the repo
// carries no image it cannot rebuild. Run with: npm run icons
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// --brand, --brand-warm and --bg from src/styles.css.
const FROM = '#9a3412'
const TO = '#b5651d'
const INK = '#fbf7ef'

/*
 * A pot with steam rising off it. Coordinates are fractions of the canvas,
 * measured from its centre with y pointing down, so the whole drawing can be
 * shrunk into the maskable safe zone without redrawing it.
 */
const STROKE = 0.056 // rim, handles and steam
const RIM = [[-0.28, -0.03], [0.28, -0.03]]
const HANDLES = [
  [[-0.33, 0.06], [-0.23, 0.06]],
  [[0.23, 0.06], [0.33, 0.06]],
]
const BODY = { x0: -0.23, x1: 0.23, y0: -0.03, y1: 0.29, r: 0.08 } // bottom corners rounded
const STEAM = [-0.11, 0, 0.11].map((x) =>
  Array.from({ length: 33 }, (_, i) => {
    const t = i / 32
    return [x + 0.022 * Math.sin(t * 2 * Math.PI), -0.26 + 0.16 * t]
  }),
)
const LINES = [RIM, ...HANDLES, ...STEAM]

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))

function distToSegment(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : clamp01(((px - x1) * dx + (py - y1) * dy) / lenSq)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Signed distance from a point to the pot, in the drawing's own units. */
function potDistance(x, y) {
  let d = Infinity
  for (const line of LINES) {
    for (let i = 0; i < line.length - 1; i++) {
      d = Math.min(d, distToSegment(x, y, line[i], line[i + 1]))
    }
  }
  d -= STROKE / 2

  // The body: a box with only its bottom two corners rounded.
  const { x0, x1, y0, y1, r } = BODY
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rr = y > cy ? r : 0
  const qx = Math.abs(x - cx) - (x1 - x0) / 2 + rr
  const qy = Math.abs(y - cy) - (y1 - y0) / 2 + rr
  const box = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rr
  return Math.min(d, box)
}

function draw(size, { rounded, scale }) {
  const rgba = Buffer.alloc(size * size * 4)
  const [r0, g0, b0] = hex(FROM)
  const [r1, g1, b1] = hex(TO)
  const [ri, gi, bi] = hex(INK)
  const corner = size * 0.22

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px + 0.5
      const y = py + 0.5

      // Rounded-square edge, antialiased over one pixel.
      let alpha = 1
      if (rounded) {
        const cx = Math.min(Math.max(x, corner), size - corner)
        const cy = Math.min(Math.max(y, corner), size - corner)
        alpha = clamp01(corner - Math.hypot(x - cx, y - cy) + 0.5)
        if (alpha === 0) continue
      }

      // Diagonal gradient from --brand to --brand-warm, then the pot on top.
      const t = (x + y) / (2 * size)
      const d = potDistance((x / size - 0.5) / scale, (y / size - 0.5) / scale) * scale * size
      const ink = clamp01(0.5 - d)
      const i = (py * size + px) * 4
      rgba[i] = Math.round(lerp(lerp(r0, r1, t), ri, ink))
      rgba[i + 1] = Math.round(lerp(lerp(g0, g1, t), gi, ink))
      rgba[i + 2] = Math.round(lerp(lerp(b0, b1, t), bi, ink))
      rgba[i + 3] = Math.round(alpha * 255)
    }
  }
  return png(size, size, rgba)
}

/** The same drawing as vector, for the browser tab. */
function favicon() {
  const S = 512
  const at = (v) => +((0.5 + v) * S).toFixed(2)
  const len = (v) => +(v * S).toFixed(2)
  const { x0, x1, y0, y1, r } = BODY
  const body =
    `M${at(x0)} ${at(y0)}H${at(x1)}V${at(y1 - r)}` +
    `A${len(r)} ${len(r)} 0 0 1 ${at(x1 - r)} ${at(y1)}H${at(x0 + r)}` +
    `A${len(r)} ${len(r)} 0 0 1 ${at(x0)} ${at(y1 - r)}Z`
  const strokes = LINES.map((line) => 'M' + line.map(([x, y]) => `${at(x)} ${at(y)}`).join('L')).join('')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">`,
    `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${FROM}"/><stop offset="1" stop-color="${TO}"/></linearGradient></defs>`,
    `<rect width="${S}" height="${S}" rx="${len(0.22)}" fill="url(#bg)"/>`,
    `<path fill="${INK}" d="${body}"/>`,
    `<path fill="none" stroke="${INK}" stroke-width="${len(STROKE)}" stroke-linecap="round" stroke-linejoin="round" d="${strokes}"/>`,
    '</svg>',
    '',
  ].join('\n')
}

mkdirSync(OUT, { recursive: true })
for (const [name, size, opts] of [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  // Android crops a maskable icon to its own shape, so this one is full-bleed
  // with the pot shrunk to sit well inside the central safe circle.
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.82 }],
  // iOS rounds the corners itself and fills any transparency with black.
  ['apple-touch-icon.png', 180, { rounded: false, scale: 1 }],
]) {
  writeFileSync(resolve(OUT, name), draw(size, opts))
  console.log('wrote', name)
}
writeFileSync(resolve(OUT, 'favicon.svg'), favicon())
console.log('wrote favicon.svg')

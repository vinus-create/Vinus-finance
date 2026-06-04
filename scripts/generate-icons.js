/**
 * Generates PWA icon PNG files using only built-in Node.js modules.
 * Run: node scripts/generate-icons.js
 * Output: public/icons/icon-192x192.png, icon-512x512.png, apple-touch-icon.png
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// Emerald #10b981 = rgb(16, 185, 129)
const BG_R = 16, BG_G = 185, BG_B = 129
// White for letter
const FG_R = 255, FG_G = 255, FG_B = 255

// CRC32 table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

// Draw a pixel into RGB array
function setPixel(pixels, size, x, y, r, g, b) {
  if (x < 0 || x >= size || y < 0 || y >= size) return
  const i = (y * size + x) * 3
  pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b
}

// Draw a filled rectangle
function fillRect(pixels, size, x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(pixels, size, x, y, r, g, b)
}

// Draw a thick "V" shape using pixel blocks
function drawV(pixels, size) {
  const s = size / 100  // scale factor
  const thick = Math.max(1, Math.round(6 * s))  // stroke thickness

  // Left arm of V: top-left to bottom-center
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(20 * s + t * 30 * s)
    const y = Math.round(20 * s + t * 55 * s)
    fillRect(pixels, size, x - thick, y - thick, x + thick, y + thick, FG_R, FG_G, FG_B)
  }

  // Right arm of V: top-right to bottom-center
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(80 * s - t * 30 * s)
    const y = Math.round(20 * s + t * 55 * s)
    fillRect(pixels, size, x - thick, y - thick, x + thick, y + thick, FG_R, FG_G, FG_B)
  }
}

function createPNG(size) {
  // Create RGB pixel buffer (solid emerald background)
  const pixels = Buffer.alloc(size * size * 3)
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = BG_R; pixels[i+1] = BG_G; pixels[i+2] = BG_B
  }

  // Draw white V
  drawV(pixels, size)

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  // Raw scanlines: filter byte 0 + RGB pixels per row
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3
      const dst = y * (1 + size * 3) + 1 + x * 3
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]; raw[dst+2] = pixels[src+2]
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const sizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
]

for (const { size, name } of sizes) {
  process.stdout.write(`Generating ${name} (${size}x${size})... `)
  const png = createPNG(size)
  fs.writeFileSync(path.join(outDir, name), png)
  console.log(`done (${png.length} bytes)`)
}

console.log('All icons generated in public/icons/')

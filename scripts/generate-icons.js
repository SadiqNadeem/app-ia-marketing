// Generates icon-192.png and icon-512.png in /public using only Node.js built-ins.
// Run: node scripts/generate-icons.js
const { deflateSync } = require('zlib')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = Array.from({ length: 256 }, (_, i) => {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      return c
    })
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.concat([t, data])
  return Buffer.concat([u32(data.length), t, data, u32(crc32(crcBuf))])
}

// Letter P pixel mask at 8x8 grid (used for rough "P" glyph rendering)
const P_MASK = [
  [1,1,1,1,0,0,0,0],
  [1,0,0,0,1,0,0,0],
  [1,0,0,0,1,0,0,0],
  [1,1,1,1,0,0,0,0],
  [1,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0],
]

function generatePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = pngChunk('IHDR', Buffer.concat([u32(size), u32(size), Buffer.from([8, 2, 0, 0, 0])]))

  // Blue background (#2563EB) = 37, 99, 235
  // White letter P
  const glyphScale = Math.floor(size * 0.55)
  const glyphX = Math.floor((size - glyphScale * 0.5) / 2)
  const glyphY = Math.floor((size - glyphScale) / 2)
  const cellW = glyphScale / 8
  const cellH = glyphScale / 8

  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - glyphX) / cellW)
      const gy = Math.floor((y - glyphY) / cellH)
      const isLetter =
        gx >= 0 && gx < 8 && gy >= 0 && gy < 8 && P_MASK[gy]?.[gx] === 1
      row[1 + x * 3] = isLetter ? 255 : 37
      row[2 + x * 3] = isLetter ? 255 : 99
      row[3 + x * 3] = isLetter ? 255 : 235
    }
    rows.push(row)
  }

  const idat = pngChunk('IDAT', deflateSync(Buffer.concat(rows)))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

const outDir = join(__dirname, '..', 'public')
writeFileSync(join(outDir, 'icon-192.png'), generatePNG(192))
writeFileSync(join(outDir, 'icon-512.png'), generatePNG(512))
console.log('PWA icons generated: public/icon-192.png, public/icon-512.png')

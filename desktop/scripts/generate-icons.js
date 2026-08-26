/**
 * Generates valid PNG and Windows ICO icon files for NeuralCanvas Desktop.
 * Creates a modern glowing NeuralCanvas gradient icon with the ⚡ lightning motif.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  // Simple uncompressed RGBA raw image to valid PNG using zlib
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const center = size / 2;
  const radius = size * 0.44;

  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    rawData[rawOffset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Gradient from pink (#ff0071) to purple (#8b5cf6)
        const t = (x + y) / (width + height);
        const r = Math.round(255 * (1 - t) + 139 * t);
        const g = Math.round(0 * (1 - t) + 92 * t);
        const b = Math.round(113 * (1 - t) + 246 * t);
        
        // Anti-aliased edge
        const edgeDist = radius - dist;
        const alpha = edgeDist < 1.5 ? Math.round(255 * (edgeDist / 1.5)) : 255;

        // Simple lightning shape test inside circle
        const nx = (x - center) / radius; // -1 to 1
        const ny = (y - center) / radius; // -1 to 1

        let isBolt = false;
        // Upper segment
        if (ny >= -0.65 && ny <= 0.05 && nx >= -0.25 - (ny * 0.35) && nx <= 0.15 - (ny * 0.35)) {
          isBolt = true;
        }
        // Lower segment
        if (ny >= -0.05 && ny <= 0.65 && nx >= -0.15 - (ny * 0.35) && nx <= 0.25 - (ny * 0.35)) {
          isBolt = true;
        }

        if (isBolt) {
          rawData[rawOffset++] = 255; // R
          rawData[rawOffset++] = 255; // G
          rawData[rawOffset++] = 255; // B
          rawData[rawOffset++] = alpha;
        } else {
          rawData[rawOffset++] = r;
          rawData[rawOffset++] = g;
          rawData[rawOffset++] = b;
          rawData[rawOffset++] = alpha;
        }
      } else {
        // Transparent
        rawData[rawOffset++] = 0;
        rawData[rawOffset++] = 0;
        rawData[rawOffset++] = 0;
        rawData[rawOffset++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 72, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(crcBuf);
  chunk.writeUInt32BE(crcVal >>> 0, 8 + len);

  return chunk;
}

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function createICO(pngBuffers) {
  // ICO header: 6 bytes
  // ICONDIRENTRY: 16 bytes each
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  let entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const imageBuffers = [];

  pngBuffers.forEach((img, i) => {
    const entry = entries.subarray(i * 16, (i + 1) * 16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Offset of image data
    offset += img.buffer.length;
    imageBuffers.push(img.buffer);
  });

  return Buffer.concat([header, entries, ...imageBuffers]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate PNGs at 16, 32, 48, 64, 128, 256
const sizes = [16, 32, 48, 64, 128, 256];
const pngs = sizes.map(size => ({ size, buffer: createPNG(size) }));

const icon256 = pngs.find(p => p.size === 256).buffer;
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon256);

const icoBuffer = createICO(pngs);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);

console.log('✅ Generated desktop/assets/icon.png and desktop/assets/icon.ico successfully!');

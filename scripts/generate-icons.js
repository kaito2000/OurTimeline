import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    // CRC32 calculation
    let crc = 0xffffffff;
    for (let i = 4; i < 8 + len; i++) {
      let c = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ c) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        c = c >>> 1;
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineWidth = width * 3 + 1;
  const rawData = Buffer.alloc(height * scanlineWidth);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    rawData[rowOffset] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // create a subtle vignette / gradient
      const dx = (x - width / 2) / (width / 2);
      const dy = (y - height / 2) / (height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = Math.max(0.6, 1 - dist * 0.4);
      rawData[pixelOffset] = Math.min(255, Math.floor(r * factor));
      rawData[pixelOffset + 1] = Math.min(255, Math.floor(g * factor));
      rawData[pixelOffset + 2] = Math.min(255, Math.floor(b * factor));
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

fs.writeFileSync('icons/icon-192.png', createPNG(192, 192, 225, 29, 72));
fs.writeFileSync('icons/icon-512.png', createPNG(512, 512, 225, 29, 72));
console.log('PNG icons created successfully');

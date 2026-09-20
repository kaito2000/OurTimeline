import fs from 'fs';
import zlib from 'zlib';

function createModernPNG(width, height) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA: 4 channels)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
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

  // RGBA with filter byte 0
  const scanlineWidth = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineWidth);
  const cornerRadius = width * 0.22; // iOS風角丸

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    rawData[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // 角丸判定
      let inside = true;
      let alpha = 255;

      const left = x < cornerRadius;
      const right = x > width - cornerRadius;
      const top = y < cornerRadius;
      const bottom = y > height - cornerRadius;

      if ((left || right) && (top || bottom)) {
        const cx = left ? cornerRadius : width - cornerRadius;
        const cy = top ? cornerRadius : height - cornerRadius;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist > cornerRadius) {
          inside = false;
        } else if (dist > cornerRadius - 1) {
          alpha = Math.floor(255 * (cornerRadius - dist));
        }
      }

      if (!inside) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // 洗練されたサンセットローズグラデーション
      // 左上: #ff758c, 中央: #e11d48, 右下: #880e4f
      const nx = x / width;
      const ny = y / height;

      // ラジアル距離
      const dCenter = Math.sqrt((nx - 0.4) ** 2 + (ny - 0.35) ** 2);
      
      let r = 255 - Math.floor(dCenter * 90);
      let g = 80 - Math.floor(ny * 60) + Math.floor(nx * 30);
      let b = 120 + Math.floor(dCenter * 40) - Math.floor(nx * 40);

      r = Math.max(136, Math.min(255, r));
      g = Math.max(14, Math.min(130, g));
      b = Math.max(50, Math.min(150, b));

      // 中央のハート・シンボルシルエットの微かな描画
      const hx = (nx - 0.5) * 2;
      const hy = (ny - 0.52) * 2;
      // ハート関数 (x^2 + y^2 - 0.4)^3 - x^2 * y^3 < 0
      const aVal = hx * hx + hy * hy - 0.42;
      const heartShape = aVal * aVal * aVal - hx * hx * hy * hy * hy;

      if (heartShape <= 0.05) {
        // ハート内・周辺をホワイト＆ゴールド発光
        const blend = Math.max(0, Math.min(1, (0.05 - heartShape) * 15));
        r = Math.floor(r * (1 - blend) + 255 * blend);
        g = Math.floor(g * (1 - blend) + 240 * blend);
        b = Math.floor(b * (1 - blend) + 245 * blend);
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = alpha;
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

fs.writeFileSync('icons/icon-192.png', createModernPNG(192, 192));
fs.writeFileSync('icons/icon-512.png', createModernPNG(512, 512));
console.log('Modern PNG icons generated successfully');

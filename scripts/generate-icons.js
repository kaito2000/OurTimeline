import fs from 'fs';
import zlib from 'zlib';

function createNaturalPNG(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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

  const scanlineWidth = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineWidth);
  const cornerRadius = width * 0.22;

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

      // 自然なセージグリーン〜フォレストグリーン〜ディープモス グラデーション
      // 上部: #52b788, 中央: #2d6a4f, 下部: #1b4332 / #081c15
      const nx = x / width;
      const ny = y / height;

      // ラジアル距離（左上からの太陽光・木漏れ日感）
      const dSun = Math.sqrt((nx - 0.25) ** 2 + (ny - 0.2) ** 2);

      let r = Math.floor(82 * (1 - ny * 0.7) + 30 * (1 - dSun));
      let g = Math.floor(183 * (1 - ny * 0.65) + 40 * (1 - dSun));
      let b = Math.floor(136 * (1 - ny * 0.75) + 25 * (1 - dSun));

      r = Math.max(8, Math.min(216, r));
      g = Math.max(28, Math.min(243, g));
      b = Math.max(21, Math.min(220, b));

      // タイムラインの縦線（xが中央付近）
      const cx = width / 2;
      const xDiff = Math.abs(x - cx);
      if (xDiff <= 2 && ny >= 0.15 && ny <= 0.85) {
        // 白い光の幹
        const lineAlpha = 1 - (xDiff / 3);
        r = Math.floor(r * (1 - lineAlpha * 0.7) + 255 * lineAlpha * 0.7);
        g = Math.floor(g * (1 - lineAlpha * 0.7) + 255 * lineAlpha * 0.7);
        b = Math.floor(b * (1 - lineAlpha * 0.7) + 255 * lineAlpha * 0.7);
      }

      // 対をなす若葉（リーフ）シンボル（ハートではない自然の芽吹き）
      // 左葉: (nx: 0.35~0.5, ny: 0.35~0.55)
      // 右葉: (nx: 0.5~0.65, ny: 0.25~0.45)
      const lx = (nx - 0.42) / 0.12;
      const ly = (ny - 0.44) / 0.15;
      const isLeftLeaf = (lx * lx + ly * ly) <= 0.8 && (lx - ly) >= -0.2;

      const rx = (nx - 0.58) / 0.12;
      const ry = (ny - 0.34) / 0.15;
      const isRightLeaf = (rx * rx + ry * ry) <= 0.8 && (rx + ry) <= 0.2;

      if (isLeftLeaf || isRightLeaf) {
        r = Math.floor(r * 0.2 + 235 * 0.8);
        g = Math.floor(g * 0.2 + 250 * 0.8);
        b = Math.floor(b * 0.2 + 235 * 0.8);
      }

      // 中央TODAYノード
      const dNode = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * width;
      if (dNode <= width * 0.04) {
        r = 255;
        g = 255;
        b = 255;
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

fs.writeFileSync('icons/icon-192.png', createNaturalPNG(192, 192));
fs.writeFileSync('icons/icon-512.png', createNaturalPNG(512, 512));
console.log('Natural green PNG icons generated successfully');

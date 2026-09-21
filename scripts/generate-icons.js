import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.resolve(__dirname, '../icons/icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// 512x512
const resvg512 = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 512 }
});
const pngData512 = resvg512.render().asPng();
fs.writeFileSync(path.resolve(__dirname, '../icons/icon-512.png'), pngData512);
console.log('Generated icon-512.png (' + pngData512.length + ' bytes)');

// 192x192
const resvg192 = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 192 }
});
const pngData192 = resvg192.render().asPng();
fs.writeFileSync(path.resolve(__dirname, '../icons/icon-192.png'), pngData192);
console.log('Generated icon-192.png (' + pngData192.length + ' bytes)');

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTargetDimensions, compressImageToWebP } from '../js/imageCompressor.js';

test('calculateTargetDimensions scales down images preserving aspect ratio', () => {
  // 1. 横長画像 (4000 x 3000) -> 長辺1200に縮小 (1200 x 900)
  const landscape = calculateTargetDimensions(4000, 3000, 1200);
  assert.equal(landscape.width, 1200);
  assert.equal(landscape.height, 900);

  // 2. 縦長画像 (2400 x 3600) -> 長辺1200に縮小 (800 x 1200)
  const portrait = calculateTargetDimensions(2400, 3600, 1200);
  assert.equal(portrait.width, 800);
  assert.equal(portrait.height, 1200);

  // 3. すでに最大サイズ以下の画像 (800 x 600) -> リサイズなし
  const small = calculateTargetDimensions(800, 600, 1200);
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);

  // 4. 正方形画像 (2000 x 2000) -> 1200 x 1200
  const square = calculateTargetDimensions(2000, 2000, 1200);
  assert.equal(square.width, 1200);
  assert.equal(square.height, 1200);

  // 5. 不正な値
  const invalid = calculateTargetDimensions(0, -10, 1200);
  assert.equal(invalid.width, 0);
  assert.equal(invalid.height, 0);
});

test('compressImageToWebP validates file type', async () => {
  // null や未指定
  await assert.rejects(
    async () => {
      await compressImageToWebP(null);
    },
    /画像ファイルが指定されていません/
  );

  // 画像以外のファイル
  const nonImageFile = { type: 'application/pdf', size: 1024 };
  await assert.rejects(
    async () => {
      await compressImageToWebP(nonImageFile);
    },
    /選択されたファイルは画像ではありません/
  );
});

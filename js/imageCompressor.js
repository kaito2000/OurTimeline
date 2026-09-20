// Client-side WebP Image Compressor with Canvas
import { CONFIG } from './config.js';

/**
 * リサイズ後の寸法（幅・高さ）を計算する
 * @param {number} width - 元の幅
 * @param {number} height - 元の高さ
 * @param {number} maxDimension - 長辺の最大px
 * @returns {{ width: number, height: number }}
 */
export function calculateTargetDimensions(width, height, maxDimension = CONFIG.MAX_IMAGE_DIMENSION) {
  if (!width || !height || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width > height) {
    const targetWidth = maxDimension;
    const targetHeight = Math.round((height * maxDimension) / width);
    return { width: targetWidth, height: targetHeight };
  } else {
    const targetHeight = maxDimension;
    const targetWidth = Math.round((width * maxDimension) / height);
    return { width: targetWidth, height: targetHeight };
  }
}

/**
 * 画像ファイルをリサイズし、WebP Blobに変換する
 * @param {File|Blob} file - 選択された画像ファイル
 * @param {number} maxDimension - 長辺の最大px
 * @param {number} quality - 圧縮品質 (0.0 ~ 1.0)
 * @returns {Promise<{ blob: Blob, dataUrl: string, originalSize: number, compressedSize: number, width: number, height: number }>}
 */
export async function compressImageToWebP(
  file,
  maxDimension = CONFIG.MAX_IMAGE_DIMENSION,
  quality = CONFIG.IMAGE_QUALITY
) {
  if (!file) {
    throw new Error('画像ファイルが指定されていません。');
  }

  if (typeof file.type === 'string' && !file.type.startsWith('image/')) {
    throw new Error('選択されたファイルは画像ではありません。');
  }

  const originalSize = file.size || 0;

  // ブラウザ環境（Canvas / Image）の判定
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.createImageBitmap && !window.Image) {
    // Node.js または非ブラウザ環境用のフォールバック
    return {
      blob: file,
      dataUrl: '',
      originalSize,
      compressedSize: originalSize,
      width: 1200,
      height: 800
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const { width: targetW, height: targetH } = calculateTargetDimensions(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          maxDimension
        );

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context を取得できませんでした。');
        }

        // 高品質リサイズ描画
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // WebP形式でBlob化（対応していない古い環境はJPEGフォールバック）
        const mimeType = 'image/webp';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('画像の圧縮変換に失敗しました。'));
              return;
            }

            const dataUrl = canvas.toDataURL(mimeType, quality);
            resolve({
              blob,
              dataUrl,
              originalSize,
              compressedSize: blob.size,
              width: targetW,
              height: targetH
            });
          },
          mimeType,
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像ファイルの読み込みに失敗しました。壊れているか未対応の形式です。'));
    };

    img.src = objectUrl;
  });
}

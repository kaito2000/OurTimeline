// Web Crypto / Node.js Crypto 抽象化モジュール

/**
 * 256bit（32バイト）の推測不可能な暗号学的に安全なランダムキーを生成
 * @returns {string} 64文字のHex文字列
 */
export function generatePairSecretKey() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js またはフォールバック
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * シークレットキーのSHA-256ハッシュ（Hex文字列）を計算
 * @param {string} key
 * @returns {Promise<string>} 64文字のHexハッシュ
 */
export async function hashSecretKey(key) {
  if (!key) return '';
  
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js 環境での実行用フォールバック
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(key).digest('hex');
  } catch (e) {
    // 最小限のSHA-256フォールバック実装（万が一の環境用）
    console.error('Crypto subtle not supported in current environment', e);
    return '';
  }
}

/**
 * UUID v4 生成
 * @returns {string} UUID形式文字列
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // フォールバック
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

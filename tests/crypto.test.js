import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePairSecretKey, hashSecretKey, generateUUID } from '../js/crypto.js';

test('generatePairSecretKey generates 64-character hex string', () => {
  const key1 = generatePairSecretKey();
  const key2 = generatePairSecretKey();

  assert.equal(typeof key1, 'string');
  assert.equal(key1.length, 64);
  assert.match(key1, /^[0-9a-f]{64}$/);

  // 一意性の確認
  assert.notEqual(key1, key2);
});

test('hashSecretKey generates valid SHA-256 hex string', async () => {
  // 'hello' の SHA-256 は 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  const testInput = 'hello';
  const expectedHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  
  const hash = await hashSecretKey(testInput);
  assert.equal(hash, expectedHash);

  // 空文字の場合は空文字を返す
  const emptyHash = await hashSecretKey('');
  assert.equal(emptyHash, '');
});

test('generateUUID generates RFC4122 compliant UUID v4', () => {
  const uuid = generateUUID();
  assert.equal(typeof uuid, 'string');
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

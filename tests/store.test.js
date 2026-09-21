import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../js/store.js';

test('Store manages state and notifications', () => {
  const store = new Store();
  let notificationCount = 0;

  const unsubscribe = store.subscribe(() => {
    notificationCount++;
  });

  // 初期値の確認
  assert.equal(store.state.isOnline, true);
  assert.equal(store.state.isSyncing, false);

  // ペア設定
  store.setPairCredentials('test-pair-uuid', 'test-secret-key-1234');
  assert.equal(store.state.pairId, 'test-pair-uuid');
  assert.equal(store.state.secretKey, 'test-secret-key-1234');
  assert.equal(notificationCount, 1);

  // イベント追加
  const newEvent = {
    id: 'event-1',
    pair_id: 'test-pair-uuid',
    event_date: '2025-05-01',
    title: '新しい旅行の計画',
    category: 'future',
    is_completed: false
  };

  store.upsertEvent(newEvent);
  assert.equal(store.state.events.length, 1);
  assert.equal(store.state.events[0].title, '新しい旅行の計画');
  assert.equal(notificationCount, 2);

  // イベント更新（upsert）
  store.upsertEvent({
    id: 'event-1',
    title: '沖縄旅行の計画'
  });
  assert.equal(store.state.events.length, 1);
  assert.equal(store.state.events[0].title, '沖縄旅行の計画');
  assert.equal(store.state.events[0].category, 'future'); // 既存フィールド保持

  // 未来イベントの完了トグル
  store.toggleEventCompletion('event-1');
  assert.equal(store.state.events[0].is_completed, true);

  store.toggleEventCompletion('event-1');
  assert.equal(store.state.events[0].is_completed, false);

  // イベント削除
  store.removeEvent('event-1');
  assert.equal(store.state.events.length, 0);

  // 購読解除
  unsubscribe();
  const currentCount = notificationCount;
  store.setOnlineStatus(false);
  assert.equal(notificationCount, currentCount); // 増えないこと
});

test('parseInviteString correctly parses URLs and tokens', async () => {
  const { parseInviteString } = await import('../js/store.js');

  // 1. フルURL形式
  const url1 = 'https://kaito2000.github.io/OurTimeline/?pair=123e4567-e89b-12d3-a456-426614174000&key=abcdef123456&su=https://test.supabase.co&sk=anon-key-xyz';
  const parsed1 = parseInviteString(url1);
  assert.ok(parsed1);
  assert.equal(parsed1.pairId, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(parsed1.secretKey, 'abcdef123456');
  assert.equal(parsed1.supabaseUrl, 'https://test.supabase.co');
  assert.equal(parsed1.supabaseAnonKey, 'anon-key-xyz');

  // 2. パラメータのみの形式
  const url2 = '?pair=my-pair-id&key=my-key';
  const parsed2 = parseInviteString(url2);
  assert.ok(parsed2);
  assert.equal(parsed2.pairId, 'my-pair-id');
  assert.equal(parsed2.secretKey, 'my-key');

  // 3. トークン形式 (pair:key)
  const token = 'my-pair-id:my-key-secret';
  const parsed3 = parseInviteString(token);
  assert.ok(parsed3);
  assert.equal(parsed3.pairId, 'my-pair-id');
  assert.equal(parsed3.secretKey, 'my-key-secret');

  // 4. 不正な文字列
  assert.equal(parseInviteString(''), null);
  assert.equal(parseInviteString('hello-world'), null);
});

test('Store joinPair updates credentials and clears old cache', () => {
  const store = new Store();
  store.state.events = [{ id: 'old-event-1', title: '古いイベント' }];

  const result = store.joinPair({
    pairId: 'new-pair-id',
    secretKey: 'new-secret-key',
    supabaseUrl: 'https://new.supabase.co',
    supabaseAnonKey: 'new-key'
  });

  assert.equal(result, true);
  assert.equal(store.state.pairId, 'new-pair-id');
  assert.equal(store.state.secretKey, 'new-secret-key');
  assert.equal(store.state.supabaseUrl, 'https://new.supabase.co');
  assert.equal(store.state.supabaseAnonKey, 'new-key');
  assert.equal(store.state.events.length, 0); // 古いキャッシュがクリアされていること
});

test('Store toggleReaction increments and decrements emoji counts properly', () => {
  const store = new Store();
  store.state.events = [
    { id: 'event-1', title: 'テスト旅行', reactions: {} }
  ];

  // 1回目の押下（追加）
  const updated1 = store.toggleReaction('event-1', '🌿');
  assert.equal(updated1.reactions['🌿'], 1);

  // 別の絵文字の押下
  const updated2 = store.toggleReaction('event-1', '✨');
  assert.equal(updated2.reactions['✨'], 1);
  assert.equal(updated2.reactions['🌿'], 1);

  // 同じ絵文字の再押下（解除）
  const updated3 = store.toggleReaction('event-1', '🌿');
  assert.equal(updated3.reactions['🌿'], undefined); // 0になったらキー削除
  assert.equal(updated3.reactions['✨'], 1);
});


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

import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../js/store.js';

test('Store notification lifecycle (add, unread count, mark read, clear)', () => {
  const store = new Store();

  // 初期状態
  assert.equal(store.state.notifications.length, 0);
  assert.equal(store.state.unreadNotificationCount, 0);

  // 1. 通知の追加
  store.addNotification({
    type: 'event_created',
    title: '新しい思い出',
    body: '屋久島旅行',
    icon: '🌿',
    targetEventId: 'event-1'
  });

  assert.equal(store.state.notifications.length, 1);
  assert.equal(store.state.unreadNotificationCount, 1);
  assert.equal(store.state.notifications[0].isRead, false);
  assert.equal(store.state.notifications[0].title, '新しい思い出');

  // 2. 別の通知の追加
  store.addNotification({
    type: 'reaction',
    title: 'リアクションが届きました',
    body: '屋久島旅行に 🌿',
    icon: '✨',
    targetEventId: 'event-1'
  });

  assert.equal(store.state.notifications.length, 2);
  assert.equal(store.state.unreadNotificationCount, 2);

  // 3. 同一イベントの同一種別の重複防止（先頭に更新）
  store.addNotification({
    type: 'reaction',
    title: 'リアクションが届きました',
    body: '屋久島旅行に ✨',
    icon: '✨',
    targetEventId: 'event-1'
  });

  // 2件のまま更新されること
  assert.equal(store.state.notifications.length, 2);
  assert.equal(store.state.notifications[0].body, '屋久島旅行に ✨');

  // 4. すべて既読にする（確認したら消す）
  store.markAllNotificationsAsRead();
  assert.equal(store.state.unreadNotificationCount, 0);
  assert.equal(store.state.notifications[0].isRead, true);
  assert.equal(store.state.notifications[1].isRead, true);

  // 5. 全消去
  store.clearAllNotifications();
  assert.equal(store.state.notifications.length, 0);
  assert.equal(store.state.unreadNotificationCount, 0);
});

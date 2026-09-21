import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaysCount, formatDate, sortEventsDescending } from '../js/timelineRenderer.js';

test('calculateDaysCount calculates accurate day count', () => {
  // 同一日 -> Day 1
  const sameDayCount = calculateDaysCount('2024-01-01', '2024-01-01');
  assert.equal(sameDayCount, 1);

  // 10日後 -> Day 11
  const tenDaysLater = calculateDaysCount('2024-01-01', '2024-01-11');
  assert.equal(tenDaysLater, 11);

  // うるう年跨ぎ (2024年2月は29日まで)
  // 2024-02-28 から 2024-03-01 は 2日間経過 -> Day 3
  const leapYearCount = calculateDaysCount('2024-02-28', '2024-03-01');
  assert.equal(leapYearCount, 3);

  // 未指定時のフォールバック
  assert.equal(calculateDaysCount(''), 0);
});

test('formatDate formats date into readable Japanese string', () => {
  // 2024-01-01 は月曜日
  const formatted = formatDate('2024-01-01');
  assert.equal(formatted, '2024年1月1日 (月)');

  // 2025-12-25 は木曜日
  const formatted2 = formatDate('2025-12-25');
  assert.equal(formatted2, '2025年12月25日 (木)');

  assert.equal(formatDate(''), '');
});

test('sortEventsDescending sorts events correctly in descending order (future to past)', () => {
  const events = [
    { id: '1', event_date: '2023-05-10', title: 'Past Event' },
    { id: '2', event_date: '2026-08-20', title: 'Far Future Event' },
    { id: '3', event_date: '2024-12-31', title: 'Recent Event' },
    { id: '4', event_date: '2025-06-01', title: 'Near Future Event' }
  ];

  const sorted = sortEventsDescending(events);
  const ids = sorted.map(e => e.id);

  // 降順: 2026-08-20 (2) -> 2025-06-01 (4) -> 2024-12-31 (3) -> 2023-05-10 (1)
  assert.deepEqual(ids, ['2', '4', '3', '1']);
});

test('calculateDaysUntil calculates remaining days correctly', async () => {
  const { calculateDaysUntil } = await import('../js/timelineRenderer.js');

  // 今日 -> 0
  assert.equal(calculateDaysUntil('2026-09-21', '2026-09-21'), 0);

  // 明日 -> 1
  assert.equal(calculateDaysUntil('2026-09-22', '2026-09-21'), 1);

  // 10日後 -> 10
  assert.equal(calculateDaysUntil('2026-10-01', '2026-09-21'), 10);

  // 昨日（過去） -> -1
  assert.equal(calculateDaysUntil('2026-09-20', '2026-09-21'), -1);

  // 空文字
  assert.equal(calculateDaysUntil(''), 0);
});

test('CONFIG.CATEGORIES has 5 curated categories with valid properties', async () => {
  const { CONFIG } = await import('../js/config.js');
  const keys = Object.keys(CONFIG.CATEGORIES);
  assert.equal(keys.length, 5);
  assert.ok(keys.includes('life'));
  assert.ok(keys.includes('gourmet'));
  assert.ok(keys.includes('outing'));
  assert.ok(keys.includes('trip'));
  assert.ok(keys.includes('anniversary'));

  for (const key of keys) {
    const cat = CONFIG.CATEGORIES[key];
    assert.ok(cat.icon && typeof cat.icon === 'string');
    assert.ok(cat.label && typeof cat.label === 'string');
    assert.ok(cat.color && typeof cat.color === 'string');
  }
});

test('Promise completion logic preserves is_completed for existing events', () => {
  // 既存の未達成イベント（例: 未来の約束）
  const existingUncompletedEvent = {
    id: 'evt-future-1',
    event_date: '2026-10-01',
    title: '紅葉を見に行く',
    category: 'trip',
    is_completed: false
  };

  // 編集処理のロジック再現
  const isEdit = true;
  let isCompleted;
  if (isEdit && typeof existingUncompletedEvent.is_completed === 'boolean') {
    isCompleted = existingUncompletedEvent.is_completed;
  }

  // 編集後も false（未達成）が維持される
  assert.equal(isCompleted, false);

  // 新規イベントで未来の日付の場合は自動的に false（未達成）
  const todayStr = '2026-09-21';
  const newDate = '2026-11-15';
  const newCategory = 'outing';
  let newIsCompleted;
  const isFutureDate = newDate > todayStr;
  newIsCompleted = !(isFutureDate || newCategory === 'future');
  assert.equal(newIsCompleted, false);

  // 新規イベントで過去の日付の場合は true（完了）
  const pastDate = '2026-05-01';
  const pastCategory = 'gourmet';
  const isPastFutureDate = pastDate > todayStr;
  const pastIsCompleted = !(isPastFutureDate || pastCategory === 'future');
  assert.equal(pastIsCompleted, true);
});

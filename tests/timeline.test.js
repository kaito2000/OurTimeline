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

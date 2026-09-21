import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOnThisDayHighlight } from '../js/onThisDay.js';

test('getOnThisDayHighlight returns exact match when event happened on the same month and day in a previous year', () => {
  const refDate = new Date('2026-09-21T10:00:00');
  const events = [
    { id: '1', title: '1年前の今日', event_date: '2025-09-21', memo: 'プロポーズ' },
    { id: '2', title: '先月の旅行', event_date: '2026-08-15', memo: '' }
  ];

  const highlight = getOnThisDayHighlight(events, refDate);
  assert.ok(highlight);
  assert.equal(highlight.event.id, '1');
  assert.equal(highlight.diffYears, 1);
  assert.equal(highlight.type, 'exact');
  assert.match(highlight.message, /1年前の今日の思い出/);
});

test('getOnThisDayHighlight returns nearby match when within 3 days in the same month', () => {
  const refDate = new Date('2026-09-21T10:00:00');
  const events = [
    { id: '1', title: '2年前の近隣日', event_date: '2024-09-19', memo: '秋の京都' },
    { id: '2', title: '今年の予定', event_date: '2026-10-01', memo: '' }
  ];

  const highlight = getOnThisDayHighlight(events, refDate);
  assert.ok(highlight);
  assert.equal(highlight.event.id, '1');
  assert.equal(highlight.diffYears, 2);
  assert.equal(highlight.type, 'nearby');
  assert.match(highlight.message, /2年前のこの頃の思い出/);
});

test('getOnThisDayHighlight returns month match when in the same month but > 3 days apart', () => {
  const refDate = new Date('2026-09-21T10:00:00');
  const events = [
    { id: '1', title: '3年前の9月始め', event_date: '2023-09-05', memo: '引っ越し' }
  ];

  const highlight = getOnThisDayHighlight(events, refDate);
  assert.ok(highlight);
  assert.equal(highlight.event.id, '1');
  assert.equal(highlight.diffYears, 3);
  assert.equal(highlight.type, 'month');
  assert.match(highlight.message, /3年前の9月の思い出/);
});

test('getOnThisDayHighlight returns null when no past year events in this month', () => {
  const refDate = new Date('2026-09-21T10:00:00');
  const events = [
    { id: '1', title: '去年の春', event_date: '2025-04-10', memo: '' },
    { id: '2', title: '今年のできごと', event_date: '2026-09-21', memo: '' } // 今年のものは除外されるべき
  ];

  const highlight = getOnThisDayHighlight(events, refDate);
  assert.equal(highlight, null);
});

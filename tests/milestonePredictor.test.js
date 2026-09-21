import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysToDate, getNextAnnualAnniversary, predictMilestones } from '../js/milestonePredictor.js';

test('addDaysToDate accurately adds days across months and years', () => {
  assert.equal(addDaysToDate('2024-01-01', 0), '2024-01-01');
  assert.equal(addDaysToDate('2024-01-01', 99), '2024-04-09'); // 2024年はうるう年(2月29日)
  assert.equal(addDaysToDate('2024-01-01', 365), '2024-12-31');
  assert.equal(addDaysToDate('2024-01-01', 366), '2025-01-01');
});

test('getNextAnnualAnniversary calculates next annual celebration correctly', () => {
  // 交際記念日: 2023-05-10
  // 基準日: 2024-05-01 (記念日の9日前) -> 2024-05-10 (1周年, あと9日)
  const next1 = getNextAnnualAnniversary('2023-05-10', '2024-05-01');
  assert.equal(next1.date, '2024-05-10');
  assert.equal(next1.years, 1);
  assert.equal(next1.daysUntil, 9);

  // 基準日: 2024-05-10 (記念日当日) -> 2024-05-10 (1周年, あと0日)
  const nextToday = getNextAnnualAnniversary('2023-05-10', '2024-05-10');
  assert.equal(nextToday.date, '2024-05-10');
  assert.equal(nextToday.years, 1);
  assert.equal(nextToday.daysUntil, 0);

  // 基準日: 2024-05-11 (記念日の翌日) -> 来年 2025-05-10 (2周年)
  const nextNextYear = getNextAnnualAnniversary('2023-05-10', '2024-05-11');
  assert.equal(nextNextYear.date, '2025-05-10');
  assert.equal(nextNextYear.years, 2);
  assert.ok(nextNextYear.daysUntil > 300);
});

test('predictMilestones finds nearest milestone among days and annual anniversaries', () => {
  // 交際開始: 2024-01-01 (Day 1)
  // 基準日: 2024-03-22 (Day 82)
  // Day 100 は 2024-04-09 (あと18日)
  // 交際1周年 は 2025-01-01 (あと285日)
  const res = predictMilestones({
    anniversaryDating: '2024-01-01',
    anniversaryMarriage: '',
    baseDate: '2024-03-22'
  });

  assert.equal(res.currentDays, 82);
  assert.ok(res.nextMilestone);
  assert.equal(res.nextMilestone.badge, 'Day 100');
  assert.equal(res.nextMilestone.targetDate, '2024-04-09');
  assert.equal(res.nextMilestone.daysUntil, 18);

  // 未来の入籍予定日 (2024-04-01) が設定されている場合 (基準日: 2024-03-25)
  const resFutureMarriage = predictMilestones({
    anniversaryDating: '2023-01-01',
    anniversaryMarriage: '2024-04-01',
    baseDate: '2024-03-25'
  });

  // 2024-03-25 から見ると、2024-04-01 は「ご入籍」当日（あと7日）
  const weddingMilestone = resFutureMarriage.upcomingMilestones.find(m => m.targetDate === '2024-04-01');
  assert.ok(weddingMilestone);
  assert.equal(weddingMilestone.badge, 'ご入籍');
  assert.equal(weddingMilestone.title, 'ご入籍・結婚記念日');
  assert.equal(weddingMilestone.daysUntil, 7);

  // そして1年後の 2025-04-01 が「結婚1周年」
  const firstAnniv = resFutureMarriage.upcomingMilestones.find(m => m.targetDate === '2025-04-01');
  assert.ok(firstAnniv);
  assert.equal(firstAnniv.badge, '結婚1周年');

  // すでに入籍済み (2023-04-01) の場合 (基準日: 2024-03-25) -> 2024-04-01 が「結婚1周年」
  const resPastMarriage = predictMilestones({
    anniversaryDating: '2022-01-01',
    anniversaryMarriage: '2023-04-01',
    baseDate: '2024-03-25'
  });
  const pastFirstAnniv = resPastMarriage.upcomingMilestones.find(m => m.targetDate === '2024-04-01');
  assert.ok(pastFirstAnniv);
  assert.equal(pastFirstAnniv.badge, '結婚1周年');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTreeGrowth, TREE_STAGES } from '../js/treeGrowth.js';

test('calculateTreeGrowth calculates stages and scores accurately', () => {
  // 1. 初期状態 (0日、0イベント)
  const initial = calculateTreeGrowth({ anniversaryDating: '', events: [] });
  assert.equal(initial.currentStage.level, 1);
  assert.equal(initial.currentStage.name, 'はじまりの双葉');
  assert.equal(initial.currentStage.icon, '🌱');
  assert.equal(initial.score, 0);

  // 2. イベントが10件、日数60日（約2ヶ月）
  // スコア: 60/30*3(=6) + 10*4(=40) = 46 -> Level 2
  const growth1 = calculateTreeGrowth({
    anniversaryDating: '2026-07-23', // 約60日前
    events: Array(10).fill({ is_completed: true, category: 'life' })
  });
  assert.equal(growth1.currentStage.level, 2);
  assert.equal(growth1.currentStage.name, 'すくすく育つ若葉');
  assert.equal(growth1.currentStage.icon, '🌿');

  // 3. 特別な記念日ハイライトボーナスとたくさんの思い出で大樹に成長
  // イベント50件 (200pt) + ハイライト10件 (100pt) + 2年 (730日 / 30 * 3 = 72pt) = 372pt -> Level 4
  const growth2 = calculateTreeGrowth({
    anniversaryDating: '2024-09-21',
    events: [
      ...Array(40).fill({ is_highlight: false, category: 'trip' }),
      ...Array(10).fill({ is_highlight: true, category: 'anniversary' })
    ]
  });
  assert.ok(growth2.score >= 200);
  assert.equal(growth2.currentStage.level, 4);
  assert.equal(growth2.currentStage.icon, '🌳');
});

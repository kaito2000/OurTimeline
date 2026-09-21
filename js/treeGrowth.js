// The Growing Tree - 「ふたりの木」成長エンジンモジュール
import { calculateDaysCount } from './timelineRenderer.js';

export const TREE_STAGES = [
  {
    level: 1,
    name: 'はじまりの双葉',
    icon: '🌱',
    minScore: 0,
    maxScore: 29,
    description: 'ふたりの物語が芽吹いたばかりの、小さな愛おしい双葉です。'
  },
  {
    level: 2,
    name: 'すくすく育つ若葉',
    icon: '🌿',
    minScore: 30,
    maxScore: 79,
    description: '日々の思い出を糧に、みずみずしく青々と葉を広げています。'
  },
  {
    level: 3,
    name: '健やかな若木',
    icon: '🪴',
    minScore: 80,
    maxScore: 199,
    description: 'しっかりと根を張り、ふたりの歩みを支える頼もしい若木です。'
  },
  {
    level: 4,
    name: '豊かな緑の木',
    icon: '🌳',
    minScore: 200,
    maxScore: 399,
    description: '四季折々のたくさんの思い出に包まれた、堂々たる緑豊かな木です。'
  },
  {
    level: 5,
    name: '祝福の実る大樹',
    icon: '✨🌳',
    minScore: 400,
    maxScore: Infinity,
    description: 'ふたりで叶えた約束と愛がたくさんの実を結んだ、奇跡の大樹です。'
  }
];

/**
 * ふたりの木の成長状態を計算
 * @param {Object} params
 * @param {string} params.anniversaryDating - 交際記念日 (YYYY-MM-DD)
 * @param {Array} params.events - イベント配列
 * @returns {{ score: number, days: number, eventCount: number, highlightCount: number, currentStage: Object, nextStage: Object|null, progressPercent: number }}
 */
export function calculateTreeGrowth({ anniversaryDating, events = [] }) {
  const days = anniversaryDating ? Math.max(1, calculateDaysCount(anniversaryDating)) : 1;
  const eventCount = events.length;
  const highlightCount = events.filter(e => Boolean(e.is_highlight)).length;

  // 成長スコア計算式:
  // - 経過日数: 30日ごとに 3pt
  // - 記録した思い出: 1件ごとに 4pt
  // - 特別な記念日ハイライト: 1件ごとに 10pt (特別なボーナス)
  const score = Math.floor(days / 30) * 3 + (eventCount * 4) + (highlightCount * 10);

  // 現在のステージを判定
  let currentStage = TREE_STAGES[0];
  let nextStage = TREE_STAGES[1] || null;

  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (score >= TREE_STAGES[i].minScore) {
      currentStage = TREE_STAGES[i];
      nextStage = TREE_STAGES[i + 1] || null;
      break;
    }
  }

  // 次のステージへの進捗率 (0〜100%)
  let progressPercent = 100;
  if (nextStage) {
    const stageSpan = nextStage.minScore - currentStage.minScore;
    const progressInStage = score - currentStage.minScore;
    progressPercent = Math.min(100, Math.max(0, Math.round((progressInStage / stageSpan) * 100)));
  }

  return {
    score,
    days,
    eventCount,
    highlightCount,
    currentStage,
    nextStage,
    progressPercent
  };
}

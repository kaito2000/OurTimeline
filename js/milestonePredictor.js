// Milestone Predictor - 次のキリ番・節目自動予報モジュール
import { calculateDaysCount, calculateDaysUntil, formatDate } from './timelineRenderer.js';

// 主なキリ番日数のリスト
const MILESTONE_DAY_CANDIDATES = [
  100, 200, 300, 400, 500, 600, 700, 777, 800, 900, 1000,
  1111, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
  2222, 2500, 3000, 3333, 3500, 4000, 4500, 5000, 7777, 10000
];

/**
 * 指定された開始日からN日後の日付文字列(YYYY-MM-DD)を取得
 * @param {string} startDateString - YYYY-MM-DD
 * @param {number} daysToAdd - 加算する日数
 * @returns {string}
 */
export function addDaysToDate(startDateString, daysToAdd) {
  const d = new Date(startDateString + 'T00:00:00');
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 次の周年記念日を計算
 * @param {string} startDateString - YYYY-MM-DD
 * @param {string} baseDateString - 基準日 YYYY-MM-DD
 * @returns {{ date: string, years: number, daysUntil: number } | null}
 */
export function getNextAnnualAnniversary(startDateString, baseDateString) {
  if (!startDateString) return null;

  const start = new Date(startDateString + 'T00:00:00');
  const base = new Date(baseDateString + 'T00:00:00');

  const startMonth = start.getMonth();
  const startDay = start.getDate();
  const baseYear = base.getFullYear();

  // 今年の記念日候補
  let targetYear = baseYear;
  let targetDate = new Date(targetYear, startMonth, startDay);
  targetDate.setHours(0, 0, 0, 0);

  const baseZero = new Date(baseYear, base.getMonth(), base.getDate());
  baseZero.setHours(0, 0, 0, 0);

  // 今年の記念日がすでに過ぎている場合は来年
  if (targetDate.getTime() < baseZero.getTime()) {
    targetYear += 1;
    targetDate = new Date(targetYear, startMonth, startDay);
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const years = targetYear - start.getFullYear();
  const daysUntil = calculateDaysUntil(dateStr, baseDateString);

  return {
    date: dateStr,
    years: Math.max(1, years),
    daysUntil
  };
}

/**
 * 次のキリ番・節目（マイルストーン）を自動予測・計算
 * @param {Object} params
 * @param {string} params.anniversaryDating - 交際記念日 (YYYY-MM-DD)
 * @param {string} [params.anniversaryMarriage] - 結婚記念日 (YYYY-MM-DD)
 * @param {string} [params.baseDate] - 基準日 (YYYY-MM-DD, 省略時は今日)
 * @returns {{ currentDays: number, nextMilestone: Object|null, upcomingMilestones: Array<Object> }}
 */
export function predictMilestones({ anniversaryDating, anniversaryMarriage, baseDate }) {
  const baseDateStr = baseDate || new Date().toISOString().split('T')[0];
  if (!anniversaryDating) {
    return { currentDays: 0, nextMilestone: null, upcomingMilestones: [] };
  }

  const currentDays = Math.max(1, calculateDaysCount(anniversaryDating, baseDateStr));
  const milestones = [];

  // 1. 日数キリ番の探索（直近の3つ）
  const futureDayTargets = MILESTONE_DAY_CANDIDATES.filter(target => target >= currentDays);
  futureDayTargets.slice(0, 3).forEach(targetDay => {
    const daysToAdd = targetDay - 1;
    const targetDateStr = addDaysToDate(anniversaryDating, daysToAdd);
    const daysUntil = calculateDaysUntil(targetDateStr, baseDateStr);

    if (daysUntil >= 0) {
      milestones.push({
        type: 'days',
        title: `交際 ${targetDay}日記念`,
        badge: `Day ${targetDay}`,
        targetDate: targetDateStr,
        formattedDate: formatDate(targetDateStr),
        daysUntil,
        icon: targetDay === 777 ? '✨' : '🌱'
      });
    }
  });

  // 2. 交際周年記念日
  const nextDatingAnniv = getNextAnnualAnniversary(anniversaryDating, baseDateStr);
  if (nextDatingAnniv && nextDatingAnniv.daysUntil >= 0) {
    milestones.push({
      type: 'anniversary_dating',
      title: `交際 ${nextDatingAnniv.years}周年記念`,
      badge: `${nextDatingAnniv.years}周年`,
      targetDate: nextDatingAnniv.date,
      formattedDate: formatDate(nextDatingAnniv.date),
      daysUntil: nextDatingAnniv.daysUntil,
      icon: '🌿'
    });
  }

  // 3. 結婚周年記念日（設定されている場合）
  if (anniversaryMarriage) {
    const nextMarriageAnniv = getNextAnnualAnniversary(anniversaryMarriage, baseDateStr);
    if (nextMarriageAnniv && nextMarriageAnniv.daysUntil >= 0) {
      milestones.push({
        type: 'anniversary_marriage',
        title: `結婚 ${nextMarriageAnniv.years}周年記念`,
        badge: `結婚${nextMarriageAnniv.years}周年`,
        targetDate: nextMarriageAnniv.date,
        formattedDate: formatDate(nextMarriageAnniv.date),
        daysUntil: nextMarriageAnniv.daysUntil,
        icon: '✨'
      });
    }
  }

  // 残り日数が近い順（昇順）にソート
  milestones.sort((a, b) => {
    if (a.daysUntil === b.daysUntil) {
      return a.title.localeCompare(b.title);
    }
    return a.daysUntil - b.daysUntil;
  });

  const nextMilestone = milestones.length > 0 ? milestones[0] : null;
  const upcomingMilestones = milestones.slice(0, 4);

  return {
    currentDays,
    nextMilestone,
    upcomingMilestones
  };
}

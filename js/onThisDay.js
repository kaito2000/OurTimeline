// On This Day - 「○年前の今日」過去の思い出抽出モジュール（同月同日のみ判定）
import { formatDate } from './timelineRenderer.js';

/**
 * 過去のイベントから「○年前の今日」の思い出を抽出（今日の日付のみ完全一致で判定）
 * @param {Array} events - イベントリスト
 * @param {Date} [referenceDate=new Date()] - 基準日（テスト時は任意日付を指定可）
 * @returns {Object|null} - { event, diffYears, type: 'exact', message, formattedDate }
 */
export function getOnThisDayHighlight(events, referenceDate = new Date()) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();

  // 過去年（今年より前）のイベントのみを対象にする
  const pastYearEvents = events.filter((e) => {
    if (!e.event_date) return false;
    const [y] = e.event_date.split('-').map(Number);
    return y < currentYear;
  });

  if (pastYearEvents.length === 0) {
    return null;
  }

  // 1. 同月同日（完全一致: ○年前の今日）のみを抽出
  const exactMatches = pastYearEvents.filter((e) => {
    const [, m, d] = e.event_date.split('-').map(Number);
    return m === currentMonth && d === currentDay;
  });

  if (exactMatches.length > 0) {
    // 複数の場合は直近の年（diffYearsが小さいもの）または写真付きを優先
    const best = pickBestEvent(exactMatches, currentYear);
    const eventYear = Number(best.event_date.split('-')[0]);
    const diffYears = currentYear - eventYear;

    return {
      event: best,
      diffYears,
      type: 'exact',
      message: `${diffYears}年前の今日の思い出`,
      formattedDate: formatDate(best.event_date)
    };
  }

  // 今日の日付に合致する過去の思い出がなければカードは非表示
  return null;
}

/**
 * 複数マッチ時の優先順位決定（写真があるもの、または直近の年を優先）
 */
function pickBestEvent(matchedEvents, currentYear) {
  return [...matchedEvents].sort((a, b) => {
    // 写真がある方を優先
    const aHasPhoto = Boolean(a.photo_url);
    const bHasPhoto = Boolean(b.photo_url);
    if (aHasPhoto !== bHasPhoto) {
      return aHasPhoto ? -1 : 1;
    }
    // より直近の過去を優先（新しい方）
    return b.event_date.localeCompare(a.event_date);
  })[0];
}

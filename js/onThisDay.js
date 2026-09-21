// On This Day - 「○年前の今日」過去の思い出抽出モジュール
import { formatDate } from './timelineRenderer.js';

/**
 * 過去のイベントから「○年前の今日」「○年前の今週/今月」の思い出を抽出
 * @param {Array} events - イベントリスト
 * @param {Date} [referenceDate=new Date()] - 基準日（テスト時は任意日付を指定可）
 * @returns {Object|null} - { event, diffYears, type: 'exact'|'nearby'|'month', message, formattedDate }
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

  // 1. 同月同日（完全一致: ○年前の今日）
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

  // 2. 同月かつ前後3日以内（○年前のこの頃）
  const nearbyMatches = pastYearEvents.filter((e) => {
    const [, m, d] = e.event_date.split('-').map(Number);
    return m === currentMonth && Math.abs(d - currentDay) <= 3;
  });

  if (nearbyMatches.length > 0) {
    const best = pickBestEvent(nearbyMatches, currentYear);
    const eventYear = Number(best.event_date.split('-')[0]);
    const diffYears = currentYear - eventYear;

    return {
      event: best,
      diffYears,
      type: 'nearby',
      message: `${diffYears}年前のこの頃の思い出`,
      formattedDate: formatDate(best.event_date)
    };
  }

  // 3. 同月の思い出（○年前の○月）
  const monthMatches = pastYearEvents.filter((e) => {
    const [, m] = e.event_date.split('-').map(Number);
    return m === currentMonth;
  });

  if (monthMatches.length > 0) {
    const best = pickBestEvent(monthMatches, currentYear);
    const eventYear = Number(best.event_date.split('-')[0]);
    const diffYears = currentYear - eventYear;

    return {
      event: best,
      diffYears,
      type: 'month',
      message: `${diffYears}年前の${currentMonth}月の思い出`,
      formattedDate: formatDate(best.event_date)
    };
  }

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

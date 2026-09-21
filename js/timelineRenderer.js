// Timeline Renderer - DOM生成 & タイムライン描画モジュール (Natural Green Edition)
import { CONFIG } from './config.js';

/**
 * 2つの日付間の経過日数を計算
 * @param {string} fromDateString - 開始日 (YYYY-MM-DD)
 * @param {string} toDateString - 対象日 (YYYY-MM-DD, 指定なければ今日)
 * @returns {number}
 */
export function calculateDaysCount(fromDateString, toDateString) {
  if (!fromDateString) return 0;
  const from = new Date(fromDateString + 'T00:00:00');
  const to = toDateString ? new Date(toDateString + 'T00:00:00') : new Date();
  
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const diffTime = to.getTime() - from.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 対象日までの残り日数を計算 (今日なら0、明日なら1、過去なら負数)
 * @param {string} targetDateString - YYYY-MM-DD
 * @param {string} [fromDateString] - YYYY-MM-DD (省略時は今日)
 * @returns {number}
 */
export function calculateDaysUntil(targetDateString, fromDateString) {
  if (!targetDateString) return 0;
  const target = new Date(targetDateString + 'T00:00:00');
  const from = fromDateString ? new Date(fromDateString + 'T00:00:00') : new Date();

  target.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - from.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 日付文字列のフォーマット (例: 2025年5月12日 (月))
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${year}年${month}月${day}日 (${weekday})`;
}

/**
 * イベント配列を降順（未来 ➔ 過去）でソート
 */
export function sortEventsDescending(events) {
  return [...events].sort((a, b) => {
    if (a.event_date === b.event_date) {
      return (b.created_at || '').localeCompare(a.created_at || '');
    }
    return b.event_date.localeCompare(a.event_date);
  });
}

/**
 * イベントをグループ化し、TODAYマーカーと年セパレーターを挿入したタイムライン要素を生成
 * @param {HTMLElement} container
 * @param {Array} events
 * @param {Object} options - { onToggleComplete, onEdit, onDelete, onPhotoClick }
 */
export function renderTimeline(container, events, options = {}) {
  if (!container) return;
  container.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const sorted = sortEventsDescending(events);

  let todayMarkerInserted = false;
  let currentYear = null;

  sorted.forEach((event) => {
    const eventYear = event.event_date.split('-')[0];
    const isFuture = event.event_date > todayStr;

    // 1. TODAY マーカーの挿入チェック
    if (!todayMarkerInserted && !isFuture) {
      container.appendChild(createTodayMarkerElement(todayStr));
      todayMarkerInserted = true;
    }

    // 2. 年セパレーターの挿入チェック
    if (currentYear !== eventYear) {
      currentYear = eventYear;
      container.appendChild(createYearSeparatorElement(currentYear));
    }

    // 3. イベントカードの作成
    const card = createEventCardElement(event, isFuture, options);
    container.appendChild(card);
  });

  // 全てのイベントが未来だった場合、末尾にTODAYマーカーを配置
  if (!todayMarkerInserted) {
    container.appendChild(createTodayMarkerElement(todayStr));
  }

  // イベントが0件の場合
  if (sorted.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'text-center py-16 px-4';
    emptyNotice.innerHTML = `
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 mb-4 shadow-sm border border-emerald-100">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      </div>
      <h3 class="text-base font-bold text-slate-800">まだ思い出や約束がありません</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
        画面下の「＋」ボタンから、ふたりで歩んできた大切な思い出や、これから叶えたい約束を記録してみましょう。
      </p>
    `;
    container.appendChild(emptyNotice);
  }
}

/**
 * TODAYマーカーDOMの生成（自然なフォレストグリーンスタイル）
 */
function createTodayMarkerElement(todayStr) {
  const marker = document.createElement('div');
  marker.className = 'today-marker-container flex items-center justify-center my-8 relative';
  marker.innerHTML = `
    <div class="absolute inset-0 flex items-center" aria-hidden="true">
      <div class="w-full border-t border-emerald-300/70 border-dashed"></div>
    </div>
    <div class="relative flex items-center gap-2 px-4 py-1.5 today-glow-badge text-white text-[11px] font-black rounded-full shadow-lg tracking-wider uppercase">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
      </span>
      <span>TODAY</span>
      <span class="opacity-75 font-normal">|</span>
      <span class="font-semibold">${formatDate(todayStr)}</span>
    </div>
  `;
  return marker;
}

/**
 * 年セパレーターDOMの生成（フロストガラスピル）
 */
function createYearSeparatorElement(year) {
  const separator = document.createElement('div');
  separator.className = 'relative flex items-center my-6 ml-5 sm:ml-7';
  separator.innerHTML = `
    <div class="z-10 px-3.5 py-1 bg-white/95 backdrop-blur-md text-slate-700 border border-emerald-100 rounded-full text-[11px] font-extrabold tracking-widest shadow-sm font-display">
      ${year}
    </div>
    <div class="flex-grow border-t border-emerald-100 ml-3"></div>
  `;
  return separator;
}

/**
 * 個別イベントカードDOMの生成（ナチュラルデザイン）
 */
function createEventCardElement(event, isFuture, options) {
  const cardWrapper = document.createElement('div');
  cardWrapper.className = 'relative pl-11 sm:pl-16 pr-1 mb-5 group';
  cardWrapper.dataset.id = event.id;

  const categoryMeta = CONFIG.CATEGORIES[event.category] || CONFIG.CATEGORIES.life;
  const isHighlight = Boolean(event.is_highlight);

  const dotClass = isFuture ? 'timeline-dot-ring timeline-dot-future' : 'timeline-dot-ring';
  const cardClass = (isFuture ? 'modern-card future-event-card' : 'modern-card past-event-card') + (isHighlight ? ' milestone-premium-card' : '');

  const todayStr = new Date().toISOString().split('T')[0];
  const daysUntil = calculateDaysUntil(event.event_date, todayStr);

  let countdownBadgeHtml = '';
  if (isFuture) {
    if (daysUntil === 0) {
      countdownBadgeHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-300 rounded-full text-[10px] font-black tracking-wide shadow-sm">
          🌱 本日！
        </span>
      `;
    } else if (daysUntil > 0) {
      countdownBadgeHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-[10px] font-black tracking-wide shadow-sm">
          🌱 あと <span class="text-xs font-black text-teal-700 font-display">${daysUntil}</span> 日
        </span>
      `;
    }
  }

  // リアクションバーの生成
  const reactions = event.reactions || {};
  const userReactions = options.getUserReactions ? options.getUserReactions(event.id) : [];

  let reactionsHtml = `
    <div class="reactions-bar flex items-center gap-1.5 flex-wrap mt-3 pt-2.5 border-t border-slate-100/80">
  `;

  CONFIG.REACTIONS.forEach(r => {
    const count = Number(reactions[r.emoji]) || 0;
    const isReacted = userReactions.includes(r.emoji);
    const hasCount = count > 0;

    const baseClass = "reaction-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 active:scale-90 select-none cursor-pointer";
    const styleClass = isReacted
      ? "bg-emerald-100 text-emerald-900 border border-emerald-300/90 shadow-sm"
      : hasCount
        ? "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80"
        : "bg-transparent hover:bg-slate-100/70 text-slate-400 opacity-60 hover:opacity-100 border border-transparent";

    reactionsHtml += `
      <button
        type="button"
        class="${baseClass} ${styleClass}"
        data-emoji="${r.emoji}"
        title="${r.label}"
      >
        <span class="text-sm leading-none">${r.emoji}</span>
        ${hasCount ? `<span class="text-[11px] font-bold leading-none">${count}</span>` : ''}
      </button>
    `;
  });

  reactionsHtml += `</div>`;

  cardWrapper.innerHTML = `
    <!-- タイムライン結合ドット -->
    <div class="${dotClass} top-5"></div>

    <!-- カード本体 -->
    <div class="${cardClass} rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all">
      <!-- ヘッダー行: 日付・カテゴリ・未来バッジ・操作ボタン -->
      <div class="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-slate-400 font-display">
            ${formatDate(event.event_date)}
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-sm ${categoryMeta.color}">
            <span>${categoryMeta.icon}</span>
            <span>${categoryMeta.label}</span>
          </span>
          ${isHighlight ? `
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border border-amber-300/80 rounded-full text-[10px] font-black tracking-wide shadow-sm">
              ✨ Special
            </span>
          ` : ''}
          ${countdownBadgeHtml}
        </div>

        <!-- 編集・削除アクション -->
        <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button type="button" class="btn-edit p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="編集">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
          </button>
          <button type="button" class="btn-delete p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="削除">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- タイトル -->
      <h3 class="text-base sm:text-lg font-black text-slate-800 mb-1.5 leading-snug tracking-tight">
        ${escapeHtml(event.title)}
      </h3>

      <!-- ふたりの言葉 (Quote) -->
      ${event.quote ? `
        <div class="quote-block">
          <div class="flex items-start gap-1.5">
            <span class="quote-mark select-none">“</span>
            <p class="text-xs sm:text-sm font-semibold text-emerald-900 italic leading-relaxed pt-0.5">
              ${escapeHtml(event.quote)}
            </p>
            <span class="quote-mark select-none self-end">”</span>
          </div>
        </div>
      ` : ''}

      <!-- メモ -->
      ${event.memo ? `
        <p class="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed mb-3">
          ${escapeHtml(event.memo)}
        </p>
      ` : ''}

      <!-- 写真 (ある場合) -->
      ${event.photo_url ? `
        <div class="mt-2.5 mb-2 overflow-hidden rounded-2xl bg-slate-100 border border-emerald-100/70 shadow-sm relative group/photo">
          <img
            src="${event.photo_url}"
            alt="${escapeHtml(event.title)}"
            loading="lazy"
            class="w-full max-h-72 object-cover cursor-pointer transition-transform duration-500 group-hover/photo:scale-105 event-photo"
          />
          <div class="absolute inset-0 bg-black/0 group-hover/photo:bg-black/10 transition-colors pointer-events-none flex items-center justify-center">
            <span class="opacity-0 group-hover/photo:opacity-100 transition-opacity bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              タップして拡大
            </span>
          </div>
        </div>
      ` : ''}

      <!-- ボタニカル・リアクションバー -->
      ${reactionsHtml}
    </div>
  `;

  const btnEdit = cardWrapper.querySelector('.btn-edit');
  if (btnEdit && options.onEdit) {
    btnEdit.addEventListener('click', () => options.onEdit(event));
  }

  const btnDelete = cardWrapper.querySelector('.btn-delete');
  if (btnDelete && options.onDelete) {
    btnDelete.addEventListener('click', () => options.onDelete(event));
  }

  const photoImg = cardWrapper.querySelector('.event-photo');
  if (photoImg && options.onPhotoClick) {
    photoImg.addEventListener('click', () => options.onPhotoClick(event.photo_url, event.title));
  }

  const reactionButtons = cardWrapper.querySelectorAll('.reaction-pill');
  reactionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      if (options.onReactionClick && emoji) {
        options.onReactionClick(event.id, emoji);
      }
    });
  });

  return cardWrapper;
}

/**
 * 「○年前の今日」ハイライトカードのレンダリング
 * @param {HTMLElement} container
 * @param {Object|null} highlight
 * @param {Object} [options={}] - { onCardClick, onClose }
 */
export function renderOnThisDayCard(container, highlight, options = {}) {
  if (!container) return;
  container.innerHTML = '';

  if (!highlight || !highlight.event) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  const event = highlight.event;
  const card = document.createElement('div');
  card.className = 'on-this-day-card relative p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-50/95 via-teal-50/90 to-emerald-50/95 border border-emerald-200/90 shadow-sm backdrop-blur-md mb-6 overflow-hidden transition-all hover:shadow-md cursor-pointer group';

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-2xl bg-white/90 text-emerald-700 shadow-sm border border-emerald-100 text-sm flex-shrink-0">
          🌿
        </span>
        <div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-black text-emerald-800 tracking-tight font-display">
              ${escapeHtml(highlight.message)}
            </span>
            <span class="text-[10px] text-emerald-600/90 font-medium">
              ${escapeHtml(highlight.formattedDate)}
            </span>
          </div>
          <h4 class="text-sm sm:text-base font-black text-slate-800 tracking-tight mt-0.5 group-hover:text-emerald-900 transition-colors">
            ${escapeHtml(event.title)}
          </h4>
        </div>
      </div>
      <button type="button" class="btn-close-onthisday p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors" title="閉じる">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>

    ${event.memo ? `
      <p class="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed pl-10">
        ${escapeHtml(event.memo)}
      </p>
    ` : ''}

    ${event.photo_url ? `
      <div class="mt-2.5 pl-10 flex items-center gap-2">
        <div class="w-12 h-12 rounded-xl overflow-hidden border border-emerald-100/90 shadow-sm flex-shrink-0">
          <img src="${event.photo_url}" alt="${escapeHtml(event.title)}" class="w-full h-full object-cover" />
        </div>
        <span class="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 group-hover:underline">
          タイムラインで思い出を見る ➔
        </span>
      </div>
    ` : `
      <div class="mt-1.5 pl-10">
        <span class="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 group-hover:underline">
          タイムラインで思い出を見る ➔
        </span>
      </div>
    `}
  `;

  const btnClose = card.querySelector('.btn-close-onthisday');
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.add('hidden');
      if (options.onClose) options.onClose();
    });
  }

  card.addEventListener('click', () => {
    if (options.onCardClick) {
      options.onCardClick(event.id);
    }
  });

  container.appendChild(card);
}

/**
 * 直近の未来の約束のカウントダウンピルのレンダリング
 * @param {HTMLElement} container
 * @param {Array} events
 * @param {Function} [onPillClick]
 */
export function renderUpcomingCountdown(container, events, onPillClick) {
  if (!container) return;
  container.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = events
    .filter(e => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  if (upcomingEvents.length === 0) {
    container.classList.add('hidden');
    return;
  }

  const nextEvent = upcomingEvents[0];
  const daysUntil = calculateDaysUntil(nextEvent.event_date, todayStr);

  container.classList.remove('hidden');

  const pill = document.createElement('div');
  pill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-teal-200/90 shadow-sm text-xs font-bold text-teal-900 cursor-pointer hover:bg-teal-50/80 transition-all active:scale-95 group max-w-full';

  let countText = '';
  if (daysUntil === 0) {
    countText = '<span class="text-teal-600 animate-pulse font-black">今日！</span>';
  } else {
    countText = `あと <span class="text-teal-700 font-display font-black text-sm">${daysUntil}</span> 日`;
  }

  pill.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse flex-shrink-0"></span>
    <span class="text-slate-500 font-normal">次の予定:</span>
    <span class="truncate max-w-[140px] sm:max-w-[200px] text-slate-800 font-extrabold">${escapeHtml(nextEvent.title)}</span>
    <span class="text-teal-800 flex-shrink-0">${countText}</span>
    <span class="text-slate-400 group-hover:text-teal-600 transition-colors">➔</span>
  `;

  pill.addEventListener('click', () => {
    if (onPillClick) onPillClick(nextEvent.id);
  });

  container.appendChild(pill);
}

/**
 * XSS保護用HTMLエスケープ
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

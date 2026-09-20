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
  const isCompleted = event.is_completed !== false;

  const dotClass = isFuture && !isCompleted ? 'timeline-dot-ring timeline-dot-future' : 'timeline-dot-ring';
  const cardClass = isFuture && !isCompleted ? 'modern-card future-event-card' : 'modern-card past-event-card';

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
          ${isFuture && !isCompleted ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200/80 rounded-full text-[10px] font-black tracking-wide">
              <span class="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              未来の約束
            </span>
          ` : ''}
          ${isFuture && isCompleted ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
              ✓ 約束達成
            </span>
          ` : ''}
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

      <!-- 未来イベント用の達成アクションボタン -->
      ${isFuture ? `
        <div class="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between gap-2">
          <span class="text-[11px] text-emerald-800 font-medium">
            ${isCompleted ? '🎉 約束が叶いました！' : '🌱 ふたりで叶えたい未来の予定'}
          </span>
          <button type="button" class="btn-toggle-complete inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 ${
            isCompleted 
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
              : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:from-emerald-700 hover:to-teal-800 shadow-emerald-200'
          }">
            ${isCompleted ? '未達成に戻す' : '✨ 達成した！'}
          </button>
        </div>
      ` : ''}
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

  const btnToggle = cardWrapper.querySelector('.btn-toggle-complete');
  if (btnToggle && options.onToggleComplete) {
    btnToggle.addEventListener('click', () => options.onToggleComplete(event.id));
  }

  const photoImg = cardWrapper.querySelector('.event-photo');
  if (photoImg && options.onPhotoClick) {
    photoImg.addEventListener('click', () => options.onPhotoClick(event.photo_url, event.title));
  }

  return cardWrapper;
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

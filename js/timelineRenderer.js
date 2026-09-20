// Timeline Renderer - DOM生成 & タイムライン描画モジュール
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
  
  // 日付の正規化（時刻ゼロリセット）
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const diffTime = to.getTime() - from.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 1日目をDay 1とする
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

  // 全体が過去または空でTODAYがまだ挿入されていない場合への対応フラグ
  const hasFutureEvents = sorted.some(e => e.event_date > todayStr);

  sorted.forEach((event, index) => {
    const eventYear = event.event_date.split('-')[0];
    const isFuture = event.event_date > todayStr;

    // 1. TODAY マーカーの挿入チェック（未来イベントが終わり、過去イベントが始まる境界）
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
    emptyNotice.className = 'text-center py-12 text-slate-400';
    emptyNotice.innerHTML = `
      <div class="text-4xl mb-3">📖</div>
      <p class="font-medium">まだ思い出や約束がありません</p>
      <p class="text-xs mt-1">画面下の「＋」ボタンから、ふたりの出来事を記録してみましょう</p>
    `;
    container.appendChild(emptyNotice);
  }
}

/**
 * TODAYマーカーDOMの生成
 */
function createTodayMarkerElement(todayStr) {
  const marker = document.createElement('div');
  marker.className = 'today-marker-line flex items-center justify-center my-8 relative';
  marker.innerHTML = `
    <div class="absolute inset-0 flex items-center" aria-hidden="true">
      <div class="w-full border-t-2 border-rose-400 border-dashed"></div>
    </div>
    <div class="relative flex items-center px-4 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-md today-marker-badge tracking-wider uppercase">
      <span class="w-2 h-2 rounded-full bg-white mr-2 animate-ping"></span>
      TODAY (${formatDate(todayStr)})
    </div>
  `;
  return marker;
}

/**
 * 年セパレーターDOMの生成
 */
function createYearSeparatorElement(year) {
  const separator = document.createElement('div');
  separator.className = 'relative flex items-center my-6 ml-4 sm:ml-6';
  separator.innerHTML = `
    <div class="z-10 px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-black tracking-widest shadow-sm">
      ${year} 年
    </div>
    <div class="flex-grow border-t border-slate-200 ml-3"></div>
  `;
  return separator;
}

/**
 * 個別イベントカードDOMの生成
 */
function createEventCardElement(event, isFuture, options) {
  const cardWrapper = document.createElement('div');
  cardWrapper.className = 'relative pl-10 sm:pl-14 pr-2 mb-6 group';
  cardWrapper.dataset.id = event.id;

  const categoryMeta = CONFIG.CATEGORIES[event.category] || CONFIG.CATEGORIES.life;
  const isCompleted = event.is_completed !== false;

  // ノードの色分け
  let dotBg = 'bg-rose-500';
  if (isFuture) {
    dotBg = 'bg-purple-500 ring-2 ring-purple-200';
  } else if (event.category === 'anniversary') {
    dotBg = 'bg-amber-400 ring-2 ring-amber-200';
  }

  // カードスタイル（過去: 実線 / 未来: 点線・半透明）
  const cardStyleClass = isFuture && !isCompleted ? 'future-card' : 'past-card';

  cardWrapper.innerHTML = `
    <!-- タイムライン結合ドット -->
    <div class="timeline-dot top-5 ${dotBg}"></div>

    <!-- カード本体 -->
    <div class="${cardStyleClass} rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-md">
      <!-- ヘッダー行: 日付・カテゴリバッジ・操作ボタン -->
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-xs sm:text-sm font-semibold text-slate-500">
            ${formatDate(event.event_date)}
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${categoryMeta.color}">
            <span>${categoryMeta.icon}</span>
            <span>${categoryMeta.label}</span>
          </span>
          ${isFuture && !isCompleted ? `
            <span class="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-bold tracking-wide shadow-sm animate-pulse">
              未来の約束
            </span>
          ` : ''}
          ${isFuture && isCompleted ? `
            <span class="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold">
              ✓ 約束達成
            </span>
          ` : ''}
        </div>

        <!-- 編集・削除メニュー -->
        <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button type="button" class="btn-edit p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="編集">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button type="button" class="btn-delete p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="削除">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- タイトル -->
      <h3 class="text-base sm:text-lg font-bold text-slate-800 mb-1 leading-snug">
        ${escapeHtml(event.title)}
      </h3>

      <!-- メモ -->
      ${event.memo ? `
        <p class="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed mb-3">
          ${escapeHtml(event.memo)}
        </p>
      ` : ''}

      <!-- 写真 (ある場合) -->
      ${event.photo_url ? `
        <div class="mt-2 mb-3 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
          <img
            src="${event.photo_url}"
            alt="${escapeHtml(event.title)}"
            loading="lazy"
            class="w-full max-h-72 object-cover cursor-pointer transition-transform duration-300 hover:scale-[1.02] event-photo"
          />
        </div>
      ` : ''}

      <!-- 未来イベント用の達成アクションボタン -->
      ${isFuture ? `
        <div class="mt-3 pt-3 border-t border-purple-100 flex items-center justify-between">
          <span class="text-xs text-purple-600 font-medium">
            ${isCompleted ? '🎉 この約束は達成されました！' : '📅 いつか叶えたい未来の予定'}
          </span>
          <button type="button" class="btn-toggle-complete inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-colors ${
            isCompleted 
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }">
            ${isCompleted ? '未達成に戻す' : '✨ 達成した！'}
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // イベントバインド
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

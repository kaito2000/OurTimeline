// Modal Controller - 各種ダイアログとフォーム操作
import { CONFIG } from './config.js';
import { compressImageToWebP } from './imageCompressor.js';
import { parseInviteString } from './store.js';

export class ModalController {
  constructor(store, callbacks = {}) {
    this.store = store;
    this.callbacks = callbacks; // { onSaveEvent, onDeleteEvent, onSaveSettings, onPairSync }

    this.currentEditEventId = null;
    this.selectedPhotoBlob = null;
    this.selectedPhotoDataUrl = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // イベント登録/編集モーダル
    this.eventModal = document.getElementById('event-modal');
    this.eventForm = document.getElementById('event-form');
    this.eventModalTitle = document.getElementById('event-modal-title');
    this.inputDate = document.getElementById('event-date');
    this.inputTitle = document.getElementById('event-title');
    this.selectCategory = document.getElementById('event-category');
    this.inputMemo = document.getElementById('event-memo');
    this.memoCounter = document.getElementById('memo-counter');
    this.inputFile = document.getElementById('event-photo-input');
    this.photoPreviewContainer = document.getElementById('photo-preview-container');
    this.photoPreviewImg = document.getElementById('photo-preview-img');
    this.photoCompressionInfo = document.getElementById('photo-compression-info');
    this.btnRemovePhoto = document.getElementById('btn-remove-photo');
    this.btnSaveEvent = document.getElementById('btn-save-event');

    // 写真拡大モーダル
    this.lightboxModal = document.getElementById('lightbox-modal');
    this.lightboxImg = document.getElementById('lightbox-img');
    this.lightboxCaption = document.getElementById('lightbox-caption');

    // ペアリング招待・参加モーダル
    this.shareModal = document.getElementById('share-modal');
    this.shareUrlInput = document.getElementById('share-url-input');
    this.btnCopyShare = document.getElementById('btn-copy-share');
    this.shareCopyFeedback = document.getElementById('share-copy-feedback');
    this.pairIdDisplay = document.getElementById('pair-id-display');
    this.tabBtnShare = document.getElementById('tab-btn-share');
    this.tabBtnJoin = document.getElementById('tab-btn-join');
    this.tabContentShare = document.getElementById('tab-content-share');
    this.tabContentJoin = document.getElementById('tab-content-join');
    this.inputJoinCode = document.getElementById('input-join-code');
    this.btnPasteJoin = document.getElementById('btn-paste-join');
    this.btnSubmitJoin = document.getElementById('btn-submit-join');

    // 設定モーダル
    this.settingsModal = document.getElementById('settings-modal');
    this.inputDating = document.getElementById('setting-dating');
    this.inputMarriage = document.getElementById('setting-marriage');
    this.inputSupabaseUrl = document.getElementById('setting-supabase-url');
    this.inputSupabaseKey = document.getElementById('setting-supabase-key');
    this.formSettings = document.getElementById('settings-form');

    // 通知センターモーダル
    this.notificationModal = document.getElementById('notification-modal');
    this.notificationsList = document.getElementById('notifications-list');
    this.btnClearNotifications = document.getElementById('btn-clear-notifications');
  }

  bindEvents() {
    // メモ文字数カウンター
    if (this.inputMemo && this.memoCounter) {
      this.inputMemo.addEventListener('input', () => {
        const len = this.inputMemo.value.length;
        this.memoCounter.textContent = `${len} / 200`;
        if (len > 200) {
          this.memoCounter.classList.add('text-rose-500', 'font-bold');
        } else {
          this.memoCounter.classList.remove('text-rose-500', 'font-bold');
        }
      });
    }

    // 写真選択 & クライアント自動WebP圧縮
    if (this.inputFile) {
      this.inputFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          this.photoCompressionInfo.textContent = 'WebP圧縮中...';
          this.photoCompressionInfo.classList.remove('hidden');

          const result = await compressImageToWebP(file, CONFIG.MAX_IMAGE_DIMENSION, CONFIG.IMAGE_QUALITY);
          this.selectedPhotoBlob = result.blob;
          this.selectedPhotoDataUrl = result.dataUrl;

          // プレビュー表示
          this.photoPreviewImg.src = result.dataUrl;
          this.photoPreviewContainer.classList.remove('hidden');

          const origKb = Math.round(result.originalSize / 1024);
          const compKb = Math.round(result.compressedSize / 1024);
          const ratio = Math.round((1 - result.compressedSize / result.originalSize) * 100);

          this.photoCompressionInfo.textContent = `WebP自動圧縮完了: ${origKb}KB ➔ ${compKb}KB (${ratio}%削減)`;
        } catch (err) {
          alert('画像の圧縮に失敗しました: ' + err.message);
          this.clearPhotoSelection();
        }
      });
    }

    // 写真削除ボタン
    if (this.btnRemovePhoto) {
      this.btnRemovePhoto.addEventListener('click', () => {
        this.clearPhotoSelection();
      });
    }

    // イベントフォーム送信
    if (this.eventForm) {
      this.eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveEventSubmit();
      });
    }

    // ペアリングURLコピー
    if (this.btnCopyShare && this.shareUrlInput) {
      this.btnCopyShare.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(this.shareUrlInput.value);
          this.showCopyFeedback('URLをクリップボードにコピーしました！');
        } catch (err) {
          // クリップボードAPIフォールバック
          this.shareUrlInput.select();
          document.execCommand('copy');
          this.showCopyFeedback('URLをコピーしました！');
        }
      });
    }

    // タブ切り替え
    if (this.tabBtnShare && this.tabBtnJoin) {
      this.tabBtnShare.addEventListener('click', () => {
        this.switchShareTab('share');
      });
      this.tabBtnJoin.addEventListener('click', () => {
        this.switchShareTab('join');
      });
    }

    // クリップボード貼り付け
    if (this.btnPasteJoin && this.inputJoinCode) {
      this.btnPasteJoin.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text) {
              this.inputJoinCode.value = text.trim();
            }
          } else {
            alert('お使いの環境では自動貼り付けに対応していません。入力枠内を長押しして「ペースト」してください。');
          }
        } catch (err) {
          alert('クリップボードの読み取り許可が得られませんでした。入力枠内を長押しして直接貼り付けてください。');
        }
      });
    }

    // ペアに参加して同期する
    if (this.btnSubmitJoin && this.inputJoinCode) {
      this.btnSubmitJoin.addEventListener('click', () => {
        const rawCode = this.inputJoinCode.value.trim();
        if (!rawCode) {
          alert('招待コードまたは共有URLを入力してください。');
          return;
        }

        const parsed = parseInviteString(rawCode);
        if (!parsed || !parsed.pairId) {
          alert('招待コードまたは共有URLの形式が正しくありません。\n送られてきたURLやコードをそのまま貼り付けてください。');
          return;
        }

        if (this.callbacks.onJoinPair) {
          this.callbacks.onJoinPair(parsed);
        }
        this.closeModal(this.shareModal);
        this.inputJoinCode.value = '';
      });
    }

    // 設定フォーム送信
    if (this.formSettings) {
      this.formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        const dating = this.inputDating.value;
        const marriage = this.inputMarriage.value;
        const url = this.inputSupabaseUrl.value.trim();
        const key = this.inputSupabaseKey.value.trim();

        if (this.callbacks.onSaveSettings) {
          this.callbacks.onSaveSettings({ dating, marriage, url, key });
        }
        this.closeModal(this.settingsModal);
      });
    }

    // 通知すべて消去
    if (this.btnClearNotifications) {
      this.btnClearNotifications.addEventListener('click', () => {
        if (confirm('通知をすべて消去しますか？')) {
          this.store.clearAllNotifications();
          this.renderNotifications();
        }
      });
    }

    // モーダル外側クリックで閉じる
    [this.eventModal, this.lightboxModal, this.shareModal, this.settingsModal, this.notificationModal].forEach(modal => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // 閉じるボタン共通
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close-modal');
        const modal = document.getElementById(targetId);
        if (modal) this.closeModal(modal);
      });
    });
  }

  clearPhotoSelection() {
    this.selectedPhotoBlob = null;
    this.selectedPhotoDataUrl = null;
    if (this.inputFile) this.inputFile.value = '';
    if (this.photoPreviewContainer) this.photoPreviewContainer.classList.add('hidden');
    if (this.photoCompressionInfo) this.photoCompressionInfo.classList.add('hidden');
    if (this.photoPreviewImg) this.photoPreviewImg.src = '';
  }

  openCreateEventModal() {
    this.currentEditEventId = null;
    this.clearPhotoSelection();
    this.eventModalTitle.textContent = 'ふたりの出来事を記録';
    this.inputDate.value = new Date().toISOString().split('T')[0];
    this.inputTitle.value = '';
    this.selectCategory.value = 'life';
    this.inputMemo.value = '';
    this.memoCounter.textContent = '0 / 200';
    this.openModal(this.eventModal);
  }

  openEditEventModal(event) {
    this.currentEditEventId = event.id;
    this.clearPhotoSelection();
    this.eventModalTitle.textContent = '出来事を編集';
    this.inputDate.value = event.event_date;
    this.inputTitle.value = event.title;
    this.selectCategory.value = event.category || 'life';
    this.inputMemo.value = event.memo || '';
    this.memoCounter.textContent = `${(event.memo || '').length} / 200`;

    if (event.photo_url) {
      this.photoPreviewImg.src = event.photo_url;
      this.photoPreviewContainer.classList.remove('hidden');
      this.photoCompressionInfo.textContent = '登録済みの写真が設定されています';
      this.photoCompressionInfo.classList.remove('hidden');
    }

    this.openModal(this.eventModal);
  }

  async handleSaveEventSubmit() {
    const title = this.inputTitle.value.trim();
    const date = this.inputDate.value;
    const category = this.selectCategory.value;
    const memo = this.inputMemo.value.trim();

    if (!title || !date) {
      alert('日付とタイトルを入力してください。');
      return;
    }

    if (memo.length > 200) {
      alert('一言メモは200文字以内で入力してください。');
      return;
    }

    this.btnSaveEvent.disabled = true;
    this.btnSaveEvent.textContent = '保存中...';

    try {
      const eventData = {
        id: this.currentEditEventId,
        event_date: date,
        title,
        category,
        memo,
        is_completed: category !== 'future'
      };

      if (this.callbacks.onSaveEvent) {
        await this.callbacks.onSaveEvent(eventData, this.selectedPhotoBlob, this.selectedPhotoDataUrl);
      }
      this.closeModal(this.eventModal);
    } catch (err) {
      alert('保存中にエラーが発生しました: ' + err.message);
    } finally {
      this.btnSaveEvent.disabled = false;
      this.btnSaveEvent.textContent = 'タイムラインに追加';
    }
  }

  openLightbox(photoUrl, caption) {
    if (!photoUrl) return;
    this.lightboxImg.src = photoUrl;
    this.lightboxCaption.textContent = caption || '';
    this.openModal(this.lightboxModal);
  }

  openShareModal() {
    const { pairId, secretKey, supabaseUrl, supabaseAnonKey } = this.store.state;

    // 招待URLを組み立て（Supabase接続情報も自動同封しパートナー側の設定入力を不要化）
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('pair', pairId);
    params.set('key', secretKey);
    if (supabaseUrl) params.set('su', supabaseUrl);
    if (supabaseAnonKey) params.set('sk', supabaseAnonKey);

    const shareUrl = `${baseUrl}?${params.toString()}`;

    this.shareUrlInput.value = shareUrl;
    if (this.pairIdDisplay) {
      this.pairIdDisplay.textContent = pairId;
    }

    const indicator = document.getElementById('share-sync-status-indicator');
    if (indicator) {
      if (supabaseUrl && supabaseAnonKey) {
        indicator.className = 'p-3 rounded-2xl text-xs flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200';
        indicator.innerHTML = `
          <span class="text-base">✅</span>
          <div>
            <p class="font-bold">Supabase自動接続設定が同封されています</p>
            <p class="text-[11px] text-emerald-700/80">パートナーがURLを開くだけで、リアルタイム同期が開始されます。</p>
          </div>
        `;
      } else {
        indicator.className = 'p-3 rounded-2xl text-xs flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200';
        indicator.innerHTML = `
          <span class="text-base">⚠️</span>
          <div>
            <p class="font-bold">Supabase接続設定がまだ完了していません</p>
            <p class="text-[11px] text-amber-800/80">このまま共有すると端末内のみの動作になります。ふたりで同期するには先に「⚙️ 設定」からURLとAPIキーを保存してください。</p>
          </div>
        `;
      }
    }

    this.switchShareTab('share');
    this.openModal(this.shareModal);
  }

  switchShareTab(tab) {
    if (!this.tabBtnShare || !this.tabBtnJoin || !this.tabContentShare || !this.tabContentJoin) return;
    if (tab === 'share') {
      this.tabBtnShare.className = 'flex-1 pb-2.5 text-xs sm:text-sm font-bold border-b-2 border-emerald-600 text-emerald-800 transition-colors';
      this.tabBtnJoin.className = 'flex-1 pb-2.5 text-xs sm:text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-colors';
      this.tabContentShare.classList.remove('hidden');
      this.tabContentJoin.classList.add('hidden');
    } else {
      this.tabBtnShare.className = 'flex-1 pb-2.5 text-xs sm:text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-colors';
      this.tabBtnJoin.className = 'flex-1 pb-2.5 text-xs sm:text-sm font-bold border-b-2 border-emerald-600 text-emerald-800 transition-colors';
      this.tabContentShare.classList.add('hidden');
      this.tabContentJoin.classList.remove('hidden');
      if (this.inputJoinCode) {
        setTimeout(() => this.inputJoinCode.focus(), 100);
      }
    }
  }

  openSettingsModal() {
    this.inputDating.value = this.store.state.anniversaryDating || '';
    this.inputMarriage.value = this.store.state.anniversaryMarriage || '';
    this.inputSupabaseUrl.value = this.store.state.supabaseUrl || '';
    this.inputSupabaseKey.value = this.store.state.supabaseAnonKey || '';
    this.openModal(this.settingsModal);
  }

  showCopyFeedback(msg) {
    if (!this.shareCopyFeedback) return;
    this.shareCopyFeedback.textContent = msg;
    this.shareCopyFeedback.classList.remove('hidden');
    setTimeout(() => {
      this.shareCopyFeedback.classList.add('hidden');
    }, 3000);
  }

  openNotificationsModal() {
    this.renderNotifications();
    this.openModal(this.notificationModal);
    this.store.markAllNotificationsAsRead();
    if (this.callbacks.onNotificationsOpened) {
      this.callbacks.onNotificationsOpened();
    }
  }

  renderNotifications() {
    if (!this.notificationsList) return;
    this.notificationsList.innerHTML = '';

    const notifications = this.store.state.notifications || [];

    if (notifications.length === 0) {
      this.notificationsList.innerHTML = `
        <div class="text-center py-12 px-4 space-y-2">
          <span class="text-3xl block">🌿</span>
          <p class="text-xs font-bold text-slate-700">新しいお知らせはありません</p>
          <p class="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            パートナーからのリアクションや新しい思い出が届くと、ここに新着通知として届きます。
          </p>
        </div>
      `;
      return;
    }

    notifications.forEach(notif => {
      const item = document.createElement('div');
      const isUnread = !notif.isRead;
      const borderClass = isUnread ? 'notification-unread border' : 'notification-read border';

      item.className = `notification-item p-3.5 rounded-2xl ${borderClass} flex items-start gap-3 cursor-pointer hover:shadow-sm`;

      item.innerHTML = `
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white text-base shadow-sm border border-emerald-100 flex-shrink-0">
          ${escapeModalHtml(notif.icon || '🌿')}
        </span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <h4 class="text-xs font-bold text-slate-800 tracking-tight truncate">
              ${escapeModalHtml(notif.title)}
            </h4>
            <span class="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
              ${formatTimeAgo(notif.timestamp)}
            </span>
          </div>
          ${notif.body ? `
            <p class="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
              ${escapeModalHtml(notif.body)}
            </p>
          ` : ''}
        </div>
        ${isUnread ? `
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 self-center flex-shrink-0"></span>
        ` : ''}
      `;

      item.addEventListener('click', () => {
        this.closeModal(this.notificationModal);
        if (notif.targetEventId && this.callbacks.onSelectEvent) {
          this.callbacks.onSelectEvent(notif.targetEventId);
        }
      });

      this.notificationsList.appendChild(item);
    });
  }

  openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  }

  closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  }
}

/**
 * 経過時間のフォーマット（たった今、○分前、○時間前、昨日、○日前）
 */
function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'たった今';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  if (diffSec < 172800) return '昨日';
  return `${Math.floor(diffSec / 86400)}日前`;
}

function escapeModalHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

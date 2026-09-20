// Modal Controller - 各種ダイアログとフォーム操作
import { CONFIG } from './config.js';
import { compressImageToWebP } from './imageCompressor.js';

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

    // ペアリング招待モーダル
    this.shareModal = document.getElementById('share-modal');
    this.shareUrlInput = document.getElementById('share-url-input');
    this.btnCopyShare = document.getElementById('btn-copy-share');
    this.shareCopyFeedback = document.getElementById('share-copy-feedback');
    this.pairIdDisplay = document.getElementById('pair-id-display');

    // 設定モーダル
    this.settingsModal = document.getElementById('settings-modal');
    this.inputDating = document.getElementById('setting-dating');
    this.inputMarriage = document.getElementById('setting-marriage');
    this.inputSupabaseUrl = document.getElementById('setting-supabase-url');
    this.inputSupabaseKey = document.getElementById('setting-supabase-key');
    this.formSettings = document.getElementById('settings-form');
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

    // モーダル外側クリックで閉じる
    [this.eventModal, this.lightboxModal, this.shareModal, this.settingsModal].forEach(modal => {
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
    const pairId = this.store.state.pairId;
    const secretKey = this.store.state.secretKey;

    // 招待URLを組み立て
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?pair=${encodeURIComponent(pairId)}&key=${encodeURIComponent(secretKey)}`;

    this.shareUrlInput.value = shareUrl;
    if (this.pairIdDisplay) {
      this.pairIdDisplay.textContent = pairId;
    }
    this.openModal(this.shareModal);
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

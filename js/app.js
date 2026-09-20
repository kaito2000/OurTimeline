// OurTimeline - メインオーケストレーションモジュール
import { store } from './store.js';
import { CONFIG } from './config.js';
import { generateUUID } from './crypto.js';
import {
  getSupabaseClient,
  ensurePairExists,
  fetchRemoteTimeline,
  insertTimelineEvent,
  updateRemoteEvent,
  deleteRemoteEvent,
  uploadPhotoToStorage,
  subscribeToRealtime
} from './supabaseClient.js';
import { renderTimeline, calculateDaysCount } from './timelineRenderer.js';
import { ModalController } from './modalController.js';

class App {
  constructor() {
    this.supabase = null;
    this.modalController = null;
    this.timelineContainer = document.getElementById('timeline-container');
    this.daysCounterEl = document.getElementById('days-counter');
    this.anniversaryLabelEl = document.getElementById('anniversary-label');
    this.syncStatusEl = document.getElementById('sync-status');
  }

  async start() {
    console.log('Starting OurTimeline App...');

    // 1. URLパラメータの取得 & サニタイズ（キー覗き見防止）
    const searchParams = window.location.search;
    store.init(searchParams);

    // アドレスバーから ?pair=...&key=... を除去して履歴保護（すでにlocalStorageに保持済み）
    if (searchParams && window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. モーダルコントローラーの初期化
    this.modalController = new ModalController(store, {
      onSaveEvent: (eventData, photoBlob, photoDataUrl) => this.handleSaveEvent(eventData, photoBlob, photoDataUrl),
      onDeleteEvent: (event) => this.handleDeleteEvent(event),
      onSaveSettings: (settings) => this.handleSaveSettings(settings)
    });

    // 3. UIイベントのバインド
    this.bindGlobalUiEvents();

    // 4. ストア変更購読による再描画
    store.subscribe((state) => {
      this.renderUi(state);
    });

    // 初期描画（キャッシュ先行描画）
    this.renderUi(store.state);

    // 5. Supabase連携とRealtime同期
    await this.initSupabaseSync();

    // 6. Service Worker登録 (PWA)
    this.registerServiceWorker();

    // 7. オンライン/オフライン検知
    window.addEventListener('online', () => {
      store.setOnlineStatus(true);
      this.initSupabaseSync();
    });
    window.addEventListener('offline', () => {
      store.setOnlineStatus(false);
    });
  }

  bindGlobalUiEvents() {
    // フローティング新規作成ボタン
    const btnFabCreate = document.getElementById('btn-fab-create');
    if (btnFabCreate) {
      btnFabCreate.addEventListener('click', () => {
        this.modalController.openCreateEventModal();
      });
    }

    // パートナー招待ボタン
    const btnShare = document.getElementById('btn-share-pair');
    if (btnShare) {
      btnShare.addEventListener('click', () => {
        this.modalController.openShareModal();
      });
    }

    // 設定ボタン
    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.modalController.openSettingsModal();
      });
    }
  }

  renderUi(state) {
    // 1. 記念日カウンター描画
    if (this.daysCounterEl && state.anniversaryDating) {
      const days = calculateDaysCount(state.anniversaryDating);
      this.daysCounterEl.textContent = `Day ${days}`;
      if (this.anniversaryLabelEl) {
        this.anniversaryLabelEl.textContent = `ふたりが出会ってから ${days} 日目`;
      }
    }

    // 2. 同期ステータスバッジ
    if (this.syncStatusEl) {
      if (!state.isOnline) {
        this.syncStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> オフライン（端末に保存中）';
        this.syncStatusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600';
      } else if (state.isSyncing) {
        this.syncStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> 同期中...';
        this.syncStatusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700';
      } else if (this.supabase) {
        this.syncStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> リアルタイム同期中';
        this.syncStatusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700';
      } else {
        this.syncStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-sky-400"></span> ローカル保存中（設定からSupabase接続可能）';
        this.syncStatusEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700';
      }
    }

    // 3. タイムライン描画
    if (this.timelineContainer) {
      renderTimeline(this.timelineContainer, state.events, {
        onToggleComplete: (eventId) => this.handleToggleComplete(eventId),
        onEdit: (event) => this.modalController.openEditEventModal(event),
        onDelete: (event) => this.handleDeleteEvent(event),
        onPhotoClick: (url, caption) => this.modalController.openLightbox(url, caption)
      });
    }
  }

  async initSupabaseSync() {
    const { supabaseUrl, supabaseAnonKey, pairId, secretKey, anniversaryDating, anniversaryMarriage } = store.state;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('Supabase config not set. Running in local-first mock mode.');
      return;
    }

    store.setSyncing(true);

    try {
      this.supabase = await getSupabaseClient(supabaseUrl, supabaseAnonKey, pairId, secretKey);
      if (!this.supabase) {
        store.setSyncing(false);
        return;
      }

      // ペアの存在確認・登録
      await ensurePairExists(this.supabase, pairId, secretKey, anniversaryDating, anniversaryMarriage);

      // リモートタイムラインの差分取得
      const remoteEvents = await fetchRemoteTimeline(this.supabase, pairId);
      if (remoteEvents && remoteEvents.length > 0) {
        store.setRemoteEvents(remoteEvents);
      }

      // Realtimeの購読開始
      subscribeToRealtime(this.supabase, pairId, {
        onInsert: (newEvent) => {
          console.log('[Realtime] New event received:', newEvent);
          store.upsertEvent(newEvent);
        },
        onUpdate: (updatedEvent) => {
          console.log('[Realtime] Updated event received:', updatedEvent);
          store.upsertEvent(updatedEvent);
        },
        onDelete: (deletedEvent) => {
          console.log('[Realtime] Deleted event received:', deletedEvent);
          store.removeEvent(deletedEvent.id);
        }
      });
    } catch (err) {
      console.warn('Supabase sync error (falling back to cache):', err);
    } finally {
      store.setSyncing(false);
    }
  }

  async handleSaveEvent(eventData, photoBlob, photoDataUrl) {
    const pairId = store.state.pairId;
    let photoUrl = photoDataUrl || '';

    // 1. 写真がある場合、Supabase Storageへアップロード
    if (photoBlob && this.supabase) {
      try {
        store.setSyncing(true);
        photoUrl = await uploadPhotoToStorage(this.supabase, pairId, photoBlob);
      } catch (err) {
        console.warn('Storage upload error, using local photo preview:', err);
      } finally {
        store.setSyncing(false);
      }
    }

    const payload = {
      id: eventData.id || generateUUID(),
      pair_id: pairId,
      event_date: eventData.event_date,
      title: eventData.title,
      category: eventData.category,
      memo: eventData.memo,
      photo_url: photoUrl || (eventData.id ? (store.state.events.find(e => e.id === eventData.id)?.photo_url || '') : ''),
      is_completed: eventData.is_completed,
      created_at: new Date().toISOString()
    };

    // 2. ローカルに即座に反映（楽観的UI更新）
    store.upsertEvent(payload);

    // 3. Supabase DBへ永続化
    if (this.supabase) {
      try {
        if (eventData.id) {
          await updateRemoteEvent(this.supabase, payload.id, payload);
        } else {
          await insertTimelineEvent(this.supabase, payload);
        }
      } catch (err) {
        console.error('Remote save error:', err);
      }
    }
  }

  async handleToggleComplete(eventId) {
    const updated = store.toggleEventCompletion(eventId);
    if (updated && this.supabase) {
      try {
        await updateRemoteEvent(this.supabase, eventId, { is_completed: updated.is_completed });
      } catch (err) {
        console.error('Remote update completion error:', err);
      }
    }
  }

  async handleDeleteEvent(event) {
    if (!confirm(`「${event.title}」をタイムラインから削除してもよろしいですか？`)) {
      return;
    }

    store.removeEvent(event.id);

    if (this.supabase) {
      try {
        await deleteRemoteEvent(this.supabase, event.id);
      } catch (err) {
        console.error('Remote delete error:', err);
      }
    }
  }

  handleSaveSettings({ dating, marriage, url, key }) {
    store.setAnniversaries(dating, marriage);
    store.setSupabaseConfig(url, key);
    this.initSupabaseSync();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('ServiceWorker registration successful with scope:', reg.scope);
        }).catch((err) => {
          console.log('ServiceWorker registration failed:', err);
        });
      });
    }
  }
}

// アプリ起動
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});

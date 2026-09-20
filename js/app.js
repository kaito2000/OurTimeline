// OurTimeline - メインオーケストレーションモジュール
import { store } from './store.js';
import { CONFIG } from './config.js';
import { generateUUID } from './crypto.js';
import {
  getSupabaseClient,
  testSupabaseConnection,
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

    // 1. URLパラメータの取得 & サニタイズ
    const searchParams = window.location.search;
    const urlParams = new URLSearchParams(searchParams);
    const hasPairParam = urlParams.has('pair');
    const hasSupabaseParam = urlParams.has('su');

    store.init(searchParams);

    // アプリ内ブラウザ（LINE, Instagram等）の検出
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isInAppBrowser = /Line\/|FBAN|FBAV|Instagram/i.test(ua);

    if (isInAppBrowser) {
      // LINE等のアプリ内ブラウザでは、Safari等に引き継ぐためURLパラメータを消去せず保持
      this.showInAppBrowserBanner();
    } else {
      // 標準ブラウザではアドレスバーからキーを除去して履歴保護
      if (searchParams && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    if (hasPairParam || hasSupabaseParam) {
      console.log('招待URL経由でペアリング及びSupabase設定を初期化しました');
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

  showInAppBrowserBanner() {
    if (document.getElementById('inapp-browser-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'inapp-browser-banner';
    banner.className = 'sticky top-0 z-50 bg-amber-600 text-white px-3.5 py-2 text-xs flex items-center justify-between shadow-md';
    banner.innerHTML = `
      <div class="flex items-center gap-2 flex-1 mr-2">
        <span class="text-sm">⚠️</span>
        <span class="leading-snug">LINE等のアプリ内ブラウザです。リアルタイム同期を有効にするには、右上のメニュー「…」等から<strong>「Safari（ブラウザ）で開く」</strong>をタップしてください。</span>
      </div>
      <button type="button" class="p-1 text-white/80 hover:text-white text-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.prepend(banner);
  }

  renderUi(state) {
    // 1. 記念日カウンター描画 (Day ○○ のみシンプル表示)
    if (this.daysCounterEl && state.anniversaryDating) {
      const days = calculateDaysCount(state.anniversaryDating);
      this.daysCounterEl.textContent = `Day ${days}`;
    }

    // 2. 同期ステータスバッジ
    if (this.syncStatusEl) {
      if (!state.isOnline) {
        this.syncStatusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> オフライン';
        this.syncStatusEl.className = 'flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm';
      } else if (state.syncStatus === 'connecting' || state.isSyncing) {
        this.syncStatusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> 接続確認中...';
        this.syncStatusEl.className = 'flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm';
      } else if (state.syncStatus === 'connected') {
        this.syncStatusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> リアルタイム同期中';
        this.syncStatusEl.className = 'flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm';
      } else if (state.syncStatus === 'error') {
        this.syncStatusEl.innerHTML = '<button type="button" id="btn-status-detail" class="inline-flex items-center gap-1.5 hover:underline focus:outline-none"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> 接続エラー (タップで確認)</button>';
        this.syncStatusEl.className = 'flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm cursor-pointer';
        const btnDetail = document.getElementById('btn-status-detail');
        if (btnDetail) {
          btnDetail.onclick = (e) => {
            e.stopPropagation();
            alert(`【Supabase接続エラー】\n${state.syncErrorMessage || '接続できませんでした'}\n\n「⚙️ 設定」画面からURLやKeyを確認してください。`);
            this.modalController.openSettingsModal();
          };
        }
      } else {
        // unconfigured: Supabase未設定
        this.syncStatusEl.innerHTML = '<button type="button" id="btn-status-config" class="inline-flex items-center gap-1.5 hover:underline focus:outline-none"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Supabase未設定</button>';
        this.syncStatusEl.className = 'flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm cursor-pointer';
        const btnConfig = document.getElementById('btn-status-config');
        if (btnConfig) {
          btnConfig.onclick = (e) => {
            e.stopPropagation();
            this.modalController.openSettingsModal();
          };
        }
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
      store.setSyncStatus('unconfigured');
      return;
    }

    store.setSyncStatus('connecting');

    try {
      // 1. 疎通とテーブル存在チェック
      const testRes = await testSupabaseConnection(supabaseUrl, supabaseAnonKey, pairId, secretKey);
      if (!testRes.success) {
        console.warn('Supabase test warning:', testRes.message);
        store.setSyncStatus('error', testRes.message);
        return;
      }

      this.supabase = await getSupabaseClient(supabaseUrl, supabaseAnonKey, pairId, secretKey);
      if (!this.supabase) {
        store.setSyncStatus('error', 'Supabaseクライアントの生成に失敗しました。');
        return;
      }

      // 2. ペアの存在確認・登録 & 記念日自動同期
      const remotePair = await ensurePairExists(this.supabase, pairId, secretKey, anniversaryDating, anniversaryMarriage);
      if (remotePair && typeof remotePair === 'object' && remotePair.anniversary_dating) {
        if (remotePair.anniversary_dating !== store.state.anniversaryDating) {
          store.setAnniversaries(remotePair.anniversary_dating, remotePair.anniversary_marriage || '');
        }
      }

      // 3. リモートタイムラインの差分取得
      const remoteEvents = await fetchRemoteTimeline(this.supabase, pairId);
      if (remoteEvents && remoteEvents.length > 0) {
        store.setRemoteEvents(remoteEvents);
      }

      // 4. Realtimeの購読開始
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

      store.setSyncStatus('connected');
    } catch (err) {
      console.warn('Supabase sync error (falling back to cache):', err);
      store.setSyncStatus('error', err.message || '同期エラーが発生しました');
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

  async handleSaveSettings({ dating, marriage, url, key }) {
    store.setAnniversaries(dating, marriage);
    store.setSupabaseConfig(url, key);

    if (url && key) {
      const testRes = await testSupabaseConnection(url, key, store.state.pairId, store.state.secretKey);
      if (testRes.success) {
        alert('✅ Supabaseへの接続に成功しました！リアルタイム同期を開始します。');
      } else {
        alert(`⚠️ Supabase接続警告:\n${testRes.message}`);
      }
    }
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

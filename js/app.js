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
  subscribeToRealtime,
  broadcastTimelineChange
} from './supabaseClient.js';
import {
  renderTimeline,
  calculateDaysCount,
  renderOnThisDayCard,
  renderUpcomingCountdown
} from './timelineRenderer.js';
import { getOnThisDayHighlight } from './onThisDay.js';
import { ModalController } from './modalController.js';

class App {
  constructor() {
    this.supabase = null;
    this.modalController = null;
    this.timelineContainer = document.getElementById('timeline-container');
    this.daysCounterEl = document.getElementById('days-counter');
    this.anniversaryLabelEl = document.getElementById('anniversary-label');
    this.syncStatusEl = document.getElementById('sync-status');
    this.loadingScreenEl = document.getElementById('initial-loading-screen');
    this.timelineWrapperEl = document.getElementById('timeline-wrapper');
    this.onThisDayContainer = document.getElementById('on-this-day-container');
    this.upcomingCountdownContainer = document.getElementById('upcoming-countdown-container');
    this.isInitialLoaded = false;
    this.isDismissedOnThisDay = false;
  }

  async start() {
    console.log('Starting OurTimeline App...');

    // 1. URLパラメータの取得 & 初期化
    const searchParams = window.location.search;
    const urlParams = new URLSearchParams(searchParams);
    const hasPairParam = urlParams.has('pair');
    const hasSupabaseParam = urlParams.has('su');

    store.init(searchParams);

    // スタンドアロンPWAモード（ホーム画面から起動されたか）の判定
    const isStandalone = (typeof window !== 'undefined') && (
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );

    // アプリ内ブラウザ（LINE, Instagram等）の検出
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isInAppBrowser = /Line\/|FBAN|FBAV|Instagram/i.test(ua);

    if (isInAppBrowser) {
      // LINE等のアプリ内ブラウザでは、Safari等に引き継ぐためURLパラメータを消去せず保持
      this.showInAppBrowserBanner();
    } else if (isStandalone) {
      // ホーム画面PWAから起動された場合:
      // PWA専用localStorageに保存完了しているため、アドレス履歴サニタイズ（念のため）
      if (searchParams && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      // Safari等の標準ブラウザ内で開かれている場合:
      // アドレスバーに常にペアID・秘密鍵・Supabase情報を維持
      const { pairId, secretKey, supabaseUrl, supabaseAnonKey } = store.state;
      if (pairId && secretKey) {
        const fullParams = new URLSearchParams();
        fullParams.set('pair', pairId);
        fullParams.set('key', secretKey);
        if (supabaseUrl) fullParams.set('su', supabaseUrl);
        if (supabaseAnonKey) fullParams.set('sk', supabaseAnonKey);
        const desiredUrl = `${window.location.pathname}?${fullParams.toString()}`;
        if (window.location.search !== `?${fullParams.toString()}`) {
          window.history.replaceState({}, document.title, desiredUrl);
        }
      }
      this.updateDynamicManifest();
      this.showAddToHomeScreenHint();
    }

    if (hasPairParam || hasSupabaseParam) {
      console.log('招待URL経由でペアリング及びSupabase設定を初期化しました');
    }

    // 2. モーダルコントローラーの初期化
    this.modalController = new ModalController(store, {
      onSaveEvent: (eventData, photoBlob, photoDataUrl) => this.handleSaveEvent(eventData, photoBlob, photoDataUrl),
      onDeleteEvent: (event) => this.handleDeleteEvent(event),
      onSaveSettings: (settings) => this.handleSaveSettings(settings),
      onJoinPair: (credentials) => this.handleJoinPair(credentials)
    });

    // 3. UIイベントのバインド
    this.bindGlobalUiEvents();

    // 4. ストア変更購読による再描画
    store.subscribe((state) => {
      this.renderUi(state);
    });

    // ヘッダーやバッジの初期描画（タイムラインはローディング後に描画）
    this.renderHeaderUi(store.state);

    // 5. Supabase同期 & 初期ローディング画面の制御
    const hasSupabaseConfig = store.state.supabaseUrl && store.state.supabaseAnonKey;

    if (hasSupabaseConfig) {
      // Supabase同期完了（または失敗）までローディング画面を表示
      const safetyTimeout = setTimeout(() => {
        if (!this.isInitialLoaded) {
          console.log('Supabase sync timeout, revealing initial cache/screen...');
          store.ensureInitialSampleEvents();
          this.hideInitialLoadingScreen();
        }
      }, 4000);

      try {
        await this.initSupabaseSync();
      } finally {
        clearTimeout(safetyTimeout);
        if (store.state.events.length === 0) {
          store.ensureInitialSampleEvents();
        }
        this.hideInitialLoadingScreen();
      }
    } else {
      // Supabase未設定（ローカル専用モード）: 即座に初期画面を表示
      store.ensureInitialSampleEvents();
      this.hideInitialLoadingScreen();
    }

    // 6. Service Worker登録 (PWA)
    this.registerServiceWorker();

    // 7. オンライン/オフライン検知 & 自動同期ポーリング
    window.addEventListener('online', () => {
      store.setOnlineStatus(true);
      this.initSupabaseSync();
    });
    window.addEventListener('offline', () => {
      store.setOnlineStatus(false);
    });

    this.setupAutoSyncPolling();
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

  updateDynamicManifest() {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;
    const { pairId, secretKey, supabaseUrl, supabaseAnonKey } = store.state;
    if (!pairId) return;

    const params = new URLSearchParams();
    params.set('pair', pairId);
    if (secretKey) params.set('key', secretKey);
    if (supabaseUrl) params.set('su', supabaseUrl);
    if (supabaseAnonKey) params.set('sk', supabaseAnonKey);

    const fullStartUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    fetch('./manifest.json')
      .then((res) => res.json())
      .then((manifest) => {
        manifest.start_url = fullStartUrl;
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        manifestLink.href = URL.createObjectURL(blob);
      })
      .catch(() => {});
  }

  showAddToHomeScreenHint() {
    const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isIos || document.getElementById('pwa-install-hint')) return;

    const hint = document.createElement('div');
    hint.id = 'pwa-install-hint';
    hint.className = 'sticky top-0 z-40 bg-emerald-800 text-white px-3.5 py-2 text-xs flex items-center justify-between shadow-md';
    hint.innerHTML = `
      <div class="flex items-center gap-2 flex-1 mr-2">
        <span class="text-sm">📲</span>
        <span class="leading-snug">Safari下部の共有ボタン <svg class="inline w-3.5 h-3.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> →<strong>「ホーム画面に追加」</strong>でアプリ化できます</span>
      </div>
      <button type="button" class="p-1 text-white/80 hover:text-white text-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.prepend(hint);
  }

  hideInitialLoadingScreen() {
    if (this.isInitialLoaded) return;
    this.isInitialLoaded = true;

    if (this.loadingScreenEl) {
      this.loadingScreenEl.classList.add('hidden');
    }
    if (this.timelineWrapperEl) {
      this.timelineWrapperEl.classList.remove('hidden');
    }
    // 初期ローディング完了後の初回タイムライン描画
    this.renderUi(store.state);
  }

  renderHeaderUi(state) {
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
  }

  renderUi(state) {
    this.renderHeaderUi(state);

    if (this.isInitialLoaded) {
      // 1. 直近の約束カウントダウンピルの描画
      if (this.upcomingCountdownContainer) {
        renderUpcomingCountdown(this.upcomingCountdownContainer, state.events, (eventId) => {
          this.scrollToEvent(eventId);
        });
      }

      // 2. 「○年前の今日」振り返りカードの描画
      if (this.onThisDayContainer && !this.isDismissedOnThisDay) {
        const highlight = getOnThisDayHighlight(state.events);
        renderOnThisDayCard(this.onThisDayContainer, highlight, {
          onCardClick: (eventId) => this.scrollToEvent(eventId),
          onClose: () => {
            this.isDismissedOnThisDay = true;
          }
        });
      }

      // 3. タイムライン描画
      if (this.timelineContainer) {
        renderTimeline(this.timelineContainer, state.events, {
          getUserReactions: (eventId) => store.getUserReactions(eventId),
          onReactionClick: (eventId, emoji) => this.handleReactionClick(eventId, emoji),
          onToggleComplete: (eventId) => this.handleToggleComplete(eventId),
          onEdit: (event) => this.modalController.openEditEventModal(event),
          onDelete: (event) => this.handleDeleteEvent(event),
          onPhotoClick: (url, caption) => this.modalController.openLightbox(url, caption)
        });
      }
    }
  }

  scrollToEvent(eventId) {
    if (!this.timelineContainer || !eventId) return;
    const targetCard = this.timelineContainer.querySelector(`[data-id="${eventId}"]`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'rounded-3xl', 'transition-all');
      setTimeout(() => {
        targetCard.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2');
      }, 2000);
    }
  }

  async handleReactionClick(eventId, emoji) {
    const updated = store.toggleReaction(eventId, emoji);
    if (updated && this.supabase) {
      try {
        await updateRemoteEvent(this.supabase, eventId, { reactions: updated.reactions });
        broadcastTimelineChange('UPDATE', updated);
      } catch (err) {
        console.warn('Reaction remote sync warning:', err);
      }
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
      this.hideInitialLoadingScreen();
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

    // 3. Supabase DBへ永続化 & Realtime Broadcast送信
    if (this.supabase) {
      try {
        if (eventData.id) {
          await updateRemoteEvent(this.supabase, payload.id, payload);
          broadcastTimelineChange('UPDATE', payload);
        } else {
          await insertTimelineEvent(this.supabase, payload);
          broadcastTimelineChange('INSERT', payload);
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
        broadcastTimelineChange('UPDATE', updated);
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
        broadcastTimelineChange('DELETE', { id: event.id });
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

  async handleJoinPair({ pairId, secretKey, supabaseUrl, supabaseAnonKey }) {
    console.log('招待コードによりペアに参加中...', pairId);
    store.joinPair({ pairId, secretKey, supabaseUrl, supabaseAnonKey });

    // Supabaseへの再接続・データ取得
    await this.initSupabaseSync();

    alert('🎉 ふたりのペアに参加しました！リアルタイム同期を開始します。');
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

  setupAutoSyncPolling() {
    // 画面がアクティブになった時（スマホの画面点灯、別アプリから戻った時など）に即時同期
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.supabase) {
        this.refreshRemoteTimelineSilent();
      }
    });

    window.addEventListener('focus', () => {
      if (this.supabase) {
        this.refreshRemoteTimelineSilent();
      }
    });

    // 画面を開いている間、10秒ごとにサイレント同期（ポーリング）
    setInterval(() => {
      if (this.supabase && store.state.isOnline && document.visibilityState === 'visible') {
        this.refreshRemoteTimelineSilent();
      }
    }, 10000);
  }

  async refreshRemoteTimelineSilent() {
    const pairId = store.state.pairId;
    if (!this.supabase || !pairId) return;
    try {
      const remoteEvents = await fetchRemoteTimeline(this.supabase, pairId);
      if (remoteEvents && Array.isArray(remoteEvents)) {
        const currentEvents = store.state.events;
        const currentJson = JSON.stringify(currentEvents);
        const remoteJson = JSON.stringify(remoteEvents);
        if (currentJson !== remoteJson) {
          console.log('[AutoSync] Remote changes detected, updating state...');
          store.setRemoteEvents(remoteEvents);
        }
      }
    } catch (e) {
      console.debug('[AutoSync] poll notice:', e.message);
    }
  }
}

// アプリ起動
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});

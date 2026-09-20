// Store - アプリケーション状態管理 & キャッシュ制御
import { CONFIG } from './config.js';
import { generatePairSecretKey, generateUUID } from './crypto.js';

export class Store {
  constructor() {
    this.state = {
      pairId: '',
      secretKey: '',
      anniversaryDating: '',
      anniversaryMarriage: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      events: [],
      isOnline: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true,
      isSyncing: false,
      lastError: null
    };

    this.listeners = new Set();
  }

  /**
   * 変更通知リスナーの登録
   * @param {Function} callback
   * @returns {Function} 解除関数
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  }

  /**
   * ローカルストレージおよびURLから設定・キャッシュをロード
   * @param {string} searchParamsString
   */
  init(searchParamsString = '') {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const params = new URLSearchParams(searchParamsString);
    const urlPair = params.get('pair');
    const urlKey = params.get('key');

    // 1. ローカルストレージから既存設定を復元
    const storedPair = localStorage.getItem(CONFIG.STORAGE_KEYS.PAIR_ID);
    const storedKey = localStorage.getItem(CONFIG.STORAGE_KEYS.PAIR_SECRET_KEY);
    const storedDating = localStorage.getItem(CONFIG.STORAGE_KEYS.ANNIVERSARY_DATING);
    const storedMarriage = localStorage.getItem(CONFIG.STORAGE_KEYS.ANNIVERSARY_MARRIAGE);
    const storedEventsJson = localStorage.getItem(CONFIG.STORAGE_KEYS.CACHED_EVENTS);
    const storedCustomUrl = localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_URL);
    const storedCustomKey = localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_KEY);

    // URLパラメータの優先（ペアリング招待URLを開いた場合）
    if (urlPair) {
      this.state.pairId = urlPair;
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_ID, urlPair);
    } else if (storedPair) {
      this.state.pairId = storedPair;
    } else {
      // 初回起動時: 新規ペアIDを自動生成
      const newPair = generateUUID();
      this.state.pairId = newPair;
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_ID, newPair);
    }

    if (urlKey) {
      this.state.secretKey = urlKey;
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_SECRET_KEY, urlKey);
    } else if (storedKey) {
      this.state.secretKey = storedKey;
    } else {
      // 初回起動時: 暗号学的に安全な256bit秘密鍵を生成
      const newKey = generatePairSecretKey();
      this.state.secretKey = newKey;
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_SECRET_KEY, newKey);
    }

    this.state.anniversaryDating = storedDating || '2023-01-01';
    this.state.anniversaryMarriage = storedMarriage || '';
    this.state.supabaseUrl = storedCustomUrl || CONFIG.DEFAULT_SUPABASE_URL;
    this.state.supabaseAnonKey = storedCustomKey || CONFIG.DEFAULT_SUPABASE_ANON_KEY;

    if (storedEventsJson) {
      try {
        this.state.events = JSON.parse(storedEventsJson);
      } catch (e) {
        console.warn('Failed to parse cached events:', e);
        this.state.events = [];
      }
    }

    // デモ・初期データ（空の場合のみ温かみのあるサンプルを用意）
    if (!this.state.events || this.state.events.length === 0) {
      this.state.events = this.getInitialSampleEvents();
      this.saveEventsCache();
    }

    this.notify();
  }

  /**
   * 初回用のサンプルイベント
   */
  getInitialSampleEvents() {
    const today = new Date();
    const futureDate = new Date(today.getFullYear(), today.getMonth() + 3, 15).toISOString().split('T')[0];
    const pastDate1 = new Date(today.getFullYear() - 1, 5, 20).toISOString().split('T')[0];
    const pastDate2 = new Date(today.getFullYear() - 2, 10, 11).toISOString().split('T')[0];

    return [
      {
        id: generateUUID(),
        pair_id: this.state.pairId,
        event_date: futureDate,
        title: '北海道 温泉と星空の旅',
        category: 'future',
        memo: '秋に登別温泉と小樽を巡って、夜は満天の星を見に行こう！',
        photo_url: '',
        is_completed: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        pair_id: this.state.pairId,
        event_date: pastDate1,
        title: '金沢 兼六園と近江町市場',
        category: 'trip',
        memo: '美味しい海鮮丼を食べて、雨上がりの緑が本当に綺麗だった思い出。',
        photo_url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
        is_completed: true,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: generateUUID(),
        pair_id: this.state.pairId,
        event_date: pastDate2,
        title: 'ふたりの最初の一歩',
        category: 'anniversary',
        memo: 'ここからふたりの物語がスタートしました。',
        photo_url: '',
        is_completed: true,
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];
  }

  saveEventsCache() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CACHED_EVENTS, JSON.stringify(this.state.events));
    }
  }

  setPairCredentials(pairId, secretKey) {
    this.state.pairId = pairId;
    this.state.secretKey = secretKey;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_ID, pairId);
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_SECRET_KEY, secretKey);
    }
    this.notify();
  }

  setAnniversaries(dating, marriage) {
    this.state.anniversaryDating = dating;
    this.state.anniversaryMarriage = marriage;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.ANNIVERSARY_DATING, dating);
      localStorage.setItem(CONFIG.STORAGE_KEYS.ANNIVERSARY_MARRIAGE, marriage);
    }
    this.notify();
  }

  setSupabaseConfig(url, key) {
    this.state.supabaseUrl = url;
    this.state.supabaseAnonKey = key;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_URL, url);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_KEY, key);
    }
    this.notify();
  }

  setSyncing(isSyncing) {
    this.state.isSyncing = isSyncing;
    this.notify();
  }

  setOnlineStatus(isOnline) {
    this.state.isOnline = isOnline;
    this.notify();
  }

  /**
   * リモートイベントで状態を置換/マージ
   * @param {Array} remoteEvents
   */
  setRemoteEvents(remoteEvents) {
    if (!Array.isArray(remoteEvents)) return;
    this.state.events = remoteEvents;
    this.saveEventsCache();
    this.notify();
  }

  /**
   * 単一イベントの追加または更新（Realtime / ローカル操作用）
   * @param {Object} event
   */
  upsertEvent(event) {
    if (!event || !event.id) return;
    const index = this.state.events.findIndex(e => e.id === event.id);
    if (index >= 0) {
      this.state.events[index] = { ...this.state.events[index], ...event };
    } else {
      this.state.events.push(event);
    }
    this.saveEventsCache();
    this.notify();
  }

  /**
   * 単一イベントの削除
   * @param {string} eventId
   */
  removeEvent(eventId) {
    this.state.events = this.state.events.filter(e => e.id !== eventId);
    this.saveEventsCache();
    this.notify();
  }

  /**
   * 未来イベントの「達成」トグル
   * @param {string} eventId
   */
  toggleEventCompletion(eventId) {
    const event = this.state.events.find(e => e.id === eventId);
    if (!event) return null;
    event.is_completed = !event.is_completed;
    this.saveEventsCache();
    this.notify();
    return event;
  }
}

export const store = new Store();

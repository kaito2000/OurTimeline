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
      notifications: [],
      unreadNotificationCount: 0,
      isOnline: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true,
      isSyncing: false,
      syncStatus: 'unconfigured', // 'unconfigured' | 'connecting' | 'connected' | 'error'
      syncErrorMessage: '',
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

    const urlSu = params.get('su');
    const urlSk = params.get('sk');

    // URLパラメータの優先（ペアリング招待URLを開いた場合）
    if (urlPair) {
      if (urlPair !== storedPair) {
        // 新しいペアに参加する場合、古いローカルキャッシュをクリア
        this.state.events = [];
      }
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

    // Supabase接続情報の自動引き継ぎ（パートナー側は入力不要！）
    if (urlSu) {
      this.state.supabaseUrl = urlSu;
      localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_URL, urlSu);
    } else {
      this.state.supabaseUrl = storedCustomUrl || CONFIG.DEFAULT_SUPABASE_URL;
    }

    if (urlSk) {
      this.state.supabaseAnonKey = urlSk;
      localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_KEY, urlSk);
    } else {
      this.state.supabaseAnonKey = storedCustomKey || CONFIG.DEFAULT_SUPABASE_ANON_KEY;
    }

    this.state.anniversaryDating = storedDating || '2023-01-01';
    this.state.anniversaryMarriage = storedMarriage || '';

    if (storedEventsJson && this.state.events.length === 0 && !urlPair) {
      try {
        this.state.events = JSON.parse(storedEventsJson);
      } catch (e) {
        console.warn('Failed to parse cached events:', e);
        this.state.events = [];
      }
    }

    this.state.syncStatus = (this.state.supabaseUrl && this.state.supabaseAnonKey) ? 'connecting' : 'unconfigured';

    // Supabase未設定（ローカル専用モード）時のみ、イベントが空なら初期サンプルを用意
    if (!this.state.supabaseUrl || !this.state.supabaseAnonKey) {
      if (!this.state.events || this.state.events.length === 0) {
        this.ensureInitialSampleEvents();
      }
    }

    // 通知履歴の復元
    this.loadNotifications();

    this.notify();
  }

  /**
   * 初回用サンプルイベントの補完（未設定時またはオフラインでデータがない場合）
   */
  ensureInitialSampleEvents() {
    if (!this.state.events || this.state.events.length === 0) {
      this.state.events = this.getInitialSampleEvents();
      this.saveEventsCache();
      this.notify();
    }
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

  setSyncStatus(status, errorMessage = '') {
    this.state.syncStatus = status;
    this.state.syncErrorMessage = errorMessage;
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

  /**
   * イベントに対する絵文字リアクションのトグル（+1 または -1）
   * @param {string} eventId
   * @param {string} emoji
   * @returns {Object|null} 更新されたイベント
   */
  toggleReaction(eventId, emoji) {
    const event = this.state.events.find(e => e.id === eventId);
    if (!event) return null;

    if (!event.reactions || typeof event.reactions !== 'object') {
      event.reactions = {};
    }

    const storageKey = `${CONFIG.STORAGE_KEYS.USER_REACTIONS_PREFIX}${eventId}`;
    let myReactions = [];

    if (this._memoryUserReactions && this._memoryUserReactions.has(storageKey)) {
      myReactions = this._memoryUserReactions.get(storageKey);
    } else if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      try {
        myReactions = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch {
        myReactions = [];
      }
    }

    const currentCount = Number(event.reactions[emoji]) || 0;
    const hasReacted = myReactions.includes(emoji);

    if (hasReacted) {
      // 自分が既に押していたら解除
      const nextCount = Math.max(0, currentCount - 1);
      if (nextCount > 0) {
        event.reactions[emoji] = nextCount;
      } else {
        delete event.reactions[emoji];
      }
      myReactions = myReactions.filter(e => e !== emoji);
    } else {
      // 新たにリアクション
      event.reactions[emoji] = currentCount + 1;
      myReactions.push(emoji);
    }

    if (!this._memoryUserReactions) {
      this._memoryUserReactions = new Map();
    }
    this._memoryUserReactions.set(storageKey, myReactions);

    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(myReactions));
      } catch (err) {
        console.warn('localStorage setItem error:', err);
      }
    }

    this.saveEventsCache();
    this.notify();
    return event;
  }

  /**
   * 自分がこのイベントに押したリアクションの配列を取得
   * @param {string} eventId
   * @returns {string[]}
   */
  getUserReactions(eventId) {
    const storageKey = `${CONFIG.STORAGE_KEYS.USER_REACTIONS_PREFIX}${eventId}`;
    if (this._memoryUserReactions && this._memoryUserReactions.has(storageKey)) {
      return this._memoryUserReactions.get(storageKey);
    }
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * 別のペアに参加する（招待コード／URL入力時）
   * @param {Object} credentials
   */
  joinPair({ pairId, secretKey, supabaseUrl, supabaseAnonKey }) {
    if (!pairId) return false;

    this.state.pairId = pairId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_ID, pairId);
    }

    if (secretKey) {
      this.state.secretKey = secretKey;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PAIR_SECRET_KEY, secretKey);
      }
    }

    if (supabaseUrl) {
      this.state.supabaseUrl = supabaseUrl;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_URL, supabaseUrl);
      }
    }

    if (supabaseAnonKey) {
      this.state.supabaseAnonKey = supabaseAnonKey;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_SUPABASE_KEY, supabaseAnonKey);
      }
    }

    // 古いペアのローカルイベントをクリアしてリモート同期に備える
    this.state.events = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CACHED_EVENTS);
    }

    this.state.syncStatus = (this.state.supabaseUrl && this.state.supabaseAnonKey) ? 'connecting' : 'unconfigured';
    this.notify();
    return true;
  }

  /**
   * 通知履歴の復元
   */
  loadNotifications() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.NOTIFICATIONS);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.state.notifications = list;
          this.state.unreadNotificationCount = list.filter(n => !n.isRead).length;
        }
      }
    } catch (err) {
      console.warn('Failed to load notifications cache:', err);
    }
  }

  /**
   * 通知履歴の永続化
   */
  saveNotifications() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.state.notifications));
      } catch (err) {
        console.warn('Failed to save notifications cache:', err);
      }
    }
  }

  /**
   * 通知の追加
   * @param {Object} notifData - { type, title, body, icon, targetEventId }
   * @returns {Object} 作成された通知
   */
  addNotification(notifData) {
    if (!notifData) return null;

    const todayStr = new Date().toISOString().split('T')[0];

    // 重複チェック: 同じターゲットイベントに対する同日・同一種別の通知
    const existingIndex = this.state.notifications.findIndex(n => {
      if (notifData.targetEventId && n.targetEventId === notifData.targetEventId) {
        if (n.type === notifData.type) {
          return n.timestamp && n.timestamp.startsWith(todayStr);
        }
      }
      return false;
    });

    // デイリーリマインド系（振り返り通知・直近約束リマインド）の場合：
    // すでに同日に通知が存在していれば、既読・未読状態を維持し、再作成・未読化しない
    if (existingIndex >= 0 && (notifData.type === 'on_this_day' || notifData.type === 'upcoming_reminder')) {
      return this.state.notifications[existingIndex];
    }

    const newNotif = {
      id: notifData.id || generateUUID(),
      type: notifData.type || 'info',
      title: notifData.title || '',
      body: notifData.body || '',
      icon: notifData.icon || '🌿',
      targetEventId: notifData.targetEventId || '',
      timestamp: notifData.timestamp || new Date().toISOString(),
      isRead: false
    };

    if (existingIndex >= 0) {
      this.state.notifications.splice(existingIndex, 1);
    }

    this.state.notifications.unshift(newNotif);

    // 最大40件に制限
    if (this.state.notifications.length > 40) {
      this.state.notifications = this.state.notifications.slice(0, 40);
    }

    this.state.unreadNotificationCount = this.state.notifications.filter(n => !n.isRead).length;
    this.saveNotifications();
    this.notify();
    return newNotif;
  }

  /**
   * すべての通知を既読にする（未読赤丸バッジを消去）
   */
  markAllNotificationsAsRead() {
    let changed = false;
    this.state.notifications.forEach(n => {
      if (!n.isRead) {
        n.isRead = true;
        changed = true;
      }
    });

    this.state.unreadNotificationCount = 0;
    if (changed) {
      this.saveNotifications();
      this.notify();
    }
  }

  /**
   * すべての通知を消去
   */
  clearAllNotifications() {
    this.state.notifications = [];
    this.state.unreadNotificationCount = 0;
    this.saveNotifications();
    this.notify();
  }
}

/**
 * 招待コードまたは共有URLの解析
 * @param {string} rawInput
 * @returns {{ pairId: string, secretKey?: string, supabaseUrl?: string, supabaseAnonKey?: string } | null}
 */
export function parseInviteString(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const input = rawInput.trim();

  // 1. URL形式（https://...?pair=... または ?pair=...）
  if (input.includes('pair=') || input.includes('http://') || input.includes('https://')) {
    try {
      let search = input;
      if (input.includes('?')) {
        search = input.substring(input.indexOf('?'));
      }
      const params = new URLSearchParams(search);
      const pairId = params.get('pair');
      const secretKey = params.get('key');
      const supabaseUrl = params.get('su') || undefined;
      const supabaseAnonKey = params.get('sk') || undefined;

      if (pairId) {
        return { pairId, secretKey: secretKey || undefined, supabaseUrl, supabaseAnonKey };
      }
    } catch (e) {
      // パース失敗時は下へフォールバック
    }
  }

  // 2. トークン形式: pairId:secretKey または pairId:secretKey:supabaseUrl:supabaseAnonKey
  if (input.includes(':')) {
    const parts = input.split(':');
    if (parts.length >= 2) {
      return {
        pairId: parts[0].trim(),
        secretKey: parts[1].trim(),
        supabaseUrl: parts[2]?.trim() || undefined,
        supabaseAnonKey: parts[3]?.trim() || undefined
      };
    }
  }

  // 3. 単体UUID形式（pairId のみ）
  if (/^[0-9a-fA-F-]{36}$/.test(input)) {
    return { pairId: input };
  }

  return null;
}

export const store = new Store();

// OurTimeline Configuration
export const CONFIG = {
  // デフォルトのSupabase接続情報（必要に応じて環境に合わせて設定、または設定モーダルから保存）
  DEFAULT_SUPABASE_URL: '',
  DEFAULT_SUPABASE_ANON_KEY: '',
  
  // Storageバケット名
  STORAGE_BUCKET: 'trip-photos',

  // 最大画像サイズ（長辺px）
  MAX_IMAGE_DIMENSION: 1200,

  // WebP圧縮品質 (0.0 ~ 1.0)
  IMAGE_QUALITY: 0.8,

  // ローカルストレージキー
  STORAGE_KEYS: {
    PAIR_ID: 'ourtimeline_pair_id',
    PAIR_SECRET_KEY: 'ourtimeline_secret_key',
    ANNIVERSARY_DATING: 'ourtimeline_anniv_dating',
    ANNIVERSARY_MARRIAGE: 'ourtimeline_anniv_marriage',
    CUSTOM_SUPABASE_URL: 'ourtimeline_custom_supabase_url',
    CUSTOM_SUPABASE_KEY: 'ourtimeline_custom_supabase_key',
    CACHED_EVENTS: 'ourtimeline_cached_events',
    LAST_SYNC_TIME: 'ourtimeline_last_sync'
  },

  // カテゴリ定義
  CATEGORIES: {
    trip: { label: '旅行', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✈️' },
    anniversary: { label: '記念日', color: 'bg-rose-100 text-rose-700 border-rose-300', icon: '💍' },
    life: { label: '暮らし', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '🏡' },
    future: { label: '未来の約束', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '✨' }
  }
};

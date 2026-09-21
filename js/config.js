// OurTimeline Configuration - Natural Green Edition
export const CONFIG = {
  DEFAULT_SUPABASE_URL: '',
  DEFAULT_SUPABASE_ANON_KEY: '',
  
  STORAGE_BUCKET: 'trip-photos',
  MAX_IMAGE_DIMENSION: 1200,
  IMAGE_QUALITY: 0.8,

  STORAGE_KEYS: {
    PAIR_ID: 'ourtimeline_pair_id',
    PAIR_SECRET_KEY: 'ourtimeline_secret_key',
    ANNIVERSARY_DATING: 'ourtimeline_anniv_dating',
    ANNIVERSARY_MARRIAGE: 'ourtimeline_anniv_marriage',
    CUSTOM_SUPABASE_URL: 'ourtimeline_custom_supabase_url',
    CUSTOM_SUPABASE_KEY: 'ourtimeline_custom_supabase_key',
    CACHED_EVENTS: 'ourtimeline_cached_events',
    LAST_SYNC_TIME: 'ourtimeline_last_sync',
    USER_REACTIONS_PREFIX: 'ourtimeline_user_rx_'
  },

  // ボタニカル・リアクション（ハートは使わず自然で温かい4種）
  REACTIONS: [
    { emoji: '🌿', label: 'いいね' },
    { emoji: '✨', label: '楽しみ' },
    { emoji: '☕️', label: 'ほっこり' },
    { emoji: '🤍', label: 'ありがとう' }
  ],

  // 自然なアースカラー＆ボタニカルカテゴリ
  CATEGORIES: {
    trip: { label: '旅行', color: 'bg-emerald-50 text-emerald-800 border-emerald-200/80', icon: '🌿' },
    anniversary: { label: '記念日', color: 'bg-amber-50 text-amber-800 border-amber-200/80', icon: '✨' },
    life: { label: '暮らし', color: 'bg-stone-100 text-stone-700 border-stone-200/80', icon: '🏡' },
    future: { label: '未来の約束', color: 'bg-teal-50 text-teal-800 border-teal-200/80', icon: '🌱' }
  }
};

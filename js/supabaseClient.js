// Supabase Client Wrapper with Security Headers and Realtime Sync
import { CONFIG } from './config.js';
import { hashSecretKey } from './crypto.js';

let supabaseClient = null;
let realtimeChannel = null;

/**
 * Supabaseクライアントの初期化または取得
 * @param {string} url
 * @param {string} anonKey
 * @param {string} pairId
 * @param {string} secretKey
 */
export async function getSupabaseClient(url, anonKey, pairId, secretKey) {
  if (!url || !anonKey) {
    return null;
  }

  // 既に初期化されており設定が変わっていなければ再利用
  if (supabaseClient && supabaseClient._url === url && supabaseClient._key === anonKey && supabaseClient._secretKey === secretKey) {
    return supabaseClient;
  }

  try {
    // CDNまたはグローバルからSupabaseライブラリをロード
    let createClientFn;
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      createClientFn = window.supabase.createClient;
    } else {
      const supabaseModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      createClientFn = supabaseModule.createClient;
    }

    // セキュリティカスタムヘッダー（x-pair-key）を付与
    const clientOptions = {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'x-pair-id': pairId || '',
          'x-pair-key': secretKey || ''
        }
      }
    };

    supabaseClient = createClientFn(url, anonKey, clientOptions);
    supabaseClient._url = url;
    supabaseClient._key = anonKey;
    supabaseClient._secretKey = secretKey;
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * 夫婦ペアの登録・同期（未登録ならpairsテーブルに作成）
 */
export async function ensurePairExists(client, pairId, secretKey, datingDate, marriageDate) {
  if (!client || !pairId || !secretKey) return false;

  try {
    const keyHash = await hashSecretKey(secretKey);

    // 既存ペアの確認
    const { data, error } = await client
      .from('pairs')
      .select('id, anniversary_dating, anniversary_marriage')
      .eq('id', pairId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Pair check warning:', error.message);
    }

    if (!data) {
      // ペアを新規登録
      const { error: insertErr } = await client
        .from('pairs')
        .insert({
          id: pairId,
          secret_key_hash: keyHash,
          anniversary_dating: datingDate || null,
          anniversary_marriage: marriageDate || null
        });

      if (insertErr) {
        console.warn('Pair insert notice:', insertErr.message);
      }
    }
    return true;
  } catch (err) {
    console.error('ensurePairExists error:', err);
    return false;
  }
}

/**
 * タイムラインイベントのリモート取得
 */
export async function fetchRemoteTimeline(client, pairId) {
  if (!client || !pairId) return [];

  const { data, error } = await client
    .from('timeline_events')
    .select('*')
    .eq('pair_id', pairId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchRemoteTimeline error:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * タイムラインイベントの作成
 */
export async function insertTimelineEvent(client, event) {
  if (!client) return event;

  const { data, error } = await client
    .from('timeline_events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error('insertTimelineEvent error:', error.message);
    throw error;
  }
  return data;
}

/**
 * タイムラインイベントの更新
 */
export async function updateRemoteEvent(client, eventId, updates) {
  if (!client) return updates;

  const { data, error } = await client
    .from('timeline_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('updateRemoteEvent error:', error.message);
    throw error;
  }
  return data;
}

/**
 * タイムラインイベントの削除
 */
export async function deleteRemoteEvent(client, eventId) {
  if (!client) return true;

  const { error } = await client
    .from('timeline_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('deleteRemoteEvent error:', error.message);
    throw error;
  }
  return true;
}

/**
 * 写真をSupabase Storageへアップロードし、公開URLを取得
 * パス規則: {pair_id}/{timestamp}.webp
 */
export async function uploadPhotoToStorage(client, pairId, photoBlob) {
  if (!client || !photoBlob) return '';

  const timestamp = Date.now();
  const filePath = `${pairId}/${timestamp}.webp`;

  const { error: uploadError } = await client.storage
    .from(CONFIG.STORAGE_BUCKET)
    .upload(filePath, photoBlob, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Photo upload error:', uploadError.message);
    throw uploadError;
  }

  const { data } = client.storage
    .from(CONFIG.STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data?.publicUrl || '';
}

/**
 * Realtime API の購読を開始
 * @param {Object} client
 * @param {string} pairId
 * @param {Function} onInsert
 * @param {Function} onUpdate
 * @param {Function} onDelete
 */
export function subscribeToRealtime(client, pairId, { onInsert, onUpdate, onDelete }) {
  if (!client || !pairId) return null;

  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch (e) {}
  }

  realtimeChannel = client
    .channel(`timeline_events_pair_${pairId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'timeline_events',
        filter: `pair_id=eq.${pairId}`
      },
      (payload) => {
        if (onInsert) onInsert(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'timeline_events',
        filter: `pair_id=eq.${pairId}`
      },
      (payload) => {
        if (onUpdate) onUpdate(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'timeline_events',
        filter: `pair_id=eq.${pairId}`
      },
      (payload) => {
        if (onDelete) onDelete(payload.old);
      }
    )
    .subscribe((status) => {
      console.log(`[Supabase Realtime] Channel status: ${status}`);
    });

  return realtimeChannel;
}

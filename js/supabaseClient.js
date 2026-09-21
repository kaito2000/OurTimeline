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
 * Supabaseへの疎通・テーブル存在チェック
 */
export async function testSupabaseConnection(url, anonKey, pairId, secretKey) {
  if (!url || !anonKey) {
    return { success: false, message: 'URLまたはAPIキーが入力されていません。' };
  }
  try {
    const client = await getSupabaseClient(url, anonKey, pairId, secretKey);
    if (!client) {
      return { success: false, message: 'Supabaseクライアントの初期化に失敗しました。URLの形式を確認してください。' };
    }

    // pairs テーブルの疎通確認
    const { error } = await client.from('pairs').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        return {
          success: false,
          code: 'TABLE_NOT_FOUND',
          message: 'テーブル「pairs」が見つかりません。SupabaseのSQL Editorでテーブル作成スクリプトを実行してください。'
        };
      }
      if (error.code === 'PGRST301' || (error.message && (error.message.includes('JWT') || error.message.includes('API key')))) {
        return {
          success: false,
          code: 'AUTH_FAILED',
          message: 'Anon API Keyが無効です。SupabaseダッシュボードのAPIキーをご確認ください。'
        };
      }
      return { success: false, message: `Supabaseエラー: ${error.message}` };
    }
    return { success: true, message: 'Supabaseへの接続に成功しました！' };
  } catch (err) {
    return { success: false, message: `接続エラー: ${err.message || err}` };
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

    if (data) {
      // 既存ペアが存在し、リモートの記念日が未設定でローカルに記念日がある場合は補完更新
      const needsUpdate = (!data.anniversary_dating && datingDate) || (!data.anniversary_marriage && marriageDate);
      if (needsUpdate) {
        try {
          const { data: updated, error: updateErr } = await client
            .from('pairs')
            .update({
              anniversary_dating: data.anniversary_dating || datingDate || null,
              anniversary_marriage: data.anniversary_marriage || marriageDate || null
            })
            .eq('id', pairId)
            .select()
            .maybeSingle();

          if (!updateErr && updated) {
            return updated;
          }
        } catch (updEx) {
          console.warn('ensurePairExists complement update error:', updEx);
        }
      }
      return data;
    }

    // ペアを新規登録
    const { data: newPair, error: insertErr } = await client
      .from('pairs')
      .insert({
        id: pairId,
        secret_key_hash: keyHash,
        anniversary_dating: datingDate || null,
        anniversary_marriage: marriageDate || null
      })
      .select()
      .maybeSingle();

    if (insertErr) {
      console.warn('Pair insert notice:', insertErr.message);
    }
    return newPair || true;
  } catch (err) {
    console.error('ensurePairExists error:', err);
    return false;
  }
}

/**
 * 夫婦ペアの記念日（交際記念日・入籍結婚記念日）をリモートDBへ更新・反映
 * @param {Object} client SupabaseClient
 * @param {string} pairId
 * @param {string} datingDate YYYY-MM-DD
 * @param {string} marriageDate YYYY-MM-DD
 */
export async function updateRemotePairAnniversaries(client, pairId, datingDate, marriageDate) {
  if (!client || !pairId) return false;

  try {
    const { data, error } = await client
      .from('pairs')
      .update({
        anniversary_dating: datingDate || null,
        anniversary_marriage: marriageDate || null
      })
      .eq('id', pairId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('updateRemotePairAnniversaries error:', error.message);
      throw error;
    }

    console.log('[Supabase] Pair anniversaries updated successfully:', data);
    return data;
  } catch (err) {
    console.error('updateRemotePairAnniversaries exception:', err);
    throw err;
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
 * Realtime API の購読を開始（Broadcast + postgres_changes の二重構成）
 * @param {Object} client
 * @param {string} pairId
 * @param {Function} onInsert
 * @param {Function} onUpdate
 * @param {Function} onDelete
 * @param {Function} onPairConfig
 */
export function subscribeToRealtime(client, pairId, { onInsert, onUpdate, onDelete, onPairConfig } = {}) {
  if (!client || !pairId) return null;

  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch (e) {}
  }

  realtimeChannel = client
    .channel(`timeline_events_pair_${pairId}`, {
      config: {
        broadcast: { self: false } // 自身の送信イベントは重複処理しない
      }
    })
    // 1. WebSocket Broadcast: RLSの影響を一切受けず0.1秒で相手端末に即時同期
    .on(
      'broadcast',
      { event: 'timeline_change' },
      ({ payload }) => {
        console.log('[Supabase Realtime Broadcast] Event received:', payload);
        if (!payload || !payload.action) return;

        if (payload.action === 'INSERT' && onInsert) {
          onInsert(payload.data);
        } else if (payload.action === 'UPDATE' && onUpdate) {
          onUpdate(payload.data);
        } else if (payload.action === 'DELETE' && onDelete) {
          onDelete(payload.data);
        } else if (payload.action === 'PAIR_CONFIG' && onPairConfig) {
          onPairConfig(payload.data);
        }
      }
    )
    // 2. postgres_changes: timeline_events DB更新時のフォールバック
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'timeline_events',
        filter: `pair_id=eq.${pairId}`
      },
      (payload) => {
        console.log('[Supabase postgres_changes] INSERT:', payload);
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
        console.log('[Supabase postgres_changes] UPDATE:', payload);
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
        console.log('[Supabase postgres_changes] DELETE:', payload);
        if (onDelete) onDelete(payload.old);
      }
    )
    // 3. postgres_changes: pairs テーブルの記念日等更新の購読
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pairs',
        filter: `id=eq.${pairId}`
      },
      (payload) => {
        console.log('[Supabase postgres_changes] PAIRS UPDATE:', payload);
        if (onPairConfig && payload.new) {
          onPairConfig({
            anniversaryDating: payload.new.anniversary_dating,
            anniversaryMarriage: payload.new.anniversary_marriage
          });
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Supabase Realtime] Channel status: ${status}`);
    });

  return realtimeChannel;
}

/**
 * ペアの相手端末へリアルタイムにイベント変更やペア設定をブロードキャスト
 * @param {'INSERT' | 'UPDATE' | 'DELETE' | 'PAIR_CONFIG'} action
 * @param {Object} data
 */
export function broadcastTimelineChange(action, data) {
  if (!realtimeChannel) return;
  try {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'timeline_change',
      payload: { action, data }
    });
    console.log(`[Supabase Realtime Broadcast] Sent ${action}:`, data?.id || data);
  } catch (err) {
    console.warn('broadcastTimelineChange warning:', err);
  }
}

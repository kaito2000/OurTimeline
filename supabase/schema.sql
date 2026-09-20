-- ============================================================
-- OurTimeline（ふたりのクロニクル）
-- Supabase スキーマ & セキュリティ設定 (RLS & Realtime)
-- ============================================================

-- 1. 拡張機能の有効化
create extension if not exists "pgcrypto";

-- 2. 夫婦ペアテーブル (pairs)
create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  secret_key_hash text not null, -- 256bit秘密鍵のSHA-256ハッシュ
  anniversary_dating date,       -- 交際記念日
  anniversary_marriage date,     -- 入籍・結婚記念日
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. タイムラインイベントテーブル (timeline_events)
create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  event_date date not null,
  title text not null,
  category text default 'life',  -- 'trip' | 'anniversary' | 'life' | 'future'
  memo text,
  photo_url text,
  is_completed boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 時系列ソート用インデックス
create index if not exists idx_timeline_events_pair_date
  on timeline_events(pair_id, event_date desc, created_at desc);

-- 4. Supabase Realtime 有効化
-- Realtimeにテーブルを追加
alter publication supabase_realtime add table timeline_events;

-- 5. セキュリティ関数（Pair Secret Keyヘッダー照合）
-- クライアントから送信された x-pair-key ヘッダーを取得
create or replace function get_request_pair_key() returns text as $$
  select coalesce(
    current_setting('request.headers', true)::json->>'x-pair-key',
    ''
  );
$$ language sql stable;

-- ペアが正当な秘密鍵を保持しているかを検証するセキュリティ関数
create or replace function is_pair_authorized(target_pair_id uuid) returns boolean as $$
  select exists (
    select 1 from pairs
    where pairs.id = target_pair_id
      and pairs.secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
  );
$$ language sql stable security definer;

-- 6. Row Level Security (RLS) の有効化
alter table pairs enable row level security;
alter table timeline_events enable row level security;

-- pairs テーブルのRLSポリシー
-- 読み取り: 秘密鍵が一致する自身のペアのみ取得可能
create policy "Pairs select policy" on pairs
  for select using (
    secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
  );

-- 新規ペア作成: 秘密鍵ハッシュが指定されていれば誰でもペアを作成可能
create policy "Pairs insert policy" on pairs
  for insert with check (
    secret_key_hash is not null and length(secret_key_hash) = 64
  );

-- 更新: 自身のペア情報（記念日など）のみ更新可能
create policy "Pairs update policy" on pairs
  for update using (
    secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
  );

-- timeline_events テーブルのRLSポリシー
-- SELECT, INSERT, UPDATE, DELETE すべてで秘密鍵の一致を要求
create policy "Timeline events select policy" on timeline_events
  for select using (
    is_pair_authorized(pair_id)
  );

create policy "Timeline events insert policy" on timeline_events
  for insert with check (
    is_pair_authorized(pair_id)
  );

create policy "Timeline events update policy" on timeline_events
  for update using (
    is_pair_authorized(pair_id)
  ) with check (
    is_pair_authorized(pair_id)
  );

create policy "Timeline events delete policy" on timeline_events
  for delete using (
    is_pair_authorized(pair_id)
  );

-- 7. Storage バケット設定 (trip-photos)
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- 写真読み取りポリシー (パブリック読み取り)
create policy "Public read trip photos" on storage.objects
  for select using (bucket_id = 'trip-photos');

-- 写真アップロードポリシー (trip-photosバケットへの書き込み)
create policy "Authorized upload trip photos" on storage.objects
  for insert with check (
    bucket_id = 'trip-photos'
  );

-- 写真削除ポリシー
create policy "Authorized delete trip photos" on storage.objects
  for delete using (
    bucket_id = 'trip-photos'
  );

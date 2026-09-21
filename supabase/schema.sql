-- ============================================================
-- OurTimeline（ふたりのクロニクル）
-- Supabase セキュリティ完全保護スクリプト (RLS & Realtime)
-- ============================================================

-- 1. 暗号拡張機能の有効化
create extension if not exists "pgcrypto";

-- 2. pairs テーブルの作成 または 不足カラムの追加
create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  secret_key_hash text,
  anniversary_dating date,
  anniversary_marriage date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table pairs add column if not exists secret_key_hash text;
alter table pairs add column if not exists anniversary_dating date;
alter table pairs add column if not exists anniversary_marriage date;
alter table pairs add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- 3. timeline_events テーブルの作成 または 不足カラムの追加
create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid references pairs(id) on delete cascade,
  event_date date not null default current_date,
  title text not null default '',
  category text default 'life',
  memo text,
  photo_url text,
  is_completed boolean default true,
  reactions jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table timeline_events add column if not exists pair_id uuid references pairs(id) on delete cascade;
alter table timeline_events add column if not exists event_date date;
alter table timeline_events add column if not exists title text;
alter table timeline_events add column if not exists category text default 'life';
alter table timeline_events add column if not exists memo text;
alter table timeline_events add column if not exists photo_url text;
alter table timeline_events add column if not exists is_completed boolean default true;
alter table timeline_events add column if not exists reactions jsonb default '{}'::jsonb;
alter table timeline_events add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- 4. インデックス
create index if not exists idx_timeline_events_pair_date
  on timeline_events(pair_id, event_date desc, created_at desc);

-- 5. セキュリティ関数の定義
create or replace function get_request_pair_key() returns text as $$
  select coalesce(
    current_setting('request.headers', true)::json->>'x-pair-key',
    ''
  );
$$ language sql stable;

create or replace function is_pair_authorized(target_pair_id uuid) returns boolean as $$
  select exists (
    select 1 from pairs
    where pairs.id = target_pair_id
      and (
        pairs.secret_key_hash is null
        or pairs.secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
      )
  );
$$ language sql stable security definer;

-- 6. Row Level Security (RLS: 行レベルセキュリティ) の有効化（緑の盾マークになります）
alter table pairs enable row level security;
alter table timeline_events enable row level security;

-- pairs テーブルのポリシー再設定
drop policy if exists "Pairs select policy" on pairs;
create policy "Pairs select policy" on pairs
  for select using (
    secret_key_hash is null
    or secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
  );

drop policy if exists "Pairs insert policy" on pairs;
create policy "Pairs insert policy" on pairs
  for insert with check (true);

drop policy if exists "Pairs update policy" on pairs;
create policy "Pairs update policy" on pairs
  for update using (
    secret_key_hash is null
    or secret_key_hash = encode(digest(get_request_pair_key(), 'sha256'), 'hex')
  );

-- timeline_events テーブルのポリシー再設定
drop policy if exists "Timeline events select policy" on timeline_events;
create policy "Timeline events select policy" on timeline_events
  for select using (
    is_pair_authorized(pair_id)
  );

drop policy if exists "Timeline events insert policy" on timeline_events;
create policy "Timeline events insert policy" on timeline_events
  for insert with check (
    is_pair_authorized(pair_id)
  );

drop policy if exists "Timeline events update policy" on timeline_events;
create policy "Timeline events update policy" on timeline_events
  for update using (
    is_pair_authorized(pair_id)
  );

drop policy if exists "Timeline events delete policy" on timeline_events;
create policy "Timeline events delete policy" on timeline_events
  for delete using (
    is_pair_authorized(pair_id)
  );

-- 7. Realtime配信の有効化
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'timeline_events'
  ) then
    alter publication supabase_realtime add table timeline_events;
  end if;
end $$;

-- 8. Storage バケット設定 (trip-photos)
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read trip photos" on storage.objects;
create policy "Public read trip photos" on storage.objects
  for select using (bucket_id = 'trip-photos');

drop policy if exists "Authorized upload trip photos" on storage.objects;
create policy "Authorized upload trip photos" on storage.objects
  for insert with check (bucket_id = 'trip-photos');

drop policy if exists "Authorized delete trip photos" on storage.objects;
create policy "Authorized delete trip photos" on storage.objects
  for delete using (bucket_id = 'trip-photos');

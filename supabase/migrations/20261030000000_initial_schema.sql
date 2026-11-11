-- 段階1の初期スキーマ（設計書 5. データ設計、7.1 アクセス制御）
-- 世帯・ユーザー・カテゴリ・サブスク・定期実行ログ・許可メール
-- すべてのテーブルで RLS を有効にし、ポリシーも同じマイグレーションで作る

-- ============================================================
-- 列挙型
-- ============================================================
create type public.household_role as enum ('owner', 'member');
create type public.category_group as enum ('fixed', 'variable');
create type public.billing_cycle as enum ('monthly', 'yearly', 'weekly', 'other');
create type public.subscription_status as enum (
  'active', 'considering', 'cancel_scheduled', 'paused', 'cancelled'
);
create type public.usage_frequency as enum ('often', 'sometimes', 'rarely');
create type public.job_status as enum ('success', 'failed');

-- ============================================================
-- 共通：updated_at の自動更新
-- ============================================================
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- households（世帯）
-- ============================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

-- ============================================================
-- users（ユーザー。auth.users と 1対1）
-- ============================================================
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "本人の行だけ読める" on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy "本人の行だけ更新できる" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ============================================================
-- household_members（世帯メンバー）
-- ============================================================
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.household_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

alter table public.household_members enable row level security;

-- ログイン中のユーザーがその世帯のメンバーかどうか。
-- household_members のポリシーから自分自身を参照すると無限再帰になるため、
-- security definer（作成者の権限で実行）の関数にまとめて RLS を通さずに判定する。
create function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

create policy "自分がメンバーの世帯だけ読める" on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy "自分がメンバーの世帯のメンバーだけ読める" on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- メンバーの追加・変更は共有機能の段階で作る（それまでは新規登録時のトリガーだけが追加する）

-- ============================================================
-- categories（カテゴリ）
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  group_type public.category_group not null default 'fixed',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  -- subscriptions から「同じ世帯のカテゴリ」だけを参照させるための一意制約
  unique (id, household_id)
);

alter table public.categories enable row level security;

create policy "世帯のカテゴリを読める" on public.categories
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "世帯のカテゴリを追加できる" on public.categories
  for insert to authenticated
  with check (public.is_household_member(household_id));

create policy "世帯のカテゴリを更新できる" on public.categories
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "世帯のカテゴリを削除できる" on public.categories
  for delete to authenticated
  using (public.is_household_member(household_id));

-- ============================================================
-- subscriptions（サブスク・固定費の定義）
-- vendor_id・payment_method_id は、購入先・支払い方法のテーブルを作る段階で追加する
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category_id uuid,
  currency text not null default 'JPY' check (currency ~ '^[A-Z]{3}$'),
  -- 円建てなら円（整数）、外貨建てなら外貨の金額。金額が変動する場合は目安額
  amount numeric(14, 2) not null check (amount >= 0),
  is_variable boolean not null default false,
  is_manual_purchase boolean not null default false,
  billing_cycle public.billing_cycle not null,
  -- src/lib/billing/billing-date.ts の BillingRule の形（詳細の検証はアプリ側の Zod で行う）
  billing_rule jsonb not null,
  next_billing_date date not null,
  status public.subscription_status not null default 'active',
  end_date date,
  resume_date date,
  usage_frequency public.usage_frequency,
  last_used_at date,
  trial_end_date date,
  notify_days_before integer not null default 3 check (notify_days_before between 0 and 60),
  started_at date,
  url text check (url is null or url ~* '^https?://'),
  memo text check (memo is null or char_length(memo) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- カテゴリは同じ世帯のものだけ。カテゴリを削除したら category_id だけ空にする
  foreign key (category_id, household_id)
    references public.categories (id, household_id)
    on delete set null (category_id),
  -- 円は整数（設計書 5.0）
  constraint subscriptions_jpy_integer check (currency <> 'JPY' or amount = trunc(amount)),
  -- 請求日のルールの種類はサイクルと一致させる
  constraint subscriptions_rule_matches_cycle check (billing_rule ->> 'cycle' = billing_cycle::text),
  -- 自分で購入するものは金額が変動する扱い（設計書 3.14）
  constraint subscriptions_manual_is_variable check (not is_manual_purchase or is_variable),
  -- 解約手続き済みには利用終了日が必要（設計書 3.9）
  constraint subscriptions_cancel_scheduled_end_date check (
    status <> 'cancel_scheduled' or end_date is not null
  )
);

create index subscriptions_household_id_idx on public.subscriptions (household_id);
create index subscriptions_next_billing_date_idx on public.subscriptions (next_billing_date);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "世帯のサブスクを読める" on public.subscriptions
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "世帯のサブスクを追加できる" on public.subscriptions
  for insert to authenticated
  with check (public.is_household_member(household_id));

create policy "世帯のサブスクを更新できる" on public.subscriptions
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "世帯のサブスクを削除できる" on public.subscriptions
  for delete to authenticated
  using (public.is_household_member(household_id));

-- ============================================================
-- job_runs（定期実行ログ）
-- 書き込みはサーバー側の定期実行（service_role。RLS を通らない）からのみ
-- ============================================================
create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (char_length(job) between 1 and 50),
  started_at timestamptz not null,
  finished_at timestamptz,
  status public.job_status not null,
  detail text
);

create index job_runs_job_started_at_idx on public.job_runs (job, started_at desc);

alter table public.job_runs enable row level security;

create policy "ログイン中のユーザーは読むだけ" on public.job_runs
  for select to authenticated
  using (true);

-- ============================================================
-- allowed_emails（ログインを許可するメールアドレス。設計書 7.1）
-- 画面からは読み書きできない。本番では SQL で直接登録する
-- ============================================================
create table public.allowed_emails (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
revoke all on table public.allowed_emails from anon, authenticated;

-- ユーザー作成前のフック（Supabase Auth が supabase_auth_admin の権限で呼ぶ）が読むためのポリシー
grant select on table public.allowed_emails to supabase_auth_admin;
create policy "認証サービスだけが読める" on public.allowed_emails
  for select to supabase_auth_admin
  using (true);

-- ============================================================
-- ユーザー作成前のフック：許可メール以外の新規登録を拒否する
-- supabase/config.toml の [auth.hook.before_user_created] で有効にする
-- ============================================================
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  user_email text := lower(event -> 'user' ->> 'email');
begin
  if user_email is not null
    and exists (select 1 from public.allowed_emails where email = user_email) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'このアカウントでは登録できません'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ============================================================
-- 新規登録時に、ユーザー・世帯・メンバー・初期カテゴリを作る（世帯の自動作成）
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'ユーザー'
    )
  );

  insert into public.households (name)
  values ('わが家')
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  -- 初期カテゴリ（設計書 3.5）
  insert into public.categories (household_id, name, color, group_type, sort_order)
  values
    (new_household_id, '動画', '#5B7DB1', 'fixed', 1),
    (new_household_id, '音楽', '#7A9E7E', 'fixed', 2),
    (new_household_id, 'ゲーム', '#9B7FB8', 'fixed', 3),
    (new_household_id, '配信・アーカイブ', '#C98B6B', 'fixed', 4),
    (new_household_id, 'クラウド・ソフト', '#5E9FA8', 'fixed', 5),
    (new_household_id, '通信', '#B8A05A', 'fixed', 6),
    (new_household_id, '住居・光熱', '#8C8C6E', 'fixed', 7),
    (new_household_id, '保険', '#B07A8C', 'fixed', 8),
    (new_household_id, 'その他', '#8E9AA6', 'fixed', 9);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

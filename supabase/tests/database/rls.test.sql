-- RLS とデータベースの制約のテスト（設計書 9.6）。`npx supabase test db` で実行する。
-- 2つの世帯（ユーザーA・B）を作り、他の世帯のデータを読み書きできないこと、
-- 未ログインで何も読めないこと、許可メール以外の登録を拒否することを確認する。
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ------------------------------------------------------------
-- 準備（postgres の権限で実行。RLS を通らない）
-- ------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'a@example.com', '{"full_name": "ユーザーA"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'b@example.com', '{}', now(), now());

create temporary table ids on commit drop as
select
  (select household_id from public.household_members where user_id = '11111111-1111-4111-8111-111111111111') as household_a,
  (select household_id from public.household_members where user_id = '22222222-2222-4222-8222-222222222222') as household_b;
grant select on ids to authenticated, anon;

insert into public.subscriptions (household_id, name, amount, billing_cycle, billing_rule, next_billing_date)
select household_a, 'Aのサブスク', 1000, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 1}'::jsonb, '2026-11-01'::date from ids
union all
select household_b, 'Bのサブスク', 2000, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 1}'::jsonb, '2026-11-01'::date from ids;

-- ------------------------------------------------------------
-- 新規登録時の自動作成
-- ------------------------------------------------------------
select isnt((select household_a from ids), null, '新規登録で世帯が作られる');
select is(
  (select role::text from public.household_members where user_id = '11111111-1111-4111-8111-111111111111'),
  'owner', '作成したユーザーは owner になる'
);
select is(
  (select count(*)::int from public.categories where household_id = (select household_a from ids)),
  9, '初期カテゴリが9件作られる'
);
select is(
  (select display_name from public.users where id = '11111111-1111-4111-8111-111111111111'),
  'ユーザーA', '表示名は Google の名前から取る'
);
select is(
  (select display_name from public.users where id = '22222222-2222-4222-8222-222222222222'),
  'b', '名前がなければメールアドレスの @ より前を使う'
);

-- ------------------------------------------------------------
-- ユーザーAとしてログイン
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.users), 1, 'users は本人の行だけ見える');
select is((select count(*)::int from public.households), 1, '自分の世帯だけ見える');
select is(
  (select id from public.households), (select household_a from ids), '見える世帯は自分の世帯'
);
select is((select count(*)::int from public.household_members), 1, '他の世帯のメンバーは見えない');
select is((select count(*)::int from public.categories), 9, '他の世帯のカテゴリは見えない');
select is((select count(*)::int from public.subscriptions), 1, '他の世帯のサブスクは見えない（テストデータも含む）');
select is((select name from public.subscriptions), 'Aのサブスク', '見えるのは自分の世帯のサブスク');

select lives_ok(
  $$ insert into public.subscriptions (household_id, name, amount, billing_cycle, billing_rule, next_billing_date)
     select household_a, 'Aの追加', 500, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 10}'::jsonb, '2026-11-10'::date from ids $$,
  '自分の世帯にはサブスクを追加できる'
);
select throws_ok(
  $$ insert into public.subscriptions (household_id, name, amount, billing_cycle, billing_rule, next_billing_date)
     select household_b, '侵入', 500, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 10}'::jsonb, '2026-11-10'::date from ids $$,
  '42501', null, '他の世帯にはサブスクを追加できない'
);
with updated as (
  update public.subscriptions set name = '書き換え' where name = 'Bのサブスク' returning 1
)
select is((select count(*)::int from updated), 0, '他の世帯のサブスクは更新できない');
with deleted as (
  delete from public.subscriptions where name = 'Bのサブスク' returning 1
)
select is((select count(*)::int from deleted), 0, '他の世帯のサブスクは削除できない');
select throws_ok(
  $$ update public.subscriptions set household_id = (select household_b from ids) where name = 'Aのサブスク' $$,
  '42501', null, '自分のサブスクを他の世帯に移せない'
);
select throws_ok(
  $$ insert into public.categories (household_id, name, color)
     select household_b, '侵入', '#000000' from ids $$,
  '42501', null, '他の世帯にはカテゴリを追加できない'
);
select throws_ok(
  $$ insert into public.job_runs (job, started_at, status) values ('daily', now(), 'success') $$,
  '42501', null, '定期実行ログは画面から書き込めない'
);
select throws_ok(
  $$ select * from public.allowed_emails $$,
  '42501', null, '許可メールの一覧は画面から読めない'
);

reset role;

-- ------------------------------------------------------------
-- 未ログイン（anon）
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::int from public.subscriptions)
    + (select count(*)::int from public.households)
    + (select count(*)::int from public.categories)
    + (select count(*)::int from public.users)
    + (select count(*)::int from public.job_runs),
  0, '未ログインでは何も読めない'
);

reset role;

-- ------------------------------------------------------------
-- データベースの制約（postgres の権限で確認）
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.subscriptions (household_id, name, category_id, amount, billing_cycle, billing_rule, next_billing_date)
     select household_a, '他世帯のカテゴリ',
       (select id from public.categories where household_id = (select household_b from ids) limit 1),
       500, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 1}'::jsonb, '2026-11-01'::date from ids $$,
  '23503', null, '他の世帯のカテゴリは参照できない'
);
select throws_ok(
  $$ insert into public.subscriptions (household_id, name, amount, billing_cycle, billing_rule, next_billing_date)
     select household_a, '小数の円', 100.5, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 1}'::jsonb, '2026-11-01'::date from ids $$,
  '23514', null, '円の金額は整数だけ'
);
select throws_ok(
  $$ insert into public.subscriptions (household_id, name, amount, billing_cycle, billing_rule, next_billing_date, url)
     select household_a, '危険なURL', 100, 'monthly'::public.billing_cycle, '{"cycle": "monthly", "day": 1}'::jsonb, '2026-11-01'::date, 'javascript:alert(1)' from ids $$,
  '23514', null, 'URL は http:// か https:// だけ'
);

-- ------------------------------------------------------------
-- ユーザー作成前のフック（許可メールのみ登録できる）
-- ------------------------------------------------------------
insert into public.allowed_emails (email) values ('allowed@example.com');

select is(
  public.hook_before_user_created('{"user": {"email": "allowed@example.com"}}'),
  '{}'::jsonb, '許可メールは登録できる'
);
select is(
  public.hook_before_user_created('{"user": {"email": "Allowed@Example.com"}}'),
  '{}'::jsonb, '大文字小文字が違っても許可メールとして扱う'
);
select is(
  public.hook_before_user_created('{"user": {"email": "stranger@example.com"}}') -> 'error' ->> 'http_code',
  '403', '許可メール以外は拒否する'
);

select * from finish();
rollback;

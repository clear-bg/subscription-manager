-- 開発用のテストデータ（設計書 9.3）。`npx supabase db reset` で作り直せる。
-- 実際の契約内容や個人のデータは入れない。金額・請求日は架空のもの。
-- 日付は 2026年10月末時点を想定している（過ぎた請求日は定期実行で次に進む）。

-- ログインを許可するメールアドレス（開発用）
insert into public.allowed_emails (email) values ('dev@example.com');

-- 開発用ユーザー。auth.users に入れると、トリガーで世帯と初期カテゴリが作られる
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@example.com', '', now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "開発ユーザー"}',
  now(), now(), '', '', '', ''
);

-- サブスク：扱いにくいケースを含める
do $$
declare
  hid uuid;
begin
  select household_id into hid
  from public.household_members
  where user_id = '00000000-0000-4000-8000-000000000001';

  insert into public.subscriptions (
    household_id, name, category_id, currency, amount, is_variable, is_manual_purchase,
    billing_cycle, billing_rule, next_billing_date, status, end_date, resume_date,
    usage_frequency, trial_end_date, started_at, url, memo
  )
  select
    hid, s.name, c.id, s.currency, s.amount, s.is_variable, s.is_manual_purchase,
    s.billing_cycle::public.billing_cycle, s.billing_rule::jsonb, s.next_billing_date::date,
    s.status::public.subscription_status, s.end_date::date, s.resume_date::date,
    s.usage_frequency::public.usage_frequency, s.trial_end_date::date, s.started_at::date,
    s.url, s.memo
  from (values
    -- 毎月31日請求（2月・4月などは月末）
    ('Netflix', '動画', 'JPY', 1590, false, false, 'monthly', '{"cycle": "monthly", "day": 31}', '2026-10-31', 'active', null, null, 'often', null, '2024-05-31', 'https://www.netflix.com/', '31日請求のテスト'),
    -- 毎月1日（年またぎで翌年1月になる）
    ('Spotify', '音楽', 'JPY', 1080, false, false, 'monthly', '{"cycle": "monthly", "day": 1}', '2026-11-01', 'active', null, null, 'often', null, '2023-01-01', null, null),
    -- 2月29日の年額（うるう年以外は2月28日）
    ('Amazonプライム', 'その他', 'JPY', 5900, false, false, 'yearly', '{"cycle": "yearly", "month": 2, "day": 29}', '2027-02-28', 'active', null, null, 'sometimes', null, '2024-02-29', null, '2月29日の年額のテスト'),
    -- 週額（毎週月曜）
    ('週刊マンガアプリ', 'その他', 'JPY', 120, false, false, 'weekly', '{"cycle": "weekly", "weekday": 1}', '2026-11-02', 'active', null, null, 'often', null, '2026-06-01', null, null),
    -- 3か月ごと（基準日が31日）
    ('レンタルサーバー', 'クラウド・ソフト', 'JPY', 3300, false, false, 'other', '{"cycle": "other", "intervalMonths": 3, "anchorDate": "2026-01-31"}', '2026-10-31', 'active', null, null, 'sometimes', null, '2026-01-31', null, '3か月ごとのテスト'),
    -- USD建て
    ('ChatGPT Plus', 'クラウド・ソフト', 'USD', 20.00, false, false, 'monthly', '{"cycle": "monthly", "day": 15}', '2026-11-15', 'active', null, null, 'often', null, '2025-03-15', null, 'USD建てのテスト'),
    -- 金額が変動する固定費（光熱費）。金額は目安額
    ('電気代', '住居・光熱', 'JPY', 8000, true, false, 'monthly', '{"cycle": "monthly", "day": 25}', '2026-11-25', 'active', null, null, null, null, null, null, '目安額'),
    ('水道代', '住居・光熱', 'JPY', 4500, true, false, 'monthly', '{"cycle": "monthly", "day": 20}', '2026-11-20', 'active', null, null, null, null, null, null, '目安額'),
    -- 自分で購入する毎月のもの（請求日は目安日）
    ('コンタクトレンズ', 'その他', 'JPY', 3000, true, true, 'monthly', '{"cycle": "monthly", "day": 10}', '2026-11-10', 'active', null, null, null, null, null, null, '自分で購入するもののテスト'),
    -- 無料トライアル中
    ('Disney+', '動画', 'JPY', 1140, false, false, 'monthly', '{"cycle": "monthly", "day": 5}', '2026-11-05', 'active', null, null, 'sometimes', '2026-11-04', '2026-10-05', null, 'トライアル中'),
    -- 解約手続き済みで利用終了日が近い
    ('Hulu', '動画', 'JPY', 1026, false, false, 'monthly', '{"cycle": "monthly", "day": 3}', '2026-11-03', 'cancel_scheduled', '2026-11-02', null, 'rarely', null, '2025-08-03', null, '解約手続き済み'),
    -- 一時停止中
    ('スポーツジム', 'その他', 'JPY', 7700, false, false, 'monthly', '{"cycle": "monthly", "day": 27}', '2026-12-27', 'paused', null, '2026-12-01', 'rarely', null, '2025-04-27', null, '一時停止中'),
    -- 解約検討中
    ('YouTube Premium', '動画', 'JPY', 1280, false, false, 'monthly', '{"cycle": "monthly", "day": 12}', '2026-11-12', 'considering', null, null, 'rarely', null, '2024-11-12', null, null),
    -- 解約済み
    ('Apple Music', '音楽', 'JPY', 1080, false, false, 'monthly', '{"cycle": "monthly", "day": 8}', '2026-09-08', 'cancelled', '2026-09-07', null, null, null, '2025-01-08', null, null),
    -- カテゴリ未設定（未入力項目の表示のテスト）
    ('カテゴリ未設定のサービス', null, 'JPY', 500, false, false, 'monthly', '{"cycle": "monthly", "day": 18}', '2026-11-18', 'active', null, null, null, null, null, null, null)
  ) as s (
    name, category_name, currency, amount, is_variable, is_manual_purchase,
    billing_cycle, billing_rule, next_billing_date, status, end_date, resume_date,
    usage_frequency, trial_end_date, started_at, url, memo
  )
  left join public.categories c on c.household_id = hid and c.name = s.category_name;
end;
$$;

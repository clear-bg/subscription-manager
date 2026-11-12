# CLAUDE.md

サブスク・固定費管理Webアプリ。個人開発で、利用者は当面は自分のみ。

## 最初に読むもの
- 設計書：`docs/design.md`。仕様・データ設計・決定事項はすべてここが正。
- 実装中に設計と違う判断が必要になったら、勝手に実装で変えずに相談する。決まった内容は設計書にも反映する（変更履歴に1行追加）。

## 現在の段階
- 設計書 9.1 の **段階1（MVP）** を実装中。
- 段階1の範囲：Googleログイン（許可メールのみ）、世帯の自動作成、サブスクの登録・編集・一覧、請求日のルール（3.11）、月額・年額合計の表示、請求日前のDiscord通知、定期実行ログ（停止対策を含む）、セキュリティの最優先項目（7.1〜7.3）。
- 段階2以降の機能は先回りして作らない。ただしデータ設計（household_id、transactions など）は最終形に沿って作る。

## 進め方
- 説明は日本語で、専門用語には短い補足を付ける。
- 作業は小さな単位に区切り、各単位の前に「何をするか」を説明して確認を取る。終わったら結果を短く報告する。
- 依存パッケージの追加、ファイルの大量生成、データベースのリセットなど影響の大きい操作は、実行前に確認する。

## 技術構成
- TypeScript（strict）＋ Next.js（App Router。サーバー処理は Route Handlers / Server Actions）
- Supabase（PostgreSQL、Auth、RLS）。開発はローカルの Supabase CLI（Docker が必要）、本番はクラウド
- Zod（入力チェック。画面とサーバーで同じ定義を使う）、Recharts（グラフ）、Vitest（テスト）
- 見た目は Tailwind CSS（設計書 v0.11 で確定）
- 定期実行：Vercel Cron（毎朝8時 JST ＝ UTC 23:00。設定ファイルにコメントを残す）

## 必ず守るルール

### 日付と時刻（設計書 9.2）
- 日付の判定・計算はすべて日本時間（Asia/Tokyo）。「今日」は共通の関数から取り、`new Date()` を直接使って日付を判定しない。
- 日付だけの項目は `date`、日時は `timestamptz`。
- 月末・うるう年・年またぎの計算にはテストを書く。

### 金額（設計書 5.0）
- 円は整数（`integer`）。外貨の金額・為替レート・手数料率は `numeric`。浮動小数点型は使わない。
- 外貨から円への換算は1円未満を四捨五入。

### データベース（設計書 7.1、9.3、9.5、9.7）
- テーブルの作成・変更は `supabase/migrations/` のマイグレーションファイルで行う。管理画面から直接変更しない。
- 新しいテーブルを作るときは、同じマイグレーションで RLS の有効化とポリシー作成を必ず行う。household_id を持たないテーブルは設計書 5.0 の表に従う。
- ビューは `security_invoker = true` で作る。
- マイグレーションを変えたら TypeScript の型を生成し直してコミットする。
- サブスク請求の支出記録は `(subscription_id, billing_date)`（請求予定日）の一意制約で重複を防ぐ。`date` は実際の支払日で、後から修正されることがある。

### セキュリティ（設計書 7.2〜7.5）
- リポジトリは公開。実際の契約内容・個人のメールアドレス・秘密情報をコミットしない。コミットは GitHub の noreply アドレスで行う（設計書 7.2）。
- 秘密情報（service_role key、Discord Webhook URL、CRON_SECRET など）をコードに書かない。ログやエラーメッセージにも出さない。
- Discord Webhook URL は環境変数で管理し、データベースには保存しない。
- `NEXT_PUBLIC_` を付けてよいのは Supabase の URL と anon key だけ。
- `.env*` はコミットしない（`.env.example` だけはコミットしてよい）。
- 定期実行用の API は `CRON_SECRET` を確認してから処理する。
- `dangerouslySetInnerHTML` は使わない。URL入力は `http://` と `https://` のみ受け付ける。

### テストデータ（設計書 9.3）
- 開発はテストデータで行う。投入用ファイル（`supabase/seed.sql` など）で、いつでも作り直せるようにする。
- 扱いにくいケース（31日請求、2月29日の年額、USD建て、光熱費、トライアル中、解約手続き済み など。一覧は 9.3）を含める。
- 実際の契約内容や個人のデータはリポジトリに入れない。

## Git
- main に直接コミットしない。作業ごとにブランチを切り、PR にする。
- コミットメッセージは `種類: 日本語の説明` の形（例：`feat: サブスク一覧画面を追加`、`fix: 月末の請求日計算を修正`、`docs: 設計書を更新`）。

## CI
- `.github/workflows/ci.yml`：PR と main への反映のたびに、型チェック・lint・Vitest・RLS のテスト・型の生成の確認を実行する（設計書 9.8）

## よく使うコマンド
- `npm run dev`：開発サーバーを起動。ブラウザでは **http://127.0.0.1:3000** で開く（localhost だと Supabase のログインの戻り先と Cookie が合わない）。`-H 127.0.0.1` で待ち受けるので、WSL で動かして Windows のブラウザから開くときもこのアドレスで届く
- `npm run build`：本番用にビルド
- `npm run lint`：ESLint でチェック
- `npm run typecheck`：TypeScript の型チェック
- `npm test`：Vitest でテストを実行（`npm run test:watch` で変更を監視）
- `npx supabase start` / `npx supabase stop`：ローカルの Supabase を起動・停止（Docker が必要）
- `npx supabase status`：ローカルの URL や鍵を表示（`.env.local` に設定する値）
- `npm run db:reset`：ローカルのデータベースを作り直す（マイグレーションと `supabase/seed.sql` を適用）
- `npm run db:test`：RLS などデータベースのテスト（`supabase/tests/`、pgTAP）を実行
- `npm run db:types`：テーブル定義から TypeScript の型（`src/lib/supabase/database.types.ts`）を生成。マイグレーションを変えたら実行してコミットする
- 定期実行をローカルで試す：`curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/daily`（`CRON_SECRET` は `.env.local` の値。同じ日の2回目以降は通知を送らず skipped になる）
- 環境変数は `.env.example` を `.env.local` にコピーして設定する。Google ログインの ID とシークレットは `supabase/.env`、自分の許可メールは `supabase/seed.local.sql` に書く（どちらも Git に入らない）

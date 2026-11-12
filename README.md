# サブスク・固定費管理

契約中のサブスクリプションや固定費をまとめて管理し、「毎月いくら払っているか」を見えるようにする個人用の Web アプリです。請求日の前に Discord へ通知して、解約し忘れや無駄な支出を減らします。

仕様・データ設計・決定事項は [設計書（docs/design.md）](docs/design.md) にまとめています。

## 主な機能（段階1）

- Google ログイン（許可したメールアドレスだけ）と世帯の自動作成
- サブスク・固定費の登録・編集・一覧、月額・年額の合計
- 請求日のルール（毎月31日、2月29日の年額、毎週、3か月ごと など）
- 請求日前の Discord 通知と、毎朝の定期実行（実行ログ付き）

## 技術構成

| 区分 | 使っているもの |
|---|---|
| 言語・フレームワーク | TypeScript（strict）、Next.js（App Router） |
| データベース・認証 | Supabase（PostgreSQL、Auth、RLS） |
| 見た目 | Tailwind CSS |
| 入力チェック・テスト | Zod、Vitest、pgTAP（RLS のテスト） |
| 本番環境 | Vercel（Vercel Cron で毎朝 8 時に定期実行）、Supabase |
| CI | GitHub Actions（型チェック・lint・テスト・RLS のテスト・型の生成の確認） |

## 開発の始め方

必要なもの：Node.js 24、Docker（ローカルの Supabase を動かすため）

```bash
npm ci
cp .env.example .env.local   # 値は npx supabase status で確認して入れる
npx supabase start           # ローカルの Supabase を起動
npm run db:reset             # マイグレーションとテストデータを適用
npm run dev                  # http://127.0.0.1:3000 で開く（localhost ではなく 127.0.0.1）
```

- Google ログインを試すには、開発用の OAuth クライアントの ID とシークレットを `supabase/.env` に、ログインを許可する自分のメールアドレスを `supabase/seed.local.sql` に書きます。どちらも Git には入りません
- 開発はテストデータ（`supabase/seed.sql`）で行います。実際の契約内容はリポジトリに入れません

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run typecheck` / `npm run lint` / `npm test` | 型チェック / lint / テスト |
| `npm run db:reset` | ローカルのデータベースを作り直す |
| `npm run db:test` | RLS などデータベースのテスト |
| `npm run db:types` | テーブル定義から TypeScript の型を生成 |

## セキュリティについて

- 秘密情報（API キー、Webhook URL など）は環境変数で管理し、リポジトリには入れていません
- すべてのテーブルで RLS（行レベルのアクセス制御）を有効にしています
- 詳しくは設計書の「7. セキュリティ」を参照してください

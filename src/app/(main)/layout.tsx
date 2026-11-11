import Link from "next/link";
import { signOut } from "@/lib/auth/actions";

// ログイン後の画面の共通レイアウト。ナビゲーションの完成形（サイドバー・下部タブ）は段階4で作る
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            サブスク・固定費管理
          </Link>
          <Link href="/subscriptions" className="text-zinc-600 hover:underline dark:text-zinc-300">
            一覧
          </Link>
        </nav>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ログアウト
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}

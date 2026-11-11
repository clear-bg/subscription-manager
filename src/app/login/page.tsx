import { Suspense } from "react";
import { signInWithGoogle } from "@/lib/auth/actions";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "このアカウントではログインできません。許可されたアカウントか確認してください。",
  login_failed: "ログインに失敗しました。もう一度お試しください。",
};

async function LoginError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">サブスク・固定費管理</h1>
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Google でログイン
          </button>
        </form>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

// 仮のトップページ（ダッシュボードは段階4）
async function CurrentUser() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: user }, { data: household }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", userId).single(),
    supabase.from("households").select("name").limit(1).single(),
  ]);

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-300">
      {user?.display_name ?? "（不明）"} さん（世帯：{household?.name ?? "（不明）"}）
    </p>
  );
}

export default function Home() {
  return (
    <>
      <Suspense fallback={<p className="text-sm text-zinc-500">読み込み中…</p>}>
        <CurrentUser />
      </Suspense>
      <Link href="/subscriptions" className="text-sm text-zinc-900 underline dark:text-zinc-100">
        サブスク・固定費の一覧へ
      </Link>
    </>
  );
}

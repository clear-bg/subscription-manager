"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Google ログインを始める。Google の画面へ移動し、/auth/callback に戻ってくる */
export async function signInWithGoogle() {
  // Server Action の POST には必ず Origin ヘッダーが付く。
  // 戻り先は Supabase 側の許可リスト（config.toml の additional_redirect_urls）でも確認される
  const origin = (await headers()).get("origin");
  if (!origin) redirect("/login?error=login_failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) redirect("/login?error=login_failed");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

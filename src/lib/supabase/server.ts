import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * サーバー（Server Component / Server Action / Route Handler）で使う Supabase クライアント。
 * ログイン中のユーザーの権限で動くため RLS が効く。リクエストごとに作り直す
 */
export async function createClient() {
  // ログイン状態の確認で現在時刻を使うため、事前レンダリングせずリクエストごとに実行する
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component からは Cookie を書けない。セッションの更新は proxy で行うので無視してよい
        }
      },
    },
  });
}

// ブラウザに渡してよい Supabase の設定（URL と anon key だけ。CLAUDE.md）
// NEXT_PUBLIC_ の値はビルド時に埋め込まれるため、process.env.NAME の形で直接参照する

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL が設定されていません");
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません");
  return value;
}

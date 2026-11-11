import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google ログインから戻ってきたときの処理。受け取ったコードをセッションに交換する。
 * 許可メール以外で新規登録しようとした場合は、フックに拒否されて error 付きで戻ってくる
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = requestOrigin(request);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  // 戻ってきたエラーの文言はそのまま表示せず、決まったメッセージにする
  const reason = searchParams.get("error") ? "denied" : "login_failed";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}

/**
 * ブラウザが実際に開いている URL のオリジン。
 * 開発中は request.nextUrl が localhost に置き換わることがあり、127.0.0.1 で開いていると Cookie が別扱いになるため、
 * Host ヘッダーから組み立てる
 */
function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** ログインしていなくても開けるパス */
const PUBLIC_PATHS = ["/login", "/auth/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => (path.endsWith("/") ? pathname.startsWith(path) : pathname === path));
}

/**
 * リクエストごとにログイン状態を確認・更新し、未ログインならログイン画面へ送る（設計書 7.1）。
 * src/proxy.ts から呼ぶ
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // ログイン情報の Cookie を含む応答を CDN などにキャッシュさせない
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() はトークンの署名を検証する。createServerClient との間に処理を挟まない
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }
    return redirectKeepingCookies(request, response, "/login");
  }

  if (isLoggedIn && pathname === "/login") {
    return redirectKeepingCookies(request, response, "/");
  }

  return response;
}

/** 更新されたセッションの Cookie とキャッシュ禁止のヘッダーを失わないようにリダイレクトする */
function redirectKeepingCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}

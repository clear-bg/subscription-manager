"use client";

import { useEffect } from "react";

/**
 * Supabase Auth がログイン失敗時に URL の # 以降に付けるエラー情報（#error=...）を消す。
 * # 以降はサーバーに届かないため、ブラウザ側で取り除く
 */
export function ClearAuthHash() {
  useEffect(() => {
    if (window.location.hash.includes("error=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  return null;
}

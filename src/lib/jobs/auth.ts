import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 定期実行 API の認証（設計書 7.3）。Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を付けて呼ぶ。
 * 比較にかかる時間から秘密の値を推測されないよう、ハッシュにしてから一定時間で比較する
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

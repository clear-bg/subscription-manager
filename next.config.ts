import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中は Supabase のログインの戻り先に合わせて http://127.0.0.1:3000 で開くため、
  // 開発サーバーのリソース（HMR など）へのアクセスを 127.0.0.1 からも許可する
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

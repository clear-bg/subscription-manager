import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClearAuthHash } from "./clear-auth-hash";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "サブスク・固定費管理",
  description: "サブスク・固定費の管理アプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClearAuthHash />
        {children}
      </body>
    </html>
  );
}

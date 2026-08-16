import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scholars AI 控制台",
  description: "选题、采集与调度控制台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="app-shell">
          <header className="topbar">
            <Link className="brand" href="/">SCHOLARS<span>·AI</span></Link>
            <nav className="nav-links" aria-label="主导航">
              <Link href="/topics">选题看板</Link>
              <Link href="/articles">文章审阅</Link>
              <Link href="/metrics">数据回流</Link>
              <Link href="/sources">信源</Link>
              <Link href="/settings">调度设置</Link>
            </nav>
            <span className="env-pill">M3 · FEEDBACK LOOP</span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

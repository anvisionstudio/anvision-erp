import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Anvision ERP", description: "Anvision Studio 公司內部 ERP 系統" };
// 不鎖定縮放（無障礙）
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#172554" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main" className="sr-only z-nav rounded-md bg-primary px-4 py-2 text-primary-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          跳到主要內容
        </a>
        {children}
      </body>
    </html>
  );
}

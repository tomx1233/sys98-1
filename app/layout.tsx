import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { LangProvider } from "@/components/LangProvider";

export const metadata: Metadata = {
  title: { default: "system98", template: "%s — system98" },
  description: "system98 — small tools, chilled out.",
  icons: { icon: "/system98-logo.svg", apple: "/system98-logo-512.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Applies the saved theme before first paint (same key as system98.js) so there's no light/dark flash.
const themeInit = `try{var t=localStorage.getItem('s98-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;700&family=Fira+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/system98.css" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
        <Script src="/presence.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

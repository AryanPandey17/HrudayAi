import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { APP_NAME } from "@/lib/config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} - coronary risk explorer`,
  description:
    "Educational decision-support prototype: predicted CAD and LAD / LCX / RCA stenosis probabilities mapped onto an interactive 3D heart.",
};

// Applies a saved light/dark choice before first paint; otherwise the system preference wins.
const THEME_SCRIPT = `try{const t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch{}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

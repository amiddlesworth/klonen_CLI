import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/AppShell";
import { SkipLink } from "@/components/shell/SkipLink";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme";
import { BRAND } from "@/lib/brand";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

/** Inter variable (opsz 14–32, wght 100–900), self-hosted from src/app/fonts (SIL OFL 1.1). */
const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  // Relative canonical and Open Graph URLs resolve against the configured origin, never the Host header.
  metadataBase: new URL(SITE_URL),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

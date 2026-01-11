import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RTLProvider } from "@/lib/i18n/rtl-provider";
import { QueryProvider } from "@/lib/query/provider";
import { headers } from "next/headers";
import { getLocaleFromHeaders, getDirectionFromLocale } from "@/lib/i18n/server-locale";

const outfit = Outfit({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Plan.krd | Enterprise Task Management",
  description:
    "Advanced AI-powered task management platform for teams. Organize, collaborate, and achieve more with intelligent workflows.",
  keywords: ["task management", "project management", "AI", "collaboration", "productivity"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Detect initial locale from headers for SSR
  const headersList = await headers();
  const initialLocale = getLocaleFromHeaders(headersList);
  const initialDirection = getDirectionFromLocale(initialLocale);

  return (
    <html lang={initialLocale} dir={initialDirection} suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <QueryProvider>
          <RTLProvider initialLocale={initialLocale}>
            {children}
          </RTLProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

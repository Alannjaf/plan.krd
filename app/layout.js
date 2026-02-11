import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export const metadata = {
  title: {
    default: "Talent KRD",
    template: "%s | Talent KRD",
  },
  description:
    "Tech, AI & Freelancing from Kurdistan — practical guides for professionals in Iraq and the Middle East",
  keywords: [
    "freelancing",
    "AI",
    "Kurdistan",
    "remote work",
    "tech",
    "Iraq",
    "Middle East",
    "career",
    "online income",
  ],
  authors: [{ name: "Talent KRD" }],
  metadataBase: new URL("https://talent.krd"),
  openGraph: {
    title: "Talent KRD",
    description:
      "Tech, AI & Freelancing from Kurdistan — practical guides for professionals in Iraq and the Middle East",
    url: "https://talent.krd",
    siteName: "Talent KRD",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@talentkrd",
    creator: "@talentkrd",
  },
  alternates: {
    types: {
      "application/rss+xml": "https://talent.krd/index.xml",
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (theme) {
                  document.documentElement.setAttribute('data-theme', theme);
                } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Header />
        <main className="main">{children}</main>
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  );
}

import { getAllArticles } from "@/lib/db";

export const revalidate = 60;

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const articles = await getAllArticles();

  const items = articles
    .map(
      (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>https://talent.krd/posts/${a.slug}</link>
      <description>${escapeXml(a.summary || "")}</description>
      <pubDate>${a.published_at ? new Date(a.published_at).toUTCString() : ""}</pubDate>
      <guid>https://talent.krd/posts/${a.slug}</guid>
      ${a.categories ? a.categories.map((c) => `<category>${escapeXml(c)}</category>`).join("\n      ") : ""}
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Talent KRD</title>
    <link>https://talent.krd</link>
    <description>Tech, AI &amp; Freelancing from Kurdistan</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://talent.krd/index.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

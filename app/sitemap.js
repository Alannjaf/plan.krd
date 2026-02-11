import { getAllArticles, getAllTags } from "@/lib/db";

export default async function sitemap() {
  const articles = await getAllArticles();
  const tags = await getAllTags();

  const staticPages = [
    { url: "https://talent.krd", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://talent.krd/posts", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: "https://talent.krd/about", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: "https://talent.krd/contact", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: "https://talent.krd/tags", lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: "https://talent.krd/search", lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const articlePages = articles.map((a) => ({
    url: `https://talent.krd/posts/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const tagPages = tags.map((tag) => ({
    url: `https://talent.krd/tags/${encodeURIComponent(tag.toLowerCase())}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticPages, ...articlePages, ...tagPages];
}

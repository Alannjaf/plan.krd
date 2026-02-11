import { getArticlesForSearch } from "@/lib/db";
import SearchClient from "./SearchClient";

export const revalidate = 60;

export const metadata = {
  title: "Search",
  description: "Search articles on Talent KRD",
};

export default async function SearchPage() {
  const articles = await getArticlesForSearch();

  // Prepare lightweight search index (no full content sent to client)
  const searchIndex = articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    tags: a.tags,
    // First 500 chars of content for search matching
    snippet: a.content.substring(0, 500),
  }));

  return (
    <>
      <h1 className="section-title">Search</h1>
      <SearchClient articles={searchIndex} />
    </>
  );
}

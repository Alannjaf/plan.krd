import { getAllTags, getArticlesByTag } from "@/lib/db";
import PostCard from "@/components/PostCard";
import Link from "next/link";

export const revalidate = 60;

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({ tag: tag.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `Tag: ${decoded}`,
    description: `Articles tagged with "${decoded}" on Talent KRD`,
  };
}

export default async function TagPage({ params }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const articles = await getArticlesByTag(decoded);

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>&raquo;</span>
        <Link href="/tags">Tags</Link>
        <span>&raquo;</span>
        <span>{decoded}</span>
      </div>
      <h1 className="section-title">Tag: {decoded}</h1>
      {articles.length === 0 ? (
        <p>No articles found with this tag.</p>
      ) : (
        <ul className="post-list">
          {articles.map((article) => (
            <PostCard key={article.id} article={article} />
          ))}
        </ul>
      )}
    </>
  );
}

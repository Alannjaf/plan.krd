import Link from "next/link";
import { estimateReadingTime } from "@/lib/markdown";

export default function PostCard({ article }) {
  const readTime = estimateReadingTime(article.summary || "");
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <li className="post-entry">
      <h2 className="post-entry-title">
        <Link href={`/posts/${article.slug}`}>{article.title}</Link>
      </h2>
      <div className="post-meta">
        {date && <span>{date}</span>}
        <span>{article.author}</span>
      </div>
      {article.summary && <p className="post-summary">{article.summary}</p>}
      {article.tags && article.tags.length > 0 && (
        <div className="tag-list">
          {article.tags.slice(0, 5).map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}
              className="tag"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

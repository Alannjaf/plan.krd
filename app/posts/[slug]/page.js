import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug, getAllArticles } from "@/lib/db";
import { markdownToHtml, estimateReadingTime, extractHeadings } from "@/lib/markdown";

export const revalidate = 60;

export async function generateStaticParams() {
  const articles = await getAllArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    authors: [{ name: article.author }],
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      publishedTime: article.published_at,
      authors: [article.author],
      tags: article.tags,
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.summary,
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const html = await markdownToHtml(article.content);
  const readTime = estimateReadingTime(article.content);
  const headings = extractHeadings(article.content);
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  // Get adjacent articles for navigation
  const allArticles = await getAllArticles();
  const idx = allArticles.findIndex((a) => a.slug === slug);
  const prev = idx < allArticles.length - 1 ? allArticles[idx + 1] : null;
  const next = idx > 0 ? allArticles[idx - 1] : null;

  // Add IDs to headings in HTML for anchor links
  let processedHtml = html;
  for (const h of headings) {
    const tag = `h${h.level}`;
    // Replace first occurrence of this heading without an id
    processedHtml = processedHtml.replace(
      new RegExp(`<${tag}>(${escapeRegex(h.text)})</${tag}>`),
      `<${tag} id="${h.id}">${h.text}</${tag}>`
    );
  }

  return (
    <article>
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>&raquo;</span>
        <Link href="/posts">Posts</Link>
        <span>&raquo;</span>
        <span>{article.title}</span>
      </div>

      <div className="post-header">
        <h1>{article.title}</h1>
        <div className="post-meta">
          {date && <span>{date}</span>}
          <span>{article.author}</span>
          <span>{readTime} min read</span>
          <span>{article.content.trim().split(/\s+/).length} words</span>
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="tag-list">
            {article.tags.map((tag) => (
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
      </div>

      {headings.length > 0 && (
        <nav className="toc">
          <div className="toc-title">Table of Contents</div>
          <ul>
            {headings.map((h, i) => (
              <li key={i} className={h.level === 3 ? "toc-h3" : ""}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div
        className="post-content"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      <nav className="post-nav">
        {prev ? (
          <Link href={`/posts/${prev.slug}`} className="prev">
            <span className="post-nav-label">&larr; Previous</span>
            {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/posts/${next.slug}`} className="next">
            <span className="post-nav-label">Next &rarr;</span>
            {next.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

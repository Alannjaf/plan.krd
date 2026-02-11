"use client";

import { useState } from "react";
import Link from "next/link";

export default function SearchClient({ articles }) {
  const [query, setQuery] = useState("");

  const results = query.length < 2
    ? []
    : articles.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.snippet.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        );
      });

  return (
    <>
      <input
        type="text"
        className="search-input"
        placeholder="Search articles..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {query.length >= 2 && (
        <ul className="post-list search-results">
          {results.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>
              No results found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((a) => (
              <li key={a.slug} className="post-entry">
                <h2 className="post-entry-title">
                  <Link href={`/posts/${a.slug}`}>{a.title}</Link>
                </h2>
                {a.summary && <p className="post-summary">{a.summary}</p>}
                {a.tags && a.tags.length > 0 && (
                  <div className="tag-list">
                    {a.tags.slice(0, 5).map((tag) => (
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
            ))
          )}
        </ul>
      )}
    </>
  );
}

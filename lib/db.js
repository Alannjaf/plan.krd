import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export async function getAllArticles() {
  const rows = await sql`
    SELECT id, title, slug, summary, tags, categories, author, published_at
    FROM articles
    WHERE is_published = true
    ORDER BY published_at DESC
  `;
  return rows;
}

export async function getArticleBySlug(slug) {
  const rows = await sql`
    SELECT * FROM articles
    WHERE slug = ${slug} AND is_published = true
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getArticlesByTag(tag) {
  const rows = await sql`
    SELECT id, title, slug, summary, tags, categories, author, published_at
    FROM articles
    WHERE is_published = true AND ${tag} = ANY(tags)
    ORDER BY published_at DESC
  `;
  return rows;
}

export async function getAllTags() {
  const rows = await sql`
    SELECT DISTINCT unnest(tags) AS tag
    FROM articles
    WHERE is_published = true
    ORDER BY tag
  `;
  return rows.map((r) => r.tag);
}

export async function getAllSlugs() {
  const rows = await sql`
    SELECT slug FROM articles WHERE is_published = true
  `;
  return rows.map((r) => r.slug);
}

export async function getArticlesForSearch() {
  const rows = await sql`
    SELECT title, slug, summary, content, tags
    FROM articles
    WHERE is_published = true
    ORDER BY published_at DESC
  `;
  return rows;
}

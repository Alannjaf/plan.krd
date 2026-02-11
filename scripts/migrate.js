const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_mxqIh80FEcwP@ep-calm-surf-aeqrsmc7.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function migrate() {
  const sql = neon(DATABASE_URL);

  console.log("Creating articles table...");
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      summary TEXT,
      tags TEXT[] DEFAULT '{}',
      categories TEXT[] DEFAULT '{}',
      author TEXT DEFAULT 'Talent KRD',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      is_published BOOLEAN DEFAULT true
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published)`;

  console.log("Table created.");

  const postsDir = path.join(__dirname, "..", "content", "posts");
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} articles to migrate.`);

  for (const file of files) {
    const filePath = path.join(postsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    const slug = file.replace(/\.md$/, "");
    const title = data.title || slug;
    const summary = data.description || "";
    const tags = data.tags || [];
    const categories = data.categories || [];
    const author = data.author || "Talent KRD";
    const publishedAt = data.date ? new Date(data.date).toISOString() : null;
    const isPublished = data.draft !== true;

    try {
      await sql`
        INSERT INTO articles (title, slug, content, summary, tags, categories, author, published_at, is_published)
        VALUES (${title}, ${slug}, ${content.trim()}, ${summary}, ${tags}, ${categories}, ${author}, ${publishedAt}, ${isPublished})
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          tags = EXCLUDED.tags,
          categories = EXCLUDED.categories,
          author = EXCLUDED.author,
          published_at = EXCLUDED.published_at,
          is_published = EXCLUDED.is_published,
          updated_at = NOW()
      `;
      console.log(`  Migrated: ${title}`);
    } catch (err) {
      console.error(`  Error migrating ${file}:`, err.message);
    }
  }

  console.log("Migration complete.");
}

migrate().catch(console.error);

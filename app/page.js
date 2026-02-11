import Link from "next/link";
import { getAllArticles } from "@/lib/db";
import PostCard from "@/components/PostCard";

export const revalidate = 60;

export default async function Home() {
  const articles = await getAllArticles();

  return (
    <>
      <section className="profile">
        <h1>Talent KRD</h1>
        <p>Tech, AI &amp; Freelancing from Kurdistan</p>
        <div className="profile-buttons">
          <Link href="/posts">Blog</Link>
          <Link href="/about">About</Link>
        </div>
        <div className="social-icons">
          <a href="https://twitter.com/talentkrd" target="_blank" rel="noopener noreferrer">Twitter</a>
          <a href="https://linkedin.com/company/talentkrd" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="https://github.com/talentkrd" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:hello@talent.krd">Email</a>
          <Link href="/index.xml">RSS</Link>
        </div>
      </section>

      <section>
        <h2 className="section-title">Recent Posts</h2>
        <ul className="post-list">
          {articles.map((article) => (
            <PostCard key={article.id} article={article} />
          ))}
        </ul>
      </section>
    </>
  );
}

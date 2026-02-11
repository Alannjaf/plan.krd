import { getAllArticles } from "@/lib/db";
import PostCard from "@/components/PostCard";

export const revalidate = 60;

export const metadata = {
  title: "Blog",
  description: "All articles on tech, AI, and freelancing from Kurdistan",
};

export default async function PostsPage() {
  const articles = await getAllArticles();

  return (
    <>
      <h1 className="section-title">All Posts</h1>
      <ul className="post-list">
        {articles.map((article) => (
          <PostCard key={article.id} article={article} />
        ))}
      </ul>
    </>
  );
}

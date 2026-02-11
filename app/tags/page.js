import Link from "next/link";
import { getAllTags } from "@/lib/db";

export const revalidate = 60;

export const metadata = {
  title: "Tags",
  description: "Browse all article tags on Talent KRD",
};

export default async function TagsPage() {
  const tags = await getAllTags();

  return (
    <>
      <h1 className="section-title">Tags</h1>
      <div className="tags-page">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/tags/${encodeURIComponent(tag.toLowerCase())}`}
            className="tag"
          >
            {tag}
          </Link>
        ))}
      </div>
    </>
  );
}

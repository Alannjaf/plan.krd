import Link from "next/link";

export const metadata = {
  title: "404 - Page Not Found",
};

export default function NotFound() {
  return (
    <div className="page-content" style={{ textAlign: "center", padding: "60px 0" }}>
      <h1>404</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
        This page could not be found.
      </p>
      <Link href="/">Go home</Link>
    </div>
  );
}

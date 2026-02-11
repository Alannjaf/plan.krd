import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        &copy; {new Date().getFullYear()}{" "}
        <Link href="/">Talent KRD</Link> &middot;{" "}
        <Link href="/index.xml" target="_blank">RSS</Link>
      </p>
    </footer>
  );
}

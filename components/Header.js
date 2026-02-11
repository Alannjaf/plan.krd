"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          Talent KRD
        </Link>
        <nav className="nav">
          <Link href="/posts">Blog</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/tags">Tags</Link>
          <Link href="/search">Search</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

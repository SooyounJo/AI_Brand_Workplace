import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="meta-label">
        aibrand
      </Link>
      <nav className="meta-nav" aria-label="Primary">
        <Link href="/" className="meta-label">
          Home
        </Link>
        <Link href="/about" className="meta-label">
          About
        </Link>
      </nav>
    </header>
  );
}

import Link from "next/link";

const ITEMS = [
  { date: "06 . 23", label: "Product Branding" },
  { date: "06 . 23", label: "Idol Branding" },
  { date: "06 . 23", label: "Exhibition Branding" },
];

export default function SideRail() {
  return (
    <aside className="side-rail" aria-label="Projects">
      <div className="side-rail__panel">
        <div className="side-rail__shimmer" aria-hidden="true" />
        <div className="side-rail__noise" aria-hidden="true" />
        <div className="side-rail__content">
          <nav className="side-rail__list">
            {ITEMS.map((item, i) => (
              <Link key={i} href="/about" className="side-rail__item">
                <span className="side-rail__date">{item.date}</span>
                <span className="side-rail__label">{item.label}</span>
              </Link>
            ))}
          </nav>
          <Link href="/about" className="cta cta--rail">
            New Project
          </Link>
        </div>
      </div>
    </aside>
  );
}

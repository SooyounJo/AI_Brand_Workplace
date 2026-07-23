import { useEffect, useRef } from "react";

/* Overlapping circles → SVG goo filter merges into one bumpy blob */
const BLOBS = [
  { x: 18, y: 50, s: 30, ry: 0.72 },
  { x: 32, y: 47, s: 34, ry: 0.68 },
  { x: 46, y: 51, s: 36, ry: 0.66 },
  { x: 60, y: 48, s: 34, ry: 0.7 },
  { x: 72, y: 50, s: 30, ry: 0.74 },
  { x: 26, y: 36, s: 18, ry: 0.88 },
  { x: 42, y: 64, s: 19, ry: 0.84 },
  { x: 54, y: 34, s: 17, ry: 0.92 },
  { x: 66, y: 66, s: 18, ry: 0.86 },
  { x: 36, y: 58, s: 16, ry: 0.9 },
  { x: 50, y: 40, s: 17, ry: 0.88 },
  { x: 14, y: 44, s: 15, ry: 0.95 },
  { x: 80, y: 49, s: 24, ry: 0.8 },
  { x: 88, y: 50, s: 22, ry: 1.05 },
  { x: 95, y: 26, s: 18, ry: 1.15 },
  { x: 96, y: 50, s: 23, ry: 1.45 },
  { x: 95, y: 74, s: 18, ry: 1.15 },
];

function GooFilter() {
  return (
    <svg className="goo-svg" aria-hidden="true">
      <defs>
        <filter id="goo-blob" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
            result="goo"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default function AmbientBlobs() {
  const dotRefs = useRef([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;

    let raf = 0;
    const start = performance.now();

    const loop = (now) => {
      const t = (now - start) / 1000;

      dotRefs.current.forEach((el, i) => {
        if (!el) return;
        const b = BLOBS[i];
        const ox = Math.sin(t * (0.28 + i * 0.02) + i) * 1.6;
        const oy = Math.cos(t * (0.2 + i * 0.03) + i * 1.1) * 2;
        const sc = 1 + Math.sin(t * 0.32 + i * 0.55) * 0.04;
        el.style.left = `${b.x + ox}%`;
        el.style.top = `${b.y + oy}%`;
        el.style.width = `${b.s * sc}vmin`;
        el.style.height = `${b.s * sc * b.ry}vmin`;
      });

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="ambient-blobs" aria-hidden="true">
      <GooFilter />
      <div className="ambient-blobs__base" />

      <div className="ambient-blobs__goo">
        {BLOBS.map((b, i) => (
          <span
            key={i}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            className={`ambient-blobs__dot${i >= 13 ? " ambient-blobs__dot--rail" : ""}`}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.s}vmin`,
              height: `${b.s * b.ry}vmin`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

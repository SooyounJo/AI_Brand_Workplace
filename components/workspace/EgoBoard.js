export default function EgoBoard({ project }) {
  const ego = project.ego;
  if (!ego) return null;

  return (
    <div className="ego-board">
      <section className="ego-panel ego-panel--mood">
        <header className="ego-panel__head">
          <h2>Core Moodboard</h2>
          <p>Brand Board에서 확정된 핵심 비주얼</p>
        </header>
        <div className="ego-mood">
          {ego.moodboard.map((src, i) => (
            <figure key={`${src}-${i}`} className="ego-mood__item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${project.brandName} mood ${i + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = `https://picsum.photos/seed/ego${i}/600/600`;
                }}
              />
            </figure>
          ))}
        </div>
      </section>

      <section className="ego-panel">
        <header className="ego-panel__head">
          <h2>Brand Persona</h2>
          <p>{ego.persona.name}</p>
        </header>
        <div className="ego-traits">
          {ego.persona.traits.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="ego-voice">{ego.persona.voice}</p>
      </section>

      <section className="ego-panel ego-panel--rules">
        <div>
          <h2>Do&apos;s</h2>
          <ul>
            {ego.dos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Don&apos;ts</h2>
          <ul className="ego-donts">
            {ego.donts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ego-panel">
        <header className="ego-panel__head">
          <h2>Color Palette</h2>
        </header>
        <div className="ego-palette">
          {ego.palette.map((c) => (
            <div key={c.hex} className="ego-swatch">
              <span style={{ background: c.hex }} />
              <strong>{c.name}</strong>
              <em>{c.hex}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="ego-panel">
        <header className="ego-panel__head">
          <h2>Typography</h2>
        </header>
        <div className="ego-type">
          {ego.typography.map((t) => (
            <div key={t.role} className="ego-type__row">
              <span>{t.role}</span>
              <strong>{t.family}</strong>
              <p>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

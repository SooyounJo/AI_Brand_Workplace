const LABELS = {
  top: ["Thinking", "Logic", "Prototyping"],
  bottom: ["AI Collaboration", "Branding", "Design"],
};

export default function Footer({ placement = "bottom" }) {
  const [left, share, inspire] = LABELS[placement] || LABELS.bottom;

  return (
    <div
      className={`site-footer site-footer--${placement}`}
      aria-hidden="true"
    >
      <span className="site-footer__left">{left}</span>
      <span className="site-footer__share">{share}</span>
      <span className="site-footer__inspire">{inspire}</span>
    </div>
  );
}

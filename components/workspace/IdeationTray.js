import { useState } from "react";
import { TAG_CATEGORIES } from "@/data/ideationTags";

export default function IdeationTray({ onPlace, disabled = false }) {
  const [open, setOpen] = useState(true);
  const [categoryId, setCategoryId] = useState(TAG_CATEGORIES[0].id);
  const category = TAG_CATEGORIES.find((c) => c.id === categoryId) || TAG_CATEGORIES[0];

  if (disabled) return null;

  return (
    <aside className={`ws-ideate${open ? " is-open" : ""}`} aria-label="Ideation tags">
      <button
        type="button"
        className="ws-ideate__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Ideation Tags</span>
        <span className="ws-ideate__chev">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="ws-ideate__body">
          <p className="ws-ideate__hint">
            카테고리 태그를 고른 뒤 카드를 보드에 놓으세요
          </p>

          <div className="ws-ideate__cats" role="tablist" aria-label="Tag categories">
            {TAG_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoryId === cat.id}
                className={`ws-ideate__cat${categoryId === cat.id ? " is-on" : ""}`}
                onClick={() => setCategoryId(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <ul className="ws-ideate__options">
            {category.options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  className="ws-ideate__option"
                  onClick={() =>
                    onPlace?.({
                      title: category.label,
                      body: opt.body,
                      categoryId: category.id,
                      optionId: opt.id,
                    })
                  }
                >
                  <span className="ws-ideate__option-tag">{category.label}</span>
                  <span className="ws-ideate__option-body">{opt.body}</span>
                  <span className="ws-ideate__option-add">보드에 놓기</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

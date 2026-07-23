const ADD_PRESETS = [
  {
    id: "board",
    kind: "board",
    label: "대형 보드",
    hint: "대형 보드 추가",
    tone: "variation",
    w: 1200,
    h: 720,
  },
  {
    id: "card",
    kind: "card",
    label: "카드",
    hint: "카드 추가",
  },
];

export default function BoardRail({
  boards = [],
  activeId = null,
  onSelect,
  onAdd,
  visible = true,
}) {
  if (!visible) return null;

  return (
    <aside className="ws-boards" aria-label="Board list">
      <p className="ws-boards__label">Boards</p>

      <ul className="ws-boards__list">
        {boards.map((board) => (
          <li key={board.id}>
            <button
              type="button"
              className={`ws-boards__item${activeId === board.id ? " is-active" : ""}`}
              onClick={() => onSelect?.(board.id)}
              title={board.title}
            >
              <span className="ws-boards__name">{board.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="ws-boards__divider" aria-hidden="true" />

      <p className="ws-boards__label">Add</p>
      <div className="ws-boards__add">
        {ADD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="ws-boards__add-btn"
            title={preset.hint}
            onClick={() => onAdd?.(preset)}
          >
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

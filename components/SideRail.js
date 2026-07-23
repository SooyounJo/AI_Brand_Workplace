import { PROJECTS } from "@/data/projects";
import { useAppUI } from "@/context/AppUI";

export default function SideRail() {
  const { openNewProject, goToBoard, boardLoading } = useAppUI();

  return (
    <aside className="side-rail" aria-label="Projects">
      <div className="side-rail__panel">
        <div className="side-rail__shimmer" aria-hidden="true" />
        <div className="side-rail__noise" aria-hidden="true" />
        <div className="side-rail__content">
          <nav className="side-rail__list">
            {PROJECTS.map((item) => (
              <button
                key={item.slug}
                type="button"
                className="side-rail__item"
                disabled={boardLoading}
                onClick={() => goToBoard(`/board/${item.slug}`)}
              >
                <span className="side-rail__date">{item.date}</span>
                <span className="side-rail__label">{item.title}</span>
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="cta cta--rail"
            onClick={openNewProject}
            disabled={boardLoading}
          >
            New Project
          </button>
        </div>
      </div>
    </aside>
  );
}

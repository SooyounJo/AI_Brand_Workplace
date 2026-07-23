import { useEffect, useState } from "react";
import { useAppUI } from "@/context/AppUI";
import { buildCustomProject, saveCustomProject } from "@/data/projects";

const CATEGORIES = ["Product", "Idol", "Exhibition", "Other"];

export default function NewProjectModal() {
  const { newProjectOpen, closeNewProject, goToBoard } = useAppUI();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Product");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [audience, setAudience] = useState("");
  const [vibe, setVibe] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!newProjectOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeNewProject();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newProjectOpen, closeNewProject]);

  if (!newProjectOpen) return null;

  const addKeyword = () => {
    const next = keywordInput
      .split(",")
      .map((k) => k.replace(/^#/, "").trim())
      .filter(Boolean);
    if (!next.length) return;
    setKeywords((prev) => [...new Set([...prev, ...next])]);
    setKeywordInput("");
  };

  const removeKeyword = (word) => {
    setKeywords((prev) => prev.filter((k) => k !== word));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    const project = buildCustomProject({
      name: name.trim(),
      category,
      keywords,
      audience: audience.trim(),
      vibe: vibe.trim(),
    });
    saveCustomProject(project);
    closeNewProject();
    setName("");
    setCategory("Product");
    setKeywords([]);
    setAudience("");
    setVibe("");
    setSubmitting(false);
    await goToBoard(`/board/${project.slug}`);
  };

  return (
    <div className="np-modal" role="dialog" aria-modal="true" aria-labelledby="np-title">
      <button
        type="button"
        className="np-modal__backdrop"
        aria-label="Close modal"
        onClick={closeNewProject}
      />
      <div className="np-modal__panel">
        <header className="np-modal__head">
          <h2 id="np-title">New Project</h2>
          <button type="button" className="np-modal__close" onClick={closeNewProject}>
            Close
          </button>
        </header>

        <form className="np-modal__form" onSubmit={onSubmit}>
          <label className="np-field">
            <span>Project Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 도시의 립"
              required
            />
          </label>

          <label className="np-field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="np-field">
            <span>Core Keyword</span>
            <div className="np-tags">
              {keywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="np-tag"
                  onClick={() => removeKeyword(k)}
                >
                  #{k} ×
                </button>
              ))}
            </div>
            <div className="np-tag-row">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Sustainable, Minimal..."
              />
              <button type="button" className="np-tag-add" onClick={addKeyword}>
                Add
              </button>
            </div>
          </div>

          <label className="np-field">
            <span>Target Audience</span>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Who is this brand for?"
            />
          </label>

          <label className="np-field">
            <span>Brand Vibe / Tone & Manner</span>
            <textarea
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              rows={3}
              placeholder="Quiet, warm, tactile..."
            />
          </label>

          <button type="submit" className="np-submit" disabled={submitting}>
            Create Board
          </button>
        </form>
      </div>
    </div>
  );
}

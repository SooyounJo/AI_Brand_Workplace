import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BoardRail from "@/components/workspace/BoardRail";
import BrandCanvas, { DEFAULT_ZONES } from "@/components/workspace/BrandCanvas";
import EgoBoard from "@/components/workspace/EgoBoard";
import { getProject } from "@/data/projects";

const GRID = 18;

function snap(n) {
  return Math.round(n / GRID) * GRID;
}

function overlaps(a, b, gap = 80) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function nextBoardLayout(zones, preset) {
  const gap = 80;
  const w = preset.w || 1200;
  const h = preset.h || 720;
  const index = zones.length + 1;
  const rightmost = zones.reduce((max, z) => Math.max(max, z.x + z.w), 0);
  const candidates = [
    { x: rightmost + gap, y: 64 },
    { x: 80, y: zones.reduce((max, z) => Math.max(max, z.y + z.h), 0) + gap },
  ];

  let spot = candidates[0];
  for (const c of candidates) {
    const next = { ...c, w, h };
    if (!zones.some((z) => overlaps(next, z, gap))) {
      spot = c;
      break;
    }
  }

  // Nudge right until clear
  let x = spot.x;
  let y = spot.y;
  let guard = 0;
  while (
    zones.some((z) => overlaps({ x, y, w, h }, z, gap)) &&
    guard < 40
  ) {
    x += gap;
    guard += 1;
  }

  return {
    id: `zone-${Date.now()}`,
    title: `Board ${index}`,
    subtitle: "",
    x: snap(x),
    y: snap(y),
    w,
    h,
    tone: preset.tone || "variation",
    aiModels: ["#nanobanana"],
  };
}

export default function Workspace({ slug, initialProject = null }) {
  const [project, setProject] = useState(initialProject);
  const [ready, setReady] = useState(Boolean(initialProject));
  const [view, setView] = useState("brand");
  const [prompt, setPrompt] = useState("");
  const [extraNodes, setExtraNodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [zones, setZones] = useState(
    () => (initialProject?.zones?.length ? initialProject.zones : DEFAULT_ZONES)
  );
  const [activeZoneId, setActiveZoneId] = useState(
    () =>
      (initialProject?.zones?.length ? initialProject.zones : DEFAULT_ZONES)[0]
        ?.id || null
  );
  const [focusZoneId, setFocusZoneId] = useState(null);

  useEffect(() => {
    const next = initialProject || getProject(slug);
    const nextZones = next?.zones?.length ? next.zones : DEFAULT_ZONES;
    setProject(next);
    setReady(true);
    setView("brand");
    setExtraNodes([]);
    setPrompt("");
    setZones(nextZones);
    setActiveZoneId(nextZones[0]?.id || null);
    setFocusZoneId(null);
  }, [slug, initialProject]);

  const onGenerate = useCallback(() => {
    if (generating) return;
    setGenerating(true);
    const seed = `gen-${slug}-${Date.now()}`;
    const zone =
      zones.find((z) => z.id === activeZoneId) ||
      zones.find((z) => z.id === "mood") ||
      zones[0];
    const node = {
      id: seed,
      kind: "image",
      src: `https://picsum.photos/seed/${seed}/640/480`,
      alt: prompt || "AI generated reference",
      x: snap((zone?.x || 1320) + 48 + Math.random() * 120),
      y: snap((zone?.y || 200) + 48 + Math.random() * 160),
      w: 220,
      h: 160,
      fresh: true,
    };
    window.setTimeout(() => {
      setExtraNodes((prev) => [...prev, node]);
      setPrompt("");
      setGenerating(false);
      setView("brand");
    }, 650);
  }, [generating, prompt, slug, zones, activeZoneId]);

  const onSelectBoard = useCallback((id) => {
    setActiveZoneId(id);
    setFocusZoneId(`${id}:${Date.now()}`);
    setView("brand");
  }, []);

  const onAddBoard = useCallback((preset) => {
    if (preset?.kind === "card") {
      const zone =
        zones.find((z) => z.id === activeZoneId) ||
        zones.find((z) => z.id === "main") ||
        zones.find((z) => z.id === "ideation") ||
        zones[0];
      if (!zone) return;

      setExtraNodes((prev) => {
        const placed = prev.filter((n) => n.kind === "card").length;
        const col = placed % 2;
        const row = Math.floor(placed / 2);
        return [
          ...prev,
          {
            id: `card-${Date.now()}`,
            kind: "card",
            title: "새 카드",
            body: "내용을 입력하세요.",
            x: snap(zone.x + 36 + col * 310),
            y: snap(zone.y + 48 + row * 150),
            w: 290,
            h: 132,
            fresh: true,
          },
        ];
      });
      setActiveZoneId(zone.id);
      setFocusZoneId(`${zone.id}:${Date.now()}`);
      setView("brand");
      return;
    }

    setZones((prev) => {
      const next = nextBoardLayout(prev, preset);
      setActiveZoneId(next.id);
      setFocusZoneId(`${next.id}:${Date.now()}`);
      return [...prev, next];
    });
    setView("brand");
  }, [zones, activeZoneId]);

  if (!ready) {
    return <div className="workspace workspace--booting" aria-busy="true" />;
  }

  if (!project) {
    return (
      <div className="workspace-missing">
        <p>Board not found.</p>
        <Link href="/">Home</Link>
      </div>
    );
  }

  return (
    <div className="workspace">
      <header className="ws-header">
        <Link href="/" className="ws-home">
          Home
        </Link>

        <div
          className="ws-seg"
          role="tablist"
          aria-label="Board view"
          data-active={view}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "brand"}
            className={`ws-seg__btn${view === "brand" ? " is-on" : ""}`}
            onClick={() => setView("brand")}
          >
            Brand
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "ego"}
            className={`ws-seg__btn${view === "ego" ? " is-on" : ""}`}
            onClick={() => setView("ego")}
          >
            Ego
          </button>
        </div>

        <div className="ws-people" aria-label="Participating members">
          <ul className="ws-people__list">
            {(project.members || []).map((member, index) => (
              <li
                key={member.id}
                className={`ws-people__item${index === 0 ? " is-you" : ""}`}
                style={{ zIndex: (project.members?.length || 0) - index }}
              >
                <button
                  type="button"
                  className="ws-people__avatar"
                  aria-label={index === 0 ? `${member.name} (you)` : member.name}
                  aria-describedby={`member-tip-${member.id}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={member.avatar} alt="" />
                </button>
                <div
                  id={`member-tip-${member.id}`}
                  className="ws-people__tip"
                  role="tooltip"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={member.avatar} alt="" />
                  <div className="ws-people__tip-meta">
                    <strong>{member.name}</strong>
                    <span>{index === 0 ? "You" : "Member"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="ws-stage">
        <BoardRail
          boards={zones}
          activeId={activeZoneId}
          onSelect={onSelectBoard}
          onAdd={onAddBoard}
          visible={view === "brand"}
        />

        {view === "brand" ? (
          <BrandCanvas
            project={project}
            extraNodes={extraNodes}
            zones={zones}
            onZonesChange={setZones}
            activeZoneId={activeZoneId}
            focusZoneId={focusZoneId}
          />
        ) : (
          <EgoBoard project={project} />
        )}

      </div>

      <footer className="ws-chat">
        <div className="ws-chat__inner">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onGenerate();
            }}
            placeholder="AI에게 브랜드 에셋 및 레퍼런스 이미지를 요청하세요"
          />
          <button
            type="button"
            className="ws-generate"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </footer>
    </div>
  );
}

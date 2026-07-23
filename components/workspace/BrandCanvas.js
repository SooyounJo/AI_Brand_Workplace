import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 2.4;
const WORLD_W = 3200;
const WORLD_H = 1180;
const GRID = 18;
const DRAG_THRESHOLD = 4;

const ASPECT_PRESETS = [
  { id: "1:1", ratio: 1, label: "1:1" },
  { id: "2:1", ratio: 2, label: "2:1" },
  { id: "1:2", ratio: 0.5, label: "1:2" },
];

function snapSize(n) {
  return Math.max(GRID * 4, Math.round(n / GRID) * GRID);
}

function sizeFromAspect(w, h, aspectId) {
  const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
  if (!preset) return { w, h };
  // 높이 기준으로 맞춤 → 1:1 / 2:1 / 1:2 상하 높이가 동일
  const baseH = snapSize(
    h ||
      (w ? w / Math.max(preset.ratio, 0.25) : 0) ||
      180
  );
  return {
    w: snapSize(baseH * preset.ratio),
    h: baseH,
    aspect: aspectId,
  };
}

function authorInitials(name) {
  if (!name) return "";
  const raw = String(name).trim();
  if (/^AI\b/i.test(raw)) return "AI";
  const parts = raw.split(/[\s·•._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

function AuthorBadge({ name, className = "" }) {
  const initials = authorInitials(name);
  if (!initials) return null;
  return (
    <span className={`bc-author${className ? ` ${className}` : ""}`} title={name}>
      {initials}
    </span>
  );
}

export const DEFAULT_ZONES = [
  {
    id: "essentials",
    title: "Zone1",
    subtitle: "",
    x: 80,
    y: 64,
    w: 420,
    h: 860,
    tone: "base",
    aiModels: ["#claude", "#chatgpt"],
  },
  {
    id: "variation",
    title: "Zone2",
    subtitle: "",
    x: 560,
    y: 64,
    w: 1480,
    h: 860,
    tone: "variation",
    aiModels: ["#nanobanana", "#midjourney"],
  },
  {
    id: "outputs",
    title: "Zone3",
    subtitle: "",
    x: 2120,
    y: 280,
    w: 880,
    h: 640,
    tone: "output",
    aiModels: ["#nanobanana", "#flux"],
  },
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function snap(n) {
  return Math.round(n / GRID) * GRID;
}

function center(node) {
  return {
    x: node.x + (node.w || 0) / 2,
    y: node.y + (node.h || 80) / 2,
  };
}

const GROUP_TO_ZONE = {
  product: "product-visual",
  "main-flow": "main-flow",
  "model-test": "model-test",
  model: "model",
  mood: "mood",
  "brand-shot": "brand-shot",
};

const ZONE_PAD = 40;

function resolveZoneId(node, zones) {
  if (node.group) {
    const mapped = GROUP_TO_ZONE[node.group] || node.group;
    if (zones.some((z) => z.id === mapped)) return mapped;
  }
  if (node.kind === "output") return "outputs";
  if (node.kind === "typo") return "typography";
  if (node.kind === "card" && node.accent) return "main";
  if (node.kind === "card") return "essentials";

  const c = center(node);
  let best = null;
  let bestArea = Infinity;
  for (const z of zones) {
    if (
      c.x >= z.x &&
      c.x <= z.x + z.w &&
      c.y >= z.y &&
      c.y <= z.y + z.h
    ) {
      const area = z.w * z.h;
      if (area < bestArea) {
        bestArea = area;
        best = z.id;
      }
    }
  }
  return best;
}

/** Grow a board so it still wraps its member cards (never shrink). */
function expandZoneToFit(zones, zoneId, nodes, pad = ZONE_PAD, forceIds = null) {
  if (!zoneId) return zones;
  const forced = forceIds ? new Set(forceIds) : null;
  return zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const members = nodes.filter(
      (n) =>
        (forced && forced.has(n.id)) || resolveZoneId(n, zones) === zoneId
    );
    if (!members.length) return zone;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of members) {
      const w = n.w || 200;
      const h = n.h || 100;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    }

    const nextX = Math.min(zone.x, snap(minX - pad));
    const nextY = Math.min(zone.y, snap(minY - pad));
    const nextR = Math.max(zone.x + zone.w, snap(maxX + pad));
    const nextB = Math.max(zone.y + zone.h, snap(maxY + pad));
    const nextW = nextR - nextX;
    const nextH = nextB - nextY;
    if (
      nextX === zone.x &&
      nextY === zone.y &&
      nextW === zone.w &&
      nextH === zone.h
    ) {
      return zone;
    }
    return { ...zone, x: nextX, y: nextY, w: nextW, h: nextH };
  });
}

function portPoint(node, side) {
  const h = node.h || 80;
  const w = node.w || 200;
  return {
    x: side === "in" ? node.x : node.x + w,
    y: node.y + h / 2,
  };
}

function edgePath(a, b) {
  const usePorts = a.kind === "idea" || b.kind === "idea" || a.flow || b.flow;
  const p1 = usePorts ? portPoint(a, "out") : center(a);
  const p2 = usePorts ? portPoint(b, "in") : center(b);
  const midX = (p1.x + p2.x) / 2;
  return `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
}

function mainlinePoint(node, index, total) {
  if (!node) return null;
  if (node.kind === "idea" || node.flow) {
    if (index === 0) return portPoint(node, "out");
    if (index === total - 1) return portPoint(node, "in");
    return center(node);
  }
  return center(node);
}

function buildMainlinePath(nodesInOrder) {
  const pts = nodesInOrder
    .map((n, i) => mainlinePoint(n, i, nodesInOrder.length))
    .filter(Boolean);
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = Math.max(48, Math.abs(b.x - a.x) * 0.42);
    const sign = b.x >= a.x ? 1 : -1;
    d += ` C ${a.x + dx * sign} ${a.y}, ${b.x - dx * sign} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

function buildNodes(board, extraNodes) {
  const essentials = (board.essentials || []).map((item, i) => ({
    ...item,
    kind: "card",
    x: item.x ?? 72,
    y: item.y ?? 110 + i * 150,
    w: item.w ?? 300,
    h: item.h ?? 128,
  }));

  const mainCards = (board.mainCards || []).map((item, i) => ({
    ...item,
    kind: "card",
    accent: item.accent || "goal",
    x: item.x ?? 596,
    y: item.y ?? 100 + i * 160,
    w: item.w ?? 280,
    h: item.h ?? 140,
  }));

  const ideas = (board.ideas || []).map((item) => ({
    ...item,
    kind: "idea",
    w: item.w ?? (item.flow ? 200 : 220),
    h: item.h ?? (item.flow ? 100 : 108),
  }));

  const images = [...(board.images || [])]
    .concat((extraNodes || []).filter((n) => !n.kind || n.kind === "image"))
    .map((item) => ({
      ...item,
      kind: "image",
      w: item.w ?? 240,
      h: item.h ?? 180,
    }));

  const comments = (board.comments || []).map((item) => ({
    ...item,
    kind: "comment",
    w: item.w ?? 190,
    h: item.h ?? 92,
  }));

  const typography = (board.typography || []).map((item) => ({
    ...item,
    kind: "typo",
    w: item.w ?? 360,
    h: item.h ?? 200,
  }));

  const outputs = (board.outputs || []).map((item, i) => ({
    ...item,
    kind: "output",
    x: item.x ?? 2520 + (i % 2) * 360,
    y: item.y ?? 130 + Math.floor(i / 2) * 360,
    w: item.w ?? 300,
    h: item.h ?? 300,
  }));

  const extras = (extraNodes || [])
    .filter((n) => n.kind && n.kind !== "image")
    .map((item) => ({
      ...item,
      w: item.w ?? (item.kind === "card" ? 300 : item.kind === "typo" ? 360 : 220),
      h: item.h ?? (item.kind === "card" ? 128 : item.kind === "typo" ? 200 : 108),
    }));

  return [
    ...essentials,
    ...mainCards,
    ...ideas,
    ...images,
    ...typography,
    ...comments,
    ...outputs,
    ...extras,
  ];
}

function BoardImage({ src, alt, className }) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(src);
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div className={`bc-image-fallback${className ? ` ${className}` : ""}`}>
        <span>{alt || "Image"}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt || ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => {
        if (current !== src) {
          setFailed(true);
          return;
        }
        const seed = encodeURIComponent(alt || src).slice(0, 24);
        setCurrent(`https://picsum.photos/seed/${seed}/800/600`);
      }}
    />
  );
}

function NodeEditor({ node, draft, setDraft, onSave, onCancel }) {
  return (
    <div className="bc-editor" role="dialog" aria-modal="true" aria-label="Edit node">
      <div className="bc-editor__panel">
        <header className="bc-editor__head">
          <h3>노드 수정</h3>
          <button type="button" onClick={onCancel}>
            닫기
          </button>
        </header>

        {node.kind === "card" ? (
          <>
            <label className="bc-editor__field">
              <span>Title</span>
              <input
                value={draft.title || ""}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
            <label className="bc-editor__field">
              <span>Body</span>
              <textarea
                rows={4}
                value={draft.body || ""}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
            </label>
          </>
        ) : null}

        {node.kind === "idea" || node.kind === "comment" ? (
          <>
            <label className="bc-editor__field">
              <span>Text</span>
              <textarea
                rows={4}
                value={draft.text || ""}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              />
            </label>
            <label className="bc-editor__field">
              <span>Author</span>
              <input
                value={draft.author || ""}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
              />
            </label>
          </>
        ) : null}

        {node.kind === "image" || node.kind === "output" ? (
          <>
            {node.kind === "image" ? (
              <label className="bc-editor__field">
                <span>Alt</span>
                <input
                  value={draft.alt || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, alt: e.target.value }))}
                />
              </label>
            ) : (
              <label className="bc-editor__field">
                <span>Label</span>
                <input
                  value={draft.label || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </label>
            )}
            <div className="bc-editor__field">
              <span>비율</span>
              <div className="bc-aspect" role="group" aria-label="Image aspect ratio">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`bc-aspect__btn${
                      draft.aspect === preset.id ? " is-on" : ""
                    }`}
                    onClick={() => setDraft((d) => ({ ...d, aspect: preset.id }))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="bc-editor__actions">
          <button type="button" className="bc-editor__ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="bc-editor__primary" onClick={onSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BrandCanvas({
  project,
  extraNodes,
  zones = DEFAULT_ZONES,
  onZonesChange,
  activeZoneId = null,
  focusZoneId = null,
}) {
  const board = project.brandBoard;
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 28, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [draggingNode, setDraggingNode] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [linkEdges, setLinkEdges] = useState([]);
  const [linkFrom, setLinkFrom] = useState(null);
  const dragRef = useRef(null);
  const nodeDragRef = useRef(null);
  const zoomRef = useRef(zoom);
  const zonesRef = useRef(zones);

  zoomRef.current = zoom;
  zonesRef.current = zones;

  useEffect(() => {
    setNodes(buildNodes(board, extraNodes));
    setLinkEdges([...(board.connections || [])]);
    setLinkFrom(null);
    setSelectedId(null);
    setEditingId(null);
  }, [project?.slug, board, extraNodes]);

  useEffect(() => {
    if (!focusZoneId) return;
    const zoneId = String(focusZoneId).split(":")[0];
    const zone = zones.find((z) => z.id === zoneId);
    const el = viewportRef.current;
    if (!zone || !el) return;
    const rect = el.getBoundingClientRect();
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + zone.h / 2;
    setPan({
      x: rect.width / 2 - cx * zoom,
      y: rect.height / 2 - cy * zoom,
    });
  }, [focusZoneId, zones, zoom]);

  const nodeMap = useMemo(() => {
    const map = {};
    nodes.forEach((n) => {
      map[n.id] = n;
    });
    return map;
  }, [nodes]);

  const selected = selectedId ? nodeMap[selectedId] : null;
  const editing = editingId ? nodeMap[editingId] : null;

  const connectedIds = useMemo(() => {
    const set = new Set();
    linkEdges.forEach(([from, to]) => {
      set.add(from);
      set.add(to);
    });
    return set;
  }, [linkEdges]);

  const mainLinkedIdeaIds = useMemo(() => {
    const mainIds = new Set(
      nodes.filter((n) => n.kind === "card" && n.accent).map((n) => n.id)
    );
    if (!mainIds.size) return new Set();

    const adj = new Map();
    linkEdges.forEach(([from, to]) => {
      if (!adj.has(from)) adj.set(from, []);
      if (!adj.has(to)) adj.set(to, []);
      adj.get(from).push(to);
      adj.get(to).push(from);
    });

    const linked = new Set();
    const stack = [...mainIds];
    const seen = new Set(mainIds);
    while (stack.length) {
      const id = stack.pop();
      const node = nodeMap[id];
      if (node?.kind === "idea") linked.add(id);
      for (const next of adj.get(id) || []) {
        if (seen.has(next)) continue;
        const n = nodeMap[next];
        if (!n) continue;
        if (n.kind === "idea" || (n.kind === "card" && n.accent)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return linked;
  }, [nodes, linkEdges, nodeMap]);

  const mainlineIds = board?.mainline || [];

  const mainlinePairKeys = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < mainlineIds.length - 1; i += 1) {
      const a = mainlineIds[i];
      const b = mainlineIds[i + 1];
      set.add(`${a}>${b}`);
      set.add(`${b}>${a}`);
    }
    return set;
  }, [mainlineIds]);

  const mainlinePath = useMemo(() => {
    if (!mainlineIds.length) return "";
    const ordered = mainlineIds.map((id) => nodeMap[id]).filter(Boolean);
    if (ordered.length < 2) return "";
    return buildMainlinePath(ordered);
  }, [mainlineIds, nodeMap]);

  const edges = useMemo(() => {
    const mainIds = new Set(
      nodes.filter((n) => n.kind === "card" && n.accent).map((n) => n.id)
    );
    const onSpine = new Set(mainlineIds);
    return linkEdges
      .map(([from, to], i) => {
        const a = nodeMap[from];
        const b = nodeMap[to];
        if (!a || !b) return null;
        const isMainlineSeg = mainlinePairKeys.has(`${from}>${to}`);
        const touchesMain =
          (mainIds.has(from) && b.kind === "idea") ||
          (mainIds.has(to) && a.kind === "idea");
        const ideaToIdea =
          a.kind === "idea" &&
          b.kind === "idea" &&
          mainLinkedIdeaIds.has(from) &&
          mainLinkedIdeaIds.has(to);
        const spineTouch =
          onSpine.has(from) && onSpine.has(to) && (isMainlineSeg || ideaToIdea);
        return {
          id: `${from}-${to}-${i}`,
          from,
          to,
          d: edgePath(a, b),
          accent: isMainlineSeg || spineTouch || touchesMain || ideaToIdea,
          mainline: isMainlineSeg,
        };
      })
      .filter(Boolean);
  }, [linkEdges, nodeMap, nodes, mainLinkedIdeaIds, mainlinePairKeys, mainlineIds]);

  const startLink = useCallback((nodeId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setLinkFrom((cur) => (cur === nodeId ? null : nodeId));
  }, []);

  const completeLink = useCallback((nodeId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setLinkFrom((fromId) => {
      if (!fromId || fromId === nodeId) return null;
      setLinkEdges((prev) => {
        if (prev.some(([a, b]) => a === fromId && b === nodeId)) {
          return prev.filter(([a, b]) => !(a === fromId && b === nodeId));
        }
        return [...prev, [fromId, nodeId]];
      });
      return null;
    });
  }, []);

  const removeEdge = useCallback((from, to, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setLinkEdges((prev) => prev.filter(([a, b]) => !(a === from && b === to)));
  }, []);

  const clearSideLinks = useCallback((nodeId, side, e) => {
    e.stopPropagation();
    e.preventDefault();
    setLinkEdges((prev) =>
      prev.filter(([a, b]) => {
        if (side === "out") return a !== nodeId;
        return b !== nodeId;
      })
    );
    setLinkFrom(null);
  }, []);

  const deleteNode = useCallback((id) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setLinkEdges((prev) => prev.filter(([a, b]) => a !== id && b !== id));
    setLinkFrom((cur) => (cur === id ? null : cur));
    setSelectedId((cur) => (cur === id ? null : cur));
    setEditingId((cur) => (cur === id ? null : cur));
  }, []);

  const isTextNode = (node) =>
    node?.kind === "card" || node?.kind === "idea" || node?.kind === "comment";

  const openEdit = useCallback((node) => {
    setSelectedId(node.id);
    setEditingId(node.id);
    setDraft({
      title: node.title || "",
      body: node.body || "",
      text: node.text || "",
      author: node.author || "",
      alt: node.alt || "",
      label: node.label || "",
      aspect: node.aspect || "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const applyAspect = useCallback((id, aspectId) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (n.kind !== "image" && n.kind !== "output") return n;
        return { ...n, ...sizeFromAspect(n.w, n.h, aspectId) };
      })
    );
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== editingId) return n;
        if (n.kind === "card") {
          return { ...n, title: draft.title, body: draft.body };
        }
        if (n.kind === "idea" || n.kind === "comment") {
          return { ...n, text: draft.text, author: draft.author };
        }
        if (n.kind === "image") {
          const next = { ...n, alt: draft.alt };
          if (draft.aspect) {
            Object.assign(next, sizeFromAspect(n.w, n.h, draft.aspect));
          }
          return next;
        }
        if (n.kind === "output") {
          const next = { ...n, label: draft.label };
          if (draft.aspect) {
            Object.assign(next, sizeFromAspect(n.w, n.h, draft.aspect));
          }
          return next;
        }
        return n;
      })
    );
    setEditingId(null);
  }, [draft, editingId]);

  useEffect(() => {
    const onKey = (e) => {
      if (editingId) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        }
        return;
      }
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        deleteNode(selectedId);
      }
      if (e.key === "Enter") {
        const node = nodeMap[selectedId];
        if (node) openEdit(node);
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editingId, deleteNode, openEdit, cancelEdit, nodeMap]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prevZoom) => {
        const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
        setPan((prevPan) => {
          const worldX = (mx - prevPan.x) / prevZoom;
          const worldY = (my - prevPan.y) / prevZoom;
          return {
            x: mx - worldX * nextZoom,
            y: my - worldY * nextZoom,
          };
        });
        return nextZoom;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onNodePointerDown = (e, node) => {
    if (e.button !== 0) return;
    if (e.target.closest(".bc-node__tools")) return;
    if (e.target.closest(".bc-inline")) return;
    if (e.target.closest(".bc-port")) return;
    if (editingId === node.id) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(node.id);
    nodeDragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: node.x,
      originY: node.y,
      zoom: zoomRef.current,
      moved: false,
      zoneId: resolveZoneId(node, zonesRef.current),
    };
    setDraggingNode(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".bc-node") || e.target.closest(".bc-editor")) return;
    setSelectedId(null);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (nodeDragRef.current) {
      const d = nodeDragRef.current;
      const rawDx = e.clientX - d.startX;
      const rawDy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(rawDx, rawDy) > DRAG_THRESHOLD) {
        d.moved = true;
      }
      if (!d.moved) return;
      const dx = rawDx / d.zoom;
      const dy = rawDy / d.zoom;
      const nextX = snap(d.originX + dx);
      const nextY = snap(d.originY + dy);
      setNodes((prev) => {
        const next = prev.map((n) =>
          n.id === d.id ? { ...n, x: nextX, y: nextY } : n
        );
        if (onZonesChange && d.zoneId) {
          const fitted = expandZoneToFit(
            zonesRef.current,
            d.zoneId,
            next,
            ZONE_PAD,
            [d.id]
          );
          if (fitted !== zonesRef.current) {
            const changed = fitted.some(
              (z, i) =>
                z.x !== zonesRef.current[i]?.x ||
                z.y !== zonesRef.current[i]?.y ||
                z.w !== zonesRef.current[i]?.w ||
                z.h !== zonesRef.current[i]?.h
            );
            if (changed) {
              zonesRef.current = fitted;
              onZonesChange(fitted);
            }
          }
        }
        return next;
      });
      return;
    }

    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({
      x: dragRef.current.panX + dx,
      y: dragRef.current.panY + dy,
    });
  };

  const onPointerUp = (e) => {
    if (nodeDragRef.current) {
      const d = nodeDragRef.current;
      if (d.moved) {
        setNodes((prev) => {
          const next = prev.map((n) =>
            n.id === d.id ? { ...n, x: snap(n.x), y: snap(n.y) } : n
          );
          if (onZonesChange && d.zoneId) {
            const fitted = expandZoneToFit(
              zonesRef.current,
              d.zoneId,
              next,
              ZONE_PAD,
              [d.id]
            );
            const changed = fitted.some(
              (z, i) =>
                z.x !== zonesRef.current[i]?.x ||
                z.y !== zonesRef.current[i]?.y ||
                z.w !== zonesRef.current[i]?.w ||
                z.h !== zonesRef.current[i]?.h
            );
            if (changed) {
              zonesRef.current = fitted;
              onZonesChange(fitted);
            }
          }
          return next;
        });
      }
      nodeDragRef.current = null;
      setDraggingNode(false);
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const zoomBy = (factor) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setZoom((prevZoom) => {
      const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
      setPan((prevPan) => {
        const worldX = (mx - prevPan.x) / prevZoom;
        const worldY = (my - prevPan.y) / prevZoom;
        return {
          x: mx - worldX * nextZoom,
          y: my - worldY * nextZoom,
        };
      });
      return nextZoom;
    });
  };

  const worldW = useMemo(() => {
    const maxRight = zones.reduce((max, z) => Math.max(max, z.x + z.w), 0);
    return Math.max(WORLD_W, maxRight + 200);
  }, [zones]);

  const worldH = useMemo(() => {
    const maxBottom = zones.reduce((max, z) => Math.max(max, z.y + z.h), 0);
    return Math.max(WORLD_H, maxBottom + 160);
  }, [zones]);

  const renderNode = (node) => {
    const isSelected = selectedId === node.id;
    const isEditing = editingId === node.id;
    const inlineEditing = isEditing && isTextNode(node);
    const dragProps = inlineEditing
      ? {}
      : {
          onPointerDown: (e) => onNodePointerDown(e, node),
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          onDoubleClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
            openEdit(node);
          },
        };
    const style = {
      left: node.x,
      top: node.y,
      width: node.w,
      ...(node.h ? { height: node.h } : null),
    };
    const tools =
      isSelected && !inlineEditing ? (
      <div className="bc-node__tools">
        {node.kind === "image" || node.kind === "output" ? (
          <div className="bc-aspect bc-aspect--tools" role="group" aria-label="Aspect ratio">
            {ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`bc-aspect__btn${node.aspect === preset.id ? " is-on" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  applyAspect(node.id, preset.id);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            openEdit(node);
          }}
        >
          수정
        </button>
        <button
          type="button"
          className="is-danger"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(node.id);
          }}
        >
          삭제
        </button>
      </div>
    ) : null;

    const cls = `bc-node${isSelected ? " is-selected" : ""}${
      inlineEditing ? " is-editing" : ""
    }`;

    if (node.kind === "card") {
      const accent = node.accent ? ` bc-card--${node.accent}` : "";
      return (
        <article
          key={node.id}
          id={node.id}
          className={`${cls} bc-card${accent}${node.fresh ? " is-fresh" : ""}`}
          style={style}
          {...dragProps}
        >
          {tools}
          {inlineEditing ? (
            <div className="bc-inline">
              <input
                className="bc-inline__title"
                value={draft.title || ""}
                autoFocus
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <textarea
                className="bc-inline__body"
                rows={3}
                value={draft.body || ""}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <div className="bc-inline__actions">
                <button type="button" onClick={cancelEdit}>
                  취소
                </button>
                <button type="button" className="is-primary" onClick={saveEdit}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3>{node.title}</h3>
              <p>{node.body}</p>
            </>
          )}
        </article>
      );
    }
    if (node.kind === "typo") {
      return (
        <article
          key={node.id}
          id={node.id}
          className={`${cls} bc-typo${node.recommended ? " bc-typo--recommended" : ""}${
            node.egoFlag ? " bc-typo--ego-warn" : ""
          }${node.fresh ? " is-fresh" : ""}`}
          style={style}
          {...dragProps}
        >
          {tools}
          {!inlineEditing ? <AuthorBadge name={node.author} /> : null}
          {node.recommended ? (
            <span className="bc-typo__badge">AI · Pick</span>
          ) : null}
          {node.egoFlag ? <span className="bc-typo__ego-tag">Ego</span> : null}
          <header className="bc-typo__meta">
            <span className="bc-typo__role">{node.role}</span>
            <span className="bc-typo__weight">{node.weight}</span>
          </header>
          <p
            className="bc-typo__sample"
            style={{ fontFamily: node.fontFamily || undefined }}
          >
            {node.sample}
          </p>
          {node.sampleEn ? (
            <p
              className="bc-typo__sample-en"
              style={{ fontFamily: node.fontFamily || undefined }}
            >
              {node.sampleEn}
            </p>
          ) : null}
          <p className="bc-typo__family">{node.family}</p>
          <p className="bc-typo__reason">{node.reason}</p>
        </article>
      );
    }
    if (node.kind === "idea") {
      const isFlow = Boolean(node.flow);
      const inactive = isFlow && !connectedIds.has(node.id) && !node.egoFlag;
      const linking = linkFrom === node.id;
      return (
        <article
          key={node.id}
          id={node.id}
          className={`${cls} bc-idea${isFlow ? " bc-idea--flow" : ""}${
            inactive ? " is-inactive" : ""
          }${linking ? " is-linking" : ""}${node.egoFlag ? " bc-idea--ego-warn" : ""}`}
          style={style}
          {...dragProps}
        >
          {tools}
          {node.egoFlag ? <span className="bc-idea__ego-tag">Ego</span> : null}
          {!inlineEditing ? <AuthorBadge name={node.author} /> : null}
          {isFlow ? (
            <>
              <button
                type="button"
                className="bc-port bc-port--in"
                aria-label="연결 받기 / 입력 연결 해제"
                title={linkFrom ? "여기에 연결" : "입력 연결 해제"}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (linkFrom) {
                    completeLink(node.id, e);
                  } else {
                    clearSideLinks(node.id, "in", e);
                  }
                }}
              />
              <button
                type="button"
                className={`bc-port bc-port--out${linking ? " is-active" : ""}`}
                aria-label="연결 시작"
                title={linking ? "연결 취소" : "오른쪽 원 → 다른 카드 왼쪽 원으로 연결"}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (linkFrom && linkFrom !== node.id) {
                    completeLink(node.id, e);
                    return;
                  }
                  if (linking) {
                    setLinkFrom(null);
                    return;
                  }
                  startLink(node.id, e);
                }}
              />
            </>
          ) : null}
          {inlineEditing ? (
            <div className="bc-inline">
              <textarea
                className="bc-inline__body"
                rows={3}
                value={draft.text || ""}
                autoFocus
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <input
                className="bc-inline__author"
                value={draft.author || ""}
                placeholder="Author"
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <div className="bc-inline__actions">
                <button type="button" onClick={cancelEdit}>
                  취소
                </button>
                <button type="button" className="is-primary" onClick={saveEdit}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>{node.text}</p>
            </>
          )}
        </article>
      );
    }
    if (node.kind === "comment") {
      const warn = node.tone === "warn" ? " bc-comment--warn" : "";
      return (
        <aside
          key={node.id}
          id={node.id}
          className={`${cls} bc-comment${warn}`}
          style={style}
          {...dragProps}
        >
          {tools}
          {!inlineEditing ? (
            <AuthorBadge
              name={node.author}
              className={node.tone === "warn" ? "bc-author--warn" : "bc-author--on-dark"}
            />
          ) : null}
          {inlineEditing ? (
            <div className="bc-inline">
              <textarea
                className="bc-inline__body"
                rows={3}
                value={draft.text || ""}
                autoFocus
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <input
                className="bc-inline__author"
                value={draft.author || ""}
                placeholder="Author"
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  }
                  e.stopPropagation();
                }}
              />
              <div className="bc-inline__actions">
                <button type="button" onClick={cancelEdit}>
                  취소
                </button>
                <button type="button" className="is-primary" onClick={saveEdit}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>{node.text}</p>
            </>
          )}
        </aside>
      );
    }
    if (node.kind === "image") {
      return (
        <figure
          key={node.id}
          id={node.id}
          className={`${cls} bc-image bc-image--framed${
            node.egoFlag ? " bc-image--ego-warn" : ""
          }${node.fresh ? " is-fresh" : ""}${
            node.fit === "contain" ? " bc-image--contain" : ""
          }`}
          data-aspect={node.aspect || "fill"}
          data-fit={node.fit || "cover"}
          style={style}
          {...dragProps}
        >
          {tools}
          {node.egoFlag ? <span className="bc-image__ego-tag">Ego</span> : null}
          <BoardImage src={node.src} alt={node.alt || ""} />
        </figure>
      );
    }
    return (
      <figure
        key={node.id}
        id={node.id}
        className={`${cls} bc-output bc-image--framed`}
        data-aspect={node.aspect || "fill"}
        style={style}
        {...dragProps}
      >
        {tools}
        <BoardImage src={node.src} alt={node.alt || node.label} />
        <figcaption>{node.label}</figcaption>
      </figure>
    );
  };

  return (
    <div
      className={`brand-canvas${dragging ? " is-dragging" : ""}${
        draggingNode ? " is-node-dragging" : ""
      }`}
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="brand-canvas__grid" aria-hidden="true" />

      <div
        className="brand-canvas__world"
        style={{
          width: worldW,
          height: worldH,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {zones.map((zone, index) => {
          const isBookend = index === 0 || index === zones.length - 1;
          return (
            <div
              key={zone.id}
              className={`bc-board-wrap${activeZoneId === zone.id ? " is-active" : ""}${
                isBookend ? " is-bookend" : ""
              }${zone.tone === "flow" ? " is-flow" : ""}`}
            >
              <div
                className="bc-board__label"
                style={{
                  left: zone.x,
                  top: zone.y - 28,
                  width: zone.w,
                }}
              >
                <p className="bc-board__title">{zone.title}</p>
                {zone.aiModels?.length ? (
                  <p className="bc-board__ai" aria-label="AI models used">
                    {zone.aiModels.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </p>
                ) : null}
              </div>
              <section
                className={`bc-board bc-board--${zone.tone}${
                  isBookend ? " bc-board--bookend" : ""
                }${activeZoneId === zone.id ? " is-active" : ""}`}
                style={{
                  left: zone.x,
                  top: zone.y,
                  width: zone.w,
                  height: zone.h,
                }}
              />
            </div>
          );
        })}

        <svg
          className="brand-canvas__wires"
          width={worldW}
          height={worldH}
          viewBox={`0 0 ${worldW} ${worldH}`}
          aria-hidden="true"
        >
          {edges.map((edge) => (
            <g
              key={edge.id}
              className={`brand-canvas__wire-hit${edge.accent ? " is-accent" : ""}`}
            >
              <path
                d={edge.d}
                className="brand-canvas__wire-hitpath"
                fill="none"
                onPointerDown={(e) => removeEdge(edge.from, edge.to, e)}
              />
              <path
                d={edge.d}
                className={`brand-canvas__wire${
                  edge.mainline
                    ? " brand-canvas__wire--mainline-seg"
                    : edge.accent
                      ? " brand-canvas__wire--accent"
                      : ""
                }`}
                fill="none"
              />
            </g>
          ))}
          {mainlinePath ? (
            <path
              d={mainlinePath}
              className="brand-canvas__wire--mainline"
              fill="none"
            />
          ) : null}
          {linkFrom && nodeMap[linkFrom] ? (
            <circle
              className="brand-canvas__link-dot"
              cx={portPoint(nodeMap[linkFrom], "out").x}
              cy={portPoint(nodeMap[linkFrom], "out").y}
              r={5}
            />
          ) : null}
        </svg>

        {nodes.map(renderNode)}
      </div>

      <div className="brand-canvas__zoom">
        <button type="button" onClick={() => zoomBy(1.12)} aria-label="Zoom in">
          +
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(0.88)} aria-label="Zoom out">
          −
        </button>
      </div>

      {linkFrom ? (
        <p className="brand-canvas__hint">
          연결 중 · 다른 카드의 왼쪽 원을 클릭해 연결 · 같은 원 다시 클릭하면 취소
        </p>
      ) : editing && isTextNode(editing) ? (
        <p className="brand-canvas__hint">
          텍스트 수정 중 · Ctrl/⌘+Enter 저장 · Esc 취소
        </p>
      ) : selected ? (
        <p className="brand-canvas__hint">
          선택됨 · 더블클릭 수정 · 드래그 이동 · Delete 삭제
        </p>
      ) : null}

      {editing && !isTextNode(editing) ? (
        <NodeEditor
          node={editing}
          draft={draft}
          setDraft={setDraft}
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      ) : null}
    </div>
  );
}

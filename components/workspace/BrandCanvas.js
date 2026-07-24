import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.4;
const WORLD_W = 3200;
const WORLD_H = 1180;
const GRID = 18;
const DRAG_THRESHOLD = 3;
const ZOOM_STEP = 0.05;
const ZOOM_BTN_STEP = 0.1;
const WHEEL_ZOOM_PIXELS = 48;

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

function formatAiModel(tag) {
  const raw = String(tag || "").replace(/^#/, "").trim();
  if (!raw) return "";
  const map = {
    nanobanana: "NanoBanana",
    midjourney: "Midjourney",
    chatgpt: "ChatGPT",
    claude: "Claude",
    flux: "Flux",
    ideogram: "Ideogram",
    soul2: "Soul2",
    soul: "Soul",
  };
  const key = raw.toLowerCase();
  if (map[key]) return map[key];
  return raw;
}

function snap(n) {
  return Math.round(n / GRID) * GRID;
}

function snapZoom(z) {
  const stepped = Math.round(z / ZOOM_STEP) * ZOOM_STEP;
  return clamp(Number(stepped.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
}

function normalizeWheelDelta(e) {
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  if (e.deltaMode === 2) dy *= window.innerHeight || 800;
  return dy;
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
/** Minimum clear space between board rects (titles sit in this gutter). */
const ZONE_GAP = 80;

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

function zoneHitBox(z) {
  return { x: z.x, y: z.y, w: z.w, h: z.h };
}

function rectsOverlap(a, b, gap) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function isZoneAnchor(z) {
  return z.id === "main-flow" || z.tone === "flow" || z.id === "essentials";
}

/** Smallest translation that moves `moving` clear of `blocker` by `gap`. */
function minPushAway(blocker, moving, gap) {
  const a = zoneHitBox(blocker);
  const b = zoneHitBox(moving);
  if (!rectsOverlap(a, b, gap)) return null;

  const pushDown = a.y + a.h + gap - b.y;
  const pushRight = a.x + a.w + gap - b.x;
  const pushUp = a.y - (b.y + b.h + gap);
  const pushLeft = a.x - (b.x + b.w + gap);

  const xOverlap =
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOverlap =
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

  const opts = [];
  if (pushDown > 0) opts.push({ dx: 0, dy: pushDown, score: pushDown });
  if (pushRight > 0) opts.push({ dx: pushRight, dy: 0, score: pushRight });
  if (pushUp < 0) opts.push({ dx: 0, dy: pushUp, score: -pushUp });
  if (pushLeft < 0) opts.push({ dx: pushLeft, dy: 0, score: -pushLeft });
  if (!opts.length) return { dx: 0, dy: Math.max(pushDown, gap) };

  // Prefer vertical when boards share a column; horizontal when side-by-side.
  opts.sort((p, q) => {
    const pVert = p.dx === 0 ? 0 : 1;
    const qVert = q.dx === 0 ? 0 : 1;
    if (xOverlap > yOverlap) {
      if (pVert !== qVert) return pVert - qVert;
    } else if (yOverlap > xOverlap) {
      if (pVert !== qVert) return qVert - pVert;
    }
    return p.score - q.score;
  });
  return { dx: opts[0].dx, dy: opts[0].dy };
}

/**
 * Keep every board at least ZONE_GAP apart (never overlap).
 * Moves later / non-anchor boards; member cards shift with their board.
 * `preferId` = board that just grew — others yield to it.
 */
function enforceZoneGaps(zones, nodes, preferId = null, gap = ZONE_GAP) {
  if (!zones?.length) {
    return { zones, nodes, changed: false };
  }

  const next = zones.map((z) => ({ ...z }));
  const origin = Object.fromEntries(
    zones.map((z) => [z.id, { x: z.x, y: z.y }])
  );

  for (let pass = 0; pass < 20; pass += 1) {
    let moved = false;
    const ranked = next
      .map((z, i) => ({ z, i }))
      .sort((a, b) => a.z.y - b.z.y || a.z.x - b.z.x);

    for (let i = 0; i < ranked.length; i += 1) {
      for (let j = i + 1; j < ranked.length; j += 1) {
        const A = next[ranked[i].i];
        const B = next[ranked[j].i];
        if (!rectsOverlap(zoneHitBox(A), zoneHitBox(B), gap)) continue;

        let moveB = true;
        if (preferId === B.id && preferId !== A.id) moveB = false;
        else if (preferId === A.id) moveB = true;
        else if (isZoneAnchor(B) && !isZoneAnchor(A)) moveB = false;
        else if (isZoneAnchor(A) && !isZoneAnchor(B)) moveB = true;

        const blocker = moveB ? A : B;
        const target = moveB ? B : A;
        const push = minPushAway(blocker, target, gap);
        if (!push || (push.dx === 0 && push.dy === 0)) continue;
        target.x = snap(target.x + push.dx);
        target.y = snap(target.y + push.dy);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const deltas = {};
  for (const z of next) {
    const o = origin[z.id];
    const dx = z.x - o.x;
    const dy = z.y - o.y;
    if (dx || dy) deltas[z.id] = { dx, dy };
  }

  const zonesMoved = Object.keys(deltas).length > 0;
  const zonesResized = next.some(
    (z, i) =>
      z.w !== zones[i]?.w ||
      z.h !== zones[i]?.h ||
      z.x !== zones[i]?.x ||
      z.y !== zones[i]?.y
  );

  if (!zonesMoved) {
    return { zones: next, nodes, changed: zonesResized };
  }

  const nextNodes = nodes.map((n) => {
    const zid = resolveZoneId(n, next);
    const d = zid ? deltas[zid] : null;
    if (!d) return n;
    return { ...n, x: n.x + d.dx, y: n.y + d.dy };
  });

  return { zones: next, nodes: nextNodes, changed: true };
}

function portPoint(node, side) {
  const h = node.h || 80;
  const w = node.w || 200;
  return {
    x: side === "in" ? node.x : node.x + w,
    y: node.y + h / 2,
  };
}

function cubicPortPath(p1, p2, dir1, dir2) {
  const pull = Math.max(
    48,
    Math.min(160, Math.abs(p2.x - p1.x) * 0.45 + Math.abs(p2.y - p1.y) * 0.28)
  );
  return `M ${p1.x} ${p1.y} C ${p1.x + pull * dir1} ${p1.y}, ${p2.x + pull * dir2} ${p2.y}, ${p2.x} ${p2.y}`;
}

/** Directed spine segment: always previous OUT → next IN. */
function directedEdgePath(a, b) {
  return cubicPortPath(portPoint(a, "out"), portPoint(b, "in"), 1, -1);
}

/** Always attach wires to left/right ports (never card center / top-bottom). */
function edgePath(a, b) {
  const ca = center(a);
  const cb = center(b);
  if (cb.x >= ca.x) {
    return directedEdgePath(a, b);
  }
  return cubicPortPath(portPoint(a, "in"), portPoint(b, "out"), -1, 1);
}

/** Orange mainline: consecutive OUT→IN segments (ports stay attached). */
function buildMainlinePath(nodesInOrder) {
  if (nodesInOrder.length < 2) return "";
  return nodesInOrder
    .slice(0, -1)
    .map((n, i) => directedEdgePath(n, nodesInOrder[i + 1]))
    .join(" ");
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
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [zoneTitleDraft, setZoneTitleDraft] = useState("");
  const dragRef = useRef(null);
  const nodeDragRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const zonesRef = useRef(zones);
  const wheelAccRef = useRef(0);
  const moveRafRef = useRef(0);
  const pendingMoveRef = useRef(null);
  const spacePanRef = useRef(false);

  zoomRef.current = zoom;
  panRef.current = pan;
  zonesRef.current = zones;

  useEffect(() => {
    const built = buildNodes(board, extraNodes);
    setLinkEdges([...(board.connections || [])]);
    setLinkFrom(null);
    setSelectedId(null);
    setEditingId(null);

    if (onZonesChange && zonesRef.current?.length) {
      const enforced = enforceZoneGaps(zonesRef.current, built, null);
      if (enforced.changed) {
        zonesRef.current = enforced.zones;
        onZonesChange(enforced.zones);
        setNodes(enforced.nodes);
        return;
      }
    }
    setNodes(built);
  }, [project?.slug, board, extraNodes, onZonesChange]);

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
          d: isMainlineSeg ? directedEdgePath(a, b) : edgePath(a, b),
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

  const beginZoneTitleEdit = useCallback((zone, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setEditingId(null);
    setSelectedId(null);
    setEditingZoneId(zone.id);
    setZoneTitleDraft(zone.title || "");
  }, []);

  const cancelZoneTitleEdit = useCallback(() => {
    setEditingZoneId(null);
    setZoneTitleDraft("");
  }, []);

  const saveZoneTitleEdit = useCallback(() => {
    if (!editingZoneId || !onZonesChange) {
      cancelZoneTitleEdit();
      return;
    }
    const nextTitle = zoneTitleDraft.trim() || "Untitled";
    const fitted = zonesRef.current.map((z) =>
      z.id === editingZoneId ? { ...z, title: nextTitle } : z
    );
    zonesRef.current = fitted;
    onZonesChange(fitted);
    cancelZoneTitleEdit();
  }, [editingZoneId, zoneTitleDraft, onZonesChange, cancelZoneTitleEdit]);

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
      if (editingZoneId) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelZoneTitleEdit();
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
  }, [selectedId, editingId, editingZoneId, deleteNode, openEdit, cancelEdit, cancelZoneTitleEdit, nodeMap]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      spacePanRef.current = true;
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") spacePanRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const applyZoomAt = useCallback((nextZoom, anchorX, anchorY) => {
    const prevZoom = zoomRef.current;
    const z = snapZoom(nextZoom);
    if (z === prevZoom) return;
    const prevPan = panRef.current;
    const worldX = (anchorX - prevPan.x) / prevZoom;
    const worldY = (anchorY - prevPan.y) / prevZoom;
    const nextPan = {
      x: anchorX - worldX * z,
      y: anchorY - worldY * z,
    };
    zoomRef.current = z;
    panRef.current = nextPan;
    setZoom(z);
    setPan(nextPan);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();

      // Scroll / trackpad → pan. Pinch or Ctrl/Meta+wheel → zoom at viewport center.
      const zoomGesture = e.ctrlKey || e.metaKey;
      if (!zoomGesture) {
        const nextPan = {
          x: panRef.current.x - e.deltaX,
          y: panRef.current.y - e.deltaY,
        };
        panRef.current = nextPan;
        setPan(nextPan);
        return;
      }

      const mx = rect.width / 2;
      const my = rect.height / 2;

      wheelAccRef.current += normalizeWheelDelta(e);
      let steps = 0;
      while (wheelAccRef.current <= -WHEEL_ZOOM_PIXELS) {
        wheelAccRef.current += WHEEL_ZOOM_PIXELS;
        steps += 1;
      }
      while (wheelAccRef.current >= WHEEL_ZOOM_PIXELS) {
        wheelAccRef.current -= WHEEL_ZOOM_PIXELS;
        steps -= 1;
      }
      if (!steps) return;

      applyZoomAt(zoomRef.current + steps * ZOOM_STEP, mx, my);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoomAt]);

  const flushPendingMove = useCallback(() => {
    moveRafRef.current = 0;
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (!pending) return;

    if (pending.type === "node") {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === pending.id ? { ...n, x: pending.x, y: pending.y } : n
        )
      );
      return;
    }

    if (pending.type === "pan") {
      panRef.current = { x: pending.x, y: pending.y };
      setPan({ x: pending.x, y: pending.y });
    }
  }, []);

  const scheduleMove = useCallback(
    (payload) => {
      pendingMoveRef.current = payload;
      if (moveRafRef.current) return;
      moveRafRef.current = requestAnimationFrame(flushPendingMove);
    },
    [flushPendingMove]
  );

  const startPan = (e, captureEl) => {
    setSelectedId(null);
    nodeDragRef.current = null;
    setDraggingNode(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    setDragging(true);
    (captureEl || e.currentTarget).setPointerCapture?.(e.pointerId);
  };

  const onNodePointerDown = (e, node) => {
    if (e.target.closest(".bc-node__tools")) return;
    if (e.target.closest(".bc-inline")) return;
    if (e.target.closest(".bc-port")) return;
    if (editingId === node.id) return;

    // Middle / right / Space → pan canvas (titles & cards never trap navigation)
    if (e.button === 1 || e.button === 2 || spacePanRef.current) {
      e.stopPropagation();
      e.preventDefault();
      startPan(e, e.currentTarget);
      return;
    }
    if (e.button !== 0) return;

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
    if (e.button === 1 || e.button === 2 || spacePanRef.current) {
      e.preventDefault();
      startPan(e, e.currentTarget);
      return;
    }
    if (e.button !== 0) return;
    if (
      e.target.closest(".bc-node") ||
      e.target.closest(".bc-editor") ||
      e.target.closest(".bc-board__title") ||
      e.target.closest(".bc-board__title-input")
    ) {
      return;
    }
    startPan(e, e.currentTarget);
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
      scheduleMove({
        type: "node",
        id: d.id,
        x: d.originX + rawDx / d.zoom,
        y: d.originY + rawDy / d.zoom,
      });
      return;
    }

    if (!dragRef.current) return;
    scheduleMove({
      type: "pan",
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    });
  };

  const onPointerUp = (e) => {
    if (moveRafRef.current) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = 0;
    }
    if (pendingMoveRef.current) {
      flushPendingMove();
    }

    if (nodeDragRef.current) {
      const d = nodeDragRef.current;
      if (d.moved) {
        setNodes((prev) => {
          let next = prev.map((n) =>
            n.id === d.id ? { ...n, x: snap(n.x), y: snap(n.y) } : n
          );
          if (onZonesChange && d.zoneId) {
            let fitted = expandZoneToFit(
              zonesRef.current,
              d.zoneId,
              next,
              ZONE_PAD,
              [d.id]
            );
            const enforced = enforceZoneGaps(fitted, next, d.zoneId);
            fitted = enforced.zones;
            next = enforced.nodes;
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

  const zoomBy = (dir) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    applyZoomAt(
      zoomRef.current + dir * ZOOM_BTN_STEP,
      rect.width / 2,
      rect.height / 2
    );
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

    const linking = linkFrom === node.id;
    const ports = (
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
          title={linking ? "연결 취소" : "오른쪽 원 → 다른 노드 왼쪽 원으로 연결"}
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
    );

    if (node.kind === "card") {
      const accent = node.accent ? ` bc-card--${node.accent}` : "";
      return (
        <article
          key={node.id}
          id={node.id}
          className={`${cls} bc-card${accent}${node.fresh ? " is-fresh" : ""}${
            linking ? " is-linking" : ""
          }`}
          style={style}
          {...dragProps}
        >
          {ports}
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
          }${node.fresh ? " is-fresh" : ""}${linking ? " is-linking" : ""}`}
          style={style}
          {...dragProps}
        >
          {ports}
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
          {ports}
          {tools}
          {node.egoFlag ? <span className="bc-idea__ego-tag">Ego</span> : null}
          {!inlineEditing ? <AuthorBadge name={node.author} /> : null}
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
          className={`${cls} bc-comment${warn}${linking ? " is-linking" : ""}`}
          style={style}
          {...dragProps}
        >
          {ports}
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
          }${linking ? " is-linking" : ""}`}
          data-aspect={node.aspect || "fill"}
          data-fit={node.fit || "cover"}
          style={style}
          {...dragProps}
        >
          {ports}
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
        className={`${cls} bc-output bc-image--framed${
          node.egoFlag ? " bc-image--ego-warn" : ""
        }${node.fit === "contain" ? " bc-image--contain" : ""}${
          linking ? " is-linking" : ""
        }`}
        data-aspect={node.aspect || "fill"}
        data-fit={node.fit || "cover"}
        style={style}
        {...dragProps}
      >
        {ports}
        {tools}
        {node.egoFlag ? (
          <span className="bc-image__ego-tag">부적합</span>
        ) : null}
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
      onContextMenu={(e) => {
        if (dragging || dragRef.current) e.preventDefault();
      }}
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
          const isAiChrome =
            zone.tone === "flow" ||
            zone.tone === "base" ||
            zone.tone === "main";
          const labelTop = isAiChrome ? zone.y + 12 : zone.y - 28;
          const labelLeft = isAiChrome ? zone.x + 16 : zone.x;
          return (
            <div
              key={zone.id}
              className={`bc-board-wrap${activeZoneId === zone.id ? " is-active" : ""}${
                isBookend ? " is-bookend" : ""
              }${zone.tone === "flow" ? " is-flow" : ""}${
                isAiChrome ? " is-ai-chrome" : ""
              }`}
            >
              <div
                className={`bc-board__label${isAiChrome ? " bc-board__label--inset" : ""}`}
                style={{
                  left: labelLeft,
                  top: labelTop,
                  transform: `scale(${1 / zoom})`,
                  transformOrigin: isAiChrome ? "left top" : "left bottom",
                }}
              >
                {editingZoneId === zone.id ? (
                  <input
                    className="bc-board__title-input"
                    value={zoneTitleDraft}
                    autoFocus
                    aria-label="Board title"
                    onChange={(e) => setZoneTitleDraft(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveZoneTitleEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelZoneTitleEdit();
                      }
                    }}
                    onBlur={saveZoneTitleEdit}
                  />
                ) : (
                  <p
                    className="bc-board__title"
                    title="더블클릭하여 제목 수정"
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => beginZoneTitleEdit(zone, e)}
                  >
                    {zone.title}
                  </p>
                )}
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
              >
                {zone.aiModels?.length ? (
                  <div className="bc-board__ai-pills" aria-label="AI models used">
                    {zone.aiModels.map((tag) => (
                      <span key={tag} className="bc-board__ai-pill">
                        {formatAiModel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
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
              {/* Continuous orange mainlinePath already draws spine — skip duplicate seg stroke */}
              {!edge.mainline ? (
                <path
                  d={edge.d}
                  className={`brand-canvas__wire${
                    edge.accent ? " brand-canvas__wire--accent" : ""
                  }`}
                  fill="none"
                />
              ) : null}
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
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          +
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
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

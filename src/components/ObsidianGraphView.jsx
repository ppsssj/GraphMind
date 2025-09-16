// src/components/ObsidianGraphView.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import "../styles/ObsidianGraphView.css";

export default function ObsidianGraphView({
  notes = [],
  activeId,
  onActivate,
  onOpenStudio,
  focusTick = 0,
}) {
  const fgRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // === 전체 그래프 (정적) - 수식 + 배열 동시 처리 ===
  const fullGraph = useMemo(() => {
    const nodes = [];
    const links = [];
    const noteIds = new Set(notes.map((n) => n.id));

    // 노트(수식/배열) 노드
    notes.forEach((n) =>
      nodes.push({
        id: n.id,
        label: n.title,
        // ✅ 배열을 구분해서 칠할 수 있도록 타입 지정
        type: n.type === "array3d" ? "array" : "note",
      })
    );

    // 태그 노드 + 노트↔태그 링크
    const tagSet = new Set();
    notes.forEach((n) => {
      (n.tags || []).forEach((t) => {
        const tagId = `tag:${t}`;
        if (!tagSet.has(tagId)) {
          tagSet.add(tagId);
          nodes.push({ id: tagId, label: `#${t}`, type: "tag" });
        }
        links.push({ source: n.id, target: tagId });
      });
    });

    // 노트↔노트 링크 (수식-수식, 수식-배열, 배열-배열 모두 지원)
    notes.forEach((n) => {
      (n.links || []).forEach((lid) => {
        if (noteIds.has(lid)) links.push({ source: n.id, target: lid });
      });
    });

    return { nodes, links };
  }, [notes]);

  // === 크기 추적 ===
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // === 타임랩스 전용 상태 ===
  const [graph, setGraph] = useState({ nodes: [], links: [] }); // 현재 화면 그래프
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(false);

  // notes.updatedAt 기반 타임라인 (배열 포함)
  const timeline = useMemo(() => {
    const steps = [];
    const safeTime = (t) => {
      const v = Number(new Date(t));
      return Number.isFinite(v) ? v : 0;
    };
    const sortedNotes = [...notes].sort(
      (a, b) => safeTime(a.updatedAt) - safeTime(b.updatedAt)
    );

    const seenTags = new Set();
    for (const n of sortedNotes) {
      const t = safeTime(n.updatedAt);
      steps.push({
        t,
        type: "node",
        node: {
          id: n.id,
          label: n.title,
          type: n.type === "array3d" ? "array" : "note", // ✅
        },
      });

      for (const tag of n.tags || []) {
        const tagId = `tag:${tag}`;
        if (!seenTags.has(tagId)) {
          seenTags.add(tagId);
          steps.push({
            t,
            type: "node",
            node: { id: tagId, label: `#${tag}`, type: "tag" },
          });
        }
        steps.push({ t, type: "link", link: { source: n.id, target: tagId } });
      }
    }

    const noteIds = new Set(notes.map((n) => n.id));
    const idToTime = new Map(notes.map((n) => [n.id, safeTime(n.updatedAt)]));
    const dedup = new Set();
    for (const n of notes) {
      for (const lid of n.links || []) {
        if (!noteIds.has(lid)) continue;
        const key = n.id < lid ? `${n.id}|${lid}` : `${lid}|${n.id}`;
        if (dedup.has(key)) continue;
        dedup.add(key);

        const t = Math.max(idToTime.get(n.id) || 0, idToTime.get(lid) || 0);
        steps.push({ t, type: "link", link: { source: n.id, target: lid } });
      }
    }

    steps.sort((a, b) => a.t - b.t || (a.type === "node" ? -1 : 1));
    return steps;
  }, [notes]);

  const total = timeline.length;

  // 타임랩스 재생 루프
  useEffect(() => {
    if (!isPlaying) return;
    if (cursor >= total) {
      setIsPlaying(false);
      return;
    }

    const nextDelay = Math.max(50, 200 / speed);
    const to = setTimeout(() => {
      const step = timeline[cursor];
      setGraph((prev) => {
        if (step.type === "node") {
          if (prev.nodes.some((n) => String(n.id) === String(step.node.id)))
            return prev;
          return { nodes: [...prev.nodes, step.node], links: [...prev.links] };
        } else {
          const exists = prev.links.some(
            (l) =>
              String(l.source?.id || l.source) === String(step.link.source) &&
              String(l.target?.id || l.target) === String(step.link.target)
          );
          if (exists) return prev;
          return { nodes: [...prev.nodes], links: [...prev.links, step.link] };
        }
      });
      setCursor((c) => c + 1);
      fgRef.current?.d3ReheatSimulation?.();
    }, nextDelay);

    return () => clearTimeout(to);
  }, [isPlaying, cursor, speed, total, timeline]);

  // 타임랩스가 아닐 때 전체 그래프 표시
  useEffect(() => {
    if (!isPlaying && cursor === 0) setGraph(fullGraph);
  }, [fullGraph, isPlaying, cursor]);

  // 활성 노드로 카메라 이동
  useEffect(() => {
    if (!activeId || !fgRef.current) return;
    let tries = 0;
    const maxTries = 30;

    const tick = () => {
      if (!fgRef.current) return;
      const node =
        (graph?.nodes || []).find((n) => String(n.id) === String(activeId)) ||
        null;
      if (node && node.x != null && node.y != null) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(3, 600);
      } else if (tries++ < maxTries) {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }, [activeId, graph, focusTick]);

  // 초기 줌 레벨 설정
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.zoom(0.5, 600); // 초기 줌 레벨 설정
    }
  }, []);

  // 타임랩스 컨트롤
  const startTimelapse = () => {
    setIsPlaying(true);
    setCursor(0);
    setGraph({ nodes: [], links: [] });
  };
  const pauseTimelapse = () => setIsPlaying(false);
  const resumeTimelapse = () => {
    if (cursor >= total) return;
    setIsPlaying(true);
  };
  const resetTimelapse = () => {
    setIsPlaying(false);
    setGraph({ nodes: [], links: [] });
    setCursor(0);
    fgRef.current?.d3ReheatSimulation?.();
  };
  const showAll = () => {
    setIsPlaying(false);
    setGraph(fullGraph);
    setCursor(total);
    fgRef.current?.d3ReheatSimulation?.();
  };

  const currentTs = timeline[Math.min(cursor - 1, total - 1)]?.t;
  const currentDateLabel = currentTs
    ? new Date(currentTs).toLocaleString()
    : "";

  return (
    <div className="graph-wrap" ref={wrapRef}>
      {size.w > 0 && size.h > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          d3VelocityDecay={0.35}
          linkColor={() => "rgba(255,255,255,0.18)"}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.006}
          nodeRelSize={6}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label;
            const isActive = node.id === activeId;
            const fontSize = Math.max(8, 4 / globalScale + (isActive ? 3 : 0));

            // ✅ 타입별 색상
            let color = "#6ee7b7"; // note/equation (green)
            if (node.type === "tag") color = "#60a5fa"; // tag (blue)
            if (node.type === "array") color = "#f59e0b"; // array (amber)

            ctx.beginPath();
            ctx.arc(node.x, node.y, isActive ? 6 : 4, 0, Math.PI * 2, false);
            ctx.fillStyle = color;
            ctx.globalAlpha = isActive ? 1 : 0.9;
            ctx.fill();

            ctx.font = `${fontSize}px Inter, system-ui, -apple-system`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#e5e7eb";
            ctx.globalAlpha = isActive ? 1 : 0.9;
            ctx.fillText(` ${label}`, node.x + 6, node.y);
          }}
          onNodeClick={(node) => {
            const id = String(node.id);
            if (!id.startsWith("tag:")) onActivate(id);
          }}
          onNodeRightClick={(node) => {
            const id = String(node.id);
            if (!id.startsWith("tag:")) onOpenStudio(id);
          }}
          cooldownTime={8000}
          backgroundColor="#0f1115"
        />
      )}

      {/* 타임랩스 컨트롤 */}
      <div
        className="timelapse-controls"
        style={{
          position: "absolute",
          left: 20,
          bottom: 20,
          zIndex: 20,
          minWidth: 0,
        }}
      >
        {!showControls ? (
          <button
            className="tl-toggle-btn fade-in-right"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              fontSize: 22,
              color: "#60a5fa",
              transition: "all 0.4s",
            }}
            onClick={() => setShowControls(true)}
            aria-label="Show timelapse controls"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#60a5fa" strokeWidth="2" />
              <rect x="13" y="7" width="2" height="8" rx="1" fill="#60a5fa" />
              <rect x="13" y="14" width="7" height="2" rx="1" fill="#60a5fa" />
            </svg>
          </button>
        ) : (
          <div
            className="tl-controls-panel fade-in-left"
            style={{
              minWidth: 340,
              maxWidth: 480,
              background: "#181a20ee",
              borderRadius: 12,
              boxShadow: "0 2px 16px #0006",
              padding: 18,
              transition: "all 0.4s",
              width: "100%",
            }}
          >
            <button
              className="tl-close-btn"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#9aa4b2",
              }}
              onClick={() => setShowControls(false)}
              aria-label="Close timelapse controls"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <line
                  x1="5"
                  y1="5"
                  x2="15"
                  y2="15"
                  stroke="#9aa4b2"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="15"
                  y1="5"
                  x2="5"
                  y2="15"
                  stroke="#9aa4b2"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="tl-row">
              {!isPlaying && cursor === 0 && (
                <button className="tl-btn" onClick={startTimelapse}>
                  ▶ Play
                </button>
              )}
              {isPlaying && (
                <button className="tl-btn" onClick={pauseTimelapse}>
                  ⏸ Pause
                </button>
              )}
              {!isPlaying && cursor > 0 && cursor < total && (
                <button className="tl-btn" onClick={resumeTimelapse}>
                  ▶ Resume
                </button>
              )}
              <button className="tl-btn subtle" onClick={resetTimelapse}>
                ⟲ Reset
              </button>
              <button className="tl-btn subtle" onClick={showAll}>
                ▣ Show All
              </button>

              <div className="tl-sep" />
              <label className="tl-speed">
                Speed
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
                <span>{speed.toFixed(1)}x</span>
              </label>
            </div>

            <div className="tl-row">
              <div className="tl-progress">
                <div
                  className="tl-progress-fill"
                  style={{ width: `${(cursor / Math.max(1, total)) * 100}%` }}
                />
              </div>
              <div className="tl-stats">
                <span>
                  {cursor}/{total}
                </span>
                <span className="tl-date">{currentDateLabel}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="legend">
        <div className="row">
          <span className="dot note" /> Note (equation)
        </div>
        <div className="row">
          {/* ✅ 배열 범례 추가 (dot 기본 스타일을 재사용, 색상만 인라인) */}
          <span className="dot" style={{ background: "#f59e0b" }} /> Array (3D)
        </div>
        <div className="row">
          <span className="dot tag" /> Tag
        </div>
        <div style={{ fontSize: 11, color: "#9aa4b2" }}>
          • Left-click: select · Right-click: open in Studio
        </div>
      </div>
    </div>
  );
}

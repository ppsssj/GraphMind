import React, {
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function ObsidianGraphView({
  notes = [],
  activeId,
  onActivate,
  onOpenStudio,
}) {
  const fgRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const data = useMemo(() => {
    const nodes = [];
    const links = [];
    const noteIds = new Set(notes.map((n) => n.id));

    notes.forEach((n) =>
      nodes.push({ id: n.id, label: n.title, type: "note" })
    );

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

    notes.forEach((n) => {
      (n.links || []).forEach((lid) => {
        if (noteIds.has(lid)) links.push({ source: n.id, target: lid });
      });
    });

    return { nodes, links };
  }, [notes]);
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!activeId || !fgRef.current) return;

    const node = data.nodes.find((n) => String(n.id) === String(activeId));
    if (!node) return;

    let tries = 0;
    const maxTries = 20; // 대략 ~20 프레임(≈300ms) 안에 좌표 생김

    const tick = () => {
      if (!fgRef.current) return;
      if (node.x != null && node.y != null) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(3, 600);
      } else if (tries++ < maxTries) {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }, [activeId, data]);

  return (
    <div className="graph-wrap" ref={wrapRef}>
      {size.w > 0 && size.h > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          d3VelocityDecay={0.35}
          linkColor={() => "rgba(255,255,255,0.18)"}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.006}
          nodeRelSize={6}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label;
            const isActive = node.id === activeId;
            const fontSize = Math.max(8, 4 / globalScale + (isActive ? 3 : 0));

            ctx.beginPath();
            ctx.arc(node.x, node.y, isActive ? 6 : 4, 0, Math.PI * 2, false);
            ctx.fillStyle = node.type === "tag" ? "#60a5fa" : "#6ee7b7";
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

      <div className="legend">
        <div className="row">
          <span className="dot note" /> Note (equation)
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

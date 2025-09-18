// src/ui/LeftPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { create, all } from "mathjs";
const math = create(all, {});

// ── helpers ───────────────────────────────────────────
function normalizeFormula(raw) {
  if (!raw) return "x";
  let s = String(raw).trim();
  s = s.replace(/^y\s*=\s*/i, "");                  // "y = " 제거
  s = s.replace(/e\s*\^\s*\{([^}]+)\}/gi, "exp($1)"); // e^{...} → exp(...)
  s = s.replace(/(\d)(x)/gi, "$1*$2");              // 0.3x → 0.3*x
  return s;
}
function exprToFn(raw) {
  const expr = normalizeFormula(raw);
  try {
    const compiled = math.compile(expr);
    return (x) => {
      const y = Number(compiled.evaluate({ x }));
      return Number.isFinite(y) ? y : NaN;
    };
  } catch {
    return () => NaN;
  }
}

function array3dDims(content) {
  const Z = content?.length ?? 0;
  const Y = Z ? content[0]?.length ?? 0 : 0;
  const X = Y ? content[0][0]?.length ?? 0 : 0;
  return { X, Y, Z };
}
function array3dNonZero(content) {
  let cnt = 0;
  for (let z = 0; z < content.length; z++) {
    const yz = content[z] || [];
    for (let y = 0; y < yz.length; y++) {
      const row = yz[y] || [];
      for (let x = 0; x < row.length; x++) {
        if (row[x]) cnt++;
      }
    }
  }
  return cnt;
}

// ── Sparkline (2D 미니 프리뷰) ───────────────────────
function Sparkline({
  formula,
  width = 160,
  height = 40,
  xmin = -3,
  xmax = 3,
  samples = 100,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 배경 & 테두리
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#263044";
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    const fn = exprToFn(formula);
    const xs = Array.from({ length: samples }, (_, i) => xmin + (i * (xmax - xmin)) / (samples - 1));
    const pts = xs.map((x) => ({ x, y: fn(x) })).filter(p => Number.isFinite(p.y));
    if (pts.length < 2) return;

    // y 스케일 계산
    let ymin = Math.min(...pts.map(p => p.y));
    let ymax = Math.max(...pts.map(p => p.y));
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) return;
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const pad = (ymax - ymin) * 0.08;
    ymin -= pad; ymax += pad;

    const xToPx = (x) => ((x - xmin) / (xmax - xmin)) * (width - 8) + 4;
    const yToPx = (y) => height - (((y - ymin) / (ymax - ymin)) * (height - 8) + 4);

    // 라인 그리기
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#9aa7c7";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 마지막 점
    const last = pts[pts.length - 1];
    const lx = xToPx(last.x), ly = yToPx(last.y);
    ctx.fillStyle = "#c6d0f5";
    ctx.beginPath();
    ctx.arc(lx, ly, 1.75, 0, Math.PI * 2);
    ctx.fill();
  }, [formula, width, height, xmin, xmax, samples]);

  return <canvas ref={ref} className="sparkline" aria-hidden="true" />;
}

// ── LeftPanel (mixed resources 지원) ──────────────────
export default function LeftPanel({
  // 구형 호환 props
  equations = [],                // [{id,title,formula,tags,updatedAt}]
  // 신형 혼합 입력
  resources,                     // [{ type: "equation" | "array3d" | ... , ... }]
  // 액션 콜백
  onOpenQuick,                   // (formula:string) => void   - equation 전용
  onPreview,                     // (formula:string) => void   - equation 전용
  onOpenArray,                   // (res) => void              - array3d 전용 (없으면 onOpenResource로 fallback)
  onOpenResource,                // (res) => void              - 범용 열기
  onNew,                         // () => void
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const [showQuick, setShowQuick] = useState(false);

  // 입력 소스: resources가 있으면 우선 사용, 없으면 equations만 사용
  const items = useMemo(() => {
    if (Array.isArray(resources) && resources.length) return resources;
    return equations.map((e) => ({ ...e, type: "equation" }));
  }, [resources, equations]);

  const eqs = useMemo(() => items.filter((r) => r.type === "equation"), [items]);
  const arrs = useMemo(() => items.filter((r) => r.type === "array3d"), [items]);

  const tags = useMemo(() => {
    const tset = new Set();
    items.forEach((e) => (e.tags || []).forEach((t) => tset.add(t)));
    return ["all", ...Array.from(tset)];
  }, [items]);

  const filteredEqs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return eqs.filter((e) => {
      const byTag = tag === "all" || (e.tags || []).includes(tag);
      const byKw =
        !kw ||
        (e.title || "").toLowerCase().includes(kw) ||
        (e.formula || "").toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [eqs, q, tag]);

  const filteredArrs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return arrs.filter((a) => {
      const byTag = tag === "all" || (a.tags || []).includes(tag);
      const byKw = !kw || (a.title || "").toLowerCase().includes(kw);
      return byTag && byKw;
    });
  }, [arrs, q, tag]);

  const QUICK = ["x", "x^2", "x^3 - 2*x", "sin(x)", "cos(x)", "exp(x)-1", "log(x+1)"];

  const openArray = (res) => {
    if (onOpenArray) return onOpenArray(res);
    if (onOpenResource) return onOpenResource(res);
    // 최후: location.state로 보내는 쪽에서 처리하도록 상위에서 채워 넣어야 함
    console.warn("[LeftPanel] onOpenArray/onOpenResource 콜백이 없습니다.");
  };

  return (
    <aside className="left-panel explorer">
      {/* Open / New */}
      <div className="section">
        <div className="label">Open Graph</div>
        <button
          className="btn solid"
          onClick={() => {
            onNew?.();
            setShowQuick(true); // New Graph 를 누르면 Quick Picks 펼침
          }}
        >
          + New Graph
        </button>

        {/* Quick Picks - fade-down */}
        <div className={`fade-down ${showQuick ? "open" : ""}`}>
          <div className="label" style={{ marginTop: 10 }}>Quick Picks</div>
          <ul className="quick-list">
            {QUICK.map((f) => (
              <li key={f}>
                <button
                  className="btn ghost"
                  onClick={() => onOpenQuick?.(f)}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 검색/태그 */}
      <div className="section">
        <div className="label">Resources</div>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <input
            className="btn"
            style={{ padding: 6 }}
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="btn"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{ width: 120, padding: 6 }}
          >
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Equations 섹션 */}
      <div className="section">
        <div className="label">Equations</div>
        <ul className="eq-list">
          {filteredEqs.map((e) => (
            <li key={e.id} className="eq-item">
              <div className="eq-head">
                <div className="eq-title">{e.title}</div>
                {e.updatedAt && (
                  <div className="eq-updated">{new Date(e.updatedAt).toLocaleDateString()}</div>
                )}
              </div>

              <div className="eq-formula">{e.formula}</div>
              <Sparkline formula={e.formula} />

              {e.tags?.length ? (
                <div className="eq-tags">
                  {e.tags.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              ) : null}

              <div className="eq-actions">
                <button
                  className="btn solid"
                  onClick={() => onOpenQuick?.(e.formula)}
                  title="Open in a new tab"
                >
                  Open
                </button>
                <button
                  className="btn"
                  onClick={() => onPreview?.(e.formula)}
                  title="Preview in toolbar"
                >
                  Preview
                </button>
              </div>
            </li>
          ))}
          {filteredEqs.length === 0 && (
            <li className="eq-empty">No matches.</li>
          )}
        </ul>
      </div>

      {/* 3D Arrays 섹션 */}
      {arrs.length > 0 && (
        <div className="section">
          <div className="label">3D Arrays</div>
          <ul className="eq-list">
            {filteredArrs.map((a) => {
              const dims = array3dDims(a.content);
              const nnz = array3dNonZero(a.content);
              return (
                <li key={a.id} className="eq-item">
                  <div className="eq-head">
                    <div className="eq-title">{a.title}</div>
                    {a.updatedAt && (
                      <div className="eq-updated">{new Date(a.updatedAt).toLocaleDateString()}</div>
                    )}
                  </div>

                  <div className="eq-formula">
                    Size: {dims.X}×{dims.Y}×{dims.Z} &nbsp; | &nbsp; Non-zero: {nnz}
                  </div>

                  {a.tags?.length ? (
                    <div className="eq-tags">
                      {a.tags.map((t) => (
                        <span key={t} className="chip">{t}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="eq-actions">
                    <button
                      className="btn solid"
                      onClick={() => openArray(a)}
                      title="Open 3D Array"
                    >
                      Open
                    </button>
                  </div>
                </li>
              );
            })}
            {filteredArrs.length === 0 && (
              <li className="eq-empty">No matches.</li>
            )}
          </ul>
        </div>
      )}

      <div className="note">
        Tip: 상단 탭을 드래그해 오른쪽으로 떼면 VSCode처럼 화면이 분할돼요.
      </div>
    </aside>
  );
}

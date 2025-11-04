// src/pages/Studio.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { create, all } from "mathjs";
import LeftPanel from "../ui/LeftPanel";
import Toolbar from "../ui/Toolbar";
import GraphView from "../ui/GraphView";
import Array3DView from "../ui/Array3DView";
import { dummyEquations, dummyResources } from "../data/dummyEquations";
import "../styles/Studio.css";

const math = create(all, {});

// ── helpers ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const titleFromFormula = (f) => {
  const core = (f || "").replace(/\s+/g, "");
  return "y=" + (core.length > 24 ? core.slice(0, 24) + "…" : core);
};

function normalizeFormula(raw) {
  if (!raw) return "x";
  let s = String(raw).trim();
  s = s.replace(/^y\s*=\s*/i, "");
  s = s.replace(/e\s*\^\s*\{([^}]+)\}/gi, "exp($1)");
  s = s.replace(/(\d)(x)/gi, "$1*$2");
  return s;
}

function exprToFn(raw) {
  const rhs = raw?.includes("=") ? raw.split("=").pop() : raw;
  const expr = String(rhs ?? "").trim();
  if (!expr) return () => NaN;
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

function fitPolyCoeffs(xs, ys, degree) {
  const V = xs.map((x) => {
    const row = new Array(degree + 1);
    let p = 1;
    for (let j = 0; j <= degree; j++) {
      row[j] = p;
      p *= x;
    }
    return row;
  });
  const XT = math.transpose(V);
  const A = math.multiply(XT, V);
  const b = math.multiply(XT, ys);
  const sol = math.lusolve(A, b);
  return sol.map((v) => (Array.isArray(v) ? v[0] : v));
}

const coeffsToFn = (coeffs) => (x) => {
  let y = 0, p = 1;
  for (let i = 0; i < coeffs.length; i++) {
    y += coeffs[i] * p;
    p *= x;
  }
  return y;
};
// ────────────────────────────────────────────────────────────

// 간단한 배열용 툴바 (분할 토글 & 크기 표시)
function ArrayToolbar({ data, isSplit, setIsSplit }) {
  const Z = data?.length ?? 0;
  const Y = data?.[0]?.length ?? 0;
  const X = data?.[0]?.[0]?.length ?? 0;
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <strong>3D Array Viewer</strong>
        <span style={{ marginLeft: 12, opacity: 0.8 }}>Size: {X} × {Y} × {Z}</span>
      </div>
      <div className="toolbar-right">
        <button className="btn" onClick={() => setIsSplit((v) => !v)}>
          {isSplit ? "Merge View" : "Split View"}
        </button>
      </div>
    </div>
  );
}

export default function Studio() {
  const location = useLocation();

  // 리소스 타입 분기
  const resourceType = location.state?.type ?? "equation";
  const arrayData = resourceType === "array3d" ? (location.state?.content || [[[0]]]) : null;

  const initialFormula = normalizeFormula(
    typeof location.state?.formula === "string" && location.state.formula.trim()
      ? location.state.formula.trim()
      : "0.5*x^3 - 2*x"
  );

  // ── 수식 경로: 탭/분할/툴바 상태 ──
  const firstTabId = useMemo(() => uid(), []);
  const [tabs, setTabs] = useState(() => ({
    byId: { [firstTabId]: { id: firstTabId, title: titleFromFormula(initialFormula) } },
    all: [firstTabId],
  }));

  const makeInitialPoints = useCallback((formula, xmin = -3, xmax = 3, n = 8) => {
    const fn0 = exprToFn(formula);
    const xs = Array.from({ length: n }, (_, i) => xmin + ((xmax - xmin) * i) / (n - 1));
    return xs.map((x, i) => ({ id: i, x, y: Number(fn0(x)) || 0 }));
  }, []);

  const [tabState, setTabState] = useState(() => ({
    [firstTabId]: { equation: initialFormula, xmin: -3, xmax: 3, degree: 3, points: makeInitialPoints(initialFormula), ver: 0 },
  }));

  const [isSplit, setIsSplit] = useState(false);
  const [focusedPane, setFocusedPane] = useState("left");
  const [panes, setPanes] = useState({
    left: { ids: [firstTabId], activeId: firstTabId },
    right: { ids: [], activeId: null },
  });

  // 분할바 드래그
  const [leftPct, setLeftPct] = useState(55);
  const draggingRef = useRef(false);
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const container = document.querySelector(".vscode-split-root");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => (draggingRef.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const activeId = panes[focusedPane].activeId;
  const active = activeId ? tabState[activeId] : null;

  // 탭 ops
  const setActive = (paneKey, id) => {
    setPanes((s) => ({ ...s, [paneKey]: { ...s[paneKey], activeId: id } }));
    setFocusedPane(paneKey);
  };

  const createTab = useCallback((rawFormula, targetPane = focusedPane) => {
    const formula = normalizeFormula(rawFormula);
    const id = uid();
    setTabs((t) => ({
      byId: { ...t.byId, [id]: { id, title: titleFromFormula(formula) } },
      all: [...t.all, id],
    }));
    setTabState((st) => ({
      ...st,
      [id]: { equation: formula, xmin: -3, xmax: 3, degree: 3, points: makeInitialPoints(formula), ver: 0 },
    }));
    setPanes((p) => {
      const nextIds = [...p[targetPane].ids, id];
      return { ...p, [targetPane]: { ids: nextIds, activeId: id } };
    });
    setFocusedPane(targetPane);
  }, [focusedPane, makeInitialPoints]);

  const closeTab = (paneKey, id) => {
    setPanes((p) => {
      const ids = p[paneKey].ids.filter((x) => x !== id);
      let nextActive = p[paneKey].activeId;
      if (nextActive === id) nextActive = ids[ids.length - 1] ?? null;
      const next = { ...p, [paneKey]: { ids, activeId: nextActive } };
      if (paneKey === "right" && ids.length === 0) {
        setIsSplit(false);
        return { ...next, right: { ids: [], activeId: null } };
      }
      if (paneKey === "left" && ids.length === 0) {
        if (p.right.ids.length) {
          const [moved] = p.right.ids;
          return {
            left: { ids: [moved], activeId: moved },
            right: { ids: p.right.ids.slice(1), activeId: p.right.ids.slice(1)[0] ?? null },
          };
        }
      }
      return next;
    });
  };

  const moveTabToPane = (tabId, fromKey, toKey) => {
    if (fromKey === toKey) return;
    setPanes((p) => {
      const fromIds = p[fromKey].ids.filter((x) => x !== tabId);
      const toIds = [...p[toKey].ids, tabId];
      return {
        left: {
          ids: fromKey === "left" ? fromIds : toIds,
          activeId:
            fromKey === "left"
              ? p.left.activeId === tabId
                ? fromIds[0] ?? null
                : p.left.activeId
              : p.left.activeId,
        },
        right: {
          ids: fromKey === "right" ? fromIds : toIds,
          activeId:
            fromKey === "right"
              ? p.right.activeId === tabId
                ? fromIds[0] ?? null
                : p.right.activeId
              : tabId,
        },
      };
    });
  };

  // 탭 DnD
  const [dragMeta, setDragMeta] = useState(null);
  const dragPreviewRef = useRef(null);

  const makeDragCanvas = (text) => {
    const scale = window.devicePixelRatio || 1;
    const padX = 10; const fontPx = 12;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d");
    tctx.font = `${fontPx * scale}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    const tw = tctx.measureText(text).width / scale;
    const w = Math.min(240, Math.max(80, Math.ceil(tw) + padX * 2));
    const h = 28;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d"); ctx.scale(scale, scale);
    const r = 6;
    ctx.fillStyle = "#222a3b"; ctx.strokeStyle = "#33415c"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `${fontPx}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    ctx.textBaseline = "middle"; ctx.fillText(text, padX, h / 2);
    return canvas;
  };

  const onTabDragStart = (tabId, fromPane, e) => {
    setDragMeta({ tabId, fromPane });
    e.dataTransfer.setData("text/plain", tabId);
    e.dataTransfer.effectAllowed = "move";
    const title = tabs.byId[tabId]?.title ?? "Untitled";
    const img = makeDragCanvas(title);
    img.style.position = "fixed"; img.style.top = "-1000px"; img.style.left = "-1000px";
    document.body.appendChild(img);
    e.dataTransfer.setDragImage(img, 12, 14);
    dragPreviewRef.current = img;
    document.body.classList.add("dragging-tab");
  };

  const clearDropHighlights = () => {
    document.querySelectorAll(".right-drop-zone, .split-ghost-drop").forEach((el) => el.classList.remove("drop-active"));
  };

  const onTabDragEnd = () => {
    setDragMeta(null);
    document.body.classList.remove("dragging-tab");
    clearDropHighlights?.();
    if (dragPreviewRef.current) {
      try { document.body.removeChild(dragPreviewRef.current); } catch {}
      dragPreviewRef.current = null;
    }
  };

  // 우클릭 보내기
  const sendTabToOtherPane = (tabId, fromPane) => {
    if (fromPane === "left") {
      if (!isSplit) setIsSplit(true);
      moveTabToPane(tabId, "left", "right");
      setFocusedPane("right");
    } else {
      moveTabToPane(tabId, "right", "left");
      setFocusedPane("left");
    }
  };

  // 드롭존 보조 핸들러
  const onDropZoneEnter = (e) => { if (!dragMeta) return; e.currentTarget.classList.add("drop-active"); };
  const onDropZoneLeave = (e) => e.currentTarget.classList.remove("drop-active");
  const onRightDropOver = (e) => { if (!dragMeta) return; e.preventDefault(); e.currentTarget.classList.add("drop-active"); };
  const onRightDrop = (e) => {
    e.preventDefault(); if (!dragMeta) return;
    if (!isSplit) setIsSplit(true);
    moveTabToPane(dragMeta.tabId, dragMeta.fromPane, "right");
    setFocusedPane("right");
    onTabDragEnd();
  };

  // 활성 탭 상태 업데이트
  const activeUpdate = (patch) => { if (!activeId) return; setTabState((st) => ({ ...st, [activeId]: { ...st[activeId], ...patch } })); };
  const setEquationExpr = (eq) => activeUpdate({ equation: normalizeFormula(eq) });
  const setDegree = (d) => activeUpdate({ degree: d });
  const setXmin = (v) => activeUpdate({ xmin: v });
  const setXmax = (v) => activeUpdate({ xmax: v });

  const applyEquation = () => {
    if (!active) return;
    const fn = exprToFn(active.equation);
    setTabState((st) => {
      const cur = st[activeId];
      const newPts = cur.points.map((p) => ({ ...p, y: Number(fn(p.x)) || 0 }));
      return { ...st, [activeId]: { ...cur, points: newPts, ver: cur.ver + 1 } };
    });
  };

  const resampleDomain = () => {
    if (!active) return;
    const { xmin, xmax, degree, points } = active;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const coeffs = fitPolyCoeffs(xs, ys, Math.min(degree, Math.max(0, points.length - 1)));
    const f = coeffsToFn(coeffs);
    const n = points.length;
    const nx = Array.from({ length: n }, (_, i) => xmin + ((xmax - xmin) * i) / (n - 1));
    const newPts = nx.map((x, i) => ({ id: i, x, y: Number(f(x)) || 0 }));
    setTabState((st) => ({ ...st, [activeId]: { ...st[activeId], points: newPts, ver: st[activeId].ver + 1 } }));
  };

  // 파생값(캔버스용)
  function deriveFor(tabId) {
    if (!tabId) return null;
    const s = tabState[tabId];
    if (!s) return null;
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    const d = Math.min(s.degree, Math.max(0, s.points.length - 1));
    const coeffs = fitPolyCoeffs(xs, ys, d);
    return {
      typedFn: exprToFn(s.equation),
      fittedFn: coeffsToFn(coeffs),
      xmin: s.xmin,
      xmax: s.xmax,
      points: s.points,
      curveKey: coeffs.map((c) => c.toFixed(6)).join("|") + `|v${s.ver}`,
      updatePoint: (idx, xy) => setTabState((st) => {
        const cur = st[tabId];
        const nextPts = cur.points.map((p, i) => (i === idx ? { ...p, ...xy } : p));
        return { ...st, [tabId]: { ...cur, points: nextPts } };
      }),
    };
  }

  const leftActiveId = panes.left.activeId;
  const rightActiveId = panes.right.activeId;
  const leftPack = deriveFor(leftActiveId);
  const rightPack = deriveFor(rightActiveId);
  const navigate = useNavigate();
  // 탭바
  function TabBar({ paneKey }) {
    const ids = panes[paneKey].ids;
    const act = panes[paneKey].activeId;
    return (
      <div className="tabbar">
        {ids.map((id) => (
          <div
            key={id}
            className={`tab ${act === id ? "active" : ""}`}
            draggable
            onDragStart={(e) => onTabDragStart(id, paneKey, e)}
            onDragEnd={onTabDragEnd}
            onClick={() => setActive(paneKey, id)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); sendTabToOtherPane(id, paneKey); }}
            title="드래그하거나 우클릭해서 반대편으로 보내기"
          >
            <span className="tab-title">{tabs.byId[id]?.title ?? "Untitled"}</span>
            <button
              className="tab-close"
              draggable={false}
              onClick={(e) => { e.stopPropagation(); closeTab(paneKey, id); }}
              aria-label="close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ── 공통 레이아웃 ──
  return (
    <div className="studio-root">
      {/* 좌측 패널은 항상 표시 */}
      <LeftPanel
        onOpenQuick={(f) => createTab(f, focusedPane)}
        onNew={() => createTab("x", focusedPane)}
        equations={dummyEquations}
        resources={dummyResources}
        onPreview={(f) => { setEquationExpr(f); setFocusedPane(focusedPane); }}
        onOpenArray={(res)=>
          navigate("/studio", { state: { type: "array3d",title:res.title, content: res.content },
          })
        }
      />

      <div className="studio-main">
        {/* Toolbar: 타입별로 다르게 */}
        {resourceType === "equation" ? (
          active && (
            <Toolbar
              equationExpr={active.equation}
              setEquationExpr={setEquationExpr}
              onApply={applyEquation}
              degree={active.degree}
              setDegree={setDegree}
              xmin={active.xmin}
              xmax={active.xmax}
              setXmin={setXmin}
              setXmax={setXmax}
              onResampleDomain={resampleDomain}
            />
          )
        ) : (
          <ArrayToolbar data={arrayData} isSplit={isSplit} setIsSplit={setIsSplit} />
        )}

        <div className={`vscode-split-root ${isSplit ? "is-split" : ""}`}>
          {/* 왼쪽 Pane */}
          <div className="pane" style={{ width: isSplit ? `${leftPct}%` : "100%" }}>
            <div className="pane-title">Left</div>
            {resourceType === "equation" && <TabBar paneKey="left" />}
            <div className="pane-content">
              {resourceType === "equation" ? (
                leftPack ? (
                  <GraphView
                    key={`left-${leftActiveId}`}
                    points={leftPack.points}
                    updatePoint={leftPack.updatePoint}
                    xmin={leftPack.xmin}
                    xmax={leftPack.xmax}
                    fittedFn={leftPack.fittedFn}
                    typedFn={leftPack.typedFn}
                    curveKey={leftPack.curveKey}
                  />
                ) : (
                  <div className="empty-hint">왼쪽에 열린 탭이 없습니다.</div>
                )
              ) : (
                <Array3DView data={arrayData} />
              )}
            </div>
          </div>

          {/* 분할바 */}
          {isSplit && (
            <div
              className="divider"
              onMouseDown={() => (draggingRef.current = true)}
              title="드래그해서 크기 조절"
            />
          )}

          {/* 오른쪽 Pane */}
          {isSplit ? (
            <div className="pane" style={{ width: `${100 - leftPct}%` }}>
              <div className="pane-title">Right</div>
              {resourceType === "equation" && (
                <div
                  className="right-drop-zone"
                  onDragEnter={onDropZoneEnter}
                  onDragOver={onRightDropOver}
                  onDragLeave={onDropZoneLeave}
                  onDrop={onRightDrop}
                >
                  <TabBar paneKey="right" />
                  <div className="pane-content">
                    {rightPack ? (
                      <GraphView
                        key={`right-${rightActiveId}`}
                        points={rightPack.points}
                        updatePoint={rightPack.updatePoint}
                        xmin={rightPack.xmin}
                        xmax={rightPack.xmax}
                        fittedFn={rightPack.fittedFn}
                        typedFn={rightPack.typedFn}
                        curveKey={rightPack.curveKey}
                      />
                    ) : (
                      <div className="empty-hint">
                        상단의 탭을 이 영역으로 드래그하면 오른쪽 화면으로 이동합니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {resourceType === "array3d" && (
                <div className="pane-content">
                  <Array3DView data={arrayData} />
                </div>
              )}
            </div>
          ) : (
            // equation 전용 드롭존(분할 유도). array 모드에선 숨김.
            resourceType === "equation" && (
              <div
                className="split-ghost-drop"
                onDragEnter={onDropZoneEnter}
                onDragOver={onRightDropOver}
                onDragLeave={onDropZoneLeave}
                onDrop={onRightDrop}
                title="여기로 드롭하면 화면이 분할됩니다"
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

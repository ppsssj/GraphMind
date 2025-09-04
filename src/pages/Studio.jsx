// src/pages/Studio.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { create, all } from "mathjs";
import LeftPanel from "../ui/LeftPanel";
import Toolbar from "../ui/Toolbar";
import GraphView from "../ui/GraphView";
import "../styles/Studio.css";

const math = create(all, {});

// ── helpers ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const titleFromFormula = (f) => {
  const core = (f || "").replace(/\s+/g, "");
  return "y=" + (core.length > 24 ? core.slice(0, 24) + "…" : core);
};

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

export default function Studio() {
  const location = useLocation();
  const initialFormula =
    typeof location.state?.formula === "string" && location.state.formula.trim()
      ? location.state.formula.trim()
      : "0.5*x^3 - 2*x";

  // 탭 메타 (제목/ID)와 탭 상태(수식, 도메인, 차수, 포인트)를 분리 저장
  const firstTabId = useMemo(() => uid(), []);
  const [tabs, setTabs] = useState(() => ({
    byId: {
      [firstTabId]: { id: firstTabId, title: titleFromFormula(initialFormula) },
    },
    all: [firstTabId],
  }));

  const makeInitialPoints = useCallback((formula, xmin = -3, xmax = 3, n = 8) => {
    const fn0 = exprToFn(formula);
    const xs = Array.from({ length: n }, (_, i) => xmin + ((xmax - xmin) * i) / (n - 1));
    return xs.map((x, i) => ({ id: i, x, y: Number(fn0(x)) || 0 }));
  }, []);

  const [tabState, setTabState] = useState(() => ({
    [firstTabId]: {
      equation: initialFormula,
      xmin: -3,
      xmax: 3,
      degree: 3,
      points: makeInitialPoints(initialFormula),
      ver: 0, // 그래프 리마운트용
    },
  }));

  // VSCode처럼 두 에디터 그룹(pane) + DnD로 분할
  const [isSplit, setIsSplit] = useState(false);
  const [focusedPane, setFocusedPane] = useState("left");
  const [panes, setPanes] = useState({
    left: { ids: [firstTabId], activeId: firstTabId },
    right: { ids: [], activeId: null },
  });

  // 중앙 분할바 드래그
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

  // 활성 탭/상태
  const activeId = panes[focusedPane].activeId;
  const active = activeId ? tabState[activeId] : null;

  // ── 탭 조작 ────────────────────────────────────────────────
  const setActive = (paneKey, id) => {
    setPanes((s) => ({ ...s, [paneKey]: { ...s[paneKey], activeId: id } }));
    setFocusedPane(paneKey);
  };

  const createTab = useCallback((formula, targetPane = focusedPane) => {
    const id = uid();
    setTabs((t) => ({
      byId: { ...t.byId, [id]: { id, title: titleFromFormula(formula) } },
      all: [...t.all, id],
    }));
    setTabState((st) => ({
      ...st,
      [id]: {
        equation: formula,
        xmin: -3,
        xmax: 3,
        degree: 3,
        points: makeInitialPoints(formula),
        ver: 0,
      },
    }));
    setPanes((p) => {
      const nextIds = [...p[targetPane].ids, id];
      return {
        ...p,
        [targetPane]: { ids: nextIds, activeId: id },
      };
    });
    setFocusedPane(targetPane);
  }, [focusedPane, makeInitialPoints]);

  const closeTab = (paneKey, id) => {
    setPanes((p) => {
      const ids = p[paneKey].ids.filter((x) => x !== id);
      let activeId = p[paneKey].activeId;
      if (activeId === id) activeId = ids[ids.length - 1] ?? null;

      const next = { ...p, [paneKey]: { ids, activeId } };
      // 우측 모든 탭이 닫히면 분할 종료
      if (paneKey === "right" && ids.length === 0) {
        setIsSplit(false);
        return { ...next, right: { ids: [], activeId: null } };
      }
      // 좌측이 비는 건 방지(최소 1개 유지)
      if (paneKey === "left" && ids.length === 0) {
        // 좌측 비면 오른쪽 첫 탭을 좌측으로 이동
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
      const next = {
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
      return next;
    });
  };

  // ── 탭 DnD → 오른쪽 드롭 시 분할 ─────────────────────────
  const [dragMeta, setDragMeta] = useState(null); // { tabId, fromPane }
  const onTabDragStart = (tabId, fromPane, e) => {
    setDragMeta({ tabId, fromPane });
    e.dataTransfer.setData("text/plain", tabId);
    e.dataTransfer.effectAllowed = "move";
    document.body.classList.add("dragging-tab");
  };
  const onTabDragEnd = () => {
    setDragMeta(null);
    document.body.classList.remove("dragging-tab");
  };
  const onRightDropOver = (e) => {
    if (!dragMeta) return;
    e.preventDefault();
  };
  const onRightDrop = (e) => {
    e.preventDefault();
    if (!dragMeta) return;
    if (!isSplit) setIsSplit(true);
    moveTabToPane(dragMeta.tabId, dragMeta.fromPane, "right");
    setFocusedPane("right");
    onTabDragEnd();
  };

  // ── 활성 탭의 상태 업데이트 ───────────────────────────────
  const updateActiveState = (patch) => {
    if (!activeId) return;
    setTabState((st) => ({ ...st, [activeId]: { ...st[activeId], ...patch } }));
  };

  const setEquationExpr = (eq) => updateActiveState({ equation: eq });
  const setDegree = (d) => updateActiveState({ degree: d });
  const setXmin = (v) => updateActiveState({ xmin: v });
  const setXmax = (v) => updateActiveState({ xmax: v });

  const applyEquation = () => {
    if (!active) return;
    const fn = exprToFn(active.equation);
    setTabState((st) => {
      const cur = st[activeId];
      const newPts = cur.points.map((p, i) => ({ ...p, y: Number(fn(p.x)) || 0 }));
      return { ...st, [activeId]: { ...cur, points: newPts, ver: cur.ver + 1 } };
    });
  };

  // 도메인 변경 시 X 재분할 + 현재 "근사"로 Y 재샘플
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

    setTabState((st) => {
      const cur = st[activeId];
      return { ...st, [activeId]: { ...cur, points: newPts, ver: cur.ver + 1 } };
    });
  };

  // Toolbar에서 숫자 입력 후 엔터/포커스아웃이 없으니 버튼으로도 호출 가능
  // 사용자가 xmin/xmax/degree를 바꾼 뒤 즉시 재샘플하려면 아래를 버튼에 매달 수도 있음.

  // ── 렌더용 파생값(좌/우 각각) ────────────────────────────
  function deriveFor(tabId) {
    if (!tabId) return null;
    const state = tabState[tabId];
    if (!state) return null;
    const { points, degree } = state;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const d = Math.min(degree, Math.max(0, points.length - 1));
    const coeffs = fitPolyCoeffs(xs, ys, d);
    return {
      typedFn: exprToFn(state.equation),
      fittedFn: coeffsToFn(coeffs),
      xmin: state.xmin,
      xmax: state.xmax,
      points,
      curveKey: coeffs.map((c) => c.toFixed(6)).join("|") + `|v${state.ver}`,
      updatePoint: (idx, xy) =>
        setTabState((st) => {
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

  // ── TabBar 컴포넌트 ───────────────────────────────────────
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
            title="드래그해서 오른쪽으로 보내면 분할됩니다"
          >
            <span className="tab-title">{tabs.byId[id]?.title ?? "Untitled"}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(paneKey, id);
              }}
              aria-label="close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="studio-root">
      {/* 좌측: 그래프 열기(탐색기) 전용 */}
      <LeftPanel
        onOpenQuick={(formula) => createTab(formula, focusedPane)}
        onNew={() => createTab("x", focusedPane)}
      />

      {/* 우측: 툴바 + 에디터 그룹(분할 가능) */}
      <div className="studio-main">
        {/* 상단 툴바: 활성 탭 제어 */}
        {active && (
          <Toolbar
            equationExpr={active.equation}
            setEquationExpr={setEquationExpr}
            onApply={applyEquation}
            degree={active.degree}
            setDegree={(v) => {
              setDegree(v);
              // 필요 시 실시간 리핏만 원하면 여기서 ver++ 없이도 OK
            }}
            xmin={active.xmin}
            xmax={active.xmax}
            setXmin={setXmin}
            setXmax={setXmax}
            onResampleDomain={resampleDomain}
          />
        )}

        {/* 에디터 영역: 좌/우 그룹 */}
        <div className={`vscode-split-root ${isSplit ? "is-split" : ""}`}>
          {/* 왼쪽 Pane */}
          <div className="pane" style={{ width: isSplit ? `${leftPct}%` : "100%" }}>
            <div className="pane-title">Left</div>
            <TabBar paneKey="left" />
            {leftPack ? (
              <GraphView
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
            )}
          </div>

          {/* 분할바 */}
          {isSplit && (
            <div
              className="divider"
              onMouseDown={() => (draggingRef.current = true)}
              title="드래그해서 크기 조절"
            />
          )}

          {/* 오른쪽 Pane (드롭존) */}
          {isSplit ? (
            <div className="pane" style={{ width: `${100 - leftPct}%` }}>
              <div className="pane-title">Right</div>
              <div className="right-drop-zone" onDragOver={onRightDropOver} onDrop={onRightDrop}>
                <TabBar paneKey="right" />
                {rightPack ? (
                  <GraphView
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
          ) : (
            // 분할 전: 오른쪽에 고스트 드롭영역
            <div className="split-ghost-drop" onDragOver={onRightDropOver} onDrop={onRightDrop} />
          )}
        </div>
      </div>
    </div>
  );
}

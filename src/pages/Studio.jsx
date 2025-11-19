// src/pages/Studio.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { create, all } from "mathjs";
import LeftPanel from "../ui/LeftPanel";
import Toolbar from "../ui/Toolbar";
import GraphView from "../ui/GraphView";
import Array3DView from "../ui/Array3DView";
import Curve3DView from "../ui/Curve3DView";
import { dummyEquations, dummyResources } from "../data/dummyEquations";
import "../styles/Studio.css";
import AIPanel from "../components/ai/AIPanel";
const math = create(all, {});
const VAULT_KEY = "vaultResources"; // ✅ Vault localStorage 키

// ── helpers ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const titleFromFormula = (f) => {
  const core = (f || "")
    .replace(/^y\s*=\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
  if (!core) return "Untitled";
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
  let y = 0,
    p = 1;
  for (let i = 0; i < coeffs.length; i++) {
    y += coeffs[i] * p;
    p *= x;
  }
  return y;
};

// ────────────────────────────────────────────────────────────
// Array3D용 간단 Toolbar
function ArrayToolbar({ data, isSplit, setIsSplit }) {
  const Z = data?.length ?? 0;
  const Y = data?.[0]?.length ?? 0;
  const X = data?.[0]?.[0]?.length ?? 0;
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <strong>3D Array Viewer</strong>
        <span style={{ marginLeft: 12, opacity: 0.8 }}>
          Size: {X} × {Y} × {Z}
        </span>
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
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  // ✅ Vault에서 불러온 리소스 (localStorage → 없으면 dummyResources)
  const [vaultResources, setVaultResources] = useState(() => {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      if (!raw) return dummyResources;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : dummyResources;
    } catch {
      return dummyResources;
    }
  });

  // ✅ equation 타입만 필터링해서 LeftPanel "Equations" 섹션에 사용
  const equationsFromVault = useMemo(
    () => vaultResources.filter((r) => r.type === "equation"),
    [vaultResources]
  );

  // 초기 탭 타입 (페이지 모드에서 전달된 상태를 첫 탭에 반영)
  const rawType = location.state?.type ?? "equation";
  const initialType = rawType; // ✅ curve3d 그대로 유지

  const initialContent =
    initialType === "array3d" ? location.state?.content || [[[0]]] : null;

  // Vault에서 온 경우인지 / 어떤 노트에서 왔는지
  const fromVault = location.state?.from === "vault";
  const initialVaultId =
    fromVault && (initialType === "equation" || initialType === "curve3d") // ✅ curve3d도 vaultId 연결
      ? location.state?.id ?? null
      : null;

  // ✅ curve3d 초기 파라미터
  const initialCurve3d =
    initialType === "curve3d"
      ? {
          xExpr:
            location.state?.curve3d?.xExpr ?? location.state?.xExpr ?? "cos(t)",
          yExpr:
            location.state?.curve3d?.yExpr ?? location.state?.yExpr ?? "sin(t)",
          zExpr: location.state?.curve3d?.zExpr ?? location.state?.zExpr ?? "0",
          tMin: location.state?.curve3d?.tMin ?? location.state?.tMin ?? 0,
          tMax:
            location.state?.curve3d?.tMax ??
            location.state?.tMax ??
            6.283185307179586, // 2π 정도
          samples:
            location.state?.curve3d?.samples ?? location.state?.samples ?? 400,
        }
      : undefined;

  const initialFormula =
    initialType === "equation"
      ? normalizeFormula(
          typeof location.state?.formula === "string" &&
            location.state.formula.trim()
            ? location.state.formula.trim()
            : "0.5*x^3 - 2*x"
        )
      : "x";

  const firstTabId = useMemo(() => uid(), []);
  const [tabs, setTabs] = useState(() => ({
    byId: {
      [firstTabId]: {
        id: firstTabId,
        title:
          initialType === "equation"
            ? titleFromFormula(initialFormula)
            : location.state?.title ??
              (initialType === "array3d" ? "Array" : "Curve3D"), // ✅ curve3d 탭 제목 기본값
      },
    },
    all: [firstTabId],
  }));

  const makeInitialPoints = useCallback(
    (formula, xmin = -3, xmax = 3, n = 8) => {
      const fn0 = exprToFn(formula);
      const xs = Array.from(
        { length: n },
        (_, i) => xmin + ((xmax - xmin) * i) / (n - 1)
      );
      return xs.map((x, i) => ({ id: i, x, y: Number(fn0(x)) || 0 }));
    },
    []
  );

  // 각 탭 상태에 vaultId를 추가 (Vault에서 온 최초 탭만 연결)
  const [tabState, setTabState] = useState(() => ({
    [firstTabId]: {
      type: initialType,
      equation: initialType === "equation" ? initialFormula : undefined,
      content: initialType === "array3d" ? initialContent : undefined,
      curve3d: initialType === "curve3d" ? initialCurve3d : undefined, // ✅ 추가
      xmin: -3,
      xmax: 3,
      degree: 3,
      points:
        initialType === "equation" ? makeInitialPoints(initialFormula) : [],
      ver: 0,
      vaultId: initialVaultId,
    },
  }));

  const [isSplit, setIsSplit] = useState(false);
  const [focusedPane, setFocusedPane] = useState("left");
  // show/hide LeftPanel
  const [showLeftPanel, setShowLeftPanel] = useState(true);
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
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const [equationExpr, setEquationExpr] = useState(initialFormula);

  // ── 탭에서 poly-fit 파생 데이터 ────────────────────────
  const deriveFor = useCallback(
    (tabId) => {
      if (!tabId) return null;
      const s = tabState[tabId];
      if (!s || s.type !== "equation") return null;
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
        curveKey: coeffs.map((c) => c.toFixed(6)).join("|") + `|v${s.ver ?? 0}`,
        updatePoint: (idx, xy) =>
          setTabState((st) => {
            const cur = st[tabId];
            const nextPts = cur.points.map((p, i) =>
              i === idx ? { ...p, ...xy } : p
            );
            return {
              ...st,
              [tabId]: { ...cur, points: nextPts },
            };
          }),
      };
    },
    [tabState]
  );

  const leftActiveId = panes.left.activeId;
  const rightActiveId = panes.right.activeId;
  const leftPack = deriveFor(leftActiveId);
  const rightPack = deriveFor(rightActiveId);
  const leftActive = leftActiveId ? tabState[leftActiveId] : null;
  const rightActive = rightActiveId ? tabState[rightActiveId] : null;

  // ✅ Vault localStorage + state 안 수식 업데이트
  const updateVaultFormula = useCallback((vaultId, newEquation) => {
    if (!vaultId) return;
    setVaultResources((prev) => {
      const idx = prev.findIndex((n) => n.id === vaultId);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        formula: newEquation,
        updatedAt: new Date().toISOString(),
      };
      const next = [...prev];
      next[idx] = updated;
      try {
        localStorage.setItem(VAULT_KEY, JSON.stringify(next));
      } catch (err) {
        console.error("Failed to update vault note formula from Studio:", err);
      }
      return next;
    });
  }, []);

  // 탭 ops
  const setActive = (paneKey, id) => {
    setPanes((s) => ({
      ...s,
      [paneKey]: { ...s[paneKey], activeId: id },
    }));
    setFocusedPane(paneKey);
  };

  const createTab = useCallback(
    (
      raw,
      targetPane = focusedPane,
      tabType = "equation",
      tabContent = null,
      tabTitle = null,
      vaultId = null
    ) => {
      const id = uid();
      const type = tabType || "equation";
      const eq = type === "equation" ? normalizeFormula(raw ?? "x") : undefined;

      // ✅ curve3d 초기값 (다양한 리소스 스키마를 통합하여 xExpr/yExpr/zExpr/tMin/tMax/samples 형태로 만듦)
      let curve3dInit = undefined;
      if (type === "curve3d") {
        const payload =
          tabContent && typeof tabContent === "object"
            ? tabContent
            : raw && typeof raw === "object"
            ? raw
            : {};
        const xExpr = payload.xExpr ?? payload.x ?? "cos(t)";
        const yExpr = payload.yExpr ?? payload.y ?? "sin(t)";
        const zExpr = payload.zExpr ?? payload.z ?? "0";
        const tRange = payload.tRange;
        const tMin =
          payload.tMin ?? (Array.isArray(tRange) ? tRange[0] : undefined) ?? 0;
        const tMax =
          payload.tMax ??
          (Array.isArray(tRange) ? tRange[1] : undefined) ??
          2 * Math.PI;
        const samples = payload.samples ?? payload.sample ?? 400;
        curve3dInit = { xExpr, yExpr, zExpr, tMin, tMax, samples };
      }

      const title =
        tabTitle ||
        (type === "equation"
          ? titleFromFormula(eq)
          : raw?.title ?? (type === "array3d" ? "Array" : "Curve3D"));

      setTabs((t) => ({
        byId: { ...t.byId, [id]: { id, title } },
        all: [...t.all, id],
      }));

      setTabState((st) => ({
        ...st,
        [id]: {
          type,
          equation: eq,
          content: type === "array3d" ? tabContent : undefined,
          curve3d: type === "curve3d" ? curve3dInit : undefined, // ✅ 추가
          xmin: -3,
          xmax: 3,
          degree: 3,
          points: type === "equation" ? makeInitialPoints(eq) : [],
          ver: 0,
          vaultId,
        },
      }));

      setPanes((p) => {
        const nextIds = [...p[targetPane].ids, id];
        return { ...p, [targetPane]: { ids: nextIds, activeId: id } };
      });
      setFocusedPane(targetPane);
    },
    [focusedPane, makeInitialPoints]
  );

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
            right: {
              ids: p.right.ids.slice(1),
              activeId: p.right.ids.slice(1)[0] ?? null,
            },
          };
        } else {
          return {
            left: { ids: [], activeId: null },
            right: { ids: [], activeId: null },
          };
        }
      }
      return next;
    });
    setTabState((st) => {
      const ns = { ...st };
      delete ns[id];
      return ns;
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
    const padX = 10;
    const fontPx = 12;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d");
    tctx.font = `${
      fontPx * scale
    }px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    const tw = tctx.measureText(text).width / scale;
    const w = Math.min(240, Math.max(80, Math.ceil(tw) + padX * 2));
    const h = 28;

    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#1e2430";
    ctx.strokeStyle = "#4c8dff";
    ctx.lineWidth = 1;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 6;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `${fontPx}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2);
    return canvas;
  };

  const onTabDragStart = (tabId, fromPane, e) => {
    setDragMeta({ tabId, fromPane });
    e.dataTransfer.setData("text/plain", tabId);
    e.dataTransfer.effectAllowed = "move";
    const title = tabs.byId[tabId]?.title ?? "Untitled";
    const img = makeDragCanvas(title);
    img.style.position = "fixed";
    img.style.top = "-1000px";
    img.style.left = "-1000px";
    document.body.appendChild(img);
    dragPreviewRef.current = img;
    document.body.classList.add("dragging-tab");
    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
  };

  const onTabDragEnd = () => {
    setDragMeta(null);
    document.body.classList.remove("dragging-tab");
    if (dragPreviewRef.current) {
      try {
        document.body.removeChild(dragPreviewRef.current);
      } catch {}
      dragPreviewRef.current = null;
    }
  };

  const onTabClickSendOther = (tabId, fromPane) => {
    const toPane = fromPane === "left" ? "right" : "left";
    if (!isSplit && toPane === "right") {
      setIsSplit(true);
      moveTabToPane(tabId, "left", "right");
      setFocusedPane("right");
    } else {
      moveTabToPane(tabId, "right", "left");
      setFocusedPane("left");
    }
  };

  const onDropZoneEnter = (e) => {
    if (!dragMeta) return;
    e.currentTarget.classList.add("drop-active");
  };
  const onDropZoneLeave = (e) => {
    e.currentTarget.classList.remove("drop-active");
  };
  const onRightDropOver = (e) => {
    if (!dragMeta) return;
    e.preventDefault();
    e.currentTarget.classList.add("drop-active");
  };
  const onRightDrop = (e) => {
    e.preventDefault();
    if (!dragMeta) return;
    if (!isSplit) setIsSplit(true);
    moveTabToPane(dragMeta.tabId, dragMeta.fromPane, "right");
    setFocusedPane("right");
    onTabDragEnd();
  };

  // 활성 탭 상태 업데이트 helper
  const activeId = panes[focusedPane].activeId;
  const active = activeId ? tabState[activeId] : null;

  // 이전 placeholder 제거 — currentContext를 사용

  // 더 풍부한 탭 컨텍스트 객체 (AIPanel에 전달)
  const currentContext = useMemo(() => {
    try {
      const paneKey = focusedPane;
      const aid = panes[paneKey]?.activeId;
      const tab = tabs.byId[aid] || null;
      const s = tabState[aid] || null;
      if (!s) return { type: null };
      const base = {
        tabId: aid || null,
        pane: paneKey,
        title: tab?.title ?? null,
        type: s.type,
      };
      if (s.type === "equation") {
        return {
          ...base,
          equation: s.equation,
          xmin: s.xmin,
          xmax: s.xmax,
          degree: s.degree,
          points: s.points,
        };
      }
      if (s.type === "curve3d") {
        const c = s.curve3d || {};
        return {
          ...base,
          xExpr: c.xExpr ?? c.x,
          yExpr: c.yExpr ?? c.y,
          zExpr: c.zExpr ?? c.z,
          tMin: c.tMin,
          tMax: c.tMax,
          samples: c.samples,
        };
      }
      if (s.type === "array3d") {
        return {
          ...base,
          content: s.content,
        };
      }
      return base;
    } catch (e) {
      return { type: null };
    }
  }, [tabState, panes, focusedPane, tabs.byId]);

  const activeUpdate = (patch) => {
    if (!activeId) return;
    setTabState((st) => ({
      ...st,
      [activeId]: { ...st[activeId], ...patch },
    }));
  };

  const setEquationExprWrapped = (eq) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const norm = normalizeFormula(eq);

    // equation 상태 갱신
    setTabState((st) => ({
      ...st,
      [activeId]: { ...st[activeId], equation: norm },
    }));

    // Apply/Resample 등의 버튼에서 사용할 로컬 표시용 상태
    setEquationExpr(norm);
  };

  const setDegreeWrapped = (deg) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    activeUpdate({ degree: deg });
  };

  const setDomainXmin = (v) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    activeUpdate({ xmin: num });
  };
  const setDomainXmax = (v) => {
    if (!activeId) return;
    if (!active || active.type !== "equation") return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    activeUpdate({ xmax: num });
  };

  const applyEquation = () => {
    if (!active || !activeId) return;
    if (active.type !== "equation") return;
    const fn = exprToFn(active.equation);

    // Vault와 연결된 탭이면 localStorage의 vaultResources도 업데이트
    if (active.vaultId) {
      updateVaultFormula(active.vaultId, active.equation);
    }

    // 탭 제목도 동기화 (Apply 시에도 탭 제목이 업데이트)
    setTabs((t) => ({
      ...t,
      byId: {
        ...t.byId,
        [activeId]: {
          ...t.byId[activeId],
          title: titleFromFormula(active.equation),
        },
      },
    }));

    setTabState((st) => {
      const s = st[activeId];
      if (!s || s.type !== "equation") return st;
      const xs = s.points.map((p) => p.x);
      const ys = xs.map((x) => {
        const y = fn(x);
        return Number.isFinite(y) ? y : 0;
      });
      const d = Math.min(s.degree, Math.max(0, s.points.length - 1));
      const coeffs = fitPolyCoeffs(xs, ys, d);
      const fitted = coeffsToFn(coeffs);
      const nextPts = xs.map((x, i) => ({
        ...s.points[i],
        y: fitted(x),
      }));
      return {
        ...st,
        [activeId]: {
          ...s,
          points: nextPts,
          ver: (s.ver ?? 0) + 1,
        },
      };
    });
  };

  const resampleDomain = () => {
    if (!activeId) return;
    setTabState((st) => {
      const s = st[activeId];
      if (!s || s.type !== "equation") return st;
      const fn = exprToFn(s.equation);
      const xs = Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        return s.xmin + (s.xmax - s.xmin) * t;
      });
      const pts = xs.map((x, i) => ({
        id: i,
        x,
        y: Number(fn(x)) || 0,
      }));
      return {
        ...st,
        [activeId]: {
          ...s,
          points: pts,
          ver: (s.ver ?? 0) + 1,
        },
      };
    });
  };

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
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTabClickSendOther(id, paneKey);
            }}
            title="드래그하거나 우클릭해서 반대편으로 보내기"
          >
            <span className="tab-title">
              {tabs.byId[id]?.title ?? "Untitled"}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(paneKey, id);
              }}
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
      {/* 좌측 패널 (토글 가능) */}
      {showLeftPanel && (
        <LeftPanel
          onOpenQuick={(f) => createTab(f, "left")}
          onNew={() => createTab("x", "left")}
          equations={equationsFromVault}
          resources={vaultResources}
          onPreview={(f) => {
            setEquationExpr(f);
            setFocusedPane("left");
          }}
          onOpenArray={(res) =>
            createTab(null, "left", "array3d", res.content, res.title)
          }
          onOpenResource={(res) => {
            // pane별로 이미 열린 리소스(vaultId) 검사 (모든 타입에 대해 중복 방지)
            const paneKeys = ["left", "right"];
            for (const paneKey of paneKeys) {
              const paneTabIds = panes[paneKey].ids;
              const foundId = paneTabIds.find(
                (tid) => tabState[tid]?.vaultId === res.id
              );
              if (foundId) {
                setActive(paneKey, foundId);
                setFocusedPane(paneKey);
                return;
              }
            }
            // 새로 열 때는 LeftPanel에서 연다는 의도로 좌측에 생성
            if (res.type === "curve3d") {
              createTab(res, "left", "curve3d", res, res.title, res.id);
            } else if (res.type === "equation") {
              createTab(res.formula, "left", "equation", null, res.title, res.id);
            } else if (res.type === "array3d") {
              createTab(null, "left", "array3d", res.content, res.title, res.id);
            }
          }}
        />
      )}
      <div className="studio-main">
        {/* 상단 Toolbar 영역 */}
        {active && active.type === "equation" ? (
          <Toolbar
            equationExpr={active.equation}
            setEquationExpr={setEquationExprWrapped}
            onApply={applyEquation}
            degree={active.degree}
            setDegree={setDegreeWrapped}
            xmin={active.xmin}
            xmax={active.xmax}
            setXmin={setDomainXmin}
            setXmax={setDomainXmax}
            onResampleDomain={resampleDomain}
            showLeftPanel={showLeftPanel}
            onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
          />
        ) : active && active.type === "array3d" ? (
          <ArrayToolbar
            data={active.content}
            isSplit={isSplit}
            setIsSplit={setIsSplit}
          />
        ) : null}

        <div className={`vscode-split-root ${isSplit ? "is-split" : ""}`}>
          {/* 왼쪽 Pane */}
          <div
            className="pane"
            style={{ width: isSplit ? `${leftPct}%` : "100%" }}
          >
            <div className="pane-title">Left</div>
            <TabBar paneKey="left" />
            <div className="pane-content">
              {leftActive && leftActive.type === "equation" ? (
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
              ) : leftActive && leftActive.type === "array3d" ? (
                <Array3DView data={leftActive.content} />
              ) : leftActive && leftActive.type === "curve3d" ? ( // ✅ 추가
                <Curve3DView key={`curve-left-${leftActiveId}-${leftActive.vaultId ?? ""}`} curve3d={leftActive.curve3d} />
              ) : (
                <div className="empty-hint">왼쪽에 열린 탭이 없습니다.</div>
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
              <div
                className="right-drop-zone"
                onDragEnter={onDropZoneEnter}
                onDragOver={onRightDropOver}
                onDragLeave={onDropZoneLeave}
                onDrop={onRightDrop}
              >
                <div className="pane-title">Right</div>
                <TabBar paneKey="right" />
                <div className="pane-content">
                  {rightActive && rightActive.type === "equation" ? (
                    rightPack ? (
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
                        상단의 탭을 이 영역으로 드래그하면 오른쪽 화면으로
                        이동합니다.
                      </div>
                    )
                  ) : rightActive && rightActive.type === "array3d" ? (
                    <Array3DView data={rightActive.content} />
                  ) : rightActive && rightActive.type === "curve3d" ? ( // ✅ 추가
                    <Curve3DView   key={`curve-right-${rightActiveId}-${rightActive.vaultId ?? ""}`}curve3d={rightActive.curve3d} />
                  ) : (
                    <div className="empty-hint">
                      상단의 탭을 이 영역으로 드래그하면 오른쪽 화면으로
                      이동합니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // 분할이 없을 때는 항상 분할 생성 드롭존을 보여준다
            !isSplit && (
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
      <button
        className="ai-fab"
        type="button"
        onClick={() => setIsAIPanelOpen(true)}
      >
        <span className="ai-fab-icon">AI</span>
      </button>

      {/* AI 사이드 패널 */}
      <AIPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        currentContext={currentContext}
      />
    </div>
  );
}

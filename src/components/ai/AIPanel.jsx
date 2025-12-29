// src/components/ai/AIPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../../styles/AIPanel.css";

const PROXY_API_URL = "http://localhost:4000/api/ai/chat";

const TABS = [
  { id: "explain", label: "그래프 설명" },
  { id: "equation", label: "수식 도우미" },
  { id: "chat", label: "질문하기" },
  { id: "control", label: "그래프 조작" },
  { id: "history", label: "History" },
];

const GLOBAL_HISTORY_KEY = "gm_ai_history:all";
const TAB_HISTORY_KEY = (ctx) =>
  `gm_ai_history:${ctx?.type ?? "none"}:${ctx?.tabId ?? "none"}`;

function nowISO() {
  return new Date().toISOString();
}

function safeJsonStringify(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function extractJsonFromText(text) {
  if (!text) return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const firstObj = text.match(/\{[\s\S]*\}/);
  if (firstObj?.[0]) {
    try {
      return JSON.parse(firstObj[0]);
    } catch {}
  }
  return null;
}

function normalizeCmd(obj) {
  if (!obj || typeof obj !== "object") return null;

  const action = String(obj.action ?? "none");
  const target = obj.target ? String(obj.target) : undefined;
  const args = obj.args && typeof obj.args === "object" ? obj.args : undefined;
  const message = obj.message ? String(obj.message) : undefined;

  const allowed = new Set([
    "none",
    "mark_max",
    "mark_min",
    "mark_roots",
    "mark_intersections",
    "clear_markers",
    "closest_to_point",
    "slice_t",
    "tangent_at",
    "slice_x",
    "slice_y",
    "contour_z",
  ]);
  if (!allowed.has(action)) return null;

  return { action, target, args, message };
}

function buildContextPrefix(ctx) {
  if (!ctx) return "";

  if (ctx.type === "equation") {
    return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${
      ctx.tabId ?? "-"
    })\n수식: ${ctx.equation}\n도메인: [${ctx.xmin}, ${ctx.xmax}]\n\n`;
  }
  if (ctx.type === "curve3d") {
    return `현재 3D 곡선: ${ctx.title ?? "(untitled)"} (tabId:${
      ctx.tabId ?? "-"
    })\nx(t): ${ctx.xExpr}\ny(t): ${ctx.yExpr}\nz(t): ${ctx.zExpr}\n\n`;
  }
  if (ctx.type === "array3d" || ctx.type === "surface3d") {
    // Surface3D context (some projects use type="array3d")
    const expr = ctx.expr ?? ctx.zExpr ?? ctx.equation ?? null;
    const xMin = ctx.xMin ?? ctx.xmin ?? null;
    const xMax = ctx.xMax ?? ctx.xmax ?? null;
    const yMin = ctx.yMin ?? null;
    const yMax = ctx.yMax ?? null;
    return (
      `현재 3D 표면: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})
` +
      (expr
        ? `z(x,y): ${expr}
`
        : "") +
      (xMin !== null && xMax !== null
        ? `X 범위: [${xMin}, ${xMax}]
`
        : "") +
      (yMin !== null && yMax !== null
        ? `Y 범위: [${yMin}, ${yMax}]
`
        : "") +
      "\n"
    );
  }
  return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${
    ctx.tabId ?? "-"
  })\n\n`;
}

function formatKST(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { hour12: false });
  } catch {
    return iso;
  }
}

function relativeTime(iso) {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s 전`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h 전`;
    const d = Math.floor(h / 24);
    return `${d}d 전`;
  } catch {
    return "";
  }
}

function dayKey(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR");
  } catch {
    return "Unknown";
  }
}

function badgeLabel(tab) {
  if (tab === "control") return "CMD";
  if (tab === "chat") return "CHAT";
  if (tab === "equation") return "EQ";
  if (tab === "explain") return "EX";
  return String(tab ?? "-").toUpperCase();
}

function truncate(s, n) {
  const t = (s ?? "").toString().replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

function buildControlExtractorPrompt(ctx) {
  const type = ctx?.type ?? "none";

  // Base schema shared across tabs. `pane` and `tabId` are added by AIPanel when calling onCommand.
  const common = `
You are GraphMind Command Extractor.
Return ONLY ONE JSON object. No markdown. No commentary.

BaseSchema:
{
  "action": string,
  "target": "typed|fit",
  "args": object,
  "message": "Korean short status message"
}

GlobalRules:
- If unclear => action="none" and message asks for clarification.
- Defaults: target="typed"
`.trim();

  if (type === "equation") {
    return (
      common +
      `

Allowed actions (2D):
- none | mark_max | mark_min | mark_roots | mark_intersections | clear_markers

Args:
{
  "samples"?: number,
  "maxRoots"?: number,
  "maxIntersections"?: number,
  "tol"?: number
}

Rules:
- "최대값/최댓값" => mark_max
- "최소값/최솟값" => mark_min
- "근/영점/zero/roots" => mark_roots
- "교점/교차점/intersection" => mark_intersections
- "지워/삭제/클리어" => clear_markers

Defaults:
- args.samples=2500
- args.maxRoots=12
- args.maxIntersections=12
- args.tol=1e-6
`.trim()
    );
  }

  if (type === "curve3d") {
    return (
      common +
      `

Allowed actions (Curve3D parametric):
- none | mark_max | mark_min | mark_roots | mark_intersections | clear_markers
- closest_to_point | slice_t | tangent_at

Args:
{
  "axis"?: "x"|"y"|"z",         // for max/min/roots/intersections. default: "z"
  "samples"?: number,           // default: 800
  "maxRoots"?: number,          // default: 12
  "maxIntersections"?: number,  // default: 12

  "point"?: { "x": number, "y": number, "z": number }, // for closest_to_point (default point: origin)
  "t"?: number,                 // for slice_t / tangent_at
  "dt"?: number                 // for tangent_at numerical diff (default: 1e-3)
}

Rules:
- "z가 최대/최소", "높이가 최대/최소" => axis="z" + mark_max/min
- "x가 최대/최소" => axis="x"
- "y가 최대/최소" => axis="y"
- "축/axis"가 언급되지 않으면 axis="z"
- "가장 가까운 점 / 원점에 가장 가까운" => closest_to_point (point omitted => origin)
- "t=..." 또는 "t에서 점" => slice_t with args.t
- "접선 / tangent" => tangent_at with args.t
- "교점/교차점"은 typed vs fit(=base) 간 axis 교차로 해석 => mark_intersections

Defaults:
- args.axis="z"
- args.samples=800
- args.maxRoots=12
- args.maxIntersections=12
- args.point=(0,0,0) if missing
`.trim()
    );
  }

  // surface3d / array3d
  if (type === "surface3d" || type === "array3d") {
    return (
      common +
      `

Allowed actions (Surface3D z=f(x,y)):
- none | mark_max | mark_min | mark_roots | clear_markers
- contour_z | slice_x | slice_y | closest_to_point

Args:
{
  "samplesX"?: number,          // default: 80
  "samplesY"?: number,          // default: 80
  "maxRoots"?: number,          // default: 12
  "eps"?: number,               // root/contour tolerance (default: 1e-2)
  "dedupDist"?: number,         // default: 0.25

  "level"?: number,             // for contour_z (z=level). default: 0
  "x"?: number,                 // for slice_x
  "y"?: number,                 // for slice_y

  "point"?: { "x": number, "y": number, "z": number } // for closest_to_point (default: origin)
}

Rules:
- "최대/최소" => mark_max/min (z 기준)
- "z=0/등고선/contour" => contour_z with level (default 0)
- "x=... 단면/자르기" => slice_x with args.x
- "y=... 단면/자르기" => slice_y with args.y
- "가장 가까운 점 / 원점에 가장 가까운" => closest_to_point

Defaults:
- args.samplesX=80, args.samplesY=80
- args.level=0
- args.point=(0,0,0) if missing
`.trim()
    );
  }

  // fallback (unknown tab type)
  return (
    common +
    `

Allowed actions:
- none | clear_markers

If user asks to clear markers => clear_markers, else => none.
`.trim()
  );
}

export default function AIPanel({
  isOpen,
  onClose,
  currentContext,
  onCommand,
}) {
  const [activeTab, setActiveTab] = useState("explain");
  const [inputText, setInputText] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [localEdit, setLocalEdit] = useState(null);
  const [debouncedContext, setDebouncedContext] = useState(currentContext);

  const [historyScope, setHistoryScope] = useState("tab");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const ctxForKey = localEdit ||
    debouncedContext || { type: "none", tabId: "none" };
  const tabKey = TAB_HISTORY_KEY(ctxForKey);

  useEffect(() => {
    setLocalEdit(
      currentContext ? JSON.parse(JSON.stringify(currentContext)) : null
    );
    const t = setTimeout(() => setDebouncedContext(currentContext), 250);
    return () => clearTimeout(t);
  }, [currentContext]);

  const loadHistory = () => {
    const key = historyScope === "all" ? GLOBAL_HISTORY_KEY : tabKey;
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(arr) ? arr : [];
      setHistory(normalized);
      if (normalized.length && !normalized.some((x) => x.id === selectedId))
        setSelectedId(normalized[0].id);
      if (!normalized.length) setSelectedId(null);
    } catch {
      setHistory([]);
      setSelectedId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, historyScope, tabKey]);

  const appendHistoryBoth = (entry) => {
    try {
      const rawTab = localStorage.getItem(tabKey);
      const tabArr = rawTab ? JSON.parse(rawTab) : [];
      const nextTab = [entry, ...(Array.isArray(tabArr) ? tabArr : [])].slice(
        0,
        200
      );
      localStorage.setItem(tabKey, JSON.stringify(nextTab));
      if (historyScope === "tab") {
        setHistory(nextTab);
        setSelectedId((prev) => prev ?? entry.id);
      }
    } catch {}

    try {
      const rawAll = localStorage.getItem(GLOBAL_HISTORY_KEY);
      const allArr = rawAll ? JSON.parse(rawAll) : [];
      const nextAll = [entry, ...(Array.isArray(allArr) ? allArr : [])].slice(
        0,
        500
      );
      localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(nextAll));
      if (historyScope === "all") {
        setHistory(nextAll);
        setSelectedId((prev) => prev ?? entry.id);
      }
    } catch {}
  };

  const clearHistory = () => {
    const key = historyScope === "all" ? GLOBAL_HISTORY_KEY : tabKey;
    try {
      localStorage.removeItem(key);
    } catch {}
    setHistory([]);
    setSelectedId(null);
  };

  const restoreFromEntry = (e) => {
    if (!e) return;
    setActiveTab(e.tab ?? "chat");
    setInputText(e.input ?? "");
    setResultText(e.output ?? "");
  };

  const reapplyCommand = (e) => {
    if (!e?.parsed) return;
    if (typeof onCommand !== "function") return;
    const parsed = e.parsed;
    if (!parsed.action || parsed.action === "none") return;

    onCommand({
      ...parsed,
      tabId: e.tabId ?? null,
      type: e.ctxType ?? null,
    });

    setActiveTab("control");
    setResultText(parsed.message ?? "명령을 다시 적용했습니다.");
  };

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(t ?? "");
    } catch {}
  };

  const callLLM = async (messages, meta = {}) => {
    setIsLoading(true);
    setResultText("");

    const ctx = localEdit || debouncedContext || { type: null };
    const entryBase = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: nowISO(),
      tabId: ctx?.tabId ?? null,
      ctxType: ctx?.type ?? null,
      ctxTitle: ctx?.title ?? null,
      tab: meta.tab ?? activeTab,
      input: meta.input ?? inputText,
    };

    try {
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-5-chat-latest", messages }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const data = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ?? safeJsonStringify(data);

      const parsed = normalizeCmd(extractJsonFromText(content));
      const outputText = parsed?.message ? parsed.message : content;

      setResultText(outputText);

      appendHistoryBoth({
        ...entryBase,
        output: outputText,
        raw: content,
        parsed,
      });

      if (
        parsed &&
        parsed.action !== "none" &&
        typeof onCommand === "function"
      ) {
        onCommand({
          ...parsed,
          tabId: ctx?.tabId ?? null,
          type: ctx?.type ?? null,
        });
      }
    } catch (err) {
      const msg = String(err?.message ?? err);
      setResultText(msg);
      appendHistoryBoth({ ...entryBase, output: msg, raw: msg, parsed: null });
    } finally {
      setIsLoading(false);
    }
  };

  const ctx = localEdit || debouncedContext || { type: null };
  const prefix = buildContextPrefix(ctx);

  const handleExplainGraph = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 학습용 설명가다. 현재 그래프/탭 정보를 바탕으로 관찰 포인트를 한국어로 정리해라.",
      },
      {
        role: "user",
        content: prefix + "아래 정보를 설명해줘.\n\n" + safeJsonStringify(ctx),
      },
    ];
    callLLM(messages, { tab: "explain", input: safeJsonStringify(ctx) });
  };

  const handleEquation = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수식 정리 도우미다. 표준 형태로 정리하고 문법/연산자 우선순위를 한국어로 설명해라.",
      },
      { role: "user", content: prefix + "수식:\n" + inputText },
    ];
    callLLM(messages, { tab: "equation", input: inputText });
  };

  const handleChat = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 Q&A 튜터다. 질문에 관련 개념을 한국어로 설명해라. 필요하면 단계적으로 풀어줘.",
      },
      { role: "user", content: prefix + "질문:\n" + inputText },
    ];
    callLLM(messages, { tab: "chat", input: inputText });
  };

  const handleControl = () => {
    if (!inputText.trim()) {
      setResultText(
        "요청을 입력해 주세요. 예) '최대값 표시해줘', '근 표시해줘', '교점 표시해줘', '마커 지워줘'"
      );
      return;
    }

    const messages = [
      {
        role: "developer",
        content: buildControlExtractorPrompt(
          debouncedContext || currentContext
        ),
      },
      { role: "user", content: prefix + "UserRequest:\n" + inputText },
    ];
    callLLM(messages, { tab: "control", input: inputText });
  };

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return (history ?? []).filter((e) => {
      if (historyFilter !== "all" && e.tab !== historyFilter) return false;
      if (!q) return true;
      const hay = `${e.tab ?? ""} ${e.ctxTitle ?? ""} ${e.input ?? ""} ${
        e.output ?? ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [history, historyFilter, historyQuery]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const e of filteredHistory) {
      const k = dayKey(e.ts);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return Array.from(m.entries()).map(([k, arr]) => [k, arr]);
  }, [filteredHistory]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (history ?? []).find((x) => x.id === selectedId) ?? null;
  }, [history, selectedId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="ai-panel-backdrop" onClick={onClose} />
      <aside className="ai-panel">
        <header className="ai-panel-header">
          <div className="ai-panel-title">AI Panel</div>
          <button className="ai-panel-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ai-panel-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={
                "ai-panel-tab" +
                (activeTab === tab.id ? " ai-panel-tab-active" : "")
              }
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ai-panel-body">
          {activeTab === "explain" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">현재 탭 정보</div>
              <pre
                className="ai-panel-result-text"
                style={{ maxHeight: 150, overflow: "auto" }}
              >
                {safeJsonStringify(ctx)}
              </pre>
              <button
                className="ai-panel-primary-btn"
                onClick={handleExplainGraph}
                disabled={isLoading}
              >
                {isLoading ? "생성 중..." : "그래프 설명 생성"}
              </button>
              <div className="ai-panel-result">
                {resultText ? (
                  <pre className="ai-panel-result-text">{resultText}</pre>
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "equation" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">수식 입력</div>
              <textarea
                className="ai-panel-textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                className="ai-panel-primary-btn"
                onClick={handleEquation}
                disabled={isLoading}
              >
                {isLoading ? "정리 중..." : "수식 정리/설명"}
              </button>
              <div className="ai-panel-result">
                {resultText ? (
                  <pre className="ai-panel-result-text">{resultText}</pre>
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">질문</div>
              <textarea
                className="ai-panel-textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                className="ai-panel-primary-btn"
                onClick={handleChat}
                disabled={isLoading}
              >
                {isLoading ? "답변 생성 중..." : "질문 보내기"}
              </button>
              <div className="ai-panel-result">
                {resultText ? (
                  <pre className="ai-panel-result-text">{resultText}</pre>
                ) : (
                  <div className="ai-panel-placeholder">
                    출력이 여기 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "control" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">그래프 조작</div>

              <div className="ai-control-presets">
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => {
                    setInputText("최대값 표시해줘");
                  }}
                >
                  Max
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => {
                    setInputText("최소값 표시해줘");
                  }}
                >
                  Min
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => {
                    setInputText("근 표시해줘");
                  }}
                >
                  Roots
                </button>
                <button
                  className="ai-btn"
                  disabled={isLoading}
                  onClick={() => {
                    setInputText("교점 표시해줘");
                  }}
                >
                  Intersections
                </button>
                <button
                  className="ai-btn danger"
                  disabled={isLoading}
                  onClick={() => {
                    setInputText("마커 지워줘");
                  }}
                >
                  Clear
                </button>
              </div>

              <textarea
                className="ai-panel-textarea"
                placeholder="예) 최대값 표시해줘 / 근 표시해줘 / 교점 표시해줘 / 마커 지워줘"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button
                className="ai-panel-primary-btn"
                onClick={handleControl}
                disabled={isLoading}
              >
                {isLoading ? "실행 중..." : "명령 실행"}
              </button>

              <div className="ai-panel-result">
                {resultText ? (
                  <pre className="ai-panel-result-text">{resultText}</pre>
                ) : (
                  <div className="ai-panel-placeholder">결과가 표시됩니다.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="ai-history">
              <div className="ai-history-topbar">
                <div className="ai-history-topbar-left">
                  <select
                    className="ai-select"
                    value={historyScope}
                    onChange={(e) => setHistoryScope(e.target.value)}
                  >
                    <option value="tab">현재 탭</option>
                    <option value="all">전체</option>
                  </select>

                  <select
                    className="ai-select"
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                  >
                    <option value="all">전체</option>
                    <option value="control">조작</option>
                    <option value="chat">질문</option>
                    <option value="equation">수식</option>
                    <option value="explain">설명</option>
                  </select>

                  <input
                    className="ai-input"
                    placeholder="검색"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                  />
                </div>

                <div className="ai-history-topbar-right">
                  <button
                    className="ai-btn"
                    onClick={loadHistory}
                    title="새로고침"
                  >
                    ⟳
                  </button>
                  <button
                    className="ai-btn danger"
                    onClick={clearHistory}
                    title="삭제"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="ai-history-grid">
                <div className="ai-history-list">
                  {grouped.length === 0 ? (
                    <div className="ai-panel-placeholder">기록이 없습니다.</div>
                  ) : (
                    grouped.map(([k, arr]) => (
                      <div key={k} className="ai-history-group">
                        <div className="ai-history-day">{k}</div>
                        <div className="ai-history-items">
                          {arr.map((e) => {
                            const isSel = e.id === selectedId;
                            const title = truncate(
                              e.ctxTitle ?? "(untitled)",
                              34
                            );
                            const inPrev = truncate(e.input, 46);
                            const outPrev = truncate(e.output, 56);

                            return (
                              <button
                                key={e.id}
                                className={
                                  "ai-history-row" + (isSel ? " selected" : "")
                                }
                                onClick={() => setSelectedId(e.id)}
                                title={formatKST(e.ts)}
                              >
                                <div className="ai-history-row-top">
                                  <span className={"ai-pill " + (e.tab ?? "")}>
                                    {badgeLabel(e.tab)}
                                  </span>
                                  <span className="ai-history-row-title">
                                    {title}
                                  </span>
                                  <span className="ai-history-row-time">
                                    {relativeTime(e.ts)}
                                  </span>
                                </div>
                                <div className="ai-history-row-line">
                                  <span className="ai-dim">In</span>
                                  <span className="ai-strong">
                                    {inPrev || "-"}
                                  </span>
                                </div>
                                <div className="ai-history-row-line">
                                  <span className="ai-dim">Out</span>
                                  <span className="ai-dim2">
                                    {outPrev || "-"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="ai-history-detail">
                  {!selected ? (
                    <div className="ai-panel-placeholder">
                      왼쪽에서 기록을 선택하세요.
                    </div>
                  ) : (
                    <>
                      <div className="ai-history-detail-head">
                        <div className="ai-history-detail-head-left">
                          <span className={"ai-pill " + (selected.tab ?? "")}>
                            {badgeLabel(selected.tab)}
                          </span>

                          <div className="ai-history-detail-title">
                            <div className="ai-history-detail-title-main">
                              {selected.ctxTitle ?? "(untitled)"}
                            </div>
                            <div className="ai-history-detail-sub">
                              {formatKST(selected.ts)}
                            </div>
                          </div>
                        </div>

                        <div className="ai-history-detail-actions">
                          <button
                            className="ai-iconbtn"
                            onClick={() => restoreFromEntry(selected)}
                            title="다시보기"
                          >
                            ↩
                          </button>
                          <button
                            className="ai-iconbtn"
                            onClick={() => copyText(selected.output)}
                            title="출력 복사"
                          >
                            ⧉
                          </button>
                          <button
                            className="ai-iconbtn"
                            onClick={() => copyText(selected.input)}
                            title="입력 복사"
                          >
                            ⌁
                          </button>

                          {selected?.parsed?.action &&
                            selected.parsed.action !== "none" && (
                              <button
                                className="ai-iconbtn"
                                onClick={() => reapplyCommand(selected)}
                                title="재적용"
                              >
                                ⟲
                              </button>
                            )}

                          <button
                            className={
                              "ai-iconbtn" + (showRaw ? " active" : "")
                            }
                            onClick={() => setShowRaw((v) => !v)}
                            title="Raw 토글"
                          >
                            RAW
                          </button>
                        </div>
                      </div>

                      <div className="ai-history-detail-body">
                        <div className="ai-card">
                          <div className="ai-card-h">Input</div>
                          <pre className="ai-card-pre">
                            {selected.input ?? ""}
                          </pre>
                        </div>
                        <div className="ai-card">
                          <div className="ai-card-h">Output</div>
                          <pre className="ai-card-pre">
                            {selected.output ?? ""}
                          </pre>
                        </div>
                        {showRaw && (
                          <div className="ai-card">
                            <div className="ai-card-h">Raw</div>
                            <pre className="ai-card-pre">
                              {selected.raw ?? ""}
                            </pre>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="ai-history-footnote">
                History는 localStorage에 저장됩니다. (현재 탭 / 전체)
              </div>
            </div>
          )}
        </div>

        <footer className="ai-panel-footer">
          <div className="ai-panel-helper-text">AI 출력은 누적 저장됩니다.</div>
        </footer>
      </aside>
    </>
  );
}

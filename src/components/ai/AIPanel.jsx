// src/components/ai/AIPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/AIPanel.css";

// 프록시 서버 엔드포인트 (ai-proxy-server.js)
const PROXY_API_URL = "http://localhost:4000/api/ai/chat";

/**
 * AIPanel (with History + Graph Commands)
 *
 * - History is persisted in localStorage (global + per-tab).
 * - "그래프 조작" 탭: LLM은 "JSON만" 반환 → 파싱 성공 시 onCommand(cmd) 호출.
 *
 * Expected onCommand payload (Studio에서 처리):
 * {
 *   action: "mark_max"|"mark_min"|"mark_roots"|"mark_intersections"|"clear_markers"|"none",
 *   target?: "typed"|"fit",
 *   args?: { ... },
 *   message?: string,
 *   tabId?: string,
 *   type?: string
 * }
 */

const TABS = [
  { id: "explain", label: "그래프 설명" },
  { id: "equation", label: "수식 도우미" },
  { id: "chat", label: "질문하기" },
  { id: "control", label: "그래프 조작" },
  { id: "history", label: "History" },
];

const GLOBAL_HISTORY_KEY = "gm_ai_history:all";
const TAB_HISTORY_KEY = (ctx) => `gm_ai_history:${ctx?.type ?? "none"}:${ctx?.tabId ?? "none"}`;

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

  // ```json ... ```
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  // first {...}
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
  ]);
  if (!allowed.has(action)) return null;

  return { action, target, args, message };
}

function buildContextPrefix(ctx) {
  if (!ctx) return "";

  if (ctx.type === "equation") {
    return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})\n수식: ${ctx.equation}\n도메인: [${ctx.xmin}, ${ctx.xmax}]\n\n`;
  }
  if (ctx.type === "curve3d") {
    return `현재 3D 곡선: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})\nx(t): ${ctx.xExpr}\ny(t): ${ctx.yExpr}\nz(t): ${ctx.zExpr}\n\n`;
  }
  if (ctx.type === "array3d") {
    return `현재 3D 배열: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})\n(배열 본문은 생략)\n\n`;
  }
  return `현재 탭: ${ctx.title ?? "(untitled)"} (tabId:${ctx.tabId ?? "-"})\n\n`;
}

export default function AIPanel({ isOpen, onClose, currentContext, onCommand }) {
  const [activeTab, setActiveTab] = useState("explain");
  const [inputText, setInputText] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // context local edit
  const [localEdit, setLocalEdit] = useState(null);
  const [debouncedContext, setDebouncedContext] = useState(currentContext);

  // history
  const [historyScope, setHistoryScope] = useState("tab"); // "tab" | "all"
  const [history, setHistory] = useState([]);

  const ctxForKey = localEdit || debouncedContext || { type: "none", tabId: "none" };
  const tabKey = TAB_HISTORY_KEY(ctxForKey);

  // load/save history
  useEffect(() => {
    setLocalEdit(currentContext ? JSON.parse(JSON.stringify(currentContext)) : null);
    const t = setTimeout(() => setDebouncedContext(currentContext), 250);
    return () => clearTimeout(t);
  }, [currentContext]);

  useEffect(() => {
    // load history when panel opens or scope/context changes
    if (!isOpen) return;
    const key = historyScope === "all" ? GLOBAL_HISTORY_KEY : tabKey;
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(arr) ? arr : []);
    } catch {
      setHistory([]);
    }
  }, [isOpen, historyScope, tabKey]);

  const persistHistory = (next) => {
    const key = historyScope === "all" ? GLOBAL_HISTORY_KEY : tabKey;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    setHistory(next);
  };

  const appendHistoryBoth = (entry) => {
    // save into tab history
    try {
      const rawTab = localStorage.getItem(tabKey);
      const tabArr = rawTab ? JSON.parse(rawTab) : [];
      const nextTab = [entry, ...(Array.isArray(tabArr) ? tabArr : [])].slice(0, 200);
      localStorage.setItem(tabKey, JSON.stringify(nextTab));
      if (historyScope === "tab") setHistory(nextTab);
    } catch {}

    // save into global history
    try {
      const rawAll = localStorage.getItem(GLOBAL_HISTORY_KEY);
      const allArr = rawAll ? JSON.parse(rawAll) : [];
      const nextAll = [entry, ...(Array.isArray(allArr) ? allArr : [])].slice(0, 500);
      localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(nextAll));
      if (historyScope === "all") setHistory(nextAll);
    } catch {}
  };

  const clearHistory = () => {
    const key = historyScope === "all" ? GLOBAL_HISTORY_KEY : tabKey;
    try {
      localStorage.removeItem(key);
    } catch {}
    setHistory([]);
  };

  const restoreFromEntry = (e) => {
    if (!e) return;
    setActiveTab(e.tab ?? "chat");
    setInputText(e.input ?? "");
    setResultText(e.output ?? "");
  };

  // LLM call
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
        body: JSON.stringify({
          model: "gpt-5-chat-latest",
          messages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? safeJsonStringify(data);

      // command?
      const parsed = normalizeCmd(extractJsonFromText(content));

      // show message or raw
      const outputText = parsed?.message ? parsed.message : content;
      setResultText(outputText);

      // append history
      appendHistoryBoth({
        ...entryBase,
        output: outputText,
        raw: content,
        parsed,
      });

      // execute command
      if (parsed && parsed.action !== "none" && typeof onCommand === "function") {
        onCommand({
          ...parsed,
          tabId: ctx?.tabId ?? null,
          type: ctx?.type ?? null,
        });
      }
    } catch (err) {
      const msg = String(err?.message ?? err);
      setResultText(msg);
      appendHistoryBoth({
        ...entryBase,
        output: msg,
        raw: msg,
        parsed: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ctx = localEdit || debouncedContext || { type: null };
  const prefix = buildContextPrefix(ctx);

  // handlers
  const handleExplainGraph = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 학습용 설명가다. 사용자의 현재 그래프/탭 정보를 바탕으로 의미, 핵심 성질, 관찰 포인트를 한국어로 명확히 정리해라.",
      },
      {
        role: "user",
        content: prefix + "아래 그래프(또는 탭) 정보를 설명해줘.\n\n" + safeJsonStringify(ctx),
      },
    ];
    callLLM(messages, { tab: "explain", input: safeJsonStringify(ctx) });
  };

  const handleEquation = () => {
    const messages = [
      {
        role: "developer",
        content:
          "너는 수식 정리 도우미다. 사용자가 준 수식을 표준 형태로 정리하고, 문법/연산자 우선순위를 설명해라. 한국어로 답해라.",
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
          "너는 수학 Q&A 튜터다. 사용자의 질문에 관련 개념을 예시와 함께 한국어로 설명해라. 필요하면 단계적으로 풀어줘.",
      },
      { role: "user", content: prefix + "질문:\n" + inputText },
    ];
    callLLM(messages, { tab: "chat", input: inputText });
  };

  const handleControl = () => {
    if (!inputText.trim()) {
      setResultText("요청을 입력해 주세요. 예) '최대값 표시해줘', '근 표시해줘', '교점 표시해줘', '마커 지워줘'");
      return;
    }

    const messages = [
      {
        role: "developer",
        content: `
You are GraphMind Command Extractor.
Return ONLY ONE JSON object. No markdown. No commentary.

Schema:
{
  "action": "none|mark_max|mark_min|mark_roots|mark_intersections|clear_markers",
  "target": "typed|fit",
  "args": { "samples"?: number, "maxCount"?: number, "tol"?: number },
  "message": "Korean short status message"
}

Rules:
- "최대값/최댓값" => action=mark_max
- "최소값/최솟값" => action=mark_min
- "근/영점/zero/roots" => action=mark_roots
- "교점/교차점/intersection" => action=mark_intersections
- "지워/삭제/클리어" => action=clear_markers
- If unclear => action=none and message asks for clarification

Defaults:
- target="typed"
- args.samples=2500 for max/min
- args.maxCount=8 for roots/intersections
- args.tol=1e-6
        `.trim(),
      },
      { role: "user", content: prefix + "UserRequest:\n" + inputText },
    ];
    callLLM(messages, { tab: "control", input: inputText });
  };

  const onTabClick = (id) => {
    setActiveTab(id);
    // 결과/입력은 굳이 지우지 않음: "누적" UX 유지
  };

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(t ?? "");
    } catch {}
  };

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
              className={"ai-panel-tab" + (activeTab === tab.id ? " ai-panel-tab-active" : "")}
              onClick={() => onTabClick(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ai-panel-body">
          {activeTab === "explain" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">현재 탭 정보</div>
              <pre className="ai-panel-result-text" style={{ maxHeight: 160, overflow: "auto" }}>
                {safeJsonStringify(ctx)}
              </pre>

              <button className="ai-panel-primary-btn" onClick={handleExplainGraph} disabled={isLoading}>
                {isLoading ? "생성 중..." : "그래프 설명 생성"}
              </button>

              <div className="ai-panel-result">
                {resultText ? <pre className="ai-panel-result-text">{resultText}</pre> : <div className="ai-panel-placeholder">출력이 여기 표시됩니다.</div>}
              </div>
            </div>
          )}

          {activeTab === "equation" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">수식 입력</div>
              <textarea className="ai-panel-textarea" value={inputText} onChange={(e) => setInputText(e.target.value)} />
              <button className="ai-panel-primary-btn" onClick={handleEquation} disabled={isLoading}>
                {isLoading ? "정리 중..." : "수식 정리/설명"}
              </button>
              <div className="ai-panel-result">
                {resultText ? <pre className="ai-panel-result-text">{resultText}</pre> : <div className="ai-panel-placeholder">출력이 여기 표시됩니다.</div>}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">질문</div>
              <textarea className="ai-panel-textarea" value={inputText} onChange={(e) => setInputText(e.target.value)} />
              <button className="ai-panel-primary-btn" onClick={handleChat} disabled={isLoading}>
                {isLoading ? "답변 생성 중..." : "질문 보내기"}
              </button>
              <div className="ai-panel-result">
                {resultText ? <pre className="ai-panel-result-text">{resultText}</pre> : <div className="ai-panel-placeholder">출력이 여기 표시됩니다.</div>}
              </div>
            </div>
          )}

          {activeTab === "control" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label">그래프 조작</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} disabled={isLoading} onClick={() => { setInputText("최대값 표시해줘"); }}>
                  Max
                </button>
                <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} disabled={isLoading} onClick={() => { setInputText("최소값 표시해줘"); }}>
                  Min
                </button>
                <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} disabled={isLoading} onClick={() => { setInputText("근 표시해줘"); }}>
                  Roots
                </button>
                <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} disabled={isLoading} onClick={() => { setInputText("교점 표시해줘"); }}>
                  Intersections
                </button>
                <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} disabled={isLoading} onClick={() => { setInputText("마커 지워줘"); }}>
                  Clear
                </button>
              </div>

              <textarea
                className="ai-panel-textarea"
                placeholder="예) 최대값 표시해줘 / 근 표시해줘 / 교점 표시해줘 / 마커 지워줘"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />

              <button className="ai-panel-primary-btn" onClick={handleControl} disabled={isLoading}>
                {isLoading ? "실행 중..." : "명령 실행"}
              </button>

              <div className="ai-panel-result">
                {resultText ? <pre className="ai-panel-result-text">{resultText}</pre> : <div className="ai-panel-placeholder">LLM이 반환한 결과/상태가 표시됩니다.</div>}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="ai-panel-section">
              <div className="ai-panel-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>History</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={historyScope}
                    onChange={(e) => setHistoryScope(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid #2b2f3a",
                      background: "#0b0f17",
                      color: "#e7ecf3",
                      fontSize: 12,
                    }}
                  >
                    <option value="tab">현재 탭</option>
                    <option value="all">전체</option>
                  </select>
                  <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} onClick={clearHistory}>
                    삭제
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.length === 0 ? (
                  <div className="ai-panel-placeholder">아직 기록이 없습니다.</div>
                ) : (
                  history.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        border: "1px solid #1c2333",
                        borderRadius: 12,
                        padding: 10,
                        background: "#0b0f17",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <div style={{ color: "#cbd5e1", fontSize: 12 }}>
                          <b style={{ color: "#e7ecf3" }}>{e.tab ?? "-"}</b>{" "}
                          <span style={{ opacity: 0.8 }}>{e.ctxTitle ? `· ${e.ctxTitle}` : ""}</span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>{e.ts}</div>
                      </div>

                      <div style={{ color: "#e7ecf3", fontSize: 12, whiteSpace: "pre-wrap" }}>
                        <div style={{ opacity: 0.9, marginBottom: 6 }}>
                          <b>Input</b>: {e.input}
                        </div>
                        <div style={{ opacity: 0.9 }}>
                          <b>Output</b>: {e.output}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} onClick={() => restoreFromEntry(e)}>
                          다시보기
                        </button>
                        <button className="ai-panel-primary-btn" style={{ padding: "8px 10px" }} onClick={() => copyText(e.output)}>
                          복사
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="ai-panel-footer">
          <div className="ai-panel-helper-text">
            History는 localStorage에 저장됩니다. (현재 탭 / 전체)
          </div>
        </footer>
      </aside>
    </>
  );
}

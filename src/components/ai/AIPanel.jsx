// src/components/RightPane/AIPanel.jsx
import React, { useState, useEffect } from "react";
import "../../styles/AIPanel.css";

const TABS = [
  { id: "explain", label: "그래프 설명" },
  { id: "equation", label: "수식 도우미" },
  { id: "chat", label: "질문하기" },
];

// 프록시 서버 엔드포인트 (ai-proxy-server.js)
const PROXY_API_URL = "http://localhost:4000/api/ai/chat";

const AIPanel = ({ isOpen, onClose, currentContext }) => {
  const [activeTab, setActiveTab] = useState("explain");
  const [inputText, setInputText] = useState("");
  const [resultText, setResultText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 디바운스된 컨텍스트 — 탭 변경 시 잠깐 대기
  const [debouncedContext, setDebouncedContext] = useState(
    currentContext || { type: null }
  );
  // 패널 내부에서 사용자가 편집 가능한 로컬 폼 상태
  const [localEdit, setLocalEdit] = useState(currentContext || {});

  // 패널이 열릴 때마다 기본 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setActiveTab("explain");
      setInputText("");
      setResultText("");
      setIsLoading(false);
    }
  }, [isOpen]);

  // currentContext 변화에 대해 디바운스 적용 (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const next = currentContext || { type: null };
      setDebouncedContext(next);
      setLocalEdit(next);
    }, 300);
    return () => clearTimeout(t);
  }, [currentContext]);

  // 공통 LLM 호출 함수 (프록시 서버 호출)
  const callLLM = async (messages, model = "gpt-5-chat-latest") => {
    setIsLoading(true);
    setResultText("");

    try {
      const res = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const data = await res.json();
      const content =
        data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2);

      setResultText(content);
    } catch (err) {
      console.error(err);
      setResultText(`요청 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ====== 탭별 액션 ======

  // 그래프 설명 탭 — 탭 타입에 따라 더 자세한 컨텍스트 포함
  const handleExplainGraph = () => {
    const ctx = localEdit || debouncedContext || { type: null };
    if (!ctx || !ctx.type) {
      setResultText("현재 탭에 연결된 수식/리소스가 없습니다.");
      return;
    }

    let userContent = `탭: ${ctx.title ?? "(untitled)"} (id: ${
      ctx.tabId ?? "-"
    })\n유형: ${ctx.type}\n`;

    if (ctx.type === "equation") {
      userContent += `수식: ${ctx.equation}\n도메인: [${ctx.xmin}, ${
        ctx.xmax
      }]\n차수(설정): ${ctx.degree}\n샘플 포인트: ${
        Array.isArray(ctx.points) ? ctx.points.length : 0
      }개\n`;
      userContent +=
        "이 그래프의 전반적 형태(증가/감소, 극값, 대칭성, 정의역/치역 등)를 한국어로 쉽게 설명해줘.";
    } else if (ctx.type === "curve3d") {
      userContent += `x(t): ${ctx.xExpr}\ny(t): ${ctx.yExpr}\nz(t): ${
        ctx.zExpr
      }\n t ∈ [${ctx.tMin}, ${ctx.tMax}] (샘플: ${
        ctx.samples
      })\n`;
      userContent +=
        "3D 곡선의 형태, 주요 특징, 좌표별(특히 z축) 변화 포인트를 한국어로 설명해줘.";
    } else if (ctx.type === "array3d") {
      const dims =
        ctx.content && ctx.content.length
          ? `${ctx.content[0][0]?.length ?? 0}×${
              ctx.content[0]?.length ?? 0
            }×${ctx.content.length}`
          : "unknown";
      userContent += `3D 배열 치수(approx): ${dims}\n간단한 요약(예: 평균/최댓값/비어있는 셀 비율)을 알려줘.`;
    } else {
      userContent += "이 리소스에 대해 요약/설명을 제공해줘.";
    }

    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 학습을 도와주는 튜터야. 사용자가 보고 있는 그래프/리소스의 특징을 상황에 맞게 한국어로 쉽게 설명해 줘.",
      },
      { role: "user", content: userContent },
    ];

    callLLM(messages);
  };

  // 수식 도우미 탭
  const handleEquationHelp = () => {
    if (!inputText.trim()) {
      setResultText("먼저 수식을 입력해 주세요.");
      return;
    }

    const messages = [
      {
        role: "developer",
        content:
          "너는 수식을 정리해 주는 도우미야. 사용자가 입력한 수식의 문법 오류를 찾고, " +
          "같은 의미를 가지면서 더 깔끔한 형태의 표현을 1~2개 정도 제안해 줘. " +
          "필요하다면 간단한 설명도 한국어로 덧붙여 줘.",
      },
      {
        role: "user",
        content:
          "다음 수식을 검토해서 문법 오류가 있으면 알려주고, " +
          "동일 의미의 더 깔끔한 표현을 제안해 줘.\n\n" +
          inputText,
      },
    ];

    callLLM(messages);
  };

  // 질문하기 탭
  const handleChat = () => {
    if (!inputText.trim()) {
      setResultText("질문 내용을 먼저 입력해 주세요.");
      return;
    }

    const ctx = localEdit || debouncedContext || { type: null };
    let prefix = "";

    if (ctx && ctx.type) {
      if (ctx.type === "equation") {
        prefix = `현재 보고 있는 탭: ${
          ctx.title ?? "(untitled)"
        } (id:${ctx.tabId ?? "-"})\n수식: ${
          ctx.equation
        }\n도메인: [${ctx.xmin}, ${ctx.xmax}]\n\n`;
      } else if (ctx.type === "curve3d") {
        prefix = `현재 보고 있는 3D 곡선: ${
          ctx.title ?? "(untitled)"
        } (id:${ctx.tabId ?? "-"})\nx(t): ${ctx.xExpr}\ny(t): ${
          ctx.yExpr
        }\nz(t): ${ctx.zExpr}\n\n`;
      } else if (ctx.type === "array3d") {
        prefix = `현재 보고 있는 3D 배열: ${
          ctx.title ?? "(untitled)"
        } (id:${ctx.tabId ?? "-"})\n간단한 요약을 참고해서 질문을 답해줘.\n\n`;
      }
    }

    const messages = [
      {
        role: "developer",
        content:
          "너는 수학 학습용 Q&A 튜터야. 사용자의 질문에 대해 관련 개념을 예시와 함께 한국어로 자세히 설명해 줘. 가능한 한 고등학교~대학 초반 수준으로 설명해 줘.",
      },
      {
        role: "user",
        content: prefix + "아래 질문에 대해 설명해 줘.\n\n" + inputText,
      },
    ];

    callLLM(messages);
  };

  // ====== ai-panel-expression 영역: 편집 가능한 폼 ======

  const handleFieldChange = (field, value) => {
    setLocalEdit((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderExplainTab = () => {
    const baseCtx = localEdit && localEdit.type ? localEdit : debouncedContext;
    const ctx = baseCtx || { type: null };
    const empty = !ctx || !ctx.type;

    const renderBody = () => {
      if (empty) return <div>현재 활성 탭의 리소스가 없습니다.</div>;

      if (ctx.type === "equation") {
        return (
          <div className="ai-panel-form">
            <label className="ai-panel-field">
              <span className="ai-panel-field-label">탭 제목</span>
              <input
                className="ai-panel-input"
                value={ctx.title ?? ""}
                onChange={(e) =>
                  handleFieldChange("title", e.target.value)
                }
              />
            </label>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">수식</span>
              <input
                className="ai-panel-input"
                value={ctx.equation ?? ""}
                onChange={(e) =>
                  handleFieldChange("equation", e.target.value)
                }
              />
            </label>

            <div className="ai-panel-field-row">
              <label className="ai-panel-field half">
                <span className="ai-panel-field-label">xmin</span>
                <input
                  className="ai-panel-input"
                  value={ctx.xmin ?? ""}
                  onChange={(e) =>
                    handleFieldChange("xmin", e.target.value)
                  }
                />
              </label>
              <label className="ai-panel-field half">
                <span className="ai-panel-field-label">xmax</span>
                <input
                  className="ai-panel-input"
                  value={ctx.xmax ?? ""}
                  onChange={(e) =>
                    handleFieldChange("xmax", e.target.value)
                  }
                />
              </label>
            </div>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">차수(degree)</span>
              <input
                className="ai-panel-input"
                value={ctx.degree ?? ""}
                onChange={(e) =>
                  handleFieldChange("degree", e.target.value)
                }
              />
            </label>

            <div className="ai-panel-meta">
              샘플 포인트: {ctx.points?.length ?? 0}개 (읽기 전용)
            </div>
          </div>
        );
      }

      if (ctx.type === "curve3d") {
        return (
          <div className="ai-panel-form">
            <label className="ai-panel-field">
              <span className="ai-panel-field-label">탭 제목</span>
              <input
                className="ai-panel-input"
                value={ctx.title ?? ""}
                onChange={(e) =>
                  handleFieldChange("title", e.target.value)
                }
              />
            </label>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">x(t)</span>
              <input
                className="ai-panel-input"
                value={ctx.xExpr ?? ""}
                onChange={(e) =>
                  handleFieldChange("xExpr", e.target.value)
                }
              />
            </label>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">y(t)</span>
              <input
                className="ai-panel-input"
                value={ctx.yExpr ?? ""}
                onChange={(e) =>
                  handleFieldChange("yExpr", e.target.value)
                }
              />
            </label>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">z(t)</span>
              <input
                className="ai-panel-input"
                value={ctx.zExpr ?? ""}
                onChange={(e) =>
                  handleFieldChange("zExpr", e.target.value)
                }
              />
            </label>

            <div className="ai-panel-field-row">
              <label className="ai-panel-field half">
                <span className="ai-panel-field-label">t min</span>
                <input
                  className="ai-panel-input"
                  value={ctx.tMin ?? ""}
                  onChange={(e) =>
                    handleFieldChange("tMin", e.target.value)
                  }
                />
              </label>
              <label className="ai-panel-field half">
                <span className="ai-panel-field-label">t max</span>
                <input
                  className="ai-panel-input"
                  value={ctx.tMax ?? ""}
                  onChange={(e) =>
                    handleFieldChange("tMax", e.target.value)
                  }
                />
              </label>
            </div>

            <label className="ai-panel-field">
              <span className="ai-panel-field-label">samples</span>
              <input
                className="ai-panel-input"
                value={ctx.samples ?? ""}
                onChange={(e) =>
                  handleFieldChange("samples", e.target.value)
                }
              />
            </label>
          </div>
        );
      }

      if (ctx.type === "array3d") {
        const Z = ctx.content?.length ?? 0;
        const Y = ctx.content?.[0]?.length ?? 0;
        const X = ctx.content?.[0]?.[0]?.length ?? 0;

        return (
          <div className="ai-panel-form">
            <label className="ai-panel-field">
              <span className="ai-panel-field-label">탭 제목</span>
              <input
                className="ai-panel-input"
                value={ctx.title ?? ""}
                onChange={(e) =>
                  handleFieldChange("title", e.target.value)
                }
              />
            </label>

            <div className="ai-panel-meta">
              3D Array size (읽기 전용): {X}×{Y}×{Z}
            </div>
          </div>
        );
      }

      return <div>Unknown resource type.</div>;
    };

    return (
      <div className="ai-panel-section">
        <div className="ai-panel-label">현재 탭 정보 (편집 가능)</div>
        <div className="ai-panel-expression">{renderBody()}</div>

        <button
          className="ai-panel-primary-btn"
          onClick={handleExplainGraph}
          disabled={isLoading}
        >
          {isLoading ? "분석 중..." : "그래프 설명 생성"}
        </button>

        <div className="ai-panel-result">
          {resultText ? (
            <pre className="ai-panel-result-text">{resultText}</pre>
          ) : (
            <div className="ai-panel-placeholder">
              위 정보를 필요에 맞게 수정한 뒤, 버튼을 눌러 설명을 생성해 보세요.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEquationTab = () => (
    <div className="ai-panel-section">
      <div className="ai-panel-label">수식 입력</div>
      <textarea
        className="ai-panel-textarea"
        placeholder="문법이 애매한 수식, 너무 복잡한 수식을 붙여넣어 보세요."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
      />
      <button
        className="ai-panel-primary-btn"
        onClick={handleEquationHelp}
        disabled={isLoading}
      >
        {isLoading ? "분석 중..." : "수식 리팩토링 제안 받기"}
      </button>

      <div className="ai-panel-result">
        {resultText ? (
          <pre className="ai-panel-result-text">{resultText}</pre>
        ) : (
          <div className="ai-panel-placeholder">
            수식을 입력하고 버튼을 눌러 AI 제안을 확인해 보세요.
          </div>
        )}
      </div>
    </div>
  );

  const renderChatTab = () => (
    <div className="ai-panel-section">
      <div className="ai-panel-label">질문</div>
      <textarea
        className="ai-panel-textarea"
        placeholder="이 그래프, 개념, 문제에 대해 궁금한 점을 자유롭게 물어보세요."
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
            질문을 입력하면 이 영역에 AI의 답변이 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="ai-panel-backdrop" />
      <aside className="ai-panel">
        <header className="ai-panel-header">
          <div className="ai-panel-title">GraphMind AI</div>
          <button className="ai-panel-close-btn" onClick={onClose}>
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
              onClick={() => {
                setActiveTab(tab.id);
                setResultText("");
                setInputText("");
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ai-panel-body">
          {activeTab === "explain" && renderExplainTab()}
          {activeTab === "equation" && renderEquationTab()}
          {activeTab === "chat" && renderChatTab()}
        </div>

        <footer className="ai-panel-footer">
          <div className="ai-panel-helper-text">
            이 패널은 로컬 프록시 서버(https://factchat-cloud → ai-proxy-server)를
            통해 LLM API를 호출하는 테스트용 UI입니다.
          </div>
        </footer>
      </aside>
    </>
  );
};

export default AIPanel;

// src/components/EquationList.jsx
import React, { useMemo, useRef, useState } from "react";
import "../styles/EquationList.css";

export default function EquationList({
  items,
  activeId,
  query,
  setQuery,
  onSelect,
}) {
  // ---- helpers -------------------------------------------------
  const dimsOf = (note) => {
    if (note?.type !== "array3d" || !Array.isArray(note?.content)) return "";
    const Z = note.content.length;
    const Y = note.content[0]?.length || 0;
    const X = note.content[0]?.[0]?.length || 0;
    return `${X}×${Y}×${Z}`;
  };

  const iconOf = (type) => (type === "array3d" ? "⬢" : "ƒx");

  // ---- filtering (수식 + 배열 모두 검색) -------------------------
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((n) => {
      const title = (n.title || "").toLowerCase();
      const formula = (n.formula || "").toLowerCase();
      const tags = (n.tags || []).join(" ").toLowerCase();
      const type = (n.type || "").toLowerCase();
      const dims = n.type === "array3d" ? dimsOf(n).toLowerCase() : "";
      // 제목 / 수식 / 태그 / 타입 / 배열 크기 문자열까지 검색
      return [title, formula, tags, type, dims].some((s) => s.includes(q));
    });
  }, [items, query]);

  // ---- 검색 UI 상태 ---------------------------------------------
  const [searchMode, setSearchMode] = useState(false);
  const inputRef = useRef(null);

  const handleSearchClick = () => {
    setSearchMode(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  const handleBlur = () => {
    if (!query) setSearchMode(false);
  };
  const handleCancel = () => {
    setQuery("");
    setSearchMode(false);
  };

  // ---- render ---------------------------------------------------
  return (
    <div className="vault-left">
      {/* 상단 로고/검색 */}
      <div
        className="vault-left-header"
        style={{
          display: "flex",
          alignItems: "center",
          height: 56,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 로고 */}
        <div
          className={
            !searchMode
              ? "logo-fade logo-container fade-in-left"
              : "logo-fade logo-container fade-out-right"
          }
          style={{
            flex: 1,
            display: !searchMode ? "flex" : "none",
            alignItems: "center",
            cursor: "pointer",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transition: "all 0.4s",
          }}
          onClick={() => (window.location.href = "/")}
        >
          <img src="/Logo.png" alt="Logo" className="logo-image" />
          <span className="logo-text">GraphMind</span>
        </div>

        {/* 검색 아이콘 */}
        <button
          className={
            !searchMode
              ? "search-icon-btn fade-in-right"
              : "search-icon-btn fade-out-left"
          }
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            position: "absolute",
            right: 0,
            top: "12px",
            transition: "all 0.4s",
          }}
          onClick={handleSearchClick}
          aria-label="검색"
          tabIndex={!searchMode ? 0 : -1}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#603ABD" strokeWidth="2" />
            <line
              x1="15.2"
              y1="15.2"
              x2="19"
              y2="19"
              stroke="#603ABD"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* 검색 입력 */}
        <div
          className={
            searchMode ? "search-fade fade-in-right" : "search-fade fade-out-left"
          }
          style={{
            flex: 1,
            display: searchMode ? "flex" : "none",
            alignItems: "center",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transition: "all 0.4s",
          }}
        >
          <input
            ref={inputRef}
            className="vault-search"
            placeholder="Search equations/arrays, formulas, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleBlur}
            style={{ flex: 1, fontSize: 16, paddingLeft: 12 }}
          />
          <button
            className="search-cancel-btn"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              marginLeft: 4,
            }}
            onMouseDown={handleCancel}
            aria-label="검색 취소"
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
        </div>
      </div>

      {/* 리스트 */}
      <div className="vault-list">
        {filtered.map((note) => {
          const isArr = note.type === "array3d";
          const dims = isArr ? dimsOf(note) : null;
          const subtitle = isArr ? `Size: ${dims}` : (note.formula || "");
          const when = new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString();

          return (
            <div
              key={note.id}
              className={"vault-item" + (note.id === activeId ? " active" : "")}
              onClick={() => onSelect(note.id)}
            >
              <div className="item-head">
                <div className={`item-icon ${isArr ? "arr" : "eq"}`}>
                  {iconOf(note.type)}
                </div>
                <div className="item-title-wrap">
                  <div className="title-row">
                    <div className="title">
                      {note.title || (isArr ? "3D Array" : "Equation")}
                    </div>
                    <span className={`type-pill ${isArr ? "pill-arr" : "pill-eq"}`}>
                      {isArr ? "array3d" : "equation"}
                    </span>
                  </div>
                  <div className={isArr ? "dims" : "formula"}>
                    {subtitle}
                  </div>
                </div>
              </div>

              <div className="meta">
                <span>{when}</span>
              </div>

              <div className="vault-tags" style={{ marginTop: 6 }}>
                {(note.tags || []).map((t) => (
                  <span className="vault-tag" key={t}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ opacity: 0.6, padding: 12, fontSize: 13 }}>No results</div>
        )}
      </div>
    </div>
  );
}

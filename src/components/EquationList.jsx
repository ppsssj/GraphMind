import React, { useMemo, useRef, useState } from "react";
import "../styles/EquationList.css";
export default function EquationList({
  items,
  activeId,
  query,
  setQuery,
  onSelect,
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.formula.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [items, query]);

  const [searchMode, setSearchMode] = useState(false);
  const inputRef = useRef(null);

  // 돋보기 클릭 시 검색모드 진입
  const handleSearchClick = () => {
    setSearchMode(true);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  // 검색 input에서 포커스 아웃 시 검색모드 해제 (검색어가 없을 때만)
  const handleBlur = () => {
    if (!query) setSearchMode(false);
  };

  // 검색 취소 버튼
  const handleCancel = () => {
    setQuery("");
    setSearchMode(false);
  };

  return (
    <div className="vault-left">
      <div className="vault-left-header" style={{ display: "flex", alignItems: "center", height: 56, position: "relative", overflow: "hidden" }}>
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
            transition: "all 0.4s"
          }}
          onClick={() => window.location.href = "/"}
        >
          <img src="/Logo.png" alt="Logo" className="logo-image" />
          <span className="logo-text">GraphMind</span>
        </div>
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
            transition: "all 0.4s"
            // 돋보기는 항상 오른쪽
          }}
          onClick={handleSearchClick}
          aria-label="검색"
          tabIndex={!searchMode ? 0 : -1}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#603ABD" strokeWidth="2" />
            <line x1="15.2" y1="15.2" x2="19" y2="19" stroke="#603ABD" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div
          className={searchMode ? "search-fade fade-in-right" : "search-fade fade-out-left"}
          style={{
            flex: 1,
            display: searchMode ? "flex" : "none",
            alignItems: "center",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transition: "all 0.4s"
          }}
        >
          <input
            ref={inputRef}
            className="vault-search"
            placeholder="Search equations, formulas, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleBlur}
            style={{ flex: 1, fontSize: 16, paddingLeft: 12 }}
          />
          <button
            className="search-cancel-btn"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, marginLeft: 4 }}
            onMouseDown={handleCancel}
            aria-label="검색 취소"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <line x1="5" y1="5" x2="15" y2="15" stroke="#9aa4b2" strokeWidth="2" strokeLinecap="round" />
              <line x1="15" y1="5" x2="5" y2="15" stroke="#9aa4b2" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="vault-list">
        {filtered.map((note) => (
          <div
            key={note.id}
            className={"vault-item" + (note.id === activeId ? " active" : "")}
            onClick={() => onSelect(note.id)}
          >
            <div className="title">{note.title}</div>
            <div className="formula">{note.formula}</div>
            <div className="meta">
              <span>{new Date(note.updatedAt).toLocaleString()}</span>
            </div>
            <div className="vault-tags" style={{ marginTop: 6 }}>
              {(note.tags || []).map((t) => (
                <span className="vault-tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

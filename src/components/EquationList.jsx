import React, { useMemo } from "react";

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
  return (
    <div className="vault-left">
      <div className="vault-left-header">
        <input
          className="vault-search"
          placeholder="Search equations, formulas, tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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

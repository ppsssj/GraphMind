// src/pages/Vault.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EquationList from "../components/EquationList";
import ObsidianGraphView from "../components/ObsidianGraphView";
import { dummyEquations } from "../data/dummyEquations";
import "../styles/Vault.css";

const LS_KEY = "equationVault";

export default function Vault() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(320); // 초기 width
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setNotes(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      } catch {
        // ignore parse error and seed demo
      }
    }
    localStorage.setItem(LS_KEY, JSON.stringify(dummyEquations));
    setNotes(dummyEquations);
    setActiveId(dummyEquations[0]?.id || null);
  }, []);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  const handleOpenStudio = (id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    navigate("/studio", { state: { formula: note.formula, from: "vault", id: note.id } });
  };

  const importDummy = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(dummyEquations));
    setNotes(dummyEquations);
    setActiveId(dummyEquations[0]?.id || null);
  };

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "equation-vault.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  // 리사이저 드래그 핸들러
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      let x = e.clientX;
      // 최소/최대 width 제한
      const minW = 220, maxW = 600;
      let newW = Math.max(minW, Math.min(maxW, x));
      setSidebarWidth(newW);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  return (
    <div className="vault-root" style={{ display: "flex", height: "100%" }}>
      <div
        className="vault-left-resizable"
        style={{ width: sidebarWidth, minWidth: 220, maxWidth: 600, position: "relative", height: "100%" }}
      >
        <EquationList
          items={notes}
          activeId={activeId}
          query={query}
          setQuery={setQuery}
          onSelect={setActiveId}
        />
        <div
          className="vault-resizer"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 8,
            height: "100%",
            cursor: "ew-resize",
            zIndex: 10,
            background: dragging ? "#60a5fa22" : "transparent"
          }}
          onMouseDown={() => setDragging(true)}
        />
      </div>

      <div className="vault-right" style={{ flex: 1, minWidth: 0, height: "100%" }}>
        <div className="vault-topbar">
          <div>
            <div style={{ fontSize: 12, color: "#9aa4b2" }}>Vault</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {activeNote ? activeNote.title : "No selection"}
            </div>
          </div>
          <div className="vault-actions">
            <button className="vault-btn" onClick={() => activeId && handleOpenStudio(activeId)}>
              Open in Studio
            </button>
            <button className="vault-btn" onClick={exportJson}>Export</button>
            <button className="vault-btn" onClick={importDummy}>Reset demo</button>
          </div>
        </div>

        <ObsidianGraphView
          notes={notes}
          activeId={activeId}
          onActivate={setActiveId}
          onOpenStudio={handleOpenStudio}
        />
      </div>
    </div>
  );
}

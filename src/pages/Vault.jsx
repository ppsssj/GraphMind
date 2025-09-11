// src/pages/Vault.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EquationList from "../components/EquationList";
import ObsidianGraphView from "../components/ObsidianGraphView";
import { dummyEquations } from "../data/dummyEquations";
import NewResourceModal from "../components/NewResourceModal";
import "../styles/Vault.css";

const LS_KEY_NEW = "vaultResources";
const LS_KEY_OLD = "equationVault";

function migrateEquationsToResources(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((n) =>
    n.type
      ? n
      : {
          id: n.id,
          type: "equation",
          title: n.title || "Untitled",
          formula: n.formula || "x",
          tags: n.tags || [],
          links: n.links || [],
          updatedAt: n.updatedAt || new Date().toISOString(),
          createdAt: n.createdAt || new Date().toISOString(),
        }
  );
}

export default function Vault() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    // 1) 새 키 우선
    const newStr = localStorage.getItem(LS_KEY_NEW);
    if (newStr) {
      try {
        const parsed = JSON.parse(newStr);
        if (Array.isArray(parsed) && parsed.length) {
          setNotes(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      } catch {}
    }
    // 2) 구 키 있으면 마이그레이션
    const oldStr = localStorage.getItem(LS_KEY_OLD);
    if (oldStr) {
      try {
        const parsedOld = JSON.parse(oldStr);
        const migrated = migrateEquationsToResources(parsedOld);
        localStorage.setItem(LS_KEY_NEW, JSON.stringify(migrated));
        setNotes(migrated);
        setActiveId(migrated[0]?.id || null);
        return;
      } catch {}
    }
    // 3) 아무 것도 없으면 더미(수식) 시드 → 마이그레이션 후 저장
    const seeded = migrateEquationsToResources(dummyEquations);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
  }, []);
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  const save = (next) => {
    setNotes(next);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
  };
  const handleOpenStudio = (id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    if (note.type === "equation") {
      navigate("/studio", {
        state: {
          type: "equation",
          formula: note.formula,
          from: "vault",
          id: note.id,
        },
      });
    } else if (note.type === "array3d") {
      navigate("/studio", {
        state: {
          type: "array3d",
          content: note.content,
          from: "vault",
          id: note.id,
        },
      });
    }
  };
  const importDummy = () => {
    const seeded = migrateEquationsToResources(dummyEquations);
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
  };
  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(notes, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vault.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };
  const onCreateResource = ({ type, title, formula, content }) => {
    const id = Date.now().toString(36);
    const item =
      type === "equation"
        ? {
            id,
            type,
            title: title || "New Equation",
            formula: formula || "x^2+1",
            createdAt: new Date().toISOString(),
          }
        : {
            id,
            type,
            title: title || "New 3D Array",
            content: content || [[[0]]],
            createdAt: new Date().toISOString(),
          };

    const next = [...notes, item];
    save(next);
    setActiveId(id);
    setShowNew(false);

    // 생성 후 바로 Studio 이동
    if (type === "equation") {
      navigate("/studio", {
        state: { type: "equation", formula: item.formula, from: "vault", id },
      });
    } else {
      navigate("/studio", {
        state: { type: "array3d", content: item.content, from: "vault", id },
      });
    }
  };
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      const minW = 220,
        maxW = 600;
      const next = Math.max(minW, Math.min(maxW, e.clientX));
      setSidebarWidth(next);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);
  // // 현재는 수식만 왼쪽 리스트에 표시 (배열은 새로 만들기/Studio에서 확인)
  // const equationOnly = notes.filter((n) => n.type === "equation");

  return (
    <div className="vault-root" style={{ display: "flex", height: "100%" }}>
      <div
        className="vault-left-resizable"
        style={{
          width: sidebarWidth,
          minWidth: 220,
          maxWidth: 600,
          position: "relative",
          height: "100%",
        }}
      >
        <EquationList
          items={notes}
          activeId={activeId}
          query={query}
          setQuery={setQuery}
          onSelect={(id) => {
            // ← 클릭 시 포커스 트리거
            setActiveId(id);
            setFocusTick((t) => t + 1);
          }}
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
            background: dragging ? "#60a5fa22" : "transparent",
          }}
          onMouseDown={() => setDragging(true)}
        />
      </div>
      <div
        className="vault-right"
        style={{ flex: 1, minWidth: 0, height: "100%" }}
      >
        <div className="vault-topbar">
          <div>
            <div style={{ fontSize: 12, color: "#9aa4b2" }}>Vault</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {activeNote ? activeNote.title : "No selection"}
            </div>
          </div>
          <div className="vault-actions">
            <button className="vault-btn" onClick={() => setShowNew(true)}>
              + New
            </button>
            <button
              className="vault-btn"
              onClick={() => activeId && handleOpenStudio(activeId)}
            >
              Open in Studio
            </button>
            <button className="vault-btn" onClick={exportJson}>
              Export
            </button>
            <button className="vault-btn" onClick={importDummy}>
              Reset demo
            </button>
          </div>
        </div>
        {/* ObsidianGraphView가 수식 전용이라면 안전하게 필터링해서 전달 */}
        <ObsidianGraphView
          notes={notes.filter((n) => n.type === "equation")}
          activeId={activeId}
          onActivate={setActiveId}
          onOpenStudio={handleOpenStudio}
           focusTick={focusTick} 
        />
      </div>

      {showNew && (
        <NewResourceModal
          onClose={() => setShowNew(false)}
          onCreate={onCreateResource}
        />
      )}
    </div>
  );
}

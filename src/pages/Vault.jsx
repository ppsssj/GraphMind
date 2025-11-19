// src/pages/Vault.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EquationList from "../components/EquationList";
import ObsidianGraphView from "../components/ObsidianGraphView";
import { dummyResources } from "../data/dummyEquations";
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
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [dragging, setDragging] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    // auto-clear when visiting /vault?clearVault=1
    try {
      const params = new URLSearchParams(location.search);
      const shouldClear = params.get("clearVault");
      if (shouldClear) {
        if (!window.confirm("Clear vault cache (localStorage) and reload demo data?")) {
          navigate("/vault", { replace: true });
          return;
        }
        try {
          localStorage.removeItem(LS_KEY_NEW);
          localStorage.removeItem(LS_KEY_OLD);
        } catch (e) {
          console.error("Failed to clear localStorage keys:", e);
        }
        const seeded = dummyResources;
        localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
        setNotes(seeded);
        setActiveId(seeded[0]?.id || null);
        setFocusTick((t) => t + 1);
        navigate("/vault", { replace: true });
        return;
      }
    } catch (e) {
      // ignore URL parse errors
    }

    // 1) 새 저장 키 우선
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
    // 2) 구 키가 있으면 마이그레이션
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
    // 3) 아무 것도 없으면 데모(수식+배열) 시드
    const seeded = dummyResources;
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
  }, [location.search, navigate]);

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
    } else if (note.type === "curve3d") {
      navigate("/studio", {
        state: {
          type: "curve3d",
          id: note.id,
          title: note.title,
          from: "vault",
          curve3d: {
            xExpr: note.xExpr ?? note.x,
            yExpr: note.yExpr ?? note.y,
            zExpr: note.zExpr ?? note.z,
            tMin: note.tMin ?? (note.tRange ? note.tRange[0] : undefined),
            tMax: note.tMax ?? (note.tRange ? note.tRange[1] : undefined),
            samples: note.samples,
          },
        },
      });
    }
  };

  const importDummy = () => {
    const seeded = dummyResources;
    localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
    setNotes(seeded);
    setActiveId(seeded[0]?.id || null);
    setFocusTick((t) => t + 1);
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

  // NewResourceModal → Vault 저장
  const onCreateResource = ({ type, title, formula, content, tags }) => {
    const id = Date.now().toString(36);

    // 공통 필드 (태그 포함)
    const base = {
      id,
      type,
      title: title || (type === "equation" ? "New Equation" : "New 3D Array"),
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const item =
      type === "equation"
        ? {
            ...base,
            formula: formula || "x^2+1",
          }
        : type === "curve3d"
        ? {
            ...base,
            formula: formula || "x^2+1", // curve3d도 기본 구조는 수식 기반
            mode: "curve3d",
          }
        : {
            ...base,
            content: content || [[[0]]], // array3d 등
          };

    const next = [...notes, item];
    save(next);
    setActiveId(id);
    setShowNew(false);

    // 생성 후 바로 Studio 이동
    if (type === "equation") {
      navigate("/studio", {
        state: {
          type: "equation",
          formula: item.formula,
          from: "vault",
          id,
        },
      });
    } else if (type === "curve3d") {
      navigate("/studio", {
        state: {
          type: "equation",
          formula: item.formula,
          from: "vault",
          id,
          mode: "curve3d",
        },
      });
    } else {
      navigate("/studio", {
        state: {
          type: "array3d",
          content: item.content,
          from: "vault",
          id,
        },
      });
    }
  };

  // ✅ 노트 업데이트 (제목 / 수식 / 태그)
  const handleUpdateNote = (id, patch) => {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : n
      );
      localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
      return next;
    });
    setFocusTick((t) => t + 1);
  };

  // ✅ 노트 삭제
  const handleDeleteNote = (id) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    if (
      !window.confirm(
        `"${target.title || "Untitled"}" 노트를 삭제하시겠습니까?`
      )
    )
      return;

    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStorage.setItem(LS_KEY_NEW, JSON.stringify(next));
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        setFocusTick((t) => t + 1);
      }
      return next;
    });
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
            setActiveId(id);
            setFocusTick((t) => t + 1);
          }}
          onUpdate={handleUpdateNote} // ✅ 추가
          onDelete={handleDeleteNote} // ✅ 추가
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
            <button
              className="vault-btn"
              onClick={() => {
                if (
                  !window.confirm(
                    "Clear vault cache (localStorage) and reload demo data?"
                  )
                )
                  return;
                try {
                  localStorage.removeItem(LS_KEY_NEW);
                  localStorage.removeItem(LS_KEY_OLD);
                } catch (e) {
                  console.error("Failed to clear localStorage keys:", e);
                }
                // force re-seed demo data
                const seeded = dummyResources;
                localStorage.setItem(LS_KEY_NEW, JSON.stringify(seeded));
                setNotes(seeded);
                setActiveId(seeded[0]?.id || null);
                setFocusTick((t) => t + 1);
              }}
            >
              Clear Cache
            </button>
          </div>
        </div>

        <ObsidianGraphView
          notes={notes}
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

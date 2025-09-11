import React, { useState } from "react";

export default function NewResourceModal({ onClose, onCreate }) {
  const [type, setType] = useState("equation");
  const [title, setTitle] = useState("");
  const [formula, setFormula] = useState("x^2 + 1");
  const [dims, setDims] = useState({ x: 8, y: 8, z: 8 });
  const [json, setJson] = useState("");
  const buildZeros = (x, y, z) =>
    Array.from({ length: z }, () =>
      Array.from({ length: y }, () => Array.from({ length: x }, () => 0))
    );

  const submit = () => {
    if (type === "equation") {
      onCreate({ type, title, formula });
    } else {
      let content;
      if (json.trim()) {
        try {
          const parsed = JSON.parse(json);
          if (!Array.isArray(parsed))
            throw new Error("3차원 배열(JSON)이 아닙니다.");
          content = parsed;
        } catch (e) {
          alert("JSON 파싱 실패: " + e.message);
          return;
        }
      } else {
        content = buildZeros(dims.x, dims.y, dims.z);
      }
      onCreate({ type, title, content });
    }
  };
  return (
    <div className="vault-modal">
      <div
        className="vault-modal-content"
        style={{ width: 520, maxWidth: "90vw" }}
      >
        <h3 style={{ marginTop: 0 }}>새로 만들기</h3>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setType("equation")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: type === "equation" ? "#111" : "#222",
              color: "#fff",
            }}
          >
            수식
          </button>
          <button
            onClick={() => setType("array3d")}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: type === "array3d" ? "#111" : "#222",
              color: "#fff",
            }}
          >
            3차원 배열
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "equation" ? "New Equation" : "New 3D Array"
              }
              style={{ width: "100%" }}
            />
          </label>

          {type === "equation" ? (
            <label>
              수식
              <input
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="x^2 + 1"
                style={{ width: "100%" }}
              />
            </label>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <label>
                  {" "}
                  X{" "}
                  <input
                    type="number"
                    min={1}
                    value={dims.x}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, x: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  {" "}
                  Y{" "}
                  <input
                    type="number"
                    min={1}
                    value={dims.y}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, y: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
                <label>
                  {" "}
                  Z{" "}
                  <input
                    type="number"
                    min={1}
                    value={dims.z}
                    onChange={(e) =>
                      setDims((d) => ({ ...d, z: +e.target.value || 1 }))
                    }
                    style={{ width: 80 }}
                  />
                </label>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                ※ JSON 붙여넣기가 비어있으면 위 크기로 0으로 채운 배열을
                생성합니다.
              </div>
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={8}
                placeholder="예) [[[0,1],[1,0]],[[1,1],[0,0]]]"
                style={{ width: "100%", fontFamily: "monospace" }}
              />
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
          <button onClick={onClose} className="vault-btn">
            취소
          </button>
          <button onClick={submit} className="vault-btn">
            생성
          </button>
        </div>
      </div>
    </div>
  );
}

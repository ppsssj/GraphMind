// src/ui/Curve3DToolbar.jsx
import { useEffect, useState } from "react";
import "./Toolbar.css";
import "./Curve3DToolbar.css";

export default function Curve3DToolbar({
  curve3d,
  onChange,
}) {
  const c = curve3d || {};

  const [x, setX] = useState(c.xExpr ?? "");
  const [y, setY] = useState(c.yExpr ?? "");
  const [z, setZ] = useState(c.zExpr ?? "");
  const [tMin, setTMin] = useState(c.tMin ?? 0);
  const [tMax, setTMax] = useState(c.tMax ?? 2 * Math.PI);
  const [samples, setSamples] = useState(c.samples ?? 400);

  useEffect(() => {
    setX(c.xExpr ?? "");
    setY(c.yExpr ?? "");
    setZ(c.zExpr ?? "");
    setTMin(c.tMin ?? 0);
    setTMax(c.tMax ?? 2 * Math.PI);
    setSamples(c.samples ?? 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.xExpr, c.yExpr, c.zExpr, c.tMin, c.tMax, c.samples]);

  const apply = () => {
    const nextTMin = Number(tMin);
    const nextTMax = Number(tMax);
    const nextSamples = Number(samples);

    if (!Number.isFinite(nextTMin) || !Number.isFinite(nextTMax)) return;
    if (!Number.isFinite(nextSamples) || nextSamples <= 10) return;

    onChange?.({
      // 원본(회색)과 편집(초록)을 동시에 갱신
      baseXExpr: x,
      baseYExpr: y,
      baseZExpr: z,
      xExpr: x,
      yExpr: y,
      zExpr: z,
      tMin: nextTMin,
      tMax: nextTMax,
      samples: nextSamples,
      markers: [
        { id: 0, t: nextTMin },
        { id: 1, t: (nextTMin + nextTMax) / 2, label: "vertex" },
        { id: 2, t: nextTMax },
      ],
    });
  };

  const resetEditToBase = () => {
    onChange?.({
      xExpr: c.baseXExpr ?? c.xExpr ?? "",
      yExpr: c.baseYExpr ?? c.yExpr ?? "",
      zExpr: c.baseZExpr ?? c.zExpr ?? "",
      // 좌표(x,y,z)를 제거해서 곡선 위로 다시 스냅되게 유도
      markers: (c.markers || []).map((m) => {
        const { x, y, z, ...rest } = m || {};
        return rest;
      }),
    });
  };

  const toggleMode = () => {
    const next = (c.editMode ?? "drag") === "drag" ? "arrows" : "drag";
    onChange?.({ editMode: next });
  };

  return (
    <div className="toolbar curve3d-toolbar">
      <div className="toolbar-section curve3d-toolbar-left">
        <div className="curve3d-toolbar-title">Curve3D</div>
      </div>

      <div className="toolbar-section curve3d-toolbar-fields">
        <div className="curve3d-field">
          <label className="toolbar-label">x(t)</label>
          <input
            className="toolbar-input"
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder="e.g. cos(t)"
          />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">y(t)</label>
          <input
            className="toolbar-input"
            value={y}
            onChange={(e) => setY(e.target.value)}
            placeholder="e.g. sin(t)"
          />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">z(t)</label>
          <input
            className="toolbar-input"
            value={z}
            onChange={(e) => setZ(e.target.value)}
            placeholder="e.g. 0.2*t"
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMin</label>
          <input
            className="toolbar-input"
            value={tMin}
            onChange={(e) => setTMin(e.target.value)}
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMax</label>
          <input
            className="toolbar-input"
            value={tMax}
            onChange={(e) => setTMax(e.target.value)}
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">samples</label>
          <input
            className="toolbar-input"
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
          />
        </div>

        <div className="curve3d-toolbar-actions">
          <button className="toolbar-btn" onClick={apply}>
            Apply
          </button>
          <button className="toolbar-btn" onClick={resetEditToBase}>
            Reset Edit
          </button>
          <button className="toolbar-btn" onClick={toggleMode}>
            Mode: {(c.editMode ?? "drag") === "drag" ? "Drag" : "Arrows"}
          </button>
        </div>
      </div>
    </div>
  );
}

// src/ui/Curve3DToolbar.jsx
import { useEffect, useState } from "react";
import "./Toolbar.css";
import "./Curve3DToolbar.css";

export default function Curve3DToolbar({ curve3d, onChange }) {
  const c = curve3d || {};

  const [x, setX] = useState(c.xExpr ?? "");
  const [y, setY] = useState(c.yExpr ?? "");
  const [z, setZ] = useState(c.zExpr ?? "");
  const [tMin, setTMin] = useState(c.tMin ?? 0);
  const [tMax, setTMax] = useState(c.tMax ?? 2 * Math.PI);
  const [samples, setSamples] = useState(c.samples ?? 400);

  // Grid UI
  const [gridMode, setGridMode] = useState(c.gridMode ?? "major");
  const [gridStep, setGridStep] = useState(c.gridStep ?? 1);
  const [minorDiv] = useState(c.minorDiv ?? 4); // UI 노출 X

  useEffect(() => {
    setX(c.xExpr ?? "");
    setY(c.yExpr ?? "");
    setZ(c.zExpr ?? "");
    setTMin(c.tMin ?? 0);
    setTMax(c.tMax ?? 2 * Math.PI);
    setSamples(c.samples ?? 400);
    setGridStep(c.gridStep ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.xExpr, c.yExpr, c.zExpr, c.tMin, c.tMax, c.samples, c.gridStep]);

  useEffect(() => {
    setGridMode(c.gridMode ?? "major");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.gridMode]);

  const commitGridStep = (value) => {
    const step = Math.max(0.1, Number(value) || 1);
    setGridStep(step);
    onChange?.({ gridStep: step });
  };

  const commitGridMode = (value) => {
    const mode = String(value || "major");
    setGridMode(mode);
    onChange?.({ gridMode: mode });
  };

  const apply = () => {
    const nextTMin = Number(tMin);
    const nextTMax = Number(tMax);
    const nextSamples = Number(samples);

    if (!Number.isFinite(nextTMin) || !Number.isFinite(nextTMax)) return;
    if (!Number.isFinite(nextSamples) || nextSamples <= 10) return;

    onChange?.({
      baseXExpr: x,
      baseYExpr: y,
      baseZExpr: z,
      xExpr: x,
      yExpr: y,
      zExpr: z,
      tMin: nextTMin,
      tMax: nextTMax,
      samples: nextSamples,

      gridMode: String(gridMode || "major"),
      gridStep: Math.max(0.1, Number(gridStep) || 1),
      minorDiv: Number(minorDiv) || 4,

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
          <input className="toolbar-input" value={x} onChange={(e) => setX(e.target.value)} placeholder="e.g. cos(t)" />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">y(t)</label>
          <input className="toolbar-input" value={y} onChange={(e) => setY(e.target.value)} placeholder="e.g. sin(t)" />
        </div>

        <div className="curve3d-field">
          <label className="toolbar-label">z(t)</label>
          <input className="toolbar-input" value={z} onChange={(e) => setZ(e.target.value)} placeholder="e.g. 0.2*t" />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMin</label>
          <input className="toolbar-input" value={tMin} onChange={(e) => setTMin(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">tMax</label>
          <input className="toolbar-input" value={tMax} onChange={(e) => setTMax(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">samples</label>
          <input className="toolbar-input" value={samples} onChange={(e) => setSamples(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Grid</label>
          <select className="toolbar-input" value={gridMode} onChange={(e) => commitGridMode(e.target.value)}>
            <option value="off">Off</option>
            <option value="box">Box</option>
            <option value="major">Major</option>
            <option value="full">Full</option>
          </select>
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">Step</label>
          <input
            className="toolbar-input"
            type="number"
            min={0.1}
            step={0.1}
            value={gridStep}
            disabled={gridMode === "off" || gridMode === "box"}
            onChange={(e) => setGridStep(e.target.value)}
            onBlur={() => commitGridStep(gridStep)}
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

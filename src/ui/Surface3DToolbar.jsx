// src/ui/Surface3DToolbar.jsx
import { useEffect, useState } from "react";
import "./Toolbar.css";
import "./Curve3DToolbar.css"; // Curve3D와 동일한 레이아웃/톤 재사용

/**
 * ✅ Curve3DToolbar와 동일한 Grid UX를 Surface3D에도 적용
 * - Grid: off | box | major | full
 * - Step: major grid step (full 모드면 minorDiv로 minor step 자동 생성)
 */
export default function Surface3DToolbar({ surface3d, onChange }) {
  const s = surface3d || {};

  const [expr, setExpr] = useState(s.expr ?? "sin(x) * cos(y)");
  const [xMin, setXMin] = useState(s.xMin ?? -5);
  const [xMax, setXMax] = useState(s.xMax ?? 5);
  const [yMin, setYMin] = useState(s.yMin ?? -5);
  const [yMax, setYMax] = useState(s.yMax ?? 5);
  const [nx, setNx] = useState(s.nx ?? 60);
  const [ny, setNy] = useState(s.ny ?? 60);

  // Grid
  const [gridMode, setGridMode] = useState(s.gridMode ?? "major");
  const [gridStep, setGridStep] = useState(s.gridStep ?? 1);
  const [minorDiv] = useState(s.minorDiv ?? 4); // UI는 간단히 유지

  useEffect(() => {
    setExpr(s.expr ?? "sin(x) * cos(y)");
    setXMin(s.xMin ?? -5);
    setXMax(s.xMax ?? 5);
    setYMin(s.yMin ?? -5);
    setYMax(s.yMax ?? 5);
    setNx(s.nx ?? 60);
    setNy(s.ny ?? 60);
    setGridMode(s.gridMode ?? "major");
    setGridStep(s.gridStep ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.expr, s.xMin, s.xMax, s.yMin, s.yMax, s.nx, s.ny, s.gridMode, s.gridStep]);

  const commitGridMode = (value) => {
    const mode = String(value || "major");
    setGridMode(mode);
    onChange?.({ gridMode: mode });
  };

  const commitGridStep = (value) => {
    const step = Math.max(0.1, Number(value) || 1);
    setGridStep(step);
    onChange?.({ gridStep: step });
  };

  const apply = () => {
    const next = {
      expr: String(expr ?? "").trim() || "0",
      xMin: Number(xMin),
      xMax: Number(xMax),
      yMin: Number(yMin),
      yMax: Number(yMax),
      nx: Math.max(8, Number(nx) || 60),
      ny: Math.max(8, Number(ny) || 60),
      gridMode: String(gridMode || "major"),
      gridStep: Math.max(0.1, Number(gridStep) || 1),
      minorDiv: Number(minorDiv) || 4,
    };

    if (![next.xMin, next.xMax, next.yMin, next.yMax].every((v) => Number.isFinite(v))) return;
    onChange?.(next);
  };

  const resetGrid = () => {
    setGridMode("major");
    setGridStep(1);
    onChange?.({ gridMode: "major", gridStep: 1 });
  };

  return (
    <div className="toolbar curve3d-toolbar">
      <div className="toolbar-section curve3d-toolbar-left">
        <div className="curve3d-toolbar-title">Surface3D</div>
      </div>

      <div className="toolbar-section curve3d-toolbar-fields">
        <div className="curve3d-field">
          <label className="toolbar-label">z = f(x,y)</label>
          <input
            className="toolbar-input"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="e.g. sin(x) * cos(y)"
          />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">xMin</label>
          <input className="toolbar-input" value={xMin} onChange={(e) => setXMin(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">xMax</label>
          <input className="toolbar-input" value={xMax} onChange={(e) => setXMax(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">yMin</label>
          <input className="toolbar-input" value={yMin} onChange={(e) => setYMin(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">yMax</label>
          <input className="toolbar-input" value={yMax} onChange={(e) => setYMax(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">nx</label>
          <input className="toolbar-input" value={nx} onChange={(e) => setNx(e.target.value)} />
        </div>

        <div className="curve3d-field curve3d-field-small">
          <label className="toolbar-label">ny</label>
          <input className="toolbar-input" value={ny} onChange={(e) => setNy(e.target.value)} />
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
          <button className="toolbar-btn" onClick={resetGrid}>
            Reset Grid
          </button>
        </div>
      </div>
    </div>
  );
}

// src/ui/Toolbar.jsx
import "./Toolbar.css";

export default function Toolbar({
  equationExpr,
  setEquationExpr,
  onApply,
  degree,
  setDegree,
  xmin,
  xmax,
  setXmin,
  setXmax,
  onResampleDomain,
  // new props for left panel toggle
  showLeftPanel = true,
  onToggleLeftPanel = () => {},
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <label className="toolbar-label">Equation</label>
        <input
          className="toolbar-input"
          value={equationExpr}
          onChange={(e) => setEquationExpr(e.target.value)}
          placeholder="e.g. 0.5*x^3 - 2*x"
        />
        <button className="toolbar-btn" onClick={onApply}>
          Apply
        </button>
      </div>

      <div className="toolbar-section">
        <label className="toolbar-label">Degree</label>
        <input
          className="toolbar-range"
          type="range"
          min={1}
          max={8}
          value={degree}
          onChange={(e) => setDegree(parseInt(e.target.value))}
        />
        <span className="toolbar-kv">{degree}</span>
      </div>

      <div className="toolbar-section">
        <label className="toolbar-label">Domain</label>
        <input
          className="toolbar-num"
          type="number"
          step={0.5}
          value={xmin}
          onChange={(e) => setXmin(parseFloat(e.target.value))}
        />
        <span className="toolbar-dash">—</span>
        <input
          className="toolbar-num"
          type="number"
          step={0.5}
          value={xmax}
          onChange={(e) => setXmax(parseFloat(e.target.value))}
        />
        <button className="toolbar-btn ghost" onClick={onResampleDomain} title="도메인 변경 적용">
          Resample
        </button>
        
      </div>
    </div>
  );
}

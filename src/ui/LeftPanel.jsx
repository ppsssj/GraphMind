export default function LeftPanel({
  degree,
  setDegree,
  xmin,
  xmax,
  setXmin,
  setXmax,
  equationExpr,
  setEquationExpr,
  equationPretty,
  onApply,
}) {
  return (
    <aside className="left-panel">
      <div className="section">
        <div className="label">Equation (type & press Apply)</div>
        <input
          className="input"
          value={equationExpr}
          onChange={(e) => setEquationExpr(e.target.value)}
          placeholder="e.g., 0.5*x^3 - 2*x"
        />
        <button className="apply" onClick={onApply}>Apply</button>
      </div>

      <div className="section">
        <div className="label">Fitted Polynomial</div>
        <div className="equation">{`y = ${equationPretty}`}</div>
      </div>

      <div className="section grid2">
        <div>
          <div className="label">Degree</div>
          <input
            className="range"
            type="range"
            min={1}
            max={8}
            value={degree}
            onChange={(e) => setDegree(parseInt(e.target.value))}
          />
          <div className="hint">{degree}</div>
        </div>
        <div>
          <div className="label">Domain [x<sub>min</sub>, x<sub>max</sub>]</div>
          <div className="row">
            <input className="num" type="number" step="0.5" value={xmin} onChange={(e) => setXmin(parseFloat(e.target.value))} />
            <span className="dash">—</span>
            <input className="num" type="number" step="0.5" value={xmax} onChange={(e) => setXmax(parseFloat(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="note">
        Tip: Drag the white points on the canvas to reshape the curve.
        The polynomial updates in real time.
      </div>
    </aside>
  );
}
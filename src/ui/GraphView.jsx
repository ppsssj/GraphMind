// src/ui/GraphView.jsx
import GraphCanvas from "./GraphCanvas";

/**
 * GraphView is a thin wrapper around GraphCanvas.
 * All rendering options (grid/view/edit/rule) should be controlled from Toolbar via Studio tab-state.
 */
export default function GraphView({
  points = [],
  updatePoint,
  commitRule,

  xmin,
  xmax,
  ymin,
  ymax,

  // Grid (Curve3D-style)
  gridMode,
  setGridMode,
  gridStep,
  setGridStep,
  minorDiv,
  setMinorDiv,

  // View/Edit
  viewMode,
  setViewMode,
  editMode,
  setEditMode,

  // Curves
  fittedFn,
  typedFn,
  curveKey,
  markers = [],

  // Rule fitting
  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,

  showControls = false,
}) {
  return (
    <div className="graph-view" style={{ width: "100%", height: "100%", minHeight: 0 }}>
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        onPointCommit={commitRule}
        xmin={xmin}
        xmax={xmax}
        ymin={ymin}
        ymax={ymax}
        gridMode={gridMode}
        setGridMode={setGridMode}
        gridStep={gridStep}
        setGridStep={setGridStep}
        minorDiv={minorDiv}
        setMinorDiv={setMinorDiv}
        viewMode={viewMode}
        setViewMode={setViewMode}
        editMode={editMode}
        setEditMode={setEditMode}
        fn={fittedFn}
        typedFn={typedFn}
        curveKey={curveKey}
        markers={markers}
        ruleMode={ruleMode}
        setRuleMode={setRuleMode}
        rulePolyDegree={rulePolyDegree}
        setRulePolyDegree={setRulePolyDegree}
        ruleError={ruleError}
        showControls={showControls}
      />
    </div>
  );
}

// src/ui/GraphView.jsx
import GraphCanvas from "./GraphCanvas";

export default function GraphView({
  points = [],
  updatePoint,
  commitRule,
  xmin,
  xmax,
  ymin,
  ymax,
  gridStep,
  setGridStep,

  // ✅ 추가: 격자 모드(Off/Box/Major/Full)
  gridMode,
  setGridMode,

  fittedFn,
  typedFn,
  curveKey,
  markers = [],

  // rule editing (optional)
  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,
  showControls = true,
}) {
  return (
    <div
      className="graph-view"
      style={{ width: "100%", height: "100%", minHeight: 0 }}
    >
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        onPointCommit={commitRule}
        xmin={xmin}
        xmax={xmax}
        ymin={ymin}
        ymax={ymax}
        gridStep={gridStep}
        setGridStep={setGridStep}

        // ✅ 추가 전달
        gridMode={gridMode}
        setGridMode={setGridMode}

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

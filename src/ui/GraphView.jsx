// src/ui/GraphView.jsx
import GraphCanvas from "./GraphCanvas";

export default function GraphView({
  points,
  updatePoint,
  commitRule,
  xmin,
  xmax,
  fittedFn,
  typedFn,
  curveKey,

  // rule editing (optional)
  ruleMode,
  setRuleMode,
  rulePolyDegree,
  setRulePolyDegree,
  ruleError,
}) {
  return (
    <div
      className="graph-view"
      style={{ flex: 1, minHeight: 0, width: "100%", height: "100%", display: "flex" }}
    >
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        onPointCommit={(pts) => commitRule?.(pts)}
        xmin={xmin}
        xmax={xmax}
        fn={fittedFn}     // 파랑: 다항 근사
        typedFn={typedFn} // 빨강: 입력 수식
        curveKey={curveKey}
        ruleMode={ruleMode}
        setRuleMode={setRuleMode}
        rulePolyDegree={rulePolyDegree}
        setRulePolyDegree={setRulePolyDegree}
        ruleError={ruleError}
      />
    </div>
  );
}

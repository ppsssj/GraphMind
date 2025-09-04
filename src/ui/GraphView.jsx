// src/ui/GraphView.jsx
import GraphCanvas from "./GraphCanvas";

export default function GraphView({
  points,
  updatePoint,
  xmin,
  xmax,
  fittedFn,
  typedFn,
  curveKey,
}) {
  return (
    <div className="graph-view">
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        xmin={xmin}
        xmax={xmax}
        fn={fittedFn}     // 파랑: 다항 근사
        typedFn={typedFn} // 빨강: 입력 수식
        curveKey={curveKey}
      />
    </div>
  );
}

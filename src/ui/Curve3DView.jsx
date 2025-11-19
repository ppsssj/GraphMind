// src/ui/Curve3DView.jsx
import Curve3DCanvas from "./Curve3DCanvas";

export default function Curve3DView({ curve3d }) {
  if (!curve3d) {
    return <div className="empty-hint">3D 곡선 정보가 없습니다.</div>;
  }

  const { xExpr, yExpr, zExpr, tMin, tMax, samples } = curve3d;

  return (
    <div className="graph-view">
      <Curve3DCanvas
        xExpr={xExpr}
        yExpr={yExpr}
        zExpr={zExpr}
        tMin={tMin}
        tMax={tMax}
        samples={samples}
        markers={[
          { t: -2 },
          { t: 0, label: "vertex" },
          { x: 1, y: 1, z: 0 }, // 직접 좌표도 가능
        ]}
      />
    </div>
  );
}

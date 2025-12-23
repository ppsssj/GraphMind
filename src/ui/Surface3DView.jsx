// src/ui/Surface3DView.jsx
import Surface3DCanvas from "./Surface3DCanvas";

export default function Surface3DView({ surface3d, onChange }) {
  if (!surface3d) {
    return <div className="empty-hint">3D 곡면 정보가 없습니다.</div>;
  }

  const merged = {
    expr: surface3d.expr ?? "sin(x) * cos(y)",
    xMin: Number.isFinite(Number(surface3d.xMin)) ? Number(surface3d.xMin) : -5,
    xMax: Number.isFinite(Number(surface3d.xMax)) ? Number(surface3d.xMax) : 5,
    yMin: Number.isFinite(Number(surface3d.yMin)) ? Number(surface3d.yMin) : -5,
    yMax: Number.isFinite(Number(surface3d.yMax)) ? Number(surface3d.yMax) : 5,
    nx: Number.isFinite(Number(surface3d.nx)) ? Number(surface3d.nx) : 60,
    ny: Number.isFinite(Number(surface3d.ny)) ? Number(surface3d.ny) : 60,
    markers: Array.isArray(surface3d.markers) ? surface3d.markers : [],

    // ✅ Curve3D와 동일한 Grid props
    gridMode: surface3d.gridMode ?? "major",
    gridStep: surface3d.gridStep ?? 1,
    minorDiv: surface3d.minorDiv ?? 4,
  };

  // (옵션) 상위에서 surface3d를 관리한다면 toolbar에서 onChange로 갱신
  const handleChange = (patch) => {
    onChange?.(patch);
  };

  return (
    <div className="graph-view">
      <Surface3DCanvas
        expr={merged.expr}
        xMin={merged.xMin}
        xMax={merged.xMax}
        yMin={merged.yMin}
        yMax={merged.yMax}
        nx={merged.nx}
        ny={merged.ny}
        markers={merged.markers}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
      />
    </div>
  );
}

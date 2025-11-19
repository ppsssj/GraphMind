// src/ui/Surface3DView.jsx
import Surface3DCanvas from "./Surface3DCanvas";

export default function Surface3DView({ surface3d }) {
  if (!surface3d) {
    return <div className="empty-hint">3D 곡면 정보가 없습니다.</div>;
  }

  const { expr, xMin, xMax, yMin, yMax, nx, ny } = surface3d;

  return (
    <div className="graph-view">
      <Surface3DCanvas
        expr={expr}
        xMin={xMin}
        xMax={xMax}
        yMin={yMin}
        yMax={yMax}
        nx={nx}
        ny={ny}
        markers={surface3d.markers} 
      />
    </div>
  );
}

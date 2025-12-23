// src/ui/Curve3DView.jsx
import React from "react";
import Curve3DCanvas from "./Curve3DCanvas";

export default function Curve3DView({ curve3d, onChange }) {
  if (!curve3d) {
    return <div className="empty-hint">3D 곡선 정보가 없습니다.</div>;
  }

  const merged = {
    baseXExpr: curve3d.baseXExpr ?? curve3d.xExpr ?? "",
    baseYExpr: curve3d.baseYExpr ?? curve3d.yExpr ?? "",
    baseZExpr: curve3d.baseZExpr ?? curve3d.zExpr ?? "",
    xExpr: curve3d.xExpr ?? "",
    yExpr: curve3d.yExpr ?? "",
    zExpr: curve3d.zExpr ?? "",
    tMin: curve3d.tMin ?? -2,
    tMax: curve3d.tMax ?? 2,
    samples: curve3d.samples ?? 200,

    // Grid
    gridMode: curve3d.gridMode ?? "major", // "off" | "box" | "major" | "full"
    gridStep: curve3d.gridStep ?? 1,
    minorDiv: curve3d.minorDiv ?? 4,

    markers: Array.isArray(curve3d.markers) ? curve3d.markers : [],
    editMode: curve3d.editMode ?? "drag",
  };

  const handleMarkerChange = (index, pos) => {
    const next = [...(merged.markers || [])];
    if (!next[index]) return;
    next[index] = { ...next[index], ...pos };
    onChange?.({ markers: next });
  };

  const handleRecalculateExpressions = ({ xExpr, yExpr, zExpr }) => {
    onChange?.({ xExpr, yExpr, zExpr });
  };

  return (
    <div className="graph-view">
      <Curve3DCanvas
        baseXExpr={merged.baseXExpr}
        baseYExpr={merged.baseYExpr}
        baseZExpr={merged.baseZExpr}
        xExpr={merged.xExpr}
        yExpr={merged.yExpr}
        zExpr={merged.zExpr}
        tMin={merged.tMin}
        tMax={merged.tMax}
        samples={merged.samples}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
        markers={merged.markers}
        onMarkerChange={handleMarkerChange}
        onRecalculateExpressions={handleRecalculateExpressions}
        editMode={merged.editMode}
      />
    </div>
  );
}

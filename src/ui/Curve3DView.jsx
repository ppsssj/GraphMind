// src/ui/Curve3DView.jsx
import React, { useState } from "react";
import Curve3DCanvas from "./Curve3DCanvas";

export default function Curve3DView({ curve3d }) {
  // curve3d가 없을 수도 있으니 기본값 합치기
  const merged = {
    xExpr: "",
    yExpr: "",
    zExpr: "",
    tMin: -2,
    tMax: 2,
    samples: 200,
    markers: [],
    editMode: "drag", // "drag" | "arrows"
    ...(curve3d || {}),
  };

  const {
    xExpr: baseXExpr,
    yExpr: baseYExpr,
    zExpr: baseZExpr,
    tMin,
    tMax,
    samples,
    markers: initialMarkers,
    editMode,
  } = merged;

  // ✅ 편집용 수식은 별도 state로 분리 (초기값 = 원본 수식)
  const [editExprs, setEditExprs] = useState({
    xExpr: baseXExpr,
    yExpr: baseYExpr,
    zExpr: baseZExpr,
  });

  // ✅ 노드: 기본은 t 기반만 두고, 전부 수식 곡선 위에 붙이기
  const [markers, setMarkers] = useState(
    initialMarkers && initialMarkers.length > 0
      ? initialMarkers
      : [
          { id: 0, t: tMin },
          { id: 1, t: 0, label: "vertex" },
          // ❌ (1,1,0) 같이 그래프와 무관한 고정 좌표 노드는 제거
        ]
  );

  // 노드 이동 시 상위 state 갱신
  const handleMarkerChange = (index, pos) => {
    setMarkers((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;

      // t, label 같은 메타데이터는 유지하고 좌표만 갱신
      next[index] = { ...next[index], ...pos };

      try {
        // eslint-disable-next-line no-console
        console.debug(
          "Curve3DView: marker updated",
          index,
          pos,
          "next markers:",
          next
        );
      } catch {}
      return next;
    });
  };

  // ✅ Canvas에서 Lagrange 보간으로 새 수식이 계산되면 여기서 편집 수식 갱신
  const handleRecalculateExpressions = ({ xExpr, yExpr, zExpr }) => {
    setEditExprs({ xExpr, yExpr, zExpr });

    // 필요하면 여기서 Vault/Studio 쪽으로도 반영 가능
    // onCurveChange?.({ xExpr, yExpr, zExpr, markers });
  };

  if (!curve3d) {
    return <div className="empty-hint">3D 곡선 정보가 없습니다.</div>;
  }

  return (
    <div className="graph-view">
      <Curve3DCanvas
        // 🔹 원본(변경되지 않는) 수식
        baseXExpr={baseXExpr}
        baseYExpr={baseYExpr}
        baseZExpr={baseZExpr}
        // 🔹 편집용(노드가 움직이면서 바뀌는) 수식
        xExpr={editExprs.xExpr}
        yExpr={editExprs.yExpr}
        zExpr={editExprs.zExpr}
        tMin={tMin}
        tMax={tMax}
        samples={samples}
        markers={markers}
        onMarkerChange={handleMarkerChange}
        onRecalculateExpressions={handleRecalculateExpressions}
        editMode={editMode}
      />
    </div>
  );
}

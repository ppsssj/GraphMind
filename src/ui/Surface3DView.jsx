// src/ui/Surface3DView.jsx
import { useCallback, useMemo } from "react";
import Surface3DCanvas from "./Surface3DCanvas";
import Surface3DToolbar from "./Surface3DToolbar";
import { create, all } from "mathjs";

const mathjs = create(all, {});

// (i+j<=d) 항의 개수 = (d+1)(d+2)/2
function requiredPointCount(deg) {
  const d = Math.max(1, Math.min(6, Math.floor(Number(deg) || 2)));
  return ((d + 1) * (d + 2)) / 2;
}

function fmtCoef(x) {
  if (!Number.isFinite(x)) return "0";
  const s = x.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

function buildPolyExpr(terms) {
  const parts = [];
  for (const t of terms) {
    const c = t.coef;
    if (!Number.isFinite(c) || Math.abs(c) < 1e-10) continue;

    const sign = c >= 0 ? "+" : "-";
    const abs = Math.abs(c);
    const coefStr = fmtCoef(abs);

    const factors = [];
    if (!(abs === 1 && (t.i !== 0 || t.j !== 0))) {
      factors.push(coefStr);
    }
    if (t.i > 0) factors.push(t.i === 1 ? "x" : `x^${t.i}`);
    if (t.j > 0) factors.push(t.j === 1 ? "y" : `y^${t.j}`);

    const body = factors.length ? factors.join("*") : "0";
    parts.push({ sign, body });
  }

  if (!parts.length) return "0";

  let expr = `${parts[0].sign === "-" ? "-" : ""}${parts[0].body}`;
  for (let k = 1; k < parts.length; k++) expr += ` ${parts[k].sign} ${parts[k].body}`;
  return expr;
}

/**
 * markers: [{id, x, y, z}]
 * degree: 1~4
 * 최소제곱으로 다항식 표면 피팅 후 expr 문자열 반환
 */
function fitSurfacePolynomial(markers, degree) {
  const d = Math.max(1, Math.min(6, Math.floor(Number(degree) || 2)));
  const pts = (Array.isArray(markers) ? markers : [])
    .map((m) => ({ x: Number(m?.x), y: Number(m?.y), z: Number(m?.z) }))
    .filter((p) => [p.x, p.y, p.z].every(Number.isFinite));

  const need = requiredPointCount(d);
  if (pts.length < need) return { ok: false, reason: `points 부족 (${pts.length}/${need})` };

  const basis = [];
  for (let i = 0; i <= d; i++) {
    for (let j = 0; j <= d - i; j++) basis.push({ i, j });
  }

  const N = pts.length;
  const M = basis.length;

  const A = mathjs.zeros(N, M);
  const Z = mathjs.zeros(N, 1);

  for (let r = 0; r < N; r++) {
    const { x, y, z } = pts[r];
    Z.set([r, 0], z);
    for (let c = 0; c < M; c++) {
      const { i, j } = basis[c];
      A.set([r, c], Math.pow(x, i) * Math.pow(y, j));
    }
  }

  const AT = mathjs.transpose(A);
  const ATA = mathjs.multiply(AT, A);
  const ATZ = mathjs.multiply(AT, Z);

  const lambda = 1e-8;
  const I = mathjs.identity(M);
  const ATAreg = mathjs.add(ATA, mathjs.multiply(lambda, I));

  let W;
  try {
    W = mathjs.lusolve(ATAreg, ATZ);
  } catch {
    return { ok: false, reason: "solve 실패" };
  }

  const terms = basis.map((b, idx) => ({
    i: b.i,
    j: b.j,
    coef: Number(W.get([idx, 0])),
  }));

  return { ok: true, expr: buildPolyExpr(terms), degree: d };
}

export default function Surface3DView({ surface3d, onChange }) {
  // ✅ Hook은 항상 동일한 순서로 호출되어야 하므로,
  // early return을 Hook들 아래로 내립니다.

  const merged = useMemo(() => {
    const s = surface3d ?? {};
    return {
      expr: s.expr ?? "sin(x) * cos(y)",
      xMin: Number.isFinite(Number(s.xMin)) ? Number(s.xMin) : -5,
      xMax: Number.isFinite(Number(s.xMax)) ? Number(s.xMax) : 5,
      yMin: Number.isFinite(Number(s.yMin)) ? Number(s.yMin) : -5,
      yMax: Number.isFinite(Number(s.yMax)) ? Number(s.yMax) : 5,
      nx: Number.isFinite(Number(s.nx)) ? Number(s.nx) : 60,
      ny: Number.isFinite(Number(s.ny)) ? Number(s.ny) : 60,

      gridMode: s.gridMode ?? "major",
      gridStep: Number.isFinite(Number(s.gridStep)) ? Number(s.gridStep) : 1,
      minorDiv: Number.isFinite(Number(s.minorDiv)) ? Number(s.minorDiv) : 4,

      editMode: Boolean(s.editMode ?? true),
      degree: Number.isFinite(Number(s.degree)) ? Number(s.degree) : 2,

      markers: Array.isArray(s.markers) ? s.markers : [],
    };
  }, [surface3d]);

  const commit = useCallback(
    (patch) => {
      onChange?.(patch);
    },
    [onChange]
  );

  const doFit = useCallback(
    (markers = merged.markers) => {
      const res = fitSurfacePolynomial(markers, merged.degree);
      if (!res.ok) return false;
      commit({ expr: res.expr });
      return true;
    },
    [commit, merged.degree, merged.markers]
  );

  const handleMarkersChange = useCallback(
    (nextMarkers, { fit = false } = {}) => {
      commit({ markers: nextMarkers });
      if (fit) {
        const res = fitSurfacePolynomial(nextMarkers, merged.degree);
        if (res.ok) commit({ expr: res.expr });
      }
    },
    [commit, merged.degree]
  );

  const handleAddMarker = useCallback(
    (m) => {
      const next = [...(merged.markers || []), m];
      commit({ markers: next });
    },
    [commit, merged.markers]
  );

  const handleClearMarkers = useCallback(() => {
    commit({ markers: [] });
  }, [commit]);

  // ✅ Hook 호출 이후에 early return
  if (!surface3d) {
    return <div className="empty-hint">3D 곡면 정보가 없습니다.</div>;
  }

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
        editMode={merged.editMode}
        degree={merged.degree}
        onAddMarker={handleAddMarker}
        onMarkersChange={handleMarkersChange}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
      />
    </div>
  );
}

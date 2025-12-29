// src/ui/Surface3DView.jsx
import { useCallback, useMemo } from "react";
import Surface3DCanvas from "./Surface3DCanvas";
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
 * degree: 1~6
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

export default function Surface3DView({
  surface3d,
  onChange,

  // ✅ Studio에서 reducer로 직접 연결하고 싶을 때(권장)
  onPointAdd,
  onPointRemove,
}) {
  const merged = useMemo(() => {
    const s = surface3d ?? {};
    return {
      expr: s.expr ?? "sin(x) * cos(y)",
      // baseExpr가 있으면 Canvas에서 bounds에 같이 고려 가능(필요 시)
      baseExpr: s.baseExpr ?? null,

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

  const handleMarkersChange = useCallback(
    (nextMarkers, { fit = false } = {}) => {
      commit({ markers: nextMarkers });

      // 기존 규칙 유지: drag 끝에서만 fit 요청이 오면 expr 갱신
      if (fit) {
        const res = fitSurfacePolynomial(nextMarkers, merged.degree);
        if (res.ok) commit({ expr: res.expr });
      }
    },
    [commit, merged.degree]
  );

  // ✅ Point Add/Remove: Studio에서 내려오면 그대로 사용, 아니면 View에서 markers 패치로 fallback
  const handlePointAdd = useCallback(
    (pt) => {
      if (typeof onPointAdd === "function") {
        onPointAdd(pt);
        return;
      }
      const next = [...(merged.markers || []), pt];
      commit({ markers: next });
    },
    [onPointAdd, merged.markers, commit]
  );

  const handlePointRemove = useCallback(
    ({ id, index } = {}) => {
      if (typeof onPointRemove === "function") {
        onPointRemove({ id, index });
        return;
      }
      const arr = Array.isArray(merged.markers) ? [...merged.markers] : [];
      if (id != null) {
        const k = arr.findIndex((m) => (m?.id ?? null) === id);
        if (k >= 0) arr.splice(k, 1);
      } else if (Number.isFinite(Number(index))) {
        const i = Number(index);
        if (i >= 0 && i < arr.length) arr.splice(i, 1);
      }
      commit({ markers: arr });
    },
    [onPointRemove, merged.markers, commit]
  );

  if (!surface3d) {
    return <div className="empty-hint">3D 곡면 정보가 없습니다.</div>;
  }

  return (
    <div className="graph-view">
      <Surface3DCanvas
        expr={merged.expr}
        baseExpr={merged.baseExpr}
        xMin={merged.xMin}
        xMax={merged.xMax}
        yMin={merged.yMin}
        yMax={merged.yMax}
        nx={merged.nx}
        ny={merged.ny}
        markers={merged.markers}
        editMode={merged.editMode}
        degree={merged.degree}
        onPointAdd={handlePointAdd}
        onPointRemove={handlePointRemove}
        onMarkersChange={handleMarkersChange}
        gridMode={merged.gridMode}
        gridStep={merged.gridStep}
        minorDiv={merged.minorDiv}
      />
    </div>
  );
}

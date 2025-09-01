import { useEffect, useMemo, useState } from "react";
import LeftPanel from "../ui/LeftPanel";
import GraphCanvas from "../ui/GraphCanvas";
import { create, all } from "mathjs";
import "../styles/Studio.css";

const math = create(all, {});

// ----- 최소자승 다항식 피팅(로컬 구현) -----
function vander(xs, degree) {
  const n = xs.length;
  const d1 = degree + 1;
  const X = Array.from({ length: n }, () => Array(d1).fill(0));
  for (let i = 0; i < n; i++) {
    let p = 1;
    for (let j = 0; j < d1; j++) {
      X[i][j] = p;
      p *= xs[i];
    }
  }
  return X;
}
function matT(X) {
  const r = X.length, c = X[0].length;
  const T = Array.from({ length: c }, () => Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = X[i][j];
  return T;
}
function matMul(A, B) {
  const r = A.length, m = A[0].length, c = B[0].length;
  const out = Array.from({ length: r }, () => Array(c).fill(0));
  for (let i = 0; i < r; i++) {
    for (let k = 0; k < m; k++) {
      const aik = A[i][k];
      for (let j = 0; j < c; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}
function matVec(A, v) {
  const r = A.length, c = A[0].length;
  const out = Array(r).fill(0);
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += A[i][j] * v[j];
    out[i] = s;
  }
  return out;
}
// 가우스 소거
function solveLinear(Ain, bin) {
  const n = Ain.length;
  const A = Ain.map(row => row.slice());
  const b = bin.slice();

  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-12) continue;
    if (piv !== i) { [A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]]; }

    const div = A[i][i];
    for (let j = i; j < n; j++) A[i][j] /= div;
    b[i] /= div;

    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      if (factor === 0) continue;
      for (let j = i; j < n; j++) A[r][j] -= factor * A[i][j];
      b[r] -= factor * b[i];
    }
  }
  return b; // now b is the solution
}
function fitPolyCoeffs(xs, ys, degree) {
  const X = vander(xs, degree);
  const XT = matT(X);
  const XT_X = matMul(XT, X);
  const XT_y = matVec(XT, ys);
  return solveLinear(XT_X, XT_y);
}
function coeffsToFn(coeffs) {
  return (x) => {
    let y = 0, p = 1;
    for (let i = 0; i < coeffs.length; i++) {
      y += coeffs[i] * p;
      p *= x;
    }
    return y;
  };
}
function coeffsToPretty(coeffs, digits = 4) {
  return coeffs
    .map((c, i) => {
      const v = Number(c.toFixed(digits));
      if (i === 0) return `${v}`;
      const sign = v >= 0 ? " + " : " - ";
      const mag = Math.abs(v);
      return `${sign}${mag}·x${i === 1 ? "" : `^${i}`}`;
    })
    .join("");
}
// ---------------------------------------------

export default function Studio() {
  // Domain & degree
  const [xmin, setXmin] = useState(-3);
  const [xmax, setXmax] = useState(3);
  const [degree, setDegree] = useState(3);

  // 사용자 수식(적용하면 포인트들을 그 수식으로 재배치)
  const [equationExpr, setEquationExpr] = useState("0.5*x^3 - 2*x");

  // 초기 포인트
  const [points, setPoints] = useState(() => {
    const n = 8;
    const xs = Array.from({ length: n }, (_, i) => -3 + (6 * i) / (n - 1));
    const fn0 = (x) => 0.5 * x * x * x - 2 * x;
    return xs.map((x, i) => ({ id: i, x, y: fn0(x) }));
  });

  // ✅ 점/차수 변경 시마다 재피팅 → 렌더용 함수 갱신
  const coeffs = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return fitPolyCoeffs(xs, ys, degree);
  }, [points, degree]);

  const fittedFn       = useMemo(() => coeffsToFn(coeffs), [coeffs]);
  const equationPretty = useMemo(() => coeffsToPretty(coeffs, 4), [coeffs]);

  // ✅ 곡선 리마운트용 키 (coeffs가 바뀔 때마다 변경)
  const curveKey = useMemo(
    () => coeffs.map((c) => c.toFixed(6)).join("|"),
    [coeffs]
  );

  // 수식 적용(포인트 재배치 → 자동으로 재피팅)
  function applyTypedEquation() {
    let compiled;
    try {
      compiled = math.compile(equationExpr);
    } catch {
      alert("수식을 해석할 수 없어요. 예: 0.5*x^3 - 2*x, sin(x)+x^2, ...");
      return;
    }
    const scope = { x: 0 };
    setPoints((prev) =>
      prev.map((p, i) => {
        scope.x = p.x;
        const y = Number(compiled.evaluate(scope));
        return { id: i, x: p.x, y: Number.isFinite(y) ? y : 0 };
      })
    );
  }

  // 도메인 변경 시 X만 재분할하고, 현재 피팅된 곡선으로 Y를 가져옴(모양 유지)
  useEffect(() => {
    const n = points.length;
    const xs = Array.from({ length: n }, (_, i) => xmin + ((xmax - xmin) * i) / (n - 1));
    setPoints(xs.map((x, i) => ({ id: i, x, y: fittedFn(x) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmin, xmax]);

  // 캔버스에서 점 이동 콜백
function updatePoint(idx, xy) {
  console.log("[Studio] setPoints", idx, xy); // 디버그
  setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, ...xy } : p)));
}


  return (
    <div className="studio-root">
      <LeftPanel
        degree={degree}
        setDegree={setDegree}
        xmin={xmin}
        xmax={xmax}
        setXmin={setXmin}
        setXmax={setXmax}
        equationExpr={equationExpr}
        setEquationExpr={setEquationExpr}
        equationPretty={equationPretty}
        onApply={applyTypedEquation}
      />
      <GraphCanvas
        points={points}
        onPointChange={updatePoint}
        xmin={xmin}
        xmax={xmax}
        fn={fittedFn}
        curveKey={curveKey}
      />
    </div>
  );
}

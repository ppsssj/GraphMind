import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import LeftPanel from "../ui/LeftPanel";
import GraphCanvas from "../ui/GraphCanvas";
import { create, all } from "mathjs";
import "../styles/Studio.css";

const math = create(all, {});

// ─────────────────────────────────────────────────────────────
// HELPER: 문자열 수식을 (x)=>y 함수로 변환 (NaN/오류 방지)
function exprToFn(raw) {
  const rhs = raw?.includes("=") ? raw.split("=").pop() : raw;
  const expr = String(rhs ?? "").trim();
  if (!expr) return () => NaN;
  try {
    const compiled = math.compile(expr);
    return (x) => {
      const y = Number(compiled.evaluate({ x }));
      return Number.isFinite(y) ? y : NaN;
    };
  } catch {
    return () => NaN;
  }
}

// HELPER: 최소자승 다항식 피팅 (math.js + 정규방정식)
function fitPolyCoeffs(xs, ys, degree) {
  const V = xs.map((x) => {
    const row = new Array(degree + 1);
    let p = 1;
    for (let j = 0; j <= degree; j++) {
      row[j] = p;
      p *= x;
    }
    return row;
  });
  const XT = math.transpose(V);
  const A = math.multiply(XT, V); // (d+1)×(d+1)
  const b = math.multiply(XT, ys); // (d+1)
  const sol = math.lusolve(A, b); // (d+1)×1
  return sol.map((v) => (Array.isArray(v) ? v[0] : v));
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
      if (Math.abs(v) < 1e-12) return "";          // 거의 0은 생략
      if (i === 0) return `${v}`;
      const sign = v >= 0 ? " + " : " - ";
      const mag = Math.abs(v);
      return `${sign}${mag}·x${i === 1 ? "" : `^${i}`}`;
    })
    .filter(Boolean)
    .join("");
}
// ─────────────────────────────────────────────────────────────

export default function Studio() {
  // Domain & degree
  const [xmin, setXmin] = useState(-3);
  const [xmax, setXmax] = useState(3);
  const [degree, setDegree] = useState(3);
  const location = useLocation();

  // 사용자 수식 (적용하면 포인트들을 그 수식으로 재배치)
  const initialExpr = location.state?.formula || "0.5*x^3 - 2*x";
  const [equationExpr, setEquationExpr] = useState(initialExpr);

  // 입력 수식을 "그대로" 그릴 함수 (빨강)
  const [typedFn, setTypedFn] = useState(() => exprToFn(initialExpr));

  // 초기 포인트 (도메인 등간격)
  const [points, setPoints] = useState(() => {
    const n = 8;
    const xs = Array.from({ length: n }, (_, i) => -3 + (6 * i) / (n - 1));
    const fn0 = exprToFn(initialExpr);
    return xs.map((x, i) => ({ id: i, x, y: Number(fn0(x)) || 0 }));
  });

  // ✅ 점/차수 변경 시마다 재피팅 (NaN 제거 + 차수 클램프)
  const [coeffs, setCoeffs] = useState(() => {
    const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const d = Math.min(degree, Math.max(0, clean.length - 1));
    return fitPolyCoeffs(clean.map(p => p.x), clean.map(p => p.y), d);
  });

  useEffect(() => {
    const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const d = Math.min(degree, Math.max(0, clean.length - 1));
    const xs = clean.map((p) => p.x);
    const ys = clean.map((p) => p.y);
    const c = fitPolyCoeffs(xs, ys, d);
    setCoeffs(c);
    console.log("[re-fit]", c.map((v) => +Number(v).toFixed(6)));
  }, [points, degree]);

  const fittedFn = useMemo(() => coeffsToFn(coeffs), [coeffs]);
  const equationPretty = useMemo(() => coeffsToPretty(coeffs, 4), [coeffs]);

  // 곡선 리마운트용 key (coeffs가 바뀔 때마다 변경)
  const [ver, setVer] = useState(0);
  const curveKey = useMemo(
    () => coeffs.map((c) => c.toFixed(6)).join("|") + `|v${ver}`,
    [coeffs, ver]
  );

  // 수식 적용(포인트 재배치 → 자동으로 재피팅)
  const applyTypedEquation = useCallback(
    (srcExpr = equationExpr) => {
      const rhs = srcExpr.includes("=") ? srcExpr.split("=").pop() : srcExpr;
      const expr = rhs.trim();
      console.log("[applyTypedEquation] 수식 입력:", srcExpr);

      let compiled;
      try {
        compiled = math.compile(expr);
      } catch (error) {
        console.error("[applyTypedEquation] 수식 컴파일 실패:", error);
        alert("수식을 해석할 수 없어요. 예: 0.5*x^3 - 2*x, sin(x)+x^2, ...");
        return;
      }

      // 빨강 곡선용 함수도 갱신
      setTypedFn(() => (x) => {
        const y = Number(compiled.evaluate({ x }));
        return Number.isFinite(y) ? y : NaN;
      });

      // 현재 x 좌표들만 유지하고 y를 입력 수식으로 재계산
      const scope = { x: 0 };
      setPoints((prev) =>
        prev.map((p, i) => {
          scope.x = p.x;
          const y = Number(compiled.evaluate(scope));
          return { id: i, x: p.x, y: Number.isFinite(y) ? y : 0 };
        })
      );
      setVer((v) => v + 1); // 강제 리마운트
    },
    [equationExpr]
  );

  // location.state.formula가 있을 때 1회 적용
  useEffect(() => {
    const f = location.state?.formula;
    if (typeof f === "string" && f.trim()) {
      setEquationExpr(f);
      applyTypedEquation(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // 도메인 변경 시 X만 재분할, 현재 "근사 곡선"으로 Y 재샘플 (모양 유지)
  useEffect(() => {
    const n = points.length;
    const xs = Array.from({ length: n }, (_, i) => xmin + ((xmax - xmin) * i) / (n - 1));
    setPoints(xs.map((x, i) => ({ id: i, x, y: Number(fittedFn(x)) || 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmin, xmax]);

  useEffect(() => {
    console.log("[coeffs]", coeffs.map((c) => +c.toFixed(6)));
  }, [coeffs]);

  // 캔버스에서 점 이동 콜백
  function updatePoint(idx, xy) {
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
        fn={fittedFn}     // 파랑: 다항 근사
        typedFn={typedFn} // 빨강: 입력 수식
        curveKey={curveKey}
      />
    </div>
  );
}

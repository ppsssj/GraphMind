import { useEffect, useMemo, useState } from "react";
import LeftPanel from "../ui/LeftPanel";
import GraphCanvas from "../ui/GraphCanvas";
import { fitPolynomial, coeffsToString, coeffsToFunction, sampleXs } from "../utils/polynomial";
import { create, all } from "mathjs";
import "../styles/Studio.css";

const math = create(all, {});

export default function Studio() {
  // Domain & degree
  const [xmin, setXmin] = useState(-3);
  const [xmax, setXmax] = useState(3);
  const [degree, setDegree] = useState(3);

  // Equation text the user can type (arbitrary function of x)
  const [equationExpr, setEquationExpr] = useState("0.5*x^3 - 2*x");

  // Control points (x is spaced, y follows the function / user drags)
  const [points, setPoints] = useState(() => {
    const xs = sampleXs(-3, 3, 8);
    const fn = (x) => 0.5 * x * x * x - 2 * x;
    return xs.map((x, i) => ({ id: i, x, y: fn(x) }));
  });

  // Fit a polynomial to current points → authoritative curve for rendering/text
  const coeffs = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return fitPolynomial(xs, ys, degree);
  }, [points, degree]);

  const fittedFn = useMemo(() => coeffsToFunction(coeffs), [coeffs]);
  const equationPretty = useMemo(() => coeffsToString(coeffs, 4), [coeffs]);

  // When user hits Apply in the left panel, reposition points to typed equation, then refit
  function applyTypedEquation() {
    let compiled;
    try {
      compiled = math.compile(equationExpr);
    } catch (err) {
      alert("수식을 해석할 수 없어요. 예: 0.5*x^3 - 2*x, sin(x)+x^2, ...");
      return;
    }
    const scope = { x: 0 };
    const xs = points.map((p) => p.x);
    const next = xs.map((x, i) => {
      scope.x = x;
      const y = Number(compiled.evaluate(scope));
      return { id: i, x, y: Number.isFinite(y) ? y : 0 };
    });
    setPoints(next);
  }

  // If domain changes, re-space X and re-evaluate with current fitted function to keep shape
  useEffect(() => {
    const xs = sampleXs(xmin, xmax, points.length);
    const next = xs.map((x, i) => ({ id: i, x, y: fittedFn(x) }));
    setPoints(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmin, xmax]);

  // Point updater from the canvas
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
        fn={fittedFn}
      />
    </div>
  );
}

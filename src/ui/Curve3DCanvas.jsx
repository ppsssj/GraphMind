// src/ui/Curve3DCanvas.jsx
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";

const math = create(all, {});

// 수식 문자열 → t를 받는 함수로 변환
function makeParamFn(expr, paramName = "t") {
  if (!expr) return () => 0;

  const rhs = expr.includes("=") ? expr.split("=").pop() : expr;
  const trimmed = String(rhs ?? "").trim() || "0";

  try {
    const compiled = math.compile(trimmed);
    return (t) => {
      try {
        const v = compiled.evaluate({ [paramName]: t });
        const num = Number(v);
        return Number.isFinite(num) ? num : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

// 좌표축 + 그리드 (3D)
function Axes3D({ size = 8 }) {
  return (
    <group>
      <axesHelper args={[size]} />
      {/* 바닥 그리드: x-z 평면 */}
      <gridHelper args={[size * 2, size * 2]} position={[0, -0.001, 0]} />
    </group>
  );
}

function ParametricCurve({
  xExpr,
  yExpr,
  zExpr,
  tMin,
  tMax,
  samples = 400,
  color = "#ffcc00",
}) {
  const positions = useMemo(() => {
    const xt = makeParamFn(xExpr, "t");
    const yt = makeParamFn(yExpr, "t");
    const zt = makeParamFn(zExpr, "t");

    const n = Math.max(10, samples | 0);
    const arr = new Float32Array((n + 1) * 3);
    const dt = (tMax - tMin) / n;

    let minR = 0;
    for (let i = 0; i <= n; i++) {
      const t = tMin + dt * i;
      const x = xt(t);
      const y = yt(t);
      const z = zt(t);
      const o = i * 3;
      arr[o + 0] = x;
      arr[o + 1] = y;
      arr[o + 2] = z;
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r > minR) minR = r;
    }

    // 필요하면 minR을 바탕으로 카메라/스케일 조정도 가능

    return arr;
  }, [xExpr, yExpr, zExpr, tMin, tMax, samples]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

export default function Curve3DCanvas({
  xExpr,
  yExpr,
  zExpr,
  tMin,
  tMax,
  samples,
}) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [6, 6, 6], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 7]} intensity={0.9} />

        <Axes3D size={8} />

        <ParametricCurve
          xExpr={xExpr}
          yExpr={yExpr}
          zExpr={zExpr}
          tMin={tMin}
          tMax={tMax}
          samples={samples}
        />

        <OrbitControls makeDefault />
      </Canvas>

      {/* 우상단에 간단한 정보 표시 (필요하면) */}
      <div
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "4px 6px",
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.3,
          maxWidth: "260px",
        }}
      >
        <div style={{ marginBottom: 4, opacity: 0.9 }}>3D 공간 곡선</div>
        <div>x(t) = {xExpr}</div>
        <div>y(t) = {yExpr}</div>
        <div>z(t) = {zExpr}</div>
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          t ∈ [{tMin}, {tMax}], samples: {samples}
        </div>
      </div>
    </div>
  );
}

// src/ui/Curve3DCanvas.jsx
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
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

function Axes3D({ size = 8 }) {
  return (
    <group>
      <axesHelper args={[size]} />
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

    for (let i = 0; i <= n; i++) {
      const t = tMin + dt * i;
      const x = xt(t);
      const y = yt(t);
      const z = zt(t);
      const o = i * 3;
      arr[o + 0] = x;
      arr[o + 1] = y;
      arr[o + 2] = z;
    }

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

/** ✅ 3D 곡선 위 특정 위치 노드
 * markers: { t, label? } 또는 { x, y, z, label? }[]
 */
function CurveMarkers({ xExpr, yExpr, zExpr, markers = [] }) {
  const xt = useMemo(() => makeParamFn(xExpr, "t"), [xExpr]);
  const yt = useMemo(() => makeParamFn(yExpr, "t"), [yExpr]);
  const zt = useMemo(() => makeParamFn(zExpr, "t"), [zExpr]);

  const pts = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      let x, y, z;
      if (typeof m.t === "number") {
        const t = m.t;
        x = xt(t);
        y = yt(t);
        z = zt(t);
      } else {
        x = m.x;
        y = m.y;
        z = m.z;
      }
      return {
        x,
        y,
        z,
        label:
          m.label ??
          `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
      };
    });
  }, [markers, xt, yt, zt]);

  if (!pts.length) return null;

  return (
    <group>
      {pts.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh>
            <sphereGeometry args={[0.1, 24, 24]} />
            <meshStandardMaterial color="#ffc107" />
          </mesh>
          <Text
            position={[0.16, 0.16, 0]}
            fontSize={0.24}
            color="#ffffff"
            anchorX="left"
            anchorY="bottom"
            outlineWidth={0.035}
            outlineColor="black"
          >
            {p.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

export default function Curve3DCanvas({
  xExpr,
  yExpr,
  zExpr,
  tMin,
  tMax,
  samples,
  // ✅ 추가: 노드 정보
  markers = [],
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

        {/* ✅ 곡선 위 노드 */}
        <CurveMarkers
          xExpr={xExpr}
          yExpr={yExpr}
          zExpr={zExpr}
          markers={markers}
        />

        <OrbitControls makeDefault />
      </Canvas>

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

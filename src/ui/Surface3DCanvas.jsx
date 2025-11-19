// src/ui/Surface3DCanvas.jsx
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";

const math = create(all, {});

// z = f(x,y) 수식을 (x,y) → z 함수로 변환
function makeScalarFn(expr) {
  if (!expr) return () => 0;

  const rhs = expr.includes("=") ? expr.split("=").pop() : expr;
  const trimmed = String(rhs ?? "").trim() || "0";

  try {
    const compiled = math.compile(trimmed);
    return (x, y) => {
      try {
        const v = compiled.evaluate({ x, y });
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
      {/* 바닥 그리드: x-z 평면 */}
      <gridHelper args={[size * 2, size * 2]} position={[0, -0.001, 0]} />
    </group>
  );
}

function SurfaceMesh({ expr, xMin, xMax, yMin, yMax, nx, ny }) {
  const { geometry } = useMemo(() => {
    const f = makeScalarFn(expr);

    const gx = Math.max(8, nx | 0);
    const gy = Math.max(8, ny | 0);

    const positions = new Float32Array(gx * gy * 3);
    const colors = new Float32Array(gx * gy * 3);
    const indices = [];

    const dx = (xMax - xMin) / (gx - 1);
    const dy = (yMax - yMin) / (gy - 1);

    let minZ = Infinity;
    let maxZ = -Infinity;

    // 위치/높이 계산
    for (let j = 0; j < gy; j++) {
      const y = yMin + dy * j;
      for (let i = 0; i < gx; i++) {
        const x = xMin + dx * i;
        const z = f(x, y);

        const idx = j * gx + i;
        const o = idx * 3;

        positions[o + 0] = x;
        positions[o + 1] = z;
        positions[o + 2] = y; // world: (x, z=f(x,y), y)

        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }

    const span = maxZ - minZ || 1;
    const color = new THREE.Color();

    // 색상(높이 기반 그라데이션)
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const idx = j * gx + i;
        const o = idx * 3;
        const z = positions[o + 1];
        const t = (z - minZ) / span; // 0~1

        // 보라 → 파랑 → 청록 → 노랑 계열
        color.setHSL(0.7 - 0.5 * t, 0.8, 0.5 + 0.15 * t);

        colors[o + 0] = color.r;
        colors[o + 1] = color.g;
        colors[o + 2] = color.b;
      }
    }

    // 인덱스 (두 삼각형으로 한 사각형 구성)
    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const a = j * gx + i;
        const b = j * gx + (i + 1);
        const c = (j + 1) * gx + i;
        const d = (j + 1) * gx + (i + 1);
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { geometry };
  }, [expr, xMin, xMax, yMin, yMax, nx, ny]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.6}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** ✅ surface 위 특정 좌표만 노드로 표시
 * markers: { x, y, z?, label? }[]
 * z가 없으면 z = f(x, y)로 계산
 */
function SurfaceMarkers({ expr, markers = [] }) {
  const f = useMemo(() => makeScalarFn(expr), [expr]);

  const pts = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      const x = m.x;
      const y = m.y;
      const z = m.z ?? f(x, y);
      return {
        x,
        y,
        z,
        label:
          m.label ??
          `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
      };
    });
  }, [markers, f]);

  if (!pts.length) return null;

  return (
    <group>
      {pts.map((p, i) => (
        <group key={i} position={[p.x, p.z, p.y]}>
          <mesh>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial color="#ffc107" />
          </mesh>
          <Text
            position={[0.18, 0.18, 0]}
            fontSize={0.28}
            color="#ffffff"
            anchorX="left"
            anchorY="bottom"
            outlineWidth={0.04}
            outlineColor="black"
          >
            {p.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

export default function Surface3DCanvas({
  expr,
  xMin,
  xMax,
  yMin,
  yMax,
  nx,
  ny,
  // ✅ 추가: 표시할 좌표 노드
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
        camera={{ position: [6, 6, 6], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 8]} intensity={0.9} />

        <Axes3D size={8} />

        <SurfaceMesh
          expr={expr}
          xMin={xMin}
          xMax={xMax}
          yMin={yMin}
          yMax={yMax}
          nx={nx}
          ny={ny}
        />

        {/* ✅ 특정 좌표 노드 */}
        <SurfaceMarkers expr={expr} markers={markers} />

        <OrbitControls makeDefault />
      </Canvas>

      {/* 우상단 정보 오버레이 */}
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
        <div style={{ marginBottom: 4, opacity: 0.9 }}>3D 곡면 (z = f(x,y))</div>
        <div>z = {expr}</div>
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          x ∈ [{xMin}, {xMax}], y ∈ [{yMin}, {yMax}]
          <br />
          samples: {nx} × {ny}
        </div>
      </div>
    </div>
  );
}

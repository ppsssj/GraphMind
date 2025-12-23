// src/ui/Surface3DCanvas.jsx
import { useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";

const mathjs = create(all, {});

// z = f(x,y) 수식을 (x,y) → z 함수로 변환
function makeScalarFn(expr) {
  if (!expr) return () => 0;

  const rhs = expr.includes("=") ? expr.split("=").pop() : expr;
  const trimmed = String(rhs ?? "").trim() || "0";

  try {
    const compiled = mathjs.compile(trimmed);
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

/**
 * ✅ Curve3D와 동일한 "정육면체(직육면체) 내부 라티스" 격자
 * - gridMode: "off" | "box" | "major" | "full"
 * - gridStep: 메이저 격자 간격
 * - minorDiv: full 모드에서 minorStep = gridStep / minorDiv
 */
function CubeLatticeGrid({
  bounds, // { xmin,xmax, ymin,ymax, zmin,zmax } in WORLD axes
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode)) ? String(gridMode) : "major";
  const b = bounds;

  const buildCoords = (minV, maxV, step, maxDivisions) => {
    const s = Math.max(0.1, Number(step) || 1);
    const coords = [];

    const start = Math.ceil(minV / s) * s;
    for (let v = start; v <= maxV + 1e-6; v += s) coords.push(v);

    if (coords.length === 0 || Math.abs(coords[0] - minV) > 1e-6) coords.unshift(minV);
    if (Math.abs(coords[coords.length - 1] - maxV) > 1e-6) coords.push(maxV);

    if (coords.length > maxDivisions + 1) {
      const n = maxDivisions;
      coords.length = 0;
      for (let i = 0; i <= n; i++) coords.push(minV + ((maxV - minV) * i) / n);
    }
    return { coords, step: s };
  };

  const buildLatticePositions = (xs, ys, zs, xmin, xmax, ymin, ymax, zmin, zmax) => {
    const nx = xs.length;
    const ny = ys.length;
    const nz = zs.length;

    const lineCount = ny * nz + nx * nz + nx * ny;
    const arr = new Float32Array(lineCount * 2 * 3);
    let o = 0;

    // X lines (y,z fixed)
    for (let yi = 0; yi < ny; yi++) {
      for (let zi = 0; zi < nz; zi++) {
        const y = ys[yi];
        const z = zs[zi];
        arr[o++] = xmin;
        arr[o++] = y;
        arr[o++] = z;
        arr[o++] = xmax;
        arr[o++] = y;
        arr[o++] = z;
      }
    }

    // Y lines (x,z fixed)
    for (let xi = 0; xi < nx; xi++) {
      for (let zi = 0; zi < nz; zi++) {
        const x = xs[xi];
        const z = zs[zi];
        arr[o++] = x;
        arr[o++] = ymin;
        arr[o++] = z;
        arr[o++] = x;
        arr[o++] = ymax;
        arr[o++] = z;
      }
    }

    // Z lines (x,y fixed)
    for (let xi = 0; xi < nx; xi++) {
      for (let yi = 0; yi < ny; yi++) {
        const x = xs[xi];
        const y = ys[yi];
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = zmin;
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = zmax;
      }
    }

    return arr;
  };

  const edgesGeo = useMemo(() => {
    if (!b || mode === "off") return null;
    const w = b.xmax - b.xmin;
    const h = b.ymax - b.ymin;
    const d = b.zmax - b.zmin;

    const box = new THREE.BoxGeometry(Math.max(1e-6, w), Math.max(1e-6, h), Math.max(1e-6, d));
    box.translate(b.xmin + w / 2, b.ymin + h / 2, b.zmin + d / 2);
    return box;
  }, [b, mode]);

  useEffect(() => {
    return () => {
      try {
        edgesGeo?.dispose();
      } catch {}
    };
  }, [edgesGeo]);

  const { majorPositions, minorPositions } = useMemo(() => {
    if (!b || mode === "off" || mode === "box") return { majorPositions: null, minorPositions: null };

    const { coords: xs, step: majorStepNorm } = buildCoords(b.xmin, b.xmax, gridStep, 50);
    const { coords: ys } = buildCoords(b.ymin, b.ymax, gridStep, 50);
    const { coords: zs } = buildCoords(b.zmin, b.zmax, gridStep, 50);

    const major = buildLatticePositions(xs, ys, zs, b.xmin, b.xmax, b.ymin, b.ymax, b.zmin, b.zmax);

    if (mode !== "full") return { majorPositions: major, minorPositions: null };

    const div = Math.max(2, Math.floor(Number(minorDiv) || 4));
    const minorStep = Math.max(0.1, majorStepNorm / div);

    const { coords: xs2 } = buildCoords(b.xmin, b.xmax, minorStep, 60);
    const { coords: ys2 } = buildCoords(b.ymin, b.ymax, minorStep, 60);
    const { coords: zs2 } = buildCoords(b.zmin, b.zmax, minorStep, 60);

    const eps = 1e-5;
    const filterNotOnMajor = (arr, baseStep) =>
      arr.filter((v) => {
        const k = Math.round(v / baseStep);
        return Math.abs(v - k * baseStep) > eps;
      });

    const xsMinor = filterNotOnMajor(xs2, majorStepNorm);
    const ysMinor = filterNotOnMajor(ys2, majorStepNorm);
    const zsMinor = filterNotOnMajor(zs2, majorStepNorm);

    const minor = buildLatticePositions(xsMinor, ysMinor, zsMinor, b.xmin, b.xmax, b.ymin, b.ymax, b.zmin, b.zmax);

    return { majorPositions: major, minorPositions: minor };
  }, [b, mode, gridStep, minorDiv]);

  if (mode === "off" || !b) return null;

  return (
    <group>
      {/* 외곽 박스 */}
      {edgesGeo && (
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#64748b" transparent opacity={0.25} depthWrite={false} />
        </lineSegments>
      )}

      {/* 내부 메이저 격자 */}
      {majorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorPositions}
              count={majorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#334155" transparent opacity={0.12} depthWrite={false} />
        </lineSegments>
      )}

      {/* 내부 마이너 격자 */}
      {minorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={minorPositions}
              count={minorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#334155" transparent opacity={0.04} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}

/** surface 위 특정 좌표를 노드로 표시
 * markers: { x, y, z?, label? }[]
 * - z가 없으면 z = f(x, y)로 계산
 * - WORLD 좌표는 (x, z=f(x,y), y)
 */
function SurfaceMarkers({ f, markers = [] }) {
  const pts = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      const x = Number(m.x ?? 0);
      const y = Number(m.y ?? 0);
      const z = Number.isFinite(Number(m.z)) ? Number(m.z) : f(x, y);
      return {
        x,
        y,
        z,
        label: m.label ?? `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
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
  markers = [],

  // ✅ Curve3D와 동일한 Grid props
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const f = useMemo(() => makeScalarFn(expr), [expr]);

  const meshData = useMemo(() => {
    const xmin = Number(xMin);
    const xmax = Number(xMax);
    const ymin = Number(yMin);
    const ymax = Number(yMax);
    const gx = Math.max(8, Number(nx) || 60);
    const gy = Math.max(8, Number(ny) || 60);

    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) {
      const g = new THREE.BufferGeometry();
      return { geometry: g, zMin: -5, zMax: 5, bounds: null };
    }

    const positions = new Float32Array(gx * gy * 3);
    const colors = new Float32Array(gx * gy * 3);
    const indices = [];

    const dx = (xmax - xmin) / (gx - 1);
    const dy = (ymax - ymin) / (gy - 1);

    let zMin = Infinity;
    let zMax = -Infinity;

    for (let j = 0; j < gy; j++) {
      const y = ymin + dy * j;
      for (let i = 0; i < gx; i++) {
        const x = xmin + dx * i;
        const z = f(x, y);

        const idx = j * gx + i;
        const o = idx * 3;

        positions[o + 0] = x;
        positions[o + 1] = z; // world.y
        positions[o + 2] = y; // world.z

        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }

    if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
      zMin = -5;
      zMax = 5;
    }

    // 너무 납작하면 두께 보정
    if (Math.abs(zMax - zMin) < 1e-6) {
      zMin -= 0.5;
      zMax += 0.5;
    }

    const span = zMax - zMin || 1;
    const c = new THREE.Color();
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const idx = j * gx + i;
        const o = idx * 3;
        const z = positions[o + 1];
        const t = (z - zMin) / span; // 0~1
        c.setHSL(0.7 - 0.5 * t, 0.8, 0.5 + 0.15 * t);
        colors[o + 0] = c.r;
        colors[o + 1] = c.g;
        colors[o + 2] = c.b;
      }
    }

    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const a = j * gx + i;
        const b = j * gx + (i + 1);
        const c0 = (j + 1) * gx + i;
        const d = (j + 1) * gx + (i + 1);
        indices.push(a, c0, b, b, c0, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const bounds = {
      xmin: Math.min(xmin, xmax),
      xmax: Math.max(xmin, xmax),
      ymin: zMin, // world.y bounds are z-range
      ymax: zMax,
      zmin: Math.min(ymin, ymax), // world.z bounds are input y-range
      zmax: Math.max(ymin, ymax),
    };

    return { geometry, zMin, zMax, bounds };
  }, [xMin, xMax, yMin, yMax, nx, ny, f]);

  useEffect(() => {
    return () => {
      try {
        meshData.geometry.dispose();
      } catch {}
    };
  }, [meshData]);

  const axesSize = useMemo(() => {
    if (!meshData.bounds) return 8;
    const sx = Math.abs(meshData.bounds.xmax - meshData.bounds.xmin);
    const sy = Math.abs(meshData.bounds.ymax - meshData.bounds.ymin);
    const sz = Math.abs(meshData.bounds.zmax - meshData.bounds.zmin);
    return Math.max(4, Math.min(40, Math.max(sx, sy, sz)));
  }, [meshData.bounds]);

  return (
    <div style={{ position: "relative", flex: 1, width: "100%", height: "100%", overflow: "hidden" }}>
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#0f1115"), 1.0)}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 8]} intensity={0.9} />

        <axesHelper args={[axesSize]} />

        {/* ✅ 정육면체(직육면체) 내부 라티스 격자 */}
        <CubeLatticeGrid bounds={meshData.bounds} gridMode={gridMode} gridStep={gridStep} minorDiv={minorDiv} />

        {/* Surface mesh */}
        <mesh geometry={meshData.geometry}>
          <meshStandardMaterial vertexColors roughness={0.6} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>

        <SurfaceMarkers f={f} markers={markers} />

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
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          grid: {gridMode}, step: {gridStep}
        </div>
      </div>
    </div>
  );
}

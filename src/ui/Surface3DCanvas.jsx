// src/ui/Surface3DCanvas.jsx
import { useMemo, useEffect, useState, useRef } from "react";
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
 * ✅ Curve3D의 "정육면체 내부 라티스"와 동일한 방식의 3D 격자 (직육면체 지원)
 * - gridMode: "off" | "box" | "major" | "full"
 * - gridStep: 메이저 격자 간격
 * - minorDiv: full 모드에서 minorStep = gridStep / minorDiv
 *
 * Surface3D의 월드 좌표계:
 *  - world.x = x
 *  - world.y = z = f(x,y)   (수직축)
 *  - world.z = y           (입력 y가 깊이축)
 */
function CubeLatticeGrid({
  xMin,
  xMax,
  yMin, // input y min (world z)
  yMax, // input y max (world z)
  zMin, // function z min (world y)
  zMax, // function z max (world y)
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode)) ? String(gridMode) : "major";

  const bounds = useMemo(() => {
    const xmin = Number(xMin);
    const xmax = Number(xMax);
    const zmin = Number(yMin);
    const zmax = Number(yMax);
    const ymin = Number(zMin);
    const ymax = Number(zMax);

    const ok = [xmin, xmax, zmin, zmax, ymin, ymax].every((v) => Number.isFinite(v));
    if (!ok) return null;

    // 정렬 및 최소 두께 보장
    const bx0 = Math.min(xmin, xmax);
    const bx1 = Math.max(xmin, xmax);
    const bz0 = Math.min(zmin, zmax);
    const bz1 = Math.max(zmin, zmax);
    const by0 = Math.min(ymin, ymax);
    const by1 = Math.max(ymin, ymax);

    // 너무 납작하면 약간 두께 보정
    const eps = 1e-6;
    const padY = Math.max(0, (by1 - by0 < eps ? 1 : 0) * 0.5);

    return {
      xmin: bx0,
      xmax: bx1,
      zmin: bz0,
      zmax: bz1,
      ymin: by0 - padY,
      ymax: by1 + padY,
    };
  }, [xMin, xMax, yMin, yMax, zMin, zMax]);

  const buildCoords = (minV, maxV, step, maxDivisions) => {
    const s = Math.max(0.1, Number(step) || 1);
    const coords = [];

    // 눈금 시작을 gridStep에 스냅(시각적으로 안정)
    const start = Math.ceil(minV / s) * s;
    for (let v = start; v <= maxV + 1e-6; v += s) coords.push(v);

    // 끝점 포함 보장
    if (coords.length === 0 || Math.abs(coords[0] - minV) > 1e-6) coords.unshift(minV);
    if (Math.abs(coords[coords.length - 1] - maxV) > 1e-6) coords.push(maxV);

    // 과도한 라인 폭증 방지
    if (coords.length > maxDivisions + 1) {
      const n = maxDivisions;
      coords.length = 0;
      for (let i = 0; i <= n; i++) coords.push(minV + ((maxV - minV) * i) / n);
    }
    return { coords, step: s };
  };

  const buildCuboidLatticePositions = (xs, ys, zs, xmin, xmax, ymin, ymax, zmin, zmax) => {
    const nx = xs.length;
    const ny = ys.length;
    const nz = zs.length;

    // x-lines: for each (y,z)  => nx? no, each line uses xmin->xmax so count = ny*nz
    // y-lines: for each (x,z) => nx*nz
    // z-lines: for each (x,y) => nx*ny
    const lineCount = ny * nz + nx * nz + nx * ny;
    const arr = new Float32Array(lineCount * 2 * 3);
    let o = 0;

    // X 방향 라인: (y,z)마다 x = xmin..xmax
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

    // Y 방향 라인: (x,z)마다 y = ymin..ymax
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

    // Z 방향 라인: (x,y)마다 z = zmin..zmax
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
    if (!bounds) return null;
    const { xmin, xmax, ymin, ymax, zmin, zmax } = bounds;
    const w = xmax - xmin;
    const h = ymax - ymin;
    const d = zmax - zmin;
    const box = new THREE.BoxGeometry(w, h, d);
    box.translate(xmin + w / 2, ymin + h / 2, zmin + d / 2);
    return box;
  }, [bounds]);

  useEffect(() => {
    return () => {
      try {
        edgesGeo?.dispose();
      } catch {}
    };
  }, [edgesGeo]);

  const { majorPositions, minorPositions } = useMemo(() => {
    if (!bounds) return { majorPositions: null, minorPositions: null };
    if (mode === "off" || mode === "box") return { majorPositions: null, minorPositions: null };

    const { xmin, xmax, ymin, ymax, zmin, zmax } = bounds;

    const { coords: xs, step: majorStepNorm } = buildCoords(xmin, xmax, gridStep, 50);
    const { coords: ys } = buildCoords(ymin, ymax, gridStep, 50);
    const { coords: zs } = buildCoords(zmin, zmax, gridStep, 50);

    const major = buildCuboidLatticePositions(xs, ys, zs, xmin, xmax, ymin, ymax, zmin, zmax);

    if (mode !== "full") return { majorPositions: major, minorPositions: null };

    const div = Math.max(2, Math.floor(Number(minorDiv) || 4));
    const minorStep = Math.max(0.1, majorStepNorm / div);

    const { coords: xs2 } = buildCoords(xmin, xmax, minorStep, 60);
    const { coords: ys2 } = buildCoords(ymin, ymax, minorStep, 60);
    const { coords: zs2 } = buildCoords(zmin, zmax, minorStep, 60);

    // minor 중 major와 거의 겹치는 좌표는 제거(선 두께 과도 방지)
    const eps = 1e-5;
    const filterNotOnMajor = (arr, baseStep) =>
      arr.filter((v) => {
        const k = Math.round(v / baseStep);
        return Math.abs(v - k * baseStep) > eps;
      });

    const xsMinor = filterNotOnMajor(xs2, majorStepNorm);
    const ysMinor = filterNotOnMajor(ys2, majorStepNorm);
    const zsMinor = filterNotOnMajor(zs2, majorStepNorm);

    const minor = buildCuboidLatticePositions(xsMinor, ysMinor, zsMinor, xmin, xmax, ymin, ymax, zmin, zmax);

    return { majorPositions: major, minorPositions: minor };
  }, [bounds, mode, gridStep, minorDiv]);

  if (mode === "off") return null;

  return (
    <group>
      {/* 외곽 박스 */}
      {edgesGeo && (
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#64748b" transparent opacity={0.25} depthWrite={false} />
        </lineSegments>
      )}

      {/* 내부 메이저 */}
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

      {/* 내부 마이너 */}
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

function SurfaceMesh({ expr, xMin, xMax, yMin, yMax, nx, ny, onZRange }) {
  const { geometry, zMin, zMax } = useMemo(() => {
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

        // world: (x, z=f(x,y), y)
        positions[o + 0] = x;
        positions[o + 1] = z;
        positions[o + 2] = y;

        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }

    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      minZ = -5;
      maxZ = 5;
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
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { geometry, zMin: minZ, zMax: maxZ };
  }, [expr, xMin, xMax, yMin, yMax, nx, ny]);

  useEffect(() => {
    try {
      onZRange?.(zMin, zMax);
    } catch {}
  }, [zMin, zMax, onZRange]);

  useEffect(() => {
    return () => {
      try {
        geometry.dispose();
      } catch {}
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.6} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** surface 위 특정 좌표를 노드로 표시
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
  // z-range는 메쉬 생성과 함께 산출됨
  const zRangeRef = useRef({ min: -5, max: 5 });
  const [zRange, setZRange] = useState({ min: -5, max: 5 });

  const updateZRange = (minZ, maxZ) => {
    const next = { min: minZ, max: maxZ };
    zRangeRef.current = next;
    setZRange(next);
  };

  // axes 크기는 세 축 범위 중 최대 기반
  const axesSize = useMemo(() => {
    const ok = [xMin, xMax, yMin, yMax].every((v) => Number.isFinite(Number(v)));
    if (!ok) return 8;
    const sx = Math.abs(Number(xMax) - Number(xMin));
    const sz = Math.abs(Number(yMax) - Number(yMin));
    const sy = Math.abs((zRange.max ?? 5) - (zRange.min ?? -5));
    return Math.max(4, Math.min(40, Math.max(sx, sz, sy)));
  }, [xMin, xMax, yMin, yMax, zRange]);

  return (
    <div style={{ position: "relative", flex: 1, width: "100%", height: "100%", overflow: "hidden" }}>
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 8]} intensity={0.9} />

        {/* 축 */}
        <axesHelper args={[axesSize]} />

        {/* ✅ 정육면체(직육면체) 내부 라티스 격자 */}
        <CubeLatticeGrid
          xMin={xMin}
          xMax={xMax}
          yMin={yMin}
          yMax={yMax}
          zMin={zRange.min}
          zMax={zRange.max}
          gridMode={gridMode}
          gridStep={gridStep}
          minorDiv={minorDiv}
        />

        <SurfaceMesh
          expr={expr}
          xMin={xMin}
          xMax={xMax}
          yMin={yMin}
          yMax={yMax}
          nx={nx}
          ny={ny}
          onZRange={updateZRange}
        />

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
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          grid: {gridMode}, step: {gridStep}
        </div>
      </div>
    </div>
  );
}

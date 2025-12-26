// src/ui/Surface3DCanvas.jsx
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";
import OrientationOverlay from "./OrientationOverlay";

const mathjs = create(all, {});

// z = f(x,y)
function makeScalarFn(expr) {
  if (!expr) return () => 0;

  const rhs = String(expr).includes("=") ? String(expr).split("=").pop() : expr;
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

function CubeLatticeGrid({ bounds, gridMode = "major", gridStep = 1, minorDiv = 4 }) {
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

    for (let yi = 0; yi < ny; yi++) {
      for (let zi = 0; zi < nz; zi++) {
        const y = ys[yi];
        const z = zs[zi];
        arr[o++] = xmin; arr[o++] = y; arr[o++] = z;
        arr[o++] = xmax; arr[o++] = y; arr[o++] = z;
      }
    }
    for (let xi = 0; xi < nx; xi++) {
      for (let zi = 0; zi < nz; zi++) {
        const x = xs[xi];
        const z = zs[zi];
        arr[o++] = x; arr[o++] = ymin; arr[o++] = z;
        arr[o++] = x; arr[o++] = ymax; arr[o++] = z;
      }
    }
    for (let xi = 0; xi < nx; xi++) {
      for (let yi = 0; yi < ny; yi++) {
        const x = xs[xi];
        const y = ys[yi];
        arr[o++] = x; arr[o++] = y; arr[o++] = zmin;
        arr[o++] = x; arr[o++] = y; arr[o++] = zmax;
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
      try { edgesGeo?.dispose(); } catch {}
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
      {edgesGeo && (
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#64748b" transparent opacity={0.25} depthWrite={false} />
        </lineSegments>
      )}

      {majorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={majorPositions} count={majorPositions.length / 3} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#334155" transparent opacity={0.12} depthWrite={false} />
        </lineSegments>
      )}

      {minorPositions && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={minorPositions} count={minorPositions.length / 3} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#334155" transparent opacity={0.04} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}

function usePlaneDrag({ enabled, onMove, onEnd, controlsRef }) {
  const draggingRef = useRef(false);

  const onPointerDown = useCallback(
    (e, planeY) => {
      if (!enabled) return;
      e.stopPropagation();
      draggingRef.current = true;
      if (controlsRef?.current) controlsRef.current.enabled = false;

      // pointer capture로 안정화
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
      // 첫 포인트도 반영
      if (onMove) onMove(e, planeY);
    },
    [enabled, onMove, controlsRef]
  );

  const onPointerMove = useCallback(
    (e, planeY) => {
      if (!enabled || !draggingRef.current) return;
      e.stopPropagation();
      if (onMove) onMove(e, planeY);
    },
    [enabled, onMove]
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      e.stopPropagation();
      draggingRef.current = false;
      if (controlsRef?.current) controlsRef.current.enabled = true;

      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {}

      onEnd?.();
    },
    [controlsRef, onEnd]
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}

function DraggableMarker({ marker, index, editMode, controlsRef, onUpdate, onCommit }) {
  const planeY = marker.worldY;
  const { camera } = useThree();

  const moveHandler = useCallback(
    (e, py) => {
      // domain 이동: world plane (normal=Y)에서 교차점 계산
      const ray = e.ray; // THREE.Ray
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -py); // y=py
      const hit = new THREE.Vector3();
      const ok = ray.intersectPlane(plane, hit);
      if (!ok) return;

      // world -> domain 변환: world.x = x, world.z = y
      const x = hit.x;
      const y = hit.z;

      onUpdate?.(index, { x, y });
    },
    [onUpdate, index]
  );

  const { onPointerDown, onPointerMove, onPointerUp } = usePlaneDrag({
    enabled: editMode,
    controlsRef,
    onMove: moveHandler,
    onEnd: onCommit,
  });

  return (
    <group position={[marker.worldX, marker.worldY, marker.worldZ]}>
      <mesh onPointerDown={(e) => onPointerDown(e, planeY)} onPointerMove={(e) => onPointerMove(e, planeY)} onPointerUp={onPointerUp}>
        <sphereGeometry args={[marker.r, 24, 24]} />
        <meshStandardMaterial color={editMode ? "#22c55e" : "#ffc107"} />
      </mesh>

      <Text
        position={[marker.r * 1.4, marker.r * 1.2, 0]}
        fontSize={marker.font}
        color="#ffffff"
        anchorX="left"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="black"
      >
        {marker.label}
      </Text>
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

  editMode = true,
  degree = 2,

  onAddMarker,
  onMarkersChange,

  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,
}) {
  const f = useMemo(() => makeScalarFn(expr), [expr]);

  const controlsRef = useRef(null);

  // surface mesh 생성
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

    let zMinV = Infinity;
    let zMaxV = -Infinity;

    for (let j = 0; j < gy; j++) {
      const y = ymin + dy * j;
      for (let i = 0; i < gx; i++) {
        const x = xmin + dx * i;
        const z = f(x, y);

        const idx = j * gx + i;
        const o = idx * 3;

        // world = (x, z, y)
        positions[o + 0] = x;
        positions[o + 1] = z;
        positions[o + 2] = y;

        if (z < zMinV) zMinV = z;
        if (z > zMaxV) zMaxV = z;
      }
    }

    if (!Number.isFinite(zMinV) || !Number.isFinite(zMaxV)) {
      zMinV = -5;
      zMaxV = 5;
    }
    if (Math.abs(zMaxV - zMinV) < 1e-6) {
      zMinV -= 0.5;
      zMaxV += 0.5;
    }

    const span = zMaxV - zMinV || 1;
    const c = new THREE.Color();
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const idx = j * gx + i;
        const o = idx * 3;
        const z = positions[o + 1];
        const t = (z - zMinV) / span; // 0~1
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
      ymin: zMinV, // world.y bounds = z-range
      ymax: zMaxV,
      zmin: Math.min(ymin, ymax), // world.z bounds = input y-range
      zmax: Math.max(ymin, ymax),
    };

    return { geometry, zMin: zMinV, zMax: zMaxV, bounds };
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

  // marker 렌더용 전처리 (world 변환 + 라벨)
  const markerRender = useMemo(() => {
    const b = meshData.bounds;
    const span = b ? Math.max(1e-6, Math.max(b.xmax - b.xmin, b.ymax - b.ymin, b.zmax - b.zmin)) : 10;
    const r = Math.max(0.06, Math.min(0.16, span * 0.015));
    const font = Math.max(0.18, Math.min(0.32, span * 0.02));

    return (Array.isArray(markers) ? markers : [])
      .map((m, idx) => {
        const x = Number(m?.x);
        const y = Number(m?.y);
        const z = Number(m?.z);
        if (![x, y, z].every(Number.isFinite)) return null;

        return {
          id: m?.id ?? idx,
          x, y, z,
          worldX: x,
          worldY: z,
          worldZ: y,
          r,
          font,
          label: `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
        };
      })
      .filter(Boolean);
  }, [markers, meshData.bounds]);

  const updateMarkerXY = useCallback(
    (idx, patch) => {
      const next = (Array.isArray(markers) ? [...markers] : []).map((m) => ({ ...m }));
      if (!next[idx]) return;

      const x = Number(patch?.x);
      const y = Number(patch?.y);

      if (Number.isFinite(x)) next[idx].x = x;
      if (Number.isFinite(y)) next[idx].y = y;

      // z는 기존 z 유지 (Curve3D처럼 노드가 “제약점” 역할)
      onMarkersChange?.(next, { fit: false });
    },
    [markers, onMarkersChange]
  );

  const commitFit = useCallback(() => {
    // 드래그 끝에서만 자동 fit
    onMarkersChange?.(Array.isArray(markers) ? markers : [], { fit: true });
  }, [markers, onMarkersChange]);

  const handleSurfacePointerDown = useCallback(
    (e) => {
      if (!editMode) return;
      // Shift + 클릭 → 해당 지점에 노드 추가
      if (!e.shiftKey) return;

      e.stopPropagation();
      const p = e.point; // world point
      const x = p.x;
      const y = p.z; // domain y
      const z = p.y; // surface z
      if (![x, y, z].every(Number.isFinite)) return;

      onAddMarker?.({
        id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        x,
        y,
        z,
      });
    },
    [editMode, onAddMarker]
  );

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

        <CubeLatticeGrid bounds={meshData.bounds} gridMode={gridMode} gridStep={gridStep} minorDiv={minorDiv} />

        {/* Surface mesh: Shift+클릭 노드 추가 */}
        <mesh geometry={meshData.geometry} onPointerDown={handleSurfacePointerDown}>
          <meshStandardMaterial vertexColors roughness={0.6} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>

        {/* Nodes */}
        {markerRender.map((m, idx) => (
          <DraggableMarker
            key={m.id}
            marker={m}
            index={idx}
            editMode={editMode}
            controlsRef={controlsRef}
            onUpdate={updateMarkerXY}
            onCommit={commitFit}
          />
        ))}

        {/* ✅ OrbitControls는 1개만 */}
        <OrbitControls ref={controlsRef} makeDefault />

        <OrientationOverlay controlsRef={controlsRef} />
      </Canvas>

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: 10,
          fontSize: 11,
          lineHeight: 1.35,
          maxWidth: 320,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Surface3D (Node Editing)</div>
        <div style={{ opacity: 0.9 }}>Shift+Click: Add node · Drag node: Move (x,y) → auto fit</div>
        <div style={{ marginTop: 6 }}>z = {expr}</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          nodes: {Array.isArray(markers) ? markers.length : 0} · degree: {degree}
          <br />
          grid: {gridMode}, step: {gridStep}
        </div>
      </div>
    </div>
  );
}

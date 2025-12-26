import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";
import OrientationOverlay from "./OrientationOverlay.jsx";

const math = create(all, {});

// -----------------------------
// math expr -> param fn
// -----------------------------
function makeParamFn(expr, paramName = "t") {
  if (!expr) return () => 0;

  const rhs = expr.includes("=") ? expr.split("=").pop() : expr;
  const trimmed = String(rhs ?? "").trim() || "0";

  let compiled;
  try {
    compiled = math.parse(trimmed).compile();
  } catch (e) {
    console.warn("Curve3D: failed to parse expression:", expr, e);
    return () => 0;
  }

  return (t) => {
    try {
      const v = compiled.evaluate({ [paramName]: t, t, pi: Math.PI, e: Math.E });
      const n = typeof v === "number" ? v : Number(v?.valueOf?.());
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };
}

// -----------------------------
// label utils
// -----------------------------
function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
function coordLabel(m) {
  return `(${fmtNum(m?.x)}, ${fmtNum(m?.y)}, ${fmtNum(m?.z)})`;
}

// -----------------------------
// bbox utils (for local grid)
// -----------------------------
function computeBBoxFromPositions(positions) {
  if (!positions || positions.length < 3) return null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function snapBBoxToStep(b, step) {
  const s = Math.max(0.1, Number(step) || 1);
  const floorS = (v) => Math.floor(v / s) * s;
  const ceilS = (v) => Math.ceil(v / s) * s;

  return {
    minX: floorS(b.minX),
    minY: floorS(b.minY),
    minZ: floorS(b.minZ),
    maxX: ceilS(b.maxX),
    maxY: ceilS(b.maxY),
    maxZ: ceilS(b.maxZ),
  };
}

// -----------------------------
// robust line component (positions update)
// -----------------------------
function Line3D({ positions, color = "#22c55e", linewidth = 2 }) {
  const geomRef = useRef(null);

  useEffect(() => {
    if (!geomRef.current || !positions) return;
    geomRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geomRef.current.attributes.position.needsUpdate = true;
    geomRef.current.computeBoundingSphere();
  }, [positions]);

  if (!positions) return null;

  return (
    <line>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial color={color} linewidth={linewidth} />
    </line>
  );
}

// -----------------------------
// axes + cube grid
// -----------------------------
function Axes3D({ size = 6, gridMode = "major", gridStep = 1, minorDiv = 4, bbox = null }) {
  return (
    <group>
      <axesHelper args={[size]} />
      <CubeGrid3D
        half={size}
        gridMode={gridMode}
        majorStep={gridStep}
        minorDiv={minorDiv}
        bbox={bbox}
      />
    </group>
  );
}

function buildCoords(min, max, step, maxCount = 120) {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return { coords: [min, max], effectiveStep: step };

  const roughCount = Math.floor(span / step) + 1;
  let effectiveStep = step;

  // 안전장치: 너무 촘촘하면 step을 키워서 라인 수 제한
  if (roughCount > maxCount) {
    const factor = Math.ceil(roughCount / maxCount);
    effectiveStep = step * factor;
  }

  const coords = [];
  for (let v = min; v <= max + 1e-9; v += effectiveStep) coords.push(v);

  // 경계 포함 보정
  if (coords.length === 0 || coords[0] !== min) coords.unshift(min);
  if (coords[coords.length - 1] !== max) coords.push(max);

  return { coords, effectiveStep };
}

// 3D 큐브 격자(내부 라티스)
function CubeGrid3D({ half = 6, gridMode = "major", majorStep = 1, minorDiv = 4, bbox = null }) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode)) ? String(gridMode) : "major";

  const stepMajor = Math.max(0.1, Number(majorStep) || 1);
  const div = Math.max(2, Number(minorDiv) || 4);
  const stepMinor = stepMajor / div;

  // ✅ Major/Full만 bbox(로컬) 적용. Box는 기존 글로벌 큐브 유지.
  const range = useMemo(() => {
    if ((mode === "major" || mode === "full") && bbox) {
      return {
        minX: bbox.minX,
        maxX: bbox.maxX,
        minY: bbox.minY,
        maxY: bbox.maxY,
        minZ: bbox.minZ,
        maxZ: bbox.maxZ,
      };
    }
    return { minX: -half, maxX: half, minY: -half, maxY: half, minZ: -half, maxZ: half };
  }, [mode, bbox, half]);

  const planeSize = half * 2;
  const boxGeo = useMemo(() => new THREE.BoxGeometry(planeSize, planeSize, planeSize), [planeSize]);

  // ✅ “중복 제거”된 내부 라티스: X방향 / Y방향 / Z방향 3 family만 생성
  const majorLineGeo = useMemo(() => {
    if (!(mode === "major" || mode === "full")) return null;

    const pts = [];

    const xs = buildCoords(range.minX, range.maxX, stepMajor).coords;
    const ys = buildCoords(range.minY, range.maxY, stepMajor).coords;
    const zs = buildCoords(range.minZ, range.maxZ, stepMajor).coords;

    // lines parallel X for each (y,z)
    for (const y of ys) {
      for (const z of zs) {
        pts.push(range.minX, y, z, range.maxX, y, z);
      }
    }
    // lines parallel Y for each (x,z)
    for (const x of xs) {
      for (const z of zs) {
        pts.push(x, range.minY, z, x, range.maxY, z);
      }
    }
    // lines parallel Z for each (x,y)
    for (const x of xs) {
      for (const y of ys) {
        pts.push(x, y, range.minZ, x, y, range.maxZ);
      }
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [mode, range.minX, range.maxX, range.minY, range.maxY, range.minZ, range.maxZ, stepMajor]);

  const minorLineGeo = useMemo(() => {
    if (mode !== "full") return null;

    const pts = [];

    const xs = buildCoords(range.minX, range.maxX, stepMinor).coords;
    const ys = buildCoords(range.minY, range.maxY, stepMinor).coords;
    const zs = buildCoords(range.minZ, range.maxZ, stepMinor).coords;

    for (const y of ys) {
      for (const z of zs) pts.push(range.minX, y, z, range.maxX, y, z);
    }
    for (const x of xs) {
      for (const z of zs) pts.push(x, range.minY, z, x, range.maxY, z);
    }
    for (const x of xs) {
      for (const y of ys) pts.push(x, y, range.minZ, x, y, range.maxZ);
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [mode, range.minX, range.maxX, range.minY, range.maxY, range.minZ, range.maxZ, stepMinor]);

  if (mode === "off") return null;

  // ✅ 조금 더 투명한 톤(요청 반영) + Full에서 minor가 보이도록만 유지
  const BOX_MAT = { color: "#94a3b8", opacity: 0.28 };
  const MAJOR_MAT = { color: "#64748b", opacity: 0.20 };
  const MINOR_MAT = { color: "#475569", opacity: 0.12 };

  return (
    <group>
      {/* box only (global) */}
      {mode === "box" && (
        <lineSegments geometry={boxGeo}>
          <lineBasicMaterial color={BOX_MAT.color} transparent opacity={BOX_MAT.opacity} />
        </lineSegments>
      )}

      {/* major grid (local when bbox present) */}
      {(mode === "major" || mode === "full") && majorLineGeo && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorLineGeo}
              count={majorLineGeo.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={MAJOR_MAT.color} transparent opacity={MAJOR_MAT.opacity} />
        </lineSegments>
      )}

      {/* minor grid (full only, local when bbox present) */}
      {mode === "full" && minorLineGeo && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={minorLineGeo}
              count={minorLineGeo.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={MINOR_MAT.color} transparent opacity={MINOR_MAT.opacity} />
        </lineSegments>
      )}
    </group>
  );
}

// -----------------------------
// marker visuals
// -----------------------------
function MarkerLabel({ position, label }) {
  return (
    <Text
      position={[position.x, position.y + 0.25, position.z ?? 0]}
      fontSize={0.18}
      color="#e5e7eb"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.01}
      outlineColor="#020617"
    >
      {label}
    </Text>
  );
}

// (토글 대상) 마커를 잇는 폴리라인
function MarkerCurve({ markers }) {
  const positions = useMemo(() => {
    if (!markers || markers.length < 2) return null;
    const pts = [];
    for (const m of markers) pts.push(m.x ?? 0, m.y ?? 0, m.z ?? 0);
    return pts.length ? new Float32Array(pts) : null;
  }, [markers]);

  return <Line3D positions={positions} color="#22c55e" linewidth={2} />;
}

function DraggableMarker3D({ marker, markerKey, onSelect, isSelected, onChange, onDragEnd, setControlsBusy }) {
  const meshRef = useRef();
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useCursor(hovered || isSelected);

  const plane = useMemo(() => new THREE.Plane(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  // ✅ 선택/비선택 색: 초록/노랑
  const baseColor = isSelected ? "#22c55e" : "#facc15";
  const hoverColor = isSelected ? "#34d399" : "#fde047";

  const onPointerDown = (e) => {
    e.stopPropagation();
    onSelect?.(markerKey);

    setDragging(true);
    setControlsBusy?.(true);
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    const rect = gl.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(ndc, camera);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, meshRef.current.position);

    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (ok) onChange?.(markerKey, { x: hit.x, y: hit.y, z: hit.z });
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    setControlsBusy?.(false);
    onDragEnd?.();
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[marker.x ?? 0, marker.y ?? 0, marker.z ?? 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={(e) => (e.stopPropagation(), setHovered(false))}
      >
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color={hovered ? hoverColor : baseColor} />
      </mesh>

      <MarkerLabel
        position={new THREE.Vector3(marker.x ?? 0, marker.y ?? 0, marker.z ?? 0)}
        label={coordLabel(marker)}
      />
    </group>
  );
}

function EditableMarker3D({ marker, markerKey, onSelect, isSelected, onChange, onDragEnd, setControlsBusy }) {
  const objRef = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered || isSelected);

  const baseColor = isSelected ? "#22c55e" : "#facc15";
  const hoverColor = isSelected ? "#34d399" : "#fde047";

  const handleDraggingChanged = (e) => {
    const v = typeof e === "boolean" ? e : e?.value;
    setControlsBusy?.(!!v);
    if (v === false) onDragEnd?.();
  };

  const handleObjectChange = () => {
    if (!objRef.current) return;
    const p = objRef.current.position;
    onChange?.(markerKey, { x: p.x, y: p.y, z: p.z });
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect?.(markerKey);
  };

  return (
    <group>
      <TransformControls object={objRef} mode="translate" onDraggingChanged={handleDraggingChanged} onObjectChange={handleObjectChange} />
      <mesh
        ref={objRef}
        position={[marker.x ?? 0, marker.y ?? 0, marker.z ?? 0]}
        onPointerDown={handleSelect}
        onPointerOver={(e) => (e.stopPropagation(), setHovered(true))}
        onPointerOut={(e) => (e.stopPropagation(), setHovered(false))}
      >
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial color={hovered ? hoverColor : baseColor} />
      </mesh>
      <MarkerLabel
        position={new THREE.Vector3(marker.x ?? 0, marker.y ?? 0, marker.z ?? 0)}
        label={coordLabel(marker)}
      />
    </group>
  );
}

// -----------------------------
// main canvas
// -----------------------------
export default function Curve3DCanvas({
  baseXExpr,
  baseYExpr,
  baseZExpr,
  xExpr,
  yExpr,
  zExpr,
  tMin = -2,
  tMax = 2,
  samples = 200,

  // Grid
  gridMode = "major",
  gridStep = 1,
  minorDiv = 4,

  markers = [],
  onMarkerChange,
  onRecalculateExpressions,
  editMode = "drag",

  // Deform constraints
  deformSigma = 0.6,
  maxDelta = 1.5,

  // Marker polyline toggle
  showMarkerPolyline = false,
}) {
  // 기준(회색) 곡선: base가 있으면 base 사용, 없으면 edit 사용
  const refXExpr = baseXExpr ?? xExpr;
  const refYExpr = baseYExpr ?? yExpr;
  const refZExpr = baseZExpr ?? zExpr;

  const controlsRef = useRef();

  const xtRef = useMemo(() => makeParamFn(refXExpr, "t"), [refXExpr]);
  const ytRef = useMemo(() => makeParamFn(refYExpr, "t"), [refYExpr]);
  const ztRef = useMemo(() => makeParamFn(refZExpr, "t"), [refZExpr]);

  // 편집 수식(저장용)
  const xt = useMemo(() => makeParamFn(xExpr, "t"), [xExpr]);
  const yt = useMemo(() => makeParamFn(yExpr, "t"), [yExpr]);
  const zt = useMemo(() => makeParamFn(zExpr, "t"), [zExpr]);

  const markerKeys = useMemo(() => {
    const ms = Array.isArray(markers) ? markers : [];
    return ms.map((m, idx) => m?.id ?? idx);
  }, [markers]);

  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    if (selectedKey == null) {
      if (markerKeys.length > 0) setSelectedKey(markerKeys[0]);
      return;
    }
    if (!markerKeys.includes(selectedKey) && markerKeys.length > 0) setSelectedKey(markerKeys[0]);
  }, [markerKeys, selectedKey]);

  // base curve positions
  const basePositions = useMemo(() => {
    if (!refXExpr || !refYExpr || !refZExpr || samples < 2) return null;
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xtRef(t);
      const y = ytRef(t);
      const z = ztRef(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) pts.push(x, y, z);
    }
    return pts.length ? new Float32Array(pts) : null;
  }, [refXExpr, refYExpr, refZExpr, tMin, tMax, samples, xtRef, ytRef, ztRef]);

  // markers: 좌표 없는 경우 기준식으로 채움
  const displayMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      let x = Number.isFinite(m.x) ? m.x : undefined;
      let y = Number.isFinite(m.y) ? m.y : undefined;
      let z = Number.isFinite(m.z) ? m.z : undefined;

      if ((x === undefined || y === undefined || z === undefined) && typeof m.t === "number") {
        const tx = xtRef(m.t);
        const ty = ytRef(m.t);
        const tz = ztRef(m.t);
        x = x ?? (Number.isFinite(tx) ? tx : 0);
        y = y ?? (Number.isFinite(ty) ? ty : 0);
        z = z ?? (Number.isFinite(tz) ? tz : 0);
      }

      return { ...m, x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    });
  }, [markers, xtRef, ytRef, ztRef]);

  // 노드 기반 커널 변형(즉시 프리뷰)
  const kernelDeform = useMemo(() => {
    const tPoints = (displayMarkers || []).filter((m) => typeof m.t === "number");
    const s = Math.max(1e-6, Number(deformSigma) || 0.6);
    const eps = 1e-9;

    const w = (t, ti) => Math.exp(-(((t - ti) / s) ** 2));

    const dx = [];
    const dy = [];
    const dz = [];

    for (const m of tPoints) {
      const ti = m.t;
      const bx = xtRef(ti);
      const by = ytRef(ti);
      const bz = ztRef(ti);
      if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)) continue;

      dx.push({ ti, di: Number(m.x) - bx });
      dy.push({ ti, di: Number(m.y) - by });
      dz.push({ ti, di: Number(m.z) - bz });
    }

    const makeDeltaFn = (arr) => (t) => {
      let num = 0;
      let den = eps;
      for (const { ti, di } of arr) {
        if (!Number.isFinite(di)) continue;
        const wi = w(t, ti);
        num += di * wi;
        den += wi;
      }
      return num / den;
    };

    const dfx = makeDeltaFn(dx);
    const dfy = makeDeltaFn(dy);
    const dfz = makeDeltaFn(dz);

    return {
      hasPoints: tPoints.length >= 2,
      x: (t) => xtRef(t) + dfx(t),
      y: (t) => ytRef(t) + dfy(t),
      z: (t) => ztRef(t) + dfz(t),
    };
  }, [displayMarkers, deformSigma, xtRef, ytRef, ztRef]);

  // 편집 곡선: (노드 2개 이상이면) 프리뷰로 계산, 아니면 식 자체로 계산
  const editPositions = useMemo(() => {
    if (samples < 2) return null;
    const usePreview = !!kernelDeform?.hasPoints;

    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;

      const x = usePreview ? kernelDeform.x(t) : xt(t);
      const y = usePreview ? kernelDeform.y(t) : yt(t);
      const z = usePreview ? kernelDeform.z(t) : zt(t);

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) pts.push(x, y, z);
    }

    return pts.length ? new Float32Array(pts) : null;
  }, [tMin, tMax, samples, kernelDeform, xt, yt, zt]);

  // ✅ 로컬 격자 bbox: 현재 렌더링 곡선(edit 우선, 없으면 base) 기준으로 계산
  const localGridBBox = useMemo(() => {
    // major/full에서만 사용
    if (!(gridMode === "major" || gridMode === "full")) return null;

    const src = editPositions ?? basePositions;
    const b = computeBBoxFromPositions(src);
    if (!b) return null;

    const step = Math.max(0.1, Number(gridStep) || 1);
    const pad = step * 2; // 여유 마진(취향)

    const padded = {
      minX: b.minX - pad,
      minY: b.minY - pad,
      minZ: b.minZ - pad,
      maxX: b.maxX + pad,
      maxY: b.maxY + pad,
      maxZ: b.maxZ + pad,
    };

    return snapBBoxToStep(padded, step);
  }, [gridMode, editPositions, basePositions, gridStep]);

  const [controlsBusy, setControlsBusy] = useState(false);

  const keyToIndex = useMemo(() => {
    const map = new Map();
    const ms = Array.isArray(markers) ? markers : [];
    ms.forEach((m, idx) => map.set(m?.id ?? idx, idx));
    return map;
  }, [markers]);

  const handleMarkerChangeByKey = (markerKey, pos) => {
    const idx = keyToIndex.get(markerKey);
    if (typeof idx !== "number") return;

    const m = (displayMarkers && displayMarkers[idx]) || (markers && markers[idx]) || null;
    const t = m && typeof m.t === "number" ? m.t : null;

    // 기준 곡선에서 과도하게 벗어나지 않도록 clamp
    const md = Number(maxDelta);
    if (t !== null && Number.isFinite(md) && md > 0) {
      const bx = xtRef(t);
      const by = ytRef(t);
      const bz = ztRef(t);

      if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bz)) {
        const baseV = new THREE.Vector3(bx, by, bz);
        const p = new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
        const d = p.clone().sub(baseV);
        const len = d.length();

        if (len > md) {
          d.setLength(md);
          const clamped = baseV.add(d);
          onMarkerChange?.(idx, { x: clamped.x, y: clamped.y, z: clamped.z });
          return;
        }
      }
    }

    onMarkerChange?.(idx, pos);
  };

  // 드래그 끝: 현재 노드 상태를 “수식”으로 확정
  const handleMarkerDragEnd = () => {
    setTimeout(() => {
      try {
        const tPoints = (displayMarkers || []).filter((m) => typeof m.t === "number");
        if (tPoints.length < 2) return;

        const s = Math.max(1e-6, Number(deformSigma) || 0.6);
        const eps = 1e-9;

        const buildKernelDeformExpr = (deltas) => {
          const wExpr = (ti) => `exp(-(((t)-(${ti}))/(${s}))^2)`;

          const numTerms = [];
          const denTerms = [];

          for (const d of deltas) {
            const ti = Number(d.t);
            const di = Number(d.delta);
            if (!Number.isFinite(ti) || !Number.isFinite(di)) continue;
            if (Math.abs(di) < 1e-12) continue;

            const wi = wExpr(ti);
            numTerms.push(`((${di})*(${wi}))`);
            denTerms.push(`(${wi})`);
          }

          if (numTerms.length === 0) return "0";
          const num = numTerms.join(" + ");
          const den = denTerms.length ? `${denTerms.join(" + ")} + (${eps})` : `${eps}`;
          return `((${num})/(${den}))`;
        };

        const dx = [];
        const dy = [];
        const dz = [];

        for (const m of tPoints) {
          const t = m.t;

          const bx = xtRef(t);
          const by = ytRef(t);
          const bz = ztRef(t);
          if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)) continue;

          dx.push({ t, delta: Number(m.x) - bx });
          dy.push({ t, delta: Number(m.y) - by });
          dz.push({ t, delta: Number(m.z) - bz });
        }

        const baseX = String(refXExpr ?? "0").trim() || "0";
        const baseY = String(refYExpr ?? "0").trim() || "0";
        const baseZ = String(refZExpr ?? "0").trim() || "0";

        const newXExpr = `((${baseX}) + (${buildKernelDeformExpr(dx)}))`;
        const newYExpr = `((${baseY}) + (${buildKernelDeformExpr(dy)}))`;
        const newZExpr = `((${baseZ}) + (${buildKernelDeformExpr(dz)}))`;

        onRecalculateExpressions?.({ xExpr: newXExpr, yExpr: newYExpr, zExpr: newZExpr });
      } catch {
        // silent
      }
    }, 0);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#020617",
        borderRadius: 16,
        border: "1px solid rgba(148, 163, 184, 0.25)",
      }}
    >
      <Canvas
        camera={{ position: [6, 6, 6], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#020617"), 1.0)}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 3]} intensity={1.2} />

        {/* ✅ Major/Full일 때는 bbox 기반 로컬 격자 */}
        <Axes3D size={6} gridMode={gridMode} gridStep={gridStep} minorDiv={minorDiv} bbox={localGridBBox} />

        {/* 기준(회색) */}
        <Line3D positions={basePositions} color="#9ca3af" linewidth={1} />

        {/* 편집(녹색 라인): 노드 기반 프리뷰 */}
        <Line3D positions={editPositions} color="#22c55e" linewidth={2} />

        {/* 마커 연결선 토글 */}
        {showMarkerPolyline && <MarkerCurve markers={displayMarkers} />}

        {displayMarkers.map((m, idx) => {
          const markerKey = m?.id ?? idx;
          const isSelected = selectedKey === markerKey;

          return editMode === "arrows" ? (
            <EditableMarker3D
              key={markerKey}
              marker={m}
              markerKey={markerKey}
              onSelect={setSelectedKey}
              isSelected={isSelected}
              onChange={handleMarkerChangeByKey}
              onDragEnd={handleMarkerDragEnd}
              setControlsBusy={setControlsBusy}
            />
          ) : (
            <DraggableMarker3D
              key={markerKey}
              marker={m}
              markerKey={markerKey}
              onSelect={setSelectedKey}
              isSelected={isSelected}
              onChange={handleMarkerChangeByKey}
              onDragEnd={handleMarkerDragEnd}
              setControlsBusy={setControlsBusy}
            />
          );
        })}

        <OrbitControls ref={controlsRef} makeDefault enabled={!controlsBusy} enableDamping dampingFactor={0.08} />
        <OrientationOverlay controlsRef={controlsRef} />
      </Canvas>
    </div>
  );
}

// src/ui/Curve3DCanvas.jsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";

const math = create(all, {});

// 수식 문자열 → t를 받는 함수로 변환
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
      const res = compiled.evaluate({ [paramName]: t, t });
      return Number.isFinite(res) ? res : 0;
    } catch (e) {
      console.warn("Curve3D: evaluation error:", e);
      return 0;
    }
  };
}

function Axes3D({ size = 6, gridMode = "major", gridStep = 1, minorDiv = 4 }) {
  return (
    <group>
      <axesHelper args={[size]} />
      <CubeGrid3D half={size} gridMode={gridMode} majorStep={gridStep} minorDiv={minorDiv} />
    </group>
  );
}

// ✅ 3D 큐브 격자(내부 라티스)
// gridMode
//  - off: 격자 표시 안 함
//  - box: 외곽 박스만
//  - major: 내부 메이저 격자만
//  - full: 내부 메이저 + 마이너 격자
function CubeGrid3D({ half = 6, gridMode = "major", majorStep = 1, minorDiv = 4 }) {
  const mode = ["off", "box", "major", "full"].includes(String(gridMode)) ? String(gridMode) : "major";
  const planeSize = half * 2;

  const boxGeo = useMemo(() => new THREE.BoxGeometry(planeSize, planeSize, planeSize), [planeSize]);

  useEffect(() => {
    return () => {
      try {
        boxGeo.dispose();
      } catch {}
    };
  }, [boxGeo]);

  const buildCoords = (step, maxDivisions) => {
    const s = Math.max(0.1, Number(step) || 1);
    const coords = [];
    for (let v = -half; v <= half + 1e-6; v += s) coords.push(v);
    if (coords.length === 0 || Math.abs(coords[coords.length - 1] - half) > 1e-6) coords.push(half);

    // 너무 촘촘하면 자동으로 divisions 제한
    if (coords.length > maxDivisions + 1) {
      const n = maxDivisions;
      coords.length = 0;
      for (let i = 0; i <= n; i++) coords.push(-half + (planeSize * i) / n);
    }
    return { coords, step: s };
  };

  const buildLatticePositions = (coords) => {
    const n = coords.length;
    const lineCount = 3 * n * n; // x-lines + y-lines + z-lines
    const arr = new Float32Array(lineCount * 2 * 3);
    let o = 0;

    // 1) X 방향 라인: (y,z) 격자마다 x=-half~+half
    for (let yi = 0; yi < n; yi++) {
      for (let zi = 0; zi < n; zi++) {
        const y = coords[yi];
        const z = coords[zi];
        arr[o++] = -half;
        arr[o++] = y;
        arr[o++] = z;
        arr[o++] = half;
        arr[o++] = y;
        arr[o++] = z;
      }
    }

    // 2) Y 방향 라인: (x,z) 격자마다 y=-half~+half
    for (let xi = 0; xi < n; xi++) {
      for (let zi = 0; zi < n; zi++) {
        const x = coords[xi];
        const z = coords[zi];
        arr[o++] = x;
        arr[o++] = -half;
        arr[o++] = z;
        arr[o++] = x;
        arr[o++] = half;
        arr[o++] = z;
      }
    }

    // 3) Z 방향 라인: (x,y) 격자마다 z=-half~+half
    for (let xi = 0; xi < n; xi++) {
      for (let yi = 0; yi < n; yi++) {
        const x = coords[xi];
        const y = coords[yi];
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = -half;
        arr[o++] = x;
        arr[o++] = y;
        arr[o++] = half;
      }
    }

    return arr;
  };

  const { majorPositions, minorPositions } = useMemo(() => {
    if (mode === "off" || mode === "box") {
      return { majorPositions: null, minorPositions: null };
    }

    const { coords: majorCoords, step: majorStepNorm } = buildCoords(majorStep, 60);
    const majorPositions = buildLatticePositions(majorCoords);

    if (mode !== "full") {
      return { majorPositions, minorPositions: null };
    }

    const div = Math.max(2, Math.floor(Number(minorDiv) || 4));
    const minorStep = Math.max(0.1, majorStepNorm / div);
    const { coords: minorCoordsRaw } = buildCoords(minorStep, 70);

    // minor 중 major와 겹치는 라인은 제외(두께 과도 방지)
    const eps = 1e-5;
    const minorCoords = minorCoordsRaw.filter((v) => {
      const k = Math.round(v / majorStepNorm);
      return Math.abs(v - k * majorStepNorm) > eps;
    });

    const minorPositions = buildLatticePositions(minorCoords);
    return { majorPositions, minorPositions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [half, planeSize, mode, majorStep, minorDiv]);

  if (mode === "off") return null;

  return (
    <group>
      {/* 외곽 큐브 와이어프레임 */}
      <lineSegments>
        <edgesGeometry args={[boxGeo]} />
        <lineBasicMaterial color="#64748b" transparent opacity={0.25} depthWrite={false} />
      </lineSegments>

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

      {/* 내부 마이너 격자 (full 모드에서만) */}
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

function EditableMarker3D({ index, position, onChange, setControlsBusy, onDragEnd }) {
  const tcRef = useRef();

  useEffect(() => {
    if (tcRef.current?.object) {
      tcRef.current.object.position.set(position.x, position.y, position.z ?? 0);
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleChange = () => {
      const obj = tc.object;
      if (!obj) return;
      onChange(index, { x: obj.position.x, y: obj.position.y, z: obj.position.z });
    };

    const handleDragging = (e) => {
      setControlsBusy(!!e.value);
      if (!e.value) {
        try {
          onDragEnd?.(index);
        } catch {}
      }
    };

    tc.addEventListener("change", handleChange);
    tc.addEventListener("dragging-changed", handleDragging);

    return () => {
      tc.removeEventListener("change", handleChange);
      tc.removeEventListener("dragging-changed", handleDragging);
    };
  }, [index, onChange, setControlsBusy, onDragEnd]);

  return (
    <group>
      <TransformControls ref={tcRef} mode="translate">
        <mesh>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial color="#ffc107" />
        </mesh>
      </TransformControls>
    </group>
  );
}

function DraggableMarker3D({ index, position, onChange, setControlsBusy, onDragEnd }) {
  const { camera } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const hit = useRef(new THREE.Vector3());

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useCursor(hovered || dragging);

  const onPointerDown = (e) => {
    e.stopPropagation();
    setDragging(true);
    setControlsBusy(true);
    e.target.setPointerCapture?.(e.pointerId);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);

    const point = new THREE.Vector3(position.x, position.y, position.z ?? 0);
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, point);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    if (e.ray.intersectPlane(dragPlane.current, hit.current)) {
      const x = hit.current.x;
      const y = hit.current.y;
      const z = hit.current.z;

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        onChange(index, { x, y, z });
      }
    }
  };

  const endDrag = (e) => {
    e.stopPropagation();
    setDragging(false);
    setControlsBusy(false);
    e.target.releasePointerCapture?.(e.pointerId);
    try {
      onDragEnd?.(index);
    } catch {}
  };

  return (
    <group>
      <mesh
        position={[position.x, position.y, position.z ?? 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial
          color={dragging ? "#ff9800" : hovered ? "#ffd54f" : "#ffc107"}
          emissive={dragging ? "#ff9800" : "#000000"}
          emissiveIntensity={dragging ? 0.25 : 0}
        />
      </mesh>
    </group>
  );
}

function MarkerLabels3D({ position, label }) {
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

function MarkerCurve({ markers }) {
  const points = useMemo(() => {
    if (!markers || markers.length < 2) return [];
    const pts = markers.map((m) => new THREE.Vector3(m.x ?? 0, m.y ?? 0, m.z ?? 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    return curve.getPoints(220);
  }, [markers]);

  const positions = useMemo(() => {
    if (!points || points.length === 0) return null;
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    return arr;
  }, [points]);

  if (!positions) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial linewidth={2} color="#22c55e" />
    </line>
  );
}

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
  gridMode = "major", // "off" | "box" | "major" | "full"
  gridStep = 1, // major step
  minorDiv = 4, // full mode: minorStep = gridStep / minorDiv

  markers = [],
  onMarkerChange,
  onRecalculateExpressions,
  editMode = "drag", // "drag" | "arrows"
}) {
  const refXExpr = baseXExpr ?? xExpr;
  const refYExpr = baseYExpr ?? yExpr;
  const refZExpr = baseZExpr ?? zExpr;

  const xtRef = useMemo(() => makeParamFn(refXExpr, "t"), [refXExpr]);
  const ytRef = useMemo(() => makeParamFn(refYExpr, "t"), [refYExpr]);
  const ztRef = useMemo(() => makeParamFn(refZExpr, "t"), [refZExpr]);

  const xt = useMemo(() => makeParamFn(xExpr, "t"), [xExpr]);
  const yt = useMemo(() => makeParamFn(yExpr, "t"), [yExpr]);
  const zt = useMemo(() => makeParamFn(zExpr, "t"), [zExpr]);

  const basePositions = useMemo(() => {
    if (!refXExpr || !refYExpr || !refZExpr || samples < 2) return null;
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xtRef(t);
      const y = ytRef(t);
      const z = ztRef(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        pts.push(x, y, z);
      }
    }
    return pts.length ? new Float32Array(pts) : null;
  }, [refXExpr, refYExpr, refZExpr, samples, tMin, tMax, xtRef, ytRef, ztRef]);

  const exprPositions = useMemo(() => {
    if (!xExpr || !yExpr || !zExpr || samples < 2) return null;
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xt(t);
      const y = yt(t);
      const z = zt(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        pts.push(x, y, z);
      }
    }
    return pts.length ? new Float32Array(pts) : null;
  }, [xExpr, yExpr, zExpr, tMin, tMax, samples, xt, yt, zt]);

  const displayMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return markers.map((m) => {
      let x = Number.isFinite(m.x) ? m.x : undefined;
      let y = Number.isFinite(m.y) ? m.y : undefined;
      let z = Number.isFinite(m.z) ? m.z : undefined;

      if ((x === undefined || y === undefined || z === undefined) && typeof m.t === "number") {
        const tx = xt(m.t);
        const ty = yt(m.t);
        const tz = zt(m.t);
        x = x ?? (Number.isFinite(tx) ? tx : 0);
        y = y ?? (Number.isFinite(ty) ? ty : 0);
        z = z ?? (Number.isFinite(tz) ? tz : 0);
      }

      return { ...m, x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    });
  }, [markers, xt, yt, zt]);

  const [controlsBusy, setControlsBusy] = useState(false);

  const handleMarkerChange = (index, pos) => {
    onMarkerChange?.(index, pos);
  };

  const handleMarkerDragEnd = () => {
    // t 기반 마커가 2개 이상일 때만 보간식 갱신
    setTimeout(() => {
      try {
        const tPoints = (markers || []).filter((m) => typeof m.t === "number");
        if (tPoints.length < 2) return;

        const buildLagrange = (pts) => {
          const terms = pts.map((pi, i) => {
            const denom = pts
              .map((pj, j) => (j === i ? null : `${pi.t - pj.t}`))
              .filter(Boolean)
              .join("*");
            const numer =
              pts
                .map((pj, j) => (j === i ? null : `(t - ${pj.t})`))
                .filter(Boolean)
                .join("*") || "1";
            return `(${pi.v})*(${numer})/(${denom})`;
          });
          return terms.join(" + ");
        };

        const xs = tPoints.map((m) => ({ t: m.t, v: m.x }));
        const ys = tPoints.map((m) => ({ t: m.t, v: m.y }));
        const zs = tPoints.map((m) => ({ t: m.t, v: m.z }));

        const newXExpr = buildLagrange(xs);
        const newYExpr = buildLagrange(ys);
        const newZExpr = buildLagrange(zs);

        onRecalculateExpressions?.({ xExpr: newXExpr, yExpr: newYExpr, zExpr: newZExpr });
      } catch {}
    }, 0);
  };

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
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
        <directionalLight position={[5, 8, 5]} intensity={1.0} color="#ffffff" />

        <Axes3D size={6} gridMode={gridMode} gridStep={gridStep} minorDiv={minorDiv} />

        {basePositions && (
          <line>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={basePositions.length / 3} array={basePositions} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial linewidth={1.5} color="#6b7280" />
          </line>
        )}

        {exprPositions && (
          <line>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={exprPositions.length / 3} array={exprPositions} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial linewidth={2} color="#22c55e" />
          </line>
        )}

        <MarkerCurve markers={displayMarkers} />

        {displayMarkers.map((m, idx) => {
          const label = m.label ?? `(${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${m.z.toFixed(2)})`;
          const markerPosition = { x: m.x, y: m.y, z: m.z };

          return (
            <group key={m.id ?? idx}>
              {editMode === "arrows" ? (
                <EditableMarker3D
                  index={idx}
                  position={markerPosition}
                  onChange={handleMarkerChange}
                  setControlsBusy={setControlsBusy}
                  onDragEnd={handleMarkerDragEnd}
                />
              ) : (
                <DraggableMarker3D
                  index={idx}
                  position={markerPosition}
                  onChange={handleMarkerChange}
                  setControlsBusy={setControlsBusy}
                  onDragEnd={handleMarkerDragEnd}
                />
              )}
              <MarkerLabels3D position={markerPosition} label={label} />
            </group>
          );
        })}

        <OrbitControls enableDamping dampingFactor={0.1} enabled={!controlsBusy} makeDefault />
      </Canvas>
    </div>
  );
}

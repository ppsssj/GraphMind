// src/ui/Curve3DCanvas.jsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Text,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";
import { create, all } from "mathjs";

const math = create(all, {});

// 수식 문자열 → t를 받는 함수로 변환 (표시용 참조 곡선)
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

function Axes3D({ size = 6 }) {
  return (
    <group>
      <axesHelper args={[size]} />
      <gridHelper args={[size * 2, size * 2]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

// TransformControls 기반 3D 마커 (축 드래그)
function EditableMarker3D({
  index,
  position,
  onChange,
  setControlsBusy,
  onDragEnd,
}) {
  const tcRef = useRef();

  // 상위에서 내려온 좌표와 TransformControls object 위치 동기화
  useEffect(() => {
    if (tcRef.current?.object) {
      tcRef.current.object.position.set(
        position.x,
        position.y,
        position.z ?? 0
      );
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleChange = () => {
      const obj = tc.object;
      if (!obj) return;
      // 로그: TransformControls로 위치 변경 시
      try {
        // eslint-disable-next-line no-console
        console.log("EditableMarker3D: change", index, {
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z,
        });
      } catch {}
      onChange(index, {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      });
    };

    const handleDragging = (e) => {
      try {
        // eslint-disable-next-line no-console
        console.log("EditableMarker3D: dragging-changed", index, !!e.value);
      } catch {}
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

// 진짜 3D 공간에서 직접 드래그하는 마커
function DraggableMarker3D({
  index,
  position,
  onChange,
  setControlsBusy,
  onDragEnd,
}) {
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

    // 드래그 시작: 카메라 시선 방향 + 현재 포인트 위치로 평면 생성
    try {
      // eslint-disable-next-line no-console
      console.log("DraggableMarker3D: pointerDown", index, position);
    } catch {}
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
        try {
          // eslint-disable-next-line no-console
          console.log("DraggableMarker3D: pointerMove hit", index, { x, y, z });
        } catch {}
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
      // eslint-disable-next-line no-console
      console.log("DraggableMarker3D: endDrag", index);
    } catch {}
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

// 마커들을 Catmull-Rom 스플라인으로 연결 → 이게 "노드를 따르는 그래프"
function MarkerCurve({ markers }) {
  const points = useMemo(() => {
    if (!markers || markers.length < 2) return [];

    try {
      // eslint-disable-next-line no-console
      console.log("MarkerCurve: building curve from markers", markers.length);
    } catch {}

    const pts = markers.map((m) => {
      const x = m.x ?? 0;
      const y = m.y ?? 0;
      const z = m.z ?? 0;
      return new THREE.Vector3(x, y, z);
    });

    const curve = new THREE.CatmullRomCurve3(pts);
    const ptsOut = curve.getPoints(220);
    try {
      // eslint-disable-next-line no-console
      console.log("MarkerCurve: curve points length", ptsOut.length);
    } catch {}
    return ptsOut;
  }, [markers]);

  const positions = useMemo(() => {
    if (!points || points.length === 0) return null;
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    try {
      // eslint-disable-next-line no-console
      console.log("MarkerCurve: positions array created, length", arr.length);
    } catch {}
    return arr;
  }, [points]);

  const attrRef = useRef();

  useEffect(() => {
    if (!positions || !attrRef.current) return;
    try {
      // eslint-disable-next-line no-console
      console.log("MarkerCurve: marking buffer attribute needsUpdate");
    } catch {}
    // three.js BufferAttribute needs its 'needsUpdate' flag set when the array changes
    try {
      attrRef.current.needsUpdate = true;
      // also ensure count is correct
      attrRef.current.count = positions.length / 3;
    } catch (e) {
      // ignore
    }
  }, [positions]);

  if (!positions) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          ref={attrRef}
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial linewidth={2} color="#22c55e" />
    </line>
  );
}

export default function Curve3DCanvas({
  // 🔹 원본(고정) 수식
  baseXExpr,
  baseYExpr,
  baseZExpr,
  // 🔹 편집용(노드 기반) 수식
  xExpr,
  yExpr,
  zExpr,
  tMin = -2,
  tMax = 2,
  samples = 200,
  markers = [],
  onMarkerChange,
  onRecalculateExpressions,
  editMode = "drag", // "drag" | "arrows"
}) {
  // ✅ 원본 수식(없으면 편집 수식으로 fallback)
  const refXExpr = baseXExpr ?? xExpr;
  const refYExpr = baseYExpr ?? yExpr;
  const refZExpr = baseZExpr ?? zExpr;

  // 🔹 원본 그래프용 함수
  const xtRef = useMemo(() => makeParamFn(refXExpr, "t"), [refXExpr]);
  const ytRef = useMemo(() => makeParamFn(refYExpr, "t"), [refYExpr]);
  const ztRef = useMemo(() => makeParamFn(refZExpr, "t"), [refZExpr]);

  // 🔹 편집 그래프용 함수 (노드 + Lagrange로 계속 바뀌는 쪽)
  const xt = useMemo(() => makeParamFn(xExpr, "t"), [xExpr]);
  const yt = useMemo(() => makeParamFn(yExpr, "t"), [yExpr]);
  const zt = useMemo(() => makeParamFn(zExpr, "t"), [zExpr]);

  // 🔹 원본 수식 곡선 (회색, 고정)
  const basePoints = useMemo(() => {
    if (!refXExpr || !refYExpr || !refZExpr || samples < 2) return [];
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xtRef(t);
      const y = ytRef(t);
      const z = ztRef(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
    return pts;
  }, [refXExpr, refYExpr, refZExpr, samples, tMin, tMax, xtRef, ytRef, ztRef]);

  const basePositions = useMemo(() => {
    if (!basePoints || basePoints.length === 0) return null;
    const arr = new Float32Array(basePoints.length * 3);
    basePoints.forEach((p, i) => {
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    return arr;
  }, [basePoints]);

  const exprPoints = useMemo(() => {
    if (!xExpr || !yExpr || !zExpr || samples < 2) return [];
    const pts = [];
    const step = (tMax - tMin) / (samples - 1 || 1);
    for (let i = 0; i < samples; i++) {
      const t = tMin + step * i;
      const x = xt(t);
      const y = yt(t);
      const z = zt(t);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
    return pts;
  }, [xExpr, yExpr, zExpr, tMin, tMax, samples, xt, yt, zt]);

  const exprPositions = useMemo(() => {
    if (!exprPoints || exprPoints.length === 0) return null;
    const arr = new Float32Array(exprPoints.length * 3);
    exprPoints.forEach((p, i) => {
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    return arr;
  }, [exprPoints]);

  // t 기반 마커 → 표시용 좌표 보정 (처음 한 번만 수식 위에 올려두는 느낌)
  const displayMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];

    return markers.map((m) => {
      let x = Number.isFinite(m.x) ? m.x : undefined;
      let y = Number.isFinite(m.y) ? m.y : undefined;
      let z = Number.isFinite(m.z) ? m.z : undefined;

      if (
        (x === undefined || y === undefined || z === undefined) &&
        typeof m.t === "number"
      ) {
        const tx = xt(m.t);
        const ty = yt(m.t);
        const tz = zt(m.t);
        x = x ?? (Number.isFinite(tx) ? tx : 0);
        y = y ?? (Number.isFinite(ty) ? ty : 0);
        z = z ?? (Number.isFinite(tz) ? tz : 0);
      }

      return {
        ...m,
        x: x ?? 0,
        y: y ?? 0,
        z: z ?? 0,
      };
    });
  }, [markers, xt, yt, zt]);

  const [controlsBusy, setControlsBusy] = useState(false);

  const handleMarkerChange = (index, pos) => {
    if (!onMarkerChange) return;
    try {
      // eslint-disable-next-line no-console
      console.debug("Curve3DCanvas: handleMarkerChange", index, pos);
    } catch {}
    onMarkerChange(index, pos); // 상위(Curve3DView)로 전달
  };

  // 마커 드래그 종료 콜백 (상위 상태가 갱신된 직후에 재계산을 시도)
  const handleMarkerDragEnd = (index) => {
    // 부모가 setState로 markers를 갱신한 후에 계산하려면 이벤트 루프 한 사이클 뒤에 실행
    setTimeout(() => {
      try {
        const tPoints = (markers || []).filter((m) => typeof m.t === "number");
        if (tPoints.length < 2) {
          return; 
        }

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

        // eslint-disable-next-line no-console
        console.log("Curve3DCanvas: recalculated expressions (on drag end)", {
          newXExpr,
          newYExpr,
          newZExpr,
        });

        if (typeof onRecalculateExpressions === "function") {
          onRecalculateExpressions({
            xExpr: newXExpr,
            yExpr: newYExpr,
            zExpr: newZExpr,
          });
        }
      } catch (e) {
        // ignore
      }
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
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#020617"), 1.0);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.0}
          color="#ffffff"
        />

        <Axes3D size={6} />

        {/* (수식 기반) 초록색 선: 수식(xExpr,yExpr,zExpr)로 그려집니다. */}
        {/* 🔹 원본 고정 수식 그래프 (회색) */}
        {basePositions && (
          <line key={`base-${basePositions.length}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={basePositions.length / 3}
                array={basePositions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial linewidth={1.5} color="#6b7280" />
          </line>
        )}

        {/* 🔹 편집용 수식 그래프 (초록색, 노드에 의해 변경) */}
        {exprPositions && (
          <line key={`expr-${exprPositions.length}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={exprPositions.length / 3}
                array={exprPositions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial linewidth={2} color="#22c55e" />
          </line>
        )}

        {/* ✅ 마커들을 Catmull-Rom으로 연결한 편집 곡선 (보조 색상) */}
        <MarkerCurve markers={displayMarkers} />

        {/* ✅ 드래그/Transform 가능한 마커 + 라벨 */}
        {displayMarkers.map((m, idx) => {
          const label =
            m.label ??
            `(${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${m.z.toFixed(2)})`;

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

        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          enabled={!controlsBusy}
          makeDefault
        />
      </Canvas>

      {/* 우측 상단 정보 패널 */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          padding: "8px 10px",
          borderRadius: 12,
          fontSize: 11,
          lineHeight: 1.4,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          color: "#e5e7eb",
          maxWidth: "260px",
        }}
      >
        <div style={{ marginBottom: 4, opacity: 0.9 }}>3D 곡선 편집</div>
        <div style={{ opacity: 0.85 }}>
          <div>x(t) = {xExpr || "—"}</div>
          <div>y(t) = {yExpr || "—"}</div>
          <div>z(t) = {zExpr || "—"}</div>
        </div>
        <div style={{ marginTop: 4, opacity: 0.8 }}>
          t ∈ [{tMin}, {tMax}], samples: {samples}
        </div>
      </div>
    </div>
  );
}

// src/ui/GraphCanvas.jsx
import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text, useCursor } from "@react-three/drei";
import * as THREE from "three";

import { HandInputProvider } from "../input/HandInputProvider";
import { useInputPrefs } from "../store/useInputPrefs";

function CameraControlBridge({ cameraApiRef, target = new THREE.Vector3(0, 0, 0) }) {
  const { camera, viewport } = useThree();
  const targetRef = useRef(target.clone());
  const sphericalRef = useRef(new THREE.Spherical());

  useEffect(() => {
    const pos = camera.position.clone().sub(targetRef.current);
    sphericalRef.current.setFromVector3(pos);
  }, [camera]);

  useEffect(() => {
    if (!cameraApiRef) return;

    cameraApiRef.current = {
      zoomBy: (delta) => {
        const next = camera.zoom * (1 + delta);
        camera.zoom = Math.max(20, Math.min(260, next));
        camera.updateProjectionMatrix();
      },

      panBy: (dxNorm, dyNorm) => {
        const dxWorld = -dxNorm * viewport.width;
        const dyWorld = dyNorm * viewport.height;

        camera.position.x += dxWorld;
        camera.position.y += dyWorld;

        targetRef.current.x += dxWorld;
        targetRef.current.y += dyWorld;
      },

      rotateBy: (dYaw, dPitch) => {
        const s = sphericalRef.current;

        s.theta += dYaw;
        s.phi = Math.max(0.15, Math.min(Math.PI - 0.15, s.phi + dPitch));

        const v = new THREE.Vector3().setFromSpherical(s).add(targetRef.current);
        camera.position.copy(v);
        camera.lookAt(targetRef.current);
      },
    };

    return () => {
      cameraApiRef.current = null;
    };
  }, [camera, viewport, cameraApiRef]);

  return null;
}

function Axes({ xmin = -8, xmax = 8, ymin = -8, ymax = 8, gridStep = 1 }) {
  const spanX = xmax - xmin;
  const spanY = ymax - ymin;

  const sizeScale = 1.5; // 격자판 도메인 확장 배율
  const span = Math.max(spanX, spanY);
  const size = Math.max(1, span * sizeScale);

  const divisions = Math.min(200, Math.max(1, Math.round(size / Math.max(0.1, gridStep))));

  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;

  const zAxis = 0.01; // z-fighting 방지
  const axisThickness = 0.06;

  return (
    <group position={[cx, cy, 0]}>
      <gridHelper args={[size, divisions]} rotation={[Math.PI / 2, 0, 0]} />

      {/* x축: 격자판 size와 동일한 길이 */}
      <mesh position={[0, 0, zAxis]}>
        <boxGeometry args={[size, axisThickness, axisThickness]} />
        <meshStandardMaterial color="#6039BC" />
      </mesh>

      {/* y축: 격자판 size와 동일한 길이 */}
      <mesh position={[0, 0, zAxis]}>
        <boxGeometry args={[axisThickness, size, axisThickness]} />
        <meshStandardMaterial color="#6039BC" />
      </mesh>
    </group>
  );
}

function Curve({ fn, xmin, xmax, color = "white" }) {
  const positions = useMemo(() => {
    const steps = 220;
    const dx = (xmax - xmin) / steps;
    const arr = new Float32Array((steps + 1) * 3);

    for (let i = 0; i <= steps; i++) {
      const x = xmin + dx * i;
      const yRaw = fn ? fn(x) : NaN;
      const y = Number.isFinite(yRaw) ? yRaw : 0;
      const o = i * 3;
      arr[o + 0] = x;
      arr[o + 1] = y;
      arr[o + 2] = 0;
    }
    return arr;
  }, [fn, xmin, xmax]);

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

function EditablePoint({ index, position, onChange, onCommit, setControlsBusy }) {
  const tcRef = useRef();

  useEffect(() => {
    if (tcRef.current?.object) {
      tcRef.current.object.position.set(position.x, position.y, 0);
    }
  }, [position.x, position.y]);

  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const handleChange = () => {
      const obj = tc.object;
      if (!obj) return;
      onChange(index, { x: obj.position.x, y: obj.position.y });
    };

    const onDraggingChanged = (e) => {
      const dragging = !!e.value;
      setControlsBusy(dragging);
      if (!dragging) onCommit?.(index);
    };

    tc.addEventListener("change", handleChange);
    tc.addEventListener("dragging-changed", onDraggingChanged);

    return () => {
      tc.removeEventListener("change", handleChange);
      tc.removeEventListener("dragging-changed", onDraggingChanged);
    };
  }, [index, onChange, onCommit, setControlsBusy]);

  return (
    <group>
      <TransformControls ref={tcRef} mode="translate" showX showY showZ={false}>
        <mesh>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshStandardMaterial color="#ffc107" />
        </mesh>
      </TransformControls>

      <group position={[position.x + 0.08, position.y + 0.08, 0]}>
        <Text fontSize={0.16} anchorX="left" anchorY="bottom" outlineWidth={0.004} outlineColor="black">
          {`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
        </Text>
      </group>
    </group>
  );
}

function DraggablePoint({
  index,
  position,
  xmin,
  xmax,
  ymin,
  ymax,
  onChange,
  onCommit,
  setControlsBusy,
}) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useCursor(hovered || dragging);

  const onPointerDown = (e) => {
    e.stopPropagation();
    setDragging(true);
    setControlsBusy(true);
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    if (e.ray.intersectPlane(plane, hit.current)) {
      let x = hit.current.x;
      let y = hit.current.y;

      if (Number.isFinite(xmin) && Number.isFinite(xmax)) x = Math.max(xmin, Math.min(xmax, x));
      if (Number.isFinite(ymin) && Number.isFinite(ymax)) y = Math.max(ymin, Math.min(ymax, y));

      if (Number.isFinite(x) && Number.isFinite(y)) onChange(index, { x, y });
    }
  };

  const endDrag = (e) => {
    e.stopPropagation();
    setDragging(false);
    setControlsBusy(false);

    const el = e.target;
    const pid = e.pointerId;
    try {
      if (el?.hasPointerCapture?.(pid)) el.releasePointerCapture(pid);
    } catch {}

    onCommit?.(index);
  };

  return (
    <group>
      <mesh
        position={[position.x, position.y, 0]}
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
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshStandardMaterial
          color={dragging ? "#ff9800" : hovered ? "#ffd54f" : "#ffc107"}
          emissive={dragging ? "#ff9800" : "#000000"}
          emissiveIntensity={dragging ? 0.25 : 0}
        />
      </mesh>

      <group position={[position.x + 0.08, position.y + 0.08, 0]}>
        <Text fontSize={0.16} anchorX="left" anchorY="bottom" outlineWidth={0.004} outlineColor="black">
          {`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
        </Text>
      </group>
    </group>
  );
}

export default function GraphCanvas({
  points,
  onPointChange,
  onPointCommit,
  xmin,
  xmax,
  ymin,          // ✅ 추가 (없으면 아래에서 xmin/xmax로 fallback)
  ymax,          // ✅ 추가
  gridStep,
  setGridStep,
  fn,
  typedFn,
  curveKey,
  markers = [],

  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,
  showControls = true,
}) {
  const wrapperRef = useRef(null);
  const cameraApiRef = useRef(null);

  const [controlsBusy, setControlsBusy] = useState(false);
  const [viewMode, setViewMode] = useState("both"); // typed | fit | both
  const [editMode, setEditMode] = useState("drag"); // arrows | drag

  // ✅ 손 입력 상태는 "useEffect보다 위에서" 선언
  const handEnabled = useInputPrefs((s) => s.handControlEnabled);

  // ✅ 아코디언 패널: 기본 OFF
  const [openPanel, setOpenPanel] = useState(null);
  // openPanel: "rule" | "view" | "grid" | "edit" | "hand" | "gestures" | null

  // ✅ 손 입력 켜면 gestures 자동 오픈(스테일/TDZ 없이 functional update만 사용)
  useEffect(() => {
    if (handEnabled) {
      setOpenPanel((p) => p ?? "gestures");
    } else {
      setOpenPanel((p) => (p === "gestures" ? null : p));
    }
  }, [handEnabled]);

  const [gridStepLocal, setGridStepLocal] = useState(gridStep ?? 1);
  useEffect(() => {
    if (gridStep !== undefined) setGridStepLocal(gridStep);
  }, [gridStep]);

  const gridStepEff = Math.max(0.1, Number(gridStep ?? gridStepLocal) || 1);

  const setGridStepEff = (v) => {
    const n = Math.max(0.1, Number(v) || 1);
    if (typeof setGridStep === "function") setGridStep(n);
    else setGridStepLocal(n);
  };

  const showTyped = typedFn && (viewMode === "typed" || viewMode === "both");
  const showFit = fn && (viewMode === "fit" || viewMode === "both");

  const yMinEff = Number.isFinite(ymin) ? ymin : xmin;
  const yMaxEff = Number.isFinite(ymax) ? ymax : xmax;

  const commit = (idx) => onPointCommit?.(idx);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* 손 입력(그래프 화면 전용) */}
      {handEnabled && (
        <HandInputProvider
          targetRef={wrapperRef}
          cameraApiRef={cameraApiRef}
          enabled={true}
          mirror={true}
          modelPath="/models/hand_landmarker.task"
        />
      )}

      <Canvas
        orthographic
        camera={{ zoom: 60, position: [0, 0, 10] }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#0f1115"), 1.0)}
      >
        <CameraControlBridge cameraApiRef={cameraApiRef} />

        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 6]} intensity={0.9} />

        <Axes xmin={xmin} xmax={xmax} ymin={yMinEff} ymax={yMaxEff} gridStep={gridStepEff} />

        {showFit && <Curve key={curveKey + "|fit"} fn={fn} xmin={xmin} xmax={xmax} color="#64b5f6" />}
        {showTyped && (
          <Curve key={curveKey + "|typed"} fn={typedFn} xmin={xmin} xmax={xmax} color="#ff5252" />
        )}


        {/* AI markers (max/min/roots/...) */}
        {Array.isArray(markers) &&
          markers.map((m) => (
            <group key={m.id ?? `${m.kind}-${m.x}-${m.y}`}>
              <mesh position={[m.x, m.y, 0.03]}>
                <sphereGeometry args={[0.12, 24, 24]} />
                <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={0.25} />
              </mesh>
              {m.label && (
                <group position={[m.x + 0.16, m.y + 0.16, 0.03]}>
                  <Text
                    fontSize={0.18}
                    anchorX="left"
                    anchorY="bottom"
                    outlineWidth={0.004}
                    outlineColor="black"
                  >
                    {m.label}
                  </Text>
                </group>
              )}
            </group>
          ))}


        {points.map((p, i) =>
          editMode === "arrows" ? (
            <EditablePoint
              key={"e-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
              onCommit={commit}
            />
          ) : (
            <DraggablePoint
              key={"d-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              xmin={xmin}
              xmax={xmax}
              ymin={yMinEff}
              ymax={yMaxEff}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
              onCommit={commit}
            />
          )
        )}

        <OrbitControls makeDefault enabled={!controlsBusy && !handEnabled} />
      </Canvas>

      {/* UI: 아코디언(개별 토글) */}
      {showControls && (
        <div
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            zIndex: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-start",
            maxWidth: "calc(100% - 16px)",
            boxSizing: "border-box",
            justifyContent: "flex-end",
            pointerEvents: "auto",
          }}
        >
          {(() => {
            const Panel = ({ id, title, children, hidden = false }) => {
              if (hidden) return null;
              const isOpen = openPanel === id;

              return (
                <div
                  style={{
                    background: "rgba(0,0,0,0.28)",
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 11,
                    overflow: "hidden",
                    minWidth: 180,
                    backdropFilter: "blur(6px)",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <button
                    onClick={() => setOpenPanel((p) => (p === id ? null : id))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}
                    title={isOpen ? "접기" : "펼치기"}
                  >
                    <span>{title}</span>
                    <span style={{ opacity: 0.8 }}>{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      {children}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* 규칙 기반 편집 */}
                <Panel id="rule" title="규칙 기반 편집">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      value={ruleMode}
                      onChange={(e) => setRuleMode?.(e.target.value)}
                      style={{
                        flex: 1,
                        background: "rgba(10,10,10,0.85)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        padding: "4px 6px",
                        outline: "none",
                        fontSize: 11,
                      }}
                    >
                      <option value="free">자유(수식 고정)</option>
                      <option value="linear">선형: a·x + b</option>
                      <option value="poly">다항식: 차수 고정</option>

                      <option value="sin">사인: A·sin(ωx+φ)+C</option>
                      <option value="cos">코사인: A·cos(ωx+φ)+C</option>
                      <option value="tan">탄젠트: A·tan(ωx+φ)+C</option>

                      <option value="exp">지수: A·exp(kx)+C</option>
                      <option value="log">로그: A·log(kx)+C</option>
                      <option value="power">거듭제곱: A·x^p + C</option>
                    </select>

                    {ruleMode === "poly" && (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={rulePolyDegree}
                        onChange={(e) => setRulePolyDegree?.(Number(e.target.value))}
                        style={{
                          width: 64,
                          background: "rgba(10,10,10,0.85)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          padding: "4px 6px",
                          outline: "none",
                          fontSize: 11,
                        }}
                        title="다항 차수"
                      />
                    )}
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}>
                    점을 드래그한 뒤 놓으면, 선택한 규칙(함수 family)을 유지한 채 파라미터만 갱신됩니다.
                  </div>

                  {ruleError && (
                    <div style={{ marginTop: 6, color: "#ffcc80", lineHeight: 1.35 }}>{ruleError}</div>
                  )}
                </Panel>

                {/* 보기 */}
                <Panel id="view" title="보기">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setViewMode("typed")} style={btnStyle(viewMode === "typed", "#ff5252")}>
                      수식만
                    </button>
                    <button onClick={() => setViewMode("fit")} style={btnStyle(viewMode === "fit", "#64b5f6")}>
                      근사만
                    </button>
                    <button onClick={() => setViewMode("both")} style={btnStyle(viewMode === "both", "#ffffff")}>
                      둘다
                    </button>
                  </div>
                </Panel>

                {/* 격자 간격 */}
                <Panel id="grid" title="격자 간격">
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={gridStepEff}
                      onChange={(e) => setGridStepEff(e.target.value)}
                      style={{
                        width: 86,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#fff",
                        outline: "none",
                      }}
                    />
                    <button onClick={() => setGridStepEff(1)} style={btnStyle(false, "#ffffff")}>1</button>
                    <button onClick={() => setGridStepEff(2)} style={btnStyle(false, "#ffffff")}>2</button>
                    <button onClick={() => setGridStepEff(4)} style={btnStyle(false, "#ffffff")}>4</button>
                  </div>
                </Panel>

                {/* 편집 */}
                <Panel id="edit" title="편집">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditMode("arrows")} style={btnStyle(editMode === "arrows", "#ffffff")}>
                      화살표
                    </button>
                    <button onClick={() => setEditMode("drag")} style={btnStyle(editMode === "drag", "#ffffff")}>
                      드래그
                    </button>
                  </div>
                </Panel>

                {/* 손 입력 */}
                <Panel id="hand" title="손 입력">
                  <HandToggle />
                  <div style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}>
                    손 입력을 켜면 “손 제스처” 패널이 자동으로 활성화됩니다.
                  </div>
                </Panel>

                {/* 손 제스처: 손 입력 켰을 때만 표시 */}
                <Panel id="gestures" title="손 제스처" hidden={!handEnabled}>
                  <div style={{ opacity: 0.9, lineHeight: 1.45 }}>
                    • 오른손 핀치: 드래그<br />
                    • 양손 핀치: 줌<br />
                    • 왼손 펼침: 팬<br />
                    • 오른손 주먹: 회전
                  </div>
                </Panel>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function btnStyle(active, activeColor) {
  return {
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.25)",
    background: active ? activeColor : "transparent",
    color: active ? "#000" : "#fff",
    cursor: "pointer",
  };
}

function HandToggle() {
  const enabled = useInputPrefs((s) => s.handControlEnabled);
  const setEnabled = useInputPrefs((s) => s.setHandControlEnabled);

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      style={{
        padding: "6px 8px",
        borderRadius: 6,
        border: enabled ? "1px solid #7cf" : "1px solid rgba(255,255,255,0.25)",
        background: enabled ? "#7cf" : "transparent",
        color: enabled ? "#000" : "#fff",
        cursor: "pointer",
      }}
      title={enabled ? "손 입력 비활성화" : "손 입력 활성화"}
    >
      {enabled ? "활성" : "비활성"}
    </button>
  );
}

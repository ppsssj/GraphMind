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

  // init spherical from current camera position
  useEffect(() => {
    const pos = camera.position.clone().sub(targetRef.current);
    sphericalRef.current.setFromVector3(pos);
  }, [camera]);

  useEffect(() => {
    if (!cameraApiRef) return;

    cameraApiRef.current = {
      zoomBy: (delta) => {
        // Orthographic zoom: zoom *= (1 + delta)
        const next = camera.zoom * (1 + delta);
        camera.zoom = Math.max(20, Math.min(260, next));
        camera.updateProjectionMatrix();
      },

      panBy: (dxNorm, dyNorm) => {
        // dxNorm/dyNorm: screen-normalized delta (0~1 scale)
        // viewport.width/height already represent world size for current zoom.
        const dxWorld = -dxNorm * viewport.width;
        const dyWorld = dyNorm * viewport.height;

        camera.position.x += dxWorld;
        camera.position.y += dyWorld;

        // also move target with camera (orbit-style panning)
        targetRef.current.x += dxWorld;
        targetRef.current.y += dyWorld;
      },

      rotateBy: (dYaw, dPitch) => {
        // rotate around target using spherical coords
        // dYaw/dPitch are small values
        const s = sphericalRef.current;

        s.theta += dYaw;                 // yaw
        s.phi = Math.max(0.15, Math.min(Math.PI - 0.15, s.phi + dPitch)); // pitch clamp

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

function Axes({ xmin = -8, xmax = 8, ymin = -8, ymax = 8 }) {
  return (
    <group>
      <axesHelper args={[8]} />
      <gridHelper args={[16, 16]} rotation={[Math.PI / 2, 0, 0]} />

      <line>
        <bufferGeometry
          attach="geometry"
          attributes-position={
            new THREE.Float32BufferAttribute([xmin, 0, 0, xmax, 0, 0], 3)
          }
        />
        <lineBasicMaterial color="#6039BC" linewidth={3} />
      </line>

      <line>
        <bufferGeometry
          attach="geometry"
          attributes-position={
            new THREE.Float32BufferAttribute([0, ymin, 0, 0, ymax, 0], 3)
          }
        />
        <lineBasicMaterial color="#6039BC" linewidth={3} />
      </line>
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

function EditablePoint({ index, position, onChange, setControlsBusy }) {
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
    const onDraggingChanged = (e) => setControlsBusy(!!e.value);

    tc.addEventListener("change", handleChange);
    tc.addEventListener("dragging-changed", onDraggingChanged);

    return () => {
      tc.removeEventListener("change", handleChange);
      tc.removeEventListener("dragging-changed", onDraggingChanged);
    };
  }, [index, onChange, setControlsBusy]);

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

function DraggablePoint({ index, position, xmin, xmax, onChange, setControlsBusy }) {
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

      if (Number.isFinite(xmin) && Number.isFinite(xmax)) {
        x = Math.max(xmin, Math.min(xmax, x));
      }
      if (Number.isFinite(x) && Number.isFinite(y)) {
        onChange(index, { x, y });
      }
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
  xmin,
  xmax,
  fn,
  typedFn,
  curveKey,
  showControls = true,
}) {
  const wrapperRef = useRef(null);
  const cameraApiRef = useRef(null);

  const [controlsBusy, setControlsBusy] = useState(false);

  const [viewMode, setViewMode] = useState("both"); // typed | fit | both
  const showTyped = typedFn && (viewMode === "typed" || viewMode === "both");
  const showFit = fn && (viewMode === "fit" || viewMode === "both");

  const [editMode, setEditMode] = useState("drag"); // arrows | drag
  const handEnabled = useInputPrefs((s) => s.handControlEnabled);

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
        camera={{ zoom: 80, position: [0, 0, 10] }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#0f1115"), 1.0)}
      >
        {/* 손 제스처가 직접 카메라를 조작할 수 있는 API */}
        <CameraControlBridge cameraApiRef={cameraApiRef} />

        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 6]} intensity={0.9} />

        <Axes />

        {showFit && (
          <Curve key={curveKey + "|fit"} fn={fn} xmin={xmin} xmax={xmax} color="#64b5f6" />
        )}
        {showTyped && (
          <Curve key={curveKey + "|typed"} fn={typedFn} xmin={xmin} xmax={xmax} color="#ff5252" />
        )}

        {points.map((p, i) =>
          editMode === "arrows" ? (
            <EditablePoint
              key={"e-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
            />
          ) : (
            <DraggablePoint
              key={"d-" + (p.id ?? i)}
              index={i}
              position={{ x: p.x, y: p.y }}
              xmin={xmin}
              xmax={xmax}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
            />
          )
        )}

        {/* 손 모드에서는 OrbitControls를 꺼서 충돌(원치 않는 회전/줌)을 원천 차단 */}
        <OrbitControls makeDefault enabled={!controlsBusy && !handEnabled} />
      </Canvas>

      {/* UI(기존 구성 유지 가능) */}
      {showControls && (
        <div
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-start",
            maxWidth: "calc(100% - 16px)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ background: "rgba(0,0,0,0.55)", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 11 }}>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>손 제스처</div>
            <div style={{ opacity: 0.85, lineHeight: 1.35 }}>
              • 오른손 핀치: 드래그<br />
              • 양손 핀치: 줌<br />
              • 왼손 펼침: 팬<br />
              • 오른손 주먹: 회전
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.55)", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 11 }}>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>보기</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setViewMode("typed")} style={btnStyle(viewMode === "typed", "#ff5252")}>수식만</button>
              <button onClick={() => setViewMode("fit")} style={btnStyle(viewMode === "fit", "#64b5f6")}>근사만</button>
              <button onClick={() => setViewMode("both")} style={btnStyle(viewMode === "both", "#ffffff")}>둘다</button>
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.55)", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 11 }}>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>편집</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setEditMode("arrows")} style={btnStyle(editMode === "arrows", "#ffffff")}>화살표</button>
              <button onClick={() => setEditMode("drag")} style={btnStyle(editMode === "drag", "#ffffff")}>드래그</button>
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.55)", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 11 }}>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>손 입력</div>
            <HandToggle />
          </div>
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

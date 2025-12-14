// GraphCanvas.jsx equation graph component
import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Text,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";
import { HandInputProvider } from "../input/HandInputProvider";
import { useInputPrefs } from "../store/useInputPrefs";

function Axes({ xmin = -8, xmax = 8, ymin = -8, ymax = 8 }) {
  return (
    <group>
      <axesHelper args={[8]} />
      <gridHelper args={[16, 16]} rotation={[Math.PI / 2, 0, 0]} />
      {/* y=0 */}
      <line>
        <bufferGeometry
          attach="geometry"
          attributes-position={
            new THREE.Float32BufferAttribute([xmin, 0, 0, xmax, 0, 0], 3)
          }
        />
        <lineBasicMaterial color="#6039BC" linewidth={3} />
      </line>
      {/* x=0 */}
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

/* TransformControls(화살표) */
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
    const startStop = (dragging) => setControlsBusy(!!dragging);

    tc.addEventListener("change", handleChange);
    tc.addEventListener("dragging-changed", (e) => startStop(e.value));
    return () => {
      tc.removeEventListener("change", handleChange);
      tc.removeEventListener("dragging-changed", (e) => startStop(e.value));
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
        <Text
          fontSize={0.16}
          anchorX="left"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor="black"
        >
          {`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`}
        </Text>
      </group>
    </group>
  );
}

/* 점 직접 드래그 */
function DraggablePoint({
  index,
  position,
  xmin,
  xmax,
  onChange,
  setControlsBusy,
}) {
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    []
  );
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
    } catch (err) {
      // ignore NotFoundError when pointer capture is not available for synthetic pointers
    }
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
    try {
      e.target.releasePointerCapture?.(e.pointerId);
    } catch (err) {
      // ignore NotFoundError when pointer capture wasn't set
    }
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
        <Text
          fontSize={0.16}
          anchorX="left"
          anchorY="bottom"
          outlineWidth={0.004}
          outlineColor="black"
        >
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
  fn, // 파랑: 다항 근사
  typedFn, // 빨강: 입력 수식
  curveKey, // 리마운트 키
  showControls = true,
}) {
  const wrapperRef = useRef(null);
  const [controlsBusy, setControlsBusy] = useState(false);

  const [viewMode, setViewMode] = useState("both"); // "typed" | "fit" | "both"
  const showTyped = typedFn && (viewMode === "typed" || viewMode === "both");
  const showFit = fn && (viewMode === "fit" || viewMode === "both");

  const [editMode, setEditMode] = useState("drag"); // "arrows" | "drag"

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        flex: 1, // pane-content의 남은 공간을 채움
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Hand input provider: mounted when enabled in preferences */}
      {useInputPrefs((s) => s.handControlEnabled) && (
        <HandInputProvider targetRef={wrapperRef} />
      )}
      <Canvas
        orthographic
        camera={{ zoom: 80, position: [0, 0, 10] }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0);
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 6]} intensity={0.9} />

        <Axes />

        {showFit && (
          <Curve
            key={curveKey + "|fit"}
            fn={fn}
            xmin={xmin}
            xmax={xmax}
            color="#64b5f6"
          />
        )}
        {showTyped && (
          <Curve
            key={curveKey + "|typed"}
            fn={typedFn}
            xmin={xmin}
            xmax={xmax}
            color="#ff5252"
          />
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

        <OrbitControls makeDefault enabled={!controlsBusy} />
      </Canvas>
      {/* 우상단 오버레이: 반응형(줄바꿈/축소) */}{" "}
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
            overflow: "hidden",
          }}
        >
          {/* 보기 */}
          <div
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.2,
              flex: "1 1 auto",
              minWidth: "120px",
            }}
          >
            <div style={{ marginBottom: 6, opacity: 0.9 }}>보기</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setViewMode("typed")}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: viewMode === "typed" ? "#ff5252" : "transparent",
                  color: viewMode === "typed" ? "#000" : "#fff",
                  cursor: "pointer",
                }}
                title="입력 수식만"
              >
                수식만
              </button>
              <button
                onClick={() => setViewMode("fit")}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: viewMode === "fit" ? "#64b5f6" : "transparent",
                  color: viewMode === "fit" ? "#000" : "#fff",
                  cursor: "pointer",
                }}
                title="다항식 근사만"
              >
                근사만
              </button>
              <button
                onClick={() => setViewMode("both")}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: viewMode === "both" ? "#fff" : "transparent",
                  color: viewMode === "both" ? "#000" : "#fff",
                  cursor: "pointer",
                }}
                title="둘 다 보기"
              >
                둘다
              </button>
            </div>

            <div style={{ marginTop: 8, opacity: 0.9 }}>
              <div>
                <span style={{ color: "#ff5252" }}>■</span> 입력 수식
              </div>
              <div>
                <span style={{ color: "#64b5f6" }}>■</span> 다항 근사
              </div>
            </div>
          </div>

          {/* 편집 */}
          <div
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.2,
              flex: "1 1 auto",
              minWidth: "120px",
            }}
          >
            <div style={{ marginBottom: 6, opacity: 0.9 }}>편집</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setEditMode("arrows")}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: editMode === "arrows" ? "#fff" : "transparent",
                  color: editMode === "arrows" ? "#000" : "#fff",
                  cursor: "pointer",
                }}
                title="화살표(TransformControls)로 이동"
              >
                화살표
              </button>
              <button
                onClick={() => setEditMode("drag")}
                style={{
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: editMode === "drag" ? "#fff" : "transparent",
                  color: editMode === "drag" ? "#000" : "#fff",
                  cursor: "pointer",
                }}
                title="점 직접 드래그로 이동"
              >
                드래그
              </button>
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              {editMode === "drag"
                ? "점 클릭 후 드래그"
                : "노란점의 화살표로 이동"}
            </div>
          </div>

          {/* 손가락 카메라 입력 토글 */}
          <div
            style={{
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.2,
              minWidth: "110px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ marginBottom: 4, opacity: 0.9 }}>손 입력</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <HandToggle />
            </div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 11 }}>
              카메라로 손가락을 추적해 드래그/클릭을 흉내냅니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text } from "@react-three/drei";
import * as THREE from "three";

function Axes() {
  return (
    <group>
      <axesHelper args={[8]} />
      <gridHelper args={[16, 16]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

// 곡선: 포지션 버퍼를 매번 새로 만들어 교체 (coeffs/도메인 변동 시 재계산)
function Curve({ fn, xmin, xmax }) {
  const positions = useMemo(() => {
    const steps = 220;
    const dx = (xmax - xmin) / steps;
    const arr = new Float32Array((steps + 1) * 3);
    for (let i = 0; i <= steps; i++) {
      const x = xmin + dx * i;
      const y = fn(x);
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
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial />
    </line>
  );
}

function EditablePoint({
  index,
  position,
  selected,
  onSelect,
  onChange,
  setControlsBusy,
}) {
  const objRef = useRef();        // 실제로 화면에 보이는 점+라벨
  const tcRef  = useRef();        // TransformControls
  
  // 상위에서 position이 바뀌면 (예: 외부 연산) 실제 오브젝트 위치를 동기화
  useEffect(() => {
    if (!objRef.current) return;
    objRef.current.position.set(position.x, position.y, 0);
  }, [position.x, position.y]);

  // 드래그 중 매 프레임 좌표 반영 (controls.object가 '현재 드래그 중인 대상')
  const handleChange = () => {
    const t = tcRef.current;
    const o = t?.object;
    if (!o) return;
    if (o.position.z !== 0) o.position.z = 0;
    onChange(index, { x: o.position.x, y: o.position.y });
  };

  const CorePoint = (
    <group
      ref={objRef}
      position={[position.x, position.y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(index);
      }}
    >
      <mesh>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial color={selected ? "#ffd54f" : "white"} />
      </mesh>
      <group position={[0.14, 0.12, 0]}>
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

  return selected ? (
    <TransformControls
      ref={tcRef}
      mode="translate"
      showX
      showY
      showZ={false}
      onChange={handleChange} // ✅ 드래그 중 연속 업데이트
      onDraggingChanged={(dragging) => {
        setControlsBusy(!!dragging);
        // 디버그: 실제 드래그 대상 좌표와 상태 좌표 둘 다 확인
        const o = tcRef.current?.object;
        if (dragging) {
          console.log(`[start] P${index}`, "raw:", o?.position, "state:", position);
        } else {
          console.log(`[end]   P${index}`, "raw:", o?.position);
        }
      }}
    >
      {CorePoint}
    </TransformControls>
  ) : (
    CorePoint
  );
}


export default function GraphCanvas({
  points,
  onPointChange,
  xmin,
  xmax,
  fn,
  curveKey, // coeffs 변화에 따라 곡선 리마운트
}) {
  const [controlsBusy, setControlsBusy] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);

  return (
    <div className="canvas-wrap" style={{ position: "relative" }}>
      {selectedIndex !== null && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 10,
            background: "rgba(0,0,0,0.55)",
            color: "white",
            padding: "6px 8px",
            borderRadius: 8,
            fontSize: 12,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          P{selectedIndex}: ({points[selectedIndex].x.toFixed(3)},{" "}
          {points[selectedIndex].y.toFixed(3)})
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        onPointerMissed={() => setSelectedIndex(null)}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 10]} intensity={0.6} />

        <Axes />
        {/* coeffs가 바뀔 때 Curve 리마운트(안전장치) */}
        <Curve key={curveKey} fn={fn} xmin={xmin} xmax={xmax} />

        {points.map((p, i) => (
          <EditablePoint
            key={p.id}
            index={i}
            position={{ x: p.x, y: p.y }}
            selected={i === selectedIndex}
            onSelect={setSelectedIndex}
            onChange={(idx, xy) => {
              // 상위 state 업데이트 + 디버그
              console.log("onPointChange", { idx, ...xy });
              onPointChange(idx, xy);
            }}
            setControlsBusy={setControlsBusy}
          />
        ))}

        <OrbitControls makeDefault enabled={!controlsBusy} />
      </Canvas>
    </div>
  );
}

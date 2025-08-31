import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, DragControls, Text } from "@react-three/drei";
import * as THREE from "three";

function Axes() {
  return (
    <group>
      <axesHelper args={[8]} />
      <gridHelper args={[16, 16]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function Curve({ fn, xmin, xmax }) {
  const pts = useMemo(() => {
    const out = [];
    const steps = 220;
    const dx = (xmax - xmin) / steps;
    for (let i = 0; i <= steps; i++) {
      const x = xmin + dx * i;
      const y = fn(x);
      out.push(new THREE.Vector3(x, y, 0));
    }
    return out;
  }, [fn, xmin, xmax]);
  return <Line points={pts} lineWidth={2} />;
}

function DraggablePoint({
  index,
  position,
  onChange,
  setControlsActive,
  setDraggingIndex,
}) {
  const meshRef = useRef();
  const [labelXY, setLabelXY] = useState({ x: position.x, y: position.y });

  // 부모의 position 변경과 동기화
  useEffect(() => {
    setLabelXY({ x: position.x, y: position.y });
    if (meshRef.current) meshRef.current.position.set(position.x, position.y, 0);
  }, [position.x, position.y]);

  const handleDrag = () => {
    const p = meshRef.current?.position;
    if (!p) return;
    if (p.z !== 0) p.set(p.x, p.y, 0); // XY 평면 고정
    setLabelXY({ x: p.x, y: p.y });
    onChange(index, { x: p.x, y: p.y });
  };

  return (
    <DragControls
      transformGroup
      onDragStart={() => {
        setControlsActive(true);
        setDraggingIndex(index);
      }}
      onDrag={handleDrag}
      onDragEnd={() => {
        setControlsActive(false);
        setDraggingIndex(null);
      }}
    >
      <mesh ref={meshRef} position={[position.x, position.y, 0]}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial color="white" />
        {/* 3D 텍스트 라벨: 클릭/드래그 방해 없음 */}
        <group position={[0.14, 0.12, 0]}>
          <Text
            fontSize={0.16}
            anchorX="left"
            anchorY="bottom"
            outlineWidth={0.004}
            outlineColor="black"
          >
            {`(${labelXY.x.toFixed(2)}, ${labelXY.y.toFixed(2)})`}
          </Text>
        </group>
      </mesh>
    </DragControls>
  );
}

export default function GraphCanvas({ points, onPointChange, xmin, xmax, fn }) {
  const [controlsBusy, setControlsActive] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);

  return (
    <div className="canvas-wrap" style={{ position: "relative" }}>
      {/* 드래그 중 좌상단 HUD (밑 클릭 방해 안 하도록) */}
      {draggingIndex !== null && (
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
          P{draggingIndex}: ({points[draggingIndex].x.toFixed(3)},{" "}
          {points[draggingIndex].y.toFixed(3)})
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 12], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 10]} intensity={0.6} />

        <Axes />
        <Curve fn={fn} xmin={xmin} xmax={xmax} />

        {points.map((p, i) => (
          <DraggablePoint
            key={p.id}
            index={i}
            position={{ x: p.x, y: p.y }}
            onChange={onPointChange}
            setControlsActive={setControlsActive}
            setDraggingIndex={setDraggingIndex}
          />
        ))}

        <OrbitControls makeDefault enabled={!controlsBusy} />
      </Canvas>
    </div>
  );
}

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, TransformControls, Html } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

function Axes() {
  const group = useRef();
  return (
    <group ref={group}>
      <axesHelper args={[8]} />
      <gridHelper args={[16, 16]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function Curve({ fn, xmin, xmax }) {
  const points = useMemo(() => {
    const pts = [];
    const steps = 200;
    const dx = (xmax - xmin) / steps;
    for (let i = 0; i <= steps; i++) {
      const x = xmin + dx * i;
      const y = fn(x);
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return pts;
  }, [fn, xmin, xmax]);
  return <Line points={points} lineWidth={2} />;
}

function DraggablePoint({ index, position, onChange, setControlsActive }) {
  const ref = useRef();
  const [selected, setSelected] = useState(false);

  const sphere = (
    <mesh
      ref={ref}
      position={[position.x, position.y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(true);
      }}
    >
      <sphereGeometry args={[0.07, 24, 24]} />
      <meshStandardMaterial color={"white"} />
      <Html position={[0.1, 0.1, 0]} style={{ pointerEvents: "none" }}>
        <div className="pt-label">{index + 1}</div>
      </Html>
    </mesh>
  );

  return selected ? (
    <TransformControls
      mode="translate"
      showZ={false}
      position={[position.x, position.y, 0]}
      onMouseDown={() => setControlsActive(true)}
      onMouseUp={() => setControlsActive(false)}
      onObjectChange={() => {
        const p = ref.current.position;
        onChange(index, { x: p.x, y: p.y });
      }}
      onPointerMissed={() => setSelected(false)}
    >
      {sphere}
    </TransformControls>
  ) : (
    sphere
  );
}

export default function GraphCanvas({ points, onPointChange, xmin, xmax, fn }) {
  const [controlsBusy, setControlsBusy] = useState(false);

  return (
    <div className="canvas-wrap">
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
            setControlsActive={setControlsBusy}
          />
        ))}

        <OrbitControls makeDefault enabled={!controlsBusy} />
      </Canvas>
    </div>
  );
}

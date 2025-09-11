// src/ui/Array3DView.jsx
import React, { useMemo, useLayoutEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Voxels({ data, threshold = 0 }) {
  // data[z][y][x]
  const Z = data.length;
  const Y = data[0]?.length || 0;
  const X = data[0]?.[0]?.length || 0;

  const positions = useMemo(() => {
    const pos = [];
    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          const v = Number(data[z][y][x]) || 0;
          if (v > threshold) pos.push([x, y, z]);
        }
      }
    }
    return pos;
  }, [X, Y, Z, data, threshold]);

  const center = useMemo(() => [(X - 1) / 2, (Y - 1) / 2, (Z - 1) / 2], [X, Y, Z]);
  const meshRef = useRef();

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const temp = new THREE.Matrix4();
    positions.forEach((p, i) => {
      temp.compose(
        new THREE.Vector3(p[0], p[1], p[2]),
        new THREE.Quaternion(),
        new THREE.Vector3(0.95, 0.95, 0.95)
      );
      m.setMatrixAt(i, temp);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group position={[-center[0], -center[1], -center[2]]}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}

function Array3DView({ data }) {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [6, 6, 10], fov: 55 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 12, 8]} intensity={0.9} />
        <axesHelper args={[8]} />
        <gridHelper args={[20, 20]} position={[0, -5, 0]} />
        <Voxels data={data} threshold={0} />
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}

export default Array3DView;   // ✅ 꼭 default export

// src/ui/Array3DView.jsx
import React, { useMemo, useLayoutEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import "./Array3DView.css";

function normalizeOrder(order) {
  const ord = String(order || "zyx").toLowerCase();
  return /^[xyz]{3}$/.test(ord) ? ord : "zyx";
}

function pickDims(data, order = "zyx") {
  const a0 = Array.isArray(data) ? data.length : 0;
  const a1 = Array.isArray(data?.[0]) ? data[0].length : 0;
  const a2 = Array.isArray(data?.[0]?.[0]) ? data[0][0].length : 0;

  const ord = normalizeOrder(order);
  const dims = { x: 0, y: 0, z: 0 };
  dims[ord[0]] = a0;
  dims[ord[1]] = a1;
  dims[ord[2]] = a2;

  return { X: dims.x, Y: dims.y, Z: dims.z, ord, a0, a1, a2 };
}

function makeGetter(data, ord) {
  const idxOf = { x: -1, y: -1, z: -1 };
  idxOf[ord[0]] = 0;
  idxOf[ord[1]] = 1;
  idxOf[ord[2]] = 2;

  return (x, y, z) => {
    const a = [0, 0, 0];
    a[idxOf.x] = x;
    a[idxOf.y] = y;
    a[idxOf.z] = z;

    const v = data?.[a[0]]?.[a[1]]?.[a[2]];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
}

function Voxels({ data, threshold = 0, axisOrder = "zyx" }) {
  const { X, Y, Z, ord } = useMemo(
    () => pickDims(data, axisOrder),
    [data, axisOrder]
  );
  const getV = useMemo(() => makeGetter(data, ord), [data, ord]);

  const positions = useMemo(() => {
    if (!Array.isArray(data) || X <= 0 || Y <= 0 || Z <= 0) return [];
    const pos = [];
    for (let z = 0; z < Z; z++) {
      for (let y = 0; y < Y; y++) {
        for (let x = 0; x < X; x++) {
          const v = getV(x, y, z);
          if (v > threshold) pos.push([x, y, z]);
        }
      }
    }
    return pos;
  }, [data, X, Y, Z, threshold, getV]);

  const center = useMemo(
    () => [(X - 1) / 2, (Y - 1) / 2, (Z - 1) / 2],
    [X, Y, Z]
  );

  const meshRef = useRef(null);

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;

    m.count = positions.length;

    const temp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(0.95, 0.95, 0.95);

    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      temp.compose(new THREE.Vector3(x, y, z), q, s);
      m.setMatrixAt(i, temp);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group position={[-center[0], -center[1], -center[2]]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(1, positions.length)]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}

export default function Array3DView({
  data,
  threshold = 0,
  axisOrder = "zyx",
}) {
  const { X, Y, Z } = useMemo(
    () => pickDims(data, axisOrder),
    [data, axisOrder]
  );
  const maxDim = Math.max(1, X, Y, Z);

  const camPos = useMemo(
    () => [maxDim * 0.9, maxDim * 0.8, maxDim * 1.2],
    [maxDim]
  );
  const gridY = useMemo(() => -((Y - 1) / 2) - 0.5, [Y]);
  const gridSize = useMemo(() => Math.max(10, maxDim * 2 + 2), [maxDim]);

  return (
    <div className="array3d-root">
      <Canvas camera={{ position: camPos, fov: 55 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 12, 8]} intensity={0.9} />
        <axesHelper args={[Math.max(5, maxDim * 1.2)]} />
        <gridHelper args={[gridSize, gridSize]} position={[0, gridY, 0]} />
        <Voxels data={data} threshold={threshold} axisOrder={axisOrder} />
        <OrbitControls enableDamping target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}

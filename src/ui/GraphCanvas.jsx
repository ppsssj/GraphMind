// src/ui/GraphCanvas.jsx
import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Text,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";

import { HandInputProvider } from "../input/HandInputProvider";
import { useInputPrefs } from "../store/useInputPrefs";
import OrientationOverlay from "./OrientationOverlay";

function CameraControlBridge({
  cameraApiRef,
  target = new THREE.Vector3(0, 0, 0),
}) {
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

        const v = new THREE.Vector3()
          .setFromSpherical(s)
          .add(targetRef.current);
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

function buildLineSegments(segments) {
  // segments: [[x1,y1,z1,x2,y2,z2], ...]
  const arr = new Float32Array(segments.length * 6);
  for (let i = 0; i < segments.length; i++) {
    const o = i * 6;
    const s = segments[i];
    arr[o + 0] = s[0];
    arr[o + 1] = s[1];
    arr[o + 2] = s[2];
    arr[o + 3] = s[3];
    arr[o + 4] = s[4];
    arr[o + 5] = s[5];
  }
  return arr;
}

function snapUp(v, step) {
  if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return v;
  return Math.ceil(v / step) * step;
}

function GridAndAxes({
  xmin = -8,
  xmax = 8,
  ymin = -8,
  ymax = 8,

  // ✅ gridStep = major step
  gridStep = 1,
  // ✅ minorDiv = major 1칸 분할 수
  minorDiv = 4,

  gridMode = "major", // off | box | major | full
}) {
  const x0 = xmin;
  const x1 = xmax;
  const y0 = ymin;
  const y1 = ymax;

  const zGrid = 0.0;
  const zAxis = 0.01;
  const axisThickness = 0.06;

  const majorStep = Math.max(0.1, Number(gridStep) || 1);
  const div = Math.max(1, Math.floor(Number(minorDiv) || 4));
  const minorStep = majorStep / div;

  const { minorPositions, majorPositions, boxPositions } = useMemo(() => {
    const boxSegs = [
      [x0, y0, zGrid, x1, y0, zGrid],
      [x1, y0, zGrid, x1, y1, zGrid],
      [x1, y1, zGrid, x0, y1, zGrid],
      [x0, y1, zGrid, x0, y0, zGrid],
    ];

    const majorSegs = [];
    const mxStart = snapUp(x0, majorStep);
    const myStart = snapUp(y0, majorStep);

    for (let x = mxStart; x <= x1 + 1e-9; x += majorStep) {
      majorSegs.push([x, y0, zGrid, x, y1, zGrid]);
    }
    for (let y = myStart; y <= y1 + 1e-9; y += majorStep) {
      majorSegs.push([x0, y, zGrid, x1, y, zGrid]);
    }

    // full 모드에서만 minor를 쓰지만, 계산은 미리 해둬도 OK
    const minorSegs = [];
    const sxStart = snapUp(x0, minorStep);
    const syStart = snapUp(y0, minorStep);

    for (let x = sxStart; x <= x1 + 1e-9; x += minorStep) {
      minorSegs.push([x, y0, zGrid, x, y1, zGrid]);
    }
    for (let y = syStart; y <= y1 + 1e-9; y += minorStep) {
      minorSegs.push([x0, y, zGrid, x1, y, zGrid]);
    }

    return {
      minorPositions: buildLineSegments(minorSegs),
      majorPositions: buildLineSegments(majorSegs),
      boxPositions: buildLineSegments(boxSegs),
    };
  }, [x0, x1, y0, y1, majorStep, minorStep]);

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sizeX = Math.max(1, Math.abs(x1 - x0));
  const sizeY = Math.max(1, Math.abs(y1 - y0));

  return (
    <group>
      {gridMode === "box" && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={boxPositions}
              count={boxPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7f8a9a" transparent opacity={0.55} />
        </lineSegments>
      )}

      {gridMode === "major" && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={majorPositions}
              count={majorPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7f8a9a" transparent opacity={0.45} />
        </lineSegments>
      )}

      {gridMode === "full" && (
        <group>
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={minorPositions}
                count={minorPositions.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#7f8a9a" transparent opacity={0.18} />
          </lineSegments>

          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={majorPositions}
                count={majorPositions.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#7f8a9a" transparent opacity={0.45} />
          </lineSegments>
        </group>
      )}

      {/* axes */}
      <mesh position={[cx, cy, zAxis]}>
        <boxGeometry args={[sizeX, axisThickness, axisThickness]} />
        <meshStandardMaterial color="#6039BC" />
      </mesh>

      <mesh position={[cx, cy, zAxis]}>
        <boxGeometry args={[axisThickness, sizeY, axisThickness]} />
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

function EditablePoint({
  index,
  position,
  onChange,
  onCommit,
  setControlsBusy,
}) {
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

function DraggablePoint({
  index,
  pointKey,
  points,
  getPointKey,

  position,
  xmin,
  xmax,
  ymin,
  ymax,

  onChange,
  onCommit,
  onRemove,

  setControlsBusy,

  // selection + group move
  selectedKeys,
  setSelectedKeys,

  // prevent Alt+click add from firing when interacting with points
  suppressAltRef,
}) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  useCursor(hovered || dragging);

  const dragStartRef = useRef(null); // { startHit: Vector3, items: [{i,x,y}] }

  const clampXY = (x, y) => {
    let xx = x;
    let yy = y;

    if (Number.isFinite(xmin) && Number.isFinite(xmax)) xx = Math.max(xmin, Math.min(xmax, xx));
    if (Number.isFinite(ymin) && Number.isFinite(ymax)) yy = Math.max(ymin, Math.min(ymax, yy));

    return { x: xx, y: yy };
  };

  const computeNextSelection = (prevSet, key, e) => {
    const prev = prevSet instanceof Set ? prevSet : new Set();
    const toggle = !!(e?.ctrlKey || e?.metaKey);

    if (toggle) {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    }

    // 일반 클릭: 이미 다중 선택이고, 그 안의 점을 잡았으면 selection 유지
    if (prev.size > 1 && prev.has(key)) return new Set(prev);

    return new Set([key]);
  };

  const onPointerDown = (e) => {
    e.stopPropagation();

    // ✅ Alt+클릭 추가 로직과 충돌 방지
    if (suppressAltRef) {
      suppressAltRef.current = true;
      requestAnimationFrame(() => (suppressAltRef.current = false));
    }

    setDragging(true);
    setControlsBusy(true);

    const key = pointKey ?? (typeof getPointKey === "function" ? getPointKey(points?.[index], index) : points?.[index]?.id ?? index);

    // ✅ selection 업데이트(동기 계산 + state 반영)
    const nextSel = computeNextSelection(selectedKeys, key, e);
    setSelectedKeys?.(nextSel);

    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {}

    // ✅ 그룹 이동 준비: 선택된 점들만 start snapshot
    const sel = nextSel instanceof Set && nextSel.size ? nextSel : new Set([key]);
    const items = [];
    const arr = Array.isArray(points) ? points : [];
    for (let i = 0; i < arr.length; i++) {
      const k = typeof getPointKey === "function" ? getPointKey(arr[i], i) : arr[i]?.id ?? i;
      if (sel.has(k)) items.push({ i, x: Number(arr[i]?.x) || 0, y: Number(arr[i]?.y) || 0 });
    }

    // start hit on plane
    if (e.ray.intersectPlane(plane, hit.current)) {
      dragStartRef.current = { startHit: hit.current.clone(), items };
    } else {
      dragStartRef.current = null;
    }
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();

    if (!e.ray.intersectPlane(plane, hit.current)) return;
    const st = dragStartRef.current;
    if (!st?.startHit || !Array.isArray(st.items) || st.items.length === 0) return;

    const dx = hit.current.x - st.startHit.x;
    const dy = hit.current.y - st.startHit.y;

    // ✅ 선택된 점들만 동일 Δ로 이동
    for (const it of st.items) {
      const nx = it.x + dx;
      const ny = it.y + dy;
      const c = clampXY(nx, ny);
      onChange?.(it.i, c);
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

    dragStartRef.current = null;
    onCommit?.(index);
  };

  const onContextMenu = (e) => {
    // 우클릭으로 점 제거
    try { e?.stopPropagation?.(); } catch {}
    try { e?.nativeEvent?.stopPropagation?.(); } catch {}
    try { e?.nativeEvent?.preventDefault?.(); } catch {}
    try { e?.preventDefault?.(); } catch {}

    const key =
      pointKey ??
      (typeof getPointKey === "function"
        ? getPointKey(points?.[index], index)
        : points?.[index]?.id ?? index);

    if (typeof onRemove === "function") {
      // ✅ removePoint 구현이 (index), (index,key), (id) 등 제각각일 수 있어 방어적으로 호출
      if (onRemove.length >= 2) {
        onRemove(index, key);
      } else if (onRemove.length === 1) {
        const hasId = points?.[index]?.id !== undefined && points?.[index]?.id !== null;
        onRemove(hasId ? points[index].id : index);
      } else {
        onRemove();
      }
    }
  };

  const selfKey = pointKey ?? (typeof getPointKey === "function" ? getPointKey(points?.[index], index) : points?.[index]?.id ?? index);
  const isSelected = selectedKeys instanceof Set ? selectedKeys.has(selfKey) : false;

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
        onContextMenu={onContextMenu}
      >
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshStandardMaterial
          color={dragging ? "#ff9800" : isSelected ? "#38bdf8" : hovered ? "#ffd54f" : "#ffc107"}
          emissive={isSelected ? "#0ea5e9" : dragging ? "#ff9800" : "#000000"}
          emissiveIntensity={isSelected ? 0.22 : dragging ? 0.25 : 0}
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

function AltMarqueeSelectAndAddR3F({
  enabled = true,
  wrapperRef,

  points = [],
  getPointKey = (p, i) => (p && p.id !== undefined ? p.id : i),

  setSelectedKeys,
  setMarqueeBox,

  onPointAdd,

  fn,
  typedFn,
  showFit,
  showTyped,

  suppressRef,
}) {
  const { camera } = useThree();

  const activeRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const lastRef = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef(null);

  const getLocal = (ev) => {
    const wrap = wrapperRef?.current;
    const rect = wrap?.getBoundingClientRect?.();
    if (!rect) return null;
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      w: rect.width,
      h: rect.height,
      rect,
    };
  };

  const rectNorm = (a, b) => {
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    return { x0, y0, x1, y1 };
  };

  const pickAddPoint = (worldX, worldY) => {
    if (typeof onPointAdd !== "function") return;

    const x = worldX;
    const yClick = worldY;

    let bestY = yClick;
    let bestDist = Infinity;

    const tryFn = (f) => {
      if (typeof f !== "function") return;
      let y;
      try {
        y = f(x);
      } catch {
        return;
      }
      const yy = Number(y);
      if (!Number.isFinite(yy)) return;
      const d = Math.abs(yy - yClick);
      if (d < bestDist) {
        bestDist = d;
        bestY = yy;
      }
    };

    if (showFit) tryFn(fn);
    if (showTyped) tryFn(typedFn);

    onPointAdd({ x, y: bestY });
  };

  const computeSelection = (a, b, rect) => {
    const r = rectNorm(a, b);
    const sel = new Set();
    const v = new THREE.Vector3();

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const xx = Number(p?.x);
      const yy = Number(p?.y);
      if (!Number.isFinite(xx) || !Number.isFinite(yy)) continue;

      v.set(xx, yy, 0).project(camera);
      const px = (v.x * 0.5 + 0.5) * rect.width;
      const py = (-v.y * 0.5 + 0.5) * rect.height;

      if (px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1) {
        sel.add(getPointKey(p, i));
      }
    }

    return sel;
  };

  const onPlanePointerDown = (e) => {
    if (!enabled) return;
    if (!e.altKey) return;
    if (e.button !== 0) return; // left only
    if (suppressRef?.current) return;

    const local = getLocal(e.nativeEvent);
    if (!local) return;

    activeRef.current = true;
    movedRef.current = false;
    pointerIdRef.current = e.pointerId;

    startRef.current = { x: local.x, y: local.y };
    lastRef.current = { x: local.x, y: local.y };

    setMarqueeBox?.({ x0: local.x, y0: local.y, x1: local.x, y1: local.y });

    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {}

    try {
      e.nativeEvent?.preventDefault?.();
    } catch {}
    e.stopPropagation();
  };

  const onPlanePointerMove = (e) => {
    if (!activeRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const local = getLocal(e.nativeEvent);
    if (!local) return;

    lastRef.current = { x: local.x, y: local.y };

    if (!movedRef.current) {
      const dx = local.x - startRef.current.x;
      const dy = local.y - startRef.current.y;
      if (dx * dx + dy * dy > 16) movedRef.current = true;
    }

    setMarqueeBox?.({
      x0: startRef.current.x,
      y0: startRef.current.y,
      x1: local.x,
      y1: local.y,
    });

    try {
      e.nativeEvent?.preventDefault?.();
    } catch {}
    e.stopPropagation();
  };

  const finish = (e) => {
    if (!activeRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const local = getLocal(e.nativeEvent);
    const rect = local?.rect || wrapperRef?.current?.getBoundingClientRect?.();
    const end = local ? { x: local.x, y: local.y } : lastRef.current;

    activeRef.current = false;
    pointerIdRef.current = null;
    setMarqueeBox?.(null);

    // Alt+click → add point
    if (!movedRef.current) {
      pickAddPoint(e.point.x, e.point.y);
      try {
        e.nativeEvent?.preventDefault?.();
      } catch {}
      e.stopPropagation();
      return;
    }

    // Alt+drag → box select (Ctrl/Cmd additive)
    if (rect) {
      const boxSel = computeSelection(startRef.current, end, rect);

      setSelectedKeys?.((prev) => {
        const prevSet = prev instanceof Set ? prev : new Set();
        const additive = !!(e.ctrlKey || e.metaKey);

        if (!additive) return boxSel;

        const next = new Set(prevSet);
        for (const k of boxSel) next.add(k);
        return next;
      });
    }

    try {
      e.nativeEvent?.preventDefault?.();
    } catch {}
    e.stopPropagation();
  };

  const onPlanePointerUp = (e) => finish(e);
  const onPlanePointerCancel = (e) => {
    if (activeRef.current && pointerIdRef.current === e.pointerId) {
      activeRef.current = false;
      pointerIdRef.current = null;
      setMarqueeBox?.(null);
      try {
        e.nativeEvent?.preventDefault?.();
      } catch {}
      e.stopPropagation();
    }
  };

  return (
    <mesh
      position={[0, 0, -0.001]}
      onPointerDown={onPlanePointerDown}
      onPointerMove={onPlanePointerMove}
      onPointerUp={onPlanePointerUp}
      onPointerCancel={onPlanePointerCancel}
      renderOrder={-1000}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function GraphCanvas({
  points,
  onPointChange,
  onPointCommit,
  onPointAdd,
  onPointRemove,
  xmin,
  xmax,
  ymin,
  ymax,

  gridStep,
  setGridStep,

  // ✅ 추가: 격자 모드(외부에서 제어 가능)
  gridMode,
  setGridMode,
  minorDiv,
  setMinorDiv,

  fn,
  typedFn,
  curveKey,
  markers = [],

  ruleMode = "free",
  setRuleMode,
  rulePolyDegree = 3,
  setRulePolyDegree,
  ruleError,
  tightGridToCurves = true,
  showControls = true,
}) {
  const wrapperRef = useRef(null);
  const cameraApiRef = useRef(null);
  const controlsRef = useRef();
  const [controlsBusy, setControlsBusy] = useState(false);
  const [viewMode, setViewMode] = useState("both"); // typed | fit | both
  const [editMode, setEditMode] = useState("drag"); // arrows | drag

  const getPointKey = (p, i) => (p && p.id !== undefined ? p.id : i);

  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [marqueeBox, setMarqueeBox] = useState(null); // { x0, y0, x1, y1 } in px (wrapper local)

  const suppressAltRef = useRef(false);
  const [altDown, setAltDown] = useState(false);

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === "Alt") setAltDown(true);
    };
    const onKeyUp = (ev) => {
      if (ev.key === "Alt") setAltDown(false);
    };
    const onBlur = () => setAltDown(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // points가 바뀌면(추가/삭제) 선택 집합을 유효 키로 정리
  useEffect(() => {
    setSelectedKeys((prev) => {
      if (!(prev instanceof Set) || prev.size === 0) return prev;
      const valid = new Set();
      if (Array.isArray(points)) {
        for (let i = 0; i < points.length; i++) valid.add(getPointKey(points[i], i));
      }
      const next = new Set();
      for (const k of prev) if (valid.has(k)) next.add(k);
      return next;
    });
  }, [points]);

  const handEnabled = useInputPrefs((s) => s.handControlEnabled);

  const [openPanel, setOpenPanel] = useState(null);

  useEffect(() => {
    if (handEnabled) setOpenPanel((p) => p ?? "gestures");
    else setOpenPanel((p) => (p === "gestures" ? null : p));
  }, [handEnabled]);

  // grid step (기존)
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
  // ✅ minorDiv (Curve3D 스타일: major 1칸을 몇 등분할지)
  const [minorDivLocal, setMinorDivLocal] = useState(minorDiv ?? 4);

  useEffect(() => {
    if (minorDiv !== undefined) setMinorDivLocal(minorDiv);
  }, [minorDiv]);

  const minorDivEff = Math.max(
    1,
    Math.floor(Number(minorDiv ?? minorDivLocal) || 4)
  );

  const setMinorDivEff = (v) => {
    const n = Math.max(1, Math.floor(Number(v) || 4));
    if (typeof setMinorDiv === "function") setMinorDiv(n);
    else setMinorDivLocal(n);
  };

  // ✅ grid mode (추가)
  const [gridModeLocal, setGridModeLocal] = useState(gridMode ?? "major");
  useEffect(() => {
    if (gridMode !== undefined) setGridModeLocal(gridMode);
  }, [gridMode]);

  const gridModeEff = (gridMode ?? gridModeLocal) || "major";

  const setGridModeEff = (v) => {
    const next = String(v || "major");
    if (typeof setGridMode === "function") setGridMode(next);
    else setGridModeLocal(next);
  };

  const showTyped = typedFn && (viewMode === "typed" || viewMode === "both");
  const showFit = fn && (viewMode === "fit" || viewMode === "both");

  // 드래그/편집 제한 범위(기존 동작 유지)
  const dragYMin = Number.isFinite(ymin) ? ymin : xmin;
  const dragYMax = Number.isFinite(ymax) ? ymax : xmax;

  // ✅ 요청 반영: "그래프가 렌더링되는 구간"에 대해서만 그리드 출력
  // - 표시 중인 곡선(fn/typedFn)을 샘플링해서 y-bounds를 계산
  // - 비정상적으로 큰 값(비연속/점근선 등)은 MAX_ABS로 컷
  // - 5%~95% 분위수로 안정적인 범위를 잡고 약간의 padding만 부여
  // ✅ 요청 반영: "그래프가 렌더링되는 구간"에 대해서만 그리드 출력 +
  // ✅ 추가: grid bounds padding(여유) + step 단위로 바깥쪽 스냅
  const gridBounds = useMemo(() => {
    const x0 = Number(xmin);
    const x1 = Number(xmax);

    if (!Number.isFinite(x0) || !Number.isFinite(x1) || x0 === x1) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    // grid를 곡선에 타이트하게 붙이지 않는 옵션(기존 유지)
    if (!tightGridToCurves) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    const ys = [];
    const N = 420;
    const dx = (x1 - x0) / N;
    const MAX_ABS = 1e5;

    const sampleFn = (f) => {
      if (typeof f !== "function") return;
      for (let i = 0; i <= N; i++) {
        const x = x0 + dx * i;
        let y;
        try {
          y = f(x);
        } catch {
          continue;
        }
        const n = Number(y);
        if (!Number.isFinite(n)) continue;
        if (Math.abs(n) > MAX_ABS) continue;
        ys.push(n);
      }
    };

    // 현재 표시 중인 곡선만 bounds 계산에 사용
    if (showFit) sampleFn(fn);
    if (showTyped) sampleFn(typedFn);

    // ✅ points/markers도 bounds 계산에 포함 (격자 밖으로 나가면 자동 확장)
    let extraMinX = Math.min(x0, x1);
    let extraMaxX = Math.max(x0, x1);

    const pushXY = (x, y) => {
      const xx = Number(x);
      const yy = Number(y);
      if (Number.isFinite(xx) && Math.abs(xx) <= MAX_ABS) {
        if (xx < extraMinX) extraMinX = xx;
        if (xx > extraMaxX) extraMaxX = xx;
      }
      if (Number.isFinite(yy) && Math.abs(yy) <= MAX_ABS) ys.push(yy);
    };

    if (Array.isArray(points)) {
      for (const p of points) pushXY(p?.x, p?.y);
    }
    if (Array.isArray(markers)) {
      for (const m of markers) pushXY(m?.x, m?.y);
    }

    // 곡선이 없거나 유효 샘플이 부족하면 기존 범위 사용
    if (ys.length < 8) {
      return { xmin: x0, xmax: x1, ymin: dragYMin, ymax: dragYMax };
    }

    ys.sort((a, b) => a - b);

    // ✅ 곡선을 실제로 포함하도록 min/max 사용
    let yLo = ys[0];
    let yHi = ys[ys.length - 1];

    const step = Math.max(0.1, Number(gridStepEff) || 1);

    // 거의 평평한 경우: 최소 높이 확보
    let span = yHi - yLo;
    if (!Number.isFinite(span) || Math.abs(span) < step * 0.5) {
      const xMid = (x0 + x1) / 2;

      // 현재 표시 중인 곡선 우선으로 mid 계산 (typed → fit 순)
      const midFn =
        (showTyped && typeof typedFn === "function" ? typedFn : null) ||
        (showFit && typeof fn === "function" ? fn : null);

      let mid = yLo; // fallback
      if (midFn) {
        try {
          const v = Number(midFn(xMid));
          if (Number.isFinite(v)) mid = v;
        } catch {
          // keep fallback
        }
      }

      yLo = mid - step * 2;
      yHi = mid + step * 2;
      span = yHi - yLo;
    }

    // 1차 패딩(기존): 곡선 주변 여유
    const corePad = Math.max(step * 0.5, span * 0.08);
    let xMinGrid = extraMinX;
    let xMaxGrid = extraMaxX;
    let yMinGrid = yLo - corePad;
    let yMaxGrid = yHi + corePad;

    // ✅ 추가 패딩(요청): "그래프와 격자가 딱 맞는 느낌" 제거용
    // - 비율 패딩 + 최소 패딩(스텝 2칸) 같이 적용
    const PAD_RATIO = 0.12;
    const PAD_MIN = step * 2;

    const xSpan = Math.max(1e-6, xMaxGrid - xMinGrid);
    const ySpan = Math.max(1e-6, yMaxGrid - yMinGrid);

    const padX = Math.max(PAD_MIN, xSpan * PAD_RATIO);
    const padY = Math.max(PAD_MIN, ySpan * PAD_RATIO);

    xMinGrid -= padX;
    xMaxGrid += padX;
    yMinGrid -= padY;
    yMaxGrid += padY;

    // ✅ 그리드 라인이 "딱 떨어지게" step 단위로 바깥쪽 스냅
    const snapOut = (v, s, dir) => {
      if (!Number.isFinite(v) || !Number.isFinite(s) || s <= 0) return v;
      return dir < 0 ? Math.floor(v / s) * s : Math.ceil(v / s) * s;
    };

    xMinGrid = snapOut(xMinGrid, step, -1);
    xMaxGrid = snapOut(xMaxGrid, step, +1);
    yMinGrid = snapOut(yMinGrid, step, -1);
    yMaxGrid = snapOut(yMaxGrid, step, +1);

    return { xmin: xMinGrid, xmax: xMaxGrid, ymin: yMinGrid, ymax: yMaxGrid };
  }, [
    xmin,
    xmax,
    dragYMin,
    dragYMax,
    tightGridToCurves,
    showFit,
    showTyped,
    fn,
    typedFn,
    gridStepEff,
    points,
    markers,
    curveKey,
    viewMode,
  ]);

  const commit = (idx) => onPointCommit?.(idx);

  return (
    <div
      ref={wrapperRef}
      onContextMenu={(e) => {
        // ✅ 캔버스 영역 기본 우클릭 메뉴 차단 (노드 우클릭 삭제 UX 안정화)
        e.preventDefault();
      }}
      style={{
        position: "relative",
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
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
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color("#0f1115"), 1.0)
        }
      >
        <CameraControlBridge cameraApiRef={cameraApiRef} />

        <AltMarqueeSelectAndAddR3F
          enabled={true}
          wrapperRef={wrapperRef}
          points={points}
          getPointKey={getPointKey}
          selectedKeys={selectedKeys}
          setSelectedKeys={setSelectedKeys}
          setMarqueeBox={setMarqueeBox}
          onPointAdd={onPointAdd}
          fn={fn}
          typedFn={typedFn}
          showFit={showFit}
          showTyped={showTyped}
          suppressRef={suppressAltRef}
        />

        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 6]} intensity={0.9} />

        {/* ✅ gridMode 적용 */}
        <GridAndAxes
          xmin={gridBounds.xmin}
          xmax={gridBounds.xmax}
          ymin={gridBounds.ymin}
          ymax={gridBounds.ymax}
          gridStep={gridStepEff}
          minorDiv={minorDivEff}
          gridMode={gridModeEff}
        />

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

        {Array.isArray(markers) &&
          markers.map((m) => (
            <group key={m.id ?? `${m.kind}-${m.x}-${m.y}`}>
              <mesh position={[m.x, m.y, 0.03]}>
                <sphereGeometry args={[0.12, 24, 24]} />
                <meshStandardMaterial
                  color="#00e676"
                  emissive="#00e676"
                  emissiveIntensity={0.25}
                />
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
              pointKey={getPointKey(p, i)}
              points={points}
              getPointKey={getPointKey}
              selectedKeys={selectedKeys}
              setSelectedKeys={setSelectedKeys}
              onRemove={onPointRemove}
              suppressAltRef={suppressAltRef}
              position={{ x: p.x, y: p.y }}
              xmin={xmin}
              xmax={xmax}
              ymin={dragYMin}
              ymax={dragYMax}
              onChange={(idx, xy) => onPointChange(idx, xy)}
              setControlsBusy={setControlsBusy}
              onCommit={commit}
            />
          )
        )}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!controlsBusy && !handEnabled && !altDown && !marqueeBox}
        />
        <OrientationOverlay controlsRef={controlsRef} />
      </Canvas>

      {marqueeBox && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 15,
          }}
        >
          {(() => {
            const left = Math.min(marqueeBox.x0, marqueeBox.x1);
            const top = Math.min(marqueeBox.y0, marqueeBox.y1);
            const width = Math.abs(marqueeBox.x1 - marqueeBox.x0);
            const height = Math.abs(marqueeBox.y1 - marqueeBox.y0);

            return (
              <div
                style={{
                  position: "absolute",
                  left,
                  top,
                  width,
                  height,
                  border: "1px solid rgba(56,189,248,0.9)",
                  background: "rgba(56,189,248,0.10)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
                  borderRadius: 6,
                }}
              />
            );
          })()}
        </div>
      )}

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
                    <div
                      style={{
                        padding: "8px 10px",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {children}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                <Panel id="rule" title="규칙 기반 편집">
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
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
                        onChange={(e) =>
                          setRulePolyDegree?.(Number(e.target.value))
                        }
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

                  <div
                    style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}
                  >
                    점을 드래그한 뒤 놓으면, 선택한 규칙(함수 family)을 유지한
                    채 파라미터만 갱신됩니다.
                  </div>

                  {ruleError && (
                    <div
                      style={{
                        marginTop: 6,
                        color: "#ffcc80",
                        lineHeight: 1.35,
                      }}
                    >
                      {ruleError}
                    </div>
                  )}
                </Panel>

                <Panel id="view" title="보기">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setViewMode("typed")}
                      style={btnStyle(viewMode === "typed", "#ff5252")}
                    >
                      수식만
                    </button>
                    <button
                      onClick={() => setViewMode("fit")}
                      style={btnStyle(viewMode === "fit", "#64b5f6")}
                    >
                      근사만
                    </button>
                    <button
                      onClick={() => setViewMode("both")}
                      style={btnStyle(viewMode === "both", "#ffffff")}
                    >
                      둘다
                    </button>
                  </div>
                </Panel>

                {/* ✅ 격자: 모드 + 간격 */}
                <Panel id="grid" title="Grid">
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <label style={{ opacity: 0.75, width: 34 }}>Mode</label>
                    <select
                      value={gridModeEff}
                      onChange={(e) => setGridModeEff(e.target.value)}
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
                      <option value="off">Off</option>
                      <option value="box">Box</option>
                      <option value="major">Major</option>
                      <option value="full">Full</option>
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <label style={{ opacity: 0.75, width: 34 }}>Step</label>
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
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                      title={
                        gridModeEff === "off" || gridModeEff === "box"
                          ? "현재 모드에서는 Step이 적용되지 않습니다."
                          : "격자 간격"
                      }
                    />
                    <button
                      onClick={() => setGridStepEff(1)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      1
                    </button>
                    <button
                      onClick={() => setGridStepEff(2)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      2
                    </button>
                    <button
                      onClick={() => setGridStepEff(4)}
                      style={btnStyle(false, "#ffffff")}
                      disabled={gridModeEff === "off" || gridModeEff === "box"}
                    >
                      4
                    </button>
                  </div>
                </Panel>

                <Panel id="edit" title="편집">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setEditMode("arrows")}
                      style={btnStyle(editMode === "arrows", "#ffffff")}
                    >
                      화살표
                    </button>
                    <button
                      onClick={() => setEditMode("drag")}
                      style={btnStyle(editMode === "drag", "#ffffff")}
                    >
                      드래그
                    </button>
                  </div>
                </Panel>

                <Panel id="hand" title="손 입력">
                  <HandToggle />
                  <div
                    style={{ marginTop: 6, opacity: 0.75, lineHeight: 1.35 }}
                  >
                    손 입력을 켜면 “손 제스처” 패널이 자동으로 활성화됩니다.
                  </div>
                </Panel>

                <Panel id="gestures" title="손 제스처" hidden={!handEnabled}>
                  <div style={{ opacity: 0.9, lineHeight: 1.45 }}>
                    • 오른손 핀치: 드래그
                    <br />• 양손 핀치: 줌<br />• 왼손 펼침: 팬<br />• 오른손
                    주먹: 회전
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

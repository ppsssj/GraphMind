// src/input/HandInputProvider.jsx
import { useEffect, useRef } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export function HandInputProvider({
  targetRef,
  targetElId,
  zoomApiRef,            // GraphCanvas에서 주입 (camera.zoom 제어)
  enabled = true,
  mirror = true,         // 셀피 카메라 기준 좌우 반전
  modelPath = "/models/hand_landmarker.task",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const landmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // pointer 상태
  const pointerDownRef = useRef(false);
  const pointerId = 1; // synthetic pointerId (일관성)

  // smoothing
  const smoothX = useRef(0.5);
  const smoothY = useRef(0.5);

  // pinch (thumb-index)
  const pinchOn = 0.040;
  const pinchOff = 0.060;
  const pinchedRef = useRef(false);

  // zoom (index-middle)
  const lastZoomDistRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // ✅ Provider 활성화 동안만 pointer capture 예외를 전역에서 흡수 (r3f 내부 호출도 포함)
    const origRel = Element.prototype.releasePointerCapture;
    const origSet = Element.prototype.setPointerCapture;

    Element.prototype.releasePointerCapture = function (pid) {
      try {
        return origRel.call(this, pid);
      } catch (e) {
        if (e?.name === "NotFoundError") return;
        throw e;
      }
    };
    Element.prototype.setPointerCapture = function (pid) {
      try {
        return origSet.call(this, pid);
      } catch {
        return;
      }
    };

    const getTargetCanvas = () => {
      const root =
        (targetRef && targetRef.current) ||
        (targetElId ? document.getElementById(targetElId) : null);
      if (!root) return null;
      return root.querySelector("canvas") || root;
    };

    const dispatchPointer = (target, type, clientX, clientY, buttons) => {
      const ev = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        clientX,
        clientY,
        buttons,
        button: buttons ? 0 : -1,
        pressure: buttons ? 0.5 : 0,
      });
      target.dispatchEvent(ev);
    };

    const pointerMoveDownUp = (target, nx, ny, wantDown) => {
      const rect = target.getBoundingClientRect();
      const x = rect.left + nx * rect.width;
      const y = rect.top + ny * rect.height;

      // move
      dispatchPointer(
        target,
        "pointermove",
        x,
        y,
        pointerDownRef.current ? 1 : 0
      );

      // down/up
      if (wantDown && !pointerDownRef.current) {
        dispatchPointer(target, "pointerdown", x, y, 1);
        pointerDownRef.current = true;
      } else if (!wantDown && pointerDownRef.current) {
        dispatchPointer(target, "pointerup", x, y, 0);
        pointerDownRef.current = false;
      }
    };

    async function start() {
      // 1) camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (cancelled) return;

      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();

      // 2) landmarker init (tasks-vision)
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      ); // :contentReference[oaicite:3]{index=3}

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath, // :contentReference[oaicite:4]{index=4}
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      landmarkerRef.current = handLandmarker;

      const loop = () => {
        if (cancelled) return;

        const target = getTargetCanvas();
        const lm = landmarkerRef.current;
        if (!target || !lm || !videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const video = videoRef.current;

        // VIDEO mode: 같은 프레임에 중복 detect 방지
        const nowT = video.currentTime;
        if (nowT === lastVideoTimeRef.current) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        lastVideoTimeRef.current = nowT;

        const ts = performance.now();
        const result = lm.detectForVideo(video, ts);

        const hands = result?.landmarks;
        if (!hands || hands.length === 0) {
          // 손이 사라지면 드래그/줌 상태 정리
          if (pointerDownRef.current) {
            pointerMoveDownUp(target, smoothX.current, smoothY.current, false);
          }
          pinchedRef.current = false;
          lastZoomDistRef.current = null;
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const L = hands[0];
        // landmark index:
        // 4: thumb_tip, 8: index_tip, 12: middle_tip
        const thumb = L[4];
        const index = L[8];
        const middle = L[12];

        // 1) cursor = index tip
        let nx = index.x;
        let ny = index.y;
        if (mirror) nx = 1 - nx;

        // smoothing
        const a = 0.25;
        smoothX.current = smoothX.current + (nx - smoothX.current) * a;
        smoothY.current = smoothY.current + (ny - smoothY.current) * a;

        // 2) pinch = drag
        const dxP = (mirror ? (1 - thumb.x) : thumb.x) - (mirror ? (1 - index.x) : index.x);
        const dyP = thumb.y - index.y;
        const pinchDist = Math.hypot(dxP, dyP);

        if (!pinchedRef.current && pinchDist < pinchOn) pinchedRef.current = true;
        else if (pinchedRef.current && pinchDist > pinchOff) pinchedRef.current = false;

        // 3) zoom = index-middle distance (요청: 가까워지면 줌아웃, 멀어지면 줌인)
        const ix = mirror ? (1 - index.x) : index.x;
        const mx = mirror ? (1 - middle.x) : middle.x;
        const zoomDist = Math.hypot(ix - mx, index.y - middle.y);

        if (lastZoomDistRef.current == null) {
          lastZoomDistRef.current = zoomDist;
        } else {
          const diff = zoomDist - lastZoomDistRef.current; // +면 벌어짐(줌인)
          lastZoomDistRef.current = zoomDist;

          // 민감도 (환경 따라 조정)
          const sensitivity = 1.8; // 권장 1.0~3.0
          const delta = diff * sensitivity;

          if (Math.abs(delta) > 0.002) {
            // orthographic: zoom 증가 => 확대(줌인)
            zoomApiRef?.current?.zoomBy?.(delta);
          }
        }

        // 4) dispatch pointer events (drag only when pinched)
        pointerMoveDownUp(target, smoothX.current, smoothY.current, pinchedRef.current);

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    }

    start().catch((e) => console.error("HandInputProvider init failed:", e));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      // 상태 정리
      pointerDownRef.current = false;
      pinchedRef.current = false;
      lastZoomDistRef.current = null;
      landmarkerRef.current = null;

      // 카메라 종료
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      // 전역 패치 원복
      Element.prototype.releasePointerCapture = origRel;
      Element.prototype.setPointerCapture = origSet;
    };
  }, [enabled, targetElId, targetRef, mirror, modelPath, zoomApiRef]);

  return <video ref={videoRef} playsInline muted className="hidden" />;
}

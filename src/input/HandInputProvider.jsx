// input/HandInputProvider.jsx
import { useEffect, useRef } from "react";

// Basic HandInputProvider
// - Accepts `targetElId` OR `targetRef` (prefer `targetRef`) to find a target element
// - Performs a lightweight motion-based finger proxy (frame-diff centroid)
// - Dispatches synthetic PointerEvents (pointermove / pointerdown / pointerup)
// This is intentionally minimal so a real hand-estimation engine can be plugged in
// later where marked with `// TODO: replace with proper hand model`.
export function HandInputProvider({ targetElId, targetRef }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const prevFrame = useRef(null);
  const pointerActive = useRef(false);
  const pointerId = 9999; // fixed synthetic pointer id

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // 1) 카메라 스트림 시작
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      if (cancelled) return;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const off = document.createElement("canvas");
      const w = 160;
      const h = 120;
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d");

      const getTargetCanvas = () => {
        const target = (targetRef && targetRef.current) || document.getElementById(targetElId);
        if (!target) return null;
        // react-three-fiber renders a <canvas> inside the wrapper
        return target.querySelector("canvas") || target;
      };

      // loop: cheap frame-diff centroid to approximate moving fingertip
      const loop = () => {
        if (cancelled) return;
        try {
          ctx.drawImage(videoRef.current, 0, 0, w, h);
          const id = ctx.getImageData(0, 0, w, h);
          if (prevFrame.current) {
            const prev = prevFrame.current.data;
            const curr = id.data;
            let sx = 0,
              sy = 0,
              count = 0,
              bright = 0;
            for (let i = 0; i < curr.length; i += 4) {
              const r = curr[i],
                g = curr[i + 1],
                b = curr[i + 2];
              const pr = prev[i],
                pg = prev[i + 1],
                pb = prev[i + 2];
              const diff = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
              if (diff > 40) {
                const p = i / 4;
                const x = p % w;
                const y = Math.floor(p / w);
                sx += x;
                sy += y;
                count++;
                bright += diff;
              }
            }

            if (count > 4) {
              const cx = sx / count;
              const cy = sy / count;
              const nx = Math.max(0, Math.min(1, cx / w));
              const ny = Math.max(0, Math.min(1, cy / h));
              // determine pinch by bright / count heuristic (small bright area -> fingertip -> pinch)
              const pinch = bright / count < 80 ? true : false;

              const targetCanvas = getTargetCanvas();
              if (targetCanvas) {
                dispatchVirtualPointer(targetCanvas, { x: nx, y: ny, pinch });
              }
            } else {
              // no motion: if pointerActive, end it
              const targetCanvas = getTargetCanvas();
              if (targetCanvas && pointerActive.current) {
                dispatchVirtualPointer(targetCanvas, { x: 0, y: 0, pinch: false, clearOnly: true });
              }
            }
          }
          prevFrame.current = id;
        } catch (e) {
          // swallow intermittent errors (e.g. when video not ready)
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    }

    start().catch((e) => {
      console.error("HandInputProvider start failed:", e);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop()); // 중요: 카메라 LED 꺼짐
      streamRef.current = null;
    };
  }, [targetElId, targetRef]);

  function dispatchVirtualPointer(target, { x, y, pinch, clearOnly = false }) {
    try {
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + x * rect.width;
      const clientY = rect.top + y * rect.height;

      const makeEvent = (type, opts = {}) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          // Use mouse-like pointer to avoid touch multi-pointer branches
          pointerType: opts.pointerType || "mouse",
          clientX,
          clientY,
          isPrimary: true,
          buttons: opts.buttons ?? 0,
          pressure: opts.pressure ?? (opts.buttons ? 0.5 : 0),
        });

      if (clearOnly) {
        if (pointerActive.current) {
          target.dispatchEvent(makeEvent("pointerup"));
          pointerActive.current = false;
        }
        return;
      }

      // For hover-only motion we emit simple mouse move (no buttons)
      if (!pointerActive.current) {
        target.dispatchEvent(makeEvent("pointermove", { pointerType: "mouse", buttons: 0 }));
      } else {
        // active drag -> send pointermove with button pressed
        target.dispatchEvent(makeEvent("pointermove", { pointerType: "mouse", buttons: 1 }));
      }

      if (pinch && !pointerActive.current) {
        // start (mouse button down)
        target.dispatchEvent(makeEvent("pointerdown", { pointerType: "mouse", buttons: 1 }));
        pointerActive.current = true;
      } else if (!pinch && pointerActive.current) {
        // end (mouse button up)
        target.dispatchEvent(makeEvent("pointerup", { pointerType: "mouse", buttons: 0 }));
        pointerActive.current = false;
      }
    } catch (e) {
      // ignore dispatch errors
    }
  }

  return (
    <video ref={videoRef} playsInline muted className="hidden" />
  );
}

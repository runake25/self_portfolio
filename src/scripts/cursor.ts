/**
 * Custom cursor: a dot that tracks the pointer and a ring that trails it.
 *
 * Performance notes (this used to cost ~165 style recalcs/sec even when idle):
 * - The animation loop only runs while the ring is still catching up. Once it
 *   settles, we stop requesting frames, so an idle page does zero work.
 * - Only `transform` / `scale` change, which the compositor handles without
 *   layout or paint.
 * - The easing is time-based, so the ring feels the same on 60 Hz and 165 Hz screens.
 * - It never runs on touch devices.
 */
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const INTERACTIVE = "a, button, [role='button'], summary, label, input, textarea, select";

export function initCursor() {
  if (!finePointer.matches) return;

  const root = document.documentElement;
  let dot = document.querySelector<HTMLElement>(".cursor-dot");
  let ring = document.querySelector<HTMLElement>(".cursor-ring");
  if (!dot || !ring) return;

  // `cursor: none` is only applied once this class is set, so the native cursor
  // never disappears without a replacement (e.g. if JS fails to load).
  root.classList.add("has-custom-cursor");

  let mouseX = 0;
  let mouseY = 0;
  let ringX = 0;
  let ringY = 0;
  let frame = 0;
  let lastTime = 0;
  let seen = false;

  const place = (el: HTMLElement, x: number, y: number) => {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const step = (time: number) => {
    const dt = lastTime ? Math.min(time - lastTime, 64) : 16.67;
    lastTime = time;
    // 0.12 per 60 Hz frame, converted to an amount per elapsed millisecond.
    const follow = reducedMotion.matches ? 1 : 1 - Math.pow(1 - 0.12, dt / 16.67);
    ringX += (mouseX - ringX) * follow;
    ringY += (mouseY - ringY) * follow;

    const settled = Math.abs(mouseX - ringX) < 0.1 && Math.abs(mouseY - ringY) < 0.1;
    if (settled) {
      ringX = mouseX;
      ringY = mouseY;
    }
    place(ring!, ringX, ringY);

    if (settled) {
      frame = 0;
      lastTime = 0;
    } else {
      frame = requestAnimationFrame(step);
    }
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!seen) {
        // First movement: snap the ring into place instead of flying in from (0, 0).
        seen = true;
        ringX = mouseX;
        ringY = mouseY;
      }
      place(dot!, mouseX, mouseY);
      root.classList.add("cursor-visible");
      if (!frame) frame = requestAnimationFrame(step);
    },
    { passive: true },
  );

  // `mouseover` fires only when the pointer crosses into a new element, which is
  // far cheaper than running closest() on every mousemove.
  document.addEventListener(
    "mouseover",
    (event) => {
      const interactive = (event.target as Element | null)?.closest?.(INTERACTIVE);
      root.classList.toggle("cursor-on-interactive", Boolean(interactive));
    },
    { passive: true },
  );

  root.addEventListener("mouseleave", () => root.classList.remove("cursor-visible"));

  // The elements are marked transition:persist, but re-query in case a page
  // swap ever replaces them.
  document.addEventListener("astro:after-swap", () => {
    dot = document.querySelector(".cursor-dot") ?? dot;
    ring = document.querySelector(".cursor-ring") ?? ring;
  });
}

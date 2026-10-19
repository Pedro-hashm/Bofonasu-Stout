import { animate } from "motion/mini";
import { onCleanup, onMount } from "solid-js";

/** Native browser animations with a single accessible entrance vocabulary. */
export function animateEntrance(element: HTMLElement, enabled = true) {
  if (!enabled || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  // Refs run before insertion. Start only after mounting, and never make
  // functional content transparent while a background webview pauses frames.
  onMount(() => {
    const animation = animate(
      element,
      {
        transform: ["translateY(12px) scale(.985)", "translateY(0) scale(1)"],
      },
      { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
    );
    onCleanup(() => animation.cancel());
  });
}

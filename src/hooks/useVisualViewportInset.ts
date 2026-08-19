"use client";

import { useEffect, useState } from "react";

/**
 * Height (CSS px) of the viewport area occluded by the on-screen keyboard.
 *
 * iOS WKWebView does NOT resize the layout viewport when the keyboard opens —
 * `window.innerHeight` stays put and the keyboard simply slides over fixed
 * bottom UI (2026-08-18 field failure: the pickup-confirmation sheet). What
 * the WebView DOES update is `window.visualViewport`, so the occlusion is:
 *
 *   innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * (offsetTop accounts for the visual viewport being scrolled/pinned below the
 * layout viewport's top). Clamped to ≥ 0 because rotation/zoom can briefly
 * report a visual viewport taller than the window.
 *
 * Returns 0 during SSR and on browsers without the visualViewport API — the
 * consumer's padding simply stays at zero, which is the pre-hook behavior.
 */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return; // API unavailable — stay a no-op at 0

    const update = () => {
      const occlusion =
        window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(Math.max(0, Math.round(occlusion)));
    };

    update();
    // `scroll` too: panning the page while the keyboard is up changes
    // offsetTop, which changes how much of the layout viewport is covered.
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

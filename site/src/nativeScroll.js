/**
 * Native scrolling behind the small part of Lenis' API this site uses (scrollTo, stop/start, on("scroll")).
 * Phones and tablets get this instead of Lenis: Lenis listens to touchmove on the whole page with
 * passive: false, so every swipe waits for the main thread (busy drawing the 3D story) and loses its
 * momentum. With this, the browser scrolls on its own, at full speed, with its normal fling.
 */
export function createNativeScroll() {
  const root = document.documentElement;
  const listeners = new Set();
  let stopped = false;
  let frame = 0;
  let glide = null;

  const end = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    glide = null;
    root.classList.remove("lenis-scrolling");
  };
  addEventListener("scroll", () => listeners.forEach((fn) => fn()), { passive: true });
  // a finger on the screen takes over from a menu-link glide (the story intro's own glide can't be interrupted)
  addEventListener("touchstart", () => glide && !glide.force && end(), { passive: true });

  const max = () => root.scrollHeight - innerHeight;
  const jump = (y) => window.scrollTo({ top: y, behavior: "instant" });

  return {
    options: {},
    get animatedScroll() {
      return window.scrollY;
    },
    get isStopped() {
      return stopped;
    },
    on(event, fn) {
      if (event === "scroll") listeners.add(fn);
    },
    stop() {
      stopped = true;
      root.classList.add("is-scroll-locked");
    },
    start() {
      stopped = false;
      root.classList.remove("is-scroll-locked");
    },
    resize() {},
    scrollTo(target, { offset = 0, duration = 1, easing = (t) => t, immediate = false, force = false, onComplete } = {}) {
      if (stopped && !force) return;
      const y0 = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
      const to = Math.max(0, Math.min(max(), y0 + offset));
      end();
      if (immediate || duration <= 0) {
        jump(to);
        onComplete?.();
        return;
      }
      const from = window.scrollY;
      const start = performance.now();
      glide = { force };
      root.classList.add("lenis-scrolling");
      const step = (now) => {
        const t = Math.min(1, (now - start) / (duration * 1000));
        jump(from + (to - from) * easing(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else {
          end();
          onComplete?.();
        }
      };
      frame = requestAnimationFrame(step);
    },
  };
}

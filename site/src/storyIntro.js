/**
 * The opening globe is a single step: shortly after the intro it glides down to Elfin Nebula by itself,
 * and one scroll (a wheel flick or a slow scroll, a swipe, an arrow/page key) does it at once; one scroll
 * up from there glides back to the globe. Everywhere else the page scrolls freely.
 * Wheel input comes through Lenis' virtualScroll hook; touch and keys are handled here.
 */
// a sine ease: smooth start and finish over a short glide
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export function initStoryIntro({ lenis, story, stop, duration = 1.5 }) {
  let animating = false;
  let pending = 0; // a scroll made while the page was still loading, played once scrolling is allowed
  let lastWheel = 0; // trackpad inertia keeps firing wheel events after a gesture; wait for it to stop
  const stopY = () => story.offsetTop + (story.offsetHeight - innerHeight) * stop;
  // the globe stretch of the page, in the direction of travel
  const inGlobe = (y, dir) => (dir > 0 ? y < stopY() - 4 : y > 1 && y <= stopY() + 4);

  function go(dir) {
    animating = true;
    lenis.scrollTo(dir > 0 ? stopY() : 0, {
      duration,
      easing: ease,
      // not `lock`: a lock that is never released (the glide interrupted by a menu link) freezes the page.
      // Input during the glide is held back by the handlers below instead.
      force: true,
      onComplete: () => {
        animating = false;
        lastWheel = performance.now();
      },
    });
  }

  // while the intro is still on screen, remember the first scroll instead of dropping it
  const hold = (dir) => {
    if (!pending && dir && lenis.animatedScroll < 2) pending = dir > 0 ? 1 : 0;
  };

  lenis.options.virtualScroll = ({ deltaY, event }) => {
    if (event.type !== "wheel") return true;
    const dir = Math.sign(deltaY);
    if (lenis.isStopped) {
      hold(dir);
      return true;
    }
    if (!dir || (!animating && !inGlobe(lenis.animatedScroll, dir))) return true;
    event.preventDefault();
    const now = performance.now();
    if (!animating && now - lastWheel > 160) go(dir);
    lastWheel = now;
    return false;
  };

  let touchY = null;
  let swiped = false;
  addEventListener("touchstart", (e) => {
    touchY = e.touches[0].clientY;
    swiped = false;
  }, { passive: true });
  const onTouchMove = (e) => {
    if (touchY == null) return;
    const dy = touchY - e.touches[0].clientY;
    const dir = Math.sign(dy);
    if (lenis.isStopped) {
      if (Math.abs(dy) > 20) hold(dir);
      return;
    }
    if (!dir || (!animating && !inGlobe(scrollY, dir))) return;
    if (e.cancelable) e.preventDefault();
    if (!swiped && !animating && Math.abs(dy) > 20) {
      swiped = true;
      go(dir);
    }
  };
  // A non-passive touchmove listener makes the browser wait on this page's JavaScript before every
  // touch scroll, which turns into heavy lag on a phone that is busy drawing the 3D story. It is only
  // needed on the globe stretch, so it is attached there and removed for the rest of the page.
  let touchHooked = false;
  const syncTouchHook = () => {
    const want = lenis.isStopped || animating || scrollY <= stopY() + 4;
    if (want === touchHooked) return;
    touchHooked = want;
    if (want) addEventListener("touchmove", onTouchMove, { passive: false });
    else removeEventListener("touchmove", onTouchMove, { passive: false });
  };
  syncTouchHook();
  lenis.on("scroll", syncTouchHook);
  addEventListener("scroll", syncTouchHook, { passive: true });
  addEventListener("touchend", () => (touchY = null), { passive: true });

  const KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
  addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (!dir || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (lenis.isStopped) return hold(dir);
    if (!animating && !inGlobe(lenis.animatedScroll, dir)) return;
    e.preventDefault();
    if (!animating) go(dir);
  });

  // never come to rest part-way through the dive (scrollbar drag, a resize): settle to whichever end is nearer
  let settle = 0;
  lenis.on("scroll", () => {
    if (animating) return;
    clearTimeout(settle);
    settle = setTimeout(() => {
      const y = lenis.animatedScroll;
      const s = stopY();
      if (animating || lenis.isStopped || touchY != null || y <= 1 || y >= s - 2) return;
      animating = true;
      lenis.scrollTo(y < s / 2 ? 0 : s, { duration: 1, easing: ease, force: true, onComplete: () => (animating = false) });
    }, 220);
  });

  // a menu link or button takes over: the glide (or a pending autoplay) gives way to it
  let autoTimer = 0;
  document.addEventListener("elfin:navigate", () => {
    clearTimeout(autoTimer);
    clearTimeout(settle);
    animating = false;
    pending = 0;
  });

  return {
    /** call once scrolling is allowed: plays a scroll that was made during loading */
    release() {
      if (pending && !animating && lenis.animatedScroll < 2) go(1);
      pending = 0;
    },
    /** after `delay` ms, glide to Elfin Nebula by itself, unless the visitor has already moved */
    autoplay(delay) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (!animating && !lenis.isStopped && lenis.animatedScroll < 2) go(1);
      }, delay);
    },
  };
}

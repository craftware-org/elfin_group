import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource-variable/edu-qld-hand";
import "@fontsource-variable/manrope";
import "./styles/main.css";

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initChapters } from "./chapters.js";
import { initStoryIntro } from "./storyIntro.js";
import { initUI } from "./ui.js";

gsap.registerPlugin(ScrollTrigger);
// Mobile address bars resize the viewport while scrolling; re-measuring then causes jumps.
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.defaults({ ease: "expo.out" });

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- smooth scroll ---------------- */
// Every visit and every reload starts at the hero (the globe), wherever the page was and whatever
// #section is in the address, so the opening glide always plays. ScrollTrigger owns the browser's scroll
// memory (it writes it back on every refresh), so it is switched off through ScrollTrigger itself.
ScrollTrigger.clearScrollMemory("manual");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
window.scrollTo(0, 0);

let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.85, touchMultiplier: 1.3 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToTarget = (target, offset = 0) => {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  // the page may have just grown (a folded section opened): measure it again before scrolling
  lenis?.resize();
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: reduceMotion ? "auto" : "smooth" });
};

/* ---------------- scroll progress line ---------------- */
const progressLine = $("#scrollProgress");
const setProgressLine = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progressLine.style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`;
};
if (lenis) lenis.on("scroll", setProgressLine);
else addEventListener("scroll", setProgressLine, { passive: true });

/* ---------------- story chapters ---------------- */
const CHAPTER_STARTS = [0, 0.3, 0.6, 0.88];
// the Elfin Group copy is gone before the sunlit flash (0.25–0.29) so nothing sits half-built on it
const CHAPTER_GAPS = [0, 0.045, 0, 0];
const chapters = initChapters({ chapters: [...document.querySelectorAll(".chapter")], starts: CHAPTER_STARTS, gaps: CHAPTER_GAPS, reduceMotion });
const rail = [...document.querySelectorAll("#storyRail li")];
const count = $("#storyCount");
let activeChapter = -1;
function chapterIndex(p) {
  let c = 0;
  CHAPTER_STARTS.forEach((s, i) => p >= s - 0.0001 && (c = i));
  return c;
}
function setHud(p) {
  const i = chapterIndex(p);
  if (i === activeChapter) return;
  activeChapter = i;
  rail.forEach((li, k) => li.classList.toggle("is-active", k === i));
  count.textContent = `${i + 1} / ${CHAPTER_STARTS.length}`;
}
chapters.update(0);
setHud(0);

/* ---------------- preloader ---------------- */
const loader = $("#loader");
// the intro holds until the 3D story has loaded (its hairline is decorative, not a progress bar)
const started = performance.now();

let finished = false;
function finishLoading() {
  if (finished) return;
  finished = true;
  // long enough for the wordmark to settle, even on a fast connection
  const wait = Math.max(0, 3000 - (performance.now() - started));
  setTimeout(playEntrance, wait);
}

/** The wordmark opens out and the intro dissolves into the 3D story, which builds itself. */
function playEntrance() {
  // scrolling is allowed as soon as the intro screen has faded, not after the whole entrance has played
  const unlock = () => {
    lenis?.start();
    intro?.release();
  };
  const done = () => {
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    unlock();
    ScrollTrigger.refresh();
    // belt and braces: the page must be at the hero when the intro ends (a late layout shift or the
    // browser's own restore can move it while the intro is on screen)
    if (scrollY > 2 && !document.documentElement.classList.contains("lenis-scrolling")) {
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    }
    if (intro) {
      // the globe and "Elfin Group" hold for a moment, then the dive to Elfin Nebula plays by itself
      intro.autoplay(700);
    } else {
      // reduced motion (often switched on by phone power-saving): no long glide, a direct cut instead
      setTimeout(() => {
        const s = $("#story");
        if (scrollY < 2) window.scrollTo(0, s.offsetTop + (s.offsetHeight - innerHeight) * 0.345);
      }, 1600);
    }
  };
  if (reduceMotion) {
    done();
    chapters.playIntro(gsap);
    return;
  }
  gsap.set(".loader__word span", { animation: "none", opacity: 1 });
  const tl = gsap.timeline({ onComplete: done });
  tl.to(".loader__bar", { opacity: 0, duration: 0.5, ease: "power2.in" })
    .to(".loader__logo", { y: -14, opacity: 0, duration: 0.9, ease: "power2.in" }, 0.05)
    .to(".loader__word span", { opacity: 0, y: -8, duration: 0.8, ease: "power2.in", stagger: 0.08 }, 0)
    .to(loader, { opacity: 0, duration: 1.1, ease: "power2.inOut" }, 0.55)
    .fromTo(".nav__brand", { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out" }, 0.9)
    .fromTo("#storyCanvas", { scale: 1.18, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.6 }, 0.55)
    .add(unlock, 0.8)
    .add(() => chapters.playIntro(gsap), 0.95)
    .fromTo(
      [".nav__links > a", ".nav__parent", ".nav__cta", ".nav__toggle"],
      { y: -18, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1, stagger: 0.06 },
      1.15,
    )
    .fromTo([".story__hud", ".story__skip"], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 1.4);
}

lenis?.stop();
const loaderFailsafe = setTimeout(finishLoading, 9000);

// one scroll from the globe lands on Elfin Nebula (story progress 0.345: the towers' overview)
const intro = lenis ? initStoryIntro({ lenis, story: $("#story"), stop: 0.345 }) : null;

/* ---------------- 3D story ---------------- */
async function bootStory() {
  const { createStory, supportsWebGL } = await import("./story/index.js");
  let story = null;
  ScrollTrigger.create({
    trigger: "#story",
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      if (story) story.setProgress(self.progress);
      else {
        // no WebGL: copy follows raw scroll
        chapters.update(self.progress);
        setHud(self.progress);
      }
    },
  });
  if (!supportsWebGL()) {
    document.documentElement.classList.add("no-webgl");
    return;
  }
  try {
    story = await createStory({
      canvas: $("#storyCanvas"),
      stage: $(".story__stage"),
      labelLayer: $("#storyLabels"),
      haze: $("#storyHaze"),
      onFrame: (p) => {
        chapters.update(p);
        setHud(p);
      },
    });
    const st = ScrollTrigger.getAll().find((t) => t.trigger === $("#story"));
    if (st) story.setProgress(st.progress);
  } catch (err) {
    console.error("[story] falling back to static intro:", err);
    document.documentElement.classList.add("no-webgl");
  }
}

bootStory().finally(() => {
  clearTimeout(loaderFailsafe);
  finishLoading();
});

$("#skipIntro").addEventListener("click", () => scrollToTarget("#about"));

/* ---------------- everything below the story ---------------- */
initUI({ scrollToTarget, reduceMotion, gsap, ScrollTrigger });

/* in-page anchor links go through Lenis */
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  document.dispatchEvent(new CustomEvent("elfin:navigate"));
  // the address is left as it is: a #section in it would turn every later reload into a deep link
  scrollToTarget(el);
});

document.fonts?.ready.then(() => ScrollTrigger.refresh());

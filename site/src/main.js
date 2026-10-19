import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource-variable/manrope";
import "./styles/main.css";

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initChapters } from "./chapters.js";
import { initUI } from "./ui.js";

gsap.registerPlugin(ScrollTrigger);
// Mobile address bars resize the viewport while scrolling; re-measuring then causes jumps.
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.defaults({ ease: "expo.out" });

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.85, touchMultiplier: 1.3 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToTarget = (target) => {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
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
const CHAPTER_STARTS = [0, 0.12, 0.4, 0.63, 0.82];
const chapters = initChapters({ chapters: [...document.querySelectorAll(".chapter")], starts: CHAPTER_STARTS, reduceMotion });
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
const loaderBar = $("#loaderBar");
const loaderPct = $("#loaderPct");
const started = performance.now();
let shown = 0;
function setLoad(v) {
  shown = Math.max(shown, v);
  loaderBar.style.transform = `scaleX(${shown.toFixed(3)})`;
  loaderPct.textContent = `${Math.round(shown * 100)}%`;
}

let finished = false;
function finishLoading() {
  if (finished) return;
  finished = true;
  setLoad(1);
  const wait = Math.max(0, 1100 - (performance.now() - started));
  setTimeout(playEntrance, wait);
}

/** Loader irises shut into the nav logo, then the hero builds itself. */
function playEntrance() {
  const badge = $(".loader__badge");
  const brand = $(".nav__brand");
  const b = badge.getBoundingClientRect();
  const n = brand.getBoundingClientRect();
  const cx = n.left + n.width / 2;
  const cy = n.top + n.height / 2;
  const done = () => {
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    lenis?.start();
    ScrollTrigger.refresh();
  };
  if (reduceMotion) {
    done();
    chapters.playIntro(gsap);
    return;
  }
  const tl = gsap.timeline({ onComplete: done });
  tl.to([".loader__bar", ".loader__label"], { opacity: 0, y: 10, duration: 0.5, ease: "power2.in" })
    .to(
      badge,
      {
        x: cx - (b.left + b.width / 2),
        y: cy - (b.top + b.height / 2),
        scale: n.width / b.width,
        duration: 1.25,
        ease: "expo.inOut",
      },
      0.15,
    )
    .fromTo(
      loader,
      { clipPath: `circle(150% at ${cx}px ${cy}px)` },
      { clipPath: `circle(0% at ${cx}px ${cy}px)`, duration: 1.35, ease: "expo.inOut" },
      0.3,
    )
    .fromTo("#storyCanvas", { scale: 1.18, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.6 }, 0.55)
    .add(() => chapters.playIntro(gsap), 0.95)
    .fromTo(
      [".nav__links a", ".nav__cta", ".nav__toggle"],
      { y: -18, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1, stagger: 0.06 },
      1.15,
    )
    .fromTo([".story__hud", ".story__skip"], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 1.4)
    .set(badge, { opacity: 0 });
}

lenis?.stop();
const loaderFailsafe = setTimeout(finishLoading, 9000);

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
      onLoadProgress: (v) => setLoad(0.1 + v * 0.85),
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

setLoad(0.05);
bootStory().finally(() => {
  clearTimeout(loaderFailsafe);
  finishLoading();
});

$("#skipIntro").addEventListener("click", () => scrollToTarget("#about"));

/* ---------------- everything below the story ---------------- */
initUI({ scrollToTarget, reduceMotion, gsap, ScrollTrigger, lenis });

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
  scrollToTarget(el);
  history.replaceState(null, "", id);
});

document.fonts?.ready.then(() => ScrollTrigger.refresh());

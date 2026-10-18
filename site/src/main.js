import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource-variable/manrope";
import "./styles/main.css";

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initUI } from "./ui.js";

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToTarget = (target) => {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
  else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
};

/* ---------------- preloader ---------------- */
const loader = $("#loader");
const loaderBar = $("#loaderBar");
const loaderPct = $("#loaderPct");
const started = performance.now();
let shown = 0;
function setLoad(v) {
  shown = Math.max(shown, v);
  loaderBar.style.width = `${Math.round(shown * 100)}%`;
  loaderPct.textContent = `${Math.round(shown * 100)}%`;
}
function finishLoading() {
  setLoad(1);
  const wait = Math.max(0, 900 - (performance.now() - started));
  setTimeout(() => {
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    lenis?.start();
    ScrollTrigger.refresh();
  }, wait);
}
lenis?.stop();
// never leave visitors stuck behind the loader
const loaderFailsafe = setTimeout(finishLoading, 9000);

/* ---------------- 3D story ---------------- */
const chapters = [...document.querySelectorAll(".chapter")];
const rail = [...document.querySelectorAll("#storyRail li")];
const count = $("#storyCount");
let activeChapter = 0;
function setChapter(i) {
  if (i === activeChapter) return;
  chapters[activeChapter]?.classList.remove("is-active");
  chapters[activeChapter]?.classList.add("is-leaving");
  const prev = chapters[activeChapter];
  setTimeout(() => prev?.classList.remove("is-leaving"), 700);
  activeChapter = i;
  chapters[i].classList.add("is-active");
  rail.forEach((li, k) => li.classList.toggle("is-active", k === i));
  count.textContent = `${i + 1} / ${chapters.length}`;
}

async function bootStory() {
  const { createStory, supportsWebGL, chapterAt } = await import("./story/index.js");
  let story = null;
  ScrollTrigger.create({
    trigger: "#story",
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      story?.setProgress(self.progress);
      setChapter(chapterAt(self.progress));
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
      flash: $("#storyFlash"),
      onLoadProgress: (v) => setLoad(0.1 + v * 0.85),
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
  scrollToTarget(el);
  history.replaceState(null, "", id);
});

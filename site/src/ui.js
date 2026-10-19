import { LOCATIONS } from "./data.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WHATSAPP = import.meta.env.VITE_WHATSAPP || "918147284999";
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Element with a class and plain-text content (never parsed as HTML). */
function node(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function initUI({ scrollToTarget, reduceMotion, gsap, ScrollTrigger, lenis }) {
  $("#year").textContent = String(new Date().getFullYear());
  initNav(ScrollTrigger);
  initSplit();
  initReveal();
  initCounters(gsap, reduceMotion);
  initFilters();
  initMap();
  initPlan();
  initForm(scrollToTarget);
  if (!reduceMotion) {
    initMarquees(gsap, lenis);
    initStoryExit(gsap);
    initExpandingSections(gsap);
    initParallax(gsap);
  }
  if (finePointer && !reduceMotion) {
    initMagnetic(gsap);
    initTilt(gsap);
  }
}

/* ---------------- nav ---------------- */
function initNav(ScrollTrigger) {
  const nav = $("#nav");
  const story = $("#story");
  const wa = $("#waFloat");
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  const bar = $("#actionBar");
  let lastY = 0;
  let contactInView = false;
  let menuOpen = false;
  const syncBar = (pastStory) => bar.classList.toggle("is-visible", pastStory && !contactInView && !menuOpen);
  let pastStoryNow = false;
  new IntersectionObserver(([en]) => {
    contactInView = en.isIntersecting;
    syncBar(pastStoryNow);
  }, { rootMargin: "0px 0px -35% 0px" }).observe($("#contact"));

  // Driven by plain scroll events as well as ScrollTrigger, and once on load, so the nav,
  // WhatsApp button and phone action bar are right even after a jump (anchor, reload mid-page).
  const onScroll = () => {
    const y = window.scrollY;
    const pastStory = y > story.offsetTop + story.offsetHeight - nav.offsetHeight;
    nav.classList.toggle("is-solid", pastStory);
    nav.classList.toggle("is-hidden", pastStory && y > lastY + 4 && !menuOpen);
    if (y < lastY - 4) nav.classList.remove("is-hidden");
    wa.classList.toggle("is-visible", pastStory);
    pastStoryNow = pastStory;
    syncBar(pastStory);
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: onScroll });
  addEventListener("load", onScroll);
  onScroll();

  [...menu.querySelectorAll("nav a"), menu.querySelector(".btn"), menu.querySelector(".mobile-menu__phone")].forEach((el, i) =>
    el.style.setProperty("--i", i),
  );
  // the menu irises open from the toggle button
  const setMenu = (open) => {
    if (open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-menu", open);
    nav.classList.remove("is-hidden");
    document.body.style.overflow = open ? "hidden" : "";
    syncBar(pastStoryNow);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
    } else {
      menu.classList.remove("is-open");
      setTimeout(() => !menuOpen && (menu.hidden = true), 800);
    }
  };
  toggle.addEventListener("click", () => setMenu(!menuOpen));
  document.addEventListener("elfin:navigate", () => setMenu(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && menuOpen && setMenu(false));
  matchMedia("(min-width: 1024px)").addEventListener("change", (e) => e.matches && setMenu(false));

  // highlight the section in view
  const links = $$(".nav__links a");
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === `#${en.target.id}`));
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  ["about", "projects", "locations", "plots", "progress", "contact"].forEach((id) => io.observe(document.getElementById(id)));
}

/* ---------------- kinetic headings ---------------- */
function initSplit() {
  for (const el of $$("[data-split]")) {
    let i = 0;
    const wrap = (text) => {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(" ");
        const outer = document.createElement("span");
        outer.className = "split-word";
        const inner = document.createElement("span");
        inner.style.setProperty("--i", i++);
        inner.textContent = part;
        outer.append(inner);
        frag.append(outer);
      });
      return frag;
    };
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3) node.replaceWith(wrap(node.textContent));
      else if (node.nodeType === 1) {
        const text = node.textContent;
        node.textContent = "";
        node.append(wrap(text));
      }
    }
    for (const child of el.children) child.setAttribute("aria-hidden", "true");
    el.dataset.reveal = "";
  }
}

function initReveal() {
  const els = $$("[data-reveal]");
  // stagger siblings that reveal together
  const groups = new Map();
  for (const el of els) {
    const key = el.parentElement;
    const n = groups.get(key) || 0;
    if (!el.hasAttribute("data-split")) el.style.setProperty("--d", `${Math.min(n, 6) * 0.08}s`);
    groups.set(key, n + 1);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const el = en.target;
          el.classList.add("is-in");
          io.unobserve(el);
          setTimeout(() => el.style.setProperty("--d", "0s"), 2400);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  els.filter((el) => el.dataset.reveal !== "clip").forEach((el) => io.observe(el));

  // A fully closed clip-path has no visible area, so IntersectionObserver never reports the
  // element itself. Watch its container instead and open every mask inside it.
  const clipGroups = new Map();
  for (const el of els.filter((e) => e.dataset.reveal === "clip")) {
    const host = el.parentElement;
    if (!clipGroups.has(host)) clipGroups.set(host, []);
    clipGroups.get(host).push(el);
  }
  const clipIo = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        clipIo.unobserve(en.target);
        for (const el of clipGroups.get(en.target)) {
          el.classList.add("is-in");
          setTimeout(() => el.style.setProperty("--d", "0s"), 2600);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0 },
  );
  clipGroups.forEach((_els, host) => clipIo.observe(host));
}

/* ---------------- stats ---------------- */
function initCounters(gsap, reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const el = en.target;
        const end = Number(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const fmt = (v) => `${Math.round(v).toLocaleString("en-IN")}${suffix}`;
        if (reduceMotion) {
          el.textContent = fmt(end);
          continue;
        }
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: 2.2, ease: "power3.out", onUpdate: () => (el.textContent = fmt(o.v)) });
      }
    },
    { threshold: 0.6 },
  );
  $$("[data-count]").forEach((el) => io.observe(el));
}

/* ---------------- project filters ---------------- */
function initFilters() {
  const buttons = $$(".filters .filter");
  const cards = $$("#projectGrid .project");
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const f = b.dataset.filter;
      buttons.forEach((x) => {
        x.classList.toggle("is-active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      cards.forEach((c) => {
        const show = f === "all" || c.dataset.tags.split(" ").includes(f);
        c.classList.toggle("is-filtered", !show);
        if (show) c.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "cubic-bezier(.22,1,.36,1)" });
      });
    }),
  );
}

/* ---------------- locations map ---------------- */
function initMap() {
  const pins = $("#mapPins");
  const chips = $("#mapChips");
  const panel = $("#mapPanel");

  const render = (loc) => {
    const actions = node("div", "map__panel-actions");
    const enquire = node("a", "btn btn--gold btn--sm", "Enquire");
    enquire.href = "#contact";
    enquire.dataset.enquire = loc.enquire;
    actions.append(enquire);
    if (loc.maps) {
      const maps = node("a", "btn btn--line btn--sm", "Open in Google Maps");
      maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.maps)}`;
      maps.target = "_blank";
      maps.rel = "noopener";
      actions.append(maps);
    }
    panel.replaceChildren(
      node("span", `badge${loc.badge ? ` badge--${loc.badge}` : ""}`, loc.status),
      node("p", "project__kicker", loc.kicker),
      node("h3", "", loc.name),
      node("p", "", loc.text),
      actions,
    );
    [...panel.children].forEach((child, i) =>
      child.animate(
        [{ opacity: 0, transform: "translateY(18px)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
        { duration: 800, delay: i * 70, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" },
      ),
    );
  };

  const select = (id) => {
    const loc = LOCATIONS.find((l) => l.id === id);
    if (!loc) return;
    $$(".map-pin", pins).forEach((p) => p.classList.toggle("is-active", p.dataset.id === id));
    $$(".filter", chips).forEach((c) => c.setAttribute("aria-selected", String(c.dataset.id === id)));
    render(loc);
  };

  for (const loc of LOCATIONS) {
    if (loc.x != null) {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "map-pin";
      pin.dataset.id = loc.id;
      pin.style.left = `${loc.x}%`;
      pin.style.top = `${loc.y}%`;
      pin.style.setProperty("--i", pins.children.length);
      pin.setAttribute("aria-label", `${loc.name}, ${loc.kicker}`);
      pin.append(node("span", "map-pin__dot"), node("span", "map-pin__name", loc.short));
      pin.addEventListener("click", () => select(loc.id));
      pins.append(pin);
    }
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter";
    chip.setAttribute("role", "tab");
    chip.dataset.id = loc.id;
    chip.textContent = loc.name.replace(" · Office", "");
    chip.addEventListener("click", () => select(loc.id));
    chips.append(chip);
  }
  select("nebula");
}

/* ---------------- sample plot plan ---------------- */
function initPlan() {
  const svg = $("#planSvg");
  const tip = $("#planTip");
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };

  el("rect", { x: 0, y: 0, width: 640, height: 400, fill: "#f6efe0" });
  el("rect", { class: "park", x: 40, y: 20, width: 560, height: 70, rx: 10 });
  el("text", { class: "park-label", x: 320, y: 60, "text-anchor": "middle" }).textContent = "PARK & OPEN SPACE";
  el("rect", { class: "park", x: 40, y: 310, width: 560, height: 70, rx: 10 });
  el("text", { class: "park-label", x: 320, y: 350, "text-anchor": "middle" }).textContent = "AMENITY AREA";
  el("rect", { class: "road", x: 0, y: 190, width: 640, height: 20 });
  el("rect", { class: "road", x: 305, y: 96, width: 30, height: 208 });
  el("path", { class: "road-mark", d: "M0 200H640M320 96V304" });
  el("rect", { class: "gate", x: 0, y: 184, width: 10, height: 32, rx: 2 });

  // avenue trees
  let t = 0;
  for (let x = 50; x < 600; x += 26) {
    if (x > 296 && x < 344) continue;
    for (const cy of [99, 301]) el("circle", { class: "tree", cx: x, cy, r: 4, style: `--i:${t++}` });
  }

  const cols = [40, 77, 114, 151, 188, 225, 262, 341, 378, 415, 452, 489, 526, 563];
  const rows = [104, 147, 213, 256];
  let n = 0;
  const plots = [];
  for (const y of rows) {
    for (const x of cols) {
      n++;
      const g = el("g", {});
      const r = el("rect", { class: "plot", x, y, width: 34, height: 40, rx: 2, tabindex: 0, role: "button", "aria-label": `Plot ${n}` }, g);
      r.style.setProperty("--i", (x - 40) / 37 + rows.indexOf(y) * 3);
      r.dataset.n = n;
      el("text", { class: "plot-no", x: x + 17, y: y + 24, "text-anchor": "middle" }, g).textContent = n;
      plots.push(r);
    }
  }

  const fig = svg.parentElement;
  const showTip = (r, label) => {
    const box = r.getBoundingClientRect();
    const host = fig.getBoundingClientRect();
    tip.hidden = false;
    tip.textContent = label;
    tip.style.left = `${box.left - host.left + box.width / 2}px`;
    tip.style.top = `${box.top - host.top}px`;
  };
  let picked = plots[30];
  const pick = (r) => {
    picked?.classList.remove("is-picked");
    picked = r;
    r.classList.add("is-picked");
    showTip(r, `Plot ${r.dataset.n} · selected`);
  };
  plots.forEach((r) => {
    r.addEventListener("mouseenter", () => showTip(r, `Plot ${r.dataset.n}`));
    r.addEventListener("mouseleave", () => picked && showTip(picked, `Plot ${picked.dataset.n} · selected`));
    r.addEventListener("click", () => pick(r));
    r.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(r)));
  });
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) {
      pick(picked);
      io.disconnect();
    }
  });
  io.observe(svg);
  window.addEventListener("resize", () => picked && !tip.hidden && showTip(picked, tip.textContent));
  const scroller = $(".plan__scroller");
  const hint = $(".plan__hint");
  scroller.addEventListener(
    "scroll",
    () => {
      if (picked && !tip.hidden) showTip(picked, tip.textContent);
      hint.style.opacity = "0";
    },
    { passive: true },
  );
}

/* ---------------- contact → WhatsApp ---------------- */
function initForm(scrollToTarget) {
  const form = $("#leadForm");
  const err = $("#formError");
  const interest = $("#interest");

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-enquire]");
    if (!b) return;
    const want = b.dataset.enquire;
    const opt = [...interest.options].find((o) => o.text === want);
    if (opt) interest.value = opt.value;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const name = String(data.name || "").trim();
    const phone = String(data.phone || "").replace(/[^\d+]/g, "");
    const problems = [];
    form.name.setAttribute("aria-invalid", String(name.length < 2));
    form.phone.setAttribute("aria-invalid", String(!/^\+?\d{10,13}$/.test(phone)));
    if (name.length < 2) problems.push("your name");
    if (!/^\+?\d{10,13}$/.test(phone)) problems.push("a valid phone number");
    if (problems.length) {
      err.hidden = false;
      err.textContent = `Please add ${problems.join(" and ")}.`;
      (name.length < 2 ? form.name : form.phone).focus();
      return;
    }
    err.hidden = true;
    const lines = [
      "Hi Elfin Group,",
      `I'm ${name} (${phone}).`,
      `I'm interested in: ${data.interest}.`,
      String(data.message || "").trim(),
    ].filter(Boolean);
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  });

  const hello = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi Elfin Group, I'd like to know more about your projects.")}`;
  $("#waFloat").href = hello;
  $("#actionWa").href = hello;
  void scrollToTarget;
}

/* ---------------- micro-interactions ---------------- */
function initMagnetic(gsap) {
  for (const el of $$("[data-magnetic]")) {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  }
}

function initTilt(gsap) {
  for (const el of $$("[data-tilt]")) {
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 8);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
    });
    el.addEventListener("pointerleave", () => {
      rx(0);
      ry(0);
    });
  }
}

function initParallax(gsap) {
  for (const img of $$(".about__media img, .shot img, .project__media img")) {
    gsap.fromTo(
      img,
      { yPercent: -6, scale: 1.14 },
      { yPercent: 6, scale: 1.14, ease: "none", scrollTrigger: { trigger: img.closest("figure, .project__media"), scrub: 0.6 } },
    );
  }
}

/* ---------------- scroll-velocity marquees ---------------- */
function initMarquees(gsap, lenis) {
  const tracks = $$("[data-velocity-marquee]").map((el) => ({ el, dir: Number(el.dataset.velocityMarquee) || 1, x: 0, skew: 0, w: 0 }));
  const measure = () => tracks.forEach((t) => (t.w = t.el.scrollWidth / 2));
  measure();
  addEventListener("resize", measure);
  let velocity = 0;
  lenis?.on("scroll", (l) => (velocity = l.velocity));
  gsap.ticker.add((_time, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    const boost = Math.max(-40, Math.min(40, velocity));
    for (const t of tracks) {
      t.x -= t.dir * (60 + Math.abs(boost) * 26) * dt * Math.sign(boost || 1);
      if (t.w) t.x = ((t.x % t.w) - t.w) % t.w;
      t.skew += (boost * -0.35 - t.skew) * Math.min(1, dt * 6);
      t.el.style.transform = `translate3d(${t.x.toFixed(2)}px, 0, 0) skewX(${t.skew.toFixed(2)}deg)`;
    }
    velocity *= 0.92;
  });
}

/* ---------------- story recedes into a card as the page arrives ---------------- */
function initStoryExit(gsap) {
  const stage = $(".story__stage");
  gsap.timeline({ scrollTrigger: { trigger: "#story", start: "bottom bottom", end: "bottom top", scrub: 0.8 } })
    .to(stage, { scale: 0.86, borderRadius: 36, ease: "none" }, 0)
    .to(".story__dim", { opacity: 0.55, ease: "none" }, 0);
}

/* ---------------- dark sections open from a card to full bleed ---------------- */
function initExpandingSections(gsap) {
  const inset = innerWidth < 760 ? 3 : 5;
  for (const el of $$(".progress, .cta-band")) {
    gsap.fromTo(
      el,
      { clipPath: `inset(0% ${inset}% 0% ${inset}% round 40px)` },
      { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 25%", scrub: 0.8 } },
    );
  }
}

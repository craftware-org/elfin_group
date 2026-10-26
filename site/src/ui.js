import { HOMES, LOCATIONS } from "./data.js";
import { PLANS } from "./plans.data.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WHATSAPP = import.meta.env.VITE_WHATSAPP || "918147284999";

/** Element with a class and plain-text content (never parsed as HTML). */
function node(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function initUI({ scrollToTarget, reduceMotion, gsap, ScrollTrigger }) {
  $("#year").textContent = String(new Date().getFullYear());
  initNebulaFold(ScrollTrigger);
  initNav(ScrollTrigger);
  initSplit();
  initReveal();
  initFilters();
  initMap();
  initPlan();
  initHomes(initFloorPlans(scrollToTarget));
  initReel(reduceMotion);
  initCounters(reduceMotion);
  initLocation();
  initForm(scrollToTarget);
  if (!reduceMotion) {
    initStoryExit(gsap);
    initParallax(gsap);
  }
}

/* ---------------- "More about Elfin Nebula" ---------------- */
// Amenities, specifications, location and construction updates stay folded under the floor plans until
// the button opens them. A menu or footer link to one of them opens the fold first; this listener is
// registered before main.js's anchor handler, so the section is laid out by the time it scrolls there.
function initNebulaFold(ScrollTrigger) {
  const btn = $("#nebulaMoreBtn");
  const fold = $("#nebulaMoreSections");
  const label = btn.querySelector(".nebula-more__label");
  const list = $(".nebula-more__list");
  const set = (open) => {
    if (open === !fold.hidden) return;
    fold.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "Less about Elfin Nebula" : "More about Elfin Nebula";
    list.hidden = open;
    fold.classList.toggle("is-opening", open);
    ScrollTrigger.refresh();
  };
  btn.addEventListener("click", () => set(fold.hidden));
  fold.addEventListener("animationend", () => fold.classList.remove("is-opening"));
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    const id = a?.getAttribute("href").slice(1);
    if (id && fold.querySelector(`[id="${id}"]`)) set(true);
  });
}

/* ---------------- nav ---------------- */
function initNav(ScrollTrigger) {
  const nav = $("#nav");
  const story = $("#story");
  const stage = $(".story__stage");
  const wa = $("#waFloat");
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  const bar = $("#actionBar");
  let lastY = 0;
  const wide = matchMedia("(min-width: 1180px)");
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
    const storyEnd = story.offsetTop + story.offsetHeight;
    const pastStory = y > storyEnd - nav.offsetHeight;
    // the fixed 3D stage is fully covered once the story spacer has scrolled away
    stage.classList.toggle("is-off", y >= storyEnd);
    nav.classList.toggle("is-solid", pastStory);
    // on phones and tablets the header always stays in view; on desktop it tucks away while reading
    nav.classList.toggle("is-hidden", wide.matches && pastStory && y > lastY + 4 && !menuOpen);
    if (y < lastY - 4) nav.classList.remove("is-hidden");
    wa.classList.toggle("is-visible", pastStory);
    pastStoryNow = pastStory;
    syncBar(pastStory);
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: onScroll });
  addEventListener("load", onScroll);
  addEventListener("resize", onScroll);
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
  wide.addEventListener("change", (e) => e.matches && setMenu(false));

  // highlight the top-level item for the section in view (all of Elfin Nebula's sections light "Elfin Nebula")
  const links = $$(".nav__links [data-for]");
  const owner = { about: "about", projects: "projects", locations: "projects", plots: "layouts", contact: "contact" };
  for (const id of ["nebula", "homes", "plans", "amenities", "specifications", "location", "progress"]) owner[id] = "nebula";
  // the projects section itself lights nothing; each completed project lights its own name, the layouts "Layouts"
  for (const id of ["castle", "oakwood", "sapphire", "casa"]) owner[`project-${id}`] = `project-${id}`;
  for (const id of ["halyal", "estate", "county", "medows", "heritage", "park"]) owner[`project-${id}`] = "layouts";
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("is-current", a.dataset.for === owner[en.target.id]));
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  Object.keys(owner).forEach((id) => io.observe(document.getElementById(id)));
  // a chosen sub-page closes the dropdown (it stays open on focus otherwise)
  // and stays shut until the pointer leaves it, even though the pointer is still over it
  $$(".nav__menu a").forEach((a) =>
    a.addEventListener("click", () => {
      a.blur();
      a.closest(".nav__group").classList.add("is-shut");
    }),
  );
  $$(".nav__group").forEach((g) => g.addEventListener("pointerleave", () => g.classList.remove("is-shut")));

  // "More about Nebula": the rest of Elfin Nebula's sections fold out under Floor plans
  for (const btn of $$(".nav__more, .mobile-menu__more")) {
    const extra = document.getElementById(btn.getAttribute("aria-controls"));
    const set = (open) => {
      btn.setAttribute("aria-expanded", String(open));
      extra.classList.toggle("is-open", open);
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      set(btn.getAttribute("aria-expanded") !== "true");
    });
    // folded again whenever the dropdown closes, so it always opens on the short list
    btn.closest(".nav__group")?.addEventListener("pointerleave", () => set(false));
    btn.closest(".nav__group")?.addEventListener("focusout", (e) => !e.currentTarget.contains(e.relatedTarget) && set(false));
    document.addEventListener("elfin:navigate", () => set(false));
  }

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

/* ---------------- project filters ---------------- */
// "All projects" first shows the apartments and Elfin Casa; "More projects" reveals the layouts.
// Any other filter shows everything that matches.
function initFilters() {
  const buttons = $$(".filters .filter");
  const cards = $$("#projectGrid .project");
  const more = $("#projectsMore");
  let filter = "all";
  let expanded = false;
  const apply = (animate = true) => {
    for (const c of cards) {
      const match = filter === "all" || c.dataset.tags.split(" ").includes(filter);
      const show = match && (filter !== "all" || expanded || !("more" in c.dataset));
      const was = !c.classList.contains("is-filtered");
      c.classList.toggle("is-filtered", !show);
      if (show && (animate || !was)) c.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "cubic-bezier(.22,1,.36,1)" });
    }
    more.parentElement.hidden = filter !== "all" || expanded;
    more.setAttribute("aria-expanded", String(expanded));
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      buttons.forEach((x) => {
        x.classList.toggle("is-active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      apply();
    }),
  );
  more.addEventListener("click", () => {
    expanded = true;
    apply(false);
  });
  // jumping to one project from a menu: make sure its card is showing first
  document.addEventListener("click", (e) => {
    if (!e.target.closest('a[href^="#project-"], a[href="#plots"]')) return;
    expanded = true;
    $('.filters [data-filter="all"]').click();
  }, true);
  apply(false);
}

/* ---------------- locations map ---------------- */
function initMap() {
  const pins = $("#mapPins");
  const chips = $("#mapChips");
  const panel = $("#mapPanel");

  const render = (loc) => {
    const actions = node("div", "map__panel-actions");
    const enquire = node("a", "btn btn--gold", "Enquire");
    enquire.href = "#contact";
    enquire.dataset.enquire = loc.enquire;
    actions.append(enquire);
    if (loc.url || loc.maps) {
      const maps = node("a", "btn btn--line", "Open in Google Maps");
      maps.href = loc.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.maps)}`;
      maps.target = "_blank";
      maps.rel = "noopener";
      actions.append(maps);
    }
    panel.replaceChildren(
      node("span", loc.badge === "new" ? "badge badge--gold" : "badge", loc.status),
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
    chip.textContent = loc.name;
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
  el("text", { class: "park-label", x: 320, y: 60, "text-anchor": "middle" }).textContent = "Park and open space";
  el("rect", { class: "park", x: 40, y: 310, width: 560, height: 70, rx: 10 });
  el("text", { class: "park-label", x: 320, y: 350, "text-anchor": "middle" }).textContent = "Amenity area";
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

/* ---------------- Elfin Nebula: renders play from morning to night ---------------- */
// The active dot's fill animation is the timer: when it ends, the next view comes in. It pauses
// while the section is off screen, the tab is hidden, or the reader hovers or focuses the copy.
function initReel(reduceMotion) {
  const section = $("#nebula");
  const frames = $$(".reel__frame", section);
  const steps = $$(".reel__step", section);
  const dots = $$(".reel__dots button", section);
  let current = 0;
  const show = (i) => {
    current = (i + frames.length) % frames.length;
    [frames, steps, dots].forEach((list) => list.forEach((el, k) => el.classList.toggle("is-on", k === current)));
    dots.forEach((d, k) => d.setAttribute("aria-pressed", String(k === current)));
  };
  dots.forEach((d, k) => d.addEventListener("click", () => show(k)));

  // all three renders are fetched once the section is close, so the crossfade never waits
  const pre = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    frames.forEach((f) => ($("img", f).loading = "eager"));
    pre.disconnect();
  }, { rootMargin: "120% 0px" });
  pre.observe(section);

  if (reduceMotion) return; // views change only when a dot is chosen
  section.classList.add("is-auto");
  dots.forEach((d) => d.addEventListener("animationend", (e) => e.target.parentElement === d && d.classList.contains("is-on") && show(current + 1)));

  let onScreen = false;
  let held = false;
  const sync = () => section.classList.toggle("is-paused", !onScreen || held || document.hidden);
  new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    sync();
  }, { threshold: 0.35 }).observe(section);
  document.addEventListener("visibilitychange", sync);
  const copy = $(".reel__copy", section);
  copy.addEventListener("pointerenter", () => ((held = true), sync()));
  copy.addEventListener("pointerleave", () => ((held = false), sync()));
  copy.addEventListener("focusin", () => ((held = true), sync()));
  copy.addEventListener("focusout", () => ((held = false), sync()));
  sync();
}

/* ---------------- count-up figures ---------------- */
function initCounters(reduceMotion) {
  if (reduceMotion) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const el = en.target;
        const to = Number(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const t0 = performance.now();
        const dur = 1400 + Math.min(to, 120) * 6;
        const tick = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 4)))}${suffix}`;
          if (k < 1) requestAnimationFrame(tick);
        };
        el.textContent = `0${suffix}`;
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.6 },
  );
  $$("[data-count]").forEach((el) => io.observe(el));
}

/* ---------------- interactive floor plans ---------------- */
const sft = (n) => `${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })} sft`;
const FLOORS = {
  typical: {
    img: "/images/nebula/plan-typical",
    w: 2473,
    h: 1982,
    alt: "Second floor plan, typical for the 2nd to 8th floors, Tower Orchid and Tower Emerald",
    label: "2nd to 8th floor",
    units: PLANS.typical,
  },
  first: {
    img: "/images/nebula/plan-first",
    w: 2598,
    h: 2042,
    alt: "First floor plan, Tower Orchid and Tower Emerald",
    label: "1st floor",
    units: PLANS.first,
  },
  ground: {
    img: "/images/nebula/plan-ground",
    w: 1621,
    h: 1309,
    alt: "Ground floor plan with parking and 11 shops",
    label: "Ground floor",
    units: PLANS.shops,
  },
};

function initFloorPlans(scrollToTarget) {
  const img = $("#planImg");
  const canvas = $("#planCanvas");
  const spots = $("#planSpots");
  const panel = $("#planPanel");
  const scroller = $("#planScroller");
  const hint = $(".viewer__hint");
  const filter = $("#bhkFilter");
  const tabs = $$(".plans__bar [data-floor]");
  const stacked = matchMedia("(max-width: 1023px)");
  let floor = "typical";
  let only = "all";
  let picked = null;

  const isShop = (u) => u.bhk == null;
  const facts = (pairs) => {
    const dl = node("dl", "unit__facts");
    for (const [k, v] of pairs) {
      const row = node("div");
      row.append(node("dt", "", k), node("dd", "", v));
      dl.append(row);
    }
    return dl;
  };

  const renderPanel = (u) => {
    const f = FLOORS[floor];
    const enquire = node("a", "btn btn--gold btn--block", "Enquire about this home");
    enquire.href = "#contact";
    let kids;
    if (!u && floor === "ground") {
      kids = [
        node("p", "unit__kicker", f.label),
        node("h3", "", "Parking & 11 shops"),
        node("p", "", "The ground floor is earmarked for comfortable and well planned parking with hassle free driveways, and commercial space. Tap a shop to see its area."),
        facts([["Shops", "11 · 393.03 to 1,311.12 sft"], ["Car parks", "26"]]),
      ];
    } else if (!u) {
      const counts = { 1: 0, 2: 0, 3: 0 };
      f.units.forEach((x) => counts[x.bhk]++);
      kids = [
        node("p", "unit__kicker", f.label),
        node("h3", "", "14 homes on this floor"),
        node("p", "", "Tap a home on the plan to see its type and super built-up area."),
        facts([
          ["1 BHK", `${counts[1]} home${counts[1] === 1 ? "" : "s"}`],
          ["2 BHK", `${counts[2]} homes`],
          ["3 BHK", `${counts[3]} homes`],
          ["Tower Orchid", `${f.units[0].no} to ${f.units[6].no}`],
          ["Tower Emerald", `${f.units[7].no} to ${f.units[13].no}`],
        ]),
      ];
    } else if (isShop(u)) {
      enquire.textContent = "Enquire about this shop";
      enquire.dataset.enquire = "A shop at Elfin Nebula";
      enquire.dataset.message = `Shop ${u.no} at Elfin Nebula, ground floor (${sft(u.sba)}).`;
      kids = [node("p", "unit__kicker", "Ground floor · Commercial"), node("h3", "", `Shop ${u.no}`), facts([["Area", sft(u.sba)], ["Floor", "Ground"]]), enquire];
    } else {
      enquire.dataset.enquire = `${u.bhk} BHK at Elfin Nebula`;
      enquire.dataset.message = `Flat ${u.no}, Tower ${u.tower}: ${u.bhk} BHK, ${sft(u.sba)} SBA (${f.label}).`;
      kids = [
        node("p", "unit__kicker", `Tower ${u.tower} · ${f.label}`),
        node("h3", "", `Flat ${u.no}`),
        facts([
          ["Type", `${u.bhk} BHK`],
          ["Super built-up area", sft(u.sba)],
          ["Tower", u.tower],
        ]),
        node("p", "unit__who", HOMES[u.bhk].who),
        enquire,
      ];
    }
    panel.replaceChildren(...kids);
    [...panel.children].forEach((child, i) =>
      child.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], {
        duration: 600,
        delay: i * 50,
        easing: "cubic-bezier(.16,1,.3,1)",
        fill: "backwards",
      }),
    );
  };

  const applyFilter = () => {
    for (const b of $$(".spot", spots)) b.classList.toggle("is-dim", only !== "all" && floor !== "ground" && b.dataset.bhk !== only);
  };

  const pick = (u, btn) => {
    picked?.classList.remove("is-picked");
    picked = btn;
    btn.classList.add("is-picked");
    renderPanel(u);
    // stacked layout: the details sit under the plan, so bring them up into view
    const top = panel.getBoundingClientRect().top;
    if (stacked.matches && top > innerHeight * 0.55) scrollToTarget(panel, -innerHeight * 0.3);
  };

  const renderFloor = (key) => {
    floor = key;
    const f = FLOORS[key];
    tabs.forEach((t) => {
      const on = t.dataset.floor === key;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    canvas.style.aspectRatio = `${f.w} / ${f.h}`;
    img.width = f.w;
    img.height = f.h;
    img.alt = f.alt;
    img.onerror = () => {
      img.onerror = null;
      img.src = `${f.img}.jpg`;
    };
    img.src = `${f.img}.webp`;
    filter.classList.toggle("is-off", key === "ground");
    spots.replaceChildren();
    f.units.forEach((u, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `spot ${isShop(u) ? "spot--shop" : `spot--b${u.bhk}`}`;
      b.dataset.bhk = isShop(u) ? "shop" : String(u.bhk);
      b.style.left = `${u.x}%`;
      b.style.top = `${u.y}%`;
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", isShop(u) ? `Shop ${u.no}, ${sft(u.sba)}` : `Flat ${u.no}, ${u.bhk} BHK, ${sft(u.sba)}`);
      b.append(node("span", "spot__no", isShop(u) ? `Shop ${u.no}` : String(u.no)));
      if (!isShop(u)) b.append(node("span", "spot__bhk", `${u.bhk} BHK`));
      b.addEventListener("click", () => pick(u, b));
      spots.append(b);
    });
    picked = null;
    applyFilter();
    renderPanel(null);
  };

  tabs.forEach((t) => t.addEventListener("click", () => renderFloor(t.dataset.floor)));
  const setOnly = (v) => {
    only = v;
    $$("button", filter).forEach((b) => {
      const on = b.dataset.only === v;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    applyFilter();
  };
  $$("button", filter).forEach((b) => b.addEventListener("click", () => setOnly(b.dataset.only)));
  scroller.addEventListener("scroll", () => (hint.style.opacity = "0"), { passive: true, once: true });
  renderFloor("typical");

  return {
    /** typical floor with one home type highlighted */
    show(bhk) {
      if (floor === "ground") renderFloor("typical");
      setOnly(String(bhk));
    },
  };
}

/* ---------------- choose your home ---------------- */
function initHomes(floorPlans) {
  const tabs = $$("#homes [data-bhk]");
  const img = $("#homeImg");
  const body = $("#homeBody");
  const all = [...PLANS.typical, ...PLANS.first];
  let swap = null;

  const render = (bhk, first = false) => {
    const h = HOMES[bhk];
    const sizes = all.filter((u) => u.bhk === bhk).map((u) => u.sba);
    const sample = PLANS.typical.find((u) => u.no === h.flat);
    tabs.forEach((t) => {
      const on = Number(t.dataset.bhk) === bhk;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    if (!first) {
      swap?.cancel();
      swap = img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      swap.onfinish = () => {
        img.src = h.img;
        img.alt = `3D plan of a ${h.title} home at Elfin Nebula, flat ${h.flat}`;
        const show = () => {
          swap = img.animate([{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
        };
        img.decode ? img.decode().then(show, show) : show();
      };
    }

    const stats = node("dl", "home__stats");
    const stat = (k, v) => {
      const d = node("div");
      d.append(node("dt", "", k), node("dd", "", v));
      stats.append(d);
    };
    stat("Homes", `${h.count} of 112`);
    stat("Sizes (SBA)", `${sft(Math.min(...sizes))} to ${sft(Math.max(...sizes))}`);
    stat("Plan shown", `Flat ${h.flat} · ${h.tower}`);
    stat("Its SBA", sft(sample.sba));

    const actions = node("div", "home__actions");
    const enquire = node("a", "btn btn--gold", `Enquire about ${h.title}`);
    enquire.href = "#contact";
    enquire.dataset.enquire = `${bhk} BHK at Elfin Nebula`;
    const plan = node("a", "btn btn--line", "Find it on the floor plan");
    plan.href = "#plans";
    plan.addEventListener("click", () => floorPlans.show(bhk));
    actions.append(enquire, plan);

    body.replaceChildren(node("p", "home__kicker", "Elfin Nebula · Tower Orchid & Tower Emerald"), node("h3", "", h.title), node("p", "home__who", h.who), stats, actions);
    if (!first)
      [...body.children].forEach((child, i) =>
        child.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
          duration: 700,
          delay: 80 + i * 60,
          easing: "cubic-bezier(.16,1,.3,1)",
          fill: "backwards",
        }),
      );
  };
  tabs.forEach((t) => t.addEventListener("click", () => render(Number(t.dataset.bhk))));
  render(2, true);
}

/* ---------------- location: live map / brochure map ---------------- */
function initLocation() {
  const frame = $("#mapFrame");
  const brochure = $("#mapBrochure");
  const tabs = $$("#location [data-map]");
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    const f = document.createElement("iframe");
    f.src = frame.dataset.src;
    f.title = "Google Map of Elfin Nebula, Gopankoppa Sulla Road, Hubballi";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.allowFullscreen = true;
    frame.replaceChildren(f);
  };
  $("#mapLoad").addEventListener("click", load);
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return;
    load();
    io.disconnect();
  }, { rootMargin: "300px 0px" });
  io.observe(frame);
  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      const google = t.dataset.map === "google";
      tabs.forEach((x) => {
        x.classList.toggle("is-active", x === t);
        x.setAttribute("aria-selected", String(x === t));
      });
      frame.hidden = !google;
      brochure.hidden = google;
      if (google) load();
    }),
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
    if (b.dataset.message) form.message.value = b.dataset.message;
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

/* ---------------- calm motion ---------------- */
// Photos drift a few percent against the scroll; nothing else moves on its own.
function initParallax(gsap) {
  for (const img of $$(".about__media img, .shot img, .project__media img, .cta-band__media img, .amen__media img")) {
    gsap.fromTo(
      img,
      { yPercent: -3, scale: 1.07 },
      { yPercent: 3, scale: 1.07, ease: "none", scrollTrigger: { trigger: img.closest("figure, .project__media"), scrub: 0.6 } },
    );
  }
}

// As the page slides up over the fixed 3D stage, the stage eases back and dims.
function initStoryExit(gsap) {
  gsap.timeline({ scrollTrigger: { trigger: "#story", start: "bottom bottom", end: "bottom top", scrub: 0.6 } })
    .to(".story__stage", { scale: 0.94, ease: "none" }, 0)
    .to(".story__dim", { opacity: 0.6, ease: "none" }, 0);
}

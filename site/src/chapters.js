/**
 * Scroll-scrubbed chapter copy for the 3D story.
 * Every word/line is a pure function of story progress, so text and 3D move
 * as one and reverse perfectly when scrolling back.
 */
const IN = 0.04; // progress it takes one item to enter
const OUT = 0.03; // ...and to leave
const STAGGER = 0.0055; // progress between consecutive items entering

const clamp = (v) => Math.min(1, Math.max(0, v));
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const inCubic = (t) => t * t * t;
const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function splitWords(el) {
  const words = [];
  const wrap = (text, parent) => {
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) return parent.append(" ");
      const mask = document.createElement("span");
      mask.className = "split-word";
      const inner = document.createElement("span");
      inner.textContent = part;
      mask.append(inner);
      parent.append(mask);
      words.push(inner);
    });
  };
  const label = el.textContent.replace(/\s+/g, " ").trim();
  for (const node of [...el.childNodes]) {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      wrap(node.textContent, frag);
      node.replaceWith(frag);
    } else if (node.nodeType === 1) {
      const text = node.textContent;
      node.textContent = "";
      wrap(text, node);
    }
  }
  el.setAttribute("aria-label", label);
  for (const child of el.children) child.setAttribute("aria-hidden", "true");
  return words;
}

/**
 * gaps[i]: progress before starts[i] by which the previous chapter has fully left, so a
 * transition (the space → ground flash) can play with no copy on screen.
 */
export function initChapters({ chapters, starts, gaps = [], reduceMotion }) {
  const model = chapters.map((ch, ci) => {
    const items = [];
    const push = (el, kind) => el && items.push({ el, kind, last: "" });
    push(ch.querySelector(".eyebrow"), "line");
    splitWords(ch.querySelector(".chapter__title")).forEach((w) => push(w, "word"));
    push(ch.querySelector(".chapter__text"), "line");
    ch.querySelectorAll(".chips li").forEach((li) => push(li, "chip"));
    ch.querySelectorAll(".chapter__actions .btn").forEach((b) => push(b, "line"));
    const start = starts[ci];
    const end = ci < starts.length - 1 ? starts[ci + 1] - (gaps[ci + 1] || 0) : Infinity;
    return { ch, items, start, end, shown: null };
  });

  let intro = 0; // advances after the loader to play the first chapter in
  let lastP = 0;

  function write(item, enter, exit) {
    let css;
    if (item.kind === "word") {
      const y = (1 - enter) * 115 - exit * 115;
      const r = (1 - enter) * 7;
      css = `translate3d(0, ${y.toFixed(2)}%, 0) rotate(${r.toFixed(2)}deg)`;
      if (css !== item.last) {
        item.el.style.transform = css;
        item.last = css;
      }
      return;
    }
    const o = enter * (1 - exit);
    const y = (1 - enter) * 36 - exit * 26;
    const blur = (1 - enter) * 4 + exit * 3;
    const s = 1;
    css = `${o.toFixed(3)}|${y.toFixed(1)}|${blur.toFixed(1)}|${s.toFixed(3)}`;
    if (css === item.last) return;
    item.last = css;
    item.el.style.opacity = o.toFixed(3);
    item.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
    item.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "none";
  }

  function update(p = lastP) {
    lastP = p;
    for (const m of model) {
      let peak = 0;
      const n = m.items.length;
      m.items.forEach((item, i) => {
        let enter;
        if (m.start <= 0) {
          // first chapter: timed entrance after the loader instead of scroll
          enter = reduceMotion ? 1 : outExpo(clamp((intro - i * 0.09) / 0.9));
        } else {
          enter = outCubic(clamp((p - (m.start - 0.012) - i * STAGGER) / IN));
        }
        const exitStart = m.end - OUT - 0.008 + (n - 1 - i) * STAGGER * 0.35;
        const exit = Number.isFinite(m.end) ? inCubic(clamp((p - exitStart) / OUT)) : 0;
        write(item, enter, exit);
        peak = Math.max(peak, enter * (1 - exit));
      });
      const shown = peak > 0.001;
      if (shown !== m.shown) {
        m.ch.style.visibility = shown ? "visible" : "hidden";
        m.shown = shown;
      }
      m.ch.style.pointerEvents = peak > 0.6 ? "auto" : "none";
    }
  }

  return {
    update,
    /** play the first chapter's entrance; returns when done */
    playIntro(gsap) {
      const o = { v: 0 };
      const total = model[0].items.length * 0.09 + 0.9;
      return gsap.to(o, {
        v: total,
        duration: reduceMotion ? 0.01 : 2.1,
        ease: "none",
        onUpdate: () => {
          intro = o.v;
          update();
        },
      });
    },
  };
}


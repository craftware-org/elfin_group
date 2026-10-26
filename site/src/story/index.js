import * as THREE from "three";
import { createEarthWorld } from "./earth.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createGroundWorld } from "./ground.js";
import { bump, clamp, damp } from "./math.js";

/** Chapter start points along the story's scroll progress (0..1): Elfin Group (globe + dive),
 *  Elfin Nebula, plots, every location. */
export const CHAPTERS = [0, 0.3, 0.6, 0.88];

/* The two worlds were authored on a 5-chapter timeline. Scroll progress is remapped onto it
   piecewise. Chapter 2 starts at world 0.44, after the space → ground flash (world 0.37–0.418)
   has fully cleared, so the flash plays while chapter 1's copy fades out and the Nebula copy
   only ever builds over the finished scene. */
const NEW_KNOTS = [0, 0.3, 0.6, 0.88, 1];
const OLD_KNOTS = [0, 0.44, 0.63, 0.82, 1];
/** world-timeline shots, used to show each 3D label only during its own shot */
const SHOTS = [0, 0.4, 0.63, 0.82];
const shotAt = (q) => SHOTS.reduce((c, s, i) => (q >= s ? i : c), 0);
function toWorld(p) {
  for (let i = 0; i < NEW_KNOTS.length - 1; i++) {
    if (p <= NEW_KNOTS[i + 1]) {
      const t = (p - NEW_KNOTS[i]) / (NEW_KNOTS[i + 1] - NEW_KNOTS[i]);
      return OLD_KNOTS[i] + t * (OLD_KNOTS[i + 1] - OLD_KNOTS[i]);
    }
  }
  return 1;
}
const SWITCH = 0.4; // earth → ground hand-off (world timeline), hidden by a brief flash

export function chapterAt(p) {
  let c = 0;
  for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i] - 0.0001) c = i;
  return c;
}

function detectQuality() {
  const small = matchMedia("(max-width: 760px)").matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const saveData = !!navigator.connection?.saveData;
  const low = small || weak || saveData;
  // Phones: 1.75x with antialiasing stays crisp on a dense screen at about half the pixels of native
  // density (2.5–3x, which a phone GPU can't fill at a steady frame rate while scrolling); adaptive
  // resolution steps down from there if frames still run slow.
  return {
    low,
    shadows: !low,
    dpr: Math.min(window.devicePixelRatio || 1, saveData || (small && weak) ? 1.5 : 1.75),
    minDpr: 1,
  };
}

export function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * Builds the two 3D worlds and drives them from scroll progress.
 * Resolves once every texture has loaded and shaders are compiled.
 */
export async function createStory({ canvas, stage, labelLayer, haze, onLoadProgress, onFrame }) {
  const quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The world is static apart from the rising towers, so shadows are redrawn only when they change.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const manager = new THREE.LoadingManager();
  const loaded = new Promise((resolve, reject) => {
    manager.onLoad = resolve;
    manager.onError = (url) => reject(new Error(`Failed to load ${url}`));
  });
  manager.onProgress = (_url, done, total) => onLoadProgress?.(done / total);

  const earth = createEarthWorld({ loader: new THREE.TextureLoader(manager), quality });
  // The 3D signboards are drawn with Bebas Neue, so make sure it is loaded first.
  await document.fonts?.load(`400 64px "Bebas Neue"`).catch(() => {});
  const ground = createGroundWorld({ quality });
  // soft image-based light: glass, metal and plaster pick up believable reflections and bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  ground.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  ground.scene.environmentIntensity = 0.35;
  pmrem.dispose();
  const worlds = [earth, ground];

  /* DOM labels anchored to 3D points */
  const labels = worlds.flatMap((w, wi) =>
    w.labels.map((l) => {
      const el = document.createElement("span");
      el.className = `pin-label${l.variant ? ` pin-label--${l.variant}` : ""}`;
      el.textContent = l.text;
      labelLayer.appendChild(el);
      return { ...l, el, world: wi };
    }),
  );

  let width = 0;
  let height = 0;
  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    renderer.setSize(width, height, false);
    const portrait = width / height < 0.9;
    for (const w of worlds) {
      w.camera.aspect = width / height;
      w.camera.fov = portrait ? (w === earth ? 42 : 52) : w === earth ? 35 : 40;
      w.camera.updateProjectionMatrix();
    }
    // Shift the ground world so subjects sit right of the headline (desktop) or below it (portrait).
    if (portrait) ground.camera.setViewOffset(width, height, 0, -height * 0.27, width, height);
    else ground.camera.setViewOffset(width, height, -width * 0.17, 0, width, height);
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  await loaded;
  if (document.fonts?.ready) await document.fonts.ready;

  // Warm up both scenes so the hand-off never hitches.
  earth.update({ p: 0, dt: 0.016, time: 0, aspect: width / height, pointer: { x: 0, y: 0 } });
  ground.update({ p: 0.5, dt: 0.016, time: 0, pointer: { x: 0, y: 0 } });
  renderer.compile(ground.scene, ground.camera);
  renderer.render(ground.scene, ground.camera);
  renderer.compile(earth.scene, earth.camera);

  /* state */
  let target = 0;
  let p = 0;
  let visible = true;
  let resync = true;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const timer = new THREE.Timer();
  timer.connect(document);
  const v = new THREE.Vector3();

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  // The stage is fixed to the screen, so watch the story section (the scroll spacer):
  // once it has scrolled away the stage is fully covered, so hide it and stop rendering.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    stage.classList.toggle("is-off", !visible);
    if (visible) resync = true;
  }).observe(stage.parentElement);

  /* Adaptive resolution: trade pixels for a steady frame rate. */
  const maxDpr = quality.dpr;
  let dpr = maxDpr;
  let frames = 0;
  let frameTime = 0;
  function adapt(rawDt) {
    // Stalls (tab switch, background throttling, a notification) say nothing about GPU load.
    if (rawDt > 0.2 || document.hidden) return;
    const dt = rawDt;
    frames++;
    frameTime += dt;
    // react within half a second to slow frames, but take longer to win resolution back
    if (frames < 30) return;
    const avg = frameTime / frames;
    if (avg <= 1 / 48 && frames < 120) return;
    frames = 0;
    frameTime = 0;
    let next = dpr;
    if (avg > 1 / 48 && dpr > quality.minDpr) next = Math.max(quality.minDpr, dpr - 0.25);
    else if (avg < 1 / 58 && dpr < maxDpr) next = Math.min(maxDpr, dpr + 0.125);
    if (next !== dpr) {
      dpr = next;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
    }
  }

  // Labels never cover the chapter copy (top of the screen in portrait, left column on desktop).
  const copy = [...stage.querySelectorAll(".chapter")];
  let copyFor = -1;
  let copyRect = null;
  new ResizeObserver(() => (copyFor = -1)).observe(stage);

  const placed = []; // screen rects of the labels already placed this frame
  function placeLabels(world, camera, chapter, shot, hidden) {
    const portrait = width / height < 0.9;
    if (copyFor !== chapter) {
      copyFor = chapter;
      copyRect = copy[chapter]?.getBoundingClientRect() ?? null;
    }
    placed.length = 0;
    for (const l of labels) {
      // phones get the short name, so all of them fit across the narrow frame
      const text = portrait && l.short ? l.short : l.text;
      if (l.el.textContent !== text) {
        l.el.textContent = text;
        l.w = l.h = 0;
      }
      const show = !hidden && l.world === world && l.chapter === shot && (!l.visible || l.visible());
      if (show) {
        v.copy(l.get()).project(camera);
        let x = (v.x * 0.5 + 0.5) * width;
        let y = (-v.y * 0.5 + 0.5) * height;
        // labels are drawn ~40px above their anchor: keep them clear of the nav bar and, in portrait, the copy
        const minY = portrait && copyRect ? Math.max(110, copyRect.bottom + 52) : 110;
        l.w ||= l.el.offsetWidth;
        l.h ||= l.el.offsetHeight;
        // keep the whole pill on screen; it is centred on its anchor
        x = Math.min(Math.max(x, l.w / 2 + 10), width - l.w / 2 - 10);
        // never stack two pills on top of each other: try small steps up, down and sideways until clear
        const step = l.h + 6;
        const clear = (cx, cy) => {
          const top = cy - 1.3 * l.h;
          return !placed.some((r) => cx - l.w / 2 < r[2] + 6 && cx + l.w / 2 > r[0] - 6 && top < r[3] + 4 && top + l.h > r[1] - 4);
        };
        const tries = [];
        for (const k of [0, -1, 1, -2, 2, -3]) for (const f of [0, -0.5, 0.5, -1, 1]) tries.push([f * l.w, k * step]);
        const ok = tries.find(([dx, dy]) => {
          const cx = Math.min(Math.max(x + dx, l.w / 2 + 10), width - l.w / 2 - 10);
          return clear(cx, y + dy);
        });
        if (ok) {
          x = Math.min(Math.max(x + ok[0], l.w / 2 + 10), width - l.w / 2 - 10);
          y += ok[1];
        }
        const overCopy = !portrait && copyRect && x - l.w / 2 < copyRect.right + 16 && y > copyRect.top && y - 44 < copyRect.bottom;
        // no free spot at all: leave this one out rather than draw it over another label
        const crowded = !ok;
        const onScreen = v.z < 1 && Math.abs(v.x) < 0.95 && v.y > -1.05 && y > minY && !overCopy && !crowded;
        if (onScreen) {
          placed.push([x - l.w / 2, y - 1.3 * l.h, x + l.w / 2, y - 0.3 * l.h]);
          l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -130%)`;
        }
        l.el.classList.toggle("is-visible", onScreen);
      } else {
        l.el.classList.remove("is-visible");
      }
    }
  }

  let lastHaze = -1;
  // On phones and low-power devices a scene at rest (nothing scrolling) is drawn at half rate:
  // the slow ambient motion doesn't need 60 fps, and the freed GPU/CPU time keeps scrolling smooth.
  let skip = false;
  let skipped = 0; // time of a skipped frame, carried into the next drawn one
  renderer.setAnimationLoop(() => {
    timer.update();
    if (!visible) return;
    const resting = quality.low && !resync && Math.abs(target - p) < 1e-4;
    skip = resting && !skip;
    if (skip) {
      skipped = timer.getDelta();
      return;
    }
    const rawDt = timer.getDelta() + skipped;
    skipped = 0;
    const dt = Math.min(rawDt, 0.05);
    const time = timer.getElapsed();
    // Coming back into view (or first frame): jump straight to where the page is.
    if (resync) {
      p = target;
      resync = false;
    } else {
      p = damp(p, target, 4.2, dt);
    }
    pointer.x = damp(pointer.x, pointer.tx, 2.2, dt);
    pointer.y = damp(pointer.y, pointer.ty, 2.2, dt);

    const chapter = chapterAt(p);
    const q = toWorld(p);
    // short sunlit flash that hides the space → ground cut (about a tenth of a screen of scroll)
    const h = bump(q, 0.385, SWITCH, 0.41) * 0.9;
    if (Math.abs(h - lastHaze) > 0.001) {
      haze.style.opacity = h.toFixed(3);
      lastHaze = h;
    }

    if (q < SWITCH) {
      earth.update({ p: q, dt, time, aspect: width / height, pointer });
      renderer.render(earth.scene, earth.camera);
      placeLabels(0, earth.camera, chapter, shotAt(q), h > 0.3);
    } else {
      ground.update({ p: q, dt, time, pointer, aspect: width / height });
      if (ground.shadowsDirty) renderer.shadowMap.needsUpdate = true;
      renderer.render(ground.scene, ground.camera);
      placeLabels(1, ground.camera, chapter, shotAt(q), h > 0.3 || q < 0.43);
    }
    onFrame?.(p, time);
    // half-rate frames are slow on purpose, not a sign of an overloaded GPU
    if (!resting) adapt(rawDt);
  });

  return {
    setProgress(value) {
      target = clamp(value);
    },
    get progress() {
      return p;
    },
  };
}

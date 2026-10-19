import * as THREE from "three";
import { createEarthWorld } from "./earth.js";
import { createGroundWorld } from "./ground.js";
import { bump, clamp, damp } from "./math.js";

/** Chapter start points along the story's scroll progress (0..1). */
export const CHAPTERS = [0, 0.12, 0.4, 0.63, 0.82];
const SWITCH = 0.4; // earth → ground hand-off, hidden by the flash

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
  return {
    low,
    shadows: !low,
    dpr: Math.min(window.devicePixelRatio || 1, low ? 1.5 : 1.75),
    minDpr: weak || saveData ? 0.75 : 1,
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !quality.low, powerPreference: "high-performance" });
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
  const ground = createGroundWorld({ quality });
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

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resync = true;
    },
    { rootMargin: "100px" },
  ).observe(stage);

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
    if (frames < 90) return;
    const avg = frameTime / frames;
    frames = 0;
    frameTime = 0;
    let next = dpr;
    if (avg > 1 / 45 && dpr > quality.minDpr) next = Math.max(quality.minDpr, dpr - 0.25);
    else if (avg < 1 / 58 && dpr < maxDpr) next = Math.min(maxDpr, dpr + 0.125);
    if (next !== dpr) {
      dpr = next;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
    }
  }

  function placeLabels(world, camera, chapter, hidden) {
    for (const l of labels) {
      const show = !hidden && l.world === world && l.chapter === chapter && (!l.visible || l.visible());
      if (show) {
        v.copy(l.get()).project(camera);
        // NDC y runs -1 (bottom) to 1 (top). In portrait the copy owns the top ~45%, so labels stay below it.
        const maxY = width / height < 0.9 ? 0.1 : 1.05;
        const onScreen = v.z < 1 && Math.abs(v.x) < 0.95 && v.y < maxY && v.y > -1.05;
        if (onScreen) {
          const x = (v.x * 0.5 + 0.5) * width;
          const y = (-v.y * 0.5 + 0.5) * height;
          l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -130%)`;
        }
        l.el.classList.toggle("is-visible", onScreen);
      } else {
        l.el.classList.remove("is-visible");
      }
    }
  }

  let lastHaze = -1;
  renderer.setAnimationLoop(() => {
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (!visible) return;
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
    const h = bump(p, 0.335, SWITCH, 0.48);
    if (Math.abs(h - lastHaze) > 0.001) {
      haze.style.opacity = h.toFixed(3);
      lastHaze = h;
    }

    if (p < SWITCH) {
      earth.update({ p, dt, time, aspect: width / height, pointer });
      renderer.render(earth.scene, earth.camera);
      placeLabels(0, earth.camera, chapter, h > 0.3);
    } else {
      ground.update({ p, dt, time, pointer });
      if (ground.shadowsDirty) renderer.shadowMap.needsUpdate = true;
      renderer.render(ground.scene, ground.camera);
      placeLabels(1, ground.camera, chapter, h > 0.3 || p < 0.45);
    }
    onFrame?.(p, time);
    adapt(rawDt);
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

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
  const low = small || weak;
  return { low, shadows: !low, dpr: Math.min(window.devicePixelRatio || 1, low ? 1.5 : 1.75) };
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
export async function createStory({ canvas, stage, labelLayer, flash, onLoadProgress }) {
  const quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !quality.low, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

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

  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: "100px" }).observe(stage);

  function placeLabels(world, camera, chapter) {
    for (const l of labels) {
      const show = l.world === world && l.chapter === chapter && (!l.visible || l.visible());
      if (show) {
        v.copy(l.get()).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
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

  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    if (!visible) return;
    const time = timer.getElapsed();
    p = Math.abs(target - p) > 0.25 ? target : damp(p, target, 5.5, dt);
    pointer.x = damp(pointer.x, pointer.tx, 2.5, dt);
    pointer.y = damp(pointer.y, pointer.ty, 2.5, dt);

    const chapter = chapterAt(p);
    flash.style.opacity = bump(p, 0.345, SWITCH, 0.455).toFixed(3);

    if (p < SWITCH) {
      earth.update({ p, dt, time, aspect: width / height, pointer });
      renderer.render(earth.scene, earth.camera);
      placeLabels(0, earth.camera, chapter);
    } else {
      ground.update({ p, dt, time, pointer });
      renderer.render(ground.scene, ground.camera);
      placeLabels(1, ground.camera, chapter);
    }
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

/** Procedural building blocks for the ground world: sky, fields, towers, layouts. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./math.js";

export const GOLD = "#c98c34";
export const CREAM = "#efe6d6";
export const rand = rng(2008);
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ------------------------------------------------------------------ helpers */

function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Box geometry positioned in world space, ready to merge. */
export function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export function signTexture(text, { bg = "#0a0a0a", fg = GOLD, w = 1024, h = 192 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = fg;
    ctx.font = `400 ${Math.round(h * 0.56)}px "Bebas Neue", Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "14px";
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

/* ------------------------------------------------------------- environment */

export function makeSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color("#7f9fbd") },
      mid: { value: new THREE.Color("#f2c58c") },
      horizon: { value: new THREE.Color("#ffe1b0") },
      sunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.12, y));
        col = mix(col, top, smoothstep(0.12, 0.65, y));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.78, 0.45) * pow(s, 48.0) * 1.4 + vec3(1.0, 0.7, 0.4) * pow(s, 6.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

export function makeFields(size) {
  const tex = canvasTexture(2048, 2048, (ctx, w, h) => {
    ctx.fillStyle = "#6f8a3c";
    ctx.fillRect(0, 0, w, h);
    const palette = ["#7d9a45", "#6b8a39", "#8ea552", "#a5a35a", "#93884a", "#5f7d34", "#b2a463", "#7a9442", "#c0ad6d"];
    for (let i = 0; i < 420; i++) {
      const pw = 60 + rand() * 220;
      const ph = 50 + rand() * 200;
      const x = rand() * w;
      const y = rand() * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.25);
      ctx.fillStyle = pick(palette);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      if (rand() < 0.45) {
        ctx.strokeStyle = "rgba(60,70,30,.22)";
        ctx.lineWidth = 2;
        for (let k = -pw / 2; k < pw / 2; k += 7) {
          ctx.beginPath();
          ctx.moveTo(k, -ph / 2);
          ctx.lineTo(k, ph / 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // hedgerows
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#4c6a2a";
    ctx.lineWidth = 3;
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      const x = rand() * w;
      const y = rand() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 500, y + (rand() - 0.5) * 500);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  return ground;
}

export function overlayMat(color, { rough = 1, offset = -1 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset * 4 });
}

/* ------------------------------------------------------------------ towers */

function facadeTextures(bays, floors, seed) {
  const r = rng(seed);
  const BW = 64;
  const FH = 48;
  const w = bays * BW;
  const GFH = Math.round((FH * 4.4) / 3.15); // taller shop floor
  const h = floors * FH + GFH;
  const lit = [];
  const map = canvasTexture(w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#e8decb");
    g.addColorStop(0.5, "#f3ebdc");
    g.addColorStop(1, "#e3d8c3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let f = 0; f < floors; f++) {
      const y = f * FH;
      ctx.fillStyle = "#d5c9b2";
      ctx.fillRect(0, y + FH - 4, w, 4);
      for (let b = 0; b < bays; b++) {
        const x = b * BW;
        const glass = ctx.createLinearGradient(0, y + 8, 0, y + 40);
        glass.addColorStop(0, "#5d6b78");
        glass.addColorStop(1, "#2a323b");
        ctx.fillStyle = glass;
        ctx.fillRect(x + 9, y + 9, BW - 18, FH - 18);
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(x + 9, y + 9, (BW - 18) * 0.4, 3);
        ctx.strokeStyle = "#cbbfa8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 9, y + 9, BW - 18, FH - 18);
        ctx.beginPath();
        ctx.moveTo(x + BW / 2, y + 9);
        ctx.lineTo(x + BW / 2, y + FH - 9);
        ctx.stroke();
        if (r() < 0.38) lit.push([x, y, 0.55 + r() * 0.45]);
      }
    }
    // ground floor: shopfronts
    const gy = floors * FH;
    ctx.fillStyle = "#3a3127";
    ctx.fillRect(0, gy, w, GFH);
    for (let b = 0; b < bays; b++) {
      ctx.fillStyle = "#c9a36b";
      ctx.fillRect(b * BW + 5, gy + 8, BW - 10, GFH - 12);
      ctx.fillStyle = "#2a241d";
      ctx.fillRect(b * BW + BW / 2 - 1, gy + 8, 2, GFH - 12);
    }
  });
  const emissive = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, k] of lit) {
      ctx.fillStyle = `rgba(255, ${170 + Math.round(k * 40)}, ${90 + Math.round(k * 40)}, ${k})`;
      ctx.fillRect(x + 10, y + 10, BW - 20, FH - 20);
    }
    const gy = floors * FH;
    ctx.fillStyle = "rgba(255,200,120,.85)";
    for (let b = 0; b < bays; b++) ctx.fillRect(b * BW + 6, gy + 9, BW - 12, GFH - 14);
  });
  return { map, emissive };
}

export function makeTower({ x, z, ry = 0, floors = 9, name, seed }) {
  const W = 18;
  const D = 13;
  const GF = 4.4;
  const FL = 3.15;
  const H = GF + floors * FL;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = ry;

  const front = facadeTextures(5, floors, seed);
  const side = facadeTextures(4, floors, seed + 7);
  const mk = (t) =>
    new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color("#ffb766"), emissiveIntensity: 1.25, roughness: 0.82 });
  const roof = new THREE.MeshStandardMaterial({ color: "#d8cfbf", roughness: 0.95 });
  const sideMat = mk(side);
  const frontMat = mk(front);
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D).translate(0, H / 2, 0), [sideMat, sideMat, roof, roof, frontMat, frontMat]);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const cream = [];
  const glass = [];
  const gold = [];
  const bayW = W / 5;
  for (let f = 1; f <= floors; f++) {
    const y = GF + (f - 1) * FL;
    for (let b = 0; b < 5; b++) {
      const bx = -W / 2 + bayW * (b + 0.5);
      for (const s of [1, -1]) {
        cream.push(box(bayW - 0.5, 0.24, 1.5, bx, y + 0.12, s * (D / 2 + 0.75)));
        glass.push(box(bayW - 0.5, 1.0, 0.06, bx, y + 0.74, s * (D / 2 + 1.47)));
      }
    }
  }
  for (let b = 0; b <= 5; b++) {
    const fx = -W / 2 + bayW * b;
    cream.push(box(0.35, H - GF + 1.2, 1.7, fx, GF + (H - GF) / 2 + 0.3, D / 2 + 0.85));
    cream.push(box(0.35, H - GF + 1.2, 1.7, fx, GF + (H - GF) / 2 + 0.3, -D / 2 - 0.85));
  }
  // canopy over shops, parapet, rooftop headroom + tank
  cream.push(box(W + 1.2, 0.35, 2.6, 0, GF, D / 2 + 1.3));
  cream.push(box(W, 1.1, 0.35, 0, H + 0.55, D / 2 - 0.18), box(W, 1.1, 0.35, 0, H + 0.55, -D / 2 + 0.18));
  cream.push(box(0.35, 1.1, D, W / 2 - 0.18, H + 0.55, 0), box(0.35, 1.1, D, -W / 2 + 0.18, H + 0.55, 0));
  cream.push(box(5, 3.6, 4.4, -2, H + 1.8, -1), box(3.6, 1.8, 2.6, -2, H + 4.5, -1));
  gold.push(box(W + 0.3, 0.32, D + 0.3, 0, H + 1.12, 0));

  const creamMesh = new THREE.Mesh(mergeGeometries(cream), new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.85 }));
  creamMesh.castShadow = creamMesh.receiveShadow = true;
  const glassMesh = new THREE.Mesh(
    mergeGeometries(glass),
    new THREE.MeshStandardMaterial({ color: "#a9c2cf", transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.2, depthWrite: false }),
  );
  const goldMesh = new THREE.Mesh(
    mergeGeometries(gold),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.65, roughness: 0.32, emissive: GOLD, emissiveIntensity: 0.25 }),
  );
  group.add(creamMesh, glassMesh, goldMesh);

  // Name board on the rooftop headroom, facing the street
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.8), new THREE.MeshBasicMaterial({ map: signTexture(name), toneMapped: false }));
  sign.position.set(0, H + 2.2, D / 2 - 0.1);
  group.add(sign);

  group.userData = { height: H, top: new THREE.Vector3(0, H + 6, 0) };
  return group;
}

/* ------------------------------------------------------------------ layouts */

/** A plotted layout: spine road along x, cross road along z, rows of plots. */
export function makeLayout({ cols = 10, plotW = 7, plotD = 10, gap = 0.7, road = 8, arch = false, highlight = -1 }) {
  const group = new THREE.Group();
  const half = Math.ceil(cols / 2);
  const blockW = half * (plotW + gap);
  const width = blockW * 2 + road;
  const depth = 4 * (plotD + gap) + road;

  const base = new THREE.Mesh(new THREE.PlaneGeometry(width + 10, depth + 10).rotateX(-Math.PI / 2), overlayMat("#b9a876"));
  base.position.y = 0.05;
  base.receiveShadow = true;
  group.add(base);

  const asphalt = overlayMat("#2a2a2a", { offset: -2 });
  const roads = [box(width + 10, 0.1, road, 0, 0.1, 0), box(road, 0.1, depth + 10, 0, 0.1, 0)];
  const roadMesh = new THREE.Mesh(mergeGeometries(roads), asphalt);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  const marks = [];
  for (let xx = -width / 2; xx < width / 2; xx += 4) if (Math.abs(xx) > road / 2 + 1) marks.push(box(2, 0.05, 0.25, xx, 0.17, 0));
  for (let zz = -depth / 2; zz < depth / 2; zz += 4) if (Math.abs(zz) > road / 2 + 1) marks.push(box(0.25, 0.05, 2, 0, 0.17, zz));
  group.add(new THREE.Mesh(mergeGeometries(marks), new THREE.MeshBasicMaterial({ color: "#efe2c2" })));

  const plots = [];
  for (const sx of [-1, 1]) {
    for (let c = 0; c < half; c++) {
      const px = sx * (road / 2 + gap + (plotW + gap) * c + plotW / 2);
      for (const sz of [-1, 1]) {
        for (let r = 0; r < 2; r++) {
          const pz = sz * (road / 2 + gap + (plotD + gap) * r + plotD / 2);
          plots.push([px, pz]);
        }
      }
    }
  }
  plots.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const plotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(plotW, 0.3, plotD), new THREE.MeshStandardMaterial({ roughness: 1 }), plots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const hl = highlight >= 0 ? highlight % plots.length : -1;
  plots.forEach(([px, pz], i) => {
    m.makeTranslation(px, 0.2, pz);
    plotMesh.setMatrixAt(i, m);
    col.set(i === hl ? GOLD : pick(["#e6d3a5", "#e2cd9b", "#eadab0", "#dcc694"]));
    plotMesh.setColorAt(i, col);
  });
  plotMesh.receiveShadow = true;
  group.add(plotMesh);

  // perimeter low wall
  const wall = [
    box(width + 10, 1.1, 0.4, 0, 0.55, depth / 2 + 5),
    box(width + 10, 1.1, 0.4, 0, 0.55, -depth / 2 - 5),
    box(0.4, 1.1, depth + 10, width / 2 + 5, 0.55, 0),
    box(0.4, 1.1, depth + 10, -width / 2 - 5, 0.55, 0),
  ];
  const wallMesh = new THREE.Mesh(mergeGeometries(wall), new THREE.MeshStandardMaterial({ color: "#e9dfcb", roughness: 0.9 }));
  wallMesh.castShadow = true;
  group.add(wallMesh);

  // avenue tree spots along both roads
  const trees = [];
  for (let xx = -width / 2 + 3; xx < width / 2; xx += 7) if (Math.abs(xx) > road) trees.push([xx, road / 2 + 0.3], [xx, -road / 2 - 0.3]);
  for (let zz = -depth / 2 + 3; zz < depth / 2; zz += 7) if (Math.abs(zz) > road) trees.push([road / 2 + 0.3, zz], [-road / 2 - 0.3, zz]);

  let plotAnchor = null;
  if (hl >= 0) plotAnchor = new THREE.Vector3(plots[hl][0], 2, plots[hl][1]);

  if (arch) {
    const z0 = depth / 2 + 5;
    const pillarMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.6, roughness: 0.35 });
    const pillars = new THREE.Mesh(mergeGeometries([box(1.6, 8, 1.6, -road / 2 - 1.4, 4, z0), box(1.6, 8, 1.6, road / 2 + 1.4, 4, z0)]), pillarMat);
    const caps = new THREE.Mesh(mergeGeometries([box(2, 0.5, 2, -road / 2 - 1.4, 8.2, z0), box(2, 0.5, 2, road / 2 + 1.4, 8.2, z0)]), goldMat);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(road + 5, 1.6, 0.9).translate(0, 7.4, z0), new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.6 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(road + 4, 1.3), new THREE.MeshBasicMaterial({ map: signTexture("ELFIN"), toneMapped: false }));
    sign.position.set(0, 7.4, z0 + 0.47);
    for (const o of [pillars, caps, beam]) o.castShadow = true;
    group.add(pillars, caps, beam, sign);
  }

  return { group, trees, width, depth, plotAnchor, plotMesh };
}

export function makeVillas() {
  const group = new THREE.Group();
  const walls = [];
  const roofs = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const x = -26 + c * 13;
      const z = r ? 10 : -10;
      walls.push(box(8, 5.5, 8, x, 2.75, z));
      const roof = new THREE.ConeGeometry(6.6, 3.6, 4).rotateY(Math.PI / 4).translate(x, 7.3, z);
      roofs.push(roof);
    }
  }
  const wm = new THREE.Mesh(mergeGeometries(walls), new THREE.MeshStandardMaterial({ color: "#f2ead9", roughness: 0.85 }));
  const rm = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshStandardMaterial({ color: "#9a5a35", roughness: 0.7 }));
  wm.castShadow = rm.castShadow = true;
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(76, 42).rotateX(-Math.PI / 2), overlayMat("#8aa955"));
  lawn.position.y = 0.05;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(72, 5).rotateX(-Math.PI / 2), overlayMat("#cdc3ae", { offset: -2 }));
  lane.position.y = 0.08;
  group.add(lawn, lane, wm, rm);
  return group;
}

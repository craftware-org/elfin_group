/** Procedural building blocks for the ground world: sky, fields, towers, layouts. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./math.js";

export const GOLD = "#c98c34";
export const CREAM = "#efe6d6";
export const rand = rng(2008);
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ------------------------------------------------------------------ helpers */

export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
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
      top: { value: new THREE.Color("#1d4b8f") },
      mid: { value: new THREE.Color("#6f98cc") },
      horizon: { value: new THREE.Color("#f4c58f") },
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
      // soft tonal variation instead of fine furrow lines: thin repeating lines alias and
      // "shake" when the camera drifts, broad strokes stay calm at every distance
      if (rand() < 0.4) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = rand() < 0.5 ? "#3f5a22" : "#c9bb7a";
        for (let k = -pw / 2; k < pw / 2; k += 22) ctx.fillRect(k, -ph / 2, 10, ph);
      }
      ctx.restore();
    }
    // hedgerows
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#4c6a2a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
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
  tex.anisotropy = 16;
  ground.receiveShadow = true;
  return ground;
}

export function overlayMat(color, { rough = 1, offset = -1 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset * 4 });
}

/* ------------------------------------------------------------------ brand */

let markTexture = null;
export function brandMark() {
  if (!markTexture) {
    markTexture = new THREE.TextureLoader().load("/brand/mark.png");
    markTexture.colorSpace = THREE.SRGBColorSpace;
    markTexture.anisotropy = 8;
  }
  return markTexture;
}

/* ------------------------------------------------------------------ street lights */

/**
 * Street lights, instanced. spots: [x, z, armAngle], the arm reaching out over the road in the direction
 * armAngle (0 = +x, PI/2 = -z, -PI/2 = +z). Heads are unlit-white so they read as lamps at dusk.
 */
export function makeStreetLights(spots, { height = 7.5, arm = 2.2 } = {}) {
  const pole = mergeGeometries([
    new THREE.CylinderGeometry(0.11, 0.16, height, 6).translate(0, height / 2, 0),
    box(arm, 0.12, 0.12, arm / 2, height - 0.1, 0),
  ]);
  const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: "#2d2d2d", roughness: 0.55, metalness: 0.5 }), spots.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: "#ffe7bd", toneMapped: false }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  spots.forEach(([x, z, a], i) => {
    q.setFromAxisAngle(up, a);
    poles.setMatrixAt(i, m.compose(p.set(x, 0, z), q, one));
    const off = new THREE.Vector3(arm - 0.35, height - 0.24, 0).applyQuaternion(q);
    heads.setMatrixAt(i, m.compose(p.set(x + off.x, off.y, z + off.z), q, one));
  });
  poles.castShadow = true;
  const g = new THREE.Group();
  g.add(poles, heads);
  return g;
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
  base.position.y = 0.12;
  base.receiveShadow = true;
  group.add(base);

  const asphalt = overlayMat("#2a2a2a", { offset: -2 });
  const roads = [box(width + 10, 0.1, road, 0, 0.24, 0), box(road, 0.1, depth + 10, 0, 0.24, 0)];
  const roadMesh = new THREE.Mesh(mergeGeometries(roads), asphalt);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  const marks = [];
  for (let xx = -width / 2; xx < width / 2; xx += 4) if (Math.abs(xx) > road / 2 + 1) marks.push(box(2, 0.05, 0.25, xx, 0.31, 0));
  for (let zz = -depth / 2; zz < depth / 2; zz += 4) if (Math.abs(zz) > road / 2 + 1) marks.push(box(0.25, 0.05, 2, 0, 0.31, zz));
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
    m.makeTranslation(px, 0.4, pz);
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

  // street lights along both roads of the layout, set between the avenue trees
  const lamps = [];
  for (let xx = -width / 2 + 6.5; xx < width / 2 - 2; xx += 14) {
    if (Math.abs(xx) < road) continue;
    lamps.push([xx, road / 2 + 1.1, Math.PI / 2], [xx + 7, -road / 2 - 1.1, -Math.PI / 2]);
  }
  for (let zz = -depth / 2 + 6.5; zz < depth / 2 - 2; zz += 14) {
    if (Math.abs(zz) < road) continue;
    lamps.push([road / 2 + 1.1, zz, Math.PI], [-road / 2 - 1.1, zz + 7, 0]);
  }
  if (lamps.length) group.add(makeStreetLights(lamps, { height: 6.5, arm: 1.6 }));

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

/**
 * A completed Elfin apartment block for the aerial chapter (Castle, Oakwood, Sapphire): stilt parking,
 * `floors` residential floors with balconies, a parapet and a stair headroom, in its own small compound.
 * Colours follow the brochure photos: wall, accent (balcony bands / panels) and glass.
 */
export function makeApartmentBlock({ w = 16, d = 12, floors = 4, wall = "#efece6", accent = "#b5522b", seed = 1 }) {
  const r = rng(seed);
  const STILT = 3;
  const FL = 3.1;
  const H = STILT + floors * FL;
  const bays = Math.max(3, Math.round(w / 3.2));
  const facade = (bayCount) => {
    const BW = 64;
    const FH = 62;
    const lit = [];
    const map = canvasTexture(bayCount * BW, floors * FH + 60, (ctx, cw, ch) => {
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, cw, ch);
      for (let f = 0; f < floors; f++) {
        const y = f * FH;
        for (let b = 0; b < bayCount; b++) {
          const x = b * BW;
          ctx.fillStyle = "#2d363e";
          ctx.fillRect(x + 12, y + 14, BW - 24, FH - 26);
          ctx.strokeStyle = "#f7f5f0";
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 12, y + 14, BW - 24, FH - 26);
          if (r() < 0.5) lit.push([x, y]);
        }
        ctx.fillStyle = accent;
        ctx.fillRect(0, y + FH - 8, cw, 8); // floor band
      }
      // stilt floor: dark parking behind columns
      ctx.fillStyle = "#3a3530";
      ctx.fillRect(0, floors * FH, cw, 60);
      ctx.fillStyle = wall;
      for (let b = 0; b <= bayCount; b++) ctx.fillRect(Math.min(cw - 8, b * BW), floors * FH, 8, 60);
    });
    const emissive = canvasTexture(bayCount * BW, floors * FH + 60, (ctx, cw, ch) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "rgba(255,196,120,.9)";
      for (const [x, y] of lit) ctx.fillRect(x + 14, y + 16, BW - 28, FH - 30);
    });
    return new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: "#ffb766", emissiveIntensity: 1.1, roughness: 0.8 });
  };
  const front = facade(bays);
  const side = facade(Math.max(3, Math.round(d / 3.2)));
  const roof = new THREE.MeshStandardMaterial({ color: "#cfc9bf", roughness: 0.95 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, H, d).translate(0, H / 2, 0), [side, side, roof, roof, front, front]);
  body.castShadow = body.receiveShadow = true;
  // balconies on the front and back, slab edges, parapet, headroom
  const wallParts = [];
  const accentParts = [];
  for (let f = 1; f <= floors; f++) {
    const y = STILT + (f - 1) * FL;
    for (let b = 0; b < bays; b += 2) {
      const bx = -w / 2 + (w / bays) * (b + 0.5);
      for (const s of [1, -1]) {
        wallParts.push(box(w / bays - 0.4, 0.22, 1.3, bx, y + 0.1, s * (d / 2 + 0.65)));
        accentParts.push(box(w / bays - 0.4, 0.9, 0.12, bx, y + 0.65, s * (d / 2 + 1.25)));
      }
    }
  }
  wallParts.push(
    box(w + 0.3, 1, 0.25, 0, H + 0.5, d / 2), box(w + 0.3, 1, 0.25, 0, H + 0.5, -d / 2),
    box(0.25, 1, d, w / 2, H + 0.5, 0), box(0.25, 1, d, -w / 2, H + 0.5, 0),
    box(4, 2.6, 3.6, -w / 4, H + 1.3, 0),
  );
  const wallMesh = new THREE.Mesh(mergeGeometries(wallParts), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.85 }));
  const accentMesh = new THREE.Mesh(mergeGeometries(accentParts), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 }));
  wallMesh.castShadow = accentMesh.castShadow = true;
  // compound: lawn, drive and a low wall with a gap for the gate (gate faces the road, -z)
  const CW = w + 16;
  const CD = d + 16;
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD).rotateX(-Math.PI / 2), overlayMat("#8ba64e"));
  lawn.position.y = 0.12;
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(6, 8).rotateX(-Math.PI / 2), overlayMat("#d3cab8", { offset: -2 }));
  drive.position.set(0, 0.22, -d / 2 - 4);
  const fence = new THREE.Mesh(
    mergeGeometries([
      box(CW, 1.2, 0.3, 0, 0.6, CD / 2), box(0.3, 1.2, CD, CW / 2, 0.6, 0), box(0.3, 1.2, CD, -CW / 2, 0.6, 0),
      box(CW / 2 - 3.5, 1.2, 0.3, -CW / 4 - 1.75, 0.6, -CD / 2), box(CW / 2 - 3.5, 1.2, 0.3, CW / 4 + 1.75, 0.6, -CD / 2),
    ]),
    new THREE.MeshStandardMaterial({ color: "#e6ddca", roughness: 0.9 }),
  );
  group.add(lawn, drive, fence, body, wallMesh, accentMesh);
  group.userData = { compound: [CW, CD], height: H };
  return group;
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
  lawn.position.y = 0.12;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(72, 5).rotateX(-Math.PI / 2), overlayMat("#cdc3ae", { offset: -2 }));
  lane.position.y = 0.22;
  group.add(lawn, lane, wm, rm);
  return group;
}

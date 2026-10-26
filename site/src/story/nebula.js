/**
 * Elfin Nebula, modelled after the client's render: warm tan plaster blocks with deep recessed
 * balconies (loggias) whose ceilings and back walls glow, glass railings, solid piers between
 * them, small windows with sills and sunshades, a brown jaali strip, a lit shop podium with a
 * canopy, and raised parapets carrying the logo and the project name.
 *
 * Everything is real geometry (recesses, piers, slabs) so sunlight and shadow read the depth,
 * merged per material to keep draw calls low.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./math.js";
import { box, brandMark, canvasTexture } from "./parts.js";

const GF = 4.6; // shop floor

/** The 11 shops of the brochure's ground floor. Illustrative names (no real brands): [text, board, letters] */
const SHOP_NAMES = [
  ["DAILY MART", "#c62828", "#ffffff"], ["FASHION HUB", "#1a1a1a", "#e8c27a"], ["MEDICALS", "#2e7d32", "#ffffff"],
  ["CAFÉ 24", "#5d3b22", "#ffe2b0"], ["MOBILE WORLD", "#1565c0", "#ffffff"], ["SWEETS & BAKERY", "#ad1457", "#ffffff"],
  ["STYLE SALON", "#f5efe4", "#3a2a1c"], ["BOOKS & GIFTS", "#ef6c00", "#ffffff"], ["OPTICALS", "#263238", "#ffffff"],
  ["FOOTWEAR", "#6a1b9a", "#ffffff"], ["HOME DÉCOR", "#c98c34", "#1a1a1a"],
];
let shopIndex = 0;
const FL = 3.1; // typical floor
const R = 1.6; // loggia depth

/* ------------------------------------------------------------- textures */
let tex = null;
function textures() {
  if (tex) return tex;
  const plaster = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 2600; i++) {
      const v = 112 + Math.round(r() * 34);
      ctx.fillStyle = `rgba(${v},${v},${v},.35)`;
      const s = 1 + r() * 5;
      ctx.fillRect(r() * w, r() * h, s, s);
    }
  }, { srgb: false, repeat: [3, 3] });
  const jaali = canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = "#5a3b25";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#a57a50";
    ctx.lineWidth = 5;
    for (let y = -w; y < h + w; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + w);
      ctx.moveTo(w, y);
      ctx.lineTo(0, y + w);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0, 0, 8, h);
    ctx.fillRect(w - 8, 0, 8, h);
  }, { repeat: [1, 6] });
  // lit loggia back wall: a glazed door with a warm room behind and a dark frame
  const door = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffe2b0");
    g.addColorStop(1, "#d99a55");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(w * 0.12, h * 0.1, w * 0.36, h * 0.9);
    ctx.fillStyle = "#ffcf8a";
    ctx.fillRect(w * 0.15, h * 0.13, w * 0.3, h * 0.84);
    ctx.fillStyle = "rgba(90,60,30,.55)";
    ctx.fillRect(w * 0.56, h * 0.3, w * 0.34, h * 0.4);
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 6;
    ctx.strokeRect(w * 0.56, h * 0.3, w * 0.34, h * 0.4);
  });
  // shop interiors seen through the glass, one 256x256 cell each: supermarket, fashion, pharmacy, café,
  // mobiles, bakery, salon, books
  const interiors = canvasTexture(2048, 256, (ctx) => {
    const r = rng(31);
    const S = 256;
    const shelves = (x, colors, rows = 4) => {
      for (let k = 0; k < rows; k++) {
        const y = 60 + k * 38;
        ctx.fillStyle = "rgba(110,80,50,.55)";
        ctx.fillRect(x + 14, y + 26, S - 28, 5);
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = colors[Math.floor(r() * colors.length)];
          ctx.fillRect(x + 16 + i * 12.5, y + 8 + r() * 6, 9, 18);
        }
      }
    };
    const person = (x, y, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - 7, y - 46, 14, 46);
      ctx.beginPath();
      ctx.arc(x, y - 54, 7, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let c = 0; c < 8; c++) {
      const x = c * S;
      const g = ctx.createLinearGradient(0, 0, 0, S);
      const warm = c === 3 || c === 5 ? ["#ffd9a0", "#c98a4a"] : c === 4 ? ["#e8f2ff", "#9fb8d8"] : ["#fff6e6", "#e2c49a"];
      g.addColorStop(0, warm[0]);
      g.addColorStop(1, warm[1]);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, S, S);
      // ceiling lights
      ctx.fillStyle = "rgba(255,255,240,.95)";
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 20 + k * 60, 14, 34, 6);
      if (c === 0) shelves(x, ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#fb8c00", "#8e24aa"]);
      if (c === 1) {
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = ["#283593", "#c2185b", "#f5f5f5", "#6d4c41", "#00897b", "#212121"][i % 6];
          ctx.fillRect(x + 18 + i * 14, 78, 11, 70 + (i % 3) * 8);
        }
        ctx.fillStyle = "#6b5b4b";
        ctx.fillRect(x + 14, 74, S - 28, 4);
        person(x + 70, 236, "#3a3a3a");
        person(x + 190, 236, "#efe7da");
      }
      if (c === 2) {
        shelves(x, ["#ffffff", "#e3f2fd", "#c8e6c9", "#fff9c4", "#f8bbd0"]);
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(x + 112, 26, 32, 10);
        ctx.fillRect(x + 123, 15, 10, 32);
      }
      if (c === 3) {
        ctx.fillStyle = "#5d3b22";
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 22 + i * 78, 170, 56, 10);
        ctx.fillStyle = "#ffe6a8";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x + 40 + i * 58, 56, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        person(x + 60, 236, "#7b1f1f");
        person(x + 150, 236, "#1f3b5f");
      }
      if (c === 4) {
        ctx.fillStyle = "#f5f7fa";
        ctx.fillRect(x + 20, 150, S - 40, 26);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = "#1c1f24";
          ctx.fillRect(x + 28 + i * 21, 70 + (i % 2) * 34, 13, 24);
        }
        person(x + 128, 236, "#2b2b2b");
      }
      if (c === 5) {
        ctx.fillStyle = "rgba(255,255,255,.6)";
        ctx.fillRect(x + 16, 140, S - 32, 46);
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = ["#f8bbd0", "#ffcc80", "#a1887f", "#fff59d", "#ef9a9a"][i % 5];
          ctx.beginPath();
          ctx.arc(x + 26 + (i % 10) * 22, 152 + Math.floor(i / 10) * 18, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        shelves(x, ["#d7a86e", "#8d6e63", "#ffe0b2"], 2);
      }
      if (c === 6) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = "#cfd8dc";
          ctx.fillRect(x + 24 + i * 76, 52, 50, 74);
          ctx.fillStyle = "#3b2f2a";
          ctx.fillRect(x + 30 + i * 76, 150, 38, 40);
        }
        person(x + 100, 236, "#d81b60");
      }
      if (c === 7) shelves(x, ["#b71c1c", "#0d47a1", "#1b5e20", "#f57f17", "#4a148c", "#e0e0e0"], 5);
      // floor
      ctx.fillStyle = "rgba(90,70,50,.35)";
      ctx.fillRect(x, 222, S, 34);
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(x, 0, 3, S);
    }
  });
  // backlit sign boards, 512x128 cells in a 4x3 grid
  const signs = canvasTexture(2048, 384, (ctx) => {
    SHOP_NAMES.forEach(([text, bg, fg], i) => {
      const x = (i % 4) * 512;
      const y = Math.floor(i / 4) * 128;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, 512, 128);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(x, y, 512, 14);
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 3, y + 3, 506, 122);
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${text.length > 12 ? 52 : 62}px "Manrope Variable", "Manrope", Arial, sans-serif`;
      ctx.fillText(text, x + 256, y + 68);
    });
  });
  const name = canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = "#d9bd98";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#4a3422";
    ctx.textAlign = "center";
    ctx.font = `600 150px Georgia, "Times New Roman", serif`;
    ctx.fillText("Elfin Nebula", w / 2, 160);
    ctx.font = `600 120px Georgia, "Times New Roman", serif`;
    ctx.fillText("Apartments", w / 2, 320);
  });
  tex = { plaster, jaali, door, interiors, signs, name };
  return tex;
}

/* ------------------------------------------------------------- materials */
let mats = null;
function materials() {
  if (mats) return mats;
  const t = textures();
  // a little warm emissive stands in for street-light bounce, so plaster in twilight shade stays warm, not grey
  const plasterMat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, bumpMap: t.plaster, bumpScale: 0.6, emissive: "#4a2a12", emissiveIntensity: 0.35 });
  mats = {
    plaster: plasterMat("#cfa67c"),
    plasterLight: plasterMat("#e3c6a0"),
    plasterDark: plasterMat("#b58a62"),
    brown: new THREE.MeshStandardMaterial({ map: t.jaali, roughness: 0.75 }),
    slab: plasterMat("#ead6b8"),
    railGlass: new THREE.MeshStandardMaterial({ color: "#a9c0c8", transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.6, depthWrite: false }),
    metal: new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.45, metalness: 0.6 }),
    winDark: new THREE.MeshStandardMaterial({ color: "#3a4a58", roughness: 0.1, metalness: 0.7 }),
    winLit: new THREE.MeshStandardMaterial({ color: "#8a5a2c", map: t.door, emissive: "#ffa94d", emissiveMap: t.door, emissiveIntensity: 1.4, roughness: 0.3 }),
    loggiaBack: new THREE.MeshStandardMaterial({ color: "#6b4a2c", map: t.door, emissive: "#ffb257", emissiveMap: t.door, emissiveIntensity: 1.7, roughness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#ffe6bf", emissive: "#ffcc85", emissiveIntensity: 2.8 }),
    shopGlass: new THREE.MeshStandardMaterial({ map: t.interiors, emissive: "#ffffff", emissiveMap: t.interiors, emissiveIntensity: 0.62, roughness: 0.08, metalness: 0.15 }),
    signs: new THREE.MeshStandardMaterial({ map: t.signs, emissive: "#ffffff", emissiveMap: t.signs, emissiveIntensity: 0.75, roughness: 0.4 }),
    downlights: new THREE.MeshBasicMaterial({ color: "#fff1d6", toneMapped: false }),
    shell: plasterMat("#c4a07a"),
    stone: plasterMat("#a88d70"),
    parking: new THREE.MeshStandardMaterial({ color: "#2f2a24", roughness: 0.95 }),
    name: new THREE.MeshStandardMaterial({ map: t.name, roughness: 0.8 }),
    plaque: new THREE.MeshBasicMaterial({ map: brandMark(), transparent: true }),
  };
  return mats;
}

/* ------------------------------------------------------------- one block */
/**
 * A rectangular block of `floors` floors standing on the podium, centred on (cx, cz).
 * faces: bay patterns per face, read left→right as seen from outside.
 *   W window bay (flush wall, small window with sill + sunshade)
 *   B balcony bay (recessed loggia, glass railing, lit ceiling and back wall)
 *   J jaali bay (brown screen, full height)
 */
function block(b, { cx, cz, w, d, floors, faces, seed, base = GF, parapet = true }) {
  const r = rng(seed);
  const H = base + floors * FL;
  const ins = {};
  for (const f of ["+z", "-z", "+x", "-x"]) ins[f] = faces[f]?.includes("B") ? R : 0;

  // core walls (the loggias' back walls sit on its faces)
  const x0 = -w / 2 + ins["-x"];
  const x1 = w / 2 - ins["+x"];
  const z0 = -d / 2 + ins["-z"];
  const z1 = d / 2 - ins["+z"];
  b.plaster.push(box(x1 - x0, H - base, z1 - z0, cx + (x0 + x1) / 2, base + (H - base) / 2, cz + (z0 + z1) / 2));

  // face frame helpers: u runs along the face, dIn is the depth measured inwards from the outer line
  const span = (f) => (f[1] === "z" ? [-w / 2, w / 2] : [-d / 2 + ins["-z"], d / 2 - ins["+z"]]);
  const fbox = (f, uC, uS, dA, dB, yC, yS) => {
    const s = f[0] === "+" ? 1 : -1;
    const dc = (dA + dB) / 2;
    const ds = Math.abs(dB - dA);
    return f[1] === "z" ? box(uS, yS, ds, cx + uC, yC, cz + s * (d / 2 - dc)) : box(ds, yS, uS, cx + s * (w / 2 - dc), yC, cz + uC);
  };
  const fplane = (f, uC, uS, dIn, yC, yS) => {
    const s = f[0] === "+" ? 1 : -1;
    const g = new THREE.PlaneGeometry(uS, yS);
    if (f === "-z") g.rotateY(Math.PI);
    if (f === "+x") g.rotateY(Math.PI / 2);
    if (f === "-x") g.rotateY(-Math.PI / 2);
    return f[1] === "z" ? g.translate(cx + uC, yC, cz + s * (d / 2 - dIn + 0.03)) : g.translate(cx + s * (w / 2 - dIn + 0.03), yC, cz + uC);
  };
  const ceilingPlane = (f, uC, uS, yC) => {
    const s = f[0] === "+" ? 1 : -1;
    const g = new THREE.PlaneGeometry(f[1] === "z" ? uS : R - 0.1, f[1] === "z" ? R - 0.1 : uS).rotateX(Math.PI / 2);
    return f[1] === "z" ? g.translate(cx + uC, yC, cz + s * (d / 2 - R / 2)) : g.translate(cx + s * (w / 2 - R / 2), yC, cz + uC);
  };

  for (const [f, pattern] of Object.entries(faces)) {
    const [u0, u1] = span(f);
    const bw = (u1 - u0) / pattern.length;
    // read left→right from outside: +z and -x run with u, -z and +x against it
    const order = f === "+z" || f === "-x" ? 1 : -1;
    [...pattern].forEach((t, i) => {
      const k = order > 0 ? i : pattern.length - 1 - i;
      const uC = u0 + bw * (k + 0.5);
      if (t !== "B" && ins[f]) (t === "J" ? b.brown : b.plaster).push(fbox(f, uC, bw, 0, ins[f], base + (H - base) / 2, H - base));
      if (t === "J" && !ins[f]) b.brown.push(fbox(f, uC, bw * 0.9, -0.15, 0.02, base + (H - base) / 2, H - base));
      for (let fl = 0; fl < floors; fl++) {
        const y0 = base + fl * FL;
        if (t === "W") {
          const ww = Math.min(1.7, bw * 0.5);
          (r() < 0.45 ? b.winLit : b.winDark).push(fplane(f, uC, ww, 0, y0 + 1.6, 1.45));
          b.slab.push(fbox(f, uC, ww + 0.4, -0.18, 0.15, y0 + 0.82, 0.12)); // sill
          b.slab.push(fbox(f, uC, ww + 0.8, -0.6, 0.15, y0 + 2.48, 0.12)); // sunshade
          b.plasterDark.push(fbox(f, uC - ww / 2 - 0.05, 0.1, -0.02, 0.15, y0 + 1.6, 1.5), fbox(f, uC + ww / 2 + 0.05, 0.1, -0.02, 0.15, y0 + 1.6, 1.5));
        } else if (t === "B") {
          b.slab.push(fbox(f, uC, bw, 0, R, y0 - 0.12, 0.26)); // balcony floor + slab edge
          b.railGlass.push(fbox(f, uC, bw - 0.25, 0.06, 0.1, y0 + 0.58, 1.0));
          b.metal.push(fbox(f, uC, bw - 0.25, 0.03, 0.13, y0 + 1.1, 0.06));
          b.loggiaBack.push(fplane(f, uC, bw * 0.86, R, y0 + 1.35, 2.5));
          b.ceiling.push(ceilingPlane(f, uC, bw * 0.92, y0 + FL - 0.27));
          // a pier wherever the loggia has no solid neighbour
          const left = pattern[i - 1];
          const right = pattern[i + 1];
          if (fl === 0) {
            if (left === undefined || left === "B") b.plaster.push(fbox(f, uC - order * (bw / 2 - 0.14), 0.28, 0, R, base + (H - base) / 2, H - base));
            if (right === undefined) b.plaster.push(fbox(f, uC + order * (bw / 2 - 0.14), 0.28, 0, R, base + (H - base) / 2, H - base));
          }
        }
      }
    });
    // slim floor bands on flat faces
    if (!ins[f]) for (let fl = 1; fl < floors; fl++) b.slab.push(fbox(f, (u0 + u1) / 2, u1 - u0 + 0.3, -0.18, 0.1, base + fl * FL, 0.18));
  }

  // roof slab closes the top loggias (or is the floor of the cut), parapet on the outer line
  b.slab.push(box(w + 0.3, 0.35, d + 0.3, cx, H + 0.1, cz));
  if (parapet) b.plaster.push(
    box(w + 0.3, 1.2, 0.3, cx, H + 0.85, cz + d / 2),
    box(w + 0.3, 1.2, 0.3, cx, H + 0.85, cz - d / 2),
    box(0.3, 1.2, d + 0.3, cx + w / 2, H + 0.85, cz),
    box(0.3, 1.2, d + 0.3, cx - w / 2, H + 0.85, cz),
  );
  return H;
}

/**
 * Ground floor, as in the brochure: shops facing the road and, behind them, stilt parking under the
 * tower. shops: { face: [[from, to], ...] } runs (along the face) that are shopfronts; everything else
 * is open parking between columns. Shops get a lit interior behind aluminium-framed glass, a rolling
 * shutter box, a backlit sign board, stone piers between them and a canopy with downlights.
 */
function podium(b, { w, d, shops }) {
  const P = 2.8; // parking is set back under the tower
  const H1 = GF - 0.3; // underside of the first-floor slab band
  b.parking.push(box(w - 2 * P, H1, d - 2 * P, 0, H1 / 2, 0));
  b.slab.push(box(w + 0.4, 0.5, d + 0.4, 0, GF - 0.05, 0)); // first-floor slab edge
  const fb = (f, uC, uS, dA, dB, yC, yS) => {
    const s = f[0] === "+" ? 1 : -1;
    const dc = (dA + dB) / 2;
    const ds = Math.abs(dB - dA);
    return f[1] === "z" ? box(uS, yS, ds, uC, yC, s * (d / 2 - dc)) : box(ds, yS, uS, s * (w / 2 - dc), yC, uC);
  };
  const fp = (f, uC, uS, dIn, yC, yS, cell, cols, rows) => {
    const g = new THREE.PlaneGeometry(uS, yS);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((cell % cols) + uv.getX(i)) / cols, (rows - 1 - Math.floor(cell / cols) + uv.getY(i)) / rows);
    const s = f[0] === "+" ? 1 : -1;
    if (f === "-z") g.rotateY(Math.PI);
    if (f === "+x") g.rotateY(Math.PI / 2);
    if (f === "-x") g.rotateY(-Math.PI / 2);
    return f[1] === "z" ? g.translate(uC, yC, s * (d / 2 - dIn)) : g.translate(s * (w / 2 - dIn), yC, uC);
  };
  const down = (f, uC, dIn, y) => {
    const s = f[0] === "+" ? 1 : -1;
    const g = new THREE.PlaneGeometry(0.5, 0.5).rotateX(Math.PI / 2);
    return f[1] === "z" ? g.translate(uC, y, s * (d / 2 - dIn)) : g.translate(s * (w / 2 - dIn), y, uC);
  };

  for (const f of ["+z", "-z", "+x", "-x"]) {
    const len = f[1] === "z" ? w : d;
    const runs = (shops[f] || []).slice().sort((a, b2) => a[0] - b2[0]);
    // shopfronts
    for (const [from, to] of runs) {
      const n = Math.max(1, Math.round((to - from) / 6));
      const sw = (to - from) / n;
      for (let i = 0; i < n; i++) {
        const uC = from + sw * (i + 0.5);
        const k = shopIndex++;
        b.shell.push(fb(f, uC, sw, 0.12, P + 0.1, H1 / 2, H1)); // the shop unit itself
        b.shopGlass.push(fp(f, uC, sw - 0.7, -0.01, 1.55, 2.8, k % 8, 8, 1));
        for (const o of [-0.5, 0, 0.5]) b.metal.push(fb(f, uC + o * (sw - 0.7), 0.09, -0.06, 0.06, 1.55, 2.84));
        b.metal.push(fb(f, uC, sw - 0.6, -0.06, 0.06, 2.55, 0.08), fb(f, uC, sw - 0.6, -0.08, 0.06, 0.14, 0.12));
        b.metal.push(fb(f, uC, sw - 0.5, -0.2, 0.05, 3.07, 0.24)); // rolling-shutter box
        b.metal.push(fb(f, uC, sw - 0.45, -0.32, 0.02, 3.58, 0.72)); // sign board backing
        b.signs.push(fp(f, uC, sw - 0.6, -0.335, 3.58, 0.6, k % SHOP_NAMES.length, 4, 3));
        b.stone.push(fb(f, uC - sw / 2, 0.55, -0.22, 0.25, H1 / 2, H1), fb(f, uC + sw / 2, 0.55, -0.22, 0.25, H1 / 2, H1));
      }
      // canopy over the shops with downlights in its soffit
      b.slab.push(fb(f, (from + to) / 2, to - from + 0.8, -1.5, 0.1, 4.12, 0.24));
      for (let u = from + 1; u < to - 0.5; u += 2.2) b.downlights.push(down(f, u, -0.9, 3.99));
    }
    // stilt parking: columns along the open stretches of the face
    const covered = (u) => runs.some(([a, c]) => u > a - 1 && u < c + 1);
    for (let u = -len / 2 + 0.4; u <= len / 2 - 0.4 + 1e-6; u += (len - 0.8) / Math.max(1, Math.round((len - 0.8) / 5.6))) {
      if (!covered(u)) b.stone.push(fb(f, u, 0.6, 0.1, 0.7, H1 / 2, H1));
    }
  }
}

function finish(group, b) {
  const m = materials();
  for (const [k, geos] of Object.entries(b)) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), m[k]);
    const solid = !["railGlass", "loggiaBack", "ceiling", "shopGlass", "signs", "downlights", "winLit", "winDark"].includes(k);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

const buckets = () => ({
  plaster: [], plasterLight: [], plasterDark: [], brown: [], slab: [], railGlass: [], metal: [],
  winDark: [], winLit: [], loggiaBack: [], ceiling: [], shopGlass: [], signs: [], downlights: [], shell: [], stone: [], parking: [],
});

function plaque(group, x, y, z, ry = 0, size = 2.4) {
  const m = materials();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.2), new THREE.MeshStandardMaterial({ color: "#f3ead9", roughness: 0.7 })));
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.72, size * 0.66), m.plaque);
  logo.position.z = 0.11;
  g.add(logo);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  group.add(g);
}

/* ------------------------------------------------------------- the two towers */

/** Bay pattern for a long side: balconies every few bays, as on the render's long elevations. */
function longSide(length, seed) {
  const r = rng(seed);
  const n = Math.max(5, Math.round(length / 2.9));
  let s = "";
  while (s.length < n) s += r() < 0.5 ? "WB" : "WWB";
  return s.slice(0, n - 1) + "W";
}

/** The real floor, read from the brochure's plan: the coloured plan on the slab and its walls standing. */
function interiorLayer(plan, texUrl, y) {
  const group = new THREE.Group();
  const tex = new THREE.TextureLoader().load(texUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // plan x runs along world -z and plan y along world +x (see tools/build_floor3d.py)
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(plan.d, plan.w).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
    // lit as if the lights are on, so the plan's tiles, wood and bathrooms read even in the lid's shadow
    new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.22, roughness: 0.75 }),
  );
  plate.position.y = y + 0.02;
  // the opened floor reads as lit rooms: no sun or lid shadow across it
  const walls = [];
  const lows = [];
  const add = (list, arr, h) => {
    for (let i = 0; i < arr.length; i += 4) {
      const [x0, z0, x1, z1] = arr.slice(i, i + 4);
      list.push(box(Math.max(0.08, x1 - x0), h, Math.max(0.08, z1 - z0), (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2));
    }
  };
  // walls stop a little short of the ceiling, as on a cut-away model, so every room can be seen into
  add(walls, plan.walls, 1.8);
  add(lows, plan.low, 0.95);
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), new THREE.MeshStandardMaterial({ color: "#cdbca6", roughness: 0.8, emissive: "#3a2814", emissiveIntensity: 0.25 }));
  wallMesh.castShadow = false;
  const lowMesh = new THREE.Mesh(mergeGeometries(lows), new THREE.MeshStandardMaterial({ color: "#d9cfc0", roughness: 0.7 }));
  group.add(plate, wallMesh, lowMesh);
  return group;
}

/**
 * One tower, sized to the plan (Tower Emerald and Tower Orchid are long double-loaded bars of seven
 * homes each). It is built in two parts so it can be opened up in the story: the lower building
 * (shops + floors 1–4) with the real 5th-floor layout standing on top of it, and a `lid` (floors 5–8,
 * roof, signage) that sits over that layout until it is lifted away.
 */
export function makeNebulaTower({ x, z, plan, texUrl, street, side, accent = false, seed = 1 }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const { w, d } = plan;
  const CUT = 4; // floors below the cut
  const yCut = GF + CUT * FL;
  const faces = {
    "+z": street,
    "-z": "WBW",
    "+x": longSide(d, seed),
    "-x": longSide(d, seed + 1),
  };

  const lower = buckets();
  block(lower, { cx: 0, cz: 0, w, d, floors: CUT, faces, seed, base: GF, parapet: false });
  // 11 shops in all (brochure): three on each street end, and three (Emerald) or two (Orchid) on the
  // outer side next to the road; the rest of the ground floor is stilt parking
  const W = w + 0.6;
  const D = d + 0.6;
  const shops = { "+z": [[-W / 2 + 0.5, W / 2 - 0.5]] };
  shops[side] = [[D / 2 - (accent ? 18.5 : 12.5), D / 2 - 0.5]];
  podium(lower, { w: W, d: D, shops });
  finish(group, lower);

  const interior = interiorLayer(plan, texUrl, yCut + 0.28);
  interior.visible = false;
  group.add(interior);

  const lid = new THREE.Group();
  const top = buckets();
  const H = block(top, { cx: 0, cz: 0, w, d, floors: 8 - CUT, faces, seed: seed + 5, base: yCut, parapet: true });
  // stair / lift headroom
  top.plaster.push(box(6, 3.2, 7, 0, H + 1.6, -d * 0.12));
  if (accent) {
    // street end: the raised panel with the project name, and the Elfin mark, as in the render
    top.plaster.push(box(w * 0.6, 4.4, 1.2, 0, H + 2.9, d / 2 - 0.3), box(3.4, 5.2, 3.4, w / 2 - 2.6, H + 2.6, d / 2 - 2));
  } else {
    top.plaster.push(box(4.6, 4.8, 4.2, -w / 2 + 3, H + 2.4, d / 2 - 2.4));
  }
  finish(lid, top);
  if (accent) {
    const name = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.52, (w * 0.52) / 2.7), materials().name);
    name.position.set(0, H + 2.95, d / 2 + 0.33);
    lid.add(name);
    plaque(lid, w / 2 - 2.6, H + 3.4, d / 2 - 0.27, 0, 2.3);
  } else {
    plaque(lid, -w / 2 + 3, H + 3.2, d / 2 - 0.27, 0, 2.6);
  }
  group.add(lid);

  group.userData = { height: H, lid, interior, top: new THREE.Vector3(0, H + 7, d * 0.3) };
  return group;
}

import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clamp, smooth } from "./math.js";
import { FLOOR3D } from "./floor3d.data.js";
import { makeNebulaTower } from "./nebula.js";
import { GOLD, box, makeApartmentBlock, makeFields, makeLayout, makeSky, makeStreetLights, makeVillas, overlayMat, pick, rand, signTexture } from "./parts.js";

/* ------------------------------------------------------------------ world */

export function createGroundWorld({ quality }) {
  const scene = new THREE.Scene();
  // Dusk, as in the client's render: deep blue sky, last warm light low on the horizon, homes lit
  // the last light comes from the side and behind, so street faces sit in twilight and the homes glow
  const sunDir = new THREE.Vector3(-1, 0.28, -0.4).normalize();
  scene.fog = new THREE.FogExp2("#c7b7a6", 0.0017);
  scene.add(makeSky(sunDir));

  // near = 3 (not 1): the ground overlays sit a few cm apart, and a tiny near plane starves the
  // depth buffer at aerial distances, which made lawns and layouts flicker against the fields.
  const camera = new THREE.PerspectiveCamera(40, 1, 3, 4200);

  // Lights: warm golden-hour sun + sky fill
  scene.add(new THREE.HemisphereLight("#a9c0e2", "#46512c", 0.95));
  const sun = new THREE.DirectionalLight("#ffb27a", 2.0);
  const focus = new THREE.Vector3(55, 0, 0);
  sun.position.copy(focus).addScaledVector(sunDir, 320);
  sun.target.position.copy(focus);
  scene.add(sun, sun.target);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 120, bottom: -120, near: 10, far: 700 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
  }

  scene.add(makeFields(5600));

  /* roads */
  const roadGeos = [];
  const markGeos = [];
  const addRoad = (x1, z1, x2, z2, w = 10) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    roadGeos.push(box(w, 0.1, len, 0, 0, 0, 0).rotateY(ang).translate((x1 + x2) / 2, 0.09, (z1 + z2) / 2));
    for (let s = 3; s < len - 3; s += 9) {
      const t = s / len;
      markGeos.push(box(0.3, 0.05, 4, 0, 0, 0).rotateY(ang).translate(x1 + dx * t, 0.16, z1 + dz * t));
    }
  };
  addRoad(-700, 46, 700, 46, 12);
  addRoad(110, 46, 110, 76, 7); // Elfin Casa
  // entrance roads to the completed apartment compounds
  addRoad(-185, 52, -185, 72, 6);
  addRoad(-115, 52, -115, 85, 6);
  addRoad(-45, 52, -45, 77, 6);
  addRoad(135, 46, 135, -30, 8); // in to the plotted layout's arch
  addRoad(-60, 46, -60, -420, 9);
  addRoad(-60, -150, -140, -150, 8);
  addRoad(60, 30, 60, -400, 9);
  addRoad(200, 46, 270, -70, 9);
  const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos), overlayMat("#2b2b2b", { offset: -3, rough: 0.95 }));
  roadMesh.receiveShadow = true;
  scene.add(roadMesh, new THREE.Mesh(mergeGeometries(markGeos), new THREE.MeshBasicMaterial({ color: "#f1e4c6" })));

  /* Elfin Nebula site: two towers at the size of the brochure's plan (long bars of seven homes on a
     central corridor, ~19 x 47 m), short ends to the street, a plaza with parking in front */
  const SITE_FRONT = 39;
  const site = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(100, 90).rotateX(-Math.PI / 2), overlayMat("#8ba64e"));
  lawn.position.set(0, 0.12, -5);
  lawn.receiveShadow = true;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(76, 21).rotateX(-Math.PI / 2), overlayMat("#d9cfbc", { offset: -2 }));
  plaza.position.set(0, 0.22, 22.5);
  plaza.receiveShadow = true;
  const between = new THREE.Mesh(new THREE.PlaneGeometry(10, 48).rotateX(-Math.PI / 2), overlayMat("#cfc5b0", { offset: -2 }));
  between.position.set(0, 0.22, -11);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(9, 8).rotateX(-Math.PI / 2), overlayMat("#d9cfbc", { offset: -2 }));
  drive.position.set(2, 0.22, SITE_FRONT - 3);
  const siteWall = new THREE.Mesh(
    mergeGeometries([
      box(100, 1.8, 0.4, 0, 0.9, -50),
      box(0.4, 1.8, 89, -50, 0.9, -5.5),
      box(0.4, 1.8, 89, 50, 0.9, -5.5),
      box(43, 1.8, 0.4, -28.5, 0.9, SITE_FRONT),
      box(41, 1.8, 0.4, 29.5, 0.9, SITE_FRONT),
    ]),
    new THREE.MeshStandardMaterial({ color: "#eadfca", roughness: 0.9 }),
  );
  siteWall.castShadow = true;
  const gatePosts = new THREE.Mesh(
    mergeGeometries([box(1.4, 4, 1.4, -4, 2, SITE_FRONT), box(1.4, 4, 1.4, 8, 2, SITE_FRONT)]),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.55, roughness: 0.4 }),
  );
  // entrance arch with the project name over the drive
  const gateBeam = new THREE.Mesh(box(15, 1.3, 0.7, 2, 4.6, SITE_FRONT), new THREE.MeshStandardMaterial({ color: "#151311", roughness: 0.5 }));
  gateBeam.castShadow = true;
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 1.05), new THREE.MeshBasicMaterial({ map: signTexture("ELFIN NEBULA"), toneMapped: false }));
  gateSign.position.set(2, 4.6, SITE_FRONT + 0.37);
  site.add(lawn, plaza, between, drive, siteWall, gatePosts, gateBeam, gateSign);

  const FRONT = 12; // street ends of both towers
  const towerA = makeNebulaTower({
    x: -16, z: FRONT - FLOOR3D.orchid.d / 2, plan: FLOOR3D.orchid, texUrl: "/images/nebula/floor-orchid.webp",
    street: "WBWBW", side: "-x", seed: 11,
  });
  const towerB = makeNebulaTower({
    x: 16, z: FRONT - FLOOR3D.emerald.d / 2, plan: FLOOR3D.emerald, texUrl: "/images/nebula/floor-emerald.webp",
    street: "WBBJBBW", side: "+x", seed: 23, accent: true,
  });
  site.add(towerA, towerB);
  scene.add(site);

  /* Plotted layout showcase (Elfin Halyal Park in the aerial), set back from the towers behind
     its own entrance road rather than beside them */
  const MAIN = new THREE.Vector3(135, 0, -60);
  const main = makeLayout({ cols: 10, arch: true, highlight: 17 });
  main.group.position.copy(MAIN);
  scene.add(main.group);
  const plotAnchor = main.plotAnchor.clone().add(main.group.position);
  const archAnchor = new THREE.Vector3(MAIN.x, 11, MAIN.z + main.depth / 2 + 5);

  /* Every other Elfin site for the aerial chapter. Illustrative placement, chosen so that all of
     them (and their names) sit in the open right-hand part of the final frame, clear of the copy. */
  const county = makeLayout({ cols: 8, plotW: 8, plotD: 11 });
  county.group.position.set(0, 0, -200);
  const estate = makeLayout({ cols: 12, plotW: 7, plotD: 10 });
  estate.group.position.set(235, 0, -215);
  estate.group.rotation.y = -0.35;
  const heritage = makeLayout({ cols: 6, plotW: 8, plotD: 10 });
  heritage.group.position.set(-15, 0, -330);
  const medows = makeLayout({ cols: 8, plotW: 8, plotD: 11 });
  medows.group.position.set(230, 0, -335);
  const park = makeLayout({ cols: 6, plotW: 7, plotD: 10 });
  park.group.position.set(130, 0, -255);
  const casa = makeVillas();
  casa.position.set(110, 0, 96);
  scene.add(county.group, estate.group, heritage.group, medows.group, park.group, casa);

  /* Elfin's completed apartment projects (brochure): Castle (4 luxury apartments), Oakwood (16),
     Sapphire (12). Shown together on the left of the aerial, south of the main road (illustrative
     placement: Oakwood is in Dharwad, Castle and Sapphire in Keshwapur). */
  const APARTMENTS = [
    { key: "castle", x: -185, z: 88, w: 13, d: 11, floors: 4, wall: "#f2efe9", accent: "#b5522b", seed: 31 },
    { key: "oakwood", x: -115, z: 104, w: 19, d: 13, floors: 4, wall: "#dcdad4", accent: "#8b9096", seed: 32 },
    { key: "sapphire", x: -45, z: 92, w: 16, d: 12, floors: 4, wall: "#f4f3ef", accent: "#c7462e", seed: 33 },
  ];
  for (const a of APARTMENTS) {
    const block = makeApartmentBlock(a);
    block.position.set(a.x, 0, a.z);
    scene.add(block);
  }

  /* Trees */
  const spots = [];
  const addSpot = (x, z, s = 1) => spots.push([x, z, s]);
  for (let x = -46; x <= 46; x += 6) addSpot(x, -46, 1), addSpot(x, 35.5, 0.9);
  for (let z = -42; z <= 32; z += 6) addSpot(-46.5, z), addSpot(46.5, z);
  for (let x = -680; x < 680; x += 13) {
    if (Math.abs(x - 2) < 12 || Math.abs(x - 110) < 8 || Math.abs(x + 60) < 8 || [-185, -115, -45].some((g) => Math.abs(x - g) < 7)) continue;
    addSpot(x + rand() * 2, 55 + rand() * 1.5, 0.95);
    if (Math.abs(x - 135) > 8 && Math.abs(x - 60) > 8 && Math.abs(x - 200) > 8 && Math.abs(x) > 50) addSpot(x + rand() * 2, 37 - rand() * 1.5, 0.95);
  }
  const addLayoutTrees = (layout) => {
    layout.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const [x, z] of layout.trees) {
      v.set(x, 0, z).applyMatrix4(layout.group.matrixWorld);
      addSpot(v.x, v.z, 0.7);
    }
  };
  [main, county, estate, heritage, medows, park].forEach(addLayoutTrees);
  const keepOut = [
    [-52, -52, 52, 42],
    [MAIN.x - main.width / 2 - 8, MAIN.z - main.depth / 2 - 8, MAIN.x + main.width / 2 + 8, MAIN.z + main.depth / 2 + 12],
    [129, MAIN.z + main.depth / 2, 141, 46], // entrance road
    [-52, -250, 52, -150],
    [165, -272, 305, -158],
    [-60, -375, 30, -285],
    [180, -385, 280, -285],
    [92, -290, 168, -220],
    [62, 70, 158, 122],
    [-212, 58, -22, 126], // completed apartments
  ];
  const blocked = (x, z) => keepOut.some(([a, b, c, d]) => x > a && x < c && z > b && z < d) || Math.abs(z - 46) < 12;
  const clusters = quality.low ? 70 : 140;
  for (let i = 0; i < clusters; i++) {
    const cx = (rand() - 0.5) * 1100;
    const cz = (rand() - 0.5) * 1000 - 80;
    const n = 3 + Math.floor(rand() * 7);
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 34;
      const z = cz + (rand() - 0.5) * 34;
      if (!blocked(x, z)) addSpot(x, z, 0.8 + rand() * 0.7);
    }
  }
  // organic crowns: a subdivided sphere with its surface pushed in and out, smooth-shaded
  // shared vertices, so the normals smooth across faces instead of showing facets
  const crownGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute("normal").deleteAttribute("uv"));
  {
    const pa = crownGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      const n = 1 + 0.13 * Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3 - v.y * 2.2) + 0.06 * Math.sin(v.x * 11 + v.z * 9);
      v.multiplyScalar(n);
      pa.setXYZ(i, v.x, v.y * 0.92, v.z);
    }
    crownGeo.computeVertexNormals();
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.92 }), spots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#5c4630", roughness: 1 }), spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tc = new THREE.Color();
  const greens = ["#4f7a2c", "#5e8a34", "#6b9a3c", "#47702a", "#77a043", "#3f6a26"];
  spots.forEach(([x, z, s], i) => {
    const r = (1.8 + rand() * 1.8) * s;
    const th = 1.6 + r * 0.7;
    m4.compose(pos.set(x, 0, z), q.identity(), sc.set(1, th, 1));
    trunks.setMatrixAt(i, m4);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(pos.set(x, th + r * 0.7, z), q, sc.set(r, r * (0.9 + rand() * 0.35), r));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, tc.set(pick(greens)));
  });
  crowns.castShadow = trunks.castShadow = quality.shadows;
  crowns.receiveShadow = true;
  scene.add(crowns, trunks);

  /* Streetlights along the main road, arms over the carriageway */
  const lampSpots = [];
  for (let x = -400; x <= 420; x += 24) lampSpots.push([x, 39.6, -Math.PI / 2], [x + 12, 52.4, Math.PI / 2]);
  scene.add(makeStreetLights(lampSpots));

  /* The street as in the render: kerbs, a footpath, a zebra crossing at the gate */
  const kerbs = [box(1400, 0.22, 0.3, 0, 0.18, 40), box(1400, 0.22, 0.3, 0, 0.18, 52)];
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(1400, 3).rotateX(-Math.PI / 2), overlayMat("#bdb5a6", { offset: -2 }));
  walk.position.set(0, 0.2, 53.7);
  walk.receiveShadow = true;
  const zebra = [];
  for (let k = 0; k < 10; k++) zebra.push(box(3.2, 0.04, 0.55, 2, 0.17, 40.9 + k * 1.15));
  scene.add(
    walk,
    new THREE.Mesh(mergeGeometries(kerbs), new THREE.MeshStandardMaterial({ color: "#d8d2c6", roughness: 0.8 })),
    new THREE.Mesh(mergeGeometries(zebra), new THREE.MeshBasicMaterial({ color: "#efeadf" })),
  );

  /* Landscaping in front of the towers, as in the render: palms along the plaza, flowering hedges */
  {
    const trunk = new THREE.CylinderGeometry(0.17, 0.28, 7, 7).translate(0, 3.5, 0);
    const frondParts = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      frondParts.push(
        new THREE.BoxGeometry(0.06, 0.5, 3.4).translate(0, 0, 1.7).rotateX(0.55 + (k % 2) * 0.2).rotateY(a).translate(0, 7, 0),
      );
    }
    const fronds = mergeGeometries(frondParts);
    const palmSpots = [];
    for (let x = -34; x <= 36; x += 7) if (Math.abs(x - 2) > 6) palmSpots.push([x, 33.5]);
    for (let z = -30; z <= 6; z += 9) palmSpots.push([0, z]);
    const tI = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: "#7b6448", roughness: 0.9 }), palmSpots.length);
    const fI = new THREE.InstancedMesh(fronds, new THREE.MeshStandardMaterial({ color: "#4f7f2e", roughness: 0.8, side: THREE.DoubleSide }), palmSpots.length);
    palmSpots.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
      const s = 0.85 + rand() * 0.3;
      m4.compose(pos.set(x, 0, z), q, sc.set(s, s, s));
      tI.setMatrixAt(i, m4);
      fI.setMatrixAt(i, m4);
    });
    tI.castShadow = fI.castShadow = quality.shadows;
    scene.add(tI, fI);

    const shrubSpots = [];
    for (let x = -48; x <= 48; x += 1.8) if (Math.abs(x - 2) > 7) shrubSpots.push([x, 37.6]);
    for (let x = -36; x <= 38; x += 2.2) if (Math.abs(x - 2) > 6) shrubSpots.push([x, 31.8]);
    const shrubs = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), shrubSpots.length);
    const blooms = ["#8e5fae", "#b57ac8", "#6f8f3a", "#c48bd0", "#5f7f30"];
    shrubSpots.forEach(([x, z], i) => {
      m4.compose(pos.set(x + (rand() - 0.5) * 0.6, 0.55, z + (rand() - 0.5) * 0.5), q.identity(), sc.set(0.95, 0.6, 0.85));
      shrubs.setMatrixAt(i, m4);
      shrubs.setColorAt(i, tc.set(pick(blooms)));
    });
    shrubs.receiveShadow = true;
    scene.add(shrubs);

    // planters along the shopfronts
    const planterSpots = [];
    for (const x0 of [-24.5, -16, -7.5, 7.5, 16, 24.5]) planterSpots.push([x0, 15.4]);
    const planters = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.55, 0.7).translate(0, 0.27, 0), new THREE.MeshStandardMaterial({ color: "#6e5a46", roughness: 0.8 }), planterSpots.length);
    const blossoms = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), planterSpots.length * 2);
    planterSpots.forEach(([x, z], i) => {
      planters.setMatrixAt(i, m4.compose(pos.set(x, 0, z), q.identity(), sc.set(1, 1, 1)));
      for (const k of [0, 1]) {
        blossoms.setMatrixAt(i * 2 + k, m4.compose(pos.set(x + (k ? 0.4 : -0.4), 0.85, z), q.identity(), sc.set(0.5, 0.42, 0.42)));
        blossoms.setColorAt(i * 2 + k, tc.set(k ? "#b57ac8" : "#e07aa8"));
      }
    });
    scene.add(planters, blossoms);
  }

  /* Cars: parked at Nebula + a few on the road. Body with a tapered bonnet, tinted glass cabin, wheels. */
  const carBody = mergeGeometries([
    box(4.3, 0.62, 1.82, 0, 0.62, 0),
    box(1.0, 0.18, 1.7, 1.55, 0.98, 0), // bonnet
    box(0.8, 0.16, 1.7, -1.75, 0.98, 0), // boot
    box(0.12, 0.06, 1.9, 2.16, 0.5, 0), // bumpers
    box(0.12, 0.06, 1.9, -2.16, 0.5, 0),
  ]);
  const carCabin = box(2.25, 0.62, 1.6, -0.2, 1.24, 0);
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateX(Math.PI / 2);
  const carWheels = mergeGeometries([[1.35, 0.92], [1.35, -0.92], [-1.35, 0.92], [-1.35, -0.92]].map(([x, z]) => wheel.clone().translate(x, 0.34, z)));
  const carSpots = [];
  for (let i = 0; i < 9; i++) carSpots.push([-22 + i * 5.6, 22, Math.PI / 2]);
  for (let i = 0; i < 7; i++) carSpots.push([-300 + rand() * 650, 43 + (rand() < 0.5 ? 0 : 5.5), 0]);
  const cars = new THREE.InstancedMesh(carBody, new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.55 }), carSpots.length);
  const cabins = new THREE.InstancedMesh(carCabin, new THREE.MeshStandardMaterial({ color: "#1b2229", roughness: 0.08, metalness: 0.8 }), carSpots.length);
  const wheels = new THREE.InstancedMesh(carWheels, new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.8 }), carSpots.length);
  carSpots.forEach(([x, z, r], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
    m4.compose(pos.set(x, 0, z), q, sc.set(1, 1, 1));
    cars.setMatrixAt(i, m4);
    cabins.setMatrixAt(i, m4);
    wheels.setMatrixAt(i, m4);
    cars.setColorAt(i, tc.set(pick(["#f4f4f4", "#1d1d1d", "#8a1f1f", "#9da6ad", "#c98c34", "#2c3f5a"])));
  });
  cars.castShadow = cabins.castShadow = quality.shadows;
  scene.add(cars, cabins, wheels);

  /* ---------- camera path ----------
     One Catmull-Rom spline through every shot, so the camera never stops between
     keyframes. Scroll progress maps piecewise-linearly onto the spline; the story
     loop already damps progress, which keeps speed changes soft. */
  const keys = [
    [0.4, [210, 230, 300], [0, 4, 0]],
    [0.47, [88, 48, 112], [0, 12, -8]],
    // Tower Emerald opens, then the camera comes in close over its open floor and glides along it
    [0.535, [70, 62, 62], [16, 16, -10]],
    [0.567, [46, 46, 26], [17, 16.5, -8]],
    [0.6, [46, 44, -16], [15, 16.5, -18]],
    [0.665, [60, 62, 95], [80, 0, -30]],
    [0.73, [165, 85, 100], [112, 0, -50]],
    [0.79, [205, 70, 40], [125, 0, -60]],
    [0.87, [158, 205, 255], [44, 0, -60]],
    [1.0, [30, 345, 335], [40, 0, -90]],
  ];
  const keyP = keys.map((k) => k[0]);
  const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k[1])), false, "centripetal");
  const tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k[2])), false, "centripetal");
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  function pathAt(p) {
    let i = 0;
    while (i < keyP.length - 2 && p > keyP[i + 1]) i++;
    const t = clamp((p - keyP[i]) / (keyP[i + 1] - keyP[i]));
    const u = (i + t) / (keyP.length - 1);
    return [posCurve.getPoint(u, camPos), tgtCurve.getPoint(u, camTgt)];
  }

  const lookTarget = new THREE.Vector3();
  const anchors = {
    nebula: new THREE.Vector3(),
    emerald: new THREE.Vector3(),
    plot: plotAnchor,
    arch: archAnchor,
    aNebula: new THREE.Vector3(0, 44, -10),
    halyal: new THREE.Vector3(MAIN.x, 8, MAIN.z),
    county: new THREE.Vector3(0, 8, -200),
    estate: new THREE.Vector3(235, 8, -215),
    heritage: new THREE.Vector3(-15, 8, -330),
    medows: new THREE.Vector3(230, 8, -335),
    park: new THREE.Vector3(130, 8, -255),
    casa: new THREE.Vector3(110, 12, 96),
    castle: new THREE.Vector3(-185, 18, 88),
    oakwood: new THREE.Vector3(-115, 18, 104),
    sapphire: new THREE.Vector3(-45, 18, 92),
  };
  const plotMat = main.plotMesh;
  const gold = new THREE.Color(GOLD);
  const goldHi = new THREE.Color("#ffd28a");
  const hlColor = new THREE.Color();

  // A tall phone frame is narrow and the sites spread wide: the closing aerial looks down more
  // steeply there, so the sites spread up the screen and every one (and its name) fits.
  const portraitCam = new THREE.Vector3(30, 1400, 380);
  const portraitTgt = new THREE.Vector3(30, 0, -40);
  function update({ p, dt, time, pointer, aspect = 1.6 }) {
    const [cp, ct] = pathAt(clamp(p, 0.4, 1));
    if (aspect < 0.9) {
      const k = smooth(clamp((p - 0.82) / 0.18));
      cp.lerp(portraitCam, k);
      ct.lerp(portraitTgt, k);
    }
    // a slow, small idle drift: enough to feel alive without making fine ground detail shimmer
    const swayX = Math.sin(time * 0.21) * 0.55;
    const swayY = Math.sin(time * 0.17 + 1.3) * 0.25;
    camera.position.set(cp.x + pointer.x * 4 + swayX, cp.y - pointer.y * 2.5 + swayY, cp.z);
    lookTarget.copy(ct);
    camera.lookAt(lookTarget);

    // Descending through haze: thick fog at the hand-off clears as we land
    scene.fog.density = THREE.MathUtils.lerp(0.008, 0.0017, smooth(clamp((p - 0.4) / 0.022)));
    // the phone's closing aerial is seen from much higher up: thin the haze so the sites stay clear
    if (aspect < 0.9) scene.fog.density *= 1 - 0.72 * smooth(clamp((p - 0.82) / 0.18));

    // The cut: Tower Emerald's top four floors lift away to show its real 5th-floor layout inside, and
    // settle back as the camera leaves for the plots. Tower Orchid stays whole.
    const open = smooth(clamp((p - 0.485) / 0.05)) * (1 - smooth(clamp((p - 0.61) / 0.03)));
    const { lid, interior } = towerB.userData;
    const lift = open * 18;
    world.shadowsDirty = Math.abs(lid.position.y - lift) > 1e-4;
    lid.position.set(0, lift, -open * 4);
    lid.rotation.x = -open * 0.08;
    interior.visible = open > 0.02;
    towerA.userData.lid.localToWorld(anchors.nebula.copy(towerA.userData.top));
    towerB.userData.lid.localToWorld(anchors.emerald.copy(towerB.userData.top));

    // Highlighted plot breathes gold
    hlColor.lerpColors(gold, goldHi, 0.5 + 0.5 * Math.sin(time * 3));
    plotMat.setColorAt(17, hlColor);
    plotMat.instanceColor.needsUpdate = true;
  }

  const labels = [
    { key: "nebula", text: "Tower Orchid", chapter: 1, get: () => anchors.nebula },
    { key: "emerald", text: "Tower Emerald · Bookings open", chapter: 1, variant: "new", get: () => anchors.emerald },
    { key: "plot", text: "6 residential layouts", chapter: 2, variant: "new", get: () => anchors.plot },
    { key: "a-nebula", text: "Elfin Nebula · Gopankoppa", short: "Elfin Nebula", chapter: 3, variant: "new", get: () => anchors.aNebula },
    { key: "a-halyal", text: "Elfin Halyal Park", short: "Halyal Park", chapter: 3, get: () => anchors.halyal },
    { key: "a-estate", text: "Elfin Estate", short: "Elfin Estate", chapter: 3, get: () => anchors.estate },
    { key: "a-county", text: "Elfin County", short: "Elfin County", chapter: 3, get: () => anchors.county },
    { key: "a-medows", text: "Elfin Medows", short: "Elfin Medows", chapter: 3, get: () => anchors.medows },
    { key: "a-heritage", text: "Elfin Heritage", short: "Elfin Heritage", chapter: 3, get: () => anchors.heritage },
    { key: "a-park", text: "Elfin Park", short: "Elfin Park", chapter: 3, get: () => anchors.park },
    { key: "a-casa", text: "Elfin Casa · Gated community", short: "Elfin Casa", chapter: 3, get: () => anchors.casa },
    { key: "a-castle", text: "Elfin Castle", short: "Elfin Castle", chapter: 3, get: () => anchors.castle },
    { key: "a-oakwood", text: "Elfin Oakwood", short: "Elfin Oakwood", chapter: 3, get: () => anchors.oakwood },
    { key: "a-sapphire", text: "Elfin Sapphire", short: "Elfin Sapphire", chapter: 3, get: () => anchors.sapphire },
  ];

  const world = { scene, camera, update, labels, shadowsDirty: true };
  return world;
}

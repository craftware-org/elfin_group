import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clamp, easeInOut, smooth } from "./math.js";
import { GOLD, box, makeFields, makeLayout, makeSky, makeTower, makeVillas, overlayMat, pick, rand } from "./parts.js";

/* ------------------------------------------------------------------ world */

export function createGroundWorld({ quality }) {
  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(-1, 0.42, 0.62).normalize();
  scene.fog = new THREE.FogExp2("#f0cb98", 0.0017);
  scene.add(makeSky(sunDir));

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 3200);

  // Lights: warm golden-hour sun + sky fill
  scene.add(new THREE.HemisphereLight("#ffe8c8", "#4f5f2c", 1.15));
  const sun = new THREE.DirectionalLight("#ffc988", 3.2);
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

  scene.add(makeFields(3000));

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
  addRoad(-150, 46, -150, 98, 8);
  addRoad(-60, 46, -60, -420, 9);
  addRoad(-60, -150, -140, -150, 8);
  addRoad(60, 30, 60, -400, 9);
  addRoad(200, 46, 270, -70, 9);
  const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos), overlayMat("#2b2b2b", { offset: -3, rough: 0.95 }));
  roadMesh.receiveShadow = true;
  scene.add(roadMesh, new THREE.Mesh(mergeGeometries(markGeos), new THREE.MeshBasicMaterial({ color: "#f1e4c6" })));

  /* Elfin Nebula site */
  const site = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(92, 66).rotateX(-Math.PI / 2), overlayMat("#8ba64e"));
  lawn.position.set(0, 0.05, 0);
  lawn.receiveShadow = true;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(64, 22).rotateX(-Math.PI / 2), overlayMat("#d9cfbc", { offset: -2 }));
  plaza.position.set(2, 0.08, 15);
  plaza.receiveShadow = true;
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(8, 16).rotateX(-Math.PI / 2), overlayMat("#d9cfbc", { offset: -2 }));
  drive.position.set(2, 0.08, 34);
  const siteWall = new THREE.Mesh(
    mergeGeometries([
      box(92, 1.8, 0.4, 0, 0.9, -33),
      box(0.4, 1.8, 66, -46, 0.9, 0),
      box(0.4, 1.8, 66, 46, 0.9, 0),
      box(40, 1.8, 0.4, -26, 0.9, 33),
      box(40, 1.8, 0.4, 30, 0.9, 33),
    ]),
    new THREE.MeshStandardMaterial({ color: "#eadfca", roughness: 0.9 }),
  );
  siteWall.castShadow = true;
  const gatePosts = new THREE.Mesh(
    mergeGeometries([box(1.4, 4, 1.4, -4, 2, 33), box(1.4, 4, 1.4, 8, 2, 33)]),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.55, roughness: 0.4 }),
  );
  site.add(lawn, plaza, drive, siteWall, gatePosts);

  const towerA = makeTower({ x: -13, z: -6, floors: 9, name: "ELFIN NEBULA", seed: 11 });
  const towerB = makeTower({ x: 15, z: -10, floors: 9, name: "EMERALD TOWER", seed: 23 });
  site.add(towerA, towerB);
  scene.add(site);

  /* Plotted layout showcase */
  const main = makeLayout({ cols: 10, arch: true, highlight: 17 });
  main.group.position.set(118, 0, -6);
  scene.add(main.group);
  const plotAnchor = main.plotAnchor.clone().add(main.group.position);
  const archAnchor = new THREE.Vector3(118, 11, -6 + main.depth / 2 + 5);

  /* Other Elfin sites for the aerial chapter (illustrative placement) */
  const county = makeLayout({ cols: 8, plotW: 8, plotD: 11 });
  county.group.position.set(-150, 0, -215);
  const estate = makeLayout({ cols: 12, plotW: 7, plotD: 10 });
  estate.group.position.set(300, 0, -150);
  estate.group.rotation.y = -0.35;
  const springfield = makeLayout({ cols: 6, plotW: 8, plotD: 10 });
  springfield.group.position.set(60, 0, -330);
  const casa = makeVillas();
  casa.position.set(-150, 0, 126);
  scene.add(county.group, estate.group, springfield.group, casa);

  /* Trees */
  const spots = [];
  const addSpot = (x, z, s = 1) => spots.push([x, z, s]);
  for (let x = -44; x <= 44; x += 6) addSpot(x, -30, 1), addSpot(x, 30.5, 0.9);
  for (let z = -27; z <= 27; z += 6) addSpot(-43, z), addSpot(43, z);
  for (let x = -680; x < 680; x += 13) {
    if (Math.abs(x - 2) < 12 || Math.abs(x + 150) < 8 || Math.abs(x + 60) < 8) continue;
    addSpot(x + rand() * 2, 55 + rand() * 1.5, 0.95);
    if (Math.abs(x - 118) > 52 && Math.abs(x) > 50) addSpot(x + rand() * 2, 37 - rand() * 1.5, 0.95);
  }
  const addLayoutTrees = (layout) => {
    layout.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const [x, z] of layout.trees) {
      v.set(x, 0, z).applyMatrix4(layout.group.matrixWorld);
      addSpot(v.x, v.z, 0.7);
    }
  };
  [main, county, estate, springfield].forEach(addLayoutTrees);
  const keepOut = [
    [-50, -38, 50, 38],
    [118 - main.width / 2 - 8, -6 - main.depth / 2 - 8, 118 + main.width / 2 + 8, -6 + main.depth / 2 + 12],
    [-215, -275, -85, -155],
    [215, -230, 385, -70],
    [10, -380, 110, -280],
    [-195, 98, -105, 154],
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
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), spots.length);
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

  /* Streetlights along the main road */
  const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6).translate(0, 3.75, 0), box(2.2, 0.14, 0.14, 1.0, 7.4, 0)]);
  const lampSpots = [];
  for (let x = -400; x <= 420; x += 24) lampSpots.push([x, 39.4, 0], [x + 12, 52.6, Math.PI]);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: "#2d2d2d", roughness: 0.6, metalness: 0.4 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffe2ad", toneMapped: false }), lampSpots.length);
  lampSpots.forEach(([x, z, r], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r + Math.PI / 2);
    m4.compose(pos.set(x, 0, z), q, sc.set(1, 1, 1));
    poles.setMatrixAt(i, m4);
    const off = new THREE.Vector3(2.0, 7.25, 0).applyQuaternion(q);
    m4.compose(pos.set(x + off.x, off.y, z + off.z), q.identity(), sc.set(1, 1, 1));
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles, heads);

  /* Cars: parked at Nebula + a few on the road */
  const carGeo = mergeGeometries([box(4.3, 1.1, 1.9, 0, 0.75, 0), box(2.3, 0.85, 1.7, -0.2, 1.7, 0)]);
  const carSpots = [];
  for (let i = 0; i < 9; i++) carSpots.push([-22 + i * 5.6, 22, Math.PI / 2]);
  for (let i = 0; i < 7; i++) carSpots.push([-300 + rand() * 650, 43 + (rand() < 0.5 ? 0 : 5.5), 0]);
  const cars = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), carSpots.length);
  carSpots.forEach(([x, z, r], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
    m4.compose(pos.set(x, 0, z), q, sc.set(1, 1, 1));
    cars.setMatrixAt(i, m4);
    cars.setColorAt(i, tc.set(pick(["#f4f4f4", "#1d1d1d", "#8a1f1f", "#9da6ad", "#c98c34", "#2c3f5a"])));
  });
  cars.castShadow = quality.shadows;
  scene.add(cars);

  /* ---------- camera path: [p, position, target] ---------- */
  const keys = [
    [0.4, [170, 140, 230], [0, 8, 0]],
    [0.47, [58, 26, 66], [0, 15, 0]],
    [0.535, [4, 21, 80], [1, 16, -4]],
    [0.6, [-56, 26, 50], [0, 15, -2]],
    [0.665, [40, 52, 92], [108, 0, -6]],
    [0.73, [155, 38, 66], [118, 0, -8]],
    [0.79, [182, 46, 6], [116, 0, -8]],
    [0.87, [150, 200, 250], [40, 0, -60]],
    [1.0, [30, 340, 330], [40, 0, -90]],
  ].map(([p, a, b]) => ({ p, pos: new THREE.Vector3(...a), tgt: new THREE.Vector3(...b) }));

  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  function pathAt(p) {
    if (p <= keys[0].p) return [keys[0].pos, keys[0].tgt];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (p <= b.p) {
        const t = easeInOut((p - a.p) / (b.p - a.p));
        return [camPos.lerpVectors(a.pos, b.pos, t), camTgt.lerpVectors(a.tgt, b.tgt, t)];
      }
    }
    const last = keys[keys.length - 1];
    return [last.pos, last.tgt];
  }

  const lookTarget = new THREE.Vector3();
  const anchors = {
    nebula: new THREE.Vector3(),
    emerald: new THREE.Vector3(),
    plot: plotAnchor,
    arch: archAnchor,
    aNebula: new THREE.Vector3(0, 46, -6),
    county: new THREE.Vector3(-150, 8, -215),
    estate: new THREE.Vector3(300, 8, -150),
    springfield: new THREE.Vector3(60, 8, -330),
    casa: new THREE.Vector3(-150, 12, 126),
  };
  const plotMat = main.plotMesh;
  const gold = new THREE.Color(GOLD);
  const goldHi = new THREE.Color("#ffd28a");
  const hlColor = new THREE.Color();

  function update({ p, dt, time, pointer }) {
    const [cp, ct] = pathAt(clamp(p, 0.4, 1));
    const sway = Math.sin(time * 0.25) * 1.2;
    camera.position.set(cp.x + pointer.x * 4 + sway, cp.y - pointer.y * 2.5, cp.z);
    lookTarget.copy(ct);
    camera.lookAt(lookTarget);

    // Towers rise floor-by-floor as the chapter opens
    const rise = smooth(clamp((p - 0.4) / 0.065));
    towerA.scale.y = Math.max(0.02, rise);
    towerB.scale.y = Math.max(0.02, smooth(clamp((p - 0.415) / 0.07)));
    towerA.localToWorld(anchors.nebula.copy(towerA.userData.top));
    towerB.localToWorld(anchors.emerald.copy(towerB.userData.top));

    // Highlighted plot breathes gold
    hlColor.lerpColors(gold, goldHi, 0.5 + 0.5 * Math.sin(time * 3));
    plotMat.setColorAt(17, hlColor);
    plotMat.instanceColor.needsUpdate = true;
  }

  const labels = [
    { key: "nebula", text: "Elfin Nebula", chapter: 2, get: () => anchors.nebula },
    { key: "emerald", text: "Emerald Tower · New launch", chapter: 2, variant: "new", get: () => anchors.emerald },
    { key: "plot", text: "Plot 31", chapter: 3, variant: "new", get: () => anchors.plot },
    { key: "a-nebula", text: "Elfin Nebula · Gopankoppa", chapter: 4, variant: "new", get: () => anchors.aNebula },
    { key: "a-county", text: "Elfin County · APMC Road", chapter: 4, get: () => anchors.county },
    { key: "a-estate", text: "Elfin Estate · Sulla Road", chapter: 4, get: () => anchors.estate },
    { key: "a-spring", text: "Elfin Springfield", chapter: 4, get: () => anchors.springfield },
    { key: "a-casa", text: "Elfin Casa", chapter: 4, get: () => anchors.casa },
  ];

  return { scene, camera, update, labels };
}

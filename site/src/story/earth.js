import * as THREE from "three";
import { clamp, damp, smooth } from "./math.js";

// Hubballi, Karnataka
const HUBBALLI = { lat: 15.3647, lon: 75.124 };
const GOLD = new THREE.Color("#c98c34");

/** Point on a unit sphere that matches SphereGeometry's equirectangular UVs. */
function latLonToVec3(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthFrag = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specMap;
  uniform vec3 sunDir;
  uniform float nightBoost;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float ndl = dot(n, sunDir);
    float dayMix = smoothstep(-0.18, 0.28, ndl);

    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.78, 0.45) * nightBoost;
    float ocean = texture2D(specMap, vUv).r;

    vec3 lit = day * (0.18 + 1.05 * max(ndl, 0.0));
    vec3 col = mix(night, lit, dayMix);

    vec3 h = normalize(sunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 38.0) * ocean * dayMix;
    col += vec3(1.0, 0.86, 0.6) * spec * 0.55;

    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.2);
    col += vec3(0.32, 0.6, 1.0) * rim * (0.25 + 0.75 * dayMix) * 0.9;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 glow;
  uniform float strength;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 v = normalize(cameraPosition - vPosW);
    // back faces: -dot is ~0.39 where the shell meets the globe limb, 0 at the outer edge
    float f = smoothstep(0.0, 0.39, -dot(normalize(vNormalW), v));
    f *= f;
    gl_FragColor = vec4(glow, clamp(f, 0.0, 1.0) * strength);
  }
`;

export function createEarthWorld({ loader, quality }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050505");
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 400);
  camera.position.set(0, 0, 4.2);

  const sunDir = new THREE.Vector3(-0.55, 0.32, 1).normalize();

  // Stars
  {
    const n = quality.low ? 1400 : 3200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 60);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xfff4e0, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    scene.add(stars);
    // a few gold dust motes close to camera
    const m = 70;
    const dust = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) dust.set([(Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, -2 - Math.random() * 6], i * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dust, 3));
    scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: GOLD, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false })));
  }

  const tex = (url, srgb = true) => {
    const t = loader.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: tex("/textures/earth_atmos_2048.jpg") },
      nightMap: { value: tex("/textures/earth_lights_2048.jpg") },
      specMap: { value: tex("/textures/earth_specular_2048.jpg", false) },
      sunDir: { value: sunDir },
      nightBoost: { value: 1.6 },
    },
    vertexShader: earthVert,
    fragmentShader: earthFrag,
  });
  const seg = quality.low ? 64 : 112;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg * 0.66), earthMat);
  spin.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, seg, seg * 0.66),
    new THREE.MeshLambertMaterial({ map: tex("/textures/earth_clouds_1024.png"), transparent: true, opacity: 0.75, depthWrite: false }),
  );
  spin.add(clouds);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.085, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color("#4f8dff") }, strength: { value: 0.9 } },
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  tilt.add(atmo);

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.copy(sunDir).multiplyScalar(10);
  scene.add(sun, new THREE.AmbientLight(0x223344, 0.5));

  // Hubballi pin: gold beacon + pulsing rings, parented to the spinning globe.
  const pinPos = latLonToVec3(HUBBALLI.lat, HUBBALLI.lon, 1.0);
  const normal = pinPos.clone().normalize();
  const pin = new THREE.Group();
  pin.position.copy(pinPos);
  pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 0.16, 8).translate(0, 0.08, 0),
    new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9 }),
  );
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  head.position.y = 0.16;
  const ringGeo = new THREE.RingGeometry(0.01, 0.013, 48).rotateX(-Math.PI / 2);
  const rings = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    r.position.y = 0.002;
    r.userData.offset = i / 3;
    pin.add(r);
    return r;
  });
  pin.add(beam, head);
  spin.add(pin);

  // Orientation that brings Hubballi to face the camera.
  const targetSpin = Math.atan2(-pinPos.x, pinPos.z);
  const zAfterSpin = Math.hypot(pinPos.x, pinPos.z);
  const targetTilt = Math.atan2(pinPos.y, zAfterSpin);

  const anchor = new THREE.Vector3();
  let pinVis = 0;

  function update({ p, dt, time, aspect, pointer }) {
    const dive = smooth(clamp((p - 0.07) / 0.29));
    const portrait = aspect < 0.9;

    // Opens over Africa / the Gulf and turns east until Hubballi faces the camera.
    const drift = Math.sin(time * 0.07) * 0.3;
    spin.rotation.y = targetSpin + (1 - dive) * (0.8 + drift);
    tilt.rotation.x = THREE.MathUtils.lerp(0.22, targetTilt, dive);
    tilt.rotation.z = THREE.MathUtils.lerp(-0.32, 0, dive);
    clouds.rotation.y = time * 0.006;
    clouds.material.opacity = 0.75 * (1 - dive * 0.8);

    // Globe sits right of the headline on desktop, low and centred on portrait.
    const restX = portrait ? 0 : Math.min(1.15, 0.62 * aspect);
    const restY = portrait ? -0.72 : 0;
    tilt.position.set(THREE.MathUtils.lerp(restX, 0, dive), THREE.MathUtils.lerp(restY, 0, dive), 0);
    atmo.position.set(0, 0, 0);

    const restZ = portrait ? 6.2 : 4.9;
    camera.position.z = THREE.MathUtils.lerp(restZ, portrait ? 2.1 : 1.78, smooth(dive));
    camera.position.x = damp(camera.position.x, pointer.x * 0.08 * (1 - dive), 3, dt);
    camera.position.y = damp(camera.position.y, -pointer.y * 0.06 * (1 - dive), 3, dt);
    camera.lookAt(tilt.position.x * (1 - dive) * 0.15, tilt.position.y * 0.15, 0);

    // Pin + rings
    pinVis = damp(pinVis, dive > 0.45 ? 1 : 0, 4, dt);
    pin.scale.setScalar(Math.max(0.0001, pinVis));
    for (const r of rings) {
      const k = (time * 0.55 + r.userData.offset) % 1;
      r.scale.setScalar(1 + k * 2.2);
      r.material.opacity = (1 - k) * 0.85 * pinVis;
    }
    head.getWorldPosition(anchor);
  }

  return {
    scene,
    camera,
    update,
    /** world-space anchors for DOM labels */
    labels: [{ key: "hubballi", text: "Hubballi, Karnataka", chapter: 1, get: () => anchor, visible: () => pinVis > 0.6 }],
  };
}

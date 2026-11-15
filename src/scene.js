// The 3D Mars world. Reads game state every frame; never changes it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ROOMS, DAY, health, pf } from './game.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (r, g, b) => new THREE.Color(r, g, b);
const IDLE = { life: 80, power: 80, food: 80, dose: 30 };

// Terrain height: flat pad for the base, rolling dunes, craters, mountains on the horizon.
const CRATERS = [[70, -40, 14], [-90, 30, 22], [40, 95, 10], [-50, -110, 18], [130, 60, 26], [-20, 70, 8]];
function height(x, z) {
  const r = Math.hypot(x, z);
  let h = (Math.sin(x * .05) * Math.cos(z * .045) * 2 + Math.sin(x * .13 + z * .07) * .8 + Math.sin(z * .21 - x * .03) * .4) * smooth(26, 55, r) * (1 + r / 80);
  for (const [cx, cz, R] of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / R;
    if (d < 1) h += (d * d - 1) * R * .22 + R * .06;
    else if (d < 1.4) h += (1.4 - d) / .4 * R * .06;
  }
  const a = Math.atan2(z, x);
  h += Math.max(0, r - 170) * .35 * (1 + .6 * Math.sin(a * 5) + .3 * Math.sin(a * 13));
  return h;
}

function makeTerrain() {
  const g = new THREE.PlaneGeometry(640, 640, 220, 220).rotateX(-Math.PI / 2), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = height(x, z);
    p.setY(i, h);
    const v = .85 + .15 * Math.sin(x * .3 + z * .17) * Math.sin(z * .23) + h * .01;
    col.push(.62 * v, .3 * v, .17 * v);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

function makeRocks() {
  const n = 320, m = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6b3424, roughness: 1, flatShading: true }), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, r = 22 + Math.random() ** 1.5 * 220, x = Math.cos(a) * r, z = Math.sin(a) * r, s = .2 + Math.random() ** 3 * 2.2;
    o.position.set(x, height(x, z) + s * .3, z);
    o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    o.scale.set(s, s * (.5 + Math.random() * .5), s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  m.castShadow = m.receiveShadow = true;
  return m;
}

const SKY = {
  uniforms: { top: { value: C(0, 0, 0) }, bot: { value: C(0, 0, 0) }, sunDir: { value: new THREE.Vector3() }, glow: { value: C(0, 0, 0) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 top, bot, glow, sunDir; varying vec3 vP;
    void main(){ float h = clamp(vP.y * 1.6 + .08, 0., 1.); vec3 c = mix(bot, top, h);
      float s = max(dot(vP, sunDir), 0.); c += glow * (pow(s, 6.) * .5 + pow(s, 300.) * 3.);
      gl_FragColor = vec4(c, 1.); }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
};

const SHIELD = {
  uniforms: { uT: { value: 0 }, uA: { value: 1 }, uC: { value: C(.45, .85, 1) } },
  vertexShader: `varying vec3 vN, vV, vW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = position; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT, uA; uniform vec3 uC; varying vec3 vN, vV, vW;
    void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.5); float band = .6 + .4 * sin(vW.y * 2.5 - uT * 2.);
      gl_FragColor = vec4(uC, f * uA * band * .8); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
};

// One builder per room, same order as ROOMS. Each returns { g, tick(r, s, phase, day, dt, power) } for room-specific animation.
function buildRooms(M) {
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
  const add = (g, ...ms) => (ms.forEach(m => g.add(m)), g);
  return [
    () => { // Life Support: water tank whose level is the life-support meter, air fan on top (slows on low power)
      const g = new THREE.Group(), fan = new THREE.Group(), water = mesh(new THREE.CylinderGeometry(2.4, 2.4, 1, 20), M.water);
      add(g, mesh(new THREE.CylinderGeometry(2.8, 2.8, .4, 20), M.metal, 0, .2), water, mesh(new THREE.CylinderGeometry(2.7, 2.7, 5, 20, 1, true), M.glass, 0, 2.9), mesh(new THREE.TorusGeometry(2.7, .12, 6, 24).rotateX(Math.PI / 2), M.metal, 0, 5.4));
      for (let i = 0; i < 3; i++) add(g, mesh(new THREE.CapsuleGeometry(.5, 2, 4, 10), M.tank, Math.cos(i * 2.1) * 3.4, 1.5, Math.sin(i * 2.1) * 3.4));
      for (let i = 0; i < 3; i++) { const b = mesh(new THREE.BoxGeometry(2.6, .06, .4), M.metal); b.rotation.y = i * 1.047; fan.add(b); }
      fan.position.y = 5.7;
      add(g, fan);
      return { g, tick: (r, s, t, sun, dt, P) => { const h = Math.max(.02, r.life / 100 * 4.8); water.scale.y = h; water.position.y = .4 + h / 2; fan.rotation.y += dt * (1 + r.life / 15) * P; } };
    },
    () => { // Solar Farm: panel rows that track the sun
      const g = new THREE.Group(), panels = [];
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        const p = new THREE.Group();
        add(p, mesh(new THREE.BoxGeometry(2.6, .12, 1.6), M.panel), mesh(new THREE.BoxGeometry(2.7, .06, 1.7), M.metal, 0, -.08));
        p.position.set(x * 3, 1.6, z * 2.4);
        add(g, mesh(new THREE.CylinderGeometry(.08, .08, 1.6), M.metal, x * 3, .8, z * 2.4), p);
        panels.push(p);
      }
      return { g, tick: (r, s, t, sun) => panels.forEach(p => p.rotation.z += ((sun ? -.6 * Math.cos(t * Math.PI / .6) : 0) - p.rotation.z) * .05) };
    },
    () => { // Greenhouse: glass dome over rows of crops that grow with food
      const g = new THREE.Group(), crops = new THREE.Group();
      add(g, mesh(new THREE.CylinderGeometry(4.4, 4.6, .6, 24), M.white, 0, .3));
      for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) if (x * x + z * z < 7) crops.add(mesh(new THREE.ConeGeometry(.35, 1.2, 6), M.plant, x * .9, 1.2, z * .9));
      const dome = mesh(new THREE.SphereGeometry(4.2, 24, 12, 0, 6.283, 0, Math.PI / 2), M.glass, 0, .6);
      dome.castShadow = false;
      add(g, crops, dome);
      return { g, tick: r => crops.children.forEach(c => c.scale.setScalar(.3 + r.food / 100)) };
    },
    () => { // Shelter: regolith-buried bunker, radiation sensor dish, and a warning lamp that lights up as the dose budget runs out
      const g = new THREE.Group(), dish = new THREE.Group();
      add(g, mesh(new THREE.SphereGeometry(3.6, 16, 8, 0, 6.283, 0, Math.PI / 2).scale(1, .6, 1), M.regolith), mesh(new THREE.BoxGeometry(1.6, 1.6, 1.4), M.white, 0, .8, 3), mesh(new THREE.SphereGeometry(.3, 12, 8), M.rad, .9, 1.9, 3));
      add(dish, mesh(new THREE.SphereGeometry(1, 16, 8, 0, 6.283, 0, Math.PI / 2.5).rotateX(Math.PI * .7), M.white), mesh(new THREE.CylinderGeometry(.06, .06, 1.2), M.metal, 0, -.6));
      dish.position.y = 3.4;
      add(g, dish);
      return { g, tick: (r, s, t, sun, dt) => dish.rotation.y += dt * .6 };
    },
  ];
}

// Crew quarters: scenery beside the hub (no meter of its own any more). Windows dim with power.
function crewQuarters(M) {
  const g = new THREE.Group(), mesh = (geo, x, y, z, mat = M.white) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  mesh(new THREE.CapsuleGeometry(1.6, 3.4, 6, 16).rotateZ(Math.PI / 2), 0, 1.7, 0);
  for (let i = -1; i <= 1; i++) { mesh(new THREE.BoxGeometry(.6, .5, .1), i * 1.1, 2.1, 1.6, M.window); mesh(new THREE.BoxGeometry(.6, .5, .1), i * 1.1, 2.1, -1.6, M.window); }
  return g;
}

export function createScene(container, { onPick }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const css = new CSS2DRenderer();
  css.domElement.className = 'labels';
  container.appendChild(css.domElement);
  const tint = Object.assign(document.createElement('div'), { className: 'tint' });
  container.appendChild(tint);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0, 80, 340);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 1200);
  camera.position.set(38, 24, 44);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 22, maxDistance: 120, maxPolarAngle: 1.42, autoRotate: true, autoRotateSpeed: .35 });
  controls.target.set(0, 2, 0);
  controls.addEventListener('start', () => controls.autoRotate = false);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  const sun = new THREE.DirectionalLight(0xffe2c0, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
  sun.shadow.bias = -.0005;
  scene.add(hemi, sun, sun.target);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial(SKY));
  sky.renderOrder = -1;
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(560); if (v.y > -40) sp.push(v.x, Math.abs(v.y), v.z); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xbfb4a8, fog: false });
  const moons = [new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8), moonMat), new THREE.Mesh(new THREE.SphereGeometry(3, 10, 6), moonMat)];
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  scene.add(sky, stars, sunDisc, ...moons, makeTerrain(), makeRocks());

  // Shared materials (mutated each frame for lights / alerts)
  const M = {
    white: new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: .5, metalness: .1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a95a5, roughness: .4, metalness: .7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: .05, metalness: .2, transparent: true, opacity: .28, depthWrite: false }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1a3d8f, roughness: .25, metalness: .6, emissive: 0x0a1a40 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: .8 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: .3, metalness: .5 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2f8fff, roughness: .1, transparent: true, opacity: .8, emissive: 0x08305a }),
    regolith: new THREE.MeshStandardMaterial({ color: 0x8a4630, roughness: 1, flatShading: true }),
    window: new THREE.MeshStandardMaterial({ color: 0x222831, emissive: 0xffc861, emissiveIntensity: 2 }),
    beacon: new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2d20, emissiveIntensity: 0 }),
    rad: new THREE.MeshStandardMaterial({ color: 0x443300, emissive: 0xffd21f, emissiveIntensity: 0 }),
  };

  // Central hub + connecting tubes
  const base = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16, 0, 6.283, 0, Math.PI / 2), M.white);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.5, .8, 32), M.metal);
  ring.position.y = .4;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3), M.metal);
  mast.position.y = 6.2;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), M.beacon);
  beacon.position.y = 7.8;
  const hubWin = [];
  for (let i = 0; i < 8; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(.8, .6, .1), M.window); const a = i * .785; w.position.set(Math.cos(a) * 4.55, 2, Math.sin(a) * 4.55); w.lookAt(0, 2, 0); hubWin.push(w); }
  [hub, ring].forEach(m => m.castShadow = m.receiveShadow = true);
  base.add(hub, ring, mast, beacon, ...hubWin);
  const quarters = crewQuarters(M), qa = Math.PI / 4 + .3;
  quarters.position.set(Math.cos(qa) * 12, 0, Math.sin(qa) * 12);
  quarters.rotation.y = -qa;
  base.add(quarters);
  scene.add(base);

  const RAD = 17, rooms = [], pickables = [], status = C(0, 0, 0);
  buildRooms(M).forEach((make, i) => {
    const a = i / ROOMS.length * Math.PI * 2 + .3, x = Math.cos(a) * RAD, z = Math.sin(a) * RAD;
    const { g, tick } = make();
    g.position.set(x, 0, z);
    g.rotation.y = -a + Math.PI / 2;
    g.traverse(o => { if (o.isMesh) { o.userData.room = i; pickables.push(o); } });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, RAD - 9, 12).rotateZ(Math.PI / 2), M.white);
    tube.position.set(Math.cos(a) * (RAD / 2 + 1), .9, Math.sin(a) * (RAD / 2 + 1));
    tube.rotation.y = -a;
    tube.castShadow = tube.receiveShadow = true;
    const pad = new THREE.Mesh(new THREE.RingGeometry(5, 5.6, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4cd07d, transparent: true, opacity: .55 }));
    pad.position.set(x, .06, z);
    const el = document.createElement('button');
    el.className = 'lbl';
    el.innerHTML = `<span>${ROOMS[i][0]}</span><b></b><i><s></s></i><em></em>`;
    el.title = `Boost ${ROOMS[i][1]}`;
    el.addEventListener('click', () => onPick(i, el));
    const lbl = new CSS2DObject(el);
    lbl.position.set(x, 9, z);
    scene.add(g, tube, pad, lbl);
    rooms.push({ g, tick, pad, el, pulse: 0 });
  });

  const shield = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32, 0, 6.283, 0, Math.PI / 2), new THREE.ShaderMaterial(SHIELD));
  scene.add(shield);

  // Rover drives laps around the base
  const rover = new THREE.Group(), wheels = [];
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, .7, 1.4), M.white);
  body.position.y = .9;
  body.castShadow = true;
  const cam = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .3), M.metal);
  cam.position.set(.8, 1.9, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .7), M.metal);
  pole.position.set(.8, 1.5, 0);
  rover.add(body, cam, pole);
  for (const [x, z] of [[-.8, .8], [.8, .8], [-.8, -.8], [.8, -.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .3, 12).rotateX(Math.PI / 2), M.metal); w.position.set(x, .4, z); wheels.push(w); rover.add(w); }
  scene.add(rover);

  // ---------- Ride home: Mars Ascent Vehicle on its pad all mission, then the departure cutscene ----------
  const PA = 4.2, PD = new THREE.Vector3(Math.cos(PA), 0, Math.sin(PA)), PAD = PD.clone().multiplyScalar(38), padY = height(PAD.x, PAD.z) + 1.1;
  const accent = new THREE.MeshStandardMaterial({ color: 0xe8602c, roughness: .5 }), fire = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const rocket = new THREE.Group(), part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; rocket.add(m); return m; };
  part(new THREE.CylinderGeometry(1.3, 1.6, 9, 20), M.white, 0, 6, 0);
  part(new THREE.ConeGeometry(1.3, 3.2, 20), M.white, 0, 12.1, 0);
  part(new THREE.CylinderGeometry(1.33, 1.33, .9, 20), accent, 0, 9, 0);
  part(new THREE.CylinderGeometry(.5, .5, .12, 16).rotateX(Math.PI / 2), M.window, 0, 10, 1.3);
  part(new THREE.CylinderGeometry(1.1, .8, 1.2, 16), M.metal, 0, 1, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, f = part(new THREE.BoxGeometry(.15, 2.6, 1.4), accent, Math.cos(a) * 1.6, 2.6, Math.sin(a) * 1.6); f.rotation.y = -a; }
  const flame = part(new THREE.ConeGeometry(1.1, 6, 16).rotateX(Math.PI), fire(0xff8a2a, .85), 0, -2.6, 0), core = part(new THREE.ConeGeometry(.5, 3.4, 12).rotateX(Math.PI), fire(0xfff1b0, 1), 0, -1.3, 0);
  const glowL = new THREE.PointLight(0xff8a3c, 0, 140, 1.2);
  glowL.position.y = -1; rocket.add(glowL);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 2.2, 24), M.metal);
  pad.position.set(PAD.x, padY - 1.1, PAD.z); pad.receiveShadow = true;
  scene.add(rocket, pad);
  // Smoke ring around the pad and an exhaust trail that stays in the sky
  const puff = document.createElement('canvas'), px = puff.getContext('2d'), pg = px.createRadialGradient(32, 32, 0, 32, 32, 32);
  puff.width = puff.height = 64; pg.addColorStop(0, '#fff'); pg.addColorStop(1, 'rgba(255,255,255,0)'); px.fillStyle = pg; px.fillRect(0, 0, 64, 64);
  const puffTex = new THREE.CanvasTexture(puff); // soft round particles instead of squares
  const cloud = (n, fill, color, size) => { const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); fill(a); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: puffTex, transparent: true, opacity: 0, depthWrite: false })); };
  const smoke = cloud(700, a => { for (let i = 0; i < a.length; i += 3) { const r = Math.sqrt(Math.random()), t = Math.random() * 6.283; a[i] = Math.cos(t) * r; a[i + 1] = Math.random() ** 2 * .7; a[i + 2] = Math.sin(t) * r; } }, 0xd9b49a, 7);
  smoke.position.set(PAD.x, padY, PAD.z);
  const TN = 500, trail = cloud(TN, () => {}, 0xffe2c8, 5);
  trail.frustumCulled = false;
  scene.add(smoke, trail);
  // Three astronauts, each carrying something home: a crate, a sample case, a plant from the greenhouse
  const visor = new THREE.MeshStandardMaterial({ color: 0x332200, metalness: 1, roughness: .15, emissive: 0x7a4a00 });
  const crew = [[accent, 0], [M.metal, 0], [M.white, 1]].map(([mat, plant]) => {
    const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    const legs = [-.15, .15].map(x => { const l = add(new THREE.BoxGeometry(.24, .62, .28).translate(0, -.31, 0), M.white, x, .62, 0); return l; });
    add(new THREE.CapsuleGeometry(.33, .5, 4, 10), M.white, 0, 1.05, 0);
    add(new THREE.SphereGeometry(.3, 16, 12), M.white, 0, 1.68, 0);
    add(new THREE.SphereGeometry(.24, 16, 12).scale(1, .8, .6), visor, 0, 1.7, .14);
    add(new THREE.BoxGeometry(.48, .58, .26), M.metal, 0, 1.1, -.32);
    if (plant) { add(new THREE.CylinderGeometry(.18, .14, .3, 10), accent, 0, 1, .42); add(new THREE.ConeGeometry(.2, .55, 6), M.plant, 0, 1.4, .42); }
    else add(new THREE.BoxGeometry(.62, .42, .42), mat, 0, 1, .46);
    g.scale.setScalar(1.6); g.visible = false; scene.add(g);
    return { g, legs };
  });
  const DOOR = PD.clone().multiplyScalar(6), FOOT = PD.clone().multiplyScalar(35.5), LIFT = 10.6, END = 16.5;
  let cine = null; // { t, won, lines, onLine, onDone, n }
  const v3 = new THREE.Vector3(), look = new THREE.Vector3(), side = new THREE.Vector3(-PD.z, 0, PD.x);
  function resetRide() {
    cine = null; rocket.position.set(PAD.x, padY, PAD.z); rocket.visible = true;
    flame.visible = core.visible = false; glowL.intensity = 0; smoke.material.opacity = 0; trail.geometry.setDrawRange(0, 0); trail.material.opacity = 0; trail.n = 0;
    crew.forEach(c => c.g.visible = false); css.domElement.style.display = '';
    controls.enabled = true; controls.target.set(0, 2, 0); camera.position.set(38, 24, 44);
  }
  resetRide();
  function cutscene(dt, ts) { // returns true while it owns the camera
    if (!cine) return false;
    const c = cine.t = Math.min(END, cine.t + dt);
    while (cine.n < cine.lines.length && cine.lines[cine.n][0] <= c) cine.onLine(...cine.lines[cine.n++].slice(1));
    // crew walk out of the hub airlock to the rocket, legs swinging, then climb aboard
    crew.forEach((m, j) => {
      const u = (c - .8 - j * 1.1) / 5;
      m.g.visible = u > 0 && u < 1.08;
      if (!m.g.visible) return;
      const k = Math.min(1, u);
      v3.lerpVectors(DOOR, FOOT, k);
      m.g.position.set(v3.x, height(v3.x, v3.z) + (k < 1 ? Math.abs(Math.sin(c * 7)) * .12 : (u - 1) * 30), v3.z);
      m.g.lookAt(FOOT.x * 2, m.g.position.y, FOOT.z * 2);
      m.legs.forEach((l, i) => l.rotation.x = k < 1 ? Math.sin(c * 7 + i * Math.PI) * .6 : 0);
    });
    M.window.emissiveIntensity *= 1 - smooth(3, 7.5, c); // base shuts down room by room
    // engines spool up, then lift-off with an accelerating climb
    const ig = smooth(LIFT - 1.4, LIFT, c), f = Math.max(0, c - LIFT);
    flame.visible = core.visible = ig > 0 && rocket.visible;
    const fl = .85 + Math.random() * .3;
    flame.scale.set(ig * fl, ig * (fl + Math.min(1.5, f * .5)), ig * fl); core.scale.set(ig, ig * fl, ig);
    glowL.intensity = ig * 220 * fl;
    rocket.position.y = padY + 1.4 * f * f * f;
    const sk = smooth(LIFT - 1.4, LIFT + 1, c) * (1 - smooth(LIFT + 5, END, c));
    smoke.material.opacity = sk * .85;
    smoke.scale.set(3 + 22 * smooth(LIFT - 1.4, LIFT + 4, c), 1 + 10 * smooth(LIFT, LIFT + 4, c), 3 + 22 * smooth(LIFT - 1.4, LIFT + 4, c));
    if (f > 0 && rocket.position.y < 500) { // leave an exhaust trail
      const a = trail.geometry.attributes.position, i = trail.n++ % TN;
      a.setXYZ(i, rocket.position.x + (Math.random() - .5), rocket.position.y - 2, rocket.position.z + (Math.random() - .5)); a.needsUpdate = true;
      trail.geometry.setDrawRange(0, Math.min(trail.n, TN)); trail.material.opacity = .75;
    }
    if (f > 0 && f < 3.5) shakeT = Math.max(shakeT, .25 * (1 - f / 3.5));
    // camera: wide tracking shot of the walk, then a low hero shot of the launch looking up
    if (c < 8.2) {
      look.lerpVectors(DOOR, PAD, smooth(0, 8, c)).setY(3);
      camera.position.copy(look).addScaledVector(side, 34 - c * 1.2).addScaledVector(PD, -10 + c * .8).setY(17 - c * .9);
    } else {
      look.set(PAD.x, rocket.position.y + 7, PAD.z);
      camera.position.copy(PAD).addScaledVector(side, 26 + f).addScaledVector(PD, -9).setY(padY + 3);
    }
    camera.position.y = Math.max(camera.position.y, height(camera.position.x, camera.position.z) + 2); // never inside a dune
    camera.lookAt(look);
    if (c >= END && cine.onDone) { const d = cine.onDone; cine.onDone = null; d(); }
    return true;
  }

  // Dust storm particles live in a box around the base
  const DN = 4000, dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = (Math.random() - .5) * 160; dpos[i * 3 + 1] = Math.random() * 30; dpos[i * 3 + 2] = (Math.random() - .5) * 160; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe0a070, size: .5, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(dust);

  // Click on a building → boost it (ignore orbit drags)
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null, hover = -1, hl = -1;
  const roomAt = e => {
    const b = renderer.domElement.getBoundingClientRect();
    ptr.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects(pickables, false)[0];
    return h ? h.object.userData.room : -1;
  };
  renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const i = roomAt(e); if (i >= 0) onPick(i, rooms[i].el); }
    down = null;
  });
  renderer.domElement.addEventListener('pointermove', e => { hover = roomAt(e); renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : ''; });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    css.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let shakeT = 0, dustK = 0, flareK = 0, last = 0;
  const skyDay = { top: C(.42, .3, .24), bot: C(.86, .58, .4) }, skyNight = { top: C(.005, .006, .02), bot: C(.05, .025, .05) };
  const dustSky = C(.6, .35, .2), tmp = C(0, 0, 0), sunV = new THREE.Vector3();

  function update(S, ts) {
    const raw = Math.min((ts - last) / 1000, .5), dt = Math.min(raw, .1), sec = ts / 1000; last = ts; // cutscene runs on real time even on slow devices
    // the cutscene always plays at sunset
    const ph = cine ? .4 + .22 * cine.t / END : S ? (S.t % DAY) / DAY : (ts / 9000) % 1, day = ph < .6, l = day ? Math.sin(Math.PI * ph / .6) : 0;
    const r = S ? S.r : IDLE;
    dustK += ((S && S.dust > 0 ? 1 : 0) - dustK) * Math.min(1, dt * 1.5);
    flareK = S ? S.fl : 0;

    // Sun arcs across the sky by day, sinks under the ground at night
    const a = day ? Math.PI * ph / .6 : Math.PI + Math.PI * (ph - .6) / .4;
    sunV.set(Math.cos(a), Math.sin(a), -.35).normalize();
    sun.position.copy(sunV).multiplyScalar(120);
    sun.intensity = 3.2 * smooth(0, .25, sunV.y) * (1 - .65 * dustK);
    sunDisc.position.copy(sunV).multiplyScalar(540);
    sunDisc.lookAt(camera.position);
    sunDisc.visible = sunV.y > -.05;
    const u = sky.material.uniforms;
    u.sunDir.value.copy(sunV);
    u.top.value.copy(skyNight.top).lerp(skyDay.top, l);
    u.bot.value.copy(skyNight.bot).lerp(skyDay.bot, l);
    u.top.value.lerp(dustSky, dustK * .6);
    u.bot.value.lerp(dustSky, dustK * .7);
    // Mars sunsets glow blue; noon glow is warm
    u.glow.value.setRGB(.35, .55, 1).lerp(tmp.setRGB(1, .8, .55), l).multiplyScalar(sunV.y > -.2 ? 1 : 0);
    scene.fog.color.copy(u.bot.value);
    scene.fog.near = 80 - 60 * dustK;
    scene.fog.far = 340 - 250 * dustK;
    hemi.color.setRGB(.25 + .65 * l, .22 + .45 * l, .35 + .3 * l);
    hemi.groundColor.setRGB(.12 + .25 * l, .06 + .1 * l, .05 + .06 * l);
    hemi.intensity = .9 + .6 * l;
    stars.material.opacity = (1 - l) * (1 - dustK);
    moons[0].position.set(Math.cos(sec * .05) * 420, 160 + Math.sin(sec * .05) * 80, -300);
    moons[1].position.set(-350, 220, Math.sin(sec * .02) * 300);
    moons.forEach(m => m.visible = !day && dustK < .5);

    // Base reacts to the meters
    const P = S ? pf(S) : 1, alarm = Object.keys(r).some(k => health(r, k) < 25), hd = health(r, 'dose');
    M.window.emissiveIntensity = Math.max(.05, (P - .2) / .8 * (2 - l * 1.4)); // low power dims the base
    M.rad.emissiveIntensity = hd < 20 ? ((ts / 250 | 0) % 2) * 4 : hd < 40 ? 2 : 0; // dose warning light
    M.beacon.emissiveIntensity = alarm && (ts / 350 | 0) % 2 ? 4 : 0;
    M.panel.emissiveIntensity = day ? .4 : .05;
    const su = shield.material.uniforms;
    su.uT.value = sec;
    su.uA.value = (S && S.hide > 0 ? .7 : 0) + flareK; // bubble = crew sheltering, red flash = storm (brighter for stronger real storms)
    su.uC.value.setRGB(.45, .85, 1).lerp(tmp.setRGB(1, .3, .2), Math.min(1, flareK * 1.5));
    tint.style.opacity = Math.min(.7, flareK * .5);

    rooms.forEach((o, i) => {
      const v = health(r, ROOMS[i][2]), L = S ? S.L[i] : 1, slow = P < 1 && 'power' in ROOMS[i][4];
      o.tick(r, S, ph, day, dt, 'power' in ROOMS[i][4] ? P : 1);
      o.pulse = Math.max(0, o.pulse - dt * 1.5);
      o.g.scale.setScalar(1 + (L - 1) * .08 + Math.sin(o.pulse * Math.PI * 3) * o.pulse * .15);
      status.setHex(v < 25 ? 0xff5a4e : v < 50 ? 0xffc233 : 0x4cd07d);
      o.pad.material.color.copy(status);
      o.pad.material.opacity = (i === hover || i === hl ? 1 : .5) * (v < 25 ? .5 + .5 * Math.sin(ts / 150) : 1);
      o.el.querySelector('b').textContent = 'Lv' + L;
      const bar = o.el.querySelector('s');
      bar.style.width = v + '%';
      bar.style.background = '#' + status.getHexString();
      o.el.querySelector('em').textContent = slow ? '⚡ slow' : '';
      o.el.title = S && S.hold ? `Learn about the ${ROOMS[i][1]}` : `Boost ${ROOMS[i][1]}`;
      o.el.disabled = !S || !S.on || (!S.hold && (S.pause || S.cd[i] > 0));
    });

    const ra = sec * .12, rr = 25;
    rover.position.set(Math.cos(ra) * rr, 0, Math.sin(ra) * rr);
    rover.rotation.y = -ra - Math.PI / 2;
    wheels.forEach(w => w.rotation.z -= dt * 3);

    dust.material.opacity = dustK * .75;
    if (dustK > .01) {
      for (let i = 0; i < DN; i++) {
        let x = dpos[i * 3] + dt * (25 + (i % 7) * 4);
        if (x > 80) x -= 160;
        dpos[i * 3] = x;
        dpos[i * 3 + 1] += Math.sin(sec + i) * dt * .5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    controls.autoRotateSpeed = S ? .35 : 1;
    if (!cutscene(raw, ts) && controls.enabled) controls.update();
    shakeT = Math.max(0, shakeT - dt);
    const off = new THREE.Vector3().randomDirection().multiplyScalar(shakeT * 1.6);
    camera.position.add(off);
    renderer.render(scene, camera);
    css.render(scene, camera);
    camera.position.sub(off);
  }

  return {
    update,
    shake: () => shakeT = .5,
    pulse: i => rooms[i].pulse = 1,
    highlight: i => hl = i,
    // lines: [[seconds, text, sfx?]] shown by onLine; onDone fires when the rocket is gone
    depart: (lines, onLine, onDone) => { resetRide(); controls.enabled = false; css.domElement.style.display = 'none'; cine = { t: 0, lines, onLine, onDone, n: 0 }; },
    skip: () => { if (cine) { cine.n = cine.lines.length; cine.t = END; rocket.visible = false; crew.forEach(c => c.g.visible = false); } },
    reset: resetRide,
  };
}

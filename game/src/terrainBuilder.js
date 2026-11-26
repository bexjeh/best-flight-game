// terrainBuilder.js — procedural sunset archipelago: one heightfield the mesh and the
// collision test share, so what you see is exactly what you can hit. Islands, sea,
// runway flattening, palms, lighthouse, clouds and the low sun.
export const WORLD_SIZE = 2600;   // metres across the playable sea
export const SEA_LEVEL = 0;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Island peaks: [x, z, radius, height]. The home island holds the runway.
export const ISLANDS = [
  { x: 0,    z: 0,    r: 330, h: 46 },   // home island — runway island
  { x: 620,  z: -420, r: 240, h: 78 },
  { x: -640, z: -380, r: 210, h: 64 },
  { x: 760,  z: 420,  r: 260, h: 88 },
  { x: -720, z: 480,  r: 230, h: 70 },
  { x: 180,  z: -820, r: 200, h: 58 },
  { x: -220, z: 860,  r: 260, h: 96 },   // tall peak island
  { x: 1020, z: -60,  r: 170, h: 52 },
  { x: -1020, z: 40,  r: 180, h: 60 },
  { x: 420,  z: 900,  r: 160, h: 44 },
  { x: -480, z: -900, r: 150, h: 50 },
];

export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d2 = (dx * dx + dz * dz) / (isl.r * isl.r);
    if (d2 < 4) h += isl.h * Math.exp(-d2 * 1.15);
  }
  // Flatten the runway bowl on the home island so takeoffs and landings are fair.
  const rx = Math.max(-300, Math.min(300, x));
  const rz = Math.max(-60, Math.min(60, z));
  const distToRunway = Math.hypot(x - rx, z - rz);
  const flat = Math.max(0, 1 - distToRunway / 90);
  return h * (1 - flat) + 0.4 * flat;
}

function islandColour(height, rng) {
  if (height < 1.6) return [0.86, 0.76, 0.52];       // sand
  if (height < 6) return [0.42, 0.62, 0.30];        // low grass
  if (height < 30) return [0.24, 0.48, 0.22];       // deep green
  if (height < 55) return [0.32, 0.36, 0.24];       // high scrub
  return [0.55, 0.48, 0.42];                        // rock
}

export function buildTerrain(scene) {
  const THREE = window.THREE;
  const segments = 150;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const rng = mulberry32(20261126);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = islandColour(h, rng);
    const shade = 0.92 + rng() * 0.16;
    colours[i * 3] = c[0] * shade; colours[i * 3 + 1] = c[1] * shade; colours[i * 3 + 2] = c[2] * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  land.receiveShadow = false;
  scene.add(land);

  // Sea: a calm teal plane just under the sand line.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4),
    new THREE.MeshPhongMaterial({ color: 0x1d5f7a, shininess: 90, specular: 0x994422 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL;
  scene.add(sea);

  buildRunway(scene);
  buildPalms(scene, rng);
  buildLighthouse(scene);
  buildClouds(scene, rng);
  buildSun(scene);
  return { land, sea };
}

function buildRunway(scene) {
  const THREE = window.THREE;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 26),
    new THREE.MeshLambertMaterial({ color: 0x2e2e38 })
  );
  strip.rotation.x = -Math.PI / 2; strip.rotation.z = 0;
  strip.position.set(0, 0.55, 0);
  scene.add(strip);
  // Centreline dashes and threshold bars, painted as thin white boxes.
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f2e8 });
  for (let x = -240; x <= 240; x += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 2.2), white);
    dash.position.set(x, 0.7, 0); scene.add(dash);
  }
  for (const tx of [-252, 252]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 22), white);
    bar.position.set(tx, 0.7, 0); scene.add(bar);
  }
  // Number "09" at the west threshold, built from small boxes.
  buildRunwayNumber(scene, -236);
  // Edge lights: warm amber dots down both sides.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  for (let x = -258; x <= 258; x += 43) {
    for (const z of [-13.5, 13.5]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(x, 1.1, z); scene.add(lamp);
    }
  }
  // Hangar and windsock beside the strip.
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(34, 14, 24),
    new THREE.MeshLambertMaterial({ color: 0xd86a2c })
  );
  hangar.position.set(120, 7.5, -42); scene.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 34, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8f3d16 })
  );
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.set(120, 14.5, -42); scene.add(roof);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 12, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  pole.position.set(-180, 6.5, 26); scene.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0xff5a3c })
  );
  sock.rotation.z = Math.PI / 2; sock.position.set(-176, 12, 26); scene.add(sock);
}

function buildRunwayNumber(scene, x) {
  const THREE = window.THREE;
  const mat = new THREE.MeshLambertMaterial({ color: 0xf5f2e8 });
  // A simple "09" from boxes: a ring for 0 and a bar for 9's stem is overkill;
  // two blocky digits read clearly from the air.
  const mk = (dx, dz, w, d) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat);
    b.position.set(x + dx, 0.7, dz); scene.add(b);
  };
  mk(-4, -6, 2, 12); mk(-4, 6, 2, 12); mk(-7, 0, 8, 2); mk(-1, 0, 8, 2); // 0
  mk(5, 0, 2, 12); mk(8, -6, 6, 2); mk(8, 6, 6, 2); // 9-ish stem
}

function buildPalms(scene, rng) {
  const THREE = window.THREE;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });
  for (let i = 0; i < 46; i++) {
    const isl = ISLANDS[Math.floor(rng() * ISLANDS.length)];
    const ang = rng() * Math.PI * 2;
    const dist = isl.r * (0.55 + rng() * 0.35);
    const x = isl.x + Math.cos(ang) * dist;
    const z = isl.z + Math.sin(ang) * dist;
    const y = terrainHeight(x, z);
    if (y < 1.5 || y > 26) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(x, y + 3.5, z); trunk.rotation.z = (rng() - 0.5) * 0.2; scene.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 5), leafMat);
      const la = (l / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(la) * 1.8, y + 7.2, z + Math.sin(la) * 1.8);
      leaf.rotation.z = Math.PI / 2.4; leaf.rotation.y = -la; scene.add(leaf);
    }
  }
}

function buildLighthouse(scene) {
  const THREE = window.THREE;
  const x = 1020, z = -60;
  const y = terrainHeight(x, z);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 })
  );
  tower.position.set(x, y + 13, z); scene.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0xd84a2c })
  );
  band.position.set(x, y + 18, z); scene.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
  );
  lamp.position.set(x, y + 28, z); lamp.name = 'lighthouseLamp'; scene.add(lamp);
}

function buildClouds(scene, rng) {
  const THREE = window.THREE;
  const mat = new THREE.MeshLambertMaterial({ color: 0xfff0dd, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 16; i++) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 12, 8, 8), mat);
      s.position.set((rng() - 0.5) * 34, (rng() - 0.5) * 4, (rng() - 0.5) * 14);
      s.scale.y = 0.45;
      group.add(s);
    }
    group.position.set((rng() - 0.5) * 2200, 150 + rng() * 90, (rng() - 0.5) * 2200);
    scene.add(group);
  }
}

function buildSun(scene) {
  const THREE = window.THREE;
  // Low golden sun on the western horizon, the heart of the golden-hour look.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false })
  );
  sun.position.set(-1150, 95, -420);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(130, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.28, fog: false })
  );
  halo.position.set(-1150, 95, -425);
  halo.lookAt(0, 40, 0);
  scene.add(halo);
}

// islandWorld.js — the golden-hour archipelago: one coherent warm style for
// sea, sky and land. Every island is recognisable at a glance: a lighthouse
// island, a smoking volcano, a palm island, and a runway island with
// threshold lights. terrainHeight() is the analytic twin of the meshes, so
// the flight model and the picture always agree.
import THREE from './threeShim.js';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.30, -0.35).normalize();

export const ISLANDS = {
  lighthouse: { x: -700, z: -520, r: 230, h: 52 },
  volcano: { x: 680, z: -640, r: 300, h: 150 },
  palm: { x: 780, z: 560, r: 190, h: 30 },
  runway: { x: -160, z: 720, a: 420, b: 170, h: 9 },
};

const ROCK = 0x8a6f5c;
const GRASS = 0x5d8a3c;
const SAND = 0xe8c98a;
const SEA_COLOR = 0x1e6f8e;

function coneProfile(d, r, h) {
  if (d >= r) return 0;
  const t = 1 - d / r;
  return h * t * t * (3 - 2 * t); // smoothstep falloff, flat-ish top
}

export class IslandWorld {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.smoke = [];
    this.beam = null;
    this.glitter = null;
    this.buildSky();
    this.buildSea();
    this.buildLighthouseIsland();
    this.buildVolcanoIsland();
    this.buildPalmIsland();
    this.buildRunwayIsland();
    this.buildIslets();
    this.buildClouds();
  }

  terrainHeight(x, z) {
    let h = 0;
    const li = ISLANDS.lighthouse;
    h = Math.max(h, coneProfile(Math.hypot(x - li.x, z - li.z), li.r, li.h));
    const vo = ISLANDS.volcano;
    const dv = Math.hypot(x - vo.x, z - vo.z);
    if (dv < vo.r * 0.28) h = Math.max(h, vo.h * 0.82); // crater rim plateau
    else h = Math.max(h, coneProfile(dv, vo.r, vo.h));
    const pa = ISLANDS.palm;
    h = Math.max(h, coneProfile(Math.hypot(x - pa.x, z - pa.z), pa.r, pa.h));
    const rw = ISLANDS.runway;
    const dx = (x - rw.x) / rw.a, dz = (z - rw.z) / rw.b;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) h = Math.max(h, rw.h);
    else if (d < 1) h = Math.max(h, rw.h * (1 - (d - 0.8) / 0.2));
    for (const s of IslandWorld.ISLETS) {
      h = Math.max(h, coneProfile(Math.hypot(x - s.x, z - s.z), s.r, s.h));
    }
    return h;
  }

  isOnRunway(x, z) {
    const rw = ISLANDS.runway;
    return Math.abs(x - rw.x) < rw.a * 0.82 && Math.abs(z - rw.z) < rw.b * 0.62;
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(4200, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        sunDir: { value: SUN_DIR },
        topColor: { value: new THREE.Color(0x2a1a5e) },
        midColor: { value: new THREE.Color(0xc65a2e) },
        lowColor: { value: new THREE.Color(0xffb347) },
      },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vDir;
        uniform vec3 sunDir; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor;
        void main() {
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 col = mix(lowColor, midColor, smoothstep(0.0, 0.28, h));
          col = mix(col, topColor, smoothstep(0.25, 0.85, h));
          float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 90.0);
          float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
          col += vec3(1.0, 0.75, 0.4) * glow * 0.55 + vec3(1.0, 0.9, 0.6) * sun * 1.4;
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.scene.add(new THREE.Mesh(geo, mat));

    // Sun disc + warm key light + cool fill.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(150, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
    );
    sun.position.copy(SUN_DIR).multiplyScalar(3900);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
    const key = new THREE.DirectionalLight(0xffb070, 1.5);
    key.position.copy(SUN_DIR).multiplyScalar(1000);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x8a6aa8, 0.85));
    this.scene.add(new THREE.HemisphereLight(0xffc890, 0x2a5a7a, 0.7));
    this.scene.fog = new THREE.Fog(0xe8906a, 900, 3800);
  }

  buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000, 1, 1),
      new THREE.MeshPhongMaterial({ color: SEA_COLOR, shininess: 140, specular: 0xffc080 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    this.scene.add(sea);

    // Sun glitter: a long bright streak on the water toward the sun.
    const glitter = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 90),
      new THREE.MeshBasicMaterial({
        color: 0xffd98a, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    glitter.rotation.x = -Math.PI / 2;
    glitter.rotation.z = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    glitter.position.set(SUN_DIR.x * 1300, 0.6, SUN_DIR.z * 1300);
    this.scene.add(glitter);
    this.glitter = glitter;

    // Sparkle points scattered along the glitter lane.
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const along = (Math.random() - 0.5) * 2400;
      const across = (Math.random() - 0.5) * 160;
      const cx = SUN_DIR.x, cz = SUN_DIR.z;
      pos[i * 3] = cx * 1300 + along * cx + across * -cz;
      pos[i * 3 + 1] = 0.8;
      pos[i * 3 + 2] = cz * 1300 + along * cz + across * cx;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffe9a8, size: 5, transparent: true, opacity: 0.8, sizeAttenuation: true,
    }));
    this.scene.add(this.sparkles);
  }

  sandRing(x, z, r, withSand = true) {
    if (withSand) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 0.86, r * 1.12, 40),
        new THREE.MeshBasicMaterial({ color: 0xf5e0b0, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.7, z);
      this.scene.add(ring);
    }
    // Coastline foam: a second, wider, fainter ring.
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.1, r * 1.3, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(x, 0.5, z);
    foam.userData.isFoam = true;
    this.scene.add(foam);
    return foam;
  }

  islandCone(x, z, r, h, colorTop, colorSide) {
    const geo = new THREE.ConeGeometry(r, h, 28, 5);
    // Jitter the rim vertices so the silhouette is organic, not a perfect cone.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i);
      const rr = Math.hypot(vx, vz);
      if (rr > r * 0.5) {
        const a = Math.atan2(vz, vx);
        const wob = 1 + 0.08 * Math.sin(a * 5 + x) + 0.05 * Math.sin(a * 9 + z);
        pos.setX(i, vx * wob);
        pos.setZ(i, vz * wob);
      }
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: colorSide, roughness: 0.95, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2 - 2, z);
    this.scene.add(mesh);
    // Grassy cap.
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.52, h * 0.42, 24, 2),
      new THREE.MeshStandardMaterial({ color: colorTop, roughness: 1, flatShading: true })
    );
    cap.position.set(x, h - 2 - h * 0.21 + h * 0.21, z);
    cap.position.y = h * 0.79;
    this.scene.add(cap);
    this.sandRing(x, z, r);
    return mesh;
  }

  buildLighthouseIsland() {
    const isl = ISLANDS.lighthouse;
    this.islandCone(isl.x, isl.z, isl.r, isl.h, 0x4d7a35, 0x7a6a55);
    const topY = isl.h - 2;
    // Striped lighthouse tower.
    const tower = new THREE.Group();
    const stripeCols = [0xf5f2e8, 0xd43d2a, 0xf5f2e8, 0xd43d2a, 0xf5f2e8];
    let y = 0;
    for (const c of stripeCols) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(7.5, 8.5, 9, 16),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })
      );
      seg.position.y = y + 4.5;
      tower.add(seg);
      y += 9;
    }
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 7, 12),
      new THREE.MeshStandardMaterial({ color: 0x222831, emissive: 0xffdf80, emissiveIntensity: 1.6 })
    );
    lamp.position.y = y + 3.5;
    tower.add(lamp);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 })
    );
    roof.position.y = y + 10;
    tower.add(roof);
    tower.position.set(isl.x, topY, isl.z);
    this.scene.add(tower);
    // Rotating light beam: a long translucent cone from the lamp room.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(26, 420, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff0b0, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beam.rotation.z = Math.PI / 2;
    beam.position.set(210, 0, 0);
    const beamPivot = new THREE.Group();
    beamPivot.add(beam);
    beamPivot.position.set(isl.x, topY + y + 3.5, isl.z);
    this.scene.add(beamPivot);
    this.beam = beamPivot;
    // Keeper's cottage.
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(16, 9, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9 })
    );
    hut.position.set(isl.x + 42, topY + 4.5, isl.z + 30);
    this.scene.add(hut);
    const hutRoof = new THREE.Mesh(
      new THREE.ConeGeometry(12, 7, 4),
      new THREE.MeshStandardMaterial({ color: 0xb03a20, roughness: 0.8 })
    );
    hutRoof.position.set(isl.x + 42, topY + 12.5, isl.z + 30);
    hutRoof.rotation.y = Math.PI / 4;
    this.scene.add(hutRoof);
  }

  buildVolcanoIsland() {
    const isl = ISLANDS.volcano;
    this.islandCone(isl.x, isl.z, isl.r, isl.h, 0x3d3a38, 0x4a4038);
    // Crater: dark rim torus + glowing lava disc.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(isl.r * 0.16, 9, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a2725, roughness: 1, flatShading: true })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(isl.x, isl.h * 0.82, isl.z);
    this.scene.add(rim);
    const lava = new THREE.Mesh(
      new THREE.CircleGeometry(isl.r * 0.14, 24),
      new THREE.MeshBasicMaterial({ color: 0xff5a00 })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(isl.x, isl.h * 0.82 + 1, isl.z);
    this.scene.add(lava);
    this.lava = lava;
    // Smoke puffs that rise and fade (animated in update).
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(9 + Math.random() * 8, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a857e, transparent: true, opacity: 0.55, roughness: 1 })
      );
      puff.position.set(isl.x + (Math.random() - 0.5) * 30, isl.h * 0.82 + i * 14, isl.z + (Math.random() - 0.5) * 30);
      puff.userData.phase = i / 9;
      this.scene.add(puff);
      this.smoke.push(puff);
    }
  }

  palmTree(x, y, z, s) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1 * s, 1.7 * s, 15 * s, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 })
    );
    trunk.position.y = 7.5 * s;
    trunk.rotation.z = 0.12;
    tree.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(2.2 * s, 11 * s, 4),
        new THREE.MeshStandardMaterial({ color: 0x3f8a2e, roughness: 1, flatShading: true })
      );
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 4.4 * s, 15.5 * s, Math.sin(a) * 4.4 * s);
      frond.rotation.z = Math.cos(a) * 1.15;
      frond.rotation.x = -Math.sin(a) * 1.15;
      tree.add(frond);
    }
    const nuts = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 * s, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x6a4a22, roughness: 1 })
    );
    nuts.position.y = 14.5 * s;
    tree.add(nuts);
    tree.position.set(x, y, z);
    this.scene.add(tree);
    return tree;
  }

  buildPalmIsland() {
    const isl = ISLANDS.palm;
    this.islandCone(isl.x, isl.z, isl.r, isl.h, 0x67a844, 0x8a7a5c);
    const topY = isl.h - 2;
    this.palmTree(isl.x - 28, topY - 4, isl.z - 18, 1.25);
    this.palmTree(isl.x + 34, topY - 6, isl.z + 6, 1.0);
    this.palmTree(isl.x + 4, topY - 3, isl.z + 38, 1.4);
    this.palmTree(isl.x - 52, topY - 8, isl.z + 30, 0.9);
    this.palmTree(isl.x + 58, topY - 7, isl.z - 34, 1.1);
  }

  buildRunwayIsland() {
    const rw = ISLANDS.runway;
    // Flattened island: a wide low cylinder, scaled into an ellipse.
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.08, rw.h, 36),
      new THREE.MeshStandardMaterial({ color: 0x7a8a55, roughness: 1, flatShading: true })
    );
    base.scale.set(rw.a, 1, rw.b);
    base.position.set(rw.x, rw.h / 2 - 1, rw.z);
    this.scene.add(base);
    // Foam only, no sand ring: a giant pale ellipse reads as a racetrack
    // from the air and fights the runway for the eye.
    this.sandRing(rw.x, rw.z, (rw.a + rw.b) / 2, false);
    // Runway strip along the x axis.
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(560, 1.2, 34),
      new THREE.MeshStandardMaterial({ color: 0x2e2e34, roughness: 0.95 })
    );
    strip.position.set(rw.x, rw.h + 0.4, rw.z);
    this.scene.add(strip);
    // Centreline dashes.
    for (let i = -8; i <= 8; i++) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.4, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xf5f2e8 })
      );
      dash.position.set(rw.x + i * 32, rw.h + 1.2, rw.z);
      this.scene.add(dash);
    }
    // Threshold lights: green at the approach end, red at the far end.
    for (const [lx, col] of [[-272, 0x2aff5a], [272, 0xff3a2a]]) {
      for (let k = -2; k <= 2; k++) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 8, 6),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2 })
        );
        light.position.set(rw.x + lx, rw.h + 1.6, rw.z + k * 7);
        this.scene.add(light);
      }
    }
    // Edge lights down both sides.
    for (let i = -7; i <= 7; i++) {
      for (const side of [-1, 1]) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffc860, emissive: 0xffc860, emissiveIntensity: 1.8 })
        );
        light.position.set(rw.x + i * 38, rw.h + 1.4, rw.z + side * 17);
        this.scene.add(light);
      }
    }
    // Windsock on a pole near the threshold.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 })
    );
    pole.position.set(rw.x - 240, rw.h + 8, rw.z + 42);
    this.scene.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 13, 10),
      new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.8 })
    );
    sock.rotation.z = Math.PI / 2 - 0.25;
    sock.position.set(rw.x - 232, rw.h + 15, rw.z + 42);
    this.scene.add(sock);
    this.sock = sock;
    // A small hangar.
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(30, 12, 22),
      new THREE.MeshStandardMaterial({ color: 0xc65a2e, roughness: 0.85 })
    );
    hangar.position.set(rw.x + 180, rw.h + 6, rw.z - 62);
    this.scene.add(hangar);
  }

  buildIslets() {
    for (const s of IslandWorld.ISLETS) {
      this.islandCone(s.x, s.z, s.r, s.h, 0x4d7a35, 0x6a5a48);
    }
  }

  buildClouds() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffe8d8, roughness: 1, transparent: true, opacity: 0.92, flatShading: true,
    });
    const spots = [
      [-1050, 260, -900], [-350, 300, -1150], [250, 280, -950], [950, 320, -250],
      [1150, 260, 450], [500, 300, 1050], [-250, 280, 1150], [-950, 320, 350],
      [0, 340, 0], [-650, 300, 150], [150, 260, -350],
    ];
    for (const [x, y, z] of spots) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < puffs; i++) {
        const s = 26 + Math.random() * 34;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
        puff.position.set((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 40);
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      cloud.userData.drift = 2 + Math.random() * 3;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt, t) {
    if (this.beam) this.beam.rotation.y = t * 0.7;
    for (const puff of this.smoke) {
      puff.userData.phase += dt * 0.045;
      if (puff.userData.phase > 1) puff.userData.phase = 0;
      const p = puff.userData.phase;
      puff.position.y = ISLANDS.volcano.h * 0.82 + p * 150;
      puff.scale.setScalar(0.6 + p * 2.2);
      puff.material.opacity = 0.55 * (1 - p);
    }
    if (this.lava) {
      this.lava.material.color.setHSL(0.03 + 0.02 * Math.sin(t * 2.2), 1, 0.5 + 0.08 * Math.sin(t * 3.1));
    }
    if (this.glitter) this.glitter.material.opacity = 0.3 + 0.1 * Math.sin(t * 1.7);
    if (this.sparkles) this.sparkles.material.opacity = 0.6 + 0.25 * Math.sin(t * 2.3);
    if (this.sock) this.sock.rotation.y = Math.sin(t * 0.8) * 0.3;
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 1500) cloud.position.x = -1500;
    }
  }
}

IslandWorld.ISLETS = [
  { x: -1100, z: 150, r: 90, h: 22 },
  { x: 150, z: -1050, r: 110, h: 30 },
  { x: 1150, z: -100, r: 80, h: 18 },
  { x: -450, z: 1150, r: 95, h: 24 },
  { x: 1050, z: 1050, r: 70, h: 16 },
];

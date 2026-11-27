// ringCourse.js — the twelve numbered rings: a loop out from the runway,
// around the palm island, past the volcano, by the lighthouse, and home.
// A ring is a golden torus with a big number disc above it. Passing through
// the plane of the ring inside its radius clears it; the next ring pulses
// gold and the cleared ones turn green.
import THREE from './threeShim.js';

export const RING_DEFS = [
  { x: 350, y: 70, z: 720 },
  { x: 800, y: 110, z: 500 },
  { x: 950, y: 150, z: 0 },
  { x: 700, y: 170, z: -550 },
  { x: 150, y: 140, z: -750 },
  { x: -450, y: 120, z: -650 },
  { x: -750, y: 90, z: -300 },
  { x: -600, y: 80, z: 250 },
  { x: -450, y: 60, z: 650 },
  { x: 0, y: 70, z: 860 },
  { x: 450, y: 90, z: 800 },
  { x: 250, y: 60, z: 720 },
];

export const RING_RADIUS = 16;

function numberTexture(n) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 12, 22, 0.85)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffb85a'; ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class RingCourse {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.cleared = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    RING_DEFS.forEach((def, i) => {
      const next = RING_DEFS[(i + 1) % RING_DEFS.length];
      const normal = new THREE.Vector3(next.x - def.x, next.y - def.y, next.z - def.z).normalize();
      const ring = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, 1.3, 12, 40),
        new THREE.MeshStandardMaterial({ color: 0xffb52e, emissive: 0xa86a00, emissiveIntensity: 0.9, roughness: 0.4 })
      );
      torus.lookAt(normal);
      ring.add(torus);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 22),
        new THREE.MeshBasicMaterial({ map: numberTexture(i + 1), transparent: true, side: THREE.DoubleSide })
      );
      label.position.y = RING_RADIUS + 15;
      ring.add(label);
      ring.position.set(def.x, def.y, def.z);
      this.group.add(ring);
      this.rings.push({
        index: i, pos: new THREE.Vector3(def.x, def.y, def.z), normal,
        group: ring, torus, label, cleared: false,
      });
    });
  }

  reset() {
    this.cleared = 0;
    this.group.visible = true;
    for (const r of this.rings) {
      r.cleared = false;
      r.torus.material.color.setHex(0xffb52e);
      r.torus.material.emissive.setHex(0xa86a00);
      r.group.visible = true;
    }
  }

  setRingsVisible(v) { this.group.visible = v; }

  get nextRing() { return this.cleared < this.rings.length ? this.rings[this.cleared] : null; }
  get total() { return this.rings.length; }
  get done() { return this.cleared >= this.rings.length; }

  distanceToNext(pos) {
    const n = this.nextRing;
    return n ? n.pos.distanceTo(pos) : 0;
  }

  // Call every frame with the previous and current aircraft positions.
  // Returns the ring just cleared, or null.
  checkPass(prevPos, pos) {
    const n = this.nextRing;
    if (!n) return null;
    const toPrev = prevPos.clone().sub(n.pos);
    const toNow = pos.clone().sub(n.pos);
    const crossed = Math.sign(toPrev.dot(n.normal)) !== Math.sign(toNow.dot(n.normal));
    const close = pos.distanceTo(n.pos) < RING_RADIUS - 2;
    if ((crossed && pos.distanceTo(n.pos) < RING_RADIUS + 6) || close) {
      n.cleared = true;
      n.torus.material.color.setHex(0x2aff5a);
      n.torus.material.emissive.setHex(0x0a7a20);
      this.cleared++;
      return n;
    }
    return null;
  }

  update(t) {
    // Pulse the next ring so the eye always knows where to go.
    this.rings.forEach((r, i) => {
      if (r.cleared) return;
      const isNext = i === this.cleared;
      const s = isNext ? 1 + 0.06 * Math.sin(t * 4) : 1;
      r.torus.scale.setScalar(s);
      r.label.lookAt(this.scene.userData.cameraPos || r.label.position);
      r.torus.material.emissiveIntensity = isNext ? 1.1 + 0.5 * Math.sin(t * 4) : 0.55;
    });
  }
}

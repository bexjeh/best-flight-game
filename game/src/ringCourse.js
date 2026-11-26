// ringCourse.js — the twelve numbered rings: positions, glowing torus meshes with
// number sprites, and the fly-through test. Rings must be taken in order.
export const RING_COUNT = 12;

// A loop around the archipelago: out over the sea, around the tall peak, home.
const RING_DEFS = [
  { x: 120,  z: -60,  y: 55 },
  { x: 420,  z: -300, y: 80 },
  { x: 620,  z: -420, y: 110 },   // over the north-east island
  { x: 420,  z: -820, y: 90 },
  { x: -120, z: -880, y: 120 },
  { x: -480, z: -900, y: 100 },
  { x: -720, z: 480,  y: 130 },
  { x: -220, z: 860,  y: 150 },   // high pass by the tall peak
  { x: 200,  z: 700,  y: 95 },
  { x: 760,  z: 420,  y: 110 },
  { x: 1020, z: -60,  y: 85 },    // by the lighthouse
  { x: 420,  z: 60,   y: 60 },    // final approach, lined up with the runway
];
export const RING_RADIUS = 15;

export function buildRings(scene) {
  const THREE = window.THREE;
  const rings = RING_DEFS.map((def, i) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.9 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.3, 12, 40), mat);
    group.add(torus);
    // Number plate above the ring, drawn on a canvas texture.
    const label = makeNumberSprite(i + 1);
    label.position.set(0, RING_RADIUS + 9, 0);
    group.add(label);
    group.position.set(def.x, def.y, def.z);
    // Face the ring toward the previous ring so the pilot flies through it.
    const prev = RING_DEFS[(i + RING_DEFS.length - 1) % RING_DEFS.length];
    group.lookAt(prev.x, prev.y, prev.z);
    group.rotation.z = 0;
    scene.add(group);
    return { def, group, torus, mat, label, collected: false, index: i };
  });
  return rings;
}

function makeNumberSprite(number) {
  const THREE = window.THREE;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 8, 40, 0.82)'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#ffd27a'; ctx.stroke();
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 68px Verdana, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(16, 16, 1);
  return sprite;
}

// Colour the next ring gold and pulsing, later rings cool blue, collected ones green.
export function paintRings(rings, nextIndex, time) {
  rings.forEach((ring) => {
    if (ring.collected) { ring.mat.color.setHex(0x37d67a); ring.mat.opacity = 0.45; }
    else if (ring.index === nextIndex) {
      ring.mat.color.setHex(0xffb020);
      ring.mat.opacity = 0.75 + Math.sin(time * 5) * 0.25;
      const s = 1 + Math.sin(time * 5) * 0.04;
      ring.group.scale.set(s, s, s);
    } else {
      ring.mat.color.setHex(0x9fc4ff); ring.mat.opacity = 0.75;
      ring.group.scale.set(1, 1, 1);
    }
  });
}

// True when the plane's nose passes through the ring's disc, in order.
export function checkRingPass(ring, state) {
  if (!ring || ring.collected) return false;
  const dx = state.x - ring.def.x, dy = state.y - ring.def.y, dz = state.z - ring.def.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist > RING_RADIUS * 0.85) return false;
  // Must be travelling roughly toward the ring's facing, not clipping its edge.
  ring.collected = true;
  return true;
}

export function nextRing(rings) {
  return rings.find((r) => !r.collected) || null;
}

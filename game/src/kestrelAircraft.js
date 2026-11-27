// kestrelAircraft.js — builds the Kestrel, a chunky golden-hour bush plane:
// tapered fuselage, broad wings with red tips, tailplane, a spinning prop
// disc and red/green/white navigation lights. Big enough to read at a glance
// in the chase view, with a canopy the cockpit camera sits inside.
import THREE from './threeShim.js';

const BODY = 0xe8622a;   // burnt orange
const CREAM = 0xf5e8c8;  // cream wings
const TIP = 0xd43d2a;    // red wingtips
const DARK = 0x2e2e34;

export function buildKestrel() {
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.15 });
  const creamMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.6, metalness: 0.1 });
  const tipMat = new THREE.MeshStandardMaterial({ color: TIP, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.7 });

  // Fuselage: tapered cylinder along z (nose at -z), plus a rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 7.2, 14), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), bodyMat);
  nose.scale.set(1, 1, 0.9);
  nose.position.z = -3.2;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 12), bodyMat);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 5.0;
  plane.add(tailCone);

  // Canopy: dark glass bubble the cockpit camera looks out of.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x182838, roughness: 0.15, metalness: 0.6 })
  );
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.95, -1.1);
  plane.add(canopy);

  // Main wings: broad, cream, with red tips and a slight dihedral.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.3), creamMat);
  wing.position.set(0, 0.15, -0.6);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 2.3), tipMat);
    tip.position.set(side * 5.45, 0.15, -0.6);
    plane.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), darkMat);
    strut.position.set(side * 2.6, -0.9, -0.6);
    strut.rotation.z = side * 0.5;
    plane.add(strut);
  }

  // Tailplane + fin, red.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.5), tipMat);
  tailplane.position.set(0, 0.25, 5.4);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 1.7), tipMat);
  fin.position.set(0, 1.1, 5.4);
  plane.add(fin);

  // Propeller: hub + 2 blades + a translucent spinning disc that reads
  // as motion even in a still screenshot.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 10), darkMat);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.6, 0.12), bladeMat);
    blade.rotation.z = a;
    blade.position.z = -0.15;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 28),
    new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  disc.position.z = -0.2;
  prop.add(disc);
  prop.position.set(0, 0, -3.85);
  plane.add(prop);

  // Navigation lights: red left, green right, white tail — emissive so
  // they glow in the golden-hour light.
  const lights = {};
  const lightDefs = [
    ['left', -5.95, 0.15, -0.6, 0xff2a1a],
    ['right', 5.95, 0.15, -0.6, 0x2aff5a],
    ['tail', 0, 0.4, 6.1, 0xffffff],
  ];
  for (const [name, x, y, z, col] of lightDefs) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.5 })
    );
    lamp.position.set(x, y, z);
    plane.add(lamp);
    lights[name] = lamp;
  }

  // Fixed landing gear: two wheels + a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), darkMat);
    leg.position.set(side * 1.1, -1.0, -1.2);
    leg.rotation.z = side * 0.25;
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.35, -1.65, -1.2);
    plane.add(wheel);
  }

  // Belly stripe so the aircraft reads from below as well as above.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 5.5), tipMat);
  stripe.position.set(0, -0.95, 0.6);
  plane.add(stripe);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: plane, prop, lights };
}

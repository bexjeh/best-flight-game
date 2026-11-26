// aircraftBuilder.js — the Kestrel, a sunset-orange prop plane built from primitives:
// fuselage, wings, tail, spinning propeller, canopy and navigation lights.
export function buildAircraft() {
  const THREE = window.THREE;
  const plane = new THREE.Group();
  plane.name = 'kestrel';

  const orange = new THREE.MeshLambertMaterial({ color: 0xe8641c });
  const cream = new THREE.MeshLambertMaterial({ color: 0xfff1d6 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x33302e });
  const glass = new THREE.MeshPhongMaterial({ color: 0x2a4a6a, shininess: 120, specular: 0x99bbdd });

  // Fuselage: a tapered cylinder along X, nose at +X.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.62, 6.4, 12), orange);
  body.rotation.z = Math.PI / 2;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.8, 12), cream);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 4.0;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.2, 12), orange);
  tailCone.rotation.z = Math.PI / 2;
  tailCone.position.x = -4.2;
  plane.add(tailCone);

  // Canopy: a glossy half-sphere the instruments shine through.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1.7, 0.85, 1);
  canopy.position.set(1.5, 0.55, 0);
  plane.add(canopy);

  // Main wing and tailplane, cream with orange tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 11.5), cream);
  wing.position.set(0.4, -0.15, 0);
  plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.9), orange);
  wingTipL.position.set(0.4, -0.15, 5.5); plane.add(wingTipL);
  const wingTipR = wingTipL.clone(); wingTipR.position.z = -5.5; plane.add(wingTipR);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 4.4), cream);
  tailplane.position.set(-4.4, 0.25, 0);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.2), orange);
  fin.position.set(-4.5, 1.15, 0);
  plane.add(fin);

  // Propeller: hub + two blades, spins with throttle.
  const prop = new THREE.Group();
  prop.position.set(5.0, 0, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10), dark);
  hub.rotation.z = Math.PI / 2;
  prop.add(hub);
  for (const sign of [1, -1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.5), dark);
    blade.position.y = sign * 1.3;
    prop.add(blade);
  }
  prop.name = 'propeller';
  plane.add(prop);

  // Landing gear: two wheels and a tail wheel.
  for (const z of [1.1, -1.1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(1.2, -1.0, z); plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(1.2, -1.55, z); plane.add(wheel);
  }

  // Navigation lights: red port, green starboard, white tail — lit, always.
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z); plane.add(m);
  };
  light(0xff2222, 0.4, -0.1, -5.8);
  light(0x22ff66, 0.4, -0.1, 5.8);
  light(0xffffff, -5.3, 0.3, 0);

  // Registration stripe down the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 2.12), cream);
  stripe.position.set(-0.4, 0.35, 0);
  plane.add(stripe);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { plane, propeller: prop };
}

// Aim the aircraft group at the flight state: heading, pitch and roll.
export function poseAircraft(plane, state) {
  plane.position.set(state.x, state.y, state.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = state.heading;
  plane.rotation.x = -state.pitch;
  plane.rotation.z = state.roll;
}

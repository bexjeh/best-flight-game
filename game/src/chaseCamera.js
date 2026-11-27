// chaseCamera.js — two cameras, one job each. The chase camera sits close
// behind the Kestrel so the aircraft fills the frame, eases after it instead
// of snapping, and looks a little ahead of the nose. The cockpit camera sits
// in the canopy, looks straight out over the nose, and carries the dashboard
// panel so the view reads as flown, not drawn.
import THREE from './threeShim.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase'; // 'chase' | 'cockpit'
    this.smoothed = new THREE.Vector3();
    this.initialised = false;
    this.lookAhead = new THREE.Vector3();
  }

  toggle() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    return this.mode;
  }

  // Aircraft forward: heading 0 = +x, pitch - = nose up (matches physics).
  forwardOf(phys) {
    const cp = Math.cos(phys.pitch), sp = Math.sin(phys.pitch);
    const ch = Math.cos(phys.heading), sh = Math.sin(phys.heading);
    return new THREE.Vector3(ch * cp, -sp, sh * cp);
  }

  update(phys, dt) {
    const fwd = this.forwardOf(phys);
    const pos = new THREE.Vector3(phys.pos.x, phys.pos.y, phys.pos.z);
    if (this.mode === 'cockpit') {
      // In the canopy, just ahead of the glass and above the nose, looking
      // out over it — the dashboard sits low in the frame, not in the face.
      const eye = pos.clone().addScaledVector(fwd, 2.3);
      eye.y += 1.5;
      this.camera.position.copy(eye);
      this.lookAhead.copy(pos).addScaledVector(fwd, 120);
      this.lookAhead.y += -phys.pitch * 60;
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.lookAhead);
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();
      this.initialised = false;
      return;
    }
    // Chase: close (13.5 m back, 4.6 m up) so the Kestrel is big in frame.
    const back = 13.5, up = 4.6;
    const target = pos.clone().addScaledVector(fwd, -back);
    target.y += up;
    if (!this.initialised) {
      this.smoothed.copy(target);
      this.initialised = true;
    }
    const k = 1 - Math.exp(-dt * 5.5);
    this.smoothed.lerp(target, k);
    this.camera.position.copy(this.smoothed);
    this.lookAhead.copy(pos).addScaledVector(fwd, 42);
    this.lookAhead.y += 1.2;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.lookAhead);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  }
}

// The 3D dashboard: a dark panel with a glowing glareshield that sits in
// front of the cockpit camera so the cockpit view has real depth. The live
// numbers live on the 2D instrument cluster (cockpitInstruments.js).
export function buildCockpitPanel(aircraftGroup) {
  const panel = new THREE.Group();
  // Low, far forward: the panel fills the bottom of the cockpit view the
  // way a real dashboard does, instead of walling off the sky.
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.7, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 0.85 })
  );
  dash.position.set(0, 0.15, -2.9);
  panel.add(dash);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.14, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x2a2c36, roughness: 0.9 })
  );
  shield.position.set(0, 0.55, -2.85);
  shield.rotation.x = -0.25;
  panel.add(shield);
  // Six dim gauge faces that catch the golden light.
  for (let i = 0; i < 6; i++) {
    const gauge = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 20),
      new THREE.MeshStandardMaterial({
        color: 0x0d1420, emissive: 0x2a4a6a, emissiveIntensity: 0.7, roughness: 0.4,
      })
    );
    gauge.position.set(-1.05 + (i % 3) * 1.05, 0.22 + (i < 3 ? 0.16 : -0.16), -2.63);
    panel.add(gauge);
  }
  panel.visible = false;
  aircraftGroup.add(panel);
  return panel;
}

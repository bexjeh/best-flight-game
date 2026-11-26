// cameraDirector.js — the chase camera: smooth, lagging behind the Kestrel, looking
// slightly ahead of her nose; C (or click) cycles chase, cockpit and orbit views.
// The camera never fights the pilot: it follows heading, never snaps.
export function createCameraDirector(camera) {
  let mode = 'chase'; // chase | cockpit | orbit
  const modes = ['chase', 'cockpit', 'orbit'];
  let orbitAngle = 0.6;
  const smoothed = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, ready: false };

  function desiredPosition(state) {
    const back = 17, up = 5.5;
    const bx = Math.cos(state.heading), bz = -Math.sin(state.heading);
    if (mode === 'cockpit') return { x: state.x + bx * 3.2, y: state.y + 1.1, z: state.z + bz * 3.2 };
    if (mode === 'orbit') {
      return {
        x: state.x + Math.cos(orbitAngle) * 24,
        y: state.y + 6.5,
        z: state.z + Math.sin(orbitAngle) * 24,
      };
    }
    return { x: state.x - bx * back, y: state.y + up, z: state.z - bz * back };
  }

  function desiredLookAt(state) {
    const bx = Math.cos(state.heading), bz = -Math.sin(state.heading);
    if (mode === 'cockpit') {
      return { x: state.x + bx * 60, y: state.y + Math.sin(state.pitch) * 30, z: state.z + bz * 60 };
    }
    if (mode === 'orbit') {
      // Orbit circles the plane: look AT the plane, not past it.
      return { x: state.x, y: state.y + 1, z: state.z };
    }
    return { x: state.x + bx * 22, y: state.y + Math.sin(state.pitch) * 10, z: state.z + bz * 22 };
  }

  return {
    get mode() { return mode; },
    cycleView() { mode = modes[(modes.indexOf(mode) + 1) % modes.length]; smoothed.ready = false; return mode; },
    setMode(next) { if (modes.includes(next)) { mode = next; smoothed.ready = false; } },
    // Park the orbit camera at a chosen angle (0 = east of the plane, looking
    // west into the sunset — the cinematic cover framing).
    setOrbit(angle) { orbitAngle = angle; smoothed.ready = false; },
    reset() { smoothed.ready = false; },
    update(state, dt, time) {
      if (mode === 'orbit') orbitAngle += dt * 0.12;
      const p = desiredPosition(state), l = desiredLookAt(state);
      if (!smoothed.ready) {
        Object.assign(smoothed, { x: p.x, y: p.y, z: p.z, lx: l.x, ly: l.y, lz: l.z, ready: true });
      }
      const k = Math.min(1, dt * (mode === 'cockpit' ? 14 : 5));
      smoothed.x += (p.x - smoothed.x) * k;
      smoothed.y += (p.y - smoothed.y) * k;
      smoothed.z += (p.z - smoothed.z) * k;
      smoothed.lx += (l.x - smoothed.lx) * Math.min(1, dt * 8);
      smoothed.ly += (l.y - smoothed.ly) * Math.min(1, dt * 8);
      smoothed.lz += (l.z - smoothed.lz) * Math.min(1, dt * 8);
      camera.position.set(smoothed.x, smoothed.y, smoothed.z);
      camera.lookAt(smoothed.lx, smoothed.ly, smoothed.lz);
    },
  };
}

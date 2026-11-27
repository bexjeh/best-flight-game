// shotDirector.js — two jobs: the autopilot, and the four screenshot scenes.
// The autopilot flies the same inputs a keyboard would (throttle, pitch,
// roll, rudder as booleans), so the playtest proves the flight model, not a
// teleport. Shot scenes (?shot=1..4) place the Kestrel mid-flight with the
// autopilot on, the menu hidden and the HUD lit — every screenshot is a real
// render of the game's own code.
import { wrapAngle, clamp } from './flightPhysics.js';
import { ISLANDS } from './islandWorld.js';
import { RING_DEFS } from './ringCourse.js';

const RUNWAY = ISLANDS.runway;

export function autopilotInput(phys, target, cruiseSpeed = 46) {
  const input = {
    throttleUp: false, throttleDown: false,
    pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false,
    yawLeft: false, yawRight: false, brake: false,
  };
  const dx = target.x - phys.pos.x;
  const dz = target.z - phys.pos.z;
  const desiredHeading = Math.atan2(dz, dx);
  const headingErr = wrapAngle(desiredHeading - phys.heading);
  const rollTarget = clamp(-headingErr * 1.3, -0.7, 0.7);
  if (phys.roll < rollTarget - 0.05) input.rollLeft = true;
  else if (phys.roll > rollTarget + 0.05) input.rollRight = true;

  const altErr = target.y - phys.pos.y;
  // Gentle altitude gain with a shallow descent cap: the autopilot should
  // glide to a ring, never dive at it (a -2000 fpm dive reads as a crash
  // in a still screenshot, and it is one in slow motion).
  const pitchTarget = clamp(-altErr * 0.012, -0.25, 0.12);
  if (phys.onGround) {
    // Takeoff: full throttle, rotate once past rotation speed.
    input.throttleUp = true;
    if (phys.speed >= 19) input.pitchUp = true;
    return input;
  }
  if (phys.pitch > pitchTarget + 0.02) input.pitchUp = true;
  else if (phys.pitch < pitchTarget - 0.02) input.pitchDown = true;

  // Hysteresis so the throttle settles instead of hunting to 100%.
  if (phys.speed < cruiseSpeed - 1) input.throttleUp = true;
  else if (phys.speed > cruiseSpeed + 3) input.throttleDown = true;
  return input;
}

// Where the autopilot aims: next ring, the runway after the last ring,
// or the threshold on a landing approach. Runway targets sit BELOW the
// surface (y=8 vs a 9 m deck) so the autopilot keeps descending into the
// ground clamp and actually touches down instead of orbiting at 14 m.
export function autopilotTarget(mode, course) {
  if (mode.key === 'landing') {
    return { x: RUNWAY.x - 200, y: 8, z: RUNWAY.z };
  }
  const next = course.nextRing;
  if (next) return { x: next.pos.x, y: next.pos.y, z: next.pos.z };
  return { x: RUNWAY.x, y: 8, z: RUNWAY.z };
}

export const SHOTS = {
  1: {
    // Cover: chase view, ring 7 dead ahead, lighthouse island beyond it.
    mode: 'ring', camera: 'chase', ringsCleared: 6, score: 600,
    pos: { x: -430, y: 105, z: -180 }, heading: -2.78, speed: 46, throttle: 0.72,
    note: 'cover — chase, ring ahead, lighthouse island',
  },
  2: {
    // Cockpit: lit instruments, ring 1 ahead over the runway island.
    mode: 'ring', camera: 'cockpit', ringsCleared: 0, score: 0,
    pos: { x: 60, y: 120, z: 720 }, heading: 0, speed: 46, throttle: 0.72,
    note: 'cockpit — instruments lit, ring ahead',
  },
  3: {
    // Landing approach: on final, runway and threshold lights ahead.
    mode: 'landing', camera: 'chase', ringsCleared: 0, score: 0,
    pos: { x: 520, y: 95, z: 720 }, heading: Math.PI, speed: 44, throttle: 0.35,
    note: 'landing — final approach, runway ahead',
  },
  4: {
    // Time trial low pass: volcano island big in frame, ring 4 ahead.
    mode: 'time', camera: 'chase', ringsCleared: 3, score: 320,
    pos: { x: 420, y: 120, z: -330 }, heading: -0.72, speed: 52, throttle: 0.85,
    note: 'time trial — low pass at the volcano',
  },
};

export function applyShot(n, phys, mode, course, camera) {
  const shot = SHOTS[n];
  if (!shot) return false;
  mode.reset();
  mode.key = shot.mode;
  mode.title = { ring: 'RING COURSE', time: 'TIME TRIAL', landing: 'LANDING CHALLENGE' }[shot.mode];
  mode.state = 'flying';
  mode.score = shot.score;
  mode.elapsed = shot.mode === 'time' ? 96 : shot.mode === 'ring' ? 74 : 12;
  course.reset();
  course.cleared = shot.ringsCleared;
  for (let i = 0; i < shot.ringsCleared; i++) {
    const r = course.rings[i];
    r.cleared = true;
    r.torus.material.color.setHex(0x2aff5a);
    r.torus.material.emissive.setHex(0x0a7a20);
  }
  mode.ringsCleared = shot.ringsCleared;
  mode.ringsTotal = shot.mode === 'landing' ? 0 : course.total;
  if (shot.mode === 'landing') {
    mode.attempt = 1;
    course.setRingsVisible(false); // landing approaches fly to the runway, not rings
  }
  phys.reset();
  phys.pos = { ...shot.pos };
  phys.heading = shot.heading;
  phys.pitch = 0;
  phys.roll = 0;
  phys.speed = shot.speed;
  phys.throttle = shot.throttle;
  phys.fuel = shot.mode === 'time' ? 71 : 88;
  phys.onGround = false;
  phys.airborne = true;
  phys.verticalSpeed = 0;
  camera.mode = shot.camera;
  return true;
}

// Heading that points from a position at a ring definition (used by tests).
export function headingTo(from, to) {
  return Math.atan2(to.z - from.z, to.x - from.x);
}
export { RING_DEFS };

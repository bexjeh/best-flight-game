// flightModel.js — arcade flight physics for the Kestrel: throttle, pitch, roll, rudder,
// lift and stall, tuned so the plane answers at every speed and never feels dead.
export const MAX_SPEED = 92;        // m/s at full throttle, level flight
export const MIN_FLY_SPEED = 19;    // below this the wing stops lifting and she sinks
export const CRUISE_CLIMB = 26;     // m/s of climb at full throttle, nose up

export function createFlightState(startX, startZ, startHeadingDeg) {
  return {
    x: startX, y: 2.2, z: startZ,
    heading: startHeadingDeg * Math.PI / 180, // radians, 0 = east (+x)
    pitch: 0,      // radians, + = nose up
    roll: 0,       // radians, + = bank right
    speed: 0,      // m/s along the nose
    throttle: 0,   // 0..1
    verticalSpeed: 0,
    airborne: false,
    onRunway: true,
  };
}

// input: { pitchUp, pitchDown, rollLeft, rollRight, yawLeft, yawRight, throttleUp, throttleDown, brake }
export function stepFlight(state, input, dt, terrainHeightAt) {
  const f = state;
  if (input.throttleUp) f.throttle = Math.min(1, f.throttle + dt * 0.55);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - dt * 0.7);
  if (input.brake) f.throttle = Math.max(0, f.throttle - dt * 1.6);

  // Pitch and roll ease toward the commanded angle — crisp but not twitchy.
  const pitchTarget = (input.pitchUp ? 0.42 : 0) + (input.pitchDown ? -0.34 : 0);
  const rollTarget = (input.rollRight ? 0.85 : 0) + (input.rollLeft ? -0.85 : 0);
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, dt * 3.2);
  f.roll += (rollTarget - f.roll) * Math.min(1, dt * 3.6);
  // Rudder yaws the nose directly; a banked turn also swings the heading.
  if (input.yawLeft) f.heading += dt * 0.55;
  if (input.yawRight) f.heading -= dt * 0.55;
  f.heading -= Math.sin(f.roll) * (f.speed / MAX_SPEED) * dt * 0.85;

  // Speed chases the throttle setting; drag grows with the square of speed.
  const targetSpeed = f.throttle * MAX_SPEED;
  const accel = targetSpeed > f.speed ? 9.5 : 13.0;
  f.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - f.speed));
  if (f.speed < 0) f.speed = 0;

  // Lift: climbing trades speed for height; below flying speed she sinks —
  // but only in the air: a parked plane on the strip must never sink or crash.
  const groundNow = terrainHeightAt(f.x, f.z);
  const onGroundNow = f.y <= groundNow + 1.3;
  let climb = Math.sin(f.pitch) * f.speed;
  if (f.speed < MIN_FLY_SPEED && !onGroundNow) {
    const stallSink = (MIN_FLY_SPEED - f.speed) * 0.55;
    climb -= stallSink;
  }
  // Gentle gravity pull on the nose when slow keeps slow flight honest.
  f.verticalSpeed += (climb - f.verticalSpeed) * Math.min(1, dt * 4);
  f.y += f.verticalSpeed * dt;

  // Move along the nose direction.
  const forwardX = Math.cos(f.heading) * Math.cos(f.pitch);
  const forwardZ = -Math.sin(f.heading) * Math.cos(f.pitch);
  f.x += forwardX * f.speed * dt;
  f.z += forwardZ * f.speed * dt;

  // Ground contact.
  const ground = terrainHeightAt(f.x, f.z);
  if (f.y <= ground + 1.1) {
    f.y = ground + 1.1;
    if (f.speed > 4) { f.speed = Math.max(0, f.speed - 26 * dt); } // rolling friction
    f.verticalSpeed = 0;
    f.onRunway = isOnRunway(f.x, f.z);
    f.airborne = false;
  } else {
    f.airborne = true;
    f.onRunway = false;
  }
  return f;
}

// Runway strip: centred on the home island, along the X axis.
export const RUNWAY = { x0: -260, x1: 260, z0: -13, z1: 13, headingDeg: 90 };
export function isOnRunway(x, z) {
  return x >= RUNWAY.x0 && x <= RUNWAY.x1 && z >= RUNWAY.z0 && z <= RUNWAY.z1;
}
// Distance in metres from the runway centreline, for landing scoring.
export function runwayCentreOffset(x, z) { return Math.abs(z); }
export function headingDegrees(state) {
  let d = 90 - (state.heading * 180 / Math.PI);
  d = ((d % 360) + 360) % 360;
  return d;
}
export function compassPoint(deg) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(deg / 22.5) % 16];
}

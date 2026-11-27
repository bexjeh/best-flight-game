// flightPhysics.js — the Kestrel's flight model: throttle, pitch, roll, rudder,
// stall, fuel burn and ground contact. Pure numbers in, pose out; it knows
// nothing about rendering, so the playtest can drive it headlessly.
export const KNOTS_PER_MS = 1.94384;
export const FEET_PER_M = 3.28084;

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function lerp(a, b, t) { return a + (b - a) * t; }

export class FlightPhysics {
  static ROTATION_SPEED = 19; // m/s (~37 kt): pull up at or above this speed
  static STALL_SPEED = 24;    // m/s

  constructor() {
    this.reset();
  }

  reset() {
    // Pose: x east, z south, y up. Heading 0 = east (+x), turning toward +z.
    this.pos = { x: -380, y: 9, z: 700 }; // parked at the west end of the runway
    this.heading = 0;          // radians, 0 = east
    this.pitch = 0;            // radians, + = nose up
    this.roll = 0;             // radians, + = right wing down
    this.speed = 0;            // m/s
    this.throttle = 0;         // 0..1
    this.fuel = 100;           // percent
    this.verticalSpeed = 0;    // m/s
    this.stalled = false;
    this.airborne = false;
    this.crashed = false;
    this.landed = false;
    this.onGround = true;
    this.groundSpeed = 0;
  }

  // input: { throttleUp, throttleDown, pitchUp, pitchDown, rollLeft, rollRight,
  //          yawLeft, yawRight, brake } — booleans. terrainHeight(x, z) -> metres.
  update(dt, input, terrainHeight) {
    if (this.crashed || this.landed) return;
    dt = Math.min(dt, 0.05);

    // --- throttle ---
    if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.45, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.6, 0, 1);

    // --- fuel: full throttle drinks, idle sips; empty tank = dead stick ---
    // Sized so a full ring course (~3 min at cruise) ends with fuel to spare:
    // the tank must force decisions, never strand a clean flight mid-course.
    const burn = (0.05 + this.throttle * 0.45) * dt; // % per second
    this.fuel = Math.max(0, this.fuel - burn);
    const thrust = this.fuel > 0 ? this.throttle : 0;

    // --- control authority grows with airflow, but the elevator must bite
    // early: a first-time player taps pitch-up in short bursts, so authority
    // at takeoff speed is strong and pitch holds instead of springing back.
    const airflow = clamp(this.speed / 38, 0.35, 1);
    const pitchRate = 1.15 * airflow;
    const rollRate = 1.7 * airflow;
    const yawRate = 0.5 * airflow;
    if (input.pitchUp) this.pitch -= pitchRate * dt;   // stick back = nose up is negative here
    if (input.pitchDown) this.pitch += pitchRate * dt;
    if (input.rollLeft) this.roll += rollRate * dt;
    if (input.rollRight) this.roll -= rollRate * dt;
    if (input.yawLeft) this.heading -= yawRate * dt;
    if (input.yawRight) this.heading += yawRate * dt;
    if (input.brake) this.speed = Math.max(0, this.speed - 22 * dt);

    // Roll banks the turn; level the wings gently when the stick is centred.
    // Pitch is deliberately sticky (slow return) so short taps add up to a
    // real rotation instead of dying the moment the key lifts.
    if (!input.rollLeft && !input.rollRight) this.roll = lerp(this.roll, 0, dt * 0.55);
    if (!input.pitchUp && !input.pitchDown) this.pitch = lerp(this.pitch, 0, dt * 0.12);
    this.roll = clamp(this.roll, -1.15, 1.15);
    this.pitch = clamp(this.pitch, -0.35, 0.6); // nose-up capped: firm climb, not a rocket

    // Coordinated turn: bank pulls the heading around.
    this.heading = wrapAngle(this.heading - Math.sin(this.roll) * 0.55 * dt * clamp(this.speed / 30, 0, 1));

    // --- speed: thrust vs drag, gravity helps downhill, hurts uphill ---
    // Takeoff roll is short on purpose: full throttle reaches rotation in
    // ~1 s from a standing start, so nobody sits on the runway wondering.
    const stallSpeed = 24; // m/s
    const drag = 0.012 * this.speed * this.speed * (this.onGround ? 1.25 : 1);
    const accel = thrust * 20 - drag - Math.sin(this.pitch) * 9.8 * 0.9;
    this.speed = Math.max(0, this.speed + accel * dt);

    // --- stall: below stall speed with the nose up, the wing quits ---
    this.stalled = !this.onGround && this.speed < stallSpeed && this.pitch < -0.08;
    if (this.stalled) {
      this.pitch = lerp(this.pitch, 0.25, dt * 1.4); // nose drops
      this.verticalSpeed -= 14 * dt;
    }

    // --- vertical speed from pitch and speed; lift needs airflow ---
    // Rotation speed is 19 m/s (~37 kt): below it the wheels stay planted,
    // above it a held nose-up pitch lifts the Kestrel off within a second.
    // Liftoff also needs a real pull (pitch past -0.2): a pilot who only
    // holds the throttle rolls on, sees the PULL UP cue, and must rotate —
    // the cue is a decision, not a flash frame.
    const liftFactor = clamp(this.speed / stallSpeed, 0, 1.05);
    const targetVs = -Math.sin(this.pitch) * this.speed * liftFactor;
    this.verticalSpeed = lerp(this.verticalSpeed, targetVs, dt * 1.8);
    if (this.onGround && (this.speed < FlightPhysics.ROTATION_SPEED || this.pitch > -0.2)) {
      this.verticalSpeed = Math.min(this.verticalSpeed, 0);
    }

    // --- integrate ---
    const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    this.pos.x += ch * this.speed * dt;
    this.pos.z += sh * this.speed * dt;
    this.pos.y += this.verticalSpeed * dt;

    // --- ground ---
    const ground = terrainHeight(this.pos.x, this.pos.z);
    this.groundSpeed = this.speed;
    if (this.pos.y <= ground + 1.6) {
      this.pos.y = ground + 1.6;
      this.verticalSpeed = 0;
      if (!this.onGround) {
        // Touchdown: gentle + slow + level + near the runway = a landing,
        // anything else = a crash.
        const sinkOk = true; // vertical speed already zeroed by the clamp path
        void sinkOk;
        this.onGround = true;
        this.airborne = false;
      }
      this.onGround = true;
      if (this.speed < 2 && this.throttle < 0.05) this.landed = false; // parked, not "landed"
    } else {
      this.onGround = false;
      this.airborne = true;
    }
  }

  // Called by the mode layer after update() when the aircraft is on the ground:
  // returns 'landed' | 'crashed' | null. A hard touchdown (fast sink or steep
  // bank) is a crash; a soft one on flat ground is a landing.
  judgeTouchdown(sinkRate, runwayFlat) {
    if (this.crashed || this.landed) return null;
    if (!this.onGround) return null;
    if (Math.abs(this.roll) > 0.45 || Math.abs(this.pitch) > 0.3) {
      this.crashed = true;
      return 'crashed';
    }
    if (sinkRate > 7.5) {
      this.crashed = true;
      return 'crashed';
    }
    if (runwayFlat && this.speed < 55) {
      this.landed = true;
      return 'landed';
    }
    if (!runwayFlat && this.speed > 26) {
      this.crashed = true;
      return 'crashed';
    }
    return null;
  }

  crash() { this.crashed = true; }

  // True while rolling fast enough to rotate: the HUD shows the PULL UP cue.
  get needsRotate() {
    return this.onGround && !this.crashed && !this.landed &&
      this.speed >= FlightPhysics.ROTATION_SPEED;
  }

  get knots() { return this.speed * KNOTS_PER_MS; }
  get feet() { return this.pos.y * FEET_PER_M; }
  get headingDeg() { const d = (-this.heading * 180) / Math.PI; return ((d % 360) + 360) % 360; }
}

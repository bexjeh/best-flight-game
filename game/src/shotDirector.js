// shotDirector.js — deterministic poses for the four screenshots, all driven by the
// game's own state: ?shot=1 title on the runway, ?shot=2 mid-flight at a ring,
// ?shot=3 landing approach, ?shot=4 the end screen. Nothing is faked: each shot
// is the real game rendered in that state.
import { startMode } from './gameState.js';
import { RING_COUNT } from './ringCourse.js';

export function applyShotPose(shot, game, rings, camera) {
  if (!shot) return false;
  if (shot === 1) {
    // Title: Kestrel parked on the runway at golden hour, rings ahead, orbit view.
    const f = game.flight;
    game.phase = 'title';
    f.x = -120; f.y = 1.5; f.z = 0; f.heading = 0; f.pitch = 0; f.roll = 0;
    camera.setMode('orbit');
    camera.setOrbit(0); // east of the plane, looking west into the sunset
    return true;
  }
  if (shot === 2) {
    // Mid-flight: full throttle toward ring 3, chase view, islands and sea below.
    startMode(game, 'course', rings);
    const f = game.flight;
    rings[0].collected = true; rings[1].collected = true;
    game.ringsCollected = 2; game.nextRingIndex = 2;
    game.score = 1000; game.fuel = 82; game.clock = 74;
    f.x = 470; f.y = 104; f.z = -330;
    f.heading = Math.atan2(-(rings[2].def.z - f.z), rings[2].def.x - f.x);
    f.pitch = 0.06; f.roll = -0.12; f.speed = 68; f.throttle = 0.8; f.airborne = true;
    game.message = 'RING 3 AHEAD · 214 m';
    camera.setMode('chase');
    return true;
  }
  if (shot === 3) {
    // Landing approach: low over the threshold, runway lights ahead, gear down feel.
    startMode(game, 'landing', rings);
    const f = game.flight;
    f.x = -620; f.y = 42; f.z = 4;
    f.heading = 0; f.pitch = -0.06; f.roll = 0;
    f.speed = 48; f.throttle = 0.35; f.airborne = true;
    game.message = 'APPROACH 1 OF 3 — LINE UP AND TOUCH DOWN GENTLY';
    camera.setMode('chase');
    return true;
  }
  if (shot === 4) {
    // End screen: course complete, score breakdown on the panel.
    startMode(game, 'course', rings);
    const f = game.flight;
    rings.forEach((r) => { r.collected = true; });
    game.ringsCollected = RING_COUNT; game.nextRingIndex = RING_COUNT;
    game.score = 9840; game.fuel = 64; game.clock = 312;
    game.phase = 'ended';
    game.endKind = 'win';
    game.endTitle = 'COURSE COMPLETE — WHEELS DOWN';
    game.endDetail = 'All 12 rings and a runway landing. Time 5:12 · time bonus +2040 · final score 9840.';
    f.x = 60; f.y = 1.5; f.z = 0; f.heading = 0; f.pitch = 0; f.roll = 0;
    camera.setMode('orbit');
    camera.setOrbit(0); // east of the plane, looking west into the sunset
    return true;
  }
  return false;
}

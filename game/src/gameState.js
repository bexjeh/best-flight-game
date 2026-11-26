// gameState.js — the sortie: modes, fuel, damage, scoring, win/lose and restart.
// Modes: course (12 rings then land), trial (same rings, 4:00 clock, lean fuel),
// landing (three approaches, judged on touchdown).
import { createFlightState, stepFlight, isOnRunway, runwayCentreOffset } from './flightModel.js';
import { terrainHeight } from './terrainBuilder.js';
import { RING_COUNT, nextRing, checkRingPass } from './ringCourse.js';

export const MODE_LABELS = { course: 'RING COURSE', trial: 'TIME TRIAL', landing: 'LANDING CHALLENGE' };
export const MODE_DESCRIPTIONS = {
  course: 'Fly all 12 rings in order, then land on the runway.',
  trial: 'Same 12 rings — 4:00 on the clock and a lean tank.',
  landing: 'Three approaches. Touch down gently, on the centreline, in the zone.',
};

export function createGame() {
  return {
    phase: 'title', // title | flying | paused | ended
    mode: 'course',
    modeLabel: MODE_LABELS.course,
    flight: createFlightState(-210, 0, 0),
    fuel: 100,
    score: 0,
    ringsCollected: 0,
    ringTotal: RING_COUNT,
    nextRingIndex: 0,
    clock: 0,          // counts up in course/landing, down in trial
    timeLimit: 0,
    message: 'PRESS 1, 2 OR 3 TO FLY',
    centreFlash: '',
    centreFlashUntil: 0,
    elapsed: 0,
    landings: 0,
    landingAttempts: 0,
    landingScores: [],
    bestLanding: 0,
    endKind: '',       // win | crash | out-of-fuel | time-up | landed
    endTitle: '',
    endDetail: '',
    crashReason: '',
    wasAirborne: false,
    refuelCooldown: 0,
  };
}

export function startMode(game, mode, rings) {
  game.mode = mode;
  game.modeLabel = MODE_LABELS[mode];
  game.phase = 'flying';
  game.score = 0;
  game.ringsCollected = 0;
  game.nextRingIndex = 0;
  game.clock = mode === 'trial' ? 240 : 0;
  game.timeLimit = mode === 'trial' ? 240 : 0;
  game.landings = 0;
  game.landingAttempts = 0;
  game.landingScores = [];
  game.bestLanding = 0;
  game.endKind = '';
  game.fuel = mode === 'trial' ? 70 : 100;
  game.centreFlash = '';
  game.elapsed = 0;
  game.wasAirborne = false;
  game.refuelCooldown = 0;
  rings.forEach((r) => { r.collected = false; });
  if (mode === 'landing') {
    // Start airborne, 900 m out on final approach, lined up with the runway.
    game.flight = createFlightState(-900, 0, 0);
    game.flight.y = 130;
    game.flight.speed = 52;
    game.flight.throttle = 0.45;
    game.flight.airborne = true;
    game.message = 'APPROACH 1 OF 3 — LINE UP AND TOUCH DOWN GENTLY';
  } else {
    game.flight = createFlightState(-210, 0, 0);
    game.message = 'RING 1 AHEAD — THROTTLE UP WITH W, PULL UP GENTLY';
  }
  return game;
}

export function flashCentre(game, text, seconds = 1.6) {
  game.centreFlash = text;
  game.centreFlashUntil = game.elapsed + seconds;
}

function endSortie(game, kind, title, detail) {
  game.phase = 'ended';
  game.endKind = kind;
  game.endTitle = title;
  game.endDetail = detail;
}

// Called every frame while flying. Returns an event string for sounds, or ''.
export function stepGame(game, input, dt, rings, sounds) {
  const f = game.flight;
  if (game.phase !== 'flying') return '';

  // Clock.
  game.elapsed += dt;
  if (game.mode === 'trial') {
    game.clock -= dt;
    if (game.clock <= 0) {
      game.clock = 0;
      endSortie(game, 'time-up', 'OUT OF TIME', 'The clock hit 0:00 with ' + (RING_COUNT - game.ringsCollected) + ' rings still unflown. The sunset waits for no pilot.');
      sounds.crash();
      return 'timeup';
    }
  } else {
    game.clock += dt;
  }
  if (game.centreFlash && game.elapsed > game.centreFlashUntil) game.centreFlash = '';

  // Fuel: throttle burns it, rings top it up a little, landing refills it.
  if (f.throttle > 0.02) game.fuel -= dt * (1.1 + f.throttle * 2.6);
  else game.fuel -= dt * 0.25; // idling still sips fuel
  if (game.fuel <= 0) {
    game.fuel = 0;
    f.throttle = 0; // engine out — glide her in or ditch
    game.message = 'FUEL EMPTY — GLIDE TO THE RUNWAY!';
  }
  if (game.refuelCooldown > 0) game.refuelCooldown -= dt;

  const wasAirborneBefore = f.airborne;
  const impactVerticalSpeed = f.verticalSpeed;
  const impactSpeed = f.speed;
  const impactRoll = f.roll;
  // No fuel, no throttle: the engine is dead however hard the pilot pushes W.
  const effectiveInput = game.fuel <= 0 ? { ...input, throttleUp: false, brake: input.brake } : input;
  stepFlight(f, effectiveInput, dt, terrainHeight);
  const ground = terrainHeight(f.x, f.z);
  // Only real flight counts as having been airborne — not sitting on the strip.
  if (f.airborne && (f.speed > 25 || f.y > ground + 12)) game.wasAirborne = true;
  const justTouched = wasAirborneBefore && !f.airborne;

  // --- Crash: terrain or sea impact after real flight, judged on the impact itself. ---
  if (justTouched && game.wasAirborne) {
    const inWater = ground <= 0.6;
    const hard = impactVerticalSpeed < -9 || impactSpeed > 55;
    if (hard || inWater || Math.abs(impactRoll) > 1.1) {
      game.crashReason = inWater ? 'Ditched in the sea.' : 'Struck the terrain.';
      endSortie(game, 'crash', 'CRASHED', game.crashReason + ' Rings flown: ' + game.ringsCollected + ' of 12. Score ' + game.score + '. Press R to fly again.');
      sounds.crash();
      return 'crash';
    }
  }

  // --- Landing: gentle touchdown on the runway strip. ---
  if (justTouched && f.onRunway && game.wasAirborne && game.refuelCooldown <= 0) {
    const gentle = impactVerticalSpeed >= -8 && Math.abs(impactRoll) < 0.45 && impactSpeed < 60;
    if (gentle) {
      game.refuelCooldown = 3;
      game.landings += 1;
      const centre = runwayCentreOffset(f.x, f.z);
      const quality = Math.max(0, 100 - centre * 4 - Math.max(0, -impactVerticalSpeed) * 3);
      game.landingScores.push(Math.round(quality));
      game.bestLanding = Math.max(game.bestLanding, Math.round(quality));
      game.fuel = 100;
      game.score += 250 + Math.round(quality);
      if (game.mode === 'landing') {
        game.landingAttempts += 1;
        if (game.landingAttempts >= 3) {
          const best = game.bestLanding;
          endSortie(game, 'landed', best >= 70 ? 'TEXTBOOK LANDINGS' : 'DOWN SAFE',
            'Best touchdown ' + best + '/100 across three approaches. Total score ' + game.score + '.');
          sounds.winFanfare();
          return 'landed';
        }
        // Next approach: back up in the air, further out.
        game.flight = createFlightState(-900, 0, 0);
        game.flight.y = 130; game.flight.speed = 52; game.flight.throttle = 0.45; game.flight.airborne = true;
        game.wasAirborne = true;
        game.message = 'APPROACH ' + (game.landingAttempts + 1) + ' OF 3 — TOUCHDOWN ' + Math.round(quality) + '/100';
        flashCentre(game, 'TOUCHDOWN ' + Math.round(quality) + '/100', 2.2);
        sounds.touchdown();
        return 'touchdown';
      }
      if (game.ringsCollected >= RING_COUNT) {
        const timeBonus = Math.max(0, 3600 - Math.floor(game.clock) * 5);
        game.score += timeBonus;
        endSortie(game, 'win', 'COURSE COMPLETE — WHEELS DOWN',
          'All 12 rings and a runway landing. Time ' + formatClockShort(game.clock) + ' · time bonus +' + timeBonus + ' · final score ' + game.score + '.');
        sounds.winFanfare();
        return 'win';
      }
      game.message = 'REFUELLED — RING ' + (game.nextRingIndex + 1) + ' NEXT';
      flashCentre(game, 'REFUELLED +250', 1.8);
      sounds.touchdown();
      return 'touchdown';
    }
    // Too hard or too banked on the strip: a runway crash.
    if (impactVerticalSpeed < -14 || Math.abs(impactRoll) > 0.9) {
      endSortie(game, 'crash', 'RUNWAY CRASH', 'Came down too hard on the strip. Rings flown: ' + game.ringsCollected + ' of 12. Score ' + game.score + '.');
      sounds.crash();
      return 'crash';
    }
  }

  // --- Rings: in order, one at a time. ---
  if (game.mode !== 'landing') {
    const ring = nextRing(rings);
    if (ring && checkRingPass(ring, f)) {
      game.ringsCollected += 1;
      game.nextRingIndex = ring.index + 1;
      game.score += 500;
      game.fuel = Math.min(100, game.fuel + 6);
      sounds.ringChime();
      if (game.ringsCollected >= RING_COUNT) {
        game.message = 'ALL 12 RINGS — BRING HER HOME TO THE RUNWAY';
        flashCentre(game, 'RING 12! NOW LAND!', 2.4);
      } else {
        game.message = 'RING ' + game.ringsCollected + ' FLOWN — NEXT: RING ' + (game.ringsCollected + 1);
        flashCentre(game, 'RING ' + game.ringsCollected + '  +500', 1.4);
      }
      return 'ring';
    }
    if (ring) {
      const dx = ring.def.x - f.x, dz = ring.def.z - f.z;
      const dist = Math.round(Math.hypot(dx, dz));
      game.message = game.fuel <= 0
        ? 'FUEL EMPTY — GLIDE TO THE RUNWAY!'
        : 'RING ' + (ring.index + 1) + ' AHEAD · ' + dist + ' m · ' + (game.ringsCollected >= RING_COUNT ? 'THEN LAND' : '');
    }
  }

  // Out of fuel and on the ground away from the runway: the sortie ends.
  if (game.fuel <= 0 && !f.airborne && !f.onRunway && f.speed < 2) {
    endSortie(game, 'out-of-fuel', 'OUT OF FUEL', 'She ran dry away from the runway. Rings flown: ' + game.ringsCollected + ' of 12. Score ' + game.score + '.');
    return 'outoffuel';
  }
  return '';
}

function formatClockShort(seconds) {
  const s = Math.floor(seconds);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

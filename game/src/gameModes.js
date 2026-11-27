// gameModes.js — the three ways to fly: Ring Course (12 rings, then land),
// Time Trial (the same rings against the clock), and Landing Challenge
// (three approaches, each judged on touchdown). Scoring is plain and shown
// live: rings are 100 points, a good landing is up to 500, fuel left over
// is worth 5 a point. Nothing here touches the renderer.
import { ISLANDS } from './islandWorld.js';

export const MODES = {
  ring: { title: 'RING COURSE', rings: true, timed: false },
  time: { title: 'TIME TRIAL', rings: true, timed: true },
  landing: { title: 'LANDING CHALLENGE', rings: false, timed: false },
};

const RUNWAY = ISLANDS.runway;

export class GameModes {
  constructor(onEvent) {
    this.onEvent = onEvent; // ({ type, ... }) -> hud toasts, sounds, endcard
    this.reset();
  }

  reset() {
    this.key = 'ring';
    this.title = MODES.ring.title;
    this.state = 'menu'; // menu | flying | done | crashed
    this.elapsed = 0;
    this.score = 0;
    this.ringsCleared = 0;
    this.ringsTotal = 12;
    this.nextRingDist = 0;
    this.attempt = 0;
    this.attemptScores = [];
    this.endTitle = '';
    this.endLines = '';
    this.finalScored = false;
  }

  start(key, phys, course) {
    this.reset();
    this.key = key;
    this.title = MODES[key].title;
    this.state = 'flying';
    course.reset();
    this.ringsTotal = MODES[key].rings ? course.total : 0;
    course.setRingsVisible(MODES[key].rings);
    if (key === 'landing') {
      this.attempt = 1;
      this.placeOnFinal(phys);
    } else {
      phys.reset(); // parked at the west end of the runway, facing east
    }
    this.onEvent({ type: 'start', mode: key });
  }

  placeOnFinal(phys) {
    phys.reset();
    phys.pos = { x: 620, y: 170, z: RUNWAY.z };
    phys.heading = Math.PI; // west, down the runway
    phys.pitch = 0.06;
    phys.roll = 0;
    phys.speed = 46;
    phys.throttle = 0.32;
    phys.fuel = 100;
    phys.onGround = false;
    phys.airborne = true;
    phys.verticalSpeed = -3.5;
  }

  // frame: { prevVs, wasOnGround } captured around the physics update.
  update(dt, phys, course, world, frame) {
    if (this.state !== 'flying') return;
    this.elapsed += dt;

    if (this.ringsTotal > 0) {
      this.ringsCleared = course.cleared;
      this.nextRingDist = course.distanceToNext(
        { x: phys.pos.x, y: phys.pos.y, z: phys.pos.z }
      );
      // Ring passes are detected by main.js (it owns prev/cur positions)
      // and reported here via onRing().
    }

    // Touchdown: only on the airborne -> ground transition.
    if (frame && !frame.wasOnGround && phys.onGround) {
      const sink = Math.max(0, -frame.prevVs);
      const flat = world.isOnRunway(phys.pos.x, phys.pos.z);
      const result = phys.judgeTouchdown(sink, flat);
      if (result === 'crashed') {
        const overSea = world.terrainHeight(phys.pos.x, phys.pos.z) <= 0.5;
        this.endCrash(overSea ? 'DITCHED IN THE SEA' : 'CRASHED — HARD TOUCHDOWN');
      } else if (result === 'landed') {
        this.onLanding(phys, sink);
      }
    }

    // Ran off the world or out of time in landing mode.
    if (this.key === 'landing' && this.elapsed > 90 && this.state === 'flying') {
      this.endCrash('APPROACH TIMED OUT');
    }
    if (Math.abs(phys.pos.x) > 2600 || Math.abs(phys.pos.z) > 2600) {
      this.endCrash('FLEW OFF THE CHART');
    }
    // Out of fuel over water or hills with no runway under you ends the flight
    // at the next touchdown; nothing special to do here.
  }

  onRing(ring, phys) {
    if (this.state !== 'flying') return;
    this.ringsCleared = this.ringsTotal > 0 ? ring.index + 1 : this.ringsCleared;
    let pts = 100;
    if (this.key === 'time') pts += Math.max(0, Math.round(60 - this.elapsed * 0.15));
    this.score += pts;
    this.onEvent({ type: 'ring', n: ring.index + 1, total: this.ringsTotal, points: pts });
    if (this.ringsTotal > 0 && this.ringsCleared >= this.ringsTotal) {
      this.onEvent({ type: 'allrings' });
    }
  }

  onLanding(phys, sink) {
    // Landing quality: centreline error, sink rate, speed.
    const centreErr = Math.abs(phys.pos.z - RUNWAY.z);
    const centreScore = Math.max(0, 100 - centreErr * 2.2);
    const sinkScore = Math.max(0, 100 - sink * 14);
    const speedScore = phys.speed < 55 ? 100 : Math.max(0, 100 - (phys.speed - 55) * 4);
    const quality = Math.round((centreScore + sinkScore + speedScore) / 3);
    const pts = Math.round(quality * 5);
    if (this.key === 'landing') {
      this.score += pts;
      this.attemptScores.push(pts);
      this.onEvent({ type: 'landing', attempt: this.attempt, quality, points: pts });
      if (this.attempt >= 3) {
        this.finish('LANDING CHALLENGE COMPLETE',
          `3 approaches flown\nBest landing: ${Math.max(...this.attemptScores)} pts\n` +
          `Scores: ${this.attemptScores.join(' · ')}\nTotal score: ${this.score}`);
      } else {
        this.attempt++;
        this.elapsed = 0;
        this.onEvent({ type: 'nextattempt', attempt: this.attempt });
        this.placeOnFinal(phys);
        this.state = 'flying';
      }
      return;
    }
    // Ring course / time trial: landing after all rings finishes the run.
    if (this.ringsCleared >= this.ringsTotal) {
      const fuelBonus = Math.round(phys.fuel * 5);
      const timeBonus = this.key === 'time'
        ? Math.max(0, Math.round((420 - this.elapsed) * 2)) : 0;
      this.score += pts + fuelBonus + timeBonus;
      this.finish(this.key === 'time' ? 'TIME TRIAL COMPLETE' : 'COURSE COMPLETE',
        `Landing quality: ${quality}/100  (+${pts} pts)\n` +
        `Fuel bonus: +${fuelBonus}  ·  Time bonus: +${timeBonus}\n` +
        `Time: ${fmtClock(this.elapsed)}\nTotal score: ${this.score}`);
    } else {
      // Landed early: back in the air is allowed in ring modes only if the
      // pilot takes off again; the run continues.
      this.onEvent({ type: 'earlylanding', rings: this.ringsCleared, total: this.ringsTotal });
      phys.landed = false;
      phys.onGround = true;
    }
  }

  endCrash(title) {
    if (this.state !== 'flying') return;
    this.state = 'crashed';
    const lines = this.ringsTotal > 0
      ? `Rings: ${this.ringsCleared}/${this.ringsTotal}\nScore: ${this.score}\nPress R to fly again`
      : `Attempt ${this.attempt} of 3\nScore: ${this.score}\nPress R to fly again`;
    this.finish(title, lines, true);
  }

  finish(title, lines, crashed = false) {
    this.state = crashed ? 'crashed' : 'done';
    this.endTitle = title;
    this.endLines = lines;
    this.onEvent({ type: 'end', title, lines, crashed });
  }
}

function fmtClock(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

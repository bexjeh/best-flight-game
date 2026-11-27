// hudInstruments.js — the DOM HUD: big legible numbers on dark plates.
// Updated every frame from the physics state and the active mode. The
// rotate cue and the stall warning are the two teaching moments: one tells
// a new pilot when to pull up, the other when the wing has quit.
import { FEET_PER_M } from './flightPhysics.js';

const $ = (id) => document.getElementById(id);

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export class HudInstruments {
  constructor() {
    this.el = {
      alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'), vs: $('hud-vs'),
      fuel: $('hud-fuel'), thr: $('hud-thr'), time: $('hud-time'), score: $('hud-score'),
      mode: $('hud-mode'), ringNum: $('hud-ring-num'), nextDist: $('hud-next-dist'),
      nextLine: $('hud-next'),
      toast: $('hud-toast'), warn: $('hud-warn'), rotate: $('hud-rotate'),
      ringLine: $('hud-ring'),
    };
    this.toastUntil = 0;
  }

  toast(text, ms = 2200) {
    this.el.toast.textContent = text;
    this.toastUntil = performance.now() + ms;
  }

  update(phys, mode, now) {
    this.el.alt.textContent = String(Math.round(phys.feet));
    this.el.spd.textContent = String(Math.round(phys.knots));
    this.el.hdg.textContent = String(Math.round(phys.headingDeg)).padStart(3, '0') + '°';
    const vsFpm = Math.round(phys.verticalSpeed * FEET_PER_M * 60);
    this.el.vs.textContent = (vsFpm >= 0 ? '+' : '') + vsFpm;
    this.el.fuel.textContent = String(Math.round(phys.fuel));
    this.el.thr.textContent = String(Math.round(phys.throttle * 100));
    this.el.time.textContent = fmtTime(mode.elapsed);
    this.el.score.textContent = String(mode.score);
    this.el.mode.textContent = mode.title;
    if (mode.ringsTotal > 0) {
      this.el.ringLine.style.display = '';
      this.el.ringNum.textContent = String(Math.min(mode.ringsCleared + 1, mode.ringsTotal));
      this.el.nextLine.textContent = `NEXT RING ${Math.round(mode.nextRingDist)} m`;
    } else {
      this.el.ringLine.style.display = 'none';
      this.el.nextLine.textContent = 'LAND ON THE RUNWAY';
    }
    // Rotate cue: on the ground, fast enough — pull up now.
    this.el.rotate.classList.toggle('hidden', !phys.needsRotate);
    // Stall warning.
    this.el.warn.classList.toggle('hidden', !phys.stalled);
    // Fuel warning colour.
    this.el.fuel.style.color = phys.fuel < 20 ? '#ff7a5a' : '#ffffff';
    if (now > this.toastUntil) this.el.toast.textContent = '';
  }
}

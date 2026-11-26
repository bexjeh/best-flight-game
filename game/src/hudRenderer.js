// hudRenderer.js — the lit instruments: big altitude/speed/heading readouts, fuel and
// throttle bars, ring counter, timer, score, centre messages and the artificial horizon.
import { headingDegrees, compassPoint } from './flightModel.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    root: el('hud'), alt: el('hud-alt'), speed: el('hud-speed'), heading: el('hud-heading'),
    compass: el('hud-compass'), rings: el('hud-rings'), nextRing: el('hud-next-ring'),
    score: el('hud-score'), fuelBar: el('hud-fuel-bar'), fuel: el('hud-fuel'),
    throttleBar: el('hud-throttle-bar'), throttle: el('hud-throttle'),
    timer: el('hud-timer'), mode: el('hud-mode'), message: el('hud-message'),
    centre: el('hud-centre'), horizon: el('horizon'),
  };
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60), r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export function updateHud(hud, game) {
  const f = game.flight;
  const altM = Math.max(0, Math.round(f.y - 1));
  hud.alt.textContent = String(altM);
  hud.speed.textContent = String(Math.round(f.speed * 1.94384)); // m/s -> knots
  const hdg = headingDegrees(f);
  hud.heading.innerHTML = String(Math.round(hdg)).padStart(3, '0') + '&deg;';
  hud.compass.textContent = compassPoint(hdg);
  hud.rings.textContent = game.ringsCollected + ' / ' + game.ringTotal;
  const next = game.nextRingIndex + 1;
  hud.nextRing.textContent = game.ringsCollected >= game.ringTotal ? 'ALL RINGS — LAND!' : 'NEXT: ' + next;
  hud.score.textContent = String(game.score);
  const fuelPct = Math.max(0, Math.round(game.fuel));
  hud.fuelBar.style.width = fuelPct + '%';
  hud.fuelBar.classList.toggle('low', fuelPct < 25);
  hud.fuel.textContent = fuelPct + '%';
  const thrPct = Math.round(f.throttle * 100);
  hud.throttleBar.style.width = thrPct + '%';
  hud.throttle.textContent = thrPct + '%';
  hud.timer.textContent = (game.mode === 'trial' ? 'LEFT ' : 'TIME ') + formatClock(game.clock);
  hud.mode.textContent = game.modeLabel;
  hud.message.textContent = game.message;
  hud.centre.textContent = game.centreFlash || '';
  drawHorizon(hud.horizon, f);
}

function drawHorizon(canvas, flight) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, R = w / 2 - 6;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  // Sky above the horizon line, ground below — rolled by bank, shifted by pitch.
  ctx.translate(cx, cy);
  ctx.rotate(flight.roll);
  const pitchPx = Math.max(-R, Math.min(R, flight.pitch * R * 1.6));
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#ff9a4d'; ctx.fillRect(-R, -R * 2, R * 2, R * 2);      // sunset sky
  ctx.fillStyle = '#2a4a2a'; ctx.fillRect(-R, 0, R * 2, R * 2);           // ground
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(-R, -2, R * 2, 4);              // horizon line
  ctx.restore();
  // Fixed aircraft symbol and bank marks.
  ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 10, cy); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 34, cy);
  ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'center'; ctx.fillText('HORIZON', cx, h - 16);
}

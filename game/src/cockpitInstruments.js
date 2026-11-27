// cockpitInstruments.js — the lit instrument cluster: a 2D canvas drawn every
// frame at the bottom of the screen. Four real instruments — airspeed,
// altimeter, artificial horizon and compass — with lit amber/cyan markings on
// dark faces, so the cockpit view shows instruments that are flown, not drawn.
import { clamp } from './flightPhysics.js';

function dial(ctx, cx, cy, r, label) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffb85a';
  ctx.stroke();
  // Label is drawn last by the caller, after needle and readout, so nothing
  // ever paints over it.
}

function gaugeLabel(ctx, cx, cy, r, label) {
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - r + 18);
}

function ticks(ctx, cx, cy, r, count, startAngle, endAngle) {
  ctx.strokeStyle = '#cfe3ff';
  ctx.lineWidth = 2;
  for (let i = 0; i <= count; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / count;
    const x1 = cx + Math.cos(a) * (r - 8), y1 = cy + Math.sin(a) * (r - 8);
    const x2 = cx + Math.cos(a) * (r - 2), y2 = cy + Math.sin(a) * (r - 2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
}

function needle(ctx, cx, cy, r, angle, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * (r - 12), cy + Math.sin(angle) * (r - 12));
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function digital(ctx, cx, cy, text, color) {
  ctx.fillStyle = '#0a0f1c';
  ctx.fillRect(cx - 34, cy - 13, 68, 24);
  ctx.strokeStyle = '#ffb85a'; ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 34, cy - 13, 68, 24);
  ctx.fillStyle = color || '#ffffff';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, cy + 6);
}

export function drawCluster(canvas, phys) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // --- Airspeed (knots), 0..160 ---
  const cx1 = 78, cy = 75, r = 58;
  dial(ctx, cx1, cy, r, 'AIRSPEED kt');
  ticks(ctx, cx1, cy, r, 8, Math.PI * 0.75, Math.PI * 2.25);
  const spdAngle = Math.PI * 0.75 + (clamp(phys.knots, 0, 160) / 160) * Math.PI * 1.5;
  needle(ctx, cx1, cy, r, spdAngle, '#ff5a3c');
  digital(ctx, cx1, cy + 24, String(Math.round(phys.knots)));
  gaugeLabel(ctx, cx1, cy, r, 'AIRSPEED kt');

  // --- Altimeter (feet) ---
  const cx2 = 232;
  dial(ctx, cx2, cy, r, 'ALT ft');
  ticks(ctx, cx2, cy, r, 10, Math.PI * 0.75, Math.PI * 2.25);
  const altAngle = Math.PI * 0.75 + ((phys.feet % 1000) / 1000) * Math.PI * 1.5;
  needle(ctx, cx2, cy, r, altAngle, '#5ad0ff');
  digital(ctx, cx2, cy + 24, String(Math.round(phys.feet)));
  gaugeLabel(ctx, cx2, cy, r, 'ALT ft');

  // --- Artificial horizon ---
  const cx3 = 400;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx3, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx3, cy);
  ctx.rotate(phys.roll);
  const pitchPx = clamp(-phys.pitch, -0.6, 0.6) * 90;
  ctx.fillStyle = '#e8933c'; // sky (golden hour)
  ctx.fillRect(-r, -r + pitchPx, r * 2, r);
  ctx.fillStyle = '#2a4a22'; // ground
  ctx.fillRect(-r, pitchPx, r * 2, r);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r, pitchPx - 2, r * 2, 4); // horizon line
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx3, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffb85a'; ctx.stroke();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx3 - 26, cy); ctx.lineTo(cx3 - 8, cy);
  ctx.moveTo(cx3 + 8, cy); ctx.lineTo(cx3 + 26, cy);
  ctx.moveTo(cx3, cy - 3); ctx.lineTo(cx3, cy + 3);
  ctx.stroke();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx3, cy + r - 12);

  // --- Compass tape ---
  const cx4 = 556;
  dial(ctx, cx4, cy, r, 'HEADING');
  const hdg = phys.headingDeg;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx4, cy, r - 4, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
  ctx.fillRect(cx4 - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = '#cfe3ff';
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  for (const [deg, name] of labels) {
    let rel = ((deg - hdg + 540) % 360) - 180; // -180..180
    const x = cx4 + (rel / 180) * (r * 2.1);
    if (Math.abs(rel) > 110) continue;
    ctx.fillText(name, x, cy + 5);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx4, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffb85a'; ctx.stroke();
  // Lubber line.
  ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx4, cy - r + 4); ctx.lineTo(cx4, cy - r + 18); ctx.stroke();
  digital(ctx, cx4, cy + 24, String(Math.round(hdg)).padStart(3, '0') + '°');
  gaugeLabel(ctx, cx4, cy, r, 'HEADING');
}

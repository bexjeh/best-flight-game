// main.js — bootstrap and game loop: renderer, world, Kestrel, cameras, HUD,
// input, modes and the autopilot. The loop is the only place that knows about
// both physics and rendering; everything else owns one job.
import THREE from './threeShim.js';
import { FlightPhysics } from './flightPhysics.js';
import { IslandWorld } from './islandWorld.js';
import { buildKestrel } from './kestrelAircraft.js';
import { ChaseCamera, buildCockpitPanel } from './chaseCamera.js';
import { drawCluster } from './cockpitInstruments.js';
import { HudInstruments } from './hudInstruments.js';
import { RingCourse } from './ringCourse.js';
import { GameModes } from './gameModes.js';
import { SoundSynth } from './soundSynth.js';
import { autopilotInput, autopilotTarget, applyShot, SHOTS } from './shotDirector.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);

const world = new IslandWorld(scene);
const course = new RingCourse(scene);
const phys = new FlightPhysics();
const kestrel = buildKestrel();
scene.add(kestrel.group);
const cockpitPanel = buildCockpitPanel(kestrel.group);
const chase = new ChaseCamera(camera);
const hud = new HudInstruments();
const sound = new SoundSynth();
const clusterCanvas = document.getElementById('cluster');

const params = new URLSearchParams(window.location.search);
const shotNum = parseInt(params.get('shot') || '0', 10);
const autoParam = params.get('auto') === '1';

// --- Input: keyboard + mouse drag. Short taps must add up (sticky pitch
// in the flight model), so a first-time player rotates with taps, not holds.
const input = {
  throttleUp: false, throttleDown: false,
  pitchUp: false, pitchDown: false,
  rollLeft: false, rollRight: false,
  yawLeft: false, yawRight: false, brake: false,
};
let drag = null; // { x, y } while the mouse is dragging: steers pitch/roll.
const KEYMAP = {
  KeyW: 'throttleUp', KeyS: 'throttleDown',
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft', ArrowRight: 'rollRight',
  KeyA: 'yawLeft', KeyD: 'yawRight',
  Space: 'brake',
};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.ensure();
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; e.preventDefault(); return; }
  if (e.code === 'KeyC') { chase.toggle(); cockpitPanel.visible = chase.mode === 'cockpit'; }
  if (e.code === 'KeyM') { sound.toggleMute(); }
  if (e.code === 'KeyR') { backToMenu(); }
  if (e.code === 'Digit1') startMode('ring');
  if (e.code === 'Digit2') startMode('time');
  if (e.code === 'Digit3') startMode('landing');
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; sound.ensure(); });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  // Drag right = roll right, drag up = pitch up (nose up).
  if (dx > 4) { input.rollRight = true; setTimeout(() => { input.rollRight = false; }, 120); }
  if (dx < -4) { input.rollLeft = true; setTimeout(() => { input.rollLeft = false; }, 120); }
  if (dy < -4) { input.pitchUp = true; setTimeout(() => { input.pitchUp = false; }, 120); }
  if (dy > 4) { input.pitchDown = true; setTimeout(() => { input.pitchDown = false; }, 120); }
});

// --- Modes and UI ---
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const endEl = document.getElementById('endcard');
const endTitle = document.getElementById('end-title');
const endLines = document.getElementById('end-lines');

const mode = new GameModes((ev) => {
  if (ev.type === 'ring') {
    hud.toast(`RING ${ev.n} CLEARED  +${ev.points}`);
    sound.ring();
  } else if (ev.type === 'allrings') {
    hud.toast('ALL RINGS — LAND ON THE RUNWAY');
  } else if (ev.type === 'landing') {
    hud.toast(`TOUCHDOWN ${ev.quality}/100  +${ev.points}`);
    sound.land();
  } else if (ev.type === 'nextattempt') {
    hud.toast(`APPROACH ${ev.attempt} OF 3`);
  } else if (ev.type === 'earlylanding') {
    hud.toast(`LANDED EARLY — ${ev.rings}/${ev.total} RINGS, TAKE OFF AGAIN`);
  } else if (ev.type === 'end') {
    endTitle.textContent = ev.title;
    endLines.textContent = ev.lines;
    endEl.classList.remove('hidden');
    if (ev.crashed) sound.crash();
  }
});

function startMode(key) {
  if (mode.state === 'flying' && mode.key === key && !autoParam && !shotNum) return;
  endEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  mode.start(key, phys, course);
  chase.mode = 'chase';
  cockpitPanel.visible = false;
  hud.toast(mode.title + ' — FULL THROTTLE, THEN PULL UP');
}

function backToMenu() {
  mode.reset();
  mode.state = 'menu';
  phys.reset();
  course.reset();
  endEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
}

document.querySelectorAll('.mode-btn').forEach((b) => {
  b.addEventListener('click', () => { sound.ensure(); startMode(b.dataset.mode); });
});
document.getElementById('end-again').addEventListener('click', backToMenu);

// --- Shot scenes / autopilot start ---
let autopilot = false;
if (shotNum && SHOTS[shotNum]) {
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  applyShot(shotNum, phys, mode, course, chase);
  cockpitPanel.visible = chase.mode === 'cockpit';
  autopilot = true;
} else if (autoParam) {
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  mode.start('ring', phys, course);
  autopilot = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
const clock = new THREE.Clock();
const prevPos = new THREE.Vector3(phys.pos.x, phys.pos.y, phys.pos.z);
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frames++;

  const wasOnGround = phys.onGround;
  const prevVs = phys.verticalSpeed;
  prevPos.set(phys.pos.x, phys.pos.y, phys.pos.z);

  let activeInput = input;
  if (autopilot && (mode.state === 'flying')) {
    const target = autopilotTarget(mode, course);
    const cruise = mode.key === 'landing' ? 40 : 46;
    activeInput = autopilotInput(phys, target, cruise);
    // In landing shots the autopilot flares: ease the descent near the deck.
    if (mode.key === 'landing' && phys.pos.y < 30 && !phys.onGround) {
      activeInput.pitchUp = phys.verticalSpeed < -2.5;
      activeInput.pitchDown = false;
      if (phys.speed > 42) activeInput.throttleDown = true;
    }
  }

  if (mode.state === 'flying') {
    phys.update(dt, activeInput, (x, z) => world.terrainHeight(x, z));
    const curPos = new THREE.Vector3(phys.pos.x, phys.pos.y, phys.pos.z);
    const cleared = course.checkPass(prevPos, curPos);
    if (cleared) mode.onRing(cleared, phys);
    mode.update(dt, phys, course, world, { prevVs, wasOnGround });
    sound.update(phys);
  }

  // Aircraft pose from physics (nose is -z in model space).
  kestrel.group.position.set(phys.pos.x, phys.pos.y, phys.pos.z);
  kestrel.group.rotation.order = 'YXZ';
  kestrel.group.rotation.y = -(phys.heading + Math.PI / 2);
  kestrel.group.rotation.x = -phys.pitch;
  kestrel.group.rotation.z = -phys.roll;
  kestrel.prop.rotation.z -= dt * (6 + phys.throttle * 26 + phys.speed * 0.35);
  // In the cockpit the spinning blades freeze across the windscreen in a
  // still frame, so the prop is hidden there and shown in chase view.
  kestrel.prop.visible = chase.mode !== 'cockpit';
  const blink = 1.6 + 1.4 * Math.sin(t * 6);
  kestrel.lights.tail.material.emissiveIntensity = blink;

  world.update(dt, t);
  course.update(t);
  scene.userData.cameraPos = camera.position;
  chase.update(phys, dt);

  if (mode.state === 'flying' || mode.state === 'done' || mode.state === 'crashed') {
    hud.update(phys, mode, performance.now());
    drawCluster(clusterCanvas, phys);
  }
  renderer.render(scene, camera);
}
animate();

// Test hooks: the playtest reads state and drives the game through these.
window.__kestrel = {
  phys, mode, course, world, chase, input,
  startMode, backToMenu,
  get autopilot() { return autopilot; },
  set autopilot(v) { autopilot = v; },
  get frames() { return frames; },
};

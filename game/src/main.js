// main.js — Golden Hour: Twelve Rings. Boots the renderer, wires input, runs the
// loop, and exposes window.__game for play-testing (state reads and test hooks).
import { buildTerrain, terrainHeight } from './terrainBuilder.js';
import { buildAircraft, poseAircraft } from './aircraftBuilder.js';
import { buildRings, paintRings, RING_COUNT } from './ringCourse.js';
import { createCameraDirector } from './cameraDirector.js';
import { createHud, updateHud, formatClock } from './hudRenderer.js';
import { createSoundSynth } from './soundSynth.js';
import { createGame, startMode, stepGame, MODE_DESCRIPTIONS } from './gameState.js';
import { applyShotPose } from './shotDirector.js';

const THREE = window.THREE;
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
// Sunset gradient sky: warm horizon, violet above, plus haze toward the sea.
scene.background = new THREE.Color(0x2a1445);
scene.fog = new THREE.Fog(0xc96a4a, 500, 2400);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(-150, 30, 80);

const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a1a3a, 0.85);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffb060, 1.5);
sunLight.position.set(-900, 180, -300);
scene.add(sunLight);

buildTerrain(scene);
const { plane, propeller } = buildAircraft();
scene.add(plane);
const rings = buildRings(scene);

const cameraDirector = createCameraDirector(camera);
const hud = createHud();
const sounds = createSoundSynth();
const game = createGame();

const input = {
  pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
  yawLeft: false, yawRight: false, throttleUp: false, throttleDown: false, brake: false,
};

const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const pauseScreen = document.getElementById('pause-screen');
const statusLine = document.getElementById('status');

function showEndScreen() {
  document.getElementById('end-kicker').textContent =
    game.endKind === 'win' ? 'SORTIE COMPLETE' : game.endKind === 'crash' ? 'SORTIE LOST' : 'SORTIE ENDED';
  document.getElementById('end-title').textContent = game.endTitle;
  document.getElementById('end-detail').textContent = game.endDetail;
  const stats = [
    ['SCORE', String(game.score)],
    ['RINGS', game.ringsCollected + ' / ' + RING_COUNT],
    ['TIME', formatClock(game.clock)],
    ['FUEL LEFT', Math.round(game.fuel) + '%'],
    ['BEST LANDING', game.bestLanding ? game.bestLanding + ' / 100' : '—'],
    ['MODE', game.modeLabel],
  ];
  document.getElementById('end-stats').innerHTML = stats
    .map(([k, v]) => '<div><b>' + k + '</b><span>' + v + '</span></div>').join('');
  endScreen.classList.remove('hidden');
  hud.root.classList.add('hidden');
  statusLine.textContent = game.endTitle + '. ' + game.endDetail;
}

function showTitle() {
  game.phase = 'title';
  titleScreen.classList.remove('hidden');
  endScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hud.root.classList.add('hidden');
}

function flyMode(mode) {
  sounds.unlock();
  startMode(game, mode, rings);
  cameraDirector.setMode('chase');
  cameraDirector.reset();
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hud.root.classList.remove('hidden');
  statusLine.textContent = MODE_DESCRIPTIONS[mode];
}

function restart() {
  flyMode(game.mode);
}

document.querySelectorAll('.mode-btn[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => flyMode(btn.dataset.mode));
});
document.getElementById('end-fly-again').addEventListener('click', restart);
document.getElementById('end-menu').addEventListener('click', showTitle);
canvas.addEventListener('click', () => {
  sounds.unlock();
  if (game.phase === 'flying') cameraDirector.cycleView();
});

const KEYMAP = {
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown', ArrowLeft: 'rollLeft', ArrowRight: 'rollRight',
  KeyA: 'yawLeft', KeyD: 'yawRight', KeyW: 'throttleUp', KeyS: 'throttleDown', Space: 'brake',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Digit1') flyMode('course');
  if (e.code === 'Digit2') flyMode('trial');
  if (e.code === 'Digit3') flyMode('landing');
  if (e.code === 'KeyC' && game.phase === 'flying') cameraDirector.cycleView();
  if (e.code === 'KeyM') showTitle();
  if (e.code === 'KeyR' && game.phase !== 'title') restart();
  if (e.code === 'KeyP') {
    if (game.phase === 'flying') { game.phase = 'paused'; pauseScreen.classList.remove('hidden'); }
    else if (game.phase === 'paused') { game.phase = 'flying'; pauseScreen.classList.add('hidden'); }
  }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Screenshot poses (?shot=1..4) and the play-test hook.
const shotParam = Number(new URLSearchParams(window.location.search).get('shot') || 0);
const shotActive = applyShotPose(shotParam, game, rings, cameraDirector);
if (shotActive) {
  if (shotParam === 1) titleScreen.classList.add('shot-left');
  if (shotParam === 4) { titleScreen.classList.add('hidden'); showEndScreen(); endScreen.classList.add('shot-left'); }
  else if (game.phase === 'flying') {
    titleScreen.classList.add('hidden');
    hud.root.classList.remove('hidden');
  }
}
window.__game = game;
window.__shot = shotParam;
window.__test = {
  game, rings,
  fly: flyMode,
  setFuel(v) { game.fuel = v; },
  teleportRing(i) {
    const r = rings[i];
    game.flight.x = r.def.x - 60; game.flight.y = r.def.y; game.flight.z = r.def.z;
    game.flight.heading = Math.atan2(-(r.def.z - game.flight.z), r.def.x - game.flight.x);
    game.flight.speed = 60; game.flight.airborne = true;
  },
  snapshot() {
    const f = game.flight;
    return {
      phase: game.phase, mode: game.mode, x: +f.x.toFixed(1), y: +f.y.toFixed(1), z: +f.z.toFixed(1),
      speed: +f.speed.toFixed(1), throttle: +f.throttle.toFixed(2), pitch: +f.pitch.toFixed(2),
      roll: +f.roll.toFixed(2), fuel: +game.fuel.toFixed(1), rings: game.ringsCollected,
      score: game.score, clock: +game.clock.toFixed(1), endKind: game.endKind,
      terrainBelow: +terrainHeight(f.x, f.z).toFixed(1),
    };
  },
};

// ---- Main loop ----
const clock = new THREE.Clock();
let lastTime = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  lastTime = time;

  if (game.phase === 'flying') {
    stepGame(game, input, dt, rings, sounds);
    sounds.setFlight(game.flight.throttle, game.flight.speed, game.flight.airborne);
    updateHud(hud, game);
    if (game.phase === 'ended') showEndScreen();
  } else if (game.phase === 'title' && shotParam === 0) {
    // Gentle orbit drift on the title screen so the scene feels alive.
    game.flight.heading += dt * 0.02;
  }

  // Propeller spins with throttle; the lighthouse lamp pulses.
  propeller.rotation.x += dt * (2 + game.flight.throttle * 55);
  const lamp = scene.getObjectByName('lighthouseLamp');
  if (lamp) lamp.material.color.setHex(Math.sin(time * 2) > 0 ? 0xffe9a8 : 0xcc9955);
  paintRings(rings, game.nextRingIndex, time);
  poseAircraft(plane, game.flight);
  cameraDirector.update(game.flight, dt, time);
  renderer.render(scene, camera);
}
animate();
window.__ready = true;

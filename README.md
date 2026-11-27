# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bexjeh/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bexjeh/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Golden Hour: Twelve Rings — fly the Kestrel through twelve numbered rings over a sunset archipelago, mind your fuel, and bring her home to the runway. Round 2 rebuilds the flight feel first: a lower rotation speed, a sticky elevator and a big on-screen PULL UP cue, so a first-time pilot is airborne within seconds of reaching takeoff speed instead of sitting on the runway.

Three modes: Ring Course (12 rings, then land), Time Trial (the same rings against the clock) and Landing Challenge (3 approaches judged on touchdown). The flight model has throttle, pitch, roll and rudder with stall and fuel that forces decisions. The world is one coherent golden-hour archipelago — a lighthouse island with a rotating beam, a smoking volcano, a palm island, and a runway island with threshold lights — over a glittering sea under a gradient sky with real clouds. Chase and cockpit cameras (C toggles) with a lit four-gauge instrument cluster, a big-plate HUD (ALT, SPD, HDG, V/S, fuel, throttle, time, score, rings), and WebAudio-synthesised engine, wind, ring and crash sounds. Plays offline in desktop Chrome from static files; zero network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/ and press 1, 2 or 3 to fly.

## Controls

W/S throttle · ↑/↓ pitch · ←/→ roll · A/D rudder · C camera · M sound · R restart · mouse drag steers

## Layout

- `game/index.html`, `game/style.css` — shell and HUD styling
- `game/src/main.js` — bootstrap and game loop
- `game/src/flightPhysics.js` — throttle, pitch, roll, rudder, stall, fuel
- `game/src/islandWorld.js` — archipelago, sky, sea, lighthouse, volcano, runway
- `game/src/kestrelAircraft.js` — the Kestrel: fuselage, wings, prop, nav lights
- `game/src/chaseCamera.js` — chase and cockpit cameras, dashboard panel
- `game/src/cockpitInstruments.js` — lit airspeed, altimeter, horizon, compass
- `game/src/hudInstruments.js` — the big-plate DOM HUD
- `game/src/ringCourse.js` — the twelve numbered rings
- `game/src/gameModes.js` — Ring Course, Time Trial, Landing Challenge, scoring
- `game/src/shotDirector.js` — autopilot and the four screenshot scenes
- `game/src/soundSynth.js` — WebAudio engine, wind, ring, landing, crash
- `game/vendor/three.min.js` — vendored Three.js (not our source)

## Entry program

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` into `MAKEFUN_OUTPUT_DIR` and writes `dossier.json` via `vendor/makefun-game.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=feheg61h&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

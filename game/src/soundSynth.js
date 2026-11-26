// soundSynth.js — every sound is synthesised with WebAudio: engine hum, wind rush,
// ring chime, touchdown thud and crash. No audio files, no network.
export function createSoundSynth() {
  let ctx = null, engineOsc = null, engineGain = null, windSrc = null, windGain = null, windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 82;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start(); engineOsc2.start();
    // Wind: looped noise buffer through a band-pass that opens with speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    windSrc.start();
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    setFlight(throttle, speed, flying) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      if (engineGain) {
        engineGain.gain.setTargetAtTime(flying || throttle > 0.05 ? 0.05 + throttle * 0.05 : 0, t, 0.1);
        if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + throttle * 90, t, 0.1);
      }
      if (windGain && windFilter) {
        windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0016), t, 0.15);
        windFilter.frequency.setTargetAtTime(350 + speed * 9, t, 0.15);
      }
    },
    ringChime() { tone(880, 0.35, 'sine', 0.22); tone(1318, 0.5, 'sine', 0.18, 0.09); },
    touchdown() { tone(140, 0.25, 'sine', 0.3); tone(70, 0.35, 'sine', 0.25, 0.02); },
    crash() {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const len = ctx.sampleRate * 0.6;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(ctx.destination); src.start(t0);
      tone(60, 0.7, 'sine', 0.35);
    },
    winFanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, i * 0.12)); },
    toggleMute() { muted = !muted; return muted; },
  };
}

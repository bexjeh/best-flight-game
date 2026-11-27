// soundSynth.js — every sound is synthesised with WebAudio: no audio files,
// no network. Engine hum (sawtooth + lowpass, pitch follows throttle),
// wind (filtered noise, loudness follows airspeed), a ring chime, a landing
// thump and a crash thud. Created lazily on the first key press or click so
// browsers never block it, and guarded so a missing AudioContext can never
// break the game.
export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSrc = null;
    this.windGain = null;
    this.windFilter = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Engine: two detuned saws through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 70;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 71.5;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); osc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start(); osc2.start();
      this.engineOsc2 = osc2;
      // Wind: looped noise buffer through a bandpass.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.windSrc = this.ctx.createBufferSource();
      this.windSrc.buffer = buf; this.windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 700; this.windFilter.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      this.windSrc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  update(phys) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 55 + phys.throttle * 95 + phys.speed * 0.55;
    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(rpm * 1.02, t, 0.08);
    }
    if (this.engineGain) {
      const g = phys.onGround && phys.throttle < 0.05 ? 0 : 0.045 + phys.throttle * 0.05;
      this.engineGain.gain.setTargetAtTime(g, t, 0.1);
    }
    if (this.windGain) {
      const w = Math.min(0.12, (phys.speed / 70) * 0.12);
      this.windGain.gain.setTargetAtTime(phys.airborne ? w : 0, t, 0.15);
    }
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(400 + phys.speed * 14, t, 0.1);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    if (this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  blip(freq, dur, type, gain) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.16, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) { /* sound must never break the game */ }
  }

  ring() {
    this.blip(880, 0.35, 'sine', 0.2);
    setTimeout(() => this.blip(1318, 0.5, 'sine', 0.18), 90);
  }

  land() {
    this.blip(140, 0.25, 'triangle', 0.25);
    setTimeout(() => this.blip(660, 0.3, 'sine', 0.14), 120);
  }

  crash() {
    this.blip(55, 0.7, 'sawtooth', 0.3);
    this.blip(38, 0.9, 'triangle', 0.3);
  }
}

// Synthesized WebAudio only — no audio files, no network. Every sound is a few
// oscillators shaped by an envelope. The context is created on the first user gesture.
export function createAudio() {
  let context = null;
  let muted = false;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, seconds, type, volume, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds + 0.02);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopAlarm();
      return muted;
    },
    get muted() { return muted; },
    step() { tone(190, 0.05, 'triangle', 0.05); },
    pickup() { tone(880, 0.12, 'sine', 0.12); tone(1320, 0.18, 'sine', 0.1); },
    diamond() { tone(660, 0.15, 'sine', 0.14); tone(990, 0.15, 'sine', 0.12); tone(1480, 0.3, 'sine', 0.12); },
    emp() { tone(1400, 0.35, 'sawtooth', 0.08, 120); },
    toss() { tone(500, 0.12, 'square', 0.05, 900); },
    clatter() { tone(220, 0.2, 'square', 0.09); tone(160, 0.25, 'square', 0.07); },
    spotted() { tone(520, 0.25, 'sawtooth', 0.1, 780); },
    caught() {
      tone(320, 0.5, 'sawtooth', 0.14, 90);
      tone(160, 0.6, 'triangle', 0.12, 60);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.35, 'sine', 0.13), i * 130);
      });
    },
    click() { tone(700, 0.06, 'sine', 0.08); },
    startAlarm() {
      if (muted || alarmOsc) return;
      const ctx = ensure();
      if (!ctx) return;
      try {
        alarmOsc = ctx.createOscillator();
        alarmGain = ctx.createGain();
        alarmOsc.type = 'sine';
        alarmOsc.frequency.setValueAtTime(620, ctx.currentTime);
        alarmGain.gain.setValueAtTime(0.0, ctx.currentTime);
        alarmGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.4);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 2.2;
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain).connect(alarmOsc.frequency);
        alarmOsc.connect(alarmGain).connect(ctx.destination);
        alarmOsc.start();
        lfo.start();
        alarmOsc._lfo = lfo;
      } catch {
        alarmOsc = null;
      }
    },
    stopAlarm() {
      if (!alarmOsc) return;
      try {
        alarmOsc._lfo?.stop();
        alarmOsc.stop();
      } catch { /* already stopped */ }
      alarmOsc = null;
      alarmGain = null;
    },
  };
}

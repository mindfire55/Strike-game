/* ===================== STRIKE ZONE - audio.js =====================
   All sounds are generated live with the Web Audio API (no sound files needed).
   Want real recorded gun sounds later? Replace the functions below with
   new Audio('sounds/ak47.mp3').play() calls.
*/
const Sound = (function () {
  let ctx = null, master = null, noiseBuf = null;
  let ambientSrc = null, ambientGain = null, birdTimer = null;
  let enabled = true;
  let lastVoice = 0;

  const PROFILES = {
    rifle:   { crack: 1800, body: 1400, dur: 0.16, thump: 120, vol: 0.9,  tail: 0.45 },
    smg:     { crack: 2400, body: 1800, dur: 0.10, thump: 150, vol: 0.7,  tail: 0.25 },
    shotgun: { crack: 1400, body: 700,  dur: 0.28, thump: 80,  vol: 1.1,  tail: 0.6 },
    sniper:  { crack: 1600, body: 600,  dur: 0.35, thump: 60,  vol: 1.2,  tail: 0.9 },
    lmg:     { crack: 1700, body: 1200, dur: 0.14, thump: 100, vol: 0.95, tail: 0.4 },
    pistol:  { crack: 2600, body: 2000, dur: 0.10, thump: 180, vol: 0.65, tail: 0.25 },
    deagle:  { crack: 1700, body: 900,  dur: 0.20, thump: 100, vol: 1.0,  tail: 0.5 }
  };

  function init() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 2);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      ctx = null;
    }
  }

  // filtered noise burst
  function noise(o) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const dur = o.dur || 0.1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.5, t0 + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 1.2, dur + 0.05);
    src.stop(t0 + dur + 0.06);
  }

  // simple oscillator tone
  function tone(o) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const dur = o.dur || 0.1;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 440, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.3, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function click(t, f, vol) {
    noise({ t: t, dur: 0.035, type: 'bandpass', f0: f, q: 4, vol: vol });
    tone({ t: t, dur: 0.04, type: 'square', f0: f * 0.6, f1: f * 0.3, vol: vol * 0.25 });
  }

  /* ---------- weapons ---------- */
  function shot(kind, vol, muffle) {
    if (!ctx) return;
    const p = PROFILES[kind] || PROFILES.rifle;
    vol = vol == null ? 1 : vol;
    const m = muffle || 1;
    const pv = p.vol * vol;
    const r = 0.94 + Math.random() * 0.12;
    noise({ type: 'highpass', f0: p.crack * m, dur: 0.045, vol: pv * 0.6, q: 0.5 });
    noise({ type: 'lowpass', f0: p.body * 3 * m * r, f1: p.body * 0.4 * m, dur: p.dur, vol: pv * 0.9 });
    tone({ type: 'sine', f0: p.thump * 1.6 * r, f1: p.thump * 0.4, dur: 0.14, vol: 0.8 * pv });
    noise({ t: 0.03, type: 'lowpass', f0: 900 * m, f1: 200, dur: p.tail, vol: 0.22 * vol });
  }
  function pump() { click(0.32, 1400, 0.3); click(0.46, 900, 0.35); }
  function reload(d) {
    click(d * 0.22, 2200, 0.35);                       // magazine out
    noise({ t: d * 0.55, dur: 0.1, type: 'lowpass', f0: 700, f1: 200, vol: 0.5 }); // mag in
    click(d * 0.58, 1500, 0.4);
    click(d * 0.85, 1800, 0.35);                       // bolt
    click(d * 0.9, 1100, 0.4);
  }
  function empty() { click(0, 1900, 0.3); }
  function switchWeapon() { click(0, 1300, 0.2); noise({ dur: 0.08, type: 'lowpass', f0: 500, vol: 0.15 }); }

  /* ---------- hits / melee ---------- */
  function hitMarker() { tone({ f0: 1900, f1: 1500, dur: 0.05, vol: 0.2 }); }
  function flesh() { noise({ dur: 0.09, type: 'lowpass', f0: 700, f1: 200, vol: 0.45 }); tone({ f0: 140, f1: 60, dur: 0.08, vol: 0.3 }); }
  function headshot() {
    noise({ dur: 0.1, type: 'highpass', f0: 2800, vol: 0.38 });
    tone({ f0: 880, f1: 1760, dur: 0.12, vol: 0.22, type: 'triangle' });
    tone({ t: 0.05, f0: 1320, f1: 2200, dur: 0.16, vol: 0.18, type: 'square' });
    tone({ t: 0.02, f0: 3300, dur: 0.22, vol: 0.12 });
    voiceHeadshot();
  }
  function voiceHeadshot() {
    if (!enabled) return;
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - lastVoice < 280) return;
    lastVoice = now;
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance('Head shot');
        u.rate = 1.25;
        u.pitch = 0.55;
        u.volume = 1;
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
      }
    } catch (e) { /* ignore */ }
  }
  function kill() { tone({ type: 'triangle', f0: 520, f1: 880, dur: 0.18, vol: 0.22 }); }
  function knife() { noise({ dur: 0.18, type: 'bandpass', f0: 1800, f1: 5000, q: 1.2, vol: 0.28, attack: 0.04 }); }
  function meleeHit() { noise({ dur: 0.1, type: 'lowpass', f0: 1000, f1: 200, vol: 0.55 }); tone({ f0: 100, f1: 50, dur: 0.12, vol: 0.45 }); }

  /* ---------- player ---------- */
  function hurt() {
    noise({ dur: 0.2, type: 'lowpass', f0: 500, f1: 120, vol: 0.6 });
    tone({ f0: 90, f1: 45, dur: 0.2, vol: 0.5 });
  }
  function heal() { tone({ f0: 660, dur: 0.35, vol: 0.1 }); tone({ t: 0.08, f0: 990, dur: 0.35, vol: 0.08 }); }
  function buy() { tone({ type: 'square', f0: 1500, dur: 0.05, vol: 0.12 }); tone({ t: 0.06, type: 'square', f0: 2250, dur: 0.12, vol: 0.12 }); }
  function deny() { tone({ type: 'sawtooth', f0: 180, f1: 120, dur: 0.18, vol: 0.18 }); }
  function step() { noise({ dur: 0.07, type: 'lowpass', f0: 300 + Math.random() * 150, vol: 0.12 }); }
  function death() { tone({ f0: 200, f1: 40, dur: 0.9, vol: 0.4, type: 'sawtooth' }); noise({ dur: 0.6, type: 'lowpass', f0: 800, f1: 80, vol: 0.4 }); }

  /* ---------- ambience ---------- */
  function ambient(kind) {
    stopAmbient();
    if (!ctx) return;
    try {
      ambientSrc = ctx.createBufferSource();
      ambientSrc.buffer = noiseBuf;
      ambientSrc.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = kind === 'snow' ? 520 : kind === 'yard' ? 260 : 380;
      ambientGain = ctx.createGain();
      ambientGain.gain.value = kind === 'snow' ? 0.07 : 0.045;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoG.gain.value = 0.02;
      lfo.connect(lfoG); lfoG.connect(ambientGain.gain);
      ambientSrc.connect(f); f.connect(ambientGain); ambientGain.connect(master);
      ambientSrc.start();
      lfo.start();
      ambientSrc._lfo = lfo;
      if (kind === 'jungle') birds();
    } catch (e) { /* ignore */ }
  }
  function birds() {
    birdTimer = setTimeout(function () {
      if (!ctx) return;
      const f = 2200 + Math.random() * 1500;
      for (let i = 0; i < 3; i++) tone({ t: i * 0.11, f0: f, f1: f * 1.5, dur: 0.08, vol: 0.05 });
      birds();
    }, 2500 + Math.random() * 5000);
  }
  function stopAmbient() {
    try {
      if (ambientSrc) { ambientSrc._lfo.stop(); ambientSrc.stop(); }
    } catch (e) { /* ignore */ }
    ambientSrc = null;
    if (birdTimer) { clearTimeout(birdTimer); birdTimer = null; }
  }

  function setVolume(v) { if (master) master.gain.value = v; }
  function setEnabled(on) {
    enabled = !!on;
    if (master) master.gain.value = enabled ? 0.7 : 0;
    if (!enabled) {
      stopAmbient();
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
  }

  return {
    init, shot, pump, reload, empty, switchWeapon, hitMarker, flesh, headshot, kill,
    knife, meleeHit, hurt, heal, buy, deny, step, death, ambient, stopAmbient, setVolume, setEnabled
  };
})();

/* =====================================================================
   audio.js — Sonidos generados con la Web Audio API (sin archivos mp3).
   Cada disparo es ruido blanco filtrado + un "golpe" grave.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  const A = (G.Audio = {
    ctx: null,
    master: null,
    noiseBuf: null,
    lastPlay: {},

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) { this.ctx = null; return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = G.SETTINGS.volume;
      this.master.connect(this.ctx.destination);
      // 2 s de ruido: el sonido más largo (0,6 s) + el desfase aleatorio (hasta 0,5 s) caben sin cortarse
      const len = this.ctx.sampleRate * 2.0;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },

    setVolume(v) { if (this.master) this.master.gain.value = v; },

    // Calcula volumen y paneo según dónde suena respecto al oyente
    _spatial(pos) {
      if (!pos || !G.Game || !G.Game.listener) return { vol: 1, pan: 0 };
      const L = G.Game.listener;
      const dx = pos.x - L.pos.x, dz = pos.z - L.pos.z, dy = pos.y - L.pos.y;
      const d = Math.hypot(dx, dy, dz);
      const vol = 1 / (1 + d / 14);
      // ángulo relativo a la mirada
      const ang = Math.atan2(dx, -dz) + L.yaw;
      const pan = Math.max(-1, Math.min(1, Math.sin(ang) * Math.min(1, d / 6)));
      return { vol, pan };
    },

    _out(vol, pan) {
      const g = this.ctx.createGain();
      g.gain.value = vol;
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p); p.connect(this.master);
      } else g.connect(this.master);
      return g;
    },

    _noise(dest, t, dur, freq, q, vol, type) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur);
      f.Q.value = q || 0.7;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    },

    _tone(dest, t, dur, f0, f1, vol, type) {
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    },

    // Evita que suenen 30 sonidos iguales en el mismo instante
    _throttle(key, ms) {
      const now = performance.now();
      if (this.lastPlay[key] && now - this.lastPlay[key] < ms) return false;
      this.lastPlay[key] = now;
      return true;
    },

    shot(type, pos) {
      if (!this.ctx) return;
      const s = this._spatial(pos);
      if (s.vol < 0.02) return;
      if (pos && !this._throttle('shot' + type + Math.round(pos.x), 30)) return;
      const t = this.ctx.currentTime;
      const out = this._out(s.vol, s.pan);
      switch (type) {
        case 'pistol':
          this._noise(out, t, 0.12, 4200, 1, 0.55);
          this._tone(out, t, 0.08, 420, 120, 0.35, 'square');
          break;
        case 'rifle':
          this._noise(out, t, 0.16, 3200, 1, 0.6);
          this._tone(out, t, 0.1, 220, 70, 0.45, 'sawtooth');
          break;
        case 'shotgun':
          this._noise(out, t, 0.38, 2400, 0.8, 0.9);
          this._tone(out, t, 0.25, 130, 40, 0.7, 'sine');
          this._noise(out, t + 0.45, 0.06, 1800, 3, 0.25, 'bandpass'); // "chak-chak"
          this._noise(out, t + 0.55, 0.06, 1400, 3, 0.25, 'bandpass');
          break;
        case 'sniper':
          this._noise(out, t, 0.6, 5200, 0.8, 0.9);
          this._tone(out, t, 0.4, 160, 35, 0.8, 'sine');
          this._noise(out, t + 0.7, 0.07, 2000, 4, 0.2, 'bandpass');
          break;
        case 'burst':      // cada bala de la ráfaga: seco y agudo
          this._noise(out, t, 0.1, 3800, 1.2, 0.55);
          this._tone(out, t, 0.07, 300, 90, 0.4, 'sawtooth');
          break;
        case 'tactical':   // escopeta táctica: más corta y sin el "chak-chak" de la corredera
          this._noise(out, t, 0.28, 2700, 0.8, 0.8);
          this._tone(out, t, 0.18, 150, 50, 0.6, 'sine');
          this._noise(out, t + 0.22, 0.04, 2600, 4, 0.18, 'bandpass');
          break;
        case 'rocket':     // lanzamiento: golpe grave + silbido que se aleja
          this._tone(out, t, 0.2, 110, 45, 0.7, 'sine');
          this._noise(out, t, 0.9, 1800, 0.7, 0.55, 'bandpass');
          this._noise(out, t, 0.12, 5000, 1, 0.5);
          break;
      }
    },

    // Explosión del misil (suena más fuerte cuanto más cerca)
    explosion(pos) {
      if (!this.ctx || !this._throttle('boom', 60)) return;
      const s = this._spatial(pos);
      if (s.vol < 0.02) return;
      const t = this.ctx.currentTime, out = this._out(Math.min(1, s.vol * 1.6), s.pan);
      this._noise(out, t, 1.2, 900, 0.7, 1.0);
      this._tone(out, t, 0.7, 90, 28, 0.9, 'sine');
      this._noise(out, t + 0.05, 0.5, 3000, 0.8, 0.35);
    },

    reload() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.6, 0);
      this._noise(out, t, 0.05, 2500, 5, 0.4, 'bandpass');
      this._noise(out, t + 0.18, 0.05, 1800, 5, 0.4, 'bandpass');
    },
    reloadDone() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.6, 0);
      this._noise(out, t, 0.05, 3200, 6, 0.5, 'bandpass');
    },
    empty() {
      if (!this.ctx || !this._throttle('empty', 200)) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._noise(out, t, 0.03, 4000, 8, 0.4, 'bandpass');
    },
    pickup() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.4, 0);
      this._tone(out, t, 0.08, 660, 0, 0.25, 'triangle');
      this._tone(out, t + 0.06, 0.12, 990, 0, 0.25, 'triangle');
    },
    chest(pos) {
      if (!this.ctx) return;
      const s = this._spatial(pos);
      const t = this.ctx.currentTime, out = this._out(s.vol, s.pan);
      [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(out, t + i * 0.06, 0.3, f, 0, 0.18, 'triangle'));
    },
    hit(head) {
      if (!this.ctx || !this._throttle('hit', 40)) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      if (head) this._tone(out, t, 0.18, 1600, 0, 0.3, 'sine');
      else this._tone(out, t, 0.06, 900, 600, 0.25, 'square');
    },
    shieldBreak() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.6, 0);
      this._noise(out, t, 0.3, 6000, 2, 0.4, 'highpass');
      this._tone(out, t, 0.3, 1200, 300, 0.2, 'triangle');
    },
    hurt() {
      if (!this.ctx || !this._throttle('hurt', 120)) return;
      const t = this.ctx.currentTime, out = this._out(0.6, 0);
      this._tone(out, t, 0.15, 180, 80, 0.4, 'sine');
    },
    potion() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      for (let i = 0; i < 5; i++) this._tone(out, t + i * 0.09, 0.08, 300 + Math.random() * 200, 200, 0.18, 'sine');
    },
    shieldUp() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._tone(out, t, 0.4, 400, 1200, 0.2, 'sine');
    },
    whoosh() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._noise(out, t, 0.6, 1200, 1, 0.35, 'bandpass');
    },
    kill() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.6, 0);
      this._tone(out, t, 0.1, 880, 0, 0.25, 'square');
      this._tone(out, t + 0.1, 0.25, 1320, 0, 0.25, 'square');
    },
    storm() {
      if (!this.ctx || !this._throttle('storm', 600)) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._tone(out, t, 0.25, 90, 60, 0.35, 'sawtooth');
    },
    // Golpe del pico según el material
    pickHit(mat, pos) {
      if (!this.ctx || !this._throttle('pick', 60)) return;
      const s = this._spatial(pos);
      if (s.vol < 0.03) return;
      const t = this.ctx.currentTime, out = this._out(s.vol, s.pan);
      if (mat === 'wood') { this._noise(out, t, 0.12, 900, 3, 0.6, 'bandpass'); this._tone(out, t, 0.1, 220, 120, 0.3, 'triangle'); }
      else if (mat === 'stone') { this._noise(out, t, 0.14, 1600, 2, 0.6, 'bandpass'); this._tone(out, t, 0.08, 330, 160, 0.25, 'square'); }
      else if (mat === 'metal') { this._tone(out, t, 0.25, 1400, 900, 0.25, 'triangle'); this._tone(out, t, 0.2, 2100, 1700, 0.15, 'sine'); }
      else { this._tone(out, t, 0.12, 2400, 1800, 0.18, 'triangle'); }
    },
    thud() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.8, 0);
      this._tone(out, t, 0.25, 120, 45, 0.6, 'sine');
      this._noise(out, t, 0.2, 600, 1, 0.5);
    },
    // Motor de la moto: un zumbido que sube de tono con la velocidad
    engineStart() {
      if (!this.ctx || this.eng) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(), o2 = c.createOscillator();
      o.type = 'sawtooth'; o2.type = 'square';
      o.frequency.value = 40; o2.frequency.value = 20;
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.2);
      const g2 = c.createGain(); g2.gain.value = 0.5;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.master);
      o.start(); o2.start();
      this.eng = { o, o2, f, g };
    },
    engineSet(speed, thr) {
      if (!this.ctx) return;
      if (!this.eng) this.engineStart();
      const e = this.eng, t = this.ctx.currentTime, s = Math.abs(speed);
      const fr = 34 + s * 3.4 + (thr > 0 ? 12 : 0);
      e.o.frequency.setTargetAtTime(fr, t, 0.06);
      e.o2.frequency.setTargetAtTime(fr * 0.5, t, 0.06);
      e.f.frequency.setTargetAtTime(380 + s * 45, t, 0.1);
      e.g.gain.setTargetAtTime(0.045 + Math.min(0.07, s * 0.0028) + (thr > 0 ? 0.02 : 0), t, 0.1);
    },
    engineStop() {
      if (!this.eng) return;
      const e = this.eng, t = this.ctx.currentTime;
      this.eng = null;
      e.g.gain.setTargetAtTime(0.0001, t, 0.06);
      e.o.stop(t + 0.4); e.o2.stop(t + 0.4);
    },
    crash(impact, pos) {
      if (!this.ctx || !this._throttle('crash', 150)) return;
      const s = this._spatial(pos);
      if (s.vol < 0.03) return;
      const t = this.ctx.currentTime, out = this._out(s.vol * Math.min(1, 0.4 + impact / 25), s.pan);
      this._noise(out, t, 0.3, 1400, 1, 0.8);
      this._tone(out, t, 0.25, 160, 50, 0.5, 'square');
    },
    swing() {
      if (!this.ctx || !this._throttle('swing', 100)) return;
      const t = this.ctx.currentTime, out = this._out(0.4, 0);
      this._noise(out, t, 0.18, 1500, 1.5, 0.25, 'bandpass');
    },
    breakSound(mat, pos) {
      if (!this.ctx || !this._throttle('break', 50)) return;
      const s = this._spatial(pos);
      if (s.vol < 0.03) return;
      const t = this.ctx.currentTime, out = this._out(s.vol, s.pan);
      this._noise(out, t, 0.45, mat === 'metal' ? 3000 : mat === 'stone' ? 1800 : 1100, 0.8, 0.8);
      this._tone(out, t, 0.35, mat === 'metal' ? 500 : 140, 60, 0.4, 'sawtooth');
    },
    build() {
      if (!this.ctx || !this._throttle('build', 50)) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._tone(out, t, 0.12, 300, 520, 0.25, 'square');
      this._noise(out, t, 0.08, 1200, 3, 0.25, 'bandpass');
    },
    bus() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, out = this._out(0.5, 0);
      this._tone(out, t, 0.25, 520, 0, 0.25, 'square');
      this._tone(out, t + 0.3, 0.35, 390, 0, 0.25, 'square');
    },
  });
})();

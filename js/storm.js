/* =====================================================================
   storm.js — La tormenta: una zona segura circular que se va
   cerrando por fases. Fuera de ella pierdes vida cada segundo.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  G.Storm = {
    cur: { x: 0, z: 0, r: C.islandRadius * 1.6 },
    next: { x: 0, z: 0, r: 230 },
    phase: 0,
    state: 'wait',
    timer: 0,
    tickT: 0,

    init(scene) {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 128, 1, true);
      // cortina morada con remolinos (ver G.makeStormMaterial); usa el mismo reloj que el mar
      G.World.timeU = G.World.timeU || { value: 0 };
      this.wall = new THREE.Mesh(geo, G.makeStormMaterial(G.World.timeU));
      this.wall.renderOrder = 3;
      scene.add(this.wall);
    },

    start() {
      this.cur = { x: 0, z: 0, r: C.islandRadius * 1.6 };
      this.phase = 0;
      this.state = 'wait';
      this.timer = G.STORM_PHASES[0].wait;
      this.next = this.pickNext(this.cur, G.STORM_PHASES[0].radius);
      this.tickT = 1;
      this.updateWall();
    },

    pickNext(cur, r) {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const maxOff = Math.max(0, cur.r - r) * (cur.r > C.islandRadius * 1.05 ? 0.35 : 0.9);
        const d = Math.sqrt(Math.random()) * maxOff;
        const x = cur.x + Math.cos(a) * d, z = cur.z + Math.sin(a) * d;
        if (Math.hypot(x, z) > C.islandRadius - Math.max(30, r * 0.5)) continue;
        if (G.Phys.heightAt(x, z) < 2.5) continue;
        return { x, z, r };
      }
      return { x: cur.x, z: cur.z, r };
    },

    get dmg() {
      return G.STORM_PHASES[Math.min(this.phase, G.STORM_PHASES.length - 1)].dmg;
    },

    // Multijugador: el estado de la tormenta en pocos números
    netState() {
      const r = (v) => Math.round(v * 10) / 10, f = this.from;
      return [['wait', 'shrink', 'final'].indexOf(this.state), this.phase, r(this.timer), r(this.cur.x), r(this.cur.z), r(this.cur.r),
        r(this.next.x), r(this.next.z), r(this.next.r), f ? r(f.x) : 0, f ? r(f.z) : 0, f ? r(f.r) : 0];
    },
    applyNet(a) {
      const st = ['wait', 'shrink', 'final'][a[0]];
      if (st === 'shrink' && this.state === 'wait') G.HUD.toast('¡La tormenta se está cerrando!', true);
      this.state = st; this.phase = a[1]; this.timer = a[2];
      this.cur = { x: a[3], z: a[4], r: a[5] };
      this.next = { x: a[6], z: a[7], r: a[8] };
      this.from = { x: a[9], z: a[10], r: a[11] };
      this.updateWall();
    },
    // el invitado sólo "sigue" lo que dice el anfitrión (y entre fotos, la mueve él)
    follow(dt) {
      this.timer = Math.max(0, this.timer - dt);
      if (this.state === 'shrink' && this.from) {
        const ph = G.STORM_PHASES[this.phase];
        const t = U.clamp(1 - this.timer / ph.shrink, 0, 1);
        this.cur.x = U.lerp(this.from.x, this.next.x, t);
        this.cur.z = U.lerp(this.from.z, this.next.z, t);
        this.cur.r = U.lerp(this.from.r, this.next.r, t);
      }
      this.updateWall();
    },

    update(dt) {
      if (G.Net.isClient && G.Net.inMatch) { this.follow(dt); return; }
      this.timer -= dt;
      const ph = G.STORM_PHASES[this.phase];
      if (this.state === 'wait' && this.timer <= 0) {
        this.state = 'shrink';
        this.timer = ph.shrink;
        this.from = { ...this.cur };
        G.HUD.toast('¡La tormenta se está cerrando!', true);
      } else if (this.state === 'shrink') {
        const t = U.clamp(1 - this.timer / ph.shrink, 0, 1);
        this.cur.x = U.lerp(this.from.x, this.next.x, t);
        this.cur.z = U.lerp(this.from.z, this.next.z, t);
        this.cur.r = U.lerp(this.from.r, this.next.r, t);
        if (this.timer <= 0) {
          this.cur = { ...this.next };
          this.phase++;
          if (this.phase < G.STORM_PHASES.length) {
            const np = G.STORM_PHASES[this.phase];
            this.next = this.pickNext(this.cur, np.radius);
            this.state = 'wait';
            this.timer = np.wait;
          } else {
            this.phase = G.STORM_PHASES.length - 1;
            this.state = 'final';
            this.timer = 0;
          }
        }
      }
      // daño por segundo a quien esté fuera
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = 1;
        for (const ch of G.Game.characters) {
          if (!ch.alive || ch.mode === 'bus') continue;
          if (!this.inside(ch.pos.x, ch.pos.z)) G.Combat.damage(ch, this.dmg, null, null, false, 'storm');
        }
      }
      this.updateWall();
    },

    updateWall() {
      const r = Math.max(0.5, this.cur.r);
      // mientras la zona cubre toda la isla no hace falta ver el muro
      this.wall.visible = r < C.islandRadius * 1.5;
      this.wall.scale.set(r, 700, r);
      this.wall.position.set(this.cur.x, 200, this.cur.z);
    },

    /* Dentro de la tormenta el mundo se ve morado: la neblina y el cielo cambian de color
       poco a poco y no se ve tan lejos. */
    atmos: 0,
    updateAtmosphere(dt) {
      const Gm = G.Game, p = Gm.player;
      const out = Gm.state === 'playing' && p && p.alive && p.mode !== 'bus' && !this.inside(p.pos.x, p.pos.z);
      this.applyAtmosphere(U.clamp(this.atmos + (out ? dt : -dt) * 1.5, 0, 1));
    },
    applyAtmosphere(k) {
      this.atmos = k;
      // fuera de la tormenta no hay nada que hacer (salvo volver a dejarlo todo normal una vez)
      if (k === 0 && this._lastAtmos === 0) return;
      this._lastAtmos = k;
      const Gm = G.Game, ST = G.STYLE;
      this._fogA = this._fogA || new THREE.Color(ST.fog);
      this._fogB = this._fogB || new THREE.Color(ST.stormFog);
      Gm.scene.fog.color.copy(this._fogA).lerp(this._fogB, k);
      Gm.scene.background.copy(Gm.scene.fog.color);
      const q = Gm.quality && Gm.quality.fog;
      if (q) {
        Gm.scene.fog.near = U.lerp(q[0], 20, k);
        Gm.scene.fog.far = U.lerp(q[1], 260, k);
      }
      const sky = G.World.sky;
      if (sky && sky.material.uniforms) sky.material.uniforms.uStorm.value = k;
      const clouds = G.World.clouds;
      if (clouds) clouds.material.color.setRGB(1 - 0.45 * k, 1 - 0.6 * k, 1 - 0.15 * k);
    },

    inside(x, z) {
      return Math.hypot(x - this.cur.x, z - this.cur.z) <= this.cur.r;
    },

    // Círculo al que debería ir un bot (el siguiente si va a cerrarse pronto)
    safeCircleFor() {
      const useNext = this.state === 'shrink' || (this.state === 'wait' && this.timer < 30);
      const c = useNext ? this.next : this.cur;
      return { x: c.x, z: c.z, r: Math.max(6, c.r) };
    },

    label() {
      if (this.state === 'final') return 'Zona final';
      if (this.state === 'wait') return 'La tormenta se cierra en ' + U.formatTime(this.timer);
      return 'Tormenta cerrándose ' + U.formatTime(this.timer);
    },
  };
})();

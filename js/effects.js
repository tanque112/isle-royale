/* =====================================================================
   effects.js — Efectos visuales: trazadoras de bala, chispas,
   fogonazos del cañón y destellos al abrir cofres.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  const MAXP = 700;

  G.Effects = {
    init(scene) {
      this.scene = scene;
      // Trazadoras
      this.tracers = [];
      for (let i = 0; i < 60; i++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        line.visible = false;
        scene.add(line);
        this.tracers.push({ line, life: 0, max: 0.08 });
      }
      this.ti = 0;

      // Partículas (un único objeto Points para todas)
      const pos = new Float32Array(MAXP * 3).fill(-9999);
      const col = new Float32Array(MAXP * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const tex = G.makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.7)');
      this.points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.22, vertexColors: true, transparent: true, depthWrite: false, map: tex, sizeAttenuation: true,
      }));
      this.points.frustumCulled = false;
      scene.add(this.points);
      this.pvel = new Float32Array(MAXP * 3);
      this.plife = new Float32Array(MAXP);
      this.pgrav = new Float32Array(MAXP);
      this.pi = 0;

      // Fogonazos
      const ftex = G.makeGlowTexture('rgba(255,255,230,1)', 'rgba(255,190,80,0.9)');
      this.flashes = [];
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.visible = false;
        scene.add(s);
        this.flashes.push({ s, life: 0 });
      }
      this.fi = 0;
    },

    tracer(from, to, color) {
      const t = this.tracers[this.ti];
      this.ti = (this.ti + 1) % this.tracers.length;
      const a = t.line.geometry.attributes.position;
      // empezamos la trazadora un poco más adelante para que no tape la vista
      a.setXYZ(0, from.x, from.y, from.z);
      a.setXYZ(1, to.x, to.y, to.z);
      a.needsUpdate = true;
      t.line.material.color.setHex(color || 0xffe9a0);
      t.line.material.opacity = 0.9;
      t.line.visible = true;
      t.life = t.max;
    },

    burst(x, y, z, color, count, speed, life, grav) {
      const c = new THREE.Color(color);
      const pos = this.points.geometry.attributes.position.array;
      const col = this.points.geometry.attributes.color.array;
      for (let k = 0; k < count; k++) {
        const i = this.pi;
        this.pi = (this.pi + 1) % MAXP;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI - Math.PI / 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        this.pvel[i * 3] = Math.cos(th) * Math.cos(ph) * sp;
        this.pvel[i * 3 + 1] = Math.abs(Math.sin(ph)) * sp + speed * 0.3;
        this.pvel[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * sp;
        const k2 = 0.8 + Math.random() * 0.4;
        col[i * 3] = c.r * k2; col[i * 3 + 1] = c.g * k2; col[i * 3 + 2] = c.b * k2;
        this.plife[i] = life * (0.6 + Math.random() * 0.6);
        this.pgrav[i] = grav === undefined ? 9 : grav;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    },

    flash(pos, size) {
      const f = this.flashes[this.fi];
      this.fi = (this.fi + 1) % this.flashes.length;
      f.s.position.copy(pos);
      f.s.scale.setScalar(size || 0.7);
      f.s.material.rotation = Math.random() * 6.28;
      f.s.visible = true;
      f.life = 0.05;
    },

    update(dt) {
      for (const t of this.tracers) {
        if (!t.line.visible) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / t.max) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
      const pos = this.points.geometry.attributes.position.array;
      let any = false;
      for (let i = 0; i < MAXP; i++) {
        if (this.plife[i] <= 0) continue;
        any = true;
        this.plife[i] -= dt;
        if (this.plife[i] <= 0) { pos[i * 3 + 1] = -9999; continue; }
        this.pvel[i * 3 + 1] -= this.pgrav[i] * dt;
        pos[i * 3] += this.pvel[i * 3] * dt;
        pos[i * 3 + 1] += this.pvel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += this.pvel[i * 3 + 2] * dt;
      }
      if (any) this.points.geometry.attributes.position.needsUpdate = true;
      for (const f of this.flashes) {
        if (!f.s.visible) continue;
        f.life -= dt;
        if (f.life <= 0) f.s.visible = false;
      }
    },

    clear() {
      if (G.Combat) G.Combat.clearRockets();   // (se llama al empezar y al salir de cada partida)
      for (let i = 0; i < MAXP; i++) this.plife[i] = 0;
      this.points.geometry.attributes.position.array.fill(-9999);
      this.points.geometry.attributes.position.needsUpdate = true;
      for (const t of this.tracers) t.line.visible = false;
      for (const f of this.flashes) { f.s.visible = false; f.life = 0; }
    },
  };
})();

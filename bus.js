/* =====================================================================
   bus.js — El autobús volador que cruza la isla al empezar.
   Puedes saltar cuando quieras mientras esté encima de la isla;
   al salir de ella te echa automáticamente.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  G.Bus = {
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    s: 0,
    active: false,
    canJump: false,

    init(scene) {
      this.model = G.Models.makeBus();
      this.model.root.visible = false;
      scene.add(this.model.root);
    },

    // a y off: dirección y desplazamiento (en multijugador los manda el anfitrión)
    start(a, off) {
      if (a === undefined) { a = Math.random() * Math.PI * 2; off = U.rand(-0.3, 0.3) * C.islandRadius; }
      this.params = [a, off];
      this.dir.set(Math.cos(a), 0, Math.sin(a));
      const n = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      this.p0 = this.dir.clone().multiplyScalar(-C.bus.halfLength).addScaledVector(n, off);
      this.length = C.bus.halfLength * 2;
      // cuándo entra y sale de la isla (intersección recta-círculo)
      const R = C.islandRadius + 15;
      const b = this.p0.x * this.dir.x + this.p0.z * this.dir.z;
      const c = this.p0.x * this.p0.x + this.p0.z * this.p0.z - R * R;
      const disc = Math.sqrt(Math.max(0, b * b - c));
      this.sEnter = -b - disc;
      this.sExit = -b + disc;
      this.s = 0;
      this.t = 0;
      this.active = true;
      this.canJump = false;
      this.model.root.visible = true;
      this.model.root.rotation.y = Math.atan2(-this.dir.x, -this.dir.z);
      this.update(0);
    },

    project(x, z) {
      return (x - this.p0.x) * this.dir.x + (z - this.p0.z) * this.dir.z;
    },

    pointAt(s, out) {
      return out.set(this.p0.x + this.dir.x * s, C.bus.height, this.p0.z + this.dir.z * s);
    },

    update(dt) {
      if (!this.active) return;
      this.t += dt;
      this.s += C.bus.speed * dt;
      this.pointAt(this.s, this.pos);
      this.pos.y += Math.sin(this.t * 1.3) * 0.6;
      this.model.root.position.copy(this.pos);
      this.model.root.rotation.z = Math.sin(this.t * 0.9) * 0.03;
      for (const r of this.model.rotors) r.rotation.y += dt * 18;
      const wasJump = this.canJump;
      this.canJump = this.s >= this.sEnter;
      if (this.canJump && !wasJump) { G.Audio.bus(); G.HUD.toast('¡Ya puedes saltar del autobús!'); }
      // al salir de la isla, todos fuera
      if (this.s >= this.sExit) {
        for (const ch of G.Game.characters) if (ch.mode === 'bus') G.Game.jumpFromBus(ch);
      }
      if (this.s > this.length) {
        this.active = false;
        this.model.root.visible = false;
      }
    },

    hide() {
      this.active = false;
      this.model.root.visible = false;
    },
  };
})();

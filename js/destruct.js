/* =====================================================================
   destruct.js — Todo lo que se puede romper: paredes, suelos de los
   pisos, árboles, rocas, coches, muebles... y lo que construyes tú.
   Cada cosa rompible es un "grupo" con vida (hp) y un material.
   Al golpearla con el pico te da materiales; al llegar a 0 desaparece.
   (El suelo del mapa —terreno, calles, aceras— NO se puede romper.)
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U;

  const D = (G.Destruct = {
    groups: [],
    dirty: new Map(),
    active: null,
    /* Huecos que deja una pared o un suelo de un edificio al romperse.
       Sirven para que tu construcción encaje exactamente en ese hueco. */
    holes: [],

    reset() {
      for (const h of this.holes) if (h.geo) h.geo.dispose();
      this.groups = [];
      this.holes = [];
      this.dirty.clear();
      this.active = null;
    },

    /* ---------- Crear grupos ---------- */
    create(o) {
      const g = {
        id: this.groups.length,
        name: o.name || 'Estructura',
        mat: o.mat || 'stone',
        hp: o.hp || 200,
        maxHp: o.hp || 200,
        yield: o.yield || 6,
        boxes: [], surfs: [], ranges: [],
        mesh: null, build: null,
        slot: null,     // si es un panel de pared o una baldosa de suelo: el hueco que dejará
        alive: true,
        min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity],
      };
      this.groups.push(g);
      return g;
    },

    // Mientras hay un grupo "activo", todo lo que construye el mundo se apunta a él
    begin(o) { this.active = this.create(o); return this.active; },
    end() { const g = this.active; this.active = null; return g; },

    addBox(g, b) {
      b.g = g;
      g.boxes.push(b);
      this.grow(g, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
    },
    grow(g, x0, y0, z0, x1, y1, z1) {
      g.min[0] = Math.min(g.min[0], x0); g.min[1] = Math.min(g.min[1], y0); g.min[2] = Math.min(g.min[2], z0);
      g.max[0] = Math.max(g.max[0], x1); g.max[1] = Math.max(g.max[1], y1); g.max[2] = Math.max(g.max[2], z1);
    },
    addRange(g, builder, start, end) {
      if (end <= start) return;
      const last = g.ranges[g.ranges.length - 1];
      if (last && last.builder === builder && last.end === start) { last.end = end; return; }
      g.ranges.push({ builder, start, end, geo: null });
    },
    // Tras crear las mallas de los trozos, cada rango sabe en qué geometría está
    bindGeometries(map) {
      for (const g of this.groups) for (const r of g.ranges) r.geo = map.get(r.builder) || null;
    },

    center(g, out) {
      return out.set((g.min[0] + g.max[0]) / 2, (g.min[1] + g.max[1]) / 2, (g.min[2] + g.max[2]) / 2);
    },

    /* ---------- Daño ---------- */
    damage(g, amount, by, point, pickaxe) {
      if (!g || !g.alive) return;
      g.hp -= amount;
      // el pico da materiales en cada golpe
      if (pickaxe && by) {
        const m = g.mat;
        const max = G.MATERIALS[m].max;
        const before = by.mats[m];
        by.mats[m] = Math.min(max, by.mats[m] + g.yield);
        if (by.isPlayer && by.mats[m] > before) G.HUD.matGain(m, by.mats[m] - before);
      }
      if (by && by.isPlayer) G.HUD.structHit(g);
      // en multijugador el invitado avisa al anfitrión, que es quien decide si se rompe
      if (G.Net.isClient && G.Net.inMatch) {
        if (by && by.isPlayer) G.Net.structDamage(g, amount, pickaxe);
        if (g.hp < 1) g.hp = 1;
      }
      const col = G.MATERIALS[g.mat].hex;
      if (point) G.Effects.burst(point.x, point.y, point.z, col, pickaxe ? 7 : 3, 3, 0.45);
      if (g.build) G.Build.onHit(g.build);
      if (g.hp <= 0) this.destroy(g, by);
    },

    destroy(g, by) {
      if (!g.alive) return;
      g.alive = false;
      G.Net.destroyed(g);
      g.hp = 0;
      for (const b of g.boxes) G.Phys.removeBox(b);
      for (const s of g.surfs) G.Phys.removeSurf(s);
      // "aplastar" sus vértices para que desaparezca de la malla combinada
      for (const r of g.ranges) {
        if (!r.geo) continue;
        const arr = r.geo.attributes.position.array;
        const x = arr[r.start * 3], y = arr[r.start * 3 + 1], z = arr[r.start * 3 + 2];
        for (let v = r.start; v < r.end; v++) { arr[v * 3] = x; arr[v * 3 + 1] = y; arr[v * 3 + 2] = z; }
        const d = this.dirty.get(r.geo);
        if (d) { d[0] = Math.min(d[0], r.start); d[1] = Math.max(d[1], r.end); }
        else this.dirty.set(r.geo, [r.start, r.end]);
      }
      // escombros
      const c = new THREE.Vector3();
      this.center(g, c);
      const size = Math.max(g.max[0] - g.min[0], g.max[1] - g.min[1], g.max[2] - g.min[2]);
      G.Effects.burst(c.x, c.y, c.z, G.MATERIALS[g.mat].hex, Math.min(40, 12 + size * 3), 5, 1.0, 12);
      // cosas con malla propia (vallas publicitarias...) que deben desaparecer con el grupo
      if (g.onDestroy) g.onDestroy();
      G.Audio.breakSound(g.mat, c);
      // apunta el hueco para poder rellenarlo con una construcción tuya
      if (g.slot && !g.build) {
        const s = g.slot;
        this.holes.push({
          id: this.holes.length, gid: g.id, kind: s.kind, min: s.min, max: s.max,
          boxes: s.boxes || [[s.min[0], s.min[1], s.min[2], s.max[0], s.max[1], s.max[2]]],
          filled: null, geo: null,
        });
      }
      // lo que estaba encima (objetos, cofres) se cae
      G.Loot.unsettle(g.min, g.max);
      if (g.build) G.Build.onDestroyed(g.build, by);
      else if (G.Build.list.length) G.Build.worldChanged(g.min, g.max);
    },

    // Sube a la tarjeta gráfica sólo la parte de la malla que ha cambiado
    flush() {
      if (!this.dirty.size) return;
      for (const [geo, d] of this.dirty) {
        const attr = geo.attributes.position;
        attr.updateRange.offset = d[0] * 3;
        attr.updateRange.count = (d[1] - d[0]) * 3;
        attr.needsUpdate = true;
      }
      this.dirty.clear();
    },
  });
})();

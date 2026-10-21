/* =====================================================================
   physics.js — Colisiones y rayos.
   El mundo sólido es: el terreno (un mapa de alturas) + muchas cajas
   (paredes, suelos, árboles, construcciones...) + superficies inclinadas
   (escaleras, rampas y conos).
   Todo se guarda en una rejilla para encontrar rápido lo que hay cerca.
   Las cajas se pueden quitar (cuando algo se rompe).
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const CELL = 8;           // tamaño de cada celda de la rejilla
  const GRID_OFF = 512;
  const key = (ix, iz) => (ix + GRID_OFF) * 2048 + (iz + GRID_OFF);

  const _tmpArr = [];
  const _tmpArr2 = [];
  const _surfArr = [];
  const _rayOut = { box: null, nx: 0, ny: 0, nz: 0 };

  const P = (G.Phys = {
    grid: new Map(),
    sgrid: new Map(),
    stamp: 0,
    terrain: null,
    boxCount: 0,

    reset() {
      this.grid.clear();
      this.sgrid.clear();
      this.boxCount = 0;
    },

    _cells(x0, z0, x1, z1, fn) {
      const ix0 = Math.floor(x0 / CELL), ix1 = Math.floor(x1 / CELL);
      const iz0 = Math.floor(z0 / CELL), iz1 = Math.floor(z1 / CELL);
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) fn(key(ix, iz));
    },

    /* Añade una caja sólida.
       opts.noMove = sólo para las balas (no frena a los personajes)
       opts.g      = grupo rompible al que pertenece */
    addBox(x0, y0, z0, x1, y1, z1, opts) {
      const b = {
        x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1),
        x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1),
        s: 0, g: (opts && opts.g) || null, nm: !!(opts && opts.noMove), build: !!(opts && opts.build), dead: false,
      };
      this._cells(b.x0, b.z0, b.x1, b.z1, (k) => {
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(b);
      });
      this.boxCount++;
      return b;
    },

    removeBox(b) {
      if (b.dead) return;
      b.dead = true;
      this._cells(b.x0, b.z0, b.x1, b.z1, (k) => {
        const arr = this.grid.get(k);
        if (!arr) return;
        const i = arr.indexOf(b);
        if (i >= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); }
      });
      this.boxCount--;
    },

    /* Superficies por las que se camina: rampas (escaleras) y pirámides (conos).
       ramp: sube a lo largo de un eje. axis 0 = X, 1 = Z. yMin = altura en el lado "min" */
    addRamp(x0, z0, x1, z1, axis, yMin, yMax, opts) {
      return this._addSurf({ type: 0, x0, z0, x1, z1, axis, yMin, yMax, build: !!(opts && opts.build), dead: false, s: 0 });
    },
    addPyramid(x0, z0, x1, z1, yBase, h, opts) {
      return this._addSurf({ type: 1, x0, z0, x1, z1, yBase, h, build: !!(opts && opts.build), dead: false, s: 0 });
    },
    _addSurf(sf) {
      this._cells(sf.x0, sf.z0, sf.x1, sf.z1, (k) => {
        let arr = this.sgrid.get(k);
        if (!arr) { arr = []; this.sgrid.set(k, arr); }
        arr.push(sf);
      });
      return sf;
    },
    removeSurf(sf) {
      if (sf.dead) return;
      sf.dead = true;
      this._cells(sf.x0, sf.z0, sf.x1, sf.z1, (k) => {
        const arr = this.sgrid.get(k);
        if (!arr) return;
        const i = arr.indexOf(sf);
        if (i >= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); }
      });
    },
    surfHeight(sf, x, z) {
      if (sf.type === 0) {
        const t = sf.axis === 0 ? (x - sf.x0) / (sf.x1 - sf.x0) : (z - sf.z0) / (sf.z1 - sf.z0);
        return sf.yMin + (sf.yMax - sf.yMin) * U.clamp(t, 0, 1);
      }
      const hx = (sf.x1 - sf.x0) / 2, hz = (sf.z1 - sf.z0) / 2;
      const dx = Math.abs(x - (sf.x0 + hx)) / hx, dz = Math.abs(z - (sf.z0 + hz)) / hz;
      return sf.yBase + sf.h * (1 - U.clamp(Math.max(dx, dz), 0, 1));
    },
    surfacesAt(x, z) {
      const arr = this.sgrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      return arr || _surfArr;
    },

    // Devuelve las cajas que tocan el rectángulo XZ dado
    query(x0, z0, x1, z1, out) {
      out.length = 0;
      const st = ++this.stamp;
      const ix0 = Math.floor(x0 / CELL), ix1 = Math.floor(x1 / CELL);
      const iz0 = Math.floor(z0 / CELL), iz1 = Math.floor(z1 / CELL);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const arr = this.grid.get(key(ix, iz));
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (b.s === st) continue;
            b.s = st;
            if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
            out.push(b);
          }
        }
      }
      return out;
    },

    /* ---------- Terreno ---------- */
    setTerrain(heights, n, size) {
      this.terrain = { h: heights, n, size, half: size / 2, step: size / (n - 1) };
    },

    // Altura exacta del terreno (coincide con los triángulos de la malla)
    heightAt(x, z) {
      const T = this.terrain;
      if (!T) return 0;
      const fx = (x + T.half) / T.step, fz = (z + T.half) / T.step;
      const ix = Math.floor(fx), iz = Math.floor(fz);
      if (ix < 0 || iz < 0 || ix >= T.n - 1 || iz >= T.n - 1) return -12;
      const tx = fx - ix, tz = fz - iz;
      const n = T.n, H = T.h;
      const h00 = H[iz * n + ix], h10 = H[iz * n + ix + 1];
      const h01 = H[(iz + 1) * n + ix], h11 = H[(iz + 1) * n + ix + 1];
      if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
      return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
    },

    /* ¿Dónde está el suelo bajo (x,z)? Tiene en cuenta terreno, techos de cajas
       y rampas/conos que estén por debajo de refY + stepUp (lo que se puede "pisar"). */
    groundAt(x, z, r, refY, stepUp) {
      // en el mar profundo "flotamos" a 1,3 m bajo la superficie (vadeando) para poder volver a la orilla
      let g = Math.max(this.heightAt(x, z), -1.3);
      const lim = refY + (stepUp === undefined ? 0.6 : stepUp);
      const arr = this.query(x - r, z - r, x + r, z + r, _tmpArr);
      const rr = r * 0.85;
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i];
        if (b.nm || b.y1 > lim || b.y1 <= g) continue;
        const cx = U.clamp(x, b.x0, b.x1), cz = U.clamp(z, b.z0, b.z1);
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz <= rr * rr) g = b.y1;
      }
      const sa = this.surfacesAt(x, z);
      for (let i = 0; i < sa.length; i++) {
        const sf = sa[i];
        if (x < sf.x0 - 0.05 || x > sf.x1 + 0.05 || z < sf.z0 - 0.05 || z > sf.z1 + 0.05) continue;
        const h = this.surfHeight(sf, x, z);
        if (h <= lim + 0.25 && h > g) g = h;
      }
      return g;
    },

    /* ¿Hay algo del MAPA (no construcciones) que sostenga este punto?
       Se usa para saber si una construcción está apoyada en el suelo. */
    supportAt(x, z, y) {
      if (Math.abs(this.heightAt(x, z) - y) < 0.7 || this.heightAt(x, z) > y) return true;
      const arr = this.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2, _tmpArr);
      for (const b of arr) {
        if (b.build || b.nm) continue;
        if (b.y1 >= y - 0.7 && b.y0 <= y + 0.3) return true;
      }
      const sa = this.surfacesAt(x, z);
      for (const sf of sa) {
        if (sf.build) continue;
        if (x < sf.x0 || x > sf.x1 || z < sf.z0 || z > sf.z1) continue;
        if (Math.abs(this.surfHeight(sf, x, z) - y) < 0.7) return true;
      }
      return false;
    },

    /* ---------- Rayos ---------- */
    // Rayo contra cajas usando la rejilla (algoritmo DDA). Devuelve distancia o -1
    raycastBoxes(ox, oy, oz, dx, dy, dz, maxT, out, skipBuild) {
      const idx = 1 / (Math.abs(dx) > 1e-9 ? dx : 1e-9);
      const idy = 1 / (Math.abs(dy) > 1e-9 ? dy : 1e-9);
      const idz = 1 / (Math.abs(dz) > 1e-9 ? dz : 1e-9);
      let ix = Math.floor(ox / CELL), iz = Math.floor(oz / CELL);
      const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      let tMaxX = Math.abs(dx) > 1e-9 ? ((ix + (dx > 0 ? 1 : 0)) * CELL - ox) / dx : Infinity;
      let tMaxZ = Math.abs(dz) > 1e-9 ? ((iz + (dz > 0 ? 1 : 0)) * CELL - oz) / dz : Infinity;
      const tDX = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
      const tDZ = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
      let best = maxT, hit = null, hitAxis = 0;
      const st = ++this.stamp;
      let t = 0;
      for (let guard = 0; guard < 600; guard++) {
        const arr = this.grid.get(key(ix, iz));
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (b.s === st) continue;
            b.s = st;
            if (skipBuild && b.build) continue;
            let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
            let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
            t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
            let a = Math.min(t1, t2), c = Math.max(t1, t2);
            if (a > tmin) { tmin = a; ax = 1; }
            if (c < tmax) tmax = c;
            t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
            a = Math.min(t1, t2); c = Math.max(t1, t2);
            if (a > tmin) { tmin = a; ax = 2; }
            if (c < tmax) tmax = c;
            if (tmax < 0 || tmin > tmax) continue;
            const th = tmin < 0 ? 0 : tmin;
            if (th < best) { best = th; hit = b; hitAxis = ax; }
          }
        }
        if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; ix += stepX; }
        else { t = tMaxZ; tMaxZ += tDZ; iz += stepZ; }
        if (t > best || t > maxT) break;
      }
      if (!hit) return -1;
      if (out) {
        out.box = hit;
        out.nx = hitAxis === 0 ? -Math.sign(dx) : 0;
        out.ny = hitAxis === 1 ? -Math.sign(dy) : 0;
        out.nz = hitAxis === 2 ? -Math.sign(dz) : 0;
      }
      return best;
    },

    // Rayo contra el terreno: avanza a pasos y afina al cruzar
    raycastTerrain(ox, oy, oz, dx, dy, dz, maxT) {
      let t = 0, prevT = 0;
      let h = this.heightAt(ox, oz);
      if (oy < h) return 0;
      for (let guard = 0; guard < 500 && t < maxT; guard++) {
        const y = oy + dy * t;
        h = this.heightAt(ox + dx * t, oz + dz * t);
        const gap = y - h;
        if (gap < 0) {
          let a = prevT, b = t;
          for (let i = 0; i < 7; i++) {
            const m = (a + b) * 0.5;
            if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) b = m; else a = m;
          }
          return b;
        }
        prevT = t;
        t += U.clamp(gap * 0.7, 0.5, 8);
      }
      return -1;
    },

    // Rayo contra todo lo estático. Devuelve {t, nx,ny,nz, terrain, box} o null
    raycastWorld(ox, oy, oz, dx, dy, dz, maxT, skipBuild) {
      const out = _rayOut;
      const tb = this.raycastBoxes(ox, oy, oz, dx, dy, dz, maxT, out, skipBuild);
      const lim = tb >= 0 ? tb : maxT;
      const tt = this.raycastTerrain(ox, oy, oz, dx, dy, dz, lim);
      if (tt >= 0 && (tb < 0 || tt < tb)) return { t: tt, nx: 0, ny: 1, nz: 0, terrain: true, box: null };
      if (tb >= 0) return { t: tb, nx: out.nx, ny: out.ny, nz: out.nz, terrain: false, box: out.box };
      return null;
    },

    // ¿Hay línea de visión entre A y B? (sin cajas ni terreno en medio)
    lineClear(ax, ay, az, bx, by, bz, withTerrain) {
      let dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-4) return true;
      dx /= len; dy /= len; dz /= len;
      if (this.raycastBoxes(ax, ay, az, dx, dy, dz, len - 0.05, null) >= 0) return false;
      if (withTerrain && this.raycastTerrain(ax, ay, az, dx, dy, dz, len - 0.3) >= 0) return false;
      return true;
    },

    /* ---------- Movimiento de personajes ----------
       ent necesita: pos (pies), vel, radius, height (actual), onGround */
    moveCharacter(ent, dt) {
      const pos = ent.pos, vel = ent.vel;
      const r = ent.radius, stepUp = 0.6;
      const prevY = pos.y;

      // 1) movimiento horizontal + empujar fuera de las paredes
      pos.x += vel.x * dt;
      pos.z += vel.z * dt;
      this.pushOut(ent, stepUp);

      // límite del mundo
      const lim = G.CONFIG.worldSize / 2 - 20;
      const rr = Math.hypot(pos.x, pos.z);
      if (rr > lim) { pos.x *= lim / rr; pos.z *= lim / rr; }

      // 2) movimiento vertical
      pos.y += vel.y * dt;

      // techo: si al subir chocamos con algo, paramos
      if (vel.y > 0) {
        const arr = this.query(pos.x - r * 0.7, pos.z - r * 0.7, pos.x + r * 0.7, pos.z + r * 0.7, _tmpArr);
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b.nm) continue;
          if (b.y0 >= prevY + ent.height - 0.1 && b.y0 < pos.y + ent.height) {
            pos.y = b.y0 - ent.height;
            vel.y = 0;
          }
        }
      }

      // suelo
      const refY = Math.max(prevY, pos.y);
      const g = this.groundAt(pos.x, pos.z, r, refY, stepUp);
      const wasGround = ent.onGround;
      ent.onGround = false;
      if (pos.y <= g + 0.001) {
        pos.y = g;
        if (vel.y < 0) { ent.landSpeed = -vel.y; vel.y = 0; }
        ent.onGround = true;
      } else if (wasGround && vel.y <= 0 && pos.y - g < 0.45) {
        // pegarse al suelo al bajar escaleras
        pos.y = g;
        vel.y = 0;
        ent.onGround = true;
      }
      ent.groundY = g;
    },

    // Empuja un círculo (personaje) fuera de las cajas que lo atraviesan
    pushOut(ent, stepUp) {
      const pos = ent.pos, r = ent.radius;
      for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        const arr = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, _tmpArr2);
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b.nm || b.y1 <= pos.y + stepUp || b.y0 >= pos.y + ent.height) continue;
          const cx = U.clamp(pos.x, b.x0, b.x1), cz = U.clamp(pos.z, b.z0, b.z1);
          const dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = r - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          } else {
            // el centro está dentro de la caja: salir por el lado más cercano
            const l = pos.x - b.x0, rgt = b.x1 - pos.x, f = pos.z - b.z0, bk = b.z1 - pos.z;
            const m = Math.min(l, rgt, f, bk);
            if (m === l) pos.x = b.x0 - r; else if (m === rgt) pos.x = b.x1 + r;
            else if (m === f) pos.z = b.z0 - r; else pos.z = b.z1 + r;
          }
          ent.hitWall = true;
          ent.wallBox = b;
          moved = true;
        }
        if (!moved) break;
      }
    },
  });
})();

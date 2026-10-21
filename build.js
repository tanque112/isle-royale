/* =====================================================================
   build.js — Construcción estilo battle royale: paredes, suelos, rampas
   y conos que encajan en una cuadrícula de 4 x 4 m.
   Cuestan 10 de material (madera, piedra o metal). Cada material tiene
   distinta vida. Si rompes lo que sostiene una construcción, lo que
   queda "en el aire" se derrumba.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;
  const S = C.build.size, H = C.build.height;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // +x, +z, -x, -z

  const _o = new THREE.Vector3(), _p = new THREE.Vector3();

  // Distancia a la que un rayo entra en una caja (o null si no la toca)
  function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    const lo = [x0, y0, z0], hi = [x1, y1, z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < lo[a] || oo[a] > hi[a]) return null; continue; }
      let t0 = (lo[a] - oo[a]) / dd[a], t1 = (hi[a] - oo[a]) / dd[a];
      if (t0 > t1) { const k = t0; t0 = t1; t1 = k; }
      if (t0 > tmin) tmin = t0;
      if (t1 < tmax) tmax = t1;
      if (tmin > tmax) return null;
    }
    return tmin;
  }

  // Junta varias cajas en una sola geometría (con coordenadas de textura)
  function mergeBoxes(boxes, px, py, pz) {
    const parts = boxes.map((b) => new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2])
      .translate((b[0] + b[3]) / 2 - px, (b[1] + b[4]) / 2 - py, (b[2] + b[5]) / 2 - pz).toNonIndexed());
    if (parts.length === 1) return parts[0];
    let n = 0;
    for (const p of parts) n += p.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const p of parts) {
      pos.set(p.attributes.position.array, o * 3);
      nor.set(p.attributes.normal.array, o * 3);
      uv.set(p.attributes.uv.array, o * 2);
      o += p.attributes.position.count;
      p.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }

  const B = (G.Build = {
    pieces: new Map(),
    list: [],

    init(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      scene.add(this.group);
      this.ghost = new THREE.Mesh(G.Models.pieceGeometry('wall'), G.Models.ghostMats.ok);
      this.ghost.visible = false;
      this.ghost.renderOrder = 5;
      scene.add(this.ghost);
    },

    reset() {
      for (const p of this.list) this.group.remove(p.mesh);
      this.pieces.clear();
      this.list = [];
      this.ghost.visible = false;
    },

    // Altura de referencia de la cuadrícula: la de la construcción cercana, o el suelo que pisas
    yOffFor(ch) {
      let best = null, bd = 9;
      for (const p of this.list) {
        if (!p.g.alive || p.hole) continue;   // las que tapan huecos no marcan la cuadrícula
        const d = Math.hypot(p.cx - ch.pos.x, p.cz - ch.pos.z);
        if (d < bd && Math.abs(p.yb - ch.pos.y) < 12) { bd = d; best = p; }
      }
      if (best) return best.yOff;
      return ch.onGround ? ch.groundY : ch.pos.y;
    },

    // Pieza construida (rampa o suelo) que tienes justo debajo de los pies
    pieceUnder(ch) {
      const x = ch.pos.x, z = ch.pos.z, y = ch.pos.y;
      for (const p of this.list) {
        if (!p.g.alive || (p.type !== 'ramp' && p.type !== 'floor')) continue;
        if (x < p.min[0] - 0.1 || x > p.max[0] + 0.1 || z < p.min[2] - 0.1 || z > p.max[2] + 0.1) continue;
        const h = p.type === 'ramp' ? G.Phys.surfHeight(p.g.surfs[0], x, z) : p.max[1];
        if (Math.abs(h - y) < 0.7) return p;
      }
      return null;
    },

    /* ---------- Huecos de los edificios ----------
       Si miras al hueco que ha dejado una pared (o un suelo) rota de un edificio,
       la pieza se ajusta a ese hueco exacto en vez de a la cuadrícula. */
    holeTarget(origin, dir, kind, maxT) {
      let best = null, bt = maxT;
      for (const h of G.Destruct.holes) {
        if (h.kind !== kind || h.filled) continue;
        const cx = (h.min[0] + h.max[0]) / 2, cy = (h.min[1] + h.max[1]) / 2, cz = (h.min[2] + h.max[2]) / 2;
        if (Math.abs(cx - origin.x) > 12 || Math.abs(cz - origin.z) > 12 || Math.abs(cy - origin.y) > 10) continue;
        // un poco más gruesa para que sea fácil apuntarle
        let ex = 0.06, ey = 0.06, ez = 0.06;
        if (kind === 'floor') ey = 0.45;
        else if (h.max[0] - h.min[0] < h.max[2] - h.min[2]) ex = 0.45;
        else ez = 0.45;
        const t = rayBox(origin, dir, h.min[0] - ex, h.min[1] - ey, h.min[2] - ez, h.max[0] + ex, h.max[1] + ey, h.max[2] + ez);
        if (t !== null && t < bt) { bt = t; best = h; }
      }
      return best;
    },

    holeGeometry(h) {
      if (!h.geo) h.geo = mergeBoxes(h.boxes, (h.min[0] + h.max[0]) / 2, h.min[1], (h.min[2] + h.max[2]) / 2);
      return h.geo;
    },

    holeTargetInfo(ch, h, type, mat, yOff) {
      const r = { type, hole: h, yOff, valid: true, key: 'h:' + h.id, rotY: 0, iy: 0 };
      r.min = h.min.slice(); r.max = h.max.slice();
      r.x = (h.min[0] + h.max[0]) / 2; r.z = (h.min[2] + h.max[2]) / 2;
      r.y = h.min[1];                                  // donde va la malla
      r.yb = type === 'floor' ? h.max[1] : h.min[1];   // altura de apoyo
      if (this.pieces.has(r.key)) { r.valid = false; r.why = 'ya hay una pieza ahí'; }
      if (mat && ch.mats[mat] < C.build.cost) { r.valid = false; r.why = 'mat'; }
      return r;
    },

    /* ¿Dónde iría la pieza? origin/dir = desde los ojos hacia donde miras */
    target(ch, origin, dir, type, rot, mat) {
      const yOff = this.yOffFor(ch);
      const reach = C.build.reach;
      const hit = G.Phys.raycastWorld(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, reach + 2);
      if ((type === 'wall' || type === 'floor') && G.Destruct.holes.length) {
        const h = this.holeTarget(origin, dir, type, Math.min(reach + 1.5, hit ? hit.t + 0.5 : Infinity));
        if (h) return this.holeTargetInfo(ch, h, type, mat, yOff);
      }
      if (hit && hit.t > reach) hit.t = reach;
      const t = hit ? Math.max(0, hit.t - 0.05) : reach;
      _p.copy(origin).addScaledVector(dir, t);
      const pcx = Math.floor(ch.pos.x / S), pcz = Math.floor(ch.pos.z / S);
      const feetLvl = Math.round((ch.pos.y - yOff) / H);
      const fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw);
      const face = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
      const extra = type === 'ramp' ? 0.6 : 0;
      let lvl = U.clamp(Math.floor((_p.y - yOff + extra) / H + 1e-4), feetLvl - 1, feetLvl + 1);
      const r = { type, yOff, valid: true };
      if (type === 'wall') {
        let ix = pcx, iz = pcz;
        if (face === 0) ix = pcx + 1; else if (face === 1) iz = pcz + 1;
        const alongX = face === 1 || face === 3;   // pared que corre a lo largo de X
        const yb = yOff + lvl * H;
        r.key = (alongX ? 'wz:' : 'wx:') + ix + ':' + lvl + ':' + iz;
        if (alongX) { r.x = ix * S + S / 2; r.z = iz * S; r.rotY = 0; r.min = [ix * S, yb, iz * S - 0.15]; r.max = [ix * S + S, yb + H, iz * S + 0.15]; }
        else { r.x = ix * S; r.z = iz * S + S / 2; r.rotY = Math.PI / 2; r.min = [ix * S - 0.15, yb, iz * S]; r.max = [ix * S + 0.15, yb + H, iz * S + S]; }
        r.yb = yb;
      } else {
        let cx = U.clamp(Math.floor(_p.x / S), pcx - 1, pcx + 1);
        let cz = U.clamp(Math.floor(_p.z / S), pcz - 1, pcz + 1);
        let d = (face + (rot || 0)) % 4;
        // subir rampas seguidas: la siguiente empieza donde acaba la que pisas
        if (type === 'ramp') {
          const u = this.pieceUnder(ch);
          if (u && u.type === 'ramp' && u.dir === face) {
            cx = u.ix + DIRS[u.dir][0]; cz = u.iz + DIRS[u.dir][1];
            lvl = u.iy + 1; d = u.dir;
          }
        }
        const yb = yOff + lvl * H;
        r.key = type[0] + ':' + cx + ':' + lvl + ':' + cz;
        r.ix = cx; r.iz = cz; r.dir = d;
        r.x = cx * S + S / 2; r.z = cz * S + S / 2;
        r.min = [cx * S, yb, cz * S]; r.max = [cx * S + S, yb + (type === 'cone' ? H * 0.55 : type === 'floor' ? 0.05 : H), cz * S + S];
        if (type === 'floor') r.min[1] = yb - 0.25;
        r.rotY = type === 'ramp' ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][d] : 0;
        r.yb = yb;
      }
      r.iy = lvl;
      r.y = r.yb;
      if (this.pieces.has(r.key)) { r.valid = false; r.why = 'ya hay una pieza ahí'; }
      if (mat && ch.mats[mat] < C.build.cost) { r.valid = false; r.why = 'mat'; }
      // no construir enterrado del todo
      if (r.max[1] < G.Phys.heightAt(r.x, r.z) - 0.3) { r.valid = false; r.why = 'enterrada'; }
      // tiene que apoyarse en el suelo o en otra construcción
      if (r.valid && !this.checkGrounded(r) && !this.list.some((p) => p.g.alive && !p.doomed && this.touching(p, r))) { r.valid = false; r.why = 'en el aire'; }
      return r;
    },

    /* ---------- Colocar una pieza ---------- */
    /* net: viene de la red ({netId} en el invitado, {owner} en el anfitrión) */
    place(ch, t, mat, net) {
      if (!t || !t.valid) return null;
      if (ch && !net) ch.mats[mat] -= C.build.cost;
      const M = G.MATERIALS[mat];
      const g = G.Destruct.create({ name: G.PIECES[t.type].name + ' de ' + M.name.toLowerCase(), mat, hp: M.hp, yield: 0 });
      g.hp = Math.round(M.hp * 0.35);
      const geo = t.hole ? this.holeGeometry(t.hole) : G.Models.pieceGeometry(t.type);
      const mesh = new THREE.Mesh(geo, G.Models.buildMaterial(mat));
      mesh.position.set(t.x, t.y, t.z);
      mesh.rotation.y = t.rotY;
      mesh.castShadow = G.Game.shadowsOn;
      mesh.receiveShadow = G.Game.shadowsOn;
      mesh.scale.set(1, 0.05, 1);
      this.group.add(mesh);
      const piece = {
        key: t.key, type: t.type, mat, g, mesh, yOff: t.yOff, yb: t.yb, cx: t.x, cz: t.z,
        ix: t.ix, iz: t.iz, iy: t.iy, dir: t.dir,
        min: t.min, max: t.max, base: mesh.position.clone(),
        grow: M.hp * 0.65, growRate: (M.hp * 0.65) / M.buildTime, popT: 0.15, shakeT: 0,
        grounded: false, doomed: false, hole: t.hole || null,
      };
      if (t.hole) t.hole.filled = piece;
      g.build = piece;
      g.mesh = mesh;
      G.Destruct.grow(g, t.min[0], t.min[1], t.min[2], t.max[0], t.max[1], t.max[2]);
      this.addColliders(piece, t);
      piece.grounded = this.checkGrounded(piece);
      this.pieces.set(t.key, piece);
      this.list.push(piece);
      if (ch && ch.isPlayer) G.Audio.build();
      if (G.Net.active) G.Net.onBuild(piece, t, mat, ch, net);
      return piece;
    },

    // Quitar una pieza sin efectos (cuando el anfitrión dice que no vale)
    removeQuiet(p) {
      const g = p.g;
      g.alive = false;
      for (const b of g.boxes) G.Phys.removeBox(b);
      for (const s of g.surfs) G.Phys.removeSurf(s);
      this.group.remove(p.mesh);
      if (p.hole && p.hole.filled === p) p.hole.filled = null;
      if (this.pieces.get(p.key) === p) this.pieces.delete(p.key);
      const i = this.list.indexOf(p);
      if (i >= 0) this.list.splice(i, 1);
    },

    addColliders(p, t) {
      const g = p.g, yb = t.yb;
      const box = (x0, y0, z0, x1, y1, z1, noMove) => {
        const b = G.Phys.addBox(x0, y0, z0, x1, y1, z1, { g, build: true, noMove });
        g.boxes.push(b);
      };
      if (t.hole) {
        // exactamente las mismas cajas que tenía la pared/suelo original
        for (const b of t.hole.boxes) box(b[0], b[1], b[2], b[3], b[4], b[5], false);
      } else if (t.type === 'wall' || t.type === 'floor') {
        box(t.min[0], t.min[1], t.min[2], t.max[0], t.max[1], t.max[2], false);
      } else if (t.type === 'ramp') {
        const [dx, dz] = DIRS[t.dir];
        const x0 = t.min[0], z0 = t.min[2];
        const axis = dx !== 0 ? 0 : 1;
        const rising = dx > 0 || dz > 0;
        const top = 0.12;
        const sf = G.Phys.addRamp(x0, z0, x0 + S, z0 + S, axis, rising ? yb + top : yb + H + top, rising ? yb + H + top : yb + top, { build: true });
        g.surfs.push(sf);
        // cajas sólo para las balas, siguiendo la inclinación
        for (let i = 0; i < 4; i++) {
          const a0 = i * S / 4, a1 = (i + 1) * S / 4;
          const k = rising ? i : 3 - i;
          const y0 = yb + k * H / 4 - 0.1, y1 = yb + (k + 1) * H / 4 + 0.15;
          if (axis === 0) box(x0 + a0, y0, z0, x0 + a1, y1, z0 + S, true);
          else box(x0, y0, z0 + a0, x0 + S, y1, z0 + a1, true);
        }
      } else {
        const x0 = t.min[0], z0 = t.min[2];
        const sf = G.Phys.addPyramid(x0, z0, x0 + S, z0 + S, yb, H * 0.55 + 0.05, { build: true });
        g.surfs.push(sf);
        box(x0 + 0.3, yb, z0 + 0.3, x0 + S - 0.3, yb + H * 0.25, z0 + S - 0.3, true);
        box(x0 + S * 0.3, yb + H * 0.25, z0 + S * 0.3, x0 + S * 0.7, yb + H * 0.5, z0 + S * 0.7, true);
      }
    },

    /* ¿Está apoyada en el mapa (terreno, edificios, rocas...)? */
    checkGrounded(p) {
      const [x0, y0, z0] = p.min, [x1, , z1] = p.max;
      const pts = [];
      if (p.type === 'wall') {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (x1 - x0 > z1 - z0) pts.push([x0 + 0.3, cz], [cx, cz], [x1 - 0.3, cz]);
        else pts.push([cx, z0 + 0.3], [cx, cz], [cx, z1 - 0.3]);
      } else {
        pts.push([x0 + 0.3, z0 + 0.3], [x1 - 0.3, z0 + 0.3], [x0 + 0.3, z1 - 0.3], [x1 - 0.3, z1 - 0.3], [(x0 + x1) / 2, (z0 + z1) / 2]);
      }
      const yb = p.type === 'floor' ? p.yb : y0;
      for (const [x, z] of pts) if (G.Phys.supportAt(x, z, yb)) return true;
      // tocando una pared u otra cosa del mapa
      const arr = G.Phys.query(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1, []);
      for (const b of arr) {
        if (b.build || b.nm || b.dead) continue;
        if (b.y1 >= p.min[1] - 0.1 && b.y0 <= p.max[1] + 0.1) return true;
      }
      return false;
    },

    touching(a, b) {
      const e = 0.12;
      return a.min[0] <= b.max[0] + e && a.max[0] >= b.min[0] - e &&
             a.min[1] <= b.max[1] + e && a.max[1] >= b.min[1] - e &&
             a.min[2] <= b.max[2] + e && a.max[2] >= b.min[2] - e;
    },

    // Busca qué piezas siguen conectadas al suelo; las demás se caen
    checkSupport() {
      if (G.Net.isClient && G.Net.inMatch) return;   // los derrumbes los decide el anfitrión
      const alive = this.list.filter((p) => p.g.alive && !p.doomed);
      const ok = new Set();
      const queue = alive.filter((p) => p.grounded);
      for (const p of queue) ok.add(p);
      while (queue.length) {
        const p = queue.pop();
        for (const q of alive) {
          if (ok.has(q)) continue;
          if (this.touching(p, q)) { ok.add(q); queue.push(q); }
        }
      }
      for (const p of alive) {
        if (!ok.has(p)) { p.doomed = true; p.collapseT = 0.08 + Math.random() * 0.35; }
      }
    },

    onHit(p) { p.shakeT = 0.15; },

    onDestroyed(p) {
      this.group.remove(p.mesh);
      if (p.hole && p.hole.filled === p) p.hole.filled = null;   // el hueco vuelve a quedar libre
      this.pieces.delete(p.key);
      const i = this.list.indexOf(p);
      if (i >= 0) this.list.splice(i, 1);
      if (!p.doomed) this.checkSupport();
    },

    // Si se rompe algo del mapa, lo construido encima puede quedarse sin apoyo
    worldChanged(min, max) {
      let any = false;
      for (const p of this.list) {
        if (!p.g.alive) continue;
        if (p.min[0] <= max[0] + 0.5 && p.max[0] >= min[0] - 0.5 && p.min[2] <= max[2] + 0.5 && p.max[2] >= min[2] - 0.5 && p.min[1] <= max[1] + 0.5 && p.max[1] >= min[1] - 0.5) {
          p.grounded = this.checkGrounded(p);
          any = true;
        }
      }
      if (any) this.checkSupport();
    },

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        if (p.grow > 0 && p.g.alive) {
          const add = Math.min(p.grow, p.growRate * dt);
          p.grow -= add;
          p.g.hp = Math.min(p.g.maxHp, p.g.hp + add);
        }
        if (p.popT > 0) {
          p.popT -= dt;
          p.mesh.scale.y = 1 - Math.max(0, p.popT / 0.15) * 0.95;
        }
        if (p.shakeT > 0) {
          p.shakeT -= dt;
          const k = Math.max(0, p.shakeT) * 0.4;
          p.mesh.position.set(p.base.x + (Math.random() - 0.5) * k, p.base.y, p.base.z + (Math.random() - 0.5) * k);
        } else p.mesh.position.copy(p.base);
        if (p.doomed) {
          p.collapseT -= dt;
          if (p.collapseT <= 0) G.Destruct.destroy(p.g, null);
        }
      }
    },

    /* ---------- Vista previa (fantasma azul) ---------- */
    showGhost(t) {
      if (!t) { this.ghost.visible = false; return; }
      this.ghost.geometry = t.hole ? this.holeGeometry(t.hole) : G.Models.pieceGeometry(t.type);
      this.ghost.material = t.valid ? G.Models.ghostMats.ok : G.Models.ghostMats.bad;
      this.ghost.position.set(t.x, t.y, t.z);
      this.ghost.rotation.y = t.rotY;
      this.ghost.visible = true;
    },
  });
})();

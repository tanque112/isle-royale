/* =====================================================================
   towns.js — Pueblos alrededor de Ciudad Torres, cada uno con su estilo:
   - Pueblo Blanco: casas encaladas de colores, plaza con fuente y naranjos,
     capilla de cúpula azul y un molino de viento.
   - Villa Polvo: pueblo del Oeste. Calle de tierra, fachadas falsas con
     porche, el saloon, un depósito de agua, barriles y cactus.
   - Polígono Acero: naves industriales (con pasarela por dentro),
     contenedores apilados, una grúa torre, silos y una chimenea.
   - Fuerte Real: castillo con murallas por las que se puede andar,
     torres en las esquinas y la torre del homenaje en el centro.
   También el faro de Bahía Coral. Ciudad Torres sigue siendo lo principal:
   estos pueblos son más pequeños.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const W = G.World, D = G.Destruct;
  const WT = 0.35, SL = 0.3;   // grosor de paredes y forjados (igual que en world.js)

  const PAL_WHITE = [
    { wall: 0xf7f4ec, trim: 0x2f6fb5, floor: 0xc98a5a, roof: 0xeee8da, stair: 0xd8cfbf },
    { wall: 0xfaf6ee, trim: 0xd9a441, floor: 0xc98a5a, roof: 0xeee8da, stair: 0xd8cfbf },
    { wall: 0xf4f0e6, trim: 0x3f8f5a, floor: 0xb97a4f, roof: 0xe9e3d6, stair: 0xd8cfbf },
    { wall: 0xfdf9f0, trim: 0x2a9d8f, floor: 0xc98a5a, roof: 0xeee8da, stair: 0xd8cfbf },
  ];
  const PAL_WEST = [
    { wall: 0x9c6b3e, trim: 0xe8dcc0, floor: 0x8b6b4a, roof: 0x5a4a3a, stair: 0x9a7b5a, sign: 0x2f5d50 },
    { wall: 0xb07d4f, trim: 0x4a3424, floor: 0x8b6b4a, roof: 0x4f3f30, stair: 0x9a7b5a, sign: 0x7a2e22 },
    { wall: 0x7d5a3a, trim: 0xe8dcc0, floor: 0x8b6b4a, roof: 0x5a4a3a, stair: 0x9a7b5a, sign: 0x1d3557 },
    { wall: 0xc19a6b, trim: 0x5a3a22, floor: 0x8b6b4a, roof: 0x4f3f30, stair: 0x9a7b5a, sign: 0x8f3b2b },
    { wall: 0x8f4a35, trim: 0xf2e6c8, floor: 0x8b6b4a, roof: 0x4a3a2c, stair: 0x9a7b5a, sign: 0x3d405b },
    { wall: 0x6f8790, trim: 0xf2e6c8, floor: 0x8b6b4a, roof: 0x4a3a2c, stair: 0x9a7b5a, sign: 0x7a2e22 },
  ];
  const PAL_IND = [
    { wall: 0x8fa3b5, trim: 0x4f5a64, roof: 0x6b7680 },
    { wall: 0xb5793a, trim: 0x5a4030, roof: 0x7a5a40 },
    { wall: 0x9aa59a, trim: 0x4a554a, roof: 0x6f7a70 },
  ];
  const PAL_KEEP = { wall: 0xa9a59a, trim: 0x8a867c, floor: 0x7d6b55, roof: 0x6d6a63, stair: 0x9a958c };
  const CONT_COLORS = [0xc0392b, 0x2e6fb5, 0x2b9348, 0xe67e22, 0x8e44ad, 0x16a085, 0xd4a017, 0x7f8c8d];

  // Rectángulo pegado a una fachada: u = hacia fuera (u < 0 es dentro), v = a lo largo de la fachada (0 = centro)
  function outRect(r, side, u0, u1, v0, v1) {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    switch (side) {
      case 'zmin': return [cx + v0, r[1] - u1, cx + v1, r[1] - u0];
      case 'zmax': return [cx + v0, r[3] + u0, cx + v1, r[3] + u1];
      case 'xmin': return [r[0] - u1, cz + v0, r[0] - u0, cz + v1];
      default: return [r[2] + u0, cz + v0, r[2] + u1, cz + v1];
    }
  }
  const frontLen = (r, side) => (side === 'zmin' || side === 'zmax' ? r[2] - r[0] : r[3] - r[1]);
  const M4 = () => new THREE.Matrix4();

  Object.assign(W, {
    /* ---------- Dónde poner cada pueblo ----------
       En su dirección, entre la ciudad y los pueblos de fuera: se prueba a varias
       distancias y se queda el sitio más llano, en tierra y sin pisar a nadie. */
    planRingTown(d, a) {
      let best = null;
      for (let dist = 170; dist <= 270; dist += 6) {
        for (const da of [-0.15, -0.075, 0, 0.075, 0.15]) {
          const x = Math.cos(a + da) * dist, z = Math.sin(a + da) * dist;
          // que no toque el asfalto de la ciudad (un cuadrado de 106 m de lado medio)
          if (Math.hypot(Math.max(0, Math.abs(x) - 106), Math.max(0, Math.abs(z) - 106)) < d.r + 14) continue;
          // ni la zona llana de otro pueblo (distancia a su borde, sea círculo o rectángulo)
          if (this.zones.some((zn) => !zn.square && this.zoneDist(zn, x, z) - zn.r < d.r + 10)) continue;
          const h = this.baseHeight(x, z);
          if (h < 3.5 || h > 34) continue;
          // que el pueblo entero quede en tierra
          const k = (dist + d.r + 12) / dist;
          if (this.baseHeight(x * k, z * k) < 1) continue;
          let rough = 0;
          for (let i = 0; i < 8; i++) {
            const t = (i * Math.PI) / 4;
            rough += Math.abs(this.baseHeight(x + Math.cos(t) * d.r, z + Math.sin(t) * d.r) - h);
          }
          const score = rough + Math.abs(dist - 200) * 0.2;
          if (!best || score < best.score) best = { x, z, h, score };
        }
      }
      if (!best) return;   // en esta isla no cabe: mejor no ponerlo que ponerlo mal
      const level = U.clamp(best.h, 3.5, 30);
      if (d.box) this.zones.push({ x: best.x, z: best.z, r: 0, blend: 26, level, box: d.box });
      else this.zones.push({ x: best.x, z: best.z, r: d.r, blend: 26, level, square: false });
      this.pois.push({ name: d.name, x: best.x, z: best.z, r: d.r, level, weight: d.weight || 1, type: d.type, box: d.box });
    },

    /* ---------- Ayudas comunes ---------- */
    // ¿Cabe este rectángulo? (sin chocar con lo ya puesto ni con la carretera)
    rectFree(placed, r, m) {
      if (placed.some((b) => r[0] < b[2] + m && r[2] > b[0] - m && r[1] < b[3] + m && r[3] > b[1] - m)) return false;
      const pts = [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]];
      return !pts.some(([x, z]) => this.nearRoad(x, z, 1.5));
    },
    facing(cx, cz, tx, tz) {
      const dx = tx - cx, dz = tz - cz;
      return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'xmax' : 'xmin') : (dz > 0 ? 'zmax' : 'zmin');
    },
    // la escalera de building() va en el lado contrario a una puerta zmin / zmax
    stairFor(door) { return door === 'zmin' ? 1 : door === 'zmax' ? -1 : (this.r() < 0.5 ? 1 : -1); },

    // Tramo de escalera: rampa para andar + peldaños sólidos (para las balas y para verse)
    stairRun(axis, a0, a1, f0, f1, y0, y1, upPos, color, grp) {
      const N = Math.max(4, Math.round((y1 - y0) / 0.33));
      const run = (a1 - a0) / N, rise = (y1 - y0) / N;
      D.begin(grp);
      const lo = upPos ? y0 + rise * 0.5 : y1 + rise * 0.5, hi = upPos ? y1 + rise * 0.5 : y0 + rise * 0.5;
      if (axis === 'x') this.ramp(a0, f0, a1, f1, 0, lo, hi);
      else this.ramp(f0, a0, f1, a1, 1, lo, hi);
      for (let s = 0; s < N; s++) {
        const p0 = a0 + s * run, p1 = p0 + run;
        const top = upPos ? y0 + (s + 1) * rise : y1 - s * rise;
        if (axis === 'x') this.solid(p0, y0 - 0.1, f0, p1, top, f1, color, { jitter: 0.03, noBottom: true });
        else this.solid(f0, y0 - 0.1, p0, f1, top, p1, color, { jitter: 0.03, noBottom: true });
      }
      D.end();
    },

    // Puntos de navegación por las zonas libres del pueblo (los bots los unen solos si se ven)
    navGrid(cx, cz, hx, hz, y, placed, step) {
      for (let x = cx - hx; x <= cx + hx + 0.01; x += step) {
        for (let z = cz - hz; z <= cz + hz + 0.01; z += step) {
          if (placed.some((b) => x > b[0] - 1.2 && x < b[2] + 1.2 && z > b[1] - 1.2 && z < b[3] + 1.2)) continue;
          if (this.nearRoad(x, z, 0)) continue;
          G.Nav.addNode(x, y, z, true);
        }
      }
    },

    fountain(x, z, y) {
      D.begin({ name: 'Fuente', mat: 'stone', hp: 400, yield: 10 });
      this.solid(x - 1.8, y, z - 1.8, x + 1.8, y + 0.7, z + 1.8, 0xd8d2c4, { noBottom: true });
      this.vbox(x - 1.5, y + 0.7, z - 1.5, x + 1.5, y + 0.72, z + 1.5, 0x4cb3e6, { jitter: 0 });
      this.solid(x - 0.3, y + 0.7, z - 0.3, x + 0.3, y + 1.9, z + 0.3, 0xe8e2d6, { noBottom: true });
      this.vbox(x - 0.6, y + 1.9, z - 0.6, x + 0.6, y + 2.05, z + 0.6, 0x2f6fb5, {});
      D.end();
    },

    // Maceta con flores (sólo decoración)
    pot(x, z, y) {
      this.vbox(x - 0.25, y, z - 0.25, x + 0.25, y + 0.45, z + 0.25, 0xc0623a, { noBottom: true });
      const m = M4().makeTranslation(x, y + 0.25, z).multiply(M4().makeScale(0.42, 0.5, 0.42));
      this.vgeo(this.tpl.bush, m, this.pick([0x4f9a3e, 0xd94f8a, 0xe8c23a, 0xe63946]), 0.08);
    },

    barrel(x, z, y, color) {
      D.begin({ name: 'Barril', mat: 'wood', hp: 60, yield: 4 });
      const m = M4().makeTranslation(x, y, z).multiply(M4().makeScale(0.45, 1.05, 0.45));
      this.vgeo(this.tpl.cyl, m, color || 0x8a5a33, 0.06);
      for (const h of [0.2, 0.8]) {
        const mb = M4().makeTranslation(x, y + h, z).multiply(M4().makeScale(0.47, 0.07, 0.47));
        this.vgeo(this.tpl.cyl, mb, 0x3a3a3a, 0);
      }
      D.addBox(D.active, G.Phys.addBox(x - 0.42, y, z - 0.42, x + 0.42, y + 1.05, z + 0.42));
      D.end();
    },

    /* =================================================================
       PUEBLO BLANCO (mediterráneo)
       ================================================================= */
    buildWhiteTown(p) {
      const y = p.level, Nv = G.Nav, placed = [];
      const free = (r, m) => this.rectFree(placed, r, m);
      // plaza empedrada con fuente y naranjos
      this.vbox(p.x - 10, y, p.z - 10, p.x + 10, y + 0.04, p.z + 10, 0xe3d6bd, { noBottom: true, jitter: 0.02 });
      for (let i = -9; i <= 9; i += 3) {
        this.vbox(p.x + i - 0.05, y + 0.04, p.z - 10, p.x + i + 0.05, y + 0.05, p.z + 10, 0xcdbfa5, { jitter: 0, noBottom: true });
      }
      this.fountain(p.x, p.z, y);
      for (const [dx, dz] of [[-6.5, -6.5], [6.5, 6.5], [-6.5, 6.5], [6.5, -6.5]]) this.tree(p.x + dx, p.z + dz, y, 'orange');
      placed.push([p.x - 10.5, p.z - 10.5, p.x + 10.5, p.z + 10.5]);
      for (const [dx, dz] of [[-3, -8], [3, 8], [8, -3], [-8, 3]]) this.lootSpots.push({ x: p.x + dx, y, z: p.z + dz });
      this.chestSpots.push({ x: p.x + 2.6, y, z: p.z - 2.6, rot: this.rr(0, 6.28) });

      // capilla encalada con cúpula azul y campanario (en el lado contrario a la ciudad)
      const aOut = Math.atan2(p.z, p.x);
      {
        const cx = p.x + Math.cos(aOut) * 22, cz = p.z + Math.sin(aOut) * 22;
        const r = [cx - 6.5, cz - 6.5, cx + 6.5, cz + 6.5];
        if (free(r, 1)) {
          const door = this.facing(cx, cz, p.x, p.z);
          this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors: 1, stairSide: this.stairFor(door), doorSide: door, outsideY: y,
            pal: { wall: 0xfbf8f1, trim: 0x2f6fb5, floor: 0xb97a4f, roof: 0xeee8da, stair: 0xd8cfbf }, kind: 'house', mat: 'stone', wallHp: 200, interior: 'chapel' });
          const ry = y + 0.25 + G.CONFIG.floorHeight;
          D.begin({ name: 'Cúpula', mat: 'stone', hp: 350, yield: 9 });
          this.vgeo(this.tpl.cyl, M4().makeTranslation(cx, ry, cz).multiply(M4().makeScale(3.4, 1.4, 3.4)), 0xfbf8f1, 0.02);
          this.vgeo(this.tpl.gball, M4().makeTranslation(cx, ry + 1.4, cz).multiply(M4().makeScale(3.3, 2.8, 3.3)), 0x2f6fb5, 0.03);
          this.vbox(cx - 0.08, ry + 4.1, cz - 0.08, cx + 0.08, ry + 5.4, cz + 0.08, 0xe8e2d6, { jitter: 0 });
          this.vbox(cx - 0.45, ry + 4.85, cz - 0.08, cx + 0.45, ry + 5.0, cz + 0.08, 0xe8e2d6, { jitter: 0 });
          D.addBox(D.active, G.Phys.addBox(cx - 2.6, ry, cz - 2.6, cx + 2.6, ry + 3.6, cz + 2.6, { noMove: true }));
          D.end();
          // campanario pegado a una esquina
          const tx = r[2] + 1.4, tz = r[1] + 1.4;
          D.begin({ name: 'Campanario', mat: 'stone', hp: 500, yield: 10 });
          this.solid(tx - 1.4, y - 0.5, tz - 1.4, tx + 1.4, y + 8, tz + 1.4, 0xfbf8f1, { noBottom: true });
          for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) this.solid(tx + ox - 0.3, y + 8, tz + oz - 0.3, tx + ox + 0.3, y + 10, tz + oz + 0.3, 0xfbf8f1, { noBottom: true, noTop: true });
          this.vbox(tx - 0.4, y + 8.5, tz - 0.4, tx + 0.4, y + 9.4, tz + 0.4, 0xd4a017, { jitter: 0 });
          this.solid(tx - 1.55, y + 10, tz - 1.55, tx + 1.55, y + 10.3, tz + 1.55, 0xfbf8f1);
          this.vgeo(this.tpl.gball, M4().makeTranslation(tx, y + 10.3, tz).multiply(M4().makeScale(1.3, 1.2, 1.3)), 0x2f6fb5, 0.03);
          D.end();
          placed.push([r[0] - 1, r[1] - 1, r[2] + 3.2, r[3] + 1]);
          this.buildings.push({ x0: tx - 1.4, z0: tz - 1.4, x1: tx + 1.4, z1: tz + 1.4, floors: 0, base: y, top: y + 11.5, color: 0xfbf8f1 });
        }
      }

      // casas encaladas alrededor de la plaza (la puerta mira a la plaza)
      const slots = [];
      for (let i = 0; i < 7; i++) slots.push([aOut + 0.45 + (i / 7) * Math.PI * 2, 19.5]);
      for (let i = 0; i < 9; i++) slots.push([aOut + 0.2 + (i / 9) * Math.PI * 2, 30]);
      for (const [a, rad] of slots) {
        const two = this.r() < 0.55;
        const w = two ? this.rr(11.5, 12.5) : this.rr(8.5, 10), d = two ? this.rr(10.5, 11.5) : this.rr(8.5, 9.5);
        const cx = p.x + Math.cos(a) * rad, cz = p.z + Math.sin(a) * rad;
        const r = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
        if (!free(r, 1.8)) continue;
        const door = this.facing(cx, cz, p.x, p.z);
        this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors: two ? 2 : 1, pal: this.pick(PAL_WHITE),
          stairSide: this.stairFor(door), doorSide: door, outsideY: y, kind: 'house', mat: 'stone', wallHp: 180 });
        placed.push(r);
        // macetas en las esquinas de la fachada
        const half = frontLen(r, door) / 2;
        for (const v of [-half + 0.5, half - 0.5]) {
          const q = outRect(r, door, 0.35, 0.35, v, v);
          this.pot(q[0], q[1], y);
        }
      }

      // molino de viento a las afueras
      for (const da of [1.6, -1.6, 2.4, -2.4]) {
        const a = aOut + da, x = p.x + Math.cos(a) * 44, z = p.z + Math.sin(a) * 44;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.5 || !this.rectFree(placed, [x - 4, z - 4, x + 4, z + 4], 1)) continue;
        this.windmill(x, z, h - 0.3, Math.atan2(z - p.z, x - p.x));
        placed.push([x - 3, z - 3, x + 3, z + 3]);
        break;
      }

      // bancos y farolas en la plaza
      for (const [dx, dz, al] of [[-9, 0, true], [9, 0, true], [0, -9, false], [0, 9, false]]) {
        D.begin({ name: 'Banco', mat: 'stone', hp: 90, yield: 5 });
        if (al) this.solid(p.x + dx - 0.4, y, p.z + dz - 1.5, p.x + dx + 0.4, y + 0.5, p.z + dz + 1.5, 0xe8e2d6, { noBottom: true });
        else this.solid(p.x + dx - 1.5, y, p.z + dz - 0.4, p.x + dx + 1.5, y + 0.5, p.z + dz + 0.4, 0xe8e2d6, { noBottom: true });
        D.end();
      }
      // nodos para los bots y una moto
      Nv.addNode(p.x + 3.5, y, p.z + 3.5, true);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        Nv.addNode(p.x + Math.cos(a) * 12.5, y, p.z + Math.sin(a) * 12.5, true);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4, x = p.x + Math.cos(a) * 38, z = p.z + Math.sin(a) * 38;
        if (placed.some((b) => x > b[0] - 1 && x < b[2] + 1 && z > b[1] - 1 && z < b[3] + 1)) continue;
        const h = G.Phys.heightAt(x, z);
        if (h > 2.4) Nv.addNode(x, h, z, true);
      }
      this.motoSpots.push({ x: p.x - Math.cos(aOut) * 12.5, y, z: p.z - Math.sin(aOut) * 12.5, yaw: this.rr(0, 6.28) });
    },

    // Molino blanco de La Mancha: torre redonda, tejado cónico y 4 aspas
    windmill(x, z, y, ang) {
      D.begin({ name: 'Molino', mat: 'stone', hp: 600, yield: 12 });
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(2.6, 7.5, 2.6)), 0xfbf8f1, 0.02);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(2.7, 0.5, 2.7)), 0x2f6fb5, 0);
      this.vgeo(this.tpl.gcone, M4().makeTranslation(x, y + 7.5, z).multiply(M4().makeScale(3.0, 2.4, 3.0)), 0x4a3a2c, 0.04);
      // puerta y ventanita (pintadas)
      const cs = Math.cos(ang + Math.PI), sn = Math.sin(ang + Math.PI);
      this.vbox(x + cs * 2.62 - 0.55, y, z + sn * 2.62 - 0.55, x + cs * 2.62 + 0.55, y + 2.2, z + sn * 2.62 + 0.55, 0x2f6fb5, { jitter: 0 });
      // aspas, mirando hacia fuera del pueblo
      const hx = x + Math.cos(ang) * 2.9, hz = z + Math.sin(ang) * 2.9, hy = y + 6.4;
      const ry = Math.atan2(Math.cos(ang), Math.sin(ang));
      const spin = this.rr(0, 1.5);
      for (let k = 0; k < 4; k++) {
        const m = M4().makeTranslation(hx, hy, hz).multiply(M4().makeRotationY(ry)).multiply(M4().makeRotationZ(spin + (k * Math.PI) / 2));
        this.vgeo(this.tpl.blade, m, 0x6b4a2a, 0.04);
      }
      this.vgeo(this.tpl.cyl, M4().makeTranslation(hx, hy, hz).multiply(M4().makeRotationY(ry)).multiply(M4().makeRotationX(Math.PI / 2)).multiply(M4().makeScale(0.35, 0.6, 0.35)), 0x3a2a1a, 0);
      D.addBox(D.active, G.Phys.addBox(x - 2.2, y, z - 2.2, x + 2.2, y + 8.5, z + 2.2));
      D.end();
      this.mapTrees.push({ x, z, r: 2.6 });
      const lx = x - Math.cos(ang) * 4, lz = z - Math.sin(ang) * 4;
      this.lootSpots.push({ x: lx, y: G.Phys.heightAt(lx, lz), z: lz });
      this.chestSpots.push({ x: x + Math.sin(ang) * 3.6, y: G.Phys.heightAt(x + Math.sin(ang) * 3.6, z - Math.cos(ang) * 3.6), z: z - Math.cos(ang) * 3.6, rot: this.rr(0, 6.28) });
    },

    /* =================================================================
       VILLA POLVO (pueblo del Oeste)
       ================================================================= */
    buildWesternTown(p) {
      const y = p.level, Nv = G.Nav, placed = [];
      const free = (r, m) => this.rectFree(placed, r, m);
      const SW = 5;     // media anchura de la calle (va a lo largo de X)
      this.vbox(p.x - 40, y, p.z - SW, p.x + 40, y + 0.03, p.z + SW, 0xc4a06a, { noBottom: true, jitter: 0.02 });
      const DEPTH = 11, PD = 2.4;

      // edificios a los dos lados de la calle, con la puerta y el porche mirando a ella
      let saloonDone = false;
      for (const side of [1, -1]) {
        const door = side > 0 ? 'zmin' : 'zmax';
        let v = -37 + this.rr(0, 2);
        while (true) {
          const saloon = !saloonDone && side > 0 && v > -12;
          const w = saloon ? 15 : this.rr(10.6, 12.6);
          if (v + w > 37) break;
          const zA = p.z + side * (SW + PD + 0.2), zB = zA + side * DEPTH;
          const r = [p.x + v, Math.min(zA, zB), p.x + v + w, Math.max(zA, zB)];
          v += w + this.rr(1.6, 3.4);
          const withPorch = side > 0 ? [r[0], r[1] - PD - 0.2, r[2], r[3]] : [r[0], r[1], r[2], r[3] + PD + 0.2];
          if (!free(withPorch, 0.4)) continue;
          if (saloon) saloonDone = true;
          const floors = saloon || this.r() < 0.45 ? 2 : 1;
          const pal = saloon ? { wall: 0x8f3b2b, trim: 0xf2e6c8, floor: 0x8b6b4a, roof: 0x4a3a2c, stair: 0x9a7b5a, sign: 0x8f2d1f } : this.pick(PAL_WEST);
          this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors, pal, stairSide: side, doorSide: door, outsideY: y, kind: 'house',
            interior: saloon ? 'saloon' : this.pick(['store', 'sheriff', 'home']) });
          this.westernFront(r, door, y + 0.25, floors, pal, saloon);
          placed.push(withPorch);
          // barriles junto al porche
          if (this.r() < 0.6) {
            const q = outRect(r, door, PD + 0.7, PD + 0.7, frontLen(r, door) / 2 - 0.7, 0);
            this.barrel(q[0], q[1], y, this.pick([0x8a5a33, 0x7a4a26]));
          }
        }
      }
      // la calle se marca como ocupada después de poner las casas (sus porches llegan justo hasta ella)
      placed.push([p.x - 40, p.z - SW + 0.5, p.x + 40, p.z + SW - 0.5]);

      // depósito de agua al final de la calle, cactus, pacas de paja y abrevadero
      for (const [dx, dz] of [[34, 15], [-34, -15], [34, -15], [-34, 15]]) {
        const x = p.x + dx, z = p.z + dz;
        if (!free([x - 2.5, z - 2.5, x + 2.5, z + 2.5], 0.5)) continue;
        this.waterTower(x, z, y);
        placed.push([x - 2.5, z - 2.5, x + 2.5, z + 2.5]);
        break;
      }
      for (let i = 0; i < 6; i++) {
        const x = p.x + this.rr(-34, 34), z = p.z + (this.r() < 0.5 ? -1 : 1) * this.rr(SW + 0.6, SW + 1.4);
        if (!free([x - 0.8, z - 0.8, x + 0.8, z + 0.8], 0.3)) continue;
        if (this.r() < 0.5) this.barrel(x, z, y);
        else {
          D.begin({ name: 'Paca de paja', mat: 'wood', hp: 60, yield: 5 });
          this.vgeo(this.tpl.hay, M4().makeTranslation(x, y, z), 0xe0c060, 0.05);
          D.addBox(D.active, G.Phys.addBox(x - 0.7, y, z - 0.75, x + 0.7, y + 1.5, z + 0.75));
          D.end();
        }
        placed.push([x - 0.8, z - 0.8, x + 0.8, z + 0.8]);
      }
      // abrevadero en mitad de la calle
      D.begin({ name: 'Abrevadero', mat: 'wood', hp: 120, yield: 6 });
      this.solid(p.x - 1.6, y, p.z - 0.5, p.x + 1.6, y + 0.8, p.z + 0.5, 0x7a5232, { noBottom: true });
      this.vbox(p.x - 1.45, y + 0.8, p.z - 0.38, p.x + 1.45, y + 0.82, p.z + 0.38, 0x4c8fb5, { jitter: 0 });
      D.end();
      // cactus por las afueras
      for (let i = 0, n = 0; i < 80 && n < 14; i++) {
        const a = this.rr(0, 6.28), dd = this.rr(46, 70);
        const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.5 || !this.isFree(x, z, 2)) continue;
        this.cactus(x, z, h - 0.1);
        n++;
      }
      // botín en la calle, nodos y una moto
      for (const dx of [-26, -8, 12, 28]) this.lootSpots.push({ x: p.x + dx, y, z: p.z + this.rr(-3, 3) });
      this.chestSpots.push({ x: p.x + 5, y, z: p.z - 3.2, rot: 0 });
      for (let dx = -36; dx <= 36; dx += 12) Nv.addNode(p.x + dx, y, p.z, true);
      this.navGrid(p.x, p.z, 40, 24, y, placed, 12);
      this.motoSpots.push({ x: p.x - 18, y, z: p.z + 2.5, yaw: Math.PI / 2 });
    },

    // Fachada falsa del Oeste (más alta que el tejado, con cartel) y porche de tablas con tejadillo
    westernFront(r, side, base, floors, pal, saloon) {
      const top = base + floors * G.CONFIG.floorHeight;
      const half = frontLen(r, side) / 2, PD = 2.4;
      D.begin({ name: saloon ? 'Fachada del saloon' : 'Fachada', mat: 'wood', hp: 160, yield: 6 });
      let q = outRect(r, side, 0, 0.25, -half - 0.1, half + 0.1);
      this.solid(q[0], top - 0.4, q[1], q[2], top + 1.8, q[3], pal.wall, { noBottom: true });
      q = outRect(r, side, 0, 0.25, -half * 0.45, half * 0.45);
      this.solid(q[0], top + 1.8, q[1], q[2], top + 2.7, q[3], pal.wall, { noBottom: true });
      q = outRect(r, side, 0, 0.3, -half * 0.47, half * 0.47);
      this.vbox(q[0], top + 2.7, q[1], q[2], top + 2.85, q[3], pal.trim, { jitter: 0 });
      // cartel (el del saloon, rojo y amarillo)
      q = outRect(r, side, 0.25, 0.38, -half * 0.55, half * 0.55);
      this.vbox(q[0], top + 0.4, q[1], q[2], top + 1.6, q[3], pal.sign, { jitter: 0 });
      q = outRect(r, side, 0.38, 0.43, -half * 0.42, half * 0.42);
      this.vbox(q[0], top + 0.78, q[1], q[2], top + 1.22, q[3], saloon ? 0xffd166 : 0xf2e6c8, { jitter: 0 });
      D.end();
      // tarima del porche (no se rompe)
      q = outRect(r, side, 0, PD, -half, half);
      this.solid(q[0], base - 0.6, q[1], q[2], base + 0.02, q[3], 0x8b6a45, { noBottom: true, jitter: 0.03 });
      // postes y tejadillo
      D.begin({ name: 'Porche', mat: 'wood', hp: 140, yield: 5 });
      const n = Math.max(2, Math.round((half * 2) / 3.4));
      for (let i = 0; i <= n; i++) {
        const v = -half + 0.2 + (i * (half * 2 - 0.4)) / n;
        const pq = outRect(r, side, PD - 0.3, PD - 0.08, v - 0.11, v + 0.11);
        this.solid(pq[0], base, pq[1], pq[2], base + 3.0, pq[3], pal.trim, { noBottom: true, noTop: true });
      }
      q = outRect(r, side, -0.05, PD + 0.15, -half - 0.1, half + 0.1);
      this.solid(q[0], base + 3.0, q[1], q[2], base + 3.18, q[3], pal.roof, {});
      D.end();
    },

    waterTower(x, z, y) {
      D.begin({ name: 'Depósito de agua', mat: 'wood', hp: 320, yield: 10 });
      for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
        this.solid(x + ox - 0.15, y, z + oz - 0.15, x + ox + 0.15, y + 6, z + oz + 0.15, 0x6b4a2a, { noBottom: true, noTop: true });
      }
      this.vbox(x - 1.5, y + 2.8, z - 1.55, x + 1.5, y + 3.0, z - 1.45, 0x6b4a2a, { jitter: 0 });
      this.vbox(x - 1.55, y + 2.8, z - 1.5, x - 1.45, y + 3.0, z + 1.5, 0x6b4a2a, { jitter: 0 });
      this.solid(x - 2.1, y + 6, z - 2.1, x + 2.1, y + 6.3, z + 2.1, 0x7a5232);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 6.3, z).multiply(M4().makeScale(1.8, 3.1, 1.8)), 0x9c6b3e, 0.04);
      for (const h of [7.0, 8.4]) this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + h, z).multiply(M4().makeScale(1.84, 0.12, 1.84)), 0x3a3a3a, 0);
      this.vgeo(this.tpl.gcone, M4().makeTranslation(x, y + 9.4, z).multiply(M4().makeScale(2.0, 1.2, 2.0)), 0x5a4a3a, 0.03);
      D.addBox(D.active, G.Phys.addBox(x - 1.6, y + 6.3, z - 1.6, x + 1.6, y + 9.4, z + 1.6));
      D.end();
      this.mapTrees.push({ x, z, r: 2 });
      this.chestSpots.push({ x: x + 0.2, y, z: z + 0.2, rot: this.rr(0, 6.28) });
    },

    cactus(x, z, y) {
      const s = this.rr(0.8, 1.25), h = 3 * s, g = this.pick([0x4f8a3c, 0x5a9445, 0x47803a]);
      D.begin({ name: 'Cactus', mat: 'wood', hp: 60, yield: 4 });
      this.solid(x - 0.28 * s, y - 0.2, z - 0.28 * s, x + 0.28 * s, y + h, z + 0.28 * s, g, { noBottom: true });
      const ax = this.r() < 0.5;   // brazos a lo largo de X o de Z
      for (const sg of [-1, 1]) {
        if (this.r() < 0.25) continue;
        const ah = y + h * this.rr(0.3, 0.55), r0 = 0.28 * s, r1 = r0 + 0.6 * s, t = 0.17 * s, up = this.rr(0.6, 1.1) * s;
        const a0 = Math.min(sg * r0, sg * r1), a1 = Math.max(sg * r0, sg * r1);
        const c0 = sg > 0 ? r1 - 2 * t : -r1, c1 = sg > 0 ? r1 : -r1 + 2 * t;
        if (ax) { this.vbox(x + a0, ah, z - t, x + a1, ah + 2 * t, z + t, g); this.vbox(x + c0, ah, z - t, x + c1, ah + up, z + t, g); }
        else { this.vbox(x - t, ah, z + a0, x + t, ah + 2 * t, z + a1, g); this.vbox(x - t, ah, z + c0, x + t, ah + up, z + c1, g); }
      }
      D.end();
    },

    /* =================================================================
       POLÍGONO ACERO (zona industrial)
       ================================================================= */
    buildIndustrial(p) {
      const y = p.level, Nv = G.Nav, placed = [];
      const free = (r, m) => this.rectFree(placed, r, m);
      // explanada de hormigón con líneas amarillas
      this.vbox(p.x - 37, y, p.z - 31, p.x + 37, y + 0.05, p.z + 31, 0x8e9094, { noBottom: true, jitter: 0.015 });
      for (const lx of [-7.5, 7.5]) this.vbox(p.x + lx - 0.12, y + 0.05, p.z - 30, p.x + lx + 0.12, y + 0.07, p.z + 30, 0xe8c23a, { jitter: 0, noBottom: true });

      // dos naves
      for (const [a, b, c, d, door] of [[-31, -27, -9, -6, 'zmax'], [9, 6, 31, 27, 'zmin']]) {
        const r = [p.x + a, p.z + b, p.x + c, p.z + d];
        if (!free(r, 1)) continue;
        this.warehouse(r, y, door, this.pick(PAL_IND));
        placed.push([r[0] - 0.5, r[1] - 0.5, r[2] + 0.5, r[3] + 0.5]);
      }

      // contenedores (2 bloques; algunos apilados de dos en dos)
      const conts = [];
      for (const x0 of [-30, -22.6, -15.2]) for (const z0 of [7.5, 12.2, 19, 23.7]) conts.push([p.x + x0, p.z + z0, true]);
      for (const z0 of [-29, -21.6, -14.2]) for (const x0 of [9, 13.7, 20.5, 25.2]) conts.push([p.x + x0, p.z + z0, false]);
      let topChest = false;
      for (const [cx0, cz0, alongX] of conts) {
        if (this.r() < 0.18) continue;          // huecos para pasar
        const r = alongX ? [cx0, cz0, cx0 + 6.1, cz0 + 2.44] : [cx0, cz0, cx0 + 2.44, cz0 + 6.1];
        if (!free(r, 0.2)) continue;
        const two = this.r() < 0.35;
        this.container(r, y, this.pick(CONT_COLORS));
        if (two) this.container(r, y + 2.6, this.pick(CONT_COLORS));
        placed.push(r);
        this.buildings.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], floors: 0, base: y, top: y + (two ? 5.2 : 2.6), color: 0x9a6a50 });
        const top = y + (two ? 5.2 : 2.6), mx = (r[0] + r[2]) / 2, mz = (r[1] + r[3]) / 2;
        if (two && !topChest) { this.chestSpots.push({ x: mx, y: top, z: mz, rot: alongX ? 0 : Math.PI / 2, noBot: true }); topChest = true; }
        else if (this.r() < 0.25) this.lootSpots.push({ x: mx, y: top, z: mz, roof: true });
      }

      // grúa torre sobre los contenedores, dos silos y una chimenea
      if (free([p.x - 4.5, p.z - 21.5, p.x - 1.5, p.z - 18.5], 0.5)) {
        this.crane(p.x - 3, p.z - 20, y, 28);
        placed.push([p.x - 4.5, p.z - 21.5, p.x - 1.5, p.z - 18.5]);
      }
      for (const [dx, dz] of [[-3, 17], [3.2, 22]]) {
        const x = p.x + dx, z = p.z + dz;
        if (!free([x - 2.5, z - 2.5, x + 2.5, z + 2.5], 0.3)) continue;
        this.silo(x, z, y);
        placed.push([x - 2.5, z - 2.5, x + 2.5, z + 2.5]);
      }
      {
        const x = p.x + 34, z = p.z + 29.5;
        if (free([x - 1.5, z - 1.5, x + 1.5, z + 1.5], 0.3)) { this.chimney(x, z, y); placed.push([x - 1.5, z - 1.5, x + 1.5, z + 1.5]); }
      }
      // bloques de hormigón y bidones como cobertura en el patio
      for (let i = 0; i < 10; i++) {
        const x = p.x + this.rr(-6, 6), z = p.z + this.rr(-26, 26);
        const al = this.r() < 0.5;
        const r = al ? [x - 1, z - 0.3, x + 1, z + 0.3] : [x - 0.3, z - 1, x + 0.3, z + 1];
        if (!free(r, 1.2)) continue;
        if (this.r() < 0.6) {
          D.begin({ name: 'Bloque de hormigón', mat: 'stone', hp: 160, yield: 6 });
          this.solid(r[0], y, r[1], r[2], y + 0.9, r[3], 0xb5b3ab, { noBottom: true });
          D.end();
        } else this.barrel(x, z, y, this.pick([0x2e6fb5, 0xc0392b, 0x2b9348]));
        placed.push(r);
      }
      // botín del patio, nodos y una moto
      for (const [dx, dz] of [[0, -4], [0, 6], [-4, 2], [4, -12], [-33, 2], [33, -2]]) {
        const x = p.x + dx, z = p.z + dz;
        if (placed.some((b) => x > b[0] - 0.5 && x < b[2] + 0.5 && z > b[1] - 0.5 && z < b[3] + 0.5)) continue;
        this.lootSpots.push({ x, y, z });
      }
      this.chestSpots.push({ x: p.x + 1, y, z: p.z + 1, rot: this.rr(0, 6.28) });
      this.navGrid(p.x, p.z, 34, 28, y, placed, 10);
      this.motoSpots.push({ x: p.x + 2, y, z: p.z - 4, yaw: 0 });
    },

    // Nave industrial de chapa: 7 m de alto, puerta en zmin o zmax, pasarela con escalera por dentro
    warehouse(r, y, door, col) {
      const [x0, z0, x1, z1] = r, Hw = 7, base = y + 0.15;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const GW = { name: 'Pared de chapa', mat: 'metal', hp: 260, yield: 8 };
      this.solid(x0, y - 0.4, z0, x1, base, z1, 0x7d7f83, { jitter: 0.01 });
      this.wall('x', x0, x1, z0, z0 + WT, base, base + Hw, door === 'zmin' ? cx : null, col.wall, false, GW);
      this.wall('x', x0, x1, z1 - WT, z1, base, base + Hw, door === 'zmax' ? cx : null, col.wall, false, GW);
      this.wall('z', z0 + WT, z1 - WT, x0, x0 + WT, base, base + Hw, null, col.wall, false, GW);
      this.wall('z', z0 + WT, z1 - WT, x1 - WT, x1, base, base + Hw, null, col.wall, false, GW);
      const top = base + Hw;
      this.slabTiles(x0, z0, x1, z1, top, top + SL, null, col.roof, { name: 'Tejado de chapa', mat: 'metal', hp: 200, yield: 6 },
        { tb: 0.12, ty0: top - 0.06, ty1: top + SL + 0.06, color: col.trim });

      // pasarela pegada a la pared del fondo + escalera (sube hacia la pared lateral)
      const back = door === 'zmax' ? 1 : -1;   // 1: el fondo es z0
      const my = base + 3.6;
      const mz0 = back > 0 ? z0 + WT : z1 - WT - 3.4, mz1 = mz0 + 3.4;
      D.begin({ name: 'Pasarela', mat: 'metal', hp: 300, yield: 8 });
      this.solid(x0 + WT, my - 0.25, mz0, x1 - WT, my, mz1, 0x5d6670, { bottomColor: 0x3f454c });
      D.end();
      const lz0 = back > 0 ? mz1 : mz0 - 1.6, lz1 = lz0 + 1.6;
      const sx0 = x0 + WT + 0.2, sx1 = sx0 + 7.2;
      this.stairRun('x', sx0, sx1, lz0, lz1, base, my, false, 0x6b737c, { name: 'Escalera', mat: 'metal', hp: 300, yield: 6 });
      D.begin({ name: 'Barandilla', mat: 'metal', hp: 90, yield: 3 });
      const rz = back > 0 ? [mz1 - 0.08, mz1] : [mz0, mz0 + 0.08];
      this.solid(sx0 + 1.8, my, rz[0], x1 - WT, my + 1.0, rz[1], 0xd4a017, { noBottom: true });
      D.end();

      // estanterías con cajas (cobertura), dejando libre el pasillo de la puerta
      const zb = back > 0 ? lz1 : lz0;
      for (const off of [4.2, 9.0]) {
        const rzc = zb + back * off;
        for (const [a0, a1] of [[x0 + 1.6, cx - 2.6], [cx + 2.6, x1 - 1.6]]) {
          if (a1 - a0 < 2) continue;
          D.begin({ name: 'Estantería', mat: 'metal', hp: 180, yield: 6 });
          this.solid(a0, base, rzc - 0.45, a1, base + 2.3, rzc + 0.45, 0x3f6fa8, { noBottom: true });
          for (let bx = a0 + 0.3; bx < a1 - 0.9; bx += this.rr(1.0, 1.6)) {
            const bh = this.rr(0.4, 0.75);
            this.vbox(bx, base + 2.3, rzc - 0.35, bx + 0.8, base + 2.3 + bh, rzc + 0.35, this.pick([0xc49a6c, 0xb5874f, 0xd9b77e]), {});
          }
          D.end();
        }
        this.lootSpots.push({ x: this.rr(x0 + 2, x1 - 2), y: base, z: rzc + back * 2.2, indoor: true });
      }
      // botín y cofre en la pasarela
      this.lootSpots.push({ x: this.rr(cx, x1 - 2), y: my, z: (mz0 + mz1) / 2, indoor: true });
      this.chestSpots.push({ x: x1 - WT - 1.2, y: my, z: (mz0 + mz1) / 2, rot: back > 0 ? 0 : Math.PI });

      // navegación: fuera → dentro → centro → pie de la escalera → arriba → pasarela
      const Nv = G.Nav, fzs = back > 0 ? z1 : z0, out = back;   // "out" = hacia fuera por la puerta
      const laneC = (lz0 + lz1) / 2;
      const nOut = Nv.addNode(cx, y, fzs + out * 2, true), nIn = Nv.addNode(cx, base, fzs - out * 1.6, false);
      const nC = Nv.addNode(cx, base, zb + back * 6.6, false);
      const nFoot = Nv.addNode(sx1 + 1.2, base, laneC, false), nTop = Nv.addNode(sx0 + 0.8, my, laneC, false);
      const nMz = Nv.addNode(sx0 + 0.8, my, (mz0 + mz1) / 2, false), nMz2 = Nv.addNode(x1 - 2, my, (mz0 + mz1) / 2, false);
      Nv.link(nOut, nIn); Nv.link(nIn, nC); Nv.link(nC, nFoot); Nv.link(nFoot, nTop); Nv.link(nTop, nMz); Nv.link(nMz, nMz2);
      this.buildings.push({ x0, z0, x1, z1, floors: 1, base, top: top + SL, color: col.wall });
    },

    // Contenedor de barco (r = rectángulo, 2,6 m de alto) con nervios y puertas
    container(r, y, color) {
      const [x0, z0, x1, z1] = r;
      D.begin({ name: 'Contenedor', mat: 'metal', hp: 350, yield: 10 });
      this.solid(x0, y, z0, x1, y + 2.6, z1, color, { noBottom: y > 1 ? false : true, jitter: 0.03 });
      const dark = new THREE.Color(color).multiplyScalar(0.72).getHex();
      const alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0;
      for (let t = 0.45; t < L - 0.3; t += 0.65) {
        if (alongX) {
          this.vbox(x0 + t, y + 0.12, z0 - 0.04, x0 + t + 0.14, y + 2.48, z0, dark, { jitter: 0, noTop: true, noBottom: true });
          this.vbox(x0 + t, y + 0.12, z1, x0 + t + 0.14, y + 2.48, z1 + 0.04, dark, { jitter: 0, noTop: true, noBottom: true });
        } else {
          this.vbox(x0 - 0.04, y + 0.12, z0 + t, x0, y + 2.48, z0 + t + 0.14, dark, { jitter: 0, noTop: true, noBottom: true });
          this.vbox(x1, y + 0.12, z0 + t, x1 + 0.04, y + 2.48, z0 + t + 0.14, dark, { jitter: 0, noTop: true, noBottom: true });
        }
      }
      // puertas en un extremo (dos hojas con sus barras)
      if (alongX) this.vbox(x1, y + 0.1, z0 + 0.1, x1 + 0.05, y + 2.5, z1 - 0.1, dark, { jitter: 0 });
      else this.vbox(x0 + 0.1, y + 0.1, z1, x1 - 0.1, y + 2.5, z1 + 0.05, dark, { jitter: 0 });
      D.end();
    },

    crane(x, z, y, len) {
      D.begin({ name: 'Grúa', mat: 'metal', hp: 700, yield: 14 });
      const Hc = 22, yel = 0xf2b705;
      for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
        this.vbox(x + ox - 0.12, y, z + oz - 0.12, x + ox + 0.12, y + Hc, z + oz + 0.12, yel, { noBottom: true, noTop: true, jitter: 0 });
      }
      for (let h = 2; h < Hc; h += 2.5) this.vbox(x - 0.82, y + h, z - 0.82, x + 0.82, y + h + 0.14, z + 0.82, yel, { jitter: 0 });
      this.solid(x - 1.5, y - 0.3, z - 1.5, x + 1.5, y + 0.6, z + 1.5, 0x9a9a95, { noBottom: true });   // zapata
      D.addBox(D.active, G.Phys.addBox(x - 0.85, y, z - 0.85, x + 0.85, y + Hc, z + 0.85));
      this.vbox(x - 1.2, y + Hc, z - 1.2, x + 1.2, y + Hc + 2.2, z + 1.2, 0xe8e2d0, {});                  // cabina
      this.vbox(x - 1.25, y + Hc + 0.9, z - 1.25, x + 1.25, y + Hc + 1.8, z - 1.18, 0x5fa8d3, { jitter: 0 });
      this.vbox(x - 10, y + Hc + 2.2, z - 0.6, x + len, y + Hc + 3.1, z + 0.6, yel, { jitter: 0 });      // pluma
      this.vbox(x - 9.5, y + Hc + 0.4, z - 1.0, x - 6.5, y + Hc + 2.2, z + 1.0, 0x6b737c, {});           // contrapeso
      this.vbox(x - 0.4, y + Hc + 3.1, z - 0.4, x + 0.4, y + Hc + 6.5, z + 0.4, yel, {});                // torreta
      const hx = x + len * 0.68;
      this.vbox(hx - 0.04, y + 9, z - 0.04, hx + 0.04, y + Hc + 2.2, z + 0.04, 0x222222, { jitter: 0 });
      this.vbox(hx - 0.35, y + 8.2, z - 0.35, hx + 0.35, y + 9, z + 0.35, 0xd62828, {});
      D.end();
      this.buildings.push({ x0: x - 1, z0: z - 0.6, x1: x + len, z1: z + 0.6, floors: 0, base: y, top: y + Hc + 6.5, color: yel });
    },

    silo(x, z, y) {
      D.begin({ name: 'Silo', mat: 'metal', hp: 500, yield: 12 });
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(2.3, 11, 2.3)), 0xc9cdd2, 0.03);
      for (let h = 2.4; h < 11; h += 2.8) this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + h, z).multiply(M4().makeScale(2.36, 0.18, 2.36)), 0x8a9097, 0);
      this.vgeo(this.tpl.gcone, M4().makeTranslation(x, y + 11, z).multiply(M4().makeScale(2.45, 1.6, 2.45)), 0x9aa0a6, 0.03);
      D.addBox(D.active, G.Phys.addBox(x - 2.0, y, z - 2.0, x + 2.0, y + 12.4, z + 2.0));
      D.end();
      this.mapTrees.push({ x, z, r: 2.3 });
    },

    chimney(x, z, y) {
      D.begin({ name: 'Chimenea', mat: 'stone', hp: 600, yield: 12 });
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(1.0, 20, 1.0)), 0xa4553f, 0.03);
      for (const h of [16, 18.4]) this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + h, z).multiply(M4().makeScale(1.04, 0.7, 1.04)), 0xf2eee6, 0);
      D.addBox(D.active, G.Phys.addBox(x - 0.85, y, z - 0.85, x + 0.85, y + 20, z + 0.85));
      D.end();
      this.mapTrees.push({ x, z, r: 1.2 });
    },

    /* =================================================================
       FUERTE REAL (castillo)
       ================================================================= */
    buildCastle(p) {
      const y = p.level, Nv = G.Nav, S = 22, T = 1.6, Hw = 6;
      const stone = 0x9c998f, dark = 0x7f7c74;
      const x0 = p.x - S, x1 = p.x + S, z0 = p.z - S, z1 = p.z + S;
      // la puerta mira hacia la ciudad
      const gate = Math.abs(p.x) > Math.abs(p.z) ? (p.x > 0 ? 'xmin' : 'xmax') : (p.z > 0 ? 'zmin' : 'zmax');
      this.vbox(x0 + T, y, z0 + T, x1 - T, y + 0.03, z1 - T, 0xb3a07a, { noBottom: true, jitter: 0.02 });

      // murallas: trozos de ~4 m, cada uno con sus almenas (se rompen juntos)
      const sides = {
        zmin: ['x', z0, z0 + T, z0, z0 + 0.45], zmax: ['x', z1 - T, z1, z1 - 0.45, z1],
        xmin: ['z', x0, x0 + T, x0, x0 + 0.45], xmax: ['z', x1 - T, x1, x1 - 0.45, x1],
      };
      for (const name of Object.keys(sides)) {
        const [axis, f0, f1, m0, m1] = sides[name];
        const a0 = (axis === 'x' ? x0 : z0) + 3, a1 = (axis === 'x' ? x1 : z1) - 3;   // las esquinas son torres
        const c = axis === 'x' ? p.x : p.z;
        const runs = name === gate ? [[a0, c - 2.2], [c + 2.2, a1]] : [[a0, a1]];
        for (const [s0, s1] of runs) {
          const n = Math.max(1, Math.round((s1 - s0) / 4));
          for (let i = 0; i < n; i++) {
            const q0 = s0 + ((s1 - s0) * i) / n, q1 = s0 + ((s1 - s0) * (i + 1)) / n;
            D.begin({ name: 'Muralla', mat: 'stone', hp: 420, yield: 9 });
            if (axis === 'x') this.solid(q0, y - 0.5, f0, q1, y + Hw, f1, stone, { noBottom: true });
            else this.solid(f0, y - 0.5, q0, f1, y + Hw, q1, stone, { noBottom: true });
            for (let t = q0 + 0.4; t + 1.0 <= q1 - 0.2; t += 2) {
              if (axis === 'x') this.solid(t, y + Hw, m0, t + 1.0, y + Hw + 1.0, m1, stone, { noBottom: true });
              else this.solid(m0, y + Hw, t, m1, y + Hw + 1.0, t + 1.0, stone, { noBottom: true });
            }
            D.end();
          }
        }
        if (axis === 'x') this.buildings.push({ x0, z0: f0, x1, z1: f1, floors: 0, base: y, top: y + Hw, color: stone });
        else this.buildings.push({ x0: f0, z0, x1: f1, z1, floors: 0, base: y, top: y + Hw, color: stone });
        if (name !== gate) continue;
        // arco de la puerta y escaleras para subir a la muralla (una a cada lado de la puerta, por dentro)
        D.begin({ name: 'Arco de la puerta', mat: 'stone', hp: 500, yield: 9 });
        if (axis === 'x') this.solid(c - 2.2, y + 3.6, f0, c + 2.2, y + Hw, f1, dark);
        else this.solid(f0, y + 3.6, c - 2.2, f1, y + Hw, c + 2.2, dark);
        D.end();
        const inward = name === 'zmin' || name === 'xmin' ? 1 : -1;
        const l0 = inward > 0 ? f1 : f0 - 1.6, l1 = l0 + 1.6;
        const SG = { name: 'Escalera de piedra', mat: 'stone', hp: 450, yield: 6 };
        this.stairRun(axis, c + 3.2, c + 15.2, l0, l1, y, y + Hw, true, dark, SG);
        this.stairRun(axis, c - 15.2, c - 3.2, l0, l1, y, y + Hw, false, dark, SG);
        // nodos: fuera de la puerta, dentro, y las dos escaleras
        const P = (a, f) => (axis === 'x' ? [a, f] : [f, a]);
        const fOut = inward > 0 ? f0 - 3 : f1 + 3, fIn = inward > 0 ? f1 + 3.5 : f0 - 3.5, lc = (l0 + l1) / 2;
        const [ox, oz] = P(c, fOut), [ix, iz] = P(c, fIn);
        const nOut = Nv.addNode(ox, y, oz, true), nIn = Nv.addNode(ix, y, iz, true);
        Nv.link(nOut, nIn);
        for (const sgn of [1, -1]) {
          const [bx, bz] = P(c + sgn * 2.4, fIn), [tx, tz] = P(c + sgn * 14.6, lc), [wx, wz] = P(c + sgn * 14.6, (f0 + f1) / 2);
          const nB = Nv.addNode(bx, y, bz, false), nT = Nv.addNode(tx, y + Hw, tz, false), nW = Nv.addNode(wx, y + Hw, wz, false);
          Nv.link(nIn, nB); Nv.link(nB, nT); Nv.link(nT, nW);
        }
      }

      // torres de las esquinas, con almenas y estandartes
      let tChest = false;
      for (const [cx, cz] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]]) {
        const th = Hw + 3.5;
        D.begin({ name: 'Torre', mat: 'stone', hp: 900, yield: 14 });
        this.solid(cx - 3, y - 0.5, cz - 3, cx + 3, y + th, cz + 3, dark, { noBottom: true });
        for (const [mx, mz] of [[-3, -3], [-0.5, -3], [2, -3], [-3, -0.5], [-3, 2], [2, -0.5], [2, 2], [-0.5, 2]]) {
          this.solid(cx + mx, y + th, cz + mz, cx + mx + 1.0, y + th + 1.0, cz + mz + 1.0, dark, { noBottom: true });
        }
        // estandarte rojo en las caras exteriores
        const sx = cx < p.x ? -1 : 1, sz = cz < p.z ? -1 : 1;
        this.vbox(cx + sx * 3, y + th - 4, cz - 0.6, cx + sx * 3.05, y + th - 0.6, cz + 0.6, 0xb3202a, { jitter: 0 });
        this.vbox(cx - 0.6, y + th - 4, cz + sz * 3, cx + 0.6, y + th - 0.6, cz + sz * 3.05, 0xb3202a, { jitter: 0 });
        this.vbox(cx + sx * 3.05, y + th - 2.6, cz - 0.25, cx + sx * 3.08, y + th - 1.8, cz + 0.25, 0xffd166, { jitter: 0 });
        D.end();
        this.buildings.push({ x0: cx - 3, z0: cz - 3, x1: cx + 3, z1: cz + 3, floors: 0, base: y, top: y + th + 1, color: dark });
        // arriba de una torre hay un cofre (sólo se llega construyendo); en otra, botín
        if (!tChest) { this.chestSpots.push({ x: cx, y: y + th, z: cz, rot: 0, noBot: true }); tChest = true; }
        else if (this.r() < 0.5) this.lootSpots.push({ x: cx, y: y + th, z: cz, roof: true });
      }

      // torre del homenaje (3 plantas) en el centro, con la puerta hacia la entrada
      {
        const r = [p.x - 7, p.z - 7, p.x + 7, p.z + 7];
        this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors: 3, pal: PAL_KEEP, stairSide: this.stairFor(gate), doorSide: gate,
          outsideY: y, kind: 'house', mat: 'stone', wallHp: 260, deco: false, interior: 'keep' });
        const ry = y + 0.25 + 3 * G.CONFIG.floorHeight;
        // mástil con bandera
        D.begin({ name: 'Bandera', mat: 'wood', hp: 60, yield: 3 });
        this.vbox(p.x - 0.08, ry, p.z - 0.08, p.x + 0.08, ry + 5, p.z + 0.08, 0x5a4330, { jitter: 0 });
        this.vbox(p.x + 0.08, ry + 3.6, p.z - 0.04, p.x + 2.4, ry + 4.9, p.z + 0.04, 0xb3202a, { jitter: 0 });
        D.end();
      }

      // patio: pozo, pacas, cajas, carro y botín
      const placed = [[p.x - 8, p.z - 8, p.x + 8, p.z + 8]];
      const spot = (m) => {
        for (let i = 0; i < 20; i++) {
          const x = this.rr(x0 + T + 2, x1 - T - 2), z = this.rr(z0 + T + 2, z1 - T - 2);
          if (Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) < 8 + m) continue;
          if (Math.abs(x - x0) < 5.5 && Math.abs(z - z0) < 5.5 || Math.abs(x - x1) < 5.5 && Math.abs(z - z0) < 5.5 ||
              Math.abs(x - x0) < 5.5 && Math.abs(z - z1) < 5.5 || Math.abs(x - x1) < 5.5 && Math.abs(z - z1) < 5.5) continue;
          // lejos de la entrada y de las escaleras de la muralla
          const g = gate === 'zmin' ? z - z0 : gate === 'zmax' ? z1 - z : gate === 'xmin' ? x - x0 : x1 - x;
          if (g < 6) continue;
          if (placed.some((b) => x > b[0] - m && x < b[2] + m && z > b[1] - m && z < b[3] + m)) continue;
          placed.push([x - m, z - m, x + m, z + m]);
          return [x, z];
        }
        return null;
      };
      let s = spot(2);
      if (s) {
        D.begin({ name: 'Pozo', mat: 'stone', hp: 300, yield: 8 });
        this.vgeo(this.tpl.cyl, M4().makeTranslation(s[0], y, s[1]).multiply(M4().makeScale(1.2, 0.9, 1.2)), 0x8f8b82, 0.04);
        this.vgeo(this.tpl.cyl, M4().makeTranslation(s[0], y + 0.9, s[1]).multiply(M4().makeScale(0.95, 0.02, 0.95)), 0x2a4a6a, 0);
        for (const ox of [-1, 1]) this.vbox(s[0] + ox - 0.08, y + 0.9, s[1] - 0.08, s[0] + ox + 0.08, y + 2.6, s[1] + 0.08, 0x5a4330, {});
        this.vbox(s[0] - 1.3, y + 2.6, s[1] - 0.7, s[0] + 1.3, y + 2.75, s[1] + 0.7, 0x7a3f28, {});
        D.addBox(D.active, G.Phys.addBox(s[0] - 1.1, y, s[1] - 1.1, s[0] + 1.1, y + 0.9, s[1] + 1.1));
        D.end();
      }
      for (let i = 0; i < 4; i++) {
        s = spot(1.2);
        if (!s) continue;
        if (i % 2) this.crate(s[0], y, s[1], this.rr(1.0, 1.4));
        else {
          D.begin({ name: 'Paca de paja', mat: 'wood', hp: 60, yield: 5 });
          this.vgeo(this.tpl.hay, M4().makeTranslation(s[0], y, s[1]), 0xe0c060, 0.05);
          D.addBox(D.active, G.Phys.addBox(s[0] - 0.7, y, s[1] - 0.75, s[0] + 0.7, y + 1.5, s[1] + 0.75));
          D.end();
        }
      }
      for (let i = 0; i < 5; i++) { s = spot(0.8); if (s) this.lootSpots.push({ x: s[0], y, z: s[1] }); }
      s = spot(1);
      if (s) this.chestSpots.push({ x: s[0], y, z: s[1], rot: this.rr(0, 6.28) });
      // nodos por el patio (alrededor de la torre del homenaje)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        Nv.addNode(p.x + Math.cos(a) * 13.5, y, p.z + Math.sin(a) * 13.5, true);
      }
      // una moto fuera, junto a la puerta
      const dirs = { zmin: [0, -1], zmax: [0, 1], xmin: [-1, 0], xmax: [1, 0] }[gate];
      this.motoSpots.push({ x: p.x + dirs[0] * (S + 6) + dirs[1] * 5, y, z: p.z + dirs[1] * (S + 6) + dirs[0] * 5, yaw: Math.atan2(-dirs[0], -dirs[1]) });
    },

    /* =================================================================
       FARO (Bahía Coral)
       ================================================================= */
    lighthouse(x, z, y) {
      D.begin({ name: 'Faro', mat: 'stone', hp: 800, yield: 14 });
      const segs = 5, segH = 3;
      for (let i = 0; i < segs; i++) {
        const rad = 2.3 - i * 0.12;
        this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y - 0.3 + i * segH, z).multiply(M4().makeScale(rad, segH + 0.02, rad)), i % 2 ? 0xffffff : 0xd62828, 0.02);
      }
      const top = y - 0.3 + segs * segH;
      // balconcillo con barandilla, linterna y cúpula roja
      this.solid(x - 2.6, top, z - 2.6, x + 2.6, top + 0.3, z + 2.6, 0x3a3d42, { bottomColor: 0x2a2d32 });
      for (const r of [[x - 2.6, z - 2.6, x + 2.6, z - 2.5], [x - 2.6, z + 2.5, x + 2.6, z + 2.6], [x - 2.6, z - 2.5, x - 2.5, z + 2.5], [x + 2.5, z - 2.5, x + 2.6, z + 2.5]]) {
        this.vbox(r[0], top + 0.3, r[1], r[2], top + 1.2, r[3], 0x3a3d42, { jitter: 0 });
      }
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, top + 0.3, z).multiply(M4().makeScale(1.2, 2.2, 1.2)), 0xfff2b0, 0);
      this.vgeo(this.tpl.gcone, M4().makeTranslation(x, top + 2.5, z).multiply(M4().makeScale(1.5, 1.4, 1.5)), 0xd62828, 0.02);
      D.addBox(D.active, G.Phys.addBox(x - 1.9, y - 0.3, z - 1.9, x + 1.9, top, z + 1.9));
      D.addBox(D.active, G.Phys.addBox(x - 1.1, top + 0.3, z - 1.1, x + 1.1, top + 2.5, z + 1.1));
      D.end();
      this.mapTrees.push({ x, z, r: 2.4 });
      this.chestSpots.push({ x: x + 1.85, y: top + 0.3, z: z + 1.85, rot: this.rr(0, 6.28), noBot: true });
      this.lootSpots.push({ x: x - 3.4, y, z: z });
    },
  });
})();

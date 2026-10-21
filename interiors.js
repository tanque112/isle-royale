/* =====================================================================
   interiors.js — Los interiores de los edificios: habitaciones con
   tabiques (baños, dormitorios, despachos, calabozos...) y muebles
   según el tipo de edificio (casa, oficina, tienda, cafetería, hotel,
   granero, saloon, capilla, castillo...). Cada planta es distinta.

   Los muebles se dibujan en coordenadas "de pared": u = a lo largo de
   la pared, v = alejándose de ella (v = 0 pegado a la pared). Así el
   mismo mueble sirve para las cuatro paredes.

   Nunca se pone nada encima de los caminos de los bots (puerta → centro
   de la planta → escaleras), para que puedan seguir moviéndose.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const W = G.World, D = G.Destruct;
  const H = G.CONFIG.floorHeight;

  /* ---------- Colores ---------- */
  const WOODS = [0x8b5a2b, 0xa0703f, 0x6b4423, 0xc49a6c, 0x5a3a22, 0xd8b98a, 0x7a4e2d];
  const FABRICS = [0x4cc9f0, 0xe63946, 0x2a9d8f, 0xf4a261, 0x6d597a, 0x90be6d, 0x457b9d, 0xffb4a2, 0x3d405b, 0xe9c46a, 0x8d99ae, 0xbc6c25];
  const BEDDING = [0xffffff, 0xa8dadc, 0xffd6a5, 0xcdb4db, 0xbde0fe, 0xf1faee, 0xffafcc, 0xcaffbf, 0xe76f51];
  const CABINETS = [0xf4f1ea, 0x2a9d8f, 0x6b4423, 0x8ecae6, 0x3d405b, 0xd9cbb0, 0xe9edc9];
  const COUNTERS = [0x3a3a3a, 0xe8e2d6, 0x8d6e63, 0xb0b8c0];
  const PARTITION = [0xf1ece2, 0xe8f1f2, 0xf6e7d8, 0xe9edc9, 0xdde5f0, 0xfde2e4];
  const TILES = [0xe8f4f8, 0xf4f1ea, 0xd8e2dc, 0xcfe1f2];
  const RUGS = [0xb5523b, 0x2f6fb5, 0x6d597a, 0xd4a017, 0x2a9d8f, 0x9b2226, 0x588157];
  const PRODUCTS = [0xe63946, 0xf4a261, 0x2a9d8f, 0x4cc9f0, 0xffd166, 0x8338ec, 0x06d6a0, 0xff006e, 0xfefae0];
  const WHITE = 0xf4f4f2, STEEL = 0xb8bec6, DARK = 0x2b2f36, BLACK = 0x1a1a1a, CHROME = 0xd6dbe0;
  const GREEN = [0x3f8a35, 0x52a83a, 0x2f7d3c, 0x6dbb4f];
  const JIT = { jitter: 0.02 };
  const HIDE = { jitter: 0, noTop: true, noBottom: true, noX0: true, noX1: true, noZ0: true, noZ1: true };   // sólo colisión, no se dibuja

  // formas redondas (sin índices, para no convertirlas cada vez)
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0).toNonIndexed();
  const BALL = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const CONE = new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0).toNonIndexed();

  /* ---------- Marcos de coordenadas ----------
     f = { ox, oz, ux, uz, vx, vz, y }: punto (u, v) → mundo (ox + u·U + v·V) */
  const ROT = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]];
  function rectOf(f, u0, v0, u1, v1) {
    const ax = f.ox + u0 * f.ux + v0 * f.vx, az = f.oz + u0 * f.uz + v0 * f.vz;
    const bx = f.ox + u1 * f.ux + v1 * f.vx, bz = f.oz + u1 * f.uz + v1 * f.vz;
    return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
  }
  // lápiz para dibujar dentro de un marco: v = sólo visual, s = con colisión, g = forma redonda
  function pen(f) {
    return {
      v(u0, v0, u1, v1, y0, y1, c, o) { const r = rectOf(f, u0, v0, u1, v1); W.vbox(r[0], f.y + y0, r[1], r[2], f.y + y1, r[3], c, o || JIT); },
      s(u0, v0, u1, v1, y0, y1, c, o) { const r = rectOf(f, u0, v0, u1, v1); W.solid(r[0], f.y + y0, r[1], r[2], f.y + y1, r[3], c, o || JIT); },
      g(geo, u, v, y, c, sx, sy, sz) {
        const x = f.ox + u * f.ux + v * f.vx, z = f.oz + u * f.uz + v * f.vz;
        W.vgeo(geo, new THREE.Matrix4().makeTranslation(x, f.y + y, z).multiply(new THREE.Matrix4().makeScale(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz)), c);
      },
    };
  }

  /* ---------- Muebles ----------
     w = ancho (a lo largo de la pared), d = fondo, clear = hueco libre delante,
     name/mat/hp = cómo se rompe. draw(p, P, w, d): p = lápiz, P = colores del edificio */
  const it = (name, mat, hp, w, d, draw, extra) => Object.assign({ name, mat, hp, w, d, draw, clear: 0.6 }, extra || {});
  const I = {
    bedDouble: it('Cama', 'wood', 120, 1.7, 2.15, (p, P, w, d) => {
      p.s(0, 0, w, 0.1, 0, 1.05, P.wood);
      p.s(0.04, 0.1, w - 0.04, d, 0, 0.4, P.wood);
      p.v(0.08, 0.12, w - 0.08, d - 0.05, 0.4, 0.58, WHITE);
      p.v(0.05, 0.75, w - 0.05, d - 0.02, 0.48, 0.63, P.bed);
      p.v(0.15, 0.16, w / 2 - 0.08, 0.55, 0.58, 0.7, WHITE);
      p.v(w / 2 + 0.08, 0.16, w - 0.15, 0.55, 0.58, 0.7, WHITE);
    }),
    bedSingle: it('Cama', 'wood', 100, 1.0, 2.05, (p, P, w, d) => {
      p.s(0, 0, w, 0.1, 0, 0.95, P.wood);
      p.s(0.04, 0.1, w - 0.04, d, 0, 0.38, P.wood);
      p.v(0.07, 0.12, w - 0.07, d - 0.05, 0.38, 0.55, WHITE);
      p.v(0.04, 0.7, w - 0.04, d - 0.02, 0.45, 0.6, P.bed2);
      p.v(0.15, 0.16, w - 0.15, 0.5, 0.55, 0.66, WHITE);
    }),
    bunk: it('Litera', 'wood', 140, 1.0, 2.05, (p, P, w, d) => {
      for (const [u, v] of [[0, 0], [w - 0.08, 0], [0, d - 0.08], [w - 0.08, d - 0.08]]) p.s(u, v, u + 0.08, v + 0.08, 0, 1.9, P.wood);
      for (const y of [0.3, 1.35]) {
        p.s(0.04, 0.04, w - 0.04, d - 0.04, y, y + 0.12, P.wood);
        p.v(0.08, 0.08, w - 0.08, d - 0.08, y + 0.12, y + 0.26, y > 1 ? P.bed : P.bed2);
        p.v(0.15, 0.12, w - 0.15, 0.45, y + 0.26, y + 0.36, WHITE);
      }
      for (let i = 0; i < 4; i++) p.v(w - 0.06, d * 0.7, w, d * 0.7 + 0.05, 0.4 + i * 0.32, 0.45 + i * 0.32, P.wood);
    }),
    canopyBed: it('Cama con dosel', 'wood', 180, 2.0, 2.3, (p, P, w, d) => {
      I.bedDouble.draw(pen0(p, 0.15, 0.05), P, 1.7, 2.15);
      for (const [u, v] of [[0, 0], [w - 0.1, 0], [0, d - 0.1], [w - 0.1, d - 0.1]]) p.s(u, v, u + 0.1, v + 0.1, 0, 2.3, P.wood);
      p.v(0, 0, w, d, 2.3, 2.42, 0x9b2226);
      p.v(0, d - 0.03, w, d, 1.7, 2.3, 0x9b2226);
    }),
    nightstand: it('Mesilla', 'wood', 60, 0.5, 0.45, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.55, P.wood);
      p.v(0.05, d, w - 0.05, d + 0.01, 0.3, 0.32, DARK);
      p.g(CYL, w / 2, d / 2, 0.55, STEEL, 0.07, 0.25);
      p.g(CONE, w / 2, d / 2, 0.75, 0xfff1c1, 0.16, 0.2);
    }, { clear: 0.2 }),
    wardrobe: it('Armario', 'wood', 130, 1.2, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 2.05, P.wood);
      p.v(w / 2 - 0.01, d, w / 2 + 0.01, d + 0.01, 0.1, 1.95, DARK);
      p.v(w / 2 - 0.1, d, w / 2 - 0.05, d + 0.04, 0.9, 1.15, CHROME);
      p.v(w / 2 + 0.05, d, w / 2 + 0.1, d + 0.04, 0.9, 1.15, CHROME);
    }),
    dresser: it('Cómoda', 'wood', 90, 1.1, 0.5, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.85, P.wood2);
      for (let i = 0; i < 3; i++) p.v(0.05, d, w - 0.05, d + 0.01, 0.12 + i * 0.25, 0.14 + i * 0.25, DARK);
      p.v(0.3, 0.02, w - 0.3, 0.05, 1.1, 1.75, CHROME);   // espejo
      p.v(0.25, 0.0, w - 0.25, 0.02, 1.05, 1.8, P.wood);
    }, { clear: 0.4 }),
    sofa: it('Sofá', 'wood', 110, 2.1, 0.9, (p, P, w, d) => {
      p.s(0, 0, w, 0.25, 0, 0.88, P.fabric);
      p.s(0, 0.2, w, d, 0, 0.42, P.fabric);
      p.v(0.18, 0.25, w - 0.18, d - 0.04, 0.42, 0.53, P.fabricL);
      p.s(0, 0.2, 0.18, d, 0, 0.64, P.fabric);
      p.s(w - 0.18, 0.2, w, d, 0, 0.64, P.fabric);
      p.v(0.3, 0.25, 0.7, 0.4, 0.5, 0.85, P.fabric2);
    }, { clear: 0.9 }),
    armchair: it('Sillón', 'wood', 80, 0.95, 0.9, (p, P, w, d) => {
      p.s(0, 0, w, 0.22, 0, 0.92, P.fabric2);
      p.s(0, 0.2, w, d, 0, 0.42, P.fabric2);
      p.s(0, 0.2, 0.16, d, 0, 0.62, P.fabric2);
      p.s(w - 0.16, 0.2, w, d, 0, 0.62, P.fabric2);
      p.v(0.16, 0.22, w - 0.16, d - 0.04, 0.42, 0.52, P.fabricL);
    }),
    tvStand: it('Mueble de la tele', 'wood', 90, 1.7, 0.45, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.5, P.wood2);
      p.v(0.1, d, w / 2 - 0.05, d + 0.01, 0.08, 0.42, DARK);
      p.v(w / 2 + 0.05, d, w - 0.1, d + 0.01, 0.08, 0.42, DARK);
      p.v(w / 2 - 0.15, 0.12, w / 2 + 0.15, 0.25, 0.5, 0.56, BLACK);
      p.v(0.18, 0.15, w - 0.18, 0.21, 0.56, 1.3, BLACK);
      p.v(0.23, 0.21, w - 0.23, 0.215, 0.61, 1.25, 0x1d3557);
    }),
    bookshelf: it('Estantería', 'wood', 100, 1.1, 0.35, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.06, P.wood);
      p.v(0, 0, 0.04, d, 0, 1.95, P.wood); p.v(w - 0.04, 0, w, d, 0, 1.95, P.wood);
      p.v(0, 0, w, 0.03, 0, 1.95, P.wood);
      for (let k = 0; k < 4; k++) {
        const y = 0.06 + k * 0.47;
        p.v(0.04, 0.03, w - 0.04, d, y + 0.43, y + 0.47, P.wood);
        let u = 0.06;
        while (u < w - 0.12) {
          const bw = 0.04 + Math.random() * 0.06, bh = 0.25 + Math.random() * 0.15;
          if (Math.random() < 0.85) p.v(u, 0.05, u + bw, d - 0.04, y, y + bh, PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]);
          u += bw + 0.01;
        }
      }
      p.s(0, 0, w, d, 0.06, 1.95, P.wood, HIDE);
    }, { clear: 0.5 }),
    plant: it('Planta', 'wood', 30, 0.55, 0.55, (p, P, w, d) => {
      const c = GREEN[Math.floor(Math.random() * GREEN.length)];
      p.g(CYL, w / 2, d / 2, 0, P.pot, 0.2, 0.38);
      p.s(w / 2 - 0.2, d / 2 - 0.2, w / 2 + 0.2, d / 2 + 0.2, 0, 0.38, P.pot, HIDE);
      if (Math.random() < 0.5) { p.g(BALL, w / 2, d / 2, 0.85, c, 0.32, 0.45); p.g(BALL, w / 2 + 0.08, d / 2, 1.2, c, 0.22, 0.3); }
      else { p.g(CYL, w / 2, d / 2, 0.38, 0x6b4423, 0.03, 0.9); p.g(BALL, w / 2, d / 2, 1.45, c, 0.38, 0.32); }
    }, { clear: 0.2 }),
    cactus: it('Cactus', 'wood', 30, 0.5, 0.5, (p, P, w, d) => {
      p.g(CYL, w / 2, d / 2, 0, 0xb5523b, 0.18, 0.3);
      p.g(CYL, w / 2, d / 2, 0.3, 0x4f8a3a, 0.1, 0.8);
      p.g(CYL, w / 2 + 0.12, d / 2, 0.6, 0x4f8a3a, 0.05, 0.35);
      p.s(w / 2 - 0.18, d / 2 - 0.18, w / 2 + 0.18, d / 2 + 0.18, 0, 0.3, 0xb5523b);
    }, { clear: 0.2 }),
    floorLamp: it('Lámpara', 'metal', 30, 0.4, 0.4, (p, P, w, d) => {
      p.g(CYL, w / 2, d / 2, 0, DARK, 0.15, 0.03);
      p.g(CYL, w / 2, d / 2, 0, STEEL, 0.02, 1.55);
      p.g(CONE, w / 2, d / 2, 1.45, 0xfff1c1, 0.2, 0.3);
    }, { clear: 0.2 }),
    // cocina corrida: armarios bajos, encimera, fregadero, fuegos, horno y armarios altos
    kitchen: (w) => it('Cocina', 'wood', 160, w, 0.62, (p, P, w2, d) => {
      p.s(0, 0, w2, d, 0, 0.88, P.cab);
      p.v(0, 0, w2, d + 0.03, 0.88, 0.92, P.counter);
      const n = Math.max(2, Math.round(w2 / 0.6));
      for (let i = 1; i < n; i++) p.v(i * w2 / n - 0.005, d, i * w2 / n + 0.005, d + 0.005, 0.08, 0.85, DARK);
      const su = w2 * 0.22, cu = w2 * 0.62;
      p.v(su - 0.3, 0.1, su + 0.3, d - 0.08, 0.92, 0.925, STEEL);
      p.v(su - 0.02, 0.04, su + 0.02, 0.12, 0.92, 1.18, CHROME);
      p.v(su - 0.02, 0.04, su + 0.02, 0.26, 1.14, 1.18, CHROME);
      p.v(cu - 0.32, 0.08, cu + 0.32, d - 0.05, 0.92, 0.935, BLACK);
      for (const [a, b] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, 0.45], [0.15, 0.45]]) p.g(CYL, cu + a, b, 0.935, 0x555555, 0.09, 0.01);
      p.v(cu - 0.3, d, cu + 0.3, d + 0.01, 0.15, 0.75, DARK);
      p.v(cu - 0.25, d, cu + 0.25, d + 0.03, 0.68, 0.71, CHROME);
      p.v(0, 0, w2, 0.36, 1.5, 2.2, P.cab);
      for (let i = 1; i < n; i++) p.v(i * w2 / n - 0.005, 0.36, i * w2 / n + 0.005, 0.365, 1.52, 2.18, DARK);
      p.v(cu - 0.35, 0, cu + 0.35, 0.45, 1.45, 1.55, STEEL);   // campana
      if (Math.random() < 0.6) p.g(CYL, w2 * 0.85, 0.3, 0.92, PRODUCTS[Math.floor(Math.random() * 9)], 0.07, 0.18);
    }, { clear: 1.0 }),
    fridge: it('Nevera', 'metal', 120, 0.8, 0.72, (p, P, w, d) => {
      const c = Math.random() < 0.5 ? WHITE : STEEL;
      p.s(0, 0, w, d, 0, 1.9, c);
      p.v(0.02, d, w - 0.02, d + 0.005, 1.18, 1.2, DARK);
      p.v(w - 0.12, d, w - 0.08, d + 0.05, 1.3, 1.7, CHROME);
      p.v(w - 0.12, d, w - 0.08, d + 0.05, 0.6, 1.0, CHROME);
    }),
    diningTable: it('Mesa', 'wood', 90, 1.8, 2.1, (p, P, w, d) => {
      p.s(0.15, 0.6, w - 0.15, 1.5, 0.72, 0.78, P.wood);
      for (const [u, v] of [[0.2, 0.65], [w - 0.26, 0.65], [0.2, 1.39], [w - 0.26, 1.39]]) p.v(u, v, u + 0.06, v + 0.06, 0, 0.72, P.wood);
      for (const v0 of [0.1, 1.6]) {
        for (const u0 of [0.35, w - 0.8]) {
          p.v(u0, v0, u0 + 0.45, v0 + 0.42, 0.42, 0.47, P.wood2);
          const back = v0 < 1 ? v0 : v0 + 0.37;
          p.v(u0, back, u0 + 0.45, back + 0.05, 0.47, 0.95, P.wood2);
          for (const [a, b] of [[0, 0], [0.4, 0], [0, 0.37], [0.4, 0.37]]) p.v(u0 + a, v0 + b, u0 + a + 0.05, v0 + b + 0.05, 0, 0.42, P.wood2);
        }
      }
      if (Math.random() < 0.6) { p.g(CYL, w / 2, 1.05, 0.78, WHITE, 0.15, 0.03); p.g(BALL, w / 2, 1.05, 0.86, 0xff8c1a, 0.06); }
    }, { clear: 0.3 }),
    coffeeTable: it('Mesa baja', 'wood', 60, 1.1, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, d, 0.36, 0.42, P.wood2);
      for (const [u, v] of [[0.04, 0.04], [w - 0.09, 0.04], [0.04, d - 0.09], [w - 0.09, d - 0.09]]) p.v(u, v, u + 0.05, v + 0.05, 0, 0.36, P.wood2);
      p.v(0.2, 0.15, 0.45, 0.4, 0.42, 0.46, PRODUCTS[Math.floor(Math.random() * 9)]);
    }, { clear: 0.3 }),
    rug: it('Alfombra', 'wood', 20, 2.4, 1.7, (p, P, w, d) => {
      p.v(0, 0, w, d, 0.0, 0.015, P.rug, { jitter: 0, noBottom: true });
      p.v(0.15, 0.15, w - 0.15, d - 0.15, 0.015, 0.02, P.rug2, { jitter: 0, noBottom: true });
    }, { clear: 0, flat: true }),
    desk: it('Escritorio', 'wood', 90, 1.4, 1.4, (p, P, w, d) => {
      p.s(0, 0, w, 0.7, 0.72, 0.76, P.wood2);
      p.v(0.03, 0.03, 0.08, 0.67, 0, 0.72, DARK); p.v(w - 0.08, 0.03, w - 0.03, 0.67, 0, 0.72, DARK);
      p.v(w * 0.6, 0.05, w - 0.1, 0.65, 0.1, 0.72, P.wood2);
      p.v(w / 2 - 0.3, 0.08, w / 2 + 0.3, 0.12, 0.85, 1.2, BLACK);
      p.v(w / 2 - 0.27, 0.12, w / 2 + 0.27, 0.125, 0.87, 1.18, 0x3a86ff);
      p.v(w / 2 - 0.04, 0.1, w / 2 + 0.04, 0.16, 0.76, 0.86, DARK);
      p.v(w / 2 - 0.22, 0.3, w / 2 + 0.22, 0.45, 0.76, 0.78, DARK);
      // silla de oficina
      p.g(CYL, w / 2, 1.05, 0, DARK, 0.25, 0.04);
      p.g(CYL, w / 2, 1.05, 0.04, STEEL, 0.03, 0.4);
      p.v(w / 2 - 0.24, 0.85, w / 2 + 0.24, 1.29, 0.44, 0.52, P.fabric);
      p.v(w / 2 - 0.22, 1.25, w / 2 + 0.22, 1.32, 0.52, 1.05, P.fabric);
    }, { clear: 0.3 }),
    filing: it('Archivador', 'metal', 80, 0.5, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 1.3, 0x8d99ae);
      for (let i = 0; i < 4; i++) { p.v(0.04, d, w - 0.04, d + 0.005, 0.05 + i * 0.32, 0.06 + i * 0.32, DARK); p.v(w / 2 - 0.08, d, w / 2 + 0.08, d + 0.03, 0.22 + i * 0.32, 0.25 + i * 0.32, CHROME); }
    }, { clear: 0.5 }),
    cooler: it('Fuente de agua', 'metal', 40, 0.4, 0.4, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.95, WHITE);
      p.g(CYL, w / 2, d / 2, 0.95, 0x8ecae6, 0.15, 0.45);
      p.v(w / 2 - 0.06, d, w / 2 + 0.06, d + 0.04, 0.7, 0.76, 0x3a86ff);
    }, { clear: 0.4 }),
    printer: it('Impresora', 'metal', 50, 0.7, 0.55, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.7, 0x8d99ae);
      p.v(0.05, 0.05, w - 0.05, d - 0.05, 0.7, 0.98, 0xdfe3e8);
      p.v(0.15, d - 0.15, w - 0.15, d + 0.08, 0.84, 0.86, WHITE);
    }, { clear: 0.5 }),
    whiteboard: it('Pizarra', 'wood', 30, 1.6, 0.06, (p, P, w, d) => {
      p.v(0, 0, w, d, 1.0, 2.0, STEEL);
      p.v(0.04, d, w - 0.04, d + 0.005, 1.04, 1.96, WHITE);
      for (let i = 0; i < 4; i++) p.v(0.15, d + 0.005, 0.15 + Math.random() * (w - 0.4), d + 0.008, 1.75 - i * 0.18, 1.77 - i * 0.18, [0x2f6fb5, 0xe63946, 0x2a9d8f][i % 3]);
    }, { clear: 0, wallOnly: true }),
    toilet: it('Váter', 'stone', 60, 0.5, 0.75, (p, P, w, d) => {
      p.s(0.05, 0, w - 0.05, 0.2, 0.35, 0.8, WHITE);
      p.g(CYL, w / 2, 0.45, 0, WHITE, 0.18, 0.4, 0.24);
      p.v(w / 2 - 0.2, 0.2, w / 2 + 0.2, 0.72, 0.4, 0.44, WHITE);
      p.s(w / 2 - 0.18, 0.2, w / 2 + 0.18, 0.7, 0, 0.42, WHITE, HIDE);
      p.v(w / 2 - 0.04, 0.12, w / 2 + 0.04, 0.16, 0.8, 0.83, CHROME);
    }, { clear: 0.4 }),
    basin: it('Lavabo', 'stone', 50, 0.65, 0.5, (p, P, w, d) => {
      p.s(w / 2 - 0.1, 0.02, w / 2 + 0.1, 0.25, 0, 0.75, WHITE);
      p.v(0.02, 0, w - 0.02, d, 0.75, 0.88, WHITE);
      p.v(0.1, 0.12, w - 0.1, d - 0.06, 0.86, 0.885, 0xcfe8f5);
      p.v(w / 2 - 0.02, 0.03, w / 2 + 0.02, 0.15, 0.88, 1.05, CHROME);
      p.v(0.05, 0, w - 0.05, 0.02, 1.15, 1.85, 0xcfe8f5);
      p.v(0.02, 0, w - 0.02, 0.015, 1.12, 1.88, CHROME);
    }, { clear: 0.5 }),
    bathtub: it('Bañera', 'stone', 90, 1.65, 0.78, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.56, WHITE);
      p.v(0.08, 0.08, w - 0.08, d - 0.08, 0.56, 0.565, 0x8ecae6, { jitter: 0, noBottom: true });
      p.v(0.12, 0.02, 0.18, 0.12, 0.56, 0.95, CHROME);
      p.v(0.1, 0.02, 0.35, 0.06, 0.92, 0.96, CHROME);
      p.v(0.05, d - 0.02, w * 0.45, d, 0.6, 2.05, P.fabric2);   // cortina
      p.v(0, d - 0.02, w, d, 2.05, 2.08, CHROME);
    }, { clear: 0.5 }),
    shower: it('Ducha', 'stone', 70, 0.95, 0.95, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.08, WHITE);
      p.v(0.1, 0.1, w - 0.1, d - 0.1, 0.08, 0.085, 0xb8c4cc, { jitter: 0, noBottom: true });
      p.v(w / 2 - 0.02, 0.02, w / 2 + 0.02, 0.06, 0.08, 2.0, CHROME);
      p.v(w / 2 - 0.02, 0.02, w / 2 + 0.02, 0.3, 1.96, 2.0, CHROME);
      p.g(CYL, w / 2, 0.3, 1.9, CHROME, 0.1, 0.06);
      p.v(0, d - 0.02, w * 0.5, d, 0.1, 2.05, P.fabric2);
      p.v(0, d - 0.02, w, d, 2.05, 2.08, CHROME);
    }, { clear: 0.5 }),
    washer: it('Lavadora', 'metal', 70, 0.6, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.85, WHITE);
      p.v(0.12, d, w - 0.12, d + 0.02, 0.25, 0.6, 0x4a5a6a);
      p.v(0.05, d, 0.25, d + 0.01, 0.72, 0.8, DARK);
    }, { clear: 0.5 }),
    towels: it('Toallero', 'wood', 20, 0.7, 0.12, (p, P, w, d) => {
      p.v(0, 0, w, d, 1.3, 1.33, CHROME);
      p.v(0.08, 0.02, w / 2 - 0.02, d, 0.75, 1.32, P.fabric);
      p.v(w / 2 + 0.02, 0.02, w - 0.08, d, 0.85, 1.32, P.bed);
    }, { clear: 0, wallOnly: true }),
    counter: it('Mostrador', 'wood', 140, 2.2, 0.7, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 1.0, P.wood);
      p.v(-0.03, -0.03, w + 0.03, d + 0.03, 1.0, 1.05, P.counter);
      p.v(w * 0.7, 0.15, w * 0.7 + 0.4, 0.5, 1.05, 1.25, DARK);
      p.v(w * 0.7 + 0.05, 0.3, w * 0.7 + 0.35, 0.45, 1.25, 1.45, BLACK);
    }, { clear: 1.0 }),
    gondola: it('Estantería', 'metal', 120, 2.4, 0.8, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.12, STEEL);
      p.s(0, d / 2 - 0.03, w, d / 2 + 0.03, 0.12, 1.6, STEEL);
      for (let k = 0; k < 3; k++) {
        const y = 0.12 + k * 0.48;
        p.v(0, 0, w, d, y + 0.02, y + 0.04, STEEL);
        for (const side of [0, 1]) {
          let u = 0.05;
          while (u < w - 0.2) {
            const bw = 0.15 + Math.random() * 0.15, bh = 0.15 + Math.random() * 0.22;
            const v0 = side ? d / 2 + 0.06 : 0.04, v1 = side ? d - 0.04 : d / 2 - 0.06;
            p.v(u, v0, u + bw, v1, y + 0.04, y + 0.04 + bh, PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]);
            u += bw + 0.03;
          }
        }
      }
    }, { clear: 1.0 }),
    fridgeDisplay: it('Nevera de bebidas', 'metal', 120, 1.4, 0.7, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 2.0, STEEL);
      p.v(0.05, d, w - 0.05, d + 0.005, 0.1, 1.85, 0xbfe3f5);
      for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) p.v(0.12 + i * 0.2, d - 0.15, 0.2 + i * 0.2, d - 0.05, 0.2 + k * 0.42, 0.45 + k * 0.42, PRODUCTS[(i + k) % PRODUCTS.length]);
      p.v(0, d - 0.02, w, d + 0.02, 1.85, 2.0, 0xe63946);
    }),
    storageRack: it('Estante', 'metal', 100, 1.6, 0.5, (p, P, w, d) => {
      for (const [u, v] of [[0, 0], [w - 0.05, 0], [0, d - 0.05], [w - 0.05, d - 0.05]]) p.v(u, v, u + 0.05, v + 0.05, 0, 2.0, DARK);
      for (let k = 0; k < 4; k++) {
        p.v(0, 0, w, d, 0.1 + k * 0.6, 0.13 + k * 0.6, 0x8d99ae);
        for (let i = 0; i < 3; i++) if (Math.random() < 0.75) p.v(0.08 + i * 0.5, 0.06, 0.48 + i * 0.5, d - 0.06, 0.13 + k * 0.6, 0.45 + k * 0.6, Math.random() < 0.5 ? 0xc49a6c : 0xa0703f);
      }
      p.s(0, 0, w, d, 0, 2.0, DARK, HIDE);
    }, { clear: 0.6 }),
    crate: it('Caja', 'wood', 80, 0.85, 0.85, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.85, 0xa0743f);
      p.v(-0.01, -0.01, w + 0.01, 0.06, 0.05, 0.8, 0x7a5232);
      if (W.r() < 0.4) p.s(0.1, 0.1, w - 0.1, d - 0.1, 0.85, 1.5, 0xb88a52);   // (con colisión: mismo azar en todos los jugadores)
    }, { clear: 0.3 }),
    barrel: it('Barril', 'wood', 70, 0.75, 0.75, (p, P, w, d) => {
      p.g(CYL, w / 2, d / 2, 0, 0x8b5a2b, 0.34, 0.95);
      p.g(CYL, w / 2, d / 2, 0.15, 0x3a3a3a, 0.35, 0.05);
      p.g(CYL, w / 2, d / 2, 0.75, 0x3a3a3a, 0.35, 0.05);
      p.s(w / 2 - 0.3, d / 2 - 0.3, w / 2 + 0.3, d / 2 + 0.3, 0, 0.95, 0x8b5a2b, HIDE);
    }, { clear: 0.3 }),
    sacks: it('Sacos', 'wood', 40, 1.0, 0.6, (p, P, w, d) => {
      for (let i = 0; i < 3; i++) p.g(BALL, 0.2 + i * 0.3, d / 2, 0.22, 0xd9c49a, 0.18, 0.24, 0.25);
      p.s(0, 0, w, d, 0, 0.4, 0xd9c49a, HIDE);
    }, { clear: 0.2 }),
    hay: it('Paca de paja', 'wood', 60, 1.2, 0.8, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.55, 0xe0c060);
      p.v(0.3, -0.01, 0.34, d + 0.01, 0, 0.56, 0xa08030); p.v(w - 0.34, -0.01, w - 0.3, d + 0.01, 0, 0.56, 0xa08030);
      if (W.r() < 0.5) p.s(0.1, 0.05, w - 0.1, d - 0.05, 0.55, 1.1, 0xd8b850);
    }, { clear: 0.3 }),
    workbench: it('Banco de trabajo', 'wood', 110, 1.8, 0.7, (p, P, w, d) => {
      p.s(0, 0, w, d, 0.85, 0.92, 0x8b5a2b);
      for (const u of [0.05, w - 0.12]) for (const v of [0.05, d - 0.12]) p.v(u, v, u + 0.07, v + 0.07, 0, 0.85, 0x6b4423);
      p.v(0.05, 0.05, w - 0.05, d - 0.05, 0.25, 0.3, 0x6b4423);
      p.v(0, 0, w, 0.03, 1.1, 1.9, 0xc49a6c);   // panel de herramientas
      p.v(0.2, 0.03, 0.25, 0.06, 1.3, 1.7, DARK); p.v(0.12, 0.03, 0.34, 0.06, 1.62, 1.72, STEEL);
      p.v(0.6, 0.03, 0.64, 0.06, 1.25, 1.75, 0xe63946); p.v(0.9, 0.03, 1.2, 0.06, 1.5, 1.56, STEEL);
      p.v(1.4, 0.03, 1.44, 0.06, 1.3, 1.8, 0x6b4423);
      p.v(0.3, 0.2, 0.7, 0.4, 0.92, 1.0, 0xd62828);
    }, { clear: 0.8 }),
    fireplace: it('Chimenea', 'stone', 300, 1.8, 0.7, (p, P, w, d) => {
      p.s(0, 0, 0.35, d, 0, 1.2, 0x8a8178); p.s(w - 0.35, 0, w, d, 0, 1.2, 0x8a8178);
      p.s(0, 0, w, d, 0.95, 1.25, 0x8a8178);
      p.v(0, 0, w, 0.1, 0, 0.95, 0x3a3330);
      p.v(-0.1, -0.02, w + 0.1, d + 0.1, 1.25, 1.33, 0x6b4423);
      p.v(0.4, 0.25, w - 0.4, d - 0.1, 0.02, 0.12, 0x5a3a22);
      p.g(CONE, w / 2, d / 2 - 0.05, 0.1, 0xff8c1a, 0.25, 0.45);
      p.g(CONE, w / 2, d / 2 - 0.05, 0.1, 0xffd166, 0.13, 0.3);
      p.v(0.3, 0, w - 0.3, d - 0.15, 1.33, P.ceil, 0x8a8178);
    }, { clear: 1.0 }),
    firewood: it('Leña', 'wood', 40, 1.0, 0.45, (p, P, w, d) => {
      for (let k = 0; k < 3; k++) for (let i = 0; i < 4 - (k % 2); i++) p.v(0.05 + i * 0.23 + (k % 2) * 0.11, 0.05, 0.25 + i * 0.23 + (k % 2) * 0.11, d - 0.05, k * 0.18, k * 0.18 + 0.17, k % 2 ? 0x8b5a2b : 0x6b4423);
      p.s(0, 0, w, d, 0, 0.55, 0x6b4423, HIDE);
    }, { clear: 0.2 }),
    antlers: it('Trofeo', 'wood', 20, 0.8, 0.15, (p, P, w, d) => {
      p.v(w / 2 - 0.15, 0, w / 2 + 0.15, 0.04, 1.9, 2.2, 0x6b4423);
      for (const s of [-1, 1]) { p.v(w / 2 + s * 0.05, 0.04, w / 2 + s * 0.35, 0.1, 2.1, 2.14, 0xe8dcc0); p.v(w / 2 + s * 0.3, 0.04, w / 2 + s * 0.34, 0.1, 2.1, 2.4, 0xe8dcc0); }
    }, { clear: 0, wallOnly: true }),
    longTable: it('Mesa larga', 'wood', 130, 3.2, 2.0, (p, P, w, d) => {
      p.s(0.1, 0.55, w - 0.1, 1.45, 0.74, 0.8, P.wood);
      for (const u of [0.2, w - 0.3]) p.v(u, 0.65, u + 0.1, 1.35, 0, 0.74, P.wood);
      p.s(0.2, 0.1, w - 0.2, 0.42, 0.42, 0.48, P.wood2); p.s(0.2, 1.58, w - 0.2, 1.9, 0.42, 0.48, P.wood2);
      for (const v of [0.2, 1.68]) for (const u of [0.3, w - 0.4]) p.v(u, v, u + 0.1, v + 0.12, 0, 0.42, P.wood2);
      for (let i = 0; i < 3; i++) p.g(CYL, 0.8 + i * 0.8, 1.0, 0.8, [0xd4a017, STEEL, 0x8b5a2b][i], 0.12, 0.05);
    }, { clear: 0.3 }),
    barCounter: it('Barra', 'wood', 200, 3.4, 2.0, (p, P, w, d) => {
      p.s(0, 0, w, 0.35, 0, 2.1, P.wood);
      for (const y of [0.9, 1.35, 1.8]) {
        p.v(0, 0.35, w, 0.4, y, y + 0.03, P.wood2);
        for (let u = 0.1; u < w - 0.1; u += 0.16) p.g(CYL, u, 0.2, y + 0.03, PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)], 0.04, 0.25);
      }
      p.s(0, 1.0, w, 1.55, 0, 1.08, P.wood);
      p.v(-0.05, 0.95, w + 0.05, 1.6, 1.08, 1.14, P.counter);
      for (let u = 0.4; u < w - 0.2; u += 0.75) { p.g(CYL, u, 1.8, 0, DARK, 0.04, 0.72); p.g(CYL, u, 1.8, 0.72, P.fabric, 0.17, 0.06); }
      p.g(CYL, w * 0.3, 1.25, 1.14, 0xd4a017, 0.04, 0.2);
      p.g(CYL, w * 0.6, 1.3, 1.14, 0x3a86ff, 0.035, 0.18);
    }, { clear: 0.6 }),
    cafeCounter: it('Barra', 'wood', 180, 3.0, 1.6, (p, P, w, d) => {
      p.s(0, 0, w, 0.5, 0, 0.9, P.cab);
      p.v(0, 0, w, 0.5, 0.9, 0.94, P.counter);
      p.v(0.3, 0.05, 0.9, 0.45, 0.94, 1.45, DARK);   // cafetera
      p.v(0.35, 0.45, 0.85, 0.46, 1.05, 1.35, STEEL);
      p.v(0, 0, w, 0.03, 1.6, 2.3, 0x2b2f36);         // pizarra del menú
      for (let i = 0; i < 4; i++) p.v(0.2, 0.03, 0.2 + Math.random() * (w - 0.6), 0.035, 2.15 - i * 0.14, 2.18 - i * 0.14, WHITE);
      p.s(0, 1.0, w, 1.6, 0, 1.05, P.wood);
      p.v(1.6, 1.05, 2.6, 1.55, 1.05, 1.35, 0xcfe8f5);  // vitrina de dulces
      for (let i = 0; i < 4; i++) p.g(BALL, 1.75 + i * 0.25, 1.3, 1.12, [0xd4a017, 0x8b5a2b, 0xff8fab, 0xffd166][i], 0.07, 0.05);
    }, { clear: 0.8 }),
    roundTable: it('Mesa', 'wood', 70, 1.8, 1.8, (p, P, w, d) => {
      p.g(CYL, w / 2, d / 2, 0, DARK, 0.25, 0.04);
      p.g(CYL, w / 2, d / 2, 0, DARK, 0.04, 0.74);
      p.g(CYL, w / 2, d / 2, 0.72, P.wood, 0.45, 0.04);
      p.s(w / 2 - 0.35, d / 2 - 0.35, w / 2 + 0.35, d / 2 + 0.35, 0.72, 0.76, P.wood, HIDE);
      for (const [u, v] of [[w / 2, 0.15], [w / 2, d - 0.15], [0.15, d / 2], [w - 0.15, d / 2]]) {
        if (Math.random() < 0.25) continue;
        p.g(CYL, u, v, 0, DARK, 0.03, 0.45);
        p.g(CYL, u, v, 0.45, P.fabric, 0.18, 0.05);
      }
      if (Math.random() < 0.5) p.g(CYL, w / 2 + 0.1, d / 2, 0.76, WHITE, 0.05, 0.09);
    }, { clear: 0.2 }),
    piano: it('Piano', 'wood', 150, 1.5, 0.75, (p, P, w, d) => {
      p.s(0, 0, w, 0.55, 0, 1.3, 0x1a1210);
      p.v(0.05, 0.55, w - 0.05, 0.72, 0.72, 0.78, 0x1a1210);
      p.v(0.08, 0.55, w - 0.08, 0.72, 0.78, 0.8, WHITE);
      for (let i = 0; i < 18; i++) if (i % 7 !== 2 && i % 7 !== 6) p.v(0.12 + i * 0.072, 0.55, 0.15 + i * 0.072, 0.65, 0.8, 0.83, BLACK);
      p.g(CYL, 0.3, 0.3, 1.3, 0xd4a017, 0.04, 0.15);
    }, { clear: 0.8 }),
    reception: it('Recepción', 'wood', 160, 2.6, 1.5, (p, P, w, d) => {
      p.v(0, 0, w, 0.04, 0.3, 2.4, P.wood2);
      p.v(w / 2 - 0.5, 0.04, w / 2 + 0.5, 0.06, 1.6, 2.1, P.fabric);
      p.s(0, 0.8, w, 1.4, 0, 1.1, P.wood);
      p.v(-0.03, 0.78, w + 0.03, 1.45, 1.1, 1.15, P.counter);
      p.v(w * 0.3, 0.9, w * 0.3 + 0.4, 0.95, 1.15, 1.45, BLACK);
      p.g(CYL, w * 0.75, 1.1, 1.15, 0xd4a017, 0.05, 0.04);
      p.v(w / 2 - 0.25, 0.3, w / 2 + 0.25, 0.7, 0.45, 0.52, DARK);
    }, { clear: 1.0 }),
    mailboxes: it('Buzones', 'metal', 60, 1.2, 0.25, (p, P, w, d) => {
      p.v(0, 0, w, d, 0.8, 1.7, 0xb08d57);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) p.v(0.05 + c * 0.29, d, 0.29 + c * 0.29, d + 0.01, 0.85 + r * 0.28, 1.08 + r * 0.28, 0x8a6a3a);
    }, { clear: 0, wallOnly: true }),
    pew: it('Banco', 'wood', 80, 2.6, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, 0.08, 0, 0.95, P.wood);
      p.s(0, 0.08, w, d, 0.42, 0.48, P.wood);
      p.v(0, 0.08, 0.06, d, 0, 0.42, P.wood); p.v(w - 0.06, 0.08, w, d, 0, 0.42, P.wood);
    }, { clear: 0.5 }),
    altar: it('Altar', 'stone', 200, 1.8, 0.9, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 1.0, WHITE);
      p.v(-0.02, -0.02, w + 0.02, d + 0.02, 1.0, 1.04, WHITE);
      p.v(w / 2 - 0.3, d, w / 2 + 0.3, d + 0.02, 0.2, 1.02, 0x9b2226);
      for (const u of [0.25, w - 0.25]) { p.g(CYL, u, d / 2, 1.04, 0xd4a017, 0.06, 0.25); p.g(CYL, u, d / 2, 1.29, WHITE, 0.03, 0.2); p.g(CONE, u, d / 2, 1.49, 0xffb703, 0.025, 0.06); }
      p.v(w / 2 - 0.3, 0, w / 2 + 0.3, 0.03, 1.4, 2.6, 0x2f6fb5);
    }, { clear: 1.5 }),
    weaponRack: it('Armero', 'wood', 90, 1.4, 0.35, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.3, P.wood);
      p.v(0, 0, w, 0.05, 0.3, 1.7, P.wood);
      p.v(0, 0.05, w, 0.12, 1.3, 1.36, P.wood);
      for (let i = 0; i < 5; i++) {
        const u = 0.15 + i * 0.27, sw = i % 2 === 0;
        p.v(u, 0.12, u + 0.04, 0.17, 0.3, sw ? 1.45 : 1.9, sw ? STEEL : 0x6b4423);
        if (sw) p.v(u - 0.08, 0.12, u + 0.12, 0.17, 0.5, 0.54, 0xd4a017);
        else p.v(u - 0.04, 0.12, u + 0.1, 0.17, 1.75, 1.95, STEEL);
      }
    }, { clear: 0.5 }),
    banner: it('Estandarte', 'wood', 20, 0.9, 0.05, (p, P, w, d) => {
      p.v(-0.05, 0, w + 0.05, d + 0.02, 3.0, 3.06, 0xd4a017);
      p.v(0, 0, w, d, 1.3, 3.0, P.banner);
      p.v(w / 2 - 0.15, d, w / 2 + 0.15, d + 0.01, 2.1, 2.5, 0xd4a017);
    }, { clear: 0, wallOnly: true }),
    throne: it('Trono', 'wood', 150, 1.1, 1.0, (p, P, w, d) => {
      p.s(0, 0, w, 0.2, 0, 2.0, 0xd4a017);
      p.s(0, 0.2, w, d, 0, 0.5, 0xd4a017);
      p.v(0.12, 0.2, w - 0.12, d - 0.05, 0.5, 0.58, 0x9b2226);
      p.v(0.12, 0.2, w - 0.12, 0.25, 0.58, 1.8, 0x9b2226);
      p.s(0, 0.2, 0.15, d, 0.5, 0.85, 0xd4a017); p.s(w - 0.15, 0.2, w, d, 0.5, 0.85, 0xd4a017);
      for (const u of [0.05, w / 2 - 0.05, w - 0.15]) p.v(u, 0.05, u + 0.1, 0.15, 2.0, 2.2, 0xd4a017);
    }, { clear: 1.0 }),
    treasure: it('Baúl', 'wood', 80, 1.0, 0.6, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.55, 0x6b4423);
      p.v(-0.01, -0.01, w + 0.01, d + 0.01, 0.4, 0.45, 0xd4a017);
      p.v(w / 2 - 0.06, d, w / 2 + 0.06, d + 0.02, 0.3, 0.45, 0xd4a017);
    }, { clear: 0.4 }),
    luggage: it('Maleta', 'wood', 30, 0.5, 0.3, (p, P, w, d) => {
      p.s(0, 0, w, d, 0, 0.7, P.fabric2);
      p.v(w / 2 - 0.1, d / 2 - 0.02, w / 2 + 0.1, d / 2 + 0.02, 0.7, 0.8, DARK);
    }, { clear: 0.2 }),
    wanted: it('Carteles', 'wood', 10, 1.0, 0.03, (p, P, w, d) => {
      for (let i = 0; i < 3; i++) { p.v(i * 0.35, 0, i * 0.35 + 0.3, d, 1.4 + (i % 2) * 0.1, 1.8 + (i % 2) * 0.1, 0xe8d7a8); p.v(i * 0.35 + 0.08, d, i * 0.35 + 0.22, d + 0.005, 1.55 + (i % 2) * 0.1, 1.7 + (i % 2) * 0.1, 0x5a3a22); }
    }, { clear: 0, wallOnly: true }),
  };
  // lápiz desplazado (para dibujar un mueble dentro de otro)
  function pen0(p, du, dv) {
    return {
      v: (u0, v0, u1, v1, y0, y1, c, o) => p.v(u0 + du, v0 + dv, u1 + du, v1 + dv, y0, y1, c, o),
      s: (u0, v0, u1, v1, y0, y1, c, o) => p.s(u0 + du, v0 + dv, u1 + du, v1 + dv, y0, y1, c, o),
      g: (geo, u, v, y, c, sx, sy, sz) => p.g(geo, u + du, v + dv, y, c, sx, sy, sz),
    };
  }
  /* ---------- Geometría 2D: ¿choca un rectángulo con un segmento? ---------- */
  function segRect(ax, az, bx, bz, r, pad) {
    const x0 = r[0] - pad, z0 = r[1] - pad, x1 = r[2] + pad, z1 = r[3] + pad;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  const overlap = (a, b, m) => a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m;
  const inside = (r, A) => r[0] >= A.x0 - 1e-6 && r[2] <= A.x1 + 1e-6 && r[1] >= A.z0 - 1e-6 && r[3] <= A.z1 + 1e-6;

  Object.assign(W, {
    /* ¿Está libre este rectángulo dentro de un área? (sin chocar con muebles, caminos de bots ni puertas) */
    _ifree(ctx, A, r) {
      if (!inside(r, A)) return false;
      for (const o of A.occ) if (overlap(r, o, 0.02)) return false;
      for (const s of ctx.segs) if (segRect(s[0], s[1], s[2], s[3], r, 0.75)) return false;
      return true;
    },

    // pone un mueble en un marco ya calculado (si cabe)
    _iput(ctx, A, item, f, force) {
      const w = item.w, d = item.d;
      const foot = rectOf(f, 0, 0, w, d);
      const withClear = rectOf(f, 0, 0, w, d + (item.clear || 0));
      if (!item.flat) {
        if (!force && !this._ifree(ctx, A, foot)) return false;
        // el hueco de delante tiene que quedar dentro del área (si no, el mueble queda "tapiado")
        if (!force && item.clear && !inside(withClear, A)) return false;
      } else if (!inside(foot, A)) return false;
      D.begin({ name: item.name, mat: item.mat, hp: item.hp, yield: Math.max(2, Math.round(item.hp / 25)) });
      item.draw(pen(f), ctx.P, w, d);
      D.end();
      if (!item.flat) A.occ.push(withClear);
      return true;
    },

    // pegado a una pared del área (sides: qué paredes valen)
    _iwall(ctx, A, item, sides, tries) {
      sides = sides || A.sides;
      for (let t = 0; t < (tries || 24); t++) {
        const s = this.pick(sides);
        const along = s === 'zmin' || s === 'zmax' ? A.x1 - A.x0 : A.z1 - A.z0;
        if (along < item.w + 0.1) continue;
        const p = this.rr(0.05, along - item.w - 0.05);
        let f;
        if (s === 'zmin') f = { ox: A.x0 + p, oz: A.z0, ux: 1, uz: 0, vx: 0, vz: 1 };
        else if (s === 'zmax') f = { ox: A.x0 + p + item.w, oz: A.z1, ux: -1, uz: 0, vx: 0, vz: -1 };
        else if (s === 'xmin') f = { ox: A.x0, oz: A.z0 + p + item.w, ux: 0, uz: -1, vx: 1, vz: 0 };
        else f = { ox: A.x1, oz: A.z0 + p, ux: 0, uz: 1, vx: -1, vz: 0 };
        f.y = ctx.y;
        if (this._iput(ctx, A, item, f)) return f;
      }
      return null;
    },

    // suelto en el área, con un giro de 0/90/180/270 grados (rot fija si se da)
    _ifree2(ctx, A, item, rot, tries, margin) {
      const m = margin === undefined ? 0.5 : margin;
      for (let t = 0; t < (tries || 24); t++) {
        const r = rot === undefined ? this.ri(0, 3) : rot;
        const [ux, uz, vx, vz] = ROT[r];
        const ex = (Math.abs(ux) * item.w + Math.abs(vx) * item.d) / 2, ez = (Math.abs(uz) * item.w + Math.abs(vz) * item.d) / 2;
        if (A.x1 - A.x0 < 2 * (ex + m) || A.z1 - A.z0 < 2 * (ez + m)) return null;
        const cx = this.rr(A.x0 + ex + m, A.x1 - ex - m), cz = this.rr(A.z0 + ez + m, A.z1 - ez - m);
        const f = { ox: cx - (item.w / 2) * ux - (item.d / 2) * vx, oz: cz - (item.w / 2) * uz - (item.d / 2) * vz, ux, uz, vx, vz, y: ctx.y };
        if (this._iput(ctx, A, item, f)) return f;
      }
      return null;
    },

    /* ---------- Rellenar un área según lo que sea ---------- */
    _ifill(ctx, A, kind) {
      const wall = (k, s) => this._iwall(ctx, A, typeof k === 'string' ? I[k] : k, s);
      const free = (k, rot, m) => this._ifree2(ctx, A, typeof k === 'string' ? I[k] : k, rot, 24, m);
      const maybe = (p, fn) => { if (this.r() < p) fn(); };
      const Aw = A.x1 - A.x0, Ad = A.z1 - A.z0, big = Aw * Ad;
      const kitchenRun = () => wall(I.kitchen(Math.min(3.6, Math.max(1.8, Math.max(Aw, Ad) * 0.45))));
      switch (kind) {
        case 'living':
          maybe(0.8, () => free('rug', undefined, 0.8));
          wall('sofa'); wall('tvStand');
          maybe(0.7, () => free('coffeeTable', undefined, 1.0));
          maybe(0.7, () => wall('bookshelf')); maybe(0.6, () => wall('armchair'));
          wall('plant'); maybe(0.5, () => wall('floorLamp'));
          break;
        case 'kitchenLiving':
          kitchenRun(); wall('fridge');
          maybe(0.85, () => free('diningTable'));
          wall('sofa'); maybe(0.7, () => wall('tvStand'));
          maybe(0.6, () => free('rug', undefined, 0.8));
          wall('plant'); maybe(0.5, () => wall('bookshelf'));
          if (big > 70) { wall('armchair'); wall('plant'); }
          break;
        case 'kitchen':
          kitchenRun(); wall('fridge'); maybe(0.8, () => free('diningTable')); maybe(0.5, () => wall('washer'));
          break;
        case 'bedroom': {
          const f = wall(this.r() < 0.6 ? 'bedDouble' : 'bedSingle');
          wall('nightstand'); maybe(0.6, () => wall('nightstand'));
          wall('wardrobe'); maybe(0.6, () => wall('dresser'));
          maybe(0.5, () => free('rug', undefined, 0.6));
          maybe(0.5, () => wall('plant')); maybe(0.4, () => wall('desk'));
          if (!f) wall('bedSingle');
          break;
        }
        case 'kids':
          wall('bunk'); wall('bedSingle'); wall('wardrobe'); maybe(0.6, () => wall('desk')); maybe(0.6, () => free('rug', undefined, 0.6));
          break;
        case 'bath':
          ctx.tile(A);
          wall('toilet'); wall('basin'); wall(this.r() < 0.55 ? 'bathtub' : 'shower');
          maybe(0.6, () => wall('towels')); maybe(0.4, () => wall('washer'));
          break;
        case 'office': {
          const n = Math.max(2, Math.min(6, Math.floor(big / 14)));
          for (let i = 0; i < n; i++) free('desk');
          wall('filing'); maybe(0.7, () => wall('filing'));
          maybe(0.7, () => wall('cooler')); maybe(0.6, () => wall('printer'));
          wall('plant'); maybe(0.6, () => wall('plant')); maybe(0.5, () => wall('bookshelf'));
          maybe(0.5, () => wall('whiteboard'));
          break;
        }
        case 'meeting':
          free('longTable'); wall('whiteboard'); maybe(0.7, () => wall('plant')); maybe(0.5, () => wall('cooler'));
          break;
        case 'boss':
          free('desk'); wall('bookshelf'); maybe(0.7, () => wall('armchair')); wall('plant'); maybe(0.5, () => free('rug', undefined, 0.5));
          break;
        case 'shop': {
          wall('counter');
          const n = Math.max(1, Math.min(4, Math.floor(big / 22)));
          for (let i = 0; i < n; i++) free('gondola', this.r() < 0.5 ? 0 : 1, 1.0);
          wall('fridgeDisplay'); maybe(0.6, () => wall('fridgeDisplay'));
          maybe(0.6, () => wall('storageRack')); wall('plant');
          break;
        }
        case 'storage':
          wall('storageRack'); maybe(0.7, () => wall('storageRack'));
          for (let i = 0; i < 3; i++) maybe(0.75, () => wall('crate'));
          maybe(0.6, () => wall('barrel'));
          break;
        case 'cafe': {
          wall('cafeCounter');
          const n = Math.max(2, Math.min(5, Math.floor(big / 12)));
          for (let i = 0; i < n; i++) free('roundTable', 0, 0.3);
          wall('plant'); maybe(0.6, () => wall('plant')); maybe(0.5, () => wall('sofa'));
          break;
        }
        case 'lobby':
          wall('reception'); maybe(0.8, () => free('rug', undefined, 1.0));
          wall('sofa'); maybe(0.7, () => wall('sofa')); maybe(0.6, () => free('coffeeTable', undefined, 1.0));
          wall('plant'); wall('plant'); maybe(0.7, () => wall('mailboxes')); maybe(0.5, () => wall('armchair'));
          break;
        case 'hotelRoom':
          wall('bedDouble'); wall('nightstand'); wall('nightstand');
          wall('tvStand'); maybe(0.7, () => wall('armchair')); wall('wardrobe');
          maybe(0.6, () => wall('luggage')); maybe(0.6, () => free('rug', undefined, 0.6)); wall('plant');
          break;
        case 'barn':
          for (let i = 0; i < 6; i++) wall('hay');
          for (let i = 0; i < 2; i++) maybe(0.8, () => free('hay', undefined, 1.0));
          wall('workbench'); maybe(0.8, () => wall('barrel')); maybe(0.7, () => wall('crate')); maybe(0.6, () => wall('sacks'));
          break;
        case 'loft':
          for (let i = 0; i < 7; i++) wall('hay');
          maybe(0.7, () => wall('crate')); maybe(0.7, () => wall('sacks'));
          break;
        case 'lodge':
          wall('fireplace'); maybe(0.9, () => free('rug', undefined, 0.8));
          free('longTable'); wall('firewood'); maybe(0.7, () => wall('armchair'));
          maybe(0.8, () => wall('antlers')); maybe(0.6, () => wall('bookshelf')); maybe(0.6, () => wall('barrel'));
          break;
        case 'bunkroom':
          wall('bunk'); wall('bunk'); maybe(0.7, () => wall('bunk'));
          maybe(0.7, () => wall('wardrobe')); maybe(0.6, () => wall('treasure')); maybe(0.6, () => free('rug', undefined, 0.6));
          break;
        case 'saloon': {
          wall('barCounter');
          const n = Math.max(2, Math.min(5, Math.floor(big / 14)));
          for (let i = 0; i < n; i++) free('roundTable', 0, 0.3);
          maybe(0.85, () => wall('piano'));
          wall('barrel'); maybe(0.7, () => wall('barrel')); maybe(0.6, () => wall('cactus')); maybe(0.6, () => wall('wanted'));
          break;
        }
        case 'store':
          wall('counter'); wall('storageRack'); maybe(0.7, () => wall('storageRack'));
          wall('barrel'); maybe(0.7, () => wall('barrel')); maybe(0.8, () => wall('sacks')); maybe(0.7, () => wall('crate'));
          maybe(0.6, () => wall('cactus'));
          break;
        case 'sheriff':
          free('desk'); wall('weaponRack'); wall('filing'); wall('wanted'); maybe(0.7, () => wall('cactus')); maybe(0.6, () => wall('barrel'));
          break;
        case 'cell':
          wall('bedSingle'); maybe(0.6, () => wall('toilet'));
          break;
        case 'chapel': {
          // altar en la pared contraria a la puerta y bancos mirando hacia él
          const altarSide = ctx.farSide || 'zmax';
          this._iwall(ctx, A, I.altar, [altarSide], 30);
          const rot = { zmin: 2, zmax: 0, xmin: 1, xmax: 3 }[altarSide];
          const alongZ = altarSide === 'zmin' || altarSide === 'zmax';   // las filas van una detrás de otra en Z
          const depth = alongZ ? Ad : Aw, width = alongZ ? Aw : Ad;
          const pw = Math.min(2.8, (width - 1.4) / 2 - 0.25);
          if (pw >= 1.2) {
            const pew = Object.assign({}, I.pew, { w: pw, clear: 0.3 });
            const [ux, uz, vx, vz] = ROT[rot];
            const mid = alongZ ? (A.x0 + A.x1) / 2 : (A.z0 + A.z1) / 2;
            for (let t = 2.6; t < depth - 1.4; t += 1.2) {
              for (const sd of [-1, 1]) {
                const al = mid + sd * (0.7 + pw / 2);
                const ac = altarSide === 'zmin' ? A.z0 + t : altarSide === 'zmax' ? A.z1 - t : altarSide === 'xmin' ? A.x0 + t : A.x1 - t;
                const px = alongZ ? al : ac, pz = alongZ ? ac : al;
                this._iput(ctx, A, pew, { ox: px - (pw / 2) * ux - (pew.d / 2) * vx, oz: pz - (pw / 2) * uz - (pew.d / 2) * vz, ux, uz, vx, vz, y: ctx.y });
              }
            }
          }
          wall('plant'); wall('plant');
          break;
        }
        case 'hall':
          free('longTable'); maybe(0.7, () => free('longTable'));
          wall('throne'); wall('banner'); wall('banner'); maybe(0.7, () => wall('banner'));
          wall('barrel'); maybe(0.6, () => free('rug', undefined, 0.8));
          break;
        case 'armory':
          wall('weaponRack'); wall('weaponRack'); maybe(0.7, () => wall('weaponRack'));
          wall('barrel'); wall('crate'); maybe(0.7, () => wall('treasure')); wall('banner');
          break;
        case 'royal':
          wall('canopyBed'); wall('treasure'); wall('wardrobe'); maybe(0.8, () => free('rug', undefined, 0.6)); wall('banner'); maybe(0.6, () => wall('dresser'));
          break;
        case 'beach':
          kitchenRun(); wall('bedSingle'); maybe(0.6, () => wall('sofa')); maybe(0.7, () => wall('plant'));
          maybe(0.6, () => free('roundTable', 0, 0.3)); maybe(0.5, () => free('rug', undefined, 0.6));
          break;
        case 'dining':
          free('diningTable'); maybe(0.7, () => wall('bookshelf')); wall('plant'); maybe(0.5, () => wall('dresser'));
          break;
        case 'lounge':
          maybe(0.8, () => free('rug', undefined, 0.8)); wall('sofa'); maybe(0.7, () => wall('armchair'));
          maybe(0.6, () => free('coffeeTable', undefined, 1.0)); wall('plant'); maybe(0.6, () => wall('plant'));
          break;
        case 'tables': {
          const n = Math.max(2, Math.min(5, Math.floor(big / 10)));
          for (let i = 0; i < n; i++) free('roundTable', 0, 0.3);
          wall('plant'); maybe(0.5, () => wall(ctx.theme === 'saloon' ? 'barrel' : 'sofa'));
          break;
        }
        case 'aisles': {
          const n = Math.max(1, Math.min(4, Math.floor(big / 16)));
          for (let i = 0; i < n; i++) free('gondola', this.r() < 0.5 ? 0 : 1, 0.9);
          maybe(0.7, () => wall('fridgeDisplay')); maybe(0.6, () => wall('storageRack'));
          break;
        }
        case 'extra':
          maybe(0.6, () => wall('plant')); maybe(0.5, () => wall('bookshelf')); maybe(0.4, () => wall('armchair'));
          break;
        case 'extraWork':
          maybe(0.7, () => wall('storageRack')); maybe(0.6, () => wall('crate')); maybe(0.5, () => wall('plant'));
          break;
      }
    },

    /* Las salas grandes se reparten en zonas de unos 8 m, cada una con su uso
       (si no, quedarían medio vacías). */
    _ifillSplit(ctx, A, main) {
      const SPLIT = {
        kitchenLiving: ['kitchen', 'living', 'dining'], living: ['living', 'dining'], bedroom: ['bedroom', 'kids', 'lounge'],
        office: ['office'], cafe: ['cafe', 'tables', 'lounge'], shop: ['shop', 'aisles'], lobby: ['lobby', 'lounge', 'tables'],
        hall: ['hall', 'armory'], armory: ['armory', 'storage'], royal: ['royal', 'lounge'], barn: ['barn', 'loft'],
        loft: ['loft'], hotelRoom: ['hotelRoom', 'lounge'], saloon: ['saloon', 'tables'], store: ['store', 'storage'],
        sheriff: ['sheriff', 'storage'], lodge: ['lodge', 'bunkroom'], bunkroom: ['bunkroom', 'lounge'], kids: ['kids', 'lounge'],
      };
      const seq = SPLIT[main];
      const Aw = A.x1 - A.x0, Ad = A.z1 - A.z0;
      const n = seq ? Math.max(1, Math.min(4, Math.round(Math.max(Aw, Ad) / 8))) : 1;
      if (n === 1) return this._ifill(ctx, A, main);
      const alongX = Aw >= Ad;
      // la primera zona es siempre la principal (la barra del bar, la recepción, la cocina...)
      const order = [seq[0]];
      for (let i = 1; i < n; i++) order.push(seq[1 + ((i - 1) % Math.max(1, seq.length - 1))] || seq[0]);
      if (this.r() < 0.5) order.reverse();
      for (let i = 0; i < n; i++) {
        const S = alongX
          ? { x0: A.x0 + (Aw * i) / n, x1: A.x0 + (Aw * (i + 1)) / n, z0: A.z0, z1: A.z1 }
          : { x0: A.x0, x1: A.x1, z0: A.z0 + (Ad * i) / n, z1: A.z0 + (Ad * (i + 1)) / n };
        S.occ = A.occ; S.sides = A.sides;
        this._ifill(ctx, S, order[i]);
      }
    },

    /* ---------- Qué hay en cada planta según el tipo de edificio ----------
       main = lo que hay en la zona grande; rooms = habitaciones con tabiques (en esquinas) */
    _iplan(theme, k, floors) {
      const r = () => this.r();
      const pick = (a) => this.pick(a);
      const top = k === floors - 1;
      switch (theme) {
        case 'home':
          if (floors === 1) return { main: 'kitchenLiving', rooms: r() < 0.75 ? ['bath', 'bedroom'] : ['bath'] };
          if (k === 0) return { main: 'kitchenLiving', rooms: r() < 0.7 ? ['bath'] : [] };
          return { main: pick(['bedroom', 'bedroom', 'kids']), rooms: r() < 0.65 ? ['bath', 'bedroom'] : ['bath'] };
        case 'apartment':
          if (k === 0) return { main: pick(['lobby', 'shop', 'cafe']), rooms: r() < 0.5 ? [pick(['storage', 'bath'])] : [] };
          return { main: 'kitchenLiving', rooms: ['bedroom', 'bath'] };
        case 'office':
          if (k === 0) return { main: pick(['lobby', 'lobby', 'cafe']), rooms: r() < 0.5 ? ['bath'] : [] };
          return { main: 'office', rooms: [pick(['meeting', 'boss']), r() < 0.5 ? 'bath' : 'storage'] };
        case 'mixed':
          if (k === 0) return { main: pick(['shop', 'cafe']), rooms: ['storage'] };
          return k % 2 ? { main: 'office', rooms: ['meeting'] } : { main: 'kitchenLiving', rooms: ['bedroom', 'bath'] };
        case 'hotel':
          if (k === 0) return { main: 'lobby', rooms: ['bath'] };
          return { main: 'hotelRoom', rooms: ['bath', r() < 0.5 ? 'bedroom' : 'bath'] };
        case 'barn': return k === 0 ? { main: 'barn', rooms: r() < 0.5 ? ['storage'] : [] } : { main: 'loft', rooms: [] };
        case 'lodge': return k === 0 ? { main: 'lodge', rooms: ['bath'] } : { main: 'bunkroom', rooms: r() < 0.5 ? ['bath'] : [] };
        case 'cabin': return { main: 'lodge', rooms: r() < 0.5 ? ['bunkroom'] : [] };
        case 'saloon': return k === 0 ? { main: 'saloon', rooms: ['storage'] } : { main: 'bedroom', rooms: ['bath', 'bedroom'] };
        case 'store': return k === 0 ? { main: 'store', rooms: ['storage'] } : { main: 'bedroom', rooms: ['bath'] };
        case 'sheriff': return k === 0 ? { main: 'sheriff', rooms: ['cell'] } : { main: 'bedroom', rooms: ['bath'] };
        case 'chapel': return { main: 'chapel', rooms: [] };
        case 'keep': return k === 0 ? { main: 'hall', rooms: [] } : top ? { main: 'royal', rooms: ['bath'] } : { main: 'armory', rooms: ['storage'] };
        case 'beach': return { main: 'beach', rooms: r() < 0.6 ? ['bath'] : [] };
      }
      return { main: 'living', rooms: [] };
    },
    // tamaño de cada habitación (ancho x fondo, mínimo y máximo)
    _iroomSize(kind) {
      return {
        bath: [2.3, 3.0, 2.1, 2.8], bedroom: [3.2, 4.4, 3.0, 4.0], kids: [3.2, 4.2, 3.0, 3.8], meeting: [4.0, 5.2, 3.2, 4.0],
        boss: [3.2, 4.2, 3.0, 3.8], storage: [2.4, 3.4, 2.2, 3.0], cell: [2.4, 3.0, 2.4, 3.0], bunkroom: [3.0, 4.0, 3.0, 3.6],
      }[kind] || [2.6, 3.4, 2.4, 3.2];
    },

    /* Una habitación en una esquina del área: dos tabiques con un hueco de puerta.
       style 'bars' = barrotes (calabozo) */
    _iroom(ctx, A, kind) {
      const [w0, w1, d0, d1] = this._iroomSize(kind);
      const Aw = A.x1 - A.x0, Ad = A.z1 - A.z0;
      for (let t = 0; t < 14; t++) {
        const w = this.rr(w0, w1), d = this.rr(d0, d1);
        if (w > Aw - 2.6 || d > Ad - 2.2) continue;
        const atX0 = this.r() < 0.5, atZ0 = this.r() < 0.5;
        const R = [atX0 ? A.x0 : A.x1 - w, atZ0 ? A.z0 : A.z1 - d, atX0 ? A.x0 + w : A.x1, atZ0 ? A.z0 + d : A.z1];
        if (!this._ifree(ctx, A, R)) continue;
        // hueco de la puerta: en el tabique más largo, en el extremo más alejado de la esquina
        const doorOnZ = (w >= d) === (this.r() < 0.75);   // true: en el tabique paralelo a X
        const zw = atZ0 ? R[3] : R[1], xw = atX0 ? R[2] : R[0];
        const T = 0.12, gap = 1.05, ceil = ctx.ceil;
        const bars = kind === 'cell';
        const grp = bars ? { name: 'Barrotes', mat: 'metal', hp: 300, yield: 6 } : { name: 'Tabique', mat: 'wood', hp: 120, yield: 4 };
        let dx0, dx1, dz0, dz1;
        if (doorOnZ) { dx0 = atX0 ? R[2] - gap - 0.2 : R[0] + 0.2; dx1 = dx0 + gap; }
        else { dz0 = atZ0 ? R[3] - gap - 0.2 : R[1] + 0.2; dz1 = dz0 + gap; }
        const piece = (x0, z0, x1, z1) => {
          if (x1 - x0 < 0.02 || z1 - z0 < 0.02) return;
          if (!bars) { this.solid(x0, ctx.y, z0, x1, ctx.y + ceil, z1, ctx.P.part, { jitter: 0.01 }); return; }
          const alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0, n = Math.floor(L / 0.17);
          for (let i = 0; i <= n; i++) {
            const a = (alongX ? x0 : z0) + (i * L) / Math.max(1, n);
            if (alongX) this.solid(a - 0.025, ctx.y, z0 + 0.03, a + 0.025, ctx.y + 2.5, z1 - 0.03, DARK, { jitter: 0 });
            else this.solid(x0 + 0.03, ctx.y, a - 0.025, x1 - 0.03, ctx.y + 2.5, a + 0.025, DARK, { jitter: 0 });
          }
          this.vbox(x0, ctx.y + 2.5, z0, x1, ctx.y + 2.6, z1, DARK);
          this.vbox(x0, ctx.y + 0.05, z0, x1, ctx.y + 0.12, z1, DARK);
        };
        D.begin(grp);
        // tabique paralelo a X (en z = zw)
        const hz0 = atZ0 ? zw - T : zw, hz1 = hz0 + T;
        if (doorOnZ) { piece(R[0], hz0, dx0, hz1); piece(dx1, hz0, R[2], hz1); if (!bars) this.solid(dx0, ctx.y + 2.2, hz0, dx1, ctx.y + ceil, hz1, ctx.P.part); }
        else piece(R[0], hz0, R[2], hz1);
        // tabique paralelo a Z (en x = xw)
        const vx0 = atX0 ? xw - T : xw, vx1 = vx0 + T;
        const zA = atZ0 ? R[1] : R[1], zB = atZ0 ? hz0 : R[3];
        const zA2 = atZ0 ? zA : hz1;
        if (!doorOnZ) { piece(vx0, zA2, vx1, dz0); piece(vx0, dz1, vx1, zB); if (!bars) this.solid(vx0, ctx.y + 2.2, dz0, vx1, ctx.y + ceil, dz1, ctx.P.part); }
        else piece(vx0, zA2, vx1, zB);
        D.end();
        // reservas: la habitación entera para el área grande, y la puerta libre por los dos lados
        A.occ.push(R);
        let inner = [atX0 ? R[0] : R[0] + T, atZ0 ? R[1] : R[1] + T, atX0 ? R[2] - T : R[2], atZ0 ? R[3] - T : R[3]];
        const RA = { x0: inner[0], z0: inner[1], x1: inner[2], z1: inner[3], occ: [], sides: ['zmin', 'zmax', 'xmin', 'xmax'], room: true };
        if (doorOnZ) {
          RA.occ.push([dx0 - 0.1, atZ0 ? zw - T - 1.1 : zw + T, dx1 + 0.1, atZ0 ? zw - T : zw + T + 1.1]);
          A.occ.push([dx0 - 0.1, atZ0 ? zw : zw - 1.1, dx1 + 0.1, atZ0 ? zw + 1.1 : zw]);
        } else {
          RA.occ.push([atX0 ? xw - T - 1.1 : xw + T, dz0 - 0.1, atX0 ? xw - T : xw + T + 1.1, dz1 + 0.1]);
          A.occ.push([atX0 ? xw : xw - 1.1, dz0 - 0.1, atX0 ? xw + 1.1 : xw, dz1 + 0.1]);
        }
        ctx.walls.push({ R, atX0, atZ0, zw, xw, doorOnZ, bars });
        ctx.rooms.push(R);
        this._ifill(ctx, RA, kind);
        this._ilamp(ctx, (RA.x0 + RA.x1) / 2, (RA.z0 + RA.z1) / 2);
        return true;
      }
      return false;
    },

    // lámpara de techo
    _ilamp(ctx, x, z) {
      const y = ctx.y + ctx.ceil;
      this.vbox(x - 0.02, y - 0.35, z - 0.02, x + 0.02, y, z + 0.02, DARK);
      this.vbox(x - 0.22, y - 0.45, z - 0.22, x + 0.22, y - 0.33, z + 0.22, ctx.P.lamp);
    },

    // cuadros en la cara de fuera de los tabiques
    _ipictures(ctx) {
      for (const wl of ctx.walls) {
        if (wl.bars) continue;
        const R = wl.R;
        if (this.r() < 0.6 && !wl.doorOnZ) {
          const z = wl.atZ0 ? wl.zw + 0.005 : wl.zw - 0.045, cx = (R[0] + R[2]) / 2, w = this.rr(0.5, 0.9), h = this.rr(0.45, 0.75);
          this.vbox(cx - w / 2, ctx.y + 1.45, z, cx + w / 2, ctx.y + 1.45 + h, z + 0.04, 0x5a3a22);
          this.vbox(cx - w / 2 + 0.05, ctx.y + 1.5, wl.atZ0 ? z + 0.04 : z - 0.002, cx + w / 2 - 0.05, ctx.y + 1.4 + h, wl.atZ0 ? z + 0.042 : z, this.pick(PRODUCTS));
        }
        if (this.r() < 0.6 && wl.doorOnZ) {
          const x = wl.atX0 ? wl.xw + 0.005 : wl.xw - 0.045, cz = (R[1] + R[3]) / 2, w = this.rr(0.5, 0.9), h = this.rr(0.45, 0.75);
          this.vbox(x, ctx.y + 1.45, cz - w / 2, x + 0.04, ctx.y + 1.45 + h, cz + w / 2, 0x5a3a22);
          this.vbox(wl.atX0 ? x + 0.04 : x - 0.002, ctx.y + 1.5, cz - w / 2 + 0.05, wl.atX0 ? x + 0.042 : x, ctx.y + 1.4 + h, cz + w / 2 - 0.05, this.pick(PRODUCTS));
        }
      }
    },

    /* ---------- Amueblar un edificio entero ----------
       s = { theme, floors, base, ceil, main: [x0, z0, x1, z1] (zona delantera), strip (opcional),
             center: [x, z], door: {x, z, nx, nz}, nIn: [x, z], stairs (opcional), doorSide,
             chestChance, lootRoof } */
    furnishBuilding(s) {
      // cada edificio usa su propio azar (sacado de su posición): así amueblar no cambia el resto
      // de la isla, y es igual en todos los jugadores de una partida
      const saved = this.rng;
      const h = (Math.imul(Math.round(s.center[0] * 10), 73856093) ^ Math.imul(Math.round(s.center[1] * 10), 19349663) ^ Math.imul(this.seed | 0, 83492791)) >>> 0;
      this.rng = G.makeRng(h);
      try { this._ifurnish(s); } finally { this.rng = saved; }
    },
    _ifurnish(s) {
      const P = {
        wood: this.pick(WOODS), wood2: this.pick(WOODS), fabric: this.pick(FABRICS), fabric2: this.pick(FABRICS),
        bed: this.pick(BEDDING), bed2: this.pick(BEDDING), cab: this.pick(CABINETS), counter: this.pick(COUNTERS),
        part: this.pick(PARTITION), tile: this.pick(TILES), rug: this.pick(RUGS), rug2: this.pick(RUGS),
        pot: this.pick([0xb5523b, 0xe8e2d6, 0x3d405b, 0xd4a017]), banner: this.pick([0x9b2226, 0x2f6fb5, 0x2a9d8f, 0x6d597a]),
        lamp: this.pick([0xfff6d5, 0xffffff, 0xffe8b0]), ceil: s.ceil,
      };
      P.fabricL = new THREE.Color(P.fabric).lerp(new THREE.Color(0xffffff), 0.25).getHex();
      const st = s.stairs;
      // plantas con cofre: una al azar (con probabilidad chestChance) y, además, cada una de las
      // demás con probabilidad chestExtra (así las casas grandes pueden tener varios cofres)
      const chestFloors = new Set();
      if (this.r() < s.chestChance) chestFloors.add(this.ri(0, s.floors - 1));
      for (let k = 0; k < s.floors; k++) if (this.r() < (s.chestExtra || 0)) chestFloors.add(k);
      (this.interiors = this.interiors || []).push({ theme: s.theme, main: s.main, base: s.base, floors: s.floors, center: s.center });
      for (let k = 0; k < s.floors; k++) {
        const y = s.base + k * H;
        const ctx = { y, ceil: s.ceil, P, segs: [], walls: [], rooms: [], farSide: s.farSide, theme: s.theme };
        ctx.tile = (A) => {
          this.vbox(A.x0, y, A.z0, A.x1, y + 0.012, A.z1, P.tile, { jitter: 0, noBottom: true });
          for (let x = A.x0 + 0.6; x < A.x1 - 0.1; x += 0.6) this.vbox(x - 0.01, y + 0.012, A.z0, x + 0.01, y + 0.016, A.z1, 0xb8c4cc, { jitter: 0, noBottom: true });
          for (let z = A.z0 + 0.6; z < A.z1 - 0.1; z += 0.6) this.vbox(A.x0, y + 0.012, z - 0.01, A.x1, y + 0.016, z + 0.01, 0xb8c4cc, { jitter: 0, noBottom: true });
        };
        // caminos de los bots en esta planta (no se puede poner nada encima)
        const [cx, cz] = s.center;
        if (k === 0) ctx.segs.push([s.nIn[0], s.nIn[1], cx, cz]);
        if (st) {
          const lane = (j) => (j % 2 === 0 ? st.laneA : st.laneB);
          const lzOf = (j) => (lane(j)[0] + lane(j)[1]) / 2;
          if (k < s.floors - 1) {
            const up = k % 2 === 0, xs = up ? st.sx0 - 0.8 : st.sx1 + 0.8;
            ctx.segs.push([cx, cz, xs, st.fz], [xs, st.fz, xs, lzOf(k)]);
          }
          if (k > 0) {
            const j = k - 1, up = j % 2 === 0, xe = up ? st.sx1 + 0.8 : st.sx0 - 0.8;
            ctx.segs.push([xe, lzOf(j), xe, st.fz], [xe, st.fz, cx, cz]);
          }
        }
        const [mx0, mz0, mx1, mz1] = s.main;
        const A = { x0: mx0, z0: mz0, x1: mx1, z1: mz1, occ: [], sides: ['zmin', 'zmax', 'xmin', 'xmax'] };
        // la puerta de entrada: libre por dentro
        if (k === 0) {
          const d = s.door;
          if (d.nz) A.occ.push([d.x - 1.3, d.nz < 0 ? mz0 : mz1 - 1.8, d.x + 1.3, d.nz < 0 ? mz0 + 1.8 : mz1]);
          else A.occ.push([d.nx < 0 ? mx0 : mx1 - 1.8, d.z - 1.3, d.nx < 0 ? mx0 + 1.8 : mx1, d.z + 1.3]);
        }
        // el sitio del cofre se reserva antes de amueblar
        let chest = null;
        if (chestFloors.has(k)) {
          const useMax = s.doorSide === 'xmin' ? true : s.doorSide === 'xmax' ? false : this.r() < 0.5;
          for (let t = 0; t < 10 && !chest; t++) {
            const chx = useMax ? mx1 - 0.55 : mx0 + 0.55;
            const chz = this.rr(mz0 + 1.0, mz1 - 1.0);
            const r = [chx - 0.6, chz - 0.8, chx + 0.6, chz + 0.8];
            if (this._ifree(ctx, A, r)) { chest = { x: chx, y, z: chz, rot: useMax ? Math.PI / 2 : -Math.PI / 2 }; A.occ.push(r); }
          }
        }
        const plan = this._iplan(s.theme, k, s.floors);
        for (const kind of plan.rooms) this._iroom(ctx, A, kind);
        this._ifillSplit(ctx, A, plan.main);
        this._ilamp(ctx, (mx0 + mx1) / 2, (mz0 + mz1) / 2);
        if ((mx1 - mx0) * (mz1 - mz0) > 90) { this._ilamp(ctx, mx0 + (mx1 - mx0) * 0.25, (mz0 + mz1) / 2); this._ilamp(ctx, mx0 + (mx1 - mx0) * 0.75, (mz0 + mz1) / 2); }
        let SA = null;
        if (s.strip) {
          const [a, b, c, d] = s.strip;
          if (c - a > 2.4 && d - b > 2.4) {
            SA = { x0: a, z0: b, x1: c, z1: d, occ: [], sides: ['zmin', 'zmax', 'xmin', 'xmax'] };
            this._ifill(ctx, SA, ['office', 'shop', 'cafe', 'lobby', 'store', 'storage'].includes(plan.main) ? 'extraWork' : 'extra');
          }
        }
        this._ipictures(ctx);
        if (chest) this.chestSpots.push(chest);
        // botín en sitios libres a los que se llega en línea recta desde el centro
        const n = this.r() < 0.45 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          let done = false;
          for (let t = 0; t < 40 && !done; t++) {
            const Z = SA && this.r() < 0.25 ? SA : A;
            const x = this.rr(Z.x0 + 0.6, Z.x1 - 0.6), z = this.rr(Z.z0 + 0.6, Z.z1 - 0.6);
            const r = [x - 0.35, z - 0.35, x + 0.35, z + 0.35];
            if (Z.occ.some((o) => overlap(r, o, 0))) continue;
            if (ctx.rooms.some((R) => overlap(r, R, 0.1))) continue;
            if (ctx.rooms.some((R) => segRect(cx, cz, x, z, R, 0.3))) continue;
            this.lootSpots.push({ x, y, z, indoor: true });
            done = true;
          }
        }
      }
    },
  });

  G.InteriorItems = I;
})();

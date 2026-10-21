/* =====================================================================
   villages.js — Los pueblos grandes de la isla (granjas, aldeas del
   bosque, puertos, pueblos de colina, de playa y aldeas con iglesia).
   Todos tienen una plaza con fuente, dos calles en cruz con casas a
   los lados (mirando a la calle), tiendas de 2-3 plantas junto a la
   plaza y algo propio de cada tipo (campos, aserradero, muelle...).
   Las carreteras de la isla llegan hasta la plaza.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const W = G.World, D = G.Destruct;

  const PAL = {
    farm: [
      { wall: 0xe9e4da, trim: 0x6b4f3a, floor: 0x9c7a55, roof: 0x8a2f24, stair: 0xa08a70 },
      { wall: 0xd9b26a, trim: 0x7a4b2a, floor: 0x7f5f40, roof: 0x4a3a32, stair: 0x9a8a78 },
      { wall: 0xb98a5a, trim: 0xf0e6d2, floor: 0x8b6b4a, roof: 0x6b3a2a, stair: 0x9a7b5a },
    ],
    forest: [
      { wall: 0x7b5233, trim: 0x4e3420, floor: 0x8b6b4a, roof: 0x3d4a35, stair: 0x8a6a48 },
      { wall: 0x8b5e3c, trim: 0xf2eee6, floor: 0x8b6b4a, roof: 0x2f4f3a, stair: 0x8a6a48 },
      { wall: 0x9c6b45, trim: 0xf4ead8, floor: 0x9c7a55, roof: 0x5a3a2a, stair: 0x9a7b5a },
    ],
    harbor: [
      { wall: 0x7fa7c9, trim: 0xf4f1ea, floor: 0x8e6e4e, roof: 0x5a3a2a, stair: 0x9a8a78 },
      { wall: 0xf4f1ea, trim: 0x2f6fb5, floor: 0x9c7a55, roof: 0x2f6fb5, stair: 0xa08a70 },
      { wall: 0x6aa9a4, trim: 0xe8e2d0, floor: 0x8e6e4e, roof: 0x4d5152, stair: 0xb0aa9a },
    ],
    hill: [
      { wall: 0xb8b2a5, trim: 0x6b6358, floor: 0x8b6b4a, roof: 0x7a3b2e, stair: 0x9a948a },
      { wall: 0xa49a88, trim: 0xe8e2d6, floor: 0x7d6b55, roof: 0x4a4644, stair: 0x8d8f92 },
      { wall: 0xc9bca4, trim: 0x5a4a3a, floor: 0x9c7a55, roof: 0x5a3a2a, stair: 0xa8a090 },
    ],
    beach: [
      { wall: 0x9fe3d1, trim: 0xffffff, floor: 0xc49a6c, roof: 0xd9734e, stair: 0xd9cbb0 },
      { wall: 0xf7b2c4, trim: 0xffffff, floor: 0xc49a6c, roof: 0x3e8e9e, stair: 0xd9cbb0 },
      { wall: 0xfde68a, trim: 0xffffff, floor: 0xc49a6c, roof: 0x2f7f8f, stair: 0xd9cbb0 },
      { wall: 0xa8d8f0, trim: 0xfdfdfd, floor: 0xc49a6c, roof: 0xc4553a, stair: 0xd9cbb0 },
    ],
    village: [
      { wall: 0xeee3c4, trim: 0xb5523b, floor: 0x93704d, roof: 0x5a5550, stair: 0xa59a88 },
      { wall: 0xc08552, trim: 0xf0e2c8, floor: 0x7a5a3c, roof: 0x4f4b47, stair: 0xa0968a },
      { wall: 0xd8c7a0, trim: 0x8c7b5f, floor: 0x9c7a55, roof: 0x8a2f24, stair: 0xa8a090 },
      { wall: 0xf2efe6, trim: 0x2a9d8f, floor: 0x8e6e4e, roof: 0x3d405b, stair: 0xb0aa9a },
    ],
  };
  // tiendas y bares junto a la plaza (2-3 plantas)
  const PAL_SHOP = [
    { wall: 0xa4553f, trim: 0xd9cbb0, floor: 0x8b6b4a, roof: 0x55524e, stair: 0x9a948a },
    { wall: 0x6aa9a4, trim: 0xe8e2d0, floor: 0x8e6e4e, roof: 0x4d5152, stair: 0xb0aa9a },
    { wall: 0xeee3c4, trim: 0xb5523b, floor: 0x93704d, roof: 0x5a5550, stair: 0xa59a88 },
    { wall: 0xc08552, trim: 0xf0e2c8, floor: 0x7a5a3c, roof: 0x4f4b47, stair: 0xa0968a },
    { wall: 0x7fa7c9, trim: 0xf4f1ea, floor: 0x8e6e4e, roof: 0x5a3a2a, stair: 0x9a8a78 },
  ];
  const PAVE = { farm: 0xc8b48a, forest: 0x9c8a6e, harbor: 0xd9cfbf, hill: 0xa8a294, beach: 0xe8dcc0, village: 0xc9c0b0 };
  const ASPHALT = 0x4a4d52;
  const M4 = () => new THREE.Matrix4();

  Object.assign(W, {
    /* ---------- Centro de Bahía Coral ----------
       Detrás del pueblo de playa (tierra adentro) hay un centro con calles en cuadrícula
       y manzanas de edificios de 2 a 5 plantas, como una ciudad pequeña.
       Coordenadas locales del pueblo: u = hacia el mar (negativo = tierra adentro), v = a lo largo de la costa. */
    BEACH_DT: { U: [-44, -84, -124, -164], V: [-80, -40, 0, 40, 80], SW: 10 },
    beachFrame(p) {
      const alongX = Math.abs(p.x) > Math.abs(p.z), sg = Math.sign(alongX ? p.x : p.z) || 1;
      const Wp = (u, v) => (alongX ? { x: p.x + sg * u, z: p.z + v } : { x: p.x + v, z: p.z + sg * u });
      const Rr = (u0, u1, v0, v1) => {
        const a = Wp(u0, v0), b = Wp(u1, v1);
        return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
      };
      return { Wp, Rr };
    },
    buildBeachDowntown(p) {
      const { U, V, SW } = this.BEACH_DT;
      const { Wp, Rr } = this.beachFrame(p);
      const L = p.level, h = SW / 2;
      const u0 = U[U.length - 1] - h, u1 = U[0] + h, v0 = V[0] - h, v1 = V[V.length - 1] + h;
      // asfalto de todo el centro (suelo del mapa: no se rompe)
      const all = Rr(u0, u1, v0, v1);
      this.gbox(all[0], L - 1, all[1], all[2], L + 0.04, all[3], 0x4a4d52, { jitter: 0, noBottom: true });
      // líneas discontinuas en el centro de cada calle
      for (const u of U) {
        for (let v = v0 + 2; v < v1 - 3; v += 7) {
          if (V.some((q) => Math.abs(v + 1.5 - q) < 6)) continue;
          const r = Rr(u - 0.12, u + 0.12, v, v + 3);
          this.gbox(r[0], L + 0.04, r[1], r[2], L + 0.07, r[3], 0xe8d36a, { jitter: 0, noBottom: true }, 2);
        }
      }
      for (const v of V) {
        for (let u = u0 + 2; u < u1 - 3; u += 7) {
          if (U.some((q) => Math.abs(u + 1.5 - q) < 6)) continue;
          const r = Rr(u, u + 3, v - 0.12, v + 0.12);
          this.gbox(r[0], L + 0.04, r[1], r[2], L + 0.07, r[3], 0xe8d36a, { jitter: 0, noBottom: true }, 2);
        }
      }
      // manzanas: aceras y edificios (la del medio, un paseo con palmeras y una fuente)
      const nu = U.length - 1, nv = V.length - 1;
      for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
          const b = Rr(U[i + 1] + h, U[i] - h, V[j] + h, V[j + 1] - h);
          this.solid(b[0], L - 0.5, b[1], b[2], L + 0.14, b[3], 0xd8cfb8, { jitter: 0.02, noBottom: true });
          if (i === 1 && j === 1) this.beachPromenade(b, L + 0.14);
          // las manzanas del lado del mar, más bajas (como los edificios de primera línea)
          else this.fillBlock(b[0], b[1], b[2], b[3], L + 0.14, i === 0 ? 2 : 1);
        }
      }
      // farolas en las esquinas, nodos para los bots y coches aparcados
      for (const u of U) {
        for (const v of V) {
          const c = Wp(u, v);
          G.Nav.addNode(c.x, L, c.z, true);
          const lp = Wp(u + h + 0.6, v + h + 0.6);
          D.begin({ name: 'Farola', mat: 'metal', hp: 80, yield: 4 });
          this.solid(lp.x - 0.09, L + 0.14, lp.z - 0.09, lp.x + 0.09, L + 4.6, lp.z + 0.09, 0x3d4650, { noBottom: true });
          this.vbox(lp.x - 0.25, L + 4.6, lp.z - 0.25, lp.x + 0.25, L + 4.9, lp.z + 0.25, 0xfff2b0, { jitter: 0 });
          D.end();
        }
      }
      for (const u of U) for (let j = 0; j < nv; j++) { const c = Wp(u, (V[j] + V[j + 1]) / 2); G.Nav.addNode(c.x, L, c.z, true); }
      for (const u of U) this.mapStreets.push({ pts: [Wp(u, v0), Wp(u, v1)] });
      for (const v of V) this.mapStreets.push({ pts: [Wp(u0, v), Wp(u1, v)] });
      const cols = [0xd62828, 0x1d3557, 0xf1faee, 0x2a9d8f, 0xe9c46a, 0x4cc9f0, 0xff8fab];
      const cars = [];
      const alongXw = Math.abs(p.x) > Math.abs(p.z);
      for (let i = 0; i < 16; i++) {
        const onU = this.r() < 0.5, side = this.r() < 0.5 ? -1 : 1;
        let u, v;
        if (onU) { u = this.pick(U) + side * 3.1; v = this.rr(v0 + 4, v1 - 4); if (V.some((q) => Math.abs(v - q) < 9)) continue; }
        else { v = this.pick(V) + side * 3.1; u = this.rr(u0 + 4, u1 - 4); if (U.some((q) => Math.abs(u - q) < 9)) continue; }
        const c = Wp(u, v);
        if (cars.some((o) => Math.hypot(o[0] - c.x, o[1] - c.z) < 6.5)) continue;
        // los coches van a lo largo de su calle: calle "U" = paralela a la costa (eje v)
        const alongZ = onU ? alongXw : !alongXw;
        this.car(c.x, c.z, L, alongZ, this.pick(cols));
        cars.push([c.x, c.z]);
      }
      for (let i = 0; i < 3; i++) {
        const c = Wp(this.pick(U) + 3.4, this.rr(v0 + 6, v1 - 6));
        if (cars.some((o) => Math.hypot(o[0] - c.x, o[1] - c.z) < 6)) continue;
        this.motoSpots.push({ x: c.x, y: L, z: c.z, yaw: this.rr(0, 6.28) });
      }
    },
    // manzana-paseo: suelo claro, palmeras, bancos y una fuente
    beachPromenade(b, y) {
      this.gbox(b[0] + 1, y, b[1] + 1, b[2] - 1, y + 0.05, b[3] - 1, 0xeadcb8, { noBottom: true });
      const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
      this.townCenterpiece({ x: cx, z: cz }, 'village', y);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const px = cx + sx * ((b[2] - b[0]) / 2 - 3), pz = cz + sz * ((b[3] - b[1]) / 2 - 3);
        if (sx === 0 || sz === 0) {
          D.begin({ name: 'Banco', mat: 'wood', hp: 70, yield: 5 });
          this.solid(px - 0.9, y, pz - 0.25, px + 0.9, y + 0.5, pz + 0.25, 0x7a5a3c, { noBottom: true });
          D.end();
        } else this.palm(px, pz, y);
      }
      for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) this.lootSpots.push({ x: cx + dx, y, z: cz + dz });
      if (this.r() < 0.7) this.chestSpots.push({ x: cx + 5, y, z: cz + 5, rot: 0 });
    },

    buildTown(p) {
      const y = p.level, R = p.r, PR = p.plazaR, SW = 3.6;
      const type = PAL[p.type] ? p.type : 'village';
      const placed = [];     // rectángulos ocupados [x0, z0, x1, z1]
      const hits = (r, m) => placed.some((b) => r[0] < b[2] + m && r[2] > b[0] - m && r[1] < b[3] + m && r[3] > b[1] - m);
      const inTown = (r, m) => [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]].every(([x, z]) => Math.hypot(x - p.x, z - p.z) < R - m);
      const offRoad = (r, m) => ![[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2],
        [(r[0] + r[2]) / 2, r[1]], [(r[0] + r[2]) / 2, r[3]], [r[0], (r[1] + r[3]) / 2], [r[2], (r[1] + r[3]) / 2]].some(([x, z]) => this.nearRoad(x, z, m));
      const free = (r, m) => !hits(r, m) && inTown(r, 2) && offRoad(r, 1.5);
      const Nv = G.Nav;

      // 1) plaza con su monumento
      const pr = [p.x - PR, p.z - PR, p.x + PR, p.z + PR];
      this.gbox(pr[0], y, pr[1], pr[2], y + 0.06, pr[3], PAVE[type], { noBottom: true, jitter: 0.02 });
      for (const [a, b, c, d] of [[pr[0], pr[1], pr[2], pr[1] + 0.3], [pr[0], pr[3] - 0.3, pr[2], pr[3]], [pr[0], pr[1], pr[0] + 0.3, pr[3]], [pr[2] - 0.3, pr[1], pr[2], pr[3]]]) {
        this.vbox(a, y, b, c, y + 0.15, d, 0x8d8a82, { noBottom: true, jitter: 0 });
      }
      this.townCenterpiece(p, type, y);
      placed.push(pr);
      // bancos y árboles en las esquinas de la plaza
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = p.x + sx * (PR - 2.5), tz = p.z + sz * (PR - 2.5);
        if (this.r() < 0.7) this.tree(tx, tz, y, type === 'forest' || type === 'hill' ? 'pine' : 'round');
        D.begin({ name: 'Banco', mat: 'wood', hp: 70, yield: 5 });
        const bx = p.x + sx * (PR - 6), bz = p.z + sz * (PR - 1.2);
        this.solid(bx - 0.9, y, bz - 0.25, bx + 0.9, y + 0.5, bz + 0.25, 0x7a5a3c, { noBottom: true });
        D.end();
      }
      Nv.addNode(p.x, y, p.z + PR - 1, true);
      Nv.addNode(p.x, y, p.z - PR + 1, true);

      // 2) calles: sólo hacia donde llega una carretera (siguen hasta el borde y empalman con ella).
      //    Si sólo llega una, la calle continúa al otro lado de la plaza como calle interior que acaba
      //    en una plazoleta (dentro del pueblo: no parece una carretera que sale al campo)
      const roadAt = (dx, dz) => {
        const ix = p.x + dx * (R - 8), iz = p.z + dz * (R - 8);
        return this.roads.some((rd) => {
          const a = rd.pts[0], b = rd.pts[rd.pts.length - 1];
          return Math.hypot(a.x - ix, a.z - iz) < 3 || Math.hypot(b.x - ix, b.z - iz) < 3;
        });
      };
      const streets = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => roadAt(dx, dz)).map(([dx, dz]) => ({ dx, dz, t1: R - 4, inner: false }));
      if (!streets.length) streets.push({ dx: 1, dz: 0, t1: Math.round(R * 0.6), inner: true });
      if (streets.length === 1) streets.push({ dx: -streets[0].dx, dz: -streets[0].dz, t1: Math.round(R * 0.6), inner: true });
      for (const st of streets) {
        const { dx, dz } = st;
        const t0 = PR, t1 = st.t1;
        const a = [p.x + dx * t0, p.z + dz * t0], b = [p.x + dx * t1, p.z + dz * t1];
        const r = [Math.min(a[0], b[0]) - (dz ? SW : 0), Math.min(a[1], b[1]) - (dx ? SW : 0), Math.max(a[0], b[0]) + (dz ? SW : 0), Math.max(a[1], b[1]) + (dx ? SW : 0)];
        this.gbox(r[0], y, r[1], r[2], y + 0.06, r[3], ASPHALT, { noBottom: true, jitter: 0 });
        // línea discontinua y aceras
        for (let t = t0 + 1; t < t1 - 1; t += 4) {
          const cx = p.x + dx * t, cz = p.z + dz * t;
          this.gbox(cx - (dx ? 1 : 0.1), y + 0.06, cz - (dz ? 1 : 0.1), cx + (dx ? 1 : 0.1), y + 0.09, cz + (dz ? 1 : 0.1), 0xe8d36a, { noBottom: true, jitter: 0 }, 2);
        }
        for (const sd of [-1, 1]) {
          const o = SW + 0.9;
          const s = dx ? [r[0], p.z + sd * o - 0.9, r[2], p.z + sd * o + 0.9] : [p.x + sd * o - 0.9, r[1], p.x + sd * o + 0.9, r[3]];
          this.gbox(s[0], y, s[1], s[2], y + 0.14, s[3], 0xb9b4aa, { noBottom: true, jitter: 0.01 });
        }
        placed.push([r[0] - 1.8, r[1] - 1.8, r[2] + 1.8, r[3] + 1.8]);
        for (let t = t0 + 8; t < t1; t += 16) {
          const sd = (Math.round(t / 16) % 2) ? 1 : -1, o = SW + 1.2;
          const lx = p.x + dx * t + (dz ? sd * o : 0), lz = p.z + dz * t + (dx ? sd * o : 0);
          D.begin({ name: 'Farola', mat: 'metal', hp: 80, yield: 4 });
          this.solid(lx - 0.09, y, lz - 0.09, lx + 0.09, y + 4.4, lz + 0.09, 0x3d4650, { noBottom: true });
          this.vbox(lx - 0.25, y + 4.4, lz - 0.25, lx + 0.25, y + 4.7, lz + 0.25, 0xfff2b0, { jitter: 0 });
          D.end();
        }
        for (let t = t0 + 10; t < t1; t += 20) Nv.addNode(p.x + dx * t, y, p.z + dz * t, true);
        this.mapStreets.push({ pts: [{ x: p.x, z: p.z }, { x: b[0], z: b[1] }] });
        if (st.inner) {
          // plazoleta al final de la calle interior
          const ex = p.x + dx * (t1 + 5), ez = p.z + dz * (t1 + 5);
          this.gbox(ex - 7, y, ez - 7, ex + 7, y + 0.06, ez + 7, ASPHALT, { noBottom: true, jitter: 0 });
          if (this.r() < 0.7) this.tree(ex, ez, y, type === 'forest' || type === 'hill' ? 'pine' : 'round');
          placed.push([ex - 8.5, ez - 8.5, ex + 8.5, ez + 8.5]);
          Nv.addNode(ex + 4, y, ez + 4, true);
        }
      }

      // 3) lo propio de cada tipo de pueblo (granero, aserradero, iglesia...)
      this.townLandmark(p, type, y, placed, free);

      // 4) casas y tiendas a los dos lados de cada calle, con la puerta hacia la calle
      let shops = 0;
      for (const { dx, dz, t1 } of streets) {
        for (const side of [-1, 1]) {
          for (let row = 0; row < (R > 80 ? 3 : 2); row++) {   // los pueblos grandes tienen una fila más
            let t = PR + 2 + this.rr(0, 2);
            while (t < Math.min(R - 8, t1 + 6)) {
              const nearPlaza = row === 0 && t < PR + (R > 80 ? 30 : 14);
              const shop = nearPlaza && shops < (R > 80 ? 9 : 5) && this.r() < 0.6;
              const floors = shop ? this.ri(2, 3) : (this.r() < 0.5 ? 2 : 1);
              const wl = shop ? this.rr(11, 14) : floors > 1 ? this.rr(10, 13) : this.rr(8.5, 11);   // a lo largo de la calle
              const dp = shop ? this.rr(10, 12) : this.rr(9, 11.5);                                 // fondo
              const off = SW + 2.8 + row * (dp + 4.5) + dp / 2;
              const ca = t + wl / 2;
              const cx = p.x + dx * ca + (dz ? side * off : 0), cz = p.z + dz * ca + (dx ? side * off : 0);
              const hx = dx ? wl / 2 : dp / 2, hz = dx ? dp / 2 : wl / 2;
              const r = [cx - hx, cz - hz, cx + hx, cz + hz];
              if (!free(r, 2.2)) { t += 3; continue; }
              placed.push(r);
              // la puerta mira a la calle (o hacia la plaza en la segunda fila)
              const doorSide = dx ? (side > 0 ? 'zmin' : 'zmax') : (side > 0 ? 'xmin' : 'xmax');
              const stairSide = doorSide === 'zmin' ? 1 : doorSide === 'zmax' ? -1 : (this.r() < 0.5 ? 1 : -1);
              const pal = shop ? this.pick(PAL_SHOP) : this.pick(PAL[type]);
              this.building({
                x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors, pal, stairSide, doorSide, outsideY: y, kind: 'house',
                mat: shop || type === 'hill' ? 'stone' : undefined, wallHp: shop || type === 'hill' ? 200 : undefined,
                interior: shop ? this.pick(['apartment', 'mixed']) : type === 'forest' ? this.pick(['home', 'cabin']) : 'home',
              });
              if (shop) shops++;
              t += wl + this.rr(3, 6);
            }
          }
        }
      }
      // casas sueltas en el resto del pueblo (mirando a la plaza)
      for (let att = 0; att < (R > 80 ? 220 : 140); att++) {
        const floors = this.r() < 0.5 ? 2 : 1;
        const w = floors > 1 ? this.rr(10, 13) : this.rr(8.5, 11), d = this.rr(9, 11);
        const a = this.rr(0, Math.PI * 2), dist = this.rr(PR + 12, R - 9);
        const cx = p.x + Math.cos(a) * dist, cz = p.z + Math.sin(a) * dist;
        const r = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
        if (!free(r, 3)) continue;
        placed.push(r);
        const ddx = p.x - cx, ddz = p.z - cz;
        const doorSide = Math.abs(ddx) > Math.abs(ddz) ? (ddx > 0 ? 'xmax' : 'xmin') : (ddz > 0 ? 'zmax' : 'zmin');
        const stairSide = doorSide === 'zmin' ? 1 : doorSide === 'zmax' ? -1 : (this.r() < 0.5 ? 1 : -1);
        this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors, pal: this.pick(PAL[type]), stairSide, doorSide, outsideY: y, kind: 'house',
          mat: type === 'hill' ? 'stone' : undefined, wallHp: type === 'hill' ? 200 : undefined, interior: type === 'forest' ? 'cabin' : 'home' });
      }

      // 5) cobertura, botín y una moto
      const spot = (m) => {
        for (let i = 0; i < 20; i++) {
          const a = this.rr(0, 6.28), dd = this.rr(PR * 0.5, R - 4);
          const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
          if (hits([x, z, x, z], m) && Math.hypot(x - p.x, z - p.z) > PR) continue;
          if (this.nearRoad(x, z, 0.5) && Math.hypot(x - p.x, z - p.z) > PR) continue;
          return [x, z];
        }
        return null;
      };
      for (let i = 0; i < 8; i++) { const s = spot(2); if (s && Math.hypot(s[0] - p.x, s[1] - p.z) > PR) this.crate(s[0], y, s[1], this.rr(1.0, 1.4)); }
      for (let i = 0; i < 6; i++) { const s = spot(1); if (s) this.lootSpots.push({ x: s[0], y, z: s[1] }); }
      if (this.r() < 0.5) this.chestSpots.push({ x: p.x + PR - 1.2, y, z: p.z, rot: -Math.PI / 2 });
      const ms = spot(3);
      if (ms && this.r() < 0.4) this.motoSpots.push({ x: ms[0], y, z: ms[1], yaw: this.rr(0, 6.28) });
      G.Nav.addNode(p.x, y, p.z, true);
    },

    /* Monumento del centro de la plaza */
    townCenterpiece(p, type, y) {
      const x = p.x, z = p.z;
      if (type === 'harbor' || type === 'beach') {
        // ancla gigante sobre un pedestal
        D.begin({ name: 'Monumento', mat: 'stone', hp: 300, yield: 8 });
        this.solid(x - 1.4, y, z - 1.4, x + 1.4, y + 1.0, z + 1.4, 0xd9cfbf, { noBottom: true });
        this.solid(x - 0.15, y + 1.0, z - 0.15, x + 0.15, y + 4.2, z + 0.15, 0x3a3f47);
        this.vbox(x - 1.0, y + 3.6, z - 0.12, x + 1.0, y + 3.85, z + 0.12, 0x3a3f47);
        this.vbox(x - 1.3, y + 1.2, z - 0.12, x + 1.3, y + 1.45, z + 0.12, 0x3a3f47);
        this.vbox(x - 1.3, y + 1.2, z - 0.12, x - 1.05, y + 1.9, z + 0.12, 0x3a3f47);
        this.vbox(x + 1.05, y + 1.2, z - 0.12, x + 1.3, y + 1.9, z + 0.12, 0x3a3f47);
        D.end();
        return;
      }
      if (type === 'farm') {
        // pozo con tejadillo
        D.begin({ name: 'Pozo', mat: 'stone', hp: 250, yield: 7 });
        this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(1.3, 0.9, 1.3)), 0x9a958c, 0.03);
        this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 0.85, z).multiply(M4().makeScale(1.0, 0.06, 1.0)), 0x2a4f7a, 0);
        const b = G.Phys.addBox(x - 1.2, y, z - 1.2, x + 1.2, y + 0.9, z + 1.2); D.addBox(D.active, b);
        for (const s of [-1, 1]) this.vbox(x + s * 1.1 - 0.08, y + 0.9, z - 0.08, x + s * 1.1 + 0.08, y + 2.6, z + 0.08, 0x6b4423);
        this.vbox(x - 1.5, y + 2.6, z - 0.9, x + 1.5, y + 2.75, z + 0.9, 0x8a2f24);
        D.end();
        return;
      }
      // fuente redonda (en los demás)
      D.begin({ name: 'Fuente', mat: 'stone', hp: 400, yield: 10 });
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(3.0, 0.7, 3.0)), 0x9a958c, 0.02);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 0.62, z).multiply(M4().makeScale(2.7, 0.06, 2.7)), 0x4cb3e6, 0);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 0.7, z).multiply(M4().makeScale(0.35, 1.6, 0.35)), 0xb0aba2, 0.02);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 2.2, z).multiply(M4().makeScale(1.1, 0.25, 1.1)), 0x9a958c, 0.02);
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y + 2.42, z).multiply(M4().makeScale(0.9, 0.05, 0.9)), 0x4cb3e6, 0);
      const b = G.Phys.addBox(x - 2.4, y, z - 2.4, x + 2.4, y + 0.7, z + 2.4); D.addBox(D.active, b);
      const b2 = G.Phys.addBox(x - 0.4, y + 0.7, z - 0.4, x + 0.4, y + 2.5, z + 0.4); D.addBox(D.active, b2);
      D.end();
    },

    /* Lo que distingue a cada tipo de pueblo */
    townLandmark(p, type, y, placed, free) {
      const R = p.r;
      // busca un hueco libre de w x d en el anillo exterior del pueblo
      const findSpot = (w, d, m) => {
        for (let i = 0; i < 40; i++) {
          const a = Math.PI / 4 + Math.floor(this.r() * 4) * Math.PI / 2 + this.rr(-0.35, 0.35);
          const dist = this.rr(p.plazaR + 12, R - Math.max(w, d) / 2 - 3);
          const cx = p.x + Math.cos(a) * dist, cz = p.z + Math.sin(a) * dist;
          const r = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
          if (free(r, m)) return r;
        }
        return null;
      };
      if (type === 'farm') {
        // granero, silo y campos de cultivo
        const r = findSpot(20, 14, 3);
        if (r) {
          placed.push(r);
          this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors: 2, pal: { wall: 0xa8322d, trim: 0xf2eee6, floor: 0x8b6b4a, roof: 0x4a3a32, stair: 0x9a7b5a },
            stairSide: 1, doorSide: 'zmin', outsideY: y, kind: 'house', interior: 'barn' });
          const sx = r[2] + 3.5, sz = (r[1] + r[3]) / 2;
          if (free([sx - 2.6, sz - 2.6, sx + 2.6, sz + 2.6], 0.5)) {
            placed.push([sx - 2.6, sz - 2.6, sx + 2.6, sz + 2.6]);
            D.begin({ name: 'Silo', mat: 'metal', hp: 400, yield: 10 });
            this.vgeo(this.tpl.cyl, M4().makeTranslation(sx, y, sz).multiply(M4().makeScale(2.4, 11, 2.4)), 0xc9ccd1, 0.03);
            this.vgeo(new THREE.ConeGeometry(2.6, 2.2, 14).translate(0, 1.1, 0).toNonIndexed(), M4().makeTranslation(sx, y + 11, sz), 0x8a2f24);
            const b = G.Phys.addBox(sx - 2.2, y, sz - 2.2, sx + 2.2, y + 12, sz + 2.2); D.addBox(D.active, b);
            D.end();
          }
        }
        for (let f = 0; f < 3; f++) {
          const fr = findSpot(this.rr(14, 20), this.rr(10, 14), 2);
          if (!fr) continue;
          placed.push(fr);
          const alongX = fr[2] - fr[0] > fr[3] - fr[1];
          const crop = this.pick([[0x6f9a3a, 0x8b6a45], [0xd9b84a, 0x9c7a4a], [0x4f8a35, 0x7a5a3c]]);
          let i = 0;
          for (let s = alongX ? fr[1] : fr[0]; s < (alongX ? fr[3] : fr[2]) - 0.5; s += 1.0, i++) {
            const c = crop[i % 2], hgt = i % 2 ? 0.06 : 0.35;
            if (alongX) this.vbox(fr[0], y, s, fr[2], y + hgt, s + 1.0, c, { noBottom: true, jitter: 0.04 });
            else this.vbox(s, y, fr[1], s + 1.0, y + hgt, fr[3], c, { noBottom: true, jitter: 0.04 });
          }
          // valla alrededor
          for (const [a, b, c, d] of [[fr[0], fr[1], fr[2], fr[1] + 0.1], [fr[0], fr[3] - 0.1, fr[2], fr[3]], [fr[0], fr[1], fr[0] + 0.1, fr[3]], [fr[2] - 0.1, fr[1], fr[2], fr[3]]]) {
            this.vbox(a, y + 0.6, b, c, y + 0.7, d, 0xc49a6c, { jitter: 0 });
          }
        }
        for (let i = 0; i < 6; i++) {
          const r = findSpot(1.6, 1.6, 1);
          if (!r) continue;
          const x = (r[0] + r[2]) / 2, z = (r[1] + r[3]) / 2;
          D.begin({ name: 'Paca de paja', mat: 'wood', hp: 60, yield: 5 });
          this.vgeo(this.tpl.hay, M4().makeTranslation(x, y, z), 0xe0c060, 0.05);
          const b = G.Phys.addBox(x - 0.7, y, z - 0.75, x + 0.7, y + 1.5, z + 0.75); D.addBox(D.active, b);
          D.end();
        }
      } else if (type === 'forest') {
        // aserradero: tejado sobre postes, una sierra y pilas de troncos
        const r = findSpot(16, 10, 3);
        if (r) {
          placed.push(r);
          D.begin({ name: 'Aserradero', mat: 'wood', hp: 400, yield: 12 });
          for (const px of [r[0] + 0.3, (r[0] + r[2]) / 2, r[2] - 0.6]) for (const pz of [r[1] + 0.3, r[3] - 0.6]) this.solid(px, y, pz, px + 0.3, y + 4.2, pz + 0.3, 0x6b4423, { noBottom: true });
          this.solid(r[0] - 0.5, y + 4.2, r[1] - 0.5, r[2] + 0.5, y + 4.5, r[3] + 0.5, 0x3d4a35);
          this.solid((r[0] + r[2]) / 2 - 3, y, (r[1] + r[3]) / 2 - 0.6, (r[0] + r[2]) / 2 + 3, y + 0.9, (r[1] + r[3]) / 2 + 0.6, 0x7a5a3c, { noBottom: true });
          this.vgeo(this.tpl.cyl, M4().makeTranslation((r[0] + r[2]) / 2, y + 0.9, (r[1] + r[3]) / 2).multiply(M4().makeRotationX(Math.PI / 2)).multiply(M4().makeScale(0.8, 0.05, 0.8)), 0xb8bcc2, 0);
          D.end();
        }
        for (let k = 0; k < 4; k++) {
          const lr = findSpot(6, 2.6, 1.5);
          if (!lr) continue;
          placed.push(lr);
          D.begin({ name: 'Troncos', mat: 'wood', hp: 200, yield: 12 });
          const cz = (lr[1] + lr[3]) / 2;
          for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
            const zz = cz - 0.9 + i * 0.6 + row * 0.3;
            this.vgeo(this.tpl.cyl, M4().makeTranslation(lr[0] + 0.3, y + 0.3 + row * 0.52, zz).multiply(M4().makeRotationZ(-Math.PI / 2)).multiply(M4().makeScale(0.3, 5.4, 0.3)), this.pick([0x8b5a2b, 0x7a4e2d, 0x9c6b45]), 0.05);
          }
          this.solid(lr[0] + 0.3, y, cz - 1.2, lr[2] - 0.3, y + 1.4, cz + 1.2, 0, { jitter: 0, noTop: true, noBottom: true, noX0: true, noX1: true, noZ0: true, noZ1: true });
          D.end();
        }
      } else if (type === 'harbor') {
        this.buildPier(p);
        for (let i = 0; i < 4; i++) {
          const r = findSpot(1.2, 1.2, 1);
          if (r) { const x = (r[0] + r[2]) / 2, z = (r[1] + r[3]) / 2; this.crate(x, y, z, this.rr(1.0, 1.3)); }
        }
      } else if (type === 'beach') {
        for (let i = 0; i < 10; i++) {
          const r = findSpot(2, 2, 1);
          if (!r) continue;
          const x = (r[0] + r[2]) / 2, z = (r[1] + r[3]) / 2;
          this.vbox(x - 0.06, y, z - 0.06, x + 0.06, y + 2.4, z + 0.06, 0xeeeeee, { noBottom: true });
          const um = M4().makeTranslation(x, y + 1.0, z).multiply(M4().makeScale(0.75, 0.18, 0.75));
          this.vgeo(this.tpl.ball, um, this.pick([0xff5d5d, 0xffd166, 0x4cc9f0, 0xff8fab]));
          if (this.r() < 0.5) this.vbox(x + 0.4, y, z - 0.3, x + 2.2, y + 0.4, z + 0.3, this.pick([0xffffff, 0x4cc9f0, 0xffd166]), { noBottom: true });
        }
      } else if (type === 'hill') {
        // torre mirador de madera con un cofre arriba (se sube construyendo)
        const r = findSpot(5, 5, 2);
        if (r) {
          placed.push(r);
          const x = (r[0] + r[2]) / 2, z = (r[1] + r[3]) / 2, top = y + 9;
          D.begin({ name: 'Mirador', mat: 'wood', hp: 400, yield: 12 });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.solid(x + sx * 2 - 0.15, y, z + sz * 2 - 0.15, x + sx * 2 + 0.15, top, z + sz * 2 + 0.15, 0x7a5232, { noBottom: true });
          this.solid(x - 2.4, top, z - 2.4, x + 2.4, top + 0.3, z + 2.4, 0x8b6a45);
          for (const [a, b, c, d] of [[-2.4, -2.4, 2.4, -2.3], [-2.4, 2.3, 2.4, 2.4], [-2.4, -2.4, -2.3, 2.4], [2.3, -2.4, 2.4, 2.4]]) this.solid(x + a, top + 0.3, z + b, x + c, top + 1.3, z + d, 0x7a5232, { noBottom: true });
          this.vbox(x - 2.7, top + 3.2, z - 2.7, x + 2.7, top + 3.45, z + 2.7, 0x8a2f24);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.vbox(x + sx * 2.2 - 0.08, top + 1.3, z + sz * 2.2 - 0.08, x + sx * 2.2 + 0.08, top + 3.2, z + sz * 2.2 + 0.08, 0x7a5232);
          D.end();
          this.chestSpots.push({ x, y: top + 0.3, z, rot: 0, noBot: true });
        }
      } else {
        // aldea: iglesia junto a la plaza
        const r = findSpot(12, 15, 3);
        if (r) {
          placed.push(r);
          const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
          const ddx = p.x - cx, ddz = p.z - cz;
          const door = Math.abs(ddx) > Math.abs(ddz) ? (ddx > 0 ? 'xmax' : 'xmin') : (ddz > 0 ? 'zmax' : 'zmin');
          this.building({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y + 0.25, floors: 1, stairSide: door === 'zmax' ? -1 : 1, doorSide: door, outsideY: y,
            pal: { wall: 0xe8dcc0, trim: 0x8a6a4a, floor: 0xb97a4f, roof: 0x6b3a2a, stair: 0xd8cfbf }, kind: 'house', mat: 'stone', wallHp: 220, interior: 'chapel' });
          // campanario en una esquina
          const tx = door === 'xmax' || door === 'xmin' ? (door === 'xmax' ? r[0] + 1.6 : r[2] - 1.6) : r[0] + 1.6;
          const tz = door === 'zmax' || door === 'zmin' ? (door === 'zmax' ? r[1] + 1.6 : r[3] - 1.6) : r[1] + 1.6;
          const H0 = y + 0.25 + G.CONFIG.floorHeight;
          D.begin({ name: 'Campanario', mat: 'stone', hp: 500, yield: 12 });
          this.solid(tx - 1.6, H0, tz - 1.6, tx + 1.6, H0 + 7, tz + 1.6, 0xe8dcc0);
          this.vbox(tx - 0.5, H0 + 5, tz - 1.65, tx + 0.5, H0 + 6.2, tz + 1.65, 0x2b2b2b);
          this.vbox(tx - 1.65, H0 + 5, tz - 0.5, tx + 1.65, H0 + 6.2, tz + 0.5, 0x2b2b2b);
          this.vgeo(this.tpl.roofCone, M4().makeTranslation(tx, H0 + 7 + 2.1, tz).multiply(M4().makeScale(0.32, 0.6, 0.32)), 0x6b3a2a);   // (el cono está centrado)
          D.end();
        }
      }
    },
  });
})();

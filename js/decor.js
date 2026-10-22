/* =====================================================================
   decor.js — Detalles que hacen la isla más bonita:
   - Fachadas: alféizares y dinteles en las ventanas, contraventanas y
     jardineras con flores en las casas, toldos, rótulos de tiendas y
     balcones (se puede salir a ellos por la ventana) en la ciudad.
   - Tejados: antenas, parabólicas, casetas, chimeneas y vallas
     publicitarias con anuncios.
   - Calles: farolas, semáforos, bocas de incendio y papeleras.
   - Coches de varios tipos (turismo, utilitario, furgoneta y pickup).
   Casi todo es rompible y va en el mismo grupo que la pared que lo
   sostiene: si rompes el panel, su balcón o su toldo se rompe con él.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const W = G.World, D = G.Destruct;

  const AWNINGS = [0xd62828, 0x2a9d8f, 0xf4a261, 0x3a86ff, 0x6a994e, 0x9d4edd];
  const SIGNS = [0x1d3557, 0x7a2e22, 0x2f5d50, 0x3d405b, 0xb5523b];
  const SHUTTERS = [0x2f6fb5, 0x3f8f5a, 0x8f3b2b, 0x5a3a22, 0x2a9d8f, 0x6d597a];
  const FLOWERS = [0xe63946, 0xffd166, 0xff8fab, 0xffffff, 0x9d4edd, 0xf77f00];
  const ADS = [
    ['ISLA COLA', '¡Refresca tu victoria!', '#d62828', '#ffd166'],
    ['PIZZA TORRES', 'Recién salida del horno', '#f4a261', '#3a1a0a'],
    ['SURF CORAL', 'Las mejores olas de la isla', '#0096c7', '#ffffff'],
    ['BURGER BUS', 'Salta y come', '#ffb703', '#7a2e22'],
    ['TELE ROYALE', 'Esta noche: ¡la gran final!', '#5a189a', '#ffffff'],
    ['HELADOS POLO', '¡Fríos de verdad!', '#ff8fab', '#ffffff'],
  ];
  const M4 = () => new THREE.Matrix4();

  Object.assign(W, {
    /* ---------- Fachadas ---------- */
    // Estilo de los adornos de un edificio (igual en todas sus paredes)
    facadeStyle(city, pal) {
      if (city) {
        return { trim: pal.trim, awning: this.r() < 0.55 ? this.pick(AWNINGS) : null, balcony: 0.18, sign: this.r() < 0.6 ? this.pick(SIGNS) : null };
      }
      return { trim: pal.trim, shutter: this.r() < 0.7 ? this.pick(SHUTTERS) : null, flowers: true };
    },

    /* Adornos de las ventanas y puertas de un panel de pared (sólo en la cara de fuera).
       d.out = hacia qué lado está la calle (-1 / +1) · d.upper = no es la planta baja */
    panelDeco(axis, ops, c0, c1, last, f0, f1, y0, d) {
      const out = d.out, fe = out < 0 ? f0 : f1;
      // caja pegada a la fachada: p = a lo largo de la pared, q = altura, u = hacia fuera
      const bx = (p0, p1, q0, q1, u0, u1, col, solid) => {
        const fa = fe + out * u0, fb = fe + out * u1, F0 = Math.min(fa, fb), F1 = Math.max(fa, fb);
        const fn = solid ? this.solid : this.vbox;
        if (axis === 'x') fn.call(this, p0, q0, F0, p1, q1, F1, col, { jitter: 0.02 });
        else fn.call(this, F0, q0, p0, F1, q1, p1, col, { jitter: 0.02 });
      };
      for (const op of ops) {
        const c = (op.a + op.b) / 2;
        if (c < c0 || c > c1 || (c === c1 && !last)) continue;
        if (op.oy0 <= y0 + 0.01) {
          // puerta: marco y, en la ciudad, rótulo de tienda encima
          bx(op.a - 0.16, op.b + 0.16, op.oy1, op.oy1 + 0.22, -0.02, 0.12, d.trim);
          bx(op.a - 0.16, op.a - 0.02, y0, op.oy1, -0.02, 0.1, d.trim);
          bx(op.b + 0.02, op.b + 0.16, y0, op.oy1, -0.02, 0.1, d.trim);
          if (d.sign) {
            bx(op.a - 0.7, op.b + 0.7, op.oy1 + 0.3, op.oy1 + 0.8, 0.02, 0.12, d.sign);
            bx(op.a - 0.45, op.b + 0.45, op.oy1 + 0.45, op.oy1 + 0.65, 0.12, 0.14, 0xfff3c4);
          }
          continue;
        }
        // ventana: alféizar y dintel
        bx(op.a - 0.12, op.b + 0.12, op.oy0 - 0.1, op.oy0 + 0.02, -0.02, 0.17, d.trim);
        bx(op.a - 0.1, op.b + 0.1, op.oy1 - 0.02, op.oy1 + 0.13, -0.02, 0.1, d.trim);
        if (d.shutter) {
          const busy = (x) => ops.some((o2) => o2 !== op && x > o2.a - 0.15 && x < o2.b + 0.15);
          if (!busy(op.a - 0.35)) bx(op.a - 0.62, op.a - 0.06, op.oy0 + 0.05, op.oy1 - 0.05, 0, 0.06, d.shutter);
          if (!busy(op.b + 0.35)) bx(op.b + 0.06, op.b + 0.62, op.oy0 + 0.05, op.oy1 - 0.05, 0, 0.06, d.shutter);
        }
        if (d.flowers && this.r() < 0.45) {
          bx(op.a + 0.05, op.b - 0.05, op.oy0 - 0.4, op.oy0 - 0.1, 0.02, 0.32, 0x7a4a26);
          const fc = this.pick(FLOWERS);
          for (let t = op.a + 0.12; t < op.b - 0.25; t += 0.3) bx(t, t + 0.2, op.oy0 - 0.12, op.oy0 + 0.1, 0.07, 0.27, this.r() < 0.6 ? fc : 0x3f8a32);
        }
        if (d.upper && d.balcony && this.r() < d.balcony) {
          // balcón: suelo y barandilla (sólidos: se puede salir por la ventana)
          const p0 = op.a - 0.5, p1 = op.b + 0.5;
          bx(p0, p1, y0 - 0.22, y0 + 0.02, 0, 1.15, d.trim, true);
          bx(p0, p1, y0 + 0.02, y0 + 1.0, 1.05, 1.15, d.trim, true);
          bx(p0, p0 + 0.1, y0 + 0.02, y0 + 1.0, 0, 1.05, d.trim, true);
          bx(p1 - 0.1, p1, y0 + 0.02, y0 + 1.0, 0, 1.05, d.trim, true);
          if (this.r() < 0.6) {
            const fc = this.pick(FLOWERS);
            bx(p0 + 0.2, p0 + 0.7, y0 + 0.02, y0 + 0.4, 0.3, 0.8, 0xc0623a);
            bx(p0 + 0.25, p0 + 0.65, y0 + 0.4, y0 + 0.7, 0.35, 0.75, this.r() < 0.5 ? fc : 0x3f8a32);
          }
        } else if (!d.upper && d.awning) {
          // toldo de rayas en la planta baja
          for (let i = 0; i < 3; i++) bx(op.a - 0.3, op.b + 0.3, op.oy1 + 0.42 - i * 0.12, op.oy1 + 0.54 - i * 0.12, i * 0.38, (i + 1) * 0.38 + 0.02, i % 2 ? 0xf4f1ea : d.awning);
          bx(op.a - 0.3, op.b + 0.3, op.oy1 + 0.02, op.oy1 + 0.24, 1.1, 1.16, new THREE.Color(d.awning).multiplyScalar(0.72).getHex());
        }
      }
    },

    /* ---------- Tejados ---------- */
    roofDeco(x0, z0, x1, z1, ry, city, pal, doorSide) {
      const cx = (x0 + x1) / 2;
      if (city) {
        if (this.r() < 0.6) this.antenna(x1 - 1.1, z1 - 1.1, ry);
        if (this.r() < 0.45) this.dish(x0 + 1.4, z1 - 1.4, ry);
        if (this.r() < 0.4) {
          // caseta de la escalera del tejado
          D.begin({ name: 'Caseta', mat: 'stone', hp: 220, yield: 7 });
          this.solid(x1 - 3.4, ry, z0 + 0.8, x1 - 0.8, ry + 2.4, z0 + 3.2, pal.trim, { noBottom: true });
          this.vbox(x1 - 2.6, ry, z0 + 3.2, x1 - 1.6, ry + 2.0, z0 + 3.25, 0x5a4a3a, { jitter: 0 });
          this.vbox(x1 - 3.5, ry + 2.4, z0 + 0.7, x1 - 0.7, ry + 2.55, z0 + 3.3, 0x55524e, {});
          D.end();
        }
        // valla publicitaria mirando a la calle
        if (x1 - x0 >= 14 && this.r() < 0.25) {
          const front = this.r() < 0.5 ? -1 : 1;
          const w = Math.min(10, x1 - x0 - 3), h = 3.4, zb = front < 0 ? z0 + 1.4 : z1 - 1.4;
          const g = D.begin({ name: 'Valla publicitaria', mat: 'metal', hp: 240, yield: 8 });
          for (const px of [cx - w / 2 + 0.6, cx + w / 2 - 0.6]) this.solid(px - 0.1, ry, zb - 0.1, px + 0.1, ry + 2.2, zb + 0.1, 0x3a3d42, { noBottom: true });
          this.solid(cx - w / 2 - 0.15, ry + 2.1, zb - 0.12, cx + w / 2 + 0.15, ry + 2.2 + h + 0.15, zb + 0.12, 0x2b2f36, {});
          D.end();
          this.billboards.push({ x: cx, y: ry + 2.2 + h / 2 + 0.03, z: zb + front * 0.13, ry: front < 0 ? Math.PI : 0, w, h, ad: (this.billboards.length + this.ri(0, 5)) % ADS.length, g });
        }
      } else {
        if (this.r() < 0.6) {
          const chx = this.r() < 0.5 ? x0 + 1.4 : x1 - 2.2, chz = this.rr(z0 + 1.4, z1 - 2.2);
          D.begin({ name: 'Chimenea', mat: 'stone', hp: 120, yield: 5 });
          this.solid(chx, ry, chz, chx + 0.8, ry + 1.8, chz + 0.8, 0x9c4a3a, { noBottom: true });
          this.vbox(chx - 0.08, ry + 1.8, chz - 0.08, chx + 0.88, ry + 1.95, chz + 0.88, 0x4a3a32, {});
          D.end();
        }
        if (this.r() < 0.3) this.antenna(x1 - 1.0, z0 + 1.0, ry, 2.2);
      }
    },

    antenna(x, z, y, hgt) {
      const h = hgt || this.rr(3.2, 5);
      D.begin({ name: 'Antena', mat: 'metal', hp: 60, yield: 3 });
      this.solid(x - 0.05, y, z - 0.05, x + 0.05, y + h, z + 0.05, 0x8a9097, { noBottom: true });
      for (let i = 1; i <= 3; i++) {
        const yy = y + h - i * 0.55, w = 0.25 + i * 0.12;
        this.vbox(x - w, yy, z - 0.025, x + w, yy + 0.05, z + 0.025, 0x8a9097, { jitter: 0 });
      }
      this.vbox(x - 0.07, y + h, z - 0.07, x + 0.07, y + h + 0.12, z + 0.07, 0xff3b30, { jitter: 0 });
      D.end();
    },

    dish(x, z, y) {
      D.begin({ name: 'Parabólica', mat: 'metal', hp: 80, yield: 4 });
      this.solid(x - 0.08, y, z - 0.08, x + 0.08, y + 0.9, z + 0.08, 0x6b737c, { noBottom: true });
      const m = M4().makeTranslation(x, y + 1.2, z).multiply(M4().makeRotationY(this.rr(0, 6.28))).multiply(M4().makeRotationX(-1.0)).multiply(M4().makeScale(0.75, 0.75, 0.75));
      this.vgeo(this.tpl.dish, m, 0xe8eaec, 0.02);
      D.end();
    },

    /* ---------- Calles de la ciudad ---------- */
    cityFurniture(S, SW, L) {
      const y = L + 0.14;
      for (let bi = 0; bi < 5; bi++) {
        for (let bj = 0; bj < 5; bj++) {
          const bx0 = S[bi] + SW / 2, bx1 = S[bi + 1] - SW / 2, bz0 = S[bj] + SW / 2, bz1 = S[bj + 1] - SW / 2;
          // farolas en los 4 bordes de la manzana, con el brazo hacia la calle
          for (const t of [0.3, 0.7]) {
            const xa = U.lerp(bx0, bx1, t), za = U.lerp(bz0, bz1, t);
            this.streetLamp(xa, bz0 + 0.6, y, 0, -1);
            this.streetLamp(xa, bz1 - 0.6, y, 0, 1);
            this.streetLamp(bx0 + 0.6, za, y, -1, 0);
            this.streetLamp(bx1 - 0.6, za, y, 1, 0);
          }
          // una boca de incendio y una papelera en bordes al azar
          const edge = (inset) => {
            const s = this.ri(0, 3), t = this.rr(0.4, 0.6);
            if (s === 0) return [U.lerp(bx0, bx1, t), bz0 + inset];
            if (s === 1) return [U.lerp(bx0, bx1, t), bz1 - inset];
            if (s === 2) return [bx0 + inset, U.lerp(bz0, bz1, t)];
            return [bx1 - inset, U.lerp(bz0, bz1, t)];
          };
          const [hx, hz] = edge(0.55);
          this.hydrant(hx, hz, y);
          const [qx, qz] = edge(0.6);
          this.bin(qx, qz, y);
        }
      }
      // semáforos en dos esquinas de cada cruce
      for (const sx of S) {
        for (const sz of S) {
          for (const d of [1, -1]) {
            const x = sx + d * (SW / 2 + 0.55), z = sz + d * (SW / 2 + 0.55);
            if (Math.abs(x) > 104 || Math.abs(z) > 104) continue;
            this.trafficLight(x, z, y);
          }
        }
      }
    },

    streetLamp(x, z, y, dx, dz) {
      D.begin({ name: 'Farola', mat: 'metal', hp: 90, yield: 4 });
      this.solid(x - 0.08, y, z - 0.08, x + 0.08, y + 4.6, z + 0.08, 0x2f3a44, { noBottom: true });
      this.vbox(x - 0.15, y, z - 0.15, x + 0.15, y + 0.5, z + 0.15, 0x2f3a44, { noBottom: true });
      const ex = x + dx * 1.3, ez = z + dz * 1.3;
      this.vbox(Math.min(x, ex) - 0.05, y + 4.5, Math.min(z, ez) - 0.05, Math.max(x, ex) + 0.05, y + 4.6, Math.max(z, ez) + 0.05, 0x2f3a44, {});
      this.vbox(ex - 0.26, y + 4.36, ez - 0.26, ex + 0.26, y + 4.56, ez + 0.26, 0x2f3a44, {});
      this.vbox(ex - 0.2, y + 4.3, ez - 0.2, ex + 0.2, y + 4.37, ez + 0.2, 0xfff2b0, { jitter: 0 });
      D.end();
    },

    trafficLight(x, z, y) {
      D.begin({ name: 'Semáforo', mat: 'metal', hp: 90, yield: 4 });
      this.solid(x - 0.07, y, z - 0.07, x + 0.07, y + 2.5, z + 0.07, 0x30343a, { noBottom: true });
      this.solid(x - 0.2, y + 2.4, z - 0.2, x + 0.2, y + 3.4, z + 0.2, 0x1d2126, {});
      const on = this.ri(0, 2);
      const cols = [[0xff3b30, 0x4a1a18], [0xffb703, 0x4a3a10], [0x2bd56a, 0x123a20]];
      cols.forEach(([lit, off], i) => {
        const c = i === on ? lit : off, yy = y + 3.15 - i * 0.3;
        this.vbox(x + 0.2, yy - 0.08, z - 0.08, x + 0.23, yy + 0.08, z + 0.08, c, { jitter: 0 });
        this.vbox(x - 0.23, yy - 0.08, z - 0.08, x - 0.2, yy + 0.08, z + 0.08, c, { jitter: 0 });
        this.vbox(x - 0.08, yy - 0.08, z + 0.2, x + 0.08, yy + 0.08, z + 0.23, c, { jitter: 0 });
        this.vbox(x - 0.08, yy - 0.08, z - 0.23, x + 0.08, yy + 0.08, z - 0.2, c, { jitter: 0 });
      });
      D.end();
    },

    hydrant(x, z, y) {
      D.begin({ name: 'Boca de incendio', mat: 'metal', hp: 60, yield: 3 });
      this.vgeo(this.tpl.cyl, M4().makeTranslation(x, y, z).multiply(M4().makeScale(0.16, 0.65, 0.16)), 0xd62828, 0.03);
      this.vgeo(this.tpl.gball, M4().makeTranslation(x, y + 0.66, z).multiply(M4().makeScale(0.17, 0.12, 0.17)), 0xb3202a, 0.03);
      this.vbox(x - 0.26, y + 0.38, z - 0.06, x + 0.26, y + 0.5, z + 0.06, 0xb3202a, {});
      D.addBox(D.active, G.Phys.addBox(x - 0.18, y, z - 0.18, x + 0.18, y + 0.75, z + 0.18));
      D.end();
    },

    bin(x, z, y) {
      D.begin({ name: 'Papelera', mat: 'metal', hp: 50, yield: 3 });
      this.solid(x - 0.25, y, z - 0.25, x + 0.25, y + 0.85, z + 0.25, 0x2b9348, { noBottom: true });
      this.vbox(x - 0.28, y + 0.85, z - 0.28, x + 0.28, y + 0.92, z + 0.28, 0x1d5f30, {});
      D.end();
    },

    /* ---------- Vallas publicitarias (anuncios dibujados con código) ---------- */
    adGeometry() { return (this._adGeo = this._adGeo || new THREE.PlaneGeometry(1, 1)); },
    adMaterial(i) {
      this._adMats = this._adMats || [];
      if (this._adMats[i]) return this._adMats[i];
      const [title, sub, bg, fg] = ADS[i % ADS.length];
      const c = document.createElement('canvas');
      c.width = 512; c.height = 256;
      const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 512, 256);
      gr.addColorStop(0, bg);
      gr.addColorStop(1, '#' + new THREE.Color(bg).multiplyScalar(0.6).getHexString());
      x.fillStyle = gr;
      x.fillRect(0, 0, 512, 256);
      // rayos de fondo
      x.globalAlpha = 0.12;
      x.fillStyle = '#ffffff';
      for (let k = 0; k < 12; k++) {
        x.beginPath(); x.moveTo(420, 200);
        x.arc(420, 200, 520, (k * Math.PI) / 6, (k * Math.PI) / 6 + 0.22);
        x.closePath(); x.fill();
      }
      x.globalAlpha = 1;
      x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,0.85)'; x.strokeRect(8, 8, 496, 240);
      x.textAlign = 'center';
      x.font = '900 64px Impact, "Arial Black", sans-serif';
      x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.strokeText(title, 256, 128);
      x.fillStyle = fg; x.fillText(title, 256, 128);
      x.font = 'bold 28px Arial, sans-serif';
      x.fillStyle = fg; x.fillText(sub, 256, 186);
      const tex = new THREE.CanvasTexture(c);
      this._adMats[i] = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x222222 });
      return this._adMats[i];
    },

    /* ---------- Coches ----------
       alongZ = el coche va a lo largo de Z. Hay turismos, utilitarios, furgonetas y pickups,
       con cristales, faros, pilotos, parachoques, matrículas, retrovisores y ruedas redondas. */
    car(x, z, y, alongZ, color) {
      D.begin({ name: 'Coche', mat: 'metal', hp: 300, yield: 9 });
      const fw = this.r() < 0.5 ? 1 : -1;     // hacia dónde mira el morro
      const type = this.pick(['turismo', 'turismo', 'turismo', 'utilitario', 'furgoneta', 'pickup']);
      // l = a lo largo (morro hacia +l), s = de lado
      const P = (l, sv) => (alongZ ? [x + sv, z + l * fw] : [x + l * fw, z + sv]);
      const B = (l0, y0, s0, l1, y1, s1, col, solid) => {
        const [ax, az] = P(l0, s0), [bx, bz] = P(l1, s1);
        const fn = solid ? this.solid : this.vbox;
        fn.call(this, Math.min(ax, bx), y + y0, Math.min(az, bz), Math.max(ax, bx), y + y1, Math.max(az, bz), col, { jitter: 0.02 });
      };
      const glass = 0x22313d, dark = 0x1c1f24, chrome = 0xc9cfd6, plate = 0xf4f4f4;
      const sym = (fn) => { fn(-1); fn(1); };
      let L, Wd, wheelL;
      if (type === 'furgoneta') {
        L = 2.45; Wd = 1.0; wheelL = 1.55;
        B(-L, 0.32, -Wd, L, 2.1, Wd, color, true);
        B(-1.9, 1.35, -Wd - 0.01, L - 0.45, 1.85, Wd + 0.01, glass);
        B(L, 1.25, -0.85, L + 0.03, 1.95, 0.85, glass);
        B(-L + 0.4, 0.75, -Wd - 0.015, L - 0.6, 0.95, Wd + 0.015, 0xf4f1ea);
        B(-L - 0.03, 1.0, -0.8, -L, 1.9, 0.8, new THREE.Color(color).multiplyScalar(0.8).getHex());
      } else if (type === 'pickup') {
        L = 2.4; Wd = 0.97; wheelL = 1.5;
        B(0.2, 0.32, -Wd, L, 1.0, Wd, color, true);
        B(0.2, 1.0, -0.9, 1.4, 1.65, 0.9, color, true);
        B(0.18, 1.05, -0.915, 1.42, 1.55, 0.915, glass);
        B(-L, 0.32, -Wd, 0.2, 0.62, Wd, color, true);
        B(-L, 0.62, -Wd, 0.2, 1.08, -Wd + 0.12, color, true);
        B(-L, 0.62, Wd - 0.12, 0.2, 1.08, Wd, color, true);
        B(-L, 0.62, -Wd, -L + 0.12, 1.08, Wd, color, true);
        if (this.r() < 0.6) B(-1.6, 0.62, -0.5, -0.6, 1.1, 0.5, 0xa0743f, true);   // carga
      } else {
        const small = type === 'utilitario';
        L = small ? 1.9 : 2.25; Wd = small ? 0.88 : 0.95; wheelL = small ? 1.2 : 1.38;
        const cb0 = small ? -1.35 : -1.15, cb1 = small ? 0.7 : 0.95, top = small ? 1.6 : 1.56;
        B(-L, 0.32, -Wd, L, 0.95, Wd, color, true);
        B(cb0, 0.95, -Wd + 0.08, cb1, top, Wd - 0.08, color, true);
        B(cb0 - 0.02, 1.0, -Wd + 0.065, cb1 + 0.02, top - 0.08, Wd - 0.065, glass);
        B(-0.15, 1.0, -Wd + 0.06, -0.05, top - 0.08, Wd - 0.06, color);                 // pilar central
        sym((s) => B(cb1 - 0.1, 1.0, s * (Wd - 0.06) - 0.03, cb1 + 0.03, top - 0.08, s * (Wd - 0.06) + 0.03, color));
        B(-0.12, 0.4, -Wd - 0.006, -0.09, 0.92, Wd + 0.006, dark);                       // línea de las puertas
        sym((s) => B(0.3, 0.8, s * (Wd + 0.004) - 0.02, 0.5, 0.85, s * (Wd + 0.004) + 0.02, chrome)); // tiradores
        sym((s) => B(cb1 - 0.25, 1.02, s * (Wd + 0.14) - 0.06, cb1 - 0.1, 1.14, s * (Wd + 0.14) + 0.06, color)); // retrovisores
      }
      // parachoques, calandra, faros, pilotos y matrículas
      B(L, 0.28, -Wd + 0.03, L + 0.1, 0.52, Wd - 0.03, dark);
      B(-L - 0.1, 0.28, -Wd + 0.03, -L, 0.52, Wd - 0.03, dark);
      B(L, 0.55, -0.42, L + 0.03, 0.8, 0.42, dark);
      sym((s) => B(L, 0.62, s * (Wd - 0.1) - 0.15, L + 0.03, 0.82, s * (Wd - 0.1) + 0.15, 0xfff6c8));
      sym((s) => B(-L - 0.03, 0.64, s * (Wd - 0.1) - 0.14, -L, 0.84, s * (Wd - 0.1) + 0.14, 0xe63946));
      B(L + 0.1, 0.33, -0.2, L + 0.11, 0.48, 0.2, plate);
      B(-L - 0.11, 0.33, -0.2, -L - 0.1, 0.48, 0.2, plate);
      // pasos de rueda y ruedas (cilindros con tapacubos)
      const rot = alongZ ? M4().makeRotationZ(Math.PI / 2) : M4().makeRotationX(Math.PI / 2);
      for (const l of [-wheelL, wheelL]) {
        B(l - 0.5, 0.3, -Wd - 0.01, l + 0.5, 0.78, Wd + 0.01, dark);
        for (const s of [-1, 1]) {
          const [wx, wz] = P(l, s * (Wd - 0.1));
          this.vgeo(this.tpl.cylC, M4().makeTranslation(wx, y + 0.36, wz).multiply(rot).multiply(M4().makeScale(0.36, 0.26, 0.36)), 0x18181a, 0.02);
          this.vgeo(this.tpl.cylC, M4().makeTranslation(wx, y + 0.36, wz).multiply(rot).multiply(M4().makeScale(0.2, 0.28, 0.2)), chrome, 0.02);
        }
      }
      D.end();
    },
  });
})();

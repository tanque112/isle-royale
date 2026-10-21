/* =====================================================================
   models.js — Modelos 3D hechos con cajas: personajes, armas, pico,
   munición, curas, materiales, cofres, piezas de construcción y el
   autobús volador. Cada parte del personaje es UNA sola malla (más rápido).
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, C = G.CONFIG;

  const matCache = new Map();
  function mat(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
      matCache.set(key, m);
    }
    return m;
  }

  const PALETTES = [
    { shirt: 0xe63946, pants: 0x1d3557, skin: 0xf1c27d, hair: 0x3b2314, shoes: 0x222222, pack: 0x457b9d },
    { shirt: 0x2a9d8f, pants: 0x264653, skin: 0xc68642, hair: 0x111111, shoes: 0xeeeeee, pack: 0xe9c46a },
    { shirt: 0xf4a261, pants: 0x3d405b, skin: 0xffdbac, hair: 0xd4a017, shoes: 0x333333, pack: 0x81b29a },
    { shirt: 0x8338ec, pants: 0x222222, skin: 0x8d5524, hair: 0x111111, shoes: 0xffbe0b, pack: 0x3a86ff },
    { shirt: 0x06d6a0, pants: 0x073b4c, skin: 0xe0ac69, hair: 0x6b3e26, shoes: 0x111111, pack: 0xef476f },
    { shirt: 0xffbe0b, pants: 0x5a189a, skin: 0xf1c27d, hair: 0xe85d04, shoes: 0x222222, pack: 0x3a0ca3 },
    { shirt: 0x90be6d, pants: 0x4d4d4d, skin: 0xffdbac, hair: 0x2b2b2b, shoes: 0x7f4f24, pack: 0x577590 },
    { shirt: 0xff006e, pants: 0x14213d, skin: 0xc68642, hair: 0xfca311, shoes: 0xe5e5e5, pack: 0x8ecae6 },
    { shirt: 0x4361ee, pants: 0xf1faee, skin: 0x8d5524, hair: 0x111111, shoes: 0x1d3557, pack: 0xf72585 },
    { shirt: 0x6d6875, pants: 0x355070, skin: 0xe0ac69, hair: 0x9b2226, shoes: 0x222222, pack: 0xe56b6f },
  ];
  // Con muchos bots hacen falta más "ropas": se mezclan colores para crear 30 más
  (function morePalettes() {
    const shirts = [0xd62828, 0x3a86ff, 0xfb8500, 0x2b9348, 0x9d4edd, 0xffd60a, 0x00b4d8, 0xef476f, 0x8d99ae, 0x6a994e, 0xbc6c25, 0xf15bb5];
    const pants = [0x1d3557, 0x283618, 0x3d405b, 0x222222, 0x5e503f, 0x14213d, 0x6c757d, 0x4a4e69];
    const skins = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac, 0xe0ac69];
    const hairs = [0x111111, 0x3b2314, 0xd4a017, 0x9b2226, 0x6b3e26, 0xe85d04, 0x2b2b2b];
    const packs = [0x457b9d, 0xe9c46a, 0x81b29a, 0xf72585, 0x3a0ca3, 0xffbe0b, 0x2a9d8f];
    for (let i = 0; i < 30; i++) {
      PALETTES.push({
        shirt: shirts[(i * 5 + 1) % shirts.length], pants: pants[(i * 3 + 2) % pants.length],
        skin: skins[(i * 2 + 1) % skins.length], hair: hairs[(i * 3) % hairs.length],
        shoes: i % 3 ? 0x222222 : 0xeeeeee, pack: packs[(i * 4 + 3) % packs.length],
      });
    }
  })();

  const O = { jitter: 0 };
  const partCache = new WeakMap();
  const T4 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const sx = (s, a, b) => [Math.min(s * a, s * b), Math.max(s * a, s * b)];   // tramo en X a la izquierda o la derecha

  /* Complementos de las skins, en coordenadas de la cabeza (de y = 0 a 0,4; la cara mira hacia -Z).
     pal.acc1 / pal.acc2 = sus colores */
  const HIDE_HAIR = { hood: true, knight: true, astro: true, mohawk: true, luchador: true, diver: true, football: true, samurai: true, pumpkin: true };
  function accessory(h, acc, pal) {
    const a1 = pal.acc1 !== undefined ? pal.acc1 : 0x333333, a2 = pal.acc2 !== undefined ? pal.acc2 : 0x111111;
    const bx = (x0, y0, z0, x1, y1, z1, c) => h.box(x0, y0, z0, x1, y1, z1, c, O);
    switch (acc) {
      case 'cap':
        bx(-0.218, 0.34, -0.218, 0.218, 0.5, 0.218, a1);
        bx(-0.17, 0.34, -0.42, 0.17, 0.38, -0.2, a2);
        bx(-0.03, 0.5, -0.03, 0.03, 0.53, 0.03, a2);
        break;
      case 'sunglasses':
        bx(-0.212, 0.2, -0.232, 0.212, 0.23, -0.205, a1);
        bx(-0.18, 0.15, -0.24, -0.025, 0.27, -0.226, a2);
        bx(0.025, 0.15, -0.24, 0.18, 0.27, -0.226, a2);
        break;
      case 'cowboy':
        bx(-0.38, 0.4, -0.38, 0.38, 0.44, 0.38, a1);
        bx(-0.2, 0.44, -0.2, 0.2, 0.68, 0.2, a1);
        bx(-0.205, 0.44, -0.205, 0.205, 0.5, 0.205, a2);
        break;
      case 'hood':
        // capucha redonda con una franja para los ojos y una cinta
        sph(h, 0.226, 0, 0.21, 0, a1, 1.06, 1, 16);
        bx(-0.17, 0.16, -0.24, 0.17, 0.29, -0.2, pal.skin);
        for (const s2 of [-1, 1]) {
          const [w0, w1] = sx(s2, 0.045, 0.125);
          bx(w0, 0.185, -0.246, w1, 0.265, -0.236, 0xffffff);
          const [p0, p1] = sx(s2, 0.06, 0.1);
          bx(p0, 0.195, -0.25, p1, 0.255, -0.244, 0x111111);
        }
        h.geometry(new THREE.TorusGeometry(0.226, 0.026, 6, 22).rotateX(Math.PI / 2), T4(0, 0.34, 0), a2);
        bx(-0.04, 0.3, 0.21, 0.04, 0.37, 0.42, a2);
        break;
      case 'pirate':
        bx(-0.22, 0.3, -0.22, 0.22, 0.47, 0.22, a1);
        bx(-0.06, 0.27, 0.22, 0.06, 0.38, 0.34, a1);
        bx(-0.222, 0.265, -0.224, 0.222, 0.285, 0.224, a2);
        bx(0.04, 0.15, -0.236, 0.15, 0.27, -0.215, a2);
        break;
      case 'knight':
        bx(-0.238, -0.03, -0.238, 0.238, 0.5, 0.238, a1);
        bx(-0.18, 0.2, -0.248, 0.18, 0.25, -0.238, 0x111111);
        for (const x of [-0.08, 0, 0.08]) bx(x - 0.015, 0.08, -0.246, x + 0.015, 0.15, -0.238, 0x111111);
        bx(-0.03, 0.5, -0.24, 0.03, 0.56, 0.24, a1);
        bx(-0.035, 0.52, -0.05, 0.035, 0.76, 0.28, a2);
        break;
      case 'viking':
        bx(-0.226, 0.3, -0.226, 0.226, 0.5, 0.226, a1);
        bx(-0.232, 0.3, -0.232, 0.232, 0.35, 0.232, 0x8a6a3a);
        for (const s of [-1, 1]) {
          const [p0, p1] = sx(s, 0.22, 0.34), [q0, q1] = sx(s, 0.3, 0.38), [r0, r1] = sx(s, 0.2, 0.26);
          bx(p0, 0.36, -0.05, p1, 0.44, 0.05, a2);
          bx(q0, 0.44, -0.04, q1, 0.64, 0.04, a2);
          bx(r0, -0.02, 0.02, r1, 0.3, 0.1, pal.hair);
        }
        bx(-0.16, -0.08, -0.232, 0.16, 0.14, -0.2, pal.hair);
        break;
      case 'astro':
        // casco esférico con visera oscura, un reflejo y una antena
        sph(h, 0.27, 0, 0.22, 0, a1, 1.0, 1, 16);
        sph(h, 0.2, 0, 0.22, -0.1, a2, 0.75, 0.9, 14);
        sph(h, 0.04, -0.09, 0.3, -0.272, 0x8fb6ff, 1, 0.4, 6);
        bx(0.16, 0.45, 0.02, 0.19, 0.66, 0.05, 0x9aa4ae);
        bx(0.15, 0.66, 0.01, 0.2, 0.71, 0.06, 0xff4040);
        break;
      case 'crown':
        bx(-0.222, 0.42, -0.222, 0.222, 0.5, 0.222, a1);
        for (const [x, z] of [[-0.19, -0.19], [0, -0.19], [0.19, -0.19], [-0.19, 0.19], [0, 0.19], [0.19, 0.19], [-0.19, 0], [0.19, 0]]) bx(x - 0.03, 0.5, z - 0.03, x + 0.03, 0.62, z + 0.03, a1);
        bx(-0.045, 0.43, -0.234, 0.045, 0.49, -0.222, a2);
        break;
      case 'headphones':
        bx(-0.25, 0.46, -0.04, 0.25, 0.53, 0.04, a2);
        for (const s of [-1, 1]) {
          const [p0, p1] = sx(s, 0.2, 0.29), [q0, q1] = sx(s, 0.2, 0.25);
          bx(p0, 0.1, -0.1, p1, 0.33, 0.1, a1);
          bx(q0, 0.33, -0.03, q1, 0.48, 0.03, a2);
        }
        break;
      case 'wizard':
        bx(-0.34, 0.42, -0.34, 0.34, 0.46, 0.34, a1);
        h.geometry(new THREE.ConeGeometry(0.25, 0.62, 8), T4(0, 0.46 + 0.31, 0), a1);
        bx(-0.25, 0.46, -0.25, 0.25, 0.52, 0.25, a2);
        bx(-0.15, -0.22, -0.232, 0.15, 0.16, -0.2, 0xe8e8e8);
        break;
      // ---- complementos nuevos ----
      case 'chef':
        bx(-0.215, 0.32, -0.215, 0.215, 0.42, 0.215, a1);
        sph(h, 0.25, 0, 0.56, 0, a1, 0.62, 1, 10);
        break;
      case 'hardhat':
        sph(h, 0.235, 0, 0.34, 0, a1, 0.62, 1.02, 12);
        bx(-0.27, 0.32, -0.32, 0.27, 0.345, 0.27, a1);
        bx(-0.025, 0.36, -0.235, 0.025, 0.5, 0.235, a2);
        break;
      case 'beanie':
        sph(h, 0.228, 0, 0.3, 0, a1, 0.78, 1, 12);
        bx(-0.232, 0.27, -0.232, 0.232, 0.34, 0.232, a2);
        sph(h, 0.075, 0, 0.5, 0, a2, 1, 1, 8);
        break;
      case 'beret':
        sph(h, 0.25, 0.03, 0.41, 0.02, a1, 0.26, 1, 12);
        bx(-0.012, 0.46, -0.012, 0.012, 0.5, 0.012, a1);
        break;
      case 'mohawk':
        // pelo rapado: sólo la parte de arriba de la cabeza (no tapa la cara)
        h.geometry(new THREE.SphereGeometry(0.212, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), T4(0, 0.2, 0.004).multiply(new THREE.Matrix4().makeScale(1, 1.08, 1.02)), pal.hair);
        for (let i = 0; i < 7; i++) {
          const z0 = -0.2 + i * 0.062, top = 0.52 + Math.sin((i / 6) * Math.PI) * 0.12;
          bx(-0.03, 0.36, z0, 0.03, top, z0 + 0.058, i % 2 ? a1 : a2);
        }
        break;
      case 'party':
        h.geometry(new THREE.ConeGeometry(0.13, 0.38, 10), T4(0.05, 0.58, 0).multiply(new THREE.Matrix4().makeRotationZ(-0.2)), a1);
        sph(h, 0.055, 0.09, 0.78, 0, a2, 1, 1, 8);
        bx(-0.1, 0.39, -0.1, 0.13, 0.43, 0.1, a2);
        break;
      case 'tophat':
        h.geometry(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), T4(0, 0.4, 0), a1);
        h.geometry(new THREE.CylinderGeometry(0.19, 0.19, 0.38, 16), T4(0, 0.6, 0), a1);
        h.geometry(new THREE.CylinderGeometry(0.195, 0.195, 0.06, 16), T4(0, 0.45, 0), a2);
        break;
      case 'luchador': {
        sph(h, 0.214, 0, 0.2, 0, a1, 1.08, 1.0, 14);
        for (const s of [-1, 1]) {
          const [e0, e1] = sx(s, 0.04, 0.14);
          bx(e0, 0.18, -0.232, e1, 0.27, -0.214, a2);                 // borde de los ojos
          const [w0, w1] = sx(s, 0.055, 0.125);
          bx(w0, 0.195, -0.236, w1, 0.255, -0.228, 0xffffff);
          const [p0, p1] = sx(s, 0.075, 0.105);
          bx(p0, 0.2, -0.24, p1, 0.25, -0.234, 0x2a1d14);
        }
        bx(-0.07, 0.06, -0.228, 0.07, 0.11, -0.208, 0x7a3b2e);         // boca
        bx(-0.025, 0.28, -0.232, 0.025, 0.44, -0.18, a2);              // raya de la frente
        break;
      }
      case 'diver':
        sph(h, 0.29, 0, 0.21, 0, a1, 1.04, 1, 14);
        h.geometry(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16).rotateX(Math.PI / 2), T4(0, 0.22, -0.27), a2);
        h.geometry(new THREE.CylinderGeometry(0.12, 0.12, 0.062, 16).rotateX(Math.PI / 2), T4(0, 0.22, -0.275), 0x8ecae6);
        h.geometry(new THREE.CylinderGeometry(0.25, 0.27, 0.08, 14), T4(0, -0.06, 0), a2);
        for (const [x, y] of [[-0.2, 0.32], [0.2, 0.32], [-0.22, 0.1], [0.22, 0.1]]) sph(h, 0.03, x, y, -0.18, a2, 1, 1, 6);
        break;
      case 'catears':
        for (const s of [-1, 1]) {
          h.geometry(new THREE.ConeGeometry(0.075, 0.15, 4), T4(s * 0.13, 0.45, 0.02).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.25)), a1);
          h.geometry(new THREE.ConeGeometry(0.04, 0.09, 4), T4(s * 0.13, 0.44, -0.01).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.25)), a2);
        }
        break;
      case 'football':
        sph(h, 0.248, 0, 0.24, 0.01, a1, 1.0, 1.04, 14);
        bx(-0.03, 0.36, -0.2, 0.03, 0.495, 0.24, a2);
        for (const y of [0.06, 0.13]) bx(-0.16, y, -0.28, 0.16, y + 0.025, -0.255, 0xcfd4da);
        for (const x of [-0.12, 0, 0.12]) bx(x - 0.012, 0.04, -0.28, x + 0.012, 0.16, -0.255, 0xcfd4da);
        break;
      case 'samurai':
        sph(h, 0.236, 0, 0.27, 0, a1, 0.82, 1.0, 12);
        bx(-0.28, 0.12, -0.04, 0.28, 0.26, 0.28, a1);                  // protector del cuello
        for (const s of [-1, 1]) {
          const [q0, q1] = sx(s, 0.22, 0.29);
          bx(q0, 0.08, -0.16, q1, 0.26, 0.1, a1);
          const [c0, c1] = sx(s, 0.07, 0.11);
          h.geometry(new THREE.BoxGeometry(0.03, 0.26, 0.02), T4(s * 0.11, 0.55, -0.23).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.4)), a2);   // cuernos dorados
          bx(c0, 0.33, -0.25, c1, 0.4, -0.22, a2);
        }
        bx(-0.06, 0.33, -0.25, 0.06, 0.42, -0.22, a2);
        break;
      case 'antennae':
        for (const s of [-1, 1]) {
          const [q0, q1] = sx(s, 0.07, 0.095);
          bx(q0, 0.4, -0.012, q1, 0.66, 0.012, a1);
          sph(h, 0.05, s * 0.083, 0.68, 0, a2, 1, 1, 8);
        }
        break;
      case 'halo':
        h.geometry(new THREE.TorusGeometry(0.17, 0.025, 6, 22).rotateX(Math.PI / 2), T4(0, 0.64, 0), a1);
        break;
      case 'devil':
        for (const s of [-1, 1]) h.geometry(new THREE.ConeGeometry(0.055, 0.18, 8), T4(s * 0.12, 0.47, -0.04).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.35)), a1);
        break;
      case 'dragon':
        for (const s of [-1, 1]) h.geometry(new THREE.ConeGeometry(0.05, 0.24, 8), T4(s * 0.12, 0.45, 0.06).multiply(new THREE.Matrix4().makeRotationX(0.7)).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.2)), a1);
        for (let i = 0; i < 4; i++) h.geometry(new THREE.ConeGeometry(0.04, 0.1, 4), T4(0, 0.43 - i * 0.07, 0.05 + i * 0.06).multiply(new THREE.Matrix4().makeRotationX(0.5 + i * 0.3)), a2);
        break;
      case 'santa':
        h.geometry(new THREE.ConeGeometry(0.22, 0.44, 12), T4(0.04, 0.58, 0.02).multiply(new THREE.Matrix4().makeRotationZ(-0.35)), a1);
        h.geometry(new THREE.TorusGeometry(0.205, 0.05, 6, 16).rotateX(Math.PI / 2), T4(0, 0.38, 0), 0xf4f4f4);
        sph(h, 0.06, 0.2, 0.74, 0.02, 0xf4f4f4, 1, 1, 8);
        sph(h, 0.17, 0, 0.06, -0.11, 0xf4f4f4, 0.95, 0.75, 10);         // barba
        bx(-0.09, 0.11, -0.22, 0.09, 0.15, -0.19, 0xf4f4f4);            // bigote
        break;
      case 'pumpkin':
        sph(h, 0.28, 0, 0.22, 0, a1, 0.92, 1, 14);
        bx(-0.025, 0.46, -0.025, 0.025, 0.56, 0.025, 0x3f6b2a);
        for (const s of [-1, 1]) {
          const [e0, e1] = sx(s, 0.06, 0.15);
          h.geometry(new THREE.ConeGeometry(0.05, 0.07, 3), T4(s * 0.105, 0.29, -0.258).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)), a2);
          bx(e0, 0.11, -0.262, e1, 0.15, -0.245, a2);
        }
        bx(-0.05, 0.1, -0.262, 0.05, 0.15, -0.245, a2);
        break;
      case 'bandana':
        bx(-0.218, 0.29, -0.218, 0.218, 0.34, 0.218, a1);
        bx(-0.03, 0.2, 0.21, 0.03, 0.32, 0.34, a1);
        bx(-0.165, 0.18, -0.224, 0.165, 0.27, -0.206, a2);              // antifaz
        for (const s of [-1, 1]) {
          const [w0, w1] = sx(s, 0.055, 0.125);
          bx(w0, 0.2, -0.229, w1, 0.25, -0.224, 0xffffff);
        }
        break;
    }
  }

  /* Complementos del cuerpo (van pegados al tronco, por detrás): capa, alas o cola.
     Colores: pal.cape / pal.wing / pal.tail (si no, los del complemento) */
  function bodyExtra(t, kind, pal) {
    const a1 = pal.acc1 !== undefined ? pal.acc1 : 0x333333, a2 = pal.acc2 !== undefined ? pal.acc2 : 0x111111;
    const M = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    if (kind === 'cape') {
      const c = pal.cape !== undefined ? pal.cape : a2;
      t.box(-0.28, 1.4, 0.12, 0.28, 1.48, 0.33, c, O);            // sobre los hombros
      t.box(-0.26, 0.85, 0.3, 0.26, 1.46, 0.34, c, O);
      t.box(-0.31, 0.5, 0.31, 0.31, 0.88, 0.355, c, O);           // más ancha abajo
    } else if (kind === 'wings') {
      const c = pal.wing !== undefined ? pal.wing : 0xffffff;
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const w = 0.62 - i * 0.12, hgt = 0.2;
          const m = M(sd * (0.18 + w / 2 * Math.cos(0.35)), 1.36 - i * 0.16, 0.3 + i * 0.01)
            .multiply(new THREE.Matrix4().makeRotationY(-sd * 0.35))
            .multiply(new THREE.Matrix4().makeRotationZ(sd * (0.35 - i * 0.12)));
          t.geometry(new THREE.BoxGeometry(w, hgt, 0.04), m, i ? c : a1);
        }
      }
    } else if (kind === 'tail') {
      const c = pal.tail !== undefined ? pal.tail : a1;
      let y = 0.92, z = 0.18, r = 0.06;
      const len = 0.17;
      for (let i = 0; i < 5; i++) {
        // cada tramo sale de donde acaba el anterior: primero hacia atrás y abajo, luego se curva hacia arriba
        const ang = 2.4 - i * 0.38;                                  // ángulo desde la vertical (girando en X)
        const m = M(0, y, z).multiply(new THREE.Matrix4().makeRotationX(ang)).multiply(M(0, len / 2, 0));
        t.geometry(new THREE.CylinderGeometry(r * 0.85, r, len, 8), m, i === 4 ? a2 : c);
        y += Math.cos(ang) * len; z += Math.sin(ang) * len; r *= 0.88;
      }
    }
  }

  /* Medidas del personaje (pies en y = 0, mira hacia -Z). Unos 1,85 m de alto, con
     proporciones de dibujo animado "realista": cabeza no muy grande, hombros anchos,
     cintura estrecha, rodillas y codos redondeados. */
  const RIG = {
    hipX: 0.12, hipY: 0.9,      // articulación de las piernas
    shX: 0.31, shY: 1.43,       // hombros
    headY: 1.55,                // cuello (la cabeza gira desde aquí)
    headS: 0.82,                // la cabeza se modela a escala 1 y se encoge al final
  };
  const HOLD_DY = RIG.shY - 1.43;   // (0: las manos a la altura de siempre; por si cambian las proporciones)
  const RX90 = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  // tronco de cono redondo (opcionalmente aplastado en Z) entre y0 e y1
  function cyl(b, rTop, rBot, y0, y1, color, sz, x, z, seg) {
    const g = new THREE.CylinderGeometry(rTop, rBot, y1 - y0, seg || 10);
    const m = T4(x || 0, (y0 + y1) / 2, z || 0).multiply(new THREE.Matrix4().makeScale(1, 1, sz || 1));
    b.geometry(g, m, color);
  }
  // esfera (opcionalmente estirada)
  function sph(b, r, x, y, z, color, sy, szz, seg) {
    const g = new THREE.SphereGeometry(r, seg || 10, Math.max(6, Math.round((seg || 10) * 0.7)));
    b.geometry(g, T4(x, y, z).multiply(new THREE.Matrix4().makeScale(1, sy || 1, szz || 1)), color);
  }

  // Planeador: lona curva con franjas y dos varillas hasta las manos
  function makeGlider(pal) {
    const glider = new G.GeoBuilder();
    const R = 2.3;
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.23;
      const m = T4(Math.sin(a) * R, Math.cos(a) * R - R, 0).multiply(new THREE.Matrix4().makeRotationZ(-a));
      glider.geometry(new THREE.BoxGeometry(0.54, 0.05, 1.5), m, i % 2 ? 0xffffff : pal.pack);
      const mb = T4(Math.sin(a) * R, Math.cos(a) * R - R + 0.02, -0.72).multiply(new THREE.Matrix4().makeRotationZ(-a));
      glider.geometry(new THREE.BoxGeometry(0.54, 0.07, 0.12), mb, 0x222222);
    }
    for (const s of [-1, 1]) {
      const m = T4(s * 0.53, -0.36, 0).multiply(new THREE.Matrix4().makeRotationZ(-s * 0.62));
      glider.geometry(new THREE.CylinderGeometry(0.02, 0.02, 0.76, 6), m, 0x333333);
    }
    return glider.toGeometry();
  }
  function fullPoses(rig, legG, torsoG, headG, armG) {
    const pose = (swing) => {
      const f = new G.GeoBuilder();
      const M4 = (x, y, z, rx) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationX(rx));
      f.geometry(legG, M4(-rig.hipX, rig.hipY, 0, swing));
      f.geometry(legG, M4(rig.hipX, rig.hipY, 0, -swing));
      f.geometry(torsoG, M4(0, 0, 0, 0));
      f.geometry(headG, M4(0, rig.headY, 0, 0));
      f.geometry(armG, M4(-rig.shX, rig.shY, 0, -swing * 0.8));
      f.geometry(armG, M4(rig.shX, rig.shY, 0, swing * 0.8));
      return f.toGeometry();
    };
    return { full: pose(0), fullA: pose(0.55), fullB: pose(-0.55) };
  }
  // Geometrías del personaje para una paleta y un complemento (se reutilizan entre personajes)
  function charParts(pal, acc) {
    let byAcc = partCache.get(pal);
    if (!byAcc) { byAcc = new Map(); partCache.set(pal, byAcc); }
    let p = byAcc.get(acc || '');
    if (p) return p;
    const [hacc, bacc] = (acc || '').split('+');   // complemento de la cabeza + del cuerpo (capa, alas...)
    const BELT = 0x2b2b2b;
    // pierna (desde la cadera hacia abajo)
    const leg = new G.GeoBuilder();
    cyl(leg, 0.118, 0.095, -0.48, 0.03, pal.pants);
    sph(leg, 0.093, 0, -0.48, 0, pal.pants);
    cyl(leg, 0.092, 0.075, -0.8, -0.48, pal.pants);
    cyl(leg, 0.088, 0.09, -0.82, -0.72, pal.shoes);
    leg.box(-0.088, -0.9, -0.2, 0.088, -0.78, 0.1, pal.shoes, O);
    sph(leg, 0.088, 0, -0.84, -0.17, pal.shoes, 0.62, 1.1, 8);
    leg.box(-0.092, -0.905, -0.22, 0.092, -0.88, 0.11, 0x1a1a1a, O);   // suela
    // tronco: cadera, cinturón, pecho con hombros redondeados, cuello y mochila
    const torso = new G.GeoBuilder();
    cyl(torso, 0.2, 0.19, 0.84, 1.0, pal.pants, 0.72);
    cyl(torso, 0.212, 0.212, 0.96, 1.03, BELT, 0.74);
    torso.box(-0.045, 0.965, -0.17, 0.045, 1.025, -0.14, 0xc9a227, O);
    cyl(torso, 0.27, 0.2, 1.02, 1.42, pal.shirt, 0.64);
    sph(torso, 0.27, 0, 1.42, 0, pal.shirt, 0.3, 0.64, 12);
    cyl(torso, 0.062, 0.07, 1.42, 1.58, pal.skin);
    torso.box(-0.17, 1.0, 0.12, 0.17, 1.36, 0.29, pal.pack, O);
    // saco de dormir enrollado encima de la mochila
    const roll = new THREE.CylinderGeometry(0.07, 0.07, 0.36, 10).rotateZ(Math.PI / 2);
    torso.geometry(roll, T4(0, 1.4, 0.2), pal.pack);
    torso.box(-0.15, 1.02, -0.2, -0.1, 1.44, -0.15, BELT, O);   // tirantes de la mochila
    torso.box(0.1, 1.02, -0.2, 0.15, 1.44, -0.15, BELT, O);
    if (bacc) bodyExtra(torso, bacc, pal);
    // cabeza (a escala 1: de y = 0 a 0,4 y la cara hacia -Z; se encoge con RIG.headS)
    const head = new G.GeoBuilder();
    sph(head, 0.205, 0, 0.2, 0, pal.skin, 1.08, 1, 14);
    sph(head, 0.045, -0.2, 0.19, 0.01, pal.skin, 1.3, 0.8, 8);
    sph(head, 0.045, 0.2, 0.19, 0.01, pal.skin, 1.3, 0.8, 8);
    head.box(-0.022, 0.13, -0.232, 0.022, 0.21, -0.19, pal.skin, O);           // nariz
    for (const s of [-1, 1]) {
      const [e0, e1] = sx(s, 0.045, 0.13);
      head.box(e0, 0.19, -0.212, e1, 0.26, -0.17, 0xffffff, O);                // ojos
      const [p0, p1] = sx(s, 0.07, 0.11);
      head.box(p0, 0.195, -0.218, p1, 0.255, -0.2, 0x2a1d14, O);
      const [b0, b1] = sx(s, 0.04, 0.14);
      head.box(b0, 0.275, -0.212, b1, 0.3, -0.17, pal.hair, O);                 // cejas
    }
    head.box(-0.06, 0.085, -0.205, 0.06, 0.102, -0.17, 0x7a3b2e, O);           // boca
    if (!HIDE_HAIR[hacc]) {
      const cap = new THREE.SphereGeometry(0.222, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
      head.geometry(cap, T4(0, 0.2, 0).multiply(new THREE.Matrix4().makeScale(1, 1.1, 1.03)), pal.hair);
      const back = new THREE.SphereGeometry(0.218, 12, 8, 0, Math.PI, 0, Math.PI * 0.72);
      head.geometry(back, T4(0, 0.2, 0.004).multiply(new THREE.Matrix4().makeScale(1, 1.08, 1.02)), pal.hair);
      head.box(-0.19, 0.33, -0.215, 0.19, 0.4, -0.13, pal.hair, O);           // flequillo
    }
    if (hacc) accessory(head, hacc, pal);
    // brazo (desde el hombro hacia abajo): manga, codo, antebrazo y mano
    const arm = new G.GeoBuilder();
    sph(arm, 0.105, 0, 0, 0, pal.shirt);
    cyl(arm, 0.092, 0.078, -0.32, 0, pal.shirt);
    sph(arm, 0.074, 0, -0.32, 0, pal.skin, 1, 1, 8);
    cyl(arm, 0.072, 0.06, -0.58, -0.32, pal.skin);
    sph(arm, 0.07, 0, -0.65, -0.01, pal.skin, 1.25, 0.8, 8);
    // figura completa de una pieza (para los personajes lejanos), en 3 posturas para que se vea andar
    const legG = leg.toGeometry(), armG = arm.toGeometry();
    const headG = head.toGeometry().scale(RIG.headS, RIG.headS, RIG.headS);
    const torsoG = torso.toGeometry();
    p = Object.assign({ leg: legG, torso: torsoG, head: headG, arm: armG, glider: makeGlider(pal), rig: RIG },
      fullPoses(RIG, legG, torsoG, headG, armG));
    byAcc.set(acc || '', p);
    return p;
  }

  /* ---------- Picos (cosméticos: todos hacen lo mismo) ----------
     El mango va hacia -Z y se agarra por z = 0..0,14; la "cabeza" está hacia z = -1 */
  function classicPick(b, handle, grip, head, tips, gem) {
    b.box(-0.035, -0.035, -0.95, 0.035, 0.035, 0.12, handle, O);
    b.box(-0.04, -0.04, 0.0, 0.04, 0.04, 0.14, grip, O);
    b.box(-0.05, -0.32, -1.02, 0.05, 0.32, -0.88, head, O);
    b.box(-0.035, 0.32, -1.0, 0.035, 0.46, -0.9, tips, O);
    b.box(-0.035, -0.46, -1.0, 0.035, -0.32, -0.9, tips, O);
    b.box(-0.06, -0.06, -1.04, 0.06, 0.06, -0.86, gem, O);
  }
  const RZ90 = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const PICK_SHAPES = {
    clasico(b) { classicPick(b, 0x8a5a2b, 0x3a3a3a, 0x9aa4ae, 0xd0d6dc, 0x6c63ff); },
    oro(b) {
      classicPick(b, 0x3a1f5c, 0xffc933, 0xffc933, 0xfff2a8, 0xe63946);
      b.box(-0.04, -0.04, -0.6, 0.04, 0.04, -0.54, 0xffc933, O);
    },
    cristal(b) {
      classicPick(b, 0xd0d6dc, 0x3a3a3a, 0x5fe6ff, 0xd8fbff, 0xffffff);
      b.box(-0.025, 0.12, -1.1, 0.025, 0.24, -1.02, 0xaef6ff, O);
      b.box(-0.025, -0.24, -1.1, 0.025, -0.12, -1.02, 0xaef6ff, O);
    },
    hacha(b) {
      b.box(-0.035, -0.035, -1.0, 0.035, 0.035, 0.12, 0x9a6a3a, O);
      b.box(-0.04, -0.04, -0.05, 0.04, 0.04, 0.14, 0xb3202a, O);
      b.box(-0.03, 0.0, -1.08, 0.03, 0.3, -0.82, 0x8f969e, O);
      b.box(-0.032, 0.3, -1.12, 0.032, 0.38, -0.78, 0xe2e7eb, O);
      b.box(-0.045, -0.12, -1.0, 0.045, 0.02, -0.9, 0x5a5f66, O);
    },
    martillo(b) {
      b.box(-0.032, -0.032, -0.92, 0.032, 0.032, 0.12, 0x3d3d44, O);
      b.box(-0.04, -0.04, 0.0, 0.04, 0.04, 0.14, 0xd4a017, O);
      b.box(-0.12, -0.16, -1.12, 0.12, 0.16, -0.84, 0x6b737c, O);
      b.box(-0.126, -0.17, -1.01, 0.126, 0.17, -0.95, 0xd4a017, O);
      b.box(-0.1, 0.16, -1.1, 0.1, 0.2, -0.86, 0x9aa0a6, O);
      b.box(-0.1, -0.2, -1.1, 0.1, -0.16, -0.86, 0x9aa0a6, O);
    },
    guadana(b) {
      b.box(-0.03, -0.03, -1.25, 0.03, 0.03, 0.12, 0x3a2a1a, O);
      b.box(-0.036, -0.036, -0.42, 0.036, 0.036, -0.34, 0x8a8a8a, O);
      for (let i = 0; i < 7; i++) {
        const y0 = -0.05 + i * 0.11, zc = -1.22 - 0.012 * i * i, w = 0.2 - i * 0.022;
        b.box(-0.016, y0, zc - w / 2, 0.016, y0 + 0.12, zc + w / 2, i % 2 ? 0xc9d1d9 : 0xb2bcc6, O);
      }
      b.box(-0.04, -0.06, -1.3, 0.04, 0.06, -1.18, 0x2b2f36, O);
    },
    piruleta(b) {
      b.box(-0.025, -0.025, -0.82, 0.025, 0.025, 0.12, 0xf4f4f4, O);
      const m = (z) => T4(0, 0, z).multiply(RZ90);
      b.geometry(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 18), m(-1.12), 0xff5fa2);
      b.geometry(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), m(-1.12), 0xffffff);
      b.geometry(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 14), m(-1.12), 0x7ad7f0);
      b.geometry(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), m(-1.12), 0xffd166);
    },
    guitarra(b) {
      b.box(-0.03, -0.02, -0.72, 0.03, 0.03, 0.12, 0x7a4a26, O);
      b.box(-0.05, -0.025, 0.12, 0.05, 0.035, 0.28, 0x222222, O);
      b.box(-0.05, -0.17, -1.14, 0.05, 0.17, -0.96, 0xd62828, O);
      b.box(-0.05, -0.13, -0.96, 0.05, 0.13, -0.82, 0xd62828, O);
      b.box(-0.05, -0.15, -0.82, 0.05, 0.15, -0.7, 0xd62828, O);
      b.box(0.05, -0.1, -1.06, 0.056, 0.08, -0.74, 0xf4f4f4, O);
      b.box(0.056, -0.06, -1.0, 0.062, 0.04, -0.96, 0x222222, O);
      b.box(0.03, 0.0, -1.0, 0.036, 0.01, 0.2, 0xdddddd, O);
    },
    laser(b) {
      b.box(-0.04, -0.04, -0.12, 0.04, 0.04, 0.14, 0x2b2f36, O);
      b.box(-0.046, -0.046, -0.17, 0.046, 0.046, -0.12, 0x9aa4ae, O);
      b.box(-0.03, -0.03, -1.2, 0.03, 0.03, -0.17, 0x7dff7a, O);
    },
  };
  // el sable láser brilla (no le afecta la luz)
  const PICK_MAT = { laser: () => (M._glowMat = M._glowMat || new THREE.MeshBasicMaterial({ vertexColors: true })) };

  const M = (G.Models = {
    PALETTES,
    mat,
    RIG, HOLD_DY,

    /* ---------- Personaje ----------
       Mide unos 1,85 m. Mira hacia -Z. Los pies están en y = 0. */
    makeCharacter(pal, acc) {
      const P = charParts(pal, acc);
      const RIG = P.rig;   // (cada tipo de cuerpo tiene sus articulaciones)
      const vm = G.vcMaterial;
      const mk = (geo, parent, x, y, z) => { const m = new THREE.Mesh(geo, vm); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
      const root = new THREE.Group();
      root.rotation.order = 'YXZ';
      const body = new THREE.Group();
      root.add(body);
      const legL = new THREE.Group(); legL.position.set(-RIG.hipX, RIG.hipY, 0); body.add(legL);
      const legR = new THREE.Group(); legR.position.set(RIG.hipX, RIG.hipY, 0); body.add(legR);
      mk(P.leg, legL, 0, 0, 0); mk(P.leg, legR, 0, 0, 0);
      mk(P.torso, body, 0, 0, 0);
      const head = new THREE.Group(); head.position.set(0, RIG.headY, 0); body.add(head);
      mk(P.head, head, 0, 0, 0);
      const armL = new THREE.Group(); armL.position.set(-RIG.shX, RIG.shY, 0); body.add(armL);
      const armR = new THREE.Group(); armR.position.set(RIG.shX, RIG.shY, 0); body.add(armR);
      mk(P.arm, armL, 0, 0, 0); mk(P.arm, armR, 0, 0, 0);
      // lo que lleva en las manos
      const weaponHolder = new THREE.Group();
      weaponHolder.position.set(0.16, 1.3 + HOLD_DY, -0.42);
      body.add(weaponHolder);
      // planeador (se ve sólo al planear)
      const glider = new THREE.Group();
      glider.position.set(0, 2.75, 0);
      mk(P.glider, glider, 0, 0, 0);
      glider.visible = false;
      root.add(glider);
      // sombra "de mancha" barata (cuando las sombras reales están desactivadas)
      const blob = new THREE.Mesh(M.blobGeo, M.blobMat);
      blob.renderOrder = 1;
      root.add(blob);
      const lod = new THREE.Mesh(P.full, vm);
      lod.castShadow = true;
      lod.visible = false;
      root.add(lod);
      return { root, body, legL, legR, armL, armR, head, weaponHolder, glider, blob, lod, lodParts: P, heldMesh: null, heldKey: '' };
    },

    blobGeo: new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2),
    blobMat: null,

    /* ---------- Armas ----------
       Cada tipo + rareza tiene su propia geometría (con la rareza pintada). */
    geoCache: new Map(),
    // los modelos se dibujan "grandes" y se encogen a su tamaño real con esta escala
    weaponScale: { pistol: 0.74, rifle: 0.78, shotgun: 0.75, sniper: 0.72, burst: 0.78, tactical: 0.75, rocket: 0.8 },
    muzzle: {
      pistol: new THREE.Vector3(0, 0.06, -0.3).multiplyScalar(0.74),
      rifle: new THREE.Vector3(0, 0.05, -0.78).multiplyScalar(0.78),
      shotgun: new THREE.Vector3(0, 0.05, -0.88).multiplyScalar(0.75),
      sniper: new THREE.Vector3(0, 0.04, -1.14).multiplyScalar(0.72),
      burst: new THREE.Vector3(0, 0.03, -0.74).multiplyScalar(0.78),
      tactical: new THREE.Vector3(0, 0.05, -0.72).multiplyScalar(0.75),
      rocket: new THREE.Vector3(0, 0.12, -0.92).multiplyScalar(0.8),
    },

    cached(key, fn) {
      let g = this.geoCache.get(key);
      if (!g) { g = fn(); this.geoCache.set(key, g); }
      return g;
    },

    weaponGeometry(type, rarity) {
      return this.cached(type + rarity, () => {
        const b = new G.GeoBuilder();
        const R = G.RARITIES[rarity].hex;
        const dark = 0x2b2f36, metal = 0x4a505a, wood = 0x7a4a26;
        if (type === 'pistol') {
          b.box(-0.04, 0.02, -0.28, 0.04, 0.1, 0.03, dark, O);
          b.box(-0.036, -0.13, -0.02, 0.036, 0.03, 0.06, R, O);
          b.box(-0.045, 0.0, -0.22, 0.045, 0.03, -0.02, R, O);
          b.box(-0.012, 0.1, -0.26, 0.012, 0.125, -0.24, metal, O);
        } else if (type === 'rifle') {
          b.box(-0.05, -0.02, -0.46, 0.05, 0.1, 0.15, R, O);
          b.box(-0.022, 0.025, -0.78, 0.022, 0.07, -0.46, dark, O);
          b.box(-0.04, -0.06, -0.62, 0.04, 0.06, -0.46, dark, O);
          b.box(-0.042, -0.06, 0.15, 0.042, 0.08, 0.44, dark, O);
          b.box(-0.032, -0.24, -0.26, 0.032, -0.02, -0.15, metal, O);
          b.box(-0.03, -0.17, 0.0, 0.03, -0.02, 0.07, dark, O);
          b.box(-0.02, 0.1, -0.12, 0.02, 0.16, 0.02, dark, O);
        } else if (type === 'shotgun') {
          b.box(-0.036, 0.02, -0.88, 0.036, 0.085, 0.0, dark, O);
          b.box(-0.032, -0.03, -0.8, 0.032, 0.02, -0.05, metal, O);
          b.box(-0.055, -0.05, -0.62, 0.055, 0.035, -0.36, wood, O);
          b.box(-0.055, -0.05, -0.06, 0.055, 0.1, 0.18, R, O);
          b.box(-0.045, -0.12, 0.18, 0.045, 0.07, 0.52, wood, O);
          b.box(-0.05, -0.1, 0.1, 0.05, 0.02, 0.3, R, O);
        } else if (type === 'burst') {
          // fusil de ráfagas tipo Famas: "bullpup" (el cargador va detrás del gatillo) con asa larga encima
          b.box(-0.05, -0.04, -0.42, 0.05, 0.09, 0.4, R, O);              // cuerpo
          b.box(-0.02, 0.0, -0.74, 0.02, 0.04, -0.42, dark, O);           // cañón
          b.box(-0.035, -0.035, -0.62, 0.035, 0.045, -0.42, dark, O);     // guardamanos
          b.box(-0.03, -0.06, -0.78, 0.03, 0.06, -0.72, metal, O);        // bocacha
          b.box(-0.014, 0.09, -0.4, 0.014, 0.2, -0.36, dark, O);          // asa (patas y barra)
          b.box(-0.014, 0.09, 0.14, 0.014, 0.2, 0.18, dark, O);
          b.box(-0.02, 0.18, -0.42, 0.02, 0.22, 0.2, dark, O);
          b.box(-0.03, -0.2, -0.24, 0.03, -0.04, -0.15, dark, O);         // empuñadura
          b.box(-0.028, -0.26, 0.04, 0.028, -0.04, 0.16, metal, O);       // cargador (detrás)
          b.box(-0.045, -0.06, 0.4, 0.045, 0.1, 0.46, dark, O);           // cantonera
        } else if (type === 'tactical') {
          // escopeta táctica: empuñadura de pistola, cañón corto con tubo y culata del color de la rareza
          b.box(-0.034, 0.03, -0.72, 0.034, 0.09, -0.04, dark, O);        // cañón
          b.box(-0.03, -0.03, -0.62, 0.03, 0.025, -0.06, metal, O);       // tubo
          b.box(-0.05, -0.05, -0.48, 0.05, 0.03, -0.28, R, O);            // guardamanos
          b.box(-0.055, -0.06, -0.06, 0.055, 0.11, 0.2, dark, O);         // cajón de mecanismos
          b.box(-0.032, -0.24, 0.06, 0.032, -0.06, 0.15, dark, O);        // empuñadura de pistola
          b.box(-0.04, -0.06, 0.2, 0.04, 0.08, 0.5, R, O);                // culata
          b.box(-0.045, -0.12, 0.44, 0.045, 0.09, 0.52, dark, O);
          b.box(-0.01, 0.11, -0.68, 0.01, 0.14, -0.64, metal, O);         // punto de mira
        } else if (type === 'rocket') {
          // lanzamisiles: tubo grueso con boca más ancha, mira, empuñaduras y cabeza del misil asomando
          b.box(-0.1, 0.03, -0.82, 0.1, 0.23, 0.55, R, O);                // tubo
          b.box(-0.12, 0.01, -0.92, 0.12, 0.25, -0.82, dark, O);          // boca
          b.box(-0.115, 0.015, 0.55, 0.115, 0.245, 0.62, dark, O);        // salida trasera
          b.box(-0.105, 0.025, -0.4, 0.105, 0.235, -0.34, metal, O);      // aros
          b.box(-0.105, 0.025, 0.2, 0.105, 0.235, 0.26, metal, O);
          b.box(0.1, 0.18, -0.25, 0.16, 0.26, -0.05, dark, O);            // mira
          b.box(0.105, 0.2, -0.26, 0.165, 0.24, -0.25, 0x4fc3f7, O);
          b.box(-0.03, -0.18, -0.12, 0.03, 0.03, -0.04, dark, O);         // empuñadura de atrás
          b.box(-0.03, -0.15, -0.5, 0.03, 0.03, -0.43, dark, O);          // empuñadura de delante
          b.box(-0.06, 0.08, -0.97, 0.06, 0.18, -0.92, 0xd62828, O);      // punta del misil
        } else {
          b.box(-0.026, 0.02, -1.14, 0.026, 0.065, -0.3, dark, O);
          b.box(-0.052, -0.05, -0.36, 0.052, 0.09, 0.16, R, O);
          b.box(-0.045, 0.11, -0.3, 0.045, 0.2, 0.06, dark, O);
          b.box(-0.05, 0.105, -0.34, 0.05, 0.205, -0.28, metal, O);
          b.box(-0.05, 0.105, 0.03, 0.05, 0.205, 0.08, metal, O);
          b.box(-0.015, 0.09, -0.16, 0.015, 0.11, -0.08, dark, O);
          b.box(-0.048, -0.12, 0.16, 0.048, 0.08, 0.52, R, O);
          b.box(-0.03, -0.16, -0.06, 0.03, -0.04, 0.02, dark, O);
          b.box(0.05, 0.04, -0.02, 0.1, 0.06, 0.0, metal, O);
        }
        const k = this.weaponScale[type] || 1;
        return b.toGeometry().scale(k, k, k);
      });
    },

    // Misil en vuelo: cuerpo, punta roja, aletas y llama (mira hacia -Z)
    rocketMesh() {
      const geo = this.cached('rocketFly', () => {
        const b = new G.GeoBuilder();
        const RX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        b.geometry(new THREE.CylinderGeometry(0.075, 0.075, 0.55, 10), RX, 0x5b6b3a);
        b.geometry(new THREE.ConeGeometry(0.075, 0.2, 10), new THREE.Matrix4().makeTranslation(0, 0, -0.375).multiply(RX), 0xd62828);
        b.box(-0.16, -0.01, 0.16, 0.16, 0.01, 0.28, 0x3a3f47, O);
        b.box(-0.01, -0.16, 0.16, 0.01, 0.16, 0.28, 0x3a3f47, O);
        return b.toGeometry();
      });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, G.vcMaterial));
      if (!this._flameMat) this._flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      if (!this._flameGeo) this._flameGeo = new THREE.ConeGeometry(0.07, 0.45, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
      g.add(new THREE.Mesh(this._flameGeo, this._flameMat));
      return g;
    },

    // Pico (cada modelo de la tienda tiene su forma): mango hacia delante (-Z) y la cabeza al final
    pickaxeGeometry(id) {
      if (!PICK_SHAPES[id]) id = 'clasico';
      return this.cached('pickaxe_' + id, () => {
        const b = new G.GeoBuilder();
        PICK_SHAPES[id](b);
        return b.toGeometry();
      });
    },

    potionGeometry() {
      return this.cached('potion', () => {
        const b = new G.GeoBuilder();
        const m = new THREE.Matrix4();
        b.geometry(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 10), m.makeTranslation(0, 0.15, 0), 0x2f8cff);
        b.geometry(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), m.makeTranslation(0, 0.36, 0), 0x6fc3ff);
        b.geometry(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), m.makeTranslation(0, 0.45, 0), 0x8a5a2b);
        return b.toGeometry();
      });
    },

    medkitGeometry() {
      return this.cached('medkit', () => {
        const b = new G.GeoBuilder();
        b.box(-0.24, 0, -0.17, 0.24, 0.3, 0.17, 0xf2f2f2, O);
        b.box(-0.05, 0.3, -0.13, 0.05, 0.32, 0.13, 0xe53935, O);
        b.box(-0.13, 0.3, -0.05, 0.13, 0.32, 0.05, 0xe53935, O);
        b.box(-0.05, 0.06, -0.18, 0.05, 0.24, -0.17, 0xe53935, O);
        b.box(-0.09, 0.1, -0.18, 0.09, 0.2, -0.17, 0xe53935, O);
        b.box(-0.08, 0.3, -0.03, 0.08, 0.36, 0.03, 0x555555, O);
        return b.toGeometry();
      });
    },

    consumableGeometry(cid) {
      return cid === 'medkit' ? this.medkitGeometry() : this.potionGeometry();
    },

    // Mallas para tener en la mano (arma, pico o cura)
    // pick = id del pico de ese personaje
    heldMesh(item, pick) {
      let geo, mat = G.vcMaterial;
      if (!item || item === 'pickaxe') { geo = this.pickaxeGeometry(pick); if (PICK_MAT[pick]) mat = PICK_MAT[pick](); }
      else if (item.kind === 'weapon') geo = this.weaponGeometry(item.type, item.rarity);
      else { geo = this.consumableGeometry(item.cid); if (item.cid === 'potion') mat = this.potionMaterial; }
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    },
    heldKey(item, pick) {
      if (!item || item === 'pickaxe') return 'pickaxe:' + (pick || 'clasico');
      if (item.kind === 'weapon') return item.type + item.rarity;
      return 'c' + item.cid;
    },

    weaponMesh(type, rarity) {
      const m = new THREE.Mesh(this.weaponGeometry(type, rarity), G.vcMaterial);
      m.castShadow = true;
      return m;
    },

    /* ---------- Objetos del suelo ---------- */
    ammoGeometry(type) {
      return this.cached('ammo_' + type, () => {
        const b = new G.GeoBuilder();
        const c = G.AMMO[type].hex;
        b.box(-0.22, 0, -0.15, 0.22, 0.26, 0.15, 0x3a4a2a, O);
        b.box(-0.23, 0.09, -0.16, 0.23, 0.17, 0.16, c, O);
        b.box(-0.24, 0.24, -0.16, 0.24, 0.29, 0.16, 0x2b331f, O);
        return b.toGeometry();
      });
    },

    matGeometry(m) {
      return this.cached('mat_' + m, () => {
        const b = new G.GeoBuilder();
        if (m === 'wood') {
          for (let i = 0; i < 3; i++) b.box(-0.4, i * 0.11, -0.12 + (i % 2) * 0.05, 0.4, i * 0.11 + 0.1, 0.1 + (i % 2) * 0.05, i % 2 ? 0xb07a43 : 0xd39a5b, O);
        } else if (m === 'stone') {
          b.box(-0.3, 0, -0.18, 0.02, 0.18, 0.0, 0xa5a8ad, O);
          b.box(0.04, 0, -0.18, 0.32, 0.18, 0.0, 0x9a9da3, O);
          b.box(-0.16, 0.18, -0.16, 0.16, 0.34, 0.02, 0xbfc2c7, O);
        } else {
          b.box(-0.35, 0, -0.25, 0.35, 0.06, 0.25, 0x7f9bb5, O);
          b.box(-0.32, 0.06, -0.22, 0.32, 0.12, 0.22, 0x9cb8d2, O);
          b.box(-0.29, 0.12, -0.2, 0.29, 0.18, 0.2, 0x7f9bb5, O);
        }
        return b.toGeometry();
      });
    },

    potionMaterial: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a4a8a }),

    ringGeometry: new THREE.RingGeometry(0.42, 0.6, 20).rotateX(-Math.PI / 2),
    beamGeometry: new THREE.CylinderGeometry(0.05, 0.12, 4, 6, 1, true).translate(0, 2, 0),
    ringMats: [],
    beamMats: [],
    ringFor(hex) {
      let m = this.ringMats.find((r) => r.hex === hex);
      if (!m) {
        m = { hex, mat: new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }) };
        this.ringMats.push(m);
      }
      return m.mat;
    },
    beamFor(hex) {
      let m = this.beamMats.find((r) => r.hex === hex);
      if (!m) {
        m = { hex, mat: new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }) };
        this.beamMats.push(m);
      }
      return m.mat;
    },

    /* ---------- Cofre ---------- */
    chestGeometry(open) {
      return this.cached(open ? 'chestOpen' : 'chest', () => {
        const b = new G.GeoBuilder();
        const wood = 0x9a6230, gold = 0xffc933, dark = 0x5a3517;
        b.box(-0.55, 0, -0.34, 0.55, 0.5, 0.34, wood, O);
        b.box(-0.57, 0.0, -0.36, -0.47, 0.52, 0.36, gold, O);
        b.box(0.47, 0.0, -0.36, 0.57, 0.52, 0.36, gold, O);
        b.box(-0.5, 0.42, -0.33, 0.5, 0.5, 0.33, dark, O);
        const lid = new G.GeoBuilder();
        lid.box(-0.56, 0, -0.69, 0.56, 0.22, 0, wood, O);
        lid.box(-0.58, -0.01, -0.7, -0.48, 0.24, 0.01, gold, O);
        lid.box(0.48, -0.01, -0.7, 0.58, 0.24, 0.01, gold, O);
        lid.box(-0.08, -0.12, -0.72, 0.08, 0.08, -0.66, gold, O);
        const m = new THREE.Matrix4().makeTranslation(0, 0.5, 0.35);
        if (open) m.multiply(new THREE.Matrix4().makeRotationX(1.95));
        b.geometry(lid.toGeometry(), m);
        return b.toGeometry();
      });
    },

    /* ---------- Piezas de construcción ---------- */
    pieceGeometry(type) {
      const S = C.build.size, H = C.build.height;
      return this.cached('piece_' + type, () => {
        if (type === 'wall') return new THREE.BoxGeometry(S, H, 0.3).translate(0, H / 2, 0);
        if (type === 'floor') return new THREE.BoxGeometry(S, 0.25, S).translate(0, -0.1, 0);
        if (type === 'ramp') {
          const L = Math.hypot(S, H);
          return new THREE.BoxGeometry(L, 0.25, S).rotateZ(Math.atan2(H, S)).translate(0, H / 2, 0);
        }
        const r = S / Math.SQRT2;
        const g = new THREE.ConeGeometry(r, H * 0.55, 4, 1).rotateY(Math.PI / 4).translate(0, H * 0.275, 0);
        const n = g.toNonIndexed(); n.computeVertexNormals();
        return n;
      });
    },

    // Texturas dibujadas con código para cada material
    buildMaterial(m) {
      this._bm = this._bm || {};
      if (this._bm[m]) return this._bm[m];
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      if (m === 'wood') {
        for (let i = 0; i < 8; i++) {
          x.fillStyle = i % 2 ? '#c48a4f' : '#d59b5e';
          x.fillRect(0, i * 16, 128, 16);
          x.fillStyle = 'rgba(80,40,10,0.55)';
          x.fillRect(0, i * 16 + 14, 128, 2);
          x.fillRect(((i * 37) % 100) + 10, i * 16, 2, 14);
          x.fillStyle = '#5a3a1a';
          x.fillRect(4, i * 16 + 6, 3, 3); x.fillRect(121, i * 16 + 6, 3, 3);
        }
      } else if (m === 'stone') {
        x.fillStyle = '#8a8d92'; x.fillRect(0, 0, 128, 128);
        for (let r = 0; r < 8; r++) {
          for (let k = -1; k < 5; k++) {
            const off = r % 2 ? 16 : 0;
            const g = 165 + ((r * 7 + k * 13) % 5) * 9;
            x.fillStyle = 'rgb(' + g + ',' + (g + 2) + ',' + (g + 6) + ')';
            x.fillRect(k * 32 + off + 2, r * 16 + 2, 28, 12);
          }
        }
      } else {
        x.fillStyle = '#7f9bb5'; x.fillRect(0, 0, 128, 128);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
          x.fillStyle = (r + k) % 2 ? '#9db8d1' : '#8eabc6';
          x.fillRect(k * 64 + 3, r * 64 + 3, 58, 58);
          x.fillStyle = '#4f6578';
          for (const [a, bb] of [[8, 8], [54, 8], [8, 54], [54, 54]]) x.fillRect(k * 64 + a, r * 64 + bb, 4, 4);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      this._bm[m] = new THREE.MeshLambertMaterial({ map: tex });
      return this._bm[m];
    },

    ghostMats: {
      ok: new THREE.MeshBasicMaterial({ color: 0x59b6ff, transparent: true, opacity: 0.38, depthWrite: false }),
      bad: new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.38, depthWrite: false }),
    },

    /* ---------- Moto ----------
       Mira hacia -Z como los personajes. Las ruedas están aparte para que giren. */
    motoBodyGeometry(color) {
      return this.cached('moto' + color, () => {
        const b = new G.GeoBuilder();
        const dark = 0x23262b, metal = 0x8e959c, chrome = 0xd7dde3, seat = 0x18181a, black = 0x111111;
        const darker = new THREE.Color(color).multiplyScalar(0.7).getHex();
        const RX = (a) => new THREE.Matrix4().makeRotationX(a);
        // tubo recto de (y0, z0) a (y1, z1), en x
        const tube = (x, y0, z0, y1, z1, w, c) => {
          const dz = z1 - z0, dy = y1 - y0, L = Math.hypot(dz, dy);
          b.geometry(new THREE.BoxGeometry(w, w, L), T4(x, (y0 + y1) / 2, (z0 + z1) / 2).multiply(RX(Math.atan2(-dy, dz))), c);
        };
        const cylZ = (r, len, x, y, z, c, seg) => b.geometry(new THREE.CylinderGeometry(r, r, len, seg || 12), T4(x, y, z).multiply(RX(Math.PI / 2)), c);
        const cylX = (r, len, x, y, z, c, seg) => b.geometry(new THREE.CylinderGeometry(r, r, len, seg || 12), T4(x, y, z).multiply(RZ90), c);
        // cuadro y basculante
        tube(0, 1.0, -0.72, 0.8, 0.2, 0.08, dark);
        tube(0, 0.95, -0.7, 0.4, -0.25, 0.07, dark);
        for (const x of [-0.1, 0.1]) tube(x, 0.44, 0.1, 0.36, 0.7, 0.05, dark);
        // motor con aletas, tapa cromada y radiador
        b.box(-0.19, 0.28, -0.34, 0.19, 0.58, 0.14, 0x3a3d42, O);
        for (let i = 0; i < 4; i++) b.box(-0.22, 0.5 + i * 0.045, -0.3, 0.22, 0.52 + i * 0.045, 0.02, metal, O);
        for (const x of [-0.2, 0.2]) cylX(0.12, 0.04, x, 0.4, -0.06, chrome, 14);
        b.box(-0.16, 0.55, -0.5, 0.16, 0.82, -0.44, 0x2b2f36, O);
        for (let i = 0; i < 4; i++) b.box(-0.15, 0.58 + i * 0.06, -0.505, 0.15, 0.6 + i * 0.06, -0.5, metal, O);
        // depósito redondeado con rodilleras
        b.geometry(new THREE.CylinderGeometry(0.21, 0.19, 0.52, 14), T4(0, 0.86, -0.36).multiply(RX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.72)), color);
        b.box(-0.2, 0.7, -0.28, 0.2, 0.84, -0.12, darker, O);
        b.box(-0.04, 1.0, -0.42, 0.04, 1.03, -0.34, chrome, O);       // tapón
        // asiento con costura y colín
        b.box(-0.17, 0.82, -0.12, 0.17, 0.95, 0.5, seat, O);
        b.box(-0.172, 0.88, -0.1, 0.172, 0.89, 0.48, 0x3a3a3a, O);
        b.box(-0.15, 0.68, 0.48, 0.15, 0.9, 0.95, color, O);
        b.box(-0.152, 0.72, 0.55, 0.152, 0.76, 0.93, darker, O);
        b.box(-0.09, 0.73, 0.95, 0.09, 0.82, 0.99, 0xff3030, O);       // piloto trasero
        b.box(-0.1, 0.5, 0.93, 0.1, 0.64, 0.95, 0xffd166, O);          // matrícula
        // escape cromado
        tube(0.18, 0.34, -0.3, 0.3, 0.1, 0.06, chrome);
        b.geometry(new THREE.CylinderGeometry(0.075, 0.065, 0.6, 12), T4(0.22, 0.38, 0.45).multiply(RX(Math.PI / 2 - 0.15)), chrome);
        cylZ(0.05, 0.04, 0.22, 0.42, 0.76, black, 10);
        // horquilla, faro, parabrisas y manillar con espejos
        for (const x of [-0.08, 0.08]) tube(x, 0.36, -0.86, 1.04, -0.72, 0.055, chrome);
        b.box(-0.13, 0.98, -0.78, 0.13, 1.04, -0.68, dark, O);
        cylZ(0.11, 0.12, 0, 0.94, -0.86, chrome, 14);
        cylZ(0.09, 0.02, 0, 0.94, -0.925, 0xfff6c8, 14);
        b.geometry(new THREE.BoxGeometry(0.34, 0.26, 0.02), T4(0, 1.17, -0.84).multiply(RX(-0.45)), 0x6f8fa8);
        b.box(-0.44, 1.05, -0.8, 0.44, 1.1, -0.74, dark, O);
        b.box(-0.48, 1.03, -0.82, -0.36, 1.12, -0.72, black, O);
        b.box(0.36, 1.03, -0.82, 0.48, 1.12, -0.72, black, O);
        for (const s of [-1, 1]) {
          b.box(s * 0.33 - 0.012, 1.1, -0.78, s * 0.33 + 0.012, 1.26, -0.76, dark, O);
          b.box(s * 0.33 - 0.07, 1.25, -0.8, s * 0.33 + 0.07, 1.31, -0.77, chrome, O);
          b.box(s * 0.26 - 0.06, 0.43, 0.05, s * 0.26 + 0.06, 0.46, 0.13, metal, O);   // estriberas
        }
        // guardabarros
        b.box(-0.11, 0.76, -1.12, 0.11, 0.8, -0.58, color, O);
        b.box(-0.11, 0.6, -1.18, 0.11, 0.78, -1.12, color, O);
        b.box(-0.11, 0.76, 0.48, 0.11, 0.8, 0.98, dark, O);
        return b.toGeometry();
      });
    },
    motoWheelGeometry() {
      return this.cached('motoWheel', () => {
        const b = new G.GeoBuilder();
        // neumático (banda + flancos en anillo: por el hueco se ven los radios)
        b.geometry(new THREE.CylinderGeometry(0.36, 0.36, 0.15, 18, 1, true), RZ90, 0x1c1c1e);
        for (const s of [-1, 1]) {
          const rot = new THREE.Matrix4().makeRotationY((s * Math.PI) / 2);
          b.geometry(new THREE.RingGeometry(0.28, 0.36, 18), T4(s * 0.075, 0, 0).multiply(rot), 0x232326);
          b.geometry(new THREE.RingGeometry(0.24, 0.28, 18), T4(s * 0.07, 0, 0).multiply(rot), 0x9aa1a8);
        }
        b.geometry(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), RZ90, 0xd7dde3);
        b.geometry(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), T4(0.085, 0, 0).multiply(RZ90), 0x8e959c);
        for (let k = 0; k < 5; k++) b.geometry(new THREE.BoxGeometry(0.03, 0.5, 0.03), new THREE.Matrix4().makeRotationX((k * Math.PI) / 5), 0xd7dde3);
        return b.toGeometry();
      });
    },
    makeMoto(color) {
      const root = new THREE.Group();
      const tilt = new THREE.Group();     // inclinación (cabeceo y tumbado en las curvas)
      root.add(tilt);
      const body = new THREE.Mesh(this.motoBodyGeometry(color), G.vcMaterial);
      body.castShadow = true;
      tilt.add(body);
      const wf = new THREE.Mesh(this.motoWheelGeometry(), G.vcMaterial);
      wf.position.set(0, 0.36, -0.83);
      const wr = new THREE.Mesh(this.motoWheelGeometry(), G.vcMaterial);
      wr.position.set(0, 0.36, 0.7);
      wf.castShadow = wr.castShadow = true;
      tilt.add(wf, wr);
      const blob = new THREE.Mesh(M.blobGeo, M.blobMat);
      blob.scale.set(0.8, 1, 1.9);
      blob.position.y = 0.04;
      blob.renderOrder = 1;
      root.add(blob);
      return { root, tilt, body, wf, wr, blob };
    },

    /* ---------- Autobús volador (con hélices) ---------- */
    makeBus() {
      const root = new THREE.Group();
      const b = new G.GeoBuilder();
      const yellow = 0xffc531, blue = 0x24476b, red = 0xd62828, dark = 0x222222;
      b.box(-1.5, 0.4, -6, 1.5, 3.2, 6, yellow, O);
      b.box(-1.53, 1.7, -5.2, 1.53, 2.6, 5.4, blue, O);
      b.box(-1.4, 1.6, -6.04, 1.4, 2.8, -5.9, blue, O);
      b.box(-1.54, 1.0, -6.0, 1.54, 1.25, 6.0, red, O);
      b.box(-1.55, 0.4, -6.1, 1.55, 0.8, 6.1, dark, O);
      b.box(-1.3, 3.2, -4.5, 1.3, 3.5, 4.5, 0xe0a800, O);
      const m = new THREE.Matrix4();
      const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
      for (const z of [-4, 4]) for (const x of [-1.5, 1.5]) {
        m.makeTranslation(x, 0.5, z).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        b.geometry(wheel, m, 0x1a1a1a);
      }
      for (const z of [-3, 3]) b.box(-0.15, 3.5, z - 0.15, 0.15, 5.0, z + 0.15, 0x555555, O);
      const mesh = new THREE.Mesh(b.toGeometry(), G.vcMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      const rotors = [];
      const blade = new G.GeoBuilder();
      blade.box(-3.5, -0.04, -0.22, 3.5, 0.04, 0.22, 0x333333, O);
      blade.box(-0.22, -0.04, -3.5, 0.22, 0.04, 3.5, 0x333333, O);
      const bladeGeo = blade.toGeometry();
      for (const z of [-3, 3]) {
        const rotor = new THREE.Mesh(bladeGeo, G.vcMaterial);
        rotor.position.set(0, 5.05, z);
        root.add(rotor);
        rotors.push(rotor);
      }
      return { root, rotors };
    },

    /* ---------- Textura del reloj de la torre ---------- */
    clockTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3b2a1a'; ctx.fillRect(0, 0, 256, 256);
      ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.fillStyle = '#f5ecd2'; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = '#c9a227'; ctx.stroke();
      ctx.fillStyle = '#222';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.save(); ctx.translate(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92);
        ctx.rotate(a); ctx.fillRect(-4, -10, 8, 20); ctx.restore();
      }
      ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
      ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + 45, 128 - 30); ctx.stroke();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 - 10, 128 - 85); ctx.stroke();
      ctx.beginPath(); ctx.arc(128, 128, 9, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
      return new THREE.CanvasTexture(c);
    },
  });

  // textura de sombra redonda y difusa
  (function () {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    M.blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    // la geometría del círculo necesita UV de 0 a 1 (ya las trae)
  })();
})();

/* =====================================================================
   utils.js — Funciones de ayuda: matemáticas, números aleatorios,
   ruido (para el terreno) y un "constructor de geometría" que junta
   miles de cajas en una sola malla para que el juego vaya rápido.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  const U = (G.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smoothstep(e0, e1, x) {
      const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    },
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    // Elige un índice según pesos: weighted([70, 20, 10]) devuelve 0 el 70% de las veces
    weighted(weights, rnd) {
      const r = rnd || Math.random;
      let total = 0;
      for (const w of weights) total += w;
      let x = r() * total;
      for (let i = 0; i < weights.length; i++) {
        x -= weights[i];
        if (x <= 0) return i;
      }
      return weights.length - 1;
    },
    // Diferencia entre dos ángulos, siempre entre -PI y PI
    angleDiff(a, b) {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    dist2D: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
    shuffle(arr, rnd) {
      const r = rnd || Math.random;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    formatTime(s) {
      s = Math.max(0, Math.ceil(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
  });

  // Generador de números aleatorios con semilla (misma semilla = misma isla)
  G.makeRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Ruido de valores 2D (colinas suaves)
  G.Noise = class {
    constructor(seed) {
      const rnd = G.makeRng(seed);
      this.p = new Uint8Array(512);
      this.v = new Float32Array(256);
      const perm = [];
      for (let i = 0; i < 256; i++) { perm.push(i); this.v[i] = rnd() * 2 - 1; }
      U.shuffle(perm, rnd);
      for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    }
    value(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const p = this.p, v = this.v;
      const X = xi & 255, Y = yi & 255;
      const a = v[p[p[X] + Y]], b = v[p[p[X + 1] + Y]];
      const c = v[p[p[X] + Y + 1]], d = v[p[p[X + 1] + Y + 1]];
      return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), w);
    }
    fbm(x, y, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let i = 0; i < (oct || 4); i++) {
        s += this.value(x * f, y * f) * amp;
        norm += amp; amp *= 0.5; f *= 2.03;
      }
      return s / norm;
    }
  };

  /* ---------- GeoBuilder ----------
     Va acumulando cajas y formas con su color y al final crea UNA sola malla
     (con índices, para que la tarjeta gráfica procese menos vértices).
     Así la ciudad entera se dibuja en pocas "llamadas" a la tarjeta gráfica. */
  const _v = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _c = new THREE.Color();
  const _nm = new THREE.Matrix3();

  G.GeoBuilder = class {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.vc = 0; }
    get empty() { return this.vc === 0; }

    // Un cuadrilátero = 4 vértices + 2 triángulos
    _quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b) {
      const v = this.vc;
      this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      for (let i = 0; i < 4; i++) { this.nor.push(nx, ny, nz); this.col.push(r, g, b); }
      this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      this.vc += 4;
    }

    /* Caja alineada con los ejes, de (x0,y0,z0) a (x1,y1,z1).
       opts.noTop / noBottom / noX0 / noX1 / noZ0 / noZ1 = no dibujar esa cara (porque queda tapada) */
    box(x0, y0, z0, x1, y1, z1, color, opts) {
      _c.set(color);
      let r = _c.r, g = _c.g, b = _c.b;
      const o = opts || {};
      const jit = o.jitter !== undefined ? o.jitter : 0.04;
      if (jit) {
        const k = 1 + (Math.random() * 2 - 1) * jit;
        r *= k; g *= k; b *= k;
      }
      const side = 0.93;
      if (!o.noTop) this._quad(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 0, 1, 0, r, g, b);
      if (!o.noBottom) {
        let br = r, bg = g, bb = b;
        if (o.bottomColor !== undefined) { _c.set(o.bottomColor); br = _c.r; bg = _c.g; bb = _c.b; }
        this._quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, br, bg, bb);
      }
      if (!o.noX1) this._quad(x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1, 1, 0, 0, r * side, g * side, b * side);
      if (!o.noX0) this._quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, r * side, g * side, b * side);
      if (!o.noZ1) this._quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, r, g, b);
      if (!o.noZ0) this._quad(x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0, 0, 0, -1, r, g, b);
    }

    /* Añade una geometría de three.js (cono, cilindro...) transformada por una matriz.
       grad = [abajo, arriba]: oscurece/aclara el color según la altura dentro de la forma
       (da volumen a copas de árboles, rocas...) */
    geometry(geo, matrix, color, jitter, grad) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal;
      const vc = g.attributes.color;
      _nm.getNormalMatrix(matrix);
      _c.set(color === undefined ? 0xffffff : color);
      const k = 1 + (Math.random() * 2 - 1) * (jitter || 0);
      let gy0 = 0, gyr = 1;
      if (grad) {
        if (!g.boundingBox) g.computeBoundingBox();
        gy0 = g.boundingBox.min.y;
        gyr = Math.max(1e-4, g.boundingBox.max.y - gy0);
      }
      const v0 = this.vc;
      for (let i = 0; i < p.count; i++) {
        const kk = grad ? k * (grad[0] + (grad[1] - grad[0]) * ((p.getY(i) - gy0) / gyr)) : k;
        _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
        this.pos.push(_v.x, _v.y, _v.z);
        this.nor.push(_n.x, _n.y, _n.z);
        if (vc) this.col.push(vc.getX(i) * kk, vc.getY(i) * kk, vc.getZ(i) * kk);
        else this.col.push(_c.r * kk, _c.g * kk, _c.b * kk);
        this.idx.push(v0 + i);
      }
      this.vc += p.count;
    }

    toGeometry() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      geo.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      return geo;
    }
  };

  // Material compartido para todo lo que usa colores por vértice
  G.vcMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

  // Textura circular suave (para partículas y destellos)
  G.makeGlowTexture = function (inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner || 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, outer || 'rgba(255,220,140,0.8)');
    gr.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  };
})();

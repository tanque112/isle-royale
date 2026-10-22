/* =====================================================================
   roads.js — Red de carreteras de asfalto que une Ciudad Torres con
   todos los pueblos de la isla (y los pueblos entre sí).
   1) Se busca el trazado (A* sobre una rejilla) que evite cuestas, agua y pueblos, y se suaviza.
   2) Se calcula la altura de la carretera (sin cuestas de más del 14 %).
   3) Se aplana el terreno a lo largo del trazado.
   4) Se dibuja el asfalto con sus líneas encima del terreno.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;
  const W = G.World;

  const HALF = 3.8;     // media anchura del asfalto
  const FLAT = 6.5;     // hasta aquí el terreno queda totalmente plano
  const BLEND = 12;     // y en estos metros vuelve poco a poco al terreno natural
  const STEP = 2.5;     // distancia entre puntos del trazado
  const MAX_RISE = 0.4;  // subida máxima por paso (16 %)

  const _q = { d: 0, h: 0, i: 0, tx: 0, tz: 0 };
  // rejilla de tramos de carretera (casillas de RC metros)
  const RC = 24;
  const rkey = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);
  const _rst = new Int32Array(1024), _rd = new Float64Array(1024), _rh = new Float64Array(1024);
  const _near = { n: 0, rs: new Int32Array(1024) };
  let _stamp = 0;

  Object.assign(W, {
    roads: [],
    ROAD_HALF: HALF,

    /* ---------- 1) Planificar (antes de crear el terreno) ---------- */
    planRoads() {
      this.roads = [];
      this._rgrid = new Map();
      this._endUse = new Map();   // salidas de la ciudad / calles de cada pueblo ya usadas por otra carretera
      // Red de carreteras: un "árbol" que une todos los pueblos con el menor recorrido posible
      // y unas cuantas conexiones más para que haya caminos alternativos.
      const P = this.pois;
      const ONE = { mountain: 1, giantforest: 1 };                          // sólo una carretera llega hasta ellos
      const RING = { white: 1, western: 1, industrial: 1, castle: 1 };        // pueblos con muralla o calles fijas: final de ruta
      const maxDeg = (p) => (p.city ? 99 : p.type === 'beachtown' ? 3 : ONE[p.type] || RING[p.type] || 4);
      const deg = new Map(P.map((p) => [p, 0]));
      const links = new Map(P.map((p) => [p, []]));
      // ¿pasa la recta a-b muy cerca de otro pueblo?
      const crosses = (a, b) => P.some((c) => {
        if (c === a || c === b) return false;
        const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
        const t = U.clamp(((c.x - a.x) * ex + (c.z - a.z) * ez) / l2, 0, 1);
        return Math.hypot(a.x + ex * t - c.x, a.z + ez * t - c.z) < (c.city ? 120 : c.r + 25);
      });
      const cand = [];
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d > 460) continue;
          // la ciudad es el centro de la red: sus conexiones "cuestan" menos
          cand.push({ a, b, d, cost: d * (crosses(a, b) ? 1.8 : 1) * (a.city || b.city ? 0.75 : 1) });
        }
      }
      cand.sort((p, q) => p.cost - q.cost);
      // 1) árbol de mínimo recorrido (Kruskal)
      const parent = new Map(P.map((p) => [p, p]));
      const root = (p) => { while (parent.get(p) !== p) p = parent.get(p); return p; };
      const edges = [];
      const angleOk = (p, q) => links.get(p).every((o) => {
        const a1 = Math.atan2(q.z - p.z, q.x - p.x), a2 = Math.atan2(o.z - p.z, o.x - p.x);
        return Math.abs(U.angleDiff(a1, a2)) > 0.6;   // que no salgan dos carreteras casi juntas
      });
      const take = (e) => {
        edges.push(e); deg.set(e.a, deg.get(e.a) + 1); deg.set(e.b, deg.get(e.b) + 1);
        links.get(e.a).push(e.b); links.get(e.b).push(e.a);
      };
      for (const e of cand) {
        if (deg.get(e.a) >= maxDeg(e.a) || deg.get(e.b) >= maxDeg(e.b)) continue;
        const ra = root(e.a), rb = root(e.b);
        if (ra === rb) continue;
        parent.set(ra, rb);
        take(e);
      }
      // 2) atajos extra (sin pasar por otros pueblos, sin salir pegados a otra carretera y sin cruzarse
      //    con ninguna: así la red no tiene cruces raros en mitad del campo)
      const segX = (p1, p2, p3, p4) => {
        const d = (p2.x - p1.x) * (p4.z - p3.z) - (p2.z - p1.z) * (p4.x - p3.x);
        if (Math.abs(d) < 1e-9) return false;
        const t = ((p3.x - p1.x) * (p4.z - p3.z) - (p3.z - p1.z) * (p4.x - p3.x)) / d;
        const u = ((p3.x - p1.x) * (p2.z - p1.z) - (p3.z - p1.z) * (p2.x - p1.x)) / d;
        return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
      };
      const crossesEdge = (e) => edges.some((f) => f.a !== e.a && f.a !== e.b && f.b !== e.a && f.b !== e.b && segX(e.a, e.b, f.a, f.b));
      let extra = 0;
      for (const e of cand) {
        if (extra >= 8) break;
        if (crossesEdge(e)) continue;
        if (edges.includes(e) || e.cost > e.d || e.d > 380) continue;
        if (deg.get(e.a) >= Math.min(3, maxDeg(e.a)) || deg.get(e.b) >= Math.min(3, maxDeg(e.b))) continue;
        if (!angleOk(e.a, e.b) || !angleOk(e.b, e.a)) continue;
        take(e); extra++;
      }
      // 3) trazar cada carretera (el pueblo "especial" va al final: su carretera llega a él)
      this._costGrid = this._roadCostGrid();
      for (const e of edges) {
        let { a, b } = e;
        if (ONE[a.type] || RING[a.type] || b.city) [a, b] = [b, a];   // la ciudad siempre al principio
        const rd = this.planRoad(a, b);
        if (!rd) continue;
        this.roads.push(rd);
        this._indexRoad(rd, this.roads.length - 1);
      }
      this._costGrid = null;
    },

    /* Los extremos de una carretera al llegar a un pueblo, de fuera hacia dentro.
       q = el otro extremo (para saber por qué lado llega) */
    roadEnds(p, q) {
      let cx = q.x - p.x, cz = q.z - p.z;
      const cl = Math.hypot(cx, cz) || 1; cx /= cl; cz /= cl;
      const at = (t) => ({ x: p.x + cx * t, z: p.z + cz * t });
      let used = this._endUse.get(p);
      if (!used) { used = new Set(); this._endUse.set(p, used); }
      // elige la mejor salida libre de una lista {key, out: [fuera], inn: [dentro], dir: [dx, dz]}
      const choose = (list) => {
        let best = null, bs = -Infinity;
        for (const e of list) {
          if (used.has(e.key)) continue;
          const ox = e.inn.x - p.x, oz = e.inn.z - p.z, ol = Math.hypot(ox, oz) || 1;
          const sc = e.dir[0] * cx + e.dir[1] * cz + 0.6 * ((ox * cx + oz * cz) / ol);
          if (sc > bs) { bs = sc; best = e; }
        }
        if (!best) best = list[0];
        used.add(best.key);
        return [best.out, best.inn];
      };
      if (p.city) {
        // salida de la ciudad: cada carretera sale por una calle distinta
        const edge = this.cityHalf + 1, list = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (const s2 of [-60, -20, 20, 60]) {
            const P2 = (u) => (dx ? { x: dx * u, z: s2 } : { x: s2, z: dz * u });
            list.push({ key: dx + ',' + dz + ',' + s2, out: P2(edge + 30), inn: P2(edge - 4), dir: [dx, dz] });
          }
        }
        return choose(list);
      }
      if (p.type === 'beachtown') {
        // salidas del centro de Bahía Coral: por detrás (tierra adentro) y por los lados
        const { U, V, SW } = this.BEACH_DT, { Wp } = this.beachFrame(p);
        const alongX = Math.abs(p.x) > Math.abs(p.z), sg = Math.sign(alongX ? p.x : p.z) || 1;
        const dirOf = (du, dv) => (alongX ? [sg * du, dv] : [dv, sg * du]);
        const uBack = U[U.length - 1] - SW / 2, vSide = V[V.length - 1] + SW / 2;
        const list = [];
        for (const v of V.slice(1, -1)) list.push({ key: 'b' + v, out: Wp(uBack - 30, v), inn: Wp(uBack + 4, v), dir: dirOf(-1, 0) });
        for (const u of U.slice(1, -1)) for (const sd of [-1, 1]) list.push({ key: 's' + u + sd, out: Wp(u, sd * (vSide + 30)), inn: Wp(u, sd * (vSide - 4)), dir: dirOf(0, sd) });
        return choose(list);
      }
      if (p.town) {
        // pueblos: la carretera sigue una de sus 4 calles hasta la plaza
        const e = p.r - 4, list = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          list.push({ key: dx + ',' + dz, out: { x: p.x + dx * (e + 30), z: p.z + dz * (e + 30) }, inn: { x: p.x + dx * (e - 4), z: p.z + dz * (e - 4) }, dir: [dx, dz] });
        }
        return choose(list);
      }
      if (p.type === 'mountain') return [at(62), at(11)];
      if (p.type === 'giantforest') return [at(62), at(21)];
      // castillo: hasta la puerta de la muralla; los demás pueblos de calles fijas colocan sus casas
      // esquivando la carretera, así que llega hasta el centro (no se queda cortada en el campo)
      if (p.type === 'castle') return [at(p.r + 28), at(p.r + 4)];
      return [at(p.r + 22), at(12)];
    },

    // Una carretera de a hasta b: varios trazados posibles y nos quedamos con el más "barato"
    planRoad(a, b) {
      let ea = this.roadEnds(a, b).slice().reverse();     // de dentro de a hacia fuera
      let eb = this.roadEnds(b, a);                       // de fuera de b hacia dentro
      // si los pueblos están muy cerca, el punto de salida de uno puede quedar "detrás" del de
      // llegada del otro: la curva iría y volvería sobre sí misma. Entonces quitamos ese punto.
      const fwd = (p, q, dx, dz) => (q.x - p.x) * dx + (q.z - p.z) * dz;
      if (ea.length > 1 && fwd(ea[ea.length - 1], eb[0], ea[ea.length - 1].x - ea[ea.length - 2].x, ea[ea.length - 1].z - ea[ea.length - 2].z) < 0) ea = ea.slice(0, -1);
      if (eb.length > 1 && fwd(eb[0], ea[ea.length - 1], eb[0].x - eb[1].x, eb[0].z - eb[1].z) < 0) eb = eb.slice(1);
      const s0 = ea[ea.length - 1], e0 = eb[0];
      const ddx = e0.x - s0.x, ddz = e0.z - s0.z, L = Math.hypot(ddx, ddz) || 1;
      const nx = -ddz / L, nz = ddx / L;
      let best = null, bestCost = Infinity;
      // trazado natural: A* por la rejilla de costes, simplificado y suavizado
      const path = this._costGrid && L > 40 ? this._astar(this._costGrid, s0, e0) : null;
      if (path) {
        const simp = this._simplify(this._pull(path, this._costGrid), 4);
        const ctrl = ea.slice(0, -1).concat(simp, eb.slice(1));
        const arc = (l) => { let t = 0; for (let i = 1; i < l.length; i++) t += Math.hypot(l[i].x - l[i - 1].x, l[i].z - l[i - 1].z); return t; };
        // las entradas a los pueblos (en línea con su calle) no se mueven al suavizar
        best = this._smoothPath(this.spline(ctrl, STEP), Math.round(arc(ea) / STEP) + 1, Math.round(arc(eb) / STEP) + 1, 220);   // curvas amplias
      }
      // (si no hay camino, o los pueblos están pegados: una curva sencilla como antes)
      const offs = best ? [] : L > 70 ? [-0.2, -0.1, 0, 0.1, 0.2] : [0];
      for (const o1 of offs) for (const o2 of offs) {
        const ctrl = ea.slice();
        if (L > 70) {
          ctrl.push({ x: s0.x + ddx / 3 + nx * o1 * L, z: s0.z + ddz / 3 + nz * o1 * L });
          ctrl.push({ x: s0.x + (ddx * 2) / 3 + nx * o2 * L, z: s0.z + (ddz * 2) / 3 + nz * o2 * L });
        }
        ctrl.push(...eb);
        const pts = this.spline(ctrl, STEP);
        const cost = this.routeCost(pts, a, b);
        if (cost < bestCost) { bestCost = cost; best = pts; }
      }
      if (!best || best.length < 4) return null;

      // altura de la carretera: el terreno suavizado, sin cuestas fuertes
      const pts = best;
      const n = pts.length;
      const na = a.city ? 8 : 3, nb = b.city ? 8 : 2;
      const la = a.city ? this.cityLevel : a.level, lb = b.city ? this.cityLevel : b.level;
      let h = pts.map((q) => Math.max(1.3, this.height(q.x, q.z)));
      // puntos con altura fija: dentro de la zona llana de un pueblo, la del pueblo; donde cruza
      // otra carretera ya trazada, la de esa carretera (así no hay escalones)
      const pin = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        const q = pts[i];
        for (const zn of this.zones) if (this.zoneDist(zn, q.x, q.z) < zn.r + 0.5) pin[i] = zn.level;
        const nr = this._roadsNear(q.x, q.z);
        // (sólo si la diferencia es pequeña: nunca forzamos un salto imposible)
        for (let k = 0; k < nr.n; k++) if (_rd[nr.rs[k]] < HALF * 2 && Math.abs(_rh[nr.rs[k]] - h[i]) < 1.5) pin[i] = _rh[nr.rs[k]];
      }
      for (let it = 0; it < 4; it++) {
        const o = h.slice();
        for (let i = 0; i < n; i++) {
          let s2 = 0, c = 0;
          for (let k = -8; k <= 8; k++) { const j = U.clamp(i + k, 0, n - 1); s2 += o[j]; c++; }
          h[i] = s2 / c;
        }
      }
      for (let it = 0; it < 3; it++) {
        // los extremos se quedan a la altura de cada pueblo
        for (let i = 0; i < na && i < n; i++) h[i] = la;
        for (let i = Math.max(0, n - nb); i < n; i++) h[i] = lb;
        for (let i = 0; i < n; i++) if (!isNaN(pin[i])) h[i] = pin[i];
        for (let i = 1; i < n; i++) if (isNaN(pin[i])) h[i] = U.clamp(h[i], h[i - 1] - MAX_RISE, h[i - 1] + MAX_RISE);
        for (let i = n - 2; i >= 0; i--) if (isNaN(pin[i])) h[i] = U.clamp(h[i], h[i + 1] - MAX_RISE, h[i + 1] + MAX_RISE);
      }
      const road = { name: a.name + ' - ' + b.name, from: a, to: b, pts: pts.map((q, i) => ({ x: q.x, z: q.z, h: h[i] })) };
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const q of road.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
      const m = FLAT + BLEND + 2;
      Object.assign(road, { x0: x0 - m, z0: z0 - m, x1: x1 + m, z1: z1 + m });
      return road;
    },

    /* ---------- Trazado natural (A*) ----------
       Rejilla de casillas de 10 m con lo que "cuesta" pasar por cada una: las cuestas, el agua y
       los pueblos encarecen el paso; un ruido suave hace que en llano la carretera no vaya recta
       como una regla. Se calcula una vez, antes de trazar ninguna carretera. */
    _roadCostGrid() {
      const CS = 10, N = Math.ceil(C.worldSize / CS), half = (N * CS) / 2;
      const hg = new Float32Array(N * N), base = new Float32Array(N * N);
      const giant = this.pois.find((p) => p.type === 'giantforest');
      for (let iz = 0; iz < N; iz++) {
        for (let ix = 0; ix < N; ix++) {
          const x = -half + (ix + 0.5) * CS, z = -half + (iz + 0.5) * CS, i = iz * N + ix;
          const h = this.height(x, z);
          hg[i] = h;
          let c = 1 + 0.9 * U.clamp(this.noise.fbm(x * 0.005 + 91, z * 0.005 - 37, 2) * 0.5 + 0.5, 0, 1);
          if (h < 1) c += h < -2 ? 80 : 14;                                      // agua: casi nunca
          for (const zn of this.zones) if (this.zoneDist(zn, x, z) < zn.r + 5) { c += 40; break; }   // por dentro de los pueblos, no
          if (giant && Math.hypot(x - giant.x, z - giant.z) < 100) c += 4;      // ni atravesando el bosque gigante
          base[i] = c;
        }
      }
      return { CS, N, half, hg, base };
    },

    // Camino más "barato" de s0 a e0 por la rejilla (A*). Devuelve puntos cada 10 m o null.
    _astar(grid, s0, e0) {
      const { CS, N, half, hg, base } = grid;
      const cellOf = (p) => U.clamp(Math.floor((p.z + half) / CS), 0, N - 1) * N + U.clamp(Math.floor((p.x + half) / CS), 0, N - 1);
      const start = cellOf(s0), goal = cellOf(e0);
      const gx = goal % N, gz = (goal / N) | 0;
      const g = new Float32Array(N * N).fill(Infinity);
      const from = new Int32Array(N * N).fill(-1);
      const closed = new Uint8Array(N * N);
      const prox = new Float32Array(N * N).fill(-1);
      // cerca de otra carretera ya trazada cuesta más (que no vayan dos en paralelo; cruzarse sí se puede)
      const proxCost = (i) => {
        if (prox[i] >= 0) return prox[i];
        const nr = this._roadsNear(-half + (i % N + 0.5) * CS, -half + (((i / N) | 0) + 0.5) * CS);
        let d = Infinity;
        for (let k = 0; k < nr.n; k++) d = Math.min(d, _rd[nr.rs[k]]);
        return (prox[i] = d < 26 ? 3 * (1 - d / 26) : 0);
      };
      // montículo binario (cola de prioridad)
      const hn = [], hp = [];
      const push = (n, p) => {
        let i = hn.length; hn.push(n); hp.push(p);
        while (i > 0) { const j = (i - 1) >> 1; if (hp[j] <= hp[i]) break; [hn[i], hn[j]] = [hn[j], hn[i]]; [hp[i], hp[j]] = [hp[j], hp[i]]; i = j; }
      };
      const pop = () => {
        const top = hn[0], ln = hn.pop(), lp = hp.pop();
        if (hn.length) {
          hn[0] = ln; hp[0] = lp;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1; let m = i;
            if (l < hn.length && hp[l] < hp[m]) m = l;
            if (r < hn.length && hp[r] < hp[m]) m = r;
            if (m === i) break;
            [hn[i], hn[m]] = [hn[m], hn[i]]; [hp[i], hp[m]] = [hp[m], hp[i]]; i = m;
          }
        }
        return top;
      };
      const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
      g[start] = 0;
      push(start, 0);
      let it = 0;
      while (hn.length && it++ < 300000) {
        const cur = pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === goal) break;
        const cx = cur % N, cz = (cur / N) | 0;
        for (const [dx, dz, dl] of DIRS) {
          const x2 = cx + dx, z2 = cz + dz;
          if (x2 < 0 || z2 < 0 || x2 >= N || z2 >= N) continue;
          const ni = z2 * N + x2;
          if (closed[ni]) continue;
          const len = dl * CS;
          const grade = Math.abs(hg[ni] - hg[cur]) / len;   // pendiente
          const c = len * ((base[cur] + base[ni]) * 0.5 + grade * 22 + (grade > 0.12 ? (grade - 0.12) * 160 : 0) + proxCost(ni));
          const ng = g[cur] + c;
          if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ni, ng + 1.1 * CS * Math.hypot(x2 - gx, z2 - gz)); }
        }
      }
      if (start !== goal && from[goal] < 0) return null;
      const path = [];
      for (let c = goal; c !== -1; c = from[c]) {
        path.push({ x: -half + (c % N + 0.5) * CS, z: -half + (((c / N) | 0) + 0.5) * CS });
        if (c === start) break;
      }
      path.reverse();
      if (path.length < 2) return null;
      path[0] = { x: s0.x, z: s0.z };
      path[path.length - 1] = { x: e0.x, z: e0.z };
      return path;
    },

    /* "Tensar la cuerda": el camino de la rejilla va en escalones (sólo 8 direcciones). Desde cada
       punto saltamos al más lejano al que se llega en línea recta sin pasar por agua, pueblos ni
       cuestas fuertes (y sin tramos de más de 200 m, para que la carretera siga teniendo curvas). */
    _pull(path, grid) {
      const { CS, N, half, hg, base } = grid;
      const at = (x, z) => U.clamp(Math.floor((z + half) / CS), 0, N - 1) * N + U.clamp(Math.floor((x + half) / CS), 0, N - 1);
      const clear = (a, b) => {
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        if (L > 200) return false;
        const n = Math.max(2, Math.ceil(L / 5));
        let ph = hg[at(a.x, a.z)];
        for (let k = 1; k <= n; k++) {
          const t = k / n, i = at(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
          if (base[i] > 8) return false;
          if (Math.abs(hg[i] - ph) / CS > 0.14) return false;   // (las alturas son de casillas de 10 m)
          ph = hg[i];
        }
        return true;
      };
      const out = [path[0]];
      for (let i = 0; i < path.length - 1;) {
        let j = path.length - 1;
        while (j > i + 1 && !clear(path[i], path[j])) j--;
        out.push(path[j]);
        i = j;
      }
      return out;
    },

    // Quita los puntos que sobran de un camino en escalera (Douglas-Peucker)
    _simplify(pts, tol) {
      if (pts.length < 3) return pts.slice();
      const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
      const stack = [[0, pts.length - 1]];
      while (stack.length) {
        const [i0, i1] = stack.pop();
        const a = pts[i0], b = pts[i1], ex = b.x - a.x, ez = b.z - a.z, l = Math.hypot(ex, ez) || 1;
        let md = 0, mi = -1;
        for (let i = i0 + 1; i < i1; i++) {
          const d = Math.abs((pts[i].x - a.x) * ez - (pts[i].z - a.z) * ex) / l;
          if (d > md) { md = d; mi = i; }
        }
        if (md > tol) { keep[mi] = 1; stack.push([i0, mi], [mi, i1]); }
      }
      return pts.filter((_, i) => keep[i]);
    },

    // Suaviza las curvas (sin mover los primeros "ka" ni los últimos "kb" puntos) y reparte los puntos a la misma distancia
    _smoothPath(pts, ka, kb, iters) {
      let p = pts.map((q) => ({ x: q.x, z: q.z }));
      const n = p.length;
      for (let it = 0; it < iters; it++) {
        const o = p.map((q) => ({ x: q.x, z: q.z }));
        for (let i = Math.max(1, ka); i < n - Math.max(1, kb); i++) {
          p[i].x = o[i].x * 0.5 + (o[i - 1].x + o[i + 1].x) * 0.25;
          p[i].z = o[i].z * 0.5 + (o[i - 1].z + o[i + 1].z) * 0.25;
        }
      }
      return this.spline(p, STEP);
    },

    /* Rejilla de tramos de carretera: para saber rápido qué carreteras hay cerca de un punto
       (el terreno pregunta su altura cientos de miles de veces) */
    _indexRoad(rd, ri) {
      const m = FLAT + BLEND + 1, pts = rd.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const ix0 = Math.floor((Math.min(a.x, b.x) - m) / RC), ix1 = Math.floor((Math.max(a.x, b.x) + m) / RC);
        const iz0 = Math.floor((Math.min(a.z, b.z) - m) / RC), iz1 = Math.floor((Math.max(a.z, b.z) + m) / RC);
        for (let ix = ix0; ix <= ix1; ix++) {
          for (let iz = iz0; iz <= iz1; iz++) {
            const k = rkey(ix, iz);
            let l = this._rgrid.get(k);
            if (!l) { l = []; this._rgrid.set(k, l); }
            l.push(ri * 65536 + i);
          }
        }
      }
    },
    // Para cada carretera cerca de (x,z): distancia al eje y altura ahí (en _near: rs = índices de carretera)
    _roadsNear(x, z) {
      _near.n = 0;
      const l = this._rgrid && this._rgrid.get(rkey(Math.floor(x / RC), Math.floor(z / RC)));
      if (!l) return _near;
      _stamp++;
      for (let c = 0; c < l.length; c++) {
        const code = l[c], ri = Math.floor(code / 65536), i = code - ri * 65536;
        const pts = this.roads[ri].pts, a = pts[i], b = pts[i + 1];
        const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
        const t = U.clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
        const px = a.x + ex * t - x, pz = a.z + ez * t - z;
        const d = Math.sqrt(px * px + pz * pz);
        if (_rst[ri] !== _stamp) { _rst[ri] = _stamp; _rd[ri] = Infinity; _near.rs[_near.n++] = ri; }
        if (d < _rd[ri]) { _rd[ri] = d; _rh[ri] = a.h + (b.h - a.h) * t; }
      }
      return _near;
    },

    // Curva suave (Catmull-Rom) que pasa por los puntos, con un punto cada "step" metros
    spline(ctrl, step) {
      const dense = [];
      for (let i = 0; i < ctrl.length - 1; i++) {
        const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
        const segs = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z)));
        for (let k = 0; k < segs; k++) {
          const t = k / segs, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          dense.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
        }
      }
      dense.push({ x: ctrl[ctrl.length - 1].x, z: ctrl[ctrl.length - 1].z });
      // repartir los puntos a la misma distancia
      const out = [dense[0]];
      let acc = 0;
      for (let i = 1; i < dense.length; i++) {
        const a = dense[i - 1], b = dense[i];
        let seg = Math.hypot(b.x - a.x, b.z - a.z);
        let ax = a.x, az = a.z;
        while (acc + seg >= step) {
          const t = (step - acc) / seg;
          ax += (b.x - ax) * t; az += (b.z - az) * t;
          out.push({ x: ax, z: az });
          seg -= step - acc;
          acc = 0;
        }
        acc += seg;
      }
      const last = dense[dense.length - 1];
      if (Math.hypot(last.x - out[out.length - 1].x, last.z - out[out.length - 1].z) > step * 0.3) out.push(last);
      return out;
    },

    // Lo que "cuesta" un trazado: cuestas, agua y pasar por encima de otros pueblos
    routeCost(pts, from, dest) {
      let cost = 0, prev = null;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const h = this.height(q.x, q.z);
        if (prev !== null) cost += Math.abs(h - prev) * 3;
        prev = h;
        if (h < 0.8) cost += 25;
        if (Math.max(Math.abs(q.x), Math.abs(q.z)) < this.cityHalf - 2) cost += 80;
        for (const zn of [from, dest]) if (zn.town && Math.hypot(q.x - zn.x, q.z - zn.z) < zn.r - 10) cost += 40;
        for (const zn of this.pois) {
          if (zn === dest || zn === from || zn.city) continue;
          if (Math.hypot(q.x - zn.x, q.z - zn.z) < zn.r + 18) cost += 60;
        }
        cost += STEP * 0.05;
      }
      return cost;
    },

    /* ---------- Consultas ---------- */
    // Punto más cercano de la carretera: distancia y altura de la carretera ahí
    roadQuery(rd, x, z) {
      const pts = rd.pts;
      let bd = Infinity, bh = 0, bi = 0, btx = 1, btz = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const ex = b.x - a.x, ez = b.z - a.z;
        // descarte rápido
        const mx = (a.x + b.x) * 0.5 - x, mz = (a.z + b.z) * 0.5 - z;
        if (mx * mx + mz * mz > (bd + STEP) * (bd + STEP)) continue;
        const l2 = ex * ex + ez * ez || 1;
        const t = U.clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
        const px = a.x + ex * t - x, pz = a.z + ez * t - z;
        const d = Math.sqrt(px * px + pz * pz);
        if (d < bd) { bd = d; bh = a.h + (b.h - a.h) * t; bi = i; const l = Math.sqrt(l2); btx = ex / l; btz = ez / l; }
      }
      _q.d = bd; _q.h = bh; _q.i = bi; _q.tx = btx; _q.tz = btz;
      return _q;
    },

    // Altura del terreno con las carreteras aplanadas (la usa height())
    roadHeight(x, z, h) {
      if (this._rgrid) {
        // manda sólo la carretera más cercana (si no, dos carreteras cercanas se "pelean" por el terreno)
        const nr = this._roadsNear(x, z);
        let best = -1;
        for (let k = 0; k < nr.n; k++) if (best < 0 || _rd[nr.rs[k]] < _rd[best]) best = nr.rs[k];
        if (best >= 0 && _rd[best] < FLAT + BLEND) h = U.lerp(h, _rh[best], U.smoothstep(FLAT + BLEND, FLAT, _rd[best]));
        return h;
      }
      for (const rd of this.roads) {
        if (x < rd.x0 || x > rd.x1 || z < rd.z0 || z > rd.z1) continue;
        const q = this.roadQuery(rd, x, z);
        if (q.d >= FLAT + BLEND) continue;
        h = U.lerp(h, q.h, U.smoothstep(FLAT + BLEND, FLAT, q.d));
      }
      return h;
    },

    // ¿Está (x,z) sobre una carretera (o a menos de "margin" metros del borde)?
    nearRoad(x, z, margin) {
      if (this._rgrid && (margin || 0) < 15) {
        const nr = this._roadsNear(x, z);
        for (let k = 0; k < nr.n; k++) if (_rd[nr.rs[k]] < HALF + (margin || 0)) return true;
        return false;
      }
      for (const rd of this.roads) {
        if (x < rd.x0 || x > rd.x1 || z < rd.z0 || z > rd.z1) continue;
        if (this.roadQuery(rd, x, z).d < HALF + (margin || 0)) return true;
      }
      return false;
    },

    /* ---------- 3) Dibujar el asfalto (después de crear el terreno) ---------- */
    buildRoads(scene) {
      if (!this._roadMat) {
        // Capas para que nada parpadee de lejos (polygonOffset = "un poco más cerca de la cámara",
        // y ese margen crece con la distancia): terreno < calles de pueblos < carretera < líneas pintadas
        this._roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -24 });
        this._roadLineMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -40 });
      }
      const pos = [], col = [], idx = [];
      const lpos = [], lcol = [], lidx = [];   // líneas pintadas (malla aparte, por encima del asfalto)
      const c = new THREE.Color();
      const P = G.Phys;
      const lane = [-HALF - 0.8, -HALF, -HALF * 0.5, 0, HALF * 0.5, HALF, HALF + 0.8];
      const asphalt = new THREE.Color(0x4a4d52), gravel = new THREE.Color(0x9c8f6e);
      const quad = (a, b, cc, d) => { idx.push(a, b, cc, a, cc, d); };
      // ¿hay OTRA carretera aquí? (en los cruces no se pintan las líneas)
      const crossing = (ri, x, z) => {
        const nr = this._roadsNear(x, z);
        for (let k = 0; k < nr.n; k++) if (nr.rs[k] !== ri && _rd[nr.rs[k]] < HALF + 1.5) return true;
        return false;
      };
      // ¿pasa por aquí una carretera trazada ANTES? (en los cruces sólo se dibuja el asfalto de esa:
      // dos asfaltos a la misma altura parpadean)
      const under = (ri, x, z) => {
        const nr = this._roadsNear(x, z);
        for (let k = 0; k < nr.n; k++) if (nr.rs[k] < ri && _rd[nr.rs[k]] < HALF + 0.6) return true;
        return false;
      };
      this.roads.forEach((rd, ri) => {
        const pts = rd.pts, n = pts.length;
        const tangent = (i) => {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
          const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          return [(b.x - a.x) / l, (b.z - a.z) / l];
        };
        // franja de asfalto (siguiendo exactamente el terreno, un pelín por encima)
        const base = pos.length / 3;
        for (let i = 0; i < n; i++) {
          const [tx, tz] = tangent(i);
          const nx = -tz, nz = tx;
          for (let k = 0; k < lane.length; k++) {
            const o = lane[k];
            const x = pts[i].x + nx * o, z = pts[i].z + nz * o;
            const edge = k === 0 || k === lane.length - 1;
            pos.push(x, P.heightAt(x, z) + (edge ? 0.06 : 0.1), z);
            c.copy(edge ? gravel : asphalt).multiplyScalar(0.97 + Math.random() * 0.06);
            col.push(c.r, c.g, c.b);
          }
        }
        const L = lane.length;
        for (let i = 0; i < n - 1; i++) {
          for (let k = 0; k < L - 1; k++) {
            const a = base + i * L + k, b = base + (i + 1) * L + k;
            const mx = (pos[a * 3] + pos[(b + 1) * 3]) / 2, mz = (pos[a * 3 + 2] + pos[(b + 1) * 3 + 2]) / 2;
            if (under(ri, mx, mz)) continue;
            quad(a, a + 1, b + 1, b);
          }
        }
        // líneas: blancas en los bordes y discontinua amarilla en el centro
        const strip = (off, w, color, dash) => {
          c.set(color);
          for (let i = 0; i < n - 1; i++) {
            if (dash && (i % 4) >= 2) continue;
            if (crossing(ri, pts[i].x, pts[i].z) || crossing(ri, pts[i + 1].x, pts[i + 1].z)) continue;
            const v0 = lpos.length / 3;
            for (const j of [i, i + 1]) {
              const [tx, tz] = tangent(j);
              const nx = -tz, nz = tx;
              for (const s of [-w, w]) {
                const x = pts[j].x + nx * (off + s), z = pts[j].z + nz * (off + s);
                lpos.push(x, P.heightAt(x, z) + 0.13, z);
                lcol.push(c.r, c.g, c.b);
              }
            }
            lidx.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
          }
        };
        strip(-HALF + 0.35, 0.09, 0xf2f2f2, false);
        strip(HALF - 0.35, 0.09, 0xf2f2f2, false);
        strip(0, 0.11, 0xe8d36a, true);

        // nodos para los bots cada ~30 m y sitios para motos aparcadas
        for (let i = 12; i < n - 4; i += 12) {
          const q = pts[i];
          G.Nav.addNode(q.x, P.heightAt(q.x, q.z), q.z, true);
        }
        // una moto aparcada en las carreteras largas (sin pasarse: cada sitio es una moto)
        for (const f of n > 70 && ri % 3 === 0 ? [0.5] : []) {
          const i = Math.floor(n * f);
          const [tx, tz] = tangent(i);
          const side = this.r() < 0.5 ? -1 : 1;
          const x = pts[i].x - tz * (HALF + 1.6) * side, z = pts[i].z + tx * (HALF + 1.6) * side;
          this.motoSpots.push({ x, y: P.heightAt(x, z), z, yaw: Math.atan2(-tx, -tz) });
        }
      });
      if (!pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this._roadMat);
      mesh.receiveShadow = true;
      this.add(scene, mesh);
      if (lpos.length) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
        lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
        lg.setIndex(lidx);
        lg.computeVertexNormals();
        const lm = new THREE.Mesh(lg, this._roadLineMat);
        lm.receiveShadow = true;
        this.add(scene, lm);
      }
    },
  });
})();

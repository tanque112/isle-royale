/* =====================================================================
   nav.js — Red de navegación para los bots.
   Es un grafo de puntos (nodos) unidos por caminos (aristas):
   calles, puertas, centros de cada planta y escaleras.
   Con A* los bots encuentran cómo llegar a un sitio sin atravesar paredes.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  const Nav = (G.Nav = {
    nodes: [],

    reset() { this.nodes = []; this.grid = null; },

    addNode(x, y, z, outdoor) {
      const id = this.nodes.length;
      this.nodes.push({ id, x, y, z, outdoor: !!outdoor, edges: [] });
      return id;
    },

    link(a, b) {
      const A = this.nodes[a], B = this.nodes[b];
      const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
      if (!A.edges.some((e) => e.to === b)) A.edges.push({ to: b, cost: d });
      if (!B.edges.some((e) => e.to === a)) B.edges.push({ to: a, cost: d });
    },

    // ¿Se puede andar en línea recta de A a B? (sin cajas a la altura de rodillas y pecho)
    walkable(ax, ay, az, bx, by, bz) {
      const P = G.Phys;
      return P.lineClear(ax, ay + 0.7, az, bx, by + 0.7, bz, false) &&
             P.lineClear(ax, ay + 1.5, az, bx, by + 1.5, bz, false);
    },

    // Une entre sí todos los nodos exteriores que se ven
    linkOutdoor() {
      const out = this.nodes.filter((n) => n.outdoor);
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const a = out[i], b = out[j];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d > 170 || Math.abs(a.y - b.y) > 25) continue;
          if (this.walkable(a.x, a.y, a.z, b.x, b.y, b.z)) this.link(a.id, b.id);
        }
      }
      this.buildGrid();
    },

    // Nodo más cercano al que se puede llegar andando en línea recta
    buildGrid() {
      this.grid = new Map();
      for (const n of this.nodes) {
        const k = Math.floor(n.x / 40) + ',' + Math.floor(n.z / 40);
        let a = this.grid.get(k);
        if (!a) { a = []; this.grid.set(k, a); }
        a.push(n);
      }
    },

    near(x, z, r) {
      if (!this.grid) this.buildGrid();
      const out = [];
      const x0 = Math.floor((x - r) / 40), x1 = Math.floor((x + r) / 40), z0 = Math.floor((z - r) / 40), z1 = Math.floor((z + r) / 40);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const a = this.grid.get(i + ',' + j);
        if (a) for (const n of a) out.push(n);
      }
      return out;
    },

    nearestReachable(x, y, z, maxD) {
      const cands = [];
      for (const n of this.near(x, z, maxD || 70)) {
        if (Math.abs(n.y - y) > 2.2) continue;
        const d = Math.hypot(n.x - x, n.z - z);
        if (d > (maxD || 70)) continue;
        cands.push({ n, d });
      }
      cands.sort((p, q) => p.d - q.d);
      for (let i = 0; i < cands.length && i < 8; i++) {
        const n = cands[i].n;
        if (this.walkable(x, y, z, n.x, n.y, n.z)) return n.id;
      }
      return -1;
    },

    nearestOutdoor(x, z) {
      let best = -1, bd = Infinity;
      for (const n of this.nodes) {
        if (!n.outdoor) continue;
        const d = Math.hypot(n.x - x, n.z - z);
        if (d < bd) { bd = d; best = n.id; }
      }
      return best;
    },

    // A* con un "montículo" (cola de prioridad): rápido aunque haya muchos nodos
    astar(start, goal) {
      const N = this.nodes, n = N.length;
      if (!this._g || this._g.length < n) {
        this._g = new Float32Array(n); this._came = new Int32Array(n); this._closed = new Uint8Array(n);
      }
      const g = this._g, came = this._came, closed = this._closed;
      g.fill(Infinity, 0, n); came.fill(-1, 0, n); closed.fill(0, 0, n);
      const gx = N[goal].x, gy = N[goal].y, gz = N[goal].z;
      const h = (id) => Math.hypot(N[id].x - gx, N[id].y - gy, N[id].z - gz);
      const heap = [];            // pares [f, id]
      const push = (f, id) => {
        heap.push([f, id]);
        let i = heap.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1, r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
          }
        }
        return top;
      };
      g[start] = 0;
      push(h(start), start);
      while (heap.length) {
        const cur = pop()[1];
        if (closed[cur]) continue;
        if (cur === goal) {
          const path = [cur];
          let c = cur;
          while (came[c] >= 0) { c = came[c]; path.push(c); }
          return path.reverse();
        }
        closed[cur] = 1;
        for (const e of N[cur].edges) {
          if (closed[e.to]) continue;
          const ng = g[cur] + e.cost;
          if (ng < g[e.to]) { g[e.to] = ng; came[e.to] = cur; push(ng + h(e.to), e.to); }
        }
      }
      return null;
    },

    /* Devuelve una lista de puntos {x,y,z} para ir de "from" a "to".
       Si se puede ir recto, la lista es sólo el destino. */
    findPath(from, to) {
      const sameLevel = Math.abs(from.y - to.y) < 2.0;
      if (sameLevel && this.walkable(from.x, from.y, from.z, to.x, to.y, to.z)) return [{ x: to.x, y: to.y, z: to.z }];
      let a = this.nearestReachable(from.x, from.y, from.z, 80);
      if (a < 0) a = this.nearestOutdoor(from.x, from.z);
      let b = this.nearestReachable(to.x, to.y, to.z, 80);
      if (b < 0) b = this.nearestOutdoor(to.x, to.z);
      if (a < 0 || b < 0) return [{ x: to.x, y: to.y, z: to.z }];
      const ids = a === b ? [a] : this.astar(a, b);
      if (!ids) return [{ x: to.x, y: to.y, z: to.z }];
      const pts = ids.map((id) => ({ x: this.nodes[id].x, y: this.nodes[id].y, z: this.nodes[id].z }));
      pts.push({ x: to.x, y: to.y, z: to.z });
      return pts;
    },
  });
})();

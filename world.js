/* =====================================================================
   world.js — Genera la isla: terreno, mar, la ciudad de torres
   (edificios de varias plantas con escaleras y ventanas), pueblos,
   árboles, rocas y los puntos donde aparece el botín y los cofres.
   Casi todo lo que hay encima del suelo se puede romper (ver destruct.js).
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;
  const D = G.Destruct;
  const H = C.floorHeight;
  const SL = 0.3;     // grosor de los forjados (suelos)
  const WT = 0.35;    // grosor de las paredes

  const PAL_CITY = [
    { wall: 0xa4553f, trim: 0xd9cbb0, floor: 0x8b6b4a, roof: 0x55524e, stair: 0x9a948a },
    { wall: 0xd8c7a0, trim: 0x8c7b5f, floor: 0x9c7a55, roof: 0x5b5753, stair: 0xa8a090 },
    { wall: 0x9ea3a8, trim: 0x5f6670, floor: 0x7d6b55, roof: 0x47484a, stair: 0x8d8f92 },
    { wall: 0x6aa9a4, trim: 0xe8e2d0, floor: 0x8e6e4e, roof: 0x4d5152, stair: 0xb0aa9a },
    { wall: 0x7c3b2e, trim: 0xc9b79c, floor: 0x7f5f40, roof: 0x4a4644, stair: 0x9a8f80 },
    { wall: 0xeee3c4, trim: 0xb5523b, floor: 0x93704d, roof: 0x5a5550, stair: 0xa59a88 },
    { wall: 0xc08552, trim: 0xf0e2c8, floor: 0x7a5a3c, roof: 0x4f4b47, stair: 0xa0968a },
  ];
  const PAL_HOUSE = [
    { wall: 0xb98a5a, trim: 0xf0e6d2, floor: 0x8b6b4a, roof: 0x6b3a2a, stair: 0x9a7b5a },
    { wall: 0xe9e4da, trim: 0x6b4f3a, floor: 0x9c7a55, roof: 0x3f4a5a, stair: 0xa08a70 },
    { wall: 0x7fa7c9, trim: 0xf4f1ea, floor: 0x8e6e4e, roof: 0x5a3a2a, stair: 0x9a8a78 },
    { wall: 0xd9b26a, trim: 0x7a4b2a, floor: 0x7f5f40, roof: 0x4a3a32, stair: 0x9a8a78 },
  ];
  const PAL_BARN = { wall: 0xa8322d, trim: 0xf2eee6, floor: 0x8b6b4a, roof: 0x4a3a32, stair: 0x9a7b5a };
  // casitas de playa: colores pastel con tejado de teja o turquesa
  const PAL_BEACH = [
    { wall: 0x9fe3d1, trim: 0xffffff, roof: 0xd9734e },
    { wall: 0xf7b2c4, trim: 0xffffff, roof: 0x3e8e9e },
    { wall: 0xa8d8f0, trim: 0xfdfdfd, roof: 0xc4553a },
    { wall: 0xfde68a, trim: 0xffffff, roof: 0x2f7f8f },
    { wall: 0xcdb4f0, trim: 0xffffff, roof: 0xe0a030 },
    { wall: 0xffc49b, trim: 0xffffff, roof: 0x4a7fb5 },
  ];
  const PAL_HOTEL = { wall: 0xf7f1e3, trim: 0x2f7f8f, floor: 0xc49a6c, roof: 0xd9734e, stair: 0xd9cbb0 };
  const PAL_APART = { wall: 0xffd6a5, trim: 0x2f7f8f, floor: 0xc49a6c, roof: 0x3e8e9e, stair: 0xd9cbb0 };
  // casas de montaña (chalés de madera oscura con tejado muy inclinado)
  const PAL_ALPINE = [
    { wall: 0x7a5233, trim: 0xf2eee6, roof: 0x3d3f45 },
    { wall: 0x8b5e3c, trim: 0xffffff, roof: 0x8a2f24 },
    { wall: 0xd9cbb0, trim: 0x5a3a22, roof: 0x4a3328 },
    { wall: 0x9c6b45, trim: 0xf4ead8, roof: 0x2f4f3a },
  ];
  // cabañas de troncos del bosque
  const PAL_LOG = { wall: 0x7b5233, trim: 0x4e3420, floor: 0x8b6b4a, roof: 0x3d4a35, stair: 0x8a6a48 };

  const W = (G.World = {
    seed: 1,
    rng: Math.random,
    noise: null,
    zones: [],
    pois: [],
    buildings: [],
    lootSpots: [],
    chestSpots: [],
    chunks: new Map(),
    objects: [],
    cityLevel: 9,
    calm: [],
    bumps: [],
    cityHalf: 105,

    r() { return this.rng(); },
    rr(a, b) { return a + this.rng() * (b - a); },
    ri(a, b) { return Math.floor(a + this.rng() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; },

    /* ---------- Construcción por trozos (chunks) ---------- */
    chunk(x, z) {
      const k = Math.floor(x / 100) + ',' + Math.floor(z / 100);
      let b = this.chunks.get(k);
      if (!b) { b = new G.GeoBuilder(); this.chunks.set(k, b); }
      return b;
    },
    // caja sólo visual
    vbox(x0, y0, z0, x1, y1, z1, color, opts) {
      const b = this.chunk((x0 + x1) / 2, (z0 + z1) / 2);
      const s = b.vc;
      b.box(x0, y0, z0, x1, y1, z1, color, opts);
      if (D.active) { D.addRange(D.active, b, s, b.vc); D.grow(D.active, x0, y0, z0, x1, y1, z1); }
    },
    /* Caja pegada al suelo (asfalto, aceras, plazas, líneas pintadas): va en una malla aparte que se
       dibuja "un poco por delante" del terreno (polygonOffset) para que no parpadee vista de lejos.
       layer 2 = encima de la capa 1 (las líneas sobre el asfalto) */
    gbox(x0, y0, z0, x1, y1, z1, color, opts, layer) {
      const L = this.dchunks[layer === 2 ? 1 : 0];
      const k = Math.floor((x0 + x1) / 200) + ',' + Math.floor((z0 + z1) / 200);
      let b = L.get(k);
      if (!b) { b = new G.GeoBuilder(); L.set(k, b); }
      b.box(x0, y0, z0, x1, y1, z1, color, opts);
    },
    // caja visual + colisión
    solid(x0, y0, z0, x1, y1, z1, color, opts) {
      this.vbox(x0, y0, z0, x1, y1, z1, color, opts);
      const box = G.Phys.addBox(x0, y0, z0, x1, y1, z1);
      if (D.active) D.addBox(D.active, box);
      return box;
    },
    vgeo(geo, matrix, color, jitter, grad) {
      const e = matrix.elements;
      const b = this.chunk(e[12], e[14]);
      const s = b.vc;
      b.geometry(geo, matrix, color, jitter, grad);
      if (D.active) D.addRange(D.active, b, s, b.vc);
    },
    /* Follaje (copas de árboles, palmeras, arbustos): va en mallas aparte con un material
       que las mueve un poco con el viento */
    fgeo(geo, matrix, color, jitter, grad) {
      const e = matrix.elements;
      const k = Math.floor(e[12] / 100) + ',' + Math.floor(e[14] / 100);
      let b = this.fchunks.get(k);
      if (!b) { b = new G.GeoBuilder(); this.fchunks.set(k, b); }
      const s = b.vc;
      b.geometry(geo, matrix, color, jitter, grad);
      if (D.active) D.addRange(D.active, b, s, b.vc);
    },
    ramp(x0, z0, x1, z1, axis, yMin, yMax) {
      const sf = G.Phys.addRamp(x0, z0, x1, z1, axis, yMin, yMax);
      if (D.active) D.active.surfs.push(sf);
    },

    /* ---------- Generación completa ---------- */
    generate(scene, seed) {
      this.seed = seed;
      this.rng = G.makeRng(seed);
      this.noise = new G.Noise(seed);
      this.zones = []; this.pois = []; this.buildings = [];
      this.lootSpots = []; this.chestSpots = []; this.chunks = new Map(); this.fchunks = new Map();
      this.dchunks = [new Map(), new Map()];   // calcomanías del suelo (ver gbox)
      this.interiors = [];
      this.mapStreets = [];  // calles de los pueblos (para dibujarlas en el mapa)   // lista de interiores amueblados (tipo y sitio)
      this.billboards = [];   // vallas publicitarias (llevan una textura: se crean al final)
      this.mapTrees = [];
      this.motoSpots = [];   // dónde aparecen las motos aparcadas
      this.roads = [];
      for (const o of this.objects) { scene.remove(o); if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); }
      this.objects = [];
      G.Phys.reset();
      G.Nav.reset();
      D.reset();
      this.makeTemplates();

      this.planZones();
      this.planRoads();
      this.buildTerrain(scene);
      this.buildWater(scene);
      this.buildRoads(scene);
      this.buildCity();
      for (const p of this.pois) if (!p.city) this.buildPOI(p);
      this.scatterNature();
      this.scatterOutdoorLoot();
      this.flushChunks(scene);
      this.buildSky(scene);
      this.buildClouds(scene);
      G.Nav.linkOutdoor();
    },

    add(scene, obj) { scene.add(obj); this.objects.push(obj); },

    /* ---------- Terreno ---------- */
    baseHeight(x, z) {
      const N = this.noise;
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      const edge = C.islandRadius + 70 * N.fbm(Math.cos(a) * 1.3 + 7.1, Math.sin(a) * 1.3 + 3.3, 3);
      const land = U.smoothstep(edge + 20, edge - 55, r);
      let h = 7 + N.fbm(x * 0.0065 + 3, z * 0.0065 - 5, 4) * 9;
      const m = Math.max(0, N.fbm(x * 0.0032 + 40, z * 0.0032 - 20, 3) - 0.05);
      // zonas "tranquilas" (alrededor del pueblo de playa) donde no crecen montañas
      let calm = 1;
      for (const c of this.calm) calm = Math.min(calm, U.smoothstep(c.r * 0.55, c.r, Math.hypot(x - c.x, z - c.z)));
      h += m * m * 170 * calm;
      // montaña hecha a propósito para el pueblo de montaña
      for (const b of this.bumps) {
        const d = Math.hypot(x - b.x, z - b.z);
        if (d < b.r) h += b.h * (1 - U.smoothstep(0, b.r, d));
      }
      return U.lerp(-9, h, land);
    },

    height(x, z) {
      let h = this.baseHeight(x, z);
      for (const zn of this.zones) {
        const d = this.zoneDist(zn, x, z);
        if (d > zn.r + zn.blend) continue;
        const t = U.smoothstep(zn.r + zn.blend, zn.r, d);
        h = U.lerp(h, zn.level, t);
      }
      // las carreteras aplanan el terreno por donde pasan
      if (this.roads.length) h = this.roadHeight(x, z, h);
      return h;
    },

    // Distancia "de zona": círculo, cuadrado o rectángulo (box = medias anchuras en x y z)
    zoneDist(zn, x, z) {
      const dx = x - zn.x, dz = z - zn.z;
      if (zn.box) return zn.r + Math.hypot(Math.max(0, Math.abs(dx) - zn.box[0]), Math.max(0, Math.abs(dz) - zn.box[1]));
      return zn.square ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
    },

    planZones() {
      this.calm = [];
      this.bumps = [];
      this.zones.push({ x: 0, z: 0, r: 112, blend: 50, level: this.cityLevel, square: true });
      // la ciudad es el sitio principal: es donde más bots deciden caer
      this.pois.push({ name: 'Ciudad Torres', x: 0, z: 0, r: 100, level: this.cityLevel, weight: 4, city: true });
      // Bahía Coral (pueblo de playa) y Bosque Gigante están en lados opuestos de la isla
      const defs = [
        { name: 'Granja Vieja', ang: 0, dist: 520, type: 'farm' },
        { name: 'Bahía Coral', ang: 45, type: 'beachtown', weight: 3.5 },
        { name: 'Pinar Alto', ang: 90, dist: 500, type: 'forest' },
        { name: 'Puerto Brisa', ang: 135, dist: 600, type: 'harbor' },
        { name: 'Colina Seca', ang: 180, dist: 510, type: 'hill' },
        { name: 'Bosque Gigante', ang: 225, dist: 450, type: 'giantforest', weight: 0.9 },
        { name: 'Playa Sol', ang: 270, dist: 600, type: 'beach' },
        { name: 'Villa Cumbre', ang: 315, dist: 520, type: 'mountain', weight: 1.3 },
        // anillo intermedio (la isla ahora es el doble de ancha: así no quedan zonas vacías)
        { name: 'Rancho Lomas', ang: 22.5, dist: 380, type: 'farm' },
        { name: 'Cerro Rojo', ang: 67.5, dist: 390, type: 'hill' },
        { name: 'Arboleda Fría', ang: 112.5, dist: 400, type: 'forest' },
        { name: 'Prado Verde', ang: 157.5, dist: 380, type: 'farm' },
        { name: 'Peñas Grises', ang: 190, dist: 330, type: 'hill' },   // (más lejos del Bosque Gigante)
        { name: 'Huerta Vieja', ang: 247.5, dist: 400, type: 'farm' },
        { name: 'Pinar del Sur', ang: 292.5, dist: 390, type: 'forest' },
        { name: 'Mirador Alto', ang: 350, dist: 360, type: 'hill' },   // (lejos de la montaña de Villa Cumbre)
        // pueblos nuevos cerca de la costa, en los huecos entre los de fuera
        { name: 'Valle Hondo', ang: 22.5, dist: 640, type: 'village' },
        { name: 'Cala Serena', ang: 67.5, dist: 650, type: 'beach' },
        { name: 'Los Molinos', ang: 112.5, dist: 640, type: 'farm' },
        { name: 'Puerto Viejo', ang: 157.5, dist: 660, type: 'harbor', big: true },
        { name: 'Aldea Roble', ang: 202.5, dist: 640, type: 'forest' },
        { name: 'Llano Alto', ang: 247.5, dist: 640, type: 'village', big: true },
        { name: 'Monte Claro', ang: 292.5, dist: 640, type: 'hill' },
        { name: 'Villa Sauce', ang: 337.5, dist: 640, type: 'village', big: true },
        // pueblos nuevos alrededor de la ciudad (entre ella y los de fuera), cada uno con su estilo (ver towns.js)
        { name: 'Pueblo Blanco', ang: 112.5, type: 'white', r: 40, ring: true },
        { name: 'Villa Polvo', ang: 157.5, type: 'western', r: 40, box: [42, 26], ring: true },
        { name: 'Polígono Acero', ang: 247.5, type: 'industrial', r: 40, box: [38, 32], ring: true },
        { name: 'Fuerte Real', ang: 337.5, type: 'castle', r: 36, ring: true },
      ];
      const off = this.rr(0, 360);
      for (const d of defs) {
        const a = ((d.ang + off + this.rr(-4, 4)) * Math.PI) / 180;
        if (d.type === 'beachtown') { this.planShoreTown(d, a); continue; }
        if (d.type === 'mountain') { this.planMountainTown(d, a); continue; }
        if (d.ring) { this.planRingTown(d, a); continue; }
        // pueblos grandes (70 m de radio): plaza, calles en cruz y casas (ver villages.js)
        const town = d.type !== 'giantforest';
        const r = town ? (d.big ? 95 : 70) : 26;   // pueblos grandes: 95 m; el bosque gigante sólo tiene un claro pequeño
        let dist = d.dist, x = 0, z = 0, h = 0;
        for (let i = 0; i < 20; i++) {
          x = Math.cos(a) * dist; z = Math.sin(a) * dist;
          h = this.baseHeight(x, z);
          // que el pueblo entero quede en tierra (si no, se mete un poco hacia dentro)
          const k = (dist + r * 0.9) / dist;
          if (h > 3.5 && this.baseHeight(x * k, z * k) > 0.5) break;
          dist -= 15;
        }
        const level = U.clamp(h, 3.5, 20);
        this.zones.push({ x, z, r, blend: 28, level, square: false });
        this.pois.push({ name: d.name, x, z, r, level, weight: d.weight || 1, type: d.type, town, plazaR: 13 });
      }
    },

    /* El pueblo de playa se pone justo en la orilla: buscamos dónde acaba la arena
       en esa dirección y metemos el centro del pueblo unos metros tierra adentro. */
    planShoreTown(d, a) {
      const ca = Math.cos(a), sa = Math.sin(a);
      let shore = C.islandRadius * 0.6;
      for (let dist = C.islandRadius + 110; dist > C.islandRadius * 0.4; dist -= 3) {
        if (this.baseHeight(ca * dist, sa * dist) > 1.0) { shore = dist; break; }
      }
      // los ejes del pueblo van alineados con X o Z (hacia el mar)
      const x = ca * (shore - 28), z = sa * (shore - 28);
      const level = 2.35;
      const alongX = Math.abs(x) > Math.abs(z), sg = Math.sign(alongX ? x : z) || 1;
      // zona rectangular: de u = -40 (tierra) a u = +36 (mar), y 94 m a cada lado a lo largo de la costa
      const cu = -2, hu = 38, hv = 94;
      const zx = alongX ? x + sg * cu : x, zz = alongX ? z : z + sg * cu;
      this.zones.push({ x: zx, z: zz, r: 0, blend: 26, level, box: alongX ? [hu, hv] : [hv, hu] });
      // centro urbano tierra adentro (u de -174 a -34, v de -92 a 92): ver buildBeachDowntown en villages.js
      const du = -104, dhu = 70, dhv = 92;
      this.zones.push({ x: alongX ? x + sg * du : x, z: alongX ? z : z + sg * du, r: 0, blend: 30, level, box: alongX ? [dhu, dhv] : [dhv, dhu] });
      this.calm.push({ x, z, r: 300 });
      this.pois.push({ name: d.name, x, z, r: 120, level, weight: d.weight || 1, type: d.type, downtown: true });
    },

    /* Pueblo de montaña: si en ese sitio no hay ya una montaña, la creamos (no muy alta) */
    planMountainTown(d, a) {
      const x = Math.cos(a) * d.dist, z = Math.sin(a) * d.dist;
      const target = 25;
      const base = this.baseHeight(x, z);
      const bh = Math.max(0, target - base);
      if (bh > 0) this.bumps.push({ x, z, r: 95, h: bh * 1.18 });
      const level = Math.min(32, Math.max(target, base));
      this.zones.push({ x, z, r: 42, blend: 24, level, square: false });
      this.pois.push({ name: d.name, x, z, r: 40, level, weight: d.weight || 1, type: d.type });
    },

    buildTerrain(scene) {
      const n = C.terrainSeg + 1, size = C.worldSize, half = size / 2, step = size / (n - 1);
      const heights = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
          heights[iz * n + ix] = this.height(-half + ix * step, -half + iz * step);
        }
      }
      G.Phys.setTerrain(heights, n, size);

      const pos = new Float32Array(n * n * 3);
      const col = new Float32Array(n * n * 3);
      const c = new THREE.Color();
      const sand = new THREE.Color(0xead69c), wet = new THREE.Color(0xc2ab78);
      const g1 = new THREE.Color(0x55a032), g2 = new THREE.Color(0x3e8a2a), g3 = new THREE.Color(0x70b238), dry = new THREE.Color(0xa0a352);
      const rock = new THREE.Color(0x9a978f), asphalt = new THREE.Color(0x4a4d52);
      for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
          const i = iz * n + ix;
          const x = -half + ix * step, z = -half + iz * step, h = heights[i];
          pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
          const hx = heights[iz * n + Math.min(n - 1, ix + 1)] - heights[iz * n + Math.max(0, ix - 1)];
          const hz = heights[Math.min(n - 1, iz + 1) * n + ix] - heights[Math.max(0, iz - 1) * n + ix];
          const slope = Math.hypot(hx, hz) / (2 * step);
          if (Math.max(Math.abs(x), Math.abs(z)) < this.cityHalf + 4) c.copy(asphalt);
          else if (h < -0.4) c.copy(wet);
          else if (h < 2.2) c.copy(sand);
          else {
            const nz = this.noise.fbm(x * 0.02, z * 0.02, 2) * 0.5 + 0.5;
            c.copy(g1).lerp(g2, nz);
            // manchas de hierba más clara, como pintadas a mano
            const pz = this.noise.fbm(x * 0.006 + 11, z * 0.006 - 7, 2);
            c.lerp(g3, U.smoothstep(0.15, 0.45, pz) * 0.55);
            for (const p of this.pois) {
              if (p.city) continue;
              const d = Math.hypot(x - p.x, z - p.z);
              if (d < p.r + 10) c.lerp(dry, 0.45 * U.smoothstep(p.r + 10, p.r - 10, d));
            }
            const rk = U.clamp(Math.max((slope - 0.55) * 2.5, (h - 32) / 12), 0, 1);
            if (rk > 0) c.lerp(rock, rk);
            if (h < 3.2) c.lerp(sand, U.smoothstep(3.2, 2.2, h));
          }
          const k = 0.96 + Math.random() * 0.08;
          col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
        }
      }
      const idx = new Uint32Array((n - 1) * (n - 1) * 6);
      let p = 0;
      for (let iz = 0; iz < n - 1; iz++) {
        for (let ix = 0; ix < n - 1; ix++) {
          const a = iz * n + ix, b = (iz + 1) * n + ix, cc = iz * n + ix + 1, d = (iz + 1) * n + ix + 1;
          idx[p++] = a; idx[p++] = b; idx[p++] = cc;
          idx[p++] = b; idx[p++] = d; idx[p++] = cc;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, G.vcMaterial);
      mesh.receiveShadow = true;
      this.add(scene, mesh);
      this.terrainMesh = mesh;
    },

    /* ---------- Mar ----------
       Un material que dibuja olas suaves, el color según la profundidad (turquesa en la
       orilla, azul oscuro mar adentro), espuma que va y viene en la playa y brillos del sol.
       La profundidad de cada punto se calcula una vez a partir del terreno. */
    waterMaterial() {
      if (this._waterMat) return this._waterMat;
      this.timeU = this.timeU || { value: 0 };
      const m = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, shininess: 90, specular: 0x8fb4cc });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.timeU;
        sh.vertexShader = 'attribute float depth;\nuniform float uTime;\nvarying float vDepth;\nvarying vec2 vXZ;\n' + sh.vertexShader
          .replace('#include <beginnormal_vertex>', [
            'float wA = 0.09 * smoothstep(0.3, 3.0, depth);',
            'float ph1 = position.x * 0.09 + uTime * 1.25;',
            'float ph2 = position.z * 0.12 + uTime * 1.05;',
            'float ph3 = (position.x + position.z) * 0.05 + uTime * 0.7;',
            'float wH = wA * (sin(ph1) + sin(ph2) + 0.6 * sin(ph3));',
            'float wDx = wA * (0.09 * cos(ph1) + 0.03 * cos(ph3));',
            'float wDz = wA * (0.12 * cos(ph2) + 0.03 * cos(ph3));',
            'vec3 objectNormal = normalize(vec3(-wDx * 4.0, 1.0, -wDz * 4.0));',
          ].join('\n'))
          .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += wH;\nvDepth = depth;\nvXZ = position.xz;');
        sh.fragmentShader = 'uniform float uTime;\nvarying float vDepth;\nvarying vec2 vXZ;\n' + sh.fragmentShader
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'float dd = vDepth;',
            'vec3 wc = mix(vec3(0.33, 0.88, 0.80), vec3(0.10, 0.62, 0.82), smoothstep(0.0, 2.5, dd));',
            'wc = mix(wc, vec3(0.04, 0.30, 0.58), smoothstep(2.5, 10.0, dd));',
            'float wob = 0.35 * sin(uTime * 1.4 + vXZ.x * 0.21 + vXZ.y * 0.17) + 0.25 * sin(uTime * 2.1 - vXZ.y * 0.33);',
            'float foam = 1.0 - smoothstep(0.05, 0.8, dd + wob * 0.35);',
            'float stripe = smoothstep(0.6, 0.95, sin(dd * 6.0 - uTime * 2.2)) * (1.0 - smoothstep(0.5, 1.8, dd));',
            'float camD = length(vViewPosition);',
            // los brillos sólo de cerca: de lejos formarían una trama de puntitos
            'float spark = smoothstep(0.93, 1.0, sin(vXZ.x * 0.9 + uTime * 1.9) * sin(vXZ.y * 1.1 - uTime * 1.6)) * smoothstep(1.5, 6.0, dd) * (1.0 - smoothstep(25.0, 70.0, camD));',
            'foam = clamp(max(foam, stripe * 0.75), 0.0, 1.0);',
            'diffuseColor.rgb = mix(wc, vec3(0.97, 0.99, 1.0), foam * 0.9) + spark * 0.18;',
            'diffuseColor.a = clamp(mix(0.5, 0.93, smoothstep(0.0, 3.5, dd)) + foam * 0.5, 0.0, 1.0);',
          ].join('\n'))
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nfloat rip = 0.05 * (1.0 - smoothstep(30.0, 90.0, length(vViewPosition)));\nnormal = normalize(normal + vec3(rip * sin(vXZ.x * 1.7 + uTime * 2.0), 0.0, rip * cos(vXZ.y * 1.9 + uTime * 1.7)));');
      };
      m.customProgramCacheKey = () => 'islaWater';
      this._waterMat = m;
      return m;
    },

    buildWater(scene) {
      const mat = this.waterMaterial();
      // mar alrededor de la isla: malla fina con la profundidad de cada punto
      const half = C.worldSize / 2 + 100, n = 420, step = (half * 2) / n;
      const N1 = (n + 1) * (n + 1);
      const pos = new Float32Array(N1 * 3), dep = new Float32Array(N1), nor = new Float32Array(N1 * 3);
      for (let iz = 0; iz <= n; iz++) {
        for (let ix = 0; ix <= n; ix++) {
          const i = iz * (n + 1) + ix, x = -half + ix * step, z = -half + iz * step;
          pos[i * 3] = x; pos[i * 3 + 1] = C.waterLevel; pos[i * 3 + 2] = z;
          nor[i * 3 + 1] = 1;
          dep[i] = U.clamp(C.waterLevel - G.Phys.heightAt(x, z), -1, 14);
        }
      }
      const idx = new Uint32Array(n * n * 6);
      let k = 0;
      for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
          const a = iz * (n + 1) + ix, b = a + n + 1;
          idx[k++] = a; idx[k++] = b; idx[k++] = a + 1;
          idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('depth', new THREE.BufferAttribute(dep, 1));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const water = new THREE.Mesh(geo, mat);
      water.renderOrder = 2;
      water.receiveShadow = true;
      this.add(scene, water);
      // mar abierto hasta el horizonte (un marco alrededor, siempre profundo)
      if (!this._seaFar) {
        const F = 4200, R = [[-F, -F, F, -half], [-F, half, F, F], [-F, -half, -half, half], [half, -half, F, half]];
        const p2 = [], d2 = [], n2 = [];
        for (const [x0, z0, x1, z1] of R) {
          for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x0, z1], [x1, z1], [x1, z0]]) { p2.push(x, C.waterLevel, z); n2.push(0, 1, 0); d2.push(14); }
        }
        const g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
        g2.setAttribute('normal', new THREE.Float32BufferAttribute(n2, 3));
        g2.setAttribute('depth', new THREE.Float32BufferAttribute(d2, 1));
        this._seaFar = new THREE.Mesh(g2, mat);
        this._seaFar.renderOrder = 2;
        this._seaFar.userData.keepGeo = true;
        const bg = new THREE.PlaneGeometry(8400, 8400).rotateX(-Math.PI / 2);
        this._bed = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ color: 0x1b5d8c }));
        this._bed.position.y = -10;
        this._bed.userData.keepGeo = true;
      }
      this.add(scene, this._seaFar);
      this.add(scene, this._bed);
      this.water = water;
    },

    // Material del follaje: igual que el de siempre, pero las hojas se mecen con el viento
    foliageMaterial() {
      if (this._folMat) return this._folMat;
      this.timeU = this.timeU || { value: 0 };
      const m = new THREE.MeshLambertMaterial({ vertexColors: true });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.timeU;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'float sw = sin(uTime * 1.6 + position.x * 0.31 + position.z * 0.23) + 0.5 * sin(uTime * 2.7 + position.z * 0.5);',
          'transformed.x += sw * 0.06;',
          'transformed.z += cos(uTime * 1.3 + position.x * 0.27) * 0.045;',
        ].join('\n'));
      };
      m.customProgramCacheKey = () => 'islaFoliage';
      this._folMat = m;
      return m;
    },

    /* ---------- Plantillas de árboles y rocas (pocos polígonos) ---------- */
    makeTemplates() {
      if (this.tpl) return;
      const flat = (g) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
      this.tpl = {
        cone1: flat(new THREE.ConeGeometry(2.4, 3.6, 6, 1, true).translate(0, 3.6, 0)),
        cone2: flat(new THREE.ConeGeometry(1.6, 2.8, 6, 1, true).translate(0, 5.4, 0)),
        ball: flat(new THREE.IcosahedronGeometry(2.3, 0).translate(0, 4.4, 0)),
        bush: flat(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 0.5, 0)),
        rock: flat(new THREE.DodecahedronGeometry(1, 0)),
        hay: flat(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 8).rotateZ(Math.PI / 2).translate(0, 0.75, 0)),
        tank: flat(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8).translate(0, 1.1 + 1.0, 0)),
        roofCone: flat(new THREE.ConeGeometry(6.2, 7, 4, 1, true).rotateY(Math.PI / 4)),
        // tejado a dos aguas (prisma de 1 x 1 x 1, la cumbrera va a lo largo de X)
        roofSlopes: tri([
          [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0],
          [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 0, -0.5], [-0.5, 1, 0], [0.5, 1, 0],
          [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5],
        ]),
        roofEnds: tri([
          [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0],
          [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, 0],
        ]),
        // palmera
        palmSeg: flat(new THREE.CylinderGeometry(0.17, 0.22, 1, 6, 1, true).translate(0, 0.5, 0)),
        palmTop: palmTop(),
        // formas básicas para los pueblos (cilindro con la base en y = 0 y aspa de molino)
        cyl: flat(new THREE.CylinderGeometry(1, 1, 1, 14, 1, false).translate(0, 0.5, 0)),
        blade: flat(new THREE.BoxGeometry(0.9, 6.2, 0.08).translate(0, 3.4, 0)),
        cylC: flat(new THREE.CylinderGeometry(1, 1, 1, 14)),                                // cilindro centrado (ruedas)
        trunk: flat(new THREE.CylinderGeometry(0.62, 1, 1, 7, 1, true).translate(0, 0.5, 0)), // tronco que se estrecha
        ico1: flat(new THREE.IcosahedronGeometry(1, 1)),                                   // copa más redonda
        dish: flat(new THREE.CylinderGeometry(1, 0.35, 0.35, 12)),                         // antena parabólica
        // árboles gigantes
        gtrunk:flat(new THREE.CylinderGeometry(0.7, 1, 1, 8, 1, true).translate(0, 0.5, 0)),
        gcone: flat(new THREE.ConeGeometry(1, 1, 8, 1, false).translate(0, 0.5, 0)),
        gball: flat(new THREE.IcosahedronGeometry(1, 0)),
      };
      // geometría a partir de una lista de triángulos
      function tri(pts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
        g.computeVertexNormals();
        return g;
      }
      // copa de la palmera: hojas largas que cuelgan + cocos
      function palmTop() {
        const b = new G.GeoBuilder();
        const fr1 = new THREE.BoxGeometry(2.6, 0.06, 0.8).translate(1.3, 0, 0);
        const fr2 = new THREE.BoxGeometry(1.9, 0.05, 0.55).translate(0.95, 0, 0);
        for (let i = 0; i < 7; i++) {
          const ry = new THREE.Matrix4().makeRotationY((i * 2 * Math.PI) / 7 + (i % 2) * 0.2);
          const a1 = -0.22 - (i % 3) * 0.09;
          b.geometry(fr1, ry.clone().multiply(new THREE.Matrix4().makeRotationZ(a1)), i % 2 ? 0x4c9a3a : 0x3f8a32);
          const m2 = ry.clone().multiply(new THREE.Matrix4().makeTranslation(2.6 * Math.cos(a1), 2.6 * Math.sin(a1), 0))
            .multiply(new THREE.Matrix4().makeRotationZ(a1 - 0.65));
          b.geometry(fr2, m2, 0x5aa846);
        }
        const nut = new THREE.IcosahedronGeometry(0.18, 0);
        for (let i = 0; i < 3; i++) b.geometry(nut, new THREE.Matrix4().makeTranslation(Math.cos(i * 2.1) * 0.25, -0.22, Math.sin(i * 2.1) * 0.25), 0x6b4a2a);
        b.geometry(new THREE.CylinderGeometry(0.24, 0.2, 0.4, 6), new THREE.Matrix4().makeTranslation(0, -0.15, 0), 0x7a6040);
        return b.toGeometry();
      }
    },

    /* Árbol: tronco que se estrecha + copa de varias "nubes" de hojas (pino: 4 pisos de conos).
       Las copas van en el follaje (se mueven con el viento) y son más oscuras abajo. */
    tree(x, z, y, kind) {
      const s = this.rr(0.85, 1.3);
      D.begin({ name: 'Árbol', mat: 'wood', hp: Math.round(110 * s), yield: 8 });
      const t = this.tpl;
      const T = (a, b, c) => new THREE.Matrix4().makeTranslation(a, b, c);
      const S3 = (a, b, c) => new THREE.Matrix4().makeScale(a, b, c);
      const rot = new THREE.Matrix4().makeRotationY(this.rr(0, 6.28));
      const bark = this.pick([0x6b4423, 0x5e3d22, 0x74492a]);
      const GR = [0.62, 1.12];
      if (kind === 'pine') {
        this.vgeo(t.trunk, T(x, y - 0.2, z).multiply(S3(0.27 * s, 3.2 * s, 0.27 * s)), bark, 0.06, [0.75, 1.05]);
        const c = new THREE.Color(this.pick([0x2f7d3c, 0x3b8f45, 0x2d6e37, 0x358241]));
        for (let j = 0; j < 4; j++) {
          const rr = (2.55 - j * 0.52) * s, hh = (2.3 - j * 0.28) * s, yy = y + (1.45 + j * 1.2) * s;
          const col = c.clone().multiplyScalar(0.92 + j * 0.06).getHex();
          const rj = new THREE.Matrix4().makeRotationY(j * 0.6);
          this.fgeo(t.gcone, T(x, yy, z).multiply(rot).multiply(rj).multiply(S3(rr, hh, rr)), col, 0.05, GR);
        }
      } else {
        this.vgeo(t.trunk, T(x, y - 0.2, z).multiply(S3(0.3 * s, 3.5 * s, 0.3 * s)), bark, 0.06, [0.75, 1.05]);
        const orange = kind === 'orange';
        const autumn = !orange && this.r() < 0.12;
        const base = orange ? 0x3d8a35 : autumn ? this.pick([0xd98c2b, 0xc96a24, 0xe0a23a]) : this.pick([0x5fb83f, 0x74c84a, 0x52a83a, 0x68bf3c]);
        // ramas cortas hacia las nubes de hojas
        this.fgeo(t.ico1, T(x, y + 4.4 * s, z).multiply(rot).multiply(S3(2.1 * s, 1.8 * s, 2.1 * s)), base, 0.05, GR);
        const a0 = this.rr(0, 6.28);
        for (let j = 0; j < 3; j++) {
          const a = a0 + j * 2.1 + this.rr(-0.3, 0.3), d = 1.35 * s, r = this.rr(1.15, 1.45) * s, yy = y + this.rr(3.6, 4.6) * s;
          this.fgeo(t.gball, T(x + Math.cos(a) * d, yy, z + Math.sin(a) * d).multiply(rot).multiply(S3(r, r * 0.85, r)), base, 0.08, GR);
          this.vbox(Math.min(x, x + Math.cos(a) * d * 0.7) - 0.07, y + 2.6 * s, Math.min(z, z + Math.sin(a) * d * 0.7) - 0.07,
            Math.max(x, x + Math.cos(a) * d * 0.7) + 0.07, y + 2.8 * s, Math.max(z, z + Math.sin(a) * d * 0.7) + 0.07, bark, { jitter: 0.05 });
        }
        this.fgeo(t.gball, T(x, y + 5.7 * s, z).multiply(S3(1.2 * s, 1.0 * s, 1.2 * s)), base, 0.06, [0.85, 1.18]);
        if (orange) {
          // naranjas repartidas por la copa
          for (let i = 0; i < 9; i++) {
            const a = this.rr(0, 6.28), e = this.rr(1.75, 2.1) * s, oy = this.rr(-1.0, 1.0) * s;
            const om = T(x + Math.cos(a) * e, y + 4.4 * s + oy, z + Math.sin(a) * e).multiply(S3(0.24, 0.24, 0.24));
            this.fgeo(t.bush, om, 0xff8c1a, 0.05);
          }
        }
      }
      const box = G.Phys.addBox(x - 0.3 * s, y, z - 0.3 * s, x + 0.3 * s, y + 6.5 * s, z + 0.3 * s);
      D.addBox(D.active, box);
      D.grow(D.active, x - 2.6 * s, y, z - 2.6 * s, x + 2.6 * s, y + 6.6 * s, z + 2.6 * s);
      D.end();
    },

    rock(x, z, y, sc) {
      const sx = sc * this.rr(0.8, 1.4), sy = sc * this.rr(0.6, 1.0), sz = sc * this.rr(0.8, 1.4);
      D.begin({ name: 'Roca', mat: 'stone', hp: Math.round(90 + sc * 70), yield: 8 });
      const m = new THREE.Matrix4().makeTranslation(x, y + sy * 0.35, z)
        .multiply(new THREE.Matrix4().makeRotationY(this.rr(0, 6.28)))
        .multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
      this.vgeo(this.tpl.rock, m, this.pick([0x8f8f88, 0x9b9a92, 0x7f7e78]), 0.05, [0.72, 1.1]);
      const e = 0.72;
      const box = G.Phys.addBox(x - sx * e, y - 1, z - sz * e, x + sx * e, y + sy * 1.2, z + sz * e);
      D.addBox(D.active, box);
      D.end();
    },

    /* ---------- Edificios ----------
       Cada edificio tiene N plantas, ventanas de verdad (se puede disparar
       y saltar a través), una puerta y escaleras en zigzag por dentro.
       Las paredes, suelos y tejados están hechos de PANELES (de unos 4 m):
       al picar o disparar sólo se rompe el panel que golpeas. */
    // deco (opcional) = adornos de la fachada exterior: alféizares, contraventanas, toldos, balcones... (ver decor.js)
    wall(axis, a0, a1, f0, f1, y0, y1, doorAt, color, noWindows, grp, deco) {
      const L = a1 - a0;
      const ops = [];
      if (!noWindows) {
        const n = Math.max(0, Math.floor((L - 1.2) / 3.3));
        for (let i = 0; i < n; i++) {
          const c = a0 + ((i + 0.5) * L) / n;
          ops.push({ a: c - 0.7, b: c + 0.7, oy0: y0 + 0.9, oy1: y0 + 2.9 });
        }
      }
      if (doorAt !== null && doorAt !== undefined) {
        for (let i = ops.length - 1; i >= 0; i--) {
          if (Math.abs((ops[i].a + ops[i].b) / 2 - doorAt) < 2.0) ops.splice(i, 1);
        }
        ops.push({ a: doorAt - 0.95, b: doorAt + 0.95, oy0: y0, oy1: y0 + 2.8 });
        ops.sort((p, q) => p.a - q.a);
      }
      // 1) las piezas de la pared (f = caras ocultas: abajo pegada al suelo, arriba al techo)
      // se dibujan TODAS las caras: si se rompe el suelo o el techo de al lado, la pared no se ve "hueca"
      const NB = {}, NT = {}, NTB = {};
      const pieces = [];
      const add = (p0, p1, q0, q1, f) => { if (p1 - p0 >= 0.02 && q1 - q0 >= 0.02) pieces.push([p0, p1, q0, q1, f]); };
      let cur = a0;
      for (const op of ops) {
        add(cur, op.a, y0, y1, NTB);              // trozo macizo entre huecos
        if (op.oy0 > y0) add(op.a, op.b, y0, op.oy0, NB);   // antepecho bajo la ventana
        add(op.a, op.b, op.oy1, y1, NT);          // dintel sobre el hueco
        cur = op.b;
      }
      add(cur, a1, y0, y1, NTB);
      // 2) dónde se corta en paneles: cada panel = un hueco (ventana o puerta) + la pared que le sigue
      let cuts;
      if (ops.length) {
        cuts = [a0];
        for (const op of ops) if (op.a - cuts[cuts.length - 1] > 1.2) cuts.push(op.a);
        if (a1 - cuts[cuts.length - 1] < 1.2 && cuts.length > 1) cuts.pop();
        cuts.push(a1);
      } else {
        const n = Math.max(1, Math.round(L / 4));
        cuts = [];
        for (let i = 0; i <= n; i++) cuts.push(a0 + (i * L) / n);
      }
      // 3) cada panel es un trozo rompible independiente
      for (let i = 0; i < cuts.length - 1; i++) {
        const c0 = cuts[i], c1 = cuts[i + 1];
        if (grp) {
          const g = D.begin(grp);
          // el hueco que dejará este panel = el panel entero (para tapar con una pared tuya)
          g.slot = axis === 'x'
            ? { kind: 'wall', min: [c0, y0, f0], max: [c1, y1, f1] }
            : { kind: 'wall', min: [f0, y0, c0], max: [f1, y1, c1] };
        }
        for (const [p0, p1, q0, q1, f] of pieces) {
          const s0 = Math.max(p0, c0), s1 = Math.min(p1, c1);
          if (s1 - s0 < 0.02) continue;
          if (axis === 'x') this.solid(s0, q0, f0, s1, q1, f1, color, f);
          else this.solid(f0, q0, s0, f1, q1, s1, color, f);
        }
        // los adornos de las ventanas de este panel van en su mismo grupo (se rompen con él)
        if (deco) this.panelDeco(axis, ops, c0, c1, i === cuts.length - 2, f0, f1, y0, deco);
        if (grp) D.end();
      }
    },

    // Rectángulo menos el agujero de la escalera (hasta 4 rectángulos)
    holeRects(x0, z0, x1, z1, hole) {
      if (!hole) return [[x0, z0, x1, z1]];
      const [hx0, hz0, hx1, hz1] = hole;
      const r = [[x0, z0, hx0, z1], [hx1, z0, x1, z1]];
      if (hz0 > z0) r.push([hx0, z0, hx1, hz0]);
      if (hz1 < z1) r.push([hx0, hz1, hx1, z1]);
      return r;
    },

    // Forjado entero (sólo se usa en la planta baja, que no se rompe)
    slab(x0, z0, x1, z1, y0, y1, hole, color) {
      const o = { bottomColor: 0xe6dfd0, jitter: 0.02 };
      for (const r of this.holeRects(x0, z0, x1, z1, hole)) this.solid(r[0], y0, r[1], r[2], y1, r[3], color, o);
    },

    /* Forjado hecho de baldosas de ~4 x 4 m: cada baldosa se rompe por separado.
       trim = moldura exterior {tb, ty0, ty1, color} que va pegada a las baldosas del borde */
    slabTiles(x0, z0, x1, z1, y0, y1, hole, color, grp, trim) {
      const o = { bottomColor: 0xe6dfd0, jitter: 0.02 };
      const rects = this.holeRects(x0, z0, x1, z1, hole);
      const nx = Math.max(1, Math.round((x1 - x0) / 4)), nz = Math.max(1, Math.round((z1 - z0) / 4));
      const tx = (x1 - x0) / nx, tz = (z1 - z0) / nz;
      const { tb, ty0, ty1 } = trim;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const ax0 = x0 + i * tx, ax1 = ax0 + tx, az0 = z0 + j * tz, az1 = az0 + tz;
          const parts = [];
          for (const r of rects) {
            const p = [Math.max(r[0], ax0), Math.max(r[1], az0), Math.min(r[2], ax1), Math.min(r[3], az1)];
            if (p[2] - p[0] > 0.02 && p[3] - p[1] > 0.02) parts.push(p);
          }
          const edge = i === 0 || i === nx - 1 || j === 0 || j === nz - 1;
          if (!parts.length && !edge) continue;
          const tg = D.begin(grp);
          if (parts.length) {
            // el hueco que dejará la baldosa (sin tapar el hueco de la escalera)
            const bx = parts.map((p) => [p[0], y0, p[1], p[2], y1, p[3]]);
            tg.slot = {
              kind: 'floor', boxes: bx,
              min: [Math.min(...bx.map((b) => b[0])), y0, Math.min(...bx.map((b) => b[2]))],
              max: [Math.max(...bx.map((b) => b[3])), y1, Math.max(...bx.map((b) => b[5]))],
            };
          }
          for (const p of parts) {
            // las caras laterales que tocan otra baldosa (o la moldura) no se ven: no se dibujan
            // todas las caras: si se rompe la baldosa de al lado, el borde de esta se ve bien
            const f = { bottomColor: o.bottomColor, jitter: o.jitter };
            this.solid(p[0], y0, p[1], p[2], y1, p[3], color, f);
          }
          if (j === 0) this.vbox(i === 0 ? ax0 - tb : ax0, ty0, z0 - tb, i === nx - 1 ? ax1 + tb : ax1, ty1, z0, trim.color);
          if (j === nz - 1) this.vbox(i === 0 ? ax0 - tb : ax0, ty0, z1, i === nx - 1 ? ax1 + tb : ax1, ty1, z1 + tb, trim.color);
          if (i === 0) this.vbox(x0 - tb, ty0, az0, x0, ty1, az1, trim.color, { noX1: true });
          if (i === nx - 1) this.vbox(x1, ty0, az0, x1 + tb, ty1, az1, trim.color, { noX0: true });
          D.end();
        }
      }
    },

    // Caja larga partida en trozos de ~4 m, cada uno rompible por separado
    segBox(axis, a0, a1, f0, f1, y0, y1, color, grp, f) {
      const n = Math.max(1, Math.round((a1 - a0) / 4));
      for (let i = 0; i < n; i++) {
        const s0 = a0 + ((a1 - a0) * i) / n, s1 = a0 + ((a1 - a0) * (i + 1)) / n;
        D.begin(grp);
        if (axis === 'x') this.solid(s0, y0, f0, s1, y1, f1, color, f);
        else this.solid(f0, y0, s0, f1, y1, s1, color, f);
        D.end();
      }
    },

    building(o) {
      const { x0, z0, x1, z1, base, floors, pal } = o;
      const city = o.kind !== 'house';
      // o.mat / o.wallHp: para casas de pueblo que no son de madera (casas encaladas, castillo...)
      const bmat = o.mat || (city ? 'stone' : 'wood');
      const wallHp = o.wallHp || (city ? 220 : 150);
      const stairSide = o.stairSide || 1;
      const doorSide = o.doorSide;
      const hasStairs = floors > 1;
      const laneW = 1.8;
      const sx0 = x0 + WT + 1.6, sx1 = sx0 + 8;
      let laneA, laneB, stairZ0, stairZ1, frontZ0, frontZ1, railZ0, railZ1, divZ;
      if (stairSide > 0) {
        laneA = [z1 - WT - laneW, z1 - WT];
        laneB = [z1 - WT - 2 * laneW, z1 - WT - laneW];
        stairZ0 = laneB[0]; stairZ1 = laneA[1];
        frontZ0 = z0 + WT; frontZ1 = hasStairs ? stairZ0 : z1 - WT;
        railZ0 = stairZ0 - 0.12; railZ1 = stairZ0;
        divZ = laneA[0];
      } else {
        laneA = [z0 + WT, z0 + WT + laneW];
        laneB = [z0 + WT + laneW, z0 + WT + 2 * laneW];
        stairZ0 = laneA[0]; stairZ1 = laneB[1];
        frontZ0 = hasStairs ? stairZ1 : z0 + WT; frontZ1 = z1 - WT;
        railZ0 = stairZ1; railZ1 = stairZ1 + 0.12;
        divZ = laneA[1];
      }
      const lane = (j) => (j % 2 === 0 ? laneA : laneB);
      const cx = (x0 + x1) / 2, fzc = (frontZ0 + frontZ1) / 2;

      // Forjados (suelos y tejado). El de la planta baja no se rompe.
      for (let k = 0; k <= floors; k++) {
        const y = base + k * H;
        let hole = null;
        if (hasStairs && k >= 1 && k <= floors - 1) {
          if (k < floors - 1) hole = [sx0, stairZ0, sx1, stairZ1];
          else { const l = lane(k - 1); hole = [sx0, l[0], sx1, l[1]]; }
        }
        const tb = 0.12, ty0 = y - SL - 0.06, ty1 = y + 0.06;
        if (k > 0) {
          // suelos y tejado en baldosas rompibles
          this.slabTiles(x0, z0, x1, z1, y - SL, y, hole, k === floors ? pal.roof : pal.floor,
            { name: k === floors ? 'Tejado' : 'Suelo', mat: bmat, hp: city ? 200 : 150, yield: 6 },
            { tb, ty0, ty1, color: pal.trim });
          continue;
        }
        this.slab(x0, z0, x1, z1, y - SL, y, hole, pal.floor);
        // moldura exterior
        this.vbox(x0 - tb, ty0, z0 - tb, x1 + tb, ty1, z0, pal.trim);
        this.vbox(x0 - tb, ty0, z1, x1 + tb, ty1, z1 + tb, pal.trim);
        this.vbox(x0 - tb, ty0, z0, x0, ty1, z1, pal.trim, { noX1: true });
        this.vbox(x1, ty0, z0, x1 + tb, ty1, z1, pal.trim, { noX0: true });
      }

      // Paredes de cada planta (hechas de paneles rompibles)
      const WG = { name: 'Pared', mat: bmat, hp: wallHp, yield: 7 };
      const dec = o.deco === false ? null : this.facadeStyle(city, pal);
      const dw = (out, k) => (dec ? Object.assign({ out, upper: k > 0 }, dec) : null);
      for (let k = 0; k < floors; k++) {
        const y0 = base + k * H, y1 = y0 + H - SL;
        const g = k === 0;
        this.wall('x', x0, x1, z0, z0 + WT, y0, y1, g && doorSide === 'zmin' ? cx : null, pal.wall, hasStairs && stairSide < 0, WG, dw(-1, k));
        this.wall('x', x0, x1, z1 - WT, z1, y0, y1, g && doorSide === 'zmax' ? cx : null, pal.wall, hasStairs && stairSide > 0, WG, dw(1, k));
        this.wall('z', z0 + WT, z1 - WT, x0, x0 + WT, y0, y1, g && doorSide === 'xmin' ? fzc : null, pal.wall, false, WG, dw(-1, k));
        this.wall('z', z0 + WT, z1 - WT, x1 - WT, x1, y0, y1, g && doorSide === 'xmax' ? fzc : null, pal.wall, false, WG, dw(1, k));
      }

      // Pretil del tejado
      const ry = base + floors * H;
      const PG = { name: 'Muro', mat: bmat, hp: 100, yield: 5 }, NBo = {};
      this.segBox('x', x0, x1, z0, z0 + 0.3, ry, ry + 1, pal.trim, PG, NBo);
      this.segBox('x', x0, x1, z1 - 0.3, z1, ry, ry + 1, pal.trim, PG, NBo);
      this.segBox('z', z0 + 0.3, z1 - 0.3, x0, x0 + 0.3, ry, ry + 1, pal.trim, PG, NBo);
      this.segBox('z', z0 + 0.3, z1 - 0.3, x1 - 0.3, x1, ry, ry + 1, pal.trim, PG, NBo);
      if (city) {
        if (this.r() < 0.7) {
          const ax = this.rr(x0 + 2, x1 - 3.6), az = this.rr(z0 + 2, z1 - 3.2);
          D.begin({ name: 'Aire acondicionado', mat: 'metal', hp: 150, yield: 6 });
          this.solid(ax, ry, az, ax + 1.6, ry + 1.2, az + 1.2, 0xb8bcc2, { noBottom: true });
          D.end();
        }
        if (this.r() < 0.45) {
          const tx = this.rr(x0 + 2.5, x1 - 2.5), tz = this.rr(z0 + 2.5, z1 - 2.5);
          D.begin({ name: 'Depósito de agua', mat: 'metal', hp: 200, yield: 7 });
          const m = new THREE.Matrix4().makeTranslation(tx, ry, tz);
          this.vgeo(this.tpl.tank, m, 0x8a6a4a);
          for (const [px, pz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
            this.vbox(tx + px - 0.08, ry, tz + pz - 0.08, tx + px + 0.08, ry + 1.0, tz + pz + 0.08, 0x444444, { noBottom: true, noTop: true });
          }
          const box = G.Phys.addBox(tx - 1.0, ry, tz - 1.0, tx + 1.0, ry + 3.2, tz + 1.0);
          D.addBox(D.active, box);
          D.end();
        }
      }
      // antenas, parabólicas, casetas, vallas publicitarias, chimeneas... (decor.js)
      if (o.deco !== false) this.roofDeco(x0, z0, x1, z1, ry, city, pal, doorSide);

      // Escaleras en zigzag
      if (hasStairs) {
        for (let j = 0; j < floors - 1; j++) {
          const ln = lane(j), yb = base + j * H, yt = yb + H;
          const up = j % 2 === 0;
          const N = 12, run = 8 / N, rise = H / N;
          D.begin({ name: 'Escalera', mat: bmat, hp: 450, yield: 6 });
          this.ramp(sx0, ln[0], sx1, ln[1], 0, up ? yb + rise * 0.5 : yt + rise * 0.5, up ? yt + rise * 0.5 : yb + rise * 0.5);
          for (let s = 0; s < N; s++) {
            const xa = sx0 + s * run, xb = xa + run;
            const top = up ? yb + (s + 1) * rise : yt - s * rise;
            // los peldaños son sólidos: ya no se atraviesan (cada uno sube 33 cm, se suben andando)
            this.solid(xa, yb, ln[0], xb, top, ln[1], pal.stair, { jitter: 0.03, noBottom: true });
          }
          D.end();
        }
        // el muro entre los dos tramos de escalera, un trozo por planta
        const divTop = base + (floors - 1) * H + 1.0;
        for (let k = 0; k < floors; k++) {
          const ya = base + k * H, yb2 = Math.min(base + (k + 1) * H, divTop);
          if (yb2 - ya < 0.1) continue;
          D.begin({ name: 'Barandilla', mat: bmat, hp: 150, yield: 4 });
          this.solid(sx0, ya, divZ - 0.08, sx1, yb2, divZ + 0.08, pal.trim, { noBottom: k === 0 });
          D.end();
        }
        for (let k = 1; k < floors; k++) {
          const y = base + k * H;
          D.begin({ name: 'Barandilla', mat: bmat, hp: 120, yield: 4 });
          this.solid(sx0, y, railZ0, sx1, y + 1.0, railZ1, pal.trim, { noBottom: true });
          D.end();
        }
      }

      // Puerta (para la navegación de los bots)
      let door;
      if (doorSide === 'zmin') door = { x: cx, z: z0, nx: 0, nz: -1 };
      else if (doorSide === 'zmax') door = { x: cx, z: z1, nx: 0, nz: 1 };
      else if (doorSide === 'xmin') door = { x: x0, z: fzc, nx: -1, nz: 0 };
      else door = { x: x1, z: fzc, nx: 1, nz: 0 };

      // Nodos de navegación
      const Nv = G.Nav;
      const centers = [];
      for (let k = 0; k < floors; k++) centers.push(Nv.addNode(cx, base + k * H, fzc, false));
      const outY = o.outsideY !== undefined ? o.outsideY : base;
      const nOut = Nv.addNode(door.x + door.nx * 1.8, outY, door.z + door.nz * 1.8, true);
      const nIn = Nv.addNode(door.x - door.nx * 1.4, base, door.z - door.nz * 1.4, false);
      Nv.link(nOut, nIn); Nv.link(nIn, centers[0]);
      if (hasStairs) {
        const fz = stairSide > 0 ? stairZ0 - 0.9 : stairZ1 + 0.9;
        for (let j = 0; j < floors - 1; j++) {
          const up = j % 2 === 0, ln = lane(j), lz = (ln[0] + ln[1]) / 2;
          const xs = up ? sx0 - 0.8 : sx1 + 0.8, xe = up ? sx1 + 0.8 : sx0 - 0.8;
          const yb = base + j * H, yt = yb + H;
          const fb = Nv.addNode(xs, yb, fz, false), lb = Nv.addNode(xs, yb, lz, false);
          const lt = Nv.addNode(xe, yt, lz, false), ft = Nv.addNode(xe, yt, fz, false);
          Nv.link(centers[j], fb); Nv.link(fb, lb); Nv.link(lb, lt); Nv.link(lt, ft); Nv.link(ft, centers[j + 1]);
        }
      }

      // Interior: habitaciones, muebles, botín y cofre (ver interiors.js)
      const far = { zmin: 'zmax', zmax: 'zmin', xmin: 'xmax', xmax: 'xmin' }[doorSide];
      this.furnishBuilding({
        theme: o.interior || (city ? this.pick(['apartment', 'apartment', 'office', 'office', 'mixed']) : 'home'),
        floors, base, ceil: H - SL,
        main: [x0 + WT, Math.min(frontZ0, frontZ1), x1 - WT, Math.max(frontZ0, frontZ1)],
        strip: hasStairs ? [sx1 + 0.05, stairZ0, x1 - WT, stairZ1] : null,
        center: [cx, fzc], door, nIn: [door.x - door.nx * 1.4, door.z - door.nz * 1.4], doorSide, farSide: far,
        stairs: hasStairs ? { sx0, sx1, laneA, laneB, fz: stairSide > 0 ? stairZ0 - 0.9 : stairZ1 + 0.9 } : null,
        // casas: siempre al menos un cofre y un 50 % más por planta; torres de la ciudad: 75 % + 25 % por planta
        chestChance: city ? 0.75 : 1, chestExtra: city ? 0.25 : 0.5,
      });
      if (this.r() < 0.3) this.lootSpots.push({ x: this.rr(x0 + 1.5, x1 - 1.5), y: ry, z: this.rr(z0 + 1.5, z1 - 1.5), roof: true });

      this.buildings.push({ x0, z0, x1, z1, floors, base, top: ry + 1, color: pal.wall });
    },

    /* ---------- Ciudad Torres ---------- */
    buildCity() {
      const L = this.cityLevel;
      const S = [-100, -60, -20, 20, 60, 100];
      const SW = 10;
      this.streets = S;
      // asfalto (suelo del mapa: no se rompe)
      this.gbox(-106, L - 1, -106, 106, L + 0.04, 106, 0x4a4d52, { jitter: 0, noBottom: true });
      // líneas de la carretera
      for (const s of S) {
        for (let t = -104; t < 104; t += 7) {
          if (S.some((q) => Math.abs(t + 1.5 - q) < 6)) continue;
          this.gbox(s - 0.12, L + 0.04, t, s + 0.12, L + 0.07, t + 3, 0xe8d36a, { jitter: 0, noBottom: true }, 2);
          this.gbox(t, L + 0.04, s - 0.12, t + 3, L + 0.07, s + 0.12, 0xe8d36a, { jitter: 0, noBottom: true }, 2);
        }
      }
      for (let bi = 0; bi < 5; bi++) {
        for (let bj = 0; bj < 5; bj++) {
          const bx0 = S[bi] + SW / 2, bx1 = S[bi + 1] - SW / 2, bz0 = S[bj] + SW / 2, bz1 = S[bj + 1] - SW / 2;
          this.solid(bx0, L - 0.5, bz0, bx1, L + 0.14, bz1, 0xb9b4aa, { jitter: 0.02, noBottom: true });
          if (bi === 2 && bj === 2) this.buildPlaza(bx0, bz0, bx1, bz1, L + 0.14);
          else this.fillBlock(bx0, bz0, bx1, bz1, L + 0.14, Math.max(Math.abs(bi - 2), Math.abs(bj - 2)));
        }
      }
      // farolas, semáforos, bocas de incendio y papeleras en las aceras (decor.js)
      this.cityFurniture(S, SW, L);
      // nodos de las calles
      for (const sx of S) for (const sz of S) G.Nav.addNode(sx, L, sz, true);
      for (const s of S) {
        for (let i = 0; i < 5; i++) {
          const m = (S[i] + S[i + 1]) / 2;
          G.Nav.addNode(s, L, m, true);
          G.Nav.addNode(m, L, s, true);
        }
      }
      // coches aparcados
      const carCols = [0xd62828, 0x1d3557, 0xf1faee, 0x2a9d8f, 0xe9c46a, 0x6d597a, 0x222222, 0x8ecae6];
      const cars = [];
      for (let i = 0; i < 30; i++) {
        const s = this.pick(S);
        const along = this.rr(-98, 98);
        if (S.some((q) => Math.abs(along - q) < 9)) continue;
        const side = this.r() < 0.5 ? -1 : 1;
        const alongZ = this.r() < 0.5;
        const cxp = alongZ ? s + side * 3.1 : along, czp = alongZ ? along : s + side * 3.1;
        if (cars.some((c) => Math.hypot(c[0] - cxp, c[1] - czp) < 6.5)) continue;   // que no se monten unos encima de otros
        this.car(cxp, czp, L, alongZ, this.pick(carCols));
        cars.push([cxp, czp]);
      }
      // motos aparcadas en las calles (lejos de los coches)
      for (let i = 0, n = 0; i < 40 && n < 5; i++) {
        const s = this.pick(S), along = this.rr(-95, 95);
        if (S.some((q) => Math.abs(along - q) < 8)) continue;
        const alongZ = this.r() < 0.5, side = this.r() < 0.5 ? -1 : 1;
        const x = alongZ ? s + side * 3.4 : along, z = alongZ ? along : s + side * 3.4;
        if (cars.some((c) => Math.hypot(c[0] - x, c[1] - z) < 6)) continue;
        if (this.motoSpots.some((m) => Math.hypot(m.x - x, m.z - z) < 20)) continue;
        this.motoSpots.push({ x, y: L, z, yaw: alongZ ? (this.r() < 0.5 ? 0 : Math.PI) : (this.r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) });
        cars.push([x, z]);
        n++;
      }
    },

    // (los coches, car(), están en decor.js)

    fillBlock(bx0, bz0, bx1, bz1, base0, ring) {
      const m = 2.0;
      const r = this.r();
      const minF = ring === 1 ? 3 : 2, maxF = ring === 1 ? 6 : 4;
      const B = (x0, z0, x1, z1, floors) => {
        const stairSide = this.r() < 0.5 ? 1 : -1;
        const opts = stairSide > 0 ? ['zmin', 'xmin', 'xmax'] : ['zmax', 'xmin', 'xmax'];
        this.building({ x0, z0, x1, z1, base: base0 + 0.25, floors, pal: this.pick(PAL_CITY), stairSide, doorSide: this.pick(opts), outsideY: base0 });
      };
      if (r < 0.58) {
        const iw = bx1 - bx0 - 2 * m, id = bz1 - bz0 - 2 * m;
        const w = this.rr(17, iw), d = this.rr(15, id);
        const cx = this.rr(bx0 + m + w / 2, bx1 - m - w / 2), cz = this.rr(bz0 + m + d / 2, bz1 - m - d / 2);
        B(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, this.ri(minF, maxF));
      } else if (r < 0.86) {
        const gap = 1.5;
        if (this.r() < 0.5) {
          const w = (bx1 - bx0 - 2 * m - gap) / 2;
          B(bx0 + m, bz0 + m, bx0 + m + w, bz1 - m, this.ri(minF, maxF));
          B(bx1 - m - w, bz0 + m, bx1 - m, bz1 - m, this.ri(minF, maxF));
        } else {
          const d = (bz1 - bz0 - 2 * m - gap) / 2;
          B(bx0 + m, bz0 + m, bx1 - m, bz0 + m + d, this.ri(minF, maxF));
          B(bx0 + m, bz1 - m - d, bx1 - m, bz1 - m, this.ri(minF, maxF));
        }
      } else {
        // parque
        this.vbox(bx0 + 1.2, base0, bz0 + 1.2, bx1 - 1.2, base0 + 0.03, bz1 - 1.2, 0x5f9e3c, { noBottom: true });
        for (let i = 0; i < 6; i++) {
          const x = this.rr(bx0 + 3, bx1 - 3), z = this.rr(bz0 + 3, bz1 - 3);
          this.tree(x, z, base0, this.r() < 0.3 ? 'pine' : 'round');
        }
        // setos bajos como cobertura
        for (let i = 0; i < 3; i++) {
          const x = this.rr(bx0 + 4, bx1 - 8), z = this.rr(bz0 + 4, bz1 - 4);
          D.begin({ name: 'Seto', mat: 'wood', hp: 100, yield: 5 });
          if (this.r() < 0.5) this.solid(x, base0, z, x + 4, base0 + 1.0, z + 0.8, 0x3f7f2f, { noBottom: true });
          else this.solid(x, base0, z, x + 0.8, base0 + 1.0, z + 4, 0x3f7f2f, { noBottom: true });
          D.end();
        }
        for (let i = 0; i < 3; i++) this.lootSpots.push({ x: this.rr(bx0 + 3, bx1 - 3), y: base0, z: this.rr(bz0 + 3, bz1 - 3) });
        if (this.r() < 0.6) this.chestSpots.push({ x: (bx0 + bx1) / 2, y: base0, z: (bz0 + bz1) / 2, rot: this.rr(0, 6.28) });
        G.Nav.addNode((bx0 + bx1) / 2, base0, (bz0 + bz1) / 2, true);
      }
    },

    buildPlaza(bx0, bz0, bx1, bz1, base) {
      this.vbox(bx0 + 1, base, bz0 + 1, bx1 - 1, base + 0.03, bz1 - 1, 0xd8cfb8, { noBottom: true });
      // torre del reloj (no se rompe: es el monumento de la ciudad)
      const t = 3.5, top = base + 26;
      this.solid(-t, base, -t, t, top, t, 0xb8a27e, { noBottom: true, noTop: true });
      for (const y of [base + 8, base + 16]) this.vbox(-t - 0.3, y, -t - 0.3, t + 0.3, y + 0.6, t + 0.3, 0x8c7a5c);
      this.solid(-4.2, top, -4.2, 4.2, top + 1.2, 4.2, 0x8c7a5c);
      const m = new THREE.Matrix4().makeTranslation(0, top + 1.2 + 3.5, 0);
      this.vgeo(this.tpl.roofCone, m, 0x2f5d50);
      this.clockSpots = [];
      for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        this.clockSpots.push({ x: nx * (t + 0.02), y: base + 20.5, z: nz * (t + 0.02), ry: Math.atan2(nx, nz) });
      }
      // jardineras con árboles
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * 10, z = sz * 10;
        this.solid(x - 1.6, base, z - 1.6, x + 1.6, base + 0.5, z + 1.6, 0x9a8f7a, { noBottom: true });
        this.tree(x, z, base + 0.5, 'round');
      }
      // bancos
      for (const [x, z, al] of [[-6.5, 0, true], [6.5, 0, true], [0, -6.5, false], [0, 6.5, false]]) {
        D.begin({ name: 'Banco', mat: 'wood', hp: 80, yield: 5 });
        if (al) this.solid(x - 0.4, base, z - 1.6, x + 0.4, base + 0.55, z + 1.6, 0x7a5a3c, { noBottom: true });
        else this.solid(x - 1.6, base, z - 0.4, x + 1.6, base + 0.55, z + 0.4, 0x7a5a3c, { noBottom: true });
        D.end();
      }
      for (const [x, z] of [[-8, -4], [8, 4], [4, -8], [-4, 8]]) this.lootSpots.push({ x, y: base, z });
      this.chestSpots.push({ x: 0, y: base, z: -5.2, rot: 0 });
      for (const [x, z] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) G.Nav.addNode(x, base, z, true);
    },

    crate(x, y, z, s) {
      D.begin({ name: 'Caja', mat: 'wood', hp: 80, yield: 6 });
      this.solid(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, 0xa0743f, { noBottom: true });
      D.end();
    },

    /* ---------- Pueblos pequeños ---------- */
    buildPOI(p) {
      if (p.type === 'beachtown') { this.buildBeachTown(p); return this.buildBeachDowntown(p); }
      if (p.type === 'giantforest') return this.buildGiantForest(p);
      if (p.type === 'mountain') return this.buildMountainTown(p);
      if (p.type === 'white') return this.buildWhiteTown(p);
      if (p.type === 'western') return this.buildWesternTown(p);
      if (p.type === 'industrial') return this.buildIndustrial(p);
      if (p.type === 'castle') return this.buildCastle(p);
      if (p.town) return this.buildTown(p);   // pueblos grandes (villages.js)
      const placed = [];
      const want = p.type === 'farm' ? 3 : this.ri(3, 5);
      if (p.type === 'farm') {
        // granero grande
        const w = 20, d = 14, cx = p.x + this.rr(-6, 6), cz = p.z + this.rr(-6, 6);
        this.building({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, base: p.level + 0.25, floors: 2, pal: PAL_BARN, stairSide: 1, doorSide: 'zmin', outsideY: p.level, kind: 'house', interior: 'barn' });
        placed.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
        for (let i = 0; i < 8; i++) {
          const a = this.rr(0, 6.28), dd = this.rr(16, 30);
          const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
          if (placed.some((b) => x > b.x0 - 2 && x < b.x1 + 2 && z > b.z0 - 2 && z < b.z1 + 2)) continue;
          D.begin({ name: 'Paca de paja', mat: 'wood', hp: 60, yield: 5 });
          const m = new THREE.Matrix4().makeTranslation(x, p.level, z);
          this.vgeo(this.tpl.hay, m, 0xe0c060, 0.05);
          const box = G.Phys.addBox(x - 0.7, p.level, z - 0.75, x + 0.7, p.level + 1.5, z + 0.75);
          D.addBox(D.active, box);
          D.end();
        }
      }
      for (let att = 0; att < 60 && placed.length < want + (p.type === 'farm' ? 1 : 0); att++) {
        const floors = this.r() < 0.55 ? 2 : 1;
        const w = floors > 1 ? this.rr(13, 16) : this.rr(9, 13), d = this.rr(10, 13);
        const a = this.rr(0, 6.28), dist = this.rr(8, p.r - 10);
        const cx = p.x + Math.cos(a) * dist, cz = p.z + Math.sin(a) * dist;
        const bb = { x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 };
        if (placed.some((b) => bb.x0 < b.x1 + 5 && bb.x1 > b.x0 - 5 && bb.z0 < b.z1 + 5 && bb.z1 > b.z0 - 5)) continue;
        placed.push(bb);
        const dx = p.x - cx, dz = p.z - cz;
        const doorSide = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'xmax' : 'xmin') : (dz > 0 ? 'zmax' : 'zmin');
        const stairSide = doorSide === 'zmin' ? 1 : doorSide === 'zmax' ? -1 : (this.r() < 0.5 ? 1 : -1);
        this.building({ ...bb, base: p.level + 0.25, floors, pal: this.pick(PAL_HOUSE), stairSide, doorSide, outsideY: p.level, kind: 'house' });
      }
      // cajas como cobertura y botín exterior
      for (let i = 0; i < 6; i++) {
        const a = this.rr(0, 6.28), dd = this.rr(5, p.r);
        const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
        if (placed.some((b) => x > b.x0 - 2 && x < b.x1 + 2 && z > b.z0 - 2 && z < b.z1 + 2)) continue;
        this.crate(x, p.level, z, this.rr(1.0, 1.4));
      }
      for (let i = 0; i < 4; i++) {
        const a = this.rr(0, 6.28), dd = this.rr(4, p.r - 2);
        const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
        if (placed.some((b) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)) continue;
        this.lootSpots.push({ x, y: p.level, z });
      }
      G.Nav.addNode(p.x, p.level, p.z, true);
      for (let i = 0; i < 20; i++) {
        const a = this.rr(0, 6.28), dd = this.rr(6, p.r - 6);
        const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
        if (placed.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue;
        this.motoSpots.push({ x, y: p.level, z, yaw: this.rr(0, 6.28) });
        break;
      }
      if (p.type === 'harbor') this.buildPier(p);
      if (p.type === 'beach') {
        for (let i = 0; i < 6; i++) {
          const a = this.rr(0, 6.28), dd = this.rr(10, p.r);
          const x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
          if (placed.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue;
          // sombrillas de playa (sólo decoración)
          const y = G.Phys.heightAt(x, z);
          this.vbox(x - 0.06, y, z - 0.06, x + 0.06, y + 2.4, z + 0.06, 0xeeeeee, { noBottom: true });
          const um = new THREE.Matrix4().makeTranslation(x, y + 1.0, z).multiply(new THREE.Matrix4().makeScale(0.75, 0.18, 0.75));
          this.vgeo(this.tpl.ball, um, this.pick([0xff5d5d, 0xffd166, 0x4cc9f0]));
        }
      }
    },

    // Muelle de madera que sale del pueblo hacia el mar
    buildPier(p) {
      const len = Math.hypot(p.x, p.z) || 1;
      const dx = p.x / len, dz = p.z / len;
      const alongX = Math.abs(dx) > Math.abs(dz);
      const sx = Math.sign(alongX ? dx : dz) || 1;
      const y = p.level;
      const L = 55, hw = 2.5;
      const a0 = (alongX ? p.x : p.z) + sx * (p.r - 6);
      const a1 = a0 + sx * L;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      const c = alongX ? p.z : p.x;
      if (alongX) this.solid(lo, y - 0.4, c - hw, hi, y, c + hw, 0x8b6a45);
      else this.solid(c - hw, y - 0.4, lo, c + hw, y, hi, 0x8b6a45);
      for (let t = lo + 2; t < hi; t += 6) {
        for (const s of [-1, 1]) {
          const px = alongX ? t : c + s * (hw - 0.3), pz = alongX ? c + s * (hw - 0.3) : t;
          this.vbox(px - 0.2, -4, pz - 0.2, px + 0.2, y - 0.4, pz + 0.2, 0x5a4330, { noBottom: true, noTop: true });
        }
      }
      const tipA = a1 - sx * 4;
      const tx = alongX ? tipA : c, tz = alongX ? c : tipA;
      this.chestSpots.push({ x: tx, y, z: tz, rot: 0 });
      const midA = (a0 + a1) / 2;
      this.lootSpots.push({ x: alongX ? midA : c, y, z: alongX ? c : midA });
      for (let i = 0; i < 3; i++) {
        const t = this.rr(lo + 6, hi - 6);
        const off = this.r() < 0.5 ? -1.6 : 1.6;
        const x = alongX ? t : c + off, z = alongX ? c + off : t;
        this.crate(x, y, z, 1.2);
      }
      G.Nav.addNode(alongX ? midA : c, y, alongX ? c : midA, true);
    },

    /* ---------- Bahía Coral: pueblo en la orilla de la playa ----------
       Casitas de colores pastel sobre pilotes, con porche, escalera y
       tejado a dos aguas. Delante: un paseo de madera, un chiringuito,
       una torre de socorrista, palmeras, sombrillas y un muelle. */
    buildBeachTown(p) {
      const y = p.level;
      const len = Math.hypot(p.x, p.z) || 1;
      const alongX = Math.abs(p.x / len) > Math.abs(p.z / len);
      const sg = Math.sign(alongX ? p.x : p.z) || 1;
      // coordenadas locales: u = hacia el mar, v = a lo largo de la costa
      const W = (u, v) => (alongX ? [p.x + sg * u, p.z + v] : [p.x + v, p.z + sg * u]);
      const R = (u0, u1, v0, v1) => {
        const a = W(u0, v0), b = W(u1, v1);
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      };
      const seaSide = alongX ? (sg > 0 ? 'xmax' : 'xmin') : (sg > 0 ? 'zmax' : 'zmin');
      const placed = [R(32, 95, -3.5, 3.5)];   // sitio del muelle
      const Nv = G.Nav;
      const wood = 0xb98a5a;

      // 1) casitas: una fila atrás y otra más cerca de la playa (todas miran al mar)
      const spots = [[-17, -46], [-17, 0], [-17, 22], [-17, 44], [2, -36], [2, -13], [2, 13], [2, 36],
        // ampliación: más casitas hacia los dos extremos de la bahía
        [-17, -68], [-17, -86], [-17, 84], [2, -58], [2, -80], [2, 58], [2, 80]];
      for (const [u, v] of spots) {
        const dU = this.rr(7.5, 9), wV = this.rr(8.5, 10);
        const r = R(u - dU / 2, u + dU / 2, v - wV / 2, v + wV / 2);
        const pal = this.pick(PAL_BEACH);
        this.bungalow({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y, hs: this.rr(1.0, 1.35), porch: seaSide, pal });
        placed.push(R(u - dU / 2 - 1, u + dU / 2 + 6.5, v - wV / 2 - 1, v + wV / 2 + 1));
      }
      // hotel de 3 plantas con vistas al mar
      {
        const hr = R(-23, -11, -31, -17);
        const ds = seaSide;
        const stairSide = ds === 'zmin' ? 1 : ds === 'zmax' ? -1 : 1;
        this.building({ x0: hr[0], z0: hr[1], x1: hr[2], z1: hr[3], base: y + 0.25, floors: 3, pal: PAL_HOTEL, stairSide, doorSide: ds, outsideY: y, kind: 'house', interior: 'hotel' });
        placed.push(R(-24, -8, -32, -16));
      }
      // bloque de apartamentos de 3 plantas en el otro extremo del pueblo
      {
        const hr = R(-24, -11, 54, 68);
        const ds = seaSide;
        const stairSide = ds === 'zmin' ? 1 : ds === 'zmax' ? -1 : -1;
        this.building({ x0: hr[0], z0: hr[1], x1: hr[2], z1: hr[3], base: y + 0.25, floors: 3, pal: PAL_APART, stairSide, doorSide: ds, outsideY: y, kind: 'house', mat: 'stone', wallHp: 180, interior: 'apartment' });
        placed.push(R(-25, -8, 53, 69));
      }

      // 2) paseo marítimo de tablones (un poco elevado: se sube sin saltar)
      const bw = R(14, 17.5, -88, 88);
      this.solid(bw[0], y - 0.5, bw[1], bw[2], y + 0.3, bw[3], 0xa77b4f, { noBottom: true, jitter: 0.02 });
      for (let v = -86; v <= 86; v += 2) {
        const s = R(14, 17.5, v - 0.04, v + 0.04);
        this.vbox(s[0], y + 0.3, s[1], s[2], y + 0.32, s[3], 0x7a5634, { jitter: 0, noBottom: true });
      }
      placed.push(R(13, 18.5, -89, 89));
      this.buildings.push({ x0: bw[0], z0: bw[1], x1: bw[2], z1: bw[3], floors: 0, base: y, top: y + 0.3, color: 0xc49a6c });
      for (const v of [-80, -64, -46, -24, -8, 8, 24, 46, 64, 80]) {
        const [nx, nz] = W(15.75, v);
        Nv.addNode(nx, y + 0.3, nz, true);
        if (this.r() < 0.6) this.lootSpots.push({ x: nx + this.rr(-0.8, 0.8), y: y + 0.3, z: nz + this.rr(-0.8, 0.8) });
      }
      // farolas y bancos del paseo
      for (const v of [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75]) {
        const [lx, lz] = W(17.2, v);
        D.begin({ name: 'Farola', mat: 'metal', hp: 80, yield: 4 });
        this.solid(lx - 0.1, y + 0.3, lz - 0.1, lx + 0.1, y + 3.6, lz + 0.1, 0x3d4650, { noBottom: true });
        this.vbox(lx - 0.25, y + 3.6, lz - 0.25, lx + 0.25, y + 3.9, lz + 0.25, 0xfff2b0, { jitter: 0 });
        D.end();
      }
      for (const v of [-70, -54, -38, -21, 21, 38, 54, 70]) {
        const s = R(14.3, 15.0, v - 1.4, v + 1.4);
        D.begin({ name: 'Banco', mat: 'wood', hp: 70, yield: 5 });
        this.solid(s[0], y + 0.3, s[1], s[2], y + 0.8, s[3], 0x7a5a3c, { noBottom: true });
        D.end();
      }

      // 3) chiringuito (bar de playa con techo de paja)
      {
        const u0 = 23, u1 = 29, v0 = -26, v1 = -18;
        const f = R(u0, u1, v0, v1);
        this.solid(f[0], y - 0.3, f[1], f[2], y + 0.2, f[3], wood, { noBottom: true });
        const yb = y + 0.2;
        // barra en forma de L
        D.begin({ name: 'Barra', mat: 'wood', hp: 160, yield: 7 });
        const c1 = R(u0 + 0.6, u0 + 1.3, v0 + 0.6, v1 - 0.6);
        this.solid(c1[0], yb, c1[1], c1[2], yb + 1.1, c1[3], 0x8a5a33, { noBottom: true });
        D.end();
        D.begin({ name: 'Barra', mat: 'wood', hp: 120, yield: 6 });
        const c2 = R(u0 + 1.3, u1 - 2.5, v1 - 1.3, v1 - 0.6);
        this.solid(c2[0], yb, c2[1], c2[2], yb + 1.1, c2[3], 0x8a5a33, { noBottom: true });
        D.end();
        D.begin({ name: 'Techo de paja', mat: 'wood', hp: 180, yield: 6 });
        for (const [pu, pv] of [[u0 + 0.3, v0 + 0.3], [u1 - 0.3, v0 + 0.3], [u0 + 0.3, v1 - 0.3], [u1 - 0.3, v1 - 0.3]]) {
          const [px, pz] = W(pu, pv);
          this.vbox(px - 0.12, yb, pz - 0.12, px + 0.12, yb + 2.7, pz + 0.12, 0x6b4a2a, { noBottom: true, noTop: true });
        }
        const rf = R(u0 - 0.5, u1 + 0.5, v0 - 0.5, v1 + 0.5);
        this.solid(rf[0], yb + 2.7, rf[1], rf[2], yb + 3.0, rf[3], 0xd9b45a, { jitter: 0.06 });
        this.vbox(rf[0] + 0.6, yb + 3.0, rf[1] + 0.6, rf[2] - 0.6, yb + 3.4, rf[3] - 0.6, 0xc9a24a, { noBottom: true, jitter: 0.06 });
        D.end();
        const [bx, bz] = W(u0 + 2.2, v0 + 2.5);
        this.lootSpots.push({ x: bx, y: yb, z: bz, indoor: true });
        const [cx2, cz2] = W(u0 + 3.6, (v0 + v1) / 2 - 1);
        this.chestSpots.push({ x: cx2, y: yb, z: cz2, rot: this.rr(0, 6.28) });
        const [nx, nz] = W(u1 + 1.2, (v0 + v1) / 2);
        Nv.addNode(nx, y, nz, true);
        placed.push(R(u0 - 1, u1 + 1, v0 - 1, v1 + 1));
        this.buildings.push({ x0: f[0], z0: f[1], x1: f[2], z1: f[3], floors: 0, base: y, top: yb + 3.4, color: 0xd9b45a });
      }

      // heladería (caseta con mostrador)
      {
        const k = R(23, 27, 26, 32), yb = y;
        this.solid(k[0], yb - 0.2, k[1], k[2], yb + 0.15, k[3], 0xf2efe6, { noBottom: true });
        D.begin({ name: 'Heladería', mat: 'wood', hp: 200, yield: 7 });
        const c = R(23, 23.8, 26.4, 31.6);
        this.solid(c[0], yb + 0.15, c[1], c[2], yb + 1.15, c[3], 0xff8fab, { noBottom: true });
        const back = R(26.6, 27, 26, 32);
        this.solid(back[0], yb + 0.15, back[1], back[2], yb + 2.6, back[3], 0xffd6e0, { noBottom: true });
        const roof = R(22.4, 27.4, 25.6, 32.4);
        this.solid(roof[0], yb + 2.6, roof[1], roof[2], yb + 2.85, roof[3], 0x4cc9f0);
        for (const [pu, pv] of [[23.1, 26.1], [23.1, 31.9]]) { const [px, pz] = W(pu, pv); this.vbox(px - 0.08, yb + 1.15, pz - 0.08, px + 0.08, yb + 2.6, pz + 0.08, 0xffffff, { noTop: true, noBottom: true }); }
        D.end();
        const [lx, lz] = W(25.4, 29);
        this.lootSpots.push({ x: lx, y: yb + 0.15, z: lz, indoor: true });
        placed.push(R(22, 28, 25, 33));
        this.buildings.push({ x0: k[0], z0: k[1], x1: k[2], z1: k[3], floors: 0, base: y, top: yb + 2.85, color: 0xff8fab });
      }

      // 3b) mercadillo: puestos con toldo de rayas en la arena, junto al paseo
      for (let i = 0; i < 4; i++) {
        const v0 = -86 + i * 6.2, v1 = v0 + 5;
        const [ca, cb] = this.pick([[0xe63946, 0xffffff], [0x2a9d8f, 0xffffff], [0xffb703, 0xffffff], [0x4361ee, 0xffffff]]);
        D.begin({ name: 'Puesto', mat: 'wood', hp: 120, yield: 6 });
        const ct = R(19.5, 20.2, v0 + 0.2, v1 - 0.2);
        this.solid(ct[0], y, ct[1], ct[2], y + 1.0, ct[3], 0x9c6b3e, { noBottom: true });
        for (const [pu, pv] of [[19.6, v0 + 0.15], [19.6, v1 - 0.15], [23.3, v0 + 0.15], [23.3, v1 - 0.15]]) {
          const [px, pz] = W(pu, pv);
          this.vbox(px - 0.07, y, pz - 0.07, px + 0.07, y + 2.4, pz + 0.07, 0xf4f1ea, { noBottom: true, noTop: true, jitter: 0 });
        }
        for (let k = 0; k < 5; k++) {
          const s = R(19.2, 23.6, v0 + k, v0 + k + 1);
          this.solid(s[0], y + 2.4, s[1], s[2], y + 2.55, s[3], k % 2 ? cb : ca, { jitter: 0 });
        }
        D.end();
        const [kx, kz] = W(22.6, v0 + 1.4);
        this.crate(kx, y, kz, 0.9);
        const [lx, lz] = W(21.7, (v0 + v1) / 2 + 0.6);
        this.lootSpots.push({ x: lx, y, z: lz });
        placed.push(R(19, 24, v0 - 0.3, v1 + 0.3));
      }
      // 3c) pista de vóley playa (red y líneas)
      {
        const c = R(21, 33, 48, 60);
        for (const q of [R(21, 33, 47.95, 48.05), R(21, 33, 59.95, 60.05), R(20.95, 21.05, 48, 60), R(32.95, 33.05, 48, 60)]) {
          this.vbox(q[0], y, q[1], q[2], y + 0.03, q[3], 0xffffff, { jitter: 0, noBottom: true });
        }
        D.begin({ name: 'Red de vóley', mat: 'wood', hp: 60, yield: 3 });
        for (const pv of [47.6, 60.4]) { const [px, pz] = W(27, pv); this.solid(px - 0.08, y, pz - 0.08, px + 0.08, y + 2.5, pz + 0.08, 0xdddddd, { noBottom: true }); }
        const net = R(26.97, 27.03, 47.6, 60.4);
        this.vbox(net[0], y + 1.6, net[1], net[2], y + 2.45, net[3], 0x222222, { jitter: 0 });
        D.end();
        placed.push([c[0] - 1, c[1] - 1, c[2] + 1, c[3] + 1]);
      }
      // 3d) faro de rayas (el cofre de arriba sólo se alcanza construyendo)
      {
        const [fx, fz] = W(29, 84);
        this.lighthouse(fx, fz, y);
        placed.push(R(25, 33, 80, 88));
      }
      // 3e) barcas amarradas junto al muelle (se puede saltar a ellas desde el muelle)
      for (const [u, v, col] of [[54, 6.4, 0xffffff], [66, -6.4, 0x4cc9f0], [80, 6.4, 0xff8fab]]) {
        D.begin({ name: 'Barca', mat: 'wood', hp: 160, yield: 6 });
        const h1 = R(u - 3, u + 2, v - 1.1, v + 1.1);
        this.solid(h1[0], -0.5, h1[1], h1[2], 0.65, h1[3], col, { bottomColor: 0x2a3f5f });
        const h2 = R(u + 2, u + 3.4, v - 0.6, v + 0.6);
        this.solid(h2[0], -0.3, h2[1], h2[2], 0.65, h2[3], col);
        const band = R(u - 3.03, u + 2, v - 1.13, v + 1.13);
        this.vbox(band[0], 0.3, band[1], band[2], 0.45, band[3], 0x1d3557, { jitter: 0, noTop: true, noBottom: true });
        const cab = R(u - 2.6, u - 0.6, v - 0.8, v + 0.8);
        this.solid(cab[0], 0.65, cab[1], cab[2], 1.8, cab[3], 0xf4f1ea, { noBottom: true });
        D.end();
        const [lx, lz] = W(u + 0.8, v);
        this.lootSpots.push({ x: lx, y: 0.65, z: lz });
      }

      // 4) torres de socorrista con rampa
      for (const tv of [16, -44, 70]) {
        const tu = 30, hgt = 3.4;
        const t = R(tu - 1.6, tu + 1.6, tv - 1.6, tv + 1.6);
        const top = y + hgt;
        D.begin({ name: 'Torre de socorrista', mat: 'wood', hp: 260, yield: 8 });
        for (const [px, pz] of [[t[0] + 0.2, t[1] + 0.2], [t[2] - 0.2, t[1] + 0.2], [t[0] + 0.2, t[3] - 0.2], [t[2] - 0.2, t[3] - 0.2]]) {
          this.vbox(px - 0.13, y - 0.2, pz - 0.13, px + 0.13, top + 2.6, pz + 0.13, 0xf4f1ea, { noBottom: true, noTop: true });
        }
        this.solid(t[0], top - 0.25, t[1], t[2], top, t[3], 0xe0e0e0, { bottomColor: 0xb0b0b0 });
        this.solid(t[0] - 0.3, top + 2.6, t[1] - 0.3, t[2] + 0.3, top + 2.85, t[3] + 0.3, 0xe63946);
        D.end();
        // barandillas (menos por donde llega la rampa)
        const rails = [R(tu + 1.45, tu + 1.6, tv - 1.6, tv + 1.6), R(tu - 1.6, tu + 1.6, tv - 1.6, tv - 1.45), R(tu - 1.6, tu + 1.6, tv + 1.45, tv + 1.6)];
        for (const r of rails) {
          D.begin({ name: 'Barandilla', mat: 'wood', hp: 70, yield: 3 });
          this.solid(r[0], top, r[1], r[2], top + 1.0, r[3], 0xe63946, { noBottom: true });
          D.end();
        }
        // rampa con peldaños: de la arena (u = tu-7) a la plataforma (u = tu-1.6)
        D.begin({ name: 'Escalera', mat: 'wood', hp: 200, yield: 5 });
        const ru0 = tu - 7.2, ru1 = tu - 1.6;
        const rr = R(ru0, ru1, tv - 0.8, tv + 0.8);
        const up = sg > 0;   // ¿la altura sube con la coordenada del mundo?
        this.ramp(rr[0], rr[1], rr[2], rr[3], alongX ? 0 : 1, up ? y + 0.05 : top, up ? top : y + 0.05);
        const N = 9;
        for (let s = 0; s < N; s++) {
          const st = R(ru0 + (s * (ru1 - ru0)) / N, ru0 + ((s + 1) * (ru1 - ru0)) / N, tv - 0.8, tv + 0.8);
          this.solid(st[0], y - 0.1, st[1], st[2], y + (s + 0.6) * (hgt / N), st[3], wood, { jitter: 0.03, noBottom: true });
        }
        D.end();
        const [fx, fz] = W(ru0 - 1.2, tv), [px2, pz2] = W(tu, tv);
        const n1 = Nv.addNode(fx, y, fz, true), n2 = Nv.addNode(px2, top, pz2, false);
        Nv.link(n1, n2);
        this.chestSpots.push({ x: px2, y: top, z: pz2, rot: this.rr(0, 6.28) });
        placed.push(R(ru0 - 1, tu + 2, tv - 2, tv + 2));
        this.buildings.push({ x0: t[0], z0: t[1], x1: t[2], z1: t[3], floors: 0, base: y, top: top + 2.85, color: 0xe63946 });
      }

      const free = (x, z, m) => !placed.some((b) => x > b[0] - m && x < b[2] + m && z > b[1] - m && z < b[3] + m) && !this.nearRoad(x, z, m + 0.5);
      // 5) palmeras
      for (let i = 0, n = 0; i < 260 && n < 44; i++) {
        const [x, z] = W(this.rr(-34, 40), this.rr(-90, 90));
        if (!free(x, z, 2.5)) continue;
        const h = G.Phys.heightAt(x, z);
        if (h < 1.2) continue;
        this.palm(x, z, h - 0.1);
        placed.push([x - 1.5, z - 1.5, x + 1.5, z + 1.5]);
        n++;
      }
      // 6) sombrillas y tumbonas en la arena (las tumbonas sirven de cobertura baja)
      for (let i = 0, n = 0; i < 140 && n < 18; i++) {
        const [x, z] = W(this.rr(20, 36), this.rr(-86, 86));
        if (!free(x, z, 2)) continue;
        const h = G.Phys.heightAt(x, z);
        if (h < 1.0) continue;
        this.vbox(x - 0.06, h, z - 0.06, x + 0.06, h + 2.4, z + 0.06, 0xeeeeee, { noBottom: true });
        const um = new THREE.Matrix4().makeTranslation(x, h + 1.0, z).multiply(new THREE.Matrix4().makeScale(0.75, 0.18, 0.75));
        this.vgeo(this.tpl.ball, um, this.pick([0xff5d5d, 0xffd166, 0x4cc9f0, 0xff8fab]));
        const lr = alongX ? [x + 0.5, z - 0.35, x + 2.4, z + 0.35] : [x - 0.35, z + 0.5, x + 0.35, z + 2.4];
        D.begin({ name: 'Tumbona', mat: 'wood', hp: 50, yield: 4 });
        this.solid(lr[0], h, lr[1], lr[2], h + 0.45, lr[3], this.pick([0xffffff, 0x4cc9f0, 0xffd166]), { noBottom: true });
        D.end();
        placed.push([x - 1, z - 1, x + 3, z + 3]);
        n++;
      }
      // 7) botín por la arena
      for (let i = 0, n = 0; i < 100 && n < 14; i++) {
        const [x, z] = W(this.rr(-8, 38), this.rr(-86, 86));
        if (!free(x, z, 1)) continue;
        const h = G.Phys.heightAt(x, z);
        if (h < 1.0) continue;
        this.lootSpots.push({ x, y: h, z });
        n++;
      }
      // nodos para que los bots se muevan por el pueblo
      for (const [u, v] of [[0, 0], [-6, -30], [-6, 30], [-6, -52], [-6, 52], [9, 0], [9, -25], [9, 25], [26, -6], [26, 40], [26, -30],
        [-28, 0], [-28, -28], [-28, 28], [-30, -52], [-30, 52],
        [-6, -70], [-6, 70], [9, -50], [9, 50], [9, -70], [9, 70], [26, -70], [26, 66], [-28, -76], [-30, 76], [-6, -88], [-6, 88]]) {
        const [x, z] = W(u, v);
        if (!free(x, z, 0.5)) continue;
        Nv.addNode(x, Math.max(G.Phys.heightAt(x, z), 0), z, true);
      }
      // una moto aparcada detrás del paseo
      {
        const [mx, mz] = W(11, -2);
        this.motoSpots.push({ x: mx, y: y, z: mz, yaw: alongX ? Math.PI : -Math.PI / 2 });
        const [mx2, mz2] = W(11, -66);
        this.motoSpots.push({ x: mx2, y: y, z: mz2, yaw: alongX ? Math.PI : -Math.PI / 2 });
      }
      // 8) muelle hacia el mar
      this.buildPier(p);
    },

    /* Casita de playa sobre pilotes. porch = lado donde está el porche y la puerta */
    bungalow(o) {
      const { x0, z0, x1, z1, base, hs, porch, pal } = o;
      const fy = base + hs;              // suelo de la casa
      const wallTop = fy + 3.2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const PD = 2.6, ST = 2.8;          // fondo del porche y largo de la escalera
      // rectángulo fuera de la casa, en el lado del porche (u hacia fuera, v a lo largo de la fachada)
      const out = (u0, u1, v0, v1) => {
        switch (porch) {
          case 'zmin': return [cx + v0, z0 - u1, cx + v1, z0 - u0];
          case 'zmax': return [cx + v0, z1 + u0, cx + v1, z1 + u1];
          case 'xmin': return [x0 - u1, cz + v0, x0 - u0, cz + v1];
          default: return [x1 + u0, cz + v0, x1 + u1, cz + v1];
        }
      };
      const at = (u, v) => { const r = out(u, u, v, v); return [r[0], r[1]]; };
      const front = porch === 'zmin' || porch === 'zmax' ? x1 - x0 : z1 - z0;
      const half = front / 2;
      const deck = 0xc49a6c, skirt = 0x8d7a66;

      // 1) plataforma sobre pilotes (casa + porche): no se rompe, es el "suelo"
      const P = out(0, PD, -half, half);
      for (const r of [[x0, z0, x1, z1], P]) {
        this.solid(r[0] + 0.15, base - 0.6, r[1] + 0.15, r[2] - 0.15, fy - 0.25, r[3] - 0.15, skirt, { noBottom: true, noTop: true });
        this.solid(r[0], fy - 0.25, r[1], r[2], fy, r[3], deck, { jitter: 0.02 });
        // pilotes blancos en las esquinas y cada ~3 m
        const nx = Math.max(1, Math.round((r[2] - r[0]) / 3)), nz = Math.max(1, Math.round((r[3] - r[1]) / 3));
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
          if (i > 0 && i < nx && j > 0 && j < nz) continue;
          const px = r[0] + ((r[2] - r[0]) * i) / nx, pz = r[1] + ((r[3] - r[1]) * j) / nz;
          this.vbox(px - 0.16, base - 0.4, pz - 0.16, px + 0.16, fy - 0.25, pz + 0.16, 0xf4f1ea, { noBottom: true, noTop: true, jitter: 0 });
        }
      }

      // 2) paredes de tablas en color pastel (paneles rompibles y reemplazables)
      const WG = { name: 'Pared', mat: 'wood', hp: 150, yield: 7 };
      this.wall('x', x0, x1, z0, z0 + WT, fy, wallTop, porch === 'zmin' ? cx : null, pal.wall, false, WG);
      this.wall('x', x0, x1, z1 - WT, z1, fy, wallTop, porch === 'zmax' ? cx : null, pal.wall, false, WG);
      this.wall('z', z0 + WT, z1 - WT, x0, x0 + WT, fy, wallTop, porch === 'xmin' ? cz : null, pal.wall, false, WG);
      this.wall('z', z0 + WT, z1 - WT, x1 - WT, x1, fy, wallTop, porch === 'xmax' ? cz : null, pal.wall, false, WG);
      // techo (baldosas rompibles)
      this.slabTiles(x0, z0, x1, z1, wallTop, wallTop + SL, null, 0xf0ebe0,
        { name: 'Techo', mat: 'wood', hp: 150, yield: 6 },
        { tb: 0.12, ty0: wallTop - 0.06, ty1: wallTop + SL + 0.06, color: pal.trim });

      // 3) tejado a dos aguas, con alero
      const yR = wallTop + SL;
      const ridgeX = x1 - x0 >= z1 - z0;
      const L = ridgeX ? x1 - x0 : z1 - z0, Wd = ridgeX ? z1 - z0 : x1 - x0;
      const ov = 0.55, Lo = L + ov * 2, Wo = Wd + ov * 2;
      const hO = Wo * (o.pitch || 0.32);
      D.begin({ name: 'Tejado', mat: 'wood', hp: 260, yield: 8 });
      const m = new THREE.Matrix4().makeTranslation(cx, yR, cz);
      if (!ridgeX) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      m.multiply(new THREE.Matrix4().makeScale(Lo, hO, Wo));
      this.vgeo(this.tpl.roofSlopes, m, pal.roof, 0.03);
      this.vgeo(this.tpl.roofEnds, m, pal.trim, 0);
      // caballete
      if (ridgeX) this.vbox(cx - Lo / 2, yR + hO - 0.12, cz - 0.16, cx + Lo / 2, yR + hO + 0.1, cz + 0.16, pal.trim, { jitter: 0 });
      else this.vbox(cx - 0.16, yR + hO - 0.12, cz - Lo / 2, cx + 0.16, yR + hO + 0.1, cz + Lo / 2, pal.trim, { jitter: 0 });
      // se puede caminar por el tejado (dos rampas) y para las balas lleva cajas escalonadas
      const hw = Wo / 2;
      if (ridgeX) {
        this.ramp(cx - Lo / 2, cz - hw, cx + Lo / 2, cz, 1, yR, yR + hO);
        this.ramp(cx - Lo / 2, cz, cx + Lo / 2, cz + hw, 1, yR + hO, yR);
      } else {
        this.ramp(cx - hw, cz - Lo / 2, cx, cz + Lo / 2, 0, yR, yR + hO);
        this.ramp(cx, cz - Lo / 2, cx + hw, cz + Lo / 2, 0, yR + hO, yR);
      }
      for (let k = 0; k < 3; k++) {
        const d0 = (hw * k) / 3, d1 = (hw * (k + 1)) / 3, ytop = yR + hO * (d1 / hw) - 0.1;
        for (const sgn of [-1, 1]) {
          const a = sgn < 0 ? -hw + d0 : hw - d1, b = sgn < 0 ? -hw + d1 : hw - d0;
          const box = ridgeX
            ? G.Phys.addBox(cx - Lo / 2, yR, cz + a, cx + Lo / 2, ytop, cz + b, { noMove: true })
            : G.Phys.addBox(cx + a, yR, cz - Lo / 2, cx + b, ytop, cz + Lo / 2, { noMove: true });
          D.addBox(D.active, box);
        }
      }
      D.end();

      // 4) porche: barandilla (con hueco para la escalera) y un toldo
      const railH = 0.95, rc = pal.trim;
      for (const r of [out(PD - 0.12, PD, -half, -1.1), out(PD - 0.12, PD, 1.1, half), out(0, PD - 0.12, -half, -half + 0.12), out(0, PD - 0.12, half - 0.12, half)]) {
        D.begin({ name: 'Barandilla', mat: 'wood', hp: 70, yield: 3 });
        this.solid(r[0], fy, r[1], r[2], fy + railH, r[3], rc, { noBottom: true });
        D.end();
      }
      D.begin({ name: 'Toldo', mat: 'wood', hp: 90, yield: 4 });
      for (const v of [-half + 0.06, half - 0.06]) {
        const [px, pz] = at(PD - 0.06, v);
        this.vbox(px - 0.08, fy + railH, pz - 0.08, px + 0.08, wallTop - 0.1, pz + 0.08, rc, { noBottom: true, noTop: true, jitter: 0 });
      }
      const aw = out(0, PD + 0.2, -half - 0.2, half + 0.2);
      this.solid(aw[0], wallTop - 0.1, aw[1], aw[2], wallTop + 0.05, aw[3], pal.roof, { jitter: 0.02 });
      D.end();

      // 5) escalera del porche (rampa con peldaños)
      D.begin({ name: 'Escalera', mat: 'wood', hp: 160, yield: 5 });
      const sr = out(PD, PD + ST, -1.0, 1.0);
      const lowAtMin = porch === 'zmin' || porch === 'xmin';   // el extremo lejano (abajo) está en la coordenada menor
      this.ramp(sr[0], sr[1], sr[2], sr[3], porch === 'zmin' || porch === 'zmax' ? 1 : 0,
        lowAtMin ? base + 0.05 : fy, lowAtMin ? fy : base + 0.05);
      const N = 5;
      for (let s = 0; s < N; s++) {
        const r = out(PD + (s * ST) / N, PD + ((s + 1) * ST) / N, -1.0, 1.0);
        this.solid(r[0], base - 0.1, r[1], r[2], fy - (s + 0.5) * (hs / N), r[3], deck, { noBottom: true, jitter: 0.03 });
      }
      D.end();

      // 6) muebles, botín y cofre (ver interiors.js)
      {
        const [dix, diz] = at(0, 0), [nix, niz] = at(-1.4, 0);
        const dn = { zmin: [0, -1], zmax: [0, 1], xmin: [-1, 0], xmax: [1, 0] }[porch];
        this.furnishBuilding({
          theme: o.interior || 'beach', floors: 1, base: fy, ceil: 3.2,
          main: [x0 + WT, z0 + WT, x1 - WT, z1 - WT], strip: null,
          center: [cx, cz], door: { x: dix, z: diz, nx: dn[0], nz: dn[1] }, nIn: [nix, niz], doorSide: porch,
          farSide: { zmin: 'zmax', zmax: 'zmin', xmin: 'xmax', xmax: 'xmin' }[porch],
          stairs: null, chestChance: 0.9,   // casitas de playa y chalés: casi siempre con cofre
        });
      }
      if (this.r() < 0.4) { const [lx, lz] = at(PD * 0.5, this.rr(-half + 1.5, half - 1.5)); this.lootSpots.push({ x: lx, y: fy, z: lz }); }

      // 7) nodos de navegación: pie de la escalera → porche → dentro
      const Nv = G.Nav;
      const [fx, fz] = at(PD + ST + 1.2, 0), [tx, tz] = at(PD * 0.5, 0), [ix, iz] = at(-1.4, 0);
      const nFoot = Nv.addNode(fx, base, fz, true), nTop = Nv.addNode(tx, fy, tz, false);
      const nIn = Nv.addNode(ix, fy, iz, false), nC = Nv.addNode(cx, fy, cz, false);
      Nv.link(nFoot, nTop); Nv.link(nTop, nIn); Nv.link(nIn, nC);

      this.buildings.push({ x0, z0, x1, z1, floors: 1, base: fy, top: yR + hO, color: pal.wall });
    },

    /* ---------- Villa Cumbre: pueblo en lo alto de una montaña ----------
       Chalés de madera con tejados muy inclinados alrededor de una plaza con
       fuente, una ermita con campanario y un mirador. La carretera llega a la plaza. */
    buildMountainTown(p) {
      const y = p.level, Nv = G.Nav;
      // ¿por dónde llega la carretera? (hacia la ciudad)
      const rd = this.roads.find((r) => r.to === p);
      let aRoad = Math.atan2(-p.z, -p.x);
      if (rd) { const q = rd.pts[Math.max(0, rd.pts.length - 8)]; aRoad = Math.atan2(q.z - p.z, q.x - p.x); }
      const placed = [];
      const freeRect = (r, m) => !placed.some((b) => r[0] < b[2] + m && r[2] > b[0] - m && r[1] < b[3] + m && r[3] > b[1] - m) &&
        ![[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]].some(([x, z]) => this.nearRoad(x, z, 1.5));
      // plaza empedrada con fuente
      this.gbox(p.x - 9, y, p.z - 9, p.x + 9, y + 0.06, p.z + 9, 0xb9b2a5, { noBottom: true, jitter: 0.02 });
      D.begin({ name: 'Fuente', mat: 'stone', hp: 400, yield: 10 });
      this.solid(p.x - 1.6, y, p.z - 1.6, p.x + 1.6, y + 0.7, p.z + 1.6, 0x9a958c, { noBottom: true });
      this.vbox(p.x - 1.35, y + 0.7, p.z - 1.35, p.x + 1.35, y + 0.72, p.z + 1.35, 0x4cb3e6, { jitter: 0 });
      this.solid(p.x - 0.25, y + 0.7, p.z - 0.25, p.x + 0.25, y + 1.8, p.z + 0.25, 0xb0aba2, { noBottom: true });
      D.end();
      placed.push([p.x - 2, p.z - 2, p.x + 2, p.z + 2]);
      for (const [dx, dz] of [[-6, -6], [6, 6], [-6, 6], [6, -6]]) this.lootSpots.push({ x: p.x + dx, y, z: p.z + dz });
      this.chestSpots.push({ x: p.x + 2.6, y, z: p.z, rot: Math.PI / 2 });

      // ermita con campanario, enfrente de la carretera
      {
        const a = aRoad + Math.PI, cx = p.x + Math.cos(a) * 21, cz = p.z + Math.sin(a) * 21;
        const alongX = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
        const w = alongX ? 11 : 8, d = alongX ? 8 : 11;
        const r = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
        const porch = alongX ? (Math.cos(a) > 0 ? 'xmin' : 'xmax') : (Math.sin(a) > 0 ? 'zmin' : 'zmax');
        if (freeRect(r, 1)) {
          this.bungalow({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y, hs: 0.35, porch, pal: { wall: 0xf2efe6, trim: 0xb5523b, roof: 0x9b3a2a }, pitch: 0.5, interior: 'chapel' });
          placed.push([r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1]);
          // campanario a un lado
          const tx = alongX ? cx : r[2] + 2.2, tz = alongX ? r[3] + 2.2 : cz;
          D.begin({ name: 'Campanario', mat: 'stone', hp: 600, yield: 12 });
          this.solid(tx - 1.6, y - 0.5, tz - 1.6, tx + 1.6, y + 9, tz + 1.6, 0xe8e2d6, { noBottom: true });
          for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) this.solid(tx + ox - 0.3, y + 9, tz + oz - 0.3, tx + ox + 0.3, y + 11, tz + oz + 0.3, 0xe8e2d6, { noBottom: true, noTop: true });
          this.vbox(tx - 0.45, y + 9.6, tz - 0.45, tx + 0.45, y + 10.6, tz + 0.45, 0xd4a017, { jitter: 0 });
          this.solid(tx - 1.8, y + 11, tz - 1.8, tx + 1.8, y + 11.3, tz + 1.8, 0x9b3a2a);
          const m = new THREE.Matrix4().makeTranslation(tx, y + 11.3 + 1.3, tz).multiply(new THREE.Matrix4().makeScale(0.36, 0.37, 0.36));
          this.vgeo(this.tpl.roofCone, m, 0x9b3a2a);
          D.end();
          placed.push([tx - 2.5, tz - 2.5, tx + 2.5, tz + 2.5]);
          this.buildings.push({ x0: tx - 1.6, z0: tz - 1.6, x1: tx + 1.6, z1: tz + 1.6, floors: 0, base: y, top: y + 14, color: 0xe8e2d6 });
        }
      }

      // chalés alrededor de la plaza (con el porche mirando a la plaza)
      const slots = [];
      for (let i = 0; i < 7; i++) slots.push([aRoad + ((i + 0.5) / 7) * Math.PI * 2, 21]);
      for (let i = 0; i < 9; i++) slots.push([aRoad + (i / 9) * Math.PI * 2, 34]);
      for (const [a, rad] of slots) {
        if (Math.abs(U.angleDiff(a, aRoad)) < (rad > 30 ? 0.32 : 0.5)) continue;           // hueco para la carretera
        const cx = p.x + Math.cos(a) * rad, cz = p.z + Math.sin(a) * rad;
        const alongX = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
        const w = alongX ? this.rr(7, 8) : this.rr(8, 9.5), d = alongX ? this.rr(8, 9.5) : this.rr(7, 8);
        const r = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
        // el porche + la escalera salen 5,4 m hacia la plaza
        const porch = alongX ? (Math.cos(a) > 0 ? 'xmin' : 'xmax') : (Math.sin(a) > 0 ? 'zmin' : 'zmax');
        const pr = porch === 'xmin' ? [r[0] - 5.6, r[1], r[0], r[3]] : porch === 'xmax' ? [r[2], r[1], r[2] + 5.6, r[3]]
          : porch === 'zmin' ? [r[0], r[1] - 5.6, r[2], r[1]] : [r[0], r[3], r[2], r[3] + 5.6];
        const all = [Math.min(r[0], pr[0]), Math.min(r[1], pr[1]), Math.max(r[2], pr[2]), Math.max(r[3], pr[3])];
        if (!freeRect(all, 0.6)) continue;
        this.bungalow({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], base: y, hs: 0.45, porch, pal: this.pick(PAL_ALPINE), pitch: 0.55, interior: this.pick(['home', 'cabin']) });
        placed.push(all);
      }

      // mirador de madera al borde del pueblo (con cofre)
      {
        const a = aRoad + Math.PI / 2 + 0.35, cx = p.x + Math.cos(a) * 44, cz = p.z + Math.sin(a) * 44;
        const r = [cx - 2.5, cz - 2.5, cx + 2.5, cz + 2.5];
        if (freeRect(r, 0.5)) {
          D.begin({ name: 'Mirador', mat: 'wood', hp: 220, yield: 7 });
          this.solid(r[0], y - 3, r[1], r[2], y + 0.3, r[3], 0x8b6a45, { bottomColor: 0x5a4330 });
          D.end();
          for (const q of [[r[0], r[1], r[2], r[1] + 0.12], [r[0], r[3] - 0.12, r[2], r[3]], [r[0], r[1], r[0] + 0.12, r[3]], [r[2] - 0.12, r[1], r[2], r[3]]]) {
            D.begin({ name: 'Barandilla', mat: 'wood', hp: 70, yield: 3 });
            this.solid(q[0], y + 0.3, q[1], q[2], y + 1.3, q[3], 0x6b4a2a, { noBottom: true });
            D.end();
          }
          this.vbox(cx - 0.06, y + 0.3, cz - 0.06, cx + 0.06, y + 1.4, cz + 0.06, 0x333333);
          this.vbox(cx - 0.1, y + 1.4, cz - 0.4, cx + 0.1, y + 1.6, cz + 0.4, 0x6b7a8a);
          this.chestSpots.push({ x: cx + 1.4, y: y + 0.3, z: cz + 1.4, rot: 0 });
          placed.push(r);
        }
      }
      // nodos para los bots y una moto aparcada junto a la plaza
      Nv.addNode(p.x + 4, y, p.z + 4, true);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        Nv.addNode(p.x + Math.cos(a) * 11, y, p.z + Math.sin(a) * 11, true);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, x = p.x + Math.cos(a) * 42, z = p.z + Math.sin(a) * 42;
        const h = G.Phys.heightAt(x, z);
        if (h > 2.5) Nv.addNode(x, h, z, true);
      }
      const mx = p.x + Math.cos(aRoad + 0.35) * 10, mz = p.z + Math.sin(aRoad + 0.35) * 10;
      this.motoSpots.push({ x: mx, y, z: mz, yaw: -aRoad + Math.PI / 2 });
    },

    // Palmera con el tronco curvado
    palm(x, z, y) {
      const s = this.rr(0.85, 1.2);
      const Hh = 7 * s, la = this.rr(0, 6.28), lean = this.rr(0.6, 2.0) * s;
      D.begin({ name: 'Palmera', mat: 'wood', hp: Math.round(90 * s), yield: 7 });
      const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
      const m = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
      let px = x, py = y, pz = z;
      const N = 6;
      for (let i = 0; i < N; i++) {
        const t = (i + 1) / N;
        const nx = x + Math.cos(la) * lean * t * t, nz = z + Math.sin(la) * lean * t * t, ny = y + Hh * t;
        dir.set(nx - px, ny - py, nz - pz);
        const l = dir.length();
        dir.divideScalar(l);
        q.setFromUnitVectors(up, dir);
        m.compose(pos.set(px, py, pz), q, sc.set(s, l + 0.05, s));
        this.vgeo(this.tpl.palmSeg, m, i % 2 ? 0x9c7a4f : 0x8a6a42, 0.04);
        px = nx; py = ny; pz = nz;
      }
      const mt = new THREE.Matrix4().makeTranslation(px, py, pz)
        .multiply(new THREE.Matrix4().makeRotationY(this.rr(0, 6.28)))
        .multiply(new THREE.Matrix4().makeScale(s, s, s));
      this.fgeo(this.tpl.palmTop, mt, 0x4c9a3a, 0.08);
      const b1 = G.Phys.addBox(x - 0.3 * s, y - 0.2, z - 0.3 * s, x + 0.3 * s, y + Hh * 0.5, z + 0.3 * s);
      D.addBox(D.active, b1);
      const mx = x + Math.cos(la) * lean * 0.56, mz = z + Math.sin(la) * lean * 0.56;
      const b2 = G.Phys.addBox(mx - 0.28 * s, y + Hh * 0.5, mz - 0.28 * s, mx + 0.28 * s, y + Hh, mz + 0.28 * s);
      D.addBox(D.active, b2);
      D.grow(D.active, px - 3, y, pz - 3, px + 3, py + 1, pz + 3);
      D.end();
    },

    /* ---------- Bosque Gigante: árboles altísimos al otro lado de la isla ----------
       En el centro hay un claro con un refugio de troncos y una cabaña.
       Algunos árboles tienen una plataforma con cofre (¡sube construyendo!). */
    buildGiantForest(p) {
      const y = p.level, Nv = G.Nav;
      // refugio de dos plantas y cabaña, con la puerta mirando al centro del claro
      const lodge = { x0: p.x - 16, z0: p.z - 6, x1: p.x - 2, z1: p.z + 5 };
      this.building({ ...lodge, base: y + 0.25, floors: 2, pal: PAL_LOG, stairSide: 1, doorSide: 'xmax', outsideY: y, kind: 'house', interior: 'lodge' });
      const cabin = { x0: p.x + 5, z0: p.z + 3, x1: p.x + 15, z1: p.z + 12 };
      this.building({ ...cabin, base: y + 0.25, floors: 1, pal: PAL_LOG, stairSide: 1, doorSide: 'zmin', outsideY: y, kind: 'house', interior: 'cabin' });
      // hoguera (decoración) y pilas de troncos (cobertura)
      const fx = p.x + 6, fz = p.z - 7;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sx = fx + Math.cos(a) * 1.0, sz = fz + Math.sin(a) * 1.0;
        this.vbox(sx - 0.22, y, sz - 0.22, sx + 0.22, y + 0.3, sz + 0.22, 0x8f8f88, { noBottom: true });
      }
      this.vbox(fx - 0.6, y + 0.05, fz - 0.12, fx + 0.6, y + 0.3, fz + 0.12, 0x5a3a1a, { noBottom: true });
      this.vbox(fx - 0.12, y + 0.05, fz - 0.6, fx + 0.12, y + 0.3, fz + 0.6, 0x5a3a1a, { noBottom: true });
      this.vbox(fx - 0.3, y + 0.3, fz - 0.3, fx + 0.3, y + 0.55, fz + 0.3, 0xff8c1a, { jitter: 0 });
      for (const [lx, lz, al] of [[p.x - 6, p.z - 14, true], [p.x + 16, p.z - 4, false], [p.x - 4, p.z + 14, true]]) {
        D.begin({ name: 'Troncos', mat: 'wood', hp: 120, yield: 10 });
        if (al) this.solid(lx - 2, y, lz - 0.7, lx + 2, y + 1.3, lz + 0.7, 0x7a5232, { noBottom: true });
        else this.solid(lx - 0.7, y, lz - 2, lx + 0.7, y + 1.3, lz + 2, 0x7a5232, { noBottom: true });
        D.end();
      }
      this.lootSpots.push({ x: fx + 2.2, y, z: fz }, { x: p.x, y, z: p.z - 12 });
      this.motoSpots.push({ x: p.x + 1, y, z: p.z + 18, yaw: 0.4 });
      Nv.addNode(p.x, y, p.z, true);
      Nv.addNode(p.x + 2, y, p.z - 9, true);

      // árboles gigantes alrededor del claro
      const trees = [];
      let plats = 0;
      for (let i = 0; i < 700 && trees.length < 58; i++) {
        const a = this.rr(0, 6.28), d = this.rr(30, 105);
        const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.6 || h > 45 || !this.isFree(x, z, 4)) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 9)) continue;
        const plat = plats < 3 && d < 80 && this.r() < 0.25;
        this.giantTree(x, z, h, plat);
        trees.push({ x, z });
        if (plat) plats++;
      }
      // botín por el suelo del bosque y nodos para los bots
      for (let i = 0, n = 0; i < 60 && n < 10; i++) {
        const a = this.rr(0, 6.28), d = this.rr(30, 95);
        const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.6 || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.5)) continue;
        if (n < 2) this.chestSpots.push({ x, y: h, z, rot: this.rr(0, 6.28) });
        else this.lootSpots.push({ x, y: h, z });
        n++;
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, d = k % 2 ? 50 : 82;
        const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.4 || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.5)) continue;
        Nv.addNode(x, h, z, true);
      }
    },

    // Árbol gigante (secuoya o roble enorme). plat = con plataforma y cofre
    giantTree(x, z, y, plat) {
      const s = this.rr(0.85, 1.25);
      const Ht = this.rr(17, 24) * s, Rt = this.rr(0.85, 1.15) * s;
      const conifer = plat || this.r() < 0.72;
      const T = (tx, ty, tz) => new THREE.Matrix4().makeTranslation(tx, ty, tz);
      const Sc = (a, b, c) => new THREE.Matrix4().makeScale(a, b, c);
      const rot = new THREE.Matrix4().makeRotationY(this.rr(0, 6.28));
      D.begin({ name: 'Árbol gigante', mat: 'wood', hp: Math.round(380 * s), yield: 12 });
      const bark = conifer ? 0x7a3f28 : 0x5e4330;
      this.vgeo(this.tpl.gtrunk, T(x, y - 0.4, z).multiply(rot).multiply(Sc(Rt, Ht * (conifer ? 0.92 : 0.72), Rt)), bark, 0.06);
      this.vgeo(this.tpl.gtrunk, T(x, y - 0.4, z).multiply(rot).multiply(Sc(Rt * 1.45, 2.0, Rt * 1.45)), bark, 0.06);   // raíces
      if (conifer) {
        const c0 = plat ? 0.5 : 0.36, step = plat ? 0.12 : 0.15;
        for (let j = 0; j < 4; j++) {
          const yy = y + Ht * (c0 + j * step);
          const rr = (5.2 - j * 1.05) * s * this.rr(0.9, 1.1);
          this.fgeo(this.tpl.gcone, T(x, yy, z).multiply(rot).multiply(Sc(rr, Ht * 0.28, rr)), this.pick([0x24502c, 0x2c5e33, 0x1f4a2a]), 0.06, [0.65, 1.12]);
        }
      } else {
        for (let j = 0; j < 4; j++) {
          const a = j * 1.9 + this.r(), d = j === 0 ? 0 : 3.4 * s;
          const r = (j === 0 ? 5.6 : 4.3) * s;
          const m = T(x + Math.cos(a) * d, y + Ht * 0.72 + (j === 0 ? 2.6 * s : 0), z + Math.sin(a) * d).multiply(Sc(r, r * 0.8, r));
          this.fgeo(this.tpl.gball, m, this.pick([0x3f7f33, 0x4a8c3a, 0x356f2c]), 0.06, [0.65, 1.12]);
        }
      }
      const box = G.Phys.addBox(x - Rt * 0.85, y - 0.5, z - Rt * 0.85, x + Rt * 0.85, y + Ht * 0.9, z + Rt * 0.85);
      D.addBox(D.active, box);
      D.grow(D.active, x - 5 * s, y, z - 5 * s, x + 5 * s, y + Ht + 2, z + 5 * s);
      D.end();
      this.mapTrees.push({ x, z, r: conifer ? 4.5 * s : 6 * s });

      if (plat) {
        // plataforma a 5 m con barandilla: sólo se llega construyendo rampas
        const py = y + 5.0, hw = 2.9;
        D.begin({ name: 'Plataforma', mat: 'wood', hp: 240, yield: 6 });
        this.solid(x - hw, py - 0.3, z - hw, x + hw, py, z + hw, 0xa07448, { bottomColor: 0x7a5634 });
        for (const [px, pz] of [[x - hw + 0.2, z - hw + 0.2], [x + hw - 0.2, z - hw + 0.2], [x - hw + 0.2, z + hw - 0.2], [x + hw - 0.2, z + hw - 0.2]]) {
          this.vbox(px - 0.12, y - 0.3, pz - 0.12, px + 0.12, py - 0.3, pz + 0.12, 0x6b4a2a, { noBottom: true, noTop: true });
        }
        D.end();
        for (const r of [[x - hw, z - hw, x + hw, z - hw + 0.12], [x - hw, z + hw - 0.12, x + hw, z + hw], [x - hw, z - hw + 0.12, x - hw + 0.12, z + hw - 0.12], [x + hw - 0.12, z - hw + 0.12, x + hw, z + hw - 0.12]]) {
          D.begin({ name: 'Barandilla', mat: 'wood', hp: 70, yield: 3 });
          this.solid(r[0], py, r[1], r[2], py + 0.9, r[3], 0x8a6040, { noBottom: true });
          D.end();
        }
        const cxp = x + (hw - 0.9) * (this.r() < 0.5 ? 1 : -1), czp = z + (hw - 0.9) * (this.r() < 0.5 ? 1 : -1);
        this.chestSpots.push({ x: cxp, y: py, z: czp, rot: Math.atan2(x - cxp, z - czp), noBot: true });
      }
    },

    isFree(x, z, margin) {
      for (const zn of this.zones) {
        if (this.zoneDist(zn, x, z) < zn.r + margin) return false;
      }
      // tampoco encima de las carreteras
      if (this.roads.length && this.nearRoad(x, z, margin + 1)) return false;
      return true;
    },

    scatterNature() {
      const R = C.islandRadius + 20;
      const forests = this.pois.filter((p) => p.type === 'forest');
      const hills = this.pois.filter((p) => p.type === 'hill');
      const giant = this.pois.find((p) => p.type === 'giantforest');
      const nearForest = (x, z) => forests.some((f) => Math.hypot(x - f.x, z - f.z) < 170);
      let trees = 0;
      for (let i = 0; i < 4200 && trees < 1350; i++) {
        let x, z;
        if (forests.length && i % 4 === 0) {
          const forest = forests[i % forests.length];
          const a = this.rr(0, 6.28), d = this.rr(forest.r + 6, forest.r + 80);
          x = forest.x + Math.cos(a) * d; z = forest.z + Math.sin(a) * d;
        } else {
          const a = this.rr(0, 6.28), d = Math.sqrt(this.r()) * R;
          x = Math.cos(a) * d; z = Math.sin(a) * d;
        }
        const h = G.Phys.heightAt(x, z);
        if (h < 2.4 || !this.isFree(x, z, 4)) continue;
        // en el bosque gigante casi no hay árboles normales
        if (giant && Math.hypot(x - giant.x, z - giant.z) < 105 && this.r() < 0.8) continue;
        // junto a la arena, palmeras
        if (h < 3.4) { this.palm(x, z, h - 0.1); trees++; continue; }
        this.tree(x, z, h - 0.1, h > 22 || nearForest(x, z) ? 'pine' : (this.r() < 0.35 ? 'pine' : 'round'));
        trees++;
      }
      let rocks = 0;
      for (let i = 0; i < 1500 && rocks < 320; i++) {
        let x, z;
        if (hills.length && i % 3 === 0) {
          const hill = hills[i % hills.length];
          const a = this.rr(0, 6.28), d = this.rr(hill.r + 5, hill.r + 60);
          x = hill.x + Math.cos(a) * d; z = hill.z + Math.sin(a) * d;
        } else {
          const a = this.rr(0, 6.28), d = Math.sqrt(this.r()) * R;
          x = Math.cos(a) * d; z = Math.sin(a) * d;
        }
        const h = G.Phys.heightAt(x, z);
        if (h < 1 || !this.isFree(x, z, 3)) continue;
        this.rock(x, z, h, this.rr(0.9, 2.6));
        rocks++;
      }
      for (let i = 0; i < 650; i++) {
        const a = this.rr(0, 6.28), d = Math.sqrt(this.r()) * R;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.4 || !this.isFree(x, z, 2)) continue;
        const s = this.rr(0.7, 1.4);
        const m = new THREE.Matrix4().makeTranslation(x, h - 0.1, z).multiply(new THREE.Matrix4().makeScale(s, s * 0.8, s));
        this.fgeo(this.tpl.bush, m, this.pick([0x4f9a3e, 0x5aa346, 0x3f8a35]), 0.08, [0.7, 1.12]);
      }
    },

    scatterOutdoorLoot() {
      const R = C.islandRadius;
      let loot = 0, chests = 0;
      for (let i = 0; i < 7000 && (loot < 300 || chests < 66); i++) {
        const a = this.rr(0, 6.28), d = Math.sqrt(this.r()) * R;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = G.Phys.heightAt(x, z);
        if (h < 2.5 || !this.isFree(x, z, 3)) continue;
        if (!G.Phys.lineClear(x, h + 0.3, z, x, h + 3, z)) continue;
        const near = G.Phys.query(x - 0.8, z - 0.8, x + 0.8, z + 0.8, []);
        if (near.some((b) => b.y1 > h + 0.2 && b.y0 < h + 2)) continue;
        if (chests < 66 && this.r() < 0.25) { this.chestSpots.push({ x, y: h, z, rot: this.rr(0, 6.28) }); chests++; }
        else if (loot < 300) { this.lootSpots.push({ x, y: h, z }); loot++; }
      }
    },

    flushChunks(scene) {
      const map = new Map();
      for (const [chunks, mat] of [[this.chunks, G.vcMaterial], [this.fchunks, this.foliageMaterial()]]) {
        for (const b of chunks.values()) {
          if (b.empty) continue;
          const geo = b.toGeometry();
          map.set(b, geo);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.add(scene, mesh);
        }
      }
      D.bindGeometries(map);
      this.fchunks = new Map();
      // calcomanías del suelo: capa 1 (calles, aceras, plazas) y capa 2 (líneas pintadas)
      if (!this._decalMats) {
        this._decalMats = [1, 2].map((l) => new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 * l, polygonOffsetUnits: -10 * l }));
      }
      this.dchunks.forEach((L, li) => {
        for (const b of L.values()) {
          if (b.empty) continue;
          const mesh = new THREE.Mesh(b.toGeometry(), this._decalMats[li]);
          mesh.receiveShadow = true;
          this.add(scene, mesh);
        }
      });
      this.dchunks = [new Map(), new Map()];
      // vallas publicitarias: un panel con su anuncio (desaparece si se rompe la valla)
      for (const bb of this.billboards) {
        const mesh = new THREE.Mesh(this.adGeometry(), this.adMaterial(bb.ad));
        mesh.position.set(bb.x, bb.y, bb.z);
        mesh.rotation.y = bb.ry;
        mesh.scale.set(bb.w, bb.h, 1);
        mesh.userData.keepGeo = true;
        this.add(scene, mesh);
        if (bb.g) bb.g.onDestroy = () => { mesh.visible = false; };
      }
      this.chunks = new Map();
      // esferas del reloj
      if (!this._clockMat) {
        this._clockMat = new THREE.MeshLambertMaterial({ map: G.Models.clockTexture() });
        this._clockGeo = new THREE.PlaneGeometry(4.6, 4.6);
      }
      for (const s of this.clockSpots || []) {
        const m = new THREE.Mesh(this._clockGeo, this._clockMat);
        m.position.set(s.x, s.y, s.z);
        m.rotation.y = s.ry;
        m.userData.keepGeo = true;
        this.add(scene, m);
      }
    },

    buildSky(scene) {
      if (!this._sky) {
        // degradado azul con sol (ver G.makeSkyMaterial): se dibuja siempre al fondo
        const geo = new THREE.SphereGeometry(100, 32, 16);
        this._sky = new THREE.Mesh(geo, G.makeSkyMaterial(new THREE.Vector3().fromArray(G.STYLE.sunDir)));
        this._sky.renderOrder = -1;
        this._sky.userData.keepGeo = true;
        this._sky.frustumCulled = false;
      }
      this.add(scene, this._sky);
      this.sky = this._sky;
    },

    buildClouds(scene) {
      // cúmulos esponjosos con el sombreado ya pintado (ver G.makeCloudGeometry)
      if (!this._cloudMat) this._cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      const mesh = new THREE.Mesh(G.makeCloudGeometry(() => this.r(), new THREE.Vector3().fromArray(G.STYLE.sunDir)), this._cloudMat);
      mesh.frustumCulled = false;
      this.add(scene, mesh);
      this.clouds = mesh;
    },
  });
})();

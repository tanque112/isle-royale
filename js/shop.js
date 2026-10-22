/* =====================================================================
   shop.js — Taquilla y tienda: skins y picos (sólo cambian el aspecto).
   - Las MONEDAS se ganan al acabar cada partida (bajas, puesto y victoria).
   - En la TIENDA se compran skins y picos; en la TAQUILLA se equipan.
   - Todo se guarda en el navegador (localStorage).
   - Los bots también llevan skins y picos de la tienda (al azar).
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const $ = (id) => document.getElementById(id);
  const KEY = 'islaRoyaleLocker';

  /* ---------- Skins ----------
     rarity = 0 común ... 4 legendaria · acc = complemento (ver models.js): 'cabeza' o 'cabeza+cuerpo'
     (cuerpo: cape = capa, wings = alas, tail = cola) · pal = colores (acc1/acc2 = complemento;
     cape / wing / tail = color de la capa, las alas o la cola)
     El precio depende de la rareza (en monedas). */
  const SKIN_PRICE = [800, 1200, 1800, 2500, 3500];
  const P = SKIN_PRICE;
  G.SKINS = [
    { id: 'azar', name: 'Al azar', rarity: 0, price: 0, desc: 'Ropa de colores distinta en cada partida.' },
    { id: 'explorador', name: 'Explorador', rarity: 0, price: 0, acc: 'cap', desc: 'Gorra, mochila y ganas de abrir cofres.',
      pal: { shirt: 0x6b8e3d, pants: 0x5a4a32, skin: 0xf1c27d, hair: 0x5a3a22, shoes: 0x3a2a1a, pack: 0xc49a6c, acc1: 0xc0a060, acc2: 0x6b8e3d } },
    // --- comunes ---
    { id: 'surfista', name: 'Surfista', rarity: 0, price: P[0], acc: 'sunglasses', desc: 'Recién salido de Bahía Coral.',
      pal: { shirt: 0x00b4d8, pants: 0xffb703, skin: 0xc68642, hair: 0xf2d16b, shoes: 0xffffff, pack: 0xff5fa2, acc1: 0x111111, acc2: 0xff5fa2 } },
    { id: 'cocinero', name: 'Chef Chispas', rarity: 0, price: P[0], acc: 'chef', desc: 'Cocina a fuego lento y dispara a fuego rápido.',
      pal: { shirt: 0xf4f4f2, pants: 0x2b2b2b, skin: 0xffdbac, hair: 0x3b2314, shoes: 0x222222, pack: 0xd62828, acc1: 0xffffff, acc2: 0xd62828 } },
    { id: 'obrera', name: 'Obrera', rarity: 0, price: P[0], acc: 'hardhat', desc: 'Construye una rampa antes de que digas "hola".',
      pal: { shirt: 0xff8c1a, pants: 0x264d73, skin: 0xc68642, hair: 0x111111, shoes: 0x5a3a22, pack: 0xffd166, acc1: 0xffcc00, acc2: 0xf4f4f4 } },
    // --- poco comunes ---
    { id: 'mago', name: 'Mago', rarity: 1, price: P[1], acc: 'wizard', desc: 'Sombrero puntiagudo y barba blanca.',
      pal: { shirt: 0x5a189a, pants: 0x3c096c, skin: 0xffdbac, hair: 0xdddddd, shoes: 0x222222, pack: 0xffd166, acc1: 0x3c096c, acc2: 0xffd166 } },
    { id: 'vaquera', name: 'Vaquera', rarity: 1, price: P[1], acc: 'cowboy', desc: 'La sheriff de Villa Polvo.',
      pal: { shirt: 0xb5523b, pants: 0x264d73, skin: 0xe0ac69, hair: 0x8b4513, shoes: 0x5a3a22, pack: 0x8b5e3c, acc1: 0x8b5e3c, acc2: 0x3a2a1a } },
    { id: 'esquiadora', name: 'Esquiadora', rarity: 1, price: P[1], acc: 'beanie', desc: 'Baja de Villa Cumbre sin frenar.',
      pal: { shirt: 0x4cc9f0, pants: 0x1d3557, skin: 0xffdbac, hair: 0xd4a017, shoes: 0xf4f4f4, pack: 0xe63946, acc1: 0xe63946, acc2: 0xf4f4f4 } },
    { id: 'pintor', name: 'Pintor', rarity: 1, price: P[1], acc: 'beret', desc: 'Pinta las paredes que construye.',
      pal: { shirt: 0xf4f1ea, pants: 0x2b2b2b, skin: 0xf1c27d, hair: 0x2b2b2b, shoes: 0x7a4a26, pack: 0xffbe0b, acc1: 0x1d1d2b, acc2: 0x1d1d2b } },
    { id: 'punki', name: 'Punki', rarity: 1, price: P[1], acc: 'mohawk', desc: 'Cresta de colores y mucha actitud.',
      pal: { shirt: 0x1b1b1f, pants: 0x6d1a36, skin: 0xe0ac69, hair: 0x2b2b2b, shoes: 0x111111, pack: 0x9aa4ae, acc1: 0xff006e, acc2: 0x00f5d4 } },
    { id: 'fiestera', name: 'Fiestera', rarity: 1, price: P[1], acc: 'party', desc: 'Cada victoria es una fiesta.',
      pal: { shirt: 0xffd166, pants: 0x8338ec, skin: 0x8d5524, hair: 0x111111, shoes: 0xff5fa2, pack: 0x06d6a0, acc1: 0x3a86ff, acc2: 0xffd166 } },
    // --- raras ---
    { id: 'pirata', name: 'Pirata', rarity: 2, price: P[2], acc: 'pirate', desc: 'Pañuelo rojo y parche en el ojo.',
      pal: { shirt: 0xf2eee6, pants: 0x222222, skin: 0xc68642, hair: 0x111111, shoes: 0x5a3a22, pack: 0x7a2e22, acc1: 0xc0392b, acc2: 0x111111 } },
    { id: 'ninja', name: 'Ninja', rarity: 2, price: P[2], acc: 'hood', desc: 'Silencioso como una sombra.',
      pal: { shirt: 0x1b1b1f, pants: 0x1b1b1f, skin: 0xe0ac69, hair: 0x111111, shoes: 0x111111, pack: 0xb3202a, acc1: 0x1b1b1f, acc2: 0xb3202a } },
    { id: 'zombi', name: 'Zombi', rarity: 2, price: P[2], desc: 'Un poco verde, pero con hambre de victoria.',
      pal: { shirt: 0x6d6875, pants: 0x4a4e69, skin: 0x8fbf6a, hair: 0x3a3a2a, shoes: 0x333333, pack: 0x5a4a32 } },
    { id: 'showman', name: 'Showman', rarity: 2, price: P[2], acc: 'tophat', desc: 'Damas y caballeros: ¡el último en pie!',
      pal: { shirt: 0x9b2226, pants: 0x1a1a1a, skin: 0xffdbac, hair: 0x3b2314, shoes: 0x111111, pack: 0xd4a017, acc1: 0x1a1a1a, acc2: 0x9b2226 } },
    { id: 'buzo', name: 'Buceadora', rarity: 2, price: P[2], acc: 'diver', desc: 'Del fondo del muelle de Puerto Viejo.',
      pal: { shirt: 0x264d73, pants: 0x264d73, skin: 0xe0ac69, hair: 0x111111, shoes: 0x3a3a3a, pack: 0x9aa4ae, acc1: 0xc9a227, acc2: 0x8a6a2a } },
    { id: 'gata', name: 'Agente Gata', rarity: 2, price: P[2], acc: 'catears+tail', desc: 'Siete vidas no, pero casi.',
      pal: { shirt: 0x2b2b2b, pants: 0x2b2b2b, skin: 0xf1c27d, hair: 0x2b2b2b, shoes: 0x111111, pack: 0x6d597a, acc1: 0x2b2b2b, acc2: 0xff8fab, tail: 0x2b2b2b } },
    { id: 'quarterback', name: 'Quarterback', rarity: 2, price: P[2], acc: 'football', desc: 'Lanza granadas... digo, balones.',
      pal: { shirt: 0x1d3557, pants: 0xf4f4f4, skin: 0x8d5524, hair: 0x111111, shoes: 0x222222, pack: 0xe63946, acc1: 0x1d3557, acc2: 0xe63946 } },
    // --- épicas ---
    { id: 'dj', name: 'DJ Neón', rarity: 3, price: P[3], acc: 'headphones', desc: 'Pone la música en el autobús.',
      pal: { shirt: 0xff00a8, pants: 0x2a2a3a, skin: 0x8d5524, hair: 0x00e5ff, shoes: 0x00e5ff, pack: 0x7b2cbf, acc1: 0x00e5ff, acc2: 0x111111 } },
    { id: 'caballero', name: 'Caballero', rarity: 3, price: P[3], acc: 'knight+cape', desc: 'Defensor del Fuerte Real.',
      pal: { shirt: 0x9aa4ae, pants: 0x6b737c, skin: 0xf1c27d, hair: 0x5a3a22, shoes: 0x3a3d42, pack: 0x1d3557, acc1: 0xb8c0c8, acc2: 0xd62828, cape: 0x1d3557 } },
    { id: 'vikinga', name: 'Vikinga', rarity: 3, price: P[3], acc: 'viking', desc: 'Cuernos, trenzas y cero miedo.',
      pal: { shirt: 0x7a5233, pants: 0x4a3328, skin: 0xffdbac, hair: 0xe85d04, shoes: 0x3a2a1a, pack: 0x9aa4ae, acc1: 0x8a9097, acc2: 0xf2eee6 } },
    { id: 'luchador', name: 'El Relámpago', rarity: 3, price: P[3], acc: 'luchador+cape', desc: 'Luchador enmascarado: nadie conoce su cara.',
      pal: { shirt: 0x3a86ff, pants: 0x3a86ff, skin: 0xc68642, hair: 0x111111, shoes: 0xffd166, pack: 0xffd166, acc1: 0x3a86ff, acc2: 0xffd166, cape: 0xffd166 } },
    { id: 'samurai', name: 'Samurái', rarity: 3, price: P[3], acc: 'samurai', desc: 'Casco con cuernos dorados y paso firme.',
      pal: { shirt: 0x7a1f1f, pants: 0x2b2b2b, skin: 0xf1c27d, hair: 0x111111, shoes: 0x3a2a1a, pack: 0x2b2b2b, acc1: 0x3a3a3a, acc2: 0xd4a017 } },
    { id: 'diablillo', name: 'Diablillo', rarity: 3, price: P[3], acc: 'devil+tail', desc: 'Cuernos, cola y muy malas ideas.',
      pal: { shirt: 0xb3202a, pants: 0x3a0d12, skin: 0xe07a5f, hair: 0x111111, shoes: 0x111111, pack: 0x111111, acc1: 0x2b2b2b, acc2: 0xb3202a, tail: 0xb3202a } },
    { id: 'alien', name: 'Visitante', rarity: 3, price: P[3], acc: 'antennae', desc: 'Vino en un platillo, se queda por el botín.',
      pal: { shirt: 0x9aa4ae, pants: 0x6b737c, skin: 0x7ed957, hair: 0x2f7a3e, shoes: 0x3a3d42, pack: 0x00e5ff, acc1: 0x7ed957, acc2: 0x00e5ff } },
    { id: 'heroina', name: 'Capitana Rayo', rarity: 3, price: P[3], acc: 'bandana+cape', desc: 'Antifaz, capa y una puntería de superheroína.',
      pal: { shirt: 0xe63946, pants: 0x1d3557, skin: 0xffdbac, hair: 0xd4a017, shoes: 0xffd166, pack: 0xffd166, acc1: 0x1d3557, acc2: 0x1d3557, cape: 0x1d3557 } },
    { id: 'noel', name: 'Papá Noel', rarity: 3, price: P[3], acc: 'santa', desc: 'Trae regalos... y una escopeta legendaria.',
      pal: { shirt: 0xd62828, pants: 0xd62828, skin: 0xffdbac, hair: 0xf4f4f4, shoes: 0x111111, pack: 0x7a4a26, acc1: 0xd62828, acc2: 0xf4f4f4 } },
    // --- legendarias ---
    { id: 'astronauta', name: 'Astronauta', rarity: 4, price: P[4], acc: 'astro', desc: 'Aterriza desde muy, muy arriba.',
      pal: { shirt: 0xf4f4f4, pants: 0xe6e6e6, skin: 0xffdbac, hair: 0x3b2314, shoes: 0x9aa4ae, pack: 0xd0d6dc, acc1: 0xf4f4f4, acc2: 0x1e3a6e } },
    { id: 'rey', name: 'Rey Dorado', rarity: 4, price: P[4], acc: 'crown+cape', desc: 'La corona se la ganó en la zona final.',
      pal: { shirt: 0x6a1b9a, pants: 0xffc933, skin: 0xf1c27d, hair: 0x6b3e26, shoes: 0xffc933, pack: 0xb3202a, acc1: 0xffc933, acc2: 0xe63946, cape: 0xb3202a } },
    { id: 'angel', name: 'Ángel Guardián', rarity: 4, price: P[4], acc: 'halo+wings', desc: 'Planea sin planeador (casi).',
      pal: { shirt: 0xf4f1ea, pants: 0xe8e2d6, skin: 0xffdbac, hair: 0xf2d16b, shoes: 0xd4a017, pack: 0xd4a017, acc1: 0xffd700, acc2: 0xffffff, wing: 0xffffff } },
    { id: 'calabaza', name: 'Señor Calabaza', rarity: 4, price: P[4], acc: 'pumpkin+cape', desc: 'Sale de noche... y también de día.',
      pal: { shirt: 0x2b2b2b, pants: 0x1a1a1a, skin: 0xe0ac69, hair: 0x111111, shoes: 0x111111, pack: 0x5a189a, acc1: 0xff8c1a, acc2: 0xffd60a, cape: 0x5a189a } },
    { id: 'dragon', name: 'Dragón Esmeralda', rarity: 4, price: P[4], acc: 'dragon+wings', desc: 'Escamas verdes, alas y mucho fuego.',
      pal: { shirt: 0x2d6a4f, pants: 0x1b4332, skin: 0x52b788, hair: 0x1b4332, shoes: 0x081c15, pack: 0xd4a017, acc1: 0xf4e3b1, acc2: 0xd4a017, wing: 0x40916c } },
    { id: 'reina-hielo', name: 'Reina del Hielo', rarity: 4, price: P[4], acc: 'crown+cape', desc: 'Congela a sus rivales con la mirada.',
      pal: { shirt: 0xa8dadc, pants: 0x457b9d, skin: 0xffdbac, hair: 0xf1faee, shoes: 0xf1faee, pack: 0xbde0fe, acc1: 0xcaf0f8, acc2: 0x4cc9f0, cape: 0x4cc9f0 } },
  ];
  G.SKIN_PRICE = SKIN_PRICE;

  /* ---------- Picos ---------- (todos hacen el mismo daño) */
  G.PICKAXES = [
    { id: 'clasico', name: 'Pico clásico', rarity: 0, price: 0, desc: 'El de toda la vida.' },
    { id: 'hacha', name: 'Hacha leñadora', rarity: 0, price: 300, desc: 'Perfecta para el Bosque Gigante.' },
    { id: 'martillo', name: 'Martillo de forja', rarity: 1, price: 500, desc: 'Pesado y con bandas doradas.' },
    { id: 'piruleta', name: 'Piruleta gigante', rarity: 2, price: 800, desc: 'Dulce por fuera, dura por dentro.' },
    { id: 'oro', name: 'Pico de oro', rarity: 2, price: 800, desc: 'Para picar con estilo.' },
    { id: 'guadana', name: 'Guadaña', rarity: 3, price: 1200, desc: 'Hoja curva y mango largo.' },
    { id: 'cristal', name: 'Pico de cristal', rarity: 3, price: 1200, desc: 'Brilla como el hielo.' },
    { id: 'guitarra', name: 'Guitarra eléctrica', rarity: 4, price: 2000, desc: '¡Rock en la isla!' },
    { id: 'laser', name: 'Sable láser', rarity: 4, price: 2000, desc: 'Brilla en la oscuridad.' },
  ];

  const DEFAULT = { coins: 600, owned: ['azar', 'explorador', 'clasico'], skin: 'azar', pick: 'clasico' };

  const S = (G.Shop = {
    state: JSON.parse(JSON.stringify(DEFAULT)),
    tab: 'locker',
    sel: null,          // { kind: 'skin' | 'pick', id }
    thumbs: {},

    skin(id) { return G.SKINS.find((s) => s.id === id) || null; },
    pick(id) { return G.PICKAXES.find((p) => p.id === id) || null; },
    owns(id) { return this.state.owned.includes(id); },

    // Poner la taquilla a partir de unos datos guardados (los que no valgan se quedan de serie)
    apply(s) {
      this.state = JSON.parse(JSON.stringify(DEFAULT));
      if (s && typeof s === 'object') {
        if (Number.isFinite(s.coins)) this.state.coins = Math.max(0, Math.floor(s.coins));
        if (Array.isArray(s.owned)) this.state.owned = [...new Set([...DEFAULT.owned, ...s.owned.filter((id) => this.skin(id) || this.pick(id))])];
        if (this.skin(s.skin) && this.owns(s.skin)) this.state.skin = s.skin;
        if (this.pick(s.pick) && this.owns(s.pick)) this.state.pick = s.pick;
      }
    },
    // Invitado (sin cuenta): la taquilla del navegador
    load() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* sin almacenamiento: se juega con lo de serie */ }
      this.apply(s);
    },
    // Con cuenta, se guarda en la cuenta (ver account.js); si no, en el navegador
    save() {
      if (G.Account && G.Account.user) { G.Account.save(); return; }
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* nada */ }
    },
    useAccount(data) { this.apply(data); this.refresh(); },
    useGuest() { this.load(); this.refresh(); },
    // Lo del invitado ya ha pasado a una cuenta nueva: el navegador vuelve a empezar de cero
    // (así no se pueden copiar las mismas monedas a varias cuentas)
    resetGuest() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } },
    refresh() {
      this.updateCoins();
      if (this.isOpen) { this.sel = null; this.render(); }
      if (G.Net && G.Net.isClient) G.Net.sendLook();
    },

    /* ---------- Aspecto de un personaje ---------- */
    // El aspecto de una skin y un pico (si la skin es "al azar" o no existe, ropa de colores al azar)
    lookFor(skinId, pickId) {
      const pk = this.pick(pickId) ? pickId : 'clasico';
      const sk = this.skin(skinId);
      if (sk && sk.pal) return { pal: sk.pal, acc: sk.acc || null, skin: sk.id, pick: pk };
      const PAL = G.Models.PALETTES;
      return { pal: PAL[(Math.random() * PAL.length) | 0], acc: null, skin: '', pick: pk };
    },
    look() { return this.lookFor(this.state.skin, this.state.pick); },
    // Bots: uno de cada tres lleva una skin de la tienda; todos llevan un pico al azar
    randomBotLook() {
      const pk = U.pick(G.PICKAXES).id;
      if (Math.random() < 0.35) return this.lookFor(U.pick(G.SKINS.filter((s) => s.pal)).id, pk);
      return { pal: null, acc: null, skin: '', pick: pk };
    },

    /* ---------- Monedas ---------- */
    reward(win, placement, total, kills) {
      const place = total > 1 ? 1 - (placement - 1) / (total - 1) : 1;
      const c = Math.max(10, Math.round(30 + kills * 40 + place * 150 + (win ? 250 : 0)));
      this.state.coins += c;
      this.save();
      this.updateCoins();
      return c;
    },
    updateCoins() {
      for (const id of ['menu-coins', 'shop-coins']) { const e = $(id); if (e) e.textContent = this.state.coins; }
    },

    buy(kind, id) {
      const it = kind === 'skin' ? this.skin(id) : this.pick(id);
      if (!it || this.owns(id) || this.state.coins < it.price) return false;
      this.state.coins -= it.price;
      this.state.owned.push(id);
      this.equip(kind, id);
      if (G.Audio) G.Audio.chest(null);
      return true;
    },
    equip(kind, id) {
      if (!this.owns(id)) return;
      if (kind === 'skin') this.state.skin = id; else this.state.pick = id;
      this.save();
      this.updateCoins();
      if (G.Net && G.Net.isClient) G.Net.sendLook();
    },

    /* =================================================================
       Interfaz: botones del menú y ventana de taquilla / tienda
       ================================================================= */
    init() {
      this.load();
      this.updateCoins();
      $('btn-locker').onclick = () => this.open('locker');
      $('btn-shop').onclick = () => this.open('store');
      $('shop-close').onclick = () => this.close();
      $('shop').addEventListener('click', (e) => { if (e.target.id === 'shop') this.close(); });
      for (const b of document.querySelectorAll('#shop .shop-tabs button')) b.onclick = () => { this.tab = b.dataset.tab; this.sel = null; this.render(); };
      $('shop-lists').addEventListener('click', (e) => {
        const c = e.target.closest('.scard');
        if (!c) return;
        this.sel = { kind: c.dataset.kind, id: c.dataset.id };
        this.render();
      });
      $('shop-info').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !this.sel) return;
        if (b.dataset.act === 'buy') this.buy(this.sel.kind, this.sel.id);
        else if (b.dataset.act === 'equip') this.equip(this.sel.kind, this.sel.id);
        this.render();
      });
      window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) this.close(); });
    },

    open(tab) {
      if (G.Game.state !== 'menu') return;
      G.Audio.init();
      this.tab = tab;
      this.sel = null;
      this.isOpen = true;
      $('shop').classList.remove('hidden');
      this.ensurePreview();
      this.makeThumbs();
      this.render();
      this.loop();
    },
    close() {
      this.isOpen = false;
      $('shop').classList.add('hidden');
    },

    // Lo que se ve en la lista según la pestaña: taquilla = lo que tienes; tienda = lo que no tienes
    items(kind) {
      const all = kind === 'skin' ? G.SKINS : G.PICKAXES;
      const list = all.filter((it) => (this.tab === 'locker') === this.owns(it.id));
      if (this.tab === 'store') list.sort((a, b) => a.rarity - b.rarity || a.price - b.price);
      return list;
    },

    render() {
      document.querySelectorAll('#shop .shop-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
      const card = (kind, it) => {
        const r = G.RARITIES[it.rarity];
        const eq = kind === 'skin' ? this.state.skin === it.id : this.state.pick === it.id;
        const sel = this.sel && this.sel.kind === kind && this.sel.id === it.id;
        const foot = this.tab === 'store' ? '🪙 ' + it.price : eq ? 'EQUIPADO' : '';
        return '<div class="scard' + (sel ? ' sel' : '') + (eq && this.tab === 'locker' ? ' eq' : '') + '" data-kind="' + kind + '" data-id="' + it.id + '" style="--c:' + r.color + '">' +
          (this.thumbs[kind + it.id] ? '<img src="' + this.thumbs[kind + it.id] + '" alt="">' : '<div class="noimg"></div>') +
          (it.id === 'azar' ? '<span class="q">?</span>' : '') +
          '<div class="nm">' + it.name + '</div><div class="ft">' + foot + '</div></div>';
      };
      for (const kind of ['skin', 'pick']) {
        const list = this.items(kind);
        $(kind === 'skin' ? 'shop-skins' : 'shop-picks').innerHTML = list.length ? list.map((it) => card(kind, it)).join('')
          : '<p class="small">' + (this.tab === 'store' ? '¡Ya lo tienes todo!' : 'Nada todavía.') + '</p>';
      }
      if (!this.sel) {
        // por defecto se muestra lo equipado (taquilla) o lo primero de la tienda
        const first = this.tab === 'locker' ? { kind: 'skin', id: this.state.skin } : (this.items('skin')[0] ? { kind: 'skin', id: this.items('skin')[0].id } : this.items('pick')[0] ? { kind: 'pick', id: this.items('pick')[0].id } : null);
        this.sel = first;
      }
      this.renderInfo();
      this.updateCoins();
    },

    renderInfo() {
      const info = $('shop-info');
      if (!this.sel) { info.innerHTML = ''; this.showPreview(this.state.skin, this.state.pick); return; }
      const { kind, id } = this.sel;
      const it = kind === 'skin' ? this.skin(id) : this.pick(id);
      const r = G.RARITIES[it.rarity];
      const owned = this.owns(id);
      const eq = kind === 'skin' ? this.state.skin === id : this.state.pick === id;
      let btn;
      if (!owned) {
        const miss = it.price - this.state.coins;
        btn = miss > 0 ? '<button class="big-btn" disabled>Te faltan 🪙 ' + miss + '</button>'
          : '<button class="big-btn" data-act="buy">COMPRAR · 🪙 ' + it.price + '</button>';
      } else btn = eq ? '<button class="big-btn" disabled>EQUIPADO</button>' : '<button class="big-btn" data-act="equip">EQUIPAR</button>';
      info.innerHTML = '<div class="si-name">' + it.name + '</div>' +
        '<div class="si-rar" style="color:' + r.color + '">' + (kind === 'skin' ? 'Skin ' + r.name[1].toLowerCase() : 'Pico ' + r.name[0].toLowerCase()) + '</div>' +
        '<p class="small">' + (it.desc || '') + (kind === 'pick' ? ' <i>(sólo cambia el aspecto)</i>' : '') + '</p>' + btn;
      if (kind === 'skin') this.showPreview(id, this.state.pick); else this.showPreview(this.state.skin, id);
    },

    /* ---------- Vista previa 3D (un renderizador pequeño aparte) ---------- */
    ensurePreview() {
      if (this.pr) return true;
      try {
        const cv = $('shop-preview');
        this.pr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.pr.setPixelRatio(1);
        this.pr.setSize(cv.width, cv.height, false);
      } catch (e) { this.pr = null; return false; }
      const sc = (this.pscene = new THREE.Scene());
      sc.add(new THREE.HemisphereLight(0xffffff, 0x6a6a80, 0.9));
      const d = new THREE.DirectionalLight(0xffffff, 0.7);
      d.position.set(-2, 4, -3);
      sc.add(d);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
      sc.add(floor);
      this.pcam = new THREE.PerspectiveCamera(30, $('shop-preview').width / $('shop-preview').height, 0.1, 50);
      this.pholder = new THREE.Group();
      sc.add(this.pholder);
      return true;
    },

    // Personaje con la skin y el pico dados, agarrando el pico en alto
    buildFigure(skinId, pickId) {
      const sk = this.skin(skinId);
      const pal = sk && sk.pal ? sk.pal : G.Models.PALETTES[0];
      const m = G.Models.makeCharacter(pal, sk && sk.acc);
      m.root.visible = true;
      m.blob.visible = false;
      m.armR.rotation.x = 1.9; m.armL.rotation.x = 1.3;
      m.weaponHolder.position.set(0.16, 1.42, -0.32);
      m.weaponHolder.rotation.x = 0.9;
      const pm = G.Models.heldMesh('pickaxe', pickId);
      pm.position.set(0.05, 0.05, 0.3);
      m.weaponHolder.add(pm);
      return m;
    },

    showPreview(skinId, pickId) {
      if (!this.pr) return;
      const key = skinId + '|' + pickId;
      if (this.pkey === key) return;
      this.pkey = key;
      this.pholder.clear();
      this.fig = this.buildFigure(skinId, pickId);
      this.fig.root.rotation.y = 0.5;
      this.pholder.add(this.fig.root);
      this.pcam.position.set(0, 1.25, -5.6);
      this.pcam.lookAt(0, 1.0, 0);
    },

    loop() {
      if (!this.isOpen || !this.pr) return;
      requestAnimationFrame(() => this.loop());
      const now = performance.now() / 1000;
      if (this.fig) {
        this.fig.root.rotation.y = Math.sin(now * 0.7) * 0.9;
        this.fig.weaponHolder.rotation.x = 0.9 + Math.sin(now * 2.2) * 0.12;
      }
      this.pr.render(this.pscene, this.pcam);
    },

    // Miniaturas de cada skin y pico (se dibujan una vez con el renderizador de la vista previa)
    makeThumbs() {
      if (!this.pr || this.thumbsDone) return;
      this.thumbsDone = true;
      for (const sk of G.SKINS) {
        this.pholder.clear();
        const f = this.buildFigure(sk.id, 'clasico');
        f.weaponHolder.visible = false;
        f.armR.rotation.x = 0; f.armL.rotation.x = 0;   // brazos abajo: que se vea la cara
        f.root.rotation.y = 0.35;
        this.pholder.add(f.root);
        this.pcam.position.set(0, 1.75, -2.6);
        this.pcam.lookAt(0, 1.6, 0);
        this.pr.render(this.pscene, this.pcam);
        this.thumbs['skin' + sk.id] = this.pr.domElement.toDataURL('image/png');
      }
      for (const pk of G.PICKAXES) {
        this.pholder.clear();
        // el pico, centrado y en diagonal (cabeza arriba)
        const pm = G.Models.heldMesh('pickaxe', pk.id);
        pm.rotation.set(0, Math.PI / 2, 0);
        pm.position.set(0.5, 0, 0);
        const holder = new THREE.Group();
        holder.add(pm);
        holder.rotation.z = -0.8;
        holder.position.set(0, 1.2, 0);
        this.pholder.add(holder);
        this.pcam.position.set(0, 1.2, -2.9);
        this.pcam.lookAt(0, 1.2, 0);
        this.pr.render(this.pscene, this.pcam);
        this.thumbs['pick' + pk.id] = this.pr.domElement.toDataURL('image/png');
      }
      this.pkey = '';
    },
  });
})();

/* =====================================================================
   account.js — Cuentas de jugador, estadísticas, rango y rankings.
   - Te registras con un nombre y una contraseña. Tu cuenta guarda tus
     monedas, lo que tienes en la taquilla y tus estadísticas.
   - Hay dos sitios donde guardar las cuentas:
       · ONLINE (Firebase, si está configurado en js/online.js): cuentas
         y rankings compartidos por todos los que juegan a tu juego.
       · LOCAL (si no): las cuentas se guardan en este navegador y los
         rankings son de las cuentas creadas en este ordenador.
   - Rango: cada partida da o quita puntos de rango (RP). Los números
     están en G.RANKED (config.js).
   - Sin cuenta se juega como invitado: monedas en el navegador, sin rango.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;
  const $ = (id) => document.getElementById(id);
  const R = G.RANKED;
  const NAME_RE = /^[A-Za-z0-9_]{3,14}$/;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const STATS = ['matches', 'wins', 'kills', 'top10', 'damage', 'timeAlive', 'bestKills', 'rp', 'peakRp'];

  // La ficha de una cuenta nueva (las monedas y la taquilla las pone la tienda)
  function freshData(name) {
    const d = { name, coins: 600, owned: [], skin: 'azar', pick: 'clasico' };
    for (const k of STATS) d[k] = 0;
    return d;
  }
  // Una ficha cargada, con todos sus campos y números válidos
  function normalize(d, name) {
    const out = freshData(String((d && d.name) || name || 'Jugador'));
    if (!d) return out;
    out.coins = num(d.coins);
    if (Array.isArray(d.owned)) out.owned = d.owned.filter((x) => typeof x === 'string');
    if (typeof d.skin === 'string') out.skin = d.skin;
    if (typeof d.pick === 'string') out.pick = d.pick;
    for (const k of STATS) out[k] = num(d[k]);
    return out;
  }

  /* =================================================================
     Rangos
     ================================================================= */
  // El rango que corresponde a unos RP: { i, rank, div, label, min, max, prog }
  function rankOf(rp) {
    const L = R.ranks;
    let i = L.length - 1;
    while (i > 0 && rp < L[i].min) i--;
    const rk = L[i], next = L[i + 1];
    let div = 0, min = rk.min, max = next ? next.min : Infinity;
    if (next && rk.divs > 1) {
      const size = (next.min - rk.min) / rk.divs;
      div = Math.min(rk.divs - 1, Math.floor((rp - rk.min) / size));
      min = Math.round(rk.min + div * size);       // los rangos no siempre se dividen exacto entre 3
      max = Math.round(rk.min + (div + 1) * size);
    }
    return { i, rank: rk, div, label: rk.name + (rk.divs > 1 ? ' ' + ROMAN[div] : ''), min, max, prog: next ? (rp - min) / (max - min) : 1 };
  }

  // Lo que da (o quita) una partida. m = { win, placement, total, kills, killsAt, diff }
  function matchRP(m, rp) {
    const tier = rankOf(rp).i;
    const frac = m.total > 1 ? (m.placement - 2) / Math.max(1, m.total - 2) : 0;   // 0 = el 2º, 1 = el primero en caer
    let place = m.win || m.placement <= 1 ? R.win : (R.placement.find(([f]) => frac <= f + 1e-9) || R.placement[R.placement.length - 1])[1];
    // cuanto más alto es tu rango, más se pierde por caer pronto y menos se gana por el puesto
    place = place > 0 ? place * Math.max(0.4, 1 - tier * R.rankGain) : place * (1 + tier * R.rankLoss);
    // cada baja vale más cuanto menos gente queda viva
    let kills = 0;
    const at = (m.killsAt || []).slice(0, m.kills);
    for (const alive of at) kills += R.killBase + R.killLate * (1 - Math.min(1, alive / Math.max(1, m.total)));
    kills += Math.max(0, m.kills - at.length) * R.killBase;
    // lo ganado depende de la dificultad de los bots y de cuántos jugadores había
    const mult = (R.difficulty[m.diff] || 1) * Math.min(1, Math.max(0.5, m.total / R.fullLobby));
    if (place > 0) place *= mult;
    kills *= mult;
    place = Math.round(place);
    kills = Math.round(kills);
    return { place, kills, mult, total: Math.min(R.maxGain, place + kills) };
  }

  // Insignia del rango (escudo en SVG con el color del rango)
  let badgeN = 0;
  function badge(i, size) {
    const rk = R.ranks[i], id = 'rkg' + badgeN++;
    const unreal = i === R.ranks.length - 1;
    const top = unreal ? '#5ef0ff' : rk.color;
    let inner;
    if (i < 5) inner = '<path d="M20 13 L28 23 L20 33 L12 23 Z" fill="rgba(255,255,255,0.85)"/>' +
      '<path d="M20 13 L28 23 L20 23 Z" fill="rgba(255,255,255,0.45)"/>';
    else if (i === 5) inner = '<path d="M20 11 L23 19.5 L32 19.7 L24.9 25.1 L27.4 33.8 L20 28.7 L12.6 33.8 L15.1 25.1 L8 19.7 L17 19.5 Z" fill="rgba(255,255,255,0.9)"/>';
    else inner = '<path d="M11 31 L10 17 L15.5 22 L20 13 L24.5 22 L30 17 L29 31 Z" fill="rgba(255,255,255,0.9)"/><rect x="11" y="32" width="18" height="3" rx="1" fill="rgba(255,255,255,0.9)"/>';
    return '<svg class="rk-badge" width="' + size + '" height="' + Math.round(size * 1.15) + '" viewBox="0 0 40 46" aria-label="' + rk.name + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + rk.color + '" stop-opacity="0.75"/></linearGradient></defs>' +
      '<path d="M20 2 L37 8 V22 C37 33 29 41 20 44 C11 41 3 33 3 22 V8 Z" fill="url(#' + id + ')" stroke="rgba(0,0,0,0.55)" stroke-width="2"/>' +
      '<path d="M20 6 L33 10.5 V22 C33 31 27 37.5 20 40 C13 37.5 7 31 7 22 V10.5 Z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>' +
      inner + '</svg>';
  }

  /* =================================================================
     Almacén LOCAL (cuentas en este navegador)
     ================================================================= */
  const Local = {
    online: false,
    KEY: 'islaRoyaleAccounts',
    SESSION: 'islaRoyaleSession',
    all() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { return {}; } },
    put(all) { localStorage.setItem(this.KEY, JSON.stringify(all)); },
    // la contraseña no se guarda tal cual: sólo su "huella" (SHA-256 con sal)
    async hash(salt, pass) {
      const txt = salt + ':' + pass;
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
        return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
      }
      let h = 2166136261;
      for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
      return 'f' + (h >>> 0).toString(16);
    },
    async init() {},
    async restore() {
      let k = null;
      try { k = localStorage.getItem(this.SESSION); } catch (e) { /* sin almacenamiento */ }
      const a = k && this.all()[k];
      return a ? { id: k, data: a.data } : null;
    },
    async register(name, pass, start) {
      const all = this.all(), k = name.toLowerCase();
      if (all[k]) throw new Error('Ese nombre ya existe en este navegador. Elige otro o entra con él.');
      const salt = Math.random().toString(36).slice(2, 12);
      all[k] = { salt, hash: await this.hash(salt, pass), data: start };
      try { this.put(all); localStorage.setItem(this.SESSION, k); } catch (e) { throw new Error('Este navegador no deja guardar datos (¿modo privado?).'); }
      return { id: k, data: start };
    },
    async login(name, pass) {
      const k = name.toLowerCase(), a = this.all()[k];
      if (!a || (await this.hash(a.salt, pass)) !== a.hash) throw new Error('Nombre o contraseña incorrectos.');
      try { localStorage.setItem(this.SESSION, k); } catch (e) { /* nada */ }
      return { id: k, data: a.data };
    },
    logout() { try { localStorage.removeItem(this.SESSION); } catch (e) { /* nada */ } },
    async write(id, data) {
      const all = this.all();
      if (!all[id]) return;
      all[id].data = data;
      this.put(all);
    },
    async top(field, n) {
      return Object.values(this.all()).map((a) => normalize(a.data)).filter((d) => d.matches > 0)
        .sort((a, b) => b[field] - a[field] || b.matches - a.matches).slice(0, n);
    },
  };

  /* =================================================================
     Almacén ONLINE (Firebase: Authentication + Firestore)
     El jugador sólo escribe nombre y contraseña: por dentro se usa un
     "correo" inventado con su nombre (nadie recibe ningún correo).
     ================================================================= */
  const FB_VERSION = '10.12.2';
  const loadScript = (src) => new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => ko(new Error('No se ha podido cargar ' + src));
    document.head.appendChild(s);
  });
  function fbError(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/email-already-in-use') return 'Ese nombre ya está cogido. Elige otro.';
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'Nombre o contraseña incorrectos.';
    if (c === 'auth/weak-password') return 'La contraseña es demasiado débil (mínimo 6 caracteres).';
    if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera un poco y vuelve a probar.';
    if (c === 'auth/network-request-failed') return 'Sin conexión con el servidor de cuentas. Revisa tu internet.';
    if (c === 'auth/operation-not-allowed') return 'Falta activar "Correo electrónico/contraseña" en Firebase Authentication.';
    if (c === 'permission-denied') return 'El servidor no deja guardar la cuenta (revisa las reglas de Firestore).';
    return 'Algo ha fallado: ' + ((e && e.message) || e);
  }
  const Online = {
    online: true,
    async init(cfg) {
      const base = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/';
      for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(base + f);
      firebase.initializeApp(cfg);
      this.auth = firebase.auth();
      this.col = firebase.firestore().collection('players');
    },
    email: (name) => name.toLowerCase() + '@jugadores.islaroyale.game',
    // al abrir el juego: ¿había una sesión abierta?
    restore() {
      return new Promise((ok) => {
        const off = this.auth.onAuthStateChanged((u) => { off(); ok(u ? this.load(u).catch(() => null) : null); });
      });
    },
    // la ficha del jugador (si no existe todavía, se crea)
    async load(u, start) {
      const ref = this.col.doc(u.uid), snap = await ref.get();
      if (snap.exists) return { id: u.uid, data: snap.data() };
      const data = start || freshData(u.email.split('@')[0]);
      await ref.set(data);
      return { id: u.uid, data };
    },
    async register(name, pass, start) {
      try {
        const c = await this.auth.createUserWithEmailAndPassword(this.email(name), pass);
        return await this.load(c.user, start);
      } catch (e) { throw new Error(fbError(e)); }
    },
    async login(name, pass) {
      try {
        const c = await this.auth.signInWithEmailAndPassword(this.email(name), pass);
        return await this.load(c.user);
      } catch (e) { throw new Error(fbError(e)); }
    },
    logout() { this.auth.signOut(); },
    write(id, data) { return this.col.doc(id).set(data); },
    async top(field, n) {
      const q = await this.col.orderBy(field, 'desc').limit(n).get();
      return q.docs.map((d) => normalize(d.data())).filter((d) => d.matches > 0);
    },
  };

  /* =================================================================
     La cuenta
     ================================================================= */
  const A = (G.Account = {
    user: null,          // { id, data } con la sesión abierta; null = invitado
    store: null,
    error: '',
    mode: 'login',       // pestaña de la ventana: 'login' | 'register'
    rtab: 'rp',          // pestaña del ranking: 'kills' | 'wins' | 'rp'
    cache: {},
    rankOf, badge, matchRP,

    async init() {
      this.wire();
      const cfg = G.FIREBASE;
      if (cfg && cfg.apiKey) {
        try { await Online.init(cfg); this.store = Online; }
        catch (e) { console.warn(e); this.error = 'No se puede conectar con el servidor de cuentas (¿sin internet?). Juegas como invitado.'; }
      } else this.store = Local;
      this.renderBar();
      if (!this.store) return;
      try { const u = await this.store.restore(); if (u) this.use(u); } catch (e) { console.warn(e); }
    },

    // Abrir la sesión de una cuenta: sus monedas, su taquilla y su nombre
    use(u) {
      this.user = { id: u.id, data: normalize(u.data) };
      G.Shop.useAccount(this.user.data);
      G.SETTINGS.name = this.user.data.name;
      const nm = $('net-name');
      nm.value = this.user.data.name;
      nm.disabled = true;
      nm.title = 'En multijugador se usa el nombre de tu cuenta';
      G.Net.renamed();
      this.cache = {};
      this.renderBar();
    },

    logout() {
      if (!this.user) return;
      this.flush();
      this.store.logout();
      this.user = null;
      G.Shop.useGuest();
      const nm = $('net-name');
      nm.disabled = false;
      nm.title = '';
      this.renderBar();
    },

    // Guardar la ficha (se agrupan los cambios seguidos en una sola escritura)
    save() {
      if (!this.user) return;
      clearTimeout(this.saveT);
      this.saveT = setTimeout(() => this.flush(), 300);
    },
    flush() {
      clearTimeout(this.saveT);
      if (!this.user) return;
      const d = this.user.data, s = G.Shop.state;
      d.coins = s.coins; d.owned = s.owned.slice(); d.skin = s.skin; d.pick = s.pick;
      this.cache = {};
      Promise.resolve(this.store.write(this.user.id, Object.assign({}, d))).catch((e) => {
        console.warn(e);
        const el = $('acct-msg');
        if (el) el.textContent = 'No se han podido guardar tus datos: ' + fbError(e);
      });
    },

    /* ---------- Fin de partida: estadísticas y rango ----------
       m = { win, placement, total, kills, killsAt, damage, timeAlive, diff } */
    recordMatch(m) {
      if (!this.user) return { guest: true, preview: matchRP(m, 0) };
      const d = this.user.data;
      const before = d.rp, r = matchRP(m, before);
      d.matches++;
      if (m.win) d.wins++;
      d.kills += Math.min(100, m.kills);
      if (m.placement <= 10) d.top10++;
      d.damage += Math.round(m.damage || 0);
      d.timeAlive += Math.round(m.timeAlive || 0);
      d.bestKills = Math.max(d.bestKills, m.kills);
      d.rp = Math.max(0, before + r.total);
      d.peakRp = Math.max(d.peakRp, d.rp);
      this.save();
      this.renderBar();
      return Object.assign(r, { before, after: d.rp, rkB: rankOf(before), rkA: rankOf(d.rp) });
    },

    // El recuadro de rango de la pantalla final
    endHtml(res) {
      if (!res) return '';
      if (res.guest) {
        const p = res.preview.total;
        return '<div class="rank-res guest">🏅 <b>Crea una cuenta</b> para guardar tus estadísticas, salir en los rankings y subir de rango' +
          (p > 0 ? ' (esta partida te habría dado <b class="up">+' + p + ' RP</b>)' : '') + '.</div>';
      }
      const delta = res.after - res.before, rk = res.rkA;
      const sign = (v) => (v > 0 ? '+' : '') + v;
      const parts = [sign(res.place) + ' por el puesto', sign(res.kills) + ' por bajas'];
      if (Math.abs(res.mult - 1) > 0.01) parts.push('ganancias ×' + res.mult.toFixed(2).replace(/\.?0+$/, ''));
      let change = '';
      if (rk.label !== res.rkB.label) {
        change = res.after > res.before ? '<div class="rr-change up">⬆️ ¡Has subido a ' + rk.label + '!</div>' : '<div class="rr-change down">⬇️ Has bajado a ' + rk.label + '</div>';
      }
      return '<div class="rank-res">' + badge(rk.i, 44) +
        '<div class="rr-main"><div class="rr-top"><span class="rr-name" style="color:' + rk.rank.color + '">' + rk.label + '</span>' +
        '<span class="rr-delta ' + (delta >= 0 ? 'up' : 'down') + '">' + sign(delta) + ' RP</span></div>' +
        this.barHtml(res.after) + '<div class="rr-parts">' + parts.join(' · ') + '</div>' + change + '</div></div>';
    },

    // Barra de progreso hasta la siguiente división
    barHtml(rp) {
      const rk = rankOf(rp);
      const txt = Number.isFinite(rk.max) ? rp + ' / ' + rk.max + ' RP' : rp + ' RP · ¡suma sin límite!';
      return '<div class="rk-bar"><i style="width:' + Math.round(rk.prog * 100) + '%;background:' + rk.rank.color + '"></i><span>' + txt + '</span></div>';
    },

    /* =================================================================
       Interfaz
       ================================================================= */
    wire() {
      $('auth-close').onclick = () => this.closeAuth();
      $('auth').addEventListener('click', (e) => { if (e.target.id === 'auth') this.closeAuth(); });
      for (const b of document.querySelectorAll('#auth .shop-tabs button')) b.onclick = () => this.openAuth(b.dataset.mode);
      $('auth-form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
      $('ranking-close').onclick = () => this.closeRanking();
      $('ranking').addEventListener('click', (e) => { if (e.target.id === 'ranking') this.closeRanking(); });
      for (const b of document.querySelectorAll('#ranking .shop-tabs button')) b.onclick = () => { this.rtab = b.dataset.tab; this.renderRanking(); };
      $('acct-bar').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        G.Audio.init();
        if (b.dataset.act === 'login') this.openAuth('login');
        else if (b.dataset.act === 'register') this.openAuth('register');
        else if (b.dataset.act === 'ranking') this.openRanking();
        else if (b.dataset.act === 'logout') this.logout();
      });
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'Escape') return;
        if (!$('auth').classList.contains('hidden')) this.closeAuth();
        if (!$('ranking').classList.contains('hidden')) this.closeRanking();
      });
      window.addEventListener('beforeunload', () => { if (this.saveT) this.flush(); });
    },

    // La barra de la cuenta en el menú
    renderBar() {
      const bar = $('acct-bar');
      const rankBtn = '<button class="sec-btn" data-act="ranking">🏆 Rankings</button>';
      if (!this.user) {
        const note = this.error ? '<span class="warn">' + this.error + '</span>'
          : 'Juegas como <b>invitado</b>: tus monedas sólo se guardan en este navegador y no tienes rango.';
        bar.innerHTML = '<div class="acct-who"><div class="acct-avatar">👤</div><div class="acct-txt">' + note + '<div id="acct-msg" class="warn"></div></div></div>' +
          '<div class="acct-btns">' + (this.store ? '<button class="sec-btn" data-act="login">Entrar</button><button class="sec-btn hl" data-act="register">Crear cuenta</button>' : '') + rankBtn + '</div>';
        return;
      }
      const d = this.user.data, rk = rankOf(d.rp);
      bar.innerHTML = '<div class="acct-who">' + badge(rk.i, 46) + '<div class="acct-txt">' +
        '<div class="acct-name">' + esc(d.name) + ' <span style="color:' + rk.rank.color + '">' + rk.label + '</span></div>' +
        this.barHtml(d.rp) +
        '<div class="acct-stats"><span><b>' + d.matches + '</b> partidas</span><span><b>' + d.wins + '</b> victorias</span><span><b>' + d.kills + '</b> bajas</span><span><b>' + d.top10 + '</b> top 10</span></div>' +
        '<div id="acct-msg" class="warn"></div></div></div>' +
        '<div class="acct-btns">' + rankBtn + '<button class="sec-btn" data-act="logout">Salir</button></div>';
    },

    /* ---------- Ventana de entrar / crear cuenta ---------- */
    openAuth(mode) {
      if (G.Game.state !== 'menu' || !this.store) return;
      this.mode = mode;
      const reg = mode === 'register';
      for (const b of document.querySelectorAll('#auth .shop-tabs button')) b.classList.toggle('on', b.dataset.mode === mode);
      $('auth-pass2-row').classList.toggle('hidden', !reg);
      $('auth-pass').autocomplete = reg ? 'new-password' : 'current-password';
      $('auth-go').textContent = reg ? 'CREAR CUENTA' : 'ENTRAR';
      $('auth-err').textContent = '';
      $('auth-note').innerHTML = (reg
        ? 'Nombre: de 3 a 14 letras, números o _. Contraseña: mínimo 6 caracteres. Lo que tengas ahora como invitado (monedas y skins) se pasa a tu cuenta nueva.<br>'
        : '') + (this.store.online
        ? '🌐 Cuentas online: entra con tu cuenta desde cualquier ordenador.'
        : '💾 Las cuentas se guardan en <b>este navegador</b> (los rankings son de las cuentas de este ordenador). Para cuentas y rankings online, mira <b>js/online.js</b>.');
      $('auth').classList.remove('hidden');
      setTimeout(() => $('auth-name').focus(), 30);
    },
    closeAuth() { $('auth').classList.add('hidden'); },

    async submit() {
      if (this.busy) return;
      const name = $('auth-name').value.trim(), pass = $('auth-pass').value, reg = this.mode === 'register';
      const err = (t) => { $('auth-err').textContent = t; };
      if (!NAME_RE.test(name)) return err('El nombre tiene que tener de 3 a 14 letras sin tildes, números o _ (sin espacios).');
      if (pass.length < 6) return err('La contraseña tiene que tener al menos 6 caracteres.');
      if (reg && pass !== $('auth-pass2').value) return err('Las dos contraseñas no coinciden.');
      this.busy = true;
      const go = $('auth-go');
      go.disabled = true;
      err('');
      try {
        let u;
        if (reg) {
          // la cuenta nueva empieza con lo que tenías como invitado
          const start = freshData(name), s = G.Shop.state;
          start.coins = s.coins; start.owned = s.owned.slice(); start.skin = s.skin; start.pick = s.pick;
          u = await this.store.register(name, pass, start);
          G.Shop.resetGuest();
        } else u = await this.store.login(name, pass);
        this.use(u);
        $('auth-pass').value = $('auth-pass2').value = '';
        this.closeAuth();
      } catch (e) {
        err(e.message || String(e));
      } finally {
        this.busy = false;
        go.disabled = false;
      }
    },

    /* ---------- Rankings ---------- */
    openRanking(tab) {
      if (G.Game.state !== 'menu') return;
      if (tab) this.rtab = tab;
      $('ranking').classList.remove('hidden');
      this.renderRanking();
    },
    closeRanking() { $('ranking').classList.add('hidden'); },

    async top(field) {
      const c = this.cache[field];
      if (c && performance.now() - c.t < 20000) return c.list;
      const list = await this.store.top(field, 50);
      this.cache[field] = { t: performance.now(), list };
      return list;
    },

    async renderRanking() {
      const tab = this.rtab;
      for (const b of document.querySelectorAll('#ranking .shop-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
      $('rank-info').innerHTML = tab === 'rp' ? this.rulesHtml() : '';
      const box = $('rank-list');
      $('rank-where').textContent = !this.store ? '' : this.store.online ? '🌐 Ranking online · los 50 mejores' : '💾 Ranking de las cuentas de este navegador';
      if (!this.store) { box.innerHTML = '<p class="small warn">' + this.error + '</p>'; return; }
      box.innerHTML = '<p class="small">Cargando…</p>';
      let list;
      try { list = await this.top(tab); } catch (e) { console.warn(e); box.innerHTML = '<p class="small warn">No se ha podido cargar el ranking: ' + esc(fbError(e)) + '</p>'; return; }
      if (this.rtab !== tab) return;   // se cambió de pestaña mientras cargaba
      const me = this.user && this.user.data;
      const row = (d, pos) => {
        const isMe = me && d.name.toLowerCase() === me.name.toLowerCase();
        let val, sub;
        if (tab === 'kills') {
          val = d.kills + ' <small>bajas</small>';
          sub = (d.matches ? (d.kills / d.matches).toFixed(1) : '0') + ' por partida · récord ' + d.bestKills;
        } else if (tab === 'wins') {
          val = d.wins + ' <small>victorias</small>';
          sub = Math.round((d.wins / Math.max(1, d.matches)) * 100) + ' % de ' + d.matches + ' partidas';
        } else {
          const rk = rankOf(d.rp);
          val = d.rp + ' <small>RP</small>';
          sub = '<span style="color:' + rk.rank.color + '">' + rk.label + (rk.i === R.ranks.length - 1 && pos ? ' #' + pos : '') + '</span> · máx. ' + rankOf(d.peakRp).label;
        }
        const ic = tab === 'rp' ? badge(rankOf(d.rp).i, 26) : '';
        return '<div class="rrow' + (isMe ? ' me' : '') + (pos && pos <= 3 ? ' p' + pos : '') + '"><span class="pos">' + (pos || '—') + '</span>' + ic +
          '<span class="who"><b>' + esc(d.name) + '</b><small>' + sub + '</small></span><span class="val">' + val + '</span></div>';
      };
      let html = list.length ? list.map((d, i) => row(d, i + 1)).join('')
        : '<p class="small">Todavía no hay nadie. ¡Juega una partida con tu cuenta y sé el primero!</p>';
      // si no sales en la lista, tu fila va al final
      if (me && me.matches > 0 && !list.some((d) => d.name.toLowerCase() === me.name.toLowerCase())) html += '<div class="rsep">…</div>' + row(me, 0);
      if (!me) html += '<p class="small">Crea una cuenta para salir en los rankings.</p>';
      box.innerHTML = html;
    },

    // Los 8 rangos y cómo se ganan los RP (sale de G.RANKED)
    rulesHtml() {
      const L = R.ranks;
      const ranks = L.map((rk, i) => '<div class="rk-item">' + badge(i, 30) + '<b style="color:' + rk.color + '">' + rk.name + '</b><small>' + rk.min + (L[i + 1] ? '–' + (L[i + 1].min - 1) : '+') + ' RP</small></div>').join('');
      const pl = R.placement;
      const pct = (f) => Math.round(f * 100) + ' %';
      const s = (v) => (v > 0 ? '+' : '') + v;
      return '<div class="rk-ladder">' + ranks + '</div><ul class="rk-rules">' +
        '<li>🏆 Ganar: <b class="up">' + s(R.win) + '</b> · Top ' + pct(pl[0][0]) + ': <b class="up">' + s(pl[0][1]) + '</b> · Top ' + pct(pl[1][0]) + ': <b class="up">' + s(pl[1][1]) + '</b> · Top ' + pct(pl[2][0]) + ': <b class="up">' + s(pl[2][1]) + '</b></li>' +
        '<li>☠️ Caer pronto resta: hasta el ' + pct(pl[3][0]) + ' de la tabla <b class="down">' + pl[3][1] + '</b>, entre los primeros en caer <b class="down">' + pl[4][1] + '</b></li>' +
        '<li>💀 Cada baja: de <b class="up">+' + R.killBase + '</b> a <b class="up">+' + (R.killBase + R.killLate) + '</b> (vale más cuanta menos gente queda viva)</li>' +
        '<li>📈 Cuanto más alto tu rango, más pierdes por caer pronto y menos ganas por el puesto. Bots en fácil ×' + R.difficulty.facil + ', en difícil ×' + R.difficulty.dificil + '. Salir de la partida cuenta como eliminado.</li></ul>';
    },
  });
})();

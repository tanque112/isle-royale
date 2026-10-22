/* =====================================================================
   net.js — Multijugador por internet sin servidor propio.

   ¿Cómo se conectan los navegadores?
   - WebRTC permite que dos navegadores se hablen directamente.
   - Para "presentarse" (intercambiar sus direcciones) usan un servidor
     de señalización público y gratuito: el de PeerJS (0.peerjs.com).
     Sólo se usa al conectar; luego los datos van de navegador a navegador.

   ¿Quién manda? El ANFITRIÓN (el que crea la partida):
   - Genera la isla (los demás generan la misma con la misma "semilla"),
     mueve a los bots, reparte el botín, abre cofres, decide qué se rompe
     y cuándo se cierra la tormenta.
   - Cada jugador mueve a su propio personaje y le cuenta al anfitrión
     dónde está y a quién ha disparado. El anfitrión aplica el daño.
   - 15 veces por segundo el anfitrión manda una "foto" (snapshot) con la
     posición de todos; además manda "eventos" (algo se ha roto, alguien
     ha cogido un arma...) en cuanto pasan.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  const VERSION = 13;                          // súbelo al cambiar las armas o la isla: así no se mezclan versiones distintas
  // el código de sala se convierte en el id del anfitrión; lleva la versión dentro, así que con
  // versiones distintas la sala "no existe" (aviso inmediato) en vez de quedarse esperando sin respuesta
  const PREFIX = 'islaroyale' + VERSION + 'x';
  const MAX_PLAYERS = 8;
  const CHUNK = 60000;                        // los mensajes grandes se trocean
  const SNAP_RATE = 15, STATE_RATE = 20;      // fotos por segundo (anfitrión) y estados (jugador)
  // Servidores públicos que ayudan a que dos redes distintas se encuentren (STUN) o hacen de puente si no pueden (TURN)
  const ICE = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ];
  const MODES = ['bus', 'dive', 'glide', 'ground', 'dead'];
  const params = new URLSearchParams(location.search);
  let chunkId = 0;

  // nombres sin caracteres raros (se muestran en la lista de muertes)
  const cleanName = (s) => String(s || 'Jugador').replace(/[<>&"'`\\]/g, '').trim().slice(0, 14) || 'Jugador';
  const rnd36 = (n) => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); };

  /* =================================================================
     Transporte 1: WebRTC con la librería oficial de PeerJS (lib/peerjs.min.js)
     El servidor público de salas (0.peerjs.com) ya sólo acepta mensajes de la
     librería oficial: con un cliente hecho a mano cortaba la conexión en cuanto
     el invitado llamaba al anfitrión. Así que la usamos para conectar y, por
     encima, seguimos mandando nuestros propios mensajes (en texto JSON).
     ================================================================= */
  function peerOptions() {
    const o = { config: { iceServers: ICE }, debug: 0 };
    const custom = params.get('signal');      // para pruebas: ?signal=ws://localhost:9000/
    if (custom) {
      try {
        const u = new URL(custom);
        o.host = u.hostname;
        o.secure = u.protocol === 'wss:' || u.protocol === 'https:';
        o.port = Number(u.port) || (o.secure ? 443 : 80);
        o.path = u.pathname || '/';
      } catch (e) { /* dirección mal escrita: se usa el servidor público */ }
    }
    return o;
  }
  const NET_ERRORS = { network: 1, 'socket-error': 1, 'socket-closed': 1, 'server-error': 1, 'browser-incompatible': 1 };

  class PeerTransport {
    constructor() { this.links = new Map(); this.onIncoming = null; this.onDown = null; this.onUp = null; }

    start(id) {
      this.id = id;
      this.stopped = false;
      return new Promise((resolve, reject) => {
        if (!window.Peer) { reject(new Error('lib')); return; }
        let done = false;
        const finish = (err) => { if (done) return; done = true; clearTimeout(timer); if (err) reject(err); else resolve(); };
        const timer = setTimeout(() => finish(new Error('timeout')), 12000);
        let peer;
        try { peer = this.peer = new window.Peer(id, peerOptions()); }
        catch (e) { finish(new Error('net')); return; }
        peer.on('open', () => {
          if (!done) { finish(); return; }
          if (this.wasDown) { this.wasDown = false; if (this.onUp) this.onUp(); }
        });
        // alguien nos llama (somos el anfitrión)
        peer.on('connection', (conn) => {
          const l = new PjLink(this, conn);
          if (this.onIncoming) this.onIncoming(l);
        });
        // se ha caído la conexión con el servidor de salas: reconectar (los que ya juegan siguen conectados)
        peer.on('disconnected', () => {
          if (this.stopped || !done) return;
          this.wasDown = true;
          if (this.onDown) this.onDown();
          clearTimeout(this.retryT);
          this.retryT = setTimeout(() => { if (!this.stopped && peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* lo intentará otra vez */ } } }, 2000);
        });
        peer.on('error', (e) => {
          const t = e && e.type;
          if (!done) { finish(new Error(t === 'unavailable-id' ? 'taken' : NET_ERRORS[t] ? 'net' : String(t || 'net'))); return; }
          // la sala a la que llamamos no existe
          if (t === 'peer-unavailable') for (const l of [...this.links.values()]) if (!l.open) l.fail('expire');
        });
      });
    }

    connect(remoteId) {
      const conn = this.peer.connect(remoteId, { reliable: true, serialization: 'raw' });
      return new PjLink(this, conn);
    }

    stop() {
      this.stopped = true;
      clearTimeout(this.retryT);
      for (const l of [...this.links.values()]) l.close();
      this.links.clear();
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* */ } }
      this.peer = null;
    }
  }

  // Una conexión con otro jugador (un canal fiable y en orden; los mensajes grandes se trocean)
  class PjLink {
    constructor(tr, conn) {
      this.tr = tr; this.conn = conn; this.remote = conn.peer;
      this.open = false; this.closed = false;
      this.onopen = this.onmessage = this.onclose = this.onstage = null;
      this.gotAnswer = false; this.failReason = ''; this.parts = new Map();
      tr.links.set(this, this);
      conn.on('open', () => {
        if (this.closed) return;
        this.open = true;
        this.gotAnswer = true;
        clearTimeout(this.timer);
        clearInterval(this.poll);
        if (this.onopen) this.onopen();
      });
      conn.on('data', (d) => this.recv(d));
      conn.on('close', () => this.fail());
      conn.on('error', () => this.fail('ice'));
      // cuando el anfitrión contesta, ya sólo falta la conexión directa (para los mensajes de estado)
      this.poll = setInterval(() => {
        const pc = conn.peerConnection;
        if (!this.gotAnswer && pc && pc.remoteDescription) { this.gotAnswer = true; if (this.onstage) this.onstage('answer'); }
        if (pc && (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed')) this.fail('ice');
      }, 250);
      // si no conecta a tiempo: 14 s (o 24 s si el anfitrión ya ha contestado y sólo falta la conexión directa)
      this.timer = setTimeout(() => this.checkTimeout(), 14000);
    }
    checkTimeout() {
      if (this.open || this.closed) return;
      if (this.gotAnswer && !this.extra) { this.extra = true; this.timer = setTimeout(() => this.checkTimeout(), 10000); return; }
      this.fail(this.gotAnswer ? 'ice' : 'timeout');
    }
    send(msg, fast) {
      if (!this.open || this.closed) return;
      const s = JSON.stringify(msg);
      try {
        const dc = this.conn.dataChannel;
        // las "fotos" de la partida se pueden saltar si la conexión va atascada (llegará otra enseguida)
        if (fast && dc && dc.bufferedAmount > 262144) return;
        if (s.length <= CHUNK) this.conn.send(s);
        else {
          const id = ++chunkId, n = Math.ceil(s.length / CHUNK);
          for (let i = 0; i < n; i++) this.conn.send(JSON.stringify({ t: '_p', id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
        }
      } catch (e) { /* canal lleno o cerrado */ }
    }
    recv(data) {
      let m;
      try { m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); } catch (e) { return; }
      if (m.t === '_p') {
        let a = this.parts.get(m.id);
        if (!a) { a = { n: 0, d: [] }; this.parts.set(m.id, a); }
        if (a.d[m.i] === undefined) { a.d[m.i] = m.d; a.n++; }
        if (a.n === m.n) { this.parts.delete(m.id); this.recv(a.d.join('')); }
        return;
      }
      if (this.onmessage) this.onmessage(m);
    }
    fail(reason) {
      if (this.closed) return;
      this.closed = true; this.open = false;
      this.failReason = this.failReason || reason || 'closed';
      clearTimeout(this.timer);
      clearInterval(this.poll);
      try { this.conn.close(); } catch (e) { /* */ }
      this.tr.links.delete(this);
      if (this.onclose) this.onclose();
    }
    close() { this.fail(); }
  }

  /* =================================================================
     Transporte 2: pestañas del mismo navegador (para probar solo).
     Abre el juego con ?local en dos pestañas.
     ================================================================= */
  class LocalTransport {
    constructor() { this.links = new Map(); this.onIncoming = null; this.onDown = null; }
    start(id) {
      this.id = id;
      this.bc = new BroadcastChannel('isla-royale-net');
      this.bc.onmessage = (e) => this.onMsg(e.data);
      return Promise.resolve();
    }
    post(m) { m.from = this.id; this.bc.postMessage(m); }
    onMsg(m) {
      if (m.to !== this.id) return;
      if (m.type === 'conn') {
        const l = new LocalLink(this, m.from);
        this.links.set(m.from, l);
        if (this.onIncoming) this.onIncoming(l);
        this.post({ type: 'acc', to: m.from });
        l.setOpen();
      } else if (m.type === 'acc') { const l = this.links.get(m.from); if (l) l.setOpen(); }
      else if (m.type === 'msg') { const l = this.links.get(m.from); if (l && l.onmessage) l.onmessage(m.d); }
      else if (m.type === 'close') { const l = this.links.get(m.from); if (l) l.fail(true); }
    }
    connect(remoteId) {
      const l = new LocalLink(this, remoteId);
      this.links.set(remoteId, l);
      this.post({ type: 'conn', to: remoteId });
      l.timer = setTimeout(() => { if (!l.open) l.fail(); }, 5000);
      return l;
    }
    stop() { for (const l of [...this.links.values()]) l.close(); this.links.clear(); if (this.bc) this.bc.close(); this.bc = null; }
  }
  class LocalLink {
    constructor(tr, remote) { this.tr = tr; this.remote = remote; this.open = false; this.closed = false; }
    setOpen() { if (this.open) return; this.open = true; clearTimeout(this.timer); if (this.onopen) this.onopen(); }
    send(msg) { if (this.open && !this.closed && this.tr.bc) this.tr.post({ type: 'msg', to: this.remote, d: msg }); }
    fail(remoteClosed) {
      if (this.closed) return;
      this.closed = true; this.open = false;
      if (!remoteClosed && this.tr.bc) this.tr.post({ type: 'close', to: this.remote });
      if (this.tr.links.get(this.remote) === this) this.tr.links.delete(this.remote);
      if (this.onclose) this.onclose();
    }
    close() { this.fail(); }
  }

  /* =================================================================
     Códigos para mandar cosas en pocos bytes
     ================================================================= */
  const Code = {
    // lo que alguien lleva en la mano → número
    held(c) {
      const h = c.held;
      if (h === 'pickaxe') return 0;
      if (!h) return 99;
      if (h.kind === 'weapon') return 1 + G.WEAPON_IDS.indexOf(h.type) * 5 + h.rarity;
      return 40 + G.CONSUMABLE_IDS.indexOf(h.cid);
    },
    item(code) {
      if (code >= 1 && code < 40) { const i = code - 1; return G.Loot.makeWeapon(G.WEAPON_IDS[Math.floor(i / 5)], i % 5); }
      if (code >= 40 && code < 60) return G.Loot.makeCons(G.CONSUMABLE_IDS[code - 40]);
      return null;
    },
    // arma con la que se hizo daño
    weapon(w) {
      if (!w) return -1;
      if (w === 'pickaxe') return 0;
      if (w === 'moto') return 98;
      if (w.kind === 'weapon') return 1 + G.WEAPON_IDS.indexOf(w.type) * 5 + w.rarity;
      return -1;
    },
    weaponFrom(code) {
      if (code === 0) return 'pickaxe';
      if (code === 98) return 'moto';
      if (code >= 1 && code < 40) return Code.item(code);
      return null;
    },
    // objetos del suelo: [id, tipo, a, b, x, y, z, vx, vy, vz, cargador]
    loot(it) {
      const r = (v) => Math.round(v * 100) / 100;
      let k, a, b, mag = 0;
      if (it.kind === 'weapon') { k = 0; a = G.WEAPON_IDS.indexOf(it.weapon.type); b = it.weapon.rarity; mag = it.weapon.mag; }
      else if (it.kind === 'cons') { k = 1; a = G.CONSUMABLE_IDS.indexOf(it.cons.cid); b = it.cons.count; }
      else if (it.kind === 'ammo') { k = 2; a = G.AMMO_IDS.indexOf(it.ammo); b = it.amount; }
      else { k = 3; a = G.MATERIAL_IDS.indexOf(it.mat); b = it.amount; }
      const v = it.vel;
      return [it.id, k, a, b, r(it.pos.x), r(it.pos.y), r(it.pos.z), v ? r(v.x) : 0, v ? r(v.y) : 0, v ? r(v.z) : 0, mag, v ? 1 : 0];
    },
    lootData(k, a, b, mag) {
      if (k === 0) { const w = G.Loot.makeWeapon(G.WEAPON_IDS[a], b); w.mag = mag; return ['weapon', w]; }
      if (k === 1) return ['cons', G.Loot.makeCons(G.CONSUMABLE_IDS[a], b)];
      if (k === 2) return ['ammo', { ammo: G.AMMO_IDS[a], amount: b }];
      return ['mat', { mat: G.MATERIAL_IDS[a], amount: b }];
    },
    // estado de un personaje
    char(c) {
      let f = MODES.indexOf(c.mode);
      if (f < 0) f = 3;
      if (c.crouch) f |= 8;
      if (c.ads) f |= 16;
      if (c.building) f |= 32;
      if (c.reloadT > 0) f |= 64;
      if (c.useT > 0) f |= 128;
      if (c.onGround) f |= 256;
      return [c.nid, Math.round(c.pos.x * 100), Math.round(c.pos.y * 100), Math.round(c.pos.z * 100),
        Math.round(c.yaw * 1000), Math.round(c.pitch * 1000), f, Code.held(c), (c.shotN || 0) & 255,
        c.vehicle ? c.vehicle.id + 1 : 0, Math.ceil(c.health), Math.ceil(c.shield)];
    },
    moto(v) {
      return [v.id, Math.round(v.pos.x * 100), Math.round(v.pos.y * 100), Math.round(v.pos.z * 100),
        Math.round(v.yaw * 1000), Math.round(v.speed * 10), v.steer || 0, v.onGround ? 1 : 0];
    },
    build(t) {
      return [t.type, t.key, t.x, t.y, t.z, t.rotY, t.min, t.max, t.yb, t.yOff,
        t.ix === undefined ? null : t.ix, t.iz === undefined ? null : t.iz, t.iy || 0, t.dir || 0, t.hole ? t.hole.gid : -1];
    },
    buildFrom(a) {
      const t = { type: a[0], key: a[1], x: a[2], y: a[3], z: a[4], rotY: a[5], min: a[6], max: a[7], yb: a[8], yOff: a[9],
        ix: a[10] === null ? undefined : a[10], iz: a[11] === null ? undefined : a[11], iy: a[12], dir: a[13], valid: true };
      if (a[14] >= 0) t.hole = G.Destruct.holes.find((h) => h.gid === a[14]) || null;
      return t;
    },
  };

  /* =================================================================
     G.Net: salas, conexión y sincronización de la partida
     ================================================================= */
  const N = (G.Net = {
    role: null,           // null (un jugador) · 'host' (anfitrión) · 'client' (invitado)
    tr: null,
    code: '',
    peers: new Map(),     // anfitrión: los invitados conectados
    hostLink: null,       // invitado: la conexión con el anfitrión
    roster: [],           // [{pid, name}] los jugadores de la sala
    myPid: 0,
    inMatch: false,
    out: [],              // eventos pendientes de mandar
    builds: new Map(),    // construcciones por número de red
    nextBuild: 1000000,
    snapT: 0, stT: 0, snapN: 0,
    hostSettings: null,
    Code,

    get active() { return this.role !== null; },
    get isHost() { return this.role === 'host'; },
    get isClient() { return this.role === 'client'; },
    get localMode() { return params.has('local'); },

    init() {
      if (!G.SETTINGS.name) G.SETTINGS.name = 'Jugador' + Math.floor(10 + Math.random() * 89);
      this.ui.init();
      // seguir moviendo el mundo aunque el anfitrión cambie de pestaña
      try {
        const blob = new Blob(['setInterval(function(){postMessage(0)},50)'], { type: 'text/javascript' });
        this.ticker = new Worker(URL.createObjectURL(blob));
        this.ticker.onmessage = () => { if (document.hidden && this.isHost && this.inMatch) G.Game.backgroundTick(); };
      } catch (e) {
        setInterval(() => { if (document.hidden && this.isHost && this.inMatch) G.Game.backgroundTick(); }, 100);
      }
    },

    makeTransport() { return this.localMode ? new LocalTransport() : new PeerTransport(); },

    /* ---------- Crear sala (anfitrión) ---------- */
    async host() {
      if (this.role || this.busy) return;
      this.busy = true;
      this.ui.status('Creando la sala…');
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
        const tr = this.makeTransport();
        try {
          await tr.start(PREFIX + code);
          this.tr = tr; this.code = code; this.role = 'host'; this.myPid = 0;
          this.roster = [{ pid: 0, name: G.SETTINGS.name }];
          this.nextPid = 1;
          tr.onIncoming = (l) => this.onIncoming(l);
          tr.onDown = () => this.ui.status('Reconectando con el servidor de salas… (los que ya están dentro siguen jugando)');
          tr.onUp = () => this.ui.status('Conexión con el servidor de salas recuperada.');
          this.busy = false;
          this.ui.status('');
          this.ui.refresh();
          return;
        } catch (e) {
          tr.stop();
          if (e.message !== 'taken') { this.busy = false; this.ui.status(this.errorText(e)); return; }
        }
      }
      this.busy = false;
      this.ui.status('No se ha podido crear la sala. Inténtalo otra vez.');
    },

    errorText(e) {
      if (e.message === 'lib') return 'No se ha cargado la librería de red (falta lib/peerjs.min.js).';
      if (e.message === 'timeout' || e.message === 'net') return 'No se puede conectar con el servidor de salas (¿tienes internet? ¿lo bloquea la red del instituto?).';
      return 'Error al conectar (' + e.message + ').';
    },

    onIncoming(l) {
      const peer = { link: l, pid: 0, name: '?', ready: false, proxy: null, joined: false };
      l.onopen = () => {};
      l.onmessage = (m) => this.onHostMsg(peer, m);
      l.onclose = () => this.onPeerClose(peer);
      this.peers.set(l, peer);
    },

    /* ---------- Unirse a una sala (invitado) ---------- */
    async join(code) {
      code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (this.role || this.busy || code.length < 4) { if (code.length < 4) this.ui.status('Escribe el código de la sala (5 letras).'); return; }
      this.busy = true;
      this.ui.status('Conectando con el servidor de salas…');
      const tr = this.makeTransport();
      try { await tr.start('irp' + rnd36(14)); }
      catch (e) { tr.stop(); this.busy = false; this.ui.status(this.errorText(e)); return; }
      this.tr = tr;
      this.pendingCode = code;
      const fail = (txt) => { this.busy = false; this.leave(true); this.ui.status(txt); };
      const t0 = Date.now();
      let tries = 0;
      // se intenta varias veces: si el anfitrión tenía el juego en segundo plano, al volver contesta
      const attempt = () => {
        if (this.role || !this.busy || this.tr !== tr) return;
        tries++;
        const l = tr.connect(PREFIX + code);
        this.hostLink = l;
        this.ui.status(tries === 1 ? 'Buscando la sala ' + code + '…'
          : 'Reintentando (' + tries + ')… El anfitrión tiene que tener el juego abierto y en pantalla.');
        l.onstage = (st) => { if (st === 'answer') this.ui.status('¡Sala encontrada! Conectando con el anfitrión…'); };
        l.onopen = () => l.send({ t: 'hello', name: G.SETTINGS.name, v: VERSION, skin: G.Shop.state.skin, pick: G.Shop.state.pick });
        l.onmessage = (m) => this.onClientMsg(m);
        l.onclose = () => {
          if (this.role === 'client') { this.hostLost(); return; }
          if (!this.busy || this.tr !== tr) return;
          if (l.failReason === 'expire') {
            fail('La sala ' + code + ' no existe en la versión ' + VERSION + ' del juego. Revisa el código, que el anfitrión no la haya cerrado y que los dos tengáis la misma versión (se ve abajo). Si acabáis de actualizar, recargad la página con Ctrl+F5.');
            return;
          }
          if (Date.now() - t0 < 50000 && tries < 4) { setTimeout(attempt, 1200); return; }
          fail(l.gotAnswer
            ? 'La sala ' + code + ' existe, pero vuestras redes no dejan conectar directamente. Probad con otra wifi, con datos del móvil o los dos en la misma wifi.'
            : 'El anfitrión de la sala ' + code + ' no contesta. Comprobad que los dos tenéis la misma versión (se ve abajo; recargad con Ctrl+F5) y que el anfitrión tiene el juego abierto y en pantalla.');
        };
      };
      attempt();
    },

    // Salir de la sala (o cerrarla si eres el anfitrión)
    leave(quiet) {
      if (this.inMatch && G.Game.state !== 'menu') G.Game.toMenu(true);
      if (this.tr) this.tr.stop();
      this.tr = null; this.role = null; this.code = ''; this.hostLink = null;
      this.peers.clear(); this.roster = []; this.inMatch = false; this.busy = false;
      this.builds.clear();
      if (!quiet) this.ui.status('');
      this.ui.refresh();
    },

    hostLost() {
      const was = this.inMatch;
      this.leave(true);
      this.ui.status('Se ha perdido la conexión con el anfitrión.');
      if (was) G.HUD.toast('Se ha perdido la conexión con el anfitrión');
    },

    broadcast(m, fast) { for (const p of this.peers.values()) if (p.joined) p.link.send(m, fast); },
    sendHost(m, fast) { if (this.hostLink) this.hostLink.send(m, fast); },
    ev(e) { if (this.role) this.out.push(e); },

    lobbyMsg() {
      return { t: 'lobby', roster: this.roster, bots: G.SETTINGS.bots, diff: G.SETTINGS.difficulty, code: this.code, playing: this.inMatch };
    },
    settingsChanged() { if (this.isHost) this.broadcast(this.lobbyMsg()); },
    renamed() {
      if (this.isHost) { this.roster[0].name = G.SETTINGS.name; this.broadcast(this.lobbyMsg()); this.ui.refresh(); }
      else if (this.isClient) this.sendHost({ t: 'name', name: G.SETTINGS.name });
    },

    /* =================================================================
       Mensajes que recibe el ANFITRIÓN
       ================================================================= */
    onHostMsg(peer, m) {
      switch (m.t) {
        case 'hello': {
          if (m.v !== VERSION) { peer.link.send({ t: 'deny', why: 'Tenéis versiones distintas del juego. Actualizad los dos.' }); return; }
          if (this.inMatch) { peer.link.send({ t: 'deny', why: 'La partida ya ha empezado. Espera a que termine.' }); return; }
          if (this.roster.length >= MAX_PLAYERS) { peer.link.send({ t: 'deny', why: 'La sala está llena (máximo ' + MAX_PLAYERS + ').' }); return; }
          peer.pid = this.nextPid++;
          peer.name = cleanName(m.name);
          this.setLook(peer, m);
          peer.joined = true;
          this.roster.push({ pid: peer.pid, name: peer.name });
          peer.link.send({ t: 'welcome', pid: peer.pid });
          this.broadcast(this.lobbyMsg());
          G.HUD.toast(peer.name + ' ha entrado en la sala');
          this.ui.refresh();
          break;
        }
        case 'name': {
          peer.name = cleanName(m.name);
          const r = this.roster.find((q) => q.pid === peer.pid);
          if (r) r.name = peer.name;
          this.broadcast(this.lobbyMsg());
          this.ui.refresh();
          break;
        }
        case 'look':
          this.setLook(peer, m);
          break;
        case 'ready':
          if (m.seed === this.prepSeed) { peer.ready = true; this.checkAllReady(); }
          break;
        case 'st':
          if (this.inMatch && peer.proxy) this.applyRemoteState(peer.proxy, m);
          break;
        case 'ev':
          if (this.inMatch && peer.proxy) for (const e of m.e) this.onClientEvent(peer, e);
          break;
      }
    },

    // skin y pico de un invitado (sólo ids que existen)
    setLook(peer, m) {
      peer.skin = G.Shop.skin(m.skin) ? m.skin : '';
      peer.pick = G.Shop.pick(m.pick) ? m.pick : 'clasico';
    },
    sendLook() { if (this.isClient) this.sendHost({ t: 'look', skin: G.Shop.state.skin, pick: G.Shop.state.pick }); },

    onPeerClose(peer) {
      this.peers.delete(peer.link);
      if (!peer.joined) return;
      this.roster = this.roster.filter((r) => r.pid !== peer.pid);
      G.HUD.toast(peer.name + ' ha salido de la sala');
      const c = peer.proxy;
      if (this.inMatch && c && c.alive) {
        // se va en mitad de la partida: cuenta como eliminado
        if (c.vehicle) G.Vehicles.dismount(c, true, true);
        c.alive = false; c.mode = 'dead'; c.health = 0; c.deadT = 0;
        G.Game.onKill(c, null, null, 'left');
        this.ev(['kill', c.nid, -1, -1, 'left']);
      }
      this.broadcast(this.lobbyMsg());
      this.ui.refresh();
      if (this.prepSeed && !this.inMatch) this.checkAllReady();
    },

    /* ---------- Empezar partida (anfitrión) ---------- */
    hostPrepare() {
      this.inMatch = false;
      this.prepSeed = G.Game.mapSeed();   // misma isla para todos (y siempre la misma)
      for (const p of this.peers.values()) p.ready = false;
      this.hostWorldReady = false;
      this.broadcast({ t: 'prep', seed: this.prepSeed });
      G.Game.showLoading('Preparando la isla para todos…');
      setTimeout(() => {
        G.Game.newWorld(this.prepSeed);
        this.hostWorldReady = true;
        this.checkAllReady();
      }, 50);
      clearTimeout(this.readyTimer);
      this.readyTimer = setTimeout(() => this.checkAllReady(true), 30000);
    },

    checkAllReady(force) {
      if (!this.hostWorldReady || this.inMatch || !this.prepSeed) return;
      const joined = [...this.peers.values()].filter((p) => p.joined);
      if (!force && joined.some((p) => !p.ready)) {
        G.Game.setLoadingText('Esperando a que ' + joined.filter((p) => !p.ready).map((p) => p.name).join(', ') + ' termine de cargar la isla…');
        return;
      }
      clearTimeout(this.readyTimer);
      this.prepSeed = 0;
      for (const p of joined) if (!p.ready) p.link.send({ t: 'deny', why: 'Tu ordenador ha tardado demasiado en cargar la isla.' });
      G.Game.startMatch();
    },

    // Los invitados que juegan esta partida (los que han cargado la isla)
    matchPeers() { return [...this.peers.values()].filter((p) => p.joined && p.ready); },

    // Llamado por Game.startMatch() del anfitrión, con todo ya creado
    sendStart() {
      this.inMatch = true;
      this.out = [];
      this.builds.clear();
      this.snapT = 0;
      const chars = G.Game.characters.map((c) => [c.name, G.Models.PALETTES.indexOf(c.palette), c.human ? 1 : 0, c.skinId || '', c.pickId || 'clasico']);
      const loot = G.Loot.items.map((it) => Code.loot(it));
      const chests = G.Loot.chests.map((c) => [Math.round(c.pos.x * 100) / 100, Math.round(c.pos.y * 100) / 100, Math.round(c.pos.z * 100) / 100, c.obj.rotation.y, c.noBot ? 1 : 0]);
      for (const p of this.matchPeers()) {
        p.link.send({
          t: 'start', you: p.proxy.nid, chars, loot, chests,
          bus: G.Bus.params, busS: G.Bus.s, storm: G.Storm.netState(),
          bots: G.SETTINGS.bots, diff: G.SETTINGS.difficulty, nextLoot: G.Loot.nextId,
        });
      }
      this.broadcast(this.lobbyMsg());
    },

    // El anfitrión vuelve al menú: se acaba la partida para todos
    abortMatch() {
      if (!this.inMatch) return;
      this.inMatch = false;
      if (this.isHost) { this.broadcast({ t: 'abort' }); this.broadcast(this.lobbyMsg()); }
    },

    /* ---------- Eventos que manda un invitado ---------- */
    onClientEvent(peer, e) {
      const me = peer.proxy, L = G.Loot;
      switch (e[0]) {
        case 'take': { const it = L.byId.get(e[1]); if (it) L.remove(it); break; }
        case 'amt': { const it = L.byId.get(e[1]); if (it) { it.amount = e[2]; this.ev(['amt', it.id, it.amount]); } break; }
        case 'open': { const c = L.chests[e[1]]; if (c && !c.opened) L.openChest(c, me); break; }
        case 'drop': {
          const [kind, data] = Code.lootData(e[1], e[2], e[3], e[10]);
          L.spawn(kind, data, e[4], e[5], e[6], e[11] ? new THREE.Vector3(e[7], e[8], e[9]) : null);
          break;
        }
        case 'hit': {
          const t = G.Game.characters[e[1]];
          if (t && t.alive && t !== me) G.Combat.damage(t, e[2], me, Code.weaponFrom(e[4]), !!e[3], e[5] || undefined);
          break;
        }
        case 'sdmg': { const g = this.groupByGid(e[1]); if (g && g.alive) G.Destruct.damage(g, e[2], me, null, !!e[3]); break; }
        case 'build': {
          const t = Code.buildFrom(e[1]);
          if (G.Build.pieces.has(t.key)) { peer.link.send({ t: 'ev', e: [['bfail', t.key]] }); break; }
          G.Build.place(me, t, e[2], { owner: me });
          break;
        }
        case 'dead': {
          if (!me.alive) break;
          const killer = e[1] >= 0 ? G.Game.characters[e[1]] : null;
          if (me.vehicle) G.Vehicles.dismount(me, true, true);
          me.alive = false; me.mode = 'dead'; me.health = 0; me.shield = 0; me.deadT = 0;
          if (killer && killer !== me) killer.kills++;
          const w = Code.weaponFrom(e[2]);
          G.Game.onKill(me, killer, w, e[3] || undefined);
          this.ev(['kill', me.nid, killer ? killer.nid : -1, e[2], e[3] || '']);
          break;
        }
        case 'mount': { const v = G.Vehicles.get(e[1]); if (v && !v.rider && me.alive) { G.Vehicles.mount(me, v, true); this.ev(['moto', v.id, me.nid]); } break; }
        case 'dismount': {
          const v = G.Vehicles.get(e[1]);
          if (v && v.rider === me) {
            v.pos.set(e[2], e[3], e[4]); v.yaw = e[5];
            G.Vehicles.dismount(me, true, true);
            this.ev(['moto', v.id, -1, e[2], e[3], e[4], e[5]]);
          }
          break;
        }
      }
    },

    // Estado que manda un invitado de su personaje (y de su moto)
    applyRemoteState(c, m) {
      this.applyChar(c, m.c, true);
      if (c.alive) { c.health = m.h; c.shield = m.s; }
      if (m.mv) this.applyMoto(m.mv);
    },

    /* =================================================================
       Mensajes que recibe el INVITADO
       ================================================================= */
    onClientMsg(m) {
      switch (m.t) {
        case 'welcome':
          this.role = 'client'; this.myPid = m.pid; this.code = this.pendingCode; this.busy = false;
          this.ui.status('');
          this.ui.refresh();
          break;
        case 'deny':
          if (this.role === 'client' && this.inMatch) G.Game.toMenu(true);
          this.busy = false;
          this.leave(true);
          this.ui.status(m.why);
          break;
        case 'lobby':
          this.roster = m.roster; this.code = m.code;
          this.hostSettings = { bots: m.bots, diff: m.diff, playing: m.playing };
          this.ui.refresh();
          break;
        case 'prep':
          this.inMatch = false;
          G.Game.showLoading('El anfitrión ha empezado la partida: generando la isla…');
          setTimeout(() => { G.Game.newWorld(m.seed); this.sendHost({ t: 'ready', seed: m.seed }); G.Game.setLoadingText('Esperando a los demás jugadores…'); }, 50);
          break;
        case 'start':
          this.builds.clear();
          this.out = [];
          G.Game.startMatchClient(m);
          this.inMatch = true;
          break;
        case 'abort':
          if (this.inMatch) { this.inMatch = false; G.Game.toMenu(true); G.HUD.toast('El anfitrión ha vuelto al menú'); this.ui.status('El anfitrión ha terminado la partida.'); }
          break;
        case 'snap':
          if (this.inMatch) this.applySnap(m);
          break;
        case 'ev':
          if (this.inMatch) for (const e of m.e) this.onHostEvent(e);
          break;
        case 'hurt':
          if (this.inMatch) {
            const me = G.Game.player;
            const att = m.by >= 0 ? G.Game.characters[m.by] : null;
            G.Combat.damage(me, m.a, att, Code.weaponFrom(m.w), !!m.hd, m.k || undefined);
          }
          break;
      }
    },

    applySnap(m) {
      const Gm = G.Game;
      if (m.tm) Gm.time = m.tm;
      if (m.bs !== undefined && G.Bus.active) { if (Math.abs(G.Bus.s - m.bs) > 3) G.Bus.s = m.bs; else G.Bus.s += (m.bs - G.Bus.s) * 0.3; }
      if (m.sm) G.Storm.applyNet(m.sm);
      for (const a of m.c) {
        const c = Gm.characters[a[0]];
        if (c && c !== Gm.player) this.applyChar(c, a, false);
      }
      if (m.mo) for (const a of m.mo) this.applyMoto(a);
    },

    onHostEvent(e) {
      const L = G.Loot, Gm = G.Game, me = Gm.player;
      switch (e[0]) {
        case 'add': { const s = e[1]; const [kind, data] = Code.lootData(s[1], s[2], s[3], s[10]); L.spawn(kind, data, s[4], s[5], s[6], s[11] ? new THREE.Vector3(s[7], s[8], s[9]) : null, s[0]); break; }
        case 'rm': { const it = L.byId.get(e[1]); if (it) L.remove(it, true); break; }
        case 'amt': { const it = L.byId.get(e[1]); if (it) it.amount = e[2]; break; }
        case 'chest': {
          const c = L.chests[e[1]];
          if (c && !c.opened) L.openChest(c, Gm.characters[e[2]] || null, true);
          break;
        }
        case 'des': { const g = this.groupByGid(e[1]); if (g && g.alive) G.Destruct.destroy(g, null, true); break; }
        case 'build': {
          const t = Code.buildFrom(e[2]);
          const owner = e[4] >= 0 ? Gm.characters[e[4]] : null;
          const ex = G.Build.pieces.get(t.key);
          if (ex && owner === me && ex.netId == null) { this.registerBuild(ex.g, e[1]); break; }
          if (ex && ex.netId === e[1]) break;
          if (ex) G.Build.removeQuiet(ex);
          G.Build.place(null, t, e[3], { netId: e[1] });
          break;
        }
        case 'bfail': {
          const ex = G.Build.pieces.get(e[1]);
          if (ex && ex.netId == null) { G.Build.removeQuiet(ex); me.mats[ex.mat] = Math.min(G.MATERIALS[ex.mat].max, me.mats[ex.mat] + C.build.cost); }
          break;
        }
        case 'kill': {
          const v = Gm.characters[e[1]], k = e[2] >= 0 ? Gm.characters[e[2]] : null;
          if (!v) break;
          if (v.vehicle) G.Vehicles.dismount(v, true, true);
          if (v !== me) { v.alive = false; v.mode = 'dead'; v.deadT = 0; v.health = 0; v.shield = 0; v.model.glider.visible = false; }
          if (k === me && v !== me) me.kills++;
          G.Effects.burst(v.pos.x, v.pos.y + 1, v.pos.z, 0xffffff, 30, 4, 0.8, 2);
          Gm.onKill(v, k, Code.weaponFrom(e[3]), e[4] || undefined);
          break;
        }
        case 'win': {
          const w = Gm.characters[e[1]];
          if (w === me) { Gm.stats.placement = 1; Gm.stats.timeAlive = Gm.time; setTimeout(() => Gm.showEnd(true), 1500); }
          else if (w && !me.alive) G.HUD.toast('¡' + w.name + ' ha ganado la partida!');
          break;
        }
        case 'moto': {
          const v = G.Vehicles.get(e[1]);
          if (!v) break;
          const r = e[2] >= 0 ? Gm.characters[e[2]] : null;
          if (r === me) break;
          if (v.rider && v.rider !== r) {
            if (v.rider === me) G.HUD.toast('¡Otro jugador ha cogido esa moto antes!');
            G.Vehicles.dismount(v.rider, true, true);
          }
          if (r) { if (r.vehicle && r.vehicle !== v) G.Vehicles.dismount(r, true, true); G.Vehicles.mount(r, v, true); }
          else if (e.length > 3) { v.pos.set(e[3], e[4], e[5]); v.yaw = e[6]; v.speed = 0; v.net = null; }
          break;
        }
      }
    },

    /* =================================================================
       Personajes y motos de otros (los mueve la red)
       ================================================================= */
    applyChar(c, a, fromClient) {
      let n = c.net;
      const x = a[1] / 100, y = a[2] / 100, z = a[3] / 100, now = performance.now() / 1000;
      if (!n) { n = c.net = { x, y, z, px: x, py: y, pz: z, t: now, pt: now - 0.05, shot: a[8] }; c.pos.set(x, y, z); }
      n.px = n.x; n.py = n.y; n.pz = n.z; n.pt = n.t;
      n.x = x; n.y = y; n.z = z; n.t = now;
      n.yaw = a[4] / 1000; n.pitch = a[5] / 1000;
      // teletransporte (saltar del autobús, etc.): no interpolar
      if (Math.hypot(x - c.pos.x, y - c.pos.y, z - c.pos.z) > 12) { c.pos.set(x, y, z); c.yaw = n.yaw; }
      const f = a[6], mode = MODES[f & 7];
      if (c.alive && mode !== 'dead') {
        if (c.mode !== mode && mode === 'dive') c.diveT = 0;
        c.mode = mode;
      }
      c.crouch = !!(f & 8); c.ads = !!(f & 16); c.building = !!(f & 32);
      c.reloadT = f & 64 ? 1 : 0; c.reloadDur = 1.5;
      c.onGround = !!(f & 256);
      this.setHeld(c, a[7]);
      c.useT = f & 128 && c.consumable ? 1 : 0; c.useDur = 2; c.useSel = c.sel;
      c.model.glider.visible = c.mode === 'glide';
      if (!fromClient && a[10] !== undefined) { c.health = a[10]; c.shield = a[11]; }
      // disparos: el contador ha cambiado
      if (a[8] !== n.shot) {
        const d = (a[8] - n.shot + 256) % 256;
        n.shot = a[8];
        this.shotFx(c, Math.min(d, 3));
      }
    },

    setHeld(c, code) {
      if (c._heldCode === code) return;
      c._heldCode = code;
      if (code === 0) { c.sel = -1; return; }
      c.slots[0] = Code.item(code);
      c.sel = 0;
    },

    applyMoto(a) {
      const v = G.Vehicles.get(a[0]);
      if (!v || (v.rider && v.rider === G.Game.player)) return;
      v.net = { x: a[1] / 100, y: a[2] / 100, z: a[3] / 100, yaw: a[4] / 1000 };
      v.speed = a[5] / 10; v.steer = a[6]; v.onGround = !!a[7];
      if (Math.hypot(v.net.x - v.pos.x, v.net.z - v.pos.z) > 15) { v.pos.set(v.net.x, v.net.y, v.net.z); v.yaw = v.net.yaw; }
    },

    // Fogonazo, trazadora y sonido cuando dispara alguien que viene por la red
    shotFx(c, n) {
      if (!c.alive || c.mode !== 'ground') return;
      const h = c.held;
      if (h === 'pickaxe') { c.swingT = 0.35; if (this.isHost) G.Bots.hearShot(c); return; }
      const w = c.weapon;
      if (!w) return;
      const eye = c.eye(new THREE.Vector3());
      const cp = Math.cos(c.pitch);
      const dir = new THREE.Vector3(-Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp);
      const muz = G.Combat.muzzleOf(c, new THREE.Vector3());
      // misil: se ve volar y explotar (el daño ya lo calcula el ordenador de quien disparó)
      if (w.def.projectile) {
        G.Combat.launchRocket(c, w, eye, dir, 0, muz, true);
        c.recoil = Math.min(0.3, c.recoil + w.def.recoil);
        if (this.isHost) G.Bots.hearShot(c);
        return;
      }
      for (let i = 0; i < n; i++) {
        const res = G.Phys.raycastWorld(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, Math.min(w.def.range, 150));
        const end = eye.clone().addScaledVector(dir, res ? res.t : Math.min(w.def.range, 150));
        G.Effects.tracer(muz, end, 0xffd27a);
        if (res) G.Effects.burst(end.x, end.y, end.z, 0xcfc8b8, 3, 2.5, 0.3);
      }
      G.Effects.flash(muz, w.def.pellets > 1 || w.def.id === 'sniper' ? 1.0 : 0.6);
      G.Audio.shot(w.def.id, c.pos);
      c.recoil = Math.min(0.3, c.recoil + w.def.recoil);
      if (this.isHost) G.Bots.hearShot(c);
    },

    /* =================================================================
       Cada fotograma
       ================================================================= */
    update(dt) {
      if (!this.role || !this.inMatch) return;
      const Gm = G.Game;
      // mover suavemente a los que vienen por la red
      const k = 1 - Math.exp(-dt * 14);
      for (const c of Gm.characters) {
        if (!(c.puppet || c.remote) || !c.net || c.vehicle) continue;
        const n = c.net;
        c.pos.x += (n.x - c.pos.x) * k; c.pos.y += (n.y - c.pos.y) * k; c.pos.z += (n.z - c.pos.z) * k;
        c.yaw += U.angleDiff(c.yaw, n.yaw) * k;
        c.pitch += (n.pitch - c.pitch) * k;
        const ddt = Math.max(0.03, n.t - n.pt);
        c.vel.set((n.x - n.px) / ddt, (n.y - n.py) / ddt, (n.z - n.pz) / ddt);
        c.moving = Math.hypot(c.vel.x, c.vel.z) > 1;
        // suelo de verdad bajo sus pies (también pisos de edificios), para la sombra
        if ((this._gyN = (this._gyN || 0) + 1) % 3 === 0 || c.groundY === undefined) c.groundY = G.Phys.groundAt(c.pos.x, c.pos.z, 0.3, c.pos.y + 0.3, 0.6);
        c.swingT = Math.max(0, c.swingT - dt);
        c.recoil = Math.max(0, c.recoil - dt * 0.35);
        if (c.mode === 'dead') c.deadT += 0;
      }
      for (const v of G.Vehicles.list) {
        if (!v.net || !v.rider || v.rider === Gm.player || !(v.rider.puppet || v.rider.remote)) continue;
        v.pos.x += (v.net.x - v.pos.x) * k; v.pos.y += (v.net.y - v.pos.y) * k; v.pos.z += (v.net.z - v.pos.z) * k;
        v.yaw += U.angleDiff(v.yaw, v.net.yaw) * k;
      }

      if (this.isHost) {
        this.snapT += dt;
        if (this.snapT >= 1 / SNAP_RATE) { this.snapT = 0; this.sendSnaps(); }
        if (this.out.length) { this.broadcast({ t: 'ev', e: this.out }); this.out = []; }
      } else {
        this.stT += dt;
        if (this.stT >= 1 / STATE_RATE) {
          this.stT = 0;
          const me = Gm.player;
          const msg = { t: 'st', c: Code.char(me), h: Math.ceil(me.health), s: Math.ceil(me.shield) };
          if (me.vehicle) msg.mv = Code.moto(me.vehicle);
          this.sendHost(msg, true);
        }
        if (this.out.length) { this.sendHost({ t: 'ev', e: this.out }); this.out = []; }
      }
    },

    // La "foto" de la partida para cada invitado (lo lejano se manda menos a menudo)
    sendSnaps() {
      const Gm = G.Game;
      this.snapN++;
      const sm = G.Storm.netState();
      const mo = [];
      for (const v of G.Vehicles.list) if (v.rider) mo.push(Code.moto(v));
      const enc = new Map();
      for (const p of this.matchPeers()) {
        const me = p.proxy;
        if (!me) continue;
        const list = [];
        for (const c of Gm.characters) {
          if (c === me || !c.alive) continue;
          const far = Math.abs(c.pos.x - me.pos.x) > 240 || Math.abs(c.pos.z - me.pos.z) > 240;
          if (far && me.alive && (this.snapN + c.nid) % 4 !== 0) continue;
          let e = enc.get(c);
          if (!e) { e = Code.char(c); enc.set(c, e); }
          list.push(e);
        }
        const msg = { t: 'snap', tm: Math.round(Gm.time * 100) / 100, c: list, sm };
        if (G.Bus.active) msg.bs = Math.round(G.Bus.s * 10) / 10;
        if (mo.length) msg.mo = mo.filter((a) => !(me.vehicle && me.vehicle.id === a[0]));
        p.link.send(msg, true);
      }
    },

    /* =================================================================
       Ganchos que llaman los demás archivos del juego
       ================================================================= */
    // botín
    lootAdded(it) { if (this.isHost && this.inMatch) this.ev(['add', Code.loot(it)]); },
    lootRemoved(it) {
      if (!this.inMatch) return;
      if (this.isHost) this.ev(['rm', it.id]); else this.ev(['take', it.id]);
    },
    lootAmount(it) { if (this.inMatch) this.ev(['amt', it.id, it.amount]); },
    requestDrop(kind, data, x, y, z, vel) {
      const fake = { id: 0, kind, pos: { x, y, z }, vel, weapon: kind === 'weapon' ? data : null, cons: kind === 'cons' ? data : null,
        ammo: kind === 'ammo' ? data.ammo : null, mat: kind === 'mat' ? data.mat : null, amount: data.amount || 1 };
      const a = Code.loot(fake);
      a[0] = 'drop';
      this.ev(a);
    },
    requestChest(c) { this.ev(['open', c.id]); },
    chestOpened(c, by) { if (this.isHost && this.inMatch) this.ev(['chest', c.id, by ? by.nid : -1]); },

    // daño
    forwardDamage(target, amount, attacker, weapon, head, kind) {
      if (!this.inMatch) return;
      if (this.isHost && target.remote) {
        const p = [...this.peers.values()].find((q) => q.proxy === target);
        if (p) p.link.send({ t: 'hurt', a: amount, by: attacker ? attacker.nid : -1, w: Code.weapon(weapon), hd: head ? 1 : 0, k: kind || '' });
      } else if (this.isClient && attacker === G.Game.player) {
        this.ev(['hit', target.nid, amount, head ? 1 : 0, Code.weapon(weapon), kind || '']);
      }
    },
    reportDeath(attacker, weapon, kind) {
      this.ev(['dead', attacker ? attacker.nid : -1, Code.weapon(weapon), kind || '']);
    },
    killed(target, attacker, weapon, kind) {
      if (this.isHost && this.inMatch) this.ev(['kill', target.nid, attacker ? attacker.nid : -1, Code.weapon(weapon), kind || '']);
    },
    winner(c) { if (this.isHost && this.inMatch) this.ev(['win', c.nid]); },

    // cosas que se rompen
    gid(g) { return g.netId != null ? g.netId : g.id; },
    groupByGid(id) { return id >= 1000000 ? this.builds.get(id) : G.Destruct.groups[id]; },
    structDamage(g, amount, pickaxe) {
      if (!this.inMatch || (g.build && g.netId == null)) return;
      this.ev(['sdmg', this.gid(g), Math.round(amount * 10) / 10, pickaxe ? 1 : 0]);
    },
    destroyed(g) { if (this.isHost && this.inMatch) this.ev(['des', this.gid(g)]); },

    // construcciones
    registerBuild(g, netId) { g.netId = netId; if (g.build) g.build.netId = netId; this.builds.set(netId, g); },
    onBuild(piece, t, mat, ch, net) {
      if (!this.inMatch) return;
      if (this.isHost) {
        const id = this.nextBuild++;
        this.registerBuild(piece.g, id);
        this.ev(['build', id, Code.build(t), mat, ch ? ch.nid : -1]);
      } else if (net && net.netId) {
        this.registerBuild(piece.g, net.netId);
      } else {
        this.ev(['build', Code.build(t), mat]);
      }
    },

    // motos
    motoMount(v, ch) {
      if (!this.inMatch) return;
      if (this.isHost) this.ev(['moto', v.id, ch.nid]);
      else if (ch === G.Game.player) this.ev(['mount', v.id]);
    },
    motoDismount(v, ch) {
      if (!this.inMatch) return;
      const p = v.pos;
      if (this.isHost) this.ev(['moto', v.id, -1, p.x, p.y, p.z, v.yaw]);
      else if (ch === G.Game.player) this.ev(['dismount', v.id, p.x, p.y, p.z, v.yaw]);
    },

    /* =================================================================
       Panel "Jugar con amigos" del menú
       ================================================================= */
    ui: {
      init() {
        const $ = (id) => document.getElementById(id);
        this.$ = $;
        const name = $('net-name');
        name.value = G.SETTINGS.name;
        name.addEventListener('change', () => {
          G.SETTINGS.name = cleanName(name.value) || G.SETTINGS.name;
          name.value = G.SETTINGS.name;
          G.Game.saveSettings();
          N.renamed();
        });
        $('btn-host').onclick = () => { G.Audio.init(); N.host(); };
        $('btn-join').onclick = () => { G.Audio.init(); N.join($('net-code').value); };
        $('net-code').addEventListener('keydown', (e) => { if (e.code === 'Enter') { e.preventDefault(); N.join($('net-code').value); } });
        $('btn-leave').onclick = () => N.leave();
        $('btn-copy').onclick = () => {
          const t = N.code;
          if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => this.status('Código copiado: pégaselo a tus amigos.'), () => {});
        };
        // la versión, para comprobar de un vistazo que los dos tenéis el mismo juego
        $('net-mode').textContent = (N.localMode ? 'Modo pruebas: pestañas de este navegador · ' : '') + 'Versión del juego: ' + VERSION;
        this.refresh();
      },
      status(t) { const el = this.$ && this.$('net-status'); if (el) el.textContent = t || ''; },
      refresh() {
        const $ = this.$;
        if (!$) return;
        const inRoom = !!N.role;
        $('net-idle').classList.toggle('hidden', inRoom);
        $('net-room').classList.toggle('hidden', !inRoom);
        if (inRoom) {
          $('net-room-code').textContent = N.code;
          $('net-players').innerHTML = N.roster.map((r) => '<li>' + (r.pid === 0 ? '👑 ' : '🙂 ') + esc(r.name) +
            (r.pid === N.myPid ? ' <small>(tú)</small>' : '') + '</li>').join('');
          const hs = N.hostSettings;
          $('net-hint').innerHTML = N.isHost
            ? 'Pasa el código a tus amigos y <b>deja el juego abierto y en pantalla</b> mientras se unen (si lo minimizas, el navegador lo "duerme" y no les puede contestar). Cuando estéis todos, pulsa <b>JUGAR</b>.'
            : 'Esperando a que el anfitrión pulse JUGAR…' + (hs ? '<br>Partida con <b>' + hs.bots + ' bots</b> · dificultad ' + hs.diff + '.' : '');
        }
        const play = $('btn-play');
        play.disabled = N.isClient;
        play.textContent = N.isClient ? 'ESPERANDO AL ANFITRIÓN…' : N.isHost ? 'JUGAR (' + N.roster.length + ' jugador' + (N.roster.length > 1 ? 'es' : '') + ')' : 'JUGAR';
        $('opt-bots').disabled = N.isClient;
        $('opt-diff').disabled = N.isClient;
      },
    },
  });

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
})();

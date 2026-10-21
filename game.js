/* =====================================================================
   game.js — El "director" del juego: crea la escena 3D, el bucle
   principal, los menús y el flujo de la partida:
   menú → autobús → caída → combate → victoria o eliminación.
   También ajusta la resolución sola para que vaya fluido en
   ordenadores modestos.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;
  const $ = (id) => document.getElementById(id);

  const _f = new THREE.Vector3(), _v = new THREE.Vector3();

  const Game = (G.Game = {
    state: 'loading',
    time: 0,
    characters: [],
    player: null,
    viewTarget: null,
    paused: false,
    everLocked: false,
    stats: { shots: 0, hits: 0, chests: 0, weapons: 0 },
    listener: { pos: new THREE.Vector3(), yaw: 0 },
    renderScale: 1,
    shadowsOn: false,
    blobShadows: true,
    frameN: 0,
    worldFresh: false,

    init() {
      this.loadSettings();
      this.scene = new THREE.Scene();
      const ST = G.STYLE;
      this.scene.background = new THREE.Color(ST.fog);
      this.scene.fog = new THREE.Fog(ST.fog, 260, 1100);
      // plano cercano a 0,2 m (con 0,1 la profundidad pierde precisión y las cosas lejanas parpadean)
      this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.2, 1300);
      this.camera.rotation.order = 'YXZ';
      this.createRenderer();

      this.scene.add(new THREE.HemisphereLight(ST.hemiSky, ST.hemiGround, ST.hemiI));
      const sun = new THREE.DirectionalLight(ST.sun, ST.sunI);
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.04;
      this.scene.add(sun);
      this.scene.add(sun.target);
      this.sun = sun;
      this.sunOffset = new THREE.Vector3().fromArray(ST.sunDir);

      // escena aparte para lo que llevas en la mano en primera persona
      this.vmScene = new THREE.Scene();
      this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.9));
      const vl = new THREE.DirectionalLight(0xffffff, 0.5);
      vl.position.set(1, 2, 1);
      this.vmScene.add(vl);

      G.Input.init(this.renderer.domElement);
      G.Effects.init(this.scene);
      G.Loot.init(this.scene);
      G.Build.init(this.scene);
      G.Vehicles.init(this.scene);
      G.Bus.init(this.scene);
      G.Storm.init(this.scene);
      G.PlayerCtl.init(this.vmScene);
      G.HUD.init();
      G.Shop.init();
      this.wireUI();
      G.Net.init();
      G.Account.init();
      this.applyQuality();

      window.addEventListener('resize', () => this.resize());

      // generar la isla (después de pintar la pantalla de carga)
      setTimeout(() => {
        this.newWorld();
        this.state = 'menu';
        $('loading').classList.add('hidden');
        $('menu').classList.remove('hidden');
      }, 60);

      this.last = performance.now();
      this.fpsT = 0; this.fpsN = 0; this.fpsLow = 0;
      const loop = () => { requestAnimationFrame(loop); this.frame(); };
      loop();
    },

    // El "lienzo" 3D. Se vuelve a crear si cambias el suavizado de bordes (antialias)
    createRenderer() {
      const q = G.QUALITY[G.SETTINGS.quality] || G.QUALITY.media;
      if (this.renderer && this.rendererAA === q.aa) return;
      const old = this.renderer;
      const r = new THREE.WebGLRenderer({ antialias: q.aa, powerPreference: 'high-performance' });
      r.setSize(innerWidth, innerHeight);
      r.shadowMap.type = THREE.PCFShadowMap;
      r.autoClear = false;
      r.domElement.addEventListener('click', () => this.onCanvasClick());
      if (old) {
        old.domElement.replaceWith(r.domElement);
        old.dispose();
        G.Input.canvas = r.domElement;
        r.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
      } else $('game').appendChild(r.domElement);
      this.renderer = r;
      this.rendererAA = q.aa;
    },

    resize() {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    },

    mapSeed() {
      const qs = new URLSearchParams(location.search).get('seed');   // para probar otras islas: ?seed=123
      return qs ? parseInt(qs, 10) || C.mapSeed : C.mapSeed;
    },

    newWorld(seed) {
      const t0 = performance.now();
      G.Loot.reset();
      G.Build.reset();
      G.Vehicles.reset();
      // el mapa es siempre el mismo: misma "semilla" = misma isla (el botín sí cambia cada partida)
      G.World.generate(this.scene, seed !== undefined ? seed : this.mapSeed());
      G.HUD.buildMapImage();
      this.applyQuality();
      this.genTime = performance.now() - t0;
      this.worldFresh = true;
    },

    /* ---------- Ajustes ---------- */
    loadSettings() {
      try {
        const s = JSON.parse(localStorage.getItem('islaRoyaleSettings2') || '{}');
        Object.assign(G.SETTINGS, s);
      } catch (e) { /* sin almacenamiento */ }
      if (!G.QUALITY[G.SETTINGS.quality]) G.SETTINGS.quality = 'media';
    },
    saveSettings() {
      try { localStorage.setItem('islaRoyaleSettings2', JSON.stringify(G.SETTINGS)); } catch (e) { /* nada */ }
    },
    applyQuality() {
      const q = G.QUALITY[G.SETTINGS.quality] || G.QUALITY.media;
      this.createRenderer();
      this.quality = q;
      this.renderScale = q.scale;
      this.basePR = Math.min(devicePixelRatio || 1, q.maxPR);
      this.renderer.setPixelRatio(this.basePR * this.renderScale);
      this.shadowsOn = q.shadows;
      this.blobShadows = !q.shadows;
      this.renderer.shadowMap.enabled = q.shadows;
      this.renderer.shadowMap.autoUpdate = false;
      this.sun.castShadow = q.shadows;
      this.scene.fog.near = q.fog[0];
      this.scene.fog.far = q.fog[1];
      this.camera.far = q.far;
      this.camera.updateProjectionMatrix();
      G.Loot.viewDist = q.loot;
      if (G.World.clouds) G.World.clouds.visible = q.clouds;
      this.scene.traverse((o) => {
        if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true;
      });
      for (const p of G.Build.list) { p.mesh.castShadow = q.shadows; p.mesh.receiveShadow = q.shadows; }
    },

    wireUI() {
      const S = G.SETTINGS;
      const bots = $('opt-bots'), diff = $('opt-diff'), cam = $('opt-cam'), q = $('opt-quality'), sens = $('opt-sens'), vol = $('opt-vol');
      const ar = $('opt-autores'), fps = $('opt-fps');
      // opciones de número de bots (hasta 100)
      bots.innerHTML = G.BOT_OPTIONS.map((n) => '<option value="' + n + '">' + n + ' bots' +
        (n >= 75 ? ' (ordenador potente)' : '') + '</option>').join('');
      if (!G.BOT_OPTIONS.includes(S.bots)) {
        S.bots = G.BOT_OPTIONS.reduce((a, b) => (Math.abs(b - S.bots) < Math.abs(a - S.bots) ? b : a));
      }
      bots.value = String(S.bots); diff.value = S.difficulty; cam.value = S.camera; q.value = S.quality;
      sens.value = S.sensitivity; vol.value = S.volume; ar.checked = S.autoRes; fps.checked = S.showFps;
      $('sens-val').textContent = Number(S.sensitivity).toFixed(1);
      $('vol-val').textContent = Math.round(S.volume * 100);
      bots.onchange = () => { S.bots = parseInt(bots.value, 10); this.saveSettings(); G.Net.settingsChanged(); };
      diff.onchange = () => { S.difficulty = diff.value; this.saveSettings(); G.Net.settingsChanged(); };
      cam.onchange = () => { S.camera = cam.value; this.saveSettings(); };
      q.onchange = () => { S.quality = q.value; this.applyQuality(); this.saveSettings(); };
      ar.onchange = () => { S.autoRes = ar.checked; this.saveSettings(); if (!S.autoRes) this.applyQuality(); };
      fps.onchange = () => { S.showFps = fps.checked; this.saveSettings(); G.HUD.setFps(0); };
      sens.oninput = () => { S.sensitivity = parseFloat(sens.value); $('sens-val').textContent = S.sensitivity.toFixed(1); this.saveSettings(); };
      vol.oninput = () => { S.volume = parseFloat(vol.value); $('vol-val').textContent = Math.round(S.volume * 100); G.Audio.setVolume(S.volume); this.saveSettings(); };

      $('btn-play').onclick = () => this.requestMatch();
      $('btn-again').onclick = () => this.requestMatch();
      $('btn-menu').onclick = () => this.toMenu();
      $('btn-quit').onclick = (e) => { e.stopPropagation(); this.toMenu(); };
      $('btn-resume').onclick = (e) => { e.stopPropagation(); this.resume(); };
      // en la pausa, un clic en cualquier sitio también vuelve al juego
      $('pause').addEventListener('click', () => this.resume());
      $('click-to-play').addEventListener('click', () => this.resume());
      $('btn-spectate').onclick = () => {
        $('end').classList.add('hidden');
        this.spectating = true;
        this.cycleSpectate();
      };
      window.addEventListener('keydown', (e) => {
        if (this.state !== 'playing') return;
        if (e.code === 'Tab') {
          if (G.HUD.invOpen) G.HUD.closeInventory();
          else if (this.player && this.player.alive && !this.paused) G.HUD.openInventory();
        }
        if (e.code === 'KeyM') G.HUD.setBigMap(!G.HUD.bigOpen);
        if (e.code === 'KeyV' && this.player && this.player.alive && !this.player.building) {
          S.camera = S.camera === 'primera' ? 'tercera' : 'primera';
          cam.value = S.camera;
          this.saveSettings();
        }
        if (e.code === 'Escape') {
          if (G.HUD.invOpen) { G.HUD.closeInventory(true); this.pause(); }
          else if (this.spectating) { this.spectating = false; $('end').classList.remove('hidden'); }
        }
      });
    },

    onCanvasClick() {
      if (this.state !== 'playing') return;
      if (this.spectating) { this.cycleSpectate(); return; }
      if (this.player && this.player.alive && !G.Input.locked && !G.HUD.invOpen) this.resume();
    },

    resume() {
      if (this.state !== 'playing' || !this.player || !this.player.alive) return;
      G.Input.lock();
    },

    pause() {
      if (this.state !== 'playing' || !this.player || !this.player.alive) return;
      this.paused = true;
      G.Audio.engineStop();
      $('pause').classList.remove('hidden');
      $('click-to-play').classList.add('hidden');
    },

    onLockChange(locked) {
      if (locked) {
        this.everLocked = true;
        this.paused = false;
        $('pause').classList.add('hidden');
        $('click-to-play').classList.add('hidden');
        $('lock-help').classList.add('hidden');
        if (G.HUD.invOpen) G.HUD.closeInventory(true);
      } else if (this.state === 'playing' && this.player && this.player.alive && !G.HUD.invOpen) {
        this.pause();
      }
    },

    // El navegador no ha dejado bloquear el ratón (suele pasar si se pulsa muy rápido tras Esc)
    onLockError() {
      if (this.state !== 'playing') return;
      if (this.paused) { $('lock-help').classList.remove('hidden'); return; }
      $('click-to-play').classList.remove('hidden');
    },

    /* ---------- Partida ---------- */
    // Pulsar JUGAR: bloqueamos ya el ratón (hace falta el clic) y generamos una isla nueva si hace falta
    requestMatch() {
      G.Audio.init();
      G.Audio.setVolume(G.SETTINGS.volume);
      if (G.Net.isClient) return;                 // en multijugador empieza el anfitrión
      G.Input.lock();
      if (G.Net.isHost) { G.Net.hostPrepare(); return; }
      if (this.worldFresh) { this.startMatch(); return; }
      ['menu', 'end', 'pause'].forEach((id) => $(id).classList.add('hidden'));
      $('loading-text').textContent = 'Generando una isla nueva…';
      $('loading').classList.remove('hidden');
      for (const ch of this.characters) this.scene.remove(ch.model.root);
      this.characters = [];
      this.state = 'loading';
      setTimeout(() => {
        this.newWorld();
        $('loading').classList.add('hidden');
        this.startMatch();
      }, 40);
    },

    startMatch() {
      this.worldFresh = false;
      for (const ch of this.characters) this.scene.remove(ch.model.root);
      G.Loot.reset();
      G.Build.reset();
      G.Effects.clear();
      G.HUD.reset();
      G.Loot.populate();
      G.Vehicles.spawnAll();

      const PAL = G.Models.PALETTES;
      const net = G.Net.isHost;
      // tu skin y tu pico (los de la taquilla)
      const look = G.Shop.look();
      this.player = new G.Character(net ? G.SETTINGS.name : 'Tú', true, look.pal, look);
      this.player.human = true;
      this.rewarded = false;
      // multijugador: un "representante" por cada amigo conectado (lo mueve su ordenador)
      const proxies = [];
      if (net) {
        for (const p of G.Net.matchPeers()) {
          const lk = G.Shop.lookFor(p.skin, p.pick);
          const c = new G.Character(p.name, false, lk.pal, lk);
          c.remote = true; c.human = true; c.pid = p.pid;
          p.proxy = c;
          proxies.push(c);
        }
      }
      const bots = G.Bots.create(G.SETTINGS.bots);
      this.characters = [this.player, ...proxies, ...bots];
      this.characters.forEach((c, i) => { c.nid = i; });
      for (const ch of this.characters) this.scene.add(ch.model.root);
      for (const c of proxies) this.nameTag(c);
      G.PlayerCtl.setCharacter(this.player);

      G.Bus.start();
      G.Storm.start();
      for (const ch of this.characters) { ch.mode = 'bus'; ch.pos.copy(G.Bus.pos); }
      for (const b of bots) b.brain.planDrop();
      this.player.yaw = Math.atan2(-G.Bus.dir.x, -G.Bus.dir.z) + 0.6;
      this.player.pitch = -0.25;

      this.time = 0;
      this.state = 'playing';
      this.paused = false;
      this.spectating = false;
      this.viewTarget = null;
      this.endShown = false;
      this.stats = { shots: 0, hits: 0, chests: 0, weapons: 0, placement: 0, timeAlive: 0, killsAt: [] };
      this.rankResult = null;
      ['menu', 'end', 'pause', 'loading'].forEach((id) => $(id).classList.add('hidden'));
      G.HUD.show(true);
      G.HUD.setFps(0);
      this.askLock();
      if (net) G.Net.sendStart();
    },

    askLock() {
      if (!G.Input.locked) {
        G.Input.lock();
        setTimeout(() => { if (!G.Input.locked && this.state === 'playing') $('click-to-play').classList.remove('hidden'); }, 600);
      }
    },

    /* Multijugador (invitado): montar la partida con lo que manda el anfitrión */
    startMatchClient(m) {
      this.worldFresh = false;
      for (const ch of this.characters) this.scene.remove(ch.model.root);
      G.Loot.reset();
      G.Build.reset();
      G.Effects.clear();
      G.HUD.reset();
      G.Loot.loadNet(m.loot, m.chests);
      G.Loot.nextId = Math.max(G.Loot.nextId, m.nextLoot || 0);
      G.Vehicles.spawnAll();
      G.Bots.list = [];
      const PAL = G.Models.PALETTES;
      this.rewarded = false;
      this.characters = m.chars.map((d, i) => {
        const me = i === m.you;
        // d = [nombre, paleta, humano, skin, pico]
        const lk = d[3] ? G.Shop.lookFor(d[3], d[4]) : { pal: PAL[d[1]] || PAL[0], acc: null, skin: '', pick: G.Shop.pick(d[4]) ? d[4] : 'clasico' };
        const c = new G.Character(me ? 'Tú' : String(d[0]).replace(/[<>&"'`\\]/g, ''), me, lk.pal, lk);
        c.nid = i;
        c.human = !!d[2];
        if (!me) c.puppet = true;
        return c;
      });
      this.player = this.characters[m.you];
      for (const ch of this.characters) this.scene.add(ch.model.root);
      for (const c of this.characters) if (c.human && c !== this.player) this.nameTag(c);
      G.PlayerCtl.setCharacter(this.player);
      G.Bus.start(m.bus[0], m.bus[1]);
      G.Bus.s = m.busS || 0;
      G.Bus.update(0);
      G.Storm.start();
      G.Storm.applyNet(m.storm);
      for (const ch of this.characters) { ch.mode = 'bus'; ch.pos.copy(G.Bus.pos); }
      this.player.yaw = Math.atan2(-G.Bus.dir.x, -G.Bus.dir.z) + 0.6;
      this.player.pitch = -0.25;
      this.time = 0;
      this.state = 'playing';
      this.paused = false;
      this.spectating = false;
      this.viewTarget = null;
      this.endShown = false;
      this.stats = { shots: 0, hits: 0, chests: 0, weapons: 0, placement: 0, timeAlive: 0, killsAt: [] };
      this.rankResult = null;
      ['menu', 'end', 'pause', 'loading'].forEach((id) => $(id).classList.add('hidden'));
      G.HUD.show(true);
      G.HUD.setFps(0);
      this.askLock();
    },

    // Nombre flotando encima de los demás jugadores humanos
    nameTag(c) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const x = cv.getContext('2d');
      x.font = 'bold 34px Rubik, Arial';
      x.textAlign = 'center';
      x.lineWidth = 6;
      x.strokeStyle = 'rgba(0,0,0,0.75)';
      x.strokeText(c.name, 128, 44);
      x.fillStyle = '#ffe27a';
      x.fillText(c.name, 128, 44);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      s.scale.set(2.4, 0.6, 1);
      s.position.y = 2.45;
      c.model.root.add(s);
    },

    // Pantalla de carga (multijugador: mientras todos generan la isla)
    showLoading(text) {
      ['menu', 'end', 'pause', 'click-to-play'].forEach((id) => $(id).classList.add('hidden'));
      for (const ch of this.characters) this.scene.remove(ch.model.root);
      this.characters = [];
      G.HUD.show(false);
      this.state = 'loading';
      this.setLoadingText(text);
      $('loading').classList.remove('hidden');
    },
    setLoadingText(text) { $('loading-text').textContent = text; },

    // El anfitrión sigue moviendo la partida aunque cambie de pestaña (sin dibujar)
    backgroundTick() {
      if (this.state !== 'playing') return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const steps = Math.ceil(dt / (1 / 30));
      for (let i = 0; i < steps; i++) this.update(dt / steps, i === steps - 1);
      G.Destruct.flush();
    },

    toMenu(fromNet) {
      if (!fromNet && G.Net.isHost) G.Net.abortMatch();
      // un invitado que se va en mitad de la partida cuenta como eliminado
      if (!fromNet && G.Net.isClient && G.Net.inMatch && this.player && this.player.alive) G.Net.sendHost({ t: 'ev', e: [['dead', -1, -1, 'left']] });
      // salir de una partida a medias (ya fuera del autobús) cuenta como eliminado para el rango
      if (!fromNet && this.state === 'playing' && !this.rewarded && this.player && this.player.alive && this.player.mode !== 'bus') {
        this.rewarded = true;
        this.stats.timeAlive = this.time;
        const left = this.aliveCount();      // si sólo quedas tú, es que habías ganado
        this.recordMatch(left === 1, left);
      }
      G.Net.inMatch = false;
      this.state = 'menu';
      this.paused = false;
      this.spectating = false;
      this.viewTarget = null;
      for (const ch of this.characters) this.scene.remove(ch.model.root);
      this.characters = [];
      G.Loot.reset();
      G.Build.reset();
      G.Effects.clear();
      G.Bus.hide();
      G.Vehicles.reset();
      G.Audio.engineStop();
      G.Storm.wall.visible = false;
      G.HUD.show(false);
      ['end', 'pause', 'click-to-play', 'lock-help'].forEach((id) => $(id).classList.add('hidden'));
      $('loading').classList.add('hidden');
      $('menu').classList.remove('hidden');
      G.Net.ui.refresh();
      G.Input.unlock();
    },

    jumpFromBus(ch) {
      if (ch.mode !== 'bus') return;
      ch.mode = 'dive';
      const side = new THREE.Vector3(-G.Bus.dir.z, 0, G.Bus.dir.x);
      ch.pos.copy(G.Bus.pos).addScaledVector(side, U.rand(-1.5, 1.5));
      ch.pos.y -= 2.5;
      ch.vel.copy(G.Bus.dir).multiplyScalar(C.bus.speed * 0.35);
      ch.vel.y = -6;
      ch.diveT = 0;
      if (ch.isPlayer) {
        G.Audio.whoosh();
        ch.pitch = -0.5;
      }
    },

    aliveCount() {
      let n = 0;
      for (const c of this.characters) if (c.alive) n++;
      return n;
    },

    onKill(target, attacker, weapon, kind) {
      const me = this.player;
      const wn = weapon ? ' <span class="wp">(' + G.Combat.label(weapon) + ')</span>' : '';
      const nm = (c) => (c === me ? '<b class="me">Tú</b>' : '<b>' + c.name + '</b>');
      let html;
      if (kind === 'left') html = nm(target) + ' ha salido de la partida';
      else if (kind === 'fall') html = nm(target) + (target === me ? ' te has estrellado contra el suelo' : ' se ha estrellado contra el suelo');
      else if (kind === 'storm' || !attacker) html = nm(target) + ' ha caído en la tormenta';
      else if (attacker === me) html = '<b class="me">Tú</b> has eliminado a ' + nm(target) + wn;
      else if (target === me) html = nm(attacker) + ' te ha eliminado' + wn;
      else html = nm(attacker) + ' ha eliminado a ' + nm(target) + wn;
      G.HUD.killfeed(html, attacker === me || target === me);

      if (attacker === me && target !== me) {
        this.stats.killsAt.push(this.aliveCount());   // para el rango: una baja vale más cuanta menos gente queda
        G.Audio.kill();
        G.HUD.toast('Has eliminado a ' + target.name + ' · quedan ' + this.aliveCount());
      }
      if (target === me) {
        this.stats.placement = this.aliveCount() + 1;
        this.stats.timeAlive = this.time;
        this.stats.killer = attacker && attacker !== me ? attacker.name : null;
        this.viewTarget = attacker && attacker.alive ? attacker : null;
        G.HUD.setBigMap(false);
        G.HUD.closeInventory(true);
        G.Build.showGhost(null);
        setTimeout(() => this.showEnd(false), 2200);
      }
      if (G.Net.isClient) return;    // el ganador lo decide el anfitrión
      if (this.aliveCount() === 1) {
        const winner = this.characters.find((c) => c.alive);
        if (winner) G.Net.winner(winner);
        if (winner === me) {
          this.stats.placement = 1;
          this.stats.timeAlive = this.time;
          setTimeout(() => this.showEnd(true), 1500);
        } else if (winner && !me.alive) {
          G.HUD.toast('¡' + winner.name + ' ha ganado la partida!');
        }
      }
    },

    showEnd(win) {
      if (this.endShown && !win) return;
      if (this.state !== 'playing' && this.state !== 'ended') return;
      this.endShown = true;
      const me = this.player, st = this.stats;
      const total = this.characters.length;
      const t = $('end-title');
      t.textContent = win ? '¡VICTORIA!' : 'ELIMINADO';
      t.className = win ? 'win' : '';
      $('end-sub').textContent = win ? '¡Eres el último en pie de ' + total + ' jugadores!'
        : 'Puesto #' + st.placement + ' de ' + total + (st.killer ? ' · te eliminó ' + st.killer : ' · la tormenta te atrapó');
      const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
      // monedas para la tienda (una vez por partida)
      if (!this.rewarded) {
        this.rewarded = true;
        this.rankResult = this.recordMatch(win, st.placement || total);
        this.coinsWon = G.Shop.reward(win, st.placement || total, total, me.kills);
      }
      $('end-stats').innerHTML =
        G.Account.endHtml(this.rankResult) +
        '<div class="coins-won"><b>+' + this.coinsWon + ' 🪙</b>monedas para la tienda (tienes ' + G.Shop.state.coins + ')</div>' +
        '<div><b>' + me.kills + '</b>Eliminaciones</div>' +
        '<div><b>' + Math.round(me.damageDone) + '</b>Daño causado</div>' +
        '<div><b>' + st.chests + '</b>Cofres abiertos</div>' +
        '<div><b>' + acc + '%</b>Precisión</div>' +
        '<div><b>' + U.formatTime(st.timeAlive) + '</b>Tiempo vivo</div>' +
        '<div><b>' + st.weapons + '</b>Armas recogidas</div>';
      $('btn-spectate').style.display = win || this.aliveCount() < 2 ? 'none' : 'block';
      // en multijugador sólo el anfitrión puede empezar otra partida
      $('btn-again').style.display = G.Net.isClient ? 'none' : '';
      $('end-net').textContent = G.Net.isClient ? 'Cuando el anfitrión empiece otra partida, entrarás automáticamente.' : G.Net.isHost ? 'Al pulsar "Jugar otra vez" empieza otra partida para todos.' : '';
      $('end').classList.remove('hidden');
      $('pause').classList.add('hidden');
      if (win) this.state = 'ended';
      G.Input.unlock();
    },

    // Estadísticas y rango de la partida (en la cuenta del jugador, si tiene)
    recordMatch(win, placement) {
      const me = this.player;
      const hs = G.Net.isClient && G.Net.hostSettings;   // de invitado, la dificultad la elige el anfitrión
      return G.Account.recordMatch({
        win, placement, total: this.characters.length, kills: me.kills, killsAt: this.stats.killsAt,
        damage: me.damageDone, timeAlive: this.stats.timeAlive || this.time,
        diff: (hs && hs.diff) || G.SETTINGS.difficulty,
      });
    },

    cycleSpectate() {
      const alive = this.characters.filter((c) => c.alive && c !== this.player);
      if (!alive.length) return;
      const i = alive.indexOf(this.viewTarget);
      this.viewTarget = alive[(i + 1) % alive.length];
    },

    /* ---------- Bucle ---------- */
    frame() {
      const now = performance.now();
      const rawDt = (now - this.last) / 1000;
      const dt = Math.min(0.05, rawDt);
      this.last = now;
      // reloj de las animaciones del mundo (olas del mar y árboles moviéndose con el viento)
      if (G.World.timeU) G.World.timeU.value = (now / 1000) % 10000;
      if (this.state === 'playing' && (!this.paused || G.Net.inMatch)) {
        // en multijugador el mundo no se para: con la pausa sólo dejamos de leer el teclado
        if (this.paused) { const I = G.Input; I.keys = {}; I.pressed = {}; I.buttons = [false, false, false]; I.clicked = [false, false, false]; I.mdx = I.mdy = 0; }
        // varios pasos pequeños para que la física sea estable aunque vaya a pocos FPS
        const steps = Math.min(3, Math.ceil(dt / (1 / 60)));
        const sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
          this.update(sdt, i === steps - 1);
          if (i === 0) { G.Input.mdx = 0; G.Input.mdy = 0; }
        }
        this.autoResolution(rawDt);
      } else if (this.state === 'menu' || this.state === 'loading') {
        this.menuCamera(now / 1000);
      } else if (this.state === 'ended') {
        this.time += dt;
        G.Effects.update(dt);
        for (const ch of this.characters) ch.updateModel(dt, true);
        G.Loot.update(dt, this.camera.position, this.time);
      }
      G.Destruct.flush();
      G.Storm.updateAtmosphere(dt);
      this.updateSun();
      this.render();
      if (this.state === 'playing' || this.state === 'ended') G.HUD.update(dt, this.camera);
      G.Input.endFrame();
    },

    // Resolución automática: si van pocos FPS se baja un poco la resolución (y se sube si sobra)
    autoResolution(rawDt) {
      this.fpsT += rawDt;
      this.fpsN++;
      if (this.fpsT < 1) return;
      const fps = Math.round(this.fpsN / this.fpsT);
      this.fpsT = 0; this.fpsN = 0;
      G.HUD.setFps(fps);
      if (!G.SETTINGS.autoRes || document.hidden) return;
      const q = this.quality;
      let s = this.renderScale;
      if (fps < 40) this.fpsLow++; else this.fpsLow = 0;
      if (this.fpsLow >= 2 && s > q.minScale) { s = Math.max(q.minScale, s - 0.1); this.fpsLow = 0; }
      else if (fps >= 57 && s < q.scale) s = Math.min(q.scale, s + 0.05);
      if (Math.abs(s - this.renderScale) > 0.001) {
        this.renderScale = s;
        this.renderer.setPixelRatio(this.basePR * s);
      }
    },

    update(dt, lastStep) {
      this.time += dt;
      const me = this.player, I = G.Input;
      G.Bus.update(dt);

      if (me.mode === 'bus') {
        const sens = 0.0022 * G.SETTINGS.sensitivity;
        me.yaw -= I.mdx * sens;
        me.pitch = U.clamp(me.pitch - I.mdy * sens, -1.2, 0.6);
        if (I.hit('Space') && G.Bus.canJump) {
          this.jumpFromBus(me);
          I.pressed.Space = false;   // ¡que el mismo ESPACIO no abra también el planeador!
        }
      }
      if (me.mode !== 'bus') {
        if (me.alive) G.PlayerCtl.update(dt, this.camera);
        else me.updateTimers(dt);
      }
      // las teclas pulsadas sólo cuentan en el primer subpaso
      I.pressed = {};
      I.clicked = [false, false, false];
      I.wheel = 0;

      G.Bots.update(dt);
      G.Combat.update(dt);    // balas de las ráfagas y misiles en vuelo
      G.Net.update(dt);
      G.Vehicles.update(dt);
      for (const ch of this.characters) if (ch.mode === 'bus') ch.pos.copy(G.Bus.pos);
      this.separate();
      G.Storm.update(dt);
      G.Build.update(dt);

      if (lastStep) {
        G.Loot.update(dt, this.camera.position, this.time);
        G.Effects.update(dt);
        // los personajes muy lejanos no se dibujan (serían un punto)
        const far2 = this.quality.chars * this.quality.chars;
        const lod2 = this.quality.lod * this.quality.lod;
        const cp = this.camera.position;
        for (const ch of this.characters) {
          if (ch === me) ch.updateModel(dt, !me.alive || G.PlayerCtl.selfVisible !== false, false);
          else {
            const d2 = ch.pos.distanceToSquared(cp);
            ch.updateModel(dt, d2 < far2, d2 > lod2);
          }
        }
        this.updateCamera(dt);
      }
    },

    // Los personajes no se pueden atravesar entre sí: si dos se solapan, se empujan un poco
    separate() {
      const cs = this.characters, n = cs.length, R = 0.75;
      for (let i = 0; i < n; i++) {
        const a = cs[i];
        if (!a.alive || a.mode !== 'ground' || a.vehicle) continue;
        for (let j = i + 1; j < n; j++) {
          const b = cs[j];
          if (!b.alive || b.mode !== 'ground' || b.vehicle) continue;
          const dx = b.pos.x - a.pos.x;
          if (dx > R || dx < -R) continue;
          const dz = b.pos.z - a.pos.z;
          if (dz > R || dz < -R || Math.abs(b.pos.y - a.pos.y) > 1.6) continue;
          const d = Math.hypot(dx, dz);
          if (d >= R) continue;
          // a los que mueve la red no los empujamos nosotros
          const fa = a.puppet || a.remote, fb = b.puppet || b.remote;
          if (fa && fb) continue;
          const push = (R - d) * (fa || fb ? 1 : 0.5);
          const nx = d > 1e-4 ? dx / d : Math.cos(i * 7.1), nz = d > 1e-4 ? dz / d : Math.sin(i * 7.1);
          if (!fa) { a.pos.x -= nx * push; a.pos.z -= nz * push; }
          if (!fb) { b.pos.x += nx * push; b.pos.z += nz * push; }
        }
      }
    },

    updateCamera(dt) {
      const me = this.player, cam = this.camera;
      let L = me;
      if (me.mode === 'bus') {
        _f.set(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
        cam.position.copy(G.Bus.pos).addScaledVector(_f, -30);
        cam.position.y += 7;
        cam.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
        if (cam.fov !== 75) { cam.fov = 75; cam.updateProjectionMatrix(); }
        G.PlayerCtl.vmHolder.visible = false;
      } else if (!me.alive) {
        const t = this.viewTarget && this.viewTarget.alive ? this.viewTarget : null;
        if (t) {
          L = t;
          _f.set(-Math.sin(t.yaw), 0, -Math.cos(t.yaw));
          _v.set(t.pos.x, t.pos.y + 2.2, t.pos.z).addScaledVector(_f, -4.5);
          cam.position.lerp(_v, Math.min(1, dt * 6));
          cam.lookAt(t.pos.x, t.pos.y + 1.4, t.pos.z);
        } else {
          const a = this.time * 0.3;
          cam.position.set(me.pos.x + Math.sin(a) * 8, me.pos.y + 5, me.pos.z + Math.cos(a) * 8);
          cam.lookAt(me.pos.x, me.pos.y + 0.5, me.pos.z);
        }
        if (cam.fov !== 75) { cam.fov = 75; cam.updateProjectionMatrix(); }
        G.PlayerCtl.vmHolder.visible = false;
      }
      this.listener.pos.copy(L.mode === 'bus' ? G.Bus.pos : L.pos);
      this.listener.yaw = L.yaw;
    },

    menuCamera(t) {
      const a = t * 0.05;
      this.camera.position.set(Math.cos(a) * 330, 150, Math.sin(a) * 330);
      this.camera.lookAt(0, 20, 0);
      if (this.camera.fov !== 60) { this.camera.fov = 60; this.camera.updateProjectionMatrix(); }
    },

    updateSun() {
      const c = this.camera.position;
      const fx = Math.round(c.x / 4) * 4, fz = Math.round(c.z / 4) * 4;
      const fy = Math.max(0, Math.min(c.y, 120));
      this.sun.target.position.set(fx, fy - 10, fz);
      this.sun.position.set(fx + this.sunOffset.x, fy + this.sunOffset.y, fz + this.sunOffset.z);
      if (G.World.sky) G.World.sky.position.copy(c);
      // la sombra se recalcula una de cada dos imágenes (casi no se nota y ahorra mucho)
      this.frameN++;
      if (this.shadowsOn && this.frameN % 2 === 0) this.renderer.shadowMap.needsUpdate = true;
    },

    render() {
      const r = this.renderer;
      r.clear();
      r.render(this.scene, this.camera);
      if (this.state === 'playing' && G.PlayerCtl.vmHolder && G.PlayerCtl.vmHolder.visible) {
        r.clearDepth();
        r.render(this.vmScene, this.camera);
      }
    },
  });

  window.addEventListener('load', () => {
    try { Game.init(); }
    catch (e) {
      console.error(e);
      document.getElementById('loading-text').textContent = 'Error al iniciar: ' + e.message + ' (¿tu navegador soporta WebGL?)';
    }
  });
})();

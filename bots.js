/* =====================================================================
   bots.js — Inteligencia artificial de los bots.
   Cada bot: elige dónde saltar del autobús, planea hasta allí,
   busca botín y cofres, pica árboles y rocas para tener materiales,
   huye de la tormenta, va hacia los disparos que oye y pelea con quien
   vea (contigo o con otros bots). Sabe construir: un muro para cubrirse
   si le disparan, rampas para subir hasta un enemigo, una "caja" de
   paredes para curarse a salvo y una rampa si se atasca en un desnivel.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  const _eye = new THREE.Vector3(), _dir = new THREE.Vector3();
  const _rayOut = { box: null };
  const _candC = [null, null, null, null], _candD = [0, 0, 0, 0];
  const _mv = { x: 0, z: 0, d: 0 }, _fr = { wx: 0, wz: 0, jump: false, speed: 0 };
  const _boxes = [];
  const QUARTER = Math.PI / 2;
  // lo que los bots pican para sacar materiales (cosas sueltas: nada de paredes ni tejados)
  const FARM = new Set(['Árbol', 'Árbol gigante', 'Palmera', 'Roca', 'Caja', 'Troncos', 'Paca de paja', 'Banco', 'Cactus', 'Seto', 'Tumbona',
    'Barril', 'Coche', 'Contenedor', 'Bloque de hormigón', 'Papelera', 'Boca de incendio', 'Abrevadero', 'Puesto']);

  class Brain {
    constructor(bot) {
      this.bot = bot;
      this.thinkT = Math.random() * 0.3;
      this.path = [];
      this.pathI = 0;
      this.goal = null;
      this.target = null;
      this.targetVisible = false;
      this.lastSeenT = -99;
      this.lastSeen = new THREE.Vector3();
      this.reactT = 0;
      this.aimHead = false;
      this.strafe = 1;
      this.strafeT = 0;
      this.progT = 0;
      this.progPos = new THREE.Vector3();
      this.stuck = 0;
      this.giveUp = 0;
      this.burst = 0;
      this.burstPause = 0;
      this.suspect = null;
      this.suspectT = 0;
      this.drop = null;
      this.jumpAt = 0;
      this.band = -1;
      this.aimErrX = 0; this.aimErrY = 0; this.aimErrT = 0;
      this.breakT = 0;
      this.breakBox = null;
      // construir
      this.buildCd = 0;        // espera entre piezas
      this.rampN = 0;          // rampas que le quedan por poner (subiendo hacia un enemigo)
      this.rampYaw = 0;
      this.rampFail = 0;
      this.boxCd = 0;          // espera entre "cajas" de paredes
      this.coverFrom = null;   // quien le dispara (para ponerse un muro delante)
      this.coverT = 0;
      // oír disparos e ir a buscar pelea
      this.heard = new THREE.Vector3();
      this.heardT = -99;
      this.huntT = 0;
      // rodear un obstáculo (un paso de lado)
      this.detourT = 0; this.detourX = 0; this.detourZ = 0;
      // bot "tranquilo": no busca pelea con otros bots hasta la 3.ª zona (sólo se defiende)
      this.calm = Math.random() < G.BOT_TUNING.calmBots;
    }

    get diff() { return G.DIFFICULTY[G.SETTINGS.difficulty] || G.DIFFICULTY.normal; }

    /* ---------- Autobús: elegir dónde caer ---------- */
    planDrop() {
      const W = G.World, Bus = G.Bus, T = G.BOT_TUNING, Bs = G.Bots;
      let x, z;
      // de varios sitios posibles, el que esté más lejos de donde van a caer los demás bots
      const farthest = (cands) => {
        let best = null, bd = -1;
        for (const c of cands) { const d = Bs.nearestDrop(c.x, c.z); if (d > bd) { bd = d; best = c; } }
        return best;
      };
      if (Math.random() < T.randomDrop) {
        // un sitio suelto de la isla
        const outs = W.lootSpots.filter((s) => !s.indoor && !s.roof);
        const s = farthest(Array.from({ length: 10 }, () => U.pick(outs)));
        x = s.x; z = s.z;
      } else {
        // un pueblo según su peso, pero cada pueblo tiene un "cupo" de bots para que no se amontonen
        const pois = W.pois, sumW = pois.reduce((a, p) => a + p.weight, 0);
        const total = Bs.list.length * (1 - T.randomDrop);
        let poi = null;
        for (let i = 0; i < 12; i++) {
          poi = pois[U.weighted(pois.map((p) => p.weight))];
          if ((Bs.dropCounts.get(poi) || 0) < Math.max(2, Math.ceil((total * poi.weight) / sumW * 1.15))) break;
        }
        Bs.dropCounts.set(poi, (Bs.dropCounts.get(poi) || 0) + 1);
        const nodes = G.Nav.nodes.filter((n) => n.outdoor && Math.hypot(n.x - poi.x, n.z - poi.z) < poi.r + 12);
        if (nodes.length) { const n = farthest(Array.from({ length: 6 }, () => U.pick(nodes))); x = n.x + U.rand(-2, 2); z = n.z + U.rand(-2, 2); }
        else { x = poi.x + U.rand(-10, 10); z = poi.z + U.rand(-10, 10); }
      }
      this.drop = { x, z };
      Bs.drops.push(this.drop);
      const s = Bus.project(x, z);
      this.jumpAt = U.clamp(s - U.rand(30, 110), Bus.sEnter + U.rand(0, 30), Bus.sExit - 15);
    }

    /* ---------- Bucle principal del bot ---------- */
    update(dt) {
      const b = this.bot;
      if (!b.alive) return;
      if (b.mode === 'bus') {
        if (G.Bus.canJump && G.Bus.s >= this.jumpAt) G.Game.jumpFromBus(b);
      } else if (b.mode === 'dive' || b.mode === 'glide') {
        const dx = this.drop.x - b.pos.x, dz = this.drop.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        let wx = d > 0.5 ? dx / d : 0, wz = d > 0.5 ? dz / d : 0;
        if (d < 8) { wx *= d / 8; wz *= d / 8; }
        const dive = d < 110;
        b.airMove(dt, wx, wz, dive);
        if (d > 1) b.yaw = Math.atan2(-dx, -dz);
        b.pitch = 0;
      } else if (b.mode === 'ground') {
        if (this.landT === undefined) this.landT = G.Game.time;   // cuándo ha aterrizado
        this.ground(dt);
      }
      b.updateTimers(dt);
    }

    ground(dt) {
      const b = this.bot, time = G.Game.time;
      this.thinkT -= dt;
      this.reactT -= dt;
      this.suspectT -= dt;
      this.buildCd -= dt;
      this.boxCd -= dt;
      this.detourT -= dt;
      if (this.thinkT <= 0) { this.thinkT = 0.22 + Math.random() * 0.1; this.think(); }

      let wx = 0, wz = 0, speed = C.player.walk, jump = false;
      b.crouch = false;
      b.ads = false;

      // le acaban de disparar: un muro delante (si no hay ya algo que le cubra)
      if (this.coverFrom && time < this.coverT) this.buildCover();

      const t = this.target;
      // sin armas sólo pelea a pico si lo tiene encima o le acaban de atacar
      const close = t && t.alive && (b.pos.distanceTo(t.pos) < 2.4 || (b.lastHitBy === t && time - b.lastDamageT < 3 && b.pos.distanceTo(t.pos) < 8));
      const fighting = t && t.alive && (this.targetVisible || time - this.lastSeenT < 2.0) && (b.hasUsableWeapon() || close);
      if (this.breakT > 0 && !fighting) {
        // romper con el pico lo que nos bloquea (una pared construida) o picar para sacar materiales
        this.breakObstacle(dt);
        b.groundMove(dt, 0, 0, 0, false);
        this.pickupNear(dt);
        return;
      }
      if (this.rampN > 0) {
        // subiendo con rampas hacia un enemigo que está más alto
        const r = this.rampRush();
        wx = r.wx; wz = r.wz; jump = r.jump; speed = r.speed;
        if (fighting && this.targetVisible) this.aimAndShoot(dt);
      } else if (fighting) {
        const r = this.fight(dt);
        wx = r.wx; wz = r.wz; jump = r.jump; speed = r.speed;
      } else {
        if (b.useT > 0) { b.crouch = true; speed = 0; }
        const mv = this.followPath();
        if (mv) {
          wx = mv.x; wz = mv.z;
          // correr en los trayectos largos (y siempre si la tormenta está cerca)
          const g = this.goal, left = g ? Math.hypot(g.pos.x - b.pos.x, g.pos.z - b.pos.z) : 0;
          const hurry = left > 18 || (g && g.type === 'storm');
          if (hurry && b.useT <= 0 && b.canSprint() && b.stamina > 15) speed = C.player.sprint * 0.97;
          else if (b.tired) speed = Math.min(speed, C.player.tiredSpeed);
        }
        if (this.detourT > 0 && (wx || wz)) {
          // rodeando un obstáculo: un paso de lado
          wx = wx * 0.3 + this.detourX; wz = wz * 0.3 + this.detourZ;
          const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l;
        }
        // mirar hacia donde camina, o hacia un ruido
        let wantYaw = b.yaw;
        if (this.suspect && this.suspectT > 0 && this.suspect.alive) {
          wantYaw = Math.atan2(-(this.suspect.pos.x - b.pos.x), -(this.suspect.pos.z - b.pos.z));
        } else if (wx || wz) wantYaw = Math.atan2(-wx, -wz);
        b.yaw += U.clamp(U.angleDiff(b.yaw, wantYaw), -7 * dt, 7 * dt);
        b.pitch += (0 - b.pitch) * Math.min(1, dt * 4);
        if (b.weapon && b.weapon.mag < b.weapon.def.mag && b.reloadT <= 0 && b.ammo[b.weapon.def.ammo] > 0) b.startReload();
      }

      // ¿atascado? Saltar, dar un paso de lado, romper lo que estorba o poner una rampa; si no, otro camino
      this.progT += dt;
      if (this.progT > 0.8) {
        const moved = Math.hypot(b.pos.x - this.progPos.x, b.pos.z - this.progPos.z);
        if ((wx || wz) && speed > 0 && moved < 0.7 && this.rampN <= 0) {
          this.stuck++;
          jump = true;
          const wb = b.wallBox;
          if (this.stuck === 2) {
            const s = Math.random() < 0.5 ? -1 : 1, l = Math.hypot(wx, wz) || 1;
            this.detourX = (-wz / l) * s; this.detourZ = (wx / l) * s; this.detourT = 0.9;
          }
          if (this.stuck >= 3 && wb && !wb.dead && wb.g && wb.g.alive) { this.breakBox = wb; this.breakT = 6; }
          else if (this.stuck === 3 && this.canBuild(10) && Math.random() < this.diff.build + 0.3) {
            // un escalón o un muro que no se rompe: rampa hacia donde vamos
            this.tryBuild('ramp', Math.atan2(-wx, -wz), -0.5);
          }
          if (this.stuck === 4 && this.goal) this.repath();
          if (this.stuck >= 6) { this.goal = null; this.path = []; this.stuck = 0; this.giveUp = time + 3; }
        } else this.stuck = 0;
        this.progPos.copy(b.pos);
        this.progT = 0;
      }

      b.updateStamina(dt, speed > C.player.walk + 0.5 && b.moving);
      b.groundMove(dt, wx, wz, speed, jump);
      this.pickupNear(dt);
      this.checkGoal();
    }

    // Recoger munición/materiales cercanos (cada 0,15 s: con 100 bots ahorra mucho)
    pickupNear(dt) {
      this.pickT = (this.pickT || 0) - dt;
      if (this.pickT > 0) return;
      this.pickT = 0.15;
      this.bot.autoPickup();
    }

    /* ---------- Pensar (4 veces por segundo) ---------- */
    think() {
      const b = this.bot, time = G.Game.time;
      this.perceive();

      if (this.target && this.target.alive && this.targetVisible && (b.hasUsableWeapon() || b.pos.distanceTo(this.target.pos) < 2.4 || b.lastHitBy === this.target)) {
        this.chooseWeapon(b.pos.distanceTo(this.target.pos));
        this.combatBuild();
        return;
      }
      if (this.target && (!this.target.alive || time - this.lastSeenT > 2.0)) {
        // ir a mirar dónde lo vimos por última vez
        if (this.target.alive && b.pos.distanceTo(this.lastSeen) < 60 && b.hasUsableWeapon()) {
          this.setGoal({ type: 'point', pos: this.lastSeen.clone() });
        }
        this.target = null;
      }

      // tormenta
      const safe = G.Storm.safeCircleFor(b);
      const dC = Math.hypot(b.pos.x - safe.x, b.pos.z - safe.z);
      if (dC > safe.r * 0.92) {
        if (!this.goal || this.goal.type !== 'storm' || this.goal.r !== safe.r) {
          const ang = Math.atan2(b.pos.z - safe.z, b.pos.x - safe.x) + U.rand(-0.5, 0.5);
          const rr = safe.r * U.rand(0.2, 0.55);
          const gx = safe.x + Math.cos(ang) * rr, gz = safe.z + Math.sin(ang) * rr;
          this.setGoal({ type: 'storm', r: safe.r, pos: new THREE.Vector3(gx, G.Phys.heightAt(gx, gz), gz) });
        }
        this.smoothPath();
        return;
      }

      // curarse si estamos tranquilos (botiquín para la vida, poción para el escudo)
      if (b.useT > 0) return;
      // (no se cura si acaba de ver a un enemigo: así no alterna arma y cura sin parar)
      if (time - b.lastDamageT > 3 && time - this.lastSeenT > 4) {
        const mk = b.findCons('medkit'), po = b.findCons('potion');
        let use = -1;
        if (b.health < 65 && mk >= 0) use = mk;
        else if (b.shield <= 50 && po >= 0) use = po;
        if (use >= 0) {
          // antes de curarse, una "caja" de paredes alrededor (si hay materiales)
          if (this.boxCd <= 0 && this.canBuild(40) && Math.random() < this.diff.build) this.boxUp();
          b.selectSlot(use);
          if (b.startUse()) return;
        }
      }

      this.smoothPath();
      // buscar botín
      if (!this.goal || this.goal.type === 'point' || this.goal.type === 'wander' || this.goal.type === 'hunt') {
        const loot = this.findLoot();
        if (loot) { this.setGoal(loot); return; }
      }
      // sin materiales: a picar algo cercano (árboles, rocas, cajas, coches...)
      if ((!this.goal || this.goal.type === 'wander') && this.matTotal() < 120 && time > (this.farmUntil || 0)) {
        const f = this.findFarm();
        if (f) { this.setGoal(f); return; }
        this.farmUntil = time + 6;   // no hay nada cerca: ya mirará más tarde
      }
      // ir hacia los disparos que oye o, en las últimas zonas, a buscar a otros jugadores
      if (this.hunt(safe)) return;
      // en las zonas finales, a veces se protege con una caja de paredes
      if (!this.goal && G.Storm.phase >= 4 && this.boxCd <= 0 && this.canBuild(50) && Math.random() < 0.25 * this.diff.build) { this.boxUp(); return; }
      if (!this.goal && time > this.giveUp) this.wander(safe);
    }

    perceive() {
      const b = this.bot, time = G.Game.time, T = G.BOT_TUNING;
      b.eye(_eye);
      const range = b.slots.some((w) => w && w.kind === 'weapon' && w.type === 'sniper') ? 130 : 80;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      const calm = this.calm && G.Storm.phase < 3;
      const landed = this.landT === undefined ? 0 : time - this.landT;
      let found = null, checks = 0;
      // el objetivo actual primero
      this.blockedByBuild = false;
      if (this.target && this.target.alive) {
        const c = this.target;
        if (G.Phys.lineClear(_eye.x, _eye.y, _eye.z, c.pos.x, c.pos.y + 1.2, c.pos.z, true)) found = c;
        else {
          // ¿lo tapa una construcción? (entonces merece la pena disparar para romperla)
          _dir.set(c.pos.x - _eye.x, c.pos.y + 1.2 - _eye.y, c.pos.z - _eye.z);
          const len = _dir.length();
          _dir.divideScalar(len);
          const t = G.Phys.raycastBoxes(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, len, _rayOut);
          this.blockedByBuild = t >= 0 && _rayOut.box && _rayOut.box.build;
        }
        checks++;
      }
      if (!found) {
        // los (como mucho) 4 más cercanos que "nota" (delante, muy cerca o que le han atacado).
        // Sin crear objetos nuevos: con 100 bots esto se hace cientos de veces por segundo.
        const max = 4 - checks;
        let n = 0;
        const chars = G.Game.characters;
        for (let i = 0; i < chars.length; i++) {
          const c = chars[i];
          if (c === b || c === this.target || !c.alive || c.mode === 'bus' || c.mode === 'dead') continue;
          const dx = c.pos.x - b.pos.x, dz = c.pos.z - b.pos.z;
          if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
          const d = Math.hypot(dx, dz, c.pos.y - b.pos.y);
          if (d > range) continue;
          const facing = (dx * fx + dz * fz) / (d || 1);
          if (!(d < 12 || facing > -0.25 || c === this.suspect || c === b.lastHitBy)) continue;
          // otros bots: nada más aterrizar sólo les responde si le atacan (y los "tranquilos", hasta la 3.ª zona)
          if (c.brain && c !== b.lastHitBy) {
            if (calm || d > T.botRange) continue;
            if (landed < T.lootTime && !(b.hasUsableWeapon() && d < 25)) continue;
          }
          // insertar ordenado en la lista corta
          let k = Math.min(n, max - 1);
          if (n >= max && d >= _candD[max - 1]) continue;
          while (k > 0 && _candD[k - 1] > d) { _candD[k] = _candD[k - 1]; _candC[k] = _candC[k - 1]; k--; }
          _candD[k] = d; _candC[k] = c;
          if (n < max) n++;
        }
        for (let i = 0; !found && i < n; i++) {
          const c = _candC[i];
          if (G.Phys.lineClear(_eye.x, _eye.y, _eye.z, c.pos.x, c.pos.y + 1.2, c.pos.z, true)) found = c;
        }
        for (let i = 0; i < n; i++) _candC[i] = null;
      }
      if (found) {
        if (found !== this.target) {
          this.target = found;
          const R = this.diff.reaction;
          this.reactT = U.rand(R[0], R[1]) * (found.brain ? T.botReact : 1);
          this.aimHead = Math.random() < this.diff.headChance;
          this.goal = null; this.path = [];
        }
        this.targetVisible = true;
        this.lastSeen.copy(found.pos);
        this.lastSeenT = time;
      } else {
        this.targetVisible = false;
      }
    }

    chooseWeapon(dist) {
      const b = this.bot;
      const band = dist < 11 ? 0 : dist < 50 ? 1 : 2;
      const cur = b.weapon;
      const usable = (w) => w && w.kind === 'weapon' && (w.mag > 0 || b.ammo[w.def.ammo] > 0);
      if (band === this.band && usable(cur)) return;
      this.band = band;
      // (el lanzamisiles, nunca de cerca: la explosión también le haría daño a él)
      const order = band === 0 ? ['shotgun', 'tactical', 'rifle', 'burst', 'pistol', 'sniper']
        : band === 1 ? ['rifle', 'burst', 'rocket', 'pistol', 'tactical', 'shotgun', 'sniper'] : ['sniper', 'rocket', 'rifle', 'burst', 'pistol', 'tactical', 'shotgun'];
      for (const type of order) {
        const idx = b.slots.findIndex((w) => w && w.kind === 'weapon' && w.type === type && usable(w));
        if (idx >= 0) { if (idx !== b.sel) b.selectSlot(idx); return; }
      }
      // un arma que no está en la lista (de las nuevas): cualquiera con munición
      const any = b.slots.findIndex((w) => usable(w) && !(w.type === 'rocket' && band === 0));
      if (any >= 0) { if (any !== b.sel) b.selectSlot(any); return; }
      if (b.sel !== -1) b.selectSlot(-1); // sin armas: el pico
    }

    // Golpear con el pico una caja (lo que nos bloquea, o algo para sacar materiales)
    breakObstacle(dt) {
      const b = this.bot, box = this.breakBox;
      this.breakT -= dt;
      if (!box || box.dead || !box.g || !box.g.alive || this.breakT <= 0) { this.breakT = 0; this.breakBox = null; this.stuck = 0; this.repath(); return; }
      if (b.sel !== -1) b.selectSlot(-1);
      b.eye(_eye);
      const cx = U.clamp(_eye.x, box.x0, box.x1), cy = U.clamp(_eye.y - 0.3, box.y0, box.y1), cz = U.clamp(_eye.z, box.z0, box.z1);
      const dx = cx - _eye.x, dy = cy - _eye.y, dz = cz - _eye.z;
      b.yaw = Math.atan2(-dx, -dz);
      b.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      _dir.set(dx, dy, dz).normalize();
      G.Combat.tryFire(b, _eye, _dir, true, 0);
      // picando para sacar materiales: con bastantes, a otra cosa
      if (this.farming && this.matTotal() >= 200) this.breakT = 0;
    }

    /* ---------- Combate ---------- */
    // Apuntar al objetivo y disparar (también mientras sube con rampas)
    aimAndShoot(dt) {
      const b = this.bot, t = this.target, D = this.diff;
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dz) || 0.01;
      const w = b.weapon;
      b.eye(_eye);
      const ty = t.pos.y + (t.crouch ? 0.85 : this.aimHead ? 1.6 : 1.15);
      // error de puntería que cambia poco a poco (parece más humano)
      this.aimErrT -= dt;
      if (this.aimErrT <= 0) {
        this.aimErrT = U.rand(0.15, 0.4);
        const e = D.aimError * (t.moving ? 1.3 : 1) * (b.moving ? 1.2 : 1) * (t.brain ? G.BOT_TUNING.botAim : 1);
        this.aimErrX = (Math.random() * 2 - 1) * e;
        this.aimErrY = (Math.random() * 2 - 1) * e * 0.7;
      }
      const wantYaw = Math.atan2(-dx, -dz) + this.aimErrX;
      const wantPitch = Math.atan2(ty - _eye.y, dist) + this.aimErrY;
      const turn = D.turn * dt;
      b.yaw += U.clamp(U.angleDiff(b.yaw, wantYaw), -turn, turn);
      b.pitch += U.clamp(wantPitch - b.pitch, -turn, turn);
      const aimOff = Math.abs(U.angleDiff(b.yaw, wantYaw)) + Math.abs(wantPitch - b.pitch);

      // golpe con el pico si no tiene armas
      if (!w && b.held === 'pickaxe' && this.targetVisible && dist < 2.6 && aimOff < 0.5) {
        _dir.set(-Math.sin(b.yaw) * Math.cos(b.pitch), Math.sin(b.pitch), -Math.cos(b.yaw) * Math.cos(b.pitch));
        G.Combat.tryFire(b, _eye, _dir, true, 0);
      }
      // si se ha escondido tras una construcción, seguimos disparando para romperla
      const suppress = w && !this.targetVisible && this.blockedByBuild && G.Game.time - this.lastSeenT < 2.5 && this.reactT <= 0;
      if (suppress) {
        const sdx = this.lastSeen.x - b.pos.x, sdz = this.lastSeen.z - b.pos.z;
        b.yaw = Math.atan2(-sdx, -sdz);
        b.pitch = Math.atan2(this.lastSeen.y + 1.1 - _eye.y, Math.hypot(sdx, sdz));
      }
      this.burstPause -= dt;
      if (w && (this.targetVisible || suppress) && this.reactT <= 0 && (aimOff < 0.14 || suppress) && this.burstPause <= 0) {
        _dir.set(-Math.sin(b.yaw) * Math.cos(b.pitch), Math.sin(b.pitch), -Math.cos(b.yaw) * Math.cos(b.pitch));
        if (G.Combat.tryFire(b, _eye, _dir, true, 0)) {
          this.burst++;
          const maxBurst = w.def.auto ? U.randInt(3, 7) : w.type === 'pistol' ? U.randInt(2, 4) : 1;
          if (this.burst >= maxBurst) { this.burst = 0; this.burstPause = U.rand(0.25, 0.8) / D.fireMult; }
        }
      }
      return dist;
    }

    fight(dt) {
      const b = this.bot, t = this.target;
      const w = b.weapon;
      const dist = this.aimAndShoot(dt);
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z;

      // moverse: esquivar de lado y mantener la distancia buena para el arma
      this.strafeT -= dt;
      // cambiar de lado de vez en cuando (y si choca con algo, pero no más de 3 veces por segundo)
      if (this.strafeT <= 0 || (b.hitWall && this.strafeAge > 0.35)) {
        this.strafe = b.hitWall ? -this.strafe : (Math.random() < 0.5 ? -1 : 1);
        this.strafeT = U.rand(0.5, 1.3);
        this.strafeAge = 0;
      }
      this.strafeAge = (this.strafeAge || 0) + dt;
      const WANT = { shotgun: 4, tactical: 5, pistol: 14, rifle: 20, burst: 20, rocket: 30, sniper: 55 };
      const want = !w ? 1.2 : WANT[w.type] || 18;
      let fwd = U.clamp((dist - want) / Math.max(4, want), -1, 1);
      // con muy poca vida, se aleja (salvo que le toque pelear a escopeta)
      if (b.health + b.shield < 35 && dist < 30 && !(w && (w.type === 'shotgun' || w.type === 'tactical') && dist < 8)) fwd = -1;
      const nx = dx / dist, nz = dz / dist;
      let wx = nx * fwd + -nz * this.strafe * 0.8, wz = nz * fwd + nx * this.strafe * 0.8;
      const l = Math.hypot(wx, wz) || 1;
      wx /= l; wz /= l;
      let speed = C.player.walk;
      if (w && w.type !== 'shotgun' && w.type !== 'tactical' && dist > 14 && this.targetVisible) { b.ads = true; speed = C.player.adsSpeed; }
      // con el francotirador se agacha y se queda quieto (decidido cada 2-4 s, no en cada imagen)
      this.crouchT = (this.crouchT || 0) - dt;
      if (this.crouchT <= 0) { this.snipeCrouch = Math.random() < 0.75; this.crouchT = U.rand(2, 4); }
      if (w && w.type === 'sniper' && dist > 40 && this.snipeCrouch) { b.crouch = true; speed = 0; }
      if (!this.targetVisible) {
        // perseguir hacia donde lo vimos (corriendo)
        const ldx = this.lastSeen.x - b.pos.x, ldz = this.lastSeen.z - b.pos.z, ll = Math.hypot(ldx, ldz) || 1;
        wx = ldx / ll; wz = ldz / ll;
        speed = b.canSprint() && b.stamina > 20 ? C.player.sprint : C.player.walk;
      }
      // saltar más en las peleas cercanas (cuesta más acertarle)
      const jump = Math.random() < dt * (dist < 10 ? 1.4 : dist < 30 ? 0.35 : 0.1);
      _fr.wx = wx; _fr.wz = wz; _fr.jump = jump; _fr.speed = speed;
      return _fr;
    }

    /* ---------- Construir ---------- */
    matTotal() { const m = this.bot.mats; return m.wood + m.stone + m.metal; }
    canBuild(n) { const b = this.bot; return this.matTotal() >= n && b.mode === 'ground' && !b.vehicle; }
    // madera (se levanta rápido) mientras haya; si no, piedra y luego metal
    buildMat() {
      const m = this.bot.mats, cost = C.build.cost;
      if (m.wood >= cost && m.wood >= Math.min(m.stone, m.metal)) return 'wood';
      if (m.stone >= cost) return 'stone';
      if (m.metal >= cost) return 'metal';
      return m.wood >= cost ? 'wood' : null;
    }
    // Poner una pieza mirando hacia "yaw" (y apuntando con "pitch"): igual que construye el jugador
    tryBuild(type, yaw, pitch) {
      const b = this.bot;
      if (this.buildCd > 0 || b.mode !== 'ground' || b.vehicle || b.useT > 0) return false;
      const mat = this.buildMat();
      if (!mat) return false;
      const oldYaw = b.yaw;
      b.yaw = yaw;
      b.eye(_eye);
      _dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const t = G.Build.target(b, _eye, _dir, type, 0, mat);
      const ok = !!(t && t.valid && G.Build.place(b, t, mat));
      if (!ok) b.yaw = oldYaw;
      this.buildCd = ok ? 0.28 : 0.12;
      return ok;
    }
    // Cuatro paredes alrededor (para curarse o esperar en las zonas finales)
    boxUp() {
      const b = this.bot, base = Math.round(b.yaw / QUARTER) * QUARTER;
      let n = 0;
      for (let k = 0; k < 4; k++) {
        this.buildCd = 0;
        if (this.tryBuild('wall', base + k * QUARTER, 0)) n++;
      }
      b.yaw = base;
      this.boxCd = 25;
      return n;
    }
    // Le han disparado: ¿ponemos un muro delante?
    onHurt(attacker) {
      if (!attacker || attacker === this.bot || !attacker.alive) return;
      if (!this.canBuild(10) || Math.random() > this.diff.build) return;
      this.coverFrom = attacker;
      this.coverT = G.Game.time + 0.5;
    }
    buildCover() {
      const b = this.bot, a = this.coverFrom;
      if (this.buildCd > 0) return;     // (lo vuelve a intentar en la siguiente imagen)
      this.coverFrom = null;
      if (!a || !a.alive) return;
      const d = b.pos.distanceTo(a.pos);
      if (d < 6) return;                // demasiado cerca: mejor pelear
      b.eye(_eye);
      if (!G.Phys.lineClear(_eye.x, _eye.y, _eye.z, a.pos.x, a.pos.y + 1.2, a.pos.z, true)) return;   // ya está cubierto
      const yaw = Math.atan2(-(a.pos.x - b.pos.x), -(a.pos.z - b.pos.z));
      if (this.tryBuild('wall', yaw, 0) && Math.random() < 0.35 * this.diff.build && this.canBuild(30)) {
        // a veces, además, sube con rampas detrás del muro para ganar altura
        this.rampN = 2; this.rampYaw = yaw; this.rampFail = 0;
      }
    }
    // En plena pelea: si el enemigo está mucho más alto, subir con rampas hacia él
    combatBuild() {
      const b = this.bot, t = this.target;
      if (this.rampN > 0 || !this.canBuild(30) || Math.random() > this.diff.build * 0.5) return;
      const dy = t.pos.y - b.pos.y, dist = Math.hypot(t.pos.x - b.pos.x, t.pos.z - b.pos.z);
      if (dy > 2.8 && dist < 35 && dist > 4) {
        this.rampN = U.clamp(Math.ceil(dy / C.build.height) + 1, 2, 5);
        this.rampYaw = Math.atan2(-(t.pos.x - b.pos.x), -(t.pos.z - b.pos.z));
        this.rampFail = 0;
      }
    }
    // Poner rampas e ir subiendo por ellas
    rampRush() {
      const b = this.bot;
      if (this.buildCd <= 0) {
        if (this.tryBuild('ramp', this.rampYaw, -0.5)) { this.rampN--; this.rampFail = 0; }
        else if (++this.rampFail > 4 || !this.canBuild(10)) this.rampN = 0;   // no se puede: a pelear normal
      }
      _fr.wx = -Math.sin(this.rampYaw); _fr.wz = -Math.cos(this.rampYaw);
      _fr.jump = false; _fr.speed = C.player.walk;
      return _fr;
    }

    /* ---------- Materiales: picar cosas cercanas ---------- */
    findFarm() {
      const b = this.bot, R = 28;
      const arr = G.Phys.query(b.pos.x - R, b.pos.z - R, b.pos.x + R, b.pos.z + R, _boxes);
      let best = null, bd = Infinity;
      for (let i = 0; i < arr.length; i++) {
        const box = arr[i], g = box.g;
        if (!g || !g.alive || box.dead || g.build || !FARM.has(g.name)) continue;
        if (box.y1 < b.pos.y + 0.3 || box.y0 > b.pos.y + 1.6) continue;
        const cx = U.clamp(b.pos.x, box.x0, box.x1), cz = U.clamp(b.pos.z, box.z0, box.z1);
        const d = Math.hypot(cx - b.pos.x, cz - b.pos.z);
        if (d < bd) { bd = d; best = { type: 'farm', ref: box, pos: new THREE.Vector3(cx, b.pos.y, cz) }; }
      }
      return best;
    }

    /* ---------- Buscar pelea ---------- */
    // Ir hacia los disparos que oye o, desde la 3.ª zona, hacia el jugador más cercano
    hunt(safe) {
      const b = this.bot, time = G.Game.time, T = G.BOT_TUNING;
      if (time < this.huntT) return false;
      if (this.goal && this.goal.type !== 'wander' && this.goal.type !== 'hunt') return false;
      if (!b.hasUsableWeapon() || b.health < 45) return false;
      const phase = G.Storm.phase;
      if (this.calm && phase < 3) return false;
      this.huntT = time + 2.5;
      let tx = null, tz = 0;
      if (time - this.heardT < 10 && b.pos.distanceTo(this.heard) < T.hearRange) { tx = this.heard.x; tz = this.heard.z; }
      else if (phase >= T.huntPhase) {
        let best = null, bd = phase >= 4 ? 500 : 220;
        for (const c of G.Game.characters) {
          if (c === b || !c.alive || c.mode !== 'ground') continue;
          const d = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) { tx = best.pos.x; tz = best.pos.z; }
      }
      if (tx === null) return false;
      // sin salirse de la zona segura
      const ox = tx - safe.x, oz = tz - safe.z, od = Math.hypot(ox, oz);
      if (od > safe.r * 0.85) { tx = safe.x + (ox / od) * safe.r * 0.85; tz = safe.z + (oz / od) * safe.r * 0.85; }
      tx += U.rand(-6, 6); tz += U.rand(-6, 6);
      if (Math.hypot(tx - b.pos.x, tz - b.pos.z) < 8) return false;
      this.setGoal({ type: 'hunt', pos: new THREE.Vector3(tx, G.Phys.heightAt(tx, tz), tz) });
      return true;
    }

    /* ---------- Caminos ---------- */
    setGoal(g) {
      this.goal = g;
      this.farming = false;
      this.repath();
    }

    repath() {
      if (!this.goal) return;
      const p = this.goal.pos;
      this.path = G.Nav.findPath(this.bot.pos, p);
      this.pathI = 0;
    }

    // Saltarse los puntos del camino que ya se ven en línea recta (andar menos en zigzag)
    smoothPath() {
      const b = this.bot;
      for (let k = 0; k < 2 && this.pathI < this.path.length - 1; k++) {
        const nx = this.path[this.pathI + 1];
        if (Math.abs(nx.y - b.pos.y) > 1.0) break;
        if (Math.hypot(nx.x - b.pos.x, nx.z - b.pos.z) > 40) break;
        if (!G.Phys.lineClear(b.pos.x, b.pos.y + 0.7, b.pos.z, nx.x, nx.y + 0.7, nx.z, true)) break;
        this.pathI++;
      }
    }

    followPath() {
      const b = this.bot;
      if (!this.goal || !this.path.length) return null;
      if (this.pathI >= this.path.length) return null;
      const wp = this.path[this.pathI];
      const dx = wp.x - b.pos.x, dz = wp.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      const last = this.pathI === this.path.length - 1;
      if (d < (last ? 0.6 : 1.0) && Math.abs(wp.y - b.pos.y) < 2.6) {
        this.pathI++;
        return this.followPath();
      }
      // si nos hemos caído muy por debajo del punto, recalcular
      if (b.onGround && wp.y - b.pos.y > 3.2 && this.pathI > 0) {
        const prev = this.path[this.pathI - 1];
        if (prev.y - b.pos.y > 3.2) { this.repath(); return null; }
      }
      _mv.x = dx / (d || 1); _mv.z = dz / (d || 1); _mv.d = d;
      return _mv;
    }

    checkGoal() {
      const b = this.bot, g = this.goal;
      if (!g) return;
      const dx = g.pos.x - b.pos.x, dz = g.pos.z - b.pos.z, dy = g.pos.y - b.pos.y;
      const d = Math.hypot(dx, dz);
      if (g.type === 'item') {
        const it = g.ref;
        if (!it.alive) { this.goal = null; return; }
        g.pos.copy(it.pos);
        if (d < 1.6 && Math.abs(dy) < 1.6) {
          this.grab(it);
          this.goal = null;
        }
      } else if (g.type === 'chest') {
        if (g.ref.opened) { this.goal = null; return; }
        if (d < 1.9 && Math.abs(dy) < 1.6) { G.Loot.openChest(g.ref, b); this.goal = null; this.thinkT = 0.4; }
      } else if (g.type === 'farm') {
        const box = g.ref;
        if (box.dead || !box.g || !box.g.alive) { this.goal = null; return; }
        const cx = U.clamp(b.pos.x, box.x0, box.x1), cz = U.clamp(b.pos.z, box.z0, box.z1);
        if (Math.hypot(cx - b.pos.x, cz - b.pos.z) < 2.2) {
          // a picar (unos segundos: cada golpe da materiales)
          this.goal = null;
          this.breakBox = box; this.breakT = 4; this.farming = true;
        }
      } else if (d < 2.5 && Math.abs(dy) < 2.5) {
        this.goal = null;
      }
      if (this.goal && this.pathI >= this.path.length && d > 3) this.repath();
    }

    grab(it) {
      const b = this.bot;
      if (it.kind === 'cons') {
        if (this.wants(it)) b.pickupSlotItem(it);
        return;
      }
      if (it.kind === 'weapon') {
        const w = it.weapon;
        const same = b.slots.findIndex((s) => s && s.kind === 'weapon' && s.type === w.type);
        if (same >= 0) {
          if (b.slots[same].rarity >= w.rarity) return;
          G.Loot.dropSlotItem(b, b.slots[same]);
          b.slots[same] = w;
          G.Loot.remove(it);
          // si la cambia por la que tenía en la mano, la recarga a medias no pasa al arma nueva
          if (b.sel === same) { b.reloadT = 0; b.fireCd = Math.max(b.fireCd, 0.3); }
        } else {
          const empty = b.slots.indexOf(null);
          if (empty < 0) return;
          b.slots[empty] = w;
          G.Loot.remove(it);
          if (!b.weapon) b.selectSlot(empty);
        }
        // los bots reciben algo de munición extra para no quedarse secos
        b.ammo[w.def.ammo] = Math.min(G.AMMO[w.def.ammo].max, b.ammo[w.def.ammo] + Math.ceil(G.AMMO[w.def.ammo].pickup * 0.5));
        if (!b.weapon) b.selectSlot(b.slots.findIndex((s) => s && s.kind === 'weapon'));
      } else if (it.kind === 'ammo') b.pickupAmmo(it);
      else if (it.kind === 'mat') b.pickupMat(it);
    }

    wants(it) {
      const b = this.bot;
      if (it.kind === 'mat') return this.matTotal() < 300;
      if (it.kind === 'cons') {
        const cid = it.cons.cid;
        if (b.countCons(cid) >= 3) return false;
        return b.slots.includes(null) || b.slots.some((o) => o && o.kind === 'cons' && o.cid === cid && o.count < o.def.stack);
      }
      if (it.kind === 'ammo') {
        const has = b.slots.some((w) => w && w.kind === 'weapon' && w.def.ammo === it.ammo);
        return b.ammo[it.ammo] < G.AMMO[it.ammo].max * 0.5 && (has || b.ammo[it.ammo] < 15);
      }
      const w = it.weapon;
      const same = b.slots.find((s) => s && s.kind === 'weapon' && s.type === w.type);
      if (same) return w.rarity > same.rarity;
      // dejar sitio para curas: como mucho 4 armas
      return b.slots.includes(null) && b.slots.filter((s) => s && s.kind === 'weapon').length < 4;
    }

    findLoot() {
      const b = this.bot, time = G.Game.time;
      const weapons = b.slots.filter((s) => s && s.kind === 'weapon').length;
      const needy = weapons < 2 || !b.hasUsableWeapon() || (b.countCons('potion') + b.countCons('medkit')) < 1;
      const maxD = needy ? 70 : weapons < 3 ? 40 : 18;
      let best = null, bs = Infinity;
      for (const it of G.Loot.items) {
        if (it.vel || (it.claim > time && it.claimBy !== b)) continue;
        const dy = Math.abs(it.pos.y - b.pos.y);
        const d = Math.hypot(it.pos.x - b.pos.x, it.pos.z - b.pos.z) + dy * 3;
        if (d > maxD || d >= bs) continue;
        if (it.kind === 'mat' && d > 20) continue;
        if (!this.wants(it)) continue;
        const s = d * (it.kind === 'weapon' ? 0.8 : 1);
        if (s < bs) { bs = s; best = { type: 'item', ref: it, pos: it.pos.clone() }; }
      }
      if (weapons < 5 || needy) {
        for (const c of G.Loot.chests) {
          if (c.opened || c.noBot || (c.claim > time && c.claimBy !== b)) continue;
          const dy = Math.abs(c.pos.y - b.pos.y);
          const d = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z) + dy * 3;
          const s = d * 0.7;
          if (d < maxD && s < bs) { bs = s; best = { type: 'chest', ref: c, pos: c.pos.clone() }; }
        }
      }
      if (best) { best.ref.claim = time + 15; best.ref.claimBy = b; }
      return best;
    }

    wander(safe) {
      const b = this.bot;
      const spots = G.World.lootSpots;
      for (let i = 0; i < 12; i++) {
        const s = U.pick(spots);
        const d = Math.hypot(s.x - b.pos.x, s.z - b.pos.z);
        if (d < 15 || d > 160) continue;
        if (Math.hypot(s.x - safe.x, s.z - safe.z) > safe.r * 0.85) continue;
        this.setGoal({ type: 'wander', pos: new THREE.Vector3(s.x, s.y, s.z) });
        return;
      }
      const a = Math.random() * 6.28, r = safe.r * Math.random() * 0.6;
      const x = safe.x + Math.cos(a) * r, z = safe.z + Math.sin(a) * r;
      this.setGoal({ type: 'wander', pos: new THREE.Vector3(x, G.Phys.heightAt(x, z), z) });
    }

    alert(attacker) {
      if (!attacker || attacker === this.bot || !attacker.alive) return;
      const cur = this.target;
      if (!cur || !cur.alive || !this.targetVisible || this.bot.pos.distanceTo(attacker.pos) < this.bot.pos.distanceTo(cur.pos)) {
        if (cur !== attacker) {
          this.target = attacker;
          this.reactT = Math.min(this.reactT > 0 ? this.reactT : 99, U.rand(0.2, 0.45));
          this.aimHead = Math.random() < this.diff.headChance;
        }
        this.lastSeen.copy(attacker.pos);
        this.lastSeenT = G.Game.time;
        this.thinkT = 0;
        this.bot.useT = 0;
        this.breakT = 0;   // deja de picar
      }
    }
  }

  const B = (G.Bots = {
    list: [],

    create(n) {
      this.list = [];
      this.drops = [];             // dónde va a caer cada bot (para repartirlos)
      this.dropCounts = new Map(); // cuántos bots van a cada pueblo
      const names = U.shuffle(G.BOT_NAMES.slice());
      const pals = U.shuffle(G.Models.PALETTES.slice());
      for (let i = 0; i < n; i++) {
        // algunos bots llevan skins de la tienda; todos llevan un pico cualquiera
        const look = G.Shop.randomBotLook();
        const pal = look.pal || pals[i % pals.length];
        const ch = new G.Character(names[i % names.length] + (i >= names.length ? ' ' + (i + 1) : ''), false, pal, look);
        ch.brain = new Brain(ch);
        ch.fireMult = (G.DIFFICULTY[G.SETTINGS.difficulty] || G.DIFFICULTY.normal).fireMult;
        this.list.push(ch);
      }
      return this.list;
    },

    update(dt) {
      for (const b of this.list) {
        if (b.alive) b.brain.update(dt);
      }
    },

    nearestDrop(x, z) {
      let bd = Infinity;
      for (const d of this.drops || []) bd = Math.min(bd, Math.hypot(d.x - x, d.z - z));
      return bd;
    },

    // Un disparo: los bots que lo oyen miran hacia allí y, si están libres, van a ver qué pasa
    hearShot(shooter) {
      const time = G.Game.time, R = G.BOT_TUNING.hearRange;
      for (const b of this.list) {
        if (!b.alive || b === shooter || b.mode !== 'ground') continue;
        const dx = b.pos.x - shooter.pos.x, dz = b.pos.z - shooter.pos.z;
        if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
        const d = Math.hypot(dx, dz);
        if (d > R) continue;
        const br = b.brain;
        br.heard.copy(shooter.pos);
        br.heardT = time;
        if (d < 70 && (!br.target || !br.target.alive)) { br.suspect = shooter; br.suspectT = 4; }
      }
    },

    onDamaged(bot, attacker) {
      if (!bot.brain) return;
      bot.brain.alert(attacker);
      bot.brain.onHurt(attacker);
    },
  });
})();

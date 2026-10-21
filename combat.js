/* =====================================================================
   combat.js — Disparar, golpear con el pico, calcular a quién le da
   (rayos), aplicar daño (primero al escudo y luego a la vida), dañar
   paredes/construcciones y las bajas.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U;

  const _d = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
  const _end = new THREE.Vector3(), _muz = new THREE.Vector3(), _pt = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, -1);
  const _hits = new Map(), _walls = new Map(), _boxes = [];

  const Cb = (G.Combat = {
    rockets: [],      // misiles en vuelo

    // Dispersión actual del arma (más precisión apuntando y agachado)
    spreadFor(ch) {
      const w = ch.weapon;
      if (!w) return 0;
      const s = w.def.spread;
      let sp = ch.ads ? s.ads : s.hip;
      if (!ch.onGround) sp += s.air;
      else if (ch.moving) sp += s.move * (ch.ads ? 0.5 : 1);
      if (ch.crouch) sp *= s.crouch;
      return sp + ch.bloom;
    },

    falloff(def, d) {
      const [f0, f1, fmin] = def.falloff;
      if (d <= f0) return 1;
      if (d >= f1) return fmin;
      return U.lerp(1, fmin, (d - f0) / (f1 - f0));
    },

    label(w) {
      if (!w) return '';
      if (w === 'pickaxe') return G.PICKAXE.name;
      if (w === 'moto') return 'Moto';
      return G.Loot.weaponName(w);
    },

    /* Acción principal (clic izquierdo): disparar, golpear con el pico o usar una cura.
       justPressed = el clic acaba de pulsarse (las armas no automáticas lo necesitan) */
    tryFire(ch, origin, dir, justPressed, extraSpread, muzzle) {
      if (ch.mode !== 'ground' || !ch.alive || ch.vehicle) return false;
      const h = ch.held;
      if (h === 'pickaxe') return this.trySwing(ch, origin, dir);
      if (h && h.kind === 'cons') { if (justPressed) ch.startUse(); return false; }
      const w = ch.weapon;
      if (!w) return false;
      if (ch.useT > 0) return false;
      if (ch.fireCd > 0 || ch.reloadT > 0) return false;
      if (!w.def.auto && !justPressed) return false;
      if (w.mag <= 0) {
        if (!ch.startReload() && ch.isPlayer && justPressed) G.Audio.empty();
        return false;
      }
      w.mag--;
      ch.shotN = (ch.shotN || 0) + 1;     // contador de disparos (para que los demás lo vean en multijugador)
      ch.fireCd = 1 / (w.def.fireRate * (ch.fireMult || 1));
      const spread = this.spreadFor(ch) + (extraSpread || 0);
      ch.bloom = Math.min(w.def.spread.bloomMax, ch.bloom + w.def.spread.bloom);
      ch.recoil += w.def.recoil;
      this.shoot(ch, w, origin, dir, spread, muzzle);
      // fusil de ráfagas: el resto de balas de la ráfaga salen solas un poco después (ver update)
      if (w.def.burst > 1 && w.mag > 0) ch.burstQ = { w, left: w.def.burst - 1, t: w.def.burstGap, origin: origin.clone(), dir: dir.clone() };
      if (w.mag === 0) ch.startReload();
      if (G.Bots) G.Bots.hearShot(ch);
      if (ch.isPlayer) G.Game.stats.shots++;
      return true;
    },

    // Golpe con el pico: daña a personas y rompe cosas dando materiales
    trySwing(ch, origin, dir) {
      if (ch.fireCd > 0 || ch.useT > 0) return false;
      const P = G.PICKAXE;
      ch.fireCd = 1 / P.rate;
      ch.swingT = 0.35;
      ch.shotN = (ch.shotN || 0) + 1;
      const res = this.raycast(origin, dir, P.range, ch);
      if (res) {
        _pt.copy(origin).addScaledVector(dir, res.t);
        if (res.ent) this.damage(res.ent, P.damage, ch, 'pickaxe', false);
        else if (res.box && res.box.g) {
          G.Destruct.damage(res.box.g, P.structDamage, ch, _pt, true);
          G.Audio.pickHit(res.box.g.mat, ch.isPlayer ? null : ch.pos);
        } else {
          G.Effects.burst(_pt.x, _pt.y, _pt.z, 0xdddddd, 4, 2, 0.3);
          G.Audio.pickHit('clink', ch.isPlayer ? null : ch.pos);
        }
      } else if (ch.isPlayer) G.Audio.swing();
      return true;
    },

    shoot(ch, w, origin, dir, spread, muzzle) {
      const def = w.def;
      if (def.projectile) { this.launchRocket(ch, w, origin, dir, spread, muzzle, false); return; }
      const per = def.damage[w.rarity] / def.pellets;
      const hits = _hits, walls = _walls;   // se reutilizan (menos basura que limpiar)
      hits.clear(); walls.clear();
      _u.crossVectors(dir, UP);
      if (_u.lengthSq() < 1e-6) _u.set(1, 0, 0);
      _u.normalize();
      _v.crossVectors(_u, dir).normalize();
      if (muzzle) _muz.copy(muzzle);
      else this.muzzleOf(ch, _muz);

      for (let p = 0; p < def.pellets; p++) {
        const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
        _d.copy(dir).addScaledVector(_u, Math.cos(a) * r).addScaledVector(_v, Math.sin(a) * r).normalize();
        const res = this.raycast(origin, _d, def.range, ch);
        const t = res ? res.t : Math.min(def.range, 150);
        _end.copy(origin).addScaledVector(_d, t);
        if (res && res.ent) {
          const f = this.falloff(def, res.t);
          const dmg = per * f * (res.head ? def.headMult : 1);
          const h = hits.get(res.ent) || { dmg: 0, head: false };
          h.dmg += dmg;
          h.head = h.head || res.head;
          hits.set(res.ent, h);
        } else if (res) {
          G.Effects.burst(_end.x, _end.y, _end.z, res.terrain ? 0x9a8a60 : 0xcfc8b8, def.pellets > 1 ? 2 : 5, 2.5, 0.35);
          // las balas también rompen paredes y construcciones
          if (res.box && res.box.g) {
            let wg = walls.get(res.box.g);
            if (!wg) { wg = { dmg: 0, pt: _end.clone() }; walls.set(res.box.g, wg); }
            wg.dmg += per * def.structMult;
          }
        }
        if (def.pellets === 1 || p % 3 === 0) G.Effects.tracer(_muz, _end, ch.isPlayer ? 0xfff2b0 : 0xffd27a);
      }
      for (const [target, h] of hits) this.damage(target, h.dmg, ch, w, h.head);
      for (const [g, wg] of walls) G.Destruct.damage(g, wg.dmg, ch, wg.pt, false);
      hits.clear(); walls.clear();
      G.Effects.flash(_muz, def.pellets > 1 || def.id === 'sniper' ? 1.0 : 0.6);
      G.Audio.shot(def.id, ch.isPlayer ? null : ch.pos);
    },

    /* ---------- Cada paso de la partida: balas de las ráfagas y misiles en vuelo ---------- */
    update(dt) {
      for (const ch of G.Game.characters) {
        const q = ch.burstQ;
        if (!q) continue;
        // la ráfaga se corta si cambia de arma, recarga, muere o se sube a una moto
        if (!ch.alive || ch.weapon !== q.w || ch.reloadT > 0 || ch.mode !== 'ground' || ch.vehicle) { ch.burstQ = null; continue; }
        q.t -= dt;
        if (q.t > 0) continue;
        if (q.w.mag <= 0) { ch.burstQ = null; ch.startReload(); continue; }
        // cada bala sale hacia donde apunta ahora (se puede corregir durante la ráfaga)
        let mz = null;
        if (ch.isPlayer && G.PlayerCtl.ch === ch) {
          const a = G.PlayerCtl.aim(G.Game.camera);
          q.origin.copy(a.origin); q.dir.copy(a.dir);
          if (G.PlayerCtl.firstPerson) mz = G.PlayerCtl.vmMuzzle();
        } else if (!ch.puppet && !ch.remote) {
          ch.eye(q.origin);
          const cp = Math.cos(ch.pitch);
          q.dir.set(-Math.sin(ch.yaw) * cp, Math.sin(ch.pitch), -Math.cos(ch.yaw) * cp);
        }
        q.w.mag--;
        ch.shotN = (ch.shotN || 0) + 1;
        const spread = this.spreadFor(ch);
        ch.bloom = Math.min(q.w.def.spread.bloomMax, ch.bloom + q.w.def.spread.bloom);
        ch.recoil += q.w.def.recoil;
        this.shoot(ch, q.w, q.origin, q.dir, spread, mz);
        if (ch.isPlayer) {
          G.Game.stats.shots++;
          ch.pitch = U.clamp(ch.pitch + q.w.def.recoil * (ch.ads ? 0.5 : 1), -1.48, 1.48);
          G.PlayerCtl.vmKick = 1;
        }
        q.left--;
        q.t = q.w.def.burstGap;
        if (q.left <= 0 || q.w.mag <= 0) { ch.burstQ = null; if (q.w.mag === 0) ch.startReload(); }
      }
      this.updateRockets(dt);
    },

    /* ---------- Lanzamisiles ----------
       visual = sólo se ve (es el misil de otro jugador en multijugador: el daño lo calcula su ordenador) */
    launchRocket(ch, w, origin, dir, spread, muzzle, visual) {
      const P = w.def.projectile;
      if (muzzle) _muz.copy(muzzle); else this.muzzleOf(ch, _muz);
      _u.crossVectors(dir, UP);
      if (_u.lengthSq() < 1e-6) _u.set(1, 0, 0);
      _u.normalize();
      _v.crossVectors(_u, dir).normalize();
      const r0 = (spread || 0) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      _d.copy(dir).addScaledVector(_u, Math.cos(a) * r0).addScaledVector(_v, Math.sin(a) * r0).normalize();
      // si entre los ojos y la boca del lanzador hay una pared, sale desde los ojos (no la atraviesa)
      const start = G.Phys.lineClear(origin.x, origin.y, origin.z, _muz.x, _muz.y, _muz.z, false) ? _muz.clone() : origin.clone();
      // el misil va desde la boca del lanzador justo hasta el punto al que apunta la mira
      // (si fuera paralelo a la mira, como sale más bajo que los ojos, caería antes de tiempo)
      const aimHit = this.raycast(origin, _d, P.speed * P.life, ch);
      const aimT = aimHit ? aimHit.t : 120;
      const aimPt = origin.clone().addScaledVector(_d, aimT);
      if (aimPt.distanceToSquared(start) > 1) _d.copy(aimPt).sub(start).normalize();
      const mesh = G.Models.rocketMesh();
      mesh.position.copy(start);
      mesh.quaternion.setFromUnitVectors(FWD, _d);
      G.Game.scene.add(mesh);
      this.rockets.push({ owner: ch, w, pos: start, vel: _d.clone().multiplyScalar(P.speed), life: P.life, visual: !!visual, mesh, smokeT: 0 });
      G.Effects.flash(_muz, 1.4);
      G.Effects.burst(_muz.x, _muz.y, _muz.z, 0xcfcfcf, 10, 2.5, 0.6, -0.5);
      G.Audio.shot('rocket', ch.isPlayer ? null : ch.pos);
    },

    updateRockets(dt) {
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        const r = this.rockets[i];
        r.life -= dt;
        const speed = r.vel.length();               // (vuela recto: no le afecta la gravedad)
        _d.copy(r.vel).divideScalar(speed);
        const res = this.raycast(r.pos, _d, speed * dt, r.owner);
        if (res || r.life <= 0 || r.pos.y < G.CONFIG.waterLevel - 0.5) {
          if (res) r.pos.addScaledVector(_d, Math.max(0, res.t - 0.15));
          this.explode(r);
          G.Game.scene.remove(r.mesh);
          this.rockets.splice(i, 1);
          continue;
        }
        r.pos.addScaledVector(r.vel, dt);
        r.mesh.position.copy(r.pos);
        r.mesh.quaternion.setFromUnitVectors(FWD, _d);
        // estela de humo
        r.smokeT -= dt;
        if (r.smokeT <= 0) {
          r.smokeT = 0.025;
          G.Effects.burst(r.pos.x - _d.x * 0.5, r.pos.y - _d.y * 0.5, r.pos.z - _d.z * 0.5, 0xd0d0d0, 2, 0.5, 0.9, -0.6);
        }
      }
    },

    // Explosión: daño a quien esté cerca (menos cuanto más lejos; las paredes protegen) y a lo construido
    explode(r) {
      const P = r.w.def.projectile, R = P.blast, p = r.pos;
      G.Effects.burst(p.x, p.y, p.z, 0xffb347, 45, 9, 0.6, 3);
      G.Effects.burst(p.x, p.y, p.z, 0xff5a1f, 25, 6, 0.5, 2);
      G.Effects.burst(p.x, p.y + 0.5, p.z, 0x4a4a4a, 30, 4, 1.4, -1.5);
      G.Effects.flash(p, 6);
      G.Audio.explosion(p);
      if (r.visual) return;
      const dmg0 = r.w.def.damage[r.w.rarity];
      for (const c of G.Game.characters) {
        if (!c.alive || c.mode === 'bus') continue;
        const cy = c.pos.y + 1;
        const d = Math.hypot(c.pos.x - p.x, cy - p.y, c.pos.z - p.z);
        if (d > R + 0.4) continue;
        if (!G.Phys.lineClear(p.x, p.y + 0.1, p.z, c.pos.x, cy, c.pos.z, true)) continue;
        this.damage(c, dmg0 * (1 - 0.6 * U.clamp(d / R, 0, 1)), r.owner, r.w, false);
      }
      // paredes, suelos y construcciones al alcance
      const groups = new Map();
      for (const b of G.Phys.query(p.x - R, p.z - R, p.x + R, p.z + R, _boxes)) {
        if (!b.g || !b.g.alive || b.dead) continue;
        const dx = p.x - U.clamp(p.x, b.x0, b.x1), dy = p.y - U.clamp(p.y, b.y0, b.y1), dz = p.z - U.clamp(p.z, b.z0, b.z1);
        const d = Math.hypot(dx, dy, dz);
        if (d > R) continue;
        const k = 1 - 0.5 * (d / R);
        if (!(groups.get(b.g) >= k)) groups.set(b.g, k);
      }
      for (const [g, k] of groups) G.Destruct.damage(g, P.structDamage * k * r.w.def.structMult, r.owner, null, false);
    },

    clearRockets() {
      for (const r of this.rockets) if (G.Game.scene) G.Game.scene.remove(r.mesh);
      this.rockets = [];
      for (const c of (G.Game && G.Game.characters) || []) c.burstQ = null;
    },

    // Posición aproximada de la boca del cañón (para el fogonazo y la trazadora)
    muzzleOf(ch, out) {
      const fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw);
      const rx = Math.cos(ch.yaw), rz = -Math.sin(ch.yaw);
      const len = ch.weapon ? G.Models.muzzle[ch.weapon.type].z * -1 : 0.6;
      const cp = Math.cos(ch.pitch), sp = Math.sin(ch.pitch);
      return out.set(
        ch.pos.x + rx * 0.16 + fx * (0.42 + len) * cp,
        ch.pos.y + (ch.crouch ? 0.85 : 1.32) + sp * (0.42 + len),
        ch.pos.z + rz * 0.16 + fz * (0.42 + len) * cp
      );
    },

    // Rayo contra el mundo y los personajes
    raycast(origin, d, maxT, ignore) {
      const world = G.Phys.raycastWorld(origin.x, origin.y, origin.z, d.x, d.y, d.z, maxT);
      let best = world ? world.t : maxT, ent = null, head = false;
      const chars = G.Game.characters;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c === ignore || !c.alive || c.mode === 'bus') continue;
        const wx = c.pos.x - origin.x, wy = c.pos.y + 1 - origin.y, wz = c.pos.z - origin.z;
        const t = wx * d.x + wy * d.y + wz * d.z;
        if (t < -1 || t > best + 1) continue;
        if (wx * wx + wy * wy + wz * wz - t * t > 6.25) continue;
        const r = c.rayHit(origin.x, origin.y, origin.z, d.x, d.y, d.z, best);
        if (r && r.t < best) { best = r.t; ent = c; head = r.head; }
      }
      if (!ent && !world) return null;
      return { t: best, ent, head, terrain: !ent && world && world.terrain, box: !ent && world ? world.box : null };
    },

    /* Aplica daño: el escudo absorbe primero; la tormenta va directa a la vida */
    damage(target, amount, attacker, weapon, head, kind) {
      if (!target.alive) return;
      // entre bots el daño es menor: así no se eliminan todos en el primer minuto
      if (attacker && attacker !== target && attacker.brain && target.brain) amount *= G.BOT_TUNING.botDamage;
      amount = Math.max(1, Math.round(amount));
      // multijugador: a quien no simulamos aquí se lo manda la red (al anfitrión o a su dueño)
      if (target.puppet || target.remote) {
        if (attacker && attacker.isPlayer) {
          G.HUD.damageNumber(target, amount, head, target.shield > 0);
          G.HUD.hitMarker(head);
          G.Audio.hit(head);
          G.Game.stats.hits++;
          attacker.damageDone += amount;
        }
        if (kind !== 'storm' && kind !== 'fall') G.Effects.burst(target.pos.x, target.pos.y + (head ? 1.7 : 1.1), target.pos.z, target.shield > 0 ? 0x49a8ff : 0xffffff, 6, 3, 0.35);
        G.Net.forwardDamage(target, amount, attacker, weapon, head, kind);
        return;
      }
      let toShield = 0, toHealth;
      if (kind === 'storm' || kind === 'fall') toHealth = amount;
      else { toShield = Math.min(target.shield, amount); toHealth = amount - toShield; }
      const hadShield = target.shield > 0;
      target.shield -= toShield;
      target.health -= toHealth;
      target.lastDamageT = G.Game.time;
      if (attacker) { target.lastHitBy = attacker; attacker.damageDone += amount; }

      if (attacker && attacker.isPlayer) {
        G.HUD.damageNumber(target, amount, head, toShield > 0 && toHealth === 0);
        G.HUD.hitMarker(head);
        G.Audio.hit(head);
        if (hadShield && target.shield <= 0) G.Audio.shieldBreak();
        G.Game.stats.hits++;
      }
      if (target.isPlayer) {
        G.HUD.hurt(attacker, kind);
        if (kind === 'storm') G.Audio.storm(); else G.Audio.hurt();
        if (kind === 'fall') G.Audio.thud();
      } else if (G.Bots) G.Bots.onDamaged(target, attacker);

      if (kind !== 'storm' && kind !== 'fall') {
        G.Effects.burst(target.pos.x, target.pos.y + (head ? 1.7 : 1.1), target.pos.z, toShield > 0 ? 0x49a8ff : 0xffffff, 6, 3, 0.35);
      }
      if (target.health <= 0) this.kill(target, attacker, weapon, kind);
    },

    kill(target, attacker, weapon, kind) {
      target.health = 0;
      target.shield = 0;
      target.alive = false;
      target.mode = 'dead';
      target.deadT = 0;
      target.reloadT = 0;
      target.useT = 0;
      target.ads = false;
      target.building = false;
      target.model.glider.visible = false;
      if (target.vehicle) G.Vehicles.dismount(target, true);
      G.Loot.dropAll(target);
      G.Effects.burst(target.pos.x, target.pos.y + 1, target.pos.z, 0xffffff, 30, 4, 0.8, 2);
      // invitado: avisamos al anfitrión; él nos devolverá la baja para todos
      if (G.Net.isClient && G.Net.inMatch) { G.Net.reportDeath(attacker, weapon, kind); return; }
      if (attacker && attacker !== target) attacker.kills++;
      G.Net.killed(target, attacker, weapon, kind);
      G.Game.onKill(target, attacker, weapon, kind);
    },
  });
})();

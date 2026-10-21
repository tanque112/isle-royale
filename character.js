/* =====================================================================
   character.js — La clase Character la usan tanto el jugador como los
   bots: vida, escudo, inventario (pico + 5 huecos para armas y curas),
   munición, materiales, movimiento, recarga, curarse y la animación.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  let nextId = 1;

  class Character {
    // look (opcional) = { acc: complemento de la skin (gorra, corona...), skin: id de la skin, pick: id del pico }
    constructor(name, isPlayer, palette, look) {
      this.id = nextId++;
      this.name = name;
      this.isPlayer = isPlayer;
      this.pos = new THREE.Vector3();
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.radius = C.player.radius;
      this.height = C.player.height;
      this.mode = 'bus';               // bus | dive | glide | ground | dead
      this.health = C.maxHealth;       // la vida empieza llena
      this.shield = 0;                 // el escudo empieza a 0
      this.slots = new Array(C.slots).fill(null);
      this.sel = -1;                   // -1 = pico, 0..4 = huecos
      this.lastSlot = 0;
      this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 };
      this.mats = { wood: 0, stone: 0, metal: 0 };
      this.alive = true;
      this.kills = 0;
      this.damageDone = 0;
      this.fireCd = 0;
      this.bloom = 0;
      this.reloadT = 0;
      this.reloadDur = 0;
      this.useT = 0;
      this.useDur = 0;
      this.swingT = 0;
      this.ads = false;
      this.crouch = false;
      this.moving = false;
      this.onGround = false;
      this.groundY = 0;
      this.animPhase = 0;
      this.deadT = 0;
      this.lastHitBy = null;
      this.lastDamageT = -99;
      this.recoil = 0;
      this.stamina = C.stamina.max;   // aguante para correr
      this.tired = false;
      this.staminaIdle = 0;
      this.vehicle = null;             // la moto en la que va montado
      this.palette = palette;
      this.acc = (look && look.acc) || null;
      this.skinId = (look && look.skin) || '';
      this.pickId = (look && look.pick) || 'clasico';
      this.model = G.Models.makeCharacter(palette, this.acc);
      this.model.root.visible = false;
    }

    /* ---------- Lo que tienes en la mano ---------- */
    get held() { return this.sel < 0 ? 'pickaxe' : this.slots[this.sel]; }
    get weapon() { const h = this.held; return h && h.kind === 'weapon' ? h : null; }
    get consumable() { const h = this.held; return h && h.kind === 'cons' ? h : null; }
    get using() { return this.useT > 0; }
    get eyeHeight() { return this.crouch ? C.player.crouchEye : C.player.eye; }
    get topY() { return this.pos.y + (this.crouch ? 1.38 : 1.9); }
    eye(out) { return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }

    selectSlot(i) {
      if (i === this.sel || i < -1 || i >= this.slots.length) return;
      this.sel = i;
      if (i >= 0) this.lastSlot = i;
      this.reloadT = 0;
      this.useT = 0;
      this.ads = false;
      this.fireCd = Math.max(this.fireCd, i < 0 ? 0.15 : 0.3); // tiempo de sacar el arma
      this.bloom = 0;
    }

    hasUsableWeapon() {
      return this.slots.some((w) => w && w.kind === 'weapon' && (w.mag > 0 || this.ammo[w.def.ammo] > 0));
    }
    countCons(cid) {
      let n = 0;
      for (const s of this.slots) if (s && s.kind === 'cons' && s.cid === cid) n += s.count;
      return n;
    }
    findCons(cid) { return this.slots.findIndex((s) => s && s.kind === 'cons' && s.cid === cid); }

    startReload() {
      const w = this.weapon;
      if (!w || this.reloadT > 0 || w.mag >= w.def.mag || this.ammo[w.def.ammo] <= 0) return false;
      this.useT = 0;
      this.reloadDur = w.def.reload[w.rarity];
      this.reloadT = this.reloadDur;
      if (this.isPlayer) G.Audio.reload();
      return true;
    }

    // ¿Sirve de algo usar esta cura ahora?
    canUse(cid) {
      const def = G.CONSUMABLES[cid];
      if (def.effect === 'shield') return this.shield < C.maxShield;
      return this.health < C.maxHealth;
    }

    // Empezar a usar la cura que llevas en la mano (poción o botiquín)
    startUse() {
      const c = this.consumable;
      if (!c || this.useT > 0 || this.mode !== 'ground') return false;
      if (!this.canUse(c.cid)) {
        if (this.isPlayer) G.HUD.toast(c.def.effect === 'shield' ? 'Tu escudo ya está al máximo' : 'Ya tienes la vida al máximo');
        return false;
      }
      this.reloadT = 0;
      this.ads = false;
      this.useDur = c.def.time;
      this.useT = this.useDur;
      this.useSel = this.sel;
      if (this.isPlayer) G.Audio.potion();
      return true;
    }

    updateTimers(dt) {
      this.fireCd -= dt;
      this.swingT = Math.max(0, this.swingT - dt);
      this.bloom = Math.max(0, this.bloom - dt * 0.09);
      this.recoil = Math.max(0, this.recoil - dt * 0.35);
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          this.reloadT = 0;
          const w = this.weapon;
          if (w) {
            const take = Math.min(w.def.mag - w.mag, this.ammo[w.def.ammo]);
            w.mag += take;
            this.ammo[w.def.ammo] -= take;
            if (this.isPlayer) G.Audio.reloadDone();
          }
        }
      }
      if (this.useT > 0) {
        const c = this.consumable;
        if (!c || this.sel !== this.useSel) { this.useT = 0; return; }
        this.useT -= dt;
        if (this.useT <= 0) {
          this.useT = 0;
          const def = c.def;
          if (def.effect === 'shield') this.shield = Math.min(C.maxShield, this.shield + def.amount);
          else this.health = Math.min(C.maxHealth, this.health + def.amount);
          c.count--;
          if (c.count <= 0) this.slots[this.sel] = null;
          if (this.isPlayer) G.Audio.shieldUp();
          G.Effects.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, def.hex, 18, 2.5, 0.7, -1);
        }
      }
    }

    /* ---------- Inventario ---------- */
    // Recoger un arma o una cura (con la tecla E)
    pickupSlotItem(it) {
      const s = it.kind === 'weapon' ? it.weapon : it.cons;
      // las curas se apilan (hasta 3 por hueco)
      if (s.kind === 'cons') {
        for (const o of this.slots) {
          if (o && o.kind === 'cons' && o.cid === s.cid && o.count < s.def.stack) {
            const take = Math.min(s.count, s.def.stack - o.count);
            o.count += take;
            s.count -= take;
            if (s.count <= 0) { G.Loot.remove(it); this.pickedFx(); return true; }
          }
        }
      }
      let slot = -1;
      if (this.sel >= 0 && !this.slots[this.sel]) slot = this.sel;
      else slot = this.slots.indexOf(null);
      if (slot < 0) {
        // inventario lleno: se cambia por lo que llevas en la mano (o el último hueco usado si llevas el pico)
        slot = this.sel >= 0 ? this.sel : this.lastSlot;
        G.Loot.dropSlotItem(this, this.slots[slot]);
      }
      this.slots[slot] = s;
      G.Loot.remove(it);
      if (this.isPlayer) {
        if (slot !== this.sel) this.selectSlot(slot);
        else { this.reloadT = 0; this.useT = 0; this.fireCd = Math.max(this.fireCd, 0.3); }
        if (s.kind === 'weapon') G.Game.stats.weapons++;
      }
      this.pickedFx();
      return true;
    }
    pickedFx() { if (this.isPlayer) G.Audio.pickup(); }

    pickupAmmo(it) {
      const a = it.ammo, max = G.AMMO[a].max;
      const take = Math.min(it.amount, max - this.ammo[a]);
      if (take <= 0) return false;
      this.ammo[a] += take;
      it.amount -= take;
      if (it.amount <= 0) G.Loot.remove(it); else G.Net.lootAmount(it);
      this.pickedFx();
      return true;
    }

    pickupMat(it) {
      const m = it.mat, max = G.MATERIALS[m].max;
      const take = Math.min(it.amount, max - this.mats[m]);
      if (take <= 0) return false;
      this.mats[m] += take;
      it.amount -= take;
      if (it.amount <= 0) G.Loot.remove(it); else G.Net.lootAmount(it);
      if (this.isPlayer) G.HUD.matGain(m, take);
      this.pickedFx();
      return true;
    }

    // Munición, materiales y curas que se pueden apilar se cogen solos al pasar por encima
    autoPickup() {
      const r2 = C.autoPickupRadius * C.autoPickupRadius;
      const items = G.Loot.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (!it || it.vel || it.kind === 'weapon') continue;
        const dx = it.pos.x - this.pos.x, dz = it.pos.z - this.pos.z, dy = it.pos.y - this.pos.y;
        if (dx * dx + dz * dz > r2 || Math.abs(dy) > 1.5) continue;
        if (it.kind === 'ammo') this.pickupAmmo(it);
        else if (it.kind === 'mat') this.pickupMat(it);
        else if (it.kind === 'cons') {
          const has = this.slots.some((o) => o && o.kind === 'cons' && o.cid === it.cons.cid && o.count < it.cons.def.stack);
          if (has) this.pickupSlotItem(it);
        }
      }
    }

    // Intercambiar dos huecos (para ordenar el inventario)
    swapSlots(a, b) {
      if (a === b || a < 0 || b < 0) return;
      const A = this.slots[a], B = this.slots[b];
      // juntar curas iguales
      if (A && B && A.kind === 'cons' && B.kind === 'cons' && A.cid === B.cid && B.count < B.def.stack) {
        const take = Math.min(A.count, B.def.stack - B.count);
        B.count += take; A.count -= take;
        if (A.count <= 0) this.slots[a] = null;
        return;
      }
      this.slots[a] = B; this.slots[b] = A;
      if (this.sel === a) { this.sel = b; this.lastSlot = b; } else if (this.sel === b) { this.sel = a; this.lastSlot = a; }
      this.reloadT = 0; this.useT = 0;
    }

    dropSlot(i) {
      const s = this.slots[i];
      if (!s) return;
      G.Loot.dropSlotItem(this, s);
      this.slots[i] = null;
      if (this.sel === i) { this.reloadT = 0; this.useT = 0; }
    }

    /* ---------- Aguante (correr cansa) ---------- */
    canSprint() { return !this.tired && this.stamina > 0; }
    updateStamina(dt, sprinting) {
      const S = C.stamina;
      if (sprinting) {
        this.stamina = Math.max(0, this.stamina - S.drain * dt);
        this.staminaIdle = 0;
        if (this.stamina <= 0) this.tired = true;
      } else {
        this.staminaIdle += dt;
        if (this.staminaIdle > S.regenDelay) this.stamina = Math.min(S.max, this.stamina + S.regen * dt);
      }
      if (this.tired && this.stamina >= S.recover) this.tired = false;
    }

    /* ---------- Movimiento ---------- */
    groundMove(dt, wx, wz, speed, jump) {
      if (this.pos.y < C.waterLevel - 0.5) speed *= 0.55;
      const accel = this.onGround ? 60 : 14;
      const tx = wx * speed, tz = wz * speed;
      this.vel.x += U.clamp(tx - this.vel.x, -accel * dt, accel * dt);
      this.vel.z += U.clamp(tz - this.vel.z, -accel * dt, accel * dt);
      if (jump && this.onGround && !this.crouch) {
        this.vel.y = C.player.jump;
        this.onGround = false;
      }
      this.vel.y -= C.gravity * dt;
      this.hitWall = false;
      this.wallBox = null;
      this.height = this.crouch ? C.player.crouchHeight : C.player.height;
      this.landSpeed = 0;
      G.Phys.moveCharacter(this, dt);
      this.moving = Math.hypot(this.vel.x, this.vel.z) > 1.0;
      // daño de caída: altura de la caída = v² / (2·g)
      if (this.landSpeed > 0) {
        const h = (this.landSpeed * this.landSpeed) / (2 * C.gravity);
        const dmg = Math.round((h - C.fall.safeHeight) * C.fall.perMeter);
        if (dmg > 0 && this.alive) G.Combat.damage(this, dmg, null, null, false, 'fall');
      }
    }

    airMove(dt, wx, wz, dive) {
      const S = C.sky;
      this.diveT = (this.diveT || 0) + dt;
      let hs, vy;
      if (this.mode === 'dive') { hs = S.hSpeed; vy = -(dive ? S.diveFall : S.fall); }
      else { hs = S.glideH; vy = -S.glideFall; }
      const k = Math.min(1, 3 * dt);
      this.vel.x += (wx * hs - this.vel.x) * k;
      this.vel.z += (wz * hs - this.vel.z) * k;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 4 * dt);
      this.height = C.player.height;
      G.Phys.moveCharacter(this, dt);
      const above = this.pos.y - G.Phys.groundAt(this.pos.x, this.pos.z, this.radius, this.pos.y, 0);
      if (this.mode === 'dive' && above < S.autoGlide) this.openGlider();
      if (this.onGround) {
        this.mode = 'ground';
        this.model.glider.visible = false;
        this.vel.set(0, 0, 0);
      }
      return above;
    }

    openGlider() {
      if (this.mode !== 'dive') return;
      this.mode = 'glide';
      this.model.glider.visible = true;
      if (this.isPlayer) G.Audio.whoosh();
    }

    /* ---------- Cajas de impacto (cuerpo y cabeza) ---------- */
    rayHit(ox, oy, oz, dx, dy, dz, maxT) {
      const p = this.pos;
      const top = this.topY;
      const headB = top - 0.34;   // la cabeza: los últimos 34 cm
      const th = slab(ox, oy, oz, dx, dy, dz, p.x - 0.23, headB, p.z - 0.23, p.x + 0.23, top, p.z + 0.23);
      const tb = slab(ox, oy, oz, dx, dy, dz, p.x - 0.36, p.y, p.z - 0.36, p.x + 0.36, headB, p.z + 0.36);
      let t = -1, head = false;
      if (th >= 0 && th <= maxT) { t = th; head = true; }
      if (tb >= 0 && tb <= maxT && (t < 0 || tb < t)) { t = tb; head = false; }
      return t < 0 ? null : { t, head };
    }

    /* ---------- Animación del muñeco ---------- */
    updateModel(dt, showSelf, far) {
      const m = this.model;
      m.root.visible = showSelf && this.mode !== 'bus';
      if (!m.root.visible) return;
      m.root.position.copy(this.pos);
      // Lejos: una sola malla quieta (1 dibujo en vez de 8). Ahorra mucho con 100 bots.
      const lod = far && this.mode === 'ground' && !this.crouch && !this.vehicle;
      m.lod.visible = lod;
      m.body.visible = !lod;
      if (lod) {
        m.root.rotation.set(0, this.yaw, 0);
        m.glider.visible = false;
        // de lejos también se le ve andar: se alterna entre 3 posturas
        const hs = Math.hypot(this.vel.x, this.vel.z);
        this.animPhase += dt * hs * 1.7;
        const P = m.lodParts;
        const f = hs > 1 ? Math.floor(this.animPhase / (Math.PI / 2)) & 3 : 1;
        const geo = f === 0 ? P.fullA : f === 2 ? P.fullB : P.full;
        if (m.lod.geometry !== geo) m.lod.geometry = geo;
        m.blob.visible = G.Game.blobShadows;
        if (m.blob.visible) {
          const h = Math.max(0, this.pos.y - this.groundY);
          m.blob.position.y = -h + 0.04;
          m.blob.visible = h < 20;
        }
        return;
      }
      m.root.rotation.set(0, this.yaw, 0);

      // sombra de mancha en el suelo
      m.blob.visible = G.Game.blobShadows;
      if (m.blob.visible) {
        const h = Math.max(0, this.pos.y - this.groundY);
        m.blob.position.y = -h + 0.04;
        m.blob.scale.setScalar(Math.max(0.3, 1 - h * 0.05));
        m.blob.visible = h < 20;
      }

      // lo que lleva en la mano
      const held = this.held;
      const key = G.Models.heldKey(held, this.pickId);
      if (key !== m.heldKey) {
        if (m.heldMesh) m.weaponHolder.remove(m.heldMesh);
        m.heldMesh = G.Models.heldMesh(held, this.pickId);
        if (held === 'pickaxe') m.heldMesh.position.set(0.05, 0.05, 0.3);
        else if (held && held.kind === 'cons') m.heldMesh.position.set(-0.05, -0.15, 0.1);
        m.weaponHolder.add(m.heldMesh);
        m.heldKey = key;
      }

      // montado en moto: sentado, con las manos en el manillar
      if (this.vehicle && this.mode === 'ground') {
        const v = this.vehicle;
        m.root.rotation.set(v.pitch, v.yaw, v.lean);
        m.body.rotation.set(0, 0, 0);
        m.body.position.set(0, 0, 0);
        m.legL.rotation.set(0.95, 0, 0.1); m.legR.rotation.set(0.95, 0, -0.1);
        m.armL.rotation.set(1.42, 0, 0); m.armR.rotation.set(1.42, 0, 0);
        m.head.rotation.set(this.pitch * 0.4, U.clamp(U.angleDiff(v.yaw, this.yaw), -1.2, 1.2) * 0.6, 0);
        m.weaponHolder.visible = false;
        m.glider.visible = false;
        m.blob.visible = false;
        return;
      }

      if (this.mode === 'dead') {
        this.deadT += dt;
        m.body.rotation.x = Math.max(-Math.PI / 2, -this.deadT * 5);
        m.body.position.y = Math.min(0.2, this.deadT * 0.5);
        m.blob.visible = false;
        return;
      }

      const hs = Math.hypot(this.vel.x, this.vel.z);
      m.body.rotation.x = 0; m.body.rotation.z = 0;
      m.body.position.y = 0;
      m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0);
      m.armL.rotation.set(0, 0, 0); m.armR.rotation.set(0, 0, 0);
      m.head.rotation.set(0, 0, 0);
      m.weaponHolder.visible = !this.building;
      m.weaponHolder.rotation.set(0, 0, 0);

      if (this.mode === 'dive') {
        m.body.rotation.x = -1.25;
        m.body.position.y = 1.0;
        m.armL.rotation.z = -1.3; m.armR.rotation.z = 1.3;
        m.legL.rotation.x = 0.3; m.legR.rotation.x = 0.3;
        m.weaponHolder.visible = false;
        return;
      }
      if (this.mode === 'glide') {
        m.armL.rotation.x = Math.PI; m.armR.rotation.x = Math.PI;
        m.legL.rotation.x = Math.sin(performance.now() * 0.004) * 0.2;
        m.legR.rotation.x = -m.legL.rotation.x;
        m.weaponHolder.visible = false;
        return;
      }

      this.animPhase += dt * hs * 1.7;
      const sw = Math.sin(this.animPhase) * Math.min(1, hs / 5) * 0.8;
      m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
      if (this.crouch) {
        m.body.position.y = -0.45;
        m.legL.rotation.x = -1.1 + sw * 0.3; m.legR.rotation.x = -0.4 - sw * 0.3;
      }
      if (!this.onGround) { m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.3; }

      const aim = this.pitch;
      if (this.useT > 0) {
        // bebiendo / curándose
        m.armR.rotation.x = 2.4; m.armL.rotation.x = 1.2;
        m.weaponHolder.position.set(0.05, 1.55 + G.Models.HOLD_DY, -0.25);
      } else if (held === 'pickaxe' && !this.building) {
        // golpe con el pico
        const s = this.swingT > 0 ? Math.sin((1 - this.swingT / 0.35) * Math.PI) : 0;
        m.armR.rotation.x = 1.9 - s * 1.6;
        m.armL.rotation.x = 1.3 - s * 1.2;
        m.weaponHolder.position.set(0.16, 1.42 + G.Models.HOLD_DY, -0.32);
        m.weaponHolder.rotation.x = 0.9 - s * 1.9;
      } else if (held && !this.building) {
        m.armR.rotation.x = Math.PI / 2 + aim * 0.9;
        m.armL.rotation.x = Math.PI / 2 + aim * 0.9;
        m.armL.rotation.y = -0.5;
        m.weaponHolder.rotation.x = aim * 0.9 + (this.reloadT > 0 ? 0.6 : 0) + this.recoil * 2;
        m.weaponHolder.position.set(0.16, 1.3 + G.Models.HOLD_DY + aim * 0.2, -0.42);
      } else {
        m.armL.rotation.x = -sw * 0.8; m.armR.rotation.x = sw * 0.8;
      }
      m.head.rotation.x = aim * 0.5;
    }
  }

  // Rayo contra caja (devuelve distancia o -1)
  function slab(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    const idx = 1 / (dx || 1e-9), idy = 1 / (dy || 1e-9), idz = 1 / (dz || 1e-9);
    let t1 = (x0 - ox) * idx, t2 = (x1 - ox) * idx;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    t1 = (y0 - oy) * idy; t2 = (y1 - oy) * idy;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (z0 - oz) * idz; t2 = (z1 - oz) * idz;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax < 0 || tmin > tmax) return -1;
    return tmin < 0 ? 0 : tmin;
  }

  G.Character = Character;
})();

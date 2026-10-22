/* =====================================================================
   vehicles.js — Motos que se pueden conducir.
   E para subir/bajar · W acelera · S frena (y marcha atrás) · A/D giran ·
   Espacio da un saltito. Por carretera o por la ciudad corren más.
   Si atropellas a alguien le haces daño; si te estrellas contra una pared
   a mucha velocidad, te lo haces tú.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  const COLORS = [0xd62828, 0x1f6feb, 0xffb703, 0x2a9d8f, 0x8338ec, 0xf15bb5, 0x222222, 0xfb8500];
  const V = C.moto;
  const _off = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  const VH = (G.Vehicles = {
    list: [],

    init(scene) {
      this.group = new THREE.Group();
      scene.add(this.group);
    },

    reset() {
      for (const v of this.list) this.group.remove(v.model.root);
      this.list = [];
    },

    // Una moto en cada sitio que ha marcado el mundo (siempre los mismos: así coinciden en multijugador)
    spawnAll() {
      this.reset();
      (G.World.motoSpots || []).forEach((s, i) => this.add(i, s.x, s.y, s.z, s.yaw));
    },

    add(id, x, y, z, yaw) {
      const color = COLORS[id % COLORS.length];
      const model = G.Models.makeMoto(color);
      this.group.add(model.root);
      const v = {
        id, model, color,
        pos: new THREE.Vector3(x, y, z),
        yaw: yaw || 0, speed: 0, pitch: 0, lean: 0.18,
        rider: null, onGround: true, climb: 0, wheelRot: 0,
        hitCd: new Map(),
        ent: null,
      };
      v.ent = { pos: v.pos, vel: new THREE.Vector3(), radius: V.radius, height: 1.25, onGround: true, groundY: y };
      v.pos.y = G.Phys.groundAt(x, z, 0.4, y + 1, 0.6);
      this.list.push(v);
      this.sync(v, 0);
      return v;
    },

    get(id) { return this.list[id] || null; },

    // La moto libre más cercana (para subirse)
    nearestFree(ch, maxD) {
      let best = null, bd = maxD;
      for (const v of this.list) {
        if (v.rider) continue;
        const d = Math.hypot(v.pos.x - ch.pos.x, v.pos.z - ch.pos.z);
        if (d < bd && Math.abs(v.pos.y - ch.pos.y) < 1.8) { bd = d; best = v; }
      }
      return best;
    },

    mount(ch, v, fromNet) {
      if (!v || v.rider || ch.vehicle || !ch.alive) return false;
      v.rider = ch;
      ch.vehicle = v;
      ch.building = false;
      ch.ads = false;
      ch.crouch = false;
      ch.reloadT = 0;
      ch.useT = 0;
      v.lean = 0;
      if (ch.isPlayer) {
        G.Audio.engineStart();
        G.PlayerCtl.rideYaw = v.yaw;
        ch.yaw = v.yaw;
      }
      if (!fromNet && G.Net && G.Net.active) G.Net.motoMount(v, ch);
      return true;
    },

    dismount(ch, quiet, fromNet) {
      const v = ch.vehicle;
      if (!v) return;
      ch.vehicle = null;
      v.rider = null;
      // bajarse por el lado derecho (o el izquierdo si hay pared)
      const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      for (const s of [1, -1]) {
        ch.pos.set(v.pos.x + rx * 1.0 * s, v.pos.y + 0.1, v.pos.z + rz * 1.0 * s);
        ch.hitWall = false;
        G.Phys.pushOut(ch, 0.6);
        if (!ch.hitWall) break;
      }
      ch.vel.set(-Math.sin(v.yaw) * v.speed * 0.4, 1.5, -Math.cos(v.yaw) * v.speed * 0.4);
      ch.onGround = false;
      v.speed = 0;
      if (ch.isPlayer) { G.Audio.engineStop(); if (!quiet) G.Audio.pickup(); }
      if (!fromNet && G.Net && G.Net.active) G.Net.motoDismount(v, ch);
    },

    /* ---------- Física de la moto ----------
       thr: 1 acelerar, -1 frenar/atrás · steer: 1 izquierda, -1 derecha */
    drive(v, dt, thr, steer, jump) {
      const e = v.ent;
      v.steer = steer;
      const paved = G.World.nearRoad(v.pos.x, v.pos.z, 0.6) ||
        Math.max(Math.abs(v.pos.x), Math.abs(v.pos.z)) < G.World.cityHalf + 1;
      const vmax = paved ? V.maxRoad : V.maxOff;
      const water = v.pos.y < C.waterLevel - 0.35;
      let sp = v.speed;
      if (v.onGround) {
        if (thr > 0) sp += (sp < 0 ? V.brake : U.lerp(V.accel, V.accel * 0.35, U.clamp(sp / vmax, 0, 1))) * dt;
        else if (thr < 0) sp -= (sp > 0 ? V.brake : V.reverseAccel) * dt;
        else sp -= Math.sign(sp) * Math.min(Math.abs(sp), (1.4 + Math.abs(sp) * 0.05) * dt);
        if (sp > vmax) sp = Math.max(vmax, sp - 12 * dt);       // fuera del asfalto se frena sola
        sp = Math.max(sp, -V.maxReverse);
        if (water) sp = U.clamp(sp, -2, 4);
        // cuesta arriba muy empinada: pierde fuerza
        const grade = v.climb / Math.max(2, Math.abs(sp));
        if (sp > 0 && grade > 0.4) sp -= (grade - 0.4) * 30 * dt;
        // girar: más fácil a poca velocidad, más suave a mucha
        const k = U.clamp(Math.abs(sp) / 3.5, 0, 1) / (1 + Math.abs(sp) / 24);
        v.yaw += steer * V.turn * k * (sp < 0 ? -1 : 1) * dt;
      } else {
        v.yaw += steer * 0.9 * dt;
      }
      v.speed = sp;
      const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
      e.vel.x = fx * sp;
      e.vel.z = fz * sp;
      if (jump && v.onGround) { e.vel.y = V.hop; v.onGround = false; e.onGround = false; }
      e.vel.y -= C.gravity * dt;
      const prevY = v.pos.y, wasGround = e.onGround;
      e.hitWall = false;
      e.wallBox = null;
      e.landSpeed = 0;
      G.Phys.moveCharacter(e, dt);
      v.onGround = e.onGround;
      if (v.onGround) v.climb = (v.pos.y - prevY) / Math.max(dt, 1e-3);
      else if (wasGround && e.vel.y <= 0.01) e.vel.y = U.clamp(v.climb, 0, V.maxLaunch);   // salir volando de las rampas
      const rider = v.rider;
      // choque contra una pared
      if (e.hitWall) {
        const impact = Math.abs(v.speed);
        v.speed *= 0.3;
        if (impact > 6) G.Audio.crash(impact, rider && rider.isPlayer ? null : v.pos);
        if (impact > V.crashSpeed && rider) G.Combat.damage(rider, (impact - V.crashSpeed) * 2.5, null, null, false, 'fall');
        // una pared construida o del mapa recibe un golpe
        if (impact > 10 && e.wallBox && e.wallBox.g && rider) G.Destruct.damage(e.wallBox.g, impact * 3, rider, null, false);
      }
      // aterrizaje muy fuerte
      if (e.landSpeed > V.safeLand && rider) G.Combat.damage(rider, (e.landSpeed - V.safeLand) * 3, null, null, false, 'fall');
      // atropellos
      if (rider && Math.abs(v.speed) > V.hitSpeed) this.runOver(v, rider);
      return v;
    },

    runOver(v, rider) {
      const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
      const px = v.pos.x + fx * 0.6 * Math.sign(v.speed), pz = v.pos.z + fz * 0.6 * Math.sign(v.speed);
      const now = G.Game.time;
      for (const c of G.Game.characters) {
        if (c === rider || !c.alive || c.mode !== 'ground' || c.vehicle) continue;
        const dx = c.pos.x - px, dz = c.pos.z - pz;
        if (dx * dx + dz * dz > 1.15 * 1.15 || Math.abs(c.pos.y - v.pos.y) > 1.6) continue;
        if ((v.hitCd.get(c) || 0) > now) continue;
        v.hitCd.set(c, now + 0.8);
        const dmg = Math.round(Math.abs(v.speed) * V.hitDamage);
        if (!c.puppet && !c.remote) {
          c.vel.x += fx * v.speed * 0.5; c.vel.z += fz * v.speed * 0.5; c.vel.y = 5.5; c.onGround = false;
        }
        G.Combat.damage(c, dmg, rider, 'moto', false);
        G.Audio.crash(10, rider.isPlayer ? null : v.pos);
        v.speed *= 0.7;
      }
    },

    // Coloca al piloto en el asiento
    seat(v) {
      const ch = v.rider;
      if (!ch) return;
      _off.set(0, 0.1, -0.08).applyAxisAngle(UP, v.yaw);
      ch.pos.copy(v.pos).add(_off);
      ch.vel.set(-Math.sin(v.yaw) * v.speed, 0, -Math.cos(v.yaw) * v.speed);
      ch.moving = Math.abs(v.speed) > 1;
      ch.onGround = v.onGround;
      ch.groundY = v.ent.groundY;
    },

    /* ---------- Cada fotograma ---------- */
    update(dt) {
      for (const v of this.list) {
        const r = v.rider;
        if (r && !r.alive) this.dismount(r, true);
        if (v.rider) {
          // la del jugador ya se ha movido en PlayerCtl; las de otros jugadores las mueve la red
          if (!v.rider.isPlayer && !v.rider.puppet && !v.rider.remote) this.drive(v, dt, 0, 0, false);
        } else if (Math.abs(v.speed) > 0.05 || !v.onGround) {
          // sin piloto: sigue rodando hasta pararse
          v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 9 * dt);
          this.drive(v, dt, 0, 0, false);
        }
        this.seat(v);
        this.sync(v, dt);
      }
    },

    // Mover el modelo 3D (inclinación con el terreno, tumbarse en las curvas, ruedas girando)
    sync(v, dt) {
      const m = v.model;
      m.root.position.copy(v.pos);
      m.root.rotation.y = v.yaw;
      let pitchT = 0;
      if (v.onGround) {
        const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
        const hf = G.Phys.groundAt(v.pos.x + fx * 0.8, v.pos.z + fz * 0.8, 0.2, v.pos.y + 0.5, 0.6);
        const hb = G.Phys.groundAt(v.pos.x - fx * 0.7, v.pos.z - fz * 0.7, 0.2, v.pos.y + 0.5, 0.6);
        if (Math.abs(hf - hb) < 1.2) pitchT = Math.atan2(hf - hb, 1.5);
      } else pitchT = U.clamp(Math.atan2(v.ent.vel.y, Math.max(5, Math.abs(v.speed))) * 0.6, -0.5, 0.5);
      v.pitch += (pitchT - v.pitch) * Math.min(1, dt * 10);
      const leanT = v.rider ? (v.steer || 0) * U.clamp(Math.abs(v.speed) / 12, 0, 1) * 0.42 : (Math.abs(v.speed) < 0.3 ? 0.18 : 0);
      v.lean += (leanT - v.lean) * Math.min(1, dt * 6);
      m.tilt.rotation.set(v.pitch, 0, v.lean);
      v.wheelRot -= (v.speed * dt) / 0.36;
      m.wf.rotation.x = m.wr.rotation.x = v.wheelRot;
      m.blob.visible = G.Game.blobShadows && v.onGround;
    },
  });
})();

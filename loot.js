/* =====================================================================
   loot.js — El botín: armas, curas (pociones y botiquines), munición y
   materiales en el suelo, y los cofres que sueltan objetos al abrirlos.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  const L = (G.Loot = {
    items: [],
    chests: [],
    byId: new Map(),      // objetos por número (para el multijugador)
    nextId: 1,
    cullT: 0,
    viewDist: 80,

    init(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      scene.add(this.group);
      this.sparkTex = G.makeGlowTexture('rgba(255,250,210,1)', 'rgba(255,200,60,0.8)');
      this.sparkMat = new THREE.SpriteMaterial({ map: this.sparkTex, color: 0xffd34d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    },

    reset() {
      for (const it of this.items) this.group.remove(it.obj);
      for (const c of this.chests) this.group.remove(c.obj);
      this.items = [];
      this.chests = [];
      this.byId.clear();
    },

    /* ---------- Crear objetos ---------- */
    makeWeapon(type, rarity) {
      const def = G.WEAPONS[type];
      return { kind: 'weapon', type, rarity, mag: def.mag, def };
    },
    makeCons(cid, count) {
      return { kind: 'cons', cid, count: count || 1, def: G.CONSUMABLES[cid] };
    },

    randomWeapon(table) {
      const types = G.WEAPON_IDS;
      const type = types[U.weighted(types.map((t) => G.WEAPONS[t].weight))];
      // algunas armas (el lanzamisiles) no salen por debajo de cierta rareza
      const rarity = Math.max(G.WEAPONS[type].minRarity || 0, U.weighted(G.RARITY_WEIGHTS[table]));
      return this.makeWeapon(type, rarity);
    },
    // un tipo de munición al azar (unas son más fáciles de encontrar que otras)
    randomAmmo() {
      return G.AMMO_IDS[U.weighted(G.AMMO_IDS.map((a) => G.AMMO_DROP[a] || 10))];
    },

    weaponName(w) {
      return w.def.name + ' ' + G.RARITIES[w.rarity].name[w.def.fem ? 1 : 0].toLowerCase();
    },
    // nombre de cualquier cosa del inventario
    slotName(s) {
      if (!s) return '';
      if (s === 'pickaxe') return G.PICKAXE.name;
      if (s.kind === 'weapon') return this.weaponName(s);
      return s.def.name + (s.count > 1 ? ' x' + s.count : '');
    },

    itemLabel(it) {
      if (it.kind === 'weapon') return this.weaponName(it.weapon);
      if (it.kind === 'cons') return this.slotName(it.cons);
      if (it.kind === 'ammo') return G.AMMO[it.ammo].name + ' x' + it.amount;
      return G.MATERIALS[it.mat].name + ' x' + it.amount;
    },

    /* ---------- Objetos del suelo ----------
       kind: 'weapon' (data = arma), 'cons' (data = cura), 'ammo' {ammo, amount}, 'mat' {mat, amount} */
    spawn(kind, data, x, y, z, vel, netId) {
      // en multijugador, un invitado no crea objetos: se lo pide al anfitrión
      if (G.Net.isClient && G.Net.inMatch && netId === undefined) { G.Net.requestDrop(kind, data, x, y, z, vel); return null; }
      const obj = new THREE.Group();
      let mesh, ringHex;
      if (kind === 'weapon') {
        mesh = G.Models.weaponMesh(data.type, data.rarity);
        mesh.scale.setScalar(1.25);
        mesh.rotation.y = Math.PI / 2;
        mesh.position.y = 0.45;
        ringHex = G.RARITIES[data.rarity].hex;
      } else if (kind === 'cons') {
        mesh = new THREE.Mesh(G.Models.consumableGeometry(data.cid), data.cid === 'potion' ? G.Models.potionMaterial : G.vcMaterial);
        mesh.position.y = 0.2;
        ringHex = data.def.hex;
      } else if (kind === 'ammo') {
        mesh = new THREE.Mesh(G.Models.ammoGeometry(data.ammo), G.vcMaterial);
        mesh.position.y = 0.15;
        ringHex = G.AMMO[data.ammo].hex;
      } else {
        mesh = new THREE.Mesh(G.Models.matGeometry(data.mat), G.vcMaterial);
        mesh.position.y = 0.12;
        ringHex = G.MATERIALS[data.mat].hex;
      }
      mesh.castShadow = false;
      obj.add(mesh);
      const ring = new THREE.Mesh(G.Models.ringGeometry, G.Models.ringFor(ringHex));
      ring.position.y = 0.04;
      obj.add(ring);
      if (kind === 'weapon' && data.rarity >= 3) obj.add(new THREE.Mesh(G.Models.beamGeometry, G.Models.beamFor(ringHex)));
      obj.position.set(x, y, z);
      this.group.add(obj);
      const it = {
        id: netId !== undefined ? netId : this.nextId++, kind, obj, mesh,
        pos: obj.position,
        vel: vel ? vel.clone() : null,
        phase: Math.random() * 6.28,
        weapon: kind === 'weapon' ? data : null,
        cons: kind === 'cons' ? data : null,
        ammo: kind === 'ammo' ? data.ammo : null,
        mat: kind === 'mat' ? data.mat : null,
        amount: data.amount || 1,
        alive: true,
        claim: 0,
      };
      this.items.push(it);
      this.byId.set(it.id, it);
      if (netId !== undefined && netId >= this.nextId) this.nextId = netId + 1;
      G.Net.lootAdded(it);
      return it;
    },

    // Mete en el suelo una cosa del inventario (arma o cura)
    spawnSlot(s, x, y, z, vel) {
      if (s.kind === 'weapon') return this.spawn('weapon', s, x, y, z, vel);
      return this.spawn('cons', s, x, y, z, vel);
    },

    spawnWeaponWithAmmo(w, x, y, z, vel, extraAmmo) {
      this.spawn('weapon', w, x, y, z, vel);
      const at = w.def.ammo;
      const a = Math.random() * 6.28;
      const v2 = vel ? new THREE.Vector3(Math.cos(a) * 2.5, 5, Math.sin(a) * 2.5) : null;
      this.spawn('ammo', { ammo: at, amount: G.AMMO[at].pickup * (extraAmmo || 1) }, x + Math.cos(a) * 0.9, y, z + Math.sin(a) * 0.9, v2);
    },

    remove(it, fromNet) {
      if (!it.alive) return;
      it.alive = false;
      this.byId.delete(it.id);
      if (!fromNet) G.Net.lootRemoved(it);
      this.group.remove(it.obj);
      const i = this.items.indexOf(it);
      if (i >= 0) { this.items[i] = this.items[this.items.length - 1]; this.items.pop(); }
    },

    /* ---------- Repartir el botín al empezar ---------- */
    populate() {
      // con muchos bots aparece botín en más sitios (para que haya armas para todos)
      const n = G.SETTINGS.bots + 1;
      const fill = n > 60 ? 0.97 : n > 35 ? 0.9 : 0.82;
      for (const s of G.World.lootSpots) {
        if (Math.random() > fill) continue;
        const k = Math.random();
        if (k < 0.46) this.spawnWeaponWithAmmo(this.randomWeapon('floor'), s.x, s.y, s.z);
        else if (k < 0.7) {
          const at = this.randomAmmo();
          this.spawn('ammo', { ammo: at, amount: G.AMMO[at].pickup }, s.x, s.y, s.z);
        } else if (k < 0.84) this.spawn('cons', this.makeCons('potion'), s.x, s.y, s.z);
        else if (k < 0.93) this.spawn('cons', this.makeCons('medkit'), s.x, s.y, s.z);
        else this.spawn('mat', { mat: U.pick(G.MATERIAL_IDS), amount: 30 }, s.x, s.y, s.z);
      }
      for (const s of G.World.chestSpots) {
        if (!s.noBot && Math.random() > (n > 60 ? 0.97 : 0.88)) continue;
        const c = this.addChest(s.x, s.y, s.z, s.rot);
        if (s.noBot) c.noBot = true;    // en lo alto de un árbol: los bots no saben subir
      }
    },

    // Invitado en multijugador: el botín que ha repartido el anfitrión
    loadNet(loot, chests) {
      for (const s of loot) {
        const [kind, data] = G.Net.Code.lootData(s[1], s[2], s[3], s[10]);
        this.spawn(kind, data, s[4], s[5], s[6], s[11] ? new THREE.Vector3(s[7], s[8], s[9]) : null, s[0]);
      }
      for (const c of chests) { const ch = this.addChest(c[0], c[1], c[2], c[3]); if (c[4]) ch.noBot = true; }
    },

    addChest(x, y, z, rot) {
      const obj = new THREE.Group();
      const mesh = new THREE.Mesh(G.Models.chestGeometry(false), G.vcMaterial);
      mesh.castShadow = true;
      obj.add(mesh);
      const spark = new THREE.Sprite(this.sparkMat);
      spark.position.y = 1.0;
      spark.scale.setScalar(1.4);
      obj.add(spark);
      obj.position.set(x, y, z);
      obj.rotation.y = rot || 0;
      this.group.add(obj);
      const c = { id: this.chests.length, obj, mesh, spark, pos: obj.position, opened: false, claim: 0 };
      this.chests.push(c);
      return c;
    },

    openChest(c, by, fromNet) {
      if (c.opened) return;
      // en multijugador, el invitado pide abrirlo y el anfitrión decide qué sale
      if (G.Net.isClient && G.Net.inMatch && !fromNet) { G.Net.requestChest(c); return; }
      c.opened = true;
      c.mesh.geometry = G.Models.chestGeometry(true);
      c.obj.remove(c.spark);
      const p = c.pos;
      const out = (a, sp) => new THREE.Vector3(Math.cos(a) * sp, 6, Math.sin(a) * sp);
      // dirección hacia la que mira el frente del cofre
      const rot = c.obj.rotation.y || 0;
      const base = Math.atan2(-Math.cos(rot), -Math.sin(rot));
      if (!G.Net.isClient) {
        const w = this.randomWeapon('chest');
        this.spawnWeaponWithAmmo(w, p.x, p.y + 0.6, p.z, out(base, 2.6));
        const at = this.randomAmmo();
        this.spawn('ammo', { ammo: at, amount: G.AMMO[at].pickup }, p.x, p.y + 0.6, p.z, out(base + 0.9, 2.4));
        if (Math.random() < 0.65) this.spawn('cons', this.makeCons(Math.random() < 0.6 ? 'potion' : 'medkit'), p.x, p.y + 0.6, p.z, out(base - 0.9, 2.4));
        this.spawn('mat', { mat: U.pick(G.MATERIAL_IDS), amount: 30 }, p.x, p.y + 0.6, p.z, out(base + 1.8, 2.2));
        G.Net.chestOpened(c, by);
      }
      G.Effects.burst(p.x, p.y + 0.8, p.z, 0xffd34d, 26, 4, 0.9, 6);
      G.Audio.chest(p);
      if (by && by.isPlayer) G.Game.stats.chests++;
    },

    /* ---------- Soltar todo al morir ---------- */
    dropAll(ch) {
      const p = ch.pos;
      let k = 0;
      const vel = () => { const a = (k++ / 9) * Math.PI * 2 + Math.random() * 0.5; return new THREE.Vector3(Math.cos(a) * 2.8, 6, Math.sin(a) * 2.8); };
      for (let i = 0; i < ch.slots.length; i++) {
        const s = ch.slots[i];
        if (!s) continue;
        this.spawnSlot(s, p.x, p.y + 0.8, p.z, vel());
        ch.slots[i] = null;
      }
      for (const at of G.AMMO_IDS) {
        if (ch.ammo[at] > 0) this.spawn('ammo', { ammo: at, amount: ch.ammo[at] }, p.x, p.y + 0.8, p.z, vel());
        ch.ammo[at] = 0;
      }
      for (const m of G.MATERIAL_IDS) {
        if (ch.mats[m] > 0) this.spawn('mat', { mat: m, amount: ch.mats[m] }, p.x, p.y + 0.8, p.z, vel());
        ch.mats[m] = 0;
      }
    },

    dropSlotItem(ch, s) {
      const a = ch.yaw;
      const v = new THREE.Vector3(-Math.sin(a) * 3, 4, -Math.cos(a) * 3);
      this.spawnSlot(s, ch.pos.x, ch.pos.y + 1, ch.pos.z, v);
    },

    // Cuando algo se rompe, lo que había encima vuelve a caer
    unsettle(min, max) {
      for (const it of this.items) {
        if (it.vel) continue;
        const p = it.pos;
        if (p.x > min[0] - 0.5 && p.x < max[0] + 0.5 && p.z > min[2] - 0.5 && p.z < max[2] + 0.5 && p.y > min[1] - 0.5 && p.y < max[1] + 1.5) {
          it.vel = new THREE.Vector3(0, 0, 0);
        }
      }
      for (const c of this.chests) {
        const p = c.pos;
        if (p.x > min[0] - 0.5 && p.x < max[0] + 0.5 && p.z > min[2] - 0.5 && p.z < max[2] + 0.5 && p.y > min[1] - 0.5 && p.y < max[1] + 1.5) {
          c.pos.y = G.Phys.groundAt(p.x, p.z, 0.3, p.y - 0.4, 0);
        }
      }
    },

    /* ---------- Actualizar cada fotograma ---------- */
    update(dt, camPos, time) {
      for (const it of this.items) {
        if (it.vel) {
          it.vel.y -= 20 * dt;
          it.vel.x *= 1 - 1.5 * dt; it.vel.z *= 1 - 1.5 * dt;
          const oy = it.pos.y;
          it.pos.addScaledVector(it.vel, dt);
          const g = G.Phys.groundAt(it.pos.x, it.pos.z, 0.15, Math.max(oy, it.pos.y), 0.3);
          if (it.pos.y <= g) { it.pos.y = g; it.vel = null; }
          G.Phys.pushOut({ pos: it.pos, radius: 0.25, height: 0.5 }, 0.3);
        }
        if (!it.obj.visible) continue;
        it.mesh.rotation.y = (it.kind === 'weapon' ? Math.PI / 2 : 0) + time * 1.2 + it.phase;
        if (it.kind === 'weapon') it.mesh.position.y = 0.45 + Math.sin(time * 2 + it.phase) * 0.07;
      }
      this.sparkMat.opacity = 0.55 + Math.sin(time * 4) * 0.35;
      this.cullT -= dt;
      if (this.cullT <= 0) {
        this.cullT = 0.25;
        const d2 = this.viewDist * this.viewDist;
        for (const it of this.items) {
          const dx = it.pos.x - camPos.x, dz = it.pos.z - camPos.z, dy = it.pos.y - camPos.y;
          it.obj.visible = dx * dx + dz * dz + dy * dy < d2;
        }
        for (const c of this.chests) {
          const dx = c.pos.x - camPos.x, dz = c.pos.z - camPos.z;
          c.obj.visible = dx * dx + dz * dz < d2 * 1.4;
        }
      }
    },

    // Objeto o cofre más cercano con el que interactuar (para el jugador)
    nearestInteractable(ch, maxD) {
      let best = null, bd = maxD;
      const px = ch.pos.x, py = ch.pos.y, pz = ch.pos.z;
      const fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw);
      const score = (x, y, z) => {
        const dx = x - px, dz = z - pz, dy = y - py;
        if (Math.abs(dy) > 1.6) return Infinity;
        const d = Math.hypot(dx, dz);
        const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
        return d - facing * 0.6;
      };
      for (const it of this.items) {
        if ((it.kind !== 'weapon' && it.kind !== 'cons') || it.vel) continue;
        const s = score(it.pos.x, it.pos.y, it.pos.z);
        if (s < bd) { bd = s; best = { type: 'item', item: it }; }
      }
      for (const c of this.chests) {
        if (c.opened) continue;
        const s = score(c.pos.x, c.pos.y, c.pos.z) - 0.3;
        if (s < bd) { bd = s; best = { type: 'chest', chest: c }; }
      }
      return best;
    },
  });
})();

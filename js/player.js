/* =====================================================================
   player.js — Teclado y ratón (Input) + control del jugador, la cámara
   (tercera persona por encima del hombro, o primera persona), el pico,
   las curas y el modo construcción.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;

  /* ---------- Entrada ---------- */
  const I = (G.Input = {
    keys: {}, pressed: {}, mdx: 0, mdy: 0, buttons: [false, false, false], clicked: [false, false, false], wheel: 0, locked: false,

    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        // escribiendo en un cuadro de texto (nombre, contraseña…) las teclas son para el cuadro
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Tab' || e.code === 'Space' || (this.locked && (e.code === 'KeyQ' || e.code === 'KeyF'))) e.preventDefault();
        if (!this.keys[e.code]) this.pressed[e.code] = true;
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      // al cambiar de ventana se "sueltan" todas las teclas (si no, el personaje seguiría andando o disparando)
      window.addEventListener('blur', () => { this.keys = {}; this.pressed = {}; this.buttons = [false, false, false]; this.clicked = [false, false, false]; });
      document.addEventListener('mousemove', (e) => {
        if (!this.locked) return;
        const mx = e.movementX || 0, my = e.movementY || 0;
        // algunos navegadores mandan saltos enormes al bloquear el ratón: los ignoramos
        if (Math.abs(mx) > 450 || Math.abs(my) > 450) return;
        this.mdx += mx;
        this.mdy += my;
      });
      document.addEventListener('mousedown', (e) => {
        if (!this.locked) return;
        this.buttons[e.button] = true;
        this.clicked[e.button] = true;
      });
      window.addEventListener('mouseup', (e) => { this.buttons[e.button] = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
      document.addEventListener('pointerlockchange', () => {
        this.locked = !!this.canvas && document.pointerLockElement === this.canvas;
        if (!this.locked) this.buttons = [false, false, false];
        if (G.Game) G.Game.onLockChange(this.locked);
      });
      document.addEventListener('pointerlockerror', () => { if (G.Game) G.Game.onLockError(); });
    },

    // Bloquea el ratón dentro del juego. Primero intenta el modo "sin aceleración" (más preciso)
    lock() {
      const c = this.canvas;
      if (document.pointerLockElement === c) return;
      const plain = () => {
        try {
          const p = c.requestPointerLock();
          if (p && p.catch) p.catch(() => { if (G.Game) G.Game.onLockError(); });
        } catch (e) { if (G.Game) G.Game.onLockError(); }
      };
      try {
        const p = c.requestPointerLock({ unadjustedMovement: true });
        if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotSupportedError') plain(); else if (G.Game) G.Game.onLockError(); });
      } catch (e) { plain(); }
    },
    unlock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); },
    down(code) { return !!this.keys[code]; },
    hit(code) { return !!this.pressed[code]; },
    endFrame() {
      this.pressed = {};
      this.clicked = [false, false, false];
      this.mdx = 0; this.mdy = 0; this.wheel = 0;
    },
  });

  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _piv = new THREE.Vector3();
  const _cam = new THREE.Vector3(), _o = new THREE.Vector3(), _p = new THREE.Vector3(), _tmp = new THREE.Vector3();

  /* ---------- Jugador ---------- */
  const P = (G.PlayerCtl = {
    ch: null,
    scoped: false,
    breath: 4,          // segundos que puedes aguantar la respiración con la mira telescópica
    fov: 75,
    camDist: 3.2,
    vmKick: 0,
    crouchToggle: false,
    pieceIdx: 0,
    matIdx: 0,
    rot: 0,
    buildT: 0,
    lastKey: '',

    init(vmScene) {
      // lo que llevas en la mano en primera persona (escena aparte, se dibuja encima de todo)
      this.vmScene = vmScene;
      this.vmRoot = new THREE.Group();
      vmScene.add(this.vmRoot);
      this.vmHolder = new THREE.Group();
      this.vmRoot.add(this.vmHolder);
      this.vmKey = '';
    },

    setCharacter(ch) {
      this.ch = ch; this.scoped = false; this.crouchToggle = false;
      this.pieceIdx = 0; this.rot = 0; this.target = null; this.buildTarget = null;
      G.Build.showGhost(null);
    },

    get firstPerson() {
      return this.scoped || (G.SETTINGS.camera === 'primera' && !!this.ch && this.ch.mode === 'ground' && !this.ch.vehicle);
    },
    get pieceType() { return G.PIECE_IDS[this.pieceIdx]; },
    get matId() { return G.MATERIAL_IDS[this.matIdx]; },

    forward(out) {
      const ch = this.ch, cp = Math.cos(ch.pitch);
      return out.set(-Math.sin(ch.yaw) * cp, Math.sin(ch.pitch), -Math.cos(ch.yaw) * cp);
    },

    setBuilding(on) {
      const ch = this.ch;
      if (on === !!ch.building) return;
      ch.building = on;
      ch.ads = false; ch.reloadT = 0; ch.useT = 0;
      this.lastKey = '';
      if (!on) G.Build.showGhost(null);
      else {
        // si no tienes material del elegido, escoger uno que sí tengas
        if (ch.mats[this.matId] < C.build.cost) {
          const i = G.MATERIAL_IDS.findIndex((m) => ch.mats[m] >= C.build.cost);
          if (i >= 0) this.matIdx = i;
        }
      }
    },

    update(dt, camera) {
      const ch = this.ch;
      if (!ch) return;
      const invOpen = G.HUD.invOpen;

      // mirar con el ratón
      if (ch.alive && !invOpen) {
        const fovMul = this.fov / 75;
        const sens = 0.0022 * G.SETTINGS.sensitivity * (ch.ads ? 0.75 : 1) * fovMul;
        ch.yaw -= I.mdx * sens;
        ch.pitch = U.clamp(ch.pitch - I.mdy * sens, -1.48, 1.48);
      }

      // dirección de movimiento según WASD
      let fw = 0, st = 0;
      if (I.down('KeyW')) fw += 1;
      if (I.down('KeyS')) fw -= 1;
      if (I.down('KeyD')) st += 1;
      if (I.down('KeyA')) st -= 1;
      const fx = -Math.sin(ch.yaw), fz = -Math.cos(ch.yaw);
      const rx = Math.cos(ch.yaw), rz = -Math.sin(ch.yaw);
      let wx = fx * fw + rx * st, wz = fz * fw + rz * st;
      const wl = Math.hypot(wx, wz);
      if (wl > 0) { wx /= wl; wz /= wl; }

      if (ch.mode === 'ground' && ch.alive && ch.vehicle) {
        this.updateRide(dt, invOpen);
      } else if (ch.mode === 'ground' && ch.alive) {
        if (I.hit('KeyC')) this.crouchToggle = !this.crouchToggle;
        ch.crouch = this.crouchToggle || I.down('ControlLeft');
        if (!invOpen) this.handleKeys();
        const w = ch.weapon;
        ch.ads = !ch.building && !invOpen && I.buttons[2] && !!w && ch.useT <= 0;
        this.scoped = ch.ads && w && w.def.scope && ch.reloadT <= 0;
        const wantSprint = I.down('ShiftLeft') && fw > 0 && !ch.ads && !ch.crouch && ch.useT <= 0;
        const sprint = wantSprint && ch.canSprint();
        ch.updateStamina(dt, sprint && ch.moving);
        if (wantSprint && ch.tired && I.hit('ShiftLeft')) G.HUD.toast('Estás cansado: espera a recuperar el aliento');
        const walk = ch.tired ? C.player.tiredSpeed : C.player.walk;
        let speed = ch.crouch ? C.player.crouchSpeed : ch.ads ? C.player.adsSpeed : sprint ? C.player.sprint : walk;
        if (ch.useT > 0) speed = Math.min(speed, C.player.useSpeed);
        if (I.hit('Space') && ch.crouch) this.crouchToggle = false;
        ch.groundMove(dt, wx, wz, speed, I.hit('Space'));
        ch.autoPickup();
      } else if ((ch.mode === 'dive' || ch.mode === 'glide') && ch.alive) {
        this.scoped = false;
        ch.ads = false;
        ch.crouch = false;
        this.target = null;
        if (ch.building) this.setBuilding(false);
        // en picado: mirando hacia abajo (sin pulsar S) se cae mucho más rápido
        const dive = ch.mode === 'dive' && fw >= 0 && ch.pitch < -0.3;
        const above = ch.airMove(dt, wx, wz, dive);
        this.heightAbove = above;
        // el planeador se puede abrir a mano sólo tras un momento de caída libre
        if (I.hit('Space') && ch.mode === 'dive' && ch.diveT > 0.8 && above < C.sky.manualGlide) ch.openGlider();
      } else {
        this.scoped = false;
        this.target = null;
      }

      ch.updateTimers(dt);
      this.updateCamera(dt, camera);

      // acción principal (después de colocar la cámara, para apuntar justo al centro)
      if (ch.mode === 'ground' && ch.alive && !invOpen && !ch.vehicle) {
        if (ch.building) this.updateBuild(dt, camera);
        else if (I.buttons[0] || I.clicked[0]) {
          const aim = this.aim(camera);
          const held = ch.held;
          const mz = this.firstPerson && ch.weapon ? this.vmMuzzle() : null;
          if (G.Combat.tryFire(ch, aim.origin, aim.dir, I.clicked[0], 0, mz)) {
            this.vmKick = 1;
            if (ch.weapon) {
              // retroceso: la mira sube un poco
              ch.pitch = U.clamp(ch.pitch + ch.weapon.def.recoil * (ch.ads ? 0.5 : 1) * (0.6 + Math.random() * 0.6), -1.48, 1.48);
              ch.yaw += (Math.random() - 0.5) * ch.weapon.def.recoil * 0.4;
            }
          } else if (held === 'pickaxe') { /* esperando al siguiente golpe */ }
        }
      }
      this.updateViewmodel(dt, camera);
    },

    handleKeys() {
      const ch = this.ch;
      if (I.hit('KeyQ')) this.setBuilding(!ch.building);
      if (ch.building) {
        for (let i = 0; i < 4; i++) if (I.hit('Digit' + (i + 1))) { this.pieceIdx = i; this.lastKey = ''; }
        if (I.wheel) { this.pieceIdx = (this.pieceIdx + (I.wheel > 0 ? 1 : -1) + 4) % 4; this.lastKey = ''; }
        if (I.hit('KeyR')) this.rot = (this.rot + 1) % 4;
        if (I.clicked[2]) {
          this.matIdx = (this.matIdx + 1) % 3;
          G.HUD.toast('Material: ' + G.MATERIALS[this.matId].name);
        }
        if (I.hit('KeyF') || I.hit('Digit5')) { this.setBuilding(false); ch.selectSlot(I.hit('KeyF') ? -1 : 4); }
        this.target = null;
        return;
      }
      for (let i = 0; i < C.slots; i++) if (I.hit('Digit' + (i + 1))) ch.selectSlot(i);
      if (I.hit('KeyF')) ch.selectSlot(-1);
      if (I.wheel) {
        // la rueda recorre: pico, 1, 2, 3, 4, 5
        const n = C.slots + 1;
        ch.selectSlot(((ch.sel + 1 + (I.wheel > 0 ? 1 : -1) + n) % n) - 1);
      }
      if (I.hit('KeyR')) ch.startReload();
      const w = ch.weapon;
      // recarga automática si el cargador se queda vacío
      if (w && w.mag === 0 && ch.reloadT <= 0 && ch.useT <= 0 && ch.fireCd <= 0) ch.startReload();
      // interactuar (objetos, cofres y motos)
      this.target = G.Loot.nearestInteractable(ch, C.pickupRadius);
      const mv = G.Vehicles.nearestFree(ch, 2.3);
      if (mv) {
        const dm = Math.hypot(mv.pos.x - ch.pos.x, mv.pos.z - ch.pos.z);
        const lt = this.target;
        const dl = lt ? (lt.type === 'item' ? lt.item.pos : lt.chest.pos).distanceTo(ch.pos) : Infinity;
        if (dm < dl) this.target = { type: 'moto', moto: mv };
      }
      if (I.hit('KeyE') && this.target) {
        if (this.target.type === 'moto') G.Vehicles.mount(ch, this.target.moto);
        else if (this.target.type === 'item') ch.pickupSlotItem(this.target.item);
        else G.Loot.openChest(this.target.chest, ch);
        this.target = null;
      }
    },

    /* ---------- Conducir la moto ---------- */
    updateRide(dt, invOpen) {
      const ch = this.ch, v = ch.vehicle;
      this.scoped = false;
      ch.ads = false;
      ch.crouch = false;
      this.crouchToggle = false;
      this.target = null;
      if (ch.building) this.setBuilding(false);
      let thr = 0, steer = 0;
      if (!invOpen) {
        thr = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0);
        steer = (I.down('KeyA') ? 1 : 0) - (I.down('KeyD') ? 1 : 0);
        if (I.hit('KeyE')) { G.Vehicles.dismount(ch); return; }
      }
      const y0 = v.yaw;
      G.Vehicles.drive(v, dt, thr, steer, !invOpen && I.hit('Space'));
      // la cámara gira con la moto; si no tocas el ratón un rato, vuelve a ponerse detrás
      ch.yaw += U.angleDiff(y0, v.yaw);
      if (Math.abs(I.mdx) < 0.5) this.rideIdle = (this.rideIdle || 0) + dt; else this.rideIdle = 0;
      if (this.rideIdle > 1.2 && Math.abs(v.speed) > 2) {
        ch.yaw += U.angleDiff(ch.yaw, v.yaw) * Math.min(1, dt * 2.5);
        ch.pitch += (-0.12 - ch.pitch) * Math.min(1, dt * 2);
      }
      G.Vehicles.seat(v);
      ch.autoPickup();
      ch.updateStamina(dt, false);
      G.Audio.engineSet(v.speed, thr);
    },

    /* ---------- Construir ---------- */
    updateBuild(dt, camera) {
      const ch = this.ch;
      ch.eye(_piv);
      camera.getWorldDirection(_f);
      const t = G.Build.target(ch, _piv, _f, this.pieceType, this.rot, this.matId);
      this.buildTarget = t;
      G.Build.showGhost(t);
      this.buildT -= dt;
      if ((I.clicked[0] || (I.buttons[0] && this.buildT <= 0)) && t.valid && t.key !== this.lastKey) {
        if (G.Build.place(ch, t, this.matId)) {
          this.lastKey = t.key;
          this.buildT = 0.12;
          this.vmKick = 1;
        }
      } else if (I.clicked[0] && !t.valid) {
        if (t.why === 'mat') G.HUD.toast('Te falta ' + G.MATERIALS[this.matId].name.toLowerCase() + ' (rompe cosas con el pico)');
        else if (t.why === 'en el aire') G.HUD.toast('Tiene que apoyarse en el suelo o en otra construcción');
      }
      if (!I.buttons[0]) this.lastKey = '';
    },

    updateCamera(dt, camera) {
      const ch = this.ch;
      this.forward(_f);
      _r.set(Math.cos(ch.yaw), 0, -Math.sin(ch.yaw));
      ch.eye(_piv);
      if (ch.mode === 'dead') _piv.y = ch.pos.y + 1.0;

      let targetFov = 75;
      const w = ch.weapon;
      if (ch.ads && w) targetFov = this.scoped ? w.def.adsFov : Math.max(w.def.adsFov, 55);
      if (this.scoped) this.fov = targetFov;
      else this.fov += (targetFov - this.fov) * Math.min(1, dt * 14);
      if (Math.abs(camera.fov - this.fov) > 0.01) { camera.fov = this.fov; camera.updateProjectionMatrix(); }

      if (this.firstPerson && ch.mode !== 'dead') {
        camera.position.copy(_piv);
      } else {
        const air = ch.mode === 'dive' || ch.mode === 'glide';
        const ride = !!ch.vehicle;
        const dist = air ? 7 : ride ? 5.4 : ch.ads ? 1.9 : ch.building ? 3.6 : 3.3;
        const side = air || ride ? 0 : ch.ads ? 0.75 : 1.0;
        const up = air ? 1.6 : ride ? 1.2 : ch.ads ? 0.25 : 0.4;
        this.camDist += (dist - this.camDist) * Math.min(1, dt * 10);
        _cam.copy(_piv).addScaledVector(_r, side);
        _cam.y += up;
        _o.copy(_cam).addScaledVector(_f, -this.camDist);
        // que la cámara no atraviese paredes
        _tmp.subVectors(_o, _piv);
        const len = _tmp.length();
        _tmp.divideScalar(len);
        const hit = G.Phys.raycastWorld(_piv.x, _piv.y, _piv.z, _tmp.x, _tmp.y, _tmp.z, len + 0.3);
        let camD = len;
        if (hit) { camD = Math.max(0.2, hit.t - 0.3); _o.copy(_piv).addScaledVector(_tmp, camD); }
        camera.position.copy(_o);
        this.camClose = camD < 1.2;
      }
      // con la mira telescópica el pulso tiembla un poco (Shift = aguantar la respiración unos segundos)
      let sx = 0, sy = 0;
      if (this.scoped) {
        const t = performance.now() / 1000;
        const hold = I.down('ShiftLeft') && this.breath > 0;
        this.breath = hold ? Math.max(0, this.breath - dt) : Math.min(4, this.breath + dt * 0.7);
        this.holdingBreath = hold;
        const amp = (hold ? 0.1 : this.breath <= 0 ? 1.8 : 1) * (ch.moving ? 2 : 1) * (ch.crouch ? 0.6 : 1);
        sx = (Math.sin(t * 0.9) * 0.0042 + Math.sin(t * 2.1 + 0.5) * 0.0015) * amp;
        sy = (Math.sin(t * 1.3 + 1) * 0.0032 + Math.cos(t * 2.7) * 0.0011) * amp;
      } else { this.holdingBreath = false; this.breath = Math.min(4, (this.breath === undefined ? 4 : this.breath) + dt); }
      camera.rotation.set(ch.pitch + ch.recoil * 0.3 + sy, ch.yaw + sx, 0, 'YXZ');
      camera.updateMatrixWorld();
      // si la cámara queda pegada al personaje (pared detrás), lo ocultamos para que no tape la vista
      this.selfVisible = ch.mode === 'dead' || (!this.firstPerson && !this.camClose);
      ch.model.root.visible = this.selfVisible;
    },

    // Desde dónde y hacia dónde sale la bala (o el golpe del pico)
    aim(camera) {
      const ch = this.ch;
      camera.getWorldDirection(_f);
      if (this.firstPerson) return { origin: _p.copy(camera.position), dir: _f.clone() };
      ch.eye(_piv);
      const t0 = Math.max(0, _tmp.subVectors(_piv, camera.position).dot(_f));
      _o.copy(camera.position).addScaledVector(_f, t0);
      const res = G.Combat.raycast(_o, _f, 600, ch);
      const T = res ? res.t : 600;
      _p.copy(_o).addScaledVector(_f, T);
      const dir = _tmp.subVectors(_p, _piv);
      if (dir.length() < 0.6) dir.copy(_f);
      return { origin: _piv.clone(), dir: dir.normalize().clone() };
    },

    vmMuzzle() {
      if (!this.vmMesh || !this.ch.weapon) return null;
      const v = G.Models.muzzle[this.ch.weapon.type].clone();
      this.vmMesh.updateMatrixWorld();
      return v.applyMatrix4(this.vmMesh.matrixWorld);
    },

    updateViewmodel(dt, camera) {
      const ch = this.ch;
      const held = ch.held;
      const show = this.firstPerson && !this.scoped && ch.alive && ch.mode === 'ground' && !ch.building && !ch.vehicle && !G.HUD.invOpen;
      this.vmRoot.position.copy(camera.position);
      this.vmRoot.quaternion.copy(camera.quaternion);
      const key = G.Models.heldKey(held, ch.pickId);
      if (key !== this.vmKey) {
        if (this.vmMesh) this.vmHolder.remove(this.vmMesh);
        this.vmMesh = G.Models.heldMesh(held, ch.pickId);
        this.vmMesh.castShadow = false;
        // (las armas ya vienen a tamaño real: en primera persona se ven igual que antes)
        const ws = held && held.kind === 'weapon' ? G.Models.weaponScale[held.type] || 1 : 1;
        this.vmMesh.scale.setScalar(held === 'pickaxe' ? 0.55 : held && held.kind === 'cons' ? 0.6 : 0.5 / ws);
        this.vmHolder.add(this.vmMesh);
        this.vmKey = key;
      }
      this.vmHolder.visible = show && !!held;
      this.vmKick = Math.max(0, this.vmKick - dt * 8);
      const bob = ch.moving && ch.onGround ? Math.sin(performance.now() * 0.011) * 0.015 : 0;
      if (held === 'pickaxe') {
        const s = ch.swingT > 0 ? Math.sin((1 - ch.swingT / 0.35) * Math.PI) : 0;
        this.vmHolder.position.set(0.24, -0.2 + bob, -0.38);
        this.vmHolder.rotation.set(0.8 - s * 1.6, 0.25, 0.25);
      } else if (held && held.kind === 'cons') {
        const u = ch.useT > 0 ? 1 : 0;
        this.vmHolder.position.set(0.18 - u * 0.1, -0.24 + u * 0.08 + bob, -0.42);
        this.vmHolder.rotation.set(u * 0.5, 0.4, u * (0.4 + Math.sin(performance.now() * 0.01) * 0.1));
      } else {
        const ads = ch.ads ? 1 : 0;
        this.vmHolder.position.set(U.lerp(0.2, 0.0, ads), U.lerp(-0.18, -0.115, ads) + bob, -0.36 + this.vmKick * 0.04);
        this.vmHolder.rotation.set(this.vmKick * 0.12 + (ch.reloadT > 0 ? -0.7 : 0), U.lerp(0.04, 0, ads), 0);
      }
      this.vmRoot.updateMatrixWorld(true);
    },
  });
})();

/* =====================================================================
   hud.js — La interfaz en pantalla: vida y escudo, barra de objetos
   (pico + 5 huecos), materiales, modo construcción, mira, minimapa,
   números de daño, avisos, kill feed y el INVENTARIO (tecla TAB).
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G, U = G.U, C = G.CONFIG;
  const $ = (id) => document.getElementById(id);

  /* Iconos de las armas: dibujos a color (metal, polímero, madera) con las piezas que las
     distinguen de un vistazo. El cañón apunta a la derecha. viewBox 62 x 40 */
  const MD = '#2a2e35', MM = '#474e58', ML = '#7d8793', MH = '#a9b3bd', PO = '#1f2329';   // metal oscuro/medio/claro/brillo, polímero
  const WD = '#8b5a2b', WL = '#b67a3f', WK = '#5e3a1a';                                 // madera, madera clara, madera oscura
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const WEAPON_ICONS = {
    // pistola: corredera con estrías, empuñadura inclinada con rugosidad y guardamonte
    pistol:
      '<path d="M14 18H46v3H33l-1.5.5H29l-1.5 1.5-1.9 10.5Q25.2 35.5 23 35.5h-5.5q-2.3 0-1.9-2.3L18.3 21 14 20z" fill="' + PO + '"/>' +
      rep(4, (i) => '<path d="M' + (19.6 - i * 0.5) + ' ' + (24 + i * 2.7) + 'h5.6" stroke="#3a3f47" stroke-width="1"/>') +
      '<path d="M27.5 21.5q.5 6 6.5 5l1.5-5.5" fill="none" stroke="' + PO + '" stroke-width="1.6"/>' +
      '<path d="M30.4 21.6q-.3 2.5 1.4 3.3" fill="none" stroke="#5a616b" stroke-width="1.2"/>' +
      '<rect x="13" y="10.5" width="34" height="7.5" rx="1.2" fill="#3a3f47"/>' +
      '<rect x="13" y="10.5" width="34" height="1.8" rx=".9" fill="' + ML + '"/>' +
      rep(4, (i) => '<rect x="' + (15 + i * 1.6) + '" y="12.9" width=".8" height="4" fill="#23272d"/>') +
      '<rect x="30" y="12.8" width="6" height="2" rx=".5" fill="#23272d"/>' +
      '<rect x="14.5" y="9" width="2" height="1.6" fill="#23272d"/><rect x="43.5" y="9" width="1.5" height="1.6" fill="#23272d"/>' +
      '<rect x="46.6" y="12" width="1.6" height="4.5" fill="#15181c"/>',
    // fusil de asalto: culata, raíl con dientes, guardamanos con ranuras, cargador curvo y bocacha
    rifle:
      '<path d="M2 14.5 12 13.5 14 15v7h-3.5L4 25.5H2z" fill="' + PO + '"/>' +
      '<path d="M2.5 15 11.5 14.2v1.3l-9 .8z" fill="' + MM + '"/>' +
      '<rect x="12" y="15" width="6" height="3.5" fill="' + MD + '"/>' +
      '<path d="M19 21h4.5l-2 8.5h-4.7z" fill="' + PO + '"/>' +
      '<path d="M23 21q.5 4.5 5 4V21" fill="none" stroke="' + MD + '" stroke-width="1.2"/>' +
      '<path d="M25.5 21H31l1.3 9q-1.8 2.5-5.1 1.6z" fill="' + MD + '"/>' +
      '<path d="M26 22.4h4.4l.3 1.6h-4.4z" fill="' + MM + '"/>' +
      '<rect x="16" y="13" width="18" height="8" rx="1" fill="' + MM + '"/>' +
      '<rect x="16" y="13" width="18" height="1.6" fill="' + ML + '"/>' +
      '<rect x="20" y="15.6" width="5" height="2" rx=".5" fill="' + MD + '"/>' +
      '<rect x="17" y="10" width="17" height="3" fill="' + MD + '"/>' +
      rep(8, (i) => '<rect x="' + (17.5 + i * 2) + '" y="9.1" width="1" height="1" fill="' + MD + '"/>') +
      '<rect x="34" y="13.5" width="14" height="7" rx="1" fill="' + MD + '"/>' +
      rep(4, (i) => '<rect x="' + (35.6 + i * 3) + '" y="15" width="2" height="1.2" fill="#5a636e"/><rect x="' + (35.6 + i * 3) + '" y="17.8" width="2" height="1.2" fill="#5a636e"/>') +
      '<rect x="48" y="15.6" width="9" height="2.2" fill="' + PO + '"/>' +
      '<rect x="44.6" y="9.4" width="1.6" height="4.2" fill="' + PO + '"/>' +
      '<rect x="56.5" y="14.6" width="4.5" height="4.2" rx=".6" fill="' + MD + '"/>' +
      '<rect x="57.6" y="15.4" width=".8" height="2.6" fill="' + ML + '"/><rect x="59.3" y="15.4" width=".8" height="2.6" fill="' + ML + '"/>',
    // escopeta de corredera: culata de madera con cartuchos, corredera de madera con surcos, tubo-depósito
    shotgun:
      '<path d="M1 18.5 14.5 15h2v6.5h-3L4 26.5q-2.8.7-3-1.7z" fill="' + WD + '"/>' +
      '<path d="M2 18.6 14.5 15.6v1.2L2 19.8z" fill="' + WL + '"/>' +
      '<path d="M1 18.5l1.6-.4v8.2l-1.4.3q-.2-.6-.2-1.8z" fill="' + PO + '"/>' +
      rep(3, (i) => '<rect x="' + (5.8 + i * 2.3) + '" y="19.2" width="1.6" height="3.4" rx=".4" fill="#d62828"/><rect x="' + (5.8 + i * 2.3) + '" y="22.6" width="1.6" height="1" fill="#e0a82e"/>') +
      '<rect x="16" y="13.5" width="12" height="7.5" rx="1" fill="' + MD + '"/>' +
      '<rect x="16" y="13.5" width="12" height="1.4" fill="#5a636e"/>' +
      '<path d="M19 21q.5 4 5 3.5l1-3.5" fill="none" stroke="' + MD + '" stroke-width="1.4"/>' +
      '<rect x="27" y="13.8" width="33" height="2.6" fill="' + MD + '"/>' +
      '<rect x="27" y="13.8" width="33" height=".8" fill="#6b737c"/>' +
      '<rect x="27" y="16.8" width="27" height="2.4" fill="' + MM + '"/>' +
      '<rect x="53" y="16.6" width="2" height="2.8" fill="' + MD + '"/>' +
      '<rect x="33" y="15.8" width="13" height="5.2" rx="1.2" fill="' + WD + '"/>' +
      '<rect x="33" y="15.8" width="13" height="1.1" rx=".5" fill="' + WL + '"/>' +
      rep(5, (i) => '<rect x="' + (35 + i * 2) + '" y="17.2" width=".8" height="3.2" fill="' + WK + '"/>') +
      '<circle cx="58.8" cy="13.2" r=".9" fill="#e0a82e"/>',
    // francotirador: culata táctica, mira telescópica con lente, cerrojo, bípode y freno de boca
    sniper:
      '<path d="M41 21l-4 10M42.6 21l4 10" stroke="' + MD + '" stroke-width="1.3"/>' +
      '<path d="M35.6 31h2.6M45.2 31h2.6" stroke="' + PO + '" stroke-width="1.4"/>' +
      '<path d="M1 20l6-3h15v5h-5q-2 0-3 2l-3 2.5H3q-2 0-2-2z" fill="#44513a"/>' +
      '<path d="M7 17h14v1.2l-15 .2z" fill="#66784f"/>' +
      '<path d="M1 20l1.4-.7v7.2Q1 26.5 1 24.5z" fill="' + PO + '"/>' +
      '<path d="M23 21.5q.5 3.5 4 3" fill="none" stroke="' + MD + '" stroke-width="1.3"/>' +
      '<rect x="33" y="17.4" width="25" height="2" fill="' + PO + '"/>' +
      '<rect x="33" y="17.4" width="25" height=".6" fill="#5a636e"/>' +
      '<rect x="21.5" y="16" width="12" height="5.5" rx="1" fill="' + MD + '"/>' +
      '<path d="M28.6 21.3l2 2.6" stroke="' + ML + '" stroke-width="1.2"/><circle cx="30.9" cy="24.3" r="1.2" fill="' + MH + '"/>' +
      '<rect x="33" y="16.8" width="10" height="4" rx="1" fill="#44513a"/>' +
      '<rect x="57.5" y="16.2" width="4" height="4.2" rx=".6" fill="' + MD + '"/>' +
      '<rect x="58.5" y="16.9" width=".8" height="2.8" fill="' + ML + '"/><rect x="60" y="16.9" width=".8" height="2.8" fill="' + ML + '"/>' +
      '<rect x="23" y="13" width="2" height="3" fill="' + MD + '"/><rect x="31" y="13" width="2" height="3" fill="' + MD + '"/>' +
      '<rect x="18" y="9.6" width="19" height="3.8" rx="1.5" fill="#15181c"/>' +
      '<rect x="19" y="10" width="17" height=".9" rx=".4" fill="#5a636e"/>' +
      '<path d="M14.5 8.6l4 .8v4.2l-4 .8z" fill="' + PO + '"/>' +
      '<path d="M36.5 9.4 42 7.8v7.4l-5.5-1.6z" fill="' + PO + '"/>' +
      '<rect x="41.3" y="8.6" width=".9" height="5.8" fill="#4fc3f7"/>' +
      '<rect x="26" y="7" width="3" height="2.8" rx=".4" fill="' + MD + '"/><rect x="26" y="7" width="3" height=".8" fill="' + ML + '"/>',
    // fusil de ráfagas (Famas): asa de transporte larga encima y el cargador DETRÁS de la empuñadura
    burst:
      '<rect x="8" y="13" width="3" height="8.5" rx="1" fill="' + PO + '"/>' +
      '<path d="M18 21h6l.6 8.5h-6z" fill="' + PO + '"/>' +
      '<path d="M18.6 22.2h5l.1 1.4h-5z" fill="' + MM + '"/>' +
      '<path d="M33 21h4l-1.6 8.2h-4z" fill="' + PO + '"/>' +
      '<path d="M37 21q.4 4 4.6 3.6V21" fill="none" stroke="' + MD + '" stroke-width="1.2"/>' +
      '<rect x="10.5" y="13" width="36" height="8.5" rx="2" fill="' + MM + '"/>' +
      '<rect x="10.5" y="13" width="36" height="1.6" rx=".8" fill="' + ML + '"/>' +
      '<rect x="26" y="15.6" width="5" height="1.8" rx=".5" fill="' + MD + '"/>' +
      '<rect x="40" y="13.4" width="7.5" height="7.6" rx="1" fill="' + MD + '"/>' +
      rep(3, (i) => '<rect x="' + (41 + i * 2.2) + '" y="15" width="1.2" height="4.4" fill="#5a636e"/>') +
      '<rect x="15" y="8.6" width="2" height="4.6" fill="' + MD + '"/><rect x="40" y="8.6" width="2" height="4.6" fill="' + MD + '"/>' +
      '<rect x="14" y="7.2" width="29" height="2.2" rx="1" fill="' + MD + '"/><rect x="14" y="7.2" width="29" height=".7" fill="' + ML + '"/>' +
      '<rect x="47.5" y="15.6" width="9" height="2" fill="' + PO + '"/>' +
      '<rect x="56" y="14.5" width="4.5" height="4.2" rx=".6" fill="' + MD + '"/><rect x="57.2" y="15.3" width=".8" height="2.6" fill="' + ML + '"/>',
    // escopeta táctica: muebles color arena, empuñadura de pistola y cañón con guardamanos perforado
    tactical:
      '<path d="M2 17.4 12 15h4.5v7H13l-9 4q-2 .4-2-1.6z" fill="#a68a5b"/>' +
      '<path d="M2.6 17.6 12 15.6v1.2l-9.4 2z" fill="#c4a876"/>' +
      '<path d="M2 17.4l1.5-.4v8.7q-1.5.3-1.5-1.3z" fill="' + PO + '"/>' +
      '<path d="M19 21h4.2l-2 8.4h-4.4z" fill="' + PO + '"/>' +
      '<path d="M23 21q.4 3.8 4.4 3.4l.6-3.4" fill="none" stroke="' + MD + '" stroke-width="1.2"/>' +
      '<rect x="16" y="13.5" width="11.5" height="7.5" rx="1" fill="' + MD + '"/>' +
      '<rect x="16" y="13.5" width="11.5" height="1.4" fill="#5a636e"/>' +
      '<rect x="27" y="14" width="27" height="2.4" fill="' + MD + '"/>' +
      '<rect x="27" y="17" width="21" height="2.2" fill="' + MM + '"/>' +
      '<rect x="29" y="12.3" width="17" height="2" rx=".6" fill="' + PO + '"/>' +
      rep(5, (i) => '<rect x="' + (30.5 + i * 3) + '" y="12.8" width="1.4" height="1" fill="#5a636e"/>') +
      '<rect x="32" y="16.4" width="10" height="4.4" rx="1" fill="#a68a5b"/>' +
      rep(3, (i) => '<rect x="' + (34 + i * 2.6) + '" y="17.2" width=".8" height="2.8" fill="#7a6440"/>') +
      '<rect x="51.6" y="12.4" width="1.4" height="1.8" fill="' + PO + '"/>',
    // lanzamisiles: tubo verde oliva con boca ancha, mira, dos empuñaduras y la cabeza roja del misil
    rocket:
      '<rect x="22" y="20.5" width="3.6" height="8.5" rx=".8" fill="' + PO + '"/>' +
      '<rect x="36" y="20.5" width="3.4" height="7" rx=".8" fill="' + PO + '"/>' +
      '<rect x="2" y="11.2" width="5" height="10.6" rx="1" fill="' + MD + '"/>' +
      '<rect x="6" y="12" width="47" height="9" rx="2" fill="#5b6b3a"/>' +
      '<rect x="6" y="12" width="47" height="2" rx="1" fill="#7d8f55"/>' +
      '<rect x="6" y="19.4" width="47" height="1.6" fill="#45522c"/>' +
      '<rect x="16" y="12" width="1.6" height="9" fill="' + MD + '"/><rect x="43" y="12" width="1.6" height="9" fill="' + MD + '"/>' +
      '<rect x="24" y="7.2" width="9" height="4.8" rx=".8" fill="' + MD + '"/><rect x="32.2" y="8.2" width=".9" height="2.8" fill="#4fc3f7"/>' +
      '<path d="M52 10.8h5.5v11.4H52z" fill="' + MD + '"/>' +
      '<path d="M57.5 13.4 61.5 16.5 57.5 19.6z" fill="#d62828"/>',
  };

  const ICONS = {
    pickaxe: '<path d="M14 4c12 0 24 4 34 12l-3 3C37 13 27 10 16 9zM29 13l4 3-20 22-4-3z"/>',
    potion: '<path d="M26 4h10v4h-2v6c6 2 10 7 10 13 0 8-6 11-13 11S18 35 18 27c0-6 4-11 10-13V8h-2z"/>',
    medkit: '<path d="M22 8h18v5h10v24H12V13h10zm4 4v1h10v-1zm1 7v5h-5v5h5v5h6v-5h5v-5h-5v-5z" fill-rule="evenodd"/>',
    wall: '<path d="M8 6h46v28H8zM10 8v8h20V8zm22 0v8h20V8zM10 18v6h10v-6zm12 0v6h20v-6zm22 0v6h8v-6zM10 26v6h20v-6zm22 0v6h20v-6z" fill-rule="evenodd"/>',
    floor: '<path d="M4 26l16-12h38L42 26z"/>',
    ramp: '<path d="M6 34L50 8h6v26z"/>',
    cone: '<path d="M31 6l24 28H7z"/>',
  };
  const svg = (k, fill) => (WEAPON_ICONS[k]
    ? '<svg class="wicon" viewBox="0 0 62 40">' + WEAPON_ICONS[k] + '</svg>'
    : '<svg viewBox="0 0 62 40" fill="' + (fill || 'rgba(255,255,255,0.92)') + '">' + ICONS[k] + '</svg>');

  const _v = new THREE.Vector3();
  const MAP_HALF = Math.round(G.CONFIG.islandRadius + 160);

  const H = (G.HUD = {
    invOpen: false,

    init() {
      this.el = {
        hud: $('hud'), alive: $('alive'), kills: $('kills'), storm: $('storm-label'),
        shieldNum: $('shield-num'), shieldFill: $('shield-fill'), shieldGhost: $('shield-ghost'),
        healthNum: $('health-num'), healthFill: $('health-fill'), healthGhost: $('health-ghost'),
        stamina: $('stamina'), staminaFill: $('stamina-fill'),
        hotbar: $('hotbar'), wname: $('weapon-name'), wammo: $('weapon-ammo'), mats: $('mats'),
        cross: $('crosshair'), hit: $('hitmarker'), prompt: $('prompt'), progress: $('progress'),
        progLabel: $('progress-label'), progFill: $('progress-fill'), center: $('center-msg'), toast: $('toast'),
        killfeed: $('killfeed'), scope: $('scope'), tint: $('storm-tint'), hurt: $('hurt-flash'),
        dmgNums: $('dmg-numbers'), dirs: $('dmg-dirs'), alt: $('altitude'), spectate: $('spectate'),
        minimap: $('minimap'), bigmap: $('bigmap'), bigCanvas: $('bigmap-canvas'),
        buildbar: $('buildbar'), structHp: $('struct-hp'), structName: $('struct-name'), structFill: $('struct-fill'),
        inv: $('inv-panel'), invSlots: $('inv-slots'), invDetail: $('inv-detail'), invAmmo: $('inv-ammo'),
        invMats: $('inv-mats'), invHeal: $('inv-heal'), fps: $('fps'), matPop: $('mat-pop'),
      };
      this.sqEl = this.el.cross.querySelector('.ch-sq');
      this.scopeHint = document.getElementById('scope-hint');
      // puntos mil de la mira telescópica
      const md = document.getElementById('mil-dots');
      if (md) {
        let h = '';
        for (let i = 1; i <= 4; i++) {
          const d = i * 24;
          for (const [x, y] of [[d, 0], [-d, 0], [0, d], [0, -d]]) h += '<circle cx="' + x + '" cy="' + y + '" r="2.6"/>';
        }
        md.innerHTML = h;
      }
      this.chT = this.el.cross.querySelector('.ch-t');
      this.chB = this.el.cross.querySelector('.ch-b');
      this.chL = this.el.cross.querySelector('.ch-l');
      this.chR = this.el.cross.querySelector('.ch-r');
      // barra de objetos: pico + 5 huecos
      this.slotEls = [];
      for (let i = -1; i < C.slots; i++) {
        const d = document.createElement('div');
        d.className = 'slot' + (i < 0 ? ' pick' : '');
        this.el.hotbar.appendChild(d);
        this.slotEls.push(d);
      }
      this.slotKeys = [];
      // materiales
      this.matEls = {};
      for (const m of G.MATERIAL_IDS) {
        const d = document.createElement('div');
        d.className = 'mat-chip';
        d.style.setProperty('--c', G.MATERIALS[m].color);
        this.el.mats.appendChild(d);
        this.matEls[m] = d;
      }
      // barra de construcción
      this.buildEls = [];
      G.PIECE_IDS.forEach((pid, i) => {
        const d = document.createElement('div');
        d.className = 'bpiece';
        d.innerHTML = '<span class="num">' + (i + 1) + '</span>' + svg(pid) + '<span class="lbl">' + G.PIECES[pid].name + '</span>';
        this.el.buildbar.appendChild(d);
        this.buildEls.push(d);
      });
      this.buildMatEl = document.createElement('div');
      this.buildMatEl.className = 'bmat';
      this.el.buildbar.appendChild(this.buildMatEl);
      // números de daño
      this.nums = [];
      for (let i = 0; i < 28; i++) {
        const d = document.createElement('div');
        d.className = 'dmg-num';
        d.style.display = 'none';
        this.el.dmgNums.appendChild(d);
        this.nums.push({ el: d, pos: new THREE.Vector3(), life: 0, off: 0 });
      }
      this.ni = 0;
      // indicadores de dirección del daño
      this.dirEls = [];
      for (let i = 0; i < 4; i++) {
        const d = document.createElement('div');
        d.className = 'dmg-dir';
        d.style.opacity = 0;
        this.el.dirs.appendChild(d);
        this.dirEls.push({ el: d, life: 0, src: null });
      }
      this.di = 0;
      this.mctx = this.el.minimap.getContext('2d');
      this.bctx = this.el.bigCanvas.getContext('2d');
      this.cache = {};
      this.hitT = 0;
      this.hurtT = 0;
      this.toastT = 0;
      this.structT = 0;
      this.matPopT = 0;
      this.mapT = 0;
      this.bigOpen = false;
      this.initInventory();
    },

    show(v) {
      this.el.hud.classList.toggle('hidden', !v);
      if (!v) { this.el.scope.classList.add('hidden'); this.el.tint.style.opacity = 0; this.setBigMap(false); this.closeInventory(true); }
    },

    set(key, el, prop, val) {
      if (this.cache[key] === val) return;
      this.cache[key] = val;
      if (prop === 'text') el.textContent = val;
      else if (prop === 'html') el.innerHTML = val;
      else if (prop === 'width') el.style.width = val;
      else if (prop === 'display') el.style.display = val;
    },

    reset() {
      this.cache = {};
      this.slotKeys = [];
      this.invKey = '';
      this.el.killfeed.innerHTML = '';
      for (const n of this.nums) { n.life = 0; n.el.style.display = 'none'; }
      for (const d of this.dirEls) { d.life = 0; d.el.style.opacity = 0; }
      this.el.hurt.style.opacity = 0;
      this.structT = 0;
      this.el.structHp.style.display = 'none';
    },

    slotHtml(s, i) {
      const num = '<span class="num">' + (i < 0 ? 'F' : i + 1) + '</span>';
      if (s === 'pickaxe') return num + svg('pickaxe');
      if (!s) return num;
      if (s.kind === 'weapon') return num + svg(s.type) + '<span class="ammo">' + s.mag + '</span>';
      return num + svg(s.cid) + '<span class="ammo">' + s.count + '</span>';
    },
    slotColor(s) {
      if (!s) return '';
      if (s === 'pickaxe') return '#6c63ff';
      if (s.kind === 'weapon') return G.RARITIES[s.rarity].color;
      return s.def.color;
    },

    /* ---------- Actualización por fotograma ---------- */
    update(dt, camera) {
      const Gm = G.Game;
      const p = Gm.viewTarget || Gm.player;
      const me = Gm.player;
      if (!p) return;
      const e = this.el;
      const ctl = G.PlayerCtl;

      // vida y escudo
      this.set('shn', e.shieldNum, 'text', Math.ceil(p.shield));
      this.set('hpn', e.healthNum, 'text', Math.ceil(p.health));
      const sw = (p.shield / C.maxShield) * 100 + '%', hw = (p.health / C.maxHealth) * 100 + '%';
      this.set('shf', e.shieldFill, 'width', sw);
      this.set('hpf', e.healthFill, 'width', hw);
      this.set('shg', e.shieldGhost, 'width', sw);
      this.set('hpg', e.healthGhost, 'width', hw);

      // aguante (sólo se ve cuando no está lleno)
      const st = Math.round((p.stamina / C.stamina.max) * 100);
      this.set('stw', e.staminaFill, 'width', st + '%');
      this.set('std', e.stamina, 'display', st < 100 || p.tired ? 'flex' : 'none');
      e.stamina.classList.toggle('tired', !!p.tired);

      this.set('alive', e.alive, 'text', Gm.aliveCount());
      this.set('kills', e.kills, 'text', me.kills);
      const stormTxt = G.Storm.label();
      this.set('storm', e.storm, 'text', stormTxt);
      e.storm.classList.toggle('danger', G.Storm.state === 'shrink');

      // barra de objetos
      for (let i = -1; i < C.slots; i++) {
        const s = i < 0 ? 'pickaxe' : p.slots[i];
        const sel = !p.building && p.sel === i;
        const key = (s === 'pickaxe' ? 'P' : s ? (s.kind === 'weapon' ? s.type + s.rarity + ':' + s.mag : s.cid + s.count) : '-') + (sel ? '*' : '');
        if (this.slotKeys[i + 1] === key) continue;
        this.slotKeys[i + 1] = key;
        const el = this.slotEls[i + 1];
        el.className = 'slot' + (i < 0 ? ' pick' : '') + (s ? ' has' : '') + (sel ? ' sel' : '');
        el.style.setProperty('--c', this.slotColor(s));
        el.innerHTML = this.slotHtml(s, i);
      }
      // materiales
      for (const m of G.MATERIAL_IDS) this.set('mat' + m, this.matEls[m], 'html', '<b>' + p.mats[m] + '</b> ' + G.MATERIALS[m].name);
      // arma actual
      const held = p.held;
      if (p.vehicle) {
        this.set('wn', e.wname, 'html', '<span style="color:#ffd166">🏍️ Moto · ' + Math.round(Math.abs(p.vehicle.speed) * 3.6) + ' km/h</span>');
        this.set('wa', e.wammo, 'html', '<small><b>W/S</b> acelerar/frenar · <b>A/D</b> girar · <b>Espacio</b> saltar · <b>E</b> bajar</small>');
      } else if (p.building) {
        this.set('wn', e.wname, 'html', '<span style="color:#9fd6ff">Modo construcción</span>');
        this.set('wa', e.wammo, 'html', '');
      } else if (held === 'pickaxe') {
        this.set('wn', e.wname, 'html', '<span style="color:#b9b4ff">Pico</span>');
        this.set('wa', e.wammo, 'html', '<small>rompe cosas para conseguir materiales</small>');
      } else if (held && held.kind === 'weapon') {
        this.set('wn', e.wname, 'html', '<span style="color:' + G.RARITIES[held.rarity].color + '">' + G.Loot.weaponName(held) + '</span>');
        this.set('wa', e.wammo, 'html', held.mag + ' <small>/ ' + p.ammo[held.def.ammo] + '</small>');
      } else if (held) {
        this.set('wn', e.wname, 'html', '<span style="color:' + held.def.color + '">' + held.def.name + '</span>');
        this.set('wa', e.wammo, 'html', '<small>clic izquierdo para usar · ' + (held.def.effect === 'shield' ? '+50 escudo' : '+100 vida') + '</small>');
      } else {
        this.set('wn', e.wname, 'html', '<span style="opacity:.7">Hueco vacío</span>');
        this.set('wa', e.wammo, 'html', '');
      }

      // barra de construcción
      const showBuild = p === me && me.building && me.alive;
      this.set('bbd', e.buildbar, 'display', showBuild ? 'flex' : 'none');
      if (showBuild) {
        const bk = ctl.pieceIdx + ':' + ctl.matIdx + ':' + me.mats[ctl.matId] + ':' + ctl.rot;
        if (this.cache.bk !== bk) {
          this.cache.bk = bk;
          this.buildEls.forEach((d, i) => d.classList.toggle('sel', i === ctl.pieceIdx));
          const M = G.MATERIALS[ctl.matId];
          this.buildMatEl.innerHTML = '<span class="sw" style="background:' + M.color + '"></span><b>' + M.name + '</b> ' + me.mats[ctl.matId] +
            '<small>Clic der.: cambiar · R: girar rampa · Q: salir</small>';
          this.buildMatEl.classList.toggle('low', me.mats[ctl.matId] < C.build.cost);
        }
      }

      // mira (cada arma la suya)
      const showCross = p === me && me.alive && me.mode === 'ground' && !me.vehicle && !ctl.scoped && !this.invOpen;
      e.cross.style.display = showCross ? 'block' : 'none';
      if (showCross) {
        const w = p.weapon && !p.building ? p.weapon : null;
        const type = w ? w.type : '';
        const sp = w ? G.Combat.spreadFor(p) : 0;
        const fov = (camera.fov * Math.PI) / 180;
        let g = (Math.tan(sp) / Math.tan(fov / 2)) * (innerHeight / 2);
        // al apuntar, la mira del fusil y la pistola se cierra mucho más
        if (p.ads && w && w.def.pellets === 1) g *= 0.32;
        this.chGap = this.chGap === undefined ? g : this.chGap + (g - this.chGap) * Math.min(1, dt * 16);
        // escopetas: cuadrado (dónde caen los perdigones) · francotirador sin apuntar: sólo un punto
        const mode = w && w.def.pellets > 1 ? 'sq' : type === 'sniper' && !p.ads ? 'dot' : '';
        const cls = mode + (p.ads ? ' ads' : '');
        if (this.cache.chCls !== cls) { this.cache.chCls = cls; e.cross.className = cls; }
        if (mode === 'sq') {
          // el cuadrado marca justo dónde caen los perdigones (compacto: mínimo 12 px, máximo 70 px)
          const half = Math.round(U.clamp(this.chGap + 4, 12, 70));
          if (this.cache.sq !== half) {
            this.cache.sq = half;
            const st = this.sqEl.style;
            st.left = -half + 'px'; st.top = -half + 'px'; st.width = half * 2 + 'px'; st.height = half * 2 + 'px';
          }
        } else {
          const gg = Math.round(Math.min(80, this.chGap + (p.ads ? 2 : 4)));
          const len = p.ads ? 7 : 9;
          if (this.cache.gap !== gg) {
            this.cache.gap = gg;
            this.chT.style.top = -(gg + len) + 'px';
            this.chB.style.top = gg + 'px';
            this.chL.style.left = -(gg + len) + 'px';
            this.chR.style.left = gg + 'px';
          }
        }
      }
      // mira telescópica: aviso de la respiración
      if (p === me && ctl.scoped) {
        const hk = ctl.holdingBreath ? 'h' : ctl.breath < 0.4 ? 'o' : 'n';
        if (this.cache.bh !== hk) {
          this.cache.bh = hk;
          this.scopeHint.innerHTML = hk === 'h' ? 'Aguantando la respiración…' : hk === 'o' ? 'Sin aire: espera un momento' : '<b>Shift</b> aguantar la respiración (la mira tiembla menos)';
        }
      }
      e.scope.classList.toggle('hidden', !(p === me && ctl.scoped));

      if (this.hitT > 0) { this.hitT -= dt; e.hit.style.opacity = Math.max(0, this.hitT / 0.25); }

      // aviso para recoger / abrir
      const tgt = p === me && me.alive && !ctl.scoped && !me.building && !this.invOpen ? ctl.target : null;
      if (tgt) {
        let html;
        if (tgt.type === 'moto') html = '<span class="key">E</span>Subir a la moto';
        else if (tgt.type === 'chest') html = '<span class="key">E</span>Abrir cofre';
        else if (tgt.item.kind === 'weapon') {
          const tw = tgt.item.weapon;
          html = '<span class="key">E</span>Recoger <span class="rar" style="color:' + G.RARITIES[tw.rarity].color + '">' + G.Loot.weaponName(tw) + '</span>' +
            ' <span style="opacity:.8">(' + tw.def.damage[tw.rarity] + ' daño)</span>';
        } else {
          const c = tgt.item.cons;
          html = '<span class="key">E</span>Recoger <span class="rar" style="color:' + c.def.color + '">' + G.Loot.slotName(c) + '</span>';
        }
        if (tgt.type === 'item' && !me.slots.includes(null)) html += '<br><span style="opacity:.75;font-size:13px">Inventario lleno: se cambiará por lo que llevas en la mano</span>';
        this.set('prompt', e.prompt, 'html', html);
        this.set('promptd', e.prompt, 'display', 'block');
      } else this.set('promptd', e.prompt, 'display', 'none');

      // barra de progreso (recarga o cura)
      if (p.reloadT > 0 || p.useT > 0) {
        const using = p.useT > 0;
        const frac = using ? 1 - p.useT / p.useDur : 1 - p.reloadT / p.reloadDur;
        this.set('progd', e.progress, 'display', 'block');
        const c = p.consumable;
        this.set('progl', e.progLabel, 'text', using && c ? c.def.verb : 'Recargando…');
        e.progFill.style.width = U.clamp(frac, 0, 1) * 100 + '%';
        e.progFill.style.background = using && c ? c.def.color : '#fff';
      } else this.set('progd', e.progress, 'display', 'none');

      // vida de la estructura que golpeas
      if (this.structT > 0) {
        this.structT -= dt;
        const g = this.structG;
        if (this.structT <= 0 || !g) e.structHp.style.display = 'none';
        else {
          e.structHp.style.display = 'block';
          this.set('stn', e.structName, 'text', g.name + ' · ' + Math.max(0, Math.ceil(g.hp)) + ' / ' + g.maxHp);
          e.structFill.style.width = U.clamp(g.hp / g.maxHp, 0, 1) * 100 + '%';
          e.structFill.style.background = G.MATERIALS[g.mat].color;
        }
      }
      if (this.matPopT > 0) { this.matPopT -= dt; if (this.matPopT <= 0) e.matPop.classList.remove('show'); }

      // altura en caída libre
      if (p === me && (me.mode === 'dive' || me.mode === 'glide')) {
        const a = Math.max(0, Math.round(ctl.heightAbove || 0));
        let t = 'Altura: ' + a + ' m';
        if (me.mode === 'dive') {
          const fast = me.pitch < -0.3;
          t += fast ? ' · <b>EN PICADO</b>' : ' · mira hacia abajo para caer en picado';
          if (a < C.sky.manualGlide && (me.diveT || 0) > 0.8) t += ' · <b>ESPACIO</b> abrir planeador';
        }
        this.set('alt', e.alt, 'html', t);
        this.set('altd', e.alt, 'display', 'block');
      } else this.set('altd', e.alt, 'display', 'none');

      // mensaje central
      let msg = '';
      if (me.mode === 'bus' && Gm.state === 'playing') {
        msg = G.Bus.canJump ? 'PULSA ESPACIO PARA SALTAR<small>Saltarás donde estés · mueve el ratón para mirar</small>'
          : 'EL AUTOBÚS SE ACERCA A LA ISLA<small>Mira el minimapa (o pulsa M) y elige dónde caer</small>';
      }
      this.set('center', e.center, 'html', msg);

      const inStorm = p.alive && p.mode !== 'bus' && !G.Storm.inside(p.pos.x, p.pos.z);
      e.tint.style.opacity = inStorm ? 1 : 0;

      // golpes recibidos
      if (this.hurtT > 0) { this.hurtT -= dt; e.hurt.style.opacity = Math.max(0, this.hurtT); }
      for (const d of this.dirEls) {
        if (d.life <= 0) continue;
        d.life -= dt;
        let ang = 0;
        if (d.src) {
          const dx = d.src.pos.x - me.pos.x, dz = d.src.pos.z - me.pos.z;
          const r = dx * Math.cos(me.yaw) - dz * Math.sin(me.yaw);
          const f = -dx * Math.sin(me.yaw) - dz * Math.cos(me.yaw);
          ang = Math.atan2(r, f);
        }
        d.el.style.transform = 'rotate(' + ang + 'rad)';
        d.el.style.opacity = Math.max(0, Math.min(1, d.life));
      }

      // números de daño
      const W = innerWidth, Hh = innerHeight;
      for (const n of this.nums) {
        if (n.life <= 0) continue;
        n.life -= dt;
        if (n.life <= 0) { n.el.style.display = 'none'; continue; }
        _v.copy(n.pos);
        _v.y += (1.2 - n.life) * 0.8;
        _v.project(camera);
        if (_v.z > 1) { n.el.style.display = 'none'; continue; }
        n.el.style.display = 'block';
        n.el.style.transform = 'translate(' + (((_v.x + 1) / 2) * W + n.off) + 'px,' + (((1 - _v.y) / 2) * Hh) + 'px) translate(-50%,-50%)';
        n.el.style.opacity = Math.min(1, n.life * 2.5);
      }

      if (this.toastT > 0) {
        this.toastT -= dt;
        if (this.toastT <= 0) e.toast.classList.remove('show');
      }

      if (Gm.viewTarget && Gm.viewTarget !== me) {
        this.set('spec', e.spectate, 'html', 'Viendo a <b>' + Gm.viewTarget.name + '</b> · clic para cambiar · Esc para el menú');
        this.set('specd', e.spectate, 'display', 'block');
      } else this.set('specd', e.spectate, 'display', 'none');

      // los mapas se redibujan unas 15 veces por segundo (no hace falta más)
      this.mapT -= dt;
      if (this.mapT <= 0) {
        this.mapT = 1 / 15;
        this.drawMinimap(p);
        if (this.bigOpen) this.drawBigMap(p);
      }
      if (this.invOpen) this.renderInventory();
    },

    setFps(v) {
      this.el.fps.style.display = G.SETTINGS.showFps ? 'block' : 'none';
      if (G.SETTINGS.showFps) this.el.fps.textContent = v + ' FPS · ' + Math.round(G.Game.renderScale * 100) + '%';
    },

    /* ---------- Efectos de combate ---------- */
    damageNumber(target, amount, head, shield) {
      const n = this.nums[this.ni];
      this.ni = (this.ni + 1) % this.nums.length;
      n.pos.set(target.pos.x, target.pos.y + 2.0, target.pos.z);
      n.life = 1.0;
      n.off = (Math.random() - 0.5) * 40;
      n.el.textContent = amount;
      n.el.className = 'dmg-num' + (head ? ' head' : shield ? ' shield' : '');
    },

    hitMarker(head) {
      this.hitT = 0.25;
      this.el.hit.classList.toggle('head', !!head);
      this.el.hit.style.opacity = 1;
    },

    hurt(attacker, kind) {
      this.hurtT = kind === 'storm' ? 0.5 : 0.8;
      if (kind === 'storm' || kind === 'fall') return;
      const d = this.dirEls[this.di];
      this.di = (this.di + 1) % this.dirEls.length;
      d.life = 1.4;
      d.src = attacker && attacker !== G.Game.player ? attacker : null;
    },

    structHit(g) {
      this.structG = g;
      this.structT = 1.6;
    },

    matGain(m, n) {
      const e = this.el.matPop;
      e.innerHTML = '+' + n + ' <span style="color:' + G.MATERIALS[m].color + '">' + G.MATERIALS[m].name + '</span>';
      e.classList.add('show');
      this.matPopT = 0.8;
    },

    killfeed(html, mine) {
      const d = document.createElement('div');
      d.className = 'kf';
      d.innerHTML = html;
      if (mine) d.style.borderLeft = '3px solid #ffd23f';
      this.el.killfeed.prepend(d);
      while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
      setTimeout(() => { d.style.opacity = 0; }, 6000);
      setTimeout(() => { d.remove(); }, 6700);
    },

    toast(text, warn) {
      const t = this.el.toast;
      t.textContent = text;
      t.classList.toggle('warn', !!warn);
      t.classList.add('show');
      this.toastT = 2.6;
    },

    /* ---------- INVENTARIO (TAB) ---------- */
    initInventory() {
      this.invSel = 0;
      this.invCards = [];
      for (let i = -1; i < C.slots; i++) {
        const d = document.createElement('div');
        d.className = 'icard';
        d.dataset.slot = i;
        if (i >= 0) {
          d.draggable = true;
          d.addEventListener('dragstart', (ev) => { this.dragFrom = i; d.classList.add('dragging'); try { ev.dataTransfer.setData('text/plain', String(i)); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* nada */ } });
          d.addEventListener('dragend', () => { d.classList.remove('dragging'); this.invCards.forEach((c) => c.classList.remove('over')); });
          d.addEventListener('dragover', (ev) => { ev.preventDefault(); d.classList.add('over'); });
          d.addEventListener('dragleave', () => d.classList.remove('over'));
          d.addEventListener('drop', (ev) => {
            ev.preventDefault();
            d.classList.remove('over');
            const from = this.dragFrom;
            if (from !== undefined && from !== i) { G.Game.player.swapSlots(from, i); this.invSel = i; this.invKey = ''; }
            this.dragFrom = undefined;
          });
        }
        d.addEventListener('click', () => { this.invSel = i; this.invKey = ''; });
        this.el.invSlots.appendChild(d);
        this.invCards.push(d);
      }
      this.el.invDetail.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        const me = G.Game.player, i = this.invSel;
        const act = b.dataset.act;
        if (act === 'equip') { me.selectSlot(i); }
        else if (act === 'drop') { me.dropSlot(i); }
        else if (act === 'left' && i > 0) { me.swapSlots(i, i - 1); this.invSel = i - 1; }
        else if (act === 'right' && i >= 0 && i < C.slots - 1) { me.swapSlots(i, i + 1); this.invSel = i + 1; }
        this.invKey = '';
      });
    },

    openInventory() {
      const me = G.Game.player;
      if (!me || !me.alive || me.mode === 'bus' || this.invOpen) return;
      this.invOpen = true;
      this.invSel = me.sel;
      this.invKey = '';
      this.el.inv.classList.remove('hidden');
      G.Input.unlock();
      this.renderInventory();
    },

    closeInventory(silent) {
      if (!this.invOpen) return;
      this.invOpen = false;
      this.el.inv.classList.add('hidden');
      if (!silent) G.Input.lock();
    },

    renderInventory() {
      const me = G.Game.player;
      if (!me) return;
      const key = JSON.stringify([me.slots.map((s) => (s ? (s.kind === 'weapon' ? s.type + s.rarity + s.mag : s.cid + s.count) : 0)), me.sel, this.invSel, me.ammo, me.mats, Math.ceil(me.health), Math.ceil(me.shield)]);
      if (key === this.invKey) return;
      this.invKey = key;
      // tarjetas
      this.invCards.forEach((d, k) => {
        const i = k - 1;
        const s = i < 0 ? 'pickaxe' : me.slots[i];
        d.className = 'icard' + (s ? ' has' : '') + (i === this.invSel ? ' focus' : '') + (i === me.sel ? ' equipped' : '');
        d.style.setProperty('--c', this.slotColor(s) || 'rgba(255,255,255,0.2)');
        let sub = 'Vacío';
        if (s === 'pickaxe') sub = 'Herramienta';
        else if (s && s.kind === 'weapon') sub = G.RARITIES[s.rarity].name[s.def.fem ? 1 : 0];
        else if (s) sub = 'x' + s.count;
        d.innerHTML = '<span class="num">' + (i < 0 ? 'F' : i + 1) + '</span>' + (s ? svg(s === 'pickaxe' ? 'pickaxe' : s.kind === 'weapon' ? s.type : s.cid) : '') +
          '<div class="iname">' + (s ? (s === 'pickaxe' ? 'Pico' : s.kind === 'weapon' ? s.def.name : s.def.short) : '') + '</div><div class="isub">' + sub + '</div>';
      });
      // detalle
      const i = this.invSel;
      const s = i < 0 ? 'pickaxe' : me.slots[i];
      let html = '';
      if (!s) html = '<div class="dt">Hueco vacío</div><p>Arrastra aquí un arma o una cura para moverla.</p>';
      else if (s === 'pickaxe') {
        const P = G.PICKAXE;
        html = '<div class="dt" style="color:#b9b4ff">Pico</div><div class="stats"><div><b>' + P.damage + '</b>daño a jugadores</div><div><b>' + P.structDamage + '</b>daño a estructuras</div><div><b>' + P.rate.toFixed(1) + '</b>golpes/s</div></div>' +
          '<p>Golpea árboles (madera), rocas y paredes de ladrillo (piedra) y coches (metal) para conseguir materiales.</p>';
      } else if (s.kind === 'weapon') {
        const d = s.def, r = G.RARITIES[s.rarity];
        const per = d.burst || 1;
        const dps = Math.round(d.damage[s.rarity] * d.fireRate * per);
        const note = d.pellets > 1 ? ' (' + d.pellets + ' perdigones)' : per > 1 ? ' por bala' : d.projectile ? ' (explosión de ' + d.projectile.blast + ' m)' : '';
        html = '<div class="dt" style="color:' + r.color + '">' + G.Loot.weaponName(s) + '</div><div class="stats">' +
          '<div><b>' + d.damage[s.rarity] + '</b>daño' + note + '</div>' +
          '<div><b>' + d.fireRate + '</b>' + (per > 1 ? 'ráfagas de ' + per + '/s' : 'disparos/s') + '</div><div><b>' + dps + '</b>daño/s</div>' +
          '<div><b>' + s.mag + ' / ' + d.mag + '</b>cargador</div><div><b>' + d.reload[s.rarity].toFixed(2) + ' s</b>recarga</div>' +
          '<div><b>×' + d.headMult + '</b>en la cabeza</div></div>' +
          '<p>Munición: <span style="color:' + G.AMMO[d.ammo].color + '">' + G.AMMO[d.ammo].name + '</span> (tienes ' + me.ammo[d.ammo] + ')</p>';
      } else {
        const d = s.def;
        html = '<div class="dt" style="color:' + d.color + '">' + d.name + ' x' + s.count + '</div><div class="stats">' +
          '<div><b>+' + d.amount + '</b>' + (d.effect === 'shield' ? 'escudo' : 'vida') + '</div><div><b>' + d.time + ' s</b>en usarse</div><div><b>' + d.stack + '</b>por hueco</div></div>' +
          '<p>Selecciónala y haz clic izquierdo para usarla.</p>';
      }
      if (i >= 0 && s) {
        html += '<div class="ibtns"><button data-act="equip">Equipar</button><button data-act="left">◀ Mover</button><button data-act="right">Mover ▶</button><button data-act="drop" class="danger">Tirar</button></div>';
      }
      this.el.invDetail.innerHTML = html;
      // munición
      this.el.invAmmo.innerHTML = G.AMMO_IDS.map((a) => {
        const A = G.AMMO[a], n = me.ammo[a];
        return '<div class="irow"><span class="sw" style="background:' + A.color + '"></span><span class="nm">' + A.name + '</span><span class="ct">' + n + '<small> / ' + A.max + '</small></span>' +
          '<div class="ibar"><i style="width:' + (n / A.max) * 100 + '%;background:' + A.color + '"></i></div></div>';
      }).join('');
      // materiales
      this.el.invMats.innerHTML = G.MATERIAL_IDS.map((m) => {
        const M = G.MATERIALS[m], n = me.mats[m];
        return '<div class="irow"><span class="sw" style="background:' + M.color + '"></span><span class="nm">' + M.name + ' <small>(' + M.hp + ' vida por pieza)</small></span><span class="ct">' + n + '<small> / ' + M.max + '</small></span>' +
          '<div class="ibar"><i style="width:' + (n / M.max) * 100 + '%;background:' + M.color + '"></i></div></div>';
      }).join('') + '<p class="ihint">Cada pieza cuesta ' + C.build.cost + '. Pulsa Q para construir.</p>';
      // curación
      this.el.invHeal.innerHTML =
        '<div class="irow"><span class="sw" style="background:#5bd65b"></span><span class="nm">Vida</span><span class="ct">' + Math.ceil(me.health) + '<small> / 100</small></span></div>' +
        '<div class="irow"><span class="sw" style="background:#3fa9ff"></span><span class="nm">Escudo</span><span class="ct">' + Math.ceil(me.shield) + '<small> / 100</small></span></div>' +
        '<div class="irow"><span class="sw" style="background:#3fa9ff"></span><span class="nm">Pociones de escudo</span><span class="ct">' + me.countCons('potion') + '</span></div>' +
        '<div class="irow"><span class="sw" style="background:#ff5a5a"></span><span class="nm">Botiquines</span><span class="ct">' + me.countCons('medkit') + '</span></div>';
    },

    /* ---------- Mapas ---------- */
    buildMapImage() {
      const S = 560;
      const c = this.mapImg || document.createElement('canvas');
      c.width = c.height = S;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(S, S);
      const k = (MAP_HALF * 2) / S;
      const W = G.World;
      for (let py = 0; py < S; py++) {
        for (let px = 0; px < S; px++) {
          const x = -MAP_HALF + px * k, z = -MAP_HALF + py * k;
          const h = G.Phys.heightAt(x, z);
          let r, g, b;
          if (Math.max(Math.abs(x), Math.abs(z)) < W.cityHalf + 2) { r = 92; g = 96; b = 104; }
          else if (h < 0) { const d = U.clamp(-h / 9, 0, 1); r = 40 - d * 12; g = 130 - d * 40; b = 200 - d * 40; }
          else if (h < 2.2) { r = 226; g = 210; b = 150; }
          else {
            const s = U.clamp((h - 2) / 50, 0, 1);
            r = 90 + s * 60; g = 160 - s * 20; b = 70 + s * 50;
          }
          const i = (py * S + px) * 4;
          img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const toPx = (v) => (v + MAP_HALF) / k;
      // carreteras
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // carreteras y calles de los pueblos (mapStreets: sólo se dibujan en el mapa)
      for (const rd of (W.roads || []).concat(W.mapStreets || [])) {
        for (const [w, col] of [[(W.ROAD_HALF * 2 + 2) / k, '#3b3d42'], [(W.ROAD_HALF * 2) / k, '#6b6e75']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1.5, w);
          ctx.beginPath();
          rd.pts.forEach((q, i) => (i ? ctx.lineTo(toPx(q.x), toPx(q.z)) : ctx.moveTo(toPx(q.x), toPx(q.z))));
          ctx.stroke();
        }
      }
      for (const bd of W.buildings) {
        const col = new THREE.Color(bd.color).multiplyScalar(0.75);
        ctx.fillStyle = '#' + col.getHexString();
        ctx.fillRect(toPx(bd.x0), toPx(bd.z0), (bd.x1 - bd.x0) / k, (bd.z1 - bd.z0) / k);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(toPx(bd.x0), toPx(bd.z0), (bd.x1 - bd.x0) / k, (bd.z1 - bd.z0) / k);
      }
      ctx.fillStyle = '#c9b37a';
      ctx.fillRect(toPx(-3.5), toPx(-3.5), 7 / k, 7 / k);
      // copas de los árboles gigantes
      ctx.fillStyle = 'rgba(28, 72, 38, 0.85)';
      for (const t of W.mapTrees || []) {
        ctx.beginPath();
        ctx.arc(toPx(t.x), toPx(t.z), Math.max(1.2, t.r / k), 0, Math.PI * 2);
        ctx.fill();
      }
      this.mapImg = c;
      this.mapK = k;
    },

    worldToMini(x, z, cx, cz, s) {
      return [100 + (x - cx) * s, 100 + (z - cz) * s];
    },

    drawMinimap(p) {
      const ctx = this.mctx, k = this.mapK;
      if (!this.mapImg) return;
      const view = 260, s = 200 / view;
      const cx = p.mode === 'bus' ? G.Bus.pos.x : p.pos.x, cz = p.mode === 'bus' ? G.Bus.pos.z : p.pos.z;
      ctx.fillStyle = '#1b5d8c';
      ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(this.mapImg, (cx - view / 2 + MAP_HALF) / k, (cz - view / 2 + MAP_HALF) / k, view / k, view / k, 0, 0, 200, 200);
      const tf = (x, z) => this.worldToMini(x, z, cx, cz, s);
      this.drawStorm(ctx, tf, s, 200);
      if (G.Bus.active) this.drawBusPath(ctx, tf);
      this.drawPlayerArrow(ctx, 100, 100, p, 1);
    },

    drawStorm(ctx, tf, s, size) {
      const St = G.Storm;
      const [sx, sy] = tf(St.cur.x, St.cur.z);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size, size);
      ctx.arc(sx, sy, Math.max(0, St.cur.r * s), 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(150, 50, 230, 0.42)';
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0, St.cur.r * s), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,120,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (St.state !== 'final') {
        const [nx, ny] = tf(St.next.x, St.next.z);
        ctx.beginPath();
        ctx.arc(nx, ny, Math.max(0, St.next.r * s), 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    },

    drawBusPath(ctx, tf) {
      const B = G.Bus;
      const a = B.pointAt(0, _v.clone()), b = B.pointAt(B.length, _v.clone());
      const [ax, ay] = tf(a.x, a.z), [bx, by] = tf(b.x, b.z);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      const [px, py] = tf(B.pos.x, B.pos.z);
      ctx.fillStyle = '#ffc531';
      ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    },

    drawPlayerArrow(ctx, x, y, p, scale) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(fz, fx));
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },

    setBigMap(v) {
      this.bigOpen = v;
      this.el.bigmap.classList.toggle('hidden', !v);
      if (v) this.mapT = 0;
    },

    drawBigMap(p) {
      const ctx = this.bctx, S = 760, s = S / (MAP_HALF * 2);
      const tf = (x, z) => [(x + MAP_HALF) * s, (z + MAP_HALF) * s];
      ctx.drawImage(this.mapImg, 0, 0, S, S);
      this.drawStorm(ctx, tf, s, S);
      if (G.Bus.active) this.drawBusPath(ctx, tf);
      ctx.font = 'bold 15px Rubik, Arial';
      ctx.textAlign = 'center';
      for (const poi of G.World.pois) {
        const [x, y] = tf(poi.x, poi.z);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(poi.name.toUpperCase(), x, y - (poi.city ? 48 : 22));
        ctx.fillStyle = '#fff';
        ctx.fillText(poi.name.toUpperCase(), x, y - (poi.city ? 48 : 22));
      }
      const pos = p.mode === 'bus' ? G.Bus.pos : p.pos;
      const [px, py] = tf(pos.x, pos.z);
      this.drawPlayerArrow(ctx, px, py, p, 1.4);
    },
  });
})();

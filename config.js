/* =====================================================================
   config.js — Todos los números del juego en un solo sitio.
   Si quieres cambiar el daño de un arma, la vida, la cantidad de bots,
   lo que cuesta construir... este es el archivo que tienes que tocar.
   ===================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  G.CONFIG = {
    /* Medidas inspiradas en el Capítulo 1 de Fortnite (Epic no da todas las cifras:
       las que no son oficiales están marcadas como "aprox."). */
    worldSize: 2300,        // lado del mundo en metros (incluye el mar)
    mapSeed: 73,            // la isla es SIEMPRE la misma (cambia este número para otra isla distinta)
    terrainSeg: 384,        // resolución de la malla del terreno (un punto cada 6 m)
    islandRadius: 740,      // radio aproximado de la isla: ~1,5 km de lado a lado (el original, aprox. 2,5 km)
    waterLevel: 0,
    gravity: 24,
    floorHeight: 3.84,      // altura de cada planta = una pared de construcción (384 cm)

    player: {
      radius: 0.4, height: 1.85, crouchHeight: 1.3,
      eye: 1.66, crouchEye: 1.15,
      // correr 5,48 m/s, esprintar 7,39 m/s y correr agachado 4,18 m/s (wiki de Fortnite)
      walk: 5.48, sprint: 7.39, crouchSpeed: 4.18, adsSpeed: 3.6, useSpeed: 2.6, tiredSpeed: 4.6,
      jump: 7.6, stepUp: 0.6,
    },

    bus: { height: 260, speed: 32, halfLength: 1150 },   // vuela por encima de las nubes

    // Caída libre y planeador
    // Fortnite: caída en picado 37 m/s, caída libre 12,75 m/s en horizontal, planeador 18,5 m/s
    // en horizontal (19 m/s en diagonal: baja unos 4,3 m/s) y se abre solo a unos 100 m
    sky: {
      fall: 22, diveFall: 37, hSpeed: 12.75,
      glideFall: 4.3, glideH: 18.5,
      autoGlide: 100,    // a esta altura sobre el suelo se abre el planeador solo
      manualGlide: 200,  // por debajo de esta altura puedes abrirlo con ESPACIO
    },

    maxHealth: 100,
    maxShield: 100,

    // motos
    moto: {
      radius: 0.5,
      maxRoad: 27, maxOff: 17,          // m/s por asfalto (97 km/h) y fuera de él (61 km/h)
      accel: 12, brake: 22, reverseAccel: 6, maxReverse: 6,
      turn: 2.5, hop: 6, maxLaunch: 9,  // giro, saltito con Espacio y salto máximo al salir de una rampa
      crashSpeed: 15, safeLand: 19,     // a partir de aquí, chocar o aterrizar duele
      hitSpeed: 6, hitDamage: 2.2,      // atropellar: daño = velocidad x 2,2
    },
    // Aguante: correr lo gasta; si llega a 0 estás cansado y no puedes correr hasta recuperar un poco
    stamina: { max: 100, drain: 17, regen: 24, regenDelay: 0.8, recover: 35 },

    // Daño de caída: a partir de 9 m de caída, 5 de daño por cada metro de más (va directo a la vida)
    fall: { safeHeight: 9, perMeter: 5 },

    slots: 5,           // huecos del inventario (armas y curas)
    pickupRadius: 2.6,
    autoPickupRadius: 1.7,

    // Construcción: como en Fortnite, cada pieza ocupa una casilla de 5,12 x 5,12 m y 3,84 m de alto
    build: { size: 5.12, height: 3.84, cost: 10, reach: 7 },
  };

  /* ---------- Rarezas ----------
     name[0] = masculino (fusil, francotirador), name[1] = femenino (pistola, escopeta) */
  G.RARITIES = [
    { name: ['Común', 'Común'],             color: '#aab0b6', hex: 0xaab0b6 },
    { name: ['Poco común', 'Poco común'],   color: '#4fcf4f', hex: 0x4fcf4f },
    { name: ['Raro', 'Rara'],               color: '#3d8bff', hex: 0x3d8bff },
    { name: ['Épico', 'Épica'],             color: '#b452ff', hex: 0xb452ff },
    { name: ['Legendario', 'Legendaria'],   color: '#ffa21c', hex: 0xffa21c },
  ];

  /* Probabilidad (en %) de cada rareza. Cuanto más daño, más difícil de encontrar.
     Los cofres dan mejores armas que el suelo. */
  G.RARITY_WEIGHTS = {
    floor: [46, 30, 15, 7, 2],
    chest: [16, 32, 29, 17, 6],
  };

  /* ---------- Armas ----------
     damage[i]  = daño por disparo según rareza (0 común ... 4 legendaria)
     reload[i]  = segundos de recarga según rareza
     weight     = probabilidad de que salga ese tipo de arma (las de más daño salen menos)
     falloff    = [empieza a bajar (m), daño mínimo a partir de (m), % de daño mínimo]
     structMult = multiplicador de daño contra paredes y construcciones
     Daño, cadencia, cargador, recarga y multiplicador de cabeza: los del Capítulo 1 (wiki de
     Fortnite). En el Capítulo 1 no todas las armas tenían las 5 rarezas: las que faltaban
     están calculadas siguiendo la misma progresión (marcadas con "aprox."). */
  G.WEAPONS = {
    pistol: {
      id: 'pistol', name: 'Pistola', fem: true, ammo: 'light', weight: 34,
      damage: [23, 24, 25, 26, 27], headMult: 2.0, structMult: 1,          // épica y legendaria: aprox.
      fireRate: 6.75, auto: false, mag: 16, reload: [1.54, 1.47, 1.4, 1.33, 1.26], pellets: 1,
      spread: { hip: 0.03, ads: 0.012, move: 0.02, air: 0.06, crouch: 0.7, bloom: 0.008, bloomMax: 0.04 },
      range: 220, falloff: [30, 120, 0.65], adsFov: 60, recoil: 0.012,
    },
    rifle: {
      id: 'rifle', name: 'Fusil', fem: false, ammo: 'medium', weight: 30,
      damage: [30, 31, 33, 35, 36], headMult: 2.0, structMult: 1,          // épica y legendaria: la "SCAR"
      fireRate: 5.5, auto: true, mag: 30, reload: [2.28, 2.23, 2.18, 2.07, 1.98], pellets: 1,   // recarga épica/legendaria: aprox.
      spread: { hip: 0.035, ads: 0.006, move: 0.025, air: 0.07, crouch: 0.65, bloom: 0.006, bloomMax: 0.05 },
      range: 320, falloff: [50, 200, 0.7], adsFov: 50, recoil: 0.01,
    },
    shotgun: {
      id: 'shotgun', name: 'Escopeta', fem: true, ammo: 'shells', weight: 24,
      // escopeta de corredera: 90 / 95 (poco común / rara) y cabeza x2,5; común, épica y legendaria: aprox.
      damage: [85, 90, 95, 100, 105], headMult: 2.5, structMult: 1,   // daño total si aciertan todos los perdigones
      fireRate: 0.7, auto: false, mag: 5, reload: [5.06, 4.84, 4.62, 4.4, 4.18], pellets: 10,   // 0,7 disparos/s (1,4 s entre tiros)
      // dispersión cerrada: los perdigones caen juntos (y la mira de la escopeta es pequeña)
      spread: { hip: 0.045, ads: 0.032, move: 0.008, air: 0.015, crouch: 0.85, bloom: 0, bloomMax: 0 },
      range: 50, falloff: [8, 34, 0.25], adsFov: 62, recoil: 0.05,
    },
    sniper: {
      id: 'sniper', name: 'Francotirador', fem: false, ammo: 'heavy', weight: 12,
      // francotirador de cerrojo: 105 / 110 / 116 (rara / épica / legendaria); común y poco común: aprox.
      damage: [95, 100, 105, 110, 116], headMult: 2.5, structMult: 1,
      fireRate: 0.33, auto: false, mag: 1, reload: [3.3, 3.15, 3.0, 2.85, 2.7], pellets: 1,
      spread: { hip: 0.08, ads: 0.0, move: 0.04, air: 0.1, crouch: 0.8, bloom: 0, bloomMax: 0 },
      range: 700, falloff: [700, 700, 1], adsFov: 14, scope: true, recoil: 0.06,
    },
    // fusil de ráfagas (tipo Famas): cada clic dispara una ráfaga de 3 balas.
    // fireRate = ráfagas por segundo · burst = balas por ráfaga · burstGap = segundos entre balas de la ráfaga
    burst: {
      id: 'burst', name: 'Fusil de ráfagas', fem: false, ammo: 'medium', weight: 18,
      damage: [27, 29, 30, 32, 33], headMult: 2.0, structMult: 1,          // común a rara: Capítulo 1; épica y legendaria: aprox.
      fireRate: 1.3, burst: 3, burstGap: 0.07, auto: false, mag: 30, reload: [2.9, 2.75, 2.6, 2.5, 2.4], pellets: 1,
      spread: { hip: 0.03, ads: 0.008, move: 0.022, air: 0.07, crouch: 0.65, bloom: 0.005, bloomMax: 0.03 },
      range: 300, falloff: [45, 180, 0.7], adsFov: 50, recoil: 0.008,
    },
    // escopeta táctica: dispara más rápido que la de corredera pero hace menos daño y abre más los perdigones
    tactical: {
      id: 'tactical', name: 'Escopeta táctica', fem: true, ammo: 'shells', weight: 20,
      damage: [67, 70, 74, 78, 81], headMult: 2.0, structMult: 1,          // común a rara: Capítulo 1; épica y legendaria: aprox.
      fireRate: 1.5, auto: false, mag: 8, reload: [6.3, 6.0, 5.7, 5.4, 5.1], pellets: 10,
      spread: { hip: 0.058, ads: 0.044, move: 0.01, air: 0.02, crouch: 0.85, bloom: 0, bloomMax: 0 },
      range: 45, falloff: [7, 30, 0.25], adsFov: 64, recoil: 0.035,
    },
    // lanzamisiles: lanza un misil que vuela (no es instantáneo) y explota haciendo daño en un radio.
    // damage = daño en el centro de la explosión · blast = radio (m) · structDamage = daño a paredes y construcciones
    rocket: {
      id: 'rocket', name: 'Lanzamisiles', fem: false, ammo: 'rockets', weight: 5, minRarity: 2,   // sólo sale rara, épica o legendaria
      damage: [100, 105, 110, 116, 121], headMult: 1, structMult: 1,      // rara a legendaria: Capítulo 1
      fireRate: 0.75, auto: false, mag: 1, reload: [3.6, 3.44, 3.28, 3.12, 2.96], pellets: 1,
      spread: { hip: 0.02, ads: 0.004, move: 0.02, air: 0.05, crouch: 0.8, bloom: 0, bloomMax: 0 },
      range: 400, falloff: [400, 400, 1], adsFov: 55, recoil: 0.05,
      projectile: { speed: 60, blast: 4.2, structDamage: 400, life: 6 },
    },
  };
  // ¡no cambies el orden! (el multijugador manda las armas por su número de posición). Las nuevas, al final.
  G.WEAPON_IDS = ['rifle', 'pistol', 'shotgun', 'sniper', 'burst', 'tactical', 'rocket'];

  /* ---------- Pico (siempre lo llevas, tecla F) ---------- */
  G.PICKAXE = {
    name: 'Pico',
    damage: 20,          // daño a jugadores
    structDamage: 50,    // daño a paredes, árboles, rocas...
    rate: 1.9,           // golpes por segundo
    range: 2.9,
  };

  /* ---------- Munición: un tipo para cada arma ---------- */
  G.AMMO = {
    light:  { name: 'Balas ligeras', short: 'Ligeras',   color: '#7ec8ff', hex: 0x7ec8ff, pickup: 32, max: 999, weapon: 'pistol' },
    medium: { name: 'Balas medias',  short: 'Medias',    color: '#6fe08a', hex: 0x6fe08a, pickup: 30, max: 999, weapon: 'rifle' },
    shells: { name: 'Cartuchos',     short: 'Cartuchos', color: '#ffcf6e', hex: 0xffcf6e, pickup: 8,  max: 999, weapon: 'shotgun' },
    heavy:  { name: 'Balas pesadas', short: 'Pesadas',   color: '#ff7f6e', hex: 0xff7f6e, pickup: 6,  max: 999, weapon: 'sniper' },
    rockets: { name: 'Cohetes',      short: 'Cohetes',   color: '#c8a2ff', hex: 0xc8a2ff, pickup: 3,  max: 999, weapon: 'rocket' },
  };
  G.AMMO_IDS = ['light', 'medium', 'shells', 'heavy', 'rockets'];
  // probabilidad de cada munición suelta por el suelo (los cohetes son escasos)
  G.AMMO_DROP = { light: 30, medium: 30, shells: 24, heavy: 14, rockets: 5 };

  /* ---------- Curas (ocupan un hueco del inventario, se usan con clic) ---------- */
  G.CONSUMABLES = {
    // como en el Capítulo 1: la poción tarda 5 s y el botiquín 10 s
    potion: { id: 'potion', name: 'Poción de escudo', short: 'Poción', time: 5.0, stack: 3, color: '#3fa9ff', hex: 0x3fa9ff, effect: 'shield', amount: 50, verb: 'Bebiendo poción…' },
    medkit: { id: 'medkit', name: 'Botiquín', short: 'Botiquín', time: 10.0, stack: 3, color: '#ff5a5a', hex: 0xff5a5a, effect: 'health', amount: 100, verb: 'Usando botiquín…' },
  };
  G.CONSUMABLE_IDS = ['potion', 'medkit'];

  /* ---------- Materiales de construcción ----------
     hp = vida de una pieza construida con ese material
     buildTime = segundos que tarda la pieza en llegar a su vida máxima */
  G.MATERIALS = {
    // vida de una pared en el Capítulo 1: madera 150, piedra (ladrillo) 300, metal 500; hasta 999 de cada
    wood:  { id: 'wood',  name: 'Madera', color: '#d39a5b', hex: 0xd39a5b, hp: 150, buildTime: 1.2, max: 999 },
    stone: { id: 'stone', name: 'Piedra', color: '#b5b8bd', hex: 0xb5b8bd, hp: 300, buildTime: 2.5, max: 999 },
    metal: { id: 'metal', name: 'Metal',  color: '#8fb0cf', hex: 0x8fb0cf, hp: 500, buildTime: 4.0, max: 999 },
  };
  G.MATERIAL_IDS = ['wood', 'stone', 'metal'];

  G.PIECES = {
    wall:  { id: 'wall',  name: 'Pared' },
    floor: { id: 'floor', name: 'Suelo' },
    ramp:  { id: 'ramp',  name: 'Rampa' },
    cone:  { id: 'cone',  name: 'Cono' },
  };
  G.PIECE_IDS = ['wall', 'floor', 'ramp', 'cone'];

  /* ---------- Tormenta (zona segura que se va cerrando) ---------- */
  // (con la isla más grande, círculos más grandes y fases más largas; daño parecido al del Capítulo 1)
  G.STORM_PHASES = [
    { wait: 90, shrink: 60, radius: 440, dmg: 1 },
    { wait: 60, shrink: 45, radius: 270, dmg: 1 },
    { wait: 45, shrink: 35, radius: 150, dmg: 2 },
    { wait: 35, shrink: 30, radius: 75,  dmg: 5 },
    { wait: 25, shrink: 20, radius: 30,  dmg: 8 },
    { wait: 15, shrink: 25, radius: 0,   dmg: 10 },
  ];

  /* ---------- Dificultad de los bots ---------- */
  G.DIFFICULTY = {
    // build = probabilidad de que reaccione construyendo (muro para cubrirse, rampas, cajas para curarse)
    facil:   { label: 'Fácil',   aimError: 0.09,  reaction: [0.9, 1.4], fireMult: 0.4,  turn: 3.0, headChance: 0.04, build: 0.3 },
    normal:  { label: 'Normal',  aimError: 0.055, reaction: [0.5, 0.9], fireMult: 0.55, turn: 4.2, headChance: 0.1, build: 0.65 },
    dificil: { label: 'Difícil', aimError: 0.026, reaction: [0.25, 0.45], fireMult: 0.85, turn: 7.0, headChance: 0.22, build: 1.0 },
  };

  /* ---------- Bots peleando entre ellos ----------
     (contra ti juegan igual que siempre; esto sólo afecta a bot contra bot) */
  G.BOT_TUNING = {
    // (los bots se pelean entre ellos casi igual que contigo: si no, al final quedan muchos y sólo van a por ti)
    botDamage: 0.65,    // daño que un bot le hace a otro bot (× el normal)
    botAim: 1.35,       // error de puntería de un bot apuntando a otro bot (× el normal)
    botReact: 1.25,     // tiempo de reacción ante otro bot (× el normal)
    botRange: 90,       // más lejos de esto, un bot no "ve" a otros bots (salvo que le ataquen)
    lootTime: 45,       // segundos tras aterrizar en los que sólo busca botín (a un bot sólo le responde si le ataca)
    calmBots: 0.15,     // parte de los bots "tranquilos": no empiezan peleas con otros bots... hasta la 3.ª zona
    huntPhase: 2,       // desde esta fase de la tormenta, los bots sin enemigo a la vista se buscan entre sí
    hearRange: 160,     // a esta distancia oyen los disparos (y van a ver qué pasa)
    randomDrop: 0.45,   // parte de los bots que caen en sitios sueltos, no en pueblos
  };

  /* ---------- Calidad gráfica ----------
     scale = resolución de partida (1 = nativa). El juego la baja sola si van pocos FPS. */
  G.QUALITY = {
    baja:  { label: 'Baja',  aa: false, shadows: false, scale: 0.75, minScale: 0.5, fog: [170, 480], far: 560,  loot: 55,  chars: 160, lod: 60, clouds: false, maxPR: 1 },
    media: { label: 'Media', aa: false, shadows: false, scale: 1.0,  minScale: 0.6, fog: [230, 800], far: 880,  loot: 80,  chars: 240, lod: 90, clouds: true,  maxPR: 1 },
    alta:  { label: 'Alta',  aa: true,  shadows: true,  scale: 1.0,  minScale: 0.7, fog: [260, 1100], far: 1250, loot: 100, chars: 320, lod: 130, clouds: true,  maxPR: 1.5 },
  };

  G.BOT_NAMES = [
    'Paco', 'Lucía', 'Chema', 'Marta', 'Rober', 'Nerea', 'Kike', 'Sara', 'Toni', 'Alba',
    'Iker', 'Noa', 'Pepe', 'Carla', 'Dani', 'Irene', 'Rubén', 'Vega', 'Hugo', 'Lola',
    'Mario', 'Julia', 'Álex', 'Paula', 'Jorge', 'Elena', 'Bruno', 'Clara', 'Gonzalo', 'Aitana',
    'Raúl', 'Inés', 'Óscar', 'Laia', 'Unai', 'Candela', 'Pablo', 'Mía', 'Leo', 'Zoe',
    'Adrián', 'Nora', 'Marcos', 'Sofía', 'Diego', 'Valeria', 'Sergio', 'Lara', 'Íñigo', 'Ainhoa',
    'Víctor', 'Rocío', 'Nacho', 'Estela', 'Teo', 'Olivia', 'Fede', 'Martina', 'Quique', 'Celia',
    'Andrés', 'Blanca', 'Jaime', 'Lorena', 'Samu', 'Ariadna', 'Rafa', 'Emma', 'Mateo', 'Carmen',
    'Gael', 'Daniela', 'Álvaro', 'Silvia', 'Luca', 'Natalia', 'Eric', 'Triana', 'Joel', 'Alicia',
    'Nico', 'Berta', 'Ismael', 'Gala', 'Iván', 'Mara', 'Lucas', 'Jimena', 'Tomás', 'Ona',
  ];

  // Ajustes que el jugador cambia en el menú (se guardan en el navegador)
  G.BOT_OPTIONS = [10, 20, 30, 50, 75, 100];   // cuántos bots se pueden elegir en el menú

  G.SETTINGS = {
    bots: 30,
    difficulty: 'normal',
    sensitivity: 1.0,
    quality: 'media',
    autoRes: true,
    showFps: false,
    camera: 'tercera',
    volume: 0.7,
  };

  /* ---------- Rango (partidas con cuenta) ----------
     Cada partida da o quita PUNTOS DE RANGO (RP). Con los RP subes o bajas de rango.
     Bronce, Plata, Oro, Platino y Diamante tienen 3 divisiones (I, II y III); Élite, As y Unreal, una. */
  G.RANKED = {
    ranks: [
      { name: 'Bronce',   color: '#cd7f32', min: 0,     divs: 3 },   // 0 – 1000
      { name: 'Plata',    color: '#c9d1d9', min: 1001,  divs: 3 },   // 1001 – 2000
      { name: 'Oro',      color: '#ffc933', min: 2001,  divs: 3 },   // 2001 – 4000
      { name: 'Platino',  color: '#38d6c4', min: 4001,  divs: 3 },   // 4001 – 6000
      { name: 'Diamante', color: '#58a6ff', min: 6001,  divs: 3 },   // 6001 – 8000
      { name: 'Élite',    color: '#ff8a3d', min: 8001,  divs: 1 },   // 8001 – 10000
      { name: 'As',       color: '#ff3d6e', min: 10001, divs: 1 },   // 10001 – 12500
      { name: 'Unreal',   color: '#b452ff', min: 12501, divs: 1 },   // 12501 en adelante, sin límite de puntos
    ],
    win: 60,                 // RP por ganar la partida
    // RP por el puesto: [hasta qué parte de la tabla, RP]. 0 = el 2º, 1 = el primero en caer.
    // Quedar en la mitad de arriba suma; caer pronto resta.
    placement: [[0.10, 30], [0.25, 15], [0.50, 4], [0.75, -12], [1, -28]],
    killBase: 8,             // cada baja: 8 RP al principio de la partida…
    killLate: 14,            // …y hasta 8 + 14 = 22 RP cuando ya casi no queda nadie
    rankLoss: 0.18,          // por cada rango de más, lo que pierdes por caer pronto pesa un 18 % más
    rankGain: 0.06,          // y lo que ganas por el puesto, un 6 % menos (cuesta más subir arriba)
    difficulty: { facil: 0.6, normal: 1, dificil: 1.35 },   // multiplica lo ganado (no lo perdido)
    fullLobby: 31,           // con menos jugadores que esto en la partida, lo ganado se reduce (hasta la mitad)
    maxGain: 350,            // lo máximo que se puede ganar en una sola partida
  };
})();

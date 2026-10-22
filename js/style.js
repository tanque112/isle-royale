/* =====================================================================
   style.js — El "look" del juego: estilo cartoon de colores vivos
   (cielo azul intenso, verdes saturados, sol cálido, neblina azulada
   a lo lejos y tormenta morada), inspirado en los battle royale
   clásicos. Todo hecho por código, sin recursos de otros juegos.
   ===================================================================== */
(function () {
  'use strict';
  const G = window.G;

  G.STYLE = {
    // cielo y neblina
    skyTop: 0x1660d6, skyMid: 0x3f93ee, skyHorizon: 0xb8e4ff,
    fog: 0xa6d6fa,
    // luces
    hemiSky: 0xcfe8ff, hemiGround: 0x6f8a55, hemiI: 0.7,
    sun: 0xffe6b8, sunI: 0.9,
    // dentro de la tormenta todo se vuelve morado
    stormFog: 0x6e33bd, stormSky: 0x4a1f8f,
    // de dónde viene el sol (la luz, el disco del cielo y el sombreado de las nubes)
    sunDir: [120, 200, 70],
    // nubes
    cloudTop: 0xffffff, cloudBottom: 0xb9cbe6,
  };

  /* Corrección de color para TODA la escena: va al final de los shaders de three.js
     (materiales Basic, Lambert y Phong), así que no cuesta un pase extra de pantalla.
     - más saturación (colores "de dibujo animado")
     - un hombro suave para que el sol fuerte no queme los blancos
     - un poco de contraste en S
     - sombras algo más azules y luces algo más cálidas */
  THREE.ShaderChunk.dithering_fragment = [
    '{',
    '  vec3 gc = max(gl_FragColor.rgb, 0.0);',
    '  vec3 over = max(gc - 0.85, 0.0);',
    '  gc = gc - over + over / (1.0 + over * 3.0);',
    '  float gl = dot(gc, vec3(0.299, 0.587, 0.114));',
    '  gc = mix(vec3(gl), gc, 1.16);',
    '  gc = clamp(gc, 0.0, 1.0);',
    '  gc = mix(gc, gc * gc * (3.0 - 2.0 * gc), 0.2);',
    '  gc.b += 0.035 * (1.0 - gl) * (1.0 - gl);',
    '  gc.r += 0.03 * gl * gl;',
    '  gl_FragColor.rgb = gc;',
    '}',
    THREE.ShaderChunk.dithering_fragment,
  ].join('\n');

  /* Cielo: degradado de azul intenso arriba a celeste en el horizonte, con el sol y su
     halo. Se dibuja siempre en el fondo (sus vértices se empujan al plano lejano). */
  G.makeSkyMaterial = function (sunDir) {
    const S = G.STYLE;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(S.skyTop) },
        uMid: { value: new THREE.Color(S.skyMid) },
        uHor: { value: new THREE.Color(S.skyHorizon) },
        uFog: { value: new THREE.Color(S.fog) },
        uStormCol: { value: new THREE.Color(S.stormSky) },
        uStorm: { value: 0 },
        uSun: { value: sunDir.clone().normalize() },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = p.xyww;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop, uMid, uHor, uFog, uStormCol, uSun;',
        'uniform float uStorm;',
        'varying vec3 vDir;',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  float h = d.y;',
        '  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.28, h));',
        '  c = mix(c, uTop, smoothstep(0.25, 0.85, h));',
        '  c = mix(c, uFog, 1.0 - smoothstep(-0.02, 0.06, h));',   // por debajo del horizonte, igual que la neblina
        '  float s = max(dot(d, uSun), 0.0);',
        '  c += vec3(1.0, 0.9, 0.7) * (pow(s, 8.0) * 0.22 + pow(s, 64.0) * 0.35);',   // halo
        '  c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.9975, 0.9985, s));',        // disco del sol
        '  c = mix(c, uStormCol * (0.8 + 0.4 * h), uStorm * 0.85);',
        '  gl_FragColor = vec4(c, 1.0);',
        '  #include <dithering_fragment>',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
  };

  /* Nubes esponjosas: bolas redondas agrupadas, con la base plana y el sombreado ya
     "pintado" en los colores (blanco arriba y donde da el sol, azul grisáceo abajo).
     Así se dibujan con un material básico, sin calcular luces. */
  G.makeCloudGeometry = function (rng, sunDir) {
    const S = G.STYLE;
    const rr = (a, b) => a + rng() * (b - a);
    const top = new THREE.Color(S.cloudTop), bot = new THREE.Color(S.cloudBottom), c = new THREE.Color();
    const sd = sunDir.clone().normalize();
    const ball = new THREE.IcosahedronGeometry(1, 2);
    const bp = ball.attributes.position, bn = ball.attributes.normal;
    const idx = ball.index ? ball.index.array : null;
    const pos = [], col = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const spread = G.CONFIG.islandRadius * 2;
    for (let i = 0; i < 48; i++) {
      const cx = rr(-spread, spread), cz = rr(-spread, spread), base = rr(200, 245);
      const big = rr(0.8, 1.35);
      const puffs = 5 + Math.floor(rng() * 5);
      for (let j = 0; j < puffs; j++) {
        // las bolas del centro son más grandes y altas: forma de cúmulo
        const t = j / puffs, a = rng() * Math.PI * 2;
        const off = (1 - Math.abs(t - 0.5) * 2);
        const r = rr(13, 22) * big * (0.7 + off * 0.6);
        const px = cx + Math.cos(a) * rr(6, 38) * big, pz = cz + Math.sin(a) * rr(4, 22) * big;
        const py = base + r * rr(0.25, 0.6);
        const count = idx ? idx.length : bp.count;
        for (let k = 0; k < count; k++) {
          const q = idx ? idx[k] : k;
          v.fromBufferAttribute(bp, q);
          n.fromBufferAttribute(bn, q);
          let y = py + v.y * r * 0.82;
          if (y < base) y = base;                       // base plana
          pos.push(px + v.x * r, y, pz + v.z * r);
          const up = THREE.MathUtils.clamp((y - base) / (r * 1.4), 0, 1);
          const lit = Math.max(0, n.dot(sd)) * 0.55 + up * 0.6;
          c.copy(bot).lerp(top, THREE.MathUtils.clamp(lit, 0, 1));
          col.push(c.r, c.g, c.b);
        }
      }
    }
    ball.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  };

  /* Muro de la tormenta: cortina morada con remolinos que suben y se mueven,
     más brillante cerca del suelo y en los bordes. */
  G.makeStormMaterial = function (timeU) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: timeU },
      vertexShader: [
        'varying vec2 vUv;',
        'varying vec3 vW;',
        'void main() {',
        '  vUv = uv;',
        '  vec4 w = modelMatrix * vec4(position, 1.0);',
        '  vW = w.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * w;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'varying vec2 vUv;',
        'varying vec3 vW;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p) {',
        '  vec2 i = floor(p), f = fract(p);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
        '}',
        'float fbm(vec2 p, float t) {',
        '  return noise(p + vec2(t * 0.6, -t * 0.35)) * 0.55 + noise(p * 2.3 + vec2(-t * 0.9, -t * 0.7)) * 0.3 + noise(p * 5.1 + vec2(t * 1.3, -t)) * 0.15;',
        '}',
        'void main() {',
        '  float t = uTime;',
        // el ruido se proyecta en X o en Z según hacia dónde mira el muro (sin costuras)
        '  float ang = vUv.x * 6.2831853;',
        '  float wx = cos(ang) * cos(ang);',
        '  float y = vW.y * 0.035;',
        '  float n = mix(fbm(vec2(vW.z * 0.03, y), t), fbm(vec2(vW.x * 0.03, y), t), wx);',
        '  float swirl = smoothstep(0.35, 0.85, n);',
        '  vec3 deep = vec3(0.32, 0.10, 0.62), mid = vec3(0.58, 0.22, 0.95), hi = vec3(0.88, 0.62, 1.0);',
        '  vec3 c = mix(deep, mid, n);',
        '  c = mix(c, hi, swirl * 0.55);',
        '  float ground = 1.0 - smoothstep(0.0, 60.0, vW.y);',
        '  c += vec3(0.35, 0.2, 0.5) * ground;',
        '  float a = 0.34 + swirl * 0.2 + ground * 0.25;',
        '  a *= 1.0 - smoothstep(380.0, 540.0, vW.y);',
        '  gl_FragColor = vec4(c, a);',
        '}',
      ].join('\n'),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
  };
})();

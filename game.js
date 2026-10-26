/* ===================== STRIKE ZONE - game.js =====================
   Main game: menu, player, enemies, shooting, store, HUD, score.
   Needs (loaded before): three.js, audio.js, weapons.js, maps.js
*/
(function () {
  'use strict';

  /* ------------------------------------------------------------
     small helpers
  ------------------------------------------------------------ */
  const $ = function (id) { return document.getElementById(id); };
  const rand = function (a, b) { return a + Math.random() * (b - a); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  const V3 = THREE.Vector3;
  const BASE_FOV = 78;
  const SWITCH_TIME = 0.35;
  const EYE = 1.65;
  const PLAYER_R = 0.45;

  const QUALITY = {
    high:   { pr: 2,    shadows: true,  shadowSize: 2048, density: 1 },
    medium: { pr: 1.25, shadows: true,  shadowSize: 1024, density: 0.8 },
    low:    { pr: 0.8,  shadows: false, shadowSize: 512,  density: 0.55 }
  };

  const POVS = [
    { name: 'First Person',         shoulder: 0,    dist: 0 },
    { name: 'Third Person (Close)', shoulder: 0.55, dist: 2.6 },
    { name: 'Third Person (Far)',   shoulder: 0,    dist: 5.5 }
  ];

  const ENEMY_NAMES = ['Viper', 'Ghost', 'Raven', 'Wolf', 'Falcon', 'Cobra', 'Hawk', 'Shadow', 'Rogue', 'Titan', 'Reaper', 'Jackal', 'Bishop', 'Havoc'];

  /* ------------------------------------------------------------
     renderer + camera (created once)
  ------------------------------------------------------------ */
  const canvas = $('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 700);
  camera.rotation.order = 'YXZ';

  let scene = null;
  let world = null;
  const raycaster = new THREE.Raycaster();

  /* ------------------------------------------------------------
     game state
  ------------------------------------------------------------ */
  const G = {
    state: 'menu',            // menu | playing | store | paused | dead
    username: 'Player',
    mapIndex: 0,
    quality: 'high',
    charIndex: 0,
    sens: 1,
    time: 0,
    kills: 0, headshots: 0, coins: 500,
    hp: 100, maxHp: 100,
    pos: new V3(0, 0, 0), velY: 0, onGround: true,
    yaw: 0, pitch: 0,
    pov: 0, ads: 0, adsHeld: false, fireHeld: false, firePressed: false,
    moveAmt: 0, bob: 0, stepDist: 0, speedNow: 0,
    vx: 0, vz: 0, crouch: 0, sprint: 0, roll: 0, landDip: 0,
    dummies: [], inTrain: false, wasTrain: false, trainHintT: 0,
    slots: [null, null, null, null], cur: 0, lastSlot: 0,
    owned: {}, ammo: {},
    reloading: 0, reloadTotal: 1, switching: 0, nextFire: 0,
    kick: 0, recoilSpread: 0, flashT: 0,
    meleeSwing: 0, meleeDur: 0.4, meleeDone: true,
    autoReload: 0,
    enemies: [], spawnTimer: 0,
    particles: [], tracers: [], decals: [], debris: [],
    dmgFlash: 0, dmgDirT: 0, hitT: 0, headT: 0, healT: 0, healing: false, healTick: 0,
    hintOn: false
  };
  window.__game = G; // handy for debugging in the browser console

  const keys = {};

  /* HUD elements */
  const HUD = {
    root: $('hud'), hpFill: $('hp-fill'), hpText: $('hp-text'),
    kills: $('s-kills'), best: $('s-best'), total: $('s-total'), hs: $('s-hs'), coins: $('s-coins'),
    ammoName: $('ammo-name'), ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'),
    slots: Array.prototype.slice.call(document.querySelectorAll('#slots .slot')),
    hint: $('hint'), killfeed: $('killfeed'), hit: $('hitmarker'), headText: $('headshot-text'),
    hsFlash: $('hs-flash'), hsKill: $('hs-kill'),
    vignette: $('damage-vignette'), dmgDir: $('damage-dir'), scope: $('scope-overlay'),
    cross: $('crosshair'), reloadBar: $('reload-bar'), user: $('hud-user'), map: $('hud-map'), pov: $('hud-pov'),
    mini: $('minimap')
  };

  const SETTINGS = {
    sound: true,
    vfx: true,
    hud: {
      minimap: true, stats: true, feed: true, slots: true, ammo: true, cross: true
    },
    hudScale: 1
  };
  const SET_KEY = 'strikezone_settings_v1';

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SET_KEY));
      if (!s) return;
      if (typeof s.sound === 'boolean') SETTINGS.sound = s.sound;
      if (typeof s.vfx === 'boolean') SETTINGS.vfx = s.vfx;
      if (s.hud) Object.keys(SETTINGS.hud).forEach(function (k) {
        if (typeof s.hud[k] === 'boolean') SETTINGS.hud[k] = s.hud[k];
      });
      if (s.hudScale) SETTINGS.hudScale = clamp(s.hudScale, 0.75, 1.25);
      if (s.sens) G.sens = clamp(s.sens, 0.3, 2.5);
    } catch (e) { /* ignore */ }
  }
  function saveSettings() {
    try {
      localStorage.setItem(SET_KEY, JSON.stringify({
        sound: SETTINGS.sound, vfx: SETTINGS.vfx, hud: SETTINGS.hud,
        hudScale: SETTINGS.hudScale, sens: G.sens
      }));
    } catch (e) { /* ignore */ }
  }
  function applySettings() {
    const soundWas = Sound._on;
    Sound.setEnabled(SETTINGS.sound);
    Sound._on = SETTINGS.sound;
    if (SETTINGS.sound && !soundWas && G.state === 'playing' && world) Sound.ambient(world.def.ambient);
    HUD.root.style.transform = 'scale(' + SETTINGS.hudScale + ')';
    HUD.root.classList.toggle('hide-minimap', !SETTINGS.hud.minimap);
    HUD.root.classList.toggle('hide-stats', !SETTINGS.hud.stats);
    HUD.root.classList.toggle('hide-feed', !SETTINGS.hud.feed);
    HUD.root.classList.toggle('hide-slots', !SETTINGS.hud.slots);
    HUD.root.classList.toggle('hide-ammo', !SETTINGS.hud.ammo);
    HUD.root.classList.toggle('hide-cross', !SETTINGS.hud.cross);
    $('set-sound').checked = SETTINGS.sound;
    $('set-vfx').checked = SETTINGS.vfx;
    $('set-sens').value = G.sens;
    setText($('set-sens-val'), Number(G.sens).toFixed(1));
    $('set-hud-scale').value = SETTINGS.hudScale;
    setText($('set-hud-scale-val'), Math.round(SETTINGS.hudScale * 100) + '%');
    $('hud-minimap').checked = SETTINGS.hud.minimap;
    $('hud-stats').checked = SETTINGS.hud.stats;
    $('hud-feed').checked = SETTINGS.hud.feed;
    $('hud-slots').checked = SETTINGS.hud.slots;
    $('hud-ammo').checked = SETTINGS.hud.ammo;
    $('hud-cross').checked = SETTINGS.hud.cross;
    if ($('sens')) $('sens').value = G.sens;
  }
  function syncSettingsFromPause() {
    SETTINGS.sound = $('set-sound').checked;
    SETTINGS.vfx = $('set-vfx').checked;
    G.sens = parseFloat($('set-sens').value) || 1;
    SETTINGS.hudScale = parseFloat($('set-hud-scale').value) || 1;
    SETTINGS.hud.minimap = $('hud-minimap').checked;
    SETTINGS.hud.stats = $('hud-stats').checked;
    SETTINGS.hud.feed = $('hud-feed').checked;
    SETTINGS.hud.slots = $('hud-slots').checked;
    SETTINGS.hud.ammo = $('hud-ammo').checked;
    SETTINGS.hud.cross = $('hud-cross').checked;
    applySettings();
    saveSettings();
  }
  const miniCtx = HUD.mini.getContext('2d');

  const textCache = new WeakMap();
  function setText(el, v) {
    v = String(v);
    if (textCache.get(el) !== v) { textCache.set(el, v); el.textContent = v; }
  }

  /* ------------------------------------------------------------
     saved scores (localStorage, per username)
  ------------------------------------------------------------ */
  const SCORE_KEY = 'strikezone_scores_v1';
  function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveScores(s) {
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function myRecord() {
    const s = loadScores();
    return s[G.username] || { best: 0, total: 0, headshots: 0 };
  }
  function recordKill(isHead) {
    const s = loadScores();
    const r = s[G.username] || { best: 0, total: 0, headshots: 0 };
    r.total += 1;
    if (isHead) r.headshots += 1;
    r.best = Math.max(r.best, G.kills);
    s[G.username] = r;
    saveScores(s);
  }
  function renderBoard() {
    const s = loadScores();
    const rows = Object.keys(s).map(function (n) { return { n: n, best: s[n].best, total: s[n].total }; })
      .sort(function (a, b) { return b.best - a.best || b.total - a.total; }).slice(0, 6);
    const tb = document.querySelector('#board tbody');
    tb.innerHTML = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="color:#8a97a3">No scores yet - go get some kills!</td>';
      tb.appendChild(tr);
      return;
    }
    rows.forEach(function (r, i) {
      const tr = document.createElement('tr');
      const me = r.n === ($('username').value.trim() || 'Player');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td class="' + (me ? 'me' : '') + '"></td><td>' + r.best + '</td><td>' + r.total + '</td>';
      tr.children[1].textContent = r.n; // textContent keeps usernames safe from HTML
      tb.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------
     menu
  ------------------------------------------------------------ */
  function buildMenu() {
    const chars = $('char-list');
    chars.innerHTML = '';
    CHARACTERS.forEach(function (ch, i) {
      const card = document.createElement('div');
      card.className = 'char-card' + (i === G.charIndex ? ' selected' : '');
      card.style.background = ch.preview;
      const info = document.createElement('div');
      info.className = 'info';
      const b = document.createElement('b'); b.textContent = ch.name;
      const sp = document.createElement('span'); sp.textContent = ch.role;
      info.appendChild(b); info.appendChild(sp);
      card.appendChild(info);
      card.addEventListener('click', function () {
        G.charIndex = i;
        Array.prototype.forEach.call(chars.children, function (c, j) { c.classList.toggle('selected', i === j); });
        try { localStorage.setItem('strikezone_char', String(i)); } catch (e) { /* ignore */ }
      });
      chars.appendChild(card);
    });

    const list = $('map-list');
    list.innerHTML = '';
    MAPS.forEach(function (m, i) {
      const card = document.createElement('div');
      card.className = 'map-card' + (i === G.mapIndex ? ' selected' : '');
      card.style.background = m.preview;
      const info = document.createElement('div');
      info.className = 'info';
      const b = document.createElement('b'); b.textContent = m.name;
      const sp = document.createElement('span'); sp.textContent = m.desc;
      info.appendChild(b); info.appendChild(sp);
      card.appendChild(info);
      card.addEventListener('click', function () {
        G.mapIndex = i;
        Array.prototype.forEach.call(list.children, function (c, j) { c.classList.toggle('selected', i === j); });
      });
      list.appendChild(card);
    });
    try {
      const u = localStorage.getItem('strikezone_user');
      if (u) $('username').value = u;
      const q = localStorage.getItem('strikezone_quality');
      if (q && QUALITY[q]) $('quality').value = q;
      const se = localStorage.getItem('strikezone_sens');
      if (se) $('sens').value = se;
      const ch = localStorage.getItem('strikezone_char');
      if (ch != null && CHARACTERS[parseInt(ch, 10)]) {
        G.charIndex = parseInt(ch, 10);
        Array.prototype.forEach.call(chars.children, function (c, j) { c.classList.toggle('selected', j === G.charIndex); });
      }
    } catch (e) { /* ignore */ }
    loadSettings();
    applySettings();
    $('username').addEventListener('input', renderBoard);
    renderBoard();
  }

  /* ------------------------------------------------------------
     weapons: slots, equip, ammo
  ------------------------------------------------------------ */
  function curId() { return G.slots[G.cur]; }
  function curWeapon() { return WEAPONS[G.slots[G.cur]]; }
  function curAmmo() { return G.ammo[G.slots[G.cur]]; }

  function slotKind(w) {
    if (w.type === 'gun') return 'gun';
    if (w.type === 'pistol' || w.type === 'knife') return 'side';
    return 'melee';
  }
  function defaultSlot(w) {
    const k = slotKind(w);
    if (k === 'side') return 2;
    if (k === 'melee') return 3;
    if (!G.slots[0]) return 0;
    if (!G.slots[1]) return 1;
    return G.cur === 1 ? 1 : 0;
  }
  function equipWeapon(id, slot) {
    const w = WEAPONS[id];
    if (slot == null) slot = defaultSlot(w);
    const other = G.slots.indexOf(id);
    if (other >= 0 && other !== slot) G.slots[other] = G.slots[slot];  // swap places
    G.slots[slot] = id;
    if (!G.ammo[id]) G.ammo[id] = { mag: w.mag || 0, reserve: w.reserve || 0 };
    if (!G.slots[G.cur]) G.cur = slot;
    if (G.cur === slot || other === G.cur) {
      G.reloading = 0;
      rebuildHeld();
    }
    updateHUD(true);
  }
  function switchTo(i) {
    if (i < 0 || i > 3 || !G.slots[i] || i === G.cur) return;
    G.lastSlot = G.cur;
    G.cur = i;
    G.reloading = 0; G.autoReload = 0;
    G.switching = SWITCH_TIME;
    G.nextFire = Math.max(G.nextFire, G.time + SWITCH_TIME);
    G.meleeSwing = 0;
    Sound.switchWeapon();
    rebuildHeld();
    updateHUD(true);
  }
  function cycleSlot(dir) {
    let i = G.cur;
    for (let n = 0; n < 4; n++) {
      i = (i + dir + 4) % 4;
      if (G.slots[i]) { switchTo(i); return; }
    }
  }
  function reload() {
    const w = curWeapon();
    if (!w || (w.type !== 'gun' && w.type !== 'pistol')) return;
    const a = curAmmo();
    if (G.reloading > 0 || G.switching > 0 || a.mag >= w.mag || a.reserve <= 0) return;
    G.reloading = w.reload;
    G.reloadTotal = w.reload;
    G.autoReload = 0;
    Sound.reload(w.reload);
  }
  function finishReload() {
    const w = curWeapon(), a = curAmmo();
    const take = Math.min(w.mag - a.mag, a.reserve);
    a.mag += take; a.reserve -= take;
    updateHUD(true);
  }

  /* ------------------------------------------------------------
     humanoid builder (used for the player model and for enemies)
  ------------------------------------------------------------ */
  const CAMO_CACHE = {};
  function camoTex(c1, c2, c3) {
    const key = c1 + '_' + c2 + '_' + c3;
    if (CAMO_CACHE[key]) return CAMO_CACHE[key];
    const t = canvasTexture(128, function (ctx, sz) {
      ctx.fillStyle = cssHex(c1); ctx.fillRect(0, 0, sz, sz);
      const cols = [c2, c3];
      for (let i = 0; i < 46; i++) {
        ctx.fillStyle = cssHex(cols[i % 2]);
        ctx.beginPath();
        ctx.ellipse(Math.random() * sz, Math.random() * sz, 6 + Math.random() * 14, 4 + Math.random() * 9, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1, 1);
    CAMO_CACHE[key] = t;
    return t;
  }

  function buildHumanoid(o) {
    const g = new THREE.Group();
    const parts = [], mats = [];
    function M(c, r, m, map) {
      const mt = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : c, map: map || null, roughness: r == null ? 0.85 : r, metalness: m || 0 });
      mats.push(mt);
      return mt;
    }
    const camo = o.camo ? camoTex(o.camo[0], o.camo[1], o.camo[2]) : null;
    const shirt = M(o.shirt, 0.9, 0, camo), pants = M(o.pants, 0.9, 0, camo), vest = M(o.vest, 0.95), skin = M(o.skin, 0.6);
    const boots = M(0x141414, 0.7), helmM = M(o.helmet, 0.55, 0.15), glass = M(0x050505, 0.1, 0.6);
    const cloth = M(o.maskColor || 0x151515, 0.95), glove = M(o.glove == null ? 0x1a1a1a : o.glove, 0.8), strap = M(0x111111, 0.9);
    function add(geo, mat, x, y, z, parent, part) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.userData.part = part;
      parent.add(m);
      parts.push(m);
      return m;
    }
    const B = function (x, y, z) { return new THREE.BoxGeometry(x, y, z); };
    const C = function (rt, rb, h) { return new THREE.CylinderGeometry(rt, rb, h, 10); };

    // legs: tapered trousers, cargo pocket, knee pad, boot with shaft
    const legL = new THREE.Group(); legL.position.set(-0.14, 0.92, 0); g.add(legL);
    const legR = new THREE.Group(); legR.position.set(0.14, 0.92, 0); g.add(legR);
    [legL, legR].forEach(function (l, i) {
      const sd = i === 0 ? -1 : 1;
      add(C(0.105, 0.075, 0.9), pants, 0, -0.45, 0, l, 'limb');
      add(B(0.05, 0.18, 0.11), pants, 0.1 * sd, -0.3, 0, l, 'limb');
      add(B(0.14, 0.15, 0.09), vest, 0, -0.44, -0.08, l, 'limb');
      add(C(0.085, 0.09, 0.2), boots, 0, -0.78, 0, l, 'limb');
      add(B(0.17, 0.1, 0.3), boots, 0, -0.86, -0.06, l, 'limb');
    });

    // torso: shirt, belt with pouches, plate-carrier vest, mag pouches, optional backpack
    const torso = new THREE.Group(); torso.position.y = 0.92; g.add(torso);
    add(B(0.46, 0.2, 0.27), pants, 0, 0.1, 0, torso, 'body');
    add(B(0.49, 0.06, 0.3), strap, 0, 0.21, 0, torso, 'body');
    add(B(0.09, 0.1, 0.07), strap, -0.17, 0.17, -0.17, torso, 'body');
    add(B(0.09, 0.1, 0.07), strap, 0.17, 0.17, -0.17, torso, 'body');
    add(B(0.5, 0.52, 0.28), shirt, 0, 0.45, 0, torso, 'body');
    add(B(0.55, 0.42, 0.34), vest, 0, 0.47, 0, torso, 'body');
    add(B(0.3, 0.28, 0.06), strap, 0, 0.5, -0.19, torso, 'body');
    [-0.12, 0, 0.12].forEach(function (x) { add(B(0.07, 0.1, 0.05), strap, x, 0.3, -0.2, torso, 'body'); });
    if (o.pack) {
      add(B(0.36, 0.42, 0.18), vest, 0, 0.45, 0.26, torso, 'body');
      add(C(0.07, 0.07, 0.34), strap, 0, 0.72, 0.26, torso, 'body').rotation.z = Math.PI / 2;
    } else {
      add(B(0.3, 0.3, 0.06), strap, 0, 0.5, 0.19, torso, 'body');
    }
    add(B(0.09, 0.05, 0.34), vest, -0.17, 0.69, 0, torso, 'body');
    add(B(0.09, 0.05, 0.34), vest, 0.17, 0.69, 0, torso, 'body');
    add(new THREE.SphereGeometry(0.09, 10, 8), vest, -0.31, 0.65, 0, torso, 'body');
    add(new THREE.SphereGeometry(0.09, 10, 8), vest, 0.31, 0.65, 0, torso, 'body');
    add(C(0.06, 0.07, 0.12), skin, 0, 0.74, 0, torso, 'body');

    // head with hat, optional mask and goggles
    const head = new THREE.Group(); head.position.set(0, 0.9, 0); torso.add(head);
    add(new THREE.SphereGeometry(0.125, 16, 12), skin, 0, 0, 0, head, 'head');
    let helmet;
    if (o.hat === 'cap') {
      helmet = add(new THREE.SphereGeometry(0.138, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), helmM, 0, 0.025, 0, head, 'head');
      add(B(0.2, 0.02, 0.13), helmM, 0, 0.035, -0.14, head, 'head');
    } else if (o.hat === 'beanie') {
      helmet = add(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cloth, 0, 0.02, 0, head, 'head');
    } else {
      helmet = add(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), helmM, 0, 0.02, 0, head, 'head');
      add(C(0.165, 0.165, 0.02), helmM, 0, 0.06, 0, head, 'head');
      add(B(0.07, 0.05, 0.05), strap, 0, 0.1, -0.14, head, 'head');
    }
    if (o.mask) add(B(0.2, 0.1, 0.21), cloth, 0, -0.06, -0.005, head, 'head');
    if (o.goggles !== false) {
      add(B(0.23, 0.05, 0.06), glass, 0, 0.02, -0.115, head, 'head');
      add(B(0.27, 0.035, 0.27), strap, 0, 0.02, 0, head, 'head');
    }

    // arms: tapered sleeves with gloves
    const armR = new THREE.Group(); armR.position.set(0.34, 0.62, 0); torso.add(armR);
    const armL = new THREE.Group(); armL.position.set(-0.34, 0.62, 0); torso.add(armL);
    [armR, armL].forEach(function (a) {
      add(C(0.075, 0.062, 0.6), shirt, 0, -0.28, 0, a, 'limb');
      add(C(0.07, 0.07, 0.07), strap, 0, -0.5, 0, a, 'limb');
      add(B(0.1, 0.11, 0.12), glove, 0, -0.63, 0, a, 'limb');
    });
    // holder: counter-rotates the arm so the weapon stays aligned with the body
    const holder = new THREE.Group();
    holder.rotation.order = 'ZYX';
    holder.position.set(0, -0.6, 0);
    armR.add(holder);

    armR.rotation.set(1.3, 0, -0.4);
    armL.rotation.set(1.35, 0, 0.65);
    holder.rotation.set(-1.3, 0, 0.4);

    return { group: g, parts: parts, mats: mats, legL: legL, legR: legR, torso: torso, head: head,
             helmet: helmet, armR: armR, armL: armL, holder: holder, walkT: 0 };
  }

  const CAMO_SETS = {
    dust:   [0xb59a6a, 0x8a7348, 0x6b5a3c],
    jungle: [0x4b5a3a, 0x2f3b2c, 0x6b5a3c],
    yard:   [0x70757a, 0x4a4e52, 0x2c2f33],
    snow:   [0xdfe6ee, 0xaab6c4, 0x7a8794]
  };
  function randomOutfit() {
    const id = MAPS[G.mapIndex].id;
    return {
      shirt: pick([0x4b5a3a, 0x5e5a46, 0x3d4a52, 0x6b5a3c, 0x2f3b2c, 0x554a3a]),
      pants: pick([0x3a3f33, 0x454035, 0x2b2f36, 0x4a4636]),
      vest: pick([0x2a2e24, 0x3d3a2c, 0x1d2228, 0x5a4d38, 0x333a30]),
      helmet: pick([0x2f3a2a, 0x3b3b30, 0x232a30, 0x5a5340]),
      skin: pick([0xd9a679, 0xb98259, 0x8d5a3b, 0xf0c8a0, 0x6b4228]),
      camo: Math.random() < 0.65 ? CAMO_SETS[id] : null,
      hat: pick(['helmet', 'helmet', 'cap', 'beanie']),
      mask: Math.random() < 0.45, goggles: Math.random() < 0.5, pack: Math.random() < 0.6,
      glove: pick([0x1a1a1a, 0x2b2b2b, 0x3a3426]), maskColor: pick([0x151515, 0x2b2b2b, 0x3a4630])
    };
  }

  /* player's own body (visible in 3rd person) */
  let player = null;
  let viewRoot = null, viewModel = null, viewArms = null;
  let tppWeapon = null;
  let flashLight = null;

  function buildViewArms() {
    const g = new THREE.Group();
    const op = CHARACTERS[G.charIndex] || CHARACTERS[0];
    const sleeve = new THREE.MeshStandardMaterial({ color: op.outfit.shirt, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 });   // gloves
    function bx(sx, sy, sz, x, y, z, m, rx, ry) {
      const me = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      me.position.set(x, y, z);
      if (rx) me.rotation.x = rx;
      if (ry) me.rotation.y = ry;
      g.add(me);
      return me;
    }
    bx(0.075, 0.075, 0.5, 0.025, -0.14, 0.3, sleeve, -0.25);       // right forearm
    bx(0.085, 0.085, 0.04, 0.02, -0.105, 0.1, new THREE.MeshStandardMaterial({ color: 0x111111 }), -0.25); // cuff
    bx(0.07, 0.075, 0.12, 0.012, -0.075, 0.08, skin);               // right hand
    const l1 = bx(0.07, 0.07, 0.5, -0.1, -0.15, -0.05, sleeve, 0.1, -0.15);
    const l2 = bx(0.07, 0.07, 0.11, -0.05, -0.07, -0.38, skin);
    g.userData.left = [l1, l2];
    return g;
  }

  function rebuildHeld() {
    const id = curId();
    if (!id || !viewRoot) return;
    if (viewModel) viewRoot.remove(viewModel);
    viewModel = makeWeaponModel(id);
    viewRoot.add(viewModel);
    const w = WEAPONS[id];
    const showLeft = w.type === 'gun';
    viewArms.userData.left.forEach(function (m) { m.visible = showLeft; });

    // third-person copy in the player's hand
    while (player.holder.children.length) player.holder.remove(player.holder.children[0]);
    tppWeapon = makeWeaponModel(id);
    const gunLike = w.type === 'gun' || w.type === 'pistol';
    if (gunLike) tppWeapon.position.set(0, 0.09, -0.1);
    player.holder.add(tppWeapon);
  }

  /* ------------------------------------------------------------
     collisions
  ------------------------------------------------------------ */
  function groundAt(x, z, y) {
    let g = 0;
    const bs = world.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.maxY <= y + 0.5 && b.maxY > g && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) g = b.maxY;
    }
    return g;
  }
  function resolve(pos, radius, height) {
    const bs = world.boxes;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (pos.y + height <= b.minY || pos.y + 0.5 >= b.maxY) continue;
        const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = radius - d;
            pos.x += dx / d * push; pos.z += dz / d * push;
          } else {
            const l = pos.x - b.minX, r = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z;
            const m = Math.min(l, r, t, bt);
            if (m === l) pos.x = b.minX - radius;
            else if (m === r) pos.x = b.maxX + radius;
            else if (m === t) pos.z = b.minZ - radius;
            else pos.z = b.maxZ + radius;
          }
        }
      }
    }
    const lim = world.half - 0.8;
    pos.x = clamp(pos.x, -lim, lim);
    pos.z = clamp(pos.z, -lim, lim);
  }
  function blockedAt(x, z, r) {
    const bs = world.boxes;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.maxY <= 0.5 || b.minY >= 1.8) continue;
      const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------
     start / stop game
  ------------------------------------------------------------ */
  function disposeScene(s) {
    if (!s) return;
    s.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  const SHARED = {};
  function initShared() {
    SHARED.box = new THREE.BoxGeometry(1, 1, 1);
    SHARED.blood = [0x8a0303, 0x600000, 0xb00505].map(function (c) { return new THREE.MeshBasicMaterial({ color: c }); });
    SHARED.spark = new THREE.MeshBasicMaterial({ color: 0xffd36a });
    SHARED.tracer = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 });
    SHARED.enemyTracer = new THREE.MeshBasicMaterial({ color: 0xff7a5a, transparent: true, opacity: 0.8 });
    SHARED.hole = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    SHARED.holeGeo = new THREE.CircleGeometry(0.05, 8);
    SHARED.bloodDecal = new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    SHARED.bloodDecalGeo = new THREE.CircleGeometry(0.5, 10);
    SHARED.hsSpark = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    SHARED.hsTracer = new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.95 });
  }

  function startGame() {
    Sound.init();
    const name = ($('username').value || '').trim().slice(0, 16) || 'Player';
    G.username = name;
    G.quality = $('quality').value;
    G.sens = parseFloat($('sens').value) || G.sens || 1;
    try {
      localStorage.setItem('strikezone_user', name);
      localStorage.setItem('strikezone_quality', G.quality);
      localStorage.setItem('strikezone_sens', String(G.sens));
    } catch (e) { /* ignore */ }

    const Q = QUALITY[G.quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = Q.shadows;

    if (scene) { disposeScene(scene); }
    scene = new THREE.Scene();
    if (!SHARED.box) initShared();
    world = buildMap(scene, MAPS[G.mapIndex], Q);
    G.world = world;
    scene.add(camera);

    // reset state
    G.time = 0; G.kills = 0; G.headshots = 0; G.coins = 500;
    G.hp = G.maxHp; G.pos.set(0, 0, 8); G.velY = 0; G.onGround = true;
    G.yaw = 0; G.pitch = 0; G.pov = 0; G.ads = 0; G.adsHeld = false; G.fireHeld = false; G.firePressed = false;
    G.slots = [null, null, null, null]; G.cur = 0; G.lastSlot = 0; G.owned = {}; G.ammo = {};
    G.reloading = 0; G.switching = 0; G.nextFire = 0; G.kick = 0; G.recoilSpread = 0; G.flashT = 0;
    G.meleeSwing = 0; G.meleeDone = true; G.autoReload = 0;
    G.enemies = []; G.spawnTimer = 0; G.particles = []; G.tracers = []; G.decals = []; G.debris = [];
    G.dmgFlash = 0; G.dmgDirT = 0; G.hitT = 0; G.headT = 0; G.healing = false; G.healTick = 0;
    G.moveAmt = 0; G.bob = 0; G.stepDist = 0;
    G.vx = 0; G.vz = 0; G.crouch = 0; G.sprint = 0; G.roll = 0; G.landDip = 0;
    G.dummies = []; G.inTrain = false; G.wasTrain = false; G.trainHintT = 0;
    camera.fov = BASE_FOV; camera.updateProjectionMatrix();

    // first-person weapon holder (a child of the camera)
    viewRoot = new THREE.Group();
    viewArms = buildViewArms();
    viewRoot.add(viewArms);
    camera.add(viewRoot);

    // player body for third person
    const op = CHARACTERS[G.charIndex] || CHARACTERS[0];
    player = buildHumanoid(op.outfit);
    player.group.visible = false;
    scene.add(player.group);

    flashLight = new THREE.PointLight(0xffb060, 0, 14, 2);
    scene.add(flashLight);

    // starting weapons
    ['ak47', 'glock', 'bat'].forEach(function (id) { G.owned[id] = true; });
    equipWeapon('ak47', 0);
    equipWeapon('glock', 2);
    equipWeapon('bat', 3);
    G.cur = 0;
    rebuildHeld();

    const n0 = G.quality === 'low' ? 6 : 8;
    for (let i = 0; i < n0; i++) spawnEnemy(true);
    buildDummies();

    // HUD
    applySettings();
    setText(HUD.user, G.username.toUpperCase() + '  ·  ' + (CHARACTERS[G.charIndex] || CHARACTERS[0]).name);
    setText(HUD.map, MAPS[G.mapIndex].name);
    setText(HUD.pov, 'POV: ' + POVS[0].name + '  [V]');
    $('menu').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('gameover').classList.add('hidden');
    $('store').classList.add('hidden');
    HUD.root.classList.remove('hidden');
    HUD.killfeed.innerHTML = '';
    updateHUD(true);

    G.state = 'playing';
    Sound.ambient(MAPS[G.mapIndex].ambient);
    canvas.requestPointerLock();
  }

  function quitToMenu() {
    G.state = 'menu';
    Sound.stopAmbient();
    if (document.exitPointerLock) document.exitPointerLock();
    HUD.root.classList.add('hidden');
    $('pause').classList.add('hidden');
    $('gameover').classList.add('hidden');
    $('store').classList.add('hidden');
    $('menu').classList.remove('hidden');
    renderBoard();
  }

  function pauseGame() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    G.fireHeld = false; G.adsHeld = false;
    applySettings();
    $('pause').classList.remove('hidden');
  }
  function resumeGame() {
    $('pause').classList.add('hidden');
    G.state = 'playing';
    canvas.requestPointerLock();
  }

  function die() {
    G.state = 'dead';
    G.fireHeld = false; G.adsHeld = false;
    Sound.death();
    Sound.stopAmbient();
    if (document.exitPointerLock) document.exitPointerLock();
    const rec = myRecord();
    const el = $('go-stats');
    el.innerHTML = '';
    function line(label, val) {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;justify-content:space-between;padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.12);font-size:15px;';
      const a = document.createElement('span'); a.textContent = label; a.style.color = '#8a97a3';
      const b = document.createElement('b'); b.textContent = val;
      d.appendChild(a); d.appendChild(b);
      el.appendChild(d);
    }
    line('Player', G.username);
    line('Kills this run', G.kills);
    line('Headshots', G.headshots);
    line('Best run (highest kills)', rec.best);
    line('All-time kills', rec.total);
    el.style.marginBottom = '16px';
    setTimeout(function () { if (G.state === 'dead') $('gameover').classList.remove('hidden'); }, 900);
  }

  /* ------------------------------------------------------------
     store
  ------------------------------------------------------------ */
  let storeTab = 'guns';
  const TAB_FILTER = {
    guns: function (w) { return w.type === 'gun'; },
    side: function (w) { return w.type === 'pistol' || w.type === 'knife'; },
    melee: function (w) { return w.type === 'melee'; }
  };

  function nearVending() {
    if (!world) return false;
    for (let i = 0; i < world.vending.length; i++) {
      const v = world.vending[i];
      if (Math.hypot(G.pos.x - v.x, G.pos.z - v.z) < 3.6) return true;
    }
    return false;
  }
  function openStore() {
    if (G.state !== 'playing') return;
    G.state = 'store';
    G.fireHeld = false; G.adsHeld = false;
    if (document.exitPointerLock) document.exitPointerLock();
    $('store').classList.remove('hidden');
    renderStore();
  }
  function closeStore(relock) {
    if (G.state !== 'store') return;
    $('store').classList.add('hidden');
    if (relock) {
      G.state = 'playing';
      canvas.requestPointerLock();
    } else {
      G.state = 'playing';
      pauseGame();
    }
  }

  function statBar(label, frac) {
    const d = document.createElement('div');
    d.className = 'stat-line';
    const s = document.createElement('span'); s.textContent = label;
    const bar = document.createElement('div'); bar.className = 'bar';
    const i = document.createElement('i'); i.style.width = Math.round(clamp(frac, 0.04, 1) * 100) + '%';
    bar.appendChild(i);
    d.appendChild(s); d.appendChild(bar);
    return d;
  }
  function mkBtn(text, cls, fn, disabled) {
    const b = document.createElement('button');
    b.className = 'btn small ' + (cls || '');
    b.textContent = text;
    if (disabled) b.disabled = true;
    b.addEventListener('click', fn);
    return b;
  }

  function renderStore() {
    setText($('store-coins'), G.coins);
    Array.prototype.forEach.call(document.querySelectorAll('#store-tabs .tab'), function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === storeTab);
    });
    const grid = $('store-grid');
    grid.innerHTML = '';

    if (storeTab === 'supplies') {
      const items = [
        { name: 'Medkit', cat: 'Supply', desc: 'Restores 50 health instantly.', price: 150,
          can: function () { return G.hp < G.maxHp; }, buy: function () { G.hp = Math.min(G.maxHp, G.hp + 50); } },
        { name: 'Ammo Crate', cat: 'Supply', desc: 'Refills reserve ammo for all your guns.', price: 200,
          can: function () { return true; }, buy: function () {
            G.slots.forEach(function (id) {
              if (id && G.ammo[id] && (WEAPONS[id].type === 'gun' || WEAPONS[id].type === 'pistol')) G.ammo[id].reserve = WEAPONS[id].reserve;
            });
          } }
      ];
      items.forEach(function (it) {
        const c = document.createElement('div');
        c.className = 'item';
        const n = document.createElement('div'); n.className = 'name'; n.textContent = it.name;
        const ct = document.createElement('div'); ct.className = 'cat'; ct.textContent = it.cat;
        const ds = document.createElement('div'); ds.style.cssText = 'font-size:12px;color:#aab5be'; ds.textContent = it.desc;
        const pr = document.createElement('div'); pr.className = 'price'; pr.textContent = it.price + ' coins';
        const btns = document.createElement('div'); btns.className = 'btns';
        btns.appendChild(mkBtn('BUY', '', function () {
          if (G.coins < it.price || !it.can()) { Sound.deny(); return; }
          G.coins -= it.price; it.buy(); Sound.buy(); updateHUD(true); renderStore();
        }, G.coins < it.price || !it.can()));
        c.appendChild(n); c.appendChild(ct); c.appendChild(ds); c.appendChild(pr); c.appendChild(btns);
        grid.appendChild(c);
      });
      return;
    }

    const ids = Object.keys(WEAPONS).filter(function (id) { return TAB_FILTER[storeTab](WEAPONS[id]); })
      .sort(function (a, b) { return WEAPONS[a].price - WEAPONS[b].price; });
    ids.forEach(function (id) {
      const w = WEAPONS[id];
      const slotIdx = G.slots.indexOf(id);
      const owned = !!G.owned[id];
      const c = document.createElement('div');
      c.className = 'item' + (slotIdx >= 0 ? ' equipped' : '');
      const n = document.createElement('div'); n.className = 'name'; n.textContent = w.name;
      const ct = document.createElement('div'); ct.className = 'cat'; ct.textContent = w.cat;
      c.appendChild(n); c.appendChild(ct);
      if (w.type === 'gun' || w.type === 'pistol') {
        c.appendChild(statBar('Damage', (w.dmg * w.pellets) / 140));
        c.appendChild(statBar('Fire rate', w.rpm / 1100));
        c.appendChild(statBar('Magazine', w.mag / 100));
      } else {
        c.appendChild(statBar('Damage', w.dmg / 110));
        c.appendChild(statBar('Speed', 1 / (w.cooldown + 0.3)));
        c.appendChild(statBar('Reach', w.range / 3.2));
      }
      const pr = document.createElement('div');
      pr.className = 'price';
      pr.textContent = owned ? (slotIdx >= 0 ? 'EQUIPPED - slot ' + (slotIdx + 1) : 'OWNED') : (w.price === 0 ? 'FREE' : w.price + ' coins');
      c.appendChild(pr);

      const btns = document.createElement('div'); btns.className = 'btns';
      const canBuy = owned || G.coins >= w.price;
      if (w.type === 'gun') {
        [0, 1].forEach(function (s) {
          const label = (owned ? 'EQUIP' : 'BUY') + ' > SLOT ' + (s + 1);
          btns.appendChild(mkBtn(label, '', function () { buyOrEquip(id, s); }, !canBuy || slotIdx === s));
        });
      } else {
        const s = slotKind(w) === 'side' ? 2 : 3;
        btns.appendChild(mkBtn((owned ? 'EQUIP' : 'BUY') + ' > SLOT ' + (s + 1), '', function () { buyOrEquip(id, s); }, !canBuy || slotIdx === s));
      }
      c.appendChild(btns);
      grid.appendChild(c);
    });
  }

  function buyOrEquip(id, slot) {
    const w = WEAPONS[id];
    if (!G.owned[id]) {
      if (G.coins < w.price) { Sound.deny(); return; }
      G.coins -= w.price;
      G.owned[id] = true;
      Sound.buy();
    } else {
      Sound.switchWeapon();
    }
    equipWeapon(id, slot);
    renderStore();
  }

  /* ------------------------------------------------------------
     effects: particles, tracers, decals
  ------------------------------------------------------------ */
  function addParticle(mat, size, pos, vel, life, grav, stick) {
    if (!SETTINGS.vfx) return;
    const m = new THREE.Mesh(SHARED.box, mat);
    m.scale.set(size, size, size);
    m.position.copy(pos);
    scene.add(m);
    G.particles.push({ mesh: m, vel: vel, life: life, max: life, grav: grav, size: size, stick: stick });
    if (G.particles.length > 380) {
      const old = G.particles.shift();
      scene.remove(old.mesh);
    }
  }
  function bloodSpray(point, dir, count, big) {
    for (let i = 0; i < count; i++) {
      const v = new V3(rand(-1, 1), rand(-0.2, 1.3), rand(-1, 1)).multiplyScalar(big ? 2.4 : 1.6);
      v.addScaledVector(dir, rand(1, big ? 5 : 3.5));
      addParticle(pick(SHARED.blood), rand(0.02, big ? 0.07 : 0.05), point, v, rand(0.5, 1.1), 14, true);
    }
  }
  function addDecal(geo, mat, point, normal, scale, maxCount, life) {
    if (!SETTINGS.vfx) return;
    const d = new THREE.Mesh(geo, mat);
    d.position.copy(point).addScaledVector(normal, 0.012);
    d.lookAt(_t1.copy(point).add(normal));
    if (scale !== 1) d.scale.set(scale, scale, scale);
    scene.add(d);
    G.decals.push({ mesh: d, life: life });
    if (G.decals.length > maxCount) {
      const old = G.decals.shift();
      scene.remove(old.mesh);
    }
  }
  const _t1 = new V3(), _t2 = new V3(), _t3 = new V3(), _t4 = new V3();

  function impactEffect(hit) {
    if (!SETTINGS.vfx) return;
    const n = hit.face ? _t2.copy(hit.face.normal).transformDirection(hit.object.matrixWorld) : _t2.set(0, 1, 0);
    const normal = n.clone();
    const isGround = hit.object.userData.ground;
    for (let i = 0; i < 5; i++) {
      const v = new V3(rand(-1, 1), rand(0.3, 1.5), rand(-1, 1)).multiplyScalar(2).addScaledVector(normal, 2);
      addParticle(SHARED.spark, 0.025, hit.point, v, rand(0.15, 0.35), 12, false);
    }
    if (!world._dustMat) world._dustMat = new THREE.MeshBasicMaterial({ color: world.def.dust });
    for (let i = 0; i < 4; i++) {
      const v = new V3(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5)).addScaledVector(normal, 0.8);
      addParticle(world._dustMat, rand(0.05, 0.1), hit.point, v, rand(0.3, 0.7), -0.2, false);
    }
    if (!isGround) addDecal(SHARED.holeGeo, SHARED.hole, hit.point, normal, rand(0.8, 1.3), 70, 25);
  }
  function addTracer(from, to, mat, life) {
    if (!SETTINGS.vfx) return;
    const len = from.distanceTo(to);
    if (len < 0.3) return;
    const m = new THREE.Mesh(SHARED.box, mat);
    m.scale.set(0.014, 0.014, len);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    scene.add(m);
    G.tracers.push({ mesh: m, life: life });
  }

  function updateEffects(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); G.particles.splice(i, 1); continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.03) {
        p.mesh.position.y = 0.03;
        if (p.stick) { p.vel.set(0, 0, 0); } else { p.vel.y = Math.abs(p.vel.y) * 0.3; }
      }
      const s = p.size * clamp(p.life / p.max * 1.6, 0, 1);
      p.mesh.scale.set(s, s, s);
    }
    for (let i = G.tracers.length - 1; i >= 0; i--) {
      const t = G.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { scene.remove(t.mesh); G.tracers.splice(i, 1); }
    }
    for (let i = G.decals.length - 1; i >= 0; i--) {
      const d = G.decals[i];
      d.life -= dt;
      if (d.life <= 0) { scene.remove(d.mesh); G.decals.splice(i, 1); }
    }
    for (let i = G.debris.length - 1; i >= 0; i--) {
      const d = G.debris[i];
      d.life -= dt;
      if (d.life <= 0) { scene.remove(d.mesh); G.debris.splice(i, 1); continue; }
      if (d.mesh.position.y > 0.1) {
        d.vel.y -= 16 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += d.ang.x * dt; d.mesh.rotation.z += d.ang.z * dt;
      } else { d.mesh.position.y = 0.08; }
    }
    if (G.flashT > 0) G.flashT -= dt;
    flashLight.intensity = G.flashT > 0 ? 2.6 : 0;
  }

  /* ------------------------------------------------------------
     player damage
  ------------------------------------------------------------ */
  function damagePlayer(dmg, fromPos) {
    if (G.state !== 'playing') return;
    G.hp -= dmg;
    G.dmgFlash = 1;
    Sound.hurt();
    if (fromPos) {
      const dx = fromPos.x - G.pos.x, dz = fromPos.z - G.pos.z;
      const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
      const rx = Math.cos(G.yaw), rz = -Math.sin(G.yaw);
      const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      HUD.dmgDir.style.transform = 'rotate(' + ang + 'rad)';
      G.dmgDirT = 1.2;
    }
    if (G.hp <= 0) { G.hp = 0; die(); }
  }

  /* ------------------------------------------------------------
     enemies
  ------------------------------------------------------------ */
  function findSpawn() {
    for (let i = 0; i < 50; i++) {
      const x = rand(-world.half + 6, world.half - 6), z = rand(-world.half + 6, world.half - 6);
      if (Math.hypot(x - G.pos.x, z - G.pos.z) < 32) continue;
      if (blockedAt(x, z, 0.8)) continue;
      if (inTrainingZone(x, z, 4)) continue;
      return new V3(x, 0, z);
    }
    return null;
  }

  function spawnEnemy(initial) {
    const p = findSpawn();
    if (!p) return;
    const h = buildHumanoid(randomOutfit());
    h.group.position.copy(p);
    h.group.rotation.y = rand(0, Math.PI * 2);
    scene.add(h.group);
    const gunId = pick(['ak47', 'm4a1', 'mp5', 'scar']);
    const gun = makeWeaponModel(gunId);
    gun.position.set(0, 0.09, -0.1);
    h.holder.add(gun);
    h.armR.rotation.set(1.3, 0, -0.4);

    const e = {
      h: h, group: h.group, parts: h.parts, gun: gun, gunId: gunId,
      hp: 100, dead: false, deadT: 0, yaw: h.group.rotation.y,
      name: pick(ENEMY_NAMES) + '-' + Math.floor(rand(10, 99)),
      speed: rand(3.0, 4.2), state: 'wander', alerted: false, canSee: false, losT: rand(0, 0.3), lostT: 0,
      target: new V3(p.x, 0, p.z), idleT: rand(0.5, 2.5), shootCd: rand(1.2, 2.4),
      strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(1, 3), range: rand(12, 22),
      detourT: 0, detourDir: 1, lastPos: new V3(p.x, 0, p.z), stuckT: 0, moving: false, vx: 0, vz: 0, tvx: 0, tvz: 0, spd: 0, dodgeT: 0,
      hurtT: 0, recoil: 0, flashT: 0, lastHit: new V3(), fallDir: 1
    };
    h.parts.forEach(function (m) { m.userData.enemy = e; });
    G.enemies.push(e);
  }

  function enemyEye(e, out) { return out.set(e.group.position.x, 1.6, e.group.position.z); }

  function hasLOS(e) {
    enemyEye(e, _t3);
    _t4.set(G.pos.x, G.pos.y + 1.4, G.pos.z);
    const dir = _t4.clone().sub(_t3);
    const dist = dir.length();
    dir.normalize();
    raycaster.set(_t3, dir);
    raycaster.near = 0.1; raycaster.far = dist;
    const hits = raycaster.intersectObjects(world.blockers, false);
    return hits.length === 0 || hits[0].distance > dist - 0.6;
  }

  function inTrainingZone(x, z, pad) {
    const T = world.training;
    return !!T && Math.hypot(x - T.cx, z - T.cz) < T.r + (pad || 0);
  }
  function pushOutTraining(p) {
    const T = world.training;
    if (!T) return;
    const dx = p.x - T.cx, dz = p.z - T.cz, d = Math.hypot(dx, dz);
    if (d < T.r + 1) {
      const k = (T.r + 1) / (d || 0.01);
      p.x = T.cx + dx * k; p.z = T.cz + dz * k;
    }
  }
  function newWanderTarget(e, pos) {
    for (let t = 0; t < 8; t++) {
      const ang = rand(0, Math.PI * 2), r = rand(8, 25);
      const x = clamp(pos.x + Math.cos(ang) * r, -world.half + 5, world.half - 5);
      const z = clamp(pos.z + Math.sin(ang) * r, -world.half + 5, world.half - 5);
      if (!inTrainingZone(x, z, 3)) { e.target.set(x, 0, z); return; }
    }
    e.target.set(pos.x, 0, pos.z);
  }

  // sets the wanted velocity; the real velocity eases toward it in updateEnemy (smooth acceleration)
  function enemyMove(e, dx, dz, speed, dt) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return;
    dx /= len; dz /= len;
    if (e.detourT > 0) { const t = dx; dx = -dz * e.detourDir; dz = t * e.detourDir; }
    e.tvx = dx * speed; e.tvz = dz * speed;
    e.moving = true;
  }

  function enemyShoot(e) {
    const dist = Math.hypot(G.pos.x - e.group.position.x, G.pos.z - e.group.position.z);
    e.recoil = 1; e.flashT = 0.06;
    e.gun.userData.flash.visible = true;
    const muzzle = e.gun.userData.muzzle.clone();
    e.gun.updateWorldMatrix(true, false);
    e.gun.localToWorld(muzzle);
    const vol = clamp(1.1 - dist / 90, 0.12, 1);
    Sound.shot(WEAPONS[e.gunId].sfx, vol * 0.8, clamp(1 - dist / 140, 0.35, 1));
    // chance to hit (low, drops with distance, harder if you are sprinting or jumping)
    let chance = clamp(0.35 - dist * 0.01, 0.06, 0.3);
    if (G.speedNow > 7) chance *= 0.7;
    if (!G.onGround) chance *= 0.6;
    const target = new V3(G.pos.x, G.pos.y + 1.2, G.pos.z);
    const hit = Math.random() < chance;
    if (!hit) target.add(new V3(rand(-1.4, 1.4), rand(-0.8, 0.9), rand(-1.4, 1.4)));
    addTracer(muzzle, target, SHARED.enemyTracer, 0.07);
    if (hit) damagePlayer(Math.round(rand(4, 7)), e.group.position);
  }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function updateEnemy(e, dt) {
    if (e.dead) {
      e.deadT += dt;
      const p = Math.min(1, e.deadT / 0.55);
      e.group.rotation.x = p * 1.5 * e.fallDir;
      e.group.position.y = p * 0.12;
      if (e.deadT > 8) e.group.position.y -= (e.deadT - 8) * 0.3;
      if (e.deadT > 12) { scene.remove(e.group); e.removed = true; }
      return;
    }
    const pos = e.group.position;
    const dx = G.pos.x - pos.x, dz = G.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    e.moving = false;

    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.3;
      e.canSee = dist < 80 && !G.inTrain && hasLOS(e);
      if (e.canSee && dist < 55) { if (!e.alerted) e.shootCd = Math.max(e.shootCd, 1.4); e.alerted = true; }
    }
    if (G.inTrain) { e.alerted = false; e.canSee = false; }   // the training area is a safe zone
    if (e.canSee) e.lostT = 0; else e.lostT += dt;
    if (e.alerted && e.lostT > 12) e.alerted = false;

    // stuck detection -> sidestep
    e.stuckT += dt;
    if (e.stuckT > 0.6) {
      if (Math.hypot(pos.x - e.lastPos.x, pos.z - e.lastPos.z) < 0.25 && e.wasMoving) {
        e.detourT = 1.2; e.detourDir = Math.random() < 0.5 ? 1 : -1;
      }
      e.lastPos.copy(pos);
      e.stuckT = 0;
    }
    if (e.detourT > 0) e.detourT -= dt;

    let faceX = null, faceZ = null;
    if (e.alerted) {
      faceX = dx; faceZ = dz;
      if (e.canSee) {
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = rand(1.5, 3.5); }
        // sudden dodge: a short, faster side-step
        e.dodgeT -= dt;
        if (e.dodgeT <= -1 && Math.random() < dt * 0.35) { e.dodgeT = 0.6; e.strafe = -e.strafe; }
        const sm = e.dodgeT > 0 ? 1.4 : 1;
        if (dist > e.range + 3) enemyMove(e, dx, dz, e.speed * 1.1, dt);
        else if (dist < e.range - 5) enemyMove(e, -dx, -dz, e.speed * 0.85, dt);
        else enemyMove(e, -dz * e.strafe, dx * e.strafe, e.speed * 0.6 * sm, dt);
        // slow, spaced-out shots
        if (dist < 55) {
          e.shootCd -= dt;
          if (e.shootCd <= 0) { enemyShoot(e); e.shootCd = rand(2.2, 3.8); }
        }
      } else {
        enemyMove(e, dx, dz, e.speed * 1.2, dt);   // run to the last place we saw you
      }
    } else {
      const tx = e.target.x - pos.x, tz = e.target.z - pos.z;
      if (e.idleT > 0) {
        e.idleT -= dt;
      } else if (Math.hypot(tx, tz) < 1.2) {
        e.idleT = rand(1, 3.5);
        newWanderTarget(e, pos);
      } else {
        enemyMove(e, tx, tz, e.speed * 0.5, dt);
        faceX = tx; faceZ = tz;
      }
    }
    e.wasMoving = e.moving;

    // velocity eases toward the wanted velocity
    const tvx = e.moving ? e.tvx : 0, tvz = e.moving ? e.tvz : 0;
    const k = Math.min(1, dt * (e.moving ? 6 : 10));
    e.vx += (tvx - e.vx) * k; e.vz += (tvz - e.vz) * k;
    e.spd = Math.hypot(e.vx, e.vz);
    if (e.spd > 0.03) {
      pos.x += e.vx * dt; pos.z += e.vz * dt; pos.y = 0;
      resolve(pos, 0.5, 1.8);
      pushOutTraining(pos);
    }

    // turn smoothly
    if (faceX !== null && (faceX !== 0 || faceZ !== 0)) {
      const want = Math.atan2(-faceX, -faceZ);
      e.yaw += angleDiff(e.yaw, want) * Math.min(1, dt * 8);
    }
    e.group.rotation.y = e.yaw;

    // animation: stride, hip bob, forward lean when running, head scanning when not alerted
    const h = e.h;
    h.walkT += dt * e.spd * 3.0;
    const run = clamp(e.spd / 3.2, 0, 1.4);
    const sw = Math.sin(h.walkT) * 0.7 * Math.min(run, 1);
    h.legL.rotation.x = sw; h.legR.rotation.x = -sw;
    h.torso.position.y = 0.92 + Math.abs(Math.sin(h.walkT)) * 0.035 * run + (run < 0.05 ? Math.sin(G.time * 2 + e.speed) * 0.006 : 0);
    h.torso.rotation.x = -0.1 * run;
    h.torso.rotation.z = Math.sin(h.walkT) * 0.03 * run;
    h.head.rotation.y = e.alerted ? 0 : Math.sin(G.time * 0.7 + e.speed * 3) * 0.45;
    e.recoil = Math.max(0, e.recoil - dt * 8);
    h.armR.rotation.x = 1.3 + e.recoil * 0.12;
    h.holder.rotation.x = -1.3;
    e.gun.position.z = -0.1 + e.recoil * 0.05;
    if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) e.gun.userData.flash.visible = false; }
    if (e.hurtT > 0) {
      e.hurtT -= dt;
      if (e.hurtT <= 0) h.mats.forEach(function (m) { m.emissive.setHex(0x000000); });
    }
  }

  function updateEnemies(dt) {
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      updateEnemy(e, dt);
      if (e.removed) G.enemies.splice(i, 1);
    }
  }

  function updateSpawner(dt) {
    let alive = 0;
    G.enemies.forEach(function (e) { if (!e.dead) alive++; });
    const cap = G.quality === 'low' ? 10 : 16;
    const want = Math.min(8 + Math.floor(G.kills / 2), cap);
    G.spawnTimer -= dt;
    if (alive < want && G.spawnTimer <= 0) {
      spawnEnemy(false);
      G.spawnTimer = 1.4;
    }
  }

  /* ------------------------------------------------------------
     hitting enemies
  ------------------------------------------------------------ */
  function showHit(kind) {
    HUD.hit.className = 'show' + (kind ? ' ' + kind : '');
    G.hitT = 0.14;
  }
  function showHeadshotText(killed) {
    HUD.headText.classList.remove('show');
    HUD.hsFlash.classList.remove('show');
    HUD.hsKill.classList.remove('show');
    void HUD.headText.offsetWidth;
    HUD.headText.classList.add('show');
    if (SETTINGS.vfx) HUD.hsFlash.classList.add('show');
    if (killed) {
      HUD.hsKill.classList.remove('show');
      void HUD.hsKill.offsetWidth;
      HUD.hsKill.classList.add('show');
    }
    setTimeout(function () {
      HUD.headText.classList.remove('show');
      HUD.hsFlash.classList.remove('show');
      HUD.hsKill.classList.remove('show');
    }, 1100);
  }
  function killFeed(text, cls) {
    const d = document.createElement('div');
    d.textContent = text;
    if (cls) d.className = cls;
    HUD.killfeed.appendChild(d);
    while (HUD.killfeed.children.length > 5) HUD.killfeed.removeChild(HUD.killfeed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4500);
  }

  /* ---------- training dummies (no score, respawn after a few seconds) ---------- */
  function buildDummies() {
    G.dummies = [];
    const T = world.training;
    if (!T) return;
    T.spots.forEach(function (sp) {
      const h = buildHumanoid({ shirt: 0xd9731a, pants: 0x333333, vest: 0xeeeeee, helmet: 0xd9731a, skin: 0xbdbdbd, hat: 'helmet', goggles: false, glove: 0x333333 });
      h.armR.rotation.set(0, 0, -0.12); h.armL.rotation.set(0, 0, 0.12);
      h.group.position.set(sp.x, 0, sp.z);
      scene.add(h.group);
      const d = { dummy: true, h: h, group: h.group, parts: h.parts, mats: h.mats, hp: 100, dead: false, deadT: 0, yaw: 0, fallDir: 1, hurtT: 0, spot: sp };
      h.parts.forEach(function (m) { m.userData.enemy = d; });
      G.dummies.push(d);
    });
  }
  function damageDummy(d, dmg, part, point, dir) {
    if (d.dead) return;
    const mult = part === 'head' ? 2.5 : part === 'limb' ? 0.75 : 1;
    const dealt = Math.round(dmg * mult);
    d.hp -= dealt;
    d.hurtT = 0.12;
    d.mats.forEach(function (m) { m.emissive.setHex(0x663300); });
    for (let i = 0; i < 6; i++) {
      const v = new V3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(2).addScaledVector(dir, 1.5);
      addParticle(SHARED.spark, 0.03, point, v, rand(0.15, 0.3), 12, false);
    }
    const head = part === 'head';
    if (head) { Sound.headshot(); showHit('head'); showHeadshotText(false); }
    else { Sound.hitMarker(); Sound.flesh(); showHit(''); }
    killFeed('Training: ' + (head ? 'HEADSHOT ' : part === 'limb' ? 'Limb ' : 'Body ') + dealt + ' dmg', head ? 'hs' : '');
    if (d.hp <= 0) {
      d.dead = true; d.deadT = 0;
      const fwd = _t1.set(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
      d.fallDir = fwd.dot(dir) < 0 ? 1 : -1;
      d.mats.forEach(function (m) { m.emissive.setHex(0x000000); });
      Sound.kill();
      showHit('kill');
    }
  }
  function updateDummies(dt) {
    for (let i = 0; i < G.dummies.length; i++) {
      const d = G.dummies[i], sp = d.spot;
      if (d.dead) {
        d.deadT += dt;
        const p = Math.min(1, d.deadT / 0.5);
        d.group.rotation.x = p * 1.5 * d.fallDir;
        d.group.position.y = p * 0.12;
        if (d.deadT > 2.5) { d.dead = false; d.hp = 100; d.group.rotation.x = 0; d.group.position.y = 0; }
        continue;
      }
      if (sp.move) {
        const x = sp.x + Math.sin(G.time * sp.speed + sp.phase) * sp.amp;
        d.h.walkT += Math.abs(x - d.group.position.x) * 3.2;
        d.group.position.x = x;
        const sw = Math.sin(d.h.walkT) * 0.5;
        d.h.legL.rotation.x = sw; d.h.legR.rotation.x = -sw;
      }
      if (d.hurtT > 0) {
        d.hurtT -= dt;
        if (d.hurtT <= 0) d.mats.forEach(function (m) { m.emissive.setHex(0x000000); });
      }
    }
  }

  function damageEnemy(e, dmg, part, point, dir, tag) {
    if (e.dummy) { damageDummy(e, dmg, part, point, dir); return; }
    if (e.dead) return;
    const mult = part === 'head' ? 2.5 : part === 'limb' ? 0.75 : 1;
    e.hp -= dmg * mult;
    e.alerted = true; e.lostT = 0; e.canSee = true;
    e.hurtT = 0.09;
    e.h.mats.forEach(function (m) { m.emissive.setHex(0x550000); });
    e.lastHit.copy(point);
    const head = part === 'head';
    bloodSpray(point, dir, head ? 36 : 12, head);
    if (head && SETTINGS.vfx) {
      for (let i = 0; i < 10; i++) {
        const v = new V3(rand(-1, 1), rand(0.4, 1.8), rand(-1, 1)).multiplyScalar(3).addScaledVector(dir, 4);
        addParticle(SHARED.hsSpark, rand(0.03, 0.08), point, v, rand(0.2, 0.45), 10, false);
      }
    }
    if (head) { Sound.headshot(); Sound.flesh(); }
    else Sound.flesh();

    if (e.hp <= 0) {
      killEnemy(e, head, point, dir, tag);
    } else {
      if (head) { showHit('head'); showHeadshotText(false); }
      else showHit('');
      if (!head) Sound.hitMarker();
    }
  }

  function killEnemy(e, head, point, dir, tag) {
    e.dead = true; e.deadT = 0;
    // fall away from where the shot came from (relative to facing)
    const fwd = _t1.set(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
    e.fallDir = fwd.dot(dir) < 0 ? 1 : -1;
    e.gun.userData.flash.visible = false;
    e.h.mats.forEach(function (m) { m.emissive.setHex(0x000000); });

    G.kills++;
    if (head) G.headshots++;
    G.coins += head ? 150 : 100;
    recordKill(head);
    // a little ammo drop for every kill
    G.slots.forEach(function (id) {
      if (!id) return;
      const w = WEAPONS[id];
      if ((w.type === 'gun' || w.type === 'pistol') && G.ammo[id]) {
        G.ammo[id].reserve = Math.min(w.reserve * 2, G.ammo[id].reserve + Math.ceil(w.mag * 0.4));
      }
    });
    Sound.kill();
    showHit('kill');
    if (head) showHeadshotText(true);
    killFeed('You eliminated ' + e.name + (tag ? ' [' + tag + ']' : head ? ' [Headshot]' : ''), head || tag ? 'hs' : '');

    // helmet flies off on a headshot kill
    if (head && e.h.helmet && e.h.helmet.parent) {
      const hm = e.h.helmet;
      e.h.parts.splice(e.h.parts.indexOf(hm), 1);
      scene.attach(hm);
      hm.userData.enemy = null;
      G.debris.push({ mesh: hm, vel: new V3(rand(-2, 2), rand(3, 5), rand(-2, 2)).addScaledVector(dir, 3), ang: new V3(rand(-8, 8), 0, rand(-8, 8)), life: 10 });
    }
    // blood pool on the ground
    const gp = new V3(e.group.position.x, 0, e.group.position.z);
    addDecal(SHARED.bloodDecalGeo, SHARED.bloodDecal, gp, new V3(0, 1, 0), rand(0.9, 1.6), 40, 40);
    updateHUD(true);
  }

  function enemyPartList() {
    const list = [];
    for (let i = 0; i < G.enemies.length; i++) {
      const e = G.enemies[i];
      if (e.dead) continue;
      for (let j = 0; j < e.parts.length; j++) list.push(e.parts[j]);
    }
    for (let i = 0; i < G.dummies.length; i++) {
      const d = G.dummies[i];
      if (d.dead) continue;
      for (let j = 0; j < d.parts.length; j++) list.push(d.parts[j]);
    }
    return list;
  }

  /* ------------------------------------------------------------
     firing
  ------------------------------------------------------------ */
  function muzzleWorld(out) {
    const m = G.pov === 0 ? viewModel : tppWeapon;
    if (m && m.userData.muzzle) {
      m.updateWorldMatrix(true, false);
      out.copy(m.userData.muzzle);
      m.localToWorld(out);
    } else camera.getWorldPosition(out);
    return out;
  }

  function currentSpread(w) {
    let s = lerp(w.spread, w.adsSpread, G.ads);
    s *= 1 + G.moveAmt * 0.9;
    s *= 1 - 0.3 * G.crouch;
    if (!G.onGround) s *= 2.5;
    return s + G.recoilSpread;
  }

  function fireGun(w) {
    const a = curAmmo();
    a.mag--;
    G.nextFire = G.time + 60 / w.rpm;
    G.kick = 1; G.flashT = 0.05;
    Sound.shot(w.sfx, 1, 1);
    if (w.pumpSound) Sound.pump();

    const origin = camera.getWorldPosition(_t1.set(0, 0, 0)).clone();
    const muzzle = muzzleWorld(new V3());
    if (flashLight) flashLight.position.copy(muzzle);
    const spread = currentSpread(w);
    const hasScopeBlur = w.scope && G.ads < 0.8;
    for (let p = 0; p < w.pellets; p++) {
      const sp = hasScopeBlur ? spread * 3 : spread;
      const dir = new V3((Math.random() - 0.5) * 2 * sp, (Math.random() - 0.5) * 2 * sp, -1).normalize().applyQuaternion(camera.quaternion);
      shootRay(origin, dir, w, muzzle);
    }
    G.pitch += w.recoil * (0.6 + Math.random() * 0.8) * (1 - G.ads * 0.4);
    G.yaw += (Math.random() - 0.5) * w.recoil * 0.7;
    G.recoilSpread = Math.min(G.recoilSpread + w.recoil * 0.5, 0.05);
    if (a.mag <= 0) G.autoReload = 0.35;
    updateHUD(true);
  }

  function shootRay(origin, dir, w, muzzle) {
    raycaster.set(origin, dir);
    raycaster.near = 0.05;
    raycaster.far = w.range;
    const targets = enemyPartList().concat(world.shootables);
    const hits = raycaster.intersectObjects(targets, false);
    const hit = hits[0];
    const end = hit ? hit.point.clone() : origin.clone().addScaledVector(dir, Math.min(w.range, 150));
    const headHit = hit && hit.object.userData.part === 'head';
    addTracer(muzzle, end, headHit ? SHARED.hsTracer : SHARED.tracer, headHit ? 0.08 : 0.05);
    if (!hit) return;
    const o = hit.object;
    if (o.userData.enemy) {
      const fall = lerp(1, 0.55, clamp(hit.distance / w.range, 0, 1) * (w.pellets > 1 ? 2 : 1));
      damageEnemy(o.userData.enemy, w.dmg * clamp(fall, 0.3, 1), o.userData.part, hit.point, dir);
    } else {
      impactEffect(hit);
    }
  }

  function meleeAttack(w) {
    G.nextFire = G.time + w.cooldown;
    G.meleeDur = Math.min(w.cooldown, w.type === 'knife' ? 0.32 : 0.5);
    G.meleeSwing = G.meleeDur;
    G.meleeDone = false;
    Sound.knife();
  }
  function applyMelee(w) {
    let hitAny = false;
    const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
    const targets = G.enemies.concat(G.dummies);
    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      if (e.dead) continue;
      const dx = e.group.position.x - G.pos.x, dz = e.group.position.z - G.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > w.range + 0.4) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.55) continue;
      const ex = -Math.sin(e.yaw), ez = -Math.cos(e.yaw);
      const behind = (ex * dx + ez * dz) / (d || 1) > 0.5;   // enemy is facing away from you
      let dmg = w.dmg, tag = null;
      if (behind && w.type === 'knife') { dmg *= 2; tag = 'Backstab'; }
      const point = new V3(e.group.position.x, 1.3, e.group.position.z);
      const dir = new V3(dx, 0, dz).normalize();
      damageEnemy(e, dmg, 'body', point, dir, tag);
      if (tag) { showHit('kill'); }
      hitAny = true;
    }
    if (hitAny) Sound.meleeHit();
  }

  function updateWeapons(dt) {
    const w = curWeapon();
    if (!w) return;
    // timers
    if (G.switching > 0) G.switching -= dt;
    if (G.reloading > 0) {
      G.reloading -= dt;
      if (G.reloading <= 0) { G.reloading = 0; finishReload(); }
    }
    G.recoilSpread = Math.max(0, G.recoilSpread - dt * 0.08);
    G.kick = Math.max(0, G.kick - dt * 9);
    if (G.autoReload > 0) {
      G.autoReload -= dt;
      if (G.autoReload <= 0) reload();
    }

    if (w.type === 'knife' || w.type === 'melee') {
      if (G.meleeSwing > 0) {
        G.meleeSwing -= dt;
        const prog = 1 - G.meleeSwing / G.meleeDur;
        if (!G.meleeDone && prog > 0.4) { G.meleeDone = true; applyMelee(w); }
        if (G.meleeSwing < 0) G.meleeSwing = 0;
      }
      if (G.fireHeld && G.time >= G.nextFire && G.switching <= 0 && G.meleeSwing <= 0) meleeAttack(w);
    } else {
      const a = curAmmo();
      const wantFire = w.auto ? G.fireHeld : G.firePressed;
      if (wantFire && G.reloading <= 0 && G.switching <= 0) {
        if (a.mag <= 0) {
          if (G.firePressed) { Sound.empty(); reload(); }
        } else if (G.time >= G.nextFire) {
          fireGun(w);
        }
      }
    }
    G.firePressed = false;

    // ADS
    const canAds = (w.type === 'gun' || w.type === 'pistol') && G.reloading <= 0 && G.switching <= 0;
    const target = G.adsHeld && canAds ? 1 : 0;
    G.ads += (target - G.ads) * Math.min(1, dt * 12);
    if (Math.abs(G.ads - target) < 0.005) G.ads = target;

    // muzzle flashes
    const fl = G.flashT > 0;
    if (viewModel && viewModel.userData.flash) viewModel.userData.flash.visible = fl && G.pov === 0;
    if (tppWeapon && tppWeapon.userData.flash) tppWeapon.userData.flash.visible = fl && G.pov !== 0;
  }

  /* ------------------------------------------------------------
     player movement + camera
  ------------------------------------------------------------ */
  function updatePlayer(dt) {
    const w = curWeapon();
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let wx = -Math.sin(G.yaw) * f + Math.cos(G.yaw) * r;
    let wz = -Math.cos(G.yaw) * f - Math.sin(G.yaw) * r;
    const len = Math.hypot(wx, wz);
    const moving = len > 0.01;
    if (moving) { wx /= len; wz /= len; }

    G.crouch += ((keys.KeyC ? 1 : 0) - G.crouch) * Math.min(1, dt * 10);
    const sprint = !!((keys.ShiftLeft || keys.ShiftRight) && f > 0 && G.ads < 0.3 && G.reloading <= 0 && G.crouch < 0.3);
    let speed = 5.2 * w.speed;
    if (sprint) speed *= 1.6;
    if (G.ads > 0.1) speed *= 1 - 0.4 * G.ads;
    speed *= 1 - 0.45 * G.crouch;

    // smooth acceleration / braking (keeps momentum a little in the air)
    if (G.onGround || moving) {
      const k = Math.min(1, dt * (G.onGround ? (moving ? 10 : 13) : 2.5));
      G.vx += ((moving ? wx * speed : 0) - G.vx) * k;
      G.vz += ((moving ? wz * speed : 0) - G.vz) * k;
    }
    const hv = Math.hypot(G.vx, G.vz);
    G.speedNow = hv;
    if (hv > 0.02) {
      G.pos.x += G.vx * dt;
      resolve(G.pos, PLAYER_R, 1.8);
      G.pos.z += G.vz * dt;
      resolve(G.pos, PLAYER_R, 1.8);
    }
    G.sprint += (((sprint && moving) ? 1 : 0) - G.sprint) * Math.min(1, dt * 8);
    G.roll += ((-r * (sprint ? 1.4 : 1) * 0.014 * (G.onGround ? 1 : 0.5)) - G.roll) * Math.min(1, dt * 8);

    // jump + gravity
    if (keys.Space && G.onGround && G.crouch < 0.5) { G.velY = 7.4; G.onGround = false; }
    G.velY -= 22 * dt;
    G.pos.y += G.velY * dt;
    const gy = groundAt(G.pos.x, G.pos.z, G.pos.y);
    if (G.pos.y <= gy) {
      if (!G.onGround && G.velY < -5) { G.landDip = clamp(-G.velY * 0.012, 0, 0.14); Sound.step(); }
      G.pos.y = gy; G.velY = 0; G.onGround = true;
    } else if (G.pos.y > gy + 0.05) {
      G.onGround = false;
    }
    resolve(G.pos, PLAYER_R, 1.8);
    G.landDip *= Math.max(0, 1 - dt * 6);

    const target = hv > 0.5 && G.onGround ? 1 : 0;
    G.moveAmt += (target - G.moveAmt) * Math.min(1, dt * 10);
    if (hv > 0.5 && G.onGround) {
      G.bob += dt * hv * 1.7;
      G.stepDist += hv * dt;
      if (G.stepDist > (G.sprint > 0.5 ? 2.6 : 2.0)) { G.stepDist = 0; if (G.crouch < 0.5) Sound.step(); }
    }
    G.inTrain = inTrainingZone(G.pos.x, G.pos.z, 0);
  }

  const _off = new V3(), _eye = new V3(), _cdir = new V3();
  function updateCamera() {
    const w = curWeapon();
    const fovT = lerp(BASE_FOV + 7 * G.sprint, w.adsFov, G.ads);
    if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
    camera.rotation.set(G.pitch, G.yaw, G.roll * (1 - G.ads * 0.8));
    _eye.set(G.pos.x, G.pos.y + EYE - 0.6 * G.crouch - G.landDip, G.pos.z);
    if (G.pov === 0) {
      camera.position.copy(_eye);
      camera.position.y += Math.sin(G.bob * 2) * 0.025 * G.moveAmt * (1 - G.ads);
    } else {
      const p = POVS[G.pov];
      _off.set(p.shoulder * (1 - G.ads * 0.6), 0.25, p.dist * (1 - 0.35 * G.ads)).applyQuaternion(camera.quaternion);
      const len = _off.length();
      _cdir.copy(_off).normalize();
      raycaster.set(_eye, _cdir);
      raycaster.near = 0; raycaster.far = len + 0.3;
      const hs = raycaster.intersectObjects(world.blockers, false);
      let d = len;
      if (hs.length) d = Math.max(0.3, hs[0].distance - 0.3);
      camera.position.copy(_eye).addScaledVector(_cdir, d);
    }
    // world follows the player
    world.sky.position.copy(camera.position);
    world.sun.position.set(G.pos.x + world.sunOffset.x, world.sunOffset.y, G.pos.z + world.sunOffset.z);
    world.sun.target.position.set(G.pos.x, 0, G.pos.z);
  }

  function updateViewModel() {
    const w = curWeapon();
    const vis = G.pov === 0 && !(w.scope && G.ads > 0.85);
    viewRoot.visible = vis;
    if (!vis) return;
    const a = G.ads;
    let x = lerp(w.vmHip[0], w.vmAds[0], a), y = lerp(w.vmHip[1], w.vmAds[1], a), z = lerp(w.vmHip[2], w.vmAds[2], a);
    let rx = 0, ry = 0, rz = 0;
    const mv = G.moveAmt * (1 - a * 0.85);
    x += Math.sin(G.bob) * 0.012 * mv * (1 + G.sprint * 1.2);
    y += Math.abs(Math.cos(G.bob)) * 0.012 * mv * (1 + G.sprint * 1.2);
    y -= G.landDip * 1.5;
    const sp = G.sprint * (1 - a);     // sprint pose: weapon lowered and angled
    y -= 0.05 * sp; x += 0.03 * sp; rx -= 0.3 * sp; ry += 0.45 * sp;
    const gunLike = w.type === 'gun' || w.type === 'pistol';
    if (gunLike) {
      z += G.kick * 0.06; rx += G.kick * 0.07;
      if (G.reloading > 0) {
        const pr = 1 - G.reloading / G.reloadTotal, s = Math.sin(pr * Math.PI);
        y -= s * 0.16; rx -= s * 0.55; rz += s * 0.28; x -= s * 0.03;
      }
    } else {
      rx += w.type === 'melee' ? 0.5 : 0.15;
      if (G.meleeSwing > 0) {
        const p = 1 - G.meleeSwing / G.meleeDur, s = Math.sin(p * Math.PI);
        if (w.type === 'knife') { z -= s * 0.28; x -= s * 0.1; rx += s * 0.2; rz -= s * 0.3; }
        else { rz = lerp(0.9, -1.2, p); rx = 0.5 - s * 0.9; x -= s * 0.18; y += s * 0.05; }
      }
    }
    if (G.switching > 0) {
      const s = G.switching / SWITCH_TIME;
      y -= s * 0.35; rx -= s * 0.6;
    }
    viewRoot.position.set(x, y, z);
    viewRoot.rotation.set(rx, ry, rz);
    viewArms.visible = gunLike;
  }

  function updatePlayerModel(dt) {
    const m = player;
    m.group.visible = G.pov !== 0 && G.state !== 'dead';
    m.group.position.copy(G.pos);
    m.group.rotation.y = G.yaw;
    m.group.scale.y = 1 - 0.2 * G.crouch;
    if (!m.group.visible) return;
    const w = curWeapon();
    const gunLike = w.type === 'gun' || w.type === 'pistol';
    m.walkT += dt * G.speedNow * 1.6 * (G.moveAmt > 0.1 ? 1 : 0);
    const sw = Math.sin(m.walkT) * 0.65 * G.moveAmt;
    m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
    if (gunLike) {
      m.armR.rotation.set(1.3 + G.pitch, 0, -0.4);
      m.armL.rotation.set(1.35 + G.pitch, 0, 0.65);
      m.holder.rotation.set(-1.3, 0, 0.4);
      if (tppWeapon) tppWeapon.position.z = -0.1 + G.kick * 0.05;
    } else {
      let swing = 0;
      if (G.meleeSwing > 0) { const p = 1 - G.meleeSwing / G.meleeDur; swing = Math.sin(p * Math.PI) * (w.type === 'knife' ? 1.0 : 2.2); }
      m.armR.rotation.set(0.5 + swing, 0, -0.15);
      m.armL.rotation.set(0, 0, 0.1);
      m.holder.rotation.set(-0.5 - swing + 0.0, 0, 0.15);
    }
    m.torso.rotation.x = -0.12 * G.sprint;
  }

  /* ------------------------------------------------------------
     heal pads / vending hint / world animation
  ------------------------------------------------------------ */
  function updateHeal(dt) {
    let on = false;
    for (let i = 0; i < world.healSpots.length; i++) {
      const s = world.healSpots[i];
      if (Math.hypot(G.pos.x - s.x, G.pos.z - s.z) < s.r && G.pos.y < 1.5) { on = true; break; }
    }
    G.healing = on && G.hp < G.maxHp;
    if (G.healing) {
      G.hp = Math.min(G.maxHp, G.hp + 9 * dt);
      G.healTick -= dt;
      if (G.healTick <= 0) { Sound.heal(); G.healTick = 1.1; }
    }
    // hint text
    if (G.inTrain && !G.wasTrain) G.trainHintT = 4;
    G.wasTrain = G.inTrain;
    if (G.trainHintT > 0) G.trainHintT -= dt;
    let hint = '';
    if (G.healing) hint = 'Healing...';
    else if (G.trainHintT > 0) hint = 'TRAINING AREA - no enemies here, dummies respawn, kills are not scored';
    else if (nearVending()) hint = 'Press E to open the weapon vending machine';
    if (hint) { setText(HUD.hint, hint); if (!G.hintOn) { HUD.hint.classList.add('on'); G.hintOn = true; } }
    else if (G.hintOn) { HUD.hint.classList.remove('on'); G.hintOn = false; }
  }

  /* ------------------------------------------------------------
     HUD
  ------------------------------------------------------------ */
  function drawMinimap() {
    const c = miniCtx, S = 150, scale = 1.0;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); c.clip();
    c.translate(S / 2, S / 2);
    c.rotate(G.yaw);
    c.translate(-G.pos.x * scale, -G.pos.z * scale);
    // map edge
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
    c.strokeRect(-world.half * scale, -world.half * scale, world.half * 2 * scale, world.half * 2 * scale);
    // obstacles
    c.fillStyle = 'rgba(190,200,210,0.45)';
    for (let i = 0; i < world.boxes.length; i++) {
      const b = world.boxes[i];
      if (b.maxY - b.minY < 1 || b.minY > 2) continue;
      if (Math.abs(b.minX - G.pos.x) > 90 || Math.abs(b.minZ - G.pos.z) > 90) continue;
      c.fillRect(b.minX * scale, b.minZ * scale, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // training area
    if (world.training) {
      const T = world.training;
      c.fillStyle = 'rgba(80,170,255,0.14)'; c.strokeStyle = 'rgba(80,170,255,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.arc(T.cx * scale, T.cz * scale, T.r * scale, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    // heal pads
    c.fillStyle = 'rgba(61,220,107,0.85)';
    world.healSpots.forEach(function (s) { c.beginPath(); c.arc(s.x * scale, s.z * scale, 4, 0, Math.PI * 2); c.fill(); });
    // vending machines
    c.fillStyle = '#ffc14d';
    world.vending.forEach(function (s) { c.fillRect(s.x * scale - 3, s.z * scale - 3, 6, 6); });
    // enemies
    c.fillStyle = '#ff3b3b';
    G.enemies.forEach(function (e) {
      if (e.dead) return;
      if (Math.hypot(e.group.position.x - G.pos.x, e.group.position.z - G.pos.z) > 70) return;
      c.beginPath(); c.arc(e.group.position.x * scale, e.group.position.z * scale, 3, 0, Math.PI * 2); c.fill();
    });
    c.restore();
    // player arrow (always up)
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(S / 2, S / 2 - 7); c.lineTo(S / 2 + 5, S / 2 + 5); c.lineTo(S / 2 - 5, S / 2 + 5); c.closePath(); c.fill();
  }

  let lastBest = -1, lastTotal = -1;
  function updateHUD(force) {
    const w = curWeapon();
    // health
    const hp = Math.max(0, Math.ceil(G.hp));
    setText(HUD.hpText, hp);
    HUD.hpFill.style.width = (G.hp / G.maxHp * 100) + '%';
    HUD.hpFill.className = (G.hp < 25 ? 'low' : G.hp < 55 ? 'mid' : '') + (G.healing ? ' heal' : '');
    // scores
    setText(HUD.kills, G.kills);
    setText(HUD.hs, G.headshots);
    setText(HUD.coins, G.coins);
    if (force || lastBest < 0) {
      const rec = myRecord();
      lastBest = Math.max(rec.best, G.kills); lastTotal = rec.total;
      setText(HUD.best, lastBest);
      setText(HUD.total, lastTotal);
    }
    // ammo
    if (w) {
      setText(HUD.ammoName, w.name.toUpperCase());
      if (w.type === 'gun' || w.type === 'pistol') {
        const a = curAmmo();
        setText(HUD.ammoMag, a.mag);
        setText(HUD.ammoRes, ' / ' + a.reserve);
      } else {
        setText(HUD.ammoMag, '--');
        setText(HUD.ammoRes, ' melee');
      }
    }
    // slots
    HUD.slots.forEach(function (el, i) {
      const id = G.slots[i];
      const span = el.querySelector('span');
      setText(span, id ? WEAPONS[id].name : '(empty)');
      el.classList.toggle('empty', !id);
      el.classList.toggle('active', i === G.cur);
    });
  }

  function updateHudEffects(dt) {
    // damage flash
    if (G.dmgFlash > 0) G.dmgFlash = Math.max(0, G.dmgFlash - dt * 1.6);
    const lowBoost = G.hp < 30 ? 0.25 + Math.sin(G.time * 5) * 0.08 : 0;
    HUD.vignette.style.opacity = Math.min(1, G.dmgFlash + lowBoost);
    if (G.dmgDirT > 0) { G.dmgDirT -= dt; HUD.dmgDir.style.opacity = clamp(G.dmgDirT, 0, 1); }
    if (G.hitT > 0) { G.hitT -= dt; if (G.hitT <= 0) HUD.hit.className = ''; }
    // reload bar
    if (G.reloading > 0) {
      HUD.reloadBar.classList.add('on');
      HUD.reloadBar.firstElementChild.style.width = ((1 - G.reloading / G.reloadTotal) * 100) + '%';
    } else HUD.reloadBar.classList.remove('on');
    // scope + crosshair
    const w = curWeapon();
    const scoped = w.scope && G.ads > 0.85 && G.pov === 0;
    HUD.scope.classList.toggle('on', !!scoped);
    HUD.cross.style.display = scoped || (G.ads > 0.9 && w.scope) ? 'none' : 'block';
    const gap = 5 + currentSpread(w.type === 'gun' || w.type === 'pistol' ? w : { spread: 0.01, adsSpread: 0.01 }) * 650;
    HUD.cross.style.setProperty('--gap', gap.toFixed(1) + 'px');
    HUD.cross.classList.toggle('hs-aim', isAimingHead());
    drawMinimap();
    updateHUD(false);
  }

  function isAimingHead() {
    if (G.state !== 'playing') return false;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 180;
    const hits = raycaster.intersectObjects(enemyPartList(), false);
    return hits.length > 0 && hits[0].object.userData.part === 'head';
  }

  /* ------------------------------------------------------------
     main loop
  ------------------------------------------------------------ */
  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!scene) return;

    if (G.state === 'playing') {
      G.time += dt;
      updatePlayer(dt);
      updateCamera();
      updateViewModel();
      camera.updateMatrixWorld(true);
      updatePlayerModel(dt);
      player.group.updateMatrixWorld(true);
      updateWeapons(dt);
      updateEnemies(dt);
      updateDummies(dt);
      updateSpawner(dt);
      updateEffects(dt);
      updateHeal(dt);
      world.anim.forEach(function (fn) { fn(G.time); });
      updateHudEffects(dt);
    } else if (G.state === 'dead') {
      G.time += dt;
      updateEnemies(dt);
      updateEffects(dt);
      G.pitch += (0.25 - G.pitch) * dt * 2;
      camera.position.y += (0.5 - camera.position.y) * dt * 3;
      updateHudEffects(dt);
    }
    renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------
     input
  ------------------------------------------------------------ */
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (G.state === 'playing') {
      if (e.code === 'Space' || e.code === 'Tab' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      switch (e.code) {
        case 'KeyR': reload(); break;
        case 'Digit1': switchTo(0); break;
        case 'Digit2': switchTo(1); break;
        case 'Digit3': switchTo(2); break;
        case 'Digit4': switchTo(3); break;
        case 'KeyQ': switchTo(G.lastSlot); break;
        case 'KeyV':
          G.pov = (G.pov + 1) % POVS.length;
          setText(HUD.pov, 'POV: ' + POVS[G.pov].name + '  [V]');
          break;
        case 'KeyB': openStore(); break;
        case 'KeyE': if (nearVending()) openStore(); break;
      }
    } else if (G.state === 'store') {
      if (e.code === 'KeyB') closeStore(true);
      else if (e.code === 'Escape') closeStore(false);
    }
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  document.addEventListener('mousedown', function (e) {
    if (G.state !== 'playing') return;
    if (e.button === 0) { G.fireHeld = true; G.firePressed = true; }
    if (e.button === 2) G.adsHeld = true;
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) G.fireHeld = false;
    if (e.button === 2) G.adsHeld = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('wheel', function (e) {
    if (G.state !== 'playing') return;
    cycleSlot(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('mousemove', function (e) {
    if (G.state !== 'playing' || document.pointerLockElement !== canvas) return;
    const s = 0.0022 * (1 - 0.6 * G.ads) * G.sens;
    G.yaw -= e.movementX * s;
    G.pitch = clamp(G.pitch - e.movementY * s, -1.5, 1.5);
  });
  document.addEventListener('pointerlockchange', function () {
    if (document.pointerLockElement !== canvas && G.state === 'playing') pauseGame();
  });
  document.addEventListener('pointerlockerror', function () {
    if (G.state === 'playing') pauseGame();
  });
  window.addEventListener('blur', function () { if (G.state === 'playing') pauseGame(); });
  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ------------------------------------------------------------
     buttons
  ------------------------------------------------------------ */
  $('btn-play').addEventListener('click', startGame);
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-quit').addEventListener('click', quitToMenu);
  ['set-sound', 'set-vfx', 'hud-minimap', 'hud-stats', 'hud-feed', 'hud-slots', 'hud-ammo', 'hud-cross'].forEach(function (id) {
    $(id).addEventListener('change', syncSettingsFromPause);
  });
  $('set-sens').addEventListener('input', syncSettingsFromPause);
  $('set-hud-scale').addEventListener('input', syncSettingsFromPause);
  $('btn-again').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', quitToMenu);
  $('store-close').addEventListener('click', function () { closeStore(true); });
  Array.prototype.forEach.call(document.querySelectorAll('#store-tabs .tab'), function (t) {
    t.addEventListener('click', function () { storeTab = t.getAttribute('data-tab'); renderStore(); });
  });
  $('username').addEventListener('keydown', function (e) { if (e.code === 'Enter') startGame(); });

  buildMenu();
  requestAnimationFrame(frame);
})();

/* ===================== STRIKE ZONE - weapons.js =====================
   1) WEAPONS table: every weapon in the game + store price
   2) makeWeaponModel(id): builds the 3D model of a weapon (needs three.js)
   Slots:  1 & 2 = guns | 3 = pistol or knife | 4 = melee
*/
const WEAPONS = {
  /* ---------------- GUNS (slot 1 / 2) ---------------- */
  ak47:   { name: 'AK-47',        cat: 'Assault Rifle', type: 'gun', dmg: 28, rpm: 600,  mag: 30,  reserve: 90,  reload: 2.4, spread: 0.020, recoil: 0.011, auto: true,  price: 0,    sfx: 'rifle',   model: 'rifle',   color: 0x2b2b2b, wood: 0x6b3d1e, adsFov: 58 },
  m4a1:   { name: 'M4A1',         cat: 'Assault Rifle', type: 'gun', dmg: 24, rpm: 750,  mag: 30,  reserve: 120, reload: 2.1, spread: 0.017, recoil: 0.009, auto: true,  price: 1200, sfx: 'rifle',   model: 'rifle',   color: 0x1e1e1e, optic: true, adsFov: 55 },
  scar:   { name: 'SCAR-H',       cat: 'Battle Rifle',  type: 'gun', dmg: 36, rpm: 520,  mag: 20,  reserve: 80,  reload: 2.5, spread: 0.015, recoil: 0.014, auto: true,  price: 1800, sfx: 'rifle',   model: 'rifle',   color: 0x6e6248, optic: true, adsFov: 55 },
  mp5:    { name: 'MP5',          cat: 'SMG',           type: 'gun', dmg: 18, rpm: 850,  mag: 30,  reserve: 150, reload: 1.9, spread: 0.024, recoil: 0.007, auto: true,  price: 900,  sfx: 'smg',     model: 'smg',     color: 0x1c1c1c, adsFov: 60, speed: 1.05 },
  vector: { name: 'Vector',       cat: 'SMG',           type: 'gun', dmg: 15, rpm: 1100, mag: 33,  reserve: 165, reload: 1.8, spread: 0.030, recoil: 0.006, auto: true,  price: 1400, sfx: 'smg',     model: 'smg',     color: 0x3a3a3a, suppressor: true, adsFov: 60, speed: 1.05 },
  pump:   { name: 'Pump Shotgun', cat: 'Shotgun',       type: 'gun', dmg: 14, rpm: 70,   mag: 6,   reserve: 30,  reload: 2.8, spread: 0.060, recoil: 0.04,  auto: false, price: 1100, sfx: 'shotgun', model: 'shotgun', color: 0x222222, wood: 0x5a3a1c, pellets: 9, range: 45, pumpSound: true, adsFov: 62 },
  aa12:   { name: 'AA-12',        cat: 'Auto Shotgun',  type: 'gun', dmg: 10, rpm: 300,  mag: 20,  reserve: 60,  reload: 3.2, spread: 0.070, recoil: 0.02,  auto: true,  price: 2400, sfx: 'shotgun', model: 'shotgun', color: 0x2a2a2a, wood: 0x2a2a2a, pellets: 8, range: 45, drum: true, adsFov: 62 },
  m249:   { name: 'M249 SAW',     cat: 'LMG',           type: 'gun', dmg: 26, rpm: 700,  mag: 100, reserve: 200, reload: 4.5, spread: 0.030, recoil: 0.010, auto: true,  price: 2800, sfx: 'lmg',     model: 'lmg',     color: 0x222222, adsFov: 58, speed: 0.85 },
  kar98:  { name: 'Kar98k',       cat: 'Sniper Rifle',  type: 'gun', dmg: 90, rpm: 45,   mag: 5,   reserve: 25,  reload: 3.0, spread: 0.020, adsSpread: 0.0004, recoil: 0.05, auto: false, price: 1800, sfx: 'sniper', model: 'sniper', color: 0x2a2a2a, wood: 0x6b3d1e, scope: true, adsFov: 22, range: 400, speed: 0.95 },
  awm:    { name: 'AWM',          cat: 'Sniper Rifle',  type: 'gun', dmg: 140, rpm: 38,  mag: 5,   reserve: 20,  reload: 3.4, spread: 0.020, adsSpread: 0.0002, recoil: 0.06, auto: false, price: 3200, sfx: 'sniper', model: 'sniper', color: 0x2f3d2a, wood: 0x2f3d2a, scope: true, adsFov: 14, range: 500, speed: 0.9 },

  /* ---------------- PISTOLS & KNIVES (slot 3) ---------------- */
  glock:    { name: 'G17',          cat: 'Pistol',   type: 'pistol', dmg: 20, rpm: 400, mag: 17, reserve: 85, reload: 1.5, spread: 0.022, recoil: 0.012, auto: false, price: 0,   sfx: 'pistol', model: 'pistol', color: 0x1b1b1b, adsFov: 68, range: 120 },
  m1911:    { name: 'M1911',        cat: 'Pistol',   type: 'pistol', dmg: 30, rpm: 330, mag: 8,  reserve: 48, reload: 1.6, spread: 0.020, recoil: 0.016, auto: false, price: 400, sfx: 'pistol', model: 'pistol', color: 0x3a3a3a, adsFov: 68, range: 120 },
  deagle:   { name: 'Desert Eagle', cat: 'Pistol',   type: 'pistol', dmg: 55, rpm: 200, mag: 7,  reserve: 35, reload: 1.9, spread: 0.018, recoil: 0.04,  auto: false, price: 900, sfx: 'deagle', model: 'pistol', color: 0xb6b6b6, big: true, adsFov: 66, range: 140 },
  revolver: { name: 'Magnum .357',  cat: 'Revolver', type: 'pistol', dmg: 70, rpm: 120, mag: 6,  reserve: 30, reload: 2.4, spread: 0.016, recoil: 0.05,  auto: false, price: 1000, sfx: 'deagle', model: 'pistol', color: 0x6d6d6d, big: true, adsFov: 66, range: 140 },
  knife:    { name: 'Combat Knife', cat: 'Knife',    type: 'knife',  dmg: 45, cooldown: 0.45, range: 2.3, price: 150, model: 'knife', color: 0xcfd3d6 },
  karambit: { name: 'Karambit',     cat: 'Knife',    type: 'knife',  dmg: 40, cooldown: 0.30, range: 2.2, price: 400, model: 'knife', color: 0x9aa7b8, curved: true },

  /* ---------------- MELEE (slot 4) ---------------- */
  bat:     { name: 'Baseball Bat', cat: 'Melee', type: 'melee', dmg: 55,  cooldown: 0.75, range: 2.8, price: 0,    model: 'bat',     color: 0x8a5a2b },
  crowbar: { name: 'Crowbar',      cat: 'Melee', type: 'melee', dmg: 50,  cooldown: 0.60, range: 2.6, price: 300,  model: 'crowbar', color: 0x9b1c1c },
  machete: { name: 'Machete',      cat: 'Melee', type: 'melee', dmg: 65,  cooldown: 0.55, range: 2.7, price: 500,  model: 'blade',   color: 0xb7bcc0, short: true },
  axe:     { name: 'Fire Axe',     cat: 'Melee', type: 'melee', dmg: 110, cooldown: 1.10, range: 2.8, price: 900,  model: 'axe',     color: 0xa0a5a8 },
  katana:  { name: 'Katana',       cat: 'Melee', type: 'melee', dmg: 85,  cooldown: 0.60, range: 3.0, price: 1200, model: 'blade',   color: 0xe6eaee }
};

/* fill in defaults so the game code never meets an undefined value */
(function normalize() {
  Object.keys(WEAPONS).forEach(function (id) {
    const w = WEAPONS[id];
    w.id = id;
    w.speed = w.speed || 1;
    if (w.type === 'gun' || w.type === 'pistol') {
      w.range = w.range || 220;
      w.pellets = w.pellets || 1;
      w.adsSpread = w.adsSpread != null ? w.adsSpread : w.spread * 0.35;
      w.adsFov = w.adsFov || 60;
      w.auto = !!w.auto;
      if (w.type === 'pistol') {
        w.vmHip = [0.17, -0.17, -0.38];
        w.vmAds = [0, -0.1, -0.3];
      } else {
        w.vmHip = [0.2, -0.2, -0.45];
        w.vmAds = [0, -0.118, -0.32];
      }
    } else {
      w.adsFov = 75;
      w.adsSpread = 0;
      w.spread = 0;
      w.vmHip = w.type === 'knife' ? [0.25, -0.24, -0.45] : [0.3, -0.3, -0.5];
      w.vmAds = w.vmHip;
    }
  });
})();

/* ---------------------------------------------------------------
   3D MODELS - every weapon is built from simple boxes/cylinders.
   Barrel always points toward -Z. The group has:
     userData.muzzle : Vector3 (where bullets leave)
     userData.flash  : muzzle-flash mesh (toggle .visible)
---------------------------------------------------------------- */
function makeWeaponModel(id) {
  const w = WEAPONS[id];
  const g = new THREE.Group();
  const mat = function (c, met, rough) {
    return new THREE.MeshStandardMaterial({ color: c, metalness: met, roughness: rough });
  };
  const metal = mat(w.color || 0x222222, 0.75, 0.38);
  const dark = mat(0x121212, 0.6, 0.5);
  const wood = mat(w.wood || 0x5a3a1c, 0.0, 0.7);
  const steel = mat(w.type === 'knife' || w.type === 'melee' ? (w.color || 0xcccccc) : 0x9a9a9a, 1.0, 0.22);

  function box(sx, sy, sz, x, y, z, m, rx) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || metal);
    me.position.set(x, y, z);
    if (rx) me.rotation.x = rx;
    me.castShadow = true;
    g.add(me);
    return me;
  }
  // cylinder lying along Z axis
  function cyl(r, len, x, y, z, m, r2) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r2 == null ? r : r2, r, len, 12), m || metal);
    me.rotation.x = Math.PI / 2;
    me.position.set(x, y, z);
    me.castShadow = true;
    g.add(me);
    return me;
  }
  let muzzleZ = -0.7;

  switch (w.model) {
    case 'rifle':
      box(0.05, 0.085, 0.5, 0, 0, -0.1);                              // receiver
      box(0.06, 0.06, 0.28, 0, 0.005, -0.42, w.wood ? wood : dark);   // handguard
      cyl(0.012, 0.32, 0, 0.02, -0.62, steel);                        // barrel
      box(0.01, 0.045, 0.012, 0, 0.055, -0.76, dark);                 // front sight
      box(0.045, 0.09, 0.26, 0, -0.02, 0.28, w.wood ? wood : dark);   // stock
      box(0.035, 0.17, 0.06, 0, -0.125, -0.12, dark, 0.22);           // magazine
      box(0.035, 0.1, 0.045, 0, -0.09, 0.1, dark, -0.3);              // grip
      if (w.optic) {
        box(0.04, 0.045, 0.12, 0, 0.065, -0.08, dark);
        cyl(0.02, 0.1, 0, 0.09, -0.08, dark);
      } else {
        box(0.02, 0.03, 0.02, 0, 0.055, -0.02, dark);
      }
      muzzleZ = -0.8;
      break;

    case 'smg':
      box(0.05, 0.09, 0.34, 0, 0, -0.04);
      box(0.045, 0.05, 0.14, 0, 0, -0.28, dark);
      cyl(0.012, 0.15, 0, 0.015, -0.4, steel);
      if (w.suppressor) cyl(0.024, 0.22, 0, 0.015, -0.52, dark);
      box(0.03, 0.2, 0.05, 0, -0.14, -0.02, dark, 0.1);
      box(0.035, 0.1, 0.045, 0, -0.09, 0.1, dark, -0.3);
      box(0.03, 0.04, 0.2, 0, 0.0, 0.25, dark);
      box(0.02, 0.03, 0.03, 0, 0.06, -0.02, dark);
      muzzleZ = w.suppressor ? -0.64 : -0.48;
      break;

    case 'shotgun':
      box(0.055, 0.09, 0.26, 0, 0, 0.0);
      cyl(0.016, 0.72, 0, 0.025, -0.42, steel);
      cyl(0.014, 0.55, 0, -0.02, -0.34, dark);
      box(0.055, 0.045, 0.2, 0, -0.03, -0.36, w.wood ? wood : dark);
      box(0.05, 0.1, 0.3, 0, -0.03, 0.3, w.wood ? wood : dark);
      box(0.035, 0.1, 0.045, 0, -0.09, 0.1, dark, -0.3);
      if (w.drum) cyl(0.08, 0.08, 0, -0.12, -0.05, dark);
      box(0.012, 0.03, 0.012, 0, 0.06, -0.78, dark);
      muzzleZ = -0.8;
      break;

    case 'sniper':
      box(0.05, 0.085, 0.5, 0, 0, -0.05, wood);
      cyl(0.014, 0.8, 0, 0.02, -0.62, steel);
      box(0.06, 0.11, 0.36, 0, -0.02, 0.32, wood);
      cyl(0.026, 0.32, 0, 0.095, -0.08, dark);                         // scope tube
      cyl(0.034, 0.05, 0, 0.095, -0.25, dark);
      cyl(0.034, 0.05, 0, 0.095, 0.09, dark);
      box(0.02, 0.04, 0.02, 0, 0.06, -0.14, dark);
      box(0.02, 0.02, 0.05, 0.045, 0.02, 0.03, steel);               // bolt handle
      box(0.03, 0.08, 0.06, 0, -0.1, -0.05, dark);
      box(0.035, 0.1, 0.045, 0, -0.09, 0.12, dark, -0.3);
      muzzleZ = -1.02;
      break;

    case 'lmg':
      box(0.07, 0.1, 0.52, 0, 0, -0.08);
      box(0.06, 0.06, 0.3, 0, 0.0, -0.48, dark);
      cyl(0.016, 0.4, 0, 0.025, -0.78, steel);
      box(0.12, 0.12, 0.13, 0, -0.13, -0.05, dark);                    // ammo box
      box(0.05, 0.09, 0.28, 0, -0.02, 0.3, dark);
      box(0.035, 0.1, 0.045, 0, -0.09, 0.12, dark, -0.3);
      box(0.012, 0.1, 0.012, -0.03, -0.07, -0.62, dark, 0.3);           // bipod
      box(0.012, 0.1, 0.012, 0.03, -0.07, -0.62, dark, 0.3);
      box(0.03, 0.04, 0.1, 0, 0.07, -0.1, dark);
      muzzleZ = -0.98;
      break;

    case 'pistol': {
      const s = w.big ? 1.18 : 1;
      box(0.034 * s, 0.045 * s, 0.21 * s, 0, 0.025, -0.06, metal);     // slide
      box(0.03, 0.025, 0.17 * s, 0, -0.005, -0.04, dark);              // frame
      box(0.032, 0.1, 0.05, 0, -0.07, 0.04, dark, -0.18);              // grip
      cyl(0.008, 0.06, 0, 0.025, -0.175 * s, steel);
      box(0.01, 0.014, 0.012, 0, 0.055, -0.15, dark);
      box(0.012, 0.012, 0.012, 0, 0.055, 0.03, dark);
      muzzleZ = -0.2 * s;
      break;
    }

    case 'knife':
      box(0.008, 0.036, 0.19, 0, 0, -0.18, steel);
      box(0.045, 0.012, 0.012, 0, 0, -0.085, dark);
      box(0.024, 0.032, 0.11, 0, 0, -0.02, dark);
      if (w.curved) {
        box(0.008, 0.03, 0.1, 0, -0.015, -0.28, steel, 0.5);
        box(0.03, 0.03, 0.014, 0, -0.04, 0.04, steel);
      }
      break;

    case 'blade':
      box(0.008, 0.042, w.short ? 0.5 : 0.78, 0, 0, w.short ? -0.33 : -0.46, steel);
      box(0.07, 0.07, 0.012, 0, 0, -0.07, dark);
      box(0.03, 0.03, 0.22, 0, 0, 0.05, dark);
      break;

    case 'bat':
      cyl(0.032, 0.88, 0, 0, -0.34, wood, 0.016);
      cyl(0.02, 0.03, 0, 0, 0.12, wood);
      break;

    case 'crowbar':
      cyl(0.014, 0.82, 0, 0, -0.3, metal);
      box(0.02, 0.02, 0.1, 0, 0.03, -0.72, metal, 0.7);
      box(0.02, 0.03, 0.08, 0, 0, 0.12, metal, 0.5);
      break;

    case 'axe':
      cyl(0.02, 0.9, 0, 0, -0.3, mat(0x7a4a22, 0, 0.8));
      box(0.025, 0.14, 0.16, 0, 0.04, -0.72, steel);
      box(0.03, 0.04, 0.05, 0, 0.0, -0.72, dark);
      break;

    default:
      box(0.05, 0.05, 0.3, 0, 0, -0.1);
  }

  if (w.type === 'gun' || w.type === 'pistol') {
    g.userData.muzzle = new THREE.Vector3(0, 0.02, muzzleZ);
    // muzzle flash = two crossed glowing planes
    const fm = new THREE.MeshBasicMaterial({
      color: 0xffc866, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    });
    const flash = new THREE.Group();
    const s = w.pellets > 1 ? 0.5 : w.type === 'pistol' ? 0.28 : 0.36;
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(s, s), fm);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(s, s), fm);
    p2.rotation.z = Math.PI / 2;
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(s, s), fm);
    p3.rotation.y = Math.PI / 2;
    flash.add(p1, p2, p3);
    flash.position.set(0, 0.02, muzzleZ - 0.06);
    flash.visible = false;
    g.add(flash);
    g.userData.flash = flash;
  }
  return g;
}

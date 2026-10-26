/* ===================== STRIKE ZONE - characters.js =====================
   Four playable operators. Loaded before game.js.
   Outfit keys match buildHumanoid() in game.js.
*/
const CHARACTERS = [
  {
    id: 'ranger',
    name: 'RANGER',
    role: 'Woodland Assault',
    desc: 'Plate carrier, ballistic helmet and NVG. Built for jungle and forest fights.',
    preview: 'linear-gradient(160deg,#1a2a18 0%,#4a5c32 45%,#2a3320 100%)',
    accent: '#7cb35a',
    outfit: {
      shirt: 0x3a4a2e, pants: 0x2f3a28, vest: 0x252c20, helmet: 0x2a3324,
      skin: 0xc99068, camo: [0x4b5a3a, 0x2f3b2c, 0x6b5a3c],
      hat: 'helmet', mask: false, goggles: true, pack: true, glove: 0x1a1a1a, maskColor: 0x151515
    }
  },
  {
    id: 'ghost',
    name: 'GHOST',
    role: 'Urban Recon',
    desc: 'Grey urban kit, balaclava and suppressed-look loadout. Hard to spot in yards.',
    preview: 'linear-gradient(160deg,#121418 0%,#4a5058 48%,#1c2026 100%)',
    accent: '#9aa7b8',
    outfit: {
      shirt: 0x3d4a52, pants: 0x2b2f36, vest: 0x1d2228, helmet: 0x232a30,
      skin: 0xb98259, camo: [0x70757a, 0x4a4e52, 0x2c2f33],
      hat: 'beanie', mask: true, goggles: true, pack: false, glove: 0x111111, maskColor: 0x151515
    }
  },
  {
    id: 'fox',
    name: 'DESERT FOX',
    role: 'Arid Scout',
    desc: 'Tan camo, patrol cap and light vest. Fast mover for dusty outposts.',
    preview: 'linear-gradient(160deg,#6b4a22 0%,#c9a26b 50%,#8a6a3c 100%)',
    accent: '#e0b04a',
    outfit: {
      shirt: 0xb59a6a, pants: 0x8a7348, vest: 0x5a4d38, helmet: 0x5a5340,
      skin: 0xd9a679, camo: [0xb59a6a, 0x8a7348, 0x6b5a3c],
      hat: 'cap', mask: false, goggles: true, pack: false, glove: 0x3a3426, maskColor: 0x3a4630
    }
  },
  {
    id: 'frost',
    name: 'FROST',
    role: 'Arctic Specialist',
    desc: 'Winter camouflage, visored helmet and insulated pack for frozen bases.',
    preview: 'linear-gradient(160deg,#8aa3c4 0%,#e8eef5 52%,#4a5a6a 100%)',
    accent: '#cfe3ff',
    outfit: {
      shirt: 0xdfe6ee, pants: 0xaab6c4, vest: 0x7a8794, helmet: 0x8aa3c4,
      skin: 0xf0c8a0, camo: [0xdfe6ee, 0xaab6c4, 0x7a8794],
      hat: 'helmet', mask: true, goggles: true, pack: true, glove: 0x2b2b2b, maskColor: 0x2b2b2b
    }
  }
];

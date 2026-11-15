import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================= config ================= */
// id, name, one-line character for the Car menu
const MODEL_LIST = [
  ['raven', 'Raven RS', 'Balanced street coupe. The all-rounder this garage was built around.'],
  ['ember', 'Ember R', 'Light hot hatch: short, tall and eager. Revs high, turns in sharp, small engine.'],
  ['blackjaw', 'Blackjaw', 'Heavy muscle fastback. Long hood, wide haunches and a wall of low-end torque.'],
  ['vanta', 'Vanta GT', 'Mid-engine wedge supercar. Low, light and slippery, with the highest top speed.'],
  ['supra', 'Toyota Supra', 'Tuned Japanese GT. Handles like the Raven RS.'],
  ['rx7', 'Mazda RX-7', 'Light rotary coupe on a wide body kit. Drives like the Ember R.'],
  ['m4', 'BMW M4 Widebody', 'Heavy widebody bruiser. Drives like the Blackjaw.'],
  ['audi90', 'Audi 90 GTO', 'Boxy race car from the IMSA era. Drives like the Vanta GT.']
];
// Cars that come from a .glb in public/cars. Power and handling come from `base`; each has its own engine voice (ENGINE_VOICE).
// `wheels` matches the materials that spin; parts shared by both sides are split into four corners on load.
const GLB_CARS = {
  supra: { file: 'cars/supra.glb', base: 'raven', length: 4.55, wheels: /^(wheel|Brake_Disc)$/ },
  rx7: { file: 'cars/rx7.glb', base: 'ember', length: 4.4, wheels: /^(Tyres|Rims|Rims_2|Material\.001|Disk|Disk_2)$/ },
  m4: { file: 'cars/m4.glb', base: 'blackjaw', length: 4.85, wheels: /^(sidetyre|main|disk\.001|metalblack|Material\.001)$/ },
  audi90: { file: 'cars/audi90.glb', base: 'vanta', length: 4.6, wheels: /^(GENERIC_TREAD_SLICK|GENERIC_TIRE_GOODYEAR|AUDI_90_WHEEL)\b/ }
};
const baseOf = (id) => (GLB_CARS[id] ? GLB_CARS[id].base : id);
const DEFAULTS = {
  color: '#d42a3c', color2: '#2a6cff', finish: 'gloss', width: 'stock', susp: 'stock', fbumper: 'stock', rbumper: 'stock',
  skirt: 'stock', hood: 'stock', spoiler: 'none', wingColor: 'carbon', exhaust: 'dual', vinyl: 'none', vinylColor: '#f2f2f2',
  sticker: 'RAVEN', stickerColor: '#f2f2f2', rimStyle: 'classic', rimSize: 18, rimColor: '#c9ced6', caliper: '#e0262f',
  brakes: 'stock', tint: 'light', neon: 'off', headlight: 'white', taillight: 'red', lightsOn: false,
  roof: 'none', mirrors: 'stock', fenderVents: false, finalDrive: 4.1, ecu: 'balanced', nitroTune: 'balanced',
  engine: 0, turbo: 'none', nitro: 0, gearbox: 'stock', tires: 'street', model: 'raven', custom: false, bov: 'soft'
};
const SHOWCASE = {
  color: '#6d2fd6', color2: '#2a6cff', finish: 'chameleon', width: 'wide', susp: 'stance', fbumper: 'aggr', rbumper: 'diff',
  skirt: 'carbon', hood: 'vents', spoiler: 'gt', wingColor: 'body', vinyl: 'slash', vinylColor: '#d9dce6', sticker: '',
  rimStyle: 'six', rimSize: 18, rimColor: '#3a3d45', caliper: '#e0262f', brakes: 'ceramic', neon: '#9b5cff', lightsOn: true,
  headlight: 'xenon', tint: 'dark', taillight: 'red', roof: 'none', mirrors: 'aero', fenderVents: true, engine: 3, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'slick', exhaust: 'dual'
};
const STORE_KEY = 'raven-rs-3d-v1';
const clean = (o) => {
  const out = { ...DEFAULTS };
  if (o && typeof o === 'object') for (const k of Object.keys(DEFAULTS)) if (o[k] !== undefined && typeof o[k] === typeof DEFAULTS[k]) out[k] = o[k];
  out.sticker = String(out.sticker).slice(0, 14);
  if (!MODEL_LIST.some((m) => m[0] === out.model)) out.model = 'raven';
  return out;
};
const readStore = () => { try { const r = localStorage.getItem(STORE_KEY); return r ? clean(JSON.parse(r)) : null; } catch (e) { return null; } };
let cfg = readStore() || clean({ ...DEFAULTS, ...SHOWCASE });
let tab = 'kits';

const VINYL_COLS = [['#f2f2f2', 'White'], ['#121316', 'Black'], ['#d9dce6', 'Silver'], ['#2ee6d6', 'Neon cyan'], ['#ff3da8', 'Neon pink'], ['#ffb300', 'Yellow'], ['#e0262f', 'Red'], ['#2a6cff', 'Blue']];
const KITS = [
  ['Factory', 'Stock bumpers, no wing. Clean slate.', { fbumper: 'stock', rbumper: 'stock', skirt: 'stock', width: 'stock', hood: 'stock', spoiler: 'none', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Street', 'Sport bumpers and skirts with a trunk lip.', { fbumper: 'sport', rbumper: 'sport', skirt: 'sport', width: 'stock', hood: 'stock', spoiler: 'lip', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Sleeper', 'Smooth front lip, tucked rear and a ducktail.', { fbumper: 'street', rbumper: 'clean', skirt: 'stock', width: 'stock', hood: 'bulge', spoiler: 'duck', roof: 'none', mirrors: 'stock', fenderVents: false }],
  ['Drift Missile', 'Bolt-on overfenders, vented hood, twin-element wing.', { fbumper: 'aggr', rbumper: 'sport', skirt: 'carbon', width: 'over', hood: 'vents', spoiler: 'tri', roof: 'none', mirrors: 'aero', fenderVents: true }],
  ['Widebody Show', 'Riveted widebody, diffuser and a GT wing.', { fbumper: 'aggr', rbumper: 'diff', skirt: 'carbon', width: 'wide', hood: 'carbon', spoiler: 'gt', roof: 'louvers', mirrors: 'aero', fenderVents: true }],
  ['Time Attack', 'Huge splitter, louvers, swan-neck wing, roof fins.', { fbumper: 'track', rbumper: 'track', skirt: 'aero', width: 'wide', hood: 'louvers', spoiler: 'swan', roof: 'vortex', mirrors: 'aero', fenderVents: true }]
];
function groupsFor(t) {
  const P = (title, key, opts) => ({ type: 'pills', title, key, opts });
  const S = (title, key, opts) => ({ type: 'swatch', title, key, opts });
  if (t === 'kits') return [{ type: 'kits' }];
  if (t === 'body') return [
    P('Front bumper', 'fbumper', [['stock', 'Stock'], ['street', 'Street lip'], ['sport', 'Sport'], ['aggr', 'Aggressive'], ['track', 'Time attack']]),
    P('Rear bumper', 'rbumper', [['stock', 'Stock'], ['clean', 'Tucked'], ['sport', 'Sport'], ['diff', 'Diffuser'], ['track', 'Time attack']]),
    P('Side skirts', 'skirt', [['stock', 'Stock'], ['sport', 'Sport'], ['carbon', 'Carbon'], ['aero', 'Aero winglets']]),
    P('Fenders', 'width', [['stock', 'Stock'], ['wide', 'Riveted widebody'], ['over', 'Bolt-on overfenders']]),
    P('Fender vents', 'fenderVents', [[false, 'None'], [true, 'Vented']]),
    P('Exhaust', 'exhaust', [['single', 'Single'], ['dual', 'Dual'], ['quad', 'Quad'], ['center', 'Center exit']])
  ];
  if (t === 'aero') return [
    P('Spoiler', 'spoiler', [['none', 'None'], ['lip', 'Trunk lip'], ['duck', 'Ducktail'], ['roof', 'Roof spoiler'], ['gt', 'GT wing'], ['swan', 'Swan-neck'], ['tri', 'Twin-element']]),
    P('Wing finish', 'wingColor', [['carbon', 'Carbon'], ['body', 'Body color']]),
    P('Hood', 'hood', [['stock', 'Stock'], ['bulge', 'Power bulge'], ['scoop', 'Scoop'], ['vents', 'Vented carbon'], ['louvers', 'Louvered'], ['carbon', 'Carbon']]),
    P('Roof', 'roof', [['none', 'Clean'], ['scoop', 'Roof scoop'], ['vortex', 'Vortex fins'], ['louvers', 'Rear louvers']]),
    P('Mirrors', 'mirrors', [['stock', 'Stock'], ['aero', 'Aero']])
  ];
  if (t === 'paint') return [
    S('Body color', 'color', [['#d42a3c', 'Red'], ['#ff6a1a', 'Orange'], ['#f2c230', 'Yellow'], ['#9be22d', 'Lime'], ['#1e9e5a', 'Green'], ['#2ec4e6', 'Cyan'], ['#1f5fd6', 'Blue'], ['#6d2fd6', 'Purple'], ['#ff3da8', 'Pink'], ['#f2f2f2', 'White'], ['#9aa3ad', 'Silver'], ['#4a4f57', 'Graphite'], ['#121316', 'Black'], ['#c9a227', 'Gold']]),
    P('Finish', 'finish', [['gloss', 'Gloss'], ['metal', 'Metallic'], ['mat', 'Matte'], ['pearl', 'Pearl'], ['chameleon', 'Chameleon']]),
    S('Chameleon flip color', 'color2', [['#2a6cff', 'Blue'], ['#2ee6d6', 'Cyan'], ['#9b5cff', 'Violet'], ['#ff3da8', 'Pink'], ['#ffb300', 'Gold'], ['#3bd16f', 'Green']])
  ];
  if (t === 'vinyl') return [
    P('Pattern', 'vinyl', [['none', 'None'], ['slash', 'Raven slashes'], ['stripes', 'Racing stripes'], ['flames', 'Flames'], ['bolt', 'Lightning'], ['line', 'Side stripe'], ['twotone', 'Two-tone'], ['checker', 'Checkered']]),
    S('Pattern color', 'vinylColor', VINYL_COLS),
    { type: 'sticker' },
    S('Decal color', 'stickerColor', VINYL_COLS)
  ];
  if (t === 'wheels') return [
    P('Rim style', 'rimStyle', [['classic', 'Classic'], ['six', 'Six-spoke'], ['mesh', 'Mesh'], ['y', 'Y-spoke'], ['aero', 'Aero'], ['deep', 'Deep dish']]),
    P('Size', 'rimSize', [[17, '17"'], [18, '18"'], [19, '19"'], [20, '20"']]),
    S('Rim color', 'rimColor', [['#c9ced6', 'Silver'], ['#3a3d45', 'Gunmetal'], ['#16171b', 'Black'], ['#c9a227', 'Gold'], ['#8c5a2b', 'Bronze'], ['#ededed', 'White'], ['#c8202e', 'Red'], ['#2ec4e6', 'Cyan']]),
    S('Brake caliper', 'caliper', [['#e0262f', 'Red'], ['#ffcc00', 'Yellow'], ['#2a6cff', 'Blue'], ['#3bd16f', 'Green'], ['#ff3da8', 'Pink'], ['#1a1a1a', 'Black']])
  ];
  if (t === 'lights') return [
    S('Underglow', 'neon', [['off', 'Off'], ['#2ee6d6', 'Cyan'], ['#ff3da8', 'Pink'], ['#3d7bff', 'Blue'], ['#9b5cff', 'Violet'], ['#3bff8a', 'Green'], ['#ff3b3b', 'Red'], ['#ffffff', 'White']]),
    P('Headlights', 'lightsOn', [[false, 'Off'], [true, 'On']]),
    P('Headlight color', 'headlight', [['white', 'White'], ['xenon', 'Xenon'], ['amber', 'Amber']]),
    P('Taillights', 'taillight', [['red', 'Red'], ['smoke', 'Smoked'], ['led', 'LED bar']]),
    P('Window tint', 'tint', [['none', 'None'], ['light', 'Light'], ['dark', 'Dark'], ['limo', 'Limo']])
  ];
  return [
    P('Engine', 'engine', [[0, 'Stock'], [1, 'Stage 1'], [2, 'Stage 2'], [3, 'Stage 3'], [4, 'Stage 4']]),
    P('Turbo', 'turbo', [['none', 'None'], ['small', 'Small'], ['big', 'Big']]),
    P('Blow-off sound', 'bov', [['off', 'Off'], ['soft', 'Soft whoosh'], ['flutter', 'Flutter']]),
    P('Nitro', 'nitro', [[0, 'None'], [1, '1 bottle'], [2, '2 bottles']]),
    P('Gearbox', 'gearbox', [['stock', 'Stock'], ['sport', 'Sport'], ['race', 'Race']]),
    P('Suspension', 'susp', [['stock', 'Stock'], ['sport', 'Sport'], ['stance', 'Stance']]),
    P('Tires', 'tires', [['street', 'Street'], ['sport', 'Sport'], ['slick', 'Slick']]),
    P('Brakes', 'brakes', [['stock', 'Stock · fade when hot'], ['sport', 'Sport · stronger'], ['ceramic', 'Carbon-ceramic · no fade']]),
    P('Final drive', 'finalDrive', [[3.5, '3.50 · top speed'], [3.8, '3.80'], [4.1, '4.10 · balanced'], [4.4, '4.40'], [4.7, '4.70 · launch']]),
    P('ECU map', 'ecu', [['low', 'Low-end torque'], ['balanced', 'Balanced'], ['high', 'High-rpm power']]),
    P('Nitro tune', 'nitroTune', [['long', 'Long and soft'], ['balanced', 'Balanced'], ['power', 'Short and hard']])
  ];
}

function stats(c) {
  const B = modelOf(c).base;
  const hp = B.hp + [0, 40, 90, 160, 300][c.engine] + ({ none: 0, small: 50, big: 110 })[c.turbo];
  const weight = B.weight + ({ stock: 0, wide: 25, over: 15 })[c.width] + ({ none: 0, lip: 2, duck: 4, roof: 3, gt: 12, swan: 11, tri: 15 })[c.spoiler] - (c.hood === 'carbon' || c.hood === 'vents' ? 12 : 0)
    + ({ stock: 0, sport: 6, carbon: 2, aero: 4 })[c.skirt] + ({ stock: 0, street: 2, sport: 4, aggr: 6, track: 9 })[c.fbumper] + ({ none: 0, scoop: 3, vortex: 1, louvers: 4 })[c.roof] + (c.turbo !== 'none' ? 15 : 0);
  const gear = ({ stock: 0, sport: 1, race: 2 })[c.gearbox], tire = ({ street: 0, sport: 1, slick: 2 })[c.tires];
  const t100 = 1.6 + 5.2 * Math.pow((weight / hp) / 6.944, 0.75) - [0, 0.15, 0.3][gear] - [0, 0.15, 0.35][tire] - [0, 0.3, 0.55][c.nitro];
  const vmax = topSpeed(c, hp, weight);
  const handling = Math.min(100, 40 + B.handling + ({ stock: 0, sport: 20, stance: 12 })[c.susp] + [0, 12, 22][tire] + ({ none: 0, lip: 2, duck: 5, roof: 3, gt: 12, swan: 14, tri: 15 })[c.spoiler] + ({ stock: 0, wide: 6, over: 5 })[c.width]
    + ({ stock: 0, street: 1, sport: 2, aggr: 3, track: 6 })[c.fbumper] + (c.rbumper === 'track' || c.rbumper === 'diff' ? 2 : 0) + (c.roof === 'vortex' ? 2 : 0) + ({ 17: 0, 18: 2, 19: 4, 20: 5 })[c.rimSize]);
  const braking = Math.min(100, 40 + ({ stock: 0, sport: 25, ceramic: 45 })[c.brakes] + [0, 8, 15][tire]);
  const cl = (v) => Math.max(3, Math.min(100, Math.round(v)));
  return { hp, weight, t100, vmax: Math.round(vmax), bars: [['Acceleration', cl((8 - t100) / 5.2 * 100)], ['Top speed', cl((vmax - 200) / 170 * 100)], ['Handling', handling], ['Braking', braking]] };
}

/* ================= textures ================= */
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function canvasTex(canvas, srgb = true) { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

const vinylCanvas = mkCanvas(2048, 1024);
const vinylTex = canvasTex(vinylCanvas);
const PXM = 2048 * 0.5 / 4.6;            // canvas px per metre along the car
const VX = (h, x) => (h * 0.5 + (x + 2.3) / 4.6 * 0.5) * 2048;
const VY = (y) => 1024 - y * 512;         // side: height above body floor
const VT = (f) => 0.28 * f * 1024;        // top: |z| / half-width
const SIDE_SHAPES = {
  flames: [[[2.3, 0.08], [2.3, 0.52], [1.45, 0.56], [1.05, 0.5], [0.75, 0.56], [0.35, 0.48], [0.05, 0.55], [-0.35, 0.44], [0.0, 0.4], [-0.55, 0.34], [-0.1, 0.3], [-0.75, 0.22], [0.1, 0.18], [0.45, 0.24], [0.6, 0.12], [1.0, 0.18], [1.3, 0.08]]],
  bolt: [[[2.3, 0.46], [0.85, 0.46], [0.55, 0.32], [-0.65, 0.32], [-0.95, 0.2], [-2.3, 0.2], [-2.3, 0.12], [-0.9, 0.12], [-0.6, 0.24], [0.6, 0.24], [0.9, 0.38], [2.3, 0.38]]],
  line: [[[2.3, 0.5], [-2.3, 0.5], [-2.3, 0.44], [2.3, 0.44]], [[2.3, 0.415], [-2.3, 0.415], [-2.3, 0.4], [2.3, 0.4]]],
  twotone: [[[2.4, -0.2], [2.4, 0.3], [-2.4, 0.3], [-2.4, -0.2]]],
  slash: [[-1.95, 0.85, 0.62], [-1.5, 1.05, 0.66], [-1.0, 1.2, 0.64], [-0.45, 0.95, 0.56], [0.05, 0.7, 0.46]].map(([x0, len, tp]) =>
    [[x0, 0.1], [x0 + 0.1, 0.1], [x0 + len * 0.5, tp * 0.55], [x0 + len * 0.62, tp * 0.5], [x0 + len + 0.07, tp], [x0 + len * 0.55 + 0.02, tp * 0.72], [x0 + len * 0.42, tp * 0.68], [x0 + len * 0.3, tp * 0.48]])
};
function drawVinyl() {
  const g = vinylCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = cfg.color; g.fillRect(0, 0, 2048, 1024);
  g.fillStyle = cfg.vinylColor;
  for (const h of [0, 1]) {
    let shapes = SIDE_SHAPES[cfg.vinyl] || [];
    if (cfg.vinyl === 'stripes') shapes = SIDE_SHAPES.line;
    for (const poly of shapes) { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(VX(h, x), VY(y)) : g.moveTo(VX(h, x), VY(y)))); g.closePath(); g.fill(); }
    if (cfg.vinyl === 'checker') for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) { const x0 = -2.3 + i * 0.13, y0 = 0.18 + j * 0.13; g.fillRect(VX(h, x0), VY(y0 + 0.13), 0.13 * PXM, 0.13 * 512); }
    if (cfg.vinyl === 'stripes') for (const [a, b] of [[0.78, 2.3], [-0.82, 0.02], [-2.3, -1.44]]) g.fillRect(VX(h, a), VT(0.1), (b - a) * PXM, VT(0.24) - VT(0.1));
    if (cfg.sticker) {
      g.save(); g.fillStyle = cfg.stickerColor;
      g.font = `italic 700 ${Math.round(0.17 * PXM)}px "Chakra Petch", "Arial Narrow", sans-serif`;
      g.textBaseline = 'alphabetic';
      if (h === 0) { g.translate(VX(0, -0.8 + (modelOf(cfg).decalX || 0)), VY(0.36)); g.scale(1, 512 / PXM); }
      else { g.translate(VX(1, 0.86), VY(0.36)); g.scale(-1, 512 / PXM); }
      g.fillText(cfg.sticker, 0, 0); g.restore();
    }
  }
  vinylTex.needsUpdate = true;
}

function carbonTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = ((i + (j >> 1)) % 2) ? '#22252c' : '#15171b'; g.fillRect(i * 8, j * 8, 8, 8); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(120, 60); return t;
}
const plateCanvas = mkCanvas(256, 64), plateTex = canvasTex(plateCanvas);
function drawPlate() {
  const g = plateCanvas.getContext('2d');
  g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#1b1c20'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#16171b'; g.font = 'italic 700 36px "Chakra Petch", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText((cfg.sticker || 'RAVEN RS').slice(0, 10), 128, 34); plateTex.needsUpdate = true;
}
function bannerTexture() {
  const c = mkCanvas(1024, 320), g = c.getContext('2d');
  g.fillStyle = '#12131b'; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#2a2c3c'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 304);
  // original raven-head mark
  g.fillStyle = '#b8bccb';
  g.beginPath(); g.moveTo(70, 250); g.lineTo(110, 120); g.lineTo(170, 80); g.lineTo(230, 92); g.lineTo(300, 128); g.lineTo(236, 134); g.lineTo(206, 150); g.lineTo(196, 182); g.lineTo(170, 240); g.lineTo(150, 214); g.lineTo(128, 262); g.lineTo(112, 226); g.closePath(); g.fill();
  g.fillStyle = '#e4e6ee'; g.beginPath(); g.moveTo(230, 92); g.lineTo(300, 128); g.lineTo(250, 120); g.closePath(); g.fill();
  g.fillStyle = '#12131b'; g.beginPath(); g.arc(196, 112, 9, 0, Math.PI * 2); g.fill();
  g.font = 'italic 700 150px "Chakra Petch", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
  g.fillStyle = '#d7d9e2'; g.fillText('RAVEN', 330, 172);
  const w = g.measureText('RAVEN ').width; g.fillStyle = '#ff3d5a'; g.fillText('RS', 330 + w, 172);
  return canvasTex(c);
}
function slatTexture() {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  for (let y = 0; y < 256; y += 16) { g.fillStyle = '#2a2d3b'; g.fillRect(0, y, 256, 13); g.fillStyle = '#12131a'; g.fillRect(0, y + 13, 256, 3); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); return t;
}
function concreteTexture() {
  const c = mkCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#1b1c25'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { const v = 22 + Math.random() * 18 | 0; g.fillStyle = `rgba(${v},${v},${v + 8},0.55)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  g.strokeStyle = '#13141b'; g.lineWidth = 3; for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
}
function puddleAlpha() {
  const c = mkCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(95,95,95,0.9)'); gr.addColorStop(1, 'rgba(205,205,205,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}

/* ================= renderer / scene ================= */
const $ = (id) => document.getElementById(id);
const canvas = document.getElementById('c'), stage = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('loading').textContent = 'This browser could not start 3D graphics (WebGL).';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
let dirty = true;
const invalidate = () => { dirty = true; };

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06060b');
scene.fog = new THREE.Fog('#06060b', 14, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 320);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 14;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.5;
controls.autoRotateSpeed = 0.9;
const setView = (az, el, d) => {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  camera.position.set(Math.sin(a) * Math.cos(e) * d, 0.55 + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
  camera.lookAt(controls.target);
};
setView(42, 9, 10.8);

/* ---- garage ---- */
const M = {
  wall: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.92, metalness: 0, envMapIntensity: 0.25, side: THREE.BackSide }),
  metal: new THREE.MeshStandardMaterial({ color: '#1a1c26', roughness: 0.55, metalness: 0.6 }),
  shelf: new THREE.MeshStandardMaterial({ color: '#23263a', roughness: 0.6, metalness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.9, flatShading: true }),
  neonPink: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3da8').multiplyScalar(2.2) }),
  neonCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6d6').multiplyScalar(1.9) }),
  neonBlue: new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a7dff').multiplyScalar(1.9) }),
  tubeWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe8ff').multiplyScalar(1.6) })
};
const garage = new THREE.Group(); scene.add(garage);
const room = new THREE.Mesh(new THREE.BoxGeometry(18, 6.5, 18), M.wall); room.position.y = 3.25; garage.add(room);
const box = (w, h, d, mat, x, y, z, parent = garage) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

// wet floor: mirror underneath, dark translucent concrete with puddles on top
const mirror = new Reflector(new THREE.PlaneGeometry(18, 18), { textureWidth: 1024, textureHeight: 1024, color: 0x8a8a96, multisample: 2 });
mirror.rotation.x = -Math.PI / 2; mirror.position.y = 0.002; garage.add(mirror);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.6, metalness: 0, envMapIntensity: 0.12, transparent: true, alphaMap: puddleAlpha() }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; garage.add(floor);

// back wall: banner + cyan tube + tool chest + shelf
const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
banner.position.set(0.8, 3.7, -8.95); garage.add(banner);
box(4.2, 0.05, 0.05, M.neonCyan, 0.8, 2.55, -8.9);
box(2.2, 1.15, 0.6, M.metal, 4.6, 0.58, -8.6);
for (let i = 0; i < 4; i++) box(2.0, 0.02, 0.02, M.shelf, 4.6, 0.25 + i * 0.26, -8.29);
box(0.18, 0.4, 0.18, M.shelf, 4.0, 1.35, -8.6); box(0.3, 0.22, 0.2, M.shelf, 4.5, 1.26, -8.6); box(0.12, 0.5, 0.12, M.neonBlue, 5.1, 1.4, -8.7);
// pink vertical neon in the corner
box(0.06, 4.8, 0.06, M.neonPink, 7.1, 2.6, -8.9);
// tire rack on the right wall
for (const y of [0.35, 1.45, 2.55]) box(0.6, 0.05, 3.2, M.shelf, 8.6, y, -5.6);
box(0.05, 3, 0.05, M.shelf, 8.3, 1.5, -7.2); box(0.05, 3, 0.05, M.shelf, 8.3, 1.5, -4.0);
for (const [y, z] of [[0.72, -6.6], [0.72, -5.6], [1.82, -6.6], [1.82, -4.6], [2.92, -6.1]]) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.12, 8, 18), M.rubber); t.position.set(8.6, y, z); t.rotation.y = Math.PI / 2; garage.add(t);
}
box(0.05, 0.05, 4, M.neonCyan, 8.95, 4.4, -2.5);
// roll-up door on the left wall + work light
const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.4), new THREE.MeshStandardMaterial({ map: slatTexture(), roughness: 0.6, metalness: 0.5 }));
door.position.set(-8.95, 2.2, -2.2); door.rotation.y = Math.PI / 2; garage.add(door);
box(0.1, 0.25, 5.4, M.shelf, -8.9, 4.5, -2.2);
box(0.06, 0.06, 3.4, M.tubeWhite, -8.85, 4.85, -2.2);
// front wall strip so a full orbit still reads as a garage
box(6, 0.05, 0.05, M.neonPink, 0, 4.2, 8.95);
box(0.05, 0.05, 4, M.neonBlue, -8.95, 0.6, 4.5);

const mirrorHide = garage.children.filter((o) => o.isMesh && o !== mirror && o !== banner && ![M.neonPink, M.neonCyan, M.neonBlue, M.tubeWhite].includes(o.material));
const mirrorDraw = mirror.onBeforeRender;
mirror.onBeforeRender = function (...a) { mirrorHide.forEach((o) => { o.visible = false; }); mirrorDraw.apply(this, a); mirrorHide.forEach((o) => { o.visible = true; }); };

/* ---- lights ---- */
garage.add(new THREE.HemisphereLight('#5560a8', '#0a0a12', 0.8));
const key = new THREE.SpotLight('#f1f3ff', 48, 0, 0.6, 0.8, 2);
key.position.set(0.6, 6.2, 1.8); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
garage.add(key, key.target);
const pinkL = new THREE.PointLight('#ff3da8', 26, 16, 1.6); pinkL.position.set(6.6, 2.6, -7.8); garage.add(pinkL);
const cyanL = new THREE.PointLight('#2ee6d6', 26, 14, 1.6); cyanL.position.set(0.8, 2.4, -8.0); garage.add(cyanL);
const doorL = new THREE.PointLight('#c9d6ff', 26, 16, 1.6); doorL.position.set(-8.2, 4.6, -2.2); garage.add(doorL);
const rimL = new THREE.PointLight('#7a5cff', 18, 14, 1.6); rimL.position.set(-3, 3, 6); garage.add(rimL);

// contact shadow + underglow (live in the car rig)
const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.9), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.006; shadowBlob.renderOrder = 2; scene.add(shadowBlob);
const glowMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.4), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.008; glow.renderOrder = 3; scene.add(glow);
const glowL = new THREE.PointLight('#9b5cff', 6, 4, 1.4); glowL.position.set(0, 0.12, 0); scene.add(glowL);
const beams = [1, -1].map((s) => { const l = new THREE.SpotLight('#ffffff', 0, 12, 0.5, 0.7, 1.6); l.position.set(2.2, 0.62, s * 0.55); l.target.position.set(7, 0, s * 1.2); scene.add(l, l.target); return l; });

/* ---- streets: Sunset Strip + Palm Coast ---- */
const RACE_LEN = 402.3;
function checkerTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#f1efe8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#16151c'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function finishTexture() {
  const c = mkCanvas(1024, 96), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#ffe2b8'; g.font = 'italic 700 64px "Chakra Petch", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FINISH  ·  1/4 MILE', 512, 50); return canvasTex(c);
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function skyTexture(stops) {
  const c = mkCanvas(8, 512), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512); return canvasTex(c);
}
function sunTexture(top, bottom) {
  const c = mkCanvas(256, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) g.fillRect(0, 150 + i * 15, 256, 2 + i * 1.5);
  return canvasTex(c);
}
function asphaltTexture() {
  const c = mkCanvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#25232d'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 5000; i++) { const v = 30 + rnd() * 26 | 0; g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`; g.fillRect(rnd() * 512, rnd() * 256, 2, 2); }
  g.fillStyle = '#d9d6cf'; g.fillRect(0, 14, 512, 5); g.fillRect(0, 237, 512, 5);
  g.fillStyle = '#ece8df'; g.fillRect(0, 125, 250, 6);
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function windowsTexture() {
  const c = mkCanvas(64, 128), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) for (let x = 4; x < 60; x += 10) if (rnd() < 0.42) { const w = rnd(); g.fillStyle = w < 0.5 ? '#ffb35c' : (w < 0.8 ? '#ff7ab8' : '#9fd8ff'); g.fillRect(x, y, 6, 6); }
  return canvasTex(c);
}
const plainAttrs = (list) => list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
let PALM = null;
function palmGeometries() {
  const trunk = [], leaves = [];
  const PH = 6.4, segs = 6; let prev = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, p = new THREE.Vector3(t * t * 1.0, t * PH, 0), len = p.distanceTo(prev);
    const geo = new THREE.CylinderGeometry(0.12 + (1 - t) * 0.07, 0.13 + (1 - t + 1 / segs) * 0.07, len * 1.05, 7);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()));
    const mid = p.clone().add(prev).multiplyScalar(0.5); geo.translate(mid.x, mid.y, mid.z); trunk.push(geo); prev = p;
  }
  const top = prev.clone();
  for (let k = 0; k < 3; k++) { const s = new THREE.SphereGeometry(0.12, 6, 4); s.translate(top.x + Math.cos(k * 2.1) * 0.17, top.y - 0.16, Math.sin(k * 2.1) * 0.17); trunk.push(s); }
  for (let k = 0; k < 10; k++) {
    const leaf = new THREE.PlaneGeometry(3.3, 0.85, 6, 1), pos = leaf.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 1.65, y = pos.getY(i), t = x / 3.3;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - t * 0.3);
      pos.setXYZ(i, x, -Math.pow(t, 1.7) * 1.6 + 0.35 * t + Math.abs(y) * 0.25, y * w);
    }
    leaf.computeVertexNormals();
    leaf.rotateZ(0.3 + (k % 2) * 0.22); leaf.rotateY(k * Math.PI * 2 / 10 + (k % 3) * 0.12); leaf.translate(top.x, top.y, top.z);
    leaves.push(leaf);
  }
  return { trunk: mergeGeometries(plainAttrs(trunk)), leaves: mergeGeometries(plainAttrs(leaves)) };
}
const PALM_MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: '#6a4a3c', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#2f6a45', roughness: 0.75, side: THREE.DoubleSide })
};
function instanced(geo, mat, list, group) {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, y, z, ry, sx, sy, sz, col], i) => { e.set(0, ry, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy ?? sx, sz ?? sx)); im.setMatrixAt(i, m); if (col) im.setColorAt(i, col); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere(); group.add(im); return im;
}
// split along the road into 60 m chunks so off-screen and fogged-out chunks are skipped
function instancedChunks(geo, mat, list, group, size = 60) {
  const buckets = new Map();
  for (const it of list) { const k = Math.floor(it[0] / size); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
  const chunks = group.userData.chunks || (group.userData.chunks = []);
  for (const [k, items] of buckets) { const im = instanced(geo, mat, items, group); im.userData.cx = (k + 0.5) * size; chunks.push(im); }
}
function addPalms(group, spots) {
  if (!PALM) PALM = palmGeometries();
  const list = spots.map(([x, z]) => [x, 0, z, rnd() * Math.PI * 2, 0.85 + rnd() * 0.35]);
  instancedChunks(PALM.trunk, PALM_MAT.trunk, list, group); instancedChunks(PALM.leaves, PALM_MAT.leaf, list, group);
}
function makeRain() {
  const N = 1400, seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seeds[i * 3] = (Math.random() - 0.5) * 70; seeds[i * 3 + 1] = Math.random() * 26; seeds[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#a8b8ff', transparent: true, opacity: 0.35, depthWrite: false }));
  lines.frustumCulled = false; lines.userData = { N, seeds, t: 0 };
  return lines;
}
function updateRain(r, dt) {
  const u = r.userData, a = r.geometry.attributes.position.array; u.t += dt;
  for (let i = 0; i < u.N; i++) {
    let y = (u.seeds[i * 3 + 1] - u.t * 24) % 26; if (y < 0) y += 26;
    const x = u.seeds[i * 3] - (26 - y) * 0.08, z = u.seeds[i * 3 + 2], j = i * 6;
    a[j] = x; a[j + 1] = y; a[j + 2] = z; a[j + 3] = x + 0.05; a[j + 4] = y + 0.55; a[j + 5] = z;
  }
  r.geometry.attributes.position.needsUpdate = true;
  r.position.set(camera.position.x, 0, camera.position.z);
}

function buildStreet(kind) {
  const coast = kind === 'coast', rain = kind === 'rain';
  seed = coast ? 11 : rain ? 23 : 7;
  const P = rain
    ? { sky: [[0, '#04050c'], [0.3, '#0a0f2a'], [0.44, '#1d1a48'], [0.5, '#2e2462'], [0.515, '#0a0914'], [1, '#04040a']], sunTop: '#cfd8ff', sunBot: '#7f8fff', sunDir: new THREE.Vector3(-0.5, 0.35, -0.8).normalize(), light: '#9fb4ff', hemiSky: '#4a5aa8', hemiGround: '#0a0a14', fog: '#0b0e1f', road: 16, accent: '#5fb8ff', ink: '#00101d' }
    : coast
    ? { sky: [[0, '#26103f'], [0.26, '#6e1f6b'], [0.41, '#f0466d'], [0.47, '#ff8f52'], [0.5, '#ffd27a'], [0.515, '#3b1d4f'], [1, '#120a1c']], sunTop: '#fff3a6', sunBot: '#ff4f7b', sunDir: new THREE.Vector3(-0.6, 0.025, -0.8).normalize(), light: '#ff9e6b', hemiSky: '#ff9fb0', hemiGround: '#2a1840', fog: '#9c3c6c', road: 11, accent: '#ff5fa8', ink: '#1d0010' }
    : { sky: [[0, '#1c1446'], [0.28, '#5a2a7a'], [0.41, '#e8507a'], [0.47, '#ff8a4c'], [0.5, '#ffc46b'], [0.515, '#2b1a3d'], [1, '#120b1a']], sunTop: '#ffe58a', sunBot: '#ff6a5a', sunDir: new THREE.Vector3(-0.9, 0.05, -0.42).normalize(), light: '#ffb070', hemiSky: '#ffb3a0', hemiGround: '#2a1a3a', fog: '#b05676', road: 16, accent: '#ffb547', ink: '#1d0f00' };
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const far = new THREE.Group(); group.add(far); // sky, sun and hills travel with the camera
  const sky = skyTexture(P.sky);
  far.add(new THREE.Mesh(new THREE.SphereGeometry(230, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: sunTexture(P.sunTop, P.sunBot), transparent: true, fog: false, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35) }));
  sun.position.copy(P.sunDir).multiplyScalar(210); sun.lookAt(0, 0, 0); if (!rain) far.add(sun);

  // ground + road
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), new THREE.MeshStandardMaterial({ color: coast ? '#2a1a33' : '#1f1628', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(200, -0.02, 0); group.add(ground);
  const at = asphaltTexture(); at.repeat.set(900 / 12, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(900, P.road), new THREE.MeshStandardMaterial({ map: at, roughness: rain ? 0.14 : 0.55, metalness: rain ? 0.45 : 0.05, envMapIntensity: rain ? 1.7 : 0.75 }));
  road.rotation.x = -Math.PI / 2; road.position.set(200, 0.001, 0); road.receiveShadow = true; group.add(road);
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, P.road), new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.6 }));
  startLine.rotation.x = -Math.PI / 2; startLine.position.set(0, 0.004, 0); group.add(startLine);
  const ct = checkerTexture(); ct.repeat.set(4, P.road * 2);
  const finLine = new THREE.Mesh(new THREE.PlaneGeometry(2, P.road), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6 }));
  finLine.rotation.x = -Math.PI / 2; finLine.position.set(RACE_LEN + 1, 0.004, 0); group.add(finLine);
  const gm = new THREE.MeshStandardMaterial({ color: '#22202a', roughness: 0.5, metalness: 0.6 });
  for (const s of [1, -1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.2, 0.3), gm); post.position.set(RACE_LEN, 3.1, s * (P.road / 2 + 0.5)); group.add(post); }
  const gBeam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, P.road + 1.4), gm); gBeam.position.set(RACE_LEN, 5.7, 0); group.add(gBeam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(P.road, 0.9), new THREE.MeshBasicMaterial({ map: finishTexture(), color: new THREE.Color(1.4, 1.4, 1.4) }));
  sign.rotation.y = -Math.PI / 2; sign.position.set(RACE_LEN - 0.22, 5.7, 0); group.add(sign);
  const walk = new THREE.MeshStandardMaterial({ color: '#4a3a55', roughness: 0.9 });
  for (const s of coast ? [1] : [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(900, 0.16, 4), walk); b.position.set(200, 0.08, s * (P.road / 2 + 2)); b.receiveShadow = true; group.add(b); }

  // far hills catch the haze
  const hillMat = new THREE.MeshStandardMaterial({ color: '#3a2150', roughness: 1, flatShading: true });
  const hills = [];
  for (let i = 0; i < 14; i++) {
    const a = (coast ? 1.35 : -2.6) + (i - 7) * 0.13 + rnd() * 0.05, r = 170 + rnd() * 30;
    hills.push([Math.cos(a) * r, 0, Math.sin(a) * r, rnd() * 3, 18 + rnd() * 22, 14 + rnd() * 22, 18 + rnd() * 22]);
  }
  instanced(new THREE.ConeGeometry(1, 1, 6), hillMat, hills, far);

  if (!coast) {
    // city blocks with lit windows
    const bm = new THREE.MeshStandardMaterial({ color: '#251a36', roughness: 0.85, emissive: '#ffffff', emissiveMap: windowsTexture(), emissiveIntensity: rain ? 1.5 : 0.85 });
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
    const blocks = [];
    for (const s of [1, -1]) for (let x = -190; x < 660; x += 9 + rnd() * 6) {
      if (x > -46 && x < 30) continue;
      const w = 7 + rnd() * 6, d = 6 + rnd() * 6, h = 6 + rnd() * 22;
      blocks.push([x, 0, s * (P.road / 2 + 4.5 + d / 2 + rnd() * 2), 0, w, h, d]);
    }
    instancedChunks(bg, bm, blocks, group);
    if (rain) { // neon signs on the buildings, mirrored in the wet road
      const cols = ['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff'].map((c) => new THREE.Color(c).multiplyScalar(2.2));
      const signs = [];
      for (const s of [1, -1]) for (let x = -150; x < 640; x += 22 + rnd() * 10) if (x < -30 || x > 24) signs.push([x, 4 + rnd() * 6, s * (P.road / 2 + 4.4), s > 0 ? Math.PI : 0, 1.1, 3.2, 1, cols[Math.floor(rnd() * cols.length)]]);
      instancedChunks(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), signs, group);
    }
    // street lamps
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8); pole.translate(0, 2.6, 0);
    const head = new THREE.BoxGeometry(0.9, 0.12, 0.3); head.translate(-0.35, 5.2, 0);
    const lamps = [];
    for (const s of [1, -1]) for (let x = -170; x < 650; x += 22) if (Math.abs(x + (s > 0 ? 11 : 0)) > 12) lamps.push([x + (s > 0 ? 11 : 0), 0, s * (P.road / 2 + 0.9), s > 0 ? -Math.PI / 2 : Math.PI / 2, 1]);
    instancedChunks(pole, new THREE.MeshStandardMaterial({ color: '#2b2433', roughness: 0.5, metalness: 0.6 }), lamps, group);
    instancedChunks(head, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(rain ? 2.2 : 1.5) }), lamps, group);
    const palms = [];
    for (const s of [1, -1]) for (let x = -160; x < 650; x += 10) if (Math.abs(x) > 4) palms.push([x + rnd() * 2, s * (P.road / 2 + 2.3)]);
    addPalms(group, palms);
  } else {
    // beach, ocean and a guard rail on the sea side
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(900, 10), new THREE.MeshStandardMaterial({ color: '#c08068', roughness: 1 }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(200, -0.01, -(P.road / 2 + 5)); group.add(beach);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 420), new THREE.MeshStandardMaterial({ color: '#2e1c5c', roughness: 0.1, metalness: 0.55, envMapIntensity: 1.4 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(200, -0.25, -(P.road / 2 + 10 + 210)); group.add(sea);
    const metal = new THREE.MeshStandardMaterial({ color: '#a2a8b8', roughness: 0.35, metalness: 0.8 });
    const posts = []; for (let x = -180; x < 660; x += 3) posts.push([x, 0.35, -(P.road / 2 + 0.6), 0, 0.09, 0.7, 0.09]);
    instancedChunks(new THREE.BoxGeometry(1, 1, 1), metal, posts, group);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(860, 0.22, 0.06), metal); rail.position.set(240, 0.58, -(P.road / 2 + 0.66)); group.add(rail);
    const palms = [];
    for (let x = -170; x < 650; x += 6) palms.push([x + rnd() * 3, -(P.road / 2 + 2.5 + rnd() * 6)]);
    for (let x = -160; x < 650; x += 13) if (Math.abs(x) > 5) palms.push([x + rnd() * 2, P.road / 2 + 2.4]);
    addPalms(group, palms);
  }

  // warm low sun + violet fill
  group.add(new THREE.HemisphereLight(P.hemiSky, P.hemiGround, rain ? 0.75 : 1.15));
  const sunL = new THREE.DirectionalLight(P.light, rain ? 0.8 : 2.6);
  sunL.position.set(P.sunDir.x * 30, 7, P.sunDir.z * 30); sunL.target.position.set(0, 0, 0);
  sunL.shadow.mapSize.set(1024, 1024); sunL.shadow.bias = -0.0005; sunL.shadow.normalBias = 0.03;
  Object.assign(sunL.shadow.camera, { left: -6, right: 6, top: 4, bottom: -4, near: 1, far: 70 });
  group.add(sunL, sunL.target);
  const fill = new THREE.DirectionalLight('#6f63ff', 0.7); fill.position.set(6, 5, 8); group.add(fill);

  // reflections come from the same sky
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
  const sb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.sunBot).multiplyScalar(2.2) }));
  sb.position.copy(P.sunDir).multiplyScalar(9); if (!rain) es.add(sb);
  if (rain) for (let i = 0; i < 14; i++) { // neon blobs give the wet surfaces something to reflect
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45 + rnd() * 0.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff'][i % 4]).multiplyScalar(3.5) }));
    const a = rnd() * Math.PI * 2; b.position.set(Math.cos(a) * 8.5, 0.4 + rnd() * 2.6, Math.sin(a) * 8.5); es.add(b);
  }
  const env = pmrem.fromScene(es, 0.02).texture;
  let rainMesh = null; if (rain) { rainMesh = makeRain(); group.add(rainMesh); }
  return { group, far, env, rain: rainMesh, bg: new THREE.Color(P.fog), fog: new THREE.Fog(P.fog, rain ? 22 : 45, rain ? 150 : 210), exposure: rain ? 1.15 : 1.0, accent: P.accent, ink: P.ink, sun: sunL, sunDir: P.sunDir, sunBase: sunL.position.clone() };
}
const GARAGE_ENV = { group: garage, env: scene.environment, bg: new THREE.Color('#06060b'), fog: new THREE.Fog('#06060b', 14, 26), exposure: 1.05, accent: '#2ee6d6', ink: '#04110f', sun: key };
const ENVS = { garage: GARAGE_ENV };
const LOCS = [['garage', 'Neon Garage', 'Underground tuning bay with a wet, mirrored floor.'], ['strip', 'Sunset Strip', 'Palm-lined city boulevard at golden hour.'], ['coast', 'Palm Coast', 'Ocean road with the sun sinking into the sea.'], ['rain', 'Neon Rain', 'Wet city streets at midnight, neon in every puddle.']];
let loc = 'garage';
try { loc = localStorage.getItem('raven-rs-loc') || 'garage'; } catch (e) { /* storage unavailable */ }
if (!LOCS.some((l) => l[0] === loc)) loc = 'garage';
let qPref = 'auto';
try { qPref = localStorage.getItem('raven-rs-quality') || 'auto'; } catch (e) { /* storage unavailable */ }
if (!['auto', 'high', 'medium', 'low'].includes(qPref)) qPref = 'auto';
let qLevel = qPref === 'auto' ? 'high' : qPref;
function setLocation(id) {
  if (!ENVS[id]) ENVS[id] = buildStreet(id);
  const e = ENVS[id]; loc = id;
  for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === id;
  scene.environment = e.env; scene.background = e.bg; scene.fog = e.fog; renderer.toneMappingExposure = e.exposure;
  e.sun.castShadow = qLevel !== 'low';
  document.documentElement.style.setProperty('--accent', e.accent);
  document.documentElement.style.setProperty('--accent-ink', e.ink);
  document.getElementById('locName').textContent = LOCS.find((l) => l[0] === id)[1].toUpperCase();
  renderer.shadowMap.needsUpdate = true; invalidate();
  try { localStorage.setItem('raven-rs-loc', id); } catch (err) { /* storage unavailable */ }
}


/* ================= car materials ================= */
const CM = {
  paint: new THREE.MeshPhysicalMaterial({ map: vinylTex, side: THREE.DoubleSide, envMapIntensity: 0.75 }),
  hood: null,
  plain: new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, envMapIntensity: 0.75 }),
  carbon: new THREE.MeshPhysicalMaterial({ color: '#2a2d34', map: carbonTexture(), roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#1b2430', roughness: 0.08, metalness: 0.1, clearcoat: 0.4, transparent: true, side: THREE.DoubleSide, envMapIntensity: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.75, metalness: 0.1, side: THREE.DoubleSide }),
  well: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 1, side: THREE.DoubleSide }),
  interior: new THREE.MeshStandardMaterial({ color: '#0d0d12', roughness: 0.9, flatShading: true }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d6dae2', roughness: 0.15, metalness: 1, flatShading: true }),
  tire: new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.88 }),
  rim: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.85, flatShading: true, side: THREE.DoubleSide }),
  rimDark: new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  disc: new THREE.MeshStandardMaterial({ color: '#6b6f78', roughness: 0.45, metalness: 0.9, flatShading: true }),
  caliper: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3, flatShading: true }),
  plate: new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }),
  head: new THREE.MeshStandardMaterial({ color: '#0d0f14', emissive: '#ffffff', flatShading: true }),
  tail: new THREE.MeshStandardMaterial({ color: '#2a0508', emissive: '#ff2b3a', flatShading: true }),
  fog: new THREE.MeshStandardMaterial({ color: '#0d0f14', emissive: '#f4f8ff', flatShading: true }),
  housing: new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.3, metalness: 0.6, flatShading: true }),
  hook: new THREE.MeshStandardMaterial({ color: '#e0262f', roughness: 0.4, metalness: 0.3, flatShading: true })
};
CM.hood = CM.paint;
function updateMaterials() {
  const p = CM.paint, f = cfg.finish;
  const set = (o) => Object.assign(p, { metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, iridescence: 0, ...o });
  if (f === 'gloss') set({});
  if (f === 'metal') set({ metalness: 0.85, roughness: 0.34, clearcoatRoughness: 0.08 });
  if (f === 'mat') set({ metalness: 0.1, roughness: 0.82, clearcoat: 0 });
  if (f === 'pearl') set({ metalness: 0.25, roughness: 0.3, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffffff') });
  if (f === 'chameleon') set({ metalness: 0.62, roughness: 0.3, iridescence: 0.9, iridescenceIOR: 1.9, iridescenceThicknessRange: [250, 820], sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(cfg.color2) });
  p.needsUpdate = true;
  for (const k of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'iridescence', 'iridescenceIOR']) CM.plain[k] = p[k];
  CM.plain.sheenColor.copy(p.sheenColor); CM.plain.iridescenceThicknessRange = p.iridescenceThicknessRange.slice(); CM.plain.color.set(cfg.color); CM.plain.needsUpdate = true;
  CM.glass.opacity = ({ none: 0.42, light: 0.62, dark: 0.82, limo: 0.95 })[cfg.tint];
  CM.rim.color.set(cfg.rimColor);
  if (customCar) applyCustomPaint();
  CM.caliper.color.set(cfg.caliper);
  const hc = ({ white: '#eef3ff', xenon: '#9cc8ff', amber: '#ffc44d' })[cfg.headlight];
  CM.head.emissive.set(hc); CM.head.emissiveIntensity = cfg.lightsOn ? 2.4 : 0.35;
  CM.fog.emissiveIntensity = cfg.lightsOn ? 2 : 0.25;
  const tc = ({ red: '#ff2b3a', smoke: '#b3121f', led: '#ff3355' })[cfg.taillight];
  CM.tail.emissive.set(tc); CM.tail.color.set(cfg.taillight === 'smoke' ? '#120204' : '#2a0508'); CM.tail.emissiveIntensity = cfg.lightsOn ? (cfg.taillight === 'smoke' ? 1.6 : 2.4) : 0.6;
  beams.forEach((b) => { b.color.set(hc); b.intensity = 9; b.visible = cfg.lightsOn; });
  const on = cfg.neon !== 'off';
  glow.visible = on; glowL.visible = on;
  if (on) { glowMat.color.set(cfg.neon).multiplyScalar(0.8); glowL.color.set(cfg.neon); }
  drawVinyl(); drawPlate(); invalidate();
}

/* ================= car geometry ================= */
const lerpPts = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
const TOP = [[-2.25, 0.5], [-2.17, 0.66], [-1.95, 0.72], [-1.45, 0.72], [0.8, 0.68], [1.55, 0.6], [2.1, 0.5], [2.25, 0.36]];
const BOT = [[-2.25, 0.24], [-2.15, 0.07], [-1.95, 0.02], [1.95, 0.02], [2.15, 0.06], [2.25, 0.12]];
const ROOF = [[-1.48, 0.73], [-0.8, 1.13], [0.0, 1.1], [0.82, 0.69]];
const R = 0.33, XF = 1.4, XR = -1.36, CLR0 = 0.17;

class Buckets {
  constructor() { this.b = {}; }
  vert(k, p, uv) {
    const q = (n) => Math.round(n * 1e4) || 0;
    const pk = q(p[0]) + ',' + q(p[1]) + ',' + q(p[2]), key = pk + '|' + q(uv[0]) + ',' + q(uv[1]);
    let i = k.map.get(key);
    if (i === undefined) { i = k.pk.length; k.p.push(p[0], p[1], p[2]); k.u.push(uv[0], uv[1]); k.pk.push(pk); k.map.set(key, i); }
    return i;
  }
  tri(name, a, b, c, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
    const k = this.b[name] || (this.b[name] = { p: [], u: [], i: [], pk: [], map: new Map() });
    k.i.push(this.vert(k, a, ua), this.vert(k, b, ub), this.vert(k, c, uc));
  }
  quad(name, a, b, c, d, ua, ub, uc, ud) { this.tri(name, a, b, c, ua, ub, uc); this.tri(name, a, c, d, ua, uc, ud); }
  meshes(mats) {
    const out = [];
    for (const [name, k] of Object.entries(this.b)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(k.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(k.u, 2));
      g.setIndex(k.i);
      g.computeVertexNormals();
      // smooth across UV seams: vertices at the same spot share one normal
      const n = g.attributes.normal, same = new Map();
      k.pk.forEach((key, i) => { if (!same.has(key)) same.set(key, []); same.get(key).push(i); });
      for (const ids of same.values()) if (ids.length > 1) {
        let x = 0, y = 0, z = 0; for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
        const l = Math.hypot(x, y, z) || 1; for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
      }
      // degenerate slivers leave zero normals, which turn into NaN in the shader
      for (let i = 0; i < n.count; i++) if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < 1e-6) n.setXYZ(i, 0, 1, 0);
      const m = new THREE.Mesh(g, mats[name]); m.castShadow = true; m.receiveShadow = true; out.push(m);
    }
    return out;
  }
}

/* ---- car models ----
   Four bodies from one lofter. Each model gives its side profile (TOP body line, BOT sill line,
   ROOF greenhouse), wheel positions, plan taper and where its parts sit. Bumpers and wings are
   authored once in Raven RS coordinates and mapped onto each model's nose and tail; the Raven
   keeps its original numbers exactly. */
const CAR_MODELS = {
  raven: {
    L: 2.25, R: 0.33, XF: 1.4, XR: -1.36, W: 0.9, clrAdj: 0, TOP, BOT, ROOF,
    planF: [1.55, 0.7, 0.2], planR: [1.55, 0.7, 0.2], tumble: [0.42, 0.22], haunch: 0, cabTaper: 0.3,
    cab: [0.82, -1.48], wind: 0.0, rearGlass: [-1.49, -0.79], side: [-1.32, 0.6], pillars: [[-0.41, -0.29]],
    hoodZones: [[0.8, 2.12]], hoodShift: 0, hoodSlope: [0.8, 1.55], hz: 1, us: 1, vs: 1,
    fys: 1, zf: 1, zr: 1, exY: 0.11, plateY: 0.33,
    mir: { x: 0.6, hx: 0.55, y: 0.75, dy: 0 }, doors: [0.84, -0.33], seamY: 0.38, seamH: 0.5, handle: [0.5, 0.56],
    ventX: 0.98, ventY: 0.4, wiper: 0.74, wiperZ: 0.24, antenna: [-1.0, -0.35],
    inX: -0.35, inLen: 1.7, inW: 1.1, inY: 0.66, seatX: -0.5, seatY: 0.84, headX: -0.55, headY: 1.03, seatZ: 0.31,
    skirt: [2.0, 0.02, [-0.8, 0.84]], wz: 1, wy: 1, deck: null, roofSp: [-0.9, -0.82], roofMid: -0.25, roofRearX: -0.72, louver: [-0.83, 0.6, 0.25], rz: 1,
    base: { hp: 180, weight: 1250, vmax: 0, handling: 0, redline: 7600, bias: 0, cda: 0, grip: 1 },
    lights(A, s) {
      const { add, bx, clr, c } = A, nose = Math.atan2(0.14, -0.15);
      // headlights: housing, lens, LED brow
      add(bx(0.2, 0.025, 0.34), CM.housing, 2.172, clr + 0.437, s * 0.56, 0, 0, nose);
      add(bx(0.13, 0.03, 0.12), CM.head, 2.168, clr + 0.44, s * 0.48, 0, 0, nose);
      add(bx(0.11, 0.03, 0.1), CM.head, 2.175, clr + 0.432, s * 0.64, 0, 0, nose);
      add(bx(0.02, 0.03, 0.3), CM.head, 2.12, clr + 0.495, s * 0.56, 0, 0, nose);
      // taillights
      if (c.taillight === 'led') add(bx(0.03, 0.035, 0.62), CM.tail, -2.255, clr + 0.44, s * 0.36);
      else { add(bx(0.03, 0.1, 0.36), CM.tail, -2.255, clr + 0.42, s * 0.5); add(bx(0.034, 0.03, 0.3), CM.housing, -2.256, clr + 0.42, s * 0.5); }
    }
  },
  ember: {
    L: 1.975, R: 0.31, XF: 1.25, XR: -1.28, W: 0.86, clrAdj: 0,
    TOP: [[-1.975, 0.44], [-1.95, 0.7], [-1.9, 0.79], [-1.5, 0.8], [0.85, 0.75], [1.35, 0.67], [1.8, 0.56], [1.92, 0.48], [1.975, 0.38]],
    BOT: [[-1.975, 0.26], [-1.88, 0.08], [-1.68, 0.02], [1.65, 0.02], [1.88, 0.07], [1.975, 0.14]],
    ROOF: [[-1.9, 0.79], [-1.8, 1.2], [-1.62, 1.3], [-0.3, 1.33], [0.15, 1.31], [0.85, 0.76]],
    planF: [1.45, 0.53, 0.13], planR: [1.6, 0.375, 0.08], tumble: [0.5, 0.18], haunch: 0.02, cabTaper: 0.26,
    cab: [0.85, -1.9], wind: 0.17, rearGlass: [-1.905, -1.75], side: [-1.55, 0.62], pillars: [[-0.66, -0.56]],
    hoodZones: [[0.88, 1.9]], hoodShift: -0.1, hoodSlope: [0.85, 1.6], hz: 0.95, us: 1.139, vs: 0.92,
    fys: 1, zf: 1.04, zr: 1.1, exY: 0.12, plateY: 0.36,
    mir: { x: 0.72, hx: 0.68, y: 0.95, dy: 0.07 }, doors: [0.82, -0.6], seamY: 0.42, seamH: 0.56, handle: [-0.42, 0.63],
    ventX: 0.83, ventY: 0.44, wiper: 0.78, wiperZ: 0.22, antenna: [-1.35, -0.3],
    inX: -0.45, inLen: 1.75, inW: 1.05, inY: 0.74, seatX: -0.55, seatY: 0.92, headX: -0.6, headY: 1.12, seatZ: 0.3,
    skirt: [1.76, -0.015, [-0.72, 0.7]], wz: 0.96, wy: 0.5, wp: 0.75, deck: [-1.75, -1.78, 0.8], roofSp: [-1.7, -1.62], roofMid: -0.6, roofRearX: -1.35, louver: [-1.02, 0.5, 0.06], rz: 0.95,
    base: { hp: 158, weight: 1030, vmax: -12, handling: 8, redline: 8000, bias: -0.04, cda: 0.05, grip: 1.02 },
    lights(A, s) {
      const { add, bx, cyl, clr, c } = A, face = Math.atan2(-0.1, 0.055);
      // slim lamps on the steep nose corners, round high beams on the front face
      add(bx(0.12, 0.03, 0.4), CM.housing, 1.953, clr + 0.432, s * 0.53, 0, 0, face);
      add(bx(0.1, 0.034, 0.3), CM.head, 1.955, clr + 0.433, s * 0.55, 0, 0, face);
      add(cyl(0.042, 0.03, 14), CM.head, 1.982, clr + 0.33, s * 0.55, 0, 0, Math.PI / 2);
      // tall taillights up the hatch corners
      const lean = -0.21;
      if (c.taillight === 'led') { add(bx(0.03, 0.03, 0.6), CM.tail, -1.94, clr + 0.73, s * 0.4, 0, 0, lean); add(bx(0.03, 0.2, 0.05), CM.tail, -1.952, clr + 0.6, s * 0.7, 0, 0, lean); }
      else { add(bx(0.034, 0.27, 0.12), CM.housing, -1.952, clr + 0.6, s * 0.69, 0, 0, lean); add(bx(0.03, 0.23, 0.08), CM.tail, -1.957, clr + 0.6, s * 0.69, 0, 0, lean); }
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 1.977;
      add(bx(0.03, 0.09, 0.82), CM.dark, x, clr + 0.27, 0);
      for (let i = -3; i <= 3; i++) add(bx(0.035, 0.09, 0.012), CM.housing, x + 0.002, clr + 0.27, i * 0.11);
      add(bx(0.03, 0.06, 1.02), CM.dark, x, clr + 0.18, 0);
    },
    extras(A) {
      const { add, bx, clr, c, M, roofY, hw, rel, cyA, Ra } = A;
      // roof lip over the hatch, with a high brake light
      if (!['roof', 'lip', 'duck'].includes(c.spoiler)) { add(bx(0.2, 0.03, 1.18), CM.plain, -1.71, roofY(-1.71) + 0.022, 0, 0, 0, -0.16); add(bx(0.03, 0.02, 0.32), CM.tail, -1.8, roofY(-1.8) + 0.012, 0, 0, 0, -0.16); }
      // boxy plastic arch flares on the stock body
      if (c.width === 'stock') for (const xw of [M.XF, M.XR]) for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
        const a0 = Math.PI * k / 7, a1 = Math.PI * (k + 1) / 7, am = (a0 + a1) / 2, r2 = Ra + 0.025;
        const px = xw + Math.cos(am) * r2, py = cyA + Math.sin(am) * r2;
        if (py < clr - 0.02) continue;
        add(bx(2 * r2 * Math.sin((a1 - a0) / 2) + 0.01, 0.05, 0.05), CM.dark, px, py, s * (hw(px, rel(py), 1) + 0.012), 0, 0, am + Math.PI / 2);
      }
    }
  },
  blackjaw: {
    L: 2.425, R: 0.345, XF: 1.55, XR: -1.42, W: 0.95, clrAdj: 0.01,
    TOP: [[-2.425, 0.52], [-2.38, 0.68], [-2.22, 0.76], [-1.6, 0.77], [0.35, 0.74], [1.3, 0.71], [2.2, 0.66], [2.36, 0.6], [2.425, 0.46]],
    BOT: [[-2.425, 0.28], [-2.33, 0.08], [-2.1, 0.02], [2.12, 0.02], [2.36, 0.08], [2.425, 0.18]],
    ROOF: [[-2.08, 0.77], [-1.6, 0.9], [-1.0, 1.12], [-0.68, 1.18], [-0.32, 1.17], [0.35, 0.75]],
    planF: [1.95, 0.475, 0.12], planR: [1.95, 0.475, 0.1], tumble: [0.5, 0.26], haunch: 0.055, cabTaper: 0.32,
    cab: [0.35, -2.08], wind: -0.3, rearGlass: [-1.72, -0.98], side: [-1.58, 0.22], pillars: [[-0.9, -0.78]],
    hoodZones: [[0.4, 2.36]], hoodShift: -0.12, hoodSlope: [0.35, 1.3], hz: 1.05, us: 0.928, vs: 0.96,
    fys: 1.1, zf: 1.16, zr: 1.19, exY: 0.14, plateY: 0.36,
    mir: { x: 0.2, hx: 0.15, y: 0.77, dy: 0.05 }, doors: [0.3, -0.85], seamY: 0.4, seamH: 0.52, handle: [-0.68, 0.6],
    ventX: 1.13, ventY: 0.42, wiper: 0.27, wiperZ: 0.26, antenna: [-1.05, -0.36],
    inX: -0.55, inLen: 1.75, inW: 1.15, inY: 0.66, seatX: -0.72, seatY: 0.84, headX: -0.77, headY: 1.03, seatZ: 0.33,
    skirt: [2.16, 0.065, [-0.85, 0.95]], wz: 1.05, wy: 1, deck: null, roofSp: [-0.9, -0.82], roofMid: -0.6, roofRearX: -0.78, louver: [-1.02, 0.62, 0.36], rz: 1.05,
    base: { hp: 225, weight: 1600, vmax: 4, handling: -8, redline: 6800, bias: 0.1, cda: 0.03, grip: 0.98 },
    lights(A, s) {
      const { add, bx, cyl, clr, c } = A;
      // twin round projectors under a slanted LED brow, set into the tall flat nose
      add(bx(0.03, 0.11, 0.44), CM.housing, 2.428, clr + 0.4, s * 0.6);
      add(bx(0.03, 0.026, 0.4), CM.head, 2.432, clr + 0.47, s * 0.6, s * 0.14, 0, 0);
      add(cyl(0.04, 0.03, 14), CM.head, 2.44, clr + 0.395, s * 0.49, 0, 0, Math.PI / 2);
      add(cyl(0.04, 0.03, 14), CM.head, 2.44, clr + 0.395, s * 0.71, 0, 0, Math.PI / 2);
      // three slanted bars per side: the claw
      add(bx(0.034, 0.13, 0.48), CM.housing, -2.43, clr + 0.45, s * 0.56);
      if (c.taillight === 'led') add(bx(0.03, 0.03, 0.44), CM.tail, -2.434, clr + 0.46, s * 0.56);
      else for (let k = 0; k < 3; k++) add(bx(0.03, 0.028, 0.16), CM.tail, -2.434, clr + 0.44 + k * 0.006, s * (0.42 + k * 0.13), s * 0.5, 0, 0);
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 2.427;
      add(bx(0.03, 0.17, 0.66), CM.dark, x, clr + 0.33, 0);
      for (let i = -2; i <= 2; i++) add(bx(0.035, 0.17, 0.016), CM.housing, x + 0.003, clr + 0.33, i * 0.12);
      add(bx(0.03, 0.05, 1.3), CM.dark, x, clr + 0.21, 0);
    },
    extras(A) {
      const { add, bx, cyl, c, yt, onSide } = A;
      const sl = Math.atan2(0.66 - 0.74, 2.2 - 0.35);
      if (c.hood === 'stock') { add(bx(1.5, 0.04, 0.5), CM.plain, 1.25, yt(1.25) + 0.02, 0, 0, 0, sl); add(bx(1.3, 0.03, 0.32), CM.plain, 1.2, yt(1.2) + 0.045, 0, 0, 0, sl); }
      for (const s of [1, -1]) add(cyl(0.022, 0.012, 12), CM.chrome, 2.08, yt(2.08) + 0.018, s * 0.55); // hood pins
      onSide(0.26, 0.06, 0.012, CM.well, -0.97, 0.62, 0.003, 0.1); // a scoop slot ahead of each rear haunch
    }
  },
  vanta: {
    L: 2.25, R: 0.33, XF: 1.38, XR: -1.42, W: 0.98, clrAdj: -0.04,
    TOP: [[-2.25, 0.46], [-2.2, 0.62], [-2.02, 0.7], [-1.1, 0.72], [-0.95, 0.7], [0.65, 0.63], [1.4, 0.64], [1.8, 0.5], [2.15, 0.3], [2.25, 0.2]],
    BOT: [[-2.25, 0.2], [-2.15, 0.06], [-1.95, 0.0], [1.95, 0.0], [2.18, 0.04], [2.25, 0.08]],
    ROOF: [[-1.08, 0.72], [-0.7, 0.93], [-0.4, 0.99], [-0.1, 0.97], [0.65, 0.64]],
    planF: [1.05, 1.2, 0.33], planR: [1.85, 0.4, 0.07], tumble: [0.32, 0.3], haunch: 0.04, cabTaper: 0.42,
    cab: [0.65, -1.08], wind: -0.12, rearGlass: [-1.0, -0.74], side: [-0.76, 0.5], pillars: [],
    hoodZones: [[0.75, 2.15], [-2.02, -1.12]], hoodShift: -2.82, hoodSlope: [-2.0, -1.2], hz: 0.95, us: 1, vs: 1.15,
    fys: 0.6, zf: 0.91, zr: 1.27, exY: 0.15, plateY: 0.36,
    mir: { x: 0.47, hx: 0.42, y: 0.63, dy: -0.12 }, doors: [0.6, -0.62], seamY: 0.34, seamH: 0.44, handle: [-0.48, 0.5],
    ventX: 0.96, ventY: 0.32, wiper: 0.58, wiperZ: 0.16, antenna: null,
    inX: -0.22, inLen: 1.4, inW: 1.05, inY: 0.48, seatX: -0.42, seatY: 0.66, headX: -0.47, headY: 0.84, seatZ: 0.3,
    decalX: 0.35, skirt: [2.0, -0.02, [-0.75, 0.7]], wz: 1.12, wy: 1, deck: null, roofSp: [-0.66, -0.58], roofMid: -0.42, roofRearX: -0.62, louver: [-0.76, 0.26, 0.55], rz: 0.85,
    base: { hp: 190, weight: 1180, vmax: 20, handling: 10, redline: 8300, bias: 0, cda: -0.1, grip: 1.06 },
    lights(A, s) {
      const { add, bx, clr, c } = A, ns = Math.atan2(0.3 - 0.5, 2.15 - 1.8);
      // two thin LED slits cut into the sloped nose
      add(bx(0.32, 0.012, 0.18), CM.housing, 1.96, clr + 0.418, s * 0.58, 0, s * 0.22, ns);
      add(bx(0.27, 0.02, 0.05), CM.head, 1.96, clr + 0.424, s * 0.62, 0, s * 0.22, ns);
      add(bx(0.16, 0.02, 0.04), CM.head, 2.0, clr + 0.4, s * 0.5, 0, s * 0.22, ns);
      // dashed taillights across the tail
      add(bx(0.034, 0.05, 0.56), CM.housing, -2.256, clr + 0.4, s * 0.62);
      if (c.taillight === 'led') add(bx(0.03, 0.028, 0.5), CM.tail, -2.258, clr + 0.4, s * 0.62);
      else for (let k = 0; k < 4; k++) add(bx(0.03, 0.03, 0.08), CM.tail, -2.258, clr + 0.4, s * (0.42 + k * 0.13));
    },
    stockFront(A) {
      const { add, bx, clr } = A, x = 2.252;
      for (const s of [1, -1]) add(bx(0.03, 0.06, 0.34), CM.dark, x, clr + 0.13, s * 0.4);
      add(bx(0.03, 0.04, 0.4), CM.dark, x, clr + 0.12, 0);
    },
    extras(A) {
      const { add, bx, clr, c, yt, onSide } = A;
      // intakes between the doors and the rear wheels, slatted, with a strake running back over the haunch
      onSide(0.36, 0.22, 0.012, CM.well, -0.83, 0.37, 0.003, -0.12);
      for (const y of [0.31, 0.37, 0.43]) onSide(0.33, 0.012, 0.016, CM.housing, -0.83 - (y - 0.37) * 0.12, y, 0.006);
      onSide(0.56, 0.03, 0.04, c.skirt === 'stock' ? CM.plain : CM.carbon, -0.9, 0.52, 0.012, -0.06);
      if (c.hood !== 'louvers' && c.hood !== 'vents') for (let k = 0; k < 6; k++) { const x = -1.3 - k * 0.11; add(bx(0.05, 0.012, 0.86), CM.well, x, yt(x) + 0.03, 0); }
      add(bx(0.03, 0.1, 1.28), CM.dark, -2.253, clr + 0.25, 0);
      for (let i = -5; i <= 5; i++) add(bx(0.034, 0.1, 0.01), CM.housing, -2.255, clr + 0.25, i * 0.11);
    }
  }
};
const modelOf = (c) => CAR_MODELS[baseOf(c.model)] || CAR_MODELS.raven;
const modelName = (id) => (MODEL_LIST.find((m) => m[0] === id) || MODEL_LIST[0])[1];

function buildCar(c) {
  const car = new THREE.Group();
  const M = modelOf(c), W = M.W, amp = c.width === 'wide' ? 0.11 : 0.03, XF = M.XF, XR = M.XR, RW = M.R;
  const clr = ({ stock: 0.17, sport: 0.12, stance: 0.06 })[c.susp] + M.clrAdj, clr0 = 0.17 + M.clrAdj;
  const Ra = RW + 0.05 + (c.width !== 'stock' ? 0.02 : 0);
  const cyA = RW + (clr - clr0);
  const plan = (x) => { const [p0, pl, pk] = x >= 0 ? M.planF : M.planR, a = Math.abs(x); return a < p0 ? 1 : 1 - pk * Math.pow((a - p0) / pl, 2); };
  const bulge = (x) => amp * (Math.exp(-Math.pow((x - XF) / 0.55, 2)) + Math.exp(-Math.pow((x - XR) / 0.55, 2))) + M.haunch * Math.exp(-Math.pow((x - XR) / 0.7, 2));
  const hw = (x, yRel, kb) => W * plan(x) + bulge(x) * kb - Math.max(0, yRel - M.tumble[0]) * M.tumble[1];
  const yt = (x) => lerpPts(M.TOP, x) + clr;
  const ybBase = (x) => lerpPts(M.BOT, x) + clr;
  const archTop = (x) => { let m = -1; for (const xw of [XF, XR]) { const d = x - xw; if (Math.abs(d) < Ra) m = Math.max(m, cyA + Math.sqrt(Ra * Ra - d * d)); } return m; };
  const yb = (x) => Math.max(ybBase(x), archTop(x));
  const rel = (y) => y - clr;
  const B = new Buckets();

  // ---- body loft ----
  const sec = (x) => {
    const t = yt(x), b = yb(x), h = t - b;
    const Y = [b, b, b + Math.min(0.06, h * 0.2), b + h * 0.38, b + h * 0.62, b + h * 0.84, t - 0.03, t - 0.004, t + 0.02, t + 0.028];
    const ws = hw(x, rel(Y[6]), 0.4);
    const Z = [0, hw(x, rel(b), 1) * 0.86, hw(x, rel(Y[2]), 1) * 0.985, hw(x, rel(Y[3]), 1), hw(x, rel(Y[4]), 0.9) * 0.998, hw(x, rel(Y[5]), 0.7) * 0.985, ws * 0.955, ws * 0.86, hw(x, rel(t), 0.2) * 0.5, 0];
    const wref = ws * 0.955 / 0.95;
    return Y.map((y, j) => ({ z: Z[j], y, v: j <= 5 ? Math.max(0, rel(y)) * 0.5 * M.vs : 0.72 + 0.28 * (1 - Math.min(1, Z[j] / wref)) }));
  };
  const xs = []; for (let x = -M.L; x <= M.L + 1e-4; x += 0.05) xs.push(+x.toFixed(3));
  const secs = xs.map(sec);
  // vinyl U: every body is stretched onto the same 4.6 m canvas, so patterns and decals fit each length
  const U = (h, x) => h * 0.5 + (x * M.us + 2.3) / 4.6 * 0.5;
  const inHood = (x0, x1) => M.hoodZones.some(([a, b]) => x0 >= a && x1 <= b);
  for (const s of [1, -1]) {
    const h = s > 0 ? 0 : 1;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], A = secs[i], Bs = secs[i + 1];
      for (let j = 0; j < A.length - 1; j++) {
        const name = j === 0 ? 'dark' : (j >= 6 && inHood(x0, x1) ? 'hood' : 'paint');
        B.quad(name,
          [x0, A[j].y, s * A[j].z], [x1, Bs[j].y, s * Bs[j].z], [x1, Bs[j + 1].y, s * Bs[j + 1].z], [x0, A[j + 1].y, s * A[j + 1].z],
          [U(h, x0), A[j].v], [U(h, x1), Bs[j].v], [U(h, x1), Bs[j + 1].v], [U(h, x0), A[j + 1].v]);
      }
    }
  }
  for (const [x, S] of [[xs[0], secs[0]], [xs[xs.length - 1], secs[secs.length - 1]]]) { // end caps
    const cy = (S[0].y + S[S.length - 1].y) / 2, ring = S.map((p) => [x, p.y, p.z]).concat(S.slice().reverse().map((p) => [x, p.y, -p.z]));
    for (let k = 0; k < ring.length - 1; k++) B.tri('cap', [x, cy, 0], ring[k], ring[k + 1], [0.002, 0.5], [0.002, 0.5], [0.002, 0.5]);
  }
  // wheel wells
  for (const xw of [XF, XR]) {
    const zw = W + bulge(xw) - 0.02;
    for (let k = 0; k < 16; k++) {
      const a0 = Math.PI * k / 16, a1 = Math.PI * (k + 1) / 16;
      const p = (a, z) => [xw + Math.cos(a) * Ra, cyA + Math.sin(a) * Ra, z];
      B.quad('well', p(a0, zw), p(a1, zw), p(a1, -zw), p(a0, -zw));
    }
  }

  // ---- cabin loft ----
  const csec = (x) => {
    const yB = yt(x) - 0.004, yR = lerpPts(M.ROOF, x) + clr, hg = Math.max(0.001, yR - yB);
    const wb = hw(x, rel(yB), 0.2) - 0.07, wt = wb - hg * M.cabTaper, wr = (wt - 0.045) / 0.95;
    return [[wb, yB], [wt, yR - Math.min(0.07, hg * 0.35)], [wt - 0.045, yR - 0.012], [(wt - 0.07) * 0.55, yR + 0.008], [0, yR + 0.012]]
      .map(([z, y], j) => ({ z, y, hg, v: j <= 1 ? rel(y) * 0.5 * M.vs : 0.72 + 0.28 * (1 - Math.min(1, z / wr)) }));
  };
  const cx = []; for (let x = M.cab[0]; x >= M.cab[1] - 1e-4; x -= 0.05) cx.push(+x.toFixed(3));
  const cs = cx.map(csec);
  const sideGlass = (x0, x1, hg) => x1 > M.side[0] && x0 < M.side[1] && !M.pillars.some(([a, b]) => x0 < b && x1 > a) && hg > 0.12;
  for (const s of [1, -1]) {
    const h = s > 0 ? 0 : 1;
    for (let i = 0; i < cx.length - 1; i++) {
      const xa = cx[i], xb = cx[i + 1], A = cs[i], Bs = cs[i + 1];
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      for (let j = 0; j < A.length - 1; j++) {
        let name = 'paint';
        if (j === 0 && sideGlass(lo, hi, Math.min(A[0].hg, Bs[0].hg))) name = 'glass';
        if (j >= 2 && (lo >= M.wind || (lo >= M.rearGlass[0] && hi <= M.rearGlass[1]))) name = 'glass';
        B.quad(name,
          [xa, A[j].y, s * A[j].z], [xb, Bs[j].y, s * Bs[j].z], [xb, Bs[j + 1].y, s * Bs[j + 1].z], [xa, A[j + 1].y, s * A[j + 1].z],
          [U(h, xa), A[j].v], [U(h, xb), Bs[j].v], [U(h, xb), Bs[j + 1].v], [U(h, xa), A[j + 1].v]);
      }
    }
  }
  B.meshes({ paint: CM.paint, cap: CM.paint, hood: c.hood === 'carbon' || c.hood === 'vents' ? CM.carbon : CM.paint, dark: CM.dark, well: CM.well, glass: CM.glass }).forEach((m) => car.add(m));

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = car) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, len, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg);
  const roofY = (x) => lerpPts(M.ROOF, x) + clr;
  const inCab = (x) => x <= M.cab[0] && x >= M.cab[1];
  const mountY = (x) => Math.max(yt(x), inCab(x) ? roofY(x) : -1); // a hatch carries its wing on the roof edge
  const onSide = (w, h, t, mat, x, y, out, rz = 0) => { // a flat panel laid on both flanks, following the plan taper and tumblehome
    const slope = (hw(x - w / 2, y, 1) - hw(x + w / 2, y, 1)) / w, lean = (hw(x, y - h / 2, 1) - hw(x, y + h / 2, 1)) / h;
    for (const s of [1, -1]) add(bx(w, h, t), mat, x, clr + y, s * (hw(x, y, 1) + out), -s * Math.atan(lean), s * Math.atan(slope), rz);
  };
  const A = { add, bx, cyl, clr, c, M, yt, hw, rel, roofY, cyA, Ra, onSide };

  // interior silhouette behind the glass
  add(bx(M.inLen, 0.2, M.inW), CM.interior, M.inX, clr + M.inY, 0);
  for (const z of [M.seatZ, -M.seatZ]) { add(bx(0.1, 0.34, 0.4), CM.interior, M.seatX, clr + M.seatY, z, 0, 0, 0.16); add(bx(0.09, 0.1, 0.22), CM.interior, M.headX, clr + M.headY, z); }

  // ---- details ----
  const mo = M.mir.x - 0.6, md = M.mir.dy;
  for (const s of [1, -1]) {
    M.lights(A, s);
    // mirrors
    const mz = hw(M.mir.hx, M.mir.y, 0.2) + 0.02;
    if (c.mirrors === 'aero') { add(bx(0.1, 0.015, 0.14), CM.dark, 0.6 + mo, clr + 0.8 + md, s * (mz + 0.06)); add(bx(0.2, 0.055, 0.09), CM.plain, 0.6 + mo, clr + 0.85 + md, s * (mz + 0.15)); }
    else { add(bx(0.06, 0.03, 0.1), CM.dark, 0.6 + mo, clr + 0.79 + md, s * (mz + 0.03)); add(bx(0.14, 0.09, 0.16), CM.plain, 0.58 + mo, clr + 0.84 + md, s * (mz + 0.12)); }
    // fender vents behind the front wheel
    if (c.fenderVents) for (let k = 0; k < 3; k++) { const x = M.ventX - k * 0.045; add(bx(0.022, 0.15, 0.012), CM.well, x, clr + M.ventY, s * (hw(x, M.ventY, 1) + 0.004), 0, 0, -0.4); }
    // door seams + handle
    for (const x of M.doors) add(bx(0.012, M.seamH, 0.012), CM.dark, x, clr + M.seamY, s * (hw(x, M.seamY, 1) + 0.003));
    add(bx(0.13, 0.025, 0.02), CM.dark, M.handle[0], clr + M.handle[1], s * (hw(M.handle[0], M.handle[1], 1) + 0.006));
    // wipers
    add(bx(0.03, 0.012, 0.5), CM.dark, M.wiper, yt(M.wiper) + 0.02, s * M.wiperZ, 0, s * 0.15, 0);
  }
  if (M.antenna) add(cyl(0.006, 0.35, 6), CM.dark, M.antenna[0], lerpPts(M.ROOF, M.antenna[0]) + clr + 0.17, M.antenna[1], 0, 0, -0.35);
  add(bx(0.012, 0.11, 0.42), CM.plate, -M.L - 0.006, clr + M.plateY, 0);
  if (M.extras) M.extras(A);

  // front bumper: Raven coordinates mapped onto this model's nose
  const fx = (x) => x + (M.L - 2.25), fy = (y) => y * M.fys;
  const F = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(bx(w, h * M.fys, d * M.zf), mat, fx(x), clr + fy(y), z * M.zf, rx, ry, rz);
  const Fc = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(geo, mat, fx(x), clr + fy(y), z * M.zf, rx, ry, rz);
  if (c.fbumper === 'stock') { if (M.stockFront) M.stockFront(A); else { F(0.03, 0.1, 0.9, CM.dark, 2.252, 0.27, 0); F(0.03, 0.05, 0.6, CM.dark, 2.252, 0.17, 0); } }
  const fogs = (z, y) => { for (const s of [1, -1]) { Fc(cyl(0.048, 0.03, 14), CM.housing, 2.255, y, s * z, 0, 0, Math.PI / 2); Fc(cyl(0.034, 0.034, 14), CM.fog, 2.258, y, s * z, 0, 0, Math.PI / 2); } };
  if (c.fbumper === 'sport') {
    F(0.14, 0.09, 1.36, CM.plain, 2.19, 0.07, 0);
    F(0.26, 0.03, 1.5, CM.carbon, 2.2, 0.015, 0);
    F(0.03, 0.14, 0.62, CM.dark, 2.252, 0.24, 0);
    for (const s of [1, -1]) F(0.03, 0.1, 0.24, CM.dark, 2.262, 0.11, s * 0.52);
    fogs(0.52, 0.11);
  }
  if (c.fbumper === 'aggr') {
    F(0.2, 0.14, 1.42, CM.plain, 2.17, 0.05, 0);
    F(0.03, 0.22, 1.04, CM.dark, 2.262, 0.2, 0);
    for (let i = -2; i <= 2; i++) F(0.035, 0.22, 0.02, CM.housing, 2.266, 0.2, i * 0.2);
    F(0.46, 0.028, 1.72, CM.carbon, 2.2, -0.03, 0);
    for (const s of [1, -1]) { F(0.03, 0.12, 0.2, CM.dark, 2.27, 0.07, s * 0.6); F(0.18, 0.012, 0.12, CM.carbon, 2.22, 0.2, s * 0.74, 0, 0, -0.25); F(0.26, 0.012, 0.012, CM.dark, 2.12, 0.25, s * 0.35, 0, 0, 0.9); }
    fogs(0.6, 0.075);
  }
  if (c.fbumper === 'street') {
    F(0.12, 0.08, 1.38, CM.plain, 2.2, 0.07, 0);
    F(0.03, 0.12, 0.92, CM.dark, 2.252, 0.25, 0);
    for (let i = -4; i <= 4; i++) F(0.035, 0.12, 0.01, CM.housing, 2.256, 0.25, i * 0.1);
    F(0.24, 0.02, 1.46, CM.carbon, 2.22, 0.022, 0);
    for (const s of [1, -1]) F(0.16, 0.02, 0.3, CM.carbon, 2.2, 0.03, s * 0.62, 0, s * 0.35, 0);
  }
  if (c.fbumper === 'track') {
    F(0.24, 0.16, 1.46, CM.plain, 2.15, 0.05, 0);
    F(0.03, 0.24, 1.16, CM.dark, 2.274, 0.18, 0);
    for (let i = -3; i <= 3; i++) F(0.035, 0.24, 0.016, CM.carbon, 2.28, 0.18, i * 0.165);
    F(0.62, 0.03, 1.84, CM.carbon, 2.2, -0.04, 0);
    for (const s of [1, -1]) {
      Fc(cyl(0.008, 0.2, 6), CM.chrome, 2.36, 0.04, s * 0.42, 0, 0, -0.6);
      for (let k = 0; k < 2; k++) F(0.2, 0.012, 0.13, CM.carbon, 2.22 - k * 0.02, 0.14 + k * 0.09, s * 0.76, 0, 0, -0.28);
    }
    F(0.08, 0.03, 0.05, CM.hook, 2.32, 0.08, -0.38);
  }
  // rear bumper: Raven coordinates mapped onto this model's tail
  const rx = (x) => x - (M.L - 2.25);
  const Rr = (w, h, d, mat, x, y, z) => add(bx(w, h, d * M.zr), mat, rx(x), clr + y, z * M.zr);
  if (c.rbumper === 'stock') Rr(0.06, 0.05, 1.2, CM.dark, -2.2, 0.12, 0);
  if (c.rbumper === 'clean') { Rr(0.14, 0.17, 1.42, CM.plain, -2.18, 0.13, 0); Rr(0.16, 0.02, 1.3, CM.dark, -2.17, 0.04, 0); }
  if (['sport', 'diff', 'track'].includes(c.rbumper)) {
    const lvl = ({ sport: 0, diff: 1, track: 2 })[c.rbumper];
    const n = [4, 7, 9][lvl], w = [1.3, 1.5, 1.62][lvl], d = [0.26, 0.4, 0.55][lvl], fh = [0.08, 0.13, 0.18][lvl], y0 = [0.05, 0.03, 0.01][lvl];
    Rr(d, 0.045, w, CM.carbon, -2.1 - lvl * 0.03, y0, 0);
    for (let i = 0; i < n; i++) Rr(d - 0.02, fh, 0.012, CM.carbon, -2.11 - lvl * 0.03, y0 + fh / 2, -w / 2 + (i + 0.5) * w / n);
    if (lvl === 2) { Rr(0.03, 0.05, 0.12, CM.tail, -2.27, 0.22, 0); Rr(0.08, 0.03, 0.05, CM.hook, -2.29, 0.14, 0.36); }
  }
  const ex = ({ single: [0.55], dual: [-0.55, 0.55], quad: [-0.66, -0.48, 0.48, 0.66], center: [0] })[c.exhaust];
  const er = c.exhaust === 'center' ? 0.075 : 0.05;
  for (const z of ex) { add(cyl(er, 0.16, 16), CM.chrome, -M.L, clr + M.exY, z * M.zr, 0, 0, Math.PI / 2); add(cyl(er * 0.72, 0.162, 16), CM.well, -M.L, clr + M.exY, z * M.zr, 0, 0, Math.PI / 2); }

  // hood parts (on the Vanta GT they land on the engine cover)
  const hxm = (x) => x + M.hoodShift, hz = M.hz;
  const hoodSlope = Math.atan2(lerpPts(M.TOP, M.hoodSlope[1]) - lerpPts(M.TOP, M.hoodSlope[0]), M.hoodSlope[1] - M.hoodSlope[0]);
  if (c.hood === 'scoop') { add(bx(0.55, 0.08, 0.5 * hz), CM.plain, hxm(1.18), yt(hxm(1.18)) + 0.035, 0, 0, 0, hoodSlope); add(bx(0.02, 0.05, 0.42 * hz), CM.dark, hxm(1.455), yt(hxm(1.45)) + 0.045, 0); }
  if (c.hood === 'bulge') { add(bx(0.95, 0.05, 0.62 * hz), CM.plain, hxm(1.28), yt(hxm(1.28)) + 0.012, 0, 0, 0, hoodSlope); add(bx(0.7, 0.035, 0.42 * hz), CM.plain, hxm(1.22), yt(hxm(1.22)) + 0.045, 0, 0, 0, hoodSlope); }
  if (c.hood === 'louvers') for (const s of [1, -1]) for (let k = 0; k < 6; k++) { const x = hxm(1.05 + k * 0.11); add(bx(0.07, 0.02, 0.3 * hz), CM.well, x, yt(x) + 0.025, s * 0.36 * hz, 0, 0, hoodSlope + 0.35); }
  if (c.hood === 'vents') for (const s of [1, -1]) for (let k = 0; k < 4; k++) add(bx(0.05, 0.012, 0.24 * hz), CM.well, hxm(1.2 + k * 0.1), yt(hxm(1.2 + k * 0.1)) + 0.03, s * 0.42 * hz, 0, 0, hoodSlope);

  // skirts
  if (c.skirt !== 'stock') for (const s of [1, -1]) {
    const z = hw(0, 0.05, 1) + 0.0, [sl, sx, fins] = M.skirt;
    add(bx(sl, 0.1, 0.07), c.skirt === 'sport' ? CM.plain : CM.carbon, sx, clr + 0.04, s * z);
    if (c.skirt !== 'sport') add(bx(sl, 0.015, 0.12), CM.carbon, sx, clr - 0.01, s * (z + 0.02));
    if (c.skirt === 'aero') for (const x of fins) add(bx(0.16, 0.12, 0.012), CM.carbon, x, clr + 0.08, s * (z + 0.075));
  }
  // widebody rivets
  if (c.width === 'wide') for (const xw of [XF, XR]) for (const s of [1, -1]) for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.05 + k * 0.9 / 8), px = xw + Math.cos(a) * (Ra + 0.05), py = cyA + Math.sin(a) * (Ra + 0.05);
    if (py > yb(px) - 0.02 || py < clr) continue;
    add(new THREE.SphereGeometry(0.014, 6, 4), CM.chrome, px, py, s * (hw(px, rel(py), 1) + 0.004));
  }

  // overfenders: segmented bolt-on arches
  if (c.width === 'over') for (const xw of [XF, XR]) for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
    const a0 = Math.PI * k / 7, a1 = Math.PI * (k + 1) / 7, am = (a0 + a1) / 2, r2 = Ra + 0.045;
    const px = xw + Math.cos(am) * r2, py = cyA + Math.sin(am) * r2;
    if (py < clr - 0.02) continue;
    const z = hw(px, rel(py), 1) + 0.03;
    add(bx(2 * r2 * Math.sin((a1 - a0) / 2) + 0.012, 0.075, 0.11), CM.plain, px, py, s * z, 0, 0, am + Math.PI / 2);
    add(new THREE.SphereGeometry(0.014, 6, 4), CM.chrome, px + Math.cos(am) * 0.01, py + Math.sin(am) * 0.01, s * (z + 0.057));
  }

  // spoilers: Raven coordinates from the tail; a hatch mounts its wing on the roof edge on shorter stands
  const wing = c.wingColor === 'body' ? CM.plain : CM.carbon, wz = M.wz, wy = M.wy, wp = M.wp || 1;
  const foil = (chord, depth, th) => {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(chord * 0.44, th * 2.8, chord, th * 1.2); f.lineTo(chord, 0); f.quadraticCurveTo(chord * 0.5, th * 0.8, 0, -th); f.closePath();
    const g = new THREE.ExtrudeGeometry(f, { depth, bevelEnabled: false, curveSegments: 4 }); g.translate(-chord, 0, -depth / 2); return g;
  };
  const y0 = mountY(rx(-1.98));
  const lipX = M.deck ? M.deck[0] : rx(-2.08), duckX = M.deck ? M.deck[1] : rx(-2.03), dw = M.deck ? M.deck[2] : 1;
  if (c.spoiler === 'lip') add(bx(0.2, 0.035, 1.5 * wz * dw), CM.plain, lipX, mountY(lipX) + 0.02, 0, 0, 0, -0.18);
  if (c.spoiler === 'duck') add(bx(0.36, 0.08, 1.62 * wz * dw), CM.plain, duckX, mountY(duckX) + 0.04, 0, 0, 0, -0.22);
  if (c.spoiler === 'roof') add(bx(0.26, 0.03, 1.12 * M.rz), CM.plain, M.roofSp[0], roofY(M.roofSp[1]) + 0.0, 0, 0, 0, -0.12);
  if (c.spoiler === 'gt') {
    for (const s of [1, -1]) { add(bx(0.09, 0.36 * wy, 0.035), CM.dark, rx(-1.98), y0 + 0.18 * wy, s * 0.42 * wz, 0, 0, -0.12); add(bx(0.55 * wp, 0.26 * wp, 0.02), wing, rx(-2.1), y0 + 0.36 * wy, s * 0.92 * wz); }
    add(foil(0.5, 1.82 * wz, 0.025), wing, rx(-1.86), y0 + 0.38 * wy, 0, 0, 0, 0.08);
  }
  if (c.spoiler === 'swan') {
    for (const s of [1, -1]) {
      add(bx(0.05, 0.6 * wy, 0.03), CM.dark, rx(-1.93), y0 + 0.28 * wy, s * 0.4 * wz, 0, 0, -0.22);
      add(bx(0.2, 0.04, 0.03), CM.dark, rx(-2.04), y0 + 0.57 * wy, s * 0.4 * wz);
      add(bx(0.04, 0.08, 0.03), CM.dark, rx(-2.12), y0 + 0.53 * wy, s * 0.4 * wz);
      add(bx(0.6 * wp, 0.3 * wp, 0.02), wing, rx(-2.12), y0 + 0.46 * wy, s * 0.94 * wz);
    }
    add(foil(0.55, 1.86 * wz, 0.027), wing, rx(-1.86), y0 + 0.44 * wy, 0, 0, 0, 0.1);
  }
  if (c.spoiler === 'tri') {
    for (const s of [1, -1]) { add(bx(0.09, 0.4 * wy, 0.035), CM.dark, rx(-1.98), y0 + 0.2 * wy, s * 0.42 * wz, 0, 0, -0.12); add(bx(0.62 * wp, 0.36 * wp, 0.02), wing, rx(-2.13), y0 + 0.4 * wy, s * 0.91 * wz); }
    add(foil(0.5, 1.8 * wz, 0.024), wing, rx(-1.86), y0 + 0.36 * wy, 0, 0, 0, 0.05);
    add(foil(0.28, 1.8 * wz, 0.018), wing, rx(-2.28), y0 + 0.44 * wy, 0, 0, 0, 0.45);
  }
  // roof add-ons
  if (c.roof === 'scoop') { add(bx(0.5, 0.08, 0.34 * M.rz), CM.plain, M.roofMid, roofY(M.roofMid) + 0.05, 0); add(bx(0.02, 0.05, 0.28 * M.rz), CM.well, M.roofMid + 0.25, roofY(M.roofMid + 0.25) + 0.06, 0); }
  if (c.roof === 'vortex') for (let i = 0; i < 7; i++) { const z = (-0.45 + i * 0.15) * M.rz; add(bx(0.09, 0.05, 0.008), CM.dark, M.roofRearX, roofY(M.roofRearX) + 0.035, z, 0, z > 0 ? 0.25 : -0.25, 0); }
  if (c.roof === 'louvers') for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, x = M.louver[0] - t * M.louver[1]; add(bx(0.05, 0.012, (1.08 - t * 0.15) * M.rz), CM.dark, x, roofY(x) + 0.035, 0, 0, 0, M.louver[2]); }

  // wheels (kept separate so they can turn)
  const wheels = [];
  const zOut = (xw) => hw(xw, 0.3, 1) - (c.susp === 'stance' ? 0.005 : 0.04) + (c.width === 'over' ? 0.06 : 0);
  for (const xw of [XF, XR]) for (const s of [1, -1]) {
    const wg = buildWheel(c, xw > 0, RW);
    wg.position.set(xw, RW, s * (zOut(xw) - 0.12));
    if (s < 0) wg.rotation.y = Math.PI;
    wg.userData.side = s; wheels.push(wg);
  }
  return { car, clr, wheels, dims: { front: M.L, rear: -M.L, xf: XF, xr: XR, r: RW, exY: clr + M.exY, exZ: 0.55 * M.zr } };
}

function buildWheel(c, front, R = 0.33) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; g.add(m); return m; };
  const zc = (geo) => { geo.rotateX(Math.PI / 2); return geo; };
  const rr = R * ({ 17: 0.62, 18: 0.68, 19: 0.74, 20: 0.8 })[c.rimSize];
  // tire with rounded sidewalls (lathe), axis along z
  const prof = [[rr + 0.012, -0.12], [R - 0.035, -0.12], [R - 0.008, -0.1], [R, -0.06], [R, 0.06], [R - 0.008, 0.1], [R - 0.035, 0.12], [rr + 0.012, 0.12]].map(([r, a]) => new THREE.Vector2(r, a));
  add(zc(new THREE.LatheGeometry(prof, 30)), CM.tire, 0, 0, 0);
  const lip = c.rimStyle === 'deep' ? 0.22 : 0.06;
  add(zc(new THREE.CylinderGeometry(rr, rr, 0.22, 28, 1, true)), CM.rim, 0, 0, 0);
  add(new THREE.CircleGeometry(rr * 0.98, 28), CM.rimDark, 0, 0, -0.05);
  add(new THREE.RingGeometry(rr * (1 - lip), rr * 1.01, 28), c.rimStyle === 'deep' ? CM.chrome : CM.rim, 0, 0, 0.111);
  // brake
  const big = c.brakes === 'ceramic' ? 0.9 : (c.brakes === 'sport' ? 0.82 : 0.7), br = rr * (1 - lip) * big * 0.95;
  add(zc(new THREE.CylinderGeometry(br, br, 0.025, 26)), CM.disc, 0, 0, 0.0);
  const ca = front ? 2.2 : 0.95;
  add(new THREE.BoxGeometry(0.075, br * 0.8, 0.07), CM.caliper, Math.cos(ca) * br * 0.82, Math.sin(ca) * br * 0.82, 0.02, ca);
  // spokes
  const zf = 0.09, st = c.rimStyle;
  const spoke = (ang, len0, len1, w, mat = CM.rim, z = zf, t = 0.035) => {
    const L = len1 - len0, m = add(new THREE.BoxGeometry(L, w, t), mat, Math.cos(ang) * (len0 + L / 2), Math.sin(ang) * (len0 + L / 2), z, ang); return m;
  };
  const rot = 0.3;
  if (st === 'classic') for (let i = 0; i < 5; i++) spoke(rot + i * Math.PI * 2 / 5, rr * 0.12, rr * 0.96, rr * 0.2);
  if (st === 'six') for (let i = 0; i < 6; i++) { spoke(rot + i * Math.PI / 3, rr * 0.12, rr * 0.96, rr * 0.22); spoke(rot + i * Math.PI / 3, rr * 0.3, rr * 0.9, rr * 0.04, CM.rimDark, zf + 0.019, 0.004); }
  if (st === 'mesh') {
    for (let i = 0; i < 10; i++) spoke(rot + i * Math.PI / 5, rr * 0.14, rr * 0.96, rr * 0.06, CM.rim, zf, 0.025);
    for (let i = 0; i < 10; i++) spoke(rot + i * Math.PI / 5 + 0.31, rr * 0.4, rr * 0.95, rr * 0.035, CM.rim, zf - 0.01, 0.02);
    add(new THREE.TorusGeometry(rr * 0.55, 0.008, 6, 30), CM.rim, 0, 0, zf);
  }
  if (st === 'y') for (let i = 0; i < 5; i++) { const a0 = rot + i * Math.PI * 2 / 5; spoke(a0, rr * 0.12, rr * 0.55, rr * 0.17); spoke(a0 + 0.17, rr * 0.5, rr * 0.96, rr * 0.09); spoke(a0 - 0.17, rr * 0.5, rr * 0.96, rr * 0.09); }
  if (st === 'aero') {
    add(zc(new THREE.CylinderGeometry(rr * 0.95, rr * 0.95, 0.03, 28)), CM.rim, 0, 0, zf);
    for (let i = 0; i < 6; i++) { const a0 = rot + i * Math.PI / 3; add(zc(new THREE.CylinderGeometry(rr * 0.15, rr * 0.15, 0.034, 12)), CM.rimDark, Math.cos(a0) * rr * 0.6, Math.sin(a0) * rr * 0.6, zf + 0.002); }
  }
  if (st === 'deep') for (let i = 0; i < 6; i++) spoke(rot + i * Math.PI / 3, rr * 0.12, rr * 0.8, rr * 0.18, CM.rim, 0.04);
  add(zc(new THREE.CylinderGeometry(rr * 0.17, rr * 0.19, 0.04, 14)), CM.rim, 0, 0, zf + 0.01);
  for (let i = 0; i < 5; i++) { const a0 = 0.6 + i * Math.PI * 2 / 5; add(zc(new THREE.CylinderGeometry(rr * 0.035, rr * 0.035, 0.03, 6)), CM.chrome, Math.cos(a0) * rr * 0.26, Math.sin(a0) * rr * 0.26, zf + 0.02); }
  add(zc(new THREE.CylinderGeometry(rr * 0.08, rr * 0.08, 0.044, 10)), CM.chrome, 0, 0, zf + 0.012);
  return g;
}

let carRig = null;
/* ================= import your own car (.glb) ================= */
// The model is only the looks: engine, sound and handling still come from the stock car picked under "Car".
// It is turned to face +X, scaled, set on the ground, and its wheels are split off so they spin and steer.
const WHEEL_RE = /wheel|tyre|tire|rueda|felge|(^|[^a-z])rim([^a-z]|$)/i;
const NOT_WHEEL = /steer|handle|volant|spare|arch|well|cover|fender|(^|[^a-z])rul([^a-z]|$)/i;
const HIDE_LOD = /(^|[^a-z0-9])(vlo|lod\d*|lowlod|collision|collider|col|hitbox|shadow)([^a-z0-9]|$)/i;
const HIDE_BAY = /engine|[0-9]jz|jzx|radiator|intercooler|kebulas|underbody|undercarriage|gearbox|driveshaft/i;
const HIDE_INT = /tarpeda|torpeda|dashboard|interior|seat|ruchnoy|nexia2_|gauge|console|(^|[^a-z])rul([^a-z]|$)/i;
const OPT_RE = /^opt[_\s.-]+(.+?)(?:[_\s.-]+(\d+))?$/i;
const NOT_PAINT = /glass|window|tire|tyre|rubber|wheel|rim|light|lamp|chrome|interior|seat|brake|disc|caliper|grille|mirror|plate|black|plastic|carbon/i;
let customCar = null; // { name, scene, groups, paint, yaw, lenSrc, meta }

const idbCall = (mode, fn) => new Promise((res, rej) => {
  let rq; try { rq = indexedDB.open('raven-rs-mycar', 1); } catch (e) { rej(e); return; }
  rq.onupgradeneeded = () => rq.result.createObjectStore('car');
  rq.onerror = () => rej(rq.error);
  rq.onsuccess = () => {
    const db = rq.result;
    try {
      const tx = db.transaction('car', mode); const out = fn(tx.objectStore('car'));
      tx.oncomplete = () => { db.close(); res(out && out.result); }; tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
    } catch (e) { db.close(); rej(e); }
  };
});
const persistMeta = () => { if (!customCar) return; idbCall('readwrite', (s) => s.put({ name: customCar.name, meta: customCar.meta, use: !!cfg.custom }, 'meta')).catch(() => { /* storage is optional */ }); };

// bounding box of what is actually drawn (hidden parts and LOD stand-ins do not count)
function visBox(root, skipLod) {
  const b = new THREE.Box3(), t = new THREE.Box3();
  root.updateMatrixWorld(true);
  (function walk(o) {
    if (!o.visible || (skipLod && o.name && HIDE_LOD.test(o.name))) return;
    if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); b.union(t); }
    for (const c of o.children) walk(c);
  })(root);
  return b;
}
const subBox = (o) => visBox(o, false);

async function parseCar(buf) {
  const loader = new GLTFLoader(), dr = new DRACOLoader();
  dr.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  loader.setDRACOLoader(dr); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => (typeof buf === 'string' ? loader.parse(buf, '', res, rej) : loader.parse(buf, '', res, rej)));
  dr.dispose();
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  const triBy = new Map(); let meshes = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return; meshes++;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) triBy.set(m, (triBy.get(m) || 0) + n);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.map) m.map.anisotropy = 4;
  });
  if (!meshes) throw new Error('the file has no meshes');
  // game exports often mark every textured part as "blend", which sorts badly: treat them as cut-outs (spokes, grilles) unless they are glass or lights
  for (const m of triBy.keys()) if (m.transparent && m.map && !/glass|window|windscreen|light|lamp|lens/i.test(m.name || '')) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; m.opacity = 1; m.needsUpdate = true; }
  // option groups: Opt_Spoiler_1, Opt_Spoiler_2 ... (variants) or Opt_Rack (on/off)
  const gm = new Map();
  scene.traverse((o) => {
    const m = OPT_RE.exec(o.name || ''); if (!m) return;
    const key = m[1].toLowerCase(); let g = gm.get(key); if (!g) { g = { key, label: m[1].replace(/[_.-]+/g, ' '), nums: new Set(), toggle: true }; gm.set(key, g); }
    if (m[2] !== undefined) { g.nums.add(+m[2]); g.toggle = false; }
  });
  const groups = [...gm.values()].map((g) => ({ key: g.key, label: g.label, toggle: g.toggle, nums: [...g.nums].sort((a, b) => a - b) }));
  // paint: GTA-style "primary"/"secondary" markers, else materials called body/paint, else the biggest plain one
  const paint = []; const seen = new Set();
  const addPaint = (mat, role, guess) => { if (seen.has(mat)) return; seen.add(mat); paint.push({ mat, role, guess, orig: { color: mat.color.clone(), map: mat.map, metalness: mat.metalness, roughness: mat.roughness } }); };
  for (const m of triBy.keys()) { if (/^primary/i.test(m.name)) addPaint(m, 1, false); else if (/^secondary/i.test(m.name)) addPaint(m, 2, false); }
  if (!paint.length) {
    for (const m of triBy.keys()) if (/(^|[^a-z])(body|paint|carpaint|exterior|shell|lak|kuzov)/i.test(m.name) && !NOT_PAINT.test(m.name)) addPaint(m, 1, false);
  }
  if (!paint.length) {
    let best = null, bt = 0; for (const [m, t] of triBy) if (!NOT_PAINT.test(m.name || '') && t > bt && !m.transparent) { best = m; bt = t; }
    if (best) addPaint(best, 1, true);
  }
  // facing: which way is the front, judged from part names (bonnet, bumpers, wheels lf/rf vs lb/rb ...)
  const box = visBox(scene, true), size = box.getSize(new THREE.Vector3()), alongZ = size.z >= size.x;
  const F = /^(front|frontbump|bonnet|hood|grille|grill|fbumper)$/, R = /^(rear|rearbump|boot|trunk|exhaust|spoiler|taillight|taillights|rbumper)$/, WF = /^(lf|rf|fl|fr|f)$/, WR = /^(lb|rb|bl|br|rl|rr|lr|r|b)$/;
  let sum = 0; const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.name) return; const tk = o.name.toLowerCase().split(/[^a-z0-9]+/); let sc = 0;
    if (tk.some((x) => F.test(x))) sc = 1; else if (tk.some((x) => R.test(x))) sc = -1;
    else if (tk.some((x) => x === 'wheel' || x === 'tire' || x === 'tyre')) { if (tk.some((x) => WF.test(x))) sc = 1; else if (tk.some((x) => WR.test(x))) sc = -1; }
    if (!sc) return;
    const sb = subBox(o); if (!sb.isEmpty()) sb.getCenter(v); else o.getWorldPosition(v);
    sum += sc * (alongZ ? v.z : v.x);
  });
  const fs = sum >= 0 ? 1 : -1;
  const yaw = alongZ ? fs * Math.PI / 2 : (fs > 0 ? 0 : Math.PI);
  return { scene, groups, paint, yaw, lenSrc: Math.max(size.x, size.z), meshes };
}
function defaultMeta(cc) {
  const L = cc.lenSrc, tris = (() => { let t = 0; cc.scene.traverse((o) => { if (o.isMesh && !HIDE_LOD.test(o.name || '')) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return t; })();
  return { rot: 0, flip: false, length: L >= 3.4 && L <= 6.2 ? Math.round(L * 20) / 20 : 4.5, lift: 0, recolor: cc.paint.some((p) => /^(primary|secondary)/i.test(p.mat.name)), hideBay: true, hideInt: tris > 400000, opts: {} };
}
const optSel = (g, M) => (M.opts[g.key] !== undefined ? M.opts[g.key] : (g.toggle ? 1 : g.nums[0]));
function applyCustomPaint() {
  const cc = customCar; if (!cc) return;
  const f = CM.paint;
  for (const p of cc.paint) {
    const m = p.mat, had = !!m.map;
    if (cc.meta.recolor) { m.map = null; m.color.set(p.role === 2 ? cfg.color2 : cfg.color); m.metalness = f.metalness; m.roughness = f.roughness; }
    else { m.map = p.orig.map; m.color.copy(p.orig.color); m.metalness = p.orig.metalness; m.roughness = p.orig.roughness; }
    if (had !== !!m.map) m.needsUpdate = true;
  }
  invalidate();
}
function makeCustomRig() { return makeGlbRig(customCar); }
function makeGlbRig(cc) {
  const M = cc.meta, rig = new THREE.Group(), holder = new THREE.Group(), src = cc.scene.clone(true);
  rig.userData.custom = true;
  src.traverse((o) => {
    if (!o.name) return;
    const m = OPT_RE.exec(o.name);
    if (m) { const g = cc.groups.find((x) => x.key === m[1].toLowerCase()); if (g) { const s = optSel(g, M); o.visible = m[2] === undefined ? s !== 0 : +m[2] === s; } }
    if (HIDE_LOD.test(o.name) || (M.hideBay && HIDE_BAY.test(o.name)) || (M.hideInt && HIDE_INT.test(o.name))) o.visible = false;
  });
  holder.add(src); rig.add(holder);
  holder.rotation.y = cc.yaw + M.rot * Math.PI / 2 + (M.flip ? Math.PI : 0);
  let b = visBox(rig); holder.scale.setScalar(M.length / Math.max(0.5, b.max.x - b.min.x));
  b = visBox(rig); holder.position.set(-(b.min.x + b.max.x) / 2, -b.min.y + M.lift, -(b.min.z + b.max.z) / 2);
  rig.updateMatrixWorld(true);
  // wheels: every mesh under a wheel-named part, grouped by corner of the car, each corner turned into a spinning pivot
  const items = [];
  (function collect(o, inW) {
    if (!o.visible) return;
    const w = inW || (cc.wheelFlag ? !!o.userData.wheel : (!!o.name && WHEEL_RE.test(o.name) && !NOT_WHEEL.test(o.name)));
    if (o.isMesh && w) items.push(o);
    for (const c of o.children) collect(c, w);
  })(src, false);
  const wheels = [];
  if (items.length) {
    const cen = items.map((o) => subBox(o).getCenter(new THREE.Vector3()));
    const mx = cen.reduce((s, c) => s + c.x, 0) / cen.length, mz = cen.reduce((s, c) => s + c.z, 0) / cen.length;
    const cl = new Map(); items.forEach((o, i) => { const k = (cen[i].x > mx ? 1 : 0) + (cen[i].z > mz ? 2 : 0); if (!cl.has(k)) cl.set(k, []); cl.get(k).push(o); });
    for (const list of cl.values()) {
      const ub = new THREE.Box3(); list.forEach((o) => ub.union(subBox(o)));
      const sz = ub.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y) / 2;
      if (r < 0.18 || r > 0.62 || sz.z > r * 2) continue;
      const c = ub.getCenter(new THREE.Vector3()), pivot = new THREE.Group(); pivot.position.copy(c); pivot.userData.side = 1; pivot.userData.r = r;
      const inv = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
      for (const o of list) { const mw = o.matrixWorld.clone().premultiply(inv); o.removeFromParent(); mw.decompose(o.position, o.quaternion, o.scale); pivot.add(o); }
      rig.add(pivot); wheels.push(pivot);
    }
  }
  let xf = 1.4, xr = -1.36, r = 0.33;
  if (wheels.length) {
    const xm = wheels.reduce((s, w) => s + w.position.x, 0) / wheels.length;
    holder.position.x -= xm; wheels.forEach((w) => { w.position.x -= xm; });
    const fr = wheels.filter((w) => w.position.x > 0), rr = wheels.filter((w) => w.position.x <= 0), av = (a) => a.reduce((s, w) => s + w.position.x, 0) / a.length;
    if (fr.length) xf = av(fr); if (rr.length) xr = av(rr);
    r = wheels.reduce((s, w) => s + w.userData.r, 0) / wheels.length;
  } else { const bb = visBox(rig); xf = bb.max.x * 0.62; xr = bb.min.x * 0.62; }
  rig.updateMatrixWorld(true);
  const bb = visBox(rig);
  let tris = 0;
  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; if (o.visible) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  rig.userData.wheels = wheels;
  rig.userData.dims = { front: bb.max.x, rear: bb.min.x, xf, xr, r, exY: Math.max(0.12, r * 0.85), exZ: Math.min(0.9, (bb.max.z - bb.min.z) * 0.28) };
  rig.userData.info = { tris: Math.round(tris), wheels: wheels.length, length: bb.max.x - bb.min.x, width: bb.max.z - bb.min.z };
  if (cc === customCar) applyCustomPaint();
  return rig;
}

/* ---- built-in .glb cars (GLB_CARS): fetched once, then cloned for every rig ---- */
// A mesh whose triangles sit at several corners of the car (one "Tyres" mesh for both fronts, say) is cut into one
// mesh per corner, so each corner can become its own spinning pivot. Corners are judged around the middle of all wheels.
function splitWheels(root, re) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && re.test(o.material.name || '')) list.push(o); });
  if (!list.length) return 0;
  const all = new THREE.Box3(); list.forEach((o) => all.union(subBox(o)));
  const C = all.getCenter(new THREE.Vector3()), v = new THREE.Vector3();
  for (const o of list) {
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    const vi = (i) => (idx ? idx.getX(i) : i);
    const buckets = new Map();
    for (let t = 0; t < n; t += 3) {
      let x = 0, z = 0;
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, vi(t + k)).applyMatrix4(o.matrixWorld); x += v.x; z += v.z; }
      const key = (x / 3 > C.x ? 1 : 0) + (z / 3 > C.z ? 2 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, (b = [])); b.push(vi(t), vi(t + 1), vi(t + 2));
    }
    if (buckets.size < 2) { o.userData.wheel = true; continue; }
    for (const tris of buckets.values()) {
      // compact: only the vertices this corner uses, so its bounding box is the corner's alone
      const remap = new Map(), order = [];
      const index = tris.map((i) => { let j = remap.get(i); if (j === undefined) { j = order.length; remap.set(i, j); order.push(i); } return j; });
      const ng = new THREE.BufferGeometry();
      // read through getX..getW: quantized files store attributes interleaved and normalized, so the raw array is not one item per slot
      const get = ['getX', 'getY', 'getZ', 'getW'];
      for (const [name, a] of Object.entries(g.attributes)) {
        const arr = new Float32Array(order.length * a.itemSize);
        order.forEach((src, d) => { for (let c = 0; c < a.itemSize; c++) arr[d * a.itemSize + c] = a[get[c]](src); });
        ng.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
      }
      ng.setIndex(index);
      const m = new THREE.Mesh(ng, o.material); m.name = (o.name || 'wheel') + '_corner';
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); m.userData.wheel = true;
      o.parent.add(m);
    }
    o.removeFromParent(); g.dispose();
  }
  return list.length;
}
const glbCars = new Map(); // id -> { promise, cc }
const glbCar = (id) => { const e = glbCars.get(id); return e ? e.cc : null; };
function loadGlbCar(id) {
  const spec = GLB_CARS[id]; if (!spec) return null;
  if (glbCars.has(id)) return glbCars.get(id).promise;
  const ent = { cc: null }; glbCars.set(id, ent);
  ent.promise = fetch(spec.file).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + spec.file); return r.arrayBuffer(); })
    .then((buf) => parseCar(buf))
    .then((cc) => {
      splitWheels(cc.scene, spec.wheels);
      cc.name = modelName(id); cc.wheelFlag = true; cc.yaw = Math.PI / 2; // every one of these models faces +Z
      cc.meta = { ...defaultMeta(cc), length: spec.length, recolor: false, hideBay: false, hideInt: false };
      ent.cc = cc; onGlbReady(id); return cc;
    })
    .catch((e) => { console.warn('[car] could not load ' + spec.file, e); glbCars.delete(id); if (cfg.model === id) say('Could not load ' + modelName(id) + '.', true); });
  return ent.promise;
}
function onGlbReady(id) {
  if (cfg.model === id && !cfg.custom && !roam.active && !race.active) { rebuildCar(); render(); }
  for (const p of net.players.values()) {
    if (!p.rig || !p.rig.parent || p.look.model !== id) continue;
    const parent = p.rig.parent, old = p.rig; p.rig = makeLiteRig(p.look, p.color); p.rig.position.copy(old.position); p.rig.rotation.copy(old.rotation); p.rig.visible = old.visible; parent.remove(old); parent.add(p.rig);
  }
}
async function importCarFile(file) {
  if (!file) return;
  if (!/\.(glb|gltf)$/i.test(file.name)) { say('Please choose a .glb file (a single file with textures inside).', true); return; }
  if (file.size > 90e6) { say('That file is over 90 MB. Shrink the textures and export again.', true); return; }
  say('Reading ' + file.name + ' ...');
  try {
    const isText = /\.gltf$/i.test(file.name), buf = isText ? await file.text() : await file.arrayBuffer();
    const cc = await parseCar(buf);
    cc.name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'My car';
    cc.meta = defaultMeta(cc);
    customCar = cc; cfg.custom = true;
    if (!isText) idbCall('readwrite', (s) => s.put(buf, 'buf')).catch(() => { /* too big to store here; the car will not be kept */ });
    persistMeta(); rebuildCar(); render();
    const i = carRig && carRig.userData.info;
    say(cc.name + ' loaded' + (i ? ' · ' + (i.tris / 1000).toFixed(0) + 'k triangles, ' + i.wheels + ' wheels found.' : '.'));
  } catch (e) { say('Could not read that file: ' + ((e && e.message) || e), true); }
}
async function loadCustomCar() {
  try {
    const meta = await idbCall('readonly', (s) => s.get('meta')), buf = await idbCall('readonly', (s) => s.get('buf'));
    if (!meta || !buf) { if (cfg.custom) { cfg.custom = false; rebuildCar(); } return; }
    const cc = await parseCar(buf); cc.name = meta.name || 'My car'; cc.meta = { ...defaultMeta(cc), ...meta.meta }; customCar = cc; if (meta.use) cfg.custom = true;
    if (cfg.custom) { rebuildCar(); render(); }
  } catch (e) { if (cfg.custom) { cfg.custom = false; rebuildCar(); render(); } }
}
function removeCustomCar() {
  customCar = null; cfg.custom = false;
  idbCall('readwrite', (s) => { s.clear(); return s; }).catch(() => { /* nothing stored */ });
  rebuildCar(); render(); say('Imported car removed.');
}
window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /\.(glb|gltf)$/i.test(f.name)) { e.preventDefault(); importCarFile(f); } });

function renderImportPicker(p, head, left) {
  const cc = customCar, M = cc && cc.meta;
  left.append(el('div', 'p-name', cc ? cc.name : 'Import your car'));
  head.append(el('div', 'p-desc', cc ? (cfg.custom ? 'Your model is in the garage. Engine, sound and handling come from the stock car you picked.' : 'Stock cars are selected.') : 'A .glb file with its textures inside. Drop it on the page or choose it.'));
  const f = el('div', 'form'), fi = el('input'); fi.type = 'file'; fi.accept = '.glb,.gltf,model/gltf-binary'; fi.hidden = true; fi.id = 'carFile'; fi.onchange = () => { importCarFile(fi.files[0]); };
  f.append(fi, skewBtn(cc ? 'Replace .glb' : 'Choose .glb file', 'primary', () => fi.click()));
  if (cc) f.append(skewBtn(cfg.custom ? 'Use stock cars' : 'Use my car', '', () => { cfg.custom = !cfg.custom; persistMeta(); rebuildCar(); render(); }), skewBtn('Remove', '', removeCustomCar));
  const box = el('div', 'impbox'); box.append(f);
  const info = el('div', 'p-desc'); info.style.textAlign = 'left'; info.style.maxWidth = 'none';
  const showInfo = () => {
    const i = carRig && carRig.userData.info; if (!i || !cfg.custom) { info.textContent = ''; return; }
    const w = [];
    if (!i.wheels) w.push('No wheels found, so they will not spin. Name them Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR.');
    else if (i.wheels < 4) w.push('Only ' + i.wheels + ' wheels found.');
    if (i.tris > 450000) w.push('Heavy model: it may run slowly. Hide the interior or engine bay, or reduce the polygons.');
    info.textContent = (i.tris / 1000).toFixed(0) + 'k triangles · ' + i.wheels + ' wheels · ' + i.length.toFixed(2) + ' m long' + (w.length ? ' — ' + w.join(' ') : '');
  };
  let tm = 0; const upd = (patch) => { Object.assign(M, patch); persistMeta(); if (!cfg.custom) return; clearTimeout(tm); tm = setTimeout(() => { rebuildCar(); showInfo(); }, 60); };
  const range = (label, min, max, step, get, set, fmt) => {
    const l = el('label', 'imp-l'), v = el('b', null, fmt(get())), r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get();
    r.oninput = () => { set(+r.value); v.textContent = fmt(+r.value); }; l.append(label, ' ', v, r); return l;
  };
  const check = (label, get, set) => { const l = el('label', 'imp-l'), c = el('input'); c.type = 'checkbox'; c.checked = get(); c.onchange = () => set(c.checked); l.append(c, ' ' + label); return l; };
  if (cc) {
    const r1 = el('div', 'form');
    r1.append(skewBtn('Rotate 90°', '', () => upd({ rot: (M.rot + 1) % 4 })), skewBtn('Flip front/back', '', () => upd({ flip: !M.flip })),
      range('Length', 3.2, 6.2, 0.05, () => M.length, (v) => upd({ length: v }), (v) => v.toFixed(2) + ' m'),
      range('Height', -10, 25, 1, () => Math.round(M.lift * 100), (v) => upd({ lift: v / 100 }), (v) => v + ' cm'));
    const r2 = el('div', 'form');
    r2.append(check('Recolor body with my Paint colours', () => M.recolor, (v) => { M.recolor = v; persistMeta(); applyCustomPaint(); }),
      check('Hide engine bay and underbody', () => M.hideBay, (v) => upd({ hideBay: v })), check('Hide interior', () => M.hideInt, (v) => upd({ hideInt: v })));
    box.append(r1, r2);
    for (const g of cc.groups) {
      const row = el('div', 'form'); row.append(el('b', 'imp-l', g.label));
      const opts = g.toggle ? [[0, 'Off'], [1, 'On']] : (g.nums.includes(0) ? g.nums.map((n) => [n, n === 0 ? 'None' : 'Style ' + n]) : [[-1, 'None'], ...g.nums.map((n) => [n, 'Style ' + n])]);
      for (const [val, lab] of opts) { const b = skewBtn(lab, optSel(g, M) === val ? 'primary' : '', () => { upd({ opts: { ...M.opts, [g.key]: val } }); row.querySelectorAll('.btn').forEach((x) => x.classList.remove('primary')); b.classList.add('primary'); }); row.append(b); }
      box.append(row);
    }
    const nf = el('div', 'form'); nf.append(info); box.append(nf); showInfo();
  }
  const d = el('details', 'impguide'), s = el('summary', null, 'How to prepare your car'); d.append(s);
  const ul = el('ul');
  for (const t of [
    'Export one .glb with the textures embedded (Blender: File > Export > glTF 2.0, format glTF Binary). Draco and Meshopt compression work too.',
    'Wheels: make each wheel its own object (tyre, rim and brake together, any origin) and name it Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR. Anything with wheel, tyre or rim in its name is found. Front wheels steer, all spin.',
    'Paint: name the body paint material Body or Paint (or primary / secondary), then tick Recolor body to use the Paint colours.',
    'Tuning parts: name optional parts Opt_<Group>_<N>, for example Opt_Spoiler_1, Opt_Spoiler_2, Opt_Hood_1. Add an empty Opt_Spoiler_0 if you want a none choice. A single Opt_Rack becomes an on/off switch. Each group gets buttons here.',
    'Facing: the game points the front toward +X and tries to work it out from names like bonnet, boot, Wheel_FL. If the car faces backwards, press Flip front/back.',
    'Parts named lod, vlo, collision or shadow are hidden automatically.',
    'Keep it under about 300k triangles. Your model is visual only: sound, power and handling come from the stock car under Car and the Performance parts.'
  ]) ul.append(el('li', null, t));
  d.append(ul); box.append(d); p.append(box);
}

function makeRig(c, swap) {
  if (c.custom && customCar && !swap) return makeCustomRig();
  if (GLB_CARS[c.model]) { const cc = glbCar(c.model); if (cc) return makeGlbRig(cc); loadGlbCar(c.model); }
  const { car, wheels, dims } = buildCar(c);
  const sw = (root) => { if (swap) root.traverse((o) => { if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material); }); };
  sw(car);
  const rig = new THREE.Group(); rig.add(mergeByMaterial(car)); rig.userData.dims = dims;
  rig.userData.wheels = wheels.map((w) => {
    sw(w);
    const pos = w.position.clone(), ry = w.rotation.y;
    w.position.set(0, 0, 0); w.rotation.set(0, 0, 0);
    const m = mergeByMaterial(w); m.position.copy(pos); m.rotation.y = ry; m.userData.side = w.userData.side;
    m.traverse((o) => { o.castShadow = false; });
    rig.add(m); return m;
  });
  return rig;
}
function rebuildCar() {
  const pos = carRig ? carRig.position.clone() : null;
  if (carRig) { if (!carRig.userData.custom) carRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(carRig); }
  carRig = makeRig(cfg); if (pos) carRig.position.copy(pos); scene.add(carRig);
  renderer.shadowMap.needsUpdate = true; invalidate();
}
// collapse ~200 part meshes into one mesh per material (far fewer draw calls)
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) if (!(Math.hypot(nn.getX(i), nn.getY(i), nn.getZ(i)) > 1e-6)) nn.setXYZ(i, 0, 1, 0);
    g.clearGroups();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
    o.geometry.dispose();
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    m.castShadow = true; m.receiveShadow = true; out.add(m);
    list.forEach((g) => g.dispose());
  }
  return out;
}

/* ================= post-processing ================= */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.3, 1.45);
composer.addPass(bloom);
// sense of speed: the picture streaks outward from the vanishing point (sharp in the middle, blurred at the edges),
// the corners darken and the colours split slightly; all of it scales with speed and nitro
const speedFx = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, vig: { value: 0 }, ctr: { value: new THREE.Vector2(0.5, 0.52) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float amt; uniform float vig; uniform vec2 ctr; varying vec2 vUv;',
    'void main() {',
    '  vec2 d = vUv - ctr; float r = length( d ), w = amt * smoothstep( 0.1, 0.7, r );',
    '  float j = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );',
    '  vec3 c = vec3( 0.0 );',
    '  for ( int i = 0; i < 10; i++ ) { float t = ( float( i ) + j ) / 10.0; c += texture2D( tDiffuse, vUv - d * w * t ).rgb; }',
    '  c /= 10.0;',
    '  c.r = mix( c.r, texture2D( tDiffuse, vUv - d * w * 1.25 ).r, 0.35 ); c.b = mix( c.b, texture2D( tDiffuse, vUv + d * w * 0.25 ).b, 0.35 );',
    '  c *= 1.0 - vig * smoothstep( 0.3, 0.95, r );',
    '  gl_FragColor = vec4( c, 1.0 );',
    '}'].join('\n')
});
speedFx.enabled = false; composer.addPass(speedFx);
composer.addPass(new OutputPass());

function resize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1.1 ? 42 : 30;
  camera.updateProjectionMatrix();
  invalidate();
}
new ResizeObserver(resize).observe(stage);
resize();

/* ================= camera views ================= */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let tween = null;
function flyTo(az, el) {
  const d = camera.position.distanceTo(controls.target);
  const from = camera.position.clone().sub(controls.target);
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const to = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(d);
  if (reduce) { camera.position.copy(controls.target).add(to); return; }
  tween = { from: new THREE.Spherical().setFromVector3(from), to: new THREE.Spherical().setFromVector3(to), t0: performance.now() };
  let dt = tween.to.theta - tween.from.theta; if (dt > Math.PI) tween.to.theta -= Math.PI * 2; if (dt < -Math.PI) tween.to.theta += Math.PI * 2;
}
const VIEWS = [['Front 3/4', 42, 9], ['Side', 0, 6], ['Rear 3/4', -140, 12], ['Front', 90, 6], ['Top', 42, 52]];
const viewsEl = document.getElementById('views');
for (const [label, az, el] of VIEWS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-btn'; b.textContent = label; b.onclick = () => { setSpin(false); flyTo(az, el); }; viewsEl.append(b); }
const spinBtn = document.createElement('button'); spinBtn.type = 'button'; spinBtn.className = 'chip-btn'; spinBtn.textContent = 'Auto-spin';
spinBtn.setAttribute('aria-pressed', 'false');
function setSpin(on) { controls.autoRotate = on; spinBtn.setAttribute('aria-pressed', String(on)); }
spinBtn.onclick = () => setSpin(!controls.autoRotate);
viewsEl.append(spinBtn);
const qBtn = document.createElement('button'); qBtn.type = 'button'; qBtn.className = 'chip-btn';
const LOD = { k: 1, ms: 16, t: 0, lock: false, far0: 620, far: 620, R: [0, 0], chunks: 0, on: [0, 0], PIX: 5, basePR: 1, prs: 1, prT: 0 };
function applyQuality() {
  const L = qLevel, dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(L === 'high' ? Math.min(dpr, 1.5) : L === 'medium' ? Math.min(dpr, 1) : Math.min(dpr, 0.8));
  LOD.basePR = renderer.getPixelRatio(); LOD.prs = 1;
  { const sm = L === 'high' ? 4 : L === 'medium' ? 2 : 0; for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== sm) { rt.samples = sm; rt.dispose(); } }
  bloom.enabled = L !== 'low'; mirror.visible = L !== 'low';
  if (L !== 'low') { const sz = L === 'high' ? 1024 : 512; mirror.getRenderTarget().setSize(sz, sz); }
  for (const e of Object.values(ENVS)) e.sun.castShadow = L !== 'low';
  floor.material.transparent = L !== 'low'; floor.material.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true; resize();
  qBtn.textContent = 'Quality: ' + (qPref === 'auto' ? 'Auto · ' : '') + L.charAt(0).toUpperCase() + L.slice(1);
}
function setQuality(pref) {
  qPref = pref; qLevel = pref === 'auto' ? 'high' : pref;
  try { localStorage.setItem('raven-rs-quality', pref); } catch (e) { /* storage unavailable */ }
  applyQuality();
}
qBtn.onclick = () => { const order = ['auto', 'high', 'medium', 'low']; setQuality(order[(order.indexOf(qPref) + 1) % order.length]); };
viewsEl.append(qBtn);
// Auto quality: step down when continuous rendering runs under ~40 fps
let fpsAcc = 0, fpsN = 0, lastDrop = 0;
function trackFps(dt) {
  if (qPref !== 'auto' || qLevel === 'low' || dt > 0.25) return;
  fpsAcc += dt; fpsN++;
  if (fpsN < 90) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  if (fps < 40 && performance.now() - lastDrop > 4000) { lastDrop = performance.now(); qLevel = qLevel === 'high' ? 'medium' : 'low'; applyQuality(); say('Graphics lowered to keep it smooth.'); }
}
controls.addEventListener('start', () => { tween = null; });
controls.addEventListener('change', invalidate);

/* ================= menu UI ================= */
const SECTIONS = [['roam', 'Free roam'], ['race', 'Drag race'], ['car', 'Car'], ['kits', 'Body kits'], ['body', 'Body'], ['aero', 'Aero'], ['paint', 'Paint'], ['vinyl', 'Vinyl'], ['wheels', 'Wheels'], ['lights', 'Lights'], ['perf', 'Performance'], ['dyno', 'Dyno'], ['loc', 'Location'], ['import', 'My car (.glb)'], ['save', 'Save & share']];
const VISUAL_ONLY = ['bov', 'color', 'color2', 'finish', 'vinyl', 'vinylColor', 'sticker', 'stickerColor', 'rimColor', 'caliper', 'tint', 'neon', 'headlight', 'lightsOn', 'engine', 'turbo', 'nitro', 'gearbox', 'tires', 'finalDrive', 'ecu', 'nitroTune'];
let toastTimer = 0;
function say(text, bad = false) {
  const m = $('msg'); m.textContent = text; m.classList.toggle('bad', bad);
  clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => { m.textContent = ''; }, 3800);
}
const groupsOf = (sec) => {
  if (sec === 'roam') return [{ type: 'roam', title: 'Free roam' }];
  if (sec === 'race') return [{ type: 'race', title: 'Drag race' }];
  if (sec === 'dyno') return [{ type: 'dyno', title: 'Dyno' }];
  if (sec === 'loc') return [{ type: 'loc', title: 'Location' }];
  if (sec === 'save') return [{ type: 'save', title: 'Save & share' }];
  if (sec === 'import') return [{ type: 'import', title: 'My car (.glb)' }];
  if (sec === 'car') return [{ type: 'models', key: 'model', title: 'Car' }];
  if (sec === 'kits') return [{ type: 'kits', title: 'Body kits' }];
  return groupsFor(sec).map((g) => (g.type === 'sticker' ? { ...g, title: 'Decal text' } : g));
};
const optsOf = (g) => {
  if (g.type === 'models') return MODEL_LIST.map(([val, label, desc]) => ({ val, label, desc }));
  if (g.type === 'kits') return KITS.map(([label, desc, parts], i) => ({ val: i, label, desc, parts }));
  if (g.type === 'loc') return LOCS.map(([val, label, desc]) => ({ val, label, desc }));
  if (g.type === 'pills' || g.type === 'swatch') return g.opts.map(([val, label]) => ({ val, label, hex: g.type === 'swatch' ? val : null }));
  return [];
};
const kitIndexOf = (c) => KITS.findIndex(([, , parts]) => Object.entries(parts).every(([k, v]) => c[k] === v));
const indexIn = (g, c, l) => {
  if (g.type === 'kits') return kitIndexOf(c);
  if (g.type === 'loc') return LOCS.findIndex((x) => x[0] === l);
  if (g.key) return optsOf(g).findIndex((o) => o.val === c[g.key]);
  return -1;
};
const curIndex = (g) => indexIn(g, cfg, loc);
const valueLabel = (g) => {
  if (g.type === 'sticker') return cfg.sticker || 'None';
  if (g.type === 'save') return '';
  if (g.type === 'import') return customCar && cfg.custom ? customCar.name : 'Off';
  if (g.type === 'roam') return 'Neon Bay';
  if (g.type === 'race') return MODES.find((m) => m[0] === raceMode)[1];
  if (g.type === 'dyno') return dyno(cfg).et.toFixed(2) + ' s';
  const i = curIndex(g);
  return i < 0 ? (g.type === 'kits' ? 'Custom' : '') : optsOf(g)[i].label;
};
const nav = { level: 0, s: 0, g: 0, o: 0, orig: null };
const curGroups = () => groupsOf(SECTIONS[nav.s][0]);
const curGroup = () => curGroups()[nav.g];

function refresh(keys) { updateMaterials(); if (keys.some((k) => !VISUAL_ONLY.includes(k))) rebuildCar(); renderStats(); }
function applyOption(g, i) {
  const o = optsOf(g)[i]; if (!o) return;
  if (g.type === 'kits') { Object.assign(cfg, o.parts); refresh(Object.keys(o.parts)); }
  else if (g.type === 'loc') setLocation(o.val);
  else { cfg[g.key] = o.val; refresh([g.key]); }
}
const snapshot = (g) => (g.type === 'loc' ? loc : { ...cfg });
function restore(g, snap) { if (g.type === 'loc') setLocation(snap); else { cfg = snap; refresh(Object.keys(cfg)); } }

function enterSection() { nav.level = 1; nav.g = 0; nav.orig = null; if (curGroups().length === 1) enterGroup(); }
function enterGroup() {
  const g = curGroup(); nav.level = 2; nav.orig = null;
  nav.o = Math.max(0, curIndex(g));
}
function back() { nav.level = nav.level === 2 && curGroups().length > 1 ? 1 : 0; }
function commit() { const g = curGroup(); if (nav.orig !== null && optsOf(g)[nav.o]) say(optsOf(g)[nav.o].label + (g.type === 'loc' || g.type === 'models' ? ' selected.' : ' fitted.')); nav.orig = null; back(); }
function cancel() { if (nav.orig !== null) restore(curGroup(), nav.orig); nav.orig = null; back(); }
function step(d) {
  const g = curGroup(), n = optsOf(g).length; if (!n) return;
  if (nav.orig === null) nav.orig = snapshot(g);
  nav.o = (nav.o + d + n) % n; applyOption(g, nav.o);
}
function moveGroup(d) { const n = curGroups().length; if (n < 2) return; nav.orig = null; nav.g = (nav.g + d + n) % n; enterGroup(); }

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const menuItem = (label, val) => {
  const b = el('button', 'item'); b.type = 'button';
  b.append(el('span', null, label)); if (val != null && val !== '') b.append(el('span', 'val', val));
  return b;
};
const skewBtn = (label, cls, fn) => { const b = el('button', 'btn' + (cls ? ' ' + cls : '')); b.type = 'button'; b.append(el('span', null, label)); b.onclick = fn; return b; };

function render() {
  const m1 = $('m1'); m1.replaceChildren(); m1.classList.toggle('dim', nav.level > 0);
  SECTIONS.forEach(([, label], i) => {
    const b = menuItem(label);
    if (i === nav.s) { b.classList.add(nav.level === 0 ? 'cur' : 'trail'); b.setAttribute('aria-current', 'true'); }
    b.onclick = () => { if (nav.orig !== null) nav.orig = null; nav.s = i; enterSection(); render(); };
    m1.append(b);
  });
  const m2 = $('m2'); m2.replaceChildren(); m2.classList.toggle('dim', nav.level > 1);
  if (nav.level >= 1) curGroups().forEach((g, j) => {
    const b = menuItem(g.title, valueLabel(g));
    if (j === nav.g) { b.classList.add(nav.level === 1 ? 'cur' : 'trail'); b.setAttribute('aria-current', 'true'); }
    b.onclick = () => { nav.g = j; enterGroup(); render(); };
    m2.append(b);
  });
  for (const id of ['m1', 'm2']) { const c = document.querySelector('#' + id + ' .cur, #' + id + ' .trail'); if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  renderPicker();
}

function renderPicker() {
  const p = $('picker'); p.replaceChildren();
  if (nav.level === 0) { p.hidden = true; return; }
  p.hidden = false;
  const g = curGroup();
  p.classList.toggle('dimmed', nav.level < 2);
  const head = el('div', 'p-head'), left = el('div');
  left.append(el('span', 'p-title', g.title));
  head.append(left); p.append(head);

  if (g.type === 'sticker') {
    left.append(el('div', 'p-name', cfg.sticker || 'No decal'));
    const f = el('div', 'form');
    const inp = el('input'); inp.id = 'sticker'; inp.type = 'text'; inp.maxLength = 14; inp.placeholder = 'Type a name or tag'; inp.value = cfg.sticker; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Decal text');
    inp.oninput = () => { cfg.sticker = inp.value.toUpperCase().slice(0, 14); drawVinyl(); drawPlate(); invalidate(); left.lastChild.textContent = cfg.sticker || 'No decal'; };
    f.append(inp, skewBtn('Done', 'primary', () => { back(); render(); }));
    p.append(f);
    if (nav.level === 2) setTimeout(() => inp.focus(), 0);
    return;
  }
  if (g.type === 'import') { renderImportPicker(p, head, left); return; }
  if (g.type === 'roam') { renderRoamPicker(p, head, left); return; }
  if (g.type === 'race') { renderRacePicker(p, head, left); return; }
  if (g.type === 'dyno') { renderDyno(p, head, left); return; }
  if (g.type === 'save') {
    left.append(el('div', 'p-name', 'Keep your build'));
    head.append(el('div', 'p-desc', 'Saves stay in this browser. Share a build with its code.'));
    const f = el('div', 'form');
    const code = el('input'); code.id = 'code'; code.type = 'text'; code.placeholder = 'Get a code, or paste a friend’s code'; code.autocomplete = 'off'; code.spellcheck = false; code.setAttribute('aria-label', 'Build code');
    f.append(
      skewBtn('Save my car', 'primary', () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); say('Saved. Your car will be here next time.'); } catch (e) { code.value = encode(cfg); say('This browser blocks saving. Copy the code instead.', true); } }),
      skewBtn('Load saved', '', () => { const c = readStore(); if (c) loadCfg(c, 'Saved car loaded.'); else say('No saved car on this device yet.', true); }),
      skewBtn('Reset to stock', '', () => loadCfg({ ...DEFAULTS, model: cfg.model }, 'Reset to stock.')),
      skewBtn('Showcase build', '', () => loadCfg({ ...DEFAULTS, ...SHOWCASE, model: cfg.model }, 'Showcase build loaded.'))
    );
    const f2 = el('div', 'form');
    f2.append(code,
      skewBtn('Get code', '', () => { code.value = encode(cfg); say('Code ready.'); }),
      skewBtn('Copy', '', () => { const v = code.value || encode(cfg); code.value = v; const fb = () => { code.select(); say('Code selected. Press Ctrl+C to copy.'); }; try { navigator.clipboard.writeText(v).then(() => say('Code copied.'), fb); } catch (e) { fb(); } }),
      skewBtn('Load code', '', () => { try { loadCfg(decode(code.value), 'Car loaded from code.'); } catch (e) { say('That code is not valid. Check that you copied all of it.', true); } })
    );
    p.append(f, f2);
    return;
  }

  const opts = optsOf(g);
  const idx = nav.level === 2 ? nav.o : Math.max(0, curIndex(g));
  const fitted = nav.orig !== null ? indexIn(g, g.type === 'loc' ? cfg : nav.orig, g.type === 'loc' ? nav.orig : loc) : curIndex(g);
  const o = opts[idx];
  left.append(el('div', 'p-name', o ? o.label : ''));
  head.append(el('div', 'p-desc', nav.level < 2 ? 'Press Enter or click a part to browse' : (o && o.desc) || (idx + 1) + ' / ' + opts.length));
  const strip = el('div', 'strip');
  const prev = el('button', 'arrow', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous option');
  const next = el('button', 'arrow', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next option');
  prev.onclick = () => { if (nav.level < 2) enterGroup(); step(-1); render(); };
  next.onclick = () => { if (nav.level < 2) enterGroup(); step(1); render(); };
  const cards = el('div', 'cards'); cards.setAttribute('role', 'listbox'); cards.setAttribute('aria-label', g.title);
  let curCard = null;
  opts.forEach((op, i) => {
    const c = el('button', 'card' + (g.type === 'kits' || g.type === 'models' ? ' kit' : '')); c.type = 'button'; c.setAttribute('role', 'option');
    if (g.type === 'swatch') { const d = el('span', 'dot' + (op.val === 'off' ? ' off' : '')); if (op.val !== 'off') d.style.background = op.hex; c.append(d, el('span', null, op.label)); }
    else if (g.type === 'kits' || g.type === 'models') { c.append(el('span', null, op.label), el('small', null, op.desc)); }
    else c.append(el('span', null, op.label));
    if (i === fitted) c.classList.add('fit');
    if (i === idx && nav.level === 2) { c.classList.add('cur'); curCard = c; }
    c.setAttribute('aria-selected', String(i === idx));
    c.onclick = () => { nav.level = 2; nav.o = i; nav.orig = null; applyOption(g, i); say(op.label + (g.type === 'loc' || g.type === 'models' ? ' selected.' : ' fitted.')); render(); };
    cards.append(c);
  });
  strip.append(prev, cards, next); p.append(strip);
  if (curCard) requestAnimationFrame(() => { const r = curCard.offsetLeft - cards.clientWidth / 2 + curCard.clientWidth / 2; cards.scrollTo({ left: r, behavior: reduce ? 'auto' : 'smooth' }); });
}

function renderStats() {
  const st = stats(cfg), dy = dyno(cfg), cl = (v) => Math.max(3, Math.min(100, Math.round(v)));
  $('carName').textContent = modelName(cfg.model).toUpperCase();
  $('r-hp').textContent = st.hp; $('r-t').textContent = dy.t100.toFixed(1); $('r-v').textContent = Math.round(dy.vmax);
  const rows = [['Acceleration', cl((8 - dy.t100) / 5.5 * 100)], ['Top speed', cl((dy.vmax - 150) / 170 * 100)], st.bars[2], st.bars[3]];
  const bars = $('bars'); bars.replaceChildren();
  for (const [label, v] of rows) {
    const row = el('div', 'bar'), tr = el('i'), fl = el('b');
    fl.style.width = v + '%'; tr.append(fl);
    row.append(el('span', null, label), tr, el('em', null, String(v)));
    bars.append(row);
  }
}
const encode = (c) => btoa(unescape(encodeURIComponent(JSON.stringify({ ...c, custom: false }))));
const decode = (s) => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
const loadCfg = (c, msg) => { cfg = clean(c); if (!customCar) cfg.custom = false; updateMaterials(); rebuildCar(); renderStats(); render(); say(msg); };

window.addEventListener('keydown', (e) => {
  if ($('stage').classList.contains('racing') || $('stage').classList.contains('roaming')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
    if (e.key === 'Enter' && t.id === 'roamName') { e.preventDefault(); t.blur(); startRoam(); return; }
    if (e.key === 'Escape' || (e.key === 'Enter' && t.id === 'sticker')) { t.blur(); back(); render(); e.preventDefault(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key; let handled = true;
  const S = SECTIONS.length, G = curGroups().length;
  if (nav.level === 0) {
    if (k === 'ArrowDown') nav.s = (nav.s + 1) % S;
    else if (k === 'ArrowUp') nav.s = (nav.s - 1 + S) % S;
    else if (k === 'ArrowRight' || k === 'Enter') enterSection();
    else handled = false;
  } else if (nav.level === 1) {
    if (k === 'ArrowDown') nav.g = (nav.g + 1) % G;
    else if (k === 'ArrowUp') nav.g = (nav.g - 1 + G) % G;
    else if (k === 'ArrowRight' || k === 'Enter') enterGroup();
    else if (k === 'ArrowLeft' || k === 'Escape' || k === 'Backspace') back();
    else handled = false;
  } else {
    const g = curGroup();
    if (g.type === 'roam') { if (k === 'Enter') { e.preventDefault(); startRoam(); return; } if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (g.type === 'race') {
      if (k === 'Enter') { startRace(); return e.preventDefault(); }
      if (k === 'Escape' || k === 'Backspace') back();
      else if (k === 'ArrowRight' || k === 'ArrowLeft') { const i = TRACKS.findIndex((t) => t[0] === raceTrack), n = TRACKS.length; raceTrack = TRACKS[(i + (k === 'ArrowRight' ? 1 : -1) + n) % n][0]; store.set('track', raceTrack); }
      else if (k === 'ArrowDown' || k === 'ArrowUp') { const i = MODES.findIndex((m) => m[0] === raceMode), n = MODES.length; raceMode = MODES[(i + (k === 'ArrowDown' ? 1 : -1) + n) % n][0]; store.set('mode', raceMode); }
      else handled = false;
    }
    else if (g.type === 'dyno') { if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (g.type === 'save' || g.type === 'sticker' || g.type === 'import') { if (k === 'Escape' || k === 'Backspace') back(); else handled = false; }
    else if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'Enter') commit();
    else if (k === 'Escape' || k === 'Backspace') cancel();
    else if (k === 'ArrowDown') moveGroup(1);
    else if (k === 'ArrowUp') moveGroup(-1);
    else handled = false;
  }
  if (handled) { e.preventDefault(); render(); }
});

/* ================= drag race ================= */
// Model: torque curve x gear x final drive -> wheel force, capped by tyre grip (wheelspin above it),
// tyre temperature from the burnout scales grip, clutch-slip launch from the rpm held at the green light,
// reaction time from the launch press, timed shifts with no drive while shifting, rev limiter that cuts power
// and heats the engine, tuned nitrous as a torque multiplier, aero + rolling drag.
const G = 9.81, H = 1 / 240;
const TRACKS = [['strip', 'Sunset Strip'], ['coast', 'Palm Coast'], ['rain', 'Neon Rain']];
// id, label, hp factor (quick race), launch rpm, shift point, shift jitter, nitro gear, reaction range, traffic look-ahead (s)
const DIFFS = [
  ['easy', 'Easy', 0.86, 0.42, 0.84, 0.1, 4, [0.32, 0.48], 0.8],
  ['normal', 'Normal', 0.98, 0.56, 0.9, 0.06, 3, [0.2, 0.3], 1.1],
  ['hard', 'Hard', 1.07, 0.6, 0.94, 0.025, 3, [0.12, 0.19], 1.4]
];
const MODES = [['ladder', 'Street ladder'], ['quick', 'Quick race'], ['test', 'Test run'], ['challenge', 'Challenge']];
const RIVAL_BASE = { fbumper: 'sport', rbumper: 'sport', skirt: 'sport', spoiler: 'gt', wingColor: 'carbon', hood: 'carbon', rimStyle: 'mesh', susp: 'sport', width: 'stock', sticker: '', vinyl: 'none', roof: 'none', mirrors: 'stock', fenderVents: false };
const LADDER = [
  { name: 'Mako', note: 'Weekend racer. Short-shifts and never touches nitro.', skill: 'easy', color: '#2ec4e6', look: { model: 'ember', fbumper: 'street', rbumper: 'stock', spoiler: 'lip', rimStyle: 'classic', hood: 'stock' }, perf: { engine: 0, turbo: 'none', nitro: 0, gearbox: 'stock', tires: 'street' }, boost: 0.973 },
  { name: 'Ruby', note: 'Drift kid on her first drag night.', skill: 'easy', color: '#d42a3c', look: { model: 'raven', fbumper: 'aggr', spoiler: 'tri', width: 'over', rimStyle: 'deep', hood: 'vents' }, perf: { engine: 1, turbo: 'none', nitro: 1, gearbox: 'stock', tires: 'street' } },
  { name: 'Static', note: 'Clean launches, lazy shifts.', skill: 'normal', color: '#9aa3ad', look: { model: 'blackjaw', spoiler: 'duck', rimStyle: 'y' }, perf: { engine: 1, turbo: 'small', nitro: 1, gearbox: 'sport', tires: 'sport' }, boost: 1.046 },
  { name: 'Neon Kai', note: 'Lights the nitro early in third.', skill: 'normal', color: '#ff3da8', look: { model: 'ember', fbumper: 'aggr', rbumper: 'diff', hood: 'vents' }, perf: { engine: 2, turbo: 'small', nitro: 1, gearbox: 'sport', tires: 'sport' }, boost: 0.91 },
  { name: 'Viper', note: 'Fast hands. Rarely misses a shift.', skill: 'hard', color: '#1e9e5a', look: { model: 'vanta', rbumper: 'diff', spoiler: 'swan', rimStyle: 'six', hood: 'louvers' }, perf: { engine: 2, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'sport' }, boost: 0.893 },
  { name: 'Halo', note: 'Widebody show car with real pace.', skill: 'hard', color: '#f2f2f2', look: { model: 'blackjaw', fbumper: 'aggr', rbumper: 'diff', width: 'wide', rimStyle: 'deep' }, perf: { engine: 3, turbo: 'small', nitro: 2, gearbox: 'race', tires: 'slick' }, boost: 1.112 },
  { name: 'Ghostline', note: 'Gone before the tree finishes dropping.', skill: 'hard', color: '#121316', look: { model: 'vanta', fbumper: 'track', rbumper: 'track', width: 'wide', spoiler: 'swan', rimStyle: 'aero', roof: 'vortex' }, perf: { engine: 3, turbo: 'big', nitro: 1, gearbox: 'race', tires: 'slick' }, boost: 0.898 },
  { name: 'Midnight', note: 'Owns the Strip. Beat him to finish the ladder.', skill: 'hard', color: '#4b1fa8', look: { model: 'raven', fbumper: 'track', rbumper: 'track', width: 'over', spoiler: 'tri', rimStyle: 'six', hood: 'vents', roof: 'louvers' }, perf: { engine: 3, turbo: 'big', nitro: 2, gearbox: 'race', tires: 'slick', ecu: 'high' }, boost: 1.05 }
];
const LOOK_KEYS = ['model', 'width', 'susp', 'fbumper', 'rbumper', 'skirt', 'hood', 'spoiler', 'exhaust', 'rimStyle', 'rimSize', 'brakes', 'roof', 'mirrors', 'fenderVents'];
const LANES2 = [1.9, -1.9], LANES3 = [3.4, 0, -3.4], TRAFFIC_N = 12;
const store = {
  get(k, d) { try { const v = localStorage.getItem('raven-rs-' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('raven-rs-' + k, v); } catch (e) { /* storage unavailable */ } }
};
let raceTrack = store.get('track', 'strip'), raceDiff = store.get('diff', 'normal'), raceMode = store.get('mode', 'ladder'), traffic = store.get('traffic', 'off') === 'on';
if (!TRACKS.some((t) => t[0] === raceTrack)) raceTrack = 'strip';
if (!DIFFS.some((d) => d[0] === raceDiff)) raceDiff = 'normal';
if (!MODES.some((m) => m[0] === raceMode)) raceMode = 'ladder';
let ladderNext = Math.max(0, Math.min(LADDER.length, parseInt(store.get('ladder', '0'), 10) || 0));
let ladderPick = Math.min(ladderNext, LADDER.length - 1);
let challenge = null;
const rivalPaint = new THREE.MeshPhysicalMaterial({ color: '#e7e8ee', metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
const ghostMat = new THREE.MeshBasicMaterial({ color: '#7fd7ff', transparent: true, opacity: 0.26, depthWrite: false });

/* ---- physics ---- */
const ROAD_DRAG = 0.42, TOP_GEAR = 0.7;
function cdaOf(c) { return 0.62 + modelOf(c).base.cda + ({ none: 0, lip: 0.005, duck: 0.01, roof: 0.008, gt: 0.05, swan: 0.045, tri: 0.07 })[c.spoiler] + ({ stock: 0, wide: 0.03, over: 0.025 })[c.width]; }
// top speed on the open road, km/h: where engine power meets drag, or the redline in top gear, whichever comes first
function topSpeed(c, hp, weight) {
  const M = modelOf(c), P = hp * 745.7 * 0.88, a = ROAD_DRAG * cdaOf(c), b = 0.015 * (weight + 80) * 9.81;
  let v = 60; for (let i = 0; i < 30; i++) v = Math.cbrt(Math.max(0, P - b * v) / a);
  const vg = (M.base.redline + c.engine * 300) * Math.PI / 30 * M.R / (TOP_GEAR * (c.finalDrive || 4.1));
  return Math.min(v, vg) * 3.6;
}
function physicsFor(c, factor) {
  const s = stats(c), M = modelOf(c), B = M.base;
  const redline = B.redline + c.engine * 300;
  // a model's torque bias moves the curve: muscle torque comes early, small revvy engines peak late
  const pk = (({ low: 0.5, balanced: 0.62, high: 0.74 })[c.ecu] || 0.62) - B.bias * 0.5;
  const base = (({ low: 0.62, balanced: 0.55, high: 0.45 })[c.ecu] || 0.55) + B.bias;
  const fall = ({ low: 0.4, balanced: 0.3, high: 0.2 })[c.ecu] || 0.3;
  const curve = (u) => (u <= pk ? base + (1 - base) * Math.sin(Math.PI / 2 * Math.min(1, Math.max(0, (u - 0.1) / (pk - 0.1)))) : 1 - fall * Math.pow((u - pk) / (1 - pk), 2));
  let best = 0; for (let u = 0.2; u <= 1.0001; u += 0.01) best = Math.max(best, curve(u) * u * redline * Math.PI / 30);
  const nt = ({ long: [1.25, 3.6], balanced: [1.38, 2.6], power: [1.55, 1.8] })[c.nitroTune] || [1.38, 2.6];
  return {
    redline, idle: 950, curve, tpk: s.hp * factor * 745.7 / best, mass: s.weight + 80,
    gears: [3.55, 2.32, 1.7, 1.32, 1.0, 0.7], final: c.finalDrive || 4.1, r: M.R,
    shiftTime: ({ stock: 0.3, sport: 0.19, race: 0.11 })[c.gearbox],
    grip: ({ street: 1.0, sport: 1.12, slick: 1.32 })[c.tires] * 0.74 * B.grip,
    // brakes: share of the tyres' grip they can use, and how much they lose when hot
    brakeK: ({ stock: 0.78, sport: 0.9, ceramic: 1.0 })[c.brakes] || 0.78, fade: ({ stock: 0.45, sport: 0.25, ceramic: 0.05 })[c.brakes] ?? 0.45,
    cda: cdaOf(c),
    bottles: c.nitro, nosMult: nt[0], nosDur: nt[1]
  };
}
const tyreGrip = (t) => 1 + 0.1 * (t < 70 ? Math.max(0, (t - 20) / 50) : t <= 95 ? 1 : Math.max(-0.6, 1 - (t - 95) / 12));
const newRacer = (ph) => ({ ph, x: 0, v: 0, a: 0, rpm: ph.idle, gear: 1, thr: 0, shiftT: 0, clutchT: 0, launchRpm: 0, launchPen: 1, spin: false, spinT: 0, heat: 0, blown: false, nosT: 0, bottles: ph.bottles, boostT: 0, time: 0, t60: 0, done: false, trap: 0, shifts: 0, perfect: 0, wheelA: 0, tire: 22, tireAtLaunch: 22, launched: false, rt: 0, dq: false, crashed: false, lane: 0, z: 0, zFrom: 0, laneT: 0, noFinish: false });

function stepRacer(c, gas, dt, phase, gripMul) {
  const p = c.ph, ratio = p.gears[c.gear - 1] * p.final;
  if (c.blown || c.done || c.crashed || c.dq) gas = false;
  c.thr += ((gas ? 1 : 0) - c.thr) * Math.min(1, dt * 12);
  if (phase !== 'run' || !c.launched) { // held on the brake: free-revving
    const target = c.thr > 0.05 ? p.idle + (p.redline - p.idle) * c.thr * 1.03 : p.idle;
    c.rpm += (target - c.rpm) * Math.min(1, dt * 3.2);
    if (c.rpm > p.redline) c.rpm = p.redline - 200 * Math.random();
    c.heat = c.rpm > p.redline * 0.97 ? Math.min(100, c.heat + 16 * dt) : Math.max(0, c.heat - 10 * dt);
    if (c.heat >= 100) c.blown = true;
    if (phase === 'burnout' && c.thr > 0.3) { c.tire = Math.min(125, c.tire + 24 * dt * c.thr); c.spin = true; c.wheelA += 30 * dt * c.thr; }
    else { c.spin = false; c.tire = Math.max(20, c.tire - 1.2 * dt); }
    if (phase === 'run' && !c.dq) c.time += dt; // reaction clock runs from the green
    return;
  }
  const wheelRpm = c.v / p.r * ratio * 30 / Math.PI;
  let F = 0;
  if (c.shiftT > 0) {
    c.shiftT -= dt;
    c.rpm += (Math.max(p.idle, wheelRpm) - c.rpm) * Math.min(1, dt * 16);
  } else {
    if (c.clutchT > 0) { c.clutchT -= dt; const k = Math.max(0, c.clutchT / 0.55); c.rpm = Math.max(wheelRpm, wheelRpm + (c.launchRpm - wheelRpm) * k); }
    else c.rpm = Math.max(p.idle, wheelRpm * (c.spin ? 1.08 : 1));
    const limiter = c.rpm >= p.redline;
    if (limiter) c.rpm = p.redline - Math.random() * 160;
    let T = limiter || c.blown ? 0 : p.tpk * p.curve(c.rpm / p.redline) * c.thr;
    if (c.nosT > 0) T *= p.nosMult;
    if (c.boostT > 0) T *= 1.06;
    F = T * ratio / p.r * 0.88 * (c.clutchT > 0 ? c.launchPen : 1);
    const grip = p.grip * gripMul * tyreGrip(c.tire) * p.mass * G;
    if (c.spinT > 0 && c.thr > 0.5) { c.spin = true; F = Math.min(F, grip) * 0.62; }
    else if (F > grip * 1.04) { c.spin = true; F = Math.min(F, grip) * 0.84; } else c.spin = false;
    c.heat = limiter && c.thr > 0.5 ? c.heat + 30 * dt : Math.max(0, c.heat - 8 * dt);
    if (c.heat >= 100) c.blown = true;
  }
  c.tire = c.spin ? Math.min(125, c.tire + 8 * dt) : Math.max(20, c.tire - 0.8 * dt);
  c.spinT = Math.max(0, c.spinT - dt); c.nosT = Math.max(0, c.nosT - dt); c.boostT = Math.max(0, c.boostT - dt);
  const drag = 0.6 * p.cda * c.v * c.v + (c.v > 0.05 ? 0.015 * p.mass * G : 0) + (c.done || c.crashed ? 7000 : 0);
  const mEff = p.mass * (1 + 0.0016 * ratio * ratio);
  c.a = (F - drag) / mEff;
  c.v = Math.max(0, c.v + c.a * dt);
  c.x += c.v * dt;
  c.wheelA += (c.v / p.r + (c.spin ? 22 : 0)) * dt;
  if (!c.done && !c.crashed) {
    c.time += dt;
    if (!c.t60 && c.x >= 18.29) c.t60 = c.time;
    if (!c.noFinish && c.x >= RACE_LEN) { c.done = true; c.time -= (c.x - RACE_LEN) / Math.max(c.v, 1); c.trap = c.v * 3.6; }
  }
}
function launch(c) {
  const u = c.rpm / c.ph.redline;
  c.launched = true; c.rt = c.time; c.tireAtLaunch = c.tire;
  c.launchRpm = c.rpm; c.clutchT = 0.55;
  if (c.blown) return ['ENGINE BLOWN', 'bad'];
  if (u >= 0.5 && u <= 0.68) { c.launchPen = 1; return ['PERFECT LAUNCH', '']; }
  if (u >= 0.38 && u < 0.5) { c.launchPen = 0.88; return ['GOOD LAUNCH', 'ok']; }
  if (u > 0.68 && u <= 0.8) { c.launchPen = 1; c.spinT = 0.35; return ['GOOD LAUNCH', 'ok']; }
  if (u < 0.38) { c.launchPen = 0.6; return ['BOGGED DOWN', 'bad']; }
  c.spinT = 1.3; return ['WHEELSPIN', 'bad'];
}
function shiftGear(c, dir) {
  const p = c.ph;
  if (c.shiftT > 0 || c.blown || c.done || c.crashed) return null;
  if (dir > 0) {
    if (c.gear >= 6) return null;
    const u = c.rpm / p.redline; let q, cls = 'ok', t = p.shiftTime;
    if (u >= 0.9 && u < 0.975) { q = 'PERFECT SHIFT'; cls = ''; t *= 0.55; c.boostT = 1; c.perfect++; }
    else if (u >= 0.975) { q = 'LATE SHIFT'; cls = 'bad'; }
    else if (u >= 0.8) q = 'GOOD SHIFT';
    else { q = 'EARLY SHIFT'; cls = 'bad'; }
    c.gear++; c.shiftT = t; c.shifts++;
    return [q, cls];
  }
  if (c.gear <= 1) return null;
  const wr = c.v / p.r * p.gears[c.gear - 2] * p.final * 30 / Math.PI;
  c.gear--; c.shiftT = p.shiftTime;
  if (wr > p.redline * 1.03) { c.heat = Math.min(100, c.heat + 30); if (c.heat >= 100) c.blown = true; return ['OVER-REV!', 'bad']; }
  return ['DOWNSHIFT', 'ok'];
}

/* ---- dyno (same physics, perfect driver) ---- */
function simRun(c, nos) {
  const me = newRacer(physicsFor(c, 1)), p = me.ph;
  me.noFinish = true; me.tire = 80;
  for (let t = 0; t < 1.5; t += H) stepRacer(me, me.rpm < p.redline * 0.6, H, 'stage', 1);
  launch(me); me.time = 0; me.rt = 0;
  let t100 = 0, et = 0, trap = 0, vmax = 0;
  for (let i = 0; i < 240 * 60 && me.x < 3000 && !me.blown; i++) {
    if (me.shiftT <= 0 && me.clutchT <= 0 && me.gear < 6 && me.rpm / p.redline >= 0.93) shiftGear(me, 1);
    if (nos && me.bottles > 0 && me.nosT <= 0 && me.gear >= 3) { me.bottles--; me.nosT = p.nosDur; }
    stepRacer(me, !(me.gear === 6 && me.rpm > p.redline * 0.985), H, 'run', 1);
    if (!t100 && me.v >= 27.78) t100 = me.time;
    if (!et && me.x >= RACE_LEN) { et = me.time; trap = me.v * 3.6; if (nos) break; }
    vmax = Math.max(vmax, me.v);
  }
  return { t100: t100 || 99, et: et || 99, trap, vmax: vmax * 3.6 };
}
const dynoCache = new Map();
function dyno(c) {
  const key = ['model', 'engine', 'turbo', 'nitro', 'gearbox', 'tires', 'finalDrive', 'ecu', 'nitroTune', 'spoiler', 'width', 'hood', 'skirt', 'fbumper', 'roof'].map((k) => c[k]).join('|');
  if (dynoCache.has(key)) return dynoCache.get(key);
  const ph = physicsFor(c, 1);
  let peakHp = 0, peakHpR = 0, peakNm = 0, peakNmR = 0;
  for (let r = 1000; r <= ph.redline; r += 50) {
    const T = ph.tpk * ph.curve(r / ph.redline), hp = T * r * Math.PI / 30 / 745.7;
    if (hp > peakHp) { peakHp = hp; peakHpR = r; } if (T > peakNm) { peakNm = T; peakNmR = r; }
  }
  const a = simRun(c, false), b = c.nitro ? simRun(c, true) : a;
  const res = { peakHp, peakHpR, peakNm, peakNmR, t100: a.t100, et: a.et, trap: a.trap, vmax: a.vmax, etN: b.et };
  dynoCache.set(key, res);
  return res;
}
function renderDyno(p, head, left) {
  const ph = physicsFor(cfg, 1), d = dyno(cfg);
  left.append(el('div', 'p-name', Math.round(d.peakHp) + ' HP · ' + Math.round(d.peakNm) + ' NM'));
  head.append(el('div', 'p-desc', 'Simulated pulls: warm tyres, perfect launch, shifts at 93% of the redline.'));
  const box = el('div', 'dyno');
  const cv = el('canvas'); cv.width = 1000; cv.height = 300; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Power and torque curves against engine speed');
  const dl = el('dl', 'dyno-grid');
  const row = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
  row('Peak power', Math.round(d.peakHp) + ' hp @ ' + d.peakHpR + ' rpm');
  row('Peak torque', Math.round(d.peakNm) + ' Nm @ ' + d.peakNmR + ' rpm');
  row('0–100 km/h', d.t100.toFixed(2) + ' s');
  row('1/4 mile', d.et.toFixed(2) + ' s @ ' + Math.round(d.trap) + ' km/h');
  row('1/4 mile + nitro', cfg.nitro ? d.etN.toFixed(2) + ' s' : 'No nitro fitted');
  row('Top speed', Math.round(d.vmax) + ' km/h');
  row('Redline · final drive', ph.redline + ' rpm · ' + ph.final.toFixed(2));
  box.append(cv, dl); p.append(box);
  const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, L = 64, Rr = 64, T = 18, B = 40;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6d6';
  const r0 = 1000, r1 = ph.redline, xs = (r) => L + (r - r0) / (r1 - r0) * (W - L - Rr);
  const maxHp = Math.ceil(d.peakHp * 1.15 / 50) * 50, maxNm = Math.ceil(d.peakNm * 1.15 / 50) * 50;
  const yHp = (v) => Hh - B - v / maxHp * (Hh - T - B), yNm = (v) => Hh - B - v / maxNm * (Hh - T - B);
  g.clearRect(0, 0, W, Hh);
  g.font = '600 15px Inter, sans-serif'; g.textBaseline = 'middle';
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1;
  for (let r = 1000; r <= r1; r += 1000) { g.beginPath(); g.moveTo(xs(r), T); g.lineTo(xs(r), Hh - B); g.stroke(); g.fillStyle = 'rgba(236,238,245,0.6)'; g.textAlign = 'center'; g.fillText(String(r / 1000) + 'k', xs(r), Hh - B + 20); }
  for (let i = 0; i <= 4; i++) {
    const y = T + i * (Hh - T - B) / 4; g.beginPath(); g.moveTo(L, y); g.lineTo(W - Rr, y); g.stroke();
    g.textAlign = 'right'; g.fillStyle = accent; g.fillText(String(Math.round(maxHp * (1 - i / 4))), L - 10, y);
    g.textAlign = 'left'; g.fillStyle = 'rgba(236,238,245,0.75)'; g.fillText(String(Math.round(maxNm * (1 - i / 4))), W - Rr + 10, y);
  }
  g.textAlign = 'center'; g.fillStyle = 'rgba(236,238,245,0.6)'; g.fillText('RPM', W / 2, Hh - 10);
  const line = (fn, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); for (let r = r0; r <= r1; r += 50) { const y = fn(r); r === r0 ? g.moveTo(xs(r), y) : g.lineTo(xs(r), y); } g.stroke(); };
  line((r) => yNm(ph.tpk * ph.curve(r / ph.redline)), 'rgba(236,238,245,0.85)', 3);
  line((r) => yHp(ph.tpk * ph.curve(r / ph.redline) * r * Math.PI / 30 / 745.7), accent, 4);
  g.fillStyle = 'rgba(59,255,138,0.12)'; g.fillRect(xs(ph.redline * 0.9), T, xs(ph.redline * 0.975) - xs(ph.redline * 0.9), Hh - T - B);
  g.textAlign = 'left'; g.font = 'italic 700 16px "Chakra Petch", sans-serif';
  g.fillStyle = accent; g.fillText('POWER (HP)', L + 8, T + 12);
  g.fillStyle = 'rgba(236,238,245,0.85)'; g.fillText('TORQUE (NM)', L + 130, T + 12);
  g.fillStyle = '#3bff8a'; g.fillText('SHIFT WINDOW', xs(ph.redline * 0.9) - 130, T + 12);
}

/* ---- AI ---- */
function aiThink(c, prof, phase) {
  const p = c.ph;
  if (phase === 'burnout') return race.t < 2.2;
  if (phase !== 'run' || !c.launched) return c.rpm < p.redline * prof.launch;
  if (c.shiftT <= 0 && c.clutchT <= 0 && c.gear < 6 && c.rpm / p.redline >= prof.next) { shiftGear(c, 1); prof.next = Math.min(0.97, prof.shift + (Math.random() - 0.5) * prof.jitter); }
  if (c.bottles > 0 && c.nosT <= 0 && c.gear >= prof.nos && c.shiftT <= 0) { c.bottles--; c.nosT = p.nosDur; }
  return true;
}
function changeLane(c, d) {
  const lanes = race.lanes, nl = c.lane + d;
  if (c.laneT > 0 || nl < 0 || nl >= lanes.length || c.crashed || c.done) return false;
  const other = c === race.me ? race.ai : race.me;
  if (other && other.lane === nl && Math.abs(other.x - c.x) < 5.4) return false;
  c.zFrom = c.z; c.lane = nl; c.laneT = 0.3; return true;
}
const halfOf = (c) => noseOf(c === race.me ? carRig : rivalRig) - 0.05;
const blockedLane = (lane, x0, x1) => race.cars.some((t) => t.lane === lane && t.x + 2.2 > x0 && t.x - 2.2 < x1);
function aiAvoid(c) {
  if (!race.cars.length || c.laneT > 0 || !c.launched || c.crashed) return;
  const look = 10 + c.v * race.prof.look, cx = c.x - halfOf(c);
  if (!blockedLane(c.lane, cx, c.x + look)) return;
  const opts = [c.lane - 1, c.lane + 1].filter((l) => l >= 0 && l < race.lanes.length).sort(() => Math.random() - 0.5);
  for (const l of opts) if (!blockedLane(l, cx - 6, c.x + look)) { changeLane(c, l - c.lane); return; }
}

/* ---- race scene objects ---- */
let rivalRig = null, ghostRig = null, trafficRig = null;
const rivalBlob = shadowBlob.clone(); rivalBlob.visible = false; scene.add(rivalBlob);
const smokeTex = radialTex('rgba(215,212,224,0.6)', 'rgba(215,212,224,0)');
const smoke = Array.from({ length: 40 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.userData.life = 0; scene.add(s); return s; });
let smokeI = 0;
function puff(x, z) {
  const s = smoke[smokeI++ % smoke.length];
  s.position.set(x + (Math.random() - 0.5) * 0.3, 0.25, z + (Math.random() - 0.5) * 0.3);
  s.scale.setScalar(0.6); s.userData.life = 1; s.visible = true;
}
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fb8ff').multiplyScalar(2.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const flames = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 10), flameMat); m.rotation.z = Math.PI / 2; m.visible = false; scene.add(m); return m; });
function placeCarFx(x, z) {
  shadowBlob.position.set(x, 0.006, z); glow.position.set(x, 0.008, z); glowL.position.set(x, 0.12, z);
  beams.forEach((l, i) => { const s = i ? -1 : 1; l.position.set(x + 2.2, 0.62, z + s * 0.55); l.target.position.set(x + 7, 0, z + s * 1.2); l.target.updateMatrixWorld(); });
}
// a racer's x is its front bumper; each rig is set back by its own nose length
const noseOf = (rig) => (rig && rig.userData.dims ? rig.userData.dims.front + 0.05 : 2.3);
function ensureRival(look) {
  const key = JSON.stringify(look);
  if (rivalRig && rivalRig.userData.key === key) return;
  if (rivalRig) { rivalRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(rivalRig); }
  rivalRig = makeRig(clean({ ...DEFAULTS, ...look }), new Map([[CM.paint, rivalPaint], [CM.plain, rivalPaint]]));
  rivalRig.userData.key = key; rivalRig.visible = false; scene.add(rivalRig);
}
function buildGhost(look) {
  if (ghostRig) { ghostRig.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(ghostRig); }
  const swap = new Map(); for (const m of [...Object.values(CM), rivalPaint]) if (m) swap.set(m, ghostMat);
  ghostRig = makeRig(clean({ ...DEFAULTS, ...look }), swap);
  ghostRig.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 6; } });
  ghostRig.visible = false; scene.add(ghostRig);
}
function ensureTraffic() {
  if (trafficRig) return trafficRig;
  const body = [], dark = [], tail = [];
  const b1 = new THREE.BoxGeometry(4.2, 0.62, 1.8); b1.translate(0, 0.62, 0); body.push(b1);
  const b2 = new THREE.BoxGeometry(2.2, 0.5, 1.6); b2.translate(-0.25, 1.17, 0); body.push(b2);
  const w = new THREE.BoxGeometry(2.24, 0.32, 1.64); w.translate(-0.25, 1.18, 0); dark.push(w);
  for (const x of [1.35, -1.35]) for (const z of [0.82, -0.82]) { const cy = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12); cy.rotateX(Math.PI / 2); cy.translate(x, 0.32, z); dark.push(cy); }
  for (const z of [0.6, -0.6]) { const t = new THREE.BoxGeometry(0.05, 0.12, 0.36); t.translate(-2.11, 0.78, z); tail.push(t); }
  const mk = (list, mat) => { const im = new THREE.InstancedMesh(mergeGeometries(plainAttrs(list)), mat, TRAFFIC_N); im.frustumCulled = false; im.visible = false; scene.add(im); return im; };
  trafficRig = {
    body: mk(body, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 })),
    dark: mk(dark, new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.6 })),
    tail: mk(tail, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b3a').multiplyScalar(2) }))
  };
  const cols = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a', '#8a6a4a', '#2a2d33'];
  for (let i = 0; i < TRAFFIC_N; i++) trafficRig.body.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  trafficRig.body.instanceColor.needsUpdate = true;
  return trafficRig;
}
const tm4 = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv3 = new THREE.Vector3(), ts3 = new THREE.Vector3(1, 1, 1), tz3 = new THREE.Vector3(0, 0, 0);
function placeTraffic() {
  if (!trafficRig) return;
  for (let i = 0; i < TRAFFIC_N; i++) {
    const t = race.cars[i];
    if (t) tm4.compose(tv3.set(t.x, 0, LANES3[t.lane]), tq, ts3); else tm4.compose(tv3.set(0, -50, 0), tq, tz3);
    for (const k of ['body', 'dark', 'tail']) trafficRig[k].setMatrixAt(i, tm4);
  }
  for (const k of ['body', 'dark', 'tail']) trafficRig[k].instanceMatrix.needsUpdate = true;
}
function showTraffic(on) { if (trafficRig) for (const k of ['body', 'dark', 'tail']) trafficRig[k].visible = on; }
const ghostX = (g, t) => {
  const s = g.s, f = t * 30, i = Math.floor(f);
  if (i < 0) return 0;
  if (i >= s.length - 1) { const n = s.length; const v = n > 1 ? (s[n - 1] - s[n - 2]) * 30 : 0; return s[n - 1] + v * (t - (n - 1) / 30); }
  return s[i] + (s[i + 1] - s[i]) * (f - i);
};
const ghostTimeAt = (g, x) => { const s = g.s; for (let i = 1; i < s.length; i++) if (s[i] >= x) return (i - 1 + (x - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1])) / 30; return null; };
function loadGhost(track) {
  try { const g = JSON.parse(store.get('ghost-' + track, 'null')); if (g && Array.isArray(g.s) && g.s.length > 10) return { t: g.t, s: g.s, look: g.look || {}, name: 'Your best' }; } catch (e) { /* no ghost */ }
  return null;
}
function encodeChallenge(me) {
  const look = {}; for (const k of LOOK_KEYS) look[k] = cfg[k];
  const s = race.rec; let prev = 0;
  const deltas = s.map((x) => { const d = Math.round((x - prev) * 100); prev += d / 100; return d; }).join(',');
  return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, k: race.track, t: +me.time.toFixed(3), n: (cfg.sticker || 'RAVEN').slice(0, 14), l: look, d: deltas }))));
}
function decodeChallenge(code) {
  const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!o || o.v !== 1 || !TRACKS.some((t) => t[0] === o.k) || typeof o.t !== 'number' || typeof o.d !== 'string') throw new Error('bad code');
  let acc = 0; const s = o.d.split(',').map((d) => { acc += (+d || 0) / 100; return +acc.toFixed(2); });
  if (s.length < 10) throw new Error('short');
  const look = {}; for (const k of LOOK_KEYS) if (o.l && o.l[k] !== undefined) look[k] = o.l[k];
  return { k: o.k, t: o.t, n: String(o.n || 'Friend').slice(0, 14), l: look, s };
}

/* ---- engine sound: a synth voice per car, with turbo spool and flutter ---- */
let audio = null, soundOn = store.get('sound', 'on') !== 'off';
// One engine cycle (two revs) is the fundamental, at rpm / 120 Hz. An engine with N cylinders fires N times
// per cycle, so harmonic N and its multiples carry the note; the half and quarter orders between them are
// the rasp and burble of uneven pipes. Each car has its own voice, and each voice has two spectra (on and
// off the throttle) that are crossfaded and pushed through fixed exhaust and intake resonances, so the
// timbre changes with revs and load instead of one tone sliding up and down.
// Every voice plays the same recorded engine, so the character comes from what is layered and filtered on top:
//   pf      playback speed of the recording          rec   [lo, hi] part of the recording's rpm range to use
//   cyl     firing pulses per engine cycle (I4 4, I5 5, I6 6, V8 8, V10 10; a two-rotor rotary fires like an I4)
//   half    level of the orders halfway between firings (V8 burble, I5 warble), quarter: the ones between those
//   syn     level of the synthesized layer (a PeriodicWave built from the orders above) under the recording
//   det     second synth oscillator at cyc * det: slow beating between the two (warble, V10 shimmer)
//   bright  0..1: how slowly the firing harmonics fall off (1 = rotary buzz)
//   clip    drive of the synth layer's waveshaper     rough  idle pitch wander     lope  idle throb (fades with revs)
//   form    exhaust resonances [Hz, Q, level] (peaking filters on the whole engine)    hi  intake resonance [Hz, Q]
//   vt      [revs share, dB]: a bright step above that share of the redline (VTEC)
//   tw      turbo whistle [Hz at no boost, Hz added at full boost, level]
//   pop     lift-off crackle [chance per frame, Hz, level, pops per burst]
const ENGINE_VOICE = {
  // fictional cars, voiced after the engines they stand in for
  raven: { pf: 1.16, cyl: 4, half: 0.06, quarter: 0, syn: 0.3, det: 1.004, bright: 0.2, clip: 2.6, rough: 0.07, lope: 0.08, eq: [['peaking', 900, 1, 2]], form: [[250, 2, 0.8], [1000, 3, 0.6], [2800, 4, 0.4]], hi: [1500, 2.2], tw: [1800, 4200, 1], pop: [0.08, 900, 1, 1] },
  ember: { pf: 1.3, cyl: 4, half: 0, quarter: 0, syn: 0.18, det: 1.003, bright: 0.3, clip: 2.2, rough: 0.05, lope: 0.04, eq: [['highpass', 85, 0.7, 0]], form: [[350, 2, 0.7], [1400, 4, 0.7], [3500, 5, 0.5]], hi: [1900, 2.4], vt: [0.66, 6], tw: [2400, 4600, 0.8], pop: [0.03, 1300, 0.6, 1] },
  blackjaw: { pf: 0.86, rec: [761, 5600], cyl: 8, half: 0.85, quarter: 0.45, syn: 0.34, det: 1.008, bright: 0.1, clip: 3.0, rough: 0.14, lope: 0.45, eq: [['lowshelf', 130, 0.7, 4]], form: [[90, 1.5, 1.2], [400, 2, 0.9], [1200, 3, 0.4]], hi: [1100, 2.0], tw: [1200, 3000, 1], pop: [0.06, 450, 1.1, 2] },
  vanta: { pf: 1.24, rec: [1500, 7150], cyl: 10, half: 0.15, quarter: 0, syn: 0.3, det: 1.0035, bright: 0.4, clip: 2.2, rough: 0.04, lope: 0.04, eq: [['lowshelf', 110, 0.7, -3]], form: [[300, 2, 0.6], [1500, 4, 0.8], [4000, 5, 0.7]], hi: [2100, 3.0], tw: [2600, 5000, 0.8], pop: [0.03, 1500, 1.4, 1] },
  // the imported cars, voiced after their real engines
  supra: { pf: 1.0, cyl: 6, half: 0.05, quarter: 0, syn: 0.32, det: 1.002, bright: 0.25, clip: 2.0, rough: 0.04, lope: 0.05, eq: [['highshelf', 3000, 0.7, -4]], form: [[180, 2, 0.9], [650, 3, 1.1], [1800, 4, 0.4]], hi: [1400, 2.0], tw: [2200, 6000, 1.6], pop: [0.07, 800, 1, 1] },
  rx7: { pf: 1.32, rec: [1200, 7150], cyl: 4, half: 0.35, quarter: 0.2, syn: 0.36, det: 1.006, bright: 1, clip: 5.0, rough: 0.3, lope: 0.2, eq: [['highpass', 120, 0.7, 0]], form: [[300, 2, 0.8], [1100, 4, 0.9], [3000, 5, 0.7]], hi: [2400, 2.6], tw: [2600, 4000, 0.7], pop: [0.16, 1000, 1.1, 2] },
  m4: { pf: 0.92, rec: [761, 6400], cyl: 6, half: 0.08, quarter: 0, syn: 0.4, det: 1.003, bright: 0.6, clip: 3.8, rough: 0.05, lope: 0.04, eq: [['lowshelf', 160, 0.7, 2]], form: [[140, 2, 1.1], [1200, 4, 1.1], [3200, 6, 1.2]], hi: [1700, 2.4], tw: [3800, 3000, 0.5], pop: [0.22, 1100, 1.2, 3] },
  audi90: { pf: 1.12, cyl: 5, half: 0.55, quarter: 0.1, syn: 0.36, det: 1.012, bright: 0.3, clip: 3.6, rough: 0.18, lope: 0.12, eq: [], form: [[220, 2, 0.9], [900, 3, 0.8], [2600, 4, 0.6]], hi: [1300, 2.0], tw: [1300, 2600, 1.4], pop: [0.3, 600, 1.6, 2] }
};
const voiceOf = (id) => ENGINE_VOICE[id] || ENGINE_VOICE[baseOf(id)] || ENGINE_VOICE.raven;
// the synth layer's spectrum: harmonics of the engine cycle (rpm / 120 Hz). Firing harmonics (multiples of cyl)
// carry the note, the half and quarter orders between them add burble and warble, everything else a little grit.
function engineWave(ctx, V) {
  const N = Math.min(48, V.cyl * 3 + 2), re = new Float32Array(N + 1), im = new Float32Array(N + 1), c = V.cyl;
  for (let k = 1; k <= N; k++) {
    const r = k % c, ord = k / c;
    let a;
    if (r === 0) a = 1 / Math.pow(ord, 1.2 - V.bright * 0.8);
    else if (Math.abs(r - c / 2) <= 0.5) a = V.half * 0.8 / (ord + 0.5);
    else if (Math.abs(r - c / 4) <= 0.5 || Math.abs(r - 3 * c / 4) <= 0.5) a = V.quarter * 0.6 / (ord + 0.5);
    else a = (0.04 + V.bright * 0.25) / (ord + 1);
    im[k] = a;
  }
  return ctx.createPeriodicWave(re, im);
}
// Recorded engine: loops cut from a real acceleration ramp, a deceleration ramp and an idle take, one every 250-500 rpm.
// Each loop was straightened to a constant speed and holds a whole number of engine cycles (its true rpm measured from
// the waveform), so all loops can run in step: playback speed follows the revs, the two loops nearest the current
// revs are crossfaded, and the throttle fades between the "on" (accelerating) and "off" (coasting) layers.
import { ENG_SMP } from './audio/engineSamples.js';
const REC_IDLE = ENG_SMP.on[0][0], REC_TOP = 7150;
let ENG_F32 = null;
function engineSamples() {
  if (ENG_F32) return ENG_F32;
  const dec = (b64) => { const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; } return f; };
  const lay = (L) => L.map(([rpm, nc, b]) => ({ rpm, nc, f: dec(b) }));
  ENG_F32 = { on: lay(ENG_SMP.on), off: lay(ENG_SMP.off) };
  return ENG_F32;
}
function softClip(n = 1024, k = 2.4) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function audioStart(testCtx) {
  if (audio || (!soundOn && !testCtx)) return;
  try {
    const ctx = testCtx || new (window.AudioContext || window.webkitAudioContext)();
    const V = voiceOf(cfg.model);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
    const out = ctx.createGain(); out.gain.value = 1.3; out.connect(comp); comp.connect(ctx.destination);
    const fx = ctx.createGain(); fx.gain.value = 1; fx.connect(ctx.destination); // turbo effects skip the engine compressor so they cut through
    if (!testCtx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    loadFlutter(ctx);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), ch = nb.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random()); return s; };
    const GN = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const BQ = (type, f, q, gain) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (gain !== undefined) b.gain.value = gain; return b; };
    const OSC = (wave, f) => { const o = ctx.createOscillator(); if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave); o.frequency.value = f; o.start(); return o; };
    // engine core: the recorded loops, started together so they stay in step
    const SM = engineSamples(), eng = GN(1), g = GN(0), t0 = ctx.currentTime + 0.03;
    const layer = (list) => {
      const lg = GN(0); lg.connect(eng);
      return { lg, loops: list.map((l) => { const b = ctx.createBuffer(1, l.f.length, ENG_SMP.sr); b.getChannelData(0).set(l.f); const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; const gn = GN(0); src.connect(gn); gn.connect(lg); src.start(t0); return { rpm: l.rpm, src, gn }; }) };
    };
    const lOn = layer(SM.on), lOff = layer(SM.off);
    // synth layer under the recording: two detuned oscillators -> waveshaper -> lowpass that opens with revs
    const wave = engineWave(ctx, V), so1 = OSC(wave, 40), so2 = OSC(wave, 40), sIn = GN(0.55), s2g = GN(0.7);
    const shaper = ctx.createWaveShaper(); shaper.curve = softClip(1024, V.clip + (cfg.engine || 0) * 0.5); shaper.oversample = '2x';
    const slp = BQ('lowpass', 1500, 0.7), synG = GN(0);
    so1.connect(sIn); so2.connect(s2g); s2g.connect(sIn); sIn.connect(shaper); shaper.connect(slp); slp.connect(synG); synG.connect(eng);
    // the car's EQ, its exhaust resonances, then shelves for the exhaust type, a turbo's muffling and the VTEC step
    let tail = eng; for (const [type, f, q, gain] of V.eq) { const e = BQ(type, f, q, gain); tail.connect(e); tail = e; }
    for (const [f, q, lv] of V.form) { const e = BQ('peaking', f, q, lv * 5); tail.connect(e); tail = e; }
    const exLow = ({ single: -2, dual: 0, quad: 2.5, center: 1.5 })[cfg.exhaust] || 0, exHigh = ({ single: 2, dual: 0, quad: -1, center: 1 })[cfg.exhaust] || 0;
    const ls = BQ('lowshelf', 140, 0.7, exLow), hs = BQ('highshelf', 2800, 0.7, exHigh - (cfg.turbo !== 'none' ? 2 : 0));
    tail.connect(ls); ls.connect(hs);
    // idle lope: the engine's level throbs once per cycle, strongest at idle
    const lopeG = GN(1), lopeO = OSC('sine', 7), lopeD = GN(0); lopeO.connect(lopeD); lopeD.connect(lopeG.gain);
    hs.connect(lopeG); lopeG.connect(g); g.connect(out);
    // exhaust rasp and intake roar: noise pulsed at the firing frequency
    const firing = OSC('sine', 48);
    const rbp = BQ('bandpass', 900, 1.4), ram = GN(0.5), depth = GN(0.5), rg = GN(0);
    firing.connect(depth); depth.connect(ram.gain); noise().connect(rbp); rbp.connect(ram); ram.connect(rg); rg.connect(out);
    const ibp = BQ('bandpass', V.hi[0], V.hi[1] * 0.4), iam = GN(0.5), idepth = GN(0.5), ig = GN(0);
    firing.connect(idepth); idepth.connect(iam.gain); noise().connect(ibp); ibp.connect(iam); iam.connect(ig); ig.connect(out);
    // turbo: spool whistle plus a thin compressor hiss
    const wh = OSC('sine', 2000), whg = GN(0); wh.connect(whg); whg.connect(out);
    const thf = BQ('bandpass', 5200, 5), thg = GN(0); noise().connect(thf); thf.connect(thg); thg.connect(out);
    // nitro hiss
    const hf = BQ('highpass', 3200, 0.7), hg = GN(0); noise().connect(hf); hf.connect(hg); hg.connect(out);
    // the car moving through the air and over the road, tyres letting go, straight-cut gear whine
    const windF = BQ('lowpass', 500, 0.5), windG = GN(0); noise().connect(windF); windF.connect(windG); windG.connect(out);
    const roadF = BQ('bandpass', 120, 0.6), roadG = GN(0); noise().connect(roadF); roadF.connect(roadG); roadG.connect(out);
    const sq1 = BQ('bandpass', 1000, 16), sq2 = BQ('bandpass', 1500, 20), sq2g = GN(0.55), sqG = GN(0);
    const sqn = noise(); sqn.connect(sq1); sqn.connect(sq2); sq1.connect(sqG); sq2.connect(sq2g); sq2g.connect(sqG); sqG.connect(fx);
    const whine = OSC('triangle', 400), whineG = GN(0); whine.connect(whineG); whineG.connect(out);
    audio = { ctx, out, fx, nb, V, lOn, lOff, g, so1, so2, slp, synG, hs, hsBase: exHigh - (cfg.turbo !== 'none' ? 2 : 0), lopeO, lopeD, firing, rbp, rg, ibp, ig, wh, whg, thf, thg, hg, windF, windG, roadG, sq1, sq2, sqG, whine, whineG, spool: 0, lim: 0, popT: 0, duckT: 0, flut: null, jit: 0, sq: 0, prevVol: 0 };
  } catch (e) { audio = null; }
}
// c: { ph, rpm, thr, shiftT, launched, blown, nosT } plus optional v (m/s) and slide (0..1, tyres letting go)
function audioUpdate(c, dt = 1 / 60) {
  if (!audio) return;
  const a = audio, t = a.ctx.currentTime, p = c.ph, V = a.V, u = Math.min(1.02, c.rpm / p.redline);
  const S = (prm, v, tc) => { if (Number.isFinite(v)) prm.setTargetAtTime(v, t, tc); };
  // no engine holds a perfectly steady speed: the pitch wanders a little, most at idle
  a.jit += ((Math.random() - 0.5) * 0.02 * (V.rough / 0.07) - a.jit) * Math.min(1, dt * 5);
  const cyc = Math.max(7, c.rpm / 120) * (1 + a.jit * Math.max(0.15, 1.1 - u * 1.4)), fire = cyc * V.cyl;
  // load: free revs barely build boost, an open throttle in gear does; a shift dumps it
  const vol = c.shiftT > 0 || c.blown ? 0 : c.thr, load = vol * (c.launched ? 1 : 0.3);
  S(a.firing.frequency, fire, 0.015);
  // synth layer and idle lope follow the cycle frequency; the synth gets louder on throttle
  S(a.so1.frequency, cyc, 0.015); S(a.so2.frequency, cyc * V.det, 0.015);
  S(a.slp.frequency, 900 + u * 4500 + vol * 800, 0.04);
  S(a.synG.gain, V.syn * (0.55 + 0.45 * vol), 0.03);
  S(a.lopeO.frequency, cyc, 0.02);
  S(a.lopeD.gain, V.lope * (cfg.ecu === 'low' ? 1.4 : 1) * Math.pow(Math.max(0, 1 - u * 1.6), 2) * 0.5, 0.05);
  S(a.hs.gain, a.hsBase + (V.vt && u > V.vt[0] ? V.vt[1] : 0), 0.06);
  // where the game's revs sit on the recorded car's range, then: speed for every loop, level for the two nearest
  const [rLo, rHi] = V.rec || [REC_IDLE, REC_TOP];
  const rr = rLo + clamp((c.rpm - p.idle) / (p.redline - p.idle), 0, 1.02) * (rHi - rLo), rj = rr * (1 + a.jit * Math.max(0.1, 0.8 - u));
  for (const [L, lv] of [[a.lOn, Math.sin(vol * Math.PI / 2)], [a.lOff, Math.cos(vol * Math.PI / 2)]]) {
    S(L.lg.gain, lv, 0.035);
    const n = L.loops.length; let i = 0; while (i < n - 2 && L.loops[i + 1].rpm <= rr) i++;
    const x = clamp((rr - L.loops[i].rpm) / (L.loops[i + 1].rpm - L.loops[i].rpm), 0, 1);
    for (let k = 0; k < n; k++) { const l = L.loops[k]; S(l.src.playbackRate, V.pf * rj / l.rpm, 0.015); S(l.gn.gain, k === i ? Math.cos(x * Math.PI / 2) : k === i + 1 ? Math.sin(x * Math.PI / 2) : 0, 0.02); }
  }
  S(a.rbp.frequency, Math.min(6000, fire * 3.2), 0.03); S(a.ibp.frequency, V.hi[0] * (0.45 + 0.75 * u), 0.05);
  // rev limiter: the ignition cuts in and out
  a.lim = c.rpm >= p.redline - 170 && c.thr > 0.5 ? (a.lim + 1) % 4 : 0;
  const cut = (a.lim >= 2 ? 0.35 : 1) * (t < a.duckT ? 0.4 : 1); // duck under the turbo flutter
  S(a.g.gain, c.blown ? 0 : (0.1 + vol * 0.17 + u * 0.09) * cut, 0.025);
  S(a.rg.gain, c.blown ? 0 : (0.002 + vol * 0.009 + (1 - vol) * u * 0.004) * cut * (cfg.exhaust === 'single' ? 0.8 : 1.1), 0.03);
  S(a.ig.gain, c.blown ? 0 : vol * (0.25 + 0.75 * u) * 0.009 * cut, 0.04);
  // turbo spool lags behind the throttle; a big turbo comes on later and harder
  const big = cfg.turbo === 'big', turbo = cfg.turbo !== 'none';
  const target = turbo ? load * Math.max(0, Math.min(1, (u - (big ? 0.42 : 0.3)) / 0.45)) : 0;
  if (c.launched && c.shiftT <= 0 && a.prevVol > 0.6 && c.thr < 0.3 && a.spool > 0.3) flutter(); // lifting off with boost up flutters too
  a.prevVol = vol;
  a.spool += (target - a.spool) * Math.min(1, dt * (target > a.spool ? (big ? 1.6 : 2.6) : 9));
  S(a.wh.frequency, V.tw[0] + a.spool * V.tw[1] * (big ? 0.8 : 1), 0.05);
  S(a.whg.gain, a.spool * (big ? 0.045 : 0.035) * V.tw[2], 0.05);
  S(a.thg.gain, a.spool * (big ? 0.05 : 0.035), 0.05);
  S(a.hg.gain, c.nosT > 0 ? 0.045 : 0, 0.05);
  if (a.flut && vol > 0.5 && t - a.flut.t0 > 0.55 && !a.flut.fading) { a.flut.fading = true; a.flut.g.gain.setTargetAtTime(0, t, 0.22); }
  // wind and road noise grow with speed; tyres howl when they slide
  const v = Math.abs(c.v || 0), sl = clamp(c.slide !== undefined ? c.slide : c.spin ? 0.7 : 0, 0, 1);
  S(a.windF.frequency, 420 + v * 16, 0.1); S(a.windG.gain, Math.min(0.06, v * v / 3600 * 0.06), 0.1);
  S(a.roadG.gain, Math.min(1, v / 35) * 0.03, 0.1);
  a.sq += (sl - a.sq) * Math.min(1, dt * (sl > a.sq ? 12 : 6));
  S(a.sq1.frequency, 860 + a.sq * 240 + Math.min(v, 40) * 4, 0.05); S(a.sq2.frequency, (860 + a.sq * 240 + Math.min(v, 40) * 4) * 1.52, 0.05);
  S(a.sqG.gain, a.sq * a.sq * 0.11, 0.03);
  S(a.whine.frequency, clamp(v * 42, 180, 4200), 0.04); S(a.whineG.gain, cfg.gearbox === 'race' ? Math.min(1, v / 18) * (0.3 + 0.7 * vol) * 0.006 : 0, 0.05);
  // lift-off crackle from the exhaust
  a.popT -= dt;
  const P = V.pop;
  if (c.launched && c.thr < 0.15 && c.shiftT <= 0 && u > 0.5 && a.popT <= 0 && Math.random() < P[0] * (cfg.ecu === 'high' ? 1.5 : 1)) {
    a.popT = 0.06 + (P[3] - 1) * 0.05;
    for (let i = 0; i < P[3]; i++) pop((0.06 + Math.random() * 0.05) * P[2], P[1] * (0.8 + Math.random() * 0.4), i * (0.03 + Math.random() * 0.03));
  }
}
function burst(at, dur, f, q, vol, fEnd, dest) {
  const { ctx, nb, out } = audio;
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = nb; bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f, at); if (fEnd) bp.frequency.exponentialRampToValueAtTime(fEnd, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  src.connect(bp); bp.connect(g); g.connect(dest || out); src.start(at, Math.random() * 0.8); src.stop(at + dur + 0.02);
}
function pop(vol, f, delay = 0) {
  if (!audio) return;
  try { burst(audio.ctx.currentTime + delay, 0.045, f || 700 + Math.random() * 500, 0.8, vol); } catch (e) { /* audio is optional */ }
}
// "tsu-tu-tu-tu": boost dumps with a hiss, then the compressor surges and flutters out
// recorded turbo flutter ("stu-tu-tu"), decoded once and reused by every race
import { FLUTTER_MP3 } from './audio/flutterClip.js';
let flutterBuf = null, flutterLoading = false;
function loadFlutter(ctx) {
  if (flutterBuf || flutterLoading) return;
  flutterLoading = true;
  try {
    const bin = atob(FLUTTER_MP3), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(u8.buffer, (b) => { flutterBuf = b; }, () => { flutterLoading = false; });
  } catch (e) { flutterLoading = false; }
}
// fallback if the clip is not decoded yet: a train of low air chuffs at ~13 Hz that slows and fades
function flutterSynth(t, s, n = 18) {
  const { ctx, nb, fx } = audio;
  let at = t, gap = 0.062, vol = 0.55 * s;
  for (let i = 0; i < n; i++) {
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nb; lp.type = 'bandpass'; lp.frequency.value = 380 + Math.random() * 120; lp.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, at + gap * 0.9);
    src.connect(lp); lp.connect(g); g.connect(fx); src.start(at, Math.random() * 0.8); src.stop(at + gap);
    at += gap * (0.85 + Math.random() * 0.3); gap *= 1.02; vol *= 0.87;
  }
  burst(t, 0.12, 3200, 0.8, 0.35 * s, 1600, fx);
}
// Lifting off with boost up opens the blow-off valve: a short falling hiss whose length and level follow the boost.
// The recorded compressor flutter plays only if the driver picks it, only on a real lift (never on a gear change)
// and only with plenty of boost. Either way the sound is rate-limited so it never chatters.
function flutter(shift) {
  const mode = cfg.bov || 'soft';
  if (!audio || cfg.turbo === 'none' || mode === 'off') return;
  try {
    const { ctx, fx } = audio, t = ctx.currentTime, sp = audio.spool, big = cfg.turbo === 'big';
    if (sp < 0.25 || t < (audio.flutNext || 0)) return;
    audio.flutNext = t + (shift ? 0.9 : 1.8) + Math.random() * 1.2;
    const s = Math.min(1, 0.3 + sp * 0.8) * (big ? 1 : 0.75);
    if (audio.flut) { try { audio.flut.g.gain.setTargetAtTime(0, t, 0.03); audio.flut.src.stop(t + 0.15); } catch (e) { /* already ended */ } audio.flut = null; }
    if (mode === 'flutter' && !shift && sp > 0.55 && flutterBuf) {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = flutterBuf; src.playbackRate.value = (big ? 0.93 : 1.07) * (0.92 + Math.random() * 0.16);
      const dur = Math.min(flutterBuf.duration / src.playbackRate.value, 0.5 + sp * 0.7);
      g.gain.setValueAtTime(0.5 * s, t); g.gain.setTargetAtTime(0, t + dur * 0.65, dur * 0.18);
      src.connect(g); g.connect(fx); src.start(t); src.stop(t + dur + 0.3);
      audio.flut = { src, g, t0: t };
    } else {
      const dur = 0.16 + 0.22 * sp + Math.random() * 0.06;
      burst(t, dur, (big ? 2400 : 3400) * (0.9 + Math.random() * 0.2), 0.7, 0.085 * s, 700, fx);
      burst(t + 0.01, dur * 0.7, 6200, 0.9, 0.03 * s, 2600, fx);
    }
    audio.spool *= 0.25; audio.duckT = t + 0.12 + 0.12 * s;
  } catch (e) { /* audio is optional */ }
}
function audioStop() { if (!audio) return; const a = audio; audio = null; try { a.out.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05); a.fx.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05); setTimeout(() => { if (a.ctx.close) a.ctx.close(); }, 300); } catch (e) { /* already closed */ } }

/* ---- HUD ---- */
const tach = $('tach'), tg = tach.getContext('2d');
function drawTach(c, staged) {
  const p = c.ph, cx = 230, cy = 236, R = 206, maxR = Math.ceil((p.redline + 900) / 1000) * 1000;
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, ang = (r) => a0 + sweep * Math.min(1, Math.max(0, r / maxR));
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6d6';
  tg.clearRect(0, 0, 460, 460);
  tg.fillStyle = 'rgba(8,8,16,0.84)'; tg.beginPath(); tg.arc(cx, cy, R + 12, 0, Math.PI * 2); tg.fill();
  const band = (r0, r1, col) => { tg.strokeStyle = col; tg.lineWidth = 16; tg.beginPath(); tg.arc(cx, cy, R - 12, ang(r0), ang(r1)); tg.stroke(); };
  band(0, maxR, 'rgba(255,255,255,0.1)');
  if (staged) band(p.redline * 0.5, p.redline * 0.68, '#3bff8a'); else band(p.redline * 0.9, p.redline * 0.975, '#3bff8a');
  band(p.redline, maxR, '#ff4060');
  tg.textAlign = 'center'; tg.textBaseline = 'middle';
  for (let k = 0; k <= maxR; k += 500) {
    const a = ang(k), big = k % 1000 === 0, r1 = R - 30, r2 = R - (big ? 54 : 42);
    tg.strokeStyle = big ? '#eceef5' : 'rgba(236,238,245,0.45)'; tg.lineWidth = big ? 4 : 2;
    tg.beginPath(); tg.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); tg.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); tg.stroke();
    if (big) { tg.fillStyle = k >= p.redline ? '#ff6b7d' : '#eceef5'; tg.font = 'italic 700 26px "Chakra Petch", sans-serif'; tg.fillText(String(k / 1000), cx + Math.cos(a) * (R - 80), cy + Math.sin(a) * (R - 80)); }
  }
  tg.fillStyle = 'rgba(236,238,245,0.55)'; tg.font = '600 15px Inter, sans-serif'; tg.fillText('RPM ×1000', cx, cy - 64);
  tg.fillStyle = c.shiftT > 0 ? 'rgba(236,238,245,0.35)' : '#ffffff'; tg.font = 'italic 700 96px "Chakra Petch", sans-serif'; tg.fillText(c.launched ? String(c.gear) : 'N', cx, cy + 72);
  tg.fillStyle = '#eceef5'; tg.font = 'italic 700 34px "Chakra Petch", sans-serif'; tg.fillText(Math.round(c.v * 3.6) + ' KM/H', cx, cy + 150);
  const a = ang(c.rpm);
  tg.strokeStyle = accent; tg.lineWidth = 7; tg.lineCap = 'round';
  tg.beginPath(); tg.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18); tg.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); tg.stroke();
  tg.fillStyle = '#1a1b24'; tg.beginPath(); tg.arc(cx, cy, 18, 0, Math.PI * 2); tg.fill();
}
const leds = Array.from($('leds').children);
function drawLeds(c, staged) {
  const u = c.rpm / c.ph.redline, lo = staged ? 0.5 : 0.9, hi = staged ? 0.68 : 0.975;
  $('leds').classList.toggle('shift', u >= lo && u < hi);
  const th = staged ? [0.2, 0.28, 0.36, 0.42, 0.46, 0.48, 0.5] : [0.6, 0.66, 0.72, 0.78, 0.83, 0.87, 0.9];
  leds.forEach((l, i) => { l.className = u >= th[i] ? (i < 3 ? 'on1' : i < 5 ? 'on2' : 'on3') : ''; });
}
let calloutTimer = 0;
function callout(text, cls = '', ms = 1100) {
  const c = $('callout'); c.textContent = text; c.className = 'callout ' + cls + (text.length > 26 ? ' long' : '');
  clearTimeout(calloutTimer); if (ms) calloutTimer = setTimeout(() => { c.textContent = ''; }, ms);
}
function renderNos(c) {
  const box = $('nos'); box.replaceChildren();
  const total = c.ph.bottles;
  if (!total) { box.append(el('span', 'none', 'None fitted')); return; }
  for (let i = 0; i < total; i++) { const b = el('i'); if (i >= c.bottles) b.className = c.nosT > 0 && i === c.bottles ? 'live' : 'used'; box.append(b); }
}

/* ---- race flow ---- */
const race = { active: false, phase: 'idle', t: 0, me: null, ai: null, prof: null, ghost: null, opp: '', gasKey: false, gasPad: false, launchQ: '', prevLoc: 'garage', endT: 0, smokeT: 0, lanes: LANES2, cars: [], rec: [], recT: 0, slow: 0, kick: 0, camZ: 0, stageT: 0, treeDelay: 1, greenT: 0, aiLaunchAt: 0, track: 'strip', gripMul: 1, mode: 'quick', ladderIdx: -1 };
function startRace() {
  if (raceMode === 'challenge' && !challenge) { say('Paste a challenge code and press Load first.', true); return; }
  if (raceMode !== 'mp') race.mpOpp = null;
  const track = raceMode === 'challenge' ? challenge.k : raceTrack;
  if (!race.active) race.prevLoc = loc;
  setLocation(track);
  const env = ENVS[track];
  const lanes = traffic ? LANES3 : LANES2;
  Object.assign(race, { active: true, phase: 'burnout', t: 0, gasKey: false, gasPad: false, launchQ: '', endT: 0, lanes, rec: [], recT: 0, slow: 0, kick: 0, track, gripMul: track === 'rain' ? 0.86 : 1, mode: raceMode, ladderIdx: -1, ghost: null, ai: null, opp: '', nosShown: '' });
  race.me = newRacer(physicsFor(cfg, 1)); race.me.lane = 0; race.me.z = lanes[0];
  if (raceMode === 'ladder' || raceMode === 'quick') {
    let look, perf, factor, d, color;
    if (raceMode === 'ladder') { const r = LADDER[ladderPick]; race.ladderIdx = ladderPick; look = { ...RIVAL_BASE, ...r.look }; perf = r.perf; factor = r.boost || 1; d = DIFFS.find((x) => x[0] === r.skill); color = r.color; race.opp = r.name; }
    else { d = DIFFS.find((x) => x[0] === raceDiff); look = { ...RIVAL_BASE, model: cfg.model }; perf = {}; factor = d[2]; color = '#e7e8ee'; race.opp = 'Rival'; }
    ensureRival(look); rivalPaint.color.set(color);
    race.ai = newRacer(physicsFor(clean({ ...cfg, ...look, ...(raceMode === 'ladder' ? { finalDrive: 4.1, ecu: 'balanced', nitroTune: 'balanced' } : {}), ...perf }), factor));
    race.ai.lane = lanes.length - 1; race.ai.z = lanes[lanes.length - 1];
    race.prof = { launch: d[3], shift: d[4], next: d[4], jitter: d[5], nos: d[6], rt: d[7], look: d[8] };
    rivalRig.visible = true; rivalBlob.visible = true;
  } else if (raceMode === 'mp') {
    const o = race.mpOpp;
    ensureRival(o.look); rivalPaint.color.set(o.color);
    rivalRig.visible = true; rivalBlob.visible = true; race.opp = o.name;
  } else {
    if (rivalRig) rivalRig.visible = false; rivalBlob.visible = false;
    race.ghost = raceMode === 'test' ? loadGhost(track) : { t: challenge.t, s: challenge.s, look: challenge.l, name: challenge.n };
    race.opp = race.ghost ? race.ghost.name : '';
    if (race.ghost) { buildGhost(race.ghost.look); ghostRig.visible = true; }
  }
  if (ghostRig && !race.ghost) ghostRig.visible = false;
  // traffic: same speed in every lane, never the same lane twice in a row
  race.cars = [];
  if (traffic) {
    ensureTraffic(); showTraffic(true);
    let x = 80, last = -1;
    while (race.cars.length < TRAFFIC_N && x < 420) {
      const choices = [0, 1, 2].filter((l) => l !== last), lane = choices[Math.floor(Math.random() * choices.length)];
      race.cars.push({ x, lane, v: 12 }); last = lane; x += 28 + Math.random() * 14;
    }
    placeTraffic();
  } else showTraffic(false);
  race.camZ = race.me.z + 5.2;
  controls.enabled = false; setSpin(false); tween = null;
  if (env.far) env.far.rotation.y = Math.PI;
  $('stage').classList.add('racing'); $('race').hidden = false; $('result').hidden = true; $('result').replaceChildren();
  $('rMode').textContent = ((MODES.find((m) => m[0] === raceMode) || [0, 'Online 1v1'])[1] + (race.opp ? ' · vs ' + race.opp : '')).toUpperCase();
  $('bLeft').hidden = $('bRight').hidden = $('laneHint').hidden = !traffic;
  Array.from($('tree').children).forEach((i) => { i.className = i.classList.contains('g') ? 'g' : ''; });
  callout('BURNOUT: HOLD GAS TO HEAT THE TYRES · E TO STAGE', 'ok', 0);
  renderNos(race.me);
  audioStart();
  invalidate();
}
function stageCars() {
  race.phase = 'stage'; race.stageT = race.t; race.treeDelay = 0.7 + Math.random() * 0.9;
  const o = race.mode === 'mp' ? race.mpOpp : null;
  if (o) { // online: the tree waits until both cars are staged, then the host picks the delay for both
    race.treeDelay = 1e9; o.meStaged = true; mpSend(o.id, { k: 'stg', n: o.n });
    callout('STAGED · WAITING FOR ' + o.name.toUpperCase(), 'ok', 0); mpTryGo(); return;
  }
  callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0);
}
function exitRace() {
  race.active = false; race.phase = 'idle';
  audioStop();
  $('stage').classList.remove('racing'); $('race').hidden = true;
  if (rivalRig) rivalRig.visible = false; if (ghostRig) ghostRig.visible = false; rivalBlob.visible = false; showTraffic(false);
  smoke.forEach((s) => { s.visible = false; }); flames.forEach((f) => { f.visible = false; });
  for (const e of Object.values(ENVS)) { if (e.far) e.far.rotation.y = 0; if (e.sunBase) { e.sun.position.copy(e.sunBase); e.sun.target.position.set(0, 0, 0); e.sun.target.updateMatrixWorld(); } }
  carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = 0; });
  placeCarFx(0, 0);
  setLocation(race.prevLoc);
  controls.enabled = true; controls.target.set(0, 0.55, 0); setView(42, 9, 10.8); resize(); controls.update();
  renderer.shadowMap.needsUpdate = true; render(); renderStats(); invalidate();
  if (race.mpOpp) { if (!race.mpOpp.sentFin) mpSend(race.mpOpp.id, { k: 'quit', n: race.mpOpp.n }); race.mpOpp = null; mp.race = null; }
  if (race.fromRoam) { const sp = race.fromRoam; race.fromRoam = null; startRoam(sp); }
}
function pressLaunch() {
  const me = race.me;
  if (race.phase === 'burnout') { stageCars(); return; }
  if (race.phase === 'stage' && race.treeDelay > 1e8) return; // online: still waiting for the other car, the tree is not running
  if (race.phase === 'stage') { me.dq = true; me.v = 0; callout('RED LIGHT', 'bad'); finishRace(); return; }
  if (race.phase === 'run' && !me.launched) {
    const q = launch(me); race.launchQ = q[0].charAt(0) + q[0].slice(1).toLowerCase();
    callout(q[0] + ' · RT ' + me.rt.toFixed(3), q[1], 1500); return;
  }
  doShift(1);
}
function doShift(dir) {
  if (race.phase !== 'run' || !race.me.launched) return;
  const q = shiftGear(race.me, dir);
  if (q) { callout(q[0], q[1]); if (dir > 0) flutter(true); }
}
function doNos() {
  const me = race.me;
  if (race.phase !== 'run' || !me.launched || me.blown || me.done || me.crashed) return;
  if (!me.ph.bottles) { callout('NO NITRO FITTED', 'bad'); return; }
  if (me.bottles > 0 && me.nosT <= 0) { me.bottles--; me.nosT = me.ph.nosDur; callout('NITRO!', ''); renderNos(me); }
}
function doLane(d) {
  if (!traffic || race.phase !== 'run' || !race.me.launched) return;
  changeLane(race.me, d);
}
function finishRace() {
  if (race.phase === 'result') return;
  race.phase = 'result';
  const me = race.me, ai = race.ai, g = race.ghost;
  const finished = me.done && !me.dq && !me.crashed;
  if (race.mode === 'mp' && race.mpOpp && !race.mpOpp.sentFin) { race.mpOpp.sentFin = true; mpSend(race.mpOpp.id, { k: 'fin', n: race.mpOpp.n, t: finished ? +me.time.toFixed(3) : -1 }); }
  const tname = TRACKS.find((t) => t[0] === race.track)[1];
  const pb = +store.get('pb-' + race.track, '0') || 0;
  const newPb = finished && (!pb || me.time < pb);
  if (newPb) {
    store.set('pb-' + race.track, String(me.time));
    const look = {}; for (const k of LOOK_KEYS) look[k] = cfg[k];
    store.set('ghost-' + race.track, JSON.stringify({ t: +me.time.toFixed(3), s: race.rec, look }));
  }
  let title, win = false;
  if (me.dq) title = 'RED LIGHT';
  else if (me.crashed) title = 'CRASHED';
  else if (me.blown && !me.done) title = 'ENGINE BLOWN';
  else if (race.mode === 'mp') { const o = race.mpOpp; win = finished && (o.time == null || me.time <= o.time); title = win ? 'YOU WIN' : 'YOU LOSE'; }
  else if (ai) { win = finished && (!ai.done || me.time <= ai.time); title = win ? 'YOU WIN' : 'YOU LOSE'; }
  else if (race.mode === 'challenge') { win = finished && me.time < g.t; title = win ? 'CHALLENGE BEATEN' : 'CHALLENGE LOST'; }
  else title = newPb ? 'NEW PERSONAL BEST' : 'TEST RUN';
  let ladderMsg = '';
  if (race.mode === 'ladder' && win && race.ladderIdx === ladderNext && ladderNext < LADDER.length) {
    ladderNext++; store.set('ladder', String(ladderNext));
    ladderMsg = ladderNext >= LADDER.length ? 'Ladder complete. You own the streets.' : LADDER[race.ladderIdx].name + ' beaten. Next up: ' + LADDER[ladderNext].name + '.';
    ladderPick = Math.min(ladderNext, LADDER.length - 1);
  }
  const r = $('result'); r.replaceChildren();
  r.append(el('h2', null, title));
  r.append(el('p', 'sub', tname + ' · 1/4 mile' + (traffic ? ' · traffic' : '') + (race.opp ? ' · vs ' + race.opp : '') + (newPb ? ' · New personal best' : '')));
  if (ladderMsg) r.append(el('p', 'ladder-msg', ladderMsg));
  const dl = el('dl');
  const row = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
  row('Reaction time', me.launched ? me.rt.toFixed(3) + ' s' : '—');
  row('Elapsed time (ET)', finished ? (me.time - me.rt).toFixed(3) + ' s' : 'Did not finish');
  row('Race time incl. reaction', finished ? me.time.toFixed(3) + ' s' : '—');
  if (ai) row(race.opp + ' race time', ai.done ? ai.time.toFixed(3) + ' s' : 'Did not finish');
  if (g) row(g.name + ' race time', g.t.toFixed(3) + ' s');
  const mo = race.mode === 'mp' ? race.mpOpp : null;
  if (mo) row(mo.name + ' race time', !mo.done ? 'Still racing…' : mo.time != null ? mo.time.toFixed(3) + ' s' : mo.left ? 'Left the race' : mo.done ? 'Did not finish' : 'No result');
  const ot = mo ? mo.time : ai ? (ai.done ? ai.time : null) : g ? g.t : null;
  if (finished && ot) row('Margin', (me.time <= ot ? '−' : '+') + Math.abs(ot - me.time).toFixed(3) + ' s');
  row('Trap speed', finished ? Math.round(me.trap) + ' km/h' : '—');
  row('60 ft', me.t60 ? (me.t60 - me.rt).toFixed(3) + ' s' : '—');
  row('Launch', race.launchQ || '—');
  row('Tyre temp at launch', Math.round(me.tireAtLaunch) + ' °C' + (me.tireAtLaunch >= 70 && me.tireAtLaunch <= 95 ? ' (ideal)' : ''));
  row('Perfect shifts', me.perfect + ' of ' + me.shifts);
  row('Personal best', newPb ? me.time.toFixed(3) + ' s' : pb ? pb.toFixed(3) + ' s' : '—');
  r.append(dl);
  const rowB = el('div', 'row');
  if (!mo) rowB.append(skewBtn('Race again (R)', 'primary', startRace));
  if (race.mode === 'ladder' && win && ladderNext < LADDER.length && ladderPick !== race.ladderIdx) rowB.append(skewBtn('Next rival (N)', 'primary', () => { startRace(); }));
  let code = '';
  if (finished) {
    code = encodeChallenge(me);
    rowB.append(skewBtn('Copy challenge code (C)', '', () => copyChallenge(code)));
  }
  rowB.append(skewBtn(mo || race.fromRoam ? 'Back to the city (Esc)' : 'Back to garage (Esc)', '', exitRace));
  r.append(rowB);
  const cbox = el('input'); cbox.type = 'text'; cbox.id = 'chalOut'; cbox.readOnly = true; cbox.hidden = true; cbox.setAttribute('aria-label', 'Challenge code'); cbox.value = code;
  r.append(cbox);
  race.code = code;
  r.hidden = false;
}
function copyChallenge(code) {
  const box = $('chalOut'); box.hidden = false; box.value = code;
  const fb = () => { box.select(); callout('CODE SELECTED · CTRL+C TO COPY', 'ok', 1800); };
  try { navigator.clipboard.writeText(code).then(() => callout('CHALLENGE CODE COPIED', '', 1500), fb); } catch (e) { fb(); }
}

function crashCheck(c) {
  if (!race.cars.length || c.crashed || !c.launched || c.done) return false;
  const cx = c.x - halfOf(c);
  for (const t of race.cars) if (Math.abs(c.z - LANES3[t.lane]) < 1.75 && Math.abs(cx - t.x) < 4.25) { c.crashed = true; c.v *= 0.2; for (let i = 0; i < 8; i++) puff(cx + 1.5, c.z); return true; }
  return false;
}
function updateLane(c, dt) {
  if (c.laneT > 0) { c.laneT -= dt; const k = 1 - Math.max(0, c.laneT) / 0.3, e = k * k * (3 - 2 * k); c.z = c.zFrom + (race.lanes[c.lane] - c.zFrom) * e; }
  else c.z = race.lanes[c.lane];
}
function raceFrame(dtRaw) {
  const me = race.me, ai = race.ai;
  const dt = dtRaw;
  race.t += dt;
  if (race.phase === 'burnout' && race.t > 9) stageCars();
  if (race.phase === 'stage') {
    const tt = race.t - race.stageT - race.treeDelay, lights = $('tree').children;
    for (let i = 0; i < 3; i++) lights[i].classList.toggle('on', tt >= i * 0.5);
    if (tt >= 1.5) {
      lights[3].classList.add('on');
      race.phase = 'run'; race.greenT = race.t;
      if (ai) race.aiLaunchAt = race.t + race.prof.rt[0] + Math.random() * (race.prof.rt[1] - race.prof.rt[0]);
      callout('GO!', '', 0);
    }
  }
  const gas = race.gasKey || race.gasPad;
  const ph = race.phase === 'result' ? 'run' : race.phase;
  const n = Math.max(1, Math.min(120, Math.ceil(dt / H))), h = dt / n;
  for (let i = 0; i < n; i++) {
    const wasBlown = me.blown;
    stepRacer(me, gas, h, ph, race.gripMul);
    if (me.blown && !wasBlown) callout('ENGINE BLOWN', 'bad');
    if (ai) {
      if (race.phase === 'run' && !ai.launched && race.t >= race.aiLaunchAt) launch(ai);
      stepRacer(ai, aiThink(ai, race.prof, ph), h, ph, race.gripMul);
    }
    if (race.phase === 'run' || race.phase === 'result') {
      for (const t of race.cars) t.x += t.v * h;
      if (crashCheck(me)) { callout('CRASHED', 'bad', 0); }
      if (ai) { aiAvoid(ai); crashCheck(ai); }
      if (ai && traffic && me.lane === ai.lane) { // can't drive through each other
        const [back, front] = me.x < ai.x ? [me, ai] : [ai, me];
        if (front.x - back.x < 4.8) { back.v = Math.min(back.v, front.v); back.x = Math.min(back.x, front.x - 4.8); }
      }
    }
    updateLane(me, h); if (ai) updateLane(ai, h);
  }
  // record a ghost of this run at 30 Hz from the green light
  if (race.phase === 'run') while (race.recT <= me.time && race.rec.length < 2400) { race.rec.push(+me.x.toFixed(2)); race.recT += 1 / 30; }
  const mo = race.mode === 'mp' ? race.mpOpp : null;
  if (race.phase === 'run') {
    const meOut = me.done || me.dq || me.crashed || (me.blown && me.v < 0.5);
    const aiOut = mo ? mo.done : !ai || ai.done || ai.crashed || (ai.blown && ai.v < 0.5);
    if (meOut && !race.endT) {
      race.endT = race.t;
      if (mo && !mo.sentFin) { mo.sentFin = true; mpSend(mo.id, { k: 'fin', n: mo.n, t: me.done && !me.dq && !me.crashed ? +me.time.toFixed(3) : -1 }); }
    }
    if (race.endT && (aiOut || race.t - race.endT > (mo ? 15 : 5)) && race.t - race.endT > (ai || mo ? 0 : 1.2)) finishRace();
  }
  if (mo) {
    // my run goes out on the live channel with y = -500, so city clients know not to draw it; the rival's comes back the same way
    net.publishState({ x: me.x, z: 0, y: -500, h: 0, v: me.v });
    const op = net.players.get(mo.id), b = op && op.buf[op.buf.length - 1];
    if (!op && !mo.done) { mo.done = true; mo.left = true; mo.time = null; }
    if (b && b.y < -100) mo.x = b.x + b.v * clamp(performance.now() / 1000 - b.t, 0, 0.3);
    const lz = race.lanes[race.lanes.length - 1], r = rivalRig.userData.dims ? rivalRig.userData.dims.r : 0.33;
    rivalRig.position.set((mo.x || 0) - noseOf(rivalRig), 0, lz);
    rivalRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * (mo.x || 0) / r; });
    rivalBlob.position.set(rivalRig.position.x, 0.006, lz);
  }
  // place cars
  carRig.position.set(me.x - noseOf(carRig), 0, me.z);
  carRig.rotation.z += (Math.max(-0.01, Math.min(0.028, me.a / G * 0.03)) - carRig.rotation.z) * Math.min(1, dt * 2.5);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * me.wheelA; });
  if (ai) {
    rivalRig.position.set(ai.x - noseOf(rivalRig), 0, ai.z); rivalRig.rotation.z += (Math.max(-0.01, Math.min(0.028, ai.a / G * 0.03)) - rivalRig.rotation.z) * Math.min(1, dt * 2.5);
    rivalRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * ai.wheelA; });
    rivalBlob.position.set(rivalRig.position.x, 0.006, ai.z);
  }
  let gx = null;
  if (race.ghost && ghostRig) {
    const gt = race.phase === 'run' || race.phase === 'result' ? race.t - race.greenT : 0;
    gx = ghostX(race.ghost, gt);
    ghostRig.position.set(gx - noseOf(ghostRig), 0, race.lanes[race.lanes.length - 1]);
    ghostRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * gx / (ghostRig.userData.dims ? ghostRig.userData.dims.r : 0.33); });
  }
  placeCarFx(carRig.position.x, me.z);
  if (race.cars.length) placeTraffic();
  // smoke + nitro flames
  race.smokeT -= dt;
  if (race.smokeT <= 0) {
    race.smokeT = 0.035;
    if (me.spin && me.v < 40) { puff(carRig.position.x + carRig.userData.dims.xr, me.z + 0.85); puff(carRig.position.x + carRig.userData.dims.xr, me.z - 0.85); }
    if (ai && ai.spin && ai.v < 40) puff(rivalRig.position.x + rivalRig.userData.dims.xr, ai.z + (Math.random() < 0.5 ? 0.85 : -0.85));
  }
  for (const s of smoke) if (s.visible) { s.userData.life -= dt * 1.1; s.scale.setScalar(0.6 + (1 - s.userData.life) * 2.4); s.position.y += dt * 0.5; s.material.opacity = Math.max(0, s.userData.life) * 0.55; if (s.userData.life <= 0) s.visible = false; }
  flames.forEach((f, i) => {
    f.visible = me.nosT > 0;
    if (f.visible) { { const d = carRig.userData.dims; f.position.set(carRig.position.x + d.rear - 0.35, d.exY, me.z + (i ? -d.exZ : d.exZ)); } f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
  });
  // sun shadow follows the player
  const env = ENVS[loc];
  if (env.sunDir) { env.sun.position.set(carRig.position.x + env.sunDir.x * 30, 7, me.z + env.sunDir.z * 30); env.sun.target.position.set(carRig.position.x, 0, me.z); env.sun.target.updateMatrixWorld(); }
  renderer.shadowMap.needsUpdate = true;
  // fixed 3/4 chase camera
  race.camZ += (me.z + 5.2 - race.camZ) * Math.min(1, dtRaw * 5);
  const px = carRig.position.x, started = race.phase === 'run' || race.phase === 'result';
  const shake = me.rpm > me.ph.redline * 0.97 && started ? (Math.random() - 0.5) * 0.03 : 0;
  camera.position.set(px - 6.6, 2.15 + shake, race.camZ);
  camera.lookAt(px + 3.2, 0.7, me.z - 1.2);
  const fov = (camera.aspect < 1.1 ? 48 : 38) + Math.min(16, me.v * 0.2);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // HUD
  const staged = !me.launched;
  drawTach(me, staged); drawLeds(me, staged);
  $('heat').style.width = me.heat.toFixed(1) + '%';
  $('tire').style.width = Math.min(100, Math.max(0, (me.tire - 20) / 1.05)).toFixed(1) + '%';
  $('tireTxt').textContent = Math.round(me.tire) + ' °C';
  $('rTime').textContent = (started ? me.time : 0).toFixed(3);
  let sub = 'SECONDS';
  if (race.ghost && started && me.x > 1) { const gt = ghostTimeAt(race.ghost, me.x); if (gt !== null) { const dlt = me.time - gt; sub = 'Δ ' + (dlt >= 0 ? '+' : '−') + Math.abs(dlt).toFixed(2) + ' VS ' + race.ghost.name.toUpperCase(); } }
  $('rSub').textContent = sub;
  $('pBar').style.width = Math.min(100, me.x / RACE_LEN * 100) + '%';
  const ox = ai ? ai.x : gx;
  $('rBar').style.width = (ox === null ? 0 : Math.min(100, ox / RACE_LEN * 100)) + '%';
  $('rLabel').textContent = ai ? race.opp.toUpperCase() : race.ghost ? 'GHOST' : '—';
  const nk = me.bottles + ':' + (me.nosT > 0);
  if (race.nosShown !== nk) { race.nosShown = nk; renderNos(me); }
  $('bGas').classList.toggle('held', gas);
  audioUpdate(me, dtRaw);
}

/* ---- race picker in the menu ---- */
function renderRacePicker(p, head, left) {
  left.append(el('div', 'p-name', MODES.find((m) => m[0] === raceMode)[1]));
  const descs = {
    ladder: 'Beat eight street racers in order. Each one brings a faster car, so keep upgrading.',
    quick: 'One race against a rival built like your car, at the difficulty you pick.',
    test: 'Solo run against the ghost of your best time on this track.',
    challenge: 'Race the ghost from a friend’s challenge code.'
  };
  head.append(el('div', 'p-desc', descs[raceMode]));
  const fm = el('div', 'form');
  MODES.forEach(([id, label]) => fm.append(skewBtn(label, raceMode === id ? 'primary' : '', () => { raceMode = id; store.set('mode', id); render(); })));
  const ft = el('div', 'form');
  if (raceMode !== 'challenge') TRACKS.forEach(([id, label]) => ft.append(skewBtn(label, raceTrack === id ? 'primary' : '', () => { raceTrack = id; store.set('track', id); render(); })));
  ft.append(skewBtn('Traffic: ' + (traffic ? 'On' : 'Off'), traffic ? 'primary' : '', () => { traffic = !traffic; store.set('traffic', traffic ? 'on' : 'off'); render(); }));
  p.append(fm, ft);
  const fx = el('div', 'form');
  let info = '';
  if (raceMode === 'ladder') {
    LADDER.forEach((rv, i) => {
      const st = i < ladderNext ? 'beaten' : i === ladderNext ? 'next' : 'locked';
      const b = skewBtn((i + 1) + '. ' + rv.name + (st === 'beaten' ? ' · beaten' : st === 'next' ? ' · next' : ''), ladderPick === i ? 'primary' : '', () => { ladderPick = i; render(); });
      if (st === 'locked') { b.disabled = true; b.classList.add('locked'); }
      fx.append(b);
    });
    const rv = LADDER[ladderPick];
    info = ladderNext >= LADDER.length && ladderPick === LADDER.length - 1 ? 'Ladder complete. Rematch anyone you like.' : rv.name + ' · ' + modelName(rv.look.model) + ': ' + rv.note;
  } else if (raceMode === 'quick') {
    DIFFS.forEach(([id, label]) => fx.append(skewBtn('Rival: ' + label, raceDiff === id ? 'primary' : '', () => { raceDiff = id; store.set('diff', id); render(); })));
  } else if (raceMode === 'test') {
    const gh = loadGhost(raceTrack);
    info = gh ? 'Ghost: your best of ' + gh.t.toFixed(3) + ' s.' : 'No ghost yet. Finish a run on this track to record one.';
  } else {
    const inp = el('input'); inp.type = 'text'; inp.id = 'chalIn'; inp.placeholder = 'Paste a challenge code'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Challenge code');
    fx.append(inp, skewBtn('Load', '', () => { try { challenge = decodeChallenge(inp.value); say('Challenge loaded: ' + challenge.n + ', ' + challenge.t.toFixed(3) + ' s.'); render(); } catch (e) { say('That challenge code is not valid.', true); } }));
    info = challenge ? challenge.n + ' ran ' + challenge.t.toFixed(3) + ' s on ' + TRACKS.find((t) => t[0] === challenge.k)[1] + '.' : 'Finish any race, press Copy challenge code, and send it to a friend.';
  }
  if (fx.childNodes.length) p.append(fx);
  const pb = +store.get('pb-' + (raceMode === 'challenge' && challenge ? challenge.k : raceTrack), '0') || 0;
  const fs = el('div', 'form');
  fs.append(skewBtn('Start race (Enter)', 'primary', startRace), el('span', 'p-desc', (info ? info + ' ' : '') + (pb ? 'Your best here: ' + pb.toFixed(3) + ' s.' : '')));
  p.append(fs);
}

/* ---- race input ---- */
const GAS_KEYS = ['w', 'W', 'ArrowUp'], UP_KEYS = ['e', 'E'], DOWN_KEYS = ['q', 'Q'], NOS_KEYS = [' ', 'n', 'N'];
window.addEventListener('keydown', (e) => {
  if (!race.active) return;
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  const t = e.target;
  if (t && t.tagName === 'INPUT') return;
  const k = e.key;
  if (race.phase === 'result') {
    if (k === 'r' || k === 'R' || k === 'Enter') startRace();
    else if ((k === 'n' || k === 'N') && race.mode === 'ladder' && ladderPick !== race.ladderIdx) startRace();
    else if ((k === 'c' || k === 'C') && race.code) copyChallenge(race.code);
    else if (k === 'Escape') exitRace();
    else if (GAS_KEYS.includes(k)) race.gasKey = true;
    else return;
  } else if (GAS_KEYS.includes(k)) race.gasKey = true;
  else if (e.repeat) { /* ignore held keys */ }
  else if (UP_KEYS.includes(k)) pressLaunch();
  else if (DOWN_KEYS.includes(k)) doShift(-1);
  else if (NOS_KEYS.includes(k)) doNos();
  else if (k === 'ArrowLeft') doLane(1);
  else if (k === 'ArrowRight') doLane(-1);
  else if (k === 'Escape') exitRace();
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
window.addEventListener('keyup', (e) => { if (race.active && GAS_KEYS.includes(e.key)) { race.gasKey = false; e.preventDefault(); } }, true);
window.addEventListener('blur', () => { race.gasKey = false; race.gasPad = false; });
const gasBtn = $('bGas');
gasBtn.addEventListener('pointerdown', (e) => { race.gasPad = true; try { gasBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) gasBtn.addEventListener(ev, () => { race.gasPad = false; });
$('bUp').addEventListener('pointerdown', (e) => { e.preventDefault(); pressLaunch(); });
$('bDown').addEventListener('pointerdown', (e) => { e.preventDefault(); doShift(-1); });
$('bNos').addEventListener('pointerdown', (e) => { e.preventDefault(); doNos(); });
$('bLeft').addEventListener('pointerdown', (e) => { e.preventDefault(); doLane(1); });
$('bRight').addEventListener('pointerdown', (e) => { e.preventDefault(); doLane(-1); });
$('bQuit').onclick = exitRace;
const soundBtn = $('sound');
const paintSound = () => { soundBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off'; soundBtn.setAttribute('aria-pressed', String(soundOn)); };
soundBtn.onclick = () => { soundOn = !soundOn; store.set('sound', soundOn ? 'on' : 'off'); if (soundOn && race.active) audioStart(); else audioStop(); paintSound(); };
paintSound();

/* ---- shader warm-up: compile every location and race prop before they are needed ---- */
async function warmup() {
  try {
    for (const id of ['strip', 'coast', 'rain']) if (!ENVS[id]) { ENVS[id] = buildStreet(id); ENVS[id].group.visible = false; }
    ensureRival(RIVAL_BASE); ensureTraffic();
    const extras = [rivalRig, trafficRig.body, trafficRig.dark, trafficRig.tail, flames[0], smoke[0]];
    for (const id of Object.keys(ENVS)) {
      if (race.active || roam.active) return;
      for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === id;
      extras.forEach((o) => { o.visible = true; });
      const keepEnv = scene.environment; scene.environment = ENVS[id].env;
      const shadowWas = ENVS[id].sun.castShadow; ENVS[id].sun.castShadow = qLevel !== 'low';
      const p = renderer.compileAsync(scene, camera);
      extras.forEach((o) => { o.visible = false; });
      ENVS[id].sun.castShadow = shadowWas;
      for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === loc;
      scene.environment = keepEnv;
      await p;
    }
  } catch (e) { /* warm-up is best effort */ }
  if (!race.active && !roam.active) setLocation(loc);
}

/* ================= open world: Free Roam ================= */
// A 2 x 2 km night city generated from a fixed seed: a street grid (Downtown, Westside,
// North Hills, Harbor, Sunset Shore) inside a ring highway whose south side is the palm-lined
// coast boulevard. Everything static inside a 250 m chunk is merged into two meshes (city and
// road), so a visible chunk costs two draw calls. Windows, neon and street lamps are emissive
// vertex data in one shader, not real lights; only the player's headlights are lights.
const RW = { street: 11, avenue: 16, highway: 20 };
const LANES_DIR = { street: 1, avenue: 2, highway: 2 };
const laneOff = (type, k) => (type === 'street' ? 2.75 : type === 'avenue' ? 2.2 + 3.6 * k : 2.6 + 3.8 * k);
const CH = 250, NCH = 8;
const world = { built: false };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// elevated sections: the north side of the ring is a viaduct; the harbor bridge crosses to the island
const viaductH = (x) => 11 * smooth01((x + 620) / 160) * smooth01((620 - x) / 160);
const bridgeH = (z) => 12 * smooth01((z - 652) / 90) * smooth01((1092 - z) / 80) + 2.5 * Math.sin(clamp((z - 742) / 270, 0, 1) * Math.PI);
// the Neon Skyway: a curved elevated highway from the coast boulevard, over downtown, to the ring's east side
const SKY_CTRL = [[-560, 640], [-560, 560], [-520, 450], [-420, 340], [-260, 230], [-90, 140], [80, 40], [240, -60], [400, -150], [560, -200], [720, -215], [820, -205], [900, -200]];
function skywayPts() {
  const curve = new THREE.CatmullRomCurve3(SKY_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const pts = curve.getSpacedPoints(120).map((v) => [v.x, v.z]);
  pts[0] = SKY_CTRL[0].slice(); pts[pts.length - 1] = SKY_CTRL[SKY_CTRL.length - 1].slice();
  return pts;
}
const skyH = (s, L) => 15 * smooth01(s / 160) * smooth01((L - s) / 160) + 2.2 * Math.sin(clamp((s - 160) / (L - 320), 0, 1) * Math.PI * 3) * smooth01((s - 120) / 200) * smooth01((L - s - 120) / 200);
// nearest point on a road: arc length, signed offset to the right of the road's direction, distance
function projectRoad(r, x, z) {
  let best = Infinity, bs = 0, bl = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue;
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), px = a[0] + dx * t, pz = a[1] + dz * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) { best = d2; const L = Math.sqrt(L2); bs = r.cum[i - 1] + t * L; bl = ((x - px) * -dz + (z - pz) * dx) / L; }
  }
  return { s: bs, lat: bl, d: Math.sqrt(best) };
}
let ELEVATED = []; // roads with a height profile
const TUNNEL = { x: -900, z0: -360, z1: -40, half: 10.6, roof: 7 };
const inTunnel = (x, z, pad = 0) => Math.abs(x - TUNNEL.x) < 50 + pad && z > TUNNEL.z0 - 5 - pad && z < TUNNEL.z1 + 5 + pad;
function roundRect(X0, Z0, X1, Z1, RR) {
  const pts = [];
  const arc = (cx, cz, a0) => { for (let i = 0; i <= 9; i++) { const a = (a0 + i * 10) * Math.PI / 180; pts.push([cx + RR * Math.cos(a), cz + RR * Math.sin(a)]); } };
  arc(X1 - RR, Z0 + RR, -90); arc(X1 - RR, Z1 - RR, 0); arc(X0 + RR, Z1 - RR, 90); arc(X0 + RR, Z0 + RR, 180);
  pts.push(pts[0].slice()); return pts;
}
// how far a road stops short of a crossing: half the width of the widest other road there
const clrAt = (n, r) => { let c = 0; for (const o of n.roads) if (o !== r) c = Math.max(c, o.w / 2); return c; };

/* ---- geometry buffer with per-vertex colour and emissive data ---- */
// Level of detail by size: every chunk sorts its geometry into tiers by object size. Tier 0 holds objects under
// TIER[0] metres (tables, planters, bollards), tier 1 those under TIER[1] (parked cars, trees, awnings, roof plant);
// everything bigger, and anything that glows (a far lamp is still a visible dot), stays in the base mesh.
// A tier is drawn only while its objects would cover more than a few pixels (see lodUpdate).
const TIER = [2.2, 6];
class GeoBuf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.w = []; this.i = []; this.v = 0; this.tiers = null; }
  bin(size, win) { return !this.tiers || win[3] >= 0.99 ? null : size < TIER[0] ? this.tiers[0] : size < TIER[1] ? this.tiers[1] : null; }
  vert(x, y, z, nx, ny, nz, col, u, v, win) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.u.push(u, v);
    this.w.push(win[0], win[1], win[2], win[3]); return this.v++;
  }
  // a..d are corners [x, y, z]; the winding is fixed to face `nrm`
  quad(a, b, c, d, col, uv, win, nrm) {
    if (this.tiers) { const t = this.bin(Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]), Math.abs(b[0] - d[0]), Math.abs(b[1] - d[1]), Math.abs(b[2] - d[2])), win); if (t) return t.quad(a, b, c, d, col, uv, win, nrm); }
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let flip = false;
    if (nrm && nx * nrm[0] + ny * nrm[1] + nz * nrm[2] < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
    const q = [a, b, c, d].map((p, k) => this.vert(p[0], p[1], p[2], nx, ny, nz, col, uv[k][0], uv[k][1], win));
    if (flip) this.i.push(q[0], q[2], q[1], q[0], q[3], q[2]); else this.i.push(q[0], q[1], q[2], q[0], q[2], q[3]);
  }
  // append a three.js geometry transformed by a 4x4 matrix
  geo(g, m, col, win) {
    if (this.tiers) { if (!g.boundingSphere) g.computeBoundingSphere(); const me = m.elements, t = this.bin(g.boundingSphere.radius * 2 * Math.hypot(me[0], me[1], me[2]), win); if (t) return t.geo(g, m, col, win); }
    const P = g.attributes.position, N = g.attributes.normal, e = m.elements, base = this.v;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k), nx = N.getX(k), ny = N.getY(k), nz = N.getZ(k);
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      let ax = e[0] * nx + e[4] * ny + e[8] * nz, ay = e[1] * nx + e[5] * ny + e[9] * nz, az = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
      this.vert(X, Y, Z, ax, ay, az, col, 0, 0, win);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
    else for (let k = 0; k < P.count; k++) this.i.push(base + k);
  }
  // axis-aligned box; sides carry window UVs (3 m per window, 3.5 m per floor)
  box(x0, z0, x1, z1, y0, y1, col, win, roof = col, uo = 0, vo = 0, top = true, su = 1, sv = 1) {
    if (this.tiers) { const t = this.bin(Math.max(x1 - x0, z1 - z0, y1 - y0), win); if (t) return t.box(x0, z0, x1, z1, y0, y1, col, win, roof, uo, vo, top, su, sv); }
    const W0 = [0, 0, 0, 0], fu = (a) => a / 48 * su + uo, fv = (y) => (y - y0) / 56 * sv + vo;
    const side = (ax, az, bx, bz, n) => { const L = Math.hypot(bx - ax, bz - az); this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, [[fu(0), fv(y0)], [fu(L), fv(y0)], [fu(L), fv(y1)], [fu(0), fv(y1)]], win, n); };
    side(x0, z0, x1, z0, [0, 0, -1]); side(x1, z1, x0, z1, [0, 0, 1]); side(x0, z1, x0, z0, [-1, 0, 0]); side(x1, z0, x1, z1, [1, 0, 0]);
    if (top) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], roof, [[0, 0], [0, 0], [0, 0], [0, 0]], W0, [0, 1, 0]);
  }
  // box rotated about y (lamp arms, billboards, crane parts)
  obox(cx, cz, ang, hl, hw, y0, y1, col, win) {
    if (this.tiers) { const t = this.bin(Math.max(hl * 2, hw * 2, y1 - y0), win); if (t) return t.obox(cx, cz, ang, hl, hw, y0, y1, col, win); }
    const c = Math.cos(ang), s = Math.sin(ang), P = (a, b) => [cx + c * a - s * b, cz + s * a + c * b];
    const k = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)], Z = [[0, 0], [0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4], mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], col, Z, win, [mx, 0, mz]); }
    this.quad([k[0][0], y1, k[0][1]], [k[1][0], y1, k[1][1]], [k[2][0], y1, k[2][1]], [k[3][0], y1, k[3][1]], col, Z, win, [0, 1, 0]);
  }
  mesh(mat, withColor = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (withColor) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('win', new THREE.BufferAttribute(Uint8Array.from(this.w, (x) => Math.round(clamp(x, 0, 1) * 255)), 4, true));
    }
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? Uint32Array.from(this.i) : Uint16Array.from(this.i), 1));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}

/* ---- textures and materials ---- */
function roadAtlas() {
  const W = 256, H = 2560, c = mkCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#18181e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 48000; i++) { const v = 16 + rnd() * 22 | 0; g.fillStyle = `rgba(${v},${v},${v + 5},0.6)`; g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6); }
  const line = (r, w, p, th, col, dash) => {
    const y = r * 256 + 8 + (p / w + 0.5) * 240, h = Math.max(1.6, th / w * 240);
    g.fillStyle = col;
    if (!dash) g.fillRect(0, y - h / 2, W, h); else for (const [a, b] of dash) g.fillRect(a / 16 * W, y - h / 2, (b - a) / 16 * W, h);
  };
  const Y = '#d4a23a', Wt = '#d6d6d0';
  line(0, 11, -5.1, 0.15, Wt); line(0, 11, 5.1, 0.15, Wt); line(0, 11, 0, 0.14, Y, [[0, 4], [8, 12]]);
  line(1, 16, -7.6, 0.16, Wt); line(1, 16, 7.6, 0.16, Wt); line(1, 16, -0.2, 0.12, Y); line(1, 16, 0.2, 0.12, Y);
  for (const s of [-1, 1]) line(1, 16, s * 4.0, 0.14, Wt, [[0, 3], [8, 11]]);
  line(2, 20, -9.5, 0.2, Wt); line(2, 20, 9.5, 0.2, Wt); line(2, 20, -0.26, 0.14, Y); line(2, 20, 0.26, 0.14, Y);
  for (const s of [-1, 1]) line(2, 20, s * 4.5, 0.16, Wt, [[0, 4], [8, 12]]);
  g.fillStyle = '#cfcfca';
  for (let i = 0; i < 15; i += 2) g.fillRect(0, 4 * 256 + 8 + i / 15 * 240 + 2, W, 240 / 15 - 4);
  // more surfaces, so the districts do not all drive on the same street
  const speck = (r, n, lo, hi, tr, tg, tb) => { for (let i = 0; i < n; i++) { const v = lo + rnd() * (hi - lo) | 0; g.fillStyle = `rgba(${v + tr},${v + tg},${v + tb},0.6)`; g.fillRect(rnd() * W, r * 256 + rnd() * 256, 1.6, 1.6); } };
  // 5: old-town cobbles
  g.fillStyle = '#15120f'; g.fillRect(0, 5 * 256, W, 256);
  for (let y = 0; y < 256; y += 6) for (let x = (y / 6 % 2) * 4 - 4; x < W; x += 8) { const v = 30 + rnd() * 28 | 0; g.fillStyle = `rgb(${v + 9},${v + 3},${v})`; g.fillRect(x + 0.6, 5 * 256 + y + 0.6, 6.8, 4.8); }
  line(5, 11, -5.15, 0.2, '#6a655c'); line(5, 11, 5.15, 0.2, '#6a655c');
  // 6: harbor concrete slabs with expansion joints
  g.fillStyle = '#292a2f'; g.fillRect(0, 6 * 256, W, 256); speck(6, 5000, 34, 58, 0, 0, 2);
  g.fillStyle = '#0d0d10'; for (let x = 0; x < W; x += 64) g.fillRect(x, 6 * 256, 2, 256); g.fillRect(0, 6 * 256 + 127, W, 2);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(8,8,10,0.35)'; g.fillRect(rnd() * W, 6 * 256 + 20 + rnd() * 210, 6 + rnd() * 26, 3 + rnd() * 8); }
  line(6, 11, -5.0, 0.2, Y); line(6, 11, 5.0, 0.2, Y);
  // 7: residential street: no centre line, patched asphalt, parking bays marked along the kerbs
  for (let i = 0; i < 9; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(10,10,13,0.5)' : 'rgba(44,44,50,0.45)'; g.fillRect(rnd() * W, 7 * 256 + 20 + rnd() * 200, 14 + rnd() * 40, 8 + rnd() * 24); }
  line(7, 11, -5.1, 0.12, Wt); line(7, 11, 5.1, 0.12, Wt);
  for (const s of [-1, 1]) line(7, 11, s * 4.2, 0.1, Wt, [[0, 0.25], [5.3, 5.55], [10.6, 10.85]]);
  // 8: boulevard: an avenue with painted cycle lanes along both kerbs
  g.fillStyle = 'rgba(24,104,84,0.6)';
  for (const s of [-1, 1]) { const y0 = 8 * 256 + 8 + ((s * 6.75) / 16 + 0.5) * 240; g.fillRect(0, y0 - 11, W, 22); }
  line(8, 16, -7.7, 0.16, Wt); line(8, 16, 7.7, 0.16, Wt); line(8, 16, -5.9, 0.14, Wt); line(8, 16, 5.9, 0.14, Wt);
  line(8, 16, -0.2, 0.12, Y); line(8, 16, 0.2, 0.12, Y);
  for (const s of [-1, 1]) line(8, 16, s * 3.2, 0.14, Wt, [[0, 3], [8, 11]]);
  // 9: shore street: warm, sun-bleached asphalt
  g.fillStyle = '#2b221e'; g.fillRect(0, 9 * 256, W, 256); speck(9, 6000, 30, 58, 8, 2, 0);
  line(9, 11, -5.1, 0.15, Wt); line(9, 11, 5.1, 0.15, Wt); line(9, 11, 0, 0.14, Wt, [[0, 3], [8, 11]]);
  const t = canvasTex(c); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const rowV = (row, t) => (row * 256 + 8 + t * 240) / 2560;
// window mask: alpha = window shape, red = per-window random (who has the light on), green = brightness
function windowData() {
  const N = 256, d = new Uint8Array(N * N * 4);
  for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) {
    const r = rnd() * 255 | 0, b = 40 + rnd() * 215 | 0;
    for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) { const i = ((cy * 16 + y) * N + cx * 16 + x) * 4; d[i] = r; d[i + 1] = b; d[i + 3] = 255; }
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// win.rgb = glow colour, win.a = share of lit windows (0 = plain surface, 1 = the whole surface glows: neon, lamps).
// Facades are drawn by formula, not by geometry or textures: the box UVs count 3 m bays and 3.5 m floors, and the
// shader places a window in every cell (frame, mullion, blinds, a lit or dark room) and makes the glass a mirror for
// the sky. Detail that would be smaller than a pixel is replaced by its average, so distant towers do not shimmer.
function cityMaterial(winTex) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02, emissive: '#ffffff', emissiveMap: winTex, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 win;\nvarying vec4 vWin;\nvarying vec3 vFx;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWin = win;\nvFx = vec3( abs( normal.x ), position.y, normal.y );');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', [
      '#include <common>', 'varying vec4 vWin;', 'varying vec3 vFx;',
      'float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }'
    ].join('\n')).replace('#include <color_fragment>', [
      '#include <color_fragment>',
      // real cities are far less saturated than the palette; walls also darken toward the pavement (cheap ambient occlusion)
      'diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), diffuseColor.rgb, 0.5 );',
      'float vert = 1.0 - step( 0.5, abs( vFx.z ) );',
      'diffuseColor.rgb *= mix( 1.0, 0.72 + 0.28 * smoothstep( 0.0, 7.0, vFx.y ), vert );'
    ].join('\n')).replace('#include <emissivemap_fragment>', [
      'float full = step( 0.99, vWin.a );',
      'totalEmissiveRadiance = vWin.rgb * full * 1.15;',
      'if ( vWin.a > 0.001 && vWin.a < 0.955 ) {',
      '  vec2 fc = vEmissiveMapUv * 16.0, id = floor( fc ), f = fract( fc ), fw = fwidth( fc );',
      '  float far = smoothstep( 0.1, 0.42, max( fw.x, fw.y ) );',
      '  float st = fract( dot( vWin.rgb, vec3( 3.1, 7.7, 5.3 ) ) );', // facade style: punched windows, ribbon windows or curtain wall
      '  vec2 lo = st < 0.4 ? vec2( 0.2, 0.24 ) : st < 0.72 ? vec2( 0.03, 0.3 ) : vec2( 0.025, 0.07 );',
      '  vec2 hi = st < 0.4 ? vec2( 0.8, 0.82 ) : st < 0.72 ? vec2( 0.97, 0.84 ) : vec2( 0.975, 0.95 );',
      '  vec2 e = fw * 1.1 + 0.003;',
      '  vec2 in2 = smoothstep( lo - e, lo + e, f ) * ( 1.0 - smoothstep( hi - e, hi + e, f ) );',
      '  float open = in2.x * in2.y, area = ( hi.x - lo.x ) * ( hi.y - lo.y );',
      '  vec2 g = clamp( ( f - lo ) / ( hi - lo ), 0.0, 1.0 );',
      '  float edge = min( min( g.x, 1.0 - g.x ) * ( hi.x - lo.x ), min( g.y, 1.0 - g.y ) * ( hi.y - lo.y ) );',
      '  float frame = 1.0 - smoothstep( 0.012, 0.03, edge );',
      '  frame = max( frame, ( 1.0 - smoothstep( 0.008, 0.02, abs( g.x - 0.5 ) * ( hi.x - lo.x ) ) ) * step( st, 0.72 ) );',
      '  frame *= open * ( 1.0 - far );',
      '  float glass = mix( open * ( 1.0 - frame ), area * 0.92, far );',
      '  float h1 = h21( id ), h2 = h21( id + 31.7 ), h3 = h21( id.yx + 5.1 );',
      '  float lit = mix( step( 1.0 - vWin.a * 0.55, h1 ), vWin.a * 0.55, far );',
      '  float blind = step( 1.0 - 0.6 * h2 * step( 0.35, h3 ), g.y ) * ( 1.0 - far );',
      // wall relief: a shadow line at every floor slab, a lighter sill under punched windows
      '  float slab = ( 1.0 - smoothstep( 0.0, 0.045, f.y ) ) * ( 1.0 - far );',
      '  float sill = in2.x * ( 1.0 - smoothstep( 0.0, 0.03, abs( f.y - lo.y + 0.03 ) ) ) * step( st, 0.4 ) * ( 1.0 - far );',
      '  vec3 wall = diffuseColor.rgb * ( 1.0 - 0.22 * slab ) * ( 1.0 + 0.25 * sill );',
      '  vec3 pane = mix( vec3( 0.3, 0.35, 0.42 ), vec3( 0.5, 0.48, 0.44 ), blind );',
      '  diffuseColor.rgb = mix( mix( wall, wall * 0.3, frame ), pane, glass );',
      '  roughnessFactor = mix( roughnessFactor, mix( 0.07, 0.6, blind ), glass );',
      '  metalnessFactor = mix( metalnessFactor, mix( 0.92, 0.1, blind ), glass );',
      '  vec3 room = mix( vec3( 1.0, 0.7, 0.4 ), vec3( 0.8, 0.9, 1.0 ), step( 0.78, h2 ) ) * ( 0.5 + 0.7 * h3 );',
      '  room = mix( room * ( 0.7 + 0.3 * g.y ) * mix( 1.0, 0.5, blind ), vec3( 1.0, 0.74, 0.46 ) * 0.8, far );',
      '  totalEmissiveRadiance += room * lit * glass * 0.55;',
      '}',
      // shop windows (win.a just under 1, UVs in metres): posts between panes, doors, a transom, stock on the shelves
      'if ( vWin.a > 0.955 && full < 0.5 ) {',
      '  vec2 q = vEmissiveMapUv; float bay = 2.4, xb = fract( q.x / bay ), ib = floor( q.x / bay );',
      '  float hb = h21( vec2( ib, floor( vWin.r * 255.0 ) ) ), door = step( 0.7, hb );',
      '  float post = 1.0 - smoothstep( 0.035, 0.06, min( xb, 1.0 - xb ) * bay );',
      '  float rail = max( door * ( 1.0 - smoothstep( 0.02, 0.045, abs( q.y - 0.95 ) ) ), 1.0 - smoothstep( 0.025, 0.05, abs( q.y - 2.15 ) ) );',
      '  float frame = max( post, rail );',
      '  float sfar = smoothstep( 0.12, 0.4, fwidth( q.x ) );',
      '  float shelf = mix( step( q.y, 0.35 + 0.95 * h21( vec2( floor( q.x / 0.55 ), ib ) ) ), 0.4, sfar ) * ( 1.0 - door ) * step( q.y, 2.1 );',
      '  diffuseColor.rgb = mix( vec3( 0.2, 0.22, 0.25 ), vec3( 0.05 ), frame );',
      '  roughnessFactor = mix( 0.1, 0.5, frame ); metalnessFactor = mix( 0.6, 0.3, frame );',
      '  totalEmissiveRadiance = vWin.rgb * ( 0.75 + 0.9 * smoothstep( 0.0, 2.6, q.y ) ) * mix( 1.0, 0.3, shelf ) * ( 1.0 - frame );',
      '}'
    ].join('\n'));
  };
  m.customProgramCacheKey = () => 'raven-city-8';
  return m;
}

/* ---- road layout, crossings and the lane graph ---- */
// street segments left out of the grid: they merge blocks into parks, plazas and superblocks, and leave T-junctions
const GAPS = {
  x: { '-100': [[-200, 0]], 300: [[430, 560]], '-520': [[-660, -520]], '-660': [[100, 300]], '-300': [[-800, -660]] },
  z: { '-100': [[-200, 0]], 100: [[200, 400]], '-660': [[400, 580]] }
};
const SPECIALS = [{ k: 'park', x0: -200, z0: -200, x1: 0, z1: 0 }, { k: 'fair', x0: 200, z0: 430, x1: 400, z1: 560 }, { k: 'mall', x0: -660, z0: -660, x1: -400, z1: -520 }];
const SHOP_SIGNS = ['PERFORMANCE SHOP', 'BURGERS', 'TUNER HAVEN', 'NOODLES', 'SUSHI BAR', 'PIZZA', 'ARCADE', 'KARAOKE', 'TATTOO', 'MOTEL', 'DINER', 'TIRES',
  'BODY SHOP', 'PARTS', 'CAFE', 'RAMEN', 'TACOS', 'DONUTS', 'LAUNDRY', 'GYM', 'BOOKS', 'RECORDS', 'FLOWERS', 'BAKERY', 'CINEMA', 'HOTEL', 'CLUB',
  'NEON NIGHTS', 'CAR WASH', 'BOWLING', 'GARAGE', 'VIDEO',
  'RESTAURANT', 'MUSEUM', 'GALLERY', 'BISTRO', 'STEAK HOUSE', 'TEA HOUSE', 'PHARMACY', 'MARKET', 'BANK', 'LIBRARY', 'THEATER', 'ICE CREAM',
  'BARBER', 'PARKING', 'MALL', 'BAR & GRILL', 'TRATTORIA', 'KEBAB', 'PLOV HOUSE', 'CHOYXONA', 'SAMSA', 'FUEL', 'SUPERMARKET', 'SEAFOOD',
  'ROOFTOP BAR', 'JAZZ CLUB', 'SURF SHOP', 'ELECTRONICS', 'FASHION', 'COFFEE', 'BBQ', 'MARINA'];
function roadLayout() {
  const roads = [];
  const add = (type, pts, closed = false) => { const r = { id: roads.length, type, w: RW[type], pts, closed, marks: [] }; roads.push(r); return r; };
  const XL = [-800, -660, -520, -400, -300, -200, -100, 0, 100, 200, 300, 400, 580, 800];
  const ZL = [-800, -660, -520, -400, -300, -200, -100, 0, 100, 200, 300, 430, 560];
  const AVE_X = [-400, 0, 400], AVE_Z = [-400, 0, 300], OUT_Z = [-400, 0];
  const spans = (lo, hi, gaps) => { const out = []; let a = lo; for (const [g0, g1] of (gaps || []).slice().sort((p, q) => p[0] - q[0])) { if (g0 > a) out.push([a, g0]); a = Math.max(a, g1); } if (a < hi) out.push([a, hi]); return out; };
  for (const x of XL) for (const [a, b] of spans(-800, 640, GAPS.x[x])) add(AVE_X.includes(x) ? 'avenue' : 'street', [[x, a], [x, b]]);
  for (const z of ZL) { const lim = OUT_Z.includes(z) ? 900 : 800; for (const [a, b] of spans(-lim, lim, GAPS.z[z])) add(AVE_Z.includes(z) ? 'avenue' : 'street', [[a, z], [b, z]]); }
  // ring highway with rounded corners; its south side is the coast boulevard at z = 640
  const ring = add('highway', roundRect(-900, -900, 900, 640, 90), true); ring.ring = true;
  // the harbor bridge to the island, and the island's loop road
  const bridge = add('avenue', [[-200, 640], [-200, 1100]]); bridge.isBridge = true;
  add('avenue', roundRect(-430, 1100, 30, 1260, 40), true).isle = true;
  const sky = add('highway', skywayPts()); sky.sky = true;
  for (const r of roads) { r.cum = [0]; for (let i = 1; i < r.pts.length; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); r.len = r.cum[r.cum.length - 1]; }
  ring.hAt = (s) => { const p = rPoint(ring, s); return Math.abs(p.z + 900) < 0.5 ? viaductH(p.x) : 0; };
  bridge.hAt = (s) => bridgeH(640 + s);
  sky.hAt = (s) => skyH(s, sky.len);
  ELEVATED = roads.filter((r) => r.hAt);
  for (const r of roads) r.axis = r.closed ? null : (r.pts[0][0] === r.pts[r.pts.length - 1][0] ? 'ns' : 'ew');
  return { roads, XL, ZB: [...ZL, 640] };
}
function rPoint(r, s) {
  s = r.closed ? ((s % r.len) + r.len) % r.len : clamp(s, 0, r.len);
  let lo = 1, hi = r.cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (r.cum[m] < s) lo = m + 1; else hi = m; }
  const a = r.pts[lo - 1], b = r.pts[lo], L = (r.cum[lo] - r.cum[lo - 1]) || 1, t = (s - r.cum[lo - 1]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L };
}
function buildGraph(roads) {
  const nodes = [];
  const nodeAt = (x, z) => { for (const n of nodes) if (Math.abs(n.x - x) < 1.5 && Math.abs(n.z - z) < 1.5) return n; const n = { id: nodes.length, x, z, roads: new Set(), edges: [] }; nodes.push(n); return n; };
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    const A = roads[i], B = roads[j];
    for (let a = 1; a < A.pts.length; a++) for (let b = 1; b < B.pts.length; b++) {
      const p = A.pts[a - 1], q = A.pts[a], r = B.pts[b - 1], s = B.pts[b];
      const rx = q[0] - p[0], rz = q[1] - p[1], sx = s[0] - r[0], sz = s[1] - r[1], den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = r[0] - p[0], qz = r[1] - p[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
      if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
      const x = p[0] + rx * t, z = p[1] + rz * t;
      const sa = A.cum[a - 1] + t * (A.cum[a] - A.cum[a - 1]), sb = B.cum[b - 1] + u * (B.cum[b] - B.cum[b - 1]);
      if ((A.hAt && A.hAt(sa) > 1) || (B.hAt && B.hAt(sb) > 1)) continue; // passes overhead: no junction
      const n = nodeAt(x, z);
      if (!A.marks.some((m) => m.node === n)) A.marks.push({ s: sa, node: n });
      if (!B.marks.some((m) => m.node === n)) B.marks.push({ s: sb, node: n });
      n.roads.add(A); n.roads.add(B);
    }
  }
  const edges = [];
  for (const r of roads) {
    r.marks.sort((a, b) => a.s - b.s);
    if (!r.closed) {
      if (!r.marks.length || r.marks[0].s > 0.5) { const p = rPoint(r, 0), n = nodeAt(p.x, p.z); n.roads.add(r); r.marks.unshift({ s: 0, node: n }); }
      if (r.marks[r.marks.length - 1].s < r.len - 0.5) { const p = rPoint(r, r.len), n = nodeAt(p.x, p.z); n.roads.add(r); r.marks.push({ s: r.len, node: n }); }
    }
    const M = r.marks, cnt = r.closed ? M.length : M.length - 1;
    for (let k = 0; k < cnt; k++) {
      const m0 = M[k], m1 = M[(k + 1) % M.length];
      const e = { id: edges.length, road: r, type: r.type, s0: m0.s, s1: k + 1 < M.length ? m1.s : m1.s + r.len, a: m0.node, b: m1.node };
      edges.push(e); e.a.edges.push(e); e.b.edges.push(e);
    }
  }
  // how far each road stops short of a crossing (half the width of the other road)
  for (const e of edges) {
    e.cA = clrAt(e.a, e.road); e.cB = clrAt(e.b, e.road);
    e.xA = e.a.edges.length >= 3 && e.type !== 'highway'; e.xB = e.b.edges.length >= 3 && e.type !== 'highway'; // zebra crossings
    e.lo = e.s0 + e.cA; e.hi = e.s1 - e.cB;
  }
  return { nodes, edges };
}
// the world position of a lane: road centre plus an offset to the right of travel
function lanePose(e, dir, off, s) {
  const p = rPoint(e.road, s), tx = p.tx * dir, tz = p.tz * dir;
  return { x: p.x - tz * off, z: p.z + tx * off, tx, tz };
}

/* ---- props ---- */
function roamPalmGeo() {
  const trunk = [], leaves = [];
  const PH = 6.6, segs = 4; let prev = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, p = new THREE.Vector3(t * t * 0.9, t * PH, 0), len = p.distanceTo(prev);
    const geo = new THREE.CylinderGeometry(0.13 + (1 - t) * 0.06, 0.14 + (1 - t + 1 / segs) * 0.06, len * 1.04, 5, 1, true);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()));
    const mid = p.clone().add(prev).multiplyScalar(0.5); geo.translate(mid.x, mid.y, mid.z); trunk.push(geo); prev = p;
  }
  for (let k = 0; k < 7; k++) {
    const leaf = new THREE.PlaneGeometry(3.4, 0.9, 3, 1), pos = leaf.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.max(0, pos.getX(i) + 1.7), y = pos.getY(i), t = x / 3.4, w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - t * 0.3);
      pos.setXYZ(i, x, -Math.pow(t, 1.7) * 1.7 + 0.35 * t + Math.abs(y) * 0.25, y * w);
    }
    leaf.computeVertexNormals(); leaf.rotateZ(0.3 + (k % 2) * 0.25); leaf.rotateY(k * Math.PI * 2 / 7); leaf.translate(prev.x, prev.y, prev.z);
    leaves.push(leaf);
  }
  return { trunk: mergeGeometries(plainAttrs(trunk)), leaves: mergeGeometries(plainAttrs(leaves)) };
}
function roamTreeGeo() {
  const t = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 5, 1, true); t.translate(0, 1.3, 0);
  const c = new THREE.IcosahedronGeometry(2.1, 0); c.scale(1, 1.15, 1); c.translate(0, 4.0, 0);
  return { trunk: t.toNonIndexed(), crown: c.toNonIndexed() };
}

/* ---- the world ---- */
// Open-world visibility solver, run once a frame.
//  * draw distance = fog distance: a chunk is drawn only while its nearest edge is inside the fog, so nothing pops
//  * LOD by screen-space size: an object of size S at distance d covers S*H / (2*d*tan(fov/2)) pixels, so a tier is
//    drawn out to d = S*H / (2*tan(fov/2)*PIX), with 12 % hysteresis against flicker at the boundary
//  * frame budget controller: a smoothed frame time above 21 ms shrinks the detail scale k, below 14.5 ms grows it;
//    k scales the tier radii and the fog/draw distance together, so a slow machine trades distance for frame rate
//  * dynamic resolution: pixels cost more than triangles here (a frame is only ~230k triangles), so k also scales
//    the render resolution, in 10 % steps and at most once every 2.5 s so the change is not felt as a hitch
function lodUpdate(dt) {
  const L = LOD, cam = camera.position;
  if (!L.lock && dt > 0) {
    L.ms += (Math.min(dt, 0.1) * 1000 - L.ms) * 0.06; L.t += dt;
    if (L.t > 0.5) { L.t = 0; const lo = qLevel === 'low' ? 0.45 : 0.55, hi = qLevel === 'low' ? 0.8 : qLevel === 'medium' ? 1 : 1.25; if (L.ms > 21) L.k *= 0.94; else if (L.ms < 14.5) L.k *= 1.03; L.k = clamp(L.k, lo, hi);
      const sc = Math.round(clamp(L.k, 0.6, 1) * 10) / 10, now = performance.now();
      if (sc !== L.prs && now - L.prT > 2500) { L.prs = sc; L.prT = now; renderer.setPixelRatio(L.basePR * sc); composer.setPixelRatio(renderer.getPixelRatio()); const cv = renderer.domElement; renderer.setSize(cv.clientWidth, cv.clientHeight, false); composer.setSize(cv.clientWidth, cv.clientHeight); }
    }
  }
  const H = renderer.domElement.height, px = H / (2 * Math.tan(camera.fov * Math.PI / 360) * L.PIX);
  const far = L.far0 * clamp(0.5 + 0.5 * L.k, 0.7, 1);
  L.far = far; world.fog.far = far; L.chunks = 0; L.on[0] = L.on[1] = 0;
  for (let i = 0; i < 2; i++) L.R[i] = clamp(TIER[i] * px * L.k, i ? 200 : 90, far + 150);
  for (const g of world.cmeshes) {
    const dx = Math.max(0, Math.abs(g.userData.cx - cam.x) - CH / 2), dz = Math.max(0, Math.abs(g.userData.cz - cam.z) - CH / 2), d = Math.hypot(dx, dz);
    g.visible = d < far + 8; if (g.visible) L.chunks++;
    const T = g.userData.tiers; if (T) for (let i = 0; i < 2; i++) { const f = T[i]; if (!f) continue; f.visible = d < (f.visible ? L.R[i] * 1.12 : L.R[i]); if (g.visible && f.visible) L.on[i]++; }
  }
}
function buildWorld() {
  seed = 4242;
  const TT = [performance.now()], mark = () => TT.push(performance.now());
  const { roads, XL, ZB } = roadLayout();
  const { nodes, edges } = buildGraph(roads);
  const districtOf = (x, z) => (x > 400 ? 'harbor' : Math.abs(x) <= 400 && z > -400 && z < 300 ? 'downtown' : z >= 300 ? 'shore' : z < -400 ? 'north' : 'west');
  // which strip of the road atlas an edge is paved with
  const surfOf = (e) => {
    const r = e.road; if (r.type === 'highway') return 2;
    const p = rPoint(r, (e.lo + e.hi) / 2), d = districtOf(p.x, p.z);
    if (r.type === 'avenue') return !r.isBridge && !r.isle && Math.abs(p.z - 300) < 1 ? 8 : 1;
    return d === 'west' ? 5 : d === 'harbor' ? 6 : d === 'north' ? 7 : d === 'shore' ? 9 : 0;
  };
  const chunks = new Map();
  const chunkOf = (x, z) => {
    const cx = clamp(Math.floor((x + 1000) / CH), 0, NCH - 1), cz = clamp(Math.floor((z + 1000) / CH), 0, 10), k = cx * 16 + cz;
    if (!chunks.has(k)) { const city = new GeoBuf(); city.tiers = [new GeoBuf(), new GeoBuf()]; chunks.set(k, { city, road: new GeoBuf(), x: (cx + 0.5) * CH - 1000, z: (cz + 0.5) * CH - 1000 }); }
    return chunks.get(k);
  };
  // collision shapes in a 32 m hash
  const HC = 32, hash = new Map();
  const addShape = (s) => {
    const P = 1.6, x0 = (s.t ? s.x - s.r : s.x0) - P, x1 = (s.t ? s.x + s.r : s.x1) + P, z0 = (s.t ? s.z - s.r : s.z0) - P, z1 = (s.t ? s.z + s.r : s.z1) + P;
    for (let i = Math.floor(x0 / HC); i <= Math.floor(x1 / HC); i++) for (let j = Math.floor(z0 / HC); j <= Math.floor(z1 / HC); j++) {
      const k = i * 4096 + j; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(s);
    }
  };
  const rect = (x0, z0, x1, z1) => addShape({ t: 0, x0, z0, x1, z1 });
  const circ = (x, z, r) => addShape({ t: 1, x, z, r });
  const W0 = [0, 0, 0, 0], Z4 = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const NEON = ['#ff3da8', '#2ee6d6', '#ffb547', '#9b5cff', '#3bff8a', '#ff5a3d', '#5fb8ff'].map(lin);
  const glowW = (c, a = 1) => [c[0], c[1], c[2], a];
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const mm = []; // minimap drawing list

  const C_DECK = lin('#2a2a33'), C_RAIL = lin('#3b3b46'), C_RLIGHT = lin('#7fc8ff'), C_SKYL = lin('#ff5fd2');
  const signs = []; // textured billboards, drawn as one mesh at the end
  // the underside, sides and concrete rails of an elevated road piece
  const deckPiece = (ch, L0, R0, L1, R1, nx, nz, lights) => {
    const dn = (p) => [p[0], p[1] - 1.2, p[2]], inn = (p, sg, d) => [p[0] + nx * sg * d, p[1], p[2] + nz * sg * d], up = (p, d) => [p[0], p[1] + d, p[2]];
    ch.quad(dn(L0), dn(R0), dn(R1), dn(L1), C_DECK, Z4, W0, [0, -1, 0]);
    ch.quad(L0, L1, dn(L1), dn(L0), C_DECK, Z4, W0, [-nx, 0, -nz]);
    ch.quad(R0, R1, dn(R1), dn(R0), C_DECK, Z4, W0, [nx, 0, nz]);
    for (const [A, B, sg] of [[L0, L1, 1], [R0, R1, -1]]) {
      const A2 = inn(A, sg, 0.35), B2 = inn(B, sg, 0.35);
      ch.quad(A2, B2, up(B2, 0.95), up(A2, 0.95), C_RAIL, Z4, W0, [nx * sg, 0, nz * sg]);
      ch.quad(up(A, 0.95), up(B, 0.95), up(B2, 0.95), up(A2, 0.95), lights || C_RAIL, Z4, lights ? [lights[0] * 0.6, lights[1] * 0.6, lights[2] * 0.6, 1] : W0, [0, 1, 0]);
      if (lights === C_SKYL) { const o = (p) => [p[0] - nx * sg * 0.03, p[1], p[2] - nz * sg * 0.03]; ch.quad(o(up(A, -0.55)), o(up(B, -0.55)), o(up(B, -0.3)), o(up(A, -0.3)), C_SKYL, Z4, [C_SKYL[0], C_SKYL[1], C_SKYL[2], 1], [-nx * sg, 0, -nz * sg]); }
      ch.quad(A, B, up(B, 0.95), up(A, 0.95), C_RAIL, Z4, W0, [-nx * sg, 0, -nz * sg]);
    }
  };
  // --- roads ---
  for (const e of edges) {
    const r = e.road, row = surfOf(e), w = r.w;
    const sA = e.lo + (e.xA ? 4 : 0), sB = e.hi - (e.xB ? 4 : 0);
    const strip = (a, b, rw, u0) => {
      // sample at polyline corners and at least every 40 m so pieces land in the right chunk
      const ss = [a];
      for (let s = a; s < b - 0.01;) {
        let nx = Math.min(b, s + (r.hAt ? 8 : 40));
        for (let k = 0; k < r.cum.length; k++) for (const off of r.closed ? [0, r.len] : [0]) { const c = r.cum[k] + off; if (c > s + 0.05 && c < nx) nx = c; }
        ss.push(nx); s = nx;
      }
      for (let k = 1; k < ss.length; k++) {
        const p0 = rPoint(r, ss[k - 1]), p1 = rPoint(r, ss[k]);
        // use the segment direction at the midpoint so corners stay closed
        const pm = rPoint(r, (ss[k - 1] + ss[k]) / 2), nx0 = -pm.tz, nz0 = pm.tx;
        const y0 = r.hAt ? r.hAt(ss[k - 1]) : 0, y1 = r.hAt ? r.hAt(ss[k]) : 0;
        const h = w / 2, L0 = [p0.x - nx0 * h, y0 + 0.06, p0.z - nz0 * h], R0 = [p0.x + nx0 * h, y0 + 0.06, p0.z + nz0 * h], L1 = [p1.x - nx0 * h, y1 + 0.06, p1.z - nz0 * h], R1 = [p1.x + nx0 * h, y1 + 0.06, p1.z + nz0 * h];
        if (Math.max(y0, y1) > 0.05) deckPiece(chunkOf(pm.x, pm.z).city, L0, R0, L1, R1, nx0, nz0, r.isBridge ? C_RLIGHT : r.sky ? C_SKYL : null);
        const u0v = u0 === undefined ? ss[k - 1] / 16 : u0, u1v = u0 === undefined ? ss[k] / 16 : u0 + (ss[k] - ss[k - 1]) / 16;
        chunkOf(pm.x, pm.z).road.quad(L0, L1, R1, R0, W0, [[u0v, rowV(rw, 0)], [u1v, rowV(rw, 0)], [u1v, rowV(rw, 1)], [u0v, rowV(rw, 1)]], W0, [0, 1, 0]);
      }
    };
    if (sB > sA) strip(sA, sB, row);
    if (e.xA) strip(e.lo, e.lo + 4, 4, 0);
    if (e.xB) strip(e.hi - 4, e.hi, 4, 0);
  }
  // intersection squares
  for (const n of nodes) {
    const rs = [...n.roads]; if (rs.length < 2) continue;
    const [A, B] = rs, mA = A.marks.find((m) => m.node === n), mB = B.marks.find((m) => m.node === n);
    const ta = rPoint(A, mA.s), tb = rPoint(B, mB.s), ha = clrAt(n, A), hb = clrAt(n, B);
    const P = (sa, sb) => [n.x + ta.tx * ha * sa + tb.tx * hb * sb, 0.06, n.z + ta.tz * ha * sa + tb.tz * hb * sb];
    const c = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], u1 = Math.max(ha, hb) / 8;
    chunkOf(n.x, n.z).road.quad(c[0], c[1], c[2], c[3], W0, [[0, rowV(3, 0.05)], [u1, rowV(3, 0.05)], [u1, rowV(3, 0.95)], [0, rowV(3, 0.95)]], W0, [0, 1, 0]);
  }
  for (const r of roads) mm.push({ k: 'road', pts: r.pts, w: r.w, type: r.type, closed: r.closed, sky: !!r.sky });

  const SKY = roads.find((r) => r.sky), skyS = [];
  let sbx0 = Infinity, sbz0 = Infinity, sbx1 = -Infinity, sbz1 = -Infinity;
  for (let s = 0; s <= SKY.len; s += 4) { const p = rPoint(SKY, s); skyS.push(p.x, p.z); sbx0 = Math.min(sbx0, p.x); sbx1 = Math.max(sbx1, p.x); sbz0 = Math.min(sbz0, p.z); sbz1 = Math.max(sbz1, p.z); }
  const nearSky = (x0, z0, x1, z1, pad) => {
    if (x1 < sbx0 - pad || x0 > sbx1 + pad || z1 < sbz0 - pad || z0 > sbz1 + pad) return false;
    for (let i = 0; i < skyS.length; i += 2) { const x = skyS[i], z = skyS[i + 1]; if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return true; }
    return false;
  };
  const nearRoad = (x, z, pad, skip) => roads.some((r) => { if (r === skip) return false; for (let k = 1; k < r.pts.length; k++) { const a = r.pts[k - 1], b = r.pts[k], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r.w / 2 + pad) return true; } return false; });
  mark();
  // --- street furniture along every edge: lamps, palms, trees ---
  const PG = roamPalmGeo(), TG = roamTreeGeo(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const C_TRUNK = lin('#6a5446'), C_LEAF = lin('#3f7046'), C_POLE = lin('#24232b'), C_LAMP = lin('#ffcf8a');
  const pools = [];
  const place = (g, x, z, ry, sc, col, y = 0) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); M4.compose(V.set(x, y, z), Q, S.set(sc, sc, sc)); chunkOf(x, z).city.geo(g, M4, col, W0); };
  // knockable props (trees, palms, traffic-light poles): remember which vertices and indices each one wrote into its
  // chunk (base mesh or a LOD tier), so a hit can hide exactly those and drop a copy of them (see knockDown)
  const props = [];
  const knockable = (x, z, y, r, build, extra) => {
    const ch = chunkOf(x, z), bufs = [ch.city, ch.city.tiers[0], ch.city.tiers[1]], before = bufs.map((b) => [b.v, b.i.length]);
    build();
    const ranges = [];
    bufs.forEach((b, k) => { if (b.v > before[k][0]) ranges.push([k, before[k][0], b.v, before[k][1], b.i.length]); });
    const p = { x, z, y, ch, ranges, down: false, ...extra }, sh = { t: 1, x, z, r, prop: p };
    props.push(p); addShape(sh);
  };
  const palm = (x, z, y = 0) => { if (y < 0.3 && nearSky(x, z, x, z, 13)) return; const ry = rnd() * 6.28, sc = 0.85 + rnd() * 0.35, lc = [C_LEAF[0] * (0.8 + rnd() * 0.4), C_LEAF[1], C_LEAF[2]]; knockable(x, z, y, 0.35, () => { place(PG.trunk, x, z, ry, sc, C_TRUNK, y); place(PG.leaves, x, z, ry, sc, lc, y); }); };
  const tree = (x, z, y = 0) => { if (y < 0.3 && nearSky(x, z, x, z, 13)) return; const ry = rnd() * 6.28, sc = 0.8 + rnd() * 0.5, cc = [0.07 + rnd() * 0.05, 0.17 + rnd() * 0.1, 0.07]; knockable(x, z, y, 0.4, () => { place(TG.trunk, x, z, ry, sc, C_TRUNK, y); place(TG.crown, x, z, ry, sc, cc, y); }); };
  const lamp = (x, z, nx, nz, H, reach, y0 = 0) => {
    if (y0 < 0.3 && nearSky(x, z, x, z, 13)) return;
    // pole on the sidewalk (or the deck rail), arm reaching over the road, a glowing head, a pool of light below
    const ch = chunkOf(x, z).city, ang = Math.atan2(nz, nx);
    ch.box(x - 0.09, z - 0.09, x + 0.09, z + 0.09, y0, y0 + H, C_POLE, W0, C_POLE, 0, 0, false);
    ch.obox(x + nx * reach / 2, z + nz * reach / 2, ang, reach / 2, 0.06, y0 + H - 0.12, y0 + H, C_POLE, W0);
    ch.obox(x + nx * reach, z + nz * reach, ang, 0.55, 0.2, y0 + H - 0.22, y0 + H - 0.05, C_LAMP, glowW(C_LAMP));
    pools.push([x + nx * reach, z + nz * reach, H, y0]); if (y0 < 0.3) circ(x, z, 0.25);
  };
  const coastal = (x, z) => z > 600;
  for (const e of edges) {
    const r = e.road, w = r.w, span = e.hi - e.lo; if (span < 14) continue;
    const step = r.type === 'highway' ? 46 : r.type === 'avenue' ? 30 : 36;
    let k = 0;
    for (let s = e.lo + 8; s < e.hi - 8; s += step, k++) {
      const p = rPoint(r, s), nx = -p.tz, nz = p.tx;
      const side = r.type === 'street' ? (k % 2 ? 1 : -1) : 0;
      for (const sd of side ? [side] : [1, -1]) {
        const off = sd > 0 ? 0 : step / 2; const q = off ? rPoint(r, s + off) : p; if (s + off > e.hi - 8) continue;
        if (inTunnel(q.x, q.z)) continue;
        const y0 = r.hAt ? r.hAt(s + off) : 0, edge = y0 > 0.3 ? w / 2 - 0.2 : w / 2 + 1.1;
        const qx = q.x + nx * sd * edge, qz = q.z + nz * sd * edge;
        lamp(qx, qz, -nx * sd, -nz * sd, r.type === 'highway' ? 9 : 7.4, r.type === 'street' ? 2.2 : 3.2, y0);
      }
    }
    // greenery: palms on avenues, the boulevard and the shore, trees on residential streets
    const pz = rPoint(r, (e.lo + e.hi) / 2), mid = { x: pz.x, z: pz.z };
    const downtown = Math.abs(mid.x) < 400 && mid.z > -400 && mid.z < 300;
    const isPalm = r.type !== 'street' || coastal(mid.x, mid.z) || mid.z > 300;
    const gap = r.type === 'highway' ? (coastal(mid.x, mid.z) ? 14 : 0) : r.type === 'avenue' ? 30 : downtown ? 0 : 26;
    if (gap) for (let s = e.lo + 12 + gap / 2; s < e.hi - 10; s += gap) {
      const p = rPoint(r, s), nx = -p.tz, nz = p.tx;
      for (const sd of [1, -1]) {
        if (r.hAt && r.hAt(s) > 0.3) continue;
        const x = p.x + nx * sd * (w / 2 + 2.6), z = p.z + nz * sd * (w / 2 + 2.6);
        if (isPalm) palm(x, z); else tree(x, z);
      }
    }
    // bus shelters on the avenues: a glass back wall, a bench, a lit advert
    if (r.type === 'avenue' && !r.hAt && !r.isle && span > 70 && rnd() < 0.55) {
      const p = rPoint(r, e.lo + 42), sd = rnd() < 0.5 ? 1 : -1, nx = -p.tz * sd, nz = p.tx * sd, x = p.x + nx * (w / 2 + 3.2), z = p.z + nz * (w / 2 + 3.2), ang = Math.atan2(p.tz, p.tx), nc = pick(NEON);
      if (!nearSky(x, z, x, z, 13)) {
        const ch = chunkOf(x, z).city;
        ch.obox(x, z, ang, 2.3, 0.85, 2.5, 2.64, C_POLE, W0);
        ch.obox(x + nx * 0.8, z + nz * 0.8, ang, 2.3, 0.04, 0.2, 2.5, lin('#3a4a5a'), [0.05, 0.08, 0.1, 1]);
        ch.obox(x + p.tx * 2.25, z + p.tz * 2.25, ang, 0.05, 0.8, 0.5, 2.3, nc, glowW(nc));
        ch.obox(x + nx * 0.45, z + nz * 0.45, ang, 1.3, 0.22, 0.2, 0.62, C_TRUNK, W0);
        circ(x - p.tx * 1.4, z - p.tz * 1.4, 0.8); circ(x + p.tx * 1.4, z + p.tz * 1.4, 0.8);
      }
    }
  }

  // --- traffic lights at street-grid crossings: a pole on the far right of every approach ---
  const sigHeads = [], C_SIG = lin('#111116');
  for (const n of nodes) {
    const rs = [...n.roads];
    if (n.edges.length < 3 || rs.length !== 2 || rs.some((r) => r.closed || r.type === 'highway' || r.isBridge)) continue;
    n.sig = { off: rnd() * 22 };
    const [A, B] = rs, ta = rPoint(A, A.marks.find((m) => m.node === n).s), tb = rPoint(B, B.marks.find((m) => m.node === n).s);
    for (const [road, t, other] of [[A, ta, B], [B, tb, A]]) for (const sg of [1, -1]) {
      const dx = t.tx * sg, dz = t.tz * sg, rx = -dz, rz = dx;
      const x = n.x + dx * (other.w / 2 + 2.4) + rx * (road.w / 2 + 1.7), z = n.z + dz * (other.w / 2 + 2.4) + rz * (road.w / 2 + 1.7);
      const ch = chunkOf(x, z).city;
      knockable(x, z, 0, 0.2, () => {
        ch.box(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 0, 4.4, C_POLE, W0, C_POLE, 0, 0, false);
        ch.box(x - 0.24, z - 0.24, x + 0.24, z + 0.24, 4.4, 5.7, C_SIG, W0, C_SIG);
      }, { sig: sigHeads.length });
      sigHeads.push({ n, axis: road.axis, x: x - dx * 0.3, z: z - dz * 0.3 });
    }
  }
  mark();
  // --- blocks: sidewalk slabs and a different building on every lot ---
  // Each lot picks a building type by district (towers, shop rows, restaurants and cafes with terraces,
  // houses, apartments, hotels, fuel stations, car parks, cinemas, columned halls, warehouses, tank farms,
  // plazas), and each type randomises its own size, colours, roof and signs.
  const C_SLAB = lin('#8a8684'), C_GRASS = lin('#465f38'), C_LAWN = lin('#52723f'), C_ROOF = lin('#55555c'), C_LOT = lin('#5e5d62'), C_PATH = lin('#3a3832'), C_STONE = lin('#8a8478'), C_WOOD = lin('#3a2a1e'), C_DARK = lin('#0c0d12'), C_WHITE = lin('#d8d8dc'), C_PALE = lin('#8a8a94'), C_WATER = lin('#0c2c48');
  const SLAB_TOP = { downtown: C_SLAB, west: lin('#33292a'), north: lin('#22252b'), shore: lin('#3b352e'), harbor: C_LOT };
  const FACADE = {
    downtown: ['#3a68a8', '#5a44a0', '#2c8a90', '#8a3a78', '#3a5a90', '#2e7a9a', '#22344e', '#4a4e62', '#1f5a66'],
    west: ['#b0603c', '#7a4aa0', '#3a8098', '#a08a40', '#943a5e', '#5a8a5a', '#a04a32', '#c09060', '#6a4a3a', '#2e6a6a'],
    north: ['#5a78a0', '#7a5a9a', '#4a8a68', '#9a5a5a', '#8a8a5a', '#b8a888', '#8a6a5a', '#6a7a8a'],
    shore: ['#c0784e', '#3a9a9a', '#b04a80', '#6a90b0', '#a09a50', '#8a5ab0', '#d8c8a8', '#e0a070', '#58a888'],
    harbor: ['#5a6070', '#806048', '#4a6a80', '#707070', '#3a5a50', '#8a4a3a']
  };
  const C_UNIT = lin('#3a3c46'), C_UNIT2 = lin('#4a4d58'), SHOPGLOW = lin('#ffd9a8');
  const GLOWS = [SHOPGLOW, SHOPGLOW, lin('#fff0d0'), lin('#cfe8ff'), lin('#ffc0e0')];
  const AWN = ['#d83a3a', '#2e9a6a', '#e0a030', '#3a6ad8', '#d84a9a', '#e8e0d0', '#7a3ad8'].map(lin);
  const EAT_COL = ['#8a3a2a', '#c8a070', '#2a5a5a', '#3a2a4a', '#a85a3a', '#1f3a2a', '#d0c0a0', '#7a2a3a', '#2a3a5a'].map(lin);
  const HOUSE_COL = ['#8f8a7e', '#86795f', '#6f7c8a', '#8a4e3a', '#667866', '#948c84', '#876e68', '#5c6878'].map(lin);
  const ROOF_COL = ['#7a3a2a', '#3a3f4a', '#5a2a2a', '#2f3a34', '#4a3a30'].map(lin);
  const CARCOL = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a'].map(lin);
  const TINTS = { warm: lin('#ffb35c'), soft: lin('#ffd9a0'), cool: lin('#9fd8ff'), white: lin('#dfe8ff'), pink: lin('#ff9ad0') };
  const CONT = ['#7a2a1f', '#1f4a7a', '#2a6a3a', '#a8641f', '#5a5f66', '#7a1f4a', '#2f6f73'].map(lin);
  const WSCALE = [[1, 1], [1, 1], [0.5, 1], [1.7, 1.2], [0.75, 0.8], [2.4, 1], [1.3, 1.4]]; // window width / floor height variants
  const SI = (name) => Math.max(0, SHOP_SIGNS.indexOf(name));
  const POOL = {
    eat: ['RESTAURANT', 'BISTRO', 'STEAK HOUSE', 'TRATTORIA', 'SUSHI BAR', 'RAMEN', 'NOODLES', 'BAR & GRILL', 'SEAFOOD', 'PLOV HOUSE', 'KEBAB', 'BBQ', 'PIZZA', 'TACOS', 'BURGERS', 'DINER'],
    cafe: ['CAFE', 'COFFEE', 'TEA HOUSE', 'CHOYXONA', 'BAKERY', 'DONUTS', 'ICE CREAM', 'SAMSA'],
    shop: ['BOOKS', 'RECORDS', 'FLOWERS', 'PHARMACY', 'MARKET', 'FASHION', 'ELECTRONICS', 'BARBER', 'LAUNDRY', 'TATTOO', 'VIDEO', 'SURF SHOP', 'SUPERMARKET', 'GYM', 'ARCADE', 'KARAOKE', 'PARTS', 'TIRES', 'BODY SHOP', 'PERFORMANCE SHOP', 'TUNER HAVEN', 'BANK'],
    night: ['CLUB', 'JAZZ CLUB', 'ROOFTOP BAR', 'NEON NIGHTS', 'BOWLING', 'KARAOKE', 'ARCADE'],
    hall: ['MUSEUM', 'GALLERY', 'LIBRARY', 'BANK', 'THEATER']
  };
  const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k, 1];
  const mkStyle = (d, lit, tint) => { const ws = pick(WSCALE); return { col: lin(pick(FACADE[d])), tint: tint || (d === 'harbor' ? TINTS.white : pick(rnd() < 0.7 ? [TINTS.warm, TINTS.soft] : [TINTS.cool, TINTS.white, TINTS.pink])), lit, uo: rnd(), vo: rnd(), su: ws[0], sv: ws[1] }; };
  const bx = (ch, r, y0, y1, st, roof = C_ROOF, k = 0) => ch.box(r[0], r[1], r[2], r[3], y0, y1, st.col, glowW(st.tint, st.lit), roof, st.uo + k * 0.37, st.vo, true, st.su, st.sv);
  const bp = (ch, r, y0, y1, col, win = W0, roof = col, top = true) => ch.box(r[0], r[1], r[2], r[3], y0, y1, col, win, roof, 0, 0, top);
  const solid = (r) => { rect(r[0], r[1], r[2], r[3]); mm.push({ k: 'bld', x0: r[0], z0: r[1], x1: r[2], z1: r[3] }); };
  // a face is [axis, wall coordinate, outward sign, from, to]; these place things along a wall and out from it
  const pt = (f, a, o) => (f[0] === 'z' ? [a, f[1] + f[2] * o] : [f[1] + f[2] * o, a]);
  const fr = (f, a0, a1, o0, o1) => { const p = pt(f, a0, o0), q = pt(f, a1, o1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
  const faceOf = (r, f) => (f[0] === 'z' ? ['z', f[2] < 0 ? r[1] : r[3], f[2], r[0], r[2]] : ['x', f[2] < 0 ? r[0] : r[2], f[2], r[1], r[3]]);
  const depthOf = (r, f) => (f[0] === 'z' ? r[3] - r[1] : r[2] - r[0]);
  const cut = (r, f, d) => { const t = r.slice(); if (f[0] === 'z') { if (f[2] < 0) { t[3] = r[1] + d; r[1] += d; } else { t[1] = r[3] - d; r[3] -= d; } } else if (f[2] < 0) { t[2] = r[0] + d; r[0] += d; } else { t[0] = r[2] - d; r[2] -= d; } return t; };
  const panel = (ch, f, a0, a1, y0, y1, col, win, off = 0.06, store = false) => {
    const o = f[1] + f[2] * off, L = Math.abs(a1 - a0), H = y1 - y0, U = store ? [[0, 0], [L, 0], [L, H], [0, H]] : Z4;
    if (f[0] === 'z') ch.quad([a0, y0, o], [a1, y0, o], [a1, y1, o], [a0, y1, o], col, U, win, [0, 0, f[2]]);
    else ch.quad([o, y0, a0], [o, y0, a1], [o, y1, a1], [o, y1, a0], col, U, win, [f[2], 0, 0]);
  };
  const awning = (ch, f, a0, a1, y, dp, col) => {
    const o = f[1] + f[2] * dp, w = dim(col, 0.2);
    if (f[0] === 'z') ch.quad([a0, y, f[1]], [a1, y, f[1]], [a1, y - 0.55, o], [a0, y - 0.55, o], col, Z4, w, [0, 1, f[2]]);
    else ch.quad([f[1], y, a0], [f[1], y, a1], [o, y - 0.55, a1], [o, y - 0.55, a0], col, Z4, w, [f[2], 1, 0]);
  };
  // text reads left to right for someone standing in front of the wall
  const signOn = (f, mid, half, y0, y1, shop, off = 0.32) => { const so = f[1] + f[2] * off; signs.push(f[0] === 'z' ? { x: mid, z: so, tx: f[2], tz: 0, half, y0, y1, shop } : { x: so, z: mid, tx: 0, tz: -f[2], half, y0, y1, shop }); };
  const prism = (ch, cx, cz, r0, n, y0, y1, col, win = W0, roof = col, r1 = r0, roofWin = W0, st = null) => {
    const P = (k, rr) => { const a = (k + 0.5) / n * Math.PI * 2; return [cx + rr * Math.cos(a), cz + rr * Math.sin(a)]; };
    const sl = 2 * r0 * Math.sin(Math.PI / n), su = st ? st.su : 1, sv = st ? st.sv : 1, uo = st ? st.uo : 0, vo = st ? st.vo : 0;
    for (let k = 0; k < n; k++) {
      const a = P(k, r0), b = P(k + 1, r0), a1 = P(k, r1), b1 = P(k + 1, r1), u0 = uo + k * sl / 48 * su, u1 = u0 + sl / 48 * su, v1 = vo + (y1 - y0) / 56 * sv;
      ch.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], col, [[u0, vo], [u1, vo], [u1, v1], [u0, v1]], win, [(a[0] + b[0]) / 2 - cx, r1 < r0 ? r0 * 0.6 : 0, (a[1] + b[1]) / 2 - cz]);
      if (r1 > 0.01) ch.quad([cx, y1, cz], [a1[0], y1, a1[1]], [b1[0], y1, b1[1]], [b1[0], y1, b1[1]], roof, Z4, roofWin, [0, 1, 0]);
    }
  };
  const gable = (ch, r, y, h, col, alongX, wall = col, wallWin = W0) => {
    const [x0, z0, x1, z1] = r, o = 0.4;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      ch.quad([x0 - o, y, z0 - o], [x1 + o, y, z0 - o], [x1 + o, y + h, zm], [x0 - o, y + h, zm], col, Z4, W0, [0, 1, -1]);
      ch.quad([x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, y + h, zm], [x0 - o, y + h, zm], col, Z4, W0, [0, 1, 1]);
      for (const [x, s] of [[x0, -1], [x1, 1]]) ch.quad([x, y, z0], [x, y, z1], [x, y + h, zm], [x, y + h, zm], wall, Z4, wallWin, [s, 0, 0]);
    } else {
      const xm = (x0 + x1) / 2;
      ch.quad([x0 - o, y, z0 - o], [x0 - o, y, z1 + o], [xm, y + h, z1 + o], [xm, y + h, z0 - o], col, Z4, W0, [-1, 1, 0]);
      ch.quad([x1 + o, y, z0 - o], [x1 + o, y, z1 + o], [xm, y + h, z1 + o], [xm, y + h, z0 - o], col, Z4, W0, [1, 1, 0]);
      for (const [z, s] of [[z0, -1], [z1, 1]]) ch.quad([x0, y, z], [x1, y, z], [xm, y + h, z], [xm, y + h, z], wall, Z4, wallWin, [0, 0, s]);
    }
  };
  // thin glowing posts on the corners and a rim along the roofline
  const neonEdges = (ch, x0, z0, x1, z1, y0, y1, nc) => {
    const e = 0.18, W = glowW(nc);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) ch.box(x - e, z - e, x + e, z + e, y0, y1, nc, W, nc, 0, 0, false);
    ch.box(x0 - e, z0 - e, x1 + e, z0 + e, y1 - 0.3, y1, nc, W, nc); ch.box(x0 - e, z1 - e, x1 + e, z1 + e, y1 - 0.3, y1, nc, W, nc);
    ch.box(x0 - e, z0 - e, x0 + e, z1 + e, y1 - 0.3, y1, nc, W, nc); ch.box(x1 - e, z0 - e, x1 + e, z1 + e, y1 - 0.3, y1, nc, W, nc);
  };
  const roofRim = (ch, r, y, nc) => neonEdges(ch, r[0], r[1], r[2], r[3], y - 0.01, y, nc);
  // a parked car: body, glass, a pair of tail lights
  const parked = (ch, x, z, alongX, flip) => {
    const c = pick(CARCOL), s = flip ? -1 : 1, R = (a0, a1, hw) => (alongX ? [x + Math.min(a0 * s, a1 * s), z - hw, x + Math.max(a0 * s, a1 * s), z + hw] : [x - hw, z + Math.min(a0 * s, a1 * s), x + hw, z + Math.max(a0 * s, a1 * s)]);
    bp(ch, R(-1.95, 1.95, 0.72), 0.16, 0.45, C_DARK); bp(ch, R(-2.1, 2.1, 0.88), 0.42, 0.95, c); bp(ch, R(-1.45, 0.65, 0.76), 0.95, 1.42, C_DARK, dim(TINTS.cool, 0.04));
    bp(ch, R(-2.14, -2.08, 0.8), 0.68, 0.84, RED0, dim(RED0, 0.5));
    const b = R(-2.1, 2.1, 0.88); rect(b[0], b[1], b[2], b[3]);
  };
  const RED0 = lin('#ff2030');
  // rows of bays with some cars in them
  const carPark = (ch, r, fill = 0.4) => {
    const C = lin('#9a9aa6'), W = dim(C, 0.15), alongX = r[2] - r[0] >= r[3] - r[1], len = alongX ? r[2] - r[0] : r[3] - r[1], wid = alongX ? r[3] - r[1] : r[2] - r[0];
    for (let row = 0; row * 11.5 + 5.4 <= wid; row++) for (let a = 1.5; a + 2.8 <= len - 1; a += 2.8) {
      const v = (alongX ? r[1] : r[0]) + row * 11.5, u = (alongX ? r[0] : r[1]) + a;
      if (alongX) ch.quad([u, 0.2, v + 0.3], [u + 0.12, 0.2, v + 0.3], [u + 0.12, 0.2, v + 5.2], [u, 0.2, v + 5.2], C, Z4, W, [0, 1, 0]);
      else ch.quad([v + 0.3, 0.2, u], [v + 0.3, 0.2, u + 0.12], [v + 5.2, 0.2, u + 0.12], [v + 5.2, 0.2, u], C, Z4, W, [0, 1, 0]);
      if (rnd() < fill) { if (alongX) parked(ch, u + 1.4, v + 2.8, false, rnd() < 0.5); else parked(ch, v + 2.8, u + 1.4, true, rnd() < 0.5); }
    }
  };
  // a round table under an umbrella
  const table = (ch, x, z, col) => {
    bp(ch, [x - 0.45, z - 0.45, x + 0.45, z + 0.45], 0.72, 0.8, C_WOOD); bp(ch, [x - 0.05, z - 0.05, x + 0.05, z + 0.05], 0.2, 2.35, C_POLE, W0, C_POLE, false);
    prism(ch, x, z, 1.3, 6, 2.2, 2.85, col, dim(col, 0.16), col, 0); circ(x, z, 0.55);
  };
  // a line of small bulbs between two points
  const bulbs = (ch, x0, z0, x1, z1, y, c = C_LAMP) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.4)); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n, yy = y - 0.35 * Math.sin(k / n * Math.PI); ch.box(x - 0.07, z - 0.07, x + 0.07, z + 0.07, yy, yy + 0.14, c, glowW(c), c); } };
  const planter = (ch, x, z, w, l) => { bp(ch, [x - w / 2, z - l / 2, x + w / 2, z + l / 2], 0.16, 0.75, C_UNIT, W0, lin('#1c4a2a')); rect(x - w / 2, z - l / 2, x + w / 2, z + l / 2); };
  const globe = (ch, x, z, h = 3.2) => { ch.box(x - 0.06, z - 0.06, x + 0.06, z + 0.06, 0.16, h, C_POLE, W0, C_POLE, 0, 0, false); ch.box(x - 0.22, z - 0.22, x + 0.22, z + 0.22, h, h + 0.44, C_LAMP, glowW(C_LAMP), C_LAMP); pools.push([x, z, h, 0]); circ(x, z, 0.2); };
  const fountain = (ch, x, z, r) => {
    prism(ch, x, z, r, 12, 0.16, 0.85, C_STONE, W0, C_STONE, r); prism(ch, x, z, r - 0.4, 12, 0.6, 0.7, C_WATER, dim(lin('#3aa8ff'), 0.5), C_WATER, r - 0.4, dim(lin('#3aa8ff'), 0.5));
    prism(ch, x, z, 0.5, 8, 0.7, 1.9, C_STONE); prism(ch, x, z, 0.16, 6, 1.9, 3.6, lin('#bfe6ff'), dim(lin('#bfe6ff'), 0.6), lin('#bfe6ff'), 0.05); circ(x, z, r + 0.1);
  };
  // lit window band, awning and a sign on one street wall
  const shopfront = (ch, f, pool, y1 = 3.2, aw = 0.6) => {
    const f0 = f[3], f1 = f[4], m0 = f0 + (f1 - f0) * 0.08, m1 = f1 - (f1 - f0) * 0.08, g = pick(GLOWS);
    panel(ch, f, m0, m1, 0.5, y1, g, [g[0] * 0.3, g[1] * 0.3, g[2] * 0.3, 0.97], 0.06, true);
    if (rnd() < aw) awning(ch, f, m0, m1, y1 + 0.55, 1.2 + rnd() * 0.7, pick(AWN));
    if (f1 - f0 > 6 && pool) signOn(f, (f0 + f1) / 2 + (rnd() - 0.5) * Math.max(0, f1 - f0 - 8) * 0.5, Math.min(3, (f1 - f0) / 2 - 0.5), y1 + 0.75, y1 + 2.2, SI(pick(pool)));
  };
  const roofUnits = (ch, r, y, n) => { for (let k = 0; k < n; k++) { const w = 1.4 + rnd() * 2.2, l = 1.4 + rnd() * 2.8, ux = r[0] + 1 + rnd() * Math.max(0.1, r[2] - r[0] - w - 2), uz = r[1] + 1 + rnd() * Math.max(0.1, r[3] - r[1] - l - 2); ch.box(ux, uz, ux + w, uz + l, y, y + 0.9 + rnd() * 1.2, rnd() < 0.5 ? C_UNIT : C_UNIT2, W0, rnd() < 0.5 ? C_UNIT : C_UNIT2); } };

  /* ---- building types ---- */
  const tower = (ch, r, faces, d, hgt) => {
    const st = mkStyle(d, d === 'downtown' ? 0.35 + rnd() * 0.3 : d === 'harbor' ? 0.06 : 0.22 + rnd() * 0.25), w = Math.min(r[2] - r[0], r[3] - r[1]), v = rnd();
    const parts = [[r[0], r[1], r[2], r[3], 0.16, hgt]], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    let round = 0;
    if (d === 'downtown' && hgt > 60 && v < 0.3) { const h1 = hgt * (0.45 + rnd() * 0.2), ins = w * 0.18; parts[0][5] = h1; parts.push([r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins, h1, hgt]); } // setback tower
    else if (d === 'downtown' && hgt > 85 && v < 0.48) { const ins = w * 0.13; parts[0][5] = hgt * 0.4; parts.push([r[0] + ins, r[1] + ins, r[2] - ins, r[3] - ins, hgt * 0.4, hgt * 0.72], [r[0] + ins * 2, r[1] + ins * 2, r[2] - ins * 2, r[3] - ins * 2, hgt * 0.72, hgt]); } // three tiers
    else if (hgt > 40 && v < 0.66 && w > 13) { parts[0][5] = 8 + rnd() * 5; round = w / 2 * (0.82 + rnd() * 0.14); } // round tower on a podium
    parts.forEach(([x0, z0, x1, z1, y0, y1], i) => bx(ch, [x0, z0, x1, z1], y0, y1, st, C_ROOF, i));
    const nc = pick(NEON), top = parts[parts.length - 1];
    if (round) {
      const y0 = parts[0][5], n = rnd() < 0.5 ? 8 : 14;
      prism(ch, cx, cz, round, n, y0, hgt, st.col, glowW(st.tint, st.lit), C_ROOF, round, W0, st);
      prism(ch, cx, cz, round + 0.12, n, hgt - 2.4, hgt - 1.5, nc, glowW(nc), nc, round + 0.12); prism(ch, cx, cz, round + 0.12, n, y0 + 0.2, y0 + 0.6, nc, glowW(nc), nc, round + 0.12);
      if (rnd() < 0.4) prism(ch, cx, cz, round * 0.8, n, hgt, hgt + 6 + rnd() * 8, st.col, dim(nc, 0.25), nc, 0.3);
    } else if (d === 'downtown' && hgt > 40 && rnd() < 0.7) { // neon edges and a glowing crown
      parts.forEach(([x0, z0, x1, z1, y0, y1]) => neonEdges(ch, x0, z0, x1, z1, y0 + 4, y1, nc));
      const [x0, z0, x1, z1, , y1] = top, cw = glowW(nc, 1), o = 0.08;
      ch.quad([x0, y1 - 2.4, z0 - o], [x1, y1 - 2.4, z0 - o], [x1, y1 - 1.5, z0 - o], [x0, y1 - 1.5, z0 - o], nc, Z4, cw, [0, 0, -1]);
      ch.quad([x0, y1 - 2.4, z1 + o], [x1, y1 - 2.4, z1 + o], [x1, y1 - 1.5, z1 + o], [x0, y1 - 1.5, z1 + o], nc, Z4, cw, [0, 0, 1]);
      ch.quad([x0 - o, y1 - 2.4, z0], [x0 - o, y1 - 2.4, z1], [x0 - o, y1 - 1.5, z1], [x0 - o, y1 - 1.5, z0], nc, Z4, cw, [-1, 0, 0]);
      ch.quad([x1 + o, y1 - 2.4, z0], [x1 + o, y1 - 2.4, z1], [x1 + o, y1 - 1.5, z1], [x1 + o, y1 - 1.5, z0], nc, Z4, cw, [1, 0, 0]);
    } else if (d !== 'harbor' && hgt > 16 && rnd() < 0.25) roofRim(ch, r, hgt, nc);
    let tip = hgt;
    if (!round && hgt > 95 && rnd() < 0.6) { const sh = 10 + rnd() * 18; ch.box(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3, hgt, hgt + sh, C_POLE, W0, C_POLE); tip = hgt + sh; }
    if (hgt > 60 && !round) ch.box(cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4, tip, tip + 0.8, RED0, glowW(RED0), RED0);
    if (hgt < 45 && !round && rnd() < 0.75) roofUnits(ch, top, hgt, 1 + Math.floor(rnd() * 3));
    if (d !== 'harbor') for (const f of faces) if (rnd() > 0.3) shopfront(ch, f, rnd() < 0.7 ? POOL.shop : POOL.night, 3.2, 0.25);
    if (d === 'downtown' && hgt < 70 && !round && rnd() < 0.35) { // rooftop billboard
      const along = rnd() < 0.5, L = along ? (r[2] - r[0]) * 0.7 : (r[3] - r[1]) * 0.7, half = Math.min(L / 2, 5.5), tx = along ? 1 : 0, tz = along ? 0 : 1;
      signs.push({ x: cx, z: cz, tx, tz, half, y0: hgt + 2.5, y1: hgt + 2.5 + half, panel: pick([0, 1, 3, 4, 5, 6]) });
      for (const o of [-0.7, 0.7]) ch.box(cx + tx * half * o - 0.15, cz + tz * half * o - 0.15, cx + tx * half * o + 0.15, cz + tz * half * o + 0.15, hgt, hgt + 2.5, C_POLE, W0, C_POLE, 0, 0, false);
    }
    if (rnd() < (d === 'downtown' ? 0.75 : d === 'harbor' ? 0.08 : 0.3) && hgt > 14) for (const f of faces) { // vertical neon blades
      if (rnd() < 0.35) continue;
      const c = pick(NEON), pos = f[3] + 2 + rnd() * (f[4] - f[3] - 4), y0 = 6.5 + rnd() * 4, y1 = y0 + 5 + rnd() * Math.min(10, hgt - y0 - 4);
      panel(ch, f, pos - 0.8, pos + 0.8, y0, y1, c, glowW(c), 0.3);
    }
    solid(r);
  };
  // restaurant or cafe: a low building set back behind a terrace with tables, umbrellas and string lights
  const eatery = (ch, r, faces, d, cafe) => {
    const f0 = faces[0], R2 = r.slice(), dep = depthOf(r, f0), tdp = dep > 12 ? Math.min(dep - 8, 4 + rnd() * 3) : 0;
    if (tdp) cut(R2, f0, tdp);
    const ff = faceOf(R2, f0), h = cafe ? 3.8 + rnd() * 1.4 : 4.4 + rnd() * 4, col = pick(EAT_COL), aw = pick(AWN), a0 = ff[3], a1 = ff[4];
    const st = { col, tint: TINTS.warm, lit: 0.45 + rnd() * 0.3, uo: rnd(), vo: rnd(), su: 1, sv: 1 };
    bx(ch, R2, 0.16, h, st, C_ROOF);
    const v = rnd();
    if (v < (cafe ? 0.55 : 0.25)) gable(ch, R2, h, 1.8 + rnd() * 1.2, pick(ROOF_COL), f0[0] === 'z', col, dim(col, 0.5));
    else if (v < 0.7) roofRim(ch, R2, h, pick(NEON));
    else roofUnits(ch, R2, h, 1 + Math.floor(rnd() * 2));
    // glass front, a long awning, the name above it
    const g = pick(GLOWS), m0 = a0 + (a1 - a0) * 0.06, m1 = a1 - (a1 - a0) * 0.06;
    panel(ch, ff, m0, m1, 0.45, 2.95, g, dim(g, 0.36)); awning(ch, ff, m0, m1, 3.5, 1.6, aw);
    signOn(ff, (a0 + a1) / 2, Math.min(3.4, (a1 - a0) / 2 - 0.4), h > 5.6 ? 3.9 : h - 0.2, h > 5.6 ? 5.5 : h + 1.4, SI(pick(cafe ? POOL.cafe : POOL.eat)));
    for (const f of faces.slice(1)) shopfront(ch, faceOf(R2, f), null, 2.9, 0.8);
    if (!cafe && h > 6.5 && rnd() < 0.5) { const c = pick(NEON), pos = a0 + 1.5 + rnd() * (a1 - a0 - 3); panel(ch, ff, pos - 0.6, pos + 0.6, 4.2, h + 2.5, c, glowW(c), 0.4); }
    solid(R2);
    if (!tdp) return;
    const tr = fr(ff, a0, a1, 0.3, tdp - 0.2); bp(ch, tr, 0.16, 0.24, C_WOOD);
    for (let o = 1.9; o < tdp - 1.2; o += 3.1) for (let a = a0 + 2 + rnd(); a < a1 - 1.6; a += 3.3) { if (rnd() < 0.2) continue; const p = pt(ff, a, o); table(ch, p[0], p[1], aw); }
    const e0 = pt(ff, a0 + 0.3, tdp - 0.4), e1 = pt(ff, a1 - 0.3, tdp - 0.4), w0 = pt(ff, a0 + 0.3, 0.2), w1 = pt(ff, a1 - 0.3, 0.2);
    for (const p of [e0, e1]) { ch.box(p[0] - 0.06, p[1] - 0.06, p[0] + 0.06, p[1] + 0.06, 0.2, 3.3, C_POLE, W0, C_POLE, 0, 0, false); circ(p[0], p[1], 0.2); }
    bulbs(ch, e0[0], e0[1], e1[0], e1[1], 3.25); bulbs(ch, e0[0], e0[1], w0[0], w0[1], 3.25); bulbs(ch, e1[0], e1[1], w1[0], w1[1], 3.25);
    pools.push([(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 3, 0]);
  };
  // a row of narrow shop-houses sharing the lot, each its own height, colour and roof
  const shops = (ch, r, faces, d) => {
    const f = faces.slice().sort((a, b) => (b[4] - b[3]) - (a[4] - a[3]))[0], dep = depthOf(r, f), len = f[4] - f[3], n = Math.max(1, Math.round(len / (6.5 + rnd() * 3.5)));
    for (let k = 0; k < n; k++) {
      const a0 = f[3] + len * k / n, a1 = f[3] + len * (k + 1) / n, u = fr(f, a0, a1, 0, -dep), h = 6.8 + Math.floor(rnd() * 4) * 3.2, st = mkStyle(d, 0.25 + rnd() * 0.35);
      bx(ch, u, 0.16, h, st, C_ROOF, k);
      const v = rnd();
      if (v < 0.35) gable(ch, u, h, 1.6 + rnd() * 1.4, pick(ROOF_COL), f[0] === 'z', st.col, dim(st.col, 0.5));
      else if (v < 0.5) roofRim(ch, u, h, pick(NEON)); else if (v < 0.85) roofUnits(ch, u, h, 1);
      shopfront(ch, [f[0], f[1], f[2], a0 + 0.3, a1 - 0.3], rnd() < 0.3 ? POOL.cafe : rnd() < 0.4 ? POOL.eat : POOL.shop, 3.1, 0.7);
    }
    for (const g of faces) if (g !== f && rnd() < 0.6) shopfront(ch, g, POOL.shop, 3.1, 0.5);
    solid(r);
  };
  // family houses with pitched roofs, lawns, lit windows and the odd car in the drive
  const houses = (ch, r, faces, d) => {
    const f = faces.slice().sort((a, b) => (b[4] - b[3]) - (a[4] - a[3]))[0], dep = depthOf(r, f), len = f[4] - f[3], n = Math.max(1, Math.round(len / (12 + rnd() * 4)));
    bp(ch, r, 0.16, 0.2, C_LAWN); mm.push({ k: 'park', x0: r[0], z0: r[1], x1: r[2], z1: r[3] });
    for (let k = 0; k < n; k++) {
      const a0 = f[3] + len * k / n, a1 = f[3] + len * (k + 1) / n, drive = a1 - a0 > 11.5 && rnd() < 0.55, sb = 2.5 + rnd() * 3, hd = Math.min(dep - sb - 1.5, 7.5 + rnd() * 3.5);
      if (hd < 5) continue;
      const u = fr(f, a0 + 1.2 + (drive ? 3 : 0), a1 - 1.2, -sb, -sb - hd), two = rnd() < 0.5, h = two ? 6.3 : 3.4, col = pick(HOUSE_COL), white = d === 'shore' && rnd() < 0.6;
      const st = { col: white ? C_PALE : col, tint: pick([TINTS.warm, TINTS.soft, TINTS.soft, TINTS.cool]), lit: 0.3 + rnd() * 0.45, uo: rnd(), vo: rnd(), su: 1.25, sv: 1.1 };
      bx(ch, u, 0.16, h, st, C_ROOF);
      if (white && rnd() < 0.7) { bp(ch, [u[0] - 0.3, u[1] - 0.3, u[2] + 0.3, u[3] + 0.3], h, h + 0.25, C_WHITE); if (two) roofUnits(ch, u, h + 0.25, 1); } // flat-roofed villa
      else gable(ch, u, h, 1.9 + rnd() * 1.1, pick(ROOF_COL), (f[0] === 'z') === (rnd() < 0.7), st.col, dim(st.col, 0.5));
      const hf = faceOf(u, f), dm = (hf[3] + hf[4]) / 2 + (rnd() - 0.5) * 2;
      panel(ch, hf, dm - 0.5, dm + 0.5, 0.2, 2.2, C_WOOD, W0); panel(ch, hf, dm - 0.18, dm + 0.18, 2.4, 2.7, C_LAMP, glowW(C_LAMP), 0.12);
      if (rnd() < 0.5) { const p = pt(hf, dm, 0.5); ch.box(p[0] - 1.3, p[1] - 0.5, p[0] + 1.3, p[1] + 0.5, 0.16, 0.42, C_STONE, W0, C_STONE); }
      rect(u[0], u[1], u[2], u[3]); mm.push({ k: 'bld', x0: u[0], z0: u[1], x1: u[2], z1: u[3] });
      if (drive) { const dr = fr(f, a0 + 0.6, a0 + 3.6, 0, -sb - hd); bp(ch, dr, 0.16, 0.22, C_LOT); if (rnd() < 0.6) { const p = pt(f, a0 + 2.1, -sb - 2.6); parked(ch, p[0], p[1], f[0] === 'x', rnd() < 0.5); } }
      if (dep - sb - hd > 5 && rnd() < 0.6) { const p = pt(f, a0 + 2 + rnd() * (a1 - a0 - 4), -sb - hd - 2.5); tree(p[0], p[1]); }
    }
  };
  // apartment block with balconies on the street side
  const apart = (ch, r, faces, d) => {
    const st = mkStyle(d, 0.3 + rnd() * 0.3), fl = 4 + Math.floor(rnd() * 6), h = 0.5 + fl * 3.3; st.su = 0.85; st.sv = 3.5 / 3.3;
    bx(ch, r, 0.16, h, st, C_ROOF);
    const f = faces[0], m0 = f[3] + (f[4] - f[3]) * 0.1, m1 = f[4] - (f[4] - f[3]) * 0.1, bc = rnd() < 0.5 ? C_WHITE : C_UNIT2, half = rnd() < 0.5;
    for (let k = 1; k < Math.min(fl, 8); k++) {
      const y = 0.4 + k * 3.3;
      for (const [b0, b1] of half ? [[m0, (m0 + m1) / 2 - 1], [(m0 + m1) / 2 + 1, m1]] : [[m0, m1]]) { bp(ch, fr(f, b0, b1, 0, 1.15), y, y + 0.16, bc); bp(ch, fr(f, b0, b1, 1.07, 1.15), y + 0.16, y + 1.05, bc, W0, bc, false); }
    }
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    ch.box(cx - 2, cz - 1.5, cx + 2, cz + 1.5, h, h + 2.6, C_UNIT, W0, C_UNIT); if (rnd() < 0.5) prism(ch, r[0] + 2.5, r[1] + 2.5, 1.3, 10, h + 0.6, h + 2.6, C_UNIT2);
    if (rnd() < 0.3) roofRim(ch, r, h, pick(NEON));
    for (const g of faces) if (rnd() < 0.45) shopfront(ch, g, rnd() < 0.5 ? POOL.shop : POOL.cafe, 3.0, 0.6);
    solid(r);
  };
  // hotel: a slab behind a forecourt, with a lit canopy over the door and a glowing crown
  const hotel = (ch, r, faces, d) => {
    const f0 = faces[0], R2 = r.slice(), fc = depthOf(r, f0) > 20 ? 5 : 0; if (fc) cut(R2, f0, fc);
    const ff = faceOf(R2, f0), h = d === 'shore' ? 16 + rnd() * 20 : 30 + rnd() * 38, st = mkStyle(d, 0.45 + rnd() * 0.2, pick([TINTS.warm, TINTS.soft])); st.su = 1.25; st.sv = 1.1;
    if (d === 'shore' && rnd() < 0.5) st.col = C_PALE;
    bx(ch, R2, 0.16, h, st, C_ROOF);
    const nc = pick([TINTS.warm, lin('#ffd27a'), lin('#5fb8ff'), lin('#ff5fa8')]); roofRim(ch, R2, h, nc);
    for (const [x0, z0, x1, z1] of [R2]) neonEdges(ch, x0, z0, x1, z1, h - 3, h, nc);
    const mid = (ff[3] + ff[4]) / 2, cw = Math.min(5, (ff[4] - ff[3]) / 2 - 1), cd = fc ? 4.4 : 2.2, cr = fr(ff, mid - cw, mid + cw, 0, cd);
    bp(ch, cr, 3.7, 4.2, C_UNIT2, W0, C_UNIT2); ch.quad([cr[0], 3.68, cr[1]], [cr[2], 3.68, cr[1]], [cr[2], 3.68, cr[3]], [cr[0], 3.68, cr[3]], SHOPGLOW, Z4, dim(SHOPGLOW, 0.3), [0, -1, 0]);
    if (fc) for (const a of [mid - cw + 0.3, mid + cw - 0.3]) { const p = pt(ff, a, cd - 0.3); ch.box(p[0] - 0.2, p[1] - 0.2, p[0] + 0.2, p[1] + 0.2, 0.16, 3.7, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(p[0], p[1], 0.35); }
    panel(ch, ff, mid - cw, mid + cw, 0.4, 3.4, SHOPGLOW, dim(SHOPGLOW, 0.4)); pools.push(pt(ff, mid, cd / 2).concat([3.7, 0]));
    signOn([ff[0], ff[1] + ff[2] * cd, ff[2], 0, 0], mid, Math.min(3.6, cw), 4.3, 6.1, SI(rnd() < 0.8 ? 'HOTEL' : 'MOTEL'), 0.05);
    if (h > 34 && rnd() < 0.5) { const along = f0[0] === 'z', cx = (R2[0] + R2[2]) / 2, cz = (R2[1] + R2[3]) / 2, half = 5; signs.push({ x: cx, z: cz, tx: along ? f0[2] : 0, tz: along ? 0 : -f0[2], half, y0: h + 1.5, y1: h + 6.5, panel: 6 }); for (const o of [-3.5, 3.5]) ch.box(cx + (along ? o : 0) - 0.15, cz + (along ? 0 : o) - 0.15, cx + (along ? o : 0) + 0.15, cz + (along ? 0 : o) + 0.15, h, h + 1.5, C_POLE, W0, C_POLE, 0, 0, false); }
    if (fc && d === 'shore') for (const a of [ff[3] + 2, ff[4] - 2]) { const p = pt(ff, a, 2.6); palm(p[0], p[1]); }
    for (const g of faces.slice(1)) if (rnd() < 0.5) shopfront(ch, faceOf(R2, g), POOL.eat, 3.2, 0.5);
    solid(R2);
  };
  // fuel station: a lit canopy over two pump islands, a shop at the back and a price sign by the road
  const gas = (ch, r, faces) => {
    const f = faces[0], dep = depthOf(r, f), a0 = f[3], a1 = f[4], mid = (a0 + a1) / 2, nc = pick(NEON), ax = f[0] === 'z';
    bp(ch, r, 0.16, 0.2, C_LOT);
    const kd = Math.min(6, dep * 0.28), kr = fr(f, a0 + 1, a1 - 1, -dep + kd + 0.5, -dep + 0.5), kf = faceOf(kr, f);
    bp(ch, kr, 0.16, 3.8, C_WHITE, W0, C_ROOF); panel(ch, kf, kf[3] + 0.6, kf[4] - 0.6, 0.5, 3.0, SHOPGLOW, dim(SHOPGLOW, 0.4)); roofRim(ch, kr, 3.8, nc);
    signOn(kf, mid, Math.min(3, (a1 - a0) / 2 - 1.5), 3.9, 5.3, SI(pick(['MARKET', 'COFFEE', 'TIRES', 'CAR WASH']))); solid(kr);
    const cw = Math.min(8, (a1 - a0) / 2 - 2), c0 = -1.5, c1 = -Math.min(dep - kd - 3, 10.5), cr = fr(f, mid - cw, mid + cw, c0, c1);
    bp(ch, cr, 5.0, 5.7, C_WHITE, W0, C_WHITE); neonEdges(ch, cr[0], cr[1], cr[2], cr[3], 5.69, 5.7, nc);
    ch.quad([cr[0], 4.98, cr[1]], [cr[2], 4.98, cr[1]], [cr[2], 4.98, cr[3]], [cr[0], 4.98, cr[3]], C_WHITE, Z4, dim(lin('#eaf2ff'), 0.32), [0, -1, 0]);
    pools.push([(cr[0] + cr[2]) / 2, (cr[1] + cr[3]) / 2, 5, 0], pt(f, mid - cw / 2, (c0 + c1) / 2).concat([5, 0]), pt(f, mid + cw / 2, (c0 + c1) / 2).concat([5, 0]));
    for (const a of [mid - cw + 0.6, mid + cw - 0.6]) for (const o of [c0 - 0.6, c1 + 0.6]) { const p = pt(f, a, o); ch.box(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18, 0.16, 5, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(p[0], p[1], 0.3); }
    for (const a of [mid - cw * 0.45, mid + cw * 0.45]) { const pr = fr(f, a - 1.5, a + 1.5, (c0 + c1) / 2 + 0.35, (c0 + c1) / 2 - 0.35); bp(ch, pr, 0.16, 0.34, C_UNIT); for (const s of [-0.8, 0.8]) { const q = pt(f, a + s, (c0 + c1) / 2); ch.box(q[0] - 0.28, q[1] - 0.28, q[0] + 0.28, q[1] + 0.28, 0.34, 1.75, RED0, dim(RED0, 0.06), C_WHITE); ch.box(q[0] - 0.2, q[1] - 0.2, q[0] + 0.2, q[1] + 0.2, 1.75, 1.95, C_LAMP, glowW(C_LAMP), C_LAMP); } rect(pr[0], pr[1], pr[2], pr[3]); }
    const tp = pt(f, a0 + 1.2, -0.8); ch.box(tp[0] - 0.2, tp[1] - 0.2, tp[0] + 0.2, tp[1] + 0.2, 0.16, 5.2, C_UNIT2, W0, C_UNIT2, 0, 0, false); circ(tp[0], tp[1], 0.35);
    signs.push({ x: tp[0], z: tp[1], tx: ax ? f[2] : 0, tz: ax ? 0 : -f[2], half: 1.8, y0: 5.2, y1: 6.5, shop: SI('FUEL') });
  };
  // multi-storey car park: open decks with the lights left on
  const garage = (ch, r, faces) => {
    const n = 3 + Math.floor(rnd() * 4), col = lin(pick(['#4a4c55', '#5a5850', '#3e4450'])), ins = [r[0] + 0.5, r[1] + 0.5, r[2] - 0.5, r[3] - 0.5], gl = pick([TINTS.soft, TINTS.cool, TINTS.white]);
    for (let k = 0; k < n; k++) { const y = 0.16 + k * 3.1; bp(ch, ins, y, y + 2.2, C_DARK, dim(gl, 0.07), C_DARK, false); bp(ch, r, y + 2.2, y + 3.1 + (k === n - 1 ? 0.3 : 0), col, W0, C_LOT); }
    const h = 0.16 + n * 3.1 + 0.3, f = faces[0], mid = (f[3] + f[4]) / 2;
    panel(ch, f, mid - 3, mid + 3, 0.2, 2.3, C_DARK, dim(gl, 0.3), 0.08); signOn(f, mid, 2.8, 2.5, 3.9, SI('PARKING'));
    ch.box(r[0] + 1, r[1] + 1, r[0] + 5, r[1] + 5, h, h + 2.8, col, W0, col); globe(ch, r[2] - 2, r[3] - 2, h + 3); pools.pop();
    solid(r);
  };
  // cinema: a marquee blazing over the doors, posters either side, a neon blade on the corner
  const cinema = (ch, r, faces, d) => {
    const f = faces[0], h = 10 + rnd() * 5, col = lin(pick(['#3a1830', '#1c1c34', '#40201c', '#18303a'])), nc = pick(NEON), mid = (f[3] + f[4]) / 2, hw = Math.min(6.5, (f[4] - f[3]) / 2 - 0.6);
    bp(ch, r, 0.16, h, col, glowW(col, 0.02), C_ROOF); roofRim(ch, r, h, nc);
    const mr = fr(f, mid - hw, mid + hw, 0, 2.6), mf = [f[0], f[1] + f[2] * 2.6, f[2], mid - hw, mid + hw];
    bp(ch, mr, 4.0, 5.6, C_DARK); ch.quad([mr[0], 3.98, mr[1]], [mr[2], 3.98, mr[1]], [mr[2], 3.98, mr[3]], [mr[0], 3.98, mr[3]], C_LAMP, Z4, dim(C_LAMP, 0.4), [0, -1, 0]);
    panel(ch, mf, mid - hw, mid + hw, 4.0, 4.14, nc, glowW(nc)); panel(ch, mf, mid - hw, mid + hw, 5.46, 5.6, nc, glowW(nc));
    signOn(mf, mid, Math.min(3, hw - 0.4), 4.2, 5.4, SI(rnd() < 0.7 ? 'CINEMA' : 'THEATER'), 0.05); pools.push(pt(f, mid, 1.6).concat([4, 0]));
    panel(ch, f, mid - hw * 0.5, mid + hw * 0.5, 0.4, 3.3, SHOPGLOW, dim(SHOPGLOW, 0.42));
    for (const s of [-1, 1]) { const c = pick(NEON), a = mid + s * (hw * 0.5 + 1.6); if (Math.abs(a - mid) + 1 < (f[4] - f[3]) / 2) panel(ch, f, a - 0.9, a + 0.9, 0.9, 3.3, c, dim(c, 0.3)); }
    const bl = pick(NEON); panel(ch, f, f[3] + 0.4, f[3] + 1.6, 6, h + 3, bl, glowW(bl), 0.4);
    for (const g of faces.slice(1)) if (rnd() < 0.5) shopfront(ch, g, POOL.night, 3.2, 0.3);
    void d; solid(r);
  };
  // columned hall (museum, gallery, library, bank): steps, a colonnade lit from behind, a pediment
  const hall = (ch, r, f, name, big) => {
    const R2 = r.slice(), pd = big ? 4.2 : 3; cut(R2, f, pd + (big ? 3.6 : 2.4));
    const ff = faceOf(R2, f), H = big ? 15 : 9.5 + rnd() * 2.5, base = big ? 1.8 : 1.1, a0 = ff[3], a1 = ff[4], mid = (a0 + a1) / 2, pw = Math.min((a1 - a0) / 2 - (big ? 6 : 0.6), big ? 17 : 9);
    const st = { col: C_STONE, tint: TINTS.warm, lit: 0.55, uo: 0.1, vo: 0, su: 0.6, sv: 0.42 };
    bp(ch, R2, 0.16, base, C_STONE); bx(ch, [R2[0] + 0.5, R2[1] + 0.5, R2[2] - 0.5, R2[3] - 0.5], base, H, st, C_ROOF);
    const steps = big ? 4 : 3; for (let k = 0; k < steps; k++) bp(ch, fr(ff, mid - pw - 0.8, mid + pw + 0.8, 0, pd + (steps - k) * 0.8), 0.16 + (base - 0.16) * k / steps, 0.16 + (base - 0.16) * (k + 1) / steps, C_STONE);
    const pr = fr(ff, mid - pw, mid + pw, 0, pd), nc = Math.max(4, Math.round(pw * 2 / 3.4));
    for (let k = 0; k < nc; k++) { const p = pt(ff, mid - pw + 0.7 + (pw * 2 - 1.4) * k / (nc - 1), pd - 0.75); prism(ch, p[0], p[1], big ? 0.62 : 0.45, 8, base, H - 1.7, C_WHITE, dim(C_WHITE, 0.02)); }
    bp(ch, pr, H - 1.7, H, C_STONE);
    const rr = [Math.min(R2[0], pr[0]), Math.min(R2[1], pr[1]), Math.max(R2[2], pr[2]), Math.max(R2[3], pr[3])];
    gable(ch, f[0] === 'z' ? [pr[0], rr[1], pr[2], rr[3]] : [rr[0], pr[1], rr[2], pr[3]], H, big ? 4.2 : 2.6, lin('#5a5850'), f[0] === 'x', C_STONE, dim(C_STONE, 0.06));
    panel(ch, ff, mid - pw + 0.4, mid + pw - 0.4, base + 0.2, H - 1.9, SHOPGLOW, dim(SHOPGLOW, 0.3)); // light behind the columns
    panel(ch, ff, mid - 1.4, mid + 1.4, base, base + 4.2, C_WOOD, dim(SHOPGLOW, 0.5), 0.1);
    for (const s of [-1, 1]) { const c = pick(NEON), a = mid + s * pw * 0.55; panel(ch, ff, a - 0.9, a + 0.9, base + 2.2, H - 2.4, c, dim(c, 0.35), 0.12); }
    signOn([ff[0], ff[1] + ff[2] * pd, ff[2], 0, 0], mid, big ? 6.5 : 3.2, H - 1.55, H - 0.15, SI(name), 0.05);
    for (const s of [-1, 1]) { const p = pt(ff, mid + s * (pw + 2), pd + 1.2); globe(ch, p[0], p[1], 3.6); }
    solid(R2); rect(pr[0], pr[1], pr[2], pr[3]);
  };
  // warehouse with a pitched or saw-tooth roof and loading doors
  const ware = (ch, r, faces, d) => {
    const st = mkStyle(d, 0.07, TINTS.white), h = 8 + rnd() * 4.5, alongX = r[2] - r[0] >= r[3] - r[1]; st.su = 0.6;
    bx(ch, r, 0.16, h, st, C_ROOF);
    if (rnd() < 0.5) gable(ch, r, h, 2 + rnd() * 1.5, lin('#3a3d44'), alongX, st.col, dim(st.col, 0.4));
    else { // saw-tooth: sloped panels with north-light glazing left on
      const n = Math.max(2, Math.round((alongX ? r[2] - r[0] : r[3] - r[1]) / 9)), gl = dim(TINTS.cool, 0.35), rc = lin('#3a3d44');
      for (let k = 0; k < n; k++) {
        const a = (alongX ? r[0] : r[1]) + (alongX ? r[2] - r[0] : r[3] - r[1]) * k / n, b2 = (alongX ? r[0] : r[1]) + (alongX ? r[2] - r[0] : r[3] - r[1]) * (k + 1) / n;
        if (alongX) { ch.quad([a, h, r[1]], [a, h, r[3]], [b2, h + 2.4, r[3]], [b2, h + 2.4, r[1]], rc, Z4, W0, [-1, 1, 0]); ch.quad([b2, h, r[1]], [b2, h, r[3]], [b2, h + 2.4, r[3]], [b2, h + 2.4, r[1]], TINTS.cool, Z4, gl, [1, 0, 0]); }
        else { ch.quad([r[0], h, a], [r[2], h, a], [r[2], h + 2.4, b2], [r[0], h + 2.4, b2], rc, Z4, W0, [0, 1, -1]); ch.quad([r[0], h, b2], [r[2], h, b2], [r[2], h + 2.4, b2], [r[0], h + 2.4, b2], TINTS.cool, Z4, gl, [0, 0, 1]); }
      }
    }
    for (const f of faces) for (let a = f[3] + 4; a + 4.4 < f[4] - 2; a += 9 + rnd() * 6) { panel(ch, f, a, a + 4.4, 0.2, 4.8, C_UNIT, W0, 0.08); panel(ch, f, a + 1.9, a + 2.5, 5.2, 5.5, C_LAMP, glowW(C_LAMP), 0.2); pools.push(pt(f, a + 2.2, 2.5).concat([5, 0])); }
    solid(r);
  };
  // tank farm
  const tanks = (ch, r) => {
    bp(ch, r, 0.16, 0.2, C_LOT);
    const w = r[2] - r[0], l = r[3] - r[1], rr = Math.min(7.5, Math.min(w, l) / 2 - 1.5, Math.max(w, l) / 4 - 1), nx = Math.max(1, Math.floor(w / (rr * 2 + 3))), nz = Math.max(1, Math.floor(l / (rr * 2 + 3)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = r[0] + w * (i + 0.5) / nx, z = r[1] + l * (j + 0.5) / nz, h = 7 + rnd() * 8, c = rnd() < 0.6 ? C_WHITE : lin(pick(['#8a8a80', '#6a7a88', '#8a5a40']));
      prism(ch, x, z, rr, 14, 0.2, h, c, dim(c, 0.03), c, rr); prism(ch, x, z, rr, 14, h, h + 1.1, c, W0, c, 0.4); prism(ch, x, z, rr + 0.05, 14, h - 1.2, h - 0.8, pick(CONT));
      ch.box(x - 0.2, z - 0.2, x + 0.2, z + 0.2, h + 1.1, h + 1.6, RED0, glowW(RED0), RED0); circ(x, z, rr + 0.1); mm.push({ k: 'bld', x0: x - rr, z0: z - rr, x1: x + rr, z1: z + rr });
    }
  };
  // small square: fountain, benches, lamp globes, trees
  const plaza = (ch, r) => {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, w = Math.min(r[2] - r[0], r[3] - r[1]);
    bp(ch, r, 0.16, 0.22, lin('#34343c')); fountain(ch, cx, cz, Math.min(4.5, w / 2 - 3));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = cx + sx * (r[2] - r[0]) * 0.38, z = cz + sz * (r[3] - r[1]) * 0.38; if (rnd() < 0.6) tree(x, z); else globe(ch, x, z); }
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const x = cx + dx * (w / 2 - 1.2), z = cz + dz * (w / 2 - 1.2), bw = dz ? 1.1 : 0.3, bl = dz ? 0.3 : 1.1; ch.box(x - bw, z - bl, x + bw, z + bl, 0.22, 0.62, C_WOOD, W0, C_WOOD); rect(x - bw, z - bl, x + bw, z + bl); }
  };
  // park: lawn, crossing paths, trees, lamp globes, sometimes a pond or a bandstand
  const pavilion = (ch, x, z, r) => { const c = pick(AWN); prism(ch, x, z, r, 8, 0.16, 0.6, C_STONE, W0, C_STONE, r); for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, px = x + (r - 0.4) * Math.cos(a), pz = z + (r - 0.4) * Math.sin(a); ch.box(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, 0.6, 3.6, C_WHITE, W0, C_WHITE, 0, 0, false); } prism(ch, x, z, r + 0.6, 8, 3.6, 5.6, c, dim(c, 0.12), c, 0.2); prism(ch, x, z, r + 0.62, 8, 3.45, 3.62, C_LAMP, glowW(C_LAMP), C_LAMP, r + 0.62); pools.push([x, z, 4, 0]); circ(x, z, r); };
  const park = (ch, r, big) => {
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, pw = big ? 3 : 2, feats = [];
    const path = (x0, z0, x1, z1) => ch.quad([x0, 0.2, z0], [x1, 0.2, z0], [x1, 0.2, z1], [x0, 0.2, z1], C_PATH, Z4, W0, [0, 1, 0]);
    path(r[0], cz - pw, r[2], cz + pw); path(cx - pw, r[1], cx + pw, r[3]);
    const v = rnd();
    if (big || v < 0.35) { fountain(ch, cx, cz, big ? 6 : 3.4); path(cx - (big ? 12 : 7), cz - (big ? 12 : 7), cx + (big ? 12 : 7), cz + (big ? 12 : 7)); feats.push([cx, cz, big ? 14 : 8]); }
    if (big || (v > 0.3 && v < 0.6)) { const px = cx + (r[2] - r[0]) * 0.25, pz = cz + (r[3] - r[1]) * 0.26, pr = Math.min(r[2] - r[0], r[3] - r[1]) * (big ? 0.15 : 0.17); prism(ch, px, pz, pr, 18, 0.1, 0.19, C_STONE, W0, C_WATER, pr, dim(lin('#2a78c0'), 0.3)); circ(px, pz, pr - 0.6); feats.push([px, pz, pr + 2]); }
    if (big || v > 0.7) { const px = cx - (r[2] - r[0]) * 0.25, pz = cz + (r[3] - r[1]) * 0.26; pavilion(ch, px, pz, big ? 5 : 3.2); feats.push([px, pz, 8]); }
    for (let a = r[0] + 9; a < r[2] - 6; a += 18) for (const z of [cz - pw - 1, cz + pw + 1]) if (Math.abs(a - cx) > (big ? 15 : 9) && !(big && big(a, z))) globe(ch, a, z);
    for (let a = r[1] + 9; a < r[3] - 6; a += 18) for (const x of [cx - pw - 1, cx + pw + 1]) if (Math.abs(a - cz) > (big ? 15 : 9) && !(big && big(x, a))) globe(ch, x, a);
    for (let x = r[0] + 5; x < r[2] - 3; x += 11) for (let z = r[1] + 5; z < r[3] - 3; z += 11) {
      const tx = x + (rnd() - 0.5) * 6, tz = z + (rnd() - 0.5) * 6;
      if (rnd() < 0.3 || Math.abs(tx - cx) < pw + 2.5 || Math.abs(tz - cz) < pw + 2.5 || feats.some(([fx, fz, fr2]) => Math.hypot(tx - fx, tz - fz) < fr2) || (big && big(tx, tz))) continue;
      if (rnd() < 0.2) palm(tx, tz); else tree(tx, tz);
    }
  };
  const pickKind = (d) => {
    const u = rnd();
    if (d === 'downtown') return u < 0.5 ? 'tower' : u < 0.6 ? 'hotel' : u < 0.7 ? 'eat' : u < 0.77 ? 'cafe' : u < 0.83 ? 'garage' : u < 0.88 ? 'cinema' : u < 0.92 ? 'hall' : u < 0.96 ? 'plaza' : 'apart';
    if (d === 'west') return u < 0.32 ? 'shops' : u < 0.47 ? 'eat' : u < 0.6 ? 'cafe' : u < 0.77 ? 'apart' : u < 0.82 ? 'gas' : u < 0.87 ? 'cinema' : u < 0.91 ? 'hall' : u < 0.95 ? 'plaza' : 'tower';
    if (d === 'north') return u < 0.54 ? 'houses' : u < 0.71 ? 'apart' : u < 0.8 ? 'cafe' : u < 0.86 ? 'eat' : u < 0.92 ? 'shops' : u < 0.96 ? 'gas' : 'hall';
    if (d === 'shore') return u < 0.19 ? 'hotel' : u < 0.42 ? 'eat' : u < 0.6 ? 'cafe' : u < 0.77 ? 'houses' : u < 0.88 ? 'apart' : u < 0.95 ? 'shops' : 'plaza';
    return u < 0.46 ? 'ware' : u < 0.62 ? 'tanks' : u < 0.74 ? 'tower' : u < 0.83 ? 'eat' : u < 0.91 ? 'gas' : 'garage';
  };
  const count = {};
  const buildLot = (ch, r, faces, d) => {
    const w = Math.min(r[2] - r[0], r[3] - r[1]), l = Math.max(r[2] - r[0], r[3] - r[1]), fd = depthOf(r, faces[0]), fl = faces[0][4] - faces[0][3];
    let k = pickKind(d);
    if (k === 'gas' && (fl < 20 || fd < 17)) k = d === 'harbor' ? 'ware' : 'shops';
    if (k === 'hall' && (fl < 15 || fd < 14 || fl > 40)) k = 'apart';
    if (k === 'cinema' && (fl < 14 || fd < 10)) k = 'shops';
    if ((k === 'eat' || k === 'cafe') && (w < 8.5 || l > 42)) k = d === 'downtown' ? 'tower' : 'shops';
    if (k === 'hotel' && w < 12) k = 'apart';
    if (k === 'tanks' && w < 16) k = 'ware';
    if (k === 'garage' && w < 14) k = 'tower';
    if (k === 'plaza' && (w < 14 || l > 40)) k = 'tower';
    if (k === 'houses' && fd < 10) k = 'shops';
    count[k] = (count[k] || 0) + 1;
    if (k === 'tower') tower(ch, r, faces, d, d === 'downtown' ? 26 + Math.pow(rnd(), 1.6) * 120 : d === 'harbor' ? 9 + rnd() * 9 : d === 'shore' ? 8 + rnd() * 12 : 10 + rnd() * 24);
    else if (k === 'eat') eatery(ch, r, faces, d, false); else if (k === 'cafe') eatery(ch, r, faces, d, true);
    else if (k === 'shops') shops(ch, r, faces, d); else if (k === 'houses') houses(ch, r, faces, d); else if (k === 'apart') apart(ch, r, faces, d);
    else if (k === 'hotel') hotel(ch, r, faces, d); else if (k === 'gas') gas(ch, r, faces); else if (k === 'garage') garage(ch, r, faces);
    else if (k === 'cinema') cinema(ch, r, faces, d); else if (k === 'hall') hall(ch, r, faces[0], pick(POOL.hall), false);
    else if (k === 'ware') ware(ch, r, faces, d); else if (k === 'tanks') tanks(ch, r); else plaza(ch, r);
  };

  // the grid's cells; where a street segment was left out (GAPS) the cells on either side run together
  const aveX = [-400, 0, 400], aveZ = [-400, 0, 300];
  const halfX = (x) => (aveX.includes(x) ? 8 : 5.5), halfZ = (z) => (z === 640 ? 10 : aveZ.includes(z) ? 8 : 5.5);
  const gapAt = (axis, v, lo, hi) => (GAPS[axis][v] || []).some(([a, b]) => a <= lo && b >= hi);
  const inSpecial = (x, z) => SPECIALS.find((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
  for (let i = 0; i < XL.length - 1; i++) for (let j = 0; j < ZB.length - 1; j++) {
    const X0 = XL[i], X1 = XL[i + 1], Z0 = ZB[j], Z1 = ZB[j + 1];
    if (inSpecial((X0 + X1) / 2, (Z0 + Z1) / 2)) continue;
    const open = { w: gapAt('x', X0, Z0, Z1), e: gapAt('x', X1, Z0, Z1), n: gapAt('z', Z0, X0, X1), s: gapAt('z', Z1, X0, X1) };
    const b = { x0: X0 + (open.w ? 0 : halfX(X0)), x1: X1 - (open.e ? 0 : halfX(X1)), z0: Z0 + (open.n ? 0 : halfZ(Z0)), z1: Z1 - (open.s ? 0 : halfZ(Z1)), open };
    b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
    const d = districtOf(b.cx, b.cz), isPark = d !== 'downtown' && d !== 'harbor' && rnd() < 0.09;
    const ch = chunkOf(b.cx, b.cz).city;
    ch.box(b.x0, b.z0, b.x1, b.z1, 0, 0.16, C_SLAB, W0, isPark ? C_GRASS : SLAB_TOP[d], 0, 0, true);
    mm.push({ k: isPark ? 'park' : 'block', x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 });
    const ix0 = b.x0 + (open.w ? 2.5 : 5), iz0 = b.z0 + (open.n ? 2.5 : 5), ix1 = b.x1 - (open.e ? 2.5 : 5), iz1 = b.z1 - (open.s ? 2.5 : 5);
    if (isPark) { park(ch, [ix0, iz0, ix1, iz1], null); continue; }
    const target = { downtown: 34, west: 21, north: 24, shore: 20, harbor: 52 }[d] * (0.85 + rnd() * 0.45);
    const nx = Math.max(1, Math.round((ix1 - ix0) / target)), nz = Math.max(1, Math.round((iz1 - iz0) / target));
    const lw = (ix1 - ix0) / nx, lz = (iz1 - iz0) / nz;
    const yard = d === 'harbor' && rnd() < 0.4;
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      const faces = [];
      const lx0 = ix0 + a * lw, lz0 = iz0 + c * lz, m = d === 'downtown' ? 1 + rnd() * 3 : 1.2 + rnd() * 2.2;
      const r = [lx0 + m, lz0 + m, lx0 + lw - m * (0.6 + rnd()), lz0 + lz - m * (0.6 + rnd())];
      if (c === 0 && !open.n) faces.push(['z', r[1], -1, r[0], r[2]]); if (c === nz - 1 && !open.s) faces.push(['z', r[3], 1, r[0], r[2]]);
      if (a === 0 && !open.w) faces.push(['x', r[0], -1, r[1], r[3]]); if (a === nx - 1 && !open.e) faces.push(['x', r[2], 1, r[1], r[3]]);
      // buildings only on lots that face a street; the hidden middle of big blocks is a yard with parked cars
      if (!faces.length) { if (r[2] - r[0] > 12 && r[3] - r[1] > 12 && rnd() < 0.5) carPark(ch, r, 0.3); continue; }
      if (r[2] - r[0] < 6 || r[3] - r[1] < 6) continue;
      if (nearSky(r[0], r[1], r[2], r[3], 16)) { carPark(ch, r, 0.35); continue; }
      if (yard) { // stacked shipping containers in rows with aisles
        for (let x = r[0]; x + 12.2 <= r[2]; x += 13.4) for (let z = r[1]; z + 2.44 <= r[3]; z += 2.6) {
          if (Math.floor((z - r[1]) / 2.6) % 4 === 3) continue;
          const hgt = 1 + Math.floor(rnd() * 4);
          for (let h = 0; h < hgt; h++) ch.box(x, z, x + 12.2, z + 2.44, h * 2.6, h * 2.6 + 2.58, pick(CONT), W0, pick(CONT));
          rect(x, z, x + 12.2, z + 2.44);
        }
        continue;
      }
      faces.sort(() => rnd() - 0.5);
      buildLot(ch, r, faces, d);
    }
  }

  // --- landmarks that take a whole superblock ---
  for (const s of SPECIALS) {
    const x0 = s.x0 + halfX(s.x0), x1 = s.x1 - halfX(s.x1), z0 = s.z0 + halfZ(s.z0), z1 = s.z1 - halfZ(s.z1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ch = chunkOf(cx, cz).city;
    if (s.k === 'park') { // Central Park with the Neon Bay Museum on its north side
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, C_GRASS, 0, 0, true); mm.push({ k: 'park', x0, z0, x1, z1 });
      const mr = [cx - 34, z0 + 9, cx + 34, z0 + 9 + 36];
      bp(ch, [mr[0] - 4, mr[1] - 3, mr[2] + 4, mr[3] + 14], 0.16, 0.22, lin('#34343c'));
      hall(ch, mr, ['z', mr[3], 1, mr[0], mr[2]], 'MUSEUM', true);
      park(ch, [x0 + 5, z0 + 5, x1 - 5, z1 - 5], (x, z) => x > mr[0] - 8 && x < mr[2] + 8 && z < mr[3] + 16);
    } else if (s.k === 'fair') { // the Boardwalk funfair: big wheel, carousel, food stalls, a car park
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, lin('#3b352e'), 0, 0, true); mm.push({ k: 'block', x0, z0, x1, z1 });
      const wx = cx + 28, wz = cz - 8, R = 22, HY = 26, pink = NEON[0], cyan = NEON[1], N = 28;
      bp(ch, [wx - 9, wz - 3.2, wx + 9, wz + 3.2], 0.16, 1.1, C_UNIT, W0, C_UNIT2); solid([wx - 9, wz - 3.2, wx + 9, wz + 3.2]);
      for (const dz of [-1.5, 1.5]) {
        const z = wz + dz;
        for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, b2 = (k + 1) / N * Math.PI * 2, P = (ang, rr) => [wx + Math.cos(ang) * rr, HY + Math.sin(ang) * rr, z]; ch.quad(P(a, R - 0.35), P(b2, R - 0.35), P(b2, R + 0.35), P(a, R + 0.35), pink, Z4, glowW(pink), null); ch.quad(P(a, R * 0.55 - 0.15), P(b2, R * 0.55 - 0.15), P(b2, R * 0.55 + 0.15), P(a, R * 0.55 + 0.15), cyan, Z4, glowW(cyan), null); }
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); ch.quad([wx - sn * 0.12, HY + c * 0.12, z], [wx + sn * 0.12, HY - c * 0.12, z], [wx + c * R + sn * 0.12, HY + sn * R - c * 0.12, z], [wx + c * R - sn * 0.12, HY + sn * R + c * 0.12, z], cyan, Z4, dim(cyan, 0.45), null); }
        for (const sx of [-1, 1]) ch.quad([wx + sx * 8.6 - 0.45, 1.1, z + dz * 0.8], [wx + sx * 8.6 + 0.45, 1.1, z + dz * 0.8], [wx + 0.45, HY, z + dz * 0.5], [wx - 0.45, HY, z + dz * 0.5], C_WHITE, Z4, dim(C_WHITE, 0.05), null);
      }
      bp(ch, [wx - 0.9, wz - 2.2, wx + 0.9, wz + 2.2], HY - 0.9, HY + 0.9, C_WHITE, dim(pink, 0.4), C_WHITE);
      for (let k = 0; k < 14; k++) { const a = (k + 0.5) / 14 * Math.PI * 2, x = wx + Math.cos(a) * R, y = HY + Math.sin(a) * R, c = pick(AWN); ch.box(x - 1.1, wz - 1.1, x + 1.1, wz + 1.1, y - 2.7, y - 0.5, c, dim(c, 0.3), c); }
      // carousel
      { const x = cx - 26, z = cz - 14, c = pick(AWN); prism(ch, x, z, 6, 12, 0.16, 0.7, C_STONE, W0, C_WOOD, 6); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, px = x + 5.2 * Math.cos(a), pz = z + 5.2 * Math.sin(a); ch.box(px - 0.08, pz - 0.08, px + 0.08, pz + 0.08, 0.7, 4, C_LAMP, dim(C_LAMP, 0.4), C_LAMP, 0, 0, false); ch.box(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35, 1.2, 2.1, pick(AWN), W0, C_WHITE); } prism(ch, x, z, 6.8, 12, 4, 7, c, dim(c, 0.2), c, 0.3); prism(ch, x, z, 6.82, 12, 3.75, 4.02, C_LAMP, glowW(C_LAMP), C_LAMP, 6.82); prism(ch, x, z, 1, 8, 0.7, 4, C_WHITE, dim(pink, 0.3)); pools.push([x, z, 4, 0]); circ(x, z, 6.2); mm.push({ k: 'bld', x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6 }); }
      // a street of food stalls facing each other
      const names = ['ICE CREAM', 'DONUTS', 'KEBAB', 'SAMSA', 'COFFEE', 'PLOV HOUSE', 'BURGERS', 'TACOS', 'TEA HOUSE', 'BBQ'];
      for (let k = 0; k < 10; k++) { const sx = x0 + 14 + (k >> 1) * 13, sg = k % 2 ? 1 : -1, zc = cz + 30 + sg * 7.5, r = [sx - 2.6, zc - 1.8, sx + 2.6, zc + 1.8], f = ['z', sg > 0 ? r[1] : r[3], -sg, r[0], r[2]], c = pick(EAT_COL), aw = pick(AWN); bp(ch, r, 0.16, 3.1, c, dim(c, 0.03), C_ROOF); panel(ch, f, r[0] + 0.3, r[2] - 0.3, 1.1, 2.5, SHOPGLOW, dim(SHOPGLOW, 0.45)); awning(ch, f, r[0], r[2], 3.1, 1.5, aw); signOn(f, sx, 2.3, 3.2, 4.3, SI(names[k])); solid(r); if (k % 2 === 0 && k < 8) table(ch, sx + 6.5, cz + 30, aw); }
      bulbs(ch, x0 + 10, cz + 30, x0 + 76, cz + 30, 5.2); for (const x of [x0 + 10, x0 + 76]) { ch.box(x - 0.08, cz + 29.92, x + 0.08, cz + 30.08, 0.16, 5.2, C_POLE, W0, C_POLE, 0, 0, false); circ(x, cz + 30, 0.25); }
      bp(ch, [x0 + 96, cz + 12, x1 - 8, z1 - 8], 0.16, 0.2, C_LOT); carPark(ch, [x0 + 96, cz + 12, x1 - 8, z1 - 8], 0.45);
      for (let x = x0 + 8; x < x1 - 4; x += 16) for (const z of [z0 + 5, z1 - 5]) if (Math.abs(x - wx) > 12 || z > cz) palm(x, z);
      for (const [x, z] of [[cx - 5, cz - 12], [cx - 5, cz + 12], [x0 + 12, cz - 30], [cx + 50, cz + 4]]) globe(ch, x, z, 4);
    } else { // Northgate Mall and its car park
      ch.box(x0, z0, x1, z1, 0, 0.16, C_SLAB, W0, C_LOT, 0, 0, true); mm.push({ k: 'block', x0, z0, x1, z1 });
      const r = [x0 + 8, z0 + 7, x1 - 8, z0 + 7 + 46], f = ['z', r[3], 1, r[0], r[2]], st = mkStyle('downtown', 0.05, TINTS.white), mid = (r[0] + r[2]) / 2, H = 12.5;
      st.col = lin('#3a3f52'); bx(ch, r, 0.16, H, st, C_ROOF); roofRim(ch, r, H, NEON[6]); roofUnits(ch, r, H, 6);
      panel(ch, f, r[0] + 6, r[2] - 6, 0.5, 8.2, lin('#dfeaff'), dim(lin('#dfeaff'), 0.24));
      const cr = fr(f, mid - 12, mid + 12, 0, 5); bp(ch, cr, 5.2, 5.9, C_WHITE, W0, C_WHITE); ch.quad([cr[0], 5.18, cr[1]], [cr[2], 5.18, cr[1]], [cr[2], 5.18, cr[3]], [cr[0], 5.18, cr[3]], C_WHITE, Z4, dim(SHOPGLOW, 0.32), [0, -1, 0]);
      for (const a of [mid - 11.4, mid - 4, mid + 4, mid + 11.4]) { const p = pt(f, a, 4.6); ch.box(p[0] - 0.22, p[1] - 0.22, p[0] + 0.22, p[1] + 0.22, 0.16, 5.2, C_WHITE, W0, C_WHITE, 0, 0, false); circ(p[0], p[1], 0.35); }
      signOn([f[0], f[1] + 5, f[2], 0, 0], mid, 7, 6.1, 9.1, SI('MALL'), 0.05);
      ['SUPERMARKET', 'CINEMA', 'FASHION', 'ELECTRONICS', 'BOOKS', 'GYM', 'PHARMACY', 'BOWLING'].forEach((n, k) => { const a = r[0] + 14 + k * ((r[2] - r[0] - 28) / 7); if (Math.abs(a - mid) > 15) signOn(f, a, 3.4, 8.6, 10.4, SI(n)); });
      for (const g of [['x', r[0], -1, r[1], r[3]], ['x', r[2], 1, r[1], r[3]], ['z', r[1], -1, r[0], r[2]]]) { const c = pick(NEON); panel(ch, g, g[3] + 3, g[4] - 3, 9.6, 10.1, c, glowW(c)); }
      solid(r);
      const lot = [x0 + 8, r[3] + 12, x1 - 8, z1 - 6]; carPark(ch, lot, 0.5);
      for (let x = lot[0] + 20; x < lot[2] - 10; x += 44) for (let z = lot[1] + 5.6; z < lot[3] - 4; z += 23) lamp(x, z, 1, 0, 9, 2.4);
      for (let x = x0 + 6; x < x1 - 4; x += 15) tree(x, z1 - 3);
    }
  }
  world.kinds = count;

  mark();
  // --- harbor pier with gantry cranes, beach palms ---
  const C_PIER = lin('#2a2a30'), C_CRANE = lin('#8a3a1c'), RED = lin('#ff2030');
  chunkOf(630, 715).city.box(460, 650, 800, 780, -0.4, 0.16, C_PIER, W0, C_PIER);
  mm.push({ k: 'block', x0: 460, z0: 650, x1: 800, z1: 780 });
  for (const cx of [520, 630, 740]) {
    const ch = chunkOf(cx, 760).city;
    for (const [lx, lz] of [[-8, 740], [8, 740], [-8, 770], [8, 770]]) { ch.box(cx + lx - 0.6, lz - 0.6, cx + lx + 0.6, lz + 0.6, 0, 34, C_CRANE, W0, C_CRANE); circ(cx + lx, lz, 0.9); }
    ch.box(cx - 9, 738, cx + 9, 772, 34, 37, C_CRANE, W0, C_CRANE);
    ch.box(cx - 1.5, 700, cx + 1.5, 830, 36, 38, C_CRANE, W0, C_CRANE);
    ch.box(cx - 0.5, 829, cx + 0.5, 830, 38, 39, RED, glowW(RED), RED);
    ch.box(cx - 0.5, 700, cx + 0.5, 701, 38, 39, RED, glowW(RED), RED);
  }
  for (let x = 470; x < 790; x += 19) for (let z = 712; z < 735; z += 2.7) if (rnd() < 0.35) { const h = 1 + Math.floor(rnd() * 3); for (let k = 0; k < h; k++) chunkOf(x, z).city.box(x, z, x + 12.2, z + 2.44, 0.16 + k * 2.6, 0.16 + k * 2.6 + 2.58, pick(CONT), W0, pick(CONT)); rect(x, z, x + 12.2, z + 2.44); }
  for (let x = -880; x < 900; x += 22 + rnd() * 10) if (x < 450 || x > 810) palm(x + rnd() * 6, 662 + rnd() * 28);

  // --- billboards facing the ring highway, trees in the green belt and beyond ---
  const ring = roads.find((r) => r.ring);
  for (let s = 60; s < ring.len; s += 170) {
    const p = rPoint(ring, s); if (p.z > 600 || inTunnel(p.x, p.z, 20)) continue;
    const nx = p.tz, nz = -p.tx; // outward
    const bx = p.x + nx * 18, bz = p.z + nz * 18, ang = Math.atan2(p.tz, p.tx), nc = pick(NEON);
    const ch = chunkOf(bx, bz).city;
    for (const o of [-5, 5]) { ch.box(bx + p.tx * o - 0.25, bz + p.tz * o - 0.25, bx + p.tx * o + 0.25, bz + p.tz * o + 0.25, 0, 8, C_POLE, W0, C_POLE, 0, 0, false); circ(bx + p.tx * o, bz + p.tz * o, 0.4); }
    ch.obox(bx, bz, ang, 7.5, 0.3, 8, 13, C_POLE, W0);
    signs.push({ x: bx - nx * 0.35, z: bz - nz * 0.35, tx: p.tx, tz: p.tz, half: 7.2, y0: 8.2, y1: 12.8, panel: pick([0, 1, 3, 4, 5, 6, 7]) });
    void nc;
  }
  for (let i = 0; i < 520; i++) {
    const x = (rnd() - 0.5) * 1960, z = -980 + rnd() * 1620;
    const inGrid = x > -806 && x < 806 && z > -806 && z < 650;
    if (inGrid || nearRoad(x, z, 6) || inTunnel(x, z, 2) || (Math.abs(z + 900) < 40 && Math.abs(x) < 640)) continue;
    tree(x, z);
  }

  // --- pillars under the viaduct and the bridge; bridge towers with lit stay cables ---
  const C_PIL = lin('#26262e'), C_TOWER = lin('#3a3c48'), C_CABLE = lin('#cfe6ff');
  for (const r of roads) if (r.hAt) for (let s = 16; s < r.len - 8; s += 32) {
    const h = r.hAt(s); if (h < 3) continue;
    const p = rPoint(r, s), twin = !!r.isBridge;
    for (const lat of twin ? [-5, 5] : [0]) {
      const x = p.x - p.tz * lat, z = p.z + p.tx * lat, pr = twin ? 1.3 : 1.7;
      if (!twin && nearRoad(x, z, 1.5, r)) continue; // never plant a pillar in a street below
      chunkOf(x, z).city.box(x - pr, z - pr, x + pr, z + pr, -1, h - 1.2, C_PIL, W0, C_PIL, 0, 0, false);
      if (z < 705) circ(x, z, pr + 0.2);
    }
  }
  // suspension bridge: two towers, lit main cables sagging between them, vertical hangers
  const TOPY = (tz) => bridgeH(tz) + 40, CX = 9.3;
  for (const tz of [800, 955]) for (const sx of [-1, 1]) {
    const x = -200 + sx * CX, ch = chunkOf(x, tz).city, top = TOPY(tz);
    ch.box(x - 1.1, tz - 1.6, x + 1.1, tz + 1.6, -1, top, C_TOWER, W0, C_TOWER);
    ch.box(x - 0.4, tz - 0.4, x + 0.4, tz + 0.4, top, top + 0.8, RED, glowW(RED), RED);
    if (sx < 0) for (const yy of [top - 1, bridgeH(tz) + 19]) ch.box(-200 - CX - 1.1, tz - 1.1, -200 + CX + 1.1, tz + 1.1, yy - 2.2, yy, C_TOWER, W0, C_TOWER);
  }
  const SUP = [[690, bridgeH(690) + 1.5], [800, TOPY(800)], [955, TOPY(955)], [1070, bridgeH(1070) + 1.5]];
  const cableY = (z) => {
    for (let i = 1; i < SUP.length; i++) if (z <= SUP[i][0]) {
      const [za, ya] = SUP[i - 1], [zb, yb] = SUP[i], u = (z - za) / (zb - za), sag = i === 2 ? 30 : 7;
      return ya + (yb - ya) * u - sag * 4 * u * (1 - u);
    }
    return SUP[SUP.length - 1][1];
  };
  const CW = [C_CABLE[0] * 0.55, C_CABLE[1] * 0.55, C_CABLE[2] * 0.55, 1], CHG = [C_CABLE[0] * 0.25, C_CABLE[1] * 0.25, C_CABLE[2] * 0.25, 1];
  for (const sx of [-1, 1]) {
    const x = -200 + sx * CX;
    for (let z = 690; z < 1070; z += 5) { const y0 = cableY(z), y1 = cableY(z + 5), ch = chunkOf(x, z + 2.5).city; ch.quad([x, y0 - 0.16, z], [x, y1 - 0.16, z + 5], [x, y1 + 0.16, z + 5], [x, y0 + 0.16, z], C_CABLE, Z4, CW, [sx, 0, 0]); }
    for (let z = 700; z < 1066; z += 10) { if (Math.abs(z - 800) < 3 || Math.abs(z - 955) < 3) continue; const ch = chunkOf(x, z).city, yb = bridgeH(z) + 0.6, yt = cableY(z); if (yt - yb < 1) continue; ch.quad([x, yb, z - 0.06], [x, yb, z + 0.06], [x, yt, z + 0.06], [x, yt, z - 0.06], C_CABLE, Z4, CHG, [sx, 0, 0]); }
  }
  // marina east of the pier: wooden docks with moored boats; a few boats off the pier and the beach
  {
    const C_DOCK = lin('#4a3a2e'), BH = lin('#e8e8ee'), BS = [lin('#1f4a7a'), lin('#7a1f2b'), lin('#2a6a5a'), lin('#d8d0c0')], hull = new THREE.Shape([[-4, -1.3], [2.4, -1.3], [4.4, 0], [2.4, 1.3], [-4, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)));
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.1, bevelEnabled: false }); hg.rotateX(-Math.PI / 2);
    const cg = new THREE.BoxGeometry(2.6, 1, 1.8); cg.translate(-0.8, 1.6, 0);
    const mg = new THREE.BoxGeometry(0.12, 7, 0.12); mg.translate(0.4, 4.6, 0);
    const boat = (x, z, ry, sail) => { const c = pick(BS); place(hg, x, z, ry, 1, c, -0.55); place(cg, x, z, ry, 1, BH, -0.55); if (sail) place(mg, x, z, ry, 1, BH, -0.55); };
    for (const dx of [830, 872, 914]) {
      const ch = chunkOf(dx, 740).city; ch.box(dx - 1.4, 705, dx + 1.4, 790, -0.6, 0.3, C_DOCK, W0, C_DOCK);
      for (let z = 716; z < 785; z += 13) for (const s of [-1, 1]) if (rnd() < 0.75) boat(dx + s * 4.4, z + rnd() * 3, Math.PI / 2 + (rnd() - 0.5) * 0.1, rnd() < 0.4);
    }
    for (let x = 480; x < 790; x += 48) boat(x + rnd() * 10, 800 + rnd() * 8, rnd() * 0.3, false);
    for (let i = 0; i < 6; i++) boat(-760 + i * 90 + rnd() * 30, 740 + rnd() * 50, rnd() * Math.PI * 2, true);
  }
  mm.push({ k: 'deck', x0: -208, z0: 650, x1: -192, z1: 1092 });

  // --- tunnel: the ring's west side runs under a long grassy berm ---
  {
    const T = TUNNEL, C_TW = lin('#2c2b30'), C_BERM = lin('#0f1a12'), SOD = lin('#ffb060'), C_PORT = lin('#3a3a44');
    for (let z = T.z0; z < T.z1; z += 20) {
      const z1 = Math.min(T.z1, z + 20), c = chunkOf(T.x, z + 10).city;
      for (const sg of [-1, 1]) {
        const xi = T.x + sg * T.half;
        c.quad([xi, 0, z], [xi, 0, z1], [xi, T.roof, z1], [xi, T.roof, z], C_TW, Z4, W0, [-sg, 0, 0]);
        c.quad([xi, T.roof + 1, z], [xi, T.roof + 1, z1], [T.x + sg * 42, 0, z1], [T.x + sg * 42, 0, z], C_BERM, Z4, W0, [sg, 1, 0]);
        const xl = xi - sg * 0.05;
        c.quad([xl, T.roof - 0.6, z], [xl, T.roof - 0.6, z1], [xl, T.roof - 0.35, z1], [xl, T.roof - 0.35, z], SOD, Z4, [SOD[0], SOD[1], SOD[2], 1], [-sg, 0, 0]);
      }
      c.quad([T.x - T.half, T.roof, z], [T.x + T.half, T.roof, z], [T.x + T.half, T.roof, z1], [T.x - T.half, T.roof, z1], C_TW, Z4, W0, [0, -1, 0]);
      c.quad([T.x - T.half, T.roof + 1, z], [T.x + T.half, T.roof + 1, z], [T.x + T.half, T.roof + 1, z1], [T.x - T.half, T.roof + 1, z1], C_BERM, Z4, W0, [0, 1, 0]);
    }
    for (const [z, sg] of [[T.z0, -1], [T.z1, 1]]) {
      const c = chunkOf(T.x, z).city;
      c.quad([T.x - T.half - 1, T.roof, z], [T.x + T.half + 1, T.roof, z], [T.x + T.half + 1, T.roof + 1.4, z], [T.x - T.half - 1, T.roof + 1.4, z], C_PORT, Z4, W0, [0, 0, sg]);
      for (const sx of [-1, 1]) c.quad([T.x + sx * T.half, 0, z], [T.x + sx * T.half, T.roof + 1, z], [T.x + sx * 42, 0, z], [T.x + sx * 42, 0, z], C_BERM, Z4, W0, [0, 0, sg]);
    }
    for (let z = T.z0 + 8; z < T.z1; z += 16) pools.push([T.x - 4, z, 6, 0], [T.x + 4, z + 8, 6, 0]);
    rect(T.x - 44, T.z0, T.x - T.half - 0.4, T.z1); rect(T.x + T.half + 0.4, T.z0, T.x + 44, T.z1);
    for (let i = 0; i < 18; i++) { const dx = 14 + rnd() * 24, sg = rnd() < 0.5 ? -1 : 1; tree(T.x + sg * dx, T.z0 + 10 + rnd() * (T.z1 - T.z0 - 20), 8 * (42 - dx) / (42 - T.half)); }
    mm.push({ k: 'tunnel', x0: T.x - 12, z0: T.z0, x1: T.x + 12, z1: T.z1 });
  }

  // --- the island: loop road, drift arena with floodlights, palms and a lighthouse ---
  const ISLE = { x0: -470, z0: 1075, x1: 70, z1: 1300 }, ARENA = [-380, 1132, -20, 1228];
  {
    const c = chunkOf(-200, 1180), A = ARENA;
    c.road.quad([A[0], 0.05, A[1]], [A[2], 0.05, A[1]], [A[2], 0.05, A[3]], [A[0], 0.05, A[3]], W0, [[0, rowV(3, 0.05)], [22, rowV(3, 0.05)], [22, rowV(3, 0.95)], [0, rowV(3, 0.95)]], W0, [0, 1, 0]);
    const CONE = lin('#ff7a1a');
    for (let x = A[0] + 6; x < A[2]; x += 12) for (const z of [A[1] + 3, A[3] - 3]) chunkOf(x, z).city.box(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, 0.7, CONE, [CONE[0], CONE[1], CONE[2], 1], CONE);
    for (const [x, z] of [[A[0], A[1]], [A[2], A[1]], [A[0], A[3]], [A[2], A[3]]]) {
      const ch = chunkOf(x, z).city; ch.box(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, 16, C_POLE, W0, C_POLE, 0, 0, false);
      ch.box(x - 1.4, z - 1.4, x + 1.4, z + 1.4, 16, 16.6, C_LAMP, glowW(C_LAMP), C_LAMP); circ(x, z, 0.4);
      for (let k = 0; k < 3; k++) pools.push([x + (x < -200 ? 9 : -9) * (k + 0.6), z + (z < 1180 ? 6 : -6) * (k + 0.6), 16, 0]);
    }
    const LH = [45, 1282], chL = chunkOf(LH[0], LH[1]).city, LW = lin('#c8c8cc'), LR = lin('#a01c24'), LL = lin('#ffe9b0');
    for (let k = 0; k < 6; k++) { const r0 = 3.2 - k * 0.3, y0 = k * 4.5; chL.box(LH[0] - r0, LH[1] - r0, LH[0] + r0, LH[1] + r0, y0, y0 + 4.5, k % 2 ? LR : LW, W0, k % 2 ? LR : LW); }
    chL.box(LH[0] - 1.6, LH[1] - 1.6, LH[0] + 1.6, LH[1] + 1.6, 27, 29.5, LL, glowW(LL), lin('#2a2a30'));
    rect(LH[0] - 3.4, LH[1] - 3.4, LH[0] + 3.4, LH[1] + 3.4);
    for (let i = 0; i < 90; i++) {
      const x = ISLE.x0 + 8 + rnd() * (ISLE.x1 - ISLE.x0 - 16), z = ISLE.z0 + 8 + rnd() * (ISLE.z1 - ISLE.z0 - 16);
      if ((x > A[0] - 4 && x < A[2] + 4 && z > A[1] - 4 && z < A[3] + 4) || nearRoad(x, z, 3) || Math.hypot(x - LH[0], z - LH[1]) < 8) continue;
      palm(x, z);
    }
    mm.push({ k: 'isle', x0: ISLE.x0, z0: ISLE.z0, x1: ISLE.x1, z1: ISLE.z1 }, { k: 'arena', x0: A[0], z0: A[1], x1: A[2], z1: A[3] });
  }

  // --- the Raven RS garage sign on Westside's x = -100 street ---
  {
    const gx = -91, gz = 250, ch = chunkOf(gx, gz).city;
    ch.box(gx - 0.25, gz - 0.25, gx + 0.25, gz + 0.25, 0, 7, C_POLE, W0, C_POLE, 0, 0, false); circ(gx, gz, 0.4);
    signs.push({ x: gx, z: gz, tx: 0, tz: 1, half: 4, y0: 7, y1: 11, panel: 2 });
  }

  // --- collision: buildings are in; add the sea (with the pier and the island cut out) and the edge of the world ---
  rect(-1030, 705, -470, 1330); rect(-470, 705, 70, 1075); rect(-470, 1300, 70, 1330); rect(70, 705, 460, 1330); rect(460, 785, 800, 1330); rect(800, 705, 1030, 1330);
  rect(-1030, -1030, -985, 1330); rect(985, -1030, 1030, 1330); rect(-1030, -1030, 1030, -985);

  mark();
  // --- meshes ---
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const cityMat = cityMaterial(windowData());
  const roadMat = new THREE.MeshStandardMaterial({ map: roadAtlas(), roughness: 0.78, metalness: 0.0, envMapIntensity: 0.8 });
  roadMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = diffuseColor.rgb * 0.8 + 0.13;'); }; // the atlas is painted very dark; lift it so the street reads against the kerbs
  const cmeshes = [];
  for (const c of chunks.values()) {
    const g = new THREE.Group(); g.userData.cx = c.x; g.userData.cz = c.z;
    const baseMesh = c.city.v ? c.city.mesh(cityMat) : null; if (baseMesh) g.add(baseMesh);
    g.userData.tiers = c.city.tiers.map((t) => { if (!t.v) return null; const f = t.mesh(cityMat); g.add(f); return f; });
    c.meshes = [baseMesh, ...g.userData.tiers]; // same order as the ranges recorded by knockable()
    if (c.road.v) g.add(c.road.mesh(roadMat, false));
    group.add(g); cmeshes.push(g);
  }
  mark();
  // pools of lamp light on the road: one additive mesh for the whole map
  const pb = new GeoBuf();
  for (const [x, z, , y0 = 0] of pools) { const h = 5.5, y = y0 + 0.08; pb.quad([x - h, y, z - h], [x + h, y, z - h], [x + h, y, z + h], [x - h, y, z + h], W0, [[0, 0], [1, 0], [1, 1], [0, 1]], W0, [0, 1, 0]); }
  const poolMesh = pb.mesh(new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,190,120,0.12)', 'rgba(255,170,90,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), false);
  poolMesh.renderOrder = 2; group.add(poolMesh);
  // land, beach, sea
  const land = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2700), new THREE.MeshStandardMaterial({ color: '#101117', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }));
  land.rotation.x = -Math.PI / 2; land.position.set(0, 0, 705 - 1350); group.add(land);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2000, 55), new THREE.MeshStandardMaterial({ color: '#4a3b36', roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.02, 677.5); group.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1800), new THREE.MeshStandardMaterial({ color: '#081428', roughness: 0.06, metalness: 0.65, envMapIntensity: 1.05 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.35, 705 + 900); group.add(sea);
  const isleG = new THREE.Mesh(new THREE.PlaneGeometry(ISLE.x1 - ISLE.x0, ISLE.z1 - ISLE.z0), new THREE.MeshStandardMaterial({ color: '#111a13', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }));
  isleG.rotation.x = -Math.PI / 2; isleG.position.set((ISLE.x0 + ISLE.x1) / 2, 0, (ISLE.z0 + ISLE.z1) / 2); group.add(isleG);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(ISLE.x1 - ISLE.x0 + 30, ISLE.z1 - ISLE.z0 + 30), beach.material);
  sand.rotation.x = -Math.PI / 2; sand.position.set((ISLE.x0 + ISLE.x1) / 2, -0.1, (ISLE.z0 + ISLE.z1) / 2); group.add(sand);
  // text billboards: one atlas, three meshes by how the sign is lit (neon tubes, backlit boxes, painted boards)
  const sbufs = { neon: new GeoBuf(), box: new GeoBuf(), paint: new GeoBuf() };
  for (const g of signs) {
    const sbuf = sbufs[g.shop !== undefined ? SIGN_KIND[g.shop] : BILLBOARDS[g.panel][2]];
    let u0, u1, v0, v1;
    if (g.shop !== undefined) { const c = g.shop % 4, r = g.shop >> 2; u0 = c * 0.25 + 0.002; u1 = u0 + 0.246; v0 = (1024 + r * 64 + 1) / 2048; v1 = v0 + 62 / 2048; }
    else { const c = g.panel % 2, r = g.panel >> 1; u0 = c * 0.5 + 0.004; u1 = u0 + 0.492; v0 = (r * 256 + 2) / 2048; v1 = v0 + 252 / 2048; }
    const a = [g.x - g.tx * g.half, g.y0, g.z - g.tz * g.half], b = [g.x + g.tx * g.half, g.y0, g.z + g.tz * g.half];
    sbuf.quad(a, b, [b[0], g.y1, b[2]], [a[0], g.y1, a[2]], W0, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], W0, null);
  }
  const sAt = signAtlas();
  const sMat = {
    neon: new THREE.MeshBasicMaterial({ map: sAt, color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }),
    box: new THREE.MeshBasicMaterial({ map: sAt, color: new THREE.Color(1.05, 1.05, 1.05), side: THREE.DoubleSide }),
    paint: new THREE.MeshStandardMaterial({ map: sAt, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
  };
  for (const k of Object.keys(sbufs)) if (sbufs[k].v) group.add(sbufs[k].mesh(sMat[k], false));
  // traffic-light heads change colour, so they are one instanced mesh
  const sigMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), Math.max(1, sigHeads.length));
  sigHeads.forEach((h, i) => { tm4.makeTranslation(h.x, 5.05, h.z); sigMesh.setMatrixAt(i, tm4); sigMesh.setColorAt(i, new THREE.Color(1, 0, 0)); });
  sigMesh.instanceMatrix.needsUpdate = true; sigMesh.computeBoundingSphere(); group.add(sigMesh);
  // the lighthouse sweeps two beams over the sea
  const beamPivot = new THREE.Group(); beamPivot.position.set(45, 28.2, 1282); group.add(beamPivot);
  const bg = new THREE.ConeGeometry(10, 150, 18, 1, true); bg.translate(0, -75, 0); bg.rotateZ(Math.PI / 2);
  const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a0').multiplyScalar(0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const r of [0, Math.PI]) { const m = new THREE.Mesh(bg, bm); m.rotation.y = r; beamPivot.add(m); }
  // sky, moon and hills ride with the camera
  const far = new THREE.Group(); group.add(far);
  const skyT = skyTexture([[0, '#16234f'], [0.22, '#2f4686'], [0.36, '#6f6aa6'], [0.44, '#c98a92'], [0.485, '#ffb37a'], [0.5, '#ffd09a'], [0.507, '#8a7078'], [1, '#4a4048']]);
  const SUN = new THREE.Vector3(-0.78, 0.2, 0.42).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 32, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2; far.add(sky);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(3), fog: false, depthWrite: false }));
  moon.position.copy(SUN).multiplyScalar(770); moon.lookAt(0, 0, 0); moon.renderOrder = -1; far.add(moon);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,176,110,0.75)', 'rgba(255,140,90,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.copy(SUN).multiplyScalar(765); halo.lookAt(0, 0, 0); halo.renderOrder = -1; far.add(halo);
  {
    // a ring of low-poly mountains (low over the sea to the south), dotted with hillside lights
    const pos = [], R0 = 735, N = 200, ridge = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, south = Math.max(0, Math.sin(a)), k = 1 - Math.min(1, south * 1.25);
      ridge.push(k * (55 + 75 * Math.abs(Math.sin(a * 3.1 + 1.3)) + 45 * Math.abs(Math.sin(a * 7.7 + 0.4)) + 18 * rnd()));
    }
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, rt = R0 - 60;
      const b0 = [Math.cos(a0) * R0, -20, Math.sin(a0) * R0], b1 = [Math.cos(a1) * R0, -20, Math.sin(a1) * R0];
      const t0 = [Math.cos(a0) * rt, ridge[i], Math.sin(a0) * rt], t1 = [Math.cos(a1) * rt, ridge[i + 1], Math.sin(a1) * rt];
      pos.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1);
    }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.computeVertexNormals();
    const mtn = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: '#5a5a80', emissive: '#2a2438', roughness: 1, flatShading: true, fog: false, side: THREE.DoubleSide }));
    mtn.renderOrder = -1; mtn.frustumCulled = false; far.add(mtn);
    const lp = [];
    for (let n = 0; n < 900; n++) {
      const i = Math.floor(rnd() * N), f = rnd(), a = (i + f) / N * Math.PI * 2, top = ridge[i] + (ridge[i + 1] - ridge[i]) * f; if (top < 30) continue;
      const v = 0.05 + rnd() * 0.55, r = R0 - 60 * v - 3;
      lp.push(Math.cos(a) * r, -20 + (top + 20) * v, Math.sin(a) * r);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color('#ffc98a').multiplyScalar(1.6), size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
    lights.frustumCulled = false; lights.renderOrder = 0; far.add(lights);
    // stars
    const sp = [];
    for (let n = 0; n < 1600; n++) { const a = rnd() * Math.PI * 2, e = 0.12 + Math.pow(rnd(), 0.7) * 1.4, r = 790; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.12, depthWrite: false }));
    stars.frustumCulled = false; stars.renderOrder = -1; far.add(stars);
    // low-poly clouds catching the moonlight
    const cl = [];
    for (let k = 0; k < 11; k++) {
      const a = rnd() * Math.PI * 2, r = 420 + rnd() * 260, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 170 + rnd() * 110;
      for (let j = 0, n = 3 + Math.floor(rnd() * 4); j < n; j++) { const b = new THREE.IcosahedronGeometry(1, 0); b.scale(16 + rnd() * 22, 7 + rnd() * 7, 12 + rnd() * 16); b.translate(cx + (j - n / 2) * 18 + rnd() * 8, cy + rnd() * 6, cz + rnd() * 14); cl.push(b.toNonIndexed()); }
    }
    const clouds = new THREE.Mesh(mergeGeometries(cl), new THREE.MeshStandardMaterial({ color: '#e0a090', emissive: '#6a3c48', roughness: 1, flatShading: true, fog: false }));
    clouds.frustumCulled = false; far.add(clouds);
  }
  // night light: a bluish sky fill bright enough to show the facade colours, a cool moon
  group.add(new THREE.HemisphereLight('#a8bcf0', '#7c685c', 1.5));
  const moonL = new THREE.DirectionalLight('#ffb27c', 3.2); moonL.position.copy(SUN).multiplyScalar(600); group.add(moonL);
  // reflections: dark sky with warm street lamps and neon around the horizon
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide })));
  { const sb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(9) })); sb.position.copy(SUN).multiplyScalar(8.6); es.add(sb); for (let i = 0; i < 26; i++) rnd(); }
  const env = pmrem.fromScene(es, 0.03).texture;
  mark();

  Object.assign(world, { built: true, roads, nodes, edges, group, far, env, cmeshes, hash, HC, mm, props, fog: new THREE.Fog('#c79c96', 70, 620), bg: new THREE.Color('#c79c96'), roadMat, cityMat, sigHeads, sigMesh, beamPivot, ARENA });
  drawWorldMap(); mark();
  world.timings = TT.slice(1).map((t, i) => Math.round(t - TT[i]));
}

/* ---- minimap image, drawn once ---- */
function drawWorldMap() {
  const N = 1024, s = N / 2000, H = Math.round(2340 * s), c = mkCanvas(N, H), g = c.getContext('2d');
  const P = (x, z) => [(x + 1000) * s, (z + 1000) * s];
  g.fillStyle = '#0d0f17'; g.fillRect(0, 0, N, H);
  g.fillStyle = '#0c2440'; g.fillRect(0, (705 + 1000) * s, N, H);
  g.fillStyle = '#3a2f2c'; g.fillRect(0, (650 + 1000) * s, N, 55 * s);
  for (const it of world.mm) if (it.k !== 'road' && it.k !== 'deck') {
    g.fillStyle = ({ park: '#123020', bld: '#262a3a', isle: '#16261a', arena: '#2a2a33', tunnel: '#1b3322' })[it.k] || '#171a24';
    const [x0, z0] = P(it.x0, it.z0); g.fillRect(x0, z0, (it.x1 - it.x0) * s, (it.z1 - it.z0) * s);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const roadsMM = world.mm.filter((it) => it.k === 'road');
  for (const pass of [0, 1]) for (const it of roadsMM) {
    if (!!it.sky !== !!pass) continue;
    const path = () => { g.beginPath(); it.pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); };
    if (it.sky) { g.strokeStyle = '#05060a'; g.lineWidth = it.w * s * 1.9; path(); g.stroke(); }
    g.strokeStyle = it.sky ? '#d46ad8' : it.type === 'highway' ? '#8e86c9' : it.type === 'avenue' ? '#7d8196' : '#5b5f72';
    g.lineWidth = it.w * s * 1.1; path(); g.stroke();
  }
  world.map = c; world.mapS = s; world.mapH = H;
}

/* ---- traffic cars: three extruded body styles, instanced ---- */
const ROAM_TRAFFIC = 36;
const TRAFFIC_TYPES = [
  { W: 1.8, wr: 0.33, wx: 1.38, low: [[-2.25, 0.3], [2.2, 0.3], [2.25, 0.55], [2.15, 0.78], [1.0, 0.9], [-2.0, 0.86], [-2.25, 0.72]], cab: [[-1.25, 0.86], [1.0, 0.9], [0.45, 1.36], [-0.75, 1.33]], roof: [-0.72, 0.43, 1.33], lx: [2.2, -2.22], ly: 0.66 },
  { W: 1.76, wr: 0.32, wx: 1.25, low: [[-1.98, 0.3], [1.95, 0.3], [2.0, 0.55], [1.9, 0.76], [0.95, 0.9], [-2.0, 0.84]], cab: [[-1.97, 0.84], [0.95, 0.9], [0.3, 1.42], [-1.86, 1.38]], roof: [-1.8, 0.28, 1.38], lx: [1.97, -1.98], ly: 0.66 },
  { W: 1.95, wr: 0.36, wx: 1.55, low: [[-2.4, 0.34], [2.35, 0.34], [2.4, 0.6], [2.35, 0.92], [1.5, 1.05], [-2.42, 1.0]], cab: [[-2.4, 1.0], [1.5, 1.05], [0.9, 1.82], [-2.3, 1.8]], roof: [-2.24, 0.88, 1.78], lx: [2.38, -2.4], ly: 0.78 }
];
let roamTrafficRig = null;
function ensureRoamTraffic() {
  if (roamTrafficRig) return roamTrafficRig;
  const ext = (pts, depth) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -depth / 2); return g; };
  const mats = {
    body: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.45, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.2, metalness: 0.5, envMapIntensity: 1.3 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(2.6) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b3a').multiplyScalar(2.2) })
  };
  const hlg = new THREE.PlaneGeometry(9, 4.6); hlg.rotateX(-Math.PI / 2); hlg.translate(7.4, 0.1, 0);
  const headGlow = new THREE.InstancedMesh(hlg, new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,236,200,0.5)', 'rgba(255,220,170,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), ROAM_TRAFFIC);
  headGlow.frustumCulled = false; headGlow.count = 0; headGlow.renderOrder = 2;
  roamTrafficRig = TRAFFIC_TYPES.map((T) => {
    const body = [ext(T.low, T.W - 0.1)], dark = [ext(T.cab, T.W - 0.24)], head = [], tail = [];
    const rf = new THREE.BoxGeometry(T.roof[1] - T.roof[0], 0.07, T.W - 0.32); rf.translate((T.roof[0] + T.roof[1]) / 2, T.roof[2] + 0.03, 0); body.push(rf);
    for (const x of [T.wx, -T.wx]) for (const z of [T.W / 2 - 0.12, -(T.W / 2 - 0.12)]) { const cy = new THREE.CylinderGeometry(T.wr, T.wr, 0.24, 12); cy.rotateX(Math.PI / 2); cy.translate(x, T.wr, z); dark.push(cy); }
    for (const z of [T.W / 2 - 0.32, -(T.W / 2 - 0.32)]) { const h = new THREE.BoxGeometry(0.06, 0.12, 0.34); h.translate(T.lx[0], T.ly, z); head.push(h); const t = new THREE.BoxGeometry(0.06, 0.13, 0.38); t.translate(T.lx[1], T.ly + 0.08, z); tail.push(t); }
    const mk = (list, mat) => { const im = new THREE.InstancedMesh(mergeGeometries(plainAttrs(list)), mat, ROAM_TRAFFIC); im.frustumCulled = false; im.count = 0; return im; };
    const out = { body: mk(body, mats.body), dark: mk(dark, mats.dark), head: mk(head, mats.head), tail: mk(tail, mats.tail) };
    for (let i = 0; i < ROAM_TRAFFIC; i++) out.body.setColorAt(i, new THREE.Color('#888888'));
    return out;
  });
  roamTrafficRig.glow = headGlow;
  return roamTrafficRig;
}
const teul = new THREE.Euler();

/* ---- other players: a lite, single-mesh-per-material car with an underglow ---- */
function makeLiteRig(look, color) {
  const c = clean({ ...DEFAULTS, ...look, lightsOn: true });
  if (GLB_CARS[c.model]) {
    const cc = glbCar(c.model);
    if (cc) { const rig = makeGlbRig(cc); rig.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); return rig; }
    loadGlbCar(c.model);
  }
  const { car, wheels } = buildCar(c);
  wheels.forEach((w) => car.add(w));
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  car.traverse((o) => { if (o.isMesh && (o.material === CM.paint || o.material === CM.plain)) o.material = paint; });
  const rig = new THREE.Group(); rig.add(mergeByMaterial(car)); rig.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3), new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color(color).multiplyScalar(0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  gl.rotation.x = -Math.PI / 2; gl.position.y = 0.07; gl.renderOrder = 3; rig.add(gl);
  return rig;
}

/* ---- multiplayer ----
   Everything about other drivers goes through `net`. Bots publish snapshots as if they came over the network, and
   real drivers arrive the same way through a transport: an object with enter(info), exit(), send(state), chat(text)
   that calls net.join / net.state / net.leave / net.chatIn. Your own car is always simulated locally and never waits
   for the network; other cars are drawn 150 ms in the past, interpolated between snapshots (see roamFrame).
   Built in: a same-browser transport (two tabs see each other). The Firebase transport lives in src/net/. */
const net = {
  players: new Map(),            // id -> { id, name, color, look, buf: [{ t, x, z, h, v }], rig, tag, msg, msgT, remote }
  transport: null, sendT: 0, last: null, inRoom: false,
  ingest(id, snap) { const p = this.players.get(id); if (!p) return; p.buf.push(snap); if (p.buf.length > 24) p.buf.shift(); },
  myInfo() { const look = { ...cfg }; delete look.custom; return { name: myName, color: cfg.color, look }; },
  setTransport(t) { if (this.transport && this.inRoom) this.transport.exit(); for (const p of [...this.players.values()]) if (p.remote) this.leave(p.id); this.transport = t; if (t && this.inRoom) t.enter(this.myInfo()); },
  enter() { if (this.inRoom) return; this.inRoom = true; this.last = null; if (this.transport) this.transport.enter(this.myInfo()); },
  exit() { this.inRoom = false; if (this.transport) this.transport.exit(); for (const p of [...this.players.values()]) if (p.remote) this.leave(p.id); },
  // about 10 snapshots a second while moving, one a second while parked
  publishState(st) {
    if (!this.transport || !this.inRoom) return;
    const now = performance.now(), L = this.last, moved = !L || Math.hypot(st.x - L.x, st.z - L.z) > 0.05 || Math.abs(st.h - L.h) > 0.01;
    if (now - this.sendT < (moved ? 100 : 1000)) return;
    this.sendT = now; this.last = { x: st.x, z: st.z, h: st.h };
    this.transport.send([+st.x.toFixed(2), +st.z.toFixed(2), +(st.y || 0).toFixed(2), +st.h.toFixed(3), +st.v.toFixed(1)]);
  },
  sendChat(text) { showChat('me', text); if (this.transport && this.inRoom) this.transport.chat(String(text).slice(0, 120)); botsHear(text); },
  join(id, info) {
    if (!info || this.players.has(id)) return;
    const p = { id, name: String(info.name || 'Driver').slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(info.color) ? info.color : '#e7e8ee', look: clean({ ...DEFAULTS, ...(info.look || {}), custom: false }), buf: [], rig: null, tag: null, msg: '', msgT: 0, remote: true };
    this.players.set(id, p);
    if (roam.active && world.built) { p.rig = makeLiteRig(p.look, p.color); p.rig.visible = false; world.group.add(p.rig); tagFor(id); say(p.name + ' joined the city.'); }
  },
  leave(id) { const p = this.players.get(id); if (!p || !p.remote) return; if (p.rig && p.rig.parent) p.rig.parent.remove(p.rig); if (p.el) p.el.remove(); this.players.delete(id); },
  state(id, a) { if (!Array.isArray(a) || a.length < 5 || !a.every(Number.isFinite)) return; this.ingest(id, { t: performance.now() / 1000, x: a[0], z: a[1], y: a[2], h: a[3], v: a[4] }); },
  chatIn(id, text) {
    if (typeof text === 'string' && text.startsWith(MP_TAG)) { mpIn(id, text.slice(MP_TAG.length)); return; }
    if (this.players.has(id) && roam.active) showChat(id, String(text).slice(0, 120));
  }
};
// same-browser transport: other tabs of this page on this computer (also the fallback when no server is configured)
function localTransport() {
  if (typeof BroadcastChannel === 'undefined') return null;
  const id = 'p' + Math.random().toString(36).slice(2, 10), ch = new BroadcastChannel('raven-rs-city'), seen = new Map();
  let info = null, timer = 0;
  ch.onmessage = (e) => {
    const m = e.data; if (!m || m.id === id || !info) return;
    if (m.k === 'who') { ch.postMessage({ k: 'hi', id, info }); return; }
    if (m.k === 'bye') { seen.delete(m.id); net.leave(m.id); return; }
    seen.set(m.id, performance.now());
    if (m.k === 'hi') net.join(m.id, m.info); else if (m.k === 'st') { if (!net.players.has(m.id)) ch.postMessage({ k: 'who', id }); else net.state(m.id, m.s); } else if (m.k === 'chat') net.chatIn(m.id, m.t);
  };
  window.addEventListener('pagehide', () => { if (info) ch.postMessage({ k: 'bye', id }); });
  return {
    id,
    enter(i) { info = i; ch.postMessage({ k: 'hi', id, info }); ch.postMessage({ k: 'who', id }); clearInterval(timer); timer = setInterval(() => { const now = performance.now(); for (const [k, t] of seen) if (now - t > 6000) { seen.delete(k); net.leave(k); } }, 2000); },
    exit() { if (info) ch.postMessage({ k: 'bye', id }); info = null; clearInterval(timer); seen.clear(); },
    send(s) { if (info) ch.postMessage({ k: 'st', id, s }); },
    chat(t) { if (info) ch.postMessage({ k: 'chat', id, t }); }
  };
}

/* ---- vehicles that drive the lane graph: traffic and bots ---- */
const veh = [];
const roadSpeed = (type, bot) => (bot ? { street: 17, avenue: 25, highway: 34 } : { street: 11, avenue: 14, highway: 22 })[type];
function pickNext(c, node) {
  if (c.route) { const i = c.ri + 1; if (i < c.route.length) return { ...c.route[i], ri: i }; if (c.loop) return { ...c.route[0], ri: 0 }; }
  const from = c.e, opts = node.edges.filter((e) => e !== from);
  if (!opts.length) return { e: from, dir: -c.dir };
  const tin = lanePose(from, c.dir, 0, c.dir > 0 ? from.hi : from.lo);
  let tot = 0;
  const ws = opts.map((e) => {
    const dir = e.a === node ? 1 : -1, t = lanePose(e, dir, 0, dir > 0 ? e.lo : e.hi), dot = t.tx * tin.tx + t.tz * tin.tz;
    let w = dot > 0.9 ? 3 : 1; if (c.bot && e.type !== 'street') w *= 2.5; tot += w; return { e, dir, w };
  });
  let r = Math.random() * tot; for (const o of ws) { r -= o.w; if (r <= 0) return o; }
  return ws[0];
}
function placeOnEdge(c, e, dir, s, lane, ri) {
  Object.assign(c, { e, dir, s, lane: Math.min(lane, LANES_DIR[e.type] - 1), mode: 'edge' });
  if (ri !== undefined) c.ri = ri; else if (c.route && !c.route.some((st) => st.e === e)) c.route = null;
  c.off = laneOff(e.type, c.lane); c.nx = pickNext(c, dir > 0 ? e.b : e.a); c.vBase = roadSpeed(e.type, c.bot) * c.mult * (c.racing ? c.raceMult : 1);
  poseVeh(c);
}
function poseVeh(c) {
  if (c.mode === 'edge') {
    const p = lanePose(c.e, c.dir, c.off, c.s), hA = c.e.road.hAt; c.x = p.x; c.z = p.z; c.tx = p.tx; c.tz = p.tz;
    c.y = hA ? hA(c.s) : 0; c.slope = hA ? (hA(c.s + 1) - hA(c.s - 1)) / 2 * c.dir : 0; return;
  }
  c.y = 0; c.slope = 0;
  const b = c.bz, u = clamp(b.u, 0, 1), k = 1 - u;
  c.x = k * k * b.p0[0] + 2 * k * u * b.p1[0] + u * u * b.p2[0]; c.z = k * k * b.p0[1] + 2 * k * u * b.p1[1] + u * u * b.p2[1];
  let dx = 2 * k * (b.p1[0] - b.p0[0]) + 2 * u * (b.p2[0] - b.p1[0]), dz = 2 * k * (b.p1[1] - b.p0[1]) + 2 * u * (b.p2[1] - b.p1[1]);
  const l = Math.hypot(dx, dz) || 1; c.tx = dx / l; c.tz = dz / l;
}
function beginTurn(c) {
  const nx = c.nx, lane = Math.min(c.lane, LANES_DIR[nx.e.type] - 1), s2 = nx.dir > 0 ? nx.e.lo : nx.e.hi;
  const P2 = lanePose(nx.e, nx.dir, laneOff(nx.e.type, lane), s2);
  const p0 = [c.x, c.z], p2 = [P2.x, P2.z];
  // control point: where the two lane lines meet (straight on: halfway)
  const den = c.tx * P2.tz - c.tz * P2.tx;
  let p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
  if (Math.abs(den) > 0.2) { const qx = p2[0] - p0[0], qz = p2[1] - p0[1], a = (qx * P2.tz - qz * P2.tx) / den; if (a > 0 && a < 60) p1 = [p0[0] + c.tx * a, p0[1] + c.tz * a]; }
  let len = 0, px = p0[0], pz = p0[1];
  for (let i = 1; i <= 8; i++) { const u = i / 8, k = 1 - u, x = k * k * p0[0] + 2 * k * u * p1[0] + u * u * p2[0], z = k * k * p0[1] + 2 * k * u * p1[1] + u * u * p2[1]; len += Math.hypot(x - px, z - pz); px = x; pz = z; }
  c.mode = 'turn'; c.bz = { p0, p1, p2, len: Math.max(1, len), u: 0, sharp: Math.abs(den) > 0.5, next: nx, lane };
}
function spawnVeh(c, cx, cz, rmin, rmax) {
  const E = world.edges;
  for (let tries = 0; tries < 60; tries++) {
    const e = E[Math.floor(Math.random() * E.length)]; if (e.hi - e.lo < 20) continue;
    const s = e.lo + 4 + Math.random() * (e.hi - e.lo - 8), p = rPoint(e.road, s), d = Math.hypot(p.x - cx, p.z - cz);
    if (d < rmin || d > rmax) continue;
    if (veh.some((o) => o !== c && Math.hypot(o.x - p.x, o.z - p.z) < 14)) continue;
    placeOnEdge(c, e, Math.random() < 0.5 ? 1 : -1, s, Math.floor(Math.random() * 2)); c.v = c.vBase * 0.8; c.hitT = 0; c.stuckT = 0;
    return true;
  }
  return false;
}
function stepVeh(c, dt) {
  if (!c.e) return;
  if (c.hitT > 0) { c.hitT -= dt; c.v = Math.max(0, c.v - 20 * dt); poseVeh(c); return; }
  // look ahead for anything in our lane: other cars and the player
  let gap = 99;
  const rx = -c.tz, rz = c.tx;
  const test = (x, z, y) => { const dx = x - c.x, dz = z - c.z, d = dx * c.tx + dz * c.tz; if (d > 0 && d < 34 && Math.abs(dx * rx + dz * rz) < 2.1 && Math.abs((y || 0) - (c.y || 0)) < 3) gap = Math.min(gap, d); };
  for (const o of veh) if (o !== c && Math.abs(o.x - c.x) < 36 && Math.abs(o.z - c.z) < 36) test(o.x, o.z, o.y);
  if (roam.active) test(roam.x, roam.z, roam.y);
  if (gap < 30 && c.bot && c.mode === 'edge' && LANES_DIR[c.e.type] === 2) { // bots overtake on two-lane sides
    const other = 1 - c.lane, dOff = laneOff(c.e.type, other) - c.off;
    const busy = veh.some((o) => { if (o === c) return false; const dx = o.x - c.x, dz = o.z - c.z, d = dx * c.tx + dz * c.tz, l = dx * rx + dz * rz; return d > -10 && d < 40 && Math.abs(l - dOff) < 2.2; });
    if (!busy) { c.lane = other; gap = 99; }
  }
  let want = c.vBase;
  if (c.mode === 'edge') {
    const rem = c.dir > 0 ? c.e.hi - c.s : c.s - c.e.lo, node = c.dir > 0 ? c.e.b : c.e.a;
    if (rem < 30 && c.nx && c.nx.e !== c.e) want = Math.min(want, (c.racing ? 13 : 9) + rem * 0.6);
    // traffic stops for red and amber; bots run the lights like street racers do
    if (!c.bot && node.sig && rem > 5 && rem < 34 && sigState(node, c.e.road.axis) !== 'g') want = Math.min(want, Math.max(0, (rem - 6) * 0.75));
  }
  else if (c.bz.sharp) want = Math.min(want, c.bot ? 12 : 8);
  if (c.ghostT > 0) c.ghostT -= dt; else want = Math.min(want, Math.max(0, (gap - 8) * 1.1));
  c.stuckT = c.v < 0.5 && gap < 12 ? (c.stuckT || 0) + dt : 0;
  if (c.stuckT > 25) { c.stuckT = 0; c.ghostT = 2; } // long enough to sit through a red light
  c.v += clamp(want - c.v, -9 * dt, (c.bot ? 6 : 3) * dt);
  if (c.mode === 'edge') {
    c.s += c.v * dt * c.dir;
    c.off += (laneOff(c.e.type, c.lane) - c.off) * Math.min(1, dt * 2.2);
    if ((c.dir > 0 && c.s >= c.e.hi) || (c.dir < 0 && c.s <= c.e.lo)) { poseVeh(c); beginTurn(c); }
  } else {
    c.bz.u += c.v * dt / c.bz.len;
    if (c.bz.u >= 1) { const n = c.bz.next, l = c.bz.lane; placeOnEdge(c, n.e, n.dir, n.dir > 0 ? n.e.lo : n.e.hi, l, n.ri); return; }
  }
  poseVeh(c);
}

/* ---- bots: the city's other drivers, until real players arrive ---- */
const BOT_LINES = [
  'Anyone up for a run on the ring highway?', 'Harbor is empty tonight. Perfect for drifting.', 'That turbo flutter is music.',
  'Who tuned the purple one? Clean build.', 'Traffic downtown is heavy, take the coast road.', 'Meet at the pier, bring your fastest car.',
  'Just put slicks on. Feels like cheating.', 'Neon looks unreal after the rain.', 'Somebody beat Midnight yet?', 'Lights on, music up, windows down.'
];
const BOT_REPLY = {
  race: ['You’re on. Highway, north side.', 'Race? Bring nitro, I won’t wait.', 'Name the street. I’ll be there.'],
  hi: ['Hey! Nice ride.', 'Yo! Welcome to the city.', 'Salom! Love the build.'],
  any: ['Haha, true.', 'Say that again at 200 km/h.', 'Copy that.', 'See you on the boulevard.', 'Respect.']
};
function makeBots() {
  const picks = [0, 3, 4, 5, 7];
  return picks.map((i, k) => {
    const L = LADDER[i];
    const p = { id: 'bot' + k, name: L.name, color: L.color, look: { ...RIVAL_BASE, ...L.look }, buf: [], rig: null, tag: null, msg: '', msgT: 0 };
    net.players.set(p.id, p);
    const c = { id: p.id, bot: true, mult: 0.9 + Math.random() * 0.25, x: 0, z: 0, y: 0, tx: 1, tz: 0, v: 0, sendT: 0, raceMult: 1 };
    veh.push(c); return c;
  });
}
let botChatT = 18;
function botSay(id, text) { const p = net.players.get(id); if (p) showChat(id, text); }
function botsHear(text) {
  const ids = [...net.players.keys()]; if (!ids.length || Math.random() > 0.7) return;
  const t = text.toLowerCase(), set = /race|poyga|drag|go\b|1v1/.test(t) ? BOT_REPLY.race : /^(hi|hey|hello|salom|yo)\b/.test(t) ? BOT_REPLY.hi : BOT_REPLY.any;
  const id = ids[Math.floor(Math.random() * ids.length)];
  setTimeout(() => { if (roam.active) botSay(id, set[Math.floor(Math.random() * set.length)]); }, 1200 + Math.random() * 2200);
}

/* ---- chat: Enter to type, bubbles over the car that said it ---- */
let myName = 'Driver';
try { myName = (localStorage.getItem('raven-rs-name') || cfg.sticker || 'Driver').slice(0, 16) || 'Driver'; } catch (e) { /* storage unavailable */ }
function tagFor(id) {
  const p = id === 'me' ? roam.meTag : net.players.get(id);
  if (id === 'me') {
    if (!roam.meTag) { roam.meTag = { el: null, msg: '', msgT: 0 }; }
    return ensureTagEl(roam.meTag, myName);
  }
  return ensureTagEl(p, p.name);
}
function ensureTagEl(p, name) {
  if (!p.el) {
    p.el = el('div', 'tag'); const bb = el('span', 'bb'), nm = el('span', 'nm', name);
    p.el.append(bb, nm); $('roTags').append(p.el); p.bb = bb; p.nm = nm;
  }
  return p;
}
function showChat(id, text) {
  text = String(text).replace(/\s+/g, ' ').trim().slice(0, 80); if (!text) return;
  const t = tagFor(id), name = id === 'me' ? myName : net.players.get(id).name;
  t.msg = text; t.msgT = 5 + text.length * 0.06; t.bb.textContent = text; t.el.classList.add('says');
  const line = el('p'); const b = el('b', '', name + ': '); if (id !== 'me') b.style.color = net.players.get(id).color; line.append(b, document.createTextNode(text));
  const log = $('chatLog'); log.append(line); while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => line.classList.add('old'), 14000);
}
// cheat codes typed in chat: handled locally, never sent to other players
const CHEATS = { '/nitro': () => { roam.infNos = !roam.infNos; return 'Infinite nitro ' + (roam.infNos ? 'ON' : 'OFF'); } };
function chatCheat(text) {
  const fn = CHEATS[text.trim().toLowerCase()]; if (!fn) return false;
  const line = el('p'); line.append(el('b', '', 'Mod: '), document.createTextNode(fn()));
  const log = $('chatLog'); log.append(line); while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => line.classList.add('old'), 6000);
  return true;
}
function openChat() { roam.chat = true; const i = $('chatIn'); i.hidden = false; i.value = ''; $('chat').classList.add('open'); i.focus(); for (const k in roam.keys) roam.keys[k] = false; }
function closeChat(send) {
  const i = $('chatIn');
  if (send && i.value.trim() && !chatCheat(i.value)) net.sendChat(i.value);
  roam.chat = false; i.blur(); i.hidden = true; $('chat').classList.remove('open');
}

/* ---- player driving ---- */
const roam = { active: false, y: 0, deck: null, rain: false, gps: null, wp: null, spawn: null, photo: false, mapOpen: false, x: 2.2, z: 200, h: -Math.PI / 2, vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, steer: 0, gear: 1, rpm: 950, shiftT: 0, thr: 0, nos: 1, nosOn: false, drift: false, wheelA: 0, keys: {}, camMode: 0, camH: -Math.PI / 2, shake: 0, chat: false, ph: null, eng: null, smokeT: 0, areaT: 0, meTag: null, saved: null, acc: 0, lat: 0 };
const RKEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'hb', Shift: 'nos', n: 'nos', N: 'nos' };
// Tyre model: sideways force against slip angle. It builds fast, peaks near 9 degrees and then lets go a
// little, which is what makes a slide progressive instead of the car turning as if on rails.
const DRIFT_GRIP = 0.62, SPIN_DAMP = 3.5;
const TYRE = (x) => Math.sin(1.35 * Math.atan(15 * x));
function stepPlayer(dt) {
  const R = roam, p = R.ph, k = R.keys, gas = !!k.up, brk = !!k.down, hb = !!k.hb, D = rigDims();
  const fx = Math.cos(R.h), fz = Math.sin(R.h), rx = -fz, rz = fx;
  let vf = R.vx * fx + R.vz * fz, vl = R.vx * rx + R.vz * rz, yr = R.yr || 0;
  const av = Math.abs(vf), sp = Math.hypot(vf, vl);
  const gm = R.rain ? 0.8 : 1, mu = p.grip / 0.74 * 1.1 * gm, m = p.mass;
  const a = D.xf, b = -D.xr, L = a + b, Iz = m * a * b * 1.15;
  // steering: less lock at speed; the wheels also follow the direction of travel a little,
  // so a slide is caught by easing off the key rather than by perfect opposite lock
  const sIn = (k.right ? 1 : 0) - (k.left ? 1 : 0), sMax = 0.045 + 0.5 / (1 + (av / 11) * (av / 11));
  const beta = sp > 5 && vf > 1 ? Math.atan2(vl, vf) : 0;
  const tgt = clamp(sIn * sMax + clamp(beta, -0.5, 0.5) * (sIn ? 0.5 : 0.85), -0.58, 0.58);
  R.steer += (tgt - R.steer) * Math.min(1, dt * (sIn ? 7 : 9));
  // automatic gearbox: shifts up at the redline under power and early when cruising, kicks down when the
  // throttle opens, and drops gears under braking
  const fwd = gas && vf > -0.5, rev = brk && vf < 0.5 && !gas;
  R.liftT = fwd ? 0 : (R.liftT || 0) + dt;
  let ratio = p.gears[R.gear - 1] * p.final, wheelRpm = av / p.r * ratio * 30 / Math.PI;
  if (R.shiftT > 0) R.shiftT -= dt;
  else if (vf > 1) {
    const low = R.gear > 1 ? wheelRpm * p.gears[R.gear - 2] / p.gears[R.gear - 1] : Infinity;
    if (R.gear < 6 && (wheelRpm > p.redline * 0.93 || (!fwd && !brk && R.liftT > 0.9 && wheelRpm > p.redline * 0.58))) { R.gear++; R.shiftT = p.shiftTime; if (R.thr > 0.6) flutter(true); }
    else if (low < p.redline * (fwd ? 0.7 : brk ? 0.6 : 0.36)) { R.gear--; R.shiftT = p.shiftTime * 0.5; if (audio && !fwd) pop(0.05); }
    ratio = p.gears[R.gear - 1] * p.final; wheelRpm = av / p.r * ratio * 30 / Math.PI;
  } else if (R.gear > 1) R.gear = 1;
  R.thr += ((fwd || rev ? 1 : 0) - R.thr) * Math.min(1, dt * 10);
  // nitro: hold Shift; refills slowly, faster while drifting
  R.nosOn = !!k.nos && R.nos > 0.02 && (cfg.nitro > 0 || R.infNos) && fwd;
  if (R.infNos) R.nos = 1;
  else if (R.nosOn) R.nos = Math.max(0, R.nos - dt * 0.3); else R.nos = Math.min(1, R.nos + dt * (R.drift ? 0.1 : 0.03));
  // drive force at the rear wheels; past the tyres' limit they spin
  let Fd = 0, spin = 0;
  const capD = p.grip * 1.3 * m * G * gm;
  if (fwd && R.shiftT <= 0 && wheelRpm < p.redline * 1.01) { // the limiter holds the car at the redline in top gear
    let T = p.tpk * p.curve(Math.min(1, R.rpm / p.redline)) * R.thr;
    if (R.nosOn) T *= p.nosMult;
    Fd = T * ratio / p.r * 0.88;
    if (Fd > capD) { spin = Math.min(1, Fd / capD - 1); Fd = capD; }
  } else if (!rev && !fwd && av > 0.3 && R.shiftT <= 0) Fd = -(8 + 0.011 * R.rpm) * ratio / p.r * Math.sign(vf); // engine braking
  if (rev && vf > -11) Fd = -m * 4.2;
  R.spin = spin;
  const slipR = R.gear === 1 && vf < 7 ? p.idle + (p.redline * 0.55 - p.idle) * R.thr : 0;
  R.rpm += (Math.max(p.idle, wheelRpm * (1 + 0.2 * spin), slipR) - R.rpm) * Math.min(1, dt * 14);
  if (R.rpm > p.redline) R.rpm = p.redline - Math.random() * 150;
  // weight moves to the rear under power and to the front under brakes
  const dW = m * clamp(R.acc, -12, 9) * 0.42 / L * (R.acc < 0 ? 0.22 : 0.5);
  const Fzf = Math.max(0.2 * m * G, m * G * b / L - dW), Fzr = Math.max(0.2 * m * G, m * G * a / L + dW);
  // a drift is held by staying on the power and steering into the turn; ease off either and the rear grips again
  R.dg = (R.dg || 1) + ((R.drift && fwd && sIn * beta < 0 ? DRIFT_GRIP : 1) - (R.dg || 1)) * Math.min(1, dt * 5);
  // front tyres: slip angle between where the wheel points and where it is going
  const V0 = 3.5, cs = Math.cos(R.steer), sn = Math.sin(R.steer);
  const vyf = vl + a * yr, latF = vyf * cs - vf * sn, lonF = vf * cs + vyf * sn;
  const FyF = -mu * Fzf * TYRE(Math.atan2(latF, Math.max(Math.abs(lonF), V0)));
  // rear tyres: power uses up part of their grip (so a heavy foot swings the tail out);
  // the handbrake locks them, and a locked tyre just drags against the way it is sliding
  const vyr = vl - b * yr, rearSlip = Math.atan2(vyr, Math.max(av, V0));
  let FyR, FxR = 0;
  if (hb) { const vr = Math.max(Math.hypot(vf, vyr), V0), f = 0.72 * mu * Fzr; FyR = -f * vyr / vr; FxR = -f * vf / vr; }
  else { const use = Math.min(1, Math.abs(Fd) / capD); FyR = -mu * 1.07 * Fzr * TYRE(rearSlip) * Math.sqrt(1 - 0.62 * use * use) * (1 - 0.2 * spin) * R.dg; }
  const drag = ROAD_DRAG * p.cda * vf * Math.abs(vf) + (av > 0.2 ? 0.015 * m * G * Math.sign(vf) : 0);
  const ax = (Fd - drag - FyF * sn + FxR) / m - G * (R.slopeF || 0), ay = (FyF * cs + FyR) / m;
  // past about 35 degrees of slide the car resists spinning further, unless the handbrake is on
  yr += ((a * FyF * cs - b * FyR) / Iz - yr * (0.9 + (hb ? 0 : SPIN_DAMP * smooth01((Math.abs(beta) - 0.45) / 0.45)))) * dt;
  vf += ax * dt; vl += ay * dt;
  let B = 0;
  // brakes heat up with hard stops from speed and cool while you drive; hot stock brakes lose bite
  const bk = (p.brakeK || 0.78) * (1 - (p.fade || 0) * smooth01(((R.bt || 0) - 0.55) / 0.45));
  if (brk && vf > 0.5) B = mu * G * 0.95 * bk; if (gas && vf < -0.5) B = mu * G * 0.95 * bk;
  R.bt = clamp((R.bt || 0) + (B && av > 3 ? B * av * dt / 1800 : 0) - dt * (0.025 + av * 0.0006), 0, 1);
  if (R.bt > 0.8 && p.fade > 0.1 && roamT - (R.btPop || -9) > 6) { R.btPop = roamT; showPop('BRAKES FADING · LET THEM COOL', 'bad'); }
  if (B) { const dv = B * dt; vf = Math.abs(vf) <= dv ? 0 : vf - Math.sign(vf) * dv; }
  if (!gas && !brk && Math.hypot(vf, vl) < 0.3 && Math.abs(R.slopeF || 0) < 0.02) { vf = 0; vl = 0; yr = 0; }
  R.vx = fx * vf + rx * vl; R.vz = fz * vf + rz * vl;
  R.h += yr * dt; R.yr = yr;
  R.x += R.vx * dt; R.z += R.vz * dt;
  R.rearSlip = Math.abs(rearSlip); R.slipA = Math.abs(beta);
  R.drift = sp > 6 && (hb || R.rearSlip > 0.2);
  R.acc += (ax - (B ? B * Math.sign(vf || 1) : 0) - R.acc) * Math.min(1, dt * 4); R.lat += (ay - R.lat) * Math.min(1, dt * 4);
  R.vf = vf; R.vl = vl; R.wheelA += (vf / p.r + spin * 14) * dt;
}
// push the car out of buildings, props, the sea and the edge of the world
const rigDims = () => (carRig && carRig.userData.dims) || { front: 2.25, rear: -2.25, xf: 1.4, xr: -1.36, r: 0.33, exY: 0.28, exZ: 0.55 };
// three collision circles along the body, sized to the current car
const bodyCircles = () => { const o = rigDims().front - 0.8; return [-o, 0, o]; };
function collideStatic() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h), HC = world.HC;
  let hit = 0;
  for (let it = 0; it < 2; it++) for (const o of bodyCircles()) {
    const cx = R.x + fx * o, cz = R.z + fz * o, r = 1.0;
    const list = world.hash.get(Math.floor(cx / HC) * 4096 + Math.floor(cz / HC)); if (!list) continue;
    for (const s of list) {
      let nx, nz, pen;
      if (s.prop) {
        if (s.prop.down) continue;
        const sp = Math.hypot(R.vx, R.vz);
        if (sp > 4 && Math.hypot(cx - s.x, cz - s.z) < r + s.r) { knockDown(s.prop, R.vx / sp, R.vz / sp, sp); ambBump(4); R.vx *= 0.88; R.vz *= 0.88; R.shake = Math.min(1, R.shake + 0.25); if (audio) pop(0.18); continue; }
      }
      if (s.t) { const dx = cx - s.x, dz = cz - s.z, d = Math.hypot(dx, dz); if (d >= r + s.r || d < 1e-6) continue; nx = dx / d; nz = dz / d; pen = r + s.r - d; }
      else {
        const px = clamp(cx, s.x0, s.x1), pz = clamp(cz, s.z0, s.z1), dx = cx - px, dz = cz - pz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
        else { const e = [[cx - s.x0, -1, 0], [s.x1 - cx, 1, 0], [cz - s.z0, 0, -1], [s.z1 - cz, 0, 1]].sort((a, b) => a[0] - b[0])[0]; nx = e[1]; nz = e[2]; pen = e[0] + r; }
      }
      R.x += nx * pen; R.z += nz * pen;
      const vn = R.vx * nx + R.vz * nz;
      if (vn < 0) { R.vx -= 1.3 * vn * nx; R.vz -= 1.3 * vn * nz; R.vx *= 0.96; R.vz *= 0.96; hit = Math.max(hit, -vn); }
    }
  }
  if (hit > 3) { R.yr *= 0.5; R.shake = Math.min(1, hit / 18); if (audio) pop(Math.min(0.5, hit / 40)); crashChain(hit); }
}
// Knocked-over props: the prop's vertices in its chunk mesh are collapsed to a point (hidden), and a copy of exactly
// those vertices tips over away from the car, lies on the ground, then sinks. The original comes back later, out of sight.
const fallen = [];
const _fq = new THREE.Quaternion(), _fa = new THREE.Vector3();
function knockDown(p, dx, dz, sp) {
  p.down = true; p.downT = roamT; p.saved = [];
  const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
  for (const [k, v0, v1, i0, i1] of p.ranges) {
    const m = p.ch.meshes[k]; if (!m) continue;
    const src = m.geometry, ng = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(src.attributes)) {
      const n = a.itemSize, arr = a.array.slice(v0 * n, v1 * n);
      if (name === 'position') for (let j = 0; j < arr.length; j += 3) { arr[j] -= p.x; arr[j + 1] -= p.y; arr[j + 2] -= p.z; }
      ng.setAttribute(name, new THREE.BufferAttribute(arr, n, a.normalized));
    }
    const idx = src.index.array, ni = new Uint32Array(i1 - i0);
    for (let j = i0; j < i1; j++) ni[j - i0] = idx[j] - v0;
    ng.setIndex(new THREE.BufferAttribute(ni, 1)); ng.computeBoundingSphere();
    g.add(new THREE.Mesh(ng, m.material));
    const pos = src.attributes.position; p.saved.push([m, v0, pos.array.slice(v0 * 3, v1 * 3)]);
    for (let j = v0; j < v1; j++) pos.setXYZ(j, p.x, p.y - 30, p.z);
    if (pos.addUpdateRange) pos.addUpdateRange(v0 * 3, (v1 - v0) * 3);
    pos.needsUpdate = true;
  }
  if (p.sig !== undefined) { const M = new THREE.Matrix4().makeScale(0, 0, 0); world.sigMesh.setMatrixAt(p.sig, M); world.sigMesh.instanceMatrix.needsUpdate = true; }
  world.group.add(g);
  // tip about the horizontal axis at right angles to the hit, so the top falls the way the car was going
  fallen.push({ p, g, ax: dz, az: -dx, dx, dz, ang: 0, w: Math.min(2.2, 0.4 + sp * 0.06), slide: Math.min(4, sp * 0.12), t: 0 });
}
function restoreProp(p) {
  for (const [m, v0, arr] of p.saved) {
    const pos = m.geometry.attributes.position; pos.array.set(arr, v0 * 3);
    if (pos.addUpdateRange) pos.addUpdateRange(v0 * 3, arr.length);
    pos.needsUpdate = true;
  }
  if (p.sig !== undefined) { const h = world.sigHeads[p.sig]; world.sigMesh.setMatrixAt(p.sig, new THREE.Matrix4().makeTranslation(h.x, 5.05, h.z)); world.sigMesh.instanceMatrix.needsUpdate = true; }
  p.saved = null; p.down = false;
}
function fallenFrame(dt) {
  for (let i = fallen.length - 1; i >= 0; i--) {
    const f = fallen[i]; f.t += dt;
    if (f.ang < 1.42) { f.w += 3.2 * Math.sin(f.ang + 0.08) * dt; f.ang = Math.min(1.42, f.ang + f.w * dt); if (f.ang >= 1.42) f.w = 0; }
    if (f.slide > 0) { const d = f.slide * dt; f.g.position.x += f.dx * d; f.g.position.z += f.dz * d; f.slide = Math.max(0, f.slide - dt * 6); }
    _fa.set(f.ax, 0, f.az); f.g.quaternion.copy(_fq.setFromAxisAngle(_fa, f.ang));
    if (f.t > 14) f.g.position.y -= dt * 0.6; // sink into the ground
    if (f.t > 18) { world.group.remove(f.g); f.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); fallen.splice(i, 1); }
  }
  // put props back after a while, once the player is far enough not to see it happen
  if (!world.props) return;
  for (const p of world.props) if (p.down && p.saved && roamT - p.downT > 45 && Math.hypot(p.x - roam.x, p.z - roam.z) > 90 && !fallen.some((f) => f.p === p)) restoreProp(p);
}
// ramps, the viaduct, the bridge and the Skyway: ride the deck, bounce off its rails, can't drive into its sides
function deckUpdate() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h);
  const bounce = (nx, nz) => { // (nx, nz) points back to where the car is allowed to be
    const vn = R.vx * nx + R.vz * nz;
    if (vn < 0) { R.vx -= 1.3 * vn * nx; R.vz -= 1.3 * vn * nz; R.vx *= 0.97; R.vz *= 0.97; if (-vn > 4) { R.shake = Math.min(1, -vn / 18); if (audio) pop(Math.min(0.5, -vn / 40)); crashChain(-vn); } }
  };
  R.slopeF = 0;
  if (R.deck) {
    const r = R.deck, pr = projectRoad(r, R.x, R.z), h = r.hAt(pr.s);
    if (pr.d > r.w || h < 0.02) { R.deck = null; R.y = 0; return; }
    R.y = h;
    const t = rPoint(r, pr.s), nx = -t.tz, nz = t.tx, lim = r.w / 2 - 1.05;
    if (Math.abs(pr.lat) > lim) { const sg = Math.sign(pr.lat), push = Math.abs(pr.lat) - lim; R.x -= nx * sg * push; R.z -= nz * sg * push; bounce(-nx * sg, -nz * sg); }
    R.slopeF = (r.hAt(pr.s + 1) - r.hAt(pr.s - 1)) / 2 * (fx * t.tx + fz * t.tz);
    return;
  }
  R.y = 0;
  for (const r of ELEVATED) {
    const pr = projectRoad(r, R.x, R.z); if (pr.d > r.w / 2 + 1.5) continue;
    const h = r.hAt(pr.s), a = Math.abs(pr.lat);
    if (a < r.w / 2 - 0.4 && h < 0.5) { if (h > 0.02) { R.deck = r; R.y = h; } continue; }
    if (a < r.w / 2 + 0.9 && h >= 0.5 && h < 4.6) {
      const t = rPoint(r, pr.s), nx = -t.tz, nz = t.tx, sg = Math.sign(pr.lat) || 1, push = r.w / 2 + 0.9 - a;
      R.x += nx * sg * push; R.z += nz * sg * push; bounce(nx * sg, nz * sg);
    }
  }
}
function collideVehicles() {
  const R = roam, fx = Math.cos(R.h), fz = Math.sin(R.h);
  for (const c of veh) {
    if (!c.bot) continue; // street traffic is a ghost: you drive straight through it
    if (Math.abs(c.x - R.x) > 7 || Math.abs(c.z - R.z) > 7 || Math.abs((c.y || 0) - R.y) > 2) continue;
    for (const o of bodyCircles()) for (const q of [-1.2, 1.2]) {
      const px = R.x + fx * o, pz = R.z + fz * o, qx = c.x + c.tx * q, qz = c.z + c.tz * q;
      const dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz); if (d >= 2 || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d, pen = 2 - d;
      R.x += nx * pen; R.z += nz * pen;
      const rvx = R.vx - c.tx * c.v, rvz = R.vz - c.tz * c.v, vn = rvx * nx + rvz * nz;
      if (vn < 0) { R.vx -= 1.25 * vn * nx; R.vz -= 1.25 * vn * nz; if (-vn > 3) { R.shake = Math.min(1, -vn / 18); if (audio) pop(Math.min(0.5, -vn / 40)); crashChain(-vn); } }
      c.hitT = c.bot ? 0.6 : 2.2;
    }
  }
}
function attachAt(e, s) { const hA = e.road.hAt, h = hA ? hA(s) : 0; roam.deck = h > 0.02 ? e.road : null; roam.y = roam.deck ? h : 0; }
function resetToRoad() {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.lo + 6; s < e.hi - 6; s += 10) { const p = rPoint(e.road, s), d = Math.hypot(p.x - roam.x, p.z - roam.z) + (e.road.hAt ? e.road.hAt(s) * 3 : 0); if (d < bd) { bd = d; best = { e, s }; } }
  if (!best) return;
  const p = lanePose(best.e, 1, laneOff(best.e.type, 0), best.s);
  Object.assign(roam, { x: p.x, z: p.z, h: Math.atan2(p.tz, p.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0 });
  attachAt(best.e, best.s); deckUpdate();
  roam.camH = roam.h;
}
function areaName(x, z) {
  if (z > 1070) return 'NEON ISLAND';
  if (Math.abs(x + 200) < 12 && z > 650) return 'HARBOR BRIDGE';
  if (inTunnel(x, z)) return 'WEST TUNNEL';
  if (Math.abs(z + 900) < 14 && Math.abs(x) < 620) return 'NORTH VIADUCT';
  if (x > 805 && x < 905 && z > -260 && z < -140) return 'SKYWAY RAMP';
  if (z > 645) return x > 455 && x < 805 ? 'HARBOR PIER' : 'PALM COAST BEACH';
  if (Math.abs(z - 640) < 12) return 'COAST BOULEVARD';
  if (Math.abs(x) > 820 || z < -820) return 'RING HIGHWAY';
  if (x > 400) return 'HARBOR DISTRICT';
  if (Math.abs(x) <= 400 && z > -400 && z < 300) return 'DOWNTOWN';
  if (z >= 300) return 'SUNSET SHORE';
  if (z < -400) return 'NORTH HILLS';
  return 'WESTSIDE';
}

/* ---- enter / leave ---- */
async function startRoam(spawn) {
  if (race.active || roam.active) return;
  const ok = (q) => q && Number.isFinite(q.x) && Number.isFinite(q.z) && Number.isFinite(q.h);
  const sp = ok(spawn) ? spawn : ok(roam.spawn) ? roam.spawn : { x: 2.2, z: 180, h: -Math.PI / 2 };
  const nameIn = $('roamName'); if (nameIn) { myName = nameIn.value.trim().slice(0, 16) || 'Driver'; try { localStorage.setItem('raven-rs-name', myName); } catch (e) { /* storage unavailable */ } }
  $('loading').textContent = 'LOADING NEON BAY'; $('loading').hidden = false;
  await new Promise((r) => setTimeout(r, 40));
  if (!world.built) await signFonts();
  if (!world.built) { buildWorld(); makeBots(); const TC = ['#4a4f57', '#9aa3ad', '#e9e9ec', '#1f5fd6', '#7a1f2b', '#2e3b2a', '#c9a227', '#121316', '#5a3a7a', '#3a6a8a', '#8a6a4a', '#2a2d33'];
    for (let i = 0; i < ROAM_TRAFFIC; i++) veh.push({ id: 't' + i, bot: false, tt: i % 3, mult: 0.85 + Math.random() * 0.3, x: 0, z: 0, y: 0, tx: 1, tz: 0, v: 0, hitT: 0, col: new THREE.Color(TC[i % TC.length]) });
    buildMarkers(); }
  const R = roam;
  R.saved = { lightsOn: cfg.lightsOn, near: camera.near, far: camera.far, beams: beams.map((b) => [b.distance, b.angle, b.intensity]) };
  cfg.lightsOn = true; updateMaterials();
  beams.forEach((b) => { b.distance = 55; b.angle = 0.42; b.intensity = 60; b.visible = true; });
  for (const e of Object.values(ENVS)) e.group.visible = false;
  world.group.visible = true;
  scene.environment = world.env; scene.background = world.bg; scene.fog = world.fog; renderer.toneMappingExposure = 0.95;
  camera.near = 0.5; camera.far = 900; camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--accent', '#ff5fa8'); document.documentElement.style.setProperty('--accent-ink', '#1d0010');
  Object.assign(R, { active: true, x: sp.x, z: sp.z, h: sp.h, vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, steer: 0, gear: 1, rpm: 950, shiftT: 0, thr: 0, nos: 1, drift: false, yr: 0, spin: 0, rearSlip: 0, slipA: 0, liftT: 0, acc: 0, lat: 0, keys: {}, camH: sp.h, shake: 0, chat: false, deck: null, y: 0, slopeF: 0, photo: false, mapOpen: false });
  deckUpdate();
  let rainOn = false; try { rainOn = localStorage.getItem('raven-rs-rain') === '1'; } catch (e) { /* storage unavailable */ }
  setRoamRain(rainOn);
  R.ph = physicsFor(cfg, 1);
  R.eng = { ph: R.ph, rpm: 950, thr: 0, shiftT: 0, launched: true, blown: false, nosT: 0 };
  carRig.rotation.set(0, 0, 0); carRig.rotation.order = 'YXZ';
  carRig.userData.wheels.forEach((w) => { w.userData.ry0 = w.rotation.y; });
  const rigT = ensureRoamTraffic(); for (const T of rigT) for (const k of ['body', 'dark', 'tail', 'head']) if (!T[k].parent) world.group.add(T[k]);
  if (!rigT.glow.parent) world.group.add(rigT.glow);
  for (const c of veh) spawnVeh(c, R.x, R.z, c.bot ? 60 : 40, c.bot ? 320 : 380);
  for (const p of net.players.values()) { p.buf = []; if (!p.rig) { p.rig = makeLiteRig(p.look, p.color); world.group.add(p.rig); } }
  controls.enabled = false; setSpin(false); tween = null;
  $('stage').classList.add('roaming'); $('roam').hidden = false;
  tagFor('me'); roam.meTag.nm.textContent = myName;
  for (const p of net.players.values()) tagFor(p.id);
  net.enter();
  roamFrame(0);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compile on first draw instead */ }
  $('loading').hidden = true;
  audioStart();
  showChat(net.players.keys().next().value, 'Welcome to the city, ' + myName + '! Press Enter to chat.');
}
function exitRoam(keepNet) {
  const R = roam; if (!R.active) return;
  if (LOD.prs !== 1) { LOD.prs = 1; renderer.setPixelRatio(LOD.basePR); resize(); }
  speedFx.enabled = false; if (!keepNet) net.exit();
  if (amb.on) ambShift(false, true);
  endEvent(true); if (R.photo) setPhoto(false); if (R.mapOpen) setMap(false);
  R.active = false; if (R.chat) closeChat(false);
  audioStop();
  $('stage').classList.remove('roaming'); $('roam').hidden = true;
  world.group.visible = false;
  cfg.lightsOn = R.saved.lightsOn; updateMaterials();
  beams.forEach((b, i) => { [b.distance, b.angle, b.intensity] = R.saved.beams[i]; b.visible = cfg.lightsOn; });
  camera.near = R.saved.near; camera.far = R.saved.far; camera.updateProjectionMatrix();
  carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0); carRig.rotation.order = 'XYZ';
  carRig.userData.wheels.forEach((w) => { w.rotation.z = 0; if (w.userData.ry0 !== undefined) w.rotation.y = w.userData.ry0; });
  shadowBlob.rotation.z = 0; glow.rotation.z = 0; placeCarFx(0, 0);
  smoke.forEach((s) => { s.visible = false; }); flames.forEach((f) => { f.visible = false; f.rotation.set(0, 0, Math.PI / 2); });
  setLocation(loc);
  controls.enabled = true; controls.target.set(0, 0.55, 0); setView(42, 9, 10.8); resize(); controls.update();
  renderer.shadowMap.needsUpdate = true; render(); renderStats(); invalidate();
}

/* ---- per-frame ---- */
const mmCtx = () => $('minimap').getContext('2d');
let roamT = 0;
function roamFrame(dtRaw) {
  const R = roam, dt = Math.min(dtRaw, 0.05);
  if (R.photo) { speedFx.enabled = false; controls.update(); world.far.position.set(camera.position.x, 0, camera.position.z); return; }
  if (R.mapOpen) return;
  roamT += dt;
  const frozen = ev.active && ev.phase === 'count';
  const n = Math.max(1, Math.ceil(dt / (1 / 180)));
  for (let i = 0; i < n; i++) { stepPlayer(dt / n); deckUpdate(); if (!(R.deck && R.y > 0.6)) collideStatic(); }
  if (frozen) { R.vx = 0; R.vz = 0; R.vf = 0; R.vl = 0; R.yr = 0; }
  // traffic and bots
  for (const c of veh) {
    if (frozen && c.racing) { c.v = 0; poseVeh(c); continue; }
    stepVeh(c, dt);
    const d = Math.hypot(c.x - R.x, c.z - R.z);
    if (!c.e || (!c.bot && d > 480)) spawnVeh(c, R.x, R.z, c.bot ? 150 : 180, c.bot ? 360 : 420);
    if (c.bot && !c.racing && d > 750) spawnVeh(c, R.x, R.z, 150, 360);
  }
  collideVehicles(); if (!(R.deck && R.y > 0.6)) collideStatic();
  updateSignals(); fallenFrame(dt); eventFrame(dt); ambFrame(dt); styleUpdate(dt);
  if (R.rain && world.rainMesh) updateRain(world.rainMesh, dt);
  world.beamPivot.rotation.y += dt * 0.7;
  // bots publish snapshots at 10 Hz, like players on the network would
  const now = performance.now() / 1000;
  for (const c of veh) if (c.bot) { c.sendT -= dt; if (c.sendT <= 0) { c.sendT = 0.1; net.ingest(c.id, { t: now, x: c.x, z: c.z, y: c.y || 0, h: Math.atan2(c.tz, c.tx), v: c.v }); } }
  net.publishState({ x: R.x, z: R.z, y: R.y, h: R.h, v: R.vf });
  botChatT -= dt; if (botChatT <= 0) { botChatT = 25 + Math.random() * 35; const ids = [...net.players.keys()]; botSay(ids[Math.floor(Math.random() * ids.length)], BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]); }
  // other players: draw 150 ms in the past and interpolate between snapshots
  const rt = now - 0.15;
  for (const p of net.players.values()) {
    const b = p.buf; if (!b.length || !p.rig) continue;
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const s1 = b[i], s0 = b[Math.max(0, i - 1)], k = s1.t > s0.t ? clamp((rt - s0.t) / (s1.t - s0.t), 0, 1) : 1;
    let dh = s1.h - s0.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    p.x = s0.x + (s1.x - s0.x) * k; p.z = s0.z + (s1.z - s0.z) * k; p.h = s0.h + dh * k; p.y = (s0.y || 0) + ((s1.y || 0) - (s0.y || 0)) * k;
    p.rig.position.set(p.x, p.y, p.z); p.rig.rotation.y = -p.h;
    p.rig.visible = s1.y > -100 && Math.hypot(p.x - R.x, p.z - R.z) < 320; // y < -100: that driver is on the drag strip
  }
  // place the player's car
  const fx = Math.cos(R.h), fz = Math.sin(R.h);
  carRig.position.set(R.x, R.y, R.z); carRig.rotation.y = -R.h;
  carRig.rotation.z += (clamp(R.acc / G * 0.03, -0.012, 0.03) + Math.atan(R.slopeF || 0) - carRig.rotation.z) * Math.min(1, dt * 8);
  carRig.rotation.x += (clamp(-R.lat / G * 0.025, -0.03, 0.03) - carRig.rotation.x) * Math.min(1, dt * 5);
  carRig.userData.wheels.forEach((w) => { w.rotation.z = -w.userData.side * R.wheelA; if (w.position.x > 0) w.rotation.y = w.userData.ry0 - R.steer; });
  shadowBlob.position.set(R.x, R.y + 0.07, R.z); shadowBlob.rotation.z = -R.h;
  glow.position.set(R.x, R.y + 0.08, R.z); glow.rotation.z = -R.h; glowL.position.set(R.x, R.y + 0.3, R.z);
  beams.forEach((l, i) => { const s = i ? -1 : 1, rx = -fz, rz = fx; const nf = rigDims().front - 0.05; l.position.set(R.x + fx * nf + rx * s * 0.55, R.y + 0.62, R.z + fz * nf + rz * s * 0.55); l.target.position.set(R.x + fx * 16 + rx * s * 1.2, R.y + 16 * (R.slopeF || 0), R.z + fz * 16 + rz * s * 1.2); l.target.updateMatrixWorld(); });
  // tyre smoke while sliding, nitro flames
  R.smokeT -= dt;
  if (R.smokeT <= 0) {
    R.smokeT = 0.04;
    const slide = (R.drift && Math.abs(R.vl) > 1.5) || R.spin > 0.25 || (R.gear === 1 && R.thr > 0.8 && R.vf < 6 && R.vf > 0.3);
    if (slide) for (const s of [1, -1]) { const xr = rigDims().xr; puff(R.x + fx * xr - fz * s * 0.85, R.z + fz * xr + fx * s * 0.85); smoke[(smokeI - 1) % smoke.length].position.y += R.y; }
  }
  for (const s of smoke) if (s.visible) { s.userData.life -= dt * 1.1; s.scale.setScalar(0.6 + (1 - s.userData.life) * 2.4); s.position.y += dt * 0.5; s.material.opacity = Math.max(0, s.userData.life) * 0.5; if (s.userData.life <= 0) s.visible = false; }
  const FD = rigDims(), ey = FD.exY, fb = FD.rear - 0.3, fw = FD.exZ;
  flames.forEach((f, i) => {
    f.visible = R.nosOn;
    if (f.visible) { const s = i ? -1 : 1; f.position.set(R.x + fx * fb - fz * s * fw, ey + R.y, R.z + fz * fb + fx * s * fw); f.rotation.set(0, -R.h, Math.PI / 2); f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
  });
  // traffic instances (three body styles), pitched on ramps
  const tr = roamTrafficRig, cnt = [0, 0, 0];
  for (const c of veh) if (!c.bot) {
    if (Math.abs(c.x - R.x) > 420 || Math.abs(c.z - R.z) > 420 || !c.e) continue;
    const T = tr[c.tt], i = cnt[c.tt]++;
    tq.setFromEuler(teul.set(0, -Math.atan2(c.tz, c.tx), Math.atan(c.slope || 0), 'YXZ')); tm4.compose(tv3.set(c.x, c.y || 0, c.z), tq, ts3);
    for (const k of ['body', 'dark', 'tail', 'head']) T[k].setMatrixAt(i, tm4);
    T.body.setColorAt(i, c.col);
    tr.glow.setMatrixAt(cnt[0] + cnt[1] + cnt[2] - 1, tm4);
  }
  tr.glow.count = cnt[0] + cnt[1] + cnt[2]; tr.glow.instanceMatrix.needsUpdate = true;
  tr.forEach((T, j) => { for (const k of ['body', 'dark', 'tail', 'head']) { T[k].count = cnt[j]; T[k].instanceMatrix.needsUpdate = true; } T.body.instanceColor.needsUpdate = true; });
  // chase camera: trails the car's heading with a little lag so drifts swing it round
  let dh = R.h - R.camH; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  R.camH += dh * Math.min(1, dt * (Math.abs(R.vf) < 2 ? 2 : 4.5));
  const cfx = Math.cos(R.camH), cfz = Math.sin(R.camH), back = R.camMode ? 9.5 : 6.3, up = R.camMode ? 3.6 : 2.25;
  R.shake = Math.max(0, R.shake - dt * 2.5);
  const spN = clamp((Math.abs(R.vf) - 22) / 78, 0, 1), rush = spN * spN * (3 - 2 * spN) + (R.nosOn ? 0.35 : 0);
  const sh = R.shake * 0.25 + rush * 0.035;
  speedFx.enabled = !R.photo && rush > 0.01; speedFx.uniforms.amt.value = Math.min(0.16, rush * 0.11); speedFx.uniforms.vig.value = Math.min(0.55, rush * 0.42);
  R.camY = R.camY === undefined ? R.y : R.camY + (R.y - R.camY) * Math.min(1, dt * 6);
  camera.position.set(R.x - cfx * back + (Math.random() - 0.5) * sh, R.camY + up + (Math.random() - 0.5) * sh, R.z - cfz * back + (Math.random() - 0.5) * sh);
  camera.lookAt(R.x + cfx * 3, R.y + 1.0, R.z + cfz * 3);
  const fov = (camera.aspect < 1.1 ? 70 : 60) + Math.min(22, Math.abs(R.vf) * 0.24) + (R.nosOn ? 7 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  world.far.position.set(camera.position.x, 0, camera.position.z);
  // show only chunks near the camera (the rest are in the fog anyway)
  lodUpdate(dt);
  // sound
  const spd = Math.hypot(R.vx, R.vz);
  Object.assign(R.eng, { rpm: R.rpm, thr: R.thr, shiftT: R.shiftT, nosT: R.nosOn ? 1 : 0, v: spd, slide: spd < 3 ? (R.spin > 0.2 ? 0.6 : 0) : Math.max(R.spin * 0.8, R.keys.hb ? 0.75 : 0, clamp((R.rearSlip - 0.13) / 0.25, 0, 1)) });
  audioUpdate(R.eng, dt);
  roamHud(dt);
}
const projV = new THREE.Vector3();
function placeTag(t, x, y, z, maxD) {
  projV.set(x, y, z); const d = camera.position.distanceTo(projV); projV.project(camera);
  const on = projV.z < 1 && d < maxD && Math.abs(projV.x) < 1.1 && Math.abs(projV.y) < 1.1;
  t.el.style.display = on ? '' : 'none'; if (!on) return;
  const w = stage.clientWidth, h = stage.clientHeight, sc = clamp(1.25 - d / 140, 0.65, 1.1);
  t.el.style.transform = `translate(${((projV.x + 1) / 2 * w).toFixed(1)}px, ${((1 - projV.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
}
function roamHud(dt) {
  const R = roam;
  $('roKmh').textContent = Math.round(Math.abs(R.vf) * 3.6);
  $('roGear').textContent = R.vf < -0.5 && R.keys.down ? 'R' : String(R.gear);
  $('roNos').style.width = (cfg.nitro > 0 || R.infNos ? R.nos * 100 : 0).toFixed(1) + '%';
  $('roNosRow').classList.toggle('off', !(cfg.nitro > 0 || R.infNos)); $('roNosRow').classList.toggle('live', R.nosOn);
  R.areaT -= dt; if (R.areaT <= 0) { R.areaT = 0.5; const a = R.deck && R.deck.sky ? 'NEON SKYWAY' : areaName(R.x, R.z); if ($('roArea').textContent !== a) $('roArea').textContent = a; }
  // name tags and chat bubbles
  const me = tagFor('me'); me.msgT -= dt; if (me.msgT <= 0 && me.el.classList.contains('says')) me.el.classList.remove('says');
  placeTag(me, R.x, R.y + 2.1, R.z, 200); me.el.classList.add('self');
  for (const p of net.players.values()) {
    if (!p.el || p.x === undefined) continue;
    p.msgT -= dt; if (p.msgT <= 0 && p.el.classList.contains('says')) p.el.classList.remove('says');
    placeTag(p, p.x, (p.y || 0) + 2.1, p.z, p.el.classList.contains('says') ? 220 : 130);
  }
  markerHud(dt);
  drawMinimap();
}
function drawMinimap() {
  const cv = $('minimap'), g = mmCtx(), W = cv.width, R = roam, s = world.mapS;
  const k = clamp(1.7 - Math.abs(R.vf) * 0.012, 1.15, 1.7), rot = -Math.PI / 2 - R.h;
  g.clearRect(0, 0, W, W); g.save();
  g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 4, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#0d0f17'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(rot); g.scale(k, k); g.translate(-(R.x + 1000) * s, -(R.z + 1000) * s);
  g.drawImage(world.map, 0, 0);
  const route = ev.active && ev.pts ? ev.pts : roam.gpsR ? [[R.x, R.z, 0], ...roam.gpsR.pts.slice(roam.gpsR.idx)] : roam.gps;
  if (route) { g.strokeStyle = ev.active ? '#ffb547' : '#ff5fa8'; g.lineWidth = 7 / k; g.lineJoin = 'round'; g.beginPath(); route.forEach(([x, z], i) => { const a = (x + 1000) * s, b = (z + 1000) * s; if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
  if (!ev.active) for (const m of markers) { g.fillStyle = m.def.color; g.beginPath(); g.arc((m.x + 1000) * s, (m.z + 1000) * s, 7 / k, 0, Math.PI * 2); g.fill(); }
  if (ev.active && ev.cps && ev.cps[ev.next]) { const c = ev.cps[ev.next]; g.strokeStyle = '#ffffff'; g.lineWidth = 3 / k; g.beginPath(); g.arc((c.x + 1000) * s, (c.z + 1000) * s, 9 / k, 0, Math.PI * 2); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of net.players.values()) {
    if (p.x === undefined) continue;
    const dx = (p.x - R.x) * s * k, dz = (p.z - R.z) * s * k, c = Math.cos(rot), sn = Math.sin(rot);
    const x = W / 2 + dx * c - dz * sn, y = W / 2 + dx * sn + dz * c;
    if (Math.hypot(x - W / 2, y - W / 2) > W / 2 - 10) continue;
    g.fillStyle = p.color; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  g.restore();
  // the player arrow, always pointing up
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(W / 2, W / 2 - 14); g.lineTo(W / 2 + 9, W / 2 + 10); g.lineTo(W / 2, W / 2 + 5); g.lineTo(W / 2 - 9, W / 2 + 10); g.closePath(); g.fill();
  // north marker on the rim
  const na = rot - Math.PI / 2, nr = W / 2 - 18;
  g.fillStyle = '#ff5fa8'; g.font = '700 22px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', W / 2 + Math.cos(na) * nr, W / 2 + Math.sin(na) * nr);
}

/* ---- input ---- */
window.addEventListener('keydown', (e) => {
  if (!roam.active) return;
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  const k = e.key;
  if (roam.chat) {
    if (k === 'Enter') { closeChat(true); e.preventDefault(); }
    else if (k === 'Escape') { closeChat(false); e.preventDefault(); }
    e.stopImmediatePropagation(); return;
  }
  if (roam.mapOpen) { if (k === 'm' || k === 'M' || k === 'Escape') setMap(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (roam.photo) { if (k === 'p' || k === 'P' || k === 'Escape') setPhoto(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mp.pick && (k === '1' || k === '2' || k === 'x' || k === 'X' || k === 'Escape')) { if (k === '1') mpInvite('drag'); else if (k === '2') mpInvite('street'); else mp.pick = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (mp.inv && (k === 'x' || k === 'X')) { mpDecline(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ev.phase === 'done' && (k === 'Enter' || k === 'e' || k === 'E')) { closeResult(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (RKEYS[k]) { roam.keys[RKEYS[k]] = true; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.repeat) return;
  if (k === 'Enter') openChat();
  else if (k === 'e' || k === 'E') interact();
  else if (k === 'm' || k === 'M') setMap(true);
  else if (k === 't' || k === 'T') setRoamRain(!roam.rain);
  else if (k === 'p' || k === 'P') setPhoto(true);
  else if (k === 'c' || k === 'C') roam.camMode = 1 - roam.camMode;
  else if (k === 'r' || k === 'R') { if (ev.active && ev.lastCp) placeAtCheckpoint(ev.lastCp); else resetToRoad(); }
  else if (k === 'Escape') exitRoam();
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
window.addEventListener('keyup', (e) => { if (roam.active && RKEYS[e.key]) { roam.keys[RKEYS[e.key]] = false; if (e.key === 'Shift') roam.keys.nos = false; e.preventDefault(); } }, true);
window.addEventListener('blur', () => { for (const k in roam.keys) roam.keys[k] = false; });
$('roQuit').onclick = exitRoam;
$('chatIn').addEventListener('blur', () => { if (roam.chat) closeChat(false); });


/* ---- billboard atlas: invented brands, 2 x 4 panels ---- */
// Shop signs and rooftop billboards, drawn into one atlas. Every business gets a sign that suits it: only the
// nightlife glows as neon tubes; shops, pharmacies, banks and fuel stations get backlit light boxes; cafes, the
// choyxona, galleries, workshops and the rest get painted, carved or enamel boards that the sun lights like a wall.
// kind: 'neon' (bright, unlit), 'box' (backlit, unlit), 'paint' (lit by the scene)
const SERIF = 'Georgia, "Times New Roman", serif', SANS = '"Inter", Arial, sans-serif', DISPLAY = '"Chakra Petch", "Arial Narrow", sans-serif';
const ROMAN = '"Cinzel", "Trajan Pro", Georgia, serif';
const SCRIPT = '"Pacifico", "Brush Script MT", "Segoe Script", cursive', BLOCK = '"Bebas Neue", Impact, "Arial Black", sans-serif', MONO = '"Courier New", monospace';
// [kind, style, background, ink, accent]
const SHOP_STYLE = {
  'PERFORMANCE SHOP': ['paint', 'race', '#111216', '#f2f2f2', '#e0262f'], 'TUNER HAVEN': ['box', 'race', '#0d1626', '#ffffff', '#2ee6d6'],
  'BURGERS': ['box', 'bold', '#d62828', '#ffd23f', '#ffd23f'], 'NOODLES': ['box', 'asia', '#b3141c', '#fff4e0', '#f2c14e'],
  'SUSHI BAR': ['paint', 'asia', '#f4efe6', '#1b1b1b', '#c8102e'], 'RAMEN': ['neon', 'neon', '#07070d', '#ff5a3d', '#ffb547'],
  'PIZZA': ['box', 'italy', '#fdf6e3', '#b22222', '#009246'], 'TRATTORIA': ['paint', 'italy', '#f3ead6', '#2b5a2b', '#ce2b37'],
  'ARCADE': ['neon', 'pixel', '#07070d', '#9b5cff', '#2ee6d6'], 'KARAOKE': ['neon', 'neonScript', '#07070d', '#ff3da8', '#ffe066'],
  'TATTOO': ['paint', 'tattoo', '#141414', '#e8d9b0', '#b3261e'], 'MOTEL': ['neon', 'neonScript', '#07070d', '#ff5a3d', '#5fb8ff'],
  'DINER': ['neon', 'neonScript', '#07070d', '#5fb8ff', '#ff3da8'], 'TIRES': ['paint', 'stencil', '#f2c200', '#111111', '#111111'],
  'BODY SHOP': ['paint', 'stencil', '#2b2f36', '#f2c200', '#f2c200'], 'PARTS': ['paint', 'stencil', '#c8102e', '#ffffff', '#ffffff'],
  'GARAGE': ['paint', 'enamel', '#1e3a5f', '#ffffff', '#d9dde3'], 'CAR WASH': ['box', 'wave', '#1aa3e8', '#ffffff', '#bfe9ff'],
  'CAFE': ['paint', 'chalk', '#2b2b2b', '#f4f1e8', '#f4f1e8'], 'COFFEE': ['paint', 'wood', '#5a3a22', '#f3e3c3', '#c89b6d'],
  'BAKERY': ['paint', 'script', '#f6e7cf', '#7a4a24', '#c98b4a'], 'DONUTS': ['box', 'round', '#ff8fc7', '#ffffff', '#7a3b1e'],
  'ICE CREAM': ['box', 'round', '#bff0e6', '#e0457b', '#ffffff'], 'TACOS': ['box', 'bold', '#ff7a1a', '#ffffff', '#16a085'],
  'LAUNDRY': ['box', 'clean', '#e8f6ff', '#1d6fb8', '#7fc8ff'], 'GYM': ['box', 'bold', '#111111', '#ffffff', '#e0262f'],
  'BOOKS': ['paint', 'serif', '#1f3d2b', '#e8d48a', '#e8d48a'], 'RECORDS': ['paint', 'retro', '#f2e6c8', '#1b1b1b', '#e0262f'],
  'FLOWERS': ['paint', 'script', '#f3e8ef', '#8a3b6b', '#5e8c4a'], 'CINEMA': ['box', 'marquee', '#6b0f1a', '#fff3c4', '#ffd36b'],
  'THEATER': ['box', 'marquee', '#2a1033', '#fff3c4', '#ffd36b'], 'HOTEL': ['box', 'luxe', '#0d0d0f', '#e6c27a', '#e6c27a'],
  'CLUB': ['neon', 'neon', '#07070d', '#2ee6d6', '#ff3da8'], 'NEON NIGHTS': ['neon', 'neonScript', '#07070d', '#ff3da8', '#9b5cff'],
  'BOWLING': ['neon', 'neon', '#07070d', '#ffe066', '#ff5a3d'], 'VIDEO': ['neon', 'retro', '#07070d', '#ff3da8', '#2ee6d6'],
  'RESTAURANT': ['paint', 'luxe', '#14110f', '#e6c27a', '#e6c27a'], 'BISTRO': ['paint', 'script', '#1c2a3a', '#f4efe2', '#c8a96a'],
  'STEAK HOUSE': ['paint', 'wood', '#3a2416', '#f0d9a8', '#b5651d'], 'BAR & GRILL': ['paint', 'wood', '#2e1d12', '#ffcf7a', '#d2552a'],
  'MUSEUM': ['paint', 'greek', '#c9c4ba', '#5b5852', '#8d887e'], 'GALLERY': ['paint', 'minimal', '#f5f5f2', '#111111', '#111111'],
  'LIBRARY': ['paint', 'stone', '#c2b9a8', '#2a2621', '#2a2621'], 'BANK': ['box', 'luxe', '#0f2747', '#d9b45a', '#d9b45a'],
  'TEA HOUSE': ['paint', 'uzbek', '#0f3b6e', '#ffffff', '#3fc1c9'], 'CHOYXONA': ['paint', 'uzbek', '#12406f', '#ffffff', '#e8b64c'],
  'PLOV HOUSE': ['paint', 'uzbek', '#7a1f1f', '#fff1d6', '#e8b64c'], 'SAMSA': ['paint', 'uzbek', '#8a4b14', '#fff3dc', '#3fc1c9'],
  'KEBAB': ['box', 'flame', '#1a0f0a', '#ffd23f', '#ff5a1f'], 'BBQ': ['paint', 'flame', '#1c1410', '#ffe1a8', '#ff5a1f'],
  'PHARMACY': ['box', 'cross', '#ffffff', '#139a43', '#139a43'], 'MARKET': ['paint', 'awning', '#f7f2e6', '#2f6b2f', '#2f8f3a'],
  'SUPERMARKET': ['box', 'bold', '#e2231a', '#ffffff', '#ffd200'], 'MALL': ['box', 'clean', '#ffffff', '#222222', '#2ee6d6'],
  'ELECTRONICS': ['box', 'tech', '#0b1f3a', '#ffffff', '#38b6ff'], 'FASHION': ['box', 'minimal', '#ffffff', '#111111', '#111111'],
  'BARBER': ['paint', 'barber', '#f4f1ea', '#1b1b1b', '#c8102e'], 'PARKING': ['box', 'parking', '#1f5fbf', '#ffffff', '#ffffff'],
  'FUEL': ['box', 'fuel', '#ffffff', '#0b3d91', '#e2231a'], 'SEAFOOD': ['paint', 'nautical', '#0f2f4f', '#ffffff', '#e2231a'],
  'MARINA': ['paint', 'nautical', '#ffffff', '#0f2f4f', '#0f2f4f'], 'SURF SHOP': ['paint', 'wave', '#ffcf5a', '#0d5f8a', '#1aa3e8'],
  'ROOFTOP BAR': ['neon', 'neonScript', '#07070d', '#ffb547', '#2ee6d6'], 'JAZZ CLUB': ['neon', 'neonScript', '#07070d', '#5fb8ff', '#ffb547']
};
// the sign fonts are web fonts: make sure they are in before the city's atlas is drawn (never wait more than 2.5 s)
const signFonts = () => (document.fonts && document.fonts.load ? Promise.race([Promise.all(['400 40px "Pacifico"', '400 40px "Bebas Neue"', '700 30px "Cinzel"', '800 30px "Inter"', '300 30px "Inter"'].map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve());
// a pictogram on the left of each sign
const SHOP_ICON = {
  'BARBER': 'scissors', 'PIZZA': 'pizza', 'TRATTORIA': 'pizza', 'PLOV HOUSE': 'plov', 'SAMSA': 'samsa', 'CHOYXONA': 'teapot', 'TEA HOUSE': 'teapot',
  'KEBAB': 'skewer', 'BBQ': 'skewer', 'BURGERS': 'burger', 'NOODLES': 'bowl', 'RAMEN': 'bowl', 'SUSHI BAR': 'sushi', 'TACOS': 'taco',
  'DONUTS': 'donut', 'ICE CREAM': 'cone', 'COFFEE': 'cup', 'CAFE': 'cup', 'BAKERY': 'bread', 'FLOWERS': 'flower', 'BOOKS': 'book', 'LIBRARY': 'book',
  'GYM': 'dumbbell', 'LAUNDRY': 'washer', 'TIRES': 'tire', 'PARTS': 'wrench', 'BODY SHOP': 'wrench', 'GARAGE': 'wrench', 'CAR WASH': 'car',
  'CINEMA': 'film', 'THEATER': 'masks', 'BOWLING': 'pin', 'KARAOKE': 'mic', 'ARCADE': 'joystick', 'SEAFOOD': 'fish', 'SURF SHOP': 'board',
  'ELECTRONICS': 'bolt', 'FASHION': 'hanger', 'SUPERMARKET': 'cart', 'MARKET': 'cart', 'HOTEL': 'bed', 'MOTEL': 'bed', 'FUEL': 'pump',
  'MUSEUM': 'temple', 'BANK': 'temple', 'GALLERY': 'frame', 'STEAK HOUSE': 'steak', 'RESTAURANT': 'cutlery', 'BISTRO': 'cutlery', 'DINER': 'cutlery',
  'BAR & GRILL': 'glass', 'ROOFTOP BAR': 'glass', 'CLUB': 'disco', 'NEON NIGHTS': 'glass', 'JAZZ CLUB': 'note', 'VIDEO': 'tape', 'RECORDS': 'vinyl',
  'PERFORMANCE SHOP': 'gear', 'TUNER HAVEN': 'gear', 'TATTOO': 'heart', 'PHARMACY': 'cross', 'PARKING': 'parking', 'MARINA': 'anchor', 'MALL': 'bag'
};
const SIGN_KIND = SHOP_SIGNS.map((n) => (SHOP_STYLE[n] || ['paint'])[0]);
// rooftop billboards: an ad campaign each, most of them printed and floodlit, two of them neon
const BILLBOARDS = [
  ['MIDNIGHT FM', '104.2 · NIGHT DRIVE RADIO', 'box'], ['NEON NOODLE', 'OPEN ALL NIGHT', 'neon'], ['RAVEN RS', 'GARAGE · TUNE YOUR RIDE', 'neon'],
  ['PIXEL ARCADE', 'INSERT COIN', 'box'], ['LUMEN COFFEE', 'STAY AWAKE', 'paint'], ['NIGHT OWL DINER', '24 / 7', 'box'],
  ['BLUE MOTH HOTEL', 'VACANCY', 'paint'], ['HARBOR LIGHTS', 'SEAFOOD · LIVE MUSIC', 'paint']
];
function signAtlas() {
  const c = mkCanvas(1024, 2048), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // write text no wider than w, shrinking the font if needed; opts: letter spacing, stroke, glow
  const text = (t, cx, cy, w, size, font, fill, o = {}) => {
    if (font === SCRIPT) t = t.toLowerCase().replace(/(^|[\s&·])([a-z])/g, (m, a, b) => a + b.toUpperCase()); // script lettering reads in Title Case
    let sz = size; const setF = () => { g.font = `${o.italic ? 'italic ' : ''}${o.weight || 700} ${sz}px ${font}`; }; setF();
    const sp = o.spacing || 0, width = () => g.measureText(t).width + sp * (t.length - 1);
    while (width() > w && sz > 8) { sz -= 1; setF(); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 10; }
    const draw = (fx) => {
      if (!sp) { fx(t, cx, cy); return; }
      let x = cx - width() / 2; g.textAlign = 'left';
      for (const ch of t) { fx(ch, x, cy); x += g.measureText(ch).width + sp; }
      g.textAlign = 'center';
    };
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.sw || 3; g.lineJoin = 'round'; draw((s, x, y) => g.strokeText(s, x, y)); }
    g.fillStyle = fill; draw((s, x, y) => g.fillText(s, x, y));
    g.shadowBlur = 0;
  };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const vgrad = (x, y, h, a, b) => { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  // ---- pictograms: drawn in a 48 px box around (0, 0); neon signs get glowing outlines instead of fills ----
  let bgCol = '#000000';
  const ICON = (kind, cx, cy, c1, c2, neon) => {
    g.save(); g.translate(cx, cy);
    const F = (col = c1) => { if (neon) { g.strokeStyle = col; g.lineWidth = 2.6; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
    const S = (col = c1, w = 3) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; if (neon) { g.shadowColor = col; g.shadowBlur = 8; } g.stroke(); };
    const P = () => g.beginPath(), C = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { g.arc(x, y, r, a0, a1); }, E = (x, y, rx, ry) => g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    switch (kind) {
      case 'scissors': P(); C(-9, 13, 7); F(); P(); C(9, 13, 7); F(); if (!neon) { g.fillStyle = 'rgba(0,0,0,0)'; } P(); g.moveTo(-6, 7); g.lineTo(9, -20); S(c1, 4); P(); g.moveTo(6, 7); g.lineTo(-9, -20); S(c1, 4); P(); C(0, -1, 2.2); F(c2); break;
      case 'pizza': P(); g.moveTo(-18, -14); g.quadraticCurveTo(0, -22, 18, -14); g.lineTo(0, 20); g.closePath(); F('#f2b632'); P(); g.moveTo(-18, -14); g.quadraticCurveTo(0, -22, 18, -14); S('#b5651d', 5); for (const [px, py] of [[-6, -8], [6, -6], [0, 4]]) { P(); C(px, py, 3.6); F('#c0392b'); } break;
      case 'plov': P(); E(0, 10, 22, 7); F(c2); P(); g.moveTo(-17, 8); g.quadraticCurveTo(0, -24, 17, 8); g.closePath(); F('#f0c060'); for (const [px, py] of [[-8, 0], [0, -6], [7, -1], [-2, 4], [4, 4]]) { P(); g.rect(px - 2, py - 1, 5, 2.2); F('#e8742a'); } for (const [px, py] of [[-4, -3], [5, 2]]) { P(); C(px, py, 2.6); F('#7a3b1e'); } break;
      case 'samsa': P(); g.moveTo(0, -18); g.lineTo(20, 15); g.lineTo(-20, 15); g.closePath(); F('#d9952e'); for (const [px, py] of [[0, -4], [-6, 6], [6, 6], [0, 9], [-3, 1], [3, 1]]) { P(); E(px, py, 1.2, 0.8); F('#fff3d6'); } break;
      case 'teapot': P(); E(0, 4, 14, 12); F(); P(); g.moveTo(12, 2); g.quadraticCurveTo(24, -2, 22, -12); S(c1, 4); P(); g.moveTo(-13, -2); g.quadraticCurveTo(-24, 2, -13, 12); S(c1, 3); P(); E(0, -9, 7, 3); F(c2); P(); C(0, -13, 2.4); F(c2); for (let k = -1; k <= 1; k++) { P(); C(k * 6, 4, 1.8); F(c2); } break;
      case 'skewer': P(); g.moveTo(-22, 16); g.lineTo(22, -16); S('#9a9a9a', 2.5); [[-12, 9, '#8a3b1e'], [-3, 2, '#e8742a'], [6, -4, '#8a3b1e'], [14, -10, '#5e8c4a']].forEach(([px, py, col]) => { P(); g.rect(px - 5, py - 5, 10, 10); F(col); }); break;
      case 'burger': P(); g.moveTo(-18, -2); g.quadraticCurveTo(0, -22, 18, -2); g.closePath(); F('#e0a040'); P(); g.rect(-19, 0, 38, 4); F('#5e8c4a'); P(); g.rect(-18, 4, 36, 6); F('#5a2e16'); P(); g.moveTo(-18, 11); g.lineTo(18, 11); g.quadraticCurveTo(18, 18, 0, 18); g.quadraticCurveTo(-18, 18, -18, 11); F('#e0a040'); break;
      case 'bowl': P(); g.moveTo(-20, -2); g.lineTo(20, -2); g.quadraticCurveTo(18, 18, 0, 18); g.quadraticCurveTo(-18, 18, -20, -2); F(); P(); g.moveTo(-4, -4); g.lineTo(10, -22); g.moveTo(2, -4); g.lineTo(16, -20); S(c2, 2.5); break;
      case 'sushi': P(); C(0, 0, 18); F('#1b1b1b'); P(); C(0, 0, 14); F('#ffffff'); P(); C(0, 0, 7); F('#ff7a5a'); break;
      case 'taco': P(); g.moveTo(-20, 12); g.quadraticCurveTo(0, -24, 20, 12); g.closePath(); F('#f2c14e'); P(); g.moveTo(-14, 6); g.quadraticCurveTo(-6, -8, 0, -6); g.quadraticCurveTo(8, -10, 14, 6); S('#5e8c4a', 4); P(); C(-4, 0, 2.5); F('#c0392b'); P(); C(5, 1, 2.5); F('#c0392b'); break;
      case 'donut': P(); C(0, 0, 19); F('#d9a066'); P(); C(0, 0, 15); F(c1); P(); C(0, 0, 6); F(c2 === c1 ? '#ffffff' : c2); g.fillStyle = '#ffffff'; for (let k = 0; k < 8; k++) { const a = k * 0.8; P(); g.rect(Math.cos(a) * 11 - 1.5, Math.sin(a) * 11 - 0.6, 3, 1.2); F(['#2ee6d6', '#ffe066', '#ffffff', '#9b5cff'][k % 4]); } break;
      case 'cone': P(); g.moveTo(-10, 0); g.lineTo(10, 0); g.lineTo(0, 22); g.closePath(); F('#d9a066'); P(); C(-5, -5, 8); F('#ff8fc7'); P(); C(5, -6, 8); F('#bff0e6'); P(); C(0, -14, 7); F('#7a3b1e'); break;
      case 'cup': P(); g.moveTo(-14, -6); g.lineTo(12, -6); g.lineTo(9, 16); g.lineTo(-11, 16); g.closePath(); F(); P(); C(14, 4, 6, -1.3, 1.3); S(c1, 3); for (const sx of [-6, 0, 6]) { P(); g.moveTo(sx, -9); g.bezierCurveTo(sx - 4, -14, sx + 4, -17, sx, -22); S(c2, 2); } break;
      case 'bread': P(); g.moveTo(-20, 8); g.quadraticCurveTo(0, -26, 20, 8); g.quadraticCurveTo(0, 0, -20, 8); F('#d9952e'); for (const sx of [-8, 0, 8]) { P(); g.moveTo(sx - 3, -4); g.lineTo(sx + 3, 4); S('#8a4b14', 2); } break;
      case 'flower': for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; P(); E(Math.cos(a) * 9, Math.sin(a) * 9 - 4, 7, 7); F(c1); } P(); C(0, -4, 5); F('#f2c14e'); P(); g.moveTo(0, 6); g.lineTo(0, 22); S(c2, 3); break;
      case 'book': P(); g.moveTo(0, -12); g.quadraticCurveTo(-12, -18, -22, -14); g.lineTo(-22, 14); g.quadraticCurveTo(-12, 10, 0, 16); g.quadraticCurveTo(12, 10, 22, 14); g.lineTo(22, -14); g.quadraticCurveTo(12, -18, 0, -12); g.closePath(); F(); P(); g.moveTo(0, -12); g.lineTo(0, 16); S(c2 === c1 ? '#000000' : c2, 2); break;
      case 'dumbbell': P(); g.rect(-14, -2, 28, 4); F(); for (const sx of [-18, 14]) { P(); g.rect(sx, -12, 5, 24); F(); } for (const sx of [-23, 19]) { P(); g.rect(sx, -8, 4, 16); F(); } break;
      case 'washer': P(); g.rect(-17, -20, 34, 40); F(); P(); C(0, 4, 11); F(c2 === c1 ? '#ffffff' : c2); P(); C(0, 4, 7); F(c1); for (const sx of [-11, -5]) { P(); C(sx, -14, 2); F('#ffffff'); } break;
      case 'tire': P(); C(0, 0, 20); F('#111111'); P(); C(0, 0, 10); F('#9a9a9a'); P(); C(0, 0, 4); F('#111111'); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; P(); g.rect(Math.cos(a) * 17 - 1.5, Math.sin(a) * 17 - 1.5, 3, 3); F('#444444'); } break;
      case 'wrench': // an open-end spanner: handle, round head, and a jaw cut back to the sign's own colour
        g.rotate(-Math.PI / 4); P(); g.rect(-3.5, -10, 7, 30); F(); P(); C(0, -14, 10); F(); P(); C(0, 18, 5); F();
        P(); g.moveTo(-4.5, -26); g.lineTo(-4.5, -14); g.lineTo(4.5, -14); g.lineTo(4.5, -26); g.closePath(); if (neon) S(c1, 2); else { g.fillStyle = bgCol; g.fill(); } break;
      case 'car': P(); g.moveTo(-22, 8); g.lineTo(-20, 0); g.lineTo(-10, -2); g.lineTo(-4, -10); g.lineTo(10, -10); g.lineTo(16, -2); g.lineTo(22, 0); g.lineTo(22, 8); g.closePath(); F(); for (const sx of [-12, 12]) { P(); C(sx, 9, 5); F('#1b1b1b'); } for (const [dx, dy] of [[-12, -20], [0, -22], [12, -20]]) { P(); g.moveTo(dx, dy - 4); g.quadraticCurveTo(dx + 3, dy + 1, dx, dy + 2); g.quadraticCurveTo(dx - 3, dy + 1, dx, dy - 4); F(c2); } break;
      case 'film': P(); C(0, 0, 19); F(); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - 1.57; P(); C(Math.cos(a) * 10, Math.sin(a) * 10, 4.5); F(c2 === c1 ? '#000000' : c2); } P(); C(0, 0, 3); F(c2 === c1 ? '#000000' : c2); break;
      case 'masks': for (const [sx, rot, smile] of [[-8, -0.25, 1], [9, 0.25, -1]]) { g.save(); g.translate(sx, 0); g.rotate(rot); P(); E(0, 0, 11, 15); F(smile > 0 ? c1 : c2); P(); E(-4, -4, 2.4, 1.6); E(4, -4, 2.4, 1.6); F('#000000'); P(); g.arc(0, smile > 0 ? 3 : 9, 5, smile > 0 ? 0.2 : Math.PI + 0.2, smile > 0 ? Math.PI - 0.2 : -0.2); S('#000000', 2); g.restore(); } break;
      case 'pin': P(); g.moveTo(-3, -20); g.quadraticCurveTo(-9, -12, -3, -4); g.quadraticCurveTo(-11, 8, -6, 20); g.lineTo(6, 20); g.quadraticCurveTo(11, 8, 3, -4); g.quadraticCurveTo(9, -12, 3, -20); g.closePath(); F(); P(); C(14, 12, 8); F(c2); break;
      case 'mic': P(); E(0, -10, 8, 10); F(); P(); g.moveTo(-12, -4); g.quadraticCurveTo(-12, 10, 0, 10); g.quadraticCurveTo(12, 10, 12, -4); S(c2, 3); P(); g.moveTo(0, 10); g.lineTo(0, 20); g.moveTo(-7, 20); g.lineTo(7, 20); S(c2, 3); break;
      case 'joystick': P(); g.rect(-18, 8, 36, 10); F(c2); P(); g.moveTo(0, 8); g.lineTo(0, -8); S(c1, 4); P(); C(0, -12, 7); F(); P(); C(10, 4, 3); F(c1); break;
      case 'fish': P(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -14, 14, 0); g.quadraticCurveTo(0, 14, -18, 0); F(); P(); g.moveTo(12, 0); g.lineTo(22, -9); g.lineTo(22, 9); g.closePath(); F(); P(); C(-10, -2, 2); F(c2 === c1 ? '#000000' : c2); break;
      case 'board': g.rotate(-0.6); P(); E(0, 0, 7, 22); F(); P(); g.moveTo(0, -20); g.lineTo(0, 20); S(c2, 2); break;
      case 'bolt': P(); g.moveTo(4, -22); g.lineTo(-12, 3); g.lineTo(-1, 3); g.lineTo(-5, 22); g.lineTo(12, -4); g.lineTo(1, -4); g.closePath(); F(c2); break;
      case 'hanger': P(); g.moveTo(0, -8); g.lineTo(-20, 10); g.lineTo(20, 10); g.closePath(); S(c1, 3); P(); g.moveTo(0, -8); g.lineTo(0, -12); g.arc(4, -15, 4, Math.PI, 0.6 * Math.PI, false); S(c1, 3); break;
      case 'cart': P(); g.moveTo(-22, -14); g.lineTo(-14, -14); g.lineTo(-8, 8); g.lineTo(16, 8); g.lineTo(20, -8); g.lineTo(-11, -8); S(c1, 3); for (const sx of [-6, 13]) { P(); C(sx, 15, 3.5); F(); } break;
      case 'bed': P(); g.rect(-22, -2, 44, 10); F(); P(); g.rect(-22, -14, 5, 28); F(); P(); g.rect(-15, -9, 10, 7); F(c2); P(); g.rect(-22, 8, 4, 6); g.rect(18, 8, 4, 6); F(); break;
      case 'pump': P(); g.rect(-14, -18, 20, 36); F(); P(); g.rect(-10, -14, 12, 9); F(c2 === c1 ? '#ffffff' : c2); P(); g.moveTo(6, -10); g.lineTo(14, -6); g.lineTo(14, 12); S(c1, 3); break;
      case 'temple': P(); g.moveTo(-22, -10); g.lineTo(0, -21); g.lineTo(22, -10); g.closePath(); F(); P(); g.rect(-22, -9, 44, 3); F(); for (let k = 0; k < 4; k++) { P(); g.rect(-18 + k * 11, -5, 5, 20); F(); } P(); g.rect(-23, 15, 46, 4); F(); break;
      case 'frame': P(); g.rect(-20, -16, 40, 32); F(); P(); g.rect(-15, -11, 30, 22); F(c2 === c1 ? '#f5f5f2' : c2); P(); g.moveTo(-15, 11); g.lineTo(-4, -2); g.lineTo(3, 5); g.lineTo(8, 0); g.lineTo(15, 11); g.closePath(); F(c1); P(); C(8, -5, 3); F(c1); break;
      case 'steak': P(); g.moveTo(-18, -6); g.quadraticCurveTo(-10, -20, 8, -16); g.quadraticCurveTo(24, -10, 18, 6); g.quadraticCurveTo(10, 20, -8, 14); g.quadraticCurveTo(-24, 8, -18, -6); F('#8a2b1e'); P(); g.moveTo(-6, -8); g.lineTo(-6, 10); g.moveTo(-6, 0); g.lineTo(10, 0); S('#f3e3c3', 3); break;
      case 'cutlery': P(); g.moveTo(-8, -20); g.lineTo(-8, 20); S(c1, 3); for (const fx of [-13, -3]) { P(); g.moveTo(fx, -20); g.lineTo(fx, -8); S(c1, 2); } P(); g.moveTo(-13, -8); g.quadraticCurveTo(-8, -2, -3, -8); S(c1, 2); P(); g.moveTo(8, 20); g.lineTo(8, -20); g.quadraticCurveTo(16, -10, 8, 2); S(c1, 3); break;
      case 'glass': P(); g.moveTo(-14, -16); g.lineTo(14, -16); g.lineTo(0, 2); g.closePath(); F(); P(); g.moveTo(0, 2); g.lineTo(0, 16); g.moveTo(-8, 16); g.lineTo(8, 16); S(c1, 3); P(); C(8, -16, 4); F(c2); break;
      case 'disco': P(); C(0, 2, 16); F(); g.strokeStyle = c2; g.lineWidth = 1; for (let k = -12; k <= 12; k += 6) { P(); g.moveTo(-16, 2 + k); g.lineTo(16, 2 + k); S(c2, 1); P(); g.moveTo(k, -14); g.lineTo(k, 18); S(c2, 1); } P(); g.moveTo(0, -14); g.lineTo(0, -22); S(c1, 2); break;
      case 'note': P(); E(-8, 12, 7, 5); F(); P(); E(12, 8, 7, 5); F(); P(); g.moveTo(-2, 12); g.lineTo(-2, -16); g.lineTo(18, -20); g.lineTo(18, 8); S(c1, 3); break;
      case 'tape': P(); g.rect(-22, -13, 44, 26); F(); for (const sx of [-9, 9]) { P(); C(sx, -1, 5); F(c2); } P(); g.rect(-12, 6, 24, 4); F(c2); break;
      case 'vinyl': P(); C(0, 0, 20); F('#111111'); P(); C(0, 0, 7); F(c2); P(); C(0, 0, 2); F('#111111'); for (const r of [11, 15, 18]) { P(); C(0, 0, r); S('#333333', 1); } break;
      case 'gear': P(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 14 : 20; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); F(); P(); C(0, 0, 6); F(c2 === c1 ? '#000000' : c2); break;
      case 'heart': P(); g.moveTo(0, 16); g.bezierCurveTo(-26, -2, -12, -24, 0, -10); g.bezierCurveTo(12, -24, 26, -2, 0, 16); F(); P(); g.rect(-20, -2, 40, 8); F(c2); break;
      case 'cross': P(); g.rect(-6, -18, 12, 36); g.rect(-18, -6, 36, 12); F(); break;
      case 'parking': P(); g.rect(-20, -20, 40, 40); F('#ffffff'); P(); g.rect(-16, -16, 32, 32); F(c2 === '#ffffff' ? '#1f5fbf' : c2); g.fillStyle = '#ffffff'; g.font = `900 30px ${SANS}`; g.fillText('P', 0, 2); break;
      case 'anchor': P(); g.moveTo(0, -16); g.lineTo(0, 16); g.moveTo(-10, -8); g.lineTo(10, -8); g.moveTo(-14, 4); g.quadraticCurveTo(0, 26, 14, 4); S(c1, 3.5); P(); C(0, -19, 4); S(c1, 3); break;
      case 'bag': P(); g.rect(-16, -8, 32, 26); F(); P(); g.arc(0, -8, 8, Math.PI, 0); S(c1, 3); break;
    }
    g.restore();
  };

  // ---- 64 shop signs, 256 x 64 each ----
  const shop = (name, x, y) => {
    const [kind, st, bg, ink, ac] = SHOP_STYLE[name] || ['paint', 'serif', '#333333', '#ffffff', '#ffffff'];
    const W = 256, H = 64, cy = y + H / 2, IC = SHOP_ICON[name], cx = x + W / 2 + (IC ? 22 : 0);
    // the text helper, with room left for the pictogram
    const T = (t, tx, ty, w, ...rest) => text(t, tx, ty, w - (IC ? 44 : 0), ...rest);
    g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip();
    g.fillStyle = bg; g.fillRect(x, y, W, H);
    switch (st) {
      case 'neon': case 'neonScript': {
        g.fillStyle = '#0b0b12'; g.fillRect(x, y, W, H);
        g.strokeStyle = ac; g.lineWidth = 2; g.shadowColor = ac; g.shadowBlur = 8; rr(x + 6, y + 6, W - 12, H - 12, 10); g.stroke(); g.shadowBlur = 0;
        const scr = st === 'neonScript';
        T(name, cx, cy + 1, W - 30, scr ? 40 : 32, scr ? SCRIPT : DISPLAY, '#ffffff', { glow: ink, blur: 14, stroke: ink, sw: 5, italic: !scr, weight: scr ? 400 : 700 });
        break;
      }
      case 'pixel': {
        g.fillStyle = '#0b0b12'; g.fillRect(x, y, W, H);
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? ink : ac; g.fillRect(x + 6 + i * 15.5, y + 4, 8, 4); g.fillRect(x + 6 + i * 15.5, y + H - 8, 8, 4); }
        T(name, cx, cy, W - 24, 34, MONO, ac, { glow: ac, blur: 10, weight: 700, spacing: 4 });
        break;
      }
      case 'race': {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) { g.fillStyle = '#ffffff'; if (!IC) g.fillRect(x + i * 6, y + j * 16, 6, 16); g.fillRect(x + W - 48 + i * 6, y + j * 16, 6, 16); }
        g.fillStyle = ac; g.beginPath(); g.moveTo(x + 52, y + H - 10); g.lineTo(x + W - 40, y + H - 10); g.lineTo(x + W - 46, y + H - 4); g.lineTo(x + 46, y + H - 4); g.fill();
        T(name, cx - (IC ? 14 : 0), cy - 3, W - (IC ? 70 : 110), 30, DISPLAY, ink, { italic: true });
        break;
      }
      case 'bold': {
        g.fillStyle = ac; g.fillRect(x, y + H - 8, W, 8); g.fillRect(x, y, W, 4);
        T(name, cx, cy - 1, W - 22, 40, BLOCK, ink, { weight: 400, spacing: 1, stroke: shade(bg, 0.55), sw: 4 });
        break;
      }
      case 'round': {
        g.fillStyle = ac; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + 14 + i * 29, y + 2, 12, 0, Math.PI); g.fill(); }
        T(name, cx, cy + 5, W - 30, 36, SANS, ink, { weight: 800, stroke: '#ffffff', sw: 6 });
        break;
      }
      case 'asia': {
        g.fillStyle = ac; g.fillRect(x, y, 10, H); g.fillRect(x + W - 10, y, 10, H);
        T(name, cx, cy, W - 40, 34, SERIF, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'italy': {
        const st3 = ['#009246', '#ffffff', '#ce2b37']; for (let i = 0; i < 3; i++) { g.fillStyle = st3[i]; g.fillRect(x + i * W / 3, y + H - 9, W / 3, 9); }
        T(name, cx, cy - 4, W - 30, 36, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'tattoo': {
        g.strokeStyle = ac; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, W - 10, H - 10); g.strokeRect(x + 9, y + 9, W - 18, H - 18);
        T(name, cx, cy + 2, W - 40, 38, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'stencil': {
        for (const sx of [x, x + W - 34]) for (let i = -2; i < 6; i++) { g.fillStyle = i % 2 ? ink : bg; g.beginPath(); g.moveTo(sx + i * 12, y + H); g.lineTo(sx + i * 12 + 12, y + H); g.lineTo(sx + i * 12 + 12 + H * 0.5, y); g.lineTo(sx + i * 12 + H * 0.5, y); g.fill(); }
        g.fillStyle = bg; g.fillRect(x + 36, y, W - 72, H);
        T(name, cx, cy + 1, W - 84, 40, BLOCK, ink, { weight: 400, spacing: 2 });
        break;
      }
      case 'enamel': {
        g.fillStyle = ac; rr(x + 4, y + 4, W - 8, H - 8, 12); g.fill(); g.fillStyle = bg; rr(x + 8, y + 8, W - 16, H - 16, 9); g.fill();
        for (const sx of [x + 16, x + W - 16]) { g.fillStyle = ac; g.beginPath(); g.arc(sx, cy, 3, 0, 7); g.fill(); }
        T(name, cx, cy + 1, W - 50, 32, SANS, ink, { weight: 800, spacing: 4 });
        break;
      }
      case 'wave': {
        g.fillStyle = ac; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x, y + H); for (let i = 0; i <= W; i += 8) g.lineTo(x + i, y + H - 10 - k * 7 + Math.sin(i / 14 + k) * 4); g.lineTo(x + W, y + H); g.fill(); g.globalAlpha = 0.6; }
        g.globalAlpha = 1;
        T(name, cx, cy - 6, W - 26, 34, SANS, ink, { weight: 800, italic: true });
        break;
      }
      case 'chalk': {
        g.strokeStyle = '#8a6a44'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, W - 6, H - 6);
        g.globalAlpha = 0.08; g.fillStyle = '#ffffff'; for (let i = 0; i < 60; i++) g.fillRect(x + Math.random() * W, y + Math.random() * H, 6, 1); g.globalAlpha = 1;
        T(name, cx, cy + 2, W - 40, 40, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'wood': {
        for (let i = 0; i < 4; i++) { g.fillStyle = shade(bg, 0.85 + (i % 2) * 0.2); g.fillRect(x, y + i * 16, W, 15); }
        g.strokeStyle = shade(bg, 0.6); g.lineWidth = 4; g.strokeRect(x + 2, y + 2, W - 4, H - 4);
        T(name, cx, cy + 1, W - 30, 34, SERIF, ink, { weight: 700, spacing: 2, stroke: shade(bg, 0.5), sw: 3 });
        break;
      }
      case 'script': {
        g.strokeStyle = ac; g.lineWidth = 2; rr(x + 6, y + 6, W - 12, H - 12, 18); g.stroke();
        T(name, cx, cy + 2, W - 40, 42, SCRIPT, ink, { weight: 400 });
        break;
      }
      case 'serif': {
        g.strokeStyle = ac; g.lineWidth = 1.5; g.strokeRect(x + 6, y + 6, W - 12, H - 12);
        T(name, cx, cy + 1, W - 40, 32, SERIF, ink, { weight: 400, spacing: 6 });
        break;
      }
      case 'retro': {
        T(name, cx, cy + 1, W - 30, 36, BLOCK, ink, { weight: 400, italic: true, spacing: 1, glow: st === 'retro' && bg === '#07070d' ? ink : null, blur: 10 });
        break;
      }
      case 'marquee': {
        g.fillStyle = vgrad(x, y, H, shade(bg, 1.4), bg); g.fillRect(x, y, W, H);
        for (let i = 0; i < 20; i++) for (const yy of [y + 5, y + H - 5]) { g.fillStyle = ac; g.shadowColor = ac; g.shadowBlur = 4; g.beginPath(); g.arc(x + 8 + i * 12.6, yy, 2.6, 0, 7); g.fill(); }
        g.shadowBlur = 0;
        T(name, cx, cy + 1, W - 30, 34, DISPLAY, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'luxe': {
        g.strokeStyle = ac; g.lineWidth = 1; g.strokeRect(x + 5, y + 5, W - 10, H - 10); g.strokeRect(x + 9, y + 9, W - 18, H - 18);
        if (name === 'HOTEL') for (let i = 0; i < 5; i++) { const sx = cx - 28 + i * 14; g.fillStyle = ac; g.font = `12px ${SERIF}`; g.fillText('★', sx, y + 17); }
        T(name, cx, cy + (name === 'HOTEL' ? 7 : 1), W - 46, 30, SERIF, ink, { weight: 400, spacing: 7 });
        break;
      }
      case 'stone': {
        g.fillStyle = vgrad(x, y, H, shade(bg, 1.08), shade(bg, 0.86)); g.fillRect(x, y, W, H);
        g.strokeStyle = shade(bg, 0.7); g.lineWidth = 2; g.strokeRect(x + 4, y + 4, W - 8, H - 8);
        T(name, cx + 1, cy + 2, W - 36, 30, SERIF, 'rgba(255,255,255,0.55)', { weight: 400, spacing: 8 });
        T(name, cx, cy + 1, W - 36, 30, SERIF, ink, { weight: 400, spacing: 8 });
        break;
      }
      case 'greek': {
        // marble slab, a Greek key band above and below, carved Roman capitals
        g.fillStyle = vgrad(x, y, H, '#dcd8cf', '#b4afa4'); g.fillRect(x, y, W, H);
        g.strokeStyle = ink; g.lineWidth = 1.6;
        for (const yy of [y + 3, y + H - 11]) { g.beginPath(); for (let k = 0; k < 32; k++) { const kx = x + k * 8; g.moveTo(kx, yy + 8); g.lineTo(kx, yy); g.lineTo(kx + 6, yy); g.lineTo(kx + 6, yy + 5); g.lineTo(kx + 3, yy + 5); g.lineTo(kx + 3, yy + 3); } g.stroke(); }
        T(name, cx + 1, cy + 2, W - 30, 30, ROMAN, 'rgba(255,255,255,0.6)', { weight: 700, spacing: 7 });
        T(name, cx, cy + 1, W - 30, 30, ROMAN, ink, { weight: 700, spacing: 7 });
        break;
      }
      case 'minimal': {
        T(name, cx, cy + 1, W - 40, 28, SERIF, ink, { weight: 400, spacing: 10 });
        g.fillStyle = ink; g.fillRect(cx - 30, y + H - 12, 60, 1.5);
        break;
      }
      case 'uzbek': {
        // a tiled border of eight-point stars and diamonds, like the girih on a choyxona facade
        g.fillStyle = ac; g.fillRect(x, y, W, 11); g.fillRect(x, y + H - 11, W, 11);
        for (let i = 0; i < 18; i++) for (const yy of [y + 5.5, y + H - 5.5]) {
          const sx = x + 7 + i * 14.4; g.fillStyle = bg; g.beginPath(); g.moveTo(sx, yy - 4.5); g.lineTo(sx + 4.5, yy); g.lineTo(sx, yy + 4.5); g.lineTo(sx - 4.5, yy); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(sx - 1, yy - 1, 2, 2);
        }
        for (const sx of IC ? [x + W - 18] : [x + 18, x + W - 18]) { g.save(); g.translate(sx, cy); g.fillStyle = ac; for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); } g.restore(); g.fillStyle = bg; g.beginPath(); g.arc(sx, cy, 3, 0, 7); g.fill(); }
        T(name, cx, cy + 1, W - 70, 28, SERIF, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'flame': {
        for (let i = 0; i < 16; i++) { const fx = x + i * 16 + 8, fh = 10 + ((i * 7) % 5) * 3; g.fillStyle = i % 2 ? ac : '#ffb02e'; g.beginPath(); g.moveTo(fx - 8, y + H); g.quadraticCurveTo(fx - 6, y + H - fh * 0.6, fx, y + H - fh); g.quadraticCurveTo(fx + 6, y + H - fh * 0.6, fx + 8, y + H); g.fill(); }
        T(name, cx, cy - 6, W - 30, 36, BLOCK, ink, { weight: 400, spacing: 2, stroke: '#000000', sw: 4 });
        break;
      }
      case 'cross': {
        g.fillStyle = ac; g.fillRect(x, y + H - 5, W, 5);
        T(name, cx, cy, W - 30, 32, SANS, ink, { weight: 800, spacing: 2 });
        break;
      }
      case 'awning': {
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : ac; g.fillRect(x + i * 16, y, 16, 16); g.beginPath(); g.arc(x + i * 16 + 8, y + 16, 8, 0, Math.PI); g.fill(); }
        T(name, cx, cy + 12, W - 40, 30, SERIF, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'clean': {
        g.fillStyle = ac; g.fillRect(x, y, 8, H);
        T(name, cx + 4, cy + 1, W - 40, 34, SANS, ink, { weight: 300, spacing: 6 });
        break;
      }
      case 'tech': {
        g.strokeStyle = ac; g.lineWidth = 1.5; if (!IC) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x, y + 10 + i * 11); g.lineTo(x + 18 + i * 4, y + 10 + i * 11); g.lineTo(x + 24 + i * 4, y + 4 + i * 11); g.stroke(); }
        T(name, cx, cy + 1, W - 40, 32, DISPLAY, ink, { weight: 700, spacing: 3 });
        g.fillStyle = ac; g.fillRect(x + 60, y + H - 9, W - 80, 3);
        break;
      }
      case 'barber': {
        // the striped pole on the right, scissors on the left
        g.save(); g.beginPath(); rr(x + W - 28, y + 8, 18, H - 16, 8); g.clip();
        g.fillStyle = '#ffffff'; g.fillRect(x + W - 28, y, 18, H);
        for (let i = -4; i < 8; i++) { g.fillStyle = i % 2 ? '#c8102e' : '#1d4ea8'; g.beginPath(); g.moveTo(x + W - 28, y + i * 10); g.lineTo(x + W - 10, y + i * 10 - 10); g.lineTo(x + W - 10, y + i * 10 - 5); g.lineTo(x + W - 28, y + i * 10 + 5); g.fill(); }
        g.restore();
        T(name, cx - 8, cy + 1, W - 60, 34, SERIF, ink, { weight: 700, spacing: 5 });
        break;
      }
      case 'parking': {
        T(name, cx, cy + 1, W - 30, 28, SANS, ink, { weight: 700, spacing: 3 });
        break;
      }
      case 'fuel': {
        g.fillStyle = ac; g.fillRect(x, y, W, 14); g.fillStyle = ink; g.fillRect(x, y + H - 10, W, 10);
        T(name, cx, cy + 2, W - 30, 34, BLOCK, ink, { weight: 400, spacing: 8 });
        break;
      }
      case 'nautical': {
        g.strokeStyle = ac; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(x + 6, y + 6, W - 12, H - 12); g.setLineDash([]);
        T(name, cx, cy + 1, W - 40, 32, SERIF, ink, { weight: 700, spacing: 4 });
        break;
      }
      default: T(name, cx, cy, W - 20, 32, SANS, ink, {});
    }
    if (IC) {
      const neon = kind === 'neon', c1 = neon ? ink : (['bowl', 'teapot', 'cup', 'book', 'temple', 'gear', 'tape', 'film', 'mic', 'joystick', 'board', 'bed', 'pump', 'bag', 'frame', 'washer', 'cart', 'hanger', 'dumbbell', 'disco', 'note', 'glass', 'cutlery', 'masks', 'fish', 'heart', 'car', 'wrench', 'anchor', 'scissors', 'cross', 'pin', 'flower', 'donut'].includes(IC) ? (st === 'stencil' || st === 'bold' || st === 'fuel' || st === 'tech' ? ink : ac === bg ? ink : ac) : ink);
      const c2 = neon ? ac : ['scissors', 'bowl', 'teapot', 'plov', 'tape', 'masks', 'mic', 'joystick', 'glass', 'disco', 'heart', 'pin', 'car', 'cup', 'bolt', 'bed', 'pump', 'vinyl', 'flower', 'donut', 'gear'].includes(IC) ? (ink === c1 ? ac : ink) : ink;
      bgCol = st === 'stencil' ? bg : bg;
      ICON(IC, x + (st === 'stencil' ? 52 : st === 'uzbek' ? 26 : 30), cy + (st === 'awning' ? 8 : st === 'uzbek' ? 0 : 0), c1, c2, neon);
    }
    g.restore();
  };
  SHOP_SIGNS.forEach((t, i) => shop(t, (i % 4) * 256, 1024 + (i >> 2) * 64));

  // ---- 8 rooftop billboards, 512 x 256 each ----
  const bb = [
    (x, y) => { // radio: printed sunset gradient, sound waves
      g.fillStyle = vgrad(x, y, 256, '#2b0f4a', '#ff4f8b'); g.fillRect(x, y, 512, 256);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); for (let i = 0; i <= 512; i += 6) g.lineTo(x + i, y + 200 + Math.sin(i / (18 + k * 6) + k) * (6 + k * 5)); g.stroke(); }
      text('MIDNIGHT FM', x + 256, y + 92, 460, 72, DISPLAY, '#ffffff', { italic: true, stroke: '#2b0f4a', sw: 6 });
      text('104.2 · NIGHT DRIVE RADIO', x + 256, y + 158, 420, 28, SANS, '#ffe3f0', { weight: 600, spacing: 2 });
    },
    (x, y) => { // neon noodle: real neon on a dark wall, with a bowl
      g.fillStyle = '#0a0a10'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#ffb547'; g.lineWidth = 6; g.shadowColor = '#ffb547'; g.shadowBlur = 16; g.beginPath(); g.arc(x + 90, y + 140, 50, 0, Math.PI); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x + 70, y + 60); g.lineTo(x + 100, y + 128); g.moveTo(x + 88, y + 56); g.lineTo(x + 112, y + 128); g.stroke(); g.shadowBlur = 0;
      text('NEON NOODLE', x + 310, y + 110, 330, 60, SCRIPT, '#ffffff', { weight: 400, glow: '#ff3da8', blur: 18, stroke: '#ff3da8', sw: 6 });
      text('OPEN ALL NIGHT', x + 310, y + 182, 300, 28, DISPLAY, '#ffb547', { glow: '#ffb547', blur: 10, spacing: 3 });
    },
    (x, y) => { // the garage's own neon
      g.fillStyle = '#03141a'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#2ee6d6'; g.lineWidth = 5; g.shadowColor = '#2ee6d6'; g.shadowBlur = 16; g.strokeRect(x + 14, y + 14, 484, 228); g.shadowBlur = 0;
      text('RAVEN RS', x + 256, y + 106, 440, 76, DISPLAY, '#ffffff', { italic: true, glow: '#2ee6d6', blur: 20, stroke: '#2ee6d6', sw: 6 });
      text('GARAGE · TUNE YOUR RIDE', x + 256, y + 180, 420, 26, SANS, '#bff8f2', { weight: 600, spacing: 3 });
    },
    (x, y) => { // arcade: printed pixel art
      g.fillStyle = '#1b1040'; g.fillRect(x, y, 512, 256);
      for (let i = 0; i < 64; i++) { g.fillStyle = ['#ff3da8', '#2ee6d6', '#ffe066', '#9b5cff'][i % 4]; g.fillRect(x + (i * 37) % 500, y + 10 + ((i * 53) % 230), 6, 6); }
      const inv = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
      inv.forEach((row, r) => [...row].forEach((v, k) => { if (v === '1') { g.fillStyle = '#3bff8a'; g.fillRect(x + 30 + k * 9, y + 70 + r * 9, 9, 9); } }));
      text('PIXEL ARCADE', x + 330, y + 110, 330, 56, MONO, '#ffe066', { weight: 700, spacing: 2, stroke: '#ff3da8', sw: 4 });
      text('INSERT COIN', x + 330, y + 180, 260, 30, MONO, '#ffffff', { weight: 700, spacing: 6 });
    },
    (x, y) => { // coffee: warm printed poster with a steaming cup
      g.fillStyle = '#f3e3c3'; g.fillRect(x, y, 512, 256); g.fillStyle = '#5a3a22'; g.fillRect(x, y + 216, 512, 40);
      g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(x + 50, y + 110); g.lineTo(x + 140, y + 110); g.lineTo(x + 128, y + 196); g.lineTo(x + 62, y + 196); g.fill();
      g.strokeStyle = '#5a3a22'; g.lineWidth = 8; g.beginPath(); g.arc(x + 146, y + 146, 18, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#a07a52'; g.lineWidth = 4; for (const sx of [80, 100, 120]) { g.beginPath(); g.moveTo(x + sx, y + 98); g.bezierCurveTo(x + sx - 10, y + 80, x + sx + 10, y + 70, x + sx, y + 50); g.stroke(); }
      text('LUMEN COFFEE', x + 330, y + 112, 320, 56, SERIF, '#3a2416', { weight: 700 });
      text('STAY AWAKE', x + 330, y + 168, 260, 30, SCRIPT, '#8a5a32', { weight: 400 });
      text('ROASTED IN NEON BAY', x + 256, y + 236, 400, 20, SANS, '#f3e3c3', { weight: 600, spacing: 4 });
    },
    (x, y) => { // 50s diner: checkerboard, red and cream
      g.fillStyle = '#fff4dc'; g.fillRect(x, y, 512, 256);
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { g.fillStyle = '#111111'; g.fillRect(x + i * 16, y + 224 + j * 16, 16, 16); }
      g.fillStyle = '#d62828'; rr(x + 30, y + 40, 452, 120, 60); g.fill();
      text('NIGHT OWL DINER', x + 256, y + 100, 400, 52, SCRIPT, '#fff4dc', { weight: 400, stroke: '#7a0f0f', sw: 4 });
      text('BURGERS · SHAKES · 24 / 7', x + 256, y + 192, 420, 26, SANS, '#d62828', { weight: 800, spacing: 2 });
    },
    (x, y) => { // hotel: art deco print, navy and gold
      g.fillStyle = '#0d1b33'; g.fillRect(x, y, 512, 256);
      g.strokeStyle = '#d9b45a'; g.lineWidth = 2; g.strokeRect(x + 14, y + 14, 484, 228); g.strokeRect(x + 22, y + 22, 468, 212);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(x + 256, y + 60); g.lineTo(x + 256 + (i - 4) * 22, y + 22); g.stroke(); }
      g.fillStyle = '#d9b45a'; g.beginPath(); g.moveTo(x + 230, y + 70); g.quadraticCurveTo(x + 256, y + 50, x + 256, y + 70); g.quadraticCurveTo(x + 256, y + 50, x + 282, y + 70); g.lineTo(x + 256, y + 82); g.fill();
      text('BLUE MOTH HOTEL', x + 256, y + 132, 420, 46, SERIF, '#f2e3b3', { weight: 400, spacing: 8 });
      text('VACANCY · SINCE 1962', x + 256, y + 192, 320, 22, SERIF, '#d9b45a', { weight: 400, spacing: 5 });
    },
    (x, y) => { // seafood: nautical print, waves, a lighthouse
      g.fillStyle = vgrad(x, y, 256, '#eaf4fb', '#bcdaf0'); g.fillRect(x, y, 512, 256);
      g.fillStyle = '#0f2f4f'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y + 256); for (let i = 0; i <= 512; i += 8) g.lineTo(x + i, y + 216 + k * 12 + Math.sin(i / 20 + k * 2) * 6); g.lineTo(x + 512, y + 256); g.globalAlpha = 0.5 + k * 0.25; g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff'; g.fillRect(x + 440, y + 80, 26, 130); g.fillStyle = '#e2231a'; for (let k = 0; k < 3; k++) g.fillRect(x + 440, y + 92 + k * 40, 26, 18); g.fillStyle = '#ffd36b'; g.fillRect(x + 436, y + 62, 34, 18);
      text('HARBOR LIGHTS', x + 230, y + 100, 380, 56, SERIF, '#0f2f4f', { weight: 700, spacing: 3 });
      text('SEAFOOD · LIVE MUSIC', x + 230, y + 158, 340, 26, SANS, '#e2231a', { weight: 800, spacing: 3 });
    }
  ];
  bb.forEach((draw, i) => { const x = (i % 2) * 512, y = (i >> 1) * 256; g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip(); draw(x, y); g.restore(); });
  const t = canvasTex(c); t.flipY = false; t.anisotropy = 4; return t;
}

/* ---- traffic lights: 22 s cycle, east-west first ---- */
function sigState(n, axis) {
  const ph = (roamT + n.sig.off) % 22;
  if (axis === 'ew') return ph < 9 ? 'g' : ph < 10 ? 'a' : 'r';
  return ph >= 11 && ph < 20 ? 'g' : ph >= 20 && ph < 21 ? 'a' : 'r';
}
const SIG_COL = { g: new THREE.Color(0.2, 2.4, 0.7), a: new THREE.Color(2.4, 1.3, 0.1), r: new THREE.Color(2.6, 0.12, 0.1) };
let sigT = 0;
function updateSignals() {
  if (roamT - sigT < 0.2) return; sigT = roamT;
  const m = world.sigMesh; world.sigHeads.forEach((h, i) => m.setColorAt(i, SIG_COL[sigState(h.n, h.axis)]));
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

/* ---- rain in the city ---- */
function setRoamRain(on) {
  roam.rain = on;
  if (on && !world.rainMesh) { world.rainMesh = makeRain(); world.group.add(world.rainMesh); }
  if (world.rainMesh) world.rainMesh.visible = on;
  Object.assign(world.roadMat, on ? { roughness: 0.2, metalness: 0.35, envMapIntensity: 1.25 } : { roughness: 0.78, metalness: 0.0, envMapIntensity: 0.8 });
  world.fog.near = on ? 30 : 70; LOD.far0 = on ? 420 : 620; world.fog.far = LOD.far0; world.fog.color.set(on ? '#8a8490' : '#c79c96'); world.bg.copy(world.fog.color);
  const b = $('roRain'); b.textContent = 'Rain (T): ' + (on ? 'On' : 'Off'); b.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('raven-rs-rain', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
}

/* ---- routes on the lane graph ---- */
function nearestNode(x, z) { let best = null, bd = Infinity; for (const n of world.nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } return best; }
function routeBetween(a, b) {
  const N = world.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N).fill(null), done = new Uint8Array(N);
  dist[a.id] = 0;
  for (;;) {
    let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === b.id) break; done[u] = 1;
    const n = world.nodes[u];
    for (const e of n.edges) {
      const o = e.a === n ? e.b : e.a, dir = e.a === n ? 1 : -1, w = (e.s1 - e.s0) * (e.type === 'street' ? 1.25 : 1);
      if (dist[u] + w < dist[o.id]) { dist[o.id] = dist[u] + w; prev[o.id] = { e, dir, from: u }; }
    }
  }
  if (a === b || !prev[b.id]) return null;
  const steps = []; let cur = b.id; while (cur !== a.id) { const p = prev[cur]; steps.unshift({ e: p.e, dir: p.dir }); cur = p.from; }
  return steps;
}
const endNodeOf = (st) => (st.dir > 0 ? st.e.b : st.e.a);
function routePolyline(steps) {
  const pts = [];
  for (const st of steps) {
    const e = st.e, n = Math.max(2, Math.ceil((e.s1 - e.s0) / 20));
    for (let i = 0; i <= n; i++) {
      const s = st.dir > 0 ? e.s0 + (e.s1 - e.s0) * i / n : e.s1 - (e.s1 - e.s0) * i / n, p = rPoint(e.road, s);
      const last = pts[pts.length - 1]; if (!last || Math.hypot(p.x - last[0], p.z - last[1]) > 1) pts.push([p.x, p.z, e.road.hAt ? e.road.hAt(s) : 0]);
    }
  }
  return pts;
}
// gates every ~220 m and at every turn
function checkpointsFrom(pts) {
  const cps = []; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i]; acc += Math.hypot(x1 - x0, z1 - z0);
    let turn = false;
    if (i + 1 < pts.length) { const ax = x1 - x0, az = z1 - z0, bx = pts[i + 1][0] - x1, bz = pts[i + 1][1] - z1; turn = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1) < 0.8; }
    if (acc >= 220 || (turn && acc > 60) || i === pts.length - 1) { const l = Math.hypot(x1 - x0, z1 - z0) || 1; cps.push({ x: x1, z: z1, y: pts[i][2], tx: (x1 - x0) / l, tz: (z1 - z0) / l }); acc = 0; }
  }
  return cps;
}
// nearest drivable lane point, optionally lined up with a heading
function snapToRoad(x, z, h) {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.lo + 6; s < e.hi - 6; s += 8) {
    const p = rPoint(e.road, s), d = Math.hypot(p.x - x, p.z - z); if (d >= bd) continue;
    bd = d; best = { e, s, dir: h === undefined ? 1 : (Math.cos(h) * p.tx + Math.sin(h) * p.tz >= 0 ? 1 : -1) };
  }
  return best;
}

/* ---- events: glowing markers around the city ---- */
const EVENTS = [
  { id: 'dash', type: 'sprint', name: 'Downtown Dash', from: [-400, 300], to: [400, -400], color: '#ffb547' },
  { id: 'coast', type: 'sprint', name: 'Coast Run to the Island', from: [-800, 640], to: [-200, 1100], color: '#ffb547' },
  { id: 'harbor', type: 'sprint', name: 'Harbor Run', from: [0, -400], to: [800, 560], color: '#ffb547' },
  { id: 'loop', type: 'circuit', name: 'Neon Loop', corners: [[-300, -300], [300, -300], [300, 200], [-300, 200]], laps: 2, color: '#2ee6d6' },
  { id: 'ring', type: 'circuit', name: 'Ring Highway', ring: true, laps: 1, color: '#2ee6d6' },
  { id: 'isle', type: 'drift', name: 'Island Drift', at: [-200, 1180], time: 60, color: '#ff3da8' },
  { id: 'sky', type: 'sprint', name: 'Skyway Sprint', from: [-560, 640], to: [900, -200], color: '#ffb547' },
  { id: 'drag', type: 'drag', name: 'Drag Strip', at: [200, 640], color: '#ffe066' },
  { id: 'garage', type: 'garage', name: 'Raven RS Garage', at: [-100, 250], color: '#ffffff' },
  { id: 'hospital', type: 'hospital', name: 'Neon Bay Hospital', at: [100, -60], color: '#ff4d5e' }
];
const TYPE_LABEL = { sprint: 'Sprint', circuit: 'Circuit', drift: 'Drift', drag: 'Drag race', garage: 'Garage', hospital: 'Ambulance 103' };
const markers = [];
function eventRoute(def) {
  if (def.ring) {
    const es = world.edges.filter((e) => e.road.ring).sort((a, b) => a.s0 - b.s0);
    return es.map((e) => ({ e, dir: 1 }));
  }
  if (def.corners) {
    const ns = def.corners.map(([x, z]) => nearestNode(x, z)), steps = [];
    for (let i = 0; i < ns.length; i++) { const r = routeBetween(ns[i], ns[(i + 1) % ns.length]); if (r) steps.push(...r); }
    return steps;
  }
  return routeBetween(nearestNode(def.from[0], def.from[1]), nearestNode(def.to[0], def.to[1]));
}
function columnTex() {
  const c = mkCanvas(4, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return canvasTex(c);
}
function buildMarkers() {
  const ct = columnTex(), colGeo = new THREE.CylinderGeometry(3.4, 3.4, 26, 28, 1, true), ringGeo = new THREE.RingGeometry(3.2, 3.9, 32);
  colGeo.translate(0, 13, 0); ringGeo.rotateX(-Math.PI / 2);
  for (const def of EVENTS) {
    let x, z, h = 0, y = 0, steps = null;
    if (def.type === 'sprint' || def.type === 'circuit') {
      steps = eventRoute(def); if (!steps || !steps.length) continue;
      const st = steps[0], hA = st.e.road.hAt; let s = st.dir > 0 ? st.e.lo + 22 : st.e.hi - 22;
      if (hA && hA(s) > 0.4) s = st.dir > 0 ? st.e.lo + 3 : st.e.hi - 3; // a marker on a ramp sits where it meets the ground
      const p = lanePose(st.e, st.dir, laneOff(st.e.type, 0), s);
      x = p.x; z = p.z; h = Math.atan2(p.tz, p.tx); y = st.e.road.hAt ? st.e.road.hAt(s) : 0;
    } else if (def.type === 'drift') { [x, z] = def.at; h = 0; }
    else { const sn = snapToRoad(def.at[0], def.at[1]), p = lanePose(sn.e, 1, laneOff(sn.e.type, 0), sn.s); x = p.x; z = p.z; h = Math.atan2(p.tz, p.tx); }
    const col = new THREE.Color(def.color);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m1 = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ map: ct, color: col.clone().multiplyScalar(1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const m2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    m2.position.y = 0.12; g.add(m1, m2); world.group.add(g);
    const tag = { el: null, msg: '', msgT: 0 }; ensureTagEl(tag, def.name); tag.el.classList.add('mk'); tag.nm.style.borderColor = def.color;
    const sub = el('span', 'mk-type', TYPE_LABEL[def.type]); sub.style.color = def.color; tag.el.insertBefore(sub, tag.nm);
    markers.push({ def, x, z, y, h, steps, group: g, tag });
  }
  // two checkpoint gates (the next one, and the one after)
  const gateTex = columnTex(), gg = new THREE.PlaneGeometry(22, 7); gg.translate(0, 3.5, 0);
  ev.gates = [0, 1].map((i) => { const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: gateTex, color: new THREE.Color(i ? '#ffb547' : '#ffffff').multiplyScalar(i ? 0.8 : 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; world.group.add(m); return m; });
}

/* ---- online 1v1: challenge another real driver (E), drag strip or street race ----
   Messages ride the room chat as MP_TAG + JSON, addressed with `to` (each transport exposes its own id), so no new
   database paths are needed. inv -> acc | dec | busy, then stg/go (drag tree), fin (finish time), quit. */
const MP_TAG = '\u0007mp', MP_LABEL = { drag: 'drag race', street: 'street race' };
const mp = { pick: null, inv: null, out: null, race: null };
const myNetId = () => (net.transport && net.transport.id) || '';
function mpSend(to, msg) { if (net.transport && net.inRoom) net.transport.chat(MP_TAG + JSON.stringify({ ...msg, to })); }
function mpInvite(m) {
  const p = net.players.get(mp.pick); mp.pick = null; if (!p) return;
  const n = Math.random().toString(36).slice(2, 7), data = {};
  if (m === 'street') {
    const sn = snapToRoad(roam.x, roam.z, roam.h); if (!sn) { showPop('Get on a road first', 'info'); return; }
    const from = endNodeOf({ e: sn.e, dir: sn.dir });
    const far = world.nodes.filter((q) => { const d = Math.hypot(q.x - roam.x, q.z - roam.z); return d > 700 && d < 1300 && q.z < 1000; });
    const to = far[Math.floor(Math.random() * far.length)]; if (!to || !routeBetween(from, to)) { showPop('No route from here, try another street', 'info'); return; }
    Object.assign(data, { e: world.edges.indexOf(sn.e), d: sn.dir, f: world.nodes.indexOf(to) });
  }
  mp.out = { to: p.id, name: p.name, m, n, data, until: roamT + 20 };
  mpSend(p.id, { k: 'inv', m, n, ...data });
}
function mpAccept() {
  const inv = mp.inv; mp.inv = null;
  if (!net.players.get(inv.from)) return;
  mpSend(inv.from, { k: 'acc', n: inv.n });
  mpBegin(inv.from, inv.m, inv.n, inv.data, 'guest');
}
function mpDecline(quiet) { const inv = mp.inv; mp.inv = null; if (inv) mpSend(inv.from, { k: 'dec', n: inv.n }); if (!quiet) showPop('Challenge declined', 'info'); }
function mpBegin(id, m, n, data, role) {
  const p = net.players.get(id); if (!p) return;
  mp.race = { id, m, n, role };
  if (m === 'street') {
    const e = world.edges[data.e], to = world.nodes[data.f]; if (!e || !to) return;
    const rest = routeBetween(endNodeOf({ e, dir: data.d }), to); if (!rest) return;
    startRaceEvent({ id: '1v1', type: 'sprint', name: '1v1 vs ' + p.name, color: p.color }, [{ e, dir: data.d }, ...rest], [], role === 'host' ? 0 : 1);
    ev.mp = { id, n, name: p.name, cp: 0, done: false };
    return;
  }
  // drag: leave the city but stay in the room, race on the strip, come back here afterwards
  const back = { x: roam.x, z: roam.z, h: roam.h };
  exitRoam(true);
  race.mpOpp = { id, n, role, name: p.name, color: p.color, look: p.look, x: 0, staged: false, meStaged: false, go: false, done: false, time: null };
  const keepMode = raceMode, keepTraffic = traffic;
  raceMode = 'mp'; traffic = false;
  startRace();
  raceMode = keepMode; traffic = keepTraffic;
  race.fromRoam = back;
}
function mpTryGo() {
  const o = race.mpOpp; if (!o || o.role !== 'host' || o.go || !o.meStaged || !o.staged) return;
  o.go = true; const d = 0.7 + Math.random() * 0.9;
  mpSend(o.id, { k: 'go', n: o.n, d });
  race.stageT = race.t; race.treeDelay = d; callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0);
}
function mpIn(from, json) {
  let m; try { m = JSON.parse(json); } catch (e) { return; }
  if (!m || m.to !== myNetId()) return;
  const p = net.players.get(from), name = p ? p.name : 'Driver';
  if (m.k === 'inv') {
    if (!roam.active || race.active || ev.active || mp.inv || mp.out || !MP_LABEL[m.m]) { mpSend(from, { k: 'busy', n: m.n }); return; }
    mp.inv = { from, name, m: m.m, n: m.n, data: { e: m.e, d: m.d, f: m.f }, until: roamT + 20 };
    showPop(name + ' wants a ' + MP_LABEL[m.m] + '!', 'info');
    return;
  }
  if (m.k === 'acc' && mp.out && mp.out.n === m.n && mp.out.to === from) { const o = mp.out; mp.out = null; mpBegin(from, o.m, o.n, o.data, 'host'); return; }
  if ((m.k === 'dec' || m.k === 'busy') && mp.out && mp.out.n === m.n) { showPop(name + (m.k === 'busy' ? ' is busy' : ' declined'), 'info'); mp.out = null; return; }
  if (m.k === 'inv' || !mp.race || mp.race.n !== m.n) { if (mp.inv && mp.inv.n === m.n && m.k === 'quit') mp.inv = null; return; }
  // messages for the race in progress
  const o = race.mpOpp && race.mpOpp.n === m.n ? race.mpOpp : null;
  if (o) {
    if (m.k === 'stg') { o.staged = true; mpTryGo(); }
    else if (m.k === 'go' && o.role === 'guest' && !o.go && race.phase === 'stage') { o.go = true; race.stageT = race.t; race.treeDelay = +m.d || 1; callout('STAGED · LAUNCH WITH E ON GREEN', 'ok', 0); }
    else if (m.k === 'fin') {
      o.done = true; o.time = +m.t >= 0 ? +m.t : null;
      if (race.phase === 'result') { // result already on screen (we jumped the light or crashed): fill in the rival's line
        for (const dt of $('result').querySelectorAll('dt')) if (dt.textContent === o.name + ' race time') dt.nextSibling.textContent = o.time != null ? o.time.toFixed(3) + ' s' : 'Did not finish';
      }
    }
    else if (m.k === 'quit') { o.done = true; o.left = true; o.time = null; if (!race.endT) callout(name.toUpperCase() + ' LEFT THE RACE', 'bad', 1500); }
    return;
  }
  const em = ev.mp && ev.mp.n === m.n ? ev.mp : null;
  if (em) {
    if (m.k === 'fin' && !em.done) {
      em.done = true; em.finT = +m.t; ev.finished.push({ name: em.name, t: +m.t });
      if (ev.phase === 'done' && ev.lastResult) { const [t, sub, rows] = ev.lastResult; rows.push([em.name, fmtT(+m.t)]); showResult(t, sub, rows); }
      else showPop(em.name + ' finished!', 'info');
    } else if (m.k === 'quit' && !em.done) { em.done = true; em.left = true; showPop(em.name + ' left the race', 'info'); }
  }
}

/* ---- event state ---- */
const ev = { active: null, phase: '', t: 0, cps: null, pts: null, next: 0, lap: 1, laps: 1, time: 0, racers: [], finished: [], score: 0, lastCp: null, gates: [], prompt: null };
function bestKey(id) { return 'raven-rs-ev-' + id; }
function placeAtCheckpoint(cp) {
  const sn = snapToRoad(cp.x, cp.z, Math.atan2(cp.tz, cp.tx)), p = lanePose(sn.e, sn.dir, laneOff(sn.e.type, 0), sn.s);
  Object.assign(roam, { x: p.x, z: p.z, h: Math.atan2(p.tz, p.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0 });
  attachAt(sn.e, sn.s); roam.camH = roam.h; deckUpdate();
}
function startRaceEvent(def, steps, rivals, mySlot = 0) {
  const loop = def.type === 'circuit', pts = routePolyline(steps);
  Object.assign(ev, { active: def, phase: 'count', t: 3.6, steps, pts, cps: checkpointsFrom(pts), next: 0, lap: 1, laps: def.laps || 1, time: 0, racers: rivals, finished: [], lastCp: null });
  roam.gps = null; roam.wp = null; roam.gpsR = null;
  // starting grid on the first edge of the route
  const st = steps[0], e = st.e, two = LANES_DIR[e.type] === 2, base = st.dir > 0 ? e.lo + 6 : e.hi - 6;
  const span = e.hi - e.lo - 12, slots = two ? [[16, 0], [16, 1], [6, 0], [6, 1]] : [[22, 0], [14, 0], [6, 0], [-2, 0]];
  const sAt = (o) => base + st.dir * clamp(o, 0, span);
  const p0 = lanePose(e, st.dir, laneOff(e.type, slots[mySlot][1]), sAt(slots[mySlot][0]));
  Object.assign(roam, { x: p0.x, z: p0.z, h: Math.atan2(p0.tz, p0.tx), vx: 0, vz: 0, vf: 0, vl: 0, yr: 0, gear: 1, steer: 0, nos: 1 });
  attachAt(e, sAt(slots[mySlot][0])); roam.camH = roam.h; deckUpdate();
  ev.mp = null;
  rivals.forEach((c, i) => {
    const [o, lane] = slots[i + 1 + mySlot] || slots[slots.length - 1];
    Object.assign(c, { racing: true, route: steps, loop, ri: 0, raceMult: 1.32, cp: 0, lap: 1, done: false, hitT: 0, ghostT: 0 });
    placeOnEdge(c, e, st.dir, sAt(o), lane, 0); c.v = 0;
    const np = net.players.get(c.id); if (np) np.buf = [];
  });
  markers.forEach((m) => { m.group.visible = false; });
  $('roEvent').hidden = false; $('roResult').hidden = true;
}
function startDrift(def) {
  Object.assign(ev, { active: def, phase: 'count', t: 3.6, steps: null, pts: null, cps: null, racers: [], score: 0, time: 0 });
  markers.forEach((m) => { m.group.visible = false; });
  $('roEvent').hidden = false; $('roResult').hidden = true;
}
function challengeBot(c) {
  const p = net.players.get(c.id), sn = snapToRoad(roam.x, roam.z, roam.h);
  if (!sn) return;
  // a finish line 700-1300 m away, on the far side of town
  const from = endNodeOf({ e: sn.e, dir: sn.dir });
  const far = world.nodes.filter((n) => { const d = Math.hypot(n.x - roam.x, n.z - roam.z); return d > 700 && d < 1300 && n.z < 1000; });
  const to = far[Math.floor(Math.random() * far.length)]; if (!to) return;
  const rest = routeBetween(from, to); if (!rest) return;
  botSay(c.id, ['You’re on. First to the finish.', 'Let’s see what that build can do.', 'Loser buys the coffee.'][Math.floor(Math.random() * 3)]);
  startRaceEvent({ id: '1v1', type: 'sprint', name: '1v1 vs ' + p.name, color: p.color }, [{ e: sn.e, dir: sn.dir }, ...rest], [c]);
}
function interact() {
  if (mp.inv) { mpAccept(); return; }
  if (ev.active) return;
  const pr = ev.prompt; if (!pr) return;
  if (pr.marker && pr.marker.def.type === 'hospital') { if (!amb.call) ambShift(!amb.on); return; }
  if (amb.call) { showPop('Finish the emergency call first', 'info'); return; }
  if (pr.player) { mp.pick = pr.player.id; return; }
  if (pr.bot) { challengeBot(pr.bot); return; }
  const def = pr.marker.def;
  if (def.type === 'sprint' || def.type === 'circuit') {
    const rivals = veh.filter((c) => c.bot).sort(() => Math.random() - 0.5).slice(0, 3);
    startRaceEvent(def, pr.marker.steps, rivals);
  } else if (def.type === 'drift') startDrift(def);
  else if (def.type === 'garage') { roam.spawn = { x: pr.marker.x, z: pr.marker.z, h: pr.marker.h }; exitRoam(); say('Tune your car, then Free roam brings you back to this garage.'); }
  else if (def.type === 'drag') {
    const back = { x: pr.marker.x, z: pr.marker.z, h: pr.marker.h };
    exitRoam();
    if (raceMode === 'challenge' && !challenge) raceMode = 'quick';
    startRace(); race.fromRoam = back;
  }
}
function endEvent(silent) {
  if (!ev.active) return;
  if (ev.mp) { if (!ev.mp.meDone) mpSend(ev.mp.id, { k: 'quit', n: ev.mp.n }); ev.mp = null; mp.race = null; }
  for (const c of ev.racers) { c.racing = false; c.route = null; c.loop = false; c.raceMult = 1; if (c.e) c.vBase = roadSpeed(c.e.type, true) * c.mult; }
  ev.active = null; ev.phase = ''; ev.cps = null; ev.pts = null; ev.racers = [];
  ev.gates.forEach((g) => { g.visible = false; });
  markers.forEach((m) => { m.group.visible = true; });
  $('roEvent').hidden = true; $('roCount').textContent = '';
  if (silent) $('roResult').hidden = true;
}
function closeResult() { ev.phase = ''; $('roResult').hidden = true; endEvent(true); }
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(2); };
function showResult(title, sub, rows) {
  const r = $('roResult'); r.replaceChildren();
  r.append(el('h2', '', title), el('p', 'sub', sub));
  const dl = el('dl'); for (const [k, v] of rows) dl.append(el('dt', '', k), el('dd', '', v)); r.append(dl);
  const b = el('button', 'btn primary'); b.type = 'button'; b.append(el('span', '', 'Continue (Enter)')); b.onclick = closeResult; r.append(b);
  r.hidden = false; ev.phase = 'done';
}
function progressOf(cpIdx, lap, x, z) {
  const n = ev.cps.length, cp = ev.cps[Math.min(cpIdx, n - 1)];
  return (lap - 1) * n + cpIdx - (cpIdx < n ? Math.hypot(cp.x - x, cp.z - z) / 3000 : 0);
}
function eventFrame(dt) {
  if (!ev.active) { ev.gates.forEach((g) => { g.visible = false; }); return; }
  const R = roam, def = ev.active;
  if (ev.phase === 'count') {
    ev.t -= dt; const n = Math.ceil(ev.t - 0.6);
    $('roCount').textContent = ev.t > 0.6 ? String(n) : 'GO!';
    if (ev.t <= 0.6 && ev.phase === 'count') { ev.phase = 'run'; setTimeout(() => { if ($('roCount').textContent === 'GO!') $('roCount').textContent = ''; }, 700); }
    if (ev.phase === 'count') { renderEventHud(); return; }
  }
  if (ev.phase !== 'run') { renderEventHud(); return; }
  ev.time += dt;
  if (def.type === 'drift') {
    ev.t = Math.max(0, def.time - ev.time);
    if (ev.t <= 0) {
      bankDrift(); const best = +store.get(bestKey(def.id), '0') || 0, score = Math.round(ev.score);
      if (score > best) store.set(bestKey(def.id), String(score));
      showResult(score > best && best ? 'NEW BEST!' : 'TIME!', def.name, [['Score', score.toLocaleString()], ['Best', Math.max(score, best).toLocaleString()]]);
    }
    renderEventHud(); return;
  }
  // checkpoints: the player
  const cps = ev.cps, N = cps.length;
  const cp = cps[ev.next];
  if (cp && Math.hypot(cp.x - R.x, cp.z - R.z) < 15 && Math.abs(cp.y - R.y) < 4) {
    ev.lastCp = cp; ev.next++;
    if (ev.next >= N) { if (ev.lap < ev.laps) { ev.lap++; ev.next = 0; showPop('LAP ' + ev.lap + ' / ' + ev.laps, 'info'); } else finishPlayer(); }
  }
  // rivals: same gates; rubber band so the race stays close
  const me = progressOf(ev.next, ev.lap, R.x, R.z);
  for (const c of ev.racers) {
    if (c.done) continue;
    const k = ev.cps[c.cp]; if (k && Math.hypot(k.x - c.x, k.z - c.z) < 18) { c.cp++; if (c.cp >= N) { if (c.lap < ev.laps) { c.lap++; c.cp = 0; } else { c.done = true; ev.finished.push({ name: net.players.get(c.id).name, t: ev.time }); c.racing = false; c.route = null; c.raceMult = 1; } } }
    const pr = progressOf(c.cp, c.lap, c.x, c.z), lead = pr - me;
    c.raceMult = lead > 1.5 ? 1.12 : lead < -1.5 ? 1.5 : 1.32;
    if (c.e && c.mode === 'edge') c.vBase = roadSpeed(c.e.type, true) * c.mult * c.raceMult;
  }
  // online rival: follow its interpolated car through the same gates (only for the HUD; its finish time comes by message)
  if (ev.mp && !ev.mp.done) {
    const op = net.players.get(ev.mp.id);
    if (!op) { ev.mp.done = true; ev.mp.left = true; showPop(ev.mp.name + ' left the race', 'info'); }
    else if (op.x !== undefined) { const k = cps[ev.mp.cp]; if (k && Math.hypot(k.x - op.x, k.z - op.z) < 18) ev.mp.cp = Math.min(N, ev.mp.cp + 1); }
  }
  // gates
  ev.gates.forEach((g, i) => {
    const k = cps[ev.next + i] || (ev.lap < ev.laps ? cps[ev.next + i - N] : null);
    g.visible = !!k && ev.phase === 'run'; if (!k) return;
    g.position.set(k.x, k.y, k.z); g.rotation.y = Math.atan2(k.tx, k.tz);
  });
  renderEventHud();
}
function finishPlayer() {
  const def = ev.active, place = 1 + ev.finished.length, n = ev.racers.length + 1 + (ev.mp ? 1 : 0), key = bestKey(def.id);
  if (ev.mp) { ev.mp.meDone = true; mpSend(ev.mp.id, { k: 'fin', n: ev.mp.n, t: +ev.time.toFixed(3) }); }
  const best = +store.get(key, '0') || 0, t = ev.time;
  if (def.id !== '1v1' && (!best || t < best)) store.set(key, t.toFixed(3));
  const ord = ['1ST', '2ND', '3RD', '4TH'][place - 1];
  const rows = [['Time', fmtT(t)]];
  if (def.id !== '1v1') rows.push(['Best', fmtT(best && best < t ? best : t)]);
  ev.finished.forEach((f, i) => rows.push([(i + 1) + '. ' + f.name, fmtT(f.t)]));
  if (ev.mp && !ev.mp.done) rows.push([ev.mp.name, 'still racing…']);
  showResult(place === 1 ? 'YOU WIN · ' + ord : ord + ' OF ' + n, def.name, rows);
  ev.lastResult = [place === 1 ? 'YOU WIN · ' + ord : ord + ' OF ' + n, def.name, rows.filter((r) => r[1] !== 'still racing…')];
  if (place === 1) addStyle(1000, 'RACE WIN');
  for (const c of ev.racers) { c.racing = false; c.route = null; c.raceMult = 1; }
  ev.gates.forEach((g) => { g.visible = false; });
}
function renderEventHud() {
  const def = ev.active, box = $('roEvent'); if (!def) return;
  let parts;
  if (def.type === 'drift') parts = [def.name.toUpperCase(), 'SCORE ' + Math.round(ev.score).toLocaleString(), 'TIME ' + (ev.phase === 'count' ? def.time : Math.ceil(ev.t))];
  else {
    const R = roam, me = progressOf(ev.next, ev.lap, R.x, R.z);
    let pos = 1 + ev.racers.filter((c) => c.done || progressOf(c.cp, c.lap, c.x, c.z) > me).length;
    const op = ev.mp && net.players.get(ev.mp.id);
    if (ev.mp && !ev.mp.left && (ev.mp.finT !== undefined || (op && op.x !== undefined && progressOf(ev.mp.cp, 1, op.x, op.z) > me))) pos++;
    parts = [def.name.toUpperCase(), 'POS ' + pos + '/' + (ev.racers.length + 1 + (ev.mp ? 1 : 0))];
    if (ev.laps > 1) parts.push('LAP ' + ev.lap + '/' + ev.laps);
    parts.push('CP ' + Math.min(ev.next, ev.cps.length) + '/' + ev.cps.length, fmtT(ev.time));
  }
  const txt = parts.join('   ·   '); if (box.textContent !== txt) box.textContent = txt;
}
// HUD: prompts near markers and drivers, the GPS arrow, marker labels
function markerHud(dt) {
  const R = roam, sp = Math.abs(R.vf);
  let pr = null;
  if (!ev.active) {
    for (const m of markers) {
      const d = Math.hypot(m.x - R.x, m.z - R.z);
      placeTag(m.tag, m.x, m.y + 6, m.z, 320);
      if (d < 8 && Math.abs(m.y - R.y) < 3 && sp < 9) pr = { marker: m, text: m.def.type === 'hospital' ? (amb.on ? (amb.call ? (amb.call.phase === 'back' ? 'Patient on board: stop at the entrance' : 'On a call: the GPS leads to the patient') : 'End ambulance shift · ' + livesTxt()) : 'Start ambulance shift: answer emergency calls') : TYPE_LABEL[m.def.type] + ': ' + m.def.name + (m.def.type === 'sprint' || m.def.type === 'circuit' ? ' · 3 rivals' : '') };
    }
    if (!pr && sp < 14) for (const p of net.players.values()) if (p.remote && p.rig && p.rig.visible && p.x !== undefined && Math.hypot(p.x - R.x, p.z - R.z) < 16 && Math.abs((p.y || 0) - R.y) < 3) { pr = { player: p, text: 'Challenge ' + p.name + ' · drag or street race' }; break; }
    if (!pr && sp < 14) for (const c of veh) if (c.bot && !c.racing && Math.hypot(c.x - R.x, c.z - R.z) < 16 && Math.abs((c.y || 0) - R.y) < 3) { pr = { bot: c, text: 'Challenge ' + net.players.get(c.id).name + ' to a 1v1 sprint' }; break; }
  } else for (const m of markers) m.tag.el.style.display = 'none';
  // online challenges override the normal prompt
  if (mp.inv && roamT > mp.inv.until) mpDecline(true);
  if (mp.out && roamT > mp.out.until) { showPop('No answer from ' + mp.out.name, 'info'); mp.out = null; }
  if (mp.pick) { const op = net.players.get(mp.pick); if (!op || op.x === undefined || Math.hypot(op.x - R.x, op.z - R.z) > 30 || ev.active) mp.pick = null; }
  let raw = null;
  if (mp.inv) pr = { text: 'Accept ' + mp.inv.name + '’s ' + MP_LABEL[mp.inv.m] + '  ·  X decline' };
  else if (mp.pick) { pr = null; raw = 'pick'; }
  else if (mp.out) { pr = null; raw = 'Waiting for ' + mp.out.name + ' to accept your ' + MP_LABEL[mp.out.m] + '…'; }
  ev.prompt = pr;
  const pe = $('roPrompt');
  if (raw === 'pick') {
    if (pe.dataset.mode !== 'pick') {
      pe.dataset.mode = 'pick'; pe.replaceChildren(); pe.style.pointerEvents = 'auto';
      const b = (label, fn) => { const x = el('button', 'btn'); x.type = 'button'; x.textContent = label; x.style.marginLeft = '10px'; x.onclick = fn; return x; };
      pe.append(document.createTextNode('Race ' + (net.players.get(mp.pick) || {}).name + ':'), b('1 · Drag', () => mpInvite('drag')), b('2 · Street race', () => mpInvite('street')), b('X · Cancel', () => { mp.pick = null; }));
    }
    pe.hidden = false;
  } else {
    if (pe.dataset.mode) { pe.dataset.mode = ''; pe.style.pointerEvents = ''; }
    const t = raw || (pr ? 'E  ·  ' + pr.text : '');
    if (t) { if (pe.textContent !== t) pe.textContent = t; pe.hidden = false; } else pe.hidden = true;
  }
  // arrow toward the next checkpoint or along the GPS route
  let tgt = null, dist = 0;
  if (ev.active && ev.cps && ev.cps[ev.next]) { tgt = ev.cps[ev.next]; dist = Math.hypot(tgt.x - R.x, tgt.z - R.z); }
  let label = null;
  const km = (m) => (m > 999 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');
  if (!(ev.active && ev.cps) && roam.gps && roam.wp) {
    const r = gpsTrack(dt);
    if (!r) { roam.gps = null; roam.wp = null; roam.gpsR = null; showPop('ARRIVED', 'info'); }
    else {
      tgt = r.tgt; dist = r.left;
      label = r.uturn ? 'TURN AROUND · ' + km(dist) : r.turn && r.turn.d < 250 ? (r.turn.right ? '↱ ' : '↰ ') + (r.turn.sharp ? 'SHARP ' : '') + (r.turn.right ? 'RIGHT' : 'LEFT') + ' ' + Math.round(r.turn.d / 10) * 10 + ' m · ' + km(dist) : km(dist);
    }
  }
  const ar = $('roArrow');
  if (tgt) { const a = Math.atan2(tgt.z - R.z, tgt.x - R.x) - R.h; ar.hidden = false; ar.firstChild.style.transform = `rotate(${(a * 180 / Math.PI + 90).toFixed(1)}deg)`; const t = label || km(dist); if ($('roDist').textContent !== t) $('roDist').textContent = t; }
  else ar.hidden = true;
}

/* ---- full map and GPS ---- */
/* ---- GPS ----
   The route starts on the lane the car is actually on, in the direction it is driving (a U-turn costs extra, so the
   GPS only says "turn around" when that is really shorter), and ends at the point of the road nearest the target,
   not at the nearest crossing. While driving, progress is tracked along the route itself, the arrow looks a speed-
   dependent distance ahead, the next turn is announced, and the route is rebuilt when the car leaves it or drives
   the wrong way along it. */
const GPS_UTURN = 160; // metres of detour a U-turn is "worth"
const edgeW = (e) => (e.s1 - e.s0) * (e.type === 'street' ? 1.25 : 1);
// ban: an edge not to use (the one the car is on: turning back along it is the U-turn option, priced separately)
function dijkstraFrom(src, ban) {
  const N = world.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Array(N).fill(null), done = new Uint8Array(N);
  dist[src.id] = 0;
  for (;;) {
    let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0) break; done[u] = 1;
    const n = world.nodes[u];
    for (const e of n.edges) { if (e === ban) continue; const o = e.a === n ? e.b : e.a, w = dist[u] + edgeW(e); if (w < dist[o.id]) { dist[o.id] = w; prev[o.id] = { e, dir: e.a === n ? 1 : -1, from: u }; } }
  }
  return { dist, prev };
}
const stepsTo = (D, src, dst) => { const out = []; let cur = dst.id; while (cur !== src.id) { const p = D.prev[cur]; if (!p) return null; out.unshift({ e: p.e, dir: p.dir }); cur = p.from; } return out; };
// nearest point on any edge; y (when given) keeps the car on the deck or the street it is really on
function gpsSnap(x, z, y) {
  let best = null, bd = Infinity;
  for (const e of world.edges) for (let s = e.s0 + 2; s <= e.s1 - 2; s += 6) {
    const p = rPoint(e.road, s), hy = e.road.hAt ? e.road.hAt(s) : 0;
    if (y !== undefined && Math.abs(hy - y) > 4) continue;
    const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { e, s, p }; }
  }
  if (!best && y !== undefined) return gpsSnap(x, z);
  return best;
}
// points along one edge from s=a to s=b
function edgePts(e, a, b) {
  const pts = [], n = Math.max(1, Math.ceil(Math.abs(b - a) / 15));
  for (let i = 0; i <= n; i++) { const sv = a + (b - a) * i / n, p = rPoint(e.road, sv); pts.push([p.x, p.z, e.road.hAt ? e.road.hAt(sv) : 0]); }
  return pts;
}
function gpsBuild(x, z, h, y, tx, tz) {
  const A = gpsSnap(x, z, y), B = gpsSnap(tx, tz); if (!A || !B) return null;
  const fwd = Math.cos(h) * A.p.tx + Math.sin(h) * A.p.tz >= 0 ? 1 : -1;
  // leaving the current edge: ahead (to its forward end) or after a U-turn (to the end behind)
  const exits = [fwd, -fwd].map((d) => ({ d, node: d > 0 ? A.e.b : A.e.a, cost: (d > 0 ? A.e.s1 - A.s : A.s - A.e.s0) + (d === fwd ? 0 : GPS_UTURN) }));
  // reaching the target edge from either of its ends
  const ins = [{ node: B.e.a, d: 1, cost: B.s - B.e.s0 }, { node: B.e.b, d: -1, cost: B.e.s1 - B.s }];
  let best = null;
  // same edge, target ahead: straight along it
  // same edge: straight to it, or turn around if it is behind
  if (A.e === B.e) best = (B.s - A.s) * fwd >= 0 ? { cost: Math.abs(B.s - A.s), pts: edgePts(A.e, A.s, B.s) } : { cost: Math.abs(B.s - A.s) + GPS_UTURN, uturn: true, pts: edgePts(A.e, A.s, B.s) };
  for (const ex of exits) {
    const D = dijkstraFrom(ex.node, A.e);
    for (const en of ins) {
      const c = ex.cost + D.dist[en.node.id] + en.cost; if (!(c < (best ? best.cost : Infinity))) continue;
      const steps = ex.node === en.node ? [] : stepsTo(D, ex.node, en.node); if (!steps) continue;
      best = { cost: c, uturn: ex.d !== fwd, pts: [...edgePts(A.e, A.s, ex.d > 0 ? A.e.s1 : A.e.s0), ...routePolyline(steps), ...edgePts(B.e, en.d > 0 ? B.e.s0 : B.e.s1, B.s)] };
    }
  }
  if (!best) return null;
  const pts = [[x, z, y || 0], ...best.pts, [tx, tz, 0]].filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
  // cumulative distance along the route, and the turns on it (heading change over ~20 m either side of a point)
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (L) => gpsPointAt({ pts, cum }, L), turns = [];
  for (let L = 25; L < cum[cum.length - 1] - 10; L += 5) {
    const a = at(L - 20), m = at(L), b = at(L + 20), ax = m[0] - a[0], az = m[1] - a[1], bx = b[0] - m[0], bz = b[1] - m[1];
    const ang = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    if (Math.abs(ang) > 0.6) { const last = turns[turns.length - 1]; if (last && L - last.L < 35) { if (Math.abs(ang) > Math.abs(last.ang)) Object.assign(last, { L, ang }); } else turns.push({ L, ang }); }
  }
  return { pts, cum, turns, uturn: !!best.uturn, idx: 0, along: 0, offT: 0, wrongT: 0 };
}
// the point a given distance along the route
function gpsPointAt(g, L) {
  const { pts, cum } = g; L = clamp(L, 0, cum[cum.length - 1]);
  let i = 1; while (i < cum.length - 1 && cum[i] < L) i++;
  const k = (L - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
}
function setWaypoint(x, z, quiet) {
  const R = roam, r = gpsBuild(R.x, R.z, R.h, R.y, x, z);
  roam.wp = { x, z }; roam.gpsT = roamT; roam.gpsR = r;
  roam.gps = r ? r.pts : [[R.x, R.z, 0], [x, z, 0]];
  if (!quiet) showPop(r && r.uturn ? 'GPS SET · TURN AROUND' : 'GPS SET', 'info');
}
// keep track of where the car is on the route; returns { tgt, left, turn } or null when arrived
function gpsTrack(dt) {
  const R = roam, g = roam.gpsR;
  if (!g) { const d = Math.hypot(roam.wp.x - R.x, roam.wp.z - R.z); return d < 25 ? null : { tgt: roam.wp, left: d }; }
  const { pts, cum } = g;
  // project the car on segments around the last known position (never jump far ahead to a crossing of the route)
  let bi = g.idx, bd = Infinity, bl = g.along;
  for (let i = Math.max(1, g.idx - 3); i < Math.min(pts.length, g.idx + 25); i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((R.x - x0) * dx + (R.z - z0) * dz) / L2, 0, 1), d = Math.hypot(R.x - x0 - dx * t, R.z - z0 - dz * t);
    if (d < bd) { bd = d; bi = i; bl = cum[i - 1] + Math.sqrt(L2) * t; }
  }
  g.idx = bi; g.along = Math.max(g.along - 10, bl);
  const total = cum[cum.length - 1], left = total - g.along;
  if (left < 20 || Math.hypot(roam.wp.x - R.x, roam.wp.z - R.z) < 18) return null;
  // off the route, or driving the wrong way along it: rebuild (at most every 2 s)
  const sx = pts[bi][0] - pts[bi - 1][0], sz = pts[bi][1] - pts[bi - 1][1], sl = Math.hypot(sx, sz) || 1;
  const along = (R.vx * sx + R.vz * sz) / sl;
  g.offT = bd > 16 ? g.offT + dt : 0;
  g.wrongT = along < -4 ? g.wrongT + dt : Math.max(0, g.wrongT - dt);
  if ((g.offT > 1 || g.wrongT > 1.5) && roamT - (roam.gpsT || 0) > 2) { setWaypoint(roam.wp.x, roam.wp.z, true); return gpsTrack(0); }
  // look further ahead the faster the car goes
  const sp = Math.hypot(R.vx, R.vz), p = gpsPointAt(g, g.along + clamp(18 + sp * 1.1, 18, 70));
  const nt = g.turns.find((t) => t.L > g.along + 4);
  return { tgt: { x: p[0], z: p[1] }, left, turn: nt && nt.L - g.along < 400 ? { d: nt.L - g.along, right: nt.ang > 0, sharp: Math.abs(nt.ang) > 2.4 } : null, uturn: g.uturn && g.along < 30 };
}
function setMap(on) {
  roam.mapOpen = on; $('bigmap').hidden = !on;
  for (const k in roam.keys) roam.keys[k] = false;
  if (on) drawBigMap();
}
function drawBigMap() {
  const cv = $('bigmapC'), g = cv.getContext('2d'), W = cv.width, H = cv.height, sc = W / 2000;
  g.drawImage(world.map, 0, 0, W, H);
  const P = (x, z) => [(x + 1000) * sc, (z + 1000) * sc];
  const gr = roam.gpsR ? [[roam.x, roam.z, 0], ...roam.gpsR.pts.slice(roam.gpsR.idx)] : roam.gps;
  if (gr) { g.strokeStyle = '#ff5fa8'; g.lineWidth = 4; g.beginPath(); gr.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
  g.font = '600 13px "Inter", sans-serif'; g.textBaseline = 'middle';
  for (const m of markers) {
    const [a, b] = P(m.x, m.z); g.fillStyle = m.def.color; g.beginPath(); g.arc(a, b, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = a > W - 160 ? 'right' : 'left'; g.fillText(m.def.name, a + (a > W - 160 ? -11 : 11), b);
  }
  for (const p of net.players.values()) if (p.x !== undefined) { const [a, b] = P(p.x, p.z); g.fillStyle = p.color; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  if (roam.wp) { const [a, b] = P(roam.wp.x, roam.wp.z); g.strokeStyle = '#ff5fa8'; g.lineWidth = 3; g.beginPath(); g.arc(a, b, 10, 0, Math.PI * 2); g.stroke(); }
  const [px, pz] = P(roam.x, roam.z); g.save(); g.translate(px, pz); g.rotate(roam.h + Math.PI / 2);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
}
$('bigmapC').addEventListener('click', (e) => {
  const cv = $('bigmapC'), r = cv.getBoundingClientRect(), sc = cv.width / 2000;
  const x = (e.clientX - r.left) * cv.width / r.width / sc - 1000, z = (e.clientY - r.top) * cv.height / r.height / sc - 1000;
  setWaypoint(x, z); drawBigMap();
});
$('bigmapC').addEventListener('contextmenu', (e) => { e.preventDefault(); roam.gps = null; roam.wp = null; roam.gpsR = null; drawBigMap(); });

/* ---- ambulance job: speed used to save lives ----
   Start a shift at the hospital marker. Calls come in at random times; the GPS leads to the patient, you stop to pick
   them up, then bring them back to the hospital. The patient's condition drops with time, and every hit, hard brake
   or violent turn hurts them too, so the job is fast but smooth. Each call ends with a real first-aid lesson. */
const AMB_CALLS = [
  ['Chest pain', 'Heart attack signs: pain or pressure in the chest that can spread to an arm, the jaw or the back, with sweating or shortness of breath. Call 103 at once and keep the person seated, calm and still.'],
  ['Someone collapsed', 'If a person does not respond and is not breathing normally, call 103 and start CPR: push hard and fast in the centre of the chest, 100 to 120 times a minute, until help arrives.'],
  ['Choking at a cafe', 'An adult who is choking and cannot speak: give up to 5 firm back blows between the shoulder blades, then up to 5 abdominal thrusts. Repeat, and call 103 if it does not clear.'],
  ['Stroke signs', 'Think FAST: Face drooping, Arm weakness, Speech slurred, Time to call 103. Note the time the signs started: doctors need it.'],
  ['Kitchen burn', 'Cool a burn under cool running water for 20 minutes. No ice, butter or toothpaste. Cover it loosely with cling film or a clean plastic bag.'],
  ['Elderly woman fell', 'After a fall, do not pull the person up quickly. Ask where it hurts, check for bleeding, keep them warm and call 103 if they are hurt or cannot get up.'],
  ['Road accident', 'At a crash: put your hazard lights and a warning triangle out, call 103 and 102, and do not move an injured person unless there is a danger such as fire.'],
  ['Heavy bleeding', 'Press firmly on the wound with a clean cloth and keep pressing without lifting it to look. Call 103. If blood soaks through, add another cloth on top.'],
  ['Breathing trouble', 'Help the person sit upright, loosen tight clothing, and help them use their own inhaler if they have one. Call 103 if breathing does not get easier.'],
  ['Child with high fever', 'A very high fever with a stiff neck, a rash that does not fade when pressed, or unusual drowsiness needs urgent help: call 103.']
];
const amb = { on: false, call: null, nextT: 0, saved: +store.get('amb-saved', '0') || 0, bar: null, pin: null, siren: null, sirenT: 0, hud: false };
const livesTxt = () => amb.saved + (amb.saved === 1 ? ' life' : ' lives') + ' saved';
const ambHospital = () => markers.find((m) => m.def.type === 'hospital');
function ambShift(on, quiet) {
  if (on === amb.on) return;
  amb.on = on;
  if (on) {
    amb.nextT = 6 + Math.random() * 10;
    // a light bar on the roof of whatever car you drive
    const pos = carRig.position.clone(), rot = carRig.rotation.clone();
    carRig.position.set(0, 0, 0); carRig.rotation.set(0, 0, 0); carRig.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(carRig); carRig.position.copy(pos); carRig.rotation.copy(rot);
    const bar = new THREE.Group(), bx = new THREE.BoxGeometry(0.22, 0.12, 0.42);
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.04, 0.05) }), blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.04, 0.1, 0.5) });
    const r = new THREE.Mesh(bx, red), b = new THREE.Mesh(bx, blue); r.position.z = 0.24; b.position.z = -0.24;
    bar.add(r, b); bar.position.set((bb.min.x + bb.max.x) / 2 - 0.1, bb.max.y + 0.04, 0); carRig.add(bar);
    amb.bar = { g: bar, red, blue };
    if (!amb.pin) { // the patient's location: a red column like the event markers
      const geo = new THREE.CylinderGeometry(2.6, 2.6, 30, 24, 1, true); geo.translate(0, 15, 0);
      amb.pin = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: columnTex(), color: new THREE.Color('#ff3040').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    }
    world.group.add(amb.pin); amb.pin.visible = false;
    if (!quiet) showPop('SHIFT STARTED · WAIT FOR A CALL', 'info');
  } else {
    if (amb.call) ambClose();
    if (amb.bar) { carRig.remove(amb.bar.g); amb.bar.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); amb.bar = null; }
    if (amb.pin) amb.pin.visible = false;
    sirenOff();
    if (amb.hud && !ev.active) $('roEvent').hidden = true; amb.hud = false;
    if (!quiet) showPop('SHIFT ENDED · ' + livesTxt().toUpperCase(), 'info');
  }
}
function sirenOn() {
  if (amb.siren || !audio) return;
  try { const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(); o.type = 'triangle'; o.frequency.value = 700; g.gain.value = 0.035; o.connect(g); g.connect(audio.fx); o.start(); amb.siren = { o, g }; } catch (e) { /* audio is optional */ }
}
function sirenOff() { if (!amb.siren) return; try { amb.siren.o.stop(); amb.siren.g.disconnect(); } catch (e) { /* already stopped */ } amb.siren = null; }
function ambNewCall() {
  const R = roam;
  const ok = world.nodes.filter((n) => { const d = Math.hypot(n.x - R.x, n.z - R.z); return d > 350 && d < 1100 && n.z < 620 && ![...n.roads].some((r) => r.type === 'highway' || r.hAt || r.isBridge || r.sky); });
  const n = ok[Math.floor(Math.random() * ok.length)]; if (!n) { amb.nextT = 5; return; }
  const [name, tip] = AMB_CALLS[Math.floor(Math.random() * AMB_CALLS.length)], dist = Math.hypot(n.x - R.x, n.z - R.z) * 1.3;
  amb.call = { name, tip, x: n.x, z: n.z, phase: 'go', cond: 100, t: 0, resp: 0, loadT: 0, hitT: 0 };
  ambLeg(amb.call, dist, 2); // waiting patients get worse slowly
  amb.pin.position.set(n.x, 0, n.z); amb.pin.visible = true;
  setWaypoint(n.x, n.z, true); sirenOn();
  showPop('EMERGENCY CALL · ' + name.toUpperCase(), 'bad');
}
// a hit hurts the patient: harder hits hurt more
function ambBump(sev) {
  const c = amb.call; if (!c || c.phase !== 'back' || roamT - c.hitT < 0.6) return; // one crash counts once
  c.hitT = roamT;
  c.cond = Math.max(0, c.cond - Math.min(12, 2 + sev * 0.5));
  showPop('CAREFUL · PATIENT HURT', 'bad');
}
// give a leg of the trip a time budget: about 3 times the time at a calm 43 km/h, plus 75 s; the condition runs out with it
function ambLeg(c, dist, slow = 1) { c.legT = 0; c.budget = (dist / 12) * 3 + 75; c.rate = 100 / (c.budget * slow); }
function ambClose() { amb.call = null; roam.gps = null; roam.wp = null; roam.gpsR = null; if (amb.pin) amb.pin.visible = false; sirenOff(); amb.nextT = 20 + Math.random() * 40; }
function ambFinish(ok) {
  const c = amb.call, rows = [['Patient', c.name], ['Response time', fmtT(c.resp)], ['Trip to hospital', fmtT(c.t - c.resp)], ['Condition', Math.round(c.cond) + ' %']];
  if (ok) { amb.saved++; store.set('amb-saved', String(amb.saved)); }
  rows.push(['Lives saved', String(amb.saved)], ['First aid', c.tip]);
  showResult(ok ? 'PATIENT SAVED' : 'TOO LATE', ok ? 'You got them there in time. Fast, but smooth: that is the job.' : 'Every second and every bump mattered. Next call, drive fast but smooth.', rows);
  ambClose();
}
function ambFrame(dt) {
  if (!amb.on) return;
  const R = roam, c = amb.call, sp = Math.hypot(R.vx, R.vz);
  // lights and two-tone siren while answering a call
  amb.sirenT += dt;
  const ph = Math.floor(amb.sirenT * 3) % 2;
  if (amb.bar) { amb.bar.red.color.setRGB(c && ph ? 3 : 0.5, c && ph ? 0.2 : 0.04, 0.05); amb.bar.blue.color.setRGB(0.04, 0.1, c && !ph ? 3 : 0.5); }
  if (amb.siren && audio) amb.siren.o.frequency.setTargetAtTime(Math.floor(amb.sirenT / 0.6) % 2 ? 960 : 700, audio.ctx.currentTime, 0.02);
  if (amb.pin && amb.pin.visible) amb.pin.material.opacity = 0.7 + Math.sin(roamT * 6) * 0.3;
  if (!c) {
    if (!ev.active && ev.phase !== 'done') { amb.nextT -= dt; if (amb.nextT <= 0) ambNewCall(); }
  } else {
    c.t += dt;
    const back = c.phase === 'back', hosp = ambHospital(), tx = back ? hosp.x : c.x, tz = back ? hosp.z : c.z, d = Math.hypot(tx - R.x, tz - R.z);
    // the patient gets worse while waiting and while riding; rough driving makes it faster
    c.legT += dt; c.cond -= dt * c.rate;
    // only truly rough driving hurts the patient: sliding or a violent swerve (normal braking is fine)
    if (back && ((R.drift && R.slipA > 0.2) || Math.abs(R.lat) > G * 1.15)) c.cond -= dt * 4;
    if (c.phase === 'go' && d < 14 && sp < 3) { c.phase = 'load'; c.loadT = 2.5; c.resp = c.t; showPop('LOADING PATIENT…', 'info'); }
    else if (c.phase === 'load') {
      if (sp > 4) { c.phase = 'go'; showPop('STOP TO LOAD THE PATIENT', 'bad'); }
      else if ((c.loadT -= dt) <= 0) { c.phase = 'back'; ambLeg(c, Math.hypot(hosp.x - R.x, hosp.z - R.z) * 1.3); amb.pin.visible = false; setWaypoint(hosp.x, hosp.z, true); showPop('PATIENT ON BOARD · TO THE HOSPITAL', 'info'); }
    } else if (back && d < 16 && sp < 3) { ambFinish(true); return; }
    if (c.cond <= 0) { c.cond = 0; ambFinish(false); return; }
  }
  // HUD line, shared with events (events take it over while they run)
  if (ev.active) return;
  const box = $('roEvent');
  const cc = amb.call, txt = !cc ? 'AMBULANCE ON DUTY   ·   WAITING FOR A CALL   ·   ' + livesTxt().toUpperCase()
    : ['AMBULANCE · ' + cc.name.toUpperCase(), cc.phase === 'back' ? 'TO HOSPITAL' : cc.phase === 'load' ? 'LOADING' : 'TO PATIENT', Math.round(Math.hypot((cc.phase === 'back' ? ambHospital().x : cc.x) - R.x, (cc.phase === 'back' ? ambHospital().z : cc.z) - R.z)) + ' m', 'CONDITION ' + Math.round(cc.cond) + '%', 'TIME LEFT ' + fmtT(Math.max(0, cc.cond / cc.rate))].join('   ·   ');
  if (box.textContent !== txt) box.textContent = txt;
  box.hidden = false; amb.hud = true;
}

/* ---- style points: drift chains ---- */
const style = { total: 0, chain: 0, chainT: 0, calm: 0, mult: 1 };
function showPop(text, cls = '') {
  const p = el('p', 'pop ' + cls, text); $('roPops').append(p);
  setTimeout(() => p.remove(), 1600);
  while ($('roPops').children.length > 4) $('roPops').firstChild.remove();
}
function inArena() { const A = world.ARENA; return roam.x > A[0] && roam.x < A[2] && roam.z > A[1] && roam.z < A[3]; }
function addStyle(pts, label) {
  style.total += pts;
  if (ev.active && ev.active.type === 'drift' && ev.phase === 'run' && inArena()) ev.score += pts;
  showPop('+' + pts.toLocaleString() + ' ' + label);
  $('roStyle').textContent = 'STYLE ' + style.total.toLocaleString();
}
function bankDrift() {
  const pts = Math.round(style.chain * style.mult);
  if (pts > 60) addStyle(pts, 'DRIFT ×' + style.mult);
  style.chain = 0; style.chainT = 0; style.mult = 1; style.calm = 0;
}
function crashChain(sev = 5) {
  ambBump(sev);
  if (style.chain > 60) showPop('CRASHED · DRIFT LOST', 'bad');
  style.chain = 0; style.chainT = 0; style.mult = 1; style.calm = 0;
}
function styleUpdate(dt) {
  const R = roam, slide = R.drift && R.slipA > 0.13 ? Math.abs(R.vl) : 0, sp = Math.abs(R.vf);
  if (slide > 2.6 && sp > 7 && R.vf > 0) { style.chain += slide * sp * dt; style.chainT += dt; style.calm = 0; style.mult = Math.min(5, 1 + Math.floor(style.chainT / 1.5)); }
  else if (style.chain > 0) { style.calm += dt; if (style.calm > 0.6) bankDrift(); }
  const ch = $('roChain'), t = style.chain > 60 ? 'DRIFT ' + Math.round(style.chain).toLocaleString() + '  ×' + style.mult : '';
  if (ch.textContent !== t) ch.textContent = t;
  // no points for brushing past traffic at speed: the city rewards nothing reckless (speed belongs on the strip and in events)
}

/* ---- photo mode ---- */
const photoSaved = {};
function setPhoto(on) {
  roam.photo = on; $('stage').classList.toggle('photo', on);
  for (const k in roam.keys) roam.keys[k] = false;
  if (on) {
    Object.assign(photoSaved, { min: controls.minDistance, max: controls.maxDistance, minP: controls.minPolarAngle, maxP: controls.maxPolarAngle });
    Object.assign(controls, { minDistance: 3, maxDistance: 40, minPolarAngle: 0.1, maxPolarAngle: 1.62 });
    controls.target.set(roam.x, roam.y + 0.7, roam.z); controls.enabled = true; controls.update();
    $('phSave').hidden = !dlNs; getDownloads().then((ns) => { $('phSave').hidden = !ns; });
  } else {
    Object.assign(controls, { minDistance: photoSaved.min, maxDistance: photoSaved.max, minPolarAngle: photoSaved.minP, maxPolarAngle: photoSaved.maxP });
    controls.enabled = false;
  }
}
// photos go out through the viewer's download prompt; no prompt available, no Save button
let dlNs = null, dlTried = false;
async function getDownloads() {
  if (dlTried) return dlNs; dlTried = true;
  try { dlNs = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dlNs = null; }
  return dlNs;
}
function savePhoto() {
  if (!dlNs) return;
  composer.render();
  renderer.domElement.toBlob(async (blob) => {
    if (!blob) return;
    try { await dlNs.save({ filename: 'raven-rs-photo.png', data: blob }); showPop('PHOTO SAVED', 'info'); }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { showPop('ONE MOMENT…', 'info'); return; } $('phSave').hidden = true; }
  }, 'image/png');
}
$('phSave').onclick = savePhoto;
$('phExit').onclick = () => setPhoto(false);
$('roRain').onclick = () => { if (roam.active) setRoamRain(!roam.rain); };

/* ---- menu page ---- */
function renderRoamPicker(p, head, left) {
  left.append(el('div', 'p-name', 'Neon Bay'));
  head.append(el('div', 'p-desc', 'Drive Neon Bay, a 2 km city: downtown towers, the curved Neon Skyway, the harbor and marina, a suspension bridge to Neon Island, a tunnel and a ring highway. Race from the glowing markers; press Enter to chat.'));
  const f = el('div', 'form');
  const inp = el('input'); inp.type = 'text'; inp.id = 'roamName'; inp.maxLength = 16; inp.placeholder = 'Your driver name'; inp.value = myName; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Driver name');
  f.append(inp, skewBtn('Drive (Enter)', 'primary', () => startRoam()));
  const h = el('div', 'form');
  h.append(el('span', 'ro-hint', 'W/↑ gas · S/↓ brake & reverse · A D/← → steer · Space handbrake · Shift nitro · E start event / challenge · M map & GPS · T rain · P photo · C camera · R back on road · Enter chat · Esc garage'));
  p.append(f, h);
}

/* ================= boot ================= */
net.setTransport(localTransport());
window.ravenNet = net; // the hosted build swaps in the Firebase transport through this
updateMaterials();
rebuildCar();
loadCustomCar();
setLocation(loc);
render();
renderStats();
applyQuality();
banner.material.map = bannerTexture(); banner.material.needsUpdate = true;
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('italic 700 40px "Chakra Petch"'), document.fonts.load('700 40px "Chakra Petch"')]).then(() => {
    drawVinyl(); drawPlate(); banner.material.map = bannerTexture(); banner.material.needsUpdate = true; invalidate();
  }).catch(() => {});
}
let first = true, lastT = performance.now(), prevRendered = false;
renderer.setAnimationLoop((now) => {
  const dtRaw = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  const envNow = ENVS[loc];
  if (envNow) {
    if (envNow.far) envNow.far.position.x = camera.position.x;
    const ch = envNow.group.userData.chunks;
    if (ch) for (const m of ch) m.visible = Math.abs(m.userData.cx - camera.position.x) < 260;
    if (envNow.rain && !document.hidden) { updateRain(envNow.rain, dtRaw); dirty = true; }
  }
  if (roam.active) {
    roamFrame(dtRaw);
    if (document.hidden) { prevRendered = false; return; }
    composer.render();
    if (prevRendered) trackFps(dtRaw);
    prevRendered = true;
    return;
  }
  if (race.active) {
    raceFrame(dtRaw);
    if (document.hidden) { prevRendered = false; return; }
    composer.render();
    if (prevRendered) trackFps(dtRaw);
    prevRendered = true;
    return;
  }
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / 700), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const sp = new THREE.Spherical(tween.from.radius + (tween.to.radius - tween.from.radius) * e, tween.from.phi + (tween.to.phi - tween.from.phi) * e, tween.from.theta + (tween.to.theta - tween.from.theta) * e);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp));
    if (k >= 1) tween = null;
    dirty = true;
  }
  if (controls.update() || controls.autoRotate) dirty = true;
  if (!dirty || document.hidden) { prevRendered = false; return; }
  dirty = false;
  composer.render();
  if (prevRendered) trackFps(dtRaw);
  prevRendered = true;
  if (first) {
    first = false; $('loading').hidden = true;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    idle(() => warmup(), { timeout: 4000 });
  }
});

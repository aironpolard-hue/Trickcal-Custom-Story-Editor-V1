(() => {
'use strict';

/* ============================================================
   Trickcal Revive dialogue animation reproduction
   - UI hierarchy / RectTransform copied from windowdialogue prefab
   - Every animation channel comes from the real AnimatorClip
     (decoded from m_MuscleClip streamed keyframes)
   ============================================================ */

const W = 1920, H = 1080;
const TYPE_SPEED = 0.03;

/* Engine bridge: the editor previews through a local HTTP server so project
   assets and story.json can be swapped without ever opening a browser tab. */
const QUERY = new URLSearchParams(location.search);
const EMBED = QUERY.get('embed') === '1' || !!window.__TRICKCAL_BUILD__;
const AUTO_START = QUERY.get('autoStart') !== '0';
const ASSET_ROOT = (QUERY.get('assetRoot') || './').replace(/\/?$/, '/');
const STORY_URL = QUERY.get('storyUrl') || 'story.json';
const INTERACTIVE = QUERY.get('interactive') !== '0';
const EDITOR_PREVIEW = QUERY.get('editorPreview') === '1';
function assetUrl(p) { return ASSET_ROOT + p; }

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const fxCanvas = document.getElementById('fxView');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let spineGLCanvas = null;
let bgMixCanvas = null;
let bgLayerCanvas = null;
function releaseBackgroundBuffers() {
  for (const buffer of [bgMixCanvas, bgLayerCanvas]) {
    if (!buffer || (buffer.width === 1 && buffer.height === 1)) continue;
    buffer.width = 1;
    buffer.height = 1;
  }
}

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  if (EDITOR_PREVIEW && s > 0) DPR = Math.min(1, Math.max(0.25, s * (window.devicePixelRatio || 1)));
  const width = Math.round(W * DPR), height = Math.round(H * DPR);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (spineGLCanvas && (spineGLCanvas.width !== width || spineGLCanvas.height !== height)) {
    spineGLCanvas.width = width;
    spineGLCanvas.height = height;
  }
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
  if (fxCanvas) {
    const r = canvas.getBoundingClientRect();
    const fxWidth = EDITOR_PREVIEW ? width : W;
    const fxHeight = EDITOR_PREVIEW ? height : H;
    if (fxCanvas.width !== fxWidth || fxCanvas.height !== fxHeight) {
      fxCanvas.width = fxWidth;
      fxCanvas.height = fxHeight;
    }
    fxCanvas.style.width = r.width + 'px'; fxCanvas.style.height = r.height + 'px';
    fxCanvas.style.left = r.left + 'px'; fxCanvas.style.top = r.top + 'px';
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingQuality = 'high';
}
window.addEventListener('resize', fit);
fit();

/* ---------------------------------------------------------------- assets */
const ASSET_PATHS = {
  bg: 'assets/bg/elf_city_night.png',
  bgElfCity: 'assets/bg/elf_city_night.png',
  bgElfArthall: 'assets/bg/elf_arthall_night.png',
  bubble: 'assets/dialogue/Dialogue_TextBubble_Default_clean.png',
  bubbleBehind: 'assets/dialogue/Dialogue_TextBubble_Behind_clean.png',
  eventBubble25: 'assets/dialogue/Dialoge_EventSpeechBubble_2_5thAnni_BubbleBase.png',
  eventBubble25b: 'assets/dialogue/Dialoge_EventSpeechBubble_2_5thAnni_BubbleBase_2.png',
  eventBubble3: 'assets/dialogue/Dialoge_EventSpeechBubble_3rdAnni_BubbleBase.png',
  bgPattern1: 'assets/dialogue/WindowDialogue_UI_PatternBg_1.png',
  bgPattern2: 'assets/dialogue/WindowDialogue_UI_PatternBg_2.png',
  bgPattern3: 'assets/dialogue/WindowDialogue_UI_PatternBg_3.png',
  bgPattern4: 'assets/dialogue/WindowDialogue_UI_PatternBg_4.png',
  bgPattern5: 'assets/dialogue/WindowDialogue_UI_PatternBg_5.png',
  tail: 'assets/dialogue/Dialogue_TextBox_Tail.png',
  tailShadow: 'assets/dialogue/Dialogue_TextBox_Shadow.png',
  tailShadow2: 'assets/dialogue/Dialogue_TextBox_Shadow2.png',
  circle: 'assets/dialogue/CommonCircle_1.png',
  box: 'assets/dialogue/Dialogue_TextBox_Default.png',
  boxBehind: 'assets/dialogue/Dialogue_TextBox_Behind.png',
  cloud: 'assets/dialogue/Dialogue_TextBox_Cloud.png',
  cloudBehind: 'assets/dialogue/Dialogue_TextBox_CloudBehind.png',
  blast: 'assets/dialogue/Dialogue_TextBox_Blast.png',
  cloudBlast: 'assets/dialogue/Dialogue_TextBox_CloudBlast.png',
  narration: 'assets/dialogue/Dialogue_TextBox_Narration.png',
  newsBox: 'assets/dialogue/Dialogue_TextBox_News.png',
  newsName: 'assets/dialogue/Dialogue_NameTitle_News.png',
  branchBase: 'assets/dialogue/Dialogue_Base_Branch.png',
  branchBubble: 'assets/dialogue/Dialogue_Base_Branch_Deco.png',
  branchDeco1: 'assets/dialogue/Dialogue_Branch_Deco1.png',
  branchDeco2: 'assets/dialogue/Dialogue_Branch_Deco2.png',
  branchDot: 'assets/dialogue/CommonBox_0505.png',
  branchGlow: 'assets/dialogue/CommonBox_5050.png',
  infoBase: 'assets/dialogue/Dialogue_Info_Base.png',
  clear: 'assets/dialogue/Dialogue_TextBox_ClearText.png',
  clearBehind: 'assets/dialogue/Dialogue_TextBox_ClearTextBehind.png',
  nameBase: 'assets/dialogue/Dialogue_NameTitle_Base.png',
  nameTail: 'assets/dialogue/Dialogue_NameTitle_Tail.png',
  sender: 'assets/dialogue/Dialogue_NameTitle_Sender.png',
  next1: 'assets/dialogue/Dialogue_Icon_TextComplete_1.png',
  next3: 'assets/dialogue/Dialogue_Icon_TextComplete_3.png',
  gradient: 'assets/dialogue/CommonGradient_0001.png',
  deco1: 'assets/title/dialogue_title_deco_1.png',
  deco2: 'assets/title/dialogue_title_deco_2.png',
  deco3: 'assets/title/dialogue_title_deco_3.png',
  deco4: 'assets/title/dialogue_title_deco_4.png',
  deco5: 'assets/title/dialogue_title_deco_5.png',
  cinema: 'assets/title/dialogue_tile_cinemaframe.png',
  erpin: 'assets/herohead/erpin.png',
  ner: 'assets/herohead/ner.png',
  emoticonAtlas: 'assets/emoticon/emoticon_atlas.png',
};
for (let i = 0; i < 10; i++) {
  ASSET_PATHS[`numBase${i}`] = `assets/title/number_font/base_${i}.png`;
  ASSET_PATHS[`numWhite${i}`] = `assets/title/number_font/white_${i}.png`;
}
const IMG = {};

function loadImages() {
  const jobs = Object.entries(ASSET_PATHS).map(([k, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => { console.warn('missing asset', src); res(); };
    im.src = assetUrl(src);
  }));
  return Promise.all(jobs);
}

// Custom background/image assets are loaded lazily from the project folder.
const customImagePromises = new Map();
function stageImageKey(src) {
  return 'stage:' + src;
}
function ensureImage(key, src) {
  if (IMG[key]) return Promise.resolve(IMG[key]);
  if (customImagePromises.has(key)) return customImagePromises.get(key);
  const p = new Promise(resolve => {
    const im = new Image();
    im.onload = () => { IMG[key] = im; resolve(im); };
    im.onerror = () => { console.warn('missing custom asset', src); resolve(null); };
    im.src = /^(data:|blob:|https?:|\/)/.test(src) ? src : assetUrl(src);
  });
  customImagePromises.set(key, p);
  return p;
}

const tintCache = new Map();
function tinted(key, color) {
  const im = IMG[key];
  if (!im) return null;
  const r = Math.round((color[0] ?? 1) * 255), g = Math.round((color[1] ?? 1) * 255),
        b = Math.round((color[2] ?? 1) * 255);
  if (r === 255 && g === 255 && b === 255) return im;
  const ck = key + '|' + r + ',' + g + ',' + b;
  if (tintCache.has(ck)) return tintCache.get(ck);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth || im.width;
  c.height = im.naturalHeight || im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = `rgb(${r},${g},${b})`;
  x.fillRect(0, 0, c.width, c.height);
  tintCache.set(ck, c);
  return c;
}

function tintedNumberBase(key, color) {
  const im = IMG[key];
  if (!im) return null;
  const r = Math.round((color[0] ?? 1) * 255), g = Math.round((color[1] ?? 1) * 255),
        b = Math.round((color[2] ?? 1) * 255);
  const ck = 'num|' + key + '|' + r + ',' + g + ',' + b;
  if (tintCache.has(ck)) return tintCache.get(ck);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth || im.width;
  c.height = im.naturalHeight || im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = `rgb(${r},${g},${b})`;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'multiply';
  x.globalAlpha = 0.22;
  x.drawImage(im, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(im, 0, 0);
  tintCache.set(ck, c);
  return c;
}

/* ---------------------------------------------------------------- math */
const M = {
  id: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  mul: (A, B) => ({
    a: A.a * B.a + A.c * B.b,
    b: A.b * B.a + A.d * B.b,
    c: A.a * B.c + A.c * B.d,
    d: A.b * B.c + A.d * B.d,
    e: A.a * B.e + A.c * B.f + A.e,
    f: A.b * B.e + A.d * B.f + A.f,
  }),
  t: (x, y) => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }),
  s: (x, y) => ({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }),
  r: deg => {
    const q = deg * Math.PI / 180, c = Math.cos(q), s = Math.sin(q);
    return { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
  },
  apply: (m) => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f),
};
const SCREEN = { a: 1, b: 0, c: 0, d: -1, e: W / 2, f: H / 2 };

/* ---------------------------------------------------------------- runtime tree */
const UI = window.UI;
const ANIM = window.ANIM;
const BRANCH_ANIM = window.BRANCH_ANIM || {};
for (const [key, clip] of Object.entries(BRANCH_ANIM)) ANIM['branch.' + key] = clip;

function cloneNode(n, parentPath) {
  const path = n.path ?? '';
  const out = Object.assign({}, n);
  out.path = path;
  out.draw = n.draw ? Object.assign({}, n.draw) : null;
  out.base = {
    ax: n.ax, ay: n.ay, bx: n.bx, by: n.by,
    px: n.px, py: n.py, sw: n.sw, sh: n.sh,
    pvx: n.pvx, pvy: n.pvy, sx: n.sx, sy: n.sy, sz: n.sz,
    rot: n.rot, cg: n.cg ?? 1, active: n.active,
    draw: n.draw ? Object.assign({}, n.draw) : null,
  };
  out.children = (n.children || []).map(c => cloneNode(c));
  out.hidden = false;
  out.forceShow = false;
  return out;
}
const MODES = {};
for (const k of Object.keys(UI.modes)) MODES[k] = cloneNode(UI.modes[k]);

function walk(node, fn) {
  fn(node);
  for (const c of node.children || []) walk(c, fn);
}
function findNode(root, path) {
  let hit = null;
  walk(root, n => { if (!hit && n.path === path) hit = n; });
  return hit;
}
function eachNode(root, fn) { walk(root, fn); }

// static rect overrides derived from the real prefab / text layout
(function staticOverrides() {
  // Manga bubble text: TMP node is a sibling of the bubble and driven by TextPos at runtime.
  // Body is 833x426, outer Base is full size, body center sits 125px left of outer Base center.
  const t = findNode(MODES.manga, 'Base/Text');
  if (t) {
    t.ax = t.bx = t.ay = t.by = 0.5;
    t.px = -125; t.py = 0; t.pvx = t.pvy = 0.5;
    t.sw = 600; t.sh = 230;
    t.draw.fontSize = 52; t.draw.halign = 2; t.draw.valign = 512;
  }
  // Hide prefab placeholders / next icons (custom icon is drawn after typing)
  eachNode(MODES.manga, n => {
    if (n.path === 'Base/Text' || n.path === 'Base/BehindText') {
      if (n.path === 'Base/BehindText') n.hidden = true;
    }
  });
  // One drop shadow only: the BaseShadow silhouette offset behind the bubble,
  // plus the matching tail shadow. The prefab's Behind/BehindShadow layers and
  // the extra tail shadow layer are hidden to avoid stacked, duplicated bands.
  for (const p of [
    'Base/Base/TextBoxLayOut/Behind/Behind',
    'Base/Base/TextBoxLayOut/Behind/BehindShadow',
    'Base/BubbleTail/NormalTail/NormalShadowTop',
  ]) {
    const n = findNode(MODES.manga, p);
    if (n) n.hidden = true;
  }
  const mangaBaseShadow = findNode(MODES.manga, 'Base/Base/TextBoxLayOut/Base/BaseShadow');
  if (mangaBaseShadow) {
    mangaBaseShadow.px = 12.5;
    mangaBaseShadow.py = -12.5;
    mangaBaseShadow.sw = 5;
    mangaBaseShadow.sh = 5;
  }
  const s = findNode(MODES.normal, 'Sender');
  if (s) s.draw.color = [0.91, 0.94, 0.82, 1];
  const sb = findNode(MODES.normal, 'Base/Box');
  if (sb) sb.draw.color = [1, 1, 1, 1];
  const clrHeroBg = findNode(MODES.clear, 'HeroHead/Hero/FrontBg');
  if (clrHeroBg) clrHeroBg.draw.color = [0.62, 0.78, 0.40, 1];
  const clrOutline = findNode(MODES.clear, 'HeroHead/Hero/OutLineBg');
  if (clrOutline) clrOutline.draw.color = [0.93, 0.84, 0.53, 0.9];
  // In the prefab the white clear-text plate is followed by the purple backing;
  // the runtime reorders them so the white plate stays on top.
  const baseParent = findNode(MODES.clear, 'BaseParent');
  if (baseParent && baseParent.children) {
    baseParent.children.sort((a, b) => a.name === 'Behind' ? -1 : b.name === 'Behind' ? 1 : 0);
    const behind = findNode(MODES.clear, 'BaseParent/Behind');
    if (behind) { behind.px = 12; behind.py = -12; }
  }
  const animePlate = findNode(MODES.anime, 'Text/NamePlate');
  if (animePlate) animePlate.py += 75;
  const titleNum = findNode(MODES.title, 'Panel/TitleGroup/TitleFrameGroup/NumberLayout');
  if (titleNum) titleNum.py += 26;
})();

// Manual trees for prefab nodes that were not part of the first UI dump.
// MangaNarrationText = onomatopoeia / sound-effect box (SDF black base + white talk box).
MODES.sfx = {
  name: 'MangaNarrationText', path: '', active: true,
  ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [
    {
      name: 'Base', path: 'Base', active: true,
      ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 670, sh: 540,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      children: [
        {
          name: 'TextBoxShadow', path: 'Base/TextBoxShadow', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 30, py: -30, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'sfxShadow', img: null, color: [0.10, 0.10, 0.10, 0.86] },
        },
        {
          name: 'Base', path: 'Base/Base', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'sfxBase', img: null, color: [0.10, 0.10, 0.10, 1] },
          children: [
            {
              name: 'TalkBox', path: 'Base/Base/TalkBox', active: true,
              ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: -20, sh: -20,
              pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
              draw: { role: 'sfxTalk', img: null, color: [1, 1, 1, 1] },
            },
          ],
        },
        {
          name: 'TextPos', path: 'Base/TextPos', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
        },
      ],
    },
    {
      name: 'Text', path: 'Text', active: true,
      ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'sfxText', img: null, fontColor: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, fontSize: 52, halign: 2, valign: 512 },
    },
  ],
};

// WindowDialogue/FixText/NarrationTextNews (TextType 18) and
// WindowDialogue/FixText/NormalTextNews (TextType 17), rebuilt from the real
// prefab RectTransforms/TMP fields and RuntimeSpriteLoader sprite table.
// Both use AnimatorController Dialogue_NewsText -> Dialogue_NewsText_Entry.
// Unity m_Border is {x:left, y:bottom, z:right, w:top}; drawImageSliced takes
// [left, right, bottom, top].
const NEWS_BOX_BORDER = [48, 46, 53, 46];   // Dialogue_TextBox_News m_Border 48/53/46/46
const NEWS_NAME_BORDER = [51, 52, 27, 54];  // Dialogue_NameTitle_News m_Border 51/27/52/54
const NEWS_TEXT_COLOR = { r: 0.003921568859368563, g: 0.125490203499794, b: 0.3764705955982208, a: 1 };

MODES.newsSummary = {
  name: 'NarrationTextNews', path: '', active: true,
  ax: 0.5, ay: 0, bx: 0.5, by: 0, px: 0, py: 42, sw: 1734, sh: 230,
  pvx: 0.5, pvy: 0, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [
    {
      name: 'Base', path: 'Base', active: true,
      ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      children: [
        {
          name: 'Shadow', path: 'Base/Shadow', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 10, py: -10, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'newsBox', kind: 'sliced', border: NEWS_BOX_BORDER, color: [0, 0, 0, 0.14901961386203766] },
        },
        {
          name: 'Box', path: 'Base/Box', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'newsBox', kind: 'sliced', border: NEWS_BOX_BORDER, color: [1, 1, 1, 1] },
        },
      ],
    },
    {
      name: 'Text', path: 'Text', active: true,
      ax: 0, ay: 0, bx: 1, by: 1, px: 30, py: 0, sw: -460, sh: -80,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'newsText', img: null, fontColor: NEWS_TEXT_COLOR, fontSize: 75, halign: 1, lineSpacing: 4, charSpacing: -2 },
    },
    {
      name: 'Icon', path: 'Icon', active: true,
      ax: 0, ay: 0.5, bx: 0, by: 0.5, px: 115.00039672851562, py: 0, sw: 230, sh: 230,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      children: [
        {
          name: 'Image', path: 'Icon/Image', active: true,
          ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 140, sh: 140,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'newsName', kind: 'simple', border: [0, 0, 0, 0], color: [1, 1, 1, 1] },
        },
      ],
    },
  ],
};

MODES.newsTalk = {
  name: 'NormalTextNews', path: '', active: true,
  ax: 0.5, ay: 0, bx: 0.5, by: 0, px: 0, py: 42, sw: 1688, sh: 315,
  pvx: 0.5, pvy: 0, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [
    {
      name: 'Base', path: 'Base', active: true,
      ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      children: [
        {
          name: 'Shadow', path: 'Base/Shadow', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 10, py: 10, sw: 0, sh: 40,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'newsBox', kind: 'sliced', border: NEWS_BOX_BORDER, color: [0, 0, 0, 0.14901961386203766] },
        },
        {
          name: 'Box', path: 'Base/Box', active: true,
          ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'newsBox', kind: 'sliced', border: NEWS_BOX_BORDER, color: [1, 1, 1, 1] },
        },
      ],
    },
    {
      name: 'Text', path: 'Text', active: true,
      ax: 0, ay: 0, bx: 1, by: 1, px: -70, py: -20, sw: -260, sh: -120,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'newsText', img: null, fontColor: NEWS_TEXT_COLOR, fontSize: 52, halign: 2, lineSpacing: 4, charSpacing: -2 },
    },
    {
      name: 'Sender', path: 'Sender', active: true,
      ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 156, sw: 1688, sh: 92,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'image', img: 'newsName', kind: 'sliced', border: NEWS_NAME_BORDER, color: [1, 1, 1, 1] },
      children: [
        {
          name: 'NameText', path: 'Sender/NameText', active: true,
          // Prefab rect is 103.38x77.01 with a ContentSizeFitter; enlarge to the
          // runtime-fitted width while keeping the authored left edge at x=20.
          ax: 0, ay: 1, bx: 0, by: 1, px: 200, py: -46, sw: 360, sh: 77.01000213623047,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'newsSender', img: null, fontColor: { r: 1, g: 1, b: 1, a: 1 }, fontSize: 55, charSpacing: 5 },
        },
      ],
    },
  ],
};

MODES.fullscreen = {
  name: 'FullScreenText', path: '', active: true,
  ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [
    {
      name: 'Base', path: 'Base', active: true,
      ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 99999, sh: 99999,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'fill', img: null, color: [0, 0, 0, 0.196] },
    },
    {
      name: 'Text', path: 'Text', active: true,
      ax: 0, ay: 0, bx: 1, by: 1, px: 0, py: 0, sw: -700, sh: -120,
      pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      draw: { role: 'fullscreenText', img: null, fontColor: { r: 0.96, g: 0.93, b: 0.99, a: 1 }, fontSize: 56 },
    },
  ],
};

MODES.location = {
  name: 'InfoText', path: '', active: true,
  ax: 0, ay: 0, bx: 0, by: 0, px: 0, py: 262, sw: 100, sh: 160,
  pvx: 0, pvy: 1, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [
    {
      name: 'Axis', path: 'Axis', active: true,
      ax: 0, ay: 0, bx: 0, by: 1, px: 0, py: 0, sw: 737.54, sh: 0,
      pvx: 0, pvy: 1, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
      children: [
        {
          name: 'Base', path: 'Axis/Base', active: true,
          ax: 0, ay: 0, bx: 1, by: 0, px: -180, py: 72.5, sw: 440, sh: 202,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'image', img: 'infoBase', kind: 'sliced', border: [1, 125, 0, 0], color: [1, 1, 1, 1] },
        },
        {
          name: 'Text', path: 'Axis/Text', active: true,
          ax: 0, ay: 1, bx: 0, by: 1, px: 340.27, py: -44, sw: 468.54, sh: 150,
          pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
          draw: { role: 'locationText', img: null, fontSize: 69.95, fontColor: { r: 0.196, g: 0.196, b: 0.196, a: 1 }, halign: 1, valign: 512 },
        },
      ],
    },
  ],
};

// StoryProduction transitions: full-screen overlays driven by canvas masks.
MODES.transition = {
  name: 'StoryProduction', path: '', active: true,
  ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [],
};

// WindowDialogue/Branch: real DialogueBranchSlotNormal option slots.
MODES.branch = {
  name: 'Branch', path: '', active: true,
  ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [],
};

// FixText/ScrollText: full-screen lore / scrollable narrative.
MODES.scroll = {
  name: 'ScrollText', path: '', active: true,
  ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [],
};

// DialogueCG / SoftFrame: full-screen illustration with cinematic bars.
MODES.cg = {
  name: 'DialogueCG', path: '', active: true,
  ax: 0.5, ay: 0.5, bx: 0.5, by: 0.5, px: 0, py: 0, sw: 0, sh: 0,
  pvx: 0.5, pvy: 0.5, sx: 1, sy: 1, sz: 1, rot: 0, cg: 1,
  children: [],
};

/* ---------------------------------------------------------------- spine stage */
// Standing rig mirrored from the desktop-pet build: the lobby "standing" Spine
// set, Normal skin, Idle_1 loop, WebGL renderer (premultiplied alpha) and the
// body pivot at the feet. DialogueCharacterMove then moves/scales the whole
// skeleton root, never a hand-authored Spine clip.
const SPINE_DEFS = {};
const spineActors = new Map();
const spineAssets = new Map();
const stageActors = new Map();
const stageImages = new Map();
let spineGL = null;
let spineScene = null;
let spineReady = false;
let spineLast = performance.now();

function initSpineGL() {
  if (spineScene) return true;
  try {
    spineGLCanvas = document.createElement('canvas');
    spineGLCanvas.width = canvas.width;
    spineGLCanvas.height = canvas.height;
    spineGL = spineGLCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!spineGL) throw new Error('WebGL context unavailable');
    spineScene = new spine.SceneRenderer(spineGLCanvas, spineGL);
    spineScene.camera.position.set(0, 0, 0);
    spineScene.camera.up.set(0, 1, 0);
    spineScene.camera.direction.set(0, 0, -1);
    spineScene.camera.setViewport(W, H);
    spineScene.camera.update();
    return true;
  } catch (e) {
    console.warn('spine webgl init failed', e);
    spineScene = null;
    return false;
  }
}

async function loadSpineActors() {
  if (!window.spine) { console.warn('spine runtime missing'); return; }
  if (!initSpineGL()) return;
  for (const [id, def] of Object.entries(SPINE_DEFS)) {
    try {
      const assets = new spine.AssetManager(spineGL, def.base);
      await Promise.all([
        new Promise((res, bad) => assets.loadBinary(def.file + '.skel.bytes', () => res(), (p, m) => bad(new Error(m)))),
        new Promise((res, bad) => assets.loadTextureAtlas(def.file + '.atlas.txt', () => res(), (p, m) => bad(new Error(m)))),
      ]);
      const atlas = assets.require(def.file + '.atlas.txt');
      const bin = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas));
      const data = bin.readSkeletonData(assets.require(def.file + '.skel.bytes'));
      const skeleton = new spine.Skeleton(data);
      if (data.findSkin('Normal')) skeleton.setSkinByName('Normal');
      else if (data.skins.length > 0) skeleton.setSkinByName(data.skins[0].name);
      skeleton.setToSetupPose();
      skeleton.setSlotsToSetupPose();
      const stateData = new spine.AnimationStateData(data);
      stateData.defaultMix = 0.2;
      const anim = new spine.AnimationState(stateData);
      const idle = data.animations.find(a => a.name === 'Idle_1') || data.animations.find(a => a.name === 'Idle') || data.animations[0];
      if (idle) anim.setAnimation(0, idle.name, true);
      anim.update(0);
      anim.apply(skeleton);
      skeleton.updateWorldTransform();
      spineAssets.set(id, { data, stateData });
      spineActors.set(id, { data, skeleton, anim, stateData, current: idle ? idle.name : null, defaultAnim: idle ? idle.name : null, defaultSkin: skeleton.skin?.name || null, asset: id });
    } catch (e) {
      console.warn('spine actor failed', id, e);
    }
  }
  spineReady = spineActors.size > 0;
  if (spineReady && state.started && STORY[state.line]) {
    const line = STORY[state.line];
    const currentStage = new Map((state.stageBase || line.stage || []).map(conf => [conf.id, conf]));
    for (let i = 0; i < state.lineEventIndex; i++) {
      const event = state.lineEvents[i];
      if (event.type !== 'stage') continue;
      if (event.action === 'show') currentStage.set(event.conf.id, event.conf);
      else if (event.id === 'all' || event.id === 'stage') currentStage.clear();
      else currentStage.delete(event.id);
    }
    setStageForLine({ ...line, stage: [...currentStage.values()] });
    const pending = state.pendingStageEvents.splice(0);
    for (const event of pending) if (event.line === state.line) applyStageEvent(event, { replayPending: true });
  }
}

function stageTargetFor(actor, conf) {
  const enter = conf.enter || 'fade';
  const fromX = enter === 'left' ? -320 : enter === 'right' ? W + 320 : (conf.x ?? 0);
  return {
    x: fromX, y: conf.y ?? 1040,
    sx: conf.sx ?? 1, sy: conf.sy ?? 1,
    alpha: enter === 'fade' || enter === 'none' ? 0 : 0,
    targetX: conf.x ?? 0, targetY: conf.y ?? 1040,
    targetSX: conf.sx ?? 1, targetSY: conf.sy ?? 1,
    targetAlpha: conf.alpha ?? 1,
    face: conf.face ?? 1,
    rot: 0,
    ry: 0,
  };
}

function ensureStageActor(id, conf) {
  if (spineActors.has(id)) return spineActors.get(id);
  const asset = conf.asset || id;
  const base = spineActors.get(asset) || spineAssets.get(asset);
  if (!base) return null;
  const data = base.data;
  const skeleton = new spine.Skeleton(data);
  if (conf.skin && data.findSkin(conf.skin)) skeleton.setSkinByName(conf.skin);
  else if (data.findSkin('Normal')) skeleton.setSkinByName('Normal');
  else if (data.skins && data.skins.length) skeleton.setSkinByName(data.skins[0].name);
  skeleton.setToSetupPose();
  skeleton.setSlotsToSetupPose();
  const stateData = new spine.AnimationStateData(data);
  stateData.defaultMix = 0.2;
  const anim = new spine.AnimationState(stateData);
  const idle = data.animations.find(a => a.name === 'Idle_1') || data.animations.find(a => a.name === 'Idle') || data.animations[0];
  if (idle) { anim.setAnimation(0, idle.name, true); anim.update(0); anim.apply(skeleton); }
  skeleton.updateWorldTransform();
  const actor = { data, skeleton, anim, stateData, current: idle ? idle.name : null, defaultAnim: idle ? idle.name : null, defaultSkin: (data.findSkin('Normal') || data.skins?.[0])?.name || null, asset };
  spineActors.set(id, actor);
  return actor;
}

function applyActorAppearance(actor, conf) {
  const skin = conf.skin || actor.defaultSkin;
  if (skin && actor.data.findSkin(skin) && (!actor.skeleton.skin || actor.skeleton.skin.name !== skin)) {
    actor.skeleton.setSkinByName(skin);
    actor.skeleton.setToSetupPose();
    actor.skeleton.setSlotsToSetupPose();
  }
  const name = conf.anim || actor.defaultAnim;
  if (name && actor.current !== name && actor.data.animations.some(animation => animation.name === name)) {
    if (actor.stateData) actor.stateData.defaultMix = conf.fade == null ? 0.2 : Math.max(0, Number(conf.fade) || 0);
    actor.anim.setAnimation(0, name, true);
    actor.current = name;
  }
}

function setStageForLine(line) {
  const wanted = new Map((line.stage || []).filter(c => c.kind !== 'image').map(c => [c.id, c]));
  for (const [id, s] of stageActors) {
    if (!wanted.has(id)) s.targetAlpha = 0;
  }
  for (const [id, original] of wanted) {
    const conf = {
      ...original,
      ...(state.lineActorOverrides.get(id) || {}),
      ...(state.stageBindings.get(id) || {}),
    };
    const actor = spineActors.get(id) || ensureStageActor(id, conf);
    if (!actor) continue;
    let s = stageActors.get(id);
    if (!s) {
      s = stageTargetFor(actor, conf);
      stageActors.set(id, s);
    }
    s.conf = conf;
    s.targetX = conf.x ?? 0;
    s.targetY = conf.y ?? 1040;
    s.targetSX = conf.sx ?? 1;
    s.targetSY = conf.sy ?? 1;
    s.targetAlpha = conf.hidden ? 0 : (conf.alpha ?? 1);
    s.brightness = conf.brightness ?? 1;
    s.locked = !!conf.locked;
    s.z = Number(conf.z) || 0;
    s.face = conf.face ?? 1;
    applyActorAppearance(actor, conf);
  }
  const wantedImages = new Map((line.stage || []).filter(c => c.kind === 'image').map(c => [c.id, c]));
  for (const [id, s] of stageImages) {
    if (!wantedImages.has(id)) s.targetAlpha = 0;
  }
  for (const [id, original] of wantedImages) {
    const conf = { ...original, ...(state.stageBindings.get(id) || {}) };
    let s = stageImages.get(id);
    if (!s) {
      s = {
        id, conf, x: conf.x ?? 960, y: conf.y ?? 540,
        targetX: conf.x ?? 960, targetY: conf.y ?? 540,
        sx: conf.sx ?? 1, sy: conf.sy ?? 1,
        targetSX: conf.sx ?? 1, targetSY: conf.sy ?? 1,
        rot: conf.rot || 0, targetRot: conf.rot || 0,
        alpha: 0, targetAlpha: conf.alpha == null ? 1 : conf.alpha,
      };
      stageImages.set(id, s);
    }
    s.conf = conf;
    ensureImage(stageImageKey(conf.src), conf.src);
    s.targetX = conf.x ?? 960;
    s.targetY = conf.y ?? 540;
    s.targetSX = conf.sx ?? 1;
    s.targetSY = conf.sy ?? 1;
    s.targetRot = conf.rot || 0;
    s.targetAlpha = conf.hidden ? 0 : (conf.alpha == null ? 1 : conf.alpha);
    s.brightness = conf.brightness ?? 1;
    s.z = Number(conf.z) || 0;
  }
}


/* ---------------------------------------------------------- standing rig */
// Only data recovered offline from the CN 1.6.1 client is used here:
// - dialoguecharactermove: audited per-character MoveType 1/2/3/5/6/9
//   transform records (assets/standing_actions.json); 5 = RotateY, 6 = RotateZ.
// - OfficialCharacterLayout.SlotX: the 7 slot X values used by MoveTo1-7.
// Built-ins without recovered timing/curves stay out of the UI.
const STANDING_SLOT_X = [-764, -382, 0, 382, 764, 1361.25, -1361.25];
const STANDING_BUILTINS = ['MoveTo1', 'MoveTo2', 'MoveTo3', 'MoveTo4', 'MoveTo5', 'MoveTo6', 'MoveTo7', 'Bounce1', 'PopUp', 'Appear', 'Disappear'];
const standingPlay = new Map();
let STANDING_DATA = null;
const standingSelection = {};

function standingCharacterData(id) {
  return STANDING_DATA && STANDING_DATA.characters ? STANDING_DATA.characters[id] : null;
}

function standingEpisodeFor(id) {
  const data = standingCharacterData(id);
  if (!data) return '';
  const episodes = Object.keys(data.episodes || {});
  if (standingSelection[id] === '__all__') return '__all__';
  if (standingSelection[id] && data.episodes[standingSelection[id]]) return standingSelection[id];
  standingSelection[id] = episodes.find(e => e === '101001001') || episodes[0] || '';
  return standingSelection[id];
}

function standingBaseFor(id) {
  const line = STORY[state.line];
  const conf = (line && line.stage || []).find(c => c.id === id);
  if (!conf) return null;
  return { x: conf.x ?? 960, y: conf.y ?? 1045, sx: conf.sx ?? 1, sy: conf.sy ?? 1, face: conf.face ?? 1 };
}

function resetStandingActor(id) {
  standingPlay.delete(id);
  const base = standingBaseFor(id);
  const s = stageActors.get(id);
  if (!base || !s) return;
  s.x = s.targetX = base.x;
  s.y = s.targetY = base.y;
  s.sx = s.targetSX = base.sx;
  s.sy = s.targetSY = base.sy;
  s.rot = 0;
  s.ry = 0;
  s.face = base.face;
  s.alpha = s.targetAlpha = 1;
  setStandingStatus(id, '—');
}

function resetStandingActors(line) {
  standingPlay.clear();
  for (const conf of line.stage || []) {
    const s = stageActors.get(conf.id);
    if (!s) continue;
    s.x = s.targetX = conf.x ?? 960;
    s.y = s.targetY = conf.y ?? 1045;
    s.sx = s.targetSX = conf.sx ?? 1;
    s.sy = s.targetSY = conf.sy ?? 1;
    s.rot = 0;
    s.ry = 0;
    s.face = conf.face ?? 1;
    s.alpha = s.targetAlpha = 1;
    setStandingStatus(conf.id, '—');
  }
}

function standingEase(p, type) {
  p = Math.max(0, Math.min(1, p));
  // OfficialCustomMoveConfig.EaseType + 1 = DOTween Ease enum. Only the
  // values present in the recovered dialoguecharactermove table are mapped.
  if (type === 0) return p; // 1 Linear
  if (type === 1) return 1 - Math.cos(p * Math.PI / 2); // 2 InSine
  if (type === 2) return Math.sin(p * Math.PI / 2); // 3 OutSine
  if (type === 3) return -(Math.cos(Math.PI * p) - 1) / 2; // 4 InOutSine
  if (type === 9) return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // 10 InOutCubic
  if (type === 14) return p * p * p * p * p; // 15 InQuint
  if (type === 15) return 1 - Math.pow(1 - p, 5); // 16 OutQuint
  if (type === 16) return p < 0.5 ? 16 * Math.pow(p, 5) : 1 - Math.pow(-2 * p + 2, 5) / 2; // 17 InOutQuint
  if (type === -2) return p * p; // InQuad, used by Bounce1 tail
  if (type === 23) { // OutBack, used by PopUp
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }
  return 1 - (1 - p) * (1 - p); // DOTween default / OutQuad
}

function standingChannelAt(records, t, pick, def) {
  let value = def;
  for (const r of records) {
    const t0 = Math.max(0, r.delay || 0);
    if (t < t0) break;
    const target = pick(r);
    if (target === undefined) continue;
    const d = Math.max(0, r.duration || 0);
    const from = value;
    if (d <= 0) { value = target; continue; }
    if (t < t0 + d) return from + (target - from) * standingEase((t - t0) / d, r.ease);
    value = target;
  }
  return value;
}

function evaluateStandingAction(play, t) {
  const recs = play.action.records || [];
  return {
    x: standingChannelAt(recs, t, r => (r.type === 1 || r.type === 3) ? r.values[0] : undefined, 0),
    y: standingChannelAt(recs, t, r => r.type === 2 ? r.values[0] : (r.type === 3 ? r.values[1] : undefined), 0),
    sx: standingChannelAt(recs, t, r => (r.type === 7 || r.type === 9) ? r.values[0] : undefined, 1),
    sy: standingChannelAt(recs, t, r => r.type === 8 ? r.values[0] : (r.type === 9 ? r.values[1] : undefined), 1),
    ry: standingChannelAt(recs, t, r => r.type === 5 ? r.values[0] : undefined, 0),
    rz: standingChannelAt(recs, t, r => r.type === 6 ? r.values[0] : undefined, 0),
    alpha: standingChannelAt(recs, t, r => r.type === 30 ? r.values[0] : undefined, 1),
  };
}

function standingActionTotal(records) {
  return records.reduce((m, r) => Math.max(m, Math.max(0, r.delay || 0) + Math.max(0, r.duration || 0)), 0);
}

function setStandingStatus(id, text) {
  const el = document.querySelector(`.stand-status[data-char="${id}"]`);
  if (el) el.textContent = '最近：' + text;
}

function playStandingAction(id, key) {
  const data = standingCharacterData(id);
  if (!data) return;
  let action = null;
  for (const list of Object.values(data.episodes || {})) {
    action = list.find(a => a.key === key);
    if (action) break;
  }
  if (!action) return;
  resetStandingActor(id);
  const base = standingBaseFor(id);
  if (!base) return;
  const records = normalizeStandingRecords(action.records);
  standingPlay.set(id, { action: { ...action, records, total: standingActionTotal(records) }, start: performance.now(), base });
  setStandingStatus(id, `${action.key} · ${standingActionSummary(action)} · ${standingActionTotal(records).toFixed(2)}s`);
}

function playStandingBuiltin(id, name) {
  const base = standingBaseFor(id);
  if (!base) return;
  let records = [];
  if (name.startsWith('MoveTo')) {
    const idx = Number(name.slice(6)) - 1;
    if (idx < 0 || idx >= STANDING_SLOT_X.length) return;
    const targetX = 960 + STANDING_SLOT_X[idx];
    records = [{ type: 3, values: [targetX - base.x, 0, 0], ease: -1, duration: 0, delay: 0 }];
  } else if (name === 'Bounce1') {
    records = [
      { type: 8, values: [1.2, 0, 0], ease: -1, duration: 0.5, delay: 0 },
      { type: 8, values: [1.0, 0, 0], ease: -2, duration: 0.5, delay: 0.5 },
    ];
  } else if (name === 'PopUp') {
    records = [
      { type: 9, values: [0, 0, 0], ease: 0, duration: 0, delay: 0 },
      { type: 9, values: [1, 1, 0], ease: 23, duration: 0.8, delay: 0 },
    ];
  } else if (name === 'Appear' || name === 'Disappear') {
    const target = name === 'Appear' ? 1 : 0;
    records = [{ type: 30, values: [name === 'Appear' ? 0 : 1, 0, 0], ease: 0, duration: 0, delay: 0 }];
    records.push({ type: 30, values: [target, 0, 0], ease: 0, duration: 1, delay: 0 });
  }
  if (!records.length) return;
  resetStandingActor(id);
  records = normalizeStandingRecords(records);
  standingPlay.set(id, {
    action: { key: name, records, total: standingActionTotal(records) },
    start: performance.now(),
    base,
  });
  setStandingStatus(id, `${name} · 内置动作`);
}

/* ------------------------------------------------------ action workshop */
// The composer is a test-only authoring layer over the recovered table. It
// writes the same MoveType 1/2/3/5/6/9 records the official executor consumes;
// no hand-authored Spine clips are created.
const STANDING_WORKSHOP_STORAGE = 'trickcal.standing.workshop.v1';
const STANDING_EASES = [
  [-1, '默认 OutQuad'],
  [0, 'Linear'],
  [1, 'InSine'],
  [2, 'OutSine'],
  [3, 'InOutSine'],
  [9, 'InOutCubic'],
  [14, 'InQuint'],
  [15, 'OutQuint'],
  [16, 'InOutQuint'],
  [23, 'OutBack'],
];
const STANDING_RAW_TYPES = [
  [1, 'X 位移'],
  [2, 'Y 位移'],
  [3, 'XY 位移'],
  [5, 'RotY 转身'],
  [6, 'RotZ 旋转'],
  [9, 'XY 缩放'],
];
const STANDING_DIRECTIONS = [
  ['ul', '↖', -Math.SQRT1_2, Math.SQRT1_2],
  ['up', '↑', 0, 1],
  ['ur', '↗', Math.SQRT1_2, Math.SQRT1_2],
  ['left', '←', -1, 0],
  ['home', '◎', 0, 0],
  ['right', '→', 1, 0],
  ['dl', '↙', -Math.SQRT1_2, -Math.SQRT1_2],
  ['down', '↓', 0, -1],
  ['dr', '↘', Math.SQRT1_2, -Math.SQRT1_2],
];
const STANDING_STEP_DEFAULT = { x: 0, y: 0, sx: 1, sy: 1, ry: 0, rz: 0, duration: 0.4, gap: 0, ease: -1 };
const standingComposer = {
  char: 'erpin',
  mode: 'steps',
  coordMode: 'offset',
  steps: [],
  selected: -1,
  params: { distance: 400, height: 30, stretch: 1.15, count: 4, angle: 180 },
  rawRecords: [],
  rawSource: '',
  rawSelectedAction: '',
  saved: null,
  saveDraft: '',
  status: '选择参数化预设，或添加第一个关键帧。',
};
let standingStatsCache = null;
let standingWorkshopRenderTimer = 0;

function standingWorkshopEscape(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function standingActionSummary(action) {
  const recs = (action && action.records) || [];
  const xs = [], ys = [], sxs = [], sys = [], rys = [], rzs = [];
  for (const r of recs) {
    if (r.type === 1 || r.type === 3) xs.push(Number(r.values[0]) || 0);
    if (r.type === 2 || r.type === 3) ys.push(Number(r.values[1]) || 0);
    if (r.type === 7 || r.type === 9) sxs.push(Number(r.values[0]));
    if (r.type === 8 || r.type === 9) sys.push(Number(r.values[1]));
    if (r.type === 5) rys.push(Number(r.values[0]) || 0);
    if (r.type === 6) rzs.push(Number(r.values[0]) || 0);
  }
  const num = (v, signed) => {
    const n = Math.round(v * 100) / 100;
    return (signed && n > 0 ? '+' : '') + String(n);
  };
  const range = (arr, signed) => {
    const lo = Math.min(...arr), hi = Math.max(...arr);
    return Math.abs(lo - hi) < 1e-4 ? num(lo, signed) : `${num(lo, signed)}→${num(hi, signed)}`;
  };
  const parts = [];
  if (xs.some(v => Math.abs(v) > 1e-4)) parts.push(`X ${range(xs, true)}`);
  if (ys.some(v => Math.abs(v) > 1e-4)) parts.push(`Y ${range(ys, true)}`);
  if (sxs.length) {
    const uniform = sxs.every((v, i) => sys[i] !== undefined && Math.abs(v - sys[i]) < 1e-4);
    parts.push(uniform ? `Scale ${range(sxs, false)}×` : `Scale ${range(sxs, false)}×${range(sys, false)}`);
  }
  if (rys.some(v => Math.abs(v) > 1e-4)) parts.push(`RotY ${range(rys, true)}°`);
  if (rzs.some(v => Math.abs(v) > 1e-4)) parts.push(`RotZ ${range(rzs, true)}°`);
  return parts.join(' · ') || '复位';
}

function standingStats() {
  if (standingStatsCache) return standingStatsCache;
  const types = { 1: 0, 2: 0, 3: 0, 5: 0, 6: 0, 9: 0 };
  let actions = 0, records = 0, nonuniform = 0;
  if (STANDING_DATA && STANDING_DATA.characters) {
    for (const [cid, ch] of Object.entries(STANDING_DATA.characters)) {
      const seen = new Set();
      for (const list of Object.values(ch.episodes || {})) {
        for (const a of list) {
          const key = cid + '|' + a.key;
          if (seen.has(key)) continue;
          seen.add(key);
          actions++;
          records += (a.records || []).length;
          for (const r of a.records || []) {
            if (types[r.type] != null) types[r.type]++;
            if (r.type === 9 && Math.abs(Number(r.values[0]) - Number(r.values[1])) > 1e-4) nonuniform++;
          }
        }
      }
    }
  }
  standingStatsCache = { actions, records, types, nonuniform };
  return standingStatsCache;
}

function standingUniqueActions(id) {
  const data = standingCharacterData(id);
  if (!data) return [];
  const seen = new Map();
  for (const list of Object.values(data.episodes || {})) {
    for (const a of list) if (!seen.has(a.key)) seen.set(a.key, a);
  }
  return Array.from(seen.values());
}

function standingComposerBase() {
  const line = STORY[state.line];
  const conf = (line && line.stage || []).find(c => c.id === standingComposer.char);
  return { x: conf ? (conf.x ?? 960) : 960, y: conf ? (conf.y ?? 1040) : 1040 };
}

function standingComposerStep(index) {
  return standingComposer.steps[index] || null;
}

function standingComposerLastStep() {
  return standingComposer.steps[standingComposer.steps.length - 1] || null;
}

function standingComposerPrevious(index) {
  return index > 0 ? standingComposer.steps[index - 1] : STANDING_STEP_DEFAULT;
}

function standingStepTimeline(steps) {
  let cursor = 0;
  return steps.map(step => {
    const gap = Math.max(0, Number(step.gap) || 0);
    const duration = Math.max(0.01, Number(step.duration) || 0.01);
    const start = cursor + gap;
    cursor = start + duration;
    return { start, duration };
  });
}

function standingComposerTotal() {
  const timeline = standingStepTimeline(standingComposer.steps);
  return timeline.length ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].duration : 0;
}

function standingStepSummary(step, previous) {
  const prev = previous || STANDING_STEP_DEFAULT;
  const parts = [];
  const signed = v => (v > 0 ? '+' : '') + (Math.round(v * 100) / 100);
  if (step.x !== prev.x) parts.push('ΔX ' + signed(step.x - prev.x));
  if (step.y !== prev.y) parts.push('ΔY ' + signed(step.y - prev.y));
  if (step.sx !== prev.sx || step.sy !== prev.sy) parts.push(`缩放 ${Math.round(step.sx * 100) / 100}×${Math.round(step.sy * 100) / 100}`);
  if (step.ry !== prev.ry) parts.push('RotY ' + signed(step.ry - prev.ry) + '°');
  if (step.rz !== prev.rz) parts.push('RotZ ' + signed(step.rz - prev.rz) + '°');
  return parts.join(' · ') || '停顿';
}

function standingCloneStep(step) {
  return {
    x: Number(step.x) || 0, y: Number(step.y) || 0,
    sx: step.sx == null ? 1 : Number(step.sx), sy: step.sy == null ? 1 : Number(step.sy),
    ry: Number(step.ry) || 0, rz: Number(step.rz) || 0,
    duration: Number(step.duration) || 0.4, gap: Math.max(0, Number(step.gap) || 0),
    ease: Number.isFinite(Number(step.ease)) ? Number(step.ease) : -1,
  };
}

function standingComposeRecords(steps) {
  const recs = [];
  const timeline = standingStepTimeline(steps);
  let prev = STANDING_STEP_DEFAULT;
  steps.forEach((step, i) => {
    const timing = timeline[i];
    const push = (type, values) => {
      recs.push({
        type, values, ease: step.ease,
        repeat: 0, duration: timing.duration, delay: timing.start, relative: false,
      });
    };
    if (step.x !== prev.x || step.y !== prev.y) {
      if (step.x !== prev.x && step.y !== prev.y) push(3, [step.x, step.y, 0]);
      else if (step.x !== prev.x) push(1, [step.x, 0, 0]);
      else push(2, [step.y, 0, 0]);
    }
    if (step.sx !== prev.sx || step.sy !== prev.sy) push(9, [step.sx, step.sy, 0]);
    if (step.ry !== prev.ry) push(5, [step.ry, 0, 0]);
    if (step.rz !== prev.rz) push(6, [step.rz, 0, 0]);
    prev = step;
  });
  return recs;
}

function normalizeStandingRecords(records) {
  return (records || []).map(r => ({
    ...r,
    values: [Number(r.values?.[0]) || 0, Number(r.values?.[1]) || 0, Number(r.values?.[2]) || 0],
  })).sort((a, b) => (Number(a.delay) || 0) - (Number(b.delay) || 0));
}

function setWorkshopStatus(text) {
  standingComposer.status = text;
  const el = document.getElementById('wfStatus');
  if (el) el.textContent = text;
}

function playStandingComposer() {
  const comp = standingComposer;
  const id = comp.char;
  const base = standingBaseFor(id);
  if (!base) return;
  let records = [];
  let label = '自定义编排';
  if (comp.mode === 'raw') {
    records = normalizeStandingRecords(comp.rawRecords);
    label = comp.rawSource || '自定义记录';
  } else {
    records = normalizeStandingRecords(standingComposeRecords(comp.steps));
    label = `自定义编排 · ${comp.steps.length} 步`;
  }
  if (!records.length) {
    setWorkshopStatus('没有可播放的记录：先添加步骤或载入真实动作。');
    return;
  }
  resetStandingActor(id);
  const total = standingActionTotal(records);
  standingPlay.set(id, { action: { key: label, records, total }, start: performance.now(), base });
  setStandingStatus(id, `${label} · ${total.toFixed(2)}s · ${records.length} 条记录`);
  setWorkshopStatus(`播放：${label} · ${total.toFixed(2)}s · ${records.length} 条 MoveType 记录`);
}

function appendStandingPresetSteps(steps, label) {
  if (!steps.length) return;
  const comp = standingComposer;
  const first = comp.steps.length;
  for (const step of steps) comp.steps.push(standingCloneStep(step));
  comp.selected = first;
  comp.mode = 'steps';
  setWorkshopStatus(`已追加预设：${label} · ${steps.length} 步`);
  renderStandingWorkshop();
  playStandingComposer();
}

function standingApplyDirection(dirId) {
  if (dirId === 'home') {
    const from = standingComposerLastStep() || STANDING_STEP_DEFAULT;
    resetStandingActor(standingComposer.char);
    const atBase = from.x === 0 && from.y === 0 && from.sx === 1 && from.sy === 1 && from.ry === 0 && from.rz === 0;
    if (atBase) {
      setWorkshopStatus('角色已归位到演示站位。');
      renderStandingWorkshop();
      return;
    }
    appendStandingPresetSteps([{ ...from, x: 0, y: 0, sx: 1, sy: 1, ry: 0, rz: 0, duration: 0.5, gap: 0 }], '归位');
    return;
  }
  const dir = STANDING_DIRECTIONS.find(d => d[0] === dirId);
  if (!dir) return;
  const p = standingComposer.params;
  const dist = Math.max(1, Math.min(4000, Number(p.distance) || 400));
  const from = standingComposerLastStep() || STANDING_STEP_DEFAULT;
  appendStandingPresetSteps([{
    ...from,
    x: from.x + dir[2] * dist,
    y: from.y + dir[3] * dist,
    duration: 0.6,
    gap: 0,
    ease: -1,
  }], `方向 ${dir[1]} · ${dist}px`);
}

function standingApplyPreset(name) {
  const p = standingComposer.params;
  const from = standingComposerLastStep() || STANDING_STEP_DEFAULT;
  const count = Math.max(1, Math.min(12, Math.round(Number(p.count) || 4)));
  const height = Math.max(1, Math.min(800, Number(p.height) || 30));
  const factor = Math.max(0.05, Math.min(6, Number(p.stretch) || 1.15));
  const angle = Math.max(1, Math.min(720, Number(p.angle) || 180));
  const steps = [];
  let cursor = { ...from };
  if (name === 'bounceY' || name === 'bounceX') {
    for (let i = 0; i < count; i++) {
      const up = { ...cursor, duration: 0.18, gap: 0, ease: -1 };
      if (name === 'bounceY') up.y = cursor.y + height; else up.x = cursor.x + height;
      steps.push(up);
      const back = { ...up };
      if (name === 'bounceY') back.y = cursor.y; else back.x = cursor.x;
      steps.push(back);
      cursor = back;
    }
    appendStandingPresetSteps(steps, `${name === 'bounceY' ? 'Y' : 'X'} 弹跳 ×${count}`);
    return;
  }
  if (name === 'swayX' || name === 'swayY') {
    const distance = Math.max(20, Number(p.distance) || 400);
    for (let i = 0; i < count; i++) {
      const out = { ...cursor, duration: 0.32, gap: 0, ease: -1 };
      if (name === 'swayX') out.x = cursor.x + distance; else out.y = cursor.y + distance;
      steps.push(out);
      const back = { ...out };
      if (name === 'swayX') back.x = cursor.x; else back.y = cursor.y;
      steps.push(back);
      cursor = back;
    }
    appendStandingPresetSteps(steps, `${name === 'swayX' ? 'X' : 'Y'} 方向往返 ×${count}`);
    return;
  }
  if (name === 'pulseX' || name === 'pulseY' || name === 'pulseXY') {
    for (let i = 0; i < count; i++) {
      const out = { ...cursor, duration: 0.22, gap: 0, ease: -1 };
      if (name === 'pulseX' || name === 'pulseXY') out.sx = cursor.sx * factor;
      if (name === 'pulseY' || name === 'pulseXY') out.sy = cursor.sy * factor;
      steps.push(out);
      steps.push({ ...out, sx: cursor.sx, sy: cursor.sy, duration: 0.22, gap: 0 });
      cursor = { ...out, sx: cursor.sx, sy: cursor.sy };
    }
    appendStandingPresetSteps(steps, `${name === 'pulseX' ? '横向' : name === 'pulseY' ? '纵向' : '等比'}拉伸 ×${count}`);
    return;
  }
  if (name === 'squash') {
    for (let i = 0; i < count; i++) {
      const out = { ...cursor, sx: cursor.sx * factor, sy: cursor.sy / factor, duration: 0.2, gap: 0, ease: -1 };
      steps.push(out);
      steps.push({ ...out, sx: cursor.sx, sy: cursor.sy, duration: 0.22, gap: 0 });
      cursor = { ...out, sx: cursor.sx, sy: cursor.sy };
    }
    appendStandingPresetSteps(steps, `压扁回弹 ×${count}`);
    return;
  }
  if (name === 'turnYPlus' || name === 'turnYMinus') {
    const delta = name === 'turnYPlus' ? angle : -angle;
    appendStandingPresetSteps([{ ...from, ry: from.ry + delta, duration: 0.5, gap: 0, ease: -1 }], `RotY ${delta > 0 ? '+' : ''}${delta}°`);
    return;
  }
  if (name === 'turnZPlus' || name === 'turnZMinus') {
    const delta = name === 'turnZPlus' ? angle : -angle;
    appendStandingPresetSteps([{ ...from, rz: from.rz + delta, duration: 0.5, gap: 0, ease: -1 }], `RotZ ${delta > 0 ? '+' : ''}${delta}°`);
    return;
  }
  if (name === 'comboBack') {
    appendStandingPresetSteps([{
      ...from,
      x: from.x - Math.max(120, Number(p.distance) * 0.5),
      y: from.y + Math.max(120, height * 8),
      sx: from.sx * 1.5, sy: from.sy * 1.5,
      duration: 0.7, gap: 0, ease: -1,
    }], '后跳放大（参考 101001001_78 结构）');
    return;
  }
  if (name === 'comboDash') {
    appendStandingPresetSteps([{
      ...from,
      x: from.x + Math.max(160, Number(p.distance)),
      y: from.y + Math.max(60, height * 3),
      sx: from.sx * 0.6, sy: from.sy * 0.6,
      duration: 0.65, gap: 0, ease: -1,
    }], '前冲缩小（参考 101001001_73 结构）');
    return;
  }
  if (name === 'comboLeap') {
    appendStandingPresetSteps([{
      ...from,
      x: from.x - Math.max(180, Number(p.distance) * 0.75),
      y: from.y + Math.max(160, height * 9),
      sx: from.sx * 0.7, sy: from.sy * 0.7,
      ry: from.ry + 180,
      duration: 0.8, gap: 0, ease: -1,
    }], '转身跃迁（参考 101001001_80 结构）');
  }
}

function loadStandingWorkshopSaved() {
  if (standingComposer.saved) return standingComposer.saved;
  try {
    const raw = localStorage.getItem(STANDING_WORKSHOP_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    standingComposer.saved = Array.isArray(list)
      ? list.filter(x => x && (Array.isArray(x.steps) || Array.isArray(x.rawRecords))).slice(0, 8)
      : [];
  } catch (e) {
    standingComposer.saved = [];
  }
  return standingComposer.saved;
}

function standingCloneRawRecord(record) {
  return {
    type: Number(record.type) || 3,
    values: [Number(record.values?.[0]) || 0, Number(record.values?.[1]) || 0, Number(record.values?.[2]) || 0],
    delay: Math.max(0, Number(record.delay) || 0),
    duration: Number.isFinite(Number(record.duration)) ? Number(record.duration) : 0.5,
    ease: Number.isFinite(Number(record.ease)) ? Number(record.ease) : -1,
  };
}

function saveStandingWorkshopPreset(name) {
  const comp = standingComposer;
  if (!comp.steps.length && !comp.rawRecords.length) {
    setWorkshopStatus('当前没有关键帧或原始记录可保存。');
    return;
  }
  const list = loadStandingWorkshopSaved();
  const clean = String(name || '').trim().slice(0, 24) || `我的编排 ${list.length + 1}`;
  const item = {
    name: clean,
    char: comp.char,
    coordMode: comp.coordMode,
    mode: comp.mode,
    steps: comp.steps.map(standingCloneStep),
    rawRecords: comp.rawRecords.map(standingCloneRawRecord),
    rawSource: comp.rawSource || '',
  };
  const existing = list.findIndex(x => x.name === clean);
  if (existing >= 0) list.splice(existing, 1, item); else list.unshift(item);
  if (list.length > 8) list.length = 8;
  try { localStorage.setItem(STANDING_WORKSHOP_STORAGE, JSON.stringify(list)); } catch (e) {}
  comp.saveDraft = '';
  const input = document.getElementById('wfSaveName');
  if (input) input.value = '';
  setWorkshopStatus(`已保存「${clean}」到本地预设（${list.length}/8）。`);
  renderStandingWorkshop();
}

function deleteStandingWorkshopPreset(index) {
  const list = loadStandingWorkshopSaved();
  if (!list[index]) return;
  const removed = list.splice(index, 1)[0];
  try { localStorage.setItem(STANDING_WORKSHOP_STORAGE, JSON.stringify(list)); } catch (e) {}
  setWorkshopStatus(`已删除本地预设「${removed.name}」。`);
  renderStandingWorkshop();
}

function loadStandingWorkshopPreset(index) {
  const list = loadStandingWorkshopSaved();
  const item = list[index];
  if (!item) return;
  const comp = standingComposer;
  comp.char = item.char === 'ner' ? 'ner' : 'erpin';
  comp.coordMode = item.coordMode === 'absolute' ? 'absolute' : 'offset';
  comp.steps = (item.steps || []).map(standingCloneStep);
  comp.rawRecords = (item.rawRecords || []).map(standingCloneRawRecord);
  comp.rawSource = item.rawSource || '';
  comp.rawSelectedAction = '';
  comp.selected = comp.steps.length ? 0 : -1;
  comp.mode = item.mode === 'raw' ? 'raw' : 'steps';
  setWorkshopStatus(`已载入本地预设「${item.name}」。`);
  renderStandingWorkshop();
  playStandingComposer();
}

function loadStandingRawAction(key) {
  if (!key) return;
  const comp = standingComposer;
  const data = standingCharacterData(comp.char);
  if (!data) return;
  let action = null;
  for (const list of Object.values(data.episodes || {})) {
    action = list.find(a => a.key === key);
    if (action) break;
  }
  if (!action) return;
  resetStandingActor(comp.char);
  comp.rawRecords = action.records.map(r => ({
    type: r.type,
    values: [Number(r.values[0]) || 0, Number(r.values[1]) || 0, Number(r.values[2]) || 0],
    delay: Number(r.delay) || 0,
    duration: Number(r.duration) || 0,
    ease: Number.isFinite(Number(r.ease)) ? Number(r.ease) : -1,
  }));
  comp.rawSelectedAction = key;
  comp.rawSource = `${key} · ${standingActionSummary(action)}`;
  comp.mode = 'raw';
  setWorkshopStatus(`已载入真实动作 ${key}：${action.records.length} 条记录，可逐项修改后播放。`);
  renderStandingWorkshop();
}

function standingRawFromSteps() {
  const comp = standingComposer;
  const records = standingComposeRecords(comp.steps);
  if (!records.length) {
    setWorkshopStatus('关键帧没有产生记录：请先添加并修改步骤。');
    return;
  }
  if (standingPlay.has(comp.char)) resetStandingActor(comp.char);
  comp.rawRecords = records.map(r => ({
    type: r.type, values: [...r.values], delay: r.delay, duration: r.duration, ease: r.ease,
  }));
  comp.rawSource = `关键帧编排 · ${comp.steps.length} 步`;
  comp.rawSelectedAction = '';
  comp.mode = 'raw';
  setWorkshopStatus(`已把 ${comp.steps.length} 步关键帧展开为 ${records.length} 条原始记录。`);
  renderStandingWorkshop();
}

function renderStandingWorkshop() {
  const el = document.getElementById('standWorkshop');
  if (!el) return;
  const save = document.getElementById('wfSaveName');
  if (save) standingComposer.saveDraft = save.value;
  el.innerHTML = standingWorkshopHtml();
}

function queueStandingWorkshopRender() {
  clearTimeout(standingWorkshopRenderTimer);
  standingWorkshopRenderTimer = setTimeout(() => {
    standingWorkshopRenderTimer = 0;
    renderStandingWorkshop();
  }, 120);
}

function sampleStageAnim(keys, t) {
  if (!keys || !keys.length) return null;
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const e = u * u * (3 - 2 * u);
      const out = {};
      for (const k of ['x', 'y', 'sx', 'sy', 'face', 'alpha']) {
        if (a[k] !== undefined || b[k] !== undefined) {
          const av = a[k] ?? b[k], bv = b[k] ?? a[k];
          out[k] = av + (bv - av) * e;
        }
      }
      return out;
    }
  }
  return keys[keys.length - 1];
}


function storyEase(p, name) {
  return window.TrickcalCameraTimeline.ease(p, name);
}

function applyActorActions(line, id, s, now, dt) {
  if (state.stopStageAt != null) now = Math.min(now, state.stopStageAt);
  const t = (now - state.lineStart) / 1000;
  let latestStageEvent = null;
  const stageEvents = state.stoppedStageEvents || state.lineEvents.slice(0, state.lineEventIndex);
  for (const event of stageEvents) {
    if (event.type !== 'stage' || event.delay > t) continue;
    if (event.action === 'show' ? event.conf?.id === id : event.id === id || event.id === 'all' || event.id === 'stage') {
      latestStageEvent = event;
    }
  }
  if (latestStageEvent?.action === 'hide') return false;
  const actions = line && Array.isArray(line.actions) ? line.actions.filter(a =>
    a.actor === id && a.targetKind !== 'ui' && (!latestStageEvent ||
      a.delay > latestStageEvent.delay ||
      (a.delay === latestStageEvent.delay && (a.sourceLine || 0) > (latestStageEvent.sourceLine || 0)))) : null;
  if (!actions || !actions.length) return false;
  const conf = s.conf || (line.stage || []).find(a => a.id === id) || {};
  const absolute = {};
  const relative = {};
  for (const a of actions) {
    if (t < (a.delay || 0)) continue;
    const p = a.duration === 0 ? 1 : Math.max(0, Math.min(1, (t - (a.delay || 0)) / Math.max(0.0001, a.duration || 0.0001)));
    const e = storyEase(p, a.ease || 'OutCubic');
    const v = a.from + (a.to - a.from) * e;
    if (a.relative) relative[a.property] = (relative[a.property] || 0) + v;
    else absolute[a.property] = v;
  }
  if (!Object.keys(absolute).length && !Object.keys(relative).length) return false;
  const pick = (prop, base) => {
    if (absolute[prop] !== undefined) return absolute[prop] + (relative[prop] || 0);
    if (relative[prop] !== undefined) return base + relative[prop];
    return null;
  };
  const x = pick('x', conf.x ?? s.targetX);
  const y = pick('y', conf.y ?? s.targetY);
  const sx = pick('sx', conf.sx ?? s.targetSX);
  const sy = pick('sy', conf.sy ?? s.targetSY);
  const rot = pick('rot', conf.rot ?? 0);
  const alpha = pick('alpha', conf.alpha ?? 1);
  const brightness = pick('brightness', conf.brightness ?? 1);
  if (x !== null) { s.x = x; s.targetX = x; }
  if (y !== null) { s.y = y; s.targetY = y; }
  if (sx !== null) { s.sx = sx; s.targetSX = sx; }
  if (sy !== null) { s.sy = sy; s.targetSY = sy; }
  if (rot !== null) { s.rot = rot; if ('targetRot' in s) s.targetRot = rot; }
  if (alpha !== null) { s.alpha = Math.max(0, Math.min(1, alpha)); s.targetAlpha = s.alpha; }
  if (brightness !== null) s.brightness = Math.max(0, brightness);
  const k = 1 - Math.exp(-dt * 12);
  if (x === null) s.x += (s.targetX - s.x) * k;
  if (y === null) s.y += (s.targetY - s.y) * k;
  if (sx === null) s.sx += (s.targetSX - s.sx) * k;
  if (sy === null) s.sy += (s.targetSY - s.sy) * k;
  if (alpha === null) s.alpha += (s.targetAlpha - s.alpha) * k;
  return true;
}


const oneShotDataCache = new Map();
async function loadOneShotData(dir, file) {
  if (!initSpineGL()) return null;
  const key = dir + '|' + file;
  if (oneShotDataCache.has(key)) return oneShotDataCache.get(key);
  const promise = (async () => {
    const assets = new spine.AssetManager(spineGL, assetUrl(dir));
    await new Promise((res, bad) => assets.loadBinary(file + '.skel.bytes', res, (p, m) => bad(new Error(m || p))));
    await new Promise((res, bad) => assets.loadTextureAtlas(file + '.atlas.txt', res, (p, m) => bad(new Error(m || p))));
    const atlas = assets.require(file + '.atlas.txt');
    const bin = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas));
    const data = bin.readSkeletonData(assets.require(file + '.skel.bytes'));
    return data;
  })();
  oneShotDataCache.set(key, promise);
  promise.catch(() => { if (oneShotDataCache.get(key) === promise) oneShotDataCache.delete(key); });
  return promise;
}

async function prepareOneShot(line, lineIndex, options = {}) {
  if (!options.parallel) state.oneShot = null;
  const storyLine = options.storyLine || line;
  const generation = options.generation ?? state.oneShotGeneration;
  try {
    const data = await loadOneShotData(line.spineDir || 'assets/spine/emoticon/', line.spineFile || 'Emoticon');
    if (generation !== state.oneShotGeneration || state.line !== lineIndex || STORY[state.line] !== storyLine) return;
    if (!data) throw new Error('无法初始化 Spine 渲染');
    const skeleton = new spine.Skeleton(data);
    if (line.skin && data.findSkin(line.skin)) skeleton.setSkinByName(line.skin);
    else if (data.findSkin('Normal')) skeleton.setSkinByName('Normal');
    skeleton.setToSetupPose();
    skeleton.setSlotsToSetupPose();
    const stateData = new spine.AnimationStateData(data);
    stateData.defaultMix = 0;
    const anim = new spine.AnimationState(stateData);
    const clip = data.animations.find(a => a.name === line.anim) || data.animations[0];
    if (!clip) throw new Error('Spine 素材没有可播放的动画');
    anim.setAnimation(0, clip.name, false);
    const start = options.startAt ?? (options.parallel
      ? state.lineStart + (Number(options.delay) || 0) * 1000
      : performance.now());
    const duration = Math.max(0.1, Number(clip.duration) || 1);
    const clockNow = state.freeze && state.freezeTime ? state.freezeTime : performance.now();
    const elapsed = Math.max(0, (clockNow - start) / 1000);
    if (elapsed >= duration + 0.2) return;
    anim.update(elapsed);
    anim.apply(skeleton);
    skeleton.updateWorldTransform();
    const shot = {
      data, skeleton, anim, clip, duration, start, lastTime: Math.max(start, clockNow),
      line,
      x: Number(line.x ?? 960),
      y: Number(line.y ?? 540),
      scale: Number(line.scale ?? 1),
      face: line.face < 0 ? -1 : 1,
      rot: Number(line.rot) || 0,
      alpha: line.alpha == null ? 1 : Number(line.alpha),
    };
    if (options.parallel) {
      state.parallelOneShots.set(options.key, shot);
      state.readyAt = Math.max(state.readyAt, start + (duration + 0.2) * 1000);
    }
    else {
      state.oneShot = shot;
      state.readyAt = shot.start + duration * 1000 + 200;
    }
  } catch (e) {
    console.warn('oneshot spine failed', e);
    if (!options.parallel && generation === state.oneShotGeneration && state.line === lineIndex) state.readyAt = performance.now() + 400;
  } finally {
    if (options.parallel && generation === state.oneShotGeneration) state.pendingParallelOneShots--;
  }
}

function updateStageObjects(now) {
  const line = STORY[state.line];
  const imageDt = 1 / 60;
  const actorDt = spineReady && spineScene && state.started && !state.endShown &&
    (stageActors.size || state.oneShot || state.parallelOneShots.size)
    ? Math.min(0.05, Math.max(0, (now - spineLast) / 1000)) : 0;
  if (actorDt || (spineReady && spineScene && (stageActors.size || state.oneShot || state.parallelOneShots.size))) spineLast = now;
  const updated = new Set(), visiting = new Set();

  function update(id, s, isImage) {
    if (!s || updated.has(s) || visiting.has(s)) return;
    visiting.add(s);
    const conf = { ...(s.conf || {}), ...(state.stageBindings.get(id) || {}) };
    if (conf.parent) {
      const parentActor = stageActors.get(conf.parent);
      const parentImage = stageImages.get(conf.parent);
      if (parentActor) update(conf.parent, parentActor, false);
      else if (parentImage) update(conf.parent, parentImage, true);
    }
    if (isImage) {
      const animated = applyActorActions(line, id, s, now, imageDt);
      if (!animated) {
        const k = 1 - Math.exp(-imageDt * 12);
        s.x += (s.targetX - s.x) * k; s.y += (s.targetY - s.y) * k;
        s.sx += (s.targetSX - s.sx) * k; s.sy += (s.targetSY - s.sy) * k;
        s.rot += (s.targetRot - s.rot) * k; s.alpha += (s.targetAlpha - s.alpha) * k;
      }
    } else {
      const play = line && line.mode === 'standing' ? standingPlay.get(id) : null;
      if (play) {
        const v = evaluateStandingAction(play, (now - play.start) / 1000);
        s.x = play.base.x + v.x;
        s.y = play.base.y - v.y;
        s.sx = play.base.sx * v.sx;
        s.sy = play.base.sy * v.sy;
        s.ry = v.ry;
        s.rot = v.rz;
        s.alpha = v.alpha;
      } else if (applyActorActions(line, id, s, now, actorDt)) {
        s.ry = 0;
      } else {
        const k = 1 - Math.exp(-actorDt * 12);
        s.x += (s.targetX - s.x) * k;
        s.y += (s.targetY - s.y) * k;
        s.sx += (s.targetSX - s.sx) * k;
        s.sy += (s.targetSY - s.sy) * k;
        s.alpha += (s.targetAlpha - s.alpha) * k;
        s.rot = (s.rot || 0) * (1 - k);
        s.ry = (s.ry || 0) * (1 - k);
      }
    }
    if (conf.parent) {
      const parent = stageActors.get(conf.parent) || stageImages.get(conf.parent);
      if (parent) {
        const px = parent.x ?? 0, py = parent.y ?? 0;
        const psx = parent.sx ?? 1, psy = parent.sy ?? 1;
        const rad = (Number(parent.rot) || 0) * Math.PI / 180;
        const lx = Number(conf.localX) || 0, ly = Number(conf.localY) || 0;
        s.x = px + lx * Math.cos(rad) * psx - ly * Math.sin(rad) * psy;
        s.y = py + lx * Math.sin(rad) * psx + ly * Math.cos(rad) * psy;
        s.sx = psx * (conf.sx ?? 1);
        s.sy = psy * (conf.sy ?? 1);
        s.rot = (Number(parent.rot) || 0) + (Number(conf.rot) || 0);
        s.targetX = s.x; s.targetY = s.y; s.targetSX = s.sx; s.targetSY = s.sy;
        if (isImage) s.targetRot = s.rot;
      }
    }
    visiting.delete(s);
    updated.add(s);
  }

  for (const [id, s] of stageImages) update(id, s, true);
  for (const [id, s] of stageActors) update(id, s, false);
  for (const [id, s] of stageImages) {
    if (s.alpha <= 0.004 && s.targetAlpha === 0 && !(state.stageBase || line?.stage || []).some(item => item.id === id && item.kind === 'image')) {
      stageImages.delete(id);
    }
  }
  return actorDt;
}

function drawImageStage() {
  if (!stageImages.size) return;
  const orderedImages = [...stageImages.entries()].sort((a, b) => (a[1].z || 0) - (b[1].z || 0));
  for (const [id, s] of orderedImages) {
    const conf = { ...(s.conf || {}), ...(state.stageBindings.get(id) || {}) };
    const im = IMG[stageImageKey(conf.src)];
    if (!im) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha));
    if ((s.brightness ?? 1) !== 1) ctx.filter = `${ctx.filter === 'none' ? '' : ctx.filter + ' '}brightness(${Math.max(0, s.brightness)})`;
    ctx.translate(s.x, s.y);
    ctx.rotate((s.rot || 0) * Math.PI / 180);
    ctx.scale(s.sx, -s.sy);
    ctx.drawImage(im, -im.width / 2, -im.height / 2);
    ctx.restore();
  }
}

function drawSpineStage(now, dt, render = true) {
  if (!spineReady || !spineScene || !state.started || state.endShown) return;
  if (!stageActors.size && !state.oneShot && !state.parallelOneShots.size) return;
  const line = STORY[state.line];
  const visible = [];
  const orderedActors = [...stageActors.entries()].sort((a, b) => (a[1].z || 0) - (b[1].z || 0));
  for (const [id, s] of orderedActors) {
    const actor = spineActors.get(id);
    if (!actor) continue;
    if (s.alpha <= 0.008 && s.targetAlpha === 0 && !(state.stageBase || line?.stage || []).some(item => item.id === id && item.kind !== 'image')) {
      stageActors.delete(id); continue;
    }
    const alpha = Math.max(0, Math.min(1, s.alpha));
    const faceSign = s.face < 0 ? -1 : 1;
    const ryCos = Math.cos((s.ry || 0) * Math.PI / 180);
    for (const boneName of ['Character_Ball_Move', 'Character_Pat', 'Character_Tickle']) {
      const bone = actor.skeleton.findBone(boneName);
      if (bone) { bone.x = bone.data.x; bone.y = bone.data.y; }
    }
    updateInteractionOffsets(actor, dt);
    actor.anim.update(dt);
    actor.anim.apply(actor.skeleton);
    const sk = actor.skeleton;
    sk.x = s.x - W / 2;
    sk.y = H / 2 - s.y;
    sk.scaleX = faceSign * s.sx * ryCos;
    sk.scaleY = s.sy;
    const root = sk.getRootBone();
    // MoveType 6 (RotateZ) is applied to the Move node, i.e. around the feet.
    if (root) root.rotation = s.rot || 0;
    if (sk.color) sk.color.a = alpha;
    applyInteractionPose(actor);
    sk.updateWorldTransform();
    if (!render) continue;
    visible.push({ actor, s, alpha, ryCos });
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.26 * alpha})`;
    ctx.beginPath();
    const shadowW = Math.max(36, (actor.data.width || 400) * 0.22 * Math.abs(s.sx) * Math.abs(ryCos));
    ctx.ellipse(s.x, s.y - 2, shadowW, Math.max(14, shadowW * 0.11), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const drawOneShot = (os) => {
    const elapsed = (now - os.start) / 1000;
    if (elapsed < 0) return true;
    if (elapsed >= os.duration + 0.2) {
      return false;
    } else {
      const shotDt = Math.max(0, Math.min(0.05, (now - os.lastTime) / 1000));
      os.lastTime = now;
      os.anim.update(shotDt);
      os.anim.apply(os.skeleton);
      os.skeleton.x = os.x - W / 2;
      os.skeleton.y = H / 2 - os.y;
      os.skeleton.scaleX = os.face * os.scale;
      os.skeleton.scaleY = os.scale;
      const root = os.skeleton.getRootBone();
      if (root) root.rotation = os.rot;
      const fade = elapsed > os.duration ? Math.max(0, 1 - (elapsed - os.duration) / 0.2) : 1;
      const alpha = Math.max(0, Math.min(1, os.alpha * fade));
      if (os.skeleton.color) os.skeleton.color.a = alpha;
      os.skeleton.updateWorldTransform();
      if (render && alpha > 0.004) visible.push({ actor: { skeleton: os.skeleton }, s: { x: os.x, y: os.y }, alpha, ryCos: 1 });
      return true;
    }
  };
  const os = state.oneShot;
  if (os && !drawOneShot(os)) state.oneShot = null;
  for (const [key, parallelShot] of state.parallelOneShots) {
    if (!drawOneShot(parallelShot)) state.parallelOneShots.delete(key);
  }
  if (!render) return;
  spineGL.viewport(0, 0, spineGLCanvas.width, spineGLCanvas.height);
  spineGL.clearColor(0, 0, 0, 0);
  if (visible.length) {
    const separate = visible.some(it => (it.s.brightness ?? 1) !== 1);
    if (!separate) {
      spineGL.clear(spineGL.COLOR_BUFFER_BIT);
      spineScene.begin();
      for (const it of visible) spineScene.drawSkeleton(it.actor.skeleton);
      spineScene.end();
      ctx.drawImage(spineGLCanvas, 0, 0, W, H);
    } else {
      for (const it of visible) {
        spineGL.clear(spineGL.COLOR_BUFFER_BIT);
        spineScene.begin();
        spineScene.drawSkeleton(it.actor.skeleton);
        spineScene.end();
        ctx.save();
        const brightness = Math.max(0, it.s.brightness ?? 1);
        if (brightness !== 1) ctx.filter = `${ctx.filter === 'none' ? '' : ctx.filter + ' '}brightness(${brightness})`;
        ctx.drawImage(spineGLCanvas, 0, 0, W, H);
        ctx.restore();
      }
    }
  }
}

/* ---------------------------------------------------------------- speakers + story */
const CAST = {
  erpin: { name: '艾尔芬', color: '#e7b35f', img: 'erpin' },
  ner:   { name: '内尔',   color: '#93a3e0', img: 'ner' },
};

function lineSpeakerName(line) {
  if (!line) return '';
  if (line.speakerName != null) return line.speakerName;
  return line.speaker && CAST[line.speaker] ? CAST[line.speaker].name : '';
}

// NormalText has two real animation states (Normal / Cloud); the sender and
// emoticon slots are independent prefab children. These variants only toggle
// those recovered nodes, they do not invent another box mesh.
const NORMAL_VARIANTS = [
  ['normal', '普通'],
  ['normalNoName', '普通 · 无名字'],
  ['cloud', '云朵 · 无名字'],
  ['cloudName', '云朵 · 有名字'],
  ['blast', '爆炸框 · 有名字'],
  ['blastNoName', '爆炸框 · 无名字'],
];
let EMOTICON_DATA = null;
let emoteLabRaf = 0;
let emoteLabCards = [];
let emoteLabStart = 0;

function normalVariantFor(line) {
  if (line && line.dialogueVariant && NORMAL_VARIANTS.some(v => v[0] === line.dialogueVariant)) {
    return line.dialogueVariant;
  }
  return line && line.mode === 'cloud' ? 'cloud' : 'normal';
}

function normalVariantLabel(id) {
  const hit = NORMAL_VARIANTS.find(v => v[0] === id);
  return hit ? hit[1] : id;
}

const STORY = [];
let STORY_VARIABLES = {};

/* ---------------------------------------------------------------- state */
const state = {
  started: false,
  renderingEnabled: true,
  updateCount: 0,
  renderCount: 0,
  line: -1,
  phase: 'idle',
  lineStart: 0,
  dialogueStartAt: 0,
  lineEvents: [],
  lineEventIndex: 0,
  oneShotGeneration: 0,
  pendingParallelOneShots: 0,
  lineActorOverrides: new Map(),
  pendingStageEvents: [],
  stageBindings: new Map(),
  stageBase: null,
  stopStageAt: null,
  stoppedStageEvents: null,
  parallelOneShots: new Map(),
  lineCameraTimeline: null,
  lineEffectTimeline: null,
  sceneFx: null,
  bgTransition: null,
  bgFrozenLayers: null,
  shader: null,
  bubbleScrollManual: null,
  bubbleScrollGesture: null,
  typingStart: 0,
  typingPlan: null,
  typingDone: false,
  doneAt: 0,
  readyAt: 0,
  auto: false,
  transition: null,
  transitionGeneration: 0,
  titleSkipped: false,
  endShown: false,
  tailDir: 'bl',
  bgSolid: true,
  bgColor: '#00ff00',
  bgKey: 'bgElfCity',
  camera: { zoom: 1, x: 0, y: 0, targetX: W / 2, targetY: H / 2, rot: 0, follow: null, offsetX: 0, offsetY: 0 },
  suppressClickUntil: 0,
  shadowColor: '#000000',
  shadowAlpha: 0.4,
  hoverBranch: -1,
  variables: {},
  variableHistory: new Map(),
};

const modeRuntime = {};
for (const k of Object.keys(MODES)) {
  modeRuntime[k] = { name: k, root: MODES[k], visible: false, clips: [], line: null, startedAt: 0, drawOverrides: new Map(), extra: {} };
}

let uiObjects = new Map();
const uiTyping = new Map();
const uiCheckpoints = new Map();
const uiEntrances = new Map();
const uiEntranceSuppressed = new Set();
let uiExits = [];
const UI_EXIT_MS = 220;

function applyUiOperation(operation, now, stage, options = {}) {
  const externalParents = new Set((stage || []).map(conf => conf.id));
  if (operation.type === 'create' && externalParents.has(operation.node.id)) {
    throw new Error(`UI 名称与舞台对象重复：${operation.node.id}`);
  }
  if (operation.type === 'set' && Object.prototype.hasOwnProperty.call(operation.values || {}, 'text')) {
    const node = uiObjects.get(operation.id);
    if (!node || node.kind !== 'text') throw new Error(`打字机不存在：${operation.id}`);
  }
  if (operation.type === 'set') {
    const node = uiObjects.get(operation.id);
    const keys = Object.keys(operation.values || {});
    if (node && node.kind !== 'text' && keys.some(key => ['fontSize', 'speed', 'color', 'overflow'].includes(key))) {
      throw new Error(`文字属性只能用于打字机：${operation.id}`);
    }
    if (node && !['bubble', 'box'].includes(node.kind) && keys.includes('style')) {
      throw new Error(`样式只能用于气泡或框体：${operation.id}`);
    }
    if (node && node.kind !== 'bubble' && keys.includes('tail')) {
      throw new Error(`尾巴只能用于气泡：${operation.id}`);
    }
    if (node && keys.includes('style')) {
      const supported = node.kind === 'bubble'
        ? ['manga', 'think', 'purple', 'thought']
        : ['normal', 'purple', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx'];
      if (!supported.includes(operation.values.style)) throw new Error(`对象不支持该样式：${operation.values.style}`);
    }
  }
  const previous = uiObjects;
  const next = window.TrickcalSceneState.applyOperations(previous, [operation], { externalParents });
  if (operation.type === 'remove' && !options.reconstruct) {
    const world = uiWorldTransforms(now);
    for (const [id, node] of previous) {
      if (!next.has(id) && world.has(id)) {
        uiExits.push({ node: { ...node }, transform: world.get(id), start: now,
          height: node.kind === 'text' ? undefined : uiBubbleHeight(node),
          visibleChars: node.kind === 'text' ? uiTextVisible(node, now) : 0 });
      }
    }
  }
  uiObjects = next;
  if (operation.type === 'create' && operation.node.kind !== 'text') {
    uiEntrances.set(operation.node.id, now);
    uiEntranceSuppressed.delete(operation.node.id);
  }
  if (operation.type === 'set' && Object.hasOwn(operation.values || {}, 'style') &&
      previous.get(operation.id)?.style !== next.get(operation.id)?.style) {
    uiEntrances.set(operation.id, now);
    uiEntranceSuppressed.delete(operation.id);
  }
  if (operation.type === 'set' && Object.prototype.hasOwnProperty.call(operation.values || {}, 'text')) {
    uiTyping.set(operation.id, { start: now, complete: false });
  }
  for (const id of uiTyping.keys()) if (!uiObjects.has(id)) uiTyping.delete(id);
  for (const id of uiEntrances.keys()) if (!uiObjects.has(id)) uiEntrances.delete(id);
  for (const id of uiEntranceSuppressed) if (!uiObjects.has(id)) uiEntranceSuppressed.delete(id);
}

function uiTextVisible(node, now) {
  const plan = getRichTypingPlan(node.text || '', node.speed);
  const typing = uiTyping.get(node.id);
  if (!typing || typing.complete) return plan.charCount;
  return richVisibleCount(plan, now - typing.start);
}

const UI_ANIMATED_PROPERTIES = ['x', 'y', 'sx', 'sy', 'rot', 'alpha'];

function compareUiTime(a, b) {
  return (a.delay || 0) - (b.delay || 0) || (a.sourceLine || 0) - (b.sourceLine || 0);
}

function recordUiActionFences(before, after, event, fences) {
  const op = event.operation;
  const mark = (id, properties) => {
    let fields = fences.get(id);
    if (!fields) { fields = new Map(); fences.set(id, fields); }
    for (const property of properties) fields.set(property, event);
  };
  if (op.type === 'create') mark(op.node.id, UI_ANIMATED_PROPERTIES);
  else if (op.type === 'remove') {
    for (const id of before.keys()) if (!after.has(id)) mark(id, UI_ANIMATED_PROPERTIES);
  } else if (op.type === 'bind') mark(op.id, ['x', 'y']);
  else if (op.type === 'set') mark(op.id, UI_ANIMATED_PROPERTIES.filter(key => Object.hasOwn(op.values || {}, key)));
}

function sampleUiActions(source, actions, elapsed, fences, boundary) {
  actions = (actions || []).filter(action => action.targetKind === 'ui');
  if (!actions.length) return source;
  const nodes = new Map(source);
  const grouped = new Map();
  for (const action of actions) {
    const node = nodes.get(action.actor);
    if (!node) continue;
    if (elapsed < (action.delay || 0)) continue;
    if (boundary && compareUiTime(action, boundary) > 0) continue;
    const fence = fences?.get(action.actor)?.get(action.property);
    if (fence && compareUiTime(action, fence) <= 0) continue;
    const key = `${action.actor}\0${action.property}`;
    if (!grouped.has(key)) grouped.set(key, { id: action.actor, property: action.property, absolute: null, relative: 0 });
    const group = grouped.get(key);
    const progress = action.duration === 0 ? 1 : Math.max(0, Math.min(1, (elapsed - (action.delay || 0)) / Math.max(0.0001, action.duration || 0.0001)));
    const value = action.from + (action.to - action.from) * storyEase(progress, action.ease || 'OutCubic');
    if (action.relative) group.relative += value;
    else group.absolute = value;
  }
  for (const group of grouped.values()) {
    const node = nodes.get(group.id);
    const fallback = ['sx', 'sy', 'alpha'].includes(group.property) ? 1 : 0;
    const base = group.absolute == null ? (node[group.property] ?? fallback) : group.absolute;
    const value = base + group.relative;
    nodes.set(group.id, { ...node, [group.property]: group.property === 'alpha' ? Math.max(0, Math.min(1, value)) : value });
  }
  return nodes;
}

function animatedUiObjects(now) {
  if (state.uiActionsCommitted) return uiObjects;
  const line = STORY[state.line];
  return sampleUiActions(uiObjects, line && line.actions, (now - state.lineStart) / 1000,
    state.uiActionFences, state.uiSamplingBoundary);
}

function stageBeforeUiEvent(line, target) {
  const stage = new Map((line.stage || []).map(conf => [conf.id, conf]));
  for (const event of line.events || []) {
    if (event === target || event.delay > target.delay ||
        (event.delay === target.delay && event.sourceLine >= target.sourceLine)) break;
    if (event.type !== 'stage') continue;
    if (event.action === 'show') stage.set(event.conf.id, event.conf);
    else if (event.id === 'all' || event.id === 'stage') stage.clear();
    else stage.delete(event.id);
  }
  return [...stage.values()];
}

function restoreUiForSeek(target, replay = false) {
  const saved = uiCheckpoints.get(target);
  uiObjects = saved ? new Map(replay ? saved.before : saved.after) : new Map();
  uiTyping.clear();
  uiEntrances.clear();
  uiEntranceSuppressed.clear();
  uiExits = [];
  if (saved && replay) {
    for (const node of uiObjects.values()) {
      if (node.kind === 'text') uiTyping.set(node.id, { start: 0, complete: true });
      else uiEntrances.set(node.id, -Infinity);
    }
    for (const line of saved.operations) applyUiOperation(line.operation, performance.now(), line.stage, { reconstruct: true });
  } else if (!saved) {
    const path = window.TrickcalStoryNavigation.findPath(STORY, target);
    if (!path) throw new Error('该剧情行从入口不可达。');
    const preceding = path.slice(0, -1);
    let replayFrom = preceding.length;
    if (replay) while (replayFrom > 0 && STORY[preceding[replayFrom - 1]].mode === 'ui-op') replayFrom--;
    for (let position = 0; position < preceding.length; position++) {
      const index = preceding[position];
      const line = STORY[index];
      if (line.mode === 'ui-op') applyUiOperation(line.operation, position >= replayFrom ? performance.now() : -Infinity, line.stage, { reconstruct: true });
      const fences = new Map();
      const timeline = [
        ...(line.events || []).filter(event => event.type === 'ui').map(event => ({ event, delay: event.delay, sourceLine: event.sourceLine })),
        ...(line.actions || []).filter(action => action.targetKind === 'ui').map(action => ({ action, delay: action.delay, sourceLine: action.sourceLine })),
      ].sort(compareUiTime);
      for (const item of timeline) {
        if (item.action) {
          if (!uiObjects.has(item.action.actor)) {
            const error = new Error(`动画对象不存在：${item.action.actor}`);
            error.sourceLine = item.action.sourceLine;
            throw error;
          }
        } else {
          const before = uiObjects;
          try { applyUiOperation(item.event.operation, -Infinity, stageBeforeUiEvent(line, item.event), { reconstruct: true }); }
          catch (error) { error.sourceLine = item.event.sourceLine; throw error; }
          recordUiActionFences(before, uiObjects, item.event, fences);
        }
      }
      if (line.actions) {
        const end = line.actions.reduce((max, action) => Math.max(max, (action.delay || 0) + (action.duration || 0)), 0);
        uiObjects = sampleUiActions(uiObjects, line.actions, end, fences);
      }
    }
  }
  for (const node of uiObjects.values()) {
    const typing = uiTyping.get(node.id);
    if (node.kind === 'text' && (!replay || !typing || typing.start === -Infinity)) uiTyping.set(node.id, { start: 0, complete: true });
  }
  const idleStart = performance.now();
  for (const [id, start] of uiEntrances) {
    if (!replay || !Number.isFinite(start)) {
      uiEntrances.set(id, idleStart);
      uiEntranceSuppressed.add(id);
    }
  }
}

function uiTypingComplete(now) {
  for (const node of uiObjects.values()) {
    const typing = uiTyping.get(node.id);
    if (node.kind === 'text' && typing && !typing.complete && now - typing.start < getRichTypingPlan(node.text || '', node.speed).total) return false;
  }
  return true;
}

function timedUiTypingComplete(line, now) {
  return !line?.events?.some(event => event.type === 'ui' && event.operation.type === 'set' &&
    Object.hasOwn(event.operation.values || {}, 'text')) || uiTypingComplete(now);
}

function drawUiSlice(image, width, height, border) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const sx = Math.min(border, iw / 2), sy = Math.min(border, ih / 2);
  const dx = Math.min(sx, width / 2), dy = Math.min(sy, height / 2);
  const sourceX = [0, sx, iw - sx], sourceY = [0, sy, ih - sy];
  const sourceW = [sx, iw - 2 * sx, sx], sourceH = [sy, ih - 2 * sy, sy];
  const targetX = [-width / 2, -width / 2 + dx, width / 2 - dx];
  const targetY = [-height / 2, -height / 2 + dy, height / 2 - dy];
  const targetW = [dx, width - 2 * dx, dx], targetH = [dy, height - 2 * dy, dy];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
    if (sourceW[x] > 0 && sourceH[y] > 0 && targetW[x] > 0 && targetH[y] > 0) {
      ctx.drawImage(image, sourceX[x], sourceY[y], sourceW[x], sourceH[y], targetX[x], targetY[y], targetW[x], targetH[y]);
    }
  }
}

function uiWorldTransforms(now = performance.now()) {
  const nodes = new Map(animatedUiObjects(now));
  for (const [id, node] of nodes) {
    if (node.kind === 'text') continue;
    const animation = uiAnimation(node, now);
    const angle = (node.rot ?? 0) * Math.PI / 180;
    const sx = node.sx ?? 1, sy = node.sy ?? 1;
    const dx = animation.x * sx, dy = animation.y * sy;
    nodes.set(id, { ...node,
      x: (node.x ?? 0) + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: (node.y ?? 0) + dx * Math.sin(angle) + dy * Math.cos(angle),
      sx: sx * animation.sx, sy: sy * animation.sy,
      alpha: (node.alpha ?? 1) * animation.alpha });
  }
  const cam = state.camera || {};
  const zoom = Math.max(0.001, Number(cam.zoom) || 1);
  let camX = Number(cam.x) || 0, camY = Number(cam.y) || 0;
  let targetX = Number(cam.targetX ?? W / 2), targetY = Number(cam.targetY ?? H / 2);
  const follow = cam.follow && stageActors.get(cam.follow);
  if (follow) {
    camX = 0; camY = 0;
    targetX = follow.x - (Number(cam.offsetX) || 0) / zoom;
    targetY = follow.y - (Number(cam.offsetY) || 0) / zoom;
  }
  const angle = (Number(cam.rot) || 0) * Math.PI / 180;
  const stageObjects = [
    ...[...stageImages].map(([id, live]) => ({ id, live, isImage: true })),
    ...[...stageActors].map(([id, live]) => ({ id, live, isImage: false })),
  ];
  for (const { id, live, isImage } of stageObjects) {
    if (nodes.has(id)) continue;
    const conf = live.conf || {};
    const x = live.x ?? conf.x ?? 0;
    const y = live.y ?? conf.y ?? 0;
    const dx = x - targetX, dy = y - targetY;
    nodes.set(id, {
      x: W / 2 + camX + zoom * (dx * Math.cos(angle) - dy * Math.sin(angle)),
      y: H / 2 + camY + zoom * (dx * Math.sin(angle) + dy * Math.cos(angle)),
      sx: zoom * (live.sx ?? conf.sx ?? 1) * ((live.face ?? conf.face) < 0 ? -1 : 1),
      sy: zoom * (live.sy ?? conf.sy ?? 1),
      rot: (Number(cam.rot) || 0) + (Number(live.rot ?? conf.rot) || 0),
      alpha: live.alpha ?? conf.alpha ?? 1,
      visible: isImage ? !!IMG[stageImageKey(conf.src)] : spineActors.has(id),
    });
  }
  for (const node of uiObjects.values()) {
    if (node.parent && !nodes.has(node.parent)) nodes.set(node.parent, { visible: false });
  }
  return window.TrickcalSceneGraph.resolveWorldTransforms(nodes);
}

function uiBubbleHeight(node) {
  const fitting = node.fitText && uiObjects.get(node.fitText);
  const measured = fitting && fitting.kind === 'text'
    ? getRichLayout(fitting.text || '', fitting.width, fitting.fontSize, FONT_DIALOGUE, 1.34).height + (node.paddingY ?? 80)
    : node.height;
  return Math.min(Math.max(node.height, node.maxHeight ?? 1200), Math.max(node.height, measured));
}

function uiTextHeight(node, layout) {
  if (node.overflow !== 'grow') return node.height;
  layout = layout || getRichLayout(node.text || '', node.width, node.fontSize, FONT_DIALOGUE, 1.34);
  return Math.min(Math.max(node.height, node.maxHeight ?? 1200), Math.max(node.height, layout.height));
}

function uiAnimation(node, now) {
  const start = uiEntrances.get(node.id);
  const identity = { sx: 1, sy: 1, alpha: 1, x: 0, y: 0 };
  if (start == null || !Number.isFinite(start)) return identity;
  const elapsed = Math.max(0, (now - start) / 1000);
  const sample = (key, property, path, time, loop = false, fallback = 1) => {
    const clip = ANIM[key];
    const channel = clip && clip.channels.find(ch => ch.p === property && (path == null || ch.path === path) && (ch.keys || ch.c !== undefined));
    return channel ? evalChannel(channel, time, loop, clip.stop) : fallback;
  };
  if (node.kind === 'box' && (node.style === 'narration' || node.style === 'sfx')) {
    if (uiEntranceSuppressed.has(node.id)) return identity;
    const key = 'narration.Dialogue_MangaNarrationText_Entry';
    return { ...identity,
      alpha: Math.max(0, Math.min(1, sample(key, 'alpha', 'Base/Base', elapsed))),
      x: sample(key, 'posX', 'Base/Base', elapsed, false, 0),
      y: -sample(key, 'posY', 'Base/Base', elapsed, false, 0) };
  }
  const thought = node.style === 'think' || node.style === 'thought';
  const entryKey = node.kind === 'bubble' ? 'manga.Dialogue_MangaText_Start'
    : node.style === 'monologue' || node.style === 'monologueThought' ? 'clear.Dialogue_ClearText_Entry'
      : node.style === 'blast' ? 'normal.Dialogue_NormalText_BlastEntry' : null;
  const playEntry = entryKey && !uiEntranceSuppressed.has(node.id);
  let sx = playEntry ? sample(entryKey, 'sx', '', elapsed) : 1;
  let sy = playEntry ? sample(entryKey, 'sy', '', elapsed) : 1;
  if (node.kind === 'bubble' || ['normal', 'purple', 'cloud', 'blast'].includes(node.style)) {
    const idleX = node.kind === 'bubble' ? `manga.Dialogue_MangaText_${thought ? 'Think' : 'Normal'}BaseSacleX`
      : node.style === 'cloud' ? 'normal.Dialogue_NormalText_CloudIdleX'
        : node.style === 'blast' ? 'normal.Dialogue_NormalText_BlastIdle' : 'normal.Dialogue_NormalText_Normal';
    sx *= sample(idleX, 'sx', null, elapsed, true);
    if (node.kind === 'bubble' && thought) sy *= sample('manga.Dialogue_MangaText_ThinkBaseSacleY', 'sy', 'Base/Base/TextBoxLayOut/Base', elapsed, true);
    else if (node.style === 'cloud') sy *= sample('normal.Dialogue_NormalText_CloudIdleY', 'sy', 'Base', elapsed, true);
    else if (node.style === 'blast') sy *= sample(idleX, 'sy', 'Base', elapsed, true);
  }
  return { ...identity, sx, sy };
}

function uiTailMotion(node, now) {
  const start = uiEntrances.get(node.id);
  const elapsed = Number.isFinite(start) ? Math.max(0, (now - start) / 1000) : 0;
  const thought = node.style === 'think' || node.style === 'thought';
  const clip = ANIM[thought ? 'manga.Dialogue_MangaText_ThinkBubbleTail' : 'manga.Dialogue_MangaText_NomalBubbleTail'];
  if (!clip) return { first: 0, second: 0, scale: 1 };
  if (thought) {
    const paths = ['Base/BubbleTail/ThinkingTail/ThinkingBase/ThinkingABase', 'Base/BubbleTail/ThinkingTail/ThinkingBase/ThinkingBBase'];
    const offsets = paths.map(path => {
      const channel = clip.channels.find(ch => ch.p === 'posY' && ch.path === path);
      return channel ? evalChannel(channel, elapsed, true, clip.stop) - evalChannel(channel, 0, true, clip.stop) : 0;
    });
    return { first: offsets[0], second: offsets[1], scale: 1 };
  }
  const channel = clip.channels.find(ch => ch.p === 'sizeX' && ch.path.endsWith('/NormalBase'));
  return { first: 0, second: 0, scale: channel ? evalChannel(channel, elapsed, true, clip.stop) / channel.keys[0][1] : 1 };
}

function drawUiObjects(now) {
  uiExits = uiExits.filter(exit => now - exit.start < UI_EXIT_MS);
  if (!uiObjects.size && !uiExits.length) return;
  let world;
  try { world = uiWorldTransforms(now); }
  catch (e) { console.error('UI graph error', e); return; }
  const ordered = [...uiObjects.values()].map(node => ({ node, transform: world.get(node.id) }))
    .concat(uiExits).sort((a, b) => (a.node.z || 0) - (b.node.z || 0));
  for (const item of ordered) {
    const { node, transform } = item;
    if (!transform) continue;
    if (!transform.visible || transform.alpha <= 0) continue;
    ctx.save();
    ctx.transform(...transform.matrix);
    ctx.globalAlpha *= transform.alpha;
    if (item.start != null) {
      const progress = Math.max(0, Math.min(1, (now - item.start) / UI_EXIT_MS));
      ctx.globalAlpha *= 1 - progress;
      ctx.scale(1 - progress * 0.15, 1 - progress * 0.15);
    }
    if (node.kind === 'box') {
      const height = item.height ?? uiBubbleHeight(node);
      const images = { normal: 'box', purple: 'boxBehind', cloud: 'cloud', blast: 'blast', monologue: 'clear', monologueThought: 'clearBehind', narration: 'narration' };
      if (node.style === 'sfx') {
        ctx.fillStyle = '#181818';
        ctx.fillRect(-node.width / 2 + 10, -height / 2 + 10, node.width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-node.width / 2, -height / 2, node.width, height);
      } else if (IMG[images[node.style]]) {
        drawUiSlice(IMG[images[node.style]], node.width, height, 64);
      }
    } else if (node.kind === 'bubble') {
      const height = item.height ?? uiBubbleHeight(node);
      const image = IMG[node.style === 'purple' || node.style === 'thought' ? 'bubbleBehind' : 'bubble'];
      if (image) drawUiSlice(image, node.width, height, 94);
      if (node.tail !== 'none') {
        const isThink = node.style === 'think' || node.style === 'thought';
        const tailMotion = uiTailMotion(node, now);
        const right = node.tail.endsWith('r') ? 1 : -1;
        const bottom = node.tail.startsWith('t') ? -1 : 1;
        if (isThink && IMG.circle) {
          ctx.save();
          ctx.scale(right, bottom);
          ctx.drawImage(IMG.circle, node.width / 2 - 83, height / 2 - 5 - tailMotion.first, 38, 38);
          ctx.drawImage(IMG.circle, node.width / 2 - 43, height / 2 + 25 - tailMotion.second, 23, 23);
          ctx.restore();
        } else if (IMG.tail) {
          ctx.save();
          ctx.translate(right * (node.width / 2 - 90), bottom * (height / 2 - 8));
          ctx.scale(-right * tailMotion.scale, bottom * tailMotion.scale);
          ctx.drawImage(IMG.tail, -55, -8, 110, 76);
          ctx.restore();
        }
      }
    } else if (node.kind === 'text') {
      const layout = getRichLayout(node.text || '', node.width, node.fontSize, FONT_DIALOGUE, 1.34);
      const height = uiTextHeight(node, layout);
      const visible = item.visibleChars ?? uiTextVisible(node, now);
      ctx.beginPath();
      ctx.rect(-node.width / 2, -height / 2, node.width, height);
      ctx.clip();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let y = Math.max(-height / 2, -layout.height / 2);
      for (const line of layout.lines) {
        let x = -line.width / 2;
        for (const char of line.chars) {
          if (char.idx >= visible) break;
          ctx.font = fontOf(char.size || node.fontSize, FONT_DIALOGUE);
          ctx.fillStyle = char.color || node.color || '#333333';
          ctx.fillText(char.ch, x, y + line.lineH / 2);
          x += char.w;
        }
        y += line.lineH;
      }
    }
    ctx.restore();
  }
}

function hexToRgb(hex) {
  const s = String(hex || '#000000').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadowTint(line = {}) {
  const [r, g, b] = hexToRgb(line.shadowColor ?? state.shadowColor);
  return [r / 255, g / 255, b / 255, line.shadowAlpha ?? state.shadowAlpha];
}

function applyShadowStyle(line = {}) {
  // resetMode() re-enables every node each time a line opens, so hide the
  // duplicate prefab shadows here as well as once at boot.
  for (const p of [
    'Base/Base/TextBoxLayOut/Behind/Behind',
    'Base/Base/TextBoxLayOut/Behind/BehindShadow',
    'Base/BubbleTail/NormalTail/NormalShadowTop',
  ]) {
    const n = findNode(MODES.manga, p);
    if (n) n.hidden = true;
  }
  const base = findNode(MODES.manga, 'Base/Base/TextBoxLayOut/Base/BaseShadow');
  if (base) {
    base.hidden = false;
    base.px = 12.5;
    base.py = -12.5;
    base.sw = 5;
    base.sh = 5;
    base.draw.img = 'bubble';
    base.draw.kind = 'sliced';
    base.draw.border = [94, 94];
    base.draw.color = shadowTint(line);
  }
  const tail = findNode(MODES.manga, 'Base/BubbleTail/NormalTail/NormalShadow');
  if (tail) {
    tail.hidden = false;
    tail.draw.color = shadowTint(line);
  }
  for (const p of [
    'Base/BubbleTail/ThinkingTail/ThinkingShadow/ThinkingAShadow',
    'Base/BubbleTail/ThinkingTail/ThinkingShadow/ThinkingBShadow',
  ]) {
    const n = findNode(MODES.manga, p);
    if (n) n.draw.color = shadowTint(line);
  }
}

function applyMangaSkin(m, line) {
  const bubble = findNode(m.root, 'Base/Base/TextBoxLayOut/Base/Base');
  if (bubble) {
    bubble.draw.img = line.purple ? 'bubbleBehind' : 'bubble';
    bubble.draw.kind = 'sliced';
    bubble.draw.border = [94, 94];
    bubble.draw.color = [1, 1, 1, 1];
  }
  const tail = findNode(m.root, 'Base/BubbleTail/NormalTail/NormalBase');
  if (tail) tail.draw.color = line.purple ? [0.34, 0.16, 0.42, 1] : [1, 1, 1, 1];
  m.extra.textColor = line.purple ? '#f7f0fb' : null;
}

/* ---------------------------------------------------------------- animation sampling */
function evalChannel(ch, t, loop, stop) {
  if (ch.c !== undefined) return ch.c;
  const keys = ch.keys;
  if (!keys || !keys.length) return 0;
  if (loop && stop > 0) t = ((t % stop) + stop) % stop;
  if (t <= keys[0][0]) return keys[0][1];
  let i = 0;
  for (let j = 1; j < keys.length; j++) {
    if (keys[j][0] <= t) i = j; else break;
  }
  const k = keys[i];
  if (i === keys.length - 1) return k[1];
  const dt = t - k[0];
  return k[1] + k[4] * dt + k[3] * dt * dt + k[2] * dt * dt * dt;
}

function collectOverrides(m, now) {
  const out = new Map();
  const infos = [];
  for (const c of m.clips) {
    const def = ANIM[c.key];
    if (!def) continue;
    const elapsed = (now - c.start) / 1000 * (c.rate ?? 1);
    if (elapsed < 0) { infos.push({ key: c.key, t: 0, stop: def.stop, loop: c.loop, active: false }); continue; }
    const t = c.loop ? (def.stop > 0 ? elapsed % def.stop : 0) : Math.min(elapsed, def.stop);
    infos.push({ key: c.key, t, stop: def.stop, loop: c.loop, active: true, raw: elapsed });
    for (const ch of def.channels) {
      const v = evalChannel(ch, t, c.loop, def.stop);
      let o = out.get(ch.path || '');
      if (!o) { o = {}; out.set(ch.path || '', o); }
      o[ch.p] = v;
    }
  }
  return { ov: out, infos };
}

/* ---------------------------------------------------------------- text layout */
const layoutCache = new Map();
const FONT_GAME = '"One Mobile POP","Noto Sans SC","Microsoft YaHei",sans-serif';
const FONT_DIALOGUE = FONT_GAME;
const FONT_TITLE = FONT_GAME;

function fontOf(size, family) { return `${size}px ${family}`; }

const HANGING_PUNCT = new Set(Array.from('，。！？、；：,.!?;:）]】》」』”’…'));

function breakText(text, maxW, font) {
  const lines = [];
  let cur = [], width = 0;
  for (const ch of Array.from(text)) {
    if (ch === '\n') { lines.push({ chars: cur, width }); cur = []; width = 0; continue; }
    ctx.font = font;
    const w = ctx.measureText(ch).width;
    if (width + w > maxW && cur.length) {
      if (HANGING_PUNCT.has(ch)) {
        // CJK hanging punctuation: keep it with the preceding line.
        cur.push({ ch, w });
        width += w;
        continue;
      }
      lines.push({ chars: cur, width });
      cur = []; width = 0;
    }
    cur.push({ ch, w });
    width += w;
  }
  if (cur.length || !lines.length) lines.push({ chars: cur, width });
  return lines;
}

function getLayout(text, maxW, size, family, lineHeightFactor = 1.34) {
  const font = fontOf(size, family);
  const key = [text, Math.round(maxW), size, family, lineHeightFactor].join('|');
  if (layoutCache.has(key)) return layoutCache.get(key);
  const lines = breakText(text, maxW, font);
  const lineH = Math.round(size * lineHeightFactor);
  const height = Math.max(1, lines.length) * lineH;
  const res = { lines, font, lineH, height };
  layoutCache.set(key, res);
  return res;
}

/* ---------------------------------------------------------------- rich text
   Inline markup supported in every dialogue text field:
     <color=#ffcc00>…</color>   CSS colour (hex / rgb() / named)
     <size=64>…</size>          absolute px, +12 / -6 relative, 120% relative
     <speed=2>…</speed>         2 = twice as fast, 0.5 = half speed
     <speed=80ms>…</speed>      fixed delay per character (ms or s)
     <pause=0.5>                pause 0.5s before the next character
     <pause=300ms>              same, in milliseconds
     <wait=…> / <br>            aliases
   Tags affect typewriter timing as well as drawing; they are never painted. */
const richParseCache = new Map();
const richLayoutCache = new Map();
const richPlanCache = new Map();
let richMeasureCtx = null;

function parseColorAttr(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', s)) return s;
  if (/^#([0-9a-f]{3,8})$/i.test(s) || /^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
  return null;
}

function parseSizeAttr(value, base) {
  const s = String(value || '').trim().replace(/px$/i, '');
  if (!s) return null;
  let m;
  if ((m = /^([+-]\s*[\d.]+)$/.exec(s))) {
    return Math.max(1, base + parseFloat(m[1].replace(/\s+/g, '')));
  }
  if ((m = /^([\d.]+)%$/.exec(s))) return Math.max(1, base * parseFloat(m[1]) / 100);
  if (/^[\d.]+$/.test(s)) return Math.max(1, parseFloat(s));
  return null;
}

function parsePauseAttr(value, fallbackSeconds = 0.5) {
  const s = String(value || '').trim();
  if (!s) return fallbackSeconds * 1000;
  let m;
  if ((m = /^([\d.]+)\s*ms$/i.exec(s))) return Math.max(0, parseFloat(m[1]));
  if ((m = /^([\d.]+)\s*s$/i.exec(s))) return Math.max(0, parseFloat(m[1]) * 1000);
  if (/^[\d.]+$/.test(s)) return Math.max(0, parseFloat(s) * 1000);
  return fallbackSeconds * 1000;
}

function parseSpeedAttr(value) {
  const s = String(value || '').trim();
  if (!s) return { speed: 1, speedMs: null };
  let m;
  if ((m = /^([\d.]+)\s*ms$/i.exec(s))) return { speed: 1, speedMs: Math.max(0, parseFloat(m[1])) };
  if ((m = /^([\d.]+)\s*s$/i.exec(s))) return { speed: 1, speedMs: Math.max(0, parseFloat(m[1]) * 1000) };
  if (/^[\d.]+$/.test(s)) {
    const speed = Math.min(1000, Math.max(0.01, parseFloat(s) || 1));
    return { speed, speedMs: null };
  }
  return { speed: 1, speedMs: null };
}

function parseRichText(raw, baseSize = 52) {
  const text = String(raw ?? '');
  const cacheKey = baseSize + '|' + text;
  if (richParseCache.has(cacheKey)) return richParseCache.get(cacheKey);
  const chars = [];
  const pauses = [];
  let color = null;
  let size = baseSize;
  let speed = 1;
  let speedMs = null;
  const colorStack = [];
  const sizeStack = [];
  const speedStack = [];
  const pushPlain = str => {
    for (const ch of Array.from(str)) {
      chars.push({ ch, idx: chars.length, color, size, speed, speedMs });
    }
  };
  const tagRe = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?:\s*=\s*([^>]*?))?\s*\/?>/;
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) { pushPlain(text.slice(i)); break; }
    if (lt > i) pushPlain(text.slice(i, lt));
    const m = tagRe.exec(text.slice(lt));
    if (!m) { pushPlain('<'); i = lt + 1; continue; }
    const [whole, closing, nameRaw, valRaw] = m;
    const name = nameRaw.toLowerCase();
    const val = String(valRaw || '').trim().replace(/\/$/, '');
    if (name === 'pause' || name === 'wait') {
      if (!closing) pauses.push({ at: chars.length, ms: parsePauseAttr(val) });
    } else if (name === 'br') {
      if (!closing) pushPlain('\n');
    } else if (name === 'color') {
      if (closing) color = colorStack.length ? colorStack.pop() : null;
      else {
        colorStack.push(color);
        const parsed = parseColorAttr(val);
        if (parsed) color = parsed;
      }
    } else if (name === 'size') {
      if (closing) size = sizeStack.length ? sizeStack.pop() : baseSize;
      else {
        sizeStack.push(size);
        const parsed = parseSizeAttr(val, size);
        if (parsed) size = parsed;
      }
    } else if (name === 'speed') {
      if (closing) {
        const prev = speedStack.length ? speedStack.pop() : { speed: 1, speedMs: null };
        speed = prev.speed; speedMs = prev.speedMs;
      } else {
        speedStack.push({ speed, speedMs });
        const parsed = parseSpeedAttr(val);
        speed = parsed.speed; speedMs = parsed.speedMs;
      }
    } else {
      pushPlain(whole);
    }
    i = lt + whole.length;
  }
  const res = { raw: text, chars, pauses, baseSize };
  richParseCache.set(cacheKey, res);
  return res;
}

function measureRichGlyph(ch, size, family) {
  if (!richMeasureCtx) richMeasureCtx = document.createElement('canvas').getContext('2d');
  richMeasureCtx.font = fontOf(size, family);
  return richMeasureCtx.measureText(ch).width;
}

function richPlain(raw, baseSize = 52) {
  return parseRichText(raw, baseSize).chars.map(c => c.ch === '\n' ? ' ' : c.ch).join('');
}

function getRichLayout(raw, maxW, size, family, lineHeightFactor = 1.34) {
  const key = [raw, Math.round(maxW), size, family, lineHeightFactor].join('|');
  if (richLayoutCache.has(key)) return richLayoutCache.get(key);
  const parsed = parseRichText(raw, size);
  const lines = [];
  let cur = [];
  let width = 0;
  let lineMax = size;
  const pushLine = () => {
    lines.push({ chars: cur, width, lineH: Math.max(1, Math.round(lineMax * lineHeightFactor)), maxSize: lineMax });
    cur = [];
    width = 0;
    lineMax = size;
  };
  for (const c of parsed.chars) {
    if (c.ch === '\n') { pushLine(); continue; }
    const fs = c.size || size;
    const w = measureRichGlyph(c.ch, fs, family);
    if (width + w > maxW && cur.length) {
      if (HANGING_PUNCT.has(c.ch)) {
        cur.push({ ...c, w, size: fs });
        width += w;
        lineMax = Math.max(lineMax, fs);
        continue;
      }
      pushLine();
    }
    cur.push({ ...c, w, size: fs });
    width += w;
    lineMax = Math.max(lineMax, fs);
  }
  if (cur.length || !lines.length) pushLine();
  const height = lines.reduce((sum, l) => sum + l.lineH, 0);
  const res = { lines, height, parsed, totalChars: parsed.chars.length };
  richLayoutCache.set(key, res);
  return res;
}

function getRichTypingPlan(raw, speedScale = 1, options = {}) {
  const text = String(raw ?? '');
  const parsedScale = Number(speedScale);
  const scale = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1;
  const interval = Number(options.speed);
  const baseInterval = Number.isFinite(interval) && interval > 0 ? interval : TYPE_SPEED;
  const punctuation = Number(options.punctuationPause);
  const punctuationPause = Number.isFinite(punctuation) && punctuation >= 0 ? punctuation : 0;
  const cacheKey = JSON.stringify([text, scale, baseInterval, punctuationPause]);
  if (richPlanCache.has(cacheKey)) return richPlanCache.get(cacheKey);
  const parsed = parseRichText(text, 52);
  const pausesAt = new Map();
  for (const p of parsed.pauses) pausesAt.set(p.at, (pausesAt.get(p.at) || 0) + p.ms);
  const times = new Array(parsed.chars.length);
  let t = 0;
  for (let i = 0; i < parsed.chars.length; i++) {
    t += pausesAt.get(i) || 0;
    times[i] = t;
    if (i < parsed.chars.length - 1) {
      const c = parsed.chars[i];
      const delay = c.speedMs != null ? c.speedMs : (baseInterval * 1000) / ((c.speed || 1) * scale);
      t += Math.max(0, delay);
      if (/[，。！？；：、,.!?;:]/u.test(c.ch)) t += punctuationPause * 1000;
    }
  }
  t += pausesAt.get(parsed.chars.length) || 0;
  const plan = { text, chars: parsed.chars, times, total: t, charCount: parsed.chars.length };
  richPlanCache.set(cacheKey, plan);
  return plan;
}

function lineTypingPlan(line) {
  return getRichTypingPlan(line.text || '', line.typeSpeed, { speed: line.speed, punctuationPause: line.punctuationPause });
}

function richVisibleCount(plan, elapsed) {
  if (elapsed < 0) return 0;
  let lo = 0;
  let hi = plan.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (plan.times[mid] <= elapsed) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function fitSize(text, maxW, maxH, size, minSize, family, factor = 1.34) {
  let s = size;
  while (s > minSize) {
    const L = getRichLayout(text, maxW, s, family, factor);
    if (L.height <= maxH) break;
    s -= 2;
  }
  return s;
}

/* ---------------------------------------------------------------- draw helpers */
function withLocalRect(world, rect, fn) {
  // Convert node-local y-up rect into a y-down drawing context.
  let m = M.mul(world, M.t(rect.x, rect.y + rect.h));
  m = M.mul(m, M.s(1, -1));
  ctx.save();
  M.apply(m);
  fn();
  ctx.restore();
}

function drawSfxShape(rect, world, rgb, alpha) {
  if (alpha <= 0.002) return;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.globalAlpha = 1;
  });
}

const locationLayerCache = new Map();

function locationRichChars(text, baseSize) {
  const parsed = parseRichText(text, baseSize);
  const chars = [];
  for (const c of parsed.chars) {
    if (c.ch === '\n') continue;
    const first = chars.length === 0;
    chars.push({
      ch: c.ch,
      size: first && c.size === baseSize ? baseSize * 1.35 : c.size,
      color: c.color || (first ? '#237526' : '#323232'),
    });
  }
  return chars;
}

function locationFitChars(chars, rectW, g) {
  const measure = () => chars.map(c => {
    g.font = `${c.size}px ${FONT_DIALOGUE}`;
    return g.measureText(c.ch).width;
  });
  let widths = measure();
  let totalW = widths.reduce((sum, w) => sum + w, 0);
  if (totalW > rectW && totalW > 0) {
    const k = rectW / totalW;
    for (const c of chars) c.size = Math.max(1, c.size * k);
    widths = measure();
    totalW = widths.reduce((sum, w) => sum + w, 0);
  }
  return { widths, totalW };
}

function locationLayer(text, rectW, rectH, baseSize) {
  const key = [text, Math.round(rectW), Math.round(rectH), baseSize].join('|');
  if (locationLayerCache.has(key)) return locationLayerCache.get(key);
  const scale = 2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(rectW * scale));
  c.height = Math.max(1, Math.ceil(rectH * scale));
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const chars = locationRichChars(text, baseSize);
  const { widths } = locationFitChars(chars, rectW, g);
  let x = 0;
  const y = rectH / 2;
  for (let i = 0; i < chars.length; i++) {
    g.font = `${chars[i].size}px ${FONT_DIALOGUE}`;
    g.fillStyle = chars[i].color;
    g.fillText(chars[i].ch, x, y);
    x += widths[i];
  }
  const layer = { canvas: c, w: rectW, h: rectH };
  locationLayerCache.set(key, layer);
  return layer;
}

const locationEffectLayoutCache = new Map();

function locationEffectLayout(text, rectW, baseSize) {
  const key = [text, Math.round(rectW), baseSize].join('|');
  if (locationEffectLayoutCache.has(key)) return locationEffectLayoutCache.get(key);
  const g = document.createElement('canvas').getContext('2d');
  const chars = locationRichChars(text, baseSize);
  const { widths, totalW } = locationFitChars(chars, rectW, g);
  const layer = { chars, widths, totalW };
  locationEffectLayoutCache.set(key, layer);
  return layer;
}

// TextMeshProEffect Type 5 from InfoText: 0.6s, amplitude 0.4, char ratio 0.247.
function drawLocationEffect(rect, world, alpha, text, elapsed) {
  const L = locationEffectLayout(text, rect.w, 69.95);
  const total = 0.6;
  const charDur = total * 0.247;
  const stagger = L.chars.length > 1 ? (total - charDur) / (L.chars.length - 1) : 0;
  withLocalRect(world, rect, () => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    let x = 0;
    const cy = rect.h / 2;
    for (let i = 0; i < L.chars.length; i++) {
      const glyph = L.chars[i], w = L.widths[i];
      const t = (elapsed - i * stagger) / charDur;
      if (t <= 0) { x += w; continue; }
      const p = Math.min(1, t);
      const appear = Math.min(1, p / 0.16);
      const scale = 0.55 + 0.45 * easeOutBack(Math.min(1, p / 0.8));
      const size = glyph.size;
      const hop = Math.sin(Math.PI * p) * size * 0.4 * (1 - p * 0.25);
      const wob = Math.sin(Math.PI * p) * (i % 2 ? -0.03 : 0.03) * (1 - p);
      ctx.save();
      ctx.translate(x + w / 2, cy - hop);
      ctx.rotate(wob);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha * appear;
      ctx.font = `${size}px ${FONT_DIALOGUE}`;
      ctx.fillStyle = glyph.color;
      ctx.fillText(glyph.ch, -w / 2, 0);
      ctx.restore();
      x += w;
    }
    ctx.globalAlpha = 1;
  });
}

function drawLocationLabel(node, rect, world, alpha, now) {
  const m = modeRuntime.location;
  const line = m.line || {};
  const text = line.text || '';
  if (!text) return;
  const startClip = (m.clips || []).find(c => c.key === 'location.Start');
  if (startClip) {
    const elapsed = (now - startClip.start) / 1000 - 0.25;
    if (elapsed < 0) return;
    if (elapsed < 0.6) {
      drawLocationEffect(rect, world, alpha, text, elapsed);
      return;
    }
  }
  const layer = locationLayer(text, rect.w, rect.h, (node.draw && node.draw.fontSize) || 70);
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer.canvas, 0, 0, rect.w, rect.h);
    ctx.globalAlpha = 1;
  });
}

function drawImageSimple(key, rect, world, color, alpha, opts = {}) {
  const im = tinted(key, color);
  if (!im) return;
  const a = alpha * (color[3] ?? 1);
  if (a <= 0.002) return;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = a;
    const { x = 0, y = 0, w = rect.w, h = rect.h } = opts;
    ctx.drawImage(im, x, y, w, h);
    ctx.globalAlpha = 1;
  });
}

// Dialogue_Base_Branch is authored as a 548x104 bar with 52px end caps. The
// slot is 1422px wide, so keep both caps at native scale and repeat the
// centre star strip instead of stretching it into a long smear.
function drawBranchBar(rect, world, color, alpha) {
  const im = tinted('branchBase', color);
  if (!im || alpha <= 0.002) return;
  const cap = 52;
  const iw = im.naturalWidth || im.width;
  const ih = im.naturalHeight || im.height;
  const centerW = iw - cap * 2;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, 0, 0, cap, ih, 0, 0, cap, rect.h);
    let dx = cap;
    while (dx < rect.w - cap) {
      const w = Math.min(centerW, rect.w - cap - dx);
      if (w <= 0) break;
      ctx.drawImage(im, cap, 0, w, ih, dx, 0, w, rect.h);
      dx += centerW;
    }
    ctx.drawImage(im, iw - cap, 0, cap, ih, rect.w - cap, 0, cap, rect.h);
    ctx.globalAlpha = 1;
  });
}

function drawImageSliced(key, rect, world, color, alpha, border) {
  const im = tinted(key, color);
  if (!im) return;
  const a = alpha * (color[3] ?? 1);
  if (a <= 0.002) return;
  // border: [h, v] symmetric, or [left, right, bottom, top] authored in UI units
  const four = border && border.length >= 4;
  const l = border[0], r = four ? border[1] : border[0];
  const b = four ? border[2] : border[1], t = four ? border[3] : border[1];
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  let dl, dr, db, dt;
  if (four) {
    // Unity keeps border slices at native size and only compresses them
    // proportionally when the rect is smaller than both borders combined.
    const kh = l + r > rect.w && l + r > 0 ? rect.w / (l + r) : 1;
    const kv = b + t > rect.h && b + t > 0 ? rect.h / (b + t) : 1;
    dl = l * kh; dr = r * kh; db = b * kv; dt = t * kv;
  } else {
    dl = dr = Math.min(l, rect.w / 2);
    db = dt = Math.min(b, rect.h / 2);
  }
  let sl = Math.min(four ? l : dl, iw / 2), sr = Math.min(four ? r : dr, iw / 2);
  let sb = Math.min(four ? b : db, ih / 2), st = Math.min(four ? t : dt, ih / 2);
  // Some authored sprites (e.g. Dialogue_NameTitle_News 100x100 with
  // m_Border 51/27/52/54) have borders wider than the texture. Keep a 1px
  // centre strip so the solid centre still stretches instead of vanishing.
  if (sl + sr >= iw) { const k = (iw - 1) / (sl + sr); sl *= k; sr *= k; }
  if (sb + st >= ih) { const k = (ih - 1) / (sb + st); sb *= k; st *= k; }
  const dmw = Math.max(0, rect.w - dl - dr), dmh = Math.max(0, rect.h - db - dt);
  const smw = Math.max(0, iw - sl - sr), smh = Math.max(0, ih - sb - st);
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = a;
    const dx = [0, dl, rect.w - dr], dy = [0, db, rect.h - dt];
    const dw = [dl, dmw, dr], dh = [db, dmh, dt];
    const sx = [0, sl, iw - sr], sy = [0, sb, ih - st];
    const sw = [sl, smw, sr], sh = [sb, smh, st];
    for (let ix = 0; ix < 3; ix++) {
      for (let iy = 0; iy < 3; iy++) {
        if (dw[ix] <= 0 || dh[iy] <= 0 || sw[ix] <= 0 || sh[iy] <= 0) continue;
        ctx.drawImage(im, sx[ix], sy[iy], sw[ix], sh[iy], dx[ix], dy[iy], dw[ix], dh[iy]);
      }
    }
    ctx.globalAlpha = 1;
  });
}

function drawImageFilled(key, rect, world, color, alpha, fill) {
  const im = tinted(key, color);
  if (!im) return;
  const a = alpha * (color[3] ?? 1);
  if (a <= 0.002) return;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.rect(0, 0, rect.w * Math.max(0, Math.min(1, fill)), rect.h);
    ctx.clip();
    ctx.drawImage(im, 0, 0, rect.w, rect.h);
    ctx.globalAlpha = 1;
  });
}

function drawRawImage(key, rect, world, color, alpha, uvY) {
  const im = tinted(key, color);
  if (!im) return;
  const a = alpha * (color[3] ?? 1);
  if (a <= 0.002) return;
  // One film frame fills the whole cinema-frame rect; uvY only scrolls the
  // exposed strip vertically. It must not be tiled horizontally: the title
  // uses a single projection frame, not a wall of thumbnails.
  const frac = ((-(uvY || 0)) % 1 + 1) % 1;
  const y0 = frac * rect.h;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = a;
    for (const yy of [y0 - rect.h, y0]) ctx.drawImage(im, 0, yy, rect.w, rect.h);
    ctx.globalAlpha = 1;
  });
}

function drawGradient(rect, world, alpha, top) {
  if (alpha <= 0.002) return;
  withLocalRect(world, rect, () => {
    const g = ctx.createLinearGradient(0, 0, 0, rect.h);
    if (top) {
      g.addColorStop(0, `rgba(0,0,0,${alpha})`);
      g.addColorStop(0.62, `rgba(0,0,0,${alpha * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.4, `rgba(0,0,0,${alpha * 0.55})`);
      g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rect.w, rect.h);
  });
}

function drawTextBlock(text, content, rect, world, style, alpha, reveal) {
  const raw = text ?? content ?? '';
  if (!raw || alpha <= 0.002) return;
  const maxW = Math.max(20, rect.w - (style.padX || 0) * 2);
  const size = style.size;
  const L = getRichLayout(raw, maxW, size, style.family || FONT_DIALOGUE, style.lineHeight || 1.34);
  const total = L.totalChars;
  const shown = Math.max(0, Math.min(total, reveal == null ? total : reveal));
  if (shown <= 0) return;
  const totalH = L.height;
  let top = totalH > rect.h && style.clip ? 0 : (rect.h - totalH) / 2;
  if (style.scrollMetrics) {
    let bottom = 0;
    let visibleBottom = 0;
    for (const row of L.lines) {
      bottom += row.lineH;
      if (row.chars.some(char => char.idx < shown)) visibleBottom = bottom;
    }
    const max = Math.max(0, visibleBottom - rect.h);
    const offset = state.bubbleScrollManual == null ? max : Math.max(0, Math.min(max, state.bubbleScrollManual));
    style.scrollMetrics.max = max;
    style.scrollMetrics.offset = offset;
    top -= offset;
  }
  let lineTop = 0;
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = alpha;
    if (style.clip) {
      ctx.beginPath();
      ctx.rect(0, 0, rect.w, rect.h);
      ctx.clip();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const line of L.lines) {
      let x = 0;
      if (style.align === 'center') x = (rect.w - line.width) / 2;
      else if (style.align === 'right') x = rect.w - line.width - (style.padX || 0);
      else x = (style.padX || 0);
      const y = top + lineTop + line.lineH / 2;
      for (const c of line.chars) {
        if (c.idx >= shown) break;
        ctx.font = fontOf(c.size || size, style.family || FONT_DIALOGUE);
        if (style.shadow) {
          ctx.fillStyle = style.shadow;
          ctx.fillText(c.ch, x + (style.shadowX || 0), y + (style.shadowY || 0));
        }
        if (style.stroke) {
          ctx.lineWidth = style.stroke;
          ctx.strokeStyle = style.strokeColor || 'rgba(0,0,0,.5)';
          ctx.strokeText(c.ch, x, y);
        }
        ctx.fillStyle = c.color || style.color;
        ctx.fillText(c.ch, x, y);
        x += c.w + (style.charSpacing || 0);
      }
      lineTop += line.lineH;
    }
    ctx.globalAlpha = 1;
  });
}

// Draw text at a node's rect using prefab font size / color, with line content.
function drawTextNode(node, content, rect, world, alpha, styleOverride, reveal) {
  const d = node.draw || {};
  const fc = d.fontColor || { r: .2, g: .2, b: .2, a: 1 };
  const style = {
    size: (styleOverride && styleOverride.size) || d.fontSize || 52,
    family: (styleOverride && styleOverride.family) || FONT_DIALOGUE,
    align: (styleOverride && styleOverride.align) || ((d.halign === 1) ? 'left' : (d.halign === 4 ? 'right' : 'center')),
    color: (styleOverride && styleOverride.color) || `rgba(${Math.round(fc.r*255)},${Math.round(fc.g*255)},${Math.round(fc.b*255)},${fc.a ?? 1})`,
    padX: (styleOverride && styleOverride.padX) || 0,
    lineHeight: (styleOverride && styleOverride.lineHeight) || 1.34,
    charSpacing: (styleOverride && styleOverride.charSpacing) || (d.charSpacing || 0),
    shadow: (styleOverride && styleOverride.shadow) || null,
    shadowY: (styleOverride && styleOverride.shadowY) || 0,
    stroke: (styleOverride && styleOverride.stroke) || 0,
    clip: !!(styleOverride && styleOverride.clip),
    scrollMetrics: styleOverride && styleOverride.scrollMetrics,
  };
  if (styleOverride && styleOverride.autoFit) {
    const maxW = Math.max(20, rect.w - style.padX * 2);
    style.size = fitSize(content, maxW, rect.h, style.size, styleOverride.minSize || 38, style.family, style.lineHeight);
  }
  drawTextBlock(content, content, rect, world, style, alpha, reveal);
}

function drawTextCenteredAt(cx, cy, text, world, style, alpha, reveal) {
  const rect = { x: cx - 800, y: cy - 90, w: 1600, h: 180 };
  drawTextBlock(text, text, rect, world, style, alpha, reveal);
}

/* ---------------------------------------------------------------- node rendering */
function drawNode(node, parentW, parentH, parentPivotX, parentPivotY, world, alpha, ov, m, now) {
  if (node.hidden) return;
  const o = ov.get(node.path || '') || {};
  if (typeof o.active === 'number' && o.active < 0.5) return;
  if (!(node.active || node.forceShow)) return;

  const spanW = parentW * (node.bx - node.ax);
  const spanH = parentH * (node.by - node.ay);
  const w = spanW + (o.sizeX !== undefined ? o.sizeX : node.sw);
  const h = spanH + (o.sizeY !== undefined ? o.sizeY : node.sh);
  let sx = (o.sx !== undefined ? o.sx : node.sx);
  let sy = (o.sy !== undefined ? o.sy : node.sy);
  let rot = node.rot;
  if (o.ez !== undefined) rot += o.ez;
  if (o.qz !== undefined || o.qw !== undefined) {
    const qx = o.qx ?? 0, qy = o.qy ?? 0, qz = o.qz ?? 0, qw = o.qw ?? 1;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    rot += Math.atan2(2 * (qw * qz + qx * qy) / (len * len), 1 - 2 * (qy * qy + qz * qz) / (len * len)) * 180 / Math.PI;
  }
  const pivotX = o.pivotX !== undefined ? o.pivotX : node.pvx;
  const pivotY = o.pivotY !== undefined ? o.pivotY : node.pvy;
  // Unity: pivot sits at anchorMin + (anchorMax-anchorMin)*pivot inside the parent
  const ax = -parentPivotX * parentW + node.ax * parentW + spanW * pivotX;
  const ay = -parentPivotY * parentH + node.ay * parentH + spanH * pivotY;
  const px = (o.posX !== undefined ? o.posX : node.px);
  const py = (o.posY !== undefined ? o.posY : node.py);

  const local = M.mul(M.t(ax + px, ay + py), M.mul(M.r(rot), M.s(sx, sy)));
  let nw = M.mul(world, local);
  const cg = o.alpha !== undefined ? o.alpha : (node.cg ?? 1);
  const a = alpha * cg;
  const rect = { x: -pivotX * w, y: -pivotY * h, w, h };
  if (window.__traceDraw) {
    window.__trace = window.__trace || [];
    if (window.__trace.length < 400) window.__trace.push({ path: node.path, role: (m.drawOverrides.get(node.path) || node.draw || {}).role, w, h, a, e: nw.e, f: nw.f, sx, sy, ax, ay });
  }

  const draw = m.drawOverrides.get(node.path) || node.draw;
  if (draw) {
    const role = draw.role;
    const line = m.line || {};
    const hasShadow = ['shadowX', 'shadowY', 'shadowColor', 'shadowAlpha'].some(key => line[key] != null);
    const mangaShadow = m.name === 'manga' && (
      node.path === 'Base/Base/TextBoxLayOut/Base/BaseShadow' ||
      node.path === 'Base/BubbleTail/NormalTail/NormalShadow' ||
      node.path.includes('/ThinkingShadow/')
    );
    if (mangaShadow && hasShadow) {
      nw = M.mul(nw, M.t((line.shadowX ?? 12.5) - 12.5, -(line.shadowY ?? 12.5) + 12.5));
    }
    const boxShadow = hasShadow && (
      (m.name === 'normal' && node.path === 'Base/Box') ||
      (m.name === 'clear' && node.path === (line.purple ? 'BaseParent/Behind' : 'BaseParent/Base'))
    );
    if (boxShadow && draw.img) {
      const color = shadowTint(line);
      const shadowWorld = M.mul(nw, M.t(line.shadowX ?? 12.5, -(line.shadowY ?? 12.5)));
      if (draw.kind === 'sliced') drawImageSliced(draw.img, rect, shadowWorld, color, a, draw.border || [0, 0]);
      else drawImageSimple(draw.img, rect, shadowWorld, color, a);
    }
    if (role === 'gradient') {
      drawGradient(rect, nw, a * 0.82, false);
    } else if (role === 'fill' || role === 'fillRound') {
      const col = draw.color || [0, 0, 0, 1];
      withLocalRect(nw, rect, () => {
        ctx.globalAlpha = a * (col[3] ?? 1);
        ctx.fillStyle = `rgb(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)})`;
        if (role === 'fillRound') {
          roundRect(0, 0, rect.w, rect.h, Math.min(34, Math.min(rect.w, rect.h) * 0.2));
          ctx.fill();
        } else {
          ctx.fillRect(0, 0, rect.w, rect.h);
        }
        ctx.globalAlpha = 1;
      });
    } else if (role === 'newsText') {
      const line = m.line;
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      const fc = draw.fontColor || { r: 0.0039, g: 0.1255, b: 0.3765, a: 1 };
      const size = Number(line.fontSize) > 0 ? Number(line.fontSize) : (draw.fontSize || 52);
      const textWorld = M.mul(nw, M.t(Number(line.textOffsetX) || 0, -(Number(line.textOffsetY) || 0)));
      drawTextNode(node, line.text || '', rect, textWorld, fa, {
        family: FONT_DIALOGUE,
        color: parseColorAttr(line.textColor) || `rgba(${Math.round(fc.r * 255)},${Math.round(fc.g * 255)},${Math.round(fc.b * 255)},${fc.a ?? 1})`,
        align: draw.halign === 1 ? 'left' : 'center', padX: 0,
        autoFit: true, minSize: 30, lineHeight: 1 + (draw.lineSpacing || 4) / size,
        charSpacing: draw.charSpacing || 0, size,
      }, m.reveal);
    } else if (role === 'newsSender') {
      const name = lineSpeakerName(m.line) || '';
      if (name) {
        const fc = draw.fontColor || { r: 1, g: 1, b: 1, a: 1 };
        const size = draw.fontSize || 55;
        drawTextNode(node, name, rect, nw, a, {
          family: FONT_DIALOGUE,
          color: `rgba(${Math.round(fc.r * 255)},${Math.round(fc.g * 255)},${Math.round(fc.b * 255)},${fc.a ?? 1})`,
          align: 'left', padX: 0, lineHeight: 1.15,
          charSpacing: draw.charSpacing || 5, size,
        }, null);
      }
    } else if (role === 'fullscreenText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      const textWorld = M.mul(nw, M.t(Number(line.textOffsetX) || 0, -(Number(line.textOffsetY) || 0)));
      drawTextNode(node, line.text || '', rect, textWorld, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(line.textColor) || 'rgba(245,238,252,.96)', align: 'center',
        autoFit: true, minSize: 38, lineHeight: 1.4, size: Number(line.fontSize) > 0 ? Number(line.fontSize) : (draw.fontSize || 56),
      }, m.reveal);
    } else if (role === 'branchBar') {
      drawBranchBar(rect, nw, [1, 1, 1, 1], a);
    } else if (role === 'branchBarGlow') {
      // Keep the selected-slot highlight on the same tiled bar geometry as the
      // base, so the star pattern keeps its normal proportions under the glow.
      drawBranchBar(rect, nw, draw.color || [1, 1, 1, 1], a * 0.34);
    } else if (role === 'image' || role === 'shadowBox' || role === 'circle' || role === 'namePlate' || role === 'nameTail'
        || role === 'senderPlate' || role === 'emoticonBase') {
      const newsShadow = hasShadow && (m.name === 'newsTalk' || m.name === 'newsSummary') && node.path === 'Base/Shadow';
      if (newsShadow) {
        const defaultY = m.name === 'newsTalk' ? -10 : 10;
        nw = M.mul(nw, M.t((line.shadowX ?? 10) - 10, -((line.shadowY ?? defaultY) - defaultY)));
      }
      const color = [
        o.colorR !== undefined ? o.colorR : (draw.color ? draw.color[0] : 1),
        o.colorG !== undefined ? o.colorG : (draw.color ? draw.color[1] : 1),
        o.colorB !== undefined ? o.colorB : (draw.color ? draw.color[2] : 1),
        o.colorA !== undefined ? o.colorA : (draw.color ? draw.color[3] : 1),
      ];
      const shadow = newsShadow ? shadowTint({ shadowColor: line.shadowColor ?? '#000000', shadowAlpha: line.shadowAlpha ?? 0.149 }) : null;
      const tint = shadow ? [shadow[0], shadow[1], shadow[2], 1] : [color[0], color[1], color[2], 1];
      const ia = a * (shadow ? shadow[3] : (color[3] ?? 1));
      if (draw.kind === 'sliced') drawImageSliced(draw.img, rect, nw, tint, ia, draw.border || [0, 0]);
      else if (draw.kind === 'filled') drawImageFilled(draw.img, rect, nw, tint, ia, o.fill !== undefined ? o.fill : (draw.fill ?? 1));
      else drawImageSimple(draw.img, rect, nw, tint, ia);
      if (role === 'senderPlate') {
        drawPlateName(draw, rect, nw, a, m.line, true);
      } else if (role === 'namePlate') {
        drawPlateName(draw, rect, nw, a, m.line, false);
      } else if (role === 'circle' && node.path.indexOf('HeroIcon') >= 0) {
        // not used
      }
    } else if (role === 'hero') {
      drawHeroHead(rect, nw, a, m.line);
    } else if (role === 'sfxShadow') {
      const color = line.shadowColor != null ? hexToRgb(line.shadowColor).map(value => value / 255) : [0.10, 0.10, 0.10];
      const shadowWorld = M.mul(nw, M.t((line.shadowX ?? 30) - 30, -((line.shadowY ?? 30) - 30)));
      drawSfxShape(rect, shadowWorld, color, a * (line.shadowAlpha ?? 0.86));
    } else if (role === 'sfxBase') {
      drawSfxShape(rect, nw, [0.10, 0.10, 0.10], a);
    } else if (role === 'sfxTalk') {
      drawSfxShape(rect, nw, [1, 1, 1], a);
    } else if (role === 'sfxText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      const textWorld = M.mul(nw, M.t(Number(line.textOffsetX) || 0, -(Number(line.textOffsetY) || 0)));
      drawTextNode(node, line.text || '', rect, textWorld, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(line.textColor) || '#2f2f2f', align: 'center',
        autoFit: true, minSize: 30, lineHeight: 1.22, size: Number(line.fontSize) > 0 ? Number(line.fontSize) : 52,
      }, m.reveal);
    } else if (role === 'locationText') {
      drawLocationLabel(node, rect, nw, a * (o.fontA !== undefined ? o.fontA : 1), now);
    } else if (role === 'gradientTop' || role === 'gradientBottom') {
      const ga = (o.colorA !== undefined ? o.colorA : 1) * a;
      drawGradient(rect, nw, ga, role === 'gradientTop');
    } else if (role === 'bubbleText') {
      const line = m.line;
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a * (m.extra.textAlpha ?? 1);
      const corners = [
        [rect.x, rect.y], [rect.x + rect.w, rect.y],
        [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h],
      ].map(([x, y]) => ({ x: nw.a * x + nw.c * y + nw.e, y: nw.b * x + nw.d * y + nw.f }));
      m.extra.bubbleViewport = {
        left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)),
        top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)),
      };
      drawTextNode(node, line.text || '', rect, nw, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(line.textColor) || m.extra.textColor || (line.think ? '#3d2f2a' : '#3a3a3a'),
        align: 'center', clip: true, lineHeight: 1.34,
        scrollMetrics: ['scroll', 'grow'].includes(m.bubbleSize?.overflow) ? m.extra.bubbleScroll : null,
        size: m.bubbleSize?.fontSize || 52,
      }, m.reveal);
    } else if (role === 'normalText') {
      const line = m.line;
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      drawTextNode(node, line.text || '', rect, nw, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(line.textColor) || ((line.think || line.mode === 'cloud') ? '#483560' : '#333333'),
        align: 'center', autoFit: true, minSize: 38, lineHeight: 1.36,
        size: Number(line.fontSize) > 0 ? Number(line.fontSize) : 52, charSpacing: -2,
      }, m.reveal);
    } else if (role === 'branchText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      drawTextNode(node, draw.text || '', rect, nw, fa, {
        family: FONT_DIALOGUE, color: '#333333', align: 'center',
        autoFit: true, minSize: 20, lineHeight: 1.2,
        size: draw.fontSize || 46,
      }, null);
    } else if (role === 'branchDot') {
      drawImageSimple(draw.img || 'branchDot', rect, nw, draw.color || [0.486, 0.788, 0.286, 1], a);
    } else if (role === 'branchGlow') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawImageSimple(draw.img || 'branchGlow', rect, nw, draw.color || [1, 1, 1, 1], a);
      ctx.restore();
    } else if (role === 'narrationText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      const dr = node.draw || {};
      const fc = dr.fontColor || { r: 0.83, g: 0.83, b: 0.83, a: 1 };
      const textWorld = M.mul(nw, M.t(Number(line.textOffsetX) || 0, -(Number(line.textOffsetY) || 0)));
      drawTextNode(node, line.text || '', rect, textWorld, fa, {
        family: FONT_DIALOGUE, align: 'center',
        color: parseColorAttr(line.textColor) || `rgb(${Math.round(fc.r * 255)},${Math.round(fc.g * 255)},${Math.round(fc.b * 255)})`,
        autoFit: false, size: Number(line.fontSize) > 0 ? Number(line.fontSize) : (dr.fontSize || 52), lineHeight: 1.35,
      }, m.reveal);
    } else if (role === 'clearText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      drawTextNode(node, m.line.text || '', rect, nw, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(m.line.textColor) || m.extra.textColor || '#3a3a3a', align: 'left', padX: 10,
        autoFit: true, minSize: 38, lineHeight: 1.38, size: Number(m.line.fontSize) > 0 ? Number(m.line.fontSize) : 52,
      }, m.reveal);
    } else if (role === 'animeText') {
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a * (m.extra.textAlpha ?? 1);
      const textWorld = M.mul(nw, M.t(Number(line.textOffsetX) || 0, -(Number(line.textOffsetY) || 0)));
      drawTextNode(node, line.text || '', { x: -800, y: -85, w: 1600, h: 170 }, textWorld, fa, {
        family: FONT_DIALOGUE, color: parseColorAttr(line.textColor) || '#ffffff', align: 'center',
        autoFit: true, minSize: 38, lineHeight: 1.3,
        size: Number(line.fontSize) > 0 ? Number(line.fontSize) : 52, shadow: 'rgba(0,0,0,.7)', shadowY: 2,
      }, m.reveal);
    } else if (role === 'titleText' || role === 'titleShadow') {
      const line = m.line;
      const fa = (o.fontA !== undefined ? o.fontA : 1) * a;
      const isShadow = role === 'titleShadow';
      drawTitleEffect(rect, nw, fa, line.title || '', isShadow, titleEffectElapsed(m, now));
    } else if (role === 'chapterNumber') {
      drawChapterNumber(rect, nw, a, m.line);
    } else if (role === 'tile') {
      const color = [
        o.colorR !== undefined ? o.colorR : 0.088,
        o.colorG !== undefined ? o.colorG : 0.088,
        o.colorB !== undefined ? o.colorB : 0.088,
        1,
      ];
      drawRawImage('cinema', rect, nw, color, a, o.uvY);
    } else if (role === 'filled') {
      const color = [
        o.colorR !== undefined ? o.colorR : 1,
        o.colorG !== undefined ? o.colorG : 1,
        o.colorB !== undefined ? o.colorB : 1,
        o.colorA !== undefined ? o.colorA : 1,
      ];
      drawImageFilled(draw.img, rect, nw, [color[0], color[1], color[2], 1], a * color[3], o.fill !== undefined ? o.fill : draw.fill);
    } else if (role === 'emoticon') {
      // handled as overlay
    }
  }

  for (const c of node.children || []) {
    drawNode(c, w, h, pivotX, pivotY, nw, a, ov, m, now);
  }
}

function drawPlateName(draw, rect, world, alpha, line, isSender) {
  if (!line || !line.speaker) return;
  const name = lineSpeakerName(line);
  const color = isSender ? 'rgba(35,33,28,.92)' : 'rgba(248,244,230,.96)';
  const size = isSender ? 42 : 36;
  withLocalRect(world, rect, () => {
    ctx.font = fontOf(size, FONT_DIALOGUE);
    // Prefab NamePlate uses a symmetric HorizontalLayoutGroup padding
    // (left/right both 40), so the name is always centred inside the plate.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillText(name, rect.w / 2, rect.h / 2);
    ctx.globalAlpha = 1;
  });
}

let measureCtx = null;
function measureCharWidths(chars, font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return chars.map(c => measureCtx.measureText(c).width);
}

function titleEffectElapsed(m, now) {
  const clip = m.clips && m.clips.find(c => c.key === 'title.Start');
  return clip ? (now - clip.start) / 1000 - 1.05 : 10;
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const titleFitCache = new Map();
function fitTitleSize(text, maxW) {
  const key = text + '|' + Math.round(maxW);
  if (titleFitCache.has(key)) return titleFitCache.get(key);
  const chars = Array.from(text);
  let lo = 18, hi = 110, best = 18;
  for (let i = 0; i < 8; i++) {
    const mid = Math.round((lo + hi) / 2);
    const w = measureCharWidths(chars, fontOf(mid, FONT_TITLE)).reduce((s, x) => s + x, 0);
    if (w <= maxW) { best = mid; lo = mid + 1; } else hi = mid - 1;
    if (lo > hi) break;
  }
  titleFitCache.set(key, best);
  return best;
}

// TextMeshProEffect type 5: chars pop in one by one (0.7s total,
// per-char ratio 0.51, amplitude 0.5) with a green flash at mid-life.
function drawTitleEffect(rect, world, alpha, text, isShadow, elapsed) {
  if (!text || alpha <= 0.002 || elapsed < 0) return;
  const chars = Array.from(text);
  const size = fitTitleSize(text, Math.max(20, rect.w - 24));
  const font = fontOf(size, FONT_TITLE);
  const widths = measureCharWidths(chars, font);
  const totalW = widths.reduce((s, w) => s + w, 0);
  const total = 0.7;
  const charDur = total * (isShadow ? 0.357 : 0.51);
  const stagger = chars.length > 1 ? (total - charDur) / (chars.length - 1) : 0;
  withLocalRect(world, rect, () => {
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    let x = (rect.w - totalW) / 2;
    const cy = rect.h / 2 + (isShadow ? 4 : 0);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i], w = widths[i];
      const t = (elapsed - i * stagger) / charDur;
      if (t <= 0) { x += w; continue; }
      const p = Math.min(1, t);
      const appear = Math.min(1, p / 0.16);
      const scale = 0.55 + 0.45 * easeOutBack(Math.min(1, p / 0.8));
      const hop = Math.sin(Math.PI * p) * size * 0.5 * (1 - p * 0.25);
      const wob = Math.sin(Math.PI * p) * (i % 2 ? -0.05 : 0.05) * (1 - p);
      const flash = Math.sin(Math.PI * Math.min(1, p / 0.9));
      const r = Math.round(252 + (185 - 252) * flash * 0.8);
      const g = Math.round(255 + (212 - 255) * flash * 0.8);
      const b = Math.round(219 + (156 - 219) * flash * 0.8);
      ctx.save();
      ctx.translate(x + w / 2, cy - hop);
      ctx.rotate(wob);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha * appear;
      if (!isShadow) {
        ctx.shadowColor = `rgba(150,203,94,${0.55 * flash})`;
        ctx.shadowBlur = size * 0.22 * flash;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = 'rgba(39,53,27,.65)';
      }
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
      x += w;
    }
  });
}

function drawChapterNumber(rect, world, alpha, line) {
  if (!line || alpha <= 0.002) return;
  const no = line.chapterNo != null
    ? String(line.chapterNo)
    : (String(line.chapter || '').match(/\d+/) || [])[0];
  if (!no) return;
  const digits = Array.from(no);
  const baseTint = [0.8235294, 0.9411765, 0.4156863]; // lighter #D2F06A
  const whiteTint = [1, 0.9764706, 0.8470588]; // #FFF9D8
  const items = [];
  for (const d of digits) {
    const b = tintedNumberBase('numBase' + d, baseTint);
    const w = tinted('numWhite' + d, whiteTint);
    if (!b) return;
    items.push({ b, w, bw: b.width, bh: b.height, ww: w ? w.width : 0, wh: w ? w.height : 0 });
  }
  // NumberLayout is a HorizontalLayoutGroup with m_Spacing = -12.72
  const gap = -12.72;
  const numScale = 0.72;
  const totalW = items.reduce((s, it) => s + it.bw, 0) + gap * (items.length - 1);
  const h = Math.max(...items.map(it => it.bh));
  withLocalRect(world, rect, () => {
    ctx.globalAlpha = alpha;
    ctx.translate(rect.w / 2, rect.h / 2);
    ctx.scale(numScale, numScale);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    let x = (rect.w - totalW) / 2;
    const top = (rect.h - h) / 2;
    for (const it of items) {
      const ix = x + (it.bw - it.ww) / 2;
      const iy = top + (h - it.wh);
      ctx.save();
      ctx.shadowColor = 'rgba(180,240,100,.55)';
      ctx.shadowBlur = 16;
      ctx.drawImage(it.b, x, top + (h - it.bh), it.bw, it.bh);
      ctx.restore();
      if (it.w) ctx.drawImage(it.w, ix, iy, it.ww, it.wh);
      x += it.bw + gap;
    }
    ctx.globalAlpha = 1;
  });
}

function drawHeroHead(rect, world, alpha, line) {
  if (!line) return;
  const cast = CAST[line.speaker];
  const im = Object.hasOwn(line, 'avatar') ? (line.avatar && IMG['avatar:' + line.avatar]) : (cast && IMG[cast.img]);
  if (!im) return;
  withLocalRect(world, rect, () => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(rect.w / 2, rect.h / 2, Math.min(rect.w, rect.h) / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, 0, 0, rect.w, rect.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

/* ---------------------------------------------------------------- mode setup */
function hideAllModes(except) {
  for (const k of Object.keys(modeRuntime)) {
    if (k === except) continue;
    modeRuntime[k].visible = false;
    modeRuntime[k].clips.length = 0;
    modeRuntime[k].root.hidden = true;
  }
}

function setRootVisible(m, visible) {
  m.root.hidden = !visible;
  m.root.forceShow = true;
  m.visible = visible;
}

function resetMode(m) {
  m.clips.length = 0;
  m.drawOverrides.clear();
  m.extra = {};
  m.startedAt = performance.now();
  // restore base node values and visibility per mode
  eachNode(m.root, n => {
    n.hidden = false;
    n.forceShow = false;
  });
}

function addClip(m, key, loop = false, startOffset = 0) {
  if (!ANIM[key]) { console.warn('missing clip', key); return; }
  m.clips.push({ key, loop, start: performance.now() + startOffset * 1000 });
}

// Four selectable tail placements. Offsets are derived from the actual
// NormalTail/NormalBase transforms so the tail root stays buried in the bubble.
const MANGA_TAIL_POS = {
  bl: { px: -484, py: -184, sx: 1, sy: 1 },
  br: { px: 221, py: -184, sx: -1, sy: 1 },
  tl: { px: -471, py: 184, sx: 1, sy: -1 },
  tr: { px: 221, py: 184, sx: -1, sy: -1 },
};
const MANGA_TAIL_NUDGE = { inward: 18, outward: 12 };

function mangaTailDir(line) {
  return (line && line.tail) || state.tailDir || 'bl';
}

const MANGA_GEOM = {
  baseWidth: 833,
  baseHeight: 426,
  width: 760,      // 580 text + 180 horizontal padding
  textWidth: 580,  // keeps trailing CJK punctuation on the previous line
  padX: 180,       // DialogueMangaNormalText.PaddingOffset.x
  textSize: 52,
  lineHeight: 1.34,
  padY: 180,       // DialogueMangaNormalText.PaddingOffset.y
  minHeight: 320,  // DialogueMangaNormalText.MinSize.y
};

// Sizes the MangaNormalText body from its measured text. Height grows with
// line count around a fixed bubble center; text and tail follow the edges.
function layoutMangaBubble(m, line) {
  const text = (line && line.text) || '';
  const bubbleWidth = Math.max(360, Number(line.bubbleWidth) || MANGA_GEOM.width);
  const textWidth = Math.max(220, Number(line.textWidth) || MANGA_GEOM.textWidth);
  const requestedSize = Math.max(18, Number(line.fontSize) || Number(line.textSize) || MANGA_GEOM.textSize);
  const minHeight = Math.max(160, Number(line.bubbleMinHeight) || MANGA_GEOM.minHeight);
  const maxHeight = Math.max(minHeight, Number(line.bubbleMaxHeight) || 1200);
  const paddingY = line.bubblePaddingY == null ? MANGA_GEOM.padY : Math.max(0, Number(line.bubblePaddingY) || 0);
  const overflow = ['grow', 'shrink', 'scroll', 'clip'].includes(line.overflow) ? line.overflow : 'grow';
  let textSize = requestedSize;
  let L = getRichLayout(text, textWidth, textSize, FONT_DIALOGUE, MANGA_GEOM.lineHeight);
  const bodyH = overflow === 'grow' ? Math.min(maxHeight, Math.max(minHeight, Math.round(L.height + paddingY))) : minHeight;
  const available = Math.max(Math.min(bodyH, 24), bodyH - paddingY);
  if (overflow === 'shrink' && L.height > available) {
    let low = 12, high = Math.max(12, Math.floor(requestedSize)), best = 12;
    while (low <= high) {
      const candidate = Math.floor((low + high) / 2);
      if (getRichLayout(text, textWidth, candidate, FONT_DIALOGUE, MANGA_GEOM.lineHeight).height <= available) {
        best = candidate;
        low = candidate + 1;
      } else high = candidate - 1;
    }
    textSize = best;
    L = getRichLayout(text, textWidth, textSize, FONT_DIALOGUE, MANGA_GEOM.lineHeight);
  }
  const textH = L.height;
  const viewportHeight = Math.min(available, Math.max(1, textH + 16));
  m.bubbleSize = { w: bubbleWidth, h: bodyH, textH, fontSize: textSize, viewportHeight, overflow };
  m.extra.bubbleScroll = { max: 0, offset: 0 };

  const body = findNode(m.root, 'Base/Base');
  if (body) {
    body.sw = bubbleWidth;
    body.sh = bodyH;
    body.px = Math.round((MANGA_GEOM.baseWidth - bubbleWidth) * 0.35);
    body.py = Math.round(MANGA_GEOM.baseHeight / 2 - bodyH / 2);
  }
  const textNode = findNode(m.root, 'Base/Text');
  if (textNode) {
    textNode.px = -125 + (Number(line.textOffsetX) || 0);
    textNode.py = Number(line.textOffsetY) || 0;
    textNode.sw = textWidth;
    textNode.sh = viewportHeight;
    textNode.draw.fontSize = textSize;
    textNode.pvx = textNode.pvy = 0.5;
  }
  return m.bubbleSize;
}

function mangaBubbleLift(m) {
  const h = (m && m.bubbleSize && m.bubbleSize.h) || MANGA_GEOM.baseHeight;
  return (h - MANGA_GEOM.baseHeight) / 2;
}

function applyMangaTail(m, line) {
  const tailGroup = findNode(m.root, 'Base/BubbleTail');
  if (!tailGroup) return;
  const lift = mangaBubbleLift(m);
  const dx = (((m.bubbleSize && m.bubbleSize.w) || MANGA_GEOM.width) - MANGA_GEOM.baseWidth) / 2;
  // Thinking tails are a separate two-circle design; keep the prefab placement.
  if (line && line.mode === 'mangaThink') {
    tailGroup.px = -484 - dx;
    tailGroup.py = -224 - lift;
    tailGroup.sx = 1;
    tailGroup.sy = 1;
    return;
  }
  const dir = mangaTailDir(line);
  const p = MANGA_TAIL_POS[dir] || MANGA_TAIL_POS.bl;
  const top = dir[0] === 't';
  const left = dir[1] === 'l';
  const nudgeX = left ? MANGA_TAIL_NUDGE.inward : -MANGA_TAIL_NUDGE.inward;
  const nudgeY = top ? MANGA_TAIL_NUDGE.outward : -MANGA_TAIL_NUDGE.outward;
  tailGroup.px = p.px + (left ? -dx : dx) + nudgeX;
  tailGroup.py = p.py + (top ? lift : -lift) + nudgeY;
  tailGroup.sx = p.sx;
  tailGroup.sy = p.sy;
}

function applyMangaFrameFlip(m, line) {
  const bubble = findNode(m.root, 'Base/Base/TextBoxLayOut/Base/Base');
  const shadow = findNode(m.root, 'Base/Base/TextBoxLayOut/Base/BaseShadow');
  const top = isMangaLine(line) && line.mode !== 'mangaThink' && mangaTailDir(line)[0] === 't';
  if (bubble) bubble.sy = top ? -1 : 1;
  // The drop shadow is world-oriented: the frame can flip, the shadow must
  // stay on the lower-right of the bubble and never rotate with the tail.
  if (shadow) {
    shadow.sy = 1;
    shadow.py = -12.5;
  }
}

function layoutMangaRoot(m, line) {
  const root = m.root;
  const cx = line.bubble?.x ?? 1100;
  const cy = line.bubble?.y ?? 520;
  const rootPivotScreenX = cx - 166.5;
  const rootPivotScreenY = cy + 213;
  root.ax = root.bx = root.ay = root.by = 0.5;
  root.px = rootPivotScreenX - W / 2;
  root.py = H / 2 - rootPivotScreenY;
  root.sw = 833; root.sh = 426;
  root.pvx = 0.15; root.pvy = 0;
  root.sx = 1; root.sy = 1; root.sz = 1;
}

function setupPlate(m, path, name, extra = 70) {
  const node = findNode(m.root, path);
  if (!node || !name) return;
  const fakeDraw = { fontColor: { r: .2, g: .2, b: .2, a: 1 }, fontSize: 36 };
  const l = getLayout(name, 600, 36, FONT_DIALOGUE, 1.2);
  node.sw = Math.max(120, Math.ceil(l.lines[0].width) + extra);
}

function prepareManga(line, reuse) {
  const m = modeRuntime.manga;
  if (!reuse) {
    resetMode(m);
    hideAllModes('manga');
    setRootVisible(m, true);
    layoutMangaRoot(m, line);
  } else {
    m.clips = m.clips.filter(c => c.key !== 'manga.Dialogue_MangaText_Start' && c.key !== 'manga.Dialogue_MangaText_End' && c.key.indexOf('BaseSacle') < 0 && c.key.indexOf('BubbleTail') < 0);
    m.startedAt = performance.now();
    m.root.sx = 1; m.root.sy = 1;
  }
  layoutMangaBubble(m, line);
  applyMangaTail(m, line);
  applyMangaFrameFlip(m, line);
  applyShadowStyle(line);
  applyMangaSkin(m, line);
  const think = line.mode === 'mangaThink';
  const normalTail = findNode(m.root, 'Base/BubbleTail/NormalTail');
  const thinkTail = findNode(m.root, 'Base/BubbleTail/ThinkingTail');
  if (normalTail) normalTail.hidden = think;
  if (thinkTail) thinkTail.hidden = !think;
  if (think) {
    addClip(m, 'manga.Dialogue_MangaText_ThinkBaseSacleX', true);
    addClip(m, 'manga.Dialogue_MangaText_ThinkBaseSacleY', true);
    addClip(m, 'manga.Dialogue_MangaText_ThinkBubbleTail', true);
  } else {
    addClip(m, 'manga.Dialogue_MangaText_NormalBaseSacleX', true);
    addClip(m, 'manga.Dialogue_MangaText_NomalBubbleTail', true);
  }
  // The idle clips carry constant root-scale channels from their animator
  // layers; add Start last so its pop scale wins in the flattened playback.
  if (!reuse && line.enter !== 'none') addClip(m, 'manga.Dialogue_MangaText_Start', false);
  m.think = think;
  m.drawOverrides.clear();
  m.line = line;
}

// The dialogue bundles only ship the Start pop; close is code-driven in the
// game. Mirror the same scale curve for the exit so the bubble collapses.
ANIM['manga.Dialogue_MangaText_End'] = {
  stop: 0.25,
  channels: [
    { path: '', p: 'sx', keys: [[0, 1, 0, 0, 0], [0.08333, 1.035, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
    { path: '', p: 'sy', keys: [[0, 1, 0, 0, 0], [0.08333, 1.035, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
    { path: '', p: 'alpha', keys: [[0, 1, 0, 0, 0], [0.08333, 1, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
  ],
};

ANIM['clear.Dialogue_ClearText_Exit'] = {
  stop: 0.25,
  channels: [
    { path: '', p: 'sx', keys: [[0, 1, 0, 0, 0], [0.08333, 1.01, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
    { path: '', p: 'sy', keys: [[0, 1, 0, 0, 0], [0.08333, 1.01, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
    { path: '', p: 'alpha', keys: [[0, 1, 0, 0, 0], [0.08333, 1, 0, 0, 0], [0.25, 0, 0, 0, 0]] },
  ],
};

function isMangaLine(line) {
  return !!line && (line.mode === 'manga' || line.mode === 'mangaThink');
}

function scheduleTransition(name, duration, done, cleanup) {
  const generation = ++state.transitionGeneration;
  state.transition = name;
  setTimeout(() => {
    if (state.transitionGeneration !== generation) return;
    if (cleanup) cleanup();
    state.transition = null;
    done();
  }, duration);
}

function exitMangaThen(done) {
  const m = modeRuntime.manga;
  if (!m.visible || !isMangaLine(m.line)) { done(); return; }
  m.clips = m.clips.filter(c => c.key !== 'manga.Dialogue_MangaText_Start' && c.key !== 'manga.Dialogue_MangaText_End');
  addClip(m, 'manga.Dialogue_MangaText_End', false);
  scheduleTransition('mangaEnd', 260, done);
}

function exitLocationThen(done) {
  const m = modeRuntime.location;
  if (!m.visible || !m.line || m.line.mode !== 'location') { done(); return; }
  m.clips = m.clips.filter(c => c.key !== 'location.Start' && c.key !== 'location.End');
  addClip(m, 'location.End', false);
  scheduleTransition('locationEnd', 390, done);
}

function exitClearThen(done) {
  const m = modeRuntime.clear;
  const line = m.line;
  if (!m.visible || !line || (line.mode !== 'clear' && line.mode !== 'clearRe')) { done(); return; }
  m.clips = m.clips.filter(c => c.key !== 'clear.Dialogue_ClearText_Entry' && c.key !== 'clear.Dialogue_ClearText_ReEntry' && c.key !== 'clear.Dialogue_ClearText_Exit');
  addClip(m, 'clear.Dialogue_ClearText_Exit', false);
  scheduleTransition('clearEnd', 270, done);
}

function modeRuntimeKey(line) {
  if (!line) return '';
  return line.mode === 'mangaThink' ? 'manga'
    : line.mode === 'cloud' ? 'normal'
    : line.mode === 'blast' ? 'normal'
    : line.mode === 'clearRe' ? 'clear'
    : line.mode;
}

// Manga Start scales the mode root, whose pivot sits near the bubble's
// lower-left corner rather than the tail. The game pops the bubble out of its
// tail tip, so the scale has to be re-centred on the current tail.
function modeRootOrigin(m) {
  const spanW = W * (m.root.bx - m.root.ax);
  const spanH = H * (m.root.by - m.root.ay);
  const ax = -W * 0.5 + m.root.ax * W + spanW * m.root.pvx;
  const ay = -H * 0.5 + m.root.ay * H + spanH * m.root.pvy;
  return { x: W / 2 + ax + m.root.px, y: H / 2 - (ay + m.root.py) };
}

function mangaScalePivot(m, line) {
  const q = modeRootOrigin(m);
  const tg = findNode(m.root, 'Base/BubbleTail');
  if (!tg) return q;
  // Base fills the 833x426 root: its centre is +291.55/-213 from the root
  // pivot, and BubbleTail is placed from that centre in the same y-up space.
  const bx = q.x + 291.55 + tg.px;
  const by = q.y - 213 - tg.py;
  if (line && line.mode === 'mangaThink') {
    // The last (small) thought circle is the visual tail tip.
    return { x: bx - 71, y: by + 21 };
  }
  // Tip of Dialogue_TextBox_Tail inside its 144x100 rect, mirrored per side.
  return { x: bx + (tg.sx < 0 ? 61 : -61), y: by + (tg.sy < 0 ? -39 : 39) };
}

// Universal close for every mode that has no authored Exit clip: the whole
// box shrinks into its own tail/root pivot while fading out.
function beginModeExit(done, duration = 300) {
  const line = STORY[state.line];
  if (!line || line.mode === 'end' || line.mode === 'title') { done(); return; }
  const key = modeRuntimeKey(line);
  const m = modeRuntime[key];
  if (!m || !m.visible) { done(); return; }
  if (line.exit === 'none') { m.visible = false; m.root.hidden = true; done(); return; }
  const dur = duration;
  m.extra.exitStart = performance.now();
  m.extra.exitDuration = dur;
  scheduleTransition('modeExit', dur, done, () => { m.extra.exitStart = 0; });
}

// FixText/InfoText: location-name entrance/exit from WindowDialogue.
ANIM['location.Start'] = {
  stop: 1.66667,
  channels: [
    { path: 'Axis', p: 'sx', keys: [
      [0, 0, 0, 0, 0],
      [0.11666667, 0, -928.125244, 185.62503, 0],
      [0.25, 1.1, 4.0571008, -2.2314055, 0],
      [0.61666667, 1, 0, 0, 0],
      [1.66667, 1, 0, 0, 0],
    ] },
    { path: 'Axis', p: 'sy', c: 1 },
    { path: 'Axis', p: 'pivotX', keys: [
      [0, 1, 0, 0, 0],
      [0.01666667, 1, 89.688583, -38.117649, 0],
      [0.3, -0.02, -1.3940125, 0.64410514, 0],
      [0.58333333, 0, -0.0065224, -0.0029095, 0.0292683],
      [1.66667, 0.02, 0, 0, 0],
    ] },
    { path: 'Axis/Text', p: 'fontA', keys: [
      [0, 0, 0, 0, 0],
      [0.23333333, 0, -1999.9995, 299.99994, 0],
      [0.33333333, 1, 0, 0, 0],
      [1.66667, 1, 0, 0, 0],
    ] },
  ],
};

ANIM['location.End'] = {
  stop: 0.35,
  channels: [
    { path: 'Axis', p: 'sx', keys: [
      [0, 1, 0, 0, 0],
      [0, 1, -32.456806, 8.925622, 0],
      [0.18333333, 1.1, 172.800064, -43.200012, 0],
      [0.35, 0.7, 0, 0, 0],
    ] },
    { path: 'Axis', p: 'sy', c: 1 },
    { path: 'Axis', p: 'pivotX', keys: [
      [0, 0.02, 0, 0, 0],
      [0, 0.02, 1.236448, 2.153483, 0],
      [0.18333333, 0.1, -355.8858, 86.228584, 0.914286],
      [0.35, 1, 0, 0, 0],
    ] },
  ],
};

ANIM['narration.Dialogue_NarrationText_Entry'] = {
  stop: 0.28333333,
  channels: [{
    path: '', p: 'py',
    keys: [
      [0, -240, -138240.01236, 34560.00206, 0],
      [0.16666667, 80, 100758.00952, -17632.65213, 0],
      [0.28333333, 0, 0, 0, 0],
    ],
  }],
};

function prepareNarration(line, reuse) {
  const m = modeRuntime.narration;
  resetMode(m);
  hideAllModes('narration');
  setRootVisible(m, true);
  if (line.enter !== 'none') addClip(m, 'narration.Dialogue_NarrationText_Entry', false);
  m.line = line;
}

// NormalText has three controller states (bool Normal / Blast / Cloud) and the
// matching sprite pairs from the Dialogue atlas:
//   Normal : Dialogue_TextBox_Default  + Dialogue_TextBox_Behind
//   Cloud  : Dialogue_TextBox_Cloud    + Dialogue_TextBox_CloudBehind
//   Blast  : Dialogue_TextBox_Blast    + Dialogue_TextBox_CloudBlast
// The two clouds use an 8.66px 9-slice border; Default uses 147px; both Blast
// sprites are authored at 1024x246 / PPU 57.722656 = 1774x426, the exact
// NormalText rect, so they are drawn as one stretched quad (border 0).
function applyNormalSkin(m, variant) {
  const cloud = variant.startsWith('cloud');
  const blast = variant.startsWith('blast');
  const set = (path, img, color, kind, border) => {
    const n = findNode(m.root, path);
    if (!n) return;
    m.drawOverrides.set(path, {
      role: n.draw ? n.draw.role : 'image',
      img, kind, border, color, fill: 1,
    });
  };
  if (cloud) {
    const b = [8.658399, 8.658399, 8.661971, 8.661971];
    set('Base/Box', 'cloud', [1, 1, 1, 1], 'sliced', b);
    set('Base/Shadow', 'cloud', [0, 0, 0, 0.149], 'sliced', b);
    set('Behind/Box', 'cloudBehind', [1, 1, 1, 1], 'sliced', b);
    set('Behind/Shadow', 'cloudBehind', [0, 0, 0, 0.149], 'sliced', b);
  } else if (blast) {
    set('Base/Box', 'blast', [1, 1, 1, 1], 'simple', [0, 0, 0, 0]);
    set('Base/Shadow', 'blast', [0, 0, 0, 0.149], 'simple', [0, 0, 0, 0]);
    set('Behind/Box', 'cloudBlast', [1, 1, 1, 1], 'simple', [0, 0, 0, 0]);
    set('Behind/Shadow', 'cloudBlast', [0, 0, 0, 0.149], 'simple', [0, 0, 0, 0]);
  } else {
    set('Base/Box', 'box', [1, 1, 1, 1], 'sliced', [147, 147, 147, 147]);
    set('Base/Shadow', 'box', [0, 0, 0, 0.149], 'sliced', [147, 147, 147, 147]);
    set('Behind/Box', 'boxBehind', [1, 1, 1, 1], 'sliced', [90.244606, 90.244606, 90.408455, 90.408455]);
    set('Behind/Shadow', 'boxBehind', [0, 0, 0, 0.149], 'sliced', [90.244606, 90.244606, 90.408455, 90.408455]);
  }
}

function prepareSfx(line) {
  const m = modeRuntime.sfx;
  resetMode(m);
  hideAllModes('sfx');
  setRootVisible(m, true);
  const text = line.text || '';
  const fontSize = Number(line.fontSize) > 0 ? Number(line.fontSize) : 52;
  const L = getRichLayout(text, 532, fontSize, FONT_DIALOGUE, 1.22);
  const textW = Math.max(1, ...L.lines.map(l => l.width));
  const W = Math.min(682, Math.max(400, Math.ceil(textW + 150)));
  const H = Math.min(720, Math.max(400, Math.ceil(L.height + 150)));
  const pos = line.sfx || { x: 960, y: 470 };
  m.root.ax = m.root.bx = m.root.ay = m.root.by = 0.5;
  m.root.px = pos.x - 960;
  m.root.py = 540 - pos.y;
  m.root.sw = 0; m.root.sh = 0;
  m.root.pvx = m.root.pvy = 0.5;
  const base = findNode(m.root, 'Base');
  if (base) { base.sw = W; base.sh = H; }
  const textNode = findNode(m.root, 'Text');
  if (textNode) {
    textNode.sw = W - 150;
    textNode.sh = H - 150;
    textNode.px = 0; textNode.py = 0;
  }
  if (line.enter !== 'none') addClip(m, 'narration.Dialogue_MangaNarrationText_Entry', false);
  m.line = line;
}

function prepareLocation(line) {
  const m = modeRuntime.location;
  resetMode(m);
  hideAllModes('location');
  setRootVisible(m, true);
  m.root.ax = m.root.bx = 0;
  m.root.ay = m.root.by = 0;
  m.root.px = 0;
  m.root.py = 262;
  m.root.sw = 100; m.root.sh = 160;
  m.root.pvx = 0; m.root.pvy = 1;
  m.root.sx = 1; m.root.sy = 1;
  if (line.enter !== 'none') addClip(m, 'location.Start', false);
  m.line = line;
}

// Dialogue_NewsText_Entry: root scale keys and cubic coefficients extracted
// from the game's AnimationClip. The two news prefabs use the same clip.
ANIM['news.Entry'] = {
  stop: 0.5,
  channels: [
    { path: '', p: 'sx', keys: [
      [0, 0, -475.20001220703125, 118.80000305175781, 0],
      [0.1666666716337204, 1.100000023841858, 5.400002956390381, -2.7000012397766113, 0],
      [0.5, 1, 0, 0, 0],
    ] },
    { path: '', p: 'sy', keys: [
      [0, 0, -475.20001220703125, 118.80000305175781, 0],
      [0.1666666716337204, 1.100000023841858, 5.400002956390381, -2.7000012397766113, 0],
      [0.5, 1, 0, 0, 0],
    ] },
  ],
};

function prepareNews(line, talk) {
  const m = modeRuntime[talk ? 'newsTalk' : 'newsSummary'];
  resetMode(m);
  hideAllModes(talk ? 'newsTalk' : 'newsSummary');
  setRootVisible(m, true);
  const sender = findNode(m.root, 'Sender');
  if (sender) sender.hidden = !(line.speakerName || line.speaker);
  if (line.enter !== 'none') {
    addClip(m, 'news.Entry', false);
    if (Number.isFinite(line.entryDuration) && line.entryDuration > 0) {
      m.clips[m.clips.length - 1].rate = ANIM['news.Entry'].stop / line.entryDuration;
    }
  }
  m.line = line;
}

function prepareFullscreen(line) {
  const m = modeRuntime.fullscreen;
  resetMode(m);
  hideAllModes('fullscreen');
  setRootVisible(m, true);
  m.line = line;
}

function prepareTransition(line) {
  const m = modeRuntime.transition;
  resetMode(m);
  hideAllModes('transition');
  setRootVisible(m, true);
  m.extra.kind = line.kind || 'fadeblack';
  m.line = line;
}

const BRANCH_SLOT_WIDTH = 1422;
const BRANCH_SLOT_HEIGHT = 104;
const BRANCH_SLOT_GAP = 40;
const BRANCH_LIST_CENTER_Y = 370;

function branchSlotNode(text) {
  const node = (name, path, ax, ay, bx, by, px, py, sw, sh, pvx, pvy, extra = {}) => ({
    name, path, active: true, ax, ay, bx, by, px, py, sw, sh, pvx, pvy,
    sx: 1, sy: 1, sz: 1, rot: 0, cg: 1, ...extra,
  });
  return node('DialogueBranchSlotNormal', '', 0.5, 0.5, 0.5, 0.5, 0, 0,
    BRANCH_SLOT_WIDTH, BRANCH_SLOT_HEIGHT, 0.5, 0.5, {
      draw: { role: 'branchBar', img: 'branchBase', color: [1, 1, 1, 1] },
      children: [
        node('Text', 'Text', 0, 0.5, 1, 0.5, 0, 3, -240, 76, 0.5, 0.5, {
          draw: { role: 'branchText', text, fontSize: 46, fontColor: { r: 0.2, g: 0.2, b: 0.2, a: 1 } },
        }),
        node('Mask', 'Mask', 0, 0, 1, 1, 0, 0, 0, 0, 0.5, 0.5, {
          children: [
            node('Additive', 'Mask/Additive', 0, 0, 1, 1, 0, 4.5, 0, -9, 0.5, 0.5, {
              draw: { role: 'branchBarGlow', img: 'branchBase', color: [0.566, 0.704, 0.228, 1] },
            }),
          ],
        }),
        node('BubbleBox', 'BubbleBox', 0, 0.5, 0, 0.5, 30, -30, 104, 104, 0.5, 0, {
          draw: { role: 'image', img: 'branchBubble', color: [1, 1, 1, 1] },
          children: [
            node('Dot', 'BubbleBox/Dot', 0.5, 0.5, 0.5, 0.5, 0, 8, 50, 10, 0.5, 0.5, {
              rot: 2,
              children: [
                node('Dot1', 'BubbleBox/Dot/Dot1', 0.5, 0.5, 0.5, 0.5, -20, 0, 10, 10, 0.5, 0.5, {
                  draw: { role: 'branchDot', img: 'branchDot', color: [0.486, 0.788, 0.286, 1] },
                }),
                node('Dot2', 'BubbleBox/Dot/Dot2', 0.5, 0.5, 0.5, 0.5, 0, 0, 10, 10, 0.5, 0.5, {
                  draw: { role: 'branchDot', img: 'branchDot', color: [0.486, 0.788, 0.286, 1] },
                }),
                node('Dot3', 'BubbleBox/Dot/Dot3', 0.5, 0.5, 0.5, 0.5, 20, 0, 10, 10, 0.5, 0.5, {
                  draw: { role: 'branchDot', img: 'branchDot', color: [0.486, 0.788, 0.286, 1] },
                }),
              ],
            }),
          ],
        }),
        node('Deco', 'Deco', 1, 0, 1, 0, -49, 39, 49.4534, 49.453, 0.5, 0.5, {
          rot: 37,
          children: [
            node('BranchDecoA', 'Deco/BranchDecoA', 0.5, 0.5, 0.5, 0.5, -10.7, -9.9, 32, 42, 0, 1, {
              draw: { role: 'image', img: 'branchDeco1', color: [1, 1, 1, 1] },
            }),
            node('BranchDecoB', 'Deco/BranchDecoB', 0.5, 0.5, 0.5, 0.5, 12.2, -1.9, 34, 36, 0, 1, {
              draw: { role: 'image', img: 'branchDeco2', color: [1, 1, 1, 1] },
            }),
          ],
        }),
      ],
    });
}

function branchSlotPositions(count) {
  const total = count * BRANCH_SLOT_HEIGHT + Math.max(0, count - 1) * BRANCH_SLOT_GAP;
  const first = BRANCH_LIST_CENTER_Y - total / 2 + BRANCH_SLOT_HEIGHT / 2;
  return Array.from({ length: count }, (_, i) => first + i * (BRANCH_SLOT_HEIGHT + BRANCH_SLOT_GAP));
}

function prepareBranch(line) {
  const now = performance.now();
  // In the game the branch overlay only contains the option slots; the
  // question is the dialogue text that is already on screen. Keep the real
  // NormalText box behind the choices instead of drawing an invented prompt.
  const questionLine = {
    mode: 'normal', text: line.text || '', speaker: line.speaker || null,
    speakerName: line.speakerName || null, hold: 0,
  };
  prepareNormal(questionLine);
  const questionMode = modeRuntime.normal;
  questionMode.reveal = getRichTypingPlan(questionLine.text).charCount;
  questionMode.clips = [{ key: 'normal.Dialogue_NormalText_Normal', loop: true, start: now }];
  const m = modeRuntime.branch;
  resetMode(m);
  setRootVisible(m, true);
  const opts = line.options || [];
  const positions = branchSlotPositions(opts.length);
  const slots = opts.map((opt, i) => {
    const text = opt && typeof opt === 'object' ? (opt.text || '') : String(opt || '');
    const available = !opt.condition || Boolean(window.TrickcalExpressions.evaluate(opt.condition, state.variables));
    const node = branchSlotNode(text);
    if (!available) node.cg = 0.45;
    node.px = 0;
    node.py = H / 2 - positions[i];
    const slotMode = {
      root: node, clips: [{ key: 'branch.Entry', loop: false, start: now }],
      drawOverrides: new Map(), extra: {}, line: { text },
    };
    return { index: i, text, node, mode: slotMode, phase: 'entry', startedAt: now, screenY: positions[i], available };
  });
  m.extra = {
    slots, hits: [], choice: null, choiceAt: 0, exiting: false, exitAt: 0,
    advanced: false, startedAt: now,
  };
  m.line = line;
}

function drawBranchBackdrop(now, m) {
  // WindowDialogue/DimBackground (CommonSquare_3232, black 69.804%) sits
  // behind the modal branch layer. Branch/Background adds the authored top
  // gradient (CommonGradient_0001, black 10.196%, flipped from the top).
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.698)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const rect = { x: -W / 2, y: H / 2 - 642.61, w: W, h: 642.61 };
  drawGradient(rect, SCREEN, 0.10196, true);
}

function drawBranch(now, line) {
  const m = modeRuntime.branch;
  const extra = m.extra || {};
  const slots = extra.slots || [];
  drawBranchBackdrop(now, m);
  const questionMode = modeRuntime.normal;
  if (questionMode.visible) {
    const q = collectOverrides(questionMode, now);
    drawNode(questionMode.root, W, H, 0.5, 0.5, SCREEN, 1, q.ov, questionMode, now);
  }
  const entryStop = (ANIM['branch.Entry'] && ANIM['branch.Entry'].stop) || 1.08333;
  const selectStop = (ANIM['branch.Select'] && ANIM['branch.Select'].stop) || 1.06667;
  const exitStop = (ANIM['branch.Exit'] && ANIM['branch.Exit'].stop) || 0.65;
  for (const slot of slots) {
    if (slot.phase === 'entry' && (now - slot.startedAt) / 1000 >= entryStop) {
      slot.phase = 'idle';
      slot.mode.clips = [{ key: 'branch.Idle', loop: true, start: now }];
    }
    const { ov } = collectOverrides(slot.mode, now);
    drawNode(slot.node, W, H, 0.5, 0.5, SCREEN, 1, ov, slot.mode, now);
  }
  extra.hits = extra.choice == null ? slots.filter(s => s.available).map(s => ({
    x: 960 - BRANCH_SLOT_WIDTH / 2, y: s.screenY - BRANCH_SLOT_HEIGHT / 2,
    w: BRANCH_SLOT_WIDTH, h: BRANCH_SLOT_HEIGHT, index: s.index,
  })) : [];
  if (extra.choice != null) {
    if (!extra.exiting && now - extra.choiceAt >= selectStop * 1000) {
      extra.exiting = true;
      extra.exitAt = now;
      for (const slot of slots) {
        slot.phase = 'exit';
        slot.mode.clips = [{ key: 'branch.Exit', loop: false, start: now }];
      }
    } else if (extra.exiting && !extra.advanced && now - extra.exitAt >= exitStop * 1000) {
      extra.advanced = true;
      const opt = (line.options || [])[extra.choice];
      state.transition = null;
      startLine(opt && opt.next != null ? opt.next : state.line + 1, captureContinuity(now));
    }
  }
}

function chooseBranch(index) {
  const line = STORY[state.line];
  if (!line || line.mode !== 'branch' || state.transition) return;
  const opt = (line.options || [])[index];
  if (!opt) return;
  try {
    if (opt.condition && !window.TrickcalExpressions.evaluate(opt.condition, state.variables)) return;
  } catch (error) {
    reportRuntimeError(line, error);
    return;
  }
  const m = modeRuntime.branch;
  if (m.extra.choice != null) return;
  const now = performance.now();
  m.extra.choice = index;
  m.extra.choiceAt = now;
  state.transition = 'branchChoice';
  const slot = (m.extra.slots || [])[index];
  if (slot) {
    slot.phase = 'select';
    slot.mode.clips = [{ key: 'branch.Select', loop: false, start: now }];
  }
}

function prepareScroll(line) {
  const m = modeRuntime.scroll;
  resetMode(m);
  hideAllModes('scroll');
  setRootVisible(m, true);
  m.line = line;
}

function prepareCg(line) {
  const m = modeRuntime.cg;
  resetMode(m);
  hideAllModes('cg');
  setRootVisible(m, true);
  m.line = line;
}

function drawCg(now, line) {
  const m = modeRuntime.cg;
  let fade = Math.max(0, Math.min(1, (now - m.startedAt) / 500));
  if (m.extra.exitStart) {
    const ex = Math.max(0, Math.min(1, (now - m.extra.exitStart) / (m.extra.exitDuration || 300)));
    fade *= 1 - ex;
  }
  const im = IMG.cg1;
  if (!im) return;
  const t = Math.max(0, Math.min(1, (now - state.lineStart) / Math.max(1000, (line.hold || 5) * 1000)));
  const zoom = 1.06 - 0.06 * t;
  const scale = Math.max(W / im.width, H / im.height) * zoom;
  const dw = im.width * scale, dh = im.height * scale;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  // SoftFrame letterbox
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, W, 88);
  ctx.fillRect(0, H - 88, W, 88);
  const g = ctx.createLinearGradient(0, H * 0.58, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.58, W, H * 0.42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 24px ${FONT_DIALOGUE}`;
  ctx.fillStyle = 'rgba(217,185,110,.85)';
  ctx.fillText('CHAPTER 01', W / 2, H - 210);
  ctx.font = `800 58px ${FONT_DIALOGUE}`;
  ctx.fillStyle = '#f7f0df';
  ctx.fillText(line.title || '未命名剧情', W / 2, H - 140);
  if (line.text) {
    ctx.font = `500 28px ${FONT_DIALOGUE}`;
    ctx.fillStyle = 'rgba(245,238,225,.65)';
    ctx.fillText(richPlain(line.text, 28), W / 2, H - 88 + 4);
  }
  ctx.restore();
}

function drawScroll(now, line) {
  const m = modeRuntime.scroll;
  let fade = Math.max(0, Math.min(1, (now - m.startedAt) / 400));
  if (m.extra.exitStart) {
    const ex = Math.max(0, Math.min(1, (now - m.extra.exitStart) / (m.extra.exitDuration || 300)));
    fade *= 1 - ex;
  }
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, W, H);
  const glows = [
    [W * 0.24, H * 0.26, 520, 'rgba(58,126,60,.16)'],
    [W * 0.78, H * 0.72, 560, 'rgba(92,70,132,.13)'],
    [W * 0.55, H * 0.1, 420, 'rgba(70,104,150,.10)'],
  ];
  for (const [gx, gy, gr, col] of glows) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const bottom = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  const t = Math.max(0, Math.min(1, (now - state.lineStart) / Math.max(1000, (line.hold || 6) * 1000)));
  const rect = { x: -560, y: -340 + 80 * t, w: 1120, h: 900 };
  drawTextBlock(line.text || '', line.text || '', rect, SCREEN, {
    size: 44, family: FONT_DIALOGUE, align: 'left', color: 'rgba(240,236,222,.94)',
    lineHeight: 1.55, shadow: 'rgba(0,0,0,.35)', shadowY: 2,
  }, 1, getRichTypingPlan(line.text || '').charCount);
  ctx.globalAlpha = fade;
  ctx.strokeStyle = 'rgba(217,185,110,.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, 205);
  ctx.lineTo(300, 205);
  ctx.stroke();
  ctx.font = `700 24px ${FONT_DIALOGUE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(217,185,110,.85)';
  ctx.fillText('SCROLL · 记录', 220, 190);
  ctx.font = `500 22px ${FONT_DIALOGUE}`;
  ctx.fillStyle = 'rgba(235,228,215,.45)';
  ctx.fillText('点击继续', 220, H - 80);
  ctx.restore();
}

function drawTransition(now, line) {
  const dur = Math.max(0.2, line.hold || 1.4) * 1000;
  const t = Math.max(0, Math.min(1, (now - state.lineStart) / dur));
  const e = t * t * (3 - 2 * t);
  const kind = line.kind || 'fadeblack';
  ctx.save();
  if (kind === 'fadeblack' || kind === 'fadeinblack' || kind === 'fadeoutblack') {
    let a = e;
    if (kind === 'fadeblack') a = t < 0.5 ? t * 2 : (1 - t) * 2;
    if (kind === 'fadeinblack') a = 1 - e;
    if (kind === 'fadeoutblack') a = e;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, W, H);
  } else if (kind === 'fadeinwhite' || kind === 'fadeoutwhite') {
    const a = kind === 'fadeinwhite' ? 1 - e : e;
    ctx.fillStyle = `rgba(245,240,235,${a})`;
    ctx.fillRect(0, 0, W, H);
  } else if (kind === 'circle') {
    const r = e * Math.hypot(W, H) * 0.58;
    ctx.fillStyle = 'rgba(4,3,6,1)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, Math.max(0.01, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  } else if (kind === 'rightpush') {
    const x = (1 - t) * W - t * W;
    ctx.fillStyle = '#09070a';
    ctx.fillRect(x, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(x + W - 6, 0, 6, H);
  } else if (kind === 'colorbars') {
    const bars = ['#0a080b', '#e8dfcd', '#a7353f', '#3c6a53', '#2d4d7a', '#d5b267'];
    const bw = W / bars.length;
    const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
    const height = H * phase * phase * (3 - 2 * phase);
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = bars[i];
      ctx.fillRect(i * bw, 0, bw + 1, height);
    }
  } else if (kind === 'storynext' || kind === 'storyend') {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(8,6,10,.92)');
    g.addColorStop(0.62, 'rgba(8,6,10,.72)');
    g.addColorStop(1, 'rgba(8,6,10,.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const gold = '#d9b96e';
    ctx.fillStyle = gold;
    ctx.fillRect(120, 330, 74, 3);
    ctx.font = `700 26px ${FONT_DIALOGUE}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(245,238,225,.72)';
    ctx.fillText('CHAPTER 01 · COMPLETE', 120, 300);
    ctx.font = `800 76px ${FONT_DIALOGUE}`;
    ctx.fillStyle = '#f7f0df';
    ctx.fillText(kind === 'storyend' ? '第 1 话 · 完' : '下一话', 120, 440);
    ctx.font = `600 38px ${FONT_DIALOGUE}`;
    ctx.fillStyle = gold;
    ctx.fillText(kind === 'storyend' ? '钟声仍在地底回响' : '钟楼的余烬', 120, 508);
    ctx.font = `500 25px ${FONT_DIALOGUE}`;
    ctx.fillStyle = 'rgba(245,238,225,.5)';
    ctx.fillText(kind === 'storyend' ? '感谢观看' : '点击继续', 120, 610);
  }
  ctx.restore();
}

function prepareNormal(line, reuse) {
  const m = modeRuntime.normal;
  resetMode(m);
  hideAllModes('normal');
  setRootVisible(m, true);
  const variant = normalVariantFor(line);
  const cloud = variant.startsWith('cloud');
  const blast = variant.startsWith('blast');
  const noName = variant === 'normalNoName' || variant === 'cloud' || variant === 'blastNoName';
  const behind = findNode(m.root, 'Behind');
  if (behind) {
    // In the prefab Behind is inactive for the Normal state. The Cloud state
    // uses it for the authored cloud backing; the Blast art already carries
    // its own jagged outline, so no extra backplate is drawn.
    behind.hidden = !cloud;
    behind.forceShow = cloud;
  }
  // The authored Shadow layers are hidden in this demo; the box art already
  // carries its soft edge. The draw data still points at the exact sprites so
  // the state can be re-enabled without guessing.
  for (const p of ['Base/Shadow', 'Behind/Shadow']) {
    const n = findNode(m.root, p);
    if (n) n.hidden = true;
  }
  applyNormalSkin(m, variant);
  const normalText = findNode(m.root, 'Text');
  if (normalText) {
    normalText.px = (normalText.base?.px ?? 0) + (Number(line.textOffsetX) || 0);
    normalText.py = (normalText.base?.py ?? 0) + (Number(line.textOffsetY) || 0);
  }
  const sender = findNode(m.root, 'Sender');
  if (sender) {
    sender.hidden = noName || !line.speaker;
    if (!sender.hidden && line.speaker) setupPlate(m, 'Sender', lineSpeakerName(line), 150);
    // EmoticonBase is the name-tag slot in the prefab. Story moods are a
    // separate scene-level overlay (see drawEmoticonOverlay), so keep this
    // small slot out of the dialogue box.
    const eb = findNode(m.root, 'Sender/EmoticonBase');
    if (eb) eb.hidden = true;
  }
  if (cloud) {
    m.root.sx = 1; m.root.sy = 1;
    addClip(m, 'normal.Dialogue_NormalText_CloudIdleX', true);
    addClip(m, 'normal.Dialogue_NormalText_CloudIdleY', true);
  } else if (blast) {
    m.root.sx = 1; m.root.sy = 1;
    if (line.enter !== 'none') addClip(m, 'normal.Dialogue_NormalText_BlastEntry', false);
    addClip(m, 'normal.Dialogue_NormalText_BlastIdle', true);
  } else {
    addClip(m, 'normal.Dialogue_NormalText_Normal', true);
  }
  m.cloud = cloud;
  m.blast = blast;
  m.line = line;
}

function prepareClear(line, reuse) {
  const m = modeRuntime.clear;
  const keep = reuse && m.visible;
  m.root.sx = 1;
  m.root.sy = 1;
  if (!keep) {
    resetMode(m);
    hideAllModes('clear');
    setRootVisible(m, true);
    if (line.enter !== 'none') addClip(m, 'clear.Dialogue_ClearText_Entry', false);
  } else {
    m.clips = m.clips.filter(c => !['clear.Dialogue_ClearText_Entry', 'clear.Dialogue_ClearText_ReEntry'].includes(c.key));
    if (line.enter !== 'none') addClip(m, 'clear.Dialogue_ClearText_ReEntry', false);
    m.startedAt = performance.now();
  }
  setupPlate(m, 'HeroHead/NamePlate', lineSpeakerName(line), 78);
  const hero = findNode(m.root, 'HeroHead');
  if (hero) hero.hidden = false;
  // The purple variant uses the authored Behind plate as the main plate.
  const clearBehind = findNode(m.root, 'BaseParent/Behind');
  const clearBase = findNode(m.root, 'BaseParent/Base');
  if (clearBehind) {
    clearBehind.hidden = !line.purple;
    if (line.purple) { clearBehind.px = 0; clearBehind.py = 0; }
  }
  if (clearBase) clearBase.hidden = !!line.purple;
  m.extra.textColor = line.purple ? '#f7f0fb' : null;
  const ring = findNode(m.root, 'HeroHead/Hero/OutLineBg');
  if (ring) ring.hidden = true;
  const frontBg = findNode(m.root, 'HeroHead/Hero/FrontBg');
  if (frontBg) {
    frontBg.hidden = false;
    // Prefab values: FrontBg fills the 265x265 Hero rect (sizeDelta 0).
    frontBg.sw = 0;
    frontBg.sh = 0;
    frontBg.draw.color = line.avatarBg ? [...hexToRgb(line.avatarBg).map(value => value / 255), 1] : [...frontBg.base.draw.color];
  }
  m.line = line;
}

function prepareAnime(line) {
  const m = modeRuntime.anime;
  resetMode(m);
  hideAllModes('anime');
  setRootVisible(m, true);
  const gra = findNode(m.root, 'Gra');
  if (gra) { gra.sw = 2000; gra.sh = 400; gra.px = 0; gra.py = 0; }
  const plate = findNode(m.root, 'Text/NamePlate');
  const hasSpeaker = !!line.speaker || !!line.speakerName;
  if (plate) {
    plate.hidden = !hasSpeaker;
    plate.cg = 1;
    // Prefab layout: NamePlate is a child of the fitted TMP rect, anchored to
    // the text's left edge with anchoredPosition.x = -118 (see AnimeText.prefab).
    // The demo draws the caption in a fixed 1600px box, so emulate the fitted
    // text width and place the plate at the first-line start instead of at the
    // screen centre.
    const text = line.text || '';
    const size = fitSize(text, 1600, 170, Number(line.fontSize) > 0 ? Number(line.fontSize) : 52, 38, FONT_DIALOGUE, 1.3);
    const L = getRichLayout(text, 1600, size, FONT_DIALOGUE, 1.3);
    let textWidth = 0;
    for (const ln of L.lines) textWidth = Math.max(textWidth, ln.width);
    plate.px = -textWidth / 2 - 118;
  }
  setupPlate(m, 'Text/NamePlate', hasSpeaker ? lineSpeakerName(line) : '', 96);
  if (hasSpeaker) addClip(m, 'anime.Dialogue_Anime_NamePlate', false);
  m.line = line;
}

function prepareTitle(line) {
  const m = modeRuntime.title;
  resetMode(m);
  hideAllModes('title');
  setRootVisible(m, true);
  const cinema = findNode(m.root, 'Panel/CinemaFrameGroup');
  if (cinema) cinema.hidden = line.cinema === false || line.cleanTitle === true;
  addClip(m, 'title.Start', false);
  m.line = line;
}

/* ---------------------------------------------------------------- line control */
function typingDelayFor(line) {
  switch (line.mode) {
    case 'narration': return 300;
    case 'manga': case 'mangaThink': return 280;
    case 'normal': case 'cloud': case 'blast': return 250;
    case 'clear': return 500;
    case 'clearRe': return 250;
    case 'anime': return 0;
    case 'sfx': return 300;
    case 'location': return 250;
    default: return 0;
  }
}

function typingEndFor(line) {
  return typingDelayFor(line) + lineTypingPlan(line).total;
}


const audioPlayer = window.TrickcalAudioPlayer.create({
  createAudio: () => new Audio(),
  requestFrame: callback => requestAnimationFrame(callback),
  now: () => performance.now(),
  resolveUrl: src => /^(data:|blob:|https?:|\/)/.test(src) ? src : assetUrl(src),
  onError: (alias, error) => console.warn('audio playback failed', alias, error),
});
const playAudioCommand = cmd => audioPlayer.play(cmd);

function handleAudioCommands(list) {
  if (!Array.isArray(list)) return;
  for (const cmd of list) playAudioCommand(cmd);
}
function sampleBackgroundLayers(now) {
  if (!state.freeze && state.stopStageAt != null) now = Math.min(now, state.stopStageAt);
  const transition = state.bgTransition;
  if (!transition && state.bgFrozenLayers) return state.bgFrozenLayers.map(layer => ({ surface: { ...layer.surface }, alpha: layer.alpha }));
  if (!transition) return [{
    surface: { solid: state.bgSolid, color: state.bgColor, key: state.bgKey },
    alpha: 1,
  }];
  const progress = Math.max(0, Math.min(1, (now - transition.start) / transition.duration));
  const eased = window.TrickcalCameraTimeline.ease(progress, transition.ease);
  if (progress >= 1) {
    state.bgTransition = null;
    return [{ surface: transition.to, alpha: 1 }];
  }
  const layers = transition.from
    .map(layer => ({ surface: layer.surface, alpha: layer.alpha * (1 - eased) }))
    .filter(layer => layer.alpha > 0.001);
  if (eased > 0.001) layers.push({ surface: transition.to, alpha: eased });
  return layers;
}

function applySceneBackground(scene, transition = null, startAt = performance.now()) {
  if (!scene || (scene.bg !== null && !scene.bg && !scene.bgUrl)) {
    state.bgTransition = null;
    state.bgFrozenLayers = null;
    return;
  }
  const from = transition && Number(transition.duration) > 0 ? sampleBackgroundLayers(startAt) : null;
  const to = {
    solid: scene && scene.bg === null,
    color: scene && scene.bg === null ? '#000000' : state.bgColor,
    key: scene && scene.bg ? scene.bg : state.bgKey,
  };
  if (scene && scene.bgUrl && !IMG[to.key]) ensureImage(to.key, scene.bgUrl);
  state.bgFrozenLayers = null;
  state.bgTransition = from
    ? { from, to, start: startAt, duration: Number(transition.duration) * 1000, ease: transition.ease || 'OutCubic' }
    : null;
  if (!state.bgTransition) releaseBackgroundBuffers();
  if (scene.bg === null) {
    state.bgSolid = true;
    state.bgColor = '#000000';
  } else if (scene.bg || scene.bgUrl) {
    state.bgSolid = false;
    const key = scene.bg || 'bgCustom';
    state.bgKey = key;
  }
}
function applyStageEvent(event, options = {}) {
  if (!event || event.type !== 'stage') return;
  if (event.action === 'hide') {
    // A show awaiting a Spine asset must not resurrect an already hidden actor.
    state.pendingStageEvents = state.pendingStageEvents.filter(pending =>
      event.id !== 'all' && event.id !== 'stage' && pending.conf?.id !== event.id);
    if (event.id === 'all' || event.id === 'stage') {
      for (const item of stageActors.values()) item.targetAlpha = 0;
      for (const item of stageImages.values()) item.targetAlpha = 0;
    } else {
      const actor = stageActors.get(event.id);
      const image = stageImages.get(event.id);
      if (actor) actor.targetAlpha = 0;
      if (image) image.targetAlpha = 0;
    }
    return;
  }
  const originalConf = event.conf;
  if (!originalConf) return;
  if (uiObjects.has(originalConf.id)) {
    reportRuntimeError({ sourceLine: event.sourceLine }, new Error(`UI 名称与舞台对象重复：${originalConf.id}`));
    return false;
  }
  if (!options.replayPending) {
    state.lineActorOverrides.delete(originalConf.id);
    state.stageBindings.delete(originalConf.id);
  }
  const conf = { ...originalConf, ...(state.stageBindings.get(originalConf.id) || {}) };
  if (conf.kind === 'image') {
    let item = stageImages.get(conf.id);
    if (!item) {
      item = {
        id: conf.id, conf, x: conf.x ?? 960, y: conf.y ?? 540,
        targetX: conf.x ?? 960, targetY: conf.y ?? 540,
        sx: conf.sx ?? 1, sy: conf.sy ?? 1,
        targetSX: conf.sx ?? 1, targetSY: conf.sy ?? 1,
        rot: conf.rot || 0, targetRot: conf.rot || 0,
        alpha: 0, targetAlpha: conf.hidden ? 0 : (conf.alpha ?? 1),
        brightness: conf.brightness ?? 1, z: Number(conf.z) || 0,
      };
      stageImages.set(conf.id, item);
    }
    item.conf = conf;
    item.targetX = conf.x ?? 960;
    item.targetY = conf.y ?? 540;
    item.targetSX = conf.sx ?? 1;
    item.targetSY = conf.sy ?? 1;
    item.targetRot = conf.rot || 0;
    item.targetAlpha = conf.hidden ? 0 : (conf.alpha ?? 1);
    item.brightness = conf.brightness ?? 1;
    item.z = Number(conf.z) || 0;
    ensureImage(stageImageKey(conf.src), conf.src);
    return;
  }
  const actor = spineActors.get(conf.id) || ensureStageActor(conf.id, conf);
  if (!actor) {
    state.pendingStageEvents.push({ ...event, line: state.line });
    return;
  }
  let item = stageActors.get(conf.id);
  if (!item) {
    item = stageTargetFor(actor, conf);
    stageActors.set(conf.id, item);
  }
  item.conf = conf;
  item.targetX = conf.x ?? item.targetX;
  item.targetY = conf.y ?? item.targetY;
  item.targetSX = conf.sx ?? item.targetSX;
  item.targetSY = conf.sy ?? item.targetSY;
  item.targetAlpha = conf.hidden ? 0 : (conf.alpha ?? 1);
  item.face = conf.face ?? item.face;
  item.brightness = conf.brightness ?? 1;
  item.z = Number(conf.z) || 0;
  applyActorAppearance(actor, { ...conf, ...(state.lineActorOverrides.get(conf.id) || {}) });
}
function applyBindingEvent(event) {
  if (!event || event.type !== 'bind') return;
  state.stageBindings.set(event.child, { ...event.binding });
  const item = stageActors.get(event.child) || stageImages.get(event.child);
  if (!item) return;
  if (event.action === 'unbind' && event.binding.x != null) {
    item.x = item.targetX = event.binding.x;
    item.y = item.targetY = event.binding.y;
  }
  item.conf = { ...(item.conf || {}), ...event.binding };
}
function updateCameraAt(now) {
  if (!state.lineCameraTimeline) return;
  const time = state.freeze && state.freezeTime ? state.freezeTime
    : state.stopStageAt != null ? Math.min(now, state.stopStageAt) : now;
  state.camera = window.TrickcalCameraTimeline.sample(state.lineCameraTimeline, (time - state.lineStart) / 1000);
}
function updateEffectAt(now) {
  if (!state.lineEffectTimeline) return;
  const time = state.freeze && state.freezeTime ? state.freezeTime
    : state.stopStageAt != null ? Math.min(now, state.stopStageAt) : now;
  state.sceneFx = window.TrickcalCameraTimeline.sampleEffect(state.lineEffectTimeline, (time - state.lineStart) / 1000);
}
function dispatchLineEvents(now) {
  const elapsed = (now - state.lineStart) / 1000;
  const uiActions = state.lineUiActions || [];
  while (true) {
    const nextEvent = state.lineEvents[state.lineEventIndex];
    const nextAction = uiActions[state.uiActionIndex];
    const eventDue = nextEvent && nextEvent.delay <= elapsed;
    const actionDue = nextAction && (nextAction.delay || 0) <= elapsed;
    if (!eventDue && !actionDue) break;
    if (actionDue && (!eventDue || compareUiTime(nextAction, nextEvent) < 0)) {
      state.uiActionIndex++;
      if (!uiObjects.has(nextAction.actor)) {
        reportRuntimeError({ sourceLine: nextAction.sourceLine }, new Error(`动画对象不存在：${nextAction.actor}`));
        return false;
      }
      continue;
    }
    const event = state.lineEvents[state.lineEventIndex++];
    if (event.type === 'ui') {
      const line = STORY[state.line];
      try {
        const before = uiObjects;
        state.uiSamplingBoundary = event;
        applyUiOperation(event.operation, state.lineStart + event.delay * 1000, stageBeforeUiEvent(line, event));
        recordUiActionFences(before, uiObjects, event, state.uiActionFences);
        if (line.mode === 'ui-present' && event.operation.type === 'set' &&
            Object.hasOwn(event.operation.values || {}, 'text')) state.typingDone = false;
      } catch (error) {
        reportRuntimeError({ sourceLine: event.sourceLine }, error);
        return false;
      } finally {
        state.uiSamplingBoundary = null;
      }
    } else if (event.type === 'audio') playAudioCommand(event.command);
    else if (event.type === 'scene') applySceneBackground(event.scene, event.scene.transition, state.lineStart + event.delay * 1000);
    else if (event.type === 'shader') applyLineShader({ shader: event.shader, sourceLine: event.sourceLine });
    else if (event.type === 'stage') {
      if (applyStageEvent(event) === false) return false;
    }
    else if (event.type === 'bind') applyBindingEvent(event);
    else if (event.type === 'actor') {
      const overrides = { ...(state.lineActorOverrides.get(event.actor) || {}), ...event.patch };
      state.lineActorOverrides.set(event.actor, overrides);
      const actor = spineActors.get(event.actor);
      const conf = (STORY[state.line]?.stage || []).find(item => item.id === event.actor);
      if (actor) applyActorAppearance(actor, { ...(conf || {}), ...overrides });
    } else if (event.type === 'oneshot') {
      const key = `${state.line}:${event.sourceLine}`;
      state.pendingParallelOneShots++;
      prepareOneShot(event.oneShot, state.line, {
        parallel: true,
        key,
        startAt: state.lineStart + event.delay * 1000,
        storyLine: STORY[state.line],
        generation: state.oneShotGeneration,
      });
    }
  }
  updateCameraAt(now);
  updateEffectAt(now);
  return true;
}
function unlockAudio() {
  audioPlayer.unlock();
}

const FX_VERT = `attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 1.0-(a_pos.y*0.5+0.5)); gl_Position = vec4(a_pos,0.0,1.0); }`;
const FX_COMMON = `precision mediump float; varying vec2 v_uv; uniform sampler2D u_texture; uniform float u_time; uniform float u_intensity; `;
const FX_BUILTINS = {
  heat: FX_COMMON + `void main(){ vec2 uv=v_uv; uv.x += sin(uv.y*38.0+u_time*3.0)*0.0025*u_intensity; uv.y += sin(uv.x*26.0+u_time*2.2)*0.0020*u_intensity; vec4 c=texture2D(u_texture,uv); c.r += 0.06*u_intensity; c.b -= 0.02*u_intensity; gl_FragColor=c; }`,
  dream: FX_COMMON + `void main(){ vec4 c=texture2D(u_texture,v_uv); float l=dot(c.rgb,vec3(.299,.587,.114)); c.rgb=mix(c.rgb, vec3(l)*vec3(1.06,1.0,1.10), u_intensity*.26); c.rgb += vec3(.025,.012,.05)*u_intensity; gl_FragColor=c; }`,
  gray: FX_COMMON + `void main(){ vec4 c=texture2D(u_texture,v_uv); float l=dot(c.rgb,vec3(.299,.587,.114)); gl_FragColor=mix(c,vec4(l,l,l,c.a),u_intensity); }`,
  glitch: FX_COMMON + `void main(){ vec2 uv=v_uv; float n=step(0.985, fract(sin(floor(u_time*14.0)*91.7)*43758.5453)); uv.x += n*0.018*u_intensity; gl_FragColor=texture2D(u_texture,uv); }`,
  wave: FX_COMMON + `void main(){ vec2 uv=v_uv; uv.x += sin(uv.y*22.0+u_time*2.0)*0.004*u_intensity; uv.y += cos(uv.x*18.0+u_time*1.7)*0.003*u_intensity; gl_FragColor=texture2D(u_texture,uv); }`,
};
let fxGL = null, fxProgram = null, fxBuffer = null, fxTexture = null, fxSpec = null, fxSourceCache = new Map(), shaderRequest = 0;

function initFXGL() {
  if (fxGL) return true;
  if (!fxCanvas) return false;
  try {
    fxGL = fxCanvas.getContext('webgl', { alpha: false, premultipliedAlpha: false, antialias: false });
    if (!fxGL) throw new Error('webgl unavailable');
    fxBuffer = fxGL.createBuffer();
    fxGL.bindBuffer(fxGL.ARRAY_BUFFER, fxBuffer);
    fxGL.bufferData(fxGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), fxGL.STATIC_DRAW);
    fxTexture = fxGL.createTexture();
    fxGL.bindTexture(fxGL.TEXTURE_2D, fxTexture);
    fxGL.texParameteri(fxGL.TEXTURE_2D, fxGL.TEXTURE_WRAP_S, fxGL.CLAMP_TO_EDGE);
    fxGL.texParameteri(fxGL.TEXTURE_2D, fxGL.TEXTURE_WRAP_T, fxGL.CLAMP_TO_EDGE);
    fxGL.texParameteri(fxGL.TEXTURE_2D, fxGL.TEXTURE_MIN_FILTER, fxGL.LINEAR);
    fxGL.texParameteri(fxGL.TEXTURE_2D, fxGL.TEXTURE_MAG_FILTER, fxGL.LINEAR);
    return true;
  } catch (e) { console.warn('fx webgl failed', e); fxGL = null; return false; }
}

function compileFX(source) {
  if (!initFXGL()) return false;
  const make = (type, text) => {
    const sh = fxGL.createShader(type);
    fxGL.shaderSource(sh, text); fxGL.compileShader(sh);
    if (!fxGL.getShaderParameter(sh, fxGL.COMPILE_STATUS)) { console.warn('fx shader compile', fxGL.getShaderInfoLog(sh)); return null; }
    return sh;
  };
  const vs = make(fxGL.VERTEX_SHADER, FX_VERT);
  const fs = make(fxGL.FRAGMENT_SHADER, source);
  if (!vs || !fs) return false;
  const prog = fxGL.createProgram();
  fxGL.attachShader(prog, vs); fxGL.attachShader(prog, fs); fxGL.linkProgram(prog);
  if (!fxGL.getProgramParameter(prog, fxGL.LINK_STATUS)) { console.warn('fx link', fxGL.getProgramInfoLog(prog)); return false; }
  fxProgram = prog;
  return true;
}

async function applyLineShader(line) {
  const request = ++shaderRequest;
  const spec = line && line.shader;
  state.shader = spec ? { ...spec } : null;
  if (!spec) { fxSpec = null; fxProgram = null; if (fxCanvas) fxCanvas.style.display = 'none'; return; }
  let source = FX_BUILTINS[spec.name];
  if (spec.name === 'custom' && spec.url) {
    const key = spec.url;
    if (!fxSourceCache.has(key)) {
      try {
        const res = await fetch(assetUrl(spec.url), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fxSourceCache.set(key, await res.text());
      } catch (e) {
        if (request !== shaderRequest) return;
        fxSourceCache.set(key, '');
        fxSpec = null;
        if (fxCanvas) fxCanvas.style.display = 'none';
        reportRuntimeWarning(line, `自定义着色器加载失败：${spec.url}（${e.message || e}）`);
        return;
      }
    }
    if (request !== shaderRequest) return;
    source = fxSourceCache.get(key);
  }
  if (request !== shaderRequest) return;
  if (!source) {
    fxSpec = null;
    if (fxCanvas) fxCanvas.style.display = 'none';
    reportRuntimeWarning(line, `着色器没有可用代码：${spec.url || spec.name}`);
    return;
  }
  if (!compileFX(source)) {
    fxSpec = null;
    if (fxCanvas) fxCanvas.style.display = 'none';
    reportRuntimeWarning(line, `着色器编译失败：${spec.url || spec.name}。请检查片元着色器语法和 WebGL 支持。`);
    return;
  }
  const intensity = Number(spec.intensity);
  fxSpec = { name: spec.name, intensity: Number.isFinite(intensity) ? intensity : 0.5, start: performance.now() };
  if (fxCanvas) fxCanvas.style.display = 'block';
}

function drawFX(now) {
  if (!fxSpec || !fxProgram || !fxGL) { if (fxCanvas) fxCanvas.style.display = 'none'; return; }
  try {
    fxGL.viewport(0, 0, fxCanvas.width, fxCanvas.height);
    fxGL.useProgram(fxProgram);
    const locPos = fxGL.getAttribLocation(fxProgram, 'a_pos');
    fxGL.bindBuffer(fxGL.ARRAY_BUFFER, fxBuffer);
    fxGL.enableVertexAttribArray(locPos);
    fxGL.vertexAttribPointer(locPos, 2, fxGL.FLOAT, false, 0, 0);
    fxGL.activeTexture(fxGL.TEXTURE0);
    fxGL.bindTexture(fxGL.TEXTURE_2D, fxTexture);
    fxGL.pixelStorei(fxGL.UNPACK_FLIP_Y_WEBGL, false);
    fxGL.texImage2D(fxGL.TEXTURE_2D, 0, fxGL.RGBA, fxGL.RGBA, fxGL.UNSIGNED_BYTE, canvas);
    fxGL.uniform1i(fxGL.getUniformLocation(fxProgram, 'u_texture'), 0);
    fxGL.uniform1f(fxGL.getUniformLocation(fxProgram, 'u_time'), (now - fxSpec.start) / 1000);
    fxGL.uniform1f(fxGL.getUniformLocation(fxProgram, 'u_intensity'), fxSpec.intensity);
    fxGL.drawArrays(fxGL.TRIANGLE_STRIP, 0, 4);
    fxCanvas.style.display = 'block';
  } catch (e) {
    console.warn('fx draw failed', e); fxSpec = null; if (fxCanvas) fxCanvas.style.display = 'none';
  }
}

function startLine(i, opts = {}) {
  state.transitionGeneration++;
  state.transition = null;
  if (i === 0 && !opts.carryStage && !opts.carryEnvironment) {
    state.variables = { ...STORY_VARIABLES };
    state.variableHistory = new Map();
  } else if (opts.preserveUiCheckpoint) {
    state.variables = { ...(state.variableHistory.get(i) || STORY_VARIABLES) };
  }
  state.oneShotGeneration++;
  state.oneShot = null;
  state.parallelOneShots.clear();
  state.pendingParallelOneShots = 0;
  state.lineEvents = [];
  state.lineEventIndex = 0;
  state.lineActorOverrides = new Map();
  state.pendingStageEvents = [];
  state.stageBindings = new Map();
  state.stopStageAt = null;
  state.stoppedStageEvents = null;
  state.bubbleScrollManual = null;
  state.bubbleScrollGesture = null;
  const runtimeAlert = document.getElementById('runtimeError');
  if (runtimeAlert.classList.contains('warning')) {
    runtimeAlert.hidden = true;
    runtimeAlert.classList.remove('warning');
  }
  if (i === 0 && !opts.preserveUiCheckpoint && !opts.carryStage && !opts.carryEnvironment) {
    state.variables = { ...STORY_VARIABLES };
    uiObjects = new Map();
    uiTyping.clear();
    uiCheckpoints.clear();
    uiEntrances.clear();
    uiEntranceSuppressed.clear();
    uiExits = [];
    const runtimeError = document.getElementById('runtimeError');
    runtimeError.hidden = true;
    runtimeError.classList.remove('warning');
  }
  let line = STORY[i];
  let carriedStage = opts.carryStage || null;
  let carriedEnvironment = opts.carryEnvironment || null;
  const applyStageOps = current => {
    if (!carriedStage || !Array.isArray(current.stageOps)) { carriedStage = null; return; }
    carriedStage = window.TrickcalStageTimeline.sample([...carriedStage.values()], current.stageOps, [], 0);
  };
  const applyEnvironmentOps = current => {
    if (!carriedEnvironment || !Array.isArray(current.cameraOps) || !Array.isArray(current.effectOps) ||
        !Array.isArray(current.sceneOps) || !Array.isArray(current.shaderOps)) {
      carriedEnvironment = null;
      return;
    }
    for (const patch of current.cameraOps) Object.assign(carriedEnvironment.camera, patch);
    for (const patch of current.effectOps) Object.assign(carriedEnvironment.fx, patch);
    for (const scene of current.sceneOps) carriedEnvironment.scene = { ...scene };
    for (const op of current.shaderOps) {
      carriedEnvironment.shader = op.shader ? { ...op.shader } : null;
      carriedEnvironment.shaderChanged = true;
    }
  };
  let uiSteps = 0;
  const uiBefore = new Map(uiObjects);
  const uiOperations = [];
  while (line && ['ui-op', 'set', 'condition', 'branch-jump', 'jump', 'stage-sync'].includes(line.mode)) {
    applyStageOps(line);
    applyEnvironmentOps(line);
    if (++uiSteps > 10000) {
      reportRuntimeError(line, new Error('连续控制语句过多，可能存在没有等待的循环。'));
      return;
    }
    state.variableHistory.set(i, { ...state.variables });
    try {
      if (!opts.suppressAudio && line.audio && line.audio.length) handleAudioCommands(line.audio);
      if (line.mode === 'ui-op') {
        applyUiOperation(line.operation, performance.now(), line.stage);
        uiOperations.push(line);
      } else if (line.mode === 'set') {
        const value = window.TrickcalExpressions.evaluate(line.expression, state.variables);
        const current = state.variables[line.variable];
        if (line.operator === '=') state.variables[line.variable] = value;
        else {
          if (typeof current !== 'number' || typeof value !== 'number') throw new Error(`变量 ${line.variable} 的复合赋值需要数值。`);
          const operators = { '+=': (a, b) => a + b, '-=': (a, b) => a - b, '*=': (a, b) => a * b, '/=': (a, b) => a / b, '%=': (a, b) => a % b };
          state.variables[line.variable] = operators[line.operator](current, value);
          if (!Number.isFinite(state.variables[line.variable])) throw new Error(`变量 ${line.variable} 的结果不是有限数值。`);
        }
      } else if (line.mode === 'condition') {
        const result = window.TrickcalExpressions.evaluate(line.expression, state.variables);
        if (typeof result !== 'boolean') throw new Error('if 表达式必须返回布尔值。');
        if (!result) { i = line.falseTarget; line = STORY[i]; continue; }
      } else if (line.mode === 'branch-jump') {
        i = line.target;
        line = STORY[i];
        continue;
      } else if (line.mode === 'jump') {
        const target = Number.isInteger(line.target) ? line.target : Number.isInteger(line.next) ? line.next : i + 1;
        if (target < 0 || target >= STORY.length) { showEnd(); return; }
        i = target;
        line = STORY[i];
        continue;
      }
    } catch (e) {
      reportRuntimeError(line, e);
      return;
    }
    line = STORY[++i];
  }
  if (!line && uiSteps) { showEnd(); return; }
  if (!line) return;
  applyStageOps(line);
  applyEnvironmentOps(line);
  state.stageBase = carriedStage ? [...carriedStage.values()] : (line.stage || []);
  state.variableHistory.set(i, { ...state.variables });
  const duplicateStageId = state.stageBase.find(conf => uiObjects.has(conf.id));
  if (duplicateStageId) {
    reportRuntimeError(line, new Error(`UI 名称与舞台对象重复：${duplicateStageId.id}`));
    return;
  }
  if (!opts.preserveUiCheckpoint) {
    uiCheckpoints.set(i, { before: uiBefore, after: new Map(uiObjects), operations: uiOperations });
  }
  if (line.mode === 'end') { showEnd(); return; }
  if (line.mode !== 'oneshot') state.oneShot = null;
  if (carriedEnvironment && line.mode !== 'title') {
    state.camera = { ...carriedEnvironment.camera };
    state.sceneFx = { ...carriedEnvironment.fx };
  } else {
    if (line.camera) state.camera = { ...state.camera, ...line.camera };
    state.sceneFx = line.fx ? { ...line.fx } : null;
  }
  if (!opts.suppressAudio && line.audio && line.audio.length) handleAudioCommands(line.audio);
  if (!carriedEnvironment || line.mode === 'title') applyLineShader(line);
  else if (carriedEnvironment.shaderChanged) applyLineShader({ ...line, shader: carriedEnvironment.shader });
  // Opening titles use the authored backdrop (if any); with no background
  // they fall back to a real black stage. Backgrounds start with the first
  // scene that is actually authored in the script.
  if (!carriedEnvironment || line.mode === 'title') applySceneBackground(line);
  else if (carriedEnvironment.scene) applySceneBackground(carriedEnvironment.scene);
  else {
    state.bgTransition = null;
    const layers = carriedEnvironment.background;
    if (layers.length === 1 && layers[0].alpha >= 0.999) {
      const surface = layers[0].surface;
      state.bgSolid = surface.solid;
      state.bgColor = surface.color;
      state.bgKey = surface.key;
      state.bgFrozenLayers = null;
      releaseBackgroundBuffers();
    } else state.bgFrozenLayers = layers;
  }
  state.line = i;
  state.lineStart = performance.now();
  state.uiActionsCommitted = false;
  state.lineUiActions = (line.actions || []).filter(action => action.targetKind === 'ui');
  state.uiActionIndex = 0;
  state.uiActionFences = new Map();
  state.uiSamplingBoundary = null;
  state.lineCameraTimeline = window.TrickcalCameraTimeline.create(state.camera, line.events, line.cameraTracks);
  state.lineEffectTimeline = line.fx || line.effectTracks?.length || line.events?.some(event => event.type === 'effect')
    ? window.TrickcalCameraTimeline.create(state.sceneFx || {}, line.events, line.effectTracks, 'effect') : null;
  state.dialogueStartAt = state.lineStart + Math.max(0, Number(line.dialogueDelay) || 0) * 1000;
  state.lineEvents = opts.suppressAudio ? (line.events || []).filter(event => event.type !== 'audio') : (line.events || []);
  state.typingPlan = lineTypingPlan(line);
  state.typingDone = false;
  state.doneAt = 0;
  state.readyAt = 0;
  state.titleSkipped = false;
  state.endShown = false;
  document.getElementById('endcard').classList.add('hidden');
  const reuseManga = !line.dialogueDelay && opts.reuseManga && modeRuntime.manga.visible && (line.mode === 'manga' || line.mode === 'mangaThink');
  const reuseClear = !line.dialogueDelay && opts.reuseClear && modeRuntime.clear.visible && line.mode === 'clearRe';
  let m;
  if (line.mode === 'title') {
    prepareTitle(line);
    m = modeRuntime.title;
    state.typingDone = false;
    state.typingStart = state.lineStart;
    const titleEntry = (ANIM['title.Start'] && ANIM['title.Start'].stop) || 2;
    state.readyAt = state.lineStart + (titleEntry + (Number(line.hold) || 0)) * 1000;
  } else if (line.mode === 'narration') {
    prepareNarration(line);
    m = modeRuntime.narration;
  } else if (line.mode === 'manga' || line.mode === 'mangaThink') {
    prepareManga(line, reuseManga);
    m = modeRuntime.manga;
  } else if (line.mode === 'normal' || line.mode === 'cloud' || line.mode === 'blast') {
    prepareNormal(line);
    m = modeRuntime.normal;
  } else if (line.mode === 'clear' || line.mode === 'clearRe') {
    prepareClear(line, reuseClear);
    m = modeRuntime.clear;
  } else if (line.mode === 'anime') {
    prepareAnime(line);
    m = modeRuntime.anime;
  } else if (line.mode === 'sfx') {
    prepareSfx(line);
    m = modeRuntime.sfx;
  } else if (line.mode === 'location') {
    prepareLocation(line);
    m = modeRuntime.location;
  } else if (line.mode === 'newsSummary' || line.mode === 'newsTalk') {
    prepareNews(line, line.mode === 'newsTalk');
    m = modeRuntime[line.mode];
  } else if (line.mode === 'fullscreen') {
    prepareFullscreen(line);
    m = modeRuntime.fullscreen;
  } else if (line.mode === 'transition') {
    prepareTransition(line);
    m = modeRuntime.transition;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = state.lineStart + (line.hold || 1.4) * 1000;
  } else if (line.mode === 'branch') {
    prepareBranch(line);
    m = modeRuntime.branch;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.typingEnd = state.lineStart + ((ANIM['branch.Entry'] && ANIM['branch.Entry'].stop) || 1.08333) * 1000;
    state.readyAt = state.typingEnd + 600;
  } else if (line.mode === 'standing') {
    hideAllModes('standing');
    m = null;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = Number.MAX_SAFE_INTEGER;
  } else if (line.mode === 'preview-move') {
    hideAllModes();
    m = null;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = Number.MAX_SAFE_INTEGER;
  } else if (line.mode === 'wait') {
    hideAllModes();
    m = null;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = state.lineStart + (line.timelineEnd || 0) * 1000;
  } else if (line.mode === 'scroll') {
    prepareScroll(line);
    m = modeRuntime.scroll;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = state.lineStart + (line.hold || 6) * 1000;
  } else if (line.mode === 'oneshot') {
    state.oneShot = null;
    prepareOneShot(line, i);
    m = null;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = Number.MAX_SAFE_INTEGER;
  } else if (line.mode === 'ui-present') {
    hideAllModes();
    m = null;
    state.typingStart = state.lineStart;
    state.typingDone = uiTypingComplete(state.lineStart);
    state.readyAt = state.lineStart + Math.max(line.hold ?? 1.8, line.timelineEnd || 0) * 1000;
  } else if (line.mode === 'cg') {
    prepareCg(line);
    m = modeRuntime.cg;
    state.typingDone = true;
    state.typingStart = state.lineStart;
    state.readyAt = state.lineStart + (line.hold || 5) * 1000;
  }
  if (line.mode === 'transition' || line.mode === 'scroll' || line.mode === 'cg' || line.mode === 'standing' || line.mode === 'branch' || line.mode === 'ui-present' || line.mode === 'wait' || line.mode === 'preview-move' || line.mode === 'oneshot') {
    // no typewriter; the transition / branch / standing rig owns the whole hold duration
  } else if (line.mode !== 'title') {
    state.typingStart = state.dialogueStartAt + typingDelayFor(line);
    const plan = state.typingPlan;
    state.typingEnd = state.typingStart + plan.total;
    state.readyAt = Math.max(state.typingEnd + (line.hold ?? 1.8) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
  } else {
    state.typingEnd = state.lineStart;
  }
  if (line.mode === 'location') {
    const entry = (ANIM['location.Start'] && ANIM['location.Start'].stop) || 1.66667;
    state.readyAt = Math.max(state.dialogueStartAt + Math.max(entry * 1000, state.typingEnd - state.dialogueStartAt) + (Number(line.hold) || 0) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
  }
  if (m) {
    m.reveal = 0;
    const delay = state.dialogueStartAt - state.lineStart;
    m.startedAt += delay;
    for (const clip of m.clips) clip.start += delay;
  }
  state.phase = 'playing';
  state.freeze = false;
  setStageForLine({ ...line, stage: state.stageBase });
  if (!dispatchLineEvents(state.lineStart)) return;
  if (line.mode === 'standing') resetStandingActors(line);
  updateHud();
  updateTech(true);
}

function reportRuntimeWarning(line, warning) {
  const message = String(warning && warning.message || warning);
  const sourceLine = Number(line && line.sourceLine) || 1;
  console.warn(`Runtime warning at line ${sourceLine}: ${message}`);
  const alert = document.getElementById('runtimeError');
  alert.textContent = `第 ${sourceLine} 行效果警告：${message}`;
  alert.classList.add('warning');
  alert.hidden = false;
  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'trickcal:warning', line: sourceLine, message }, location.origin); } catch (e) {}
  }
}

function reportRuntimeError(line, error) {
  const message = String(error && error.message || error);
  const sourceLine = Number(line && line.sourceLine) || 1;
  console.error(`Runtime error at line ${sourceLine}: ${message}`);
  state.freeze = true;
  const alert = document.getElementById('runtimeError');
  alert.textContent = `第 ${sourceLine} 行运行错误：${message}`;
  alert.classList.remove('warning');
  alert.hidden = false;
  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'trickcal:error', line: sourceLine, message }, location.origin); } catch (e) {}
  }
}

function completeTyping() {
  if (state.line < 0) return;
  const line = STORY[state.line];
  const plan = state.typingPlan || lineTypingPlan(line);
  state.typingStart = performance.now() - plan.total;
  state.typingDone = true;
  state.doneAt = performance.now();
  state.readyAt = Math.max(state.doneAt + (line.hold ?? 1.8) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
  updateHud();
}

function captureContinuity(now) {
  const line = STORY[state.line] || {};
  return {
    carryStage: window.TrickcalStageTimeline.sample(state.stageBase || line.stage || [], line.events, line.actions,
      (now - state.lineStart) / 1000),
    carryEnvironment: { camera: { ...state.camera }, fx: { ...(state.sceneFx || {}) },
      shader: state.shader ? { ...state.shader } : null, background: sampleBackgroundLayers(now) },
  };
}

function advance() {
  if (!state.started) return;
  if (state.freeze) return;
  if (state.endShown) return;
  if (state.transition) return;
  const advanceAt = performance.now();
  if (!dispatchLineEvents(advanceAt)) return;
  const line = STORY[state.line];
  if (performance.now() < state.dialogueStartAt) return;
  if (line.mode === 'wait' || line.mode === 'preview-move') return;
  if (line.mode === 'standing') return;
  if (line.mode === 'ui-present') {
    if (!state.typingDone) {
      for (const typing of uiTyping.values()) typing.complete = true;
      state.typingDone = true;
      state.readyAt = Math.max(performance.now() + (line.hold ?? 1.8) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
      updateHud();
      return;
    }
    state.lineEvents = [];
    uiObjects = animatedUiObjects(performance.now());
    state.uiActionsCommitted = true;
    if (state.line + 1 < STORY.length) startLine(state.line + 1);
    else showEnd();
    return;
  }
  if (line.mode === 'transition') {
    const next = state.line + 1;
    if (next >= STORY.length) { showEnd(); return; }
    startLine(next, captureContinuity(advanceAt));
    return;
  }
  if (line.mode === 'branch') {
    if (!state.typingDone) completeTyping();
    else if (state.auto) chooseBranch(0);
    return;
  }
  if (line.mode === 'title') {
    const titleEntry = (ANIM['title.Start'] && ANIM['title.Start'].stop) || 2;
    if (!state.titleSkipped && performance.now() - state.lineStart < Math.max(0, titleEntry * 1000 - 50)) {
      // finish the title-in animation
      const m = modeRuntime.title;
      const start = m.clips.find(c => c.key === 'title.Start');
      if (start) start.start = performance.now() - 2000 * 1000;
      state.readyAt = performance.now() + 400;
      state.titleSkipped = true;
      state.typingDone = true;
      updateHud();
      return;
    }
    // play End then advance
    const m = modeRuntime.title;
    m.clips = m.clips.filter(c => c.key !== 'title.Start');
    addClip(m, 'title.End', false);
    const next = state.line + 1;
    scheduleTransition('titleEnd', 470, () => startLine(next));
    return;
  }
  if (!state.typingDone) { completeTyping(); return; }
  const now = advanceAt;
  updateStageObjects(now);
  const { carryStage, carryEnvironment } = captureContinuity(now);
  state.stopStageAt = now;
  state.stoppedStageEvents = state.lineEvents.slice(0, state.lineEventIndex);
  state.lineEvents = [];
  uiObjects = animatedUiObjects(now);
  state.uiActionsCommitted = true;
  const next = state.line + 1;
  if (next >= STORY.length) {
    if (line.mode === 'location') exitLocationThen(showEnd);
    else beginModeExit(showEnd);
    return;
  }
  const nextLine = STORY[next];
  const reuseClear = (line.mode === 'clear' || line.mode === 'clearRe') &&
    nextLine.mode === 'clearRe' && !nextLine.dialogueDelay;
  const reuseManga = false;
  if (line.mode === 'location') {
    exitLocationThen(() => startLine(next, { reuseClear, reuseManga, carryStage, carryEnvironment }));
    return;
  }
  if (!reuseClear && (isMangaLine(line) || line.mode !== nextLine.mode || nextLine.mode === 'clearRe')) {
    beginModeExit(() => startLine(next, { reuseClear: false, reuseManga: false, carryStage, carryEnvironment }));
    return;
  }
  startLine(next, { reuseClear, reuseManga, carryStage, carryEnvironment });
}

function showEnd() {
  state.transitionGeneration++;
  state.transition = null;
  state.oneShotGeneration++;
  state.lineEvents = [];
  state.endShown = true;
  state.oneShot = null;
  state.parallelOneShots.clear();
  state.pendingParallelOneShots = 0;
  state.phase = 'end';
  if (EMBED) {
    try { parent.postMessage({ type: 'trickcal:end' }, '*'); } catch (e) {}
  }
  for (const k of Object.keys(modeRuntime)) {
    modeRuntime[k].clips.length = 0;
    modeRuntime[k].visible = false;
    modeRuntime[k].root.hidden = true;
  }
  dockEl.classList.add('hidden');
  dockOpenBtn.classList.add('hidden');
  document.getElementById('endcard').classList.remove('hidden');
  document.getElementById('hintText').textContent = '演示结束';
  document.getElementById('lineNo').textContent = 'FIN';
  document.getElementById('modeName').textContent = '片尾';
  document.getElementById('speakerName').textContent = '—';
  for (const b of chipsEl.querySelectorAll('.chip')) b.classList.remove('active');
}

/* ---------------------------------------------------------------- drawing overlays */
function dialoguePresetTransform(line) {
  const x = Number(line.uiX) || 0;
  const y = Number(line.uiY) || 0;
  const scale = Number(line.uiScale) || 1;
  const rotation = Number(line.uiRot) || 0;
  const offset = M.t(x, -y);
  if (scale === 1 && !rotation) return offset;
  const around = M.mul(
    M.mul(M.t(W / 2, H / 2), M.r(rotation)),
    M.mul(M.s(scale, scale), M.t(-W / 2, -H / 2))
  );
  return M.mul(around, offset);
}

function drawNextIcon(now) {
  if (!state.started || state.endShown || state.transition) return;
  const line = STORY[state.line];
  if (!line || line.mode === 'title') return;
  if (!state.typingDone) return;
  const m = modeRuntime[modeRuntimeKey(line)];
  if (!m || !m.visible) return;
  let x = 1717, y = 984, key = 'next1', tint = [0.36, 0.34, 0.31, 0.82];
  if (line.mode === 'manga' || line.mode === 'mangaThink') {
    const cx = line.bubble.x, cy = line.bubble.y;
    const bs = modeRuntime.manga.bubbleSize || { h: 320 };
    const brTail = line.mode === 'manga' && mangaTailDir(line) === 'br';
    x = brTail ? cx - 230 : cx + 330 + (((m.bubbleSize && m.bubbleSize.w) || MANGA_GEOM.width) - MANGA_GEOM.baseWidth) / 2;
    y = cy + Math.round(bs.h / 2) - 71;
    key = 'next1'; tint = [0.34, 0.32, 0.30, 0.92];
  } else if (line.mode === 'normal' || line.mode === 'cloud') {
    x = 1717; y = 984; key = 'next1'; tint = line.mode === 'cloud' ? [0.4, 0.3, 0.55, 0.85] : [0.36, 0.34, 0.31, 0.82];
  } else if (line.mode === 'clear' || line.mode === 'clearRe') {
    x = 1492; y = 1000; key = 'next3'; tint = [0.34, 0.32, 0.30, 0.9];
  } else if (line.mode === 'anime') {
    x = 1730; y = 982; key = 'next1'; tint = [0.92, 0.9, 0.82, 0.9];
  } else if (line.mode === 'narration') {
    x = 1730; y = 982; key = 'next1'; tint = [0.9, 0.86, 0.74, 0.85];
  }
  // The prefab icon is a white heart; the monologue plate uses the game's
  // green theme for its next marker.
  const greenNext = line.mode === 'clear' || line.mode === 'clearRe';
  tint = greenNext ? [0.36, 0.62, 0.18, 1] : [1, 1, 1, 0.95];
  const t = ((now - state.doneAt) / 1000) % 1;
  const def = ANIM['next.DialogueNextButton'];
  let sx = 1, sy = 1;
  if (def) {
    for (const ch of def.channels) {
      const v = evalChannel(ch, t, true, def.stop);
      if (ch.p === 'sx') sx = v;
      if (ch.p === 'sy') sy = v;
    }
  }
  const im = tinted(key, tint);
  if (!im) return;
  const a = Math.min(1, (now - state.doneAt) / 180);
  const opacity = line.uiOpacity == null ? 1 : Math.max(0, Math.min(1, Number(line.uiOpacity)));
  const size = (line.mode === 'narration' || line.mode === 'anime') ? 92 : 124;
  ctx.save();
  M.apply(dialoguePresetTransform(line));
  if (line.mode === 'anime') {
    ctx.save();
    ctx.globalAlpha = a * opacity * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,9,12,.8)';
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.globalAlpha = a * opacity;
  if (!greenNext) {
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.drawImage(im, -size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.restore();
}

function drawMindOverlay(now) {
  const line = STORY[state.line];
  if (!line || !line.mind) return;
  ctx.save();
  ctx.fillStyle = 'rgba(12,7,20,.46)';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(960, 640, 260, 960, 640, 1120);
  g.addColorStop(0, 'rgba(80,55,120,.08)');
  g.addColorStop(1, 'rgba(18,8,30,.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) {
    const t = now / 1000;
    const x = (i * 149 + Math.sin(t * 0.4 + i) * 60) % W;
    const y = (i * 83 - t * 18 + 1080) % H;
    const r = 1 + (i % 3) * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,150,255,${0.10 + 0.12 * Math.sin(t + i)})`;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawBackgroundLayer(target, surface, now) {
  target.save();
  if (surface.solid) {
    target.fillStyle = surface.color || '#000000';
    target.fillRect(0, 0, W, H);
    target.restore();
    return;
  }
  const im = IMG[surface.key] || IMG.bg;
  if (!im) { target.fillStyle = '#101014'; target.fillRect(0, 0, W, H); target.restore(); return; }
  const zoom = 1.035 + Math.sin(now / 22000) * 0.012;
  const iw = im.width * zoom, ih = im.height * zoom;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = (W - dw) / 2 + Math.sin(now / 26000) * 8;
  const dy = (H - dh) / 2 - 18 + Math.cos(now / 31000) * 6;
  target.drawImage(im, dx, dy, dw, dh);
  target.restore();
}

function drawBackground(now) {
  const transitioning = Boolean(state.bgTransition || (state.bgFrozenLayers && state.bgFrozenLayers.length > 1));
  const layers = sampleBackgroundLayers(now);
  if (!transitioning || layers.length < 2) {
    for (const layer of layers) drawBackgroundLayer(ctx, layer.surface, now);
    if (transitioning && !state.bgTransition) releaseBackgroundBuffers();
    return;
  }
  const width = canvas.width, height = canvas.height;
  if (!bgMixCanvas) bgMixCanvas = document.createElement('canvas');
  if (!bgLayerCanvas) bgLayerCanvas = document.createElement('canvas');
  if (bgMixCanvas.width !== width || bgMixCanvas.height !== height) {
    bgMixCanvas.width = width;
    bgMixCanvas.height = height;
  }
  if (bgLayerCanvas.width !== width || bgLayerCanvas.height !== height) {
    bgLayerCanvas.width = width;
    bgLayerCanvas.height = height;
  }
  const mixCtx = bgMixCanvas.getContext('2d');
  const layerCtx = bgLayerCanvas.getContext('2d');
  mixCtx.setTransform(1, 0, 0, 1, 0, 0);
  mixCtx.globalAlpha = 1;
  mixCtx.globalCompositeOperation = 'source-over';
  mixCtx.clearRect(0, 0, width, height);
  layerCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const layer of layers) {
    layerCtx.globalAlpha = 1;
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.clearRect(0, 0, width / DPR, height / DPR);
    drawBackgroundLayer(layerCtx, layer.surface, now);
    mixCtx.globalCompositeOperation = 'lighter';
    mixCtx.globalAlpha = Math.max(0, Math.min(1, layer.alpha));
    mixCtx.drawImage(bgLayerCanvas, 0, 0);
  }
  mixCtx.globalAlpha = 1;
  mixCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bgMixCanvas, 0, 0, W, H);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------------------------------------------------------- main loop */
let lastTech = 0;
function tick(now) {
  if (state.freeze && state.freezeTime) now = state.freezeTime;
  if (state.started) {
    state.updateCount++;
    updateState(now);
    if (state.renderingEnabled) {
      state.renderCount++;
      drawScene(now);
      drawFX(now);
    } else if (!state.endShown && STORY[state.line]) {
      // Stage sampling and Spine playback also advance state, even without paint.
      const dt = updateStageObjects(now);
      drawSpineStage(now, dt, false);
    }
  } else if (state.renderingEnabled) {
    drawAttract(now);
  }
  if (!EMBED && state.renderingEnabled && state.started && (state.freeze || now - lastTech > 90)) {
    lastTech = now;
    updateTech(false);
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  tick(now);
}

function updateState(now) {
  if (state.line < 0 || state.endShown) return;
  if (!state.freeze && !dispatchLineEvents(now)) return;
  const line = STORY[state.line];
  if (line.mode === 'wait') {
    if (!state.freeze && !state.pendingParallelOneShots && now >= state.readyAt) {
      for (const [id, actor] of stageActors) applyActorActions(line, id, actor, now, 0);
      for (const [id, image] of stageImages) applyActorActions(line, id, image, now, 0);
      const continuity = captureContinuity(now);
      uiObjects = animatedUiObjects(now);
      state.uiActionsCommitted = true;
      if (state.line + 1 < STORY.length) startLine(state.line + 1, continuity);
      else showEnd();
    }
    return;
  }
  if (line.mode === 'standing' || line.mode === 'preview-move') return;
  if (line.mode === 'ui-present') {
    if (!state.typingDone && uiTypingComplete(now)) {
      state.typingDone = true;
      state.readyAt = Math.max(now + (line.hold ?? 1.8) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
      updateHud();
    }
    if (state.auto && state.typingDone && !state.pendingParallelOneShots && now >= state.readyAt && !state.transition) advance();
    return;
  }
  if (line.mode === 'transition') {
    if (now >= state.readyAt && !state.transition && !line.previewOnly) advance();
    return;
  }
  if (line.mode === 'title') {
    // Opening titles are a timed presentation: play in, hold, then exit.
    if (now >= state.readyAt && !state.transition) advance();
    return;
  }
  if (line.mode === 'location') {
    // Location cards play their entrance, hold, and exit without a click.
    if (now >= state.readyAt && !state.transition) advance();
    return;
  }
  if (line.mode === 'oneshot') {
    if (now >= state.readyAt && !state.transition) advance();
    return;
  }
  const m = modeRuntime[modeRuntimeKey(line)];
  if (!m) return;
  const plan = state.typingPlan || lineTypingPlan(line);
  if (!state.typingDone) {
    if (now >= state.typingStart) {
      const elapsed = now - state.typingStart;
      if (elapsed >= plan.total) {
        state.typingDone = true;
        state.doneAt = now;
        state.readyAt = Math.max(now + (line.hold ?? 1.8) * 1000, state.lineStart + (line.timelineEnd || 0) * 1000);
        m.reveal = plan.charCount;
        updateHud();
      } else {
        m.reveal = richVisibleCount(plan, elapsed);
      }
    } else {
      m.reveal = 0;
    }
  } else {
    m.reveal = plan.charCount;
  }
  if (state.auto && state.typingDone && timedUiTypingComplete(line, now) && !state.pendingParallelOneShots && now >= state.readyAt && !state.transition) advance();
}

function lineFx() {
  const fx = state.sceneFx;
  if (!fx) return null;
  return {
    brightness: Number(fx.brightness ?? 1),
    contrast: Number(fx.contrast ?? 1),
    saturation: Number(fx.saturation ?? 1),
    blur: Math.max(0, Number(fx.blur) || 0),
    tint: fx.tint || null,
    tintAlpha: Math.max(0, Math.min(1, Number(fx.tintAlpha) || 0)),
  };
}

function applyCameraTransform() {
  const cam = state.camera || { zoom: 1, x: 0, y: 0, targetX: W / 2, targetY: H / 2, rot: 0, follow: null };
  let camX = Number(cam.x) || 0;
  let camY = Number(cam.y) || 0;
  const zoom = Math.max(0.001, Number(cam.zoom) || 1);
  let targetX = Number(cam.targetX ?? W / 2);
  let targetY = Number(cam.targetY ?? H / 2);
  if (cam.follow) {
    const s = stageActors.get(cam.follow);
    if (s) {
      camX = 0; camY = 0;
      targetX = s.x - (Number(cam.offsetX) || 0) / zoom;
      targetY = s.y - (Number(cam.offsetY) || 0) / zoom;
    }
  }
  ctx.translate(W / 2 + camX, H / 2 + camY);
  if (cam.rot) ctx.rotate((Number(cam.rot) || 0) * Math.PI / 180);
  ctx.scale(zoom, zoom);
  ctx.translate(-targetX, -targetY);
}

function drawScene(now) {
  updateCameraAt(now);
  updateEffectAt(now);
  const actorDt = !state.endShown && STORY[state.line] ? updateStageObjects(now) : 0;
  if (ctx.reset) ctx.reset();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, W, H);
  // Always paint an opaque base so camera pans/zooms never expose the
  // transparent canvas (which browsers composite as white edges).
  ctx.fillStyle = state.bgSolid ? (state.bgColor || '#000000') : '#05070b';
  ctx.fillRect(0, 0, W, H);
  const fx = lineFx();
  ctx.save();
  if (fx) ctx.filter = `brightness(${fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation}) blur(${fx.blur}px)`;
  applyCameraTransform();
  drawBackground(now);
  ctx.restore();
  if (state.endShown) return;
  const line = STORY[state.line];
  if (!line) return;
  const dialogueVisible = state.freeze || now >= state.dialogueStartAt;
  if (!state.bgSolid && dialogueVisible) drawMindOverlay(now);
  ctx.save();
  if (fx) ctx.filter = `brightness(${fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation}) blur(${fx.blur}px)`;
  applyCameraTransform();
  drawImageStage();
  drawSpineStage(now, actorDt);
  ctx.restore();
  if (fx && fx.tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = fx.tintAlpha;
    ctx.fillStyle = fx.tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // draw only the active mode
  const key = modeRuntimeKey(line);
  const m = modeRuntime[key];
  if (key === 'transition') {
    drawTransition(now, line);
  } else if (key === 'branch') {
    drawBranch(now, line);
  } else if (key === 'scroll') {
    drawScroll(now, line);
  } else if (key === 'cg') {
    drawCg(now, line);
  } else if (m && m.visible && dialogueVisible) {
    const { ov } = collectOverrides(m, now);
    let modeAlpha = 1;
    let modeWorld = SCREEN;
    const pivot = key === 'manga' ? mangaScalePivot(m, line) : modeRootOrigin(m);
    if (key === 'manga') {
      // Counter-shift the root's Start scale so the bubble grows out of the
      // tail tip instead of the prefab root pivot.
      const q = modeRootOrigin(m);
      const ro = ov.get('') || {};
      const sx = ro.sx !== undefined ? ro.sx : 1;
      const sy = ro.sy !== undefined ? ro.sy : 1;
      modeWorld = M.mul(modeWorld, M.t(
        (1 - sx) * (pivot.x - q.x),
        -(1 - sy) * (pivot.y - q.y)
      ));
    }
    if (key === 'anime') {
      const gra = findNode(m.root, 'Gra');
      if (gra) {
        if (m.extra.exitStart) {
          gra.sh = 400;
          gra.py = 0;
        } else {
          // Entrance: the gradient backing stretches up from the bottom
          // while the caption and name plate play their own entry animations.
          const t = Math.max(0, Math.min(1, (now - m.startedAt) / 333));
          const e = 1 - Math.pow(1 - t, 3);
          gra.sh = Math.max(0.5, 400 * e);
          gra.py = 0;
        }
      }
    }
    if (m.extra.exitStart) {
      const dur = m.extra.exitDuration || 300;
      const et = Math.max(0, Math.min(1, (now - m.extra.exitStart) / dur));
      if (key === 'anime' || key === 'fullscreen') {
        // The whole subtitle (backing, caption, name plate) fades together.
        modeAlpha = 1 - et;
      } else {
        const shrink = 1 - et * et;
        modeAlpha = 1 - Math.pow(et, 1.5);
        const around = M.mul(
          M.mul(M.t(pivot.x, pivot.y), M.s(shrink, shrink)),
          M.t(-pivot.x, -pivot.y)
        );
        modeWorld = M.mul(around, modeWorld);
      }
    } else if (key === 'fullscreen') {
      const t = Math.max(0, Math.min(1, (now - m.startedAt) / 300));
      modeAlpha *= t;
    }
    modeWorld = M.mul(dialoguePresetTransform(line), modeWorld);
    if (line.uiOpacity != null) modeAlpha *= Math.max(0, Math.min(1, Number(line.uiOpacity)));
    m.reveal = m.reveal || 0;
    drawNode(m.root, W, H, 0.5, 0.5, modeWorld, modeAlpha, ov, m, now);
  }
  if (dialogueVisible && (line.mode === 'normal' || line.mode === 'cloud') && line.emoticon) drawEmoticonOverlay(line, now);
  drawUiObjects(now);
  if (key !== 'transition' && key !== 'branch' && key !== 'scroll' && key !== 'cg') drawNextIcon(now);
}

function drawEmoticonLayers(g, mood, x, y, scale, alpha, ox, oy, layerPoses) {
  if (!mood || !IMG.emoticonAtlas) return;
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.translate(x + (ox || 0), y + (oy || 0));
  g.scale(scale, scale);
  for (let i = 0; i < mood.layers.length; i++) {
    const layer = mood.layers[i];
    const sp = EMOTICON_DATA.sprites[layer.sprite];
    if (!sp) continue;
    const pose = (layerPoses && layerPoses[i]) || { sx: 1, sy: 1, rot: 0 };
    g.save();
    g.translate(layer.x, -layer.y);
    g.rotate(-(pose.rot || 0) * Math.PI / 180);
    g.scale(pose.sx == null ? 1 : pose.sx, pose.sy == null ? 1 : pose.sy);
    g.drawImage(
      IMG.emoticonAtlas,
      sp.x, sp.y, sp.w, sp.h,
      -layer.w / 2, -layer.h / 2, layer.w, layer.h
    );
    g.restore();
  }
  g.restore();
}

function sampleEmoticonKeys(keys, t, fallback) {
  if (!keys || !keys.length) return fallback;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const e = u * u * (3 - 2 * u);
      return a.v + (b.v - a.v) * e;
    }
  }
  return keys[keys.length - 1].v;
}

function emoticonDuration(mood) {
  const anim = EMOTICON_DATA && EMOTICON_DATA.animations ? EMOTICON_DATA.animations[mood.anim] : null;
  return Number(anim && anim.duration) || Number(mood.duration) || 1;
}

function emoticonLayerPosesAt(mood, t) {
  const anim = EMOTICON_DATA && EMOTICON_DATA.animations ? EMOTICON_DATA.animations[mood.anim] : null;
  if (!anim || !Array.isArray(anim.channels)) return mood.layers.map(() => ({ sx: 1, sy: 1, rot: 0 }));
  return mood.layers.map(layer => {
    let sx = 1, sy = 1, rot = 0;
    for (const channel of anim.channels) {
      if (channel.path !== 0 && channel.path !== layer.animPath) continue;
      if (channel.type === 'scale') {
        sx *= sampleEmoticonKeys(channel.x, t, 1);
        sy *= sampleEmoticonKeys(channel.y, t, 1);
      } else if (channel.type === 'rot') {
        rot += sampleEmoticonKeys(channel.z, t, 0);
      }
    }
    return { sx, sy, rot };
  });
}

function emoticonStaticPoses(mood) {
  return mood.layers.map(() => ({ sx: 1, sy: 1, rot: 0 }));
}

function drawEmoticonOverlay(line, now) {
  if (!line || !line.emoticon || !EMOTICON_DATA || !IMG.emoticonAtlas) return;
  if (!state.typingDone || state.endShown) return;
  const mood = EMOTICON_DATA.moods[line.emoticon];
  if (!mood) return;
  const m = modeRuntime.normal;
  let fade = 1;
  if (m.extra.exitStart) {
    fade = 1 - Math.max(0, Math.min(1, (now - m.extra.exitStart) / (m.extra.exitDuration || 300)));
    if (fade <= 0) return;
  }
  const pos = line.emoticonPos || { x: 960, y: 560 };
  const scale = line.emoticonScale == null ? 1 : Number(line.emoticonScale);
  const start = (state.doneAt || state.typingStart || now) + Math.max(0, Number(line.emoticonDelay) || 0) * 1000;
  const t = (now - start) / 1000;
  if (t < 0 || t > emoticonDuration(mood) + 0.02) return;
  drawEmoticonLayers(ctx, mood, pos.x, pos.y, scale, fade, 0, 0, emoticonLayerPosesAt(mood, t));
}

function buildEmoteLabCards() {
  const grid = document.getElementById('emoteLabGrid');
  if (!grid || !EMOTICON_DATA) return;
  const moods = Object.entries(EMOTICON_DATA.moods);
  grid.innerHTML = moods.map(([id, mood]) => `<button type="button" class="emote-card" data-emote="${id}" title="prefab/prefabdialogueresources/emoticon_${id} · ${standingWorkshopEscape(mood.clip || '')} · ${Number(mood.duration || 0).toFixed(2)}s">
    <canvas width="340" height="220"></canvas>
    <span class="emote-card-name">${standingWorkshopEscape(mood.label)}</span>
    <span class="emote-card-meta">${standingWorkshopEscape(mood.clip || '')} · ${Number(mood.duration || 0).toFixed(2)}s</span>
  </button>`).join('');
  emoteLabCards = Array.from(grid.querySelectorAll('.emote-card')).map((card, index) => ({
    id: card.dataset.emote,
    index,
    mood: EMOTICON_DATA.moods[card.dataset.emote],
    canvas: card.querySelector('canvas'),
    ctx: card.querySelector('canvas').getContext('2d'),
  }));
  grid.onclick = e => {
    const card = e.target.closest('.emote-card');
    if (!card) return;
    const item = emoteLabCards.find(c => c.canvas === card.querySelector('canvas'));
    if (!item) return;
    item.start = performance.now();
  };
}

function drawEmoteLabCard(item, now) {
  const canvas = item.canvas, g = item.ctx, mood = item.mood;
  if (!g || !mood) return;
  const cw = canvas.width, ch = canvas.height;
  g.clearRect(0, 0, cw, ch);
  const duration = emoticonDuration(mood);
  let poses = emoticonStaticPoses(mood);
  if (item.start && now >= item.start) {
    const local = (now - item.start) / 1000;
    if (local <= duration + 0.02) poses = emoticonLayerPosesAt(mood, Math.min(local, duration));
    else item.start = 0;
  }
  const fit = Math.min((cw * 0.68) / mood.w, (ch * 0.68) / mood.h, 1.6);
  drawEmoticonLayers(g, mood, cw / 2, ch / 2, fit, 1, 0, 0, poses);
}

function emoteLabFrame(now) {
  const panel = document.getElementById('emoteLab');
  if (!panel || panel.classList.contains('hidden')) { emoteLabRaf = 0; return; }
  for (const item of emoteLabCards) drawEmoteLabCard(item, now);
  emoteLabRaf = requestAnimationFrame(emoteLabFrame);
}

async function openEmoteLab() {
  if (!EMOTICON_DATA) await loadEmoticonData();
  if (!EMOTICON_DATA) return;
  const panel = document.getElementById('emoteLab');
  if (!panel) return;
  closeBoxLab();
  state.auto = false;
  panel.classList.remove('hidden');
  buildEmoteLabCards();
  emoteLabStart = performance.now();
  for (const item of emoteLabCards) item.start = 0;
  if (!emoteLabRaf) emoteLabRaf = requestAnimationFrame(emoteLabFrame);
}

function closeEmoteLab() {
  const panel = document.getElementById('emoteLab');
  if (panel) panel.classList.add('hidden');
  if (emoteLabRaf) cancelAnimationFrame(emoteLabRaf);
  emoteLabRaf = 0;
}

// Static inventory of every dialogue box / bubble / plate sprite extracted from
// the Dialogue SpriteAtlas, with the prefab that consumes each sprite and the
// authored m_Border used for 9-slicing. No procedurally drawn substitutes.
const BOX_LAB_ITEMS = [
  { key: 'box', name: 'Dialogue_TextBox_Default', use: 'NormalText · 普通对话框主板', size: '834×426', border: '9-slice 147' },
  { key: 'boxBehind', name: 'Dialogue_TextBox_Behind', use: 'NormalText · 紫色衬底', size: '512×262', border: '9-slice 90.24 / 90.41' },
  { key: 'cloud', name: 'Dialogue_TextBox_Cloud', use: 'NormalText · Cloud 状态', size: '1024×246', border: '9-slice 8.66' },
  { key: 'cloudBehind', name: 'Dialogue_TextBox_CloudBehind', use: 'NormalText · Cloud 衬底', size: '1024×246', border: '无九宫格' },
  { key: 'blast', name: 'Dialogue_TextBox_Blast', use: 'NormalText · Blast 爆炸状态', size: '1024×246', border: '无九宫格（PPU 57.722656 = 1774×426）' },
  { key: 'cloudBlast', name: 'Dialogue_TextBox_CloudBlast', use: '爆炸系紫色独立底板（NormalText 控制器未启用）', size: '1024×246', border: '无九宫格' },
  { key: 'narration', name: 'Dialogue_TextBox_Narration', use: 'NarrationText · 旁白框', size: '602×434', border: '9-slice 288 / 294 / 280' },
  { key: 'clear', name: 'Dialogue_TextBox_ClearText', use: 'ClearText · 独白框', size: '358×352', border: '9-slice 170' },
  { key: 'clearBehind', name: 'Dialogue_TextBox_ClearTextBehind', use: 'ClearText · 紫色内心板', size: '358×352', border: '无九宫格' },
  { key: 'newsBox', name: 'Dialogue_TextBox_News', use: 'NormalTextNews / NarrationTextNews', size: '100×100', border: '9-slice 48 / 53 / 46 / 46' },
  { key: 'bubble', name: 'Dialogue_TextBubble_Default', use: 'MangaNormalText · 对话气泡', size: '728×320', border: '9-slice 94' },
  { key: 'bubbleBehind', name: 'Dialogue_TextBubble_Behind', use: 'MangaNormalText · 紫色气泡衬底', size: '728×320', border: '9-slice 94' },
  { key: 'eventBubble25', name: 'Dialoge_EventSpeechBubble_2.5th Anni_BubbleBase', use: '2.5 周年活动对话气泡底板', size: '1610×320', border: '活动专用 sprite' },
  { key: 'eventBubble25b', name: 'Dialoge_EventSpeechBubble_2.5th Anni_BubbleBase_2', use: '2.5 周年活动对话气泡底板 · 变体 2', size: '1610×320', border: '活动专用 sprite' },
  { key: 'eventBubble3', name: 'Dialoge_EventSpeechBubble_3rd Anni_BubbleBase', use: '3 周年活动对话气泡底板', size: '1618×369', border: '活动专用 sprite' },
  { key: 'nameBase', name: 'Dialogue_NameTitle_Base', use: 'AnimeText / ClearText · 名牌', size: '214×84', border: '9-slice 24 / 12' },
  { key: 'sender', name: 'Dialogue_NameTitle_Sender', use: 'NormalText · 说话人条', size: '116×60', border: '9-slice 54 / 52' },
  { key: 'newsName', name: 'Dialogue_NameTitle_News', use: 'NormalTextNews · 主播条 / 简报图标', size: '100×100', border: '9-slice 51 / 27 / 52 / 54' },
  { key: 'nameTail', name: 'Dialogue_NameTitle_Tail', use: '名牌小尾', size: '46×40', border: '无九宫格' },
  { key: 'infoBase', name: 'Dialogue_Info_Base', use: 'InfoText · 地点名牌', size: '238×202（prefab 440×202）', border: '9-slice 1 / 125' },
  { key: 'branchBase', name: 'Dialogue_Base_Branch', use: 'Branch · 选项条', size: '548×104', border: '两端固定 52px' },
  { key: 'branchBubble', name: 'Dialogue_Base_Branch_Deco', use: 'Branch · 三点气泡', size: '104×104', border: '无' },
  { key: 'branchDeco1', name: 'Dialogue_Branch_Deco1', use: 'Branch · 左叶片', size: '32×42', border: '无' },
  { key: 'branchDeco2', name: 'Dialogue_Branch_Deco2', use: 'Branch · 右叶片', size: '34×36', border: '无' },
  { key: 'tail', name: 'Dialogue_TextBox_Tail', use: 'Manga · 气泡尾巴', size: '144×100', border: '无' },
  { key: 'tailShadow', name: 'Dialogue_TextBox_Shadow', use: 'Manga · 尾巴阴影', size: '140×100', border: '无' },
  { key: 'tailShadow2', name: 'Dialogue_TextBox_Shadow2', use: 'Manga · 尾巴高光阴影', size: '160×100', border: '无' },
  { key: 'bgPattern1', name: 'WindowDialogue_UI_PatternBg_1', use: 'WindowDialogue · 背景图案 1', size: '260×261', border: '平铺图案' },
  { key: 'bgPattern2', name: 'WindowDialogue_UI_PatternBg_2', use: 'WindowDialogue · 背景图案 2', size: '80×1084', border: '平铺图案' },
  { key: 'bgPattern3', name: 'WindowDialogue_UI_PatternBg_3', use: 'WindowDialogue · 背景图案 3', size: '157×1154', border: '平铺图案' },
  { key: 'bgPattern4', name: 'WindowDialogue_UI_PatternBg_4', use: 'WindowDialogue · 背景图案 4', size: '192×192', border: '平铺图案' },
  { key: 'bgPattern5', name: 'WindowDialogue_UI_PatternBg_5', use: 'WindowDialogue · 背景图案 5', size: '1024×971', border: '平铺图案' },
];

function buildBoxLab() {
  const grid = document.getElementById('boxLabGrid');
  if (!grid) return;
  grid.innerHTML = BOX_LAB_ITEMS.map(item => `<figure class="box-card">
    <div class="box-card-img"><img src="${ASSET_PATHS[item.key]}" alt="${standingWorkshopEscape(item.name)}" loading="lazy"></div>
    <figcaption class="box-card-name">${standingWorkshopEscape(item.name)}</figcaption>
    <div class="box-card-use">${standingWorkshopEscape(item.use)}</div>
    <div class="box-card-meta">${standingWorkshopEscape(item.size)} · ${standingWorkshopEscape(item.border)}</div>
  </figure>`).join('');
}

function openBoxLab() {
  buildBoxLab();
  const panel = document.getElementById('boxLab');
  if (!panel) return;
  closeEmoteLab();
  state.auto = false;
  panel.classList.remove('hidden');
}

function closeBoxLab() {
  const panel = document.getElementById('boxLab');
  if (panel) panel.classList.add('hidden');
}

function drawAttract(now) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(now);
}

/* ---------------------------------------------------------------- HUD */
const chipsEl = document.getElementById('chips');
const CHIP_TARGETS = [
  { mode: 'title', label: '章节开场', line: 0 },
  { mode: 'narration', label: '旁白框', line: 1 },
  { mode: 'manga', label: '对话气泡', line: 2 },
  { mode: 'mangaThink', label: '思考气泡', line: 3 },
  { mode: 'normal', label: '对话框', line: 4 },
  { mode: 'normal', label: '对话框·心情', line: 10 },
  { mode: 'cloud', label: '内心想法', line: 5 },
  { mode: 'clear', label: '独白框', line: 6 },
  { mode: 'clearRe', label: '独白框·ReEntry', line: 7 },
  { mode: 'anime', label: '动画字幕', line: 8 },
  { mode: 'sfx', label: '拟声框', line: 11 },
  { mode: 'location', label: '地点', line: 12 },
  { mode: 'manga', label: '内心气泡·紫', line: 13 },
  { mode: 'clear', label: '内心独白·紫', line: 14 },
  { mode: 'transition', label: '转场·黑场', line: 15 },
  { mode: 'transition', label: '转场·圆形', line: 16 },
  { mode: 'transition', label: '转场·推镜', line: 17 },
  { mode: 'transition', label: '转场·色条', line: 18 },
  { mode: 'fullscreen', label: '全屏文字', line: 19 },
  { mode: 'branch', label: '分支选项', line: 20 },
  { mode: 'standing', label: '角色站姿 / 移动测试', line: 21 },
  { mode: 'normal', label: '爆炸框 · 惊呼', line: 22 },
  { mode: 'newsTalk', label: '新闻框 · 主播', line: 23 },
  { mode: 'newsSummary', label: '新闻框 · 简报', line: 24 },
];
for (const c of CHIP_TARGETS) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = c.label;
  b.dataset.line = c.line;
  b.addEventListener('click', () => {
    if (!state.started) return;
    if (state.transition) return;
    const cur = STORY[state.line];
    if (cur && c.line !== state.line && cur.mode === 'location') {
      exitLocationThen(() => startLine(c.line));
      return;
    }
    if (cur && c.line !== state.line && cur.mode !== 'title' && cur.mode !== 'end') {
      beginModeExit(() => startLine(c.line));
      return;
    }
    startLine(c.line);
  });
  chipsEl.appendChild(b);
}

function updateHud() {
  if (state.endShown) return;
  const line = STORY[state.line];
  if (!line) return;
  document.getElementById('lineNo').textContent = String(state.line + 1).padStart(2, '0') + ' / ' + String(STORY.length).padStart(2, '0');
  document.getElementById('modeName').textContent = line.label || '';
  document.getElementById('speakerName').textContent = lineSpeakerName(line) || '—';
  for (const b of chipsEl.querySelectorAll('.chip')) {
    if (!b.dataset.line) continue;
    b.classList.toggle('active', Number(b.dataset.line) === state.line);
  }
  document.getElementById('hintText').textContent =
    line.mode === 'wait' ? '等待中' :
    line.mode === 'standing' ? '点击测试台按钮播放真实动作' :
    line.mode === 'title' ? (state.typingDone ? '点击进入下一幕' : '点击跳过开场动画') :
    (!state.typingDone ? '点击完成打字' : '点击 / 空格 继续');
  document.getElementById('autoState').textContent = '自动播放：' + (state.auto ? '开' : '关');
  renderDock();
}

function updateTech(force) {
  const line = STORY[state.line];
  if (!line) return;
  const body = document.getElementById('techBody');
  if (!body) return;
  const key = modeRuntimeKey(line);
  const m = modeRuntime[key];
  let html = '';
  html += `<div><div style="letter-spacing:.16em;color:#d6b46a">${line.label || ''}</div>`;
  html += `<div class="note">${line.note || ''}</div></div>`;
  if (line.tech) {
    html += '<h4>CURVE EVIDENCE</h4>';
    for (const t of line.tech) html += `<div class="kv"><span>${t}</span></div>`;
  }
  if (m && m.clips.length) {
    const now = state.freeze && state.freezeTime ? state.freezeTime : performance.now();
    html += '<h4>ACTIVE CLIPS</h4>';
    for (const c of m.clips) {
      const def = ANIM[c.key];
      if (!def) continue;
      const el = Math.max(0, (now - c.start) / 1000 * (c.rate ?? 1));
      const t = c.loop ? (def.stop ? el % def.stop : 0) : Math.min(el, def.stop);
      const p = def.stop ? Math.min(100, (t / def.stop) * 100) : 100;
      html += `<div class="clip"><div class="kv"><span>${c.key}</span><b>${def.stop.toFixed(4)}s${c.loop ? '<span class="loop">LOOP</span>' : ''}</b></div>`;
      html += `<div class="bar"><i style="width:${p.toFixed(1)}%"></i></div>`;
      html += `<div class="note">channels ${def.channels.length} · t=${t.toFixed(3)}s</div></div>`;
    }
  }
  if (force) body.innerHTML = html;
  else {
    // only update when tech panel open to reduce DOM churn
    if (!document.getElementById('tech').classList.contains('hidden')) body.innerHTML = html;
  }
}

/* ---------------------------------------------------------------- bottom test dock */
const dockEl = document.getElementById('dock');
const dockBody = document.getElementById('dockBody');
const dockModeName = document.getElementById('dockModeName');
const dockToggle = document.getElementById('dockToggle');
const dockOpenBtn = document.getElementById('dockOpen');
const DEFAULT_TITLE = '未命名剧情';
const DEFAULT_CHAPTER = 1;
const ORIGINAL_TEXTS = STORY.map(l => l.text || '');
const ORIGINAL_NAMES = STORY.map(l => lineSpeakerName(l));
const ORIGINAL_OPTIONS = STORY.map(l => l.options ? l.options.map(o => ({ ...o })) : null);
const RICH_HELP_HTML = `<div class="dock-help">富文本：&lt;color=#ffcc00&gt;文字&lt;/color&gt; · &lt;size=64&gt;大字&lt;/size&gt;（+12 / 120% 相对）</div><div class="dock-help">&lt;speed=2&gt;加速&lt;/speed&gt;（倍率；&lt;speed=80ms&gt; 每字） · &lt;pause=0.5&gt; / &lt;pause=300ms&gt; 停顿 · &lt;br&gt; 换行</div>`;
let dockContext = '';
let dockCollapsed = true;
let dockLineIndex = 0;
const BRANCH_MAX_OPTIONS = 4;

function dockAttr(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function branchOptionRowsHtml(options) {
  return (options || []).map((opt, i) => {
    const text = typeof opt === 'string' ? opt : (opt.text || '');
    const next = opt && typeof opt === 'object' && opt.next != null ? opt.next : '';
    const condition = opt && typeof opt === 'object' && opt.condition ? JSON.stringify(opt.condition) : '';
    return `<div class="dock-row dock-branch-opt-row" data-index="${i}" data-next="${dockAttr(next)}" data-condition="${dockAttr(condition)}">
      <label class="dock-inline">选项 ${i + 1} <input class="dock-branch-opt" type="text" maxlength="24" value="${dockAttr(text)}"></label>
      <button type="button" class="dock-btn ghost dock-branch-opt-del" title="删除这个选项">×</button>
    </div>`;
  }).join('');
}

function renderBranchOptionRows(options) {
  const wrap = document.getElementById('dockBranchOpts');
  if (wrap) wrap.innerHTML = branchOptionRowsHtml(options);
}

function branchOptionsFromDom() {
  const wrap = document.getElementById('dockBranchOpts');
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('.dock-branch-opt-row')).map((row, i) => ({
    text: row.querySelector('.dock-branch-opt').value,
    next: row.dataset.next === '' ? null : Number(row.dataset.next),
    ...(row.dataset.condition ? { condition: JSON.parse(row.dataset.condition) } : {}),
    index: i,
  }));
}

function dockTailButtons() {
  const labels = { bl: '左下', br: '右下', tl: '左上', tr: '右上' };
  return ['bl', 'br', 'tl', 'tr'].map(d =>
    `<button type="button" data-tail="${d}" class="${state.tailDir === d ? 'active' : ''}">${labels[d]}</button>`
  ).join('');
}

function dockBgHtml() {
  return `<div class="dock-group">
    <div class="dock-label">测试背景（全局）</div>
    <div class="dock-row">
      <input id="dockBgColor" type="color" value="${state.bgColor}">
      <label class="bg-toggle"><input id="dockBgSolid" type="checkbox" ${state.bgSolid ? 'checked' : ''}><span>纯色</span></label>
    </div>
    <div class="dock-help">默认纯绿 #00FF00；取消勾选恢复场景背景</div>
  </div>`;
}

function standingEaseOptionsHtml(selected) {
  return STANDING_EASES.map(([value, label]) =>
    `<option value="${value}" ${Number(selected) === value ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function standingRawTypeOptionsHtml(selected) {
  return STANDING_RAW_TYPES.map(([value, label]) =>
    `<option value="${value}" ${Number(selected) === value ? 'selected' : ''}>${value} · ${label}</option>`
  ).join('');
}

function standingWorkshopHtml() {
  const comp = standingComposer;
  const stats = standingStats();
  const base = standingComposerBase();
  const timeline = standingStepTimeline(comp.steps);
  const total = standingComposerTotal();
  const sel = standingComposerStep(comp.selected);
  const nf = value => String(Math.round((Number(value) || 0) * 1000) / 1000);
  const charLabel = comp.char === 'erpin' ? '艾尔芬' : '内尔';

  const stepRows = comp.steps.length ? comp.steps.map((step, i) => {
    const timing = timeline[i];
    const prev = i === 0 ? STANDING_STEP_DEFAULT : comp.steps[i - 1];
    return `<div class="wf-step ${i === comp.selected ? 'active' : ''}" data-wf-step="${i}">
      <span class="wf-step-no">${i + 1}</span>
      <span class="wf-step-main"><b>${standingWorkshopEscape(standingStepSummary(step, prev))}</b><small>${nf(timing.start)}s → ${nf(timing.start + timing.duration)}s</small></span>
      <span class="wf-step-tools">
        <button type="button" data-wf="step-up" data-index="${i}" title="上移" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-wf="step-down" data-index="${i}" title="下移" ${i === comp.steps.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-wf="step-del" data-index="${i}" title="删除">×</button>
      </span>
    </div>`;
  }).join('') : '<div class="wf-empty">还没有步骤。点方向键或预设，<br>也可以「+ 步骤」手写坐标。</div>';

  let inspector = '<div class="wf-empty">选中左侧步骤后可编辑坐标、缩放、转角和节奏。</div>';
  if (sel) {
    const prev = standingComposerPrevious(comp.selected);
    const xDisplay = comp.coordMode === 'absolute' ? base.x + sel.x : sel.x;
    const yDisplay = comp.coordMode === 'absolute' ? base.y - sel.y : sel.y;
    inspector = `<div class="wf-field-grid">
      <label>${comp.coordMode === 'absolute' ? '画面 X' : 'X 偏移'}<input type="number" step="1" data-wf-step-field="x" value="${nf(xDisplay)}"></label>
      <label>${comp.coordMode === 'absolute' ? '画面 Y' : 'Y 偏移 ↑正'}<input type="number" step="1" data-wf-step-field="y" value="${nf(yDisplay)}"></label>
      <label title="1 = 原大小；1.5 = 150%">拉伸 X ×<input type="number" step="0.05" min="0.05" max="20" data-wf-step-field="sx" value="${nf(sel.sx)}"></label>
      <label title="1 = 原大小；0.9 = 90%">拉伸 Y ×<input type="number" step="0.05" min="0.05" max="20" data-wf-step-field="sy" value="${nf(sel.sy)}"></label>
      <label>RotY 转身°<input type="number" step="5" data-wf-step-field="ry" value="${nf(sel.ry)}"></label>
      <label>RotZ 旋转°<input type="number" step="5" data-wf-step-field="rz" value="${nf(sel.rz)}"></label>
    </div>
    <div class="wf-field-grid wf-time-grid">
      <label>时长 s<input type="number" step="0.05" min="0.01" max="20" data-wf-step-field="duration" value="${nf(sel.duration)}"></label>
      <label>间隔 s<input type="number" step="0.05" min="0" max="20" data-wf-step-field="gap" value="${nf(sel.gap)}"></label>
      <label>缓动<select data-wf-step-field="ease">${standingEaseOptionsHtml(sel.ease)}</select></label>
    </div>
    <div class="wf-coordnote">第 ${comp.selected + 1} 步 · 开始 ${nf(timeline[comp.selected].start)}s · 基准 (${nf(base.x)}, ${nf(base.y)}) · 目标画面 (${nf(base.x + sel.x)}, ${nf(base.y - sel.y)}) · Δ ${nf(prev.x)}→${nf(sel.x)} / ${nf(prev.y)}→${nf(sel.y)}</div>`;
  }

  const presetButtons = [
    ['bounceY', `Y 弹跳 ×${comp.params.count}`],
    ['bounceX', `X 弹跳 ×${comp.params.count}`],
    ['swayX', `X 往返 ×${comp.params.count}`],
    ['swayY', `Y 往返 ×${comp.params.count}`],
    ['pulseY', `纵向拉伸 ×${comp.params.count}`],
    ['pulseX', `横向拉伸 ×${comp.params.count}`],
    ['pulseXY', `等比拉伸 ×${comp.params.count}`],
    ['squash', `压扁回弹 ×${comp.params.count}`],
    ['turnYPlus', `转身 +${comp.params.angle}°`],
    ['turnYMinus', `转身 -${comp.params.angle}°`],
    ['turnZPlus', `RotZ +${comp.params.angle}°`],
    ['turnZMinus', `RotZ -${comp.params.angle}°`],
    ['comboBack', '后跳放大'],
    ['comboDash', '前冲缩小'],
    ['comboLeap', '转身跃迁'],
  ].map(([name, label]) => `<button type="button" class="wf-preset" data-wf-preset="${name}">${label}</button>`).join('');

  const dirPad = STANDING_DIRECTIONS.map(([id, glyph]) =>
    `<button type="button" class="wf-dir ${id === 'home' ? 'home' : ''}" data-wf-dir="${id}" title="${id === 'home' ? '归位' : id}">${glyph}</button>`
  ).join('');

  const saved = loadStandingWorkshopSaved();
  const savedList = saved.length ? saved.map((item, i) =>
    `<span class="wf-saved-chip"><button type="button" data-wf="load-saved" data-index="${i}" title="载入">${standingWorkshopEscape(item.name)}</button><button type="button" data-wf="del-saved" data-index="${i}" title="删除">×</button></span>`
  ).join('') : '<span class="wf-muted">还没有保存的自定义预设</span>';

  const actions = standingUniqueActions(comp.char).slice().sort((a, b) => a.key.localeCompare(b.key));
  const rawOptions = [`<option value="">选择真实动作…</option>`].concat(actions.map(a =>
    `<option value="${standingWorkshopEscape(a.key)}" ${comp.rawSelectedAction === a.key ? 'selected' : ''}>${standingWorkshopEscape(a.key)} · ${standingWorkshopEscape(standingActionSummary(a))} · ${Number(a.total).toFixed(2)}s</option>`
  )).join('');
  const rawRows = comp.rawRecords.length ? comp.rawRecords.map((r, i) => {
    const two = r.type === 3 || r.type === 9;
    const valueFields = `<input type="number" step="0.1" data-raw-index="${i}" data-raw-field="v0" value="${nf(r.values[0])}" title="${r.type === 9 ? 'X 倍率' : 'X / 角度'}">` +
      (two ? `<input type="number" step="0.1" data-raw-index="${i}" data-raw-field="v1" value="${nf(r.values[1])}" title="${r.type === 9 ? 'Y 倍率' : 'Y'}">` : '');
    return `<div class="wf-raw-row" data-raw-index="${i}">
      <span class="wf-raw-no">${i + 1}</span>
      <select data-raw-index="${i}" data-raw-field="type">${standingRawTypeOptionsHtml(r.type)}</select>
      <span class="wf-raw-values">${valueFields}</span>
      <label title="开始时间">@<input type="number" step="0.05" min="0" data-raw-index="${i}" data-raw-field="delay" value="${nf(r.delay)}"></label>
      <label title="时长">Δ<input type="number" step="0.05" min="-1" data-raw-index="${i}" data-raw-field="duration" value="${nf(r.duration)}"></label>
      <select data-raw-index="${i}" data-raw-field="ease">${standingEaseOptionsHtml(r.ease)}</select>
      <button type="button" class="wf-raw-del" data-wf="raw-del" data-index="${i}" title="删除记录">×</button>
    </div>`;
  }).join('') : '<div class="wf-empty">记录为空。可从真实动作载入，或把关键帧展开成记录。</div>';

  const rawPane = `<div class="wf-raw">
    <div class="wf-raw-head">
      <div class="wf-row">
        <select id="wfRawAction" data-wf-raw-select>${rawOptions}</select>
        <button type="button" class="dock-btn ghost" data-wf="load-real">载入真实动作</button>
        <button type="button" class="dock-btn ghost" data-wf="raw-from-steps">关键帧→记录</button>
        <button type="button" class="dock-btn ghost" data-wf="raw-add">+ 记录</button>
        <button type="button" class="dock-btn ghost" data-wf="raw-clear">清空</button>
        <span class="wf-muted">${standingWorkshopEscape(comp.rawSource || '未载入')} · ${comp.rawRecords.length} 条 · ${standingActionTotal(comp.rawRecords).toFixed(2)}s</span>
      </div>
      <div class="wf-raw-legend">值 = Move 节点上的绝对通道值（X/Y 偏移、Scale 倍率、Rot 角度）；开始/时长单位为秒；缓动 −1 为表内默认 OutQuad。</div>
    </div>
    <div class="wf-raw-table">${rawRows}</div>
  </div>`;

  const stepsPane = `<div class="wf-grid">
    <div class="wf-pane wf-presets">
      <div class="wf-pane-head">参数化预设 <span>点击 = 追加 + 播放</span></div>
      <div class="wf-params">
        <label>距离<input type="number" step="10" data-wf-param="distance" value="${nf(comp.params.distance)}"></label>
        <label>高度<input type="number" step="1" data-wf-param="height" value="${nf(comp.params.height)}"></label>
        <label>拉伸<input type="number" step="0.05" data-wf-param="stretch" value="${nf(comp.params.stretch)}"></label>
        <label>次数<input type="number" step="1" min="1" max="12" data-wf-param="count" value="${comp.params.count}"></label>
        <label>角度<input type="number" step="15" data-wf-param="angle" value="${nf(comp.params.angle)}"></label>
      </div>
      <div class="wf-dirpad">${dirPad}</div>
      <div class="wf-presets-grid">${presetButtons}</div>
      <div class="wf-source-note">弹跳波形按真实表 101001001_21 / 107048_146 的 Y 0→+30 往返写法；拉伸按 101001001_62 的缩放往返；转向按 MoveType 5/6。拉伸值为倍率（1.15 = 115%）；预设只生成可编辑关键帧。</div>
    </div>
    <div class="wf-pane wf-timeline-pane">
      <div class="wf-pane-head">步骤 <span>${comp.steps.length} 步 · ${total.toFixed(2)}s</span></div>
      <div class="wf-steps">${stepRows}</div>
      <div class="wf-step-actions">
        <button type="button" class="dock-btn ghost" data-wf="add-step">+ 步骤</button>
        <button type="button" class="dock-btn ghost" data-wf="dup-step" ${sel ? '' : 'disabled'}>复制</button>
        <button type="button" class="dock-btn ghost" data-wf="clear-steps" ${comp.steps.length ? '' : 'disabled'}>清空</button>
      </div>
      <div class="wf-coord-toggle">坐标输入：
        <button type="button" class="${comp.coordMode === 'offset' ? 'active' : ''}" data-wf="coord" data-coord="offset">局部偏移</button>
        <button type="button" class="${comp.coordMode === 'absolute' ? 'active' : ''}" data-wf="coord" data-coord="absolute">画面坐标</button>
      </div>
    </div>
    <div class="wf-pane wf-inspector">
      <div class="wf-pane-head">步骤编辑 <span>${sel ? '#' + (comp.selected + 1) : '未选择'}</span></div>
      ${inspector}
    </div>
  </div>`;

  return `<div class="wf-head">
      <div class="wf-title">动作工坊 <span>${charLabel} · 自定义坐标 / 拉伸 / 方向</span></div>
      <div class="wf-tabs">
        <button type="button" class="wf-tab ${comp.char === 'erpin' ? 'active' : ''}" data-wf="char" data-char="erpin">艾尔芬</button>
        <button type="button" class="wf-tab ${comp.char === 'ner' ? 'active' : ''}" data-wf="char" data-char="ner">内尔</button>
        <i></i>
        <button type="button" class="wf-tab ${comp.mode === 'steps' ? 'active' : ''}" data-wf="mode" data-mode="steps">关键帧</button>
        <button type="button" class="wf-tab ${comp.mode === 'raw' ? 'active' : ''}" data-wf="mode" data-mode="raw">原始记录</button>
      </div>
    </div>
    <div class="wf-toolbar">
      <div class="wf-stats">真实表 ${stats.actions} 个动作 / ${stats.records} 条记录 · 位移记录 ${stats.types[1] + stats.types[2] + stats.types[3]} · 缩放记录 ${stats.types[9]}（${stats.nonuniform} 条非等比） · RotY ${stats.types[5]} · RotZ ${stats.types[6]} · 没有 RotateX / 透明度记录</div>
      <div class="wf-global-actions">
        <button type="button" class="dock-btn" data-wf="play">▶ 播放${comp.mode === 'raw' ? '记录' : '编排'}</button>
        <button type="button" class="dock-btn ghost" data-wf="play-full">⤢ 全屏预览</button>
        <button type="button" class="dock-btn ghost" data-wf="stop">重置角色</button>
      </div>
    </div>
    ${comp.mode === 'steps' ? stepsPane : rawPane}
    <div class="wf-foot">
      <div id="wfStatus" class="wf-status">${standingWorkshopEscape(comp.status)}</div>
      <div class="wf-save-row">
        <input id="wfSaveName" type="text" maxlength="24" placeholder="命名当前编排/记录" value="${standingWorkshopEscape(comp.saveDraft)}">
        <button type="button" class="dock-btn ghost" data-wf="save-preset">保存当前</button>
        <span class="wf-saved-list">${savedList}</span>
      </div>
    </div>`;
}

function standingColumnHtml(id) {
  const data = standingCharacterData(id);
  if (!data) {
    return `<div class="dock-group stand-col">
      <div class="dock-label">${id === 'erpin' ? '艾尔芬' : '内尔'} <span class="stand-id">#${id === 'erpin' ? 10016 : 10006}</span></div>
      <div class="dock-help">动作表加载中…</div>
    </div>`;
  }
  const ep = standingEpisodeFor(id);
  const episodes = Object.keys(data.episodes || {});
  const allActions = Object.values(data.episodes || {}).flat();
  const actions = ep === '__all__' ? allActions.slice().sort((a, b) => a.key.localeCompare(b.key)) : (data.episodes[ep] || []);
  const buttons = actions.map(a => {
    const short = a.key.includes('_') ? a.key.split('_').slice(1).join('_') : a.key;
    const summary = standingActionSummary(a);
    return `<button type="button" class="stand-act" data-char="${id}" data-action="${a.key}" title="${a.key} · ${summary} · ${a.total}s · ${a.uses}次">${short}</button>`;
  }).join('');
  const options = [`<option value="__all__" ${ep === '__all__' ? 'selected' : ''}>全部动作（${allActions.length}）</option>`]
    .concat(episodes.map(e => `<option value="${e}" ${e === ep ? 'selected' : ''}>${e}（${(data.episodes[e] || []).length}）</option>`)).join('');
  return `<div class="dock-group stand-col">
    <div class="dock-label">${data.name} <span class="stand-id">#${data.id}</span></div>
    <div class="dock-row">
      <select class="stand-ep" data-char="${id}">${options}</select>
      <button type="button" class="dock-btn ghost stand-reset" data-char="${id}">重置</button>
    </div>
    <div class="stand-actions" data-char="${id}">${buttons || '<span class="dock-help">本段无位移/缩放动作</span>'}</div>
    <div class="stand-status" data-char="${id}">最近：—</div>
    <div class="dock-row stand-builtins">${STANDING_BUILTINS.map(n => `<button type="button" class="stand-act ghost" data-char="${id}" data-builtin="${n}">${n}</button>`).join('')}</div>
    <div class="dock-help">真实动作 ${actions.length} 条 · 当前 ${ep === '__all__' ? '全部章节' : ep} · 按钮只做整只模型根节点变换</div>
  </div>`;
}

function emoticonMoodOptionsHtml(selected) {
  const moods = EMOTICON_DATA ? EMOTICON_DATA.moods : { heart: { label: '爱心' }, surprised: { label: '惊讶' } };
  return `<option value="">无心情</option>` + Object.entries(moods).map(([id, mood]) =>
    `<option value="${id}" ${selected === id ? 'selected' : ''}>${mood.label}</option>`
  ).join('');
}

function dialogueDockHtml(line) {
  const variant = normalVariantFor(line);
  const pos = line.emoticonPos || { x: 960, y: 560 };
  const scale = line.emoticonScale == null ? 1 : line.emoticonScale;
  const delay = line.emoticonDelay == null ? 0 : line.emoticonDelay;
  const moodCount = EMOTICON_DATA ? Object.keys(EMOTICON_DATA.moods).length : 2;
  return `<div class="dock-group dialogue-test" style="min-width:560px">
    <div class="dock-label">对话框测试 · 布局 / 心情 <span class="stand-id">独立显示</span></div>
    <div class="dock-row">
      <label class="dock-inline">布局
        <select id="dockDialogueVariant">${NORMAL_VARIANTS.map(([id, label]) =>
          `<option value="${id}" ${variant === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
      </label>
      <label class="dock-inline">心情
        <select id="dockDialogueMood">${emoticonMoodOptionsHtml(line.emoticon || '')}</select>
      </label>
      <button id="dockReplayDialogue" type="button" class="dock-btn">重播对话框</button>
    </div>
    <div class="dock-row">
      <label class="dock-inline">心情 X <input id="dockEmoticonX" type="number" step="10" value="${pos.x}"></label>
      <label class="dock-inline">心情 Y <input id="dockEmoticonY" type="number" step="10" value="${pos.y}"></label>
      <label class="dock-inline">缩放 <input id="dockEmoticonScale" type="number" step="0.05" min="0.1" max="4" value="${scale}"></label>
      <label class="dock-inline">延迟 s <input id="dockEmoticonDelay" type="number" step="0.05" min="0" max="4" value="${delay}"></label>
    </div>
    ${line.speaker ? `<div class="dock-row"><label class="dock-inline">说话人 <input id="dockSpeakerName" type="text" maxlength="16"></label></div>` : ''}
    <textarea id="dockLineText" rows="3" spellcheck="false"></textarea>
    ${RICH_HELP_HTML}
    <div class="dock-row">
      <button id="dockApplyLine" class="dock-btn">应用并重播</button>
      <button id="dockResetLine" class="dock-btn ghost">还原</button>
      <span class="dock-help">心情采用 prefabdialogueresources/emoticon_* 的 12 个真实预制体图层，按剧情 Pos/Scale/Delay 独立显示</span>
    </div>
    <div class="dock-help">布局：NormalText 的 Normal / Cloud / Blast 三个真实动画状态 + 名字牌开关。云朵模式使用 CloudIdleX/Y；普通模式使用 BlastEntry + Normal 呼吸；爆炸框使用 BlastEntry + BlastIdle 挤压回弹。</div>
  </div>${dockBgHtml()}`;
}

function buildDockHtml(line, ctx) {
  if (line.mode === 'standing') {
    return `${standingColumnHtml('erpin')}${standingColumnHtml('ner')}
      <div class="dock-group stand-workshop" id="standWorkshop">${standingWorkshopHtml()}</div>
      <div class="dock-group" style="flex-basis:100%">
        <div class="dock-help">动作来源：CN 1.6.1 <b>Packages/table/paged/dialoguecharactermove</b>（AES + LZ4 msgpack，离线解密）。每条按钮播放该角色在对应剧情段真实使用的 MoveType 1/2/3/5/6/9 序列（位移 / RotateY 转身 / RotateZ / 缩放）；演示站位 Slot2 / Slot4（SlotX ±382，站街模型 0.9×，脚底为根节点），动作值按原始表播放。动作工坊把关键帧编译成同样的 Move 通道记录；「原始记录」可载入任意真实动作逐项查看/修改。内置动作只开放有实现证据的 MoveTo1–7（SlotX 表）、Bounce1、PopUp、Appear、Disappear。</div>
      </div>`;
  }
  if (ctx === 'title') {
    return `<div class="dock-group" style="min-width:430px">
      <div class="dock-label">章节开场</div>
      <div class="dock-row">
        <label class="dock-inline">章节数 <input id="dockChapter" type="number" min="0" max="999" step="1"></label>
        <label class="dock-inline">标题 <input id="dockTitle" type="text" maxlength="30"></label>
        <button id="dockApplyTitle" class="dock-btn">应用并重播</button>
        <button id="dockResetTitle" class="dock-btn ghost">还原</button>
      </div>
      <div class="dock-help">Enter 应用；支持多位数与长标题自动缩小</div>
    </div>${dockBgHtml()}`;
  }
  if (ctx.startsWith('bubble')) {
    return `<div class="dock-group" style="min-width:360px">
      <div class="dock-label">气泡文字（测拉伸）</div>
      <textarea id="dockBubbleText" rows="3" spellcheck="false"></textarea>
      ${RICH_HELP_HTML}
      <div class="dock-row">
        <button id="dockApplyBubble" class="dock-btn">应用</button>
        <button id="dockResetBubble" class="dock-btn ghost">还原</button>
        <span class="dock-help">文字多自动变高，最小 320</span>
      </div>
    </div>
    ${line.mode === 'manga' ? `<div class="dock-group">
      <div class="dock-label">尾巴方向</div>
      <div class="tail-dirs" id="dockTailDirs">${dockTailButtons()}</div>
    </div>` : `<div class="dock-group"><div class="dock-label">尾巴</div><div class="dock-help">思考气泡固定为双圆尾巴</div></div>`}
    <div class="dock-group">
      <div class="dock-label">阴影颜色 / 不透明度</div>
      <div class="dock-row">
        <input id="dockShadowColor" type="color" value="${state.shadowColor}">
        <input id="dockShadowAlpha" type="range" min="0" max="1" step="0.01" value="${state.shadowAlpha}">
        <span id="dockShadowVal" class="dock-swatch">${Math.round(state.shadowAlpha * 100)}%</span>
      </div>
      <div class="dock-help">气泡与尾巴阴影共用；默认半透明黑</div>
    </div>${dockBgHtml()}`;
  }
  if (line.mode === 'normal' || line.mode === 'cloud') {
    return dialogueDockHtml(line);
  }
  if (line.mode === 'branch') {
    return `<div class="dock-group" style="min-width:430px">
      <div class="dock-label">分支选项 · 问题与选项</div>
      <textarea id="dockBranchQuestion" rows="2" spellcheck="false"></textarea>
      <div id="dockBranchOpts">${branchOptionRowsHtml(line.options || [])}</div>
      <div class="dock-row">
        <button id="dockAddBranchOpt" class="dock-btn ghost" type="button">+ 添加选项</button>
        <span class="dock-help">自定义测试：1–${BRANCH_MAX_OPTIONS} 项，选项多时按真实 Grid 布局自动上移</span>
      </div>
      <div class="dock-help">问题沿用背后真实 NormalText 对话框；选项为 DialogueBranchSlotNormal（1422×104，Entry/Idle/Select/Exit 曲线）</div>
      ${RICH_HELP_HTML}
      <div class="dock-row">
        <button id="dockApplyBranch" class="dock-btn">应用并重播</button>
        <button id="dockResetBranch" class="dock-btn ghost">还原</button>
        <span class="dock-help">点击画面里的选项继续</span>
      </div>
    </div>${dockBgHtml()}`;
  }
  if (line.mode === 'transition') {
    return `<div class="dock-group" style="min-width:420px">
      <div class="dock-label">${line.label || 'StoryProduction'} · ${line.kind || ''}</div>
      <div class="dock-help">${line.note || ''}</div>
      <div class="dock-help">整段转场约 ${line.hold || 1.4}s；点击画面继续</div>
    </div>${dockBgHtml()}`;
  }
  return `<div class="dock-group" style="min-width:360px">
    <div class="dock-label">${line.label || '当前模式'} · 文本（测排版）</div>
    ${line.speaker || line.speakerName ? `<div class="dock-row"><label class="dock-inline">说话人 <input id="dockSpeakerName" type="text" maxlength="16"></label></div>` : ''}
    <textarea id="dockLineText" rows="3" spellcheck="false"></textarea>
    ${RICH_HELP_HTML}
    <div class="dock-row">
      <button id="dockApplyLine" class="dock-btn">应用</button>
      <button id="dockResetLine" class="dock-btn ghost">还原</button>
      <span class="dock-help">当前模式文本可直接修改</span>
    </div>
  </div>${dockBgHtml()}`;
}

function updateTailButtonStates() {
  const wrap = document.getElementById('dockTailDirs');
  if (!wrap) return;
  for (const b of wrap.querySelectorAll('button[data-tail]')) {
    b.classList.toggle('active', b.dataset.tail === state.tailDir);
  }
}

function syncDockValues(line, ctx) {
  const bgColor = document.getElementById('dockBgColor');
  const bgSolid = document.getElementById('dockBgSolid');
  if (bgColor && document.activeElement !== bgColor) bgColor.value = state.bgColor;
  if (bgSolid) bgSolid.checked = state.bgSolid;
  if (ctx === 'title') {
    const chapter = document.getElementById('dockChapter');
    const title = document.getElementById('dockTitle');
    if (chapter && document.activeElement !== chapter) chapter.value = String(STORY[0].chapterNo ?? DEFAULT_CHAPTER);
    if (title && document.activeElement !== title) title.value = STORY[0].title || DEFAULT_TITLE;
  } else if (ctx.startsWith('bubble')) {
    const area = document.getElementById('dockBubbleText');
    const shadowColor = document.getElementById('dockShadowColor');
    const shadowAlpha = document.getElementById('dockShadowAlpha');
    const shadowVal = document.getElementById('dockShadowVal');
    if (area && document.activeElement !== area) area.value = line.text || '';
    if (shadowColor && document.activeElement !== shadowColor) shadowColor.value = state.shadowColor;
    if (shadowAlpha && document.activeElement !== shadowAlpha) shadowAlpha.value = state.shadowAlpha;
    if (shadowVal) shadowVal.textContent = Math.round(state.shadowAlpha * 100) + '%';
    updateTailButtonStates();
  } else if (line.mode === 'standing') {
    for (const sel of document.querySelectorAll('.stand-ep')) {
      const id = sel.dataset.char;
      const ep = standingEpisodeFor(id);
      if (ep && document.activeElement !== sel) sel.value = ep;
    }
  } else if (line.mode === 'normal' || line.mode === 'cloud') {
    const area = document.getElementById('dockLineText');
    const speakerInput = document.getElementById('dockSpeakerName');
    const variant = document.getElementById('dockDialogueVariant');
    const mood = document.getElementById('dockDialogueMood');
    const x = document.getElementById('dockEmoticonX');
    const y = document.getElementById('dockEmoticonY');
    const scale = document.getElementById('dockEmoticonScale');
    const delay = document.getElementById('dockEmoticonDelay');
    const pos = line.emoticonPos || { x: 960, y: 560 };
    if (area && document.activeElement !== area) area.value = line.text || '';
    if (speakerInput && document.activeElement !== speakerInput) speakerInput.value = lineSpeakerName(line);
    if (variant && document.activeElement !== variant) variant.value = normalVariantFor(line);
    if (mood && document.activeElement !== mood) mood.value = line.emoticon || '';
    if (x && document.activeElement !== x) x.value = String(pos.x);
    if (y && document.activeElement !== y) y.value = String(pos.y);
    if (scale && document.activeElement !== scale) scale.value = String(line.emoticonScale == null ? 1 : line.emoticonScale);
    if (delay && document.activeElement !== delay) delay.value = String(line.emoticonDelay == null ? 0 : line.emoticonDelay);
  } else if (line.mode === 'branch') {
    const q = document.getElementById('dockBranchQuestion');
    if (q && document.activeElement !== q) q.value = line.text || '';
  } else {
    const area = document.getElementById('dockLineText');
    const speakerInput = document.getElementById('dockSpeakerName');
    if (area && document.activeElement !== area) area.value = line.text || '';
    if (speakerInput && document.activeElement !== speakerInput) speakerInput.value = lineSpeakerName(line);
  }
}

function standingWorkshopClick(e) {
  const comp = standingComposer;
  const dirEl = e.target.closest('[data-wf-dir]');
  if (dirEl) {
    standingApplyDirection(dirEl.dataset.wfDir);
    return;
  }
  const presetEl = e.target.closest('[data-wf-preset]');
  if (presetEl) {
    standingApplyPreset(presetEl.dataset.wfPreset);
    return;
  }
  const actionEl = e.target.closest('[data-wf]');
  if (actionEl) {
    const action = actionEl.dataset.wf;
    const index = Number(actionEl.dataset.index);
    if (action === 'char') {
      const id = actionEl.dataset.char === 'ner' ? 'ner' : 'erpin';
      if (id !== comp.char) {
        resetStandingActor(comp.char);
        comp.char = id;
        comp.rawRecords = [];
        comp.rawSource = '';
        comp.rawSelectedAction = '';
        comp.status = `切换到 ${id === 'erpin' ? '艾尔芬' : '内尔'}；关键帧与基准坐标保留。`;
        renderStandingWorkshop();
      }
      return;
    }
    if (action === 'mode') {
      comp.mode = actionEl.dataset.mode === 'raw' ? 'raw' : 'steps';
      if (comp.mode === 'raw' && !comp.rawRecords.length && comp.steps.length) {
        comp.rawRecords = standingComposeRecords(comp.steps).map(r => ({
          type: r.type, values: [...r.values], delay: r.delay, duration: r.duration, ease: r.ease,
        }));
        comp.rawSource = `关键帧编排 · ${comp.steps.length} 步`;
        comp.rawSelectedAction = '';
      }
      comp.status = comp.mode === 'raw' ? '原始记录：可载入真实动作或修改通道值。' : '关键帧：点击预设或编辑步骤。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'coord') {
      comp.coordMode = actionEl.dataset.coord === 'absolute' ? 'absolute' : 'offset';
      comp.status = comp.coordMode === 'absolute' ? '坐标输入切换为画面绝对坐标（脚底基准 y=1040）。' : '坐标输入切换为相对基准的局部偏移。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'add-step') {
      const at = comp.selected >= 0 && comp.selected < comp.steps.length ? comp.selected + 1 : comp.steps.length;
      const base = comp.steps[comp.selected] || standingComposerLastStep() || STANDING_STEP_DEFAULT;
      resetStandingActor(comp.char);
      comp.steps.splice(at, 0, { ...standingCloneStep(base), duration: 0.4, gap: 0.1 });
      comp.selected = at;
      comp.status = `已添加第 ${at + 1} 步，直接改右侧坐标/拉伸值。`;
      renderStandingWorkshop();
      return;
    }
    if (action === 'dup-step') {
      if (!comp.steps[comp.selected]) return;
      const at = comp.selected + 1;
      resetStandingActor(comp.char);
      comp.steps.splice(at, 0, standingCloneStep(comp.steps[comp.selected]));
      comp.selected = at;
      comp.status = `已复制第 ${at} 步。`;
      renderStandingWorkshop();
      return;
    }
    if (action === 'clear-steps') {
      comp.steps = [];
      comp.selected = -1;
      comp.status = '关键帧已清空。';
      resetStandingActor(comp.char);
      renderStandingWorkshop();
      return;
    }
    if (action === 'step-up' || action === 'step-down') {
      const dir = action === 'step-up' ? -1 : 1;
      const to = index + dir;
      if (index < 0 || to < 0 || to >= comp.steps.length) return;
      resetStandingActor(comp.char);
      [comp.steps[index], comp.steps[to]] = [comp.steps[to], comp.steps[index]];
      comp.selected = to;
      comp.status = `步骤 #${index + 1} 已${dir < 0 ? '上移' : '下移'}。`;
      renderStandingWorkshop();
      return;
    }
    if (action === 'step-del') {
      if (!comp.steps[index]) return;
      resetStandingActor(comp.char);
      comp.steps.splice(index, 1);
      comp.selected = comp.steps.length ? Math.min(index, comp.steps.length - 1) : -1;
      comp.status = '步骤已删除。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'play') {
      playStandingComposer();
      return;
    }
    if (action === 'play-full') {
      playStandingComposer();
      setDockCollapsed(true);
      return;
    }
    if (action === 'stop') {
      resetStandingActor(comp.char);
      comp.status = '角色已回到演示站位。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'raw-add') {
      resetStandingActor(comp.char);
      comp.rawRecords.push({ type: 3, values: [0, 0, 0], delay: 0, duration: 0.5, ease: -1 });
      comp.rawSource = comp.rawSource || '自定义记录';
      comp.status = '已添加一条 XY 位移记录；可改类型/值/时间。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'raw-del') {
      if (!comp.rawRecords[index]) return;
      resetStandingActor(comp.char);
      comp.rawRecords.splice(index, 1);
      comp.status = '记录已删除。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'raw-clear') {
      resetStandingActor(comp.char);
      comp.rawRecords = [];
      comp.rawSource = '';
      comp.rawSelectedAction = '';
      comp.status = '原始记录已清空。';
      renderStandingWorkshop();
      return;
    }
    if (action === 'load-real') {
      const select = document.getElementById('wfRawAction');
      loadStandingRawAction(comp.rawSelectedAction || (select && select.value));
      return;
    }
    if (action === 'raw-from-steps') {
      standingRawFromSteps();
      return;
    }
    if (action === 'save-preset') {
      const input = document.getElementById('wfSaveName');
      saveStandingWorkshopPreset(input ? input.value : '');
      return;
    }
    if (action === 'load-saved') {
      loadStandingWorkshopPreset(index);
      return;
    }
    if (action === 'del-saved') {
      deleteStandingWorkshopPreset(index);
      return;
    }
    return;
  }
  const stepRow = e.target.closest('.wf-step');
  if (stepRow) {
    comp.selected = Number(stepRow.dataset.wfStep);
    renderStandingWorkshop();
  }
}

function standingWorkshopChange(e) {
  const comp = standingComposer;
  const t = e.target;
  if (t.dataset.wfParam) {
    const key = t.dataset.wfParam;
    let value = Number(t.value);
    if (!Number.isFinite(value)) value = comp.params[key];
    if (key === 'count') value = Math.max(1, Math.min(12, Math.round(value)));
    else if (key === 'distance') value = Math.max(1, Math.min(4000, value));
    else if (key === 'height') value = Math.max(1, Math.min(800, value));
    else if (key === 'stretch') value = Math.max(0.05, Math.min(6, value));
    else if (key === 'angle') value = Math.max(1, Math.min(720, value));
    comp.params[key] = value;
    queueStandingWorkshopRender();
    return;
  }
  if (t.hasAttribute('data-wf-raw-select')) {
    comp.rawSelectedAction = t.value;
    return;
  }
  if (t.dataset.wfStepField) {
    const step = comp.steps[comp.selected];
    if (!step) return;
    const field = t.dataset.wfStepField;
    let value = Number(t.value);
    if (!Number.isFinite(value)) return;
    if (field === 'x' || field === 'y') {
      if (comp.coordMode === 'absolute') {
        const base = standingComposerBase();
        if (field === 'x') step.x = value - base.x;
        else step.y = base.y - value;
      } else {
        step[field] = value;
      }
    } else if (field === 'sx' || field === 'sy') {
      step[field] = Math.max(0.05, Math.min(20, value));
    } else if (field === 'ry' || field === 'rz') {
      step[field] = Math.max(-7200, Math.min(7200, value));
    } else if (field === 'duration') {
      step.duration = Math.max(0.01, Math.min(20, value));
    } else if (field === 'gap') {
      step.gap = Math.max(0, Math.min(20, value));
    } else if (field === 'ease') {
      step.ease = Number(value);
    }
    if (standingPlay.has(comp.char)) resetStandingActor(comp.char);
    comp.status = `第 ${comp.selected + 1} 步已修改；播放查看效果。`;
    queueStandingWorkshopRender();
    return;
  }
  if (t.dataset.rawField && t.dataset.rawIndex != null) {
    const index = Number(t.dataset.rawIndex);
    const record = comp.rawRecords[index];
    if (!record) return;
    const field = t.dataset.rawField;
    if (field === 'type') {
      record.type = Number(t.value);
      if (record.type === 9 && (Math.abs(record.values[0]) < 1e-6 || Math.abs(record.values[0]) > 20 || Math.abs(record.values[1]) > 20)) {
        record.values = [1, 1, 0];
      }
    } else if (field === 'v0' || field === 'v1') {
      const vi = field === 'v1' ? 1 : 0;
      record.values[vi] = Number(t.value) || 0;
    } else if (field === 'delay') {
      record.delay = Math.max(0, Number(t.value) || 0);
    } else if (field === 'duration') {
      record.duration = Math.max(-1, Number(t.value) || 0);
    } else if (field === 'ease') {
      record.ease = Number(t.value);
    }
    if (standingPlay.has(comp.char)) resetStandingActor(comp.char);
    comp.status = `原始记录 #${index + 1} 已修改。`;
    queueStandingWorkshopRender();
  }
}

function wireDock() {
  const byId = id => document.getElementById(id);
  const chapter = byId('dockChapter');
  const title = byId('dockTitle');
  if (chapter && title) {
    const apply = () => applyTitleConfig(title.value, chapter.value);
    byId('dockApplyTitle').addEventListener('click', apply);
    byId('dockResetTitle').addEventListener('click', () => applyTitleConfig(DEFAULT_TITLE, DEFAULT_CHAPTER));
    for (const el of [chapter, title]) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          apply();
        }
      });
    }
  }
  const area = byId('dockBubbleText');
  if (area) {
    byId('dockApplyBubble').addEventListener('click', () => applyBubbleText(area.value, dockLineIndex));
    byId('dockResetBubble').addEventListener('click', () => applyBubbleText(ORIGINAL_TEXTS[dockLineIndex] || '', dockLineIndex));
  }
  const lineArea = byId('dockLineText');
  if (lineArea) {
    const speakerInput = byId('dockSpeakerName');
    const apply = () => {
      if (speakerInput) STORY[dockLineIndex].speakerName = speakerInput.value.trim();
      applyLineText(lineArea.value, dockLineIndex);
    };
    byId('dockApplyLine').addEventListener('click', apply);
    byId('dockResetLine').addEventListener('click', () => {
      if (speakerInput) {
        STORY[dockLineIndex].speakerName = ORIGINAL_NAMES[dockLineIndex] || null;
        speakerInput.value = lineSpeakerName(STORY[dockLineIndex]);
      }
      applyLineText(ORIGINAL_TEXTS[dockLineIndex] || '', dockLineIndex);
    });
  }
  const dialogueVariant = byId('dockDialogueVariant');
  if (dialogueVariant) {
    dialogueVariant.addEventListener('change', () => {
      const line = STORY[dockLineIndex];
      line.dialogueVariant = dialogueVariant.value;
      showDialogueTestLine(dockLineIndex);
      renderDock(true);
    });
  }
  const dialogueMood = byId('dockDialogueMood');
  if (dialogueMood) {
    dialogueMood.addEventListener('change', () => {
      const line = STORY[dockLineIndex];
      line.emoticon = dialogueMood.value || null;
      line.emoticonPos = line.emoticonPos || { x: 960, y: 560 };
      line.emoticonScale = line.emoticonScale == null ? 1 : line.emoticonScale;
      line.emoticonDelay = line.emoticonDelay == null ? 0 : line.emoticonDelay;
      showDialogueTestLine(dockLineIndex);
      renderDock(true);
    });
  }
  const dialogueReplay = byId('dockReplayDialogue');
  if (dialogueReplay) {
    dialogueReplay.addEventListener('click', () => {
      showDialogueTestLine(dockLineIndex);
      renderDock(true);
    });
  }
  for (const [id, field] of [['dockEmoticonX', 'x'], ['dockEmoticonY', 'y'], ['dockEmoticonScale', 'scale'], ['dockEmoticonDelay', 'delay']]) {
    const el = byId(id);
    if (!el) continue;
    el.addEventListener('change', () => {
      const line = STORY[dockLineIndex];
      let value = Number(el.value);
      if (!Number.isFinite(value)) return;
      if (field === 'x' || field === 'y') {
        line.emoticonPos = line.emoticonPos || { x: 960, y: 560 };
        line.emoticonPos[field] = value;
      } else if (field === 'scale') {
        line.emoticonScale = Math.max(0.1, Math.min(4, value));
      } else {
        line.emoticonDelay = Math.max(0, Math.min(4, value));
      }
    });
  }
  const branchQ = byId('dockBranchQuestion');
  if (branchQ) {
    const applyBranch = () => {
      const line = STORY[dockLineIndex];
      const rows = branchOptionsFromDom();
      const fallback = rows.length && rows[rows.length - 1].next != null
        ? rows[rows.length - 1].next : (dockLineIndex + 1);
      line.text = branchQ.value;
      line.options = rows.map((row, i) => ({
        text: row.text || `选项 ${i + 1}`,
        next: row.next != null ? row.next : ((line.options[i] && line.options[i].next) ?? fallback),
        ...(row.condition ? { condition: row.condition } : {}),
      }));
      startLine(dockLineIndex);
      renderDock(true);
    };
    byId('dockApplyBranch').addEventListener('click', applyBranch);
    byId('dockResetBranch').addEventListener('click', () => {
      const line = STORY[dockLineIndex];
      line.text = ORIGINAL_TEXTS[dockLineIndex] || '';
      line.options = (ORIGINAL_OPTIONS[dockLineIndex] || []).map(o => ({ ...o }));
      startLine(dockLineIndex);
      renderDock(true);
    });
    const addBranchOpt = byId('dockAddBranchOpt');
    if (addBranchOpt) {
      addBranchOpt.addEventListener('click', () => {
        const rows = branchOptionsFromDom();
        if (rows.length >= BRANCH_MAX_OPTIONS) return;
        const fallback = rows.length && rows[rows.length - 1].next != null
          ? rows[rows.length - 1].next : (dockLineIndex + 1);
        rows.push({ text: `新选项 ${rows.length + 1}`, next: fallback });
        renderBranchOptionRows(rows.map(row => ({ text: row.text, next: row.next })));
      });
    }
    const optsWrap = byId('dockBranchOpts');
    if (optsWrap) {
      optsWrap.addEventListener('click', e => {
        const del = e.target.closest('.dock-branch-opt-del');
        if (!del) return;
        const rows = branchOptionsFromDom();
        if (rows.length <= 1) return;
        const rowEl = del.closest('.dock-branch-opt-row');
        const idx = Number(rowEl && rowEl.dataset.index);
        if (!Number.isInteger(idx)) return;
        rows.splice(idx, 1);
        renderBranchOptionRows(rows.map(row => ({ text: row.text, next: row.next })));
      });
    }
  }
  const tailWrap = byId('dockTailDirs');
  if (tailWrap) {
    tailWrap.addEventListener('click', e => {
      const b = e.target.closest('button[data-tail]');
      if (b) setTailDir(b.dataset.tail);
    });
  }
  const shadowColor = byId('dockShadowColor');
  if (shadowColor) {
    shadowColor.addEventListener('input', () => {
      state.shadowColor = shadowColor.value;
      applyShadowStyle();
    });
  }
  const shadowAlpha = byId('dockShadowAlpha');
  if (shadowAlpha) {
    shadowAlpha.addEventListener('input', () => {
      state.shadowAlpha = Number(shadowAlpha.value);
      applyShadowStyle();
      const v = byId('dockShadowVal');
      if (v) v.textContent = Math.round(state.shadowAlpha * 100) + '%';
    });
  }
  const bgColor = byId('dockBgColor');
  const bgSolid = byId('dockBgSolid');
  if (bgColor) {
    bgColor.addEventListener('input', () => {
      state.bgColor = bgColor.value;
      state.bgSolid = true;
      if (bgSolid) bgSolid.checked = true;
    });
  }
  if (bgSolid) bgSolid.addEventListener('change', () => { state.bgSolid = bgSolid.checked; });
  for (const sel of document.querySelectorAll('.stand-ep')) {
    sel.addEventListener('change', () => {
      standingSelection[sel.dataset.char] = sel.value;
      renderDock(true);
    });
  }
  for (const b of document.querySelectorAll('.stand-act')) {
    b.addEventListener('click', () => {
      if (b.dataset.builtin) playStandingBuiltin(b.dataset.char, b.dataset.builtin);
      else if (b.dataset.action) playStandingAction(b.dataset.char, b.dataset.action);
    });
  }
  for (const b of document.querySelectorAll('.stand-reset')) {
    b.addEventListener('click', () => resetStandingActor(b.dataset.char));
  }
  const workshop = byId('standWorkshop');
  if (workshop) {
    workshop.addEventListener('click', standingWorkshopClick);
    workshop.addEventListener('change', standingWorkshopChange);
  }
}

function setDockCollapsed(collapsed) {
  dockCollapsed = collapsed;
  renderDock(true);
}

function renderDock(force = false) {
  const active = state.started && !state.endShown;
  if (!active) {
    dockEl.classList.add('hidden');
    dockOpenBtn.classList.add('hidden');
    return;
  }
  if (dockCollapsed) {
    dockEl.classList.add('hidden');
    dockOpenBtn.classList.remove('hidden');
    return;
  }
  dockOpenBtn.classList.add('hidden');
  dockEl.classList.remove('hidden');
  const line = STORY[state.line] || STORY[0];
  dockEl.classList.toggle('stand-wide', line.mode === 'standing');
  dockEl.classList.toggle('dialogue-dock', line.mode === 'normal' || line.mode === 'cloud');
  dockLineIndex = state.line;
  const cat = line.mode === 'title' ? 'title' : (line.mode === 'manga' || line.mode === 'mangaThink') ? 'bubble' : 'other';
  const ctx = cat === 'title' ? 'title' : cat + ':' + line.mode;
  dockModeName.textContent = '测试台 · ' + (line.label || '');
  dockToggle.textContent = '收起';
  if (ctx !== dockContext || force) {
    dockContext = ctx;
    dockBody.innerHTML = buildDockHtml(line, ctx);
    wireDock();
  }
  syncDockValues(line, ctx);
}

dockEl.querySelector('.dock-head').addEventListener('click', () => {
  setDockCollapsed(true);
});
dockOpenBtn.addEventListener('click', () => {
  setDockCollapsed(false);
});

function syncBranding() {
  const no = STORY[0].chapterNo;
  const title = STORY[0].title || DEFAULT_TITLE;
  const brand = document.querySelector('.brand-title');
  if (brand) {
    brand.textContent = `第 ${no} 话 `;
    const span = document.createElement('span');
    span.textContent = title;
    brand.appendChild(span);
  }
  const h1 = document.querySelector('#start h1');
  if (h1) h1.textContent = title;
  const sub = document.querySelector('.start-sub');
  if (sub) sub.textContent = `Trickcal · 第 ${no} 话`;
  const kicker = document.querySelector('.end-kicker');
  if (kicker) kicker.textContent = `CHAPTER ${String(no).padStart(2, '0')} · END`;
  const endTitle = document.querySelector('.end-title');
  if (endTitle) endTitle.textContent = `第 ${no} 话 完`;
  document.title = `${title} · 第${no}话 · Trickcal`;
}

function applyTitleConfig(title, chapterNo) {
  const no = Math.max(0, Math.min(999, Math.round(Number(chapterNo) || 0)));
  const text = (title || '').trim().slice(0, 30) || DEFAULT_TITLE;
  STORY[0].chapterNo = no;
  STORY[0].chapter = `第 ${no} 话`;
  STORY[0].title = text;
  syncBranding();
  state.auto = false;
  state.endShown = false;
  document.getElementById('endcard').classList.add('hidden');
  if (!state.started) {
    state.started = true;
    document.getElementById('start').classList.add('hidden');
  }
  startLine(0);
  updateHud();
}

function applyLineText(value, lineIndex = state.line) {
  if (state.transition) return;
  const idx = Number.isInteger(lineIndex) ? lineIndex : state.line;
  const line = STORY[idx];
  if (!line || line.mode === 'title') return;
  const text = String(value ?? '').replace(/\r\n/g, '\n');
  line.text = text;
  state.started = true;
  state.endShown = false;
  state.auto = false;
  state.freeze = false;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('endcard').classList.add('hidden');
  startLine(idx);
  const key = modeRuntimeKey(line);
  const m = modeRuntime[key];
  state.typingDone = true;
  state.doneAt = performance.now();
  state.readyAt = state.doneAt + 1e9;
  if (m) m.reveal = (state.typingPlan || getRichTypingPlan(text)).charCount;
  updateHud();
  updateTech(true);
}

function applyBubbleText(value, lineIndex = 2) {
  applyLineText(value, lineIndex);
}

function setTailDir(dir) {
  state.tailDir = MANGA_TAIL_POS[dir] ? dir : 'bl';
  updateTailButtonStates();
  const m = modeRuntime.manga;
  if (m.visible && isMangaLine(m.line)) {
    applyMangaTail(m, m.line);
    applyMangaFrameFlip(m, m.line);
  }
  updateTech(true);
}

/* ---------------------------------------------------------------- events */
document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('startBoxes').addEventListener('click', openBoxLab);
document.getElementById('startEmotes').addEventListener('click', openEmoteLab);
document.getElementById('boxLabChip').addEventListener('click', openBoxLab);
document.getElementById('boxLabClose').addEventListener('click', closeBoxLab);
document.getElementById('emoteLabChip').addEventListener('click', openEmoteLab);
document.getElementById('emoteClose').addEventListener('click', closeEmoteLab);
document.getElementById('emoteReplayAll').addEventListener('click', () => {
  emoteLabStart = performance.now();
  for (const item of emoteLabCards) item.start = emoteLabStart;
});
document.getElementById('startCustom').addEventListener('click', () => {
  start();
  setDockCollapsed(false);
});
document.getElementById('startTech').addEventListener('click', () => {
  document.getElementById('start').classList.add('hidden');
  startAttractWithTech();
});
document.getElementById('replayBtn').addEventListener('click', () => {
  document.getElementById('endcard').classList.add('hidden');
  state.endShown = false;
  startLine(0);
});
document.getElementById('techClose').addEventListener('click', () => document.getElementById('tech').classList.add('hidden'));

window.addEventListener('keydown', e => {
  unlockAudio();
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  if (e.key === 'Escape' && !document.getElementById('boxLab').classList.contains('hidden')) {
    closeBoxLab();
    return;
  }
  if (e.key === 'Escape' && !document.getElementById('emoteLab').classList.contains('hidden')) {
    closeEmoteLab();
    return;
  }
  if (e.key === 'b' || e.key === 'B') {
    const lab = document.getElementById('boxLab');
    if (lab.classList.contains('hidden')) openBoxLab(); else closeBoxLab();
    return;
  }
  if (e.key === 'e' || e.key === 'E') {
    const lab = document.getElementById('emoteLab');
    if (lab.classList.contains('hidden')) openEmoteLab(); else closeEmoteLab();
    return;
  }
  if (!document.getElementById('emoteLab').classList.contains('hidden')) return;
  if (!document.getElementById('boxLab').classList.contains('hidden')) return;
  if (ae && ae.closest('#dock')) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!state.started) { start(); return; }
    advance();
  } else if (e.key === 'a' || e.key === 'A') {
    state.auto = !state.auto;
    document.getElementById('autoState').textContent = '自动播放：' + (state.auto ? '开' : '关');
  } else if (e.key === 'd' || e.key === 'D') {
    document.getElementById('tech').classList.toggle('hidden');
    updateTech(true);
  } else if (e.key === 't' || e.key === 'T') {
    if (!state.started) return;
    setDockCollapsed(!dockCollapsed);
  } else if (e.key === 'r' || e.key === 'R') {
    if (state.started) { state.endShown = false; document.getElementById('endcard').classList.add('hidden'); startLine(0); }
  }
});


function actorBoneScreen(actor, s, boneName) {
  const bone = actor.skeleton.findBone(boneName);
  if (!bone) return null;
  return { x: s.x + bone.worldX, y: s.y - bone.worldY };
}

function interactiveHitAt(x, y) {
  if (!INTERACTIVE || !state.started || state.endShown) return null;
  const line = STORY[state.line];
  if (!line || line.mode === 'branch' || line.mode === 'title' || line.mode === 'location') return null;
  const entries = [...stageActors.entries()].reverse();
  for (const [id, s] of entries) {
    const actor = spineActors.get(id);
    if (!actor || s.alpha < 0.15 || s.locked) continue;
    const pull = actorBoneScreen(actor, s, 'Character_Ball_Move');
    if (pull) {
      const r = 42 * Math.max(0.6, s.sx);
      if (Math.hypot(x - pull.x, y - pull.y) < r) return { id, actor, s, zone: 'pull' };
    }
    const pat = actorBoneScreen(actor, s, 'Character_Pat');
    if (pat) {
      const rx = 82 * Math.max(0.6, s.sx), ry = 58 * Math.max(0.6, s.sy);
      if (Math.pow((x - pat.x) / rx, 2) + Math.pow((y - pat.y) / ry, 2) <= 1) return { id, actor, s, zone: 'pat' };
    }
    const tickle = actorBoneScreen(actor, s, 'Character_Tickle');
    if (tickle) {
      const rx = 64 * Math.max(0.6, s.sx), ry = 64 * Math.max(0.6, s.sy);
      if (Math.pow((x - tickle.x) / rx, 2) + Math.pow((y - tickle.y) / ry, 2) <= 1) return { id, actor, s, zone: 'tickle' };
    }
  }
  return null;
}

function actorInteraction(actor) {
  if (!actor.interaction) actor.interaction = {
    mode: null, pullX: 0, pullY: 0, pullTargetX: 0, pullTargetY: 0,
    patX: 0, patY: 0, patTargetX: 0, patTargetY: 0,
    tickleDistance: 0, tickleStage: 0, moved: false, startX: 0, startY: 0,
  };
  return actor.interaction;
}

function updateInteractionOffsets(actor, dt) {
  const it = actor.interaction;
  if (!it) return;
  const k = 1 - Math.exp(-dt * 18);
  const pull = it.mode === 'pull';
  const pat = it.mode === 'pat';
  it.pullX += ((pull ? it.pullTargetX : 0) - it.pullX) * k;
  it.pullY += ((pull ? it.pullTargetY : 0) - it.pullY) * k;
  it.patX += ((pat ? it.patTargetX : 0) - it.patX) * k;
  it.patY += ((pat ? it.patTargetY : 0) - it.patY) * k;
}

function applyInteractionPose(actor) {
  const it = actor.interaction;
  if (!it || (!it.pullX && !it.pullY && !it.patX && !it.patY)) return;
  const apply = (name, dx, dy) => {
    const bone = actor.skeleton.findBone(name);
    if (!bone || (!dx && !dy)) return;
    const target = new spine.Vector2(bone.worldX + dx, bone.worldY + dy);
    if (bone.parent) bone.parent.worldToLocal(target);
    bone.x = target.x;
    bone.y = target.y;
  };
  apply('Character_Ball_Move', it.pullX, it.pullY);
  apply('Character_Pat', it.patX, it.patY);
}

function actorPlay(actor, names, loop = false) {
  if (!actor || !names || !names.length) return;
  if (actor.stateData) actor.stateData.defaultMix = 0.18;
  const clip = actor.data.animations.find(a => a.name === names[0]);
  if (!clip) return;
  actor.anim.setAnimation(0, clip.name, !!loop);
  actor.current = clip.name;
  for (let i = 1; i < names.length; i++) {
    if (actor.data.animations.find(a => a.name === names[i])) {
      actor.anim.addAnimation(0, names[i], i === names.length - 1 && names[i] === 'Idle_1', 0.08);
    }
  }
}

function beginPointerInteraction(e) {
  unlockAudio();
  if (!INTERACTIVE) return false;
  const p = canvasPoint(e);
  const hit = interactiveHitAt(p.x, p.y);
  if (!hit) return false;
  const it = actorInteraction(hit.actor);
  it.mode = hit.zone;
  it.moved = false;
  it.startX = p.x;
  it.startY = p.y;
  it.pullTargetX = it.pullTargetY = 0;
  it.patTargetX = it.patTargetY = 0;
  it.tickleDistance = 0;
  it.tickleStage = 0;
  if (hit.zone === 'pull') actorPlay(hit.actor, ['Touch_Idle'], true);
  else if (hit.zone === 'pat') actorPlay(hit.actor, ['Pat_Idle'], true);
  else if (hit.zone === 'tickle') actorPlay(hit.actor, ['Tickle_Idle_1'], true);
  state.pointerInteraction = { actor: hit.actor, s: hit.s, zone: hit.zone, pointerId: e.pointerId };
  state.suppressClickUntil = performance.now() + 260;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
  e.stopPropagation();
  return true;
}

function updatePointerInteraction(e) {
  const pi = state.pointerInteraction;
  if (!pi) return false;
  const it = actorInteraction(pi.actor);
  const p = canvasPoint(e);
  const dx = p.x - it.startX;
  const dy = p.y - it.startY;
  if (Math.hypot(dx, dy) > 10) it.moved = true;
  if (pi.zone === 'pull') {
    const max = 120 * Math.max(0.6, pi.s.sx);
    it.pullTargetX = Math.max(-max, Math.min(max, dx));
    it.pullTargetY = Math.max(-max, Math.min(max, dy));
  } else if (pi.zone === 'pat') {
    const max = 80 * Math.max(0.6, pi.s.sx);
    it.patTargetX = Math.max(-max, Math.min(max, dx));
    it.patTargetY = Math.max(-max, Math.min(max, dy));
  } else if (pi.zone === 'tickle') {
    it.tickleDistance += Math.hypot(e.movementX || 0, e.movementY || 0);
    if (it.tickleStage === 0 && it.tickleDistance > 160) {
      it.tickleStage = 1;
      actorPlay(pi.actor, ['Tickle_Idle_1'], true);
    } else if (it.tickleStage === 1 && it.tickleDistance > 520) {
      it.tickleStage = 2;
      actorPlay(pi.actor, ['Tickle_Idle_2'], true);
    }
  }
  e.preventDefault();
  return true;
}

function endPointerInteraction(e) {
  const pi = state.pointerInteraction;
  if (!pi) return false;
  const it = actorInteraction(pi.actor);
  if (pi.zone === 'pull') {
    actorPlay(pi.actor, ['Touch_End', 'Idle_1'], false);
  } else if (pi.zone === 'pat') {
    if (it.moved) actorPlay(pi.actor, ['Pat_End', 'Idle_1'], false);
    else actorPlay(pi.actor, ['Smash_End_1', 'Smash_End_2', 'Idle_1'], false);
  } else if (pi.zone === 'tickle') {
    actorPlay(pi.actor, ['Tickle_End', 'Idle_1'], false);
  }
  it.mode = null;
  it.pullTargetX = it.pullTargetY = 0;
  it.patTargetX = it.patTargetY = 0;
  it.tickleStage = 0;
  state.pointerInteraction = null;
  state.suppressClickUntil = performance.now() + 260;
  try { canvas.releasePointerCapture(pi.pointerId); } catch (err) {}
  e.preventDefault();
  return true;
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / Math.max(1, r.width) * W, y: (e.clientY - r.top) / Math.max(1, r.height) * H };
}

function bubbleScrollAt(point) {
  const line = STORY[state.line];
  const m = modeRuntime.manga;
  const rect = m.extra.bubbleViewport;
  const metrics = m.extra.bubbleScroll;
  if (!isMangaLine(line) || !m.visible || !['grow', 'scroll'].includes(m.bubbleSize?.overflow) ||
      !rect || !metrics || metrics.max <= 0 || point.x < rect.left || point.x > rect.right ||
      point.y < rect.top || point.y > rect.bottom) return null;
  return metrics;
}

function adjustBubbleScroll(metrics, delta) {
  const current = state.bubbleScrollManual == null ? metrics.offset : state.bubbleScrollManual;
  const next = Math.max(0, Math.min(metrics.max, current + delta));
  state.bubbleScrollManual = next >= metrics.max - 0.5 ? null : next;
}

canvas.addEventListener('wheel', e => {
  const metrics = bubbleScrollAt(canvasPoint(e));
  if (!metrics) return;
  adjustBubbleScroll(metrics, e.deltaY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('click', e => {
  if (performance.now() < (state.suppressClickUntil || 0)) return;
  if (!state.started) { start(); return; }
  const line = STORY[state.line];
  if (line && line.mode === 'branch' && !state.transition) {
    if (!state.typingDone) { completeTyping(); return; }
    const p = canvasPoint(e);
    const hit = (modeRuntime.branch.extra.hits || []).find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (hit) { chooseBranch(hit.index); return; }
    return;
  }
  advance();
});

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const point = canvasPoint(e);
  const metrics = bubbleScrollAt(point);
  if (metrics) {
    state.bubbleScrollGesture = { pointerId: e.pointerId, startY: point.y, lastY: point.y, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    return;
  }
  beginPointerInteraction(e);
});
canvas.addEventListener('pointermove', e => {
  const gesture = state.bubbleScrollGesture;
  if (gesture && gesture.pointerId === e.pointerId) {
    const point = canvasPoint(e);
    const metrics = modeRuntime.manga.extra.bubbleScroll;
    const wasMoving = gesture.moved;
    if (metrics && Math.abs(point.y - gesture.startY) > 6) gesture.moved = true;
    if (metrics && gesture.moved) {
      const scale = Math.max(0.01, Math.abs(Number(STORY[state.line]?.uiScale) || 1));
      adjustBubbleScroll(metrics, ((wasMoving ? gesture.lastY : gesture.startY) - point.y) / scale);
      e.preventDefault();
    }
    gesture.lastY = point.y;
    return;
  }
  updatePointerInteraction(e);
});
function finishBubbleGesture(e) {
  const gesture = state.bubbleScrollGesture;
  if (!gesture || gesture.pointerId !== e.pointerId) return false;
  state.bubbleScrollGesture = null;
  if (gesture.moved) state.suppressClickUntil = performance.now() + 260;
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  return true;
}
canvas.addEventListener('pointerup', e => { if (!finishBubbleGesture(e)) endPointerInteraction(e); });
canvas.addEventListener('pointercancel', e => { if (!finishBubbleGesture(e)) endPointerInteraction(e); });

canvas.addEventListener('mousemove', e => {
  if (!state.started) return;
  const line = STORY[state.line];
  if (!line || line.mode !== 'branch') { state.hoverBranch = -1; canvas.style.cursor = ''; return; }
  const p = canvasPoint(e);
  const hit = (modeRuntime.branch.extra.hits || []).find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
  state.hoverBranch = hit ? hit.index : -1;
  canvas.style.cursor = hit ? 'pointer' : '';
});

canvas.addEventListener('mouseleave', () => { state.hoverBranch = -1; canvas.style.cursor = ''; });

function start() {
  if (state.started) return;
  state.started = true;
  state.auto = false;
  dockCollapsed = true;
  document.getElementById('start').classList.add('hidden');
  startLine(0);
}

function showDialogueTestLine(index) {
  startLine(index);
  const line = STORY[index];
  const m = modeRuntime.normal;
  state.typingDone = true;
  state.doneAt = performance.now();
  state.readyAt = state.doneAt + 1e9;
  if (m && line) m.reveal = (state.typingPlan || getRichTypingPlan(line.text || '')).charCount;
  updateHud();
}

function startDialoguePreview() {
  const idx = STORY.findIndex(l => l.label === '对话框 · 心情测试');
  state.started = true;
  state.auto = false;
  dockCollapsed = true;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('tech').classList.add('hidden');
  showDialogueTestLine(idx >= 0 ? idx : 10);
}

function startAttractWithTech() {
  state.started = true;
  dockCollapsed = true;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('tech').classList.remove('hidden');
  startLine(0);
  updateTech(true);
}

/* ---------------------------------------------------------------- boot */
async function loadStandingActions() {
  try {
    const res = await fetch(assetUrl('assets/standing_actions.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    STANDING_DATA = await res.json();
    standingStatsCache = null;
    if (state.line >= 0 && STORY[state.line] && STORY[state.line].mode === 'standing') renderDock(true);
  } catch (e) {
    console.warn('standing_actions.json failed', e);
  }
}

async function loadEmoticonData() {
  try {
    const res = await fetch(assetUrl('assets/emoticon/emoticons.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    EMOTICON_DATA = await res.json();
    if (state.line >= 0 && STORY[state.line] && (STORY[state.line].mode === 'normal' || STORY[state.line].mode === 'cloud')) renderDock(true);
  } catch (e) {
    console.warn('emoticons.json failed', e);
  }
}

window.__demo = { MODES, modeRuntime, state, STORY, ANIM, startLine, advance, chooseBranch, collectOverrides, findNode, CAST, setTailDir, exitMangaThen, applyBubbleText, dispatchLineEvents, updateState, tick, setStageForLine,
  get uiObjects() { return uiObjects; }, get uiExits() { return uiExits; }, get spineCanvas() { return spineGLCanvas; }, uiTextVisible, uiWorldTransforms, uiBubbleHeight, uiTextHeight, sampleUiActions, uiAnimation, uiTailMotion, drawScene,
  get shaderSpec() { return fxSpec; },
  get images() { return IMG; },
  get STANDING_DATA() { return STANDING_DATA; }, get EMOTICON_DATA() { return EMOTICON_DATA; }, standingPlay, playStandingAction, playStandingBuiltin, resetStandingActor, standingSelection, stageActors, stageImages, spineActors,
  startDialoguePreview, openEmoteLab, closeEmoteLab, openBoxLab, closeBoxLab,
  standingComposer, standingComposeRecords, playStandingComposer, standingActionSummary, drawBackground, sampleBackgroundLayers,
  get backgroundBufferSize() { return [bgMixCanvas?.width || 0, bgMixCanvas?.height || 0, bgLayerCanvas?.width || 0, bgLayerCanvas?.height || 0]; },
  setRenderingEnabled(enabled) {
    state.renderingEnabled = Boolean(enabled);
  },
  showPreset(line) {
    stageActors.clear();
    stageImages.clear();
    STORY.length = 0;
    STORY.push(line);
    state.started = true;
    state.auto = false;
    state.freeze = false;
    state.endShown = false;
    state.transition = null;
    startLine(0);
  },
  showStory(story) {
    stageActors.clear();
    stageImages.clear();
    STORY.length = 0;
    STORY.push(...story.lines);
    STORY_VARIABLES = { ...(story.variables || {}) };
    state.started = true;
    state.auto = false;
    state.freeze = false;
    state.endShown = false;
    state.transition = null;
    startLine(0);
  },
  showMovePreset(preset) {
    const marker = document.createElement('canvas');
    marker.width = marker.height = 320;
    const g = marker.getContext('2d');
    if (IMG.ner) g.drawImage(IMG.ner, 0, 0, 320, 320);
    else {
      g.fillStyle = '#68b750';
      g.fillRect(35, 35, 250, 250);
    }
    const conf = { id: 'preset_motion', kind: 'image', src: marker.toDataURL(), x: 960, y: 540,
      sx: 1, sy: 1, alpha: 1, brightness: 1, face: 1 };
    const actions = window.TrickcalMovePresets.expandMovePreset(conf.id, conf, preset);
    this.showPreset({ mode: 'preview-move', bg: null, stage: [conf], actions });
  },
  seek(i, sec, opts) {
    state.started = true;
    document.getElementById('start').classList.add('hidden');
    document.getElementById('endcard').classList.add('hidden');
    document.getElementById('tech').classList.add('hidden');
    state.endShown = false;
    state.transition = null;
    const replay = Boolean(opts && opts.replay);
    try { restoreUiForSeek(i, replay); }
    catch (e) { reportRuntimeError({ sourceLine: e.sourceLine || STORY[i]?.sourceLine }, e); return false; }
    state.freeze = false;
    startLine(i, { ...(opts || {}), preserveUiCheckpoint: true, suppressAudio: !replay });
    if (state.freeze) return false;
    state.auto = false;
    if (replay) { updateHud(); return true; }
    const seekTime = performance.now();
    const seekSeconds = Math.max(0, Number(sec) || 0);
    state.lineStart = seekTime - seekSeconds * 1000;
    state.dialogueStartAt = state.lineStart + Math.max(0, Number(STORY[state.line].dialogueDelay) || 0) * 1000;
    if (!dispatchLineEvents(seekTime)) return false;
    state.typingDone = true;
    for (const typing of uiTyping.values()) typing.complete = true;
    const line = STORY[state.line];
    const key = modeRuntimeKey(line);
    const m = modeRuntime[key];
    if (line.mode === 'wait' || line.mode === 'ui-present') {
      state.freeze = true;
      state.freezeTime = seekTime;
    }
    if (m) {
      const now = seekTime;
      // Time-based entrances (fullscreen fade, anime caption, title hand-off)
      // read m.startedAt directly instead of a clip, so seek must shift it too.
      // Otherwise a frozen seek leaves the mode at its first frame and the
      // text stays fully transparent in editor previews and captures.
      m.startedAt = now - seekSeconds * 1000;
      for (const c of m.clips) c.start = now - seekSeconds * 1000;
      m.reveal = 999;
      if (line.text) m.reveal = (state.typingPlan || getRichTypingPlan(line.text)).charCount;
      state.doneAt = now - seekSeconds * 1000;
      state.readyAt = now + 1e9;
      state.freeze = true;
      state.freezeTime = now;
    }
    if (line.mode === 'branch') {
      const now = performance.now();
      for (const slot of (modeRuntime.branch.extra.slots || [])) {
      slot.startedAt = now - seekSeconds * 1000;
      for (const c of slot.mode.clips) c.start = now - seekSeconds * 1000;
      }
    }
    updateHud();
    return true;
  }
};

async function loadStory() {
  const res = await fetch(STORY_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('story.json HTTP ' + res.status);
  const doc = await res.json();
  for (const [id, def] of Object.entries(doc.spines || {})) {
    if (def && def.dir && def.file) SPINE_DEFS[id] = { base: assetUrl(def.dir), file: def.file };
  }
  const lines = Array.isArray(doc) ? doc : (doc.lines || []);
  const avatars = new Set(lines.map(line => line.avatar).filter(Boolean));
  await Promise.all([...avatars].filter(id => doc.images?.[id]).map(id => ensureImage('avatar:' + id, doc.images[id])));
  STORY_VARIABLES = doc && !Array.isArray(doc) && doc.variables && typeof doc.variables === 'object'
    ? { ...doc.variables } : {};
  state.variables = { ...STORY_VARIABLES };
  STORY.length = 0;
  for (const line of lines) STORY.push(line);
  // Preload project-specific background images before the first frame.
  for (const line of STORY) {
    if (line.bgUrl && line.bg) await ensureImage(line.bg, line.bgUrl);
    for (const event of line.events || []) {
      if (event.type === 'scene' && event.scene?.bg && event.scene.bgUrl) await ensureImage(event.scene.bg, event.scene.bgUrl);
    }
  }
  if (doc.meta && doc.meta.title) document.title = doc.meta.title + ' · Trickcal';
  try { if (STORY[0] && STORY[0].chapterNo != null) syncBranding(); } catch (e) {}
  return doc;
}

function embedChrome() {
  if (!EMBED) return;
  for (const sel of ['.hud-top', '.hud-bottom', '#tech', '#dock', '#dockOpen', '#emoteLab', '#boxLab', '#start']) {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  }
  document.documentElement.style.background = '#000';
  document.body.style.background = '#000';
}

loadStandingActions();
loadEmoticonData();
loadImages().then(async () => {
  try { await document.fonts.load('110px "One Mobile POP"'); } catch (e) {}
  try { await loadStory(); } catch (e) { console.error('story load failed', e); }
  loadSpineActors();
  embedChrome();
  requestAnimationFrame(frame);
  // gently warm layout caches
  STORY.forEach(l => {
    if (l.text) {
      getRichLayout(l.text, 600, 52, FONT_DIALOGUE, 1.34);
      lineTypingPlan(l);
    }
    if (l.mode === 'location') locationLayer(l.text || '', 468.54, 150, 69.95);
  });
  if (STORY.length && (EMBED || AUTO_START)) {
    state.started = true;
    state.auto = false;
    const startEl = document.getElementById('start');
    if (startEl) startEl.classList.add('hidden');
    startLine(0);
  }
  window.__presetPreviewReady = true;
});
})();

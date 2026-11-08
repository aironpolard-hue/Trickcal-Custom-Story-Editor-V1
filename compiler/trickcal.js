'use strict';
const fs = require('fs');
const path = require('path');
const { wouldCreateCycle } = require('../runtime/scene-graph');
const { parseUiCommand } = require('./ui-commands');
const { diagnoseUi } = require('./ui-diagnostics');
const { expandMovePreset, parseMoveOverrides, eases } = require('./move-presets');
const { parsePresetStatement, resolvePresetReference } = require('./preset-parameters');
const { validateSpineDirectory } = require('./spine-assets');
const cameraTimeline = require('../runtime/camera-timeline');
const stageSampler = require('../runtime/stage-timeline');
const expressions = require('../runtime/expressions');

/**
 * .trickcal compiler
 * A small, deterministic parser for the fan-story script format.
 * It outputs the line array consumed by runtime/app.js.
 */

const BUILTIN_CAST = {
  erpin: { name: '艾尔芬', img: 'erpin' },
  ner: { name: '内尔', img: 'ner' },
};

const MODE_ALIASES = {
  normal: 'normal',
  cloud: 'cloud',
  blast: 'blast',
  manga: 'manga',
  bubble: 'manga',
  think: 'mangaThink',
  mangaThink: 'mangaThink',
  clear: 'clear',
  clearRe: 'clearRe',
  monologue: 'clear',
  anime: 'anime',
  subtitle: 'anime',
  narration: 'narration',
  location: 'location',
  fullscreen: 'fullscreen',
  sfx: 'sfx',
};

const MODE_HOLD = {
  narration: 2.2, manga: 2.2, mangaThink: 2.4, normal: 2.2, cloud: 2.4,
  blast: 2.4, clear: 2.2, clearRe: 2.0, anime: 2.2, location: 2.6,
  newsTalk: 3.0, newsSummary: 3.0, fullscreen: 3.0, sfx: 2.2,
};

const STAGE_POSITIONS = {
  left: { x: 578, y: 1040 },
  farleft: { x: 340, y: 1040 },
  center: { x: 960, y: 1040 },
  right: { x: 1342, y: 1040 },
  farright: { x: 1580, y: 1040 },
};
const BUILTIN_SHADERS = new Set(['heat', 'dream', 'gray', 'glitch', 'wave']);

function stripComment(s) {
  // Comments are whole-line only. A # inside a quoted string is preserved.
  let quote = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' && s[i - 1] !== '\\') quote = !quote;
    if (!quote && s[i] === '#') return s.slice(0, i);
  }
  return s;
}

function unquote(text, diagnostics, lineNo) {
  const m = String(text).trim().match(/^"([\s\S]*)"$/);
  if (!m) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '文本必须使用双引号包裹。' });
    return '';
  }
  return m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function readOptionValue(token) {
  if (token == null) return null;
  if (!token.startsWith('"')) return token;
  try { return JSON.parse(token); } catch { return null; }
}

function parseKeyValueTokens(rest) {
  // Supports: emote heart at 960,560; hold 2.4; purple; tail bl; bubble 1100,520
  const out = {};
  const tokens = String(rest || '').match(/"(?:[^"\\]|\\.)*"|\S+/g) || [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'purple') { out.purple = true; continue; }
    if (t === 'noName' || t === 'noname') { out.noName = true; continue; }
    if (t === 'emote' || t === 'emoticon') { out.emoticon = tokens[++i]; continue; }
    if (t === 'skin') { out.skin = tokens[++i]; continue; }
    if (['uiX','uiY','uiScale','uiRot','uiOpacity','bubbleWidth','bubbleMinHeight','bubbleMaxHeight','bubblePaddingY','textWidth','textOffsetX','textOffsetY','typeSpeed','fontSize','speed','punctuationPause','shadowX','shadowY','shadowAlpha','entryDuration','rot','alpha','sx','sy'].includes(t)) { out[t] = Number(tokens[++i]); continue; }
    if (['textColor','shadowColor','dialogueVariant','overflow'].includes(t)) {
      out[t] = readOptionValue(tokens[++i]);
      continue;
    }
    if (t === 'enter') { out.enter = readOptionValue(tokens[++i]); continue; }
    if (t === 'exit') { out.exit = readOptionValue(tokens[++i]); continue; }
    if (t === 'fade') { out.fade = Number(tokens[++i]); continue; }
    if (t === 'at') {
      const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(tokens[++i] || '');
      if (m) out.at = { x: Number(m[1]), y: Number(m[2]) };
      continue;
    }
    if (t === 'hold') { out.hold = Number(tokens[++i]); continue; }
    if (t === 'tail') { out.tail = readOptionValue(tokens[++i]); continue; }
    if (t === 'name' || t === 'avatar' || t === 'avatarBg') {
      out[t] = readOptionValue(tokens[++i]);
      continue;
    }
    if (t === 'bubble') {
      const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(tokens[++i] || '');
      if (m) out.bubble = { x: Number(m[1]), y: Number(m[2]) };
      continue;
    }
    if (t === 'delay') { out.emoticonDelay = Number(tokens[++i]); continue; }
    if (t === 'scale') { out.scale = Number(tokens[++i]); continue; }
  }
  return out;
}

function parseActorShow(args, lineNo = 0) {
  // show ner at right face 1 pose Angry_5 scale 0.9
  const out = { id: args[1], asset: args[1], x: 960, y: 1040, face: 1, sx: 0.9, sy: 0.9, anim: null, skin: null, fade: null, parent: null, localX: 0, localY: 0, hidden: false, locked: false, z: 0, sourceLine: lineNo };
  if (!/^[A-Za-z_][\w.-]*$/.test(out.id || '')) throw new Error('角色语法：show ner at left');
  const readNumber = (raw, name) => {
    if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw || '') || !Number.isFinite(Number(raw))) {
      throw new Error(`角色 ${name} 必须是有限数字。`);
    }
    return Number(raw);
  };
  const parameterNames = new Set(['at', 'face', 'pose', 'anim', 'scale', 'flip', 'skin', 'fade',
    'rot', 'alpha', 'brightness', 'z', 'sx', 'sy', 'hidden', 'hide', 'locked', 'lock']);
  for (let i = 2; i < args.length; i++) {
    const t = args[i];
    if (t === 'at') {
      const next = args[++i];
      if (STAGE_POSITIONS[next]) Object.assign(out, STAGE_POSITIONS[next]);
      else {
        const parts = (next || '').split(',');
        if (parts.length !== 2) throw new Error('角色位置需要 left、right、center 等站位，或 at 960,540。');
        const [x, y] = parts.map(value => readNumber(value, '位置'));
        out.x = x; out.y = y;
      }
    } else if (t === 'face') {
      const face = readNumber(args[++i], 'face');
      if (face !== 1 && face !== -1) throw new Error('角色 face 必须为 1 或 -1。');
      out.face = face;
    } else if (t === 'pose' || t === 'anim') {
      const name = args[++i];
      if (!name || parameterNames.has(name)) throw new Error(`角色 ${t} 需要动作名称。`);
      out.anim = name;
    } else if (t === 'scale') {
      const v = readNumber(args[++i], 'scale');
      if (v <= 0) throw new Error('角色 scale 必须大于零。');
      out.sx = out.sy = v;
    } else if (t === 'flip') {
      out.face = out.face === 1 ? -1 : 1;
    } else if (t === 'skin') {
      const name = args[++i];
      if (!name || parameterNames.has(name)) throw new Error('角色 skin 需要皮肤名称。');
      out.skin = name;
    } else if (t === 'fade') {
      out.fade = readNumber(args[++i], 'fade');
      if (out.fade < 0) throw new Error('角色 fade 不能小于零。');
    } else if (t === 'rot') {
      out.rot = readNumber(args[++i], 'rot');
    } else if (t === 'alpha') {
      out.alpha = readNumber(args[++i], 'alpha');
      if (out.alpha < 0 || out.alpha > 1) throw new Error('角色 alpha 必须在 0 到 1 之间。');
    } else if (t === 'brightness') {
      out.brightness = readNumber(args[++i], 'brightness');
      if (out.brightness < 0) throw new Error('角色 brightness 不能小于零。');
    } else if (t === 'z') {
      out.z = readNumber(args[++i], 'z');
    } else if (t === 'sx' || t === 'sy') {
      out[t] = readNumber(args[++i], t);
      if (out[t] === 0) throw new Error(`角色 ${t} 不能为零。`);
    } else if (t === 'hidden' || t === 'hide') {
      out.hidden = true;
    } else if (t === 'locked' || t === 'lock') {
      out.locked = true;
    } else throw new Error(`不支持的角色参数：${t}`);
  }
  return out;
}

function parseShaderValue(text, lineNo, diagnostics) {
  const rest = String(text || '').trim().replace(/^shader\s+/, '').trim();
  if (rest === 'reset' || rest === 'none') return { valid: true, shader: null };
  const match = rest.match(/^([A-Za-z_][\w.-]*)(?:\s+(.*))?$/);
  if (!match) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'shader 语法：shader heat 0.35 / shader custom "assets/shaders/x.frag" 0.6 / shader reset' });
    return { valid: false, shader: null };
  }
  const name = match[1];
  const tail = (match[2] || '').trim();
  const custom = name === 'custom' ? tail.match(/^"([^"]+)"(?:\s+(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?))?$/i) : null;
  if (name === 'custom' && !custom) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '自定义着色器语法：shader custom "assets/shaders/effect.frag" 0.6' });
    return { valid: false, shader: null };
  }
  if (name !== 'custom' && !BUILTIN_SHADERS.has(name)) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未知着色器：${name}。可用内置着色器：${[...BUILTIN_SHADERS].join('、')}。` });
    return { valid: false, shader: null };
  }
  const rawIntensity = custom ? custom[2] : tail;
  if (rawIntensity && !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(rawIntensity)) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'shader 强度必须是大于或等于零的有限数字。' });
    return { valid: false, shader: null };
  }
  const intensity = rawIntensity ? Number(rawIntensity) : 0.5;
  if (!Number.isFinite(intensity) || intensity < 0) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'shader 强度必须是大于或等于零的有限数字。' });
    return { valid: false, shader: null };
  }
  return {
    valid: true,
    shader: custom ? { name: 'custom', url: custom[1], intensity } : { name, intensity },
  };
}

function validateShader(shader, lineNo, diagnostics, projectRoot) {
  if (!shader) return true;
  if (shader.name !== 'custom') return true;
  const rel = String(shader.url || '').replace(/\\/g, '/');
  const parts = rel.split('/');
  if (!rel.startsWith('assets/shaders/') || !/\.frag$/i.test(rel) || path.isAbsolute(rel) ||
      /^[A-Za-z]:/.test(rel) || parts.some(p => !p || p === '.' || p === '..')) {
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `自定义片元着色器路径必须是 assets/shaders/ 下的 .frag 文件：${shader.url || ''}` });
    return false;
  }
  if (projectRoot) {
    try {
      const assetsRoot = fs.realpathSync(path.join(projectRoot, 'assets'));
      const target = fs.realpathSync(path.resolve(projectRoot, rel));
      if (target === assetsRoot || !target.startsWith(assetsRoot + path.sep) || !fs.statSync(target).isFile()) throw new Error('文件不存在或不是文件');
    } catch (error) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `自定义着色器无法读取：${shader.url}（${error.message}）` });
      return false;
    }
  }
  return true;
}

function compile(source, options = {}) {
  const diagnostics = [];
  const nodes = []; // {kind:'line'|'label', ...}
  const labels = new Map();
  const actors = new Map();
  let pendingStageOps = [];
  let pendingCameraOps = [];
  let pendingEffectOps = [];
  let pendingSceneOps = [];
  let pendingShaderOps = [];
  const explicitAssets = options.strictAssets === true || /^\s*(?:asset|define|image)\s+/m.test(String(source || ''));
  const cast = explicitAssets ? {} : { ...BUILTIN_CAST, ...(options.cast || {}) };
  const backgrounds = explicitAssets ? {} : { ...(options.backgrounds || {}) };
  const images = explicitAssets ? {} : { ...(options.images || {}) };
  const audio = explicitAssets ? {} : { ...(options.audio || {}) };
  const spines = explicitAssets ? {} : { ...(options.spines || {}) };
  const declarations = new Set();
  const variableDefaults = {};
  const declaredVariables = new Set();
  const conditionalBlocks = [];
  let emittedLineCount = 0;
  const defaults = options.defaults || {};
  let currentBg = null;
  let bgUrl = null;
  let pendingAudio = [];
  let titleText = options.openingTitle || options.title || '未命名剧情';
  let chapterNo = Number(options.chapterNo || 1);
  let camera = { zoom: 1, x: 0, y: 0, targetX: 960, targetY: 540, rot: 0, follow: null, offsetX: 0, offsetY: 0 };
  let fx = { brightness: 1, contrast: 1, saturation: 1, blur: 0, tint: null, tintAlpha: 0 };
  let shader = null;
  let nextPresetFields = null;
  const presetMap = new Map();
  for (const preset of options.presets || []) {
    if (!preset) continue;
    if (preset.name) presetMap.set(preset.name, preset);
    if (preset.file) presetMap.set(preset.file.replace(/\.json$/i, ''), preset);
  }
  const setNextPreset = (text, lineNo) => {
    try {
      const { preset, name, overrides } = parsePresetStatement(text.slice(7), presetMap);
      nextPresetFields = { ...(preset.fields || {}), ...overrides, preset: preset.name || name, _presetType: preset.type };
    } catch (error) {
      nextPresetFields = null;
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: error.message });
    }
  };

  const emit = (line, lineNo) => {
    line.sourceLine = lineNo;
    if (pendingAudio.length && !line.audio &&
        ['stage-sync', 'condition', 'branch-jump', 'jump', 'set'].includes(line.mode)) {
      line.audio = pendingAudio;
      pendingAudio = [];
    }
    line.stageOps = pendingStageOps;
    pendingStageOps = [];
    line.cameraOps = pendingCameraOps;
    line.effectOps = pendingEffectOps;
    line.sceneOps = pendingSceneOps;
    line.shaderOps = pendingShaderOps;
    pendingCameraOps = [];
    pendingEffectOps = [];
    pendingSceneOps = [];
    pendingShaderOps = [];
    nodes.push({ kind: 'line', line, lineNo });
    emittedLineCount++;
    return line;
  };
  const parseVariableExpression = (text, lineNo) => {
    try {
      const expression = expressions.parse(text);
      const names = expressions.identifiers(expression);
      for (const name of names) {
        if (!declaredVariables.has(name)) throw new Error(`变量尚未 default 声明：${name}`);
      }
      if (!names.size) expressions.evaluate(expression, {});
      return expression;
    } catch (error) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `变量表达式无效：${error.message}` });
      return null;
    }
  };
  const stageSnapshot = () => Array.from(actors.values()).map(a => ({ ...a }));
  const flushStageOps = lineNo => {
    if (pendingAudio.length || pendingStageOps.length || pendingCameraOps.length || pendingEffectOps.length ||
        pendingSceneOps.length || pendingShaderOps.length) {
      emit({ mode: 'stage-sync' }, lineNo);
    }
  };
  const applyAudio = (line) => {
    if (pendingAudio.length) {
      line.audio = pendingAudio;
      pendingAudio = [];
    }
    return line;
  };
  const baseLine = (mode, lineNo) => applyAudio({
    mode,
    bg: currentBg,
    ...(bgUrl ? { bgUrl } : {}),
    camera: { ...camera },
    fx: { ...fx },
    ...(shader ? { shader: { ...shader } } : {}),
    stage: mode === 'title' ? [] : stageSnapshot(),
  });

  const resolveSpeaker = (id) => (cast[id] ? cast[id].name : id);

  const makeDialogue = (speaker, modeToken, text, rest, lineNo, emitLine = true) => {
    const mode = MODE_ALIASES[modeToken] || 'normal';
    const mods = parseKeyValueTokens(rest);
    let presetFields = nextPresetFields;
    nextPresetFields = null;
    if (presetFields && ['opening', 'location', 'transition', 'news', 'fullscreen'].includes(presetFields._presetType)) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `${presetFields.preset} 预设需要搭配 ${presetFields._presetType} 语句。` });
      presetFields = null;
    }
    const speakerInfo = speaker && cast[speaker] ? cast[speaker] : null;
    const line = baseLine(mode, lineNo);
    if (presetFields) {
      const { mode: _presetMode, _presetType, ...fields } = presetFields;
      Object.assign(line, fields);
    }
    if (mods.enter) line.enter = mods.enter;
    if (mods.exit) line.exit = mods.exit;
    for (const k of ['uiX','uiY','uiScale','uiRot','uiOpacity','bubbleWidth','bubbleMinHeight','bubbleMaxHeight','bubblePaddingY','textWidth','textOffsetX','textOffsetY','typeSpeed']) {
      if (mods[k] !== undefined && Number.isFinite(mods[k])) line[k] = mods[k];
    }
    for (const k of ['fontSize', 'speed', 'punctuationPause', 'shadowX', 'shadowY', 'shadowAlpha']) {
      if (mods[k] !== undefined && Number.isFinite(mods[k])) line[k] = mods[k];
    }
    for (const k of ['textColor', 'shadowColor', 'dialogueVariant']) {
      if (mods[k] != null) line[k] = mods[k];
    }
    line.text = text;
    line.speaker = speakerInfo ? speaker : null;
    if (speakerInfo) line.speakerName = speakerInfo.name;
    if (speakerInfo && explicitAssets) line.avatar = speakerInfo.avatar || null;
    if (speakerInfo?.avatarBg && line.avatarBg == null) line.avatarBg = speakerInfo.avatarBg;
    if (Object.hasOwn(mods, 'name')) {
      if (typeof mods.name !== 'string') diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'name 需要双引号包裹的显示名称。' });
      else line.speakerName = mods.name;
    }
    if (Object.hasOwn(mods, 'avatar')) {
      if (!mods.avatar || !images[mods.avatar]) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `头像必须先用 image 声明：${mods.avatar || ''}` });
      else line.avatar = mods.avatar;
    }
    if (Object.hasOwn(mods, 'avatarBg')) {
      if (!/^#[0-9a-f]{6}$/i.test(mods.avatarBg || '')) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'avatarBg 需要六位颜色，例如 "#76a65d"。' });
      else line.avatarBg = mods.avatarBg;
    }
    if (mode === 'manga' || mode === 'mangaThink') {
      const actor = speaker && actors.get(speaker);
      const ax = actor ? actor.x : 960;
      line.bubble = mods.bubble || { x: ax <= 960 ? 1100 : 820, y: 520 };
      line.head = { x: ax, y: 690 };
      line.mode = mode;
      if (mods.purple) line.purple = true;
      if (mods.overflow != null) {
        if (!['grow', 'shrink', 'scroll', 'clip'].includes(mods.overflow)) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '气泡 overflow 需要 grow、shrink、scroll 或 clip。' });
        } else line.overflow = mods.overflow;
      }
      if (mods.tail) {
        const tails = { 左下: 'bl', 右下: 'br', 左上: 'tl', 右上: 'tr' };
        line.tail = tails[mods.tail] || mods.tail;
        if (!['bl', 'br', 'tl', 'tr'].includes(line.tail)) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'tail 需要 bl、br、tl、tr 或左下、右下、左上、右上。' });
      }
    } else if (mode === 'normal') {
      if (mods.purple) line.purple = true;
      line.dialogueVariant = mods.noName ? 'normalNoName' : (mods.dialogueVariant || presetFields?.dialogueVariant || 'normal');
      if (speaker && !speakerInfo) line.speaker = speaker;
    } else if (mode === 'cloud') {
      line.mode = 'cloud';
      line.dialogueVariant = mods.dialogueVariant || presetFields?.dialogueVariant || 'cloud';
      line.mind = true;
      if (!speaker) line.speaker = null;
      if (mods.noName) line.dialogueVariant = 'cloud';
    } else if (mode === 'blast') {
      line.dialogueVariant = mods.noName ? 'blastNoName' : (mods.dialogueVariant || presetFields?.dialogueVariant || 'blast');
    } else if (mode === 'clear') {
      line.mode = 'clear';
      if (mods.purple) line.purple = true;
      if (!speaker) line.speaker = null;
    } else if (mode === 'clearRe') {
      line.mode = 'clearRe';
      if (mods.purple) line.purple = true;
    } else if (mode === 'anime') {
      line.mode = 'anime';
    } else if (mode === 'location') {
      line.mode = 'location';
    } else if (mode === 'fullscreen') {
      line.mode = 'fullscreen';
    } else if (mode === 'sfx') {
      line.mode = 'sfx';
      line.sfx = mods.at || { x: 960, y: 470 };
    }
    if (Object.hasOwn(mods, 'hold')) {
      if (!Number.isFinite(mods.hold) || mods.hold < 0) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '台词 hold 必须是大于或等于零的秒数。' });
      else line.hold = mods.hold;
    }
    if (mods.emoticon && (line.mode === 'normal' || line.mode === 'cloud')) {
      line.emoticon = mods.emoticon;
      line.emoticonPos = mods.at || { x: 960, y: 560 };
      line.emoticonScale = mods.scale == null ? 1 : mods.scale;
      line.emoticonDelay = mods.emoticonDelay == null ? 0 : mods.emoticonDelay;
    }
    if (line.hold == null) line.hold = MODE_HOLD[mode] || 2.2;
    if (emitLine) emit(line, lineNo);
    return line;
  };

  const makeSpecialText = (mode, text, lineNo, expectedType, emitLine = true, rest = '') => {
    const presetFields = nextPresetFields;
    nextPresetFields = null;
    if (presetFields && ![expectedType, 'typewriter'].includes(presetFields._presetType)) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `${presetFields.preset} 预设不能用于 ${expectedType} 语句。` });
    }
    const line = baseLine(mode, lineNo);
    if (presetFields && [expectedType, 'typewriter'].includes(presetFields._presetType)) {
      const { _presetType, mode: _presetMode, ...fields } = presetFields;
      Object.assign(line, fields);
    }
    const mods = parseKeyValueTokens(rest);
    for (const key of ['uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity', 'textOffsetX', 'textOffsetY',
      'fontSize', 'typeSpeed', 'speed', 'punctuationPause', 'shadowX', 'shadowY', 'shadowAlpha', 'entryDuration']) {
      if (mods[key] !== undefined && Number.isFinite(mods[key])) line[key] = mods[key];
    }
    if (mods.enter) line.enter = mods.enter;
    if (mods.exit) line.exit = mods.exit;
    for (const key of ['textColor', 'shadowColor']) {
      if (mods[key] != null) line[key] = mods[key];
    }
    line.text = text;
    line.hold = 3;
    if (mode === 'newsTalk') line.speakerName = '新闻主播';
    return emitLine ? emit(line, lineNo) : line;
  };


  const ACTION_PROPS = { x: 'x', y: 'y', targetX: 'targetX', targetY: 'targetY', targetx: 'targetX', targety: 'targetY', sx: 'sx', sy: 'sy', scaleX: 'sx', scaleY: 'sy', scalex: 'sx', scaley: 'sy', rot: 'rot', rotate: 'rot', zoom: 'zoom', alpha: 'alpha', brightness: 'brightness', contrast: 'contrast', saturation: 'saturation', blur: 'blur', tintAlpha: 'tintAlpha' };
  const EASES = new Set(eases);
  const parseTime = (text, unitRequired = false) => {
    const match = /^((?:\d+(?:\.\d+)?|\.\d+))\s*(ms|s)?$/i.exec(text);
    if (!match || (unitRequired && !match[2])) return null;
    const duration = Number(match[1]) / (match[2]?.toLowerCase() === 'ms' ? 1000 : 1);
    return Number.isFinite(duration) ? duration : null;
  };
  const parseWait = text => {
    const match = /^wait\s+(.+)$/.exec(text);
    return match ? parseTime(match[1], true) : null;
  };
  const defaultFx = () => ({ brightness: 1, contrast: 1, saturation: 1, blur: 0, tint: null, tintAlpha: 0 });
  const parseEffect = (text, lineNo) => {
    const rest = text.slice(7).trim();
    if (rest === 'reset') return defaultFx();
    const scalar = /^(brightness|contrast|saturation|blur|tintAlpha)\s+((?:\d+(?:\.\d+)?|\.\d+))$/.exec(rest);
    if (scalar && Number.isFinite(Number(scalar[2])) && (scalar[1] !== 'tintAlpha' || Number(scalar[2]) <= 1)) return { [scalar[1]]: Number(scalar[2]) };
    const tint = /^tint\s+("(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8})"|[A-Za-z]+)(?:\s+((?:\d+(?:\.\d+)?|\.\d+)))?$/.exec(rest);
    if (tint) {
      const opacity = tint[2] == null ? 0.25 : Number(tint[2]);
      if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
        return { tint: tint[1].startsWith('"') ? JSON.parse(tint[1]) : tint[1], tintAlpha: opacity };
      }
    }
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'effect 语法：effect brightness 1.15 / effect tint "#ff0000" 0.25 / effect reset；颜色透明度必须在 0 到 1 之间。' });
    return null;
  };
  const parseScene = (text, lineNo) => {
    const match = /^(?:scene\s+bg|bg)\s+([A-Za-z_][\w.-]*)(?:\s+in\s+((?:\d+(?:\.\d+)?|\.\d+)\s*(?:ms|s))(?:\s+ease\s+([A-Za-z][\w]*))?)?$/.exec(text);
    if (!match) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'scene 语法：scene bg <名称> 或 scene bg <名称> in 500ms ease Linear' });
      return null;
    }
    const duration = match[2] == null ? null : parseTime(match[2], true);
    const ease = match[3] || 'OutCubic';
    if (match[2] != null && (!Number.isFinite(duration) || duration <= 0)) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '背景渐变时长必须是大于零的有限时间。' });
      return null;
    }
    if (match[3] && !EASES.has(ease)) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `不支持的背景渐变缓动：${ease}` });
      return null;
    }
    const transition = duration == null ? null : { duration, ease };
    if (match[1] === 'black') return { bg: null, bgUrl: null, ...(transition ? { transition } : {}) };
    const url = backgrounds[match[1]] || null;
    if (!url) diagnostics.push({ line: lineNo, column: 1, severity: explicitAssets ? 'error' : 'warning', message: `背景未引用：${match[1]}` });
    return { bg: 'bg_' + match[1].replace(/[^\w]/g, '_'), bgUrl: url, ...(transition ? { transition } : {}) };
  };
  const parseOneShotCommand = (text, lineNo) => {
    const match = String(text).match(/^oneshot\s+spine\s+([A-Za-z_][\w.-]*)\s+anim\s+([A-Za-z0-9_]+)(?:\s+(.*))?$/);
    if (!match) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'oneshot 语法：oneshot spine emoticon anim Idea at 960,560 scale 1' });
      return null;
    }
    const def = spines[match[1]];
    if (!def) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未注册的 Spine 素材：${match[1]}` });
      return null;
    }
    const result = {
      spineDir: def.dir, spineFile: def.file, anim: match[2],
      x: 960, y: 540, scale: 1, face: 1, rot: 0, alpha: 1, skin: null,
    };
    const tokens = (match[3] || '').trim().split(/\s+/).filter(Boolean);
    const seen = new Set();
    for (let i = 0; i < tokens.length; i += 2) {
      const key = tokens[i], raw = tokens[i + 1];
      if (!['at', 'scale', 'face', 'rot', 'alpha', 'skin'].includes(key) || seen.has(key) || raw == null) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `oneshot 参数无效或重复：${key}` });
        return null;
      }
      seen.add(key);
      if (key === 'at') {
        const coords = /^(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(raw);
        if (!coords || !Number.isFinite(Number(coords[1])) || !Number.isFinite(Number(coords[2]))) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'oneshot at 需要有效坐标，例如 at 960,560。' });
          return null;
        }
        result.x = Number(coords[1]); result.y = Number(coords[2]);
      } else if (key === 'skin') {
        if (!/^[\w.-]+$/.test(raw)) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'oneshot skin 名称无效。' });
          return null;
        }
        result.skin = raw;
      } else {
        const value = Number(raw);
        if (!Number.isFinite(value) || (key === 'scale' && value <= 0) ||
            (key === 'alpha' && (value < 0 || value > 1)) || (key === 'face' && value !== 1 && value !== -1)) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `oneshot ${key} 参数无效。` });
          return null;
        }
        result[key] = value;
      }
    }
    return result;
  };
  const parseImageStage = (text, lineNo) => {
    const match = String(text).match(/^(?:show|spawn)\s+image\s+([A-Za-z_][\w.-]*)\s+as\s+([A-Za-z_][\w.-]*)(?:\s+(.*))?$/);
    if (!match) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '图片语法：show image station as station_1 at 960,540 scale 0.5' });
      return null;
    }
    const alias = match[1], id = match[2];
    const src = images[alias] || backgrounds[alias];
    if (!src) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未注册的图片素材：${alias}` });
      return null;
    }
    const tokens = (match[3] || '').trim().split(/\s+/).filter(Boolean);
    const conf = {
      id, asset: alias, kind: 'image', src, x: 960, y: 540, sx: 1, sy: 1, face: 1,
      rot: 0, alpha: 1, brightness: 1, hidden: false, locked: false, z: 0,
      anim: null, skin: null, fade: null, parent: null, localX: 0, localY: 0, sourceLine: lineNo,
    };
    const number = (token, name) => {
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token || '') || !Number.isFinite(Number(token))) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `${name} 必须是有限数字。` });
        return null;
      }
      return Number(token);
    };
    for (let i = 0; i < tokens.length; i++) {
      const key = tokens[i];
      if (key === 'at') {
        const pair = (tokens[++i] || '').split(',');
        if (pair.length !== 2) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '图片位置语法：at 960,540' }); continue; }
        const x = number(pair[0], '图片 X'), y = number(pair[1], '图片 Y');
        if (x != null && y != null) { conf.x = x; conf.y = y; }
      } else if (['scale', 'sx', 'sy', 'rot', 'alpha', 'brightness', 'z'].includes(key)) {
        const value = number(tokens[++i], `图片 ${key}`);
        if (value == null) continue;
        if (key === 'scale') conf.sx = conf.sy = value;
        else conf[key] = value;
      } else if (key === 'hidden' || key === 'hide') conf.hidden = true;
      else if (key === 'locked' || key === 'lock') conf.locked = true;
      else diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `不支持的图片参数：${key}` });
    }
    if (conf.sx === 0 || conf.sy === 0) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '图片缩放不能为零。' });
    if (conf.brightness < 0) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '图片亮度必须大于或等于零。' });
    if (conf.alpha < 0 || conf.alpha > 1) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '图片 alpha 必须在 0 到 1 之间。' });
    return conf;
  };
  const cameraDefault = () => ({ zoom: 1, x: 0, y: 0, targetX: 960, targetY: 540, rot: 0, follow: null, offsetX: 0, offsetY: 0 });
  const parseCamera = text => {
    const rest = text.slice(7).trim();
    if (rest === 'reset') return cameraDefault();
    const target = /^(?:target|at)\s+(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(rest);
    if (target) return { targetX: Number(target[1]), targetY: Number(target[2]) };
    const scalar = /^(zoom|rotate|x|y|targetX|targetY)\s+(-?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(rest);
    if (scalar) {
      const value = Number(scalar[2]);
      if (!Number.isFinite(value) || (scalar[1] === 'zoom' && value <= 0)) return null;
      return { [scalar[1] === 'rotate' ? 'rot' : scalar[1]]: value };
    }
    const move = /^move\s+(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(rest);
    if (move) {
      const [x, y] = move.slice(1).map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    }
    const follow = /^follow\s+([A-Za-z_][\w.-]*)(?:\s+offset\s+(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+)))?$/.exec(rest);
    if (follow) {
      const offsetX = follow[2] == null ? null : Number(follow[2]);
      const offsetY = follow[3] == null ? null : Number(follow[3]);
      if (offsetX != null && (!Number.isFinite(offsetX) || !Number.isFinite(offsetY))) return null;
      return { follow: follow[1], ...(offsetX == null ? {} : { offsetX, offsetY }) };
    }
    return null;
  };
  const parseActorAppearance = (text, lineNo, actorMap = actors) => {
    const isAnim = text.startsWith('anim ');
    const match = isAnim
      ? /^anim\s+([A-Za-z_][\w.-]*)\s+([A-Za-z0-9_]+)(?:\s+fade\s+((?:\d+(?:\.\d+)?|\.\d+)))?$/.exec(text)
      : /^skin\s+([A-Za-z_][\w.-]*)\s+([A-Za-z0-9_]+)$/.exec(text);
    if (!match) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: isAnim ? 'anim 语法：anim ner Angry_5 fade 0.25' : 'skin 语法：skin ner Normal' });
      return null;
    }
    const actor = actorMap && actorMap.get(match[1]);
    if (actorMap && (!actor || actor.kind === 'image')) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `当前舞台没有 Spine 角色：${match[1]}` });
      return null;
    }
    const fade = isAnim && match[3] != null ? Number(match[3]) : 0.25;
    if (!Number.isFinite(fade)) {
      diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '动作淡入时间必须是有限数字。' });
      return null;
    }
    return { actor: match[1], patch: isAnim ? { anim: match[2], fade } : { skin: match[2] } };
  };
  const parseMoveAction = (text, baseDelay = 0) => {
    const m = String(text).match(/^move\s+([A-Za-z_][\w.-]*)\s+(targetX|targetY|scaleX|scaleY|x|y|sx|sy|rot|rotate|zoom|alpha|brightness|contrast|saturation|blur|tintAlpha)\s+(.+?)\s+in\s+((?:\d+(?:\.\d+)?|\.\d+)\s*(?:ms|s)?)(?:\s+(.*))?$/i);
    if (!m) return null;
    const actor = m[1];
    const property = ACTION_PROPS[m[2]] || ACTION_PROPS[m[2].toLowerCase()];
    const expr = m[3].trim();
    const duration = parseTime(m[4]);
    const flags = m[5] || '';
    let from = 0;
    let to = 0;
    let relative = false;
    const number = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
    if (expr.startsWith('by ')) {
      relative = true;
      from = 0;
      const value = expr.slice(3).trim();
      if (!number.test(value)) return null;
      to = Number(value);
    } else {
      const pair = expr.split('->');
      if (pair.length !== 2 || !pair.every(value => number.test(value.trim()))) return null;
      from = Number(pair[0].trim());
      to = Number(pair[1].trim());
    }
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    const tokens = flags.trim() ? flags.trim().split(/\s+/) : [];
    let delay = 0;
    let ease = 'OutCubic';
    const seen = new Set();
    for (let k = 0; k < tokens.length; k += 2) {
      const name = tokens[k], value = tokens[k + 1];
      if (!value || seen.has(name)) return null;
      seen.add(name);
      if (name === 'after' && parseTime(value) !== null) delay = parseTime(value);
      else if (name === 'ease' && EASES.has(value)) ease = value;
      else return null;
    }
    if (duration === null || !Number.isFinite(delay + baseDelay + duration)) return null;
    return {
      actor, property, from, to, duration,
      delay: baseDelay + delay,
      ease,
      relative,
    };
  };

  const parseAudioCommand = (text, lineNo) => {
    const rest = text.slice(6).trim();
    const stop = rest.startsWith('stop ');
    const item = { action: stop ? 'stop' : 'play', alias: 'audio' };
    const flagsFor = (flags, isStop) => {
      const tokens = flags.trim() ? flags.trim().split(/\s+/) : [];
      const seen = new Set();
      for (let k = 0; k < tokens.length; k++) {
        const key = tokens[k];
        if (seen.has(key)) throw new Error(`音频参数重复：${key}`);
        seen.add(key);
        if (key === 'loop' && !isStop) { item.loop = true; continue; }
        if (!['fadeIn', 'fadeOut', 'times', 'volume'].includes(key) ||
            (isStop && key !== 'fadeOut')) throw new Error(`不支持的音频参数：${key}`);
        const value = tokens[++k];
        if (!value) throw new Error(`音频参数缺少数值：${key}`);
        if (key === 'fadeIn' || key === 'fadeOut') {
          const match = /^((?:\d+(?:\.\d+)?|\.\d+))(ms|s)?$/i.exec(value);
          if (!match || !Number.isFinite(Number(match[1]))) throw new Error(`${key} 必须是非负时间，例如 0.5s 或 200ms。`);
          item[key] = value;
        } else if (key === 'times') {
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('times 必须是大于零的整数。');
          item.times = Number(value);
        } else {
          if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 1) throw new Error('volume 必须在 0 到 1 之间。');
          item.volume = Number(value);
        }
      }
      if (item.loop && item.times != null) throw new Error('loop 和 times 不能同时使用。');
      if (item.loop && item.fadeOut != null) throw new Error('循环音频请用 audio stop 的 fadeOut 停止。');
    };
    if (stop) {
      const sm = rest.match(/^stop\s+([A-Za-z_][\w.-]*)(?:\s+(.*))?$/);
      if (!sm) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'audio stop 语法：audio stop rain fadeOut 1s' }); return null; }
      item.alias = sm[1];
      if (explicitAssets && !audio[item.alias]) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `音频未引用：${item.alias}` });
        return null;
      }
      try { flagsFor(sm[2] || '', true); }
      catch (error) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: error.message }); return null; }
      return item;
    }
    const pm = rest.match(/^(?:play\s+)?(?:(bgm|sfx|voice)\s+)?([A-Za-z_][\w.-]*)(?:\s+(.*))?$/);
    if (!pm) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'audio 语法：audio play bgm_rain loop fadeIn 1s' }); return null; }
    item.channel = pm[1] || 'bgm';
    item.alias = pm[2];
    try { flagsFor(pm[3] || '', false); }
    catch (error) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: error.message }); return null; }
    if (audio[item.alias]) item.src = audio[item.alias];
    else diagnostics.push({ line: lineNo, column: 1, severity: explicitAssets ? 'error' : 'warning', message: `音频未引用：${item.alias}` });
    return item;
  };

  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let raw = stripComment(lines[i]).trimEnd();
    if (!raw.trim()) continue;
    // Preserve indentation for choice option parsing.
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    const args = trimmed.split(/\s+/);

    while (conditionalBlocks.length && indent <= conditionalBlocks[conditionalBlocks.length - 1].indent &&
           !(trimmed === 'else:' && conditionalBlocks[conditionalBlocks.length - 1].indent === indent)) {
      flushStageOps(lineNo);
      const block = conditionalBlocks.pop();
      if (block.elseJump) block.elseJump.target = emittedLineCount;
      if (block.condition.falseTarget == null) block.condition.falseTarget = emittedLineCount;
    }
    if (trimmed === 'else:') {
      const block = conditionalBlocks[conditionalBlocks.length - 1];
      if (!block || block.indent !== indent) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'else 必须与对应的 if 对齐。' });
      } else if (block.hasElse) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '同一个 if 只能有一个 else。' });
      } else {
        block.elseJump = emit({ mode: 'branch-jump', target: null }, lineNo);
        block.condition.falseTarget = emittedLineCount;
        block.hasElse = true;
      }
      continue;
    }
    if (trimmed.startsWith('default ')) {
      const match = trimmed.match(/^default\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (indent !== 0) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'default 变量声明必须顶格书写。' });
      else if (!match) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'default 语法：default trust = 0（初值仅支持数字、布尔值或双引号字符串）。' });
      else if (['true', 'false', 'and', 'or', 'not'].includes(match[1])) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `变量名称是表达式保留字：${match[1]}` });
      else if (declaredVariables.has(match[1])) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `变量重复声明：${match[1]}` });
      else {
        try {
          const expression = expressions.parse(match[2]);
          if (expressions.identifiers(expression).size) throw new Error('初值不能引用其他变量');
          const value = expressions.evaluate(expression, {});
          if (!['number', 'boolean', 'string'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
            throw new Error('初值只支持数字、布尔值或字符串');
          }
          declaredVariables.add(match[1]);
          variableDefaults[match[1]] = value;
        } catch (error) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `变量初值无效：${error.message}` });
        }
      }
      continue;
    }
    if (trimmed.startsWith('set ')) {
      const match = trimmed.match(/^set\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|%=|=)\s*(.+)$/);
      if (!match) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'set 语法：set trust = 1、set trust += 1' });
      else if (!declaredVariables.has(match[1])) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `set 变量未声明：${match[1]}；请先使用 default。` });
      else {
        const expression = parseVariableExpression(match[3], lineNo);
        if (expression) {
          try {
            const valueType = expressions.inferType(expression, variableDefaults);
            const targetType = typeof variableDefaults[match[1]];
            if (match[2] === '=' && valueType !== targetType) throw new Error(`变量 ${match[1]} 是 ${targetType}，不能赋值为 ${valueType}`);
            if (match[2] !== '=' && (targetType !== 'number' || valueType !== 'number')) throw new Error('复合赋值只支持数值变量与数值表达式。');
            emit({ mode: 'set', variable: match[1], operator: match[2], expression }, lineNo);
          } catch (error) {
            diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `set 赋值类型错误：${error.message}` });
          }
        }
      }
      continue;
    }
    if (trimmed.startsWith('if ')) {
      const match = trimmed.match(/^if\s+(.+):$/);
      if (!match) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'if 语法：if trust >= 2:' });
      else {
        const expression = parseVariableExpression(match[1], lineNo);
        if (expression) {
          try {
            if (expressions.inferType(expression, variableDefaults) !== 'boolean') throw new Error('if 条件必须是布尔表达式；请使用比较运算符，例如 trust >= 2。');
            const condition = emit({ mode: 'condition', expression, falseTarget: null }, lineNo);
            conditionalBlocks.push({ indent, condition, hasElse: false, elseJump: null });
          } catch (error) {
            diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `if 条件无效：${error.message}` });
          }
        }
      }
      continue;
    }

    if (trimmed.startsWith('ui ')) {
      try {
        const command = parseUiCommand(trimmed, presetMap);
        const line = baseLine(command.type === 'present' ? 'ui-present' : 'ui-op', lineNo);
        if (command.operation) line.operation = command.operation;
        emit(line, lineNo);
      } catch (e) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: e.message });
      }
      continue;
    }

    if (/^(?:asset|define|image)\s/.test(trimmed)) {
      let m = trimmed.match(/^asset\s+(spine|image|audio)\s+([A-Za-z_][\w.-]*)\s+"([^"]+)"(?:\s+name\s+"([^"]+)")?$/);
      const spineDef = trimmed.match(/^define\s+([A-Za-z_][\w-]*)\s*=\s*Spine\(\s*"([^"]+)"\s*((?:,\s*(?:name|avatar|avatarBg)\s*=\s*(?:"(?:[^"\\]|\\.)*"|[A-Za-z_][\w-]*)\s*)*)\)$/);
      const imageDef = trimmed.match(/^image\s+([A-Za-z_][\w-]*)\s*=\s*"([^"]+)"$/);
      const audioDef = trimmed.match(/^define\s+audio\.([A-Za-z_][\w-]*)\s*=\s*"([^"]+)"$/);
      let spineOptions = {};
      if (spineDef) {
        const optionPattern = /,\s*(name|avatar|avatarBg)\s*=\s*("(?:[^"\\]|\\.)*"|[A-Za-z_][\w-]*)\s*/g;
        let option;
        let invalid = false;
        while ((option = optionPattern.exec(spineDef[3]))) {
          if (Object.hasOwn(spineOptions, option[1])) { invalid = true; break; }
          try { spineOptions[option[1]] = option[2].startsWith('"') ? JSON.parse(option[2]) : option[2]; }
          catch { invalid = true; break; }
        }
        if (invalid || (spineOptions.avatar && !images[spineOptions.avatar]) ||
            (spineOptions.avatarBg && !/^#[0-9a-f]{6}$/i.test(spineOptions.avatarBg))) {
          diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'Spine 参数重复、头像未先用 image 声明，或 avatarBg 颜色无效。' });
          continue;
        }
        m = [spineDef[0], 'spine', spineDef[1], spineDef[2], spineOptions.name];
      }
      else if (imageDef) m = [imageDef[0], 'image', imageDef[1], imageDef[2]];
      else if (audioDef) m = [audioDef[0], 'audio', audioDef[1], audioDef[2]];
      if (!m) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '声明语法：define ner = Spine("assets/spine/standing/ner", name="内尔")；image station = "assets/bg/station.png"；define audio.rain = "assets/audio/rain.ogg"' });
        continue;
      }
      const [, kind, alias, rawPath, displayName] = m;
      const rel = rawPath.replace(/\\/g, '/');
      const parts = rel.split('/');
      if (!options.projectRoot || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || parts.some(p => p === '..') || parts[0] !== 'assets') {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `素材路径必须位于项目 assets 目录内：${rawPath}` });
        continue;
      }
      if (declarations.has(alias)) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `素材名称重复：${alias}` });
        continue;
      }
      const target = path.resolve(options.projectRoot, rel);
      try {
        const assetsRoot = fs.realpathSync(path.join(options.projectRoot, 'assets'));
        const actual = fs.realpathSync(target);
        if (actual !== assetsRoot && !actual.startsWith(assetsRoot + path.sep)) throw new Error('路径超出 assets');
        if (kind === 'spine') {
          const { base } = validateSpineDirectory(actual, assetsRoot);
          spines[alias] = { dir: rel.replace(/\/?$/, '/'), file: base };
          cast[alias] = { name: displayName || alias, ...(spineOptions.avatar ? { avatar: spineOptions.avatar } : {}), ...(spineOptions.avatarBg ? { avatarBg: spineOptions.avatarBg } : {}), ...(!spineDef ? { img: alias } : {}) };
        } else {
          if (!fs.statSync(actual).isFile()) throw new Error('路径不是文件');
          if (kind === 'image') { images[alias] = rel; backgrounds[alias] = rel; }
          else audio[alias] = rel;
        }
        declarations.add(alias);
      } catch (e) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `素材 ${alias} 无法读取：${e.message}` });
      }
      continue;
    }

    // Choice option lines are consumed by the choice block, not here.
    if (indent > 0 && /^".*"\s*->\s*[\w.-]+\s*$/.test(trimmed)) continue;

    if (trimmed.startsWith('oneshot ')) {
      const oneShot = parseOneShotCommand(trimmed, lineNo);
      if (!oneShot) continue;
      const line = baseLine('oneshot', lineNo);
      Object.assign(line, oneShot);
      line.hold = 0;
      emit(line, lineNo);
      continue;
    }
    if (trimmed.startsWith('preset ')) {
      setNextPreset(trimmed, lineNo);
      continue;
    }
    if (trimmed.startsWith('opening ')) {
      const m = trimmed.match(/^opening\s+(\d+)\s+"([\s\S]*?)"(?:\s+(.*))?$/);
      if (!m) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'opening 语法：opening 1 "标题" hold 3.6 cinema on bg elf_city_night（章节数与 hold 必填）' });
        continue;
      }
      const flags = m[3] || '';
      const holdM = flags.match(/\bhold\s+([\d.]+)s?/);
      if (!holdM) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'opening 缺少 hold：停留时长必须写在剧本里，例如 hold 3.6' });
        continue;
      }
      chapterNo = Number(m[1]);
      titleText = m[2].replace(/\n/g, '\n');
      const cinemaM = flags.match(/\bcinema\s+(on|off|true|false)/i);
      const bgM = flags.match(/\bbg\s+([^\s]+)/);
      const line = baseLine('title', lineNo);
      if (nextPresetFields?._presetType === 'opening') {
        const { _presetType, mode: _presetMode, ...fields } = nextPresetFields;
        Object.assign(line, fields);
        nextPresetFields = null;
      }
      line.stage = [];
      line.chapterNo = chapterNo;
      line.chapter = `第 ${chapterNo} 话`;
      line.title = titleText;
      line.cinema = cinemaM ? !/off|false/i.test(cinemaM[1]) : (line.cinema ?? true);
      line.camera = cameraDefault();
      line.hold = Number(holdM[1]);
      const mods = parseKeyValueTokens(flags);
      for (const key of ['uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity']) {
        if (mods[key] !== undefined && Number.isFinite(mods[key])) line[key] = mods[key];
      }
      if (bgM) {
        if (bgM[1] === 'black') {
          line.bg = null;
          delete line.bgUrl;
        } else {
          line.bg = 'bg_' + bgM[1].replace(/[^\w]/g, '_');
          const bgUrl = backgrounds[bgM[1]] || null;
          if (bgUrl) line.bgUrl = bgUrl;
          else diagnostics.push({ line: lineNo, column: 1, severity: explicitAssets ? 'error' : 'warning', message: `开场背景未引用：${bgM[1]}` });
        }
      }
      emit(line, lineNo);
      continue;
    }
    if (trimmed === 'transition' || trimmed.startsWith('transition ')) {
      const match = trimmed.match(/^transition(?:\s+(fadeblack|fadeinblack|fadeoutblack|fadeinwhite|fadeoutwhite|circle|rightpush|colorbars))?(?:\s+hold\s+((?:\d+(?:\.\d+)?|\.\d+))s?)?$/);
      if (!match) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'transition 语法：transition circle hold 1.2 / transition hold 1.2' });
        nextPresetFields = null;
        continue;
      }
      const presetFields = nextPresetFields;
      nextPresetFields = null;
      if (presetFields && presetFields._presetType !== 'transition') {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `${presetFields.preset} 预设需要搭配其对应的语句。` });
      }
      const fields = presetFields?._presetType === 'transition' ? presetFields : {};
      const kind = match[1] || fields.kind || 'fadeblack';
      const hold = match[2] == null ? Number(fields.hold ?? 1.4) : Number(match[2]);
      if (!Number.isFinite(hold) || hold < 0.2) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '转场时长必须是至少 0.2 秒的有限数字。' });
        continue;
      }
      const line = baseLine('transition', lineNo);
      line.kind = kind;
      line.hold = hold;
      if (presetFields?._presetType === 'transition') line.preset = presetFields.preset;
      emit(line, lineNo);
      continue;
    }
    if (trimmed === 'end' || trimmed === '结束') {
      emit({ mode: 'end' }, lineNo);
      continue;
    }
    if (trimmed.startsWith('label ')) {
      const name = trimmed.slice(6).replace(/:$/, '').trim();
      if (!name) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'label 缺少名称。' }); continue; }
      flushStageOps(lineNo);
      if (labels.has(name)) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `标签重复：${name}` });
      labels.set(name, nodes.filter(n => n.kind === 'line').length);
      continue;
    }
    if (trimmed.startsWith('jump ')) {
      const targetLabel = trimmed.slice(5).trim();
      const line = baseLine('jump', lineNo);
      line.targetLabel = targetLabel;
      emit(line, lineNo);
      continue;
    }
    if (trimmed.startsWith('shader ')) {
      const parsed = parseShaderValue(trimmed, lineNo, diagnostics);
      if (parsed.valid && validateShader(parsed.shader, lineNo, diagnostics, options.projectRoot)) {
        shader = parsed.shader;
        pendingShaderOps.push({ shader: shader ? { ...shader } : null });
      }
      continue;
    }
    if (trimmed.startsWith('effect ')) {
      const patch = parseEffect(trimmed, lineNo);
      if (patch) {
        Object.assign(fx, patch);
        pendingEffectOps.push({ ...patch });
      }
      continue;
    }
    if (trimmed.startsWith('camera ')) {
      const patch = parseCamera(trimmed);
      if (patch) {
        Object.assign(camera, patch);
        pendingCameraOps.push({ ...patch });
      }
      else diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'camera 语法：camera target 960,540 / camera zoom 1.2 / camera follow ner offset 0,-40 / camera reset' });
      continue;
    }
    if (trimmed.startsWith('scene ') || trimmed.startsWith('bg ')) {
      const scene = parseScene(trimmed, lineNo);
      if (scene) {
        if (scene.transition) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '背景渐变需要放在 parallel/同时 块中。' });
        else {
          currentBg = scene.bg; bgUrl = scene.bgUrl;
          pendingSceneOps.push({ ...scene });
        }
      }
      continue;
    }
    if (trimmed.startsWith('anim ')) {
      const command = parseActorAppearance(trimmed, lineNo);
      if (command) {
        Object.assign(actors.get(command.actor), command.patch);
        pendingStageOps.push({ type: 'actor', actor: command.actor, patch: { ...command.patch } });
      }
      continue;
    }
    if (trimmed.startsWith('skin ')) {
      const command = parseActorAppearance(trimmed, lineNo);
      if (command) {
        Object.assign(actors.get(command.actor), command.patch);
        pendingStageOps.push({ type: 'actor', actor: command.actor, patch: { ...command.patch } });
      }
      continue;
    }
    if (trimmed.startsWith('spawn image ') || trimmed.startsWith('show image ')) {
      const conf = parseImageStage(trimmed, lineNo);
      if (conf) {
        actors.set(conf.id, conf);
        pendingStageOps.push({ type: 'stage', action: 'show', conf: { ...conf } });
      }
      continue;
    }
    if (trimmed.startsWith('spawn ')) {
      const m = trimmed.match(/^spawn\s+([A-Za-z_][\w.-]*)\s+as\s+([A-Za-z_][\w.-]*)(?:\s+(.*))?$/);
      if (!m) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'spawn 语法：spawn ner as ner_2 at right face 1' }); continue; }
      const asset = m[1];
      const instance = m[2];
      if (!cast[asset]) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未知角色素材：${asset}` }); continue; }
      const rest = (m[3] || '').trim();
      let conf;
      try { conf = parseActorShow(['show', instance, ...(rest ? rest.split(/\s+/) : [])], lineNo); }
      catch (error) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: error.message }); continue; }
      conf.asset = asset;
      actors.set(instance, conf);
      pendingStageOps.push({ type: 'stage', action: 'show', conf: { ...conf } });
      continue;
    }
    if (trimmed.startsWith('bind ')) {
      const m = trimmed.match(/^bind\s+([A-Za-z_][\w.-]*)\s+to\s+([A-Za-z_][\w.-]*)(?:\s+offset\s+(-?[\d.]+),(-?[\d.]+))?$/);
      if (!m) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'bind 语法：bind ner_2 to ner offset 80,0' }); continue; }
      const child = actors.get(m[1]);
      const parent = actors.get(m[2]);
      if (!child) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `子级不存在：${m[1]}` }); continue; }
      if (!parent) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `父级不存在：${m[2]}` }); continue; }
      if (m[1] === m[2]) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '不能绑定到自己。' }); continue; }
      if (wouldCreateCycle(actors, m[1], m[2])) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: '绑定会形成循环。' }); continue; }
      child.parent = m[2];
      child.localX = m[3] != null ? Number(m[3]) : 0;
      child.localY = m[4] != null ? Number(m[4]) : 0;
      pendingStageOps.push({ type: 'bind', child: m[1], binding: { parent: child.parent, localX: child.localX, localY: child.localY } });
      continue;
    }
    if (trimmed.startsWith('unbind ')) {
      const id = trimmed.slice(7).trim();
      const child = actors.get(id);
      if (child) {
        child.parent = null; child.localX = 0; child.localY = 0;
        pendingStageOps.push({ type: 'bind', child: id, binding: { parent: null, localX: 0, localY: 0 } });
      }
      continue;
    }
    if (trimmed.startsWith('show ')) {
      let conf;
      try { conf = parseActorShow(args, lineNo); }
      catch (error) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: error.message }); continue; }
      if (!cast[conf.id]) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未知角色：${conf.id}` });
      else {
        actors.set(conf.id, conf);
        pendingStageOps.push({ type: 'stage', action: 'show', conf: { ...conf } });
      }
      continue;
    }
    if (trimmed.startsWith('hide ')) {
      const id = trimmed.slice(5).trim();
      if (id === 'all' || id === 'stage') actors.clear();
      else actors.delete(id);
      pendingStageOps.push({ type: 'stage', action: 'hide', id });
      continue;
    }
    if (trimmed.startsWith('wait ')) {
      const duration = parseWait(trimmed);
      if (duration === null) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'wait 语法：wait 1.5s 或 wait 500ms，时间必须是有限的非负数。' });
      else {
        const line = baseLine('wait', lineNo);
        line.timelineEnd = duration;
        emit(line, lineNo);
      }
      continue;
    }
    if (trimmed === 'parallel:' || trimmed === '同时:') {
      const baseIndent = indent;
      const presetBeforeParallel = nextPresetFields;
      let j = i + 1;
      let sayLine = null;
      let sayLineNo = lineNo;
      const actions = [];
      const cameraTracks = [];
      const effectTracks = [];
      const events = [];
      const parallelActors = new Map([...actors].map(([id, actor]) => [id, { ...actor }]));
      const pendingMoves = [];
      const pendingPresets = [];
      let waitEnd = 0;
      let hasWait = false;
      const stack = [{ indent: baseIndent, delay: 0 }];
      const popAfterBlock = () => {
        const block = stack.pop();
        if (!block.hasBody) {
          diagnostics.push({
            line: block.sourceLine,
            column: 1,
            severity: 'error',
            message: 'after 延时块不能为空；内部语句需要比 after 行多缩进一级。',
          });
        }
      };
      while (j < lines.length) {
        const rawJ = stripComment(lines[j]).replace(/\s+$/, '');
        if (!rawJ.trim()) { j++; continue; }
        const t = rawJ.trim();
        const ind = rawJ.length - rawJ.trimStart().length;
        if (ind <= baseIndent) break;
        while (stack.length > 1 && ind <= stack[stack.length - 1].indent) popAfterBlock();
        if (ind > stack[stack.length - 1].indent) stack[stack.length - 1].hasBody = true;
        const delayBase = stack[stack.length - 1].delay;
        const afterM = t.match(/^after\s+(.+?)\s*:$/);
        if (afterM) {
          const interval = parseTime(afterM[1], true);
          const delay = delayBase + interval;
          if (interval === null || !Number.isFinite(delay)) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'after 语法：after 0.5s: 或 after 500ms:，时间必须是有限的非负数。' });
          else stack.push({ indent: ind, delay, sourceLine: j + 1, hasBody: false });
          j++;
          continue;
        }
        if (t === 'ui present') {
          if (delayBase > 0) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'ui present 目前不能放在 after 延时块中。' });
            j++;
            continue;
          }
          if (sayLine) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中只能有一个等待或台词。' });
          else {
            sayLine = baseLine('ui-present', j + 1);
            sayLineNo = j + 1;
          }
          j++;
          continue;
        }
        if (t.startsWith('ui move ')) {
          const action = parseMoveAction(t.slice(3), delayBase);
          if (!action) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'ui move 语法：ui move 气泡名 x 100 -> 300 in 1s ease OutCubic' });
          else if (!['x', 'y', 'sx', 'sy', 'rot', 'alpha'].includes(action.property)) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'ui move 仅支持位置、缩放、旋转和透明度。' });
          else actions.push({ ...action, targetKind: 'ui', sourceLine: j + 1 });
          j++;
          continue;
        }
        if (t.startsWith('ui ')) {
          try {
            const command = parseUiCommand(t, presetMap);
            if (command.type !== 'operation') throw new Error('该 UI 语句不能作为并行事件。');
            events.push({ type: 'ui', operation: command.operation, delay: delayBase, sourceLine: j + 1 });
          } catch (error) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: error.message });
          }
          j++;
          continue;
        }
        if (t.startsWith('preset ')) {
          setNextPreset(t, j + 1);
          j++;
          continue;
        }
        const timedNews = t.match(/^news\s+(anchor|summary|talk|简报|主播)\s+"([\s\S]*)"$/);
        const timedFullscreen = t.match(/^fullscreen\s+"([\s\S]*)"$/);
        if (timedNews || timedFullscreen) {
          if (sayLine) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中只能有一个等待或台词。' });
          else {
            const mode = timedFullscreen ? 'fullscreen' : ['summary', '简报'].includes(timedNews[1]) ? 'newsSummary' : 'newsTalk';
            const text = timedFullscreen ? timedFullscreen[1] : timedNews[2];
            sayLine = makeSpecialText(mode, unquote(`"${text}"`, diagnostics, j + 1), j + 1, timedFullscreen ? 'fullscreen' : 'news', false);
            sayLine.dialogueDelay = delayBase;
            sayLineNo = j + 1;
          }
          j++;
          continue;
        }
        const specialDialogue = t.match(/^(narration|cloud|sfx)\s+"((?:[^"\\]|\\.)*)"(?:\s+(.*))?$/);
        const explicitSay = t.startsWith('say ');
        const characterText = explicitSay ? t.slice(4) : t;
        const commandLine = /^(?:audio|scene|bg|effect|camera|anim|skin|wait|move|ui|after|preset|show|hide|spawn|bind|unbind|choice|label|jump|end|opening|location|fullscreen|shader|news|transition|scroll|cg|oneshot|standing)\b/.test(characterText);
        const characterDialogue = !specialDialogue && (explicitSay || !commandLine)
          ? characterText.match(/^([A-Za-z_][\w.-]*)(?:\s+(\w+))?\s+"((?:[^"\\]|\\.)*)"(?:\s+(.*))?$/) : null;
        if (specialDialogue || characterDialogue || t.startsWith('say ')) {
          const sm = characterDialogue;
          if (!specialDialogue && !sm) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 对话语法：ner normal "..." 或 say ner normal "..."' });
          else if (sm && explicitAssets && !cast[sm[1]]) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: `角色未引用：${sm[1]}` });
          else if (sm && sm[2] && !MODE_ALIASES[sm[2]] && !['press', 'news'].includes(sm[2])) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: `未知模式：${sm[2]}` });
          else if (sayLine) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中只能有一个等待或台词。' });
          else {
            const speaker = specialDialogue ? null : sm[1];
            const mode = specialDialogue ? specialDialogue[1] : (sm[2] || 'normal');
            const rawText = specialDialogue ? specialDialogue[2] : sm[3];
            const text = specialDialogue && mode === 'cloud'
              ? rawText.replace(/\\n/g, '\n')
              : unquote(`"${rawText}"`, diagnostics, j + 1);
            sayLine = makeDialogue(speaker, mode, text, (specialDialogue ? specialDialogue[3] : sm[4]) || '', j + 1, false);
            sayLine.dialogueDelay = delayBase;
            sayLineNo = j + 1;
          }
          j++;
          continue;
        }
        if (t.startsWith('audio ')) {
          const command = parseAudioCommand(t, j + 1);
          if (command) events.push({ type: 'audio', delay: delayBase, command, sourceLine: j + 1 });
          j++;
          continue;
        }
        if (t.startsWith('shader ')) {
          const parsed = parseShaderValue(t, j + 1, diagnostics);
          if (parsed.valid && validateShader(parsed.shader, j + 1, diagnostics, options.projectRoot)) {
            events.push({ type: 'shader', shader: parsed.shader, delay: delayBase, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('oneshot ')) {
          const oneShot = parseOneShotCommand(t, j + 1);
          if (oneShot) events.push({ type: 'oneshot', oneShot, delay: delayBase, sourceLine: j + 1 });
          j++;
          continue;
        }
        if (t.startsWith('show ')) {
          if (t.startsWith('show image ')) {
            const conf = parseImageStage(t, j + 1);
            if (conf) {
              events.push({ type: 'stage', action: 'show', delay: delayBase, conf, sourceLine: j + 1 });
            }
            j++;
            continue;
          }
          const showArgs = t.split(/\s+/);
          let conf;
          try { conf = parseActorShow(showArgs, j + 1); }
          catch (error) { diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: error.message }); j++; continue; }
          if (!conf.id || !cast[conf.asset]) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: `未知角色：${conf.asset || conf.id}` });
          } else {
            events.push({ type: 'stage', action: 'show', delay: delayBase, conf, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('hide ')) {
          const id = t.slice(5).trim();
          if (!/^(?:all|stage|[A-Za-z_][\w.-]*)$/.test(id)) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中的 hide 语法：hide ner / hide all' });
          } else {
            events.push({ type: 'stage', action: 'hide', id, delay: delayBase, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('bind ')) {
          const match = t.match(/^bind\s+([A-Za-z_][\w.-]*)\s+to\s+([A-Za-z_][\w.-]*)(?:\s+offset\s+(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+)))?$/);
          if (!match) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中的 bind 语法：bind picture to ner offset 80,0' });
          } else {
            const binding = { parent: match[2], localX: match[3] == null ? 0 : Number(match[3]), localY: match[4] == null ? 0 : Number(match[4]) };
            events.push({ type: 'bind', action: 'bind', child: match[1], binding, delay: delayBase, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('unbind ')) {
          const match = t.match(/^unbind\s+([A-Za-z_][\w.-]*)\s+at\s+(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+))$/);
          if (!match) {
            diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'parallel 中的 unbind 必须指定脱离后的屏幕坐标：unbind picture at 960,540' });
          } else {
            const binding = { parent: null, localX: 0, localY: 0, x: Number(match[2]), y: Number(match[3]) };
            events.push({ type: 'bind', action: 'unbind', child: match[1], binding, delay: delayBase, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('scene ') || t.startsWith('bg ')) {
          const scene = parseScene(t, j + 1);
          if (scene) events.push({ type: 'scene', delay: delayBase, scene, sourceLine: j + 1 });
          j++;
          continue;
        }
        if (t.startsWith('effect ')) {
          if (/\s+in\s+/.test(t)) {
            const track = parseMoveAction(t.replace(/^effect\s+/, 'move effect '), delayBase);
            if (!track || !['brightness', 'contrast', 'saturation', 'blur', 'tintAlpha'].includes(track.property) ||
                track.relative || track.from < 0 || track.to < 0 ||
                (track.property === 'tintAlpha' && (track.from > 1 || track.to > 1))) {
              diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: '画面效果渐变语法：effect brightness 1 -> 0.5 in 1s ease Linear；数值不可为负，tintAlpha 需在 0 到 1 之间。' });
            } else effectTracks.push({ ...track, sourceLine: j + 1 });
          } else {
            const patch = parseEffect(t, j + 1);
            if (patch) events.push({ type: 'effect', delay: delayBase, patch, sourceLine: j + 1 });
          }
          j++;
          continue;
        }
        if (t.startsWith('camera ')) {
          if (/\s+in\s+/.test(t)) {
            const track = parseMoveAction(t.replace(/^camera\s+/, 'move camera '), delayBase);
            if (!track || !['x', 'y', 'targetX', 'targetY', 'rot', 'zoom'].includes(track.property) ||
                (track.property === 'zoom' && (track.relative || track.from <= 0 || track.to <= 0))) {
              diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: '镜头补间语法：camera targetX 960 -> 1180 in 1s；targetY、x、y、zoom、rotate 也支持补间。' });
            } else cameraTracks.push({ ...track, sourceLine: j + 1 });
          } else {
            const patch = parseCamera(t);
            if (patch) events.push({ type: 'camera', delay: delayBase, patch, sourceLine: j + 1 });
            else diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'camera 语法：camera target 960,540 / camera zoom 1.2 / camera follow ner offset 0,-40 / camera reset' });
          }
          j++;
          continue;
        }
        if (t.startsWith('anim ') || t.startsWith('skin ')) {
          const command = parseActorAppearance(t, j + 1, null);
          if (command) events.push({ type: 'actor', delay: delayBase, ...command, sourceLine: j + 1 });
          j++;
          continue;
        }
        if (t.startsWith('wait ')) {
          const duration = parseWait(t);
          if (duration === null || !Number.isFinite(delayBase + duration)) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'wait 语法：wait 1.5s 或 wait 500ms，时间必须是有限的非负数。' });
          else {
            hasWait = true;
            waitEnd = Math.max(waitEnd, delayBase + duration);
          }
          j++;
          continue;
        }
        if (t.startsWith('move ')) {
          const presetMatch = t.match(/^move\s+([A-Za-z_][\w.-]*)\s+preset(?:\s+(.*))?$/);
          if (presetMatch) {
            try {
              const { preset, rest } = resolvePresetReference(presetMatch[2] || '', presetMap);
              const overrides = parseMoveOverrides(rest, preset);
              pendingPresets.push({ kind: 'preset', actor: presetMatch[1], preset, overrides, delay: delayBase, sourceLine: j + 1 });
            } catch (error) {
              diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: error.message });
            }
            j++;
            continue;
          }
          const action = parseMoveAction(t, delayBase);
          if (!action) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: 'move 语法：move ner x 100 -> 300 in 1s ease OutCubic' });
          else if (!['x', 'y', 'sx', 'sy', 'rot', 'alpha', 'brightness'].includes(action.property)) diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: '角色和图片仅支持位置、缩放、旋转、透明度和亮度。' });
          else pendingMoves.push({ ...action, sourceLine: j + 1 });
          j++;
          continue;
        }
        diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: `parallel 暂不支持该语句：${t}。` });
        j++;
      }
      while (stack.length > 1) popAfterBlock();
      const stageTimeline = [
        ...events.filter(event => ['stage', 'actor', 'bind'].includes(event.type)).map(event => ({ kind: 'event', ...event })),
        ...pendingMoves.map(action => ({ kind: 'move', ...action })),
        ...pendingPresets,
      ].sort((a, b) => a.delay - b.delay || a.sourceLine - b.sourceLine);
      for (const item of stageTimeline) {
        if (item.kind === 'move' || item.kind === 'preset') {
          const actor = parallelActors.get(item.actor);
          if (!actor) {
            diagnostics.push({ line: item.sourceLine, column: 1, severity: 'error', message: `移动对象在该时间不在舞台：${item.actor}` });
          } else if (item.kind === 'move') {
            const { kind, ...action } = item;
            actions.push(action);
          } else {
            try {
              actions.push(...expandMovePreset(item.actor, actor, item.preset, item.delay, item.overrides)
                .map(action => ({ ...action, sourceLine: item.sourceLine })));
            } catch (error) {
              diagnostics.push({ line: item.sourceLine, column: 1, severity: 'error', message: error.message });
            }
          }
        } else if (item.type === 'stage') {
          if (item.action === 'show') parallelActors.set(item.conf.id, { ...item.conf });
          else if (item.id === 'all' || item.id === 'stage') parallelActors.clear();
          else parallelActors.delete(item.id);
        } else if (item.type === 'actor') {
          const actor = parallelActors.get(item.actor);
          if (!actor || actor.kind === 'image') {
            diagnostics.push({ line: item.sourceLine, column: 1, severity: 'error', message: `角色 ${item.actor} 在该动作时间不在舞台或不是 Spine 角色。` });
          } else Object.assign(actor, item.patch);
        } else if (item.type === 'bind') {
          const child = parallelActors.get(item.child);
          const parent = item.binding.parent;
          if (!child || (parent && !parallelActors.has(parent))) {
            diagnostics.push({ line: item.sourceLine, column: 1, severity: 'error', message: `绑定对象不存在：${!child ? item.child : parent}` });
          } else if (parent && (item.child === parent || wouldCreateCycle(parallelActors, item.child, parent))) {
            diagnostics.push({ line: item.sourceLine, column: 1, severity: 'error', message: '绑定会形成循环。' });
          } else Object.assign(child, item.binding);
        }
      }
      if (!sayLine) {
        if (actions.length || cameraTracks.length || effectTracks.length || events.length || hasWait) sayLine = baseLine('wait', lineNo);
        else diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'parallel 块不能为空。' });
      }
      if (sayLine) {
        actions.sort((a, b) => (a.delay || 0) - (b.delay || 0) || (a.sourceLine || 0) - (b.sourceLine || 0));
        sayLine.actions = actions;
        sayLine.cameraTracks = cameraTracks;
        sayLine.effectTracks = effectTracks;
        sayLine.events = events.sort((a, b) => a.delay - b.delay || a.sourceLine - b.sourceLine);
        const maxEnd = [...actions, ...cameraTracks, ...effectTracks].reduce((m, a) => Math.max(m, (a.delay || 0) + (a.duration || 0)), 0);
        const lastEvent = events.reduce((m, event) =>
          Math.max(m, event.delay + (event.type === 'scene' ? Number(event.scene?.transition?.duration) || 0 : 0)), 0);
        sayLine.timelineEnd = Math.max(maxEnd, lastEvent, waitEnd);
        emit(sayLine, sayLineNo);
        camera = cameraTimeline.sample(cameraTimeline.create(sayLine.camera, sayLine.events, cameraTracks), sayLine.timelineEnd);
        fx = cameraTimeline.sampleEffect(cameraTimeline.create(sayLine.fx, sayLine.events, effectTracks, 'effect'), sayLine.timelineEnd);
        for (const event of sayLine.events) {
          if (event.type === 'scene') { currentBg = event.scene.bg; bgUrl = event.scene.bgUrl; }
          else if (event.type === 'shader') { shader = event.shader; }
        }
        const finalStage = stageSampler.sample([...actors.values()], sayLine.events, actions, sayLine.timelineEnd);
        actors.clear();
        for (const [id, actor] of finalStage) actors.set(id, actor);
      }
      if (!sayLine || sayLine.mode === 'wait') nextPresetFields = presetBeforeParallel;
      i = j - 1;
      continue;
    }
    if (trimmed.startsWith('choice ')) {
      const m = trimmed.match(/^choice\s+"([\s\S]*)"$/);
      if (!m) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'choice 语法：choice "问题"' }); continue; }
      const options = [];
      let j = i + 1;
      while (j < lines.length) {
        const candidate = stripComment(lines[j]).replace(/\s+$/, '');
        if (!candidate.trim()) { j++; continue; }
        const candidateIndent = candidate.length - candidate.trimStart().length;
        if (candidateIndent <= 0) break;
        const om = candidate.trim().match(/^"([\s\S]*)"\s*->\s*([\w.-]+)(?:\s+if\s+(.+))?$/);
        if (!om) { diagnostics.push({ line: j + 1, column: 1, severity: 'error', message: '分支选项语法："文本" -> 标签 [if 表达式]' }); j++; continue; }
        const condition = om[3] ? parseVariableExpression(om[3], j + 1) : null;
        options.push({ text: om[1].replace(/\\"/g, '"'), targetLabel: om[2], ...(condition ? { condition } : {}) });
        j++;
      }
      if (!options.length) diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'choice 至少需要一个选项。' });
      const line = baseLine('branch', lineNo);
      line.text = m[1].replace(/\\n/g, '\n');
      line.options = options;
      line.hold = 0;
      emit(line, lineNo);
      i = j - 1;
      continue;
    }
    if (trimmed.startsWith('news ')) {
      const m = trimmed.match(/^news\s+(anchor|summary|talk|简报|主播)\s+"([\s\S]*)"(?:\s+(.*))?$/);
      if (!m) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'news 语法：news anchor "..." / news summary "..."' }); continue; }
      const kind = m[1];
      const mode = (kind === 'summary' || kind === '简报') ? 'newsSummary' : 'newsTalk';
      makeSpecialText(mode, unquote(`"${m[2]}"`, diagnostics, lineNo), lineNo, 'news', true, m[3] || '');
      continue;
    }
    if (trimmed.startsWith('location ')) {
      const lm = trimmed.match(/^location\s+"([\s\S]*?)"(?:\s+(.*))?$/);
      if (!lm) { diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'location 语法：location "地点" hold 2.6（hold 必填）' }); continue; }
      const flags = lm[2] || '';
      const holdM = flags.match(/\bhold\s+([\d.]+)s?/);
      if (!holdM) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'location 缺少 hold：停留时长必须写在剧本里，例如 hold 2.6' });
        continue;
      }
      const line = baseLine('location', lineNo);
      if (nextPresetFields?._presetType === 'location') {
        const { _presetType, mode: _presetMode, ...fields } = nextPresetFields;
        Object.assign(line, fields);
        nextPresetFields = null;
      }
      line.text = lm[1].replace(/\n/g, '\n');
      line.hold = Number(holdM[1]);
      const mods = parseKeyValueTokens(flags);
      for (const key of ['uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity']) {
        if (mods[key] !== undefined && Number.isFinite(mods[key])) line[key] = mods[key];
      }
      emit(line, lineNo);
      continue;
    }
    if (trimmed.startsWith('narration ')) {
      const text = unquote(trimmed.slice(10), diagnostics, lineNo);
      makeDialogue(null, 'narration', text, '', lineNo);
      continue;
    }
    const cloudOnly = trimmed.match(/^cloud\s+"((?:[^"\\]|\\.)*)"(?:\s+(.*))?$/);
    if (cloudOnly) {
      makeDialogue(null, 'cloud', cloudOnly[1].replace(/\\n/g, '\n'), cloudOnly[2] || '', lineNo);
      continue;
    }
    const sfxOnly = trimmed.match(/^sfx\s+"((?:[^"\\]|\\.)*)"(?:\s+(.*))?$/);
    if (sfxOnly) {
      makeDialogue(null, 'sfx', unquote(`"${sfxOnly[1]}"`, diagnostics, lineNo), sfxOnly[2] || '', lineNo);
      continue;
    }
    if (trimmed.startsWith('fullscreen ')) {
      const match = trimmed.match(/^fullscreen\s+"([\s\S]*)"(?:\s+(.*))?$/);
      if (!match) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: 'fullscreen 语法：fullscreen "全屏文字" [fontSize 56 textColor "#ffffff"]' });
        continue;
      }
      const text = unquote(`"${match[1]}"`, diagnostics, lineNo);
      makeSpecialText('fullscreen', text, lineNo, 'fullscreen', true, match?.[2] || '');
      continue;
    }
    if (trimmed.startsWith('audio ')) {
      const item = parseAudioCommand(trimmed, lineNo);
      if (item) pendingAudio.push(item);
      continue;
    }

    // Character dialogue: <speaker> [mode] "text" [modifiers]
    const dm = trimmed.match(/^([A-Za-z_][\w.-]*)(?:\s+(\w+))?\s+"((?:[^"\\]|\\.)*)"(?:\s+(.*))?$/);
    if (dm) {
      const speaker = dm[1];
      const modeToken = dm[2] || 'normal';
      if (explicitAssets && !cast[speaker]) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `角色未引用：${speaker}` });
        continue;
      }
      if (!MODE_ALIASES[modeToken] && !['press','news'].includes(modeToken)) {
        diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `未知模式：${modeToken}` });
        continue;
      }
      // If a second token wasn't a mode, treat it as part of the text? Keep strict.
      makeDialogue(speaker, modeToken, unquote(`"${dm[3]}"`, diagnostics, lineNo), dm[4] || '', lineNo);
      continue;
    }
    diagnostics.push({ line: lineNo, column: 1, severity: 'error', message: `无法识别的语句：${trimmed.slice(0, 80)}` });
  }

  while (conditionalBlocks.length) {
    flushStageOps(lines.length);
    const block = conditionalBlocks.pop();
    if (block.elseJump) block.elseJump.target = emittedLineCount;
    if (block.condition.falseTarget == null) block.condition.falseTarget = emittedLineCount;
  }

  // Resolve labels and jump/branch targets.
  const lineNodes = nodes.filter(n => n.kind === 'line');
  const resolved = lineNodes.map(n => n.line);
  for (let i = 0; i < resolved.length; i++) {
    const line = resolved[i];
    if (line.mode === 'jump') {
      const target = labels.get(line.targetLabel);
      if (target == null) diagnostics.push({ line: lineNodes[i].lineNo, column: 1, severity: 'error', message: `jump 标签不存在：${line.targetLabel}` });
      else line.target = target;
      delete line.targetLabel;
      line.hold = 0;
    }
    if (line.mode === 'branch') {
      for (const opt of line.options || []) {
        const target = labels.get(opt.targetLabel);
        if (target == null) diagnostics.push({ line: lineNodes[i].lineNo, column: 1, severity: 'error', message: `分支标签不存在：${opt.targetLabel}` });
        else opt.next = target;
        delete opt.targetLabel;
      }
    }
  }

  diagnostics.push(...diagnoseUi(resolved));
  const story = {
    meta: {
      title: titleText,
      chapterNo,
      engine: '0.1.0',
      schemaVersion: 1,
    },
    variables: { ...variableDefaults },
    images,
    spines,
    lines: resolved,
  };
  return { story, diagnostics, labels: Object.fromEntries(labels) };
}

module.exports = { compile, BUILTIN_CAST };

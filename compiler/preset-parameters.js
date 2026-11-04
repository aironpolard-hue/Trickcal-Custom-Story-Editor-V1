'use strict';

const numeric = new Set([
  'uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity', 'bubbleWidth', 'bubbleMinHeight',
  'bubbleMaxHeight', 'bubblePaddingY', 'textWidth', 'textOffsetX', 'textOffsetY',
  'fontSize', 'typeSpeed', 'speed', 'punctuationPause', 'shadowX', 'shadowY', 'shadowAlpha',
  'hold', 'entryDuration',
]);
const colors = new Set(['shadowColor', 'textColor', 'avatarBg']);
const choices = {
  enter: ['default', 'none'],
  exit: ['default', 'none'],
  cinema: ['true', 'false'],
  kind: ['fadeblack', 'fadeinblack', 'fadeoutblack', 'fadeinwhite', 'fadeoutwhite', 'circle', 'rightpush', 'colorbars'],
  tail: ['bl', 'br', 'tl', 'tr'],
  purple: ['true', 'false'],
  overflow: ['grow', 'shrink', 'scroll', 'clip'],
};

function resolvePresetReference(text, presets) {
  const input = text.trim();
  let name, rest;
  if (input.startsWith('"')) {
    const match = /^("(?:[^"\\]|\\.)*")(?:\s+|$)/.exec(input);
    if (!match) throw new Error('预设名称的双引号不完整。');
    try { name = JSON.parse(match[1]); } catch { throw new Error('预设名称的转义无效。'); }
    rest = input.slice(match[0].length).trim();
  } else {
    name = [...presets.keys()].filter(key => input === key || input.startsWith(key + ' '))
      .sort((a, b) => b.length - a.length)[0];
    if (!name) throw new Error(`找不到预设：${input.split(/\s+/)[0] || '缺少名称'}`);
    rest = input.slice(name.length).trim();
  }
  const preset = presets.get(name);
  if (!preset) throw new Error(`找不到预设：${name}`);
  return { preset, name, rest };
}

function parsePresetStatement(text, presets) {
  const { preset, name, rest } = resolvePresetReference(text, presets);
  const tokens = rest.match(/"(?:[^"\\]|\\.)*"|\S+/g) || [];
  if (tokens.length % 2) throw new Error(`预设参数缺少数值：${tokens[tokens.length - 1]}`);
  const overrides = {};
  for (let i = 0; i < tokens.length; i += 2) {
    const key = tokens[i];
    let value = tokens[i + 1];
    if (preset.type === 'news' || preset.type === 'fullscreen') {
      const allowed = ['uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity', 'textOffsetX', 'textOffsetY',
        'fontSize', 'typeSpeed', 'speed', 'punctuationPause', 'textColor', 'exit'];
      if (preset.type === 'news') allowed.push('enter', 'entryDuration', 'shadowX', 'shadowY', 'shadowColor', 'shadowAlpha');
      if (!allowed.includes(key)) throw new Error(`${preset.type === 'news' ? '新闻框' : '全屏文字'}预设不支持参数：${key}`);
    } else if (preset.type === 'transition') {
      if (!['kind', 'hold'].includes(key)) throw new Error(`转场预设不支持参数：${key}`);
    } else if (preset.type === 'opening' || preset.type === 'location') {
      const allowed = ['uiX', 'uiY', 'uiScale', 'uiRot', 'uiOpacity'];
      if (preset.type === 'opening') allowed.push('cinema');
      if (!allowed.includes(key)) throw new Error(`${preset.type === 'opening' ? '章节开场' : '地点标识'}预设不支持参数：${key}`);
    } else if (key === 'entryDuration') throw new Error('entryDuration 目前仅适用于新闻框预设。');
    else if (key === 'cinema') throw new Error('cinema 仅适用于章节开场预设。');
    else if (key === 'kind') throw new Error('kind 仅适用于转场预设。');
    if (Object.hasOwn(overrides, key)) throw new Error(`预设参数重复：${key}`);
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { throw new Error(`预设参数引号无效：${key}`); }
    }
    if (numeric.has(key)) {
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) throw new Error(`预设参数 ${key} 必须是数字。`);
      value = Number(value);
      if (!Number.isFinite(value)) throw new Error(`预设参数 ${key} 必须是有限数字。`);
      if (['uiScale', 'bubbleWidth', 'bubbleMinHeight', 'bubbleMaxHeight', 'textWidth', 'fontSize', 'typeSpeed', 'speed', 'entryDuration'].includes(key) && value <= 0) throw new Error(`预设参数 ${key} 必须大于零。`);
      if (key === 'punctuationPause' && value < 0) throw new Error('标点停顿不能小于零。');
      if (key === 'bubblePaddingY' && value < 0) throw new Error('气泡内边距不能小于零。');
      if (key === 'hold' && value < 0) throw new Error('停留时间不能小于零。');
      if (['shadowAlpha', 'uiOpacity'].includes(key) && (value < 0 || value > 1)) throw new Error(`预设参数 ${key} 必须在 0 到 1 之间。`);
      if (key === 'hold' && preset.type === 'transition' && value < 0.2) throw new Error('转场时长必须至少为 0.2 秒。');
    } else if (colors.has(key)) {
      if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`预设参数 ${key} 应为双引号中的六位颜色，如 "#663399"。`);
    } else if (choices[key]) {
      if (key === 'tail') value = ({ 左下: 'bl', 右下: 'br', 左上: 'tl', 右上: 'tr' })[value] || value;
      if (!choices[key].includes(value)) throw new Error(`预设参数 ${key} 的值无效。`);
      if (key === 'purple' || key === 'cinema') value = value === 'true';
    } else throw new Error(`不支持的预设参数：${key}`);
    overrides[key] = value;
  }
  const fields = { ...(preset.fields || {}), ...overrides };
  if (preset.type === 'opening' && fields.cinema != null && typeof fields.cinema !== 'boolean') throw new Error('电影边框 cinema 必须为 true 或 false。');
  if (preset.type === 'transition' && fields.kind != null && !choices.kind.includes(fields.kind)) throw new Error('不支持的转场类型。');
  if (preset.type === 'transition' && fields.hold != null && (!Number.isFinite(Number(fields.hold)) || Number(fields.hold) < 0.2)) throw new Error('转场时长必须至少为 0.2 秒。');
  if (preset.type === 'news' && fields.entryDuration != null && (typeof fields.entryDuration !== 'number' || !Number.isFinite(fields.entryDuration) || fields.entryDuration <= 0)) throw new Error('新闻框入场时长必须是大于零的有限数字。');
  if (fields.speed != null && (!Number.isFinite(Number(fields.speed)) || Number(fields.speed) <= 0)) throw new Error('逐字间隔必须是大于零的数字。');
  if (fields.punctuationPause != null && (!Number.isFinite(Number(fields.punctuationPause)) || Number(fields.punctuationPause) < 0)) throw new Error('标点停顿必须是大于或等于零的数字。');
  if (preset.type === 'bubble' && fields.overflow != null && !choices.overflow.includes(fields.overflow)) throw new Error('气泡溢出方式必须是 grow、shrink、scroll 或 clip。');
  return { preset, name, overrides };
}

module.exports = { parsePresetStatement, resolvePresetReference };

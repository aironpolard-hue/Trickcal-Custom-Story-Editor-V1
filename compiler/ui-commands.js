'use strict';

function tokenize(input) {
  const tokens = [];
  const re = /\s*("(?:[^"\\]|\\.)*"|[^\s"]+)\s*/gy;
  let pos = 0;
  while (pos < input.length) {
    re.lastIndex = pos;
    const match = re.exec(input);
    if (!match || match.index !== pos) throw new Error('无法解析 UI 语句中的引号或参数。');
    const raw = match[1];
    let value = raw;
    if (raw.startsWith('"')) {
      try { value = JSON.parse(raw); } catch { throw new Error('UI 文本的转义或引号无效。'); }
    }
    tokens.push({ value, quoted: raw.startsWith('"') });
    pos = re.lastIndex;
  }
  return tokens;
}

function parseUiCommand(input, presets = new Map()) {
  const tokens = tokenize(input.trim());
  const values = tokens.map(t => t.value);
  const name = value => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value || '');
  const scalar = value => {
    if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value || '')) throw new Error(`无效数字：${value || '缺少值'}`);
    const result = Number(value);
    if (!Number.isFinite(result)) throw new Error('数字必须是有限值。');
    return result;
  };
  const pair = value => {
    const parts = String(value || '').split(',');
    if (parts.length !== 2) throw new Error('坐标和尺寸应写成 x,y。');
    return parts.map(scalar);
  };
  if (values[0] !== 'ui') throw new Error('UI 语句应以 ui 开头。');
  const command = values[1];
  if (command === 'present' && values.length === 2) return { type: 'present' };
  if (command === 'remove' && values.length === 3 && name(values[2])) {
    return { type: 'operation', operation: { type: 'remove', id: values[2] } };
  }
  if (command === 'write' && values.length === 4 && name(values[2]) && tokens[3].quoted) {
    return { type: 'operation', operation: { type: 'set', id: values[2], values: { text: values[3] } } };
  }
  if (command === 'bind' && values.length === 7 && name(values[2]) && values[3] === 'to' && name(values[4]) && values[5] === 'offset') {
    const [x, y] = pair(values[6]);
    return { type: 'operation', operation: { type: 'bind', id: values[2], parent: values[4], x, y } };
  }
  if (command === 'unbind' && values.length === 5 && name(values[2]) && values[3] === 'at') {
    const [x, y] = pair(values[4]);
    return { type: 'operation', operation: { type: 'bind', id: values[2], parent: null, x, y } };
  }
  if (command === 'set' && values.length === 5 && name(values[2])) {
    const key = values[3], value = values[4], changes = {};
    if (key === 'at') [changes.x, changes.y] = pair(value);
    else if (key === 'size') [changes.width, changes.height] = pair(value);
    else if (['rot', 'alpha', 'z', 'speed', 'sx', 'sy'].includes(key)) changes[key] = scalar(value);
    else if (key === 'font') changes.fontSize = scalar(value);
    else if (key === 'color' && (/^#[0-9a-fA-F]{6}$/.test(value) || ['white', 'black'].includes(value))) changes.color = value;
    else if (key === 'overflow' && ['clip', 'grow'].includes(value)) changes.overflow = value;
    else if (key === 'maxheight') changes.maxHeight = scalar(value);
    else if (key === 'tail' && ['bl', 'br', 'tl', 'tr', 'none'].includes(value)) changes.tail = value;
    else if (key === 'style' && ['manga', 'think', 'purple', 'thought', 'normal', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx'].includes(value)) changes.style = value;
    else throw new Error(`未知 UI 属性：${key}`);
    if ((changes.width != null && changes.width <= 0) || (changes.height != null && changes.height <= 0) ||
        (changes.fontSize != null && changes.fontSize <= 0) || (changes.speed != null && changes.speed <= 0)) throw new Error('UI 尺寸、字号和速度必须大于零。');
    if (changes.alpha != null && (changes.alpha < 0 || changes.alpha > 1)) throw new Error('UI 透明度必须在 0 到 1 之间。');
    if (changes.maxHeight != null && changes.maxHeight <= 0) throw new Error('最大高度必须大于零。');
    return { type: 'operation', operation: { type: 'set', id: values[2], values: changes } };
  }
  if (command === 'show' && ['bubble', 'box', 'text'].includes(values[2]) && name(values[3])) {
    const kind = values[2];
    const frame = kind === 'bubble' || kind === 'box';
    const node = {
      id: values[3], kind, x: 960, y: 540,
      width: kind === 'bubble' ? 760 : kind === 'box' ? 1200 : 580,
      height: kind === 'bubble' ? 320 : kind === 'box' ? 260 : 220,
      ...(kind === 'bubble' ? { style: 'manga', tail: 'bl' } : kind === 'box' ? { style: 'normal' } : { fontSize: 52, speed: 1, text: '' }),
    };
    const presetIndex = values.findIndex((value, index) => index >= 4 && index % 2 === 0 && value === 'preset');
    if (presetIndex >= 0) {
      const presetName = values[presetIndex + 1];
      const preset = presets.get(presetName);
      if (!preset) throw new Error(`找不到 UI 预设：${presetName || '缺少名称'}`);
      if (preset.type !== `ui-${kind}`) throw new Error(`UI 预设类型不匹配：${presetName}`);
      const allowed = kind === 'bubble'
        ? ['width', 'height', 'style', 'tail', 'maxHeight', 'paddingY']
        : kind === 'box' ? ['width', 'height', 'style', 'maxHeight', 'paddingY']
          : ['width', 'height', 'fontSize', 'speed', 'color', 'overflow', 'maxHeight'];
      const fields = preset.fields || {};
      for (const [key, value] of Object.entries(fields)) {
        if (!allowed.includes(key)) throw new Error(`UI 预设包含不支持的字段：${key}`);
        node[key] = value;
      }
    }
    const seen = new Set();
    for (let i = 4; i < values.length; i += 2) {
      const key = values[i], value = values[i + 1];
      if (!value || seen.has(key)) throw new Error(`UI 参数缺失或重复：${key}`);
      seen.add(key);
      if (key === 'preset') continue;
      if (key === 'at') [node.x, node.y] = pair(value);
      else if (key === 'size') [node.width, node.height] = pair(value);
      else if (key === 'style' && kind === 'bubble' && ['manga', 'think', 'purple', 'thought'].includes(value)) node.style = value;
      else if (key === 'style' && kind === 'box' && ['normal', 'purple', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx'].includes(value)) node.style = value;
      else if (key === 'tail' && kind === 'bubble' && ['bl', 'br', 'tl', 'tr', 'none'].includes(value)) node.tail = value;
      else if (key === 'font' && kind === 'text') node.fontSize = scalar(value);
      else if (key === 'speed' && kind === 'text') node.speed = scalar(value);
      else if (key === 'color' && kind === 'text' && (/^#[0-9a-fA-F]{6}$/.test(value) || ['white', 'black'].includes(value))) node.color = value;
      else if (key === 'overflow' && kind === 'text' && ['clip', 'grow'].includes(value)) node.overflow = value;
      else if (key === 'grow' && frame && name(value)) node.fitText = value;
      else if (key === 'padding' && frame) node.paddingY = scalar(value);
      else if (key === 'maxheight' && (frame || kind === 'text')) node.maxHeight = scalar(value);
      else if (key === 'scale') node.sx = node.sy = scalar(value);
      else if (key === 'sx' || key === 'sy') node[key] = scalar(value);
      else if (key === 'rot') node.rot = scalar(value);
      else if (key === 'alpha') node.alpha = scalar(value);
      else if (key === 'z') node.z = scalar(value);
      else throw new Error(`未知 UI 参数：${key} ${value}`);
    }
    for (const key of ['width', 'height', 'fontSize', 'speed', 'paddingY', 'maxHeight']) {
      if (node[key] != null && (typeof node[key] !== 'number' || !Number.isFinite(node[key]))) throw new Error(`UI 预设字段不是有效数字：${key}`);
    }
    const allowedStyles = kind === 'bubble' ? ['manga', 'think', 'purple', 'thought']
      : kind === 'box' ? ['normal', 'purple', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx'] : [];
    if (frame && !allowedStyles.includes(node.style)) throw new Error(`UI 预设样式无效：${node.style}`);
    if (kind === 'bubble' && !['bl', 'br', 'tl', 'tr', 'none'].includes(node.tail)) throw new Error(`UI 预设尾巴无效：${node.tail}`);
    if (kind === 'text' && node.color != null && !(/^#[0-9a-fA-F]{6}$/.test(node.color) || ['white', 'black'].includes(node.color))) throw new Error('UI 预设颜色无效。');
    if (kind === 'text' && node.overflow != null && !['clip', 'grow'].includes(node.overflow)) throw new Error('UI 预设溢出方式无效。');
    if (node.width <= 0 || node.height <= 0 || (node.fontSize != null && node.fontSize <= 0) || (node.speed != null && node.speed <= 0)) {
      throw new Error('UI 尺寸、字号和速度必须大于零。');
    }
    if (node.alpha != null && (node.alpha < 0 || node.alpha > 1)) throw new Error('UI 透明度必须在 0 到 1 之间。');
    if (node.paddingY != null && node.paddingY < 0) throw new Error('UI 内边距不能小于零。');
    if (node.maxHeight != null && node.maxHeight < node.height) throw new Error('框体最大高度不能小于初始高度。');
    return { type: 'operation', operation: { type: 'create', node } };
  }
  throw new Error('UI 语法：ui show bubble|box 框名 / ui show text 文字名 / ui bind 子级 to 父级 offset 0,0 / ui unbind 子级 at 960,540 / ui set 名称 at 960,540 / ui write 名称 "内容" / ui present / ui remove 名称');
}

module.exports = { parseUiCommand };

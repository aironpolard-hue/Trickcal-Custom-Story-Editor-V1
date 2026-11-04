'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalMovePresets = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const eases = ['Linear', 'InSine', 'OutSine', 'InOutSine', 'InCubic', 'OutCubic', 'InOutCubic', 'OutBack', 'OutQuint'];

  function parseMoveOverrides(text, preset) {
    if (!preset || preset.type !== 'move') throw new Error('找不到动作预设或预设类型不是 move。');
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length % 2) throw new Error(`动作预设参数缺少数值：${tokens[tokens.length - 1]}`);
    const result = {};
    const isRun = (preset.fields || {}).from != null;
    for (let i = 0; i < tokens.length; i += 2) {
      const key = tokens[i], value = tokens[i + 1];
      if (Object.hasOwn(result, key)) throw new Error(`动作预设参数重复：${key}`);
      if (key === 'duration' || (!isRun && (key === 'scaleX' || key === 'scaleY'))) {
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
          throw new Error(`动作预设参数 ${key} 必须大于零。`);
        }
        result[key] = Number(value);
      } else if (key === 'ease') {
        if (!eases.includes(value)) throw new Error(`不支持的动作缓动：${value}`);
        result[key] = value;
      } else if (isRun && key === 'from') {
        if (!['left', 'right'].includes(value)) throw new Error('跑入方向必须为 left 或 right。');
        result[key] = value;
      } else throw new Error(`此动作预设不支持参数：${key}`);
    }
    return result;
  }

  function expandMovePreset(actor, position, preset, delay = 0, overrides = {}) {
    if (!preset || preset.type !== 'move') throw new Error('找不到动作预设或预设类型不是 move。');
    const fields = { ...(preset.fields || {}), ...overrides };
    const duration = Number(fields.duration ?? 1);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(delay + duration)) throw new Error('动作预设时长必须是有限的正数。');
    const ease = String(fields.ease || 'OutCubic');
    if (!eases.includes(ease)) throw new Error(`不支持的动作缓动：${ease}`);
    const action = (property, from, to) => ({ actor, property, from, to, duration, delay, ease, relative: false });
    if (fields.from != null) {
      if (!['left', 'right'].includes(fields.from)) throw new Error('跑入方向必须为 left 或 right。');
      return [action('x', fields.from === 'left' ? -320 : 2240, position.x ?? 960)];
    }
    if (fields.scaleX != null || fields.scaleY != null) {
      const values = [['sx', fields.scaleX], ['sy', fields.scaleY]];
      return values.filter(([, value]) => value != null).map(([property, value]) => {
        const multiplier = Number(value);
        if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('动作预设缩放倍率必须大于零。');
        const base = position[property] ?? 1;
        return action(property, base, base * multiplier);
      });
    }
    throw new Error('动作预设缺少方向或缩放参数。');
  }

  return { eases, parseMoveOverrides, expandMovePreset };
});

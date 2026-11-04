'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalStoryNavigation = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function findPath(lines, target) {
    if (!Array.isArray(lines) || !Number.isInteger(target) || target < 0 || target >= lines.length) {
      throw new Error(`Invalid story line: ${target}`);
    }
    const previous = new Map([[0, null]]);
    const queue = [0];
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      if (index === target) {
        const path = [];
        for (let i = index; i !== null; i = previous.get(i)) path.push(i);
        return path.reverse();
      }
      const line = lines[index] || {};
      const candidates = line.mode === 'end' ? []
        : line.mode === 'jump' || line.mode === 'branch-jump' ? [line.target]
        : line.mode === 'branch' ? (line.options || []).map(option => option.next)
        : line.mode === 'condition' ? [index + 1, line.falseTarget]
        : [index + 1];
      for (const next of candidates) {
        if (Number.isInteger(next) && next >= 0 && next < lines.length && !previous.has(next)) {
          previous.set(next, index);
          queue.push(next);
        }
      }
    }
    return null;
  }
  return { findPath };
});

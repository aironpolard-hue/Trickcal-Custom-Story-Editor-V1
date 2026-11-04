'use strict';
const assert = require('assert');
const { findPath } = require('../runtime/story-navigation');

const lines = [
  { mode: 'ui-op' },
  { mode: 'branch', options: [{ next: 2 }, { next: 4 }] },
  { mode: 'ui-op' },
  { mode: 'jump', target: 5 },
  { mode: 'ui-op' },
  { mode: 'ui-present' },
  { mode: 'end' },
  { mode: 'ui-op' },
];
assert.deepStrictEqual(findPath(lines, 4), [0, 1, 4]);
assert.deepStrictEqual(findPath(lines, 5), [0, 1, 4, 5]);
assert.strictEqual(findPath(lines, 7), null);
assert.throws(() => findPath(lines, 10), /Invalid story line/);
assert.strictEqual(findPath([{ mode: 'jump', target: 0 }, { mode: 'end' }], 1), null);
const conditional = [
  { mode: 'condition', falseTarget: 3 },
  { mode: 'stage-sync' },
  { mode: 'branch-jump', target: 4 },
  { mode: 'normal' },
  { mode: 'normal' },
];
assert.deepStrictEqual(findPath(conditional, 1), [0, 1]);
assert.deepStrictEqual(findPath(conditional, 3), [0, 3]);
assert.deepStrictEqual(findPath(conditional, 4), [0, 3, 4]);
assert.strictEqual(findPath([{ mode: 'branch-jump', target: 2 }, { mode: 'normal' }, { mode: 'end' }], 1), null);
console.log('story-navigation.test.js: ok');

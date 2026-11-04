'use strict';
const assert = require('assert');
const { multiply, localMatrix, wouldCreateCycle, resolveWorldTransforms } = require('../runtime/scene-graph');

const approx = (actual, expected) => {
  assert.strictEqual(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9, `${actual} != ${expected}`));
};

approx(localMatrix({ x: 10, y: 20, rot: 90, sx: 2, sy: 3 }), [0, 2, -3, 0, 10, 20]);
approx(multiply([1, 0, 0, 1, 10, 20], [1, 0, 0, 1, 3, 4]), [1, 0, 0, 1, 13, 24]);

const nodes = new Map([
  ['child', { parent: 'middle', x: 5, y: 0, alpha: 0.5 }],
  ['middle', { parent: 'root', x: 10, y: 0, rot: 90, alpha: 0.5 }],
  ['root', { x: 100, y: 200, sx: 2, sy: 3, visible: false }],
]);
const world = resolveWorldTransforms(nodes);
approx(world.get('child').matrix, [0, 3, -2, 0, 120, 215]);
assert.strictEqual(world.get('child').alpha, 0.25);
assert.strictEqual(world.get('child').visible, false);
assert.strictEqual(wouldCreateCycle(nodes, 'root', 'child'), true);
assert.strictEqual(wouldCreateCycle(nodes, 'child', 'root'), false);
assert.strictEqual(wouldCreateCycle(nodes, 'root', 'root'), true);
assert.throws(() => resolveWorldTransforms(new Map([['child', { parent: 'missing' }]])), /parent not found/);
assert.throws(() => resolveWorldTransforms(new Map([['a', { parent: 'b' }], ['b', { parent: 'a' }]])), /cycle/);
approx(localMatrix({ sx: 0, sy: 0 }), [0, 0, 0, 0, 0, 0]);

console.log('scene-graph.test.js: ok');

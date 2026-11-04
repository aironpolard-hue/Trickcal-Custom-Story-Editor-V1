'use strict';
const assert = require('assert');
const { applyOperations } = require('../runtime/scene-state');
const { resolveWorldTransforms } = require('../runtime/scene-graph');

const empty = new Map();
const scene = applyOperations(empty, [
  { type: 'create', node: { id: 'ner', kind: 'spine', x: 100, y: 200 } },
  { type: 'create', node: { id: 'bubble', kind: 'bubble', x: 20, y: -30 } },
  { type: 'create', node: { id: 'text', kind: 'text', x: 5, y: 4 } },
  { type: 'bind', id: 'bubble', parent: 'ner', x: 20, y: -30 },
  { type: 'bind', id: 'text', parent: 'bubble' },
]);
assert.strictEqual(empty.size, 0);
assert.strictEqual(scene.size, 3);
resolveWorldTransforms(scene).get('text').matrix.forEach((value, index) => {
  assert.ok(Math.abs(value - [1, 0, 0, 1, 125, 174][index]) < 1e-9);
});
const moved = applyOperations(scene, [{ type: 'set', id: 'ner', values: { x: 300 } }]);
assert.strictEqual(scene.get('ner').x, 100);
assert.strictEqual(resolveWorldTransforms(moved).get('text').matrix[4], 325);
assert.throws(() => applyOperations(scene, [
  { type: 'set', id: 'ner', values: { x: 400 } },
  { type: 'bind', id: 'ner', parent: 'text' },
]), /cycle/);
assert.strictEqual(scene.get('ner').x, 100);
assert.throws(() => applyOperations(scene, [{ type: 'set', id: 'text', values: { parent: 'ner' } }]), /Use bind/);
assert.throws(() => applyOperations(scene, [{ type: 'set', id: 'ner', values: { alpha: NaN } }]), /Invalid alpha/);
assert.throws(() => applyOperations(scene, [{ type: 'create', node: { id: 'ner', kind: 'spine' } }]), /already exists/);
assert.throws(() => applyOperations(scene, [{ type: 'bind', id: 'ner', parent: 'missing' }]), /parent not found/);
const external = applyOperations(new Map([['bubble', { id: 'bubble', kind: 'bubble' }]]),
  [{ type: 'bind', id: 'bubble', parent: 'actor', x: 20, y: -30 }], { externalParents: new Set(['actor']) });
assert.strictEqual(external.get('bubble').parent, 'actor');
const detached = applyOperations(scene, [{ type: 'bind', id: 'text', parent: null, x: 125, y: 174 }]);
const removed = applyOperations(detached, [{ type: 'remove', id: 'ner' }]);
assert.deepStrictEqual([...removed.keys()], ['text']);
assert.strictEqual(scene.size, 3);

console.log('scene-state.test.js: ok');

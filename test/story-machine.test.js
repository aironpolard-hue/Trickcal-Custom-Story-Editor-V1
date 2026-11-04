'use strict';
const assert = require('assert');
const { createMachine, advance } = require('../runtime/story-machine');

const program = [
  { type: 'scene', operations: [{ type: 'create', node: { id: 'base', kind: 'image', x: 10 } }] },
  { type: 'choice', options: [{ text: 'left', target: 2 }, { text: 'right', target: 4 }] },
  { type: 'scene', operations: [{ type: 'create', node: { id: 'left', kind: 'bubble' } }] },
  { type: 'jump', target: 5 },
  { type: 'scene', operations: [{ type: 'create', node: { id: 'right', kind: 'bubble' } }] },
  { type: 'present' },
  { type: 'end' },
];
const start = createMachine(program);
const choice = advance(start);
assert.strictEqual(start.scene.size, 0);
assert.strictEqual(choice.waiting.type, 'choice');
assert.throws(() => advance(choice), /choice index/);
assert.throws(() => advance(choice, 2), /choice index/);
const left = advance(choice, 0);
const right = advance(choice, 1);
assert.deepStrictEqual([...left.scene.keys()], ['base', 'left']);
assert.deepStrictEqual([...right.scene.keys()], ['base', 'right']);
assert.deepStrictEqual([...choice.scene.keys()], ['base']);
assert.strictEqual(left.waiting.type, 'present');
assert.throws(() => advance(left, 0), /does not accept/);
assert.strictEqual(advance(left).ended, true);
assert.strictEqual(advance(advance(left)).ended, true);
assert.throws(() => advance(createMachine([{ type: 'jump', target: 2 }])), /Invalid story target/);
assert.throws(() => advance(createMachine([{ type: 'jump', target: 0 }]), undefined, 10), /exceeded/);
assert.throws(() => advance(createMachine([{ type: 'choice', options: [] }])), /requires options/);

console.log('story-machine.test.js: ok');

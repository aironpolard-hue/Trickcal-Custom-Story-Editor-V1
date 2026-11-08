'use strict';

const assert = require('assert');
const path = require('path');
const { sample } = require('../runtime/stage-timeline');
const { compile } = require('../compiler/trickcal');

const initial = [{ id: 'ner', x: 100, alpha: 1, brightness: 1 }];
const actions = [
  { actor: 'ner', property: 'x', from: 0, to: 100, relative: true, delay: 0, duration: 2, ease: 'Linear', sourceLine: 2 },
  { actor: 'ner', property: 'alpha', from: 1, to: 0, relative: false, delay: 0, duration: 2, ease: 'Linear', sourceLine: 3 },
];
const events = [
  { type: 'stage', action: 'show', conf: { id: 'picture', kind: 'image', x: 500 }, delay: 1, sourceLine: 4 },
  { type: 'actor', actor: 'ner', patch: { anim: 'Happy_1' }, delay: 1.5, sourceLine: 5 },
];
const early = sample(initial, events, actions, 0.5);
assert.deepStrictEqual({ x: early.get('ner').x, alpha: early.get('ner').alpha, picture: early.has('picture') },
  { x: 125, alpha: 0.75, picture: false });
assert.deepStrictEqual(initial, [{ id: 'ner', x: 100, alpha: 1, brightness: 1 }], 'sampling must not mutate the input');
const completed = sample(initial, events, actions, 2);
assert.deepStrictEqual({ x: completed.get('ner').x, alpha: completed.get('ner').alpha,
  anim: completed.get('ner').anim, picture: completed.get('picture').x },
{ x: 200, alpha: 0, anim: 'Happy_1', picture: 500 });

const ordered = sample(initial, [
  { type: 'stage', action: 'hide', id: 'ner', delay: 1, sourceLine: 6 },
  { type: 'stage', action: 'show', conf: { id: 'ner', x: 300 }, delay: 1.5, sourceLine: 7 },
], [
  ...actions,
  { actor: 'ner', property: 'x', from: 0, to: 40, relative: true, delay: 1.5, duration: 1, ease: 'Linear', sourceLine: 8 },
], 2);
assert.strictEqual(ordered.get('ner').x, 320, 'show resets actions from the prior appearance');
assert.ok(!sample(initial, [{ type: 'stage', action: 'hide', id: 'ner', delay: 1 }], actions, 1.25).has('ner'));
const bindings = [
  { type: 'stage', action: 'show', conf: { id: 'picture', kind: 'image', x: 500, alpha: 1 }, delay: 0.2, sourceLine: 1 },
  { type: 'bind', child: 'picture', binding: { parent: 'ner', localX: 20, localY: -30 }, delay: 0.4, sourceLine: 2 },
  { type: 'bind', child: 'picture', binding: { parent: null, localX: 0, localY: 0, x: 400, y: 500 }, delay: 1, sourceLine: 4 },
];
assert.deepStrictEqual(
  { ...sample(initial, bindings, [], 0.5).get('picture') },
  { id: 'picture', kind: 'image', x: 500, alpha: 1, parent: 'ner', localX: 20, localY: -30 });
assert.deepStrictEqual(
  { ...sample(initial, bindings, [], 1).get('picture') },
  { id: 'picture', kind: 'image', x: 400, y: 500, alpha: 1, parent: null, localX: 0, localY: 0 });
assert.strictEqual(sample(initial, [], [
  { actor: 'ner', property: 'x', from: 100, to: 200, delay: 0, duration: 1, ease: 'Linear', sourceLine: 1 },
  { actor: 'ner', property: 'x', from: 400, to: 600, delay: 0.5, duration: 1, ease: 'Linear', sourceLine: 2 },
  { actor: 'ner', property: 'x', from: 0, to: 40, relative: true, delay: 0, duration: 1, ease: 'Linear', sourceLine: 3 },
], 0.75).get('ner').x, 480);

const compiled = compile([
  'show ner at 100,200',
  'parallel:',
  '  move ner x by 100 in 2s ease Linear',
  '  after 1s:',
  '    show erpin at 500,900',
  '  ner normal "测试"',
  'ner normal "下一句"',
].join('\n'));
assert.deepStrictEqual(compiled.diagnostics, []);
const first = compiled.story.lines[0], next = compiled.story.lines[1];
assert.deepStrictEqual([...sample(first.stage, first.events, first.actions, first.timelineEnd).values()], next.stage);
assert.strictEqual(sample(first.stage, first.events, first.actions, 0.5).get('ner').x, 125);
assert.ok(!sample(first.stage, first.events, first.actions, 0.5).has('erpin'));
const axisScaling = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'image sign = "assets/bg/elf_city_night.png"',
  'show ner at 960,540 scale 1',
  'show image sign as poster at 960,540 scale 1',
  'parallel:',
  '  move ner scaleX 1 -> 1.5 in 1s ease Linear',
  '  move ner scaleY 1 -> 0.75 in 1s ease Linear',
  '  move poster scaleX 1 -> 2 in 1s ease Linear',
  '  move poster scaleY 1 -> 0.5 in 1s ease Linear',
  '  wait 1s',
].join('\n'), { projectRoot: path.resolve(__dirname, '../templates/minimal-demo') });
assert.deepStrictEqual(axisScaling.diagnostics, []);
const scaledStage = sample(axisScaling.story.lines[0].stage, axisScaling.story.lines[0].events,
  axisScaling.story.lines[0].actions, 0.5);
assert.deepStrictEqual([scaledStage.get('ner').sx, scaledStage.get('ner').sy,
  scaledStage.get('poster').sx, scaledStage.get('poster').sy], [1.25, 0.875, 1.5, 0.75]);
console.log('stage-timeline.test.js: ok');

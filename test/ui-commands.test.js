'use strict';
const assert = require('assert');
const { parseUiCommand } = require('../compiler/ui-commands');
const { compile } = require('../compiler/trickcal');

const bubble = parseUiCommand('ui show bubble speech at 100,200 size 760,320 style thought tail tr');
assert.deepStrictEqual(bubble.operation.node, { id: 'speech', kind: 'bubble', x: 100, y: 200, width: 760, height: 320, style: 'thought', tail: 'tr' });
const text = parseUiCommand('ui show text caption at 0,0 size 580,200 font 48 speed 2');
assert.strictEqual(text.operation.node.fontSize, 48);
assert.strictEqual(parseUiCommand('ui show text caption color "#ffffff"').operation.node.color, '#ffffff');
assert.strictEqual(parseUiCommand('ui show text caption overflow grow maxheight 500').operation.node.overflow, 'grow');
assert.throws(() => parseUiCommand('ui show text caption overflow scroll'), /未知/);
assert.strictEqual(parseUiCommand('ui show box thought style monologueThought').operation.node.style, 'monologueThought');
assert.strictEqual(parseUiCommand('ui show box effect style sfx').operation.node.kind, 'box');
assert.strictEqual(parseUiCommand('ui show bubble speech scale 2').operation.node.sy, 2);
const presets = new Map([['小气泡', { type: 'ui-bubble', fields: { width: 500, height: 200, style: 'thought', tail: 'bl' } }]]);
assert.strictEqual(parseUiCommand('ui show bubble speech preset "小气泡" size 600,250', presets).operation.node.width, 600);
assert.throws(() => parseUiCommand('ui show text caption preset "小气泡"', presets), /类型不匹配/);
assert.throws(() => parseUiCommand('ui show bubble speech preset missing', presets), /找不到/);
assert.throws(() => parseUiCommand('ui show box bad style manga'), /未知/);
assert.deepStrictEqual(parseUiCommand('ui bind caption to speech offset 0,-5').operation, { type: 'bind', id: 'caption', parent: 'speech', x: 0, y: -5 });
assert.deepStrictEqual(parseUiCommand('ui unbind caption at 400,300').operation, { type: 'bind', id: 'caption', parent: null, x: 400, y: 300 });
assert.deepStrictEqual(parseUiCommand('ui set speech size 800,400').operation.values, { width: 800, height: 400 });
assert.strictEqual(parseUiCommand('ui show bubble speech grow caption padding 120 maxheight 600').operation.node.fitText, 'caption');
assert.strictEqual(parseUiCommand('ui write caption "第一行\\n第二行"').operation.values.text, '第一行\n第二行');
assert.throws(() => parseUiCommand('ui show bubble x size -1,2'), /大于零/);
assert.throws(() => parseUiCommand('ui show text x font nope'), /无效数字/);
assert.throws(() => parseUiCommand('ui show bubble x style unknown'), /未知/);
assert.throws(() => parseUiCommand('ui show bubble x size 760,400 maxheight 300'), /最大高度/);
assert.throws(() => parseUiCommand('ui write caption "unfinished'), /引号/);
const result = compile('ui show bubble speech\nui show text caption\nui bind caption to speech offset 0,0\nui write caption "你好"\nui present\nui remove speech', {});
assert.deepStrictEqual(result.diagnostics, []);
assert.deepStrictEqual(result.story.lines.map(line => line.mode), ['ui-op', 'ui-op', 'ui-op', 'ui-op', 'ui-present', 'ui-op']);
assert.ok(compile('ui show text words size broken', {}).diagnostics.some(d => d.severity === 'error'));
const parallel = compile('show ner\nparallel:\n  ui present\n  move ner x 100 -> 300 in 1s', {});
assert.deepStrictEqual(parallel.diagnostics, []);
assert.strictEqual(parallel.story.lines[0].mode, 'ui-present');
assert.strictEqual(parallel.story.lines[0].actions[0].actor, 'ner');
const parallelUi = compile('ui show bubble speech\nparallel:\n  ui present\n  ui move speech x 100 -> 300 in 1s', {});
assert.deepStrictEqual(parallelUi.diagnostics, []);
assert.strictEqual(parallelUi.story.lines[1].actions[0].targetKind, 'ui');
const automaticUi = compile('ui show bubble speech\nparallel:\n  after 0.2s:\n    ui move speech x 100 -> 300 in 1s\nnarration "next"', {});
assert.deepStrictEqual(automaticUi.diagnostics, []);
assert.strictEqual(automaticUi.story.lines[1].mode, 'wait');
assert.strictEqual(automaticUi.story.lines[1].timelineEnd, 1.2);
assert.ok(compile('parallel:\n  ui move missing x 1 -> 2 in 1s', {}).diagnostics.some(d => d.message.includes('未创建')));
const dialogueUi = compile('ui show bubble speech\nparallel:\n  say ner normal "test"\n  ui move speech x 1 -> 2 in 1s', {});
assert.deepStrictEqual(dialogueUi.diagnostics, []);
assert.strictEqual(dialogueUi.story.lines[1].actions[0].targetKind, 'ui');
const persisted = compile('show ner at 100,200\nparallel:\n  ui present\n  move ner x 100 -> 300 in 1s\n  move ner x by 20 in 1s\nnarration "next"', {});
assert.deepStrictEqual(persisted.diagnostics, []);
assert.strictEqual(persisted.story.lines[0].stage[0].x, 100);
assert.strictEqual(persisted.story.lines[1].stage[0].x, 320);
assert.ok(compile('parallel:\n  ui present\n  move missing x 0 -> 2 in 1s', {}).diagnostics.some(d => d.message.includes('不在舞台')));
assert.ok(compile('parallel:\n  ui present\n  ui present', {}).diagnostics.some(d => d.severity === 'error'));
const timedUi = compile([
  'parallel:',
  '  after 300ms:',
  '    ui write words "你好"',
  '  after 100ms:',
  '    ui show text words',
  '  ui present',
  'narration "继续"',
].join('\n'), {});
assert.deepStrictEqual(timedUi.diagnostics, []);
assert.deepStrictEqual(timedUi.story.lines[0].events.map(event =>
  [event.type, event.operation.type, event.delay, event.sourceLine]),
[['ui', 'create', 0.1, 5], ['ui', 'set', 0.3, 3]]);
assert.strictEqual(timedUi.story.lines[0].timelineEnd, 0.3);
const mixedUi = compile('parallel:\n  ui show bubble x\n  ui move x x by 10 in 1s\n  ui set x alpha 0.5', {});
assert.deepStrictEqual(mixedUi.diagnostics, []);
assert.deepStrictEqual(mixedUi.story.lines[0].events.map(event => event.operation.type), ['create', 'set']);
assert.strictEqual(mixedUi.story.lines[0].actions[0].targetKind, 'ui');
assert.ok(compile('parallel:\n  after 1s:\n    ui present', {})
  .diagnostics.some(d => d.message.includes('不能放在 after')));

console.log('ui-commands.test.js: ok');

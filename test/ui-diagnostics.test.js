'use strict';

const assert = require('assert');
const { compile } = require('../compiler/trickcal');

const errors = source => compile(source).diagnostics.filter(item => item.severity === 'error');
const expectError = (source, message, line) => {
  const found = errors(source).find(item => item.message.includes(message));
  assert.ok(found, JSON.stringify(errors(source)));
  assert.strictEqual(found.line, line);
};

expectError('ui write missing "你好"\nui present', '未创建：missing', 1);
expectError('ui show bubble frame\nui write frame "你好"\nui present', '只能用于打字机', 2);
expectError('ui show text words\nui set words tail bl\nui present', '尾巴只能用于气泡', 2);
expectError('ui show box frame\nui set frame style manga\nui present', '不支持该样式', 2);
expectError('ui show bubble frame\nui bind frame to missing offset 0,0\nui present', '父级未创建', 2);
expectError('ui show bubble frame\nui bind frame to frame offset 0,0\nui present', '绑定到自身', 2);
expectError('parallel:\n  ui present\n  ui move missing x 0 -> 10 in 1s', '未创建：missing', 3);
expectError('parallel:\n  after 1s:\n    ui write missing "错误"', '未创建：missing', 3);
expectError('parallel:\n  ui show bubble frame\n  ui write frame "错误"', '只能用于打字机', 3);
assert.deepStrictEqual(errors([
  'parallel:',
  '  after 100ms:',
  '    show ner',
  '    ui show bubble frame',
  '    ui bind frame to ner offset 0,0',
].join('\n')), []);
expectError([
  'parallel:',
  '  after 100ms:',
  '    show ner',
  '    ui show bubble ner',
].join('\n'), '与舞台对象重复', 4);
expectError('show ner\nui show bubble ner\nui present', '与舞台对象重复', 2);
assert.deepStrictEqual(errors('show ner\nui show bubble frame\nui bind frame to ner offset 0,0\nui present'), []);
assert.deepStrictEqual(errors([
  'choice "选择"',
  '  "气泡" -> bubble',
  '  "文字" -> text',
  'label bubble:',
  '  ui show bubble item',
  '  jump shared',
  'label text:',
  '  ui show text item',
  'label shared:',
  '  ui write item "可能是文字"',
  '  ui present',
  '  end',
].join('\n')), []);
assert.deepStrictEqual(errors('narration "结束"\nend\nui write missing "不可达"'), []);
expectError('ui write missing "错误"\nend\nui show text missing', '未创建：missing', 1);
assert.deepStrictEqual(errors([
  'ui show text words',
  'label again:',
  'ui write words "循环"',
  'ui present',
  'jump again',
].join('\n')), []);
console.log('ui-diagnostics.test.js: ok');

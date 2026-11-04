'use strict';
const assert = require('assert');
const expressions = require('../runtime/expressions');

const variables = { trust: 2, name: '内尔', ready: true };
assert.strictEqual(expressions.evaluate(expressions.parse('trust >= 2 and ready'), variables), true);
assert.strictEqual(expressions.evaluate(expressions.parse('name == "内尔"'), variables), true);
assert.strictEqual(expressions.evaluate(expressions.parse('(trust + 3) * 2'), variables), 10);
assert.deepStrictEqual([...expressions.identifiers(expressions.parse('trust >= 2 or ready'))].sort(), ['ready', 'trust']);
assert.throws(() => expressions.evaluate(expressions.parse('trust + name'), variables), /只支持数值/);
assert.throws(() => expressions.parse('unknown @ 1'), /无法识别/);
console.log('expressions.test.js: ok');

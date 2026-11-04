'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalExpressions = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function tokenize(source) {
    const text = String(source || '');
    const tokens = [];
    let index = 0;
    while (index < text.length) {
      if (/\s/.test(text[index])) { index++; continue; }
      const rest = text.slice(index);
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
      if (number) {
        const value = Number(number[0]);
        if (!Number.isFinite(value)) throw new Error('数字必须是有限值。');
        tokens.push({ type: 'literal', value });
        index += number[0].length;
        continue;
      }
      const string = /^"(?:[^"\\]|\\.)*"/.exec(rest);
      if (string) {
        try { tokens.push({ type: 'literal', value: JSON.parse(string[0]) }); }
        catch { throw new Error('字符串格式无效。'); }
        index += string[0].length;
        continue;
      }
      const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      if (identifier) {
        const word = identifier[0];
        if (word === 'true' || word === 'false') tokens.push({ type: 'literal', value: word === 'true' });
        else if (word === 'and' || word === 'or' || word === 'not') tokens.push({ type: 'operator', value: word });
        else tokens.push({ type: 'variable', value: word });
        index += word.length;
        continue;
      }
      const operator = /^(?:==|!=|<=|>=|&&|\|\||[()+\-*/%!<>])/.exec(rest);
      if (operator) {
        const value = operator[0] === '&&' ? 'and' : operator[0] === '||' ? 'or' : operator[0] === '!' ? 'not' : operator[0];
        tokens.push({ type: value === '(' || value === ')' ? 'paren' : 'operator', value });
        index += operator[0].length;
        continue;
      }
      throw new Error(`表达式中有无法识别的内容：${rest.slice(0, 16)}`);
    }
    tokens.push({ type: 'eof', value: '' });
    return tokens;
  }

  function parse(source) {
    const tokens = tokenize(source);
    let position = 0;
    const peek = () => tokens[position];
    const take = value => {
      if (peek().value !== value) return false;
      position++;
      return true;
    };
    const requireValue = value => {
      if (!take(value)) throw new Error(`表达式缺少「${value}」。`);
    };
    const binary = (next, operators) => {
      let left = next();
      while (operators.includes(peek().value)) {
        const operator = tokens[position++].value;
        left = { type: 'binary', operator, left, right: next() };
      }
      return left;
    };
    const primary = () => {
      const token = peek();
      if (token.type === 'literal') { position++; return { type: 'literal', value: token.value }; }
      if (token.type === 'variable') { position++; return { type: 'variable', name: token.value }; }
      if (take('(')) {
        const value = or();
        requireValue(')');
        return value;
      }
      throw new Error('表达式需要变量、数值、布尔值、字符串或括号表达式。');
    };
    const unary = () => {
      if (['not', '!', '+', '-'].includes(peek().value)) {
        const operator = tokens[position++].value;
        return { type: 'unary', operator, value: unary() };
      }
      return primary();
    };
    const multiplicative = () => binary(unary, ['*', '/', '%']);
    const additive = () => binary(multiplicative, ['+', '-']);
    const comparison = () => binary(additive, ['<', '<=', '>', '>=']);
    const equality = () => binary(comparison, ['==', '!=']);
    const and = () => binary(equality, ['and']);
    const or = () => binary(and, ['or']);
    const expression = or();
    if (peek().type !== 'eof') throw new Error(`表达式后有多余内容：${peek().value}`);
    return expression;
  }

  function identifiers(expression, result = new Set()) {
    if (!expression || typeof expression !== 'object') return result;
    if (expression.type === 'variable') result.add(expression.name);
    if (expression.left) identifiers(expression.left, result);
    if (expression.right) identifiers(expression.right, result);
    if (expression.value && typeof expression.value === 'object') identifiers(expression.value, result);
    return result;
  }

  function evaluate(expression, variables = {}) {
    if (expression.type === 'literal') return expression.value;
    if (expression.type === 'variable') {
      if (!Object.prototype.hasOwnProperty.call(variables, expression.name)) throw new Error(`变量尚未初始化：${expression.name}`);
      return variables[expression.name];
    }
    if (expression.type === 'unary') {
      const value = evaluate(expression.value, variables);
      if (expression.operator === 'not') {
        if (typeof value !== 'boolean') throw new Error('not 只能作用于布尔值。');
        return !value;
      }
      if (typeof value !== 'number') throw new Error(`运算符 ${expression.operator} 需要数值。`);
      return expression.operator === '-' ? -value : value;
    }
    if (expression.type !== 'binary') throw new Error('表达式结构无效。');
    const left = evaluate(expression.left, variables);
    if (expression.operator === 'and' || expression.operator === 'or') {
      if (typeof left !== 'boolean') throw new Error(`运算符 ${expression.operator} 需要布尔值。`);
      if (expression.operator === 'and' && !left) return false;
      if (expression.operator === 'or' && left) return true;
      const right = evaluate(expression.right, variables);
      if (typeof right !== 'boolean') throw new Error(`运算符 ${expression.operator} 需要布尔值。`);
      return right;
    }
    const right = evaluate(expression.right, variables);
    let result;
    switch (expression.operator) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': case '<=': case '>': case '>=':
        if (typeof left !== typeof right || !['number', 'string'].includes(typeof left)) {
          throw new Error(`运算符 ${expression.operator} 两侧必须是同类型数值或字符串。`);
        }
        if (expression.operator === '<') return left < right;
        if (expression.operator === '<=') return left <= right;
        if (expression.operator === '>') return left > right;
        return left >= right;
      case '+':
        if (typeof left !== 'number' || typeof right !== 'number') throw new Error('加减乘除只支持数值。');
        result = left + right; break;
      case '-':
        if (typeof left !== 'number' || typeof right !== 'number') throw new Error('加减乘除只支持数值。');
        result = left - right; break;
      case '*':
        if (typeof left !== 'number' || typeof right !== 'number') throw new Error('加减乘除只支持数值。');
        result = left * right; break;
      case '/':
        if (typeof left !== 'number' || typeof right !== 'number' || right === 0) throw new Error('除法需要数值且除数不能为零。');
        result = left / right; break;
      case '%':
        if (typeof left !== 'number' || typeof right !== 'number' || right === 0) throw new Error('取余需要数值且除数不能为零。');
        result = left % right; break;
      default: throw new Error(`不支持的运算符：${expression.operator}`);
    }
    if (!Number.isFinite(result)) throw new Error('计算结果不是有限数值。');
    return result;
  }

  function inferType(expression, variables = {}) {
    if (expression.type === 'literal') return typeof expression.value;
    if (expression.type === 'variable') {
      if (!Object.prototype.hasOwnProperty.call(variables, expression.name)) throw new Error(`变量尚未初始化：${expression.name}`);
      return typeof variables[expression.name];
    }
    if (expression.type === 'unary') {
      const type = inferType(expression.value, variables);
      if (expression.operator === 'not') {
        if (type !== 'boolean') throw new Error('not 只能作用于布尔值。');
        return 'boolean';
      }
      if (type !== 'number') throw new Error(`运算符 ${expression.operator} 需要数值。`);
      return 'number';
    }
    if (expression.type !== 'binary') throw new Error('表达式结构无效。');
    const left = inferType(expression.left, variables);
    const right = inferType(expression.right, variables);
    if (['and', 'or'].includes(expression.operator)) {
      if (left !== 'boolean' || right !== 'boolean') throw new Error(`运算符 ${expression.operator} 需要布尔值。`);
      return 'boolean';
    }
    if (['==', '!='].includes(expression.operator)) return 'boolean';
    if (['<', '<=', '>', '>='].includes(expression.operator)) {
      if (left !== right || !['number', 'string'].includes(left)) throw new Error(`运算符 ${expression.operator} 两侧必须是同类型数值或字符串。`);
      return 'boolean';
    }
    if (left !== 'number' || right !== 'number') throw new Error('加减乘除只支持数值。');
    return 'number';
  }

  return { parse, identifiers, evaluate, inferType };
});

'use strict';

const BOX_STYLES = new Set(['normal', 'purple', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx']);
const BUBBLE_STYLES = new Set(['manga', 'think', 'purple', 'thought']);

// Reachable creations are treated as possible on every path; no branch-state
// inference is attempted, so this pass reports only unambiguous errors.
function diagnoseUi(lines) {
  const reachable = new Set();
  const queue = lines.length ? [0] : [];
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i];
    if (reachable.has(index) || index < 0 || index >= lines.length) continue;
    reachable.add(index);
    const line = lines[index];
    const next = line.mode === 'end' ? []
      : line.mode === 'jump' || line.mode === 'branch-jump' ? [line.target]
        : line.mode === 'branch' ? (line.options || []).map(option => option.next)
          : line.mode === 'condition' ? [index + 1, line.falseTarget]
          : [index + 1];
    for (const target of next) if (Number.isInteger(target) && !reachable.has(target)) queue.push(target);
  }
  const kinds = new Map();
  for (const [index, line] of lines.entries()) {
    if (!reachable.has(index)) continue;
    const operations = [line.mode === 'ui-op' && line.operation,
      ...(line.events || []).filter(event => event.type === 'ui').map(event => event.operation)];
    for (const operation of operations) {
      if (operation?.type !== 'create') continue;
      const { id, kind } = operation.node;
      if (!kinds.has(id)) kinds.set(id, new Set());
      kinds.get(id).add(kind);
    }
  }
  const diagnostics = [];
  const add = (line, message) => diagnostics.push({ line: Number(line) || 1, column: 1, severity: 'error', message });
  const requireUi = (id, line) => {
    if (kinds.has(id)) return kinds.get(id);
    add(line, `UI 对象未创建：${id}。请先用 ui show 创建。`);
    return null;
  };
  const stageAt = (line, item) => {
    const ids = new Set((line.stage || []).map(actor => actor.id));
    if (item.delay == null) return ids;
    for (const event of line.events || []) {
      if (event.delay > item.delay || (event.delay === item.delay && event.sourceLine >= item.sourceLine)) break;
      if (event.type !== 'stage') continue;
      if (event.action === 'show') ids.add(event.conf.id);
      else if (event.id === 'all' || event.id === 'stage') ids.clear();
      else ids.delete(event.id);
    }
    return ids;
  };
  for (const [index, line] of lines.entries()) {
    if (!reachable.has(index)) continue;
    const operations = [
      ...(line.mode === 'ui-op' ? [{ operation: line.operation, sourceLine: line.sourceLine }] : []),
      ...(line.events || []).filter(event => event.type === 'ui'),
    ];
    for (const item of operations) {
      const operation = item.operation;
      const sourceLine = item.sourceLine || line.sourceLine;
      const stage = stageAt(line, item);
      if (operation?.type === 'create') {
        if (stage.has(operation.node.id)) {
          add(sourceLine, `UI 名称与舞台对象重复：${operation.node.id}`);
        }
      } else if (operation) {
        const supported = requireUi(operation.id, sourceLine);
        if (operation.type === 'bind' && operation.parent !== null) {
          if (operation.id === operation.parent) add(sourceLine, `UI 对象不能绑定到自身：${operation.id}`);
          else if (!kinds.has(operation.parent) && !stage.has(operation.parent)) {
            add(sourceLine, `绑定父级未创建或不在舞台：${operation.parent}`);
          }
        }
        if (operation.type === 'set' && supported) {
          const values = operation.values || {};
          if (['text', 'fontSize', 'speed', 'color', 'overflow'].some(key => Object.hasOwn(values, key)) && !supported.has('text')) {
            add(sourceLine, `文字属性只能用于打字机：${operation.id}`);
          }
          if (Object.hasOwn(values, 'tail') && !supported.has('bubble')) {
            add(sourceLine, `尾巴只能用于气泡：${operation.id}`);
          }
          if (Object.hasOwn(values, 'style') && !(
            (supported.has('bubble') && BUBBLE_STYLES.has(values.style)) ||
            (supported.has('box') && BOX_STYLES.has(values.style))
          )) {
            add(sourceLine, `对象不支持该样式：${operation.id} / ${values.style}`);
          }
        }
      }
    }
    for (const action of line.actions || []) {
      if (action.targetKind === 'ui') requireUi(action.actor, action.sourceLine || line.sourceLine);
    }
  }
  return diagnostics;
}

module.exports = { diagnoseUi };

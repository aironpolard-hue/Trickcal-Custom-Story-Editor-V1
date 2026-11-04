'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scene-graph'));
  else root.TrickcalSceneState = factory(root.TrickcalSceneGraph);
})(typeof globalThis === 'object' ? globalThis : this, function (graph) {
  const ID = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
  const TRANSFORM_FIELDS = ['x', 'y', 'sx', 'sy', 'rot', 'alpha'];
  const RESERVED_FIELDS = new Set(['id', 'kind', 'parent']);

  function validateNode(node) {
    if (!node || !ID.test(node.id || '')) throw new Error('Invalid scene object ID');
    if (!ID.test(node.kind || '')) throw new Error(`Invalid scene object kind: "${node.id}"`);
    for (const field of TRANSFORM_FIELDS) {
      if (node[field] !== undefined && (typeof node[field] !== 'number' || !Number.isFinite(node[field]))) {
        throw new Error(`Invalid ${field} for "${node.id}"`);
      }
    }
    if (node.alpha !== undefined && (node.alpha < 0 || node.alpha > 1)) {
      throw new Error(`Invalid alpha for "${node.id}"`);
    }
    if (node.visible !== undefined && typeof node.visible !== 'boolean') {
      throw new Error(`Invalid visibility for "${node.id}"`);
    }
    for (const field of ['width', 'height', 'fontSize', 'speed', 'maxHeight']) {
      if (node[field] !== undefined && (typeof node[field] !== 'number' || !Number.isFinite(node[field]) || node[field] <= 0)) {
        throw new Error(`Invalid ${field} for "${node.id}"`);
      }
    }
  }

  function applyOperations(state, operations, options = {}) {
    const next = new Map(state);
    const externalParents = options.externalParents || new Set();
    for (const op of operations) {
      if (!op || typeof op !== 'object') throw new Error('Invalid scene operation');
      if (op.type === 'create') {
        const node = { ...op.node };
        validateNode(node);
        if (next.has(node.id)) throw new Error(`Scene object already exists: "${node.id}"`);
        if (node.parent && !next.has(node.parent) && !externalParents.has(node.parent)) throw new Error(`Scene parent not found: "${node.parent}"`);
        if (node.parent === node.id) throw new Error(`Scene graph cycle at "${node.id}"`);
        next.set(node.id, node);
      } else if (op.type === 'set') {
        const node = next.get(op.id);
        if (!node) throw new Error(`Scene object not found: "${op.id}"`);
        if (!op.values || typeof op.values !== 'object' || Array.isArray(op.values)) throw new Error('Invalid scene values');
        if (Object.keys(op.values).some(key => RESERVED_FIELDS.has(key))) throw new Error('Use bind to change a parent');
        const updated = { ...node, ...op.values };
        validateNode(updated);
        next.set(op.id, updated);
      } else if (op.type === 'bind') {
        const node = next.get(op.id);
        if (!node) throw new Error(`Scene object not found: "${op.id}"`);
        if (op.parent !== null && !next.has(op.parent) && !externalParents.has(op.parent)) throw new Error(`Scene parent not found: "${op.parent}"`);
        if (op.parent !== null && graph.wouldCreateCycle(next, op.id, op.parent)) throw new Error('Scene graph cycle');
        const updated = { ...node, parent: op.parent };
        if (op.x !== undefined) updated.x = op.x;
        if (op.y !== undefined) updated.y = op.y;
        validateNode(updated);
        next.set(op.id, updated);
      } else if (op.type === 'remove') {
        if (!next.has(op.id)) throw new Error(`Scene object not found: "${op.id}"`);
        const removed = new Set([op.id]);
        let changed;
        do {
          changed = false;
          for (const [id, node] of next) {
            if (!removed.has(id) && removed.has(node.parent)) { removed.add(id); changed = true; }
          }
        } while (changed);
        for (const id of removed) next.delete(id);
      } else {
        throw new Error(`Unknown scene operation: "${op.type}"`);
      }
    }
    return next;
  }

  return { applyOperations };
});

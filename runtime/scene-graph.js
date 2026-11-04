'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalSceneGraph = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function multiply(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5],
    ];
  }

  function localMatrix(node) {
    const rad = (node.rot ?? 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = node.sx ?? 1;
    const sy = node.sy ?? 1;
    return [cos * sx, sin * sx, -sin * sy, cos * sy, node.x ?? 0, node.y ?? 0];
  }

  function wouldCreateCycle(nodes, childId, parentId) {
    const seen = new Set();
    let id = parentId;
    while (id != null) {
      if (id === childId || seen.has(id)) return true;
      seen.add(id);
      const node = nodes.get(id);
      if (!node) return false;
      id = node.parent || null;
    }
    return false;
  }

  function resolveWorldTransforms(nodes) {
    const resolved = new Map();
    const visiting = new Set();
    function visit(id) {
      if (resolved.has(id)) return resolved.get(id);
      if (visiting.has(id)) throw new Error(`Scene graph cycle at "${id}"`);
      const node = nodes.get(id);
      if (!node) throw new Error(`Scene graph node not found: "${id}"`);
      visiting.add(id);
      const local = localMatrix(node);
      let matrix = local;
      let alpha = node.alpha ?? 1;
      let visible = node.visible !== false;
      if (node.parent) {
        if (!nodes.has(node.parent)) throw new Error(`Scene graph parent not found: "${node.parent}" for "${id}"`);
        const parent = visit(node.parent);
        matrix = multiply(parent.matrix, local);
        alpha *= parent.alpha;
        visible = visible && parent.visible;
      }
      visiting.delete(id);
      const result = { matrix, alpha, visible };
      resolved.set(id, result);
      return result;
    }
    for (const id of nodes.keys()) visit(id);
    return resolved;
  }

  return { multiply, localMatrix, wouldCreateCycle, resolveWorldTransforms };
});

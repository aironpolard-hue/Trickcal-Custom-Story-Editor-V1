'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./camera-timeline'));
  else root.TrickcalStageTimeline = factory(root.TrickcalCameraTimeline);
})(typeof globalThis === 'object' ? globalThis : this, function (timeline) {
  function sample(initial, events, actions, elapsed) {
    const stage = new Map((initial || []).map(item => [item.id, { ...item }]));
    const lastShow = new Map();
    const ordered = (events || []).filter(event => ['stage', 'actor', 'bind'].includes(event.type))
      .slice().sort((a, b) => (a.delay || 0) - (b.delay || 0) || (a.sourceLine || 0) - (b.sourceLine || 0));
    for (const event of ordered) {
      if ((event.delay || 0) > elapsed) break;
      if (event.type === 'stage') {
        if (event.action === 'show') {
          stage.set(event.conf.id, { ...event.conf });
          lastShow.set(event.conf.id, event);
        } else if (event.id === 'all' || event.id === 'stage') {
          stage.clear();
          lastShow.clear();
        } else {
          stage.delete(event.id);
          lastShow.delete(event.id);
        }
      } else if (event.type === 'actor') {
        const actor = stage.get(event.actor);
        if (actor) Object.assign(actor, event.patch);
      } else {
        const child = stage.get(event.child);
        if (child) Object.assign(child, event.binding);
      }
    }
    const values = new Map();
    for (const action of (actions || []).filter(item => item.targetKind !== 'ui')
      .slice().sort((a, b) => (a.delay || 0) - (b.delay || 0) || (a.sourceLine || 0) - (b.sourceLine || 0))) {
      const delay = action.delay || 0;
      if (delay > elapsed || !stage.has(action.actor)) continue;
      const show = lastShow.get(action.actor);
      if (show && (delay < show.delay || (delay === show.delay && action.sourceLine < show.sourceLine))) continue;
      const key = `${action.actor}\0${action.property}`;
      if (!values.has(key)) values.set(key, { actor: action.actor, property: action.property, absolute: null, relative: 0 });
      const target = values.get(key);
      const progress = action.duration === 0 || elapsed + 1e-9 >= delay + action.duration
        ? 1 : Math.max(0, Math.min(1, (elapsed - delay) / action.duration));
      const value = progress === 1 ? action.to : progress === 0 ? action.from
        : action.from + (action.to - action.from) * timeline.ease(progress, action.ease || 'OutCubic');
      if (action.relative) target.relative += value;
      else target.absolute = value;
    }
    for (const target of values.values()) {
      const actor = stage.get(target.actor);
      const fallback = ['sx', 'sy', 'alpha', 'brightness'].includes(target.property) ? 1 : 0;
      const base = target.absolute == null ? (actor[target.property] ?? fallback) : target.absolute;
      const value = base + target.relative;
      actor[target.property] = target.property === 'alpha' ? Math.max(0, Math.min(1, value))
        : target.property === 'brightness' ? Math.max(0, value) : value;
    }
    return stage;
  }

  return { sample };
});

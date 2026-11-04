'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalCameraTimeline = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function ease(progress, name) {
    const p = Math.max(0, Math.min(1, progress));
    if (name === 'Linear') return p;
    if (name === 'InSine') return 1 - Math.cos(p * Math.PI / 2);
    if (name === 'OutSine') return Math.sin(p * Math.PI / 2);
    if (name === 'InOutSine') return -(Math.cos(Math.PI * p) - 1) / 2;
    if (name === 'InCubic') return p * p * p;
    if (name === 'OutCubic') return 1 - Math.pow(1 - p, 3);
    if (name === 'InOutCubic') return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    if (name === 'OutBack') { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
    if (name === 'OutQuint') return 1 - Math.pow(1 - p, 5);
    return p * p * (3 - 2 * p);
  }

  function create(base, events, tracks, eventType = 'camera') {
    const items = [
      ...(events || []).filter(event => event.type === eventType).map(event => ({ ...event, kind: 'set' })),
      ...(tracks || []).map(track => ({ ...track, kind: 'track' })),
    ].sort((a, b) => (a.delay || 0) - (b.delay || 0) || (a.sourceLine || 0) - (b.sourceLine || 0));
    return { base: { ...base }, items };
  }

  function sample(timeline, elapsed) {
    const camera = { ...timeline.base };
    for (const item of timeline.items) {
      const delay = item.delay || 0;
      if (elapsed < delay) break;
      if (item.kind === 'set') {
        Object.assign(camera, item.patch);
      } else {
        const p = item.duration === 0 ? 1 : Math.max(0, Math.min(1, (elapsed - delay) / item.duration));
        const value = item.from + (item.to - item.from) * ease(p, item.ease || 'OutCubic');
        camera[item.property] = item.relative ? (camera[item.property] ?? 0) + value : value;
      }
    }
    if (camera.zoom != null) camera.zoom = Math.max(0.001, camera.zoom);
    return camera;
  }

  function sampleEffect(timeline, elapsed) {
    const fx = sample(timeline, elapsed);
    for (const property of ['brightness', 'contrast', 'saturation', 'blur']) {
      if (fx[property] != null) fx[property] = Math.max(0, fx[property]);
    }
    if (fx.tintAlpha != null) fx.tintAlpha = Math.max(0, Math.min(1, fx.tintAlpha));
    return fx;
  }

  return { ease, create, sample, sampleEffect };
});

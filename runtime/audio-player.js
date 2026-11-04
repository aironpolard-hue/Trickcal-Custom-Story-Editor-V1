'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrickcalAudioPlayer = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function seconds(value) {
    const match = String(value ?? '').trim().match(/^((?:\d+(?:\.\d+)?|\.\d+))\s*(ms|s)?$/i);
    return match ? Number(match[1]) / (match[2]?.toLowerCase() === 'ms' ? 1000 : 1) : 0;
  }

  function create({ createAudio, requestFrame, now, resolveUrl, onError = () => {} }) {
    const players = new Map();
    const active = item => players.get(item.alias) === item;
    const pause = item => { try { item.el.pause(); } catch (_) {} };
    const cancelFade = item => { item.fadeVersion++; };
    const fade = (item, target, duration, done) => {
      const version = ++item.fadeVersion;
      const from = item.el.volume;
      if (duration <= 0) {
        item.el.volume = target;
        if (done) done();
        return;
      }
      const start = now();
      const tick = time => {
        if (version !== item.fadeVersion) return;
        const p = Math.max(0, Math.min(1, (time - start) / (duration * 1000)));
        item.el.volume = Math.max(0, Math.min(1, from + (target - from) * p));
        if (p < 1) requestFrame(tick);
        else if (done) done();
      };
      requestFrame(tick);
    };

    const stop = (alias, duration = 0) => {
      const item = players.get(alias);
      if (!item) return;
      players.delete(alias);
      item.pendingPlay = null;
      cancelFade(item);
      if (item.started && duration > 0) fade(item, 0, duration, () => pause(item));
      else pause(item);
    };

    const play = cmd => {
      if (!cmd) return;
      const alias = cmd.alias || 'audio';
      if (cmd.action === 'stop') { stop(alias, seconds(cmd.fadeOut)); return; }
      if (!cmd.src) return;
      stop(alias);
      const el = createAudio();
      el.src = resolveUrl(cmd.src);
      el.preload = 'auto';
      el.loop = !!cmd.loop;
      el.volume = 0;
      const item = {
        el, alias, started: false, pendingPlay: null, fadeVersion: 0, naturalFade: false, monitoring: false,
        remaining: cmd.times == null ? 1 : Math.max(1, Number(cmd.times) || 1),
        target: cmd.volume == null ? 0.8 : Math.max(0, Math.min(1, Number(cmd.volume) || 0)),
        fadeOut: seconds(cmd.fadeOut),
      };
      players.set(alias, item);

      const monitor = () => {
        if (!active(item)) { item.monitoring = false; return; }
        const duration = Number(el.duration), current = Number(el.currentTime);
        if (item.started && item.remaining === 1 && Number.isFinite(duration) && duration > 0 && Number.isFinite(current)) {
          const remaining = Math.max(0, duration - current);
          if (remaining <= item.fadeOut) {
            item.naturalFade = true;
            el.volume = Math.min(el.volume, item.target * Math.min(1, remaining / item.fadeOut));
          } else if (item.naturalFade) {
            item.naturalFade = false;
            el.volume = item.target;
          }
        }
        requestFrame(monitor);
      };
      const start = initial => {
        if (!active(item)) return;
        item.pendingPlay = null;
        let result;
        try { result = el.play(); }
        catch (error) { result = Promise.reject(error); }
        Promise.resolve(result).then(() => {
          if (!active(item)) { pause(item); return; }
          item.started = true;
          if (initial) fade(item, item.target, seconds(cmd.fadeIn));
          else el.volume = item.target;
          if (item.fadeOut > 0 && !el.loop && !item.monitoring) {
            item.monitoring = true;
            requestFrame(monitor);
          }
        }).catch(error => {
          if (!active(item)) return;
          if (error?.name === 'NotAllowedError') item.pendingPlay = () => start(initial);
          else { players.delete(alias); cancelFade(item); onError(alias, error); }
        });
      };
      el.addEventListener('ended', () => {
        if (!active(item) || el.loop) return;
        item.remaining--;
        if (item.remaining > 0) {
          item.naturalFade = false;
          item.started = false;
          cancelFade(item);
          el.currentTime = 0;
          start(false);
        } else {
          players.delete(alias);
          cancelFade(item);
        }
      });
      start(true);
    };

    const unlock = () => {
      for (const item of players.values()) {
        if (item.pendingPlay) { const retry = item.pendingPlay; item.pendingPlay = null; retry(); }
      }
    };
    return { play, stop, unlock, players };
  }

  return { create, seconds };
});

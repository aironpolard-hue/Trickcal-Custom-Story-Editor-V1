'use strict';

const assert = require('assert');
const { create, seconds } = require('../runtime/audio-player');

function harness() {
  let time = 0;
  let frames = [];
  const audio = [];
  const responses = [];
  const errors = [];
  class FakeAudio {
    constructor() {
      this.volume = 1;
      this.currentTime = 0;
      this.duration = NaN;
      this.listeners = {};
      this.plays = 0;
      this.pauses = 0;
      audio.push(this);
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    play() { this.plays++; return responses.length ? responses.shift() : Promise.resolve(); }
    pause() { this.pauses++; }
    end() { this.listeners.ended(); }
  }
  const player = create({
    createAudio: () => new FakeAudio(),
    requestFrame: callback => frames.push(callback),
    now: () => time,
    resolveUrl: src => '/assets/' + src,
    onError: (alias, error) => errors.push([alias, error.message]),
  });
  const tick = ms => {
    time += ms;
    const callbacks = frames;
    frames = [];
    callbacks.forEach(callback => callback(time));
  };
  return { player, audio, responses, errors, tick, frameCount: () => frames.length };
}

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

async function main() {
  assert.strictEqual(seconds('250ms'), 0.25);
  assert.strictEqual(seconds('.5s'), 0.5);
  assert.strictEqual(seconds('1..2s'), 0);

  {
    const { player, audio } = harness();
    player.play({ alias: 'voice', src: 'v.ogg' });
    await flush();
    assert.strictEqual(audio[0].src, '/assets/v.ogg');
    assert.strictEqual(audio[0].volume, 0.8);
    audio[0].end();
    assert.strictEqual(player.players.size, 0, 'one-shot must release its player');
  }
  {
    const { player, audio, responses } = harness();
    let resolve;
    responses.push(new Promise(done => { resolve = done; }));
    player.play({ alias: 'rain', src: 'rain.ogg', fadeIn: '1s' });
    player.play({ action: 'stop', alias: 'rain', fadeOut: '1s' });
    resolve();
    await flush();
    assert.strictEqual(player.players.size, 0);
    assert.ok(audio[0].pauses >= 1, 'late play completion must not revive stopped sound');
    assert.strictEqual(audio[0].volume, 0);
  }
  {
    const { player, audio, tick } = harness();
    player.play({ alias: 'rain', src: 'rain.ogg', fadeIn: '1s' });
    await flush();
    tick(500);
    assert.ok(Math.abs(audio[0].volume - 0.4) < 1e-6);
    player.play({ action: 'stop', alias: 'rain', fadeOut: '1s' });
    tick(500);
    assert.ok(Math.abs(audio[0].volume - 0.2) < 1e-6, 'fade in must not override fade out');
    tick(500);
    assert.strictEqual(audio[0].volume, 0);
    assert.strictEqual(audio[0].pauses, 1);
  }
  {
    const { player, audio, responses, frameCount } = harness();
    responses.push(Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })));
    player.play({ alias: 'rain', src: 'rain.ogg', fadeOut: '1s' });
    await flush();
    assert.strictEqual(audio[0].plays, 1);
    assert.strictEqual(frameCount(), 0, 'blocked audio must not run a fade monitor');
    player.unlock();
    await flush();
    assert.strictEqual(audio[0].plays, 2);
    assert.strictEqual(frameCount(), 1);
    player.play({ action: 'stop', alias: 'rain' });
    player.unlock();
    await flush();
    assert.strictEqual(audio[0].plays, 2, 'stopped pending audio must not retry');
  }
  {
    const { player, audio, responses, errors } = harness();
    responses.push(Promise.reject(Object.assign(new Error('bad media'), { name: 'NotSupportedError' })));
    player.play({ alias: 'broken', src: 'bad.ogg' });
    await flush();
    player.unlock();
    assert.strictEqual(audio[0].plays, 1);
    assert.deepStrictEqual(errors, [['broken', 'bad media']]);
    assert.strictEqual(player.players.size, 0);
  }
  {
    const { player, audio, tick } = harness();
    player.play({ alias: 'short', src: 'short.ogg', volume: 1, fadeIn: '2s', fadeOut: '1s' });
    await flush();
    audio[0].duration = 1;
    audio[0].currentTime = 0.25;
    tick(500);
    assert.strictEqual(audio[0].volume, 0.25, 'overlapping fade-in must still raise volume');
    audio[0].currentTime = 0.75;
    tick(500);
    assert.strictEqual(audio[0].volume, 0.25, 'fade-out limits the overlapping fade-in');
    audio[0].end();
    tick(100);
  }
  {
    const { player, audio, tick } = harness();
    player.play({ alias: 'sound', src: 's.ogg', times: 2, volume: 1, fadeOut: '1s' });
    await flush();
    const el = audio[0];
    tick(100);
    el.duration = 2;
    el.currentTime = 1.5;
    tick(100);
    assert.strictEqual(el.volume, 1, 'only the final repetition fades out');
    el.end();
    await flush();
    assert.strictEqual(el.plays, 2);
    el.currentTime = 1.5;
    tick(100);
    assert.strictEqual(el.volume, 0.5);
    el.currentTime = 0.5;
    tick(100);
    assert.strictEqual(el.volume, 1, 'seeking back restores volume');
    el.currentTime = 1.75;
    tick(100);
    assert.strictEqual(el.volume, 0.25);
    el.end();
    tick(100);
    assert.strictEqual(player.players.size, 0);
  }
  console.log('audio-player.test.js: ok');
}

main().catch(error => { console.error(error); process.exitCode = 1; });

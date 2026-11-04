'use strict';

const path = require('path');
const { Worker } = require('worker_threads');

class CheckService {
  constructor() {
    this.worker = null;
    this.active = null;
    this.queue = [];
    this.nextId = 1;
  }

  start() {
    if (this.worker) return;
    const worker = new Worker(path.join(__dirname, 'check-worker.js'));
    this.worker = worker;
    worker.on('message', message => {
      if (this.worker !== worker || !this.active || this.active.id !== message.id) return;
      const pending = this.active;
      this.active = null;
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
      this.dispatch();
    });
    const fail = error => {
      if (this.worker !== worker) return;
      this.worker = null;
      if (this.active) this.active.reject(error);
      this.active = null;
      for (const pending of this.queue) pending.reject(error);
      this.queue = [];
    };
    worker.on('error', fail);
    worker.on('exit', code => fail(new Error(`后台检查线程已退出（${code}）`)));
    worker.unref();
  }

  dispatch() {
    const worker = this.worker;
    if (!worker || this.active) return;
    const pending = this.queue.shift();
    if (!pending) { worker.unref(); return; }
    this.active = pending;
    worker.ref();
    try {
      worker.postMessage({ id: pending.id, source: pending.source, options: pending.options });
    } catch (error) {
      this.active = null;
      pending.reject(error);
      this.dispatch();
    }
  }

  check(source, options, key = null) {
    this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (key !== null) {
        const obsolete = this.queue.findIndex(item => item.key === key);
        if (obsolete >= 0) {
          const [removed] = this.queue.splice(obsolete, 1);
          removed.resolve({ superseded: true });
        }
      }
      this.queue.push({ id, key, source, options, resolve, reject });
      this.dispatch();
    });
  }

  async close() {
    if (!this.worker) return;
    const worker = this.worker;
    this.worker = null;
    const error = new Error('后台检查线程已关闭。');
    if (this.active) this.active.reject(error);
    this.active = null;
    for (const pending of this.queue) pending.reject(error);
    this.queue = [];
    await worker.terminate();
  }
}

module.exports = { CheckService };

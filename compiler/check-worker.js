'use strict';

const { parentPort } = require('worker_threads');
const { compile } = require('./trickcal');

parentPort.on('message', ({ id, source, options }) => {
  try {
    parentPort.postMessage({ id, result: compile(source, options) });
  } catch (error) {
    parentPort.postMessage({ id, error: error && error.message ? error.message : String(error) });
  }
});

'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scene-state'));
  else root.TrickcalStoryMachine = factory(root.TrickcalSceneState);
})(typeof globalThis === 'object' ? globalThis : this, function (sceneState) {
  function createMachine(program) {
    if (!Array.isArray(program)) throw new Error('Story program must be an array');
    return { program, pc: 0, scene: new Map(), waiting: null, ended: false };
  }

  function targetFor(program, value) {
    if (!Number.isInteger(value) || value < 0 || value >= program.length) {
      throw new Error(`Invalid story target: "${value}"`);
    }
    return value;
  }

  function advance(machine, input, maxOperations = 10000) {
    if (!Number.isInteger(maxOperations) || maxOperations < 1) throw new Error('Invalid operation limit');
    if (machine.ended) return machine;
    let { pc, scene } = machine;
    if (machine.waiting) {
      if (machine.waiting.type === 'choice') {
        if (!Number.isInteger(input) || input < 0 || input >= machine.waiting.options.length) {
          throw new Error('A valid choice index is required');
        }
        pc = targetFor(machine.program, machine.waiting.options[input].target);
      } else if (input !== undefined && input !== null) {
        throw new Error('Present does not accept a choice');
      }
    } else if (input !== undefined && input !== null) {
      throw new Error('Story is not waiting for a choice');
    }

    for (let count = 0; count < maxOperations; count++) {
      if (pc === machine.program.length) return { ...machine, pc, scene, waiting: null, ended: true };
      targetFor(machine.program, pc);
      const instruction = machine.program[pc];
      if (!instruction || typeof instruction !== 'object') throw new Error(`Invalid story instruction at ${pc}`);
      if (instruction.type === 'scene') {
        scene = sceneState.applyOperations(scene, instruction.operations);
        pc++;
      } else if (instruction.type === 'jump') {
        pc = targetFor(machine.program, instruction.target);
      } else if (instruction.type === 'present') {
        return { ...machine, pc: pc + 1, scene, waiting: { type: 'present' }, ended: false };
      } else if (instruction.type === 'choice') {
        if (!Array.isArray(instruction.options) || !instruction.options.length) throw new Error('Choice requires options');
        const options = instruction.options.map(option => {
          if (!option || typeof option.text !== 'string') throw new Error('Invalid choice option');
          return { text: option.text, target: targetFor(machine.program, option.target) };
        });
        return { ...machine, pc: pc + 1, scene, waiting: { type: 'choice', options }, ended: false };
      } else if (instruction.type === 'end') {
        return { ...machine, pc, scene, waiting: null, ended: true };
      } else {
        throw new Error(`Unknown story instruction at ${pc}: "${instruction.type}"`);
      }
    }
    throw new Error(`Story exceeded ${maxOperations} operations without waiting`);
  }

  return { createMachine, advance };
});

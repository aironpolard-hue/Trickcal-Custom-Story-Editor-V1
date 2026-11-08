'use strict';
const assert = require('assert');
const path = require('path');
const { compile } = require('../compiler/trickcal');
const cameraTimeline = require('../runtime/camera-timeline');
const demoProject = path.resolve(__dirname, '../templates/minimal-demo');

const presets = [
  { name: '漫画对话气泡', type: 'bubble', fields: { bubbleWidth: 760, purple: false } },
  { name: '紫色 内心', type: 'bubble', fields: { purple: true } },
  { name: '跑入', type: 'move', fields: { from: 'left', duration: 1, ease: 'OutCubic' } },
  { name: '拉伸', type: 'move', fields: { scaleX: 1.08, scaleY: 0.94, duration: 0.35, ease: 'OutBack' } },
  { name: '普通打字机', type: 'typewriter', fields: { typeSpeed: 1, punctuationPause: 0.12 } },
];
const run = source => compile(source, { presets });
const script = [
  'preset 漫画对话气泡 bubbleWidth 900 shadowX -25 shadowY 40 shadowColor "#773399" shadowAlpha 0.5',
  'ner manga "第一句"',
  'preset 漫画对话气泡',
  'ner manga "第二句"',
  'preset "紫色 内心" purple false',
  'ner manga "第三句"',
].join('\n');
const result = run(script);
assert.deepStrictEqual(result.diagnostics, []);
assert.deepStrictEqual(
  ['bubbleWidth', 'shadowX', 'shadowY', 'shadowColor', 'shadowAlpha'].map(key => result.story.lines[0][key]),
  [900, -25, 40, '#773399', 0.5],
);
assert.strictEqual(result.story.lines[1].bubbleWidth, 760);
assert.strictEqual(result.story.lines[1].shadowX, undefined);
assert.strictEqual(result.story.lines[2].purple, false);
assert.strictEqual(presets[0].fields.bubbleWidth, 760);
const typedPreset = run([
  'preset 普通打字机 speed 0.1 punctuationPause 0.25 typeSpeed 2',
  'ner normal "测试，继续。"',
  'preset 普通打字机',
  'ner normal "下一句。"',
].join('\n'));
assert.deepStrictEqual(typedPreset.diagnostics, []);
assert.deepStrictEqual([typedPreset.story.lines[0].speed, typedPreset.story.lines[0].punctuationPause, typedPreset.story.lines[0].typeSpeed], [0.1, 0.25, 2]);
assert.strictEqual(typedPreset.story.lines[1].speed, undefined);
assert.strictEqual(typedPreset.story.lines[1].punctuationPause, 0.12);
assert.strictEqual(presets[4].fields.punctuationPause, 0.12);
for (const statement of ['preset 普通打字机 speed 0', 'preset 普通打字机 speed -0.1', 'preset 普通打字机 punctuationPause -1']) {
  assert.ok(run(`${statement}\nner normal "测试"`).diagnostics.some(item => item.severity === 'error'), statement);
}
const badTypingPreset = compile('preset 无效打字\nner normal "测试"', { presets: [{ name: '无效打字', type: 'typewriter', fields: { speed: -1 } }] });
assert.ok(badTypingPreset.diagnostics.some(item => item.severity === 'error'));
for (const statement of [
  'preset 漫画对话气泡 hold -1',
  'preset 漫画对话气泡 shadowAlpha 2',
  'preset 漫画对话气泡 shadowColor "red"',
  'preset 漫画对话气泡 shadowX',
  'preset 漫画对话气泡 shadowX 1 shadowX 2',
  'preset 漫画对话气泡 bogus 1',
  'preset 漫画对话气泡 overflow unknown',
]) assert.ok(run(statement + '\nner manga "测试"').diagnostics.some(item => item.severity === 'error'), statement);
for (const overflow of ['grow', 'shrink', 'scroll', 'clip']) {
  const result = run(`preset 漫画对话气泡 overflow ${overflow}\nner manga "测试"`);
  assert.deepStrictEqual(result.diagnostics, []);
  assert.strictEqual(result.story.lines[0].overflow, overflow);
}
const animation = run([
  'show ner at center',
  'parallel:',
  '  say ner normal "测试"',
  '  move ner preset 跑入',
  '  after 0.5s:',
  '    move ner preset 拉伸',
].join('\n'));
assert.deepStrictEqual(animation.diagnostics, []);
const actions = animation.story.lines[0].actions;
assert.deepStrictEqual(actions.map(action => [action.property, action.delay]), [['x', 0], ['sx', 0.5], ['sy', 0.5]]);
assert.deepStrictEqual([actions[0].from, actions[0].to], [-320, 960]);
const customized = run([
  'show ner at center scale 1',
  'parallel:',
  '  move ner preset 跑入 from right duration 0.4 ease Linear',
  '  after 0.5s:',
  '    move ner preset "拉伸" duration 0.8 scaleX 1.2 scaleY 0.7 ease InOutCubic',
  '  say ner normal "测试"',
  'ner normal "完成"',
].join('\n'));
assert.deepStrictEqual(customized.diagnostics, []);
assert.deepStrictEqual(customized.story.lines[0].actions.map(action => [action.property, action.from, action.to, action.duration, action.delay, action.ease]), [
  ['x', 2240, 960, 0.4, 0, 'Linear'],
  ['sx', 1, 1.2, 0.8, 0.5, 'InOutCubic'],
  ['sy', 1, 0.7, 0.8, 0.5, 'InOutCubic'],
]);
assert.strictEqual(customized.story.lines[1].stage[0].sx, 1.2);
assert.strictEqual(presets[2].fields.from, 'left');
assert.strictEqual(presets[3].fields.scaleX, 1.08);
for (const command of [
  'move ner preset 跑入 duration 0',
  'move ner preset 跑入 from middle',
  'move ner preset 跑入 scaleX 2',
  'move ner preset 跑入 duration 1 duration 2',
  'move ner preset 拉伸 ease Typo',
  'move ner preset 拉伸 scaleY -1',
  'move ner preset 拉伸 from left',
  'move ner preset 不存在',
]) {
  const errors = run(`show ner\nparallel:\n  ${command}\n  say ner normal "测试"`).diagnostics;
  assert.ok(errors.some(item => item.severity === 'error' && item.line === 3), command);
}
const parallelStage = run([
  'show ner pose Idle_1',
  'parallel:',
  '  camera x 20',
  '  after 0.5s:',
  '    camera zoom 1.5',
  '    anim ner Surprise_1 fade 0',
  '  after 0.2s:',
  '    camera x 30',
  '  after 0.8s:',
  '    camera move -30,50',
  '    skin ner Normal',
  '  say ner normal "测试"',
  'ner normal "下一句"',
].join('\n'));
assert.deepStrictEqual(parallelStage.diagnostics, []);
assert.deepStrictEqual(parallelStage.story.lines[0].events.map(event => [event.type, event.delay]),
  [['camera', 0], ['camera', 0.2], ['camera', 0.5], ['actor', 0.5], ['camera', 0.8], ['actor', 0.8]]);
assert.strictEqual(parallelStage.story.lines[0].camera.zoom, 1);
assert.strictEqual(parallelStage.story.lines[0].stage[0].anim, 'Idle_1');
assert.strictEqual(parallelStage.story.lines[1].camera.zoom, 1.5);
assert.strictEqual(parallelStage.story.lines[1].camera.x, -30);
assert.strictEqual(parallelStage.story.lines[1].stage[0].anim, 'Surprise_1');
assert.strictEqual(parallelStage.story.lines[1].stage[0].fade, 0);
assert.strictEqual(parallelStage.story.lines[1].stage[0].skin, 'Normal');
const standardCamera = run([
  'camera target 960,540',
  'parallel:',
  '  camera targetX 960 -> 1180 in 2s ease Linear',
  '  camera targetY 540 -> 480 in 2s ease Linear',
  '  say ner normal "镜头移动"',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(standardCamera.diagnostics, []);
const standardCameraLine = standardCamera.story.lines[0];
const standardCameraTimeline = cameraTimeline.create(standardCameraLine.camera, standardCameraLine.events, standardCameraLine.cameraTracks);
assert.deepStrictEqual(
  [standardCameraLine.camera.targetX, standardCameraLine.camera.targetY,
    cameraTimeline.sample(standardCameraTimeline, 1).targetX, cameraTimeline.sample(standardCameraTimeline, 1).targetY,
    standardCamera.story.lines[1].camera.targetX, standardCamera.story.lines[1].camera.targetY],
  [960, 540, 1070, 510, 1180, 480],
);
const cameraAnimation = run([
  'parallel:',
  '  camera zoom 1 -> 2 in 2s ease Linear',
  '  camera x by 100 in 2s ease Linear',
  '  after 1s:',
  '    camera y -30',
  '  after 1.5s:',
  '    camera x 10',
  '  say ner normal "测试"',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(cameraAnimation.diagnostics, []);
const cameraLine = cameraAnimation.story.lines[0];
assert.strictEqual(cameraLine.timelineEnd, 2);
const timeline = cameraTimeline.create(cameraLine.camera, cameraLine.events, cameraLine.cameraTracks);
assert.deepStrictEqual([cameraTimeline.sample(timeline, 0.5).zoom, cameraTimeline.sample(timeline, 0.5).x], [1.25, 25]);
assert.deepStrictEqual([cameraTimeline.sample(timeline, 1.25).zoom, cameraTimeline.sample(timeline, 1.25).x, cameraTimeline.sample(timeline, 1.25).y], [1.625, 62.5, -30]);
assert.deepStrictEqual([cameraTimeline.sample(timeline, 1.75).zoom, cameraTimeline.sample(timeline, 1.75).x], [1.875, 10]);
assert.deepStrictEqual([cameraAnimation.story.lines[1].camera.zoom, cameraAnimation.story.lines[1].camera.x, cameraAnimation.story.lines[1].camera.y], [2, 10, -30]);
const simultaneous = run('parallel:\n  camera x 20\n  camera x by 100 in 1s ease Linear\n  camera rotate 0 -> 90 in 1s ease Linear\n  say ner normal "测试"');
assert.deepStrictEqual(simultaneous.diagnostics, []);
assert.strictEqual(simultaneous.story.lines[0].cameraTracks[1].property, 'rot');
assert.strictEqual(cameraTimeline.sample(cameraTimeline.create(simultaneous.story.lines[0].camera, simultaneous.story.lines[0].events, simultaneous.story.lines[0].cameraTracks), 0.5).x, 70);
const zoomOut = run('parallel:\n  camera zoom 1 -> 0.5 in 1s ease Linear\n  wait 1s');
assert.deepStrictEqual(zoomOut.diagnostics, []);
assert.strictEqual(cameraTimeline.sample(cameraTimeline.create(zoomOut.story.lines[0].camera, zoomOut.story.lines[0].events, zoomOut.story.lines[0].cameraTracks), 1).zoom, 0.5);
const animatedFx = run([
  'effect tint "#ff0000" 0',
  'parallel:',
  '  effect brightness 0 -> 1 in 2s ease Linear',
  '  effect tintAlpha 0 -> 1 in 2s ease Linear',
  '  after 1s:',
  '    effect saturation 1 -> 0 in 1s ease Linear',
  '  after 1.5s:',
  '    effect brightness 0.8',
  '  say ner normal "效果"',
  'ner normal "完成"',
].join('\n'));
assert.deepStrictEqual(animatedFx.diagnostics, []);
const fxLine = animatedFx.story.lines[0];
assert.strictEqual(fxLine.timelineEnd, 2);
const fxTimeline = cameraTimeline.create(fxLine.fx, fxLine.events, fxLine.effectTracks, 'effect');
const firstFx = cameraTimeline.sampleEffect(fxTimeline, 0.5);
assert.deepStrictEqual([firstFx.brightness, firstFx.tintAlpha, firstFx.saturation], [0.25, 0.25, 1]);
const midFx = cameraTimeline.sampleEffect(fxTimeline, 1.25);
assert.deepStrictEqual([midFx.brightness, midFx.tintAlpha, midFx.saturation], [0.625, 0.625, 0.75]);
assert.deepStrictEqual([animatedFx.story.lines[1].fx.brightness, animatedFx.story.lines[1].fx.tintAlpha, animatedFx.story.lines[1].fx.saturation], [0.8, 1, 0]);
const resetFx = run('parallel:\n  effect brightness 0 -> 2 in 2s ease Linear\n  after 1s:\n    effect reset\n  wait 2s\nner normal "完成"');
assert.deepStrictEqual(resetFx.diagnostics, []);
assert.strictEqual(resetFx.story.lines[1].fx.brightness, 1);
for (const invalid of ['effect brightness -1 -> 1 in 1s', 'effect tintAlpha 0 -> 2 in 1s', 'effect blur by 1 in 1s', 'effect brightness 0 -> 1 in 1s ease Typo', 'move ner contrast 0 -> 1 in 1s']) {
  assert.ok(run(`show ner\nparallel:\n  ${invalid}\n  say ner normal "测试"`).diagnostics.some(item => item.severity === 'error'), invalid);
}
for (const invalid of ['camera zoom 1 -> 0 in 1s', 'camera zoom by 1 in 1s', 'camera x 0 -> 1 in 1s ease Typo', 'camera brightness 0 -> 1 in 1s', 'move ner zoom 1 -> 2 in 1s']) {
  assert.ok(run(`show ner\nparallel:\n  ${invalid}\n  say ner normal "测试"`).diagnostics.some(item => item.severity === 'error'), invalid);
}
for (const invalid of ['camera zoom nope', 'camera move 3,bad', 'camera follow', 'camera zoom 0', 'anim ner Surprise_1 fade 1..2', 'skin missing Normal']) {
  assert.ok(run(`show ner\nparallel:\n  say ner normal "测试"\n  ${invalid}`).diagnostics.some(item => item.severity === 'error'), invalid);
}
assert.ok(run('camera zoom nope\nner normal "测试"').diagnostics.some(item => item.severity === 'error'));
assert.ok(run('show ner\nparallel:\n  say ner normal "测试"\n  after 0.5s\n    move ner x by 10 in 1s').diagnostics.some(item => item.severity === 'error'));
const delayedDialogue = run([
  'show ner',
  'parallel:',
  '  move ner x by 10 in 2s ease Linear',
  '  after 0.5s:',
  '    after 1s:',
  '      say ner normal "第一行\\n第二行"',
].join('\n'));
assert.deepStrictEqual(delayedDialogue.diagnostics, []);
assert.strictEqual(delayedDialogue.story.lines[0].dialogueDelay, 1.5);
assert.strictEqual(delayedDialogue.story.lines[0].timelineEnd, 2);
assert.strictEqual(delayedDialogue.story.lines[0].text, '第一行\n第二行');
const orderedMoves = run([
  'show ner at 0,200',
  'parallel:',
  '  after 1s:',
  '    move ner x 100 -> 200 in 1s ease Linear',
  '  after 500ms:',
  '    move ner x 0 -> 100 in 1s ease Linear',
  '  ner normal "按开始时间覆盖"',
  'ner normal "完成"',
].join('\n'));
assert.deepStrictEqual(orderedMoves.diagnostics, []);
assert.deepStrictEqual(orderedMoves.story.lines[0].actions.map(action => action.delay), [0.5, 1]);
assert.strictEqual(orderedMoves.story.lines[1].stage[0].x, 200);
const environmentOperations = run([
  'parallel:',
  '  camera x 0 -> 100 in 2s ease Linear',
  '  effect brightness 1 -> 0.4 in 2s ease Linear',
  '  ner normal "并行"',
  'camera x 100',
  'effect brightness 0.4',
  'wait 0.2s',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(environmentOperations.diagnostics, []);
assert.deepStrictEqual(environmentOperations.story.lines[1].cameraOps, [{ x: 100 }]);
assert.deepStrictEqual(environmentOperations.story.lines[1].effectOps, [{ brightness: 0.4 }]);
assert.deepStrictEqual(environmentOperations.story.lines[2].cameraOps, []);
assert.deepStrictEqual(environmentOperations.story.lines[2].effectOps, []);
const environmentSceneOperations = compile([
  'image background = "assets/bg/elf_city_night.png"',
  'scene bg black',
  'shader gray 0.5',
  'parallel:',
  '  after 1s:',
  '    scene bg background',
  '    shader reset',
  '  narration "并行"',
  'scene bg background',
  'shader reset',
  'narration "明确设置"',
].join('\n'), { presets, projectRoot: demoProject });
assert.deepStrictEqual(environmentSceneOperations.diagnostics, []);
assert.deepStrictEqual(environmentSceneOperations.story.lines[1].sceneOps, [
  { bg: 'bg_background', bgUrl: 'assets/bg/elf_city_night.png' },
]);
assert.deepStrictEqual(environmentSceneOperations.story.lines[1].shaderOps, [{ shader: null }]);
const labelBoundary = run([
  'jump skip',
  'show ner at 100,200',
  'camera y 333',
  'label skip:',
  'ner normal "跳过标签前的设置"',
].join('\n'));
assert.deepStrictEqual(labelBoundary.diagnostics, []);
assert.deepStrictEqual(labelBoundary.story.lines.map(line => line.mode), ['jump', 'stage-sync', 'normal']);
assert.strictEqual(labelBoundary.story.lines[0].target, 2);
assert.strictEqual(labelBoundary.story.lines[1].stageOps[0].conf.id, 'ner');
assert.deepStrictEqual(labelBoundary.story.lines[1].cameraOps, [{ y: 333 }]);
const conditionalBoundary = run([
  'default selected = false',
  'if selected:',
  '  camera x 17',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(conditionalBoundary.diagnostics, []);
assert.deepStrictEqual(conditionalBoundary.story.lines.map(line => line.mode), ['condition', 'stage-sync', 'normal']);
assert.strictEqual(conditionalBoundary.story.lines[0].falseTarget, 2);
const directDialogue = run([
  'show ner',
  'parallel:',
  '  move ner x by 10 in 750ms after 250ms ease Linear',
  '  after 500ms:',
  '    preset 漫画对话气泡 bubbleWidth 900',
  '    ner manga "第一行\\n第二行"',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(directDialogue.diagnostics, []);
assert.strictEqual(directDialogue.story.lines[0].dialogueDelay, 0.5);
assert.strictEqual(directDialogue.story.lines[0].bubbleWidth, 900);
assert.deepStrictEqual([directDialogue.story.lines[0].actions[0].delay, directDialogue.story.lines[0].actions[0].duration], [0.25, 0.75]);
assert.strictEqual(directDialogue.story.lines[1].preset, undefined);
for (const [statement, mode, text] of [
  ['narration "旁白"', 'narration', '旁白'],
  ['cloud "想法"', 'cloud', '想法'],
  ['sfx "咚" at 100,200', 'sfx', '咚'],
]) {
  const result = run(`parallel:\n  after 250ms:\n    ${statement}\n  wait 1s`);
  assert.deepStrictEqual(result.diagnostics, [], statement);
  assert.deepStrictEqual([result.story.lines[0].mode, result.story.lines[0].text, result.story.lines[0].dialogueDelay], [mode, text, 0.25]);
}
assert.ok(run('parallel:\n  ner normal "第一句"\n  narration "第二句"').diagnostics.some(item => item.message.includes('只能有一个')));
const unconsumedParallelPreset = run([
  'parallel:',
  '  preset 漫画对话气泡 bubbleWidth 999',
  '  wait 1s',
  'ner normal "预设不应泄漏"',
].join('\n'));
assert.deepStrictEqual(unconsumedParallelPreset.diagnostics, []);
assert.strictEqual(unconsumedParallelPreset.story.lines[1].bubbleWidth, undefined);
assert.ok(compile('define hero = Spine("assets/spine/standing/ner")\nparallel:\n  missing normal "测试"').diagnostics.some(item => item.message.includes('角色未引用')));
for (const bad of ['after -1ms:', 'after 1:', 'after 1..2s:', 'after 1h:']) {
  assert.ok(run(`parallel:\n  ${bad}\n    ner normal "测试"`).diagnostics.some(item => item.severity === 'error'), bad);
}
const millisecondTiming = run([
  'show ner',
  'wait 250ms',
  'parallel:',
  '  after 500ms:',
  '    after 250ms:',
  '      wait 250ms',
  '      camera x 0 -> 10 in 500ms after 250ms',
  '      effect brightness 1 -> 0.5 in 500ms',
].join('\n'));
assert.deepStrictEqual(millisecondTiming.diagnostics, []);
assert.strictEqual(millisecondTiming.story.lines[0].timelineEnd, 0.25);
assert.strictEqual(millisecondTiming.story.lines[1].timelineEnd, 1.5);
assert.strictEqual(millisecondTiming.story.lines[1].cameraTracks[0].delay, 1);
assert.strictEqual(millisecondTiming.story.lines[1].effectTracks[0].delay, 0.75);
assert.ok(run('parallel:\n  say ner normal "第一句"\n  after 1s:\n    say ner normal "第二句"').diagnostics.some(item => item.message.includes('只能有一个')));
const waitScript = run([
  'show ner at 100,200',
  'wait 0.25s',
  'parallel:',
  '  move ner x 100 -> 300 in 0.3s ease Linear',
  '  after 0.1s:',
  '    wait 0.4s',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(waitScript.diagnostics, []);
assert.deepStrictEqual(waitScript.story.lines.map(line => line.mode), ['wait', 'wait', 'normal']);
assert.strictEqual(waitScript.story.lines[0].timelineEnd, 0.25);
assert.strictEqual(waitScript.story.lines[1].timelineEnd, 0.5);
assert.strictEqual(waitScript.story.lines[2].stage[0].x, 300);
for (const invalid of ['wait -1s', 'wait 1..2s', 'wait 1', 'parallel:\n  wait bad']) {
  assert.ok(run(invalid).diagnostics.some(item => item.severity === 'error'), invalid);
}
assert.ok(run('parallel:\n  # 空块\nner normal "继续"').diagnostics.some(item => item.message.includes('不能为空')));
assert.ok(run('parallel:\n  say ner not_a_mode "错误"').diagnostics.some(item => item.message.includes('未知模式')));
for (const move of [
  'move ner x 1 -> 2 in 1..2s',
  'move ner x 1 -> in 1s',
  'move ner x by 10 in 1s ease Typo',
  'move ner x by 10 in 1s after 0..5s',
  'move ner x by 10 in 1s unknown 2',
  'move ner x by 10 in 1s ease Linear ease OutCubic',
]) assert.ok(run(`show ner\nparallel:\n  say ner normal "测试"\n  ${move}`).diagnostics.some(item => item.severity === 'error'), move);
const timedAudio = compile([
  'show ner',
  'parallel:',
  '  audio play rain loop',
  '  after 0.5s:',
  '    audio stop rain fadeOut 1s',
  '    after 0.25s:',
  '      audio play rain volume 0.5',
  '  say ner normal "音频测试"',
].join('\n'), { audio: { rain: 'rain.wav' } });
assert.deepStrictEqual(timedAudio.diagnostics, []);
assert.deepStrictEqual(timedAudio.story.lines[0].events.map(event => [event.delay, event.command.action]), [[0, 'play'], [0.5, 'stop'], [0.75, 'play']]);
assert.strictEqual(timedAudio.story.lines[0].events[2].command.volume, 0.5);
const stagedParallel = run([
  'show ner at left',
  'parallel:',
  '  after 500ms:',
  '    show erpin at right face -1 brightness 0.8',
  '  after 500ms:',
  '    move erpin x 1342 -> 1000 in 500ms ease Linear',
  '  after 750ms:',
  '    hide ner',
  '  erpin normal "登场"',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(stagedParallel.diagnostics, []);
assert.deepStrictEqual(stagedParallel.story.lines[0].events.map(event => [event.type, event.action, event.delay]), [
  ['stage', 'show', 0.5], ['stage', 'hide', 0.75],
]);
assert.deepStrictEqual(stagedParallel.story.lines[0].actions.map(action => [action.actor, action.delay, action.duration]), [['erpin', 0.5, 0.5]]);
assert.strictEqual(stagedParallel.story.lines[1].stage.some(actor => actor.id === 'erpin'), true);
assert.strictEqual(stagedParallel.story.lines[1].stage.find(actor => actor.id === 'erpin').x, 1000);
assert.strictEqual(stagedParallel.story.lines[1].stage.some(actor => actor.id === 'ner'), false);
for (const invalid of [
  'parallel:\n  show missing at left\n  wait 1s',
  'parallel:\n  hide ???\n  wait 1s',
  'show ner\nparallel:\n  after 1s:\n    move erpin x by 10 in 1s',
]) assert.ok(run(invalid).diagnostics.some(item => item.severity === 'error'), invalid);
const hiddenBeforeAnimation = run([
  'show ner',
  'parallel:',
  '  after 1s:',
  '    anim ner Surprise_1',
  '  hide ner',
  '  wait 2s',
].join('\n'));
assert.ok(hiddenBeforeAnimation.diagnostics.some(item => item.line === 4 && item.message.includes('不在舞台')));
const reverseStage = run([
  'parallel:',
  '  after 800ms:',
  '    move ner x 100 -> 200 in 200ms ease Linear',
  '    anim ner Surprise_1',
  '  after 200ms:',
  '    show ner at 100,200',
  '  wait 1s',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(reverseStage.diagnostics, []);
assert.deepStrictEqual(reverseStage.story.lines[0].events.map(event => [event.type, event.delay]), [['stage', 0.2], ['actor', 0.8]]);
assert.deepStrictEqual([reverseStage.story.lines[1].stage[0].x, reverseStage.story.lines[1].stage[0].anim], [200, 'Surprise_1']);
const reverseBinding = compile([
  'show ner at left',
  'parallel:',
  '  after 500ms:',
  '    bind picture to ner offset 80,0',
  '  after 200ms:',
  '    show image background as picture at 960,540',
  '  wait 1s',
  'ner normal "继续"',
].join('\n'), { images: { background: 'assets/bg/elf_city_night.png' } });
assert.deepStrictEqual(reverseBinding.diagnostics, []);
assert.strictEqual(reverseBinding.story.lines[1].stage.find(actor => actor.id === 'picture').parent, 'ner');
const reversePreset = run([
  'parallel:',
  '  after 500ms:',
  '    move ner preset 跑入 duration 0.4',
  '  after 200ms:',
  '    show ner at left',
  '  wait 1s',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(reversePreset.diagnostics, []);
assert.deepStrictEqual([reversePreset.story.lines[0].actions[0].delay, reversePreset.story.lines[0].actions[0].to], [0.5, 578]);
const reverseCycle = compile([
  'show ner',
  'show image background as picture',
  'parallel:',
  '  after 800ms:',
  '    bind ner to picture',
  '  after 200ms:',
  '    bind picture to ner',
  '  wait 1s',
].join('\n'), { images: { background: 'assets/bg/elf_city_night.png' } });
assert.ok(reverseCycle.diagnostics.some(item => item.line === 5 && item.message.includes('绑定会形成循环')));
const reshowSnapshot = run([
  'show ner at 100,200',
  'parallel:',
  '  move ner x by 100 in 200ms ease Linear',
  '  after 300ms:',
  '    hide ner',
  '  after 500ms:',
  '    show ner at 300,200',
  '  wait 1s',
  'ner normal "继续"',
].join('\n'));
assert.deepStrictEqual(reshowSnapshot.diagnostics, []);
assert.strictEqual(reshowSnapshot.story.lines[1].stage[0].x, 300);
for (const invalid of [
  'parallel:\n  after 100ms:\n    move ner x 0 -> 10 in 1s\n  after 200ms:\n    show ner\n  wait 1s',
  'show ner\nparallel:\n  after 200ms:\n    hide ner\n  after 300ms:\n    move ner x 0 -> 10 in 1s\n  wait 1s',
  'parallel:\n  move ner x 0 -> 10 in 1s\n  show ner\n  wait 1s',
]) assert.ok(run(invalid).diagnostics.some(item => item.severity === 'error' && item.message.includes('不在舞台')), invalid);
const imageTimeline = compile([
  'parallel:',
  '  after 200ms:',
  '    show image background as picture at 960,540 scale 0.2 alpha 0.7',
  '  after 300ms:',
  '    move picture x 960 -> 1160 in 400ms ease Linear',
  '  after 700ms:',
  '    hide picture',
  '  wait 1s',
  'narration "结束"',
].join('\n'), { images: { background: 'assets/bg/elf_city_night.png' } });
assert.deepStrictEqual(imageTimeline.diagnostics, []);
assert.deepStrictEqual(imageTimeline.story.lines[0].events.filter(event => event.type === 'stage').map(event => [
  event.action, event.delay, event.conf?.kind, event.id,
]), [['show', 0.2, 'image', undefined], ['hide', 0.7, undefined, 'picture']]);
assert.deepStrictEqual(imageTimeline.story.lines[0].actions.map(action => [action.actor, action.delay]), [['picture', 0.3]]);
assert.strictEqual(imageTimeline.story.lines[1].stage.some(item => item.id === 'picture'), false);
const imageBinding = compile([
  'show ner at left',
  'parallel:',
  '  after 200ms:',
  '    show image background as picture at 960,540 scale 0.2',
  '  after 500ms:',
  '    bind picture to ner offset 80,0',
  '  after 800ms:',
  '    unbind picture at 100,200',
  '  wait 1s',
  'ner normal "继续"',
].join('\n'), { images: { background: 'assets/bg/elf_city_night.png' }, cast: { ner: { name: '内尔' } } });
assert.deepStrictEqual(imageBinding.diagnostics, []);
assert.deepStrictEqual(imageBinding.story.lines[0].events.filter(event => event.type === 'bind').map(event => [
  event.action, event.child, event.binding.parent, event.binding.localX, event.binding.x, event.delay,
]), [['bind', 'picture', 'ner', 80, undefined, 0.5], ['unbind', 'picture', null, 0, 100, 0.8]]);
assert.deepStrictEqual([
  imageBinding.story.lines[1].stage.find(item => item.id === 'picture').parent,
  imageBinding.story.lines[1].stage.find(item => item.id === 'picture').x,
  imageBinding.story.lines[1].stage.find(item => item.id === 'picture').y,
], [null, 100, 200]);
for (const invalid of [
  'show ner\nparallel:\n  bind missing to ner',
  'show ner\nparallel:\n  bind ner to ner',
  'image background = "assets/bg/elf_city_night.png"\nshow image background as picture\nshow ner\nparallel:\n  bind picture to ner\n  bind ner to picture',
  'image background = "assets/bg/elf_city_night.png"\nshow image background as picture\nparallel:\n  unbind picture',
]) assert.ok(compile(invalid, { images: { background: 'assets/bg/elf_city_night.png' }, cast: { ner: { name: '内尔' } } }).diagnostics.some(item => item.severity === 'error'), invalid);
assert.deepStrictEqual(run('show ner\nparallel:\n  say ner normal "测试"\n  move ner x 0 -> 10 in 1s ease InOutCubic').diagnostics, []);
assert.ok(compile('parallel:\n  say ner normal "测试"\n  after 1s:\n    audio play missing', { strictAssets: true }).diagnostics.some(item => item.message.includes('音频未引用')));
const brightness = run([
  'show ner at left brightness 0',
  'parallel:',
  '  say ner normal "亮起来"',
  '  move ner brightness 0 -> 1.5 in 1s ease Linear',
  'ner normal "完成"',
].join('\n'));
assert.deepStrictEqual(brightness.diagnostics, []);
assert.strictEqual(brightness.story.lines[0].stage[0].brightness, 0);
assert.strictEqual(brightness.story.lines[1].stage[0].brightness, 1.5);
assert.ok(run('show ner brightness -1\nner normal "错误"').diagnostics.some(item => item.severity === 'error'));
assert.ok(run('show ner brightness nope\nner normal "错误"').diagnostics.some(item => item.severity === 'error'));
for (const suffix of [
  'at lefft', 'at 10,', 'at 1e999,2', 'face 0', 'face nope', 'face',
  'scale 0', 'scale nope', 'sx 0', 'sy nope', 'alpha -0.1', 'alpha 1.1',
  'alpha nope', 'fade -1', 'fade nope', 'rot nope', 'z nope', 'pose', 'skin',
  'pose at left', 'unexpected 4',
]) {
  for (const [source, expectedLine] of [
    [`show ner ${suffix}\nner normal "测试"`, 1],
    [`spawn ner as hero ${suffix}\nner normal "测试"`, 1],
    [`parallel:\n  after 0.1s:\n    show ner ${suffix}\n  wait 1s`, 3],
  ]) {
    assert.ok(run(source).diagnostics.some(item => item.severity === 'error' && item.line === expectedLine), source);
  }
}
const checkedActor = run('show ner at -1.5,.25 face -1 scale .8 sx -1 alpha 0 brightness 0 rot 0 z -2\nner normal "测试"');
assert.deepStrictEqual(checkedActor.diagnostics, []);
assert.deepStrictEqual(
  ['x', 'y', 'face', 'sx', 'sy', 'alpha', 'brightness', 'rot', 'z'].map(key => checkedActor.story.lines[0].stage[0][key]),
  [-1.5, 0.25, -1, -1, 0.8, 0, 0, 0, -2]);
for (const alpha of ['-0.1', '1.1']) {
  const source = `image background = "assets/bg/elf_city_night.png"\nshow image background as picture alpha ${alpha}\nnarration "测试"`;
  assert.ok(compile(source, { presets, projectRoot: demoProject }).diagnostics.some(item =>
    item.severity === 'error' && item.line === 2 && item.message.includes('alpha')), source);
}
const globalEffect = run('effect brightness 0\nner normal "黑屏"');
assert.strictEqual(globalEffect.story.lines[0].fx.brightness, 0);
assert.ok(run('effect brightness invalid\nner normal "错误"').diagnostics.some(item => item.severity === 'error'));
const parallelOneShot = compile([
  'define emoticon = Spine("assets/spine/emoticon")',
  'parallel:',
  '  after 250ms:',
  '    oneshot spine emoticon anim Idea at 960,560 scale 1.2 alpha 0.8 rot -12',
  '  wait 2s',
].join('\n'), { projectRoot: demoProject });
assert.deepStrictEqual(parallelOneShot.diagnostics, []);
assert.deepStrictEqual(
  parallelOneShot.story.lines[0].events.map(event => [event.type, event.delay, event.oneShot?.spineFile, event.oneShot?.x, event.oneShot?.scale]),
  [['oneshot', 0.25, 'Emoticon', 960, 1.2]],
);
assert.strictEqual(parallelOneShot.story.lines[0].events[0].oneShot.alpha, 0.8);
assert.strictEqual(parallelOneShot.story.lines[0].events[0].oneShot.rot, -12);
assert.ok(compile('parallel:\n  oneshot spine missing anim Idea\n  wait 1s').diagnostics.some(item => item.message.includes('未注册的 Spine 素材')));
for (const invalid of [
  'parallel:\n  oneshot spine emoticon anim Idea alpha 2\n  wait 1s',
  'parallel:\n  oneshot spine emoticon anim Idea scale 0\n  wait 1s',
]) {
  assert.ok(compile(`define emoticon = Spine("assets/spine/emoticon")\n${invalid}`, { projectRoot: demoProject }).diagnostics.some(item => item.severity === 'error'), invalid);
}
console.log('preset-parameters.test.js: ok');

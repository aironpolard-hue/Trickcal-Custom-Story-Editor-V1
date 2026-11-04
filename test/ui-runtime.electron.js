'use strict';

const { app, BrowserWindow } = require('electron');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { compile } = require('../compiler/trickcal');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'templates', 'minimal-demo');
const runtime = path.join(root, 'runtime');
const fixture = [
  'define hero = Spine("assets/spine/standing/ner", name="内尔")',
  'show hero at 500,900 scale 1',
  'ui show bubble frame at 0,0 size 760,160 style thought grow words padding 120 maxheight 600',
  'ui bind frame to hero offset 460,-500',
  'ui show text words at 0,0 size 300,160 font 48 speed 0.1 color "white" overflow grow maxheight 400',
  'ui bind words to frame offset 0,0',
  'ui write words "这是独立打字机。文字会在指定范围内换行，点击后显示完整内容。"',
  'ui show bubble reply at 1400,430 size 500,250 style manga',
  'ui show text reply_text at 0,0 size 360,160 font 36',
  'ui bind reply_text to reply offset 0,0',
  'ui write reply_text "第二个气泡。"',
  'parallel:',
  '  ui present',
  '  move hero x 500 -> 600 in 0.4s ease Linear',
  'ui write reply_text "移动后的文字。"',
  'parallel:',
  '  ui present',
  '  ui move reply x 1400 -> 1300 in 0.4s ease Linear',
  '  ui move reply y 430 -> 320 in 0.4s ease Linear',
  'ui remove reply',
  'ui remove frame',
  'ui show box effect at 960,380 size 680,240 style sfx',
  'ui show text noise at 0,0 size 560,180 font 58',
  'ui bind noise to effect offset 0,0',
  'ui write noise "哐当——！"',
  'ui present',
  'ui remove effect',
  'narration "继续"',
  'end',
].join('\n');
const compiled = compile(fixture, { projectRoot: project });
assert.deepStrictEqual(compiled.diagnostics, []);
const earlyStageCompiled = compile([
  'image sign = "assets/dialogue/Dialogue_Button_Active.png"',
  'show image sign as picture at 100,300 alpha 1',
  'parallel:',
  '  move picture x 100 -> 500 in 10s ease Linear',
  '  move picture alpha 1 -> 0 in 10s ease Linear',
  '  after 5s:',
  '    show image sign as late at 600,300',
  '  narration "第一句"',
  'narration "第二句"',
  'narration "第三句"',
  'show image sign as picture at 500,300 alpha 1',
  'narration "明确重新显示"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(earlyStageCompiled.diagnostics, []);
const earlyActorCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'show ner at 100,900 pose Idle_1',
  'parallel:',
  '  move ner x 100 -> 500 in 10s ease Linear',
  '  after 5s:',
  '    anim ner Surprise_1',
  '  ner normal "第一句" exit none',
  'wait 0.1s',
  'ner normal "第二句"',
  'show ner at 500,900 pose Idle_1',
  'ner normal "明确重新显示"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(earlyActorCompiled.diagnostics, []);
const earlyEnvironmentCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'camera x 5',
  'effect brightness 1',
  'parallel:',
  '  camera x 5 -> 105 in 10s ease Linear',
  '  effect brightness 1 -> 0.4 in 10s ease Linear',
  '  after 5s:',
  '    camera y 999',
  '    effect saturation 0',
  '  ner normal "第一句" exit none',
  'wait 0.1s',
  'ner normal "第二句"',
  'camera x 105',
  'effect brightness 0.4',
  'ner normal "明确设置"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(earlyEnvironmentCompiled.diagnostics, []);
const earlyBackgroundCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'image station = "assets/bg/elf_city_night.png"',
  'scene bg black',
  'shader gray 0.5',
  'parallel:',
  '  after 1s:',
  '    scene bg station in 4s ease Linear',
  '  after 5s:',
  '    shader reset',
  '  ner normal "第一句" exit none',
  'ner normal "继续"',
  'scene bg station',
  'shader reset',
  'ner normal "明确切换"',
  'scene bg black',
  'ner normal "黑场"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(earlyBackgroundCompiled.diagnostics, []);
const earlyBackgroundFollowCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'image station = "assets/bg/elf_city_night.png"',
  'scene bg black',
  'parallel:',
  '  after 1s:',
  '    scene bg station in 4s ease Linear',
  '  ner normal "第一句" exit none',
  'parallel:',
  '  after 0.5s:',
  '    scene bg black in 2s ease Linear',
  '  ner normal "第二句"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(earlyBackgroundFollowCompiled.diagnostics, []);
const slowShaderCarryCompiled = compile([
  'shader heat 0.2',
  'narration "第一句"',
  'narration "第二句"',
  'shader reset',
  'narration "关闭效果"',
].join('\n'));
assert.deepStrictEqual(slowShaderCarryCompiled.diagnostics, []);
const branchContinuityCompiled = compile([
  'image sign = "assets/dialogue/Dialogue_Button_Active.png"',
  'default route = false',
  'show image sign as picture at 100,300',
  'scene bg black',
  'shader gray 0.5',
  'parallel:',
  '  move picture x 100 -> 500 in 10s ease Linear',
  '  camera x 0 -> 100 in 10s ease Linear',
  '  effect brightness 1 -> 0.5 in 10s ease Linear',
  '  after 5s:',
  '    show image sign as late at 700,300',
  '    shader reset',
  '  narration "并行"',
  'if route:',
  '  show image sign as if_only at 700,300',
  '  camera y 99',
  'else:',
  '  effect saturation 0.5',
  'narration "条件后"',
  'choice "选择"',
  '  "左" -> left',
  '  "右" -> right',
  'label left:',
  '  camera x 120',
  '  narration "左"',
  '  jump merge',
  'label right:',
  '  shader reset',
  '  narration "右"',
  '  jump merge',
  'label bait:',
  '  show image sign as trap at 999,300',
  '  camera y 333',
  'label merge:',
  '  narration "汇合"',
  '  end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(branchContinuityCompiled.diagnostics, []);
const loopContinuityCompiled = compile([
  'default visit = 0',
  'label start:',
  '  set visit += 1',
  '  choice "再来一次？"',
  '    "继续" -> start',
  '    "结束" -> finish',
  'label finish:',
  '  narration "完成"',
  '  end',
].join('\n'));
assert.deepStrictEqual(loopContinuityCompiled.diagnostics, []);
const transitionContinuityCompiled = compile([
  'image sign = "assets/dialogue/Dialogue_Button_Active.png"',
  'show image sign as picture at 100,300',
  'parallel:',
  '  move picture x 100 -> 500 in 10s ease Linear',
  '  camera x 0 -> 100 in 10s ease Linear',
  '  effect brightness 1 -> 0.5 in 10s ease Linear',
  '  narration "并行"',
  'transition fadeblack hold 0.2',
  'narration "转场后"',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(transitionContinuityCompiled.diagnostics, []);
const busyLoopCompiled = compile('label loop:\n  jump loop');
assert.deepStrictEqual(busyLoopCompiled.diagnostics, []);
const audioControlStories = [
  [
    'define audio.rain = "assets/audio/silent.wav"',
    'default selected = false',
    'if selected:',
    '  audio play rain',
    'else:',
    '  camera x 0',
    'narration "继续"',
  ],
  [
    'define audio.rain = "assets/audio/silent.wav"',
    'default selected = true',
    'if selected:',
    '  audio play rain',
    'else:',
    '  camera x 0',
    'narration "继续"',
  ],
  [
    'define audio.rain = "assets/audio/silent.wav"',
    'jump target',
    'audio play rain',
    'label target:',
    'narration "跳过音频"',
  ],
  [
    'define audio.rain = "assets/audio/silent.wav"',
    'audio play rain',
    'jump target',
    'label target:',
    'narration "播放音频"',
  ],
].map(lines => {
  const result = compile(lines.join('\n'), { projectRoot: project });
  assert.deepStrictEqual(result.diagnostics, []);
  return result.story;
});
const automaticUiCompiled = compile([
  'ui show bubble frame at 100,200 size 500,250 style manga',
  'parallel:',
  '  after 200ms:',
  '    ui move frame x 100 -> 300 in 1s ease Linear',
  'parallel:',
  '  ui move frame y by 80 in 400ms ease Linear',
  'narration "继续"',
  'end',
].join('\n'));
assert.deepStrictEqual(automaticUiCompiled.diagnostics, []);
const dialogueUiCompiled = compile([
  'ui show bubble frame at 300,340 size 500,250 style manga',
  'ui show text words at 0,0 size 300,120 font 36',
  'ui bind words to frame offset 10,20',
  'ui write words "独立文字"',
  'parallel:',
  '  ui move frame x by 200 in 1s ease Linear',
  '  after 200ms:',
  '    ui move frame alpha 1 -> 0.5 in 800ms ease Linear',
  '  narration "同步台词"',
  'sfx "下一句"',
  'end',
].join('\n'));
assert.deepStrictEqual(dialogueUiCompiled.diagnostics, []);
const uiAnimationTimingCompiled = compile([
  'ui show bubble bubble at 400,300 style thought',
  'ui show box mono at 960,500 style monologue',
  'ui show box thought_box at 1400,500 style monologueThought',
  'ui present',
  'narration "继续"',
  'end',
].join('\n'));
assert.deepStrictEqual(uiAnimationTimingCompiled.diagnostics, []);
const uiStageParentCompiled = compile([
  'image sign = "assets/dialogue/Dialogue_Button_Active.png"',
  'show image sign as picture at 500,400 scale 0.5',
  'ui show bubble card at 0,0 size 400,200 style manga',
  'ui bind card to picture offset 100,0',
  'ui present',
  'parallel:',
  '  after 100ms:',
  '    hide picture',
  '  wait 300ms',
  'parallel:',
  '  after 100ms:',
  '    show image sign as picture at 900,400 scale 0.5',
  '  wait 500ms',
  'ui present',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(uiStageParentCompiled.diagnostics, []);
const uiSlowSpineParentCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'show ner at 500,900',
  'ui show bubble card at 0,0 size 400,200 style manga',
  'ui bind card to ner offset 100,-200',
  'ui present',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(uiSlowSpineParentCompiled.diagnostics, []);
const timedUiEventsCompiled = compile([
  'parallel:',
  '  ui present',
  '  after 100ms:',
  '    ui show bubble frame at 960,400 size 500,250',
  '    ui show text words at 0,0 size 300,120 font 36 speed 0.1',
  '    ui bind words to frame offset 0,0',
  '  after 300ms:',
  '    ui write words "这段文字需要等待它逐字显示完成。"',
  '  after 1s:',
  '    ui set frame alpha 0.5',
  '  wait 1.2s',
  'narration "下一段"',
  'ui remove frame',
  'end',
].join('\n'));
assert.deepStrictEqual(timedUiEventsCompiled.diagnostics, []);
const mixedUiTimelineCompiled = compile([
  'parallel:',
  '  ui present',
  '  after 100ms:',
  '    ui show bubble frame at 100,200 size 500,250',
  '    ui show text words at 0,0 size 300,120',
  '    ui bind words to frame offset 0,0',
  '    ui move frame x by 200 in 1s ease Linear',
  '  after 300ms:',
  '    ui write words "移动期间写字。"',
  '  after 500ms:',
  '    ui set frame alpha 0.8',
  '  after 700ms:',
  '    ui set frame at 600,250',
  '  after 800ms:',
  '    ui move frame x by 100 in 400ms ease Linear',
  '  after 1s:',
  '    ui remove frame',
  '  after 1.1s:',
  '    ui show bubble frame at 50,300 size 500,250',
  '    ui move frame y by 100 in 400ms ease Linear',
  '  wait 1.5s',
  'narration "下一段"',
  'end',
].join('\n'));
assert.deepStrictEqual(mixedUiTimelineCompiled.diagnostics, []);
const invalidUiMoveOrderCompiled = compile([
  'parallel:',
  '  ui present',
  '  after 200ms:',
  '    ui move frame x by 100 in 1s ease Linear',
  '    ui show bubble frame',
  'narration "下一段"',
  'end',
].join('\n'));
assert.deepStrictEqual(invalidUiMoveOrderCompiled.diagnostics, []);
const uiBindDuringMotionCompiled = compile([
  'ui show bubble parent at 300,400 size 500,250',
  'ui show bubble child at 100,200 size 300,180',
  'parallel:',
  '  ui present',
  '  ui move child x by 200 in 1s ease Linear',
  '  after 500ms:',
  '    ui bind child to parent offset 20,0',
  '  after 700ms:',
  '    ui move child x by 100 in 500ms ease Linear',
  'narration "继续"',
  'end',
].join('\n'));
assert.deepStrictEqual(uiBindDuringMotionCompiled.diagnostics, []);
const timedDialogueUiCompiled = compile([
  'parallel:',
  '  narration "短句" hold 0',
  '  after 200ms:',
  '    ui show text words at 960,400 speed 0.1',
  '    ui write words "独立文字还在慢慢显示。"',
  '  wait 200ms',
  'narration "下一段"',
  'end',
].join('\n'));
assert.deepStrictEqual(timedDialogueUiCompiled.diagnostics, []);
const invalidTimedUiEventsCompiled = compile([
  'ui show bubble frame',
  'parallel:',
  '  ui present',
  '  after 200ms:',
  '    ui remove frame',
  '  after 400ms:',
  '    ui remove frame',
  'end',
].join('\n'));
assert.deepStrictEqual(invalidTimedUiEventsCompiled.diagnostics, []);
const timedUiStageCollisionCompiled = compile([
  'image sign = "assets/bg/elf_city_night.png"',
  'ui show bubble frame',
  'parallel:',
  '  after 200ms:',
  '    show image sign as frame',
  '  wait 1s',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(timedUiStageCollisionCompiled.diagnostics, []);
const tutorialProject = path.join(root, 'projects', '雨夜的末班车');
const manifest = JSON.parse(fs.readFileSync(path.join(tutorialProject, 'trickcal.project.json'), 'utf8'));
const presets = fs.readdirSync(path.join(tutorialProject, 'presets')).filter(file => file.endsWith('.json')).map(file => ({
  file, ...JSON.parse(fs.readFileSync(path.join(tutorialProject, 'presets', file), 'utf8')),
}));
const tutorialCompiled = compile(fs.readFileSync(path.join(tutorialProject, manifest.entry), 'utf8'), { ...manifest, projectRoot: tutorialProject, presets });
assert.deepStrictEqual(tutorialCompiled.diagnostics.filter(d => d.severity === 'error'), []);
const clearReCompiled = compile([
  'image portrait = "assets/herohead/ner.png"',
  'image other_portrait = "assets/herohead/erpin.png"',
  'define hero = Spine("assets/spine/standing/ner", name="内尔", avatar=portrait)',
  'define other = Spine("assets/spine/standing/erpin", name="艾尔芬", avatar=other_portrait)',
  'hero clear "第一句。" avatarBg "#11aa22"',
  'other clearRe "第二句。" avatarBg "#cc4455"',
  'hero clearRe "第三句。" avatarBg "#3366aa" enter none',
  'other clear "独立的新框。" enter none',
  'parallel:',
  '  after 3s:',
  '    hero clearRe "延迟的独白。"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(clearReCompiled.diagnostics, []);
const boundImageEffectsCompiled = compile([
  'image station = "assets/bg/elf_city_night.png"',
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'show image station as parent at 700,540 scale 0.12',
  'show image station as child at 900,540 scale 1',
  'bind child to parent offset 200,0',
  'parallel:',
  '  move parent x 700 -> 900 in 1s ease Linear',
  '  move child alpha 1 -> 0.2 in 1s ease Linear',
  '  move child brightness 1 -> 0.4 in 1s ease Linear',
  '  ner normal "绑定图片与父级一起移动。" ',
  'ner normal "继续。" ',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(boundImageEffectsCompiled.diagnostics, []);
const imageReplacementCompiled = compile([
  'image first = "assets/dialogue/Dialogue_Button_Active.png"',
  'image second = "assets/bg/elf_arthall_night.png"',
  'scene bg black',
  'show image first as ner at 960,450 scale 0.3',
  'narration "第一张图片。" ',
  'show image second as ner at 960,450 scale 0.3',
  'narration "第二张图片。" ',
  'parallel:',
  '  after 100ms:',
  '    show image first as ner at 960,450 scale 0.3',
  '  after 200ms:',
  '    show image second as ner at 960,450 scale 0.3',
  '  wait 1s',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(imageReplacementCompiled.diagnostics, []);
const mixedBindingChainCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'define erpin = Spine("assets/spine/standing/erpin", name="艾尔芬")',
  'image station = "assets/bg/elf_city_night.png"',
  'show erpin at 200,300 z -100',
  'show ner at 100,200 z 100',
  'parallel:',
  '  show image station as leaf at 400,500 scale 0.4 z -100',
  '  show image station as middle at 400,500 scale 0.2 z 100',
  '  bind middle to ner offset 80,50',
  '  bind leaf to middle offset 150,-40',
  '  bind erpin to middle offset 40,25',
  '  move ner x 100 -> 900 in 1s ease Linear',
  '  move ner rot 0 -> 90 in 1s ease Linear',
  '  ner normal "角色、图片、角色的三级绑定。" ',
  'ner normal "继续。" ',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(mixedBindingChainCompiled.diagnostics, []);
const transitionCompiled = compile([
  'image station = "assets/bg/elf_city_night.png"',
  'scene bg station',
  'preset 转场·黑场 hold 1',
  'transition',
  'narration "完成"',
  'end',
].join('\n'), { projectRoot: project, presets });
assert.deepStrictEqual(transitionCompiled.diagnostics, []);
const newsEntryCompiled = compile([
  'preset 新闻框·主播',
  'news anchor "新闻主播"',
  'preset 新闻框·简报 entryDuration 1',
  'news summary "新闻简报"',
  'preset 新闻框·主播 enter none entryDuration 1',
  'news anchor "无入场"',
  'parallel:',
  '  after 500ms:',
  '    preset 新闻框·简报 entryDuration 1',
  '    news summary "延迟简报"',
  'end',
].join('\n'), { presets });
assert.deepStrictEqual(newsEntryCompiled.diagnostics, []);
const badCompiled = compile('ui write missing "错误"\nui present');
assert.ok(badCompiled.diagnostics.some(item => item.message.includes('未创建：missing')));
const animationCompiled = compile([
  'ui show bubble thought_frame at 960,540 size 760,320 style thought tail bl',
  'ui present',
  'ui set thought_frame style manga',
  'ui present',
  'end',
].join('\n'));
assert.deepStrictEqual(animationCompiled.diagnostics, []);
const imageActionCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'spawn image background as picture at 960,540 scale 0.2 alpha 1 brightness 0',
  'show ner at 500,1000 brightness 0',
  'parallel:',
  '  say ner normal "图片透明度测试"',
  '  move picture alpha 1 -> 0.2 in 1s ease Linear',
  '  move picture x 960 -> 1160 in 1s ease Linear',
  '  move picture brightness 0 -> 1 in 1s ease Linear',
  '  move ner brightness 0 -> 1 in 1s ease Linear',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(imageActionCompiled.diagnostics, []);
const orderedMovesCompiled = compile([
  'image background = "assets/bg/elf_city_night.png"',
  'spawn image background as picture at 0,540 scale 0.2',
  'parallel:',
  '  after 1s:',
  '    move picture x 100 -> 200 in 1s ease Linear',
  '  after 500ms:',
  '    move picture x 0 -> 100 in 1s ease Linear',
  '  narration "按时间排序"',
  'narration "完成"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(orderedMovesCompiled.diagnostics, []);
const delayedFadeCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'spawn image background as picture at 960,540 scale 0.2 alpha 0',
  'show ner at 500,1000 alpha 0',
  'parallel:',
  '  after 0.5s:',
  '    move picture alpha 0 -> 1 in 1s ease Linear',
  '    move ner alpha 0 -> 1 in 1s ease Linear',
  '  say ner normal "延迟淡入"',
  'hide all',
  'narration "移除后"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(delayedFadeCompiled.diagnostics, []);
const timedAudioCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'define audio.rain = "assets/audio/silent.wav"',
  'show ner',
  'parallel:',
  '  audio play rain loop',
  '  after 0.5s:',
  '    audio stop rain',
  '    audio play rain',
  '  after 2s:',
  '    audio stop rain',
  '  say ner normal "时间线"',
  'ner normal "下一句"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(timedAudioCompiled.diagnostics, []);
const stagedParallelCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'define erpin = Spine("assets/spine/standing/erpin", name="艾尔芬")',
  'show ner at left',
  'parallel:',
  '  after 0.5s:',
  '    show erpin at right face -1',
  '  after 0.5s:',
  '    move erpin x 1342 -> 1000 in 0.5s ease Linear',
  '  after 0.75s:',
  '    hide ner',
  '  erpin normal "登场"',
  'ner normal "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(stagedParallelCompiled.diagnostics, []);
const imageParallelCompiled = compile([
  'image background = "assets/bg/elf_city_night.png"',
  'scene bg black',
  'parallel:',
  '  after 0.2s:',
  '    show image background as picture at 960,540 scale 0.2 alpha 0.7',
  '  after 0.3s:',
  '    move picture x 960 -> 1160 in 0.4s ease Linear',
  '  after 0.7s:',
  '    hide picture',
  '  wait 1s',
  'narration "图片时间线结束"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(imageParallelCompiled.diagnostics, []);
const reshowParallelCompiled = compile([
  'image background = "assets/bg/elf_city_night.png"',
  'show image background as picture at 100,540 scale 0.2',
  'parallel:',
  '  after 500ms:',
  '    show image background as picture at 300,540 scale 0.2',
  '  after 300ms:',
  '    hide picture',
  '  move picture x by 100 in 200ms ease Linear',
  '  wait 1s',
  'narration "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(reshowParallelCompiled.diagnostics, []);
const bindingParallelCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'show ner at left',
  'parallel:',
  '  after 0.2s:',
  '    show image background as picture at 960,540 scale 0.2',
  '  after 0.5s:',
  '    bind picture to ner offset 80,0',
  '  after 0.8s:',
  '    unbind picture at 100,200',
  '  wait 1s',
  'narration "绑定结束"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(bindingParallelCompiled.diagnostics, []);
const actorImageBindingCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner")',
  'image background = "assets/bg/elf_city_night.png"',
  'show image background as picture at 960,540 scale 0.2',
  'parallel:',
  '  after 500ms:',
  '    bind ner to picture offset 80,50',
  '  after 200ms:',
  '    show ner at left',
  '  wait 2s',
  'narration "结束"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(actorImageBindingCompiled.diagnostics, []);
const delayedDialogueCompiled = compile([
  'parallel:',
  '  after 500ms:',
  '    after 1s:',
  '      ner normal "延迟出现的台词"',
  'ner normal "下一句"',
  'end',
].join('\n'));
assert.deepStrictEqual(delayedDialogueCompiled.diagnostics, []);
const waitCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'spawn image background as picture at 100,540 scale 0.2',
  'wait 0.2s',
  'parallel:',
  '  move picture x 100 -> 300 in 0.3s ease Linear',
  '  after 0.1s:',
  '    wait 0.3s',
  'ner normal "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(waitCompiled.diagnostics, []);
const stageEventsCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'show ner pose Idle_1',
  'parallel:',
  '  camera x 20',
  '  after 0.5s:',
  '    camera zoom 1.5',
  '    anim ner Surprise_1 fade 0',
  '  after 0.8s:',
  '    camera move -30,50',
  '    skin ner Normal',
  '  say ner normal "时间线"',
  'ner normal "下一句"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(stageEventsCompiled.diagnostics, []);
const cameraMotionCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'spawn image background as picture at 960,540 scale 0.2',
  'parallel:',
  '  camera zoom 1 -> 2 in 2s ease Linear',
  '  camera x by 100 in 2s ease Linear',
  '  after 1s:',
  '    camera y -30',
  '  after 1.5s:',
  '    camera x 10',
  '  say ner normal "镜头移动"',
  'ner normal "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(cameraMotionCompiled.diagnostics, []);
const typingCompiled = compile([
  'preset 普通打字机 speed 0.1 punctuationPause 0.2 typeSpeed 2',
  'ner normal "甲，<speed=2>乙丙</speed><pause=0.4>丁。"',
  'preset 普通打字机 speed 0.2 punctuationPause 0 typeSpeed 1',
  'ner normal "甲，<speed=2>乙丙</speed><pause=0.4>丁。"',
  'end',
].join('\n'), { presets: [{ name: '普通打字机', type: 'typewriter', fields: { typeSpeed: 1, punctuationPause: 0.12 } }] });
assert.deepStrictEqual(typingCompiled.diagnostics, []);
const sceneTimelineCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'scene bg black',
  'parallel:',
  '  after 0.5s:',
  '    scene bg background in 500ms ease Linear',
  '    effect brightness 0.4',
  '    effect tint "#ff0000" 0',
  '  after 0.8s:',
  '    scene bg black',
  '  after 1s:',
  '    effect brightness 1',
  '  say ner normal "场景变化"',
  'ner normal "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(sceneTimelineCompiled.diagnostics, []);
const effectMotionCompiled = compile([
  'define ner = Spine("assets/spine/standing/ner", name="内尔")',
  'image background = "assets/bg/elf_city_night.png"',
  'scene bg background',
  'effect tint "#ff0000" 0',
  'parallel:',
  '  effect brightness 0.1 -> 1 in 2s ease Linear',
  '  effect tintAlpha 0 -> 1 in 2s ease Linear',
  '  after 1s:',
  '    effect saturation 1 -> 0 in 1s ease Linear',
  '  after 1.5s:',
  '    effect brightness 0.8',
  '  say ner normal "灯光渐变"',
  'ner normal "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(effectMotionCompiled.diagnostics, []);
const shaderTimelineCompiled = compile([
  '同时:',
  '  shader heat 0.35',
  '  after 500ms:',
  '    shader reset',
  '  wait 1s',
  'narration "着色器时间线"',
  'end',
].join('\n'));
assert.deepStrictEqual(shaderTimelineCompiled.diagnostics, []);
const shaderFailureCompiled = compile([
  'shader custom "assets/shaders/missing.frag"',
  'narration "着色器加载失败也应继续播放。" ',
  'end',
].join('\n'));
assert.deepStrictEqual(shaderFailureCompiled.diagnostics, []);
const parallelOneShotCompiled = compile([
  'define emoticon = Spine("assets/spine/emoticon")',
  'parallel:',
  '  after 200ms:',
  '    oneshot spine emoticon anim Idea at 960,560 scale 1.2 alpha 0.8 rot -12',
  '  wait 4s',
  'narration "表情结束"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(parallelOneShotCompiled.diagnostics, []);
const standaloneOneShotCompiled = compile([
  'define emoticon = Spine("assets/spine/emoticon")',
  'oneshot spine emoticon anim Idea at 960,560 scale 1',
  'narration "表情结束"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(standaloneOneShotCompiled.diagnostics, []);
const pendingActorCompiled = compile([
  'define erpin = Spine("assets/spine/standing/erpin")',
  'parallel:',
  '  show erpin at right pose Idle_1',
  '  after 200ms:',
  '    anim erpin Happy_1',
  '  after 500ms:',
  '    hide erpin',
  '  wait 3s',
  'narration "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(pendingActorCompiled.diagnostics, []);
const pendingAppearanceCompiled = compile([
  'define erpin = Spine("assets/spine/standing/erpin")',
  'parallel:',
  '  show erpin at right pose Idle_1',
  '  after 200ms:',
  '    anim erpin Happy_1',
  '  wait 3s',
  'narration "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(pendingAppearanceCompiled.diagnostics, []);
const pendingInitialHiddenCompiled = compile([
  'define erpin = Spine("assets/spine/standing/erpin")',
  'show erpin at right',
  'parallel:',
  '  after 500ms:',
  '    hide erpin',
  '  wait 3s',
  'narration "继续"',
  'end',
].join('\n'), { projectRoot: project });
assert.deepStrictEqual(pendingInitialHiddenCompiled.diagnostics, []);
const branchCompiled = compile([
  'choice "选择"',
  '  "左" -> left',
  '  "右" -> right',
  'label left:',
  '  ui show bubble left_frame',
  '  ui present',
  '  jump done',
  'label right:',
  '  ui show bubble right_frame',
  '  ui present',
  'label done:',
  '  end',
].join('\n'));
assert.deepStrictEqual(branchCompiled.diagnostics, []);
const convergeCompiled = compile([
  'choice "选择"',
  '  "左" -> left',
  '  "右" -> right',
  'label left:',
  '  ui show bubble left_frame',
  '  ui present',
  '  jump shared',
  'label right:',
  '  ui show bubble right_frame',
  '  ui present',
  'label shared:',
  '  ui show text words speed 0.1',
  '  ui write words "这里的文字会重新打出来。" ',
  '  ui present',
  '  narration "下一段"',
  '  end',
].join('\n'));
assert.deepStrictEqual(convergeCompiled.diagnostics, []);
const variableCompiled = compile([
  'default trust = 0',
  'set trust += 1',
  'if trust >= 1:',
  '  narration "条件成立"',
  'else:',
  '  narration "条件不成立"',
  'choice "信任程度如何？"',
  '  "继续" -> continue',
  '  "离开" -> leave if trust >= 2',
  'label continue:',
  '  set trust = 3',
  '  if trust == 3:',
  '    narration "嵌套条件也成立"',
  '  else:',
  '    narration "嵌套条件未成立"',
  '  end',
  'label leave:',
  '  narration "离开"',
  '  end',
].join('\n'));
assert.deepStrictEqual(variableCompiled.diagnostics, []);

function serveFile(res, base, relative) {
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

app.whenReady().then(async () => {
  const pendingSlowImages = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/story.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(compiled.story));
    } else if (pathname === '/automatic-ui.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(automaticUiCompiled.story));
    } else if (pathname === '/dialogue-ui.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dialogueUiCompiled.story));
    } else if (pathname === '/ui-animation-timing.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(uiAnimationTimingCompiled.story));
    } else if (pathname === '/ui-stage-parent.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(uiStageParentCompiled.story));
    } else if (pathname === '/ui-slow-spine-parent.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(uiSlowSpineParentCompiled.story));
    } else if (pathname === '/timed-ui-events.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(timedUiEventsCompiled.story));
    } else if (pathname === '/mixed-ui-timeline.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mixedUiTimelineCompiled.story));
    } else if (pathname === '/invalid-ui-move-order.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(invalidUiMoveOrderCompiled.story));
    } else if (pathname === '/ui-bind-during-motion.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(uiBindDuringMotionCompiled.story));
    } else if (pathname === '/timed-dialogue-ui.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(timedDialogueUiCompiled.story));
    } else if (pathname === '/invalid-timed-ui-events.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(invalidTimedUiEventsCompiled.story));
    } else if (pathname === '/timed-ui-stage-collision.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(timedUiStageCollisionCompiled.story));
    } else if (pathname === '/bad.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(badCompiled.story));
    } else if (pathname === '/branch.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(branchCompiled.story));
    } else if (pathname === '/converge.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(convergeCompiled.story));
    } else if (pathname === '/variables.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(variableCompiled.story));
    } else if (pathname === '/animation.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(animationCompiled.story));
    } else if (pathname === '/image-action.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(imageActionCompiled.story));
    } else if (pathname === '/ordered-moves.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(orderedMovesCompiled.story));
    } else if (pathname === '/delayed-fade.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(delayedFadeCompiled.story));
    } else if (pathname === '/timed-audio.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(timedAudioCompiled.story));
    } else if (pathname === '/staged-parallel.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stagedParallelCompiled.story));
    } else if (pathname === '/image-parallel.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(imageParallelCompiled.story));
    } else if (pathname === '/reshow-parallel.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reshowParallelCompiled.story));
    } else if (pathname === '/binding-parallel.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(bindingParallelCompiled.story));
    } else if (pathname === '/actor-image-binding.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(actorImageBindingCompiled.story));
    } else if (pathname === '/delayed-dialogue.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(delayedDialogueCompiled.story));
    } else if (pathname === '/wait.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(waitCompiled.story));
    } else if (pathname === '/stage-events.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stageEventsCompiled.story));
    } else if (pathname === '/camera-motion.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cameraMotionCompiled.story));
    } else if (pathname === '/typing.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(typingCompiled.story));
    } else if (pathname === '/scene-timeline.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sceneTimelineCompiled.story));
    } else if (pathname === '/effect-motion.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(effectMotionCompiled.story));
    } else if (pathname === '/shader-timeline.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(shaderTimelineCompiled.story));
    } else if (pathname === '/shader-failure.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(shaderFailureCompiled.story));
    } else if (pathname === '/parallel-oneshot.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parallelOneShotCompiled.story));
    } else if (pathname === '/standalone-oneshot.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(standaloneOneShotCompiled.story));
    } else if (pathname === '/pending-actor.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pendingActorCompiled.story));
    } else if (pathname === '/pending-appearance.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pendingAppearanceCompiled.story));
    } else if (pathname === '/pending-initial-hidden.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pendingInitialHiddenCompiled.story));
    } else if (pathname === '/tutorial.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tutorialCompiled.story));
    } else if (pathname === '/clear-reentry.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(clearReCompiled.story));
    } else if (pathname === '/bound-image-effects.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(boundImageEffectsCompiled.story));
    } else if (pathname === '/image-replacement.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(imageReplacementCompiled.story));
    } else if (pathname === '/mixed-binding-chain.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mixedBindingChainCompiled.story));
    } else if (pathname === '/slow-image-project/assets/dialogue/Dialogue_Button_Active.png') {
      res.setHeader('Cache-Control', 'no-store');
      pendingSlowImages.push(res);
    } else if (pathname.startsWith('/slow-image-project/')) {
      serveFile(res, project, pathname.slice('/slow-image-project/'.length));
    } else if (pathname === '/transition.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(transitionCompiled.story));
    } else if (pathname === '/news-entry.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newsEntryCompiled.story));
    } else if (pathname.startsWith('/project/')) {
      serveFile(res, project, pathname.slice('/project/'.length));
    } else if (pathname.startsWith('/slow-project/')) {
      const relative = pathname.slice('/slow-project/'.length);
      if (relative.endsWith('.skel.bytes')) {
        res.setHeader('Cache-Control', 'no-store');
        setTimeout(() => { if (!res.destroyed) serveFile(res, project, relative); }, 2200);
      } else serveFile(res, project, relative);
    } else if (pathname.startsWith('/tutorial-project/')) {
      serveFile(res, tutorialProject, pathname.slice('/tutorial-project/'.length));
    } else {
      serveFile(res, runtime, pathname === '/' ? 'index.html' : pathname.slice(1));
    }
  });
  let win;
  let failed = false;
  const errors = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    win = new BrowserWindow({ show: false, width: 1200, height: 720, webPreferences: { backgroundThrottling: false } });
    if (process.env.TRICKCAL_TEST_FORCE_FAILURE === '1') throw new Error('intentional test harness failure');
    win.webContents.on('render-process-gone', (_, details) => errors.push(details.reason));
    win.webContents.on('console-message', event => {
      if (event.level === 'error') errors.push(event.message);
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/`);
    const deadline = Date.now() + 20000;
    let state;
    while (Date.now() < deadline) {
      state = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        return demo && demo.state.started && demo.STORY[demo.state.line]
          ? { mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size } : null;
      })()`);
      if (state && state.mode === 'ui-present') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(state, { mode: 'ui-present', count: 4 }, JSON.stringify(errors));
    const earlyStage = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(earlyStageCompiled.story)});
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const first = { line: demo.state.line, base: demo.state.stageBase, target: demo.stageImages.get('picture')?.targetX };
      demo.state.typingDone = true;
      demo.advance();
      const second = { line: demo.state.line, base: demo.state.stageBase };
      demo.state.typingDone = true;
      demo.advance();
      const explicit = { line: demo.state.line, base: demo.state.stageBase, target: demo.stageImages.get('picture')?.targetX };
      return { first, second, explicit };
    })()`);
    const firstPicture = earlyStage.first.base.find(item => item.id === 'picture');
    assert.ok(Math.abs(firstPicture.x - 180) < 2 && Math.abs(firstPicture.alpha - 0.8) < 0.01, JSON.stringify(earlyStage));
    assert.ok(Math.abs(earlyStage.first.target - firstPicture.x) < 0.01 && !earlyStage.first.base.some(item => item.id === 'late'), JSON.stringify(earlyStage));
    assert.ok(Math.abs(earlyStage.second.base.find(item => item.id === 'picture').x - firstPicture.x) < 0.01, JSON.stringify(earlyStage));
    assert.strictEqual(earlyStage.explicit.base.find(item => item.id === 'picture').x, 500);
    assert.strictEqual(earlyStage.explicit.target, 500);
    const earlyExit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const story = ${JSON.stringify(earlyStageCompiled.story)};
      story.lines[1].mode = 'sfx';
      story.lines[0].events.find(event => event.type === 'stage').delay = 2.1;
      demo.showStory(story);
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const atClick = demo.stageImages.get('picture').x;
      demo.drawScene(performance.now() + 400);
      return { atClick, duringExit: demo.stageImages.get('picture').x, transition: demo.state.transition };
    })()`);
    assert.ok(earlyExit.transition === 'modeExit' && Math.abs(earlyExit.atClick - 180) < 2 &&
      Math.abs(earlyExit.duringExit - earlyExit.atClick) < 0.01, JSON.stringify(earlyExit));
    await new Promise(resolve => setTimeout(resolve, 400));
    const afterExit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      return { mode: demo.STORY[demo.state.line].mode, stage: demo.state.stageBase };
    })()`);
    assert.ok(afterExit.mode === 'sfx' && !afterExit.stage.some(item => item.id === 'late') &&
      Math.abs(afterExit.stage.find(item => item.id === 'picture').x - earlyExit.atClick) < 0.01, JSON.stringify(afterExit));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/`);
    while (Date.now() < deadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[window.__demo.state.line]?.mode === "ui-present")')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const beforeDelay = await win.webContents.executeJavaScript(`(() => {
      const source = new Map([['object', { id: 'object', x: 10 }]]);
      const actions = [{ targetKind: 'ui', actor: 'object', property: 'x', from: 100, to: 200, delay: 1, duration: 1, ease: 'Linear' }];
      return window.__demo.sampleUiActions(source, actions, 0.5).get('object').x;
    })()`);
    assert.strictEqual(beforeDelay, 10);
    let rendered;
    const renderDeadline = Date.now() + 10000;
    while (Date.now() < renderDeadline) {
      rendered = await win.webContents.executeJavaScript(`(() => {
        const canvas = document.getElementById('view');
        const ctx = canvas.getContext('2d');
        const dpr = canvas.width / 1920;
        const pixels = ctx.getImageData(Math.round(700*dpr), Math.round(300*dpr), Math.round(300*dpr), Math.round(150*dpr)).data;
        let colored = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i+1] + pixels[i+2] > 70) colored++;
        return { colored, text: window.__demo.uiObjects.get('words').text, parent: window.__demo.uiObjects.get('words').parent,
          frameParent: window.__demo.uiObjects.get('frame').parent, frameMatrix: window.__demo.uiWorldTransforms().get('frame').matrix,
          height: window.__demo.uiBubbleHeight(window.__demo.uiObjects.get('frame')),
          textHeight: window.__demo.uiTextHeight(window.__demo.uiObjects.get('words')) };
      })()`);
      if (rendered.colored > 1000) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(rendered.colored > 1000, JSON.stringify(rendered));
    assert.strictEqual(rendered.parent, 'frame');
    assert.strictEqual(rendered.frameParent, 'hero');
    assert.ok(rendered.frameMatrix[4] >= 958 && rendered.frameMatrix[4] <= 1062);
    assert.ok(Math.abs(rendered.frameMatrix[5] - 400) < 2);
    assert.ok(rendered.height > 160 && rendered.height <= 600);
    assert.ok(rendered.textHeight > 160 && rendered.textHeight <= 400);
    assert.ok(rendered.text.includes('独立打字机'));
    let moved;
    const moveDeadline = Date.now() + 15000;
    while (Date.now() < moveDeadline) {
      moved = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        return demo.stageActors.has('hero') ? demo.uiWorldTransforms().get('frame').matrix[4] : null;
      })()`);
      if (moved != null && Math.abs(moved - 1060) < 2) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(moved != null && Math.abs(moved - 1060) < 2, `Bubble did not follow animated actor: ${moved}`);
    const after = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      if (!demo.state.typingDone) demo.advance();
      demo.advance();
      return { mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size,
        x: demo.uiWorldTransforms().get('reply_text').matrix[4], y: demo.uiWorldTransforms().get('reply_text').matrix[5] };
    })()`);
    assert.strictEqual(after.mode, 'ui-present');
    assert.strictEqual(after.count, 4);
    let movedUi;
    const uiMoveDeadline = Date.now() + 10000;
    while (Date.now() < uiMoveDeadline) {
      movedUi = await win.webContents.executeJavaScript(`(() => {
        const matrix = window.__demo.uiWorldTransforms().get('reply_text').matrix;
        return { x: matrix[4], y: matrix[5] };
      })()`);
      if (Math.abs(movedUi.x - 1300) < 1 && Math.abs(movedUi.y - 320) < 1) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(Math.abs(movedUi.x - 1300) < 1 && Math.abs(movedUi.y - 320) < 1, JSON.stringify(movedUi));
    const effect = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      if (!demo.state.typingDone) demo.advance();
      demo.advance();
      return { mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size, style: demo.uiObjects.get('effect').style };
    })()`);
    assert.deepStrictEqual(effect, { mode: 'ui-present', count: 2, style: 'sfx' }, JSON.stringify(errors));
    const removed = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      if (!demo.state.typingDone) demo.advance();
      demo.advance();
      return { mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size };
    })()`);
    assert.deepStrictEqual(removed, { mode: 'narration', count: 0 }, JSON.stringify(errors));
    const seeked = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const first = demo.STORY.findIndex(line => line.mode === 'ui-present');
      const ok = demo.seek(first, 0);
      return { ok, mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size,
        text: demo.uiObjects.get('words').text, complete: demo.state.typingDone };
    })()`);
    assert.deepStrictEqual(seeked, { ok: true, mode: 'ui-present', count: 4,
      text: '这是独立打字机。文字会在指定范围内换行，点击后显示完整内容。', complete: true }, JSON.stringify(errors));
    const replayed = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const first = demo.STORY.findIndex(line => line.mode === 'ui-present');
      demo.seek(first, 0, { replay: true });
      const now = performance.now();
      const node = demo.uiObjects.get('words');
      const second = demo.uiObjects.get('reply_text');
      const frame = demo.uiObjects.get('frame');
      return { initial: demo.uiTextVisible(node, now), later: demo.uiTextVisible(node, now + 500),
        secondInitial: demo.uiTextVisible(second, now), secondLater: demo.uiTextVisible(second, now + 500),
        complete: demo.state.typingDone, entry: demo.uiAnimation(frame, now).sx,
        settled: demo.uiAnimation(frame, now + 700).sx };
    })()`);
    assert.strictEqual(replayed.complete, false);
    assert.ok(replayed.later > replayed.initial, JSON.stringify(replayed));
    assert.ok(replayed.secondLater > replayed.secondInitial, JSON.stringify(replayed));
    assert.ok(replayed.entry < 0.5 && replayed.settled > 0.9, JSON.stringify(replayed));
    const clickComplete = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.advance();
      const node = demo.uiObjects.get('words');
      return { complete: demo.state.typingDone, visible: demo.uiTextVisible(node, performance.now()),
        total: Array.from(node.text).length };
    })()`);
    assert.ok(clickComplete.complete && clickComplete.visible === clickComplete.total, JSON.stringify(clickComplete));
    const rewrite = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.advance();
      const now = performance.now();
      const prior = demo.uiObjects.get('words');
      const node = demo.uiObjects.get('reply_text');
      return { prior: demo.uiTextVisible(prior, now), priorTotal: Array.from(prior.text).length,
        initial: demo.uiTextVisible(node, now), later: demo.uiTextVisible(node, now + 500) };
    })()`);
    assert.strictEqual(rewrite.prior, rewrite.priorTotal, JSON.stringify(rewrite));
    assert.ok(rewrite.later > rewrite.initial, JSON.stringify(rewrite));
    const exit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const effect = demo.STORY.findIndex(line => line.mode === 'ui-present' &&
        line.operation == null && line.sourceLine > 20);
      demo.seek(effect, 0, { replay: true });
      if (!demo.state.typingDone) demo.advance();
      demo.advance();
      return { mode: demo.STORY[demo.state.line]?.mode, exits: demo.uiExits.length };
    })()`);
    assert.ok(exit.exits > 0, JSON.stringify(exit));
    const forwardSeek = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const target = demo.STORY.findIndex(line => line.mode === 'narration');
      const ok = demo.seek(target, 0);
      return { ok, mode: demo.STORY[demo.state.line].mode, count: demo.uiObjects.size };
    })()`);
    assert.deepStrictEqual(forwardSeek, { ok: true, mode: 'narration', count: 0 }, JSON.stringify(errors));
    assert.deepStrictEqual(errors, []);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/branch.json`);
    const branchDeadline = Date.now() + 20000;
    let branchReady = false;
    while (Date.now() < branchDeadline) {
      branchReady = await win.webContents.executeJavaScript(`Boolean(window.__demo && window.__demo.state.started && window.__demo.STORY[window.__demo.state.line]?.mode === 'branch')`);
      if (branchReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(branchReady, 'Branch did not load');
    await win.webContents.executeJavaScript('window.__demo.chooseBranch(1)');
    let right;
    while (Date.now() < branchDeadline) {
      right = await win.webContents.executeJavaScript(`(() => ({ mode: window.__demo.STORY[window.__demo.state.line]?.mode, ids: [...window.__demo.uiObjects.keys()] }))()`);
      if (right.mode === 'ui-present') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(right, { mode: 'ui-present', ids: ['right_frame'] });
    const left = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const target = demo.STORY[0].options[0].next;
      const ok = demo.seek(target, 0);
      return { ok, mode: demo.STORY[demo.state.line].mode, ids: [...demo.uiObjects.keys()] };
    })()`);
    assert.deepStrictEqual(left, { ok: true, mode: 'ui-present', ids: ['left_frame'] });
    assert.deepStrictEqual(errors, []);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/converge.json`);
    let convergeReady = false;
    const convergeDeadline = Date.now() + 20000;
    while (Date.now() < convergeDeadline) {
      convergeReady = await win.webContents.executeJavaScript(`Boolean(window.__demo?.state.started && window.__demo.STORY[window.__demo.state.line]?.mode === 'branch')`);
      if (convergeReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(convergeReady, 'Converging branch did not load');
    await win.webContents.executeJavaScript('window.__demo.chooseBranch(0)');
    let onLeft = false;
    while (Date.now() < convergeDeadline) {
      onLeft = await win.webContents.executeJavaScript(`Boolean(window.__demo?.uiObjects.has('left_frame'))`);
      if (onLeft) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(onLeft, 'Left branch did not start');
    const branchReplay = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.advance();
      const target = demo.state.line;
      const first = [...demo.uiObjects.keys()];
      demo.seek(target, 0, { replay: true });
      const now = performance.now();
      const text = demo.uiObjects.get('words');
      const replay = { ids: [...demo.uiObjects.keys()], initial: demo.uiTextVisible(text, now),
        later: demo.uiTextVisible(text, now + 500), done: demo.state.typingDone };
      demo.seek(target, 0, { replay: true });
      return { first, replay, repeated: [...demo.uiObjects.keys()] };
    })()`);
    assert.deepStrictEqual(branchReplay.first, ['left_frame', 'words']);
    assert.deepStrictEqual(branchReplay.replay.ids, ['left_frame', 'words']);
    assert.deepStrictEqual(branchReplay.repeated, ['left_frame', 'words']);
    assert.ok(!branchReplay.replay.done && branchReplay.replay.later > branchReplay.replay.initial, JSON.stringify(branchReplay));
    assert.deepStrictEqual(errors, []);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/variables.json`);
    const variableDeadline = Date.now() + 20000;
    while (Date.now() < variableDeadline) {
      const ready = await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[window.__demo.state.line]?.mode === "branch")');
      if (ready) break;
      await win.webContents.executeJavaScript('window.__demo.advance()');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const variableBranch = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const before = { value: demo.state.variables.trust, available: demo.modeRuntime.branch.extra.slots.map(slot => slot.available) };
      const branchLine = demo.state.line;
      demo.chooseBranch(1);
      const rejected = { line: demo.state.line, transition: demo.state.transition };
      demo.chooseBranch(0);
      return { before, branchLine, rejected };
    })()`);
    assert.deepStrictEqual(variableBranch.before, { value: 1, available: [true, false] });
    assert.deepStrictEqual(variableBranch.rejected, { line: variableBranch.branchLine, transition: null });
    let variableDone = null;
    while (Date.now() < variableDeadline) {
      variableDone = await win.webContents.executeJavaScript(`(() => ({
        mode: window.__demo.STORY[window.__demo.state.line]?.mode,
        text: window.__demo.STORY[window.__demo.state.line]?.text,
        value: window.__demo.state.variables.trust
      }))()`);
      if (variableDone.text === '嵌套条件也成立') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(variableDone, { mode: 'narration', text: '嵌套条件也成立', value: 3 });
    const falseVariableBranch = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const condition = demo.STORY.findIndex(line => line.mode === 'condition' && line.sourceLine === 3);
      demo.state.transition = null;
      demo.state.variables.trust = 0;
      demo.startLine(condition);
      return { mode: demo.STORY[demo.state.line]?.mode, text: demo.STORY[demo.state.line]?.text };
    })()`);
    assert.deepStrictEqual(falseVariableBranch, { mode: 'narration', text: '条件不成立' });
    assert.deepStrictEqual(errors, []);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/tutorial-project/&storyUrl=/tutorial.json`);
    let tutorialReady = false;
    const tutorialDeadline = Date.now() + 20000;
    while (Date.now() < tutorialDeadline) {
      tutorialReady = await win.webContents.executeJavaScript('Boolean(window.__demo && window.__demo.state.started && window.__demo.STORY.length > 20)');
      if (tutorialReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(tutorialReady, 'Tutorial did not load');
    const tutorial = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const index = demo.STORY.findIndex(line => line.mode === 'manga' && line.purple);
      const ok = demo.seek(index, 0);
      return { ok, mode: demo.STORY[demo.state.line]?.mode, purple: demo.STORY[demo.state.line]?.purple };
    })()`);
    assert.deepStrictEqual(tutorial, { ok: true, mode: 'manga', purple: true }, JSON.stringify(errors));
    const showcase = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const indices = demo.STORY.map((line, index) => ['normal', 'manga', 'mangaThink', 'clear', 'cloud'].includes(line.mode) ? index : -1).filter(index => index >= 0);
      const results = [];
      for (const index of indices) {
        const ok = demo.seek(index, 0);
        let graphError = '';
        try { demo.uiWorldTransforms(); } catch (error) { graphError = String(error); }
        results.push({ index, ok, error: graphError });
      }
      return results;
    })()`);
    assert.ok(showcase.length >= 10, 'Tutorial must exercise dialogue modes');
    assert.deepStrictEqual(showcase.filter(item => !item.ok || item.error), [], JSON.stringify(showcase));
    const authoredDialogue = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const clear = demo.STORY.findIndex(line => line.mode === 'clear' && line.avatar);
      demo.startLine(clear);
      const background = demo.findNode(demo.modeRuntime.clear.root, 'HeroHead/Hero/FrontBg');
      const line = demo.STORY[clear];
      const result = { name: line.speakerName, avatar: line.avatar, loaded: Boolean(demo.images['avatar:' + line.avatar]),
        color: background.draw.color };
      demo.startLine(clear + 1);
      const other = demo.findNode(demo.modeRuntime.clear.root, 'HeroHead/Hero/FrontBg');
      result.nextColor = other.draw.color;
      return result;
    })()`);
    assert.deepStrictEqual([authoredDialogue.name, authoredDialogue.avatar, authoredDialogue.loaded], ['内尔', 'ner_avatar', true]);
    assert.deepStrictEqual(authoredDialogue.color, [117 / 255, 166 / 255, 89 / 255, 1]);
    assert.notDeepStrictEqual(authoredDialogue.color, authoredDialogue.nextColor);
    const avatarPixels = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const index = demo.STORY.findIndex(line => line.mode === 'clear' && line.avatar);
      const line = demo.STORY[index], original = { avatar: line.avatar, avatarBg: line.avatarBg };
      const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const render = (avatar, avatarBg) => {
        line.avatar = avatar; line.avatarBg = avatarBg;
        demo.startLine(index);
        demo.drawScene(performance.now() + 1200);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const difference = (a, b) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 45) count++;
        return count;
      };
      const first = render('ner_avatar', '#ff0000');
      const changedColor = render('ner_avatar', '#0000ff');
      const changedAvatar = render('erpin_avatar', '#ff0000');
      Object.assign(line, original);
      return { color: difference(first, changedColor), avatar: difference(first, changedAvatar) };
    })()`);
    assert.ok(avatarPixels.color > 20 && avatarPixels.avatar > 100, JSON.stringify(avatarPixels));
    const consecutiveBubble = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const first = demo.STORY.findIndex((line, i) => line.mode === 'manga' && demo.STORY[i + 1]?.mode === 'manga');
      demo.state.freeze = false;
      demo.startLine(first);
      const firstTail = demo.findNode(demo.modeRuntime.manga.root, 'Base/BubbleTail');
      const initial = { tail: [firstTail.sx, firstTail.sy], start: demo.modeRuntime.manga.clips.some(c => c.key.endsWith('_Start')) };
      demo.state.typingDone = true;
      demo.advance();
      return { first, initial, transition: demo.state.transition, line: demo.state.line };
    })()`);
    assert.strictEqual(consecutiveBubble.transition, 'modeExit');
    assert.strictEqual(consecutiveBubble.line, consecutiveBubble.first);
    assert.deepStrictEqual(consecutiveBubble.initial, { tail: [-1, 1], start: true });
    let nextBubble;
    const bubbleDeadline = Date.now() + 5000;
    do {
      await new Promise(resolve => setTimeout(resolve, 100));
      nextBubble = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        const tail = demo.findNode(demo.modeRuntime.manga.root, 'Base/BubbleTail');
        return { line: demo.state.line, tail: [tail.sx, tail.sy],
          start: demo.modeRuntime.manga.clips.some(c => c.key.endsWith('_Start')) };
      })()`);
    } while (nextBubble.line === consecutiveBubble.first && Date.now() < bubbleDeadline);
    assert.deepStrictEqual(nextBubble, { line: consecutiveBubble.first + 1, tail: [1, -1], start: true });
    const interrupted = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, first = ${consecutiveBubble.first};
      const line = demo.STORY[first], oldHold = line.hold;
      line.hold = 0;
      demo.state.auto = false;
      demo.startLine(first);
      demo.advance();
      const manualHold = demo.state.readyAt - demo.state.doneAt;
      demo.startLine(first);
      demo.state.auto = true;
      demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 10);
      const autoTransition = demo.state.transition;
      demo.seek(first + 2, 0, { replay: true });
      line.hold = oldHold;
      return { manualHold, autoTransition, expectedLine: demo.state.line };
    })()`);
    assert.strictEqual(interrupted.manualHold, 0);
    assert.strictEqual(interrupted.autoTransition, 'modeExit');
    await new Promise(resolve => setTimeout(resolve, 400));
    const afterInterrupted = await win.webContents.executeJavaScript('({line: window.__demo.state.line, transition: window.__demo.state.transition})');
    assert.deepStrictEqual(afterInterrupted, { line: interrupted.expectedLine, transition: null });
    const interruptedLocation = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const location = demo.STORY.findIndex(line => line.mode === 'location');
      demo.startLine(location);
      demo.state.typingDone = true;
      demo.advance();
      const transition = demo.state.transition;
      demo.seek(${consecutiveBubble.first}, 0, { replay: true });
      return { transition, line: demo.state.line };
    })()`);
    assert.strictEqual(interruptedLocation.transition, 'locationEnd');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.deepStrictEqual(await win.webContents.executeJavaScript('({line: window.__demo.state.line, transition: window.__demo.state.transition})'),
      { line: interruptedLocation.line, transition: null });
    const interruptedTitle = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const title = demo.STORY.findIndex(line => line.mode === 'title');
      demo.startLine(title);
      demo.state.titleSkipped = true;
      demo.advance();
      const transition = demo.state.transition;
      demo.seek(${consecutiveBubble.first}, 0, { replay: true });
      return { transition, line: demo.state.line };
    })()`);
    assert.strictEqual(interruptedTitle.transition, 'titleEnd');
    await new Promise(resolve => setTimeout(resolve, 550));
    assert.deepStrictEqual(await win.webContents.executeJavaScript('({line: window.__demo.state.line, transition: window.__demo.state.transition})'),
      { line: interruptedTitle.line, transition: null });
    const tutorialRoutes = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, story = ${JSON.stringify(tutorialCompiled.story)};
      const run = choice => {
        demo.showStory(story);
        const branch = demo.STORY.findIndex(line => line.mode === 'branch');
        demo.startLine(branch);
        demo.chooseBranch(2);
        const locked = demo.state.line === branch && demo.state.transition === null;
        demo.chooseBranch(choice);
        const now = performance.now();
        demo.drawScene(now + 2000);
        demo.drawScene(now + 3000);
        const texts = [];
        for (let steps = 0; steps < 20; steps++) {
          const line = demo.STORY[demo.state.line];
          if (line.text) texts.push(line.text);
          if (line.mode === 'fullscreen' || line.mode === 'end') break;
          demo.startLine(demo.state.line + 1);
        }
        return { texts, locked, sawSignal: demo.state.variables.saw_signal, mode: demo.STORY[demo.state.line].mode };
      };
      return [run(0), run(1)];
    })()`);
    assert.ok(tutorialRoutes[0].locked && tutorialRoutes[0].sawSignal && tutorialRoutes[0].mode === 'fullscreen' &&
      tutorialRoutes[0].texts.some(text => text.includes('信号灯仍在雨幕里闪烁')) &&
      !tutorialRoutes[0].texts.some(text => text.includes('她们回到候车厅')), JSON.stringify(tutorialRoutes[0]));
    assert.ok(tutorialRoutes[1].locked && !tutorialRoutes[1].sawSignal && tutorialRoutes[1].mode === 'fullscreen' &&
      tutorialRoutes[1].texts.some(text => text.includes('远处传来列车的汽笛')) &&
      !tutorialRoutes[1].texts.some(text => text.includes('两人沿着屋檐来到站台尽头')), JSON.stringify(tutorialRoutes[1]));
    assert.deepStrictEqual(errors, []);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/clear-reentry.json`);
    const clearDeadline = Date.now() + 20000;
    while (Date.now() < clearDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY.length === 6)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const clearSequence = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, m = demo.modeRuntime.clear;
      const snapshot = () => ({ line: demo.state.line, transition: demo.state.transition,
        clips: m.clips.map(clip => clip.key), name: m.line.speakerName,
        color: demo.findNode(m.root, 'HeroHead/Hero/FrontBg').draw.color,
        rootScale: [m.root.sx, m.root.sy] });
      const pixelsVisible = () => {
        const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
        const now = performance.now() + 1000;
        m.visible = true; demo.drawScene(now);
        const withBox = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        m.visible = false; demo.drawScene(now);
        const withoutBox = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        m.visible = true;
        let count = 0;
        for (let i = 0; i < withBox.length; i += 4)
          if (Math.abs(withBox[i] - withoutBox[i]) + Math.abs(withBox[i + 1] - withoutBox[i + 1]) +
              Math.abs(withBox[i + 2] - withoutBox[i + 2]) > 30) count++;
        return count;
      };
      demo.state.auto = false;
      demo.startLine(0);
      const first = snapshot();
      demo.state.typingDone = true; demo.advance();
      const second = snapshot();
      demo.state.typingDone = true; demo.advance();
      const third = snapshot();
      const thirdPixels = pixelsVisible();
      demo.startLine(3);
      const fresh = snapshot();
      const freshPixels = pixelsVisible();
      demo.state.typingDone = true; demo.advance();
      const delayedExit = snapshot();
      return { first, second, third, thirdPixels, fresh, freshPixels, delayedExit };
    })()`);
    assert.ok(clearSequence.first.clips.includes('clear.Dialogue_ClearText_Entry'), JSON.stringify(clearSequence));
    assert.deepStrictEqual(clearSequence.second, { line: 1, transition: null, clips: ['clear.Dialogue_ClearText_ReEntry'],
      name: '艾尔芬', color: [204 / 255, 68 / 255, 85 / 255, 1], rootScale: [1, 1] });
    assert.deepStrictEqual(clearSequence.third, { line: 2, transition: null, clips: [],
      name: '内尔', color: [51 / 255, 102 / 255, 170 / 255, 1], rootScale: [1, 1] });
    assert.ok(clearSequence.thirdPixels > 1000 && clearSequence.freshPixels > 1000, JSON.stringify(clearSequence));
    assert.deepStrictEqual(clearSequence.fresh.rootScale, [1, 1]);
    assert.deepStrictEqual(clearSequence.fresh.clips, []);
    assert.strictEqual(clearSequence.delayedExit.transition, 'modeExit');
    const clearNextDeadline = Date.now() + 5000;
    let clearDelayed;
    do {
      await new Promise(resolve => setTimeout(resolve, 100));
      clearDelayed = await win.webContents.executeJavaScript(`(() => ({
        line: window.__demo.state.line, transition: window.__demo.state.transition,
        delay: window.__demo.state.dialogueStartAt - window.__demo.state.lineStart,
        clips: window.__demo.modeRuntime.clear.clips.map(clip => clip.key)
      }))()`);
    } while (clearDelayed.line === 3 && Date.now() < clearNextDeadline);
    assert.deepStrictEqual(clearDelayed, { line: 4, transition: null, delay: 3000, clips: ['clear.Dialogue_ClearText_Entry'] });
    assert.deepStrictEqual(errors, []);
    const normalStates = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const read = variant => {
        demo.showPreset({ mode: 'normal', dialogueVariant: variant, text: '状态', speaker: 'ner',
          bubble: { x: 960, y: 470 }, bg: null, stage: [] });
        const m = demo.modeRuntime.normal;
        const style = variant.startsWith('cloud') ? 'cloud' : variant.startsWith('blast') ? 'blast' : 'normal';
        const entry = m.clips.find(clip => clip.key.endsWith('BlastEntry'));
        const sample = demo.collectOverrides(m, entry ? entry.start + 1 : performance.now()).ov.get('');
        return { clips: m.clips.map(clip => clip.key), entryScale: sample?.sx ?? 1 };
      };
      return { normal: read('normal'), cloud: read('cloudName'), blast: read('blast') };
    })()`);
    assert.deepStrictEqual(normalStates.normal.clips, ['normal.Dialogue_NormalText_Normal']);
    assert.deepStrictEqual(normalStates.cloud.clips, [
      'normal.Dialogue_NormalText_CloudIdleX', 'normal.Dialogue_NormalText_CloudIdleY',
    ]);
    assert.deepStrictEqual(normalStates.blast.clips, [
      'normal.Dialogue_NormalText_BlastEntry', 'normal.Dialogue_NormalText_BlastIdle',
    ]);
    assert.strictEqual(normalStates.normal.entryScale, 1);
    assert.strictEqual(normalStates.cloud.entryScale, 1);
    assert.ok(normalStates.blast.entryScale < 0.1, JSON.stringify(normalStates));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/animation.json`);
    let animationReady = false;
    const animationDeadline = Date.now() + 20000;
    while (Date.now() < animationDeadline) {
      animationReady = await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("thought_frame"))');
      if (animationReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(animationReady, 'Animation fixture did not load');
    const visual = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const node = demo.uiObjects.get('thought_frame');
      const canvas = document.getElementById('view');
      const ctx = canvas.getContext('2d');
      const now = performance.now();
      const pixels = time => {
        demo.drawScene(time);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const difference = (a, b, predicate = () => true) => {
        let count = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (!predicate(x * 1920 / canvas.width, y * 1080 / canvas.height)) continue;
          const i = 4 * (y * canvas.width + x);
          if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 40) count++;
        }
        return count;
      };
      demo.seek(0, 0, { replay: true });
      const current = demo.uiObjects.get('thought_frame');
      const start = performance.now();
      const entrance = pixels(start);
      const settled = pixels(start + 600);
      current.tail = 'bl'; const bottomLeft = pixels(start + 1200);
      current.tail = 'br'; const bottomRight = pixels(start + 1200);
      current.tail = 'tl'; const topLeft = pixels(start + 1200);
      const horizontal = difference(bottomLeft, bottomRight, (x, y) => y > 690);
      const vertical = difference(bottomLeft, topLeft, (x, y) => x < 700);
      const scale1 = demo.uiAnimation(current, start + 800);
      const scale2 = demo.uiAnimation(current, start + 1600);
      const tail1 = demo.uiTailMotion(current, start + 800);
      const tail2 = demo.uiTailMotion(current, start + 1600);
      demo.advance();
      const changedStyle = demo.uiObjects.get('thought_frame');
      const styleEntrance = demo.uiAnimation(changedStyle, performance.now());
      return { entryPixels: difference(entrance, settled), horizontal, vertical,
        scale1, scale2, tail1, tail2, style: changedStyle.style, styleEntrance };
    })()`);
    assert.ok(visual.entryPixels > 1000, JSON.stringify(visual));
    assert.ok(visual.horizontal > 20 && visual.vertical > 20, JSON.stringify(visual));
    assert.notStrictEqual(visual.tail1.first, visual.tail2.first, JSON.stringify(visual));
    assert.notStrictEqual(visual.scale1.sy, visual.scale2.sy, JSON.stringify(visual));
    assert.strictEqual(visual.style, 'manga');
    assert.ok(visual.styleEntrance.sx < 0.5, JSON.stringify(visual));
    assert.deepStrictEqual(errors, []);
    const mangaAudit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showPreset({ mode: 'manga', text: '气泡', speaker: 'ner',
        bubble: { x: 0, y: 0 }, bg: null, stage: [] });
      const mode = demo.modeRuntime.manga;
      const start = mode.clips.find(clip => clip.key === 'manga.Dialogue_MangaText_Start').start;
      const samples = [0, 0.125, 0.25, 0.41667].map(t => {
        const root = demo.collectOverrides(mode, start + t * 1000).ov.get('');
        return [root.sx, root.sy];
      });
      return { root: [mode.root.px, mode.root.py], samples };
    })()`);
    assert.deepStrictEqual(mangaAudit.root, [-1126.5, 327]);
    for (const [index, expected] of [0, 0.55, 1.1, 1].entries()) {
      assert.ok(mangaAudit.samples[index].every(value => Math.abs(value - expected) < 0.001), JSON.stringify(mangaAudit));
    }
    const narrationAudit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showPreset({ mode: 'narration', text: '旁白', bg: null, stage: [] });
      const mode = demo.modeRuntime.narration;
      const start = mode.clips.find(clip => clip.key === 'narration.Dialogue_NarrationText_Entry').start;
      const positions = [0, 1/24, 1/6, 1/6 + 7/240, 17/60].map(t =>
        demo.collectOverrides(mode, start + t * 1000).ov.get('').py);
      demo.showPreset({ mode: 'narration', text: '旁白', enter: 'none', bg: null, stage: [] });
      return { positions, disabled: !demo.modeRuntime.narration.clips.length };
    })()`);
    for (const [index, expected] of [-240, -190, 80, 67.5, 0].entries()) {
      assert.ok(Math.abs(narrationAudit.positions[index] - expected) < 0.01, JSON.stringify(narrationAudit));
    }
    assert.ok(narrationAudit.disabled);
    const nextIconTransforms = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const inspect = (mode, options) => {
        const line = { mode, text: '测试', enter: 'none', bg: null, stage: [],
          bubble: { x: 960, y: 470 }, ...options };
        demo.showPreset(line);
        demo.state.bgSolid = true;
        demo.state.bgColor = '#000000';
        const now = performance.now() + 1500;
        demo.state.doneAt = now - 500;
        demo.state.typingDone = false;
        demo.drawScene(now);
        const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        demo.state.typingDone = true;
        demo.drawScene(now);
        const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let weight = 0, x = 0, y = 0;
        for (let i = 0; i < before.length; i += 4) {
          const delta = Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]);
          if (delta < 5) continue;
          const pixel = i / 4;
          weight += delta;
          x += (pixel % canvas.width) * delta;
          y += Math.floor(pixel / canvas.width) * delta;
        }
        return { weight, x: weight ? x / weight * 1920 / canvas.width : 0,
          y: weight ? y / weight * 1080 / canvas.height : 0 };
      };
      return ['normal', 'manga'].map(mode => ({
        mode, base: inspect(mode, {}), changed: inspect(mode, { uiX: 80, uiY: 30, uiScale: 0.7, uiRot: -20 }),
        transparent: inspect(mode, { uiOpacity: 0 }),
      }));
    })()`);
    for (const sample of nextIconTransforms) {
      assert.ok(sample.base.weight > 1000 && sample.changed.weight > 100, JSON.stringify(sample));
      const radians = -20 * Math.PI / 180;
      const x = sample.base.x + 80 - 960, y = sample.base.y - 30 - 540;
      const expectedX = 960 + 0.7 * (Math.cos(radians) * x - Math.sin(radians) * y);
      const expectedY = 540 + 0.7 * (Math.sin(radians) * x + Math.cos(radians) * y);
      assert.ok(Math.abs(sample.changed.x - expectedX) < 8 && Math.abs(sample.changed.y - expectedY) < 8, JSON.stringify(sample));
      assert.strictEqual(sample.transparent.weight, 0, JSON.stringify(sample));
    }
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/ui-animation-timing.json`);
    const timingDeadline = Date.now() + 20000;
    while (Date.now() < timingDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("mono"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const uiTiming = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const present = demo.STORY.findIndex(line => line.mode === 'ui-present');
      demo.seek(present, 0, { replay: true });
      const start = performance.now();
      const sample = (key, property, path, time, loop) => {
        const clip = demo.ANIM[key];
        const channel = clip.channels.find(item => item.p === property && item.path === path);
        if (channel.c !== undefined) return channel.c;
        if (loop) time %= clip.stop;
        const keys = channel.keys;
        let index = 0;
        for (let i = 1; i < keys.length; i++) if (keys[i][0] <= time) index = i;
        const keyframe = keys[index], dt = time - keyframe[0];
        return index === keys.length - 1 ? keyframe[1]
          : keyframe[1] + keyframe[4] * dt + keyframe[3] * dt ** 2 + keyframe[2] * dt ** 3;
      };
      const times = [0.2, 0.8, 1.5];
      const bubbles = times.map(time => demo.uiAnimation(demo.uiObjects.get('bubble'), start + time * 1000));
      const expected = times.map(time => ({
        sx: sample('manga.Dialogue_MangaText_Start', 'sx', '', time, false) *
          sample('manga.Dialogue_MangaText_ThinkBaseSacleX', 'sx', 'Base/Base/TextBoxLayOut', time, true),
        sy: sample('manga.Dialogue_MangaText_Start', 'sy', '', time, false) *
          sample('manga.Dialogue_MangaText_ThinkBaseSacleY', 'sy', 'Base/Base/TextBoxLayOut/Base', time, true),
      }));
      const mono = demo.uiAnimation(demo.uiObjects.get('mono'), start + 1500);
      const thoughtBox = demo.uiAnimation(demo.uiObjects.get('thought_box'), start + 1500);
      const target = demo.STORY.findIndex(line => line.mode === 'narration');
      demo.seek(target, 0, { replay: true });
      const resumeStart = performance.now();
      const resumed = [0, 800].map(offset => demo.uiAnimation(demo.uiObjects.get('bubble'), resumeStart + offset));
      const resumedTail = [0, 800].map(offset => demo.uiTailMotion(demo.uiObjects.get('bubble'), resumeStart + offset));
      demo.seek(target, 0);
      const frozenAt = demo.state.freezeTime;
      demo.tick(frozenAt + 1500);
      const frozen = { still: demo.state.freezeTime === frozenAt,
        first: demo.uiWorldTransforms(frozenAt).get('bubble').matrix,
        afterTick: demo.uiWorldTransforms(demo.state.freezeTime).get('bubble').matrix };
      return { bubbles, expected, mono, thoughtBox, resumed, resumedTail, frozen };
    })()`);
    for (let index = 0; index < uiTiming.expected.length; index++) {
      assert.ok(Math.abs(uiTiming.bubbles[index].sx - uiTiming.expected[index].sx) < 0.006 &&
        Math.abs(uiTiming.bubbles[index].sy - uiTiming.expected[index].sy) < 0.006, JSON.stringify(uiTiming));
    }
    assert.deepStrictEqual([uiTiming.mono.sx, uiTiming.mono.sy, uiTiming.thoughtBox.sx, uiTiming.thoughtBox.sy], [1, 1, 1, 1]);
    assert.ok(uiTiming.resumed[0].sx > 0.99 && uiTiming.resumed[0].sy > 0.99 &&
      uiTiming.resumed[1].sx > 1.02 && uiTiming.resumed[1].sy > 1.01, JSON.stringify(uiTiming));
    assert.notStrictEqual(uiTiming.resumedTail[0].first, uiTiming.resumedTail[1].first, JSON.stringify(uiTiming));
    assert.strictEqual(uiTiming.frozen.still, true);
    assert.deepStrictEqual(uiTiming.frozen.first, uiTiming.frozen.afterTick);
    const shadows = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const canvas = document.getElementById('view');
      const ctx = canvas.getContext('2d');
      const render = (mode, shadow) => {
        demo.showPreset({ mode, text: '阴影测试', speaker: 'ner', speakerName: '内尔',
          bubble: { x: 960, y: 470 }, head: { x: 580, y: 690 }, bg: null, stage: [], ...shadow });
        demo.drawScene(performance.now() + 1000);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const changed = (a, b) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 30) count++;
        return count;
      };
      return ['manga', 'normal', 'clear'].map(mode => {
        const hidden = render(mode, { shadowX: 100, shadowY: 70, shadowColor: '#ff0066', shadowAlpha: 0 });
        const colored = render(mode, { shadowX: 100, shadowY: 70, shadowColor: '#ff0066', shadowAlpha: 1 });
        const moved = render(mode, { shadowX: -100, shadowY: -70, shadowColor: '#ff0066', shadowAlpha: 1 });
        return { mode, color: changed(hidden, colored), position: changed(colored, moved) };
      });
    })()`);
    for (const shadow of shadows) {
      assert.ok(shadow.color > 100 && shadow.position > 100, JSON.stringify(shadows));
    }
    const padding = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const height = value => {
        demo.showPreset({ mode: 'manga', text: '雨'.repeat(24), speaker: 'ner',
          bubble: { x: 960, y: 470 }, bg: null, stage: [], textWidth: 220,
          bubbleMinHeight: 160, bubbleMaxHeight: 1000, bubblePaddingY: value });
        return demo.modeRuntime.manga.bubbleSize.h;
      };
      return { zero: height(0), extra: height(100) };
    })()`);
    assert.strictEqual(padding.extra - padding.zero, 100, JSON.stringify(padding));
    const overflow = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view');
      const ctx = canvas.getContext('2d');
      const text = Array.from({ length: 12 }, (_, i) => '<color=#ff0000>' + '文字'.repeat(6) + (i % 2 ? '甲' : '乙') + '</color>').join('<br>');
      const render = (kind, width = 220) => {
        demo.showPreset({ mode: 'manga', text, speaker: 'ner', enter: 'none',
          bubble: { x: 960, y: 470 }, bg: null, stage: [], textWidth: width,
          bubbleWidth: 360, bubbleMinHeight: 320, bubbleMaxHeight: 600,
          bubblePaddingY: 60, fontSize: 52, overflow: kind });
        const m = demo.modeRuntime.manga;
        demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 1);
        demo.drawScene(demo.state.lineStart + 3000);
        const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const rect = m.extra.bubbleViewport;
        let outsideRed = 0, insideRed = 0;
        const scaleX = canvas.width / 1920, scaleY = canvas.height / 1080;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (before[i] > 150 && before[i+1] < 90 && before[i+2] < 90) {
            const inside = x >= rect.left * scaleX - 2 && x <= rect.right * scaleX + 2 &&
              y >= rect.top * scaleY - 2 && y <= rect.bottom * scaleY + 2;
            if (inside) insideRed++; else outsideRed++;
          }
        }
        const beforeOffset = m.extra.bubbleScroll.offset;
        const beforeMax = m.extra.bubbleScroll.max;
        const bounds = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120,
          clientX: bounds.left + ((rect.left + rect.right) / 2) / 1920 * bounds.width,
          clientY: bounds.top + ((rect.top + rect.bottom) / 2) / 1080 * bounds.height }));
        demo.drawScene(demo.state.lineStart + 3000);
        const afterOffset = m.extra.bubbleScroll.offset;
        const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let changed = 0;
        for (let i = 0; i < before.length; i += 4)
          if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 60) changed++;
        return { size: m.bubbleSize, insideRed, outsideRed, beforeOffset, beforeMax, afterOffset, changed };
      };
      return { grow: render('grow'), shrink: render('shrink', 400), clip: render('clip'), scroll: render('scroll') };
    })()`);
    assert.strictEqual(overflow.grow.size.h, 600);
    assert.strictEqual(overflow.shrink.size.h, 320);
    assert.ok(overflow.shrink.size.fontSize < 52 && overflow.shrink.size.textH <= overflow.shrink.size.viewportHeight, JSON.stringify(overflow.shrink));
    assert.strictEqual(overflow.clip.size.fontSize, 52);
    for (const mode of ['grow', 'shrink', 'clip', 'scroll']) {
      assert.ok(overflow[mode].insideRed > 10 && overflow[mode].outsideRed < 10, JSON.stringify({ mode, ...overflow[mode] }));
    }
    assert.ok(overflow.scroll.beforeMax > 120 && overflow.scroll.beforeOffset === overflow.scroll.beforeMax &&
      overflow.scroll.afterOffset < overflow.scroll.beforeOffset && overflow.scroll.changed > 10, JSON.stringify(overflow.scroll));
    assert.ok(overflow.grow.beforeMax > 120 && overflow.grow.afterOffset < overflow.grow.beforeOffset, JSON.stringify(overflow.grow));
    const touchScroll = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view');
      demo.showPreset({ mode: 'manga', text: ('文字内容很长。').repeat(30), speaker: 'ner', enter: 'none',
        bubble: { x: 960, y: 470 }, bg: null, stage: [], textWidth: 220,
        bubbleWidth: 360, bubbleMinHeight: 320, bubbleMaxHeight: 600,
        bubblePaddingY: 60, overflow: 'scroll' });
      demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 1);
      demo.drawScene(demo.state.lineStart + 3000);
      const m = demo.modeRuntime.manga, rect = m.extra.bubbleViewport, bounds = canvas.getBoundingClientRect();
      const x = bounds.left + (rect.left + rect.right) / 2 / 1920 * bounds.width;
      const y = bounds.top + (rect.top + rect.bottom) / 2 / 1080 * bounds.height;
      const startOffset = m.extra.bubbleScroll.offset;
      const fire = (type, cy) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
        pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: cy }));
      fire('pointerdown', y);
      fire('pointermove', y + 50);
      fire('pointerup', y + 50);
      demo.drawScene(demo.state.lineStart + 3000);
      const afterOffset = m.extra.bubbleScroll.offset;
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y + 50 }));
      return { startOffset, afterOffset, ended: demo.state.endShown, line: demo.state.line };
    })()`);
    assert.ok(touchScroll.startOffset > touchScroll.afterOffset && touchScroll.line === 0 && !touchScroll.ended, JSON.stringify(touchScroll));
    const specialStyles = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const capture = (mode, fields) => {
        demo.showPreset({ mode, text: '这是文字测试', speaker: mode === 'anime' ? 'ner' : null,
          speakerName: mode === 'anime' ? '内尔' : '', bg: null, stage: [], enter: 'none', ...fields });
        demo.updateState(demo.state.typingStart + demo.state.typingPlan.total + 1);
        demo.drawScene(demo.state.lineStart + 3000);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const diff = (a, b) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 40) count++;
        return count;
      };
      const styles = ['narration', 'sfx', 'anime'].map(mode => {
        const normal = capture(mode, { textColor: '#ffffff', fontSize: 52 });
        const modified = capture(mode, { textColor: '#ff0000', fontSize: 72, textOffsetX: 40 });
        return { mode, changed: diff(normal, modified) };
      });
      const hidden = capture('sfx', { shadowColor: '#ff0066', shadowAlpha: 0, shadowX: 80, shadowY: 70 });
      const colored = capture('sfx', { shadowColor: '#ff0066', shadowAlpha: 1, shadowX: 80, shadowY: 70 });
      const shifted = capture('sfx', { shadowColor: '#ff0066', shadowAlpha: 1, shadowX: -80, shadowY: -70 });
      return { styles, shadowColor: diff(hidden, colored), shadowPosition: diff(colored, shifted) };
    })()`);
    for (const style of specialStyles.styles) assert.ok(style.changed > 50, JSON.stringify(specialStyles));
    assert.ok(specialStyles.shadowColor > 100 && specialStyles.shadowPosition > 100, JSON.stringify(specialStyles));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/news-entry.json`);
    const newsDeadline = Date.now() + 20000;
    while (Date.now() < newsDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[0]?.mode === "newsTalk")')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const newsEntry = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const sample = (mode, ms) => {
        const runtime = demo.modeRuntime[mode], clip = runtime.clips.find(item => item.key === 'news.Entry');
        const values = demo.collectOverrides(runtime, clip.start + ms).ov.get('');
        return { x: values?.sx, y: values?.sy, start: clip.start };
      };
      demo.seek(0, 0, { replay: true });
      const defaultSamples = [0, 1000 / 12, 1000 / 6, 1000 / 3, 500].map(ms => sample('newsTalk', ms));
      const clipStart = defaultSamples[0].start;
      demo.drawScene(clipStart + 50);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.drawScene(clipStart + 100);
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let pixelsChanged = 0;
      for (let i = 0; i < before.length; i += 4) {
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 40) pixelsChanged++;
      }
      demo.seek(1, 0, { replay: true });
      const slowSamples = [0, 1000 / 6, 1000 / 3, 1000].map(ms => sample('newsSummary', ms).x);
      demo.seek(2, 0, { replay: true });
      const none = demo.modeRuntime.newsTalk.clips.some(item => item.key === 'news.Entry');
      demo.seek(3, 0, { replay: true });
      const delayedClip = demo.modeRuntime.newsSummary.clips.find(item => item.key === 'news.Entry');
      const delay = delayedClip.start - demo.state.lineStart;
      const delayedMid = sample('newsSummary', 1000 / 6).x;
      demo.seek(1, 0.5);
      const frozen = demo.collectOverrides(demo.modeRuntime.newsSummary, demo.state.freezeTime).ov.get('')?.sx;
      return { defaultSamples, slowSamples, pixelsChanged, none, delay, delayedMid, frozen };
    })()`);
    for (const [i, expected] of [0, 0.55, 1.1, 1.05, 1].entries()) {
      assert.ok(Math.abs(newsEntry.defaultSamples[i].x - expected) < 1e-4 &&
        Math.abs(newsEntry.defaultSamples[i].y - expected) < 1e-4, JSON.stringify(newsEntry));
    }
    for (const [i, expected] of [0, 0.55, 1.1, 1].entries()) {
      assert.ok(Math.abs(newsEntry.slowSamples[i] - expected) < 1e-4, JSON.stringify(newsEntry));
    }
    assert.ok(newsEntry.pixelsChanged > 100 && !newsEntry.none && newsEntry.delay >= 499 && newsEntry.delay < 600 &&
      Math.abs(newsEntry.delayedMid - 0.55) < 1e-4 && Math.abs(newsEntry.frozen - 1.084375) < 1e-4, JSON.stringify(newsEntry));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/image-action.json`);
    let imageAction = null;
    const imageDeadline = Date.now() + 20000;
    while (Date.now() < imageDeadline) {
      imageAction = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        if (!demo?.stageImages.has('picture') || !demo.stageActors.has('ner')) return null;
        demo.drawScene(demo.state.lineStart + 500);
        const image = demo.stageImages.get('picture');
        return { x: image.x, alpha: image.alpha, brightness: image.brightness,
          actorBrightness: demo.stageActors.get('ner').brightness };
      })()`);
      if (imageAction) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(imageAction && Math.abs(imageAction.x - 1060) < 1 && Math.abs(imageAction.alpha - 0.6) < 0.01 &&
      Math.abs(imageAction.brightness - 0.5) < 0.01 && Math.abs(imageAction.actorBrightness - 0.5) < 0.01, JSON.stringify(imageAction));
    let brightnessPixels = null;
    while (Date.now() < imageDeadline) {
      brightnessPixels = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo, line = demo.STORY[demo.state.line];
        const action = line.actions.find(item => item.actor === 'ner' && item.property === 'brightness');
        const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
        const now = demo.state.lineStart + 500;
        action.from = action.to = 0;
        demo.drawScene(now);
        const dark = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        action.from = action.to = 1;
        demo.drawScene(now);
        const light = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let changed = 0;
        for (let i = 0; i < dark.length; i += 4)
          if (Math.abs(dark[i] - light[i]) + Math.abs(dark[i+1] - light[i+1]) + Math.abs(dark[i+2] - light[i+2]) > 50) changed++;
        return changed;
      })()`);
      if (brightnessPixels > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(brightnessPixels > 100, `Character brightness did not change pixels: ${brightnessPixels}`);
    let imageBrightnessPixels = 0;
    while (Date.now() < imageDeadline) {
      imageBrightnessPixels = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo, line = demo.STORY[demo.state.line];
        const action = line.actions.find(item => item.actor === 'picture' && item.property === 'brightness');
        const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
        const now = demo.state.lineStart + 500;
        action.from = action.to = 0;
        demo.drawScene(now);
        const dark = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        action.from = action.to = 2;
        demo.drawScene(now);
        const light = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let changed = 0;
        for (let i = 0; i < dark.length; i += 4)
          if (Math.abs(dark[i] - light[i]) + Math.abs(dark[i+1] - light[i+1]) + Math.abs(dark[i+2] - light[i+2]) > 40) changed++;
        return changed;
      })()`);
      if (imageBrightnessPixels > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(imageBrightnessPixels > 100, `Image brightness did not change pixels: ${imageBrightnessPixels}`);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/transition.json`);
    const transitionDeadline = Date.now() + 20000;
    while (Date.now() < transitionDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const transitionResult = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.drawScene(start + 500);
      const middle = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - middle[i]) + Math.abs(before[i+1] - middle[i+1]) + Math.abs(before[i+2] - middle[i+2]) > 30) changed++;
      const line = demo.STORY[demo.state.line];
      line.kind = 'colorbars';
      demo.drawScene(start + 500);
      const sampleBar = y => Array.from(ctx.getImageData(Math.floor(canvas.width * 0.25), Math.floor(canvas.height * y), 1, 1).data);
      const barPixels = [sampleBar(0.1), sampleBar(0.9)];
      line.kind = 'fadeblack';
      demo.updateState(start + 999);
      const beforeEnd = demo.state.line;
      demo.updateState(start + 1000);
      return { changed, barPixels, beforeEnd, afterEnd: demo.state.line, auto: demo.state.auto };
    })()`);
    assert.ok(transitionResult.changed > 100 && transitionResult.beforeEnd === 0 &&
      transitionResult.afterEnd === 1 && transitionResult.auto === false, JSON.stringify(transitionResult));
    assert.ok(transitionResult.barPixels[0].every((value, i) => Math.abs(value - transitionResult.barPixels[1][i]) <= 2) &&
      transitionResult.barPixels[1][0] > 180 && transitionResult.barPixels[1][1] > 170 &&
      transitionResult.barPixels[1][2] > 150, JSON.stringify(transitionResult.barPixels));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/bound-image-effects.json`);
    const boundDeadline = Date.now() + 20000;
    while (Date.now() < boundDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.images["stage:assets/bg/elf_city_night.png"])')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const boundEffects = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.state.auto = false;
      demo.startLine(0);
      const now = demo.state.lineStart + 500;
      const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const pixels = () => { demo.drawScene(now); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
      const difference = (a, b) => {
        let count = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) count++;
        return count;
      };
      const baseline = pixels();
      const parent = demo.stageImages.get('parent'), child = demo.stageImages.get('child');
      const values = { parentX: parent.x, childX: child.x, expectedX: parent.x + 200 * parent.sx,
        alpha: child.alpha, brightness: child.brightness };
      const alpha = demo.STORY[0].actions.find(action => action.actor === 'child' && action.property === 'alpha');
      const brightness = demo.STORY[0].actions.find(action => action.actor === 'child' && action.property === 'brightness');
      const saved = [alpha.to, brightness.to];
      alpha.to = 1; const noAlphaChange = pixels(); alpha.to = saved[0];
      brightness.to = 1; const noBrightnessChange = pixels(); brightness.to = saved[1];
      const final = demo.STORY[1].stage.find(item => item.id === 'child');
      return { values, alphaPixels: difference(baseline, noAlphaChange), brightnessPixels: difference(baseline, noBrightnessChange),
        final: { alpha: final.alpha, brightness: final.brightness, parent: final.parent } };
    })()`);
    assert.ok(Math.abs(boundEffects.values.parentX - 800) < 0.01 &&
      Math.abs(boundEffects.values.childX - boundEffects.values.expectedX) < 0.01 &&
      Math.abs(boundEffects.values.alpha - 0.6) < 0.01 && Math.abs(boundEffects.values.brightness - 0.7) < 0.01,
      JSON.stringify(boundEffects));
    assert.ok(boundEffects.alphaPixels > 30 && boundEffects.brightnessPixels > 30, JSON.stringify(boundEffects));
    assert.deepStrictEqual(boundEffects.final, { alpha: 0.2, brightness: 0.4, parent: 'parent' });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-image-project/&storyUrl=/image-replacement.json`);
    const replaceDeadline = Date.now() + 20000;
    while (Date.now() < replaceDeadline && (!pendingSlowImages.length ||
      !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.stageImages.has("ner"))'))) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(pendingSlowImages.length, 'Slow first image was not requested');
    const replacementStarted = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const slow = 'stage:assets/dialogue/Dialogue_Button_Active.png';
      const before = { slowLoaded: Boolean(demo.images[slow]), builtinLoaded: Boolean(demo.images.ner) };
      demo.state.auto = false;
      demo.startLine(1);
      return before;
    })()`);
    assert.deepStrictEqual(replacementStarted, { slowLoaded: false, builtinLoaded: true });
    let replacementReady = false;
    while (Date.now() < replaceDeadline) {
      replacementReady = await win.webContents.executeJavaScript('Boolean(window.__demo.images["stage:assets/bg/elf_arthall_night.png"])');
      if (replacementReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(replacementReady, 'Replacement image did not load');
    const captureReplacement = `(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      const first = demo.images['stage:assets/dialogue/Dialogue_Button_Active.png'];
      const second = demo.images['stage:assets/bg/elf_arthall_night.png'];
      const builtin = demo.images.ner, seen = [];
      const original = ctx.drawImage;
      ctx.drawImage = function(image, ...args) {
        if (image === first && first) seen.push('first');
        if (image === second && second) seen.push('second');
        if (image === builtin && builtin) seen.push('builtin');
        return original.call(this, image, ...args);
      };
      try { demo.drawScene(demo.state.lineStart + 500); }
      finally { ctx.drawImage = original; }
      return { src: demo.stageImages.get('ner')?.conf.src, seen };
    })()`;
    const beforeSlow = await win.webContents.executeJavaScript(captureReplacement);
    assert.deepStrictEqual(beforeSlow, { src: 'assets/bg/elf_arthall_night.png', seen: ['second'] });
    for (const response of pendingSlowImages.splice(0)) {
      if (!response.destroyed) serveFile(response, project, 'assets/dialogue/Dialogue_Button_Active.png');
    }
    while (Date.now() < replaceDeadline &&
      !await win.webContents.executeJavaScript('Boolean(window.__demo.images["stage:assets/dialogue/Dialogue_Button_Active.png"])')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepStrictEqual(await win.webContents.executeJavaScript(captureReplacement), beforeSlow);
    await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(2);
      demo.state.freeze = true;
      demo.state.freezeTime = demo.state.lineStart;
      demo.dispatchLineEvents(demo.state.lineStart + 100);
    })()`);
    assert.deepStrictEqual(await win.webContents.executeJavaScript(captureReplacement),
      { src: 'assets/dialogue/Dialogue_Button_Active.png', seen: ['first'] });
    await win.webContents.executeJavaScript('window.__demo.dispatchLineEvents(window.__demo.state.lineStart + 200)');
    assert.deepStrictEqual(await win.webContents.executeJavaScript(captureReplacement), beforeSlow);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-image-project/&storyUrl=/ui-stage-parent.json`);
    const uiParentDeadline = Date.now() + 20000;
    while (Date.now() < uiParentDeadline && (!pendingSlowImages.length ||
      !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("card") && window.__demo.stageImages.has("picture"))'))) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(pendingSlowImages.length, 'Bound image was not requested');
    const pendingUiImage = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.stageImages.get('picture').alpha = 1;
      const world = demo.uiWorldTransforms().get('card');
      const ctx = document.getElementById('view').getContext('2d');
      const original = ctx.drawImage;
      let draws = 0;
      ctx.drawImage = function(image, ...args) {
        if (image === demo.images.bubble) draws++;
        return original.call(this, image, ...args);
      };
      try { demo.drawScene(performance.now() + 600); } finally { ctx.drawImage = original; }
      return { loaded: Boolean(demo.images['stage:assets/dialogue/Dialogue_Button_Active.png']),
        visible: world.visible, draws };
    })()`);
    assert.deepStrictEqual(pendingUiImage, { loaded: false, visible: false, draws: 0 });
    for (const response of pendingSlowImages.splice(0)) {
      if (!response.destroyed) serveFile(response, project, 'assets/dialogue/Dialogue_Button_Active.png');
    }
    while (Date.now() < uiParentDeadline &&
      !await win.webContents.executeJavaScript('Boolean(window.__demo.images["stage:assets/dialogue/Dialogue_Button_Active.png"])')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const uiImageLifecycle = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const world = () => {
        const item = demo.uiWorldTransforms().get('card');
        return { visible: item.visible, alpha: item.alpha, x: item.matrix[4] };
      };
      let picture = demo.stageImages.get('picture');
      picture.alpha = 1;
      const loaded = world();
      const ctx = document.getElementById('view').getContext('2d'), original = ctx.drawImage;
      let loadedDraws = 0;
      ctx.drawImage = function(image, ...args) {
        if (image === demo.images.bubble) loadedDraws++;
        return original.call(this, image, ...args);
      };
      try { demo.drawScene(performance.now() + 600); } finally { ctx.drawImage = original; }
      demo.state.typingDone = true;
      demo.advance();
      const first = demo.state.lineStart;
      demo.dispatchLineEvents(first + 100);
      picture.alpha = 0.4;
      const fading = { ...world(), target: picture.targetAlpha };
      picture.alpha = 0;
      const hidden = world();
      demo.updateState(first + 300);
      const secondLine = demo.state.line;
      const snapshotHasParent = demo.STORY[secondLine].stage.some(item => item.id === 'picture');
      demo.dispatchLineEvents(demo.state.lineStart + 100);
      picture = demo.stageImages.get('picture');
      picture.alpha = 1;
      picture.x = picture.targetX;
      const reshown = world();
      demo.stageImages.clear();
      const seekOk = demo.seek(secondLine, 0.2);
      picture = demo.stageImages.get('picture');
      picture.alpha = 1;
      const preview = { ...world(), frozen: demo.state.freeze, seekOk };
      return { loaded, loadedDraws, fading, hidden, snapshotHasParent, reshown, preview };
    })()`);
    assert.deepStrictEqual(uiImageLifecycle.loaded, { visible: true, alpha: 1, x: 550 });
    assert.ok(uiImageLifecycle.loadedDraws > 0, JSON.stringify(uiImageLifecycle));
    assert.deepStrictEqual(uiImageLifecycle.fading, { visible: true, alpha: 0.4, x: 550, target: 0 });
    assert.strictEqual(uiImageLifecycle.hidden.alpha, 0);
    assert.strictEqual(uiImageLifecycle.snapshotHasParent, false);
    assert.deepStrictEqual(uiImageLifecycle.reshown, { visible: true, alpha: 1, x: 950 });
    assert.deepStrictEqual(uiImageLifecycle.preview, { visible: true, alpha: 1, x: 950, frozen: true, seekOk: true });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/ordered-moves.json`);
    const orderedDeadline = Date.now() + 20000;
    while (Date.now() < orderedDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.stageImages.has("picture"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const orderedMoves = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 750);
      const early = demo.stageImages.get('picture')?.x;
      demo.drawScene(start + 1500);
      const middle = demo.stageImages.get('picture')?.x;
      demo.drawScene(start + 2000);
      const end = demo.stageImages.get('picture')?.x;
      demo.startLine(1);
      return { early, middle, end, nextTarget: demo.stageImages.get('picture')?.targetX };
    })()`);
    assert.ok(Math.abs(orderedMoves.early - 25) < 0.01 && Math.abs(orderedMoves.middle - 150) < 0.01 &&
      Math.abs(orderedMoves.end - 200) < 0.01 && orderedMoves.nextTarget === 200, JSON.stringify(orderedMoves));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/delayed-fade.json`);
    const fadeDeadline = Date.now() + 20000;
    while (Date.now() < fadeDeadline && !await win.webContents.executeJavaScript("Boolean(window.__demo?.spineActors.has('ner'))")) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const delayedFade = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 100);
      const retained = demo.stageActors.has('ner') && demo.stageImages.has('picture');
      demo.drawScene(start + 1000);
      const actorAlpha = demo.stageActors.get('ner')?.alpha;
      const imageAlpha = demo.stageImages.get('picture')?.alpha;
      for (const action of demo.STORY[0].actions) { action.from = -1; action.to = 2; }
      demo.drawScene(start + 1500);
      const maxClamped = demo.stageActors.get('ner')?.alpha === 1 && demo.stageImages.get('picture')?.alpha === 1;
      demo.drawScene(start + 500);
      const minClamped = demo.stageActors.get('ner')?.alpha === 0 && demo.stageImages.get('picture')?.alpha === 0;
      demo.drawScene(start + 1500);
      demo.startLine(1);
      for (let i = 1; i <= 100; i++) demo.drawScene(demo.state.lineStart + i * 16);
      return { retained, actorAlpha, imageAlpha, maxClamped, minClamped, actorRemoved: !demo.stageActors.has('ner'), imageRemoved: !demo.stageImages.has('picture') };
    })()`);
    assert.ok(delayedFade.retained && Math.abs(delayedFade.actorAlpha - 0.5) < 0.01 &&
      Math.abs(delayedFade.imageAlpha - 0.5) < 0.01 && delayedFade.maxClamped && delayedFade.minClamped &&
      delayedFade.actorRemoved && delayedFade.imageRemoved, JSON.stringify(delayedFade));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/timed-audio.json`);
    const audioDeadline = Date.now() + 20000;
    while (Date.now() < audioDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const realAudio = await win.webContents.executeJavaScript(`(async () => {
      const demo = window.__demo;
      const OriginalAudio = window.Audio;
      const created = [];
      window.Audio = function () {
        const element = new OriginalAudio();
        created.push(element);
        return element;
      };
      try {
        demo.startLine(0);
        const waitUntil = async predicate => {
          for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 20));
          return predicate();
        };
        const firstPlaying = await waitUntil(() => created[0] && !created[0].paused && created[0].currentTime > 0);
        demo.dispatchLineEvents(demo.state.lineStart + 500);
        const secondPlaying = await waitUntil(() => created[1] && !created[1].paused && created[1].currentTime > 0);
        const result = {
          count: created.length,
          native: created.every(item => item instanceof HTMLAudioElement),
          firstPlaying, firstPaused: created[0] && created[0].paused,
          secondPlaying,
        };
        demo.dispatchLineEvents(demo.state.lineStart + 2000);
        result.secondPaused = created[1] && created[1].paused;
        return result;
      } finally {
        created.forEach(item => item.pause());
        window.Audio = OriginalAudio;
      }
    })()`, true);
    assert.deepStrictEqual(realAudio, {
      count: 2, native: true, firstPlaying: true, firstPaused: true, secondPlaying: true, secondPaused: true,
    });
    const timeline = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const OriginalAudio = window.Audio;
      const log = [];
      window.Audio = class {
        constructor() { this.volume = 0; this.duration = NaN; }
        addEventListener() {}
        play() { log.push('play'); return Promise.resolve(); }
        pause() { log.push('stop'); }
      };
      try {
        demo.startLine(0);
        demo.dispatchLineEvents(demo.state.lineStart + 499);
        const before = log.slice();
        demo.dispatchLineEvents(demo.state.lineStart + 500);
        demo.dispatchLineEvents(demo.state.lineStart + 500);
        const ordered = log.slice();
        demo.advance();
        demo.advance();
        demo.dispatchLineEvents(demo.state.lineStart + 3000);
        const afterAdvance = log.slice();
        demo.seek(0, 0);
        demo.dispatchLineEvents(demo.state.lineStart + 3000);
        const afterStaticSeek = log.slice();
        demo.seek(0, 0, { replay: true });
        const afterReplay = log.slice();
        return { before, ordered, afterAdvance, afterStaticSeek, afterReplay, line: demo.state.line };
      } finally { window.Audio = OriginalAudio; }
    })()`);
    assert.deepStrictEqual(timeline.before, ['play']);
    assert.deepStrictEqual(timeline.ordered, ['play', 'stop', 'play']);
    assert.deepStrictEqual(timeline.afterAdvance, timeline.ordered);
    assert.deepStrictEqual(timeline.afterStaticSeek, timeline.ordered);
    assert.deepStrictEqual(timeline.afterReplay, ['play', 'stop', 'play', 'stop', 'play']);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/staged-parallel.json`);
    const stagedDeadline = Date.now() + 20000;
    while (Date.now() < stagedDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.spineActors.has("ner") && window.__demo.stageActors.has("ner"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const staged = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 100);
      const early = { erpin: demo.stageActors.has('erpin'), ner: demo.stageActors.has('ner') };
      demo.dispatchLineEvents(start + 600);
      demo.drawScene(start + 600);
      const middle = {
        erpin: demo.stageActors.has('erpin'),
        erpinAlpha: demo.stageActors.get('erpin')?.alpha,
        erpinX: demo.stageActors.get('erpin')?.x,
        nerTarget: demo.stageActors.get('ner')?.targetAlpha,
      };
      demo.drawScene(start + 750);
      const movingX = demo.stageActors.get('erpin')?.x;
      demo.dispatchLineEvents(start + 900);
      demo.drawScene(start + 900);
      const late = { erpin: demo.stageActors.has('erpin'), nerTarget: demo.stageActors.get('ner')?.targetAlpha };
      return { early, middle, movingX, late };
    })()`);
    assert.ok(!staged.early.erpin && staged.early.ner && staged.middle.erpin &&
      staged.middle.erpinAlpha > 0 && staged.middle.erpinAlpha < 1 &&
      staged.middle.nerTarget === 1 && Math.abs(staged.movingX - 1171) < 2 &&
      staged.late.nerTarget === 0, JSON.stringify(staged));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/image-parallel.json`);
    const imageParallelDeadline = Date.now() + 20000;
    while (Date.now() < imageParallelDeadline &&
      !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.images?.["stage:assets/bg/elf_city_night.png"])')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const imageParallel = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.stageImages.clear();
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 100);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.dispatchLineEvents(start + 250);
      demo.drawScene(start + 250);
      const shown = demo.stageImages.get('picture');
      demo.drawScene(start + 500);
      const moving = demo.stageImages.get('picture');
      demo.dispatchLineEvents(start + 750);
      const hiddenTarget = demo.stageImages.get('picture')?.targetAlpha;
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let pixelsChanged = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 40) pixelsChanged++;
      return { shown: Boolean(shown), shownAlpha: shown?.alpha, x: moving?.x, hiddenTarget, pixelsChanged };
    })()`);
    assert.ok(imageParallel.shown && imageParallel.shownAlpha > 0 && imageParallel.x > 1000 &&
      imageParallel.hiddenTarget === 0 && imageParallel.pixelsChanged > 100, JSON.stringify(imageParallel));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/reshow-parallel.json`);
    const reshowDeadline = Date.now() + 20000;
    while (Date.now() < reshowDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.stageImages.has("picture"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const reshow = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 100);
      const moving = demo.stageImages.get('picture')?.x;
      demo.dispatchLineEvents(start + 300);
      demo.drawScene(start + 300);
      const hiddenTarget = demo.stageImages.get('picture')?.targetAlpha;
      demo.dispatchLineEvents(start + 500);
      for (let i = 0; i < 80; i++) demo.drawScene(start + 500 + i * 16);
      const picture = demo.stageImages.get('picture');
      return { moving, hiddenTarget, shown: Boolean(picture), x: picture?.x,
        targetX: picture?.targetX, nextX: demo.STORY[1].stage.find(item => item.id === 'picture')?.x };
    })()`);
    assert.ok(Math.abs(reshow.moving - 150) < 1 && reshow.hiddenTarget === 0 && reshow.shown &&
      Math.abs(reshow.x - 300) < 1 && reshow.targetX === 300 && reshow.nextX === 300, JSON.stringify(reshow));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/binding-parallel.json`);
    const bindingDeadline = Date.now() + 20000;
    while (Date.now() < bindingDeadline &&
      !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.images?.["stage:assets/bg/elf_city_night.png"])')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const binding = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.dispatchLineEvents(start + 300);
      demo.drawScene(start + 300);
      const shown = Boolean(demo.stageImages.get('picture'));
      demo.dispatchLineEvents(start + 600);
      demo.drawScene(start + 600);
      const bound = demo.stageImages.get('picture');
      const boundParent = bound?.conf?.parent;
      const boundX = bound?.x;
      const boundOffsetX = boundX - demo.stageActors.get('ner')?.x;
      demo.dispatchLineEvents(start + 900);
      const unbound = demo.stageImages.get('picture');
      return {
        shown,
        boundParent,
        boundX,
        boundOffsetX,
        unboundParent: unbound?.conf?.parent,
        unboundX: unbound?.x,
        unboundY: unbound?.y,
      };
    })()`);
    assert.ok(binding.shown && binding.boundParent === 'ner' && Math.abs(binding.boundOffsetX - 72) < 1 &&
      binding.unboundParent === null && Math.abs(binding.unboundX - 100) < 1 &&
      Math.abs(binding.unboundY - 200) < 1, JSON.stringify(binding));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/actor-image-binding.json`);
    const actorImageDeadline = Date.now() + 20000;
    while (Date.now() < actorImageDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.spineActors.has("ner") && window.__demo.stageImages.has("picture"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const actorImageBinding = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.dispatchLineEvents(start + 200);
      demo.drawScene(start + 200);
      demo.dispatchLineEvents(start + 500);
      demo.drawScene(start + 500);
      const child = demo.stageActors.get('ner'), parent = demo.stageImages.get('picture');
      return { parent: child?.conf?.parent, x: child?.x, y: child?.y,
        expectedX: parent.x + 80 * parent.sx, expectedY: parent.y + 50 * parent.sy,
        snapshotParent: demo.STORY[1].stage.find(item => item.id === 'ner')?.parent };
    })()`);
    assert.ok(actorImageBinding.parent === 'picture' && actorImageBinding.snapshotParent === 'picture' &&
      Math.abs(actorImageBinding.x - actorImageBinding.expectedX) < 0.01 &&
      Math.abs(actorImageBinding.y - actorImageBinding.expectedY) < 0.01, JSON.stringify(actorImageBinding));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/mixed-binding-chain.json`);
    const chainDeadline = Date.now() + 20000;
    let chainReady = false;
    while (Date.now() < chainDeadline) {
      chainReady = await win.webContents.executeJavaScript(`Boolean(window.__demo?.state.started &&
        window.__demo.spineActors.has('ner') && window.__demo.spineActors.has('erpin') &&
        window.__demo.images['stage:assets/bg/elf_city_night.png'])`);
      if (chainReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(chainReady, 'Mixed binding fixture did not load');
    const chain = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.startLine(0);
      const start = demo.state.lineStart;
      const image = demo.images['stage:assets/bg/elf_city_night.png'], drawn = [];
      const original = ctx.drawImage;
      ctx.drawImage = function(source, ...args) {
        if (source === image) {
          const transform = ctx.getTransform();
          drawn.push({ x: transform.e / (canvas.width / 1920), y: transform.f / (canvas.height / 1080) });
        }
        return original.call(this, source, ...args);
      };
      try { demo.drawScene(start + 500); } finally { ctx.drawImage = original; }
      const positions = () => {
        const root = demo.stageActors.get('ner'), middle = demo.stageImages.get('middle');
        const leaf = demo.stageImages.get('leaf'), child = demo.stageActors.get('erpin');
        return { rootX: root.x, rootY: root.y, rootSX: root.sx, rootSY: root.sy, rootRot: root.rot,
          middleX: middle.x, middleY: middle.y, middleSX: middle.sx, middleSY: middle.sy, middleRot: middle.rot,
          leafX: leaf.x, leafY: leaf.y, childX: child.x, childY: child.y,
          childSkeletonX: demo.spineActors.get('erpin').skeleton.x };
      };
      const shown = positions();
      demo.setRenderingEnabled(false);
      try { demo.tick(start + 750); } finally { demo.setRenderingEnabled(true); }
      return { shown, hidden: positions(), drawn };
    })()`);
    const offsetPosition = (x, y, sx, sy, rot, lx, ly) => {
      const angle = rot * Math.PI / 180;
      return [x + lx * Math.cos(angle) * sx - ly * Math.sin(angle) * sy,
        y + lx * Math.sin(angle) * sx + ly * Math.cos(angle) * sy];
    };
    for (const [time, expectedRoot] of [['shown', 500], ['hidden', 700]]) {
      const p = chain[time];
      const middle = offsetPosition(p.rootX, p.rootY, p.rootSX, p.rootSY, p.rootRot, 80, 50);
      const leaf = offsetPosition(p.middleX, p.middleY, p.middleSX, p.middleSY, p.middleRot, 150, -40);
      const child = offsetPosition(p.middleX, p.middleY, p.middleSX, p.middleSY, p.middleRot, 40, 25);
      assert.ok(Math.abs(p.rootX - expectedRoot) < 0.01 &&
        Math.abs(p.middleX - middle[0]) < 0.01 && Math.abs(p.middleY - middle[1]) < 0.01 &&
        Math.abs(p.leafX - leaf[0]) < 0.01 && Math.abs(p.leafY - leaf[1]) < 0.01 &&
        Math.abs(p.childX - child[0]) < 0.01 && Math.abs(p.childY - child[1]) < 0.01 &&
        Math.abs(p.childSkeletonX - (p.childX - 960)) < 0.01, JSON.stringify(chain));
    }
    assert.strictEqual(chain.drawn.length, 2, JSON.stringify(chain));
    assert.ok(Math.abs(chain.drawn[0].x - chain.shown.leafX) < 0.1 &&
      Math.abs(chain.drawn[0].y - chain.shown.leafY) < 0.1 &&
      Math.abs(chain.drawn[1].x - chain.shown.middleX) < 0.1 &&
      Math.abs(chain.drawn[1].y - chain.shown.middleY) < 0.1, JSON.stringify(chain));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&storyUrl=/delayed-dialogue.json`);
    const delayDeadline = Date.now() + 20000;
    while (Date.now() < delayDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const delayed = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      const mode = demo.modeRuntime.normal;
      const clipStart = mode.clips[0].start - start;
      demo.updateState(start + 500);
      demo.drawScene(start + 500);
      const canvas = document.getElementById('view');
      const ctx = canvas.getContext('2d');
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const earlyReveal = mode.reveal;
      demo.advance();
      const earlyLine = demo.state.line;
      const earlyDone = demo.state.typingDone;
      demo.STORY[0].timelineEnd = 5;
      demo.STORY[0].hold = 0.1;
      demo.updateState(start + 2500);
      demo.drawScene(start + 2500);
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 30) changed++;
      const lateReveal = mode.reveal;
      demo.updateState(start + 4000);
      const readyAfterStart = demo.state.readyAt - start;
      demo.seek(0, 0);
      demo.drawScene(performance.now());
      const staticVisible = demo.state.freeze && mode.reveal > 0;
      demo.seek(0, 0, { replay: true });
      return { clipStart, earlyReveal, earlyLine, earlyDone, lateReveal, changed, staticVisible, readyAfterStart,
        replayDelay: demo.state.dialogueStartAt - demo.state.lineStart };
    })()`);
    assert.ok(delayed.clipStart >= 1490 && delayed.clipStart < 1600, JSON.stringify(delayed));
    assert.strictEqual(delayed.earlyReveal, 0);
    assert.strictEqual(delayed.earlyLine, 0);
    assert.strictEqual(delayed.earlyDone, false);
    assert.ok(delayed.lateReveal > 0 && delayed.changed > 100, JSON.stringify(delayed));
    assert.strictEqual(delayed.readyAfterStart, 5000);
    assert.strictEqual(delayed.staticVisible, true);
    assert.strictEqual(delayed.replayDelay, 1500);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/wait.json`);
    const waitDeadline = Date.now() + 20000;
    while (Date.now() < waitDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.stageImages.has("picture"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const waits = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.seek(0, 0, { replay: true });
      const first = demo.state.lineStart;
      demo.advance();
      const afterClick = demo.state.line;
      demo.updateState(first + 199);
      const beforeEnd = demo.state.line;
      demo.updateState(first + 200);
      const parallelLine = demo.state.line;
      const second = demo.state.lineStart;
      demo.drawScene(second + 150);
      const middleX = demo.stageImages.get('picture').x;
      demo.updateState(second + 399);
      const beforeParallelEnd = demo.state.line;
      demo.updateState(second + 400);
      const finalX = demo.stageImages.get('picture').x;
      const afterParallel = demo.state.line;
      demo.seek(1, 0);
      demo.updateState(demo.state.lineStart + 1000);
      return { afterClick, beforeEnd, parallelLine, middleX, beforeParallelEnd, finalX, afterParallel,
        staticLine: demo.state.line, staticFrozen: demo.state.freeze };
    })()`);
    assert.strictEqual(waits.afterClick, 0);
    assert.strictEqual(waits.beforeEnd, 0);
    assert.strictEqual(waits.parallelLine, 1);
    assert.ok(Math.abs(waits.middleX - 200) < 1, JSON.stringify(waits));
    assert.strictEqual(waits.beforeParallelEnd, 1);
    assert.strictEqual(waits.afterParallel, 2);
    assert.ok(Math.abs(waits.finalX - 300) < 1, JSON.stringify(waits));
    assert.strictEqual(waits.staticLine, 1);
    assert.strictEqual(waits.staticFrozen, true);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&storyUrl=/automatic-ui.json`);
    const automaticUiDeadline = Date.now() + 20000;
    while (Date.now() < automaticUiDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const automaticUi = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const target = demo.STORY.findIndex(line => line.mode === 'narration');
      demo.seek(target, 0);
      const reconstructed = { ...demo.uiObjects.get('frame') };
      const first = demo.STORY.findIndex(line => line.mode === 'wait');
      demo.seek(first, 0, { replay: true });
      const start = demo.state.lineStart;
      const position = time => demo.uiWorldTransforms(time).get('frame').matrix.slice(4);
      const before = position(start + 100);
      const middle = position(start + 700);
      demo.updateState(start + 1200);
      const firstEnd = { ...demo.uiObjects.get('frame') };
      const secondStart = demo.state.lineStart;
      const secondMiddle = position(secondStart + 200);
      demo.updateState(secondStart + 400);
      const final = { ...demo.uiObjects.get('frame') };
      return { reconstructed, before, middle, firstEnd, secondMiddle, final,
        line: demo.state.line, target };
    })()`);
    assert.deepStrictEqual([automaticUi.reconstructed.x, automaticUi.reconstructed.y], [300, 280]);
    assert.deepStrictEqual(automaticUi.before, [100, 200]);
    assert.deepStrictEqual(automaticUi.middle, [200, 200]);
    assert.deepStrictEqual([automaticUi.firstEnd.x, automaticUi.firstEnd.y], [300, 200]);
    assert.deepStrictEqual(automaticUi.secondMiddle, [300, 240]);
    assert.deepStrictEqual([automaticUi.final.x, automaticUi.final.y], [300, 280]);
    assert.strictEqual(automaticUi.line, automaticUi.target);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/timed-ui-events.json`);
    const timedUiDeadline = Date.now() + 20000;
    while (Date.now() < timedUiDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const timedUiEvents = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const next = demo.STORY.findIndex(line => line.mode === 'narration');
      const reconstructedOk = demo.seek(next, 0);
      const reconstructed = { ok: reconstructedOk, frame: demo.uiObjects.get('frame')?.alpha,
        words: demo.uiObjects.get('words')?.text, parent: demo.uiObjects.get('words')?.parent };
      demo.seek(0, 0.5);
      const preview = { frozen: demo.state.freeze, text: demo.uiObjects.get('words')?.text,
        alpha: demo.uiObjects.get('frame')?.alpha ?? 1, typingDone: demo.state.typingDone };
      demo.seek(0, 0, { replay: true });
      demo.state.auto = true;
      demo.STORY[0].hold = 0;
      const start = demo.state.lineStart;
      demo.updateState(start + 99);
      const before = demo.uiObjects.size;
      demo.updateState(start + 100);
      const created = { size: demo.uiObjects.size, parent: demo.uiObjects.get('words')?.parent };
      demo.updateState(start + 300);
      const writing = { text: demo.uiObjects.get('words')?.text,
        shown: demo.uiTextVisible(demo.uiObjects.get('words'), start + 600),
        done: demo.state.typingDone };
      demo.updateState(start + 1200);
      const waiting = { line: demo.state.line, alpha: demo.uiObjects.get('frame')?.alpha, done: demo.state.typingDone };
      demo.updateState(start + 10000);
      demo.updateState(start + 10001);
      const completed = { line: demo.state.line, text: demo.uiObjects.get('words')?.text };
      demo.seek(0, 0, { replay: true });
      demo.state.typingDone = true; demo.advance();
      const skipped = { line: demo.state.line, count: demo.uiObjects.size, pending: demo.state.lineEvents.length };
      return { next, reconstructed, preview, before, created, writing, waiting, completed, skipped };
    })()`);
    assert.deepStrictEqual(timedUiEvents.reconstructed, { ok: true, frame: 0.5,
      words: '这段文字需要等待它逐字显示完成。', parent: 'frame' });
    assert.deepStrictEqual(timedUiEvents.preview, { frozen: true, text: '这段文字需要等待它逐字显示完成。',
      alpha: 1, typingDone: true });
    assert.strictEqual(timedUiEvents.before, 0);
    assert.deepStrictEqual(timedUiEvents.created, { size: 2, parent: 'frame' });
    assert.ok(timedUiEvents.writing.shown > 0 && timedUiEvents.writing.shown < timedUiEvents.writing.text.length &&
      !timedUiEvents.writing.done, JSON.stringify(timedUiEvents));
    assert.deepStrictEqual(timedUiEvents.waiting, { line: 0, alpha: 0.5, done: false });
    assert.strictEqual(timedUiEvents.completed.line, timedUiEvents.next);
    assert.deepStrictEqual(timedUiEvents.skipped, { line: timedUiEvents.next, count: 0, pending: 0 });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/mixed-ui-timeline.json`);
    const mixedUiDeadline = Date.now() + 20000;
    while (Date.now() < mixedUiDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const mixedUiRuntime = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const next = demo.STORY.findIndex(line => line.mode === 'narration');
      const reconstructedOk = demo.seek(next, 0);
      const reconstructed = { ...demo.uiObjects.get('frame') };
      const reconstructedWords = demo.uiObjects.has('words');
      demo.seek(0, 0.6);
      const staticWorld = demo.uiWorldTransforms(demo.state.freezeTime).get('frame');
      const staticPreview = { x: staticWorld.matrix[4], alpha: staticWorld.alpha,
        text: demo.uiObjects.get('words').text, frozen: demo.state.freeze };
      demo.seek(0, 0, { replay: true });
      let start = demo.state.lineStart;
      demo.dispatchLineEvents(start + 600);
      demo.state.lineStart = performance.now() - 600;
      demo.state.typingDone = true;
      demo.advance();
      const early = { line: demo.state.line, frame: { ...demo.uiObjects.get('frame') },
        text: demo.uiObjects.get('words')?.text };
      demo.seek(next, 0);
      const checkpoint = { ...demo.uiObjects.get('frame') };
      demo.seek(0, 0, { replay: true });
      start = demo.state.lineStart;
      demo.dispatchLineEvents(start + 600);
      const at600 = { x: demo.uiWorldTransforms(start + 600).get('frame').matrix[4],
        alpha: demo.uiObjects.get('frame').alpha, text: demo.uiObjects.get('words').text };
      demo.dispatchLineEvents(start + 900);
      const at900 = { x: demo.uiWorldTransforms(start + 900).get('frame').matrix[4],
        y: demo.uiWorldTransforms(start + 900).get('frame').matrix[5] };
      demo.dispatchLineEvents(start + 1000);
      const exit = demo.uiExits.find(item => item.node.id === 'frame');
      const removed = { exists: demo.uiObjects.has('frame'), x: exit?.transform.matrix[4], y: exit?.transform.matrix[5] };
      demo.dispatchLineEvents(start + 1300);
      const recreatedWorld = demo.uiWorldTransforms(start + 1300).get('frame');
      const recreated = { x: recreatedWorld.matrix[4], y: recreatedWorld.matrix[5], hasWords: demo.uiObjects.has('words') };
      demo.dispatchLineEvents(start + 1501);
      demo.state.lineStart = performance.now() - 1501;
      demo.state.typingDone = true;
      demo.advance();
      return { next, reconstructedOk, reconstructed, reconstructedWords, staticPreview, early, checkpoint,
        at600, at900, removed, recreated, final: { ...demo.uiObjects.get('frame') }, finalLine: demo.state.line };
    })()`);
    assert.strictEqual(mixedUiRuntime.reconstructedOk, true);
    assert.deepStrictEqual([mixedUiRuntime.reconstructed.x, mixedUiRuntime.reconstructed.y, mixedUiRuntime.reconstructedWords], [50, 400, false]);
    assert.ok(Math.abs(mixedUiRuntime.staticPreview.x - 200) < 0.1 &&
      mixedUiRuntime.staticPreview.alpha === 0.8 && mixedUiRuntime.staticPreview.frozen, JSON.stringify(mixedUiRuntime));
    assert.ok(mixedUiRuntime.early.line === mixedUiRuntime.next &&
      Math.abs(mixedUiRuntime.early.frame.x - 200) < 2 &&
      Math.abs(mixedUiRuntime.checkpoint.x - mixedUiRuntime.early.frame.x) < 0.01, JSON.stringify(mixedUiRuntime));
    assert.ok(Math.abs(mixedUiRuntime.at600.x - 200) < 0.1 && mixedUiRuntime.at600.alpha === 0.8 &&
      mixedUiRuntime.at600.text === '移动期间写字。', JSON.stringify(mixedUiRuntime));
    assert.ok(Math.abs(mixedUiRuntime.at900.x - 625) < 0.1 && mixedUiRuntime.at900.y === 250, JSON.stringify(mixedUiRuntime));
    assert.ok(!mixedUiRuntime.removed.exists && Math.abs(mixedUiRuntime.removed.x - 650) < 0.1 &&
      mixedUiRuntime.removed.y === 250, JSON.stringify(mixedUiRuntime));
    assert.deepStrictEqual(mixedUiRuntime.recreated, { x: 50, y: 350, hasWords: false });
    assert.deepStrictEqual([mixedUiRuntime.final.x, mixedUiRuntime.final.y, mixedUiRuntime.finalLine], [50, 400, mixedUiRuntime.next]);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/invalid-ui-move-order.json`);
    const badMoveDeadline = Date.now() + 20000;
    while (Date.now() < badMoveDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const badMove = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, next = demo.STORY.findIndex(line => line.mode === 'narration');
      const reconstructed = demo.seek(next, 0);
      const firstMessage = document.getElementById('runtimeError').textContent;
      const preview = demo.seek(0, 0.5);
      return { reconstructed, firstMessage, preview, secondMessage: document.getElementById('runtimeError').textContent };
    })()`);
    assert.strictEqual(badMove.reconstructed, false);
    assert.strictEqual(badMove.preview, false);
    assert.ok(badMove.firstMessage.includes('第 4 行运行错误') && badMove.secondMessage.includes('第 4 行运行错误'), JSON.stringify(badMove));
    await new Promise(resolve => setTimeout(resolve, 50));
    for (let count = 0; count < 2; count++) {
      const errorIndex = errors.findIndex(message => message.includes('Runtime error at line 4:'));
      assert.ok(errorIndex >= 0, JSON.stringify(errors));
      errors.splice(errorIndex, 1);
    }
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/ui-bind-during-motion.json`);
    const uiBindDeadline = Date.now() + 20000;
    while (Date.now() < uiBindDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("child"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const uiBindMotion = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, line = demo.STORY.findIndex(item => item.mode === 'ui-present');
      const next = demo.STORY.findIndex(item => item.mode === 'narration');
      demo.seek(next, 0);
      const reconstructed = { ...demo.uiObjects.get('child') };
      demo.seek(line, 0, { replay: true });
      const start = demo.state.lineStart;
      const localX = time => {
        const world = demo.uiWorldTransforms(time), parent = world.get('parent').matrix, child = world.get('child').matrix;
        return (child[4] - parent[4]) / parent[0];
      };
      demo.dispatchLineEvents(start + 600);
      const afterBind = localX(start + 600);
      demo.dispatchLineEvents(start + 950);
      const afterMove = localX(start + 950);
      return { reconstructed, afterBind, afterMove };
    })()`);
    assert.deepStrictEqual([uiBindMotion.reconstructed.parent, uiBindMotion.reconstructed.x], ['parent', 120]);
    assert.ok(Math.abs(uiBindMotion.afterBind - 20) < 0.01 && Math.abs(uiBindMotion.afterMove - 70) < 0.01, JSON.stringify(uiBindMotion));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/timed-dialogue-ui.json`);
    const dialogueTypingDeadline = Date.now() + 20000;
    while (Date.now() < dialogueTypingDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const dialogueTyping = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.seek(0, 0, { replay: true });
      demo.state.auto = true;
      demo.state.typingDone = true;
      const start = demo.state.lineStart;
      demo.state.readyAt = start + 200;
      demo.updateState(start + 1000);
      const waiting = { line: demo.state.line, shown: demo.uiTextVisible(demo.uiObjects.get('words'), start + 1000),
        total: demo.uiObjects.get('words').text.length };
      demo.updateState(start + 10000);
      return { waiting, line: demo.state.line, text: demo.uiObjects.get('words')?.text };
    })()`);
    assert.strictEqual(dialogueTyping.waiting.line, 0);
    assert.ok(dialogueTyping.waiting.shown < dialogueTyping.waiting.total, JSON.stringify(dialogueTyping));
    assert.strictEqual(dialogueTyping.line, 1);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/invalid-timed-ui-events.json`);
    const invalidUiDeadline = Date.now() + 20000;
    while (Date.now() < invalidUiDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("frame"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const invalidUiEvent = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const index = demo.STORY.findIndex(line => line.mode === 'ui-present');
      const ok = demo.seek(index, 0.5);
      return { ok, frozen: demo.state.freeze, message: document.getElementById('runtimeError').textContent };
    })()`);
    assert.strictEqual(invalidUiEvent.ok, false);
    assert.strictEqual(invalidUiEvent.frozen, true);
    assert.ok(invalidUiEvent.message.includes('第 7 行运行错误'), JSON.stringify(invalidUiEvent));
    await new Promise(resolve => setTimeout(resolve, 50));
    const expectedUiError = errors.findIndex(message => message.includes('Runtime error at line 7:'));
    assert.ok(expectedUiError >= 0, JSON.stringify(errors));
    errors.splice(expectedUiError, 1);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/timed-ui-stage-collision.json`);
    const collisionDeadline = Date.now() + 20000;
    while (Date.now() < collisionDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("frame"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const uiCollision = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const index = demo.STORY.findIndex(line => line.mode === 'wait');
      const ok = demo.seek(index, 0.3);
      return { ok, frozen: demo.state.freeze, image: demo.stageImages.has('frame'),
        message: document.getElementById('runtimeError').textContent };
    })()`);
    assert.strictEqual(uiCollision.ok, false);
    assert.strictEqual(uiCollision.frozen, true);
    assert.strictEqual(uiCollision.image, false);
    assert.ok(uiCollision.message.includes('第 5 行运行错误') && uiCollision.message.includes('名称与舞台对象重复'), JSON.stringify(uiCollision));
    await new Promise(resolve => setTimeout(resolve, 50));
    const expectedCollisionError = errors.findIndex(message => message.includes('Runtime error at line 5:'));
    assert.ok(expectedCollisionError >= 0, JSON.stringify(errors));
    errors.splice(expectedCollisionError, 1);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&storyUrl=/dialogue-ui.json`);
    const dialogueUiDeadline = Date.now() + 20000;
    while (Date.now() < dialogueUiDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("frame"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const dialogueUiEarly = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const first = demo.STORY.findIndex(line => line.mode === 'narration');
      const target = demo.STORY.findIndex(line => line.mode === 'sfx');
      demo.seek(target, 0);
      const reconstructed = { ...demo.uiObjects.get('frame') };
      demo.seek(first, 0.5);
      const preview = demo.uiWorldTransforms(demo.state.freezeTime).get('frame').matrix.slice(4);
      demo.seek(first, 0, { replay: true });
      const entryStart = performance.now();
      const entry = [125, 250].map(offset => {
        const world = demo.uiWorldTransforms(entryStart + offset);
        const parent = world.get('frame'), child = world.get('words');
        return { parent, child };
      });
      demo.state.lineStart = performance.now() - 400;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const committed = { ...demo.uiObjects.get('frame') };
      const duringExit = demo.uiWorldTransforms(performance.now() + 500).get('frame').matrix.slice(4);
      return { reconstructed, preview, entry, committed, duringExit, transition: demo.state.transition, target };
    })()`);
    assert.deepStrictEqual([dialogueUiEarly.reconstructed.x, dialogueUiEarly.reconstructed.alpha], [500, 0.5]);
    assert.ok(Math.abs(dialogueUiEarly.preview[0] - 400) < 1, JSON.stringify(dialogueUiEarly));
    for (const sample of dialogueUiEarly.entry) {
      const p = sample.parent.matrix, c = sample.child.matrix;
      assert.ok(Math.abs(c[4] - (p[4] + p[0] * 10 + p[2] * 20)) < 0.001 &&
        Math.abs(c[5] - (p[5] + p[1] * 10 + p[3] * 20)) < 0.001 &&
        Math.abs(c[0] - p[0]) < 0.001 && Math.abs(c[3] - p[3]) < 0.001 &&
        Math.abs(sample.child.alpha - sample.parent.alpha) < 0.001, JSON.stringify(sample));
    }
    assert.ok(dialogueUiEarly.entry[0].parent.matrix[0] < 0.9 &&
      dialogueUiEarly.entry[1].parent.matrix[0] > 1, JSON.stringify(dialogueUiEarly.entry));
    assert.ok(dialogueUiEarly.committed.x > 375 && dialogueUiEarly.committed.x < 395 &&
      dialogueUiEarly.committed.alpha > 0.8 && dialogueUiEarly.committed.alpha < 0.95, JSON.stringify(dialogueUiEarly));
    assert.ok(Math.abs(dialogueUiEarly.duringExit[0] - dialogueUiEarly.committed.x) < 0.01 &&
      dialogueUiEarly.transition === 'modeExit', JSON.stringify(dialogueUiEarly));
    await new Promise(resolve => setTimeout(resolve, 400));
    const dialogueUiAfter = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const current = { ...demo.uiObjects.get('frame') };
      const line = demo.state.line;
      demo.seek(line, 0);
      const checkpoint = { ...demo.uiObjects.get('frame') };
      const first = demo.STORY.findIndex(item => item.mode === 'narration');
      demo.seek(first, 0, { replay: true });
      demo.state.lineStart = performance.now() - 1500;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.state.auto = true;
      demo.state.readyAt = performance.now() - 1;
      demo.updateState(performance.now());
      return { current, line, checkpoint, automatic: { ...demo.uiObjects.get('frame') },
        transition: demo.state.transition };
    })()`);
    assert.strictEqual(dialogueUiAfter.line, dialogueUiEarly.target);
    assert.ok(Math.abs(dialogueUiAfter.current.x - dialogueUiEarly.committed.x) < 0.01 &&
      Math.abs(dialogueUiAfter.checkpoint.x - dialogueUiEarly.committed.x) < 0.01, JSON.stringify(dialogueUiAfter));
    assert.deepStrictEqual([dialogueUiAfter.automatic.x, dialogueUiAfter.automatic.alpha], [500, 0.5]);
    assert.strictEqual(dialogueUiAfter.transition, 'modeExit');
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.strictEqual(await win.webContents.executeJavaScript('window.__demo.state.line'), dialogueUiEarly.target);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/stage-events.json`);
    const stageDeadline = Date.now() + 20000;
    while (Date.now() < stageDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.spineActors.has("ner") && window.__demo.stageActors.has("ner"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const stageEvents = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const actor = demo.spineActors.get('ner');
      const start = demo.state.lineStart;
      const initial = [demo.state.camera.x, demo.state.camera.zoom, actor.current];
      demo.dispatchLineEvents(start + 499);
      const early = [demo.state.camera.zoom, actor.current];
      demo.spineActors.delete('ner');
      demo.dispatchLineEvents(start + 500);
      demo.spineActors.set('ner', actor);
      demo.setStageForLine(demo.STORY[0]);
      const middle = [demo.state.camera.zoom, actor.current, actor.stateData.defaultMix];
      demo.dispatchLineEvents(start + 800);
      const late = [demo.state.camera.x, demo.state.camera.y, actor.skeleton.skin?.name];
      demo.seek(0, 0, { replay: true });
      const replay = [demo.state.camera.x, demo.state.camera.zoom, actor.current];
      demo.seek(0, 0.6);
      const preview = [demo.state.camera.x, demo.state.camera.zoom, actor.current, demo.state.freeze];
      demo.seek(0, 0, { replay: true });
      demo.advance();
      demo.advance();
      const skipped = [demo.state.line, demo.state.camera.x, demo.state.camera.zoom, actor.current];
      return { initial, early, middle, late, replay, preview, skipped };
    })()`);
    assert.deepStrictEqual(stageEvents.initial, [20, 1, 'Idle_1']);
    assert.deepStrictEqual(stageEvents.early, [1, 'Idle_1']);
    assert.deepStrictEqual(stageEvents.middle, [1.5, 'Surprise_1', 0]);
    assert.deepStrictEqual(stageEvents.late, [-30, 50, 'Normal']);
    assert.deepStrictEqual(stageEvents.replay, [20, 1, 'Idle_1']);
    assert.deepStrictEqual(stageEvents.preview, [20, 1.5, 'Surprise_1', true]);
    assert.deepStrictEqual(stageEvents.skipped, [1, 20, 1, 'Idle_1']);
    const earlyActor = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(earlyActorCompiled.story)});
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const waiting = { mode: demo.STORY[demo.state.line].mode,
        x: demo.state.stageBase.find(item => item.id === 'ner').x,
        target: demo.stageActors.get('ner').targetX, animation: demo.spineActors.get('ner').current };
      demo.updateState(demo.state.lineStart + 200);
      const next = { mode: demo.STORY[demo.state.line].mode,
        x: demo.state.stageBase.find(item => item.id === 'ner').x };
      demo.state.typingDone = true;
      demo.advance();
      const explicit = { x: demo.state.stageBase.find(item => item.id === 'ner').x,
        target: demo.stageActors.get('ner').targetX };
      return { waiting, next, explicit };
    })()`);
    assert.ok(earlyActor.waiting.mode === 'wait' && Math.abs(earlyActor.waiting.x - 180) < 2 &&
      Math.abs(earlyActor.waiting.x - earlyActor.waiting.target) < 0.01 && earlyActor.waiting.animation === 'Idle_1',
    JSON.stringify(earlyActor));
    assert.ok(earlyActor.next.mode === 'normal' && Math.abs(earlyActor.next.x - earlyActor.waiting.x) < 0.01, JSON.stringify(earlyActor));
    assert.deepStrictEqual(earlyActor.explicit, { x: 500, target: 500 });
    const earlyEnvironment = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(earlyEnvironmentCompiled.story)});
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const read = () => ({ mode: demo.STORY[demo.state.line].mode, x: demo.state.camera.x,
        y: demo.state.camera.y, brightness: demo.state.sceneFx.brightness, saturation: demo.state.sceneFx.saturation });
      const waiting = read();
      demo.updateState(demo.state.lineStart + 200);
      const next = read();
      demo.state.typingDone = true;
      demo.advance();
      return { waiting, next, explicit: read() };
    })()`);
    assert.ok(earlyEnvironment.waiting.mode === 'wait' && Math.abs(earlyEnvironment.waiting.x - 25) < 0.2 &&
      Math.abs(earlyEnvironment.waiting.brightness - 0.88) < 0.002 &&
      earlyEnvironment.waiting.y === 0 && earlyEnvironment.waiting.saturation === 1, JSON.stringify(earlyEnvironment));
    assert.ok(earlyEnvironment.next.mode === 'normal' &&
      Math.abs(earlyEnvironment.next.x - earlyEnvironment.waiting.x) < 0.001 &&
      Math.abs(earlyEnvironment.next.brightness - earlyEnvironment.waiting.brightness) < 0.001, JSON.stringify(earlyEnvironment));
    assert.deepStrictEqual(earlyEnvironment.explicit, { mode: 'normal', x: 105, y: 0, brightness: 0.4, saturation: 1 });
    const exitEnvironment = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, story = ${JSON.stringify(earlyEnvironmentCompiled.story)};
      delete story.lines[0].exit;
      story.lines[1].timelineEnd = 2;
      for (const event of story.lines[0].events) event.delay = 2.1;
      demo.showStory(story);
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const click = { x: demo.state.camera.x, brightness: demo.state.sceneFx.brightness };
      demo.drawScene(performance.now() + 400);
      return { click, during: { x: demo.state.camera.x, y: demo.state.camera.y,
        brightness: demo.state.sceneFx.brightness, saturation: demo.state.sceneFx.saturation },
        transition: demo.state.transition };
    })()`);
    assert.ok(exitEnvironment.transition === 'modeExit' && Math.abs(exitEnvironment.click.x - 25) < 0.2 &&
      Math.abs(exitEnvironment.during.x - exitEnvironment.click.x) < 0.001 &&
      Math.abs(exitEnvironment.during.brightness - exitEnvironment.click.brightness) < 0.001 &&
      exitEnvironment.during.y === 0 && exitEnvironment.during.saturation === 1, JSON.stringify(exitEnvironment));
    await new Promise(resolve => setTimeout(resolve, 400));
    const exitEnvironmentAfter = await win.webContents.executeJavaScript(`(() => ({
      mode: window.__demo.STORY[window.__demo.state.line].mode,
      x: window.__demo.state.camera.x, brightness: window.__demo.state.sceneFx.brightness
    }))()`);
    assert.ok(exitEnvironmentAfter.mode === 'wait' &&
      Math.abs(exitEnvironmentAfter.x - exitEnvironment.click.x) < 0.001 &&
      Math.abs(exitEnvironmentAfter.brightness - exitEnvironment.click.brightness) < 0.001, JSON.stringify(exitEnvironmentAfter));
    await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(earlyBackgroundCompiled.story)});
      demo.state.lineStart = performance.now() - 3000;
      demo.dispatchLineEvents(performance.now());
    })()`);
    const backgroundLoadDeadline = Date.now() + 15000;
    while (Date.now() < backgroundLoadDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo.images.bg_station)')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(await win.webContents.executeJavaScript('Boolean(window.__demo.images.bg_station)'), 'background did not load');
    const earlyBackground = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.showStory(${JSON.stringify(earlyBackgroundCompiled.story)});
      demo.state.lineStart = performance.now() - 3000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      const now = performance.now();
      demo.dispatchLineEvents(now);
      const capture = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
        demo.drawBackground(now);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        ctx.restore();
        return pixels;
      };
      const before = capture();
      const shaderStart = demo.shaderSpec?.start;
      demo.state.typingDone = true;
      Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
      try { demo.advance(); } finally { delete performance.now; }
      const after = capture();
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 5) changed++;
      const continued = { mode: demo.STORY[demo.state.line].mode,
        layers: demo.state.bgFrozenLayers, shader: demo.shaderSpec?.name,
        sameShaderClock: demo.shaderSpec?.start === shaderStart };
      demo.state.typingDone = true;
      demo.advance();
      const explicit = { solid: demo.state.bgSolid, key: demo.state.bgKey,
        frozen: demo.state.bgFrozenLayers, shader: demo.shaderSpec };
      demo.state.typingDone = true;
      demo.advance();
      return { changed, continued, explicit, black: { solid: demo.state.bgSolid, frozen: demo.state.bgFrozenLayers } };
    })()`);
    assert.ok(earlyBackground.changed < 20 && earlyBackground.continued.layers?.length === 2 &&
      earlyBackground.continued.layers.every(layer => layer.alpha > 0.45 && layer.alpha < 0.55) &&
      earlyBackground.continued.shader === 'gray' && earlyBackground.continued.sameShaderClock,
    JSON.stringify(earlyBackground));
    assert.deepStrictEqual(earlyBackground.explicit, { solid: false, key: 'bg_station', frozen: null, shader: null });
    assert.deepStrictEqual(earlyBackground.black, { solid: true, frozen: null });
    const backgroundExit = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, story = ${JSON.stringify(earlyBackgroundCompiled.story)};
      delete story.lines[0].exit;
      story.lines[1].mode = 'sfx';
      demo.showStory(story);
      demo.state.lineStart = performance.now() - 3000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const atClick = demo.sampleBackgroundLayers(demo.state.stopStageAt);
      const duringExit = demo.sampleBackgroundLayers(demo.state.stopStageAt + 400);
      return { atClick, duringExit, transition: demo.state.transition };
    })()`);
    assert.strictEqual(backgroundExit.transition, 'modeExit');
    assert.deepStrictEqual(backgroundExit.duringExit, backgroundExit.atClick);
    await new Promise(resolve => setTimeout(resolve, 400));
    const backgroundExitAfter = await win.webContents.executeJavaScript('window.__demo.state.bgFrozenLayers');
    assert.deepStrictEqual(backgroundExitAfter, backgroundExit.atClick);
    const chainedBackground = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(earlyBackgroundFollowCompiled.story)});
      demo.state.lineStart = performance.now() - 3000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const frozen = demo.state.bgFrozenLayers;
      demo.dispatchLineEvents(demo.state.lineStart + 500);
      return { frozen, from: demo.state.bgTransition?.from, to: demo.state.bgTransition?.to };
    })()`);
    assert.deepStrictEqual(chainedBackground.from, chainedBackground.frozen);
    assert.strictEqual(chainedBackground.to.solid, true);
    const legacyBackground = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, story = ${JSON.stringify(earlyBackgroundCompiled.story)};
      delete story.lines[1].sceneOps;
      delete story.lines[1].shaderOps;
      demo.showStory(story);
      demo.state.lineStart = performance.now() - 3000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      return { line: demo.state.line, frozen: demo.state.bgFrozenLayers, shader: demo.shaderSpec };
    })()`);
    assert.deepStrictEqual(legacyBackground, { line: 1, frozen: null, shader: null });
    const branchContinuity = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const read = () => ({
        text: demo.STORY[demo.state.line]?.text,
        x: demo.state.stageBase.find(item => item.id === 'picture')?.x,
        ids: demo.state.stageBase.map(item => item.id).sort(),
        cameraX: demo.state.camera.x, cameraY: demo.state.camera.y,
        brightness: demo.state.sceneFx.brightness, saturation: demo.state.sceneFx.saturation,
        shader: demo.state.shader?.name || null, solid: demo.state.bgSolid,
      });
      const run = (route, choice) => {
        const story = ${JSON.stringify(branchContinuityCompiled.story)};
        for (const line of story.lines) if (line.mode === 'narration') line.exit = 'none';
        demo.showStory(story);
        demo.state.variables.route = route;
        demo.state.lineStart = performance.now() - 2000;
        demo.state.dialogueStartAt = demo.state.lineStart;
        demo.state.typingDone = true;
        demo.advance();
        const conditional = read();
        demo.state.typingDone = true;
        demo.advance();
        demo.chooseBranch(choice);
        const now = performance.now();
        demo.drawScene(now + 2000);
        demo.drawScene(now + 3000);
        const selected = read();
        demo.state.typingDone = true;
        demo.advance();
        return { conditional, selected, merged: read() };
      };
      return { left: run(false, 0), right: run(false, 1), yes: run(true, 0) };
    })()`);
    for (const result of Object.values(branchContinuity)) {
      assert.ok(result.conditional.text === '条件后' && Math.abs(result.conditional.x - 180) < 2 &&
        Math.abs(result.conditional.cameraX - 20) < 0.2 &&
        Math.abs(result.conditional.brightness - 0.9) < 0.002 &&
        result.conditional.shader === 'gray' && result.conditional.solid &&
        !result.conditional.ids.includes('late'), JSON.stringify(result));
      assert.ok(result.merged.text === '汇合' && Math.abs(result.merged.x - result.conditional.x) < 0.01 &&
        !result.merged.ids.includes('trap') && !result.merged.ids.includes('late'), JSON.stringify(result));
    }
    assert.ok(branchContinuity.left.conditional.saturation === 0.5 &&
      !branchContinuity.left.conditional.ids.includes('if_only') &&
      branchContinuity.left.selected.text === '左' && branchContinuity.left.merged.cameraX === 120 &&
      branchContinuity.left.merged.cameraY === 0 && branchContinuity.left.merged.shader === 'gray', JSON.stringify(branchContinuity.left));
    assert.ok(branchContinuity.right.selected.text === '右' && branchContinuity.right.merged.shader === null &&
      Math.abs(branchContinuity.right.merged.cameraX - 20) < 0.2 && branchContinuity.right.merged.cameraY === 0, JSON.stringify(branchContinuity.right));
    assert.ok(branchContinuity.yes.conditional.ids.includes('if_only') &&
      branchContinuity.yes.conditional.cameraY === 99 && branchContinuity.yes.conditional.saturation === 1 &&
      branchContinuity.yes.merged.cameraY === 99, JSON.stringify(branchContinuity.yes));
    const branchLoop = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.showStory(${JSON.stringify(loopContinuityCompiled.story)});
      const before = demo.state.variables.visit;
      demo.chooseBranch(0);
      const now = performance.now();
      demo.drawScene(now + 2000);
      demo.drawScene(now + 3000);
      return { before, after: demo.state.variables.visit, mode: demo.STORY[demo.state.line].mode };
    })()`);
    assert.deepStrictEqual(branchLoop, { before: 1, after: 2, mode: 'branch' });
    const transitionCarry = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, story = ${JSON.stringify(transitionContinuityCompiled.story)};
      story.lines[0].exit = 'none';
      demo.showStory(story);
      demo.state.lineStart = performance.now() - 2000;
      demo.state.dialogueStartAt = demo.state.lineStart;
      demo.state.typingDone = true;
      demo.advance();
      const read = () => ({ mode: demo.STORY[demo.state.line].mode,
        x: demo.state.stageBase.find(item => item.id === 'picture').x,
        camera: demo.state.camera.x, brightness: demo.state.sceneFx.brightness });
      const transition = read();
      demo.updateState(demo.state.lineStart + 250);
      return { transition, after: read() };
    })()`);
    assert.ok(transitionCarry.transition.mode === 'transition' && transitionCarry.after.mode === 'narration' &&
      Math.abs(transitionCarry.transition.x - 180) < 2 &&
      Math.abs(transitionCarry.transition.camera - 20) < 0.2 &&
      Math.abs(transitionCarry.transition.brightness - 0.9) < 0.002 &&
      Math.abs(transitionCarry.after.x - transitionCarry.transition.x) < 0.01 &&
      Math.abs(transitionCarry.after.camera - transitionCarry.transition.camera) < 0.01 &&
      Math.abs(transitionCarry.after.brightness - transitionCarry.transition.brightness) < 0.001, JSON.stringify(transitionCarry));
    const busyLoop = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, original = console.error;
      console.error = () => {};
      try {
        demo.showStory(${JSON.stringify(busyLoopCompiled.story)});
        return { frozen: demo.state.freeze, text: document.getElementById('runtimeError').textContent };
      } finally { console.error = original; }
    })()`);
    assert.ok(busyLoop.frozen && busyLoop.text.includes('没有等待的循环'), JSON.stringify(busyLoop));
    const audioControl = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, OriginalAudio = window.Audio;
      let plays = 0;
      window.Audio = class {
        constructor() { this.volume = 0; this.currentTime = 0; this.duration = 1; }
        addEventListener() {}
        play() { plays++; return Promise.resolve(); }
        pause() {}
      };
      try {
        return ${JSON.stringify(audioControlStories)}.map(story => {
          const before = plays;
          demo.showStory(story);
          return { count: plays - before, mode: demo.STORY[demo.state.line].mode };
        });
      } finally { window.Audio = OriginalAudio; }
    })()`);
    assert.deepStrictEqual(audioControl, [
      { count: 0, mode: 'narration' },
      { count: 1, mode: 'narration' },
      { count: 0, mode: 'narration' },
      { count: 1, mode: 'narration' },
    ]);
    const slowShaderCarry = await win.webContents.executeJavaScript(`(async () => {
      const demo = window.__demo, original = window.fetch, pending = [];
      const shader = 'precision mediump float; varying vec2 v_uv; uniform sampler2D u_texture; void main(){ gl_FragColor=texture2D(u_texture,v_uv); }';
      let calls = 0;
      window.fetch = (url, ...args) => {
        if (!String(url).includes('pending-test-')) return original(url, ...args);
        calls++;
        return new Promise(resolve => pending.push(() => resolve({ ok: true, text: async () => shader })));
      };
      try {
        const story = ${JSON.stringify(slowShaderCarryCompiled.story)};
        story.lines[0].shader = { name: 'custom', url: 'assets/shaders/pending-test-1.frag', intensity: 1 };
        demo.showStory(story);
        demo.state.typingDone = true;
        demo.advance();
        pending.shift()();
        await new Promise(resolve => setTimeout(resolve, 100));
        const carried = { line: demo.state.line, shader: demo.shaderSpec?.name, calls };
        story.lines[0].shader = { name: 'custom', url: 'assets/shaders/pending-test-2.frag', intensity: 1 };
        demo.showStory(story);
        demo.state.typingDone = true;
        demo.advance();
        demo.state.typingDone = true;
        demo.advance();
        pending.shift()();
        await new Promise(resolve => setTimeout(resolve, 100));
        return { carried, cancelled: { line: demo.state.line, shader: demo.shaderSpec, calls } };
      } finally {
        window.fetch = original;
      }
    })()`);
    assert.deepStrictEqual(slowShaderCarry, {
      carried: { line: 1, shader: 'custom', calls: 1 },
      cancelled: { line: 2, shader: null, calls: 2 },
    });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/parallel-oneshot.json`);
    const oneShotDeadline = Date.now() + 20000;
    while (Date.now() < oneShotDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY?.[0]?.events?.some(event => event.type === "oneshot"))')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const oneShotReady = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.dispatchLineEvents(start + 199);
      const before = demo.state.parallelOneShots.size;
      demo.dispatchLineEvents(start + 200);
      return { before, line: demo.state.line, eventIndex: demo.state.lineEventIndex };
    })()`);
    assert.deepStrictEqual(oneShotReady, { before: 0, line: 0, eventIndex: 1 });
    const oneShotLoadedDeadline = Date.now() + 20000;
    let oneShotLoaded = null;
    while (Date.now() < oneShotLoadedDeadline) {
      oneShotLoaded = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        const shot = [...demo.state.parallelOneShots.values()][0];
        if (!shot) return null;
        demo.drawScene(shot.start + 450);
      const canvas = document.getElementById('view'), context = canvas.getContext('2d');
      const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.drawScene(shot.start + 700);
      const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 30) changed++;
        return {
          count: demo.state.parallelOneShots.size,
          x: shot.skeleton.x,
          y: shot.skeleton.y,
          alpha: shot.skeleton.color?.a ?? 0,
          scale: shot.skeleton.scaleX,
          duration: shot.duration,
          start: shot.start,
          changed,
          readyAt: demo.state.readyAt,
        };
      })()`);
      if (oneShotLoaded) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(oneShotLoaded && oneShotLoaded.count === 1, JSON.stringify(oneShotLoaded));
    assert.ok(Math.abs(oneShotLoaded.scale) > 1.1 && Math.abs(oneShotLoaded.scale) < 1.3, JSON.stringify(oneShotLoaded));
    assert.ok(Math.abs(oneShotLoaded.alpha - 0.8) < 0.01, JSON.stringify(oneShotLoaded));
    assert.ok(oneShotLoaded.changed > 10, JSON.stringify(oneShotLoaded));
    assert.ok(oneShotLoaded.readyAt >= oneShotLoaded.start + (oneShotLoaded.duration + 0.2) * 1000, JSON.stringify(oneShotLoaded));
    const oneShotEnded = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.drawScene(${oneShotLoaded.start + oneShotLoaded.duration * 1000 + 300});
      return { count: demo.state.parallelOneShots.size, line: demo.state.line };
    })()`);
    assert.deepStrictEqual(oneShotEnded, { count: 0, line: 0 });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-project/&storyUrl=/standalone-oneshot.json`);
    const standaloneDeadline = Date.now() + 20000;
    while (Date.now() < standaloneDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[0]?.mode === "oneshot")')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const waitingForShot = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const before = { loaded: Boolean(demo.state.oneShot), readyAt: demo.state.readyAt };
      demo.updateState(demo.state.lineStart + 2000);
      return { ...before, line: demo.state.line, ended: demo.state.endShown };
    })()`);
    assert.deepStrictEqual(waitingForShot, { loaded: false, readyAt: Number.MAX_SAFE_INTEGER, line: 0, ended: false });
    let standaloneShot = null;
    while (Date.now() < standaloneDeadline) {
      standaloneShot = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo, shot = demo.state.oneShot;
        return shot ? { clip: shot.clip.name, readyAt: demo.state.readyAt, start: shot.start, duration: shot.duration } : null;
      })()`);
      if (standaloneShot) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(standaloneShot && standaloneShot.clip === 'Idea' &&
      standaloneShot.readyAt >= standaloneShot.start + standaloneShot.duration * 1000, JSON.stringify(standaloneShot));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-project/&storyUrl=/pending-actor.json`);
    const pendingDeadline = Date.now() + 20000;
    while (Date.now() < pendingDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[0]?.events?.some(e => e.action === "hide"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const pendingHidden = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, start = demo.state.lineStart;
      const before = demo.state.pendingStageEvents.length;
      demo.dispatchLineEvents(start + 500);
      return { before, after: demo.state.pendingStageEvents.length, present: demo.stageActors.has('erpin') };
    })()`);
    assert.deepStrictEqual(pendingHidden, { before: 1, after: 0, present: false });
    while (Date.now() < pendingDeadline && !await win.webContents.executeJavaScript('window.__demo.spineActors.has("erpin")')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const afterHiddenLoad = await win.webContents.executeJavaScript(`({
      loaded: window.__demo.spineActors.has('erpin'),
      present: window.__demo.stageActors.has('erpin'),
      pending: window.__demo.state.pendingStageEvents.length
    })`);
    assert.deepStrictEqual(afterHiddenLoad, { loaded: true, present: false, pending: 0 });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-project/&storyUrl=/pending-appearance.json`);
    const appearanceDeadline = Date.now() + 20000;
    while (Date.now() < appearanceDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[0]?.events?.some(e => e.type === "actor"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const appearanceBefore = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.dispatchLineEvents(demo.state.lineStart + 200);
      return { pending: demo.state.pendingStageEvents.length, override: demo.state.lineActorOverrides.get('erpin')?.anim };
    })()`);
    assert.deepStrictEqual(appearanceBefore, { pending: 1, override: 'Happy_1' });
    while (Date.now() < appearanceDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.stageActors.has("erpin"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const appearanceAfter = await win.webContents.executeJavaScript(`({
      present: window.__demo.stageActors.has('erpin'),
      anim: window.__demo.spineActors.get('erpin')?.current
    })`);
    assert.deepStrictEqual(appearanceAfter, { present: true, anim: 'Happy_1' });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-project/&storyUrl=/pending-initial-hidden.json`);
    const initialHiddenDeadline = Date.now() + 20000;
    while (Date.now() < initialHiddenDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.STORY[0]?.events?.some(e => e.action === "hide"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await win.webContents.executeJavaScript('window.__demo.dispatchLineEvents(window.__demo.state.lineStart + 500)');
    while (Date.now() < initialHiddenDeadline && !await win.webContents.executeJavaScript('window.__demo.spineActors.has("erpin")')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const initialHiddenAfterLoad = await win.webContents.executeJavaScript(`({
      loaded: window.__demo.spineActors.has('erpin'),
      present: window.__demo.stageActors.has('erpin')
    })`);
    assert.deepStrictEqual(initialHiddenAfterLoad, { loaded: true, present: false });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/slow-project/&storyUrl=/ui-slow-spine-parent.json`);
    const uiSpineDeadline = Date.now() + 20000;
    while (Date.now() < uiSpineDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("card"))')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const beforeUiSpineLoad = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      return { loaded: demo.spineActors.has('ner'), present: demo.stageActors.has('ner'),
        visible: demo.uiWorldTransforms().get('card').visible };
    })()`);
    assert.deepStrictEqual(beforeUiSpineLoad, { loaded: false, present: false, visible: false });
    while (Date.now() < uiSpineDeadline && !await win.webContents.executeJavaScript('window.__demo.stageActors.has("ner")')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const afterUiSpineLoad = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, parent = demo.stageActors.get('ner');
      if (!parent) return null;
      parent.alpha = 1;
      const card = demo.uiWorldTransforms().get('card');
      return { visible: card.visible, alpha: card.alpha, x: card.matrix[4], parentX: parent.x, parentScaleX: parent.sx };
    })()`);
    assert.ok(afterUiSpineLoad?.visible && afterUiSpineLoad.alpha === 1 &&
      Math.abs(afterUiSpineLoad.x - (afterUiSpineLoad.parentX + 100 * afterUiSpineLoad.parentScaleX)) < 0.01,
      JSON.stringify(afterUiSpineLoad));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/camera-motion.json`);
    const cameraDeadline = Date.now() + 20000;
    let motion = null;
    while (Date.now() < cameraDeadline) {
      motion = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        if (!demo?.state.started || !demo.stageImages.has('picture')) return null;
        demo.startLine(0);
        const start = demo.state.lineStart;
        const image = demo.stageImages.get('picture');
        image.alpha = image.targetAlpha = 1;
        const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
        demo.drawScene(start + 500);
        const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const first = [demo.state.camera.zoom, demo.state.camera.x];
        demo.drawScene(start + 1250);
        const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const middle = [demo.state.camera.zoom, demo.state.camera.x, demo.state.camera.y];
        let changed = 0;
        for (let i = 0; i < before.length; i += 4)
          if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 30) changed++;
        demo.drawScene(start + 1750);
        const late = [demo.state.camera.zoom, demo.state.camera.x];
        demo.seek(0, 1.25);
        demo.drawScene(performance.now());
        const preview = [demo.state.camera.zoom, demo.state.camera.x, demo.state.camera.y];
        demo.seek(0, 0, { replay: true });
        demo.advance();
        demo.advance();
        const skipped = [demo.state.line, demo.state.camera.zoom, demo.state.camera.x, demo.state.camera.y];
        return { first, middle, late, preview, skipped, changed };
      })()`);
      if (motion?.changed > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(motion && motion.changed > 100, JSON.stringify(motion));
    assert.deepStrictEqual(motion.first, [1.25, 25]);
    assert.deepStrictEqual(motion.middle, [1.625, 62.5, -30]);
    assert.deepStrictEqual(motion.late, [1.875, 10]);
    assert.deepStrictEqual(motion.preview, [1.625, 62.5, -30]);
    assert.ok(motion.skipped[0] === 1 && Math.abs(motion.skipped[1] - 1) < 0.01 &&
      Math.abs(motion.skipped[2]) < 0.5 && motion.skipped[3] === 0, JSON.stringify(motion.skipped));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&storyUrl=/typing.json`);
    const typingDeadline = Date.now() + 20000;
    while (Date.now() < typingDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const typing = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.typingStart;
      const mode = demo.modeRuntime.normal;
      const times = demo.state.typingPlan.times.slice();
      const counts = [];
      for (const elapsed of [49, 50, 299, 300, 325, 749, 750, 800]) {
        demo.updateState(start + elapsed);
        counts.push(mode.reveal);
      }
      demo.seek(0, 0, { replay: true });
      demo.updateState(demo.state.typingStart + 100);
      const beforeClick = mode.reveal;
      demo.advance();
      demo.updateState(performance.now());
      const afterClick = { reveal: mode.reveal, done: demo.state.typingDone };
      demo.startLine(1);
      const nextTimes = demo.state.typingPlan.times.slice();
      return { times, counts, beforeClick, afterClick, nextTimes };
    })()`);
    assert.deepStrictEqual(typing.times, [0, 50, 300, 325, 750, 800]);
    assert.deepStrictEqual(typing.counts, [1, 2, 2, 3, 4, 4, 5, 6]);
    assert.strictEqual(typing.beforeClick, 2);
    assert.deepStrictEqual(typing.afterClick, { reveal: 6, done: true });
    assert.strictEqual(typing.nextTimes[1], 200);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/scene-timeline.json`);
    const sceneDeadline = Date.now() + 20000;
    while (Date.now() < sceneDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const sceneTimeline = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.startLine(0);
      const start = demo.state.lineStart;
      const ratio = canvas.width / 1920;
      const sampleBackground = time => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        demo.drawBackground(time);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const samples = [];
        for (let y = 100; y < 1080; y += 100) {
          for (let x = 100; x < 1920; x += 100) {
            const offset = (Math.round(y * ratio) * canvas.width + Math.round(x * ratio)) * 4;
            samples.push(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
          }
        }
        ctx.restore();
        return samples;
      };
      demo.dispatchLineEvents(start + 499);
      demo.drawScene(start + 499);
      const startSamples = sampleBackground(start + 499);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const early = [demo.state.bgSolid, demo.state.sceneFx.brightness];
      demo.dispatchLineEvents(start + 500);
      const transition = demo.state.bgTransition && { duration: demo.state.bgTransition.duration, ease: demo.state.bgTransition.ease };
      demo.drawScene(start + 500);
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const middleSamples = sampleBackground(start + 750);
      demo.drawScene(start + 750);
      const midFadePixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const endSamples = sampleBackground(start + 1000);
      let blendError = 0, blendSamples = 0, opaqueSamples = 0;
      for (let i = 0; i < endSamples.length; i += 4) {
        if (endSamples[i] + endSamples[i + 1] + endSamples[i + 2] < 90) continue;
        blendError += Math.abs(middleSamples[i] - (startSamples[i] + endSamples[i]) / 2) +
          Math.abs(middleSamples[i + 1] - (startSamples[i + 1] + endSamples[i + 1]) / 2) +
          Math.abs(middleSamples[i + 2] - (startSamples[i + 2] + endSamples[i + 2]) / 2);
        blendSamples++;
        if (middleSamples[i + 3] === 255) opaqueSamples++;
      }
      blendError /= Math.max(1, blendSamples * 3);
      const releasedBuffers = demo.backgroundBufferSize;
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 40) changed++;
      let fadeChanged = 0;
      for (let i = 0; i < after.length; i += 4)
        if (Math.abs(after[i] - midFadePixels[i]) + Math.abs(after[i+1] - midFadePixels[i+1]) + Math.abs(after[i+2] - midFadePixels[i+2]) > 30) fadeChanged++;
      const middle = [demo.state.bgSolid, demo.state.bgKey, demo.state.sceneFx.brightness, demo.state.sceneFx.tintAlpha];
      demo.startLine(0);
      const fadeOutStart = demo.state.lineStart;
      demo.dispatchLineEvents(fadeOutStart + 500);
      demo.dispatchLineEvents(fadeOutStart + 800);
      demo.drawScene(fadeOutStart + 800);
      const beforeFadeOut = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      demo.drawScene(fadeOutStart + 1050);
      const midFadeOut = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let fadeOutChanged = 0;
      for (let i = 0; i < beforeFadeOut.length; i += 4)
        if (Math.abs(beforeFadeOut[i] - midFadeOut[i]) + Math.abs(beforeFadeOut[i+1] - midFadeOut[i+1]) + Math.abs(beforeFadeOut[i+2] - midFadeOut[i+2]) > 30) fadeOutChanged++;
      demo.seek(0, 0, { replay: true });
      const replay = [demo.state.bgSolid, demo.state.sceneFx.brightness];
      demo.seek(0, 0.6);
      const preview = [demo.state.bgSolid, demo.state.sceneFx.brightness, demo.state.freeze];
      demo.seek(0, 0, { replay: true });
      demo.advance();
      demo.advance();
      return { early, middle, transition, replay, preview, next: [demo.state.line, demo.state.bgSolid, demo.state.sceneFx.brightness],
        changed, fadeChanged, fadeOutChanged, blendError, blendSamples, opaqueSamples, releasedBuffers };
    })()`);
    assert.deepStrictEqual(sceneTimeline.early, [true, 1]);
    assert.deepStrictEqual(sceneTimeline.middle, [false, 'bg_background', 0.4, 0]);
    assert.deepStrictEqual(sceneTimeline.transition, { duration: 500, ease: 'Linear' });
    assert.deepStrictEqual(sceneTimeline.replay, [true, 1]);
    assert.deepStrictEqual(sceneTimeline.preview, [false, 0.4, true]);
    assert.deepStrictEqual(sceneTimeline.next, [1, true, 1]);
    assert.ok(sceneTimeline.changed > 100, JSON.stringify(sceneTimeline));
    assert.ok(sceneTimeline.fadeChanged > 100 && sceneTimeline.fadeOutChanged > 100, JSON.stringify(sceneTimeline));
    assert.ok(sceneTimeline.blendSamples > 20 && sceneTimeline.blendError < 12 &&
      sceneTimeline.opaqueSamples === sceneTimeline.blendSamples, JSON.stringify(sceneTimeline));
    assert.deepStrictEqual(sceneTimeline.releasedBuffers, [1, 1, 1, 1]);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/effect-motion.json`);
    const effectDeadline = Date.now() + 20000;
    while (Date.now() < effectDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const effectMotion = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo, canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
      demo.startLine(0);
      const start = demo.state.lineStart;
      demo.drawScene(start + 500);
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const first = [demo.state.sceneFx.brightness, demo.state.sceneFx.tintAlpha, demo.state.sceneFx.saturation];
      demo.drawScene(start + 1250);
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const middle = [demo.state.sceneFx.brightness, demo.state.sceneFx.tintAlpha, demo.state.sceneFx.saturation];
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 30) changed++;
      demo.seek(0, 1.25);
      demo.drawScene(performance.now());
      const preview = [demo.state.sceneFx.brightness, demo.state.sceneFx.tintAlpha, demo.state.sceneFx.saturation, demo.state.freeze];
      demo.seek(0, 0, { replay: true });
      demo.advance();
      demo.advance();
      return { first, middle, preview, next: [demo.state.line, demo.state.sceneFx.brightness, demo.state.sceneFx.tintAlpha, demo.state.sceneFx.saturation], changed };
    })()`);
    for (const [actual, expected] of [[effectMotion.first, [0.325, 0.25, 1]], [effectMotion.middle, [0.6625, 0.625, 0.75]], [effectMotion.preview.slice(0, 3), [0.6625, 0.625, 0.75]]]) {
      assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 1e-6), JSON.stringify(effectMotion));
    }
    assert.strictEqual(effectMotion.preview[3], true);
    assert.ok(effectMotion.next[0] === 1 && Math.abs(effectMotion.next[1] - 0.1) < 0.01 &&
      effectMotion.next[2] < 0.01 && effectMotion.next[3] === 1, JSON.stringify(effectMotion.next));
    assert.ok(effectMotion.changed > 100, JSON.stringify(effectMotion));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/shader-timeline.json`);
    const shaderDeadline = Date.now() + 20000;
    while (Date.now() < shaderDeadline && !await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started)')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const shaderTimeline = await win.webContents.executeJavaScript(`(() => {
      const demo = window.__demo;
      demo.startLine(0);
      const start = demo.state.lineStart;
      const immediate = demo.shaderSpec && { name: demo.shaderSpec.name, intensity: demo.shaderSpec.intensity };
      demo.dispatchLineEvents(start + 499);
      const beforeReset = Boolean(demo.shaderSpec);
      demo.dispatchLineEvents(start + 500);
      return { immediate, beforeReset, afterReset: demo.shaderSpec };
    })()`);
    assert.deepStrictEqual(shaderTimeline.immediate, { name: 'heat', intensity: 0.35 });
    assert.strictEqual(shaderTimeline.beforeReset, true);
    assert.strictEqual(shaderTimeline.afterReset, null);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/shader-failure.json`);
    const shaderWarningDeadline = Date.now() + 20000;
    let shaderWarning = null;
    while (Date.now() < shaderWarningDeadline) {
      shaderWarning = await win.webContents.executeJavaScript(`(() => {
        const el = document.getElementById('runtimeError');
        return el && !el.hidden ? { text: el.textContent, warning: el.classList.contains('warning'), line: window.__demo?.state.line } : null;
      })()`);
      if (shaderWarning) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(shaderWarning?.warning && shaderWarning.text.includes('加载失败'), JSON.stringify(shaderWarning));
    assert.strictEqual(shaderWarning.line, 0);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&editorPreview=1&autoStart=1&assetRoot=/project/&storyUrl=/animation.json`);
    let previewReady = false;
    const previewDeadline = Date.now() + 20000;
    while (Date.now() < previewDeadline) {
      previewReady = await win.webContents.executeJavaScript('Boolean(window.__demo?.state.started && window.__demo.uiObjects.has("thought_frame"))');
      if (previewReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(previewReady, 'Scaled preview did not load');
    const scaledPreview = await win.webContents.executeJavaScript(`(() => {
      window.__demo.drawScene(performance.now() + 1000);
      const canvas = document.getElementById('view');
      const fx = document.getElementById('fxView');
      const rect = canvas.getBoundingClientRect();
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i+1] + pixels[i+2] > 160) bright++;
      return { width: canvas.width, height: canvas.height, cssWidth: rect.width, dpr: devicePixelRatio,
        fxWidth: fx.width, fxHeight: fx.height, bright };
    })()`);
    assert.ok(scaledPreview.width < 1920 && scaledPreview.width >= Math.min(1920, scaledPreview.cssWidth * scaledPreview.dpr) - 2, JSON.stringify(scaledPreview));
    assert.strictEqual(scaledPreview.fxWidth, scaledPreview.width);
    assert.strictEqual(scaledPreview.fxHeight, scaledPreview.height);
    assert.ok(scaledPreview.bright > 100, JSON.stringify(scaledPreview));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&editorPreview=1&autoStart=1&assetRoot=/project/`);
    let scaledSpine = null;
    const spineDeadline = Date.now() + 20000;
    while (Date.now() < spineDeadline) {
      scaledSpine = await win.webContents.executeJavaScript(`(() => {
        const demo = window.__demo;
        const canvas = document.getElementById('view');
        if (!demo?.spineCanvas || !demo.stageActors.has('hero')) return null;
        const gl = demo.spineCanvas.getContext('webgl');
        const pixels = new Uint8Array(demo.spineCanvas.width * demo.spineCanvas.height * 4);
        gl.readPixels(0, 0, demo.spineCanvas.width, demo.spineCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let opaque = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 20) opaque++;
        return { width: canvas.width, height: canvas.height, spineWidth: demo.spineCanvas.width,
          spineHeight: demo.spineCanvas.height, opaque };
      })()`);
      if (scaledSpine?.opaque > 100) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(scaledSpine?.opaque > 100, JSON.stringify(scaledSpine));
    assert.strictEqual(scaledSpine.spineWidth, scaledSpine.width);
    assert.strictEqual(scaledSpine.spineHeight, scaledSpine.height);
    win.setContentSize(800, 600);
    await new Promise(resolve => setTimeout(resolve, 400));
    const resizedSpine = await win.webContents.executeJavaScript(`(() => {
      const canvas = document.getElementById('view');
      const spine = window.__demo.spineCanvas;
      const gl = spine.getContext('webgl');
      const pixels = new Uint8Array(spine.width * spine.height * 4);
      gl.readPixels(0, 0, spine.width, spine.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 20) opaque++;
      return { width: canvas.width, height: canvas.height, spineWidth: spine.width, spineHeight: spine.height, opaque };
    })()`);
    assert.ok(resizedSpine.width < scaledSpine.width && resizedSpine.opaque > 100, JSON.stringify(resizedSpine));
    assert.strictEqual(resizedSpine.spineWidth, resizedSpine.width);
    assert.strictEqual(resizedSpine.spineHeight, resizedSpine.height);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html?embed=1&autoStart=1&assetRoot=/project/&storyUrl=/bad.json`);
    let failure;
    const errorDeadline = Date.now() + 20000;
    while (Date.now() < errorDeadline) {
      failure = await win.webContents.executeJavaScript(`(() => {
        const el = document.getElementById('runtimeError');
        return el && !el.hidden ? el.textContent : null;
      })()`);
      if (failure) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(failure && failure.includes('第 1 行') && failure.includes('missing'), String(failure));
    console.log('ui-runtime.electron.js: ok');
  } catch (error) {
    console.error(error, { rendererErrors: errors });
    failed = true;
  } finally {
    server.close();
    if (win) win.destroy();
    app.exit(failed ? 1 : 0);
  }
}).catch(error => { console.error(error); app.exit(1); });

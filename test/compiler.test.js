'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compile } = require('../compiler/trickcal');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'templates', 'minimal-demo');
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'trickcal.project.json'), 'utf8'));
const source = fs.readFileSync(path.join(project, manifest.entry), 'utf8');
const presets = fs.readdirSync(path.join(project, 'presets')).filter(f => f.endsWith('.json')).map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(project, 'presets', f), 'utf8')) }));
const result = compile(source, { ...manifest, projectRoot: project, presets, title: manifest.title, openingTitle: manifest.openingTitle });
const activeProject = path.join(root, 'projects', '雨夜的末班车');
const activeManifest = JSON.parse(fs.readFileSync(path.join(activeProject, 'trickcal.project.json'), 'utf8'));
const activePresets = fs.readdirSync(path.join(activeProject, 'presets')).filter(f => f.endsWith('.json')).map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(activeProject, 'presets', f), 'utf8')) }));
const activeSource = fs.readFileSync(path.join(activeProject, activeManifest.entry), 'utf8');
const activeResult = compile(activeSource, { ...activeManifest, projectRoot: activeProject, presets: activePresets });
assert.deepStrictEqual(activeResult.diagnostics.filter(d => d.severity === 'error'), []);
assert.strictEqual(activeResult.story.lines.find(line => line.mode === 'manga')?.tail, 'tr');
assert.strictEqual(result.diagnostics.filter(d => d.severity === 'error').length, 0, JSON.stringify(result.diagnostics));
assert.ok(result.story.lines.length > 20);
assert.strictEqual(result.story.lines[0].mode, 'title');
assert.strictEqual(result.story.lines[0].chapterNo, Number((source.match(/^opening\s+(\d+)/m) || [0, 1])[1]));
assert.strictEqual(result.story.lines[0].hold, 0);
assert.deepStrictEqual(result.story.variables, { saw_signal: false });
assert.ok(result.story.lines.some(line => line.mode === 'condition'));
assert.ok(result.story.lines.some(line => line.mode === 'set' && line.variable === 'saw_signal'));
const openingFixture = compile('image station = "assets/bg/elf_city_night.png"\nopening 1 "测试" hold 0 cinema on bg station', { projectRoot: project });
assert.strictEqual(openingFixture.story.lines[0].bg, 'bg_station');
assert.ok(openingFixture.story.lines[0].bgUrl, 'opening bg must resolve to a project background');
const openingPresets = compile([
  'preset 章节开场·无电影边框 uiScale 0.8 uiX 40',
  'opening 1 "开场" hold 0',
  'preset 章节开场 cinema false',
  'opening 2 "覆盖" hold 0 cinema on',
  'preset 地点标识 uiY -20 uiOpacity 0.5',
  'location "车站" hold 0',
  'location "下一处" hold 0',
].join('\n'), { presets });
assert.deepStrictEqual(openingPresets.diagnostics, []);
assert.deepStrictEqual([openingPresets.story.lines[0].preset, openingPresets.story.lines[0].cinema, openingPresets.story.lines[0].uiScale, openingPresets.story.lines[0].uiX], ['章节开场·无电影边框', false, 0.8, 40]);
assert.strictEqual(openingPresets.story.lines[1].cinema, true, 'explicit opening flags override the preset');
assert.deepStrictEqual([openingPresets.story.lines[2].preset, openingPresets.story.lines[2].uiY, openingPresets.story.lines[2].uiOpacity], ['地点标识', -20, 0.5]);
assert.strictEqual(openingPresets.story.lines[3].preset, undefined);
for (const statement of [
  'preset 章节开场 cinema bad\nopening 1 "错误" hold 0',
  'preset 章节开场 fontSize 70\nopening 1 "错误" hold 0',
  'preset 地点标识 cinema false\nlocation "错误" hold 0',
  'preset 章节开场\nner normal "错误"',
  'preset 地点标识\nner normal "错误"',
  'preset 普通对话框 cinema false\nner normal "错误"',
]) assert.ok(compile(statement, { presets }).diagnostics.some(item => item.severity === 'error'), statement);
const transitions = compile([
  'preset 转场·圆形 hold 0.8',
  'transition',
  'preset 转场·黑场 kind colorbars hold 1',
  'transition rightpush hold 1.2',
  'transition fadeinwhite hold 2',
  'narration "完成"',
].join('\n'), { presets });
assert.deepStrictEqual(transitions.diagnostics, []);
assert.deepStrictEqual(transitions.story.lines.slice(0, 3).map(line => [line.kind, line.hold, line.preset]), [
  ['circle', 0.8, '转场·圆形'], ['rightpush', 1.2, '转场·黑场'], ['fadeinwhite', 2, undefined],
]);
assert.strictEqual(transitions.story.lines[3].preset, undefined);
for (const statement of [
  'transition missing', 'transition circle hold 0', 'transition hold -1',
  'transition circle hold 0.1', 'transition circle hold 1..2',
  'preset 转场·黑场 hold 0.1\ntransition',
  'preset 转场·黑场 kind missing\ntransition',
  'preset 转场·黑场 uiX 1\ntransition',
  'preset 转场·黑场\nner normal "错误"',
  'preset 普通对话框\ntransition',
]) assert.ok(compile(statement, { presets }).diagnostics.some(item => item.severity === 'error'), statement);
const newsPresets = compile([
  'preset 新闻框·主播 fontSize 68 textColor "#ff0000" shadowX -20 shadowY 30 shadowAlpha 0.5',
  'news anchor "主播内容"',
  'preset 新闻框·简报 uiX 30',
  'parallel:',
  '  after 500ms:',
  '    news summary "简报内容"',
  'preset 全屏文字 fontSize 72 textOffsetX 40',
  'fullscreen "全屏内容"',
  'news summary "不继承"',
  'preset 普通打字机 speed 0.1',
  'fullscreen "打字机预设"',
].join('\n'), { presets });
assert.deepStrictEqual(newsPresets.diagnostics, []);
assert.deepStrictEqual([newsPresets.story.lines[0].mode, newsPresets.story.lines[0].speakerName,
  newsPresets.story.lines[0].fontSize, newsPresets.story.lines[0].shadowX, newsPresets.story.lines[0].shadowY],
['newsTalk', '新闻主播', 68, -20, 30]);
assert.deepStrictEqual([newsPresets.story.lines[1].mode, newsPresets.story.lines[1].uiX, newsPresets.story.lines[1].dialogueDelay], ['newsSummary', 30, 0.5]);
assert.deepStrictEqual([newsPresets.story.lines[2].mode, newsPresets.story.lines[2].fontSize, newsPresets.story.lines[2].textOffsetX], ['fullscreen', 72, 40]);
assert.strictEqual(newsPresets.story.lines[3].preset, undefined);
assert.strictEqual(newsPresets.story.lines[4].speed, 0.1);
const newsEntryDuration = compile([
  'preset 新闻框·主播 entryDuration 1',
  'news anchor "慢速入场"',
  'preset 新闻框·主播',
  'news anchor "默认入场"',
  'parallel:',
  '  after 250ms:',
  '    preset 新闻框·简报 entryDuration 0.25',
  '    news summary "延时入场"',
].join('\n'), { presets });
assert.deepStrictEqual(newsEntryDuration.diagnostics, []);
assert.deepStrictEqual(newsEntryDuration.story.lines.map(line => [line.entryDuration, line.dialogueDelay]), [
  [1, undefined], [undefined, undefined], [0.25, 0.25],
]);
assert.strictEqual(presets.find(preset => preset.name === '新闻框·主播').fields.entryDuration, undefined);
const timedFullscreen = compile('parallel:\n  after 250ms:\n    preset 全屏文字 fontSize 70\n    fullscreen "延时"\n  wait 1s', { presets });
assert.deepStrictEqual(timedFullscreen.diagnostics, []);
assert.deepStrictEqual([timedFullscreen.story.lines[0].mode, timedFullscreen.story.lines[0].fontSize, timedFullscreen.story.lines[0].dialogueDelay], ['fullscreen', 70, 0.25]);
const nestedAfter = compile([
  'show erpin at 100,200',
  'parallel:',
  '  after 200ms:',
  '    show erpin at 2000,800',
  '    after 400ms:',
  '      after 100ms:',
  '        move erpin x 2000 -> 960 in 2s',
  '        camera x -220 -> 0 in 2s',
  '  after 800ms:',
  '    erpin normal "测试"',
  '    after 500ms:',
  '      anim erpin Happy_2 fade 0.25',
  '    after 700ms:',
  '      anim erpin Happy_5 fade 0.25',
].join('\n'));
assert.deepStrictEqual(nestedAfter.diagnostics, []);
assert.deepStrictEqual(nestedAfter.story.lines[0].events.map(event => [event.type, event.delay]), [
  ['stage', 0.2], ['actor', 1.3], ['actor', 1.5],
]);
assert.ok(Math.abs(nestedAfter.story.lines[0].actions[0].delay - 0.7) < 1e-9);
assert.ok(Math.abs(nestedAfter.story.lines[0].cameraTracks[0].delay - 0.7) < 1e-9);
const unindentedAfter = compile([
  'show erpin at 100,200',
  'parallel:',
  '  after 200ms:',
  '    after 200ms:',
  '    move erpin x 0 -> 100 in 1s',
  '  wait 1s',
].join('\n'));
assert.ok(unindentedAfter.diagnostics.some(d => d.line === 4 && d.message.includes('after 延时块不能为空')));
for (const statement of [
  'preset 新闻框·主播 shadowAlpha 2\nnews anchor "错误"',
  'preset 全屏文字 shadowX 10\nfullscreen "错误"',
  'preset 新闻框·主播\nner normal "错误"',
  'preset 全屏文字\nnews anchor "错误"',
  'preset 新闻框·主播\nfullscreen "错误"',
  'preset 新闻框·主播 entryDuration 0\nnews anchor "错误"',
  'preset 新闻框·主播 entryDuration -1\nnews anchor "错误"',
  'preset 新闻框·主播 entryDuration nope\nnews anchor "错误"',
  'preset 全屏文字 entryDuration 1\nfullscreen "错误"',
  'preset 漫画对话气泡 entryDuration 1\nner manga "错误"',
  'parallel:\n  news anchor "第一句"\n  fullscreen "第二句"',
]) assert.ok(compile(statement, { presets }).diagnostics.some(item => item.severity === 'error'), statement);
assert.ok(compile('preset 新闻框·主播\nnews anchor "错误"', {
  presets: [{ name: '新闻框·主播', type: 'news', fields: { entryDuration: -1 } }],
}).diagnostics.some(item => item.severity === 'error'));
const locationLine = result.story.lines.find(l => l.mode === 'location');
assert.ok(locationLine && locationLine.hold === 0);
assert.ok(result.story.lines.some(l => l.mode === 'branch' && l.options.every(o => Number.isInteger(o.next))));
assert.ok(result.story.lines.some(l => Array.isArray(l.actions) && l.actions.length));
assert.ok(result.story.lines.some(line => line.mode === 'manga' && line.dialogueDelay === 0.2 &&
  line.actions?.some(action => action.actor === 'erpin' && action.property === 'x')),
  'tutorial must demonstrate a delayed line alongside movement');
assert.ok(source.includes('show image hall as hall_card'));
assert.ok(source.includes('bind hall_card to erpin offset 220,-360'));
assert.ok(result.story.lines.some(line => line.events?.some(event => event.type === 'bind' && event.action === 'unbind')));
assert.ok(result.story.lines.some(line => line.events?.some(event => event.type === 'scene' && event.scene.transition?.duration === 0.3)),
  'tutorial must demonstrate a timed background crossfade');
assert.deepStrictEqual(result.story.spines.ner, { dir: 'assets/spine/standing/ner/', file: 'Ner' });
assert.ok(result.story.lines.some(l => l.mode === 'manga' && l.purple && l.preset === '紫色内心气泡'));
assert.ok(result.story.lines.some(l => l.mode === 'clear' && l.purple && l.preset === '紫色内心独白框'));
for (const [preset, mode] of [['旁白框', 'narration'], ['拟声框', 'sfx'], ['动画字幕', 'anime']]) {
  assert.ok(result.story.lines.some(line => line.mode === mode && line.preset === preset), `tutorial is missing ${preset}`);
}
const specialPresets = compile([
  'preset 旁白框 fontSize 70 textColor "#ff0000"',
  'narration "第一句"',
  'ner normal "预设不应泄漏"',
  'preset 拟声框 shadowX -20 shadowY 40 shadowColor "#663399" shadowAlpha 0.5',
  'sfx "砰！" at 800,400',
  'ner normal "继续"',
  'preset 动画字幕 fontSize 65',
  'ner anime "字幕"',
].join('\n'), { presets });
assert.deepStrictEqual(specialPresets.diagnostics, []);
assert.deepStrictEqual([specialPresets.story.lines[0].mode, specialPresets.story.lines[0].fontSize, specialPresets.story.lines[0].textColor], ['narration', 70, '#ff0000']);
assert.strictEqual(specialPresets.story.lines[1].preset, undefined);
assert.deepStrictEqual(specialPresets.story.lines[2].sfx, { x: 800, y: 400 });
assert.deepStrictEqual(['shadowX', 'shadowY', 'shadowColor', 'shadowAlpha'].map(key => specialPresets.story.lines[2][key]), [-20, 40, '#663399', 0.5]);
assert.strictEqual(specialPresets.story.lines[3].preset, undefined);
assert.strictEqual(specialPresets.story.lines[4].fontSize, 65);
for (const [preset, mode, variant] of [
  ['普通对话框·无名字', 'normal', 'normalNoName'],
  ['云朵对话框·有名字', 'cloud', 'cloudName'],
  ['爆炸框·无名字', 'blast', 'blastNoName'],
]) {
  const line = result.story.lines.find(item => item.preset === preset);
  assert.ok(line, `tutorial is missing ${preset}`);
  assert.strictEqual(line.mode, mode);
  assert.strictEqual(line.dialogueVariant, variant);
}
assert.ok(!result.story.lines.some(line => line.mode === 'ui-op' || line.mode === 'ui-present'));
const templateSource = fs.readFileSync(path.join(root, 'templates', 'minimal-demo', 'story', 'main.trickcal'), 'utf8');
assert.ok(!/^\s*ui\s+(?:show|bind|write|move|present|remove)\b/m.test(templateSource));
for (const directory of [path.join(project, 'presets'), path.join(root, 'templates', 'minimal-demo', 'presets')]) {
  for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.json'))) {
    assert.ok(!/^ui-(bubble|box|text)$/.test(JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')).type), file);
  }
}
assert.ok(source.split('\n').filter(line => line.trim().startsWith('#')).length >= 20);
for (const preset of presets.filter(p => /^ui-(bubble|box|text)$/.test(p.type))) {
  const kind = preset.type.slice(3);
  const check = compile(`ui show ${kind} check preset ${JSON.stringify(preset.name)}`, { presets });
  assert.deepStrictEqual(check.diagnostics, [], `invalid preset ${preset.name}`);
}

const assetOptions = { projectRoot: project };
for (const suffix of ['hold -1', 'hold nope', 'hold']) {
  assert.ok(compile(`ner manga "测试" ${suffix}`).diagnostics.some(item => item.severity === 'error'), suffix);
}
assert.strictEqual(compile('ner manga "测试" hold 0').story.lines[0].hold, 0);
const avatarDeclarations = [
  'image portrait = "assets/herohead/ner.png"',
  'image other_portrait = "assets/herohead/erpin.png"',
  'define hero = Spine("assets/spine/standing/ner", name="内尔", avatar=portrait, avatarBg="#112233")',
].join('\n') + '\n';
const avatarStory = compile(avatarDeclarations + [
  'hero clear "一" name "新的 名字" avatar other_portrait avatarBg "#aabbcc"',
  'hero clear "二"',
  'parallel:',
  '  hero clear "三" name "并行 名字" avatar portrait avatarBg "#abcdef"',
].join('\n'), { ...assetOptions, presets });
assert.deepStrictEqual(avatarStory.diagnostics, []);
assert.deepStrictEqual(avatarStory.story.lines.map(line => [line.speakerName, line.avatar, line.avatarBg]), [
  ['新的 名字', 'other_portrait', '#aabbcc'], ['内尔', 'portrait', '#112233'], ['并行 名字', 'portrait', '#abcdef'],
]);
assert.strictEqual(avatarStory.story.images.portrait, 'assets/herohead/ner.png');
for (const source of [
  'define hero = Spine("assets/spine/standing/ner", avatar=missing)',
  avatarDeclarations + 'hero clear "错误" avatar missing',
  avatarDeclarations + 'hero clear "错误" avatarBg "#oops"',
  avatarDeclarations + 'hero manga "错误" tail middle',
]) assert.ok(compile(source, assetOptions).diagnostics.some(item => item.severity === 'error'), source);
for (const [value, direction] of [['左下','bl'], ['右下','br'], ['左上','tl'], ['右上','tr']]) {
  const tail = compile(avatarDeclarations + `preset 漫画对话气泡 tail ${value}\nhero manga "一"\nhero manga "二" tail ${value}`, { ...assetOptions, presets });
  assert.deepStrictEqual(tail.diagnostics, []);
  assert.deepStrictEqual(tail.story.lines.map(line => line.tail), [direction, direction]);
}
const quotedMangaOptions = compile(
  'vivi manga "气泡文字" tail tr enter "default" exit "default" tail "tr" bubbleWidth 760 bubbleMinHeight 320 bubbleMaxHeight 640 bubblePaddingY 180 textWidth 580 textOffsetX 0 textOffsetY 0 uiScale 0.8 uiRot 0 uiOpacity 1 typeSpeed 1 overflow "grow" fontSize 52 textColor "#333333" shadowX 12.5 shadowY 12.5 shadowAlpha 0.4 shadowColor "#000000"',
  { presets },
);
assert.deepStrictEqual(quotedMangaOptions.diagnostics, []);
assert.deepStrictEqual(
  ['tail', 'enter', 'exit', 'bubbleWidth', 'bubbleMinHeight', 'bubbleMaxHeight', 'bubblePaddingY', 'textWidth', 'uiScale', 'overflow', 'fontSize', 'textColor', 'shadowAlpha', 'shadowColor']
    .map(key => quotedMangaOptions.story.lines[0][key]),
  ['tr', 'default', 'default', 760, 320, 640, 180, 580, 0.8, 'grow', 52, '#333333', 0.4, '#000000'],
);
const declarations = 'define hero = Spine("assets/spine/standing/ner", name="内尔")\nimage bg = "assets/bg/elf_city_night.png"\ndefine audio.rain = "assets/audio/silent.wav"\n';
const imported = compile(declarations + 'scene bg bg\nshow hero at left\nhero normal "你好"\naudio play rain\nnarration "雨"\naudio stop rain\nnarration "停"\n', assetOptions);
assert.deepStrictEqual(imported.diagnostics, []);
assert.strictEqual(imported.story.lines[0].stage[0].asset, 'hero');
assert.strictEqual(imported.story.lines[0].speakerName, '内尔');
assert.strictEqual(imported.story.lines[1].audio[0].src, 'assets/audio/silent.wav');
assert.strictEqual(imported.story.lines[2].audio[0].action, 'stop');
for (const command of [
  'audio play rain volume 0.5 times 2 fadeIn 200ms fadeOut 1s',
  'audio play rain loop volume 0 fadeIn .5s',
  'audio stop rain fadeOut 500ms',
]) {
  for (const script of [command + '\nnarration "测试"', `parallel:\n  ${command}\n  wait 1s`]) {
    const checked = compile(declarations + script, assetOptions);
    assert.deepStrictEqual(checked.diagnostics, [], script);
  }
}
for (const command of [
  'audio play rain volume -0.1', 'audio play rain volume 1.1',
  'audio play rain volume 0.5 volume 0.6', 'audio play rain volume',
  'audio play rain times 0', 'audio play rain times 1.5',
  'audio play rain fadeIn -1s', 'audio play rain fadeOut 1..2s',
  'audio play rain loop loop', 'audio play rain loop times 2',
  'audio play rain loop fadeOut 1s', 'audio play rain unknown 1',
  'audio stop rain fadeIn 1s', 'audio stop rain fadeOut 1s fadeOut 2s',
]) {
  for (const script of [command + '\nnarration "测试"', `parallel:\n  ${command}\n  wait 1s`]) {
    const checked = compile(declarations + script, assetOptions);
    assert.ok(checked.diagnostics.some(item => item.severity === 'error'), script);
  }
}
const parallelScene = compile([
  declarations,
  'scene bg black',
  'parallel:',
  '  after 0.5s:',
  '    scene bg bg',
  '    effect brightness 0.5',
  '    effect tint "#ff0000" 0',
  '  after 0.2s:',
  '    effect brightness 0.8',
  '  say hero normal "场景"',
  'hero normal "下一句"',
].join('\n'), assetOptions);
assert.deepStrictEqual(parallelScene.diagnostics, []);
assert.strictEqual(parallelScene.story.lines[0].bg, null);
assert.strictEqual(parallelScene.story.lines[0].fx.brightness, 1);
assert.deepStrictEqual(parallelScene.story.lines[0].events.map(event => [event.type, event.delay]), [
  ['effect', 0.2], ['scene', 0.5], ['effect', 0.5], ['effect', 0.5],
]);
assert.strictEqual(parallelScene.story.lines[1].bg, 'bg_bg');
assert.strictEqual(parallelScene.story.lines[1].bgUrl, 'assets/bg/elf_city_night.png');
assert.deepStrictEqual([parallelScene.story.lines[1].fx.brightness, parallelScene.story.lines[1].fx.tint, parallelScene.story.lines[1].fx.tintAlpha], [0.5, '#ff0000', 0]);
const sceneFade = compile([
  declarations,
  'scene bg black',
  'parallel:',
  '  scene bg bg in 500ms ease Linear',
  '  wait 0.5s',
  '  say hero normal "背景淡入"',
].join('\n'), assetOptions);
assert.deepStrictEqual(sceneFade.diagnostics, []);
assert.deepStrictEqual(sceneFade.story.lines[0].events[0].scene.transition, { duration: 0.5, ease: 'Linear' });
assert.strictEqual(sceneFade.story.lines[0].timelineEnd, 0.5);
assert.ok(compile(declarations + 'parallel:\n  scene bg bg in 0s\n  wait 1s', assetOptions).diagnostics.some(item => item.message.includes('大于零')));
assert.ok(compile(declarations + 'parallel:\n  scene bg bg in 1s ease NotAnEase\n  wait 1s', assetOptions).diagnostics.some(item => item.message.includes('背景渐变缓动')));
assert.ok(compile(declarations + 'scene bg bg in 1s\nnarration "错误"', assetOptions).diagnostics.some(item => item.message.includes('parallel')));
const bgAlias = compile(declarations + 'bg bg\nhero normal "背景"', assetOptions);
assert.deepStrictEqual(bgAlias.diagnostics, []);
assert.strictEqual(bgAlias.story.lines[0].bg, 'bg_bg');
const variableStory = compile([
  'default trust = 0',
  'set trust += 1',
  'if trust >= 1:',
  '  narration "可信任"',
  'else:',
  '  narration "不可信任"',
  'choice "决定"',
  '  "继续" -> continue',
  '  "离开" -> leave if trust >= 2',
  'label continue:',
  '  set trust = 3',
  '  narration "继续"',
  '  end',
  'label leave:',
  '  narration "离开"',
  '  end',
].join('\n'));
assert.deepStrictEqual(variableStory.diagnostics, []);
assert.deepStrictEqual(variableStory.story.variables, { trust: 0 });
assert.deepStrictEqual(variableStory.story.lines.filter(line => ['set', 'condition', 'branch-jump'].includes(line.mode)).map(line => line.mode), ['set', 'condition', 'branch-jump', 'set']);
assert.strictEqual(variableStory.story.lines.find(line => line.mode === 'branch').options[1].condition.type, 'binary');
assert.ok(compile('default trust = 0\nset trust += "bad"').diagnostics.some(item => item.message.includes('复合赋值')));
assert.ok(compile('default trust = 0\nif trust:\n  narration "错误"').diagnostics.some(item => item.message.includes('布尔表达式')));
assert.ok(compile('default trust = 0\nif true:\n  narration "true"\nelse:\n  narration "first"\nelse:\n  narration "second"').diagnostics.some(item => item.message.includes('只能有一个 else')));
assert.ok(compile('else:\n  narration "孤立 else"').diagnostics.some(item => item.message.includes('必须与对应的 if')));
for (const bad of [
  'set missing = 1',
  'default trust = 0\nset trust = "错误"',
  'default trust = 0\nif trust:\n  narration "错误"',
  'default trust = 0\nif missing > 1:\n  narration "错误"',
]) assert.ok(compile(bad).diagnostics.some(item => item.severity === 'error'), bad);
const parallelShader = compile([
  declarations,
  '同时:',
  '  shader heat 0.35',
  '  after 250ms:',
  '    shader reset',
  '  say hero normal "着色"',
  'hero normal "恢复"',
].join('\n'), assetOptions);
assert.deepStrictEqual(parallelShader.diagnostics, []);
assert.deepStrictEqual(parallelShader.story.lines[0].events.map(event => [event.type, event.delay, event.shader?.name || null]), [
  ['shader', 0, 'heat'],
  ['shader', 0.25, null],
]);
assert.strictEqual(parallelShader.story.lines[1].shader, undefined);
assert.ok(compile('shader unknown\nnarration "测试"').diagnostics.some(item => item.message.includes('未知着色器')));
assert.ok(compile('shader custom "../outside.frag"\nnarration "测试"').diagnostics.some(item => item.message.includes('assets/shaders')));
assert.ok(compile('shader custom "assets/shaders/effect.glsl"\nnarration "测试"').diagnostics.some(item => item.message.includes('.frag')));
assert.ok(compile('shader custom\nnarration "测试"').diagnostics.some(item => item.message.includes('自定义着色器语法')));
assert.ok(compile('shader custom "assets/shaders/missing.frag"\nnarration "测试"', { projectRoot: project }).diagnostics.some(item => item.message.includes('自定义着色器无法读取')));
for (const name of ['heat', 'dream', 'gray', 'glitch', 'wave']) {
  assert.deepStrictEqual(compile(`shader ${name} 0.35\nnarration "测试"`).diagnostics, [], name);
}
assert.deepStrictEqual(compile('shader custom "assets/shaders/effect.frag" 0.35\nnarration "测试"').diagnostics, []);
const zeroShaderIntensity = compile('shader heat 0\nnarration "测试"');
assert.deepStrictEqual(zeroShaderIntensity.diagnostics, []);
assert.strictEqual(zeroShaderIntensity.story.lines[0].shader.intensity, 0);
assert.ok(compile('shader heat 0.4 extra\nnarration "测试"').diagnostics.some(item => item.message.includes('强度')));
assert.ok(compile('shader heat -0.4\nnarration "测试"').diagnostics.some(item => item.message.includes('强度')));
for (const invalid of ['effect tint "#ff0000" 2', 'effect tint "#ff0000" -1', 'effect tint "#invalid" 1', 'effect brightness 1.2 extra', 'scene bg missing']) {
  const bad = compile(declarations + `parallel:\n  say hero normal "测试"\n  ${invalid}`, assetOptions);
  assert.ok(bad.diagnostics.some(item => item.severity === 'error'), invalid);
}
assert.ok(compile('effect tint "#ff0000" 0\nner normal "测试"').story.lines[0].fx.tintAlpha === 0);
assert.ok(compile(declarations + 'show ner', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('show ner', { strictAssets: true }).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('audio stop rain', { strictAssets: true }).diagnostics.some(d => d.severity === 'error'));
assert.ok(!compile('show ner', {}).diagnostics.some(d => d.severity === 'error'), 'legacy projects remain compatible');
assert.ok(compile(declarations + 'parallel:\n  say ner normal "missing"', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile(declarations + 'spawn hero as a\nspawn hero as b\nbind a to b\nbind b to a', assetOptions).diagnostics.some(d => d.message.includes('循环')));
assert.ok(compile('asset image bad "assets/../trickcal.project.json"', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('asset image bg "assets/bg/missing.png"', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile(declarations + 'asset audio rain "assets/audio/silent.wav"', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('define ner = Spine("assets/spine/standing/ner")\nshow ner\nnarration "test"', assetOptions).diagnostics.length === 0);
assert.ok(compile('define ner = Spine("assets/spine/standing/ner", invalid=1)', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('image bg = "assets/bg/missing.png"', assetOptions).diagnostics.some(d => d.severity === 'error'));
assert.ok(compile('define audio.rain = "assets/audio/missing.wav"', assetOptions).diagnostics.some(d => d.severity === 'error'));
const imageStage = compile(declarations + 'spawn image bg as picture at 100,200\nnarration "test"', assetOptions);
assert.strictEqual(imageStage.story.lines[0].stage[0].x, 100);
assert.strictEqual(imageStage.story.lines[0].stage[0].y, 200);
const showImage = compile(declarations + 'show image bg as picture at 100,200 scale 0.5 alpha 0.6\nnarration "test"', assetOptions);
assert.deepStrictEqual(showImage.diagnostics, []);
assert.deepStrictEqual([showImage.story.lines[0].stage[0].kind, showImage.story.lines[0].stage[0].x,
  showImage.story.lines[0].stage[0].y, showImage.story.lines[0].stage[0].alpha], ['image', 100, 200, 0.6]);
const template = path.join(root, 'templates', 'minimal-demo');
const templateManifest = JSON.parse(fs.readFileSync(path.join(template, 'trickcal.project.json'), 'utf8'));
const templatePresets = fs.readdirSync(path.join(template, 'presets')).filter(f => f.endsWith('.json')).map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(template, 'presets', f), 'utf8')) }));
const templateResult = compile(fs.readFileSync(path.join(template, templateManifest.entry), 'utf8'), { ...templateManifest, projectRoot: template, presets: templatePresets });
assert.deepStrictEqual(templateResult.diagnostics.filter(d => d.severity === 'error'), []);
const presetResult = compile('preset 爆炸框\nner normal "测试"', { presets });
assert.strictEqual(presetResult.story.lines[0].mode, 'normal');
assert.strictEqual(presetResult.story.lines[0].dialogueVariant, 'blast');
const modePreserved = compile('preset 普通对话框\nner think "测试"', { presets });
assert.strictEqual(modePreserved.story.lines[0].mode, 'mangaThink');
assert.strictEqual(modePreserved.story.lines[0].fontSize, 52);

const missingChapter = compile('opening "缺章节" hold 3 cinema on', {});
assert.ok(missingChapter.diagnostics.some(d => d.severity === 'error' && d.message.includes('opening 语法')));
const missingTitleHold = compile('opening 1 "缺停留" cinema on', {});
assert.ok(missingTitleHold.diagnostics.some(d => d.severity === 'error' && d.message.includes('缺少 hold')));
const missingLocationHold = compile('opening 1 "缺地点停留" hold 3 cinema on\nlocation "地点"', {});
assert.ok(missingLocationHold.diagnostics.some(d => d.severity === 'error' && d.message.includes('location 缺少 hold')));

console.log('compiler.test.js: ok (' + result.story.lines.length + ' lines)');

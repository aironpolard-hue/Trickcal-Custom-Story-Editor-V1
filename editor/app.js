'use strict';

const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const projectPath = query.get('project') || '';
let projectData = null;
let monaco = null;
let editor = null;
let model = null;
let diagnostics = [];
let dirty = false;
let compileTimer = 0;
let sourceRevision = 0;
let compileRequest = 0;
let presets = [];
let selectedPreset = null;
let lastStory = null;
let stageLineIndex = 0;
let stageObjectKey = 'ui:box';
let timelineLineIndex = 0;
window.__studio = { get story() { return lastStory; }, get stageIndex() { return stageLineIndex; }, get stageObject() { return stageObjectKey; }, get timelineIndex() { return timelineLineIndex; } };
let lastBuildOut = null;
let previewRunning = false;
let previewSource = null;
let stageOptionsStory = null;
let sourceIndexStory = null;
let sourceLineIndex = new Map();

function findStageLine(story, sourceLine) {
  if (sourceIndexStory !== story) {
    sourceLineIndex = new Map();
    for (let i = 0; i < story.lines.length; i++) {
      const line = Number(story.lines[i].sourceLine);
      if (!sourceLineIndex.has(line)) sourceLineIndex.set(line, i);
    }
    sourceIndexStory = story;
  }
  return sourceLineIndex.get(sourceLine) ?? -1;
}

function syncPreviewRendering() {
  const frames = [
    [$('previewFrame'), document.querySelector('.tab[data-tab="preview"]').classList.contains('active')],
    [$('presetPreviewFrame'), $('presetPanel').classList.contains('active')],
  ];
  for (const [frame, enabled] of frames) {
    try { frame.contentWindow?.__demo?.setRenderingEnabled(enabled); }
    catch (error) { console.warn('Unable to update preview rendering', error); }
  }
}

for (const id of ['previewFrame', 'presetPreviewFrame']) {
  $(id).addEventListener('load', syncPreviewRendering);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setStatus(message) { $('modeStatus').textContent = message; }

function setDirty(value) {
  dirty = value;
  const el = $('saveState');
  el.textContent = value ? '未保存' : '已保存';
  el.classList.toggle('dirty', value);
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  const codeVisible = name === 'code';
  document.querySelector('.editor-wrap').style.display = codeVisible ? '' : 'none';
  $('previewPane').classList.toggle('hidden', codeVisible);
  syncPreviewRendering();
  if (codeVisible && editor) setTimeout(() => editor.layout(), 20);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

function switchInspector(name) {
  document.querySelectorAll('.itab').forEach(t => t.classList.toggle('active', t.dataset.itab === name));
  for (const id of ['diagnosticsPanel', 'detailsPanel', 'presetPanel', 'spinePanel', 'stagePanel', 'timelinePanel']) {
    $(id).classList.toggle('active', id === name + 'Panel');
  }
  if (name === 'stage') renderStagePanel();
  if (name === 'timeline') renderTimelinePanel();
  syncPreviewRendering();
}
document.querySelectorAll('.itab').forEach(t => t.addEventListener('click', () => switchInspector(t.dataset.itab)));

function registerLanguage(m) {
  m.languages.register({ id: 'trickcal' });
  m.languages.setMonarchTokensProvider('trickcal', {
    defaultToken: '',
    tokenPostfix: '.trickcal',
    keywords: ['define', 'default', 'set', 'if', 'else', 'asset', 'name', 'opening', 'scene', 'show', 'hide', 'choice', 'label', 'jump', 'end', 'narration', 'location', 'fullscreen', 'news', 'audio', 'cloud', 'sfx', 'play', 'stop', 'loop', 'times', 'fadeIn', 'fadeOut', 'volume', 'preset', 'parallel', '同时', 'oneshot', 'spine', 'spawn', 'image', 'effect', 'shader', 'skin', 'anim', 'bind', 'unbind', 'say', 'move', 'after', 'wait', 'in', 'by', 'ease', 'at', 'face', 'pose', 'anim', 'scale', 'hold', 'emote', 'bubble', 'tail', 'purple', 'noName', 'anchor', 'parent'],
    modes: ['normal', 'manga', 'think', 'clear', 'clearRe', 'anime', 'blast', 'fullscreen', 'narration', 'location', 'news', 'anchor', 'summary'],
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/<[^>]+>/, 'tag'],
        [/\b(define|default|set|if|else|image|asset|ui|opening|scene|show|hide|choice|label|jump|end|narration|location|fullscreen|audio|cloud|sfx|parallel|after|wait|say|move)\b/, 'keyword'],
        [/同时(?=\s*:)/, 'keyword'],
        [/\b(normal|manga|think|clear|clearRe|anime|blast|news|anchor|summary|at|face|pose|anim|scale|hold|emote|bubble|tail|purple|noName)\b/, 'type'],
        [/\b\d+(?:\.\d+)?(?:ms|s)?\b/, 'number'],
        [/[A-Za-z_][\w.-]*/, 'identifier'],
      ],
    },
  });
  m.languages.registerCompletionItemProvider('trickcal', {
    triggerCharacters: [' ', '"'],
    provideCompletionItems: (mdl, position) => {
      const word = mdl.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const suggestions = [];
      const add = (label, kind, insertText, detail) => suggestions.push({ label, kind, insertText, detail, range });
      add('define Spine', m.languages.CompletionItemKind.Keyword, 'define ner = Spine("assets/spine/standing/ner", name="内尔")', '声明 Spine 角色');
      add('image', m.languages.CompletionItemKind.Keyword, 'image background = "assets/bg/elf_city_night.png"', '声明图片');
      add('define audio', m.languages.CompletionItemKind.Keyword, 'define audio.rain = "assets/audio/silent.wav"', '声明音频');
      add('wait', m.languages.CompletionItemKind.Keyword, 'wait 1s', '等待指定的秒数');
      add('wait milliseconds', m.languages.CompletionItemKind.Keyword, 'wait 500ms', '等待指定的毫秒数');
      for (const k of ['default trust = 0', 'set trust += 1', 'if trust >= 2:', 'else:', 'opening', 'scene bg', 'show ', 'hide ', 'narration ', 'location ', 'choice ', 'label ', 'jump ', 'end', 'cloud ', 'sfx ', 'audio play ', 'preset ', 'parallel:', '同时:', 'after 500ms:', 'oneshot spine emoticon anim ', 'spawn ner as ner_2 ', 'show image station as poster at 960,540 scale 0.2', 'hide poster', 'bind poster to ner offset 80,0', 'unbind poster at 960,540', 'anim ner ', 'skin ner ', 'bind ner_2 to ner offset 80,0', 'spawn image logo as logo_1 at 960,540 scale 1', 'effect brightness 1.15', 'shader heat 0.35', '  say ', '  move ']) add(k, m.languages.CompletionItemKind.Keyword, k, 'Trickcal 语句');
      for (const mode of ['normal', 'manga', 'think', 'clear', 'clearRe', 'anime', 'blast']) add(mode, m.languages.CompletionItemKind.EnumMember, mode, '对话模式');
      for (const id of Object.keys(projectData?.manifest?.cast || {})) {
        add(id, m.languages.CompletionItemKind.Variable, id, '角色');
        add(id + ' dialogue', m.languages.CompletionItemKind.Snippet, `${id} normal ""`, '并行块和普通剧情都可直接使用的角色台词');
      }
      for (const bg of Object.keys(projectData?.manifest?.backgrounds || {})) add(bg, m.languages.CompletionItemKind.Constant, bg, '背景');
      const text = mdl.getValue();
      for (const lm of text.matchAll(/^\s*label\s+([\w.-]+)/gm)) add(lm[1], m.languages.CompletionItemKind.Reference, lm[1], '标签');
      return { suggestions };
    },
  });
  m.languages.registerColorProvider('trickcal', {
    provideDocumentColors(model) {
      const text = model.getValue();
      const out = [];
      const re = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
      let match;
      while ((match = re.exec(text))) {
        let hex = match[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        out.push({
          color: { red: parseInt(hex.slice(0, 2), 16) / 255, green: parseInt(hex.slice(2, 4), 16) / 255, blue: parseInt(hex.slice(4, 6), 16) / 255, alpha },
          range: new m.Range(model.getPositionAt(match.index).lineNumber, model.getPositionAt(match.index).column, model.getPositionAt(match.index + match[0].length).lineNumber, model.getPositionAt(match.index + match[0].length).column),
        });
      }
      return out;
    },
    provideColorPresentations(model, colorInfo) {
      const c = colorInfo.color;
      const toHex = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
      return [{ label: '#' + toHex(c.red) + toHex(c.green) + toHex(c.blue) + (c.alpha < 1 ? toHex(c.alpha) : '') }];
    },
  });
}

function setMarkers() {
  if (!monaco || !model) return;
  const markers = diagnostics.map(d => ({
    severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message: d.message,
    startLineNumber: d.line || 1,
    endLineNumber: d.line || 1,
    startColumn: d.column || 1,
    endColumn: (d.column || 1) + 1,
  }));
  monaco.editor.setModelMarkers(model, 'trickcal', markers);
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  $('diagStatus').textContent = `${errors} 个错误${warnings ? ` · ${warnings} 个警告` : ''}`;
  $('issueCount').textContent = String(diagnostics.length);
  const list = $('diagnosticsList');
  if (!diagnostics.length) {
    list.innerHTML = '<div class="empty">没有发现问题</div>';
    return;
  }
  list.innerHTML = diagnostics.map((d, i) => `<div class="diag-item ${d.severity}" data-index="${i}"><b>${d.line}:${d.column || 1}</b>${escapeHtml(d.message)}</div>`).join('');
  list.querySelectorAll('.diag-item').forEach(el => {
    el.addEventListener('click', () => {
      const d = diagnostics[Number(el.dataset.index)];
      if (!d || !editor) return;
      editor.revealLineInCenter(d.line || 1);
      editor.setPosition({ lineNumber: d.line || 1, column: d.column || 1 });
      editor.focus();
    });
  });
}

async function compileNow({ showStatus = true } = {}) {
  if (!projectData) return null;
  const revision = sourceRevision;
  const request = ++compileRequest;
  try {
    const result = await window.engine.compile({ projectPath, source: model.getValue() });
    if (result.superseded || revision !== sourceRevision || request !== compileRequest) return null;
    diagnostics = result.diagnostics || [];
    lastStory = result.story || lastStory;
    setMarkers();
    if (document.getElementById('stagePanel')?.classList.contains('active')) renderStagePanel();
    if (document.getElementById('timelinePanel')?.classList.contains('active')) renderTimelinePanel();
    if (showStatus) setStatus(diagnostics.some(d => d.severity === 'error') ? '检查未通过' : '检查通过');
    return result;
  } catch (e) {
    if (revision !== sourceRevision || request !== compileRequest) return null;
    diagnostics = [{ line: 1, column: 1, severity: 'error', message: e.message || String(e) }];
    setMarkers();
    setStatus('编译失败');
    return null;
  }
}

function scheduleCompile() {
  sourceRevision++;
  setDirty(true);
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => compileNow({ showStatus: false }), 500);
}

async function saveProject() {
  if (!projectData) return null;
  const source = model.getValue();
  const revision = sourceRevision;
  ++compileRequest;
  try {
    const result = await window.engine.saveStory({ projectPath, source });
    if (revision !== sourceRevision) {
      setStatus('保存了较早的内容，当前修改尚未保存');
      return null;
    }
    diagnostics = result.diagnostics || [];
    lastStory = result.story || lastStory;
    if (lastStory?.meta && projectData?.manifest) {
      if (lastStory.meta.chapterNo != null) projectData.manifest.chapterNo = lastStory.meta.chapterNo;
      if (lastStory.meta.title) projectData.manifest.openingTitle = lastStory.meta.title;
    }
    setMarkers();
    if (document.getElementById('stagePanel')?.classList.contains('active')) renderStagePanel();
    if (document.getElementById('timelinePanel')?.classList.contains('active')) renderTimelinePanel();
    setDirty(false);
    setStatus('已保存');
    return result;
  } catch (e) {
    setStatus('保存失败：' + (e.message || e));
    return null;
  }
}

async function runPreview(targetIndex = null) {
  const saved = await saveProject();
  if (!saved || (saved.diagnostics || []).some(d => d.severity === 'error')) {
    switchInspector('diagnostics');
    setStatus('请先修复错误再运行');
    return;
  }
  try {
    const savedSource = model.getValue();
    const savedRevision = sourceRevision;
    const url = await window.engine.previewUrl({ projectPath });
    if (sourceRevision !== savedRevision) {
      setStatus('剧本已更改，请重新运行预览');
      return;
    }
    $('previewEmpty').classList.add('hidden');
    const frame = $('previewFrame');
    frame.classList.add('live');
    previewSource = savedSource;
    if (targetIndex != null) {
      frame.addEventListener('load', () => {
        const demo = frame.contentWindow && frame.contentWindow.__demo;
        if (!demo) return;
        const deadline = Date.now() + 15000;
        const seekWhenReady = () => {
          if (frame.src !== url || Date.now() > deadline) return;
          if (!demo.STORY.length || !demo.state.started) { setTimeout(seekWhenReady, 100); return; }
          demo.seek(targetIndex, 0, { replay: true });
        };
        seekWhenReady();
      }, { once: true });
    }
    frame.src = url;
    previewRunning = true;
    $('previewState').textContent = '运行中';
    switchTab('preview');
    switchInspector('diagnostics');
    setStatus('预览运行中');
  } catch (e) {
    setStatus('预览失败：' + (e.message || e));
  }
}

function stopPreview() {
  const frame = $('previewFrame');
  frame.classList.remove('live');
  frame.src = 'about:blank';
  $('previewEmpty').classList.remove('hidden');
  previewRunning = false;
  previewSource = null;
  $('previewState').textContent = '未运行';
  setStatus('预览已停止');
}

async function buildProject() {
  const saved = await saveProject();
  if (!saved || (saved.diagnostics || []).some(d => d.severity === 'error')) {
    switchInspector('diagnostics');
    setStatus('请先修复错误再构建');
    return;
  }
  const target = $('buildTarget').value;
  $('buildModal').classList.remove('hidden');
  $('buildLog').textContent = '';
  $('buildStatus').textContent = `正在构建 ${target === 'web' ? 'Web' : target === 'android' ? 'Android' : 'Windows'}…`;
  try {
    const result = await window.engine.build({ projectPath, target });
    lastBuildOut = result.out;
    $('buildStatus').textContent = '构建完成';
    $('buildLog').textContent = [
      `项目：${result.manifest?.title || projectData.manifest.title}`,
      `目标：${target}`,
      result.applicationId ? `应用 ID：${result.applicationId}` : '',
      result.apk ? `APK：${result.apk}` : '',
      `输出：${result.out}`,
      '',
      '构建产物已生成。',
      target === 'web' ? '可将 build/web 上传到静态服务器，或直接用本地服务器打开。'
        : target === 'android' ? (result.variant === 'release' ? '已使用配置的密钥签名正式包。' : '这是调试签名测试包，不适合正式发布。')
          : 'Windows 程序使用 Electron 运行时。',
    ].join('\n');
  } catch (e) {
    $('buildStatus').textContent = '构建失败';
    $('buildLog').textContent = e.message || String(e);
  }
}

function renderTree() {
  const tree = $('projectTree');
  if (!projectData) return;
  tree.innerHTML = `
    <div class="tree-folder">STORY</div>
    <div class="tree-item active" data-open="story"><span class="ico">T</span><span>main.trickcal</span></div>
    <div class="tree-folder">PROJECT</div>
    <div class="tree-item" data-open="presets"><span class="ico">P</span><span>presets /</span></div>
    <div class="tree-item" data-open="assets"><span class="ico">A</span><span>assets /</span></div>
    <div class="tree-item" data-open="folder"><span class="ico">↗</span><span>打开项目文件夹</span></div>`;
  tree.querySelectorAll('.tree-item').forEach(el => el.addEventListener('click', () => {
    const open = el.dataset.open;
    if (open === 'story') switchTab('code');
    else if (open === 'presets') { switchInspector('preset'); $('presetList').scrollIntoView({ block: 'nearest' }); }
    else if (open === 'assets') $('assetList').scrollIntoView({ block: 'nearest' });
    else if (open === 'folder') window.engine.openPath(projectPath);
  }));
}

function renderProjectDetails() {
  if (!projectData) return;
  const m = projectData.manifest;
  const badge = $('chapterBadge');
  if (badge) badge.textContent = `第 ${m.chapterNo != null ? m.chapterNo : '—'} 话`;
  $('projectDetails').innerHTML = [
    ['标题', m.title || '—'],
    ['章节数', m.chapterNo != null ? String(m.chapterNo) : '—'],
    ['项目 ID', m.id || '—'],
    ['入口', m.entry || 'story/main.trickcal'],
    ['分辨率', (m.resolution || [1920, 1080]).join(' × ')],
    ['角色', Object.keys(m.cast || {}).join(' / ') || '—'],
    ['背景', String(Object.keys(m.backgrounds || {}).length) + ' 个'],
    ['项目路径', projectPath],
  ].map(([k, v]) => `<div class="detail-row"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`).join('') + `
    <div class="opening-editor">
      <div class="panel-head"><span>开场 / 地点</span><span>写回 main.trickcal</span></div>
      <div class="opening-grid">
        <label>章节数（必填）<input id="openingChapter" type="number" min="1" max="999" step="1" placeholder="1"></label>
        <label>开场停留 · 秒（必填）<input id="openingHold" type="number" min="0" max="60" step="0.1" placeholder="3.6"></label>
        <label>地点停留 · 秒（必填）<input id="locationHold" type="number" min="0" max="60" step="0.1" placeholder="2.6"></label>
      </div>
      <label class="inline-check"><input id="openingCinema" type="checkbox"><span>显示电影边框</span></label>
      <button id="applyOpening" class="btn leaf" type="button">应用并保存</button>
      <div class="opening-note">章节数、开场停留、电影边框和地点停留都直接写回 main.trickcal；程序不提供隐藏默认值。</div>
    </div>`;
  wireOpeningEditor();
}

function sourceOpeningValues(source) {
  const opening = String(source).match(/^opening\s+(?:(\d+)\s+)?"((?:[^"\\]|\\.)*)"([\s\S]*?)$/m);
  const location = String(source).match(/^location\s+"((?:[^"\\]|\\.)*)"(\s+hold\s+[\d.]+)?/m);
  const flags = opening ? opening[3] || '' : '';
  const holdM = flags.match(/\bhold\s+([\d.]+)/);
  const cinemaM = flags.match(/\bcinema\s+(on|off|true|false)/i);
  const locHoldM = location && location[2] ? location[2].match(/hold\s+([\d.]+)/) : null;
  return {
    opening, location,
    chapter: opening && opening[1] ? Number(opening[1]) : '',
    title: opening ? opening[2].replace(/\\"/g, '"') : '',
    hold: holdM ? Number(holdM[1]) : '',
    cinema: opening ? !/off|false/i.test(cinemaM ? cinemaM[1] : 'on') : true,
    locHold: locHoldM ? Number(locHoldM[1]) : '',
  };
}

function updateOpeningSourceLine(source, patch) {
  return String(source).replace(/^opening.*$/m, (line) => {
    const m = line.match(/^(\s*)opening\s+(\d+)\s+"((?:[^"\\]|\\.)*)"([\s\S]*)$/);
    if (!m) return line;
    const chapter = patch.chapter != null ? String(patch.chapter) : m[2];
    const title = patch.title != null
      ? String(patch.title).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      : m[3];
    let rest = m[4] || '';
    if (patch.hold != null) rest = appendOrReplaceToken(rest, 'hold', `hold ${patch.hold}`);
    if (patch.cinema != null) rest = appendOrReplaceToken(rest, 'cinema', `cinema ${patch.cinema ? 'on' : 'off'}`);
    return `${m[1]}opening ${chapter} "${title}"${rest}`;
  });
}

function updateLocationSourceLine(source, patch) {
  return String(source).replace(/^location.*$/m, (line) => {
    const m = line.match(/^(\s*)location\s+"((?:[^"\\]|\\.)*)"([\s\S]*)$/);
    if (!m) return line;
    let rest = m[3] || '';
    if (patch.hold != null) rest = appendOrReplaceToken(rest, 'hold', `hold ${patch.hold}`);
    return `${m[1]}location "${m[2]}"${rest}`;
  });
}

function wireOpeningEditor() {
  const vals = sourceOpeningValues(model ? model.getValue() : projectData.source);
  const chapter = $('openingChapter');
  const hold = $('openingHold');
  const locHold = $('locationHold');
  const cinema = $('openingCinema');
  if (!chapter || !hold || !locHold || !cinema) return;
  chapter.value = vals.chapter === '' ? '' : String(vals.chapter);
  hold.value = vals.hold === '' ? '' : String(vals.hold);
  locHold.value = vals.locHold === '' ? '' : String(vals.locHold);
  cinema.checked = vals.cinema;
  $('applyOpening').addEventListener('click', async () => {
    let source = model.getValue();
    const current = sourceOpeningValues(source);
    if (chapter.value.trim() === '' || !Number.isFinite(Number(chapter.value)) || Number(chapter.value) < 1) {
      setStatus('章节数必须填写（1–999）');
      chapter.focus();
      return;
    }
    if (hold.value.trim() === '' || !Number.isFinite(Number(hold.value)) || Number(hold.value) < 0) {
      setStatus('开场停留必须填写（秒）');
      hold.focus();
      return;
    }
    if (current.location && (locHold.value.trim() === '' || !Number.isFinite(Number(locHold.value)) || Number(locHold.value) < 0)) {
      setStatus('地点停留必须填写（秒）');
      locHold.focus();
      return;
    }
    source = updateOpeningSourceLine(source, {
      chapter: Math.max(1, Math.min(999, Math.round(Number(chapter.value)))),
      title: current.title || projectData.manifest.title || '未命名剧情',
      hold: Math.max(0, Number(hold.value)),
      cinema: cinema.checked,
    });
    if (current.location) {
      source = updateLocationSourceLine(source, { hold: Math.max(0, Number(locHold.value)) });
    }
    model.setValue(source);
    await saveProject();
    renderProjectDetails();
    setStatus('开场设置已写入 main.trickcal');
  });
}


function renderPresetFields(p) {
  const wrap = $('presetFields');
  if (!wrap) return;
  const f = p.fields || (p.fields = {});
  const number = (key, label, step = 1, min = 0, max = 10000, fallback = 0) => `<label>${label}<input type="number" data-field="${key}" step="${step}" min="${min}" max="${max}" value="${Number(f[key] ?? fallback)}"></label>`;
  const transformFields = () => number('uiX', '整体 X', 1, -2000) + number('uiY', '整体 Y', 1, -2000)
    + number('uiScale', '整体缩放', 0.01, 0.1, 4, 1) + number('uiRot', '整体旋转', 0.1, -360)
    + number('uiOpacity', '整体透明度', 0.05, 0, 1, 1) + number('textOffsetX', '文字 X', 1, -1000)
    + number('textOffsetY', '文字 Y', 1, -1000);
  const textFields = () => number('fontSize', '字号', 1, 18, 120, 52)
    + `<label>文字颜色<input type="color" data-field="textColor" value="${escapeHtml(f.textColor || (p.type === 'news' ? '#012060' : f.mode === 'anime' ? '#ffffff' : f.mode === 'narration' ? '#d4d4d4' : f.purple ? '#f7f0fb' : '#333333'))}"></label>`
    + number('typeSpeed', '打字速度倍率', 0.05, 0.01, 5, 1);
  let html = '';
  if (p.type === 'bubble') {
    html = `<label>入场<select data-field="enter"><option value="default">default</option><option value="none">none 无动画</option></select></label><label>退场<select data-field="exit"><option value="default">default</option><option value="none">none 无动画</option></select></label>`
      + number('bubbleWidth', '气泡宽度', 1, 360, 10000, 760) + number('bubbleMinHeight', '最小高度', 1, 160, 10000, 320)
      + number('bubbleMaxHeight', '最大高度', 1, 160, 10000, 1200) + number('bubblePaddingY', '上下内边距', 1, 0, 10000, 180)
      + number('textWidth', '文字宽度', 1, 220, 10000, 580) + textFields() + transformFields()
      + `<label>紫色内心<select data-field="purple"><option value="false">否</option><option value="true">是</option></select></label>`
      + `<label>溢出处理<select data-field="overflow"><option value="grow">grow 气泡长高</option><option value="shrink">shrink 缩小字号</option><option value="scroll">scroll 滚动</option><option value="clip">clip 裁切</option></select></label>`;
    if (p.previewMode === 'manga' || !/思考|think/i.test(`${p.name || ''} ${p.file || ''}`)) {
      html += `<label>箭头方向<select data-field="tail"><option value="bl">左下</option><option value="br">右下</option><option value="tl">左上</option><option value="tr">右上</option></select></label>`;
    }
  } else if (p.type === 'dialogue') {
    html = `<label>入场<select data-field="enter"><option value="default">default</option><option value="none">none 无动画</option></select></label><label>退场<select data-field="exit"><option value="default">default</option><option value="none">none 无动画</option></select></label>`
      + `<label>预览模式<select data-field="mode"><option value="normal">normal</option><option value="cloud">cloud</option><option value="blast">blast</option><option value="clear">clear</option><option value="narration">narration</option><option value="sfx">sfx</option><option value="anime">anime</option></select></label>`
      + textFields() + transformFields();
    if (f.mode === 'clear' || /独白|clear/i.test(`${p.name || ''} ${p.file || ''}`)) {
      html += `<label>头像底色<input type="color" data-field="avatarBg" value="${escapeHtml(f.avatarBg || '#9fc766')}"></label>`;
    }
  } else if (p.type === 'news' || p.type === 'fullscreen') {
    html = textFields() + transformFields()
      + number('speed', '逐字间隔（秒）', 0.001, 0.001, 1, 0.03)
      + number('punctuationPause', '标点停顿（秒）', 0.01, 0, 2, 0.12)
      + `<label>退场<select data-field="exit"><option value="default">default</option><option value="none">none 无动画</option></select></label>`;
    if (p.type === 'news') {
      html += `<label>入场<select data-field="enter"><option value="default">default</option><option value="none">none 无动画</option></select></label>`
        + number('entryDuration', '入场时长（秒）', 0.05, 0.01, 60, 0.5)
        + number('shadowX', '阴影水平偏移', 1, -500, 500, 10)
        + number('shadowY', '阴影垂直偏移', 1, -500, 500, f.mode === 'newsTalk' ? -10 : 10)
        + number('shadowAlpha', '阴影不透明度', 0.05, 0, 1, 0.149)
        + `<label>阴影颜色<input type="color" data-field="shadowColor" value="${escapeHtml(f.shadowColor || '#000000')}"></label>`;
    }
  } else if (p.type === 'opening' || p.type === 'location') {
    html = number('uiX', '整体 X', 1, -2000) + number('uiY', '整体 Y', 1, -2000)
      + number('uiScale', '整体缩放', 0.01, 0.1, 4, 1) + number('uiRot', '整体旋转', 0.1, -360)
      + number('uiOpacity', '整体透明度', 0.05, 0, 1, 1);
    if (p.type === 'opening') html += `<label>电影边框<select data-field="cinema"><option value="true">显示</option><option value="false">隐藏</option></select></label>`;
  } else if (p.type === 'transition') {
    html = `<label>转场样式<select data-field="kind">${['fadeblack','fadeinblack','fadeoutblack','fadeinwhite','fadeoutwhite','circle','rightpush','colorbars'].map(value => `<option>${value}</option>`).join('')}</select></label>`
      + number('hold', '时长（秒）', 0.1, 0.2, 60, 1.4);
  } else if (p.type === 'typewriter') {
    html = number('speed', '逐字间隔（秒）', 0.001, 0.001, 1, 0.03) + number('punctuationPause', '标点停顿（秒）', 0.01, 0, 2) + number('typeSpeed', '速度倍率', 0.05, 0.01, 5, 1);
  } else if (p.type === 'move') {
    html = number('duration', '时长（秒）', 0.1, 0.01, 60, 1)
      + `<label>缓动<select data-field="ease">${['OutCubic', 'Linear', 'InSine', 'OutSine', 'InOutSine', 'InCubic', 'InOutCubic', 'OutBack', 'OutQuint'].map(value => `<option>${value}</option>`).join('')}</select></label>`;
    if (f.from != null) html += `<label>进入方向<select data-field="from"><option value="left">左侧</option><option value="right">右侧</option></select></label>`;
    else html += number('scaleX', '横向缩放', 0.01, 0.01, 3, 1) + number('scaleY', '纵向缩放', 0.01, 0.01, 3, 1);
  } else {
    html = `<div class="opening-note wide">这个预设没有结构化字段，可在下方直接编辑 JSON。</div>`;
  }
  if (p.type === 'bubble' || (p.type === 'dialogue' && !['narration', 'anime'].includes(f.mode))) {
    const sfx = f.mode === 'sfx';
    html += number('shadowX', '阴影水平偏移', 1, -500, 500, sfx ? 30 : 12.5)
      + number('shadowY', '阴影垂直偏移', 1, -500, 500, sfx ? 30 : 12.5)
      + number('shadowAlpha', '阴影不透明度', 0.05, 0, 1, sfx ? 0.86 : 0.4)
      + `<label>阴影颜色<input type="color" data-field="shadowColor" value="${escapeHtml(f.shadowColor || (sfx ? '#1a1a1a' : '#000000'))}"></label>`;
  }
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-field]').forEach(el => {
    const key = el.dataset.field;
    if (el.tagName === 'SELECT') {
      if (f[key] != null) el.value = String(f[key]);
      else if (key === 'enter' || key === 'exit') el.value = 'default';
      else if (key === 'mode' && /独白|clear/i.test(`${p.name || ''} ${p.file || ''}`)) el.value = 'clear';
      el.addEventListener('change', () => { f[key] = ['purple', 'cinema'].includes(key) ? el.value === 'true' : el.value; $('presetDetails').value = JSON.stringify(p, null, 2); schedulePresetPreview(p); });
    } else {
      el.addEventListener('input', () => {
        f[key] = el.type === 'number' ? Number(el.value) : el.value;
        $('presetDetails').value = JSON.stringify(p, null, 2);
        schedulePresetPreview(p);
      });
    }
  });
}

function renderPresets() {
  const list = $('presetList');
  const visible = presets.filter(p => !['ui-bubble', 'ui-box', 'ui-text'].includes(p.type));
  if (!visible.length) {
    list.innerHTML = '<div class="empty">还没有预设</div>';
    $('presetFields').innerHTML = '';
    return;
  }
  list.innerHTML = visible.map(p => `<div class="preset-item${selectedPreset?.file === p.file ? ' active' : ''}" data-file="${escapeHtml(p.file)}">
    <b>${escapeHtml(p.name || p.file)}</b>
    <small>${escapeHtml(p.type || 'preset')}${p.description ? ' · ' + escapeHtml(p.description) : ''}</small>
  </div>`).join('');
  list.querySelectorAll('.preset-item').forEach(el => {
    el.addEventListener('click', () => {
      const p = presets.find(x => x.file === el.dataset.file);
      if (!p) return;
      selectedPreset = p;
      list.querySelectorAll('.preset-item').forEach(x => x.classList.toggle('active', x === el));
      $('presetFile').textContent = p.file;
      $('presetDetails').value = JSON.stringify(p, null, 2);
      renderPresetFields(p);
      switchInspector('preset');
      showPresetPreview(p);
    });
  });
}

async function loadPresets() {
  try {
    presets = await window.engine.listPresets(projectPath);
    renderPresets();
  } catch (e) {
    $('presetList').innerHTML = `<div class="empty">读取预设失败：${escapeHtml(e.message || e)}</div>`;
  }
}

async function loadAssets() {
  try {
    if (!$('assetList')) return;
    const assets = await window.engine.listAssets(projectPath);
    $('assetCount').textContent = String(assets.length);
    $('assetList').innerHTML = assets.map(a => `<div class="asset-line" title="${escapeHtml(a.path)}">${escapeHtml(a.path)} <span style="opacity:.45">${fmtBytes(a.size)}</span></div>`).join('');
  } catch (e) {
    $('assetList').textContent = '读取素材失败';
  }
}

let presetPreviewRequest = 0;
let presetPreviewUrl = null;
let presetPreviewTimer = 0;
function schedulePresetPreview(preset) {
  clearTimeout(presetPreviewTimer);
  presetPreviewTimer = setTimeout(() => {
    if (selectedPreset === preset) showPresetPreview(preset);
  }, 250);
}
async function showPresetPreview(preset) {
  const request = ++presetPreviewRequest;
  const empty = $('presetPreviewEmpty');
  const frame = $('presetPreviewFrame');
  const status = $('presetPreviewStatus');
  const supported = ['bubble', 'dialogue', 'typewriter', 'move', 'opening', 'location', 'transition', 'news', 'fullscreen'].includes(preset.type);
  if (!supported) {
    empty.textContent = '该预设暂不支持效果预览';
    empty.classList.remove('hidden');
    status.textContent = preset.name || preset.file;
    frame.src = 'about:blank';
    return;
  }
  empty.textContent = '正在加载预览…';
  empty.classList.remove('hidden');
  status.textContent = preset.name || preset.file;
  try {
    if (!presetPreviewUrl) presetPreviewUrl = await window.engine.presetPreviewUrl({ projectPath });
    if (request !== presetPreviewRequest) return;
    if (frame.src !== presetPreviewUrl) {
      await new Promise((resolve, reject) => {
        frame.onload = resolve;
        frame.onerror = () => reject(new Error('预览页面加载失败'));
        frame.src = presetPreviewUrl;
      });
    }
    const deadline = Date.now() + 15000;
    while (request === presetPreviewRequest && Date.now() < deadline) {
      const preview = frame.contentWindow?.__demo;
      if (preview && frame.contentWindow.__presetPreviewReady) {
        if (preset.type === 'move') {
          preview.showMovePreset(preset);
          empty.classList.add('hidden');
          return;
        }
        const fields = preset.fields || {};
        const name = `${preset.name || ''} ${preset.file || ''} ${preset.description || ''}`;
        const mode = preset.type === 'fullscreen' ? 'fullscreen' : preset.type === 'news' ? (fields.mode || 'newsTalk')
          : preset.type === 'transition' ? 'transition' : preset.type === 'opening' ? 'title' : preset.type === 'location' ? 'location' : preset.type === 'bubble'
          ? (preset.previewMode || (/思考|think/i.test(name) ? 'mangaThink' : 'manga'))
          : preset.type === 'typewriter' ? 'normal'
            : fields.mode || (/独白|clear/i.test(name) ? 'clear' : 'normal');
        const text = preset.type === 'typewriter' ? '雨停了，末班车到了。'
          : preset.type === 'bubble' && fields.overflow && fields.overflow !== 'grow'
            ? '雨夜里，末班车还没有到。我们继续等待，直到远处的灯光穿过雨幕。她望着空荡荡的站台，听见广播再次响起。' : '这是预设效果预览。';
        preview.showPreset({ ...fields, mode, text, previewOnly: mode === 'transition', title: '雨夜的末班车', chapterNo: 1, chapter: '第 1 话',
          speaker: ['narration', 'sfx', 'title', 'location', 'transition', 'newsSummary', 'newsTalk', 'fullscreen'].includes(mode) ? null : 'ner',
          speakerName: mode === 'newsTalk' ? '新闻主播' : ['newsSummary', 'fullscreen'].includes(mode) ? '' : '内尔',
          bubble: { x: 960, y: 470 }, head: { x: 580, y: 690 },
          stage: [], bg: mode === 'transition' ? 'bgElfCity' : null });
        empty.classList.add('hidden');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (request === presetPreviewRequest) throw new Error('预览加载超时');
  } catch (error) {
    if (request !== presetPreviewRequest) return;
    empty.textContent = '预览失败：' + (error.message || error);
    empty.classList.remove('hidden');
  }
}

function currentInsertText(text) {
  if (!editor) return;
  const pos = editor.getPosition();
  const range = new monaco.Range(pos.lineNumber, 1, pos.lineNumber, 1);
  editor.executeEdits('insert-spine', [{ range, text: text + '\n' }]);
  editor.focus();
  switchTab('code');
}


function stageLineLabel(line, i) {
  const mode = line.mode || '?';
  const no = String(i + 1).padStart(2, '0');
  if (line.mode === 'title') return `${no} · 开场 · 第 ${line.chapterNo} 话 ${line.title || ''}`;
  if (line.mode === 'location') return `${no} · 地点 · ${line.text || ''}`;
  if (line.mode === 'stage-sync') return `${no} · 状态更新`;
  const text = (line.text || '').replace(/\s+/g, ' ').slice(0, 22);
  return no + ' · ' + mode + (text ? ' · ' + text : '');
}

function setLineToken(sourceLine, key, value) {
  const lineNo = Math.max(1, Number(sourceLine) || 1);
  if (!model || lineNo > model.getLineCount()) return;
  let line = model.getLineContent(lineNo);
  if (key === 'at') {
    if (/\bat\s+-?[\d.]+,-?[\d.]+/.test(line)) line = line.replace(/\bat\s+-?[\d.]+,-?[\d.]+/, 'at ' + value);
    else line += ' at ' + value;
  } else {
    const re = new RegExp('\\b' + key + '\\s+[^\\s]+');
    if (re.test(line)) line = line.replace(re, key + ' ' + value);
    else line += ' ' + key + ' ' + value;
  }
  editor.executeEdits('stage-edit', [{
    range: new monaco.Range(lineNo, 1, lineNo, model.getLineContent(lineNo).length + 1),
    text: line,
  }]);
  editor.revealLineInCenter(lineNo);
  editor.setPosition({ lineNumber: lineNo, column: 1 });
}

function setUiShowOption(sourceLine, key, value) {
  const lineNo = Number(sourceLine);
  if (!model || lineNo < 1 || lineNo > model.getLineCount()) return false;
  const line = model.getLineContent(lineNo);
  let quoted = false, escaped = false, commentAt = line.length;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === '#' && !quoted) { commentAt = i; break; }
  }
  if (quoted) return false;
  let code = line.slice(0, commentAt);
  const comment = line.slice(commentAt);
  const tokens = [...code.matchAll(/"(?:[^"\\]|\\.)*"|[^\s"]+/g)];
  if (tokens.length < 4 || tokens[0][0] !== 'ui' || tokens[1][0] !== 'show') return false;
  for (let i = 4; i + 1 < tokens.length; i += 2) {
    if (tokens[i][0] === key) {
      const start = tokens[i].index;
      const end = tokens[i + 1].index + tokens[i + 1][0].length;
      code = code.slice(0, start) + code.slice(end);
      break;
    }
  }
  const replacement = code.trimEnd() + ' ' + key + ' ' + value + (comment ? ' ' + comment : '');
  editor.executeEdits('ui-object-edit', [{
    range: new monaco.Range(lineNo, 1, lineNo, line.length + 1),
    text: replacement,
  }]);
  return true;
}

function appendOrReplaceToken(rest, name, replacement) {
  const re = new RegExp('\\b' + name + '\\s+[^\\s]+');
  if (re.test(rest)) return rest.replace(re, replacement);
  return rest + ' ' + replacement;
}

function setOpeningField(sourceLine, key, value) {
  const lineNo = Math.max(1, Number(sourceLine) || 1);
  if (!model || lineNo > model.getLineCount()) return;
  const text = model.getLineContent(lineNo);
  const m = text.match(/^(\s*)opening\s+(\d+)\s+"((?:[^"\\]|\\.)*)"([\s\S]*)$/);
  if (!m) return;
  let chapter = m[2];
  let title = m[3];
  let rest = m[4] || '';
  if (key === 'chapter') {
    chapter = String(Math.max(1, Math.round(Number(value) || 1)));
  } else if (key === 'title') {
    title = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  } else if (key === 'hold') {
    rest = appendOrReplaceToken(rest, 'hold', `hold ${Math.max(0, Number(value) || 0)}`);
  } else if (key === 'cinema') {
    rest = appendOrReplaceToken(rest, 'cinema', `cinema ${value ? 'on' : 'off'}`);
  } else if (key === 'bg') {
    rest = appendOrReplaceToken(rest, 'bg', `bg ${String(value || '').trim() || 'black'}`);
  } else {
    rest = appendOrReplaceToken(rest, key, `${key} ${value}`);
  }
  const next = `${m[1]}opening ${chapter} "${title}"${rest}`;
  editor.executeEdits('opening-edit', [{
    range: new monaco.Range(lineNo, 1, lineNo, model.getLineContent(lineNo).length + 1),
    text: next,
  }]);
  editor.revealLineInCenter(lineNo);
  editor.setPosition({ lineNumber: lineNo, column: 1 });
}

function setLocationField(sourceLine, key, value) {
  const lineNo = Math.max(1, Number(sourceLine) || 1);
  if (!model || lineNo > model.getLineCount()) return;
  const text = model.getLineContent(lineNo);
  const m = text.match(/^(\s*)location\s+"((?:[^"\\]|\\.)*)"([\s\S]*)$/);
  if (!m) return;
  let name = m[2];
  let rest = m[3] || '';
  if (key === 'name') {
    name = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  } else if (key === 'hold') {
    rest = appendOrReplaceToken(rest, 'hold', `hold ${Math.max(0, Number(value) || 0)}`);
  } else {
    rest = appendOrReplaceToken(rest, key, `${key} ${value}`);
  }
  const next = `${m[1]}location "${name}"${rest}`;
  editor.executeEdits('location-edit', [{
    range: new monaco.Range(lineNo, 1, lineNo, model.getLineContent(lineNo).length + 1),
    text: next,
  }]);
  editor.revealLineInCenter(lineNo);
  editor.setPosition({ lineNumber: lineNo, column: 1 });
}


function renderStageFields(obj) {
  const wrap = $('stageFields');
  if (!wrap) return;
  if (!obj) { wrap.innerHTML = ''; return; }
  const line = lastStory.lines[stageLineIndex];
  const sourceLine = line.sourceLine;
  let fields = [];
  if (obj.kind === 'ui-opening') {
    fields = [
      { key: 'chapter', label: '章节数', type: 'number', step: 1, min: 1, value: line.chapterNo ?? '' },
      { key: 'title', label: '章节标题', type: 'text', value: line.title || '' },
      { key: 'hold', label: '停留（秒）', type: 'number', step: 0.1, min: 0, value: line.hold ?? '' },
      { key: 'bg', label: '开场背景', type: 'text', value: String(line.bg || '').replace(/^bg_/, '') || 'black' },
      { key: 'cinema', label: '电影边框', type: 'checkbox', value: line.cinema !== false },
    ];
  } else if (obj.kind === 'ui-location') {
    fields = [
      { key: 'name', label: '地点名称', type: 'text', value: line.text || '' },
      { key: 'hold', label: '停留（秒）', type: 'number', step: 0.1, min: 0, value: line.hold ?? '' },
    ];
  } else if (obj.kind === 'ui-box') {
    fields = [
      ['uiX', '对话框 X'], ['uiY', '对话框 Y'], ['uiScale', '对话框缩放'], ['uiRot', '对话框旋转'], ['uiOpacity', '对话框透明度'],
    ];
  } else if (obj.kind === 'ui-bubble') {
    fields = [
      ['bubbleWidth', '气泡宽度'], ['bubbleMinHeight', '最小高度'], ['bubbleMaxHeight', '最大高度'], ['bubblePaddingY', '上下内边距'], ['textWidth', '文字宽度'],
      ['textOffsetX', '文字 X'], ['textOffsetY', '文字 Y'],
    ];
  } else if (obj.kind === 'ui-typewriter') {
    fields = [['typeSpeed', '逐字速度'], ['textOffsetX', '文字 X'], ['textOffsetY', '文字 Y']];
  } else if (obj.kind === 'ui-object') {
    const node = obj.node;
    fields = [
      { key: 'x', label: '创建时 X', type: 'number', value: node.x },
      { key: 'y', label: '创建时 Y', type: 'number', value: node.y },
      { key: 'width', label: '宽度', type: 'number', min: 1, value: node.width },
      { key: 'height', label: '高度', type: 'number', min: 1, value: node.height },
      { key: 'sx', label: '横向缩放', type: 'number', value: node.sx ?? 1 },
      { key: 'sy', label: '纵向缩放', type: 'number', value: node.sy ?? 1 },
      { key: 'rot', label: '旋转', type: 'number', value: node.rot ?? 0 },
      { key: 'alpha', label: '透明度', type: 'number', min: 0, max: 1, value: node.alpha ?? 1 },
      { key: 'z', label: '层级 Z', type: 'number', value: node.z ?? 0 },
      { key: 'maxHeight', label: '最大高度', type: 'number', min: node.height, value: node.maxHeight ?? Math.max(1200, node.height) },
    ];
    if (node.kind === 'text') {
      fields.push({ key: 'fontSize', label: '字号', type: 'number', min: 1, value: node.fontSize },
        { key: 'speed', label: '速度倍率', type: 'number', min: 0.01, value: node.speed },
        { key: 'color', label: '文字颜色', type: 'color', value: node.color === 'white' ? '#ffffff' : node.color === 'black' ? '#000000' : (node.color || '#333333') },
        { key: 'overflow', label: '文字溢出', type: 'select', options: ['clip', 'grow'], value: node.overflow || 'clip' });
    } else {
      const styles = node.kind === 'bubble' ? ['manga', 'think', 'purple', 'thought'] : ['normal', 'purple', 'cloud', 'blast', 'monologue', 'monologueThought', 'narration', 'sfx'];
      fields.push({ key: 'style', label: '样式', type: 'select', options: styles, value: node.style },
        { key: 'paddingY', label: '增长留白', type: 'number', min: 0, value: node.paddingY ?? 80 });
      if (node.kind === 'bubble') fields.push({ key: 'tail', label: '尾巴', type: 'select', options: ['bl', 'br', 'tl', 'tr', 'none'], value: node.tail });
    }
  } else if (obj.kind === 'ui-operation') {
    wrap.innerHTML = '<div class="empty">独立 UI 的属性由当前语句设置。运行时对象状态会随实际分支变化。</div>';
    return;
  } else if (obj.kind === 'actor') {
    const actor = obj.actor;
    fields = [['x', 'X'], ['y', 'Y'], ['sx', '横向缩放'], ['sy', '纵向缩放'], ['rot', '旋转'], ['alpha', '透明度'], ['brightness', '亮度'], ['z', '层级 Z']];
  }
  if (fields.length && Array.isArray(fields[0])) {
    fields = fields.map(([key, label]) => {
      const fallback = ['uiScale', 'uiOpacity', 'sx', 'sy', 'alpha', 'brightness'].includes(key) ? 1 : 0;
      const value = obj.kind === 'actor' ? Number(obj.actor[key] ?? fallback) : Number(line[key] ?? fallback);
      return { key, label, type: 'number', step: 0.01, value };
    });
  }
  wrap.innerHTML = (obj.kind === 'ui-object' ? '<div class="opening-note wide">修改创建语句；后续 ui bind 的 offset 或 ui set 可覆盖这些值。</div>' : '') + fields.map(f => {
    if (f.type === 'checkbox') {
      return `<label class="inline-check"><input type="checkbox" data-stage-key="${f.key}" ${f.value ? 'checked' : ''}><span>${escapeHtml(f.label)}</span></label>`;
    }
    if (f.type === 'select') {
      return `<label>${escapeHtml(f.label)}<select data-stage-key="${f.key}">${f.options.map(option => `<option value="${escapeHtml(option)}"${option === f.value ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
    }
    if (f.type === 'color') return `<label>${escapeHtml(f.label)}<input type="color" data-stage-key="${f.key}" value="${escapeHtml(f.value)}"></label>`;
    const type = f.type === 'text' ? 'text' : 'number';
    const extras = type === 'number' ? ` step="${f.step ?? 0.01}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}` : '';
    return `<label>${escapeHtml(f.label)}<input type="${type}"${extras} data-stage-key="${f.key}" value="${escapeHtml(f.value)}"></label>`;
  }).join('');
  wrap.querySelectorAll('[data-stage-key]').forEach(el => el.addEventListener('change', async () => {
    const key = el.dataset.stageKey;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (obj.kind === 'ui-opening') {
      setOpeningField(sourceLine, key, value);
    } else if (obj.kind === 'ui-location') {
      setLocationField(sourceLine, key, value);
    } else if (obj.kind === 'ui-object') {
      if (el.type === 'number' && (!el.value.trim() || !el.checkValidity() || !Number.isFinite(Number(el.value)))) {
        setStatus('请输入有效的 UI 属性');
        return;
      }
      const node = obj.node;
      if (key === 'height' && node.maxHeight != null && Number(value) > node.maxHeight) {
        setStatus('高度不能超过最大高度，请先调整最大高度');
        return;
      }
      let updated;
      if (key === 'x' || key === 'y') {
        updated = setUiShowOption(sourceLine, 'at', `${key === 'x' ? value : node.x},${key === 'y' ? value : node.y}`);
      } else if (key === 'width' || key === 'height') {
        updated = setUiShowOption(sourceLine, 'size', `${key === 'width' ? value : node.width},${key === 'height' ? value : node.height}`);
      } else {
        const name = { fontSize: 'font', maxHeight: 'maxheight', paddingY: 'padding' }[key] || key;
        updated = setUiShowOption(sourceLine, name, key === 'color' ? JSON.stringify(value) : value);
      }
      if (!updated) { setStatus('无法修改当前 UI 创建语句，请检查源码'); return; }
    } else if (obj.kind === 'actor') {
      const actor = obj.actor;
      if (key === 'x' || key === 'y') {
        const x = key === 'x' ? Number(el.value) : Number(actor.x ?? 0);
        const y = key === 'y' ? Number(el.value) : Number(actor.y ?? 0);
        setLineToken(actor.sourceLine, 'at', x + ',' + y);
      } else {
        setLineToken(actor.sourceLine, key, el.value);
      }
    } else {
      setLineToken(sourceLine, key, el.value);
    }
    const result = await saveProject();
    if (result) lastStory = result.story || lastStory;
    if (obj.kind === 'ui-opening' || obj.kind === 'ui-location') {
      renderProjectDetails();
      switchInspector('stage');
    }
    renderStagePanel();
  }));
}

function toggleStageFlag(obj, flag) {
  if (!obj || obj.kind !== 'actor') return;
  const lineNo = Number(obj.actor.sourceLine) || 1;
  if (!model || lineNo > model.getLineCount()) return;
  let line = model.getLineContent(lineNo);
  const aliases = flag === 'hidden' ? ['hidden', 'hide'] : ['locked', 'lock'];
  const has = aliases.some(k => new RegExp('\\b' + k + '\\b').test(line));
  for (const k of aliases) line = line.replace(new RegExp('\\s+' + k + '\\b'), '');
  if (!has) line += ' ' + flag;
  editor.executeEdits('stage-flag', [{ range: new monaco.Range(lineNo, 1, lineNo, model.getLineContent(lineNo).length + 1), text: line }]);
  saveProject().then(result => { if (result) lastStory = result.story || lastStory; renderStagePanel(); });
}

let stageDragKey = null;
async function reorderStageActors(fromKey, toKey) {
  if (!lastStory || fromKey === toKey) return;
  const line = lastStory.lines[stageLineIndex];
  const list = (line.stage || []).slice();
  const from = list.findIndex(a => ('actor:' + a.id) === fromKey);
  const to = list.findIndex(a => ('actor:' + a.id) === toKey);
  if (from < 0 || to < 0) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  for (let i = 0; i < list.length; i++) setLineToken(list[i].sourceLine, 'z', i * 10);
  const result = await saveProject();
  if (result) lastStory = result.story || lastStory;
  renderStagePanel();
}

function renderTimelinePanel() {
  if (!lastStory) return;
  const select = $('timelineLineSelect');
  const tracks = $('timelineTracks');
  if (!select || !tracks) return;
  const lines = lastStory.lines.map((l, i) => ({ line: l, i })).filter(({ line }) =>
    (line.actions || []).length || (line.cameraTracks || []).length || (line.effectTracks || []).length ||
    (line.events || []).length || line.dialogueDelay > 0 || line.timelineEnd > 0);
  if (!lines.length) {
    select.innerHTML = '';
    tracks.innerHTML = '<div class="timeline-empty">当前剧本没有时间线内容</div>';
    $('timelineRange').textContent = '—';
    return;
  }
  if (!lines.some(x => x.i === timelineLineIndex)) timelineLineIndex = lines[0].i;
  select.innerHTML = lines.map(x => `<option value="${x.i}">${escapeHtml(stageLineLabel(x.line, x.i))}</option>`).join('');
  select.value = String(timelineLineIndex);
  const line = lastStory.lines[timelineLineIndex];
  const actions = [
    ...(line.actions || []).map(action => ({ ...action, label: (action.targetKind === 'ui' ? 'UI · ' : '') + action.actor + ' · ' + action.property })),
    ...(line.cameraTracks || []).map(action => ({ ...action, label: '镜头 · ' + action.property })),
    ...(line.effectTracks || []).map(action => ({ ...action, label: '效果 · ' + action.property })),
    ...(line.events || []).map(event => ({
      delay: event.delay,
      duration: event.type === 'scene' ? Number(event.scene.transition?.duration) || 0 : 0,
      event: true,
      label: event.type === 'camera' ? '镜头设置' : event.type === 'effect' ? '效果设置'
        : event.type === 'scene' ? (event.scene.transition ? '背景渐变' : '背景切换') : event.type === 'actor' ? '角色 · ' + event.actor
          : event.type === 'ui' ? 'UI · ' + (event.operation.id || event.operation.node?.id || '')
          : event.type === 'audio' ? '音频 · ' + event.command.alias
            : event.type === 'oneshot' ? '一次性表情 · ' + (event.oneShot?.anim || '') : event.type,
      text: event.type === 'scene' ? `${event.scene.bg || '黑屏'}${event.scene.transition ? ` · ${event.scene.transition.duration}s ${event.scene.transition.ease}` : ''}` :
        event.type === 'ui' ? event.operation.type :
        event.type === 'audio' ? event.command.action : event.type === 'actor' ? Object.values(event.patch).join(' ') :
          event.type === 'oneshot' ? `${event.oneShot?.anim || ''} · ${event.oneShot?.spineFile || ''}` :
          Object.entries(event.patch || {}).map(([key, value]) => key + ' ' + value).join(' '),
    })),
  ];
  if (line.dialogueDelay > 0) actions.push({ label: '台词出现', text: '台词', delay: line.dialogueDelay, duration: 0, event: true });
  const max = Math.max(0.1, Number(line.timelineEnd) || 0, Number(line.dialogueDelay) || 0,
    ...actions.map(a => (Number(a.delay) || 0) + (Number(a.duration) || 0)));
  $('timelineRange').textContent = max.toFixed(2) + 's';
  const groups = new Map();
  for (const a of [...actions].sort((x, y) => (Number(x.delay) || 0) - (Number(y.delay) || 0))) {
    const label = a.label;
    const start = Number(a.delay) || 0;
    const end = start + (Number(a.duration) || 0);
    if (!groups.has(label)) groups.set(label, []);
    const lanes = groups.get(label);
    let lane = lanes.find(item => item.end <= start + 1e-6);
    if (!lane) {
      lane = { end: 0, actions: [] };
      lanes.push(lane);
    }
    lane.actions.push(a);
    lane.end = Math.max(lane.end, end);
  }
  const rows = [];
  for (const [label, lanes] of groups) {
    lanes.forEach((lane, laneIndex) => {
      const suffix = laneIndex ? ' #' + (laneIndex + 1) : '';
      rows.push(`<div class="timeline-row"><div class="timeline-label" title="${escapeHtml(label)}">${escapeHtml(label + suffix)}</div><div class="timeline-lane">${lane.actions.map(a => {
        const left = (Number(a.delay) || 0) / max * 100;
        const width = Math.max(2, (Number(a.duration) || 0) / max * 100);
        const text = a.event ? a.text : a.relative ? ('by ' + a.to) : (a.from + '→' + a.to);
        const position = a.event ? Math.min(98, left) : left;
        return `<div class="timeline-bar ${a.relative ? 'relative' : ''} ${a.event ? 'event' : ''}" style="left:${position}%;width:${width}%" title="${escapeHtml(text + ' · ' + (a.delay || 0) + 's · 持续 ' + (a.duration || 0) + 's · ' + (a.ease || ''))}">${escapeHtml(text)}</div>`;
      }).join('')}</div></div>`);
    });
  }
  tracks.innerHTML = rows.length ? rows.join('') : '<div class="timeline-empty">等待 ' + max.toFixed(2) + ' 秒</div>';
}
function renderStagePanel() {
  if (!lastStory || !lastStory.lines || !lastStory.lines.length) return;
  stageLineIndex = Math.max(0, Math.min(lastStory.lines.length - 1, stageLineIndex));
  const line = lastStory.lines[stageLineIndex];
  const select = $('stageLineSelect');
  const objects = $('stageObjects');
  if (!select || !objects) return;
  if (stageOptionsStory !== lastStory) {
    select.innerHTML = lastStory.lines.map((l, i) => `<option value="${i}">${escapeHtml(stageLineLabel(l, i))}</option>`).join('');
    stageOptionsStory = lastStory;
  }
  select.value = String(stageLineIndex);
  $('stageLineName').textContent = line.mode === 'stage-sync' ? '状态更新' : (line.mode || '—');
  const list = [];
  if (line.mode === 'title') {
    list.push({ key: 'ui:opening', kind: 'ui-opening', label: '开场 · 章节标题 / 停留 / 电影边框', sourceLine: line.sourceLine });
  } else if (line.mode === 'location') {
    list.push({ key: 'ui:location', kind: 'ui-location', label: '地点展示 · 名称 / 停留', sourceLine: line.sourceLine });
  } else if (line.mode === 'ui-op') {
    const op = line.operation || {};
    const id = op.id || op.node?.id || '';
    const kind = op.type === 'create' ? 'ui-object' : 'ui-operation';
    list.push({ key: 'ui:operation', kind, node: op.node, label: 'UI · ' + (op.type || '操作') + (id ? ' · ' + id : ''), sourceLine: line.sourceLine });
  } else if (line.mode === 'ui-present') {
    list.push({ key: 'ui:operation', kind: 'ui-operation', label: 'UI · 等待推进', sourceLine: line.sourceLine });
  } else if (!['end', 'jump', 'stage-sync'].includes(line.mode)) {
    list.push({ key: 'ui:box', kind: 'ui-box', label: '当前对话 · 框体', sourceLine: line.sourceLine });
    if (['manga', 'mangaThink', 'cloud', 'normal'].includes(line.mode)) list.push({ key: 'ui:bubble', kind: 'ui-bubble', label: '当前对话 · 气泡', sourceLine: line.sourceLine });
    list.push({ key: 'ui:typewriter', kind: 'ui-typewriter', label: '当前对话 · 逐字效果', sourceLine: line.sourceLine });
  }
  for (const actor of line.stage || []) list.push({ key: 'actor:' + actor.id, kind: 'actor', label: actor.id + ' · ' + (actor.kind === 'image' ? '图片' : 'Spine'), actor, sourceLine: actor.sourceLine });
  if (!list.some(o => o.key === stageObjectKey)) stageObjectKey = list[0] ? list[0].key : '';
  objects.innerHTML = list.map(o => `<div class="stage-object ${o.key === stageObjectKey ? 'active' : ''}" data-key="${escapeHtml(o.key)}" draggable="${o.kind === 'actor' ? 'true' : 'false'}"><span class="kind">${o.kind.startsWith('ui') ? 'UI' : (o.actor.kind === 'image' ? 'IMG' : 'SPINE')}</span><span class="stage-object-label">${escapeHtml(o.label)}</span>${o.kind === 'actor' ? `<button class="stage-flag ${o.actor.hidden ? 'on' : ''}" data-flag="hidden" type="button">${o.actor.hidden ? '已隐' : '显示'}</button><button class="stage-flag ${o.actor.locked ? 'on' : ''}" data-flag="locked" type="button">${o.actor.locked ? '已锁' : '锁定'}</button>` : ''}</div>`).join('');
  objects.querySelectorAll('.stage-object').forEach(row => row.addEventListener('click', (e) => {
    const flagBtn = e.target.closest('.stage-flag');
    if (flagBtn) {
      e.stopPropagation();
      const obj = list.find(o => o.key === row.dataset.key);
      toggleStageFlag(obj, flagBtn.dataset.flag);
      return;
    }
    stageObjectKey = row.dataset.key;
    renderStagePanel();
  }));
  objects.querySelectorAll('.stage-object[draggable="true"]').forEach(row => {
    row.addEventListener('dragstart', (e) => { stageDragKey = row.dataset.key; e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', (e) => { if (stageDragKey) e.preventDefault(); });
    row.addEventListener('drop', (e) => { e.preventDefault(); reorderStageActors(stageDragKey, row.dataset.key); stageDragKey = null; });
    row.addEventListener('dragend', () => { stageDragKey = null; });
  });
  const selected = list.find(o => o.key === stageObjectKey);
  renderStageFields(selected);
}

function renderSpinePanel() {
  const manifest = projectData?.manifest || {};
  const catalog = manifest.spineCatalog || {};
  const assets = Object.keys(catalog);
  const assetSel = $('spineAsset');
  const targetSel = $('spineTarget');
  const skinSel = $('spineSkin');
  const animSel = $('spineAnim');
  if (!assetSel || !targetSel || !skinSel || !animSel) return;
  assetSel.innerHTML = assets.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  const targets = Object.keys(manifest.cast || {});
  targetSel.innerHTML = targets.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('') + '<option value="__oneshot">一次性演出</option>';
  const sync = () => {
    const data = catalog[assetSel.value] || {};
    skinSel.innerHTML = (data.skins || ['default']).map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    animSel.innerHTML = (data.animations || []).map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    if (assetSel.value === 'emoticon') targetSel.value = '__oneshot';
  };
  assetSel.onchange = sync;
  sync();
  $('insertSpineSkin').onclick = () => {
    if (targetSel.value === '__oneshot') {
      setStatus('一次性 Spine 皮肤：请在 oneshot 语句里加 skin ' + skinSel.value);
      return;
    }
    currentInsertText(`skin ${targetSel.value} ${skinSel.value}`);
    setStatus('已插入皮肤代码');
  };
  $('insertSpineAnim').onclick = () => {
    if (targetSel.value === '__oneshot' || assetSel.value === 'emoticon') {
      currentInsertText(`oneshot spine ${assetSel.value} anim ${animSel.value} at 960,600 scale 1 skin ${skinSel.value}`);
    } else {
      currentInsertText(`anim ${targetSel.value} ${animSel.value} fade 0.25`);
    }
    setStatus('已插入动作代码');
  };
}

async function initMonaco() {
  await new Promise((resolve) => {
    if (window.monaco) { resolve(); return; }
    require.config({ paths: { vs: '/monaco/vs' } });
    require(['vs/editor/editor.main'], () => resolve());
  });
  monaco = window.monaco;
  registerLanguage(monaco);
  monaco.editor.defineTheme('trickcal-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: '69766c', fontStyle: 'italic' },
      { token: 'string', foreground: 'd9c58e' },
      { token: 'keyword', foreground: 'b9d88a', fontStyle: 'bold' },
      { token: 'type', foreground: '8fb8d8' },
      { token: 'number', foreground: 'd8a67b' },
      { token: 'tag', foreground: 'd8b66d' },
    ],
    colors: {
      'editor.background': '#0b0f12',
      'editor.foreground': '#d8d2c5',
      'editorLineNumber.foreground': '#4d5751',
      'editorLineNumber.activeForeground': '#b9d88a',
      'editorCursor.foreground': '#d8b66d',
      'editor.selectionBackground': '#294033',
      'editor.lineHighlightBackground': '#10171b',
    },
  });
  editor = monaco.editor.create($('editor'), {
    value: projectData.source,
    language: 'trickcal',
    theme: 'trickcal-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 23,
    fontFamily: '"Cascadia Code","Consolas","Microsoft YaHei",monospace',
    padding: { top: 14, bottom: 18 },
    scrollBeyondLastLine: false,
    colorDecorators: true,
    renderLineHighlight: 'all',
    wordWrap: 'off',
    tabSize: 2,
  });
  model = editor.getModel();
  editor.onDidChangeModelContent(scheduleCompile);
  editor.onDidChangeCursorPosition((e) => {
    $('cursorPos').textContent = `行 ${e.position.lineNumber}, 列 ${e.position.column}`;
    if (lastStory) {
      const hit = findStageLine(lastStory, e.position.lineNumber);
      if (hit >= 0 && hit !== stageLineIndex) { stageLineIndex = hit; if ($('stagePanel')?.classList.contains('active')) renderStagePanel(); }
    }
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveProject());
  $('editorLoading').classList.add('hidden');
  await compileNow({ showStatus: false });
}

async function boot() {
  if (!projectPath) {
    document.body.innerHTML = '<div style="padding:40px;color:#eee;font:14px sans-serif">缺少项目路径。请从启动器打开项目。</div>';
    return;
  }
  try {
    projectData = await window.engine.readProject(projectPath);
    $('projectTitle').textContent = projectData.manifest.title || '未命名项目';
    $('projectPath').textContent = projectPath;
    document.title = `${projectData.manifest.title || '未命名项目'} · Trickcal 剧情编辑器`;
    renderProjectDetails();
    await loadPresets();
    renderSpinePanel();
    await initMonaco();
    renderStagePanel();
    renderTimelinePanel();
    if (query.get('autoPreview') === '1') await runPreview();
    if (query.get('autoBuild') === '1') await buildProject();
  } catch (e) {
    $('editorLoading').innerHTML = `<div style="padding:24px;color:#e18b7a;font-size:12px;line-height:1.8">项目加载失败<br>${escapeHtml(e.message || e)}</div>`;
  }
}

$('timelineLineSelect').addEventListener('change', (e) => { timelineLineIndex = Number(e.target.value) || 0; renderTimelinePanel(); });
$('chapterBadge').addEventListener('click', () => {
  switchInspector('details');
  setTimeout(() => { const el = $('openingChapter'); if (el) { el.focus(); el.select(); } }, 20);
});
$('timelinePreview').addEventListener('click', () => {
  const frame = $('previewFrame');
  const demo = frame && frame.contentWindow && frame.contentWindow.__demo;
  if (!demo || !demo.STORY?.length || !demo.state.started || previewSource !== model.getValue()) { runPreview(timelineLineIndex); return; }
  if (demo.seek(timelineLineIndex, 0, { replay: true }) === false) return;
  demo.state.readyAt = performance.now() + 1e9;
  switchTab('preview'); setStatus('已载入时间轴第 ' + (timelineLineIndex + 1) + ' 段');
});
$('stagePrev').addEventListener('click', () => { stageLineIndex = Math.max(0, stageLineIndex - 1); renderStagePanel(); });
$('stageNext').addEventListener('click', () => { if (lastStory) stageLineIndex = Math.min(lastStory.lines.length - 1, stageLineIndex + 1); renderStagePanel(); });
$('stageLineSelect').addEventListener('change', (e) => { stageLineIndex = Number(e.target.value) || 0; renderStagePanel(); });
$('stagePreview').addEventListener('click', () => {
  const frame = $('previewFrame');
  const demo = frame && frame.contentWindow && frame.contentWindow.__demo;
  if (!demo || !demo.STORY?.length || !demo.state.started || previewSource !== model.getValue()) { runPreview(stageLineIndex); return; }
  if (demo.seek(stageLineIndex, 0, { replay: true }) === false) return;
  demo.state.readyAt = performance.now() + 1e9;
  switchTab('preview');
  setStatus('已载入舞台第 ' + (stageLineIndex + 1) + ' 段');
});
$('saveBtn').addEventListener('click', saveProject);
$('checkBtn').addEventListener('click', () => compileNow());
$('runBtn').addEventListener('click', () => runPreview());
$('stopBtn').addEventListener('click', stopPreview);
$('buildBtn').addEventListener('click', buildProject);
$('buildClose').addEventListener('click', () => $('buildModal').classList.add('hidden'));
$('buildDone').addEventListener('click', () => $('buildModal').classList.add('hidden'));
$('openBuildFolder').addEventListener('click', () => { if (lastBuildOut) window.engine.openPath(lastBuildOut); });
$('folderBtn').addEventListener('click', () => window.engine.openPath(projectPath));
$('vscodeBtn').addEventListener('click', () => window.engine.openVSCode(projectPath));
$('helpBtn').addEventListener('click', () => window.engine.openHelp().catch(e => setStatus('手册打开失败：' + (e.message || e))));
$('presetReplay').addEventListener('click', () => { if (selectedPreset) showPresetPreview(selectedPreset); });
$('addPreset').addEventListener('click', async () => {
  const name = prompt('预设名称（例如：我的普通对话框）');
  if (!name) return;
  const type = prompt('预设类型（dialogue / bubble / typewriter / move）', 'dialogue') || 'dialogue';
  if (['ui-bubble', 'ui-box', 'ui-text'].includes(type)) {
    setStatus('不再创建独立 UI 预设');
    return;
  }
  const data = { name, type, description: '', fields: {} };
  try {
    await window.engine.writePreset({ projectPath, file: name + '.json', data });
    await loadPresets();
  } catch (e) { alert(e.message || String(e)); }
});
$('applyPreset').addEventListener('click', () => {
  if (!selectedPreset || !editor) return;
  const name = selectedPreset.name || selectedPreset.file.replace(/\.json$/i, '');
  const pos = editor.getPosition();
  const range = new monaco.Range(pos.lineNumber, 1, pos.lineNumber, 1);
  const indent = editor.getModel().getLineContent(pos.lineNumber).match(/^\s*/)[0];
  const params = [...$('presetFields').querySelectorAll('[data-field]')]
    .filter(el => el.dataset.field !== 'mode')
    .map(el => `${el.dataset.field} ${el.type === 'color' ? JSON.stringify(el.value) : el.value}`).join(' ');
  let statement = `preset ${JSON.stringify(name)}${params ? ' ' + params : ''}`;
  if (selectedPreset.type === 'move') {
    const source = editor.getModel().getValue();
    const actor = [...source.matchAll(/^\s*define\s+([A-Za-z_][\w-]*)\s*=\s*Spine\(/gm)][0]?.[1];
    if (!actor) { setStatus('请先声明并显示角色，再插入动作预设'); return; }
    statement = `move ${actor} preset ${JSON.stringify(name)}${params ? ' ' + params : ''}`;
    let parentIndent = indent.length;
    let inParallel = false;
    for (let n = pos.lineNumber - 1; n >= 1; n--) {
      const line = editor.getModel().getLineContent(n);
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const depth = line.match(/^\s*/)[0].length;
      if (depth >= parentIndent) continue;
      if (/^\s*(?:parallel|同时):\s*$/.test(line)) { inParallel = true; break; }
      if (!/^\s*after\s+.+:\s*$/.test(line)) break;
      parentIndent = depth;
    }
    if (!inParallel) statement = `parallel:\n${indent}  ${statement}`;
  }
  const text = indent + statement + '\n';
  editor.executeEdits('insert-preset', [{ range, text }]);
  editor.focus();
  switchTab('code');
  setStatus('已插入预设：' + name);
});
$('savePreset').addEventListener('click', async () => {
  if (!selectedPreset) return;
  try {
    const data = JSON.parse($('presetDetails').value);
    await window.engine.writePreset({ projectPath, file: selectedPreset.file, data });
    await loadPresets();
    setStatus('预设已保存');
  } catch (e) { alert('预设 JSON 无效：' + (e.message || e)); }
});
$('deletePreset').addEventListener('click', async () => {
  if (!selectedPreset) return;
  if (!confirm(`删除预设「${selectedPreset.name || selectedPreset.file}」？`)) return;
  try {
    await window.engine.deletePreset({ projectPath, file: selectedPreset.file });
    selectedPreset = null;
    $('presetDetails').value = '选择一个预设查看';
    $('presetFile').textContent = '';
    await loadPresets();
  } catch (e) { alert(e.message || String(e)); }
});
window.addEventListener('message', (e) => {
  if (e.source !== $('previewFrame').contentWindow || e.origin !== location.origin) return;
  if (e.data && e.data.type === 'trickcal:end') {
    $('previewState').textContent = '已结束';
    setStatus('预览结束');
  } else if (e.data && e.data.type === 'trickcal:warning') {
    const line = Number(e.data.line) || 1;
    const message = '运行时警告：' + String(e.data.message || '未知效果问题');
    if (!diagnostics.some(item => item.line === line && item.severity === 'warning' && item.message === message)) {
      diagnostics = [...diagnostics, { line, column: 1, severity: 'warning', message }];
      setMarkers();
    }
    $('previewState').textContent = '有预览警告';
    setStatus('预览效果存在警告，剧情仍可继续');
  } else if (e.data && e.data.type === 'trickcal:error') {
    diagnostics = [...diagnostics, { line: Number(e.data.line) || 1, column: 1, severity: 'error', message: '运行时：' + String(e.data.message || '未知错误') }];
    setMarkers();
    $('previewState').textContent = '运行错误';
    setStatus('预览运行出错');
    switchInspector('diagnostics');
  }
});
window.addEventListener('beforeunload', (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

boot();

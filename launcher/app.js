'use strict';

const $ = (id) => document.getElementById(id);
let boot = null;

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function showError(message) {
  const el = $('newError');
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError() { $('newError').classList.add('hidden'); }

async function loadRecent() {
  if (!boot) boot = await window.engine.bootstrap();
  $('version').textContent = 'v' + boot.version;
  const list = $('recentList');
  const projects = boot.recent || [];
  if (!projects.length) {
    list.innerHTML = '<div class="empty-recent">还没有项目。点击「新建项目」创建第一个剧情工程。</div>';
    return;
  }
  list.innerHTML = projects.map(p => `
    <button class="recent-card" data-path="${escapeAttr(p.path)}" type="button">
      <div class="rc-title">${p.chapterNo != null ? `第 ${p.chapterNo} 话 · ` : ''}${escapeHtml(p.title || '未命名项目')}</div>
      <div class="rc-path">${escapeHtml(p.path)}</div>
      <div class="rc-time">最近打开 · ${fmtTime(p.updatedAt)}</div>
    </button>`).join('');
  list.querySelectorAll('.recent-card').forEach(card => {
    card.addEventListener('click', async () => {
      try { await window.engine.openProject(card.dataset.path); } catch (e) { alert(e.message || String(e)); }
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

function openModal() {
  hideError();
  $('projectTitle').value = '雨夜的末班车';
  $('projectChapter').value = '1';
  $('projectFolder').value = '雨夜的末班车';
  $('projectParent').value = boot?.projectsDir || '';
  $('modal').classList.remove('hidden');
  setTimeout(() => $('projectTitle').focus(), 30);
}
function closeModal() { $('modal').classList.add('hidden'); }

$('newProject').addEventListener('click', openModal);
$('helpBtn').addEventListener('click', () => window.engine.openHelp().catch(e => alert(e.message || String(e))));
$('modalClose').addEventListener('click', closeModal);
$('cancelNew').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
$('refreshRecent').addEventListener('click', loadRecent);

$('chooseParent').addEventListener('click', async () => {
  const dir = await window.engine.chooseDirectory();
  if (dir) $('projectParent').value = dir;
});

$('projectTitle').addEventListener('input', () => {
  if ($('projectFolder').dataset.auto !== '0') $('projectFolder').value = $('projectTitle').value;
});
$('projectFolder').addEventListener('input', () => { $('projectFolder').dataset.auto = '0'; });

$('newForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const parentDir = $('projectParent').value.trim();
  const folderName = $('projectFolder').value.trim();
  const title = $('projectTitle').value.trim();
  const chapterNo = Number($('projectChapter').value);
  if (!parentDir) { showError('请选择项目位置。'); return; }
  if (!folderName) { showError('请填写文件夹名称。'); return; }
  if (!title) { showError('请填写作品标题。'); return; }
  if (!Number.isInteger(chapterNo) || chapterNo < 1 || chapterNo > 999) { showError('章节数必须是 1–999 的整数。'); return; }
  const btn = $('confirmNew');
  btn.disabled = true;
  btn.textContent = '创建中…';
  try {
    await window.engine.createProject({ parentDir, folderName, title, chapterNo });
    closeModal();
    await loadRecent();
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = '创建并打开';
  }
});

$('openProject').addEventListener('click', async () => {
  try { await window.engine.chooseAndOpen(); await loadRecent(); } catch (e) { if (e.message) alert(e.message); }
});

$('previewProject').addEventListener('click', async () => {
  try {
    const res = await window.engine.chooseAndOpen({ autoPreview: true });
    if (res) await loadRecent();
  } catch (e) { if (e.message) alert(e.message); }
});

$('buildProject').addEventListener('click', async () => {
  try {
    const res = await window.engine.chooseAndOpen({ autoBuild: true });
    if (res) await loadRecent();
  } catch (e) { if (e.message) alert(e.message); }
});

loadRecent().catch(err => {
  const list = $('recentList');
  if (list) list.innerHTML = `<div class="empty-recent">无法读取最近项目：${escapeHtml(err.message || err)}</div>`;
});

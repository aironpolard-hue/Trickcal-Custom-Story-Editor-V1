'use strict';

(() => {
  const pages = window.TRICKCAL_MANUAL;
  const $ = id => document.getElementById(id);
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
  let currentPage;
  let observer;
  let toastTimer;
  const searchIndex = pages.map(page => {
    const container = document.createElement('div');
    container.innerHTML = page.body;
    return { page, text: `${page.title} ${page.description} ${page.keywords || ''} ${container.textContent}`.replace(/\s+/g, ' ') };
  });
  const icons = () => window.lucide?.createIcons();

  function showToast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
  }

  function setMenu(open) {
    $('sidebar').classList.toggle('open', open);
    $('scrim').hidden = !open;
    $('menuButton').setAttribute('aria-expanded', String(open));
    $('menuButton').setAttribute('aria-label', open ? '关闭目录' : '打开目录');
    document.body.classList.toggle('menu-open', open);
  }

  function renderNavigation() {
    const query = $('search').value.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    $('searchStatus').hidden = !query;
    if (query) {
      const results = searchIndex.filter(item => tokens.every(token => item.text.toLowerCase().includes(token)));
      $('searchStatus').textContent = `找到 ${results.length} 个相关章节`;
      $('navigation').innerHTML = results.length ? results.map(({ page, text }) => {
        const index = text.toLowerCase().indexOf(tokens[0]);
        const excerpt = `${index > 24 ? '…' : ''}${text.slice(Math.max(0, index - 24), Math.max(0, index - 24) + 100)}…`;
        return `<a class="nav-link search-result" href="#${page.id}"${currentPage?.id === page.id ? ' aria-current="page"' : ''}>${escape(page.title)}<small>${escape(excerpt)}</small></a>`;
      }).join('') : '<p class="no-results">没有找到相关内容。试试“角色”“parallel”“导出”或“找不到素材”。</p>';
    } else {
      const groups = [...new Set(pages.map(page => page.group))];
      const groupIcons = ['flag', 'clapperboard', 'book-open', 'layers', 'package', 'wrench'];
      $('navigation').innerHTML = groups.map((group, index) => `<div class="nav-group"><div class="nav-label"><i data-lucide="${groupIcons[index] || 'book-open'}" aria-hidden="true"></i>${escape(group)}</div>${pages.filter(page => page.group === group).map(page => `<a class="nav-link" href="#${page.id}"${currentPage?.id === page.id ? ' aria-current="page"' : ''}><span class="nav-number">${String(pages.indexOf(page) + 1).padStart(2, '0')}</span><span>${escape(page.title)}</span></a>`).join('')}</div>`).join('');
    }
    icons();
  }

  function highlightCode(source) {
    return source.split('\n').map(line => {
      const tokens = /("(?:[^"\\]|\\.)*"|#[^\n]*|\b(?:define|image|Spine|default|set|if|else|scene|bg|show|hide|spawn|as|at|face|pose|anim|skin|preset|opening|location|news|narration|sfx|fullscreen|transition|parallel|after|say|move|by|in|ease|wait|camera|effect|shader|audio|play|stop|loop|bind|to|offset|unbind|oneshot|choice|label|jump|end|normal|cloud|blast|manga|think|clear|clearRe|anime|hold|true|false)\b|\b\d+(?:\.\d+)?(?:ms|s)?\b)/g;
      let result = '', offset = 0;
      for (const match of line.matchAll(tokens)) {
        result += escape(line.slice(offset, match.index));
        const token = match[0];
        const kind = token.startsWith('"') ? 'string' : token.startsWith('#') ? 'comment' : /^\d/.test(token) ? 'number' : 'keyword';
        result += `<span class="token-${kind}">${escape(token)}</span>`;
        offset = match.index + token.length;
      }
      return result + escape(line.slice(offset));
    }).join('\n');
  }

  function renderPage() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    const [pageId, section] = hash.split('/');
    currentPage = pages.find(page => page.id === pageId) || pages[0];
    if (pageId !== currentPage.id) history.replaceState(null, '', `#${currentPage.id}`);
    document.title = `${currentPage.title} · Trickcal 使用手册`;
    $('breadcrumb').textContent = currentPage.group;
    const plain = searchIndex.find(item => item.page === currentPage).text;
    const minutes = Math.max(2, Math.ceil(plain.length / 650));
    $('article').innerHTML = `<div class="article-meta"><span class="category">${escape(currentPage.group)}</span><span class="separator"></span><span>约 ${minutes} 分钟</span><span>源码版 0.1.0</span></div><h1>${escape(currentPage.title)}</h1><p class="lead">${escape(currentPage.description)}</p><div class="article-divider"></div>${currentPage.body}`;
    $('article').querySelectorAll('pre code').forEach(code => {
      if (code.closest('.code-block').dataset.language === 'trickcal') code.innerHTML = highlightCode(code.textContent);
    });
    const headings = [...$('article').querySelectorAll('h2')];
    headings.forEach((heading, i) => {
      heading.id = `section-${i + 1}`;
      const anchor = document.createElement('a');
      anchor.href = `#${currentPage.id}/${heading.id}`;
      anchor.className = 'heading-link';
      anchor.setAttribute('aria-label', `链接到${heading.textContent}`);
      anchor.textContent = '#';
      heading.append(anchor);
    });
    $('outline').innerHTML = headings.map(heading => `<a href="#${currentPage.id}/${heading.id}" data-section="${heading.id}">${escape(heading.firstChild.textContent)}</a>`).join('');
    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        $('outline').querySelectorAll('a').forEach(link => link.classList.toggle('active', link.dataset.section === entry.target.id));
      }
    }, { rootMargin: '-70px 0px -65% 0px' });
    headings.forEach(heading => observer.observe(heading));
    const index = pages.indexOf(currentPage);
    const previous = pages[index - 1], next = pages[index + 1];
    $('pagination').innerHTML = (previous ? `<a href="#${previous.id}"><i data-lucide="arrow-left"></i><span><small>上一章</small>${escape(previous.title)}</span></a>` : '') + (next ? `<a class="next" href="#${next.id}"><span><small>下一章</small>${escape(next.title)}</span><i data-lucide="arrow-right"></i></a>` : '');
    renderNavigation();
    icons();
    setMenu(false);
    if (section && document.getElementById(section)) document.getElementById(section).scrollIntoView();
    else window.scrollTo(0, 0);
    $('article').focus({ preventScroll: true });
  }

  async function copyCode(button) {
    const text = button.closest('.code-block').querySelector('code').textContent;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;left:-10000px;top:0';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      button.focus();
      if (!copied) { showToast('复制未成功，请选中代码后按 Ctrl+C'); return; }
    }
    showToast('代码已复制');
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('themeButton').innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    icons();
  }
  let savedTheme;
  try { savedTheme = localStorage.getItem('trickcal-manual-theme'); } catch {}
  applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
  $('themeButton').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('trickcal-manual-theme', next); } catch {}
  });
  $('search').addEventListener('input', renderNavigation);
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('article').focus({ preventScroll: true });
    $('article').scrollIntoView();
  });
  $('search').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('navigation').querySelector('a')?.click();
    if (event.key === 'Escape') { $('search').value = ''; renderNavigation(); }
  });
  $('navigation').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if ($('search').value) { $('search').value = ''; renderNavigation(); }
    if (link.hash === location.hash) setMenu(false);
  });
  $('menuButton').addEventListener('click', () => setMenu(!$('sidebar').classList.contains('open')));
  $('scrim').addEventListener('click', () => setMenu(false));
  $('printButton').addEventListener('click', () => window.print());
  $('backTop').addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('article').addEventListener('click', event => {
    const copy = event.target.closest('.copy-code');
    if (copy) void copyCode(copy);
    if (event.target.closest('.figure-button')) $('imageDialog').showModal();
  });
  $('closeImage').addEventListener('click', () => $('imageDialog').close());
  $('imageDialog').addEventListener('click', event => {
    if (event.target === $('imageDialog')) $('imageDialog').close();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (matchMedia('(max-width: 800px)').matches) setMenu(true);
      $('search').focus();
    }
    if (event.key === 'Escape') setMenu(false);
  });
  window.addEventListener('hashchange', renderPage);
  renderPage();
})();

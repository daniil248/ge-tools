// =========================================================================
// help/help.js — v0.59.796
// Центр помощи Raschet. Загружает articles.json + рендерит навигацию по
// категориям, статьи (HTML-фрагменты из help/articles/*), cross-references
// и breadcrumb.
//
// Доступ к статьям: каждая статья может иметь requiresModule. Если модуль
// disabled в modules.json — статья скрыта (аналогично доступу к модулям).
// =========================================================================

const $ = (id) => document.getElementById(id);

let _manifest = null;
let _modulesEnabled = new Set();
let _currentArticleId = null;

async function loadManifest() {
  const r = await fetch('articles.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('articles.json не загружен (HTTP ' + r.status + ')');
  return r.json();
}

async function loadModulesEnabled() {
  try {
    const r = await fetch('../modules.json', { cache: 'no-store' });
    if (!r.ok) return new Set();
    const m = await r.json();
    return new Set((m.modules || []).filter(x => x.enabled).map(x => x.id));
  } catch { return new Set(); }
}

function articleAccessible(a) {
  if (!a.requiresModule) return true;
  return _modulesEnabled.has(a.requiresModule);
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─── Render TOC (sidebar)
function renderTOC(filter) {
  const root = $('hc-toc');
  if (!root || !_manifest) return;
  const q = (filter || '').toLowerCase().trim();
  const cats = (_manifest.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const html = cats.map(cat => {
    const articles = (_manifest.articles || [])
      .filter(a => a.category === cat.id)
      .filter(articleAccessible)
      .filter(a => !q || (a.title || '').toLowerCase().includes(q) || (a.summary || '').toLowerCase().includes(q));
    if (articles.length === 0 && q) return '';
    return `<div class="hc-cat">
      <div class="hc-cat-head">${escHtml(cat.icon || '')} ${escHtml(cat.name)}</div>
      <ul class="hc-cat-articles">
        ${articles.map(a => `<li class="hc-toc-item${a.id === _currentArticleId ? ' active' : ''}" data-article-id="${escHtml(a.id)}">
          <a href="#${escHtml(a.id)}">${escHtml(a.title)}</a>
        </li>`).join('')}
      </ul>
    </div>`;
  }).filter(Boolean).join('');
  root.innerHTML = html || '<div class="muted hc-no-results">Нет статей по запросу.</div>';
}

// ─── Render category cards (empty state)
function renderCategoryCards() {
  const root = $('hc-cat-cards');
  if (!root || !_manifest) return;
  const cats = (_manifest.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  root.innerHTML = cats.map(cat => {
    const articles = (_manifest.articles || []).filter(a => a.category === cat.id).filter(articleAccessible);
    return `<div class="hc-cat-card">
      <h3>${escHtml(cat.icon || '')} ${escHtml(cat.name)}</h3>
      <ul>${articles.slice(0, 6).map(a => `<li><a href="#${escHtml(a.id)}">${escHtml(a.title)}</a></li>`).join('')}</ul>
      ${articles.length > 6 ? `<div class="muted">+ ещё ${articles.length - 6}</div>` : ''}
    </div>`;
  }).join('');
}

// ─── Render single article
async function renderArticle(id) {
  const a = (_manifest?.articles || []).find(x => x.id === id);
  if (!a) {
    $('hc-article').innerHTML = `<div class="hc-empty"><h1>Статья не найдена</h1><p>Идентификатор: <code>${escHtml(id)}</code></p></div>`;
    $('hc-breadcrumb').innerHTML = '';
    $('hc-related').hidden = true;
    return;
  }
  if (!articleAccessible(a)) {
    $('hc-article').innerHTML = `<div class="hc-empty">
      <h1>Доступ ограничен</h1>
      <p>Статья «${escHtml(a.title)}» требует модуль <code>${escHtml(a.requiresModule)}</code>, который не подключён в этом окружении.</p>
      <p><a href="#intro">← К началу</a></p>
    </div>`;
    return;
  }
  // Breadcrumb
  const cat = (_manifest.categories || []).find(c => c.id === a.category);
  $('hc-breadcrumb').innerHTML = `<a href="#">Помощь</a> · <span>${escHtml(cat?.name || '')}</span> · <span>${escHtml(a.title)}</span>`;
  // Fetch HTML content
  let html = '';
  try {
    const r = await fetch('articles/' + a.file, { cache: 'no-store' });
    if (r.ok) html = await r.text();
    else html = `<div class="hc-warn">Не удалось загрузить файл articles/${escHtml(a.file)} (HTTP ${r.status})</div>`;
  } catch (e) { html = `<div class="hc-warn">Ошибка: ${escHtml(e.message || e)}</div>`; }
  $('hc-article').innerHTML = `<h1>${escHtml(a.title)}</h1>
    ${a.summary ? `<p class="hc-summary">${escHtml(a.summary)}</p>` : ''}
    <div class="hc-body">${html}</div>`;
  // Wire internal cross-refs (data-article-link)
  $('hc-article').querySelectorAll('a[data-article-link]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.articleLink);
    });
  });
  // Related
  const related = (a.related || []).map(rid => _manifest.articles.find(x => x.id === rid)).filter(Boolean).filter(articleAccessible);
  const relPane = $('hc-related');
  const relList = $('hc-related-list');
  if (related.length === 0) {
    relPane.hidden = true;
  } else {
    relPane.hidden = false;
    relList.innerHTML = related.map(r => `<a class="hc-related-card" href="#${escHtml(r.id)}">
      <div class="hc-related-title">${escHtml(r.title)}</div>
      <div class="hc-related-summary muted">${escHtml(r.summary || '')}</div>
    </a>`).join('');
  }
  _currentArticleId = id;
  renderTOC($('hc-search').value);
}

function navigateTo(id) {
  if (!id) return;
  location.hash = '#' + id;
}

function handleHashChange() {
  const id = (location.hash || '').replace(/^#/, '').trim();
  if (!id) {
    $('hc-article').innerHTML = `<div class="hc-empty">
      <h1>Центр помощи Raschet</h1>
      <p>Выберите статью слева или категорию ниже.</p>
      <div id="hc-cat-cards" class="hc-cat-cards"></div>
    </div>`;
    renderCategoryCards();
    $('hc-breadcrumb').innerHTML = '';
    $('hc-related').hidden = true;
    _currentArticleId = null;
    renderTOC($('hc-search').value);
    return;
  }
  renderArticle(id);
}

async function init() {
  try {
    [_manifest, _modulesEnabled] = await Promise.all([loadManifest(), loadModulesEnabled()]);
  } catch (e) {
    $('hc-article').innerHTML = `<div class="hc-warn">Ошибка инициализации: ${escHtml(e.message || e)}</div>`;
    return;
  }
  renderTOC('');
  renderCategoryCards();
  // Sidebar clicks (delegated, since TOC re-renders on filter)
  $('hc-toc').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    navigateTo(a.getAttribute('href').replace(/^#/, ''));
  });
  // Search
  $('hc-search').addEventListener('input', () => {
    renderTOC($('hc-search').value);
  });
  // Hash routing
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

document.addEventListener('DOMContentLoaded', init);

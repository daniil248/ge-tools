// =============================================================================
// sketch/library-store.js — управление библиотеками фигур (seed/user/org).
// =============================================================================
// Drawio-like подход: пользователь может видеть встроенные seed-библиотеки,
// клонировать их в user/org, создавать с нуля, импортировать и экспортировать
// в JSON. Каждая библиотека — отдельный файл с группой фигур.
//
// Аналог: drawio.io «Edit Custom Libraries» + «File → Import».
//
// Storage:
//   • SEED — built-in (sketch/shape-library.js, in-code).
//   • USER — LS key 'raschet.sketch.libraries.user.v1' (массив).
//   • ORG — LS key 'raschet.sketch.libraries.org.v1' (массив).
//   • Visibility (какие категории показывать) — LS 'raschet.sketch.lib-visibility.v1'.
//
// Library shape:
//   {
//     id: 'lib-...',                  // уникальный
//     scope: 'seed' | 'user' | 'org',
//     name: 'Моя сетевая библиотека',
//     icon: '🌐',                      // эмодзи в палитре
//     shapes: [
//       { id: 'srv-1', label: 'Веб-сервер', render: '<rect ... />', defaultW: 80, defaultH: 110 }
//     ],
//     createdAt: 1234567890,
//     promotedFrom: 'lib-user-...',   // если promoted в org
//   }
// =============================================================================

import { SHAPE_LIBRARY } from './shape-library.js';

const LS_USER = 'raschet.sketch.libraries.user.v1';
const LS_ORG  = 'raschet.sketch.libraries.org.v1';
const LS_VIS  = 'raschet.sketch.lib-visibility.v1';

let _userLibs = null;
let _orgLibs = null;
let _visibility = null;

function _loadLs(key, def) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
}
function _saveLs(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/** Преобразует встроенный SHAPE_LIBRARY в формат библиотек. */
function _seedLibraries() {
  return Object.entries(SHAPE_LIBRARY).map(([catId, cat]) => {
    const labelParts = cat.label.split(' ');
    const icon = labelParts[0] || '📐';
    const name = labelParts.slice(1).join(' ') || catId;
    return {
      id: 'lib-seed-' + catId,
      scope: 'seed',
      name,
      icon,
      shapes: cat.shapes.map(s => ({
        id: s.id,
        label: s.label,
        // Render is function (cannot serialize) — для seed храним as-is.
        render: s.render,
        defaultW: s.defaults?.w || 100,
        defaultH: s.defaults?.h || 80,
      })),
    };
  });
}

function _ensureUserLoaded() {
  if (!_userLibs) _userLibs = _loadLs(LS_USER, []) || [];
  return _userLibs;
}
function _ensureOrgLoaded() {
  if (!_orgLibs) _orgLibs = _loadLs(LS_ORG, []) || [];
  return _orgLibs;
}
function _ensureVisLoaded() {
  if (!_visibility) {
    _visibility = _loadLs(LS_VIS, null);
    if (!_visibility) {
      // По умолчанию все seed видимы.
      _visibility = {};
      for (const lib of _seedLibraries()) _visibility[lib.id] = true;
    }
  }
  return _visibility;
}

/** Список всех библиотек: seed + user + org. */
export function listAllLibraries() {
  return [..._seedLibraries(), ..._ensureUserLoaded(), ..._ensureOrgLoaded()];
}

/** Список ВИДИМЫХ библиотек (с учётом toggle'ов). */
export function listVisibleLibraries() {
  const vis = _ensureVisLoaded();
  return listAllLibraries().filter(lib => vis[lib.id] !== false);
}

/** Получить библиотеку по id. */
export function getLibrary(libId) {
  return listAllLibraries().find(l => l.id === libId) || null;
}

/** Установить visibility библиотеки (true/false). */
export function setLibraryVisibility(libId, visible) {
  const vis = _ensureVisLoaded();
  vis[libId] = !!visible;
  _saveLs(LS_VIS, vis);
}
export function isLibraryVisible(libId) {
  const vis = _ensureVisLoaded();
  return vis[libId] !== false;
}

/** Добавить пользовательскую библиотеку. */
export function addUserLibrary(name, icon = '📦', shapes = []) {
  _ensureUserLoaded();
  const lib = {
    id: 'lib-user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    scope: 'user',
    name: String(name).trim() || 'Без имени',
    icon,
    shapes: Array.isArray(shapes) ? shapes : [],
    createdAt: Date.now(),
  };
  _userLibs.push(lib);
  _saveLs(LS_USER, _userLibs);
  // Авто-видима
  setLibraryVisibility(lib.id, true);
  return lib;
}

/** Обновить пользовательскую библиотеку. */
export function updateUserLibrary(libId, patch) {
  _ensureUserLoaded();
  const lib = _userLibs.find(l => l.id === libId);
  if (!lib) return null;
  Object.assign(lib, patch);
  _saveLs(LS_USER, _userLibs);
  return lib;
}

/** Удалить пользовательскую библиотеку. */
export function deleteUserLibrary(libId) {
  _ensureUserLoaded();
  const before = _userLibs.length;
  _userLibs = _userLibs.filter(l => l.id !== libId);
  _saveLs(LS_USER, _userLibs);
  return _userLibs.length < before;
}

/** Клонировать seed (или любую) библиотеку как пользовательскую — открывает
 *  возможность модификации. Render-функции сериализуются как svg-strings (через
 *  pre-render с условными w=100, h=100 — если seed). */
export function cloneLibraryToUser(srcLibId, newName) {
  const src = getLibrary(srcLibId);
  if (!src) return null;
  const shapes = src.shapes.map(s => {
    let render = s.render;
    // Если render — функция (seed), вызываем для w=100, h=100 — получаем строку.
    // При render новой пользовательской фигуры используется этот snapshot
    // (без масштабирования внутренних координат). TODO в будущем: переписать в
    // template-based render для proper scaling.
    let renderTemplate = render;
    if (typeof render === 'function') {
      renderTemplate = render(100, 100);  // snapshot at 100×100
    }
    return {
      id: s.id + '-copy',
      label: s.label,
      render: renderTemplate,
      defaultW: s.defaultW || s.defaults?.w || 100,
      defaultH: s.defaultH || s.defaults?.h || 80,
      // 'snapshot' marker: при render масштабируется через viewBox + transform
      _isSnapshot: true,
    };
  });
  const name = newName || (src.name + ' (копия)');
  return addUserLibrary(name, src.icon || '📦', shapes);
}

/** Promote user library → org. */
export function promoteUserToOrg(libId) {
  _ensureUserLoaded();
  _ensureOrgLoaded();
  const userLib = _userLibs.find(l => l.id === libId);
  if (!userLib) return null;
  const orgLib = {
    ...userLib,
    id: 'lib-org-' + libId.replace(/^lib-(user|seed)-/, ''),
    scope: 'org',
    promotedFrom: libId,
    promotedAt: Date.now(),
  };
  _orgLibs.push(orgLib);
  _saveLs(LS_ORG, _orgLibs);
  setLibraryVisibility(orgLib.id, true);
  return orgLib;
}

/** Demote org library → user (только для авторизованных). */
export function demoteOrgToUser(libId) {
  _ensureOrgLoaded();
  _ensureUserLoaded();
  const orgLib = _orgLibs.find(l => l.id === libId);
  if (!orgLib) return null;
  const userLib = {
    ...orgLib,
    id: 'lib-user-' + libId.replace(/^lib-(org|seed)-/, ''),
    scope: 'user',
    demotedFrom: libId,
    demotedAt: Date.now(),
  };
  _userLibs.push(userLib);
  _saveLs(LS_USER, _userLibs);
  // Удаляем org-копию
  _orgLibs = _orgLibs.filter(l => l.id !== libId);
  _saveLs(LS_ORG, _orgLibs);
  setLibraryVisibility(userLib.id, true);
  return userLib;
}

/** Удалить org-библиотеку. */
export function deleteOrgLibrary(libId) {
  _ensureOrgLoaded();
  const before = _orgLibs.length;
  _orgLibs = _orgLibs.filter(l => l.id !== libId);
  _saveLs(LS_ORG, _orgLibs);
  return _orgLibs.length < before;
}

/** Добавить фигуру в user-библиотеку. */
export function addShapeToLibrary(libId, shape) {
  _ensureUserLoaded();
  const lib = _userLibs.find(l => l.id === libId);
  if (!lib) return null;
  if (!Array.isArray(lib.shapes)) lib.shapes = [];
  const newShape = {
    id: shape.id || ('sh-' + Date.now().toString(36)),
    label: shape.label || 'Без имени',
    render: shape.render || '<rect width="100" height="60"/>',
    defaultW: shape.defaultW || 100,
    defaultH: shape.defaultH || 60,
    _isSnapshot: true,
  };
  lib.shapes.push(newShape);
  _saveLs(LS_USER, _userLibs);
  return newShape;
}

/** Удалить фигуру из user-библиотеки. */
export function removeShapeFromLibrary(libId, shapeId) {
  _ensureUserLoaded();
  const lib = _userLibs.find(l => l.id === libId);
  if (!lib || !Array.isArray(lib.shapes)) return false;
  const before = lib.shapes.length;
  lib.shapes = lib.shapes.filter(s => s.id !== shapeId);
  _saveLs(LS_USER, _userLibs);
  return lib.shapes.length < before;
}

/** Экспорт одной библиотеки в JSON-объект (для скачивания). */
export function exportLibrary(libId) {
  const lib = getLibrary(libId);
  if (!lib) return null;
  // Сериализуем (render может быть функцией для seed — преобразуем в snapshot).
  const shapes = lib.shapes.map(s => {
    let render = s.render;
    if (typeof render === 'function') render = render(100, 100);
    return {
      id: s.id,
      label: s.label,
      render,
      defaultW: s.defaultW || s.defaults?.w || 100,
      defaultH: s.defaultH || s.defaults?.h || 80,
      _isSnapshot: true,
    };
  });
  return {
    formatVersion: '1.0',
    type: 'raschet-sketch-library',
    name: lib.name,
    icon: lib.icon || '📦',
    scope: lib.scope,
    exportedAt: new Date().toISOString(),
    shapes,
  };
}

/** Импорт библиотеки из JSON (от файла). Создаёт user-библиотеку. */
export function importLibrary(json) {
  if (!json || typeof json !== 'object') throw new Error('Invalid JSON');
  if (json.type !== 'raschet-sketch-library') throw new Error('Не библиотека Raschet Sketch');
  if (!Array.isArray(json.shapes)) throw new Error('shapes должен быть массивом');
  const shapes = json.shapes.map(s => ({
    id: s.id || ('sh-' + Date.now().toString(36)),
    label: s.label || 'Без имени',
    render: s.render || '<rect width="100" height="60"/>',
    defaultW: Number(s.defaultW) || 100,
    defaultH: Number(s.defaultH) || 60,
    _isSnapshot: true,
  }));
  return addUserLibrary(json.name || 'Импорт', json.icon || '📦', shapes);
}

// =============================================================================
// shared/history-log.js — история загруженных данных + soft-delete (trash)
// =============================================================================
// Phase 35 (по требованию Пользователя 2026-05-03: «любые загруженные данные
// должны сохранятся в истории»).
//
// Append-only лог per-project. Каждое событие импорта/обновления/удаления
// сохраняется как запись с метаданными:
//   { id, ts, module, action, itemKind, itemId, itemName, payload?, ... }
//
// Soft-delete: action='delete' помещает запись в Корзину; данные сохраняются
// в payload для возможности restore. action='restore' возвращает данные.
// Permanent delete возможен только из корзины (action='purge').
//
// Storage: IDB (приоритет) с fallback на LS. Per-project через pid namespace.
//
// API:
//   await historyAppend(pid, { module, action, itemKind, itemId, itemName, payload })
//   await historyList(pid, { module?, kind?, includeRestored?, since? })
//   await historyTrash(pid, { module? })  → активные в корзине (delete без restore/purge)
//   await historyRestore(pid, eventId)    → восстанавливает + добавляет 'restore' event
//   await historyPurge(pid, eventId)      → permanent delete (action='purge')
//   await historyClear(pid)               → wipe ВСЕЙ истории (с подтверждением в UI)
//
// События действий (action):
//   'import'   — данные импортированы (payload = снимок)
//   'update'   — данные обновлены (payload = новый снимок, opt. prev?)
//   'delete'   — soft-delete (payload = снимок, чтобы можно было восстановить)
//   'restore'  — восстановлен из корзины
//   'purge'    — permanent delete (payload очищается)
//
// Item kinds (itemKind, для группировки в UI):
//   'meteo-dataset' | 'datasheet' | 'price-list-1c' | 'bom-import' |
//   'rack-import'  | 'cable-import' | 'work-template' | 'order'    | ...

import { idbGet, idbSet, idbAvailable } from './idb-store.js';
import { projectKey } from './project-storage.js';

const LS_FALLBACK_SUFFIX = ['history', 'log.v1'];
const IDB_PREFIX = 'history.';

function lsKey(pid) {
  return projectKey(pid, ...LS_FALLBACK_SUFFIX);
}

function idbKey(pid) {
  return `${IDB_PREFIX}${pid}`;
}

async function loadLog(pid) {
  if (!pid) return [];
  // IDB priority
  if (idbAvailable()) {
    try {
      const data = await idbGet(idbKey(pid), null);
      if (Array.isArray(data)) return data;
    } catch {}
  }
  // LS fallback
  try {
    const raw = localStorage.getItem(lsKey(pid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLog(pid, events) {
  if (!pid) return;
  // Try IDB first (история может быть большой при долгой работе).
  if (idbAvailable()) {
    try {
      await idbSet(idbKey(pid), events);
      // Удаляем LS-копию если успешно записали в IDB
      try { localStorage.removeItem(lsKey(pid)); } catch {}
      return;
    } catch (e) {
      console.warn('[history-log] IDB save failed, fallback to LS:', e);
    }
  }
  try {
    localStorage.setItem(lsKey(pid), JSON.stringify(events));
  } catch (e) {
    console.error('[history-log] LS save failed:', e);
  }
}

function genId() {
  return 'h-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Записать событие в историю. Безопасный (никогда не throws): если запись
 * не удалась — просто warn в console, чтобы не сломать основной flow.
 *
 * @param {string} pid
 * @param {object} ev — { module, action, itemKind, itemId, itemName, payload?, source? }
 * @returns {Promise<{id:string}|null>}
 */
export async function historyAppend(pid, ev) {
  if (!pid) return null;
  if (!ev || !ev.module || !ev.action) {
    console.warn('[history-log] invalid event (no module/action):', ev);
    return null;
  }
  try {
    const events = await loadLog(pid);
    const entry = {
      id: genId(),
      ts: Date.now(),
      module: ev.module,
      action: ev.action,                  // import / update / delete / restore / purge
      itemKind: ev.itemKind || null,      // 'meteo-dataset' / 'datasheet' / ...
      itemId: ev.itemId || null,
      itemName: ev.itemName || '',
      payload: ev.payload ?? null,
      source: ev.source || null,          // 'open-meteo' / 'xlsx' / 'manual' / ...
      restoredFrom: ev.restoredFrom || null,
      purged: false,
    };
    events.push(entry);
    await saveLog(pid, events);
    return { id: entry.id };
  } catch (e) {
    console.warn('[history-log] append failed:', e);
    return null;
  }
}

/**
 * Список ВСЕХ событий (включая удалённые/восстановленные/purge).
 * @param {object} [filter] — { module?, kind?, since? (ms timestamp) }
 */
export async function historyList(pid, filter = {}) {
  const events = await loadLog(pid);
  return events.filter(ev => {
    if (filter.module && ev.module !== filter.module) return false;
    if (filter.kind && ev.itemKind !== filter.kind) return false;
    if (filter.since && ev.ts < filter.since) return false;
    return true;
  });
}

/**
 * Корзина: записи с action='delete' для которых нет последующего 'restore'
 * или 'purge' (т.е. сейчас в Trash, можно восстановить).
 */
export async function historyTrash(pid, filter = {}) {
  const events = await loadLog(pid);
  // Группируем по itemKind+itemId; смотрим последнее событие.
  const byItem = new Map();
  for (const ev of events) {
    if (filter.module && ev.module !== filter.module) continue;
    if (!ev.itemKind || !ev.itemId) continue;
    const key = `${ev.itemKind}::${ev.itemId}`;
    byItem.set(key, ev);
  }
  return Array.from(byItem.values()).filter(ev => ev.action === 'delete' && !ev.purged);
}

/**
 * Восстановить из корзины. Возвращает payload удалённой записи + добавляет
 * событие 'restore'. Caller сам пишет данные обратно в свой store
 * (history-log не знает, как именно хранятся данные модуля).
 */
export async function historyRestore(pid, eventId) {
  const events = await loadLog(pid);
  const idx = events.findIndex(e => e.id === eventId);
  if (idx < 0) return { ok: false, error: 'Событие не найдено' };
  const original = events[idx];
  if (original.action !== 'delete') return { ok: false, error: 'Событие не является удалением' };
  if (original.purged) return { ok: false, error: 'Запись уже permanent-deleted' };

  // Append 'restore' event
  events.push({
    id: genId(),
    ts: Date.now(),
    module: original.module,
    action: 'restore',
    itemKind: original.itemKind,
    itemId: original.itemId,
    itemName: original.itemName,
    payload: original.payload,
    source: original.source,
    restoredFrom: original.id,
    purged: false,
  });
  await saveLog(pid, events);
  return { ok: true, payload: original.payload, itemKind: original.itemKind, itemId: original.itemId, itemName: original.itemName };
}

/**
 * Permanent delete. Помечает событие purged=true и обнуляет payload
 * (освобождая место). Восстановить уже нельзя.
 */
export async function historyPurge(pid, eventId) {
  const events = await loadLog(pid);
  const ev = events.find(e => e.id === eventId);
  if (!ev) return { ok: false, error: 'Событие не найдено' };
  if (ev.action !== 'delete') return { ok: false, error: 'Можно purge только delete-событий' };
  ev.purged = true;
  ev.payload = null;
  // Append 'purge' event для аудита
  events.push({
    id: genId(),
    ts: Date.now(),
    module: ev.module,
    action: 'purge',
    itemKind: ev.itemKind,
    itemId: ev.itemId,
    itemName: ev.itemName,
    payload: null,
    source: ev.source,
    restoredFrom: ev.id,
    purged: false,
  });
  await saveLog(pid, events);
  return { ok: true };
}

/** Полная очистка истории проекта (UI должен запросить двойное подтверждение). */
export async function historyClear(pid) {
  await saveLog(pid, []);
  return { ok: true };
}

/** Размер истории в байтах (приблизительно). Используется в storage-analytics. */
export async function historySize(pid) {
  const events = await loadLog(pid);
  try { return JSON.stringify(events).length; }
  catch { return 0; }
}

/** Кол-во событий по action. */
export async function historyStats(pid) {
  const events = await loadLog(pid);
  const stats = { total: events.length, byAction: {}, byModule: {}, byKind: {} };
  for (const ev of events) {
    stats.byAction[ev.action] = (stats.byAction[ev.action] || 0) + 1;
    stats.byModule[ev.module] = (stats.byModule[ev.module] || 0) + 1;
    if (ev.itemKind) stats.byKind[ev.itemKind] = (stats.byKind[ev.itemKind] || 0) + 1;
  }
  return stats;
}

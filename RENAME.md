# RENAME — плейбук безболезненного переименования продукта

Цель: переименовать продукт/репозиторий **без потери данных пользователей
и без сломанного деплоя**. Архитектура уже подготовлена — переименование
сведено к нескольким контролируемым точкам.

---

## Почему это уже почти безболезненно

- **Пути кода развязаны.** Импорты — bare-спецификаторы через importmap
  + document-relative адреса (`ARCHITECTURE.md §0`). Переезд/переименование
  папки сайта НЕ ломает импорты. Абсолютных URL вида
  `https://<host>/<repo>/` в продакшн-коде НЕТ (только относительные).
- **LS-неймспейс централизован.** Корень — ОДНА константа
  `APP_NS` в `shared/project-storage.js`. Все построители ключей
  (`projectKey`, project/sketch-префиксы, copy/scan, import/export,
  clear) идут через неё. Подавляющая часть данных пользователя
  переезжает сменой одной строки + миграцией.

---

## Точки, которые нужно тронуть при переименовании

### 1. Имя репозитория / URL деплоя (GitHub Pages)
- Продакшн-код **относителен** — не требует правок.
- `functions/index.js`: `APP_URL` уже `process.env.APP_URL || '<fallback>'`.
  Задать env `APP_URL` для новой площадки; fallback-литерал обновить
  заодно (не критично — env побеждает).
- Косметика (комментарии/changelog/README с упоминанием хоста) — по
  желанию, на работу не влияет.

### 2. LS-неймспейс `APP_NS` (КЛЮЧЕВОЕ — данные пользователей)
- Сменить `export const APP_NS = 'raschet'` в
  `shared/project-storage.js` на новое имя.
- **Обязательна одноразовая LS-миграция** старый→новый префикс, иначе
  пользователи «потеряют» проекты (ключи не найдутся). Рекомендуемая
  форма: при старте приложения, если есть ключи `oldNS.*` и нет
  `newNS.*` — скопировать `oldNS.<rest>` → `newNS.<rest>` для всех
  ключей, пометить флаг `<newNS>.migratedFrom.<oldNS>` чтобы не
  повторять. Idempotent, без удаления старых (rollback-safe; чистку
  старых — отдельной поздней версией).
- Места, где `raschet.*` ещё литералом (R2-долг, мигрирует в
  `projectKey()` инкрементально по плану Фаза 2): пока их не все
  перевели — миграция по префиксу всё равно перенесёт их данные, т.к.
  она работает по строковому префиксу LS, а не по коду.

### 3. Schema-ID экспортного JSON — НЕ переименовывать
- `schema: 'raschet.project/1'` в `exportProject`/`importProject` —
  **стабильный wire-format**, намеренно НЕ через `APP_NS`. Его смена
  сломает импорт ранее экспортированных пользователями файлов.
  Оставить как есть; при необходимости — принимать И старый, И новый
  идентификатор в `importProject`.

### 4. Видимые названия (UI/титулы/манифесты)
- `index.html`/`hub.html`/`login.html` `<title>`, `manifest.json`
  (PWA name), модульные `manifest.json` `name`, шапки отчётов
  (`shared/report/*`). Это контент, не контракт — менять свободно,
  поиском по отображаемому названию.

---

## Чек-лист рейнейма

1. `APP_NS` ← новое имя (1 строка) + добавить idempotent LS-миграцию
   старый→новый префикс (раздел 2).
2. `APP_URL` env на новой площадке (+ fallback-литерал в
   `functions/index.js`).
3. Schema-ID НЕ трогать; при желании — расширить `importProject`
   принимать оба ID.
4. Видимые названия (раздел 4) — заменить по тексту.
5. Verify: `projectKey` даёт ключи с новым префиксом; старый проект
   из LS открывается после миграции; экспорт старой версии
   импортируется; деплой жив (curl `APP_VERSION`); console-clean.
6. Через ≥2 версии после стабилизации — отдельной задачей чистка
   старых `oldNS.*` ключей.

> Принцип: переименование = смена `APP_NS` + миграция + env-URL +
> видимые названия. Контракты (schema-id, относительные пути) НЕ
> трогаются — этим и обеспечивается безболезненность.

---

## Переезд репозитория (ОТЛОЖЕН — нет доступа к Settings)

Состояние на v0.60.745:
- ✅ **Сделано (бренд, независимо от имени репо):** продукт =
  Genesis Engineering Tools (GE Tools); `APP_NS='getools'` +
  идемпотентная LS-миграция; видимые названия/титулы/доки.
- ⏸ **Отложено (нужен доступ владельца к GitHub):** фактическое
  переименование репо `daniil248/raschet` → `daniil248/ge-tools`.
  Slug решён: **`ge-tools`**, целевой live-URL
  `https://daniil248.github.io/ge-tools/`.
- URL/slug-литералы в коде НАМЕРЕННО оставлены на рабочем
  `/raschet/` (иначе на живом сайте битые GitHub-ссылки и
  functions-fallback).

**Применить ЕДИНЫМ коммитом, когда появится доступ:**
1. GitHub: Settings репо → Repository name → `ge-tools` → Rename.
2. Локально: `git remote set-url origin
   git@github.com:daniil248/ge-tools.git` (git GitHub редиректит,
   но обновить чисто).
3. Заменить `raschet`→`ge-tools` (slug) ТОЛЬКО в URL/ссылках:
   - `functions/index.js` — `APP_URL` fallback `/raschet/`→`/ge-tools/`.
   - `apps/pdu-config/index.html` — `github.com/daniil248/raschet`.
   - `changelog.html` — `…/raschet/commits/main`.
   - `roadmap.html` — `…/raschet/blob/main/ROADMAP.md`.
   - `CLAUDE.md` — verify-URL; `CONTRIBUTING.md` curl-пример;
     `FUNCTIONS_SETUP.md`; `README.md` Pages-инструкция (×2).
   - НЕ трогать: `ROADMAP-archive.md` (заморожен),
     `.claude/settings.local.json` (локальный конфиг), schema-id
     `raschet.project/1`, код-литералы `raschet.*` (R2-долг,
     переносит APP_NS-миграция).
4. Cloud Functions (если используются для писем):
   `firebase functions:config:set
   app.url="https://daniil248.github.io/ge-tools/"` →
   `firebase deploy --only functions`.
5. Firebase Auth: домен тот же `daniil248.github.io` (путь не
   влияет на Authorized domains) — обычно правок не требуется.
6. Verify: curl `…/ge-tools/js/engine/constants.js` = APP_VERSION;
   старый `…/raschet/` Pages больше не обслуживается (норма).

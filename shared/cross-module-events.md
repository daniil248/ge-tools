# Raschet — Кросс-модульные события (контракт)

> Спецификация v1 (2026-05-16). Только `window`-DOM-CustomEvent.
> Один из 5 разрешённых каналов общения (см. `contracts/README.md` §4).
> Каждый модуль объявляет emits/consumes в `manifest.json
> .dependsOnContracts.events`; CI Фазы 1 сверяет с этой таблицей.
> Внутри-DOM `change`/`input`/`submit`/`resize` на элементах — НЕ
> контрактные (локальная механика форм), здесь не перечисляются.

## 1. Подбор / выбор (selection-model) — основной канал
| Событие | detail | Эмиттер | Потребители |
|---|---|---|---|
| `rs-selection-change` | `{ kind, selectionName }` | `shared/config-sidebar.js`, `shared/selection-panel.js`, `<cfg>-config` (ups…) | модуль-конфигуратор (переключить активный подбор) |
| `rs-cs-focus` | `{ kind, scope:'selection'\|'variant', selectionName, entryId? }` | `selection-panel.js`, `config-sidebar.js`, ups-config | модуль (показать подбор/вариант в панели) |
| `rs-cs-context` | `{ kind, projectCode }` | `config-sidebar.js` (смена «контекст подбора» проект↔разовый) | модуль (перепривязать `api.setProjectCode`) |
| `rs-cs-reqwizard` | `{ kind, selectionName, … }` | `selection-panel.js` | модуль (открыть мастер/wizard для подбора) |
| `<module>:open-master` (напр. `ups:open-master`) | `{ kind, selectionName }` | панель/кнопка | модуль (явно открыть богатый мастер) |

`kind` ∈ {ups, battery, cooling, panel, mv, transformer, dgu, mdc, scs,
suppression, …} — совпадает с `configuration-catalog` kind и id модуля.

## 2. Изменение библиотек/каталогов (broadcast «обновись»)
| Событие | Эмиттер | Назначение |
|---|---|---|
| `<module>:configs-changed` (`ups-config:…`, `battery:…`) | модуль после save конфигурации | сайдбар/список перерисоваться |
| `rack-config:templates-changed` · `rack-config:ready` | rack-config | шаблоны стоек изменены / модуль готов |
| `raschet:card-preset-changed` | `shared/card-presets.js` | пресеты карточек схемы |
| `raschet:company-profile-change` (`detail`) | `shared/company-profile.js` | реквизиты/налоги компании |
| `raschet:work-templates-change` · `raschet:materials-change` · `raschet:wizards-change` · `raschet:kp-templates-change` | `service/catalog/*` | каталоги работ/материалов/мастеров/КП |
| `raschet:storage-mode-changed` (`{mode}`) | `js/projects.js` | переключение local/cloud хранилища |

## 3. Правила
- Имя: `rs-*`/`rs-cs-*` — селекшн-контракт; `raschet:*` — глобальные
  shared-данные; `<module>:*` — внутримодульные broadcast (другие
  модули могут слушать, но не обязаны).
- `detail` — плоский сериализуемый объект; поля только из таблицы;
  новые поля опциональны (минор), смена смысла — обсуждать.
- Эмиттер не предполагает наличие конкретного потребителя
  (fire-and-forget); потребитель фильтрует по `kind`.
- Нельзя слать события вместо передачи данных — крупные данные идут
  через `project-storage`/`configuration-catalog` (событие = только
  сигнал «перечитай»).
- Новое кросс-модульное событие → добавить сюда + в `manifest`
  обоих сторон; boundary-lint/CI Фазы 1 проверяет согласованность.

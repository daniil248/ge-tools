# AGENTS.md — контекст для нативного агента Antigravity

> Этот файл — зеркало контекста проекта **Genesis Engineering Tools
> (GE Tools)** для агентов, которые НЕ читают `~/.claude` (нативный
> агент Antigravity / Gemini). Claude Code на этой машине использует
> `CLAUDE.md` + durable-память напрямую и в этом файле не нуждается.
>
> **Источник истины по процессу и архитектуре — `CLAUDE.md` в корне
> репозитория. Прочитай его первым.** Этот файл дополняет его сжатым
> сводом доменных правил, которые у Claude Code лежат в личной памяти
> (`~/.claude/.../memory/feedback_*.md`) и нативному агенту недоступны.
> При конфликте формулировок приоритет у `CLAUDE.md`.

## Продукт

Genesis Engineering Tools (ex-«Raschet») — набор инженерных и
управленческих модулей на общей платформе. «Конструктор схем» —
один из модулей (корневой `index.html`), не весь продукт.
`APP_NS='getools'`. Деплой: `git push origin main` → GitHub Pages
(~45 с), https://daniil248.github.io/ge-tools/

## Рабочее соглашение (из CLAUDE.md §1)

- **Непрерывность.** Идти сквозь план инкремент за инкрементом, не
  спрашивать «продолжать?», не заканчивать ход «продолжу следующим».
  Останавливаться только на нечинимой проблеме, реально неоднозначном
  требовании или явном СТОП/ПАУЗА.
- **Корректировки — сразу:** править → commit → push → verify, не
  откладывать в todo/«следующую фазу».
- **Делай сам.** Код, правки, команды, проверки, исследование, доки —
  без спроса. Спрашивать только при выборе между вариантами с
  существенным влиянием.
- **Оспаривай** плохой подход с аргументами и альтернативой.
- **Стиль:** минимум слов, без баннеров и шаблонов. В коде/коммитах/
  доках — «Пользователь». Эмодзи в файлах — только если просили.
- **Bash-гигиена:** чистые минимальные команды, профильные тулы (git
  напрямую; Glob/Grep/Read, не ls/find/cat/echo).

## Git / деплой / версия (из CLAUDE.md §2–3)

- Работа буквально на ветке `main`; прямой push в `main` — намеренный
  процесс (не PR-флоу). Коммиты новые (не amend), хуки не пропускать,
  секреты не коммитить.
- Содержательная правка → bump `APP_VERSION` (`js/engine/constants.js`)
  + запись сверху в `shared/module-changelogs.js`.
- Changelog-escaping: НИКОГДА `\\'`; апостроф `\'` или избегать.
  Перед коммитом `tools/changelog-lint.py` зелёный; при касании
  контрактов — `tools/audit-contracts.py --strict`.
- `ROADMAP.md` всегда в синке (новый пункт — в существующую фазу,
  закрытие — отметка+версия; hotfix в roadmap не вносить).
- Cache-safe exports: новый export в unversioned `shared/*.js` +
  немедленный импорт = transient SyntaxError в edge-кэше Pages. Два
  деплоя: export → ждать распространения → потребитель.
- На каждом шаге синхронно: ROADMAP + changelog + память +
  `modules/index.html` (карточки + техсписок «Все модули»).

## Архитектура / контракты (из CLAUDE.md §5)

- Ядро = платформа `js/engine/*` — универсальная база всех типов
  схем. Электрорасчёты (`js/calc`, `lib/*-methods`) — модуль, не ядро.
- Конструктор — общая оболочка для всех дисциплин; спец-канвы
  сохраняют свой движок. Контракт:
  `shared/contracts/schema-constructor-architecture.md`.
- Cross-module нативно ок; сырой чужой LS — только через
  `shared/project-storage.js`. Границы — `shared/contracts/README.md`
  + `boundary-lint.mjs`.
- calc/UI раздельно: расчёт в `calc/` (no DOM), графика в `ui/`;
  cross-module через `<module>-bridge.js`.
- Отчёты только через `reports/` (blocks[] → `shared/report/blocks.js`
  → `composeReport`); без `window.open`+HTML.
- Справочные данные только в каталогах, не в коде.
- Метод/стандарт = отдельный файл + picker; мультинорма РФ+КЗ+ISO/IEC.
- User-params sacred: не менять заданное Пользователем; миграции с
  `typeof`-guard; apply preserve-on-miss.
- Без браузерных диалогов (`alert/confirm/prompt`) — in-page
  toast+modal (`scToast/scConfirm/scPrompt`).
- Технолог = ГИП + жизненный цикл; архитектор/конструктор =
  SPATIAL-BASE, инженерные дисциплины — read-only.

## Доменные правила (сжатый индекс личной памяти Claude Code)

Полные формулировки — у Claude Code в `feedback_*.md`. Ключевое:

- **UX:** sidebar accordion (single-open, для навигационных, sticky+
  scroll `.rs-sidebar`, flex item-ergonomics); column-filters прямо
  над заголовком (Excel-style autofilter); cross-filter selects
  кросс-зависимы; tooltips на каждой переменной; в re-render таблицах
  событие `change`, не `input`; zoom Ctrl+wheel (без Ctrl — скролл
  страницы); unified project picker — только header chip
  `rs-proj-badge`, не дублировать в sidebar; module-scope pickers
  (full всегда, sketch только своего ownerModule).
- **Подбор:** все подборы как «Подбор холода» (условия+финансы+
  варианты, TCO/CAPEX/OPEX; `shared/selection-panel.js` +
  `capex-tco.js`).
- **Стойки:** powerAvgKw (ввод) + powerMaxKw (Σ PDU); PDU габариты+
  outlets; clearances front/rear + access; merge drag-drop
  совместимой стойки, cross-discipline дубли → «Связать».
- **Кабель/трассы:** длина по физмаршруту (порт→органайзеры→трасса→
  зеркально), lengthFrozen=ручной override; routing через ближайшую
  трассу; tray fittings (T/X/угол/редукция/заглушка) каталог+BOM;
  tray snap к 100мм-сетке или к соседнему каналу.
- **Расчёт:** UPS HVAC derate ≥30% (механ. нагрузка на модульный
  ИБП, ко всем типам); модульный ИБП frame-лимит + N модулей×кВт +
  резерв; redundancy notation N+R (буква R, не M).
- **Финансы/норматив:** НДС каскад project→company→org→fallback,
  пресеты KZ/RU/BY/Export/Custom, экспорт-КП без НДС-строки;
  норматив авто по country проекта (override юзером).
- **Локация проекта** задаётся 1 раз в свойствах, пропагируется во
  все calc-модули, ReadOnly если задано.
- **Сервис** обслуживает любое оборудование; позиции несут
  sourceModule+sourceRef; повторный импорт = update с предупреждением.
- **Данные:** загруженные → append-only history-log; удаление=soft
  (корзина), permanent только из корзины; UI «История».
- **Доступ:** subscription per-module (модуль=SKU; ui = SKU+check,
  calc-lib = auto; soft-enforcement; триал 14д); internal-only
  модули (projects/reports/logistics) — только сотрудникам; RBAC
  4 роли (manager/gip/engineer/viewer) + permissions, hasPermission
  guard (disabled+tooltip, не скрывать).
- **Терминология:** термин-замечание касается всего проекта (grep +
  правка везде): бин→интервал, Ambient T→Темп.наружн., Avg/Min/Max→
  Средн./Мин./Макс.; группировка group-container корректна (дочерние
  не в «неразмещённых», наследуют _powered).

## Верификация (из CLAUDE.md §4)

Регресс проверять естественной загрузкой `apps/<id>/index.html`
модуля; не зондировать чужой entry cross-page; clear+reload перед
чтением консоли, сверять таймстемпы; чистая проба — только NO-DOM
(`shared/*`, `calc/*`). Если браузер-репро невозможно — сказать
честно, не выдавать непроверенное за проверенное.

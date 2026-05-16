#!/usr/bin/env python3
# Step 1 раската importmap (v0.60.541): добавляет ОДИНАКОВЫЙ importmap
# во все module-entry HTML. Адреса document-relative (все entry-HTML на
# глубине 1 → ../shared/ == /raschet/shared/). importmap без bare-импортов
# = no-op (резолвинг bare-спецификаторов ещё нигде не используется), поэтому
# коммит чисто аддитивный, нулевой риск. Идемпотентно.
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLOCK = (
    '  <script type="importmap">\n'
    '  { "imports": { "shared/": "../shared/", "engine/": "../js/engine/" } }\n'
    '  </script>\n'
)
# entry-HTML (module-depth, со script type=module). cooling уже сделан вручную.
TARGETS = [
    "battery/index.html","cable/index.html","catalog/index.html",
    "facility-inventory/index.html","genset-config/index.html","help/index.html",
    "logistics/index.html","mdc-config/index.html","meteo/index.html",
    "modules/index.html","mv-config/index.html","panel-config/index.html",
    "pdu-config/index.html","projects/index.html","projects/project.html",
    "psychrometrics/index.html","rack-config/index.html","reports/index.html",
    "schematic/index.html","scs-config/inventory.html","scs-config/rack.html",
    "scs-design/index.html","service/index.html","sketch/index.html",
    "suppression-config/index.html","tech-workspace/index.html",
    "transformer-config/index.html","ups-config/index.html",
    "elements/index.html","dev/por-playground.html",
]
MERGE = ["configurator3d/index.html"]  # уже есть three-importmap → дослить ключи

added, skipped, merged = [], [], []

for rel in TARGETS:
    p = ROOT / rel
    txt = p.read_text(encoding="utf-8")
    if 'type="importmap"' in txt:
        skipped.append(rel); continue
    m = re.search(r'<script\s+type="module"', txt)
    if not m:
        skipped.append(rel + " (no module script)"); continue
    # вставляем ПЕРЕД первым module-script, сохраняя его отступ
    line_start = txt.rfind("\n", 0, m.start()) + 1
    indent = txt[line_start:m.start()]
    ins = BLOCK if indent.strip() == "" else BLOCK
    txt = txt[:line_start] + ins + txt[line_start:]
    p.write_text(txt, encoding="utf-8")
    added.append(rel)

for rel in MERGE:
    p = ROOT / rel
    txt = p.read_text(encoding="utf-8")
    if '"shared/"' in txt:
        skipped.append(rel + " (already merged)"); continue
    txt2 = txt.replace(
        '"imports": {\n    "three":',
        '"imports": {\n    "shared/": "../shared/",\n    "engine/": "../js/engine/",\n    "three":',
        1,
    )
    if txt2 == txt:
        skipped.append(rel + " (MERGE PATTERN NOT FOUND)")
    else:
        p.write_text(txt2, encoding="utf-8")
        merged.append(rel)

print(f"ADDED  ({len(added)}): " + ", ".join(added))
print(f"MERGED ({len(merged)}): " + ", ".join(merged))
print(f"SKIPPED({len(skipped)}): " + ", ".join(skipped))

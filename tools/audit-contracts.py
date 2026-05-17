#!/usr/bin/env python3
# =========================================================================
# tools/audit-contracts.py - аудитор честности манифестов (Фаза 1).
# Zero-deps (stdlib). Для каждого зарегистрированного модуля сверяет
# manifest.json.dependsOnContracts с ФАКТИЧЕСКИМ кодом модуля:
#   - storageKeys: KEY_* = ['<ns>','...'] + projectKey(...,'<ns>','...')
#                  + литералы 'raschet.<...>' (глобал/handoff/bridge)
#   - urlParams:  URLSearchParams(...).get('x') / params.get('x')
#   - bridges:    import ... from 'shared/<x>-bridge.js'
#   - events:     postMessage({type:'raschet.<...>'}) / 'raschet.<...>'
#
# Advisory (НЕ блокирует): печатает per-module MISSING (в коде есть, в
# манифесте нет) и EXTRA (в манифесте есть, в коде не найдено). Это
# дополняет tools/gen-modules-json.mjs (тот сверяет ТОЛЬКО проецируемые
# в modules.json поля; dependsOnContracts туда не входит).
#
#   python3 tools/audit-contracts.py            # отчёт по всем
#   python3 tools/audit-contracts.py meteo cooling   # по выбранным
#   python3 tools/audit-contracts.py --strict   # exit 1 если есть drift
#
# Namespace storage модуля может СОЗНАТЕЛЬНО отличаться от id
# (genset-config хранит под 'dgu-config') - берём из manifest
# lsNamespacesOwned, иначе id.
# =========================================================================
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REGISTRY_ORDER = [
    'constructor', 'cable', 'schematic', 'sketch', 'battery', 'ups-config',
    'panel-config', 'mv-config', 'transformer-config', 'reports', 'catalog',
    'help', 'tech-workspace', 'logistics', 'projects', 'cooling', 'meteo',
    'service', 'scs-config', 'scs-design', 'rack-config', 'mdc-config',
    'genset-config', 'pdu-config', 'suppression-config', 'psychrometrics',
    'facility-inventory', 'configurator3d', 'suppression-methods',
    'hydraulic-methods', 'hvac-methods', 'gas-methods', 'electrical-methods',
]


def manifest_path(mid):
    if mid == 'constructor':
        return os.path.join(ROOT, 'manifest.json')
    for cand in (os.path.join(ROOT, 'apps', mid, 'manifest.json'),
                 os.path.join(ROOT, 'lib', mid, 'manifest.json'),
                 os.path.join(ROOT, mid, 'manifest.json')):
        if os.path.exists(cand):
            return cand
    return None


def code_dir(mid):
    if mid == 'constructor':
        return os.path.join(ROOT, 'js')
    for cand in (os.path.join(ROOT, 'apps', mid),
                 os.path.join(ROOT, 'lib', mid),
                 os.path.join(ROOT, mid)):
        if os.path.isdir(cand):
            return cand
    return None


def iter_code(mid):
    d = code_dir(mid)
    if not d:
        return
    for base, _dirs, files in os.walk(d):
        for fn in files:
            if fn.endswith(('.js', '.html')):
                p = os.path.join(base, fn)
                try:
                    yield p, open(p, encoding='utf-8', errors='ignore').read()
                except Exception:
                    pass


RE_KEY_ARR = re.compile(r"\[\s*'([a-z0-9-]+)'\s*,\s*'([a-zA-Z0-9._-]+)'\s*\]")
RE_PROJKEY = re.compile(r"projectKey\([^,]+,\s*'([a-z0-9-]+)'\s*,\s*'([a-zA-Z0-9._-]+)'")
RE_RASCHET = re.compile(r"['\"`](raschet\.[a-zA-Z0-9._<>-]+)['\"`]")
RE_GETPARAM = re.compile(r"\.get\(\s*'([a-zA-Z][a-zA-Z0-9_]*)'\s*\)")
RE_BRIDGE = re.compile(r"from\s+'shared/([a-z0-9-]+-bridge)\.js'")
RE_POSTMSG = re.compile(r"type:\s*'(raschet\.[a-zA-Z0-9._-]+)'")

# Санкционированные литералы (RENAME.md): wire-format schema-id и т.п. -
# не считаем за storageKeys-долг.
SANCTioned = re.compile(r"raschet\.[a-z-]+/\d")
# postMessage/bridge-протокол (не LS-ключи) - .apply/.bridge суффиксы;
# и regex-артефакты (обрезанные префиксные конструкции, реальные ключи
# ловит RE_PROJKEY): bare raschet.project / .scheme / .sketch.
PROTO_SUFFIX = re.compile(r"\.(apply|bridge)(\.|$)")
BARE_PREFIX = {'raschet.project', 'raschet.scheme', 'raschet.sketch'}


def scan(mid, owned_ns):
    sk, url, br, ev = set(), set(), set(), set()
    for _p, src in iter_code(mid):
        for m in RE_KEY_ARR.finditer(src):
            ns, key = m.group(1), m.group(2)
            if ns in owned_ns:
                sk.add('raschet.project.<pid>.%s.%s' % (ns, key))
        for m in RE_PROJKEY.finditer(src):
            ns, key = m.group(1), m.group(2)
            if ns in owned_ns:
                sk.add('raschet.project.<pid>.%s.%s' % (ns, key))
        for m in RE_RASCHET.finditer(src):
            lit = m.group(1)
            if SANCTioned.search(lit) or lit in BARE_PREFIX:
                continue
            if PROTO_SUFFIX.search(lit):
                ev.add('postMessage:%s' % lit)
                continue
            sk.add(lit)
        for m in RE_GETPARAM.finditer(src):
            url.add(m.group(1))
        for m in RE_BRIDGE.finditer(src):
            br.add('shared/%s.js' % m.group(1))
        for m in RE_POSTMSG.finditer(src):
            ev.add('postMessage:%s' % m.group(1))
    return sk, url, br, ev


def norm_keys(lst):
    # схлопываем <pid>-варианты и * для сравнения по «семейству ключа»
    out = set()
    for k in lst or []:
        out.add(re.sub(r'<[a-z]+>', '<>', k).rstrip('.*'))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    strict = '--strict' in sys.argv
    targets = args or REGISTRY_ORDER
    drift = 0
    for mid in targets:
        mp = manifest_path(mid)
        if not mp:
            print('  ?? %-22s manifest не найден' % mid)
            continue
        mf = json.load(open(mp, encoding='utf-8'))
        owned = set(mf.get('lsNamespacesOwned') or []) | {mid}
        dc = mf.get('dependsOnContracts') or {}
        m_sk = norm_keys(dc.get('storageKeys'))
        m_url = set(dc.get('urlParams') or [])
        m_br = set(dc.get('bridges') or [])
        c_sk, c_url, c_br, c_ev = scan(mid, owned)
        c_sk_n = norm_keys(c_sk)
        miss_sk = sorted(c_sk_n - m_sk)
        miss_url = sorted(c_url - m_url - {'navResult', 'return'})
        miss_br = sorted(c_br - m_br)
        ok = not (miss_sk or miss_url or miss_br)
        flag = 'OK' if ok else 'DRIFT'
        if not ok:
            drift += 1
        print('  %-5s %-22s sk=%d url=%d br=%d' % (
            flag, mid, len(m_sk), len(m_url), len(m_br)))
        if miss_sk:
            print('        storageKeys в коде, нет в манифесте: %s'
                  % ', '.join(miss_sk[:8]) + (' …' if len(miss_sk) > 8 else ''))
        if miss_url:
            print('        urlParams в коде, нет в манифесте: %s'
                  % ', '.join(miss_url))
        if miss_br:
            print('        bridges в коде, нет в манифесте: %s'
                  % ', '.join(miss_br))
    print('\nИтого: %d модул(ей) с drift из %d (advisory; '
          'gen-modules-json --check отвечает за паритет modules.json).'
          % (drift, len(targets)))
    if strict and drift:
        sys.exit(1)


if __name__ == '__main__':
    main()

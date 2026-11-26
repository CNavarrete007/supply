#!/usr/bin/env python3
"""SupplyFlow · Mapa de conexión de clases: frontend (React) → rutas de la API → controladores → librerías → cuenta SQL y tablas.

Solo LEE el código del repositorio: no se conecta a MariaDB ni a la API. Apto para cualquier copia del proyecto.

Opcionalmente cruza dos registros de una corrida en vivo (solo sandbox; no se generan en la PC del usuario):
  --access-log     líneas «MÉTODO /ruta ESTADO ui|http» registradas por la API (qué rutas recibieron peticiones reales).
  --initiator-log  JSON por línea {method, path, files[]} de la precarga CDP de Playwright (qué archivo /src originó cada petición).

Falla (código 1) si una ruta apunta a un controlador o método inexistente, o si el frontend llama una ruta que no existe.
Uso: python3 tests/class_connection_audit.py [--access-log F] [--initiator-log F] [--markdown F] [--json F]
"""
import argparse, collections, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'backend', 'app')
SRC = os.path.join(ROOT, 'src')
ACCOUNTS = {
    'api': 'supplyflow_api_local (solo SELECT)', 'auth': 'supplyflow_auth_local', 'reqwrite': 'supplyflow_reqwrite_local',
    'recovery': 'supplyflow_recovery_local (contrato 52)', 'catalogwrite': 'supplyflow_catalogwrite_local',
    'useradmin': 'supplyflow_useradmin_local', 'mgmtwrite': 'supplyflow_mgmtwrite_local', 'quotewrite': 'supplyflow_quotewrite_local',
}
ENV_ACCOUNT = {'AUTH_DB_USERNAME': 'auth', 'REQWRITE_DB_USERNAME': 'reqwrite', 'RECOVERY_DB_USERNAME': 'recovery', 'CATALOGWRITE_DB_USERNAME': 'catalogwrite',
               'USERADMIN_DB_USERNAME': 'useradmin', 'MGMTWRITE_DB_USERNAME': 'mgmtwrite', 'QUOTEWRITE_DB_USERNAME': 'quotewrite'}


def read(path):
    with open(path, encoding='utf8') as fh:
        return fh.read()


def strip_comments(code, php=False):
    """Quita comentarios // /* */ (y # en PHP) respetando cadenas '…', "…" y plantillas `…${…}…`."""
    out, i, n, stack = [], 0, len(code), []
    while i < n:
        c = code[i]
        if stack and stack[-1] == '`':
            if c == '\\':
                out.append(code[i:i + 2]); i += 2; continue
            if c == '`':
                stack.pop(); out.append(c); i += 1; continue
            if code.startswith('${', i):
                stack.append('{'); out.append('${'); i += 2; continue
            out.append(c); i += 1; continue
        if c in '\'"' or (c == '`' and not php):
            if c == '`':
                stack.append('`'); out.append(c); i += 1; continue
            j = i + 1
            while j < n and code[j] != c:
                j += 2 if code[j] == '\\' else 1
            out.append(code[i:j + 1]); i = j + 1; continue
        if code.startswith('//', i) or (php and c == '#' and not code.startswith('#[', i)):
            j = code.find('\n', i); i = n if j < 0 else j; continue
        if code.startswith('/*', i):
            j = code.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if stack and c == '{':
            stack.append('{')
        elif stack and c == '}':
            stack.pop()
        out.append(c); i += 1
    return ''.join(out)


# ───────────────────────── Backend ─────────────────────────
def php_classes():
    classes = {}
    for sub in ('Controllers', 'Libraries', 'Filters', 'Database'):
        base = os.path.join(APP, sub)
        for name in sorted(os.listdir(base)):
            if not name.endswith('.php'):
                continue
            code = strip_comments(read(os.path.join(base, name)), php=True)
            m = re.search(r'\b(?:abstract\s+|final\s+)*(class|interface|trait)\s+(\w+)(?:\s+extends\s+([\\\w]+))?', code)
            if not m:
                continue
            cls = m.group(2)
            sql = code  # SQL en cadenas y en bloques nowdoc <<<'SQL' … SQL (palabras clave en mayúsculas)
            writes = set()
            for verb, rx in (('INSERT', r'\bINSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)'), ('UPDATE', r'\bUPDATE\s+`?(\w+)`?\s+(?:\w+\s+)?SET\b'), ('DELETE', r'\bDELETE\s+FROM\s+`?(\w+)')):
                writes |= {f'{t} ({verb})' for t in re.findall(rx, sql)}
            for verb in ('insert', 'update', 'delete'):  # auxiliares insert('tabla', [...]) / update('tabla', [...], …)
                writes |= {f'{t} ({verb.upper()})' for t in re.findall(r"->" + verb + r"\(\s*'(\w+)'", code)}
            reads = set(re.findall(r'\b(?:FROM|JOIN)\s+`?([a-z_]+)`?', sql)) - {'information_schema', 'dual'}
            account = 'api' if re.search(r'Database::connect\(', code) else None
            for env, acc in ENV_ACCOUNT.items():
                if f"'{env}'" in code:
                    account = acc
            classes[cls] = {
                'file': os.path.relpath(os.path.join(base, name), ROOT), 'kind': sub, 'parent': (m.group(3) or '').split('\\')[-1] or None,
                'abstract': bool(re.search(r'\babstract\s+class\b', code)), 'code': code,
                'methods': set(re.findall(r'\bfunction\s+(\w+)\s*\(', code)),
                'public': set(re.findall(r'\bpublic\s+(?:static\s+)?function\s+(\w+)\s*\(', code)),
                'account': account, 'writes': writes, 'reads': reads,
            }
    names = set(classes)
    for cls, info in classes.items():
        info['uses'] = sorted(o for o in names if o != cls and re.search(r'\b' + o + r'\b', info['code']))
        info['news'] = sorted(o for o in names if o != cls and re.search(r'\bnew\s+\\?(?:App\\\w+\\)?' + o + r'\s*\(', info['code']))
    return classes


def inherited(classes, cls, key):
    seen, out = set(), set()
    while cls in classes and cls not in seen:
        seen.add(cls); val = classes[cls][key]
        if isinstance(val, set):
            out |= val
        elif val and not out:
            return val
        cls = classes[cls]['parent']
    return out if out else None


def closure(classes, start, key='uses'):
    """Clases alcanzables desde `start`: por cualquier referencia (key='uses') o solo por instancias `new X(` (key='news')."""
    seen, todo = set(), [start]
    while todo:
        c = todo.pop()
        if c in seen or c not in classes:
            continue
        seen.add(c); todo += classes[c][key] + ([classes[c]['parent']] if classes[c]['parent'] else [])
    return seen


def literal_sets(path):
    """Lee asignaciones literales (conjuntos/tuplas) de un archivo Python SIN importarlo ni ejecutarlo."""
    import ast
    out = {}
    for node in ast.parse(read(path)).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                out[node.targets[0].id] = ast.literal_eval(node.value)
            except ValueError:
                pass
    return out


def grants():
    """(tabla, privilegio) concedidos a cada cuenta según los contratos versionados (77/52 + catalogwrite, useradmin, mgmtwrite y quotewrite)."""
    d = os.path.join(ROOT, 'docker')
    def prov(rel):
        v = literal_sets(os.path.join(d, rel))
        cols = {(t, 'UPDATE') for t in (v.get('UPDATE_COLUMNS') or {})}  # UPDATE por columna (useradmin, mgmtwrite, quotewrite)
        return {(t, p) for p in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') for t in v.get(p + '_TABLES', ())} | cols
    acc = literal_sets(os.path.join(d, 'supply-int03', 'accounts.py'))
    return {
        'recovery': prov('supply-recovery/provision.py') | set(acc['R3_EXTRA']),
        'reqwrite': prov('supply-reqwrite/provision.py'),
        'catalogwrite': prov('supply-catalogwrite/provision.py'),
        'useradmin': prov('supply-useradmin/provision.py'),
        'mgmtwrite': prov('supply-mgmtwrite/provision.py'),
        'quotewrite': prov('supply-quotewrite/provision.py'),
        'auth': {(t, 'SELECT') for t in acc['AUTH_TABLES']} | set(acc['AUTH_EXTRA']) | {(t, p) for t, _, p in acc['AUTH_COLUMNS']},
    }


def routes():
    code = strip_comments(read(os.path.join(APP, 'Config', 'Routes.php')), php=True)
    out = []
    for verb, path, ctrl, method in re.findall(r"\$routes->(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*'(\w+)::(\w+)(?:/[^']*)?'", code):
        rx = re.compile('^/' + re.escape(path).replace(re.escape('(:segment)'), '[^/]+') + '$')
        out.append({'method': verb.upper(), 'path': '/' + path, 'controller': ctrl, 'action': method, 'rx': rx})
    return out


def match_route(rts, method, path):
    for r in rts:
        if r['method'] == method and r['rx'].match(path):
            return r
    return None


# ───────────────────────── Frontend ─────────────────────────
def js_files():
    out = []
    for d, _, files in os.walk(SRC):
        out += [os.path.relpath(os.path.join(d, f), ROOT) for f in files if f.endswith(('.js', '.jsx', '.mjs'))]
    return sorted(out)


def resolve(frm, spec):
    if not spec.startswith('.'):
        return None
    base = os.path.normpath(os.path.join(os.path.dirname(frm), spec))
    for ext in ('', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'):
        if os.path.isfile(os.path.join(ROOT, base + ext)) and (base + ext).endswith(('.js', '.jsx', '.mjs')):
            return base + ext
    return None


def frontend():
    files = {}
    for f in js_files():
        raw = read(os.path.join(ROOT, f)); code = strip_comments(raw)
        specs = re.findall(r"""(?:\bimport\b[^'"`;]*?\bfrom\s*|\bimport\s*\(?\s*|\bexport\b[^'"`;]*?\bfrom\s*)['"]([^'"]+)['"]""", code)
        literals = re.findall(r"""['"`]((?:/api/v1)[^'"`?]*)""", code)
        body = re.sub(r'\bexport\b[^;]*?\bfrom\s*[\'"][^\'"]+[\'"];?', '', code).strip()
        files[f] = {'imports': sorted({r for r in (resolve(f, s) for s in specs) if r}), 'fetch': bool(re.search(r'\bfetch\(', code)), 'alias': not body,
                    'api_literals': sorted(set(literals)), 'component': f.endswith('.jsx')}
    reach, todo = set(), ['src/main.jsx']
    while todo:
        f = todo.pop()
        if f in reach or f not in files:
            continue
        reach.add(f); todo += files[f]['imports']
    return files, reach


# ───────────────────────── Informe ─────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--access-log'); ap.add_argument('--initiator-log'); ap.add_argument('--markdown'); ap.add_argument('--json')
    a = ap.parse_args()
    classes, rts = php_classes(), routes()
    files, reach = frontend()
    problems = []

    # Rutas → controlador → método (heredado incluido) → librerías → cuenta SQL.
    for r in rts:
        c = r['controller']
        r['ok'] = c in classes and r['action'] in (inherited(classes, c, 'public') or set())
        if not r['ok']:
            problems.append(f"Ruta {r['method']} {r['path']}: {c}::{r['action']} no existe")
        # Conexiones reales: solo las clases que se INSTANCIAN (new X) desde el controlador; las referencias estáticas
        # (constantes o funciones de política, p. ej. RequisitionRecoveryRepository::stage) no abren conexión.
        inst = closure(classes, c, 'news')
        r['libraries'] = sorted(d for d in inst - {c} if classes[d]['kind'] == 'Libraries')
        r['accounts'] = sorted({inherited(classes, d, 'account') for d in inst if inherited(classes, d, 'account')})
    # Lo que cada clase con cuenta propia lee/escribe debe estar concedido a esa cuenta (si no: error 1142 en ejecución).
    contract = grants()
    for c, info in sorted(classes.items()):
        acc = inherited(classes, c, 'account')
        if acc not in contract:
            continue
        need = {(t.split(' (')[0], t.split('(')[1].rstrip(')')) for t in info['writes']} | {(t, 'SELECT') for t in info['reads']}
        info['missing'] = sorted(need - contract[acc])
        for t, p in info['missing']:
            problems.append(f'{c} ({acc}) usa {p} en `{t}`, pero la cuenta no tiene ese permiso en su contrato')
    routed = set()
    for r in rts:
        routed |= closure(classes, r['controller'])
    filters = read(os.path.join(APP, 'Config', 'Filters.php'))
    routed |= {c for c in classes if re.search(r'\b' + c + r'\b', filters)}
    orphans = sorted(c for c in classes if c not in routed and classes[c]['kind'] in ('Controllers', 'Libraries') and c != 'BaseController')

    # Evidencia en vivo.
    live = collections.defaultdict(lambda: {'ui': collections.Counter(), 'http': collections.Counter()})
    unmatched = collections.Counter()
    if a.access_log:
        for line in open(a.access_log, encoding='utf8'):
            p = line.split()
            if len(p) != 4:
                continue
            r = match_route(rts, p[0], p[1])
            if r:
                live[(r['method'], r['path'])][p[3]][p[2]] += 1
            else:
                unmatched[(p[0], p[1], p[2], p[3])] += 1
    for (m, p, st, src), n in sorted(unmatched.items()):
        if src == 'ui':
            problems.append(f'La interfaz pidió {m} {p}, que no es una ruta de la API (respuesta {st}, {n} vez/veces)')
    origin = collections.defaultdict(set)      # ruta → componentes/archivos que la originaron (navegador)
    by_file = collections.defaultdict(set)     # archivo → rutas originadas
    called_missing = collections.Counter()
    if a.initiator_log:
        for line in open(a.initiator_log, encoding='utf8'):
            d = json.loads(line)
            r = match_route(rts, d['method'], d['path'])
            if not r:
                called_missing[(d['method'], d['path'], d['files'][0] if d['files'] else '?')] += 1
                continue
            key = (r['method'], r['path'])
            # La pila asíncrona incluye ancestros lejanos (React encadena actualizaciones): cuenta el archivo más cercano a la
            # petición que no sea un cliente HTTP (componente .jsx o hook .js, p. ej. useMatrixData.js o useCatalogAutosave.js).
            fs = [f for f in d['files'] if f != 'src/main.jsx']
            caller = next((f for f in fs if f.startswith('(') or not files.get(f, {}).get('fetch')), fs[0] if fs else None)
            if caller:
                origin[key].add(caller); by_file[caller].add(key)
    for (m, p, f), n in sorted(called_missing.items()):
        problems.append(f'El frontend ({f}) llamó {m} {p}, que no es una ruta de la API ({n} vez/veces)')

    # Estático: literales /api/v1 del frontend que no corresponden a ninguna ruta (cualquier método).
    # Un literal puede ser la ruta completa o un prefijo que el cliente completa (ROOT); `${…}` y (:segment) son comodines.
    static_unknown = []
    samples = [r['path'].replace('(:segment)', 'SEG') for r in rts]
    for f in sorted(reach):
        for lit in files[f]['api_literals']:
            parts = re.split(r'\$\{[^}]*\}', lit.rstrip('/'))
            lit_rx = re.compile('^' + '[^/]+'.join(re.escape(x) for x in parts) + '(?:/.*)?$')
            if not any(lit_rx.match(sp) or r['rx'].match('SEG'.join(parts)) for sp, r in zip(samples, rts)):
                static_unknown.append((f, lit))

    # Rutas usadas por los scripts de arranque/restauración (PowerShell/shell), no por pantallas.
    scripts = ''.join(read(os.path.join(ROOT, f)) for f in os.listdir(ROOT) if f.endswith(('.ps1', '.sh')))
    for r in rts:
        r['scripts'] = '(:segment)' not in r['path'] and r['method'] == 'GET' and r['path'] in scripts
    api_clients = sorted(f for f in reach if files[f]['fetch'])
    comps = sorted(f for f in reach if files[f]['component'])
    unreachable = sorted(f for f in files if f not in reach and not f.startswith('src/sw'))
    def imports_api(f, seen=None):
        seen = seen or set()
        if f in seen:
            return False
        seen.add(f)
        return files[f]['fetch'] or any(imports_api(i, seen) for i in files[f]['imports'] if not files[i]['component'])

    L = []
    w = L.append
    nlive = sum(1 for r in rts if live.get((r['method'], r['path'])))
    # «Desde la interfaz» = la pila de llamadas del navegador la originó (CDP). Sin ese registro se usa el agente de usuario, que también
    # cuenta las llamadas por API que hacen las pruebas desde Playwright.
    from_ui = (lambda k: bool(origin.get(k))) if a.initiator_log else (lambda k: bool(live.get(k, {}).get('ui')))
    nui = sum(1 for r in rts if from_ui((r['method'], r['path'])))
    s5 = sorted({(m, p) for (m, p), v in live.items() for src in ('ui', 'http') for st in v[src] if st.startswith('5')})
    w('## Resumen\n')
    w('| Concepto | Resultado |\n|---|---|')
    w(f'| Rutas de la API (`Routes.php`, enrutamiento automático desactivado) | {len(rts)} ({sum(1 for r in rts if r["method"] == "GET")} GET, {sum(1 for r in rts if r["method"] != "GET")} de escritura) |')
    w(f'| Rutas cuyo controlador y método existen | {sum(r["ok"] for r in rts)}/{len(rts)} |')
    w(f'| Clases PHP (controladores, librerías, filtro, sesión) | {len(classes)}; sin uso desde ninguna ruta: {len(orphans)} |')
    w(f'| Archivos JS/JSX alcanzables desde `src/main.jsx` | {len(reach)} de {len(files)}; componentes `.jsx`: {len(comps)}; clientes HTTP (`fetch`): {len(api_clients)} |')
    if a.access_log:
        w(f'| Rutas que recibieron peticiones reales en la corrida | {nlive}/{len(rts)} (desde la interfaz: {nui}) |')
        w(f'| Respuestas 5xx observadas | {len(s5)} |')
    if a.initiator_log:
        w(f'| Archivos del frontend que originaron peticiones (pila CDP) | {len(by_file)} |')
    w(f'| Problemas (rutas rotas, llamadas a rutas inexistentes, permisos SQL faltantes) | {len(problems)} |\n')

    w('## Rutas: controlador → librerías → cuenta SQL → origen en la interfaz\n')
    w('Componentes: archivos `/src` en la pila de llamadas de las peticiones que hizo el navegador. Respuestas: códigos que devolvió la API en la corrida (interfaz y pruebas HTTP juntas).\n')
    w('| Método | Ruta | Controlador::método | Librerías | Cuenta SQL | Componentes que la llaman | Respuestas en vivo |\n|---|---|---|---|---|---|---|')
    for r in rts:
        k = (r['method'], r['path'])
        comps_k = sorted(origin.get(k, ()))
        cli = []
        v = live.get(k)
        ver = '—' if not v else ', '.join(f'{st}×{n}' for st, n in sorted((v['ui'] + v['http']).items()))
        uses = ', '.join(x.replace('Repository', 'Repo') for x in r['libraries'] if 'Input' not in x and x not in ('CatalogConflict', 'CatalogStale', 'CatalogWriteUnavailable', 'RequisitionChangeConflict', 'RequisitionChangeStale'))
        place = ', '.join(c.replace('src/views/', '').replace('src/', '') for c in comps_k) or ('scripts de arranque (`*.ps1`)' if r['scripts'] else '—')
        w(f"| {r['method']} | `{r['path']}` | {r['controller']}::{r['action']}{'' if r['ok'] else ' ⚠'} | {uses or '—'} | {', '.join(r['accounts']) or 'sin BD'} | {place} | {ver} |")

    w('\n## Clases PHP\n')
    w('Cuenta SQL: la que abre la propia clase (o su clase base). «Permisos»: lo que lee y escribe frente al contrato de su cuenta.\n')
    w('| Clase | Tipo | Cuenta SQL | Escribe en | Permisos | Usada por rutas |\n|---|---|---|---|---|---|')
    for c in sorted(classes, key=lambda x: (classes[x]['kind'], x)):
        info = classes[c]
        if info['kind'] not in ('Controllers', 'Libraries'):
            continue
        acc = inherited(classes, c, 'account')
        n = sum(1 for r in rts if c in closure(classes, r['controller']))
        wr = ', '.join(sorted(info['writes'])) or '—'
        perm = '—' if acc not in contract else ('OK' if not info.get('missing') else '⚠ falta ' + ', '.join(f'{p} {t}' for t, p in info['missing']))
        w(f"| {c} | {'controlador' if info['kind'] == 'Controllers' else 'librería'}{' (base)' if info['abstract'] else ''} | {acc or '—'} | {wr} | {perm} | {n} |")

    w('\n## Componentes de la interfaz y su conexión\n')
    w('Conexión (estática): **directa** = importa un cliente HTTP (`fetch`); **contenedor** = sus tarjetas o vistas hijas se conectan; '
      '**por props** = recibe los datos ya consultados por el componente que lo usa; **alias** = solo reexporta otro componente. '
      'Rutas en vivo: rutas distintas que el componente originó en la corrida (pila de llamadas del navegador).\n')
    w('| Componente (`src/…`) | Conexión | Rutas en vivo |\n|---|---|---|')
    users = collections.defaultdict(set)
    for f in reach:
        for i in files[f]['imports']:
            users[i].add(f)
    def kind(f):
        if f == 'src/main.jsx':
            return 'punto de entrada'
        if files[f]['alias']:
            return 'alias de `' + ', '.join(i[4:] for i in files[f]['imports']) + '`'
        if imports_api(f):
            return 'directa'
        kids = [i for i in files[f]['imports'] if files[i]['component'] and imports_api(i)]
        if kids:
            return 'contenedor (' + ', '.join(os.path.basename(i) for i in kids) + ')'
        return 'por props (desde ' + ', '.join(sorted(os.path.basename(u) for u in users[f])) + ')'
    def hooks(f):  # módulos .js/.mjs que el componente importa y que no son clientes HTTP (p. ej. useMatrixData.js)
        return [i for i in files[f]['imports'] if not files[i]['component'] and not files[i]['fetch']]
    for f in comps:
        got = sorted(set(by_file.get(f, ())).union(*[by_file.get(h, set()) for h in hooks(f)]))
        live_txt = '—' if not a.initiator_log else (f"{len(got)}: " + ', '.join(f'{m} {p[8:]}' for m, p in got[:5]) + (' …' if len(got) > 5 else '') if got else '0')
        w(f"| `{f[4:]}` | {kind(f)} | {live_txt} |")

    w('\n## Hallazgos\n')
    mark = len(L)
    if orphans:
        w(f"- Clases PHP sin uso desde ninguna ruta: {', '.join(orphans)}.")
    if unreachable:
        w(f"- Archivos JS sin uso (no alcanzables desde `src/main.jsx`): {', '.join(unreachable)}.")
    if static_unknown:
        w(f"- Literales `/api/v1` del frontend sin ruta equivalente: {', '.join(f'{f}: {l}' for f, l in static_unknown)}.")
    if a.access_log:
        never = [f"{r['method']} {r['path']}" for r in rts if not live.get((r['method'], r['path'])) and not r['scripts']]
        if never:
            w(f"- Rutas sin ninguna petición en la corrida ({len(never)}): {', '.join(f'`{x}`' for x in never)}.")
        nui_only = [f"{r['method']} {r['path']}" for r in rts if live.get((r['method'], r['path'])) and not from_ui((r['method'], r['path']))]
        if nui_only:
            w(f"- Rutas probadas solo por HTTP, sin pantalla que las llame ({len(nui_only)}): {', '.join(f'`{x}`' for x in nui_only)}.")
        if s5:
            w(f"- Respuestas 5xx: {', '.join(f'{m} {p}' for m, p in s5)}.")
        probes = {k: n for k, n in unmatched.items() if k[3] == 'http'}
        if probes:
            sts = collections.Counter()
            for k, n in probes.items():
                sts[k[2]] += n
            w(f"- Sondas de las pruebas HTTP a rutas que **no deben existir** (p. ej. POST/PUT/PATCH/DELETE en módulos de solo lectura): {sum(probes.values())} peticiones, "
              f"todas rechazadas ({', '.join(f'{st}×{n}' for st, n in sorted(sts.items()))}).")

    L[mark:mark] = [f'- ⚠ {p}' for p in problems] or ['- Sin rutas rotas, sin llamadas de la interfaz a rutas inexistentes y sin permisos SQL faltantes.']
    report = '\n'.join(L) + '\n'
    if a.markdown:
        with open(a.markdown, 'w', encoding='utf8') as fh:
            fh.write(report)
    else:
        print(report)
    if a.json:
        with open(a.json, 'w', encoding='utf8') as fh:
            json.dump({'routes': [{k: v for k, v in r.items() if k != 'rx'} for r in rts], 'orphans': orphans, 'unreachable': unreachable,
                       'problems': problems, 'origin': {f'{m} {p}': sorted(v) for (m, p), v in origin.items()}}, fh, ensure_ascii=False, indent=1)
    print(f'Mapa de conexión: {len(rts)} rutas, {len(classes)} clases PHP, {len(reach)} archivos de interfaz · problemas: {len(problems)}', file=sys.stderr)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""SupplyFlow INT03 · Inspección SOLO LECTURA de un respaldo SQL antes de restaurarlo.

Uso: python -I dump_inspect.py /backups/supplyflow_dev.sql
Nunca imprime filas de datos ni secretos: solo tamaño, SHA-256, codificación, encabezado del
volcado, nombres de tablas y conteos de sentencias. Resultado PASS solo si el volcado es
UTF-8, completo, de `supplyflow_dev`, con 77 tablas (R3C1-HF2/R3C2/R3C3) y sin cuentas/esquema mysql.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

EXPECTED_TABLES = 77
R3_TABLES = ('requisition_change_commercial_assessments', 'requisition_change_commercial_executions',
             'requisition_change_commercial_execution_reviews')
NAME = r'`?([A-Za-z0-9_$]+)`?'


def inspect(path: Path) -> dict:
    report: dict = {'tool': 'SupplyFlow INT03 dump inspect', 'file': path.name, 'result': 'BLOCKED', 'reasons': []}
    if not path.is_file():
        report['reasons'].append('DUMP_NOT_FOUND')
        return report
    sha = hashlib.sha256()
    tables: list[str] = []
    databases: set[str] = set()
    uses: set[str] = set()
    counts = {'insert_statements': 0, 'drop_table': 0, 'drop_database': 0, 'create_user': 0, 'grant': 0,
              'create_trigger_view_routine': 0, 'non_utf8_lines': 0}
    header: list[str] = []
    hf2 = False
    last_comment = ''
    with path.open('rb') as fh:
        first = fh.read(4)
        fh.seek(0)
        report['first_bytes'] = first.hex(' ').upper()
        if first[:2] in (b'\xff\xfe', b'\xfe\xff'):
            report['encoding'] = 'UTF-16'
            report['reasons'].append('DUMP_IS_UTF16_REGENERATE_WITHOUT_POWERSHELL_REDIRECTION')
            for chunk in iter(lambda: fh.read(1 << 20), b''):
                sha.update(chunk)
            report['sha256'] = sha.hexdigest()
            report['size_bytes'] = path.stat().st_size
            return report
        report['encoding'] = 'UTF-8 con BOM' if first[:3] == b'\xef\xbb\xbf' else 'UTF-8/ASCII'
        for n, raw in enumerate(fh):
            sha.update(raw)
            try:
                line = raw.decode('utf-8-sig' if n == 0 else 'utf-8')
            except UnicodeDecodeError:
                counts['non_utf8_lines'] += 1
                continue
            if n < 6 and line.startswith('--'):
                header.append(line.rstrip()[:160])
            if line.startswith('-- '):
                last_comment = line.strip()
            if m := re.match(r'CREATE TABLE (?:IF NOT EXISTS )?' + NAME, line):
                tables.append(m.group(1))
            elif m := re.match(r'CREATE DATABASE (?:/\*!\d+ )?(?:IF NOT EXISTS )?(?:\*/ )?' + NAME, line):
                databases.add(m.group(1))
            elif m := re.match(r'USE ' + NAME, line):
                uses.add(m.group(1))
            elif line.startswith('INSERT INTO'):
                counts['insert_statements'] += 1
            elif line.startswith('DROP TABLE'):
                counts['drop_table'] += 1
            elif re.match(r'(/\*!\d+ )?DROP DATABASE', line):
                counts['drop_database'] += 1
            elif re.search(r'\bCREATE USER\b', line):
                counts['create_user'] += 1
            elif line.startswith('GRANT '):
                counts['grant'] += 1
            elif re.search(r'\bCREATE\b.*\b(TRIGGER|VIEW|PROCEDURE|FUNCTION|EVENT)\b', line) and not line.startswith('--'):
                counts['create_trigger_view_routine'] += 1
            if 'ck_reqchangeitems_resolution' in line and "'add'" in line:
                hf2 = True
    report.update({'size_bytes': path.stat().st_size, 'sha256': sha.hexdigest(), 'header': header,
                   'tables': len(tables), 'distinct_tables': len(set(tables)), 'databases': sorted(databases),
                   'use': sorted(uses), 'r3_tables': {t: t in tables for t in R3_TABLES}, 'r3c1_hf2_check': hf2,
                   'counts': counts, 'completed_marker': last_comment.startswith('-- Dump completed')})
    reasons = report['reasons']
    if len(set(tables)) != EXPECTED_TABLES:
        reasons.append(f'TABLES_{len(set(tables))}_NOT_77' + ('_PRE_INT03_BACKUP' if len(set(tables)) == 74 else ''))
    if not all(report['r3_tables'].values()):
        reasons.append('R3_TABLES_MISSING')
    if not hf2:
        reasons.append('R3C1_HF2_CHECK_NOT_FOUND')
    if (databases | uses) - {'supplyflow_dev'}:
        reasons.append('OTHER_DATABASES_IN_DUMP')
    if counts['non_utf8_lines']:
        reasons.append('NON_UTF8_LINES')
    if counts['create_user'] or counts['grant']:
        reasons.append('ACCOUNTS_IN_DUMP_REVIEW_MANUALLY')
    if not report['completed_marker']:
        reasons.append('DUMP_COMPLETED_MARKER_MISSING_POSSIBLY_TRUNCATED')
    if counts['insert_statements'] == 0:
        reasons.append('NO_DATA_INSERTS')
    report['result'] = 'PASS' if not reasons else 'BLOCKED'
    return report


def main() -> int:
    if len(sys.argv) != 2:
        print('uso: dump_inspect.py <archivo.sql>', file=sys.stderr)
        return 2
    report = inspect(Path(sys.argv[1]))
    print(json.dumps(report, ensure_ascii=True, indent=1))
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())

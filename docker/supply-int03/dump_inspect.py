#!/usr/bin/env python3
"""SupplyFlow INT03 · Inspección SOLO LECTURA de un respaldo SQL antes de restaurarlo.

Uso: python -I dump_inspect.py /backups/supplyflow_dev.sql
Nunca imprime filas de datos ni secretos: solo tamaño, SHA-256, codificación, encabezado del
volcado, formato, conteos de sentencias y conteos estructurales.

Formatos admitidos:
- mariadb-dump: debe terminar con "-- Dump completed" e incluir las 55 CHECK con R3C1-HF2.
- phpMyAdmin (5.2.x): termina con el pie /*!40101 SET COLLATION_CONNECTION=...*/; y OMITE todas
  las CHECK con nombre (comprobado con phpMyAdmin 5.2.3 sobre MariaDB 11.8.9). En ese caso la
  restauración (restore.sh) las repone desde el DDL versionado y verifica que los datos las cumplen.
Las cantidades esperadas (77 tablas, 256 llaves foráneas, 55 CHECK) se derivan del DDL del repositorio.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

R3_TABLES = ('requisition_change_commercial_assessments', 'requisition_change_commercial_executions',
             'requisition_change_commercial_execution_reviews')
NAME = r'`?([A-Za-z0-9_$]+)`?'
DDL_FILES = [Path('/docker/supply-db/sql/01_schema.sql'), Path('/migrations/manual/R3C1_requisition_change_add_check.sql'),
             Path('/migrations/manual/R3C2_commercial_assessment_ledger.sql'), Path('/migrations/manual/R3C3_commercial_execution_evidence.sql')]
PMA_FOOTER = '/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;'


def expected_from_repository() -> dict:
    """Counts from the versioned DDL; falls back to the 77/256/55 contract if the files are not mounted."""
    if all(p.is_file() for p in DDL_FILES):
        ddl = '\n'.join(re.sub(r'--[^\n]*', '', p.read_text(encoding='utf8')) for p in DDL_FILES)
        return {'source': 'repository_ddl', 'tables': len(set(re.findall(r'CREATE TABLE\s+`?(\w+)', ddl))),
                'foreign_keys': len(re.findall(r'\bFOREIGN KEY\b', ddl)),
                'named_checks': len(set(re.findall(r'CONSTRAINT\s+`?(\w+)`?\s+CHECK', ddl)))}
    return {'source': 'contract_constants', 'tables': 77, 'foreign_keys': 256, 'named_checks': 55}


def inspect(path: Path) -> dict:
    report: dict = {'tool': 'SupplyFlow INT03 dump inspect', 'file': path.name, 'result': 'BLOCKED', 'reasons': [], 'notes': []}
    if not path.is_file():
        report['reasons'].append('DUMP_NOT_FOUND')
        return report
    expected = expected_from_repository()
    report['expected'] = expected
    sha = hashlib.sha256()
    tables: list[str] = []
    databases: set[str] = set()
    uses: set[str] = set()
    checks: set[str] = set()
    counts = {'insert_statements': 0, 'foreign_keys': 0, 'drop_table': 0, 'drop_database': 0, 'create_user': 0, 'grant': 0,
              'create_trigger_view_routine': 0, 'commit': 0, 'non_utf8_lines': 0}
    header: list[str] = []
    hf2 = False
    last_comment = ''
    last_line = ''
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
            stripped = line.strip()
            if stripped:
                last_line = stripped  # only compared against fixed footers, never printed
            if n < 8 and line.startswith('--'):
                header.append(line.rstrip()[:160])
            if line.startswith('-- '):
                last_comment = stripped
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
            elif stripped == 'COMMIT;':
                counts['commit'] += 1
            elif re.search(r'\bCREATE\b.*\b(TRIGGER|VIEW|PROCEDURE|FUNCTION|EVENT)\b', line) and not line.startswith('--'):
                counts['create_trigger_view_routine'] += 1
            counts['foreign_keys'] += len(re.findall(r'CONSTRAINT `?\w+`? FOREIGN KEY', line))
            for c in re.findall(r'CONSTRAINT `?(\w+)`? CHECK', line):
                checks.add(c)
            if 'ck_reqchangeitems_resolution' in line and "'add'" in line:
                hf2 = True
    head = '\n'.join(header)
    fmt = 'phpmyadmin' if head.startswith('-- phpMyAdmin SQL Dump') else 'mariadb-dump' if re.search(r'^-- (MariaDB|MySQL) dump', head, re.M) else 'desconocido'
    complete = last_comment.startswith('-- Dump completed') if fmt == 'mariadb-dump' else (last_line == PMA_FOOTER and counts['commit'] > 0) if fmt == 'phpmyadmin' else False
    report.update({'format': fmt, 'size_bytes': path.stat().st_size, 'sha256': sha.hexdigest(), 'header': header,
                   'tables': len(set(tables)), 'distinct_tables': len(set(tables)), 'databases': sorted(databases),
                   'use': sorted(uses), 'r3_tables': {t: t in tables for t in R3_TABLES}, 'named_checks': len(checks),
                   'r3c1_hf2_check': hf2, 'counts': counts, 'completed_marker': complete})
    reasons, notes = report['reasons'], report['notes']
    if fmt == 'desconocido':
        reasons.append('UNKNOWN_DUMP_FORMAT_USE_MARIADB_DUMP_OR_PHPMYADMIN')
    if len(set(tables)) != expected['tables']:
        reasons.append(f"TABLES_{len(set(tables))}_NOT_{expected['tables']}" + ('_PRE_INT03_BACKUP' if len(set(tables)) == 74 else ''))
    if not all(report['r3_tables'].values()):
        reasons.append('R3_TABLES_MISSING')
    if counts['foreign_keys'] != expected['foreign_keys']:
        reasons.append(f"FOREIGN_KEYS_{counts['foreign_keys']}_NOT_{expected['foreign_keys']}")
    if fmt == 'phpmyadmin' and not checks:
        notes.append(f"PHPMYADMIN_OMITTED_{expected['named_checks']}_CHECKS_RESTORE_REAPPLIES_FROM_REPOSITORY_AND_VALIDATES_DATA")
    elif len(checks) != expected['named_checks']:
        reasons.append(f"NAMED_CHECKS_{len(checks)}_NOT_{expected['named_checks']}")
    elif not hf2:
        reasons.append('R3C1_HF2_CHECK_NOT_FOUND')
    if (databases | uses) - {'supplyflow_dev'}:
        reasons.append('OTHER_DATABASES_IN_DUMP')
    if counts['non_utf8_lines']:
        reasons.append('NON_UTF8_LINES')
    if counts['create_user'] or counts['grant']:
        reasons.append('ACCOUNTS_IN_DUMP_REVIEW_MANUALLY')
    if not complete:
        reasons.append('DUMP_END_NOT_FOUND_POSSIBLY_TRUNCATED')
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

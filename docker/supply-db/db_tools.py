#!/usr/bin/env python3
"""Administración y QA LOCAL de SupplyFlow v0.3 por socket Unix exclusivamente.

No acepta host, puerto, contraseña, nombre de base ni SQL arbitrario como opciones.
DEV conserva sus datos. La suite sintética sólo puede usar TEST. No hay limpieza
destructiva: cualquier instalación parcial exige investigar y no se reimporta.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from typing import Any

WORK = Path(__file__).resolve().parent
SOCKET = Path("/run/mysqld/mysqld.sock")
SECRET = Path("/run/secrets/root_password")
EVIDENCE = Path("/evidence")
DEV = "supplyflow_dev"
TEST = "supplyflow_test_docker_v03"
SCHEMA_SHA256 = "2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5"
PINNED = {
    "sql/01_schema.sql": SCHEMA_SHA256,
    "sql/00_preflight.sql": "a48c27cde3f1a9b0f2828f047a46fa543c11e812923065d71738ef381701cb1d",
    "sql/02_verify.sql": "28c81fd523b0753bae8a95950ca024f476a993c78df7f528e833490275be0233",
    "test_schema_integration.py": "93a8c64f7ba8d68f99a8d0f95914a63441f7f1b17392106e3adba10674868fc9",
    "schema_inventory_v03.json": "1b48bc360f635c2b95a081e7da14d97b5c716b78ea8818dce9c12c1178697d95",
}
STRICT_MODE = "STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION,NO_ZERO_DATE,NO_ZERO_IN_DATE"
COUNTS = {
    "tables": 74, "columns": 1179, "primary_keys": 74, "unique_keys": 149,
    "foreign_keys": 246, "domain_checks": 49, "json_checks": 62, "total_checks": 111,
}
CASE_NAMES = {
    "transaction_rollback", "orphan_foreign_key", "user_person_organization_scope",
    "requisition_client_organization_scope", "unique_public_id",
    "folio_binary_nopad_and_unique", "decimal_exact_roundtrip_and_sum",
    "decimal_range_strict", "positive_quantity_check", "unique_requisition_line_number",
    "json_validation_and_unicode", "auth_principal_check", "auth_expiry_check",
    "idempotency_scope_and_document_revisions", "decimal_excess_scale_is_not_rejected",
}


class GuardError(RuntimeError):
    pass


def ensure(condition: Any, message: str) -> None:
    if not condition:
        raise GuardError(message)


def identifier(value: str) -> str:
    ensure(re.fullmatch(r"[a-z][a-z0-9_]*", value), "Identificador local inválido")
    return "`" + value + "`"


def check_version(version: str) -> None:
    ensure(re.match(r"^11\.8\.9-MariaDB(?:[-+].*)?$", version, re.I),
           "Se requiere MariaDB exactamente 11.8.9; versión observada: " + version)


def load_payloads() -> tuple[dict[str, bytes], list[str]]:
    payloads = {}
    for name, expected in PINNED.items():
        raw = (WORK / name).read_bytes()
        ensure(hashlib.sha256(raw).hexdigest() == expected,
               "Hash distinto al artefacto v0.3: " + name + "; no se ejecutará")
        payloads[name] = raw
    inventory = json.loads(payloads["schema_inventory_v03.json"])
    names = sorted(table["name"] for table in inventory["tables"])
    ensure(inventory["schema_sha256"] == SCHEMA_SHA256 and len(set(names)) == 74 and len(names) == 74,
           "Inventario v0.3 inesperado")
    for name in names:
        identifier(name)
    return payloads, names


def split_statements(source: str) -> list[str]:
    """Divide el SQL fijado por hash, respetando comentarios y literales."""
    result, current = [], []
    quote = None
    i = 0
    while i < len(source):
        char = source[i]
        if quote:
            current.append(char)
            if char == "\\" and i + 1 < len(source):
                i += 1
                current.append(source[i])
            elif char == quote:
                if i + 1 < len(source) and source[i + 1] == quote:
                    i += 1
                    current.append(source[i])
                else:
                    quote = None
        elif char in "'\"`":
            quote = char
            current.append(char)
        elif (source.startswith("--", i) and (i + 2 == len(source) or source[i + 2].isspace())) or char == "#":
            end = source.find("\n", i)
            i = len(source) if end < 0 else end
            current.append("\n")
        elif source.startswith("/*", i):
            end = source.find("*/", i + 2)
            ensure(end >= 0, "Comentario SQL sin cierre")
            ensure(not source.startswith(("/*!", "/*M!"), i), "Comentario SQL ejecutable no permitido")
            i = end + 1
            current.append(" ")
        elif char == ";":
            statement = "".join(current).strip()
            if statement:
                result.append(statement)
            current = []
        else:
            current.append(char)
        i += 1
    ensure(quote is None, "Literal SQL sin cierre")
    tail = "".join(current).strip()
    if tail:
        result.append(tail)
    ensure(result, "Diagnóstico SQL vacío")
    return result


def select_statements(source: str) -> list[str]:
    result = split_statements(source)
    for statement in result:
        ensure(re.match(r"^(SELECT|WITH)\b", statement, re.I), "Diagnóstico contiene una sentencia ajena a SELECT/CTE")
    return result


def query(connection: Any, sql: str, parameters: Any = None) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(sql, parameters)
        return list(cursor.fetchall())


def scalar(connection: Any, sql: str, parameters: Any = None) -> Any:
    rows = query(connection, sql, parameters)
    ensure(len(rows) == 1 and len(rows[0]) == 1, "Consulta escalar inesperada")
    return next(iter(rows[0].values()))


def bootstrap(connection: Any) -> None:
    statements = (
        "SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci",
        "SET SESSION time_zone = '+00:00'",
        "SET SESSION sql_mode = '" + STRICT_MODE + "'",
        "SET SESSION foreign_key_checks = 1",
        "SET SESSION check_constraint_checks = 1",
        "SET SESSION unique_checks = 1",
        "SET SESSION innodb_strict_mode = 1",
    )
    for statement in statements:
        query(connection, statement)


def connect(password: str) -> Any:
    ensure(SOCKET.is_absolute() and stat.S_ISSOCK(SOCKET.stat().st_mode),
           "Falta el socket Unix local; iniciar db y esperar estado healthy")
    ensure(metadata.version("PyMySQL") == "1.1.2", "Se requiere PyMySQL 1.1.2")
    import pymysql
    connection = pymysql.connect(
        unix_socket=str(SOCKET), user="root", password=password,
        charset="utf8mb4", autocommit=True,
        connect_timeout=10, read_timeout=120, write_timeout=120,
        client_flag=pymysql.constants.CLIENT.MULTI_STATEMENTS,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        check_version(str(scalar(connection, "SELECT VERSION()")))
        bootstrap(connection)
        return connection
    except BaseException:
        connection.close()
        raise


def database_exists(connection: Any, name: str) -> bool:
    ensure(name in (DEV, TEST), "Base ajena al laboratorio")
    return bool(scalar(connection, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s", (name,)))


def object_counts(connection: Any, name: str) -> dict[str, int]:
    counts = {}
    for kind, relation, schema_column in (
        ("tables_and_views", "TABLES", "TABLE_SCHEMA"),
        ("routines", "ROUTINES", "ROUTINE_SCHEMA"),
        ("triggers", "TRIGGERS", "TRIGGER_SCHEMA"),
        ("events", "EVENTS", "EVENT_SCHEMA"),
    ):
        counts[kind] = int(scalar(connection,
            f"SELECT COUNT(*) FROM information_schema.{relation} WHERE {schema_column}=%s", (name,)))
    return counts


def diagnostics(connection: Any, raw: bytes, expected_count: int) -> list[dict[str, Any]]:
    statements = select_statements(raw.decode("utf-8"))
    ensure(len(statements) == expected_count, "Número de bloques SQL distinto al contrato")
    results = []
    for ordinal, statement in enumerate(statements, 1):
        with connection.cursor() as cursor:
            cursor.execute(statement)
            rows = list(cursor.fetchall())
            warnings = int(cursor._result.warning_count)
            ensure(warnings == 0, f"Advertencia SQL en bloque {ordinal}; no se acepta como verificado")
            results.append({"statement": ordinal, "row_count": len(rows), "rows": rows, "warning_count": warnings})
    return results


def section(results: list[dict[str, Any]], ordinal: int, label: str, rows: int) -> list[dict[str, Any]]:
    block = results[ordinal - 1]
    values = block["rows"]
    ensure(block["statement"] == ordinal and len(values) == rows and block["row_count"] == rows,
           f"Cantidad inesperada de filas en {label}")
    ensure(all(value.get("seccion") == label for value in values), "Etiqueta SQL inesperada: " + label)
    ensure(all(value.get("estado", "OK") == "OK" for value in values), "Diagnóstico no conforme: " + label)
    return values


def validate_preflight(results: list[dict[str, Any]], database: str) -> None:
    ensure(len(results) == 8, "Faltan bloques preflight")
    env = section(results, 1, "01_entorno", 1)[0]
    check_version(env["version_real"])
    ensure(env["base_seleccionada"] == database and env["estado_version"] == env["estado_base"] == "OK", "Entorno preflight incorrecto")
    empty = section(results, 2, "02_base_vacia", 1)[0]
    ensure(all(int(empty[key]) == 0 for key in ("tablas_y_vistas", "rutinas", "triggers", "eventos")), "La base debe tener cero objetos antes del DDL")
    charset = section(results, 3, "03_charset", 1)[0]
    ensure(all(charset[key] == "utf8mb4" for key in ("charset_cliente", "charset_conexion", "charset_resultados")) and charset["collation_conexion"] == "utf8mb4_uca1400_nopad_ai_ci", "Sesión sin charset/collation requerido")
    modes = section(results, 4, "04_modos", 1)[0]
    ensure(set(modes["sql_mode_sesion"].split(",")) == set(STRICT_MODE.split(",")), "Modo estricto de sesión incorrecto")
    ensure(modes["zona_sesion"] == "+00:00" and int(modes["innodb_strict_sesion"]) == 1, "Sesión sin UTC/innodb_strict")
    checks = section(results, 5, "05_precondiciones", 1)[0]
    ensure(all(value == "OK" for key, value in checks.items() if key != "seccion"), "Precondiciones del motor no satisfechas")
    section(results, 6, "06_innodb", 1)
    collations = section(results, 7, "07_collations", 4)
    ensure({row["solicitada"] for row in collations} == {"ascii_bin", "utf8mb4_bin", "utf8mb4_nopad_bin", "utf8mb4_uca1400_nopad_ai_ci"}, "Inventario de collations inesperado")
    semantics = section(results, 8, "08_semantica_collations", 1)[0]
    ensure(all(int(value) == (1 if key == "texto_mayusculas_debe_1" else 0)
               for key, value in semantics.items() if key != "seccion"), "Semántica de collations incorrecta")


def validate_verification(results: list[dict[str, Any]], database: str, names: list[str]) -> dict[str, Any]:
    ensure(len(results) == 12, "Faltan bloques postflight")
    env = section(results, 1, "01_entorno", 1)[0]
    check_version(env["version_real"])
    ensure(env["base_seleccionada"] == database, "Postflight seleccionó otra base")
    tables = section(results, 2, "02_tablas", 1)[0]
    ensure(int(tables["esperadas"]) == int(tables["encontradas"]) == 74 and int(tables["diferencias"]) == 0, "Inventario de tablas distinto")
    table_rows = results[2]["rows"]
    ensure(results[2]["statement"] == 3 and len(table_rows) == 74 and sorted(row["TABLE_NAME"] for row in table_rows) == names,
           "Listado de tablas incompleto o inesperado")
    ensure(all(row["TABLE_TYPE"] == "BASE TABLE" and row["ENGINE"] == "InnoDB" and row["ROW_FORMAT"].upper() == "DYNAMIC" and row["TABLE_COLLATION"] == "utf8mb4_uca1400_nopad_ai_ci" for row in table_rows), "Motor/formato/collation distintos")
    for ordinal, label, count in (
        (4, "03_columnas", 1179), (5, "04_pk_unique", 223),
        (6, "05_foreign_keys", 246), (7, "06_checks_dominio", 49),
    ):
        row = section(results, ordinal, label, 1)[0]
        ensure(int(row["tabla"]) == int(row["objeto"]) == count, "Conteo inesperado: " + label)
    json_check = section(results, 8, "07_json", 1)[0]
    ensure(int(json_check["tabla"]) == 62 and json_check["objeto"] == "LONGTEXT+JSON_VALID", "JSON no coincide con v0.3")
    constraints = section(results, 9, "08_totales_restricciones", 4)
    expected = {"PRIMARY KEY": 74, "UNIQUE": 149, "FOREIGN KEY": 246, "CHECK": 111}
    ensure({row["tipo"] for row in constraints} == set(expected), "Tipos de restricción inesperados")
    ensure(all(int(row["esperadas"]) == int(row["encontradas"]) == expected[row["tipo"]] for row in constraints), "Restricciones incompletas")
    defaults = section(results, 10, "09_defaults_sensibles", 3)
    ensure({(row["TABLE_NAME"], row["COLUMN_NAME"], row["COLUMN_DEFAULT"]) for row in defaults} == {
        ("files", "scan_status", "'pending'"), ("users", "access_enabled", "0"),
        ("users", "credential_state", "'reset_required'"),
    }, "Defaults sensibles incorrectos")
    auxiliary = section(results, 11, "10_objetos_auxiliares", 1)[0]
    ensure(all(int(auxiliary[key]) == 0 for key in ("rutinas_debe_0", "triggers_debe_0", "eventos_debe_0")), "Objetos auxiliares inesperados")
    rows = section(results, 12, "11_filas_exactas", 74)
    ensure(sorted(row["table_name"] for row in rows) == names, "Conteo exacto de filas incompleto")
    ensure(all(int(row["filas"]) == 0 for row in rows), "La fase de fundación exige cero filas; no se borrará ningún dato")
    return {"counts": dict(COUNTS), "tables": 74, "rows_total": 0,
            "exact_row_counts_performed": 74, "diagnostic_blocks": 12}


def normalized_create(ddl: str) -> str:
    """Omite únicamente el siguiente AUTO_INCREMENT de las opciones de tabla.

    El contador puede avanzar después de ROLLBACK sin modificar el esquema.
    Las definiciones de columnas, índices, FK, CHECK y defaults se conservan.
    """
    head, separator, options = ddl.rpartition(") ENGINE=")
    ensure(bool(separator), "SHOW CREATE TABLE sin opciones ENGINE esperadas")
    # AUTO_INCREMENT se ubica antes de DEFAULT CHARSET; no tocar COMMENT/literales.
    prefix, charset, suffix = options.partition(" DEFAULT CHARSET=")
    ensure(bool(charset), "SHOW CREATE TABLE sin DEFAULT CHARSET esperado")
    prefix = re.sub(r" AUTO_INCREMENT=\d+(?= |$)", "", prefix)
    return head + separator + prefix + charset + suffix


def fingerprint(connection: Any, names: list[str]) -> str:
    definitions = []
    for name in sorted(names):
        row = query(connection, "SHOW CREATE TABLE " + identifier(name))[0]
        definitions.append({"table": name, "ddl": normalized_create(row["Create Table"])})
    canonical = json.dumps(definitions, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def verify_database(connection: Any, database: str, payloads: dict[str, bytes], names: list[str]) -> dict[str, Any]:
    ensure(database_exists(connection, database), "La base no existe; ejecutar install para DEV o test para TEST")
    connection.select_db(database)
    query(connection, "START TRANSACTION READ ONLY")
    try:
        results = diagnostics(connection, payloads["sql/02_verify.sql"], 12)
        checked = validate_verification(results, database, names)
        checked.update({"database": database, "structure_fingerprint": fingerprint(connection, names),
                        "fingerprint_method": "sha256_sorted_show_create_table_without_next_auto_increment_v1",
                        "diagnostic_results": results})
        return checked
    finally:
        connection.rollback()


def apply_schema(connection: Any, raw: bytes) -> dict[str, Any]:
    sql = raw.decode("utf-8")
    statement_count = len(split_statements(sql))
    ensure(statement_count == 92, "El DDL fijado por hash debe contener 92 sentencias")
    completed = 0
    warnings = 0
    # El servidor interrumpe el lote ante el primer error. No se intenta rollback
    # del DDL (commits implícitos), reimportación, reparación ni limpieza.
    with connection.cursor() as cursor:
        cursor.execute(sql)
        while True:
            if cursor.description:
                cursor.fetchall()
            completed += 1
            warnings += int(cursor._result.warning_count)
            if not cursor.nextset():
                break
    # Este archivo exacto termina con comentarios después del último ';'.
    # MariaDB 11.8.9 devuelve un OK adicional para esa cola sin sentencia.
    # Se cuentan por separado las 92 sentencias y los 93 paquetes recibidos;
    # no se omiten errores de nextset ni se cambia un byte del archivo DDL.
    ensure(completed == statement_count + 1,
           f"DDL produjo {completed} resultados de protocolo; se esperaban 93 (92 sentencias + cola de comentarios)")
    ensure(warnings == 0, "DDL produjo advertencias; revisar instalación antes de continuar")
    return {"ddl_statements_completed": statement_count, "ddl_protocol_results": completed,
            "ddl_comment_tail_results": 1, "ddl_warning_count": warnings}


def prepare_database(connection: Any, database: str, payloads: dict[str, bytes], names: list[str], allow_existing: bool) -> dict[str, Any]:
    exists = database_exists(connection, database)
    objects = object_counts(connection, database) if exists else {"tables_and_views": 0, "routines": 0, "triggers": 0, "events": 0}
    if sum(objects.values()):
        if not allow_existing:
            return {"result": "SKIPPED", "status": "ALREADY_EXISTS", "database": database,
                    "objects": objects,
                    "message": "La base ya contiene objetos. No se reimportó el SQL ni se cambiaron datos. Ejecutar verify; si hay diferencias, investigar sin borrar ni reinicializar."}
        checked = verify_database(connection, database, payloads, names)
        return {"result": "PASS", "status": "EXISTING_VERIFIED_EMPTY", **checked}
    if not exists:
        query(connection, "CREATE DATABASE " + identifier(database) + " CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci")
    connection.select_db(database)
    preflight = diagnostics(connection, payloads["sql/00_preflight.sql"], 8)
    validate_preflight(preflight, database)
    ensure(sum(object_counts(connection, database).values()) == 0, "Aparecieron objetos antes del DDL; se detiene")
    ddl = apply_schema(connection, payloads["sql/01_schema.sql"])
    checked = verify_database(connection, database, payloads, names)
    return {"result": "PASS", "status": "INSTALLED", "preflight_results": preflight, **ddl, **checked}


def validate_suite(report: dict[str, Any]) -> None:
    ensure(report.get("database") == TEST and report.get("transport") == "local_unix_socket", "Suite ejecutada fuera de TEST/socket")
    check_version(str(report.get("server_version", "")))
    ensure(report.get("synthetic_only") is True and report.get("production_access") is False,
           "Alcance de suite inesperado")
    ensure(report.get("guard_checks") == "PASS" and report.get("table_count") == 74 and report.get("initial_rows") == 0, "Guardas de la suite fallaron")
    ensure(report.get("summary") == {"total": 15, "passed": 14, "observed_limitations": 1, "failed": 0, "final_rows": 0}, "Resumen de suite distinto a 14 PASS, 1 limitación y cero filas")
    cases = report.get("cases", [])
    ensure(len(cases) == 15 and {case.get("name") for case in cases} == CASE_NAMES, "Casos de suite incompletos o inesperados")
    ensure(Counter(case.get("status") for case in cases) == {"PASS": 14, "OBSERVED_LIMITATION": 1}, "Estados de casos inesperados")
    ensure(all(case.get("rollback_zero_rows") is True for case in cases), "La suite dejó filas; no se intentará limpiarlas")
    ensure(next(case for case in cases if case["status"] == "OBSERVED_LIMITATION")["name"] == "decimal_excess_scale_is_not_rejected", "Limitación inesperada")
    ensure(report.get("result") == "PASS_WITH_OBSERVED_LIMITATION", "La suite no pasó")


def write_report(path: Path, report: dict[str, Any], password: str = "") -> None:
    encoded = json.dumps(redact(report, password), ensure_ascii=False, indent=2, default=str) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(encoded, encoding="utf-8")
    temporary.replace(path)


def redact(value: Any, password: str) -> Any:
    if isinstance(value, str):
        return value.replace(password, "[REDACTED]") if password else value
    if isinstance(value, dict):
        return {key: redact(item, password) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [redact(item, password) for item in value]
    return value


def run_suite(connection: Any, password: str, payloads: dict[str, bytes], names: list[str], report: dict[str, Any]) -> None:
    prepared = prepare_database(connection, TEST, payloads, names, allow_existing=True)
    report["test_database_preparation"] = prepared
    output = EVIDENCE / "integration_results.json"
    write_report(output, {"result": "NOT_RUN", "database": TEST})
    child_env = dict(os.environ)
    child_env["SUPPLYFLOW_TEST_DB_PASSWORD"] = password
    arguments = [sys.executable, str(WORK / "test_schema_integration.py"),
                 "--socket", str(SOCKET), "--database", TEST, "--user", "root",
                 "--expected-version-prefix", "11.8.9", "--output", str(output)]
    try:
        outcome = subprocess.run(arguments, env=child_env, cwd=WORK, text=True,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600, check=False)
        report["suite_exit_code"] = outcome.returncode
    finally:
        # Verificar también después de un fallo/timeout; nunca borrar residuos.
        after = verify_database(connection, TEST, payloads, names)
        report["post_test_verification"] = after
    ensure(outcome.returncode == 0, "La suite terminó con error; revisar integration_results.json. " + outcome.stderr[-2000:].replace(password, "[REDACTED]"))
    integration = json.loads(output.read_text(encoding="utf-8"))
    validate_suite(integration)
    ensure(after["structure_fingerprint"] == prepared["structure_fingerprint"], "La estructura cambió durante la suite")
    report.update({"result": "PASS_WITH_OBSERVED_LIMITATION", "status": "TESTED",
                   "database": TEST, "summary": integration["summary"],
                   "tables": 74, "rows_total": 0, "structure_fingerprint": after["structure_fingerprint"],
                   "integration_report": "integration_results.json",
                   "observed_limitation": "MariaDB redondea un DECIMAL con exceso de escala; el backend debe validar escala/rango antes del INSERT."})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inspect", "install", "verify", "test"))
    args = parser.parse_args()
    report: dict[str, Any] = {
        "tool": "SupplyFlow Docker DB v0.1", "command": args.command,
        "executed_at_utc": datetime.now(timezone.utc).isoformat(),
        "result": "FAIL", "status": "FAILED", "schema_sha256": SCHEMA_SHA256,
        "transport": "local_unix_socket", "production_access": False,
        "database": TEST if args.command == "test" else DEV,
    }
    password = ""
    connection = None
    locked = False
    exit_code = 1
    try:
        payloads, names = load_payloads()
        password = SECRET.read_text(encoding="utf-8").rstrip("\r\n")
        ensure(bool(password) and "\x00" not in password and "\n" not in password and "\r" not in password,
               "Secreto local vacío o inválido")
        connection = connect(password)
        report["server_version"] = str(scalar(connection, "SELECT VERSION()"))
        report["driver"] = "PyMySQL " + metadata.version("PyMySQL")
        # Serializa este kit; no pretende bloquear a clientes externos futuros.
        locked = scalar(connection, "SELECT GET_LOCK('supplyflow_docker_db_v01', 10)") == 1
        ensure(locked, "Otra operación de este kit está activa; esperar e intentar de nuevo")
        if args.command == "inspect":
            databases = {}
            for name in (DEV, TEST):
                exists = database_exists(connection, name)
                databases[name] = {"exists": exists, "objects": object_counts(connection, name) if exists else None}
            report.update({"result": "PASS", "status": "INSPECTED", "databases": databases})
        elif args.command == "install":
            report.update(prepare_database(connection, DEV, payloads, names, allow_existing=False))
        elif args.command == "verify":
            report.update(verify_database(connection, DEV, payloads, names))
            report.update({"result": "PASS", "status": "VERIFIED"})
        elif args.command == "test":
            run_suite(connection, password, payloads, names, report)
        exit_code = 0
    except Exception as error:
        report.update({"result": "FAIL", "status": "FAILED", "error_type": type(error).__name__,
                       "error": str(error),
                       "recovery": "No se borraron datos ni se reinicializó el esquema. El DDL puede haber hecho commits parciales; revisar evidencia y estado antes de continuar."})
    finally:
        if connection is not None:
            if locked:
                try:
                    scalar(connection, "SELECT RELEASE_LOCK('supplyflow_docker_db_v01')")
                except Exception:
                    pass
            connection.close()
        report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
        try:
            write_report(EVIDENCE / (args.command + ".json"), report, password)
        except Exception as error:
            exit_code = 1
            report.update({"result": "FAIL", "status": "EVIDENCE_WRITE_FAILED", "evidence_error": str(error)})
        summary = {key: report[key] for key in (
            "command", "result", "status", "database", "server_version", "schema_sha256",
            "structure_fingerprint", "tables", "rows_total", "summary", "message", "error", "evidence_error",
        ) if key in report}
        encoded = json.dumps(redact(summary, password), ensure_ascii=False, default=str)
        print(encoded)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

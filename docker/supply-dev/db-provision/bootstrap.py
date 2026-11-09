#!/usr/bin/env python3
"""Cuenta local de la API de SupplyFlow: inspeccionar, preparar y verificar.

Sólo opera por el socket del MariaDB del laboratorio. No instala esquemas, no
modifica filas de negocio y no cambia contraseñas ni privilegios ajenos.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from typing import Any

FOUNDATION = Path("/foundation")
SECRETS = Path("/run/supply-secrets")
EVIDENCE = Path("/evidence")
SOCKET = Path("/run/mysqld/mysqld.sock")
FOUNDATION_SHA256 = "992449a098f8b5aad60f33580cf39cd8be3e27cfeb382dba8ab9b65486a471ea"
SCHEMA_SHA256 = "2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5"
FINGERPRINT = "d01df78964032449733773e52b0564f6e92f2e5c5ff3c3f5de40550052baea5e"
DATABASE = "supplyflow_dev"
USERNAME = "supplyflow_api_local"
ACCOUNT_HOST = "%"
GRANTEE = "'supplyflow_api_local'@'%'"
# En GRANT, '_' es un comodín incluso dentro de backticks. Escaparlo limita
# el permiso a esta base literal. No autoriza supplyflowXdev ni otras bases.
GRANT_DATABASE_PATTERN = r"supplyflow\_dev"
LOCK = "supplyflow_docker_db_v01"


class GuardError(RuntimeError):
    pass


def ensure(condition: Any, message: str) -> None:
    if not condition:
        raise GuardError(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_foundation() -> Any:
    path = FOUNDATION / "db_tools.py"
    ensure(path.is_file(), "Falta el kit Docker BD v0.1 en docker/supply-db.")
    ensure(hashlib.sha256(path.read_bytes()).hexdigest() == FOUNDATION_SHA256,
           "El módulo BD difiere de la versión validada. No se ejecutará.")
    spec = importlib.util.spec_from_file_location("supplyflow_db_foundation", path)
    ensure(spec is not None and spec.loader is not None, "No se pudo cargar la base de herramientas BD.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SOCKET = SOCKET
    return module


def read_secret(name: str, *, api: bool = False) -> str:
    path = SECRETS / name
    ensure(path.is_file(), "Falta el archivo de credencial local " + name + ".")
    value = path.read_text(encoding="utf-8").rstrip("\r\n")
    ensure(value and not any(char in value for char in ("\x00", "\r", "\n")),
           "La credencial local está vacía o tiene un formato inválido.")
    if api:
        ensure(re.fullmatch(r"[0-9a-f]{64}", value), "La credencial API debe ser el secreto local de 64 caracteres hexadecimales.")
    return value


def inspect_schema(db: Any, connection: Any) -> dict[str, Any]:
    _, names = db.load_payloads()
    ensure(db.SCHEMA_SHA256 == SCHEMA_SHA256, "Versión SQL inesperada.")
    ensure(db.database_exists(connection, DATABASE), "Falta supplyflow_dev. Completa primero la instalación del kit Docker BD.")
    objects = db.object_counts(connection, DATABASE)
    ensure(objects == {"tables_and_views": 74, "routines": 0, "triggers": 0, "events": 0},
           "Los objetos de supplyflow_dev difieren de la base validada v0.3.")
    observed = db.query(connection,
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
        (DATABASE,))
    ensure(sorted(row["TABLE_NAME"] for row in observed) == names, "El inventario de las 74 tablas no coincide.")
    connection.select_db(DATABASE)
    shape = db.fingerprint(connection, names)
    ensure(shape == FINGERPRINT, "La estructura cambió respecto del SQL v0.3. Revisar las migraciones antes de usar este kit.")
    # No contamos ni exigimos cero filas: futuros datos legítimos se conservan.
    return {"database": DATABASE, "tables": len(names), "schema_sha256": SCHEMA_SHA256,
            "structure_fingerprint": shape, "server_version": str(db.scalar(connection, "SELECT VERSION()")),
            "business_rows_modified": False}


def account_exists(db: Any, connection: Any) -> bool:
    rows = db.query(connection, "SELECT Host FROM mysql.global_priv WHERE User=%s", (USERNAME,))
    ensure(not rows or (len(rows) == 1 and rows[0]["Host"] == ACCOUNT_HOST),
           "Existen cuentas con el nombre API y otros hosts; requieren revisión manual.")
    return bool(rows)


def verify_credentials(db: Any, connection: Any, password: str) -> None:
    # La comparación ocurre en el servidor. No se recupera ni imprime el hash.
    compatible = db.scalar(connection, """
        SELECT COALESCE(JSON_VALUE(Priv, '$.plugin'), '') = 'mysql_native_password'
           AND COALESCE(JSON_VALUE(Priv, '$.authentication_string'), '') = PASSWORD(%s)
           AND COALESCE(JSON_LENGTH(JSON_EXTRACT(Priv, '$.auth_or')), 0) = 0
           AND COALESCE(JSON_VALUE(Priv, '$.account_locked'), 0) = 0
           AND COALESCE(JSON_VALUE(Priv, '$.is_role'), 0) = 0
        FROM mysql.global_priv WHERE User=%s AND Host=%s
        """, (password, USERNAME, ACCOUNT_HOST))
    ensure(int(compatible or 0) == 1,
           "La credencial o autenticación de la cuenta API no coincide. No se cambió ni restableció la contraseña.")


def verify_grants(db: Any, connection: Any, *, allow_empty: bool = False) -> bool:
    global_rows = db.query(connection,
        "SELECT PRIVILEGE_TYPE, IS_GRANTABLE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=%s", (GRANTEE,))
    ensure(all(row["PRIVILEGE_TYPE"] == "USAGE" and row["IS_GRANTABLE"] == "NO" for row in global_rows),
           "La cuenta API tiene privilegios globales adicionales. No se modificaron.")
    rows = db.query(connection,
        "SELECT TABLE_SCHEMA, PRIVILEGE_TYPE, IS_GRANTABLE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=%s", (GRANTEE,))
    expected = {"TABLE_SCHEMA": GRANT_DATABASE_PATTERN, "PRIVILEGE_TYPE": "SELECT", "IS_GRANTABLE": "NO"}
    ensure(rows == [expected] or (allow_empty and not rows),
           "La cuenta API tiene permisos de esquema distintos de SELECT sobre la base local exacta. No se revocaron ni ampliaron.")
    for table in ("TABLE_PRIVILEGES", "COLUMN_PRIVILEGES"):
        ensure(db.scalar(connection, "SELECT COUNT(*) FROM information_schema." + table + " WHERE GRANTEE=%s", (GRANTEE,)) == 0,
               "La cuenta API tiene permisos particulares adicionales; requieren revisión.")
    for table in ("procs_priv", "roles_mapping", "proxies_priv"):
        ensure(db.scalar(connection, "SELECT COUNT(*) FROM mysql." + table + " WHERE User=%s", (USERNAME,)) == 0,
               "La cuenta API tiene rutinas, roles o permisos proxy; requieren revisión.")
    return bool(rows)


def prepare_account(db: Any, connection: Any, password: str, exists: bool) -> str:
    if not exists:
        db.query(connection, "CREATE USER %s@%s IDENTIFIED VIA mysql_native_password USING PASSWORD(%s)",
                 (USERNAME, ACCOUNT_HOST, password))
    verify_credentials(db, connection, password)
    present = verify_grants(db, connection, allow_empty=True)
    if not present:
        db.query(connection, "GRANT SELECT ON `" + GRANT_DATABASE_PATTERN + "`.* TO %s@%s", (USERNAME, ACCOUNT_HOST))
    verify_grants(db, connection)
    return "EXISTING_VERIFIED" if exists and present else ("GRANT_COMPLETED" if exists else "CREATED")


def sanitize(value: Any, secrets: list[str]) -> Any:
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[REDACTED]")
        return re.sub(r"\*[0-9A-Fa-f]{40}\b", "[REDACTED_HASH]", value)
    if isinstance(value, dict):
        return {key: sanitize(item, secrets) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize(item, secrets) for item in value]
    return value


def run(command: str) -> int:
    ensure(command in ("inspect", "provision", "verify"), "Acción no soportada.")
    report: dict[str, Any] = {
        "tool": "SupplyFlow Docker DEV v0.2", "command": command,
        "executed_at_utc": utc_now(), "result": "FAIL", "status": "FAILED",
        "transport": "local_unix_socket", "database": DATABASE,
        "username": USERNAME, "account_host": ACCOUNT_HOST,
        "production_access": False, "schema_sha256": SCHEMA_SHA256,
    }
    secrets: list[str] = []
    db = connection = None
    locked = False
    exit_code = 1
    try:
        db = load_foundation()
        password = read_secret("mariadb-root.txt")
        secrets.append(password)
        connection = db.connect(password)
        locked = db.scalar(connection, "SELECT GET_LOCK(%s, 10)", (LOCK,)) == 1
        ensure(locked, "Otra operación del kit BD está activa. Intenta nuevamente al terminar.")
        report.update(inspect_schema(db, connection))
        exists = account_exists(db, connection)
        report["account_exists"] = exists
        if command == "inspect":
            report["status"] = "INSPECTED"
        else:
            password = read_secret("api-db-password.txt", api=True)
            secrets.append(password)
            if command == "provision":
                report["account_action"] = prepare_account(db, connection, password, exists)
            else:
                ensure(exists, "Falta la cuenta local API. Ejecuta Prepare o Start.")
                verify_credentials(db, connection, password)
                verify_grants(db, connection)
            report.update({"account_exists": True, "account_ready": True,
                           "privileges": ["SELECT"], "grant_scope": DATABASE,
                           "status": "PROVISIONED" if command == "provision" else "VERIFIED"})
        report["result"] = "PASS"
        exit_code = 0
    except Exception as error:
        # Nunca emitir una consulta del driver: podría incluir una credencial.
        report["error_type"] = type(error).__name__
        if isinstance(error, GuardError) or (db is not None and isinstance(error, db.GuardError)):
            report["error"] = str(error)
        else:
            code = error.args[0] if getattr(error, "args", None) and isinstance(error.args[0], int) else None
            report["error"] = "No se completó la operación local. Revisa rutas, socket, credenciales y estado de MariaDB."
            if code is not None:
                report["driver_error_code"] = code
        report["recovery"] = "No se cambió el esquema ni se borraron datos. Una cuenta creada antes del error puede existir; el siguiente Prepare verifica su contraseña y completa sólo el permiso previsto."
    finally:
        if connection is not None:
            if locked:
                try:
                    db.scalar(connection, "SELECT RELEASE_LOCK(%s)", (LOCK,))
                except Exception:
                    pass
            connection.close()
        report["finished_at_utc"] = utc_now()
        report = sanitize(report, secrets)
        try:
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            target = EVIDENCE / ("dev-db-" + command + ".json")
            temporary = target.with_suffix(".json.tmp")
            temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(target)
        except Exception:
            report.update({"result": "FAIL", "status": "EVIDENCE_WRITE_FAILED",
                           "error": "No se pudo guardar la evidencia de la operación."})
            exit_code = 1
        print(json.dumps(report, ensure_ascii=False))
    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inspect", "provision", "verify"))
    raise SystemExit(run(parser.parse_args().command))

#!/usr/bin/env python3
"""SupplyFlow v0.3: pruebas sintéticas del esquema, sólo en MariaDB local desechable.

Requiere Python 3.10+ y PyMySQL (versión utilizada: 1.1.2).
No instala el DDL, crea bases, modifica configuración GLOBAL ni hace COMMIT.
Todas las escrituras se revierten. AUTO_INCREMENT puede avanzar pese al ROLLBACK;
por eso se exige una base local VACÍA cuyo nombre empiece por supplyflow_test_.
Nunca debe apuntarse al socket de una instancia que contenga datos reales.

Ejemplo, después de instalar el DDL en una base de ensayo:
    python test_schema_integration.py --socket /tmp/sf-lab/mariadb.sock \
      --database supplyflow_test_v03 --expected-version-prefix 11.8.9 \
      --output resultados_integracion.json

La contraseña opcional se toma de SUPPLYFLOW_TEST_DB_PASSWORD; no se imprime.
La prueba de exceso de escala documenta una LIMITACIÓN de DECIMAL: el modo
estricto puede permitir redondeo con advertencia. No valida el futuro backend.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path
import re
import stat
import sys
from typing import Any, Callable
import uuid


STAMP = "2030-01-02 03:04:05.123456"
EXPIRY = "2030-01-03 03:04:05.123456"
STRICT_MODE = (
    "STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,"
    "NO_ENGINE_SUBSTITUTION,NO_ZERO_DATE,NO_ZERO_IN_DATE"
)
REQUIRED_TABLES = {
    "organizations", "people", "users", "business_entities", "clients",
    "currencies", "units", "requisitions", "requisition_items",
    "organization_settings", "auth_sessions", "idempotency_keys",
    "customer_quotes", "customer_quote_versions",
}


def uid() -> str:
    return str(uuid.uuid4())


def digest(label: str) -> bytes:
    return hashlib.sha256(label.encode("utf-8")).digest()


def identifier(value: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9_]*", value):
        raise ValueError("Identificador SQL no permitido")
    return "`" + value + "`"


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


class Lab:
    def __init__(self, connection: Any, observer: Any, driver: Any) -> None:
        self.connection = connection
        self.observer = observer
        self.driver = driver
        self.savepoint_sequence = 0

    def query(self, sql: str, args: Any = None) -> list[tuple[Any, ...]]:
        with self.connection.cursor() as cur:
            cur.execute(sql, args)
            return list(cur.fetchall())

    def scalar(self, sql: str, args: Any = None) -> Any:
        return self.query(sql, args)[0][0]

    def insert(self, table: str, **values: Any) -> int:
        columns = ", ".join(identifier(name) for name in values)
        placeholders = ", ".join("%s" for _ in values)
        sql = f"INSERT INTO {identifier(table)} ({columns}) VALUES ({placeholders})"
        with self.connection.cursor() as cur:
            cur.execute(sql, tuple(values.values()))
            return int(cur.lastrowid or 0)

    def reject(
        self, action: Callable[[], Any], codes: set[int], rule: str
    ) -> dict[str, Any]:
        """An unrelated SQL error must never count as the expected rejection."""
        self.savepoint_sequence += 1
        marker = "qa_sp_" + str(self.savepoint_sequence)
        self.query("SAVEPOINT " + marker)
        try:
            action()
        except self.driver.err.MySQLError as exc:
            code = int(exc.args[0])
            ensure(code in codes, f"{rule}: código inesperado {code}: {exc}")
            return {"rule": rule, "error_code": code, "exception": type(exc).__name__}
        else:
            raise AssertionError(rule + ": la operación inválida fue aceptada")
        finally:
            self.query("ROLLBACK TO SAVEPOINT " + marker)
            self.query("RELEASE SAVEPOINT " + marker)


class Fixture:
    """Grafo mínimo completamente sintético; se recrea en cada transacción."""

    def __init__(self, lab: Lab) -> None:
        self.lab = lab
        self.org_a_public = uid()
        self.org_a = self.organization("QA Organization A", self.org_a_public)
        self.org_b = self.organization("QA Organization B")
        self.person_a = self.person(self.org_a, "QA Person A")
        self.person_b = self.person(self.org_b, "QA Person B")
        self.user_a = self.user(self.org_a, self.person_a, "qa-a@example.invalid")
        self.user_b = self.user(self.org_b, self.person_b, "qa-b@example.invalid")
        self.lab.insert("currencies", code="XTS", name="Synthetic test currency", minor_units=6)
        self.unit_a = self.lab.insert(
            "units", organization_id=self.org_a, code="QA-PZA", name="Synthetic unit", symbol="QA"
        )
        self.client_a = self.client(self.org_a, "QA-CLIENT-A")
        self.client_b = self.client(self.org_b, "QA-CLIENT-B")
        self.req_a = self.requisition(self.org_a, self.client_a, "QA-REQ-BASE")
        self.req_b = self.requisition(self.org_b, self.client_b, "QA-REQ-BASE")

    def organization(self, name: str, public_id: str | None = None) -> int:
        return self.lab.insert(
            "organizations", public_id=public_id or uid(), legal_name=name,
            created_at=STAMP, updated_at=STAMP,
        )

    def person(self, org: int, name: str) -> int:
        return self.lab.insert(
            "people", organization_id=org, public_id=uid(), display_name=name,
            created_at=STAMP, updated_at=STAMP,
        )

    def user(self, org: int, person: int, email: str) -> int:
        return self.lab.insert(
            "users", organization_id=org, person_id=person, public_id=uid(),
            login_email=email, normalized_login_email=email,
            credential_state="reset_required", access_enabled=False,
            created_at=STAMP, updated_at=STAMP,
        )

    def entity(self, org: int, kind: str) -> int:
        return self.lab.insert(
            "business_entities", organization_id=org, public_id=uid(),
            entity_kind=kind, created_at=STAMP, updated_at=STAMP,
        )

    def client(self, org: int, code: str) -> int:
        entity = self.entity(org, "client")
        self.lab.insert(
            "clients", id=entity, organization_id=org, code=code,
            legal_name="QA Synthetic Client", status_code="active",
        )
        return entity

    def requisition(self, org: int, client: int, folio: str) -> int:
        entity = self.entity(org, "requisition")
        self.lab.insert(
            "requisitions", id=entity, organization_id=org, client_id=client,
            folio=folio, priority_code="normal", route_code="supply", currency_code="XTS",
        )
        return entity

    def item(self, number: int, quantity: str = "1.000000", **overrides: Any) -> int:
        values = {
            "organization_id": self.org_a, "requisition_id": self.req_a,
            "public_id": uid(), "line_number": number, "description": "QA Synthetic item",
            "quantity": quantity, "unit_id": self.unit_a, "unit_label": "QA",
        }
        values.update(overrides)
        return self.lab.insert("requisition_items", **values)

    def session(self, **overrides: Any) -> int:
        values = {
            "organization_id": self.org_a, "public_id": uid(),
            "principal_kind": "internal_user", "user_id": self.user_a,
            "token_sha256": digest(uid()), "authentication_method": "qa_synthetic",
            "allowed_actions_json": "[]", "created_at": STAMP, "expires_at": EXPIRY,
        }
        values.update(overrides)
        return self.lab.insert("auth_sessions", **values)

    def idempotency(self, key: bytes, **overrides: Any) -> int:
        values = {
            "organization_id": self.org_a, "actor_user_id": self.user_a,
            "endpoint_code": "qa.requisitions.create", "key_sha256": key,
            "request_sha256": digest("QA request"), "state_code": "pending",
            "created_at": STAMP, "expires_at": EXPIRY,
        }
        values.update(overrides)
        return self.lab.insert("idempotency_keys", **values)

    def quote(self) -> int:
        entity = self.entity(self.org_a, "customer_quote")
        self.lab.insert(
            "customer_quotes", id=entity, organization_id=self.org_a,
            requisition_id=self.req_a, client_id=self.client_a, series_reference="QA-CQ-SERIES",
        )
        return entity

    def quote_version(self, quote: int, number: int) -> int:
        entity = self.entity(self.org_a, "customer_quote_version")
        self.lab.insert(
            "customer_quote_versions", id=entity, organization_id=self.org_a,
            customer_quote_id=quote, requisition_id=self.req_a, version_number=number,
            folio="QA-CQ-SAME-FOLIO", currency_code="XTS", document_status="draft",
            internal_approval_status="pending", client_decision_status="pending",
            subtotal_amount="0.000000", total_amount="0.000000",
        )
        return entity


def case_transaction_rollback(lab: Lab, f: Fixture) -> dict[str, Any]:
    f.item(1)
    rejection = lab.reject(lambda: f.item(2, "0.000000"), {4025}, "positive_quantity")
    ensure(lab.scalar("SELECT COUNT(*) FROM requisition_items") == 1, "La partida válida desapareció antes del rollback")
    lab.connection.rollback()
    ensure(lab.scalar("SELECT COUNT(*) FROM organizations") == 0, "Rollback dejó organizaciones persistidas")
    ensure(lab.scalar("SELECT COUNT(*) FROM business_entities") == 0, "Rollback dejó identidades persistidas")
    return {"partial_graph_rolled_back": True, "invalid_statement": rejection}


def case_orphan_fk(lab: Lab, f: Fixture) -> dict[str, Any]:
    missing_org = max(f.org_a, f.org_b) + 1000000
    return lab.reject(lambda: f.person(missing_org, "QA Orphan"), {1452, 1216}, "organization_foreign_key")


def case_user_org_scope(lab: Lab, f: Fixture) -> dict[str, Any]:
    return lab.reject(
        lambda: f.user(f.org_a, f.person_b, "qa-cross@example.invalid"),
        {1452, 1216}, "user_person_same_organization",
    )


def case_client_org_scope(lab: Lab, f: Fixture) -> dict[str, Any]:
    return lab.reject(
        lambda: f.requisition(f.org_a, f.client_b, "QA-INVALID-CLIENT"),
        {1452, 1216}, "requisition_client_same_organization",
    )


def case_public_id_unique(lab: Lab, f: Fixture) -> dict[str, Any]:
    return lab.reject(
        lambda: f.organization("QA Duplicate UUID", f.org_a_public), {1062}, "public_id_unique"
    )


def case_folio_comparison(lab: Lab, f: Fixture) -> dict[str, Any]:
    folios = ["QA-FOLIO", "qa-folio", "QA-FOLIO "]
    for folio in folios:
        f.requisition(f.org_a, f.client_a, folio)
    rejection = lab.reject(
        lambda: f.requisition(f.org_a, f.client_a, folios[0]), {1062}, "folio_unique_within_organization"
    )
    count = lab.scalar("SELECT COUNT(*) FROM requisitions WHERE organization_id=%s", (f.org_a,))
    ensure(count == 4, "La collation no conservó los tres identificadores distintos")
    return {
        "distinct_case_and_trailing_space": True, "duplicate": rejection,
        "limit": "La API/importador deben definir normalización. SQL conserva distinciones binarias nopad.",
    }


def case_decimal_exact(lab: Lab, f: Fixture) -> dict[str, Any]:
    value = "99999999999999.123456"
    lab.query("UPDATE requisitions SET budget_amount=%s WHERE id=%s", (value, f.req_a))
    f.item(1, "0.100001")
    f.item(2, "0.200002")
    budget = lab.scalar("SELECT budget_amount FROM requisitions WHERE id=%s", (f.req_a,))
    total = lab.scalar("SELECT SUM(quantity) FROM requisition_items WHERE requisition_id=%s", (f.req_a,))
    ensure(isinstance(budget, Decimal) and budget == Decimal(value), "DECIMAL no volvió exacto")
    ensure(total == Decimal("0.300003"), "Suma DECIMAL incorrecta")
    return {"exact_roundtrip": str(budget), "exact_sum": str(total)}


def case_decimal_range(lab: Lab, f: Fixture) -> dict[str, Any]:
    return lab.reject(lambda: f.item(1, "100000000000000.000000"), {1264}, "decimal_20_6_range_in_strict_mode")


def case_positive_quantity(lab: Lab, f: Fixture) -> dict[str, Any]:
    zero = lab.reject(lambda: f.item(1, "0.000000"), {4025}, "quantity_positive_zero")
    negative = lab.reject(lambda: f.item(1, "-1.000000"), {4025}, "quantity_positive_negative")
    return {"zero": zero, "negative": negative}


def case_item_ordinal(lab: Lab, f: Fixture) -> dict[str, Any]:
    f.item(1)
    return lab.reject(lambda: f.item(1, "2.000000"), {1062}, "line_number_unique_per_requisition")


def case_json_validation(lab: Lab, f: Fixture) -> dict[str, Any]:
    payload = {"qa": True, "label": "Prueba sintética ñ 😀", "amount": "1.000000"}
    lab.insert(
        "organization_settings", organization_id=f.org_a, settings_group="qa_valid",
        schema_version=1, settings_json=json.dumps(payload, ensure_ascii=False), updated_at=STAMP,
    )
    text = lab.scalar("SELECT settings_json FROM organization_settings WHERE organization_id=%s", (f.org_a,))
    ensure(json.loads(text) == payload, "JSON/utf8mb4 no conservó valores")
    rejected = lab.reject(
        lambda: lab.insert(
            "organization_settings", organization_id=f.org_a, settings_group="qa_invalid",
            schema_version=1, settings_json='{"broken":', updated_at=STAMP,
        ), {4025}, "invalid_json_rejected",
    )
    return {"valid_unicode_json_roundtrip": True, "invalid_json": rejected}


def case_auth_principal(lab: Lab, f: Fixture) -> dict[str, Any]:
    f.session()
    contradictory = lab.reject(
        lambda: f.session(client_id=f.client_a), {4025}, "session_cannot_have_user_and_client"
    )
    empty = lab.reject(lambda: f.session(user_id=None), {4025}, "session_requires_principal")
    return {"valid_internal_session": True, "contradictory": contradictory, "empty": empty}


def case_auth_expiry(lab: Lab, f: Fixture) -> dict[str, Any]:
    return lab.reject(lambda: f.session(expires_at=STAMP), {4025}, "session_expiry_after_creation")


def case_idempotency_and_revisions(lab: Lab, f: Fixture) -> dict[str, Any]:
    key = digest("QA idempotency key")
    f.idempotency(key)
    duplicate = lab.reject(lambda: f.idempotency(key), {1062}, "idempotency_unique_for_actor_and_endpoint")
    f.idempotency(key, actor_user_id=None, actor_client_id=f.client_a)
    no_actor = lab.reject(
        lambda: f.idempotency(digest("QA no actor"), actor_user_id=None), {4025}, "idempotency_requires_one_actor"
    )
    quote = f.quote()
    f.quote_version(quote, 1)
    f.quote_version(quote, 2)
    duplicated_revision = lab.reject(lambda: f.quote_version(quote, 2), {1062}, "revision_unique_per_document")
    ensure(lab.scalar("SELECT COUNT(*) FROM customer_quote_versions WHERE customer_quote_id=%s", (quote,)) == 2,
           "No se conservaron las dos versiones con el mismo folio")
    return {
        "idempotency_duplicate": duplicate, "same_key_different_principal_allowed": True,
        "idempotency_no_actor": no_actor, "two_versions_same_folio_allowed": True,
        "duplicate_revision": duplicated_revision,
    }


def case_decimal_excess_scale(lab: Lab, f: Fixture) -> dict[str, Any]:
    value = "1.1234567"
    item = f.item(1, value)
    warnings = lab.query("SHOW WARNINGS")
    stored = lab.scalar("SELECT quantity FROM requisition_items WHERE id=%s", (item,))
    ensure(stored == Decimal("1.123457"), "Resultado inesperado al exceder la escala DECIMAL")
    ensure(any(int(row[1]) == 1265 for row in warnings), "No se observó la advertencia de reducción de escala esperada")
    return {
        "status": "OBSERVED_LIMITATION",
        "submitted": value, "stored": str(stored),
        "warnings": [{"level": row[0], "code": int(row[1]), "message": row[2]} for row in warnings],
        "required_backend_rule": "Validar escala/rango con decimal exacto ANTES del INSERT y preservar valor original en migración.",
        "backend_implemented_or_tested": False,
    }


CASES = [
    ("transaction_rollback", case_transaction_rollback),
    ("orphan_foreign_key", case_orphan_fk),
    ("user_person_organization_scope", case_user_org_scope),
    ("requisition_client_organization_scope", case_client_org_scope),
    ("unique_public_id", case_public_id_unique),
    ("folio_binary_nopad_and_unique", case_folio_comparison),
    ("decimal_exact_roundtrip_and_sum", case_decimal_exact),
    ("decimal_range_strict", case_decimal_range),
    ("positive_quantity_check", case_positive_quantity),
    ("unique_requisition_line_number", case_item_ordinal),
    ("json_validation_and_unicode", case_json_validation),
    ("auth_principal_check", case_auth_principal),
    ("auth_expiry_check", case_auth_expiry),
    ("idempotency_scope_and_document_revisions", case_idempotency_and_revisions),
    ("decimal_excess_scale_is_not_rejected", case_decimal_excess_scale),
]


def nonempty_tables(connection: Any, tables: list[str]) -> dict[str, int]:
    found = {}
    with connection.cursor() as cur:
        for table in tables:
            cur.execute(f"SELECT COUNT(*) FROM {identifier(table)}")
            count = int(cur.fetchone()[0])
            if count:
                found[table] = count
    return found


def write_report(report: dict[str, Any], path: Path | None) -> None:
    encoded = json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n"
    if path:
        path.write_text(encoded, encoding="utf-8")
    print(encoded, end="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--socket", required=True, type=Path, help="Socket Unix de MariaDB LOCAL DESECHABLE; no admite TCP")
    parser.add_argument("--database", required=True, help="Base VACÍA ya instalada: supplyflow_test_...")
    parser.add_argument("--user", default="root", help="Usuario del laboratorio local; contraseña opcional en SUPPLYFLOW_TEST_DB_PASSWORD")
    parser.add_argument("--expected-version-prefix", default="11.8.9")
    parser.add_argument("--output", type=Path, help="Reporte JSON de evidencias")
    args = parser.parse_args()
    report: dict[str, Any] = {
        "suite": "SupplyFlow v0.3 schema integration", "executed_at_utc": datetime.now(timezone.utc).isoformat(),
        "database": args.database, "expected_version_prefix": args.expected_version_prefix,
        "synthetic_only": True, "production_access": False, "cases": [],
        "limits": [
            "No es una prueba de Hostinger, API, autenticación real, importación legacy ni concurrencia.",
            "No se valida aquí la normalización de identificadores ni la política comercial de redondeo.",
            "Rollback conserva cero filas; los contadores AUTO_INCREMENT pueden avanzar en la base desechable.",
            "No hay COMMIT, DROP, DELETE, TRUNCATE, DDL ni SET GLOBAL en esta suite.",
        ],
    }
    connection = observer = None
    try:
        if not re.fullmatch(r"supplyflow_test_[a-z0-9_]+", args.database):
            raise ValueError("Guard: nombre de base permitido sólo supplyflow_test_[a-z0-9_]+")
        if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", args.expected_version_prefix):
            raise ValueError("Guard: prefijo de versión inválido")
        if not args.socket.is_absolute() or not stat.S_ISSOCK(args.socket.stat().st_mode):
            raise ValueError("Guard: se requiere una ruta absoluta a un socket Unix local existente")
        import pymysql  # dependency resolved only after command-line safety guards
        options = {
            "unix_socket": str(args.socket), "user": args.user,
            "password": os.environ.get("SUPPLYFLOW_TEST_DB_PASSWORD", ""),
            "database": args.database, "charset": "utf8mb4", "connect_timeout": 5,
            "read_timeout": 15, "write_timeout": 15, "autocommit": False,
        }
        connection = pymysql.connect(**options)
        observer = pymysql.connect(**{**options, "autocommit": True})
        lab = Lab(connection, observer, pymysql)
        version = str(lab.scalar("SELECT VERSION()"))
        ensure("mariadb" in version.lower(), "Guard: el servidor no se identifica como MariaDB")
        ensure(re.match(r"^" + re.escape(args.expected_version_prefix) + r"(?:[.\-]|$)", version) is not None,
               "Guard: la versión del servidor no coincide con la esperada")
        ensure(lab.scalar("SELECT DATABASE()") == args.database, "Guard: base seleccionada distinta")
        tables_info = lab.query(
            "SELECT TABLE_NAME, ENGINE, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s ORDER BY TABLE_NAME",
            (args.database,),
        )
        tables = [row[0] for row in tables_info]
        ensure(len(tables) == 74, f"Guard: se esperaban 74 tablas, hay {len(tables)}")
        ensure(REQUIRED_TABLES.issubset(tables), "Guard: faltan tablas de SupplyFlow")
        ensure(all(row[1] == "InnoDB" and row[2] == "BASE TABLE" for row in tables_info), "Guard: todos los objetos deben ser tablas InnoDB")
        ensure(not nonempty_tables(observer, tables), "Guard: la base contiene datos; la suite se niega a escribir")
        ensure(lab.scalar("SELECT @@session.foreign_key_checks") == 1, "Guard: FK desactivadas")
        ensure(lab.scalar("SELECT @@session.check_constraint_checks") == 1, "Guard: CHECK desactivados")
        lab.query("SET SESSION sql_mode=%s", (STRICT_MODE,))
        lab.query("SET SESSION time_zone='+00:00'")
        lab.query("SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci")
        lab.query("SET SESSION foreign_key_checks=1")
        lab.query("SET SESSION check_constraint_checks=1")
        lab.query("SET SESSION unique_checks=1")
        lab.query("SET SESSION innodb_strict_mode=1")
        session_keys = (
            "sql_mode", "time_zone", "character_set_connection", "collation_connection",
            "foreign_key_checks", "check_constraint_checks", "unique_checks", "innodb_strict_mode",
        )
        session_values = lab.query("SELECT " + ", ".join("@@session." + name for name in session_keys))[0]
        session_parameters = dict(zip(session_keys, session_values))
        ensure(set(session_parameters["sql_mode"].split(",")) == set(STRICT_MODE.split(",")),
               "Bootstrap: sql_mode real no coincide con el contrato")
        ensure(session_parameters["time_zone"] == "+00:00", "Bootstrap: sesión no está en UTC")
        ensure(all(session_parameters[key] == 1 for key in session_keys[-4:]),
               "Bootstrap: una comprobación de integridad/modo estricto está desactivada")
        connection.rollback()
        report.update({
            "server_version": version, "driver": "PyMySQL " + metadata.version("PyMySQL"),
            "table_count": len(tables), "initial_rows": 0, "session_parameters": session_parameters,
            "transport": "local_unix_socket", "guard_checks": "PASS",
        })
        for name, test in CASES:
            connection.begin()
            result: dict[str, Any] = {"name": name, "status": "PASS"}
            try:
                fixture = Fixture(lab)
                evidence = test(lab, fixture)
                result["status"] = evidence.pop("status", "PASS")
                result["evidence"] = evidence
            except Exception as exc:
                result.update({"status": "FAIL", "error_type": type(exc).__name__, "error": str(exc)})
            finally:
                connection.rollback()
            leftovers = nonempty_tables(observer, tables)
            result["rollback_zero_rows"] = not leftovers
            if leftovers:
                result.update({"status": "FAIL", "unexpected_rows": leftovers})
            report["cases"].append(result)
            if leftovers:
                raise RuntimeError("Guard: quedan filas después de rollback; ejecución detenida")
        counts = {label: sum(item["status"] == status for item in report["cases"])
                  for label, status in (("passed", "PASS"), ("observed_limitations", "OBSERVED_LIMITATION"), ("failed", "FAIL"))}
        report["summary"] = {"total": len(report["cases"]), **counts, "final_rows": sum(nonempty_tables(observer, tables).values())}
        report["result"] = ("FAIL" if counts["failed"] else
                            "PASS_WITH_OBSERVED_LIMITATION" if counts["observed_limitations"] else "PASS")
        write_report(report, args.output)
        return 0 if counts["failed"] == 0 else 1
    except Exception as exc:
        report.update({"result": "BLOCKED", "error_type": type(exc).__name__, "error": str(exc)})
        write_report(report, args.output)
        return 2
    finally:
        if connection is not None:
            connection.rollback()
            connection.close()
        if observer is not None:
            observer.close()


if __name__ == "__main__":
    raise SystemExit(main())

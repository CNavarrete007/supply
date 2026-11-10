#!/bin/sh
# SupplyFlow INT03 · Restauración controlada de un respaldo SQL en un servidor SIN `supplyflow_dev`.
# Servicio Compose `int03-restore-tools`: misma imagen fijada de MariaDB, sin red, socket local,
# respaldo y DDL del repositorio montados en SOLO LECTURA.
#
# 1. Restaura el respaldo en `supplyflow_dev` (nunca sobrescribe una base existente).
# 2. Crea una base de REFERENCIA temporal y VACÍA desde el DDL versionado (01_schema + R3C1-HF2/R3C2/R3C3).
#    No es una migración de la base restaurada: la referencia no contiene datos y se elimina al final.
# 3. Exige estructura idéntica (columnas, índices, llaves foráneas, tablas) entre ambas.
# 4. Repone las CHECK de tabla que falten (phpMyAdmin las omite). MariaDB valida cada regla contra las
#    filas existentes: si un dato no la cumple, se detiene sin modificar datos.
# 5. Exige CHECK idénticas, 77 tablas, 256 llaves foráneas y 55 CHECK; elimina la referencia.
# Imprime UN solo JSON en stdout; el progreso va a stderr. No crea cuentas (accounts.py) ni imprime datos.
set -eu
FILE="/backups/${1:-supplyflow_dev.sql}"
DB=supplyflow_dev
REF=supplyflow_int03_reference
TABLES_EXPECTED=77
FKS_EXPECTED=256
CHECKS_EXPECTED=55
export MYSQL_PWD="$(cat /run/secrets/root_password)"
SQL="mariadb -uroot --protocol=socket --socket=/run/mysqld/mysqld.sock --default-character-set=utf8mb4"

say() { printf '{"tool":"SupplyFlow INT03 restore","result":"%s","step":"%s","detail":"%s"}\n' "$1" "$2" "$3"; }
log() { echo "[restore] $*" >&2; }
q() { $SQL -N -B -e "$1"; }

[ -f "$FILE" ] || { say BLOCKED preflight "No existe el respaldo en backups/"; exit 1; }
for f in /docker/supply-db/sql/01_schema.sql /migrations/manual/R3C1_requisition_change_add_check.sql \
         /migrations/manual/R3C2_commercial_assessment_ledger.sql /migrations/manual/R3C3_commercial_execution_evidence.sql; do
  [ -f "$f" ] || { say BLOCKED preflight "Falta el DDL versionado $f"; exit 1; }
done
VERSION=$(q "SELECT VERSION()") || { say BLOCKED preflight "MariaDB no responde por socket"; exit 1; }
case "$VERSION" in 11.8.9-*) ;; *) say BLOCKED preflight "Version MariaDB distinta de 11.8.9"; exit 1;; esac
[ "$(q "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$DB'")" = "0" ] || { say BLOCKED preflight "supplyflow_dev ya existe: no se sobrescribe"; exit 1; }
[ "$(q "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$REF'")" = "0" ] || { say BLOCKED preflight "Existe $REF de un intento anterior; revisar antes de continuar"; exit 1; }

log "1/5 Restaurando respaldo en $DB..."
q "CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci"
if ! $SQL "$DB" < "$FILE"; then say FAILED import "La importacion fallo. No reintentar: la base quedo parcial; revisar antes de continuar"; exit 1; fi
TABLES=$(q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB' AND TABLE_TYPE='BASE TABLE'")
[ "$TABLES" = "$TABLES_EXPECTED" ] || { say FAILED verify "Se restauraron $TABLES tablas, se esperaban $TABLES_EXPECTED"; exit 1; }

log "2/5 Construyendo referencia temporal vacia desde el DDL versionado..."
q "CREATE DATABASE \`$REF\` CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci"
$SQL "$REF" < /docker/supply-db/sql/01_schema.sql || { say FAILED reference "No se pudo crear la referencia desde 01_schema.sql"; exit 1; }
for m in R3C1_requisition_change_add_check R3C2_commercial_assessment_ledger R3C3_commercial_execution_evidence; do
  $SQL "$REF" < "/migrations/manual/$m.sql" || { say FAILED reference "No se pudo aplicar $m a la referencia vacia"; exit 1; }
done

# Symmetric difference between REF and DB for a column list of an information_schema view.
diff_count() {
  q "SELECT (SELECT COUNT(*) FROM (SELECT $1 FROM information_schema.$2 WHERE $3='$REF' EXCEPT SELECT $1 FROM information_schema.$2 WHERE $3='$DB') a)
          + (SELECT COUNT(*) FROM (SELECT $1 FROM information_schema.$2 WHERE $3='$DB' EXCEPT SELECT $1 FROM information_schema.$2 WHERE $3='$REF') b)"
}
log "3/5 Comparando estructura con la referencia..."
D_COLS=$(diff_count "TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_DEFAULT,IS_NULLABLE,COLUMN_TYPE,CHARACTER_SET_NAME,COLLATION_NAME,EXTRA,GENERATION_EXPRESSION" COLUMNS TABLE_SCHEMA)
D_IDX=$(diff_count "TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX,COLUMN_NAME,NON_UNIQUE,SUB_PART,INDEX_TYPE" STATISTICS TABLE_SCHEMA)
D_FK=$(diff_count "CONSTRAINT_NAME,TABLE_NAME,REFERENCED_TABLE_NAME,UPDATE_RULE,DELETE_RULE" REFERENTIAL_CONSTRAINTS CONSTRAINT_SCHEMA)
D_FKC=$(diff_count "CONSTRAINT_NAME,TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME" KEY_COLUMN_USAGE TABLE_SCHEMA)
D_TAB=$(diff_count "TABLE_NAME,ENGINE,TABLE_COLLATION,ROW_FORMAT,TABLE_COMMENT" TABLES TABLE_SCHEMA)
if [ "$D_COLS$D_IDX$D_FK$D_FKC$D_TAB" != "00000" ]; then
  say FAILED structure "Estructura distinta del DDL versionado: columnas $D_COLS, indices $D_IDX, llaves $D_FK/$D_FKC, tablas $D_TAB. Referencia conservada para revision"
  exit 1
fi

log "4/5 Reponiendo CHECK faltantes desde el DDL versionado (MariaDB valida los datos existentes)..."
$SQL -N -B --raw -e "SELECT CONCAT(r.CONSTRAINT_NAME, CHAR(9), 'ALTER TABLE \`$DB\`.\`', r.TABLE_NAME, '\` ADD CONSTRAINT \`', r.CONSTRAINT_NAME, '\` CHECK (', r.CHECK_CLAUSE, ')')
   FROM information_schema.CHECK_CONSTRAINTS r
   WHERE r.CONSTRAINT_SCHEMA='$REF' AND r.LEVEL='Table'
     AND NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS d WHERE d.CONSTRAINT_SCHEMA='$DB' AND d.TABLE_NAME=r.TABLE_NAME AND d.CONSTRAINT_NAME=r.CONSTRAINT_NAME)
   ORDER BY r.TABLE_NAME, r.CONSTRAINT_NAME" > /tmp/int03_checks.tsv
ADDED=0
TAB=$(printf '\t')
while IFS="$TAB" read -r NAME STMT; do
  [ -n "$NAME" ] || continue
  if ! $SQL -e "$STMT" >/dev/null 2>&1; then
    say FAILED checks "Los datos restaurados no cumplen la regla $NAME (o no pudo aplicarse). No se modificaron datos; referencia conservada para revision"
    exit 1
  fi
  ADDED=$((ADDED + 1))
done < /tmp/int03_checks.tsv

log "5/5 Verificacion final..."
D_CK=$(diff_count "TABLE_NAME,CONSTRAINT_NAME,LEVEL,CHECK_CLAUSE" CHECK_CONSTRAINTS CONSTRAINT_SCHEMA)
CHECKS=$(q "SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$DB' AND LEVEL='Table'")
FKS=$(q "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$DB'")
if [ "$D_CK" != "0" ] || [ "$CHECKS" != "$CHECKS_EXPECTED" ] || [ "$FKS" != "$FKS_EXPECTED" ]; then
  say FAILED verify "CHECK distintas $D_CK, CHECK $CHECKS/$CHECKS_EXPECTED, llaves $FKS/$FKS_EXPECTED. Referencia conservada para revision"
  exit 1
fi
# Only the empty reference schema created by THIS run (preflight proved it did not exist before).
q "DROP DATABASE \`$REF\`"
say PASS restored "$TABLES tablas, $FKS llaves foraneas y $CHECKS CHECK identicas al DDL versionado ($ADDED CHECK repuestas y validadas contra los datos)"

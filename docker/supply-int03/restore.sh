#!/bin/sh
# SupplyFlow INT03 · Restauración controlada de un respaldo SQL en un servidor SIN `supplyflow_dev`.
# Se ejecuta en el servicio Compose `int03-restore-tools` (misma imagen fijada de MariaDB, sin red,
# socket local, respaldo montado en SOLO LECTURA). Nunca borra ni sobrescribe una base existente,
# no crea cuentas (eso lo hace accounts.py) y no imprime datos ni contraseñas.
set -eu
FILE="/backups/${1:-supplyflow_dev.sql}"
DB=supplyflow_dev
export MYSQL_PWD="$(cat /run/secrets/root_password)"
SQL="mariadb -uroot --protocol=socket --socket=/run/mysqld/mysqld.sock --default-character-set=utf8mb4"

say() { printf '{"tool":"SupplyFlow INT03 restore","result":"%s","step":"%s","detail":"%s"}\n' "$1" "$2" "$3"; }

[ -f "$FILE" ] || { say BLOCKED preflight "No existe el respaldo en backups/"; exit 1; }
VERSION=$($SQL -N -B -e "SELECT VERSION()") || { say BLOCKED preflight "MariaDB no responde por socket"; exit 1; }
case "$VERSION" in 11.8.9-*) ;; *) say BLOCKED preflight "Version MariaDB distinta de 11.8.9"; exit 1;; esac
EXISTS=$($SQL -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$DB'")
[ "$EXISTS" = "0" ] || { say BLOCKED preflight "supplyflow_dev ya existe: no se sobrescribe"; exit 1; }

$SQL -e "CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci"
if ! $SQL "$DB" < "$FILE"; then
  say FAILED import "La importacion fallo. No reintentar: la base quedo parcial; revisar antes de continuar"
  exit 1
fi
TABLES=$($SQL -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB' AND TABLE_TYPE='BASE TABLE'")
[ "$TABLES" = "77" ] || { say FAILED verify "Se restauraron $TABLES tablas, se esperaban 77"; exit 1; }
say PASS restored "77 tablas restauradas; siguiente paso: cuentas (int03-accounts-tools provision)"

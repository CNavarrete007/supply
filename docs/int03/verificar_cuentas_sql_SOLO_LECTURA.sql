-- SupplyFlow INT03 · Verificación SOLO LECTURA de cuentas SQL (no GRANT, no DML, no DDL).
-- Ejecutar como root desde phpMyAdmin (127.0.0.1:8081) o `mariadb` dentro del contenedor db.
-- Esperado tras INT03 (contrato documentado en R3A/R3B/R3C2/R3C3_NOTAS.md):
--   tablas base supplyflow_dev = 77
--   supplyflow_recovery_local  = 52 permisos de tabla, 0 de esquema, solo USAGE global
--   supplyflow_reqwrite_local  = 27 permisos de tabla
--   supplyflow_auth_local      = 10 permisos de tabla + 2 de columna (auth_sessions.revoked_at/revocation_reason)
--   supplyflow_api_local       = SELECT a nivel de esquema `supplyflow\_dev`
SELECT VERSION() AS version_mariadb;
SELECT COUNT(*) AS tablas_base FROM information_schema.TABLES WHERE TABLE_SCHEMA='supplyflow_dev' AND TABLE_TYPE='BASE TABLE';
SELECT User, Host, JSON_VALUE(Priv,'$.plugin') AS plugin FROM mysql.global_priv WHERE User LIKE 'supplyflow%' ORDER BY User;
SELECT GRANTEE, COUNT(*) AS permisos_tabla FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE LIKE '%supplyflow%' GROUP BY GRANTEE ORDER BY GRANTEE;
SELECT GRANTEE, COUNT(*) AS permisos_columna FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE LIKE '%supplyflow%' GROUP BY GRANTEE;
SELECT GRANTEE, TABLE_SCHEMA, PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE LIKE '%supplyflow%';
SELECT GRANTEE, PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE LIKE '%supplyflow%' AND PRIVILEGE_TYPE<>'USAGE';  -- debe quedar vacío
-- Detalle R3 (14 permisos añadidos a RF1 38):
SELECT TABLE_NAME, PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES
 WHERE GRANTEE="'supplyflow_recovery_local'@'%'" AND TABLE_NAME IN ('requisition_change_requests','requisition_change_items','sourcing_plans','customer_quotes','delivery_items',
  'requisition_change_commercial_assessments','requisition_change_commercial_executions','requisition_change_commercial_execution_reviews')
 ORDER BY TABLE_NAME, PRIVILEGE_TYPE;

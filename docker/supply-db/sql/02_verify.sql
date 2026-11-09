-- SUPPLYFLOW v0.3 | 02 VERIFICACION DESPUES DE INSTALAR
-- Objetivo: MariaDB 11.8.9, base de ENSAYO seleccionada en phpMyAdmin.
-- DDL SHA-256: 2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5
-- SOLO LECTURA: SELECT/CTE/SHOW; sin SET, DDL, DML, GRANTS, procedimientos
-- ni lectura de filas de negocio. El conteo final del postflight sólo da números.
-- Elegir la base en la interfaz ANTES de ejecutar. Este archivo no usa USE.
-- FAIL: detener. REVISAR: resolver condición antes de dar el ensayo por válido.
-- Resultados son metadatos de esta sesión; no configuran futuras conexiones.
-- No prueban permisos de escritura, autorización de usuarios o reglas de API.

-- Ejecutar antes de importar datos y en la misma base de ENSAYO del DDL.
-- Este archivo no prueba el backend ni revalida filas cargadas con checks apagados.
SELECT '01_entorno' AS seccion, VERSION() AS version_real, DATABASE() AS base_seleccionada,
       @@SESSION.sql_mode AS sql_mode_sesion,
       @@SESSION.time_zone AS zona_sesion,
       @@SESSION.character_set_connection AS charset_conexion,
       @@SESSION.collation_connection AS collation_conexion,
       @@SESSION.foreign_key_checks AS fk_sesion,
       @@SESSION.check_constraint_checks AS check_sesion,
       @@SESSION.unique_checks AS unique_sesion,
       @@GLOBAL.foreign_key_checks AS fk_global,
       @@GLOBAL.check_constraint_checks AS check_global,
       @@GLOBAL.unique_checks AS unique_global,
       CASE WHEN DATABASE() IS NULL OR DATABASE() IN ('mysql','information_schema','performance_schema','sys') THEN 'FAIL_BASE'
            WHEN @@SESSION.foreign_key_checks<>1 OR @@SESSION.check_constraint_checks<>1 OR @@SESSION.unique_checks<>1 THEN 'FAIL_CHECKS_APAGADOS'
            WHEN NOT (FIND_IN_SET('STRICT_TRANS_TABLES',@@SESSION.sql_mode)>0 OR FIND_IN_SET('STRICT_ALL_TABLES',@@SESSION.sql_mode)>0) THEN 'FAIL_SIN_MODO_ESTRICTO'
            ELSE 'OK' END AS estado;

-- 2. Inventario de TABLAS exacto; vistas/tablas ajenas son diferencias.
WITH sf_expected AS (
  SELECT 'organizations' AS table_name
  UNION ALL SELECT 'people'
  UNION ALL SELECT 'users'
  UNION ALL SELECT 'roles'
  UNION ALL SELECT 'permissions'
  UNION ALL SELECT 'role_permissions'
  UNION ALL SELECT 'user_roles'
  UNION ALL SELECT 'user_permissions'
  UNION ALL SELECT 'organization_settings'
  UNION ALL SELECT 'currencies'
  UNION ALL SELECT 'units'
  UNION ALL SELECT 'categories'
  UNION ALL SELECT 'service_types'
  UNION ALL SELECT 'business_entities'
  UNION ALL SELECT 'files'
  UNION ALL SELECT 'entity_files'
  UNION ALL SELECT 'clients'
  UNION ALL SELECT 'suppliers'
  UNION ALL SELECT 'party_contacts'
  UNION ALL SELECT 'party_contact_channels'
  UNION ALL SELECT 'supplier_offerings'
  UNION ALL SELECT 'projects'
  UNION ALL SELECT 'contracts'
  UNION ALL SELECT 'requisitions'
  UNION ALL SELECT 'requisition_items'
  UNION ALL SELECT 'requisition_reviews'
  UNION ALL SELECT 'requisition_change_requests'
  UNION ALL SELECT 'requisition_revision_snapshots'
  UNION ALL SELECT 'requisition_change_items'
  UNION ALL SELECT 'sourcing_plans'
  UNION ALL SELECT 'sourcing_lots'
  UNION ALL SELECT 'sourcing_lot_items'
  UNION ALL SELECT 'sourcing_lot_suppliers'
  UNION ALL SELECT 'rfqs'
  UNION ALL SELECT 'rfq_items'
  UNION ALL SELECT 'supplier_quotes'
  UNION ALL SELECT 'supplier_quote_items'
  UNION ALL SELECT 'awards'
  UNION ALL SELECT 'customer_quotes'
  UNION ALL SELECT 'approval_policy_versions'
  UNION ALL SELECT 'customer_quote_versions'
  UNION ALL SELECT 'customer_quote_items'
  UNION ALL SELECT 'customer_quote_adjustments'
  UNION ALL SELECT 'customer_quote_decisions'
  UNION ALL SELECT 'purchase_orders'
  UNION ALL SELECT 'purchase_order_modification_requests'
  UNION ALL SELECT 'purchase_order_requisitions'
  UNION ALL SELECT 'purchase_order_items'
  UNION ALL SELECT 'purchase_order_line_sources'
  UNION ALL SELECT 'workflow_events'
  UNION ALL SELECT 'goods_receipts'
  UNION ALL SELECT 'goods_receipt_items'
  UNION ALL SELECT 'deliveries'
  UNION ALL SELECT 'delivery_sources'
  UNION ALL SELECT 'delivery_items'
  UNION ALL SELECT 'delivery_item_allocations'
  UNION ALL SELECT 'signature_evidence'
  UNION ALL SELECT 'invoices'
  UNION ALL SELECT 'invoice_purchase_orders'
  UNION ALL SELECT 'invoice_acknowledgments'
  UNION ALL SELECT 'service_orders'
  UNION ALL SELECT 'audit_events'
  UNION ALL SELECT 'notifications'
  UNION ALL SELECT 'outbox_messages'
  UNION ALL SELECT 'email_delivery_logs'
  UNION ALL SELECT 'ai_runs'
  UNION ALL SELECT 'document_sequences'
  UNION ALL SELECT 'portal_access_tokens'
  UNION ALL SELECT 'auth_sessions'
  UNION ALL SELECT 'idempotency_keys'
  UNION ALL SELECT 'import_batches'
  UNION ALL SELECT 'import_records'
  UNION ALL SELECT 'import_issues'
  UNION ALL SELECT 'legacy_id_map'
),
sf_actual AS (
  SELECT TABLE_NAME AS table_name, TABLE_TYPE, ENGINE, ROW_FORMAT, TABLE_COLLATION
  FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
), sf_diff AS (
  SELECT e.table_name, CASE WHEN a.table_name IS NULL THEN 'TABLA_AUSENTE'
         WHEN a.TABLE_TYPE<>'BASE TABLE' THEN 'TIPO_INCORRECTO'
         WHEN a.ENGINE<>'InnoDB' OR UPPER(a.ROW_FORMAT)<>'DYNAMIC' THEN 'ENGINE_O_ROW_FORMAT'
         WHEN a.TABLE_COLLATION<>'utf8mb4_uca1400_nopad_ai_ci' THEN 'COLLATION'
         ELSE 'OK' END AS problema
  FROM sf_expected e LEFT JOIN sf_actual a ON BINARY a.table_name=BINARY e.table_name
  UNION ALL
  SELECT a.table_name,'OBJETO_NO_PREVISTO' FROM sf_actual a
  LEFT JOIN sf_expected e ON BINARY a.table_name=BINARY e.table_name WHERE e.table_name IS NULL
)
SELECT '02_tablas' AS seccion,
       CASE WHEN SUM(problema<>'OK')=0 AND DATABASE() IS NOT NULL THEN 'OK' ELSE 'FAIL' END AS estado,
       (SELECT COUNT(*) FROM sf_expected) AS esperadas,
       (SELECT COUNT(*) FROM sf_actual) AS encontradas,
       SUM(problema<>'OK') AS diferencias FROM sf_diff;

-- Detalle breve del inventario real (74 filas esperadas).
SELECT TABLE_NAME, TABLE_TYPE, ENGINE, ROW_FORMAT, TABLE_COLLATION
FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;

-- 3. Columnas: nombres, orden, tipos MariaDB, NULL, unsigned, longitudes,
-- precisión decimal/temporal, charset/collation y AUTO_INCREMENT.
-- No se usa DATA_TYPE='json': en MariaDB el alias aparece como LONGTEXT.
WITH sf_expected AS (
  SELECT 'organizations' AS table_name, 'id' AS column_name, 1 AS ordinal_position, 'bigint' AS data_type, 'NO' AS is_nullable, 1 AS unsigned_flag, NULL AS char_length, NULL AS numeric_precision, NULL AS numeric_scale, NULL AS datetime_precision, NULL AS character_set_name, NULL AS collation_name, 1 AS auto_increment_flag
  UNION ALL SELECT 'organizations', 'public_id', 2, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'organizations', 'legacy_namespace', 3, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'organizations', 'legacy_id', 4, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'organizations', 'legal_name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'tax_identifier', 6, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'phone', 7, 'varchar', 'YES', 0, 80, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'email', 8, 'varchar', 'YES', 0, 254, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'postal_address', 9, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'business_timezone', 10, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'primary_contact_person_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'organizations', 'status_code', 12, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'organizations', 'created_at', 13, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'organizations', 'updated_at', 14, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'organizations', 'logo_file_id', 15, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'people', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'people', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'people', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'people', 'display_name', 4, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'people', 'position_title', 5, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'people', 'email', 6, 'varchar', 'YES', 0, 254, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'people', 'phone', 7, 'varchar', 'YES', 0, 80, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'people', 'active', 8, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'people', 'created_at', 9, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'people', 'updated_at', 10, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'people', 'photo_file_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'users', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'users', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'users', 'person_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'users', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'users', 'legacy_namespace', 5, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'users', 'legacy_id', 6, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'users', 'login_email', 7, 'varchar', 'NO', 0, 254, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'users', 'normalized_login_email', 8, 'varchar', 'NO', 0, 254, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'users', 'password_hash', 9, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'users', 'credential_state', 10, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'users', 'external_issuer', 11, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'users', 'external_subject', 12, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'users', 'status_code', 13, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'users', 'access_enabled', 14, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'users', 'last_login_at', 15, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'users', 'created_at', 16, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'users', 'updated_at', 17, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'users', 'row_version', 18, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'roles', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'roles', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'roles', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'roles', 'code', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'roles', 'name', 5, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'roles', 'description', 6, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'roles', 'is_system', 7, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'permissions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'permissions', 'code', 2, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'permissions', 'description', 3, 'varchar', 'NO', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'role_permissions', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'role_permissions', 'role_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'role_permissions', 'permission_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_roles', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_roles', 'user_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_roles', 'role_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_permissions', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_permissions', 'user_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_permissions', 'permission_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_permissions', 'effect', 4, 'varchar', 'NO', 0, 8, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'user_permissions', 'reason', 5, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'user_permissions', 'granted_by', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'user_permissions', 'granted_at', 7, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'organization_settings', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'organization_settings', 'settings_group', 2, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'organization_settings', 'schema_version', 3, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'organization_settings', 'settings_json', 4, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'organization_settings', 'updated_by', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'organization_settings', 'updated_at', 6, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'currencies', 'code', 1, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'currencies', 'name', 2, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'currencies', 'minor_units', 3, 'tinyint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'currencies', 'active', 4, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'units', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'units', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'units', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'units', 'code', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'units', 'name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'units', 'symbol', 6, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'units', 'active', 7, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'categories', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'categories', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'categories', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'categories', 'code', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'categories', 'name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'categories', 'description', 6, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'categories', 'active', 7, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_types', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'service_types', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_types', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'service_types', 'code', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'service_types', 'name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_types', 'detail_schema_version', 6, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_types', 'active', 7, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'business_entities', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'business_entities', 'entity_kind', 4, 'varchar', 'NO', 0, 40, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'business_entities', 'legacy_namespace', 5, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'business_entities', 'legacy_id', 6, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'business_entities', 'created_at', 7, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'updated_at', 8, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'imported_at', 9, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'created_by', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'updated_by', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'row_version', 12, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'business_entities', 'archived_at', 13, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'files', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'files', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'files', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'files', 'storage_backend', 4, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'files', 'storage_key', 5, 'varchar', 'NO', 0, 512, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'files', 'detected_mime', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'files', 'size_bytes', 7, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'files', 'sha256', 8, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'files', 'scan_status', 9, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'files', 'retention_class', 10, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'files', 'retain_until', 11, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'files', 'created_by', 12, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'files', 'created_at', 13, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'entity_files', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'entity_files', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'entity_files', 'entity_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'entity_files', 'file_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'entity_files', 'association_key', 5, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'entity_files', 'file_role', 6, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'entity_files', 'original_filename', 7, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'entity_files', 'declared_mime', 8, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'entity_files', 'declared_size_bytes', 9, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'entity_files', 'legacy_json_path', 10, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'entity_files', 'created_at', 11, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'code', 3, 'varchar', 'NO', 0, 80, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'clients', 'legal_name', 4, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'brand_name', 5, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'tax_identifier', 6, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'address_text', 7, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'commercial_terms', 8, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'default_project_reference', 9, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'default_contract_reference', 10, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'notes', 11, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'status_code', 12, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'repeat_sales_policy', 13, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'repeat_sourcing_policy', 14, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'repeat_price_validity_days', 15, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'repeat_contract_reference', 16, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'repeat_contract_valid_until', 17, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'repeat_min_margin_pct', 18, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'repeat_policy_updated_at', 19, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'legacy_status', 20, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'clients', 'data_incomplete', 21, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'provisional_code', 22, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'provisional_name', 23, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'portal_enabled', 24, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'clients', 'portal_locked', 25, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'code', 3, 'varchar', 'NO', 0, 80, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'suppliers', 'supplier_key', 4, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'legal_name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'tax_identifier', 6, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'category_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'legacy_category_label', 8, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'status_code', 9, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'legacy_status', 10, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'default_currency', 11, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'suppliers', 'credit_type', 12, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'credit_days', 13, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'lead_time_value', 14, 'decimal', 'YES', 0, NULL, 12, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'lead_time_unit', 15, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'rating', 16, 'decimal', 'YES', 0, NULL, 8, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'rating_scale', 17, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'document_notes', 18, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'notes', 19, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'suppliers', 'data_incomplete', 20, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'provisional_code', 21, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'suppliers', 'provisional_name', 22, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contacts', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'party_contacts', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contacts', 'owner_entity_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contacts', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'party_contacts', 'display_name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contacts', 'position_title', 6, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contacts', 'source_ordinal', 7, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contacts', 'is_primary', 8, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contacts', 'active', 9, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'party_contact_channels', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'owner_entity_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'contact_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'channel_type', 5, 'varchar', 'NO', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contact_channels', 'value', 6, 'varchar', 'NO', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contact_channels', 'normalized_value', 7, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contact_channels', 'source_ordinal', 8, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'source_field', 9, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'party_contact_channels', 'is_primary', 10, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'party_contact_channels', 'verified_at', 11, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'supplier_offerings', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'supplier_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_offerings', 'legacy_id', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_offerings', 'name', 6, 'varchar', 'NO', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'offering_type', 7, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'category_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'legacy_category_label', 9, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'brand', 10, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'model', 11, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'description', 12, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'lead_time_value', 13, 'decimal', 'YES', 0, NULL, 12, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'lead_time_unit', 14, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'credit_type', 15, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'credit_days', 16, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'currency_code', 17, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_offerings', 'minimum_order_text', 18, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'valid_until', 19, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_offerings', 'coverage', 20, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'status_code', 21, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'notes', 22, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_offerings', 'updated_at', 23, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'projects', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'projects', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'projects', 'client_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'projects', 'code', 4, 'varchar', 'YES', 0, 80, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'projects', 'name', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'projects', 'status_code', 6, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'contracts', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'client_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'project_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'reference', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'contracts', 'starts_on', 6, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'ends_on', 7, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'contracts', 'currency_code', 8, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'contracts', 'status_code', 9, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'client_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'project_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'contract_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'folio', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'requisitions', 'client_reference', 7, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'internal_reference', 8, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'request_date', 9, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'need_date', 10, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'priority_code', 11, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'route_code', 12, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'service_type_id', 13, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'legacy_service_type', 14, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'client_snapshot', 15, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisitions', 'project_reference_snapshot', 16, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'contract_reference_snapshot', 17, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'requester_name', 18, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'requester_email', 19, 'varchar', 'YES', 0, 254, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'delivery_place', 20, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'budget_amount', 21, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'currency_code', 22, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'requisitions', 'description', 23, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'notes', 24, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'request_source_type', 25, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'request_source_date', 26, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'request_source_reference', 27, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'request_source_notes', 28, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'is_provisional', 29, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'formal_at_origin', 30, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'provisional_folio', 31, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'regularization_requirement', 32, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'regularization_due_date', 33, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'regularization_owner_user_id', 34, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'regularization_owner_snapshot', 35, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'regularization_status', 36, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'provisional_created_at', 37, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'current_revision_number', 38, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'history_based', 39, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'request_type_snapshot', 40, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'repeat_policy_snapshot', 41, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisitions', 'history_created_at', 42, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'requisitions', 'change_status', 43, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisitions', 'latest_change_request_id', 44, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'requisition_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'requisition_items', 'legacy_id', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'requisition_items', 'line_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'display_order', 7, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'description', 8, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'quantity', 9, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'unit_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'unit_label', 11, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'category_id', 12, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'category_label_snapshot', 13, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'line_status', 14, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'history_based', 15, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'history_origin', 16, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'source_requisition_id', 17, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'source_customer_quote_version_id', 18, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'repeat_client_price_mode', 19, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'repeat_sourcing_mode', 20, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_items', 'fixed_client_price', 21, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'fixed_client_unit_price', 22, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'fixed_client_currency', 23, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'requisition_items', 'historical_price_schema_version', 24, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'historical_price_snapshot', 25, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisition_items', 'cancelled_at', 26, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'created_by_change_request_id', 27, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_items', 'cancelled_by_change_request_id', 28, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'folio', 4, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'requisition_reviews', 'buyer_user_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'buyer_snapshot', 6, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisition_reviews', 'technical_result', 7, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_reviews', 'contract_result', 8, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_reviews', 'budget_result', 9, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_reviews', 'strategy', 10, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_reviews', 'min_quotes', 11, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'deadline', 12, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_reviews', 'criteria', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_reviews', 'notes', 14, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'folio', 4, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'requisition_change_requests', 'previous_revision_number', 5, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'new_revision_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'request_date', 7, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'requested_by_snapshot', 8, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'source_label', 9, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'change_type', 10, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'reference_text', 11, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'reason', 12, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'impact_text', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'requires_sourcing', 14, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'requires_supplier_confirmation', 15, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'status_code', 16, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'legacy_status', 17, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'po_amendment_status', 18, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_requests', 'resulting_customer_quote_version_id', 19, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_requests', 'evidence_file_id', 20, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'requisition_revision_snapshots', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'revision_number', 4, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'snapshot_schema_version', 5, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'snapshot_json', 6, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'snapshot_sha256', 7, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'canonical_payload_file_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'reason_text', 9, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'created_by_change_request_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'recorded_at', 11, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'requisition_revision_snapshots', 'provenance', 12, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'requisition_change_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'change_request_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'change_ordinal', 5, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'target_kind', 6, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_items', 'requisition_item_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'legacy_item_reference', 8, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'requisition_change_items', 'field_code', 9, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_items', 'change_kind', 10, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'requisition_change_items', 'requires_sourcing', 11, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'before_snapshot', 12, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisition_change_items', 'after_snapshot', 13, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'requisition_change_items', 'snapshot_schema_version', 14, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'requisition_change_items', 'resolution_status', 15, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'sourcing_plans', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'sourcing_plans', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_plans', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_plans', 'version_number', 4, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_plans', 'min_quotes', 5, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_plans', 'updated_at', 6, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lots', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'sourcing_lots', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lots', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lots', 'sourcing_plan_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lots', 'legacy_id', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'sourcing_lots', 'name', 6, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'sourcing_lots', 'min_quotes', 7, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_items', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_items', 'requisition_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_items', 'sourcing_lot_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_items', 'requisition_item_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_items', 'strategy', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'sourcing_lot_items', 'category_snapshot', 6, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'sourcing_lot_suppliers', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_suppliers', 'sourcing_lot_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_suppliers', 'supplier_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_suppliers', 'selected', 4, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'sourcing_lot_suppliers', 'suggested', 5, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'supplier_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'sourcing_lot_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'internal_contact_user_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'contact_snapshot', 7, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'rfqs', 'folio', 8, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'rfqs', 'request_date', 9, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'deadline', 10, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'required_date', 11, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfqs', 'currency_code', 12, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'rfqs', 'delivery_place', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfqs', 'requested_documents_text', 14, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfqs', 'terms_text', 15, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfqs', 'status_code', 16, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfqs', 'legacy_status', 17, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'rfq_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfq_items', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfq_items', 'rfq_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfq_items', 'requisition_item_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfq_items', 'line_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'rfq_items', 'legacy_item_reference', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'rfq_items', 'resolution_status', 8, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'description', 9, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'specification', 10, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'category_snapshot', 11, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'unit_label', 12, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'rfq_items', 'quantity', 13, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'supplier_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'rfq_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'folio', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'supplier_quotes', 'supplier_reference', 7, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'quote_date', 8, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'valid_until', 9, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'currency_code', 10, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_quotes', 'subtotal_amount', 11, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'legacy_tax_value', 12, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'tax_rate_pct', 13, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'tax_amount', 14, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'total_amount', 15, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'calculation_version', 16, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'reconciliation_status', 17, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'source_kind', 18, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'history_source_snapshot', 19, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'supplier_quotes', 'lead_days', 20, 'decimal', 'YES', 0, NULL, 12, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'payment_terms', 21, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'technical_score', 22, 'decimal', 'YES', 0, NULL, 8, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'document_score', 23, 'decimal', 'YES', 0, NULL, 8, 4, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quotes', 'notes', 24, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'status_code', 25, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quotes', 'legacy_status', 26, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'supplier_quote_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'supplier_quote_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'requisition_item_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'rfq_item_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'legacy_item_reference', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_quote_items', 'legacy_rfq_reference', 8, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'supplier_quote_items', 'legacy_rfq_folio', 9, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'line_number', 10, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'resolution_status', 11, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'description', 12, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'category_snapshot', 13, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'unit_label', 14, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'supplier_quote_items', 'requested_quantity', 15, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'offered', 16, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'quantity', 17, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'unit_price', 18, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'supplier_quote_items', 'line_subtotal', 19, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'awards', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'requisition_item_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'supplier_id', 5, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'supplier_quote_id', 6, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'supplier_quote_item_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'public_id', 8, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'awards', 'legacy_id', 9, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'awards', 'quantity', 10, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'unit_price', 11, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'subtotal_amount', 12, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'currency_code', 13, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'awards', 'source_kind', 14, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'awards', 'recovered_from_po_legacy_id', 15, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'awards', 'status_code', 16, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'awards', 'change_request_id', 17, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'legacy_change_reference', 18, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'awards', 'superseded_at', 19, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'created_at', 20, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'awards', 'updated_at', 21, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'customer_quotes', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quotes', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quotes', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quotes', 'client_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quotes', 'series_reference', 5, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'customer_quotes', 'migration_grouping_status', 6, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'approval_policy_versions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'approval_policy_versions', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'applies_to', 3, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'approval_policy_versions', 'version_number', 4, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'enabled', 5, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'currency_code', 6, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'approval_policy_versions', 'unit_price_limit', 7, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'document_limit', 8, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'total_basis', 9, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'approval_policy_versions', 'comparison_operator', 10, 'varchar', 'NO', 0, 2, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'approval_policy_versions', 'rules_json', 11, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'approval_policy_versions', 'effective_from', 12, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'effective_until', 13, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'approval_policy_versions', 'created_by', 14, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'customer_quote_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'requisition_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'version_number', 5, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'legacy_revision_number', 6, 'int', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'change_request_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'change_sourcing_required', 8, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'history_based', 9, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'history_source_snapshot', 10, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'supersedes_version_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'folio', 12, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'quote_date', 13, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'valid_until', 14, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'currency_code', 15, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'exchange_rate_date', 16, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'usd_mxn_rate', 17, 'decimal', 'YES', 0, NULL, 24, 10, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'eur_mxn_rate', 18, 'decimal', 'YES', 0, NULL, 24, 10, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'exchange_rate_source', 19, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'exchange_rate_label_snapshot', 20, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'document_status', 21, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'internal_approval_status', 22, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'client_decision_status', 23, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'legacy_status', 24, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'legacy_client_decision', 25, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'prepared_by', 26, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'reviewed_by', 27, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'approved_by', 28, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'people_snapshots', 29, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'client_snapshot', 30, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'delivery_place', 31, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'lead_time_text', 32, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'payment_terms', 33, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'warranty_text', 34, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'inclusions_text', 35, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'exclusions_text', 36, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'notes', 37, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'subtotal_amount', 38, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'legacy_discount_value', 39, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'discount_kind', 40, 'varchar', 'YES', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'discount_rate_pct', 41, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'discount_amount', 42, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'legacy_tax_value', 43, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'tax_rate_pct', 44, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'tax_amount', 45, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'third_party_taxable_amount', 46, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'third_party_tax_amount', 47, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'third_party_total_amount', 48, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_enabled', 49, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_rate_pct', 50, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_base_amount', 51, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_unit_price', 52, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_subtotal_amount', 53, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_tax_rate_pct', 54, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_tax_amount', 55, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_total_amount', 56, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'service_fee_comments', 57, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'financial_breakdown_provenance', 58, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'total_amount', 59, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'calculation_version', 60, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'reconciliation_status', 61, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_versions', 'approval_policy_version_id', 62, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'approval_policy_snapshot', 63, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'approval_evaluation_snapshot', 64, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_versions', 'approved_content_sha256', 65, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'issued_at', 66, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_versions', 'locked_at', 67, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'customer_quote_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'customer_quote_version_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'requisition_item_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'award_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'line_number', 7, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'legacy_item_reference', 8, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'customer_quote_items', 'resolution_status', 9, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'description', 10, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'brand_model', 11, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'unit_label', 12, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'quantity', 13, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'cost_amount', 14, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'extra_amount', 15, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'charge_pct', 16, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'legacy_margin_value', 17, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'pricing_formula_code', 18, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'fixed_client_price', 19, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'fixed_client_unit_price', 20, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'fixed_client_currency', 21, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'customer_quote_items', 'fixed_price_conversion_pending', 22, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'history_based', 23, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'sourcing_pending', 24, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'cost_is_manual', 25, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'original_cost_amount', 26, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'original_cost_currency', 27, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'customer_quote_items', 'cost_source_text', 28, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'exchange_rate', 29, 'decimal', 'YES', 0, NULL, 24, 10, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'exchange_rate_date', 30, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'exchange_rate_source', 31, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_items', 'unit_price', 32, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_items', 'line_subtotal', 33, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'customer_quote_adjustments', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'customer_quote_version_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'calculation_order', 4, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'adjustment_kind', 5, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'method_code', 6, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'basis_code', 7, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'basis_amount', 8, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'rate_pct', 9, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'amount', 10, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_adjustments', 'tax_treatment_code', 11, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'calculation_rule_version', 12, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'description_text', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_adjustments', 'provenance', 14, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_decisions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'customer_quote_decisions', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'customer_quote_version_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'decision_code', 4, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_decisions', 'decision_at', 5, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'recorded_at', 6, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'actor_user_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'actor_client_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'auth_session_id', 9, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'external_actor_snapshot', 10, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'customer_quote_decisions', 'decision_channel', 11, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_decisions', 'note', 12, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'customer_quote_decisions', 'evidence_file_id', 13, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'document_sha256', 14, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'customer_quote_decisions', 'provenance', 15, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'supplier_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'primary_supplier_quote_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'source_customer_quote_version_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'folio', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'purchase_orders', 'series_public_id', 7, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'purchase_orders', 'version_number', 8, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'legacy_revision_number', 9, 'int', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'root_purchase_order_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'supersedes_purchase_order_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'change_request_id', 12, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'amendment_date', 13, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'amendment_type', 14, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'amendment_source', 15, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'amendment_reference', 16, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'amendment_reason', 17, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'previous_total_amount', 18, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'amendment_schema_version', 19, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'amendment_snapshot', 20, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'change_pending', 21, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'change_pending_status', 22, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'modification_approval_status', 23, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'modification_authorization_request_id', 24, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'order_date', 25, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'commitment_date', 26, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'currency_code', 27, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'purchase_orders', 'subtotal_amount', 28, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'legacy_tax_value', 29, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'tax_rate_pct', 30, 'decimal', 'YES', 0, NULL, 12, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'tax_amount', 31, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'total_amount', 32, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'reconciliation_status', 33, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'operational_status', 34, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'approval_status', 35, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'legacy_status', 36, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'legacy_workflow_status', 37, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'buyer_user_id', 38, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'preparer_user_id', 39, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'authorizer_user_id', 40, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'current_responsible_user_id', 41, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'current_responsible_role', 42, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'people_snapshots', 43, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'supplier_snapshot', 44, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'bill_to_snapshot', 45, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'delivery_place', 46, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'incoterm_code', 47, 'varchar', 'YES', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'order_reference', 48, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'internal_reference', 49, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'payment_method_code', 50, 'varchar', 'YES', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'payment_method_label', 51, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'payment_form_code', 52, 'varchar', 'YES', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'payment_form_label', 53, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'cfdi_use_code', 54, 'varchar', 'YES', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'cfdi_use_label', 55, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'invoice_contact_snapshot', 56, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'terms_text', 57, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'delivery_schedule_text', 58, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'notes', 59, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_orders', 'auto_generated', 60, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'consolidated_legacy', 61, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'one_po_per_supplier_legacy', 62, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'automation_source_snapshot', 63, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_orders', 'authorized_at', 64, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'approved_content_sha256', 65, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_orders', 'locked_at', 66, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'purchase_order_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'series_public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'folio', 5, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'legacy_po_revision_number', 6, 'int', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'change_type', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'urgency', 8, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'reference_text', 9, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'impact_text', 10, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'reason', 11, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'status_code', 12, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'requested_by_user_id', 13, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'requester_snapshot', 14, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'requested_at', 15, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'assigned_approver_user_id', 16, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'approver_snapshot', 17, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'decision_code', 18, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'decided_by_user_id', 19, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'decision_actor_snapshot', 20, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'decision_at', 21, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'approved_at', 22, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'decision_comment', 23, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'resubmitted_at', 24, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'consumed_at', 25, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'consumed_by_user_id', 26, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'consumed_by_snapshot', 27, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'purchase_order_modification_requests', 'generated_purchase_order_id', 28, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_requisitions', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_requisitions', 'purchase_order_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_requisitions', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_requisitions', 'is_primary', 4, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_requisitions', 'requisition_folio_snapshot', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_requisitions', 'internal_reference_snapshot', 6, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'purchase_order_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'purchase_order_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'purchase_order_items', 'line_number', 5, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'legacy_item_reference', 6, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'purchase_order_items', 'description', 7, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'category_snapshot', 8, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'unit_label', 9, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'quantity', 10, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'unit_price', 11, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'line_subtotal', 12, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'source_resolution_status', 13, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'previous_purchase_order_item_id', 14, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_items', 'line_status', 15, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_items', 'amendment_action_snapshot', 16, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_line_sources', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'purchase_order_line_sources', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'purchase_order_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'purchase_order_item_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'source_ordinal', 5, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'requisition_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'requisition_item_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'supplier_quote_item_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'award_id', 9, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'sourcing_lot_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'sourcing_lot_name_snapshot', 11, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_line_sources', 'allocated_quantity', 12, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'purchase_order_line_sources', 'resolution_status', 13, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'purchase_order_line_sources', 'legacy_source_snapshot', 14, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'workflow_events', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'workflow_events', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'entity_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'public_id', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'workflow_events', 'legacy_event_id', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'workflow_events', 'workflow_code', 6, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'action_code', 7, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'from_state', 8, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'to_state', 9, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'actor_user_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'target_user_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'actor_snapshot', 12, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'workflow_events', 'legacy_action_text', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'comment_text', 14, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'workflow_events', 'related_change_request_id', 15, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'payload_schema_version', 16, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'payload_json', 17, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'workflow_events', 'occurred_at', 18, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'recorded_at', 19, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'content_sha256', 20, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'workflow_events', 'provenance', 21, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'purchase_order_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'folio', 4, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'goods_receipts', 'receipt_date', 5, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'capture_grain', 6, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'status_code', 7, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'legacy_type', 8, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'legacy_received_percent', 9, 'decimal', 'YES', 0, NULL, 12, 8, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'legacy_delivery_percent', 10, 'decimal', 'YES', 0, NULL, 12, 8, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'quality_result', 11, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'documentation_result', 12, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'notes', 13, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipts', 'legacy_delivery_snapshot', 14, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'goods_receipts', 'origin_purchase_order_id', 15, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'amendment_reconciliation_schema_version', 16, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipts', 'amendment_reconciliation_snapshot', 17, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'goods_receipt_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'goods_receipt_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'goods_receipt_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'purchase_order_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'purchase_order_item_id', 5, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'line_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'received_quantity', 7, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'accepted_quantity', 8, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'rejected_quantity', 9, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'goods_receipt_items', 'unit_label', 10, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipt_items', 'quality_note', 11, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'goods_receipt_items', 'provenance', 12, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'deliveries', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'deliveries', 'client_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'deliveries', 'folio', 4, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'deliveries', 'delivery_date', 5, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'deliveries', 'control_reference', 6, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'delivery_type', 7, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'acceptance_status', 8, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'status_code', 9, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'legacy_status', 10, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'client_snapshot', 11, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'deliveries', 'delivery_place', 12, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'delivered_by_snapshot', 13, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'deliveries', 'received_by_snapshot', 14, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'deliveries', 'evidence_text', 15, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'notes', 16, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'deliveries', 'locked_at', 17, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'deliveries', 'legacy_locked', 18, 'tinyint', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'delivery_sources', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'delivery_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'source_ordinal', 4, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'requisition_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'purchase_order_id', 6, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'goods_receipt_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_sources', 'folio_snapshots', 8, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'delivery_items', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'delivery_items', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'delivery_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'requisition_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'requisition_item_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'line_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'legacy_item_key', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'delivery_items', 'source_resolution_status', 8, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'delivery_items', 'description', 9, 'text', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'delivery_items', 'unit_label', 10, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'delivery_items', 'delivery_quantity', 11, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'requested_qty_snapshot', 12, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'received_qty_snapshot', 13, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'previous_delivered_qty_snapshot', 14, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'balance_after_snapshot', 15, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_items', 'legacy_po_folios', 16, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'delivery_item_allocations', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'delivery_item_allocations', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_item_allocations', 'delivery_item_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_item_allocations', 'goods_receipt_item_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'delivery_item_allocations', 'allocated_quantity', 5, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'signature_evidence', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'entity_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signature_role', 4, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'method_label', 5, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'signature_file_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signer_user_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signer_client_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signer_auth_session_id', 9, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'captured_by_user_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'capture_auth_session_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'capture_actor_snapshot', 12, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'signature_evidence', 'signer_snapshot', 13, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'signature_evidence', 'signed_at', 14, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'document_sha256', 15, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signature_sha256', 16, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'evidence_sha256', 17, 'binary', 'YES', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'hash_origin', 18, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'hashing_scope', 19, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'legacy_payload_json_path', 20, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'import_record_id', 21, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'canonicalization_version', 22, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'canonical_payload_file_id', 23, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'signed_payload_schema_version', 24, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'evidence_scope_version', 25, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'attachment_manifest_json', 26, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'signature_evidence', 'consent_statement_snapshot', 27, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'consent_recorded_at', 28, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'integrity_verification_status', 29, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'preservation_standard', 30, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'preservation_status', 31, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'certification_provider', 32, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'certification_reference', 33, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'timestamp_reference', 34, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'signature_evidence', 'certification_file_id', 35, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'certification_recorded_at', 36, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'signature_evidence', 'legacy_evidence_metadata', 37, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'invoices', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'requisition_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'client_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'primary_purchase_order_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'goods_receipt_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'legacy_receipt_reference', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'folio', 8, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'invoices', 'invoice_number', 9, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'normalized_invoice_number', 10, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'invoices', 'fiscal_uuid', 11, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'invoices', 'issue_date', 12, 'date', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'due_date', 13, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'issuer_snapshot', 14, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'receiver_snapshot', 15, 'varchar', 'YES', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'subtotal_amount', 16, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'tax_amount', 17, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'total_amount', 18, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'currency_code', 19, 'char', 'NO', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'invoices', 'status_code', 20, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'legacy_status', 21, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'payment_terms', 22, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'notes', 23, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'document_file_id', 24, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'document_revision_number', 25, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoices', 'calculation_version', 26, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoices', 'reconciliation_status', 27, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoice_purchase_orders', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_purchase_orders', 'invoice_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_purchase_orders', 'purchase_order_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_purchase_orders', 'is_primary', 4, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_purchase_orders', 'source_ordinal', 5, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_purchase_orders', 'po_folio_snapshot', 6, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoice_acknowledgments', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'invoice_acknowledgments', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'invoice_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'client_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'public_id', 5, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'invoice_acknowledgments', 'invoice_document_revision_number', 6, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'document_file_id', 7, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'document_snapshot_schema_version', 8, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'document_snapshot_json', 9, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'invoice_acknowledgments', 'signature_evidence_id', 10, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'auth_session_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'signer_name_snapshot', 12, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoice_acknowledgments', 'signer_role_snapshot', 13, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'invoice_acknowledgments', 'acknowledged_on', 14, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'acknowledged_at', 15, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'recorded_at', 16, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'invoice_acknowledgments', 'provenance', 17, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'requisition_id', 3, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'client_id', 4, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'service_type_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'legacy_service_type', 6, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'supplier_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'supplier_purchase_order_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'folio', 9, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'service_orders', 'internal_reference', 10, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'client_snapshot', 11, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'service_orders', 'supplier_snapshot', 12, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'service_orders', 'project_reference_snapshot', 13, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'contract_reference_snapshot', 14, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'authorization_type', 15, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'authorization_status', 16, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'authorization_reference', 17, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'authorization_date', 18, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'authorization_amount', 19, 'decimal', 'YES', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'authorization_currency', 20, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'service_orders', 'authorization_valid_until', 21, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'requires_supplier', 22, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'supplier_po_snapshot', 23, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'service_orders', 'request_date', 24, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'required_date', 25, 'date', 'YES', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'responsible_user_id', 26, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'responsible_snapshot', 27, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'status_code', 28, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'legacy_status', 29, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'quantity', 30, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'unit_label', 31, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'cost_amount', 32, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'price_amount', 33, 'decimal', 'NO', 0, NULL, 20, 6, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'commercial_currency', 34, 'char', 'YES', 0, 3, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'service_orders', 'commercial_currency_resolution', 35, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'description', 36, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'notes', 37, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'detail_schema_code', 38, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'service_orders', 'detail_schema_version', 39, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'service_orders', 'details_json', 40, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'audit_events', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'audit_events', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'audit_events', 'legacy_id', 4, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'audit_events', 'subject_entity_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'subject_user_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'actor_user_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'actor_snapshot', 8, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'audit_events', 'audit_schema_version', 9, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'legacy_audit_version', 10, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'audit_events', 'module_code', 11, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'action_code', 12, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'result_code', 13, 'varchar', 'YES', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'occurred_at', 14, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'legacy_date_text', 15, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'recorded_at', 16, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'audit_events', 'correlation_id', 17, 'char', 'YES', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'audit_events', 'detail_text', 18, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'changes_json', 19, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'audit_events', 'before_json', 20, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'audit_events', 'after_json', 21, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'audit_events', 'legacy_record_reference', 22, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'audit_events', 'source_kind', 23, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'notifications', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'notifications', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'notifications', 'legacy_id', 4, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'notifications', 'recipient_user_id', 5, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'sender_user_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'entity_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'notification_type', 8, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'notifications', 'title', 9, 'varchar', 'NO', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'notifications', 'message', 10, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'notifications', 'created_at', 11, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'is_read', 12, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'notifications', 'read_at', 13, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'outbox_messages', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'outbox_messages', 'event_deduplication_sha256', 4, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'entity_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'event_type', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'outbox_messages', 'document_file_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'actor_user_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'recipient_snapshot_json', 9, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'outbox_messages', 'channel', 10, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'outbox_messages', 'payload_schema_version', 11, 'smallint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'payload_json', 12, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'outbox_messages', 'status_code', 13, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'outbox_messages', 'attempts', 14, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'available_at', 15, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'locked_until', 16, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'locked_by', 17, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'outbox_messages', 'created_at', 18, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'completed_at', 19, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'outbox_messages', 'last_error_code', 20, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'email_delivery_logs', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'email_delivery_logs', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'email_delivery_logs', 'outbox_message_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'email_delivery_logs', 'attempt_number', 5, 'int', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'email_delivery_logs', 'event_key', 6, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'event_type', 7, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'reference_text', 8, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'recipients_snapshot', 9, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'email_delivery_logs', 'status_code', 10, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'legacy_status', 11, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'detail_text', 12, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'sender_user_id', 13, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'email_delivery_logs', 'sender_snapshot', 14, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'provider_response_json', 15, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'email_delivery_logs', 'provider_message_id', 16, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'email_delivery_logs', 'occurred_at', 17, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'ai_runs', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'ai_runs', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'ai_runs', 'legacy_id', 3, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'ai_runs', 'requisition_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'ai_runs', 'legacy_requisition_reference', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'task_code', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'task_label', 7, 'varchar', 'YES', 0, 255, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'execution_mode', 8, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'origin', 9, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'status_code', 10, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'output_text', 11, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'provider_name', 12, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'model_name', 13, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'prompt_version', 14, 'varchar', 'YES', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'ai_runs', 'occurred_at', 15, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'document_sequences', 'organization_id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'document_sequences', 'document_kind', 2, 'varchar', 'NO', 0, 40, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'document_sequences', 'series_code', 3, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'document_sequences', 'period_key', 4, 'varchar', 'NO', 0, 16, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'document_sequences', 'next_value', 5, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'document_sequences', 'updated_at', 6, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'portal_access_tokens', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'client_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'token_selector', 4, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'portal_access_tokens', 'token_hash', 5, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'allowed_actions_json', 6, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'portal_access_tokens', 'expires_at', 7, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'revoked_at', 8, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'issued_by', 9, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'created_at', 10, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'portal_access_tokens', 'last_used_at', 11, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'auth_sessions', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'auth_sessions', 'principal_kind', 4, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'auth_sessions', 'user_id', 5, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'client_id', 6, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'portal_access_token_id', 7, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'token_sha256', 8, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'authentication_method', 9, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'auth_sessions', 'allowed_actions_json', 10, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'auth_sessions', 'created_at', 11, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'expires_at', 12, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'last_seen_at', 13, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'revoked_at', 14, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'auth_sessions', 'revocation_reason', 15, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'idempotency_keys', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'idempotency_keys', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'actor_user_id', 3, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'actor_client_id', 4, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'endpoint_code', 5, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'idempotency_keys', 'key_sha256', 6, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'request_sha256', 7, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'state_code', 8, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'idempotency_keys', 'response_status', 9, 'smallint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'response_json', 10, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'idempotency_keys', 'created_at', 11, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'idempotency_keys', 'expires_at', 12, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'import_batches', 'organization_id', 2, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'public_id', 3, 'char', 'NO', 0, 36, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_batches', 'source_system', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_batches', 'source_filename', 5, 'varchar', 'NO', 0, 500, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_batches', 'source_sha256', 6, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'source_size_bytes', 7, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'encrypted_archive_storage_key', 8, 'varchar', 'NO', 0, 512, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_batches', 'mapping_version', 9, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_batches', 'importer_version', 10, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_batches', 'status_code', 11, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_batches', 'dry_run', 12, 'tinyint', 'NO', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'manifest_json', 13, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'import_batches', 'started_at', 14, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'import_batches', 'completed_at', 15, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'import_records', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'import_records', 'import_batch_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_records', 'root_collection', 3, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_records', 'source_ordinal', 4, 'int', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_records', 'source_legacy_id', 5, 'varchar', 'YES', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_records', 'source_json_path', 6, 'varchar', 'NO', 0, 512, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_nopad_bin', 0
  UNION ALL SELECT 'import_records', 'source_record_sha256', 7, 'binary', 'NO', 0, 32, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_records', 'redacted_payload_json', 8, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'import_records', 'redaction_manifest_json', 9, 'longtext', 'NO', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'import_records', 'status_code', 10, 'varchar', 'NO', 0, 32, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_records', 'created_at', 11, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'import_issues', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'import_issues', 'import_batch_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_issues', 'import_record_id', 3, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_issues', 'severity', 4, 'varchar', 'NO', 0, 16, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_issues', 'issue_code', 5, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'import_issues', 'source_json_path', 6, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_issues', 'evidence_json', 7, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'import_issues', 'resolution_status', 8, 'varchar', 'NO', 0, 24, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_issues', 'decision_text', 9, 'text', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'import_issues', 'decided_by', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'import_issues', 'decided_at', 11, 'datetime', 'YES', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'id', 1, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 1
  UNION ALL SELECT 'legacy_id_map', 'organization_id', 2, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'import_batch_id', 3, 'bigint', 'NO', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'source_system', 4, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'legacy_id_map', 'source_collection', 5, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'legacy_id_map', 'source_parent_legacy_id', 6, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'legacy_id_map', 'source_legacy_id', 7, 'varchar', 'NO', 0, 128, NULL, NULL, NULL, 'ascii', 'ascii_bin', 0
  UNION ALL SELECT 'legacy_id_map', 'target_entity_id', 8, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'target_user_id', 9, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'target_person_id', 10, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'target_requisition_item_id', 11, 'bigint', 'YES', 1, NULL, NULL, NULL, NULL, NULL, NULL, 0
  UNION ALL SELECT 'legacy_id_map', 'mapping_method', 12, 'varchar', 'NO', 0, 64, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_uca1400_nopad_ai_ci', 0
  UNION ALL SELECT 'legacy_id_map', 'evidence_json', 13, 'longtext', 'YES', 0, NULL, NULL, NULL, NULL, 'utf8mb4', 'utf8mb4_bin', 0
  UNION ALL SELECT 'legacy_id_map', 'created_at', 14, 'datetime', 'NO', 0, NULL, NULL, NULL, 6, NULL, NULL, 0
),
sf_actual AS (
 SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,ORDINAL_POSITION AS ordinal_position,
        DATA_TYPE AS data_type,IS_NULLABLE AS is_nullable,
        (LOWER(COLUMN_TYPE) LIKE '%unsigned%') AS unsigned_flag,
        CHARACTER_MAXIMUM_LENGTH AS char_length,NUMERIC_PRECISION AS numeric_precision,
        NUMERIC_SCALE AS numeric_scale,DATETIME_PRECISION AS datetime_precision,
        CHARACTER_SET_NAME AS character_set_name,COLLATION_NAME AS collation_name,
        (LOWER(EXTRA) LIKE '%auto_increment%') AS auto_increment_flag
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
), sf_diff AS (
 SELECT e.table_name,e.column_name,
        CASE WHEN a.column_name IS NULL THEN 'COLUMNA_AUSENTE' ELSE 'DEFINICION_DIFIERE' END AS problema
 FROM sf_expected e LEFT JOIN sf_actual a
 ON BINARY a.table_name=BINARY e.table_name AND BINARY a.column_name=BINARY e.column_name
 WHERE a.column_name IS NULL OR a.ordinal_position<>e.ordinal_position OR a.data_type<>e.data_type
    OR a.is_nullable<>e.is_nullable OR a.unsigned_flag<>e.unsigned_flag
    OR (e.char_length IS NOT NULL AND NOT(a.char_length<=>e.char_length))
    OR (e.numeric_precision IS NOT NULL AND NOT(a.numeric_precision<=>e.numeric_precision))
    OR (e.numeric_scale IS NOT NULL AND NOT(a.numeric_scale<=>e.numeric_scale))
    OR (e.datetime_precision IS NOT NULL AND NOT(a.datetime_precision<=>e.datetime_precision))
    OR NOT(a.character_set_name<=>e.character_set_name)
    OR NOT(a.collation_name<=>e.collation_name) OR a.auto_increment_flag<>e.auto_increment_flag
 UNION ALL
 SELECT a.table_name,a.column_name,'COLUMNA_NO_PREVISTA' FROM sf_actual a
 LEFT JOIN sf_expected e ON BINARY a.table_name=BINARY e.table_name AND BINARY a.column_name=BINARY e.column_name
 WHERE e.column_name IS NULL
)
SELECT '03_columnas' AS seccion,
       CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END AS estado,
       CAST((SELECT COUNT(*) FROM sf_expected) AS CHAR) AS tabla,
       CAST((SELECT COUNT(*) FROM sf_actual) AS CHAR) AS objeto,
       CONCAT(COUNT(*),' diferencias; tabla/objeto de esta fila resumen son conteos') AS detalle FROM sf_diff
UNION ALL
SELECT '03_columnas','FAIL',table_name,column_name,problema FROM sf_diff;

-- 4. PK y UNIQUE exactos. Se comprueba orden de columnas y ausencia de
-- prefijos SUB_PART. No se confunden índices no únicos auto-creados por FK.
WITH sf_expected AS (
  SELECT 'organizations' AS table_name, 'PRIMARY' AS index_name, 'id' AS key_columns
  UNION ALL SELECT 'organizations', 'uq_organizations_public', 'public_id'
  UNION ALL SELECT 'organizations', 'uq_organizations_legacy', 'legacy_namespace,legacy_id'
  UNION ALL SELECT 'people', 'PRIMARY', 'id'
  UNION ALL SELECT 'people', 'uq_people_public', 'public_id'
  UNION ALL SELECT 'people', 'uq_people_id_org', 'id,organization_id'
  UNION ALL SELECT 'users', 'PRIMARY', 'id'
  UNION ALL SELECT 'users', 'uq_users_public', 'public_id'
  UNION ALL SELECT 'users', 'uq_users_id_org', 'id,organization_id'
  UNION ALL SELECT 'users', 'uq_users_person', 'organization_id,person_id'
  UNION ALL SELECT 'users', 'uq_users_login', 'organization_id,normalized_login_email'
  UNION ALL SELECT 'users', 'uq_users_legacy', 'organization_id,legacy_namespace,legacy_id'
  UNION ALL SELECT 'users', 'uq_users_external', 'organization_id,external_issuer,external_subject'
  UNION ALL SELECT 'roles', 'PRIMARY', 'id'
  UNION ALL SELECT 'roles', 'uq_roles_id_org', 'id,organization_id'
  UNION ALL SELECT 'roles', 'uq_roles_code', 'organization_id,code'
  UNION ALL SELECT 'roles', 'uq_roles_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'permissions', 'PRIMARY', 'id'
  UNION ALL SELECT 'permissions', 'uq_permissions_code', 'code'
  UNION ALL SELECT 'role_permissions', 'PRIMARY', 'role_id,permission_id'
  UNION ALL SELECT 'user_roles', 'PRIMARY', 'user_id,role_id'
  UNION ALL SELECT 'user_permissions', 'PRIMARY', 'user_id,permission_id'
  UNION ALL SELECT 'organization_settings', 'PRIMARY', 'organization_id,settings_group'
  UNION ALL SELECT 'currencies', 'PRIMARY', 'code'
  UNION ALL SELECT 'units', 'PRIMARY', 'id'
  UNION ALL SELECT 'units', 'uq_units_id_org', 'id,organization_id'
  UNION ALL SELECT 'units', 'uq_units_code', 'organization_id,code'
  UNION ALL SELECT 'units', 'uq_units_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'categories', 'PRIMARY', 'id'
  UNION ALL SELECT 'categories', 'uq_categories_id_org', 'id,organization_id'
  UNION ALL SELECT 'categories', 'uq_categories_code', 'organization_id,code'
  UNION ALL SELECT 'categories', 'uq_categories_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'service_types', 'PRIMARY', 'id'
  UNION ALL SELECT 'service_types', 'uq_service_types_id_org', 'id,organization_id'
  UNION ALL SELECT 'service_types', 'uq_service_types_code', 'organization_id,code'
  UNION ALL SELECT 'service_types', 'uq_service_types_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'business_entities', 'PRIMARY', 'id'
  UNION ALL SELECT 'business_entities', 'uq_entities_public', 'public_id'
  UNION ALL SELECT 'business_entities', 'uq_entities_id_org', 'id,organization_id'
  UNION ALL SELECT 'business_entities', 'uq_entities_legacy', 'organization_id,legacy_namespace,entity_kind,legacy_id'
  UNION ALL SELECT 'files', 'PRIMARY', 'id'
  UNION ALL SELECT 'files', 'uq_files_public', 'public_id'
  UNION ALL SELECT 'files', 'uq_files_id_org', 'id,organization_id'
  UNION ALL SELECT 'files', 'uq_files_storage', 'storage_backend,storage_key'
  UNION ALL SELECT 'files', 'uq_files_content', 'organization_id,sha256,size_bytes'
  UNION ALL SELECT 'entity_files', 'PRIMARY', 'id'
  UNION ALL SELECT 'entity_files', 'uq_entityfiles_association', 'entity_id,association_key'
  UNION ALL SELECT 'clients', 'PRIMARY', 'id'
  UNION ALL SELECT 'clients', 'uq_clients_id_org', 'id,organization_id'
  UNION ALL SELECT 'clients', 'uq_clients_code', 'organization_id,code'
  UNION ALL SELECT 'suppliers', 'PRIMARY', 'id'
  UNION ALL SELECT 'suppliers', 'uq_suppliers_id_org', 'id,organization_id'
  UNION ALL SELECT 'suppliers', 'uq_suppliers_code', 'organization_id,code'
  UNION ALL SELECT 'party_contacts', 'PRIMARY', 'id'
  UNION ALL SELECT 'party_contacts', 'uq_partycontacts_public', 'public_id'
  UNION ALL SELECT 'party_contacts', 'uq_partycontacts_owner', 'id,owner_entity_id,organization_id'
  UNION ALL SELECT 'party_contact_channels', 'PRIMARY', 'id'
  UNION ALL SELECT 'supplier_offerings', 'PRIMARY', 'id'
  UNION ALL SELECT 'supplier_offerings', 'uq_offerings_public', 'public_id'
  UNION ALL SELECT 'supplier_offerings', 'uq_offerings_legacy', 'supplier_id,legacy_id'
  UNION ALL SELECT 'projects', 'PRIMARY', 'id'
  UNION ALL SELECT 'projects', 'uq_projects_id_org', 'id,organization_id'
  UNION ALL SELECT 'contracts', 'PRIMARY', 'id'
  UNION ALL SELECT 'contracts', 'uq_contracts_id_org', 'id,organization_id'
  UNION ALL SELECT 'requisitions', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisitions', 'uq_requisitions_id_org', 'id,organization_id'
  UNION ALL SELECT 'requisitions', 'uq_requisitions_folio', 'organization_id,folio'
  UNION ALL SELECT 'requisition_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisition_items', 'uq_reqitems_public', 'public_id'
  UNION ALL SELECT 'requisition_items', 'uq_reqitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'requisition_items', 'uq_reqitems_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'requisition_items', 'uq_reqitems_ordinal', 'requisition_id,line_number'
  UNION ALL SELECT 'requisition_items', 'uq_reqitems_legacy', 'requisition_id,legacy_id'
  UNION ALL SELECT 'requisition_reviews', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisition_reviews', 'uq_requisition_reviews_id_org', 'id,organization_id'
  UNION ALL SELECT 'requisition_reviews', 'uq_reviews_folio', 'organization_id,folio'
  UNION ALL SELECT 'requisition_change_requests', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisition_change_requests', 'uq_requisition_change_requests_id_org', 'id,organization_id'
  UNION ALL SELECT 'requisition_change_requests', 'uq_reqchanges_folio', 'organization_id,folio'
  UNION ALL SELECT 'requisition_change_requests', 'uq_reqchanges_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'requisition_revision_snapshots', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisition_revision_snapshots', 'uq_reqrevisions_number', 'requisition_id,revision_number'
  UNION ALL SELECT 'requisition_change_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'requisition_change_items', 'uq_reqchangeitems_ordinal', 'change_request_id,change_ordinal'
  UNION ALL SELECT 'sourcing_plans', 'PRIMARY', 'id'
  UNION ALL SELECT 'sourcing_plans', 'uq_sourcingplan_version', 'requisition_id,version_number'
  UNION ALL SELECT 'sourcing_plans', 'uq_sourcingplan_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'sourcing_lots', 'PRIMARY', 'id'
  UNION ALL SELECT 'sourcing_lots', 'uq_sourcinglots_id_org', 'id,organization_id'
  UNION ALL SELECT 'sourcing_lots', 'uq_sourcinglots_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'sourcing_lots', 'uq_sourcinglots_legacy', 'sourcing_plan_id,legacy_id'
  UNION ALL SELECT 'sourcing_lot_items', 'PRIMARY', 'sourcing_lot_id,requisition_item_id'
  UNION ALL SELECT 'sourcing_lot_suppliers', 'PRIMARY', 'sourcing_lot_id,supplier_id'
  UNION ALL SELECT 'rfqs', 'PRIMARY', 'id'
  UNION ALL SELECT 'rfqs', 'uq_rfqs_id_org', 'id,organization_id'
  UNION ALL SELECT 'rfqs', 'uq_rfqs_folio', 'organization_id,folio'
  UNION ALL SELECT 'rfqs', 'uq_rfqs_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'rfq_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'rfq_items', 'uq_rfqitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'rfq_items', 'uq_rfqitems_owner', 'id,organization_id,rfq_id'
  UNION ALL SELECT 'rfq_items', 'uq_rfqitems_line', 'rfq_id,line_number'
  UNION ALL SELECT 'supplier_quotes', 'PRIMARY', 'id'
  UNION ALL SELECT 'supplier_quotes', 'uq_supplier_quotes_id_org', 'id,organization_id'
  UNION ALL SELECT 'supplier_quotes', 'uq_supplierquotes_folio', 'organization_id,folio'
  UNION ALL SELECT 'supplier_quotes', 'uq_supplierquotes_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'supplier_quote_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'supplier_quote_items', 'uq_sqitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'supplier_quote_items', 'uq_sqitems_owner', 'id,organization_id,supplier_quote_id'
  UNION ALL SELECT 'supplier_quote_items', 'uq_sqitems_line', 'supplier_quote_id,line_number'
  UNION ALL SELECT 'awards', 'PRIMARY', 'id'
  UNION ALL SELECT 'awards', 'uq_awards_public', 'public_id'
  UNION ALL SELECT 'awards', 'uq_awards_id_org', 'id,organization_id'
  UNION ALL SELECT 'awards', 'uq_awards_legacy', 'requisition_id,legacy_id'
  UNION ALL SELECT 'customer_quotes', 'PRIMARY', 'id'
  UNION ALL SELECT 'customer_quotes', 'uq_customer_quotes_id_org', 'id,organization_id'
  UNION ALL SELECT 'customer_quotes', 'uq_customerquotes_series', 'organization_id,series_reference'
  UNION ALL SELECT 'customer_quotes', 'uq_customerquotes_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'approval_policy_versions', 'PRIMARY', 'id'
  UNION ALL SELECT 'approval_policy_versions', 'uq_policy_version', 'organization_id,applies_to,version_number'
  UNION ALL SELECT 'approval_policy_versions', 'uq_policy_id_org', 'id,organization_id'
  UNION ALL SELECT 'customer_quote_versions', 'PRIMARY', 'id'
  UNION ALL SELECT 'customer_quote_versions', 'uq_customer_quote_versions_id_org', 'id,organization_id'
  UNION ALL SELECT 'customer_quote_versions', 'uq_cqversions_version', 'customer_quote_id,version_number'
  UNION ALL SELECT 'customer_quote_versions', 'uq_cqversions_owner', 'id,organization_id,requisition_id'
  UNION ALL SELECT 'customer_quote_versions', 'uq_cqversions_series_owner', 'id,organization_id,customer_quote_id'
  UNION ALL SELECT 'customer_quote_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'customer_quote_items', 'uq_cqitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'customer_quote_items', 'uq_cqitems_line', 'customer_quote_version_id,line_number'
  UNION ALL SELECT 'customer_quote_adjustments', 'PRIMARY', 'id'
  UNION ALL SELECT 'customer_quote_adjustments', 'uq_cqadjustments_order', 'customer_quote_version_id,calculation_order'
  UNION ALL SELECT 'customer_quote_decisions', 'PRIMARY', 'id'
  UNION ALL SELECT 'purchase_orders', 'PRIMARY', 'id'
  UNION ALL SELECT 'purchase_orders', 'uq_purchase_orders_id_org', 'id,organization_id'
  UNION ALL SELECT 'purchase_orders', 'uq_purchaseorders_series_version', 'organization_id,series_public_id,version_number'
  UNION ALL SELECT 'purchase_orders', 'uq_purchaseorders_mod_use', 'modification_authorization_request_id'
  UNION ALL SELECT 'purchase_orders', 'uq_purchaseorders_series_owner', 'id,organization_id,series_public_id'
  UNION ALL SELECT 'purchase_order_modification_requests', 'PRIMARY', 'id'
  UNION ALL SELECT 'purchase_order_modification_requests', 'uq_purchase_order_modification_requests_id_org', 'id,organization_id'
  UNION ALL SELECT 'purchase_order_modification_requests', 'uq_pomodreq_folio', 'organization_id,folio'
  UNION ALL SELECT 'purchase_order_modification_requests', 'uq_pomodreq_generated', 'generated_purchase_order_id'
  UNION ALL SELECT 'purchase_order_modification_requests', 'uq_pomodreq_series_owner', 'id,organization_id,series_public_id'
  UNION ALL SELECT 'purchase_order_requisitions', 'PRIMARY', 'purchase_order_id,requisition_id'
  UNION ALL SELECT 'purchase_order_requisitions', 'uq_poreqs_scope', 'purchase_order_id,requisition_id,organization_id'
  UNION ALL SELECT 'purchase_order_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'purchase_order_items', 'uq_poitems_public', 'public_id'
  UNION ALL SELECT 'purchase_order_items', 'uq_poitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'purchase_order_items', 'uq_poitems_owner', 'id,organization_id,purchase_order_id'
  UNION ALL SELECT 'purchase_order_items', 'uq_poitems_line', 'purchase_order_id,line_number'
  UNION ALL SELECT 'purchase_order_line_sources', 'PRIMARY', 'id'
  UNION ALL SELECT 'purchase_order_line_sources', 'uq_polinesources_ordinal', 'purchase_order_item_id,source_ordinal'
  UNION ALL SELECT 'workflow_events', 'PRIMARY', 'id'
  UNION ALL SELECT 'workflow_events', 'uq_workflowevents_public', 'public_id'
  UNION ALL SELECT 'workflow_events', 'uq_workflowevents_legacy', 'entity_id,legacy_event_id'
  UNION ALL SELECT 'goods_receipts', 'PRIMARY', 'id'
  UNION ALL SELECT 'goods_receipts', 'uq_goods_receipts_id_org', 'id,organization_id'
  UNION ALL SELECT 'goods_receipts', 'uq_receipts_folio', 'organization_id,folio'
  UNION ALL SELECT 'goods_receipts', 'uq_receipts_po', 'id,organization_id,purchase_order_id'
  UNION ALL SELECT 'goods_receipt_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'goods_receipt_items', 'uq_receiptitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'goods_receipt_items', 'uq_receiptitems_line', 'goods_receipt_id,line_number'
  UNION ALL SELECT 'deliveries', 'PRIMARY', 'id'
  UNION ALL SELECT 'deliveries', 'uq_deliveries_id_org', 'id,organization_id'
  UNION ALL SELECT 'deliveries', 'uq_deliveries_folio', 'organization_id,folio'
  UNION ALL SELECT 'delivery_sources', 'PRIMARY', 'id'
  UNION ALL SELECT 'delivery_sources', 'uq_deliverysources_ordinal', 'delivery_id,source_ordinal'
  UNION ALL SELECT 'delivery_items', 'PRIMARY', 'id'
  UNION ALL SELECT 'delivery_items', 'uq_deliveryitems_id_org', 'id,organization_id'
  UNION ALL SELECT 'delivery_items', 'uq_deliveryitems_line', 'delivery_id,line_number'
  UNION ALL SELECT 'delivery_item_allocations', 'PRIMARY', 'id'
  UNION ALL SELECT 'delivery_item_allocations', 'uq_deliveryalloc_pair', 'delivery_item_id,goods_receipt_item_id'
  UNION ALL SELECT 'signature_evidence', 'PRIMARY', 'id'
  UNION ALL SELECT 'signature_evidence', 'uq_signatureevidence_id_org', 'id,organization_id'
  UNION ALL SELECT 'signature_evidence', 'uq_signatureevidence_entity_owner', 'id,organization_id,entity_id'
  UNION ALL SELECT 'invoices', 'PRIMARY', 'id'
  UNION ALL SELECT 'invoices', 'uq_invoices_id_org', 'id,organization_id'
  UNION ALL SELECT 'invoices', 'uq_invoices_folio', 'organization_id,folio'
  UNION ALL SELECT 'invoices', 'uq_invoices_number', 'organization_id,normalized_invoice_number'
  UNION ALL SELECT 'invoices', 'uq_invoices_client_owner', 'id,organization_id,client_id'
  UNION ALL SELECT 'invoice_purchase_orders', 'PRIMARY', 'invoice_id,purchase_order_id'
  UNION ALL SELECT 'invoice_acknowledgments', 'PRIMARY', 'id'
  UNION ALL SELECT 'invoice_acknowledgments', 'uq_invoiceacks_public', 'public_id'
  UNION ALL SELECT 'service_orders', 'PRIMARY', 'id'
  UNION ALL SELECT 'service_orders', 'uq_service_orders_id_org', 'id,organization_id'
  UNION ALL SELECT 'service_orders', 'uq_services_folio', 'organization_id,folio'
  UNION ALL SELECT 'audit_events', 'PRIMARY', 'id'
  UNION ALL SELECT 'audit_events', 'uq_auditevents_public', 'public_id'
  UNION ALL SELECT 'audit_events', 'uq_auditevents_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'notifications', 'PRIMARY', 'id'
  UNION ALL SELECT 'notifications', 'uq_notifications_public', 'public_id'
  UNION ALL SELECT 'notifications', 'uq_notifications_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'outbox_messages', 'PRIMARY', 'id'
  UNION ALL SELECT 'outbox_messages', 'uq_outbox_public', 'public_id'
  UNION ALL SELECT 'outbox_messages', 'uq_outbox_id_org', 'id,organization_id'
  UNION ALL SELECT 'outbox_messages', 'uq_outbox_dedupe', 'organization_id,event_deduplication_sha256'
  UNION ALL SELECT 'email_delivery_logs', 'PRIMARY', 'id'
  UNION ALL SELECT 'email_delivery_logs', 'uq_emaillogs_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'email_delivery_logs', 'uq_emaillogs_attempt', 'outbox_message_id,attempt_number'
  UNION ALL SELECT 'ai_runs', 'PRIMARY', 'id'
  UNION ALL SELECT 'ai_runs', 'uq_airuns_legacy', 'organization_id,legacy_id'
  UNION ALL SELECT 'document_sequences', 'PRIMARY', 'organization_id,document_kind,series_code,period_key'
  UNION ALL SELECT 'portal_access_tokens', 'PRIMARY', 'id'
  UNION ALL SELECT 'portal_access_tokens', 'uq_portaltokens_client_owner', 'id,organization_id,client_id'
  UNION ALL SELECT 'portal_access_tokens', 'uq_portaltokens_selector', 'token_selector'
  UNION ALL SELECT 'portal_access_tokens', 'uq_portaltokens_hash', 'token_hash'
  UNION ALL SELECT 'auth_sessions', 'PRIMARY', 'id'
  UNION ALL SELECT 'auth_sessions', 'uq_authsessions_public', 'public_id'
  UNION ALL SELECT 'auth_sessions', 'uq_authsessions_id_org', 'id,organization_id'
  UNION ALL SELECT 'auth_sessions', 'uq_authsessions_user_scope', 'id,organization_id,user_id'
  UNION ALL SELECT 'auth_sessions', 'uq_authsessions_client_scope', 'id,organization_id,client_id'
  UNION ALL SELECT 'auth_sessions', 'uq_authsessions_token', 'token_sha256'
  UNION ALL SELECT 'idempotency_keys', 'PRIMARY', 'id'
  UNION ALL SELECT 'idempotency_keys', 'uq_idempotency_key', 'organization_id,actor_user_id,endpoint_code,key_sha256'
  UNION ALL SELECT 'idempotency_keys', 'uq_idempotency_client', 'organization_id,actor_client_id,endpoint_code,key_sha256'
  UNION ALL SELECT 'import_batches', 'PRIMARY', 'id'
  UNION ALL SELECT 'import_batches', 'uq_importbatches_public', 'public_id'
  UNION ALL SELECT 'import_batches', 'uq_importbatches_source', 'source_system,source_sha256,mapping_version,importer_version,dry_run'
  UNION ALL SELECT 'import_records', 'PRIMARY', 'id'
  UNION ALL SELECT 'import_records', 'uq_importrecords_path', 'import_batch_id,source_json_path'
  UNION ALL SELECT 'import_records', 'uq_importrecords_batch', 'id,import_batch_id'
  UNION ALL SELECT 'import_records', 'uq_importrecords_collection', 'import_batch_id,root_collection,source_ordinal'
  UNION ALL SELECT 'import_issues', 'PRIMARY', 'id'
  UNION ALL SELECT 'legacy_id_map', 'PRIMARY', 'id'
  UNION ALL SELECT 'legacy_id_map', 'uq_legacymap_source', 'organization_id,source_system,source_collection,source_parent_legacy_id,source_legacy_id'
),
sf_actual AS (
 SELECT TABLE_NAME AS table_name,INDEX_NAME AS index_name,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS key_columns,
        SUM(SUB_PART IS NOT NULL) AS prefix_parts
 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND NON_UNIQUE=0
 GROUP BY TABLE_NAME,INDEX_NAME
), sf_diff AS (
 SELECT e.table_name,e.index_name,
        CONCAT('Esperado: ',e.key_columns,'; real: ',COALESCE(a.key_columns,'AUSENTE'),'; prefijos: ',COALESCE(a.prefix_parts,0)) AS detalle
 FROM sf_expected e LEFT JOIN sf_actual a ON BINARY a.table_name=BINARY e.table_name AND BINARY a.index_name=BINARY e.index_name
 WHERE a.index_name IS NULL OR BINARY a.key_columns<>BINARY e.key_columns OR a.prefix_parts<>0
 UNION ALL
 SELECT a.table_name,a.index_name,'PK/UNIQUE NO PREVISTO' FROM sf_actual a
 LEFT JOIN sf_expected e ON BINARY a.table_name=BINARY e.table_name AND BINARY a.index_name=BINARY e.index_name
 WHERE e.index_name IS NULL
)
SELECT '04_pk_unique' AS seccion,CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END AS estado,
       CAST((SELECT COUNT(*) FROM sf_expected) AS CHAR) AS tabla,
       CAST((SELECT COUNT(*) FROM sf_actual) AS CHAR) AS objeto,
       CONCAT(COUNT(*),' diferencias; esperados 74 PK + 149 UNIQUE') AS detalle FROM sf_diff
UNION ALL SELECT '04_pk_unique','FAIL',table_name,index_name,detalle FROM sf_diff;

-- 5. FK exactas: nombres, columnas en orden, tabla/columnas destino y reglas.
-- RESTRICT y NO ACTION se normalizan como equivalentes en InnoDB.
WITH sf_expected AS (
  SELECT 'people' AS table_name, 'fk_people_org' AS constraint_name, 'organization_id' AS child_columns, 'organizations' AS parent_table, 'id' AS parent_columns, 'RESTRICT' AS update_rule, 'RESTRICT' AS delete_rule
  UNION ALL SELECT 'users', 'fk_users_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'users', 'fk_users_person', 'person_id,organization_id', 'people', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'roles', 'fk_roles_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'role_permissions', 'fk_roleperm_role', 'role_id,organization_id', 'roles', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'role_permissions', 'fk_roleperm_permission', 'permission_id', 'permissions', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'user_roles', 'fk_userroles_user', 'user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'user_roles', 'fk_userroles_role', 'role_id,organization_id', 'roles', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'user_permissions', 'fk_userperm_user', 'user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'user_permissions', 'fk_userperm_permission', 'permission_id', 'permissions', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'user_permissions', 'fk_userperm_actor', 'granted_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'organization_settings', 'fk_settings_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'organization_settings', 'fk_settings_user', 'updated_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'units', 'fk_units_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'categories', 'fk_categories_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_types', 'fk_service_types_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'business_entities', 'fk_entities_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'business_entities', 'fk_entities_creator', 'created_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'business_entities', 'fk_entities_updater', 'updated_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'files', 'fk_files_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'files', 'fk_files_actor', 'created_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'entity_files', 'fk_entityfiles_entity', 'entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'entity_files', 'fk_entityfiles_file', 'file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'clients', 'fk_clients_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'suppliers', 'fk_suppliers_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'suppliers', 'fk_suppliers_category', 'category_id,organization_id', 'categories', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'suppliers', 'fk_suppliers_currency', 'default_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'party_contacts', 'fk_partycontacts_owner', 'owner_entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'party_contact_channels', 'fk_contactchannels_owner', 'owner_entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'party_contact_channels', 'fk_contactchannels_contact', 'contact_id,owner_entity_id,organization_id', 'party_contacts', 'id,owner_entity_id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_offerings', 'fk_offerings_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_offerings', 'fk_offerings_category', 'category_id,organization_id', 'categories', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_offerings', 'fk_offerings_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'projects', 'fk_projects_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'projects', 'fk_projects_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'contracts', 'fk_contracts_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'contracts', 'fk_contracts_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'contracts', 'fk_contracts_project', 'project_id,organization_id', 'projects', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'contracts', 'fk_contracts_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_project', 'project_id,organization_id', 'projects', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_contract', 'contract_id,organization_id', 'contracts', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_service_type', 'service_type_id,organization_id', 'service_types', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_reg_owner', 'regularization_owner_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_unit', 'unit_id,organization_id', 'units', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_category', 'category_id,organization_id', 'categories', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_source_req', 'source_requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_fixed_currency', 'fixed_client_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_reviews', 'fk_requisition_reviews_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_reviews', 'fk_reviews_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_reviews', 'fk_reviews_buyer', 'buyer_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_requests', 'fk_requisition_change_requests_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_requests', 'fk_reqchanges_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_requests', 'fk_reqchanges_evidence', 'evidence_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_revision_snapshots', 'fk_reqrevisions_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_revision_snapshots', 'fk_reqrevisions_change', 'created_by_change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_revision_snapshots', 'fk_reqrevisions_payload', 'canonical_payload_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_items', 'fk_reqchangeitems_change', 'change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_items', 'fk_reqchangeitems_item', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_plans', 'fk_sourcingplan_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_lots', 'fk_sourcinglots_plan', 'sourcing_plan_id,organization_id,requisition_id', 'sourcing_plans', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_lot_items', 'fk_lotitems_lot', 'sourcing_lot_id,organization_id,requisition_id', 'sourcing_lots', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_lot_items', 'fk_lotitems_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_lot_suppliers', 'fk_lotsuppliers_lot', 'sourcing_lot_id,organization_id', 'sourcing_lots', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'sourcing_lot_suppliers', 'fk_lotsuppliers_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_lot', 'sourcing_lot_id,organization_id,requisition_id', 'sourcing_lots', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_contact', 'internal_contact_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfqs', 'fk_rfqs_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfq_items', 'fk_rfqitems_rfq', 'rfq_id,organization_id,requisition_id', 'rfqs', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'rfq_items', 'fk_rfqitems_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quotes', 'fk_supplier_quotes_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quotes', 'fk_supplierquotes_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quotes', 'fk_supplierquotes_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quotes', 'fk_supplierquotes_rfq', 'rfq_id,organization_id,requisition_id', 'rfqs', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quotes', 'fk_supplierquotes_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quote_items', 'fk_sqitems_quote', 'supplier_quote_id,organization_id,requisition_id', 'supplier_quotes', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quote_items', 'fk_sqitems_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'supplier_quote_items', 'fk_sqitems_rfqitem', 'rfq_item_id,organization_id', 'rfq_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_quote', 'supplier_quote_id,organization_id,requisition_id', 'supplier_quotes', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_quoteitem', 'supplier_quote_item_id,organization_id,supplier_quote_id', 'supplier_quote_items', 'id,organization_id,supplier_quote_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'awards', 'fk_awards_change', 'change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quotes', 'fk_customer_quotes_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quotes', 'fk_customerquotes_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quotes', 'fk_customerquotes_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'approval_policy_versions', 'fk_policy_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'approval_policy_versions', 'fk_policy_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'approval_policy_versions', 'fk_policy_actor', 'created_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_customer_quote_versions_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_quote', 'customer_quote_id,organization_id,requisition_id', 'customer_quotes', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_change', 'change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_prepared', 'prepared_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_reviewed', 'reviewed_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_approved', 'approved_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_policy', 'approval_policy_version_id,organization_id', 'approval_policy_versions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_versions', 'fk_cqversions_supersedes', 'supersedes_version_id,organization_id,customer_quote_id', 'customer_quote_versions', 'id,organization_id,customer_quote_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_items', 'fk_cqitems_version', 'customer_quote_version_id,organization_id,requisition_id', 'customer_quote_versions', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_items', 'fk_cqitems_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_items', 'fk_cqitems_award', 'award_id,organization_id', 'awards', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_items', 'fk_cqitems_costcurrency', 'original_cost_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_items', 'fk_cqitems_fixedcurrency', 'fixed_client_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_adjustments', 'fk_cqadjustments_version', 'customer_quote_version_id,organization_id', 'customer_quote_versions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_version', 'customer_quote_version_id,organization_id', 'customer_quote_versions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_user', 'actor_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_client', 'actor_client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_file', 'evidence_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchase_orders_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_root', 'root_purchase_order_id,organization_id,series_public_id', 'purchase_orders', 'id,organization_id,series_public_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_supersedes', 'supersedes_purchase_order_id,organization_id,series_public_id', 'purchase_orders', 'id,organization_id,series_public_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_change', 'change_request_id,organization_id', 'requisition_change_requests', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_quote', 'primary_supplier_quote_id,organization_id', 'supplier_quotes', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_cqversion', 'source_customer_quote_version_id,organization_id', 'customer_quote_versions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_buyer', 'buyer_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_preparer', 'preparer_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_authorizer', 'authorizer_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_responsible', 'current_responsible_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_purchase_order_modification_requests_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_po', 'purchase_order_id,organization_id,series_public_id', 'purchase_orders', 'id,organization_id,series_public_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_requester', 'requested_by_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_approver', 'assigned_approver_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_decider', 'decided_by_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_consumer', 'consumed_by_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_modification_requests', 'fk_pomodreq_generated', 'generated_purchase_order_id,organization_id,series_public_id', 'purchase_orders', 'id,organization_id,series_public_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_requisitions', 'fk_poreqs_po', 'purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_requisitions', 'fk_poreqs_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_items', 'fk_poitems_po', 'purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_items', 'fk_poitems_previous', 'previous_purchase_order_item_id,organization_id', 'purchase_order_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_poitem', 'purchase_order_item_id,organization_id,purchase_order_id', 'purchase_order_items', 'id,organization_id,purchase_order_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_req', 'purchase_order_id,requisition_id,organization_id', 'purchase_order_requisitions', 'purchase_order_id,requisition_id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_quoteitem', 'supplier_quote_item_id,organization_id', 'supplier_quote_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_award', 'award_id,organization_id', 'awards', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_order_line_sources', 'fk_polinesources_lot', 'sourcing_lot_id,organization_id,requisition_id', 'sourcing_lots', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'workflow_events', 'fk_workflowevents_entity', 'entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'workflow_events', 'fk_workflowevents_actor', 'actor_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'workflow_events', 'fk_workflowevents_change', 'related_change_request_id,organization_id', 'requisition_change_requests', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'workflow_events', 'fk_workflowevents_target', 'target_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'goods_receipts', 'fk_goods_receipts_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'goods_receipts', 'fk_receipts_po', 'purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'goods_receipts', 'fk_receipts_origin_po', 'origin_purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'goods_receipt_items', 'fk_receiptitems_receipt', 'goods_receipt_id,organization_id,purchase_order_id', 'goods_receipts', 'id,organization_id,purchase_order_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'goods_receipt_items', 'fk_receiptitems_poitem', 'purchase_order_item_id,organization_id,purchase_order_id', 'purchase_order_items', 'id,organization_id,purchase_order_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'deliveries', 'fk_deliveries_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'deliveries', 'fk_deliveries_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_sources', 'fk_deliverysources_delivery', 'delivery_id,organization_id', 'deliveries', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_sources', 'fk_deliverysources_po', 'purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_sources', 'fk_deliverysources_req', 'purchase_order_id,requisition_id,organization_id', 'purchase_order_requisitions', 'purchase_order_id,requisition_id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_sources', 'fk_deliverysources_receipt', 'goods_receipt_id,organization_id,purchase_order_id', 'goods_receipts', 'id,organization_id,purchase_order_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_items', 'fk_deliveryitems_delivery', 'delivery_id,organization_id', 'deliveries', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_items', 'fk_deliveryitems_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_items', 'fk_deliveryitems_reqitem', 'requisition_item_id,organization_id,requisition_id', 'requisition_items', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_item_allocations', 'fk_deliveryalloc_deliveryitem', 'delivery_item_id,organization_id', 'delivery_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'delivery_item_allocations', 'fk_deliveryalloc_receiptitem', 'goods_receipt_item_id,organization_id', 'goods_receipt_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_entity', 'entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_file', 'signature_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_user', 'signer_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_client', 'signer_client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_canonical', 'canonical_payload_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_capturer', 'captured_by_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_certificate', 'certification_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_primary_po', 'primary_purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_receipt', 'goods_receipt_id,organization_id', 'goods_receipts', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_currency', 'currency_code', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoices', 'fk_invoices_document', 'document_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_purchase_orders', 'fk_invoicepos_invoice', 'invoice_id,organization_id', 'invoices', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_purchase_orders', 'fk_invoicepos_po', 'purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_acknowledgments', 'fk_invoiceacks_invoice', 'invoice_id,organization_id,client_id', 'invoices', 'id,organization_id,client_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_acknowledgments', 'fk_invoiceacks_document', 'document_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_acknowledgments', 'fk_invoiceacks_signature', 'signature_evidence_id,organization_id,invoice_id', 'signature_evidence', 'id,organization_id,entity_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_service_orders_entity', 'id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_type', 'service_type_id,organization_id', 'service_types', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_supplier', 'supplier_id,organization_id', 'suppliers', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_po', 'supplier_purchase_order_id,organization_id', 'purchase_orders', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_authorization_currency', 'authorization_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_commercial_currency', 'commercial_currency', 'currencies', 'code', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'service_orders', 'fk_services_responsible', 'responsible_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'audit_events', 'fk_auditevents_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'audit_events', 'fk_auditevents_entity', 'subject_entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'audit_events', 'fk_auditevents_user', 'subject_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'audit_events', 'fk_auditevents_actor', 'actor_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'notifications', 'fk_notifications_recipient', 'recipient_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'notifications', 'fk_notifications_sender', 'sender_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'notifications', 'fk_notifications_entity', 'entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'outbox_messages', 'fk_outbox_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'outbox_messages', 'fk_outbox_entity', 'entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'outbox_messages', 'fk_outbox_document', 'document_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'outbox_messages', 'fk_outbox_actor', 'actor_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'email_delivery_logs', 'fk_emaillogs_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'email_delivery_logs', 'fk_emaillogs_outbox', 'outbox_message_id,organization_id', 'outbox_messages', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'email_delivery_logs', 'fk_emaillogs_sender', 'sender_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'ai_runs', 'fk_airuns_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'ai_runs', 'fk_airuns_req', 'requisition_id,organization_id', 'requisitions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'document_sequences', 'fk_sequences_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'portal_access_tokens', 'fk_portaltokens_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'portal_access_tokens', 'fk_portaltokens_issuer', 'issued_by,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'auth_sessions', 'fk_authsessions_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'auth_sessions', 'fk_authsessions_user', 'user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'auth_sessions', 'fk_authsessions_client', 'client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'auth_sessions', 'fk_authsessions_portaltoken', 'portal_access_token_id,organization_id,client_id', 'portal_access_tokens', 'id,organization_id,client_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'idempotency_keys', 'fk_idempotency_client', 'actor_client_id,organization_id', 'clients', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'idempotency_keys', 'fk_idempotency_actor', 'actor_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'import_batches', 'fk_importbatches_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'import_records', 'fk_importrecords_batch', 'import_batch_id', 'import_batches', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'import_issues', 'fk_importissues_batch', 'import_batch_id', 'import_batches', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'import_issues', 'fk_importissues_record', 'import_record_id,import_batch_id', 'import_records', 'id,import_batch_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'import_issues', 'fk_importissues_actor', 'decided_by', 'users', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_org', 'organization_id', 'organizations', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_batch', 'import_batch_id', 'import_batches', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_entity', 'target_entity_id,organization_id', 'business_entities', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_user', 'target_user_id,organization_id', 'users', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_person', 'target_person_id,organization_id', 'people', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'legacy_id_map', 'fk_legacymap_reqitem', 'target_requisition_item_id,organization_id', 'requisition_items', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'people', 'fk_people_photo', 'photo_file_id,organization_id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'organizations', 'fk_organizations_logo', 'logo_file_id,id', 'files', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_import', 'import_record_id', 'import_records', 'id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'organizations', 'fk_org_primary_contact', 'primary_contact_person_id,id', 'people', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisitions', 'fk_requisitions_latest_change', 'latest_change_request_id,organization_id,id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_source_cq', 'source_customer_quote_version_id,organization_id', 'customer_quote_versions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_created_change', 'created_by_change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_items', 'fk_reqitems_cancelled_change', 'cancelled_by_change_request_id,organization_id,requisition_id', 'requisition_change_requests', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'requisition_change_requests', 'fk_reqchanges_result_quote', 'resulting_customer_quote_version_id,organization_id,requisition_id', 'customer_quote_versions', 'id,organization_id,requisition_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'purchase_orders', 'fk_purchaseorders_mod_authorization', 'modification_authorization_request_id,organization_id,series_public_id', 'purchase_order_modification_requests', 'id,organization_id,series_public_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_signer_session', 'signer_auth_session_id,organization_id', 'auth_sessions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_signer_session_user', 'signer_auth_session_id,organization_id,signer_user_id', 'auth_sessions', 'id,organization_id,user_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_signer_session_client', 'signer_auth_session_id,organization_id,signer_client_id', 'auth_sessions', 'id,organization_id,client_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'signature_evidence', 'fk_signatureevidence_capture_session', 'capture_auth_session_id,organization_id,captured_by_user_id', 'auth_sessions', 'id,organization_id,user_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_session', 'auth_session_id,organization_id', 'auth_sessions', 'id,organization_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_session_user', 'auth_session_id,organization_id,actor_user_id', 'auth_sessions', 'id,organization_id,user_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'customer_quote_decisions', 'fk_cqdecisions_session_client', 'auth_session_id,organization_id,actor_client_id', 'auth_sessions', 'id,organization_id,client_id', 'RESTRICT', 'RESTRICT'
  UNION ALL SELECT 'invoice_acknowledgments', 'fk_invoiceacks_session', 'auth_session_id,organization_id,client_id', 'auth_sessions', 'id,organization_id,client_id', 'RESTRICT', 'RESTRICT'
),
sf_actual AS (
 SELECT k.TABLE_NAME AS table_name,k.CONSTRAINT_NAME AS constraint_name,
        GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION SEPARATOR ',') AS child_columns,
        r.REFERENCED_TABLE_NAME AS parent_table,
        GROUP_CONCAT(k.REFERENCED_COLUMN_NAME ORDER BY k.ORDINAL_POSITION SEPARATOR ',') AS parent_columns,
        MIN(k.REFERENCED_TABLE_SCHEMA) AS parent_schema,
        CASE WHEN r.UPDATE_RULE IN ('NO ACTION','RESTRICT') THEN 'RESTRICT' ELSE r.UPDATE_RULE END AS update_rule,
        CASE WHEN r.DELETE_RULE IN ('NO ACTION','RESTRICT') THEN 'RESTRICT' ELSE r.DELETE_RULE END AS delete_rule
 FROM information_schema.KEY_COLUMN_USAGE k
 JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA
   AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
 WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
 GROUP BY k.TABLE_NAME,k.CONSTRAINT_NAME,r.REFERENCED_TABLE_NAME,r.UPDATE_RULE,r.DELETE_RULE
), sf_diff AS (
 SELECT e.table_name,e.constraint_name,
        CONCAT('Esperado (',e.child_columns,')->',e.parent_table,'(',e.parent_columns,'); real ',
               COALESCE(CONCAT('(',a.child_columns,')->',a.parent_table,'(',a.parent_columns,')'),'AUSENTE')) AS detalle
 FROM sf_expected e LEFT JOIN sf_actual a ON BINARY a.table_name=BINARY e.table_name AND BINARY a.constraint_name=BINARY e.constraint_name
 WHERE a.constraint_name IS NULL OR BINARY a.child_columns<>BINARY e.child_columns
    OR BINARY a.parent_table<>BINARY e.parent_table OR BINARY a.parent_columns<>BINARY e.parent_columns
    OR BINARY a.parent_schema<>BINARY DATABASE() OR a.update_rule<>e.update_rule OR a.delete_rule<>e.delete_rule
 UNION ALL
 SELECT a.table_name,a.constraint_name,'FK NO PREVISTA' FROM sf_actual a
 LEFT JOIN sf_expected e ON BINARY a.table_name=BINARY e.table_name AND BINARY a.constraint_name=BINARY e.constraint_name
 WHERE e.constraint_name IS NULL
)
SELECT '05_foreign_keys' AS seccion,CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END AS estado,
       CAST((SELECT COUNT(*) FROM sf_expected) AS CHAR) AS tabla,
       CAST((SELECT COUNT(*) FROM sf_actual) AS CHAR) AS objeto,
       CONCAT(COUNT(*),' diferencias; esperadas 246 FK') AS detalle FROM sf_diff
UNION ALL SELECT '05_foreign_keys','FAIL',table_name,constraint_name,detalle FROM sf_diff;

-- 6. CHECK de dominio. Normaliza sólo espacios, backticks y mayúsculas;
-- conserva paréntesis, operadores y valores. Una representación diferente
-- se informa para revisión, nunca se acepta quitando la agrupación lógica.
WITH sf_expected AS (
  SELECT 'users' AS table_name, 'ck_users_credential' AS constraint_name, 'credential_statein(''reset_required'',''local_validated'',''external'')' AS source_normalized, 'credential_statein(''reset_required'',''local_validated'',''external'')' AS runtime_normalized
  UNION ALL SELECT 'user_permissions', 'ck_userperm_effect', 'effectin(''allow'',''deny'')', 'effectin(''allow'',''deny'')'
  UNION ALL SELECT 'currencies', 'ck_currencies_scale', 'minor_units<=6', 'minor_units<=6'
  UNION ALL SELECT 'business_entities', 'ck_entities_kind', 'entity_kindin(''client'',''supplier'',''project'',''contract'',''requisition'',''review'',''rfq'',''supplier_quote'',''customer_quote'',''customer_quote_version'',''purchase_order'',''goods_receipt'',''delivery'',''service_order'',''requisition_change_request'',''purchase_order_modification_request'',''invoice'')', 'entity_kindin(''client'',''supplier'',''project'',''contract'',''requisition'',''review'',''rfq'',''supplier_quote'',''customer_quote'',''customer_quote_version'',''purchase_order'',''goods_receipt'',''delivery'',''service_order'',''requisition_change_request'',''purchase_order_modification_request'',''invoice'')'
  UNION ALL SELECT 'files', 'ck_files_scan', 'scan_statusin(''pending'',''clean'',''quarantined'',''legacy_unverified'')', 'scan_statusin(''pending'',''clean'',''quarantined'',''legacy_unverified'')'
  UNION ALL SELECT 'party_contact_channels', 'ck_contactchannels_type', 'channel_typein(''email'',''phone'',''other'')', 'channel_typein(''email'',''phone'',''other'')'
  UNION ALL SELECT 'requisitions', 'ck_requisitions_route', 'route_codein(''supply'',''service'',''legacy_unknown'')', 'route_codein(''supply'',''service'',''legacy_unknown'')'
  UNION ALL SELECT 'requisition_items', 'ck_reqitems_qty', 'quantity>0', 'quantity>0'
  UNION ALL SELECT 'requisition_items', 'ck_reqitems_status', 'line_statusin(''active'',''cancelled'')', 'line_statusin(''active'',''cancelled'')'
  UNION ALL SELECT 'requisition_change_requests', 'ck_reqchanges_revision', 'new_revision_number>previous_revision_number', 'new_revision_number>previous_revision_number'
  UNION ALL SELECT 'requisition_change_items', 'ck_reqchangeitems_target', 'target_kindin(''item'',''header'')', 'target_kindin(''item'',''header'')'
  UNION ALL SELECT 'requisition_change_items', 'ck_reqchangeitems_resolution', '(target_kind=''header''andrequisition_item_idisnullandfield_codeisnotnull)or(target_kind=''item''and(requisition_item_idisnotnullorresolution_status=''legacy_unresolved''))', 'target_kind=''header''andrequisition_item_idisnullandfield_codeisnotnullortarget_kind=''item''and(requisition_item_idisnotnullorresolution_status=''legacy_unresolved'')'
  UNION ALL SELECT 'sourcing_lot_suppliers', 'ck_lotsuppliers_role', 'selectedorsuggested', 'selected<>0orsuggested<>0'
  UNION ALL SELECT 'rfq_items', 'ck_rfqitems_qty', 'quantity>0', 'quantity>0'
  UNION ALL SELECT 'rfq_items', 'ck_rfqitems_resolution', '(resolution_status=''resolved''andrequisition_item_idisnotnull)orresolution_status=''legacy_unresolved''', 'resolution_status=''resolved''andrequisition_item_idisnotnullorresolution_status=''legacy_unresolved'''
  UNION ALL SELECT 'supplier_quote_items', 'ck_sqitems_qty', 'quantity>=0', 'quantity>=0'
  UNION ALL SELECT 'supplier_quote_items', 'ck_sqitems_resolution', '(resolution_status=''resolved''andrequisition_item_idisnotnull)orresolution_status=''legacy_unresolved''', 'resolution_status=''resolved''andrequisition_item_idisnotnullorresolution_status=''legacy_unresolved'''
  UNION ALL SELECT 'awards', 'ck_awards_qty', 'quantity>0', 'quantity>0'
  UNION ALL SELECT 'awards', 'ck_awards_source', 'source_kindin(''explicit'',''legacy_explicit'',''legacy_recovered'',''historical_reuse'')', 'source_kindin(''explicit'',''legacy_explicit'',''legacy_recovered'',''historical_reuse'')'
  UNION ALL SELECT 'approval_policy_versions', 'ck_policy_comparison', 'comparison_operatorin(''>'',''>='')', 'comparison_operatorin(''>'',''>='')'
  UNION ALL SELECT 'customer_quote_versions', 'ck_cqversions_discount_kind', 'discount_kindisnullordiscount_kindin(''amount'',''percentage'',''legacy_unknown'')', 'discount_kindisnullordiscount_kindin(''amount'',''percentage'',''legacy_unknown'')'
  UNION ALL SELECT 'customer_quote_versions', 'ck_cqversions_number', 'version_number>0', 'version_number>0'
  UNION ALL SELECT 'customer_quote_items', 'ck_cqitems_qty', 'quantity>0', 'quantity>0'
  UNION ALL SELECT 'customer_quote_items', 'ck_cqitems_resolution', '(resolution_status=''resolved''andrequisition_item_idisnotnull)orresolution_status=''legacy_unresolved''', 'resolution_status=''resolved''andrequisition_item_idisnotnullorresolution_status=''legacy_unresolved'''
  UNION ALL SELECT 'customer_quote_adjustments', 'ck_cqadjustments_kind', 'adjustment_kindin(''surcharge'',''discount'',''financing'',''shipping'',''other'')', 'adjustment_kindin(''surcharge'',''discount'',''financing'',''shipping'',''other'')'
  UNION ALL SELECT 'customer_quote_adjustments', 'ck_cqadjustments_method', 'method_codein(''fixed_amount'',''percentage'',''legacy_unknown'')', 'method_codein(''fixed_amount'',''percentage'',''legacy_unknown'')'
  UNION ALL SELECT 'customer_quote_adjustments', 'ck_cqadjustments_shape', 'method_code=''legacy_unknown''or(method_code=''fixed_amount''andamountisnotnull)or(method_code=''percentage''andrate_pctisnotnullandbasis_codeisnotnull)', 'method_code=''legacy_unknown''ormethod_code=''fixed_amount''andamountisnotnullormethod_code=''percentage''andrate_pctisnotnullandbasis_codeisnotnull'
  UNION ALL SELECT 'customer_quote_decisions', 'ck_cqdecisions_session_actor', 'auth_session_idisnullor((actor_user_idisnotnull)+(actor_client_idisnotnull)=1)', 'auth_session_idisnullor(actor_user_idisnotnull)+(actor_client_idisnotnull)=1'
  UNION ALL SELECT 'purchase_orders', 'ck_purchaseorders_version', 'version_number>0', 'version_number>0'
  UNION ALL SELECT 'purchase_order_items', 'ck_poitems_qty', '(line_status=''active''andquantity>0)or(line_status=''cancelled''andquantity=0)', 'line_status=''active''andquantity>0orline_status=''cancelled''andquantity=0'
  UNION ALL SELECT 'purchase_order_line_sources', 'ck_polinesources_lot_parent', 'sourcing_lot_idisnullorrequisition_idisnotnull', 'sourcing_lot_idisnullorrequisition_idisnotnull'
  UNION ALL SELECT 'purchase_order_line_sources', 'ck_polinesources_qty', 'allocated_quantity>0', 'allocated_quantity>0'
  UNION ALL SELECT 'purchase_order_line_sources', 'ck_polinesources_parent', 'requisition_item_idisnullorrequisition_idisnotnull', 'requisition_item_idisnullorrequisition_idisnotnull'
  UNION ALL SELECT 'purchase_order_line_sources', 'ck_polinesources_resolution', '(resolution_status=''resolved''andrequisition_idisnotnullandrequisition_item_idisnotnull)orresolution_status=''legacy_unresolved''', 'resolution_status=''resolved''andrequisition_idisnotnullandrequisition_item_idisnotnullorresolution_status=''legacy_unresolved'''
  UNION ALL SELECT 'goods_receipts', 'ck_receipts_grain', 'capture_grainin(''line_items'',''legacy_header_only'')', 'capture_grainin(''line_items'',''legacy_header_only'')'
  UNION ALL SELECT 'goods_receipt_items', 'ck_receiptitems_qty', 'received_quantity>=0andaccepted_quantity>=0andrejected_quantity>=0andaccepted_quantity+rejected_quantity<=received_quantity', 'received_quantity>=0andaccepted_quantity>=0andrejected_quantity>=0andaccepted_quantity+rejected_quantity<=received_quantity'
  UNION ALL SELECT 'goods_receipt_items', 'ck_receiptitems_provenance', 'provenancein(''captured'',''approved_reconstruction'')', 'provenancein(''captured'',''approved_reconstruction'')'
  UNION ALL SELECT 'delivery_items', 'ck_deliveryitems_qty', 'delivery_quantity>0', 'delivery_quantity>0'
  UNION ALL SELECT 'delivery_item_allocations', 'ck_deliveryalloc_qty', 'allocated_quantity>0', 'allocated_quantity>0'
  UNION ALL SELECT 'signature_evidence', 'ck_signatureevidence_session_actor', 'signer_auth_session_idisnullor((signer_user_idisnotnull)+(signer_client_idisnotnull)=1)', 'signer_auth_session_idisnullor(signer_user_idisnotnull)+(signer_client_idisnotnull)=1'
  UNION ALL SELECT 'signature_evidence', 'ck_signatureevidence_capture_actor', 'capture_auth_session_idisnullorcaptured_by_user_idisnotnull', 'capture_auth_session_idisnullorcaptured_by_user_idisnotnull'
  UNION ALL SELECT 'invoices', 'ck_invoices_revision', 'document_revision_number>0', 'document_revision_number>0'
  UNION ALL SELECT 'service_orders', 'ck_services_qty', 'quantity>0', 'quantity>0'
  UNION ALL SELECT 'document_sequences', 'ck_sequences_next', 'next_value>0', 'next_value>0'
  UNION ALL SELECT 'portal_access_tokens', 'ck_portaltokens_expiry', 'expires_at>created_at', 'expires_at>created_at'
  UNION ALL SELECT 'auth_sessions', 'ck_authsessions_principal', '(principal_kind=''internal_user''anduser_idisnotnullandclient_idisnullandportal_access_token_idisnull)or(principal_kind=''client_portal''andclient_idisnotnullanduser_idisnull)', 'principal_kind=''internal_user''anduser_idisnotnullandclient_idisnullandportal_access_token_idisnullorprincipal_kind=''client_portal''andclient_idisnotnullanduser_idisnull'
  UNION ALL SELECT 'auth_sessions', 'ck_authsessions_expiry', 'expires_at>created_at', 'expires_at>created_at'
  UNION ALL SELECT 'idempotency_keys', 'ck_idempotency_actor', '(actor_user_idisnotnull)+(actor_client_idisnotnull)=1', '(actor_user_idisnotnull)+(actor_client_idisnotnull)=1'
  UNION ALL SELECT 'legacy_id_map', 'ck_legacymap_target', '(target_entity_idisnotnull)+(target_user_idisnotnull)+(target_person_idisnotnull)+(target_requisition_item_idisnotnull)=1', '(target_entity_idisnotnull)+(target_user_idisnotnull)+(target_person_idisnotnull)+(target_requisition_item_idisnotnull)=1'
),
sf_actual AS (
 SELECT TABLE_NAME AS table_name,CONSTRAINT_NAME AS constraint_name,CHECK_CLAUSE AS actual_clause,
        LOWER(REGEXP_REPLACE(REPLACE(CHECK_CLAUSE,CHAR(96),''),'[[:space:]]+','')) AS normalized_clause
 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()
), sf_diff AS (
 SELECT e.table_name,e.constraint_name,
        CASE WHEN a.constraint_name IS NULL THEN 'FAIL_AUSENTE' ELSE 'REVISAR_CLAUSULA_DIFIERE' END AS problema,
        COALESCE(a.actual_clause,'AUSENTE') AS detalle
 FROM sf_expected e LEFT JOIN sf_actual a ON BINARY a.table_name=BINARY e.table_name AND BINARY a.constraint_name=BINARY e.constraint_name
 WHERE a.constraint_name IS NULL OR NOT (BINARY a.normalized_clause=BINARY e.source_normalized
       OR (e.runtime_normalized IS NOT NULL AND BINARY a.normalized_clause=BINARY e.runtime_normalized))
)
SELECT '06_checks_dominio' AS seccion,
       CASE WHEN COUNT(*)=0 THEN 'OK' WHEN SUM(problema='FAIL_AUSENTE')>0 THEN 'FAIL' ELSE 'REVISAR' END AS estado,
       CAST((SELECT COUNT(*) FROM sf_expected) AS CHAR) AS tabla,
       CAST((SELECT COUNT(*) FROM sf_actual a JOIN sf_expected e ON a.table_name=e.table_name AND a.constraint_name=e.constraint_name) AS CHAR) AS objeto,
       CONCAT(COUNT(*),' diferencias; esperados 49 CHECK explícitos') AS detalle FROM sf_diff
UNION ALL SELECT '06_checks_dominio',problema,table_name,constraint_name,detalle FROM sf_diff;

-- 7. JSON alias de MariaDB: LONGTEXT utf8mb4_bin y CHECK JSON_VALID exacto.
-- No basta encontrar la palabra JSON_VALID en una expresión que permita todo.
WITH sf_expected AS (
  SELECT 'organization_settings' AS table_name, 'settings_json' AS column_name
  UNION ALL SELECT 'requisitions', 'client_snapshot'
  UNION ALL SELECT 'requisitions', 'repeat_policy_snapshot'
  UNION ALL SELECT 'requisition_items', 'historical_price_snapshot'
  UNION ALL SELECT 'requisition_reviews', 'buyer_snapshot'
  UNION ALL SELECT 'requisition_revision_snapshots', 'snapshot_json'
  UNION ALL SELECT 'requisition_change_items', 'before_snapshot'
  UNION ALL SELECT 'requisition_change_items', 'after_snapshot'
  UNION ALL SELECT 'rfqs', 'contact_snapshot'
  UNION ALL SELECT 'supplier_quotes', 'history_source_snapshot'
  UNION ALL SELECT 'approval_policy_versions', 'rules_json'
  UNION ALL SELECT 'customer_quote_versions', 'history_source_snapshot'
  UNION ALL SELECT 'customer_quote_versions', 'people_snapshots'
  UNION ALL SELECT 'customer_quote_versions', 'client_snapshot'
  UNION ALL SELECT 'customer_quote_versions', 'approval_policy_snapshot'
  UNION ALL SELECT 'customer_quote_versions', 'approval_evaluation_snapshot'
  UNION ALL SELECT 'customer_quote_decisions', 'external_actor_snapshot'
  UNION ALL SELECT 'purchase_orders', 'amendment_snapshot'
  UNION ALL SELECT 'purchase_orders', 'people_snapshots'
  UNION ALL SELECT 'purchase_orders', 'supplier_snapshot'
  UNION ALL SELECT 'purchase_orders', 'bill_to_snapshot'
  UNION ALL SELECT 'purchase_orders', 'invoice_contact_snapshot'
  UNION ALL SELECT 'purchase_orders', 'automation_source_snapshot'
  UNION ALL SELECT 'purchase_order_modification_requests', 'requester_snapshot'
  UNION ALL SELECT 'purchase_order_modification_requests', 'approver_snapshot'
  UNION ALL SELECT 'purchase_order_modification_requests', 'decision_actor_snapshot'
  UNION ALL SELECT 'purchase_order_modification_requests', 'consumed_by_snapshot'
  UNION ALL SELECT 'purchase_order_line_sources', 'legacy_source_snapshot'
  UNION ALL SELECT 'workflow_events', 'actor_snapshot'
  UNION ALL SELECT 'workflow_events', 'payload_json'
  UNION ALL SELECT 'goods_receipts', 'legacy_delivery_snapshot'
  UNION ALL SELECT 'goods_receipts', 'amendment_reconciliation_snapshot'
  UNION ALL SELECT 'deliveries', 'client_snapshot'
  UNION ALL SELECT 'deliveries', 'delivered_by_snapshot'
  UNION ALL SELECT 'deliveries', 'received_by_snapshot'
  UNION ALL SELECT 'delivery_sources', 'folio_snapshots'
  UNION ALL SELECT 'delivery_items', 'legacy_po_folios'
  UNION ALL SELECT 'signature_evidence', 'capture_actor_snapshot'
  UNION ALL SELECT 'signature_evidence', 'signer_snapshot'
  UNION ALL SELECT 'signature_evidence', 'attachment_manifest_json'
  UNION ALL SELECT 'signature_evidence', 'legacy_evidence_metadata'
  UNION ALL SELECT 'invoice_acknowledgments', 'document_snapshot_json'
  UNION ALL SELECT 'service_orders', 'client_snapshot'
  UNION ALL SELECT 'service_orders', 'supplier_snapshot'
  UNION ALL SELECT 'service_orders', 'supplier_po_snapshot'
  UNION ALL SELECT 'service_orders', 'details_json'
  UNION ALL SELECT 'audit_events', 'actor_snapshot'
  UNION ALL SELECT 'audit_events', 'changes_json'
  UNION ALL SELECT 'audit_events', 'before_json'
  UNION ALL SELECT 'audit_events', 'after_json'
  UNION ALL SELECT 'outbox_messages', 'recipient_snapshot_json'
  UNION ALL SELECT 'outbox_messages', 'payload_json'
  UNION ALL SELECT 'email_delivery_logs', 'recipients_snapshot'
  UNION ALL SELECT 'email_delivery_logs', 'provider_response_json'
  UNION ALL SELECT 'portal_access_tokens', 'allowed_actions_json'
  UNION ALL SELECT 'auth_sessions', 'allowed_actions_json'
  UNION ALL SELECT 'idempotency_keys', 'response_json'
  UNION ALL SELECT 'import_batches', 'manifest_json'
  UNION ALL SELECT 'import_records', 'redacted_payload_json'
  UNION ALL SELECT 'import_records', 'redaction_manifest_json'
  UNION ALL SELECT 'import_issues', 'evidence_json'
  UNION ALL SELECT 'legacy_id_map', 'evidence_json'
),
sf_json_checks AS (
 SELECT TABLE_NAME AS table_name,CONSTRAINT_NAME AS constraint_name,
        LOWER(REGEXP_REPLACE(REPLACE(CHECK_CLAUSE,CHAR(96),''),'[[:space:]]+','')) AS normalized_clause
 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()
), sf_diff AS (
 SELECT e.table_name,e.column_name,
        CONCAT('Tipo=',COALESCE(c.DATA_TYPE,'AUSENTE'),'; collation=',COALESCE(c.COLLATION_NAME,'NULL'),
               '; JSON_VALID exactos=',(SELECT COUNT(*) FROM sf_json_checks j WHERE j.table_name=e.table_name
                    AND BINARY j.normalized_clause=BINARY CONCAT('json_valid(',e.column_name,')'))) AS detalle
 FROM sf_expected e LEFT JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=DATABASE()
   AND BINARY c.TABLE_NAME=BINARY e.table_name AND BINARY c.COLUMN_NAME=BINARY e.column_name
 WHERE c.COLUMN_NAME IS NULL OR c.DATA_TYPE<>'longtext' OR c.CHARACTER_SET_NAME<>'utf8mb4' OR c.COLLATION_NAME<>'utf8mb4_bin'
    OR (SELECT COUNT(*) FROM sf_json_checks j WHERE j.table_name=e.table_name
        AND BINARY j.normalized_clause=BINARY CONCAT('json_valid(',e.column_name,')'))<>1
)
SELECT '07_json' AS seccion,CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END AS estado,
       '62' AS tabla,'LONGTEXT+JSON_VALID' AS objeto,CONCAT(COUNT(*),' diferencias') AS detalle FROM sf_diff
UNION ALL SELECT '07_json','FAIL',table_name,column_name,detalle FROM sf_diff;

-- 8. Total de restricciones: los 62 JSON_VALID son adicionales a 49 de dominio.
WITH sf_expected AS (
 SELECT 'PRIMARY KEY' AS tipo,74 AS cantidad
 UNION ALL SELECT 'UNIQUE',149 UNION ALL SELECT 'FOREIGN KEY',246 UNION ALL SELECT 'CHECK',111
), sf_actual AS (
 SELECT CONSTRAINT_TYPE AS tipo,COUNT(*) AS cantidad FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() GROUP BY CONSTRAINT_TYPE
)
SELECT '08_totales_restricciones' AS seccion,e.tipo,e.cantidad AS esperadas,COALESCE(a.cantidad,0) AS encontradas,
       CASE WHEN e.cantidad=COALESCE(a.cantidad,0) THEN 'OK' ELSE 'FAIL' END AS estado
FROM sf_expected e LEFT JOIN sf_actual a ON a.tipo=e.tipo ORDER BY e.tipo;

-- 9. Defaults sensibles visibles, sin leer usuarios/credenciales reales.
-- Valores esperados: users.access_enabled=0; credential_state=reset_required;
-- files.scan_status=pending. No es una comprobación de todos los DEFAULT.
SELECT '09_defaults_sensibles' AS seccion,TABLE_NAME,COLUMN_NAME,COLUMN_DEFAULT,
       CASE WHEN TABLE_NAME='users' AND COLUMN_NAME='access_enabled'
                 AND LOWER(REPLACE(COALESCE(COLUMN_DEFAULT,''),CHAR(39),'')) IN ('0','false') THEN 'OK'
            WHEN TABLE_NAME='users' AND COLUMN_NAME='credential_state'
                 AND REPLACE(COALESCE(COLUMN_DEFAULT,''),CHAR(39),'')='reset_required' THEN 'OK'
            WHEN TABLE_NAME='files' AND COLUMN_NAME='scan_status'
                 AND REPLACE(COALESCE(COLUMN_DEFAULT,''),CHAR(39),'')='pending' THEN 'OK'
            ELSE 'FAIL' END AS estado
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND ((TABLE_NAME='users' AND COLUMN_NAME IN ('access_enabled','credential_state'))
      OR (TABLE_NAME='files' AND COLUMN_NAME='scan_status')) ORDER BY TABLE_NAME,COLUMN_NAME;

-- 10. El DDL no crea rutinas, vistas, triggers ni eventos. No son esperados.
SELECT '10_objetos_auxiliares' AS seccion,
       (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()) AS rutinas_debe_0,
       (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()) AS triggers_debe_0,
       (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()) AS eventos_debe_0;

-- 11. CONTEO EXACTO: ejecutar sólo tras inventario sin diferencias.
-- Si faltó una tabla, este último bloque devuelve error (no ocultarlo).
-- Toda tabla debe tener 0 filas: este paquete es sólo estructura, sin semillas.
-- No sustituir por TABLE_ROWS de INFORMATION_SCHEMA: es aproximado en InnoDB.
SELECT '11_filas_exactas' AS seccion,table_name,filas,
       CASE WHEN filas=0 THEN 'OK' ELSE 'REVISAR_BD_CONTIENE_DATOS' END AS estado
FROM (
  SELECT 'organizations' AS table_name, COUNT(*) AS filas FROM `organizations`
  UNION ALL SELECT 'people', COUNT(*) FROM `people`
  UNION ALL SELECT 'users', COUNT(*) FROM `users`
  UNION ALL SELECT 'roles', COUNT(*) FROM `roles`
  UNION ALL SELECT 'permissions', COUNT(*) FROM `permissions`
  UNION ALL SELECT 'role_permissions', COUNT(*) FROM `role_permissions`
  UNION ALL SELECT 'user_roles', COUNT(*) FROM `user_roles`
  UNION ALL SELECT 'user_permissions', COUNT(*) FROM `user_permissions`
  UNION ALL SELECT 'organization_settings', COUNT(*) FROM `organization_settings`
  UNION ALL SELECT 'currencies', COUNT(*) FROM `currencies`
  UNION ALL SELECT 'units', COUNT(*) FROM `units`
  UNION ALL SELECT 'categories', COUNT(*) FROM `categories`
  UNION ALL SELECT 'service_types', COUNT(*) FROM `service_types`
  UNION ALL SELECT 'business_entities', COUNT(*) FROM `business_entities`
  UNION ALL SELECT 'files', COUNT(*) FROM `files`
  UNION ALL SELECT 'entity_files', COUNT(*) FROM `entity_files`
  UNION ALL SELECT 'clients', COUNT(*) FROM `clients`
  UNION ALL SELECT 'suppliers', COUNT(*) FROM `suppliers`
  UNION ALL SELECT 'party_contacts', COUNT(*) FROM `party_contacts`
  UNION ALL SELECT 'party_contact_channels', COUNT(*) FROM `party_contact_channels`
  UNION ALL SELECT 'supplier_offerings', COUNT(*) FROM `supplier_offerings`
  UNION ALL SELECT 'projects', COUNT(*) FROM `projects`
  UNION ALL SELECT 'contracts', COUNT(*) FROM `contracts`
  UNION ALL SELECT 'requisitions', COUNT(*) FROM `requisitions`
  UNION ALL SELECT 'requisition_items', COUNT(*) FROM `requisition_items`
  UNION ALL SELECT 'requisition_reviews', COUNT(*) FROM `requisition_reviews`
  UNION ALL SELECT 'requisition_change_requests', COUNT(*) FROM `requisition_change_requests`
  UNION ALL SELECT 'requisition_revision_snapshots', COUNT(*) FROM `requisition_revision_snapshots`
  UNION ALL SELECT 'requisition_change_items', COUNT(*) FROM `requisition_change_items`
  UNION ALL SELECT 'sourcing_plans', COUNT(*) FROM `sourcing_plans`
  UNION ALL SELECT 'sourcing_lots', COUNT(*) FROM `sourcing_lots`
  UNION ALL SELECT 'sourcing_lot_items', COUNT(*) FROM `sourcing_lot_items`
  UNION ALL SELECT 'sourcing_lot_suppliers', COUNT(*) FROM `sourcing_lot_suppliers`
  UNION ALL SELECT 'rfqs', COUNT(*) FROM `rfqs`
  UNION ALL SELECT 'rfq_items', COUNT(*) FROM `rfq_items`
  UNION ALL SELECT 'supplier_quotes', COUNT(*) FROM `supplier_quotes`
  UNION ALL SELECT 'supplier_quote_items', COUNT(*) FROM `supplier_quote_items`
  UNION ALL SELECT 'awards', COUNT(*) FROM `awards`
  UNION ALL SELECT 'customer_quotes', COUNT(*) FROM `customer_quotes`
  UNION ALL SELECT 'approval_policy_versions', COUNT(*) FROM `approval_policy_versions`
  UNION ALL SELECT 'customer_quote_versions', COUNT(*) FROM `customer_quote_versions`
  UNION ALL SELECT 'customer_quote_items', COUNT(*) FROM `customer_quote_items`
  UNION ALL SELECT 'customer_quote_adjustments', COUNT(*) FROM `customer_quote_adjustments`
  UNION ALL SELECT 'customer_quote_decisions', COUNT(*) FROM `customer_quote_decisions`
  UNION ALL SELECT 'purchase_orders', COUNT(*) FROM `purchase_orders`
  UNION ALL SELECT 'purchase_order_modification_requests', COUNT(*) FROM `purchase_order_modification_requests`
  UNION ALL SELECT 'purchase_order_requisitions', COUNT(*) FROM `purchase_order_requisitions`
  UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM `purchase_order_items`
  UNION ALL SELECT 'purchase_order_line_sources', COUNT(*) FROM `purchase_order_line_sources`
  UNION ALL SELECT 'workflow_events', COUNT(*) FROM `workflow_events`
  UNION ALL SELECT 'goods_receipts', COUNT(*) FROM `goods_receipts`
  UNION ALL SELECT 'goods_receipt_items', COUNT(*) FROM `goods_receipt_items`
  UNION ALL SELECT 'deliveries', COUNT(*) FROM `deliveries`
  UNION ALL SELECT 'delivery_sources', COUNT(*) FROM `delivery_sources`
  UNION ALL SELECT 'delivery_items', COUNT(*) FROM `delivery_items`
  UNION ALL SELECT 'delivery_item_allocations', COUNT(*) FROM `delivery_item_allocations`
  UNION ALL SELECT 'signature_evidence', COUNT(*) FROM `signature_evidence`
  UNION ALL SELECT 'invoices', COUNT(*) FROM `invoices`
  UNION ALL SELECT 'invoice_purchase_orders', COUNT(*) FROM `invoice_purchase_orders`
  UNION ALL SELECT 'invoice_acknowledgments', COUNT(*) FROM `invoice_acknowledgments`
  UNION ALL SELECT 'service_orders', COUNT(*) FROM `service_orders`
  UNION ALL SELECT 'audit_events', COUNT(*) FROM `audit_events`
  UNION ALL SELECT 'notifications', COUNT(*) FROM `notifications`
  UNION ALL SELECT 'outbox_messages', COUNT(*) FROM `outbox_messages`
  UNION ALL SELECT 'email_delivery_logs', COUNT(*) FROM `email_delivery_logs`
  UNION ALL SELECT 'ai_runs', COUNT(*) FROM `ai_runs`
  UNION ALL SELECT 'document_sequences', COUNT(*) FROM `document_sequences`
  UNION ALL SELECT 'portal_access_tokens', COUNT(*) FROM `portal_access_tokens`
  UNION ALL SELECT 'auth_sessions', COUNT(*) FROM `auth_sessions`
  UNION ALL SELECT 'idempotency_keys', COUNT(*) FROM `idempotency_keys`
  UNION ALL SELECT 'import_batches', COUNT(*) FROM `import_batches`
  UNION ALL SELECT 'import_records', COUNT(*) FROM `import_records`
  UNION ALL SELECT 'import_issues', COUNT(*) FROM `import_issues`
  UNION ALL SELECT 'legacy_id_map', COUNT(*) FROM `legacy_id_map`
) AS sf_counts ORDER BY table_name;

-- Fin. Todos los bloques deben estar completos. Un SELECT que falló no es PASS.
-- Una sesión con FK/CHECK=1 no demuestra que nunca se desactivaron antes.
-- Si hubo carga previa, hace falta una auditoría de datos adicional; este
-- diagnóstico está diseñado para el esquema vacío recién instalado.

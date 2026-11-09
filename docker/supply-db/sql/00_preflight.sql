-- SUPPLYFLOW v0.3 | 00 PRECHECK DE ENTORNO
-- Objetivo: MariaDB 11.8.9, base de ENSAYO seleccionada en phpMyAdmin.
-- DDL SHA-256: 2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5
-- SOLO LECTURA: SELECT/CTE/SHOW; sin SET, DDL, DML, GRANTS, procedimientos
-- ni lectura de filas de negocio. El conteo final del postflight sólo da números.
-- Elegir la base en la interfaz ANTES de ejecutar. Este archivo no usa USE.
-- FAIL: detener. REVISAR: resolver condición antes de dar el ensayo por válido.
-- Resultados son metadatos de esta sesión; no configuran futuras conexiones.
-- No prueban permisos de escritura, autorización de usuarios o reglas de API.

-- 1. Versión y base elegida. No imprime usuario, contraseña, host ni GRANTS.
SELECT '01_entorno' AS seccion, VERSION() AS version_real,
       @@version_comment AS distribucion, DATABASE() AS base_seleccionada,
       CASE WHEN LOWER(VERSION()) LIKE '%mariadb%'
                  AND SUBSTRING_INDEX(VERSION(), '-', 1) = '11.8.9'
            THEN 'OK' ELSE 'REVISAR_VERSION_NO_ES_OBJETIVO' END AS estado_version,
       CASE WHEN DATABASE() IS NULL OR DATABASE() IN
                  ('mysql','information_schema','performance_schema','sys')
            THEN 'FAIL_BASE_NO_APTA' ELSE 'OK' END AS estado_base;

-- 2. Base vacía: cuenta objetos VISIBLES, no usa TABLE_ROWS aproximado.
-- La cuenta necesita visibilidad del esquema; no se demuestra CREATE/ALTER aquí.
SELECT '02_base_vacia' AS seccion, DATABASE() AS base_seleccionada,
       n.tablas_y_vistas, n.rutinas, n.triggers, n.eventos,
       CASE WHEN DATABASE() IS NULL THEN 'FAIL_SIN_BASE'
            WHEN n.tablas_y_vistas+n.rutinas+n.triggers+n.eventos=0 THEN 'OK'
            ELSE 'FAIL_BASE_NO_VACIA' END AS estado
FROM (
  SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()) AS tablas_y_vistas,
         (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()) AS rutinas,
         (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()) AS triggers,
         (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()) AS eventos
) AS n;

-- 3. Charset/collation de DB y sesión. El default de DB no sustituye al DDL explícito.
SELECT '03_charset' AS seccion,
       @@SESSION.character_set_client AS charset_cliente,
       @@SESSION.character_set_connection AS charset_conexion,
       @@SESSION.character_set_results AS charset_resultados,
       @@SESSION.collation_connection AS collation_conexion,
       @@GLOBAL.character_set_server AS charset_servidor,
       @@GLOBAL.collation_server AS collation_servidor,
       s.DEFAULT_CHARACTER_SET_NAME AS charset_base,
       s.DEFAULT_COLLATION_NAME AS collation_base
FROM (SELECT DATABASE() AS esquema) AS e
LEFT JOIN information_schema.SCHEMATA AS s ON s.SCHEMA_NAME=e.esquema;

-- 4. Modos SESSION/GLOBAL y checks. No se cambian variables.
SELECT '04_modos' AS seccion, @@SESSION.sql_mode AS sql_mode_sesion,
       @@GLOBAL.sql_mode AS sql_mode_global,
       @@SESSION.foreign_key_checks AS fk_sesion, @@GLOBAL.foreign_key_checks AS fk_global,
       @@SESSION.check_constraint_checks AS check_sesion, @@GLOBAL.check_constraint_checks AS check_global,
       @@SESSION.unique_checks AS unique_sesion, @@GLOBAL.unique_checks AS unique_global,
       @@SESSION.innodb_strict_mode AS innodb_strict_sesion, @@GLOBAL.innodb_strict_mode AS innodb_strict_global,
       @@SESSION.time_zone AS zona_sesion, @@GLOBAL.time_zone AS zona_global,
       @@GLOBAL.innodb_page_size AS innodb_page_bytes,
       @@GLOBAL.innodb_default_row_format AS row_format_default,
       @@SESSION.max_allowed_packet AS max_allowed_packet_sesion,
       @@SESSION.group_concat_max_len AS group_concat_max_len,
       @@GLOBAL.lower_case_table_names AS lower_case_table_names,
       @@GLOBAL.read_only AS servidor_read_only;

SELECT '05_precondiciones' AS seccion,
       CASE WHEN @@SESSION.foreign_key_checks=1
                  AND @@SESSION.check_constraint_checks=1 AND @@SESSION.unique_checks=1
            THEN 'OK' ELSE 'REVISAR_CHECKS_DE_SESION_APAGADOS' END AS checks_actuales,
       CASE WHEN @@GLOBAL.foreign_key_checks=1
                  AND @@GLOBAL.check_constraint_checks=1 AND @@GLOBAL.unique_checks=1
            THEN 'OK' ELSE 'REVISAR_DEFAULTS_GLOBAL_NO_SE_MODIFICAN' END AS checks_globales,
       CASE WHEN FIND_IN_SET('STRICT_TRANS_TABLES',@@SESSION.sql_mode)>0
                  OR FIND_IN_SET('STRICT_ALL_TABLES',@@SESSION.sql_mode)>0
            THEN 'OK' ELSE 'REVISAR_FALTA_MODO_ESTRICTO_EN_SESION' END AS modo_estricto,
       CASE WHEN @@GLOBAL.innodb_page_size>=16384 THEN 'OK'
            ELSE 'FAIL_PAGINA_NO_ADMITE_INDICES_DEL_DDL' END AS pagina_innodb,
       CASE WHEN @@GLOBAL.read_only=0 THEN 'OK'
            ELSE 'REVISAR_SERVIDOR_SOLO_LECTURA' END AS escritura_servidor;
-- El DDL fija siete parámetros de sesión, pero el backend debe repetirlos
-- en CADA conexión. No asumir que una conexión nueva hereda los SET del import.
-- El índice uq_importrecords_path puede ocupar 2056 bytes: páginas 4/8 KiB
-- no bastan para este DDL sin rediseño. No cambiar GLOBAL en hosting compartido.

-- 6. InnoDB debe estar disponible y transaccional.
SELECT '06_innodb' AS seccion, e.ENGINE, e.SUPPORT, e.TRANSACTIONS, e.SAVEPOINTS,
       CASE WHEN e.SUPPORT IN ('YES','DEFAULT') AND e.TRANSACTIONS='YES'
            THEN 'OK' ELSE 'FAIL_INNODB_NO_DISPONIBLE' END AS estado
FROM (SELECT 'InnoDB' AS engine_name) AS p
LEFT JOIN information_schema.ENGINES AS e ON e.ENGINE=p.engine_name;

-- 7. UCA1400 puede aparecer sin prefijo en COLLATIONS. En MariaDB 11.8
-- se compara FULL_COLLATION_NAME de COLLATION_CHARACTER_SET_APPLICABILITY.
WITH esperadas AS (
  SELECT 'utf8mb4_uca1400_nopad_ai_ci' AS collation_name, 'utf8mb4' AS charset_name
  UNION ALL SELECT 'utf8mb4_nopad_bin','utf8mb4'
  UNION ALL SELECT 'ascii_bin','ascii'
  UNION ALL SELECT 'utf8mb4_bin','utf8mb4'
)
SELECT '07_collations' AS seccion, e.collation_name AS solicitada,
       a.FULL_COLLATION_NAME AS disponible, a.CHARACTER_SET_NAME AS charset_name,
       CASE WHEN a.FULL_COLLATION_NAME IS NULL THEN 'FAIL_COLLATION_AUSENTE'
            ELSE 'OK' END AS estado
FROM esperadas AS e
LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY AS a
  ON a.FULL_COLLATION_NAME=e.collation_name AND a.CHARACTER_SET_NAME=e.charset_name
ORDER BY e.collation_name;

-- 8. Prueba de comparación con literales sin datos privados. Si falta una
-- collation, este SELECT fallará: no continuar a instalar hasta resolverlo.
SELECT '08_semantica_collations' AS seccion,
       (_utf8mb4'A' COLLATE utf8mb4_nopad_bin = _utf8mb4'a' COLLATE utf8mb4_nopad_bin) AS bin_mayusculas_debe_0,
       (_utf8mb4'x' COLLATE utf8mb4_nopad_bin = _utf8mb4'x ' COLLATE utf8mb4_nopad_bin) AS bin_espacio_final_debe_0,
       (_utf8mb4'A' COLLATE utf8mb4_uca1400_nopad_ai_ci = _utf8mb4'a' COLLATE utf8mb4_uca1400_nopad_ai_ci) AS texto_mayusculas_debe_1,
       (_utf8mb4'x' COLLATE utf8mb4_uca1400_nopad_ai_ci = _utf8mb4'x ' COLLATE utf8mb4_uca1400_nopad_ai_ci) AS texto_espacio_final_debe_0,
       (_ascii'A' COLLATE ascii_bin = _ascii'a' COLLATE ascii_bin) AS ascii_mayusculas_debe_0;

-- Fin. La versión y el plan de hosting por sí solos no acreditan permisos
-- CREATE/ALTER ni que la BD esté aislada de WordPress/otro sistema.

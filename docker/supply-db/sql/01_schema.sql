-- SUPPLYFLOW v0.3 | DDL PARA MARIADB 11.8.9 | HOSTINGER PREMIUM
-- Adaptación técnica del modelo v0.2; las reglas de negocio se conservan.
-- Fuente v0.2 SHA-256: 90a3a7e4329fccf14bda92221ee7ff16984fe85c372acc133404d5733847cb91
-- PRECONDICIÓN: seleccionar una base VACÍA destinada a SupplyFlow y completar
-- el diagnóstico de versión, collations, InnoDB y privilegios antes de importar.
-- Sin CREATE DATABASE, USE, cuentas, DROP ni INSERT. No es una migración de
-- una instalación existente ni instala el backend PHP/CodeIgniter 4/Shield.
-- No se desactivan FK/CHECK; no se cambia configuración GLOBAL del servidor.
-- Las sentencias DDL pueden confirmar implícitamente: el archivo completo NO
-- es una transacción reversible. Ante un error, detener y revisar el reporte;
-- no volver a importar sobre un esquema parcialmente creado.
-- El resultado del ensayo local y su versión/hash figuran en el reporte adjunto;
-- dicho ensayo no implica instalación ni prueba en producción de Hostinger.
-- El bootstrap de CADA conexión del backend/migrador debe fijar estos mismos
-- parámetros de sesión; ejecutarlos aquí no configura conexiones futuras.
-- DATETIME representa UTC por contrato; DATE conserva la fecha de negocio.
-- La zona de negocio sigue siendo un parámetro funcional por confirmar.
-- MariaDB JSON es LONGTEXT validado automáticamente con JSON_VALID; estos
-- CHECK implícitos se suman a los 49 CHECK de dominio escritos en este archivo.
-- Los JSON snapshots no sustituyen los bytes canónicos exactos de las firmas.
-- Los importes/cantidades DECIMAL se transmiten como cadenas en la API.
-- El modo estricto no rechaza necesariamente una escala decimal excesiva:
-- validar precisión/escala en el backend y el migrador antes de insertar.
-- ID público UUID generado por el backend; PK interno BIGINT. IDs legados y
-- claves ASCII conservan ascii_bin. No se convierten IDs de origen en UUID.
-- Collations nativas explícitas: texto UCA1400 NO PAD; identificadores Unicode
-- utf8mb4_nopad_bin. No depender de alias de collations MySQL ni del default
-- utf8mb4_unicode_ci que muestra la cuenta existente.
-- InnoDB ROW_FORMAT=DYNAMIC explícito; revisar innodb_page_size en diagnóstico.
-- Archivos privados fuera de la BD. files guarda claves/metadatos, nunca base64.
-- import_records lleva payload redactado; original privado cifrado/inmutable.
-- auth_sessions expresa el contrato funcional; su integración CI4/Shield queda
-- pendiente y no debe duplicar credenciales/identidades en implementaciones.
-- business_entities y el subtipo se crean juntos; el servicio valida entity_kind.
-- Una versión emitida/firmada se preserva; los cambios crean nueva versión.
-- La segregación de funciones, estados, autorización, cantidades acumuladas y
-- consumo de MOD-OC se validan transaccionalmente en backend, además de las FKs.
-- No se agrega tabla schema_version: metadata de entrega/migraciones separada.

SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_nopad_ai_ci;
SET SESSION time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION,NO_ZERO_DATE,NO_ZERO_IN_DATE';
SET SESSION foreign_key_checks = 1;
SET SESSION check_constraint_checks = 1;
SET SESSION unique_checks = 1;
SET SESSION innodb_strict_mode = 1;

-- Tablas del modelo: 74. No incluye tablas de infraestructura del framework.

CREATE TABLE organizations (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_namespace VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legal_name VARCHAR(255) NOT NULL,
  tax_identifier VARCHAR(64) NULL,
  phone VARCHAR(80) NULL,
  email VARCHAR(254) NULL,
  postal_address TEXT NULL,
  business_timezone VARCHAR(64) NULL,
  primary_contact_person_id BIGINT UNSIGNED NULL,
  status_code VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_public (public_id),
  UNIQUE KEY uq_organizations_legacy (legacy_namespace, legacy_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE people (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(80) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_people_public (public_id),
  UNIQUE KEY uq_people_id_org (id, organization_id),
  KEY ix_people_org_name (organization_id, display_name),
  CONSTRAINT fk_people_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE users (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  person_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_namespace VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  login_email VARCHAR(254) NOT NULL,
  normalized_login_email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  credential_state VARCHAR(32) NOT NULL DEFAULT 'reset_required',
  external_issuer VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NULL,
  external_subject VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NULL,
  status_code VARCHAR(24) NOT NULL DEFAULT 'active',
  access_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_public (public_id),
  UNIQUE KEY uq_users_id_org (id, organization_id),
  UNIQUE KEY uq_users_person (organization_id, person_id),
  UNIQUE KEY uq_users_login (organization_id, normalized_login_email),
  UNIQUE KEY uq_users_legacy (organization_id, legacy_namespace, legacy_id),
  UNIQUE KEY uq_users_external (organization_id, external_issuer, external_subject),
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_person FOREIGN KEY (person_id, organization_id) REFERENCES people(id, organization_id),
  CONSTRAINT ck_users_credential CHECK (credential_state IN ('reset_required','local_validated','external'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE roles (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_id_org (id, organization_id),
  UNIQUE KEY uq_roles_code (organization_id, code),
  UNIQUE KEY uq_roles_legacy (organization_id, legacy_id),
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE permissions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  description VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE role_permissions (
organization_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_roleperm_role FOREIGN KEY (role_id, organization_id) REFERENCES roles(id, organization_id),
  CONSTRAINT fk_roleperm_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE user_roles (
organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_userroles_user FOREIGN KEY (user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_userroles_role FOREIGN KEY (role_id, organization_id) REFERENCES roles(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE user_permissions (
organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  effect VARCHAR(8) NOT NULL,
  reason VARCHAR(500) NULL,
  granted_by BIGINT UNSIGNED NULL,
  granted_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_userperm_user FOREIGN KEY (user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_userperm_permission FOREIGN KEY (permission_id) REFERENCES permissions(id),
  CONSTRAINT fk_userperm_actor FOREIGN KEY (granted_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_userperm_effect CHECK (effect IN ('allow','deny'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE organization_settings (
organization_id BIGINT UNSIGNED NOT NULL,
  settings_group VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL,
  settings_json JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (organization_id, settings_group),
  CONSTRAINT fk_settings_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE currencies (
code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(128) NOT NULL,
  minor_units TINYINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (code),
  CONSTRAINT ck_currencies_scale CHECK (minor_units <= 6)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE units (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_id_org (id, organization_id),
  UNIQUE KEY uq_units_code (organization_id, code),
  UNIQUE KEY uq_units_legacy (organization_id, legacy_id),
  CONSTRAINT fk_units_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE categories (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_id_org (id, organization_id),
  UNIQUE KEY uq_categories_code (organization_id, code),
  UNIQUE KEY uq_categories_legacy (organization_id, legacy_id),
  CONSTRAINT fk_categories_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE service_types (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(255) NOT NULL,
  detail_schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_types_id_org (id, organization_id),
  UNIQUE KEY uq_service_types_code (organization_id, code),
  UNIQUE KEY uq_service_types_legacy (organization_id, legacy_id),
  CONSTRAINT fk_service_types_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE business_entities (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entity_kind VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_namespace VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(6) NULL,
  updated_at DATETIME(6) NULL,
  imported_at DATETIME(6) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  archived_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entities_public (public_id),
  UNIQUE KEY uq_entities_id_org (id, organization_id),
  UNIQUE KEY uq_entities_legacy (organization_id, legacy_namespace, entity_kind, legacy_id),
  KEY ix_entities_org_kind_updated (organization_id, entity_kind, updated_at),
  CONSTRAINT fk_entities_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_entities_creator FOREIGN KEY (created_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_entities_updater FOREIGN KEY (updated_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_entities_kind CHECK (entity_kind IN ('client','supplier','project','contract','requisition','review','rfq','supplier_quote','customer_quote','customer_quote_version','purchase_order','goods_receipt','delivery','service_order','requisition_change_request','purchase_order_modification_request','invoice'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE files (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_backend VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  detected_mime VARCHAR(128) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 BINARY(32) NOT NULL,
  scan_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  retention_class VARCHAR(64) NULL,
  retain_until DATETIME(6) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_public (public_id),
  UNIQUE KEY uq_files_id_org (id, organization_id),
  UNIQUE KEY uq_files_storage (storage_backend, storage_key),
  UNIQUE KEY uq_files_content (organization_id, sha256, size_bytes),
  CONSTRAINT fk_files_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_files_actor FOREIGN KEY (created_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_files_scan CHECK (scan_status IN ('pending','clean','quarantined','legacy_unverified'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE entity_files (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  association_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  file_role VARCHAR(64) NOT NULL,
  original_filename VARCHAR(500) NULL,
  declared_mime VARCHAR(128) NULL,
  declared_size_bytes BIGINT UNSIGNED NULL,
  legacy_json_path TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entityfiles_association (entity_id, association_key),
  CONSTRAINT fk_entityfiles_entity FOREIGN KEY (entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_entityfiles_file FOREIGN KEY (file_id, organization_id) REFERENCES files(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

-- Fotos de personas y logotipo institucional son FKs concretas al archivo privado.
ALTER TABLE people ADD COLUMN photo_file_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_people_photo FOREIGN KEY (photo_file_id, organization_id) REFERENCES files(id, organization_id);
ALTER TABLE organizations ADD COLUMN logo_file_id BIGINT UNSIGNED NULL,
  ADD CONSTRAINT fk_organizations_logo FOREIGN KEY (logo_file_id, id) REFERENCES files(id, organization_id);

CREATE TABLE clients (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  brand_name VARCHAR(255) NULL,
  tax_identifier VARCHAR(64) NULL,
  address_text TEXT NULL,
  commercial_terms TEXT NULL,
  default_project_reference VARCHAR(255) NULL,
  default_contract_reference VARCHAR(255) NULL,
  notes TEXT NULL,
  status_code VARCHAR(24) NOT NULL,
  repeat_sales_policy VARCHAR(32) NULL,
  repeat_sourcing_policy VARCHAR(32) NULL,
  repeat_price_validity_days INT UNSIGNED NULL,
  repeat_contract_reference VARCHAR(255) NULL,
  repeat_contract_valid_until DATE NULL,
  repeat_min_margin_pct DECIMAL(12,6) NULL,
  repeat_policy_updated_at DATETIME(6) NULL,
  legacy_status VARCHAR(128) NULL,
  data_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  provisional_code BOOLEAN NOT NULL DEFAULT FALSE,
  provisional_name BOOLEAN NOT NULL DEFAULT FALSE,
  portal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  portal_locked BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clients_id_org (id, organization_id),
  CONSTRAINT fk_clients_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_clients_code (organization_id, code),
  KEY ix_clients_name (organization_id, legal_name)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE suppliers (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
code VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  supplier_key VARCHAR(255) NULL,
  legal_name VARCHAR(255) NOT NULL,
  tax_identifier VARCHAR(64) NULL,
  category_id BIGINT UNSIGNED NULL,
  legacy_category_label VARCHAR(255) NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  default_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  credit_type VARCHAR(64) NULL,
  credit_days INT UNSIGNED NULL,
  lead_time_value DECIMAL(12,4) NULL,
  lead_time_unit VARCHAR(64) NULL,
  rating DECIMAL(8,4) NULL,
  rating_scale VARCHAR(32) NULL,
  document_notes TEXT NULL,
  notes TEXT NULL,
  data_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  provisional_code BOOLEAN NOT NULL DEFAULT FALSE,
  provisional_name BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_id_org (id, organization_id),
  CONSTRAINT fk_suppliers_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_suppliers_code (organization_id, code),
  KEY ix_suppliers_status_category (organization_id, status_code, category_id),
  KEY ix_suppliers_name (organization_id, legal_name),
  CONSTRAINT fk_suppliers_category FOREIGN KEY (category_id, organization_id) REFERENCES categories(id, organization_id),
  CONSTRAINT fk_suppliers_currency FOREIGN KEY (default_currency) REFERENCES currencies(code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE party_contacts (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  owner_entity_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NULL,
  source_ordinal INT UNSIGNED NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_partycontacts_public (public_id),
  UNIQUE KEY uq_partycontacts_owner (id, owner_entity_id, organization_id),
  CONSTRAINT fk_partycontacts_owner FOREIGN KEY (owner_entity_id, organization_id) REFERENCES business_entities(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE party_contact_channels (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  owner_entity_id BIGINT UNSIGNED NOT NULL,
  contact_id BIGINT UNSIGNED NULL,
  channel_type VARCHAR(16) NOT NULL,
  value VARCHAR(500) NOT NULL,
  normalized_value VARCHAR(500) NULL,
  source_ordinal INT UNSIGNED NULL,
  source_field VARCHAR(64) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  KEY ix_contactchannels_owner (organization_id, owner_entity_id, channel_type),
  CONSTRAINT fk_contactchannels_owner FOREIGN KEY (owner_entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_contactchannels_contact FOREIGN KEY (contact_id, owner_entity_id, organization_id) REFERENCES party_contacts(id, owner_entity_id, organization_id),
  CONSTRAINT ck_contactchannels_type CHECK (channel_type IN ('email','phone','other'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE supplier_offerings (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  name VARCHAR(500) NOT NULL,
  offering_type VARCHAR(64) NULL,
  category_id BIGINT UNSIGNED NULL,
  legacy_category_label VARCHAR(255) NULL,
  brand VARCHAR(255) NULL,
  model VARCHAR(255) NULL,
  description TEXT NULL,
  lead_time_value DECIMAL(12,4) NULL,
  lead_time_unit VARCHAR(64) NULL,
  credit_type VARCHAR(64) NULL,
  credit_days INT UNSIGNED NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  minimum_order_text VARCHAR(255) NULL,
  valid_until DATE NULL,
  coverage TEXT NULL,
  status_code VARCHAR(32) NOT NULL,
  notes TEXT NULL,
  updated_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offerings_public (public_id),
  UNIQUE KEY uq_offerings_legacy (supplier_id, legacy_id),
  CONSTRAINT fk_offerings_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_offerings_category FOREIGN KEY (category_id, organization_id) REFERENCES categories(id, organization_id),
  CONSTRAINT fk_offerings_currency FOREIGN KEY (currency_code) REFERENCES currencies(code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE projects (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
client_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NULL,
  name VARCHAR(255) NOT NULL,
  status_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_id_org (id, organization_id),
  CONSTRAINT fk_projects_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
CONSTRAINT fk_projects_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE contracts (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
client_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  reference VARCHAR(255) NOT NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status_code VARCHAR(24) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contracts_id_org (id, organization_id),
  CONSTRAINT fk_contracts_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
CONSTRAINT fk_contracts_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_contracts_project FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id),
  CONSTRAINT fk_contracts_currency FOREIGN KEY (currency_code) REFERENCES currencies(code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisitions (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
client_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  contract_id BIGINT UNSIGNED NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  client_reference VARCHAR(255) NULL,
  internal_reference VARCHAR(255) NULL,
  request_date DATE NULL,
  need_date DATE NULL,
  priority_code VARCHAR(24) NOT NULL,
  route_code VARCHAR(24) NOT NULL,
  service_type_id BIGINT UNSIGNED NULL,
  legacy_service_type VARCHAR(255) NULL,
  client_snapshot JSON NULL,
  project_reference_snapshot VARCHAR(255) NULL,
  contract_reference_snapshot VARCHAR(255) NULL,
  requester_name VARCHAR(255) NULL,
  requester_email VARCHAR(254) NULL,
  delivery_place TEXT NULL,
  budget_amount DECIMAL(20,6) NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  description TEXT NULL,
  notes TEXT NULL,
  request_source_type VARCHAR(128) NULL,
  request_source_date DATE NULL,
  request_source_reference VARCHAR(255) NULL,
  request_source_notes TEXT NULL,
  is_provisional BOOLEAN NULL,
  formal_at_origin BOOLEAN NULL,
  provisional_folio VARCHAR(128) NULL,
  regularization_requirement VARCHAR(32) NULL,
  regularization_due_date DATE NULL,
  regularization_owner_user_id BIGINT UNSIGNED NULL,
  regularization_owner_snapshot VARCHAR(255) NULL,
  regularization_status VARCHAR(128) NULL,
  provisional_created_at DATETIME(6) NULL,
  current_revision_number INT UNSIGNED NOT NULL DEFAULT 0,
  history_based BOOLEAN NULL,
  request_type_snapshot VARCHAR(128) NULL,
  repeat_policy_snapshot JSON NULL,
  history_created_at DATETIME(6) NULL,
  change_status VARCHAR(128) NULL,
  latest_change_request_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requisitions_id_org (id, organization_id),
  CONSTRAINT fk_requisitions_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_requisitions_folio (organization_id, folio),
  KEY ix_requisitions_client_date (organization_id, client_id, request_date),
  KEY ix_requisitions_need (organization_id, need_date),
  CONSTRAINT fk_requisitions_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_requisitions_project FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id),
  CONSTRAINT fk_requisitions_contract FOREIGN KEY (contract_id, organization_id) REFERENCES contracts(id, organization_id),
  CONSTRAINT fk_requisitions_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_requisitions_service_type FOREIGN KEY (service_type_id, organization_id) REFERENCES service_types(id, organization_id),
  CONSTRAINT fk_requisitions_reg_owner FOREIGN KEY (regularization_owner_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_requisitions_route CHECK (route_code IN ('supply','service','legacy_unknown'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  line_number INT UNSIGNED NOT NULL,
  display_order INT UNSIGNED NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  unit_id BIGINT UNSIGNED NULL,
  unit_label VARCHAR(128) NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  category_label_snapshot VARCHAR(255) NULL,
  line_status VARCHAR(24) NOT NULL DEFAULT 'active',
  history_based BOOLEAN NULL,
  history_origin VARCHAR(32) NULL,
  source_requisition_id BIGINT UNSIGNED NULL,
  source_customer_quote_version_id BIGINT UNSIGNED NULL,
  repeat_client_price_mode VARCHAR(32) NULL,
  repeat_sourcing_mode VARCHAR(32) NULL,
  fixed_client_price BOOLEAN NULL,
  fixed_client_unit_price DECIMAL(20,6) NULL,
  fixed_client_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  historical_price_schema_version SMALLINT UNSIGNED NULL,
  historical_price_snapshot JSON NULL,
  cancelled_at DATETIME(6) NULL,
  created_by_change_request_id BIGINT UNSIGNED NULL,
  cancelled_by_change_request_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reqitems_public (public_id),
  UNIQUE KEY uq_reqitems_id_org (id, organization_id),
  UNIQUE KEY uq_reqitems_owner (id, organization_id, requisition_id),
  UNIQUE KEY uq_reqitems_ordinal (requisition_id, line_number),
  UNIQUE KEY uq_reqitems_legacy (requisition_id, legacy_id),
  CONSTRAINT fk_reqitems_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_reqitems_unit FOREIGN KEY (unit_id, organization_id) REFERENCES units(id, organization_id),
  CONSTRAINT fk_reqitems_category FOREIGN KEY (category_id, organization_id) REFERENCES categories(id, organization_id),
  CONSTRAINT fk_reqitems_source_req FOREIGN KEY (source_requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_reqitems_fixed_currency FOREIGN KEY (fixed_client_currency) REFERENCES currencies(code),
  CONSTRAINT ck_reqitems_qty CHECK (quantity > 0),
  CONSTRAINT ck_reqitems_status CHECK (line_status IN ('active','cancelled'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_reviews (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  buyer_snapshot JSON NULL,
  technical_result VARCHAR(64) NOT NULL,
  contract_result VARCHAR(64) NOT NULL,
  budget_result VARCHAR(64) NOT NULL,
  strategy VARCHAR(128) NOT NULL,
  min_quotes SMALLINT UNSIGNED NOT NULL,
  deadline DATE NULL,
  criteria TEXT NULL,
  notes TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requisition_reviews_id_org (id, organization_id),
  CONSTRAINT fk_requisition_reviews_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_reviews_folio (organization_id, folio),
  KEY ix_reviews_req (requisition_id),
  CONSTRAINT fk_reviews_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_reviews_buyer FOREIGN KEY (buyer_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_change_requests (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  previous_revision_number INT UNSIGNED NOT NULL,
  new_revision_number INT UNSIGNED NOT NULL,
  request_date DATE NULL,
  requested_by_snapshot VARCHAR(255) NULL,
  source_label VARCHAR(128) NULL,
  change_type VARCHAR(128) NULL,
  reference_text VARCHAR(255) NULL,
  reason TEXT NOT NULL,
  impact_text TEXT NULL,
  requires_sourcing BOOLEAN NOT NULL,
  requires_supplier_confirmation BOOLEAN NOT NULL,
  status_code VARCHAR(64) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  po_amendment_status VARCHAR(128) NULL,
  resulting_customer_quote_version_id BIGINT UNSIGNED NULL,
  evidence_file_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requisition_change_requests_id_org (id, organization_id),
  CONSTRAINT fk_requisition_change_requests_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_reqchanges_folio (organization_id, folio),
  UNIQUE KEY uq_reqchanges_owner (id, organization_id, requisition_id),
  KEY ix_reqchanges_req_status (organization_id, requisition_id, status_code),
  CONSTRAINT fk_reqchanges_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_reqchanges_evidence FOREIGN KEY (evidence_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT ck_reqchanges_revision CHECK (new_revision_number > previous_revision_number)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_revision_snapshots (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  revision_number INT UNSIGNED NOT NULL,
  snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
  snapshot_json JSON NOT NULL,
  snapshot_sha256 BINARY(32) NULL,
  canonical_payload_file_id BIGINT UNSIGNED NULL,
  reason_text TEXT NULL,
  created_by_change_request_id BIGINT UNSIGNED NULL,
  recorded_at DATETIME(6) NULL,
  provenance VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reqrevisions_number (requisition_id, revision_number),
  CONSTRAINT fk_reqrevisions_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_reqrevisions_change FOREIGN KEY (created_by_change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id),
  CONSTRAINT fk_reqrevisions_payload FOREIGN KEY (canonical_payload_file_id, organization_id) REFERENCES files(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_change_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  change_request_id BIGINT UNSIGNED NOT NULL,
  change_ordinal INT UNSIGNED NOT NULL,
  target_kind VARCHAR(24) NOT NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  legacy_item_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  field_code VARCHAR(64) NULL,
  change_kind VARCHAR(64) NOT NULL,
  requires_sourcing BOOLEAN NOT NULL,
  before_snapshot JSON NULL,
  after_snapshot JSON NULL,
  snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
  resolution_status VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reqchangeitems_ordinal (change_request_id, change_ordinal),
  CONSTRAINT fk_reqchangeitems_change FOREIGN KEY (change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id),
  CONSTRAINT fk_reqchangeitems_item FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT ck_reqchangeitems_target CHECK (target_kind IN ('item','header')),
  CONSTRAINT ck_reqchangeitems_resolution CHECK ((target_kind='header' AND requisition_item_id IS NULL AND field_code IS NOT NULL) OR (target_kind='item' AND (requisition_item_id IS NOT NULL OR resolution_status='legacy_unresolved')))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE sourcing_plans (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  min_quotes SMALLINT UNSIGNED NOT NULL,
  updated_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sourcingplan_version (requisition_id, version_number),
  UNIQUE KEY uq_sourcingplan_owner (id, organization_id, requisition_id),
  CONSTRAINT fk_sourcingplan_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE sourcing_lots (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  sourcing_plan_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  name VARCHAR(255) NOT NULL,
  min_quotes SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sourcinglots_id_org (id, organization_id),
  UNIQUE KEY uq_sourcinglots_owner (id, organization_id, requisition_id),
  UNIQUE KEY uq_sourcinglots_legacy (sourcing_plan_id, legacy_id),
  CONSTRAINT fk_sourcinglots_plan FOREIGN KEY (sourcing_plan_id, organization_id, requisition_id) REFERENCES sourcing_plans(id, organization_id, requisition_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE sourcing_lot_items (
organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  sourcing_lot_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NOT NULL,
  strategy VARCHAR(128) NULL,
  category_snapshot VARCHAR(255) NULL,
  PRIMARY KEY (sourcing_lot_id, requisition_item_id),
  CONSTRAINT fk_lotitems_lot FOREIGN KEY (sourcing_lot_id, organization_id, requisition_id) REFERENCES sourcing_lots(id, organization_id, requisition_id),
  CONSTRAINT fk_lotitems_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE sourcing_lot_suppliers (
organization_id BIGINT UNSIGNED NOT NULL,
  sourcing_lot_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  suggested BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (sourcing_lot_id, supplier_id),
  CONSTRAINT fk_lotsuppliers_lot FOREIGN KEY (sourcing_lot_id, organization_id) REFERENCES sourcing_lots(id, organization_id),
  CONSTRAINT fk_lotsuppliers_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT ck_lotsuppliers_role CHECK (selected OR suggested)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE rfqs (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  sourcing_lot_id BIGINT UNSIGNED NULL,
  internal_contact_user_id BIGINT UNSIGNED NULL,
  contact_snapshot JSON NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  request_date DATE NULL,
  deadline DATE NULL,
  required_date DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  delivery_place TEXT NULL,
  requested_documents_text TEXT NULL,
  terms_text TEXT NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rfqs_id_org (id, organization_id),
  CONSTRAINT fk_rfqs_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_rfqs_folio (organization_id, folio),
  UNIQUE KEY uq_rfqs_owner (id, organization_id, requisition_id),
  KEY ix_rfqs_supplier_status (organization_id, supplier_id, status_code),
  CONSTRAINT fk_rfqs_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_rfqs_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_rfqs_lot FOREIGN KEY (sourcing_lot_id, organization_id, requisition_id) REFERENCES sourcing_lots(id, organization_id, requisition_id),
  CONSTRAINT fk_rfqs_contact FOREIGN KEY (internal_contact_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_rfqs_currency FOREIGN KEY (currency_code) REFERENCES currencies(code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE rfq_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  rfq_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  legacy_item_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  resolution_status VARCHAR(24) NOT NULL DEFAULT 'resolved',
  description TEXT NOT NULL,
  specification TEXT NULL,
  category_snapshot VARCHAR(255) NULL,
  unit_label VARCHAR(128) NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rfqitems_id_org (id, organization_id),
  UNIQUE KEY uq_rfqitems_owner (id, organization_id, rfq_id),
  UNIQUE KEY uq_rfqitems_line (rfq_id, line_number),
  CONSTRAINT fk_rfqitems_rfq FOREIGN KEY (rfq_id, organization_id, requisition_id) REFERENCES rfqs(id, organization_id, requisition_id),
  CONSTRAINT fk_rfqitems_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT ck_rfqitems_qty CHECK (quantity > 0),
  CONSTRAINT ck_rfqitems_resolution CHECK ((resolution_status='resolved' AND requisition_item_id IS NOT NULL) OR resolution_status='legacy_unresolved')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE supplier_quotes (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  rfq_id BIGINT UNSIGNED NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  supplier_reference VARCHAR(255) NULL,
  quote_date DATE NULL,
  valid_until DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subtotal_amount DECIMAL(20,6) NOT NULL,
  legacy_tax_value DECIMAL(20,6) NULL,
  tax_rate_pct DECIMAL(12,6) NULL,
  tax_amount DECIMAL(20,6) NULL,
  total_amount DECIMAL(20,6) NOT NULL,
  calculation_version VARCHAR(32) NULL,
  reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  source_kind VARCHAR(32) NOT NULL DEFAULT 'explicit',
  history_source_snapshot JSON NULL,
  lead_days DECIMAL(12,4) NULL,
  payment_terms TEXT NULL,
  technical_score DECIMAL(8,4) NULL,
  document_score DECIMAL(8,4) NULL,
  notes TEXT NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_supplier_quotes_id_org (id, organization_id),
  CONSTRAINT fk_supplier_quotes_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_supplierquotes_folio (organization_id, folio),
  UNIQUE KEY uq_supplierquotes_owner (id, organization_id, requisition_id),
  KEY ix_supplierquotes_req_supplier (organization_id, requisition_id, supplier_id),
  CONSTRAINT fk_supplierquotes_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_supplierquotes_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_supplierquotes_rfq FOREIGN KEY (rfq_id, organization_id, requisition_id) REFERENCES rfqs(id, organization_id, requisition_id),
  CONSTRAINT fk_supplierquotes_currency FOREIGN KEY (currency_code) REFERENCES currencies(code)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE supplier_quote_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  supplier_quote_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  rfq_item_id BIGINT UNSIGNED NULL,
  legacy_item_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legacy_rfq_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  legacy_rfq_folio VARCHAR(128) NULL,
  line_number INT UNSIGNED NOT NULL,
  resolution_status VARCHAR(24) NOT NULL DEFAULT 'resolved',
  description TEXT NOT NULL,
  category_snapshot VARCHAR(255) NULL,
  unit_label VARCHAR(128) NOT NULL,
  requested_quantity DECIMAL(20,6) NULL,
  offered BOOLEAN NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  unit_price DECIMAL(20,6) NOT NULL,
  line_subtotal DECIMAL(20,6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sqitems_id_org (id, organization_id),
  UNIQUE KEY uq_sqitems_owner (id, organization_id, supplier_quote_id),
  UNIQUE KEY uq_sqitems_line (supplier_quote_id, line_number),
  CONSTRAINT fk_sqitems_quote FOREIGN KEY (supplier_quote_id, organization_id, requisition_id) REFERENCES supplier_quotes(id, organization_id, requisition_id),
  CONSTRAINT fk_sqitems_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT fk_sqitems_rfqitem FOREIGN KEY (rfq_item_id, organization_id) REFERENCES rfq_items(id, organization_id),
  CONSTRAINT ck_sqitems_qty CHECK (quantity >= 0),
  CONSTRAINT ck_sqitems_resolution CHECK ((resolution_status='resolved' AND requisition_item_id IS NOT NULL) OR resolution_status='legacy_unresolved')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE awards (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_quote_id BIGINT UNSIGNED NOT NULL,
  supplier_quote_item_id BIGINT UNSIGNED NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  quantity DECIMAL(20,6) NOT NULL,
  unit_price DECIMAL(20,6) NOT NULL,
  subtotal_amount DECIMAL(20,6) NOT NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  recovered_from_po_legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status_code VARCHAR(24) NOT NULL DEFAULT 'active',
  change_request_id BIGINT UNSIGNED NULL,
  legacy_change_reference VARCHAR(128) NULL,
  superseded_at DATETIME(6) NULL,
  created_at DATETIME(6) NULL,
  updated_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_awards_public (public_id),
  UNIQUE KEY uq_awards_id_org (id, organization_id),
  UNIQUE KEY uq_awards_legacy (requisition_id, legacy_id),
  CONSTRAINT fk_awards_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT fk_awards_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_awards_quote FOREIGN KEY (supplier_quote_id, organization_id, requisition_id) REFERENCES supplier_quotes(id, organization_id, requisition_id),
  CONSTRAINT fk_awards_quoteitem FOREIGN KEY (supplier_quote_item_id, organization_id, supplier_quote_id) REFERENCES supplier_quote_items(id, organization_id, supplier_quote_id),
  CONSTRAINT fk_awards_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_awards_change FOREIGN KEY (change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id),
  CONSTRAINT ck_awards_qty CHECK (quantity > 0),
  CONSTRAINT ck_awards_source CHECK (source_kind IN ('explicit','legacy_explicit','legacy_recovered','historical_reuse'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE customer_quotes (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  series_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  migration_grouping_status VARCHAR(32) NOT NULL DEFAULT 'unreviewed',
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_quotes_id_org (id, organization_id),
  CONSTRAINT fk_customer_quotes_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_customerquotes_series (organization_id, series_reference),
  UNIQUE KEY uq_customerquotes_owner (id, organization_id, requisition_id),
  CONSTRAINT fk_customerquotes_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_customerquotes_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE approval_policy_versions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  applies_to VARCHAR(32) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  unit_price_limit DECIMAL(20,6) NULL,
  document_limit DECIMAL(20,6) NULL,
  total_basis VARCHAR(64) NOT NULL,
  comparison_operator VARCHAR(2) NOT NULL,
  rules_json JSON NOT NULL,
  effective_from DATETIME(6) NOT NULL,
  effective_until DATETIME(6) NULL,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_policy_version (organization_id, applies_to, version_number),
  UNIQUE KEY uq_policy_id_org (id, organization_id),
  CONSTRAINT fk_policy_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_policy_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_policy_actor FOREIGN KEY (created_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_policy_comparison CHECK (comparison_operator IN ('>','>='))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE customer_quote_versions (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
customer_quote_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  legacy_revision_number INT NULL,
  change_request_id BIGINT UNSIGNED NULL,
  change_sourcing_required BOOLEAN NULL,
  history_based BOOLEAN NULL,
  history_source_snapshot JSON NULL,
  supersedes_version_id BIGINT UNSIGNED NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  quote_date DATE NULL,
  valid_until DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  exchange_rate_date DATE NULL,
  usd_mxn_rate DECIMAL(24,10) NULL,
  eur_mxn_rate DECIMAL(24,10) NULL,
  exchange_rate_source VARCHAR(255) NULL,
  exchange_rate_label_snapshot VARCHAR(500) NULL,
  document_status VARCHAR(32) NOT NULL,
  internal_approval_status VARCHAR(32) NOT NULL,
  client_decision_status VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  legacy_client_decision VARCHAR(128) NULL,
  prepared_by BIGINT UNSIGNED NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  approved_by BIGINT UNSIGNED NULL,
  people_snapshots JSON NULL,
  client_snapshot JSON NULL,
  delivery_place TEXT NULL,
  lead_time_text TEXT NULL,
  payment_terms TEXT NULL,
  warranty_text TEXT NULL,
  inclusions_text TEXT NULL,
  exclusions_text TEXT NULL,
  notes TEXT NULL,
  subtotal_amount DECIMAL(20,6) NOT NULL,
  legacy_discount_value DECIMAL(20,6) NULL,
  discount_kind VARCHAR(24) NULL,
  discount_rate_pct DECIMAL(12,6) NULL,
  discount_amount DECIMAL(20,6) NULL,
  legacy_tax_value DECIMAL(20,6) NULL,
  tax_rate_pct DECIMAL(12,6) NULL,
  tax_amount DECIMAL(20,6) NULL,
  third_party_taxable_amount DECIMAL(20,6) NULL,
  third_party_tax_amount DECIMAL(20,6) NULL,
  third_party_total_amount DECIMAL(20,6) NULL,
  service_fee_enabled BOOLEAN NULL,
  service_fee_rate_pct DECIMAL(12,6) NULL,
  service_fee_base_amount DECIMAL(20,6) NULL,
  service_fee_unit_price DECIMAL(20,6) NULL,
  service_fee_subtotal_amount DECIMAL(20,6) NULL,
  service_fee_tax_rate_pct DECIMAL(12,6) NULL,
  service_fee_tax_amount DECIMAL(20,6) NULL,
  service_fee_total_amount DECIMAL(20,6) NULL,
  service_fee_comments TEXT NULL,
  financial_breakdown_provenance VARCHAR(32) NOT NULL DEFAULT 'unresolved',
  total_amount DECIMAL(20,6) NOT NULL,
  calculation_version VARCHAR(32) NULL,
  reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  approval_policy_version_id BIGINT UNSIGNED NULL,
  approval_policy_snapshot JSON NULL,
  approval_evaluation_snapshot JSON NULL,
  approved_content_sha256 BINARY(32) NULL,
  issued_at DATETIME(6) NULL,
  locked_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_quote_versions_id_org (id, organization_id),
  CONSTRAINT fk_customer_quote_versions_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_cqversions_version (customer_quote_id, version_number),
  KEY ix_cqversions_folio (organization_id, folio),
  UNIQUE KEY uq_cqversions_owner (id, organization_id, requisition_id),
  UNIQUE KEY uq_cqversions_series_owner (id, organization_id, customer_quote_id),
  KEY ix_cqversions_states (organization_id, document_status, internal_approval_status, client_decision_status),
  CONSTRAINT fk_cqversions_quote FOREIGN KEY (customer_quote_id, organization_id, requisition_id) REFERENCES customer_quotes(id, organization_id, requisition_id),
  CONSTRAINT fk_cqversions_change FOREIGN KEY (change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id),
  CONSTRAINT fk_cqversions_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_cqversions_prepared FOREIGN KEY (prepared_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_cqversions_reviewed FOREIGN KEY (reviewed_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_cqversions_approved FOREIGN KEY (approved_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_cqversions_policy FOREIGN KEY (approval_policy_version_id, organization_id) REFERENCES approval_policy_versions(id, organization_id),
  CONSTRAINT fk_cqversions_supersedes FOREIGN KEY (supersedes_version_id, organization_id, customer_quote_id) REFERENCES customer_quote_versions(id, organization_id, customer_quote_id),
  CONSTRAINT ck_cqversions_discount_kind CHECK (discount_kind IS NULL OR discount_kind IN ('amount','percentage','legacy_unknown')),
  CONSTRAINT ck_cqversions_number CHECK (version_number > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE customer_quote_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  customer_quote_version_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  award_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  legacy_item_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  resolution_status VARCHAR(24) NOT NULL DEFAULT 'resolved',
  description TEXT NOT NULL,
  brand_model VARCHAR(500) NULL,
  unit_label VARCHAR(128) NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  cost_amount DECIMAL(20,6) NOT NULL,
  extra_amount DECIMAL(20,6) NULL,
  charge_pct DECIMAL(12,6) NULL,
  legacy_margin_value DECIMAL(12,6) NULL,
  pricing_formula_code VARCHAR(64) NULL,
  fixed_client_price BOOLEAN NULL,
  fixed_client_unit_price DECIMAL(20,6) NULL,
  fixed_client_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  fixed_price_conversion_pending BOOLEAN NULL,
  history_based BOOLEAN NULL,
  sourcing_pending BOOLEAN NULL,
  cost_is_manual BOOLEAN NULL,
  original_cost_amount DECIMAL(20,6) NULL,
  original_cost_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  cost_source_text VARCHAR(255) NULL,
  exchange_rate DECIMAL(24,10) NULL,
  exchange_rate_date DATE NULL,
  exchange_rate_source VARCHAR(255) NULL,
  unit_price DECIMAL(20,6) NOT NULL,
  line_subtotal DECIMAL(20,6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cqitems_id_org (id, organization_id),
  UNIQUE KEY uq_cqitems_line (customer_quote_version_id, line_number),
  CONSTRAINT fk_cqitems_version FOREIGN KEY (customer_quote_version_id, organization_id, requisition_id) REFERENCES customer_quote_versions(id, organization_id, requisition_id),
  CONSTRAINT fk_cqitems_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT fk_cqitems_award FOREIGN KEY (award_id, organization_id) REFERENCES awards(id, organization_id),
  CONSTRAINT fk_cqitems_costcurrency FOREIGN KEY (original_cost_currency) REFERENCES currencies(code),
  CONSTRAINT fk_cqitems_fixedcurrency FOREIGN KEY (fixed_client_currency) REFERENCES currencies(code),
  CONSTRAINT ck_cqitems_qty CHECK (quantity > 0),
  CONSTRAINT ck_cqitems_resolution CHECK ((resolution_status='resolved' AND requisition_item_id IS NOT NULL) OR resolution_status='legacy_unresolved')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE customer_quote_adjustments (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  customer_quote_version_id BIGINT UNSIGNED NOT NULL,
  calculation_order SMALLINT UNSIGNED NOT NULL,
  adjustment_kind VARCHAR(24) NOT NULL,
  method_code VARCHAR(24) NOT NULL,
  basis_code VARCHAR(64) NULL,
  basis_amount DECIMAL(20,6) NULL,
  rate_pct DECIMAL(12,6) NULL,
  amount DECIMAL(20,6) NULL,
  tax_treatment_code VARCHAR(64) NULL,
  calculation_rule_version VARCHAR(64) NULL,
  description_text TEXT NULL,
  provenance VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cqadjustments_order (customer_quote_version_id, calculation_order),
  CONSTRAINT fk_cqadjustments_version FOREIGN KEY (customer_quote_version_id, organization_id) REFERENCES customer_quote_versions(id, organization_id),
  CONSTRAINT ck_cqadjustments_kind CHECK (adjustment_kind IN ('surcharge','discount','financing','shipping','other')),
  CONSTRAINT ck_cqadjustments_method CHECK (method_code IN ('fixed_amount','percentage','legacy_unknown')),
  CONSTRAINT ck_cqadjustments_shape CHECK (method_code='legacy_unknown' OR (method_code='fixed_amount' AND amount IS NOT NULL) OR (method_code='percentage' AND rate_pct IS NOT NULL AND basis_code IS NOT NULL))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

-- customer_quote_adjustments: moneda heredada de la versión; no guarda
-- monedas contradictorias. Importar sólo cargos explícitos o conciliados; no
-- convertir diferencias aritméticas en cargos reales sin evidencia aprobada.

CREATE TABLE customer_quote_decisions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  customer_quote_version_id BIGINT UNSIGNED NOT NULL,
  decision_code VARCHAR(32) NOT NULL,
  decision_at DATETIME(6) NULL,
  recorded_at DATETIME(6) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_client_id BIGINT UNSIGNED NULL,
  auth_session_id BIGINT UNSIGNED NULL,
  external_actor_snapshot JSON NULL,
  decision_channel VARCHAR(32) NOT NULL,
  note TEXT NULL,
  evidence_file_id BIGINT UNSIGNED NULL,
  document_sha256 BINARY(32) NULL,
  provenance VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_cqdecisions_version_date (customer_quote_version_id, decision_at),
  CONSTRAINT fk_cqdecisions_version FOREIGN KEY (customer_quote_version_id, organization_id) REFERENCES customer_quote_versions(id, organization_id),
  CONSTRAINT fk_cqdecisions_user FOREIGN KEY (actor_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_cqdecisions_client FOREIGN KEY (actor_client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT ck_cqdecisions_session_actor CHECK (auth_session_id IS NULL OR ((actor_user_id IS NOT NULL) + (actor_client_id IS NOT NULL) = 1)),
  CONSTRAINT fk_cqdecisions_file FOREIGN KEY (evidence_file_id, organization_id) REFERENCES files(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE purchase_orders (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
supplier_id BIGINT UNSIGNED NOT NULL,
  primary_supplier_quote_id BIGINT UNSIGNED NULL,
  source_customer_quote_version_id BIGINT UNSIGNED NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  series_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  legacy_revision_number INT NULL,
  root_purchase_order_id BIGINT UNSIGNED NULL,
  supersedes_purchase_order_id BIGINT UNSIGNED NULL,
  change_request_id BIGINT UNSIGNED NULL,
  amendment_date DATE NULL,
  amendment_type VARCHAR(64) NULL,
  amendment_source VARCHAR(255) NULL,
  amendment_reference VARCHAR(255) NULL,
  amendment_reason TEXT NULL,
  previous_total_amount DECIMAL(20,6) NULL,
  amendment_schema_version SMALLINT UNSIGNED NULL,
  amendment_snapshot JSON NULL,
  change_pending BOOLEAN NOT NULL DEFAULT FALSE,
  change_pending_status VARCHAR(128) NULL,
  modification_approval_status VARCHAR(64) NULL,
  modification_authorization_request_id BIGINT UNSIGNED NULL,
  order_date DATE NULL,
  commitment_date DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subtotal_amount DECIMAL(20,6) NOT NULL,
  legacy_tax_value DECIMAL(20,6) NULL,
  tax_rate_pct DECIMAL(12,6) NULL,
  tax_amount DECIMAL(20,6) NULL,
  total_amount DECIMAL(20,6) NOT NULL,
  reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  operational_status VARCHAR(32) NOT NULL,
  approval_status VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  legacy_workflow_status VARCHAR(128) NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  preparer_user_id BIGINT UNSIGNED NULL,
  authorizer_user_id BIGINT UNSIGNED NULL,
  current_responsible_user_id BIGINT UNSIGNED NULL,
  current_responsible_role VARCHAR(32) NULL,
  people_snapshots JSON NULL,
  supplier_snapshot JSON NULL,
  bill_to_snapshot JSON NULL,
  delivery_place TEXT NULL,
  incoterm_code VARCHAR(16) NULL,
  order_reference VARCHAR(255) NULL,
  internal_reference VARCHAR(255) NULL,
  payment_method_code VARCHAR(16) NULL,
  payment_method_label VARCHAR(255) NULL,
  payment_form_code VARCHAR(16) NULL,
  payment_form_label VARCHAR(255) NULL,
  cfdi_use_code VARCHAR(16) NULL,
  cfdi_use_label VARCHAR(255) NULL,
  invoice_contact_snapshot JSON NULL,
  terms_text TEXT NULL,
  delivery_schedule_text TEXT NULL,
  notes TEXT NULL,
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  consolidated_legacy BOOLEAN NULL,
  one_po_per_supplier_legacy BOOLEAN NULL,
  automation_source_snapshot JSON NULL,
  authorized_at DATETIME(6) NULL,
  approved_content_sha256 BINARY(32) NULL,
  locked_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_orders_id_org (id, organization_id),
  CONSTRAINT fk_purchase_orders_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
KEY ix_purchaseorders_folio (organization_id, folio),
  UNIQUE KEY uq_purchaseorders_series_version (organization_id, series_public_id, version_number),
  UNIQUE KEY uq_purchaseorders_mod_use (modification_authorization_request_id),
  UNIQUE KEY uq_purchaseorders_series_owner (id, organization_id, series_public_id),
  KEY ix_purchaseorders_supplier_date (organization_id, supplier_id, order_date),
  KEY ix_purchaseorders_responsible (organization_id, current_responsible_user_id, approval_status),
  CONSTRAINT fk_purchaseorders_root FOREIGN KEY (root_purchase_order_id, organization_id, series_public_id) REFERENCES purchase_orders(id, organization_id, series_public_id),
  CONSTRAINT fk_purchaseorders_supersedes FOREIGN KEY (supersedes_purchase_order_id, organization_id, series_public_id) REFERENCES purchase_orders(id, organization_id, series_public_id),
  CONSTRAINT fk_purchaseorders_change FOREIGN KEY (change_request_id, organization_id) REFERENCES requisition_change_requests(id, organization_id),
  CONSTRAINT ck_purchaseorders_version CHECK (version_number > 0),
  CONSTRAINT fk_purchaseorders_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_purchaseorders_quote FOREIGN KEY (primary_supplier_quote_id, organization_id) REFERENCES supplier_quotes(id, organization_id),
  CONSTRAINT fk_purchaseorders_cqversion FOREIGN KEY (source_customer_quote_version_id, organization_id) REFERENCES customer_quote_versions(id, organization_id),
  CONSTRAINT fk_purchaseorders_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_purchaseorders_buyer FOREIGN KEY (buyer_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_purchaseorders_preparer FOREIGN KEY (preparer_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_purchaseorders_authorizer FOREIGN KEY (authorizer_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_purchaseorders_responsible FOREIGN KEY (current_responsible_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE purchase_order_modification_requests (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
purchase_order_id BIGINT UNSIGNED NOT NULL,
  series_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  legacy_po_revision_number INT NULL,
  change_type VARCHAR(128) NULL,
  urgency VARCHAR(32) NULL,
  reference_text VARCHAR(255) NULL,
  impact_text VARCHAR(255) NULL,
  reason TEXT NOT NULL,
  status_code VARCHAR(64) NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NULL,
  requester_snapshot JSON NULL,
  requested_at DATETIME(6) NULL,
  assigned_approver_user_id BIGINT UNSIGNED NULL,
  approver_snapshot JSON NULL,
  decision_code VARCHAR(32) NULL,
  decided_by_user_id BIGINT UNSIGNED NULL,
  decision_actor_snapshot JSON NULL,
  decision_at DATETIME(6) NULL,
  approved_at DATETIME(6) NULL,
  decision_comment TEXT NULL,
  resubmitted_at DATETIME(6) NULL,
  consumed_at DATETIME(6) NULL,
  consumed_by_user_id BIGINT UNSIGNED NULL,
  consumed_by_snapshot JSON NULL,
  generated_purchase_order_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_order_modification_requests_id_org (id, organization_id),
  CONSTRAINT fk_purchase_order_modification_requests_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_pomodreq_folio (organization_id, folio),
  UNIQUE KEY uq_pomodreq_generated (generated_purchase_order_id),
  UNIQUE KEY uq_pomodreq_series_owner (id, organization_id, series_public_id),
  KEY ix_pomodreq_assigned (organization_id, assigned_approver_user_id, status_code),
  CONSTRAINT fk_pomodreq_po FOREIGN KEY (purchase_order_id, organization_id, series_public_id) REFERENCES purchase_orders(id, organization_id, series_public_id),
  CONSTRAINT fk_pomodreq_requester FOREIGN KEY (requested_by_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_pomodreq_approver FOREIGN KEY (assigned_approver_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_pomodreq_decider FOREIGN KEY (decided_by_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_pomodreq_consumer FOREIGN KEY (consumed_by_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_pomodreq_generated FOREIGN KEY (generated_purchase_order_id, organization_id, series_public_id) REFERENCES purchase_orders(id, organization_id, series_public_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE purchase_order_requisitions (
organization_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  requisition_folio_snapshot VARCHAR(128) NULL,
  internal_reference_snapshot VARCHAR(255) NULL,
  PRIMARY KEY (purchase_order_id, requisition_id),
  UNIQUE KEY uq_poreqs_scope (purchase_order_id, requisition_id, organization_id),
  CONSTRAINT fk_poreqs_po FOREIGN KEY (purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_poreqs_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE purchase_order_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  legacy_item_reference VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  description TEXT NOT NULL,
  category_snapshot VARCHAR(255) NULL,
  unit_label VARCHAR(128) NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  unit_price DECIMAL(20,6) NOT NULL,
  line_subtotal DECIMAL(20,6) NOT NULL,
  source_resolution_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  previous_purchase_order_item_id BIGINT UNSIGNED NULL,
  line_status VARCHAR(24) NOT NULL DEFAULT 'active',
  amendment_action_snapshot VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_poitems_public (public_id),
  UNIQUE KEY uq_poitems_id_org (id, organization_id),
  UNIQUE KEY uq_poitems_owner (id, organization_id, purchase_order_id),
  UNIQUE KEY uq_poitems_line (purchase_order_id, line_number),
  CONSTRAINT fk_poitems_po FOREIGN KEY (purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_poitems_previous FOREIGN KEY (previous_purchase_order_item_id, organization_id) REFERENCES purchase_order_items(id, organization_id),
  CONSTRAINT ck_poitems_qty CHECK ((line_status='active' AND quantity > 0) OR (line_status='cancelled' AND quantity=0))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE purchase_order_line_sources (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  source_ordinal INT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  supplier_quote_item_id BIGINT UNSIGNED NULL,
  award_id BIGINT UNSIGNED NULL,
  sourcing_lot_id BIGINT UNSIGNED NULL,
  sourcing_lot_name_snapshot VARCHAR(255) NULL,
  allocated_quantity DECIMAL(20,6) NOT NULL,
  resolution_status VARCHAR(24) NOT NULL,
  legacy_source_snapshot JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_polinesources_ordinal (purchase_order_item_id, source_ordinal),
  CONSTRAINT fk_polinesources_poitem FOREIGN KEY (purchase_order_item_id, organization_id, purchase_order_id) REFERENCES purchase_order_items(id, organization_id, purchase_order_id),
  CONSTRAINT fk_polinesources_req FOREIGN KEY (purchase_order_id, requisition_id, organization_id) REFERENCES purchase_order_requisitions(purchase_order_id, requisition_id, organization_id),
  CONSTRAINT fk_polinesources_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT fk_polinesources_quoteitem FOREIGN KEY (supplier_quote_item_id, organization_id) REFERENCES supplier_quote_items(id, organization_id),
  CONSTRAINT fk_polinesources_award FOREIGN KEY (award_id, organization_id) REFERENCES awards(id, organization_id),
  CONSTRAINT fk_polinesources_lot FOREIGN KEY (sourcing_lot_id, organization_id, requisition_id) REFERENCES sourcing_lots(id, organization_id, requisition_id),
  CONSTRAINT ck_polinesources_lot_parent CHECK (sourcing_lot_id IS NULL OR requisition_id IS NOT NULL),
  CONSTRAINT ck_polinesources_qty CHECK (allocated_quantity > 0),
  CONSTRAINT ck_polinesources_parent CHECK (requisition_item_id IS NULL OR requisition_id IS NOT NULL),
  CONSTRAINT ck_polinesources_resolution CHECK ((resolution_status='resolved' AND requisition_id IS NOT NULL AND requisition_item_id IS NOT NULL) OR resolution_status='legacy_unresolved')
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE workflow_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_event_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  workflow_code VARCHAR(64) NOT NULL,
  action_code VARCHAR(64) NOT NULL,
  from_state VARCHAR(64) NULL,
  to_state VARCHAR(64) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  target_user_id BIGINT UNSIGNED NULL,
  actor_snapshot JSON NULL,
  legacy_action_text TEXT NULL,
  comment_text TEXT NULL,
  related_change_request_id BIGINT UNSIGNED NULL,
  payload_schema_version SMALLINT UNSIGNED NULL,
  payload_json JSON NULL,
  occurred_at DATETIME(6) NULL,
  recorded_at DATETIME(6) NOT NULL,
  content_sha256 BINARY(32) NULL,
  provenance VARCHAR(24) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workflowevents_public (public_id),
  UNIQUE KEY uq_workflowevents_legacy (entity_id, legacy_event_id),
  KEY ix_workflowevents_entity_time (entity_id, occurred_at, id),
  CONSTRAINT fk_workflowevents_entity FOREIGN KEY (entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_workflowevents_actor FOREIGN KEY (actor_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_workflowevents_change FOREIGN KEY (related_change_request_id, organization_id) REFERENCES requisition_change_requests(id, organization_id),
  CONSTRAINT fk_workflowevents_target FOREIGN KEY (target_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE goods_receipts (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
purchase_order_id BIGINT UNSIGNED NOT NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  receipt_date DATE NULL,
  capture_grain VARCHAR(32) NOT NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_type VARCHAR(128) NULL,
  legacy_received_percent DECIMAL(12,8) NULL,
  legacy_delivery_percent DECIMAL(12,8) NULL,
  quality_result VARCHAR(64) NULL,
  documentation_result VARCHAR(64) NULL,
  notes TEXT NULL,
  legacy_delivery_snapshot JSON NULL,
  origin_purchase_order_id BIGINT UNSIGNED NULL,
  amendment_reconciliation_schema_version SMALLINT UNSIGNED NULL,
  amendment_reconciliation_snapshot JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_goods_receipts_id_org (id, organization_id),
  CONSTRAINT fk_goods_receipts_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_receipts_folio (organization_id, folio),
  UNIQUE KEY uq_receipts_po (id, organization_id, purchase_order_id),
  CONSTRAINT fk_receipts_po FOREIGN KEY (purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_receipts_origin_po FOREIGN KEY (origin_purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT ck_receipts_grain CHECK (capture_grain IN ('line_items','legacy_header_only'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE goods_receipt_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  goods_receipt_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  received_quantity DECIMAL(20,6) NOT NULL,
  accepted_quantity DECIMAL(20,6) NOT NULL,
  rejected_quantity DECIMAL(20,6) NOT NULL,
  unit_label VARCHAR(128) NOT NULL,
  quality_note TEXT NULL,
  provenance VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receiptitems_id_org (id, organization_id),
  UNIQUE KEY uq_receiptitems_line (goods_receipt_id, line_number),
  CONSTRAINT fk_receiptitems_receipt FOREIGN KEY (goods_receipt_id, organization_id, purchase_order_id) REFERENCES goods_receipts(id, organization_id, purchase_order_id),
  CONSTRAINT fk_receiptitems_poitem FOREIGN KEY (purchase_order_item_id, organization_id, purchase_order_id) REFERENCES purchase_order_items(id, organization_id, purchase_order_id),
  CONSTRAINT ck_receiptitems_qty CHECK (received_quantity >= 0 AND accepted_quantity >= 0 AND rejected_quantity >= 0 AND accepted_quantity + rejected_quantity <= received_quantity),
  CONSTRAINT ck_receiptitems_provenance CHECK (provenance IN ('captured','approved_reconstruction'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE deliveries (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
client_id BIGINT UNSIGNED NOT NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  delivery_date DATE NULL,
  control_reference VARCHAR(128) NULL,
  delivery_type VARCHAR(32) NOT NULL,
  acceptance_status VARCHAR(32) NOT NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  client_snapshot JSON NULL,
  delivery_place TEXT NULL,
  delivered_by_snapshot JSON NULL,
  received_by_snapshot JSON NULL,
  evidence_text TEXT NULL,
  notes TEXT NULL,
  locked_at DATETIME(6) NULL,
  legacy_locked BOOLEAN NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deliveries_id_org (id, organization_id),
  CONSTRAINT fk_deliveries_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_deliveries_folio (organization_id, folio),
  KEY ix_deliveries_client_date (organization_id, client_id, delivery_date),
  CONSTRAINT fk_deliveries_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE delivery_sources (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  delivery_id BIGINT UNSIGNED NOT NULL,
  source_ordinal INT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  goods_receipt_id BIGINT UNSIGNED NULL,
  folio_snapshots JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deliverysources_ordinal (delivery_id, source_ordinal),
  CONSTRAINT fk_deliverysources_delivery FOREIGN KEY (delivery_id, organization_id) REFERENCES deliveries(id, organization_id),
  CONSTRAINT fk_deliverysources_po FOREIGN KEY (purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_deliverysources_req FOREIGN KEY (purchase_order_id, requisition_id, organization_id) REFERENCES purchase_order_requisitions(purchase_order_id, requisition_id, organization_id),
  CONSTRAINT fk_deliverysources_receipt FOREIGN KEY (goods_receipt_id, organization_id, purchase_order_id) REFERENCES goods_receipts(id, organization_id, purchase_order_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE delivery_items (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  delivery_id BIGINT UNSIGNED NOT NULL,
  requisition_id BIGINT UNSIGNED NOT NULL,
  requisition_item_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  legacy_item_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  source_resolution_status VARCHAR(24) NOT NULL,
  description TEXT NOT NULL,
  unit_label VARCHAR(128) NOT NULL,
  delivery_quantity DECIMAL(20,6) NOT NULL,
  requested_qty_snapshot DECIMAL(20,6) NULL,
  received_qty_snapshot DECIMAL(20,6) NULL,
  previous_delivered_qty_snapshot DECIMAL(20,6) NULL,
  balance_after_snapshot DECIMAL(20,6) NULL,
  legacy_po_folios JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deliveryitems_id_org (id, organization_id),
  UNIQUE KEY uq_deliveryitems_line (delivery_id, line_number),
  CONSTRAINT fk_deliveryitems_delivery FOREIGN KEY (delivery_id, organization_id) REFERENCES deliveries(id, organization_id),
  CONSTRAINT fk_deliveryitems_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_deliveryitems_reqitem FOREIGN KEY (requisition_item_id, organization_id, requisition_id) REFERENCES requisition_items(id, organization_id, requisition_id),
  CONSTRAINT ck_deliveryitems_qty CHECK (delivery_quantity > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE delivery_item_allocations (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  delivery_item_id BIGINT UNSIGNED NOT NULL,
  goods_receipt_item_id BIGINT UNSIGNED NOT NULL,
  allocated_quantity DECIMAL(20,6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deliveryalloc_pair (delivery_item_id, goods_receipt_item_id),
  CONSTRAINT fk_deliveryalloc_deliveryitem FOREIGN KEY (delivery_item_id, organization_id) REFERENCES delivery_items(id, organization_id),
  CONSTRAINT fk_deliveryalloc_receiptitem FOREIGN KEY (goods_receipt_item_id, organization_id) REFERENCES goods_receipt_items(id, organization_id),
  CONSTRAINT ck_deliveryalloc_qty CHECK (allocated_quantity > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE signature_evidence (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  signature_role VARCHAR(32) NOT NULL,
  method_label VARCHAR(255) NOT NULL,
  signature_file_id BIGINT UNSIGNED NULL,
  signer_user_id BIGINT UNSIGNED NULL,
  signer_client_id BIGINT UNSIGNED NULL,
  signer_auth_session_id BIGINT UNSIGNED NULL,
  captured_by_user_id BIGINT UNSIGNED NULL,
  capture_auth_session_id BIGINT UNSIGNED NULL,
  capture_actor_snapshot JSON NULL,
  signer_snapshot JSON NULL,
  signed_at DATETIME(6) NULL,
  document_sha256 BINARY(32) NULL,
  signature_sha256 BINARY(32) NULL,
  evidence_sha256 BINARY(32) NULL,
  hash_origin VARCHAR(32) NOT NULL,
  hashing_scope VARCHAR(64) NOT NULL,
  legacy_payload_json_path TEXT NULL,
  import_record_id BIGINT UNSIGNED NULL,
  canonicalization_version VARCHAR(64) NULL,
  canonical_payload_file_id BIGINT UNSIGNED NULL,
  signed_payload_schema_version SMALLINT UNSIGNED NULL,
  evidence_scope_version VARCHAR(64) NULL,
  attachment_manifest_json JSON NULL,
  consent_statement_snapshot TEXT NULL,
  consent_recorded_at DATETIME(6) NULL,
  integrity_verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  preservation_standard VARCHAR(64) NULL,
  preservation_status VARCHAR(64) NULL,
  certification_provider VARCHAR(255) NULL,
  certification_reference VARCHAR(255) NULL,
  timestamp_reference VARCHAR(255) NULL,
  certification_file_id BIGINT UNSIGNED NULL,
  certification_recorded_at DATETIME(6) NULL,
  legacy_evidence_metadata JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_signatureevidence_id_org (id, organization_id),
  UNIQUE KEY uq_signatureevidence_entity_owner (id, organization_id, entity_id),
  KEY ix_signatureevidence_entity (entity_id, signature_role),
  CONSTRAINT fk_signatureevidence_entity FOREIGN KEY (entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_signatureevidence_file FOREIGN KEY (signature_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT fk_signatureevidence_user FOREIGN KEY (signer_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_signatureevidence_client FOREIGN KEY (signer_client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_signatureevidence_canonical FOREIGN KEY (canonical_payload_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT ck_signatureevidence_session_actor CHECK (signer_auth_session_id IS NULL OR ((signer_user_id IS NOT NULL) + (signer_client_id IS NOT NULL) = 1)),
  CONSTRAINT ck_signatureevidence_capture_actor CHECK (capture_auth_session_id IS NULL OR captured_by_user_id IS NOT NULL),
  CONSTRAINT fk_signatureevidence_capturer FOREIGN KEY (captured_by_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_signatureevidence_certificate FOREIGN KEY (certification_file_id, organization_id) REFERENCES files(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE invoices (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  primary_purchase_order_id BIGINT UNSIGNED NULL,
  goods_receipt_id BIGINT UNSIGNED NULL,
  legacy_receipt_reference VARCHAR(128) NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  invoice_number VARCHAR(128) NOT NULL,
  normalized_invoice_number VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  fiscal_uuid VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  issue_date DATE NOT NULL,
  due_date DATE NULL,
  issuer_snapshot VARCHAR(500) NULL,
  receiver_snapshot VARCHAR(500) NULL,
  subtotal_amount DECIMAL(20,6) NOT NULL,
  tax_amount DECIMAL(20,6) NOT NULL,
  total_amount DECIMAL(20,6) NOT NULL,
  currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status_code VARCHAR(64) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  payment_terms TEXT NULL,
  notes TEXT NULL,
  document_file_id BIGINT UNSIGNED NOT NULL,
  document_revision_number INT UNSIGNED NOT NULL DEFAULT 1,
  calculation_version VARCHAR(64) NULL,
  reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_id_org (id, organization_id),
  CONSTRAINT fk_invoices_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_invoices_folio (organization_id, folio),
  UNIQUE KEY uq_invoices_number (organization_id, normalized_invoice_number),
  UNIQUE KEY uq_invoices_client_owner (id, organization_id, client_id),
  KEY ix_invoices_req (organization_id, requisition_id, status_code),
  KEY ix_invoices_client_due (organization_id, client_id, due_date, status_code),
  CONSTRAINT fk_invoices_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_invoices_primary_po FOREIGN KEY (primary_purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_invoices_receipt FOREIGN KEY (goods_receipt_id, organization_id) REFERENCES goods_receipts(id, organization_id),
  CONSTRAINT fk_invoices_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT fk_invoices_document FOREIGN KEY (document_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT ck_invoices_revision CHECK (document_revision_number > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE invoice_purchase_orders (
organization_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source_ordinal INT UNSIGNED NULL,
  po_folio_snapshot VARCHAR(128) NULL,
  PRIMARY KEY (invoice_id, purchase_order_id),
  CONSTRAINT fk_invoicepos_invoice FOREIGN KEY (invoice_id, organization_id) REFERENCES invoices(id, organization_id),
  CONSTRAINT fk_invoicepos_po FOREIGN KEY (purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE invoice_acknowledgments (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  invoice_document_revision_number INT UNSIGNED NOT NULL,
  document_file_id BIGINT UNSIGNED NOT NULL,
  document_snapshot_schema_version SMALLINT UNSIGNED NOT NULL,
  document_snapshot_json JSON NOT NULL,
  signature_evidence_id BIGINT UNSIGNED NOT NULL,
  auth_session_id BIGINT UNSIGNED NULL,
  signer_name_snapshot VARCHAR(255) NULL,
  signer_role_snapshot VARCHAR(255) NULL,
  acknowledged_on DATE NULL,
  acknowledged_at DATETIME(6) NULL,
  recorded_at DATETIME(6) NOT NULL,
  provenance VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoiceacks_public (public_id),
  KEY ix_invoiceacks_invoice (invoice_id, acknowledged_at),
  CONSTRAINT fk_invoiceacks_invoice FOREIGN KEY (invoice_id, organization_id, client_id) REFERENCES invoices(id, organization_id, client_id),
  CONSTRAINT fk_invoiceacks_document FOREIGN KEY (document_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT fk_invoiceacks_signature FOREIGN KEY (signature_evidence_id, organization_id, invoice_id) REFERENCES signature_evidence(id, organization_id, entity_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE service_orders (
id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
requisition_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  service_type_id BIGINT UNSIGNED NULL,
  legacy_service_type VARCHAR(255) NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  supplier_purchase_order_id BIGINT UNSIGNED NULL,
  folio VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  internal_reference VARCHAR(255) NULL,
  client_snapshot JSON NULL,
  supplier_snapshot JSON NULL,
  project_reference_snapshot VARCHAR(255) NULL,
  contract_reference_snapshot VARCHAR(255) NULL,
  authorization_type VARCHAR(128) NULL,
  authorization_status VARCHAR(128) NULL,
  authorization_reference VARCHAR(255) NULL,
  authorization_date DATE NULL,
  authorization_amount DECIMAL(20,6) NULL,
  authorization_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  authorization_valid_until DATE NULL,
  requires_supplier BOOLEAN NOT NULL,
  supplier_po_snapshot JSON NULL,
  request_date DATE NULL,
  required_date DATE NULL,
  responsible_user_id BIGINT UNSIGNED NULL,
  responsible_snapshot VARCHAR(255) NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  quantity DECIMAL(20,6) NOT NULL,
  unit_label VARCHAR(128) NOT NULL,
  cost_amount DECIMAL(20,6) NOT NULL,
  price_amount DECIMAL(20,6) NOT NULL,
  commercial_currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
  commercial_currency_resolution VARCHAR(32) NOT NULL DEFAULT 'unresolved',
  description TEXT NULL,
  notes TEXT NULL,
  detail_schema_code VARCHAR(64) NOT NULL,
  detail_schema_version SMALLINT UNSIGNED NOT NULL,
  details_json JSON NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_orders_id_org (id, organization_id),
  CONSTRAINT fk_service_orders_entity FOREIGN KEY (id, organization_id)
    REFERENCES business_entities (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
UNIQUE KEY uq_services_folio (organization_id, folio),
  KEY ix_services_type_status (organization_id, service_type_id, status_code),
  CONSTRAINT fk_services_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id),
  CONSTRAINT fk_services_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_services_type FOREIGN KEY (service_type_id, organization_id) REFERENCES service_types(id, organization_id),
  CONSTRAINT fk_services_supplier FOREIGN KEY (supplier_id, organization_id) REFERENCES suppliers(id, organization_id),
  CONSTRAINT fk_services_po FOREIGN KEY (supplier_purchase_order_id, organization_id) REFERENCES purchase_orders(id, organization_id),
  CONSTRAINT fk_services_authorization_currency FOREIGN KEY (authorization_currency) REFERENCES currencies(code),
  CONSTRAINT fk_services_commercial_currency FOREIGN KEY (commercial_currency) REFERENCES currencies(code),
  CONSTRAINT fk_services_responsible FOREIGN KEY (responsible_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_services_qty CHECK (quantity > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE audit_events (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  subject_entity_id BIGINT UNSIGNED NULL,
  subject_user_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_snapshot JSON NULL,
  audit_schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  legacy_audit_version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  module_code VARCHAR(64) NULL,
  action_code VARCHAR(128) NOT NULL,
  result_code VARCHAR(32) NULL,
  occurred_at DATETIME(6) NULL,
  legacy_date_text VARCHAR(128) NULL,
  recorded_at DATETIME(6) NOT NULL,
  correlation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  detail_text TEXT NULL,
  changes_json JSON NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  legacy_record_reference VARCHAR(255) NULL,
  source_kind VARCHAR(24) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auditevents_public (public_id),
  UNIQUE KEY uq_auditevents_legacy (organization_id, legacy_id),
  KEY ix_auditevents_org_time (organization_id, occurred_at, id),
  KEY ix_auditevents_entity_time (subject_entity_id, occurred_at, id),
  KEY ix_auditevents_actor_time (organization_id, actor_user_id, occurred_at),
  CONSTRAINT fk_auditevents_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_auditevents_entity FOREIGN KEY (subject_entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_auditevents_user FOREIGN KEY (subject_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_auditevents_actor FOREIGN KEY (actor_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

-- audit_events/workflow_events: rol runtime con INSERT/SELECT; sin UPDATE/DELETE.
-- No contienen hashes de contraseñas, tokens, firmas base64 ni archivos.

CREATE TABLE notifications (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  entity_id BIGINT UNSIGNED NULL,
  notification_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_public (public_id),
  UNIQUE KEY uq_notifications_legacy (organization_id, legacy_id),
  KEY ix_notifications_unread (organization_id, recipient_user_id, is_read, created_at),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_notifications_sender FOREIGN KEY (sender_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_notifications_entity FOREIGN KEY (entity_id, organization_id) REFERENCES business_entities(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE outbox_messages (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_deduplication_sha256 BINARY(32) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(128) NOT NULL,
  document_file_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  recipient_snapshot_json JSON NULL,
  channel VARCHAR(24) NOT NULL,
  payload_schema_version SMALLINT UNSIGNED NOT NULL,
  payload_json JSON NOT NULL,
  status_code VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(6) NOT NULL,
  locked_until DATETIME(6) NULL,
  locked_by VARCHAR(128) NULL,
  created_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  last_error_code VARCHAR(128) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outbox_public (public_id),
  UNIQUE KEY uq_outbox_id_org (id, organization_id),
  UNIQUE KEY uq_outbox_dedupe (organization_id, event_deduplication_sha256),
  KEY ix_outbox_due (status_code, available_at, id),
  CONSTRAINT fk_outbox_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_outbox_entity FOREIGN KEY (entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_outbox_document FOREIGN KEY (document_file_id, organization_id) REFERENCES files(id, organization_id),
  CONSTRAINT fk_outbox_actor FOREIGN KEY (actor_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE email_delivery_logs (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  outbox_message_id BIGINT UNSIGNED NULL,
  attempt_number INT UNSIGNED NULL,
  event_key TEXT NULL,
  event_type VARCHAR(128) NULL,
  reference_text VARCHAR(255) NULL,
  recipients_snapshot JSON NULL,
  status_code VARCHAR(32) NOT NULL,
  legacy_status VARCHAR(128) NULL,
  detail_text TEXT NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  sender_snapshot VARCHAR(255) NULL,
  provider_response_json JSON NULL,
  provider_message_id VARCHAR(255) NULL,
  occurred_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emaillogs_legacy (organization_id, legacy_id),
  UNIQUE KEY uq_emaillogs_attempt (outbox_message_id, attempt_number),
  KEY ix_emaillogs_org_time (organization_id, occurred_at),
  CONSTRAINT fk_emaillogs_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_emaillogs_outbox FOREIGN KEY (outbox_message_id, organization_id) REFERENCES outbox_messages(id, organization_id),
  CONSTRAINT fk_emaillogs_sender FOREIGN KEY (sender_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE ai_runs (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  requisition_id BIGINT UNSIGNED NULL,
  legacy_requisition_reference VARCHAR(128) NULL,
  task_code VARCHAR(128) NOT NULL,
  task_label VARCHAR(255) NULL,
  execution_mode VARCHAR(64) NULL,
  origin VARCHAR(128) NULL,
  status_code VARCHAR(64) NULL,
  output_text LONGTEXT NULL,
  provider_name VARCHAR(128) NULL,
  model_name VARCHAR(128) NULL,
  prompt_version VARCHAR(64) NULL,
  occurred_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_airuns_legacy (organization_id, legacy_id),
  CONSTRAINT fk_airuns_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_airuns_req FOREIGN KEY (requisition_id, organization_id) REFERENCES requisitions(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE document_sequences (
organization_id BIGINT UNSIGNED NOT NULL,
  document_kind VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  series_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  period_key VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  next_value BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (organization_id, document_kind, series_code, period_key),
  CONSTRAINT fk_sequences_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT ck_sequences_next CHECK (next_value > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE portal_access_tokens (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  token_selector CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash BINARY(32) NOT NULL,
  allowed_actions_json JSON NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  issued_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  last_used_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_portaltokens_client_owner (id, organization_id, client_id),
  UNIQUE KEY uq_portaltokens_selector (token_selector),
  UNIQUE KEY uq_portaltokens_hash (token_hash),
  CONSTRAINT fk_portaltokens_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_portaltokens_issuer FOREIGN KEY (issued_by, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT ck_portaltokens_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE auth_sessions (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  principal_kind VARCHAR(24) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NULL,
  portal_access_token_id BIGINT UNSIGNED NULL,
  token_sha256 BINARY(32) NOT NULL,
  authentication_method VARCHAR(64) NOT NULL,
  allowed_actions_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  last_seen_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  revocation_reason VARCHAR(128) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_authsessions_public (public_id),
  UNIQUE KEY uq_authsessions_id_org (id, organization_id),
  UNIQUE KEY uq_authsessions_user_scope (id, organization_id, user_id),
  UNIQUE KEY uq_authsessions_client_scope (id, organization_id, client_id),
  UNIQUE KEY uq_authsessions_token (token_sha256),
  KEY ix_authsessions_user (organization_id, user_id, expires_at),
  KEY ix_authsessions_client (organization_id, client_id, expires_at),
  CONSTRAINT fk_authsessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_authsessions_user FOREIGN KEY (user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_authsessions_client FOREIGN KEY (client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT fk_authsessions_portaltoken FOREIGN KEY (portal_access_token_id, organization_id, client_id) REFERENCES portal_access_tokens(id, organization_id, client_id),
  CONSTRAINT ck_authsessions_principal CHECK ((principal_kind='internal_user' AND user_id IS NOT NULL AND client_id IS NULL AND portal_access_token_id IS NULL) OR (principal_kind='client_portal' AND client_id IS NOT NULL AND user_id IS NULL)),
  CONSTRAINT ck_authsessions_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE idempotency_keys (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_client_id BIGINT UNSIGNED NULL,
  endpoint_code VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  key_sha256 BINARY(32) NOT NULL,
  request_sha256 BINARY(32) NOT NULL,
  state_code VARCHAR(24) NOT NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_json JSON NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency_key (organization_id, actor_user_id, endpoint_code, key_sha256),
  UNIQUE KEY uq_idempotency_client (organization_id, actor_client_id, endpoint_code, key_sha256),
  CONSTRAINT fk_idempotency_client FOREIGN KEY (actor_client_id, organization_id) REFERENCES clients(id, organization_id),
  CONSTRAINT ck_idempotency_actor CHECK ((actor_user_id IS NOT NULL) + (actor_client_id IS NOT NULL) = 1),
  CONSTRAINT fk_idempotency_actor FOREIGN KEY (actor_user_id, organization_id) REFERENCES users(id, organization_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE import_batches (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NULL,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_system VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_filename VARCHAR(500) NOT NULL,
  source_sha256 BINARY(32) NOT NULL,
  source_size_bytes BIGINT UNSIGNED NOT NULL,
  encrypted_archive_storage_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mapping_version VARCHAR(64) NOT NULL,
  importer_version VARCHAR(64) NOT NULL,
  status_code VARCHAR(32) NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT TRUE,
  manifest_json JSON NULL,
  started_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importbatches_public (public_id),
  UNIQUE KEY uq_importbatches_source (source_system, source_sha256, mapping_version, importer_version, dry_run),
  CONSTRAINT fk_importbatches_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE import_records (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_batch_id BIGINT UNSIGNED NOT NULL,
  root_collection VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_ordinal INT UNSIGNED NOT NULL,
  source_legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  source_json_path VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_nopad_bin NOT NULL,
  source_record_sha256 BINARY(32) NOT NULL,
  redacted_payload_json JSON NOT NULL,
  redaction_manifest_json JSON NOT NULL,
  status_code VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importrecords_path (import_batch_id, source_json_path),
  UNIQUE KEY uq_importrecords_batch (id, import_batch_id),
  UNIQUE KEY uq_importrecords_collection (import_batch_id, root_collection, source_ordinal),
  CONSTRAINT fk_importrecords_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE import_issues (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_batch_id BIGINT UNSIGNED NOT NULL,
  import_record_id BIGINT UNSIGNED NULL,
  severity VARCHAR(16) NOT NULL,
  issue_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_json_path TEXT NULL,
  evidence_json JSON NULL,
  resolution_status VARCHAR(24) NOT NULL DEFAULT 'open',
  decision_text TEXT NULL,
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  KEY ix_importissues_batch_status (import_batch_id, resolution_status, severity),
  CONSTRAINT fk_importissues_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(id),
  CONSTRAINT fk_importissues_record FOREIGN KEY (import_record_id, import_batch_id) REFERENCES import_records(id, import_batch_id),
  CONSTRAINT fk_importissues_actor FOREIGN KEY (decided_by) REFERENCES users(id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE legacy_id_map (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  import_batch_id BIGINT UNSIGNED NOT NULL,
  source_system VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_collection VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_parent_legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  source_legacy_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  target_entity_id BIGINT UNSIGNED NULL,
  target_user_id BIGINT UNSIGNED NULL,
  target_person_id BIGINT UNSIGNED NULL,
  target_requisition_item_id BIGINT UNSIGNED NULL,
  mapping_method VARCHAR(64) NOT NULL,
  evidence_json JSON NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_legacymap_source (organization_id, source_system, source_collection, source_parent_legacy_id, source_legacy_id),
  CONSTRAINT fk_legacymap_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_legacymap_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(id),
  CONSTRAINT fk_legacymap_entity FOREIGN KEY (target_entity_id, organization_id) REFERENCES business_entities(id, organization_id),
  CONSTRAINT fk_legacymap_user FOREIGN KEY (target_user_id, organization_id) REFERENCES users(id, organization_id),
  CONSTRAINT fk_legacymap_person FOREIGN KEY (target_person_id, organization_id) REFERENCES people(id, organization_id),
  CONSTRAINT fk_legacymap_reqitem FOREIGN KEY (target_requisition_item_id, organization_id) REFERENCES requisition_items(id, organization_id),
  CONSTRAINT ck_legacymap_target CHECK ((target_entity_id IS NOT NULL) + (target_user_id IS NOT NULL) + (target_person_id IS NOT NULL) + (target_requisition_item_id IS NOT NULL) = 1)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

-- Anclaje de evidencia de firma al lote/original exacto por import_records.
ALTER TABLE signature_evidence ADD CONSTRAINT fk_signatureevidence_import
  FOREIGN KEY (import_record_id) REFERENCES import_records(id);

-- Referencias diferidas por dependencias mutuas, sin desactivar FKs.
ALTER TABLE organizations ADD CONSTRAINT fk_org_primary_contact
  FOREIGN KEY (primary_contact_person_id, id) REFERENCES people(id, organization_id);
ALTER TABLE requisitions ADD CONSTRAINT fk_requisitions_latest_change
  FOREIGN KEY (latest_change_request_id, organization_id, id) REFERENCES requisition_change_requests(id, organization_id, requisition_id);
ALTER TABLE requisition_items
  ADD CONSTRAINT fk_reqitems_source_cq FOREIGN KEY (source_customer_quote_version_id, organization_id) REFERENCES customer_quote_versions(id, organization_id),
  ADD CONSTRAINT fk_reqitems_created_change FOREIGN KEY (created_by_change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id),
  ADD CONSTRAINT fk_reqitems_cancelled_change FOREIGN KEY (cancelled_by_change_request_id, organization_id, requisition_id) REFERENCES requisition_change_requests(id, organization_id, requisition_id);
ALTER TABLE requisition_change_requests ADD CONSTRAINT fk_reqchanges_result_quote
  FOREIGN KEY (resulting_customer_quote_version_id, organization_id, requisition_id) REFERENCES customer_quote_versions(id, organization_id, requisition_id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchaseorders_mod_authorization
  FOREIGN KEY (modification_authorization_request_id, organization_id, series_public_id) REFERENCES purchase_order_modification_requests(id, organization_id, series_public_id);
ALTER TABLE signature_evidence
  ADD CONSTRAINT fk_signatureevidence_signer_session FOREIGN KEY (signer_auth_session_id, organization_id) REFERENCES auth_sessions(id, organization_id),
  ADD CONSTRAINT fk_signatureevidence_signer_session_user FOREIGN KEY (signer_auth_session_id, organization_id, signer_user_id) REFERENCES auth_sessions(id, organization_id, user_id),
  ADD CONSTRAINT fk_signatureevidence_signer_session_client FOREIGN KEY (signer_auth_session_id, organization_id, signer_client_id) REFERENCES auth_sessions(id, organization_id, client_id),
  ADD CONSTRAINT fk_signatureevidence_capture_session FOREIGN KEY (capture_auth_session_id, organization_id, captured_by_user_id) REFERENCES auth_sessions(id, organization_id, user_id);
ALTER TABLE customer_quote_decisions
  ADD CONSTRAINT fk_cqdecisions_session FOREIGN KEY (auth_session_id, organization_id) REFERENCES auth_sessions(id, organization_id),
  ADD CONSTRAINT fk_cqdecisions_session_user FOREIGN KEY (auth_session_id, organization_id, actor_user_id) REFERENCES auth_sessions(id, organization_id, user_id),
  ADD CONSTRAINT fk_cqdecisions_session_client FOREIGN KEY (auth_session_id, organization_id, actor_client_id) REFERENCES auth_sessions(id, organization_id, client_id);
ALTER TABLE invoice_acknowledgments ADD CONSTRAINT fk_invoiceacks_session
  FOREIGN KEY (auth_session_id, organization_id, client_id) REFERENCES auth_sessions(id, organization_id, client_id);

-- CONTRATOS QUE NO QUEDAN RESUELTOS SÓLO CON LAS FK/CHECK:
-- 1. party_contacts/channels: owner debe ser cliente o proveedor, y el contacto
--    correcto no se deduce de la posición en arrays independientes.
-- 2. business_entities.kind y subtipo se crean/validan juntos transaccionalmente.
-- 3. Coincidencia del cliente entre requisición, proyecto, contrato, cotización
--    y entrega; del proveedor entre RFQ, quote, adjudicación y OC; y de las
--    partidas entre quote/award/OC/recepción/entrega. Resolver y bloquear antes.
-- 4. Ninguna suma de adjudicación/compra/recepción/entrega debe exceder su saldo
--    autorizado; bloquear filas de saldo durante las operaciones concurrentes.
-- 5. La suma de purchase_order_line_sources se concilia con su línea OC;
--    la suma de delivery_item_allocations se concilia con su línea entregada.
-- 6. Las 4 recepciones originales no tienen líneas: header_only, sin inventar
--    cantidades. Las 4 líneas entregadas sí existen; sus snapshots se preservan.
-- 7. La autorización interna y decisión del cliente son estados separados.
--    status=Aprobada del legado no prueba decisión del cliente.
-- 8. No agrupar versiones de cotización por prefijos de folio: pueden referirse
--    a otras requisiciones. Cada objeto legado se conserva sin reasignación.
--    supersedes_version_id sólo admite la misma serie por FK. Prohibir
--    autorreferencia, ciclos y orden incorrecto transaccionalmente en backend.
--    La ausencia de CHECK con id conserva la decisión del modelo v0.2.
--    Autorreferencias y ciclos siguen siendo reglas del servicio, no garantías SQL.
-- 9. El código confirma descuento porcentual y honorario sobre neto de terceros,
--    con IVA de terceros y del honorario separados. Campos faltantes permanecen
--    NULL: no deducir fee/FX de la diferencia del total. Sin recálculo de legado.
--    financial_breakdown_provenance distingue source_explicit/recovered/
--    approved_reconstruction/unresolved; registrar evidencia de conciliación.
-- 10. policy snapshot, documento exacto y hash acompañan toda aprobación nueva.
--     Hash legado se preserva con hashing_scope: algunas firmas hashéan texto
--     Data URI UTF-8; files.sha256 corresponde a bytes. No son intercambiables.
--     Conservar representación original exacta en el archivo privado y su path.
--     La verificación de un hash no acredita constancia NOM-151; conservar estado declarado.
-- 11. Enviado en emailLogs se conserva como reporte legado, no como delivered.
--     La importación NO crea trabajos de outbox ni reenvía mensajes históricos.
-- 12. Contadores se concilian con folios y alcance real; no se copian ciegamente.
-- 13. Catálogos/unidades/monedas requieren semillas aprobadas separadas.
-- 14. Índices de texto libre y FULLTEXT se agregan con consultas/volumen reales.
-- 15. No se migran _syncPending/_syncError como estado de negocio: son incidencias.
-- 16. Raw source, staging y logs contienen datos personales: acceso restringido,
--     retención y redacción específica. Los secretos nunca se publican al cliente.
-- 17. Ningún formato temporal ambiguo recibe UTC inventado; conservar texto
--     y registrar incidencia hasta que su timezone/semántica sea verificable.
-- 18. import_batches puede describir archivo sin organización decidida; antes
--     de aplicar legacy_id_map se verifica que su organización coincida con
--     el lote resuelto. No hay bypass de scope por un lote de staging.
-- 19. Las tablas de control y auditoría requieren privilegios SQL separados,
--     además de políticas de acceso del backend. Este DDL no crea cuentas.
-- 20. CQ: UNIQUE(customer_quote_id, version_number); PO: UNIQUE(org, serieUUID,
--     version_number). Folio es una etiqueta histórica repetible por revisión.
--     El servicio reserva el folio/serie y bloquea serie o raíz al crear revisión,
--     verificando que sólo una revisión siga vigente. No hay índice parcial ni
--     trigger que haga esa verificación aquí. No agrupar por folio solamente.
--     Raíz/predecesor PO pertenecen a la misma serie por FK; prohibir ciclos,
--     autorreferencias, ramas y predecesores posteriores en el servicio.
-- 21. MOD-OC autoriza UNA enmienda; no autoriza su contenido final. Bloquear la
--     solicitud, comprobar estado/revisión/actor y consumirla en la transacción
--     que crea la nueva OC. Solicitar y decidir son personas distintas; la regla
--     se aplica en backend, con permiso por acción y sin autoaprobación admin.
-- 22. Factura: registro de documento recibido/cargado. No se deducen partidas,
--     pagos, cuentas contables, timbrado ni cumplimiento fiscal. El acuse indica
--     recepción del archivo; no prueba pago. El snapshot/archivo del acuse queda
--     fijo aunque el registro cambie. Su versión, cliente y sesión se verifican.
-- 23. Nueva recepción queda ligada a la versión/línea realmente recibida; una
--     enmienda calcula saldos por linaje, no duplica recepción ni la reescribe.
--     Reasignaciones legadas y receivedQtyByItem se conservan en snapshot y
--     requieren conciliación de origen antes de convertirlas a líneas reales.
-- 24. CQ final en HTML 35639 no obliga a firma gráfica para aprobación interna.
--     Los responsables/política se validan; no añadir ese bloqueo artificial.
-- 25. Servicio puede no referir requisición. Los ocho tipos del código y sus
--     detalles/stops se validan con JSON Schema versionado en el backend.
-- 26. canonical_payload_file_id guarda bytes canónicos exactos. JSON snapshots
--     no sustituyen esa representación para verificar hash. Data URI y bytes
--     tienen hashes diferentes. No inferir consentimiento ni certificación.
-- 27. auth_sessions: token opaco aleatorio sólo hash, alcance y expiración,
--     revocación inmediata y permisos actuales comprobados por petición.
--     No importar códigos/contraseñas del portal como credenciales válidas.
-- 28. customer_quote_adjustments sólo añade conceptos que no estén ya en
--     discount/service_fee. No duplicar honorario o IVA ni cuadrar diferencias.
-- 29. files.storage_backend identifica un namespace/bucket/config privado único,
--     no un proveedor genérico; storage_key incluye prefijo de organización.
--     UNIQUE(namespace, key) evita que dos organizaciones compartan por error
--     la misma dirección física. Ninguna clave contiene credenciales.
-- 30. En signature_evidence, signer_auth_session_id sólo se usa cuando el
--     firmante se autenticó. capture_auth_session_id identifica al capturista
--     interno. Capturar firma externa con sesión interna no autentica al
--     firmante; conservar signer snapshot y dejar su sesión NULL.
-- 31. El JSON actual no contiene revisionHistory/changeHistory ni facturas;
--     sí conserva números revision en cotizaciones. Las tablas nuevas derivan
--     de contratos implementados en HTML y de controles propuestos.


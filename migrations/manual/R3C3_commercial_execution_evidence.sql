-- R3C3 ONLY: PROPOSED MANUAL DDL. DO NOT RUN without independent authorization,
-- tested backup and TEST rehearsal. Requires R3C2 table already installed.
-- Two append-only tables. API service uses SELECT/INSERT only; no UPDATE/DELETE.
-- Composite assessment FK ensures assessment belongs to the same organization/change/requisition.
-- Verified evidences are NOT commercial approvals or replacements for issuer workflows.
ALTER TABLE requisition_change_commercial_assessments
    ADD UNIQUE KEY uq_r3c3_assessment_scope (id,organization_id,change_request_id,requisition_id);

CREATE TABLE requisition_change_commercial_executions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    change_request_id BIGINT UNSIGNED NOT NULL,
    requisition_id BIGINT UNSIGNED NOT NULL,
    assessment_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    assessment_version INT UNSIGNED NOT NULL,
    inventory_sha256 BINARY(32) NOT NULL,
    document_kind VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document_entity_id BIGINT UNSIGNED NOT NULL,
    action_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    successor_entity_id BIGINT UNSIGNED NULL,
    source_sha256 BINARY(32) NOT NULL,
    successor_sha256 BINARY(32) NULL,
    evidence_file_id BIGINT UNSIGNED NOT NULL,
    evidence_sha256 BINARY(32) NOT NULL,
    reference_text VARCHAR(255) NOT NULL,
    reason_text TEXT NOT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uq_r3c3_execution_public (public_id),
    UNIQUE KEY uq_r3c3_execution_id_org (id, organization_id),
    KEY ix_r3c3_execution_change (organization_id,change_request_id,id),
    CONSTRAINT fk_r3c3_exec_change FOREIGN KEY(change_request_id,organization_id,requisition_id)
      REFERENCES requisition_change_requests(id,organization_id,requisition_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_exec_assessment FOREIGN KEY(assessment_id,organization_id,change_request_id,requisition_id)
      REFERENCES requisition_change_commercial_assessments(id,organization_id,change_request_id,requisition_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_exec_document FOREIGN KEY(document_entity_id,organization_id)
      REFERENCES business_entities(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_exec_successor FOREIGN KEY(successor_entity_id,organization_id)
      REFERENCES business_entities(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_exec_file FOREIGN KEY(evidence_file_id,organization_id)
      REFERENCES files(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_exec_recorder FOREIGN KEY(recorded_by,organization_id)
      REFERENCES users(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_r3c3_exec_versions CHECK(assessment_version>0),
    CONSTRAINT ck_r3c3_exec_successor CHECK(
      (action_code IN ('replacement_quote_verified','formal_amendment_verified') AND successor_entity_id IS NOT NULL AND successor_sha256 IS NOT NULL)
      OR (action_code NOT IN ('replacement_quote_verified','formal_amendment_verified') AND successor_entity_id IS NULL AND successor_sha256 IS NULL)),
    CONSTRAINT ck_r3c3_exec_action CHECK(action_code IN (
      'supplier_contact_documented','supplier_confirmation_documented','client_confirmation_documented',
      'replacement_quote_verified','formal_amendment_verified')),
    CONSTRAINT ck_r3c3_exec_kind CHECK(document_kind IN ('rfqs','supplier_quotes','customer_quote_versions','purchase_orders'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

CREATE TABLE requisition_change_commercial_execution_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    execution_id BIGINT UNSIGNED NOT NULL,
    decision_code VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason_text TEXT NOT NULL,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uq_r3c3_review_once (execution_id),
    KEY ix_r3c3_review_org (organization_id,execution_id),
    CONSTRAINT fk_r3c3_review_execution FOREIGN KEY(execution_id,organization_id)
      REFERENCES requisition_change_commercial_executions(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c3_review_actor FOREIGN KEY(actor_user_id,organization_id)
      REFERENCES users(id,organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_r3c3_review_decision CHECK(decision_code IN ('verified','rejected'))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;

-- R3C2: PROPOSED MANUAL DDL ONLY; NOT EXECUTED / NOT AUTO-RUN.
-- Requires independent authorization, verified backup, TEST rehearsal, and
-- coordination with R3C1 CHECK migration + least-privilege provisioning.
-- Do not apply to imported data or production. DDL is not transactional.
-- Append-only: application has SELECT+INSERT only, no UPDATE/DELETE grants.

CREATE TABLE requisition_change_commercial_assessments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organization_id BIGINT UNSIGNED NOT NULL,
    change_request_id BIGINT UNSIGNED NOT NULL,
    requisition_id BIGINT UNSIGNED NOT NULL,
    assessment_version INT UNSIGNED NOT NULL,
    requisition_version INT UNSIGNED NOT NULL,
    inventory_sha256 BINARY(32) NOT NULL,
    inventory_json JSON NOT NULL,
    assessment_json JSON NOT NULL,
    reason_text TEXT NOT NULL,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_r3c2_assessment_version (change_request_id, assessment_version),
    KEY ix_r3c2_assessment_org_change (organization_id, change_request_id),
    CONSTRAINT fk_r3c2_assessment_change FOREIGN KEY (change_request_id, organization_id, requisition_id)
      REFERENCES requisition_change_requests (id, organization_id, requisition_id)
      ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_r3c2_assessment_actor FOREIGN KEY (actor_user_id, organization_id)
      REFERENCES users (id, organization_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_r3c2_assessment_version CHECK (assessment_version > 0 AND requisition_version > 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_nopad_ai_ci;
